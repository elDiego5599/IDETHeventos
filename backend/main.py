import os
import sys
import uuid
from datetime import datetime, timedelta

# Agregamos la raiz del proyecto al path para que "from backend..." funcione
# tanto con "python backend/main.py" como con "flask --app backend.main run"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, jsonify, g, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

from backend.database import get_db, init_db, hash_password
from backend.auth import (
    verify_password,
    create_access_token,
    login_requerido,
    admin_requerido,
    usuario_opcional,
)
from backend.models import (
    validar_registro,
    validar_login,
    validar_rol,
    validar_catalogo,
    validar_evento_crear,
    validar_inscripcion,
    validar_calificacion,
    validar_comentario,
    validar_sugerencia,
    validar_reporte,
    validar_reporte_estado,
    validar_encuesta,
    validar_respuesta_encuesta,
)

# Cargamos las variables del archivo .env por si acaso
load_dotenv()

# Carpeta del frontend (para servir las paginas y las fotos subidas)
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")

# Creamos la aplicacion principal con Flask
app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="/static")
app.config["JSON_AS_ASCII"] = False

# Permitimos que el frontend se conecte sin problemas
CORS(app)


# Funcion para formatear fechas y que siempre se vean igual (YYYY-MM-DD HH:MM)
def formatear_fecha(fecha):
    if hasattr(fecha, "strftime"):
        return fecha.strftime("%Y-%m-%d %H:%M")
    s = str(fecha).strip()
    if len(s) >= 16:
        return s[:16]
    return s


def determinar_estado_evento(fecha_val, ahora):
    # Determina si el evento ya paso, si esta en curso/activo hoy, o si es proximo
    try:
        s = str(fecha_val).strip()[:16]
        fecha_evt = datetime.strptime(s, "%Y-%m-%d %H:%M")
        if fecha_evt.date() < ahora.date():
            return "pasado", True
        elif fecha_evt.date() == ahora.date():
            return "activo", False
        else:
            return "proximo", False
    except Exception:
        return "proximo", False


def error(mensaje, codigo):
    # Devuelve los errores con el mismo formato que usaba FastAPI ({"detail": ...})
    # para no romper el frontend, que lee data.detail
    return jsonify({"detail": mensaje}), codigo


@app.errorhandler(404)
def no_encontrado(e):
    if request.path.startswith("/api"):
        return jsonify({"detail": "Recurso no encontrado"}), 404
    return e


@app.errorhandler(405)
def metodo_no_permitido(e):
    if request.path.startswith("/api"):
        return jsonify({"detail": "Metodo no permitido"}), 405
    return e


# ----------------- 1. Registro y login -----------------

@app.route("/api/auth/register", methods=["POST"])
def register():
    # Este endpoint permite que un estudiante cree su cuenta
    datos, mensaje = validar_registro(request.get_json(silent=True))
    if mensaje:
        return error(mensaje, 400)

    with get_db() as conn:
        cursor = conn.cursor()
        # Revisamos si ya existe un usuario con ese correo
        cursor.execute("SELECT id FROM usuarios WHERE email = %s", (datos["email"],))
        if cursor.fetchone():
            return error("Ya existe una cuenta con este correo.", 400)

        # Encriptamos la contraseña antes de guardarla
        hashed_pwd = hash_password(datos["password"])
        cursor.execute(
            "INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (%s, %s, %s, 'estudiante') RETURNING id",
            (datos["nombre"], datos["email"], hashed_pwd)
        )
        user_id = cursor.fetchone()["id"]

    # Creamos el token para que entre directamente sin volver a loguearse
    token = create_access_token({"sub": user_id, "rol": "estudiante"})
    return jsonify({
        "mensaje": "Registro exitoso.",
        "token": token,
        "usuario": {
            "id": user_id,
            "nombre": datos["nombre"],
            "email": datos["email"],
            "rol": "estudiante"
        }
    }), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    # Este endpoint permite iniciar sesion con correo y contraseña
    datos, mensaje = validar_login(request.get_json(silent=True))
    if mensaje:
        return error(mensaje, 400)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, nombre, email, password_hash, rol FROM usuarios WHERE email = %s",
            (datos["email"],)
        )
        user = cursor.fetchone()

    # Verificamos que el usuario exista y que la contraseña sea correcta
    if not user or not verify_password(datos["password"], user["password_hash"]):
        return error("Correo o contrasena incorrectos.", 401)

    token = create_access_token({"sub": user["id"], "rol": user["rol"]})
    return jsonify({
        "mensaje": f"Bienvenido, {user['nombre']}",
        "token": token,
        "usuario": {
            "id": user["id"],
            "nombre": user["nombre"],
            "email": user["email"],
            "rol": user["rol"]
        }
    })


@app.route("/api/auth/me", methods=["GET"])
@login_requerido
def get_me():
    # Devuelve los datos del usuario que esta logueado
    return jsonify(g.usuario_actual)


# ----------------- 2. Eventos -----------------

@app.route("/api/upload-imagen", methods=["POST"])
@admin_requerido
def upload_imagen():
    # Permite subir una foto para la portada del evento desde el computador
    archivo = request.files.get("file")
    if archivo is None or not archivo.filename:
        return error("Debes enviar una imagen en el campo 'file'.", 400)

    ext = os.path.splitext(archivo.filename)[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
        return error("Formato no valido. Usa JPG, PNG o WEBP.", 400)

    nombre_archivo = f"evento_{uuid.uuid4().hex[:10]}{ext}"
    destino = os.path.join(FRONTEND_DIR, "img", "uploads", nombre_archivo)
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    archivo.save(destino)

    return jsonify({"url": f"/static/img/uploads/{nombre_archivo}"})


@app.route("/api/eventos", methods=["GET"])
@usuario_opcional
def get_eventos():
    # Soporta tanto 'tipo' como 'filtro'
    tipo = request.args.get("tipo", "todos")
    filtro = request.args.get("filtro")
    categoria_id = request.args.get("categoria_id", type=int)
    busqueda = request.args.get("busqueda")

    tipo_filtro = filtro or tipo or "todos"
    if tipo_filtro not in ["todos", "proximos", "activos", "pasados"]:
        tipo_filtro = "todos"
    ahora = datetime.now()
    inicio_hoy = ahora.replace(hour=0, minute=0, second=0, microsecond=0)
    fin_hoy = ahora.replace(hour=23, minute=59, second=59, microsecond=999999)

    query = """
    SELECT
        e.id, e.titulo, e.descripcion, e.fecha,
        e.ubicacion_id, u.nombre AS ubicacion_nombre,
        e.categoria_id, c.nombre AS categoria_nombre,
        e.organizador_id, o.nombre AS organizador_nombre,
        e.imagen_url, e.frase_motivacional, e.permite_voluntarios, e.resumen_pasado,
        COUNT(DISTINCT i.id) AS total_inscritos,
        ROUND(AVG(cal.puntuacion)::numeric, 1) AS calificacion_promedio,
        COUNT(DISTINCT cal.id) AS total_calificaciones
    FROM eventos e
    LEFT JOIN ubicaciones u ON e.ubicacion_id = u.id
    LEFT JOIN categorias c ON e.categoria_id = c.id
    LEFT JOIN organizadores o ON e.organizador_id = o.id
    LEFT JOIN inscripciones i ON e.id = i.evento_id
    LEFT JOIN calificaciones cal ON e.id = cal.evento_id
    WHERE 1=1
    """
    params = []

    if tipo_filtro == "proximos":
        query += " AND e.fecha > %s"
        params.append(fin_hoy.strftime("%Y-%m-%d %H:%M:%S"))
    elif tipo_filtro == "activos":
        query += " AND e.fecha >= %s AND e.fecha <= %s"
        params.extend([inicio_hoy.strftime("%Y-%m-%d %H:%M:%S"), fin_hoy.strftime("%Y-%m-%d %H:%M:%S")])
    elif tipo_filtro == "pasados":
        query += " AND e.fecha < %s"
        params.append(inicio_hoy.strftime("%Y-%m-%d %H:%M:%S"))

    if categoria_id:
        query += " AND e.categoria_id = %s"
        params.append(categoria_id)

    if busqueda:
        query += " AND (LOWER(e.titulo) LIKE %s OR LOWER(e.descripcion) LIKE %s OR LOWER(e.frase_motivacional) LIKE %s)"
        term = f"%{busqueda.lower().strip()}%"
        params.extend([term, term, term])

    query += """
    GROUP BY e.id, e.titulo, e.descripcion, e.fecha, u.nombre, c.nombre, o.nombre, e.imagen_url, e.frase_motivacional, e.permite_voluntarios, e.resumen_pasado
    ORDER BY e.fecha ASC
    """

    current_user = g.usuario_actual
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()

        mis_inscripciones = set()
        if current_user:
            cursor.execute("SELECT evento_id FROM inscripciones WHERE usuario_id = %s", (current_user["id"],))
            mis_inscripciones = {r["evento_id"] for r in cursor.fetchall()}

    eventos = []
    for r in rows:
        item = dict(r)
        item["fecha"] = formatear_fecha(item["fecha"])
        item["esta_inscrito"] = item["id"] in mis_inscripciones
        item["estado"], item["es_pasado"] = determinar_estado_evento(item["fecha"], ahora)
        eventos.append(item)

    return jsonify(eventos)


@app.route("/api/eventos/<int:evento_id>", methods=["GET"])
@usuario_opcional
def get_evento_detalle(evento_id):
    # Este endpoint trae toda la informacion de un evento especifico
    ahora = datetime.now()
    current_user = g.usuario_actual
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT
            e.id, e.titulo, e.descripcion, e.fecha,
            e.ubicacion_id, u.nombre AS ubicacion_nombre,
            e.categoria_id, c.nombre AS categoria_nombre,
            e.organizador_id, o.nombre AS organizador_nombre,
            e.imagen_url, e.frase_motivacional, e.permite_voluntarios, e.resumen_pasado,
            COUNT(DISTINCT i.id) AS total_inscritos,
            ROUND(AVG(cal.puntuacion)::numeric, 1) AS calificacion_promedio,
            COUNT(DISTINCT cal.id) AS total_calificaciones
        FROM eventos e
        LEFT JOIN ubicaciones u ON e.ubicacion_id = u.id
        LEFT JOIN categorias c ON e.categoria_id = c.id
        LEFT JOIN organizadores o ON e.organizador_id = o.id
        LEFT JOIN inscripciones i ON e.id = i.evento_id
        LEFT JOIN calificaciones cal ON e.id = cal.evento_id
        WHERE e.id = %s
        GROUP BY e.id, e.titulo, e.descripcion, e.fecha, u.nombre, c.nombre, o.nombre, e.imagen_url, e.frase_motivacional, e.permite_voluntarios, e.resumen_pasado
        """, (evento_id,))
        evento = cursor.fetchone()

        if not evento:
            return error("Evento no encontrado", 404)

        evento_dict = dict(evento)
        evento_dict["fecha"] = formatear_fecha(evento_dict["fecha"])

        # Estado del evento
        evento_dict["estado"], evento_dict["es_pasado"] = determinar_estado_evento(evento_dict["fecha"], ahora)

        # Traemos los comentarios de ese evento
        cursor.execute("""
        SELECT c.id, c.texto, c.fecha, u.nombre AS autor_nombre, u.rol AS autor_rol
        FROM comentarios c
        JOIN usuarios u ON c.usuario_id = u.id
        WHERE c.evento_id = %s
        ORDER BY c.id DESC
        """, (evento_id,))
        comentarios = []
        for c in cursor.fetchall():
            com = dict(c)
            com["fecha"] = formatear_fecha(com["fecha"])
            comentarios.append(com)
        evento_dict["comentarios"] = comentarios

        evento_dict["esta_inscrito"] = False
        evento_dict["mi_calificacion"] = None
        evento_dict["mi_tipo_participacion"] = None
        evento_dict["mi_detalle_participacion"] = None

        if current_user:
            cursor.execute(
                "SELECT id, tipo_participacion, detalle_participacion FROM inscripciones WHERE usuario_id = %s AND evento_id = %s",
                (current_user["id"], evento_id)
            )
            insc = cursor.fetchone()
            if insc:
                evento_dict["esta_inscrito"] = True
                evento_dict["mi_tipo_participacion"] = insc.get("tipo_participacion") or "asistente"
                evento_dict["mi_detalle_participacion"] = insc.get("detalle_participacion")

            cursor.execute("SELECT puntuacion FROM calificaciones WHERE usuario_id = %s AND evento_id = %s", (current_user["id"], evento_id))
            cal = cursor.fetchone()
            if cal:
                evento_dict["mi_calificacion"] = cal["puntuacion"]

    return jsonify(evento_dict)


@app.route("/api/eventos/<int:evento_id>/inscritos", methods=["GET"])
@admin_requerido
def get_inscritos_evento(evento_id):
    # Permite al admin ver la lista de todos los inscritos y sus propuestas de participacion
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT i.id, i.usuario_id, u.nombre, u.email, i.tipo_participacion, i.detalle_participacion, i.fecha_registro
        FROM inscripciones i
        JOIN usuarios u ON i.usuario_id = u.id
        WHERE i.evento_id = %s
        ORDER BY i.fecha_registro ASC
        """, (evento_id,))
        filas = cursor.fetchall()

    inscritos = []
    for f in filas:
        item = dict(f)
        item["usuario_nombre"] = item.get("nombre", "")
        item["fecha_registro"] = formatear_fecha(item["fecha_registro"])
        inscritos.append(item)
    return jsonify(inscritos)


@app.route("/api/eventos", methods=["POST"])
@admin_requerido
def create_evento():
    # Solo el administrador puede crear eventos nuevos
    datos, mensaje = validar_evento_crear(request.get_json(silent=True))
    if mensaje:
        return error(mensaje, 400)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO eventos (titulo, descripcion, fecha, ubicacion_id, categoria_id, organizador_id, imagen_url, frase_motivacional, permite_voluntarios, resumen_pasado)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (
            datos["titulo"],
            datos["descripcion"],
            datos["fecha"],
            datos["ubicacion_id"],
            datos["categoria_id"],
            datos["organizador_id"],
            datos["imagen_url"],
            datos["frase_motivacional"],
            datos["permite_voluntarios"],
            datos["resumen_pasado"]
        ))
        new_id = cursor.fetchone()["id"]

    return jsonify({"mensaje": "Evento creado exitosamente", "id": new_id}), 201


@app.route("/api/eventos/<int:evento_id>", methods=["PUT"])
@admin_requerido
def update_evento(evento_id):
    # Solo el administrador puede editar un evento (todos los campos son opcionales)
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return error("Datos invalidos.", 400)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM eventos WHERE id = %s", (evento_id,))
        actual = cursor.fetchone()
        if not actual:
            return error("El evento no existe", 404)

        # Guardamos la fecha vieja para comparar despues
        fecha_vieja_str = formatear_fecha(actual["fecha"])
        try:
            fecha_vieja = datetime.strptime(fecha_vieja_str, "%Y-%m-%d %H:%M")
            era_pasado = fecha_vieja < datetime.now()
        except Exception:
            era_pasado = False

        nuevo_titulo = body.get("titulo") if body.get("titulo") is not None else actual["titulo"]
        nueva_desc = body.get("descripcion") if body.get("descripcion") is not None else actual["descripcion"]
        nueva_fecha = body.get("fecha") if body.get("fecha") is not None else formatear_fecha(actual["fecha"])
        nueva_ubicacion = body.get("ubicacion_id") if body.get("ubicacion_id") is not None else actual["ubicacion_id"]
        nueva_categoria = body.get("categoria_id") if body.get("categoria_id") is not None else actual["categoria_id"]
        nuevo_org = body.get("organizador_id") if body.get("organizador_id") is not None else actual["organizador_id"]
        nueva_imagen = body.get("imagen_url") if body.get("imagen_url") is not None else actual.get("imagen_url")
        nueva_frase = body.get("frase_motivacional") if body.get("frase_motivacional") is not None else actual.get("frase_motivacional")
        nuevo_voluntarios = body.get("permite_voluntarios") if body.get("permite_voluntarios") is not None else actual.get("permite_voluntarios", False)
        nuevo_resumen = body.get("resumen_pasado") if body.get("resumen_pasado") is not None else actual.get("resumen_pasado")

        cursor.execute("""
        UPDATE eventos
        SET titulo = %s, descripcion = %s, fecha = %s, ubicacion_id = %s, categoria_id = %s, organizador_id = %s,
            imagen_url = %s, frase_motivacional = %s, permite_voluntarios = %s, resumen_pasado = %s
        WHERE id = %s
        """, (
            nuevo_titulo, nueva_desc, nueva_fecha, nueva_ubicacion, nueva_categoria, nuevo_org,
            nueva_imagen, nueva_frase, nuevo_voluntarios, nuevo_resumen, evento_id
        ))

        # Si el evento era pasado y ahora lo pasan a futuro, borramos comentarios y calificaciones
        if body.get("fecha") and era_pasado:
            try:
                nueva_fecha_dt = datetime.strptime(body.get("fecha"), "%Y-%m-%d %H:%M")
                if datetime.now() < nueva_fecha_dt:
                    cursor.execute("DELETE FROM comentarios WHERE evento_id = %s", (evento_id,))
                    cursor.execute("DELETE FROM calificaciones WHERE evento_id = %s", (evento_id,))
            except Exception:
                pass

    return jsonify({"mensaje": "Evento actualizado correctamente"})


@app.route("/api/eventos/<int:evento_id>", methods=["DELETE"])
@admin_requerido
def delete_evento(evento_id):
    # Solo el administrador puede eliminar eventos
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM eventos WHERE id = %s", (evento_id,))
        deleted = cursor.rowcount > 0

    if not deleted:
        return error("El evento no existe", 404)

    return jsonify({"mensaje": "Evento eliminado correctamente"})


# ----------------- 3. Inscripciones -----------------

@app.route("/api/inscripciones/<int:evento_id>", methods=["POST"])
@login_requerido
def inscribirse_a_evento(evento_id):
    # Permite que un estudiante se inscriba a un evento (como asistente o participante voluntario)
    datos, mensaje = validar_inscripcion(request.get_json(silent=True))
    if mensaje:
        return error(mensaje, 400)
    tipo_part = datos["tipo_participacion"]
    detalle_part = datos["detalle_participacion"]
    current_user = g.usuario_actual

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, titulo, fecha, permite_voluntarios FROM eventos WHERE id = %s", (evento_id,))
        evento = cursor.fetchone()
        if not evento:
            return error("El evento no existe", 404)

        fecha_evento = evento["fecha"]
        if isinstance(fecha_evento, str):
            fecha_evento = datetime.strptime(fecha_evento, "%Y-%m-%d %H:%M")
        if datetime.now() >= fecha_evento:
            return error("La inscripcion cerro porque el evento ya comenzo.", 400)

        # Revisamos si ya esta inscrito para no duplicar
        cursor.execute("SELECT id FROM inscripciones WHERE usuario_id = %s AND evento_id = %s", (current_user["id"], evento_id))
        if cursor.fetchone():
            return error("Ya estas inscrito en este evento.", 400)

        ahora = datetime.now()
        cursor.execute(
            """
            INSERT INTO inscripciones (usuario_id, evento_id, fecha_registro, tipo_participacion, detalle_participacion)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (current_user["id"], evento_id, ahora, tipo_part, detalle_part)
        )

    rol_texto = "como participante activo / voluntario" if tipo_part == "voluntario_activo" else "como asistente"
    return jsonify({"mensaje": f"Te has inscrito a '{evento['titulo']}' {rol_texto}."})


@app.route("/api/inscripciones/<int:evento_id>", methods=["DELETE"])
@login_requerido
def cancelar_inscripcion(evento_id):
    # Permite cancelar la inscripcion a un evento
    current_user = g.usuario_actual
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM inscripciones WHERE usuario_id = %s AND evento_id = %s",
            (current_user["id"], evento_id)
        )
        deleted = cursor.rowcount > 0

    if not deleted:
        return error("No estabas inscrito en este evento.", 400)

    return jsonify({"mensaje": "Inscripcion cancelada."})


@app.route("/api/inscripciones/mis-inscripciones", methods=["GET"])
@app.route("/api/inscripciones/mis-eventos", methods=["GET"])
@login_requerido
def get_mis_inscripciones():
    # Lista todos los eventos donde el estudiante esta inscrito con su rol
    ahora = datetime.now()
    current_user = g.usuario_actual
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT
            e.id, e.titulo, e.descripcion, e.fecha,
            e.imagen_url, e.frase_motivacional, e.resumen_pasado,
            u.nombre AS ubicacion_nombre,
            c.nombre AS categoria_nombre,
            o.nombre AS organizador_nombre,
            i.tipo_participacion, i.detalle_participacion,
            i.fecha_registro,
            ROUND(AVG(cal.puntuacion)::numeric, 1) AS calificacion_promedio
        FROM inscripciones i
        JOIN eventos e ON i.evento_id = e.id
        LEFT JOIN ubicaciones u ON e.ubicacion_id = u.id
        LEFT JOIN categorias c ON e.categoria_id = c.id
        LEFT JOIN organizadores o ON e.organizador_id = o.id
        LEFT JOIN calificaciones cal ON e.id = cal.evento_id
        WHERE i.usuario_id = %s
        GROUP BY e.id, e.titulo, e.descripcion, e.fecha, e.imagen_url, e.frase_motivacional, e.resumen_pasado, u.nombre, c.nombre, o.nombre, i.tipo_participacion, i.detalle_participacion, i.fecha_registro
        ORDER BY e.fecha ASC
        """, (current_user["id"],))
        rows = cursor.fetchall()

    mis_eventos = []
    for r in rows:
        item = dict(r)
        item["fecha"] = formatear_fecha(item["fecha"])
        item["fecha_registro"] = formatear_fecha(item["fecha_registro"])
        item["esta_inscrito"] = True
        item["estado"], item["es_pasado"] = determinar_estado_evento(item["fecha"], ahora)
        mis_eventos.append(item)

    return jsonify(mis_eventos)


# ----------------- 4. Calificaciones y Comentarios -----------------

@app.route("/api/calificaciones", methods=["POST"])
@login_requerido
def calificar_evento():
    # Permite calificar un evento solo si ya paso
    datos, mensaje = validar_calificacion(request.get_json(silent=True))
    if mensaje:
        return error(mensaje, 400)
    current_user = g.usuario_actual

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, fecha FROM eventos WHERE id = %s", (datos["evento_id"],))
        evento = cursor.fetchone()
        if not evento:
            return error("El evento no existe", 404)

        # Solo se puede calificar si el evento ya paso hace al menos un dia
        ahora = datetime.now()
        fecha_evento = evento["fecha"]
        if isinstance(fecha_evento, str):
            fecha_evento = datetime.strptime(fecha_evento, "%Y-%m-%d %H:%M")
        if ahora < fecha_evento + timedelta(days=1):
            return error("Solo puedes calificar un evento despues de que pase.", 400)

        # Revisamos si ya habia calificado antes
        cursor.execute("SELECT id FROM calificaciones WHERE usuario_id = %s AND evento_id = %s", (current_user["id"], datos["evento_id"]))
        existe = cursor.fetchone()
        if existe:
            cursor.execute("UPDATE calificaciones SET puntuacion = %s WHERE usuario_id = %s AND evento_id = %s", (datos["puntuacion"], current_user["id"], datos["evento_id"]))
        else:
            cursor.execute("INSERT INTO calificaciones (usuario_id, evento_id, puntuacion) VALUES (%s, %s, %s)", (current_user["id"], datos["evento_id"], datos["puntuacion"]))

    return jsonify({"mensaje": f"Calificaste con {datos['puntuacion']} estrellas."})


@app.route("/api/comentarios", methods=["POST"])
@login_requerido
def agregar_comentario():
    # Permite comentar un evento solo si ya paso
    datos, mensaje = validar_comentario(request.get_json(silent=True))
    if mensaje:
        return error(mensaje, 400)
    current_user = g.usuario_actual

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, fecha FROM eventos WHERE id = %s", (datos["evento_id"],))
        evento = cursor.fetchone()
        if not evento:
            return error("El evento no existe", 404)

        ahora = datetime.now()
        fecha_evento = evento["fecha"]
        if isinstance(fecha_evento, str):
            fecha_evento = datetime.strptime(fecha_evento, "%Y-%m-%d %H:%M")
        if ahora < fecha_evento + timedelta(days=1):
            return error("Solo puedes comentar un evento despues de que pase.", 400)

        ahora_dt = datetime.now()
        cursor.execute(
            "INSERT INTO comentarios (usuario_id, evento_id, texto, fecha) VALUES (%s, %s, %s, %s) RETURNING id",
            (current_user["id"], datos["evento_id"], datos["texto"], ahora_dt)
        )
        comment_id = cursor.fetchone()["id"]

    return jsonify({
        "mensaje": "Comentario publicado.",
        "comentario": {
            "id": comment_id,
            "texto": datos["texto"],
            "fecha": formatear_fecha(ahora_dt),
            "autor_nombre": current_user["nombre"],
            "autor_rol": current_user["rol"]
        }
    })


# ----------------- 5. Sugerencias (solo el admin las ve) -----------------

@app.route("/api/sugerencias", methods=["POST"])
@login_requerido
def crear_sugerencia():
    # Cualquier estudiante puede enviar una sugerencia, solo el admin las vera
    datos, mensaje = validar_sugerencia(request.get_json(silent=True))
    if mensaje:
        return error(mensaje, 400)
    current_user = g.usuario_actual
    ahora = datetime.now()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO sugerencias (usuario_id, texto, fecha) VALUES (%s, %s, %s)",
            (current_user["id"], datos["texto"], ahora)
        )

    return jsonify({"mensaje": "Sugerencia enviada."})


@app.route("/api/sugerencias", methods=["GET"])
@admin_requerido
def get_sugerencias():
    # Solo el administrador puede ver todas las sugerencias
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT s.id, s.texto, s.fecha, u.nombre AS autor_nombre, u.email AS autor_email
        FROM sugerencias s
        JOIN usuarios u ON s.usuario_id = u.id
        ORDER BY s.id DESC
        """)
        sugerencias = []
        for r in cursor.fetchall():
            s = dict(r)
            s["fecha"] = formatear_fecha(s["fecha"])
            sugerencias.append(s)

    return jsonify(sugerencias)


@app.route("/api/sugerencias/<int:sug_id>", methods=["DELETE"])
@admin_requerido
def delete_sugerencia(sug_id):
    # El admin puede eliminar una sugerencia ya revisada
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sugerencias WHERE id = %s", (sug_id,))

    return jsonify({"mensaje": "Sugerencia eliminada"})


# ----------------- 6. Categorias, ubicaciones y organizadores -----------------

@app.route("/api/categorias", methods=["GET"])
def get_categorias():
    # Lista todas las categorias disponibles
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre FROM categorias ORDER BY nombre ASC")
        return jsonify([dict(r) for r in cursor.fetchall()])


@app.route("/api/categorias", methods=["POST"])
@admin_requerido
def create_categoria():
    # Solo el admin puede crear categorias
    datos, mensaje = validar_catalogo(request.get_json(silent=True))
    if mensaje:
        return error(mensaje, 400)
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO categorias (nombre) VALUES (%s) RETURNING id", (datos["nombre"],))
            new_id = cursor.fetchone()["id"]
        return jsonify({"mensaje": "Categoria creada", "id": new_id, "nombre": datos["nombre"]}), 201
    except Exception:
        return error("Esta categoria ya existe.", 400)


@app.route("/api/categorias/<int:cat_id>", methods=["DELETE"])
@admin_requerido
def delete_categoria(cat_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM categorias WHERE id = %s", (cat_id,))
    return jsonify({"mensaje": "Categoria eliminada"})


@app.route("/api/ubicaciones", methods=["GET"])
def get_ubicaciones():
    # Lista todas las ubicaciones
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre FROM ubicaciones ORDER BY nombre ASC")
        return jsonify([dict(r) for r in cursor.fetchall()])


@app.route("/api/ubicaciones", methods=["POST"])
@admin_requerido
def create_ubicacion():
    datos, mensaje = validar_catalogo(request.get_json(silent=True))
    if mensaje:
        return error(mensaje, 400)
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO ubicaciones (nombre) VALUES (%s) RETURNING id", (datos["nombre"],))
            new_id = cursor.fetchone()["id"]
        return jsonify({"mensaje": "Ubicacion creada", "id": new_id, "nombre": datos["nombre"]}), 201
    except Exception:
        return error("Esta ubicacion ya existe.", 400)


@app.route("/api/ubicaciones/<int:ub_id>", methods=["DELETE"])
@admin_requerido
def delete_ubicacion(ub_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM ubicaciones WHERE id = %s", (ub_id,))
    return jsonify({"mensaje": "Ubicacion eliminada"})


@app.route("/api/organizadores", methods=["GET"])
def get_organizadores():
    # Lista todos los organizadores
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre FROM organizadores ORDER BY nombre ASC")
        return jsonify([dict(r) for r in cursor.fetchall()])


@app.route("/api/organizadores", methods=["POST"])
@admin_requerido
def create_organizador():
    datos, mensaje = validar_catalogo(request.get_json(silent=True))
    if mensaje:
        return error(mensaje, 400)
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO organizadores (nombre) VALUES (%s) RETURNING id", (datos["nombre"],))
            new_id = cursor.fetchone()["id"]
        return jsonify({"mensaje": "Organizador creado", "id": new_id, "nombre": datos["nombre"]}), 201
    except Exception:
        return error("Este organizador ya existe.", 400)


@app.route("/api/organizadores/<int:org_id>", methods=["DELETE"])
@admin_requerido
def delete_organizador(org_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM organizadores WHERE id = %s", (org_id,))
    return jsonify({"mensaje": "Organizador eliminado"})


# ----------------- 7. Usuarios (solo admin) -----------------

@app.route("/api/usuarios", methods=["GET"])
@admin_requerido
def get_usuarios():
    # Lista todos los usuarios, solo el admin puede ver esto
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre, email, rol FROM usuarios ORDER BY id ASC")
        return jsonify([dict(r) for r in cursor.fetchall()])


@app.route("/api/usuarios/<int:usuario_id>/rol", methods=["PUT"])
@admin_requerido
def update_user_rol(usuario_id):
    # Permite cambiar el rol de un usuario (de estudiante a admin o viceversa)
    datos, mensaje = validar_rol(request.get_json(silent=True))
    if mensaje:
        return error(mensaje, 400)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE usuarios SET rol = %s WHERE id = %s", (datos["rol"], usuario_id))
    return jsonify({"mensaje": f"Rol actualizado a '{datos['rol']}'"})


@app.route("/api/usuarios/<int:usuario_id>", methods=["DELETE"])
@admin_requerido
def delete_usuario(usuario_id):
    # Elimina un usuario, pero no deja que el admin se elimine a si mismo
    if usuario_id == g.usuario_actual["id"]:
        return error("No puedes eliminar tu propia cuenta.", 400)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM usuarios WHERE id = %s", (usuario_id,))
    return jsonify({"mensaje": "Usuario eliminado"})


# ----------------- 5.1 Reportes de Problemas / Inconvenientes -----------------

@app.route("/api/reportes", methods=["POST"])
@login_requerido
def reportar_problema():
    # Permite a un estudiante reportar un problema o inconveniente
    datos, mensaje = validar_reporte(request.get_json(silent=True))
    if mensaje:
        return error(mensaje, 400)
    current_user = g.usuario_actual
    ahora = datetime.now()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO reportes_problemas (usuario_id, evento_id, tipo_problema, descripcion, estado, fecha)
        VALUES (%s, %s, %s, %s, 'pendiente', %s) RETURNING id
        """, (current_user["id"], datos["evento_id"], datos["tipo_problema"], datos["descripcion"], ahora))
        nuevo_id = cursor.fetchone()["id"]

    return jsonify({"mensaje": "Inconveniente reportado correctamente. La coordinacion revisara el caso.", "id": nuevo_id})


@app.route("/api/reportes", methods=["GET"])
@admin_requerido
def get_reportes():
    # Lista todos los problemas reportados para el administrador
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT r.id, r.tipo_problema, r.descripcion, r.estado, r.fecha,
               u.nombre AS autor_nombre, u.email AS autor_email,
               e.titulo AS evento_titulo
        FROM reportes_problemas r
        JOIN usuarios u ON r.usuario_id = u.id
        LEFT JOIN eventos e ON r.evento_id = e.id
        ORDER BY r.id DESC
        """)
        reportes = []
        for row in cursor.fetchall():
            item = dict(row)
            item["fecha"] = formatear_fecha(item["fecha"])
            reportes.append(item)
    return jsonify(reportes)


@app.route("/api/reportes/<int:reporte_id>/estado", methods=["PUT"])
@admin_requerido
def update_reporte_estado(reporte_id):
    # Permite al admin cambiar el estado del reporte (pendiente, en revision, resuelto)
    datos, mensaje = validar_reporte_estado(request.get_json(silent=True))
    if mensaje:
        return error(mensaje, 400)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE reportes_problemas SET estado = %s WHERE id = %s", (datos["estado"], reporte_id))
    return jsonify({"mensaje": f"Estado cambiado a '{datos['estado']}'"})


# ----------------- 5.2 Encuestas Escolares -----------------

@app.route("/api/encuestas", methods=["POST"])
@admin_requerido
def crear_encuesta():
    # El admin crea una encuesta asociada a un evento escolar
    datos, mensaje = validar_encuesta(request.get_json(silent=True))
    if mensaje:
        return error(mensaje, 400)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO encuestas (evento_id, titulo, pregunta_1, opciones_1, pregunta_2, opciones_2, pregunta_abierta, activa)
        VALUES (%s, %s, %s, %s, %s, %s, %s, true) RETURNING id
        """, (
            datos["evento_id"],
            datos["titulo"],
            datos["pregunta_1"],
            datos["opciones_1"],
            datos["pregunta_2"],
            datos["opciones_2"],
            datos["pregunta_abierta"]
        ))
        encuesta_id = cursor.fetchone()["id"]
    return jsonify({"mensaje": "Encuesta escolar publicada", "id": encuesta_id})


@app.route("/api/encuestas/evento/<int:evento_id>", methods=["GET"])
@usuario_opcional
def get_encuesta_evento(evento_id):
    # Obtiene la encuesta activa del evento y si el alumno ya respondio
    current_user = g.usuario_actual
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM encuestas WHERE evento_id = %s AND activa = true ORDER BY id DESC LIMIT 1", (evento_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"tiene_encuesta": False})

        encuesta = dict(row)
        encuesta["fecha_creacion"] = formatear_fecha(encuesta.get("fecha_creacion", ""))
        encuesta["tiene_encuesta"] = True
        encuesta["ya_respondio"] = False

        if current_user:
            cursor.execute(
                "SELECT id FROM respuestas_encuestas WHERE encuesta_id = %s AND usuario_id = %s",
                (encuesta["id"], current_user["id"])
            )
            encuesta["ya_respondio"] = cursor.fetchone() is not None

    return jsonify(encuesta)


@app.route("/api/encuestas/<int:encuesta_id>/responder", methods=["POST"])
@login_requerido
def responder_encuesta(encuesta_id):
    # El estudiante envia sus respuestas a las preguntas cerradas y abiertas
    datos, mensaje = validar_respuesta_encuesta(request.get_json(silent=True))
    if mensaje:
        return error(mensaje, 400)
    current_user = g.usuario_actual
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM encuestas WHERE id = %s AND activa = true", (encuesta_id,))
        if not cursor.fetchone():
            return error("La encuesta no existe o ya no esta activa", 404)

        cursor.execute("SELECT id FROM respuestas_encuestas WHERE encuesta_id = %s AND usuario_id = %s", (encuesta_id, current_user["id"]))
        if cursor.fetchone():
            return error("Ya respondiste esta encuesta", 400)

        cursor.execute("""
        INSERT INTO respuestas_encuestas (encuesta_id, usuario_id, respuesta_1, respuesta_2, respuesta_abierta)
        VALUES (%s, %s, %s, %s, %s)
        """, (
            encuesta_id,
            current_user["id"],
            datos["respuesta_1"],
            datos["respuesta_2"],
            datos["respuesta_abierta"]
        ))

    return jsonify({"mensaje": "Muchas gracias! Tus respuestas ayudaran a mejorar los eventos del colegio."})


@app.route("/api/encuestas/<int:encuesta_id>/resultados", methods=["GET"])
@admin_requerido
def get_resultados_encuesta(encuesta_id):
    # Trae los resultados y opiniones abiertas para el administrador
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM encuestas WHERE id = %s", (encuesta_id,))
        encuesta = cursor.fetchone()
        if not encuesta:
            return error("Encuesta no encontrada", 404)

        cursor.execute("""
        SELECT r.id, r.respuesta_1, r.respuesta_2, r.respuesta_abierta, r.fecha, u.nombre AS autor_nombre
        FROM respuestas_encuestas r
        JOIN usuarios u ON r.usuario_id = u.id
        WHERE r.encuesta_id = %s
        ORDER BY r.fecha DESC
        """, (encuesta_id,))
        respuestas = [dict(r) for r in cursor.fetchall()]

    return jsonify({
        "encuesta": dict(encuesta),
        "total_respuestas": len(respuestas),
        "respuestas": respuestas
    })


# ----------------- 8. Estadisticas para el admin -----------------

@app.route("/api/stats", methods=["GET"])
@admin_requerido
def get_dashboard_stats():
    # Trae los numeros para el panel del admin
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as total FROM eventos")
        total_eventos = cursor.fetchone()["total"]

        cursor.execute("SELECT COUNT(*) as total FROM usuarios WHERE rol = 'estudiante'")
        total_estudiantes = cursor.fetchone()["total"]

        cursor.execute("SELECT COUNT(*) as total FROM inscripciones")
        total_inscripciones = cursor.fetchone()["total"]

        cursor.execute("SELECT COUNT(*) as total FROM sugerencias")
        total_sugerencias = cursor.fetchone()["total"]

        cursor.execute("SELECT COUNT(*) as total FROM reportes_problemas")
        total_problemas = cursor.fetchone()["total"]

        cursor.execute("SELECT COUNT(*) as total FROM encuestas")
        total_encuestas = cursor.fetchone()["total"]

    return jsonify({
        "total_eventos": total_eventos,
        "total_estudiantes": total_estudiantes,
        "total_inscripciones": total_inscripciones,
        "total_sugerencias": total_sugerencias,
        "total_problemas": total_problemas,
        "total_encuestas": total_encuestas
    })


# ----------------- 9. Servir las paginas del frontend -----------------

@app.route("/img/<path:filename>", methods=["GET"])
def servir_img(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, "img"), filename)


@app.route("/", methods=["GET"])
def serve_index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/login", methods=["GET"])
def serve_login():
    return send_from_directory(FRONTEND_DIR, "login.html")


@app.route("/register", methods=["GET"])
def serve_register():
    return send_from_directory(FRONTEND_DIR, "register.html")


@app.route("/dashboard", methods=["GET"])
def serve_dashboard():
    return send_from_directory(FRONTEND_DIR, "dashboard.html")


@app.route("/admin", methods=["GET"])
def serve_admin():
    return send_from_directory(FRONTEND_DIR, "admin.html")


if __name__ == "__main__":
    # Preparamos la base de datos y arrancamos el servidor Flask
    init_db()
    app.run(host="127.0.0.1", port=8000, debug=True)

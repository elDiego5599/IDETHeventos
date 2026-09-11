import os
import shutil
import uuid
from datetime import datetime, timedelta

from dotenv import load_dotenv
from flask import Flask, g, jsonify, request, send_from_directory
from flask_cors import CORS

from backend.auth import admin_requerido, login_requerido, usuario_opcional, verify_password, create_access_token
from backend.database import get_db, hash_password, init_db
from backend.models import (
    validar_calificacion,
    validar_catalogo,
    validar_comentario,
    validar_encuesta,
    validar_evento_crear,
    validar_inscripcion,
    validar_login,
    validar_registro,
    validar_reporte,
    validar_reporte_estado,
    validar_respuesta_encuesta,
    validar_rol,
    validar_sugerencia,
)

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
UPLOAD_DIR = os.path.join(FRONTEND_DIR, "img", "uploads")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="/static")
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024


def error(message, status_code=400):
    return jsonify({"detail": message}), status_code


def validated(validator):
    data, message = validator(request.get_json(silent=True) or {})
    if message:
        return None, error(message)
    return data, None


def format_date(value):
    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%d %H:%M")
    return str(value).strip()[:16]


def event_state(value, now=None):
    now = now or datetime.now()
    try:
        event_date = datetime.strptime(format_date(value), "%Y-%m-%d %H:%M")
    except (TypeError, ValueError):
        return "proximo", False
    if event_date.date() < now.date():
        return "pasado", True
    if event_date.date() == now.date():
        return "activo", False
    return "proximo", False


def serialize_event(row, now=None):
    item = dict(row)
    item["fecha"] = format_date(item["fecha"])
    item["estado"], item["es_pasado"] = event_state(item["fecha"], now)
    return item


def current_user():
    return getattr(g, "usuario_actual", None)


@app.before_request
def initialize_database():
    if not getattr(app, "_database_initialized", False):
        init_db()
        app._database_initialized = True


@app.errorhandler(404)
def not_found(_error):
    return error("Recurso no encontrado", 404)


@app.errorhandler(413)
def too_large(_error):
    return error("El archivo es demasiado grande", 413)


@app.post("/api/auth/register")
def register():
    data, response = validated(validar_registro)
    if response:
        return response
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM usuarios WHERE email = %s", (data["email"],))
        if cursor.fetchone():
            return error("Ya existe una cuenta con este correo.")
        cursor.execute(
            "INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (%s, %s, %s, 'estudiante') RETURNING id",
            (data["nombre"], data["email"], hash_password(data["password"])),
        )
        user_id = cursor.fetchone()["id"]
    user = {"id": user_id, "nombre": data["nombre"], "email": data["email"], "rol": "estudiante"}
    return jsonify({"mensaje": "Registro exitoso.", "token": create_access_token({"sub": user_id, "rol": "estudiante"}), "usuario": user}), 201


@app.post("/api/auth/login")
def login():
    data, response = validated(validar_login)
    if response:
        return response
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre, email, password_hash, rol FROM usuarios WHERE email = %s", (data["email"],))
        user = cursor.fetchone()
    if not user or not verify_password(data["password"], user["password_hash"]):
        return error("Correo o contrasena incorrectos.", 401)
    public_user = {"id": user["id"], "nombre": user["nombre"], "email": user["email"], "rol": user["rol"]}
    return jsonify({"mensaje": f"Bienvenido, {user['nombre']}", "token": create_access_token({"sub": user["id"], "rol": user["rol"]}), "usuario": public_user})


@app.get("/api/auth/me")
@login_requerido
def get_me():
    return jsonify(current_user())


@app.post("/api/upload-imagen")
@admin_requerido
def upload_image():
    uploaded = request.files.get("file")
    if not uploaded or not uploaded.filename:
        return error("Debes seleccionar una imagen.")
    extension = os.path.splitext(uploaded.filename)[1].lower()
    if extension not in (".jpg", ".jpeg", ".png", ".webp"):
        return error("Formato no valido. Usa JPG, PNG o WEBP.")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = f"evento_{uuid.uuid4().hex[:10]}{extension}"
    uploaded.save(os.path.join(UPLOAD_DIR, filename))
    return jsonify({"url": f"/static/img/uploads/{filename}"})


EVENT_SELECT = """
SELECT e.id, e.titulo, e.descripcion, e.fecha, e.ubicacion_id,
       u.nombre AS ubicacion_nombre, e.categoria_id, c.nombre AS categoria_nombre,
       e.organizador_id, o.nombre AS organizador_nombre, e.imagen_url,
       e.frase_motivacional, e.permite_voluntarios, e.resumen_pasado,
       COUNT(DISTINCT i.id) AS total_inscritos,
       ROUND(AVG(cal.puntuacion), 1) AS calificacion_promedio,
       COUNT(DISTINCT cal.id) AS total_calificaciones
FROM eventos e
LEFT JOIN ubicaciones u ON e.ubicacion_id = u.id
LEFT JOIN categorias c ON e.categoria_id = c.id
LEFT JOIN organizadores o ON e.organizador_id = o.id
LEFT JOIN inscripciones i ON e.id = i.evento_id
LEFT JOIN calificaciones cal ON e.id = cal.evento_id
"""
EVENT_GROUP = """
GROUP BY e.id, e.titulo, e.descripcion, e.fecha, e.ubicacion_id, u.nombre,
         e.categoria_id, c.nombre, e.organizador_id, o.nombre, e.imagen_url,
         e.frase_motivacional, e.permite_voluntarios, e.resumen_pasado
"""


@app.get("/api/eventos")
@usuario_opcional
def get_events():
    event_filter = request.args.get("filtro") or request.args.get("tipo", "todos")
    now = datetime.now()
    query = EVENT_SELECT + " WHERE 1=1"
    params = []
    if event_filter == "proximos":
        query += " AND e.fecha > %s"
        params.append(now.replace(hour=23, minute=59, second=59, microsecond=0))
    elif event_filter == "activos":
        query += " AND e.fecha >= %s AND e.fecha <= %s"
        params.extend([now.replace(hour=0, minute=0, second=0, microsecond=0), now.replace(hour=23, minute=59, second=59, microsecond=0)])
    elif event_filter == "pasados":
        query += " AND e.fecha < %s"
        params.append(now.replace(hour=0, minute=0, second=0, microsecond=0))
    category_id = request.args.get("categoria_id", type=int)
    if category_id:
        query += " AND e.categoria_id = %s"
        params.append(category_id)
    search = request.args.get("busqueda", "").strip().lower()
    if search:
        query += " AND (LOWER(e.titulo) LIKE %s OR LOWER(e.descripcion) LIKE %s OR LOWER(e.frase_motivacional) LIKE %s)"
        term = f"%{search}%"
        params.extend([term, term, term])
    query += EVENT_GROUP + " ORDER BY e.fecha ASC"
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        events = [serialize_event(row, now) for row in cursor.fetchall()]
        user = current_user()
        if user:
            cursor.execute("SELECT evento_id FROM inscripciones WHERE usuario_id = %s", (user["id"],))
            enrolled = {row["evento_id"] for row in cursor.fetchall()}
            for event in events:
                event["esta_inscrito"] = event["id"] in enrolled
        else:
            for event in events:
                event["esta_inscrito"] = False
    return jsonify(events)


@app.get("/api/eventos/<int:event_id>")
@usuario_opcional
def get_event(event_id):
    now = datetime.now()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(EVENT_SELECT + " WHERE e.id = %s " + EVENT_GROUP, (event_id,))
        row = cursor.fetchone()
        if not row:
            return error("Evento no encontrado", 404)
        event = serialize_event(row, now)
        cursor.execute("""SELECT c.id, c.texto, c.fecha, u.nombre AS autor_nombre, u.rol AS autor_rol
                         FROM comentarios c JOIN usuarios u ON c.usuario_id = u.id
                         WHERE c.evento_id = %s ORDER BY c.id DESC""", (event_id,))
        event["comentarios"] = [{**dict(comment), "fecha": format_date(comment["fecha"])} for comment in cursor.fetchall()]
        event.update({"esta_inscrito": False, "mi_calificacion": None, "mi_tipo_participacion": None, "mi_detalle_participacion": None})
        user = current_user()
        if user:
            cursor.execute("SELECT tipo_participacion, detalle_participacion FROM inscripciones WHERE usuario_id = %s AND evento_id = %s", (user["id"], event_id))
            enrollment = cursor.fetchone()
            if enrollment:
                event["esta_inscrito"] = True
                event["mi_tipo_participacion"] = enrollment.get("tipo_participacion") or "asistente"
                event["mi_detalle_participacion"] = enrollment.get("detalle_participacion")
            cursor.execute("SELECT puntuacion FROM calificaciones WHERE usuario_id = %s AND evento_id = %s", (user["id"], event_id))
            rating = cursor.fetchone()
            if rating:
                event["mi_calificacion"] = rating["puntuacion"]
    return jsonify(event)


@app.get("/api/eventos/<int:event_id>/inscritos")
@admin_requerido
def get_event_enrollments(event_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""SELECT i.id, i.usuario_id, u.nombre, u.email, i.tipo_participacion,
                         i.detalle_participacion, i.fecha_registro
                         FROM inscripciones i JOIN usuarios u ON i.usuario_id = u.id
                         WHERE i.evento_id = %s ORDER BY i.fecha_registro ASC""", (event_id,))
        result = []
        for row in cursor.fetchall():
            item = dict(row)
            item["usuario_nombre"] = item.pop("nombre")
            item["fecha_registro"] = format_date(item["fecha_registro"])
            result.append(item)
    return jsonify(result)


@app.post("/api/eventos")
@admin_requerido
def create_event():
    data, response = validated(validar_evento_crear)
    if response:
        return response
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""INSERT INTO eventos (titulo, descripcion, fecha, ubicacion_id, categoria_id,
                         organizador_id, imagen_url, frase_motivacional, permite_voluntarios, resumen_pasado)
                         VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                       tuple(data[key] for key in ("titulo", "descripcion", "fecha", "ubicacion_id", "categoria_id", "organizador_id", "imagen_url", "frase_motivacional", "permite_voluntarios", "resumen_pasado")))
        event_id = cursor.fetchone()["id"]
    return jsonify({"mensaje": "Evento creado exitosamente", "id": event_id}), 201


@app.put("/api/eventos/<int:event_id>")
@admin_requerido
def update_event(event_id):
    data, response = validated(validar_evento_crear)
    if response:
        return response
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM eventos WHERE id = %s", (event_id,))
        current = cursor.fetchone()
        if not current:
            return error("El evento no existe", 404)
        cursor.execute("""UPDATE eventos SET titulo=%s, descripcion=%s, fecha=%s, ubicacion_id=%s,
                         categoria_id=%s, organizador_id=%s, imagen_url=%s, frase_motivacional=%s,
                         permite_voluntarios=%s, resumen_pasado=%s WHERE id=%s""",
                       tuple(data[key] for key in ("titulo", "descripcion", "fecha", "ubicacion_id", "categoria_id", "organizador_id", "imagen_url", "frase_motivacional", "permite_voluntarios", "resumen_pasado")) + (event_id,))
    return jsonify({"mensaje": "Evento actualizado correctamente"})


@app.delete("/api/eventos/<int:event_id>")
@admin_requerido
def delete_event(event_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM eventos WHERE id = %s", (event_id,))
        if cursor.rowcount == 0:
            return error("El evento no existe", 404)
    return jsonify({"mensaje": "Evento eliminado correctamente"})


@app.post("/api/inscripciones/<int:event_id>")
@login_requerido
def enroll(event_id):
    data, response = validated(validar_inscripcion)
    if response:
        return response
    user = current_user()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, titulo, fecha FROM eventos WHERE id = %s", (event_id,))
        event = cursor.fetchone()
        if not event:
            return error("El evento no existe", 404)
        if datetime.now() >= event["fecha"]:
            return error("La inscripcion cerro porque el evento ya comenzo.")
        cursor.execute("SELECT id FROM inscripciones WHERE usuario_id = %s AND evento_id = %s", (user["id"], event_id))
        if cursor.fetchone():
            return error("Ya estas inscrito en este evento.")
        cursor.execute("INSERT INTO inscripciones (usuario_id, evento_id, fecha_registro, tipo_participacion, detalle_participacion) VALUES (%s, %s, CURRENT_TIMESTAMP, %s, %s)", (user["id"], event_id, data["tipo_participacion"], data["detalle_participacion"]))
    role = "como participante activo / voluntario" if data["tipo_participacion"] == "voluntario_activo" else "como asistente"
    return jsonify({"mensaje": f"Te has inscrito a '{event['titulo']}' {role}."})


@app.delete("/api/inscripciones/<int:event_id>")
@login_requerido
def cancel_enrollment(event_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM inscripciones WHERE usuario_id = %s AND evento_id = %s", (current_user()["id"], event_id))
        if cursor.rowcount == 0:
            return error("No estabas inscrito en este evento.")
    return jsonify({"mensaje": "Inscripcion cancelada."})


@app.get("/api/inscripciones/mis-inscripciones")
@app.get("/api/inscripciones/mis-eventos")
@login_requerido
def my_enrollments():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""SELECT e.id, e.titulo, e.descripcion, e.fecha, e.imagen_url,
                         e.frase_motivacional, e.resumen_pasado, u.nombre AS ubicacion_nombre,
                         c.nombre AS categoria_nombre, o.nombre AS organizador_nombre,
                         i.tipo_participacion, i.detalle_participacion, i.fecha_registro,
                         ROUND(AVG(cal.puntuacion), 1) AS calificacion_promedio
                         FROM inscripciones i JOIN eventos e ON i.evento_id=e.id
                         LEFT JOIN ubicaciones u ON e.ubicacion_id=u.id
                         LEFT JOIN categorias c ON e.categoria_id=c.id
                         LEFT JOIN organizadores o ON e.organizador_id=o.id
                         LEFT JOIN calificaciones cal ON e.id=cal.evento_id
                         WHERE i.usuario_id=%s
                         GROUP BY e.id, u.nombre, c.nombre, o.nombre, i.tipo_participacion,
                                  i.detalle_participacion, i.fecha_registro ORDER BY e.fecha ASC""", (current_user()["id"],))
        result = []
        for row in cursor.fetchall():
            item = serialize_event(row)
            item["fecha_registro"] = format_date(item["fecha_registro"])
            item["esta_inscrito"] = True
            result.append(item)
    return jsonify(result)


@app.post("/api/calificaciones")
@login_requerido
def rate_event():
    data, response = validated(validar_calificacion)
    if response:
        return response
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT fecha FROM eventos WHERE id = %s", (data["evento_id"],))
        event = cursor.fetchone()
        if not event:
            return error("El evento no existe", 404)
        if datetime.now() < event["fecha"] + timedelta(days=1):
            return error("Solo puedes calificar un evento despues de que pase.")
        cursor.execute("""INSERT INTO calificaciones (usuario_id, evento_id, puntuacion) VALUES (%s, %s, %s)
                         ON CONFLICT (usuario_id, evento_id) DO UPDATE SET puntuacion=EXCLUDED.puntuacion""", (current_user()["id"], data["evento_id"], data["puntuacion"]))
    return jsonify({"mensaje": f"Calificaste con {data['puntuacion']} estrellas."})


@app.post("/api/comentarios")
@login_requerido
def add_comment():
    data, response = validated(validar_comentario)
    if response:
        return response
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT fecha FROM eventos WHERE id = %s", (data["evento_id"],))
        event = cursor.fetchone()
        if not event:
            return error("El evento no existe", 404)
        if datetime.now() < event["fecha"] + timedelta(days=1):
            return error("Solo puedes comentar un evento despues de que pase.")
        cursor.execute("INSERT INTO comentarios (usuario_id, evento_id, texto) VALUES (%s, %s, %s) RETURNING id, fecha", (current_user()["id"], data["evento_id"], data["texto"]))
        comment = cursor.fetchone()
    return jsonify({"mensaje": "Comentario publicado.", "comentario": {"id": comment["id"], "texto": data["texto"], "fecha": format_date(comment["fecha"]), "autor_nombre": current_user()["nombre"], "autor_rol": current_user()["rol"]}})


@app.post("/api/sugerencias")
@login_requerido
def create_suggestion():
    data, response = validated(validar_sugerencia)
    if response:
        return response
    with get_db() as conn:
        conn.cursor().execute("INSERT INTO sugerencias (usuario_id, texto) VALUES (%s, %s)", (current_user()["id"], data["texto"]))
    return jsonify({"mensaje": "Sugerencia enviada."})


@app.get("/api/sugerencias")
@admin_requerido
def list_suggestions():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT s.id, s.texto, s.fecha, u.nombre AS autor_nombre, u.email AS autor_email FROM sugerencias s JOIN usuarios u ON s.usuario_id=u.id ORDER BY s.id DESC")
        result = [{**dict(row), "fecha": format_date(row["fecha"])} for row in cursor.fetchall()]
    return jsonify(result)


@app.delete("/api/sugerencias/<int:suggestion_id>")
@admin_requerido
def delete_suggestion(suggestion_id):
    with get_db() as conn:
        conn.cursor().execute("DELETE FROM sugerencias WHERE id = %s", (suggestion_id,))
    return jsonify({"mensaje": "Sugerencia eliminada"})


def catalog_routes(table, label):
    @app.get(f"/api/{table}", endpoint=f"list_{table}")
    def list_catalog():
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(f"SELECT id, nombre FROM {table} ORDER BY nombre ASC")
            return jsonify([dict(row) for row in cursor.fetchall()])

    @app.post(f"/api/{table}", endpoint=f"add_{table}")
    @admin_requerido
    def add_catalog():
        data, response = validated(validar_catalogo)
        if response:
            return response
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(f"INSERT INTO {table} (nombre) VALUES (%s) RETURNING id", (data["nombre"],))
                item_id = cursor.fetchone()["id"]
            return jsonify({"mensaje": f"{label} creado", "id": item_id, "nombre": data["nombre"]}), 201
        except Exception:
            return error(f"Este {label.lower()} ya existe.")

    @app.delete(f"/api/{table}/<int:item_id>", endpoint=f"remove_{table}")
    @admin_requerido
    def remove_catalog(item_id):
        with get_db() as conn:
            conn.cursor().execute(f"DELETE FROM {table} WHERE id = %s", (item_id,))
        return jsonify({"mensaje": f"{label} eliminado"})


catalog_routes("categorias", "Categoria")
catalog_routes("ubicaciones", "Ubicacion")
catalog_routes("organizadores", "Organizador")


@app.get("/api/usuarios")
@admin_requerido
def list_users():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre, email, rol FROM usuarios ORDER BY id ASC")
        return jsonify([dict(row) for row in cursor.fetchall()])


@app.put("/api/usuarios/<int:user_id>/rol")
@admin_requerido
def change_role(user_id):
    data, response = validated(validar_rol)
    if response:
        return response
    with get_db() as conn:
        conn.cursor().execute("UPDATE usuarios SET rol = %s WHERE id = %s", (data["rol"], user_id))
    return jsonify({"mensaje": f"Rol actualizado a '{data['rol']}'"})


@app.delete("/api/usuarios/<int:user_id>")
@admin_requerido
def delete_user(user_id):
    if user_id == current_user()["id"]:
        return error("No puedes eliminar tu propia cuenta.")
    with get_db() as conn:
        conn.cursor().execute("DELETE FROM usuarios WHERE id = %s", (user_id,))
    return jsonify({"mensaje": "Usuario eliminado"})


@app.post("/api/reportes")
@login_requerido
def create_report():
    data, response = validated(validar_reporte)
    if response:
        return response
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO reportes_problemas (usuario_id, evento_id, tipo_problema, descripcion) VALUES (%s, %s, %s, %s) RETURNING id", (current_user()["id"], data["evento_id"], data["tipo_problema"], data["descripcion"]))
        report_id = cursor.fetchone()["id"]
    return jsonify({"mensaje": "Inconveniente reportado correctamente. La coordinacion revisara el caso.", "id": report_id})


@app.get("/api/reportes")
@admin_requerido
def list_reports():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""SELECT r.id, r.tipo_problema, r.descripcion, r.estado, r.fecha,
                         u.nombre AS autor_nombre, u.email AS autor_email, e.titulo AS evento_titulo
                         FROM reportes_problemas r JOIN usuarios u ON r.usuario_id=u.id
                         LEFT JOIN eventos e ON r.evento_id=e.id ORDER BY r.id DESC""")
        result = [{**dict(row), "fecha": format_date(row["fecha"])} for row in cursor.fetchall()]
    return jsonify(result)


@app.put("/api/reportes/<int:report_id>/estado")
@admin_requerido
def change_report_status(report_id):
    data, response = validated(validar_reporte_estado)
    if response:
        return response
    with get_db() as conn:
        conn.cursor().execute("UPDATE reportes_problemas SET estado=%s WHERE id=%s", (data["estado"], report_id))
    return jsonify({"mensaje": f"Estado cambiado a '{data['estado']}'"})


@app.post("/api/encuestas")
@admin_requerido
def create_survey():
    data, response = validated(validar_encuesta)
    if response:
        return response
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""INSERT INTO encuestas (evento_id, titulo, pregunta_1, opciones_1, pregunta_2,
                         opciones_2, pregunta_abierta) VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id""", tuple(data[key] for key in ("evento_id", "titulo", "pregunta_1", "opciones_1", "pregunta_2", "opciones_2", "pregunta_abierta")))
        survey_id = cursor.fetchone()["id"]
    return jsonify({"mensaje": "Encuesta escolar publicada", "id": survey_id})


@app.get("/api/encuestas/evento/<int:event_id>")
@usuario_opcional
def get_survey(event_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM encuestas WHERE evento_id=%s AND activa=true ORDER BY id DESC LIMIT 1", (event_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"tiene_encuesta": False})
        survey = dict(row)
        survey["fecha_creacion"] = format_date(survey["fecha_creacion"])
        survey["tiene_encuesta"] = True
        survey["ya_respondio"] = False
        if current_user():
            cursor.execute("SELECT id FROM respuestas_encuestas WHERE encuesta_id=%s AND usuario_id=%s", (survey["id"], current_user()["id"]))
            survey["ya_respondio"] = cursor.fetchone() is not None
    return jsonify(survey)


@app.post("/api/encuestas/<int:survey_id>/responder")
@login_requerido
def answer_survey(survey_id):
    data, response = validated(validar_respuesta_encuesta)
    if response:
        return response
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM encuestas WHERE id=%s AND activa=true", (survey_id,))
        if not cursor.fetchone():
            return error("La encuesta no existe o ya no esta activa", 404)
        cursor.execute("SELECT id FROM respuestas_encuestas WHERE encuesta_id=%s AND usuario_id=%s", (survey_id, current_user()["id"]))
        if cursor.fetchone():
            return error("Ya respondiste esta encuesta.")
        cursor.execute("INSERT INTO respuestas_encuestas (encuesta_id, usuario_id, respuesta_1, respuesta_2, respuesta_abierta) VALUES (%s,%s,%s,%s,%s)", (survey_id, current_user()["id"], data["respuesta_1"], data["respuesta_2"], data["respuesta_abierta"]))
    return jsonify({"mensaje": "Muchas gracias! Tus respuestas ayudaran a mejorar los eventos del colegio."})


@app.get("/api/encuestas/<int:survey_id>/resultados")
@admin_requerido
def survey_results(survey_id):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM encuestas WHERE id=%s", (survey_id,))
        survey = cursor.fetchone()
        if not survey:
            return error("Encuesta no encontrada", 404)
        cursor.execute("""SELECT r.id, r.respuesta_1, r.respuesta_2, r.respuesta_abierta,
                         r.fecha, u.nombre AS autor_nombre FROM respuestas_encuestas r
                         JOIN usuarios u ON r.usuario_id=u.id WHERE r.encuesta_id=%s ORDER BY r.fecha DESC""", (survey_id,))
        answers = [{**dict(row), "fecha": format_date(row["fecha"])} for row in cursor.fetchall()]
    return jsonify({"encuesta": dict(survey), "total_respuestas": len(answers), "respuestas": answers})


@app.get("/api/stats")
@admin_requerido
def stats():
    with get_db() as conn:
        cursor = conn.cursor()
        values = {}
        for key, table, where in (("total_eventos", "eventos", ""), ("total_estudiantes", "usuarios", " WHERE rol='estudiante'"), ("total_inscripciones", "inscripciones", ""), ("total_sugerencias", "sugerencias", ""), ("total_problemas", "reportes_problemas", ""), ("total_encuestas", "encuestas", "")):
            cursor.execute(f"SELECT COUNT(*) AS total FROM {table}{where}")
            values[key] = cursor.fetchone()["total"]
    return jsonify(values)


@app.get("/")
def serve_index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.get("/login")
def serve_login():
    return send_from_directory(FRONTEND_DIR, "login.html")


@app.get("/register")
def serve_register():
    return send_from_directory(FRONTEND_DIR, "register.html")


@app.get("/dashboard")
def serve_dashboard():
    return send_from_directory(FRONTEND_DIR, "dashboard.html")


@app.get("/admin")
def serve_admin():
    return send_from_directory(FRONTEND_DIR, "admin.html")


@app.get("/<path:page>")
def serve_frontend(page):
    allowed = {"login.html", "register.html", "dashboard.html", "admin.html"}
    if page in allowed:
        return send_from_directory(FRONTEND_DIR, page)
    return send_from_directory(FRONTEND_DIR, page)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8000")), debug=True)

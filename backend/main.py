import os
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.database import get_db, init_db, hash_password
from backend.auth import (
    verify_password,
    create_access_token,
    get_current_user,
    get_optional_current_user,
    require_admin
)
from backend.models import (
    UserRegister,
    UserLogin,
    UserUpdateRole,
    EventCreate,
    EventUpdate,
    RatingCreate,
    CommentCreate,
    SuggestionCreate,
    CatalogCreate
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(
    title="Portal de Eventos IDETH",
    description="API para la gestion de eventos escolares",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- 1. Autenticacion -----------------
@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register(user_data: UserRegister):
    """Registra un nuevo usuario y le da un token.

    Explicación simple: guarda el nombre, email y contraseña (en forma segura),
    y devuelve un "boleto" (token) para que no tenga que iniciar sesión otra vez.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM usuarios WHERE email = ?", (user_data.email.lower().strip(),))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe una cuenta con este correo."
            )

        hashed_pwd = hash_password(user_data.password)
        cursor.execute(
            "INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, 'estudiante')",
            (user_data.nombre.strip(), user_data.email.lower().strip(), hashed_pwd)
        )
        user_id = cursor.lastrowid

    token = create_access_token({"sub": user_id, "rol": "estudiante"})
    return {
        "mensaje": "Registro exitoso.",
        "token": token,
        "usuario": {
            "id": user_id,
            "nombre": user_data.nombre.strip(),
            "email": user_data.email.lower().strip(),
            "rol": "estudiante"
        }
    }

@app.post("/api/auth/login")
def login(credentials: UserLogin):
    """Inicia sesión y devuelve token si las credenciales son correctas.

    Explicación simple: si el correo y la contraseña están bien, el servidor
    devuelve un token que representa la sesión del usuario.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, nombre, email, password_hash, rol FROM usuarios WHERE email = ?",
            (credentials.email.lower().strip(),)
        )
        user = cursor.fetchone()

    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contrasena incorrectos."
        )

    token = create_access_token({"sub": user["id"], "rol": user["rol"]})
    return {
        "mensaje": f"Bienvenido, {user['nombre']}",
        "token": token,
        "usuario": {
            "id": user["id"],
            "nombre": user["nombre"],
            "email": user["email"],
            "rol": user["rol"]
        }
    }

@app.get("/api/auth/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# ----------------- 2. Eventos -----------------

@app.get("/api/eventos")
def get_eventos(
    tipo: str = Query("todos", regex="^(todos|proximos|pasados)$"),
    categoria_id: int = Query(None),
    current_user: dict = Depends(get_optional_current_user)
):
    """Devuelve la lista de eventos. Permite filtrar por tipo o categoria.

    Explicación simple: esta ruta muestra todos los eventos, o solo los
    próximos o los pasados. También añade información como cuántos están
    inscritos y la calificación promedio.
    """
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    query = """
    SELECT 
        e.id, e.titulo, e.descripcion, e.fecha,
        e.ubicacion_id, u.nombre AS ubicacion_nombre,
        e.categoria_id, c.nombre AS categoria_nombre,
        e.organizador_id, o.nombre AS organizador_nombre,
        COUNT(DISTINCT i.id) AS total_inscritos,
        ROUND(AVG(cal.puntuacion), 1) AS calificacion_promedio,
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

    if tipo == "proximos":
        query += " AND e.fecha >= ?"
        params.append(now_str)
    elif tipo == "pasados":
        query += " AND e.fecha < ?"
        params.append(now_str)

    if categoria_id:
        query += " AND e.categoria_id = ?"
        params.append(categoria_id)

    query += " GROUP BY e.id ORDER BY e.fecha ASC"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()

        mis_inscripciones = set()
        if current_user:
            cursor.execute("SELECT evento_id FROM inscripciones WHERE usuario_id = ?", (current_user["id"],))
            mis_inscripciones = {r["evento_id"] for r in cursor.fetchall()}

    eventos = []
    for r in rows:
        item = dict(r)
        item["esta_inscrito"] = item["id"] in mis_inscripciones
        item["es_pasado"] = item["fecha"] < now_str
        eventos.append(item)

    return eventos

@app.get("/api/eventos/{evento_id}")
def get_evento_detalle(evento_id: int, current_user: dict = Depends(get_optional_current_user)):
    """Devuelve información completa de un evento, incluyendo comentarios.

    Explicación simple: muestra los detalles del evento y los comentarios de
    otros estudiantes. Si estás logeado, indica si ya te inscribiste.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT 
            e.id, e.titulo, e.descripcion, e.fecha,
            e.ubicacion_id, u.nombre AS ubicacion_nombre,
            e.categoria_id, c.nombre AS categoria_nombre,
            e.organizador_id, o.nombre AS organizador_nombre,
            COUNT(DISTINCT i.id) AS total_inscritos,
            ROUND(AVG(cal.puntuacion), 1) AS calificacion_promedio,
            COUNT(DISTINCT cal.id) AS total_calificaciones
        FROM eventos e
        LEFT JOIN ubicaciones u ON e.ubicacion_id = u.id
        LEFT JOIN categorias c ON e.categoria_id = c.id
        LEFT JOIN organizadores o ON e.organizador_id = o.id
        LEFT JOIN inscripciones i ON e.id = i.evento_id
        LEFT JOIN calificaciones cal ON e.id = cal.evento_id
        WHERE e.id = ?
        GROUP BY e.id
        """, (evento_id,))
        evento = cursor.fetchone()

        if not evento:
            raise HTTPException(status_code=404, detail="Evento no encontrado")

        evento_dict = dict(evento)
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        evento_dict["es_pasado"] = evento_dict["fecha"] < now_str

        cursor.execute("""
        SELECT c.id, c.texto, c.fecha, u.nombre AS autor_nombre, u.rol AS autor_rol
        FROM comentarios c
        JOIN usuarios u ON c.usuario_id = u.id
        WHERE c.evento_id = ?
        ORDER BY c.id DESC
        """, (evento_id,))
        evento_dict["comentarios"] = [dict(c) for c in cursor.fetchall()]

        evento_dict["esta_inscrito"] = False
        evento_dict["mi_calificacion"] = None

        if current_user:
            cursor.execute("SELECT id FROM inscripciones WHERE usuario_id = ? AND evento_id = ?", (current_user["id"], evento_id))
            evento_dict["esta_inscrito"] = cursor.fetchone() is not None

            cursor.execute("SELECT puntuacion FROM calificaciones WHERE usuario_id = ? AND evento_id = ?", (current_user["id"], evento_id))
            cal = cursor.fetchone()
            if cal:
                evento_dict["mi_calificacion"] = cal["puntuacion"]

    return evento_dict

@app.post("/api/eventos", status_code=status.HTTP_201_CREATED)
def create_evento(evento_data: EventCreate, admin_user: dict = Depends(require_admin)):
    """Crea un nuevo evento (solo administradores).

    Explicación simple: los profesores pueden agregar eventos con título,
    descripción, fecha y lugar. Devuelve el id del nuevo evento.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO eventos (titulo, descripcion, fecha, ubicacion_id, categoria_id, organizador_id)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (
            evento_data.titulo.strip(),
            evento_data.descripcion.strip() if evento_data.descripcion else "",
            evento_data.fecha.strip(),
            evento_data.ubicacion_id,
            evento_data.categoria_id,
            evento_data.organizador_id
        ))
        new_id = cursor.lastrowid

    return {"mensaje": "Evento creado exitosamente", "id": new_id}

@app.put("/api/eventos/{evento_id}")
def update_evento(evento_id: int, evento_data: EventUpdate, admin_user: dict = Depends(require_admin)):
    """Actualiza un evento existente (solo administradores).

    Explicación simple: permite cambiar los datos del evento. Si el evento
    ya habia pasado y se cambia la fecha a una futura, se borran comentarios
    y calificaciones antiguas para evitar confusión.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, fecha FROM eventos WHERE id = ?", (evento_id,))
        eventoViejo = cursor.fetchone()
        if not eventoViejo:
            raise HTTPException(status_code=404, detail="El evento no existe")

        eraPasado = eventoViejo["fecha"] < datetime.now().strftime("%Y-%m-%d %H:%M")

        cursor.execute("""
        UPDATE eventos
        SET titulo = COALESCE(?, titulo),
            descripcion = COALESCE(?, descripcion),
            fecha = COALESCE(?, fecha),
            ubicacion_id = COALESCE(?, ubicacion_id),
            categoria_id = COALESCE(?, categoria_id),
            organizador_id = COALESCE(?, organizador_id)
        WHERE id = ?
        """, (
            evento_data.titulo,
            evento_data.descripcion,
            evento_data.fecha,
            evento_data.ubicacion_id,
            evento_data.categoria_id,
            evento_data.organizador_id,
            evento_id
        ))

        if evento_data.fecha and eraPasado:
            ahora = datetime.now().strftime("%Y-%m-%d %H:%M")
            if ahora < evento_data.fecha:
                cursor.execute("DELETE FROM comentarios WHERE evento_id = ?", (evento_id,))
                cursor.execute("DELETE FROM calificaciones WHERE evento_id = ?", (evento_id,))

    return {"mensaje": "Evento actualizado correctamente"}

@app.delete("/api/eventos/{evento_id}")
def delete_evento(evento_id: int, admin_user: dict = Depends(require_admin)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM eventos WHERE id = ?", (evento_id,))
        deleted = cursor.rowcount > 0

    if not deleted:
        raise HTTPException(status_code=404, detail="El evento no existe")
    return {"mensaje": "Evento eliminado correctamente"}

# ----------------- 3. Inscripciones -----------------

@app.post("/api/inscripciones/{evento_id}")
def inscribirse_a_evento(evento_id: int, current_user: dict = Depends(get_current_user)):
    """Inscribe al estudiante en un evento.

    Explicación simple: marca que el estudiante asistirá. Si ya está
    inscrito, devuelve un mensaje indicando eso.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, titulo FROM eventos WHERE id = ?", (evento_id,))
        evento = cursor.fetchone()
        if not evento:
            raise HTTPException(status_code=404, detail="El evento no existe")

        cursor.execute("SELECT id FROM inscripciones WHERE usuario_id = ? AND evento_id = ?", (current_user["id"], evento_id))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Ya estas inscrito en este evento.")

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        cursor.execute(
            "INSERT INTO inscripciones (usuario_id, evento_id, fecha_registro) VALUES (?, ?, ?)",
            (current_user["id"], evento_id, now_str)
        )

    return {"mensaje": f"Te has inscrito a '{evento['titulo']}'."}

@app.delete("/api/inscripciones/{evento_id}")
def cancelar_inscripcion(evento_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM inscripciones WHERE usuario_id = ? AND evento_id = ?",
            (current_user["id"], evento_id)
        )
        deleted = cursor.rowcount > 0

    if not deleted:
        raise HTTPException(status_code=400, detail="No estabas inscrito en este evento.")

    return {"mensaje": "Inscripcion cancelada."}

@app.get("/api/inscripciones/mis-eventos")
def get_mis_inscripciones(current_user: dict = Depends(get_current_user)):
    """Devuelve los eventos en los que está inscrito el usuario.

    Explicación simple: lista las inscripciones del estudiante con datos
    útiles como fecha, lugar y calificación promedio.
    """
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT 
            e.id, e.titulo, e.descripcion, e.fecha,
            u.nombre AS ubicacion_nombre,
            c.nombre AS categoria_nombre,
            o.nombre AS organizador_nombre,
            i.fecha_registro,
            ROUND(AVG(cal.puntuacion), 1) AS calificacion_promedio
        FROM inscripciones i
        JOIN eventos e ON i.evento_id = e.id
        LEFT JOIN ubicaciones u ON e.ubicacion_id = u.id
        LEFT JOIN categorias c ON e.categoria_id = c.id
        LEFT JOIN organizadores o ON e.organizador_id = o.id
        LEFT JOIN calificaciones cal ON e.id = cal.evento_id
        WHERE i.usuario_id = ?
        GROUP BY e.id
        ORDER BY e.fecha ASC
        """, (current_user["id"],))
        rows = cursor.fetchall()

    mis_eventos = []
    for r in rows:
        item = dict(r)
        item["esta_inscrito"] = True
        item["es_pasado"] = item["fecha"] < now_str
        mis_eventos.append(item)

    return mis_eventos

# ----------------- 4. Calificaciones y Comentarios -----------------

@app.post("/api/calificaciones")
def calificar_evento(rating_data: RatingCreate, current_user: dict = Depends(get_current_user)):
    """Permite que un estudiante califique un evento que ya pasó.

    Explicación simple: solo se puede calificar después de que el evento
    termine (para evitar calificar antes de asistir).
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, fecha FROM eventos WHERE id = ?", (rating_data.evento_id,))
        evento = cursor.fetchone()
        if not evento:
            raise HTTPException(status_code=404, detail="El evento no existe")

        ahora = datetime.now()
        fechaEvento = datetime.strptime(evento["fecha"], "%Y-%m-%d %H:%M")
        if ahora < fechaEvento + timedelta(days=1):
            raise HTTPException(status_code=400, detail="Solo puedes calificar un evento despues de que pase.")

        cursor.execute("""
        INSERT INTO calificaciones (usuario_id, evento_id, puntuacion)
        VALUES (?, ?, ?)
        ON CONFLICT(usuario_id, evento_id) DO UPDATE SET puntuacion = excluded.puntuacion
        """, (current_user["id"], rating_data.evento_id, rating_data.puntuacion))

    return {"mensaje": f"Calificaste con {rating_data.puntuacion} estrellas."}

@app.post("/api/comentarios")
def agregar_comentario(comment_data: CommentCreate, current_user: dict = Depends(get_current_user)):
    """Agrega un comentario a un evento (solo después de que pase).

    Explicación simple: los estudiantes pueden dejar su opinión o experiencia
    sobre un evento ya realizado.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, fecha FROM eventos WHERE id = ?", (comment_data.evento_id,))
        evento = cursor.fetchone()
        if not evento:
            raise HTTPException(status_code=404, detail="El evento no existe")

        ahora = datetime.now()
        fechaEvento = datetime.strptime(evento["fecha"], "%Y-%m-%d %H:%M")
        if ahora < fechaEvento + timedelta(days=1):
            raise HTTPException(status_code=400, detail="Solo puedes comentar un evento despues de que pase.")

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        cursor.execute(
            "INSERT INTO comentarios (usuario_id, evento_id, texto, fecha) VALUES (?, ?, ?, ?)",
            (current_user["id"], comment_data.evento_id, comment_data.texto.strip(), now_str)
        )
        comment_id = cursor.lastrowid

    return {
        "mensaje": "Comentario publicado.",
        "comentario": {
            "id": comment_id,
            "texto": comment_data.texto.strip(),
            "fecha": now_str,
            "autor_nombre": current_user["nombre"],
            "autor_rol": current_user["rol"]
        }
    }

# ----------------- 5. Sugerencias -----------------

@app.post("/api/sugerencias")
def crear_sugerencia(sug_data: SuggestionCreate, current_user: dict = Depends(get_current_user)):
    # Envia una sugerencia al sistema (visible para administradores)
    # Explicación simple: permite a los estudiantes escribir ideas o quejas
    # que verán los profesores.
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO sugerencias (usuario_id, texto, fecha) VALUES (?, ?, ?)",
            (current_user["id"], sug_data.texto.strip(), now_str)
        )

    return {"mensaje": "Sugerencia enviada."}

@app.get("/api/sugerencias")
def get_sugerencias(admin_user: dict = Depends(require_admin)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT s.id, s.texto, s.fecha, u.nombre AS autor_nombre, u.email AS autor_email
        FROM sugerencias s
        JOIN usuarios u ON s.usuario_id = u.id
        ORDER BY s.id DESC
        """)
        sugerencias = [dict(r) for r in cursor.fetchall()]

    return sugerencias

@app.delete("/api/sugerencias/{sug_id}")
def delete_sugerencia(sug_id: int, admin_user: dict = Depends(require_admin)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sugerencias WHERE id = ?", (sug_id,))

    return {"mensaje": "Sugerencia eliminada"}

# ----------------- 6. Catalogos -----------------

# Categorias
@app.get("/api/categorias")
def get_categorias():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre FROM categorias ORDER BY nombre ASC")
        return [dict(r) for r in cursor.fetchall()]

@app.post("/api/categorias", status_code=201)
def create_categoria(data: CatalogCreate, admin_user: dict = Depends(require_admin)):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO categorias (nombre) VALUES (?)", (data.nombre.strip(),))
            new_id = cursor.lastrowid
        return {"mensaje": "Categoria creada", "id": new_id, "nombre": data.nombre.strip()}
    except Exception:
        raise HTTPException(status_code=400, detail="Esta categoria ya existe.")

@app.delete("/api/categorias/{cat_id}")
def delete_categoria(cat_id: int, admin_user: dict = Depends(require_admin)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM categorias WHERE id = ?", (cat_id,))
    return {"mensaje": "Categoria eliminada"}

# Ubicaciones
@app.get("/api/ubicaciones")
def get_ubicaciones():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre FROM ubicaciones ORDER BY nombre ASC")
        return [dict(r) for r in cursor.fetchall()]

@app.post("/api/ubicaciones", status_code=201)
def create_ubicacion(data: CatalogCreate, admin_user: dict = Depends(require_admin)):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO ubicaciones (nombre) VALUES (?)", (data.nombre.strip(),))
            new_id = cursor.lastrowid
        return {"mensaje": "Ubicacion creada", "id": new_id, "nombre": data.nombre.strip()}
    except Exception:
        raise HTTPException(status_code=400, detail="Esta ubicacion ya existe.")

@app.delete("/api/ubicaciones/{ub_id}")
def delete_ubicacion(ub_id: int, admin_user: dict = Depends(require_admin)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM ubicaciones WHERE id = ?", (ub_id,))
    return {"mensaje": "Ubicacion eliminada"}

# Organizadores
@app.get("/api/organizadores")
def get_organizadores():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre FROM organizadores ORDER BY nombre ASC")
        return [dict(r) for r in cursor.fetchall()]

@app.post("/api/organizadores", status_code=201)
def create_organizador(data: CatalogCreate, admin_user: dict = Depends(require_admin)):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO organizadores (nombre) VALUES (?)", (data.nombre.strip(),))
            new_id = cursor.lastrowid
        return {"mensaje": "Organizador creado", "id": new_id, "nombre": data.nombre.strip()}
    except Exception:
        raise HTTPException(status_code=400, detail="Este organizador ya existe.")

@app.delete("/api/organizadores/{org_id}")
def delete_organizador(org_id: int, admin_user: dict = Depends(require_admin)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM organizadores WHERE id = ?", (org_id,))
    return {"mensaje": "Organizador eliminado"}

# ----------------- 7. Usuarios -----------------

@app.get("/api/usuarios")
def get_usuarios(admin_user: dict = Depends(require_admin)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre, email, rol FROM usuarios ORDER BY id ASC")
        return [dict(r) for r in cursor.fetchall()]

@app.put("/api/usuarios/{usuario_id}/rol")
def update_user_rol(usuario_id: int, role_data: UserUpdateRole, admin_user: dict = Depends(require_admin)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE usuarios SET rol = ? WHERE id = ?", (role_data.rol, usuario_id))
    return {"mensaje": f"Rol actualizado a '{role_data.rol}'"}

@app.delete("/api/usuarios/{usuario_id}")
def delete_usuario(usuario_id: int, admin_user: dict = Depends(require_admin)):
    if usuario_id == admin_user["id"]:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta.")
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM usuarios WHERE id = ?", (usuario_id,))
    return {"mensaje": "Usuario eliminado"}

# ----------------- 8. Estadisticas -----------------

@app.get("/api/stats")
def get_dashboard_stats(admin_user: dict = Depends(require_admin)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM eventos")
        total_eventos = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM usuarios WHERE rol = 'estudiante'")
        total_estudiantes = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM inscripciones")
        total_inscripciones = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM sugerencias")
        total_sugerencias = cursor.fetchone()[0]

    return {
        "total_eventos": total_eventos,
        "total_estudiantes": total_estudiantes,
        "total_inscripciones": total_inscripciones,
        "total_sugerencias": total_sugerencias
    }

# ----------------- 9. Servir Frontend -----------------

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")

if os.path.exists(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

    @app.get("/")
    def serve_index():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

    @app.get("/login")
    def serve_login():
        return FileResponse(os.path.join(FRONTEND_DIR, "login.html"))

    @app.get("/register")
    def serve_register():
        return FileResponse(os.path.join(FRONTEND_DIR, "register.html"))

    @app.get("/dashboard")
    def serve_dashboard():
        return FileResponse(os.path.join(FRONTEND_DIR, "dashboard.html"))

    @app.get("/admin")
    def serve_admin():
        return FileResponse(os.path.join(FRONTEND_DIR, "admin.html"))

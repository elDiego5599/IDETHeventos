import os
from datetime import datetime
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

app = FastAPI(
    title="Portal de Eventos IDETH",
    description="API para la gestión y participación en eventos escolares de bachillerato",
    version="1.0.0"
)

# Permitir CORS para desarrollo local fluido
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializar base de datos al arrancar
@app.on_event("startup")
def on_startup():
    init_db()

# =====================================================================
# 1. AUTENTICACIÓN Y USUARIOS
# =====================================================================

@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register(user_data: UserRegister):
    """
    Registra un nuevo usuario en la plataforma.
    Por defecto, todo nuevo registro tiene el rol de 'estudiante'.
    """
    conn = get_db()
    cursor = conn.cursor()

    # Verificar si el correo ya existe
    cursor.execute("SELECT id FROM usuarios WHERE email = ?", (user_data.email.lower().strip(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe una cuenta registrada con este correo electrónico."
        )

    # Hashear contraseña e insertar con rol 'estudiante'
    hashed_pwd = hash_password(user_data.password)
    cursor.execute(
        "INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, 'estudiante')",
        (user_data.nombre.strip(), user_data.email.lower().strip(), hashed_pwd)
    )
    conn.commit()
    user_id = cursor.lastrowid
    conn.close()

    # Generar token JWT automático para iniciar sesión directamente
    token = create_access_token({"sub": user_id, "rol": "estudiante"})

    return {
        "mensaje": "¡Registro exitoso! Bienvenido a IDETHeventos.",
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
    """
    Inicia sesión con correo y contraseña. Retorna token JWT y rol.
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, nombre, email, password_hash, rol FROM usuarios WHERE email = ?",
        (credentials.email.lower().strip(),)
    )
    user = cursor.fetchone()
    conn.close()

    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos."
        )

    token = create_access_token({"sub": user["id"], "rol": user["rol"]})

    return {
        "mensaje": f"¡Bienvenido de nuevo, {user['nombre']}!",
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
    """Retorna los datos del usuario logueado."""
    return current_user

# =====================================================================
# 2. GESTIÓN DE EVENTOS
# =====================================================================

@app.get("/api/eventos")
def get_eventos(
    tipo: str = Query("todos", regex="^(todos|proximos|pasados)$"),
    categoria_id: int = Query(None),
    current_user: dict = Depends(get_optional_current_user)
):
    """
    Lista los eventos del colegio.
    Permite filtrar por 'proximos', 'pasados' o por categoría.
    Incluye si el estudiante logueado está inscrito y el promedio de estrellas.
    """
    conn = get_db()
    cursor = conn.cursor()

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

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
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
    cursor.execute(query, params)
    rows = cursor.fetchall()

    # Si hay usuario logueado, consultar sus inscripciones activas
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

    conn.close()
    return eventos

@app.get("/api/eventos/{evento_id}")
def get_evento_detalle(evento_id: int, current_user: dict = Depends(get_optional_current_user)):
    """
    Retorna toda la información detallada de un evento,
    sus comentarios, promedio de calificaciones y estado del usuario.
    """
    conn = get_db()
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
        conn.close()
        raise HTTPException(status_code=404, detail="Evento no encontrado")

    evento_dict = dict(evento)
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    evento_dict["es_pasado"] = evento_dict["fecha"] < now_str

    # Obtener comentarios del evento
    cursor.execute("""
    SELECT c.id, c.texto, c.fecha, u.nombre AS autor_nombre, u.rol AS autor_rol
    FROM comentarios c
    JOIN usuarios u ON c.usuario_id = u.id
    WHERE c.evento_id = ?
    ORDER BY c.id DESC
    """, (evento_id,))
    evento_dict["comentarios"] = [dict(c) for c in cursor.fetchall()]

    # Si hay usuario logueado, consultar si está inscrito y qué calificación dejó
    evento_dict["esta_inscrito"] = False
    evento_dict["mi_calificacion"] = None

    if current_user:
        cursor.execute("SELECT id FROM inscripciones WHERE usuario_id = ? AND evento_id = ?", (current_user["id"], evento_id))
        evento_dict["esta_inscrito"] = cursor.fetchone() is not None

        cursor.execute("SELECT puntuacion FROM calificaciones WHERE usuario_id = ? AND evento_id = ?", (current_user["id"], evento_id))
        cal = cursor.fetchone()
        if cal:
            evento_dict["mi_calificacion"] = cal["puntuacion"]

    conn.close()
    return evento_dict

@app.post("/api/eventos", status_code=status.HTTP_201_CREATED)
def create_evento(evento_data: EventCreate, admin_user: dict = Depends(require_admin)):
    """Crea un nuevo evento (Solo para administradores)."""
    conn = get_db()
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
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()

    return {"mensaje": "Evento creado exitosamente", "id": new_id}

@app.put("/api/eventos/{evento_id}")
def update_evento(evento_id: int, evento_data: EventUpdate, admin_user: dict = Depends(require_admin)):
    """Actualiza la información de un evento existente (Solo Administradores)."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM eventos WHERE id = ?", (evento_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="El evento no existe")

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
    conn.commit()
    conn.close()
    return {"mensaje": "Evento actualizado correctamente"}

@app.delete("/api/eventos/{evento_id}")
def delete_evento(evento_id: int, admin_user: dict = Depends(require_admin)):
    """Elimina un evento y sus inscripciones/comentarios asociados (Solo Administradores)."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM eventos WHERE id = ?", (evento_id,))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()

    if not deleted:
        raise HTTPException(status_code=404, detail="El evento no existe")
    return {"mensaje": "Evento eliminado correctamente"}

# =====================================================================
# 3. INSCRIPCIONES (ESTUDIANTES)
# =====================================================================

@app.post("/api/inscripciones/{evento_id}")
def inscribirse_a_evento(evento_id: int, current_user: dict = Depends(get_current_user)):
    """Inscribe al estudiante logueado en el evento seleccionado."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, titulo, fecha FROM eventos WHERE id = ?", (evento_id,))
    evento = cursor.fetchone()
    if not evento:
        conn.close()
        raise HTTPException(status_code=404, detail="El evento no existe")

    # Verificar si ya está inscrito
    cursor.execute("SELECT id FROM inscripciones WHERE usuario_id = ? AND evento_id = ?", (current_user["id"], evento_id))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Ya estás inscrito en este evento.")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    cursor.execute(
        "INSERT INTO inscripciones (usuario_id, evento_id, fecha_registro) VALUES (?, ?, ?)",
        (current_user["id"], evento_id, now_str)
    )
    conn.commit()
    conn.close()

    return {"mensaje": f"¡Te has inscrito con éxito a '{evento['titulo']}'!"}

@app.delete("/api/inscripciones/{evento_id}")
def cancelar_inscripcion(evento_id: int, current_user: dict = Depends(get_current_user)):
    """Cancela la inscripción del estudiante a un evento."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "DELETE FROM inscripciones WHERE usuario_id = ? AND evento_id = ?",
        (current_user["id"], evento_id)
    )
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()

    if not deleted:
        raise HTTPException(status_code=400, detail="No estabas inscrito en este evento.")

    return {"mensaje": "Inscripción cancelada exitosamente."}

@app.get("/api/inscripciones/mis-eventos")
def get_mis_inscripciones(current_user: dict = Depends(get_current_user)):
    """Lista todos los eventos en los que el estudiante logueado está inscrito."""
    conn = get_db()
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
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    mis_eventos = []
    for r in rows:
        item = dict(r)
        item["esta_inscrito"] = True
        item["es_pasado"] = item["fecha"] < now_str
        mis_eventos.append(item)

    conn.close()
    return mis_eventos

# =====================================================================
# 4. CALIFICACIONES Y COMENTARIOS
# =====================================================================

@app.post("/api/calificaciones")
def calificar_evento(rating_data: RatingCreate, current_user: dict = Depends(get_current_user)):
    """Permite al estudiante calificar un evento de 1 a 5 estrellas."""
    conn = get_db()
    cursor = conn.cursor()

    # Verificar que el evento exista
    cursor.execute("SELECT id FROM eventos WHERE id = ?", (rating_data.evento_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="El evento no existe")

    # Insertar o actualizar calificación
    cursor.execute("""
    INSERT INTO calificaciones (usuario_id, evento_id, puntuacion)
    VALUES (?, ?, ?)
    ON CONFLICT(usuario_id, evento_id) DO UPDATE SET puntuacion = excluded.puntuacion
    """, (current_user["id"], rating_data.evento_id, rating_data.puntuacion))
    
    conn.commit()
    conn.close()

    return {"mensaje": f"¡Gracias por calificar con {rating_data.puntuacion} estrellas!"}

@app.post("/api/comentarios")
def agregar_comentario(comment_data: CommentCreate, current_user: dict = Depends(get_current_user)):
    """Permite al estudiante dejar un comentario sobre su experiencia en el evento."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM eventos WHERE id = ?", (comment_data.evento_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="El evento no existe")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    cursor.execute(
        "INSERT INTO comentarios (usuario_id, evento_id, texto, fecha) VALUES (?, ?, ?, ?)",
        (current_user["id"], comment_data.evento_id, comment_data.texto.strip(), now_str)
    )
    conn.commit()
    comment_id = cursor.lastrowid
    conn.close()

    return {
        "mensaje": "Comentario publicado exitosamente.",
        "comentario": {
            "id": comment_id,
            "texto": comment_data.texto.strip(),
            "fecha": now_str,
            "autor_nombre": current_user["nombre"],
            "autor_rol": current_user["rol"]
        }
    }

# =====================================================================
# 5. BUZÓN DE SUGERENCIAS
# =====================================================================

@app.post("/api/sugerencias")
def crear_sugerencia(sug_data: SuggestionCreate, current_user: dict = Depends(get_current_user)):
    """Permite a cualquier estudiante enviar una sugerencia al colegio."""
    conn = get_db()
    cursor = conn.cursor()

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    cursor.execute(
        "INSERT INTO sugerencias (usuario_id, texto, fecha) VALUES (?, ?, ?)",
        (current_user["id"], sug_data.texto.strip(), now_str)
    )
    conn.commit()
    conn.close()

    return {"mensaje": "¡Muchas gracias! Tu sugerencia ha sido enviada a las directivas del colegio."}

@app.get("/api/sugerencias")
def get_sugerencias(admin_user: dict = Depends(require_admin)):
    """Lista todas las sugerencias recibidas (Solo para Administradores)."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT s.id, s.texto, s.fecha, u.nombre AS autor_nombre, u.email AS autor_email
    FROM sugerencias s
    JOIN usuarios u ON s.usuario_id = u.id
    ORDER BY s.id DESC
    """)
    sugerencias = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return sugerencias

@app.delete("/api/sugerencias/{sug_id}")
def delete_sugerencia(sug_id: int, admin_user: dict = Depends(require_admin)):
    """Elimina una sugerencia atendida (Solo Administradores)."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sugerencias WHERE id = ?", (sug_id,))
    conn.commit()
    conn.close()
    return {"mensaje": "Sugerencia eliminada"}

# =====================================================================
# 6. CATÁLOGOS (CATEGORÍAS, UBICACIONES, ORGANIZADORES)
# =====================================================================

# --- Categorías ---
@app.get("/api/categorias")
def get_categorias():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, nombre FROM categorias ORDER BY nombre ASC")
    items = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return items

@app.post("/api/categorias", status_code=201)
def create_categoria(data: CatalogCreate, admin_user: dict = Depends(require_admin)):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO categorias (nombre) VALUES (?)", (data.nombre.strip(),))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        return {"mensaje": "Categoría creada", "id": new_id, "nombre": data.nombre.strip()}
    except Exception:
        conn.close()
        raise HTTPException(status_code=400, detail="Esta categoría ya existe.")

@app.delete("/api/categorias/{cat_id}")
def delete_categoria(cat_id: int, admin_user: dict = Depends(require_admin)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM categorias WHERE id = ?", (cat_id,))
    conn.commit()
    conn.close()
    return {"mensaje": "Categoría eliminada"}

# --- Ubicaciones ---
@app.get("/api/ubicaciones")
def get_ubicaciones():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, nombre FROM ubicaciones ORDER BY nombre ASC")
    items = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return items

@app.post("/api/ubicaciones", status_code=201)
def create_ubicacion(data: CatalogCreate, admin_user: dict = Depends(require_admin)):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO ubicaciones (nombre) VALUES (?)", (data.nombre.strip(),))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        return {"mensaje": "Ubicación creada", "id": new_id, "nombre": data.nombre.strip()}
    except Exception:
        conn.close()
        raise HTTPException(status_code=400, detail="Esta ubicación ya existe.")

@app.delete("/api/ubicaciones/{ub_id}")
def delete_ubicacion(ub_id: int, admin_user: dict = Depends(require_admin)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM ubicaciones WHERE id = ?", (ub_id,))
    conn.commit()
    conn.close()
    return {"mensaje": "Ubicación eliminada"}

# --- Organizadores ---
@app.get("/api/organizadores")
def get_organizadores():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, nombre FROM organizadores ORDER BY nombre ASC")
    items = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return items

@app.post("/api/organizadores", status_code=201)
def create_organizador(data: CatalogCreate, admin_user: dict = Depends(require_admin)):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO organizadores (nombre) VALUES (?)", (data.nombre.strip(),))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        return {"mensaje": "Organizador creado", "id": new_id, "nombre": data.nombre.strip()}
    except Exception:
        conn.close()
        raise HTTPException(status_code=400, detail="Este organizador ya existe.")

@app.delete("/api/organizadores/{org_id}")
def delete_organizador(org_id: int, admin_user: dict = Depends(require_admin)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM organizadores WHERE id = ?", (org_id,))
    conn.commit()
    conn.close()
    return {"mensaje": "Organizador eliminado"}

# =====================================================================
# 7. GESTIÓN DE USUARIOS (ADMINISTRADOR)
# =====================================================================

@app.get("/api/usuarios")
def get_usuarios(admin_user: dict = Depends(require_admin)):
    """Lista todos los usuarios registrados (Solo Administradores)."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, nombre, email, rol FROM usuarios ORDER BY id ASC")
    users = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return users

@app.put("/api/usuarios/{usuario_id}/rol")
def update_user_rol(usuario_id: int, role_data: UserUpdateRole, admin_user: dict = Depends(require_admin)):
    """Cambia el rol de un usuario (admin <-> estudiante)."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE usuarios SET rol = ? WHERE id = ?", (role_data.rol, usuario_id))
    conn.commit()
    conn.close()
    return {"mensaje": f"Rol de usuario actualizado a '{role_data.rol}'"}

@app.delete("/api/usuarios/{usuario_id}")
def delete_usuario(usuario_id: int, admin_user: dict = Depends(require_admin)):
    """Elimina un usuario del sistema (Solo Administradores)."""
    if usuario_id == admin_user["id"]:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta de administrador.")
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM usuarios WHERE id = ?", (usuario_id,))
    conn.commit()
    conn.close()
    return {"mensaje": "Usuario eliminado correctamente"}

# =====================================================================
# 8. ESTADÍSTICAS Y MÉTRICAS (ADMIN)
# =====================================================================

@app.get("/api/stats")
def get_dashboard_stats(admin_user: dict = Depends(require_admin)):
    """Retorna conteos rápidos de eventos, estudiantes, inscripciones y sugerencias."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM eventos")
    total_eventos = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM usuarios WHERE rol = 'estudiante'")
    total_estudiantes = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM inscripciones")
    total_inscripciones = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM sugerencias")
    total_sugerencias = cursor.fetchone()[0]

    conn.close()
    return {
        "total_eventos": total_eventos,
        "total_estudiantes": total_estudiantes,
        "total_inscripciones": total_inscripciones,
        "total_sugerencias": total_sugerencias
    }

# =====================================================================
# 9. SERVIR ARCHIVOS ESTÁTICOS DEL FRONTEND
# =====================================================================

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")

if os.path.exists(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

    @app.get("/")
    def serve_index():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

    @app.get("/dashboard")
    def serve_dashboard():
        return FileResponse(os.path.join(FRONTEND_DIR, "dashboard.html"))

    @app.get("/admin")
    def serve_admin():
        return FileResponse(os.path.join(FRONTEND_DIR, "admin.html"))

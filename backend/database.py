import os
import bcrypt
import psycopg2
import psycopg2.extras
from contextlib import contextmanager
from dotenv import load_dotenv

# Cargamos las variables del archivo .env.
load_dotenv()

# URL de conexión al servidor PostgreSQL local o remoto.
DATABASE_URL = os.getenv("DATABASE_URL")

@contextmanager
def get_db():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL no esta configurada en .env")
    try:
        conn = psycopg2.connect(
            DATABASE_URL,
            cursor_factory=psycopg2.extras.RealDictCursor,
            connect_timeout=5,
        )
    except UnicodeDecodeError as exc:
        # psycopg2-binary en Windows no decodifica mensajes de libpq en español
        # (ej. «localhost», «eventos_ideth» en cp1252) y enmascara el error real.
        # Casi siempre significa: la base no existe o falló la autenticación.
        raise RuntimeError(
            "No se pudo conectar a PostgreSQL (psycopg2 ocultó el mensaje original "
            "por un problema de codificación con tildes/«»). Verifica que la base "
            "'eventos_ideth' exista, que el usuario/clave del .env sean correctos y "
            "que PostgreSQL esté corriendo en localhost:5432."
        ) from exc

    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def hash_password(password: str) -> str:
    # Esta funcion sirve para encriptar la contraseña antes de guardarla
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def init_db():
    # Esta funcion crea todas las tablas que necesita el proyecto si no existen
    with get_db() as conn:
        cursor = conn.cursor()

        # Tabla de usuarios: aqui se guardan los estudiantes y administradores
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            rol VARCHAR(20) NOT NULL DEFAULT 'estudiante' CHECK(rol IN ('admin', 'estudiante'))
        );
        """)

        # Tabla de categorias: los tipos de evento (Deportes, Cultura, etc.)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS categorias (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(100) UNIQUE NOT NULL
        );
        """)

        # Tabla de ubicaciones: los lugares del colegio donde se hacen los eventos
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS ubicaciones (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(100) UNIQUE NOT NULL
        );
        """)

        # Tabla de organizadores: quien organiza cada evento
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS organizadores (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(100) UNIQUE NOT NULL
        );
        """)

        # Tabla de eventos: la tabla principal donde se guardan todos los eventos
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS eventos (
            id SERIAL PRIMARY KEY,
            titulo VARCHAR(150) NOT NULL,
            descripcion TEXT,
            fecha TIMESTAMP NOT NULL,
            ubicacion_id INTEGER REFERENCES ubicaciones(id) ON DELETE SET NULL,
            categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
            organizador_id INTEGER REFERENCES organizadores(id) ON DELETE SET NULL,
            imagen_url TEXT,
            frase_motivacional VARCHAR(255),
            permite_voluntarios BOOLEAN DEFAULT FALSE,
            resumen_pasado TEXT
        );
        """)

        # Agregamos las columnas a eventos por si la tabla ya habia sido creada previamente
        cursor.execute("ALTER TABLE eventos ADD COLUMN IF NOT EXISTS imagen_url TEXT;")
        cursor.execute("ALTER TABLE eventos ADD COLUMN IF NOT EXISTS frase_motivacional VARCHAR(255);")
        cursor.execute("ALTER TABLE eventos ADD COLUMN IF NOT EXISTS permite_voluntarios BOOLEAN DEFAULT FALSE;")
        cursor.execute("ALTER TABLE eventos ADD COLUMN IF NOT EXISTS resumen_pasado TEXT;")

        # Tabla de inscripciones: para saber que estudiante se inscribio a que evento
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS inscripciones (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
            fecha_registro TIMESTAMP NOT NULL,
            tipo_participacion VARCHAR(50) DEFAULT 'asistente',
            detalle_participacion TEXT,
            UNIQUE(usuario_id, evento_id)
        );
        """)

        # Agregamos las columnas a inscripciones por si la tabla ya existia
        cursor.execute("ALTER TABLE inscripciones ADD COLUMN IF NOT EXISTS tipo_participacion VARCHAR(50) DEFAULT 'asistente';")
        cursor.execute("ALTER TABLE inscripciones ADD COLUMN IF NOT EXISTS detalle_participacion TEXT;")

        # Tabla de calificaciones: las estrellas de 1 a 5 que deja cada estudiante
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS calificaciones (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
            puntuacion SMALLINT NOT NULL CHECK(puntuacion >= 1 AND puntuacion <= 5),
            UNIQUE(usuario_id, evento_id)
        );
        """)

        # Tabla de comentarios: lo que escriben los estudiantes sobre cada evento
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS comentarios (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
            texto TEXT NOT NULL,
            fecha TIMESTAMP NOT NULL
        );
        """)

        # Tabla de sugerencias: las ideas que mandan los estudiantes al colegio
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS sugerencias (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            texto TEXT NOT NULL,
            fecha TIMESTAMP NOT NULL
        );
        """)

        # Tabla de reportes de problemas: inconvenientes reportados por estudiantes para mejorar el colegio
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS reportes_problemas (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            evento_id INTEGER REFERENCES eventos(id) ON DELETE SET NULL,
            tipo_problema VARCHAR(100) NOT NULL,
            descripcion TEXT NOT NULL,
            estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
            fecha TIMESTAMP NOT NULL
        );
        """)

        # Tabla de encuestas: para conocer la opinion escolar con preguntas cerradas y abiertas
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS encuestas (
            id SERIAL PRIMARY KEY,
            evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
            titulo VARCHAR(150) NOT NULL,
            pregunta_1 VARCHAR(255) NOT NULL,
            opciones_1 TEXT NOT NULL,
            pregunta_2 VARCHAR(255),
            opciones_2 TEXT,
            pregunta_abierta VARCHAR(255) NOT NULL,
            activa BOOLEAN DEFAULT TRUE,
            fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
        );
        """)

        # Tabla de respuestas a encuestas
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS respuestas_encuestas (
            id SERIAL PRIMARY KEY,
            encuesta_id INTEGER NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            respuesta_1 VARCHAR(100) NOT NULL,
            respuesta_2 VARCHAR(100),
            respuesta_abierta TEXT,
            fecha TIMESTAMP NOT NULL DEFAULT NOW(),
            UNIQUE(encuesta_id, usuario_id)
        );
        """)

        # Llenamos la base con algunos datos iniciales para que no este vacia
        seed_initial_data(conn)

    print("Base de datos PostgreSQL lista")


def seed_initial_data(conn):
    # Esta funcion pone datos iniciales si las tablas estan vacias
    cursor = conn.cursor()

    # Creamos algunos usuarios de prueba si no hay ninguno
    cursor.execute("SELECT COUNT(*) as total FROM usuarios")
    if cursor.fetchone()["total"] == 0:
        admin_pass = hash_password("admin123")
        estudiante_pass = hash_password("estudiante123")
        cursor.executemany(
            "INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (%s, %s, %s, %s)",
            [
                ("Profesor Admin", "admin@ideth.edu", admin_pass, "admin"),
                ("Camila Rodriguez (11A)", "estudiante@ideth.edu", estudiante_pass, "estudiante"),
                ("Santiago Gomez (11B)", "santiago@ideth.edu", estudiante_pass, "estudiante")
            ]
        )

    # Creamos categorias si no hay ninguna
    cursor.execute("SELECT COUNT(*) as total FROM categorias")
    if cursor.fetchone()["total"] == 0:
        cursor.executemany(
            "INSERT INTO categorias (nombre) VALUES (%s)",
            [
                ("Deportes",),
                ("Ciencia y Tecnologia",),
                ("Arte y Cultura",),
                ("Orientacion Vocacional",),
                ("Convivencia y Recreacion",)
            ]
        )

    # Creamos ubicaciones si no hay ninguna
    cursor.execute("SELECT COUNT(*) as total FROM ubicaciones")
    if cursor.fetchone()["total"] == 0:
        cursor.executemany(
            "INSERT INTO ubicaciones (nombre) VALUES (%s)",
            [
                ("Cancha Multiple Principal",),
                ("Auditorio Simon Bolivar",),
                ("Laboratorio de Fisica y Robotica",),
                ("Biblioteca Escolar",),
                ("Patio Central",)
            ]
        )

    # Creamos organizadores si no hay ninguno
    cursor.execute("SELECT COUNT(*) as total FROM organizadores")
    if cursor.fetchone()["total"] == 0:
        cursor.executemany(
            "INSERT INTO organizadores (nombre) VALUES (%s)",
            [
                ("Consejo Estudiantil 11",),
                ("Area de Educacion Fisica",),
                ("Club de Ciencias y Robotica",),
                ("Psicorientacion Escolar",),
                ("Comite de Cultura",)
            ]
        )

    # Creamos el evento de prueba con la foto real de la cancha
    cursor.execute("SELECT COUNT(*) as total FROM eventos")
    if cursor.fetchone()["total"] == 0:
        from datetime import datetime, timedelta
        hoy = datetime.now()
        fecha_evento = (hoy + timedelta(days=2)).strftime("%Y-%m-%d 10:00:00")

        cursor.execute("""
            INSERT INTO eventos (titulo, descripcion, fecha, ubicacion_id, categoria_id, organizador_id, imagen_url, frase_motivacional, permite_voluntarios, resumen_pasado)
            VALUES 
            (
                'Torneo Relampago de Microfutbol Intercursos',
                'Gran torneo de microfutbol entre los salones de bachillerato en la cancha del colegio. Ven con tu uniforme deportivo o camiseta para apoyar a tu salon.',
                %s, 1, 1, 2,
                'img/cancha_futbol_ideth.jpeg',
                'El talento gana partidos, pero el trabajo en equipo y el respeto ganan campeonatos.',
                true,
                'El torneo intercursos anterior reunio a mas de 200 estudiantes en una jornada deportiva llena de emocion, donde el grado 11A se corono campeon.'
            )
        """, (fecha_evento,))


if __name__ == "__main__":
    init_db()

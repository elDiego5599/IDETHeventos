import os
import bcrypt
import psycopg2
import psycopg2.extras
from contextlib import contextmanager
from dotenv import load_dotenv

# Cargamos las variables del archivo .env (donde está la URL de Supabase)
load_dotenv()

# Esta es la URL de conexión a Supabase, viene del archivo .env
DATABASE_URL = os.getenv("DATABASE_URL")


@contextmanager
def get_db():
    # Esta funcion se encarga de conectarse a la base de datos de Supabase
    # Si no hay URL configurada, avisamos que hay que configurar el .env
    if not DATABASE_URL:
        raise Exception("No se encontro DATABASE_URL. Revisa tu archivo .env y pon la URL de Supabase.")

    # Nos conectamos a Supabase. Usamos RealDictCursor para poder usar los datos como diccionario
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        # Entregamos la conexion para que se pueda usar
        yield conn
        # Si todo salio bien, guardamos los cambios
        conn.commit()
    except Exception:
        # Si algo fallo, deshacemos los cambios
        conn.rollback()
        raise
    finally:
        # Siempre cerramos la conexion al final
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
            organizador_id INTEGER REFERENCES organizadores(id) ON DELETE SET NULL
        );
        """)

        # Tabla de inscripciones: para saber que estudiante se inscribio a que evento
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS inscripciones (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
            fecha_registro TIMESTAMP NOT NULL,
            UNIQUE(usuario_id, evento_id)
        );
        """)

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

        # Llenamos la base con algunos datos iniciales para que no este vacia
        seed_initial_data(conn)

    print("Base de datos lista en Supabase")


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


if __name__ == "__main__":
    init_db()

import os
import sqlite3
import bcrypt
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "eventos.db")

@contextmanager
def get_db():
    """Abre la base de datos y la cierra al terminar.

    Explicación simple: usar `with get_db()` nos da una conexión segura.
    Si todo sale bien, guarda los cambios; si hay error, deshace los cambios.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def hash_password(password: str) -> str:
    # Crea un hash seguro para la contraseña.
    # Explicación simple: no guardamos la contraseña literal, guardamos
    # una versión difícil de leer para que nadie la copie.
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def init_db():
    """Crea las tablas necesarias y pone datos de ejemplo.

    Explicación simple: cuando arrancamos la aplicación por primera vez
    necesitamos crear las tablas (usuarios, eventos, etc.) y algunos datos
    de ejemplo para probar la app.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # 1. Usuarios
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            rol TEXT NOT NULL DEFAULT 'estudiante' CHECK(rol IN ('admin', 'estudiante'))
        );
        """)

        # 2. Categorias
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT UNIQUE NOT NULL
        );
        """)

        # 3. Ubicaciones
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS ubicaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT UNIQUE NOT NULL
        );
        """)

        # 4. Organizadores
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS organizadores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT UNIQUE NOT NULL
        );
        """)

        # 5. Eventos
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS eventos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT NOT NULL,
            descripcion TEXT,
            fecha TEXT NOT NULL,
            ubicacion_id INTEGER,
            categoria_id INTEGER,
            organizador_id INTEGER,
            FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones (id) ON DELETE SET NULL,
            FOREIGN KEY (categoria_id) REFERENCES categorias (id) ON DELETE SET NULL,
            FOREIGN KEY (organizador_id) REFERENCES organizadores (id) ON DELETE SET NULL
        );
        """)

        # 6. Inscripciones
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS inscripciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            evento_id INTEGER NOT NULL,
            fecha_registro TEXT NOT NULL,
            UNIQUE(usuario_id, evento_id),
            FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
            FOREIGN KEY (evento_id) REFERENCES eventos (id) ON DELETE CASCADE
        );
        """)

        # 7. Calificaciones
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS calificaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            evento_id INTEGER NOT NULL,
            puntuacion INTEGER NOT NULL CHECK(puntuacion >= 1 AND puntuacion <= 5),
            UNIQUE(usuario_id, evento_id),
            FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
            FOREIGN KEY (evento_id) REFERENCES eventos (id) ON DELETE CASCADE
        );
        """)

        # 8. Comentarios
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS comentarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            evento_id INTEGER NOT NULL,
            texto TEXT NOT NULL,
            fecha TEXT NOT NULL,
            FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
            FOREIGN KEY (evento_id) REFERENCES eventos (id) ON DELETE CASCADE
        );
        """)

        # 9. Sugerencias
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS sugerencias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            texto TEXT NOT NULL,
            fecha TEXT NOT NULL,
            FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
        );
        """)

        seed_initial_data(conn)

    print("Base de datos SQLite inicializada correctamente en:", DB_PATH)

def seed_initial_data(conn):
    """Agrega usuarios y listas (categorias, ubicaciones...) si no existen.

    Explicación simple: pone un profesor y dos estudiantes, y ejemplos de
    categorias, lugares y organizadores para que la aplicación tenga contenido.
    """
    cursor = conn.cursor()

    # 1. Usuarios
    cursor.execute("SELECT COUNT(*) FROM usuarios")
    if cursor.fetchone()[0] == 0:
        admin_pass = hash_password("admin123")
        estudiante_pass = hash_password("estudiante123")
        cursor.executemany(
            "INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)",
            [
                ("Profesor Admin", "admin@ideth.edu", admin_pass, "admin"),
                ("Camila Rodriguez (11A)", "estudiante@ideth.edu", estudiante_pass, "estudiante"),
                ("Santiago Gomez (11B)", "santiago@ideth.edu", estudiante_pass, "estudiante")
            ]
        )

    # 2. Categorias
    cursor.execute("SELECT COUNT(*) FROM categorias")
    if cursor.fetchone()[0] == 0:
        cursor.executemany(
            "INSERT INTO categorias (nombre) VALUES (?)",
            [
                ("Deportes",),
                ("Ciencia y Tecnologia",),
                ("Arte y Cultura",),
                ("Orientacion Vocacional",),
                ("Convivencia y Recreacion",)
            ]
        )

    # 3. Ubicaciones
    cursor.execute("SELECT COUNT(*) FROM ubicaciones")
    if cursor.fetchone()[0] == 0:
        cursor.executemany(
            "INSERT INTO ubicaciones (nombre) VALUES (?)",
            [
                ("Cancha Multiple Principal",),
                ("Auditorio Simon Bolivar",),
                ("Laboratorio de Fisica y Robotica",),
                ("Biblioteca Escolar",),
                ("Patio Central",)
            ]
        )

    # 4. Organizadores
    cursor.execute("SELECT COUNT(*) FROM organizadores")
    if cursor.fetchone()[0] == 0:
        cursor.executemany(
            "INSERT INTO organizadores (nombre) VALUES (?)",
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

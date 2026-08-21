import os
import sqlite3
import bcrypt
from datetime import datetime

# Ruta del archivo de base de datos SQLite
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "eventos.db")

def get_db():
    """
    Crea y retorna una conexión a la base de datos SQLite.
    Activa claves foráneas y permite acceder a columnas por nombre (Row).
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def hash_password(password: str) -> str:
    """Hashea una contraseña usando bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def init_db():
    """
    Crea las 9 tablas requeridas e inserta datos iniciales de prueba si está vacía.
    """
    conn = get_db()
    cursor = conn.cursor()

    # 1. Tabla de Usuarios
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        rol TEXT NOT NULL DEFAULT 'estudiante' CHECK(rol IN ('admin', 'estudiante'))
    );
    """)

    # 2. Tabla de Categorías
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT UNIQUE NOT NULL
    );
    """)

    # 3. Tabla de Ubicaciones
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ubicaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT UNIQUE NOT NULL
    );
    """)

    # 4. Tabla de Organizadores
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS organizadores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT UNIQUE NOT NULL
    );
    """)

    # 5. Tabla de Eventos
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

    # 6. Tabla de Inscripciones
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

    # 7. Tabla de Calificaciones (1 a 5 estrellas)
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

    # 8. Tabla de Comentarios
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

    # 9. Tabla de Sugerencias
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sugerencias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        texto TEXT NOT NULL,
        fecha TEXT NOT NULL,
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
    );
    """)

    conn.commit()

    # Insertar datos semilla si la base de datos es nueva
    seed_initial_data(conn)
    conn.close()
    print("✓ Base de datos SQLite inicializada correctamente en:", DB_PATH)

def seed_initial_data(conn):
    """Inserta datos de prueba para bachillerato si no existen."""
    cursor = conn.cursor()

    # 1. Usuarios por defecto (Admin y Estudiante de prueba)
    cursor.execute("SELECT COUNT(*) FROM usuarios")
    if cursor.fetchone()[0] == 0:
        admin_pass = hash_password("admin123")
        estudiante_pass = hash_password("estudiante123")
        
        cursor.executemany(
            "INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)",
            [
                ("Profesor Admin", "admin@ideth.edu", admin_pass, "admin"),
                ("Camila Rodríguez (11°A)", "estudiante@ideth.edu", estudiante_pass, "estudiante"),
                ("Santiago Gómez (11°B)", "santiago@ideth.edu", estudiante_pass, "estudiante"),
                ("Valentina Peña (10°C)", "valentina@ideth.edu", estudiante_pass, "estudiante")
            ]
        )

    # 2. Categorías
    cursor.execute("SELECT COUNT(*) FROM categorias")
    if cursor.fetchone()[0] == 0:
        cursor.executemany(
            "INSERT INTO categorias (nombre) VALUES (?)",
            [
                ("Deportes",),
                ("Ciencia y Tecnología",),
                ("Arte y Cultura",),
                ("Orientación Vocacional",),
                ("Convivencia y Recreación",)
            ]
        )

    # 3. Ubicaciones
    cursor.execute("SELECT COUNT(*) FROM ubicaciones")
    if cursor.fetchone()[0] == 0:
        cursor.executemany(
            "INSERT INTO ubicaciones (nombre) VALUES (?)",
            [
                ("Cancha Múltiple Principal",),
                ("Auditorio Simón Bolívar",),
                ("Laboratorio de Física y Robótica",),
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
                ("Consejo Estudiantil 11°",),
                ("Área de Educación Física",),
                ("Club de Ciencias y Robótica",),
                ("Psicorientación Escolar",),
                ("Comité de Cultura",)
            ]
        )

    # 5. Eventos
    cursor.execute("SELECT COUNT(*) FROM eventos")
    if cursor.fetchone()[0] == 0:
        cursor.executemany(
            """INSERT INTO eventos (titulo, descripcion, fecha, ubicacion_id, categoria_id, organizador_id)
               VALUES (?, ?, ?, ?, ?, ?)""",
            [
                (
                    "Torneo Interclases de Microfútbol 11°",
                    "Gran torneo de fútbol de salón masculino y femenino. Ven a representar a tu salón y ganar la copa de fin de año.",
                    "2026-09-15 14:30",
                    1, # Cancha Múltiple
                    1, # Deportes
                    2  # Área de Educación Física
                ),
                (
                    "Feria de Ciencia, Robótica e Innovación",
                    "Muestra de proyectos tecnológicos construidos por estudiantes de 10° y 11°. Habrá concurso de drones y prototipos.",
                    "2026-09-22 09:00",
                    3, # Laboratorio
                    2, # Ciencia y Tecnología
                    3  # Club de Ciencias
                ),
                (
                    "Taller de Orientación Vocacional y Universidades",
                    "Charla con representantes de universidades locales y test vocacional para elegir tu carrera profesional con seguridad.",
                    "2026-10-05 10:00",
                    2, # Auditorio
                    4, # Orientación Vocacional
                    4  # Psicorientación
                ),
                (
                    "Festival de Talentos y Música 2026",
                    "Canto, danza, teatro y bandas en vivo de bachillerato. ¡Demuestra tu talento en el escenario!",
                    "2026-10-18 15:00",
                    2, # Auditorio
                    3, # Arte y Cultura
                    5  # Comité de Cultura
                ),
                (
                    "Jornada de Integración de Grado 11° (Pasado)",
                    "Día de juegos tradicionales, picnic y dinámicas de integración para despedir el año escolar.",
                    "2026-08-10 08:30",
                    5, # Patio Central
                    5, # Convivencia
                    1  # Consejo Estudiantil
                )
            ]
        )

    # 6. Inscripciones y Calificaciones de ejemplo
    cursor.execute("SELECT COUNT(*) FROM inscripciones")
    if cursor.fetchone()[0] == 0:
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        cursor.execute("INSERT INTO inscripciones (usuario_id, evento_id, fecha_registro) VALUES (2, 1, ?)", (now_str,))
        cursor.execute("INSERT INTO inscripciones (usuario_id, evento_id, fecha_registro) VALUES (2, 2, ?)", (now_str,))
        cursor.execute("INSERT INTO inscripciones (usuario_id, evento_id, fecha_registro) VALUES (2, 5, ?)", (now_str,))
        
        # Calificación para el evento pasado
        cursor.execute("INSERT INTO calificaciones (usuario_id, evento_id, puntuacion) VALUES (2, 5, 5)")
        cursor.execute("INSERT INTO comentarios (usuario_id, evento_id, texto, fecha) VALUES (2, 5, '¡Fue una jornada inolvidable, los juegos estuvieron geniales!', ?)", (now_str,))
        
        # Sugerencia inicial
        cursor.execute("INSERT INTO sugerencias (usuario_id, texto, fecha) VALUES (2, 'Sería excelente organizar un taller de programación de videojuegos para 11°', ?)", (now_str,))

    conn.commit()

if __name__ == "__main__":
    init_db()

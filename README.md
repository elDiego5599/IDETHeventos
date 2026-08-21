# 🎓 IDETHeventos - Portal de Eventos Escolares de Bachillerato

Bienvenido al repositorio de **IDETHeventos**, un portal web moderno, sencillo y rápido diseñado para estudiantes de bachillerato (11° grado) y administradores escolares del Colegio IDETH.

---

## 🚀 ¿Qué hace esta plataforma?

1. **Para Estudiantes:**
   - 📅 **Cronograma Escolar:** Ver los próximos torneos deportivos, ferias de ciencias, talleres vocacionales y semanas culturales.
   - 🎟️ **Inscripciones con un clic:** Inscribirse o cancelar participación en cualquier actividad.
   - ⭐ **Calificaciones (1 a 5 estrellas):** Calificar las actividades escolares y ver los promedios en tiempo real.
   - 💬 **Muro de comentarios:** Compartir experiencias y opiniones sobre cada evento.
   - 💡 **Buzón de sugerencias:** Enviar propuestas o ideas directamente a los organizadores.

2. **Para Administradores (Docentes / Comités):**
   - ➕ **Gestión de Eventos (CRUD):** Crear, editar y eliminar eventos, asignando fechas, ubicaciones y organizadores.
   - 🏷️ **Gestión de Catálogos:** Administrar Categorías, Ubicaciones y Organizadores escolares.
   - 👥 **Gestión de Usuarios:** Ver todos los registrados y cambiar roles (`admin` / `estudiante`).
   - 📬 **Revisión de Sugerencias:** Leer y atender las propuestas enviadas por los estudiantes.

---

## 🛠️ Tecnologías Utilizadas

- **Frontend:** HTML5, CSS3 moderno (Vanilla CSS responsivo) y JavaScript puro (Fetch API y LocalStorage) — *¡Sin frameworks complicados!*
- **Backend:** Python 3 con **FastAPI** y **Uvicorn**.
- **Base de Datos:** **SQLite** (archivo local `eventos.db`, no requiere instalar servidores MySQL o PostgreSQL).
- **Seguridad:** Hashing seguro con **bcrypt** y tokens de sesión **JWT**.

---

## 📁 Estructura del Proyecto

```text
IDETHeventos/
├── backend/
│   ├── database.py       # Conexión a SQLite, creación de 9 tablas y datos de prueba
│   ├── models.py         # Validación de datos con Pydantic
│   ├── auth.py           # Autenticación, tokens JWT y contraseñas seguras
│   └── main.py           # Servidor FastAPI con todos los endpoints de la API
├── frontend/
│   ├── index.html        # Página principal y modales de Login / Registro
│   ├── dashboard.html    # Panel interactivo del estudiante
│   ├── admin.html        # Panel de control del administrador
│   ├── css/
│   │   ├── styles.css    # Estilos globales, colores, tarjetas y modales
│   │   └── dashboard.css # Estilos de tablas, paneles y estadísticas
│   └── js/
│       ├── api.js        # Helper para llamadas HTTP a FastAPI
│       ├── auth.js       # Manejo de inicio de sesión y registro automático
│       ├── app.js        # Lógica de la página de inicio pública
│       ├── student.js    # Lógica del estudiante (inscripciones, estrellas, comentarios)
│       └── admin.js      # Lógica del admin (CRUD de eventos, catálogos, usuarios)
├── requirements.txt      # Librerías necesarias de Python
└── README.md             # Documentación del proyecto
```

---

## ⚡ ¿Cómo ponerlo a funcionar en 2 pasos?

### Paso 1: Instalar dependencias
Abre tu terminal en la carpeta del proyecto y escribe:

```bash
pip install -r requirements.txt
```

### Paso 2: Iniciar el servidor
Ejecuta el siguiente comando para encender la aplicación:

```bash
uvicorn backend.main:app --reload
```

¡Listo! Abre tu navegador web y entra a:
👉 **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

---

## 🔑 Cuentas de Prueba Preconfiguradas

La base de datos viene con datos de prueba listos para usar:

| Rol | Correo Electrónico | Contraseña | ¿Qué puede hacer? |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@ideth.edu` | `admin123` | Crear eventos, gestionar categorías, usuarios y ver sugerencias |
| **Estudiante** | `estudiante@ideth.edu` | `estudiante123` | Inscribirse, calificar de 1 a 5 estrellas, comentar y sugerir |

*(También puedes hacer clic en **"Registrarse"** en la página de inicio para crear un nuevo usuario estudiante).*

---

## 🗄️ Tablas de la Base de Datos (SQLite)

1. `usuarios`: id, nombre, email, password_hash, rol
2. `eventos`: id, titulo, descripcion, fecha, ubicacion_id, categoria_id, organizador_id
3. `inscripciones`: id, usuario_id, evento_id, fecha_registro
4. `calificaciones`: id, usuario_id, evento_id, puntuacion (1 a 5)
5. `comentarios`: id, usuario_id, evento_id, texto, fecha
6. `sugerencias`: id, usuario_id, texto, fecha
7. `categorias`: id, nombre
8. `ubicaciones`: id, nombre
9. `organizadores`: id, nombre

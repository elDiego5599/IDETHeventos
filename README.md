# Portal de Eventos IDETH

Portal web sencillo para eventos escolares del Colegio IDETH. Hecho por estudiantes de 11°.

---

## Que hace la aplicacion?

1. **Estudiantes:**
   - Ver cronograma de eventos del colegio.
   - Inscribirse o cancelar inscripcion a eventos.
   - Calificar actividades (1 a 5 estrellas) y comentar, solo despues de que el evento haya pasado.
   - Enviar sugerencias al colegio (solo el admin las puede ver).

2. **Administradores:**
   - Crear, editar y eliminar eventos.
   - Administrar categorias, ubicaciones y organizadores.
   - Administrar usuarios y cambiar roles.
   - Revisar sugerencias enviadas por los estudiantes.

---

## Tecnologias

- **Frontend:** HTML5, CSS3 y JavaScript puro.
- **Backend:** Python con FastAPI y Uvicorn.
- **Base de Datos:** PostgreSQL en Supabase.
- **Autenticacion:** JWT y bcrypt para las contraseñas.

---

## Estructura del Proyecto

```text
IDETHeventos/
├── backend/
│   ├── database.py       # Conexion a Supabase y creacion de tablas
│   ├── models.py         # Validacion de datos con Pydantic
│   ├── auth.py           # Login, tokens y permisos
│   └── main.py           # Servidor FastAPI con todos los endpoints
├── frontend/
│   ├── index.html        # Pagina principal
│   ├── login.html        # Pagina de inicio de sesion
│   ├── register.html     # Pagina de registro
│   ├── dashboard.html    # Panel de estudiante
│   ├── admin.html        # Panel de administracion
│   ├── img/
│   │   └── logoColegio.jpeg
│   ├── css/
│   │   ├── styles.css
│   │   └── dashboard.css
│   └── js/
│       ├── utils.js
│       ├── app.js
│       ├── student.js
│       └── admin.js
├── .env.example          # Ejemplo de configuracion para Supabase
├── requirements.txt
└── README.md
```

---

## Como iniciar el proyecto

### 1. Configurar Supabase

1. Entra a [supabase.com](https://supabase.com) y crea un proyecto gratis.
2. Ve a Project Settings -> Database -> Connection string (URI) y copia la URL.
3. En la carpeta del proyecto crea un archivo `.env` a partir del ejemplo:
   ```bash
   cp .env.example .env
   ```
4. Abre el archivo `.env` y pega tu URL:
   ```
   DATABASE_URL=postgresql://postgres:TU_PASSWORD@db.TU_PROYECTO.supabase.co:5432/postgres
   JWT_SECRET=clave-secreta-ideth-2026
   ```

### 2. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 3. Iniciar el servidor

```bash
uvicorn backend.main:app --reload
```

### 4. Abrir en el navegador

`http://127.0.0.1:8000`

---

## Cuentas de prueba

Cuando el servidor arranca por primera vez crea estos usuarios automaticamente:

| Rol | Correo | Contrasena |
| :--- | :--- | :--- |
| **Administrador** | `admin@ideth.edu` | `admin123` |
| **Estudiante** | `estudiante@ideth.edu` | `estudiante123` |

---

## Notas

- Las sugerencias solo las puede ver el administrador en su panel.
- Los comentarios y calificaciones solo se pueden hacer despues de que el evento haya pasado un dia.
- Si el admin cambia la fecha de un evento pasado a una fecha futura, se borran los comentarios y calificaciones de ese evento.

# Portal de Eventos IDETH

Portal web sencillo para eventos escolares del Colegio IDETH.

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
- **Backend:** Python con Flask.
- **Base de Datos:** PostgreSQL administrado desde pgAdmin 4.
- **Autenticacion:** JWT y bcrypt para las contraseñas.

---

## Estructura del Proyecto

```text
IDETHeventos/
├── backend/
│   ├── database.py       # Conexion a PostgreSQL y creacion de tablas
│   ├── models.py         # Validacion manual de los datos que llegan
│   ├── auth.py           # Login, tokens JWT y permisos (admin / estudiante)
│   └── main.py           # Servidor Flask con todos los endpoints
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
├── .env                  # Configuracion local (no se versiona)
├── requirements.txt
└── README.md
```

---

## Como iniciar el proyecto

### 1. Configurar PostgreSQL

1. Instala PostgreSQL (15 o superior) con usuario `postgres` y password `1234`.
2. Ejecuta `RESTAURAR_BD.bat` (crea la base `eventos_ideth` y carga los datos), o si prefieres una base vacia, creala desde pgAdmin 4.
3. Abre el archivo `.env` y configura:
   ```
   DATABASE_URL=postgresql://postgres:TU_PASSWORD@localhost:5432/eventos_ideth
   JWT_SECRET=una-clave-local
   ```

> Si no existe la base, la aplicacion igual arranca y crea las tablas y los datos de ejemplo automaticamente.

### 2. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 3. Iniciar el servidor

```bash
python -m backend.main
```

O simplemente dale doble clic a `INICIAR.bat` (crea el entorno virtual, instala todo y arranca).

### 4. Abrir en el navegador

`http://localhost:8000`

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

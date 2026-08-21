# Portal de Eventos IDETH

Portal web sencillo para eventos escolares del Colegio IDETH.

---

## Que hace la aplicacion?

1. **Estudiantes:**
   - Ver cronograma de eventos del colegio.
   - Inscribirse o cancelar inscripcion a eventos.
   - Calificar actividades (1 a 5 estrellas) y comentar.
   - Enviar sugerencias al colegio.

2. **Administradores:**
   - Crear, editar y eliminar eventos.
   - Administrar categorias, ubicaciones y organizadores.
   - Administrar usuarios y roles.
   - Revisar sugerencias enviadas por estudiantes.

---

## Tecnologias

- **Frontend:** HTML5, CSS3 (Vanilla) y JavaScript puro.
- **Backend:** Python con FastAPI y Uvicorn.
- **Base de Datos:** SQLite (archivo local `eventos.db`).
- **Autenticacion:** JWT y hashing con bcrypt.

---

## Estructura del Proyecto

```text
IDETHeventos/
├── backend/
│   ├── database.py       # Base de datos SQLite y datos iniciales
│   ├── models.py         # Modelos de validacion con Pydantic
│   ├── auth.py           # Autenticacion y tokens JWT
│   └── main.py           # Servidor FastAPI con endpoints y rutas
├── frontend/
│   ├── index.html        # Pagina principal
│   ├── login.html        # Pagina de inicio de sesion
│   ├── register.html     # Pagina de registro
│   ├── dashboard.html    # Panel de estudiante
│   ├── admin.html        # Panel de administracion
│   ├── img/
│   │   └── logoColegio.jpeg
│   ├── css/
│   │   ├── styles.css    # Estilos principales
│   │   └── dashboard.css # Estilos de paneles y tablas
│   └── js/
│       ├── utils.js      # Utilidades de API, sesion y modales
│       ├── app.js        # Logica de la pagina principal
│       ├── student.js    # Logica del panel de estudiante
│       └── admin.js      # Logica del panel de administracion
├── requirements.txt      # Dependencias
└── README.md
```

---

## Como iniciar el proyecto

1. **Instalar dependencias:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Iniciar el servidor:**
   ```bash
   uvicorn backend.main:app --reload
   ```

3. **Abrir en el navegador:**
   `http://127.0.0.1:8000`

---

## Cuentas de prueba

| Rol | Correo | Contrasena |
| :--- | :--- | :--- |
| **Administrador** | `admin@ideth.edu` | `admin123` |
| **Estudiante** | `estudiante@ideth.edu` | `estudiante123` |

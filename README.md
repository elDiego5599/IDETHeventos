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
├── scripts/
│   └── restaurar_bd.ps1  # Crea la base local sin borrar una existente
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
├── INICIAR.bat           # Prepara dependencias e inicia el servidor
├── RESTAURAR_BD.bat      # Prepara la base PostgreSQL local
├── requirements.txt
└── README.md
```

---

## Ejecutar en Windows desde cero

1. Instala Python desde [python.org](https://www.python.org/downloads/) y marca **Add python.exe to PATH** durante la instalacion.
2. Instala PostgreSQL para Windows. Conserva el puerto `5432` y anota la clave que asignes al usuario `postgres`.
3. Descomprime el proyecto. En la carpeta principal deben estar `INICIAR.bat` y `RESTAURAR_BD.bat`.
4. Ejecuta `RESTAURAR_BD.bat`, escribe la clave de `postgres` y pulsa Enter. La clave no se muestra mientras escribes. El script crea `eventos_ideth`; si ya existe, la conserva sin borrar ni sobrescribir sus datos.
5. Ejecuta `INICIAR.bat`. La primera vez crea el entorno virtual, instala las dependencias y abre `.env` en el Bloc de notas.
6. En `.env`, reemplaza `TU_PASSWORD` en `DATABASE_URL` por la clave de PostgreSQL, guarda y cierra el Bloc de notas. Si tu clave contiene caracteres reservados para una URL, codificalos (por ejemplo, `@` como `%40`).
7. El servidor se inicia en `http://localhost:8000`; el navegador se abre cuando la aplicacion ya responde. Mantén abierta la ventana negra mientras usas el portal.

Para iniciar el proyecto en otra ocasion, ejecuta de nuevo `INICIAR.bat`; la instalacion de dependencias se verifica y no se repite si ya esta lista. Cierra la ventana del servidor para detenerlo.

La primera peticion crea las tablas y los datos de ejemplo si las tablas estan vacias. No hace falta importar un archivo SQL.

### Ejecucion manual (opcional)

```bash
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Crea `.env` en la carpeta principal con estos valores y reemplaza `TU_PASSWORD` por la clave local de PostgreSQL:

```dotenv
DATABASE_URL=postgresql://postgres:TU_PASSWORD@localhost:5432/eventos_ideth
JWT_SECRET=una-clave-local-aleatoria
```

Luego inicia el servidor:

```bash
python -m backend.main
```

---

## Cuentas de prueba

Cuando el servidor arranca por primera vez crea estos usuarios automaticamente:

| Rol | Correo | Contrasena |
| :--- | :--- | :--- |
| **Administrador** | `admin@ideth.edu` | `admin123` |
| **Estudiante** | `estudiante@ideth.edu` | `estudiante123` |

---

## Notas

- `RESTAURAR_BD.bat` requiere PostgreSQL instalado, el servicio iniciado y sus herramientas de linea de comandos (`psql.exe` y `createdb.exe`). Si PostgreSQL no esta en `PATH`, el script busca en `%ProgramFiles%\PostgreSQL`.
- Si la pagina no abre, confirma que la ventana negra siga abierta y que el puerto `8000` este disponible.
- Si falla la conexion, revisa el servicio PostgreSQL, el puerto, la clave y `DATABASE_URL` en `.env`.
- Las sugerencias solo las puede ver el administrador en su panel.
- Los comentarios y calificaciones solo se pueden hacer despues de que el evento haya pasado un dia.
- Si el admin cambia la fecha de un evento pasado a una fecha futura, se borran los comentarios y calificaciones de ese evento.

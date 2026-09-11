import os
import jwt
import bcrypt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, jsonify, g
from dotenv import load_dotenv

# Cargamos las variables del archivo .env
load_dotenv()

# Clave secreta para firmar los tokens, viene del archivo .env
SECRET_KEY = os.getenv("JWT_SECRET", "clave-secreta-ideth-2026")
ALGORITHM = "HS256"
# El token dura 7 dias antes de vencer
ACCESS_TOKEN_EXPIRE_DAYS = 7


def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Verifica si la contraseña que escribio el usuario coincide con la guardada
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False


def create_access_token(data: dict) -> str:
    # Crea un token para que el usuario no tenga que loguearse a cada rato
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def _usuario_desde_token():
    # Lee el token del header "Authorization: Bearer <token>" y devuelve el usuario.
    # Si no hay token o es invalido, devuelve None.
    from backend.database import get_db

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.replace("Bearer ", "", 1).strip()
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
    except jwt.PyJWTError:
        return None

    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, nombre, email, rol FROM usuarios WHERE id = %s", (user_id,))
            user = cursor.fetchone()
    except Exception:
        return None

    return dict(user) if user else None


def login_requerido(f):
    # Decorador que obliga a haber iniciado sesion.
    # Si no hay token valido, responde 401 como espera la API.
    @wraps(f)
    def decorada(*args, **kwargs):
        usuario = _usuario_desde_token()
        if usuario is None:
            return jsonify({"detail": "No has iniciado sesion o falta el token de acceso"}), 401
        g.usuario_actual = usuario
        return f(*args, **kwargs)
    return decorada


def admin_requerido(f):
    # Decorador que obliga a ser administrador (revisa el token y el rol).
    @wraps(f)
    def decorada(*args, **kwargs):
        usuario = _usuario_desde_token()
        if usuario is None:
            return jsonify({"detail": "No has iniciado sesion o falta el token de acceso"}), 401
        if usuario.get("rol") != "admin":
            return jsonify({"detail": "Acceso denegado: Se requieren permisos de Administrador"}), 403
        g.usuario_actual = usuario
        return f(*args, **kwargs)
    return decorada


def usuario_opcional(f):
    # Decorador que NO obliga a estar logueado.
    # Si hay token valido guarda el usuario en g.usuario_actual, si no, lo deja en None.
    @wraps(f)
    def decorada(*args, **kwargs):
        g.usuario_actual = _usuario_desde_token()
        return f(*args, **kwargs)
    return decorada

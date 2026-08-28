import os
import jwt
import bcrypt
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.database import get_db
from dotenv import load_dotenv

# Cargamos las variables del archivo .env
load_dotenv()

# Clave secreta para firmar los tokens, viene del archivo .env
SECRET_KEY = os.getenv("JWT_SECRET", "clave-secreta-ideth-2026")
ALGORITHM = "HS256"
# El token dura 7 dias antes de vencer
ACCESS_TOKEN_EXPIRE_DAYS = 7

# Esto nos permite pedir el token en las peticiones
security = HTTPBearer(auto_error=False)


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



# Obtiene el usuario conectado a partir del token que envía el navegador.
# Explicación simple: mira el "boleto" (token), lo valida y busca
# al usuario en la base de datos. Si algo falla, devuelve un error 401.
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    # Esta funcion revisa que el usuario haya iniciado sesion y trae sus datos
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No has iniciado sesion o falta el token de acceso"
        )

    token = credentials.credentials
    try:
        # Decodificamos el token para saber que usuario es
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token sin identificador")
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido o expirado. Inicia sesion nuevamente."
        )

    # Buscamos al usuario en la base de datos de Supabase
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre, email, rol FROM usuarios WHERE id = %s", (user_id,))
        user = cursor.fetchone()

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")

    return dict(user)


def get_optional_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    # Esta funcion es parecida a la anterior pero no obliga a estar logueado
    # Si no hay token, simplemente devuelve None y deja ver la pagina como visitante
    if not credentials:
        return None
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, nombre, email, rol FROM usuarios WHERE id = %s", (user_id,))
            user = cursor.fetchone()
            return dict(user) if user else None
    except Exception:
        return None


def require_admin(current_user: dict = Depends(get_current_user)):
    # Esta funcion revisa que el usuario sea administrador, si no lo es no lo deja pasar
    if current_user.get("rol") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: Se requieren permisos de Administrador"
        )
    return current_user

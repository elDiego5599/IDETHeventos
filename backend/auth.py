import os
import jwt
import bcrypt
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.database import get_db

SECRET_KEY = os.getenv("JWT_SECRET", "clave-secreta-ideth-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

security = HTTPBearer(auto_error=False)

# Verifica si la contraseña en texto plano coincide con la guardada (hash).
# Explicación simple: toma la contraseña que escribe la persona y la compara
# con la contraseña en la base de datos (que está en forma segura, "hash").
def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False


# Crea un token JWT que usaremos para saber quién está conectado.
# Explicación simple: guarda información del usuario dentro de un "boleto"
# que caduca después de unos días. Con ese boleto el usuario no necesita
# volver a iniciar sesión cada vez.
def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# Obtiene el usuario conectado a partir del token que envía el navegador.
# Explicación simple: mira el "boleto" (token), lo valida y busca
# al usuario en la base de datos. Si algo falla, devuelve un error 401.
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No has iniciado sesion o falta el token de acceso"
        )
    
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token sin identificador")
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido o expirado. Inicia sesion nuevamente."
        )

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre, email, rol FROM usuarios WHERE id = ?", (user_id,))
        user = cursor.fetchone()

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")

    return dict(user)


# Igual que get_current_user pero no falla si no hay token.
# Explicación simple: si el usuario no envía token, aquí devolvemos None
# en lugar de error. Útil para rutas públicas que muestran información
# diferente si estás logeado o no.
def get_optional_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return None
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if not user_id:
            return None
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, nombre, email, rol FROM usuarios WHERE id = ?", (user_id,))
            user = cursor.fetchone()
            return dict(user) if user else None
    except Exception:
        return None


# Verifica que el usuario tenga rol de administrador.
# Explicación simple: algunas acciones solo las puede hacer un profesor/admin,
# así que aquí comprobamos eso y devolvemos 403 si no.
def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("rol") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: Se requieren permisos de Administrador"
        )
    return current_user

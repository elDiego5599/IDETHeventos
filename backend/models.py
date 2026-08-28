from pydantic import BaseModel, Field
from typing import Optional

# Estos modelos son para validar que los datos que llegan esten bien
# Si algo falta o esta mal escrito, FastAPI avisa automaticamente

# Datos para registrar un usuario nuevo
class UserRegister(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(..., min_length=6)

# Datos para iniciar sesion
class UserLogin(BaseModel):
    email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str

# Datos que devolvemos cuando consultamos un usuario
class UserResponse(BaseModel):
    id: int
    nombre: str
    email: str
    rol: str

# Para cambiar el rol de un usuario
class UserUpdateRole(BaseModel):
    rol: str = Field(..., pattern="^(admin|estudiante)$")

# Para crear categorias, ubicaciones y organizadores (todos usan lo mismo)
class CatalogCreate(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100)

class CatalogItem(BaseModel):
    id: int
    nombre: str

# Datos para crear un evento nuevo
class EventCreate(BaseModel):
    titulo: str = Field(..., min_length=3, max_length=150)
    descripcion: Optional[str] = ""
    fecha: str = Field(..., description="Fecha y hora en formato YYYY-MM-DD HH:MM")
    ubicacion_id: Optional[int] = None
    categoria_id: Optional[int] = None
    organizador_id: Optional[int] = None

# Datos para editar un evento (todo es opcional)
class EventUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    fecha: Optional[str] = None
    ubicacion_id: Optional[int] = None
    categoria_id: Optional[int] = None
    organizador_id: Optional[int] = None

# Para calificar un evento con estrellas
class RatingCreate(BaseModel):
    evento_id: int
    puntuacion: int = Field(..., ge=1, le=5)

# Para dejar un comentario en un evento
class CommentCreate(BaseModel):
    evento_id: int
    texto: str = Field(..., min_length=2, max_length=500)

# Para enviar una sugerencia al colegio
class SuggestionCreate(BaseModel):
    texto: str = Field(..., min_length=5, max_length=1000)

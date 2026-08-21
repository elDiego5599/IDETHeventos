from pydantic import BaseModel, Field
from typing import Optional

# Modelos para las peticiones y respuestas de la API.
# Explicación simple: cada clase dice qué datos espera el servidor.

# Datos para registrar a un usuario (registro)
class UserRegister(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100, description="Nombre completo del estudiante")
    email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", description="Correo electrónico institucional o personal")
    password: str = Field(..., min_length=6, description="Contraseña de al menos 6 caracteres")

# Datos para iniciar sesión
class UserLogin(BaseModel):
    email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str

# Respuesta con información pública del usuario
class UserResponse(BaseModel):
    id: int
    nombre: str
    email: str
    rol: str

# Cambiar el rol de un usuario (admin / estudiante)
class UserUpdateRole(BaseModel):
    rol: str = Field(..., pattern="^(admin|estudiante)$", description="Rol: 'admin' o 'estudiante'")

# Crear un item simple para categorias, ubicaciones u organizadores
class CatalogCreate(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100)

class CatalogItem(BaseModel):
    id: int
    nombre: str

# Datos para crear o actualizar un evento
class EventCreate(BaseModel):
    titulo: str = Field(..., min_length=3, max_length=150)
    descripcion: Optional[str] = ""
    fecha: str = Field(..., description="Fecha y hora en formato YYYY-MM-DD HH:MM")
    ubicacion_id: Optional[int] = None
    categoria_id: Optional[int] = None
    organizador_id: Optional[int] = None

class EventUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    fecha: Optional[str] = None
    ubicacion_id: Optional[int] = None
    categoria_id: Optional[int] = None
    organizador_id: Optional[int] = None

# Para que un estudiante califique un evento (1 a 5)
class RatingCreate(BaseModel):
    evento_id: int
    puntuacion: int = Field(..., ge=1, le=5, description="Calificación de 1 a 5 estrellas")

# Para publicar un comentario sobre un evento
class CommentCreate(BaseModel):
    evento_id: int
    texto: str = Field(..., min_length=2, max_length=500, description="Comentario sobre la experiencia")

# Para enviar una sugerencia al colegio
class SuggestionCreate(BaseModel):
    texto: str = Field(..., min_length=5, max_length=1000, description="Texto de la sugerencia o propuesta")

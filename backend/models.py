from pydantic import BaseModel, Field
from typing import Optional

# ----------------- Modelos de Autenticación y Usuarios -----------------

class UserRegister(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100, description="Nombre completo del estudiante")
    email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", description="Correo electrónico institucional o personal")
    password: str = Field(..., min_length=6, description="Contraseña de al menos 6 caracteres")

class UserLogin(BaseModel):
    email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str

class UserResponse(BaseModel):
    id: int
    nombre: str
    email: str
    rol: str

class UserUpdateRole(BaseModel):
    rol: str = Field(..., pattern="^(admin|estudiante)$", description="Rol: 'admin' o 'estudiante'")

# ----------------- Modelos de Catálogos -----------------

class CatalogCreate(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100)

class CatalogItem(BaseModel):
    id: int
    nombre: str

# ----------------- Modelos de Eventos -----------------

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

# ----------------- Modelos de Interacción de Estudiantes -----------------

class RatingCreate(BaseModel):
    evento_id: int
    puntuacion: int = Field(..., ge=1, le=5, description="Calificación de 1 a 5 estrellas")

class CommentCreate(BaseModel):
    evento_id: int
    texto: str = Field(..., min_length=2, max_length=500, description="Comentario sobre la experiencia")

class SuggestionCreate(BaseModel):
    texto: str = Field(..., min_length=5, max_length=1000, description="Texto de la sugerencia o propuesta")

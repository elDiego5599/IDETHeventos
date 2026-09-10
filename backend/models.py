import re

# Validaciones manuales para Flask (reemplazan a los modelos Pydantic de FastAPI).
# Cada funcion recibe el JSON del request y devuelve (datos_limpios, mensaje_error).
# Si todo esta bien, mensaje_error es None. Si algo falla, datos_limpios es None
# y mensaje_error explica el problema para mostrarlo en el frontend.

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _texto(valor, minimo=0, maximo=None, obligatorio=True):
    if valor is None:
        return (None, True) if not obligatorio else (None, False)
    s = str(valor).strip()
    if not s:
        return (None, True) if not obligatorio else (None, False)
    if len(s) < minimo:
        return None, False
    if maximo is not None and len(s) > maximo:
        return None, False
    return s, True


def validar_registro(data):
    # Valida los datos para registrar un usuario nuevo
    if not isinstance(data, dict):
        return None, "Datos invalidos."
    nombre, ok = _texto(data.get("nombre"), minimo=2, maximo=100)
    if not ok or not nombre:
        return None, "El nombre debe tener entre 2 y 100 caracteres."
    email = str(data.get("email") or "").lower().strip()
    if not EMAIL_RE.match(email):
        return None, "El correo no es valido."
    password = str(data.get("password") or "")
    if len(password) < 6:
        return None, "La contrasena debe tener al menos 6 caracteres."
    return {"nombre": nombre, "email": email, "password": password}, None


def validar_login(data):
    # Valida los datos para iniciar sesion
    if not isinstance(data, dict):
        return None, "Datos invalidos."
    email = str(data.get("email") or "").lower().strip()
    if not EMAIL_RE.match(email):
        return None, "El correo no es valido."
    password = str(data.get("password") or "")
    if not password:
        return None, "La contrasena es obligatoria."
    return {"email": email, "password": password}, None


def validar_rol(data):
    # Valida el cambio de rol de un usuario
    if not isinstance(data, dict):
        return None, "Datos invalidos."
    rol = str(data.get("rol") or "").strip()
    if rol not in ("admin", "estudiante"):
        return None, "El rol debe ser 'admin' o 'estudiante'."
    return {"rol": rol}, None


def validar_catalogo(data):
    # Valida crear categorias, ubicaciones y organizadores (todos usan lo mismo)
    if not isinstance(data, dict):
        return None, "Datos invalidos."
    nombre, ok = _texto(data.get("nombre"), minimo=2, maximo=100)
    if not ok or not nombre:
        return None, "El nombre debe tener entre 2 y 100 caracteres."
    return {"nombre": nombre}, None


def validar_evento_crear(data):
    # Valida los datos para crear un evento nuevo
    if not isinstance(data, dict):
        return None, "Datos invalidos."
    titulo, ok = _texto(data.get("titulo"), minimo=3, maximo=150)
    if not ok or not titulo:
        return None, "El titulo debe tener entre 3 y 150 caracteres."
    fecha = str(data.get("fecha") or "").strip()
    if not fecha:
        return None, "La fecha es obligatoria (formato YYYY-MM-DD HH:MM)."

    def _entero_o_none(v):
        if v is None or v == "":
            return None
        try:
            return int(v)
        except (TypeError, ValueError):
            return "invalido"

    ubicacion_id = _entero_o_none(data.get("ubicacion_id"))
    categoria_id = _entero_o_none(data.get("categoria_id"))
    organizador_id = _entero_o_none(data.get("organizador_id"))
    if "invalido" in (ubicacion_id, categoria_id, organizador_id):
        return None, "Categoria, ubicacion u organizador invalidos."

    descripcion = str(data.get("descripcion") or "").strip()
    imagen_url = str(data.get("imagen_url") or "").strip() or None
    frase = str(data.get("frase_motivacional") or "").strip() or None
    resumen = str(data.get("resumen_pasado") or "").strip() or None

    return {
        "titulo": titulo,
        "descripcion": descripcion,
        "fecha": fecha,
        "ubicacion_id": ubicacion_id,
        "categoria_id": categoria_id,
        "organizador_id": organizador_id,
        "imagen_url": imagen_url,
        "frase_motivacional": frase,
        "permite_voluntarios": bool(data.get("permite_voluntarios")),
        "resumen_pasado": resumen,
    }, None


def validar_inscripcion(data):
    # Valida la inscripcion a un evento (asistente o voluntario/participante activo)
    data = data or {}
    if not isinstance(data, dict):
        return None, "Datos invalidos."
    tipo = str(data.get("tipo_participacion") or "asistente").strip() or "asistente"
    detalle = str(data.get("detalle_participacion") or "").strip() or None
    return {"tipo_participacion": tipo, "detalle_participacion": detalle}, None


def validar_calificacion(data):
    # Valida calificar un evento con estrellas de 1 a 5
    if not isinstance(data, dict):
        return None, "Datos invalidos."
    try:
        evento_id = int(data.get("evento_id"))
    except (TypeError, ValueError):
        return None, "El evento no es valido."
    try:
        puntuacion = int(data.get("puntuacion"))
    except (TypeError, ValueError):
        return None, "La puntuacion debe ser un numero del 1 al 5."
    if puntuacion < 1 or puntuacion > 5:
        return None, "La puntuacion debe estar entre 1 y 5."
    return {"evento_id": evento_id, "puntuacion": puntuacion}, None


def validar_comentario(data):
    # Valida dejar un comentario en un evento
    if not isinstance(data, dict):
        return None, "Datos invalidos."
    try:
        evento_id = int(data.get("evento_id"))
    except (TypeError, ValueError):
        return None, "El evento no es valido."
    texto, ok = _texto(data.get("texto"), minimo=2, maximo=500)
    if not ok or not texto:
        return None, "El comentario debe tener entre 2 y 500 caracteres."
    return {"evento_id": evento_id, "texto": texto}, None


def validar_sugerencia(data):
    # Valida enviar una sugerencia general al colegio
    if not isinstance(data, dict):
        return None, "Datos invalidos."
    texto, ok = _texto(data.get("texto"), minimo=5, maximo=1000)
    if not ok or not texto:
        return None, "La sugerencia debe tener entre 5 y 1000 caracteres."
    return {"texto": texto}, None


def validar_reporte(data):
    # Valida reportar problemas o inconvenientes
    if not isinstance(data, dict):
        return None, "Datos invalidos."
    evento_id = data.get("evento_id")
    if evento_id is not None and evento_id != "":
        try:
            evento_id = int(evento_id)
        except (TypeError, ValueError):
            return None, "El evento no es valido."
    else:
        evento_id = None
    tipo, ok1 = _texto(data.get("tipo_problema"), minimo=3, maximo=100)
    desc, ok2 = _texto(data.get("descripcion"), minimo=5, maximo=1000)
    if not ok1 or not tipo:
        return None, "El tipo de problema debe tener entre 3 y 100 caracteres."
    if not ok2 or not desc:
        return None, "La descripcion debe tener entre 5 y 1000 caracteres."
    return {"evento_id": evento_id, "tipo_problema": tipo, "descripcion": desc}, None


def validar_reporte_estado(data):
    # Valida que el admin actualice el estado del problema
    if not isinstance(data, dict):
        return None, "Datos invalidos."
    estado = str(data.get("estado") or "").strip()
    if estado not in ("pendiente", "en revision", "resuelto"):
        return None, "El estado debe ser 'pendiente', 'en revision' o 'resuelto'."
    return {"estado": estado}, None


def validar_encuesta(data):
    # Valida que el admin cree una encuesta escolar
    if not isinstance(data, dict):
        return None, "Datos invalidos."
    try:
        evento_id = int(data.get("evento_id"))
    except (TypeError, ValueError):
        return None, "El evento no es valido."
    titulo, ok0 = _texto(data.get("titulo"), minimo=3, maximo=150)
    p1, ok1 = _texto(data.get("pregunta_1"), minimo=3, maximo=255)
    o1, ok2 = _texto(data.get("opciones_1"), minimo=3, maximo=255)
    if not ok0 or not titulo:
        return None, "El titulo debe tener entre 3 y 150 caracteres."
    if not ok1 or not p1:
        return None, "La pregunta 1 es obligatoria."
    if not ok2 or not o1:
        return None, "Las opciones de la pregunta 1 son obligatorias (separadas por coma)."
    p2 = str(data.get("pregunta_2") or "").strip() or None
    o2 = str(data.get("opciones_2") or "").strip() or None
    pa, ok3 = _texto(data.get("pregunta_abierta"), minimo=3, maximo=255)
    if not ok3 or not pa:
        return None, "La pregunta abierta es obligatoria."
    return {
        "evento_id": evento_id,
        "titulo": titulo,
        "pregunta_1": p1,
        "opciones_1": o1,
        "pregunta_2": p2,
        "opciones_2": o2,
        "pregunta_abierta": pa,
    }, None


def validar_respuesta_encuesta(data):
    # Valida que el estudiante responda una encuesta
    if not isinstance(data, dict):
        return None, "Datos invalidos."
    r1, ok1 = _texto(data.get("respuesta_1"), minimo=1, maximo=100)
    if not ok1 or not r1:
        return None, "La respuesta 1 es obligatoria."
    r2 = str(data.get("respuesta_2") or "").strip() or None
    ra = str(data.get("respuesta_abierta") or "").strip() or None
    return {"respuesta_1": r1, "respuesta_2": r2, "respuesta_abierta": ra}, None

import os
import re
import pandas as pd
from datetime import datetime, timedelta
from services.ocr import extraer_texto_pdf

# ── Rutas
BASE_DIR = os.path.join("resource", "curp")
EXCEL_FILE = os.path.join(BASE_DIR, "registros_personas.xlsx")
DIR_VALIDOS = os.path.join(BASE_DIR, "curp_validos")
DIR_REVISION = os.path.join(BASE_DIR, "curp_revision")

for d in (BASE_DIR, DIR_VALIDOS, DIR_REVISION):
    os.makedirs(d, exist_ok=True)

# ── Columnas del Excel
COLUMNAS = [
    "CURP",
    "Nombre",
    "ApellidoPaterno",
    "ApellidoMaterno",
    "Edad",
    "FechaNacimiento",
    "FechaNacimientoLarga",
    "Sexo",
    "Estado",
    "Validado",  # True / False
    "Expirado",  # True / False — PDF expirado, pedir uno nuevo
    "ArchivoActual",  # nombre del PDF válido más reciente
    "HistorialArchivos",  # todos los PDFs válidos separados por |
    "FechaRegistro",  # fecha de registro de datos
    "FechaValidacion",  # fecha en que se validó el último PDF
    "Observaciones",
]

# ── Días antes de expirar
DIAS_EXPIRACION = 7

# ── Regex CURP
PATRON_CURP = re.compile(
    r"[A-Z]{1}[AEIOU]{1}[A-Z]{2}\d{2}"
    r"(0[1-9]|1[0-2])"
    r"(0[1-9]|[12]\d|3[01])"
    r"[HM]{1}"
    r"(AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)"
    r"[B-DF-HJ-NP-TV-Z]{3}"
    r"[A-Z\d]{1}\d{1}",
    re.IGNORECASE,
)


def validar_formato_curp(curp: str) -> bool:
    return bool(re.fullmatch(PATRON_CURP.pattern, curp.strip().upper(), re.IGNORECASE))


# ─────────────────────────────────────────
#  EXCEL
# ─────────────────────────────────────────
# Columnas que deben ser siempre string
_COLUMNAS_STR = [
    "CURP",
    "Nombre",
    "ApellidoPaterno",
    "ApellidoMaterno",
    "Edad",
    "FechaNacimiento",
    "FechaNacimientoLarga",
    "Sexo",
    "Estado",
    "ArchivoActual",
    "HistorialArchivos",
    "FechaRegistro",
    "FechaValidacion",
    "Observaciones",
]


def _leer_excel() -> pd.DataFrame:
    if os.path.exists(EXCEL_FILE):
        df = pd.read_excel(EXCEL_FILE)
        # Agregar columnas faltantes (archivos viejos)
        for col in COLUMNAS:
            if col not in df.columns:
                df[col] = ""
    else:
        df = pd.DataFrame(columns=COLUMNAS)

    # Forzar dtype string en columnas de texto para evitar FutureWarning de pandas
    for col in _COLUMNAS_STR:
        if col in df.columns:
            df[col] = df[col].astype(str).replace("nan", "")

    return df


def _guardar_excel(df: pd.DataFrame):
    df.to_excel(EXCEL_FILE, index=False)


def buscar_curp(curp: str) -> dict | None:
    df = _leer_excel()
    fila = df[df["CURP"].str.upper() == curp.strip().upper()]
    if fila.empty:
        return None
    return fila.iloc[0].to_dict()


# ─────────────────────────────────────────
#  LIMPIEZA — se llama al arrancar Flask
# ─────────────────────────────────────────
def limpiar_expirados():
    """
    Marca como Expirado=True los registros cuyo PDF tiene más de
    DIAS_EXPIRACION días. Borra físicamente los PDFs de curp_revision
    que tengan más de ese tiempo.
    """
    df = _leer_excel()
    if df.empty:
        return

    ahora = datetime.now()
    limite = ahora - timedelta(days=DIAS_EXPIRACION)
    cambiado = False

    for i, fila in df.iterrows():
        fecha_val = fila.get("FechaValidacion")
        if not fecha_val or str(fecha_val).strip() in ("", "nan"):
            continue
        try:
            fecha_dt = datetime.strptime(str(fecha_val)[:16], "%Y-%m-%d %H:%M")
        except ValueError:
            continue

        if fecha_dt < limite and not fila.get("Expirado"):
            df.at[i, "Expirado"] = True
            cambiado = True

    if cambiado:
        _guardar_excel(df)

    # Borrar PDFs de revisión con más de DIAS_EXPIRACION días
    for nombre in os.listdir(DIR_REVISION):
        ruta = os.path.join(DIR_REVISION, nombre)
        try:
            mtime = datetime.fromtimestamp(os.path.getmtime(ruta))
            if mtime < limite:
                os.remove(ruta)
        except Exception:
            pass


# ─────────────────────────────────────────
#  PASO 1 — REGISTRAR DATOS BÁSICOS
# ─────────────────────────────────────────
def registrar_datos(datos_form: dict) -> dict:
    curp = datos_form.get("curp", "").strip().upper()

    if not validar_formato_curp(curp):
        return {"status": "Error", "msg": "Formato de CURP inválido."}

    existente = buscar_curp(curp)
    if existente:
        return {
            "status": "Duplicado",
            "msg": "Esta CURP ya está registrada.",
            "datos": existente,
        }

    fila = {
        "CURP": curp,
        "Nombre": datos_form.get("nombre", "").strip(),
        "ApellidoPaterno": datos_form.get("apellido_paterno", "").strip(),
        "ApellidoMaterno": datos_form.get("apellido_materno", "").strip(),
        "Edad": datos_form.get("edad", "").strip(),
        "FechaNacimiento": "",
        "FechaNacimientoLarga": "",
        "Sexo": "",
        "Estado": "",
        "Validado": False,
        "Expirado": False,
        "ArchivoActual": "",
        "HistorialArchivos": "",
        "FechaRegistro": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "FechaValidacion": "",
        "Observaciones": "",
    }

    df = _leer_excel()
    df = pd.concat([df, pd.DataFrame([fila])], ignore_index=True)
    _guardar_excel(df)

    return {
        "status": "Éxito",
        "msg": "Datos registrados. Ahora sube tu documento PDF de CURP.",
        "datos": fila,
    }


# ─────────────────────────────────────────
#  PASO 2 — EXTRAER DATOS DEL PDF
# ─────────────────────────────────────────
MESES = {
    "01": "enero",
    "02": "febrero",
    "03": "marzo",
    "04": "abril",
    "05": "mayo",
    "06": "junio",
    "07": "julio",
    "08": "agosto",
    "09": "septiembre",
    "10": "octubre",
    "11": "noviembre",
    "12": "diciembre",
}

# Claves de estado en la CURP → nombre completo
ESTADOS_CURP = {
    "AS": "Aguascalientes",
    "BC": "Baja California",
    "BS": "Baja California Sur",
    "CC": "Campeche",
    "CL": "Colima",
    "CM": "Campeche",
    "CS": "Chiapas",
    "CH": "Chihuahua",
    "DF": "Ciudad de México",
    "DG": "Durango",
    "GT": "Guanajuato",
    "GR": "Guerrero",
    "HG": "Hidalgo",
    "JC": "Jalisco",
    "MC": "Estado de México",
    "MN": "Michoacán",
    "MS": "Morelos",
    "NT": "Nayarit",
    "NL": "Nuevo León",
    "OC": "Oaxaca",
    "PL": "Puebla",
    "QT": "Querétaro",
    "QR": "Quintana Roo",
    "SP": "San Luis Potosí",
    "SL": "Sinaloa",
    "SR": "Sonora",
    "TC": "Tabasco",
    "TS": "Tamaulipas",
    "TL": "Tlaxcala",
    "VZ": "Veracruz",
    "YN": "Yucatán",
    "ZS": "Zacatecas",
    "NE": "Nacido en el extranjero",
}


def decodificar_curp(curp: str) -> dict:
    """
    Extrae fecha de nacimiento, sexo y estado directamente de la CURP.
    Devuelve fechas en dos formatos:
      - fecha_nacimiento:       "01/10/2005"  (para el Excel)
      - fecha_nacimiento_larga: "01 de octubre de 2005" (para mostrar en pantalla)
    """
    curp = curp.strip().upper()
    if len(curp) < 16:
        return {}

    anio_corto = curp[4:6]  # "05"
    mes = curp[6:8]  # "10"
    dia = curp[8:10]  # "01"
    sexo_letra = curp[10]  # "H" o "M"
    clave_edo = curp[11:13]  # "NE"

    # Año completo: CURP usa 2 dígitos → 00-99
    # Convenio oficial: ≥ 00 y ≤ 99
    # Si el año ≥ 00 y ≤ 24 → nació en 2000s, si > 24 → 1900s
    anio_num = int(anio_corto)
    anio = str(2000 + anio_num) if anio_num <= 24 else str(1900 + anio_num)

    fecha_corta = f"{dia}/{mes}/{anio}"
    mes_nombre = MESES.get(mes, mes)
    fecha_larga = f"{int(dia)} de {mes_nombre} de {anio}"

    sexo = "Hombre" if sexo_letra == "H" else "Mujer"
    estado = ESTADOS_CURP.get(clave_edo, clave_edo)

    return {
        "fecha_nacimiento": fecha_corta,
        "fecha_nacimiento_larga": fecha_larga,
        "sexo": sexo,
        "sexo_clave": sexo_letra,
        "estado": estado,
        "clave_estado": clave_edo,
    }


def _extraer_datos_pdf(texto: str) -> dict:
    datos = {
        "fecha_nacimiento": None,
        "sexo": None,
        "estado": None,
        "curp_encontrada": None,
    }

    match_curp = PATRON_CURP.search(texto.upper())
    if match_curp:
        datos["curp_encontrada"] = match_curp.group(0).upper()
        # Decodificar fecha, sexo y estado directo de la CURP
        decoded = decodificar_curp(datos["curp_encontrada"])
        datos["fecha_nacimiento"] = decoded.get("fecha_nacimiento")
        datos["fecha_nacimiento_larga"] = decoded.get("fecha_nacimiento_larga")
        datos["sexo"] = decoded.get("sexo")
        datos["estado"] = decoded.get("estado")

    return datos


# ─────────────────────────────────────────
#  PASO 3 — VALIDAR PDF (sin IA)
# ─────────────────────────────────────────
def procesar_y_validar_pdf(curp: str, pdf_bytes: bytes) -> dict:
    curp = curp.strip().upper()

    registro = buscar_curp(curp)
    if not registro:
        return {
            "status": "Error",
            "msg": "CURP no registrada. Registra tus datos primero.",
        }

    resultado_ocr = extraer_texto_pdf(pdf_bytes)
    metodo = resultado_ocr["metodo"]
    texto = resultado_ocr["texto"]

    # OCR falló — guardar en revisión pero NO tocar el Excel
    if metodo == "ocr_fallido" or not texto.strip():
        _guardar_pdf_revision(pdf_bytes, curp)
        return {
            "status": "Revision",
            "msg": "No se pudo leer el documento. Intenta con un PDF de mejor calidad.",
            "metodo": metodo,
        }

    # Buscar CURP en el texto
    datos_pdf = _extraer_datos_pdf(texto)
    curp_en_pdf = datos_pdf.get("curp_encontrada")

    if not curp_en_pdf or curp_en_pdf != curp:
        _guardar_pdf_revision(pdf_bytes, curp)
        return {
            "status": "Revision",
            "msg": "La CURP del documento no coincide con tus datos registrados.",
            "metodo": metodo,
        }

    # ── Válido
    nombre_archivo = _guardar_pdf_valido(pdf_bytes, curp)
    datos_finales = _marcar_validado(curp, nombre_archivo, metodo, datos_pdf)

    return {
        "status": "Éxito",
        "msg": "Documento validado correctamente.",
        "datos": datos_finales,
        "archivo": nombre_archivo,
        "metodo": metodo,
    }


# ─────────────────────────────────────────
#  HELPERS — GUARDAR PDF
# ─────────────────────────────────────────
def _guardar_pdf_valido(pdf_bytes: bytes, curp: str) -> str:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nombre = f"{curp}_{timestamp}.pdf"
    with open(os.path.join(DIR_VALIDOS, nombre), "wb") as f:
        f.write(pdf_bytes)
    return nombre


def _guardar_pdf_revision(pdf_bytes: bytes, curp: str) -> str:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nombre = f"{curp}_{timestamp}.pdf"
    with open(os.path.join(DIR_REVISION, nombre), "wb") as f:
        f.write(pdf_bytes)
    return nombre


# ─────────────────────────────────────────
#  HELPERS — ACTUALIZAR EXCEL
# ─────────────────────────────────────────
def _marcar_validado(curp: str, nombre_archivo: str, metodo: str, extras: dict) -> dict:
    df = _leer_excel()
    idx = df[df["CURP"].str.upper() == curp].index
    if idx.empty:
        return {}

    i = idx[0]

    # Historial: solo añadir si no está ya
    historial_actual = str(df.at[i, "HistorialArchivos"] or "")
    archivos_lista = [a for a in historial_actual.split("|") if a and a != "nan"]
    if nombre_archivo not in archivos_lista:
        archivos_lista.append(nombre_archivo)
    df.at[i, "HistorialArchivos"] = "|".join(archivos_lista)

    # Archivo actual → siempre el más reciente válido
    df.at[i, "ArchivoActual"] = nombre_archivo
    df.at[i, "Validado"] = True
    df.at[i, "Expirado"] = False
    df.at[i, "FechaValidacion"] = datetime.now().strftime("%Y-%m-%d %H:%M")
    df.at[i, "Observaciones"] = f"Validado por lectura {metodo}"

    if extras.get("fecha_nacimiento"):
        df.at[i, "FechaNacimiento"] = extras["fecha_nacimiento"]
    if extras.get("fecha_nacimiento_larga"):
        df.at[i, "FechaNacimientoLarga"] = extras["fecha_nacimiento_larga"]
    if extras.get("sexo"):
        df.at[i, "Sexo"] = extras["sexo"]
    if extras.get("estado"):
        df.at[i, "Estado"] = extras["estado"]

    _guardar_excel(df)
    return df.iloc[i].to_dict()


# ─────────────────────────────────────────
#  PASO 4 — EDITAR DATOS
# ─────────────────────────────────────────
def editar_datos(curp: str, datos_nuevos: dict) -> dict:
    curp = curp.strip().upper()
    df = _leer_excel()
    idx = df[df["CURP"].str.upper() == curp].index

    if idx.empty:
        return {"status": "Error", "msg": "CURP no encontrada."}

    i = idx[0]
    for campo, col in [
        ("nombre", "Nombre"),
        ("apellido_paterno", "ApellidoPaterno"),
        ("apellido_materno", "ApellidoMaterno"),
        ("edad", "Edad"),
    ]:
        if datos_nuevos.get(campo):
            df.at[i, col] = datos_nuevos[campo].strip()

    _guardar_excel(df)
    return {
        "status": "Éxito",
        "msg": "Datos actualizados.",
        "datos": df.iloc[i].to_dict(),
    }


# ─────────────────────────────────────────
#  OBTENER PDF VÁLIDO MÁS RECIENTE
# ─────────────────────────────────────────
def obtener_pdf_valido(curp: str) -> str | None:
    datos = buscar_curp(curp)
    if not datos:
        return None

    # Intentar con ArchivoActual primero
    archivo_actual = str(datos.get("ArchivoActual") or "").strip()
    if archivo_actual:
        ruta = os.path.join(DIR_VALIDOS, archivo_actual)
        if os.path.exists(ruta):
            return ruta

    # Fallback: recorrer historial de más reciente a más antiguo
    historial = str(datos.get("HistorialArchivos") or "")
    for nombre in reversed([a for a in historial.split("|") if a]):
        ruta = os.path.join(DIR_VALIDOS, nombre)
        if os.path.exists(ruta):
            return ruta

    return None

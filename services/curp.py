import os
import re
import pandas as pd
from datetime import datetime
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
    "Sexo",
    "Estado",
    "Validado",  # True / False
    "ArchivosValidados",  # historial separado por |
    "FechaRegistro",
    "Observaciones",
]

# ── Regex CURP oficial
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
def _leer_excel() -> pd.DataFrame:
    if os.path.exists(EXCEL_FILE):
        return pd.read_excel(EXCEL_FILE)
    return pd.DataFrame(columns=COLUMNAS)


def _guardar_excel(df: pd.DataFrame):
    df.to_excel(EXCEL_FILE, index=False)


def buscar_curp(curp: str) -> dict | None:
    df = _leer_excel()
    fila = df[df["CURP"].str.upper() == curp.strip().upper()]
    if fila.empty:
        return None
    return fila.iloc[0].to_dict()


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
        "Sexo": "",
        "Estado": "",
        "Validado": False,
        "ArchivosValidados": "",
        "FechaRegistro": datetime.now().strftime("%Y-%m-%d %H:%M"),
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
def _extraer_datos_pdf(texto: str) -> dict:
    datos = {
        "fecha_nacimiento": None,
        "sexo": None,
        "estado": None,
        "curp_encontrada": None,
    }

    # CURP en el texto
    match_curp = PATRON_CURP.search(texto.upper())
    if match_curp:
        datos["curp_encontrada"] = match_curp.group(0).upper()

    # Fecha de nacimiento (formatos: DD/MM/AAAA, DD-MM-AAAA, DDMMAAAA)
    match_fecha = re.search(r"\b(\d{2})[/\-](\d{2})[/\-](\d{4})\b", texto)
    if match_fecha:
        datos["fecha_nacimiento"] = (
            f"{match_fecha.group(1)}/{match_fecha.group(2)}/{match_fecha.group(3)}"
        )

    # Sexo
    if re.search(r"\bHOMBRE\b|\bMASCULINO\b", texto.upper()):
        datos["sexo"] = "H"
    elif re.search(r"\bMUJER\b|\bFEMENINO\b", texto.upper()):
        datos["sexo"] = "M"

    # Estado (clave de 2 letras después de "ESTADO:" o similar)
    match_estado = re.search(r"(?:ESTADO|ENTIDAD)[:\s]+([A-Z]{2})\b", texto.upper())
    if match_estado:
        datos["estado"] = match_estado.group(1)

    return datos


# ─────────────────────────────────────────
#  PASO 3 — VALIDAR PDF (sin IA)
# ─────────────────────────────────────────
def procesar_y_validar_pdf(curp: str, pdf_bytes: bytes) -> dict:
    """
    Lee el PDF, busca la CURP del usuario en el texto.
    - Si la encuentra → válido
    - Si OCR falló   → revisión
    - Si no coincide → revisión
    """
    curp = curp.strip().upper()

    registro = buscar_curp(curp)
    if not registro:
        return {
            "status": "Error",
            "msg": "CURP no registrada. Registra tus datos primero.",
        }

    # Extraer texto
    resultado_ocr = extraer_texto_pdf(pdf_bytes)
    metodo = resultado_ocr["metodo"]
    texto = resultado_ocr["texto"]

    # OCR falló completamente → revisión directa
    if metodo == "ocr_fallido" or not texto.strip():
        nombre_archivo = _guardar_pdf(pdf_bytes, curp, valido=False)
        _actualizar_excel(
            curp,
            valido=False,
            observacion="OCR fallido — revisión manual requerida",
            archivo=nombre_archivo,
        )
        return {
            "status": "Revision",
            "msg": "No se pudo leer el documento. Será revisado manualmente.",
            "metodo": metodo,
        }

    # Buscar la CURP del usuario en el texto
    datos_pdf = _extraer_datos_pdf(texto)
    curp_en_pdf = datos_pdf.get("curp_encontrada")

    if not curp_en_pdf or curp_en_pdf != curp:
        nombre_archivo = _guardar_pdf(pdf_bytes, curp, valido=False)
        _actualizar_excel(
            curp,
            valido=False,
            observacion="CURP no encontrada o no coincide con el registro",
            archivo=nombre_archivo,
        )
        return {
            "status": "Revision",
            "msg": "La CURP del documento no coincide con tus datos registrados.",
            "metodo": metodo,
        }

    # ── Válido: guardar y actualizar Excel
    nombre_archivo = _guardar_pdf(pdf_bytes, curp, valido=True)
    datos_finales = _actualizar_excel(
        curp,
        valido=True,
        observacion=f"Validado por OCR ({metodo})",
        archivo=nombre_archivo,
        extras=datos_pdf,
    )

    return {
        "status": "Éxito",
        "msg": "Documento validado correctamente.",
        "datos": datos_finales,
        "archivo": nombre_archivo,
        "metodo": metodo,
    }


# ─────────────────────────────────────────
#  HELPERS — PDF y Excel
# ─────────────────────────────────────────
def _guardar_pdf(pdf_bytes: bytes, curp: str, valido: bool) -> str:
    carpeta = DIR_VALIDOS if valido else DIR_REVISION
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nombre = f"{curp.upper()}_{timestamp}.pdf"
    ruta = os.path.join(carpeta, nombre)
    with open(ruta, "wb") as f:
        f.write(pdf_bytes)
    return nombre


def _actualizar_excel(
    curp: str, valido: bool, observacion: str, archivo: str, extras: dict = None
) -> dict:
    df = _leer_excel()
    idx = df[df["CURP"].str.upper() == curp].index
    if idx.empty:
        return {}

    i = idx[0]

    # Historial de archivos
    historial = str(df.at[i, "ArchivosValidados"] or "")
    df.at[i, "ArchivosValidados"] = (historial + "|" + archivo).strip("|")

    df.at[i, "Validado"] = valido
    df.at[i, "Observaciones"] = observacion

    # Datos extra extraídos del PDF
    if extras and valido:
        if extras.get("fecha_nacimiento"):
            df.at[i, "FechaNacimiento"] = extras["fecha_nacimiento"]
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
#  OBTENER PDF MÁS RECIENTE VALIDADO
# ─────────────────────────────────────────
def obtener_pdf_valido(curp: str) -> str | None:
    datos = buscar_curp(curp)
    if not datos:
        return None

    historial = str(datos.get("ArchivosValidados") or "")
    archivos = [a for a in historial.split("|") if a]

    for nombre in reversed(archivos):
        ruta = os.path.join(DIR_VALIDOS, nombre)
        if os.path.exists(ruta):
            return ruta

    return None

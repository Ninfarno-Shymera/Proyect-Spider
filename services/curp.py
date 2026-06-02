"""
services/curp.py
────────────────────────────────────────────
Lógica de negocio para el módulo de Registro de Personas.

Flujo:
  1. Registrar datos básicos (sin PDF) → guarda en Excel
  2. Subir PDF → OCR si es necesario → validar con IA (Gemini)
  3. Si es válido  → guardar en curp_validos/, marcar registro como validado
  4. Si no válido  → guardar en curp_revision/, pedir nuevo PDF
  5. Editar datos  → conserva historial de PDFs anteriores

Carpetas:
  resource/curp/registros_personas.xlsx
  resource/curp/curp_validos/
  resource/curp/curp_revision/
"""

import os
import re
import json
import base64
import httpx
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv
from services.ocr import extraer_texto_pdf

load_dotenv()

# ── API Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_API = (
    "https://generativelanguage.googleapis.com/v1beta/models"
    "/gemini-1.5-flash:generateContent"
)

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
    "Validado",  # True / False / ""
    "ArchivosValidados",  # lista separada por | para historial
    "FechaRegistro",
    "Observaciones",
]

# ── Regex CURP oficial
PATRON_CURP = re.compile(
    r"^[A-Z]{1}[AEIOU]{1}[A-Z]{2}\d{2}"
    r"(0[1-9]|1[0-2])"
    r"(0[1-9]|[12]\d|3[01])"
    r"[HM]{1}"
    r"(AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)"
    r"[B-DF-HJ-NP-TV-Z]{3}"
    r"[A-Z\d]{1}\d{1}$",
    re.IGNORECASE,
)


def validar_formato_curp(curp: str) -> bool:
    return bool(PATRON_CURP.match(curp.strip().upper()))


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
#  PASO 1 — REGISTRAR DATOS BÁSICOS (sin PDF)
# ─────────────────────────────────────────
def registrar_datos(datos_form: dict) -> dict:
    """
    Guarda nombre, apellidos, edad y CURP en el Excel.
    No requiere PDF todavía.
    """
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
#  PASO 2 — PROCESAR PDF
# ─────────────────────────────────────────
def procesar_pdf_curp(curp: str, pdf_bytes: bytes) -> dict:
    """
    Intenta leer el PDF (nativo → OCR → fallo).
    Devuelve el texto extraído y el método usado.
    """
    curp = curp.strip().upper()

    if not buscar_curp(curp):
        return {
            "status": "Error",
            "msg": "CURP no registrada. Registra tus datos primero.",
        }

    resultado_ocr = extraer_texto_pdf(pdf_bytes)
    metodo = resultado_ocr["metodo"]  # "nativo" | "ocr" | "ocr_fallido"
    texto = resultado_ocr["texto"]

    return {
        "status": "Éxito",
        "metodo": metodo,
        "texto": texto,
        "pdf_bytes": pdf_bytes,  # se pasa al siguiente paso
    }


# ─────────────────────────────────────────
#  PASO 3 — VALIDAR CON IA (Gemini)
# ─────────────────────────────────────────
PROMPT_VALIDACION = """
Eres un validador de documentos oficiales mexicanos.
Analiza el documento adjunto y el texto extraído que se te proporciona.

Método de extracción usado: {metodo}
Texto extraído:
{texto}

Responde ÚNICAMENTE con un objeto JSON (sin markdown, sin explicaciones):
{{
  "es_curp_oficial": true | false,
  "curp": "<18 caracteres o null>",
  "nombre": "<texto o null>",
  "apellido_paterno": "<texto o null>",
  "apellido_materno": "<texto o null>",
  "fecha_nacimiento": "<DD/MM/AAAA o null>",
  "sexo": "H" | "M" | null,
  "estado": "<clave 2 letras o null>",
  "motivo_rechazo": "<texto breve si es_curp_oficial=false, sino null>"
}}
""".strip()


def validar_con_ia(pdf_bytes: bytes, texto: str, metodo: str) -> dict:
    if not GEMINI_API_KEY:
        return {
            "es_curp_oficial": False,
            "motivo_rechazo": "GEMINI_API_KEY no configurada.",
            "curp": None,
            "nombre": None,
            "apellido_paterno": None,
            "apellido_materno": None,
            "fecha_nacimiento": None,
            "sexo": None,
            "estado": None,
        }

    pdf_b64 = base64.standard_b64encode(pdf_bytes).decode()
    prompt = PROMPT_VALIDACION.format(metodo=metodo, texto=texto[:3000])

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "inline_data": {
                            "mime_type": "application/pdf",
                            "data": pdf_b64,
                        }
                    },
                    {"text": prompt},
                ]
            }
        ],
        "generationConfig": {"temperature": 0, "maxOutputTokens": 512},
    }

    try:
        resp = httpx.post(
            f"{GEMINI_API}?key={GEMINI_API_KEY}",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        resp.raise_for_status()
        raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        raw = re.sub(r"^```[a-z]*\n?|```$", "", raw, flags=re.MULTILINE).strip()
        return json.loads(raw)

    except Exception as e:
        return {
            "es_curp_oficial": False,
            "motivo_rechazo": f"Error al contactar IA: {e}",
            "curp": None,
            "nombre": None,
            "apellido_paterno": None,
            "apellido_materno": None,
            "fecha_nacimiento": None,
            "sexo": None,
            "estado": None,
        }


# ─────────────────────────────────────────
#  GUARDAR PDF (con historial)
# ─────────────────────────────────────────
def _guardar_pdf(pdf_bytes: bytes, curp: str, valido: bool) -> str:
    """
    Guarda el PDF con timestamp para conservar historial.
    Ejemplo: CURP_20260601_143022.pdf
    """
    carpeta = DIR_VALIDOS if valido else DIR_REVISION
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nombre = f"{curp.upper()}_{timestamp}.pdf"
    ruta = os.path.join(carpeta, nombre)
    with open(ruta, "wb") as f:
        f.write(pdf_bytes)
    return nombre


# ─────────────────────────────────────────
#  PASO 4 — GUARDAR RESULTADO
# ─────────────────────────────────────────
def guardar_resultado_pdf(curp: str, pdf_bytes: bytes, ia: dict, metodo: str) -> dict:
    """
    Tras la validación de la IA:
    - Si es oficial → actualiza Excel, guarda en curp_validos
    - Si no        → guarda en curp_revision, devuelve error al usuario
    """
    curp = curp.strip().upper()

    nombre_archivo = _guardar_pdf(pdf_bytes, curp, ia["es_curp_oficial"])

    df = _leer_excel()
    idx = df[df["CURP"].str.upper() == curp].index

    if idx.empty:
        return {"status": "Error", "msg": "CURP no encontrada en el registro."}

    i = idx[0]

    # ── Historial de archivos
    historial_actual = str(df.at[i, "ArchivosValidados"] or "")
    nuevo_historial = (historial_actual + "|" + nombre_archivo).strip("|")
    df.at[i, "ArchivosValidados"] = nuevo_historial

    if not ia["es_curp_oficial"]:
        df.at[i, "Observaciones"] = ia.get("motivo_rechazo", "Documento no aceptado")
        _guardar_excel(df)
        return {
            "status": "Revision",
            "msg": ia.get(
                "motivo_rechazo", "El documento no parece ser una CURP oficial."
            ),
            "archivo": nombre_archivo,
        }

    # ── Actualizar datos con lo que encontró la IA
    df.at[i, "FechaNacimiento"] = (
        ia.get("fecha_nacimiento") or df.at[i, "FechaNacimiento"]
    )
    df.at[i, "Sexo"] = ia.get("sexo") or df.at[i, "Sexo"]
    df.at[i, "Estado"] = ia.get("estado") or df.at[i, "Estado"]
    df.at[i, "Validado"] = True
    df.at[i, "Observaciones"] = f"Validado por IA ({metodo})"

    # Actualizar nombre si la IA lo encontró y el usuario no lo puso
    if ia.get("nombre"):
        df.at[i, "Nombre"] = ia["nombre"]
    if ia.get("apellido_paterno"):
        df.at[i, "ApellidoPaterno"] = ia["apellido_paterno"]
    if ia.get("apellido_materno"):
        df.at[i, "ApellidoMaterno"] = ia["apellido_materno"]

    _guardar_excel(df)

    datos_finales = df.iloc[i].to_dict()

    return {
        "status": "Éxito",
        "msg": "Documento validado correctamente.",
        "datos": datos_finales,
        "archivo": nombre_archivo,
        "metodo": metodo,
    }


# ─────────────────────────────────────────
#  PASO 5 — EDITAR DATOS
# ─────────────────────────────────────────
def editar_datos(curp: str, datos_nuevos: dict) -> dict:
    """
    Actualiza nombre, apellidos y edad. No toca el historial de PDFs.
    """
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
    """
    Devuelve la ruta del PDF válido más reciente, o None si no hay.
    """
    datos = buscar_curp(curp)
    if not datos:
        return None

    historial = str(datos.get("ArchivosValidados") or "")
    archivos = [a for a in historial.split("|") if a]

    # Solo los que están en curp_validos
    for nombre in reversed(archivos):
        ruta = os.path.join(DIR_VALIDOS, nombre)
        if os.path.exists(ruta):
            return ruta

    return None

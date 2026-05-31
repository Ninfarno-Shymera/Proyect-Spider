"""
services/curp.py
────────────────────────────────────────────
Lógica de negocio para el módulo de Registro de Personas.

  • Valida formato CURP con regex oficial
  • Llama a la API de Anthropic para verificar que el PDF sea
    un documento oficial de CURP y extrae los datos
  • Guarda registros en Excel (único por CURP)
  • Guarda PDFs en:
      resource/curp_validos/   → documentos aceptados
      resource/curp_revision/  → documentos rechazados / dudosos
"""

import os
import re
import json
import base64
import httpx
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

# ── Clave API desde .env o variable de entorno de Render
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_API = "https://api.anthropic.com/v1/messages"

# ── Rutas de recursos
BASE_DIR = os.path.join("resource")
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
    "ArchivoValidado",
    "Observaciones",
]

# ── Regex CURP oficial (18 caracteres)
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
#  VALIDACIÓN CON IA
# ─────────────────────────────────────────
PROMPT_SISTEMA = """
Eres un validador de documentos oficiales mexicanos.
Tu única tarea es analizar si el documento adjunto es un comprobante
oficial de CURP emitido por el RENAPO o equivalente gubernamental.

Responde ÚNICAMENTE con un objeto JSON (sin markdown, sin explicaciones):
{
  "es_curp_valido": true | false,
  "curp": "<18 caracteres o null>",
  "nombre": "<texto o null>",
  "apellido_paterno": "<texto o null>",
  "apellido_materno": "<texto o null>",
  "fecha_nacimiento": "<DD/MM/AAAA o null>",
  "sexo": "H" | "M" | null,
  "estado": "<clave 2 letras o null>",
  "motivo_rechazo": "<texto breve si es_curp_valido=false, si no null>"
}
""".strip()


def validar_con_ia(pdf_bytes: bytes) -> dict:
    """
    Envía el PDF a Claude y devuelve el JSON de respuesta.
    En caso de error devuelve es_curp_valido=False con motivo.
    """
    if not ANTHROPIC_API_KEY:
        return {
            "es_curp_valido": False,
            "motivo_rechazo": "ANTHROPIC_API_KEY no configurada.",
            "curp": None,
            "nombre": None,
            "apellido_paterno": None,
            "apellido_materno": None,
            "fecha_nacimiento": None,
            "sexo": None,
            "estado": None,
        }

    pdf_b64 = base64.standard_b64encode(pdf_bytes).decode()

    payload = {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 512,
        "system": PROMPT_SISTEMA,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": pdf_b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": "Analiza este documento y responde con el JSON indicado.",
                    },
                ],
            }
        ],
    }

    try:
        resp = httpx.post(
            ANTHROPIC_API,
            json=payload,
            headers={
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
            },
            timeout=30,
        )
        resp.raise_for_status()
        raw = resp.json()["content"][0]["text"].strip()
        raw = re.sub(r"^```[a-z]*\n?|```$", "", raw, flags=re.MULTILINE).strip()
        return json.loads(raw)
    except Exception as e:
        return {
            "es_curp_valido": False,
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
#  EXCEL — LECTURA / ESCRITURA
# ─────────────────────────────────────────
def _leer_excel() -> pd.DataFrame:
    if os.path.exists(EXCEL_FILE):
        return pd.read_excel(EXCEL_FILE)
    return pd.DataFrame(columns=COLUMNAS)


def _guardar_excel(df: pd.DataFrame):
    df.to_excel(EXCEL_FILE, index=False)


def buscar_curp(curp: str) -> dict | None:
    """Devuelve el registro como dict si existe, None si no."""
    df = _leer_excel()
    fila = df[df["CURP"].str.upper() == curp.strip().upper()]
    if fila.empty:
        return None
    return fila.iloc[0].to_dict()


# ─────────────────────────────────────────
#  GUARDAR PDF
# ─────────────────────────────────────────
def _guardar_pdf(pdf_bytes: bytes, curp: str, valido: bool) -> str:
    carpeta = DIR_VALIDOS if valido else DIR_REVISION
    nombre = f"{curp.upper()}.pdf"
    ruta = os.path.join(carpeta, nombre)
    with open(ruta, "wb") as f:
        f.write(pdf_bytes)
    return nombre


# ─────────────────────────────────────────
#  REGISTRO PRINCIPAL
# ─────────────────────────────────────────
def registrar_persona(datos_form: dict, pdf_bytes: bytes, modo: str = "nuevo") -> dict:
    """
    datos_form keys: nombre, apellido_paterno, apellido_materno, edad, curp
    modo: "nuevo" | "actualizar"
    """
    curp_form = datos_form.get("curp", "").strip().upper()

    # ── 1. Validar formato
    if not validar_formato_curp(curp_form):
        return {"status": "Error", "msg": "Formato de CURP inválido.", "datos_ia": None}

    # ── 2. Verificar duplicado
    existente = buscar_curp(curp_form)
    if existente and modo == "nuevo":
        return {
            "status": "Duplicado",
            "msg": "Esta CURP ya está registrada.",
            "datos_ia": None,
        }

    # ── 3. Validar PDF con IA
    ia = validar_con_ia(pdf_bytes)

    # ── 4. Guardar PDF en carpeta correspondiente
    archivo_nombre = _guardar_pdf(pdf_bytes, curp_form, ia["es_curp_valido"])

    # ── 5. Si la IA rechaza → carpeta revisión
    if not ia["es_curp_valido"]:
        return {
            "status": "Revision",
            "msg": ia.get(
                "motivo_rechazo", "El documento no parece ser una CURP oficial."
            ),
            "datos_ia": ia,
            "archivo": archivo_nombre,
        }

    # ── 6. Cruzar datos del form con lo que extrajo la IA
    fila = {
        "CURP": curp_form,
        "Nombre": ia.get("nombre") or datos_form.get("nombre", ""),
        "ApellidoPaterno": ia.get("apellido_paterno")
        or datos_form.get("apellido_paterno", ""),
        "ApellidoMaterno": ia.get("apellido_materno")
        or datos_form.get("apellido_materno", ""),
        "Edad": datos_form.get("edad", ""),
        "FechaNacimiento": ia.get("fecha_nacimiento") or "",
        "Sexo": ia.get("sexo") or "",
        "Estado": ia.get("estado") or "",
        "ArchivoValidado": archivo_nombre,
        "Observaciones": "",
    }

    # ── 7. Escribir en Excel
    df = _leer_excel()
    if existente and modo == "actualizar":
        idx = df[df["CURP"].str.upper() == curp_form].index[0]
        for k, v in fila.items():
            df.at[idx, k] = v
    else:
        df = pd.concat([df, pd.DataFrame([fila])], ignore_index=True)

    _guardar_excel(df)

    return {
        "status": "Éxito",
        "msg": "Registro guardado correctamente.",
        "datos_ia": ia,
        "datos_finales": fila,
    }

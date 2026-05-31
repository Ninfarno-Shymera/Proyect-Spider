"""
services/ocr.py
────────────────────────────────────────────
Módulo reutilizable de extracción de texto.
  1. Intenta pdfplumber (texto nativo)
  2. Si el resultado está vacío o es muy corto → fallback OCR con pytesseract
     vía pdf2image para convertir cada página a imagen primero.

Las rutas de Tesseract y Poppler se leen desde variables de entorno.
En Linux/Render no se necesitan (están en el PATH del sistema).

Uso:
    from services.ocr import extraer_texto_pdf
    texto = extraer_texto_pdf(pdf_bytes)
"""

import io
import os
import pdfplumber
import pytesseract
from pdf2image import convert_from_bytes
from dotenv import load_dotenv

load_dotenv()

# ── Tesseract: solo se configura si la variable existe (Windows local)
_tesseract_path = os.getenv("TESSERACT_PATH")
if _tesseract_path:
    pytesseract.pytesseract.tesseract_cmd = _tesseract_path

# ── Poppler: solo se pasa si la variable existe (Windows local)
_poppler_path = os.getenv("POPPLER_PATH") or None

# Umbral mínimo de caracteres para considerar que pdfplumber extrajo algo útil
UMBRAL_TEXTO = 50


def extraer_texto_pdf(file_obj, lang: str = "spa") -> dict:
    """
    Extrae texto de un PDF (objeto de archivo o bytes).
    Devuelve:
        {
            "texto":   str,        # texto completo de todas las páginas
            "paginas": [str, ...], # texto por página
            "metodo":  str         # "nativo" | "ocr" | "ocr_fallido"
        }
    """
    # Aseguramos bytes
    if hasattr(file_obj, "read"):
        contenido = file_obj.read()
        if hasattr(file_obj, "seek"):
            file_obj.seek(0)
    else:
        contenido = file_obj

    # ── Intento 1: pdfplumber (texto nativo)
    paginas_texto = []
    try:
        with pdfplumber.open(io.BytesIO(contenido)) as pdf:
            for pagina in pdf.pages:
                t = pagina.extract_text() or ""
                paginas_texto.append(t)
    except Exception:
        paginas_texto = []

    texto_total = "\n".join(paginas_texto).strip()

    if len(texto_total) >= UMBRAL_TEXTO:
        return {
            "texto": texto_total,
            "paginas": paginas_texto,
            "metodo": "nativo",
        }

    # ── Intento 2: OCR con pytesseract
    paginas_ocr = []
    try:
        # _poppler_path es None en Linux → pdf2image usa el PATH del sistema
        kwargs = {"dpi": 300}
        if _poppler_path:
            kwargs["poppler_path"] = _poppler_path

        imagenes = convert_from_bytes(contenido, **kwargs)
        for img in imagenes:
            t = pytesseract.image_to_string(img, lang=lang)
            paginas_ocr.append(t)
    except Exception as e:
        return {
            "texto": texto_total,
            "paginas": paginas_texto,
            "metodo": "ocr_fallido",
            "error": str(e),
        }

    texto_ocr = "\n".join(paginas_ocr).strip()
    return {
        "texto": texto_ocr,
        "paginas": paginas_ocr,
        "metodo": "ocr",
    }

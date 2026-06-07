import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

# ── Configuración
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# ── Modelos en orden de prioridad (si uno falla, intenta el siguiente)
MODELOS = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
]

# ── Cliente (inicialización lazy)
_cliente = None


def _get_cliente():
    global _cliente
    if not _cliente and GEMINI_API_KEY:
        _cliente = genai.Client(api_key=GEMINI_API_KEY)
    return _cliente


# ─────────────────────────────────────────
#  CONSULTA GENERAL AL ASISTENTE
# ─────────────────────────────────────────
def consultar_gemini(prompt: str, sistema: str = "", historial: list = None) -> dict:
    cliente = _get_cliente()
    if not cliente:
        return {
            "status": "Error",
            "msg": "GEMINI_API_KEY no configurada.",
            "texto": "",
            "modelo": "",
        }

    contexto = ""
    if historial:
        contexto = "Historial:\n" + "\n".join(historial) + "\n\n"

    prompt_completo = (
        f"{sistema}\n\n{contexto}Usuario: {prompt}\nAsistente:"
        if sistema
        else f"{contexto}Usuario: {prompt}\nAsistente:"
    )

    for modelo in MODELOS:
        try:
            respuesta = cliente.models.generate_content(
                model=modelo,
                contents=prompt_completo,
            )
            return {
                "status": "Éxito",
                "texto": respuesta.text.strip(),
                "modelo": modelo,
            }
        except Exception as e:
            codigo = str(e)
            # 429 = cuota agotada, 503 = saturado → intentar siguiente modelo
            if (
                "429" in codigo
                or "503" in codigo
                or "UNAVAILABLE" in codigo
                or "EXHAUSTED" in codigo
            ):
                continue
            # Otro error → no reintentar
            return {"status": "Error", "msg": str(e), "texto": "", "modelo": modelo}

    return {
        "status": "Error",
        "msg": "Todos los modelos están temporalmente no disponibles. Intenta más tarde.",
        "texto": "",
        "modelo": "",
    }

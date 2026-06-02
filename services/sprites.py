"""
services/sprites.py
────────────────────────────────────────────
Lógica de recoloreo dinámico de sprites PNG para Carmilla.

Mapeo de colores originales del sprite:
  Verde  → transparente        (fondo clave de chroma)
  Negro  → accent del tema     (recibido como ?accent=RRGGBB)
  Blanco → text-light del tema (recibido como ?fill=RRGGBB)

Uso:
    from services.sprites import recolorear_sprite
    png_bytes = recolorear_sprite(png_bytes_originales, "0a9396", "e9ecef")
"""

import io
from PIL import Image

# ═══════════════════════════════════════════════════════
#  COLORES ORIGINALES DE LOS SPRITES — AJUSTA AQUÍ
# ═══════════════════════════════════════════════════════

_VERDE_ORIG = (0, 255, 0)
_NEGRO_ORIG = (0, 0, 0)
_BLANCO_ORIG = (255, 255, 255)
_TOLERANCIA = 40

# ═══════════════════════════════════════════════════════


def _hex_a_rgb(hex_str: str) -> tuple:
    """Convierte '0a9396' → (10, 147, 150). Acepta con o sin #."""
    h = hex_str.lstrip("#")
    if len(h) != 6:
        raise ValueError(f"Color hex inválido: {hex_str!r}")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def _cerca_de(pixel: tuple, objetivo: tuple, tol: int) -> bool:
    return all(abs(int(pixel[i]) - int(objetivo[i])) <= tol for i in range(3))


def recolorear_sprite(png_bytes: bytes, accent_hex: str, fill_hex: str) -> bytes:
    accent_rgb = _hex_a_rgb(accent_hex)
    textlight_rgb = _hex_a_rgb(fill_hex)

    img = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    datos = img.load()
    ancho, alto = img.size

    for y in range(alto):
        for x in range(ancho):
            r, g, b, a = datos[x, y]
            if a == 0:
                continue  # ya transparente → intacto

            px = (r, g, b)

            if _cerca_de(px, _VERDE_ORIG, _TOLERANCIA):
                datos[x, y] = (0, 0, 0, 0)  # verde → transparente

            elif _cerca_de(px, _NEGRO_ORIG, _TOLERANCIA):
                datos[x, y] = (*accent_rgb, a)  # negro → accent

            elif _cerca_de(px, _BLANCO_ORIG, _TOLERANCIA):
                datos[x, y] = (*textlight_rgb, a)  # blanco → text-light

            # cualquier otro color → sin cambio

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

import pdfplumber
import numpy as np
import pandas as pd
import os
import io

from flask import abort, Flask, jsonify, render_template, request, send_file
from scipy import stats
from PIL import Image
from services.ocr import extraer_texto_pdf
from services.mincuad import calcular_minimos_cuadrados
from services.cfe import extraer_datos_cfe, guardar_en_excel, EXCEL_FILE
from services.curp import (
    registrar_datos,
    procesar_pdf_curp,
    validar_con_ia,
    guardar_resultado_pdf,
    editar_datos,
    buscar_curp,
    validar_formato_curp,
    obtener_pdf_valido,
)
from services.sprites import recolorear_sprite

app = Flask(__name__, static_folder="static", template_folder="templates")


# ─────────────────────────────────────────
#  INICIO
# ─────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


# ─────────────────────────────────────────
#  SPRITES — Endpoint de recoloreo
# ─────────────────────────────────────────
@app.route("/sprites/<nombre>")
def servir_sprite(nombre):
    import re as _re

    if not _re.match(r"^[\w\-]+\.png$", nombre, _re.IGNORECASE):
        abort(400)

    ruta = os.path.join("static", "assistant", "sprites", "Carmilla", nombre)
    if not os.path.exists(ruta):
        abort(404)

    accent = request.args.get("accent", "0a9396")
    fill = request.args.get("fill", "e9ecef")

    try:
        with open(ruta, "rb") as f:
            png_bytes = f.read()

        png_modificado = recolorear_sprite(png_bytes, accent, fill)

        return send_file(
            io.BytesIO(png_modificado),
            mimetype="image/png",
            max_age=0,
        )
    except ValueError:
        abort(400)
    except Exception as e:
        app.logger.error(f"Error procesando sprite {nombre}: {e}")
        abort(500)


# ─────────────────────────────────────────
#  CFE — Procesamiento de recibo (con OCR)
# ─────────────────────────────────────────
@app.route("/procesar", methods=["POST"])
def procesar():
    try:
        file = request.files.get("file")
        if not file:
            return jsonify({"status": "Error", "msg": "Sin archivo"}), 400

        pdf_bytes = file.read()

        # ── Extraer texto (nativo o OCR automático)
        resultado_ocr = extraer_texto_pdf(pdf_bytes)
        lineas = resultado_ocr["texto"].split("\n")

        # Pasamos las líneas al extractor CFE adaptado
        data = extraer_datos_cfe_desde_lineas(lineas)
        guardar_en_excel(data)

        return jsonify(
            {
                "status": "Éxito",
                "servicio": data["servicio"],
                "fecha_limite": data["fecha_limite"],
                "adeudo": data["adeudo_ant"],
                "consumo": data["energia_feb26"],
                "total": data["total_feb26"],
                "historial": data["historial"],
                "metodo_ocr": resultado_ocr["metodo"],
            }
        )

    except Exception as e:
        return jsonify({"status": "Error", "msg": str(e)}), 500


def extraer_datos_cfe_desde_lineas(lineas: list) -> dict:
    import re

    res = {
        "servicio": "N/A",
        "fecha_limite": "N/A",
        "adeudo_ant": "0.00",
        "historial": {},
        "energia_feb26": 0.0,
        "total_feb26": 0.0,
    }

    def limpiar_moneda(texto):
        if not texto:
            return 0.0
        num = re.sub(r"[^\d.]", "", str(texto).replace(",", ""))
        return float(num) if num else 0.0

    for linea in lineas:
        if "NO. DE SERVICIO:" in linea:
            res["servicio"] = linea.split(":")[1].strip()
        if "LÍMITE DE PAGO:" in linea or "LIMITE DE PAGO:" in linea:
            res["fecha_limite"] = linea.split(":")[1].strip()
        if "Adeudo Anterior" in linea:
            nums = re.findall(r"[\d,]+\.\d+", linea)
            if nums:
                res["adeudo_ant"] = nums[0]
        if "Energía (kWh)" in linea or "Energia (kWh)" in linea:
            nums_con_comas = re.findall(r"[\d,]+", linea)
            nums_limpios = [n.replace(",", "") for n in nums_con_comas]
            if len(nums_limpios) >= 3:
                res["energia_feb26"] = float(nums_limpios[2])
        if "Total" in linea:
            nums = re.findall(r"[\d,]+\.\d+", linea)
            if nums:
                res["total_feb26"] = limpiar_moneda(nums[0])

    mapeo_busqueda = {
        r"FEB 24|ENE 24": "P1",
        r"ABR 24|MAR 24": "P2",
        r"JUN 24|MAY 24": "P3",
        r"AGO 24|JUL 24": "P4",
        r"OCT 24|SEP 24": "P5",
        r"DIC 24|NOV 24": "P6",
        r"FEB 25|ENE 25": "P7",
        r"ABR 25|MAR 25": "P8",
        r"JUN 25|MAY 25": "P9",
        r"AGO 25|JUL 25": "P10",
        r"OCT 25|SEP 25": "P11",
    }

    for patron, clave in mapeo_busqueda.items():
        for linea in lineas:
            if re.search(patron, linea.upper()):
                numeros = re.findall(r"[\d,]+\.?\d*", linea)
                if len(numeros) >= 6:
                    res["historial"][clave] = {
                        "k": limpiar_moneda(numeros[-3]),
                        "p": limpiar_moneda(numeros[-2]),
                    }
                    break

    return res


# ─────────────────────────────────────────
#  CFE — Estadísticas globales
# ─────────────────────────────────────────
@app.route("/estadisticas")
def estadisticas():
    try:
        if not os.path.exists(EXCEL_FILE):
            return jsonify({"status": "Error", "msg": "No hay datos"}), 400

        df = pd.read_excel(EXCEL_FILE)
        columnas_periodos = [f"Periodo {i}" for i in range(1, 13)]

        pagos_df = (
            df[df["Servicio"].notna() & (df["Servicio"] != "")][columnas_periodos]
            .apply(pd.to_numeric, errors="coerce")
            .fillna(0)
        )

        consumos_df = df[df["Servicio"].isna() | (df["Servicio"] == "")][
            columnas_periodos
        ].apply(pd.to_numeric, errors="coerce")

        consumos_df = consumos_df[consumos_df.sum(axis=1) > 0].fillna(0)

        pagos_flat = pagos_df.values.flatten()
        pagos_flat = pagos_flat[pagos_flat > 0]

        promedio_consumos = (
            consumos_df.mean(axis=0).tolist() if not consumos_df.empty else [0] * 12
        )
        consumos_flat = consumos_df.values.flatten()
        consumos_flat = consumos_flat[consumos_flat > 0]

        return jsonify(
            {
                "status": "Éxito",
                "media": round(float(np.mean(pagos_flat)), 2),
                "mediana": round(float(np.median(pagos_flat)), 2),
                "moda": round(float(stats.mode(pagos_flat, keepdims=False)[0]), 2),
                "varianza": round(float(np.var(pagos_flat)), 2),
                "desv": round(float(np.std(pagos_flat)), 2),
                "promedio_mensual": pagos_df.mean(axis=0).tolist(),
                "consumos": promedio_consumos,
                "media_consumo": round(float(np.mean(consumos_flat)), 2),
                "mediana_consumo": round(float(np.median(consumos_flat)), 2),
                "moda_consumo": round(
                    float(stats.mode(consumos_flat, keepdims=False)[0]), 2
                ),
                "varianza_consumo": round(float(np.var(consumos_flat)), 2),
                "desv_consumo": round(float(np.std(consumos_flat)), 2),
            }
        )

    except Exception as e:
        return jsonify({"status": "Error", "msg": str(e)}), 500


# ─────────────────────────────────────────
#  MÍNIMOS CUADRADOS
# ─────────────────────────────────────────
@app.route("/mincuad", methods=["POST"])
def minimos_cuadrados():
    try:
        file = request.files.get("file")
        if not file:
            return jsonify({"status": "Error", "msg": "Sin archivo"}), 400

        resultado = calcular_minimos_cuadrados(file)

        return jsonify(
            {
                "status": "Éxito",
                "m": resultado["m"],
                "b": resultado["b"],
                "x": resultado["x"],
                "y": resultado["y"],
            }
        )

    except Exception as e:
        return jsonify({"status": "Error", "msg": str(e)}), 500


# ─────────────────────────────────────────
#  CURP — Paso 1: Registrar datos básicos
# ─────────────────────────────────────────
@app.route("/curp/registrar", methods=["POST"])
def curp_registrar():
    try:
        datos_form = {
            "nombre": request.form.get("nombre", "").strip(),
            "apellido_paterno": request.form.get("apellido_paterno", "").strip(),
            "apellido_materno": request.form.get("apellido_materno", "").strip(),
            "edad": request.form.get("edad", "").strip(),
            "curp": request.form.get("curp", "").strip().upper(),
        }
        resultado = registrar_datos(datos_form)
        return jsonify(resultado)
    except Exception as e:
        return jsonify({"status": "Error", "msg": str(e)}), 500


# ─────────────────────────────────────────
#  CURP — Paso 2+3+4: Subir y validar PDF
# ─────────────────────────────────────────
@app.route("/curp/validar_pdf", methods=["POST"])
def curp_validar_pdf():
    try:
        curp = request.form.get("curp", "").strip().upper()
        pdf_file = request.files.get("pdf")

        if not curp:
            return jsonify({"status": "Error", "msg": "CURP requerida"}), 400
        if not pdf_file:
            return jsonify({"status": "Error", "msg": "PDF requerido"}), 400

        pdf_bytes = pdf_file.read()

        # Paso 2 — leer PDF
        lectura = procesar_pdf_curp(curp, pdf_bytes)
        if lectura["status"] != "Éxito":
            return jsonify(lectura)

        # Paso 3 — validar con IA
        ia = validar_con_ia(pdf_bytes, lectura["texto"], lectura["metodo"])

        # Paso 4 — guardar resultado
        resultado = guardar_resultado_pdf(curp, pdf_bytes, ia, lectura["metodo"])
        return jsonify(resultado)

    except Exception as e:
        return jsonify({"status": "Error", "msg": str(e)}), 500


# ─────────────────────────────────────────
#  CURP — Verificar si ya existe
# ─────────────────────────────────────────
@app.route("/curp/verificar", methods=["POST"])
def curp_verificar():
    try:
        body = request.get_json(force=True)
        curp = body.get("curp", "").strip().upper()

        if not curp:
            return jsonify({"status": "Error", "msg": "CURP vacía"}), 400
        if not validar_formato_curp(curp):
            return jsonify({"status": "Error", "msg": "Formato de CURP inválido"}), 400

        existente = buscar_curp(curp)
        if existente:
            return jsonify({"status": "Existe", "datos": existente})

        return jsonify({"status": "Libre"})

    except Exception as e:
        return jsonify({"status": "Error", "msg": str(e)}), 500


# ─────────────────────────────────────────
#  CURP — Editar datos
# ─────────────────────────────────────────
@app.route("/curp/editar", methods=["POST"])
def curp_editar():
    try:
        datos_nuevos = {
            "nombre": request.form.get("nombre", "").strip(),
            "apellido_paterno": request.form.get("apellido_paterno", "").strip(),
            "apellido_materno": request.form.get("apellido_materno", "").strip(),
            "edad": request.form.get("edad", "").strip(),
        }
        curp = request.form.get("curp", "").strip().upper()
        resultado = editar_datos(curp, datos_nuevos)
        return jsonify(resultado)
    except Exception as e:
        return jsonify({"status": "Error", "msg": str(e)}), 500


# ─────────────────────────────────────────
#  CURP — Servir PDF guardado
# ─────────────────────────────────────────
@app.route("/curp/pdf/<curp>")
def curp_ver_pdf(curp):
    try:
        ruta = obtener_pdf_valido(curp.upper())
        if not ruta:
            abort(404)
        return send_file(ruta, mimetype="application/pdf")
    except Exception as e:
        app.logger.error(f"Error sirviendo PDF de CURP: {e}")
        abort(500)


# ─────────────────────────────────────────
#  ARRANQUE
# ─────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)

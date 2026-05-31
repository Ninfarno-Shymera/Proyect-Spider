from flask import Flask, render_template, request, jsonify
import pdfplumber
import numpy as np
from scipy import stats
import pandas as pd
import os

from services.ocr import extraer_texto_pdf
from services.mincuad import calcular_minimos_cuadrados
from services.cfe import extraer_datos_cfe, guardar_en_excel, EXCEL_FILE
from services.curp import registrar_persona, buscar_curp, validar_formato_curp

app = Flask(__name__, static_folder="static", template_folder="templates")


# ─────────────────────────────────────────
#  INICIO
# ─────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


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
#  CURP — Verificar si ya existe
# ─────────────────────────────────────────
@app.route("/curp/verificar", methods=["POST"])
def curp_verificar():
    """
    Recibe { "curp": "..." } y devuelve si ya existe en la base.
    El frontend lo llama antes de mostrar el formulario completo.
    """
    try:
        body = request.get_json(force=True)
        curp = body.get("curp", "").strip().upper()

        if not curp:
            return jsonify({"status": "Error", "msg": "CURP vacía"}), 400

        if not validar_formato_curp(curp):
            return jsonify({"status": "Error", "msg": "Formato de CURP inválido"}), 400

        existente = buscar_curp(curp)
        if existente:
            # Devolvemos los datos actuales para mostrarlos en el modal
            return jsonify({"status": "Existe", "datos": existente})

        return jsonify({"status": "Libre"})

    except Exception as e:
        return jsonify({"status": "Error", "msg": str(e)}), 500


# ─────────────────────────────────────────
#  CURP — Registrar / Actualizar
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
        modo = request.form.get("modo", "nuevo")

        pdf_file = request.files.get("pdf")
        if not pdf_file:
            return jsonify({"status": "Error", "msg": "No se recibió el PDF"}), 400

        pdf_bytes = pdf_file.read()

        resultado = registrar_persona(datos_form, pdf_bytes, modo=modo)
        return jsonify(resultado)

    except Exception as e:
        return jsonify({"status": "Error", "msg": str(e)}), 500


# ─────────────────────────────────────────
#  ARRANQUE
# ─────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)

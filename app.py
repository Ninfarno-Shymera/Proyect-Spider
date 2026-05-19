from flask import Flask, render_template, request, jsonify
import pdfplumber
import numpy as np
from scipy import stats
import pandas as pd
import os

from services.mincuad import calcular_minimos_cuadrados
from services.cfe import extraer_datos_cfe, guardar_en_excel, EXCEL_FILE

app = Flask(__name__, static_folder="static", template_folder="templates")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/procesar", methods=["POST"])
def procesar():
    try:
        file = request.files.get("file")
        if not file:
            return jsonify({"status": "Error", "msg": "Sin archivo"}), 400

        with pdfplumber.open(file) as pdf:
            data = extraer_datos_cfe(pdf)

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
            }
        )

    except Exception as e:
        return jsonify({"status": "Error", "msg": str(e)}), 500


@app.route("/estadisticas")
def estadisticas():
    try:
        if not os.path.exists(EXCEL_FILE):
            return jsonify({"status": "Error", "msg": "No hay datos"}), 400

        df = pd.read_excel(EXCEL_FILE)
        columnas_periodos = [f"Periodo {i}" for i in range(1, 13)]

        # ── Filas de pagos: tienen número de servicio
        pagos_df = (
            df[df["Servicio"].notna() & (df["Servicio"] != "")][columnas_periodos]
            .apply(pd.to_numeric, errors="coerce")
            .fillna(0)
        )

        # ── Filas de consumos: siguen inmediatamente después (Servicio vacío pero con datos)
        consumos_df = df[df["Servicio"].isna() | (df["Servicio"] == "")][
            columnas_periodos
        ].apply(pd.to_numeric, errors="coerce")

        # ── Quitar filas donde todos los valores son NaN o 0
        consumos_df = consumos_df[consumos_df.sum(axis=1) > 0].fillna(0)

        pagos_flat = pagos_df.values.flatten()
        pagos_flat = pagos_flat[pagos_flat > 0]  # ← ignorar ceros

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


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)

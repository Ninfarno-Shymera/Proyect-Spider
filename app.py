from flask import Flask, render_template, request, jsonify
import pdfplumber
import re
import pandas as pd
import os
from MinCuad import calcular_minimos_cuadrados

app = Flask(__name__, static_folder='static', template_folder='templates')
EXCEL_FILE = os.path.join('resourse', 'datos_cfe.xlsx')

def limpiar_moneda(texto):
    if not texto: return 0.0
    num = re.sub(r'[^\d.]', '', str(texto).replace(',', ''))
    return float(num) if num else 0.0

def extraer_datos_cfe(pdf):
    res = {
        "servicio": "N/A",
        "fecha_limite": "N/A",
        "adeudo_ant": "0.00",
        "historial": {},
        "energia_feb26": 0.0,
        "total_feb26": 0.0
    }
    todas_las_lineas = []

    for pagina in pdf.pages:
        texto_pag = pagina.extract_text() or ""
        todas_las_lineas.extend(texto_pag.split('\n'))

    for linea in todas_las_lineas:
        if "NO. DE SERVICIO:" in linea:
            res["servicio"] = linea.split(":")[1].strip()
        if "LÍMITE DE PAGO:" in linea:
            res["fecha_limite"] = linea.split(":")[1].strip()
        if "Adeudo Anterior" in linea:
            nums = re.findall(r'[\d,]+\.\d+', linea)
            if nums: res["adeudo_ant"] = nums[0]
        if "Energía (kWh)" in linea:
            nums_con_comas = re.findall(r'[\d,]+', linea)
            nums_limpios = [n.replace(',', '') for n in nums_con_comas]
            if len(nums_limpios) >= 3:
                res["energia_feb26"] = float(nums_limpios[2])
        if "Total" in linea:
            nums = re.findall(r'[\d,]+\.\d+', linea)
            if nums: res["total_feb26"] = limpiar_moneda(nums[0])

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
        r"OCT 25|SEP 25": "P11"
    }
    
    for patron, clave in mapeo_busqueda.items():
        for linea in todas_las_lineas:
            if re.search(patron, linea.upper()):
                numeros = re.findall(r'[\d,]+\.?\d*', linea)
                if len(numeros) >= 6:
                    res["historial"][clave] = {
                        "k": limpiar_moneda(numeros[-3]),
                        "p": limpiar_moneda(numeros[-2])
                    }
                    break

    return res

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/procesar', methods=['POST'])
def procesar():
    try:
        file = request.files.get('file')
        if not file: 
            return jsonify({"status": "Error", "msg": "Sin archivo"}), 400

        with pdfplumber.open(file) as pdf:
            data = extraer_datos_cfe(pdf)

        # Guardar en Excel
        f_precios = {"Servicio": data["servicio"]}
        f_consumos = {"Servicio": ""}
        total_k, total_p, conteo = 0, 0, 0

        for i in range(1, 13):
            col = f"Periodo {i}"
            if i == 12:
                p, k = data["total_feb26"], data["energia_feb26"]
            else:
                meta = data["historial"].get(f"P{i}", {"p": 0, "k": 0})
                p, k = meta["p"], meta["k"]
            f_precios[col], f_consumos[col] = p, k
            if p > 0:
                total_p += p
                total_k += k
                conteo += 1

        prom_p = round(total_p / conteo, 2) if conteo > 0 else 0
        prom_k = round(total_k / conteo, 2) if conteo > 0 else 0
        
        f_precios.update({"Promedio": prom_p, "AdeudoA": data["adeudo_ant"], "FechaLim": data["fecha_limite"]})
        f_consumos.update({"Promedio": prom_k, "AdeudoA": "", "FechaLim": ""})
        
        df_nuevo = pd.DataFrame([f_precios, f_consumos])

        if os.path.exists(EXCEL_FILE):
            df_old = pd.read_excel(EXCEL_FILE)
            pd.concat([df_old, df_nuevo], ignore_index=True).to_excel(EXCEL_FILE, index=False)
        else:
            df_nuevo.to_excel(EXCEL_FILE, index=False)

        return jsonify({
            "status": "Éxito",
            "servicio": data["servicio"],
            "fecha_limite": data["fecha_limite"],
            "adeudo": data["adeudo_ant"],
            "consumo": data["energia_feb26"],
            "total": data["total_feb26"],
            "historial": data["historial"]
        })

    except Exception as e:
        return jsonify({"status": "Error", "msg": str(e)}), 500

@app.route('/estadisticas')
def estadisticas():
    try:
        import numpy as np
        if not os.path.exists(EXCEL_FILE):
            return jsonify({"status":"Error","msg":"No hay datos"}), 400

        df = pd.read_excel(EXCEL_FILE)
        columnas_periodos = [f"Periodo {i}" for i in range(1, 13)]
        pagos = df[df['Servicio'] != ""][columnas_periodos].apply(pd.to_numeric, errors='coerce').fillna(0)
        pagos_flat = pagos.values.flatten()

        media = round(np.mean(pagos_flat),2)
        mediana = round(np.median(pagos_flat),2)
        from scipy import stats
        moda = round(float(stats.mode(pagos_flat, keepdims=False)[0]),2)
        varianza = round(np.var(pagos_flat),2)
        desv = round(np.std(pagos_flat),2)

        promedio_mensual = pagos.mean(axis=0).tolist()

        return jsonify({
            "status":"Éxito",
            "media": media,
            "mediana": mediana,
            "moda": moda,
            "varianza": varianza,
            "desv": desv,
            "promedio_mensual": promedio_mensual
        })

    except Exception as e:
        return jsonify({"status":"Error","msg":str(e)}),500
    
@app.route('/mincuad', methods=['POST'])
def minimos_cuadrados():

    try:
        file = request.files.get('file')

        if not file:
            return jsonify({"status":"Error","msg":"Sin archivo"}),400

        resultado = calcular_minimos_cuadrados(file)

        return jsonify({
            "status":"Éxito",
            "m": resultado["m"],
            "b": resultado["b"],
            "x": resultado["x"],
            "y": resultado["y"]
        })

    except Exception as e:
        return jsonify({"status":"Error","msg":str(e)}),500
    
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
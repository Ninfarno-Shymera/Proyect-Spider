import re
import os
import pandas as pd

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


def guardar_en_excel(data):
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
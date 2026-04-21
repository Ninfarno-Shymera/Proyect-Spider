import numpy as np
import pandas as pd

def calcular_minimos_cuadrados(file):

    df = pd.read_excel(file)

    X = df['X'].values
    Y = df['Y'].values

    # convertir X en matriz columna
    X = np.vstack([X, np.ones(len(X))]).T

    # (XtX)^-1 XtY
    XtX = np.transpose(X) @ X
    inv = np.linalg.inv(XtX)
    paso = inv @ np.transpose(X)
    beta = paso @ Y

    m = float(beta[0])
    b = float(beta[1])

    return {
        "m": m,
        "b": b,
        "x": df['X'].tolist(),
        "y": df['Y'].tolist()
    }
# 🐧 Página Personal — Panel de Proyectos

🌐 Demo en vivo: proyect-spider-0053.onrender.com

Aplicación web personal construida con **Flask + HTML/CSS/JS vanilla**, que agrupa varios módulos de análisis de datos, validación de documentos y herramientas estadísticas bajo una interfaz unificada con sistema de temas visuales y un asistente animado.

---

## 📦 Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Backend | Python 3 · Flask · Gunicorn |
| Procesamiento | pdfplumber · pytesseract · pdf2image · NumPy · SciPy · pandas |
| IA externa | Google Gemini 1.5 Flash (validación de documentos) |
| Frontend | HTML5 · CSS Variables · JavaScript ES6+ · Chart.js |
| Almacenamiento | Archivos Excel (`.xlsx`) · PDFs locales |

---

## 🗂 Estructura del Proyecto

```
├── app.py                        # Rutas Flask (servidor principal)
├── requirements.txt
├── services/
│   ├── cfe.py                    # Lógica de extracción de recibos CFE
│   ├── curp.py                   # Lógica de registro y validación CURP
│   ├── mincuad.py                # Cálculo de mínimos cuadrados
│   ├── ocr.py                    # Extracción de texto PDF (nativo + OCR)
│   └── sprites.py                # Recoloreo dinámico de sprites PNG
├── static/
│   ├── css/Estilos.css           # Sistema de temas con CSS Variables
│   ├── js/
│   │   ├── app.js                # Navegación, temas, vistas
│   │   ├── cfe.js                # Lógica cliente del módulo CFE
│   │   ├── rectas.js             # Lógica cliente del módulo de rectas
│   │   └── registro.js           # Lógica cliente del módulo CURP
│   ├── views/Cards.js            # Plantillas HTML de cada vista (VISTAS{})
│   └── assistant/
│       └── assistant.js          # Motor del asistente animado (Carmilla)
├── templates/
│   └── index.html                # SPA principal
└── resource/
    ├── datos_cfe.xlsx            # Base de datos de recibos CFE (generada)
    └── curp/
        ├── registros_personas.xlsx
        ├── curp_validos/         # PDFs aceptados por la IA
        └── curp_revision/        # PDFs rechazados / en revisión
```

---

## 🧩 Estado de los Módulos

### ✅ Extractor de Rectas — **Completo**

Calcula la **recta de regresión por mínimos cuadrados** a partir de un archivo `.xlsx` con columnas `X` e `Y`.

- Sube un archivo Excel → el backend resuelve `(XᵀX)⁻¹ Xᵀ Y` con NumPy
- Devuelve pendiente `m`, intercepto `b` y la ecuación `y = mx + b`
- Muestra gráfica con los puntos experimentales y la recta de regresión (Chart.js, tipo scatter)

**Ruta:** `POST /mincuad`  
**Formato de entrada:** `.xlsx` con columnas `X` e `Y`

---

### ✅ Registro CURP — **Completo**

Flujo de registro de personas con validación documental por IA.

**Flujo en 4 pasos:**

1. **Registro de datos básicos** — CURP, nombre, apellidos, edad  
   → Valida formato de CURP con regex oficial (18 caracteres)  
   → Guarda en `registros_personas.xlsx`

2. **Subida de PDF** — Documento oficial de CURP

3. **Lectura + validación por IA** — El PDF se procesa con el módulo OCR y luego se envía a **Gemini 1.5 Flash**, que determina si es un documento oficial y extrae: nombre, apellidos, fecha de nacimiento, sexo y estado

4. **Resultado** — Si es válido: se guarda el PDF en `curp_validos/` y se actualiza el registro. Si no: va a `curp_revision/` y se pide un nuevo documento

**Funciones adicionales:**
- Detección de CURP duplicada antes de registrar
- Historial de PDFs subidos (con timestamp) conservado en el Excel
- Edición de datos sin perder historial de documentos
- Endpoint para visualizar el PDF válido más reciente

**Rutas:**
```
POST /curp/registrar
POST /curp/validar_pdf
POST /curp/verificar
POST /curp/editar
GET  /curp/pdf/<curp>
```

---

### 🔧 Análisis CFE — **En Mantenimiento**

Extrae y analiza datos de recibos de luz de CFE en formato PDF.

> ⚠️ Este módulo está actualmente marcado como **"En Mantenimiento"** en la interfaz. La funcionalidad existe en el código pero puede estar desactualizada respecto al formato actual de los recibos.

**Lo que hace (cuando está activo):**

- Procesa uno o varios PDFs de CFE (extracción nativa o fallback OCR)
- Extrae: número de servicio, consumo en kWh, adeudo anterior, total a pagar e historial de hasta 11 periodos
- Guarda todos los datos en `datos_cfe.xlsx` (filas intercaladas: precios / consumos)
- Con múltiples archivos: muestra estadísticas globales (media, mediana, moda, varianza, desv. estándar) tanto de pagos como de consumo
- Genera gráficas de línea con Chart.js

**Rutas:**
```
POST /procesar
GET  /estadisticas
```

**Pendiente / posibles causas del mantenimiento:**
- El mapeo de periodos históricos está fijo hasta `OCT 25 / SEP 25` — necesita actualizarse para cubrir 2026
- El formato del recibo puede haber cambiado y los regex de extracción podrían necesitar ajuste

---

### 🚧 Trabajos — **Sin implementar**

Tarjeta placeholder en el panel de proyectos. Sin funcionalidad asociada aún.

---

### 🟣 Asistente Animado (Carmilla) — **En desarrollo activo**

Personaje animado tipo sprite pixel-art que vive en la esquina inferior derecha de la pantalla.

**Capa 1 — Completa:**
- Estados: `dormida` → `despertando` → `idle` → `sorpresa` → `redux` → `dormida`
- Animaciones: idle en 4 direcciones, parpadeo aleatorio, susto con cambio de lado, movimiento autónomo horizontal
- Rastreo de mouse: Carmilla mira hacia el cursor del usuario
- Temporizador de inactividad: vuelve a modo reducido si el mouse no se mueve por 20 segundos
- Sprites recoloreados dinámicamente en el servidor según el tema activo (reemplaza verde → transparente, negro → `--accent-active`, blanco → `--bg-header`)

**Capa 2 — Pendiente:**
- Sistema de chat integrado con el asistente (`abrirChat()` es placeholder)
- Cambio de icono según estado del chat

---

## 🎨 Sistema de Temas

La interfaz soporta **9 paletas de color** intercambiables en tiempo real mediante CSS Custom Properties (`--accent`, `--bg-nav`, `--bg-header`, etc.):

`violeta` · `escarlata` · `pastel` · `oceano` · `aqua` · `naranja` · `gris` · `bosque` · `monocromo`

El tema activo se aplica también a los sprites de Carmilla mediante el endpoint `/sprites/<nombre>?accent=RRGGBB&fill=RRGGBB`.

El tema por defecto se configura en `static/js/app.js`:
```js
const TEMA_BASE = "aqua";
```

---

## ⚙️ Variables de Entorno

Crear un archivo `.env` en la raíz con:

```env
# Requerida para el módulo CURP (validación con IA)
GEMINI_API_KEY=tu_clave_aqui

# Solo necesarias en Windows (en Linux/Render se detectan automáticamente)
TESSERACT_PATH=C:\Program Files\Tesseract-OCR\tesseract.exe
POPPLER_PATH=C:\poppler\bin
```

---

## 🚀 Instalación y Arranque

```bash
# 1. Clonar e instalar dependencias
pip install -r requirements.txt

# 2. Configurar variables de entorno
cp .env.example .env   # o crear .env manualmente

# 3. Correr en desarrollo
python app.py

# 4. Correr en producción
gunicorn app:app
```

La app estará disponible en `http://localhost:5000`.

> En Linux, asegúrate de tener instalados `tesseract-ocr` y `poppler-utils` a nivel del sistema si necesitas OCR.

---

## 📋 Resumen de Estado

| Módulo | Estado | Notas |
|---|---|---|
| Extractor de Rectas | ✅ Completo | Funcional |
| Registro CURP | ✅ Completo | Requiere `GEMINI_API_KEY` |
| Análisis CFE | 🔧 Mantenimiento | Mapeo de periodos desactualizado |
| Trabajos | 🚧 Sin implementar | Placeholder |
| Carmilla (Capa 1) | ✅ Completo | Animación e interacción |
| Carmilla (Capa 2) | 🚧 En desarrollo | Chat pendiente |
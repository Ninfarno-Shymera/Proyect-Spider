const VISTAS = {
  inicio: `
        <div class="bloque-blanco">
            <h2>Bienvenido</h2>
            <p>Selecciona una opción en el menú lateral para comenzar.</p>
        </div>
    `,

  proyectos: `

        <div class="bloque-blanco">
            <h2>Panel de Proyectos</h2>
            <p>Selecciona un módulo para trabajar.</p>
        </div>

        <div class="proyectos-grid">

            <div class="bloque-blanco card-proyecto"
                onclick="mostrarSubProyecto('cfe')">

                <div class="icon-contenedor">⚡</div>

                <h3>Proyecto CFE</h3>
                <h3>En Mantenimiento</h3>

                <p>Extractor de datos y análisis de consumo desde PDF.</p>

            </div>


            <div class="bloque-blanco card-proyecto mantenimiento">

                <div class="icon-contenedor">🛠️</div>

                <h3>Trabajos</h3>

            </div>


            <div class="bloque-blanco card-proyecto"
                 onclick="mostrarSubProyecto('analisis')">

                <div class="icon-contenedor">📈</div>

                <h3>Extractor de Rectas</h3>

                <p>Módulo de análisis estadístico.</p>

            </div>

        </div>
    `,

  proyecto_cfe: `

        <div class="bloque-blanco">

            <h2>Análisis de Datos CFE</h2>

            <h1>En reparación</h1>

            <button class="btn-retroceder"
                onclick="mostrarContenido('proyectos')">

                ← Volver a Proyectos

            </button>

        </div>


        <div class="contenedor-cartas-principales">

            <!-- ACCIONES -->
            <div class="bloque-blanco card-accion">

                <h3>Acciones</h3>

                <p>Subir el archivo PDF emitido por la CFE.</p>

                <label for="fileInput" class="btn-accion">
                    📁 Escanear Recibo(s)
                </label>

                <input type="file"
                    id="fileInput"
                    style="display:none;"
                    accept=".pdf"
                    multiple>

                <div id="progresoCFE" class="oculto-display" style="margin-top:15px;">
                    <p id="progresoTexto" style="color:var(--text-secondary); font-size:0.9rem;">
                        Escaneando...
                    </p>
                    <div style="background:var(--border-soft); border-radius:8px; overflow:hidden; height:10px;">
                        <div id="progresoBar"
                            style="height:100%; width:0%; background:var(--accent); transition: width 0.3s ease;">
                        </div>
                    </div>
                </div>
            </div>


            <!-- ESTADÍSTICAS -->
            <div class="bloque-blanco card-accion">

                <h3>Estadísticas Globales</h3>

                <p>Estadísticas generales de todos los recibos escaneados.</p>

                <button class="btn-accion btn-stats"
                    onclick="cargarEstadisticasGlobales()">

                    📊 Mostrar Estadísticas

                </button>

            </div>

        </div>


        <!-- RESULTADO DEL ESCANEO -->
        <div id="resultadoEscaneo"
            class="oculto-display"
            style="margin-top:20px;">

            <div class="bloque-blanco">

                <h3>Resultado del Escaneo</h3>

                <div class="revision-container">

                    <div class="datos-col">

                        <div class="dato-item">
                            <strong>No. Servicio:</strong>
                            <span id="datoServicio">---</span>
                        </div>

                        <div class="dato-item">
                            <strong>Consumo:</strong>
                            <span id="datoConsumo">0</span> kWh
                        </div>

                        <div class="dato-item">
                            <strong>Deuda:</strong>
                            $<span id="datoPagoAnt">0.00</span>
                        </div>

                        <div class="dato-item total">
                            <strong>Total a Pagar:</strong>
                            $<span id="datoTotal">0.00</span>
                        </div>

                    </div>

                    <div class="grafica-col">
                        <canvas id="graficaConsumo"></canvas>
                    </div>

                </div>

            </div>

        </div>

<div id="resumenGlobal"
    class="oculto-display"
    style="margin-top:20px;">

    <div class="bloque-blanco">

        <h3>Estadísticas Globales de Pagos</h3>

        <div class="revision-container">

            <div class="datos-col">

                <div class="dato-item">
                    <strong>Media:</strong>
                    <span id="st-media">$0.00</span>
                </div>

                <div class="dato-item">
                    <strong>Mediana:</strong>
                    <span id="st-mediana">$0.00</span>
                </div>

                <div class="dato-item">
                    <strong>Moda:</strong>
                    <span id="st-moda">$0.00</span>
                </div>

                <div class="dato-item">
                    <strong>Varianza:</strong>
                    <span id="st-varianza">0.00</span>
                </div>

                <div class="dato-item total">
                    <strong>Desv. Estándar:</strong>
                    <span id="st-desv">$0.00</span>
                </div>

            </div>

            <div class="grafica-col" style="height:250px;">
                <canvas id="graficaGlobal"></canvas>
            </div>

        </div>

    </div>


    <div class="bloque-blanco">

        <h3>Estadísticas Globales de Consumo</h3>

        <div class="revision-container">

            <div class="datos-col">

                <div class="dato-item">
                    <strong>Media:</strong>
                    <span id="st-media-consumo">0 kWh</span>
                </div>

                <div class="dato-item">
                    <strong>Mediana:</strong>
                    <span id="st-mediana-consumo">0 kWh</span>
                </div>

                <div class="dato-item">
                    <strong>Moda:</strong>
                    <span id="st-moda-consumo">0 kWh</span>
                </div>

                <div class="dato-item">
                    <strong>Varianza:</strong>
                    <span id="st-varianza-consumo">0.00</span>
                </div>

                <div class="dato-item total">
                    <strong>Desv. Estándar:</strong>
                    <span id="st-desv-consumo">0 kWh</span>
                </div>

            </div>

            <div class="grafica-col" style="height:250px;">
                <canvas id="graficaConsumoGlobal"></canvas>
            </div>

        </div>

    </div>

</div>
    `,

  proyecto_rectas: `

        <div class="bloque-blanco">

            <h2>Proyecto de Análisis de la Recta</h2>

            <button class="btn-retroceder"
                onclick="mostrarContenido('proyectos')">

                ← Volver a Proyectos

            </button>

        </div>


        <!-- ACCIONES -->
        <div class="bloque-blanco card-accion">

            <h3>Acciones</h3>

            <p>Subir archivo XLSX con columnas X y Y.</p>

            <label for="fileInputRecta" class="btn-accion">
                📁 Escanear Tabla
            </label>

            <input type="file"
                id="fileInputRecta"
                style="display:none;"
                accept=".xlsx">

        </div>


        <!-- RESULTADO -->
        <div id="resultadoRecta"
            class="bloque-blanco oculto-display">

            <h3>Resultado del análisis</h3>

            <div class="revision-container">

                <div class="datos-col">

                    <div class="dato-item">
                        <strong>Ecuación:</strong>
                        <span id="ecuacionRecta">---</span>
                    </div>

                    <div class="dato-item">
                        <strong>m:</strong>
                        <span id="valorM">0</span>
                    </div>

                    <div class="dato-item">
                        <strong>b:</strong>
                        <span id="valorB">0</span>
                    </div>

                </div>

                <div class="grafica-col">
                    <canvas id="graficaRecta"></canvas>
                </div>

            </div>

        </div>

    `,
};

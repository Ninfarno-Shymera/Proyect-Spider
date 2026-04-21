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

            <div class="bloque-blanco card-proyecto mantenimiento"
                 onclick="mostrarSubProyecto('cfe')">

                <div class="icon-contenedor">⚡</div>

                <h3>Proyecto CFE</h3>
                <h3>En Mantenimiento</h3>

                <p>Extractor de datos y análisis de consumo desde PDF.</p>

            </div>


            <div class="bloque-blanco card-proyecto mantenimiento">

                <div class="icon-contenedor">🛠️</div>

                <h3>Trabajos</h3>
                <p>En Mantenimiento.</p>

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
                    📁 Escanear Recibo
                </label>

                <input type="file"
                    id="fileInput"
                    style="display:none;"
                    accept=".pdf">

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


        <!-- ESTADÍSTICAS GLOBALES -->
        <div id="resumenGlobal"
            class="oculto-display"
            style="margin-top:20px;">

            <div class="bloque-blanco">

                <h3 style="text-align:center;margin-bottom:20px;">
                    Análisis Estadístico Global
                </h3>

                <div class="stats-grid-global">

                    <div class="stat-box">
                        <span>Media</span>
                        <strong id="st-media">$0.00</strong>
                    </div>

                    <div class="stat-box">
                        <span>Mediana</span>
                        <strong id="st-mediana">$0.00</strong>
                    </div>

                    <div class="stat-box">
                        <span>Moda</span>
                        <strong id="st-moda">$0.00</strong>
                    </div>

                    <div class="stat-box">
                        <span>Varianza</span>
                        <strong id="st-varianza">0.00</strong>
                    </div>

                    <div class="stat-box">
                        <span>Desv. Estándar</span>
                        <strong id="st-desv">$0.00</strong>
                    </div>

                </div>

                <h4 style="color:#666;font-size:0.9rem;">
                    Promedio Mensual de Pagos ($)
                </h4>

                <div class="contenedor-grafica-global">
                    <canvas id="graficaGlobal"></canvas>
                </div>

                <h4 style="color:#666;font-size:0.9rem;margin-top:30px;">
                    Promedio Mensual de Consumo (kWh)
                </h4>

                <div class="contenedor-grafica-global">
                    <canvas id="graficaConsumoGlobal"></canvas>
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

    `

};
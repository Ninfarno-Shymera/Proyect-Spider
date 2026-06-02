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

            <div class="bloque-blanco card-proyecto"
                 onclick="mostrarSubProyecto('curp')">

                <div class="icon-contenedor">🪪</div>

                <h3>Registro CURP</h3>

                <p>Validación y registro de personas mediante documento oficial de CURP.</p>

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

  proyecto_curp: `

        <div class="bloque-blanco">
            <h2>🪪 Registro de Personas — CURP</h2>
            <button class="btn-retroceder" onclick="mostrarContenido('proyectos')">
                ← Volver a Proyectos
            </button>
        </div>

        <!-- ETAPA 1: FORMULARIO -->
        <div id="etapa-formulario" class="bloque-blanco">
            <h3>Registro de datos</h3>
            <p style="color:var(--text-secondary);font-size:0.9rem;">
                Ingresa tus datos. El PDF de CURP se solicitará en el siguiente paso.
            </p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-top:15px;">
                <div style="grid-column:1/-1;">
                    <label style="font-size:0.85rem;color:var(--text-secondary);">CURP</label>
                    <input type="text" id="curp-input" maxlength="18" placeholder="18 caracteres"
                        style="width:100%;margin-top:4px;padding:9px 12px;border:1px solid var(--border);
                        border-radius:8px;background:var(--bg-surface-2);color:var(--text-main);
                        font-size:1rem;font-family:monospace;letter-spacing:2px;text-transform:uppercase;">
                </div>
                <div>
                    <label style="font-size:0.85rem;color:var(--text-secondary);">Nombre(s)</label>
                    <input type="text" id="curp-nombre" placeholder="Nombre(s)"
                        style="width:100%;margin-top:4px;padding:9px 12px;border:1px solid var(--border);
                        border-radius:8px;background:var(--bg-surface-2);color:var(--text-main);font-size:0.95rem;">
                </div>
                <div>
                    <label style="font-size:0.85rem;color:var(--text-secondary);">Apellido Paterno</label>
                    <input type="text" id="curp-ap" placeholder="Apellido Paterno"
                        style="width:100%;margin-top:4px;padding:9px 12px;border:1px solid var(--border);
                        border-radius:8px;background:var(--bg-surface-2);color:var(--text-main);font-size:0.95rem;">
                </div>
                <div>
                    <label style="font-size:0.85rem;color:var(--text-secondary);">Apellido Materno</label>
                    <input type="text" id="curp-am" placeholder="Apellido Materno"
                        style="width:100%;margin-top:4px;padding:9px 12px;border:1px solid var(--border);
                        border-radius:8px;background:var(--bg-surface-2);color:var(--text-main);font-size:0.95rem;">
                </div>
                <div>
                    <label style="font-size:0.85rem;color:var(--text-secondary);">Edad</label>
                    <input type="number" id="curp-edad" placeholder="Edad" min="0" max="120"
                        style="width:100%;margin-top:4px;padding:9px 12px;border:1px solid var(--border);
                        border-radius:8px;background:var(--bg-surface-2);color:var(--text-main);font-size:0.95rem;">
                </div>
            </div>
            <p id="curp-form-feedback" style="margin-top:10px;font-size:0.9rem;min-height:1.2em;"></p>
            <div style="text-align:right;margin-top:10px;">
                <button id="btnGuardarDatos" class="btn-accion">💾 Guardar datos</button>
            </div>
        </div>

        <!-- ETAPA 2: SUBIR PDF -->
        <div id="etapa-pdf" class="bloque-blanco oculto-display">
            <h3>Documento PDF de CURP</h3>
            <p id="curp-saludo" style="color:var(--text-secondary);font-size:0.95rem;"></p>
            <input type="hidden" id="pdf-curp-hidden">
            <div style="margin-top:20px;">
                <label for="curp-pdf-input" class="btn-accion" style="display:inline-block;cursor:pointer;">
                    📎 Seleccionar PDF
                </label>
                <span id="curp-pdf-nombre" style="margin-left:12px;font-size:0.85rem;color:var(--text-secondary);">
                    Sin archivo seleccionado
                </span>
                <input type="file" id="curp-pdf-input" accept=".pdf" style="display:none;">
            </div>
            <p id="pdf-feedback" style="margin-top:10px;font-size:0.9rem;min-height:1.2em;"></p>
            <div style="text-align:right;margin-top:15px;">
                <button id="btnSubirPdf" class="btn-accion">🔍 Validar documento</button>
            </div>
        </div>

        <!-- ETAPA 3: VALIDANDO -->
        <div id="etapa-validando" class="bloque-blanco oculto-display" style="text-align:center;padding:40px;">
            <p style="font-size:1.1rem;color:var(--text-secondary);">⏳ Analizando documento con IA...</p>
        </div>

        <!-- ETAPA 4: RESULTADO -->
        <div id="etapa-resultado" class="bloque-blanco oculto-display">
            <h3>Datos registrados</h3>
            <p id="res-metodo" style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:15px;"></p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="dato-item" style="grid-column:1/-1;">
                    <strong>CURP:</strong>
                    <span id="res-curp" style="font-family:monospace;"></span>
                </div>
                <div class="dato-item">
                    <strong>Nombre(s):</strong>
                    <span id="res-nombre"></span>
                </div>
                <div class="dato-item">
                    <strong>Apellido Paterno:</strong>
                    <span id="res-ap"></span>
                </div>
                <div class="dato-item">
                    <strong>Apellido Materno:</strong>
                    <span id="res-am"></span>
                </div>
                <div class="dato-item">
                    <strong>Edad:</strong>
                    <span id="res-edad"></span>
                </div>
                <div class="dato-item">
                    <strong>Fecha Nacimiento:</strong>
                    <span id="res-fecha"></span>
                </div>
                <div class="dato-item">
                    <strong>Sexo:</strong>
                    <span id="res-sexo"></span>
                </div>
                <div class="dato-item">
                    <strong>Estado:</strong>
                    <span id="res-estado"></span>
                </div>
            </div>
            <div style="margin-top:20px;padding-top:15px;border-top:1px solid var(--border-soft);">
                <a id="res-pdf-link" href="#" target="_blank"
                    style="color:var(--accent);font-weight:bold;text-decoration:none;display:none;"></a>
            </div>
            <div id="pdf-edicion-wrap" style="display:none;margin-top:15px;">
                <label style="font-size:0.85rem;color:var(--text-secondary);">
                    Nuevo PDF (opcional — deja vacío para conservar el actual)
                </label>
                <div style="margin-top:6px;">
                    <label for="curp-pdf-edicion" class="btn-accion"
                        style="display:inline-block;cursor:pointer;font-size:0.85rem;">
                        📎 Seleccionar PDF
                    </label>
                    <span id="curp-pdf-edicion-nombre"
                        style="margin-left:10px;font-size:0.82rem;color:var(--text-secondary);">
                        Sin archivo
                    </span>
                    <input type="file" id="curp-pdf-edicion" accept=".pdf" style="display:none;">
                </div>
            </div>
            <div style="text-align:right;margin-top:20px;display:flex;gap:10px;justify-content:flex-end;">
                <button id="btnEditarDatos" class="btn-accion">✏️ Editar datos</button>
                <button id="btnGuardarEdicion" class="btn-accion" style="display:none;">💾 Guardar cambios</button>
            </div>
        </div>
    `,
};

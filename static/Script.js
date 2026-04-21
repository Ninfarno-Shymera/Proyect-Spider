// --- REFERENCIAS Y ESTADO GLOBAL ---
const areaContenido = document.getElementById("contenido");
const btnToggle = document.getElementById("toggleBtn");

// --- GESTIÓN DE INTERFAZ (NAV Y TEMAS) ---
function gestionarPaneles(idAMostrar) {
    const body = document.body;
    const paneles = ['mainNav', 'gammaNav'];
    const panelObjetivo = document.getElementById(idAMostrar);
    const yaEstaVisible = !panelObjetivo.classList.contains("oculto");

    paneles.forEach(id => document.getElementById(id).classList.add("oculto"));
    body.classList.remove("gamma-abierto");
    body.classList.add("nav-oculto");

    if (!yaEstaVisible) {
        panelObjetivo.classList.remove("oculto");
        body.classList.remove("nav-oculto");
        if (idAMostrar === 'gammaNav') body.classList.add("gamma-abierto");
    }
    actualizarSimbolo();
}

function toggleNav() { gestionarPaneles('mainNav'); }
function cambiarGamma() { gestionarPaneles('gammaNav'); }

function actualizarSimbolo() {
    const navOculto = document.getElementById("mainNav").classList.contains("oculto");
    btnToggle.textContent = navOculto ? "❯" : "❮";
}

function setGamma(tema, boton) {
    const temas = ["gamma-violeta", "gamma-pastel", "gamma-oceano", "gamma-aqua", "gamma-naranja", "gamma-gris", "gamma-bosque", "gamma-monocromo"];
    document.body.classList.remove(...temas);
    if (tema !== 'escarlata') document.body.classList.add(`gamma-${tema}`);

    document.querySelectorAll("#gammaNav button").forEach(b => b.classList.remove("activo"));
    if (boton) boton.classList.add("activo");
}

function mostrarContenido(seccion, btn) {

    const cont = document.getElementById("contenido");

    if (VISTAS[seccion]) {
        cont.innerHTML = VISTAS[seccion];
    }

    if (btn) {
        document.querySelectorAll("#mainNav button").forEach(b => b.classList.remove("activo"));
        btn.classList.add("activo");
    }

}

function activarFormulario() {

    const form = document.getElementById("formPDF");
    if (!form) return;

    form.addEventListener("submit", async function (e) {

        e.preventDefault();

        const formData = new FormData(form);

        const res = await fetch("/procesar", {
            method: "POST",
            body: formData
        });

        const data = await res.json();

        if (data.status === "Éxito") {

            document.getElementById("resultado").innerHTML = `
                <h3>Datos del servicio</h3>

                <p><b>Servicio:</b> ${data.servicio}</p>
                <p><b>Fecha límite:</b> ${data.fecha_limite}</p>
                <p><b>Adeudo anterior:</b> ${data.adeudo_anterior}</p>
                <p><b>Energía:</b> ${data.energia}</p>
                <p><b>Total:</b> ${data.total}</p>
            `;

        } else {
            alert(data.msg);
        }

    });

}


function mostrarSubProyecto(nombre) {

    if (nombre === "cfe") {
        mostrarContenido("proyecto_cfe");
    }

    if (nombre === "analisis") {
        mostrarContenido("proyecto_rectas");
    }

}

function mostrarResultados(data) {

    document.getElementById("resultadoEscaneo").classList.remove("oculto-display");

    document.getElementById("datoServicio").textContent = data.servicio;
    document.getElementById("datoConsumo").textContent = data.consumo;
    document.getElementById("datoPagoAnt").textContent = data.adeudo;
    document.getElementById("datoTotal").textContent = data.total;

    crearGrafica(data.historial, data.total, data.consumo);
}

function crearGrafica(historial, totalActual, consumoActual) {

    const labels = [];
    const pagos = [];
    const consumos = [];

    for (let i = 1; i <= 11; i++) {

        const p = historial["P" + i];

        if (p) {
            labels.push("P" + i);
            pagos.push(p.p);
            consumos.push(p.k);
        }
    }

    labels.push("Actual");
    pagos.push(totalActual);
    consumos.push(consumoActual);

    const ctx = document.getElementById("graficaConsumo").getContext("2d");

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Pago ($)",
                    data: pagos,
                    borderColor: "#ff4444",
                    backgroundColor: "rgba(255,0,0,0.1)",
                    tension: 0.3
                },
                {
                    label: "Consumo (kWh)",
                    data: consumos,
                    borderColor: "#3399ff",
                    backgroundColor: "rgba(0,100,255,0.1)",
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: "top"
                }
            }
        }
    });

}

document.addEventListener("change", async function (e) {
    if (e.target.id === "fileInput") {
        const file = e.target.files[0];
        if (file) await procesarPDF(file);
    }
});

//Proyect 1

async function procesarPDF(file) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/procesar", {
        method: "POST",
        body: formData
    });

    const data = await res.json();

    if (data.status !== "Éxito") {
        alert("Error procesando PDF");
        return;
    }

    mostrarResultados(data);
}

function mostrarResultados(data) {
    document.getElementById("resultadoEscaneo").classList.remove("oculto-display");

    document.getElementById("datoServicio").textContent = data.servicio;
    document.getElementById("datoConsumo").textContent = data.consumo;
    document.getElementById("datoPagoAnt").textContent = data.adeudo;
    document.getElementById("datoTotal").textContent = data.total;

    crearGrafica(data.historial, data.total, data.consumo);
}

function crearGrafica(historial, totalActual, consumoActual) {
    const labels = [], pagos = [], consumos = [];

    for (let i = 1; i <= 11; i++) {
        const p = historial["P" + i];
        if (p) {
            labels.push("P" + i);
            pagos.push(p.p);
            consumos.push(p.k);
        }
    }
    labels.push("Actual");
    pagos.push(totalActual);
    consumos.push(consumoActual);

    const ctx = document.getElementById("graficaConsumo").getContext("2d");

    new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: "Pago ($)", data: pagos, borderColor: "#ff4444", backgroundColor: "rgba(255,0,0,0.1)", tension: 0.3 },
                { label: "Consumo (kWh)", data: consumos, borderColor: "#3399ff", backgroundColor: "rgba(0,100,255,0.1)", tension: 0.3 }
            ]
        },
        options: { responsive: true, plugins: { legend: { position: "top" } } }
    });
}

// --- Estadísticas globales ---
async function cargarEstadisticasGlobales() {
    const res = await fetch("/estadisticas"); // nuevo endpoint en Flask que lee el Excel
    const data = await res.json();

    document.getElementById("resumenGlobal").classList.remove("oculto-display");

    document.getElementById("st-media").textContent = "$" + data.media;
    document.getElementById("st-mediana").textContent = "$" + data.mediana;
    document.getElementById("st-moda").textContent = "$" + data.moda;
    document.getElementById("st-varianza").textContent = data.varianza;
    document.getElementById("st-desv").textContent = "$" + data.desv;

    // Actualizar gráficas globales
    actualizarGraficaGlobal("graficaGlobal", data.labels, data.pagos);
    actualizarGraficaGlobal("graficaConsumoGlobal", data.labels, data.consumos);
}

function actualizarGraficaGlobal(idCanvas, labels, dataset) {
    const ctx = document.getElementById(idCanvas).getContext("2d");
    new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{ label: idCanvas.includes("Consumo") ? "Consumo (kWh)" : "Pago ($)", data: dataset, borderColor: "#33aa33", backgroundColor: "rgba(50,200,50,0.1)", tension: 0.3 }]
        },
        options: { responsive: true, plugins: { legend: { position: "top" } } }
    });
}

async function cargarEstadisticasGlobales() {
    try {
        const res = await fetch('/estadisticas');
        const data = await res.json();

        if (data.status !== "Éxito") {
            alert(data.msg);
            return;
        }

        // Mostrar estadísticas en los elementos
        document.getElementById("st-media").textContent = `$${data.media}`;
        document.getElementById("st-mediana").textContent = `$${data.mediana}`;
        document.getElementById("st-moda").textContent = `$${data.moda}`;
        document.getElementById("st-varianza").textContent = data.varianza;
        document.getElementById("st-desv").textContent = `$${data.desv}`;

        // Mostrar contenedor de resumen global
        document.getElementById("resumenGlobal").classList.remove("oculto-display");

        // Graficas globales
        const ctx = document.getElementById("graficaGlobal").getContext("2d");
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Array.from({ length: data.promedio_mensual.length }, (_, i) => `P${i + 1}`),
                datasets: [{
                    label: "Promedio mensual de pagos ($)",
                    data: data.promedio_mensual,
                    backgroundColor: "rgba(255, 165, 0, 0.6)"
                }]
            }
        });

    } catch (err) {
        alert("Error cargando estadísticas: " + err);
    }
}

//Proyect 3

document.addEventListener("change", function (e) {

    if (e.target.id === "fileInputRecta") {

        const file = e.target.files[0];

        if (file) {
            procesarMinCuad(file);
        }

    }

});

async function procesarMinCuad(file) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/mincuad", {
        method: "POST",
        body: formData
    });

    const data = await res.json();

    if (data.status !== "Éxito") {
        alert(data.msg);
        return;
    }

    mostrarResultadoRecta(data);
}

function crearGraficaRecta(data) {
    const canvas = document.getElementById("graficaRecta");

    if (!canvas) {
        console.error("Canvas graficaRecta no encontrado en el DOM");
        return;
    }

    const ctx = canvas.getContext("2d");

    const puntos = data.x.map((v, i) => ({ x: v, y: data.y[i] }));

    const minX = Math.min(...data.x);
    const maxX = Math.max(...data.x);
    const puntosLinea = [
        { x: minX, y: data.m * minX + data.b },
        { x: maxX, y: data.m * maxX + data.b }
    ];

    if (window.graficaRecta instanceof Chart) {
        window.graficaRecta.destroy();
    }

    window.graficaRecta = new Chart(ctx, {
        type: "scatter",
        data: {
            datasets: [
                {
                    label: "Datos Experimentales",
                    data: puntos,
                    backgroundColor: "#6d3cff",
                    borderColor: "#6d3cff",
                    pointRadius: 5
                },
                {
                    label: "Recta de Regresión",
                    type: "line",
                    data: puntosLinea,
                    borderColor: "#ff4444",
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 0,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: "linear",
                    position: "bottom",
                    title: { display: true, text: 'Eje X' }
                },
                y: {
                    title: { display: true, text: 'Eje Y' }
                }
            },
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
}

function mostrarResultadoRecta(data) {
    const contenedor = document.getElementById("resultadoRecta");

    if (!contenedor) {
        console.error("No se encontró el contenedor #resultadoRecta. ¿Ya entraste a la sección?");
        return;
    }

    contenedor.classList.remove("oculto-display");

    const m = typeof data.m === 'number' ? data.m.toFixed(4) : data.m;
    const b = typeof data.b === 'number' ? data.b.toFixed(4) : data.b;

    document.getElementById("valorM").textContent = m;
    document.getElementById("valorB").textContent = b;
    document.getElementById("ecuacionRecta").textContent = `y = ${m}x + ${b}`;

    crearGraficaRecta(data);
}

// --- Inicialización ---
window.onload = () => {
    actualizarSimbolo();
    mostrarContenido('inicio');
};
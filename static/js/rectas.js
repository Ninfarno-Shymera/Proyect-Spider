// ─────────────────────────────────────────
//  PROYECTO RECTAS — Mínimos cuadrados
// ─────────────────────────────────────────


// ─────────────────────────────────────────
//  ESCANEO DE XLSX
// ─────────────────────────────────────────
document.addEventListener("change", async function (e) {
    if (e.target.id === "fileInputRecta") {
        const file = e.target.files[0];
        if (file) await procesarMinCuad(file);
    }
});

async function procesarMinCuad(file) {
    const formData = new FormData();
    formData.append("file", file);

    try {
        const res = await fetch("/mincuad", { method: "POST", body: formData });
        const data = await res.json();

        if (data.status !== "Éxito") {
            alert(data.msg);
            return;
        }

        mostrarResultadoRecta(data);

    } catch (err) {
        alert("Error de conexión: " + err);
    }
}


// ─────────────────────────────────────────
//  MOSTRAR RESULTADOS
// ─────────────────────────────────────────
function mostrarResultadoRecta(data) {
    const contenedor = document.getElementById("resultadoRecta");

    if (!contenedor) {
        console.error("No se encontró #resultadoRecta");
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

function crearGraficaRecta(data) {
    const canvas = document.getElementById("graficaRecta");

    if (!canvas) {
        console.error("Canvas graficaRecta no encontrado");
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
                x: { type: "linear", position: "bottom", title: { display: true, text: "Eje X" } },
                y: { title: { display: true, text: "Eje Y" } }
            },
            plugins: { legend: { position: "top" } }
        }
    });
}
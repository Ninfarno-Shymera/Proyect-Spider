// ─────────────────────────────────────────
//  PROYECTO CFE — Procesamiento y gráficas
// ─────────────────────────────────────────

// ─────────────────────────────────────────
//  ESCANEO DE PDF
// ─────────────────────────────────────────
let escaneoMultiple = false;
let graficaCFE = null;
let graficaGlobalPagos = null;
let graficaGlobalConsumo = null;

document.addEventListener("change", async function (e) {
  if (e.target.id === "fileInput") {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const progreso = document.getElementById("progresoCFE");
    const texto = document.getElementById("progresoTexto");
    const barra = document.getElementById("progresoBar");

    // ── Ocultar resultados anteriores
    document.getElementById("resultadoEscaneo").classList.add("oculto-display");
    document.getElementById("resumenGlobal").classList.add("oculto-display");

    escaneoMultiple = files.length > 1;
    progreso.classList.remove("oculto-display");

    for (let i = 0; i < files.length; i++) {
      const porcentaje = Math.round((i / files.length) * 100);
      texto.textContent = `Escaneando ${i + 1} de ${files.length}: ${files[i].name}`;
      barra.style.width = porcentaje + "%";

      await procesarPDF(files[i]);
    }

    barra.style.width = "100%";

    if (files.length === 1) {
      texto.textContent = "✅ Archivo procesado";
    } else {
      texto.textContent = `✅ ${files.length} archivos procesados, cargando estadísticas...`;
      await cargarEstadisticasGlobales();
    }

    setTimeout(() => {
      progreso.classList.add("oculto-display");
      barra.style.width = "0%";
    }, 3000);
  }
});

async function procesarPDF(file) {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/procesar", { method: "POST", body: formData });
    const data = await res.json();

    if (data.status !== "Éxito") {
      alert("Error procesando PDF: " + data.msg);
      return;
    }

    // ── Solo muestra resultado individual si es un solo archivo
    if (!escaneoMultiple) {
      mostrarResultadosCFE(data);
    }
  } catch (err) {
    alert("Error de conexión: " + err);
  }
}

// ─────────────────────────────────────────
//  MOSTRAR RESULTADOS
// ─────────────────────────────────────────
function mostrarResultadosCFE(data) {
  document
    .getElementById("resultadoEscaneo")
    .classList.remove("oculto-display");

  document.getElementById("datoServicio").textContent = data.servicio;
  document.getElementById("datoConsumo").textContent = data.consumo;
  document.getElementById("datoPagoAnt").textContent = data.adeudo;
  document.getElementById("datoTotal").textContent = data.total;

  crearGraficaCFE(data.historial, data.total, data.consumo);
}

function crearGraficaCFE(historial, totalActual, consumoActual) {
  const labels = [],
    pagos = [],
    consumos = [];

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
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Pago ($)",
          data: pagos,
          borderColor: "#ff4444",
          backgroundColor: "rgba(255,0,0,0.1)",
          tension: 0.3,
        },
        {
          label: "Consumo (kWh)",
          data: consumos,
          borderColor: "#3399ff",
          backgroundColor: "rgba(0,100,255,0.1)",
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "top" } },
    },
  });
}

// ─────────────────────────────────────────
//  ESTADÍSTICAS GLOBALES
// ─────────────────────────────────────────
async function cargarEstadisticasGlobales() {
  try {
    const res = await fetch("/estadisticas");
    const data = await res.json();

    if (data.status !== "Éxito") {
      alert(data.msg);
      return;
    }

    document.getElementById("resumenGlobal").classList.remove("oculto-display");

    // ── Pagos
    document.getElementById("st-media").textContent = `$${data.media}`;
    document.getElementById("st-mediana").textContent = `$${data.mediana}`;
    document.getElementById("st-moda").textContent = `$${data.moda}`;
    document.getElementById("st-varianza").textContent = data.varianza;
    document.getElementById("st-desv").textContent = `$${data.desv}`;

    // ── Consumos
    document.getElementById("st-media-consumo").textContent =
      `${data.media_consumo} kWh`;
    document.getElementById("st-mediana-consumo").textContent =
      `${data.mediana_consumo} kWh`;
    document.getElementById("st-moda-consumo").textContent =
      `${data.moda_consumo} kWh`;
    document.getElementById("st-varianza-consumo").textContent =
      data.varianza_consumo;
    document.getElementById("st-desv-consumo").textContent =
      `${data.desv_consumo} kWh`;

    // ── Gráficas
    crearGraficaGlobal(
      "graficaGlobal",
      data.promedio_mensual,
      "Promedio de Pagos ($)",
      "rgba(255,165,0,0.2)",
      "#f97316",
    );
    crearGraficaGlobal(
      "graficaConsumoGlobal",
      data.consumos,
      "Promedio de Consumo (kWh)",
      "rgba(50,200,50,0.2)",
      "#22c55e",
    );
  } catch (err) {
    alert("Error cargando estadísticas: " + err);
  }
}

function crearGraficaGlobal(idCanvas, dataset, label, bgColor, borderColor) {
  const ctx = document.getElementById(idCanvas).getContext("2d");

  if (idCanvas === "graficaGlobal" && graficaGlobalPagos instanceof Chart) {
    graficaGlobalPagos.destroy();
  }
  if (
    idCanvas === "graficaConsumoGlobal" &&
    graficaGlobalConsumo instanceof Chart
  ) {
    graficaGlobalConsumo.destroy();
  }

  const nueva = new Chart(ctx, {
    type: "line",
    data: {
      labels: dataset.map((_, i) => `P${i + 1}`),
      datasets: [
        {
          label,
          data: dataset,
          borderColor: borderColor,
          backgroundColor: bgColor,
          tension: 0.3,
          fill: true,
          pointRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top" } },
      scales: {
        y: { beginAtZero: false },
      },
    },
  });

  if (idCanvas === "graficaGlobal") graficaGlobalPagos = nueva;
  if (idCanvas === "graficaConsumoGlobal") graficaGlobalConsumo = nueva;
}

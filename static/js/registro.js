// ─────────────────────────────────────────
//  MÓDULO CURP — Registro de Personas
//  Flujo:
//    1. Formulario de datos → guardar
//    2. Si ya registrado → mostrar directo subida de PDF
//    3. Subir PDF → validar con IA
//    4a. Válido   → mostrar tarjeta solo lectura + PDF adjunto + botón editar
//    4b. No válido → mensaje + pedir nuevo PDF
//    5. Editar    → reactiva formulario
// ─────────────────────────────────────────

const CURP_STORAGE_KEY = "curp_usuario";

// ─────────────────────────────────────────
//  INICIALIZAR — llamar al cargar la vista
// ─────────────────────────────────────────
function iniciarModuloCurp() {
  const guardado = leerSesionCurp();
  if (guardado) {
    mostrarEtapa("pdf", guardado);
  } else {
    mostrarEtapa("formulario");
  }
}

// ─────────────────────────────────────────
//  SESIÓN LOCAL
// ─────────────────────────────────────────
function guardarSesionCurp(datos) {
  localStorage.setItem(
    CURP_STORAGE_KEY,
    JSON.stringify({
      curp: datos.CURP || datos.curp || "",
      nombre: datos.Nombre || datos.nombre || "",
      ap: datos.ApellidoPaterno || datos.apellido_paterno || "",
    }),
  );
}

function leerSesionCurp() {
  try {
    const raw = localStorage.getItem(CURP_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function limpiarSesionCurp() {
  localStorage.removeItem(CURP_STORAGE_KEY);
}

// ─────────────────────────────────────────
//  CONTROL DE ETAPAS
// ─────────────────────────────────────────
function mostrarEtapa(etapa, datos = null) {
  const etapas = [
    "etapa-formulario",
    "etapa-pdf",
    "etapa-validando",
    "etapa-resultado",
  ];
  etapas.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add("oculto-display");
  });

  const objetivo = document.getElementById("etapa-" + etapa);
  if (objetivo) objetivo.classList.remove("oculto-display");

  if (etapa === "pdf" && datos) {
    const saludo = document.getElementById("curp-saludo");
    if (saludo)
      saludo.textContent = `Hola, ${datos.nombre} ${datos.ap}. Ahora sube tu documento PDF de CURP.`;
    const curpHidden = document.getElementById("pdf-curp-hidden");
    if (curpHidden) curpHidden.value = datos.curp;
  }
}

// ─────────────────────────────────────────
//  PASO 1 — GUARDAR DATOS
// ─────────────────────────────────────────
document.addEventListener("click", async function (e) {
  if (e.target.id === "btnGuardarDatos") await guardarDatosCurp();
});

async function guardarDatosCurp() {
  const curp = document
    .getElementById("curp-input")
    ?.value.trim()
    .toUpperCase();
  const nombre = document.getElementById("curp-nombre")?.value.trim();
  const ap = document.getElementById("curp-ap")?.value.trim();
  const am = document.getElementById("curp-am")?.value.trim();
  const edad = document.getElementById("curp-edad")?.value.trim();
  const feedback = document.getElementById("curp-form-feedback");

  if (!curp || curp.length !== 18) {
    mostrarFeedback(
      feedback,
      "⚠️ Ingresa una CURP válida de 18 caracteres.",
      "advertencia",
    );
    return;
  }
  if (!nombre || !ap) {
    mostrarFeedback(
      feedback,
      "⚠️ Nombre y apellido paterno son obligatorios.",
      "advertencia",
    );
    return;
  }

  mostrarFeedback(feedback, "Guardando...", "cargando");

  const fd = new FormData();
  fd.append("curp", curp);
  fd.append("nombre", nombre);
  fd.append("apellido_paterno", ap);
  fd.append("apellido_materno", am);
  fd.append("edad", edad);

  try {
    const res = await fetch("/curp/registrar", { method: "POST", body: fd });
    const data = await res.json();

    if (data.status === "Éxito" || data.status === "Duplicado") {
      guardarSesionCurp(data.datos);
      mostrarFeedback(feedback, "✅ Datos guardados.", "exito");
      setTimeout(() => mostrarEtapa("pdf", leerSesionCurp()), 800);
    } else {
      mostrarFeedback(feedback, "❌ " + data.msg, "error");
    }
  } catch (err) {
    mostrarFeedback(feedback, "❌ Error de conexión.", "error");
  }
}

// ─────────────────────────────────────────
//  PASO 2 — SUBIR PDF
// ─────────────────────────────────────────
document.addEventListener("change", function (e) {
  if (e.target.id === "curp-pdf-input") {
    const nombre = e.target.files[0]?.name || "Sin archivo seleccionado";
    const label = document.getElementById("curp-pdf-nombre");
    if (label) label.textContent = nombre;
  }
});

document.addEventListener("click", async function (e) {
  if (e.target.id === "btnSubirPdf") await subirPdfCurp();
});

async function subirPdfCurp() {
  const curp = document.getElementById("pdf-curp-hidden")?.value;
  const archivo = document.getElementById("curp-pdf-input")?.files[0];
  const feedback = document.getElementById("pdf-feedback");

  if (!archivo) {
    mostrarFeedback(feedback, "⚠️ Selecciona un archivo PDF.", "advertencia");
    return;
  }

  mostrarEtapa("validando");

  const fd = new FormData();
  fd.append("curp", curp);
  fd.append("pdf", archivo);

  try {
    const res = await fetch("/curp/validar_pdf", { method: "POST", body: fd });
    const data = await res.json();

    if (data.status === "Éxito") {
      mostrarResultadoCurp(data, false);
    } else {
      mostrarEtapa("pdf");
      mostrarFeedback(
        document.getElementById("pdf-feedback"),
        "⚠️ " + data.msg + " — Sube un documento oficial correcto.",
        "error",
      );
    }
  } catch (err) {
    mostrarEtapa("pdf");
    mostrarFeedback(
      document.getElementById("pdf-feedback"),
      "❌ Error de conexión.",
      "error",
    );
  }
}

// ─────────────────────────────────────────
//  PASO 4A — MOSTRAR RESULTADO VALIDADO
// ─────────────────────────────────────────
function mostrarResultadoCurp(data, modoEdicion) {
  mostrarEtapa("resultado");

  const datos = data.datos || {};
  const curp = datos.CURP || leerSesionCurp()?.curp || "";

  const campos = [
    ["res-curp", datos.CURP || "—"],
    ["res-nombre", datos.Nombre || "—"],
    ["res-ap", datos.ApellidoPaterno || "—"],
    ["res-am", datos.ApellidoMaterno || "—"],
    ["res-edad", datos.Edad || "—"],
    ["res-fecha", datos.FechaNacimiento || "—"],
    ["res-sexo", datos.Sexo || "—"],
    ["res-estado", datos.Estado || "—"],
  ];

  const inputStyle = `width:100%;padding:6px 10px;border:1px solid var(--border);
    border-radius:6px;background:var(--bg-surface-2);color:var(--text-main);font-size:0.95rem;`;

  campos.forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (modoEdicion) {
      el.innerHTML = `<input type="text" value="${val === "—" ? "" : val}" style="${inputStyle}">`;
    } else {
      el.textContent = val;
    }
  });

  // PDF adjunto
  const pdfLink = document.getElementById("res-pdf-link");
  if (pdfLink) {
    pdfLink.href = `/curp/pdf/${curp}`;
    pdfLink.textContent = `📄 Ver documento: ${data.archivo || "CURP.pdf"}`;
    pdfLink.target = "_blank";
    pdfLink.style.display = "inline-block";
  }

  // Campo nuevo PDF solo en edición
  const pdfEdicionWrap = document.getElementById("pdf-edicion-wrap");
  if (pdfEdicionWrap)
    pdfEdicionWrap.style.display = modoEdicion ? "block" : "none";

  // Botones
  const btnEditar = document.getElementById("btnEditarDatos");
  const btnGuardar = document.getElementById("btnGuardarEdicion");
  if (btnEditar)
    btnEditar.style.display = modoEdicion ? "none" : "inline-block";
  if (btnGuardar)
    btnGuardar.style.display = modoEdicion ? "inline-block" : "none";
  if (btnGuardar) btnGuardar.dataset.curp = curp;

  // Método de lectura
  const metodoEl = document.getElementById("res-metodo");
  if (metodoEl && data.metodo) {
    const textos = {
      nativo: "✅ Documento leído directamente",
      ocr: "🔍 Documento leído con OCR",
      ocr_fallido: "⚠️ OCR con errores — validado por IA",
    };
    metodoEl.textContent = textos[data.metodo] || data.metodo;
  }
}

// ─────────────────────────────────────────
//  PASO 5 — EDITAR
// ─────────────────────────────────────────
document.addEventListener("click", function (e) {
  if (e.target.id === "btnEditarDatos") {
    mostrarResultadoCurp({ datos: leerDatosResultado(), archivo: null }, true);
  }
});

document.addEventListener("click", async function (e) {
  if (e.target.id === "btnGuardarEdicion")
    await guardarEdicionCurp(e.target.dataset.curp);
});

async function guardarEdicionCurp(curp) {
  const fd = new FormData();
  fd.append("curp", curp);
  fd.append("nombre", leerInputResultado("res-nombre"));
  fd.append("apellido_paterno", leerInputResultado("res-ap"));
  fd.append("apellido_materno", leerInputResultado("res-am"));
  fd.append("edad", leerInputResultado("res-edad"));

  const pdfNuevo = document.getElementById("curp-pdf-edicion")?.files[0];
  if (pdfNuevo) fd.append("pdf_nuevo", pdfNuevo);

  try {
    const res = await fetch("/curp/editar", { method: "POST", body: fd });
    const data = await res.json();

    if (data.status !== "Éxito") {
      alert("Error al guardar: " + data.msg);
      return;
    }

    guardarSesionCurp(data.datos);

    if (pdfNuevo) {
      const fd2 = new FormData();
      fd2.append("curp", curp);
      fd2.append("pdf", pdfNuevo);
      const resPdf = await fetch("/curp/validar_pdf", {
        method: "POST",
        body: fd2,
      });
      const dataPdf = await resPdf.json();
      mostrarResultadoCurp(
        dataPdf.status === "Éxito"
          ? dataPdf
          : { datos: data.datos, archivo: null },
        false,
      );
      if (dataPdf.status !== "Éxito") alert("PDF no aceptado: " + dataPdf.msg);
    } else {
      mostrarResultadoCurp({ datos: data.datos, archivo: null }, false);
    }
  } catch (err) {
    alert("Error de conexión: " + err);
  }
}

// ─────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────
function mostrarFeedback(el, msg, tipo) {
  if (!el) return;
  const colores = {
    exito: "#22c55e",
    error: "#e01b2d",
    advertencia: "#f59e0b",
    info: "var(--accent)",
    cargando: "var(--text-secondary)",
  };
  el.textContent = msg;
  el.style.color = colores[tipo] || "var(--text-main)";
}

function leerDatosResultado() {
  const mapa = {
    CURP: "res-curp",
    Nombre: "res-nombre",
    ApellidoPaterno: "res-ap",
    ApellidoMaterno: "res-am",
    Edad: "res-edad",
    FechaNacimiento: "res-fecha",
    Sexo: "res-sexo",
    Estado: "res-estado",
  };
  const datos = {};
  for (const [key, id] of Object.entries(mapa)) {
    const el = document.getElementById(id);
    datos[key] = el ? (el.querySelector("input")?.value ?? el.textContent) : "";
  }
  return datos;
}

function leerInputResultado(id) {
  const el = document.getElementById(id);
  if (!el) return "";
  return el.querySelector("input")?.value ?? el.textContent ?? "";
}

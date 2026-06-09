// ─────────────────────────────────────────
//  MÓDULO CURP — Registro de Personas
// ─────────────────────────────────────────

const CURP_STORAGE_KEY = "curp_usuario";

// ─────────────────────────────────────────
//  INICIALIZAR
// ─────────────────────────────────────────
async function iniciarModuloCurp() {
  const guardado = leerSesionCurp();
  if (!guardado) {
    mostrarEtapa("formulario");
    return;
  }

  // Consultar al servidor el estado actual del registro
  try {
    const res = await fetch("/curp/verificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ curp: guardado.curp }),
    });
    const data = await res.json();

    if (data.status === "Existe") {
      const datos = data.datos;
      if (datos.Validado && !datos.Expirado) {
        // Ya validado y vigente → mostrar resultado directo
        mostrarResultadoCurp({ datos, archivo: datos.ArchivoActual }, false);
      } else if (datos.Expirado) {
        // Expirado → mostrar resultado con aviso y campo de nuevo PDF
        mostrarResultadoCurp({ datos, archivo: null }, false);
      } else {
        // Registrado pero sin PDF válido → pedir PDF
        mostrarEtapa("pdf", guardado);
      }
    } else {
      // No existe en el servidor (se limpió?) → volver al formulario
      limpiarSesionCurp();
      mostrarEtapa("formulario");
    }
  } catch {
    // Sin conexión → ir a PDF como fallback
    mostrarEtapa("pdf", guardado);
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
//  ETAPAS
// ─────────────────────────────────────────
function mostrarEtapa(etapa, datos = null) {
  [
    "etapa-formulario",
    "etapa-pdf",
    "etapa-validando",
    "etapa-resultado",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add("oculto-display");
  });

  const objetivo = document.getElementById("etapa-" + etapa);
  if (objetivo) objetivo.classList.remove("oculto-display");

  if (etapa === "pdf" && datos) {
    const saludo = document.getElementById("curp-saludo");
    if (saludo)
      saludo.textContent = `Hola, ${datos.nombre} ${datos.ap}. Sube tu documento PDF de CURP.`;
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
  const fb = document.getElementById("curp-form-feedback");

  if (!curp || curp.length !== 18) {
    mostrarFeedback(
      fb,
      "⚠️ Ingresa una CURP válida de 18 caracteres.",
      "advertencia",
    );
    return;
  }
  if (!nombre || !ap) {
    mostrarFeedback(
      fb,
      "⚠️ Nombre y apellido paterno son obligatorios.",
      "advertencia",
    );
    return;
  }

  mostrarFeedback(fb, "Guardando...", "cargando");

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
      mostrarFeedback(fb, "✅ Datos guardados.", "exito");

      // Si ya está validado y no expirado → mostrar resultado directo
      if (data.datos.Validado && !data.datos.Expirado) {
        setTimeout(
          () =>
            mostrarResultadoCurp(
              { datos: data.datos, archivo: data.datos.ArchivoActual },
              false,
            ),
          800,
        );
      } else {
        setTimeout(() => mostrarEtapa("pdf", leerSesionCurp()), 800);
      }
    } else {
      mostrarFeedback(fb, "❌ " + data.msg, "error");
    }
  } catch {
    mostrarFeedback(fb, "❌ Error de conexión.", "error");
  }
}

// ─────────────────────────────────────────
//  PASO 2 — SUBIR PDF
// ─────────────────────────────────────────
document.addEventListener("change", function (e) {
  if (e.target.id === "curp-pdf-input") {
    const label = document.getElementById("curp-pdf-nombre");
    if (label)
      label.textContent = e.target.files[0]?.name || "Sin archivo seleccionado";
  }
  if (e.target.id === "curp-pdf-edicion") {
    const label = document.getElementById("curp-pdf-edicion-nombre");
    if (label) label.textContent = e.target.files[0]?.name || "Sin archivo";
  }
});

document.addEventListener("click", async function (e) {
  if (e.target.id === "btnSubirPdf") await subirPdfCurp();
});

async function subirPdfCurp() {
  const curp = document.getElementById("pdf-curp-hidden")?.value;
  const archivo = document.getElementById("curp-pdf-input")?.files[0];
  const fb = document.getElementById("pdf-feedback");

  if (!archivo) {
    mostrarFeedback(fb, "⚠️ Selecciona un archivo PDF.", "advertencia");
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
  } catch {
    mostrarEtapa("pdf");
    mostrarFeedback(
      document.getElementById("pdf-feedback"),
      "❌ Error de conexión.",
      "error",
    );
  }
}

// ─────────────────────────────────────────
//  PASO 4A — MOSTRAR RESULTADO
// ─────────────────────────────────────────
function mostrarResultadoCurp(data, modoEdicion) {
  mostrarEtapa("resultado");

  const datos = data.datos || {};
  const curp = datos.CURP || leerSesionCurp()?.curp || "";

  // Si está expirado en modo lectura → mostrar aviso
  const avisoExpiry = document.getElementById("res-aviso-expirado");
  if (avisoExpiry) {
    avisoExpiry.style.display =
      !modoEdicion && datos.Expirado ? "block" : "none";
  }

  const campos = [
    ["res-curp", datos.CURP || "—"],
    ["res-nombre", datos.Nombre || "—"],
    ["res-ap", datos.ApellidoPaterno || "—"],
    ["res-am", datos.ApellidoMaterno || "—"],
    ["res-edad", datos.Edad || "—"],
    ["res-fecha", datos.FechaNacimientoLarga || datos.FechaNacimiento || "—"],
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

  // PDF adjunto — solo si hay archivo y no está expirado
  const pdfLink = document.getElementById("res-pdf-link");
  const archivo = data.archivo || datos.ArchivoActual || "";
  if (pdfLink) {
    if (archivo && !datos.Expirado) {
      pdfLink.href = `/curp/pdf/${curp}`;
      pdfLink.textContent = `📄 Ver documento: ${archivo}`;
      pdfLink.target = "_blank";
      pdfLink.style.display = "inline-block";
    } else {
      pdfLink.style.display = "none";
    }
  }

  // Campo nuevo PDF en edición o cuando está expirado
  const pdfEdicionWrap = document.getElementById("pdf-edicion-wrap");
  if (pdfEdicionWrap) {
    pdfEdicionWrap.style.display =
      modoEdicion || datos.Expirado ? "block" : "none";
  }

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
      ocr_fallido: "⚠️ OCR con errores",
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

  try {
    const res = await fetch("/curp/editar", { method: "POST", body: fd });
    const data = await res.json();

    if (data.status !== "Éxito") {
      alert("Error al guardar: " + data.msg);
      return;
    }

    guardarSesionCurp(data.datos);

    // Si subió PDF nuevo (cuando estaba expirado o en edición)
    const pdfNuevo = document.getElementById("curp-pdf-edicion")?.files[0];
    if (pdfNuevo) {
      const fd2 = new FormData();
      fd2.append("curp", curp);
      fd2.append("pdf", pdfNuevo);
      const resPdf = await fetch("/curp/validar_pdf", {
        method: "POST",
        body: fd2,
      });
      const dataPdf = await resPdf.json();

      if (dataPdf.status === "Éxito") {
        guardarSesionCurp(dataPdf.datos);
        mostrarResultadoCurp(dataPdf, false);
      } else {
        alert("PDF no aceptado: " + dataPdf.msg);
        mostrarResultadoCurp({ datos: data.datos, archivo: null }, false);
      }
    } else {
      mostrarResultadoCurp({ datos: data.datos, archivo: null }, false);
    }
  } catch {
    alert("Error de conexión.");
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

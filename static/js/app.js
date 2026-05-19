// ─────────────────────────────────────────
//  CONFIGURACIÓN — solo cambia esto
// ─────────────────────────────────────────
const TEMA_BASE = "violeta";

// ─────────────────────────────────────────
//  LISTA DE TEMAS DISPONIBLES
// ─────────────────────────────────────────
const TEMAS = [
  "violeta",
  "escarlata",
  "pastel",
  "oceano",
  "aqua",
  "naranja",
  "gris",
  "bosque",
  "monocromo",
];

// ─────────────────────────────────────────
//  NAVEGACIÓN
// ─────────────────────────────────────────
const btnToggle = document.getElementById("toggleBtn");

function gestionarPaneles(idAMostrar) {
  const body = document.body;
  const paneles = ["mainNav", "gammaNav"];
  const panelObjetivo = document.getElementById(idAMostrar);
  const yaEstaVisible = !panelObjetivo.classList.contains("oculto");

  paneles.forEach((id) => document.getElementById(id).classList.add("oculto"));
  body.classList.remove("gamma-abierto");
  body.classList.add("nav-oculto");

  if (!yaEstaVisible) {
    panelObjetivo.classList.remove("oculto");
    body.classList.remove("nav-oculto");
    if (idAMostrar === "gammaNav") body.classList.add("gamma-abierto");
  }

  actualizarSimbolo();
}

function toggleNav() {
  gestionarPaneles("mainNav");
}
function cambiarGamma() {
  gestionarPaneles("gammaNav");
}

function actualizarSimbolo() {
  const navOculto = document
    .getElementById("mainNav")
    .classList.contains("oculto");
  btnToggle.textContent = navOculto ? "❯" : "❮";
}

// ─────────────────────────────────────────
//  TEMAS
// ─────────────────────────────────────────
function setGamma(tema, boton) {
  document.body.classList.remove(...TEMAS.map((t) => `gamma-${t}`));
  document.body.classList.add(`gamma-${tema}`);

  document
    .querySelectorAll("#gammaNav button")
    .forEach((b) => b.classList.remove("activo"));
  if (boton) boton.classList.add("activo");

  if (typeof refrescarColoresSprite === "function") {
    refrescarColoresSprite();
  }
}

// ─────────────────────────────────────────
//  CONTENIDO Y VISTAS
// ─────────────────────────────────────────
function mostrarContenido(seccion, btn) {
  const cont = document.getElementById("contenido");

  if (VISTAS[seccion]) {
    cont.innerHTML = VISTAS[seccion];
  }

  if (btn) {
    document
      .querySelectorAll("#mainNav button")
      .forEach((b) => b.classList.remove("activo"));
    btn.classList.add("activo");
  }
}

function mostrarSubProyecto(nombre) {
  if (nombre === "cfe") mostrarContenido("proyecto_cfe");
  if (nombre === "analisis") mostrarContenido("proyecto_rectas");
}

// ─────────────────────────────────────────
//  INICIALIZACIÓN
// ─────────────────────────────────────────
window.onload = () => {
  actualizarSimbolo();
  setGamma(TEMA_BASE);
  mostrarContenido("inicio");
};

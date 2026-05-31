// ─────────────────────────────────────────
//  CONFIGURACIÓN
// ─────────────────────────────────────────
const SPRITE_BASE = "/sprites/";
let spriteActual = "";

const VELOCIDADES = {
  icono: 250,
  despertando: 500,
  sorpresa: 150,
  idle: 500,
};

const TAMANIOS = {
  icono: 48,
  redux: 96,
  completo: 192,
};

// ─────────────────────────────────────────
//  MAPA DE ANIMACIONES
// ─────────────────────────────────────────
const ANIMACIONES = {
  idle_frente: ["Carmilla00.png", "Carmilla01.png"],
  idle_arriba: ["Carmilla02.png", "Carmilla03.png"],
  idle_derecha: ["Carmilla04.png", "Carmilla05.png"],
  idle_abajo: ["Carmilla06.png", "Carmilla07.png"],
  parpadeo_frente: ["Carmilla08.png", "Carmilla09.png"],
  parpadeo_arriba: ["Carmilla10.png", "Carmilla11.png"],
  parpadeo_derecha: ["Carmilla12.png", "Carmilla13.png"],
  parpadeo_abajo: ["Carmilla14.png", "Carmilla15.png"],
  sorpresa_exaltada: ["Carmilla16.png", "Carmilla17.png"],
  sorpresa_cerrado: ["Carmilla18.png", "Carmilla19.png"],
  sorpresa_calma: ["Carmilla20.png", "Carmilla21.png"],
  sonriendo: ["Carmilla22.png", "Carmilla23.png"],
  llanto: ["Carmilla24.png", "Carmilla25.png"],
  redux_frente: ["Carmilla26.png", "Carmilla27.png"],
  redux_arriba: ["Carmilla28.png", "Carmilla29.png"],
  redux_derecha: ["Carmilla30.png", "Carmilla31.png"],
  redux_abajo: ["Carmilla32.png", "Carmilla33.png"],
  icono_inactivo: ["Carmilla34.png", "Carmilla35.png"],
  icono_chat: ["Carmilla36.png", "Carmilla37.png"],
  icono_activo: ["Carmilla38.png", "Carmilla39.png"],
};

// ─────────────────────────────────────────
//  ESTADO GLOBAL
// ─────────────────────────────────────────
const estado = {
  modo: "dormida",
  desde_inactividad: false,
  mirando_derecha: true,
  vista_actual: "frente",
  parpadeando: false,
  timer_anim: null,
  timer_parpadeo: null,
  timer_despertar: null,
  timer_redux: null,
  mouse_x: 0,
  mouse_y: 0,
};

// ─────────────────────────────────────────
//  CACHE Y COLOR
// ─────────────────────────────────────────
const spriteCache = {};

function rgbAHex(rgb) {
  const p = rgb.match(/\d+/g);
  return (
    (+p[0]).toString(16).padStart(2, "0") +
    (+p[1]).toString(16).padStart(2, "0") +
    (+p[2]).toString(16).padStart(2, "0")
  );
}

function cargarSprite(nombre, callback) {
  spriteActual = nombre;

  const style = getComputedStyle(document.documentElement);
  let accent = style.getPropertyValue("--accent").trim().replace("#", "");
  let fill = style.getPropertyValue("--bg-nav").trim().replace("#", "");

  if (accent.startsWith("rgb")) accent = rgbAHex(accent);
  if (fill.startsWith("rgb")) fill = rgbAHex(fill);

  const clave = `${nombre}_${accent}_${fill}`;

  if (spriteCache[clave]) {
    callback(spriteCache[clave]);
    return;
  }

  const url = `/sprites/${nombre}?accent=${accent}&fill=${fill}`;
  spriteCache[clave] = url;
  callback(url);
}

function refrescarColores() {
  Object.keys(spriteCache).forEach((k) => delete spriteCache[k]);
}

function refrescarColoresSprite() {
  refrescarColores();

  setTimeout(() => {
    const sprite = document.getElementById("carmilla-sprite");
    if (!sprite || estado.modo === "dormida") return;
    if (spriteActual) {
      cargarSprite(spriteActual, (url) => {
        sprite.src = url;
      });
    }
  }, 50);
}

// ─────────────────────────────────────────
//  CREAR ELEMENTOS EN EL DOM
// ─────────────────────────────────────────
function iniciarAsistente() {
  const contenedor = document.createElement("div");
  contenedor.id = "carmilla";
  contenedor.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        cursor: pointer;
        transition: bottom 0.3s ease, right 0.3s ease, left 0.3s ease;
        user-select: none;
    `;

  const sprite = document.createElement("img");
  sprite.id = "carmilla-sprite";
  sprite.style.cssText = `
        width: ${TAMANIOS.icono}px;
        height: ${TAMANIOS.icono}px;
        image-rendering: pixelated;
        display: block;
        transition: transform 0.15s ease, width 0.3s ease, height 0.3s ease;
    `;

  contenedor.appendChild(sprite);
  document.body.appendChild(contenedor);

  contenedor.addEventListener("click", alClickear);
  contenedor.addEventListener("mouseenter", alHover);
  contenedor.addEventListener("mouseleave", alSalirHover);
  document.addEventListener("mousemove", rastrearMouse);

  animarIcono("icono_inactivo");
}

// ─────────────────────────────────────────
//  ICONO DORMIDA
// ─────────────────────────────────────────
function animarIcono(tipo) {
  limpiarTimers();
  const sprite = document.getElementById("carmilla-sprite");
  sprite.style.width = TAMANIOS.icono + "px";
  sprite.style.height = TAMANIOS.icono + "px";

  let frame = 0;
  estado.timer_anim = setInterval(() => {
    const nombre = ANIMACIONES[tipo][frame % 2];
    cargarSprite(nombre, (url) => {
      sprite.src = url;
    });
    frame++;
  }, VELOCIDADES.icono);
}

function alHover() {
  if (estado.modo !== "dormida") return;
  limpiarTimers();
  animarIcono("icono_activo");
}

function alSalirHover() {
  if (estado.modo !== "dormida") return;
  limpiarTimers();
  animarIcono("icono_inactivo");
}

// ─────────────────────────────────────────
//  CLICK
// ─────────────────────────────────────────
function alClickear() {
  switch (estado.modo) {
    case "dormida":
      despertar();
      break;
    case "despertando":
      if (estado.desde_inactividad) {
        pasarAIdle();
      } else {
        asustarse();
      }
      break;
    case "idle":
    case "hablando":
      abrirChat();
      break;
  }
}

// ─────────────────────────────────────────
//  DESPERTAR
// ─────────────────────────────────────────
function despertar() {
  limpiarTimers();
  estado.modo = "despertando";
  estado.desde_inactividad = false;

  const sprite = document.getElementById("carmilla-sprite");
  sprite.style.width = TAMANIOS.redux + "px";
  sprite.style.height = TAMANIOS.redux + "px";

  const secuencia = [
    "redux_frente",
    "redux_frente",
    "redux_arriba",
    "redux_frente",
    "redux_frente",
    "redux_derecha",
    "redux_frente",
    "redux_abajo",
    "redux_frente",
    "redux_frente",
    "redux_derecha",
    "redux_frente",
  ];

  let paso = 0;
  let frame = 0;
  let mirando = true;

  estado.timer_anim = setInterval(() => {
    if (estado.modo !== "despertando") return;

    const base = secuencia[paso];
    const nombre = ANIMACIONES[base][frame % 2];
    cargarSprite(nombre, (url) => {
      sprite.src = url;
    });

    if (base === "redux_derecha") {
      aplicarFlip(sprite, mirando);
    }

    frame++;
    if (frame % 3 === 0) {
      if (base === "redux_derecha" && frame % 6 === 0) {
        mirando = !mirando;
      }
      paso = (paso + 1) % secuencia.length;
    }
  }, VELOCIDADES.despertando);

  estado.timer_despertar = setTimeout(() => {
    if (estado.modo === "despertando") pasarAIdle();
  }, 15000);
}

// ─────────────────────────────────────────
//  ASUSTARSE
// ─────────────────────────────────────────
function asustarse() {
  limpiarTimers();
  estado.modo = "sorpresa";

  const contenedor = document.getElementById("carmilla");
  const sprite = document.getElementById("carmilla-sprite");

  sprite.style.width = TAMANIOS.completo + "px";
  sprite.style.height = TAMANIOS.completo + "px";

  const estaADerecha = contenedor.style.left === "";
  if (estaADerecha) {
    contenedor.style.right = "";
    contenedor.style.left = "20px";
    aplicarFlip(sprite, false);
    estado.mirando_derecha = false;
  } else {
    contenedor.style.left = "";
    contenedor.style.right = "20px";
    aplicarFlip(sprite, true);
    estado.mirando_derecha = true;
  }

  const secSorpresa = [
    ...Array(4).fill("sorpresa_exaltada"),
    ...Array(3).fill("sorpresa_cerrado"),
    ...Array(5).fill("sorpresa_calma"),
  ];

  let paso = 0;
  let frame = 0;

  estado.timer_anim = setInterval(() => {
    if (paso >= secSorpresa.length) return;
    const nombre = ANIMACIONES[secSorpresa[paso]][frame % 2];
    cargarSprite(nombre, (url) => {
      sprite.src = url;
    });
    frame++;
    if (frame % 2 === 0) paso++;
  }, VELOCIDADES.sorpresa);

  setTimeout(() => {
    limpiarTimers();
    pasarAIdle();
  }, 3000);
}

// ─────────────────────────────────────────
//  IDLE NORMAL
// ─────────────────────────────────────────
function pasarAIdle() {
  limpiarTimers();
  estado.modo = "idle";

  const sprite = document.getElementById("carmilla-sprite");
  sprite.style.width = TAMANIOS.completo + "px";
  sprite.style.height = TAMANIOS.completo + "px";

  iniciarMirada();
  programarParpadeo();
  programarMovimiento();

  estado.timer_redux = setTimeout(() => {
    if (estado.modo === "idle") volverARedux();
  }, 20000);
}

function volverARedux() {
  limpiarTimers();
  clearInterval(MOVIMIENTO.timer);
  estado.modo = "despertando";
  estado.desde_inactividad = true;

  const sprite = document.getElementById("carmilla-sprite");
  sprite.style.width = TAMANIOS.redux + "px";
  sprite.style.height = TAMANIOS.redux + "px";

  estado.timer_despertar = setTimeout(() => {
    pasarAIdle();
  }, 15000);
}

// ─────────────────────────────────────────
//  MIRADA
// ─────────────────────────────────────────
function iniciarMirada() {
  limpiarTimer("timer_anim");
  estado.timer_anim = setInterval(() => {
    if (estado.modo !== "idle") return;
    actualizarMirada();
  }, VELOCIDADES.idle);
}

function actualizarMirada() {
  const sprite = document.getElementById("carmilla-sprite");
  if (!sprite) return;

  const rect = document.getElementById("carmilla").getBoundingClientRect();
  const centroX = rect.left + rect.width / 2;
  const centroY = rect.top + rect.height / 2;

  const ratonADerecha = estado.mouse_x > centroX;
  if (ratonADerecha !== estado.mirando_derecha) {
    estado.mirando_derecha = ratonADerecha;
    aplicarFlip(sprite, estado.mirando_derecha);
  }

  const diffY = estado.mouse_y - centroY;
  const umbral = rect.height * 0.8;

  let vista;
  if (diffY < -umbral) vista = "arriba";
  else if (diffY > umbral) vista = "abajo";
  else vista = "derecha";

  estado.vista_actual = vista;

  const prefijo = estado.parpadeando ? "parpadeo_" : "idle_";
  const nombre = ANIMACIONES[prefijo + vista];

  if (nombre) {
    const frame = Math.floor(Date.now() / VELOCIDADES.idle) % 2;
    cargarSprite(nombre[frame], (url) => {
      sprite.src = url;
    });
  }
}

// ─────────────────────────────────────────
//  PARPADEO ALEATORIO
// ─────────────────────────────────────────
function programarParpadeo() {
  limpiarTimer("timer_parpadeo");
  const espera = 3000 + Math.random() * 3000;

  estado.timer_parpadeo = setTimeout(() => {
    if (estado.modo !== "idle") return;
    estado.parpadeando = true;
    setTimeout(() => {
      estado.parpadeando = false;
      programarParpadeo();
    }, 1000);
  }, espera);
}

// ─────────────────────────────────────────
//  RASTREAR MOUSE
// ─────────────────────────────────────────
function rastrearMouse(e) {
  estado.mouse_x = e.clientX;
  estado.mouse_y = e.clientY;
  reiniciarTimerInactividad();
}

function reiniciarTimerInactividad() {
  if (estado.modo !== "idle") return;
  clearTimeout(estado.timer_redux);
  estado.timer_redux = setTimeout(() => {
    if (estado.modo === "idle") volverARedux();
  }, 20000);
}

// ─────────────────────────────────────────
//  FLIP HORIZONTAL
// ─────────────────────────────────────────
function aplicarFlip(sprite, mirando_derecha) {
  sprite.style.transform = mirando_derecha ? "scaleX(1)" : "scaleX(-1)";
}

// ─────────────────────────────────────────
//  MOVIMIENTO AUTÓNOMO
// ─────────────────────────────────────────
const MOVIMIENTO = {
  activo: false,
  direccion: 1,
  velocidad: 2,
  timer: null,
  timer_inicio: null,
};

function programarMovimiento() {
  const espera = 8000 + Math.random() * 7000;
  MOVIMIENTO.timer_inicio = setTimeout(() => {
    if (estado.modo !== "idle") {
      programarMovimiento();
      return;
    }
    iniciarMovimiento();
  }, espera);
}

function iniciarMovimiento() {
  MOVIMIENTO.activo = true;
  MOVIMIENTO.direccion = Math.random() > 0.5 ? 1 : -1;

  limpiarTimer("timer_anim");

  const sprite = document.getElementById("carmilla-sprite");
  estado.mirando_derecha = MOVIMIENTO.direccion === 1;
  aplicarFlip(sprite, estado.mirando_derecha);

  let frame = 0;
  estado.timer_anim = setInterval(() => {
    const sp = document.getElementById("carmilla-sprite");
    const nombre = ANIMACIONES["idle_derecha"][frame % 2];
    cargarSprite(nombre, (url) => {
      sp.src = url;
    });
    frame++;
  }, VELOCIDADES.idle);

  const duracion = 3000 + Math.random() * 3000;

  MOVIMIENTO.timer = setInterval(() => {
    if (estado.modo !== "idle") {
      detenerMovimiento();
      return;
    }

    const contenedor = document.getElementById("carmilla");
    const rect = contenedor.getBoundingClientRect();
    const margen = 20;

    if (rect.left <= margen && MOVIMIENTO.direccion === -1) {
      MOVIMIENTO.direccion = 1;
      estado.mirando_derecha = true;
      aplicarFlip(document.getElementById("carmilla-sprite"), true);
    }
    if (
      rect.right >= window.innerWidth - margen &&
      MOVIMIENTO.direccion === 1
    ) {
      MOVIMIENTO.direccion = -1;
      estado.mirando_derecha = false;
      aplicarFlip(document.getElementById("carmilla-sprite"), false);
    }

    const nuevaX = rect.left + MOVIMIENTO.direccion * MOVIMIENTO.velocidad;
    contenedor.style.left = nuevaX + "px";
    contenedor.style.right = "auto";
  }, 16);

  setTimeout(() => detenerMovimiento(), duracion);
}

function detenerMovimiento() {
  MOVIMIENTO.activo = false;
  clearInterval(MOVIMIENTO.timer);
  MOVIMIENTO.timer = null;
  iniciarMirada();
  programarMovimiento();
}

// ─────────────────────────────────────────
//  CHAT (Capa 2 — placeholder)
// ─────────────────────────────────────────
function actualizarIconoChat() {
  // Capa 2
}

function abrirChat() {
  // Capa 2
  console.log("Chat pendiente — Capa 2");
}

// ─────────────────────────────────────────
//  LIMPIAR TIMERS
// ─────────────────────────────────────────
function limpiarTimers() {
  clearInterval(estado.timer_anim);
  clearTimeout(estado.timer_despertar);
  clearTimeout(estado.timer_parpadeo);
  clearTimeout(estado.timer_redux);
  estado.timer_anim = null;
  estado.timer_despertar = null;
  estado.timer_parpadeo = null;
  estado.timer_redux = null;
}

function limpiarTimer(nombre) {
  if (estado[nombre]) {
    clearInterval(estado[nombre]);
    clearTimeout(estado[nombre]);
    estado[nombre] = null;
  }
}

// ─────────────────────────────────────────
//  INICIALIZAR
// ─────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  iniciarAsistente();
});

// ─────────────────────────────────────────
//  CONFIGURACIÓN
// ─────────────────────────────────────────
const SPRITE_BASE = "/static/assistant/sprites/Carmilla/";

timer_redux: (null, clearTimeout(estado.timer_redux));
estado.timer_redux = null;

const VELOCIDADES = {
  icono: 250, // ms — parpadeo icono dormido
  despertando: 500, // ms — 2fps al despertar
  sorpresa: 150, // ms — reacción brusca
  idle: 500, // ms — 2fps idle normal
};

const TAMANIOS = {
  icono: 48, // px — ajusta durante pruebas
  redux: 96, // px — al despertar
  completo: 192, // px — idle normal
};

const MODO_MIRADA = "raton"; // "raton" | "alrededor"

const ZONA_ARRIBA = 0.33; // primer tercio de pantalla
const ZONA_ABAJO = 0.66; // último tercio de pantalla

// ─────────────────────────────────────────
//  MAPA DE ANIMACIONES
// ─────────────────────────────────────────
const ANIMACIONES = {
  // ── IDLE COMPLETO
  idle_frente: ["Carmilla00.png", "Carmilla01.png"],
  idle_arriba: ["Carmilla02.png", "Carmilla03.png"],
  idle_derecha: ["Carmilla04.png", "Carmilla05.png"],
  idle_abajo: ["Carmilla06.png", "Carmilla07.png"],

  // ── PARPADEO
  parpadeo_frente: ["Carmilla08.png", "Carmilla09.png"],
  parpadeo_arriba: ["Carmilla10.png", "Carmilla11.png"],
  parpadeo_derecha: ["Carmilla12.png", "Carmilla13.png"],
  parpadeo_abajo: ["Carmilla14.png", "Carmilla15.png"],

  // ── SORPRESA
  sorpresa_exaltada: ["Carmilla16.png", "Carmilla17.png"],
  sorpresa_cerrado: ["Carmilla18.png", "Carmilla19.png"],
  sorpresa_calma: ["Carmilla20.png", "Carmilla21.png"],

  // ── EXPRESIONES
  sonriendo: ["Carmilla22.png", "Carmilla23.png"],
  llanto: ["Carmilla24.png", "Carmilla25.png"],

  // ── REDUX
  redux_frente: ["Carmilla26.png", "Carmilla27.png"],
  redux_arriba: ["Carmilla28.png", "Carmilla29.png"],
  redux_derecha: ["Carmilla30.png", "Carmilla31.png"],
  redux_abajo: ["Carmilla32.png", "Carmilla33.png"],

  // ── ICONOS
  icono_inactivo: ["Carmilla34.png", "Carmilla35.png"],
  icono_chat: ["Carmilla36.png", "Carmilla37.png"],
  icono_activo: ["Carmilla38.png", "Carmilla39.png"],
};

// ─────────────────────────────────────────
//  ESTADO GLOBAL
// ─────────────────────────────────────────
const estado = {
  modo: "dormida", // dormida | despertando | idle | sorpresa | hablando
  desde_inactividad: false,
  mirando_derecha: true,
  vista_actual: "frente", // frente | arriba | derecha | abajo
  parpadeando: false,
  timer_anim: null,
  timer_parpadeo: null,
  timer_despertar: null,
  mouse_x: 0,
  mouse_y: 0,
  pos_x: 0,
  pos_y: 0,
};

// ─────────────────────────────────────────
//  CACHE Y PROCESADOR DE COLOR
// ─────────────────────────────────────────
const spriteCache = {};

function cargarSprite(nombre, callback) {
  if (spriteCache[nombre]) {
    callback(spriteCache[nombre]);
    return;
  }

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = SPRITE_BASE + nombre;

  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const style = getComputedStyle(document.documentElement);
    const accent = hexARgb(style.getPropertyValue("--bg-nav").trim());
    const fill = hexARgb(style.getPropertyValue("--accent").trim());

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];

      // Verde croma → transparente
      if (g > 150 && r < 100 && b < 100) {
        data[i + 3] = 0;

        // Blanco (outline) → accent de la gamma
      } else if (r > 200 && g > 200 && b > 200) {
        data[i] = accent.r;
        data[i + 1] = accent.g;
        data[i + 2] = accent.b;

        // Negro (fill) → color nav de la gamma
      } else if (r < 50 && g < 50 && b < 50) {
        data[i] = fill.r;
        data[i + 1] = fill.g;
        data[i + 2] = fill.b;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    const url = canvas.toDataURL("image/png");
    spriteCache[nombre] = url;
    callback(url);
  };

  img.onerror = () => {
    // Si no existe el sprite no rompe todo
    console.warn(`Sprite no encontrado: ${nombre}`);
  };
}

function hexARgb(color) {
  if (color.startsWith("rgb")) {
    const p = color.match(/\d+/g);
    return { r: +p[0], g: +p[1], b: +p[2] };
  }
  const hex = color.replace("#", "");
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
}

function refrescarColores() {
  Object.keys(spriteCache).forEach((k) => delete spriteCache[k]);
}

// ─────────────────────────────────────────
//  CREAR ELEMENTOS EN EL DOM
// ─────────────────────────────────────────
function iniciarAsistente() {
  // ── Contenedor principal
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

  // ── Sprite
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

  // ── Eventos
  contenedor.addEventListener("click", alClickear);
  contenedor.addEventListener("mouseenter", alHover);
  contenedor.addEventListener("mouseleave", alSalirHover);
  document.addEventListener("mousemove", rastrearMouse);

  // ── Arrancar icono
  animarIcono("icono_inactivo");
}

// ─────────────────────────────────────────
//  ANIMACIÓN DE ICONO
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
      abrirChat();
      break;
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

  // Secuencia de despertar — mayormente ojos cerrados
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

  // Parpadeos intercalados — 70% cerrado, 30% abierto
  const conParpadeo = [
    true,
    false,
    true,
    true,
    false,
    true,
    false,
    true,
    true,
    false,
    true,
    false,
  ];

  let paso = 0;
  let frame = 0;
  let mirando = true;

  estado.timer_anim = setInterval(() => {
    if (estado.modo !== "despertando") return;

    const base = secuencia[paso];
    // Elige entre abierto o cerrado según secuencia de parpadeo
    const tipo = conParpadeo[paso]
      ? base.replace("redux_", "redux_") // ojos abiertos (redux)
      : base.replace("redux_", "redux_"); // mismo — ver nota abajo*

    const nombre = ANIMACIONES[base][frame % 2];
    cargarSprite(nombre, (url) => {
      sprite.src = url;
    });

    // Voltear en arriba/abajo también si venía de izquierda
    if (base === "redux_derecha") {
      aplicarFlip(sprite, mirando);
    } else {
      // Para arriba/abajo/frente mantiene el último flip
    }

    frame++;
    if (frame % 3 === 0) {
      // Cambiar vista ocasionalmente y voltear
      if (base === "redux_derecha" && frame % 6 === 0) {
        mirando = !mirando;
      }
      paso = (paso + 1) % secuencia.length;
    }
  }, VELOCIDADES.despertando);

  // Después de 15s pasa a idle
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

  // Saltar al lado opuesto
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

  // Secuencia sorpresa: exaltada → cerrado → calma
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

  // Después de 3s se calma
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

  // ── Volver a redux después de 20s sin interacción
  estado.timer_redux = setTimeout(() => {
    if (estado.modo === "idle") volverARedux();
  }, 20000);
}

function volverARedux() {
  limpiarTimers();
  clearInterval(MOVIMIENTO.timer);
  estado.modo = "despertando"; // reutiliza la lógica de redux
  estado.desde_inactividad = true;

  const sprite = document.getElementById("carmilla-sprite");
  sprite.style.width = TAMANIOS.redux + "px";
  sprite.style.height = TAMANIOS.redux + "px";

  // Reiniciar timer de despertar
  estado.timer_despertar = setTimeout(() => {
    pasarAIdle();
  }, 15000);
}

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

  // ── Eje X → flip
  const ratonADerecha = estado.mouse_x > centroX;
  if (ratonADerecha !== estado.mirando_derecha) {
    estado.mirando_derecha = ratonADerecha;
    aplicarFlip(sprite, estado.mirando_derecha);
  }

  // ── Eje Y → relativo a Carmilla, no a la pantalla
  const diffY = estado.mouse_y - centroY;
  const umbral = rect.height * 0.8; // margen para zona "derecha"

  let vista;
  if (diffY < -umbral) {
    vista = "arriba";
  } else if (diffY > umbral) {
    vista = "abajo";
  } else {
    vista = "derecha";
  }

  estado.vista_actual = vista;

  // ── Elegir sprite
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

  // Parpadea cada 3-6 segundos aleatoriamente
  const espera = 3000 + Math.random() * 3000;

  estado.timer_parpadeo = setTimeout(() => {
    if (estado.modo !== "idle") return;

    estado.parpadeando = true;

    // Duración del parpadeo — 2 frames a 2fps = 1 segundo
    setTimeout(() => {
      estado.parpadeando = false;
      programarParpadeo(); // programar el siguiente
    }, 1000);
  }, espera);
}

// ─────────────────────────────────────────
//  RASTREAR MOUSE
// ─────────────────────────────────────────
function rastrearMouse(e) {
  estado.mouse_x = e.clientX;
  estado.mouse_y = e.clientY;
}

// ─────────────────────────────────────────
//  FLIP HORIZONTAL
// ─────────────────────────────────────────
function aplicarFlip(sprite, mirando_derecha) {
  sprite.style.transform = mirando_derecha ? "scaleX(1)" : "scaleX(-1)";
}

// ─────────────────────────────────────────
//  ICONO CHAT
// ─────────────────────────────────────────
function actualizarIconoChat() {
  // Placeholder — se implementa en Capa 2
  // El icono shine cambia a icono_chat cuando Carmilla está despierta
}

function abrirChat() {
  // Placeholder — Capa 2
  console.log("Chat pendiente — Capa 2");
}

// ─────────────────────────────────────────
//  LIMPIAR TIMERS
// ─────────────────────────────────────────
function limpiarTimers() {
  clearInterval(estado.timer_anim);
  clearTimeout(estado.timer_despertar);
  clearTimeout(estado.timer_parpadeo);
  estado.timer_anim = null;
  estado.timer_despertar = null;
  estado.timer_parpadeo = null;
}

function limpiarTimer(nombre) {
  if (estado[nombre]) {
    clearInterval(estado[nombre]);
    clearTimeout(estado[nombre]);
    estado[nombre] = null;
  }
}

// ─────────────────────────────────────────
//  REFRESCAR COLORES AL CAMBIAR GAMMA
// ─────────────────────────────────────────
function refrescarColoresSprite() {
  refrescarColores();
}

// ─────────────────────────────────────────
//  MOVIMIENTO AUTÓNOMO
// ─────────────────────────────────────────
const MOVIMIENTO = {
  activo: false,
  direccion: 1, // 1 = derecha, -1 = izquierda
  velocidad: 2, // px por tick
  timer: null,
  timer_inicio: null,
  timer_redux: null,
};

function programarMovimiento() {
  // Cada 8-15 segundos decide si moverse
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

  const contenedor = document.getElementById("carmilla");
  const rect = contenedor.getBoundingClientRect();

  // Forzar mirada hacia donde va
  estado.mirando_derecha = MOVIMIENTO.direccion === 1;
  aplicarFlip(
    document.getElementById("carmilla-sprite"),
    estado.mirando_derecha,
  );

  // Duración del movimiento — 3 a 6 segundos
  const duracion = 3000 + Math.random() * 3000;

  MOVIMIENTO.timer = setInterval(() => {
    if (estado.modo !== "idle") {
      detenerMovimiento();
      return;
    }

    const contenedor = document.getElementById("carmilla");
    const rect = contenedor.getBoundingClientRect();
    const margen = 20;

    // Rebotar en los bordes
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

    // Mover
    const nuevaX = rect.left + MOVIMIENTO.direccion * MOVIMIENTO.velocidad;
    contenedor.style.left = nuevaX + "px";
    contenedor.style.right = "auto";
  }, 16); // ~60fps para movimiento suave

  setTimeout(() => detenerMovimiento(), duracion);
}

function detenerMovimiento() {
  MOVIMIENTO.activo = false;
  clearInterval(MOVIMIENTO.timer);
  MOVIMIENTO.timer = null;
  programarMovimiento(); // programar el siguiente
}

// ─────────────────────────────────────────
//  INICIALIZAR
// ─────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  iniciarAsistente();
});

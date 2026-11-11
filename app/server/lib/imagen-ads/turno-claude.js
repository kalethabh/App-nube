// El turno de Claude de los ANUNCIOS DE IMAGEN: un solo lugar para TODOS los lotes juntos (ESPECIFICACION-imagen-ads.md
// §6.6). La app abre como mucho 2 sesiones de Claude a la vez (claude.js, MAX_SESIONES): con este semaforo, como mucho
// una de esas dos es de un lote, y la otra queda siempre libre para los videos, la ficha y el guion.
//
//   tomar(slug, prioridad)   no espera: true si le toca ahora (y queda tomado); si no, el lote queda anotado y sigue con
//                            su motor. Le toca al de mayor prioridad (3 = lo que el usuario espera, 2 = revision, 1 =
//                            escribir anuncios) y, a igual prioridad, al que pidio primero.
//   esperar(slug, prioridad, senal)   lo mismo, esperando su turno (el paso de la estrategia, que no tiene otra cosa que hacer)
//   soltar(slug) · retirar(slug) · estadoDelTurno()
//
// Un lote que deja de pedir (no llama a tomar en 15 s) sale de la espera solo: asi uno que se detuvo no frena a los demas.
const VENCE_MS = 15000;

let ocupado = null; // { slug, desde }
const espera = new Map(); // slug -> { prioridad, desde, visto }
let maximoVisto = 0; // para las pruebas: cuantas sesiones de lotes hubo a la vez como mucho (siempre 1)
let enCurso = 0;

function limpiar() {
  const ahora = Date.now();
  for (const [s, x] of espera) if (ahora - x.visto > VENCE_MS) espera.delete(s);
}

/** true si a `slug` le toca la sesion de Claude ahora (queda tomada hasta soltar). Nunca espera. */
export function tomar(slug, prioridad = 1) {
  limpiar();
  if (ocupado?.slug === slug) return false; // ya tiene la suya: nunca dos del mismo lote
  const ahora = Date.now();
  const yo = espera.get(slug) || { prioridad, desde: ahora };
  yo.prioridad = Number(prioridad) || 1;
  yo.visto = ahora;
  espera.set(slug, yo);
  if (ocupado) return false;
  let primero = null;
  for (const [s, x] of espera) {
    if (!primero || x.prioridad > primero[1].prioridad || (x.prioridad === primero[1].prioridad && x.desde < primero[1].desde)) primero = [s, x];
  }
  if (primero?.[0] !== slug) return false;
  espera.delete(slug);
  ocupado = { slug, desde: ahora };
  enCurso = 1;
  maximoVisto = Math.max(maximoVisto, enCurso);
  return true;
}

/** Suelta el lugar (si era de `slug`). */
export function soltar(slug) {
  if (ocupado?.slug !== slug) return;
  ocupado = null;
  enCurso = 0;
}

/** El lote ya no quiere el turno (lo detuvieron o termino). */
export function retirar(slug) {
  espera.delete(slug);
}

/** Espera el turno. true si lo tomo; false si `senal` lo corto antes. */
export async function esperar(slug, prioridad, senal) {
  // un solo listener para toda la espera (uno por vuelta se juntaban de a miles en una espera larga)
  let despertar = null;
  const alAbortar = () => despertar?.();
  senal?.addEventListener('abort', alAbortar, { once: true });
  try {
    while (!senal?.aborted) {
      if (tomar(slug, prioridad)) return true;
      await new Promise((r) => {
        const t = setTimeout(r, 1000);
        despertar = () => (clearTimeout(t), r());
      });
      despertar = null;
    }
  } finally {
    senal?.removeEventListener('abort', alAbortar);
  }
  retirar(slug);
  return false;
}

/** Para la pantalla y las pruebas: quien lo tiene, quienes esperan y cuantas a la vez hubo como mucho. */
export function estadoDelTurno() {
  limpiar();
  return { ocupado: ocupado ? { slug: ocupado.slug, desde: new Date(ocupado.desde).toISOString() } : null, esperando: [...espera.keys()], enCurso, maximo: maximoVisto };
}

/** Solo pruebas: vuelve a empezar. */
export function reiniciarTurno() {
  ocupado = null;
  espera.clear();
  maximoVisto = 0;
  enCurso = 0;
}

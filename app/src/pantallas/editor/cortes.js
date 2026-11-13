// Cortar, recortar, mover y borrar: lo básico de CapCut sobre la línea de tiempo.
//
// Cada operación toma el estado del editor y devuelve el nuevo ({ ed }) o por qué no se puede ({ error }). Son
// cálculo puro: la pantalla las usa para la vista previa mientras se arrastra y, al soltar, guarda el resultado
// como un solo paso del historial (deshacer y rehacer de una vez).
//
// LA VOZ NO SE MUEVE. Las tomas van una detrás de otra cubriendo toda la voz:
//   - recortar el final de una toma alarga la siguiente (y al revés): nunca queda un hueco;
//   - recortar el comienzo de una toma alarga la anterior;
//   - borrar una toma alarga la de al lado; moverla de lugar corre las otras.
//   Si un clip no alcanza a llenar su lugar, se ve quieto al final: la pantalla lo avisa (nunca negro).
// Las imágenes de apoyo, los textos y la música van encima, en su propio tiempo.
//
// DESLIZAR (como el «slip» de CapCut): cambia qué parte del clip se ve, sin mover su lugar ni su largo (para calzar
// con la voz o con la boca). Y la VELOCIDAD de un clip (0,5× a 2×). Los dos se guardan por pieza en ed.clips y los
// aplica capas.mjs (la misma cuenta para la vista previa y la exportación), con las reglas de cada familia
// (queSePuedeConElClip): en los clips donde la voz va dentro (UGC, objeto parlante, podcast, entrevista) no se puede.
import {
  FPS,
  MINIMO,
  tomasDeEdicion,
  brollsDeEdicion,
  textosEnPantalla,
  tramosMusica,
  cortesPosibles,
  entradaEnLaCancion,
  LUGAR_TEXTO,
  LUGAR_IMAGEN,
  queSePuedeConElClip,
  VELOCIDAD_MIN,
  VELOCIDAD_MAX,
} from '@composicion/edicion/capas.mjs';

const r4 = (x) => Math.round(x * 10000) / 10000;
const entre = (x, a, b) => Math.max(a, Math.min(b, x));
let serie = 0;
const nuevoId = (prefijo) => `${prefijo}${Date.now().toString(36)}${(serie++).toString(36)}`;

const datosTomas = (segs) => segs.map(({ id, b, entrada, duracion, cabeza }) => ({ id, b, entrada: r4(entrada), duracion: r4(duracion), cabeza }));
const datosBrolls = (lista) => lista.map(({ id, b, desde, duracion, entrada }) => ({ id, b, desde: r4(desde), duracion: r4(duracion), entrada: r4(entrada) }));
const datosTramos = (lista) => lista.map(({ id, desde, hasta, entrada, fadeIn, fadeOut }) => ({ id, desde: r4(desde), hasta: r4(hasta), entrada: r4(entrada), fadeIn: r4(fadeIn), fadeOut: r4(fadeOut) }));

const conTomas = (ed, segs) => ({ ed: { ...ed, tomas: datosTomas(segs) } });
const conBrolls = (ed, lista) => ({ ed: { ...ed, brolls: datosBrolls(lista) } });
const conTramos = (ed, lista) => ({ ed: { ...ed, musica: { ...ed.musica, tramos: datosTramos(lista) } } });

// El corte cae en un cuadro justo contado desde el comienzo de la pieza: así la segunda parte sigue en el cuadro
// siguiente del clip (sin repetir ni saltar uno) y dividir no cambia nada de lo que se ve ni se oye.
const enCuadro = (inicio, t) => inicio + Math.round((t - inicio) * FPS) / FPS;

const NO_TOMAS = (plan) => ({ error: cortesPosibles(plan).motivo || 'Las tomas de este anuncio no se cortan.' });

// ---------------------------------------------------------------- dividir en el cursor

export function dividir(plan, ed, { pista, id, t, musica }) {
  if (pista === 'video') {
    if (!cortesPosibles(plan).tomas) return NO_TOMAS(plan);
    const segs = tomasDeEdicion(plan, ed);
    const k = segs.findIndex((s) => s.id === id);
    if (k < 0) return { error: 'No encuentro esa toma.' };
    const s = segs[k];
    t = enCuadro(s.inicio, t);
    if (t <= s.inicio + MINIMO || t >= s.fin - MINIMO) return { error: 'Pon el cursor dentro de la toma, un poco más lejos de sus bordes.' };
    const d1 = t - s.inicio;
    const a = { ...s, duracion: d1 };
    const z = { ...s, id: nuevoId('v'), entrada: s.entrada + d1 * s.velocidad, duracion: s.duracion - d1, cabeza: false };
    return { ...conTomas(ed, [...segs.slice(0, k), a, z, ...segs.slice(k + 1)]), nuevo: z.id };
  }
  if (pista === 'broll') {
    if (!cortesPosibles(plan).brolls) return { error: cortesPosibles(plan).motivo };
    const lista = brollsDeEdicion(plan, ed);
    const k = lista.findIndex((x) => x.id === id);
    if (k < 0) return { error: 'No encuentro esa imagen de apoyo.' };
    const x = lista[k];
    t = enCuadro(x.desde, t);
    if (t <= x.desde + MINIMO || t >= x.fin - MINIMO) return { error: 'Pon el cursor dentro de la imagen de apoyo, un poco más lejos de sus bordes.' };
    const d1 = t - x.desde;
    const a = { ...x, duracion: d1 };
    const z = { ...x, id: nuevoId(`${x.id}-`), desde: t, duracion: x.duracion - d1, entrada: x.entrada + d1 * x.velocidad };
    const quitados = ed.quitados.includes(x.id) ? [...ed.quitados, z.id] : ed.quitados;
    const r = conBrolls(ed, [...lista.slice(0, k), a, z, ...lista.slice(k + 1)]);
    return { ed: { ...r.ed, quitados }, nuevo: z.id };
  }
  if (pista === 'musica') {
    const tramos = tramosMusica(plan, ed, musica);
    const k = tramos.findIndex((x) => x.id === id);
    if (k < 0) return { error: 'No encuentro ese tramo de la música.' };
    const x = tramos[k];
    t = enCuadro(x.desde, t);
    if (t <= x.desde + MINIMO || t >= x.hasta - MINIMO) return { error: 'Pon el cursor dentro de la música, un poco más lejos de sus bordes.' };
    // el corte no se oye: sin fundido de un lado ni del otro
    const a = { ...x, hasta: t, fadeOut: 0 };
    // (una canción que se repite da la vuelta: la segunda parte sigue donde iba, nunca más allá de su final)
    const z = { ...x, id: nuevoId('m'), desde: t, entrada: entradaEnLaCancion(x.entrada + (t - x.desde), musica), fadeIn: 0 };
    return { ...conTramos(ed, [...tramos.slice(0, k), a, z, ...tramos.slice(k + 1)]), nuevo: z.id };
  }
  if (pista === 'textos') return { error: 'Los textos no se dividen: arrastra sus bordes para acortarlos.' };
  return { error: 'Eso no se puede dividir.' };
}

// ---------------------------------------------------------------- recortar arrastrando un borde

/** borde: 'inicio' | 'fin' · dt: cuánto se corre ese borde (segundos, + a la derecha). Se ajusta a lo posible. */
export function recortar(plan, ed, { pista, id, borde, dt, musica, overlays }) {
  const dur = plan.duracion || 1;
  if (pista === 'video') {
    if (!cortesPosibles(plan).tomas) return NO_TOMAS(plan);
    const segs = tomasDeEdicion(plan, ed).map((s) => ({ ...s }));
    const k = segs.findIndex((s) => s.id === id);
    if (k < 0) return { error: 'No encuentro esa toma.' };
    const s = segs[k];
    if (borde === 'inicio') {
      if (k === 0) return { error: 'La primera toma empieza siempre al comienzo de la voz. Para quitarle el principio, divídela y borra la primera parte.' };
      const p = segs[k - 1];
      // a la izquierda solo se puede si el clip tiene de dónde mostrar más (si se le había recortado el comienzo)
      const d = entre(dt, Math.max(MINIMO - p.duracion, -s.entrada / s.velocidad), s.duracion - MINIMO);
      p.duracion += d;
      s.duracion -= d;
      s.entrada += d * s.velocidad;
      return conTomas(ed, segs);
    }
    if (k === segs.length - 1) return { error: 'La última toma llega siempre hasta el final de la voz.' };
    const n = segs[k + 1];
    const d = entre(dt, MINIMO - s.duracion, n.duracion - MINIMO);
    s.duracion += d;
    n.duracion -= d;
    return conTomas(ed, segs);
  }
  if (pista === 'broll') {
    if (!cortesPosibles(plan).brolls) return { error: cortesPosibles(plan).motivo };
    const lista = brollsDeEdicion(plan, ed).map((x) => ({ ...x }));
    const x = lista.find((y) => y.id === id);
    if (!x) return { error: 'No encuentro esa imagen de apoyo.' };
    if (borde === 'inicio') {
      const d = entre(dt, Math.max(-x.desde, -x.entrada / x.velocidad), x.duracion - MINIMO);
      x.desde += d;
      x.duracion -= d;
      x.entrada += d * x.velocidad;
    } else {
      // no más largo que su clip (si no, se vería quieto encima de todo) ni que el anuncio
      const libre = dur - x.desde;
      const techo = Math.max(Math.min(x.cubre ?? Infinity, libre), Math.min(x.duracion, libre));
      x.duracion = entre(x.duracion + dt, Math.min(MINIMO, techo), techo);
    }
    return conBrolls(ed, lista);
  }
  if (pista === 'textos') return ajustarTiempoTexto(plan, ed, overlays, id, (x) => (borde === 'inicio' ? { inicio: entre(x.inicio + dt, 0, x.fin - MINIMO) } : { fin: entre(x.fin + dt, x.inicio + MINIMO, dur) }));
  if (pista === 'musica') {
    const tramos = tramosMusica(plan, ed, musica).map((x) => ({ ...x }));
    const k = tramos.findIndex((x) => x.id === id);
    if (k < 0) return { error: 'No encuentro ese tramo de la música.' };
    const x = tramos[k];
    if (borde === 'inicio') {
      const piso = k > 0 ? tramos[k - 1].hasta : 0;
      const d = entre(dt, Math.max(piso - x.desde, -x.entrada), x.hasta - x.desde - MINIMO);
      x.desde += d;
      x.entrada = entradaEnLaCancion(x.entrada + d, musica);
    } else {
      let techo = k + 1 < tramos.length ? tramos[k + 1].desde : dur;
      // una canción que no se repite no se puede estirar más allá de su final
      if (!musica?.repetir && musica?.duracion > 0) techo = Math.min(techo, x.desde + musica.duracion - x.entrada);
      x.hasta = entre(x.hasta + dt, x.desde + MINIMO, Math.max(x.desde + MINIMO, techo));
    }
    return conTramos(ed, tramos);
  }
  return { error: 'Eso no se puede recortar.' };
}

// ---------------------------------------------------------------- mover

/** Corre la pieza dt segundos (B-roll, textos, música) o cambia una toma de lugar (video). */
export function mover(plan, ed, { pista, id, dt, musica, overlays }) {
  const dur = plan.duracion || 1;
  if (pista === 'video') {
    if (!cortesPosibles(plan).tomas) return NO_TOMAS(plan);
    const segs = tomasDeEdicion(plan, ed);
    const k = segs.findIndex((s) => s.id === id);
    if (k < 0) return { error: 'No encuentro esa toma.' };
    const s = segs[k];
    const centro = (s.inicio + s.fin) / 2 + dt;
    const otros = segs.filter((x) => x.id !== id);
    const lugar = otros.filter((x) => (x.inicio + x.fin) / 2 < centro).length;
    if (lugar === k) return { ed };
    return conTomas(ed, [...otros.slice(0, lugar), s, ...otros.slice(lugar)]);
  }
  if (pista === 'broll') {
    if (!cortesPosibles(plan).brolls) return { error: cortesPosibles(plan).motivo };
    const lista = brollsDeEdicion(plan, ed).map((x) => (x.id === id ? { ...x, desde: entre(x.desde + dt, 0, dur - x.duracion) } : x));
    return conBrolls(ed, lista);
  }
  if (pista === 'textos') {
    return ajustarTiempoTexto(plan, ed, overlays, id, (x) => {
      const largo = x.fin - x.inicio;
      const inicio = entre(x.inicio + dt, 0, Math.max(0, dur - largo));
      return { inicio, fin: inicio + largo };
    });
  }
  if (pista === 'musica') {
    const tramos = tramosMusica(plan, ed, musica).map((x) => ({ ...x }));
    const k = tramos.findIndex((x) => x.id === id);
    if (k < 0) return { error: 'No encuentro ese tramo de la música.' };
    const x = tramos[k];
    const largo = x.hasta - x.desde;
    const piso = k > 0 ? tramos[k - 1].hasta : 0;
    const techo = (k + 1 < tramos.length ? tramos[k + 1].desde : dur) - largo;
    const desde = entre(x.desde + dt, piso, Math.max(piso, techo));
    x.desde = desde;
    x.hasta = desde + largo;
    return conTramos(ed, tramos);
  }
  return { error: 'Eso no se puede mover.' };
}

// ---------------------------------------------------------------- borrar

export function borrar(plan, ed, { pista, id, musica }) {
  if (pista === 'video') {
    if (!cortesPosibles(plan).tomas) return NO_TOMAS(plan);
    const segs = tomasDeEdicion(plan, ed).map((s) => ({ ...s }));
    const k = segs.findIndex((s) => s.id === id);
    if (k < 0) return { error: 'No encuentro esa toma.' };
    if (segs.length === 1) return { error: 'Es la única toma: el anuncio no puede quedar sin video.' };
    // su lugar lo ocupa la de al lado (la anterior; si es la primera, la siguiente)
    const vecina = k > 0 ? segs[k - 1] : segs[k + 1];
    vecina.duracion += segs[k].duracion;
    return conTomas(ed, segs.filter((_, i) => i !== k));
  }
  if (pista === 'broll') {
    if (!cortesPosibles(plan).brolls) return { error: cortesPosibles(plan).motivo };
    const lista = brollsDeEdicion(plan, ed);
    if (!lista.some((x) => x.id === id)) return { error: 'No encuentro esa imagen de apoyo.' };
    const r = conBrolls(ed, lista.filter((x) => x.id !== id));
    return { ed: { ...r.ed, quitados: ed.quitados.filter((x) => x !== id) } };
  }
  if (pista === 'textos') {
    if ((ed.textosNuevos || []).some((x) => x.id === id)) return { ed: { ...ed, textosNuevos: ed.textosNuevos.filter((x) => x.id !== id) } };
    // un texto sugerido no se borra del todo: deja de verse en el video y queda como sugerencia
    if (ed.textos.includes(id)) return { ed: { ...ed, textos: ed.textos.filter((x) => x !== id) } };
    return { error: 'Ese texto no está en el video.' };
  }
  if (pista === 'musica') {
    const tramos = tramosMusica(plan, ed, musica);
    if (tramos.length <= 1) return { ed: { ...ed, musica: { ...ed.musica, fuente: 'ninguna', silenciada: false, tramos: null } }, sinMusica: true };
    return conTramos(ed, tramos.filter((x) => x.id !== id));
  }
  return { error: 'Eso no se puede borrar.' };
}

// ---------------------------------------------------------------- textos

/** Lo que el usuario cambió de un texto: { texto, inicio, fin, color, fondo, tamano, x, y, fuente }. */
export function ajustarTexto(ed, id, cambios) {
  if ((ed.textosNuevos || []).some((x) => x.id === id)) {
    return { ed: { ...ed, textosNuevos: ed.textosNuevos.map((x) => (x.id === id ? { ...x, ...cambios } : x)) } };
  }
  return { ed: { ...ed, ajustesTextos: { ...ed.ajustesTextos, [id]: { ...(ed.ajustesTextos?.[id] || {}), ...cambios } } } };
}

// overlays: los textos sugeridos del anuncio (de ahí sale el tiempo de los que no se movieron)
function ajustarTiempoTexto(plan, ed, overlays, id, calcular) {
  const y = textosEnPantalla(plan, ed, overlays || [], null).find((z) => z.id === id);
  if (!y) return { error: 'No encuentro ese texto.' };
  const t = calcular(y);
  return ajustarTexto(ed, id, Object.fromEntries(Object.entries(t).map(([k, v]) => [k, r4(v)])));
}

/** Un texto nuevo en el cursor, con el color del anuncio de fondo. */
export function agregarTexto(plan, ed, { t, color }) {
  const dur = plan.duracion || 1;
  const largo = Math.min(2.5, dur);
  const inicio = r4(entre(t, 0, Math.max(0, dur - largo)));
  const id = nuevoId('t');
  const x = { id, texto: 'Tu texto', inicio, fin: r4(inicio + largo), color: '#FFFFFF', fondo: color || '#E8442A', tamano: 1, x: LUGAR_TEXTO.x, y: LUGAR_TEXTO.y, fuente: 'titulo' };
  return { ed: { ...ed, textosNuevos: [...(ed.textosNuevos || []), x] }, nuevo: id };
}

/**
 * Una imagen nueva en el cursor (ya subida a la carpeta del anuncio: `archivo`). Va en la pista de textos: se mueve,
 * se recorta y se borra igual que un texto. Dura 3 segundos (o lo que quede del anuncio).
 */
export function agregarImagen(plan, ed, { t, archivo, nombre, id: idDado = null }) {
  const dur = plan.duracion || 1;
  const largo = Math.min(3, dur);
  const inicio = r4(entre(t, 0, Math.max(0, dur - largo)));
  const id = idDado || nuevoId('i');
  const x = { id, texto: String(nombre || 'Imagen').replace(/\.[a-z0-9]+$/i, '').slice(0, 60) || 'Imagen', archivo, inicio, fin: r4(inicio + largo), ...LUGAR_IMAGEN };
  return { ed: { ...ed, textosNuevos: [...(ed.textosNuevos || []), x] }, nuevo: id };
}

/** Un cambio de un tramo de la música (fundidos, dónde arranca la canción). */
export function ajustarTramo(plan, ed, { id, cambios, musica }) {
  const tramos = tramosMusica(plan, ed, musica).map((x) => (x.id === id ? { ...x, ...cambios } : x));
  return conTramos(ed, tramos);
}

// ---------------------------------------------------------------- deslizar y velocidad (por pieza)

/** ed.clips con lo de una pieza cambiado (lo vacío se saca). */
function conClip(ed, pieza, cambios) {
  const clips = { ...(ed.clips || {}) };
  const c = { ...(clips[pieza] || {}), ...cambios };
  for (const k of Object.keys(c)) if (c[k] === null || c[k] === undefined) delete c[k];
  if (Object.keys(c).length) clips[pieza] = c;
  else delete clips[pieza];
  return { ...ed, clips };
}

/**
 * Desliza el contenido del clip de una pieza. `dt`: cuánto se arrastró (segundos del anuncio, + a la derecha: se ve
 * lo de antes del clip). La pantalla pasa lo que sabe del clip: pieza, entradaBase (la entrada sin deslizar), largo y
 * velocidad. O `desliza` directo (el control del panel).
 */
export function deslizar(plan, ed, { pieza, dt = 0, desliza, entradaBase = 0, largo = null, velocidad = 1 }) {
  if (!pieza) return { error: 'Este clip no se puede deslizar.' };
  const puede = queSePuedeConElClip(plan, pieza, ed);
  if (!puede.deslizar) return { error: puede.motivo || 'Este clip no se puede deslizar.' };
  const antes = Number(ed.clips?.[pieza]?.desliza) || 0;
  let d = desliza !== undefined ? Number(desliza) || 0 : antes - dt * (Number(velocidad) || 1);
  // lo que se ve tiene que estar dentro del clip: de su comienzo a una décima antes de su final
  const piso = -Math.max(0, entradaBase);
  const techo = largo ? Math.max(piso, largo - 0.1 - entradaBase) : Infinity;
  d = r4(entre(d, piso, techo));
  if (Math.abs(d - antes) < 0.0005) return { ed };
  return { ed: conClip(ed, pieza, { desliza: Math.abs(d) < 0.0005 ? null : d }) };
}

/** La velocidad del clip de una pieza (null = la que venía). */
export function cambiarVelocidad(plan, ed, { pieza, velocidad }) {
  if (!pieza) return { error: 'Este clip no cambia de velocidad.' };
  const puede = queSePuedeConElClip(plan, pieza, ed);
  if (!puede.velocidad) return { error: puede.motivo || 'Este clip no cambia de velocidad.' };
  const v = velocidad === null || velocidad === undefined ? null : r4(entre(Number(velocidad) || 1, VELOCIDAD_MIN, VELOCIDAD_MAX));
  return { ed: conClip(ed, pieza, { velocidad: v }) };
}

// ---------------------------------------------------------------- una sola puerta para la pantalla

/** Lo que se ve y se oye de las piezas que se cortan y mueven (al milisegundo), para saber si algo cambió. */
function huella(plan, ed, { musica, overlays }) {
  const r = (x) => Math.round(x * 1000);
  return JSON.stringify([
    tomasDeEdicion(plan, ed).map((s) => [s.id, s.b, r(s.inicio), r(s.fin), r(s.entrada)]),
    brollsDeEdicion(plan, ed).map((x) => [x.id, x.b, r(x.desde), r(x.fin), r(x.entrada)]),
    tramosMusica(plan, ed, musica).map((x) => [x.id, r(x.desde), r(x.hasta), r(x.entrada), r(x.fadeIn), r(x.fadeOut)]),
    textosEnPantalla(plan, ed, overlays || [], null).map((x) => [x.id, r(x.inicio), r(x.fin)]),
  ]);
}

/** { tipo: 'dividir'|'recortar'|'mover'|'borrar'|'deslizar'|'velocidad', pista, id, ... } -> { ed } | { error } */
export function operar(plan, ed, op) {
  if (op.tipo === 'dividir') return dividir(plan, ed, op);
  if (op.tipo === 'borrar') return borrar(plan, ed, op);
  if (op.tipo === 'deslizar') return deslizar(plan, ed, op);
  if (op.tipo === 'velocidad') return cambiarVelocidad(plan, ed, op);
  if (op.tipo !== 'recortar' && op.tipo !== 'mover') return { error: 'No sé hacer eso.' };
  const r = op.tipo === 'recortar' ? recortar(plan, ed, op) : mover(plan, ed, op);
  // arrastrar hasta un tope (o soltar donde estaba) no es un cambio: no entra al historial
  if (r.ed && r.ed !== ed && huella(plan, r.ed, op) === huella(plan, ed, op)) return { ed };
  return r;
}

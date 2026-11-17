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
  tramosVoz,
  audiosDeEdicion,
  limpiarCensuras,
  FUNDIDO_MAX,
} from '@composicion/edicion/capas.mjs';

const r4 = (x) => Math.round(x * 10000) / 10000;
const entre = (x, a, b) => Math.max(a, Math.min(b, x));
let serie = 0;
const nuevoId = (prefijo) => `${prefijo}${Date.now().toString(36)}${(serie++).toString(36)}`;

const datosTomas = (segs) => segs.map(({ id, b, entrada, duracion, cabeza, congelado }) => ({ id, b, entrada: r4(entrada), duracion: r4(duracion), cabeza, ...(congelado ? { congelado: true } : {}) }));
const datosBrolls = (lista) => lista.map(({ id, b, desde, duracion, entrada }) => ({ id, b, desde: r4(desde), duracion: r4(duracion), entrada: r4(entrada) }));
const datosTramos = (lista) => lista.map(({ id, desde, hasta, entrada, fadeIn, fadeOut }) => ({ id, desde: r4(desde), hasta: r4(hasta), entrada: r4(entrada), fadeIn: r4(fadeIn), fadeOut: r4(fadeOut) }));

const conTomas = (ed, segs) => ({ ed: { ...ed, tomas: datosTomas(segs) } });
const conBrolls = (ed, lista) => ({ ed: { ...ed, brolls: datosBrolls(lista) } });
const conTramos = (ed, lista) => ({ ed: { ...ed, musica: { ...ed.musica, tramos: datosTramos(lista) } } });
// las partes de la voz: una sola al 100 % sin fundidos es la voz como venía (null)
const datosVoz = (lista) => lista.map(({ id, desde, hasta, volumen, fadeIn, fadeOut }) => ({ id, desde: r4(desde), hasta: r4(hasta), volumen: r4(volumen), fadeIn: r4(fadeIn), fadeOut: r4(fadeOut) }));
const conVoz = (ed, lista) => {
  const sola = lista.length === 1 && lista[0].volumen === 1 && !lista[0].fadeIn && !lista[0].fadeOut;
  return { ed: { ...ed, voz: { ...ed.voz, tramos: sola ? null : datosVoz(lista) } } };
};
const datosCensura = (c) => ({ id: c.id, desde: r4(c.desde), hasta: r4(c.hasta), modo: c.modo, palabra: c.palabra || '' });
const conCensuras = (ed, lista) => ({ ed: { ...ed, censuras: limpiarCensuras(lista.map(datosCensura)) } });
const datosAudio = (a) => ({ id: a.id, archivo: a.archivo, nombre: a.nombre, duracion: a.duracion, desde: r4(a.desde), hasta: r4(a.hasta), entrada: r4(a.entrada), volumen: r4(a.volumen), fadeIn: r4(a.fadeIn), fadeOut: r4(a.fadeOut) });
const conAudios = (ed, lista) => ({ ed: { ...ed, audios: lista.map(datosAudio) } });

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
    const z = { ...s, id: nuevoId('v'), entrada: s.congelado ? s.entrada : s.entrada + d1 * s.velocidad, duracion: s.duracion - d1, cabeza: false };
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
  if (pista === 'voz') {
    const tramos = tramosVoz(plan, ed);
    const k = tramos.findIndex((x) => x.id === id);
    if (k < 0) return { error: 'No encuentro esa parte de la voz.' };
    const x = tramos[k];
    t = enCuadro(x.desde, t);
    if (t <= x.desde + 0.1 || t >= x.hasta - 0.1) return { error: 'Pon el cursor dentro de la voz, un poco más lejos de los bordes de esta parte.' };
    // el corte no se oye: sin fundido de un lado ni del otro, con el mismo volumen
    const a = { ...x, hasta: t, fadeOut: 0 };
    const z = { ...x, id: nuevoId('z'), desde: t, fadeIn: 0 };
    return { ...conVoz(ed, [...tramos.slice(0, k), a, z, ...tramos.slice(k + 1)]), nuevo: z.id };
  }
  if (pista === 'audios') {
    const lista = audiosDeEdicion(plan, ed);
    const x = lista.find((y) => y.id === id);
    if (!x) return { error: 'No encuentro ese audio.' };
    t = enCuadro(x.desde, t);
    if (t <= x.desde + MINIMO || t >= x.hasta - MINIMO) return { error: 'Pon el cursor dentro del audio, un poco más lejos de sus bordes.' };
    const a = { ...x, hasta: t, fadeOut: 0 };
    const z = { ...x, id: nuevoId('a'), desde: t, entrada: x.entrada + (t - x.desde), fadeIn: 0 };
    return { ...conAudios(ed, [...(ed.audios || []).filter((y) => y.id !== id), a, z]), nuevo: z.id };
  }
  if (pista === 'censuras') return { error: 'Las censuras no se dividen: arrastra sus bordes para acortarlas.' };
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
      if (!s.congelado) s.entrada += d * s.velocidad;
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
  if (pista === 'voz') {
    // la voz no se mueve: arrastrar el borde entre dos partes cambia dónde termina una y empieza la otra
    const tramos = tramosVoz(plan, ed).map((x) => ({ ...x }));
    const k = tramos.findIndex((x) => x.id === id);
    if (k < 0) return { error: 'No encuentro esa parte de la voz.' };
    const j = borde === 'inicio' ? k - 1 : k + 1;
    if (j < 0 || j >= tramos.length) return { error: borde === 'inicio' ? 'La voz empieza siempre al comienzo del anuncio. Divídela para silenciar o bajar una parte.' : 'La voz llega siempre hasta el final del anuncio. Divídela para silenciar o bajar una parte.' };
    const [p, q] = borde === 'inicio' ? [tramos[j], tramos[k]] : [tramos[k], tramos[j]];
    const corte = entre(q.desde + dt, p.desde + 0.1, q.hasta - 0.1);
    p.hasta = corte;
    q.desde = corte;
    return conVoz(ed, tramos);
  }
  if (pista === 'censuras') {
    const lista = (ed.censuras || []).map((c) => ({ ...c }));
    const k = lista.findIndex((c) => c.id === id);
    if (k < 0) return { error: 'No encuentro esa censura.' };
    const c = lista[k];
    const piso = k > 0 ? lista[k - 1].hasta : 0;
    const techo = k + 1 < lista.length ? lista[k + 1].desde : dur;
    if (borde === 'inicio') c.desde = entre(c.desde + dt, piso, c.hasta - 0.05);
    else c.hasta = entre(c.hasta + dt, c.desde + 0.05, techo);
    return conCensuras(ed, lista);
  }
  if (pista === 'audios') {
    const lista = (ed.audios || []).map((a) => ({ ...a }));
    const x = lista.find((a) => a.id === id);
    if (!x) return { error: 'No encuentro ese audio.' };
    if (borde === 'inicio') {
      // a la izquierda solo si el audio tiene de dónde sonar más (si se le había recortado el comienzo)
      const d = entre(dt, Math.max(-x.desde, -x.entrada), x.hasta - x.desde - MINIMO);
      x.desde += d;
      x.entrada += d;
    } else {
      let techo = dur;
      if (x.duracion > 0) techo = Math.min(techo, x.desde + x.duracion - x.entrada);
      x.hasta = entre(x.hasta + dt, x.desde + MINIMO, Math.max(x.desde + MINIMO, techo));
    }
    return conAudios(ed, lista);
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
  if (pista === 'voz') return { error: 'La voz no se mueve: todo el anuncio la sigue. Divídela para silenciar o bajar una parte.' };
  if (pista === 'censuras') {
    const lista = (ed.censuras || []).map((c) => ({ ...c }));
    const k = lista.findIndex((c) => c.id === id);
    if (k < 0) return { error: 'No encuentro esa censura.' };
    const c = lista[k];
    const largo = c.hasta - c.desde;
    const piso = k > 0 ? lista[k - 1].hasta : 0;
    const techo = (k + 1 < lista.length ? lista[k + 1].desde : dur) - largo;
    c.desde = entre(c.desde + dt, piso, Math.max(piso, techo));
    c.hasta = c.desde + largo;
    return conCensuras(ed, lista);
  }
  if (pista === 'audios') {
    // los audios pueden sonar uno encima del otro (como dos efectos a la vez)
    const lista = (ed.audios || []).map((a) => {
      if (a.id !== id) return a;
      const largo = a.hasta - a.desde;
      const desde = entre(a.desde + dt, 0, Math.max(0, dur - largo));
      return { ...a, desde, hasta: desde + largo };
    });
    return conAudios(ed, lista);
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
  if (pista === 'voz') {
    // la voz no se borra (todo el anuncio la sigue): esa parte calla, como en CapCut al borrar un trozo de audio
    const tramos = tramosVoz(plan, ed);
    if (!tramos.some((x) => x.id === id)) return { error: 'No encuentro esa parte de la voz.' };
    return conVoz(ed, tramos.map((x) => (x.id === id ? { ...x, volumen: 0 } : x)));
  }
  if (pista === 'censuras') {
    if (!(ed.censuras || []).some((c) => c.id === id)) return { error: 'No encuentro esa censura.' };
    return { ed: { ...ed, censuras: ed.censuras.filter((c) => c.id !== id) } };
  }
  if (pista === 'audios') {
    if (!(ed.audios || []).some((a) => a.id === id)) return { error: 'No encuentro ese audio.' };
    return { ed: { ...ed, audios: ed.audios.filter((a) => a.id !== id) } };
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

// ---------------------------------------------------------------- la voz, las censuras y tus audios

/** Un cambio de una parte de la voz: { volumen, fadeIn, fadeOut }. */
export function ajustarTramoVoz(plan, ed, { id, cambios }) {
  const tramos = tramosVoz(plan, ed);
  if (!tramos.some((x) => x.id === id)) return { error: 'No encuentro esa parte de la voz.' };
  return conVoz(
    ed,
    tramos.map((x) => {
      if (x.id !== id) return x;
      const y = { ...x, ...cambios };
      const tope = Math.min(FUNDIDO_MAX, (y.hasta - y.desde) / 2);
      return { ...y, volumen: entre(Number(y.volumen) || 0, 0, 1), fadeIn: entre(Number(y.fadeIn) || 0, 0, tope), fadeOut: entre(Number(y.fadeOut) || 0, 0, tope) };
    })
  );
}

/** El fundido de entrada de la voz (su primera parte) o el de salida (la última). */
export function fundidoVoz(plan, ed, { lado, segundos }) {
  const tramos = tramosVoz(plan, ed);
  const x = lado === 'entrada' ? tramos[0] : tramos[tramos.length - 1];
  return ajustarTramoVoz(plan, ed, { id: x.id, cambios: lado === 'entrada' ? { fadeIn: segundos } : { fadeOut: segundos } });
}

/**
 * Censuras nuevas ({ desde, hasta, modo, palabra }): las que pisan una que ya está la reemplazan con el modo nuevo
 * (así «Pitido en todas» cambia las que estaban en silencio). -> { ed, nuevas }
 */
export function agregarCensuras(ed, lista) {
  let censuras = [...(ed.censuras || [])];
  let nuevas = 0;
  for (const c of lista) {
    const pisadas = censuras.filter((x) => x.desde < c.hasta && c.desde < x.hasta);
    if (pisadas.length && pisadas.every((x) => x.modo === c.modo && x.desde <= c.desde + 0.001 && x.hasta >= c.hasta - 0.001)) continue;
    censuras = censuras.filter((x) => !pisadas.includes(x));
    const desde = Math.min(c.desde, ...pisadas.map((x) => x.desde));
    const hasta = Math.max(c.hasta, ...pisadas.map((x) => x.hasta));
    censuras.push({ id: c.id || nuevoId('c'), desde: r4(desde), hasta: r4(hasta), modo: c.modo === 'silencio' ? 'silencio' : 'pitido', palabra: String(c.palabra || pisadas[0]?.palabra || '').slice(0, 80) });
    nuevas += 1;
  }
  return { ed: { ...ed, censuras: limpiarCensuras(censuras) }, nuevas };
}

/** Quita las censuras que tocan [desde, hasta] (la palabra vuelve a sonar). */
export function quitarCensurasEn(ed, desde, hasta) {
  return { ed: { ...ed, censuras: (ed.censuras || []).filter((c) => !(c.desde < hasta && desde < c.hasta)) } };
}

/** Pitido o silencio en una censura. */
export function modoCensura(ed, id, modo) {
  return { ed: { ...ed, censuras: (ed.censuras || []).map((c) => (c.id === id ? { ...c, modo: modo === 'silencio' ? 'silencio' : 'pitido' } : c)) } };
}

/** Silenciar un tramo de la voz desde el cursor (1,5 s, o lo que quede): una censura en silencio que se arrastra. */
export function silenciarTramo(plan, ed, { t, largo = 1.5 }) {
  const dur = plan.duracion || 1;
  const desde = r4(entre(t, 0, Math.max(0, dur - 0.3)));
  const hasta = r4(Math.min(dur, desde + largo));
  const id = nuevoId('c');
  const r = agregarCensuras(ed, [{ id, desde, hasta, modo: 'silencio', palabra: '' }]);
  return { ed: r.ed, nuevo: (r.ed.censuras || []).find((c) => c.desde <= desde + 0.001 && c.hasta >= hasta - 0.001)?.id || id };
}

/** Un audio tuyo nuevo en el cursor (ya subido: `archivo`), entero si cabe. */
export function agregarAudio(plan, ed, { t, archivo, nombre, duracion, id: idDado = null }) {
  const dur = plan.duracion || 1;
  const largo = Math.min(Number(duracion) > 0 ? Number(duracion) : 3, dur);
  const desde = r4(entre(t, 0, Math.max(0, dur - Math.min(largo, 0.5))));
  const id = idDado || nuevoId('a');
  const x = {
    id,
    archivo,
    nombre: String(nombre || 'Audio').replace(/\.[a-z0-9]+$/i, '').slice(0, 60) || 'Audio',
    duracion: Number(duracion) > 0 ? r4(Number(duracion)) : null,
    desde,
    hasta: r4(Math.min(dur, desde + largo)),
    entrada: 0,
    volumen: 1,
    fadeIn: 0,
    fadeOut: 0,
  };
  return { ed: { ...ed, audios: [...(ed.audios || []), x] }, nuevo: id };
}

/** Un cambio de un audio tuyo: { volumen, fadeIn, fadeOut }. */
export function ajustarAudio(ed, id, cambios) {
  return {
    ed: {
      ...ed,
      audios: (ed.audios || []).map((a) => {
        if (a.id !== id) return a;
        const y = { ...a, ...cambios };
        const tope = Math.min(FUNDIDO_MAX, (y.hasta - y.desde) / 2);
        return { ...y, volumen: r4(entre(Number(y.volumen) || 0, 0, 1)), fadeIn: r4(entre(Number(y.fadeIn) || 0, 0, tope)), fadeOut: r4(entre(Number(y.fadeOut) || 0, 0, tope)) };
      }),
    },
  };
}

/** El volumen o el color del clip de una pieza (ed.clips): volumen 0 a 1, color { brillo, contraste, saturacion }. */
export function ajustarClip(plan, ed, { pieza, volumen, color }) {
  if (!pieza) return { error: 'Elige un clip.' };
  const puede = queSePuedeConElClip(plan, pieza, ed);
  const cambios = {};
  if (volumen !== undefined) {
    if (!puede.volumen) return { error: puede.motivo || 'Este clip no cambia de volumen.' };
    cambios.volumen = volumen === null || Math.abs(Number(volumen) - 1) < 0.001 ? null : r4(entre(Number(volumen) || 0, 0, 1));
  }
  if (color !== undefined) {
    if (!puede.color) return { error: puede.motivo || 'Este clip no cambia de color.' };
    const c = color ? { brillo: r4(Number(color.brillo ?? 1)), contraste: r4(Number(color.contraste ?? 1)), saturacion: r4(Number(color.saturacion ?? 1)) } : null;
    cambios.color = c && Object.values(c).some((x) => Math.abs(x - 1) > 0.004) ? c : null;
  }
  return { ed: conClip(ed, pieza, cambios) };
}

// ---------------------------------------------------------------- duplicar y congelar

/**
 * Duplicar lo elegido (como en CapCut): un texto o una imagen tuya, o un audio tuyo. La copia va justo después del
 * original (o lo más cerca que se pueda del final). -> { ed, nuevo } | { error }
 */
export function duplicar(plan, ed, { pista, id, overlays = [] }) {
  const dur = plan.duracion || 1;
  const despues = (inicio, fin) => {
    const largo = fin - inicio;
    const desde = entre(fin, 0, Math.max(0, dur - largo));
    return [r4(desde), r4(Math.min(dur, desde + largo))];
  };
  if (pista === 'textos') {
    const propio = (ed.textosNuevos || []).find((x) => x.id === id);
    const visto = textosEnPantalla(plan, ed, overlays, null).find((x) => x.id === id);
    if (!visto) return { error: 'No encuentro ese texto.' };
    if (visto.tipo !== 'propio' && visto.tipo !== 'sugerido') return { error: 'Ese texto lo pone el estilo: no se duplica.' };
    const [inicio, fin] = despues(visto.inicio, visto.fin);
    const nuevo = nuevoId(propio?.archivo ? 'i' : 't');
    const { giro, ...estilo } = visto.estilo || {}; // eslint-disable-line no-unused-vars
    const base = propio || { texto: visto.texto, ...estilo };
    return { ed: { ...ed, textosNuevos: [...(ed.textosNuevos || []), { ...base, id: nuevo, inicio, fin }] }, nuevo };
  }
  if (pista === 'audios') {
    const a = (ed.audios || []).find((x) => x.id === id);
    if (!a) return { error: 'No encuentro ese audio.' };
    const [desde, hasta] = despues(a.desde, a.hasta);
    const nuevo = nuevoId('a');
    return { ed: { ...ed, audios: [...ed.audios, { ...a, id: nuevo, desde, hasta }] }, nuevo };
  }
  return { error: 'Eso no se duplica. Puedes duplicar un texto, una imagen tuya o un audio tuyo.' };
}

/**
 * Congelar imagen (como en CapCut) en el cursor: la escena se queda quieta `largo` segundos en ese cuadro y después
 * sigue desde ahí. La voz no se mueve, así que lo congelado se descuenta del final de la escena (si su clip no alcanza,
 * se avisa como siempre). Solo en las escenas que se cortan (los anuncios con la voz aparte).
 */
export function congelar(plan, ed, { id, t, largo = 1.5 }) {
  if (!cortesPosibles(plan).tomas) return NO_TOMAS(plan);
  const segs = tomasDeEdicion(plan, ed);
  const k = segs.findIndex((s) => s.id === id);
  if (k < 0) return { error: 'Elige una escena del video.' };
  const s = segs[k];
  if (s.congelado) return { error: 'Esa parte ya está congelada.' };
  t = enCuadro(s.inicio, t);
  if (t < s.inicio || t >= s.fin - 0.2) return { error: 'Pon el cursor dentro de la escena, un poco antes de su final.' };
  const quieto = Math.min(largo, s.fin - t);
  const enClip = s.entrada + (t - s.inicio) * s.velocidad; // el cuadro del clip que se congela (sin el deslizar)
  const partes = [];
  if (t - s.inicio >= 1 / FPS) partes.push({ ...s, duracion: t - s.inicio });
  const helada = { ...s, id: nuevoId('v'), entrada: enClip, duracion: quieto, cabeza: partes.length ? false : s.cabeza, congelado: true };
  partes.push(helada);
  const resto = s.fin - t - quieto;
  if (resto >= 1 / FPS) partes.push({ ...s, id: nuevoId('v'), entrada: enClip, duracion: resto, cabeza: false, congelado: false });
  return { ...conTomas(ed, [...segs.slice(0, k), ...partes, ...segs.slice(k + 1)]), nuevo: helada.id };
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
    tramosVoz(plan, ed).map((x) => [x.id, r(x.desde), r(x.hasta)]),
    (ed.censuras || []).map((c) => [c.id, r(c.desde), r(c.hasta)]),
    (ed.audios || []).map((a) => [a.id, r(a.desde), r(a.hasta), r(a.entrada)]),
  ]);
}

/** { tipo: 'dividir'|'recortar'|'mover'|'borrar'|'deslizar'|'velocidad', pista, id, ... } -> { ed } | { error } */
export function operar(plan, ed, op) {
  if (op.tipo === 'dividir') return dividir(plan, ed, op);
  if (op.tipo === 'borrar') return borrar(plan, ed, op);
  if (op.tipo === 'deslizar') return deslizar(plan, ed, op);
  if (op.tipo === 'velocidad') return cambiarVelocidad(plan, ed, op);
  if (op.tipo === 'duplicar') return duplicar(plan, ed, op);
  if (op.tipo === 'congelar') return congelar(plan, ed, op);
  if (op.tipo !== 'recortar' && op.tipo !== 'mover') return { error: 'No sé hacer eso.' };
  const r = op.tipo === 'recortar' ? recortar(plan, ed, op) : mover(plan, ed, op);
  // arrastrar hasta un tope (o soltar donde estaba) no es un cambio: no entra al historial
  if (r.ed && r.ed !== ed && huella(plan, r.ed, op) === huella(plan, ed, op)) return { ed };
  return r;
}

// De los cambios del editor (edicion.json) a las capas que dibuja AnuncioEditado.jsx.
//
// UNA SOLA CUENTA para la vista previa y para el video exportado: la composición AnuncioEditado llama a
// capasDeEdicion() con el plan de montaje, los cambios y su contexto, tanto dentro del <Player> del editor
// como en el render de produccion/exportar-edicion.js. Lo que se ve en el editor es lo que sale en el MP4.
//
// Va en .mjs (JavaScript puro, sin JSX ni remotion) porque lo usan tres:
//   - remotion/src/edicion/AnuncioEditado.jsx   (Remotion al renderizar, y el Player del editor)
//   - app/src/pantallas/editor/modelo.js         (las pistas de la línea de tiempo)
//   - produccion/exportar-edicion.js             (Node: el plan con los cambios para el control final y el .srt)
//
// Todo es cálculo puro: aquí no se guarda ni se pide nada.
import { marcarClaves, palabrasDeMarca } from './subtitulos/claves.mjs';

// remotion/src/Root.jsx
export const FPS = 30;
export const ANCHO = 720;
export const ALTO = 1280;

// ---------------------------------------------------------------- el estado del editor

/** Lo que el usuario puede cambiar en el editor, tal como sale del anuncio entregado. */
export const INICIAL = Object.freeze({
  subtitulos: { visible: true, estilo: 'caja', color: null, tamano: 1, altura: null },
  correcciones: {}, // índice del bloque de subtítulos -> texto corregido
  ocultos: [], // índices de bloques de subtítulos ocultos
  voz: { volumen: 1, silenciada: false },
  // fuente: original | propia | biblioteca | ninguna
  // tramos: null = la canción entera, de punta a punta; o [{ id, desde, hasta, entrada, fadeIn, fadeOut }] (en
  // segundos del anuncio; entrada = el segundo de la canción que suena en `desde`)
  musica: { fuente: 'original', volumen: 1, silenciada: false, inicio: 0, id: null, nombre: null, url: null, duracion: null, origen: null, tramos: null },
  quitados: [], // ids de B-roll o reacciones que el usuario ocultó (siguen en la línea de tiempo)
  textos: [], // ids de los textos sugeridos que se muestran en el video
  // Cortar y mover (solo los anuncios por bloques; la voz nunca se toca). null = como se entregó.
  tomas: null, // [{ id, b, entrada, duracion, cabeza }] en orden, una detrás de otra, cubriendo toda la voz
  brolls: null, // [{ id, b, desde, duracion, entrada }] encima de las tomas
  ajustesTextos: {}, // id de un texto sugerido -> { texto, inicio, fin, color, fondo, tamano, x, y, fuente } (lo que se cambió)
  textosNuevos: [], // los textos que agregó el usuario: [{ id, texto, inicio, fin, color, fondo, tamano, x, y, fuente }]
});

/** Une lo guardado con el estado inicial (si mañana se agrega un campo, lo viejo sigue sirviendo). */
export function completarEdicion(guardado) {
  if (!guardado || typeof guardado !== 'object' || Array.isArray(guardado)) return INICIAL;
  const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
  const lista = (x) => (Array.isArray(x) ? x : []);
  return {
    ...INICIAL,
    ...guardado,
    subtitulos: { ...INICIAL.subtitulos, ...obj(guardado.subtitulos) },
    voz: { ...INICIAL.voz, ...obj(guardado.voz) },
    musica: { ...INICIAL.musica, ...obj(guardado.musica) },
    correcciones: { ...obj(guardado.correcciones) },
    ocultos: lista(guardado.ocultos),
    quitados: lista(guardado.quitados),
    textos: lista(guardado.textos),
    tomas: Array.isArray(guardado.tomas) ? guardado.tomas : null,
    brolls: Array.isArray(guardado.brolls) ? guardado.brolls : null,
    ajustesTextos: { ...obj(guardado.ajustesTextos) },
    textosNuevos: lista(guardado.textosNuevos).filter((x) => x && typeof x === 'object' && x.id),
  };
}

// ---------------------------------------------------------------- el plan

/** bloques (voz en off y UGC) · continuidad (pasos encadenados) · escena (podcast y entrevista) */
export function familia(plan) {
  if (plan?.escena?.piezas) return 'escena';
  if (plan?.continuidad?.clips) return 'continuidad';
  return 'bloques';
}

/** Cómo suena la voz: un archivo aparte (voz en off o la canción de un musical) o dentro de los clips. */
export function modoVoz(plan) {
  const v = plan?.audio?.voz;
  if (v && /cancion/i.test(v)) return 'cancion';
  if (v) return 'voz-en-off';
  return 'en-clips';
}

export const numDe = (archivo, prefijo) => {
  const m = new RegExp(`(?:^|/)${prefijo}-(\\d+)\\.`).exec(archivo || '');
  return m ? Number(m[1]) : null;
};

// ---------------------------------------------------------------- cortar y mover tomas y B-roll

// LA VOZ NO SE MUEVE: es la base del anuncio. Las tomas van una detrás de otra y entre todas cubren justo lo que
// dura la voz (Anuncio.jsx estira cada toma hasta el arranque de la siguiente y la última hasta el final, así que
// nunca queda un hueco negro). Si un clip no alcanza a cubrir su lugar, se ve quieto al final: eso se avisa.
// El B-roll va encima, en su propio tiempo.

/** Lo más corto que puede quedar una toma, un B-roll, un texto o un tramo de música (segundos). */
export const MINIMO = 0.3;

const num = (x, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d);

/** Qué se puede cortar y mover en este anuncio, y por qué no lo demás. */
export function cortesPosibles(plan) {
  const fam = familia(plan);
  if (fam === 'continuidad') return { tomas: false, brolls: false, motivo: 'Con continuidad cada escena se transforma en la siguiente: las tomas no se cortan ni se mueven.' };
  if (fam === 'escena') return { tomas: false, brolls: false, motivo: 'En este estilo la voz va dentro de las tomas: cortarlas o moverlas cortaría la voz. El B-roll se puede quitar.' };
  if (modoVoz(plan) === 'en-clips') return { tomas: false, brolls: true, motivo: 'La voz va dentro de las tomas: cortarlas o moverlas cortaría la voz.' };
  return { tomas: true, brolls: true, motivo: null };
}

/** Las tomas tal como se entregaron: [{ id, b, entrada, duracion, cabeza }]. */
export function tomasBase(plan) {
  const dur = num(plan?.duracion, 1);
  const todos = plan?.bloques || [];
  const bl = todos.map((b, i) => ({ b, i })).filter(({ b }) => b.toma);
  const inicios = bl.map(({ b }, k) => (k === 0 ? 0 : num(b.toma.desde ?? b.inicio)));
  return bl.map(({ b, i }, k) => ({ id: `v${i}`, b: i, entrada: Math.max(0, num(b.toma.recorteInicio)), duracion: (k + 1 < bl.length ? inicios[k + 1] : dur) - inicios[k], cabeza: true }));
}

/**
 * Las tomas con los cambios, en orden y con su lugar: [{ id, b, entrada, duracion, cabeza, inicio, fin, archivo,
 * velocidad, largo, cubre }]. `cubre`: cuántos segundos del anuncio alcanza a llenar su clip desde `entrada`
 * (null si no se sabe). Siempre cubren de 0 al final de la voz: si la suma no da, la última se estira.
 */
export function tomasDeEdicion(plan, ed) {
  const bl = plan?.bloques || [];
  const dur = num(plan?.duracion, 1);
  let lista = Array.isArray(ed?.tomas) ? ed.tomas.filter((s) => s && Number.isInteger(s.b) && bl[s.b]?.toma && num(s.duracion) > 0) : null;
  if (!lista || !lista.length) lista = tomasBase(plan);
  let t = 0;
  const salida = [];
  lista.forEach((s, i) => {
    const o = bl[s.b].toma;
    const velocidad = num(o.velocidad, 1) || 1;
    const largo = num(o.largoOriginal) > 0 ? num(o.largoOriginal) : null;
    const inicio = t;
    const fin = i === lista.length - 1 ? dur : Math.min(dur, t + num(s.duracion));
    if (fin - inicio <= 1e-6) return;
    t = fin;
    const entrada = Math.max(0, largo ? Math.min(num(s.entrada), largo - 0.1) : num(s.entrada));
    salida.push({ id: String(s.id), b: s.b, entrada, duracion: fin - inicio, cabeza: s.cabeza !== false, inicio, fin, archivo: o.archivo, velocidad, largo, cubre: largo ? Math.max(0, (largo - entrada) / velocidad) : null });
  });
  if (salida.length && salida[salida.length - 1].fin < dur) {
    const u = salida[salida.length - 1];
    u.fin = dur;
    u.duracion = dur - u.inicio;
  }
  return salida;
}

/** Los B-roll tal como se entregaron: [{ id, b, desde, duracion, entrada }]. */
export function brollsBase(plan) {
  const salida = [];
  (plan?.bloques || []).forEach((b, i) => {
    if (!b.broll?.archivo) return;
    const n = b.broll.n ?? numDe(b.broll.archivo, 'broll');
    salida.push({ id: `b${n}`, b: i, desde: num(b.broll.desde), duracion: num(b.broll.duracion), entrada: Math.max(0, num(b.broll.recorteInicio)) });
  });
  return salida;
}

/** Los B-roll con los cambios: [{ id, b, desde, duracion, entrada, fin, archivo, n, velocidad, largo, cubre }]. */
export function brollsDeEdicion(plan, ed) {
  const bl = plan?.bloques || [];
  const dur = num(plan?.duracion, 1);
  const lista = Array.isArray(ed?.brolls) ? ed.brolls.filter((x) => x && Number.isInteger(x.b) && bl[x.b]?.broll?.archivo) : brollsBase(plan);
  return lista
    .map((x) => {
      const o = bl[x.b].broll;
      const velocidad = num(o.velocidad, 1) || 1;
      const largo = num(o.largoOriginal) > 0 ? num(o.largoOriginal) : null;
      const desde = Math.max(0, Math.min(dur, num(x.desde)));
      const entrada = Math.max(0, largo ? Math.min(num(x.entrada), largo - 0.1) : num(x.entrada));
      const fin = Math.min(dur, desde + Math.max(0, num(x.duracion)));
      return { id: String(x.id), b: x.b, desde, duracion: fin - desde, entrada, fin, archivo: o.archivo, n: o.n ?? numDe(o.archivo, 'broll'), velocidad, largo, cubre: largo ? Math.max(0, (largo - entrada) / velocidad) : null };
    })
    .filter((x) => x.fin - x.desde > 0.05);
}

/** Cuánto se ve quieta una toma al final (segundos): lo que su clip no alcanza, menos lo que tapa el B-roll. */
export function quietoDeToma(s, brollsVisibles) {
  if (s.cubre === null || s.cubre === undefined) return 0;
  const desde = s.inicio + s.cubre;
  if (desde >= s.fin - 0.05) return 0;
  // el tramo quieto menos los B-roll que lo tapan
  let tramos = [[desde, s.fin]];
  for (const x of brollsVisibles) {
    const nuevos = [];
    for (const [a, z] of tramos) {
      if (x.fin <= a || x.desde >= z) nuevos.push([a, z]);
      else {
        if (x.desde > a) nuevos.push([a, x.desde]);
        if (x.fin < z) nuevos.push([x.fin, z]);
      }
    }
    tramos = nuevos;
  }
  const total = tramos.reduce((suma, [a, z]) => suma + (z - a), 0);
  return total >= 0.1 ? Math.round(total * 10) / 10 : 0;
}

// ---------------------------------------------------------------- subtítulos con las correcciones

/** Si cambia la cantidad de palabras, el tiempo del bloque se reparte según el largo de cada una. */
function repartir(b, texto) {
  const nuevas = String(texto).trim().split(/\s+/).filter(Boolean);
  if (!nuevas.length) return [];
  const viejas = b.palabras || [];
  if (nuevas.length === viejas.length) return viejas.map((p, j) => ({ ...p, texto: nuevas[j] }));
  const ini = viejas[0]?.inicio ?? b.inicio;
  const fin = viejas[viejas.length - 1]?.fin ?? b.fin;
  const pesos = nuevas.map((w) => w.length + 1);
  const total = pesos.reduce((s, x) => s + x, 0);
  let t = ini;
  return nuevas.map((w, j) => {
    const d = ((fin - ini) * pesos[j]) / total;
    const p = { texto: w, inicio: t, fin: t + d * 0.92 };
    t += d;
    return p;
  });
}

/** [{ id, inicio, fin, texto, original, palabras, corregido, oculto, desdeAbajo? }] */
export function subtitulosEditados(plan, ed, borrador = null) {
  const ocultos = new Set(ed.ocultos);
  return (plan.subtitulos || []).map((b, i) => {
    const corregido = borrador && borrador.id === i ? borrador.texto : ed.correcciones[i];
    const base = { ...b, id: i, original: b.texto, oculto: ocultos.has(i) };
    if (corregido === undefined || corregido === null || corregido === b.texto) return { ...base, corregido: false };
    return { ...base, texto: corregido, palabras: repartir(b, corregido), corregido: true };
  });
}

// El color propio de los estilos que lo tienen (el resto usa el del anuncio). La lista de estilos con su
// nombre y su dibujo está en subtitulos/estilos.jsx.
export const COLOR_PROPIO = { creador: '#FFE234', claves: '#FFD43B' };

/** El color con que se pinta un estilo: el que eligió el usuario, el propio del estilo o el del anuncio. */
export function colorDeEstilo(estiloId, colorElegido, colorDelAnuncio) {
  return colorElegido || COLOR_PROPIO[estiloId] || colorDelAnuncio || '#E8442A';
}

/** Los ajustes de la capa de subtítulos para la composición (o null si están apagados). */
export function ajustesSubtitulos(plan, ed, subs, titulo) {
  if (!ed.subtitulos.visible) return null;
  const visibles = subs.filter((b) => !b.oculto);
  if (!visibles.length) return null;
  const e = plan.estiloSubtitulos || {};
  const alturaBase = e.desdeAbajo ?? 0.26;
  return {
    bloques: visibles,
    estilo: ed.subtitulos.estilo,
    color: colorDeEstilo(ed.subtitulos.estilo, ed.subtitulos.color, e.colorResaltado),
    tamano: (e.tamano ?? 0.0722) * ed.subtitulos.tamano,
    altura: ed.subtitulos.altura ?? alturaBase,
    alturaBase,
    marcas: ed.subtitulos.estilo === 'claves' ? marcarClaves(subs, palabrasDeMarca(titulo)) : null,
  };
}

// ---------------------------------------------------------------- el plan con los cambios

/** El plan de montaje con los cambios del usuario, listo para remotion/src/Anuncio.jsx. */
export function planAjustado(plan, ed) {
  const fam = familia(plan);
  const mv = modoVoz(plan);
  const p = { ...plan, audio: { ...(plan.audio || {}) } };

  if (mv !== 'en-clips') {
    // la voz (o la canción) la monta AnuncioEditado encima, con su volumen
    p.audio.voz = null;
  } else {
    // la voz está dentro de los clips: su volumen es el de los clips
    const vol = ed.voz.silenciada ? 0 : ed.voz.volumen;
    const extra = vol <= 0.001 ? -90 : 20 * Math.log10(vol);
    p.audio.ducking = (plan.audio?.ducking ?? 0) + extra;
    if (fam === 'escena') {
      p.escena = { ...plan.escena, piezas: plan.escena.piezas.map((x) => (typeof x.volumenDb === 'number' ? { ...x, volumenDb: x.volumenDb + extra } : x)) };
    }
  }

  const quitados = new Set(ed.quitados);
  if (fam === 'bloques' && (ed.tomas || ed.brolls)) {
    // Con cortes: las tomas en su nuevo orden y largo, y TODOS los B-roll encima. Cada B-roll va en un bloque
    // extra al final cuya toma arranca donde termina el anuncio (no se ve nunca): Anuncio.jsx dibuja el B-roll
    // de cada bloque después de las tomas de los bloques anteriores, así que en esos bloques queda encima de todas.
    const dur = num(plan.duracion, 1);
    const segs = tomasDeEdicion(plan, ed);
    const brolls = brollsDeEdicion(plan, ed).filter((x) => !quitados.has(x.id));
    // Una toma dividida en partes va sin el acercamiento lento (tipo A y C en Anuncio.jsx): cada parte haría el
    // suyo y en el corte se vería un salto de zoom. Dividir no tiene que cambiar nada de lo que se ve.
    const partes = new Map();
    for (const s of segs) partes.set(s.b, (partes.get(s.b) || 0) + 1);
    const bloques = segs.map((s) => {
      const o = plan.bloques[s.b];
      const tipo = partes.get(s.b) > 1 && (o.tipo === 'A' || o.tipo === 'C') ? 'B' : o.tipo;
      return { ...o, tipo, linea: s.cabeza ? o.linea : null, inicio: s.inicio, fin: s.fin, toma: { ...o.toma, desde: s.inicio, recorteInicio: s.entrada, duracion: s.duracion }, broll: null };
    });
    const ancla = segs[segs.length - 1]?.archivo || plan.bloques.find((b) => b.toma)?.toma.archivo;
    for (const x of brolls) {
      bloques.push({ tipo: 'broll', linea: null, inicio: dur, fin: dur, texto: '', toma: { archivo: ancla, desde: dur }, broll: { ...plan.bloques[x.b].broll, desde: x.desde, duracion: x.fin - x.desde, recorteInicio: x.entrada } });
    }
    p.bloques = bloques;
    // la animación y el sonido de entrada siguen a su toma (si se borró el comienzo de la toma, se van con él)
    const cabezas = new Map(segs.filter((s) => s.cabeza).map((s) => [plan.bloques[s.b].linea, s]));
    p.transiciones = (plan.transiciones || []).flatMap((tr) => {
      const s = cabezas.get(tr.toma);
      return s ? [{ ...tr, desde: s.inicio }] : [];
    });
  } else if (quitados.size && fam === 'bloques') {
    p.bloques = plan.bloques.map((b) => {
      if (!b.broll) return b;
      const nb = b.broll.n ?? numDe(b.broll.archivo, 'broll');
      return quitados.has(`b${nb}`) ? { ...b, broll: null } : b;
    });
  }
  if (quitados.size && fam === 'escena') {
    const originales = plan.escena.piezas;
    const fuera = new Set();
    originales.forEach((x, idx) => {
      if (!quitados.has(`e${idx}`)) return;
      fuera.add(idx);
      // el B-roll en pantalla dividida lleva una copia del anfitrión en la mitad de abajo: se va con él
      if (numDe(x.archivo, 'broll') !== null) {
        originales.forEach((y, j) => {
          if (y.marco === 'mitad-inferior' && Math.abs(y.desde - x.desde) < 0.05) fuera.add(j);
        });
      }
    });
    p.escena = { ...(p.escena || plan.escena), piezas: (p.escena || plan.escena).piezas.filter((_, idx) => !fuera.has(idx)) };
  }
  return p;
}

// ---------------------------------------------------------------- música

/**
 * La música que suena (o null). En los musicales la canción es el anuncio: no hay música aparte.
 *   urlDe(fuente, m)  dónde está el archivo: la vista previa lo da como URL (o el archivo que arrastró el
 *                     usuario), el render como ruta dentro de su carpeta pública. null = no está.
 */
export function musicaDeEdicion(plan, ed, urlDe) {
  if (modoVoz(plan) === 'cancion') return null;
  const m = ed.musica;
  if (m.fuente === 'ninguna') return null;
  if (m.fuente === 'propia') {
    const url = urlDe('propia', m) || null;
    return { fuente: 'propia', nombre: m.nombre || 'Tu canción', url, falta: !url, duracion: m.duracion, inicio: m.inicio || 0, repetir: true };
  }
  if (m.fuente === 'biblioteca' && m.url) {
    const url = urlDe('biblioteca', m) || null;
    return { fuente: 'biblioteca', nombre: m.nombre || 'Música', origen: m.origen, url, falta: !url, duracion: m.duracion, inicio: m.inicio || 0, repetir: true };
  }
  if (!plan.musica?.archivo) return null;
  return {
    fuente: 'original',
    nombre: 'Música del anuncio',
    url: urlDe('original', m) || plan.musica.archivo,
    duracion: plan.musica.duracionPista || null,
    inicio: 0,
    repetir: Boolean(plan.musica.loop),
  };
}

/** La música para la composición (o null). */
export function ajustesMusica(plan, ed, musica) {
  if (!musica?.url || ed.musica.silenciada) return null;
  const hablado = modoVoz(plan) === 'en-clips';
  const m = plan.musica || {};
  return {
    src: musica.url,
    db: m.db ?? (hablado ? -24 : -26),
    subeEnPayoffDb: m.subeEnPayoffDb ?? 0,
    payoffDesdeSeg: m.payoffDesdeSeg ?? null,
    fadeInSeg: m.fadeInSeg ?? 1.2,
    fadeOutSeg: m.fadeOutSeg ?? 1.5,
    multiplicador: ed.musica.volumen,
    inicio: musica.inicio || 0,
    repetir: musica.repetir,
    duracionPista: musica.duracion || null,
    // recortada o movida: los tramos que suenan, cada uno con su fundido (null: la canción entera, como siempre)
    tramos: Array.isArray(ed.musica.tramos) ? tramosMusica(plan, ed, musica) : null,
  };
}

/**
 * El segundo de la canción que suena tras avanzar `entrada` segundos desde su comienzo. Una canción que se repite
 * da la vuelta al llegar a su final y sigue desde donde arranca (musica.inicio, 0 si no se eligió), igual que la
 * canción entera sin cortes. Una que no se repite, tal cual.
 */
export function entradaEnLaCancion(entrada, musica) {
  const e = Math.max(0, num(entrada));
  const largo = num(musica?.duracion ?? musica?.duracionPista);
  if (!musica?.repetir || !(largo > 0) || e < largo) return e;
  let base = Math.max(0, num(musica.inicio));
  if (largo - base < 0.5) base = 0;
  return base + ((e - base) % (largo - base));
}

/**
 * Los tramos en que suena la música: [{ id, desde, hasta, entrada, fadeIn, fadeOut }] (segundos del anuncio;
 * entrada = el segundo de la canción que suena en `desde`). Sin cambios, uno solo de punta a punta con los
 * fundidos del anuncio. Ordenados y sin pisarse.
 */
export function tramosMusica(plan, ed, musica) {
  if (!musica) return [];
  const dur = num(plan?.duracion, 1);
  const pm = plan?.musica || {};
  const fi = num(pm.fadeInSeg ?? 1.2, 1.2);
  const fo = num(pm.fadeOutSeg ?? 1.5, 1.5);
  const guardados = Array.isArray(ed?.musica?.tramos) ? ed.musica.tramos.filter((x) => x && typeof x === 'object') : null;
  const lista = guardados || [{ id: 'm0', desde: 0, hasta: dur, entrada: musica.inicio || 0, fadeIn: fi, fadeOut: fo }];
  const salida = lista
    .map((x, i) => ({
      id: String(x.id ?? `m${i}`),
      desde: Math.max(0, Math.min(dur, num(x.desde))),
      hasta: Math.max(0, Math.min(dur, num(x.hasta, dur))),
      entrada: entradaEnLaCancion(x.entrada, musica),
      fadeIn: Math.max(0, num(x.fadeIn, fi)),
      fadeOut: Math.max(0, num(x.fadeOut, fo)),
    }))
    .filter((x) => x.hasta - x.desde > 0.05)
    .sort((x, y) => x.desde - y.desde);
  for (let i = 1; i < salida.length; i++) if (salida[i].desde < salida[i - 1].hasta) salida[i].desde = salida[i - 1].hasta;
  return salida.filter((x) => x.hasta - x.desde > 0.05);
}

// ---------------------------------------------------------------- textos en pantalla

/** Con continuidad: cada clip de la cadena con su número (paso o toma) y su ventana. */
function ventanasDeContinuidad(plan) {
  const dur = plan.duracion || 1;
  const clips = plan.continuidad?.clips || [];
  return clips.map((c, i) => ({
    n: numDe(c.archivo, 'paso') ?? numDe(c.archivo, 'toma'),
    inicio: i === 0 ? 0 : c.desde,
    fin: i + 1 < clips.length ? clips[i + 1].desde : dur,
  }));
}

/**
 * Los textos sugeridos del manifiesto ("overlays"): hoy no se dibujan en el video entregado, el usuario
 * los activa en el editor. [{ id: 'x0', tipo: 'sugerido', inicio, fin, texto, visible }]
 */
export function textosSugeridos(plan, ed, overlays) {
  if (familia(plan) === 'escena') return [];
  const dur = plan.duracion || 1;
  const activos = new Set(ed.textos);
  const continuidad = familia(plan) === 'continuidad' ? ventanasDeContinuidad(plan) : [];
  const salida = [];
  (overlays || []).forEach((o, i) => {
    const linea = (plan.bloques || []).find((b) => b.linea === o.toma);
    const pieza = linea ? { inicio: linea.inicio, fin: linea.fin } : continuidad.find((v) => v.n === o.toma);
    if (!pieza) return;
    const largo = Math.min(2.6, Math.max(0.8, pieza.fin - pieza.inicio));
    const [ini, fin] = o.momento === 'fin' ? [pieza.fin - largo, pieza.fin] : [pieza.inicio, pieza.inicio + largo];
    salida.push({ id: `x${i}`, tipo: 'sugerido', inicio: Math.max(0, ini), fin: Math.min(dur, fin), texto: o.texto, visible: activos.has(`x${i}`) });
  });
  return salida;
}

/** Los tipos de letra de los textos en pantalla: las fuentes que ya usa el editor (subtitulos/fuentes.js). */
export const FUENTES_TEXTO = [
  { id: 'titulo', nombre: 'Gruesa' },
  { id: 'caja', nombre: 'Clásica' },
  { id: 'angosta', nombre: 'Angosta' },
  { id: 'ui', nombre: 'Simple' },
  { id: 'cursiva', nombre: 'Cursiva' },
];
/** Dónde va un texto si no se movió: centrado, con su borde de arriba al 17 % del alto. */
export const LUGAR_TEXTO = { x: 0.5, y: 0.17 };

/**
 * Todos los textos en pantalla con su aspecto ya resuelto: los sugeridos (con lo que el usuario les cambió) y
 * los que agregó él. [{ id, tipo: 'sugerido'|'propio', inicio, fin, texto, visible, editado, estilo }]
 *   estilo = { color, fondo (null = sin fondo), tamano, x, y, fuente, giro }
 * Sin cambios, los sugeridos que se ven alternan el color del anuncio y el blanco (como siempre).
 */
export function textosEnPantalla(plan, ed, overlays, colorAnuncio) {
  const dur = num(plan?.duracion, 1);
  const color = colorAnuncio || plan?.estiloSubtitulos?.colorResaltado || '#E8442A';
  const ajustes = ed?.ajustesTextos || {};
  const tiempo = (a, x) => {
    const inicio = Math.max(0, Math.min(dur - MINIMO, num(a.inicio ?? x.inicio)));
    const fin = Math.max(inicio + 0.05, Math.min(dur, num(a.fin ?? x.fin)));
    return { inicio, fin };
  };
  const estilo = (a, porDefecto) => ({
    color: a.color || porDefecto.color,
    fondo: a.fondo === undefined ? porDefecto.fondo : a.fondo || null,
    tamano: num(a.tamano, 1) > 0 ? num(a.tamano, 1) : 1,
    x: num(a.x ?? LUGAR_TEXTO.x, LUGAR_TEXTO.x),
    y: num(a.y ?? LUGAR_TEXTO.y, LUGAR_TEXTO.y),
    fuente: FUENTES_TEXTO.some((f) => f.id === a.fuente) ? a.fuente : 'titulo',
    giro: porDefecto.giro,
  });
  let k = 0;
  const sugeridos = textosSugeridos(plan, ed, overlays).map((x) => {
    const a = ajustes[x.id] && typeof ajustes[x.id] === 'object' ? ajustes[x.id] : {};
    const impar = (x.visible ? k++ : k) % 2 === 1;
    const porDefecto = { color: impar ? '#111111' : '#FFFFFF', fondo: impar ? '#FFFFFF' : color, giro: impar ? 2 : -2 };
    return { ...x, ...tiempo(a, x), texto: typeof a.texto === 'string' ? a.texto : x.texto, editado: Object.keys(a).length > 0, estilo: estilo(a, porDefecto) };
  });
  const propios = (ed?.textosNuevos || []).map((a, j) => ({
    id: String(a.id),
    tipo: 'propio',
    ...tiempo(a, { inicio: 0, fin: Math.min(dur, 2.5) }),
    texto: String(a.texto ?? ''),
    visible: true,
    editado: true,
    estilo: estilo(a, { color: '#FFFFFF', fondo: color, giro: j % 2 ? 2 : -2 }),
  }));
  return [...sugeridos, ...propios];
}

// ---------------------------------------------------------------- todo junto

/**
 * Las capas de la composición AnuncioEditado.
 *   contexto = { titulo, overlays, color, musica }
 *     titulo     el del anuncio (sus palabras se resaltan en el estilo "Palabras clave")
 *     overlays   los textos sugeridos del manifiesto ([{ texto, toma, momento }])
 *     color      el color del anuncio (los textos en pantalla y los subtítulos sin color propio)
 *     musica     la de musicaDeEdicion() (con su url ya resuelta) o null
 */
export function capasDeEdicion(plan, edicion, contexto = {}) {
  const ed = completarEdicion(edicion);
  const subs = subtitulosEditados(plan, ed);
  const mv = modoVoz(plan);
  const color = contexto.color || plan.estiloSubtitulos?.colorResaltado || '#E8442A';
  return {
    plan: planAjustado(plan, ed),
    voz: mv !== 'en-clips' && plan.audio?.voz ? { archivo: plan.audio.voz, volumen: ed.voz.silenciada ? 0 : ed.voz.volumen } : null,
    musica: ajustesMusica(plan, ed, contexto.musica || null),
    subtitulos: ajustesSubtitulos(plan, ed, subs, contexto.titulo || ''),
    textos: textosEnPantalla(plan, ed, contexto.overlays, color).filter((x) => x.visible && String(x.texto).trim()),
    color,
  };
}

// ---------------------------------------------------------------- el .srt

const dos = (n) => String(n).padStart(2, '0');

function tiempoSrt(seg) {
  const ms = Math.max(0, Math.round(seg * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${dos(h)}:${dos(m)}:${dos(s)},${String(ms % 1000).padStart(3, '0')}`;
}

/** El archivo de subtítulos .srt: los mismos bloques que se ven en el video, con las palabras corregidas. */
export function hacerSrt(bloques) {
  return bloques
    .filter((b) => !b.oculto && String(b.texto || '').trim())
    .map((b, i) => `${i + 1}\n${tiempoSrt(b.inicio)} --> ${tiempoSrt(b.fin)}\n${String(b.texto).trim()}\n`)
    .join('\n');
}

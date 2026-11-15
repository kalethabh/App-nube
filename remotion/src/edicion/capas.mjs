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
  subtitulos: { visible: true, estilo: 'caja', color: null, tamano: 1, altura: null, lado: 0 }, // lado: corrimiento a lo ancho (fracción del ancho, -0,35 a 0,35)
  lugaresSubtitulos: {}, // un subtítulo movido solo: índice del bloque -> { altura, lado } (mandan sobre los de todos)
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
  //               y sus imágenes: [{ id, texto (el nombre), archivo: 'app/edicion/imagenes/img-<id>.<ext>', inicio, fin, ancho, x, y }]
  // Tu propio video en lugar de un clip (modo «en la edición»: no toca el anuncio). La clave es la pieza del plan
  // ORIGINAL ('toma-3', 'broll-2', 'paso-4'), así la pieza sigue llamándose igual y se puede regenerar.
  //   { id, archivo: 'subidos/<id>.mp4', largo, nombre, mudo }   mudo: true por defecto (la voz va aparte)
  reemplazos: {},
  // Velocidad y deslizar por clip (misma clave): { velocidad: 0.5 a 2, desliza: segundos del clip }. desliza cambia
  // dónde empieza lo que se ve sin mover la ventana (se suma a la entrada de cada parte de esa pieza).
  clips: {},
  // Tus propios videos (plan.videoPropio): qué versión del video (con qué partes quitadas) va con estos cambios. Así
  // deshacer y rehacer en el editor también ponen y quitan los cortes (rutas/video-propio.js: versiones). null = el
  // video tal como entró.
  corte: null,
});

/** Las velocidades que ofrece el editor (cualquier número entre VELOCIDAD_MIN y VELOCIDAD_MAX también vale). */
export const VELOCIDADES = Object.freeze([0.5, 0.75, 1, 1.25, 1.5, 2]);
export const VELOCIDAD_MIN = 0.5;
export const VELOCIDAD_MAX = 2;
const ARCHIVO_SUBIDO = /^subidos\/[a-z0-9]{6,40}\.mp4$/i;

/** Los reemplazos guardados que sirven (archivo de subidos/ y largo conocido). */
function limpiarReemplazos(x) {
  const salida = {};
  for (const [pieza, r] of Object.entries(x && typeof x === 'object' && !Array.isArray(x) ? x : {})) {
    if (!/^(toma|broll|paso)-\d+$/.test(pieza) || !r || typeof r !== 'object') continue;
    if (!ARCHIVO_SUBIDO.test(String(r.archivo || '')) || !(Number(r.largo) > 0)) continue;
    salida[pieza] = { id: String(r.id || ''), archivo: String(r.archivo), largo: Number(r.largo), nombre: r.nombre ? String(r.nombre).slice(0, 200) : null, mudo: r.mudo !== false };
  }
  return salida;
}

/** Los ajustes de velocidad y deslizar guardados, dentro de sus topes. */
function limpiarClips(x) {
  const salida = {};
  for (const [pieza, c] of Object.entries(x && typeof x === 'object' && !Array.isArray(x) ? x : {})) {
    if (!/^(toma|broll|paso)-\d+$/.test(pieza) || !c || typeof c !== 'object') continue;
    const v = Number(c.velocidad);
    const d = Number(c.desliza);
    const limpio = {};
    if (Number.isFinite(v) && v > 0) limpio.velocidad = Math.min(VELOCIDAD_MAX, Math.max(VELOCIDAD_MIN, v));
    if (Number.isFinite(d) && d !== 0) limpio.desliza = d;
    if (Object.keys(limpio).length) salida[pieza] = limpio;
  }
  return salida;
}

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
    lugaresSubtitulos: { ...obj(guardado.lugaresSubtitulos) },
    textosNuevos: lista(guardado.textosNuevos)
      .filter((x) => x && typeof x === 'object' && x.id)
      .filter((x) => x.archivo === undefined || ARCHIVO_IMAGEN.test(String(x.archivo))),
    reemplazos: limpiarReemplazos(guardado.reemplazos),
    clips: limpiarClips(guardado.clips),
    corte: typeof guardado.corte === 'string' && /^v[a-z0-9]{1,24}$/.test(guardado.corte) ? guardado.corte : null,
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

// ---------------------------------------------------------------- tu propio video, velocidad y deslizar

/** La pieza de un archivo del plan: 'toma-3' | 'broll-2' | 'paso-4' | null (recortes, sonidos, imágenes…). */
export function piezaDeArchivo(archivo) {
  const m = /(?:^|\/)(toma|broll|paso)-(\d+)\.mp4$/.exec(String(archivo || ''));
  return m ? `${m[1]}-${m[2]}` : null;
}

/**
 * Qué se puede hacer con el clip de una pieza en el editor (gratis):
 *   { velocidad, deslizar, reemplazar: 'edicion' | 'anuncio' | null, motivo }
 * reemplazar 'edicion': tu video entra en la edición (no toca el anuncio). 'anuncio': el audio del clip es la voz, así
 * que tu video reemplaza la pieza de verdad y la app vuelve a medir la voz (POST /reemplazo). Con un reemplazo en la
 * edición, la velocidad y el deslizar siempre se pueden.
 */
export function queSePuedeConElClip(plan, pieza, ed = null) {
  const fam = familia(plan);
  const esBroll = /^broll-/.test(String(pieza));
  const reemplazado = Boolean(ed?.reemplazos?.[pieza]);
  const todo = { velocidad: true, deslizar: true, reemplazar: 'edicion', motivo: null };
  if (!/^(toma|broll|paso)-\d+$/.test(String(pieza))) return { velocidad: false, deslizar: false, reemplazar: null, motivo: 'Esta parte no es un clip.' };
  if (esBroll) return todo;
  if (fam === 'continuidad') {
    return reemplazado ? todo : { velocidad: false, deslizar: false, reemplazar: 'edicion', motivo: 'Con continuidad cada clip va justo de una escena a la siguiente: su velocidad la pone la app. Si lo reemplazas con tu video, sí puedes cambiarla.' };
  }
  if (fam === 'escena' || modoVoz(plan) === 'en-clips') {
    return { velocidad: false, deslizar: false, reemplazar: 'anuncio', motivo: 'La voz va dentro de este clip: acelerarlo o moverlo desarmaría la voz y los subtítulos. Si lo reemplazas con tu video, la app vuelve a medir la voz.' };
  }
  return todo;
}

/** Lo que el usuario cambió en el clip de una pieza: { reemplazo (o null), velocidad (o null = la del plan), desliza }. */
export function ajusteDeClip(plan, ed, pieza) {
  if (!pieza) return { reemplazo: null, velocidad: null, desliza: 0 };
  const puede = queSePuedeConElClip(plan, pieza, ed);
  const reemplazo = puede.reemplazar === 'edicion' ? ed?.reemplazos?.[pieza] || null : null;
  const c = ed?.clips?.[pieza] || {};
  const v = Number(c.velocidad);
  return {
    reemplazo,
    velocidad: puede.velocidad && Number.isFinite(v) && v > 0 ? Math.min(VELOCIDAD_MAX, Math.max(VELOCIDAD_MIN, v)) : reemplazo ? 1 : null,
    desliza: puede.deslizar && Number.isFinite(Number(c.desliza)) ? Number(c.desliza) : 0,
  };
}

/** Una entrada (segundo del clip) dentro del clip: nunca antes de 0 ni pasada su última décima. */
const dentroDelClip = (entrada, largo) => Math.max(0, largo ? Math.min(entrada, largo - 0.1) : entrada);

/**
 * Un clip del plan (toma o B-roll de bloques, pieza de escena, clip de continuidad) con lo que cambió el usuario:
 * archivo y largo del video subido, velocidad, entrada (recorteInicio, con el deslizar) y mudo. Sin cambios, el mismo
 * objeto. `base` = la entrada sin el deslizar (si no viene, la del clip; con un reemplazo, 0).
 */
function clipAjustado(o, aj, { base = null } = {}) {
  if (!o || (!aj.reemplazo && aj.velocidad === null && !aj.desliza)) return o;
  const r = aj.reemplazo;
  const largo = r ? r.largo : num(o.largoOriginal ?? o.largo) > 0 ? num(o.largoOriginal ?? o.largo) : null;
  const desde = base ?? (r ? 0 : num(o.recorteInicio));
  const salida = { ...o, recorteInicio: dentroDelClip(desde + aj.desliza, largo) };
  if (aj.velocidad !== null) salida.velocidad = aj.velocidad;
  if (r) Object.assign(salida, { archivo: r.archivo, largoOriginal: r.largo, largo: r.largo, mudo: r.mudo !== false, audioDeformado: false, reemplazo: true });
  return salida;
}

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
  if (fam === 'continuidad') return { tomas: false, brolls: false, motivo: 'Con continuidad cada escena se transforma en la siguiente: las escenas no se cortan ni se mueven.' };
  if (fam === 'escena') return { tomas: false, brolls: false, motivo: 'En este estilo la voz va dentro de las escenas: cortarlas o moverlas cortaría la voz. Las imágenes de apoyo se pueden quitar.' };
  if (modoVoz(plan) === 'en-clips') return { tomas: false, brolls: true, motivo: 'La voz va dentro de las escenas: cortarlas o moverlas cortaría la voz.' };
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
  const sinCortes = !lista || !lista.length;
  if (sinCortes) lista = tomasBase(plan);
  let t = 0;
  const salida = [];
  lista.forEach((s, i) => {
    const o = bl[s.b].toma;
    // tu video o la velocidad que elegiste (la pieza es la del plan original: sigue llamándose igual)
    const pieza = piezaDeArchivo(o.archivo);
    const aj = ajusteDeClip(plan, ed, pieza);
    const r = aj.reemplazo;
    const velocidad = aj.velocidad ?? (num(o.velocidad, 1) || 1);
    const largo = r ? r.largo : num(o.largoOriginal) > 0 ? num(o.largoOriginal) : null;
    const inicio = t;
    const fin = i === lista.length - 1 ? dur : Math.min(dur, t + num(s.duracion));
    if (fin - inicio <= 1e-6) return;
    t = fin;
    const entrada = dentroDelClip(r && sinCortes ? 0 : num(s.entrada), largo);
    // lo que se ve: la entrada con el deslizar (`entrada` es la guardada, la que mueven cortar y recortar)
    const entradaVista = dentroDelClip(entrada + aj.desliza, largo);
    salida.push({
      id: String(s.id),
      b: s.b,
      entrada,
      entradaVista,
      duracion: fin - inicio,
      cabeza: s.cabeza !== false,
      inicio,
      fin,
      archivo: r ? r.archivo : o.archivo,
      pieza,
      reemplazado: Boolean(r),
      mudo: r ? r.mudo !== false : Boolean(o.audioDeformado || o.mudo),
      velocidad,
      largo,
      cubre: largo ? Math.max(0, (largo - entradaVista) / velocidad) : null,
    });
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
  const sinCortes = !Array.isArray(ed?.brolls);
  const lista = sinCortes ? brollsBase(plan) : ed.brolls.filter((x) => x && Number.isInteger(x.b) && bl[x.b]?.broll?.archivo);
  return lista
    .map((x) => {
      const o = bl[x.b].broll;
      const pieza = piezaDeArchivo(o.archivo);
      const aj = ajusteDeClip(plan, ed, pieza);
      const r = aj.reemplazo;
      const velocidad = aj.velocidad ?? (num(o.velocidad, 1) || 1);
      const largo = r ? r.largo : num(o.largoOriginal) > 0 ? num(o.largoOriginal) : null;
      const desde = Math.max(0, Math.min(dur, num(x.desde)));
      const entrada = dentroDelClip(r && sinCortes ? 0 : num(x.entrada), largo);
      const entradaVista = dentroDelClip(entrada + aj.desliza, largo);
      const fin = Math.min(dur, desde + Math.max(0, num(x.duracion)));
      return {
        id: String(x.id),
        b: x.b,
        desde,
        duracion: fin - desde,
        entrada,
        entradaVista,
        fin,
        archivo: r ? r.archivo : o.archivo,
        pieza,
        reemplazado: Boolean(r),
        mudo: r ? r.mudo !== false : Boolean(o.mudo),
        n: o.n ?? numDe(o.archivo, 'broll'),
        velocidad,
        largo,
        cubre: largo ? Math.max(0, (largo - entradaVista) / velocidad) : null,
      };
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
    lado: Number(ed.subtitulos.lado) || 0,
    porBloque: ed.lugaresSubtitulos && Object.keys(ed.lugaresSubtitulos).length ? ed.lugaresSubtitulos : null,
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
    // (tu video, la velocidad y el deslizar ya vienen en cada parte: archivo, largo, velocidad, entradaVista, mudo)
    const delClip = (x) => ({ archivo: x.archivo, velocidad: x.velocidad, mudo: x.mudo, ...(x.largo ? { largoOriginal: x.largo } : {}), ...(x.reemplazado ? { audioDeformado: false, reemplazo: true } : {}) });
    const bloques = segs.map((s) => {
      const o = plan.bloques[s.b];
      const tipo = partes.get(s.b) > 1 && (o.tipo === 'A' || o.tipo === 'C') ? 'B' : o.tipo;
      return { ...o, tipo, linea: s.cabeza ? o.linea : null, inicio: s.inicio, fin: s.fin, toma: { ...o.toma, ...delClip(s), desde: s.inicio, recorteInicio: s.entradaVista, duracion: s.duracion }, broll: null };
    });
    const ancla = plan.bloques.find((b) => b.toma)?.toma.archivo || segs[segs.length - 1]?.archivo;
    for (const x of brolls) {
      bloques.push({ tipo: 'broll', linea: null, inicio: dur, fin: dur, texto: '', toma: { archivo: ancla, desde: dur }, broll: { ...plan.bloques[x.b].broll, ...delClip(x), desde: x.desde, duracion: x.fin - x.desde, recorteInicio: x.entradaVista } });
    }
    p.bloques = bloques;
    // la animación y el sonido de entrada siguen a su toma (si se borró el comienzo de la toma, se van con él)
    const cabezas = new Map(segs.filter((s) => s.cabeza).map((s) => [plan.bloques[s.b].linea, s]));
    p.transiciones = (plan.transiciones || []).flatMap((tr) => {
      const s = cabezas.get(tr.toma);
      return s ? [{ ...tr, desde: s.inicio }] : [];
    });
  } else if (fam === 'bloques') {
    // sin cortes: cada toma y B-roll con tu video, su velocidad y su deslizar (si los hay), y sin los B-roll quitados
    p.bloques = plan.bloques.map((b) => {
      const toma = b.toma ? clipAjustado(b.toma, ajusteDeClip(plan, ed, piezaDeArchivo(b.toma.archivo))) : b.toma;
      let broll = b.broll;
      if (broll) {
        const nb = broll.n ?? numDe(broll.archivo, 'broll');
        broll = quitados.has(`b${nb}`) ? null : clipAjustado(broll, ajusteDeClip(plan, ed, piezaDeArchivo(broll.archivo)));
      }
      return toma === b.toma && broll === b.broll ? b : { ...b, toma, broll };
    });
  }
  if (fam === 'continuidad' && plan.continuidad?.clips) {
    // tu video en lugar de un paso o de una escena: va a su velocidad (1 si no la cambiaste), desde su comienzo (o
    // donde lo deslizaste), y si no alcanza su ventana se queda quieto al final
    let cambio = false;
    const clips = plan.continuidad.clips.map((c) => {
      const aj = ajusteDeClip(plan, ed, piezaDeArchivo(c.archivo));
      if (!aj.reemplazo) return c;
      cambio = true;
      return { ...clipAjustado(c, aj, { base: 0 }), frames: null, fps: null, velocidadFija: aj.velocidad ?? 1 };
    });
    if (cambio) p.continuidad = { ...plan.continuidad, clips };
  }
  if (fam === 'escena') {
    // las imágenes de apoyo de podcast y entrevista: tu video, velocidad y deslizar (los clips hablados no: la voz)
    let cambio = false;
    const piezas = (p.escena || plan.escena).piezas.map((x) => {
      if (x.tipo !== 'clip' || !/^broll-/.test(piezaDeArchivo(x.archivo) || '')) return x;
      const y = clipAjustado(x, ajusteDeClip(plan, ed, piezaDeArchivo(x.archivo)));
      if (y !== x) cambio = true;
      return y;
    });
    if (cambio) p.escena = { ...(p.escena || plan.escena), piezas };
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
/** Las imágenes que sube el usuario en el editor (rutas dentro de la carpeta del anuncio). */
export const ARCHIVO_IMAGEN = /^app\/edicion\/imagenes\/img-[a-z0-9]{2,40}\.(png|jpe?g|webp|gif)$/i;
/** Dónde va una imagen nueva: su centro, en la mitad a lo ancho y un poco arriba de la mitad; y su ancho. */
export const LUGAR_IMAGEN = { x: 0.5, y: 0.42, ancho: 0.5 };

/** Dónde va un texto si no se movió: centrado, con su borde de arriba al 17 % del alto. */
export const LUGAR_TEXTO = { x: 0.5, y: 0.17 };

/**
 * Todos los textos en pantalla con su aspecto ya resuelto: los sugeridos (con lo que el usuario les cambió) y
 * los que agregó él. [{ id, tipo: 'sugerido'|'propio', inicio, fin, texto, visible, editado, estilo }]
 *   estilo = { color, fondo (null = sin fondo), tamano, x, y, fuente, giro }
 * Sin cambios, los sugeridos que se ven alternan el color del anuncio y el blanco (como siempre).
 */
// ---------------------------------------------------------------- seguimiento (rutas/seguimiento.js)

/**
 * Un texto o una imagen tuya que sigue a un texto del video:
 *   sigue = { texto, siempre, pistas: [[[t, x, y, w, h], ...], ...] }
 * Una pista por cada aparición de ese texto (t en segundos del video; x, y el centro y w, h el tamaño de lo que sigue,
 * en fracción del cuadro). Si el texto sale dos veces a la vez, va una copia encima de cada una. (Lo guardado antes con
 * `puntos`, una sola lista, vale como una pista.) -> lo que se usa o null.
 */
export function limpiarSigue(x, cortes = null) {
  if (!x || typeof x !== 'object') return null;
  const limpia = (lista) =>
    (Array.isArray(lista) ? lista : [])
      .filter((p) => Array.isArray(p) && p.length >= 5 && p.slice(0, 5).every((n) => Number.isFinite(Number(n))))
      .map((p) => p.slice(0, 5).map(Number))
      .sort((a, b) => a[0] - b[0])
      .slice(0, 5000);
  // lo guardado antes (una sola lista, `puntos`) mezclaba apariciones en lugares distintos: se separa donde salta
  // (y una pista que salta de lugar, como las del lector de antes, también se parte: nunca se cruza la pantalla)
  const pistas = (Array.isArray(x.pistas) ? x.pistas.flatMap((l) => separarSaltos(limpia(l))) : Array.isArray(x.puntos) ? separarSaltos(limpia(x.puntos)) : []).filter((l) => l.length).slice(0, 80);
  if (!pistas.length) return null;
  return { texto: String(x.texto || '').slice(0, 120), siempre: x.siempre === true, pistas, cortes: Array.isArray(cortes) ? cortes : [] };
}

/** Una lista de lecturas ordenada por tiempo, partida donde el texto salta de lugar o deja de verse un rato. */
function separarSaltos(ps) {
  const salida = [];
  let actual = [];
  for (const p of ps) {
    const u = actual[actual.length - 1];
    const pasado = u ? p[0] - u[0] : 0;
    if (u && (pasado > HUECO_SIGUE || Math.abs(p[1] - u[1]) > Math.max(0.1, 1.2 * u[3]) + 0.06 * pasado || Math.abs(p[2] - u[2]) > Math.max(0.05, 2.5 * u[4]) + 0.04 * pasado)) {
      salida.push(actual);
      actual = [];
    }
    actual.push(p);
  }
  if (actual.length) salida.push(actual);
  return salida;
}

const HUECO_SIGUE = 1.6; // segundos sin verlo y se une con una línea (más que eso: salta)
// El lector no ve el texto en el primer instante (sobre todo si se mueve rápido): tu elemento entra un poco antes de la
// primera lectura y se va un poco después de la última, así no se alcanza a ver lo de abajo.
// (nunca a través de un corte de escena: en la otra escena ese texto no está)
const ANTES_SIGUE = 0.4;
const DESPUES_SIGUE = 0.5;
const hayCorte = (cortes, a, b) => (cortes || []).some((c) => c > a + 0.02 && c <= b + 0.02);

const como = (p) => ({ x: p[1], y: p[2], w: p[3], h: p[4] });

/** Dónde está una pista en el segundo t (o null si no está cerca de ese momento). */
function lugarEnPista(ps, t, cortes) {
  if (t < ps[0][0] - ANTES_SIGUE || t > ps[ps.length - 1][0] + DESPUES_SIGUE) return null;
  if (t < ps[0][0] && hayCorte(cortes, t, ps[0][0])) return null;
  if (t > ps[ps.length - 1][0] && hayCorte(cortes, ps[ps.length - 1][0], t)) return null;
  let k = 0;
  let lo = 0;
  let hi = ps.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (ps[m][0] <= t) {
      k = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  const a = ps[k];
  const b = ps[k + 1];
  if (t < ps[0][0]) return como(ps[0]);
  if (!b) return como(a);
  if (b[0] - a[0] <= HUECO_SIGUE) {
    const f = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
    return { x: a[1] + (b[1] - a[1]) * f, y: a[2] + (b[2] - a[2]) * f, w: a[3] + (b[3] - a[3]) * f, h: a[4] + (b[4] - a[4]) * f };
  }
  if (t - a[0] <= DESPUES_SIGUE && !hayCorte(cortes, a[0], t)) return como(a);
  if (b[0] - t <= ANTES_SIGUE && !hayCorte(cortes, t, b[0])) return como(b);
  return null;
}

/**
 * Dónde va en el segundo t: una posición { x, y, w, h } por cada aparición que está en pantalla. Con «siempre», si no
 * hay ninguna, una sola donde se vio por última vez (o donde se verá primero).
 */
export function lugaresSeguidos(sigue, t) {
  const pistas = sigue?.pistas || [];
  const ahora = pistas.map((ps) => lugarEnPista(ps, t, sigue.cortes)).filter(Boolean);
  if (ahora.length || !sigue?.siempre) return ahora;
  let antes = null;
  let despues = null;
  for (const ps of pistas) {
    for (const p of ps) {
      if (p[0] <= t && (!antes || p[0] > antes[0])) antes = p;
      if (p[0] > t && (!despues || p[0] < despues[0])) despues = p;
    }
  }
  const p = antes || despues;
  return p ? [como(p)] : [];
}

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
  // dónde empieza cada escena (el seguimiento no entra ni sale a través de un corte)
  const cortesDeEscena = (plan?.bloques || []).map((b) => num(b.toma?.desde ?? b.inicio)).filter((t) => t > 0);
  const propios = (ed?.textosNuevos || []).map((a, j) => ({
    id: String(a.id),
    tipo: 'propio',
    // una imagen: su archivo y, en el estilo, su centro (x, y de 0 a 1) y su ancho (fracción del ancho del video)
    ...(a.archivo
      ? {
          archivo: String(a.archivo),
          imagenEstilo: {
            x: Math.max(0, Math.min(1, num(a.x ?? LUGAR_IMAGEN.x, LUGAR_IMAGEN.x))),
            y: Math.max(0, Math.min(1, num(a.y ?? LUGAR_IMAGEN.y, LUGAR_IMAGEN.y))),
            ancho: Math.max(0.08, Math.min(1.2, num(a.ancho ?? LUGAR_IMAGEN.ancho, LUGAR_IMAGEN.ancho))),
          },
        }
      : {}),
    ...tiempo(a, { inicio: 0, fin: Math.min(dur, 2.5) }),
    texto: String(a.texto ?? '') || (a.archivo ? 'Imagen' : ''),
    visible: true,
    editado: true,
    estilo: estilo(a, { color: '#FFFFFF', fondo: color, giro: j % 2 ? 2 : -2 }),
    sigue: limpiarSigue(a.sigue, cortesDeEscena),
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

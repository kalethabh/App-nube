// La exportación por tramos del editor: solo se vuelve a armar lo que cambió.
//
// produccion/exportar-edicion.js divide el video en tramos de ~4 s (120 cuadros, siempre en los mismos cuadros: 0,
// 120, 240…) y arma la imagen de cada uno por separado (renderMedia con frameRange, sin sonido). Cada tramo queda
// guardado en temp/<slug>/app/exportes/.tramos/<calidad>/<huella>.mp4. El sonido va aparte, en una pasada «solo
// sonido» de la misma composición (remotion/src/edicion/soloSonido.jsx), también guardado por su huella. Al final se
// juntan los tramos SIN volver a codificarlos (ffmpeg concat, copia directa) y se les pone el sonido.
//
// LA HUELLA de un tramo es todo lo que puede cambiar SUS cuadros, y nada más:
//   - lo general (si cambia, cambian todos): el código de remotion/src, la versión de la app y la de Remotion, la
//     calidad, el codificador y sus ajustes, el estilo de los subtítulos, el color, la parte del plan que no va por
//     tiempos y cualquier campo de la edición que esta cuenta no conozca (un campo nuevo, por las dudas, cambia todo);
//   - lo que cae dentro del tramo (o lo toca): cada toma y B-roll con su ventana en cuadros, su archivo, velocidad,
//     recorte, encuadre, color, congelado y transición; cada texto, imagen o tapa con sus tiempos, lugar y
//     seguimiento; cada bloque de subtítulos; el fundido a negro del comienzo y del final;
//   - el tamaño y la fecha de cada archivo que lee lo de arriba.
// Lo que solo suena (la voz, la música, el volumen de cada clip, las censuras, tus audios, los pitidos) NO entra:
// va en la huella del sonido. Así, silenciar una palabra no vuelve a armar ningún cuadro.
//
// Todo lo de este archivo es cálculo puro (se prueba con app/herramientas/probar-exportar-tramos.mjs) más las
// ayudas de disco (el tamaño máximo de lo guardado).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** Cuadros por tramo (4 s a 30 cuadros por segundo). */
export const CUADROS_POR_TRAMO = 120;
/** Cambia este número si cambia la forma de armar o de medir los tramos: invalida todo lo guardado. */
export const VERSION_TRAMOS = 1;
/** Margen (en cuadros) alrededor de lo que va por segundos (textos, subtítulos): la cuenta es exacta, así que 0. */
const MARGEN = 0;

// Lo que en las capas (capasDeEdicion) solo suena: no cambia ningún cuadro.
const CAPAS_SONIDO = new Set(['voz', 'audios', 'pitidos', 'musica']);
// Lo que en las capas va por tiempos (y se reparte por tramos) o se trata aparte.
const CAPAS_CONOCIDAS = new Set(['plan', 'subtitulos', 'textos', 'fundido', 'color', ...CAPAS_SONIDO]);
// Lo del plan que solo suena (en cualquier lugar del plan): el volumen de cada clip, mudo, el audio deformado.
const CLAVES_SONIDO = new Set(['volumenClip', 'volumenDb', 'mudo', 'audioDeformado']);

export const sha1 = (x) => crypto.createHash('sha1').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');

/** Los tramos: [{ i, desde, hasta }] en cuadros (hasta sin incluir). Un resto de menos de 1 s se suma al último. */
export function cortesDeTramos(total, largo = CUADROS_POR_TRAMO) {
  const tramos = [];
  for (let desde = 0; desde < total; desde += largo) tramos.push({ i: tramos.length, desde, hasta: Math.min(total, desde + largo) });
  if (tramos.length > 1 && tramos[tramos.length - 1].hasta - tramos[tramos.length - 1].desde < 30) {
    const ultimo = tramos.pop();
    tramos[tramos.length - 1].hasta = ultimo.hasta;
  }
  return tramos;
}

/** Una copia sin lo que solo suena (en cualquier nivel). */
function sinSonido(valor) {
  if (Array.isArray(valor)) return valor.map(sinSonido);
  if (!valor || typeof valor !== 'object') return valor;
  const salida = {};
  for (const [k, v] of Object.entries(valor)) if (!CLAVES_SONIDO.has(k)) salida[k] = sinSonido(v);
  return salida;
}

const sinClaves = (obj, claves) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !claves.includes(k)));
const num = (x, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d);

/**
 * Las piezas de video del plan con su ventana en cuadros, con LA MISMA cuenta de remotion/src/Anuncio.jsx
 * (piezasDeBloques y piezasDeContinuidad), en el orden en que se dibujan (el de más abajo primero).
 */
function piezasDelPlan(plan, fps, total) {
  if (plan?.continuidad?.clips) {
    const clips = plan.continuidad.clips;
    const inicios = clips.map((c) => Math.round(num(c.desde) * fps));
    if (inicios.length) inicios[0] = 0;
    return clips.map((c, i) => {
      const desde = inicios[i];
      const hasta = i + 1 < inicios.length ? inicios[i + 1] : total;
      return { desde, hasta: desde + Math.max(1, hasta - desde), dato: { tipo: 'paso', clip: c } };
    });
  }
  const bloques = Array.isArray(plan?.bloques) ? plan.bloques : [];
  const inicios = bloques.map((b) => Math.round(num(b.toma?.desde) * fps));
  if (inicios.length) inicios[0] = 0;
  const piezas = [];
  bloques.forEach((b, i) => {
    const desde = inicios[i];
    const hasta = i + 1 < inicios.length ? inicios[i + 1] : total;
    const transicion = (plan.transiciones || []).find((t) => t.toma === b.linea) || null;
    piezas.push({ desde, hasta: desde + Math.max(1, hasta - desde), dato: { tipo: 'toma', bloque: b.tipo, toma: b.toma, transicion } });
    if (b.broll) {
      const bDesde = Math.round(num(b.broll.desde) * fps);
      const largo = Math.max(1, Math.min(Math.round(num(b.broll.duracion) * fps), total - bDesde));
      piezas.push({ desde: bDesde, hasta: bDesde + largo, dato: { tipo: 'broll', broll: b.broll } });
    }
  });
  return piezas;
}

/**
 * Los cuadros donde se dibuja algo que se ve de `inicio` a `fin` (segundos): los f con inicio <= f / fps < fin, con
 * LA MISMA cuenta que hacen las capas (t = cuadro / fps), así un texto de 10 a 12 s no toca el tramo que empieza en 12.
 */
export function cuadrosEntre(inicio, fin, fps) {
  const a = num(inicio);
  const z = num(fin);
  let desde = Math.max(0, Math.floor(a * fps) - 1);
  while (desde / fps < a) desde++;
  let hasta = Math.max(desde, Math.ceil(z * fps) + 1);
  while (hasta > desde && !((hasta - 1) / fps < z)) hasta--;
  return { desde, hasta };
}
const ventana = (inicio, fin, fps) => {
  const v = cuadrosEntre(inicio, fin, fps);
  return { desde: v.desde - MARGEN, hasta: v.hasta + MARGEN };
};

/**
 * Lo que se ve, separado en lo general y lo que va por tiempos.
 *   capas    capasDeEdicion(plan, edicion, contexto) (lo que dibuja AnuncioEditado)
 *   estado   la edición que se exporta (para los campos que esta cuenta no conoce)
 *   inicial  INICIAL de capas.mjs (los campos conocidos de la edición)
 * Devuelve { general, items: [{ desde, hasta, dato }] } (cuadros, hasta sin incluir).
 */
export function partesVisibles({ capas, estado, inicial, fps, total }) {
  const items = [];
  const general = {};
  // los campos de la edición que esta cuenta no conoce: por las dudas, cambian todos los tramos
  const desconocidos = Object.keys(estado || {}).filter((k) => !Object.prototype.hasOwnProperty.call(inicial || {}, k)).sort();
  general.edicionDesconocida = Object.fromEntries(desconocidos.map((k) => [k, estado[k]]));
  // las capas que esta cuenta no conoce, también
  general.capasDesconocidas = Object.fromEntries(Object.keys(capas || {}).filter((k) => !CAPAS_CONOCIDAS.has(k)).sort().map((k) => [k, capas[k]]));
  general.color = capas?.color ?? null;

  // el plan: lo que va por tiempos (tomas, B-roll, pasos) y el resto
  const plan = capas?.plan || {};
  const visible = sinClaves(sinSonido(plan), ['audio', 'musica', 'subtitulos']);
  if (plan.escena?.piezas) {
    // podcast y entrevista (Escena.jsx): todo el plan es general
    general.plan = visible;
    general.total = total;
  } else {
    general.plan = plan.continuidad?.clips
      ? { ...sinClaves(visible, ['duracion', 'continuidad']), continuidad: sinClaves(visible.continuidad, ['clips']) }
      : sinClaves(visible, ['duracion', 'bloques', 'transiciones']);
    for (const p of piezasDelPlan(visible, fps, total)) items.push({ ...p, dato: { capa: 'video', ventana: [p.desde, p.hasta], ...p.dato } });
  }

  // los subtítulos: el estilo es general; cada bloque, en su tiempo
  const s = capas?.subtitulos;
  if (s) {
    general.subtitulos = sinClaves(s, ['bloques', 'porBloque', 'marcas']);
    (s.bloques || []).forEach((b, i) => {
      const id = b.id ?? i;
      items.push({ ...ventana(b.inicio, b.fin, fps), dato: { capa: 'subtitulo', b, lugar: s.porBloque?.[id] ?? null, marca: s.marcas?.[id] ?? null } });
    });
  } else general.subtitulos = null;

  // los textos, imágenes y tapas: cada uno en su tiempo (con su seguimiento, lugar y estilo)
  for (const x of capas?.textos || []) items.push({ ...ventana(x.inicio, x.fin, fps), dato: { capa: 'texto', x } });

  // el fundido a negro: el del comienzo y el del final
  const f = capas?.fundido;
  // (FundidoNegro: se ve mientras t < entrada y mientras total - t < salida; un cuadro de más a cada lado, por las dudas)
  if (f?.entrada > 0) items.push({ desde: 0, hasta: cuadrosEntre(0, f.entrada, fps).hasta + 1, dato: { capa: 'fundido-entrada', entrada: f.entrada } });
  if (f?.salida > 0) items.push({ desde: Math.floor(total - f.salida * fps) - 1, hasta: total, dato: { capa: 'fundido-salida', salida: f.salida, total } });
  return { general, items };
}

/** Las rutas de archivo que nombra un valor (cualquier texto con extensión). */
function rutasEn(valor, salida = new Set()) {
  if (typeof valor === 'string') {
    if (valor.length <= 300 && /\.[a-z0-9]{2,5}$/i.test(valor)) salida.add(valor);
  } else if (Array.isArray(valor)) for (const v of valor) rutasEn(v, salida);
  else if (valor && typeof valor === 'object') for (const v of Object.values(valor)) rutasEn(v, salida);
  return salida;
}

/**
 * La huella de cada tramo: [{ i, desde, hasta, huella }].
 *   base          lo que cambia todo (código, versión, calidad, codificador…)
 *   firmaArchivo  (ruta) => [tamaño, fecha] o null: el archivo que lee el render (se prueba la ruta y video/<ruta>)
 */
export function huellasDeTramos({ capas, estado, inicial, fps, total, base, firmaArchivo = () => null, largo = CUADROS_POR_TRAMO }) {
  const { general, items } = partesVisibles({ capas, estado, inicial, fps, total });
  const firmas = (valor) => [...rutasEn(valor)].sort().map((r) => [r, firmaArchivo(r) ?? firmaArchivo(`video/${r}`)]).filter(([, f]) => f);
  const huellaGeneral = sha1({ v: VERSION_TRAMOS, base, general, archivos: firmas(general) });
  return cortesDeTramos(total, largo).map((t) => {
    const dentro = items.filter((x) => x.desde < t.hasta && x.hasta > t.desde).map((x) => x.dato);
    return { ...t, huella: sha1({ g: huellaGeneral, desde: t.desde, hasta: t.hasta, dentro, archivos: firmas(dentro) }) };
  });
}

/**
 * La huella del sonido: todo lo que suena (la voz, la música, tus audios, los pitidos, el plan entero, porque los
 * clips suenan) y los archivos que se leen. No entran los textos, los subtítulos, el color ni el fundido (no suenan).
 */
export function huellaDeSonido({ capas, estado, inicial, total, base, archivos = [] }) {
  const desconocidos = Object.keys(estado || {}).filter((k) => !Object.prototype.hasOwnProperty.call(inicial || {}, k)).sort();
  const sonido = Object.fromEntries(Object.entries(capas || {}).filter(([k]) => !['subtitulos', 'textos', 'color', 'fundido'].includes(k)));
  return sha1({ v: VERSION_TRAMOS, base, total, sonido, desconocidos: Object.fromEntries(desconocidos.map((k) => [k, estado[k]])), archivos });
}

// ---------------------------------------------------------------- el código (si cambia, nada de lo guardado sirve)

/** La huella de los archivos de remotion/src (contenido) más lo que se pase en `extra`. */
export function huellaDelCodigo(dirSrc, extra = {}) {
  const h = crypto.createHash('sha1');
  const visitar = (dir) => {
    for (const n of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dir, n.name);
      if (n.isDirectory()) visitar(abs);
      else if (n.isFile()) {
        h.update(path.relative(dirSrc, abs));
        h.update(fs.readFileSync(abs));
      }
    }
  };
  visitar(dirSrc);
  h.update(JSON.stringify(extra));
  return h.digest('hex');
}

// ---------------------------------------------------------------- lo guardado: que no crezca sin fin

/**
 * Borra lo más viejo (por la fecha de último uso) de la carpeta de tramos de una calidad, salvo lo de `enUso`:
 * deja como mucho `maxArchivos` tramos y `maxBytes` en total. Con cada tramo se va su medición (.json).
 */
export function podarCache(dir, { enUso = new Set(), maxArchivos = 60, maxBytes = 400 * 1024 * 1024 } = {}) {
  let lista;
  try {
    lista = fs.readdirSync(dir).filter((n) => /\.(mp4|wav|aac)$/.test(n));
  } catch {
    return { borrados: 0 };
  }
  const datos = lista
    .map((n) => {
      try {
        const st = fs.statSync(path.join(dir, n));
        return { n, bytes: st.size, t: st.mtimeMs };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    // (lo que usa este video primero: siempre queda y cuenta para el tope; después lo más reciente)
    .sort((a, b) => Number(enUso.has(b.n)) - Number(enUso.has(a.n)) || b.t - a.t);
  let cuenta = 0;
  let bytes = 0;
  let borrados = 0;
  for (const d of datos) {
    const usado = enUso.has(d.n);
    if (usado || (cuenta < maxArchivos && bytes + d.bytes <= maxBytes)) {
      cuenta++;
      bytes += d.bytes;
      continue;
    }
    for (const x of [d.n, d.n.replace(/\.(mp4|wav|aac)$/, '.json')]) {
      try {
        fs.rmSync(path.join(dir, x), { force: true });
      } catch {
        // abierto: la próxima vez
      }
    }
    borrados++;
  }
  // las mediciones sueltas (de uniones con tramos que ya no están) también
  try {
    const hay = new Set(fs.readdirSync(dir));
    for (const n of hay) {
      const m = n.match(/^union-([0-9a-f]{40})-([0-9a-f]{40})\.json$/);
      if (m && !(hay.has(`${m[1]}.mp4`) && hay.has(`${m[2]}.mp4`))) fs.rmSync(path.join(dir, n), { force: true });
    }
  } catch {
    // nada
  }
  return { borrados };
}

/** Marca un archivo como recién usado (para podarCache). */
export function tocar(ruta) {
  try {
    const ahora = new Date();
    fs.utimesSync(ruta, ahora, ahora);
  } catch {
    // no importa
  }
}

// ---------------------------------------------------------------- el control por partes

/**
 * Junta tramos de imagen quieta que se tocan (o se pisan): los medidos por tramo, los de cada unión y los guardados.
 * [{ desde, hasta }] en segundos del video, ordenados.
 */
export function juntarCongelados(tramos, fps) {
  const lista = tramos.filter((x) => Number.isFinite(x.desde) && Number.isFinite(x.hasta)).sort((a, b) => a.desde - b.desde);
  const salida = [];
  for (const x of lista) {
    const ult = salida[salida.length - 1];
    if (ult && x.desde <= ult.hasta + 1.5 / fps) ult.hasta = Math.max(ult.hasta, x.hasta);
    else salida.push({ desde: x.desde, hasta: x.hasta });
  }
  return salida;
}

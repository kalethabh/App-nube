// Los anuncios reales: se leen de temp/<slug>/ y de output/. SOLO LECTURA.
//
// Nada de aca devuelve prompts, claves ni el manifiesto crudo: solo lo que la
// interfaz necesita mostrar, ya en palabras de la app.
import fs from 'node:fs';
import path from 'node:path';
import { APP, TEMP, OUTPUT, DOLARES_POR_CREDITO } from './rutas.js';
import { leerJSON, existe, stat, listar, segmentoValido, esImagen, esVideo } from './archivos.js';
import { duracionMp4 } from './mp4.js';
import { estiloDeManifiesto, FAMILIAS, muestrasDeEstilos } from './estilos.js';
import { brollDe } from './broll.js';

// ---------------------------------------------------------------- que carpetas son anuncios

// Carpetas de trabajo del motor, pruebas y referencias: nunca se muestran.
const IGNORADAS = /^(_|prueba|referencia)/i;
const PRUEBA_EN_EL_NOMBRE = /(^|-)prueba(-|$)/i; // p. ej. <slug>-prueba-motor

// Anuncios que Diego no quiere ver en la app (server/ocultos.json): la carpeta queda en temp/, solo no se muestra
// en ningun lado (listas, entrega, muestras de Estilos). Se relee solo cuando cambia el archivo.
const ARCHIVO_OCULTOS = path.join(APP, 'server', 'ocultos.json');
let ocultos = { mtime: -1, slugs: new Set() };
function slugsOcultos() {
  const mtime = stat(ARCHIVO_OCULTOS)?.mtimeMs ?? 0;
  if (mtime !== ocultos.mtime) {
    const lista = leerJSON(ARCHIVO_OCULTOS)?.ocultos;
    ocultos = { mtime, slugs: new Set(Array.isArray(lista) ? lista.map((s) => String(s).toLowerCase()) : []) };
  }
  return ocultos.slugs;
}

export function carpetaIgnorada(nombre) {
  return IGNORADAS.test(nombre) || PRUEBA_EN_EL_NOMBRE.test(nombre) || slugsOcultos().has(String(nombre).toLowerCase());
}

/** true si `slug` es un anuncio que la app puede mostrar. */
export function slugValido(slug) {
  return (
    segmentoValido(slug) &&
    /^[a-z0-9][a-z0-9._-]*$/i.test(slug) &&
    !carpetaIgnorada(slug) &&
    existe(path.join(TEMP, slug, 'manifiesto.json'))
  );
}

export function slugsDeAnuncios() {
  return listar(TEMP)
    .filter((n) => !carpetaIgnorada(n) && /^[a-z0-9][a-z0-9._-]*$/i.test(n))
    .filter((n) => stat(path.join(TEMP, n))?.isDirectory() && existe(path.join(TEMP, n, 'manifiesto.json')))
    .filter((n) => !esVersionDeGancho(n));
}

/**
 * La version de un UGC con otro gancho (variante-gancho.js -> temp/<slug>-gancho-<id>/, con su marca
 * variante-gancho.json): es parte del anuncio original, no un anuncio aparte. Sus MP4 se ven en la entrega del
 * original (informe.versionesGanchos).
 */
export const esVersionDeGancho = (slug) => existe(path.join(TEMP, slug, 'variante-gancho.json'));

/**
 * Las versiones con otro gancho de un UGC que hizo la app (app/informe.json, versionesGanchos): sus MP4 van en la
 * entrega del original, despues de los suyos ("Gancho B · Completa"). Solo las carpetas que armo variante-gancho.js.
 */
function versionesDeGanchos(slug) {
  const g = leerJSON(path.join(TEMP, slug, 'app', 'informe.json'))?.versionesGanchos;
  if (!Array.isArray(g) || !g.length) return [];
  const archivos = listar(OUTPUT);
  const fuera = [];
  for (const x of g) {
    const otro = typeof x?.slug === 'string' ? x.slug : null;
    if (!otro || !otro.startsWith(`${slug}-gancho-`) || !segmentoValido(otro) || !esVersionDeGancho(otro)) continue;
    const letra = x.letra || String(x.id || '').replace(/^\d+/, '').toUpperCase() || '';
    for (const v of versionesDe(otro, archivos)) {
      fuera.push({
        ...v,
        tipo: `gancho-${x.id}-${v.tipo}`,
        nombre: `Gancho ${letra} · ${v.nombre}`,
        descripcion: x.angulo ? `Otro arranque: ${x.angulo}` : 'El mismo anuncio con otro arranque',
        principal: false,
        gancho: String(x.id),
      });
    }
  }
  return fuera;
}

/**
 * Los que se ven mejor para mostrar la app (los demas tambien aparecen): los que Diego eligio como muestra de cada
 * estilo en server/muestras-estilos.json. En la PC del alumno ese archivo no viaja y ninguno es destacado.
 */
export const esDestacado = (slug) => Object.values(muestrasDeEstilos()).includes(slug);

// ---------------------------------------------------------------- urls

const enc = (s) => s.split('/').map(encodeURIComponent).join('/');
export const urlAnuncio = (slug, rel) => `/archivos/anuncio/${encodeURIComponent(slug)}/${enc(rel)}`;
export const urlSalida = (archivo) => `/archivos/salida/${encodeURIComponent(archivo)}`;

// ---------------------------------------------------------------- titulo legible

const PALABRAS = {
  ia: 'IA',
  ugc: 'UGC',
  ai: 'AI',
  triptofano: 'Triptófano',
  linfatico: 'Linfático',
  linfatica: 'Linfática',
  pimienta: 'Pimienta',
  musica: 'Música',
  cancion: 'Canción',
  dias: 'Días',
};
const MENORES = new Set(['con', 'de', 'del', 'la', 'el', 'los', 'las', 'y', 'a', 'en', 'para', 'por', 'sin', 'al']);

export function tituloDeSlug(slug) {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w, i, arr) => {
      const l = w.toLowerCase();
      if (PALABRAS[l]) return PALABRAS[l];
      if (/^v\d+$/.test(l) || /^\d+[a-z]?$/.test(l)) return l;
      if (l.length === 1 && i === arr.length - 1) return l.toUpperCase(); // variante: "... Entrevista A"
      if (i > 0 && MENORES.has(l)) return l;
      if (l.length === 1) return l.toUpperCase();
      return l[0].toUpperCase() + l.slice(1);
    })
    .join(' ');
}

// "# Befen — Regulador de Apetito · anuncio claymation" -> "Befen · Regulador de Apetito".
// Solo se usa si quedan al menos marca y producto; si no, el slug dice mas.
function tituloDeEntrega(dir) {
  for (const n of ['anuncio-completo.md', 'entrega.md']) {
    let primera = '';
    try {
      primera = fs.readFileSync(path.join(dir, n), 'utf8').slice(0, 400).split('\n')[0].trim();
    } catch {
      continue;
    }
    const h1 = primera.match(/^#\s+(.+)$/);
    if (!h1) continue;
    const partes = [];
    for (const p of h1[1].split(/\s+[—·:|]\s+/)) {
      if (/^(anuncio|entrevista|variante|skeleton|estilo)\b/i.test(p.trim())) break;
      partes.push(p.trim());
    }
    if (partes.length >= 2) return partes.join(' · ');
  }
  return null;
}

function tituloDe(slug, m, dir) {
  const delManifiesto = m?.producto?.nombre || m?.nombre || m?.titulo || m?.producto_nombre;
  if (typeof delManifiesto === 'string' && delManifiesto.trim()) return delManifiesto.trim();
  return tituloDeEntrega(dir) || tituloDeSlug(slug);
}

// ---------------------------------------------------------------- archivos de un anuncio

const IMG_EXT = ['.png', '.jpg', '.jpeg', '.webp'];

/** Busca img/<base>.(png|jpg|...) y devuelve el nombre del archivo o null. */
function buscarImagen(archivosImg, base) {
  for (const ext of IMG_EXT) if (archivosImg.has(base + ext)) return base + ext;
  return null;
}
function buscarVideo(archivosVideo, base) {
  return archivosVideo.has(base + '.mp4') ? base + '.mp4' : null;
}

function leerCarpeta(slug) {
  const dir = path.join(TEMP, slug);
  const img = listar(path.join(dir, 'img')).filter(esImagen);
  const video = listar(path.join(dir, 'video')).filter(esVideo);
  return { dir, raiz: listar(dir), img, video, imgSet: new Set(img), videoSet: new Set(video) };
}

const numDe = (n) => Number((n.match(/\d+/) || [0])[0]);

function miniaturaDe(slug, m, c) {
  const porToma = (m.tomas || [])
    .map((t) => buscarImagen(c.imgSet, `toma-${t.n}-inicial`) || (t.frame_inicial && buscarImagen(c.imgSet, t.frame_inicial)))
    .find(Boolean);
  const hoja = ['personaje', 'persona', 'host-a'].map((b) => buscarImagen(c.imgSet, b)).find(Boolean);
  const cualquiera = c.img.filter((n) => !n.startsWith('icono-')).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))[0];
  const elegida = porToma || hoja || cualquiera;
  if (elegida) return urlAnuncio(slug, `img/${elegida}`);
  // Lo pesado ya esta en Google Drive (lib/guardado.js): la portada chica que quedo.
  if (c.raiz.includes('portada.jpg')) return urlAnuncio(slug, 'portada.jpg');
  // Sin imagenes generadas todavia: la foto del producto (o cualquier foto de la carpeta).
  const producto = c.raiz.find((n) => /^producto\.(png|jpe?g|webp)$/i.test(n)) || c.raiz.find((n) => esImagen(n));
  return producto ? urlAnuncio(slug, producto) : null;
}

// ---------------------------------------------------------------- versiones en output/

export const TIPOS_VERSION = {
  'con-subtitulos': { nombre: 'Completa', descripcion: 'Con subtítulos y música', orden: 0, principal: true },
  'solo-subtitulos': { nombre: 'Solo subtítulos', descripcion: 'Con subtítulos, sin música', orden: 1 },
  'sin-subtitulos': { nombre: 'Sin subtítulos', descripcion: 'Para poner tus propios textos en CapCut', orden: 2 },
  'sin-subtitulos-sin-musica': { nombre: 'Sin subtítulos ni música', descripcion: 'Limpia, para editar en CapCut', orden: 3 },
};

const escaparRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Las versiones que se sacan desde Exportar en el editor (rutas/editor.js, VERSIONES_EXPORTAR): la entrega trae
// solo la completa y las demas salen de ahi como <slug>_editado-N.mp4. Lo que lleva cada una sale de su pedido.
const VERSION_DEL_EDITOR = { completa: 'Con tus cambios', 'sin-subtitulos': 'Sin subtítulos', 'sin-musica': 'Sin música', limpia: 'Sin subtítulos ni música' };

/** "Sin subtítulos · 1080p" (o "Exportada desde el editor" si no quedo su pedido). */
function descripcionDeEdicion(slug, n) {
  const p = leerJSON(path.join(TEMP, slug, 'app', 'exportes', `pedido-${n}.json`));
  if (!p) return 'Exportada desde el editor';
  const que = VERSION_DEL_EDITOR[p.version] || (p.subtitulos === 'sin' ? 'Sin subtítulos' : 'Con tus cambios');
  return p.calidad ? `${que} · ${p.calidad}p` : que;
}

function versionesDe(slug, archivosOutput) {
  const re = new RegExp(`^${escaparRe(slug)}_(?:(\\d+x\\d+)_)?(.+)\\.(mp4|srt)$`, 'i');
  const versiones = [];
  for (const archivo of archivosOutput) {
    const r = archivo.match(re);
    if (!r) continue;
    const [, formato, tipoCrudo, ext] = r;
    const st = stat(path.join(OUTPUT, archivo));
    if (!st?.isFile()) continue;
    // (las del editor se llaman <slug>_editado-N; "edit-N" es como se llamaban antes)
    const edicion = tipoCrudo.match(/^edit(?:ado)?-(\d+)$/i);
    const conocido = TIPOS_VERSION[tipoCrudo];
    const info = edicion
      ? { nombre: `Edición ${edicion[1]}`, descripcion: descripcionDeEdicion(slug, edicion[1]), orden: 10 + Number(edicion[1]) }
      : conocido || { nombre: tipoCrudo.replace(/-/g, ' '), descripcion: '', orden: 50 };
    const esMp4 = ext.toLowerCase() === 'mp4';
    versiones.push({
      tipo: edicion ? 'edicion' : tipoCrudo,
      nombre: info.nombre,
      descripcion: info.descripcion,
      principal: Boolean(info.principal),
      formato: formato || null,
      clase: esMp4 ? 'video' : 'subtitulos',
      archivo,
      url: urlSalida(archivo),
      tamano: st.size,
      fecha: st.mtime.toISOString(),
      duracion: esMp4 ? duracionMp4(path.join(OUTPUT, archivo)) : null,
      _orden: info.orden + (esMp4 ? 0 : 0.5),
    });
  }
  versiones.sort((a, b) => a._orden - b._orden);
  return versiones.map(({ _orden, ...v }) => v);
}

// ---------------------------------------------------------------- costo real (log-modelos.json)

const redondear = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

// Creditos que se usan para estimar lo que el registro no cubre (Sunburst 2K y Omni de 6 s).
const CREDITOS_IMAGEN = 10;
const CREDITOS_CLIP = 84;

/**
 * El costo segun log-modelos.json de img/ y video/ (suma de "creditos").
 * Ojo: el motor pisa ese registro en cada corrida, asi que a veces cubre solo la ultima
 * tanda. `completo` dice si cubre todas las piezas que hay en disco; si no, `estimado`
 * calcula el total con lo que hay en disco y el promedio del registro.
 */
function costoDe(dir, c) {
  const li = leerJSON(path.join(dir, 'img', 'log-modelos.json'));
  const lv = leerJSON(path.join(dir, 'video', 'log-modelos.json'));
  if (!li && !lv) return null;
  const lista = (x) => (Array.isArray(x) ? x : []);
  const sumar = (l) => l.reduce((s, x) => s + (Number(x?.creditos) || 0), 0);
  const imgs = lista(li?.imagenes);
  const clips = lista(lv?.clips);
  const cImg = sumar(imgs);
  const cVid = sumar(clips);
  const creditos = cImg + cVid;
  const enDiscoImg = c.img.length;
  const enDiscoClips = c.video.length;
  const completo = imgs.length >= enDiscoImg && clips.length >= enDiscoClips;
  const promImg = imgs.length ? cImg / imgs.length : CREDITOS_IMAGEN;
  const promClip = clips.length ? cVid / clips.length : CREDITOS_CLIP;
  const estimadoCreditos = Math.round(Math.max(enDiscoImg, imgs.length) * promImg + Math.max(enDiscoClips, clips.length) * promClip);
  const usd = (cr) => redondear(cr * DOLARES_POR_CREDITO);
  return {
    creditos,
    dolares: usd(creditos),
    imagenes: { piezas: imgs.length, creditos: cImg, dolares: usd(cImg) },
    videos: { piezas: clips.length, creditos: cVid, dolares: usd(cVid) },
    completo,
    estimado: { creditos: estimadoCreditos, dolares: usd(estimadoCreditos) },
    dolaresPorCredito: DOLARES_POR_CREDITO,
  };
}

// ---------------------------------------------------------------- piezas esperadas (para el avance)

/**
 * Las piezas que se generan. El B-roll que no entra en el video con la voz ya hecha no se pide (lib/broll.js): no
 * cuenta, salvo lo que de el ya este en la carpeta (de antes). Sin voz todavia, cuentan todos.
 */
function piezasDe(m, c, regla = brollDe(c.dir, m)) {
  const tomas = Array.isArray(m.tomas) ? m.tomas : [];
  const broll = (Array.isArray(m.broll) ? m.broll : []).filter((b) => b && typeof b === 'object');
  const refs = Array.isArray(m.referencias) ? m.referencias : [];
  const imgTotal =
    tomas.filter((t) => t.prompt_imagen_inicial).length +
    tomas.filter((t) => t.prompt_imagen_final).length +
    broll.filter((b) => b.prompt_imagen && (regla.entra(b.n) || buscarImagen(c.imgSet, `broll-${b.n}`))).length +
    refs.filter((r) => r.prompt).length +
    (m.personaje?.activo ? 1 : 0);
  const pasos = m.continuidad?.pasos?.length || 0;
  const brollClips = broll.filter((b) => regla.entra(b.n) || buscarVideo(c.videoSet, `broll-${b.n}`)).length;
  const clipTotal = pasos ? Math.max(pasos, c.video.length) : tomas.length + brollClips;
  const imgHechas = Math.min(c.img.length, imgTotal || c.img.length);
  const clipHechos = Math.min(c.video.length, clipTotal || c.video.length);
  return {
    imagenes: { hechas: imgHechas, total: Math.max(imgTotal, imgHechas) },
    clips: { hechos: clipHechos, total: Math.max(clipTotal, clipHechos) },
  };
}

// ---------------------------------------------------------------- resumen (lista del tablero)

const cache = new Map(); // slug -> { firma, valor }

function firmaDe(slug) {
  const dir = path.join(TEMP, slug);
  const partes = [
    stat(path.join(dir, 'manifiesto.json'))?.mtimeMs,
    stat(path.join(dir, 'plan-montaje.json'))?.mtimeMs,
    stat(path.join(dir, 'img'))?.mtimeMs,
    stat(path.join(dir, 'video'))?.mtimeMs,
    stat(OUTPUT)?.mtimeMs,
    // con la voz se sabe que B-roll no entran (y no se generan): cambia la cuenta de las piezas
    stat(path.join(dir, 'audio', 'tiempos.json'))?.mtimeMs,
    stat(path.join(dir, 'audio', 'voz.mp3'))?.mtimeMs,
  ];
  return partes.join('|');
}

export function resumenAnuncio(slug, archivosOutput = listar(OUTPUT)) {
  const firma = firmaDe(slug);
  const guardado = cache.get(slug);
  if (guardado && guardado.firma === firma) {
    guardado.valor.destacado = esDestacado(slug); // muestras-estilos.json puede cambiar sin que cambie el anuncio
    return guardado.valor;
  }

  const c = leerCarpeta(slug);
  const m = leerJSON(path.join(c.dir, 'manifiesto.json'));
  if (!m) return null;
  const plan = leerJSON(path.join(c.dir, 'plan-montaje.json'));
  const versiones = versionesDe(slug, archivosOutput);
  const videosListos = versiones.filter((v) => v.clase === 'video');
  const principal = videosListos.find((v) => v.principal) || videosListos[0] || null;
  const estilo = estiloDeManifiesto(m);
  const estado = videosListos.length ? 'listo' : 'en-produccion';
  const piezas = piezasDe(m, c);
  const totalPiezas = piezas.imagenes.total + piezas.clips.total;
  // Sin MP4 nunca llega al 100 %: falta el montaje.
  const avance = estado === 'listo' ? 1 : totalPiezas ? Math.min(0.95, redondear((piezas.imagenes.hechas + piezas.clips.hechos) / totalPiezas, 3)) : 0;
  // En que va (para mostrarlo en palabras): guion -> imagenes -> videos -> montaje -> listo
  const etapa =
    estado === 'listo' ? 'listo' : plan ? 'montaje' : c.video.length ? 'videos' : c.img.length ? 'imagenes' : 'guion';

  const duracionPlan = typeof plan?.duracion === 'number' ? plan.duracion : null;
  const duracionEstimada = (m.tomas || []).reduce((s, t) => s + (Number(t.duracion) || 0), 0) || null;
  const duracion = duracionPlan ?? principal?.duracion ?? duracionEstimada;

  const stManifiesto = stat(path.join(c.dir, 'manifiesto.json'));
  const fechas = [stManifiesto?.mtimeMs || 0, ...videosListos.map((v) => Date.parse(v.fecha))];
  const primerClip = ['toma-1.mp4', 'paso-1.mp4'].find((n) => c.videoSet.has(n)) || c.video.slice().sort((a, b) => numDe(a) - numDe(b))[0];

  const valor = {
    slug,
    titulo: tituloDe(slug, m, c.dir),
    estilo: estilo.clave,
    estiloNombre: estilo.nombre,
    familia: estilo.familia,
    familiaNombre: estilo.familia ? FAMILIAS[estilo.familia]?.nombre || null : null,
    continuidad: estilo.continuidad,
    musical: estilo.musical,
    idioma: m.idioma || null,
    mercado: m.mercado || null,
    formato: m.aspect_ratio || '9:16',
    duracion: duracion !== null ? redondear(duracion, 2) : null,
    duracionOrigen: duracionPlan !== null ? 'montaje' : principal?.duracion ? 'video' : duracionEstimada ? 'estimada' : null,
    miniatura: miniaturaDe(slug, m, c),
    video: principal ? principal.url : primerClip ? urlAnuncio(slug, `video/${primerClip}`) : null,
    estado,
    etapa,
    avance,
    piezas,
    conteos: {
      tomas: (m.tomas || []).length,
      broll: (m.broll || []).length,
      imagenes: c.img.length,
      clips: c.video.length,
    },
    fecha: new Date(Math.max(...fechas)).toISOString(),
    creado: stManifiesto ? new Date(stManifiesto.birthtimeMs || stManifiesto.mtimeMs).toISOString() : null,
    versiones,
    costo: costoDe(c.dir, c),
    destacado: esDestacado(slug),
  };
  cache.set(slug, { firma, valor });
  return valor;
}

// si nada cambio en 15 min, una carpeta sin terminar no se esta produciendo
export const MINUTOS_ACTIVO = 15;

/** El ultimo cambio dentro de la carpeta del anuncio (archivos de img/, video/, audio/ y la raiz). */
export function ultimaActividad(slug) {
  const dir = path.join(TEMP, slug);
  let ultima = stat(dir)?.mtimeMs || 0;
  for (const sub of ['', 'img', 'video', 'audio', 'musica']) {
    const d = path.join(dir, sub);
    const st = stat(d);
    if (!st?.isDirectory()) continue;
    ultima = Math.max(ultima, st.mtimeMs);
    for (const n of listar(d)) {
      if (n.startsWith('.')) continue;
      const s = stat(path.join(d, n));
      if (s?.isFile()) ultima = Math.max(ultima, s.mtimeMs);
    }
  }
  return ultima;
}

/**
 * Un borrador viejo: una carpeta hecha antes de la app (sin app/brief.json), sin MP4 y sin cambios hace rato.
 * Son pruebas de cuando se armaba el sistema (Diego, 2026-10-25: "no deben aparecer"), asi que no se listan en
 * ningun lado. Una que se esta produciendo desde la terminal si aparece mientras cambia algo.
 */
function esBorradorQuieto(a) {
  if (a.estado !== 'en-produccion' || existe(path.join(TEMP, a.slug, 'app', 'brief.json'))) return false;
  return Date.now() - ultimaActividad(a.slug) >= MINUTOS_ACTIVO * 60000;
}

export function listarAnuncios() {
  const archivosOutput = listar(OUTPUT);
  return slugsDeAnuncios()
    .map((s) => resumenAnuncio(s, archivosOutput))
    .filter((a) => a && !esBorradorQuieto(a))
    .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));
}

// ---------------------------------------------------------------- detalle (una pantalla de anuncio)

export function detalleAnuncio(slug) {
  const resumen = resumenAnuncio(slug);
  if (!resumen) return null;
  const c = leerCarpeta(slug);
  const m = leerJSON(path.join(c.dir, 'manifiesto.json')) || {};
  const plan = leerJSON(path.join(c.dir, 'plan-montaje.json'));
  const img = (n) => (n ? urlAnuncio(slug, `img/${n}`) : null);
  const vid = (n) => (n ? urlAnuncio(slug, `video/${n}`) : null);
  const durClip = (n) => (n ? duracionMp4(path.join(c.dir, 'video', n)) : null);
  // listo = estan todas las piezas que lleva; generando = algunas; en-cola = ninguna todavia.
  const estadoPieza = (...archivos) => (!archivos.length || archivos.every(Boolean) ? 'listo' : archivos.some(Boolean) ? 'generando' : 'en-cola');

  const tomas = (m.tomas || []).map((t) => {
    const ini = buscarImagen(c.imgSet, `toma-${t.n}-inicial`) || (t.frame_inicial ? buscarImagen(c.imgSet, t.frame_inicial) : null);
    const fin = buscarImagen(c.imgSet, `toma-${t.n}-final`);
    const clip = buscarVideo(c.videoSet, `toma-${t.n}`);
    const llevaFinal = Boolean(t.prompt_imagen_final);
    // Lo que esta toma tiene que tener para estar lista (en UGC no hay imagen por toma; en continuidad el clip es el "paso").
    const lleva = [];
    if (t.prompt_imagen_inicial || t.frame_inicial) lleva.push(ini);
    if (llevaFinal) lleva.push(fin);
    if (!m.continuidad) lleva.push(clip);
    return {
      n: t.n,
      tipo: t.tipo || null,
      linea: t.linea || null,
      duracion: t.duracion ?? null,
      fase: t.fase || null,
      habla: t.habla || null,
      clase: t.clase || null,
      imagenInicial: img(ini),
      imagenFinal: img(fin),
      llevaImagenFinal: llevaFinal,
      clip: vid(clip),
      duracionClip: durClip(clip),
      estado: estadoPieza(...lleva),
    };
  });

  // El B-roll que no entra en el video con esta voz no se genera (lib/broll.js): no se muestra como pendiente. Si
  // algo de el ya estaba hecho (de antes), se ve eso (entra: false) y nada mas.
  const regla = brollDe(c.dir, m);
  const broll = (m.broll || [])
    .filter((b) => b && typeof b === 'object')
    .map((b) => {
      const imagen = buscarImagen(c.imgSet, `broll-${b.n}`);
      const clip = buscarVideo(c.videoSet, `broll-${b.n}`);
      const entra = regla.entra(b.n);
      return {
        n: b.n,
        despuesDeToma: b.despues_de_toma ?? null,
        encimaDeToma: b.encima_de_toma ?? null,
        sincronizaCon: b.sincroniza_con || null,
        duracion: b.duracion ?? null,
        imagen: img(imagen),
        clip: vid(clip),
        duracionClip: durClip(clip),
        entra,
        estado: entra ? estadoPieza(imagen, clip) : 'listo',
      };
    })
    .filter((b) => b.entra || b.imagen || b.clip);

  const pasos = (m.continuidad?.pasos || []).map((p, i) => {
    const clip = buscarVideo(c.videoSet, `paso-${i + 1}`);
    return { n: i + 1, de: p.de, a: p.a, duracion: p.duracion ?? null, clip: vid(clip), duracionClip: durClip(clip), estado: clip ? 'listo' : 'en-cola' };
  });

  // Hojas de referencia (personajes, lugares, objetos): las imagenes de img/ que no son tomas, b-roll ni iconos.
  const refsManifiesto = new Map((m.referencias || []).map((r) => [r.id, r]));
  const hojas = c.img
    .filter((n) => !/^(toma|broll|paso)-/.test(n) && !n.startsWith('icono-'))
    .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
    .map((n) => {
      const id = n.replace(/\.[^.]+$/, '');
      const r = refsManifiesto.get(id);
      return { id, nombre: tituloDeSlug(id), tipo: r?.tipo || (id === 'producto' ? 'producto' : 'referencia'), imagen: img(n) };
    });
  const iconos = c.img.filter((n) => n.startsWith('icono-')).map((n) => ({ id: n.replace(/\.[^.]+$/, ''), imagen: img(n) }));

  const productoFoto = c.raiz.find((n) => /^producto\.(png|jpe?g|webp)$/i.test(n));
  const audioDir = listar(path.join(c.dir, 'audio'));
  const musicaRel = plan?.musica?.archivo || (listar(path.join(c.dir, 'musica')).includes('fondo.mp3') ? 'musica/fondo.mp3' : null);
  const cancion = leerJSON(path.join(c.dir, 'audio', 'cancion.json'));
  const colorSub = leerJSON(path.join(c.dir, 'color-subtitulos.json'));

  return {
    ...resumen,
    versiones: [...(resumen.versiones || []), ...versionesDeGanchos(slug)],
    modoAudio: m.modo_audio || null,
    vozEnOff: typeof m.voz_en_off === 'string' ? m.voz_en_off : null,
    guion: Array.isArray(m.guion) ? m.guion.map((g) => ({ orden: g.orden, habla: g.habla || null, texto: g.texto || '', beat: g.beat || null })) : null,
    overlays: Array.isArray(m.overlays) ? m.overlays.map((o) => ({ texto: o.texto, toma: o.toma ?? null, momento: o.momento || null })) : [],
    tomas,
    broll,
    pasos,
    hojas,
    iconos,
    productoFoto: productoFoto ? urlAnuncio(slug, productoFoto) : null,
    audio: {
      voz: audioDir.includes('voz.mp3') ? urlAnuncio(slug, 'audio/voz.mp3') : null,
      cancion: audioDir.includes('cancion.mp3') ? urlAnuncio(slug, 'audio/cancion.mp3') : null,
      cancionTitulo: cancion?.titulo || null,
      musica: musicaRel && existe(path.join(c.dir, musicaRel)) ? urlAnuncio(slug, musicaRel) : null,
      tiemposPorPalabra: audioDir.includes('tiempos.json'),
    },
    tienePlan: Boolean(plan),
    tieneSubtitulos: existe(path.join(c.dir, 'subtitulos.json')) || Boolean(plan?.subtitulos?.length),
    colorSubtitulos: colorSub?.color || plan?.estiloSubtitulos?.colorResaltado || null,
    // Para el editor: <Player> de Remotion con window.remotion_staticBase = base
    base: `/archivos/anuncio/${encodeURIComponent(slug)}`,
    plan: plan || null,
  };
}

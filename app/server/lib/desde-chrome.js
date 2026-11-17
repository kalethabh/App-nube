// INSPIRACIÓN · «Desde Chrome» (2026-11-17n): el botón «Guardar en Kads» (la extensión de extension-chrome/) le manda
// a la app UN anuncio de la Biblioteca de anuncios de Meta cada vez que el usuario lo toca (nada automático).
//
// Seguridad:
//   - Solo se acepta con el CÓDIGO DE EMPAREJAMIENTO: lo crea la app (aleatorio, 24 letras), se ve en Inspiración ›
//     «Botón de Chrome» y el usuario lo pega una vez en las Opciones de la extensión. Viaja en la cabecera
//     X-Kads-Codigo y se compara en tiempo constante. Vive en app/.extension-chrome.json (fuera de GitHub).
//   - Solo desde una extensión de Chrome (Origin chrome-extension://<id>) o desde este equipo sin navegador; con tope
//     de tamaño y de pedidos por minuto (porteroImportar, que corre ANTES del filtro general de la app: index.js).
//   - Cada campo se valida y se recorta; el video y la imagen solo se bajan de https .fbcdn.net / facebook.com, sin
//     dejar que una redirección los lleve a otro sitio, y con tope de peso.
//
// Lo que se guarda:
//   mis_archivos/ganadores/desde-chrome.json      { v, anuncios: [anuncio normalizado] } (los más nuevos primero)
//   temp/_ganadores/chrome/<id>.<mp4|jpg|png|webp> el video o la imagen (se baja enseguida: las direcciones de Meta vencen)
//   temp/_ganadores/chrome/<id>-p.<jpg|png|webp>   la miniatura del video
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import { APP, RAIZ, PUERTO_DE_PRUEBA, TEMP } from './rutas.js';
import { leerJSON, escribirJSONSeguro } from './archivos.js';
import { DIR_CHROME, ErrorGanadores, deFacebook, normalizarAnuncio, traerMedio } from './ganadores.js';
import { modoPrueba } from './modo-prueba.js';
import { rutaDeArchivoDeMuestra } from './muestras.js';

const ARCHIVO = path.join(RAIZ, 'mis_archivos', 'ganadores', 'desde-chrome.json');
// (una app de prueba tiene su propio código: no toca el de verdad)
const ARCHIVO_CODIGO = PUERTO_DE_PRUEBA ? path.join(TEMP, `_modo-prueba-${PUERTO_DE_PRUEBA}`, 'extension-chrome.json') : path.join(APP, '.extension-chrome.json');
const MAX_ANUNCIOS = 500;
export const MAX_CUERPO = 64 * 1024; // lo que manda la extensión es texto: con 64 KB sobra
const MAX_VIDEO = 300 * 1024 * 1024;
const MAX_IMAGEN = 25 * 1024 * 1024;
const POR_MINUTO = 30;

// ---------------------------------------------------------------- el código de emparejamiento

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I: se copia y se lee sin confusión
function nuevoCodigo() {
  const b = crypto.randomBytes(24);
  let c = '';
  for (const x of b) c += ALFABETO[x % ALFABETO.length];
  return `${c.slice(0, 6)}-${c.slice(6, 12)}-${c.slice(12, 18)}-${c.slice(18, 24)}`;
}

function guardarCodigo(codigo) {
  fs.mkdirSync(path.dirname(ARCHIVO_CODIGO), { recursive: true });
  fs.writeFileSync(ARCHIVO_CODIGO, JSON.stringify({ codigo, creado: new Date().toISOString() }) + '\n', { mode: 0o600 });
  try {
    fs.chmodSync(ARCHIVO_CODIGO, 0o600);
  } catch {
    /* Windows */
  }
}

/** El código (se crea la primera vez). */
export function codigoEmparejamiento() {
  const j = leerJSON(ARCHIVO_CODIGO);
  if (typeof j?.codigo === 'string' && /^[A-Z2-9-]{20,40}$/.test(j.codigo)) return j.codigo;
  const c = nuevoCodigo();
  guardarCodigo(c);
  return c;
}

/** Un código nuevo: la extensión con el viejo deja de poder guardar. */
export function cambiarCodigo() {
  const c = nuevoCodigo();
  guardarCodigo(c);
  return c;
}

const normalizarCodigo = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** ¿Es el código? (en tiempo constante, sin importar guiones, espacios ni mayúsculas) */
export function codigoCorrecto(dado) {
  const a = crypto.createHash('sha256').update(normalizarCodigo(dado)).digest();
  const b = crypto.createHash('sha256').update(normalizarCodigo(codigoEmparejamiento())).digest();
  return normalizarCodigo(dado).length >= 20 && crypto.timingSafeEqual(a, b);
}

// ---------------------------------------------------------------- el portero de POST /api/inspiracion/importar

const ORIGEN_EXTENSION = /^chrome-extension:\/\/[a-p]{32}$/;
const pedidos = new Map(); // ip -> [tiempos]
let fallas = []; // códigos equivocados (de cualquier lado): con muchos seguidos se frena todo un rato

/**
 * Corre antes del filtro general de la app (index.js) y solo para /api/inspiracion/importar: responde el preflight
 * de CORS de la extensión, revisa el origen, el tamaño, los pedidos por minuto y el código. Si todo está bien, deja
 * pasar el pedido con req.desdeExtension = true.
 */
export function porteroImportar(req, res, next) {
  const origen = String(req.headers.origin || '');
  const deExtension = ORIGEN_EXTENSION.test(origen);
  if (origen && !deExtension) return res.status(403).json({ error: 'Solo desde el botón de Chrome de Kads.' });
  if (deExtension) {
    res.set('Access-Control-Allow-Origin', origen);
    res.set('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    if (!deExtension) return res.status(403).end();
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-Kads-Codigo');
    res.set('Access-Control-Max-Age', '600');
    if (req.headers['access-control-request-private-network']) res.set('Access-Control-Allow-Private-Network', 'true');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Usa POST.' });
  const ahora = Date.now();
  const ip = String(req.socket?.remoteAddress || '');
  const lista = (pedidos.get(ip) || []).filter((t) => ahora - t < 60000);
  fallas = fallas.filter((t) => ahora - t < 10 * 60000);
  if (lista.length >= POR_MINUTO || fallas.length >= 20) return res.status(429).json({ error: 'Demasiados pedidos seguidos. Espera un minuto.' });
  lista.push(ahora);
  pedidos.set(ip, lista);
  const largo = Number(req.headers['content-length'] || 0);
  if (largo > MAX_CUERPO) return res.status(413).json({ error: 'Ese anuncio trae demasiados datos.' });
  const codigo = req.headers['x-kads-codigo'];
  if (!codigo) return res.status(401).json({ error: 'Falta el código de emparejamiento. Pégalo en las Opciones de la extensión.', motivo: 'sin-codigo' });
  if (!codigoCorrecto(codigo)) {
    fallas.push(ahora);
    return res.status(401).json({ error: 'El código de emparejamiento no coincide. Cópialo de nuevo desde Kads › Inspiración › Botón de Chrome.', motivo: 'codigo' });
  }
  req.desdeExtension = true;
  // el cuerpo se lee aquí, con su propio tope (aunque no traiga content-length)
  lectorJSON(req, res, (err) => {
    if (err) return res.status(err.status === 413 ? 413 : 400).json({ error: err.status === 413 ? 'Ese anuncio trae demasiados datos.' : 'Lo que llegó no se entiende.' });
    next();
  });
}
const lectorJSON = express.json({ limit: MAX_CUERPO });

// ---------------------------------------------------------------- validar lo que llega

const textoLimpio = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max) || null : null);
const MESES = {
  ene: 0, jan: 0, enero: 0, january: 0, feb: 1, febrero: 1, february: 1, mar: 2, marzo: 2, march: 2, abr: 3, apr: 3, abril: 3, april: 3,
  may: 4, mayo: 4, jun: 5, junio: 5, june: 5, jul: 6, julio: 6, july: 6, ago: 7, aug: 7, agosto: 7, august: 7,
  sep: 8, sept: 8, septiembre: 8, setiembre: 8, september: 8, oct: 9, octubre: 9, october: 9, nov: 10, noviembre: 10, november: 10,
  dic: 11, dec: 11, diciembre: 11, december: 11,
};

/**
 * «Circulando desde el 3 mar 2026» / «Started running on Mar 3, 2026» / «3 de marzo de 2026» -> ISO (o null).
 */
export function fechaDeTexto(t) {
  const s = String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.,]/g, ' ');
  const iso = s.match(/\b(20\d\d)-(\d\d)-(\d\d)\b/);
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3])).toISOString();
  const anio = s.match(/\b(20\d\d)\b/)?.[1];
  if (!anio) return null;
  // dia mes (es) o mes dia (en)
  let m = s.match(/\b(\d{1,2})\s+(?:de\s+)?([a-z]{3,10})\s+(?:de\s+)?20\d\d/);
  let dia;
  let mes;
  if (m && MESES[m[2]] !== undefined) {
    dia = +m[1];
    mes = MESES[m[2]];
  } else {
    m = s.match(/\b([a-z]{3,10})\s+(\d{1,2})\s+20\d\d/);
    if (m && MESES[m[1]] !== undefined) {
      dia = +m[2];
      mes = MESES[m[1]];
    }
  }
  if (mes === undefined || !(dia >= 1 && dia <= 31)) return null;
  const d = new Date(Date.UTC(+anio, mes, dia));
  return d.getTime() <= Date.now() + 86400000 ? d.toISOString() : null;
}

/** Lo que manda la extensión -> { libraryId, ... } limpio, o tira ErrorGanadores(400). */
export function validarImportacion(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) throw new ErrorGanadores(400, 'No llegó ningún anuncio.');
  const libraryId = String(c.libraryId ?? '').replace(/\D/g, '');
  if (!/^\d{5,25}$/.test(libraryId)) throw new ErrorGanadores(400, 'No pude leer el identificador de la biblioteca de ese anuncio.');
  const video = deFacebook(c.video);
  const imagen = deFacebook(c.imagen);
  const poster = deFacebook(c.poster);
  for (const [k, v] of [['video', c.video], ['imagen', c.imagen], ['poster', c.poster], ['avatar', c.avatar]]) {
    if (v && !deFacebook(v)) throw new ErrorGanadores(400, `La dirección del ${k} no es de Facebook: no la acepto.`);
  }
  const creativos = Number(String(c.creativos ?? '').replace(/\D/g, ''));
  return {
    libraryId,
    pagina: textoLimpio(c.pagina, 120),
    paginaId: /^\d{3,25}$/.test(String(c.paginaId ?? '')) ? String(c.paginaId) : null,
    avatar: deFacebook(c.avatar),
    desdeTexto: textoLimpio(c.desde, 120),
    desde: fechaDeTexto(c.desde),
    activo: c.activo === false ? false : c.activo === true ? true : null,
    copy: textoLimpio(c.copy, 4000),
    titulo: textoLimpio(c.titulo, 300),
    cta: textoLimpio(c.cta, 40),
    caption: textoLimpio(c.caption, 120),
    video,
    imagen,
    poster,
    creativos: Number.isFinite(creativos) && creativos > 0 && creativos < 100000 ? creativos : null,
    url: textoLimpio(c.url, 300),
  };
}

// ---------------------------------------------------------------- bajar el video o la imagen

const EXT_IMAGEN = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Baja un medio de Facebook a temp/_ganadores/chrome/<nombre>.<ext>, con tope. -> el nombre del archivo, o null. */
async function bajar(url, nombre, { video }) {
  let r;
  try {
    r = await traerMedio(url, { signal: AbortSignal.timeout(video ? 180000 : 60000) });
  } catch {
    return null;
  }
  if (!r.ok || !r.body) return null;
  const tipo = String(r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const ext = video ? (/^video\/(mp4|quicktime)$/.test(tipo) || tipo === 'application/octet-stream' ? 'mp4' : null) : EXT_IMAGEN[tipo];
  if (!ext) return null;
  const tope = video ? MAX_VIDEO : MAX_IMAGEN;
  if (Number(r.headers.get('content-length') || 0) > tope) return null;
  fs.mkdirSync(DIR_CHROME, { recursive: true });
  const archivo = `${nombre}.${ext}`;
  const destino = path.join(DIR_CHROME, archivo);
  const tmp = `${destino}.${process.pid}.parcial`;
  const fd = fs.openSync(tmp, 'w');
  let total = 0;
  try {
    for await (const trozo of r.body) {
      total += trozo.length;
      if (total > tope) throw new Error('grande');
      fs.writeSync(fd, trozo);
    }
  } catch {
    fs.closeSync(fd);
    fs.rmSync(tmp, { force: true });
    return null;
  }
  fs.closeSync(fd);
  if (total < (video ? 1000 : 300)) {
    fs.rmSync(tmp, { force: true });
    return null;
  }
  fs.renameSync(tmp, destino);
  return archivo;
}

/** (modo prueba) nunca se llama a Facebook: se copia una muestra del paquete como si fuera lo bajado. */
function bajarSimulado(url, nombre, { video }) {
  const origen = rutaDeArchivoDeMuestra(video ? 'ugc' : 'claymation', video ? 'video.mp4' : 'imagen.jpg');
  if (!origen || !fs.existsSync(origen) || /no-existe/.test(url)) return null;
  fs.mkdirSync(DIR_CHROME, { recursive: true });
  const archivo = `${nombre}.${video ? 'mp4' : 'jpg'}`;
  fs.copyFileSync(origen, path.join(DIR_CHROME, archivo));
  return archivo;
}

const URL_LOCAL = (archivo) => (archivo ? `/api/inspiracion/chrome/media/${archivo}` : null);

// ---------------------------------------------------------------- guardar, listar, borrar

export function listarDesdeChrome() {
  const j = leerJSON(ARCHIVO);
  return Array.isArray(j?.anuncios) ? j.anuncios : [];
}
const guardarLista = (lista) => escribirJSONSeguro(ARCHIVO, { v: 1, anuncios: lista.slice(0, MAX_ANUNCIOS) });

/**
 * Guarda un anuncio que mandó la extensión: baja el video / la imagen enseguida y lo deja en «Desde Chrome».
 * -> { anuncio, avisos: [texto] } (avisos: lo que no se pudo, para el aviso de la extensión)
 */
export async function importarAnuncio(crudo, { bajarMedios = modoPrueba() ? bajarSimulado : bajar } = {}) {
  const c = validarImportacion(crudo);
  const avisos = [];
  let media = null;
  let miniatura = null;
  let tipo = 'otro';
  if (c.video) {
    const v = await bajarMedios(c.video, c.libraryId, { video: true });
    if (v) {
      media = URL_LOCAL(v);
      tipo = 'video';
    } else avisos.push('No pude bajar el video (puede que la dirección ya haya vencido).');
    const p = c.poster ? await bajarMedios(c.poster, `${c.libraryId}-p`, { video: false }) : null;
    if (p) miniatura = URL_LOCAL(p);
  }
  if (!media && c.imagen) {
    const i = await bajarMedios(c.imagen, c.libraryId, { video: false });
    if (i) {
      media = URL_LOCAL(i);
      miniatura = miniatura || media;
      tipo = 'imagen';
    } else avisos.push('No pude bajar la imagen.');
  }
  if (!c.video && !c.imagen) avisos.push('No encontré el video ni la imagen en la tarjeta.');
  const dias = c.desde ? Math.max(0, Math.floor((Date.now() - Date.parse(c.desde)) / 86400000)) : null;
  const dominio = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(c.caption || '') ? c.caption.toLowerCase().replace(/^www\./, '') : null;
  const anuncio = normalizarAnuncio({
    id: `chrome_${c.libraryId}`,
    metaId: c.libraryId,
    fuente: 'chrome',
    platform: 'facebook',
    status: c.activo === false ? 'inactive' : 'active',
    daysRunning: dias,
    firstSeenAt: c.desde,
    media: { type: tipo === 'video' ? 'video' : tipo === 'imagen' ? 'image' : 'other', thumbnailUrl: miniatura, mediaUrl: media },
    // el avatar de la página no se baja (es chico y vence): queda la letra
    advertiser: { name: c.pagina || 'Anunciante', facebookPageId: c.paginaId },
    content: { title: c.titulo, body: c.copy, callToAction: c.cta, landingPageDomain: dominio || c.caption },
    metrics: { creatives: c.creativos },
    importedAt: new Date().toISOString(),
  });
  if (!anuncio) throw new ErrorGanadores(400, 'Ese anuncio no se pudo guardar.');
  const lista = listarDesdeChrome().filter((x) => x.id !== anuncio.id);
  guardarLista([anuncio, ...lista]);
  return { anuncio, avisos };
}

export function borrarDesdeChrome(id) {
  const lista = listarDesdeChrome();
  const a = lista.find((x) => x.id === id);
  if (!a) return false;
  guardarLista(lista.filter((x) => x.id !== id));
  // sus archivos también
  for (const u of [a.media, a.miniatura]) {
    const nombre = String(u || '').match(/\/api\/inspiracion\/chrome\/media\/([^/]+)$/)?.[1];
    if (nombre && /^\d{5,25}(?:-p)?\.(?:mp4|jpg|png|webp)$/.test(nombre)) fs.rmSync(path.join(DIR_CHROME, nombre), { force: true });
  }
  return true;
}

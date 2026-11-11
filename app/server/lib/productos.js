// Los productos del usuario: se cargan una vez y sirven para todos los estilos.
//
//   temp/_productos/<id>/producto.json   lo que escribio el usuario: { id, nombre, tipo, url, descripcion, guionPropio,
//                                        fotos: ["fotos/1.png", ...], creado }
//   temp/_productos/<id>/fotos/          las fotos (la 1 es la principal)
//   temp/_productos/<id>/pagina.txt      el texto de su pagina, bajado por la app (con tope de tamano y de tiempo)
//   temp/_productos/<id>/ficha.json      la ficha que arma Claude (sesion "ficha") y que el usuario corrige
//   temp/_productos/<id>/tarea.json      en que va el analisis: { id, uuid, estado, paso, progreso, error, ... }
//   temp/_productos/<id>/registro/       lo que hizo Claude, evento por evento
//
// La sesion "ficha" de Claude solo lee esta carpeta y solo escribe en ella: sin terminal y sin internet (la pagina la
// baja la app). La carpeta empieza con "_", asi que el tablero nunca la toma por un anuncio.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { TEMP, PUERTO, PUERTO_DE_PRUEBA, esDeEstaApp } from './rutas.js';
import { origenesPermitidos } from './servidor.js';
import { leerJSON, existe, listar, escribirJSONSeguro } from './archivos.js';
import { sesionActiva, prohibidasComunes, textoClaude, leerYValidar, validarEsquema, cargarEsquema } from './claude.js';
// la IA elegida (Claude o ChatGPT) con la pausa compartida: si su plan se acabo, no se abre otra sesion hasta que se
// renueve
import { lanzarSesion } from './colas.js';
import { nombreIA } from './motor-ia.js';
import { prohibidasDeProducto } from './ia/reglas.js';

export const PRODUCTOS = path.join(TEMP, '_productos');
export const TIPOS = ['fisico', 'digital', 'servicio'];
export const MAX_FOTOS = 8;
const ID = /^[a-z0-9][a-z0-9-]{1,79}$/;

// Lo que cambia algo (crear, subir, lanzar a Claude) solo desde la propia app: una pagina web cualquiera podria
// mandarle un POST a 127.0.0.1 y aca eso es gastar el plan de Claude del usuario.
const ORIGENES = origenesPermitidos(PUERTO);
export function soloDesdeLaApp(req, res, next) {
  const origen = req.headers.origin;
  if ((origen && !ORIGENES.has(String(origen).toLowerCase())) || String(req.headers['sec-fetch-site'] || '') === 'cross-site') {
    return res.status(403).json({ error: 'Solo desde la app.' });
  }
  next();
}

export class ErrorApp extends Error {
  constructor(status, mensaje, extra = {}) {
    super(mensaje);
    this.status = status;
    Object.assign(this, extra);
  }
}

// ---------------------------------------------------------------- utilidades de disco (las usa tambien anuncios-nuevos.js)

/** Escribe un JSON sin dejarlo nunca a medias (un .tmp y se renombra). */
export function escribirJSON(ruta, datos) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  escribirJSONSeguro(ruta, datos);
  return datos;
}

/** "Crema Hidratante Ñandú!" -> "crema-hidratante-nandu" */
export function aKebab(texto, max = 40) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

const ahora = () => new Date().toISOString();
const recortar = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// ---------------------------------------------------------------- productos

export const idValido = (id) => typeof id === 'string' && ID.test(id) && existe(path.join(PRODUCTOS, id, 'producto.json'));
export const carpetaProducto = (id) => path.join(PRODUCTOS, id);
export const relProducto = (id) => `temp/_productos/${id}`;

/**
 * La frase de una tarea de Claude con lo que hay para leer del producto: pagina.txt solo si existe (el usuario dio
 * un link). Sin nada que leer, vacia. vineta: como un punto de lista ("- ...").
 */
export function detalleDelProducto(id, { vineta = false } = {}) {
  if (!id || !idValido(id)) return '';
  const hay = ['pagina.txt', 'ficha.json'].filter((f) => existe(path.join(PRODUCTOS, id, f)));
  if (!hay.length) return '';
  return `${vineta ? '- ' : ''}Más detalle del producto, si lo necesitas (solo leer): ${hay.map((f) => `\`${relProducto(id)}/${f}\``).join(' y ')}.`;
}
export const leerProducto = (id) => (idValido(id) ? leerJSON(path.join(PRODUCTOS, id, 'producto.json')) : null);
export const leerFicha = (id) => (idValido(id) ? leerJSON(path.join(PRODUCTOS, id, 'ficha.json')) : null);
const leerTarea = (id) => leerJSON(path.join(PRODUCTOS, id, 'tarea.json'));
const guardarTarea = (id, t) => escribirJSON(path.join(PRODUCTOS, id, 'tarea.json'), { ...t, actualizado: ahora() });

function urlLimpia(texto) {
  const t = String(texto || '').trim();
  if (!t) return '';
  let u;
  try {
    u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
  } catch {
    throw new ErrorApp(400, 'Ese link no parece una página web. Cópialo de la barra del navegador.');
  }
  if (!/^https?:$/.test(u.protocol)) throw new ErrorApp(400, 'El link tiene que empezar con https://');
  u.hash = '';
  return u.toString();
}

/** POST /api/productos */
export function crearProducto(datos = {}) {
  const tipo = datos.tipo ?? 'fisico';
  if (!TIPOS.includes(tipo)) throw new ErrorApp(400, 'Elige si tu producto es físico, digital o un servicio.');
  const url = urlLimpia(datos.url);
  const nombre = recortar(datos.nombre, 120);
  const descripcion = recortar(datos.descripcion, 8000);
  const guionPropio = recortar(datos.guionPropio, 20000);
  // el video de referencia del paso 1 ("subido:<id>|<nombre>" o un link): va como «Clonar un video» en cada estilo
  const referencia = recortar(datos.referencia, 700) || null;
  let base = aKebab(nombre, 32);
  if (!base && url) base = aKebab(new URL(url).hostname.replace(/^www\./, '').split('.')[0], 32);
  if (!base) base = 'producto';
  fs.mkdirSync(PRODUCTOS, { recursive: true });
  let id;
  do id = `${base}-${crypto.randomBytes(3).toString('hex').slice(0, 4)}`;
  while (existe(path.join(PRODUCTOS, id)));
  const producto = { id, nombre, tipo, url, descripcion, guionPropio, referencia, fotos: [], creado: ahora(), ...(PUERTO_DE_PRUEBA ? { puerto: PUERTO_DE_PRUEBA } : {}) };
  fs.mkdirSync(path.join(PRODUCTOS, id, 'fotos'), { recursive: true });
  escribirJSON(path.join(PRODUCTOS, id, 'producto.json'), producto);
  return producto;
}

/** Cambia lo que escribio el usuario (nombre, link, lo que conto, su guion). */
export function actualizarProducto(id, datos = {}) {
  const p = leerProducto(id);
  if (!p) throw new ErrorApp(404, 'No encuentro ese producto.');
  if ('tipo' in datos) {
    if (!TIPOS.includes(datos.tipo)) throw new ErrorApp(400, 'Elige si tu producto es físico, digital o un servicio.');
    p.tipo = datos.tipo;
  }
  if ('url' in datos) p.url = urlLimpia(datos.url);
  if ('nombre' in datos) p.nombre = recortar(datos.nombre, 120);
  if ('descripcion' in datos) p.descripcion = recortar(datos.descripcion, 8000);
  if ('guionPropio' in datos) p.guionPropio = recortar(datos.guionPropio, 20000);
  if ('referencia' in datos) p.referencia = recortar(datos.referencia, 700) || null;
  return escribirJSON(path.join(PRODUCTOS, id, 'producto.json'), p);
}

// ---------------------------------------------------------------- fotos

/** El formato real por los bytes (no por la extension). */
export function formatoDeBytes(b) {
  if (!b || b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b[0] === 0x89 && b.slice(1, 4).toString('latin1') === 'PNG') return 'png';
  if (b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (b.slice(0, 4).toString('latin1') === 'GIF8') return 'gif';
  if (b.slice(0, 2).toString('latin1') === 'BM') return 'bmp';
  if (['II*\0', 'MM\0*'].includes(b.slice(0, 4).toString('latin1'))) return 'tiff';
  if (b.slice(4, 8).toString('latin1') === 'ftyp') return /^avi[fs]/.test(b.slice(8, 12).toString('latin1')) ? 'avif' : 'heic';
  return null;
}

// Los que Claude Code abre siempre y el motor acepta tal cual. Un WebP no: las tiendas suelen servirlo animado y Claude
// Code no lo puede abrir (prueba real con Bloom, 2026-10-26), asi que se pasa a PNG (su primer cuadro, con transparencia).
const DIRECTOS = ['jpg', 'png'];
const LADO_MAX = 1600; // Claude Code no abre imagenes de mas de 2000 px de lado

function ffmpeg(args, ms = 60000) {
  return new Promise((resolve) => execFile('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { timeout: ms, windowsHide: true }, (err) => resolve(!err)));
}
function ladoMayor(ruta) {
  return new Promise((resolve) =>
    execFile('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', ruta], { timeout: 20000, windowsHide: true }, (err, out) => {
      const [w, h] = String(out || '').trim().split('x').map(Number);
      resolve(err || !w || !h ? null : Math.max(w, h));
    })
  );
}

/**
 * Guarda la foto n (1 = la principal) desde sus bytes. Las que no son jpg o png se pasan a jpg (o a png si son webp o
 * gif); las muy grandes se achican a 1600 px de lado (Claude Code no abre mas de 2000 y el motor no necesita mas).
 */
export async function guardarFoto(id, n, bytes, { origen = 'usuario' } = {}) {
  const p = leerProducto(id);
  if (!p) throw new ErrorApp(404, 'No encuentro ese producto.');
  const num = Number(n);
  if (!Number.isInteger(num) || num < 1 || num > MAX_FOTOS) throw new ErrorApp(400, `Puedes subir hasta ${MAX_FOTOS} fotos.`);
  if (!Buffer.isBuffer(bytes) || !bytes.length) throw new ErrorApp(400, 'No llegó ninguna foto.');
  const formato = formatoDeBytes(bytes);
  if (!formato) throw new ErrorApp(400, 'Eso no parece una foto. Sube una imagen JPG, PNG o WEBP.');
  const dir = path.join(PRODUCTOS, id, 'fotos');
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${num}-${crypto.randomBytes(3).toString('hex')}.${formato}`);
  fs.writeFileSync(tmp, bytes);
  let ext = formato === 'jpeg' ? 'jpg' : formato;
  let final = path.join(dir, `.${num}-final.${ext}`);
  try {
    if (!DIRECTOS.includes(formato)) {
      ext = formato === 'webp' || formato === 'gif' ? 'png' : 'jpg'; // los que pueden traer transparencia van a PNG
      final = path.join(dir, `.${num}-final.${ext}`);
      const escala = `scale='if(gt(iw,ih),min(${LADO_MAX},iw),-2)':'if(gt(iw,ih),-2,min(${LADO_MAX},ih))'`;
      const ok = await ffmpeg(['-i', tmp, '-frames:v', '1', '-vf', escala, ...(ext === 'jpg' ? ['-q:v', '2'] : []), final]);
      if (!ok) {
        throw new ErrorApp(400, formato === 'heic' || formato === 'avif'
          ? 'Esa foto está en un formato de iPhone que no puedo abrir. Guárdala como JPG y súbela otra vez.'
          : 'No pude abrir esa foto. Guárdala como JPG o PNG y súbela otra vez.');
      }
    } else {
      const lado = await ladoMayor(tmp);
      const achicada = lado && lado > LADO_MAX && (await ffmpeg(['-i', tmp, '-vf', `scale='if(gt(iw,ih),${LADO_MAX},-2)':'if(gt(iw,ih),-2,${LADO_MAX})'`, ...(ext === 'jpg' ? ['-q:v', '2'] : []), final]));
      if (!achicada) fs.renameSync(tmp, final);
    }
    for (const x of listar(dir)) if (new RegExp(`^${num}\\.`).test(x)) fs.rmSync(path.join(dir, x), { force: true });
    fs.renameSync(final, path.join(dir, `${num}.${ext}`));
  } finally {
    fs.rmSync(tmp, { force: true });
    fs.rmSync(final, { force: true });
  }
  const archivo = `fotos/${num}.${ext}`;
  const actual = leerProducto(id);
  actual.fotos = [...new Set([...(actual.fotos || []).filter((f) => !new RegExp(`^fotos/${num}\\.`).test(f)), archivo])].sort(porNumero);
  if (origen === 'pagina') actual.fotosDeLaPagina = [...new Set([...(actual.fotosDeLaPagina || []), archivo])];
  else if (actual.fotosDeLaPagina) actual.fotosDeLaPagina = actual.fotosDeLaPagina.filter((f) => f !== archivo && actual.fotos.includes(f));
  escribirJSON(path.join(PRODUCTOS, id, 'producto.json'), actual);
  return { n: num, archivo, url: urlFoto(id, num) };
}

const porNumero = (a, b) => (Number(a.match(/(\d+)\./)?.[1]) || 0) - (Number(b.match(/(\d+)\./)?.[1]) || 0);
export const urlFoto = (id, n) => `/api/productos/${encodeURIComponent(id)}/fotos/${n}`;

export function borrarFoto(id, n) {
  const p = leerProducto(id);
  if (!p) throw new ErrorApp(404, 'No encuentro ese producto.');
  const num = Number(n);
  const dir = path.join(PRODUCTOS, id, 'fotos');
  for (const x of listar(dir)) if (new RegExp(`^${num}\\.`).test(x)) fs.rmSync(path.join(dir, x), { force: true });
  p.fotos = (p.fotos || []).filter((f) => !new RegExp(`^fotos/${num}\\.`).test(f));
  escribirJSON(path.join(PRODUCTOS, id, 'producto.json'), p);
  return { ok: true };
}

/** La ruta en disco de la foto n, o null. */
export function rutaFoto(id, n) {
  const p = leerProducto(id);
  const num = Number(n);
  const rel = (p?.fotos || []).find((f) => new RegExp(`^fotos/${num}\\.(jpg|png|webp)$`).test(f));
  const abs = rel ? path.join(PRODUCTOS, id, rel) : null;
  return abs && existe(abs) ? abs : null;
}

/** La foto principal (la primera que haya), en disco, o null. */
export function fotoPrincipal(id) {
  const p = leerProducto(id);
  for (const rel of (p?.fotos || []).slice().sort(porNumero)) {
    const abs = path.join(PRODUCTOS, id, rel);
    if (existe(abs)) return abs;
  }
  return null;
}

// ---------------------------------------------------------------- la pagina del producto

const TOPE_PAGINA = 3 * 1024 * 1024; // bytes de HTML que se leen como mucho
const TOPE_JSON = 2 * 1024 * 1024;
const TOPE_IMAGEN = 12 * 1024 * 1024;
const TOPE_MS = 20000; // por pedido
const TOPE_TEXTO = 40000; // caracteres de pagina.txt (lo de la tienda va primero; el resto del texto se corta)
const NAVEGADOR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

// Solo paginas de internet: nada de la propia PC ni de la red de la casa.
// (ANUNCIOS_PAGINA_LOCAL=1 deja pasar 127.0.0.1: SOLO para probar la bajada con una tienda falsa local.)
function esPublica(u) {
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!/^https?:$/.test(u.protocol)) return false;
  if (process.env.ANUNCIOS_PAGINA_LOCAL === '1' && h === '127.0.0.1') return true;
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return false;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  if (h === '::1' || /^f[cd][0-9a-f]{2}:/i.test(h) || /^fe80:/i.test(h) || h === '::') return false;
  return true;
}

async function pedir(url, { tope, aceptar }) {
  const u = new URL(url);
  if (!esPublica(u)) throw new Error('esa dirección no es una página de internet');
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TOPE_MS);
  try {
    const r = await fetch(u, { signal: control.signal, redirect: 'follow', headers: { 'User-Agent': NAVEGADOR, Accept: aceptar, 'Accept-Language': 'es-419,es;q=0.9,en;q=0.8,pt;q=0.6' } });
    if (!esPublica(new URL(r.url || url))) throw new Error('la página redirige a una dirección que no es de internet');
    const partes = [];
    let total = 0;
    let cortado = false;
    if (r.body) {
      const lector = r.body.getReader();
      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        total += value.length;
        if (total > tope) {
          partes.push(Buffer.from(value.subarray(0, Math.max(0, value.length - (total - tope)))));
          cortado = true;
          try {
            await lector.cancel();
          } catch {
            /* ya cortado */
          }
          break;
        }
        partes.push(Buffer.from(value));
      }
    }
    return { status: r.status, ok: r.ok, headers: r.headers, url: r.url || url, cuerpo: Buffer.concat(partes), cortado };
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('la página tardó demasiado en responder');
    throw e;
  } finally {
    clearTimeout(reloj);
  }
}

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ntilde: 'ñ', Ntilde: 'Ñ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', uuml: 'ü', ccedil: 'ç', atilde: 'ã', otilde: 'õ', acirc: 'â', ecirc: 'ê', ocirc: 'ô', iexcl: '¡', iquest: '¿', laquo: '«', raquo: '»', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', bull: '•', middot: '·', copy: '©', reg: '®', trade: '™', euro: '€', deg: '°' };
const decodificar = (t) =>
  String(t || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (todo, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }
    return ENTIDADES[e] ?? todo;
  });

/** El texto que se lee de un pedazo de HTML (sin scripts, estilos ni etiquetas). */
export function htmlATexto(html) {
  const lineas = String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template|iframe|head|canvas|select)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<(br|hr)\b[^>]*>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|header|footer|ul|ol|table|blockquote|dt|dd|summary|details|figcaption|label|button)\s*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<[^>]+>/g, ' ')
    .split('\n')
    .map((l) => decodificar(l).replace(/[\s​ ]+/g, ' ').trim())
    .filter((l) => l && l !== '•');
  const vistas = new Set();
  return lineas.filter((l) => (l.length > 3 && vistas.has(l) ? false : (vistas.add(l), true))).join('\n');
}

const meta = (html, nombre) => {
  const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${nombre.replace(/[.:]/g, '\\$&')}["'][^>]*>`, 'i');
  const tag = String(html).match(re)?.[0];
  const c = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return c ? decodificar(c).trim() : '';
};

// Los productos que la pagina declara para los buscadores (JSON-LD), con sus resenas si las trae.
function productosLd(html) {
  const lista = [];
  for (const m of String(html).matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let j;
    try {
      j = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const pila = [j];
    while (pila.length) {
      const x = pila.pop();
      if (!x || typeof x !== 'object') continue;
      if (Array.isArray(x)) {
        pila.push(...x);
        continue;
      }
      const tipo = [].concat(x['@type'] || []).join(' ');
      if (/\bProduct\b/i.test(tipo)) lista.push(x);
      if (x['@graph']) pila.push(x['@graph']);
    }
  }
  return lista;
}

function textoLd(p) {
  const L = [];
  const oferta = [].concat(p.offers || [])[0] || {};
  const of = oferta.offers ? [].concat(oferta.offers)[0] : oferta;
  if (p.name) L.push(`Nombre: ${decodificar(p.name)}`);
  if (p.brand) L.push(`Marca: ${decodificar(typeof p.brand === 'object' ? p.brand.name : p.brand)}`);
  if (of?.price || oferta.lowPrice) L.push(`Precio: ${of.price || oferta.lowPrice} ${of.priceCurrency || oferta.priceCurrency || ''}`.trim());
  if (p.description) L.push(`Descripción: ${htmlATexto(decodificar(p.description))}`);
  const nota = p.aggregateRating;
  if (nota?.ratingValue) L.push(`Calificación: ${nota.ratingValue} de ${nota.bestRating || 5}${nota.reviewCount || nota.ratingCount ? ` (${nota.reviewCount || nota.ratingCount} opiniones)` : ''}`);
  const resenas = [].concat(p.review || []).slice(0, 8);
  if (resenas.length) {
    L.push('Reseñas que publica la página:');
    for (const r of resenas) {
      const texto = htmlATexto(decodificar(r.reviewBody || r.description || '')).replace(/\n/g, ' ');
      const autor = typeof r.author === 'object' ? r.author?.name : r.author;
      if (texto) L.push(`- "${texto.slice(0, 500)}"${autor ? ` — ${decodificar(autor)}` : ''}`);
    }
  }
  return L.join('\n');
}

const imagenesLd = (p) => [].concat(p.image || []).map((x) => (typeof x === 'object' ? x.url || x.contentUrl : x)).filter((x) => typeof x === 'string');

/**
 * Baja la pagina del producto y la deja como texto. En Shopify tambien lee <url>.json (precio, variantes, descripcion).
 * -> { ok, texto, imagenes: [urls], url, shopify, motivo? }
 */
export async function bajarPagina(url) {
  let r;
  try {
    r = await pedir(url, { tope: TOPE_PAGINA, aceptar: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' });
  } catch (e) {
    return { ok: false, motivo: `No pude abrir tu página: ${e.message}.` };
  }
  if (!r.ok) return { ok: false, motivo: r.status === 404 ? 'Tu página no existe (la tienda respondió "no encontrada"). Revisa el link.' : `Tu página no respondió bien (código ${r.status}).` };
  const html = r.cuerpo.toString('utf8');
  const final = new URL(r.url);
  const partes = [`Página: ${final.toString()}`, `Bajada: ${ahora()}${r.cortado ? ' (la página es muy larga: se leyó solo el principio)' : ''}`];
  const imagenes = [];

  const titulo = decodificar(String(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim());
  const ogTitulo = meta(html, 'og:title');
  const desc = meta(html, 'og:description') || meta(html, 'description');
  const precio = meta(html, 'product:price:amount') || meta(html, 'og:price:amount');
  const moneda = meta(html, 'product:price:currency') || meta(html, 'og:price:currency');
  if (titulo || ogTitulo) partes.push('', '== Título ==', [titulo, ogTitulo].filter((x, i, a) => x && a.indexOf(x) === i).join('\n'));
  if (desc) partes.push('', '== Descripción corta ==', desc);
  if (precio) partes.push('', '== Precio que declara la página ==', `${precio} ${moneda}`.trim());
  const og = meta(html, 'og:image');
  if (og) imagenes.push(og);

  // Shopify: el mismo producto en JSON (sin el tema alrededor)
  let shopify = false;
  const pareceShopify = /cdn\.shopify\.com|Shopify\.theme|shopify-section|\.myshopify\.com/i.test(html) || r.headers.get('x-shopify-stage') || /shopify/i.test(r.headers.get('powered-by') || '');
  const deProducto = final.pathname.match(/^(.*\/products\/[^/?#]+?)(?:\.(?:json|js|oembed))?\/?$/i);
  if (pareceShopify && deProducto) {
    try {
      const j = await pedir(`${final.origin}${deProducto[1]}.json`, { tope: TOPE_JSON, aceptar: 'application/json' });
      const p = j.ok ? JSON.parse(j.cuerpo.toString('utf8'))?.product : null;
      if (p) {
        shopify = true;
        const L = ['', '== Datos del producto en la tienda (Shopify) =='];
        if (p.title) L.push(`Nombre: ${p.title}`);
        if (p.vendor) L.push(`Marca: ${p.vendor}`);
        if (p.product_type) L.push(`Tipo: ${p.product_type}`);
        const variantes = Array.isArray(p.variants) ? p.variants : [];
        for (const v of variantes.slice(0, 12)) {
          const antes = v.compare_at_price && Number(v.compare_at_price) > Number(v.price) ? ` (antes ${v.compare_at_price})` : '';
          L.push(`Variante${v.title && v.title !== 'Default Title' ? ` "${v.title}"` : ''}: precio ${v.price}${antes}`);
        }
        const tags = Array.isArray(p.tags) ? p.tags : String(p.tags || '').split(',').map((x) => x.trim()).filter(Boolean);
        if (tags.length) L.push(`Etiquetas: ${tags.slice(0, 30).join(', ')}`);
        if (p.body_html) L.push('Descripción:', htmlATexto(p.body_html));
        partes.push(...L);
        for (const im of Array.isArray(p.images) ? p.images : []) if (im?.src) imagenes.push(im.src);
      }
    } catch {
      /* sin el JSON: alcanza con la pagina */
    }
  }

  for (const p of productosLd(html).slice(0, 2)) {
    const t = textoLd(p);
    if (t) partes.push('', '== Datos del producto que declara la página ==', t);
    imagenes.push(...imagenesLd(p));
  }

  const cuerpo = String(html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] || html);
  const texto = htmlATexto(cuerpo);
  if (texto) partes.push('', '== Texto de la página ==', texto);
  let todo = partes.join('\n');
  if (todo.length > TOPE_TEXTO) todo = `${todo.slice(0, TOPE_TEXTO)}\n\n(… la página sigue; se cortó aquí por largo)`;
  const absolutas = [...new Set(imagenes.map((x) => {
    try {
      return new URL(x.startsWith('//') ? `https:${x}` : x, final).toString();
    } catch {
      return null;
    }
  }).filter(Boolean))];
  return { ok: true, texto: todo, imagenes: absolutas, url: final.toString(), shopify, caracteres: todo.length };
}

/** Baja hasta `cuantas` fotos de la pagina cuando el usuario no subio ninguna. */
async function fotosDeLaPagina(id, urls, cuantas = 2) {
  let n = 0;
  for (const u of urls) {
    if (n >= cuantas) break;
    try {
      const r = await pedir(u, { tope: TOPE_IMAGEN, aceptar: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.5' });
      if (!r.ok || r.cortado || !formatoDeBytes(r.cuerpo)) continue;
      await guardarFoto(id, n + 1, r.cuerpo, { origen: 'pagina' });
      n++;
    } catch {
      /* esa no: se prueba la siguiente */
    }
  }
  return n;
}

// ---------------------------------------------------------------- la ficha (sesion "ficha" de Claude)

const enMarcha = new Map(); // id -> promesa del analisis

function permisosFicha(id) {
  const c = `./${relProducto(id)}`;
  return {
    herramientas: ['Read', 'Glob', 'Grep', 'Write', 'Edit'],
    permitidas: [`Read(${c}/**)`, `Write(${c}/**)`, `Edit(${c}/**)`, 'Glob', 'Grep'],
    // la ficha escribe ficha.json: producto.json (lo que escribio el usuario) no se pisa (para las dos IA)
    prohibidas: [...prohibidasComunes({ terminal: false }), ...prohibidasDeProducto(relProducto(id))],
  };
}

/** "Claude", "ChatGPT" o "Tu IA" (al principio de una frase); con `motor`, el de esa IA. */
function laIA(motor) {
  const n = nombreIA(motor || undefined);
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** Lo que lee la IA para la ficha (o.material; Claude lo abre con Read y a ChatGPT se lo pasa la app): solo lo que existe. */
function materialFicha(id) {
  const p = leerProducto(id) || {};
  const rel = relProducto(id);
  const hay = (f) => existe(path.join(PRODUCTOS, id, ...f.split('/')));
  return {
    textos: ['producto.json', 'pagina.txt'].filter(hay).map((f) => `${rel}/${f}`),
    imagenes: (p.fotos || []).filter(hay).map((f) => `${rel}/${f}`),
  };
}

/**
 * La sesion de la ficha, lista para lanzarSesion({ ...armarSesionFicha(id, …), uuid, alProgreso, registro }):
 * { tipo, resume, prompt, herramientas, permitidas, prohibidas, material, fraseInicio, timeoutMs, silencioMs, maxTurnos,
 * correcciones, verificar }. Con `retomar`, sigue la conversacion (la app se cerro mientras trabajaba). Va sin
 * `esfuerzo`: el de siempre.
 */
export function armarSesionFicha(id, { retomar = false } = {}) {
  return {
    tipo: 'ficha',
    resume: retomar,
    prompt: retomar ? `${promptFicha(id)}\n\n(La app se cerró mientras trabajabas: sigue desde donde quedaste.)` : promptFicha(id),
    ...permisosFicha(id),
    material: materialFicha(id),
    fraseInicio: `${laIA()} está leyendo tu producto`,
    timeoutMs: 20 * 60000,
    silencioMs: 8 * 60000,
    maxTurnos: 30,
    correcciones: 1,
    verificar: async () => verificarFicha(id),
  };
}

function promptFicha(id) {
  const p = leerProducto(id);
  const rel = relProducto(id);
  const datos = { nombre: p.nombre || '', tipo: p.tipo, pagina: p.url || '', lo_que_conto: p.descripcion || '', tiene_guion_propio: Boolean(p.guionPropio) };
  const fotos = (p.fotos || []).length
    ? p.fotos.map((f, i) => `- ${rel}/${f}${i === 0 ? ' (la principal)' : ''}${(p.fotosDeLaPagina || []).includes(f) ? ' (bajada de su página)' : ''}`).join('\n')
    : '- No subió fotos.';
  const pagina = existe(path.join(PRODUCTOS, id, 'pagina.txt')) ? `está en \`${rel}/pagina.txt\` (bajado por la app de ${p.url}).` : p.url ? 'no se pudo bajar; trabaja con lo demás.' : 'no dio el link de una página.';
  return textoClaude('tarea-ficha', { carpeta: rel, datos: JSON.stringify(datos, null, 2), fotos, pagina });
}

// Campos que el usuario puede corregir o contestar, y a donde van las respuestas con otro nombre.
const CAMPOS_TEXTO = ['nombre', 'queEs', 'publico', 'dolor', 'oferta', 'comoCompra', 'idioma', 'mercado', 'pais', 'probo', 'prueba', 'ingredientes', 'comoSeUsa'];
const SINONIMOS = { precio: 'oferta', garantia: 'oferta', envio: 'oferta', descuento: 'oferta', resenas: 'prueba', 'reseñas': 'prueba', testimonios: 'prueba', dosis: 'comoSeUsa', modoDeUso: 'comoSeUsa', uso: 'comoSeUsa', objecion: 'probo' };

/** Revisa ficha.json contra su esquema y la deja prolija (como mucho 3 preguntas, el tipo que eligio el usuario). */
export function verificarFicha(id) {
  const ruta = path.join(PRODUCTOS, id, 'ficha.json');
  const v = leerYValidar(ruta, 'ficha');
  if (!v.ok) return { ok: false, errores: v.errores };
  const f = v.datos;
  const p = leerProducto(id);
  if (p?.tipo && TIPOS.includes(p.tipo)) f.tipo = p.tipo; // lo eligio el usuario
  const vistos = new Set();
  f.falta = (f.falta || []).filter((x) => x?.campo && !vistos.has(x.campo) && vistos.add(x.campo)).slice(0, 3);
  f.deducido = [...new Set((f.deducido || []).filter((x) => typeof x === 'string'))];
  f.beneficios = (f.beneficios || []).map((x) => String(x).trim()).filter(Boolean);
  escribirJSON(ruta, f);
  return { ok: true };
}

/**
 * POST /api/productos/:id/analizar: baja la pagina (si hay link) y lanza la sesion "ficha". No espera: devuelve la
 * tarea y el avance se lee con estadoProducto(). Con `retomar`, sigue la misma conversacion de Claude.
 */
export function analizarProducto(id, { retomar = false } = {}) {
  const p = leerProducto(id);
  if (!p) throw new ErrorApp(404, 'No encuentro ese producto.');
  const previa = leerTarea(id);
  if (enMarcha.has(id) || (previa?.uuid && sesionActiva(previa.uuid))) return { tarea: previa?.id || null, yaEstaba: true };
  if (!retomar && !p.url && !(p.fotos || []).length && !p.descripcion && !p.nombre) {
    throw new ErrorApp(400, 'Cuéntame algo de tu producto: pega el link de su página, sube una foto o escribe qué es.');
  }
  const uuid = retomar && previa?.uuid ? previa.uuid : crypto.randomUUID();
  const tarea = {
    id: uuid,
    uuid,
    estado: 'analizando',
    paso: p.url ? 'pagina' : 'claude',
    progreso: retomar ? (previa?.progreso || []).slice(-20) : [],
    intentos: (previa?.intentos || 0) + 1,
    inicio: retomar && previa?.inicio ? previa.inicio : ahora(),
    error: null,
  };
  guardarTarea(id, tarea);
  const promesa = correrAnalisis(id, tarea, { retomar })
    .catch((e) => {
      console.error('[productos] analisis:', e);
      guardarTarea(id, { ...tarea, estado: 'error', fin: ahora(), error: { mensaje: 'Algo salió mal al armar la ficha. Toca "Reintentar".', tipo: 'otro', detalle: String(e.message || e).slice(0, 400) } });
    })
    .finally(() => enMarcha.delete(id));
  enMarcha.set(id, promesa);
  return { tarea: tarea.id };
}

async function correrAnalisis(id, tarea, { retomar }) {
  const dir = path.join(PRODUCTOS, id);
  const avanzar = (f) => {
    if (!f) return;
    if (tarea.progreso[tarea.progreso.length - 1] !== f) tarea.progreso.push(f);
    tarea.progreso = tarea.progreso.slice(-30);
    guardarTarea(id, tarea);
  };
  const p = leerProducto(id);

  // 1. la pagina (la baja la app: Claude no tiene internet)
  if (p.url && (!retomar || !existe(path.join(dir, 'pagina.txt')))) {
    avanzar('Bajando el texto de tu página');
    const pagina = await bajarPagina(p.url);
    if (pagina.ok) {
      fs.writeFileSync(path.join(dir, 'pagina.txt'), pagina.texto, 'utf8');
      tarea.pagina = { ok: true, caracteres: pagina.caracteres, tienda: pagina.shopify ? 'shopify' : null };
      if (!(leerProducto(id).fotos || []).length && pagina.imagenes.length) {
        avanzar('Bajando las fotos de tu página');
        const n = await fotosDeLaPagina(id, pagina.imagenes);
        if (n) tarea.pagina.fotos = n;
      }
    } else {
      fs.rmSync(path.join(dir, 'pagina.txt'), { force: true });
      tarea.pagina = { ok: false, motivo: pagina.motivo };
      avanzar('No pude leer tu página: sigo con lo que me contaste');
    }
  }

  // 2. Claude arma la ficha. La anterior (con lo que haya corregido el usuario) queda de respaldo.
  tarea.paso = 'claude';
  guardarTarea(id, tarea);
  const ficha = path.join(dir, 'ficha.json');
  if (!retomar && existe(ficha)) fs.renameSync(ficha, path.join(dir, 'ficha-anterior.json'));
  const r = await lanzarSesion({
    ...armarSesionFicha(id, { retomar }),
    uuid: tarea.uuid,
    alProgreso: avanzar,
    registro: path.join(dir, 'registro', 'ficha.log'),
  });
  const fin = { ...tarea, fin: ahora(), medida: { turnos: r.turnos, duracionMs: r.duracionMs, uso: r.uso, costoEstimado: r.costo, modelo: r.init?.modelo || null, motor: r.motor || null }, denegados: r.denegados?.length ? r.denegados : undefined };
  if (r.ok) guardarTarea(id, { ...fin, estado: 'lista', paso: null, error: null });
  else {
    // una ficha a medias no se muestra; si no quedo una buena, vuelve la anterior (con lo que el usuario corrigio)
    if (existe(ficha) && !leerYValidar(ficha, 'ficha').ok) fs.renameSync(ficha, path.join(dir, 'ficha-incompleta.json'));
    if (!existe(ficha) && existe(path.join(dir, 'ficha-anterior.json'))) fs.renameSync(path.join(dir, 'ficha-anterior.json'), ficha);
    guardarTarea(id, { ...fin, estado: 'error', error: errorPublico(r), limite: !!r.limite, reinicio: r.reinicio || null });
  }
}

/**
 * El error de una sesion, como lo lee la pantalla: { mensaje, tipo, detalle? }. tipo 'plan-sin-codex': el plan de
 * ChatGPT no incluye Codex o no le queda uso (no se retoma solo). Sin mensaje, el de la IA que trabajo (r.motor).
 */
export function errorPublico(r) {
  const tipo = r.planSinCodex ? 'plan-sin-codex' : r.sinMotor ? 'sin-motor' : r.limite ? 'limite' : r.sinClaude ? 'sin-claude' : r.sinSesion ? 'sin-sesion' : r.bloqueado ? 'bloqueo' : r.tiempo || r.colgado ? 'tiempo' : r.verificacion ? 'no-valido' : r.cancelado ? 'cancelada' : 'otro';
  return { mensaje: r.error || `${laIA(r.motor)} no terminó bien la tarea. Toca "Reintentar".`, tipo, ...(r.motor ? { motor: r.motor } : {}), ...(r.faltan ? { faltan: r.faltan } : {}), ...(r.detalle ? { detalle: String(r.detalle).slice(0, 600) } : {}) };
}

// ---------------------------------------------------------------- lo que lee la pantalla

/** GET /api/productos/:id -> { producto, ficha, tarea } */
export function estadoProducto(id) {
  const p = leerProducto(id);
  if (!p) return null;
  const t = leerTarea(id);
  // la app se cerro mientras trabajaba y todavia no retomo: se muestra como que sigue (retomarFichas la relanza)
  const tarea = t
    ? { id: t.id, estado: t.estado, paso: t.paso || null, progreso: t.progreso || [], error: t.error || null, limite: !!t.limite, reinicio: t.reinicio || null, inicio: t.inicio || null, fin: t.fin || null, pagina: t.pagina || null, motor: t.medida?.motor || t.error?.motor || null }
    : { estado: 'sin', progreso: [], error: null };
  return {
    producto: { ...p, imagenes: (p.fotos || []).map((f) => ({ n: Number(f.match(/(\d+)\./)?.[1]), archivo: f, url: urlFoto(id, Number(f.match(/(\d+)\./)?.[1])), deLaPagina: (p.fotosDeLaPagina || []).includes(f) })) },
    ficha: t?.estado === 'analizando' ? null : leerFicha(id),
    tarea,
  };
}

/**
 * PUT /api/productos/:id/ficha { correcciones?: {campo: valor}, respuestas?: {campo: valor} }
 * Lo que corrige o contesta el usuario manda: deja de figurar como "deducido" y sale de "falta".
 */
export function corregirFicha(id, cuerpo = {}) {
  if (!leerProducto(id)) throw new ErrorApp(404, 'No encuentro ese producto.');
  if (leerTarea(id)?.estado === 'analizando' || enMarcha.has(id)) throw new ErrorApp(409, `${laIA()} todavía está armando la ficha. Espera a que termine.`);
  const ruta = path.join(PRODUCTOS, id, 'ficha.json');
  const f = leerJSON(ruta);
  if (!f) throw new ErrorApp(409, 'Todavía no hay ficha de este producto.');
  const correcciones = cuerpo.correcciones && typeof cuerpo.correcciones === 'object' ? cuerpo.correcciones : cuerpo.campos && typeof cuerpo.campos === 'object' ? cuerpo.campos : {};
  const respuestas = cuerpo.respuestas && typeof cuerpo.respuestas === 'object' ? cuerpo.respuestas : {};
  const esquema = cargarEsquema('ficha');
  const tope = (campo) => esquema.properties?.[campo]?.maxLength || 3000;
  // Lo que decia cada campo antes de la primera respuesta (lo que escribio Claude). Cada respuesta se suma a eso:
  // guardar otra vez no la repite.
  const previos = f.previos && typeof f.previos === 'object' ? { ...f.previos } : {};
  const respondidos = new Map(); // campo -> respuestas que van a ese campo, en orden
  const aplicar = (campoPedido, valor, donde) => {
    const campo = SINONIMOS[campoPedido] || campoPedido;
    f[donde] = { ...(f[donde] || {}), [campoPedido]: typeof valor === 'string' ? valor.slice(0, 3000) : valor };
    if (campo === 'beneficios') {
      const lista = Array.isArray(valor) ? valor : String(valor || '').split(/\r?\n|•/);
      f.beneficios = lista.map((x) => String(x).replace(/^[-*\s]+/, '').trim()).filter(Boolean).slice(0, 12);
    } else if (CAMPOS_TEXTO.includes(campo)) {
      const texto = String(valor ?? '').trim();
      if (donde === 'respuestas') {
        // una respuesta se suma a lo que ya decia el campo (la garantia en la oferta no borra el precio)
        if (!Object.hasOwn(previos, campo)) previos[campo] = String(f[campo] ?? '').trim();
        respondidos.set(campo, [...(respondidos.get(campo) || []), texto]);
        f[campo] = [previos[campo], ...respondidos.get(campo)].filter(Boolean).reduce((a, b) => `${a.replace(/[.\s]+$/, '')}. ${b}`).slice(0, tope(campo));
      } else f[campo] = texto.slice(0, tope(campo));
    } else if (campo === 'tipo' && TIPOS.includes(valor)) f.tipo = valor;
    f.deducido = (f.deducido || []).filter((x) => x !== campo && x !== campoPedido);
    f.falta = (f.falta || []).filter((x) => x?.campo !== campo && x?.campo !== campoPedido);
  };
  // Primero las respuestas y despues las correcciones: lo que corregiste a mano es lo que queda (y lo que ves).
  for (const [k, v] of Object.entries(respuestas)) if (/^[\wñ]{1,60}$/i.test(k) && String(v ?? '').trim()) aplicar(k, v, 'respuestas');
  for (const [k, v] of Object.entries(correcciones)) if (/^[\wñ]{1,60}$/i.test(k)) aplicar(k, v, 'correcciones');
  if (Object.keys(previos).length) f.previos = previos;
  f.revisada = ahora();
  const errores = validarEsquema(f, cargarEsquema('ficha'));
  if (errores.length) throw new ErrorApp(400, 'Algún dato de la ficha quedó mal escrito. Revísalo.', { detalle: errores.slice(0, 5) });
  if (f.tipo && TIPOS.includes(f.tipo)) {
    const p = leerProducto(id);
    if (p.tipo !== f.tipo) escribirJSON(path.join(PRODUCTOS, id, 'producto.json'), { ...p, tipo: f.tipo });
  }
  return escribirJSON(ruta, f);
}

/** GET /api/productos -> los productos ya cargados (para no volver a cargarlos en cada anuncio). */
export function listarProductos() {
  return listar(PRODUCTOS)
    .filter((id) => idValido(id))
    .map((id) => {
      const p = leerProducto(id);
      const f = leerFicha(id);
      const t = leerTarea(id);
      const primera = (p.fotos || [])[0];
      return {
        id,
        nombre: f?.nombre || p.nombre || (p.url ? new URL(p.url).hostname.replace(/^www\./, '') : 'Producto sin nombre'),
        tipo: p.tipo,
        foto: primera ? urlFoto(id, Number(primera.match(/(\d+)\./)?.[1])) : null,
        fichaLista: Boolean(f) && t?.estado !== 'analizando',
        estado: t?.estado || 'sin',
        creado: p.creado || null,
      };
    })
    .sort((a, b) => String(b.creado).localeCompare(String(a.creado)));
}

/** Al abrir la app: lo que quedo analizandose cuando se cerro sigue solo, en la misma conversacion. */
export function retomarFichas() {
  for (const id of listar(PRODUCTOS)) {
    if (!idValido(id)) continue;
    const t = leerTarea(id);
    if (t?.estado !== 'analizando' || enMarcha.has(id)) continue;
    if (!esDeEstaApp(leerProducto(id))) continue; // el de una app de prueba lo sigue esa (y al reves)
    try {
      analizarProducto(id, { retomar: true });
      console.log(`[productos] retomo la ficha de ${id}`);
    } catch (e) {
      console.error(`[productos] no pude retomar ${id}: ${e.message}`);
    }
  }
}

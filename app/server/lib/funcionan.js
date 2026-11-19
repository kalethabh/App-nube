// LO QUE ME FUNCIONA: los creativos propios que el usuario marcó como ganadores (imágenes de un lote de «Anuncios de
// imagen» y videos terminados), para filtrarlos y elegirlos después en «Anuncios de imagen → Variantes», donde salen
// variantes que conservan su esencia. No tiene que ver con «Mejores anuncios» (lib/ganadores.js, los de TrendTrack).
//
//   temp/_funcionan/lista.json          { items: [{ id, tipo: 'imagen'|'video', origen, productoId, producto, titulo,
//                                                    imagen: 'img/<id>.jpg', fecha }] }
//   temp/_funcionan/img/<id>.jpg|png    una copia de la imagen (del video: un cuadro del gancho, con su texto), así
//                                        sigue aunque se borre el lote o el anuncio
//
//   temp/_funcionan/videos/<id>.mp4     (2026-11-19h) un video que SUBISTE (el de un anuncio de la app no se copia)
//
//   listar({ tipo?, productoId? }) · marcar({ tipo, lote?, pieza?, slug? }) · quitar(id) · origenes()
//   subir(bytes, { nombre, tipo, productoId, titulo, concepto })   un anuncio tuyo que ya funciona, desde tu PC
//   editar(id, { concepto?, titulo?, productoId? })                 el concepto creativo (por qué vende): las Variantes lo conservan
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { TEMP, OUTPUT } from './rutas.js';
import { leerJSON, existe } from './archivos.js';
import { ErrorApp, escribirJSON, leerProducto } from './productos.js';
import { rutaFfmpeg } from './miniaturas.js';
import { resumenAnuncio, slugValido } from './anuncios.js';

const DIR = path.join(TEMP, '_funcionan');
const LISTA = path.join(DIR, 'lista.json');
const IMG = path.join(DIR, 'img');
const VIDEOS = path.join(DIR, 'videos');

const leerLista = () => {
  const j = leerJSON(LISTA);
  return Array.isArray(j?.items) ? j.items : [];
};
const guardarLista = (items) => escribirJSON(LISTA, { items });
const claveDe = (o) => (o?.subido ? `subido:${o.subido}` : o?.slug ? `video:${o.slug}` : `imagen:${o?.lote}:${o?.pieza}`);
const urlDe = (x) => `/archivos/funcionan/${encodeURIComponent(path.basename(x.imagen))}`;
const urlVideoDe = (x) => (x?.video ? `/archivos/funcionan/videos/${encodeURIComponent(path.basename(x.video))}` : null);

/** Lo marcado, lo más nuevo primero, con su url. Filtros opcionales: tipo ('imagen'|'video') y productoId. */
export function listar({ tipo = null, productoId = null } = {}) {
  return leerLista()
    .filter((x) => (!tipo || x.tipo === tipo) && (!productoId || x.productoId === productoId) && existe(path.join(DIR, x.imagen)))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
    .map((x) => ({ ...x, url: urlDe(x), ...(x.video ? { urlVideo: urlVideoDe(x) } : {}), clave: claveDe(x.origen) }));
}

/** La ruta en disco de la imagen de un item de listar() (para copiarla a un lote), o null. */
export const rutaDeImagen = (x) => (x?.imagen && /^img\/[a-z0-9-]+\.(jpg|png)$/.test(x.imagen) && existe(path.join(DIR, x.imagen)) ? path.join(DIR, x.imagen) : null);

/** Las claves marcadas ('imagen:<lote>:<pieza>' / 'video:<slug>'), para pintar el botón como activo. */
export const origenes = () => leerLista().map((x) => claveDe(x.origen));

/** El video que subiste (lo sirve /archivos/funcionan/videos/<nombre>), o null. */
export function archivoVideo(nombre) {
  if (!/^[a-z0-9-]+\.(mp4|mov|webm|m4v)$/.test(String(nombre))) return null;
  const abs = path.join(VIDEOS, nombre);
  return existe(abs) ? abs : null;
}

/** El archivo de una imagen marcada (lo sirve /archivos/funcionan/<nombre>), o null. */
export function archivo(nombre) {
  if (!/^[a-z0-9-]+\.(jpg|png)$/.test(String(nombre))) return null;
  const abs = path.join(IMG, nombre);
  return existe(abs) ? abs : null;
}

const loteValido = (l) => /^_img-[a-z0-9-]+$/.test(String(l || ''));
const piezaValida = (p) => /^V\d{2,3}_(1x1|9x16)$/.test(String(p || ''));

function cuadroDelVideo(mp4, destino) {
  return new Promise((ok) => {
    execFile(rutaFfmpeg(), ['-y', '-ss', '1.2', '-i', mp4, '-frames:v', '1', '-q:v', '3', destino], { timeout: 60000, windowsHide: true }, (err) => ok(!err && existe(destino)));
  });
}

/** Marca un creativo como «me funciona». Imagen: { tipo: 'imagen', lote, pieza: 'V03_1x1' }. Video: { tipo: 'video', slug }. */
export async function marcar(cuerpo = {}) {
  const tipo = cuerpo.tipo === 'video' ? 'video' : cuerpo.tipo === 'imagen' ? 'imagen' : null;
  if (!tipo) throw new ErrorApp(400, 'Falta decir si es una imagen o un video.');
  const origen = tipo === 'video' ? { slug: String(cuerpo.slug || '') } : { lote: String(cuerpo.lote || ''), pieza: String(cuerpo.pieza || '') };
  const items = leerLista();
  const ya = items.find((x) => claveDe(x.origen) === claveDe(origen));
  if (ya) return { ...ya, url: urlDe(ya), clave: claveDe(origen) };
  const id = crypto.randomBytes(6).toString('hex');
  fs.mkdirSync(IMG, { recursive: true });
  let item;
  if (tipo === 'imagen') {
    if (!loteValido(origen.lote) || !piezaValida(origen.pieza)) throw new ErrorApp(400, 'Esa imagen no es de un lote.');
    const carpeta = path.join(TEMP, origen.lote);
    const fuente = [path.join(carpeta, 'final', `${origen.pieza}.png`), path.join(carpeta, 'img', `${origen.pieza}.png`)].find(existe);
    if (!fuente) throw new ErrorApp(404, 'Esa imagen todavía no está lista.');
    const brief = leerJSON(path.join(carpeta, 'app', 'brief.json')) || {};
    const plan = leerJSON(path.join(carpeta, 'plan.json'));
    const v = origen.pieza.split('_')[0];
    const titular = (plan?.variaciones || []).find((x) => x.id === v)?.titular || '';
    const rel = `img/${id}.png`;
    fs.copyFileSync(fuente, path.join(DIR, rel));
    item = { id, tipo, origen, productoId: brief.productoId || null, producto: brief.datos?.nombre || brief.titulo || '', titulo: String(titular).slice(0, 200), formato: origen.pieza.endsWith('9x16') ? '9:16' : '1:1', imagen: rel };
  } else {
    if (!slugValido(origen.slug)) throw new ErrorApp(400, 'Ese anuncio no existe.');
    const r = resumenAnuncio(origen.slug);
    if (!r) throw new ErrorApp(404, 'No encuentro ese anuncio.');
    const brief = leerJSON(path.join(TEMP, origen.slug, 'app', 'brief.json')) || {};
    const producto = brief.productoId ? leerProducto(brief.productoId) : null;
    const rel = `img/${id}.jpg`;
    const mp4 = r.video && r.video.startsWith('/archivos/salida/') ? path.join(OUTPUT, decodeURIComponent(r.video.slice('/archivos/salida/'.length).split('?')[0])) : null;
    let ok = mp4 && existe(mp4) ? await cuadroDelVideo(mp4, path.join(DIR, rel)) : false;
    if (!ok) {
      // sin video terminado: la imagen de la primera toma
      const m = leerJSON(path.join(TEMP, origen.slug, 'manifiesto.json'));
      const primera = (m?.tomas || [])[0]?.id;
      const img = [primera && path.join(TEMP, origen.slug, 'img', `toma-${String(primera).replace(/^toma-/, '')}.png`), path.join(TEMP, origen.slug, 'img', 'toma-1.png')].filter(Boolean).find(existe);
      if (!img) throw new ErrorApp(404, 'Ese anuncio todavía no tiene video ni imágenes.');
      fs.copyFileSync(img, path.join(DIR, `img/${id}.png`));
      item = { imagen: `img/${id}.png` };
      ok = true;
    }
    item = { id, tipo, origen, productoId: brief.productoId || null, producto: producto?.nombre || r.titulo || '', titulo: r.titulo || '', estilo: r.estiloNombre || '', formato: r.formato || '9:16', imagen: rel, ...(item || {}) };
  }
  item.fecha = new Date().toISOString();
  guardarLista([...items, item]);
  return { ...item, url: urlDe(item), clave: claveDe(origen) };
}

// ---------------------------------------------------------------- SUBIR lo que ya te funciona (2026-11-19h)

const MAXIMO_SUBIDA = 300 * 1024 * 1024;
const EXT_IMAGEN = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png' };
const EXT_VIDEO = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-m4v': 'm4v' };
const textoCorto = (t, n) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

const correr = (cmd, args) => new Promise((ok) => execFile(cmd, args, { timeout: 120000, windowsHide: true }, (err) => ok(!err)));
// (el ffmpeg de Remotion no lee WEBP ni HEIC: si falla, el del sistema)
async function ffmpeg(args) {
  return (await correr(rutaFfmpeg(), args)) || (await correr(process.env.FFMPEG_BIN || 'ffmpeg', args));
}
/** Una imagen cualquiera a JPG: ffmpeg y, en la Mac, sips (lee HEIC de iPhone). */
async function aJpg(origen, destino) {
  if (await ffmpeg(['-y', '-i', origen, '-frames:v', '1', '-q:v', '2', destino])) return true;
  return process.platform === 'darwin' ? correr('sips', ['-s', 'format', 'jpeg', origen, '--out', destino]) : false;
}
/** '1:1' si es casi cuadrada, '9:16' si no (lo que pide «Variantes»). */
function formatoDe(abs) {
  return new Promise((ok) => {
    execFile(process.env.FFPROBE_BIN || 'ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', abs], { timeout: 30000, windowsHide: true }, (err, out) => {
      const [w, h] = String(out || '').trim().split(',').map(Number);
      ok(!err && w > 0 && h > 0 && w / h >= 0.9 ? '1:1' : '9:16');
    });
  });
}
function nombreDelProducto(productoId) {
  if (!productoId || !/^[a-z0-9][a-z0-9-]{0,80}$/.test(productoId)) return null;
  const p = leerProducto(productoId);
  return p ? p.nombre || 'Tu producto' : null;
}

/**
 * Un anuncio tuyo que ya funciona, subido desde tu PC: una imagen (jpg, png o webp, que se pasa a jpg) o un video
 * (se guarda y su imagen es un cuadro del gancho). Queda en «Lo que me funciona» (también en Biblioteca).
 */
export async function subir(bytes, { nombre = '', tipo = '', productoId = null, titulo = '', concepto = '' } = {}) {
  if (!Buffer.isBuffer(bytes) || !bytes.length) throw new ErrorApp(400, 'No llegó ningún archivo.');
  if (bytes.length > MAXIMO_SUBIDA) throw new ErrorApp(413, 'Ese archivo pesa más de 300 MB.');
  const mime = String(tipo || '').toLowerCase().split(';')[0].trim();
  const esVideo = mime.startsWith('video/');
  const esImagen = mime.startsWith('image/');
  if (!esVideo && !esImagen) throw new ErrorApp(400, 'Sube una imagen (JPG, PNG o WEBP) o un video (MP4 o MOV).');
  const id = crypto.randomBytes(6).toString('hex');
  fs.mkdirSync(IMG, { recursive: true });
  let imagen;
  let video = null;
  let formato;
  if (esImagen) {
    const ext = EXT_IMAGEN[mime];
    if (ext) {
      imagen = `img/${id}.${ext}`;
      fs.writeFileSync(path.join(DIR, imagen), bytes);
    } else {
      // webp, heic u otra: se pasa a jpg con ffmpeg
      const tmp = path.join(IMG, `${id}.subida`);
      fs.writeFileSync(tmp, bytes);
      imagen = `img/${id}.jpg`;
      const ok = await aJpg(tmp, path.join(DIR, imagen));
      fs.rmSync(tmp, { force: true });
      if (!ok || !existe(path.join(DIR, imagen))) throw new ErrorApp(400, 'No pude abrir esa imagen. Prueba con un JPG o un PNG.');
    }
    formato = await formatoDe(path.join(DIR, imagen));
  } else {
    fs.mkdirSync(VIDEOS, { recursive: true });
    video = `videos/${id}.${EXT_VIDEO[mime] || 'mp4'}`;
    const abs = path.join(DIR, video);
    fs.writeFileSync(abs, bytes);
    imagen = `img/${id}.jpg`;
    // el cuadro del gancho (a los 1,2 s; si el video es más corto, el primero)
    const ok = (await cuadroDelVideo(abs, path.join(DIR, imagen))) || (await ffmpeg(['-y', '-i', abs, '-frames:v', '1', '-q:v', '3', path.join(DIR, imagen)]));
    if (!ok || !existe(path.join(DIR, imagen))) {
      fs.rmSync(abs, { force: true });
      throw new ErrorApp(400, 'No pude abrir ese video. Prueba con un MP4.');
    }
    formato = await formatoDe(abs);
  }
  const pid = nombreDelProducto(productoId) ? productoId : null;
  const item = {
    id,
    tipo: esVideo ? 'video' : 'imagen',
    origen: { subido: id },
    subido: true,
    productoId: pid,
    producto: pid ? nombreDelProducto(pid) : '',
    titulo: textoCorto(titulo || String(nombre).replace(/\.[a-z0-9]+$/i, ''), 200),
    concepto: textoCorto(concepto, 500),
    formato,
    imagen,
    ...(video ? { video } : {}),
    fecha: new Date().toISOString(),
  };
  guardarLista([...leerLista(), item]);
  return { ...item, url: urlDe(item), ...(video ? { urlVideo: urlVideoDe(item) } : {}), clave: claveDe(item.origen) };
}

/** Cambia el concepto creativo (por qué vende), el título o el producto de algo que te funciona. */
export function editar(id, { concepto, titulo, productoId } = {}) {
  const items = leerLista();
  const x = items.find((i) => i.id === id);
  if (!x) throw new ErrorApp(404, 'No encuentro ese anuncio.');
  if (concepto !== undefined) x.concepto = textoCorto(concepto, 500);
  if (titulo !== undefined) x.titulo = textoCorto(titulo, 200);
  if (productoId !== undefined) {
    const nombre = nombreDelProducto(productoId);
    x.productoId = nombre ? productoId : null;
    x.producto = nombre || '';
  }
  guardarLista(items);
  return { ...x, url: urlDe(x), ...(x.video ? { urlVideo: urlVideoDe(x) } : {}), clave: claveDe(x.origen) };
}

/** Quita la marca (por id o por clave de origen). */
export function quitar(idOClave) {
  const items = leerLista();
  const x = items.find((i) => i.id === idOClave || claveDe(i.origen) === idOClave);
  if (!x) return { ok: true };
  fs.rmSync(path.join(DIR, x.imagen), { force: true });
  if (x.video && /^videos\/[a-z0-9-]+\.(mp4|mov|webm|m4v)$/.test(x.video)) fs.rmSync(path.join(DIR, x.video), { force: true });
  guardarLista(items.filter((i) => i !== x));
  return { ok: true };
}

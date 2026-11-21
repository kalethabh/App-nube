// CARPETAS DE PRODUCTO (2026-11-21, pedido del usuario): creas una carpeta (por ejemplo «Aguaje»), y desde Anuncios de
// imagen o desde la entrega de un video eliges «Guardar en carpeta». Cada carpeta tiene dos: imagenes/ y videos/. También
// puedes subirle archivos tuyos y descargarla entera en un zip (con las dos carpetas adentro).
//
// En temp/_carpetas/<id>/ (carpeta.json, imagenes/, videos/). Los medios NO van a GitHub (.gitignore): quedan en este
// computador, como los videos de los anuncios.
//
//   listar() · crear({ nombre, productoId }) · leer(id) · renombrar(id, nombre) · borrar(id)
//   guardarArchivo(id, bytes, nombre) · guardarDesde(id, { tipo: 'imagen-lote', lote, pieza } | { tipo: 'video', archivo })
//   quitarArchivo(id, tipo, nombre) · rutaDeArchivo(id, tipo, nombre) · entradasDelZip(id)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { TEMP, OUTPUT } from './rutas.js';
import { leerJSON } from './archivos.js';
import { escribirJSON, ErrorApp } from './productos.js';

const DIR = path.join(TEMP, '_carpetas');
const RE_ID = /^[a-z0-9-]{2,80}$/;
const TIPOS = { imagenes: /\.(png|jpe?g|webp|gif|heic)$/i, videos: /\.(mp4|mov|webm|m4v)$/i };
const MAX_NOMBRE = 60;

const aKebab = (t) =>
  String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

export function carpetaDe(id) {
  if (!RE_ID.test(String(id || ''))) throw new ErrorApp(404, 'No encuentro esa carpeta.');
  const c = path.join(DIR, id);
  if (!fs.existsSync(path.join(c, 'carpeta.json'))) throw new ErrorApp(404, 'No encuentro esa carpeta.');
  return c;
}

/** Un nombre de archivo seguro y que no pisa otro: «foto.png», «foto (2).png»… */
function nombreLibre(dir, nombre) {
  const ext = path.extname(nombre).toLowerCase();
  const base =
    path
      .basename(nombre, path.extname(nombre))
      .normalize('NFC')
      .replace(/[^\p{L}\p{N} ._()-]+/gu, '')
      .trim()
      .slice(0, 80) || 'archivo';
  let n = `${base}${ext}`;
  for (let k = 2; fs.existsSync(path.join(dir, n)); k++) n = `${base} (${k})${ext}`;
  return n;
}

const tipoDe = (nombre) => (TIPOS.imagenes.test(nombre) ? 'imagenes' : TIPOS.videos.test(nombre) ? 'videos' : null);

function contenido(c, tipo) {
  const d = path.join(c, tipo);
  if (!fs.existsSync(d)) return [];
  return fs
    .readdirSync(d)
    .filter((f) => TIPOS[tipo].test(f))
    .map((f) => {
      const st = fs.statSync(path.join(d, f));
      return { nombre: f, bytes: st.size, fecha: st.mtime.toISOString() };
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function listar() {
  if (!fs.existsSync(DIR)) return { carpetas: [] };
  const carpetas = fs
    .readdirSync(DIR)
    .filter((d) => RE_ID.test(d) && fs.existsSync(path.join(DIR, d, 'carpeta.json')))
    .map((d) => {
      const c = path.join(DIR, d);
      const info = leerJSON(path.join(c, 'carpeta.json')) || {};
      const img = contenido(c, 'imagenes');
      const vid = contenido(c, 'videos');
      return { id: d, nombre: info.nombre || d, productoId: info.productoId || null, creada: info.creada || null, imagenes: img.length, videos: vid.length, portada: img[0]?.nombre || null, actualizada: [img[0]?.fecha, vid[0]?.fecha, info.creada].filter(Boolean).sort().pop() || null };
    })
    .sort((a, b) => String(b.actualizada).localeCompare(String(a.actualizada)));
  return { carpetas };
}

export function crear({ nombre, productoId = null } = {}) {
  const n = String(nombre || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOMBRE);
  if (!n) throw new ErrorApp(400, 'Ponle un nombre a la carpeta.');
  if (listar().carpetas.some((x) => x.nombre.toLowerCase() === n.toLowerCase())) throw new ErrorApp(409, `Ya tienes una carpeta «${n}».`);
  const id = `${aKebab(n) || 'carpeta'}-${crypto.randomBytes(2).toString('hex')}`;
  const c = path.join(DIR, id);
  fs.mkdirSync(path.join(c, 'imagenes'), { recursive: true });
  fs.mkdirSync(path.join(c, 'videos'), { recursive: true });
  escribirJSON(path.join(c, 'carpeta.json'), { nombre: n, productoId: productoId ? String(productoId) : null, creada: new Date().toISOString() });
  return leer(id);
}

export function leer(id) {
  const c = carpetaDe(id);
  const info = leerJSON(path.join(c, 'carpeta.json')) || {};
  return { id, nombre: info.nombre || id, productoId: info.productoId || null, creada: info.creada || null, imagenes: contenido(c, 'imagenes'), videos: contenido(c, 'videos') };
}

export function renombrar(id, nombre) {
  const c = carpetaDe(id);
  const n = String(nombre || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOMBRE);
  if (!n) throw new ErrorApp(400, 'Ponle un nombre a la carpeta.');
  const info = leerJSON(path.join(c, 'carpeta.json')) || {};
  escribirJSON(path.join(c, 'carpeta.json'), { ...info, nombre: n });
  return leer(id);
}

export function borrar(id) {
  fs.rmSync(carpetaDe(id), { recursive: true, force: true });
  return listar();
}

/** Un archivo que subiste (imagen o video). */
export function guardarArchivo(id, bytes, nombre) {
  const c = carpetaDe(id);
  const tipo = tipoDe(String(nombre || ''));
  if (!tipo) throw new ErrorApp(400, 'Solo imágenes (JPG, PNG, WEBP, GIF) o videos (MP4, MOV, WEBM).');
  if (!bytes?.length) throw new ErrorApp(400, 'El archivo llegó vacío.');
  const dir = path.join(c, tipo);
  fs.mkdirSync(dir, { recursive: true });
  const final = nombreLibre(dir, String(nombre));
  fs.writeFileSync(path.join(dir, final), bytes);
  return { tipo, nombre: final };
}

/** Desde lo que hizo la app: una imagen de un lote de Anuncios de imagen, o un video terminado (output/). */
export async function guardarDesde(id, desde = {}) {
  const c = carpetaDe(id);
  if (desde.tipo === 'imagen-lote') {
    const { carpetaDe: carpetaLote, R } = await import('./imagen-ads/disco.js');
    if (!/^V\d{2,3}_(1x1|9x16)$/.test(String(desde.pieza || '')) || !/^_?[a-z0-9-]{3,120}$/.test(String(desde.lote || ''))) throw new ErrorApp(400, 'No encuentro esa imagen.');
    const cl = carpetaLote(String(desde.lote || ''));
    const origen = [R.final(cl, desde.pieza), R.img(cl, desde.pieza)].find((f) => fs.existsSync(f));
    if (!origen) throw new ErrorApp(404, 'Esa imagen todavía no está hecha.');
    const brief = leerJSON(R.brief(cl)) || {};
    const nombre = `${aKebab(brief.datos?.nombre || 'imagen') || 'imagen'}-${desde.pieza}.png`;
    const dir = path.join(c, 'imagenes');
    fs.mkdirSync(dir, { recursive: true });
    const final = nombreLibre(dir, nombre);
    fs.copyFileSync(origen, path.join(dir, final));
    return { tipo: 'imagenes', nombre: final };
  }
  if (desde.tipo === 'video') {
    const archivo = path.basename(String(desde.archivo || ''));
    if (!TIPOS.videos.test(archivo)) throw new ErrorApp(400, 'No encuentro ese video.');
    const origen = path.join(OUTPUT, archivo);
    if (!fs.existsSync(origen)) throw new ErrorApp(404, 'No encuentro ese video (¿está en tu nube? Tráelo de vuelta primero).');
    const dir = path.join(c, 'videos');
    fs.mkdirSync(dir, { recursive: true });
    const final = nombreLibre(dir, archivo);
    // (un enlace duro si se puede: no ocupa el doble de espacio)
    try {
      fs.linkSync(origen, path.join(dir, final));
    } catch {
      fs.copyFileSync(origen, path.join(dir, final));
    }
    return { tipo: 'videos', nombre: final };
  }
  throw new ErrorApp(400, 'No sé qué guardar.');
}

export function rutaDeArchivo(id, tipo, nombre) {
  const c = carpetaDe(id);
  if (!TIPOS[tipo]) throw new ErrorApp(404, 'No encuentro ese archivo.');
  const n = path.basename(String(nombre || ''));
  const f = path.join(c, tipo, n);
  if (!TIPOS[tipo].test(n) || !fs.existsSync(f)) throw new ErrorApp(404, 'No encuentro ese archivo.');
  return f;
}

export function quitarArchivo(id, tipo, nombre) {
  fs.rmSync(rutaDeArchivo(id, tipo, nombre), { force: true });
  return leer(id);
}

/** Lo que va en el zip: «<carpeta>/imagenes/…» y «<carpeta>/videos/…». */
export function entradasDelZip(id) {
  const l = leer(id);
  const c = carpetaDe(id);
  const raiz = l.nombre.replace(/[\\/:*?"<>|]+/g, '-');
  return {
    nombre: raiz,
    entradas: [
      ...l.imagenes.map((x) => ({ nombre: `${raiz}/imagenes/${x.nombre}`, origen: path.join(c, 'imagenes', x.nombre) })),
      ...l.videos.map((x) => ({ nombre: `${raiz}/videos/${x.nombre}`, origen: path.join(c, 'videos', x.nombre) })),
    ],
  };
}

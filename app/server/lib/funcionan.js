// LO QUE ME FUNCIONA: los creativos propios que el usuario marcó como ganadores (imágenes de un lote de «Anuncios de
// imagen» y videos terminados), para filtrarlos y elegirlos después en «Anuncios de imagen → Variantes», donde salen
// variantes que conservan su esencia. No tiene que ver con «Mejores anuncios» (lib/ganadores.js, los de TrendTrack).
//
//   temp/_funcionan/lista.json          { items: [{ id, tipo: 'imagen'|'video', origen, productoId, producto, titulo,
//                                                    imagen: 'img/<id>.jpg', fecha }] }
//   temp/_funcionan/img/<id>.jpg|png    una copia de la imagen (del video: un cuadro del gancho, con su texto), así
//                                        sigue aunque se borre el lote o el anuncio
//
//   listar({ tipo?, productoId? }) · marcar({ tipo, lote?, pieza?, slug? }) · quitar(id) · origenes()
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

const leerLista = () => {
  const j = leerJSON(LISTA);
  return Array.isArray(j?.items) ? j.items : [];
};
const guardarLista = (items) => escribirJSON(LISTA, { items });
const claveDe = (o) => (o?.slug ? `video:${o.slug}` : `imagen:${o?.lote}:${o?.pieza}`);
const urlDe = (x) => `/archivos/funcionan/${encodeURIComponent(path.basename(x.imagen))}`;

/** Lo marcado, lo más nuevo primero, con su url. Filtros opcionales: tipo ('imagen'|'video') y productoId. */
export function listar({ tipo = null, productoId = null } = {}) {
  return leerLista()
    .filter((x) => (!tipo || x.tipo === tipo) && (!productoId || x.productoId === productoId) && existe(path.join(DIR, x.imagen)))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
    .map((x) => ({ ...x, url: urlDe(x), clave: claveDe(x.origen) }));
}

/** Las claves marcadas ('imagen:<lote>:<pieza>' / 'video:<slug>'), para pintar el botón como activo. */
export const origenes = () => leerLista().map((x) => claveDe(x.origen));

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

/** Quita la marca (por id o por clave de origen). */
export function quitar(idOClave) {
  const items = leerLista();
  const x = items.find((i) => i.id === idOClave || claveDe(i.origen) === idOClave);
  if (!x) return { ok: true };
  fs.rmSync(path.join(DIR, x.imagen), { force: true });
  guardarLista(items.filter((i) => i !== x));
  return { ok: true };
}

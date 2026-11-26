// MIS PIEZAS (2026-11-26c). Pedido: «que me permita subirle una referencia o imagen a usar, como sellos, logos, precios».
// Imágenes del usuario que el editor pega EXACTAS sobre un anuncio (y que la IA puede integrar sin redibujarlas):
//   de un producto   temp/_productos/<id>/piezas/<nombre>.<png|jpg|webp>   (su logo, su sello del registro…)
//   generales        mis_archivos/biblioteca/piezas/<nombre>.<ext>           (pago contra entrega, envío gratis…)
//
//   listarPiezas(productoId)          [{ id: 'producto:<nombre>' | 'general:<nombre>', nombre, ambito, url }]
//   guardarPieza(ambito, nombre, buffer, tipo)  -> la pieza
//   borrarPieza(id)
//   rutaPieza(id)                     la ruta absoluta (o null)
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, TEMP, PUERTO_DE_PRUEBA } from '../rutas.js';
import { PRODUCTOS, idValido, ErrorApp } from '../productos.js';

const TIPOS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
// (en las pruebas, las generales van aparte: nunca se tocan las del usuario)
const GENERALES = PUERTO_DE_PRUEBA ? path.join(TEMP, `_modo-prueba-${PUERTO_DE_PRUEBA}`, 'piezas') : path.join(RAIZ, 'mis_archivos', 'biblioteca', 'piezas');
const dirDe = (ambito) => (ambito === 'general' ? GENERALES : idValido(ambito) ? path.join(PRODUCTOS, ambito, 'piezas') : null);
const limpio = (n) =>
  String(n || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

function listar(ambito) {
  const dir = dirDe(ambito);
  if (!dir) return [];
  try {
    return fs
      .readdirSync(dir)
      .filter((n) => /^[a-z0-9-]+\.(png|jpg|webp)$/.test(n))
      .sort()
      .map((n) => ({ id: `${ambito === 'general' ? 'general' : 'producto'}:${ambito === 'general' ? '' : `${ambito}/`}${n}`, nombre: n.replace(/\.[a-z]+$/, '').replace(/-/g, ' '), ambito: ambito === 'general' ? 'general' : 'producto', url: `/api/imagen-ads/piezas/archivo?id=${encodeURIComponent(`${ambito === 'general' ? 'general' : 'producto'}:${ambito === 'general' ? '' : `${ambito}/`}${n}`)}` }));
  } catch {
    return [];
  }
}

export const listarPiezas = (productoId) => [...(productoId && idValido(productoId) ? listar(productoId) : []), ...listar('general')];

/** 'producto:<id>/<archivo>' | 'general:<archivo>' -> ruta absoluta o null. */
export function rutaPieza(id) {
  const m = /^(producto):([a-z0-9-]+)\/([a-z0-9-]+\.(?:png|jpg|webp))$|^(general):([a-z0-9-]+\.(?:png|jpg|webp))$/.exec(String(id || ''));
  if (!m) return null;
  const abs = m[1] ? (idValido(m[2]) ? path.join(PRODUCTOS, m[2], 'piezas', m[3]) : null) : path.join(GENERALES, m[5]);
  return abs && fs.existsSync(abs) ? abs : null;
}

export function guardarPieza(ambito, nombre, datos, tipo) {
  const dir = dirDe(ambito);
  if (!dir) throw new ErrorApp(404, 'No encuentro ese producto.');
  const ext = TIPOS[String(tipo || '').split(';')[0].trim()];
  if (!ext) throw new ErrorApp(400, 'Sube un PNG (mejor con fondo transparente), JPG o WEBP.');
  if (!Buffer.isBuffer(datos) || datos.length < 100) throw new ErrorApp(400, 'La imagen llegó vacía.');
  if (datos.length > 15 * 1024 * 1024) throw new ErrorApp(413, 'La imagen pesa más de 15 MB.');
  const base = limpio(nombre) || 'pieza';
  fs.mkdirSync(dir, { recursive: true });
  let n = base;
  for (let i = 2; fs.existsSync(path.join(dir, `${n}.png`)) || fs.existsSync(path.join(dir, `${n}.jpg`)) || fs.existsSync(path.join(dir, `${n}.webp`)); i++) n = `${base}-${i}`;
  const tmp = path.join(dir, `.${n}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, datos);
  fs.renameSync(tmp, path.join(dir, `${n}.${ext}`));
  return listar(ambito).find((x) => x.id.endsWith(`${n}.${ext}`));
}

export function borrarPieza(id) {
  const abs = rutaPieza(id);
  if (!abs) throw new ErrorApp(404, 'No encuentro esa pieza.');
  fs.rmSync(abs, { force: true });
  return { ok: true };
}

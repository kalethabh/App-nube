// Los videos propios que el usuario sube para reemplazar un clip (editor: «Reemplazar con tu video», 2026-11-09).
//
//   temp/<slug>/video/subidos/<id>.mp4    el video ya normalizado (H.264 yuv420p, AAC, 720x1280, 30 fps, +faststart).
//                                         Va en una subcarpeta: los scripts del motor que recorren video/*.mp4 no lo ven.
//   temp/<slug>/video/subidos/<id>.json   { id, nombre, largo, conAudio, fecha, pieza }
//   temp/<slug>/app/subidos.json          { v: 1, piezas: { 'toma-3': { id, archivo, nombre, fecha, original } } }
//
// subidos.json = las piezas reemplazadas EN EL ANUNCIO (modo «anuncio»: UGC, objeto parlante, podcast y entrevista,
// donde el audio del clip es la voz). `original` = el nombre en historial/ del clip que habia, para «Volver al clip
// original». En los demas estilos el video propio va en la edicion (edicion.json, reemplazos) y no toca el anuncio.
//
//   leerSubidas(carpeta)              -> { 'toma-3': {...} }
//   esSubida(carpeta, pieza)          -> true si esa pieza del anuncio es un video del usuario: la revision no le deja
//                                        avisos ni se regenera sola por nada (ni lo tecnico): es lo que el usuario puso.
//   marcarSubida(carpeta, pieza, d)   (rutas/editor.js, al aplicar el reemplazo; conserva el primer `original`)
//   quitarSubida(carpeta, pieza)      (al volver al clip original o al regenerar la pieza)
import path from 'node:path';
import { leerJSON, escribirJSONSeguro } from './archivos.js';

const ruta = (carpeta) => path.join(carpeta, 'app', 'subidos.json');
const piezaValida = (p) => typeof p === 'string' && /^(toma|broll|paso)-\d+$/.test(p);

export function leerSubidas(carpeta) {
  const d = carpeta ? leerJSON(ruta(carpeta)) : null;
  const piezas = d && typeof d.piezas === 'object' && d.piezas && !Array.isArray(d.piezas) ? d.piezas : {};
  return Object.fromEntries(Object.entries(piezas).filter(([k, v]) => piezaValida(k) && v && typeof v === 'object'));
}

export const esSubida = (carpeta, pieza) => Boolean(leerSubidas(carpeta)[pieza]);

export function marcarSubida(carpeta, pieza, datos) {
  if (!carpeta || !piezaValida(pieza)) return;
  const piezas = leerSubidas(carpeta);
  const antes = piezas[pieza];
  piezas[pieza] = { ...datos, original: antes?.original || datos?.original || null, fecha: new Date().toISOString() };
  escribirJSONSeguro(ruta(carpeta), { v: 1, piezas });
}

export function quitarSubida(carpeta, pieza) {
  if (!carpeta) return;
  const piezas = leerSubidas(carpeta);
  if (!piezas[pieza]) return;
  delete piezas[pieza];
  escribirJSONSeguro(ruta(carpeta), { v: 1, piezas });
}

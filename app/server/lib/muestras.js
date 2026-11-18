// La muestra de cada estilo: el video y la imagen que se ven en Estilos, en Nuevo anuncio, en la portada del
// tablero y en la bienvenida.
//
//   1. Si server/muestras-estilos.json nombra un anuncio que esta en temp/ (la PC de Diego), ese, como siempre.
//   2. Si no, la copia que trae el paquete de la app en app/muestras/<clave>/ (la PC del alumno):
//        video.mp4     el video que se ve
//        imagen.jpg    la imagen de portada (tambien .png o .webp)
//        muestra.json  { "titulo": "Bestdiet · Relax", "duracion": 42.5, "estilo": "<clave>" }
//      Se sirve por /archivos/muestra/<clave>/<archivo> (rutas/archivos.js), solo lectura y sin salir de app/muestras.
//   3. Si no hay ninguna, el estilo se ve sin video de ejemplo.
//
// Una muestra del paquete no es un anuncio del usuario: no tiene slug (no se abre en la Entrega ni en el editor).
import fs from 'node:fs';
import path from 'node:path';
import { APP, TEMP, OUTPUT } from './rutas.js';
import { dentroDe, segmentoValido, stat } from './archivos.js';
import { ESTILOS, muestraDe } from './estilos.js';
import { resumenAnuncio, slugValido } from './anuncios.js';
import { anuncioNuevo } from './anuncios-nuevos.js';

export const MUESTRAS_DIR = path.join(APP, 'muestras');

/** Los unicos archivos que se sirven de una muestra del paquete. */
export const ARCHIVO_DE_MUESTRA = /^(video\.mp4|imagen\.(jpe?g|png|webp))$/i;
const IMAGENES = ['imagen.jpg', 'imagen.jpeg', 'imagen.png', 'imagen.webp'];

const POR_CLAVE = new Map(ESTILOS.map((e) => [e.clave, e]));
// (los especiales de la pantalla Estilos también tienen portada: la hace lib/portadas-estilos.js)
const NOMBRE_ESPECIAL = { cambiar: 'Cambiar el producto', clonacion: 'Clonar un video', ganchos: 'Más ganchos', sketch: 'Sketch de comedia' };
const claveValida = (clave) => typeof clave === 'string' && (POR_CLAVE.has(clave) || Object.hasOwn(NOMBRE_ESPECIAL, clave));

export const urlMuestra = (clave, archivo) => `/archivos/muestra/${encodeURIComponent(clave)}/${encodeURIComponent(archivo)}`;

/** La ruta de un archivo de una muestra del paquete, o null si no es una muestra valida o se sale de app/muestras. */
export function rutaDeArchivoDeMuestra(clave, archivo) {
  if (!claveValida(clave) || !segmentoValido(archivo) || !ARCHIVO_DE_MUESTRA.test(archivo)) return null;
  return dentroDe(MUESTRAS_DIR, [clave, archivo]);
}

function leerMuestraJSON(dir) {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(dir, 'muestra.json'), 'utf8').replace(/^﻿/, ''));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

const esArchivo = (ruta) => Boolean(ruta && stat(ruta)?.isFile());

/** La muestra que trae el paquete para este estilo (app/muestras/<clave>/), o null. */
export function muestraDelPaquete(clave) {
  if (!claveValida(clave)) return null;
  const dir = dentroDe(MUESTRAS_DIR, [clave]);
  if (!dir || !stat(dir)?.isDirectory()) return null;
  const video = esArchivo(path.join(dir, 'video.mp4')) ? 'video.mp4' : null;
  const imagen = IMAGENES.find((n) => esArchivo(path.join(dir, n))) || null;
  if (!video && !imagen) return null;
  const j = leerMuestraJSON(dir);
  const estilo = POR_CLAVE.get(clave) || { nombre: NOMBRE_ESPECIAL[clave] };
  const titulo = typeof j.titulo === 'string' && j.titulo.trim() ? j.titulo.trim().slice(0, 120) : estilo.nombre;
  const duracion = Number(j.duracion);
  return {
    slug: null,
    titulo,
    imagen: imagen ? urlMuestra(clave, imagen) : null,
    video: video ? urlMuestra(clave, video) : null,
    duracion: Number.isFinite(duracion) && duracion > 0 ? Math.round(duracion * 100) / 100 : null,
    estiloNombre: estilo.nombre,
  };
}

/**
 * El titulo con el que se ve el anuncio en Mis anuncios (GET /api/anuncios): el de un anuncio de la app es el nombre
 * de su producto; el de los de siempre, el que lee lib/anuncios.js. Nunca el nombre de la carpeta con su fecha.
 */
function tituloVisible(slug, resumen) {
  try {
    const nuevo = anuncioNuevo(slug);
    if (nuevo?.titulo && nuevo.titulo !== slug) return nuevo.titulo;
  } catch {
    /* sin datos de la app: el de siempre */
  }
  return resumen.titulo;
}

// Un aviso en la consola del servidor (una sola vez por slug) si muestras-estilos.json nombra una carpeta que no
// esta en temp/: se usa la del paquete (si la hay) o el estilo se ve sin video de ejemplo.
const avisados = new Set();

/** El anuncio de temp/ que muestras-estilos.json elige para este estilo (la PC de Diego), o null. */
function slugDeTemp(clave) {
  const slug = muestraDe(clave);
  if (!slug) return null;
  if (slugValido(slug)) return slug;
  if (!avisados.has(slug)) {
    avisados.add(slug);
    console.warn(`[estilos] muestras-estilos.json: "${clave}" apunta a "${slug}", que no esta en temp/ (o no tiene manifiesto.json).`);
  }
  return null;
}

/**
 * La muestra de un estilo para la pantalla:
 *   { slug | null, titulo, imagen, video, duracion, estiloNombre }   o null si no hay ninguna.
 * slug solo cuando es un anuncio de temp/ (se puede abrir); null en la del paquete.
 */
export function muestraDeEstilo(clave) {
  const slug = slugDeTemp(clave);
  const a = slug ? resumenAnuncio(slug) : null;
  if (a) return { slug: a.slug, titulo: tituloVisible(slug, a), imagen: a.miniatura, video: a.video, duracion: a.duracion, estiloNombre: a.estiloNombre };
  return muestraDelPaquete(clave);
}

/** La ruta en disco de una url de /archivos/anuncio/<slug>/... o /archivos/salida/<archivo> (o null). */
function rutaDeUrl(url) {
  if (typeof url !== 'string') return null;
  const partes = url.split('?')[0].split('/').filter(Boolean);
  let dec;
  try {
    dec = partes.map(decodeURIComponent);
  } catch {
    return null;
  }
  if (dec[0] !== 'archivos') return null;
  if (dec[1] === 'salida' && dec.length === 3) return dentroDe(OUTPUT, [dec[2]]);
  if (dec[1] === 'anuncio' && dec.length >= 4) return dentroDe(path.join(TEMP, dec[2]), dec.slice(3));
  return null;
}

/**
 * Para armar el paquete de la app: de cada estilo con una muestra de temp/ (la PC de Diego), lo que hoy se ve en la
 * app, con las rutas en disco del video y de la imagen (la imagen puede ser .png: el empaquetador la pasa a .jpg).
 *   [{ clave, slug, titulo, duracion, estilo, video: <ruta>, imagen: <ruta> | null }]
 * Solo lectura: no toca nada.
 */
export function muestrasParaElPaquete() {
  const fuera = [];
  for (const e of ESTILOS) {
    const slug = slugDeTemp(e.clave);
    const a = slug ? resumenAnuncio(slug) : null;
    if (!a) continue;
    const video = rutaDeUrl(a.video);
    if (!esArchivo(video)) continue;
    const imagen = rutaDeUrl(a.miniatura);
    fuera.push({ clave: e.clave, slug, titulo: tituloVisible(slug, a), duracion: a.duracion, estilo: e.clave, video, imagen: esArchivo(imagen) ? imagen : null });
  }
  return fuera;
}

// VER LO QUE ESTÁ EN LA NUBE sin traerlo de vuelta (2026-11-18x). Pedido: «dejar los anuncios en la nube y ponerlos
// para reproducir, editar y demás cosas que pueda hacer con el video».
//
// Cuando el guardado libera espacio (lib/guardado.js, archivo-nube.js), lo pesado de un anuncio terminado se copia,
// se verifica y se borra de temp/ y output/; temp/<slug>/app/en-la-nube.json dice dónde quedó cada archivo, dentro de
// la carpeta de nube elegida (Google Drive para escritorio, Dropbox, OneDrive o una carpeta sincronizada). Esta carpeta
// se lee como cualquier otra: el programa de la nube baja el archivo al abrirlo. Así un anuncio en la nube se sigue
// viendo, reproduciendo y descargando desde la app; para editar, exportar, rehacer o sacar ganchos se trae de vuelta
// solo (rutas/_nube.js).
//
//   archivoEnNube(slug, rel)    -> la ruta de la copia de temp/<slug>/<rel>, o null
//   finalEnNube(archivo)        -> la ruta de la copia de output/<archivo>, o null
//   finalesEnNube(slug)         -> [{ archivo, abs }]  los MP4/SRT finales de ese anuncio que solo están en la nube
//   enLaNube(slug)              -> true si el anuncio tiene archivos en la nube
import fs from 'node:fs';
import path from 'node:path';
import { TEMP, OUTPUT } from './rutas.js';
import { leerJSON } from './archivos.js';

const SLUG = /^(?:[a-z0-9][a-z0-9-]{2,160}|_img-[a-z0-9-]+)$/;
const relValido = (rel) => typeof rel === 'string' && rel.length > 0 && !rel.includes('\\') && !rel.includes('\0') && !path.posix.isAbsolute(rel) && rel.split('/').every((p) => p && p !== '.' && p !== '..');
const esArchivo = (abs) => {
  try {
    return fs.statSync(abs).isFile();
  } catch {
    return false;
  }
};

export const marca = (slug) => (SLUG.test(String(slug || '')) ? leerJSON(path.join(TEMP, slug, 'app', 'en-la-nube.json')) : null);
export const enLaNube = (slug) => Boolean(marca(slug));

export function archivoEnNube(slug, rel) {
  if (!relValido(rel)) return null;
  const m = marca(slug);
  if (!m) return null;
  const abs = m.ubicaciones?.[rel]?.archivo || ((m.archivos || []).includes(rel) && m.carpeta ? path.join(m.carpeta, ...rel.split('/')) : null);
  return abs && esArchivo(abs) ? abs : null;
}

function ubicacionFinal(m, archivo) {
  return m.ubicacionesFinales?.[archivo]?.archivo || ((m.finales || []).includes(archivo) && m.carpeta ? path.join(path.dirname(m.carpeta), 'videos-finales', archivo) : null);
}

/** El anuncio de un archivo de output/ (<slug>_…): el slug más largo que calce. */
function slugDeFinal(archivo) {
  let candidatos = [];
  try {
    candidatos = fs.readdirSync(TEMP).filter((s) => SLUG.test(s) && archivo.startsWith(`${s}_`));
  } catch {
    return null;
  }
  return candidatos.sort((a, b) => b.length - a.length)[0] || null;
}

export function finalEnNube(archivo) {
  if (!relValido(archivo) || archivo.includes('/')) return null;
  const slug = slugDeFinal(archivo);
  const m = slug ? marca(slug) : null;
  const abs = m ? ubicacionFinal(m, archivo) : null;
  return abs && esArchivo(abs) ? abs : null;
}

export function finalesEnNube(slug) {
  const m = marca(slug);
  if (!m) return [];
  const nombres = new Set([...(m.finales || []), ...Object.keys(m.ubicacionesFinales || {})]);
  return [...nombres]
    .filter((a) => relValido(a) && !a.includes('/') && !esArchivo(path.join(OUTPUT, a)))
    .map((archivo) => ({ archivo, abs: ubicacionFinal(m, archivo) }))
    .filter((x) => x.abs && esArchivo(x.abs));
}

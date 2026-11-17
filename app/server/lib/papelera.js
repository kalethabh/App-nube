// ELIMINAR UN ANUNCIO (Editor y Anuncios, 2026-11-17): se saca de la app sin borrar nada. Su carpeta pasa a
// temp/_descartados/<slug>/ (las carpetas con "_" no se listan) y sus MP4 y subtítulos de output/ van a
// temp/_descartados/<slug>/output/. Si fue sin querer, se recupera moviendo la carpeta de vuelta.
//
//   eliminarAnuncio(slug) -> { ok, eliminado, papelera }
import fs from 'node:fs';
import path from 'node:path';
import { TEMP, OUTPUT } from './rutas.js';
import { existe, listar } from './archivos.js';
import { ErrorApp } from './productos.js';
import { estadoDeLaFila } from './conductor.js';

const PAUSA = new Int32Array(new SharedArrayBuffer(4));

function mover(de, a) {
  // En Windows un archivo abierto un instante (la pantalla lo mira cada pocos segundos) frena el renombre: se reintenta.
  for (let i = 0; ; i++) {
    try {
      fs.renameSync(de, a);
      return;
    } catch (e) {
      if (e.code === 'EXDEV') {
        fs.cpSync(de, a, { recursive: true });
        fs.rmSync(de, { recursive: true, force: true });
        return;
      }
      if (i >= 10 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw new ErrorApp(409, 'No pude mover el anuncio (algún programa lo tiene abierto). Cierra el video si lo estás mirando y vuelve a intentarlo.');
      Atomics.wait(PAUSA, 0, 0, 60 * (i + 1));
    }
  }
}

export function eliminarAnuncio(slug) {
  slug = String(slug || '');
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(slug) || slug.includes('..')) throw new ErrorApp(400, 'Ese anuncio no existe.');
  const carpeta = path.join(TEMP, slug);
  if (!existe(carpeta)) throw new ErrorApp(404, 'No encuentro ese anuncio.');
  const fila = estadoDeLaFila();
  if (fila.activos.includes(slug) || fila.fila.includes(slug)) throw new ErrorApp(409, 'Este anuncio se está produciendo. Detenlo primero y después elimínalo.');
  const papelera = path.join(TEMP, '_descartados');
  fs.mkdirSync(papelera, { recursive: true });
  let destino = path.join(papelera, slug);
  for (let i = 2; existe(destino); i++) destino = path.join(papelera, `${slug}-${i}`);
  mover(carpeta, destino);
  // sus videos y subtítulos terminados (output/<slug>_... o <slug>.mp4)
  const suyos = listar(OUTPUT).filter((n) => n.startsWith(`${slug}_`) || n.startsWith(`${slug}.`));
  if (suyos.length) {
    const salida = path.join(destino, 'output');
    fs.mkdirSync(salida, { recursive: true });
    for (const n of suyos) {
      try {
        mover(path.join(OUTPUT, n), path.join(salida, n));
      } catch {
        /* uno abierto: queda en output/, sin anuncio no se lista */
      }
    }
  }
  console.log(`[papelera] eliminado ${slug} -> ${path.relative(TEMP, destino)}`);
  return { ok: true, eliminado: slug, papelera: path.relative(path.dirname(TEMP), destino) };
}

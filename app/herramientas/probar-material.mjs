// Prueba de «Tus videos e imágenes» (lib/material-propio.js y el motor: produccion/clips-sin-cobro.js), sin gastar:
//   node app/herramientas/probar-material.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { TEMP } from '../server/lib/rutas.js';
import * as m from '../server/lib/material-propio.js';
import { esDeMaterial, imagenPropia, imagenPropiaA, problemaConImagenPropia, problemaConClipDeBiblioteca } from '../../produccion/clips-sin-cobro.js';

const resultados = [];
const check = (nombre, ok, detalle) => {
  resultados.push(Boolean(ok));
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${ok ? '' : `\n      ${JSON.stringify(detalle)?.slice(0, 300)}`}`);
};
const SLUG = `material-demo-${process.pid}`;
const dirTmp = fs.mkdtempSync(path.join(TEMP, '.prueba-material-'));
const subidas = [];
try {
  // un video de 3 s y una imagen
  const mp4 = path.join(dirTmp, 'v.mp4');
  const png = path.join(dirTmp, 'i.png');
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=green:s=360x640:d=3', '-pix_fmt', 'yuv420p', mp4]);
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=pink:s=800x600:d=1', '-frames:v', '1', png]);

  const v = m.guardarSubida(fs.readFileSync(mp4), { nombre: 'mi clip.mp4', tipo: 'video/mp4' });
  const i = m.guardarSubida(fs.readFileSync(png), { nombre: 'antes.png', tipo: 'image/png' });
  subidas.push(v.id, i.id);
  check('se suben un video y una imagen', v.tipo === 'video' && i.tipo === 'imagen' && /^m/.test(v.id), { v, i });
  let error = null;
  try {
    m.guardarSubida(Buffer.alloc(2000), { nombre: 'nota.txt', tipo: 'text/plain' });
  } catch (e) {
    error = e.message;
  }
  check('otra cosa (un texto) no se acepta', /Sube un video/.test(error || ''), error);

  fs.mkdirSync(path.join(TEMP, SLUG), { recursive: true });
  const lista = m.copiarAlAnuncio(SLUG, [{ id: v.id, nota: 'como escena del producto al final' }, { id: i.id, nota: 'en el antes y después' }, { id: 'mnoexiste123' }]);
  const dir = path.join(TEMP, SLUG, 'material');
  check('se copian al anuncio como M01 y M02 (lo que no existe se salta), con su nota', lista.length === 2 && fs.existsSync(path.join(dir, 'M01.mp4')) && fs.existsSync(path.join(dir, 'M02.png')) && lista[1].nota === 'en el antes y después', lista);
  check('el video trae su duración y una hoja de 4 cuadros para que la IA lo vea', lista[0].duracion >= 2.9 && fs.existsSync(path.join(dir, 'M01-vista.jpg')), lista[0]);

  const texto = m.textoMaterial(SLUG);
  check('a la IA le llega qué hay, la nota y cómo usarlo (escena, imagen exacta, referencia)', texto.includes(`temp/${SLUG}/material/M01.mp4`) && texto.includes('como escena del producto al final') && /desde_biblioteca/.test(texto) && /imagen_propia/.test(texto) && /"archivo": "material\/M02.jpg"/.test(texto), texto.slice(0, 300));
  check('sin archivos, nada en la tarea', m.textoMaterial(`${SLUG}-sin`) === '');

  // el motor
  const ruta = (a) => `temp/${SLUG}/material/${a}`;
  check('motor: el material del anuncio se reconoce; otra carpeta no', esDeMaterial(path.join(TEMP, SLUG, 'material', 'M02.png')) && !esDeMaterial(path.join(TEMP, SLUG, 'img', 'x.png')));
  check('motor: un video tuyo vale como escena ("desde_biblioteca")', problemaConClipDeBiblioteca({ desde_biblioteca: ruta('M01.mp4') }) === null && /no encuentro/.test(problemaConClipDeBiblioteca({ desde_biblioteca: ruta('M09.mp4') }) || ''));
  check('motor: "imagen_propia" solo del material y que exista', problemaConImagenPropia({ imagen_propia: ruta('M02.png') }) === null && /material/.test(problemaConImagenPropia({ imagen_propia: `temp/${SLUG}/img/x.png` }) || '') && /no encuentro/.test(problemaConImagenPropia({ imagen_propia: ruta('M07.png') }) || ''));
  const destino = path.join(dirTmp, 'toma-1-inicial.png');
  imagenPropiaA(imagenPropia({ imagen_propia: ruta('M02.png') }), destino);
  const p = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', destino], { encoding: 'utf8' });
  check('motor: tu imagen queda como la imagen de la toma, vertical 1080x1920', p.stdout.trim() === '1080,1920', p.stdout);
} finally {
  fs.rmSync(path.join(TEMP, SLUG), { recursive: true, force: true });
  fs.rmSync(dirTmp, { recursive: true, force: true });
  for (const id of subidas) for (const n of fs.existsSync(m.DIR_SUBIDAS) ? fs.readdirSync(m.DIR_SUBIDAS) : []) if (n.startsWith(`${id}.`)) fs.rmSync(path.join(m.DIR_SUBIDAS, n), { force: true });
  try {
    fs.rmdirSync(m.DIR_SUBIDAS);
  } catch {
    /* tiene otros */
  }
}
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${resultados.length} OK`);
process.exit(ok === resultados.length ? 0 : 1);

// Prueba de «Lo que me funciona»: subir anuncios tuyos que ya venden (imagen y video), su concepto creativo, y que
// las Variantes lo conserven (lib/funcionan.js, imagen-ads/rapido.js). Sin gastar nada:
//   node app/herramientas/probar-funciona-subir.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { TEMP } from '../server/lib/rutas.js';
import * as f from '../server/lib/funcionan.js';
import { prepararRapido } from '../server/lib/imagen-ads/rapido.js';
import { R } from '../server/lib/imagen-ads/disco.js';

const resultados = [];
const check = (nombre, ok, detalle) => {
  resultados.push(Boolean(ok));
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${ok ? '' : `\n      ${JSON.stringify(detalle)?.slice(0, 400)}`}`);
};
const tmp = fs.mkdtempSync(path.join(TEMP, '.prueba-funciona-'));
const lote = path.join(TEMP, `_img-prueba-funciona-${process.pid}`);
const creados = [];
try {
  const png = path.join(tmp, 'a.png');
  const webp = path.join(tmp, 'b.webp');
  const mp4 = path.join(tmp, 'v.mp4');
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=red:s=1080x1080:d=1', '-frames:v', '1', png]);
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=blue:s=1080x1920:d=1', '-frames:v', '1', webp]);
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=green:s=720x1280:d=3', '-pix_fmt', 'yuv420p', mp4]);

  const a = await f.subir(fs.readFileSync(png), { nombre: 'ganador antes y después.png', tipo: 'image/png', concepto: 'Antes y después de la mamá de 40, titular en pregunta' });
  creados.push(a.id);
  check('Se sube una imagen cuadrada, con su concepto y el nombre del archivo como título', a.tipo === 'imagen' && a.formato === '1:1' && a.subido && /Antes y después/.test(a.concepto) && a.titulo === 'ganador antes y después', a);
  const b = await f.subir(fs.readFileSync(webp), { nombre: 'b.webp', tipo: 'image/webp' });
  creados.push(b.id);
  check('Un WEBP vertical se pasa a JPG y queda 9:16', b.imagen.endsWith('.jpg') && b.formato === '9:16', b);
  const v = await f.subir(fs.readFileSync(mp4), { nombre: 'mi video ganador.mp4', tipo: 'video/mp4' });
  creados.push(v.id);
  check('Se sube un video: queda el video y un cuadro del gancho como imagen', v.tipo === 'video' && v.urlVideo && fs.existsSync(f.archivoVideo(path.basename(v.video))) && fs.existsSync(f.rutaDeImagen(v)), v);
  let error = null;
  try {
    await f.subir(Buffer.from('hola'), { nombre: 'x.txt', tipo: 'text/plain' });
  } catch (e) {
    error = e.message;
  }
  check('Un texto no se acepta', /Sube una imagen/.test(error || ''), error);
  check('Los tres quedan en «Lo que me funciona» (la biblioteca)', creados.every((id) => f.listar().some((x) => x.id === id)));
  const e = f.editar(b.id, { concepto: 'Testimonio con la cara y el resultado en grande' });
  check('El concepto se puede escribir después', e.concepto === 'Testimonio con la cara y el resultado en grande' && f.listar().find((x) => x.id === b.id)?.concepto === e.concepto, e);

  // las Variantes conservan el concepto de cada referencia
  fs.mkdirSync(path.join(lote, 'entrada', 'referencias'), { recursive: true });
  fs.copyFileSync(f.rutaDeImagen(a), path.join(lote, 'entrada', 'referencias', 'R01.png'));
  fs.copyFileSync(f.rutaDeImagen(b), path.join(lote, 'entrada', 'referencias', 'R02.jpg'));
  fs.mkdirSync(path.join(lote, 'app'), { recursive: true });
  const brief = { slug: path.basename(lote), modo: 'variantes', cantidad: 2, formatos: ['1:1'], datos: { nombre: 'Crema Prueba', publico: 'Mujeres de 30 a 50', pais: 'Perú' }, referencias: ['entrada/referencias/R01.png', 'entrada/referencias/R02.jpg'], conceptosReferencias: [a.concepto, e.concepto], referenciasPropias: [], rapido: true };
  const r = prepararRapido(lote, brief);
  const v1 = JSON.parse(fs.readFileSync(R.v(lote, 'V01'), 'utf8'));
  const v2 = JSON.parse(fs.readFileSync(R.v(lote, 'V02'), 'utf8'));
  check('Variante 1 lleva el concepto de su referencia (lo conserva; cambia la ejecución y el título)', r.ok && /WINNING CREATIVE CONCEPT[^\n]*Antes y después de la mamá de 40/.test(v1.visual_prompt), v1.visual_prompt);
  check('Variante 2, el de la suya', /WINNING CREATIVE CONCEPT[^\n]*Testimonio con la cara/.test(v2.visual_prompt), v2.visual_prompt);

  for (const id of creados) f.quitar(id);
  check('Se quitan (también el video)', !creados.some((id) => f.listar().some((x) => x.id === id)) && !fs.existsSync(path.join(TEMP, '_funcionan', v.video)));
} catch (e) {
  check('La prueba corre entera', false, String(e?.stack || e));
} finally {
  for (const id of creados) f.quitar(id);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(lote, { recursive: true, force: true });
}
const malas = resultados.filter((x) => !x).length;
console.log(`\n${resultados.length - malas}/${resultados.length} OK`);
process.exit(malas ? 1 : 0);

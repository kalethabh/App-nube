// Prueba de «ver lo que está en la nube» (lib/en-la-nube.js): un anuncio cuyo video final, imágenes y clips ya solo
// están en la carpeta de nube se sigue viendo como listo, con su video, sus imágenes y sus miniaturas, servidos desde
// la copia. Arma un anuncio y una carpeta de nube falsos (se borran al final) y prueba la app de verdad en el puerto 4482:
//   node app/herramientas/probar-nube-ver.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEMP = path.join(RAIZ, 'temp');
const SLUG = `nube-ver-demo-${process.pid}`;
const NUBE = fs.mkdtempSync(path.join(os.tmpdir(), 'nube-'));
const PUERTO = 4482;
const resultados = [];
const check = (nombre, ok, detalle) => {
  resultados.push(Boolean(ok));
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${ok ? '' : `\n      ${JSON.stringify(detalle)?.slice(0, 300)}`}`);
};

// un PNG y un MP4 de verdad (con ffmpeg), solo en la «nube»
const dirA = path.join(NUBE, 'Kads', SLUG);
fs.mkdirSync(path.join(dirA, 'img'), { recursive: true });
fs.mkdirSync(path.join(NUBE, 'Kads', 'videos-finales'), { recursive: true });
const final = `${SLUG}_9x16_con-subtitulos.mp4`;
spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=180x320:d=1', '-frames:v', '1', path.join(dirA, 'img', 'toma-1-inicial.png')]);
spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=180x320:d=2', '-pix_fmt', 'yuv420p', path.join(NUBE, 'Kads', 'videos-finales', final)]);
// el anuncio en temp/: sin img/ ni video/ ni el MP4 en output/, con su marca
fs.mkdirSync(path.join(TEMP, SLUG, 'app'), { recursive: true });
fs.writeFileSync(path.join(TEMP, SLUG, 'manifiesto.json'), JSON.stringify({ estilo: 'claymation', titulo: 'Demo nube', tomas: [{ n: 1, texto: 'Hola' }] }));
fs.writeFileSync(path.join(TEMP, SLUG, 'app', 'en-la-nube.json'), JSON.stringify({ carpeta: dirA, archivos: ['img/toma-1-inicial.png'], finales: [final], ubicaciones: {}, ubicacionesFinales: {}, fecha: new Date().toISOString() }));

const app = spawn(process.execPath, [path.join(RAIZ, 'app', 'server', 'index.js')], { env: { ...process.env, ANUNCIOS_MODO_PRUEBA: '1', PUERTO: String(PUERTO), ANUNCIOS_SIN_CALENTAR_PLANTILLAS: '1' }, stdio: 'ignore' });
const base = `http://127.0.0.1:${PUERTO}`;
try {
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(`${base}/api/estado`)).ok) break;
    } catch {
      /* todavía no */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  const lista = await (await fetch(`${base}/api/anuncios`)).json();
  const a = lista.anuncios.find((x) => x.slug === SLUG);
  check('el anuncio en la nube sigue «listo» en la lista', a && a.estado === 'listo', a);
  check('con su miniatura (la imagen de la nube)', a?.miniatura?.includes('img/toma-1-inicial.png'), a?.miniatura);
  const d = await (await fetch(`${base}/api/anuncios/${SLUG}`)).json();
  const v = (d.versiones || []).find((x) => x.archivo === final);
  check('su video final aparece, marcado «en la nube»', v && v.enLaNube === true, d.versiones);
  const video = await fetch(`${base}/archivos/salida/${final}`, { headers: { Range: 'bytes=0-99' } });
  check('el video se reproduce desde la nube (con Range, para adelantarlo)', video.status === 206 && video.headers.get('content-type') === 'video/mp4', video.status);
  const img = await fetch(`${base}/archivos/anuncio/${SLUG}/img/toma-1-inicial.png`);
  check('las imágenes se ven desde la nube', img.ok && img.headers.get('content-type') === 'image/png', img.status);
  const mini = await fetch(`${base}/archivos/miniatura/salida/${final}?ancho=120`);
  check('la miniatura del video sale de la copia de la nube', mini.ok, mini.status);
  const nada = await fetch(`${base}/archivos/anuncio/${SLUG}/img/no-existe.png`);
  check('lo que no está en ningún lado sigue dando 404', nada.status === 404, nada.status);
  const fuera = await fetch(`${base}/archivos/anuncio/${SLUG}/..%2F..%2F.env`);
  check('no se puede salir de la carpeta', fuera.status >= 400, fuera.status);
} finally {
  app.kill();
  fs.rmSync(path.join(TEMP, SLUG), { recursive: true, force: true });
  fs.rmSync(NUBE, { recursive: true, force: true });
}
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${resultados.length} OK`);
process.exit(ok === resultados.length ? 0 : 1);

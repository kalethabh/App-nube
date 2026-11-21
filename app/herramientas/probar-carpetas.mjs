// Prueba de las CARPETAS DE PRODUCTO (lib/carpetas.js, rutas/carpetas.js), sin gastar nada: crear, subir imágenes y
// videos, «Guardar en carpeta» desde un lote y desde un video terminado, la descarga en zip, quitar y borrar.
//   node app/herramientas/probar-carpetas.mjs        (PUERTO=<n>, por defecto 4489)
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = path.resolve(APP, '..');
const PUERTO = Number(process.env.PUERTO) || 4489;
const BASE = `http://127.0.0.1:${PUERTO}`;
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
let fallas = 0;
let pasan = 0;
const check = (que, ok, detalle) => {
  if (ok) pasan++;
  else fallas++;
  console.log(`${ok ? '  ok ' : '  MAL'}  ${que}${ok || detalle === undefined ? '' : `\n        ${JSON.stringify(detalle).slice(0, 900)}`}`);
  return Boolean(ok);
};
async function pedir(ruta, o = {}) {
  const cuerpo = o.json !== undefined ? JSON.stringify(o.json) : o.cuerpo;
  const headers = { Accept: 'application/json', ...(o.json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(o.headers || {}) };
  const r = await fetch(BASE + ruta, { method: o.metodo || (cuerpo !== undefined ? 'POST' : 'GET'), headers, body: cuerpo, signal: AbortSignal.timeout(60000) });
  return { st: r.status, datos: await r.json().catch(() => null) };
}
async function esperar(seg, leer, listo) {
  const hasta = Date.now() + seg * 1000;
  let u = null;
  while (Date.now() < hasta) {
    u = await leer();
    if (listo(u)) return u;
    await dormir(500);
  }
  return u;
}

const TMP = fs.mkdtempSync(path.join(RAIZ, 'temp', '_probar-carpetas-'));
const ff = (...a) => cp.execFileSync('ffmpeg', ['-v', 'error', '-y', ...a]);
ff('-f', 'lavfi', '-i', 'color=c=0x33aa55:s=320x320', '-frames:v', '1', path.join(TMP, 'foto.png'));
ff('-f', 'lavfi', '-i', 'testsrc=s=320x568:d=1:r=10', '-pix_fmt', 'yuv420p', path.join(TMP, 'clip.mp4'));
// un lote de imágenes «hecho» y un video terminado, de mentira (se borran al final)
const LOTE = `_img-probar-carpetas-${process.pid}`;
fs.mkdirSync(path.join(RAIZ, 'temp', LOTE, 'img'), { recursive: true });
fs.mkdirSync(path.join(RAIZ, 'temp', LOTE, 'app'), { recursive: true });
fs.copyFileSync(path.join(TMP, 'foto.png'), path.join(RAIZ, 'temp', LOTE, 'img', 'V01_1x1.png'));
fs.writeFileSync(path.join(RAIZ, 'temp', LOTE, 'app', 'brief.json'), JSON.stringify({ datos: { nombre: 'Aguaje Complex' } }));
const VIDEO = `probar-carpetas-${process.pid}_9x16_final.mp4`;
fs.mkdirSync(path.join(RAIZ, 'output'), { recursive: true });
fs.copyFileSync(path.join(TMP, 'clip.mp4'), path.join(RAIZ, 'output', VIDEO));
const carpetasExistia = fs.existsSync(path.join(RAIZ, 'temp', '_carpetas'));
const ENV = path.join(RAIZ, '.env');
const envPropio = !fs.existsSync(ENV);
if (envPropio) fs.writeFileSync(ENV, '# Lo escribió probar-carpetas.mjs: claves falsas.\nKIE_API_KEY=simulada\nELEVENLABS_API_KEY=simulada\n');
const env = { ...process.env };
for (const k of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|OPENAI_|CODEX_)/i.test(k)) delete env[k];
Object.assign(env, { PUERTO: String(PUERTO), ANUNCIOS_MODO_PRUEBA: '1', ANUNCIOS_PRUEBA_LIMPIO: '1', ANUNCIOS_SIN_GUARDADO: '1', OFICINA_SIN_SEGUIMIENTO: '1' });
const log = fs.createWriteStream(path.join(TMP, 'app.log'));
const app = cp.spawn(process.execPath, ['server/index.js'], { cwd: APP, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
app.stdout.pipe(log);
app.stderr.pipe(log);
const t0 = Date.now();
const creados = { carpetas: [] };
const subir = (id, archivo, nombre, tipo) => fetch(`${BASE}/api/carpetas/${id}/archivos`, { method: 'POST', headers: { 'Content-Type': tipo, 'x-nombre': encodeURIComponent(nombre) }, body: fs.readFileSync(archivo) }).then(async (r) => ({ st: r.status, datos: await r.json().catch(() => null) }));

async function principal() {
  let arriba = false;
  for (let i = 0; i < 120 && !arriba; i++) {
    try {
      arriba = (await pedir('/api/estilos')).st === 200;
    } catch {
      await dormir(500);
    }
  }
  if (!check('La app de prueba arranca', arriba)) return;
  let r = await pedir('/api/carpetas', { json: { nombre: '  ' } });
  check('Sin nombre no se crea', r.st === 400, r);
  r = await pedir('/api/carpetas', { json: { nombre: 'Aguaje' } });
  const id = r.datos?.id;
  if (id) creados.carpetas.push(id);
  check('Se crea la carpeta «Aguaje» (vacía, con imágenes y videos)', r.st === 200 && id && r.datos.imagenes.length === 0 && r.datos.videos.length === 0 && fs.existsSync(path.join(RAIZ, 'temp', '_carpetas', id, 'imagenes')) && fs.existsSync(path.join(RAIZ, 'temp', '_carpetas', id, 'videos')), r.datos);
  r = await pedir('/api/carpetas', { json: { nombre: 'aguaje' } });
  check('Otra con el mismo nombre no', r.st === 409, r);
  r = await pedir('/api/carpetas', { json: { nombre: 'Aguaje' }, headers: { Origin: 'https://otro.com' } });
  check('Desde otro sitio no se puede', r.st === 403, r);

  r = await subir(id, path.join(TMP, 'foto.png'), 'mi foto.png', 'image/png');
  const r2 = await subir(id, path.join(TMP, 'clip.mp4'), 'mi video.mp4', 'video/mp4');
  const r3 = await subir(id, path.join(TMP, 'foto.png'), 'mi foto.png', 'image/png');
  const r4 = await subir(id, path.join(TMP, 'foto.png'), 'notas.txt', 'text/plain');
  check('Subir: la imagen va a «imágenes», el video a «videos», un nombre repetido no pisa al otro y un .txt se rechaza', r.datos?.tipo === 'imagenes' && r2.datos?.tipo === 'videos' && r3.datos?.nombre === 'mi foto (2).png' && r4.st === 400, { r: r.datos, r2: r2.datos, r3: r3.datos, r4 });

  r = await pedir(`/api/carpetas/${id}/desde`, { json: { tipo: 'imagen-lote', lote: LOTE, pieza: 'V01_1x1' } });
  check('«Guardar en carpeta» desde un lote de Anuncios de imagen', r.st === 200 && r.datos.tipo === 'imagenes' && /aguaje-complex-V01_1x1\.png$/.test(r.datos.nombre), r);
  r = await pedir(`/api/carpetas/${id}/desde`, { json: { tipo: 'video', archivo: VIDEO } });
  check('«Guardar en carpeta» desde la entrega de un video', r.st === 200 && r.datos.tipo === 'videos' && r.datos.nombre === VIDEO, r);
  const malos = await Promise.all([
    pedir(`/api/carpetas/${id}/desde`, { json: { tipo: 'imagen-lote', lote: '../../etc', pieza: 'V01_1x1' } }),
    pedir(`/api/carpetas/${id}/desde`, { json: { tipo: 'video', archivo: '../.env' } }),
    fetch(`${BASE}/api/carpetas/${id}/archivo/imagenes/..%2F..%2F..%2F.env`).then((x) => ({ st: x.status })),
    fetch(`${BASE}/api/carpetas/..%2F..%2Fapp/archivo/imagenes/x.png`).then((x) => ({ st: x.status })),
  ]);
  check('No se puede salir de las carpetas (lote, video ni archivo raros)', malos.every((x) => x.st >= 400), malos.map((x) => x.st));

  r = await pedir(`/api/carpetas/${id}`);
  check('La carpeta tiene 3 imágenes y 2 videos', r.datos?.imagenes?.length === 3 && r.datos.videos.length === 2, r.datos);
  r = await pedir('/api/carpetas');
  check('La lista la muestra con sus cuentas y su portada', r.datos?.carpetas?.some((c) => c.id === id && c.imagenes === 3 && c.videos === 2 && c.portada), r.datos);
  const img = await fetch(`${BASE}/api/carpetas/${id}/archivo/imagenes/${encodeURIComponent('mi foto.png')}`);
  check('Cada archivo se ve', img.status === 200 && /image/.test(img.headers.get('content-type') || ''));
  const z = await fetch(`${BASE}/api/carpetas/${id}/zip`);
  const zip = Buffer.from(await z.arrayBuffer());
  check('«Descargar carpeta»: un zip con «Aguaje/imagenes/…» y «Aguaje/videos/…»', z.status === 200 && zip.slice(0, 2).toString() === 'PK' && zip.includes(Buffer.from('Aguaje/imagenes/mi foto.png')) && zip.includes(Buffer.from(`Aguaje/videos/${VIDEO}`)));
  r = await pedir(`/api/carpetas/${id}/archivo/imagenes/${encodeURIComponent('mi foto (2).png')}`, { metodo: 'DELETE' });
  check('Quitar un archivo', r.st === 200 && r.datos.imagenes.length === 2, r.datos);
  check('El video original sigue en su lugar (la carpeta guarda una copia)', fs.existsSync(path.join(RAIZ, 'output', VIDEO)));
  r = await pedir(`/api/carpetas/${id}`, { metodo: 'DELETE' });
  check('Borrar la carpeta (lo original no se toca)', r.st === 200 && !fs.existsSync(path.join(RAIZ, 'temp', '_carpetas', id)) && fs.existsSync(path.join(RAIZ, 'temp', LOTE, 'img', 'V01_1x1.png')), r);
}

try {
  await principal();
} catch (e) {
  check('La prueba no se cae', false, String(e?.stack || e));
} finally {
  try {
    process.kill(-app.pid, 'SIGTERM');
    await dormir(1500);
    process.kill(-app.pid, 'SIGKILL');
  } catch {
    /* ya cerró */
  }
  for (const id of creados.carpetas) fs.rmSync(path.join(RAIZ, 'temp', '_carpetas', id), { recursive: true, force: true });
  if (!carpetasExistia) fs.rmSync(path.join(RAIZ, 'temp', '_carpetas'), { recursive: true, force: true });
  fs.rmSync(path.join(RAIZ, 'temp', LOTE), { recursive: true, force: true });
  fs.rmSync(path.join(RAIZ, 'output', VIDEO), { force: true });
  fs.rmSync(path.join(RAIZ, 'temp', `_modo-prueba-${PUERTO}`), { recursive: true, force: true });
  if (envPropio) fs.rmSync(ENV, { force: true });
  if (fallas) console.log(`\n  Registro de la app: ${path.join(TMP, 'app.log')}`);
  else fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n  ${pasan} bien, ${fallas} mal · ${Math.round((Date.now() - t0) / 1000)} s\n`);
  process.exit(fallas ? 1 : 0);
}

// Prueba de «EDITAR ESTE ANUNCIO» (POST /api/anuncios/:slug/editar, lib/anuncios-nuevos.js editarAnuncio), sin gastar
// nada: un musical produciéndose; «que ya no sea cantado» hace una versión nueva narrada en su mismo look y detiene el
// original; con un estilo elegido va en ese.
//   node app/herramientas/probar-editar.mjs        (PUERTO=<n>, por defecto 4493)
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = path.resolve(APP, '..');
const PUERTO = Number(process.env.PUERTO) || 4493;
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
async function _esperar(seg, leer, listo) {
  const hasta = Date.now() + seg * 1000;
  let u = null;
  while (Date.now() < hasta) {
    u = await leer();
    if (listo(u)) return u;
    await dormir(500);
  }
  return u;
}


const TMP = fs.mkdtempSync(path.join(RAIZ, 'temp', '_probar-editar-'));
// un anuncio CANTADO (musical, visual crochet) con su letra aprobada y produciéndose, de mentira (se borra al final)
const ORIGEN = `zz-probar-editar-musical-${process.pid}`;
const escribir = (slug, n, d) => {
  fs.mkdirSync(path.dirname(path.join(RAIZ, 'temp', slug, n)), { recursive: true });
  fs.writeFileSync(path.join(RAIZ, 'temp', slug, n), JSON.stringify(d));
};
// un producto de mentira con ficha y foto
const PRODUCTO = `producto-zzed${String(process.pid).slice(-4)}`.slice(0, 40);
fs.mkdirSync(path.join(RAIZ, 'temp', '_productos', PRODUCTO), { recursive: true });
escribir('_productos/' + PRODUCTO, 'producto.json', { id: PRODUCTO, nombre: 'Aguaje Prueba', fotos: ['foto-1.png'] });
escribir('_productos/' + PRODUCTO, 'ficha.json', { nombre: 'Aguaje Prueba', descripcion: 'Cápsulas de aguaje.' });
fs.copyFileSync(path.join(APP, 'public', 'kads-icono-180.png'), path.join(RAIZ, 'temp', '_productos', PRODUCTO, 'foto-1.png'));
escribir(ORIGEN, 'app/brief.json', { slug: ORIGEN, productoId: PRODUCTO, estilo: 'musical', familia: 'musical', faseGuion: 'letras', opciones: { visual: 'crochet' }, respuestas: { visual: 'Crochet' }, puerto: PUERTO });
escribir(ORIGEN, 'app/sesion.json', { estado: 'aprobado' });
escribir(ORIGEN, 'app/letras.json', { elegida: 1, opciones: [{ letra: 'Aguaje, aguaje, tu cuerpo va a cambiar' }] });
const creados = [];

const ENV = path.join(RAIZ, '.env');
const envPropio = !fs.existsSync(ENV);
if (envPropio) fs.writeFileSync(ENV, '# Lo escribió probar-editar.mjs: claves falsas.\nKIE_API_KEY=simulada\nELEVENLABS_API_KEY=simulada\n');
const env = { ...process.env };
for (const k of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|OPENAI_|CODEX_)/i.test(k)) delete env[k];
Object.assign(env, { PUERTO: String(PUERTO), ANUNCIOS_MODO_PRUEBA: '1', ANUNCIOS_PRUEBA_LIMPIO: '1', ANUNCIOS_SIN_GUARDADO: '1', OFICINA_SIN_SEGUIMIENTO: '1' });
const log = fs.createWriteStream(path.join(TMP, 'app.log'));
const app = cp.spawn(process.execPath, ['server/index.js'], { cwd: APP, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
app.stdout.pipe(log);
app.stderr.pipe(log);
const t0 = Date.now();

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
  // (después de arrancar: al arrancar, la app retoma lo que estaba corriendo)
  escribir(ORIGEN, 'app/conductor.json', { slug: ORIGEN, familia: 'musical', estado: 'corriendo', paso: 'cancion', modoPrueba: true, actualizado: new Date().toISOString(), pasos: [{ id: 'letra', nombre: 'Letra', estado: 'hecho' }, { id: 'cancion', nombre: 'Canción', estado: 'corriendo' }] });
  let r = await pedir(`/api/anuncios/${ORIGEN}/editar`, { json: { pedido: '  ' } });
  check('Sin pedido no se edita', r.st === 400, r);
  r = await pedir(`/api/anuncios/${ORIGEN}/editar`, { json: { pedido: 'que no sea cantado' }, headers: { Origin: 'https://otro.com' } });
  check('Desde otro sitio no', r.st === 403, r.st);
  r = await pedir(`/api/anuncios/${ORIGEN}/editar`, { json: { pedido: 'Que ya no sea cantado ni entonado, que sea narrado' } });
  if (r.datos?.slug) creados.push(r.datos.slug);
  check('«Que ya no sea cantado»: una versión nueva en el look del musical (Crochet), narrada', r.st === 201 && r.datos.estilo === 'crochet' && r.datos.cambioDeEstilo === true, r);
  const b = JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', r.datos.slug, 'app', 'brief.json'), 'utf8'));
  check('Su ficha: mismo producto, editada del original, con tu pedido y su guion de voz en off', b.productoId === PRODUCTO && b.editadoDe === ORIGEN && /narrado/.test(b.pedidoEdicion) && b.faseGuion === 'guion' && b.familia === 'voz-en-off', b);
  const c = JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', ORIGEN, 'app', 'conductor.json'), 'utf8'));
  check('El original se detuvo (no gasta en lo que vas a cambiar) y sigue ahí', r.datos.detenido === true && c.estado === 'pausado' && fs.existsSync(path.join(RAIZ, 'temp', ORIGEN, 'app', 'letras.json')), { detenido: r.datos.detenido, estado: c.estado });
  const l = await pedir('/api/anuncios');
  const nuevo = l.datos?.anuncios?.find((a) => a.slug === r.datos.slug);
  check('La versión nueva aparece en tus anuncios, en el paso del guion', nuevo && nuevo.enGuion, nuevo);
  r = await pedir(`/api/anuncios/${ORIGEN}/editar`, { json: { pedido: 'cambia el gancho por una pregunta', estilo: 'estilo-pixar', detener: false } });
  if (r.datos?.slug) creados.push(r.datos.slug);
  check('Con un estilo elegido, va en ese', r.st === 201 && r.datos.estilo === 'estilo-pixar' && r.datos.detenido === false, r);
  r = await pedir(`/api/anuncios/${ORIGEN}/editar`, { json: { pedido: 'algo', estilo: 'no-existe' } });
  check('Un estilo que no existe: no', r.st === 400, r);
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
  for (const s of [ORIGEN, ...creados]) fs.rmSync(path.join(RAIZ, 'temp', s), { recursive: true, force: true });
  fs.rmSync(path.join(RAIZ, 'temp', '_productos', PRODUCTO), { recursive: true, force: true });
  fs.rmSync(path.join(RAIZ, 'temp', `_modo-prueba-${PUERTO}`), { recursive: true, force: true });
  if (envPropio) fs.rmSync(ENV, { force: true });
  if (fallas) console.log(`\n  Registro de la app: ${path.join(TMP, 'app.log')}`);
  else fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n  ${pasan} bien, ${fallas} mal · ${Math.round((Date.now() - t0) / 1000)} s\n`);
  process.exit(fallas ? 1 : 0);
}

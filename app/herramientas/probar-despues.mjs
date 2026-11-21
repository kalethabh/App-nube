// Prueba de «TERMINAR DESPUÉS» (lib/para-despues.js, rutas/para-despues.js), sin gastar nada: un anuncio frenado y uno
// con el guion listo salen de «Te necesitan» (también de la oficina), vuelven con «Volver a avisarme» o al continuar.
//   node app/herramientas/probar-despues.mjs        (PUERTO=<n>, por defecto 4491)
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = path.resolve(APP, '..');
const PUERTO = Number(process.env.PUERTO) || 4491;
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


const TMP = fs.mkdtempSync(path.join(RAIZ, 'temp', '_probar-despues-'));
// dos anuncios de la app, de mentira: uno frenado en el montaje y uno con el guion listo para aprobar (se borran al final)
const FRENADO = `zz-probar-despues-frenado-${process.pid}`;
const GUION = `zz-probar-despues-guion-${process.pid}`;
const escribir = (slug, n, d) => {
  fs.mkdirSync(path.join(RAIZ, 'temp', slug, 'app'), { recursive: true });
  fs.writeFileSync(path.join(RAIZ, 'temp', slug, 'app', n), JSON.stringify(d));
};
const brief = { estilo: 'estilo-pixar', puerto: PUERTO, datos: { nombre: 'Aguaje' } };
escribir(FRENADO, 'brief.json', brief);
escribir(FRENADO, 'sesion.json', { estado: 'aprobado' });
escribir(FRENADO, 'conductor.json', { slug: FRENADO, familia: 'voz-en-off', estado: 'error', paso: 'montaje', modoPrueba: true, actualizado: new Date().toISOString(), pasos: [{ id: 'validar', nombre: 'Validar', estado: 'hecho' }, { id: 'montaje', nombre: 'Montaje', estado: 'error', error: { mensaje: 'Falló el montaje' } }] });
escribir(GUION, 'brief.json', brief);
escribir(GUION, 'sesion.json', { estado: 'listo' });

const ENV = path.join(RAIZ, '.env');
const envPropio = !fs.existsSync(ENV);
if (envPropio) fs.writeFileSync(ENV, '# Lo escribió probar-despues.mjs: claves falsas.\nKIE_API_KEY=simulada\nELEVENLABS_API_KEY=simulada\n');
const env = { ...process.env };
for (const k of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|OPENAI_|CODEX_)/i.test(k)) delete env[k];
Object.assign(env, { PUERTO: String(PUERTO), ANUNCIOS_MODO_PRUEBA: '1', ANUNCIOS_PRUEBA_LIMPIO: '1', ANUNCIOS_SIN_GUARDADO: '1', OFICINA_SIN_SEGUIMIENTO: '1' });
const log = fs.createWriteStream(path.join(TMP, 'app.log'));
const app = cp.spawn(process.execPath, ['server/index.js'], { cwd: APP, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
app.stdout.pipe(log);
app.stderr.pipe(log);
const t0 = Date.now();
const de = (r, slug) => r.datos?.anuncios?.find((a) => a.slug === slug);

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
  let r = await pedir('/api/anuncios');
  check('Los dos anuncios están, sin «para después»', de(r, FRENADO)?.estado === 'error' && de(r, GUION)?.teNecesita && !de(r, FRENADO).paraDespues && !de(r, GUION).paraDespues, [de(r, FRENADO), de(r, GUION)]);
  const ofi0 = (await pedir('/api/oficina')).datos?.resumen?.teNecesitan;
  r = await pedir(`/api/anuncios/${FRENADO}/despues`, { metodo: 'POST' });
  const r2 = await pedir(`/api/anuncios/${GUION}/despues`, { metodo: 'POST' });
  check('«Terminar después» en los dos', r.st === 200 && r.datos.paraDespues && r2.st === 200, [r, r2]);
  r = await pedir('/api/anuncios');
  check('La lista los marca «para después» (con su fecha)', Date.parse(de(r, FRENADO)?.paraDespues) > 0 && Date.parse(de(r, GUION)?.paraDespues) > 0, [de(r, FRENADO), de(r, GUION)]);
  const ofi1 = (await pedir('/api/oficina')).datos?.resumen?.teNecesitan;
  check('La oficina ya no los cuenta en «te necesitan»', Number.isFinite(ofi0) && ofi1 === ofi0 - 2, { ofi0, ofi1 });
  r = await pedir(`/api/anuncios/zz-no-existe-${process.pid}/despues`, { metodo: 'POST' });
  const r3 = await pedir(`/api/anuncios/${FRENADO}/despues`, { metodo: 'POST', headers: { Origin: 'https://otro.com' } });
  const r4 = await pedir(`/api/anuncios/..%2F..%2Fapp/despues`, { metodo: 'POST' });
  check('Uno que no existe, desde otro sitio o un nombre raro: no', r.st === 404 && r3.st === 403 && r4.st >= 400, [r.st, r3.st, r4.st]);
  r = await pedir(`/api/anuncios/${GUION}/despues`, { metodo: 'DELETE' });
  const r5 = await pedir('/api/anuncios');
  check('«Volver a avisarme»: el guion vuelve a «Te necesitan»', r.st === 200 && !de(r5, GUION)?.paraDespues && de(r5, GUION)?.teNecesita, de(r5, GUION));
  // «Continuar» lo saca de «para después» (siga o no: aquí es de mentira)
  await pedir(`/api/anuncios/${FRENADO}/continuar`, { metodo: 'POST' });
  r = await pedir('/api/anuncios');
  check('«Continuar» lo saca de «Para después» (si se vuelve a frenar, te avisa)', !de(r, FRENADO)?.paraDespues && !fs.existsSync(path.join(RAIZ, 'temp', FRENADO, 'app', 'despues.json')), de(r, FRENADO));
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
  for (const s of [FRENADO, GUION]) fs.rmSync(path.join(RAIZ, 'temp', s), { recursive: true, force: true });
  fs.rmSync(path.join(RAIZ, 'temp', `_modo-prueba-${PUERTO}`), { recursive: true, force: true });
  if (envPropio) fs.rmSync(ENV, { force: true });
  if (fallas) console.log(`\n  Registro de la app: ${path.join(TMP, 'app.log')}`);
  else fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n  ${pasan} bien, ${fallas} mal · ${Math.round((Date.now() - t0) / 1000)} s\n`);
  process.exit(fallas ? 1 : 0);
}

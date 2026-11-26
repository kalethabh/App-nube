// Prueba de TUS ESTRUCTURAS GANADORAS (2026-11-26d), SIN GASTAR NADA (modo prueba, el Claude falso escribe la ficha):
//   - subir un anuncio da un trabajo; el trabajo termina con la ficha P01 en tu biblioteca (en la prueba, aparte);
//   - P01 aparece en la lista (tuya, primero), su imagen se sirve y entra al sorteo «Al azar» (al menos una por lote);
//   - un lote con P01 termina: el generador recibió su imagen como estructura y se armó su montaje de comparación;
//   - no se puede borrar una de Mayaverra; borrar P01 la saca de todo.
//   node app/herramientas/probar-estructuras-propias.mjs        (PUERTO=<n>, por defecto 4492)
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = path.resolve(APP, '..');
const PUERTO = Number(process.env.PUERTO) || 4492;
process.env.PUERTO = String(PUERTO); // (los módulos que se importan abajo usan los aprendizajes de esta prueba)
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
const t0 = Date.now();
async function pedir(ruta, o = {}) {
  const cuerpo = o.json !== undefined ? JSON.stringify(o.json) : o.cuerpo;
  const headers = { Accept: 'application/json', ...(o.json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(o.headers || {}) };
  const r = await fetch(BASE + ruta, { method: o.metodo || (cuerpo !== undefined ? 'POST' : 'GET'), headers, body: cuerpo, signal: AbortSignal.timeout(60000) });
  const tipo = r.headers.get('content-type') || '';
  return { st: r.status, datos: tipo.includes('json') ? await r.json().catch(() => null) : await r.arrayBuffer() };
}
async function esperar(minutos, leer, listo) {
  const hasta = Date.now() + minutos * 60000;
  let ultimo = null;
  while (Date.now() < hasta) {
    try {
      ultimo = await leer();
      if (listo(ultimo)) return ultimo;
    } catch (e) {
      ultimo = { error: e.message };
    }
    await dormir(1200);
  }
  return { ...ultimo, _seAcaboElTiempo: true };
}
const md5Recorte = (img, r) => cp.execFileSync('ffmpeg', ['-v', 'error', '-i', img, '-vf', `crop=${r},format=rgb24`, '-f', 'md5', '-']).toString().trim();

const TMP = fs.mkdtempSync(path.join(RAIZ, 'temp', '_probar-propias-'));
const ffmpeg = (args) => cp.execFileSync('ffmpeg', ['-v', 'error', '-y', ...args]);
const FOTO = path.join(TMP, 'producto.png');
ffmpeg(['-f', 'lavfi', '-i', 'color=c=0xcc3355:s=640x640', '-frames:v', '1', FOTO]);
const GANADOR = path.join(TMP, 'ganador.png');
ffmpeg(['-f', 'lavfi', '-i', 'testsrc=s=1080x1080', '-frames:v', '1', GANADOR]);
const ENV = path.join(RAIZ, '.env');
const envPropio = !fs.existsSync(ENV);
if (envPropio) fs.writeFileSync(ENV, '# Lo escribió probar-estructuras-propias.mjs: claves falsas.\nKIE_API_KEY=simulada\nELEVENLABS_API_KEY=simulada\n');
const env = { ...process.env };
for (const k of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|OPENAI_|CODEX_|FALSO_)/i.test(k)) delete env[k];
Object.assign(env, { PUERTO: String(PUERTO), ANUNCIOS_MODO_PRUEBA: '1', ANUNCIOS_PRUEBA_LIMPIO: '1', ANUNCIOS_SIN_GUARDADO: '1', ANUNCIOS_CLAUDE_BIN: path.join(APP, 'server', 'claude', 'pruebas', 'claude-falso.js'), AIA_MOTOR: 'claude' });
const log = fs.createWriteStream(path.join(TMP, 'app.log'));
const app = cp.spawn(process.execPath, ['server/index.js'], { cwd: APP, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
app.stdout.pipe(log);
app.stderr.pipe(log);
const creados = { producto: null, lotes: [] };

async function unLote(id, porImagen, cuerpo) {
  const r = await pedir('/api/imagen-ads', { json: { productoId: id, fotoProducto: 1, datos: { nombre: 'Curvas Plus', pais: 'Colombia', idioma: 'es' }, formatos: ['1:1'], logo: null, usarInvestigacion: false, ...cuerpo } });
  const lote = r.datos?.lote;
  if (!lote) return { r };
  creados.lotes.push(lote);
  await pedir(`/api/imagen-ads/${lote}/generar`, { json: { costoMaximoConfirmado: Math.round(porImagen * cuerpo.cantidad * 100) / 100 } });
  const vista = await esperar(8, async () => (await pedir(`/api/imagen-ads/${lote}`)).datos, (d) => ['listo', 'error'].includes(d?.conductor?.estado));
  return { r, lote, vista };
}

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
  let r = await pedir('/api/productos', { json: { nombre: 'Curvas Plus', tipo: 'fisico', descripcion: 'Gotas para glúteos y curvas.' } });
  const id = r.datos?.id;
  creados.producto = id;
  await pedir(`/api/productos/${id}/fotos/1`, { metodo: 'PUT', cuerpo: fs.readFileSync(FOTO), headers: { 'Content-Type': 'image/png' } });
  const porImagen = (await pedir('/api/imagen-ads/opciones')).datos?.costo?.dolaresPorImagen || 0;

  // 1) subir el anuncio ganador -> trabajo -> P01
  r = await pedir('/api/imagen-ads/estructuras', { metodo: 'POST', cuerpo: fs.readFileSync(GANADOR), headers: { 'Content-Type': 'image/png' } });
  check('Subir un anuncio ganador da un trabajo', r.st === 202 && r.datos?.trabajo, r);
  const t = await esperar(3, async () => (await pedir(`/api/imagen-ads/estructuras/trabajos/${r.datos?.trabajo}`)).datos, (d) => ['listo', 'error'].includes(d?.estado));
  check('Tu IA escribe la ficha y queda como P01', t?.estado === 'listo' && t.estructura?.id === 'P01' && t.estructura.nombre, t);
  const DIR = path.join(RAIZ, 'temp', `_modo-prueba-${PUERTO}`, 'estructuras');
  const indice = fs.existsSync(path.join(DIR, 'indice.json')) ? JSON.parse(fs.readFileSync(path.join(DIR, 'indice.json'), 'utf8')) : null;
  check('…en tu biblioteca (en la prueba, aparte): ficha, imagen e índice, nunca en la skill', indice?.estructuras?.[0]?.id === 'P01' && fs.existsSync(path.join(DIR, 'P01.json')) && fs.existsSync(path.join(DIR, 'img', 'P01.jpg')) && !fs.existsSync(path.join(RAIZ, '.claude', 'skills', 'anuncios-imagen-ads', 'estructuras', 'P01.json')), indice);
  const { errorDeFicha } = await import('../server/lib/imagen-ads/variedad.js');
  check('…con una ficha válida (el mismo esquema que las de Mayaverra)', errorDeFicha(JSON.parse(fs.readFileSync(path.join(DIR, 'P01.json'), 'utf8'))).length === 0);
  r = await pedir('/api/imagen-ads/estructuras', { metodo: 'POST', cuerpo: Buffer.from('no es una imagen'), headers: { 'Content-Type': 'text/plain' } });
  check('Algo que no es imagen no se acepta', r.st === 400, r);

  // 2) la lista y la imagen
  const le = (await pedir('/api/imagen-ads/estructuras')).datos?.estructuras || [];
  const p1 = le.find((x) => x.id === 'P01');
  check('P01 aparece en la lista como tuya y visible para elegir', p1?.propia === true && p1.oculta === false && p1.hay === true && le.filter((x) => x.marca === 'mayaverra').length === 55, p1);
  const img = await fetch(`${BASE}/api/imagen-ads/estructuras/P01/imagen`);
  check('…y su imagen se sirve', img.status === 200 && /image\/jpeg/.test(img.headers.get('content-type') || ''));

  // 3) el sorteo: al menos una tuya en un lote de 3 o más
  const lotesAzar = [];
  for (const n of [3, 5]) {
    const ra = await pedir('/api/imagen-ads', { json: { productoId: id, fotoProducto: 1, datos: { nombre: 'Curvas Plus', pais: 'Colombia', idioma: 'es' }, cantidad: n, formatos: ['1:1'], logo: null, modo: 'nuevos', estructuras: 'azar', usarInvestigacion: false } });
    if (ra.datos?.lote) creados.lotes.push(ra.datos.lote);
    lotesAzar.push(ra.datos?.brief?.estructuras || []);
  }
  check('«Al azar» incluye tu estructura (al menos una por lote) y el resto de Mayaverra', lotesAzar.every((l) => l.includes('P01') && l.filter((x) => /^F\d+$/.test(x)).length === l.length - 1), lotesAzar);

  // 4) un lote con P01 termina, con su imagen como estructura y su montaje
  const { lote, vista } = await unLote(id, porImagen, { cantidad: 2, modo: 'nuevos', estructuras: ['P01', 'F36'] });
  if (check('Un lote con tu estructura (P01 + F36) termina', vista?.conductor?.estado === 'listo', vista?.conductor)) {
    const c = path.join(RAIZ, 'temp', lote);
    const plan = JSON.parse(fs.readFileSync(path.join(c, 'plan.json'), 'utf8'));
    const vP = plan.variaciones.find((x) => x.formato_id === 'P01');
    check('El plan usa P01', Boolean(vP), plan.variaciones.map((x) => x.formato_id));
    const mapa = JSON.parse(fs.readFileSync(path.join(c, 'entrada', 'estructuras', 'mapa.json'), 'utf8'));
    check('La imagen y la ficha de P01 se copiaron al lote (la IA solo lee el lote y la skill)', mapa.P01 === 'entrada/estructuras/P01.jpg' && fs.existsSync(path.join(c, 'entrada', 'estructuras', 'P01.jpg')) && fs.existsSync(path.join(c, 'entrada', 'estructuras', 'P01.json')), mapa);
    const enviado = vP ? fs.readFileSync(path.join(c, 'prompts', `${vP.id}_1x1.txt`), 'utf8') : '';
    check('Al generador le llegó tu imagen como estructura', /STRUCTURE REFERENCE/.test(enviado), enviado.slice(0, 300));
    check('Se armó su montaje lado a lado en comparacion/', vP && fs.existsSync(path.join(c, 'comparacion', `${vP.id}.jpg`)), fs.existsSync(path.join(c, 'comparacion')) ? fs.readdirSync(path.join(c, 'comparacion')) : null);
  }

  // 5) borrar
  r = await pedir('/api/imagen-ads/estructuras/F33', { metodo: 'DELETE' });
  check('Una de Mayaverra no se puede borrar', r.st === 403, r);
  r = await pedir('/api/imagen-ads/estructuras/P01', { metodo: 'DELETE' });
  const le2 = (await pedir('/api/imagen-ads/estructuras')).datos?.estructuras || [];
  check('Borrar P01 la saca de la lista, del índice y del disco', r.st === 200 && !le2.some((x) => x.id === 'P01') && !fs.existsSync(path.join(DIR, 'P01.json')) && !fs.existsSync(path.join(DIR, 'img', 'P01.jpg')), r);
  const ra = await pedir('/api/imagen-ads', { json: { productoId: id, fotoProducto: 1, datos: { nombre: 'Curvas Plus', pais: 'Colombia', idioma: 'es' }, cantidad: 5, formatos: ['1:1'], logo: null, modo: 'nuevos', estructuras: 'azar', usarInvestigacion: false } });
  if (ra.datos?.lote) creados.lotes.push(ra.datos.lote);
  check('…y ya no entra al sorteo', (ra.datos?.brief?.estructuras || []).length === 5 && !(ra.datos?.brief?.estructuras || []).includes('P01'), ra.datos?.brief?.estructuras);
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
  for (const l of creados.lotes) if (l) fs.rmSync(path.join(RAIZ, 'temp', l), { recursive: true, force: true });
  if (creados.producto) fs.rmSync(path.join(RAIZ, 'temp', '_productos', creados.producto), { recursive: true, force: true });
  fs.rmSync(path.join(RAIZ, 'temp', `_modo-prueba-${PUERTO}`), { recursive: true, force: true });
  if (envPropio) fs.rmSync(ENV, { force: true });
  if (fallas) console.log(`\n  Registro de la app: ${path.join(TMP, 'app.log')}`);
  else fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n  ${pasan} bien, ${fallas} mal · ${Math.round((Date.now() - t0) / 1000)} s\n`);
  process.exit(fallas ? 1 : 0);
}

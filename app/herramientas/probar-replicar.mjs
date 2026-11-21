// Prueba del MODO REPLICAR VALIDADO (2026-11-21, «Variantes» con «Replicar validado»), SIN GASTAR NADA: la app en MODO
// PRUEBA (kie simulado) con el Claude falso. Revisa: lo que cambia (modelo, escenario, pose, titular) nunca se repite; el
// mapa de la referencia (zonas, jerarquía, tipografía y paleta, ángulo, titulares) se saca antes de generar y se
// valida; cada V##.json y el prompt del modelo de imagen lo llevan exacto; con 2 referencias, un mapa por cada una.
//   node app/herramientas/probar-replicar.mjs        (PUERTO=<n>, por defecto 4491)
import fs from 'node:fs';
import path from 'node:path';
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
  const tipo = r.headers.get('content-type') || '';
  return { st: r.status, datos: tipo.includes('json') ? await r.json().catch(() => null) : await r.text() };
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
    await dormir(1500);
  }
  return { ...ultimo, _seAcaboElTiempo: true };
}

const TMP = fs.mkdtempSync(path.join(RAIZ, 'temp', '_probar-replicar-'));
const ffmpeg = (args) => cp.execFileSync('ffmpeg', ['-v', 'error', '-y', ...args]);
const FOTO = path.join(TMP, 'producto.png');
ffmpeg(['-f', 'lavfi', '-i', 'color=c=0xcc3355:s=640x640', '-frames:v', '1', FOTO]);
const GANADOR = path.join(TMP, 'ganador.png');
ffmpeg(['-f', 'lavfi', '-i', 'color=c=0x33aa77:s=1080x1080', '-frames:v', '1', GANADOR]);
const GANADOR2 = path.join(TMP, 'ganador2.png');
ffmpeg(['-f', 'lavfi', '-i', 'color=c=0xaa7733:s=1080x1080', '-frames:v', '1', GANADOR2]);
const ENV = path.join(RAIZ, '.env');
const envPropio = !fs.existsSync(ENV);
if (envPropio) fs.writeFileSync(ENV, '# Lo escribió probar-replicar.mjs: claves falsas.\nKIE_API_KEY=simulada\nELEVENLABS_API_KEY=simulada\n');
const env = { ...process.env };
for (const k of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|OPENAI_|CODEX_)/i.test(k)) delete env[k];
Object.assign(env, { PUERTO: String(PUERTO), ANUNCIOS_MODO_PRUEBA: '1', ANUNCIOS_PRUEBA_LIMPIO: '1', ANUNCIOS_SIN_GUARDADO: '1', ANUNCIOS_CLAUDE_BIN: path.join(APP, 'server', 'claude', 'pruebas', 'claude-falso.js'), AIA_MOTOR: 'claude' });
const log = fs.createWriteStream(path.join(TMP, 'app.log'));
const app = cp.spawn(process.execPath, ['server/index.js'], { cwd: APP, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
app.stdout.pipe(log);
app.stderr.pipe(log);
const t0 = Date.now();
const creados = { producto: null, lote: null, otros: [] };

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
  // ---- lo que cambia, sin repetir
  const rep = await import('../server/lib/imagen-ads/replicar.js');
  const v12 = rep.variedad(12, 'x');
  check('12 variaciones: 12 modelos distintas y 12 escenarios distintos', new Set(v12.map((x) => x.modelo)).size === 12 && new Set(v12.map((x) => x.escenario)).size === 12, v12.slice(0, 3));
  const v20 = rep.variedad(20, 'x');
  check('Con más de 12, nunca se repite el par modelo + escenario', new Set(v20.map((x) => x.modelo + x.escenario)).size === 20 && new Set(v20.map((x) => x.modelo)).size === 20);
  check('Con 2 referencias y 5 imágenes: 3 titulares de la primera y 2 de la segunda', rep.titularesPorReferencia({ cantidad: 5, referencias: ['a', 'b'] }).join() === '3,2');
  check('El mapa exige zonas, jerarquía, letra y paleta, ángulo y titulares del mismo largo, distintos y no iguales al original', rep.errorDeMapa({ titular_original: 'Bye bye glúteos planos', titulares: ['Bye bye glúteos planos', 'Una frase demasiado larga que no cabe en la zona del titular'] }, 2).length >= 8);

  let r = await pedir('/api/productos', { json: { nombre: 'Curvas Plus', tipo: 'fisico', descripcion: 'Gotas para glúteos y curvas. Diez gotas al día.' } });
  const id = r.datos?.id;
  creados.producto = id;
  if (!check('Se crea el producto', r.st === 201 && id, r)) return;
  await pedir(`/api/productos/${id}/fotos/1`, { metodo: 'PUT', cuerpo: fs.readFileSync(FOTO), headers: { 'Content-Type': 'image/png' } });
  await pedir(`/api/productos/${id}/analizar`, { json: {} });
  await esperar(5, async () => (await pedir(`/api/productos/${id}`)).datos, (d) => ['lista', 'error'].includes(d?.tarea?.estado));
  const op = (await pedir('/api/imagen-ads/opciones')).datos;
  const porImagen = op?.costo?.dolaresPorImagen || 0;
  r = await pedir('/api/imagen-ads', { json: { productoId: id, fotoProducto: 1, datos: { nombre: 'Curvas Plus', pais: 'Colombia', idioma: 'es' }, cantidad: 6, formatos: ['1:1'], logo: null, modo: 'variantes', replicar: true, referenciasPropias: [1], fiel: true, rapido: false } });
  const lote = r.datos?.lote;
  creados.lote = lote;
  if (!check('Se crea el lote de «Variantes» en modo Replicar validado (siempre rápido)', r.st === 201 && r.datos?.brief?.replicar === true && r.datos.brief.rapido === true, r.datos?.brief)) return;
  await pedir(`/api/imagen-ads/${lote}/referencias/1`, { metodo: 'PUT', cuerpo: fs.readFileSync(GANADOR), headers: { 'Content-Type': 'image/png' } });
  r = await pedir(`/api/imagen-ads/${lote}/generar`, { json: { costoMaximoConfirmado: Math.round(porImagen * 6 * 100) / 100 } });
  check('Con el costo confirmado arranca', r.st === 200, r);
  const vista = await esperar(6, async () => (await pedir(`/api/imagen-ads/${lote}`)).datos, (d) => ['listo', 'error'].includes(d?.conductor?.estado));
  if (!check('El lote termina', vista?.conductor?.estado === 'listo', { estado: vista?.conductor, tiempo: vista?._seAcaboElTiempo })) return;
  const carpeta = path.join(RAIZ, 'temp', lote);
  const mapa = JSON.parse(fs.readFileSync(path.join(carpeta, 'entrada', 'mapa-R01.json'), 'utf8'));
  check('Antes de generar, la IA sacó el mapa: zonas, jerarquía, tipografía y paleta, ángulo y 6 titulares', mapa.zonas?.oferta_cta && mapa.jerarquia?.length >= 3 && mapa.tipografia_paleta?.fondos_de_bloques && mapa.angulo?.dolor && mapa.titulares?.length >= 6 && rep.errorDeMapa(mapa, 6).length === 0, mapa);
  const vs = Array.from({ length: 6 }, (_, i) => JSON.parse(fs.readFileSync(path.join(carpeta, `V0${i + 1}.json`), 'utf8')));
  check('Cada variación va en modo «replicar»', vs.every((v) => v.app_rapido === 'replicar'), vs.map((v) => v.app_rapido));
  check('Ninguna repite modelo ni escenario', new Set(vs.map((v) => v.app_replicar.modelo)).size === 6 && new Set(vs.map((v) => v.app_replicar.escenario)).size === 6, vs.map((v) => v.app_replicar));
  const tits = vs.map((v) => v.text_layers[0].text);
  check('Cada una con su titular: misma promesa, otras palabras, ninguno repetido ni igual al original', new Set(tits).size === 6 && !tits.includes(mapa.titular_original), tits);
  check('Los demás textos van tal cual (sin inventar)', vs.every((v) => v.text_layers.some((t) => t.text === 'Pídelo ya') && v.text_layers.some((t) => t.text === 'Envío gratis hoy')));
  const { construirPrompt } = await import('../../produccion/imagen-ads.js');
  const pr = construirPrompt(vs[0], { referencia: true });
  check('Al modelo de imagen le llega el mapa exacto, lo que cambia y lo prohibido', /MODE: REPLICATE A VALIDATED AD/.test(pr) && /MAP OF THE REFERENCE/.test(pr) && /franja inferior amarilla/.test(pr) && /#F7C6D0/.test(pr) && /FORBIDDEN: moving/.test(pr) && pr.includes(vs[0].app_replicar.modelo) && pr.includes(vs[0].app_replicar.escenario) && pr.includes(tits[0]), pr.slice(0, 600));
  check('Una imagen por variación (6 piezas listas)', vista.variaciones.length === 6 && vista.variaciones.every((x) => x.piezas['1:1']?.url), vista.variaciones.map((x) => x.piezas['1:1']?.estado));

  // ---- dos referencias: cada una con su mapa
  r = await pedir('/api/imagen-ads', { json: { productoId: id, fotoProducto: 1, datos: { nombre: 'Curvas Plus', pais: 'Colombia', idioma: 'es' }, cantidad: 5, formatos: ['1:1'], logo: null, modo: 'variantes', replicar: true } });
  const lote2 = r.datos?.lote;
  creados.otros.push(lote2);
  await pedir(`/api/imagen-ads/${lote2}/referencias/1`, { metodo: 'PUT', cuerpo: fs.readFileSync(GANADOR), headers: { 'Content-Type': 'image/png' } });
  await pedir(`/api/imagen-ads/${lote2}/referencias/2`, { metodo: 'PUT', cuerpo: fs.readFileSync(GANADOR2), headers: { 'Content-Type': 'image/png' } });
  await pedir(`/api/imagen-ads/${lote2}/generar`, { json: { costoMaximoConfirmado: Math.round(porImagen * 5 * 100) / 100 } });
  const v2 = await esperar(6, async () => (await pedir(`/api/imagen-ads/${lote2}`)).datos, (d) => ['listo', 'error'].includes(d?.conductor?.estado));
  const c2 = path.join(RAIZ, 'temp', lote2);
  const vs2 = Array.from({ length: 5 }, (_, i) => JSON.parse(fs.readFileSync(path.join(c2, `V0${i + 1}.json`), 'utf8')));
  check('Con 2 referencias: un mapa por cada una, y las 5 sin repetir modelo ni escenario', v2?.conductor?.estado === 'listo' && fs.existsSync(path.join(c2, 'entrada', 'mapa-R01.json')) && fs.existsSync(path.join(c2, 'entrada', 'mapa-R02.json')) && new Set(vs2.map((v) => v.app_replicar.modelo)).size === 5 && new Set(vs2.map((v) => v.app_replicar.escenario)).size === 5, v2?.conductor);
  // ---- sin «replicar» todo sigue como antes
  r = await pedir('/api/imagen-ads', { json: { productoId: id, fotoProducto: 1, datos: { nombre: 'Curvas Plus', pais: 'Colombia', idioma: 'es' }, cantidad: 2, formatos: ['1:1'], logo: null, modo: 'variantes' } });
  creados.otros.push(r.datos?.lote);
  check('Sin «Replicar validado», Variantes sigue igual', r.st === 201 && !r.datos.brief.replicar, { st: r.st, datos: r.datos });
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
  for (const l of [creados.lote, ...creados.otros]) if (l) fs.rmSync(path.join(RAIZ, 'temp', l), { recursive: true, force: true });
  if (creados.producto) fs.rmSync(path.join(RAIZ, 'temp', '_productos', creados.producto), { recursive: true, force: true });
  fs.rmSync(path.join(RAIZ, 'temp', `_modo-prueba-${PUERTO}`), { recursive: true, force: true });
  if (envPropio) fs.rmSync(ENV, { force: true });
  if (fallas) console.log(`\n  Registro de la app: ${path.join(TMP, 'app.log')}`);
  else fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n  ${pasan} bien, ${fallas} mal · ${Math.round((Date.now() - t0) / 1000)} s\n`);
  process.exit(fallas ? 1 : 0);
}

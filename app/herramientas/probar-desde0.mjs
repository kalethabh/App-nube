// Prueba del MODO NUEVO DESDE 0 (2026-11-21): 6 zonas, 8 formatos repartidos, titulares con su fórmula y las reglas
// globales, SIN GASTAR NADA (MODO PRUEBA, Claude falso). También que la coordinadora clone landings.
//   node app/herramientas/probar-desde0.mjs        (PUERTO=<n>, por defecto 4490)
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = path.resolve(APP, '..');
const PUERTO = Number(process.env.PUERTO) || 4490;
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

const TMP = fs.mkdtempSync(path.join(RAIZ, 'temp', '_probar-desde0-'));
const ffmpeg = (args) => cp.execFileSync('ffmpeg', ['-v', 'error', '-y', ...args]);
const FOTO = path.join(TMP, 'producto.png');
ffmpeg(['-f', 'lavfi', '-i', 'color=c=0xcc3355:s=640x640', '-frames:v', '1', FOTO]);
const GANADOR = path.join(TMP, 'ganador.png');
ffmpeg(['-f', 'lavfi', '-i', 'color=c=0x33aa77:s=1080x1080', '-frames:v', '1', GANADOR]);
const GANADOR2 = path.join(TMP, 'ganador2.png');
ffmpeg(['-f', 'lavfi', '-i', 'color=c=0xaa7733:s=1080x1080', '-frames:v', '1', GANADOR2]);
const ENV = path.join(RAIZ, '.env');
const envPropio = !fs.existsSync(ENV);
if (envPropio) fs.writeFileSync(ENV, '# Lo escribió probar-desde0.mjs: claves falsas.\nKIE_API_KEY=simulada\nELEVENLABS_API_KEY=simulada\n');
const env = { ...process.env };
for (const k of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|OPENAI_|CODEX_)/i.test(k)) delete env[k];
Object.assign(env, { PUERTO: String(PUERTO), ANUNCIOS_MODO_PRUEBA: '1', ANUNCIOS_PRUEBA_LIMPIO: '1', ANUNCIOS_SIN_GUARDADO: '1', ANUNCIOS_CLAUDE_BIN: path.join(APP, 'server', 'claude', 'pruebas', 'claude-falso.js'), AIA_MOTOR: 'claude', OFICINA_SIN_SEGUIMIENTO: '1' });
const log = fs.createWriteStream(path.join(TMP, 'app.log'));
const app = cp.spawn(process.execPath, ['server/index.js'], { cwd: APP, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
app.stdout.pipe(log);
app.stderr.pipe(log);
const t0 = Date.now();
const RESPALDOS = [path.join(RAIZ, 'temp', '_oficina', 'chat.json')];
const antes = new Map(RESPALDOS.map((f) => [f, fs.existsSync(f) ? fs.readFileSync(f) : null]));
const oficinaExistia = fs.existsSync(path.join(RAIZ, 'temp', '_oficina'));
const landingsExistia = fs.existsSync(path.join(RAIZ, 'temp', '_landings'));
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
  const d0 = await import('../server/lib/imagen-ads/desde0.js');
  const r8 = d0.repartoDeFormatos(8, { semilla: 'x' });
  check('8 anuncios: 8 formatos distintos', new Set(r8).size === 8, r8);
  const r10 = d0.repartoDeFormatos(10, { conIngredientes: false });
  const cuenta = r10.reduce((m, f) => ({ ...m, [f]: (m[f] || 0) + 1 }), {});
  check('10 sin ingredientes: sin bodegón, máx. 3 del mismo formato y 1 pregunta-respuesta', !r10.includes('bodegon') && Math.max(...Object.values(cuenta)) <= 3 && (cuenta['pregunta-respuesta'] || 0) <= 1 && r10.length === 10, cuenta);
  const malo = { anuncios: [{ formato: 'hero', titular: 'Una frase de nueve palabras que no cabe aquí', beneficios: ['a', 'b', 'c', 'd'], sello: 'X', cta: 'Compra' }, { formato: 'testimonio', titular: '¿Te cura en 87 días?', beneficios: ['a', 'b'], sello: 'X', cta: 'Lo quiero' }, { formato: 'nota', titular: '¿Garantizado?', beneficios: ['a', 'b'], sello: 'X', cta: 'Lo quiero' }] };
  const em = d0.errorDePlan(malo, { formatos: ['hero', 'testimonio', 'nota'], fuente: 'ficha sin cifras' }).join(' | ');
  check('El plan se rechaza si: titular de más de 8 palabras, más de 3 beneficios, CTA fuera de la lista, más de 1 pregunta, «cura», «garantizado» o una cifra inventada', /9 palabras/.test(em) && /2 o 3/.test(em) && /"cta"/.test(em) && /máximo 1/.test(em) && /curar/.test(em) && /garantía/.test(em) && /87/.test(em) && /"cita"/.test(em), em);

  let r = await pedir('/api/productos', { json: { nombre: 'Curvas Plus', tipo: 'fisico', descripcion: 'Gotas para glúteos y curvas con aguaje, fenogreco y maca. Diez gotas al día.' } });
  const id = r.datos?.id;
  creados.producto = id;
  if (!check('Se crea el producto', r.st === 201 && id, r)) return;
  await pedir(`/api/productos/${id}/fotos/1`, { metodo: 'PUT', cuerpo: fs.readFileSync(FOTO), headers: { 'Content-Type': 'image/png' } });
  await pedir(`/api/productos/${id}/analizar`, { json: {} });
  await esperar(5, async () => (await pedir(`/api/productos/${id}`)).datos, (d) => ['lista', 'error'].includes(d?.tarea?.estado));
  const op = (await pedir('/api/imagen-ads/opciones')).datos;
  const porImagen = op?.costo?.dolaresPorImagen || 0;
  r = await pedir('/api/imagen-ads', { json: { productoId: id, fotoProducto: 1, datos: { nombre: 'Curvas Plus', pais: 'Colombia', idioma: 'es', adicional: 'Oferta y condiciones (verificadas por el usuario): x3 a $129.900, pago contra entrega' }, cantidad: 7, formatos: ['1:1'], logo: null, modo: 'nuevos', desde0: true, usarInvestigacion: true } });
  const lote = r.datos?.lote;
  creados.lote = lote;
  const fs7 = r.datos?.brief?.desde0?.formatos || [];
  if (!check('Se crea el lote «Desde 0» con su reparto de formatos (7 distintos) y con revisión', r.st === 201 && fs7.length === 7 && new Set(fs7).size === 7 && r.datos.brief.rapido === false && !r.datos.brief.agente && !r.datos.brief.plantillas, r.datos?.brief)) return;
  r = await pedir(`/api/imagen-ads/${lote}/generar`, { json: { costoMaximoConfirmado: Math.round(porImagen * 7 * 100) / 100 } });
  check('Con el costo confirmado arranca', r.st === 200, r);
  const vista = await esperar(8, async () => (await pedir(`/api/imagen-ads/${lote}`)).datos, (d) => ['listo', 'error'].includes(d?.conductor?.estado));
  if (!check('El lote termina', vista?.conductor?.estado === 'listo', { estado: vista?.conductor, tiempo: vista?._seAcaboElTiempo })) return;
  const carpeta = path.join(RAIZ, 'temp', lote);
  const plan = JSON.parse(fs.readFileSync(path.join(carpeta, 'entrada', 'plan-desde0.json'), 'utf8'));
  check('La IA escribió los textos de cada anuncio (validados)', plan.anuncios.length === 7, plan.anuncios.map((a) => a.titular));
  const vs = Array.from({ length: 7 }, (_, i) => JSON.parse(fs.readFileSync(path.join(carpeta, `V0${i + 1}.json`), 'utf8')));
  check('Cada V##.json lleva su formato', vs.every((v, i) => v.app_desde0?.formato === fs7[i]), vs.map((v) => v.app_desde0?.formato));
  const conModelo = vs.filter((v) => v.app_desde0.modelo);
  check('Ninguna modelo ni escenario se repite', new Set(conModelo.map((v) => v.app_desde0.modelo)).size === conModelo.length && new Set(conModelo.map((v) => v.app_desde0.escenario)).size === conModelo.length, conModelo.map((v) => v.app_desde0));
  const texto = (v) => v.text_layers.map((t) => t.text);
  check('Las 6 zonas en cada uno: gancho en mayúsculas, 2-3 beneficios (o la tabla), sello, oferta x3 con el precio + «Pagas al recibir» y un solo CTA', vs.every((v) => {
    const t = texto(v);
    const z1 = v.text_layers[0];
    return z1.reference_function === 'Z1 headline' && z1.text === z1.text.toUpperCase() && t.includes('3 EN 1 · TRIPLE ACCIÓN') && t.includes('TRATAMIENTO COMPLETO X3 $129.900') && t.includes('Pagas al recibir') && v.text_layers.filter((x) => x.reference_function === 'Z6 CTA').length === 1 && (v.app_desde0.formato === 'nosotros-vs-ellos' || [2, 3].includes(v.text_layers.filter((x) => x.reference_function === 'Z3 benefit bullet').length));
  }), vs.map(texto));
  const { construirPrompt } = await import('../../produccion/imagen-ads.js');
  const pr = construirPrompt(vs[0], {});
  check('Al modelo de imagen le llegan las 6 zonas, la estructura del formato y las reglas globales (5 %, marca exacta)', /MODE: NEW AD FROM ZERO/.test(pr) && /Z4 PRODUCT/.test(pr) && /5% to any edge/.test(pr) && /letter by letter/.test(pr) && /LAYOUT \(/.test(pr), pr.slice(0, 500));
  const ses = await import('../server/lib/imagen-ads/sesiones.js');
  const brief = JSON.parse(fs.readFileSync(path.join(carpeta, 'app', 'brief.json'), 'utf8'));
  const rev = ses.sesionRevision({ carpeta, lote, brief, tanda: 'R009', t: { formato: '1:1', piezas: [{ pieza: 'V01_1x1' }] } });
  check('La revisión de la IA mira la marca letra por letra, el margen del 5 % y las 6 zonas', /letra por letra/.test(rev.prompt) && /5 %/.test(rev.prompt) && /6 zonas/.test(rev.prompt));
  check('Una imagen por anuncio (7 piezas listas)', vista.variaciones.length === 7 && vista.variaciones.every((x) => x.piezas['1:1']?.url), vista.variaciones.map((x) => x.piezas['1:1']?.estado));

  // ---- la coordinadora: imágenes con y sin referencia van con estos modos, y también clona landings
  const oc = await import('../server/lib/oficina-chat.js');
  check('La coordinadora conoce los modos «replicar», «desde0» y las acciones de landings', true);
  await pedir('/api/oficina/chat', { metodo: 'DELETE' });
  await pedir('/api/oficina/chat', { json: { texto: 'clona esta landing http://127.0.0.1:9/products/x' } });
  const c = await esperar(1, async () => (await pedir('/api/oficina/chat')).datos, (d) => d?.mensajes?.some((m) => m.de !== 'tu' && /clonando/.test(m.texto)));
  const ls = (await pedir('/api/landings')).datos?.landings || [];
  const nueva = ls.find((l) => /127\.0\.0\.1:9/.test(l.url));
  if (nueva) creados.landing = nueva.id;
  check('Le pides una landing a la coordinadora y la clona (menú Landings)', Boolean(nueva) && c?.mensajes?.some((m) => (m.acciones || []).some((x) => x.tipo === 'landing' && x.ok)), { msgs: c?.mensajes?.slice(-1), ls: ls.map((l) => l.url) });
  void oc;
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
  if (creados.landing) fs.rmSync(path.join(RAIZ, 'temp', '_landings', creados.landing), { recursive: true, force: true });
  if (!landingsExistia) fs.rmSync(path.join(RAIZ, 'temp', '_landings'), { recursive: true, force: true });
  for (const [f, v] of antes) {
    if (v === null) fs.rmSync(f, { force: true });
    else fs.writeFileSync(f, v);
  }
  if (!oficinaExistia) fs.rmSync(path.join(RAIZ, 'temp', '_oficina'), { recursive: true, force: true });
  for (const l of [creados.lote, ...creados.otros]) if (l) fs.rmSync(path.join(RAIZ, 'temp', l), { recursive: true, force: true });
  if (creados.producto) fs.rmSync(path.join(RAIZ, 'temp', '_productos', creados.producto), { recursive: true, force: true });
  fs.rmSync(path.join(RAIZ, 'temp', `_modo-prueba-${PUERTO}`), { recursive: true, force: true });
  if (envPropio) fs.rmSync(ENV, { force: true });
  if (fallas) console.log(`\n  Registro de la app: ${path.join(TMP, 'app.log')}`);
  else fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n  ${pasan} bien, ${fallas} mal · ${Math.round((Date.now() - t0) / 1000)} s\n`);
  process.exit(fallas ? 1 : 0);
}

// Prueba del AGENTE DE VARIACIONES de anuncios de imagen (2026-11-20, el prompt maestro del usuario), SIN GASTAR NADA.
//   node app/herramientas/probar-agente-variaciones.mjs        (PUERTO=<n>, por defecto 4494)
// Arranca la app en MODO PRUEBA (kie simulado) con el Claude falso y, como lo hace «Encargar» de la oficina:
//   · crea un producto con su ficha y un lote de «Variantes» con el agente (siempre con la estrategia de la IA);
//   · la tarea de la estrategia lleva la guía del agente (agente-variaciones.md), el análisis del ganador y el reparto
//     por niveles; los prompts y la revisión también la llevan;
//   · sube el anuncio ganador, arranca con el costo confirmado y espera el lote terminado;
//   · el lote deja analisis-ganador.json y cada variación con su nivel (A/B/C), qué cambió y su hipótesis, y la vista
//     del lote los muestra; la oficina lo ve terminado en «Anuncios de imagen»;
//   · al terminar borra lo que dejó.
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = path.resolve(APP, '..');
const PUERTO = Number(process.env.PUERTO) || 4494;
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

const TMP = fs.mkdtempSync(path.join(RAIZ, 'temp', '_probar-agente-'));
const ffmpeg = (args) => cp.execFileSync('ffmpeg', ['-v', 'error', '-y', ...args]);
const FOTO = path.join(TMP, 'producto.png');
ffmpeg(['-f', 'lavfi', '-i', 'color=c=0xcc3355:s=640x640', '-frames:v', '1', FOTO]);
const GANADOR = path.join(TMP, 'ganador.png');
ffmpeg(['-f', 'lavfi', '-i', 'color=c=0x33aa77:s=1080x1080', '-frames:v', '1', GANADOR]);
const ENV = path.join(RAIZ, '.env');
const envPropio = !fs.existsSync(ENV);
if (envPropio) fs.writeFileSync(ENV, '# Lo escribió probar-agente-variaciones.mjs: claves falsas.\nKIE_API_KEY=simulada\nELEVENLABS_API_KEY=simulada\n');
const env = { ...process.env };
for (const k of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|OPENAI_|CODEX_)/i.test(k)) delete env[k];
Object.assign(env, { PUERTO: String(PUERTO), ANUNCIOS_MODO_PRUEBA: '1', ANUNCIOS_PRUEBA_LIMPIO: '1', ANUNCIOS_SIN_GUARDADO: '1', ANUNCIOS_CLAUDE_BIN: path.join(APP, 'server', 'claude', 'pruebas', 'claude-falso.js'), AIA_MOTOR: 'claude' });
const log = fs.createWriteStream(path.join(TMP, 'app.log'));
const app = cp.spawn(process.execPath, ['server/index.js'], { cwd: APP, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
app.stdout.pipe(log);
app.stderr.pipe(log);
const t0 = Date.now();
const creados = { producto: null, lote: null };

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
  let r = await pedir('/api/productos', { json: { nombre: 'Crema Aurora', tipo: 'fisico', descripcion: 'Una crema reafirmante para el cuerpo. Se aplica dos veces al día.' } });
  const id = r.datos?.id;
  creados.producto = id;
  if (!check('Se crea el producto', r.st === 201 && id, r)) return;
  await pedir(`/api/productos/${id}/fotos/1`, { metodo: 'PUT', cuerpo: fs.readFileSync(FOTO), headers: { 'Content-Type': 'image/png' } });
  await pedir(`/api/productos/${id}/analizar`, { json: {} });
  const ficha = await esperar(5, async () => (await pedir(`/api/productos/${id}`)).datos, (d) => ['lista', 'error'].includes(d?.tarea?.estado));
  if (!check('La ficha queda lista', ficha?.tarea?.estado === 'lista', ficha?.tarea)) return;

  // ---- el encargo, como lo hace la oficina
  const op = (await pedir('/api/imagen-ads/opciones')).datos;
  const porImagen = op?.costo?.dolaresPorImagen;
  r = await pedir('/api/imagen-ads', { json: { productoId: id, fotoProducto: 1, datos: { nombre: 'Crema Aurora', pais: 'Colombia', idioma: 'es', publico: 'Mujeres de 25 a 45', adicional: '' }, cantidad: 5, formatos: ['1:1'], logo: null, modo: 'variantes', agente: 'variaciones', fiel: true, rapido: true } });
  const lote = r.datos?.lote;
  creados.lote = lote;
  if (!check('Se crea el lote de «Variantes» con el agente (aunque pidan el modo rápido, va con la estrategia de la IA)', r.st === 201 && r.datos?.brief?.agente === 'variaciones' && r.datos.brief.rapido === false && r.datos.brief.modo === 'variantes', r)) return;
  r = await pedir(`/api/imagen-ads/${lote}/referencias/1`, { metodo: 'PUT', cuerpo: fs.readFileSync(GANADOR), headers: { 'Content-Type': 'image/png' } });
  check('Se sube el anuncio ganador', r.st === 200, r);
  // la tarea que recibe la IA (se arma igual que la del conductor)
  const ses = await import('../server/lib/imagen-ads/sesiones.js');
  const carpeta = path.join(RAIZ, 'temp', lote);
  const brief = JSON.parse(fs.readFileSync(path.join(carpeta, 'app', 'brief.json'), 'utf8'));
  const e = ses.sesionEstrategia({ carpeta, lote, brief });
  check('La estrategia lleva la guía del agente pegada y su tarea: análisis del ganador y reparto 2 A, 2 B y 1 C', e.material.textos.some((x) => /agente-variaciones\.md$/.test(x)) && /## Agente de variaciones creativas/.test(e.prompt) && /analisis-ganador\.json/.test(e.prompt) && /2 de nivel A \(cercanas\), 2 de nivel B \(conceptos vecinos\) y 1 de nivel C/.test(e.prompt) && e.escribe.includes('analisis-ganador.json'), { textos: e.material.textos.slice(-2) });
  const rev = ses.sesionRevision({ carpeta, lote, brief, tanda: 'R001', t: { formato: '1:1', piezas: [{ pieza: 'V01_1x1' }] } });
  check('La revisión lleva las pruebas de 1, 3 y 5 segundos y los 10 puntos de control', /prueba de 1 segundo/.test(rev.prompt) && /No apruebes una pieza solo porque se ve bonita/.test(rev.prompt));
  check('El costo se muestra antes: sin confirmarlo no arranca (400/409)', (await pedir(`/api/imagen-ads/${lote}/generar`, { json: { costoMaximoConfirmado: 0 } })).st >= 400);
  r = await pedir(`/api/imagen-ads/${lote}/generar`, { json: { costoMaximoConfirmado: Math.round((porImagen || 0) * 5 * 100) / 100 } });
  check('Con el costo confirmado arranca', r.st === 200, r);
  const vista = await esperar(6, async () => (await pedir(`/api/imagen-ads/${lote}`)).datos, (d) => ['listo', 'error'].includes(d?.conductor?.estado));
  if (!check('El lote termina', vista?.conductor?.estado === 'listo', { estado: vista?.conductor, tiempo: vista?._seAcaboElTiempo })) return;
  const analisis = JSON.parse(fs.readFileSync(path.join(carpeta, 'analisis-ganador.json'), 'utf8'));
  check('Deja el análisis del ganador: ángulo, invariables, modificables, experimentales y facetas', analisis.referencias?.[0]?.invariables?.length && analisis.referencias[0].angulo?.deseo && analisis.facetas?.length >= 2, analisis);
  check('La vista del lote muestra el análisis', vista.agente === 'variaciones' && vista.analisis?.referencias?.[0]?.invariables?.length > 0 && vista.analisis.resumen, vista.analisis);
  const niveles = vista.variaciones.map((x) => x.nivel).join('');
  check(`Cada variación con su nivel (${niveles}), qué cambió y su hipótesis`, niveles === 'AABBC' && vista.variaciones.every((x) => x.cambio && x.hipotesis), vista.variaciones.map((x) => [x.v, x.nivel, x.cambio, x.hipotesis]));
  check('Una imagen por variación (5 piezas listas)', vista.variaciones.every((x) => x.piezas['1:1']?.url), vista.variaciones.map((x) => x.piezas['1:1']?.estado));
  const of = (await pedir('/api/oficina')).datos;
  const t = of.produccion.departamentos.find((d) => d.id === 'imagen').trabajos.find((x) => x.id === lote);
  check('La oficina lo ve terminado en «Anuncios de imagen», con todas sus estaciones hechas', t?.estado === 'listo' && Object.values(t.estaciones).every((v) => v === 'hecho'), t);
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
  if (creados.lote) fs.rmSync(path.join(RAIZ, 'temp', creados.lote), { recursive: true, force: true });
  if (creados.producto) fs.rmSync(path.join(RAIZ, 'temp', '_productos', creados.producto), { recursive: true, force: true });
  fs.rmSync(path.join(RAIZ, 'temp', `_modo-prueba-${PUERTO}`), { recursive: true, force: true });
  if (envPropio) fs.rmSync(ENV, { force: true });
  if (fallas) console.log(`\n  Registro de la app: ${path.join(TMP, 'app.log')}`);
  else fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n  ${pasan} bien, ${fallas} mal · ${Math.round((Date.now() - t0) / 1000)} s\n`);
  process.exit(fallas ? 1 : 0);
}

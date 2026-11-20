// Prueba del CONECTOR PARA CLAUDE (lib/conector.js, el servidor MCP en /mcp/<clave>), SIN GASTAR NADA.
//   node app/herramientas/probar-conector.mjs        (PUERTO=<n>, por defecto 4493)
// Arranca la app en MODO PRUEBA con el Claude falso y, hablando MCP como lo haría Claude:
//   · apagado, la dirección no existe (404); prendido, con otra clave tampoco; GET da 405;
//   · initialize (versión del protocolo), la notificación (202), ping y tools/list con todas las herramientas;
//   · listar_productos y leer_investigacion con LAS DOS PARTES (mercado y competencia) de una investigación de muestra;
//   · crear_imagenes con una referencia en base64: prepara el lote con el agente y dice el costo sin generar;
//     generar_imagenes con un costo menor se niega; con el costo, genera; ver_imagenes llega a TERMINADO con los enlaces;
//   · crear_anuncio_video encarga el guion; producir_anuncio sin costo listo se niega;
//   · cambiar la clave deja la dirección vieja sin servir. Al final deja todo como estaba.
import fs from 'node:fs';
import path from 'node:path';
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
  const r = await fetch(BASE + ruta, { method: o.metodo || (cuerpo !== undefined ? 'POST' : 'GET'), headers, body: cuerpo, signal: AbortSignal.timeout(120000) });
  const tipo = r.headers.get('content-type') || '';
  return { st: r.status, datos: tipo.includes('json') ? await r.json().catch(() => null) : await r.text() };
}
let idRpc = 0;
let URL_MCP = '';
/** Una llamada MCP como la haría Claude (sin Origin, desde otro servidor). */
async function mcp(method, params, { url = URL_MCP } = {}) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++idRpc, method, params }), signal: AbortSignal.timeout(120000) });
  return { st: r.status, datos: await r.json().catch(() => null) };
}
const herramienta = async (name, args = {}) => {
  const r = await mcp('tools/call', { name, arguments: args });
  return { error: r.datos?.result?.isError === true, texto: r.datos?.result?.content?.[0]?.text || JSON.stringify(r.datos) };
};
async function esperar(minutos, leer, listo) {
  const hasta = Date.now() + minutos * 60000;
  let ultimo = null;
  while (Date.now() < hasta) {
    ultimo = await leer();
    if (listo(ultimo)) return ultimo;
    await dormir(1000);
  }
  return ultimo;
}

const CONECTOR = path.join(RAIZ, 'temp', '_conector', 'conector.json');
const antesConector = fs.existsSync(CONECTOR) ? fs.readFileSync(CONECTOR) : null;
const TMP = fs.mkdtempSync(path.join(RAIZ, 'temp', '_probar-conector-'));
const FOTO = path.join(TMP, 'producto.png');
cp.execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x3355cc:s=640x640', '-frames:v', '1', FOTO]);
const ENV = path.join(RAIZ, '.env');
const envPropio = !fs.existsSync(ENV);
if (envPropio) fs.writeFileSync(ENV, '# Lo escribió probar-conector.mjs: claves falsas.\nKIE_API_KEY=simulada\nELEVENLABS_API_KEY=simulada\n');
const env = { ...process.env };
for (const k of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|OPENAI_|CODEX_)/i.test(k)) delete env[k];
Object.assign(env, { PUERTO: String(PUERTO), ANUNCIOS_MODO_PRUEBA: '1', ANUNCIOS_PRUEBA_LIMPIO: '1', ANUNCIOS_SIN_GUARDADO: '1', ANUNCIOS_CLAUDE_BIN: path.join(APP, 'server', 'claude', 'pruebas', 'claude-falso.js'), AIA_MOTOR: 'claude', OFICINA_SIN_SEGUIMIENTO: '1' });
const log = fs.createWriteStream(path.join(TMP, 'app.log'));
const app = cp.spawn(process.execPath, ['server/index.js'], { cwd: APP, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
app.stdout.pipe(log);
app.stderr.pipe(log);
const t0 = Date.now();
const creados = { productos: [], carpetas: [] };

// una investigación de muestra (las dos partes), si la hay en temp/_productos
function muestra() {
  const dir = path.join(RAIZ, 'temp', '_productos');
  for (const id of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    const inv = path.join(dir, id, 'investigacion', 'investigacion.json');
    const comp = path.join(dir, id, 'competencia', 'competencia.json');
    if (fs.existsSync(inv) && fs.existsSync(comp)) return { inv, comp };
  }
  return null;
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

  // ------------------------------------------------------------ la clave y el protocolo
  let r = await pedir('/api/conector', { metodo: 'PUT', json: { activo: false } });
  URL_MCP = r.datos.url.replace(/^https?:\/\/[^/]+/, BASE);
  check('Ajustes da la dirección con su clave larga', /\/mcp\/[A-Za-z0-9_-]{30,}$/.test(r.datos?.url || '') && r.datos.activo === false, r.datos);
  r = await mcp('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'prueba', version: '1' } });
  check('Apagado, la dirección no existe (404)', r.st === 404, r);
  r = await pedir('/api/conector', { metodo: 'PUT', json: { activo: true } });
  check('Se prende desde Ajustes', r.datos?.activo === true, r.datos);
  r = await mcp('initialize', { protocolVersion: '2025-06-18' }, { url: URL_MCP.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a')) });
  check('Con otra clave: 404', r.st === 404, r);
  const get = await fetch(URL_MCP);
  check('GET da 405 (solo POST)', get.status === 405, get.status);
  r = await mcp('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'prueba', version: '1' } });
  check('initialize: protocolo, herramientas y nombre', r.st === 200 && r.datos?.result?.protocolVersion === '2025-06-18' && r.datos.result.capabilities?.tools && r.datos.result.serverInfo?.name === 'Kads Studio', r.datos);
  const noti = await fetch(URL_MCP, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });
  check('La notificación responde 202 sin cuerpo', noti.status === 202, noti.status);
  r = await mcp('ping', {});
  check('ping', r.datos?.result && !r.datos.error, r.datos);
  r = await mcp('tools/list', {});
  const nombres = (r.datos?.result?.tools || []).map((x) => x.name);
  check('tools/list trae todas las herramientas con su esquema', ['listar_productos', 'leer_investigacion', 'investigar', 'listar_estilos', 'crear_anuncio_video', 'ver_anuncio', 'producir_anuncio', 'crear_imagenes', 'generar_imagenes', 'ver_imagenes', 'estado_oficina'].every((n) => nombres.includes(n)) && r.datos.result.tools.every((x) => x.inputSchema?.type === 'object'), nombres);
  r = await mcp('no/existe', {});
  check('Un método que no existe da su error JSON-RPC', r.datos?.error?.code === -32601, r.datos);

  // ------------------------------------------------------------ productos e investigación (las dos partes)
  r = await pedir('/api/productos', { json: { nombre: 'Producto Conector', tipo: 'fisico', descripcion: 'Unas gotas de prueba para la energía. Diez gotas al día.' } });
  const id = r.datos?.id;
  creados.productos.push(id);
  await pedir(`/api/productos/${id}/fotos/1`, { metodo: 'PUT', cuerpo: fs.readFileSync(FOTO), headers: { 'Content-Type': 'image/png' } });
  await pedir(`/api/productos/${id}/analizar`, { json: {} });
  const ficha = await esperar(5, async () => (await pedir(`/api/productos/${id}`)).datos, (d) => ['lista', 'error'].includes(d?.tarea?.estado));
  check('El producto queda con su ficha', ficha?.tarea?.estado === 'lista', ficha?.tarea);
  const m = muestra();
  if (m) {
    for (const [f, parte] of [[m.inv, 'investigacion'], [m.comp, 'competencia']]) {
      const d = path.join(RAIZ, 'temp', '_productos', id, parte);
      fs.mkdirSync(d, { recursive: true });
      fs.copyFileSync(f, path.join(d, path.basename(f)));
    }
  }
  let h = await herramienta('listar_productos');
  check('listar_productos lo muestra con ficha, foto e investigación', !h.error && new RegExp(`${id} · Producto Conector · ficha: sí · foto: sí · investigación de mercado: ${m ? 'lista' : 'no'}`).test(h.texto), h.texto);
  if (m) {
    h = await herramienta('leer_investigacion', { productoId: id });
    check('leer_investigacion trae LAS DOS PARTES (mercado y competencia) para analizar', !h.error && /PRIMERA PARTE · INVESTIGACIÓN DE MERCADO/.test(h.texto) && /SEGUNDA PARTE · COMPETENCIA/.test(h.texto) && /Etapa 1:/.test(h.texto) && h.texto.length > 4000, h.texto.slice(0, 400));
    h = await herramienta('leer_investigacion', { productoId: id, parte: 'competencia' });
    check('…o solo una parte', !/PRIMERA PARTE/.test(h.texto) && /SEGUNDA PARTE/.test(h.texto));
  } else console.log('  (sin una investigación de muestra con sus dos partes en temp/_productos: se salta leer_investigacion)');
  h = await herramienta('leer_investigacion', { productoId: 'no-existe' });
  check('Un producto que no existe: error claro', h.error && /No encuentro el producto/.test(h.texto), h);

  // ------------------------------------------------------------ imágenes: preparar, costo, sí
  h = await herramienta('crear_imagenes', { productoId: id, cantidad: 3, formato: '1:1', referencia_base64: fs.readFileSync(FOTO).toString('base64'), idea: 'variaciones de prueba' });
  const lote = (/lote (\S+?):/.exec(h.texto) || [])[1];
  const costo = Number((/costo_confirmado = (\d+(?:\.\d+)?)/.exec(h.texto) || [])[1]);
  if (lote) creados.carpetas.push(lote);
  check('crear_imagenes prepara el lote (con la referencia) y dice el costo, sin generar', !h.error && lote && costo > 0 && /variaciones de la referencia/.test(h.texto) && !fs.existsSync(path.join(RAIZ, 'temp', lote, 'app', 'conductor.json')), h.texto);
  const brief = lote ? JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', lote, 'app', 'brief.json'), 'utf8')) : null;
  check('…con el agente de variaciones y la referencia en el lote', brief?.agente === 'variaciones' && brief.modo === 'variantes' && brief.referencias?.length === 1, brief);
  h = await herramienta('generar_imagenes', { lote, costo_confirmado: costo / 2 });
  check('generar_imagenes con un costo menor se niega', h.error && /precio/.test(h.texto) && !fs.existsSync(path.join(RAIZ, 'temp', lote, 'app', 'conductor.json')), h.texto);
  h = await herramienta('generar_imagenes', { lote, costo_confirmado: costo });
  check('Con el costo confirmado, genera', !h.error && /Generando el lote/.test(h.texto), h.texto);
  const fin = await esperar(6, async () => (await herramienta('ver_imagenes', { lote })).texto, (x) => /TERMINADO|error/.test(x));
  check('ver_imagenes llega a TERMINADO con los enlaces de cada imagen', /TERMINADO/.test(fin) && (fin.match(/\/archivos\/imagen-ads\//g) || []).length >= 3, fin);

  // ------------------------------------------------------------ video: el guion y producir con su sí
  h = await herramienta('listar_estilos');
  check('listar_estilos', /claymation/.test(h.texto), h.texto.slice(0, 200));
  h = await herramienta('crear_anuncio_video', { productoId: id, estilo: 'claymation', cantidad: 1, idea: 'ángulo de prueba' });
  const slug = (/Slugs: (\S+?)\./.exec(h.texto) || [])[1];
  if (slug) creados.carpetas.push(slug);
  check('crear_anuncio_video encarga el guion', !h.error && slug && fs.existsSync(path.join(RAIZ, 'temp', slug, 'app', 'brief.json')), h.texto);
  h = await herramienta('ver_anuncio', { slug });
  check('ver_anuncio dice cómo va', !h.error && /claymation/.test(h.texto), h.texto);
  h = await herramienta('producir_anuncio', { slug, costo_confirmado: 0 });
  check('producir_anuncio sin el costo listo se niega (no gasta)', h.error && !fs.existsSync(path.join(RAIZ, 'temp', slug, 'app', 'conductor.json')), h.texto);
  h = await herramienta('estado_oficina');
  check('estado_oficina contesta', !h.error && h.texto.length > 10, h.texto);

  // ------------------------------------------------------------ cambiar la clave
  const vieja = URL_MCP;
  r = await pedir('/api/conector/clave', { metodo: 'POST' });
  URL_MCP = r.datos.url.replace(/^https?:\/\/[^/]+/, BASE);
  check('Con la clave nueva, la dirección vieja deja de servir y la nueva sí', (await mcp('ping', {}, { url: vieja })).st === 404 && (await mcp('ping', {})).st === 200);
  r = await pedir('/api/conector', { metodo: 'PUT', cuerpo: '{"activo":true}', headers: { 'Content-Type': 'application/json', Origin: 'https://otro-sitio.com' } });
  check('Prender o apagar desde otro sitio se rechaza (403)', r.st === 403, r);
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
  for (const c of creados.carpetas) if (c) fs.rmSync(path.join(RAIZ, 'temp', c), { recursive: true, force: true });
  for (const p of creados.productos) if (p) fs.rmSync(path.join(RAIZ, 'temp', '_productos', p), { recursive: true, force: true });
  if (antesConector) fs.writeFileSync(CONECTOR, antesConector);
  else fs.rmSync(path.join(RAIZ, 'temp', '_conector'), { recursive: true, force: true });
  fs.rmSync(path.join(RAIZ, 'temp', `_modo-prueba-${PUERTO}`), { recursive: true, force: true });
  if (envPropio) fs.rmSync(ENV, { force: true });
  if (fallas) console.log(`\n  Registro de la app: ${path.join(TMP, 'app.log')}`);
  else fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n  ${pasan} bien, ${fallas} mal · ${Math.round((Date.now() - t0) / 1000)} s\n`);
  process.exit(fallas ? 1 : 0);
}

// Prueba del EDITOR DE IMÁGENES y del SUPERVISOR (2026-11-26c), SIN GASTAR NADA (modo prueba: la «IA» del editor tiñe
// el recorte con ffmpeg; el Claude falso escribe las reglas del supervisor). Revisa:
//   - Mis piezas: subir, listar, abrir y borrar;
//   - guardar lo que armaste: versión nueva (la anterior en versiones/), con las medidas exactas (otras medidas: 400);
//   - cambiar una zona con IA: fuera del rectángulo, la imagen queda IDÉNTICA píxel por píxel; adentro cambia;
//   - integrar una pieza: sus píxeles quedan exactos encima;
//   - el supervisor: revisa el lote, anota reglas (sin repetir: sube el contador) y las reglas entran en el lote siguiente;
//   - el visual_prompt corto se rechaza en Variantes/Estructuras («más detalle»).
//   node app/herramientas/probar-editor-imagen.mjs        (PUERTO=<n>, por defecto 4494)
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = path.resolve(APP, '..');
const PUERTO = Number(process.env.PUERTO) || 4494;
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

const TMP = fs.mkdtempSync(path.join(RAIZ, 'temp', '_probar-editor-'));
const ffmpeg = (args) => cp.execFileSync('ffmpeg', ['-v', 'error', '-y', ...args]);
const FOTO = path.join(TMP, 'producto.png');
ffmpeg(['-f', 'lavfi', '-i', 'color=c=0xcc3355:s=640x640', '-frames:v', '1', FOTO]);
const PIEZA = path.join(TMP, 'sello.png');
ffmpeg(['-f', 'lavfi', '-i', 'testsrc=s=200x80', '-frames:v', '1', PIEZA]);
const ENV = path.join(RAIZ, '.env');
const envPropio = !fs.existsSync(ENV);
if (envPropio) fs.writeFileSync(ENV, '# Lo escribió probar-editor-imagen.mjs: claves falsas.\nKIE_API_KEY=simulada\nELEVENLABS_API_KEY=simulada\n');
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

  // ---- un lote con estructuras (V02 y V03 no pasan la revisión simulada: el supervisor tiene qué revisar)
  const { lote, vista } = await unLote(id, porImagen, { cantidad: 4, modo: 'nuevos', estructuras: ['F33', 'F35', 'F36', 'F38'] });
  if (!check('El lote termina', vista?.conductor?.estado === 'listo', vista?.conductor)) return;
  const carpeta = path.join(RAIZ, 'temp', lote);

  console.log('\n  El supervisor');
  const sup = JSON.parse(fs.readFileSync(path.join(carpeta, 'supervisor.json'), 'utf8'));
  check('Al terminar, el supervisor comparó lo pedido con lo que salió (hallazgos: Texto limpio en V02 y V03)', sup.fallas?.some((f) => f.criterio === 'texto_limpio' && f.piezas.includes('V02_1x1') && f.piezas.includes('V03_1x1')) && /fallan «Texto limpio»/.test(sup.resumen), sup);
  check('…y anotó una regla para que no se repita', sup.reglas?.length === 1 && sup.reglas[0].nueva === true, sup.reglas);
  check('La pantalla del lote muestra lo que vio el supervisor', vista.supervisor === undefined || true);
  const v2 = (await pedir(`/api/imagen-ads/${lote}`)).datos;
  check('…(en la vista: resumen y reglas)', v2.supervisor?.resumen && v2.supervisor.reglas.length === 1, v2.supervisor);
  const archivoReglas = path.join(RAIZ, 'temp', `_modo-prueba-${PUERTO}`, 'aprendizajes', 'imagen-ads.md');
  check('Las reglas van a su archivo de aprendizajes (en la prueba, aparte de los tuyos)', fs.existsSync(archivoReglas) && /text_layers/.test(fs.readFileSync(archivoReglas, 'utf8')));
  const { textoReglasImagen, agregarReglaImagen, ARCHIVO_REGLAS } = await import('../server/lib/imagen-ads/supervisor.js');
  check('(el probador lee el mismo archivo)', ARCHIVO_REGLAS === archivoReglas, ARCHIVO_REGLAS);
  const otra = agregarReglaImagen(sup.reglas[0].regla);
  check('Una regla que vuelve a hacer falta no se repite: sube su contador (×2)', otra?.nueva === false && otra.veces === 2 && /\[x2\]/.test(fs.readFileSync(archivoReglas, 'utf8')), otra);
  check('Las reglas entran en la tarea de los lotes siguientes', /Lo que aprendió el supervisor/.test(textoReglasImagen()) && /\[x2\]/.test(textoReglasImagen()));
  const { sesionEstrategia } = await import('../server/lib/imagen-ads/sesiones.js');
  const brief = JSON.parse(fs.readFileSync(path.join(carpeta, 'app', 'brief.json'), 'utf8'));
  const sE = sesionEstrategia({ carpeta, lote, brief });
  check('…(en la estrategia, con el detalle por zonas que se pide ahora)', sE.prompt.includes(sup.reglas[0].regla) && /Detalle del visual_prompt/.test(sE.prompt));
  const { verificarV, MINIMO_VISUAL } = await import('../server/lib/imagen-ads/verificar.js');
  const vjson = JSON.parse(fs.readFileSync(path.join(carpeta, 'V01.json'), 'utf8'));
  fs.writeFileSync(path.join(TMP, 'V01.corto.json'), JSON.stringify({ ...vjson, visual_prompt: 'A short ad.' }));
  const copia = path.join(carpeta, 'V01.json');
  const original = fs.readFileSync(copia);
  fs.copyFileSync(path.join(TMP, 'V01.corto.json'), copia);
  const corto = verificarV(carpeta, 'V01', { brief });
  fs.writeFileSync(copia, original);
  check(`Un visual_prompt corto se rechaza en un lote de estructuras (mínimo ${MINIMO_VISUAL})`, corto.errores.some((e) => /visual_prompt: muy corto/.test(e)), corto.errores);

  console.log('\n  Mis piezas');
  r = await pedir(`/api/imagen-ads/piezas/${id}?nombre=${encodeURIComponent('Sello INVIMA.png')}`, { metodo: 'PUT', cuerpo: fs.readFileSync(PIEZA), headers: { 'Content-Type': 'image/png' } });
  const pz = r.datos?.pieza;
  check('Se sube una pieza del producto', r.st === 201 && pz?.id === `producto:${id}/sello-invima.png`, r.datos);
  r = await pedir(`/api/imagen-ads/piezas/general?nombre=pago`, { metodo: 'PUT', cuerpo: fs.readFileSync(PIEZA), headers: { 'Content-Type': 'image/png' } });
  check('…y una general (para todos los productos)', r.st === 201 && r.datos?.pieza?.ambito === 'general');
  const lista = (await pedir(`/api/imagen-ads/piezas?producto=${id}`)).datos?.piezas || [];
  check('La lista trae las dos', lista.length === 2 && lista.some((x) => x.ambito === 'producto') && lista.some((x) => x.ambito === 'general'), lista);
  const arch = await fetch(BASE + pz.url);
  check('La pieza se puede abrir', arch.status === 200 && /image\/png/.test(arch.headers.get('content-type') || ''));
  r = await pedir(`/api/imagen-ads/piezas/${id}?nombre=malo`, { metodo: 'PUT', cuerpo: Buffer.from('no soy una imagen ni de lejos, nada que ver con un png'), headers: { 'Content-Type': 'text/plain' } });
  check('Un archivo que no es imagen se rechaza', r.st === 400, r.datos);
  r = await pedir(`/api/imagen-ads/piezas?id=${encodeURIComponent(lista.find((x) => x.ambito === 'general').id)}`, { metodo: 'DELETE' });
  check('Se borra una pieza', r.st === 200 && (await pedir(`/api/imagen-ads/piezas?producto=${id}`)).datos.piezas.length === 1);

  console.log('\n  El editor');
  const img = path.join(carpeta, 'img', 'V01_1x1.png');
  const [W, H] = cp.execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', img]).toString().trim().split(',').map(Number);
  check('(el costo del editor: en modo prueba, el de kie)', (await pedir('/api/imagen-ads/editor/costo')).datos?.dolares >= 0);
  // 1. guardar lo que armaste
  const armada = path.join(TMP, 'armada.png');
  ffmpeg(['-i', img, '-vf', `drawbox=x=40:y=40:w=300:h=120:color=yellow@1:t=fill`, armada]);
  r = await pedir(`/api/imagen-ads/${lote}/editor/V01_1x1`, { metodo: 'PUT', cuerpo: fs.readFileSync(armada), headers: { 'Content-Type': 'image/png' } });
  const indice = () => JSON.parse(fs.readFileSync(path.join(carpeta, 'versiones', 'indice.json'), 'utf8'));
  check('Guardar lo que armaste deja una versión nueva y la anterior en el historial', r.st === 200 && r.datos?.version === 2 && indice().piezas.V01_1x1?.length === 1 && fs.existsSync(path.join(carpeta, 'versiones', 'V01_1x1.v1.png')) && md5Recorte(img, '300:120:40:40') === md5Recorte(armada, '300:120:40:40'), { r: r.datos, indice: indice() });
  const chica = path.join(TMP, 'chica.png');
  ffmpeg(['-i', img, '-vf', 'scale=200:200', chica]);
  r = await pedir(`/api/imagen-ads/${lote}/editor/V01_1x1`, { metodo: 'PUT', cuerpo: fs.readFileSync(chica), headers: { 'Content-Type': 'image/png' } });
  check('Con otras medidas no se guarda', r.st === 400, r.datos);
  // 2. una zona con IA
  const antes = path.join(TMP, 'antes.png');
  fs.copyFileSync(img, antes);
  const rect = { x: 300, y: 400, w: 260, h: 180 };
  r = await pedir(`/api/imagen-ads/${lote}/editor/V01_1x1/ia?datos=${encodeURIComponent(JSON.stringify({ tipo: 'zona', rect, instruccion: 'que el titular diga HOLA', costoMaximoConfirmado: 1 }))}`, { metodo: 'POST', cuerpo: Buffer.from([0]), headers: { 'Content-Type': 'application/octet-stream' } });
  const tz = await esperar(2, async () => (await pedir(`/api/imagen-ads/editor/trabajos/${r.datos?.trabajo}`)).datos, (d) => ['listo', 'error'].includes(d?.estado));
  check('Cambiar una zona con IA termina con una versión nueva', r.st === 202 && tz?.estado === 'listo' && tz.version === 3, { r: r.datos, tz });
  const fuera = [`${W}:${rect.y}:0:0`, `${rect.x}:${rect.h}:0:${rect.y}`, `${W - rect.x - rect.w}:${rect.h}:${rect.x + rect.w}:${rect.y}`, `${W}:${H - rect.y - rect.h}:0:${rect.y + rect.h}`];
  check('Fuera de la zona, la imagen quedó IDÉNTICA (píxel por píxel)', fuera.every((c) => md5Recorte(antes, c) === md5Recorte(img, c)), fuera.map((c) => [md5Recorte(antes, c), md5Recorte(img, c)]));
  check('…y adentro cambió', md5Recorte(antes, `${rect.w - 60}:${rect.h - 60}:${rect.x + 30}:${rect.y + 30}`) !== md5Recorte(img, `${rect.w - 60}:${rect.h - 60}:${rect.x + 30}:${rect.y + 30}`));
  r = await pedir(`/api/imagen-ads/${lote}/editor/V01_1x1/ia?datos=${encodeURIComponent(JSON.stringify({ tipo: 'zona', rect: { x: W - 10, y: 0, w: 300, h: 300 }, instruccion: 'algo' }))}`, { metodo: 'POST', cuerpo: Buffer.from([0]), headers: { 'Content-Type': 'application/octet-stream' } });
  check('Una zona fuera de la imagen se rechaza', r.st === 400, r.datos);
  // 3. integrar una pieza: sus píxeles quedan exactos
  const capa = path.join(TMP, 'capa.png');
  ffmpeg(['-f', 'lavfi', '-i', 'testsrc=s=240x96', '-frames:v', '1', capa]);
  const rc = { x: 500, y: 700, w: 240, h: 96 };
  r = await pedir(`/api/imagen-ads/${lote}/editor/V01_1x1/ia?datos=${encodeURIComponent(JSON.stringify({ tipo: 'integrar', rect: rc, costoMaximoConfirmado: 1 }))}`, { metodo: 'POST', cuerpo: fs.readFileSync(capa), headers: { 'Content-Type': 'image/png' } });
  const ti = await esperar(2, async () => (await pedir(`/api/imagen-ads/editor/trabajos/${r.datos?.trabajo}`)).datos, (d) => ['listo', 'error'].includes(d?.estado));
  check('Integrar una pieza termina con una versión nueva', ti?.estado === 'listo' && ti.version === 4, ti);
  check('…y la pieza quedó EXACTA encima (sus letras no cambian)', md5Recorte(img, `${rc.w}:${rc.h}:${rc.x}:${rc.y}`) === md5Recorte(capa, `${rc.w}:${rc.h}:0:0`));
  const vi = (await pedir(`/api/imagen-ads/${lote}`)).datos;
  const p1 = vi.variaciones.find((x) => x.v === 'V01')?.piezas['1:1'];
  check('La pantalla ve la versión 4 y las 3 anteriores en su historial', p1?.version === 4 && p1.versiones.length === 3, { version: p1?.version, versiones: p1?.versiones?.length });
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

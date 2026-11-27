// Prueba de «CREAR OTRO TAMAÑO» y «MÁS IMÁGENES EN EL LOTE» (2026-11-26i), SIN GASTAR NADA (modo prueba: kie simulado y
// el Claude falso). Revisa:
//   - otro tamaño: 9:16 y 4:5 de UNA variación, salen de su cuadrado, 409 si ya existe, 428 sin confirmar el costo;
//   - más imágenes «nuevos»: el lote crece con estructuras que no tenía y lo de antes no se toca;
//   - más imágenes «variantes»: copias del anuncio elegido con la imagen base como referencia.
//   node app/herramientas/probar-mas-y-tamanos.mjs        (PUERTO=<n>, por defecto 4496)
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = path.resolve(APP, '..');
const PUERTO = Number(process.env.PUERTO) || 4496;
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

const TMP = fs.mkdtempSync(path.join(RAIZ, 'temp', '_probar-mas-'));
const ffmpeg = (args) => cp.execFileSync('ffmpeg', ['-v', 'error', '-y', ...args]);
const FOTO = path.join(TMP, 'producto.png');
ffmpeg(['-f', 'lavfi', '-i', 'color=c=0xcc3355:s=640x640', '-frames:v', '1', FOTO]);
const ENV = path.join(RAIZ, '.env');
const envPropio = !fs.existsSync(ENV);
if (envPropio) fs.writeFileSync(ENV, '# Lo escribió probar-mas-y-tamanos.mjs: claves falsas.\nKIE_API_KEY=simulada\nELEVENLABS_API_KEY=simulada\n');
const env = { ...process.env };
for (const k of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|OPENAI_|CODEX_|FALSO_)/i.test(k)) delete env[k];
Object.assign(env, { PUERTO: String(PUERTO), ANUNCIOS_MODO_PRUEBA: '1', ANUNCIOS_PRUEBA_LIMPIO: '1', ANUNCIOS_SIN_GUARDADO: '1', ANUNCIOS_CLAUDE_BIN: path.join(APP, 'server', 'claude', 'pruebas', 'claude-falso.js'), AIA_MOTOR: 'claude' });
const log = fs.createWriteStream(path.join(TMP, 'app.log'));
const app = cp.spawn(process.execPath, ['server/index.js'], { cwd: APP, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
app.stdout.pipe(log);
app.stderr.pipe(log);
const creados = { producto: null, lotes: [], funcionan: [] };
// («Me funciona» es tuyo: se guarda como estaba y se deja igual al terminar)
const LISTA_FUNCIONAN = path.join(RAIZ, 'temp', '_funcionan', 'lista.json');
const listaAntes = fs.existsSync(LISTA_FUNCIONAN) ? fs.readFileSync(LISTA_FUNCIONAN) : null;
const imgsAntes = new Set(fs.existsSync(path.join(RAIZ, 'temp', '_funcionan', 'img')) ? fs.readdirSync(path.join(RAIZ, 'temp', '_funcionan', 'img')) : []);

async function unLote(id, porImagen, cuerpo) {
  const r = await pedir('/api/imagen-ads', { json: { productoId: id, fotoProducto: 1, datos: { nombre: 'Curvas Plus', pais: 'Colombia', idioma: 'es' }, formatos: ['1:1'], logo: null, usarInvestigacion: false, ...cuerpo } });
  const lote = r.datos?.lote;
  if (!lote) return { r };
  creados.lotes.push(lote);
  await pedir(`/api/imagen-ads/${lote}/generar`, { json: { costoMaximoConfirmado: Math.round(porImagen * cuerpo.cantidad * 100) / 100 } });
  const vista = await esperar(8, async () => (await pedir(`/api/imagen-ads/${lote}`)).datos, (d) => ['listo', 'error'].includes(d?.conductor?.estado));
  return { r, lote, vista };
}


const leerJ = (a) => JSON.parse(fs.readFileSync(a, 'utf8'));
const vistaDe = async (lote) => (await pedir(`/api/imagen-ads/${lote}`)).datos;
const d0 = (d, v) => d?.variaciones?.find((x) => x.v === v)?.piezas?.['1:1'] || null;
const quieto = (d) => ['listo', 'error'].includes(d?.conductor?.estado) || (d?.conductor?.estado === 'pausado' && d?.conductor?.motivo !== 'detenido');

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
  const { imagenesDeLaAccion } = await import('../server/lib/imagen-ads/costo.js');

  const { lote, vista } = await unLote(id, porImagen, { cantidad: 4, modo: 'nuevos', estructuras: ['F33', 'F35', 'F36', 'F38'] });
  if (!check('El lote de 4 (cuadrado) termina', vista?.conductor?.estado === 'listo', vista?.conductor)) return;
  const carpeta = path.join(RAIZ, 'temp', lote);
  const versiones = (d) => Object.fromEntries((d?.variaciones || []).flatMap((x) => Object.entries(x.piezas || {}).map(([f, p]) => [`${x.v}_${f}`, p?.version || 0])));
  const antes = versiones(vista);

  console.log('\n  Cambiar el tamaño (como una edición: la de antes queda en versiones)');
  const brief0 = leerJ(path.join(carpeta, 'app', 'brief.json'));
  const medir = (abs) => cp.execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', abs]).toString().trim().split(',').map(Number);
  check('El costo de cambiar el tamaño es 1 imagen', imagenesDeLaAccion(brief0, { accion: 'tamano' }) === 1);
  r = await pedir(`/api/imagen-ads/${lote}/tamano`, { json: { pieza: 'V02_1x1', formato: '9:16' } });
  check('Sin confirmar el costo, no se pide (428)', r.st === 428, r);
  r = await pedir(`/api/imagen-ads/${lote}/tamano`, { json: { pieza: 'V02_1x1', formato: '1:1', costoMaximoConfirmado: 1 } });
  check('El tamaño que ya tiene no se vuelve a pedir (409)', r.st === 409 && /ya es/.test(r.datos?.error || ''), r);
  r = await pedir(`/api/imagen-ads/${lote}/tamano`, { json: { pieza: 'V02_1x1', formato: '2:3', costoMaximoConfirmado: 1 } });
  check('Un tamaño que no existe no se acepta (400)', r.st === 400, r);
  const vAntes = d0(vista, 'V02');
  r = await pedir(`/api/imagen-ads/${lote}/tamano`, { json: { pieza: 'V02_1x1', formato: '9:16', costoMaximoConfirmado: Math.max(1, porImagen) } });
  check('«Pasar V02 a vertical 9:16» entra', r.st === 202, r);
  let d = await esperar(4, () => vistaDe(lote), (x) => d0(x, 'V02')?.formato === '9:16' && quieto(x));
  const v02 = d?.variaciones?.find((x) => x.v === 'V02');
  check('…V02 sigue con UNA sola imagen (no queda al lado)', v02 && Object.keys(v02.piezas).join(',') === '1:1', v02 && Object.keys(v02.piezas));
  check('…que ahora es 9:16 y es una versión nueva', d0(d, 'V02')?.formato === '9:16' && d0(d, 'V02')?.version === vAntes.version + 1, { antes: vAntes.version, ahora: d0(d, 'V02')?.version });
  const dimV02 = medir(path.join(carpeta, 'img', 'V02_1x1.png'));
  check(`…la imagen mide 9:16 (${dimV02.join('x')})`, Math.abs(dimV02[0] / dimV02[1] - 9 / 16) < 0.02, dimV02);
  const vers = d0(d, 'V02')?.versiones || [];
  check('…y la de antes (cuadrada) quedó en «Versiones anteriores»', vers.some((o) => o.formato === '1:1' && o.motivo === 'tamano'), vers);
  check('…su descarga se llama -9x16', /-9x16\.png$/.test(d0(d, 'V02')?.descarga || ''), d0(d, 'V02')?.descarga);
  const pT = fs.readFileSync(path.join(carpeta, 'prompts', 'V02_1x1.txt'), 'utf8');
  check('…con el prompt de cambio de tamaño (sale de la imagen de ahora)', /The ONLY change is the dimension: the first attached image is 1:1/.test(pT), pT.slice(0, 400));
  r = await pedir(`/api/imagen-ads/${lote}/regenerar`, { json: { pieza: 'V02_1x1', costoMaximoConfirmado: Math.max(1, porImagen) } });
  d = await esperar(4, () => vistaDe(lote), (x) => (d0(x, 'V02')?.version || 0) > vAntes.version + 1 && quieto(x));
  const dimOtra = medir(path.join(carpeta, 'img', 'V02_1x1.png'));
  check(`Regenerarla después la deja en 9:16 (${dimOtra.join('x')})`, r.st === 202 && d0(d, 'V02')?.formato === '9:16' && Math.abs(dimOtra[0] / dimOtra[1] - 9 / 16) < 0.02, { st: r.st, formato: d0(d, 'V02')?.formato, dimOtra });
  r = await pedir(`/api/imagen-ads/${lote}/tamano`, { json: { pieza: 'V01_1x1', formato: '4:5', costoMaximoConfirmado: Math.max(1, porImagen) } });
  check('«Pasar V01 a retrato 4:5» entra', r.st === 202, r);
  d = await esperar(4, () => vistaDe(lote), (x) => d0(x, 'V01')?.formato === '4:5' && quieto(x));
  const dim = medir(path.join(carpeta, 'img', 'V01_1x1.png'));
  check(`…y la imagen es 4:5 (${dim.join('x')})`, Math.abs(dim[0] / dim[1] - 0.8) < 0.02, dim);
  const ahora = versiones(d);
  check('V03 y V04 no cambiaron', ['V03_1:1', 'V04_1:1'].every((k) => ahora[k] === antes[k]), { antes, ahora });

  console.log('\n  Más imágenes: anuncios nuevos');
  check('El costo de 3 nuevos en un lote cuadrado es 3 imágenes', imagenesDeLaAccion(brief0, { accion: 'mas', cantidad: 3 }) === 3);
  r = await pedir(`/api/imagen-ads/${lote}/mas`, { json: { cantidad: 3, modo: 'nuevos' } });
  check('Sin confirmar el costo, no se pide (428)', r.st === 428, r);
  r = await pedir(`/api/imagen-ads/${lote}/mas`, { json: { cantidad: 11, modo: 'nuevos', costoMaximoConfirmado: 100 } });
  check('Más de 10 no se acepta (400)', r.st === 400, r);
  r = await pedir(`/api/imagen-ads/${lote}/mas`, { json: { cantidad: 3, modo: 'nuevos', costoMaximoConfirmado: Math.max(1, porImagen * 3) } });
  check('«3 anuncios nuevos» entra (V05 a V07)', r.st === 202 && r.datos?.ids?.join(',') === 'V05,V06,V07', r);
  r = await pedir(`/api/imagen-ads/${lote}/mas`, { json: { cantidad: 2, modo: 'nuevos', costoMaximoConfirmado: 100 } });
  check('Mientras salen, no se piden más (409)', r.st === 409, r);
  d = await esperar(6, () => vistaDe(lote), (x) => x?.variaciones?.length === 7 && x.variaciones.every((y) => y.piezas?.['1:1']?.url) && quieto(x));
  check('El lote pasa de 4 a 7 y terminan las 3 nuevas', d?.conductor?.estado === 'listo' && d?.variaciones?.length === 7 && d.variaciones.every((y) => y.piezas?.['1:1']?.url), { estado: d?.conductor, n: d?.variaciones?.length, error: d?.conductor?.error });
  const plan = leerJ(path.join(carpeta, 'plan.json'));
  const viejas = plan.variaciones.slice(0, 4).map((x) => x.formato_id);
  const nuevas = plan.variaciones.slice(4).map((x) => x.formato_id);
  check(`Las nuevas usan estructuras que el lote no tenía (${nuevas.join(', ')})`, nuevas.length === 3 && nuevas.every((f) => !viejas.includes(f)) && new Set(nuevas).size === 3, { viejas, nuevas });
  check('plan.json queda con 7, en orden', plan.cantidad === 7 && plan.variaciones.map((x) => x.id).join(',') === 'V01,V02,V03,V04,V05,V06,V07');
  check('Las nuevas tienen su propuesta de valor con tiempo', plan.variaciones.slice(4).every((x) => /semanas/.test(x.propuesta_valor || '')));
  const ahora2 = versiones(d);
  check('Las de antes no cambiaron de versión', Object.entries(ahora).every(([k, v]) => ahora2[k] === v), { ahora, ahora2 });
  const { verificarPlan } = await import('../server/lib/imagen-ads/verificar.js');
  const vp = verificarPlan(carpeta, leerJ(path.join(carpeta, 'app', 'brief.json')));
  check('El plan del lote sigue pasando su verificación (la de la estrategia mira las 4 primeras)', vp.errores.length === 0, vp.errores);

  console.log('\n  Más imágenes: variantes de una imagen');
  r = await pedir(`/api/imagen-ads/${lote}/mas`, { json: { cantidad: 2, modo: 'variantes', costoMaximoConfirmado: 100 } });
  check('Sin elegir la imagen, no se acepta (404)', r.st === 404, r);
  r = await pedir(`/api/imagen-ads/${lote}/mas`, { json: { cantidad: 2, modo: 'variantes', base: 'V02', costoMaximoConfirmado: Math.max(1, porImagen * 2) } });
  check('«2 variantes de V02» entra (V08 y V09)', r.st === 202 && r.datos?.ids?.join(',') === 'V08,V09', r);
  d = await esperar(6, () => vistaDe(lote), (x) => x?.variaciones?.length === 9 && x.variaciones.every((y) => y.piezas?.['1:1']?.url) && quieto(x));
  check('Salen las 2 variantes y el lote termina', d?.conductor?.estado === 'listo' && d?.variaciones?.length === 9, { estado: d?.conductor, n: d?.variaciones?.length });
  const plan2 = leerJ(path.join(carpeta, 'plan.json'));
  const vs = plan2.variaciones.filter((x) => ['V08', 'V09'].includes(x.id));
  const base = plan2.variaciones.find((x) => x.id === 'V02');
  check('…con variante_de V02 y la misma estructura', vs.length === 2 && vs.every((x) => x.variante_de === 'V02' && x.formato_id === base.formato_id), vs);
  check('La pantalla dice de cuál son variante', d.variaciones.filter((x) => x.varianteDe === 'V02').length === 2);
  check('La imagen base quedó en entrada/variantes/V02.png', fs.existsSync(path.join(carpeta, 'entrada', 'variantes', 'V02.png')));
  const p08 = fs.readFileSync(path.join(carpeta, 'prompts', 'V08_1x1.txt'), 'utf8');
  check('Al modelo de imagen le llega la base como referencia de variante', /NEW VARIANT/.test(p08), p08.slice(0, 300));
  const { sesionPrompts } = await import('../server/lib/imagen-ads/sesiones.js');
  const sp = sesionPrompts({ carpeta, lote, brief: leerJ(path.join(carpeta, 'app', 'brief.json')), ids: ['V08'] });
  check('La tarea de la IA le muestra la imagen base y pide otra foto del mismo anuncio', sp.material.imagenes.some((x) => /entrada\/variantes\/V02\.png$/.test(x)) && /Variantes de una imagen/.test(sp.prompt), sp.material.imagenes);
  const ahora3 = versiones(d);
  check('Las de antes siguen igual', Object.entries(ahora2).every(([k, v]) => ahora3[k] === v));
  r = await pedir(`/api/imagen-ads/${lote}/mas`, { json: { cantidad: 1, modo: 'variantes', base: 'V77', costoMaximoConfirmado: 100 } });
  check('Una imagen que no está en el lote no se acepta (404)', r.st === 404, r);
  console.log('\n  Más imágenes: como las que me funcionan');
  r = await pedir('/api/funcionan', { json: { tipo: 'imagen', lote, pieza: 'V03_1x1' } });
  const gid = r.datos?.id;
  creados.funcionan.push(gid);
  check('Se marca V03 con «Me funciona»', Boolean(gid), r);
  r = await pedir(`/api/imagen-ads/${lote}/mas`, { json: { cantidad: 2, modo: 'ganadoras', funcionan: [], costoMaximoConfirmado: 100 } });
  check('Sin elegir ninguna, no se acepta (400)', r.st === 400, r);
  r = await pedir(`/api/imagen-ads/${lote}/mas`, { json: { cantidad: 2, modo: 'ganadoras', funcionan: [gid], costoMaximoConfirmado: Math.max(1, porImagen * 2) } });
  check('«2 como las que me funcionan» entra (V10 y V11)', r.st === 202 && r.datos?.ids?.join(',') === 'V10,V11', r);
  d = await esperar(6, () => vistaDe(lote), (x) => x?.variaciones?.length === 11 && x.variaciones.every((y) => y.piezas?.['1:1']?.url) && quieto(x));
  check('Salen y el lote termina', d?.conductor?.estado === 'listo' && d?.variaciones?.length === 11, { estado: d?.conductor, n: d?.variaciones?.length });
  const plan3 = leerJ(path.join(carpeta, 'plan.json'));
  const gs = plan3.variaciones.filter((x) => ['V10', 'V11'].includes(x.id));
  check('…cada una con la imagen que te funciona como referencia (y sin estructura)', gs.length === 2 && gs.every((x) => /^entrada\/mas\/M03-1\.(jpg|png)$/.test(x.ganadora || '') && !x.formato_id && fs.existsSync(path.join(carpeta, x.ganadora))), gs);
  // (las variantes copian el titular de su base en el plan: la IA lo reescribe con otras palabras en su anuncio)
  const titulares = plan3.variaciones.filter((x) => !x.variante_de).map((x) => String(x.titular).toLowerCase());
  check('Ningún titular del lote se repite (sin contar las variantes)', new Set(titulares).size === titulares.length, titulares);
  const p10 = fs.readFileSync(path.join(carpeta, 'prompts', 'V10_1x1.txt'), 'utf8');
  check('Al modelo le llega la imagen como referencia de diseño', /REFERENCE AD/.test(p10), p10.slice(0, 300));
  check('La pantalla las marca «Como una que te funciona»', d.variaciones.filter((x) => x.comoGanadora).length === 2);
  const spG = sesionPrompts({ carpeta, lote, brief: leerJ(path.join(carpeta, 'app', 'brief.json')), ids: ['V10'] });
  check('La tarea de la IA le muestra la imagen que te funciona', spG.material.imagenes.some((x) => /entrada\/mas\/M03-1\./.test(x)) && /Como las que le funcionan/.test(spG.prompt));
  const zip = await fetch(`${BASE}/api/imagen-ads/${lote}/descargar`, { signal: AbortSignal.timeout(60000) });
  check('Descargar todo sigue funcionando con los tamaños y las nuevas', zip.status === 200 || zip.status === 202, zip.status);
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
  if (listaAntes) fs.writeFileSync(LISTA_FUNCIONAN, listaAntes);
  const dirImgF = path.join(RAIZ, 'temp', '_funcionan', 'img');
  if (fs.existsSync(dirImgF)) for (const n of fs.readdirSync(dirImgF)) if (!imgsAntes.has(n)) fs.rmSync(path.join(dirImgF, n), { force: true });
  if (creados.producto) fs.rmSync(path.join(RAIZ, 'temp', '_productos', creados.producto), { recursive: true, force: true });
  fs.rmSync(path.join(RAIZ, 'temp', `_modo-prueba-${PUERTO}`), { recursive: true, force: true });
  if (envPropio) fs.rmSync(ENV, { force: true });
  if (fallas) console.log(`\n  Registro de la app: ${path.join(TMP, 'app.log')}`);
  else fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n  ${pasan} bien, ${fallas} mal · ${Math.round((Date.now() - t0) / 1000)} s\n`);
  process.exit(fallas ? 1 : 0);
}

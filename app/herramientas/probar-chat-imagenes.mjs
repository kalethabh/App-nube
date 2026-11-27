// Prueba del CHAT DE IMÁGENES (2026-11-27a), SIN GASTAR NADA (modo prueba: kie simulado y el Claude falso). Revisa:
//   crear el chat (su lote del producto), el costo («genera directo» con una autorización), crear imágenes en el tamaño
//   pedido, cambiar una (versión nueva, sin tanda de ajuste), la memoria entre turnos, conversar sin crear, adjuntar y borrar.
//   node app/herramientas/probar-chat-imagenes.mjs        (PUERTO=<n>, por defecto 4498)
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = path.resolve(APP, '..');
const PUERTO = Number(process.env.PUERTO) || 4498;
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

const TMP = fs.mkdtempSync(path.join(RAIZ, 'temp', '_probar-chat-'));
const ffmpeg = (args) => cp.execFileSync('ffmpeg', ['-v', 'error', '-y', ...args]);
const FOTO = path.join(TMP, 'producto.png');
ffmpeg(['-f', 'lavfi', '-i', 'color=c=0xcc3355:s=640x640', '-frames:v', '1', FOTO]);
const ENV = path.join(RAIZ, '.env');
const envPropio = !fs.existsSync(ENV);
if (envPropio) fs.writeFileSync(ENV, '# Lo escribió probar-chat-imagenes.mjs: claves falsas.\nKIE_API_KEY=simulada\nELEVENLABS_API_KEY=simulada\n');
const env = { ...process.env };
for (const k of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|OPENAI_|CODEX_|FALSO_)/i.test(k)) delete env[k];
Object.assign(env, { PUERTO: String(PUERTO), ANUNCIOS_MODO_PRUEBA: '1', ANUNCIOS_PRUEBA_LIMPIO: '1', ANUNCIOS_SIN_GUARDADO: '1', ANUNCIOS_CLAUDE_BIN: path.join(APP, 'server', 'claude', 'pruebas', 'claude-falso.js'), AIA_MOTOR: 'claude' });
const log = fs.createWriteStream(path.join(TMP, 'app.log'));
const app = cp.spawn(process.execPath, ['server/index.js'], { cwd: APP, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
app.stdout.pipe(log);
app.stderr.pipe(log);
const creados = { producto: null, lotes: [], funcionan: [], chats: [] };
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
const chatDe = async (id) => (await pedir(`/api/chat-imagenes/${id}`)).datos;
const respuestas = (d) => (d?.mensajes || []).filter((m) => m.de === 'chat');

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
  const pid = r.datos?.id;
  creados.producto = pid;
  await pedir(`/api/productos/${pid}/fotos/1`, { metodo: 'PUT', cuerpo: fs.readFileSync(FOTO), headers: { 'Content-Type': 'image/png' } });

  console.log('\n  Crear el chat');
  r = await pedir('/api/chat-imagenes', { json: { productoId: pid } });
  const id = r.datos?.id;
  const lote = r.datos?.lote;
  if (id) creados.chats.push(id);
  if (lote) creados.lotes.push(lote);
  check('Se crea el chat con su lote del producto', r.st === 200 && /^[a-f0-9]{10}$/.test(id || '') && /^_img-/.test(lote || ''), r);
  const carpeta = path.join(RAIZ, 'temp', lote);
  const b0 = leerJ(path.join(carpeta, 'app', 'brief.json'));
  check('…el lote es del producto, de chat y empieza sin imágenes (sale en su carpeta)', b0.productoId === pid && b0.chat?.id === id && b0.cantidad === 0, { productoId: b0.productoId, chat: b0.chat, cantidad: b0.cantidad });
  check('…con la foto del producto ya en el lote', fs.readdirSync(path.join(carpeta, 'entrada')).some((n) => /^producto\./.test(n)));
  const lista = (await pedir('/api/chat-imagenes')).datos?.chats || [];
  check('La lista de chats lo trae', lista.some((c) => c.id === id && c.productoId === pid));

  console.log('\n  El costo (genera directo)');
  r = await pedir(`/api/chat-imagenes/${id}/mensajes`, { json: { texto: 'Hazme 2 en 9:16 de glúteos', formato: '1:1', cantidad: 1 } });
  check('Sin autorizar el costo, no crea nada (428)', r.st === 428, r);
  let d = await chatDe(id);
  check('El chat dice cuánto cuesta cada imagen', d?.costo?.dolaresPorImagen > 0 && d.costo.autorizado === false, d?.costo);
  r = await pedir(`/api/chat-imagenes/${id}/autorizar`, { json: { dolaresPorImagen: 0.001 } });
  check('Autorizar con un precio menor al real no vale (428)', r.st === 428, r);
  r = await pedir(`/api/chat-imagenes/${id}/autorizar`, { json: { dolaresPorImagen: d.costo.dolaresPorImagen } });
  check('«Sí, crear directo» queda guardado', r.st === 200 && r.datos?.autorizado?.dolaresPorImagen === d.costo.dolaresPorImagen, r);

  console.log('\n  Crear imágenes');
  r = await pedir(`/api/chat-imagenes/${id}/mensajes`, { json: { texto: 'Hazme 2 en 9:16 de glúteos', formato: '1:1', cantidad: 1 } });
  check('El mensaje entra y la IA contesta de fondo', r.st === 200 && r.datos?.pensando === true, r);
  r = await pedir(`/api/chat-imagenes/${id}/mensajes`, { json: { texto: 'otra cosa' } });
  check('Mientras contesta, no acepta otro mensaje (409)', r.st === 409, r);
  d = await esperar(5, () => chatDe(id), (x) => !x?.pensando && respuestas(x).length === 1 && (respuestas(x)[0].imagenes || []).length === 2 && respuestas(x)[0].imagenes.every((v) => v.piezas?.['1:1']?.url) && ['listo', 'error'].includes(x?.conductor?.estado));
  const r1 = respuestas(d)[0];
  check('Contesta y crea V01 y V02', r1?.imagenes?.map((x) => x.v).join(',') === 'V01,V02', { texto: r1?.texto, imagenes: r1?.imagenes?.map((x) => x.v), conductor: d?.conductor });
  check('…las dos en 9:16 (lo que pidió el mensaje)', r1?.imagenes?.every((x) => x.piezas['1:1'].formato === '9:16'), r1?.imagenes?.map((x) => x.piezas['1:1'].formato));
  const dim = cp.execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path.join(carpeta, 'img', 'V01_1x1.png')]).toString().trim().split(',').map(Number);
  check(`…y la imagen mide 9:16 (${dim.join('x')})`, Math.abs(dim[0] / dim[1] - 9 / 16) < 0.02, dim);
  check('…listas sin revisión (genera directo)', r1?.imagenes?.every((x) => x.piezas['1:1'].estado === 'listo'), r1?.imagenes?.map((x) => x.piezas['1:1'].estado));
  check('…y la respuesta dice cuánto costaron', /2 imágenes · ~US\$/.test(r1?.texto || ''), r1?.texto);
  const f1 = leerJ(path.join(carpeta, 'app', 'chat', 'falso-1.json'));
  check('El primer turno lleva todo el conocimiento (producto, Mayaverra, reglas de conversión, detalle)', f1.primera && f1.conocimiento.length === 4 && !f1.resume, f1);
  const est1 = leerJ(path.join(carpeta, 'app', 'imagen-ads', 'estado.json'));
  check('No hubo estrategia ni revisión de la IA del lote', !Object.values(est1.tandas).some((t) => ['revision', 'prompts'].includes(t.tipo) && !t.simulada), Object.values(est1.tandas).map((t) => t.tipo));

  const pref1 = fs.readFileSync(path.join(carpeta, 'app', 'chat', 'preferido-1.txt'), 'utf8');
  check('Lo que elegiste abajo (1:1, 1 imagen) va a la IA como elección, y el mensaje manda', /eligió abajo: en 1:1, 1 imagen/.test(pref1), pref1);

  console.log('\n  Cambios simples: directo, sin la IA');
  const t0c = Date.now();
  r = await pedir(`/api/chat-imagenes/${id}/mensajes`, { json: { texto: 'Cambia el fondo de V01 a beige cálido' } });
  d = await chatDe(id);
  const rapida = respuestas(d)[1];
  check(`Contesta al instante (${Date.now() - t0c} ms), sin «pensando»`, r.st === 200 && !d.pensando && rapida?.rapido === true && /V01/.test(rapida.texto || ''), { st: r.st, pensando: d?.pensando, rapida });
  check('…sin abrir la sesión de la IA (no hay turno nuevo)', !fs.existsSync(path.join(carpeta, 'app', 'chat', 'falso-2.json')) && leerJ(path.join(RAIZ, 'temp', '_chat-imagenes', id, 'chat.json')).turnos === 1);
  d = await esperar(5, () => chatDe(id), (x) => (x.mensajes.findLast((m) => m.de === 'chat')?.imagenes?.[0]?.piezas?.['1:1']?.version || 0) >= 2 && ['listo', 'error'].includes(x?.conductor?.estado));
  const p1 = respuestas(d)[1]?.imagenes?.[0]?.piezas?.['1:1'];
  check('V01 queda en versión 2, sigue en 9:16 y la anterior en versiones', p1?.version === 2 && p1?.formato === '9:16' && (p1?.versiones || []).length === 1, { version: p1?.version, formato: p1?.formato, versiones: p1?.versiones?.length });
  const est2 = leerJ(path.join(carpeta, 'app', 'imagen-ads', 'estado.json'));
  check('…sin tanda de ajuste', !Object.values(est2.tandas).some((t) => t.tipo === 'ajuste'), Object.values(est2.tandas).map((t) => t.tipo));
  const prompts = fs.readdirSync(path.join(carpeta, 'prompts')).filter((n) => n.startsWith('V01_1x1')).map((n) => fs.readFileSync(path.join(carpeta, 'prompts', n), 'utf8'));
  check('Al modelo de imagen le llega tu pedido tal cual (en español) y la calidad máxima', prompts.some((t) => /The user asked, in Spanish: «Cambia el fondo de V01 a beige cálido»/.test(t) && /IMAGE QUALITY/.test(t)), prompts.map((t) => t.slice(0, 160)));
  r = await pedir(`/api/chat-imagenes/${id}/mensajes`, { json: { texto: 'Cambia en V02: el color del botón a verde' } });
  d = await chatDe(id);
  check('«Cambia en V02: …» (el botón Regenerar) también va directo', r.st === 200 && respuestas(d)[2]?.rapido === true && respuestas(d)[2].imagenes?.[0]?.v === 'V02', respuestas(d)[2]);
  d = await esperar(5, () => chatDe(id), (x) => (x.mensajes.findLast((m) => m.de === 'chat')?.imagenes?.[0]?.piezas?.['1:1']?.version || 0) >= 2 && ['listo', 'error'].includes(x?.conductor?.estado));
  const { cambioSimple } = await import('../server/lib/imagen-ads/chat.js');
  const chatJ = leerJ(path.join(RAIZ, 'temp', '_chat-imagenes', id, 'chat.json'));
  check('«Hazme otra como V01» no es un cambio simple (va a la IA)', cambioSimple(chatJ, 'Hazme otra como V01') === null);
  check('«Pon V01 en vertical» va directo como cambio de tamaño (2026-11-27c)', cambioSimple(chatJ, 'Pon V01 en vertical')?.tipo === 'tamano' && cambioSimple(chatJ, 'Pon V01 en vertical').vs.join() === 'V01');
  check('«Quita el texto de arriba de la última» sí (la última imagen del chat)', cambioSimple(chatJ, 'Quita el texto de arriba de la última')?.vs?.join() === 'V02');

  console.log('\n  Conversar sin crear y adjuntar');
  r = await pedir(`/api/chat-imagenes/${id}/mensajes`, { json: { texto: '¿Qué tamaño conviene para historias?' } });
  d = await esperar(3, () => chatDe(id), (x) => !x?.pensando && respuestas(x).length === 4);
  check('Una pregunta se contesta sin crear imágenes', respuestas(d)[3] && !(respuestas(d)[3].imagenes || []).length && leerJ(path.join(carpeta, 'app', 'brief.json')).cantidad === 2, respuestas(d)[3]);
  const f2 = leerJ(path.join(carpeta, 'app', 'chat', 'falso-2.json'));
  check('El siguiente turno de la IA retoma la misma conversación', f2.resume === true && !f2.primera, f2);
  r = await pedir(`/api/chat-imagenes/${id}/adjuntos`, { metodo: 'POST', cuerpo: fs.readFileSync(FOTO), headers: { 'Content-Type': 'image/png' } });
  const adj = r.datos?.archivo;
  check('Se adjunta una imagen al chat', r.st === 200 && adj === 'A0001.png', r);
  r = await pedir(`/api/chat-imagenes/${id}/mensajes`, { json: { texto: 'Hazme 1 como esta', adjuntos: [adj], formato: '4:5' } });
  d = await esperar(5, () => chatDe(id), (x) => !x?.pensando && respuestas(x).length === 5 && (respuestas(x)[4].imagenes || []).every((v) => v.piezas?.['1:1']?.url) && ['listo', 'error'].includes(x?.conductor?.estado));
  const r4 = respuestas(d)[4];
  const f4 = leerJ(path.join(carpeta, 'app', 'chat', 'falso-3.json'));
  check('La IA recibe el adjunto y crea V03 en el tamaño elegido (4:5)', f4.conAdjunto && r4?.imagenes?.[0]?.v === 'V03' && r4.imagenes[0].piezas['1:1'].formato === '4:5', { f4, img: r4?.imagenes?.map((x) => [x.v, x.piezas['1:1'].formato]) });
  const tuyos = d.mensajes.filter((m) => m.de === 'tu');
  check('Tu mensaje muestra su adjunto', tuyos[tuyos.length - 1]?.adjuntos?.[0]?.url?.includes('/archivos/chat-imagenes/'), tuyos[tuyos.length - 1]);
  console.log('\n  Chat libre y volver a enviar');
  r = await pedir(`/api/chat-imagenes/${id}/mensajes`, { json: { texto: 'Hazme una para el feed' } });
  d = await esperar(5, () => chatDe(id), (x) => !x?.pensando && respuestas(x).length === 6 && (respuestas(x)[5].imagenes || []).every((v) => v.piezas?.['1:1']?.url) && ['listo', 'error'].includes(x?.conductor?.estado));
  const pref4 = fs.readFileSync(path.join(carpeta, 'app', 'chat', 'preferido-4.txt'), 'utf8');
  check('Sin elegir tamaño ni cantidad, la IA decide (no hay «por defecto»)', !/eligió abajo|Por defecto/.test(pref4) && /Haz las que pida el mensaje/.test(pref4) && /El tamaño: el que diga el mensaje/.test(pref4), pref4);
  check('…y sale una', respuestas(d)[5]?.imagenes?.length === 1, respuestas(d)[5]?.imagenes?.map((x) => x.v));
  r = await pedir(`/api/chat-imagenes/${id}/mensajes`, { json: { texto: 'Hazme 1 como esta pero más luminosa', adjuntos: [adj] } });
  d = await esperar(5, () => chatDe(id), (x) => !x?.pensando && respuestas(x).length === 7 && ['listo', 'error'].includes(x?.conductor?.estado));
  const f6 = leerJ(path.join(carpeta, 'app', 'chat', 'falso-5.json'));
  check('Volver a enviar un mensaje corregido, con su misma imagen adjunta', r.st === 200 && f6.conAdjunto === true, { st: r.st, f6 });
  console.log('\n  Elegir varias imágenes y cambiarlas juntas');
  const vers = async () => Object.fromEntries(((await pedir(`/api/imagen-ads/${lote}`)).datos?.variaciones || []).map((x) => [x.v, { version: x.piezas['1:1'].version, formato: x.piezas['1:1'].formato }]));
  const quieto = (x) => !x?.pensando && ['listo', 'error'].includes(x?.conductor?.estado);
  r = await pedir(`/api/chat-imagenes/${id}/mensajes`, { json: { texto: 'Borra el texto', seleccion: ['V99'] } });
  check('Una imagen que no es del chat no se acepta (400)', r.st === 400, r);
  r = await pedir(`/api/chat-imagenes/${id}/mensajes`, { json: { texto: '', seleccion: ['V01'] } });
  check('Elegir sin decir qué cambiar no vale (400)', r.st === 400, r);
  let antesV = await vers();
  const nR = respuestas(await chatDe(id)).length;
  r = await pedir(`/api/chat-imagenes/${id}/mensajes`, { json: { texto: 'Borra el texto de abajo', seleccion: ['V01', 'V02'] } });
  d = await chatDe(id);
  const rv = respuestas(d)[nR];
  check('V01 y V02 elegidas + «borra el texto de abajo»: al instante, sin la IA, las dos', r.st === 200 && rv?.rapido && rv.imagenes?.map((x) => x.v).join(',') === 'V01,V02', rv);
  check('…tu mensaje dice para cuáles era', d.mensajes.filter((m) => m.de === 'tu').pop()?.seleccion?.join(',') === 'V01,V02');
  d = await esperar(5, () => chatDe(id), quieto);
  let ahoraV = await vers();
  check('…y las dos suben de versión', ahoraV.V01.version === antesV.V01.version + 1 && ahoraV.V02.version === antesV.V02.version + 1, { antesV, ahoraV });
  antesV = ahoraV;
  r = await pedir(`/api/chat-imagenes/${id}/mensajes`, { json: { texto: 'Pásalas a vertical', seleccion: ['V01', 'V04'] } });
  d = await chatDe(id);
  const rt = respuestas(d)[nR + 1];
  check('«Pásalas a vertical» va directo: V04 cambia y V01 (ya era 9:16) se salta', rt?.rapido && /V04/.test(rt.texto) && /V01 ya está en 9:16/.test(rt.texto), rt?.texto);
  d = await esperar(5, () => chatDe(id), quieto);
  ahoraV = await vers();
  check('…V04 queda en 9:16 como versión nueva', ahoraV.V04.formato === '9:16' && ahoraV.V04.version === antesV.V04.version + 1 && ahoraV.V01.version === antesV.V01.version, { antesV, ahoraV });
  antesV = ahoraV;
  const turnosAntes = leerJ(path.join(RAIZ, 'temp', '_chat-imagenes', id, 'chat.json')).turnos;
  r = await pedir(`/api/chat-imagenes/${id}/mensajes`, { json: { texto: 'Hazlas más vendedoras', seleccion: ['V03', 'V05'] } });
  d = await esperar(5, () => chatDe(id), (x) => quieto(x) && respuestas(x).length === nR + 3);
  ahoraV = await vers();
  const tarea = fs.readFileSync(path.join(carpeta, 'app', 'chat', `preferido-${turnosAntes + 1}.txt`), 'utf8');
  check('Un cambio que no es simple va a la IA con las elegidas, y les cambia a las dos', fs.existsSync(path.join(carpeta, 'app', 'chat', `falso-${turnosAntes + 1}.json`)) && ahoraV.V03.version === antesV.V03.version + 1 && ahoraV.V05.version === antesV.V05.version + 1, { tarea: tarea.slice(0, 80), antesV, ahoraV, texto: respuestas(d)[nR + 2]?.texto });
  const { cambioSimple: cs } = await import('../server/lib/imagen-ads/chat.js');
  const cj = leerJ(path.join(RAIZ, 'temp', '_chat-imagenes', id, 'chat.json'));
  check('«Pon V02 en 4:5» es un cambio de tamaño directo', cs(cj, 'Pon V02 en 4:5')?.tipo === 'tamano' && cs(cj, 'Pon V02 en 4:5').formato === '4:5');
  check('«Pon el fondo vertical a rayas en V02» no es un cambio de tamaño (pide otra cosa)', cs(cj, 'Pon el fondo a rayas verticales en V02')?.tipo !== 'tamano');

  const vl = (await pedir(`/api/imagen-ads/${lote}`)).datos;
  check('Las imágenes están en el lote del producto (Anuncios de imagen)', vl?.variaciones?.length >= 4, vl?.variaciones?.length);

  console.log('\n  Borrar el chat');
  r = await pedir(`/api/chat-imagenes/${id}`, { metodo: 'DELETE' });
  check('Se borra la conversación; las imágenes siguen en la carpeta del producto', r.st === 200 && !fs.existsSync(path.join(RAIZ, 'temp', '_chat-imagenes', id)) && fs.existsSync(path.join(carpeta, 'img', 'V01_1x1.png')), r);
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
  for (const c of creados.chats) fs.rmSync(path.join(RAIZ, 'temp', '_chat-imagenes', c), { recursive: true, force: true });
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

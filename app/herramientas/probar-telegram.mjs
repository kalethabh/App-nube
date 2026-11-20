// Prueba de la coordinadora por TELEGRAM (lib/telegram.js), SIN Telegram de verdad: un Telegram simulado en este
// proceso y la app en MODO PRUEBA con el Claude falso.
//   node app/herramientas/probar-telegram.mjs        (PUERTO=<n>, por defecto 4494)
// Revisa: prender, el código para vincular, un chat sin vincular recibe cómo vincularse, /start <código> vincula, otro
// chat recibe «privado», un texto llega a la coordinadora y su respuesta vuelve a Telegram, una NOTA DE VOZ se pasa a
// texto, una FOTO llega como adjunto (pide imágenes: te dice el costo y llega el botón «Dale»), el botón «Dale» las
// genera, y desvincular. Al final deja todo como estaba.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = path.resolve(APP, '..');
const PUERTO = Number(process.env.PUERTO) || 4494;
const BASE = `http://127.0.0.1:${PUERTO}`;
const TOKEN = '123456789:AAEfalsoTokenDePruebaParaLaApp_1234567';
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
async function esperar(seg, leer, listo) {
  const hasta = Date.now() + seg * 1000;
  let u = null;
  while (Date.now() < hasta) {
    u = await leer();
    if (listo(u)) return u;
    await dormir(400);
  }
  return u;
}

// ------------------------------------------------------------ el Telegram simulado
const cola = []; // updates por entregar
const enviados = []; // { chat_id, text, reply_markup }
const contestados = [];
let idUpdate = 100;
const PNG = fs.readFileSync(path.join(APP, 'public', 'kads-icono-180.png'));
const OGG = Buffer.alloc(3000, 7);
const tg = http.createServer(async (req, res) => {
  const partes = [];
  for await (const p of req) partes.push(p);
  const cuerpo = partes.length ? JSON.parse(Buffer.concat(partes).toString() || '{}') : {};
  const ok = (result) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, result }));
  };
  if (req.url.startsWith(`/file/bot${TOKEN}/`)) {
    const f = req.url.split('/').pop();
    res.writeHead(200);
    return res.end(f.endsWith('.oga') ? OGG : PNG);
  }
  const metodo = req.url.split('/').pop();
  if (!req.url.startsWith(`/bot${TOKEN}/`)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: false, error_code: 401, description: 'Unauthorized' }));
  }
  if (metodo === 'getMe') return ok({ id: 1, is_bot: true, username: 'mi_oficina_bot' });
  if (metodo === 'getUpdates') {
    const desde = Number(cuerpo.offset || 0);
    for (let i = 0; i < 20 && !cola.some((u) => u.update_id >= desde); i++) await dormir(100);
    return ok(cola.filter((u) => u.update_id >= desde));
  }
  if (metodo === 'sendMessage') {
    enviados.push(cuerpo);
    return ok({ message_id: enviados.length });
  }
  if (metodo === 'answerCallbackQuery') {
    contestados.push(cuerpo);
    return ok(true);
  }
  if (metodo === 'sendChatAction') return ok(true);
  if (metodo === 'getFile') return ok({ file_id: cuerpo.file_id, file_size: 3000, file_path: cuerpo.file_id === 'voz1' ? 'voice/file_1.oga' : 'photos/file_2.jpg' });
  res.writeHead(400, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error_code: 400, description: `no simulado: ${metodo}` }));
});
await new Promise((ok) => tg.listen(0, '127.0.0.1', ok));
const mensaje = (chat, extra) => cola.push({ update_id: idUpdate++, message: { message_id: idUpdate, chat: { id: chat, type: 'private' }, from: { id: chat, first_name: chat === 555 ? 'Kaleth' : 'Otro' }, date: 1, ...extra } });

// ------------------------------------------------------------ la app
const RESPALDOS = [path.join(RAIZ, 'temp', '_oficina', 'chat.json'), path.join(RAIZ, 'temp', '_telegram', 'config.json')];
const antes = new Map(RESPALDOS.map((f) => [f, fs.existsSync(f) ? fs.readFileSync(f) : null]));
const oficinaExistia = fs.existsSync(path.join(RAIZ, 'temp', '_oficina'));
const TMP = fs.mkdtempSync(path.join(RAIZ, 'temp', '_probar-telegram-'));
const FOTO = path.join(TMP, 'producto.png');
cp.execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x33aa55:s=640x640', '-frames:v', '1', FOTO]);
const ENV = path.join(RAIZ, '.env');
const envPropio = !fs.existsSync(ENV);
if (envPropio) fs.writeFileSync(ENV, '# Lo escribió probar-telegram.mjs: claves falsas.\nKIE_API_KEY=simulada\nELEVENLABS_API_KEY=simulada\n');
const env = { ...process.env };
for (const k of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|OPENAI_|CODEX_|TELEGRAM_)/i.test(k)) delete env[k];
Object.assign(env, { PUERTO: String(PUERTO), ANUNCIOS_MODO_PRUEBA: '1', ANUNCIOS_PRUEBA_LIMPIO: '1', ANUNCIOS_SIN_GUARDADO: '1', ANUNCIOS_CLAUDE_BIN: path.join(APP, 'server', 'claude', 'pruebas', 'claude-falso.js'), AIA_MOTOR: 'claude', OFICINA_SIN_SEGUIMIENTO: '1', TELEGRAM_API_BASE: `http://127.0.0.1:${tg.address().port}`, TELEGRAM_TOKEN_PRUEBA: TOKEN });
const log = fs.createWriteStream(path.join(TMP, 'app.log'));
const app = cp.spawn(process.execPath, ['server/index.js'], { cwd: APP, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
app.stdout.pipe(log);
app.stderr.pipe(log);
const t0 = Date.now();
const creados = { producto: null, lotes: [] };
const a555 = () => enviados.filter((m) => String(m.chat_id) === '555');

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
  await pedir('/api/oficina/chat', { metodo: 'DELETE' });
  let r = await pedir('/api/productos', { json: { nombre: 'Producto Telegram', tipo: 'fisico', descripcion: 'Un té para dormir mejor. Una taza en la noche.' } });
  const id = r.datos?.id;
  creados.producto = id;
  await pedir(`/api/productos/${id}/fotos/1`, { metodo: 'PUT', cuerpo: fs.readFileSync(FOTO), headers: { 'Content-Type': 'image/png' } });
  await pedir(`/api/productos/${id}/analizar`, { json: {} });
  await esperar(240, async () => (await pedir(`/api/productos/${id}`)).datos, (d) => ['lista', 'error'].includes(d?.tarea?.estado));

  r = await pedir('/api/telegram');
  check('Con el token del bot, Ajustes ve el bot y da un código para vincular', r.datos?.token === true && r.datos.nombreBot === 'mi_oficina_bot' && /^[0-9A-F]{6}$/.test(r.datos.codigo) && !r.datos.vinculado, r.datos);
  const codigo = r.datos.codigo;
  r = await pedir('/api/telegram', { metodo: 'PUT', json: { activo: true } });
  check('Se prende', r.datos?.activo === true, r.datos);

  mensaje(555, { text: 'hola' });
  let e = await esperar(20, async () => a555(), (l) => l.length >= 1);
  check('Un chat sin vincular recibe cómo vincularse', /\/start CÓDIGO/.test(e?.[0]?.text || ''), e);
  mensaje(555, { text: `/start ${codigo}` });
  e = await esperar(20, async () => a555(), (l) => l.length >= 2);
  r = await pedir('/api/telegram');
  check('/start <código> lo vincula', /conectados/.test(e?.[1]?.text || '') && r.datos?.vinculado && r.datos.chatNombre === 'Kaleth', { e, d: r.datos });
  mensaje(777, { text: 'quiero usar tu bot' });
  e = await esperar(20, async () => enviados.filter((m) => String(m.chat_id) === '777'), (l) => l.length >= 1);
  check('Otro chat recibe «privado» y no llega a la coordinadora', /privado/.test(e?.[0]?.text || '') && !(await pedir('/api/oficina/chat')).datos.mensajes.some((m) => /usar tu bot/.test(m.texto)), e);

  const n0 = a555().length;
  mensaje(555, { text: 'regla: los ganchos de telegram duran menos de 2 segundos' });
  e = await esperar(60, async () => a555(), (l) => l.slice(n0).some((m) => /Anotado/.test(m.text)));
  const chat1 = (await pedir('/api/oficina/chat')).datos;
  check('Un texto llega a la coordinadora (el mismo chat de la app) y su respuesta vuelve a Telegram', chat1.mensajes.some((m) => m.de === 'tu' && /ganchos de telegram/.test(m.texto)) && e.slice(n0).some((m) => /Anotado/.test(m.text)), e?.slice(n0));

  // (2026-11-20u) un texto largo pegado en Telegram le llega entero, como documento
  const nl = a555().length;
  mensaje(555, { text: `PROMPT LARGO\n${'una línea del prompt. '.repeat(200)}` });
  await esperar(60, async () => a555(), (l) => l.length > nl);
  const largo = (await pedir('/api/oficina/chat')).datos.mensajes.filter((m) => m.de === 'tu').pop();
  check('Un texto largo pegado en Telegram le llega entero como documento', largo?.adjuntos?.[0]?.tipo === 'documento' && /texto largo/.test(largo.texto), largo);

  const n1 = a555().length;
  mensaje(555, { voice: { file_id: 'voz1', duration: 3, mime_type: 'audio/ogg' } });
  e = await esperar(60, async () => a555(), (l) => l.slice(n1).some((m) => /dictado por voz/.test(m.text)));
  check('Una NOTA DE VOZ se pasa a texto y ella la contesta', e.slice(n1).some((m) => /dictado por voz/.test(m.text)) && (await pedir('/api/oficina/chat')).datos.mensajes.some((m) => m.de === 'tu' && /dictado por voz/.test(m.texto)), e?.slice(n1));

  const n2 = a555().length;
  mensaje(555, { photo: [{ file_id: 'chica', width: 90, height: 90 }, { file_id: 'foto1', width: 640, height: 640 }], caption: 'Hazme 3 imágenes con esta referencia' });
  e = await esperar(90, async () => a555(), (l) => l.slice(n2).some((m) => m.reply_markup?.inline_keyboard));
  const boton = e.slice(n2).find((m) => m.reply_markup?.inline_keyboard)?.reply_markup.inline_keyboard[0][0];
  const conFoto = (await pedir('/api/oficina/chat')).datos.mensajes.find((m) => m.de === 'tu' && /3 imágenes/.test(m.texto));
  check('Una FOTO llega como adjunto y ella encarga las imágenes', conFoto?.adjuntos?.[0]?.tipo === 'imagen' && e.slice(n2).some((m) => /Le doy\?/.test(m.text)), { conFoto, e: e?.slice(n2) });
  check('…y llega el botón «✅ Dale · US$…»', /^✅ Dale · US\$\d/.test(boton?.text || '') && /^dale:/.test(boton?.callback_data || ''), boton);
  const lote = boton?.callback_data?.replace(/^dale:/, '');
  if (lote) creados.lotes.push(lote);
  cola.push({ update_id: idUpdate++, callback_query: { id: 'cb1', from: { id: 555 }, message: { message_id: 9, chat: { id: 555 } }, data: boton?.callback_data } });
  const generando = await esperar(60, async () => fs.existsSync(path.join(RAIZ, 'temp', lote || '-', 'app', 'conductor.json')), Boolean);
  check('El botón «Dale» las genera', generando && contestados.some((c) => c.callback_query_id === 'cb1'), { contestados });

  r = await pedir('/api/telegram/desvincular', { json: {} });
  check('Desvincular suelta el chat y cambia el código', r.datos?.vinculado === false && r.datos.codigo !== codigo, r.datos);
  await pedir('/api/telegram', { metodo: 'PUT', json: { activo: false } });
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
  tg.close();
  for (const l of creados.lotes) if (l) fs.rmSync(path.join(RAIZ, 'temp', l), { recursive: true, force: true });
  if (creados.producto) fs.rmSync(path.join(RAIZ, 'temp', '_productos', creados.producto), { recursive: true, force: true });
  for (const [f, v] of antes) {
    if (v === null) fs.rmSync(f, { force: true });
    else fs.writeFileSync(f, v);
  }
  if (!oficinaExistia) fs.rmSync(path.join(RAIZ, 'temp', '_oficina'), { recursive: true, force: true });
  if (!antes.get(RESPALDOS[1])) fs.rmSync(path.join(RAIZ, 'temp', '_telegram'), { recursive: true, force: true });
  fs.rmSync(path.join(RAIZ, 'temp', `_modo-prueba-${PUERTO}`), { recursive: true, force: true });
  if (envPropio) fs.rmSync(ENV, { force: true });
  if (fallas) console.log(`\n  Registro de la app: ${path.join(TMP, 'app.log')}`);
  else fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n  ${pasan} bien, ${fallas} mal · ${Math.round((Date.now() - t0) / 1000)} s\n`);
  process.exit(fallas ? 1 : 0);
}

// TU COORDINADORA POR TELEGRAM (2026-11-20p, del video de @ai.office.builder: «la oficina contesta por Telegram»).
// Creas tu bot con @BotFather (gratis), pegas su token en Ajustes › Telegram y vinculas TU chat con el código que te da
// la app (`/start <código>`). Desde ahí:
//   · lo que le escribes va al chat de la coordinadora (el mismo de la oficina): ella contesta y trabaja igual;
//   · un AUDIO (nota de voz) se pasa a texto (ElevenLabs) y va como si lo hubieras escrito;
//   · una foto, un documento o un video van como archivos adjuntos (los lee como en la app);
//   · todo lo que ella te escribe (respuestas, avisos, «¿le doy?») te llega a Telegram; lo que espera tu sí trae el
//     botón «✅ Dale · US$…».
// Funciona con la app en tu computador (sin dominio): la app le pregunta a Telegram cada pocos segundos (getUpdates).
// Solo atiende al chat vinculado: cualquier otro recibe «este bot es privado».
//
//   estado()                    -> { token, activo, vinculado, nombreBot, codigo, chatNombre }
//   configurar({ activo }) · nuevoCodigo() · desvincular()
//   _paraPruebas: { vuelta, base }
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { TEMP } from './rutas.js';
import { leerJSON } from './archivos.js';
import { escribirJSON } from './productos.js';
import { leerClave } from './claves.js';

const DIR = path.join(TEMP, '_telegram');
const CONFIG = path.join(DIR, 'config.json');
const MAX_ARCHIVO = 20 * 1024 * 1024; // lo que la API de bots deja bajar
let base = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org';
const token = () => process.env.TELEGRAM_TOKEN_PRUEBA || leerClave('TELEGRAM_BOT_TOKEN') || ''; // (TELEGRAM_TOKEN_PRUEBA: solo probar-telegram.mjs)

const leer = () => leerJSON(CONFIG) || {};
const guardar = (c) => {
  fs.mkdirSync(DIR, { recursive: true });
  escribirJSON(CONFIG, c);
  return c;
};
const nuevo = () => crypto.randomBytes(3).toString('hex').toUpperCase();

async function api(metodo, cuerpo = {}, { timeoutMs = 40000 } = {}) {
  const r = await fetch(`${base}/bot${token()}/${metodo}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(timeoutMs) });
  const j = await r.json().catch(() => null);
  if (!j?.ok) {
    const e = new Error(j?.description || `Telegram respondió ${r.status}`);
    e.codigo = j?.error_code || r.status;
    throw e;
  }
  return j.result;
}

// ---------------------------------------------------------------- lo que ve Ajustes

let nombreBot = null;
export async function estado() {
  const c = leer();
  const hay = Boolean(token());
  if (hay && !nombreBot) {
    try {
      nombreBot = (await api('getMe', {}, { timeoutMs: 10000 })).username || null;
    } catch {
      nombreBot = null;
    }
  }
  if (!c.codigo) guardar({ ...c, codigo: nuevo() });
  const d = leer();
  return { token: hay, activo: Boolean(d.activo), vinculado: Boolean(d.chatId), chatNombre: d.chatNombre || null, nombreBot, codigo: d.codigo, error: d.error || null };
}
export async function configurar({ activo } = {}) {
  guardar({ ...leer(), activo: Boolean(activo), error: null });
  if (activo) arrancar();
  return estado();
}
export async function nuevoCodigo() {
  guardar({ ...leer(), codigo: nuevo() });
  return estado();
}
export async function desvincular() {
  const c = leer();
  delete c.chatId;
  delete c.chatNombre;
  guardar({ ...c, codigo: nuevo() });
  return estado();
}

// ---------------------------------------------------------------- enviar

const dinero = (n) => `US$${(Math.round(Number(n) * 100) / 100).toFixed(2)}`;
const recorta = (t, n = 3900) => (String(t).length > n ? `${String(t).slice(0, n)}…` : String(t));

async function mandar(chatId, texto, extra = {}) {
  return api('sendMessage', { chat_id: chatId, text: recorta(texto), disable_web_page_preview: true, ...extra });
}

/** Lo que ella escribió y todavía no llegó a Telegram (respuestas, avisos, entregas y los botones de «Dale»). */
async function reenviarLoNuevo(c) {
  const { chat } = await import('./oficina-chat.js');
  const d = await chat();
  const mensajes = d.mensajes || [];
  // la primera vez, se arranca desde el último (no se reenvía la historia)
  if (!c.ultimoVisto) {
    guardar({ ...c, ultimoVisto: mensajes.at(-1)?.id || 'ninguno' });
    return;
  }
  const k = mensajes.findIndex((m) => m.id === c.ultimoVisto);
  const nuevos = (k >= 0 ? mensajes.slice(k + 1) : mensajes.slice(-3)).filter((m) => m.de === 'coordinadora');
  if (!nuevos.length) {
    if (mensajes.at(-1) && mensajes.at(-1).id !== c.ultimoVisto) guardar({ ...leer(), ultimoVisto: mensajes.at(-1).id });
    return;
  }
  for (const m of nuevos) {
    let texto = m.texto;
    if (m.acciones?.length) texto += `\n\n${m.acciones.map((a) => `${a.ok === false ? '⚠️' : '•'} ${a.titulo}`).join('\n')}`;
    if (m.entrega?.texto) texto += `\n\n— ${m.entrega.titulo}${m.entrega.nota ? ` (nota ${m.entrega.nota}/10)` : ''} —\n${m.entrega.texto}`;
    await mandar(c.chatId, texto);
  }
  // lo que espera tu sí: un botón por cada cosa
  for (const p of (d.pendientes || []).slice(-3)) {
    if ((c.botones || []).includes(p.id)) continue;
    await mandar(c.chatId, `⏳ Espera tu sí: ${p.titulo} · ${dinero(p.costo)}`, { reply_markup: { inline_keyboard: [[{ text: `✅ Dale · ${dinero(p.costo)}`, callback_data: `dale:${p.id}`.slice(0, 64) }]] } });
    c.botones = [...(c.botones || []), p.id].slice(-30);
  }
  guardar({ ...leer(), ultimoVisto: mensajes.at(-1).id, botones: c.botones || [] });
}

// ---------------------------------------------------------------- recibir

async function bajarArchivo(fileId) {
  const f = await api('getFile', { file_id: fileId });
  if (f.file_size && f.file_size > MAX_ARCHIVO) throw new Error('pesa más de 20 MB (Telegram no deja bajar archivos más grandes a los bots)');
  const r = await fetch(`${base}/file/bot${token()}/${f.file_path}`, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`no lo pude bajar (${r.status})`);
  return { bytes: Buffer.from(await r.arrayBuffer()), nombre: path.basename(f.file_path || 'archivo') };
}

async function atender(u, c) {
  const oc = await import('./oficina-chat.js');
  // el botón «Dale»
  if (u.callback_query) {
    const q = u.callback_query;
    if (String(q.message?.chat?.id) !== String(c.chatId)) return;
    await api('answerCallbackQuery', { callback_query_id: q.id, text: 'Va 👍' }).catch(() => {});
    const id = String(q.data || '').replace(/^dale:/, '');
    const p = (await oc.chat()).pendientes?.find((x) => x.id === id);
    if (!p) return mandar(c.chatId, 'Eso ya no está esperando tu sí (ya se hizo o se canceló).');
    return oc.enviar(`Dale, apruébalo y produce ${p.titulo} (${dinero(p.costo)})`);
  }
  const m = u.message;
  if (!m?.chat) return;
  const chatId = String(m.chat.id);
  // vincular: /start <código>
  const texto = String(m.text || m.caption || '').trim();
  if (!c.chatId) {
    const codigo = (/^\/start\s+(\S+)/i.exec(texto) || /^(\S{6})$/.exec(texto) || [])[1];
    if (codigo && codigo.toUpperCase() === String(c.codigo || '').toUpperCase()) {
      guardar({ ...leer(), chatId, chatNombre: [m.from?.first_name, m.from?.last_name].filter(Boolean).join(' ') || m.chat.username || 'tu chat', ultimoVisto: null });
      return mandar(chatId, '¡Listo! Ya estamos conectados 🙌 Escríbeme o mándame un audio cuando quieras, y te aviso aquí lo que necesite tu aprobación.');
    }
    return mandar(chatId, 'Hola 👋 Para conectarme contigo, mándame el código que sale en tu app (Ajustes › Telegram), así: /start CÓDIGO');
  }
  if (chatId !== String(c.chatId)) return mandar(chatId, 'Este bot es privado.');
  if (/^\/start\b/i.test(texto)) return mandar(chatId, 'Ya estamos conectados. Escríbeme lo que necesites.');
  const adjuntos = [];
  let dicho = texto;
  try {
    if (m.voice || m.audio) {
      const a = await bajarArchivo((m.voice || m.audio).file_id);
      await api('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
      const r = await oc.transcribirVoz(a.bytes, (m.voice || m.audio).mime_type || 'audio/ogg');
      dicho = [r.texto, texto].filter(Boolean).join(' ');
    }
    const archivo = m.document || m.video || (m.photo ? m.photo.at(-1) : null);
    if (archivo) {
      const a = await bajarArchivo(archivo.file_id);
      const nombre = m.document?.file_name || (m.video ? 'video.mp4' : m.photo ? 'foto.jpg' : a.nombre);
      const sub = await oc.subirAdjunto(a.bytes, nombre);
      adjuntos.push(sub.id);
    }
  } catch (e) {
    return mandar(chatId, `No pude recibir eso: ${e.message}`);
  }
  // (2026-11-20u) un texto pegado largo (más de lo que guarda un mensaje): le llega entero como documento
  if (dicho.length > 2000) {
    try {
      const sub = await oc.subirAdjunto(Buffer.from(dicho, 'utf8'), 'texto-de-telegram.md');
      adjuntos.push(sub.id);
      dicho = 'Te pasé este texto largo como documento.';
    } catch {
      /* va recortado */
    }
  }
  if (!dicho && !adjuntos.length) return;
  try {
    await api('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
    await oc.enviar(dicho, adjuntos);
  } catch (e) {
    // (409: todavía está contestando lo anterior)
    return mandar(chatId, e.status === 409 ? 'Dame un segundo, todavía te estoy contestando lo anterior 🙏' : `No pude pasárselo: ${e.message}`);
  }
}

/** Una vuelta: lo nuevo de Telegram (hasta `espera` s esperando) y lo nuevo de la coordinadora hacia Telegram. */
export async function vuelta({ espera = 8 } = {}) {
  let c = leer();
  if (!c.activo || !token()) return;
  let updates = [];
  try {
    updates = await api('getUpdates', { offset: c.offset || 0, timeout: espera, allowed_updates: ['message', 'callback_query'] }, { timeoutMs: (espera + 15) * 1000 });
    if (c.error) guardar({ ...leer(), error: null });
  } catch (e) {
    guardar({ ...leer(), error: e.codigo === 401 || e.codigo === 404 ? 'El token del bot no es válido: revísalo en Ajustes › Conexiones.' : `Sin conexión con Telegram (${e.message}).` });
    throw e;
  }
  for (const u of updates) {
    c = leer();
    guardar({ ...c, offset: u.update_id + 1 });
    try {
      await atender(u, leer());
    } catch (e) {
      console.error('[telegram]', e?.message || e);
    }
  }
  c = leer();
  if (c.chatId) await reenviarLoNuevo(c).catch((e) => console.error('[telegram] reenviar', e?.message || e));
}

// el bucle: una vuelta tras otra mientras esté prendido (larga espera: casi sin consumo)
let corriendo = false;
export function arrancar() {
  if (corriendo || process.env.TELEGRAM_APAGADO === '1') return;
  corriendo = true;
  (async () => {
    while (leer().activo && token()) {
      try {
        await vuelta();
      } catch {
        await new Promise((ok) => setTimeout(ok, 15000));
      }
    }
    corriendo = false;
  })();
}
if (process.env.ANUNCIOS_PRUEBA_LIMPIO !== '1') setTimeout(() => leer().activo && arrancar(), 3000).unref?.();

export const _paraPruebas = {
  vuelta,
  base: (b) => {
    base = b;
    nombreBot = null;
  },
};

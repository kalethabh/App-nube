// Las voces de la cuenta de ElevenLabs del usuario (listarlas es gratis). Lo usan la ruta /api/voces y la elección
// automática de la voz del narrador (lib/voz-auto.js).
//
//   voces({ fresco })      -> { ok: true, voces: [{ id, nombre, categoria, propia, clonada, descripcion, etiquetas,
//                             ajustes, muestra }] } | { ok: false, motivo, mensaje }   (se recuerda 5 minutos)
//   mensajeSimple(m)       -> el mensaje para la pantalla
//
// 2026-11-18: la lista se pide aquí mismo, como el saldo de ElevenLabs (lib/claves.js), con la clave del .env (leída
// en el servidor; nunca sale al navegador ni a un registro). Antes se pedía en un proceso aparte, y cualquier aviso
// que ese proceso escribiera, o que tardara más de 30 s, salía como «No pude conectar con ElevenLabs» aunque la clave
// y el internet estuvieran bien. Siempre va a ElevenLabs de verdad, también en modo prueba (listar no cobra).
import { leerClave } from './claves.js';

const BASE = 'https://api.elevenlabs.io';
const ESPERA_MS = 25000;
const DURA_MS = 5 * 60000;
const CATEGORIAS_PROPIAS = ['cloned', 'professional', 'generated'];
let base = BASE;
let cache = null; // { t, voces, promesa }

/** Solo las pruebas: otro servidor (un ElevenLabs simulado). */
export function _paraPruebas({ servidor = null } = {}) {
  base = servidor || BASE;
  cache = null;
}

class ErrorVoces extends Error {
  constructor(motivo, mensaje) {
    super(mensaje);
    this.motivo = motivo;
  }
}

async function pedir(ruta, clave) {
  let r;
  try {
    r = await fetch(base + ruta, { headers: { Accept: 'application/json', 'xi-api-key': clave }, signal: AbortSignal.timeout(ESPERA_MS) });
  } catch (e) {
    throw new ErrorVoces(e?.name === 'TimeoutError' ? 'tarda' : 'sin-conexion', String(e?.cause?.code || e?.message || e));
  }
  if (r.status === 401 || r.status === 403) throw new ErrorVoces('clave', `HTTP ${r.status}`);
  if (!r.ok) throw new ErrorVoces('servicio', `HTTP ${r.status}`);
  try {
    return await r.json();
  } catch {
    throw new ErrorVoces('servicio', 'respuesta no-JSON');
  }
}

/** Todas las voces de la cuenta (v2 paginando; si v2 no responde, v1). */
async function listar() {
  const clave = leerClave('ELEVENLABS_API_KEY');
  if (!clave) throw new ErrorVoces('sin-clave', 'Falta ELEVENLABS_API_KEY');
  const crudas = [];
  try {
    let token = null;
    let vueltas = 0;
    do {
      const q = new URLSearchParams({ page_size: '100' });
      if (token) q.set('next_page_token', token);
      const j = await pedir(`/v2/voices?${q}`, clave);
      crudas.push(...(j.voices || []));
      token = j.has_more ? j.next_page_token : null;
    } while (token && ++vueltas < 20);
  } catch (e) {
    if (crudas.length || e.motivo === 'clave' || e.motivo === 'sin-clave') throw e;
    const j = await pedir('/v1/voices', clave);
    crudas.push(...(j.voices || []));
  }
  return crudas
    .filter((v) => v?.voice_id)
    .map((v) => ({
      id: v.voice_id,
      nombre: v.name || 'Voz sin nombre',
      categoria: v.category || 'desconocida',
      propia: CATEGORIAS_PROPIAS.includes(v.category),
      clonada: v.category === 'cloned',
      descripcion: v.description || null,
      etiquetas: v.labels || {},
      ajustes: v.settings || null,
      muestra: v.preview_url || null,
    }));
}

const MENSAJES = {
  'sin-clave': 'Falta tu clave de ElevenLabs: pégala en Ajustes → Conexiones.',
  clave: 'ElevenLabs rechazó tu clave: revísala en Ajustes → Conexiones (que tenga permiso para leer las voces).',
  'sin-conexion': 'No pude conectar con ElevenLabs. Revisa tu internet y vuelve a intentar.',
  tarda: 'ElevenLabs tardó demasiado en mandar tus voces. Vuelve a intentar en un momento.',
  servicio: 'ElevenLabs no pudo mandar tus voces ahora. Vuelve a intentar en un momento.',
};

/** El mensaje para la pantalla (de un motivo o de un texto de error). */
export function mensajeSimple(m) {
  if (MENSAJES[m]) return MENSAJES[m];
  const t = String(m || '');
  if (/Falta ELEVENLABS_API_KEY|No encuentro el archivo \.env/i.test(t)) return MENSAJES['sin-clave'];
  if (/401|403|rechaz/i.test(t)) return MENSAJES.clave;
  if (/fetch failed|ENOTFOUND|ECONNRE|ETIMEDOUT|network/i.test(t)) return MENSAJES['sin-conexion'];
  return 'No pude traer tus voces de ElevenLabs. Vuelve a intentar en un momento.';
}

export async function voces({ fresco = false } = {}) {
  if (!fresco && cache?.voces && Date.now() - cache.t < DURA_MS) return { ok: true, voces: cache.voces };
  if (cache?.promesa) return cache.promesa;
  const promesa = listar()
    .then((lista) => {
      cache = { t: Date.now(), voces: lista, promesa: null };
      return { ok: true, voces: lista };
    })
    .catch((e) => {
      cache = { ...(cache || {}), promesa: null };
      // (el detalle técnico va a la consola del servidor, sin la clave; la pantalla recibe el mensaje simple)
      console.warn(`[voces] ElevenLabs: ${e.motivo || 'error'} (${String(e.message).slice(0, 120)})`);
      return { ok: false, motivo: e.motivo || 'otro', mensaje: e.motivo || e.message };
    });
  cache = { ...(cache || {}), promesa };
  return promesa;
}

export const VOZ_DE_PRUEBA = { id: 'voz-de-prueba', nombre: 'Voz de prueba', muestra: null, etiquetas: {}, categoria: 'prueba', propia: false, descripcion: 'Solo para el modo prueba: no habla de verdad.' };

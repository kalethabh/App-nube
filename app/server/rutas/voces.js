// Las voces de la cuenta de ElevenLabs del usuario (listarlas es gratis).
//
// GET /api/voces?estilo=claymation   -> [{ id, nombre, muestra (preview de ElevenLabs), etiquetas, categoria, propia,
//                                       descripcion, ultima (la ultima que se uso en ese estilo), ultimaEn: [estilos] }]
// GET /api/voces/por-estilo          -> { claymation: { id, nombre }, ... } (app/config.json, vozPorEstilo)
//
// La lista sale de listarVoces() de produccion/elevenlabs-client.js, corrida en un proceso aparte: la clave se lee
// del .env alli (process.loadEnvFile) y nunca entra en el proceso de la app. El preview (preview_url) no lo devuelve
// listarVoces: se toma de las mismas respuestas de ElevenLabs en ese proceso, sin pedir nada mas.
// Siempre va a ElevenLabs de verdad, tambien en modo prueba (listar no cobra).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { RAIZ, ENV } from '../lib/rutas.js';
import { leerConfig } from '../lib/config.js';

const ESPERA_MS = 30000;
const DURA_MS = 5 * 60000;
let cache = null; // { t, voces, promesa }

function hayClaveEnElEnv() {
  try {
    return /^\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*\S{8,}/m.test(fs.readFileSync(ENV, 'utf8').replace(/^﻿/, ''));
  } catch {
    return false;
  }
}

const CODIGO = (urlConfig, urlCliente) => `
const config = await import(${JSON.stringify(urlConfig)});
try { config.cargarEnv(); } catch {}
const { listarVoces } = await import(${JSON.stringify(urlCliente)});
const muestras = new Map();
const original = globalThis.fetch;
globalThis.fetch = async (...a) => {
  const r = await original(...a);
  try { const j = await r.clone().json(); for (const v of j?.voices || []) if (v?.voice_id && v.preview_url) muestras.set(v.voice_id, v.preview_url); } catch {}
  return r;
};
try {
  const voces = await listarVoces();
  process.stdout.write(JSON.stringify({ ok: true, voces: voces.map((v) => ({ ...v, muestra: muestras.get(v.id) || null })) }));
} catch (e) {
  process.stdout.write(JSON.stringify({ ok: false, mensaje: String(e?.message || e) }));
}
`;

function pedirVoces() {
  return new Promise((resolve) => {
    const env = { ...process.env };
    // siempre la ElevenLabs de verdad, con la clave del .env y sin la guardia de red del modo prueba
    delete env.ELEVENLABS_BASE_URL;
    delete env.NODE_USE_ENV_PROXY;
    if (hayClaveEnElEnv()) delete env.ELEVENLABS_API_KEY;
    const codigo = CODIGO(pathToFileURL(path.join(RAIZ, 'produccion', 'config.js')).href, pathToFileURL(path.join(RAIZ, 'produccion', 'elevenlabs-client.js')).href);
    let salida = '';
    let hijo;
    try {
      hijo = spawn(process.execPath, ['--input-type=module', '-e', codigo], { cwd: RAIZ, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    } catch (e) {
      return resolve({ ok: false, mensaje: e.message });
    }
    const reloj = setTimeout(() => hijo.kill(), ESPERA_MS);
    hijo.stdout.on('data', (d) => (salida += d));
    hijo.on('error', (e) => resolve({ ok: false, mensaje: e.message }));
    hijo.on('close', () => {
      clearTimeout(reloj);
      try {
        resolve(JSON.parse(salida));
      } catch {
        resolve({ ok: false, mensaje: 'sin respuesta' });
      }
    });
  });
}

function mensajeSimple(m) {
  const t = String(m || '');
  if (/Falta ELEVENLABS_API_KEY|No encuentro el archivo \.env/i.test(t)) return 'Falta tu clave de ElevenLabs: pégala en Ajustes → Conexiones.';
  if (/401|rechazo la clave/i.test(t)) return 'ElevenLabs rechazó tu clave: revísala en Ajustes → Conexiones.';
  if (/fetch failed|ENOTFOUND|ECONNRE|ETIMEDOUT|sin respuesta|network/i.test(t)) return 'No pude conectar con ElevenLabs. Revisa tu internet y vuelve a intentar.';
  return 'No pude traer tus voces de ElevenLabs. Vuelve a intentar en un momento.';
}

async function voces({ fresco = false } = {}) {
  if (!fresco && cache?.voces && Date.now() - cache.t < DURA_MS) return { ok: true, voces: cache.voces };
  if (cache?.promesa) return cache.promesa;
  const promesa = pedirVoces().then((r) => {
    cache = r.ok ? { t: Date.now(), voces: r.voces, promesa: null } : { ...(cache || {}), promesa: null };
    return r;
  });
  cache = { ...(cache || {}), promesa };
  return promesa;
}

const VOZ_DE_PRUEBA = { id: 'voz-de-prueba', nombre: 'Voz de prueba', muestra: null, etiquetas: {}, categoria: 'prueba', propia: false, descripcion: 'Solo para el modo prueba: no habla de verdad.' };

export default function rutasVoces(app) {
  app.get('/api/voces/por-estilo', (req, res) => {
    const v = leerConfig().vozPorEstilo;
    res.json(v && typeof v === 'object' ? v : {});
  });

  app.get('/api/voces', async (req, res) => {
    const r = await voces({ fresco: req.query.fresco === '1' });
    const porEstilo = leerConfig().vozPorEstilo || {};
    const estilo = typeof req.query.estilo === 'string' ? req.query.estilo : null;
    let lista;
    if (r.ok) lista = r.voces;
    else if (process.env.ANUNCIOS_MODO_PRUEBA === '1') lista = [VOZ_DE_PRUEBA];
    else return res.status(502).json({ error: mensajeSimple(r.mensaje) });
    const salida = lista
      .map(({ ajustes, ...v }) => {
        const ultimaEn = Object.entries(porEstilo).filter(([, x]) => x && (x.id || x) === v.id).map(([e]) => e);
        return { ...v, ultimaEn, ultima: estilo ? ultimaEn.includes(estilo) : false };
      })
      .sort((a, b) => Number(b.propia) - Number(a.propia) || String(a.nombre).localeCompare(String(b.nombre), 'es'));
    res.json(salida);
  });
}

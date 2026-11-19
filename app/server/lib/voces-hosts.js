// LAS VOCES DE LOS HOSTS DEL PODCAST (2026-11-19m, pedido: «en el podcast ambas tienen la misma voz, deben ser
// diferentes»). El modelo de video inventa la voz de cada clip a partir de una descripción, y dos personas del mismo
// género y edad parecida salían sonando igual. Ahora, después de los clips, a cada host se le pone una voz FIJA de la
// cuenta de ElevenLabs, distinta para cada uno, con «cambiar voz» (speech-to-speech): conserva las palabras, el ritmo y
// los tiempos (la boca sigue sincronizada) y cambia solo el timbre.
//
//   temp/<slug>/app/hablado/voces-hosts.json   { voces: { A: { id, nombre, motivo }, B: {…} }, clips: { 'toma-3': { hecho, voz } } }
//   temp/<slug>/app/hablado/voz-original/      el clip como salió del modelo (si la voz se cambia otra vez, sale de ahí)
//
//   generoDelHost(m, 'A') -> 'femenina' | 'masculina' | null     (del prompt de su hoja)
//   elegirVocesHosts({ carpeta, m, brief, ficha, voces? })       las dos voces (una vez elegidas no cambian)
//   ponerVoces({ carpeta, m, avance, sts? })                     -> { hechas, saltadas, voces } (los clips que ya la tienen, se saltan)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { leerJSON, escribirJSONSeguro } from './archivos.js';
import { leerClave } from './claves.js';
import { voces as vocesDeLaCuenta } from './voces.js';
import { elegirVoz } from './voz-auto.js';
import { rutaFfmpeg } from './miniaturas.js';
import { duracionMp4 } from './mp4.js';

const BASE = () => process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io';
const MODELO_STS = 'eleven_multilingual_sts_v2';
const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const rutaEstado = (carpeta) => path.join(carpeta, 'app', 'hablado', 'voces-hosts.json');
const hashDe = (abs) => crypto.createHash('sha1').update(fs.readFileSync(abs)).digest('hex');

function ffmpeg(args) {
  return new Promise((ok, mal) => execFile(rutaFfmpeg(), args, { timeout: 180000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (e, _o, err) => (e ? mal(new Error(String(err || e.message).slice(-300))) : ok())));
}

/** El género del host, de lo que dice el prompt de su hoja (host-a / host-b). */
export function generoDelHost(m, lado) {
  const id = m?.podcast?.hosts?.[lado] || `host-${String(lado).toLowerCase()}`;
  const t = sinTildes((m?.referencias || []).find((r) => r?.id === id)?.prompt || '');
  // (la hoja de B dice «cambia a la persona: ahora es otra mujer…»: cuenta lo que es ahora, no la de la referencia)
  const i = t.search(/ahora es /);
  const texto = i >= 0 ? t.slice(i) : t;
  const mujer = texto.search(/\b(mujer|chica|senora|woman|female|girl)\b/);
  const hombre = texto.search(/\b(hombre|chico|senor|man|male|guy)\b/);
  if (mujer >= 0 && (hombre < 0 || mujer < hombre)) return 'femenina';
  if (hombre >= 0) return 'masculina';
  return null;
}

/** Las tomas que hablan de cada host (las de reacciones van sin palabras: no se tocan). */
export const tomasConVoz = (m) => (m?.tomas || []).filter((t) => t?.tipo === 'H' && ['A', 'B'].includes(t.habla) && t.clase !== 'reacciones' && (Array.isArray(t.lineas) ? t.lineas.length > 0 : Boolean(t.linea)));

/**
 * Las dos voces, distintas: la de A la más parecida a lo que pide su hoja; la de B, la mejor de las que quedan (nunca
 * la misma de A). Si ya se eligieron para este anuncio, las mismas (el anuncio suena igual aunque se rehaga algo).
 */
export async function elegirVocesHosts({ carpeta, m, brief = {}, ficha = {}, voces = null }) {
  const estado = leerJSON(rutaEstado(carpeta)) || {};
  if (estado.voces?.A?.id && estado.voces?.B?.id && estado.voces.A.id !== estado.voces.B.id) return { ok: true, voces: estado.voces };
  // las que eligió el usuario en el formulario, si eligió
  const pedidas = brief?.opciones?.vocesHosts || {};
  let lista = voces;
  if (!lista) {
    const r = await vocesDeLaCuenta();
    if (!r?.ok) return { ok: false, error: r?.error || 'No pude ver las voces de tu cuenta de ElevenLabs.' };
    lista = r.voces;
  }
  lista = (lista || []).filter((v) => v?.id && v.categoria !== 'prueba');
  if (lista.length < 2) return { ok: false, error: 'Tu cuenta de ElevenLabs necesita al menos dos voces para que cada host suene distinto.' };
  const idioma = /ingl|english|^en/.test(sinTildes(ficha.idioma || m?.idioma || '')) ? 'en' : /portug|^pt/.test(sinTildes(ficha.idioma || m?.idioma || '')) ? 'pt' : 'es';
  const elegidas = {};
  for (const lado of ['A', 'B']) {
    const pedida = pedidas[lado]?.id ? lista.find((v) => v.id === pedidas[lado].id) : null;
    if (pedida && pedida.id !== elegidas.A?.id) {
      elegidas[lado] = { id: pedida.id, nombre: pedida.nombre, motivo: 'la elegiste tú' };
      continue;
    }
    const genero = generoDelHost(m, lado);
    const buscada = { genero, idioma, acento: idioma === 'es' ? 'latino' : null, edad: null, tono: lado === 'A' ? ['cercana', 'natural'] : ['confiable', 'calida'], motivo: [`host ${lado}${genero ? `: voz ${genero}` : ''}`] };
    const sinLaOtra = lista.filter((v) => v.id !== elegidas.A?.id);
    const g = elegirVoz(sinLaOtra, buscada);
    if (!g) return { ok: false, error: 'No encontré dos voces distintas en tu cuenta de ElevenLabs.' };
    elegidas[lado] = { id: g.voz.id, nombre: g.voz.nombre, motivo: g.motivo };
  }
  escribirJSONSeguro(rutaEstado(carpeta), { ...estado, voces: elegidas, elegidas: new Date().toISOString() });
  return { ok: true, voces: elegidas };
}

/** «Cambiar voz» de ElevenLabs: el audio con la voz `vozId`, mismas palabras y mismos tiempos. -> Buffer (mp3) */
export async function stsElevenLabs(audio, vozId) {
  const clave = leerClave('ELEVENLABS_API_KEY');
  if (!clave) throw Object.assign(new Error('Falta tu clave de ElevenLabs (Ajustes › Conexiones).'), { clase: 'clave' });
  const fd = new FormData();
  fd.append('audio', new Blob([audio], { type: 'audio/mpeg' }), 'clip.mp3');
  fd.append('model_id', MODELO_STS);
  fd.append('remove_background_noise', 'false');
  const r = await fetch(`${BASE()}/v1/speech-to-speech/${encodeURIComponent(vozId)}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'xi-api-key': clave }, body: fd });
  if (!r.ok) {
    const texto = (await r.text().catch(() => '')).slice(0, 300);
    throw Object.assign(new Error(r.status === 401 ? 'ElevenLabs rechazó tu clave.' : /quota|credit/i.test(texto) ? 'Se acabaron los créditos de ElevenLabs.' : `ElevenLabs respondió ${r.status}: ${texto}`), { clase: r.status === 401 ? 'clave' : /quota|credit/i.test(texto) ? 'cuota-voz' : 'servidor' });
  }
  return Buffer.from(await r.arrayBuffer());
}

/**
 * A cada clip hablado del podcast, la voz de su host. Un clip que ya la tiene (su archivo es el que dejó este paso) se
 * salta; uno nuevo (se regeneró) se cambia otra vez, siempre desde como salió del modelo.
 */
export async function ponerVoces({ carpeta, m, voces, avance = () => {}, sts = stsElevenLabs, saltar = () => false }) {
  const ruta = rutaEstado(carpeta);
  const estado = leerJSON(ruta) || {};
  const clips = { ...(estado.clips || {}) };
  const dirOriginal = path.join(carpeta, 'app', 'hablado', 'voz-original');
  const tmp = path.join(carpeta, 'app', 'hablado', '.voces-tmp');
  fs.mkdirSync(dirOriginal, { recursive: true });
  fs.mkdirSync(tmp, { recursive: true });
  const hechas = [];
  const saltadas = [];
  try {
    for (const t of tomasConVoz(m)) {
      const id = `toma-${t.n}`;
      if (saltar(id)) continue; // (tu video en el anuncio: va con tu voz)
      const clip = path.join(carpeta, 'video', `${id}.mp4`);
      if (!fs.existsSync(clip)) continue;
      const voz = voces[t.habla];
      const actual = hashDe(clip);
      if (clips[id]?.hecho === actual && clips[id]?.voz === voz.id) {
        saltadas.push(id);
        continue;
      }
      // el clip como salió del modelo: el de ahora si es nuevo; si ya tenía otra voz puesta, el que se guardó antes
      const original = path.join(dirOriginal, `${id}.mp4`);
      if (clips[id]?.hecho !== actual) fs.copyFileSync(clip, original);
      avance(`Poniéndole su voz a ${t.habla === 'A' ? 'el host A' : 'el host B'} (escena ${t.n})`);
      const mp3 = path.join(tmp, `${id}.mp3`);
      await ffmpeg(['-y', '-nostdin', '-v', 'error', '-i', original, '-vn', '-ac', '1', '-ar', '44100', '-b:a', '128k', mp3]);
      const nuevo = await sts(fs.readFileSync(mp3), voz.id);
      const mp3Nuevo = path.join(tmp, `${id}-voz.mp3`);
      fs.writeFileSync(mp3Nuevo, nuevo);
      const salida = path.join(tmp, `${id}.mp4`);
      // el video tal cual y el audio nuevo, con el largo del clip (si la voz nueva queda un poco corta, silencio)
      // (con -t y no -shortest: -shortest con apad y el video copiado no termina nunca)
      const largo = Number(duracionMp4(original)) || 0;
      await ffmpeg(['-y', '-nostdin', '-v', 'error', '-i', original, '-i', mp3Nuevo, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-af', 'apad', ...(largo > 0 ? ['-t', largo.toFixed(3)] : ['-shortest']), salida]);
      fs.copyFileSync(salida, clip);
      clips[id] = { hecho: hashDe(clip), voz: voz.id, fecha: new Date().toISOString() };
      escribirJSONSeguro(ruta, { ...estado, voces, clips });
      hechas.push(id);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  escribirJSONSeguro(ruta, { ...(leerJSON(ruta) || estado), voces, clips });
  return { hechas, saltadas, voces };
}

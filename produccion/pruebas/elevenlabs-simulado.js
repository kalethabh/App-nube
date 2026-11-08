// ElevenLabs SIMULADO, local, para probar el motor sin gastar un caracter.
//
//   node produccion/pruebas/elevenlabs-simulado.js                          puerto 8788
//   node produccion/pruebas/elevenlabs-simulado.js --puerto 9001 --semilla 7
//   node produccion/pruebas/elevenlabs-simulado.js --fallos tts500=20,vozColada=10,scribe500=5,sinCuota=1
//
// Imita SOLO lo que el motor usa de ElevenLabs (ELEVENLABS en
// elevenlabs-client.js, generarVozConTiempos() de generar-audio.js y
// transcribir() de subtitulos-dialogo.js), con los formatos que esos archivos leen:
//
//   GET  /v2/voices                     {voices:[{voice_id,name,category,labels,preview_url...}],
//                                        has_more:false}: las voces del simulado mas las que se
//                                        registren con agregarVoz() (la que eligio el usuario)
//   GET  /v1/voices                     lo mismo, como el endpoint legado
//   GET  /v1/voices/{id}/settings       los ajustes por defecto de ElevenLabs
//   POST /v1/text-to-speech/{id}/with-timestamps
//                                       {audio_base64, alignment, normalized_alignment}: un mp3
//                                       REAL (ffmpeg, 44,1 kHz, 128 kb/s) con una voz SINTETICA
//                                       (un tono con entonacion por palabra y silencio en los
//                                       espacios y las pausas), que dura lo que dura el texto
//                                       leido a unas 2,5 palabras por segundo, y el inicio y el
//                                       fin de cada caracter
//   POST /v1/text-to-speech/{id}        solo el mp3
//   POST /v1/speech-to-text             Scribe: {language_code, text, words:[{text,start,end,
//                                        type:"word"|"spacing"}]} con las palabras y sus tiempos
//   GET  /v1/user, /v1/user/subscription   los caracteres gastados en la sesion
//   GET  /v1/models                     el modelo que usa el motor
//   GET  /archivos/muestras/{id}.mp3    la muestra de cada voz (el preview_url del listado)
//   GET  /__stats                       las estadisticas (POST /__reiniciar las pone en cero)
//
// El motor se apunta aqui con ELEVENLABS_BASE_URL (la lee elevenlabs-client.js
// al importarse). Nunca se habla con ElevenLabs: este archivo no tiene ni la
// direccion.
//
// COMO SABE SCRIBE LO QUE SE DIJO. Todo audio "hablado" que sale de un
// simulado (la voz de aqui, las canciones del Suno de kie-simulado.js) lleva
// en sus etiquetas (ID3, ETIQUETA_PALABRAS) las palabras con sus tiempos.
// ffmpeg copia las etiquetas al pasar de mp3 a mp3 (comprobado con ffmpeg 9.0),
// asi que el mp3 de 16 kHz que el motor arma para Scribe las trae. Un audio sin
// esa etiqueta se toma como SIN HABLA: es el caso de los clips del kie
// simulado, que son mudos. Con vozColada=P, el P% de esos audios se "oye" con
// una frase en ingles que nadie escribio, para probar el silenciado de
// revisar-voces.js. (De un MP4 la etiqueta no pasa sola: el mp4 la guarda solo
// con -movflags use_metadata_tags.)
//
// Determinismo: los fallos salen de un hash de (semilla, texto o archivo,
// intento), no del orden de llegada. Repetir el mismo pedido da lo mismo.
//
// Como modulo:
//   import { iniciar } from './elevenlabs-simulado.js';
//   const sim = await iniciar({ semilla: 1, fallos: 'tts500=10' });
//   ... sim.url, sim.agregarVoz({ id, nombre }), sim.stats(), sim.reiniciarStats(), await sim.cerrar()
//
// Exporta tambien lo que usa el Suno simulado: tiemposDeTexto(), palabrasDeAlineacion(),
// sumarVoz(), sumarMusica(), escribirMp3() y leerPalabras().

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
export const DIR_CACHE_POR_DEFECTO = path.join(RAIZ, 'temp', '_prueba-velocidad', '_cache-simulado', 'elevenlabs');

// La etiqueta del mp3 con las palabras: [[texto, inicio, fin], ...] en JSON.
export const ETIQUETA_PALABRAS = 'palabras_sim';

export const MUESTREO = 44100;

// Las que trae la "cuenta" simulada. La que el usuario eligio en la app se
// agrega con agregarVoz(): asi seleccionarVoz() la encuentra por su id.
export const VOCES_POR_DEFECTO = [
  {
    voice_id: 'sim-narrador',
    name: 'Narrador de prueba',
    category: 'premade',
    labels: { language: 'es', accent: 'latin american', gender: 'male', age: 'middle_aged', use_case: 'narration' },
  },
  {
    voice_id: 'sim-narradora',
    name: 'Narradora de prueba',
    category: 'premade',
    labels: { language: 'es', accent: 'latin american', gender: 'female', age: 'young', use_case: 'narration' },
  },
  {
    voice_id: 'sim-clonada',
    name: 'Mi voz clonada (prueba)',
    category: 'cloned',
    labels: { language: 'es', gender: 'male' },
  },
];

// Los ajustes que ElevenLabs le pone a una voz que nadie toco.
const AJUSTES_POR_DEFECTO = { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 1 };

// Lo que contesta ElevenLabs en cada error (detail.status es lo que mira la API).
const ERROR_CLAVE = { detail: { status: 'invalid_api_key', message: 'Invalid API key' } };
const ERROR_SERVIDOR = { detail: { status: 'internal_server_error', message: 'An internal server error occurred. Please try again.' } };

// La frase que "se cuela" con vozColada: corta y en ingles, como las de verdad.
const FRASE_COLADA = 'Okay, let me show you this.';

// ---------------------------------------------------------------- opciones

/**
 * "--fallos" en texto ("tts500=20,vozColada=10,scribe500=5,sinCuota=1") o ya
 * como objeto. Porcentajes de 0 a 100.
 *
 *   tts500=P      P% de los pedidos de voz devuelven HTTP 500 (al repetir el
 *                 mismo texto cambia el intento, y con el la suerte)
 *   sinCuota=1    toda voz nueva se rechaza por cuota agotada (HTTP 401
 *                 quota_exceeded, como ElevenLabs)
 *   scribe500=P   P% de las transcripciones devuelven HTTP 500
 *   vozColada=P   P% de los audios SIN habla (los clips mudos del kie simulado)
 *                 se transcriben con una frase colada
 */
export function parsearFallos(fallos) {
  const f = { tts500Pct: 0, sinCuota: false, scribe500Pct: 0, vozColadaPct: 0 };
  if (!fallos) return f;
  if (typeof fallos === 'object') return { ...f, ...fallos };
  const claves = { tts500: 'tts500Pct', sinCuota: 'sinCuota', scribe500: 'scribe500Pct', vozColada: 'vozColadaPct', colada: 'vozColadaPct' };
  for (const parte of String(fallos).split(',').map((s) => s.trim()).filter(Boolean)) {
    const [k, v = '1'] = parte.split('=').map((s) => s.trim());
    const clave = claves[k];
    if (!clave) throw new Error(`--fallos: no conozco "${k}". Valen: ${Object.keys(claves).join(', ')}`);
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new Error(`--fallos: "${parte}" no trae un numero valido`);
    f[clave] = clave === 'sinCuota' ? n > 0 : n;
  }
  return f;
}

export function describirFallos(f) {
  const partes = [];
  if (f.tts500Pct) partes.push(`${f.tts500Pct}% de voces con HTTP 500`);
  if (f.sinCuota) partes.push('cuota de caracteres agotada');
  if (f.scribe500Pct) partes.push(`${f.scribe500Pct}% de transcripciones con HTTP 500`);
  if (f.vozColadaPct) partes.push(`${f.vozColadaPct}% de clips mudos con una voz colada`);
  return partes.length ? partes.join(', ') : 'ninguno';
}

/** Un numero en [0, 1) que depende solo de las partes: mismo pedido, mismo numero. */
function fraccion(...partes) {
  const h = crypto.createHash('sha1').update(partes.map(String).join('\u0000')).digest();
  return h.readUInt32BE(0) / 2 ** 32;
}

const r3 = (x) => Math.round(x * 1000) / 1000;

// ---------------------------------------------------------------- tiempos de un texto

const ES_LETRA = /[\p{L}\p{M}]/u;
const ES_NUMERO = /\p{N}/u;

/**
 * Los tiempos de cada caracter del texto leido en voz alta, con el formato
 * de `alignment` de ElevenLabs: characters, character_start_times_seconds y
 * character_end_times_seconds, uno por caracter, seguidos (el fin de uno es el
 * inicio del siguiente). Una letra dura 72 ms, un espacio 35, una coma 260 y
 * un punto 420: sale a unas 2,5 palabras por segundo, lo que estima la skill
 * (palabras / 2,4). `velocidad` es el speed de los ajustes de la voz.
 */
export function tiemposDeTexto(texto, { velocidad = 1, inicio = 0.06 } = {}) {
  const v = Number.isFinite(Number(velocidad)) && Number(velocidad) > 0 ? Number(velocidad) : 1;
  const characters = Array.from(String(texto));
  const inicios = [];
  const fines = [];
  let t = inicio;
  for (const c of characters) {
    let d;
    if (ES_LETRA.test(c)) d = 0.072;
    else if (ES_NUMERO.test(c)) d = 0.11;
    else if (/\s/.test(c)) d = c === '\n' ? 0.3 : 0.035;
    else if (/[,;:]/.test(c)) d = 0.26;
    else if (/[.!?…]/.test(c)) d = 0.42;
    else d = 0.03;
    inicios.push(r3(t));
    t += d / v;
    fines.push(r3(t));
  }
  return { characters, character_start_times_seconds: inicios, character_end_times_seconds: fines };
}

/**
 * Las palabras de un alineamiento por caracter: cada pedazo entre espacios
 * (con su puntuacion pegada, como las escribe Scribe), del inicio de su
 * primera letra al fin de la ultima. Los pedazos sin letras ni numeros ("—")
 * no son palabras. Devuelve [{ texto, inicio, fin }].
 */
export function palabrasDeAlineacion(alignment) {
  const chars = alignment.characters || [];
  const ini = alignment.character_start_times_seconds || [];
  const fin = alignment.character_end_times_seconds || [];
  const palabras = [];
  let actual = null;
  const cerrar = () => {
    if (actual && actual.primera !== null) palabras.push({ texto: actual.texto, inicio: ini[actual.primera], fin: fin[actual.ultima] });
    actual = null;
  };
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (/\s/.test(c)) {
      cerrar();
      continue;
    }
    if (!actual) actual = { texto: '', primera: null, ultima: null };
    actual.texto += c;
    if (ES_LETRA.test(c) || ES_NUMERO.test(c)) {
      if (actual.primera === null) actual.primera = i;
      actual.ultima = i;
    }
  }
  cerrar();
  return palabras;
}

// ---------------------------------------------------------------- audio sintetico

/**
 * Suma una "voz" a las muestras: un tono con armonicos por palabra, con
 * entonacion y silabas (la amplitud late a ~4,5 Hz), y silencio entre
 * palabras. No se entiende nada, pero tiene los silencios donde van y el
 * nivel de una voz normalizada (unos -18 dBFS de media), que es lo que miden
 * el montaje y los controles. `segmentos`: [{ inicio, fin }] en segundos.
 */
export function sumarVoz(muestras, segmentos, { tono = 150, nivel = 0.3, semilla = 1, muestreo = MUESTREO, melodia = false } = {}) {
  // Escala pentatonica para el canto (melodia: true): cada palabra, una nota.
  const NOTAS = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2];
  for (const [k, s] of segmentos.entries()) {
    const i0 = Math.max(0, Math.floor(s.inicio * muestreo));
    const i1 = Math.min(muestras.length, Math.ceil(s.fin * muestreo));
    const n = i1 - i0;
    if (n <= 0) continue;
    const u = fraccion(semilla, 'tono', k, s.inicio);
    const base = melodia ? tono * NOTAS[Math.floor(u * NOTAS.length)] : tono * (0.88 + 0.24 * u);
    const rampa = Math.max(1, Math.min(Math.floor(0.012 * muestreo), Math.floor(n / 3)));
    const w = (2 * Math.PI) / muestreo;
    let fase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / muestreo;
      // Entonacion que baja hacia el final de la palabra, y un vibrato leve.
      const f = base * (1.06 - 0.12 * (i / n)) * (1 + 0.02 * Math.sin(2 * Math.PI * 5.5 * t));
      fase += w * f;
      const silaba = melodia ? 1 : 0.5 + 0.5 * Math.abs(Math.sin(Math.PI * 4.5 * t + 0.4));
      const env = Math.min(1, i / rampa, (n - 1 - i) / rampa);
      const v = Math.sin(fase) + 0.5 * Math.sin(2 * fase) + 0.28 * Math.sin(3 * fase) + 0.12 * Math.sin(4 * fase);
      muestras[i0 + i] += (nivel * env * silaba * v) / 1.9;
    }
  }
  return muestras;
}

/**
 * Suma una cama musical: acordes de tres notas que cambian cada `compas`
 * segundos, con un pulso suave. Para las pistas de Suno (instrumental o por
 * debajo del canto). Unos -24 dBFS de media.
 */
export function sumarMusica(muestras, { nivel = 0.09, semilla = 1, compas = 2, muestreo = MUESTREO, desde = 0 } = {}) {
  // I - V - vi - IV en La, con la semilla eligiendo el tono.
  const raiz = 220 * 2 ** (Math.floor(fraccion(semilla, 'raiz') * 7) / 12);
  const ACORDES = [
    [1, 5 / 4, 3 / 2],
    [3 / 2, 15 / 8, 9 / 4],
    [5 / 3, 2, 5 / 2],
    [4 / 3, 5 / 3, 2],
  ];
  const w = (2 * Math.PI) / muestreo;
  const i0 = Math.max(0, Math.floor(desde * muestreo));
  for (let i = i0; i < muestras.length; i++) {
    const t = i / muestreo;
    const acorde = ACORDES[Math.floor(t / compas) % ACORDES.length];
    const enCompas = (t % compas) / compas;
    // Ataque de 80 ms al cambiar de acorde y un pulso a negras (2 por segundo).
    const ataque = Math.min(1, (t % compas) / 0.08);
    const pulso = 0.75 + 0.25 * Math.cos(2 * Math.PI * 2 * t);
    let v = 0;
    for (const r of acorde) v += Math.sin(w * raiz * r * i);
    muestras[i] += (nivel * ataque * pulso * (1 - 0.25 * enCompas) * v) / 3;
  }
  return muestras;
}

/** Float [-1, 1] a PCM de 16 bits, con recorte. */
function aPcm16(muestras) {
  const b = Buffer.alloc(muestras.length * 2);
  for (let i = 0; i < muestras.length; i++) {
    const x = Math.max(-1, Math.min(1, muestras[i]));
    b.writeInt16LE(Math.round(x * 32767), i * 2);
  }
  return b;
}

/** Escapa un valor para un archivo FFMETADATA1 (=, ;, #, \ y el salto de linea). */
const escaparMeta = (s) => String(s).replace(/[=;#\\\n]/g, (c) => `\\${c}`);

/**
 * Escribe un mp3 REAL con ffmpeg a partir de muestras mono a 44,1 kHz. Con
 * `palabras` ([{ texto, inicio, fin }]) les pone la etiqueta que lee el
 * Scribe simulado. Se escribe a un temporal y se renombra: nadie lee un mp3 a
 * medias.
 */
export async function escribirMp3(destino, muestras, { palabras = null, etiquetas = {}, canales = 1, kbps = 128, muestreo = MUESTREO } = {}) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const tmp = `${destino}.${process.pid}-${crypto.randomBytes(3).toString('hex')}.tmp.mp3`;
  const rutaMeta = `${tmp}.meta.txt`;
  const meta = { simulado: 'si', ...etiquetas };
  if (palabras) meta[ETIQUETA_PALABRAS] = JSON.stringify(palabras.map((p) => [p.texto, r3(p.inicio), r3(p.fin)]));
  fs.writeFileSync(rutaMeta, ';FFMETADATA1\n' + Object.entries(meta).map(([k, v]) => `${k}=${escaparMeta(v)}`).join('\n') + '\n', 'utf8');

  try {
    await new Promise((resolve, reject) => {
      const p = spawn(
        'ffmpeg',
        [
          '-hide_banner', '-loglevel', 'error', '-y',
          '-f', 's16le', '-ar', String(muestreo), '-ac', '1', '-i', 'pipe:0',
          '-f', 'ffmetadata', '-i', rutaMeta,
          '-map', '0:a', '-map_metadata', '1',
          '-ac', String(canales), '-c:a', 'libmp3lame', '-b:a', `${kbps}k`,
          tmp,
        ],
        { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true }
      );
      let err = '';
      p.stderr.on('data', (d) => (err += d));
      p.on('error', (e) => reject(new Error(`no pude correr ffmpeg (${e.message}). El simulado lo necesita para los mp3.`)));
      p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg salio con ${c}: ${err.slice(0, 300)}`))));
      p.stdin.on('error', () => {}); // si ffmpeg muere antes, el error sale por exit
      p.stdin.end(aPcm16(muestras));
    });
    try {
      fs.renameSync(tmp, destino);
    } catch (e) {
      if (!fs.existsSync(destino)) throw e;
      fs.rmSync(tmp, { force: true });
    }
  } finally {
    fs.rmSync(rutaMeta, { force: true });
    fs.rmSync(tmp, { force: true });
  }
  return destino;
}

/** Corre un comando y devuelve stdout y stderr (sin tirar error por el codigo). */
function correr(bin, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => reject(new Error(`no pude correr ${bin} (${e.message})`)));
    p.on('exit', (codigo) => resolve({ codigo, out, err }));
  });
}

/**
 * Lo que el Scribe simulado sabe de un audio: su duracion, si suena algo
 * (max_volume de ffmpeg por encima de -60 dB) y las palabras de su etiqueta,
 * si la trae. { duracion, suena, palabras: [{ texto, inicio, fin }] | null }
 */
export async function leerPalabras(ruta) {
  const sonda = await correr('ffprobe', ['-v', 'error', '-show_entries', `format=duration:format_tags=${ETIQUETA_PALABRAS}`, '-of', 'json', ruta]);
  if (sonda.codigo !== 0) throw new Error(`ffprobe no pudo leer el audio: ${sonda.err.slice(0, 200)}`);
  const fmt = JSON.parse(sonda.out || '{}').format || {};
  const duracion = Number(fmt.duration) || 0;
  let palabras = null;
  const crudo = fmt.tags?.[ETIQUETA_PALABRAS];
  if (crudo) {
    try {
      palabras = JSON.parse(crudo).map(([texto, inicio, fin]) => ({ texto: String(texto), inicio: Number(inicio), fin: Number(fin) }));
    } catch {
      palabras = null;
    }
  }
  const vol = await correr('ffmpeg', ['-hide_banner', '-nostats', '-i', ruta, '-af', 'volumedetect', '-f', 'null', '-']);
  const m = vol.err.match(/max_volume:\s*(-?[\d.]+|-inf)\s*dB/);
  const max = !m || m[1] === '-inf' ? -Infinity : Number(m[1]);
  return { duracion, suena: max > -60, maxDb: max, palabras };
}

// ---------------------------------------------------------------- servidor

function statsVacias() {
  return {
    desde: new Date().toISOString(),
    voz: { pedidos: 0, generadas: 0, caracteres: 0, segundos: 0, devueltas500: 0, sinCuota: 0, vacias: 0, vocesDesconocidas: [] },
    scribe: { pedidos: 0, conHabla: 0, sinHabla: 0, coladas: 0, devueltas500: 0, segundos: 0 },
    listados: 0,
    muestras: 0,
    rutasDesconocidas: {},
    sinClave: 0,
  };
}

/**
 * Arranca el simulado. Devuelve { url, puerto, agregarVoz(), voces(), stats(),
 * reiniciarStats(), cerrar() }.
 *
 *   puerto     0 = uno libre (el que salga va en url)
 *   semilla    misma semilla + mismos pedidos = mismos fallos
 *   fallos     ver parsearFallos()
 *   voces      voces extra de la cuenta: [{ id, nombre, categoria? }]
 *   dirCache   donde quedan las muestras y los audios de paso
 *   alRegistrar(linea)  opcional: una linea por cada voz y cada transcripcion
 */
export async function iniciar({ puerto = 0, host = '127.0.0.1', semilla = 1, fallos = null, voces = [], dirCache = DIR_CACHE_POR_DEFECTO, alRegistrar = null } = {}) {
  const opcFallos = parsearFallos(fallos);
  const cuenta = new Map(VOCES_POR_DEFECTO.map((v) => [v.voice_id, structuredClone(v)]));
  const intentosPorTexto = new Map();
  let caracteresUsados = 0;
  let stats = statsVacias();
  let base = '';
  const registrar = (linea) => alRegistrar?.(linea);

  function agregarVoz({ id, nombre, categoria = 'premade', etiquetas = {} } = {}) {
    const vid = String(id || '').trim();
    if (!vid) return null;
    const previa = cuenta.get(vid);
    if (previa) {
      if (nombre && previa.name !== nombre) previa.name = String(nombre);
      return previa;
    }
    const v = { voice_id: vid, name: String(nombre || `Voz ${vid.slice(0, 8)}`), category: categoria, labels: etiquetas };
    cuenta.set(vid, v);
    return v;
  }
  for (const v of voces) agregarVoz(v);

  const vozPublica = (v) => ({
    voice_id: v.voice_id,
    name: v.name,
    category: v.category,
    description: 'Voz del ElevenLabs simulado: no es una voz real.',
    labels: v.labels || {},
    settings: { ...AJUSTES_POR_DEFECTO },
    preview_url: `${base}/archivos/muestras/${encodeURIComponent(v.voice_id)}.mp3`,
    available_for_tiers: [],
    high_quality_base_model_ids: ['eleven_multilingual_v2'],
  });

  /** El tono de cada voz: grave si es de hombre, agudo si es de mujer, por hash si no se sabe. */
  function tonoDe(voiceId) {
    const g = cuenta.get(voiceId)?.labels?.gender;
    if (g === 'male') return 120;
    if (g === 'female') return 210;
    return 115 + Math.round(fraccion('tono', voiceId) * 110);
  }

  /** La voz sintetica de un texto: { mp3 (Buffer), alignment, palabras, duracion }. */
  async function sintetizar(voiceId, texto, ajustes = {}) {
    const alignment = tiemposDeTexto(texto, { velocidad: ajustes?.speed ?? 1 });
    const palabras = palabrasDeAlineacion(alignment);
    const fin = alignment.character_end_times_seconds.at(-1) ?? 0;
    const duracion = fin + 0.3; // la cola de silencio que deja ElevenLabs
    const muestras = new Float32Array(Math.ceil(duracion * MUESTREO));
    sumarVoz(muestras, palabras, { tono: tonoDe(voiceId), semilla: `${semilla}-${voiceId}` });
    const ruta = path.join(dirCache, '_paso', `voz-${crypto.randomBytes(6).toString('hex')}.mp3`);
    try {
      await escribirMp3(ruta, muestras, { palabras, etiquetas: { title: 'voz simulada', artist: voiceId } });
      return { mp3: fs.readFileSync(ruta), alignment, palabras, duracion };
    } finally {
      fs.rmSync(ruta, { force: true });
    }
  }

  async function tts(req, res, voiceId, conTiempos) {
    stats.voz.pedidos++;
    let cuerpo;
    try {
      cuerpo = JSON.parse((await leerCuerpo(req)).toString('utf8'));
    } catch {
      return json(res, 400, { detail: { status: 'invalid_json', message: 'Request body is not valid JSON.' } });
    }
    const texto = typeof cuerpo?.text === 'string' ? cuerpo.text : '';
    if (!texto.trim()) {
      stats.voz.vacias++;
      return json(res, 422, { detail: [{ loc: ['body', 'text'], msg: 'Text must not be empty.', type: 'value_error' }] });
    }
    if (!cuenta.has(voiceId) && !stats.voz.vocesDesconocidas.includes(voiceId)) stats.voz.vocesDesconocidas.push(voiceId);

    const intento = (intentosPorTexto.get(texto) || 0) + 1;
    intentosPorTexto.set(texto, intento);
    if (opcFallos.sinCuota) {
      stats.voz.sinCuota++;
      registrar(`  !  voz rechazada: cuota agotada (${texto.length} caracteres)`);
      return json(res, 401, {
        detail: {
          status: 'quota_exceeded',
          message: `This request exceeds your quota of 10000. You have 0 credits remaining, while ${texto.length} credits are required for this request.`,
        },
      });
    }
    if (fraccion(semilla, 'tts500', texto, intento) * 100 < opcFallos.tts500Pct) {
      stats.voz.devueltas500++;
      registrar(`  !  voz con HTTP 500 (intento ${intento})`);
      return json(res, 500, ERROR_SERVIDOR);
    }

    const { mp3, alignment, duracion } = await sintetizar(voiceId, texto, cuerpo.voice_settings);
    caracteresUsados += texto.length;
    stats.voz.generadas++;
    stats.voz.caracteres += texto.length;
    stats.voz.segundos += duracion;
    registrar(`  OK  voz ${voiceId}: ${texto.length} caracteres -> ${duracion.toFixed(1)} s`);

    if (!conTiempos) {
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': mp3.length });
      return res.end(mp3);
    }
    return json(res, 200, {
      audio_base64: mp3.toString('base64'),
      alignment,
      // El simulado no normaliza ("30%" no pasa a "treinta por ciento"): las dos iguales.
      normalized_alignment: alignment,
    });
  }

  async function scribe(req, res) {
    stats.scribe.pedidos++;
    const crudo = await leerCuerpo(req);
    let form;
    try {
      form = await new Request('http://simulado/', { method: 'POST', headers: { 'content-type': String(req.headers['content-type'] || '') }, body: crudo }).formData();
    } catch {
      return json(res, 400, { detail: { status: 'invalid_request', message: 'Expected multipart/form-data with a file.' } });
    }
    const archivo = form.get('file');
    const modelo = String(form.get('model_id') || '');
    if (!archivo || typeof archivo === 'string') return json(res, 422, { detail: [{ loc: ['body', 'file'], msg: 'field required' }] });
    if (!/^scribe/.test(modelo)) return json(res, 422, { detail: { status: 'invalid_model', message: `model_id "${modelo}" is not a speech-to-text model.` } });
    const nombre = String(archivo.name || 'audio.mp3');
    const buffer = Buffer.from(await archivo.arrayBuffer());

    if (fraccion(semilla, 'scribe500', nombre, buffer.length) * 100 < opcFallos.scribe500Pct) {
      stats.scribe.devueltas500++;
      return json(res, 500, ERROR_SERVIDOR);
    }

    const ext = (path.extname(nombre) || '.mp3').replace(/[^.\w]/g, '');
    const ruta = path.join(dirCache, '_paso', `scribe-${crypto.randomBytes(6).toString('hex')}${ext}`);
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    fs.writeFileSync(ruta, buffer);
    let info;
    try {
      info = await leerPalabras(ruta);
    } finally {
      fs.rmSync(ruta, { force: true });
    }
    stats.scribe.segundos += info.duracion;

    let palabras = [];
    if (info.palabras) {
      // Lo que quede fuera del audio (un audio recortado) no se oye.
      palabras = info.palabras.filter((p) => p.inicio < info.duracion + 0.05);
      stats.scribe.conHabla++;
    } else if (fraccion(semilla, 'colada', nombre, buffer.length) * 100 < opcFallos.vozColadaPct) {
      // Una frase corta en ingles, en el medio del clip.
      const desde = Math.max(0, info.duracion / 2 - 0.8);
      const al = tiemposDeTexto(FRASE_COLADA, { inicio: desde });
      palabras = palabrasDeAlineacion(al).filter((p) => p.fin <= Math.max(info.duracion, 0.5));
      stats.scribe.coladas++;
      registrar(`  !  Scribe: voz colada en ${nombre}`);
    } else {
      stats.scribe.sinHabla++;
    }

    const words = [];
    for (const [i, p] of palabras.entries()) {
      if (i > 0) words.push({ text: ' ', start: r3(palabras[i - 1].fin), end: r3(p.inicio), type: 'spacing', speaker_id: 'speaker_0', logprob: 0 });
      words.push({ text: p.texto, start: r3(p.inicio), end: r3(p.fin), type: 'word', speaker_id: 'speaker_0', logprob: -0.05 });
    }
    const idioma = String(form.get('language_code') || '') || 'spa';
    registrar(`  OK  Scribe ${nombre}: ${palabras.length} palabra(s) en ${info.duracion.toFixed(1)} s`);
    return json(res, 200, {
      language_code: idioma,
      language_probability: palabras.length ? 0.98 : 0.5,
      text: palabras.map((p) => p.texto).join(' '),
      words,
      transcription_id: `sim${crypto.randomBytes(8).toString('hex')}`,
    });
  }

  async function servirMuestra(id, res) {
    const voz = cuenta.get(id);
    if (!voz) return texto(res, 404, 'no existe esa voz');
    const ruta = path.join(dirCache, 'muestras', `${crypto.createHash('sha1').update(id).digest('hex').slice(0, 16)}.mp3`);
    if (!fs.existsSync(ruta)) {
      const al = tiemposDeTexto('Hola, esta es la voz de prueba del simulado.');
      const palabras = palabrasDeAlineacion(al);
      const muestras = new Float32Array(Math.ceil((al.character_end_times_seconds.at(-1) + 0.3) * MUESTREO));
      sumarVoz(muestras, palabras, { tono: tonoDe(id), semilla: `${semilla}-${id}` });
      await escribirMp3(ruta, muestras, { palabras });
    }
    stats.muestras++;
    const cuerpo = fs.readFileSync(ruta);
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': cuerpo.length });
    return res.end(cuerpo);
  }

  function json(res, codigo, obj) {
    const cuerpo = JSON.stringify(obj);
    res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(cuerpo) });
    res.end(cuerpo);
  }

  function texto(res, codigo, cuerpo) {
    res.writeHead(codigo, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': Buffer.byteLength(cuerpo) });
    res.end(cuerpo);
  }

  function leerCuerpo(req) {
    return new Promise((resolve, reject) => {
      const partes = [];
      let total = 0;
      req.on('data', (d) => {
        total += d.length;
        if (total > 200 * 1024 * 1024) {
          reject(new Error('cuerpo de mas de 200 MB'));
          req.destroy();
          return;
        }
        partes.push(d);
      });
      req.on('end', () => resolve(Buffer.concat(partes)));
      req.on('error', reject);
    });
  }

  const suscripcion = () => ({
    tier: 'simulado',
    character_count: caracteresUsados,
    character_limit: opcFallos.sinCuota ? caracteresUsados : 10_000_000,
    can_extend_character_limit: false,
    next_character_count_reset_unix: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
    status: 'active',
  });

  async function atender(req, res) {
    const u = new URL(req.url, 'http://simulado');
    const ruta = u.pathname;

    if (req.method === 'GET' && ruta === '/__stats') return json(res, 200, resumenStats());
    if (req.method === 'POST' && ruta === '/__reiniciar') {
      reiniciarStats();
      return json(res, 200, { ok: true });
    }
    if (req.method === 'GET' && ruta.startsWith('/archivos/muestras/')) {
      return servirMuestra(decodeURIComponent(path.basename(ruta, '.mp3')), res);
    }

    if (!String(req.headers['xi-api-key'] || '').trim()) {
      stats.sinClave++;
      return json(res, 401, ERROR_CLAVE);
    }

    if (req.method === 'GET' && (ruta === '/v2/voices' || ruta === '/v1/voices')) {
      stats.listados++;
      const lista = [...cuenta.values()].map(vozPublica);
      if (ruta === '/v1/voices') return json(res, 200, { voices: lista });
      return json(res, 200, { voices: lista, has_more: false, total_count: lista.length, next_page_token: null });
    }
    let m = ruta.match(/^\/v1\/voices\/([^/]+)\/settings$/);
    if (req.method === 'GET' && m) return json(res, 200, { ...AJUSTES_POR_DEFECTO });
    m = ruta.match(/^\/v1\/text-to-speech\/([^/]+?)(\/with-timestamps)?$/);
    if (req.method === 'POST' && m) return tts(req, res, decodeURIComponent(m[1]), Boolean(m[2]));
    if (req.method === 'POST' && ruta === '/v1/speech-to-text') return scribe(req, res);
    if (req.method === 'GET' && ruta === '/v1/user/subscription') return json(res, 200, suscripcion());
    if (req.method === 'GET' && ruta === '/v1/user') {
      return json(res, 200, { user_id: 'simulado', first_name: 'Prueba', is_new_user: false, subscription: suscripcion() });
    }
    if (req.method === 'GET' && ruta === '/v1/models') {
      return json(res, 200, [{ model_id: 'eleven_multilingual_v2', name: 'Eleven Multilingual v2', can_do_text_to_speech: true }]);
    }

    // Algo que el motor pide y el simulado no imita: se anota, no se inventa.
    const k = `${req.method} ${ruta}`;
    stats.rutasDesconocidas[k] = (stats.rutasDesconocidas[k] || 0) + 1;
    return json(res, 404, { detail: { status: 'not_found', message: `ElevenLabs simulado: ${k} no esta imitado` } });
  }

  function resumenStats() {
    const s = structuredClone(stats);
    s.semilla = semilla;
    s.fallos = { ...opcFallos, texto: describirFallos(opcFallos) };
    s.caracteresUsados = caracteresUsados;
    s.voz.segundos = Number(s.voz.segundos.toFixed(1));
    s.scribe.segundos = Number(s.scribe.segundos.toFixed(1));
    s.voces = [...cuenta.keys()];
    return s;
  }

  function reiniciarStats() {
    stats = statsVacias();
  }

  const servidor = http.createServer((req, res) => {
    atender(req, res).catch((e) => {
      if (!res.headersSent) json(res, 500, { detail: { status: 'simulado', message: `ElevenLabs simulado: ${e.message}` } });
      else res.destroy();
    });
  });
  servidor.keepAliveTimeout = 5000;

  await new Promise((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(puerto, host, resolve);
  });
  const puertoReal = servidor.address().port;
  base = `http://${host}:${puertoReal}`;

  return {
    url: base,
    puerto: puertoReal,
    agregarVoz,
    voces: () => [...cuenta.values()].map((v) => ({ id: v.voice_id, nombre: v.name, categoria: v.category })),
    stats: resumenStats,
    reiniciarStats,
    cerrar: () =>
      new Promise((resolve) => {
        servidor.close(() => resolve());
        servidor.closeAllConnections?.();
      }),
  };
}

// ---------------------------------------------------------------- resumen legible

/** Las estadisticas en lineas, con la sangria del motor. */
export function lineasDeStats(s) {
  const L = [];
  const v = s.voz;
  L.push(`      voces generadas            ${v.generadas}   (${v.caracteres} caracteres, ${v.segundos} s de audio; pedidos ${v.pedidos})`);
  if (v.devueltas500 || v.sinCuota || v.vacias) L.push(`      voces rechazadas           HTTP 500 ${v.devueltas500}, sin cuota ${v.sinCuota}, texto vacio ${v.vacias}`);
  if (v.vocesDesconocidas.length) L.push(`      voces que la cuenta no tiene   ${v.vocesDesconocidas.join(', ')}`);
  const c = s.scribe;
  L.push(`      transcripciones            ${c.pedidos}   (con habla ${c.conHabla}, sin habla ${c.sinHabla}, coladas ${c.coladas}, HTTP 500 ${c.devueltas500}; ${c.segundos} s)`);
  L.push(`      listados de voces          ${s.listados}`);
  const rutas = Object.entries(s.rutasDesconocidas);
  if (rutas.length) L.push(`      rutas que el simulado no imita   ${rutas.map(([r, n]) => `${r} x${n}`).join(', ')}`);
  if (s.sinClave) L.push(`      pedidos sin clave (401)    ${s.sinClave}`);
  return L;
}

// ---------------------------------------------------------------- CLI

function valorDe(args, nombre, porDefecto) {
  const i = args.indexOf(nombre);
  return i !== -1 && args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[i + 1] : porDefecto;
}

async function cli() {
  const args = process.argv.slice(2);
  if (args.includes('--ayuda') || args.includes('-h')) {
    console.log('\n  Uso: node produccion/pruebas/elevenlabs-simulado.js [--puerto 8788] [--semilla 1] [--voz <id>]');
    console.log('                                                     [--fallos tts500=20,vozColada=10,scribe500=5,sinCuota=1] [--callado]\n');
    return;
  }
  const puerto = Number(valorDe(args, '--puerto', 8788));
  const semilla = Number(valorDe(args, '--semilla', 1));
  const fallos = parsearFallos(valorDe(args, '--fallos', ''));
  const voz = valorDe(args, '--voz', null);
  const callado = args.includes('--callado');

  const sim = await iniciar({ puerto, semilla, fallos, voces: voz ? [{ id: voz, nombre: 'Voz elegida (prueba)' }] : [], alRegistrar: callado ? null : (l) => console.log(l) });

  console.log(`\n=== ElevenLabs SIMULADO — ${sim.url} ===\n`);
  console.log(`  Semilla ${semilla}, fallos: ${describirFallos(fallos)}`);
  console.log(`  Voces de la cuenta: ${sim.voces().map((v) => `${v.nombre} (${v.id})`).join(', ')}\n`);
  console.log('  Para apuntar el motor aqui, en OTRA ventana de PowerShell:');
  console.log(`      $env:ELEVENLABS_BASE_URL = "${sim.url}"`);
  console.log('      $env:ELEVENLABS_API_KEY = "simulada"');
  console.log(`      $env:ELEVENLABS_VOICE_ID = "${voz || VOCES_POR_DEFECTO[0].voice_id}"\n`);
  console.log(`  Estadisticas: ${sim.url}/__stats   Ctrl+C para salir y verlas aqui.\n`);

  let saliendo = false;
  process.on('SIGINT', async () => {
    if (saliendo) return;
    saliendo = true;
    console.log('\n  Estadisticas de la sesion:');
    for (const l of lineasDeStats(sim.stats())) console.log(l);
    console.log('');
    await sim.cerrar();
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await cli();

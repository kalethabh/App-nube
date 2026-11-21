// kie.ai SIMULADO, local, para probar el motor sin gastar un credito.
//
//   node produccion/pruebas/kie-simulado.js                          puerto 8787, escala 0.05
//   node produccion/pruebas/kie-simulado.js --puerto 9000 --escala 0.1 --semilla 7
//   node produccion/pruebas/kie-simulado.js --fallos servidor=10,contenido=5,trabadas=1,consulta500=5
//
// Imita SOLO lo que el motor usa de kie.ai (los caminos de KIE en config.js y
// los formatos que lee kie-client.js):
//
//   POST /api/v1/jobs/createTask           {code:200,data:{taskId}}; HTTP 429 si se pasan
//                                           20 creaciones en 10 s (como kie de verdad)
//   GET  /api/v1/jobs/recordInfo?taskId=   {code:200,data:{state,resultJson,failCode,failMsg,
//                                           creditsConsumed}}: waiting -> queuing -> generating
//                                           -> success | fail. Una taskId que no existe da
//                                           {code:422,msg:"recordInfo is null"}, como kie.
//   GET  /api/v1/chat/credit               el saldo: grande por defecto (--saldo para fijarlo);
//                                           baja con cada tarea que termina bien, por sus creditos
//   POST /api/file-base64-upload           {data:{downloadUrl}} que apunta a este mismo servidor
//   GET  /archivos/...                     lo subido y los resultados: PNG y MP4 REALES
//                                           (ffmpeg), del aspecto pedido, cacheados en disco
//   GET  /__stats                          las estadisticas de la sesion (POST /__reiniciar
//                                           las pone en cero; GET /__tareas, tarea por tarea;
//                                           POST /__saldo {creditos} fija lo que queda)
//
// SUNO (la musica de generar-musica.js y la cancion de generar-cancion.js), con
// sus propios caminos y estados, como en kie:
//
//   POST /api/v1/generate                  {code:200,data:{taskId}}; valida modelo, callBackUrl,
//                                           style/title en customMode y los largos de la doc
//   GET  /api/v1/generate/record-info      {code:200,data:{status,response:{sunoData:[2 pistas]},
//                                           errorMessage}}: PENDING -> TEXT_SUCCESS ->
//                                           FIRST_SUCCESS -> SUCCESS | GENERATE_AUDIO_FAILED |
//                                           SENSITIVE_WORD_ERROR (el rechazo por contenido)
//   POST /api/v1/generate/get-timestamped-lyrics   {alignedWords:[{word,startS,endS}],hootCer}
//   POST /api/v1/jobs/createTask con model "ai-music-api/extend": el extend, por la API de
//                                           jobs; resultJson {data:[2 pistas]} con la cancion ENTERA
//   GET  /archivos/musica/<id>.mp3         la pista: un mp3 REAL (ffmpeg) con una cama de acordes
//                                           y, si es cantada, una "voz" por palabra de la letra
//                                           con las palabras en su etiqueta (el Scribe simulado de
//                                           elevenlabs-simulado.js las lee). Como Suno, `duration`
//                                           TRUNCA la letra: lo que no entra no se canta.
//
// El motor se apunta aqui con KIE_BASE_URL y KIE_BASE_ARCHIVOS_URL (los lee
// config.js). Nunca se habla con kie.ai: este archivo no tiene ni la direccion.
//
// Tiempos: las latencias son las medidas en corridas reales (LATENCIAS_S)
// multiplicadas por la ESCALA (0.05 por defecto: una imagen de Sunburst tarda
// 3 a 9 s en vez de 60 a 180 s). El limite de 20 creaciones cada 10 s NO se
// escala: es el de kie, y el motor tiene que respetarlo igual.
//
// Determinismo: la latencia y los fallos de cada tarea salen de un hash de
// (semilla, modelo, prompt, intento), no del orden de llegada. Asi dos motores
// que piden lo mismo en otro orden ven las mismas demoras y los mismos fallos,
// y las corridas se pueden comparar. Un rechazo por contenido se "pega" al
// par modelo + prompt, como en kie: repetir el mismo prompt con el mismo
// modelo falla igual; con otro modelo (el respaldo) o con otro prompt, no.
//
// Como modulo:
//   import { iniciar } from './kie-simulado.js';
//   const sim = await iniciar({ escala: 0.05, semilla: 1, fallos: 'servidor=10', saldo: 300 });
//   ... sim.url, sim.stats(), sim.tareas(), sim.reiniciarStats(), sim.saldo(), sim.fijarSaldo(n),
//       await sim.cerrar()

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MUESTREO, sumarMusica, sumarVoz, escribirMp3 } from './elevenlabs-simulado.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
export const DIR_CACHE_POR_DEFECTO = path.join(RAIZ, 'temp', '_prueba-velocidad', '_cache-simulado');

// Los mismos caminos que KIE en config.js. Van escritos aqui (no importados)
// para que el simulado siga andando aunque config.js este a medio editar, y
// para poder probar con el un arbol viejo del motor (--motor de probar-velocidad).
const RUTAS = {
  crearTarea: '/api/v1/jobs/createTask',
  consultarTarea: '/api/v1/jobs/recordInfo',
  creditos: '/api/v1/chat/credit',
  subirBase64: '/api/file-base64-upload',
  // Suno tiene sus caminos (MUSICA en generar-musica.js, CANCION en generar-cancion.js).
  sunoGenerar: '/api/v1/generate',
  sunoConsultar: '/api/v1/generate/record-info',
  sunoLetra: '/api/v1/generate/get-timestamped-lyrics',
};

// Lo que valida kie en /api/v1/generate (https://docs.kie.ai/suno-api/generate-music).
export const SUNO = {
  modelos: ['V4', 'V4_5', 'V4_5PLUS', 'V4_5ALL', 'V5', 'V5_5', 'V6', 'V6_MINI', 'V6_WILD'],
  maxLetra: 5000, // V4: 3000
  maxEstilo: 1000,
  maxTitulo: 100,
  duracion: [10, 360],
  creditos: 12, // MUSICA.creditos en generar-musica.js, por generacion (las dos pistas)
};
const SALDO_POR_DEFECTO = 9999999;

/**
 * Latencias reales, en segundos, de la creacion al "success" (medidas en las
 * corridas de los anuncios). Se busca por PREFIJO del modelo que llega a
 * createTask, en este orden: el de Sunburst va antes que el de gpt-image-2
 * porque los dos empiezan igual.
 */
export const LATENCIAS_S = [
  ['nano-banana-2-1', 40, 90], // prueba real del 2026-11-08: 44 a 85 s; va antes que nano-banana-2 (mismo comienzo)
  ['nano-banana-2', 40, 100],
  ['gpt-image-2-5-sunburst', 60, 180], // text-to-image e image-to-image
  ['gpt-image-2', 40, 100], // iconos; sin medir, se asume como nano-banana-2
  ['google/gemini-omni-flash-1-2', 56, 90], // sin medir: se asume como el 1.1
  ['google/gemini-omni-flash-1-1', 56, 90],
  ['kling-3.0', 60, 120],
  ['kling-4.0', 60, 120], // sin medir: se asume como Kling 3.0
  // Prueba real del 2026-11-08 (temp/prueba-modelos-baratos), una o dos tareas por modelo:
  ['grok-imagine-video-1-5-preview', 50, 90], // 55 y 66 s
  ['grok-imagine/', 80, 130], // 104 s
  ['pixverse-v6/', 55, 100], // 67 s
  ['suno/', 40, 120], // generate de Suno (las tareas de /api/v1/generate van como "suno/<model>"); sin medir
  ['ai-music-api/', 60, 150], // extend de Suno por la API de jobs; sin medir
];
const LATENCIA_DESCONOCIDA_S = [40, 100];

// Lo que kie contesta en una tarea fallida. El de servidor es el texto real
// de un 500 de kie; el de contenido, el de un rechazo por politicas.
export const FALLO_SERVIDOR = { failCode: '500', failMsg: 'Internal Error, Please try again later.' };
export const FALLO_CONTENIDO = { failCode: '400', failMsg: 'The content violates our content policy' };
// Lo que dice createTask (y /generate) cuando no alcanza el saldo. Texto sin
// verificar contra kie: lo que importa es el code 402 de su documentacion.
export const SIN_SALDO = { code: 402, msg: 'The current credits are insufficient. Please top up.' };

export const LIMITE_KIE = { maximo: 20, ventanaMs: 10000 };

const ESTADOS_FINALES = new Set(['success', 'fail']);

// ---------------------------------------------------------------- opciones

/**
 * "--fallos" en texto ("servidor=10,contenido=5,trabadas=1,consulta500=5") o
 * ya como objeto. Porcentajes de 0 a 100.
 *
 *   servidor=P        P% de las tareas terminan en fail 500 ("try again later")
 *   contenido=P       P% de los pares modelo+prompt se rechazan por politicas
 *   trabadas=N        las N primeras tareas quedan en "generating" para siempre
 *   trabadas-desde=K  ...contando desde la tarea numero K (por defecto 1)
 *   consulta500=P     P% de las consultas (recordInfo) devuelven HTTP 500
 *   falla-modelo=M    TODAS las tareas de los modelos que empiezan por M fallan
 *                     por contenido (se puede repetir: falla-modelo=a,falla-modelo=b).
 *                     Sirve para ver que la cascada cae al modelo siguiente.
 *                     Tambien por la variable de entorno KIE_SIMULADO_FALLA_MODELOS
 *                     ("pixverse-v6/,grok-imagine/"), que se suma a esta opcion.
 */
export function parsearFallos(fallos) {
  const f = { servidorPct: 0, contenidoPct: 0, trabadas: 0, trabadasDesde: 1, consulta500Pct: 0, fallaModelos: [] };
  if (!fallos) return f;
  if (typeof fallos === 'object') return { ...f, ...fallos, fallaModelos: [...(fallos.fallaModelos || [])] };
  const claves = {
    servidor: 'servidorPct',
    fail: 'servidorPct',
    contenido: 'contenidoPct',
    politicas: 'contenidoPct',
    trabadas: 'trabadas',
    'trabadas-desde': 'trabadasDesde',
    consulta500: 'consulta500Pct',
  };
  for (const parte of String(fallos).split(',').map((s) => s.trim()).filter(Boolean)) {
    const [k, v] = parte.split('=').map((s) => s.trim());
    if (k === 'falla-modelo') {
      if (!v) throw new Error(`--fallos: "${parte}" no trae el modelo`);
      f.fallaModelos.push(v);
      continue;
    }
    const clave = claves[k];
    if (!clave) throw new Error(`--fallos: no conozco "${k}". Valen: ${Object.keys(claves).join(', ')}`);
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new Error(`--fallos: "${parte}" no trae un numero valido`);
    f[clave] = n;
  }
  return f;
}

export function describirFallos(f) {
  const partes = [];
  if (f.servidorPct) partes.push(`${f.servidorPct}% fail 500`);
  if (f.contenidoPct) partes.push(`${f.contenidoPct}% rechazo por contenido`);
  if (f.trabadas) partes.push(`${f.trabadas} trabada(s) desde la tarea ${f.trabadasDesde}`);
  if (f.consulta500Pct) partes.push(`${f.consulta500Pct}% de consultas con HTTP 500`);
  if (f.fallaModelos?.length) partes.push(`siempre fallan (contenido): ${f.fallaModelos.join(', ')}`);
  return partes.length ? partes.join(', ') : 'ninguno';
}

// ---------------------------------------------------------------- azar con semilla

/** Un numero en [0, 1) que depende solo de las partes: mismo pedido, mismo numero. */
function fraccion(...partes) {
  const h = crypto.createHash('sha1').update(partes.map(String).join('\u0000')).digest();
  return h.readUInt32BE(0) / 2 ** 32;
}

/** Secuencia con semilla (mulberry32) para lo que si depende del orden: las consultas. */
function secuencia(semilla) {
  let a = (Number(semilla) >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

// ---------------------------------------------------------------- archivos de resultado

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * La misma imagen base con un chunk tEXt que lleva la taskId: cada resultado
 * es un archivo distinto (otra huella, otro sha1) sin volver a llamar a ffmpeg.
 */
function pngConMarca(base, texto) {
  if (base.length < 12 || base.subarray(base.length - 8, base.length - 4).toString('latin1') !== 'IEND') return base;
  const tipo = Buffer.from('tEXt', 'latin1');
  const datos = Buffer.from(`kie-simulado\0${texto}`, 'latin1');
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tipo, datos])));
  const corte = base.length - 12;
  return Buffer.concat([base.subarray(0, corte), largo, tipo, datos, crc, base.subarray(corte)]);
}

const par = (n) => Math.max(2, Math.round(n / 2) * 2);

/** "9:16" -> [9, 16]; cualquier otra cosa ("auto", vacio) -> cuadrado. */
function proporcion(aspecto) {
  const m = String(aspecto || '').match(/^\s*(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)\s*$/);
  return m ? [Number(m[1]), Number(m[2])] : [1, 1];
}

/** Imagen: lado largo 1280 (cuadrada, 1024). 9:16 -> 720x1280. */
function tamanoImagen(aspecto) {
  const [a, b] = proporcion(aspecto);
  if (a === b) return [1024, 1024];
  return a > b ? [1280, par((1280 * b) / a)] : [par((1280 * a) / b), 1280];
}

/** Video: lado corto 720. 9:16 -> 720x1280. */
function tamanoVideo(aspecto) {
  const [a, b] = proporcion(aspecto);
  if (a === b) return [720, 720];
  return a > b ? [par((720 * a) / b), 720] : [720, par((720 * b) / a)];
}

function correrFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => reject(new Error(`no pude correr ffmpeg (${e.message}). El simulado lo necesita para los PNG y MP4.`)));
    p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg salio con ${c}: ${err.slice(0, 300)}`))));
  });
}

function crearCache(dirCache) {
  const enCurso = new Map();

  // Se genera a un temporal y se renombra: otro simulado (u otra peticion)
  // nunca lee un archivo a medias.
  async function cacheado(nombre, argsEntrada) {
    const ruta = path.join(dirCache, nombre);
    if (fs.existsSync(ruta)) return ruta;
    if (enCurso.has(ruta)) return enCurso.get(ruta);
    const p = (async () => {
      fs.mkdirSync(dirCache, { recursive: true });
      const ext = path.extname(nombre);
      const tmp = path.join(dirCache, `${path.basename(nombre, ext)}.${process.pid}-${Date.now()}.tmp${ext}`);
      await correrFfmpeg([...argsEntrada, tmp]);
      try {
        fs.renameSync(tmp, ruta);
      } catch (e) {
        if (!fs.existsSync(ruta)) throw e;
        fs.rmSync(tmp, { force: true });
      }
      return ruta;
    })().finally(() => enCurso.delete(ruta));
    enCurso.set(ruta, p);
    return p;
  }

  return {
    imagen: (ancho, alto, transparente) =>
      transparente
        ? cacheado(`imagen-${ancho}x${alto}-transparente.png`, [
            '-f', 'lavfi',
            '-i', `color=c=black@0:size=${ancho}x${alto},format=rgba,geq=r=230:g=140:b=40:a='if(lt(hypot(X-W/2,Y-H/2),W/3),255,0)'`,
            '-frames:v', '1',
          ])
        : cacheado(`imagen-${ancho}x${alto}.png`, ['-f', 'lavfi', '-i', `testsrc2=size=${ancho}x${alto}:rate=1`, '-frames:v', '1']),
    // testsrc a 24 fps con pista AAC muda: el motor (y el montaje) esperan
    // audio en los clips, como los de Omni y los de Kling con sound.
    video: (ancho, alto, segundos) =>
      cacheado(`video-${ancho}x${alto}-${segundos}s.mp4`, [
        '-f', 'lavfi', '-i', `testsrc=size=${ancho}x${alto}:rate=24:duration=${segundos}`,
        '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
        '-t', String(segundos),
        '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '64k', '-shortest', '-movflags', '+faststart',
      ]),
  };
}

// ---------------------------------------------------------------- que pide cada tarea

// Los de video cuyo nombre no lo dice (o dice "image", como el image-to-video
// de Grok) van por nombre; los demas, por la regla de siempre.
const MODELOS_DE_VIDEO = ['grok-imagine-video-1-5-preview', 'grok-imagine/image-to-video', 'pixverse-v6/'];
const esVideo = (modelo) =>
  MODELOS_DE_VIDEO.some((p) => modelo.startsWith(p)) || (/omni|kling|veo|seedance|runway|hailuo|sora|video/i.test(modelo) && !/image/i.test(modelo));
// El extend de Suno va por createTask (CANCION.extender en generar-cancion.js).
const esMusica = (modelo) => /^ai-music-api\//i.test(modelo);

function latenciaS(modelo) {
  const fila = LATENCIAS_S.find(([prefijo]) => modelo.startsWith(prefijo));
  return fila ? [fila[1], fila[2]] : LATENCIA_DESCONOCIDA_S;
}

/** La duracion pedida: los adaptadores de video (config.js) mandan input.duration como texto (omni, kling-3.0) o como numero (kling-4.0). */
function duracionPedida(input) {
  const d = Number.parseFloat(input?.duration ?? input?.duracion);
  if (!Number.isFinite(d) || d <= 0) return 5;
  return Math.min(60, Math.round(d * 10) / 10);
}

const r2 = (x) => Math.round(x * 100) / 100;

/**
 * Creditos como los cobra kie (los de PRECIOS y MODELOS_VIDEO en config.js; los
 * de Grok, PixVerse y Nano Banana 2.1, medidos el 2026-11-08; Omni 1.2, de su
 * pagina del 2026-11-13). Kling con los precios de kie del 2026-11-07.
 */
function creditosDe(modelo, input, segundos) {
  if (modelo.startsWith('suno/') || esMusica(modelo)) return SUNO.creditos;
  if (modelo.startsWith('gpt-image-2-5-sunburst')) return 10;
  if (modelo.startsWith('gpt-image-2')) return { '1K': 6, '2K': 10, '4K': 16 }[input?.resolution] ?? 6;
  if (modelo === 'nano-banana-2-1') return 6;
  if (modelo === 'nano-banana-2') return { '1K': 8, '2K': 12, '4K': 18 }[input?.resolution] ?? 8;
  // Omni Flash 1.2 (el principal desde el 2026-11-13) cobra POR SEGUNDO segun la resolucion (kie.ai/gemini-omni-1-2-flash).
  // Antes el simulado lo cobraba con los tramos del 1.1, y la prueba de humo veia «lo cobrado no es lo estimado».
  if (modelo === 'google/gemini-omni-flash-1-2') return ({ '360p': 4, '720p': 9, '1080p': 10, '4k': 22 }[input?.resolution] ?? 10) * Math.ceil(segundos);
  if (modelo.includes('omni')) return { 4: 63, 6: 84, 8: 105, 10: 126 }[segundos] ?? 105;
  if (modelo.startsWith('kling-4.0')) return ({ '1080p': 42.5 }[input?.resolution] ?? 28.5) * Math.ceil(segundos);
  if (modelo.startsWith('kling')) return r2((input?.sound === false ? 15.1 : 22.7) * Math.ceil(segundos));
  if (modelo === 'grok-imagine-video-1-5-preview') return r2(({ '480p': 2.4 }[input?.resolution] ?? 4.5) * Math.ceil(segundos));
  if (modelo === 'grok-imagine/image-to-video') return r2(({ '480p': 2.4, '1080p': 8 }[input?.resolution] ?? 4.5) * Math.ceil(segundos));
  if (modelo.startsWith('pixverse-v6/')) return r2((input?.generate_audio_switch === true ? 9.6 : 7.2) * Math.ceil(segundos));
  return 10;
}

/**
 * Lo que kie rechaza en createTask de los modelos nuevos (code 422, sin crear
 * tarea), segun su documentacion y la prueba real del 2026-11-08. Devuelve el
 * motivo o null. Omni, Kling, gpt-image-2 y nano-banana-2 no se revisan: se
 * aceptan como siempre. Sunburst (los anuncios de imagen lo mandan con
 * background y hasta 2 entradas), solo lo que dice su documentacion: prompt de
 * hasta 20000 caracteres, input_urls de 1 a 16 en el image-to-image y, si
 * viene, background opaque, transparent o auto (lo que mandan los videos, sin
 * background, se acepta como siempre).
 */
export function validarCuerpo(modelo, input) {
  const i = input && typeof input === 'object' ? input : {};
  const esUrl = (v) => typeof v === 'string' && /^https?:\/\//i.test(v);
  const entero = (v, min, max) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
  const enLista = (v, lista) => v === undefined || lista.includes(v);
  const sinPrompt = typeof i.prompt !== 'string' || !i.prompt.trim();

  if (modelo === 'pixverse-v6/transition') {
    if (sinPrompt) return 'prompt is required';
    if (!esUrl(i.first_frame_image_url)) return 'first_frame_image_url is required';
    if (!esUrl(i.last_frame_image_url)) return 'last_frame_image_url is required';
    if (!enLista(i.quality, ['360p', '540p', '720p', '1080p'])) return 'quality must be one of 360p, 540p, 720p, 1080p';
    if (i.duration !== undefined && !entero(i.duration, 1, 15)) return 'duration must be an integer between 1 and 15';
    if (i.generate_audio_switch !== undefined && typeof i.generate_audio_switch !== 'boolean') return 'generate_audio_switch must be a boolean';
    return null;
  }
  if (modelo === 'grok-imagine/image-to-video') {
    if (sinPrompt) return 'prompt is required';
    if (i.first_frame_url !== undefined || i.last_frame_url !== undefined) return 'first_frame_url and last_frame_url are not supported by this model';
    if (!Array.isArray(i.image_urls) || i.image_urls.length < 1 || i.image_urls.length > 7) return 'image_urls must have between 1 and 7 images';
    if (!i.image_urls.every(esUrl)) return 'image_urls must be URLs';
    if (i.duration !== undefined && !(typeof i.duration === 'string' && /^\d+$/.test(i.duration) && Number(i.duration) >= 6 && Number(i.duration) <= 30)) {
      return 'duration must be a string between "6" and "30"';
    }
    if (!enLista(i.resolution, ['480p', '720p', '1080p'])) return 'resolution must be one of 480p, 720p, 1080p';
    if (i.resolution === '1080p' && i.image_urls.length > 1) return '1080p only supports a single image';
    if (!enLista(i.aspect_ratio, ['2:3', '3:2', '1:1', '16:9', '9:16'])) return 'aspect_ratio must be one of 2:3, 3:2, 1:1, 16:9, 9:16';
    if (!enLista(i.mode, ['fun', 'normal', 'spicy'])) return 'mode must be one of fun, normal, spicy';
    return null;
  }
  if (modelo === 'grok-imagine-video-1-5-preview') {
    if (sinPrompt) return 'prompt is required';
    if (i.first_frame_url !== undefined && !esUrl(i.first_frame_url)) return 'first_frame_url must be a URL';
    if (i.last_frame_url !== undefined && !esUrl(i.first_frame_url)) return 'last_frame_url requires first_frame_url';
    if (i.last_frame_url !== undefined && !esUrl(i.last_frame_url)) return 'last_frame_url must be a URL';
    if (!esUrl(i.first_frame_url) && !(Array.isArray(i.image_urls) && i.image_urls.length === 1 && esUrl(i.image_urls[0]))) return 'first_frame_url is required';
    if (i.duration !== undefined && !entero(i.duration, 1, 15)) return 'duration must be an integer between 1 and 15';
    if (!enLista(i.resolution, ['480p', '720p', '1080p'])) return 'resolution must be one of 480p, 720p, 1080p';
    if (!enLista(i.aspect_ratio, ['auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'])) return 'aspect_ratio is not supported';
    return null;
  }
  if (modelo === 'gpt-image-2-5-sunburst-image-to-image' || modelo === 'gpt-image-2-5-sunburst-text-to-image') {
    if (sinPrompt) return 'prompt is required';
    if (i.prompt.length > 20000) return 'prompt must be at most 20000 characters';
    if (modelo === 'gpt-image-2-5-sunburst-image-to-image') {
      if (!Array.isArray(i.input_urls) || i.input_urls.length < 1 || i.input_urls.length > 16) return 'input_urls must have between 1 and 16 images';
      if (!i.input_urls.every(esUrl)) return 'input_urls must be URLs';
    }
    if (!enLista(i.background, ['opaque', 'transparent', 'auto'])) return 'background must be one of opaque, transparent, auto';
    return null;
  }
  if (modelo === 'nano-banana-2-1') {
    if (sinPrompt) return 'prompt is required';
    if (i.image_input !== undefined && (!Array.isArray(i.image_input) || i.image_input.length > 14 || !i.image_input.every(esUrl))) {
      return 'image_input must be a list of up to 14 image URLs';
    }
    if (!enLista(i.resolution, ['1K', '2K', '4K'])) return 'resolution must be one of 1K, 2K, 4K';
    if (!enLista(i.output_format, ['png', 'jpg'])) return 'output_format must be png or jpg';
    return null;
  }
  return null;
}

/** Todas las URLs que trae un input (first_frame_url, image_urls, input_urls, image_input...). */
function urlsDelInput(v, salida = []) {
  if (typeof v === 'string') {
    if (/^https?:\/\//i.test(v)) salida.push(v);
  } else if (Array.isArray(v)) {
    for (const x of v) urlsDelInput(x, salida);
  } else if (v && typeof v === 'object') {
    for (const x of Object.values(v)) urlsDelInput(x, salida);
  }
  return salida;
}

// ---------------------------------------------------------------- como suena una pista de Suno

const r3 = (x) => Math.round(x * 1000) / 1000;

/**
 * La duracion de una pista y, si es cantada, cuando se canta cada palabra de
 * la letra: [{ texto, inicio, fin }] (las marcas [Verso 1] / [Coro] no se
 * cantan: son una pausa entre secciones). La version 2 va un 7% mas lenta y
 * con otra entrada, asi las dos pistas no duran lo mismo, como en Suno.
 *
 *   duracion   la pedida (o null: la elige "Suno"). Como en Suno, TRUNCA: lo
 *              que no entra no se canta (medido con dinero el 2026-09-07).
 *   previas    extend: lo ya cantado; se queda lo que termina antes de `desde`
 *   desde      extend: continue_at; la letra nueva entra 0,8 s despues
 *
 * FUNCION PURA.
 */
export function planDeCancion(letra, { instrumental = false, duracion = null, version = 1, previas = [], desde = 0 } = {}) {
  const tempo = version === 1 ? 1 : 1.07;
  if (instrumental) return { duracion: duracion ?? (version === 1 ? 120 : 126), palabras: null };

  const palabras = previas.filter((p) => p.fin <= desde);
  let t = desde > 0 ? desde + 0.8 : version === 1 ? 5 : 6.5; // la entrada instrumental
  let hubo = false;
  for (const linea of String(letra).split(/\r?\n/)) {
    const limpia = linea.replace(/\[[^\]]*\]/g, ' ').trim();
    if (!limpia) {
      // Una marca de seccion: una pausa, salvo la primera.
      if (/\[[^\]]*\]/.test(linea) && hubo) t += 1.6 * tempo;
      continue;
    }
    for (const w of limpia.split(/\s+/)) {
      const letras = w.replace(/[^\p{L}\p{N}]/gu, '').length;
      if (!letras) continue;
      const d = (0.26 + 0.04 * Math.min(letras, 12)) * tempo;
      palabras.push({ texto: w, inicio: r3(t), fin: r3(t + d) });
      t += d + 0.07 * tempo;
      hubo = true;
    }
    t += 0.6 * tempo; // respiro al final de cada linea
  }
  if (duracion != null) return { duracion, palabras: palabras.filter((p) => p.fin <= duracion - 0.8) };
  return { duracion: r3(t + 4), palabras }; // y la salida instrumental
}

// ---------------------------------------------------------------- servidor

function statsVacias() {
  return {
    desde: new Date().toISOString(),
    creaciones: { aceptadas: 0, intentos: 0, devueltas429: 0, maxEnVentana: 0, porModelo: {} },
    maxEnMarcha: 0,
    destinos: { exito: 0, falloServidor: 0, falloContenido: 0, trabadas: 0 },
    consultas: {
      total: 0,
      devueltas500: 0,
      desconocidas: 0,
      maxHuecoMs: 0,
      minHuecoMs: null,
      enteradas: 0,
      demoraEnterarseTotalMs: 0,
      demoraEnterarseMaxMs: 0,
    },
    subidas: { total: 0, bytes: 0 },
    descargas: { total: 0, bytes: 0, antesDeTiempo: 0 },
    posiblesDuplicados: [],
    urlsDesconocidas: { total: 0, ejemplos: [] },
    rutasDesconocidas: {},
    sinClave: 0,
    sinSaldo: 0,
    cuerposInvalidos: 0, // createTask rechazados con 422 por validarCuerpo
    suno: { generaciones: 0, extensiones: 0, consultas: 0, letras: 0, rechazadas: 0, audioDesconocido: 0 },
  };
}

/**
 * Arranca el simulado. Devuelve { url, puerto, stats(), tareas(), reiniciarStats(), precalentar(), cerrar() }.
 *
 *   puerto     0 = uno libre (el que salga va en url)
 *   escala     multiplica las latencias reales (0.05 = 20 veces mas rapido)
 *   semilla    misma semilla + mismos pedidos = mismas demoras y mismos fallos
 *   fallos     ver parsearFallos()
 *   limite     { maximo, ventanaMs } de createTask; el de kie es 20 cada 10 s
 *   saldo      los creditos de la cuenta al empezar (por defecto, de sobra). Cada
 *              tarea que termina bien los descuenta; si lo que queda (menos lo que
 *              esta en marcha) no alcanza para una tarea nueva, createTask y
 *              /generate contestan code 402 y no crean nada
 *   dirCache   donde quedan los PNG y MP4 base (se reusan entre corridas) y las
 *              pistas de Suno (en suno/, con su .json para retomar tras reiniciar)
 *   estado     opcional: un archivo .jsonl donde queda cada tarea creada (y el
 *              saldo fijado). Al arrancar con el mismo archivo se recuperan: las
 *              tareas de antes se pueden consultar y bajar, el saldo sigue donde
 *              quedo y los duplicados se cuentan contra ellas. Es lo que deja
 *              probar "cerrar la app a mitad de camino y retomar". Sin el, cada
 *              arranque empieza de cero (como siempre).
 *   alRegistrar(linea)  opcional: una linea por cada creacion, 429 y fin de tarea
 */
export async function iniciar({
  puerto = 0,
  host = '127.0.0.1',
  escala = 0.05,
  semilla = 1,
  fallos = null,
  limite = LIMITE_KIE,
  saldo = SALDO_POR_DEFECTO,
  dirCache = DIR_CACHE_POR_DEFECTO,
  estado = null,
  alRegistrar = null,
} = {}) {
  const opcFallos = parsearFallos(fallos);
  // Los modelos que siempre fallan: los de la opcion y los de KIE_SIMULADO_FALLA_MODELOS.
  // Sin ninguno de los dos (lo normal), nada cambia.
  opcFallos.fallaModelos = [
    ...(opcFallos.fallaModelos || []),
    ...String(process.env.KIE_SIMULADO_FALLA_MODELOS || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  ];
  const fallaSiempre = (modelo) => opcFallos.fallaModelos.some((x) => modelo.startsWith(x));
  const lim = { ...LIMITE_KIE, ...limite };
  const cache = crearCache(dirCache);
  const azarConsultas = secuencia(Number(semilla) * 7919 + 13);
  const dirSuno = path.join(dirCache, 'suno');

  const tareas = new Map(); // taskId -> tarea (las de jobs y las de Suno, con t.tipo)
  const porClave = new Map(); // modelo + prompt -> [tareas], en orden de creacion
  const subidas = new Map(); // id -> { buffer, mime, nombre }
  const pistas = new Map(); // audioId -> pista de Suno
  const pistasEnCurso = new Map(); // audioId -> promesa del mp3 que se esta armando
  const urlsConocidas = new Set();
  let bytesSubidosEnMemoria = 0;
  let ventana = []; // instantes de las creaciones aceptadas (para el 429)
  let numero = 0;
  let consultas500 = 0;
  let stats = statsVacias();
  let base = '';
  let saldoInicial = Number.isFinite(Number(saldo)) ? Number(saldo) : SALDO_POR_DEFECTO;

  const registrar = (linea) => alRegistrar?.(linea);

  // ---- estado en disco (opcional): una linea JSON por tarea creada
  const CAMPOS_TAREA = ['taskId', 'numero', 'modelo', 'prompt', 'intento', 'input', 'video', 'segundos', 'ancho', 'alto', 'transparente', 'creditos', 'destino', 'creado', 'waitingHasta', 'queuingHasta', 'finEn', 'latenciaMs', 'tipo', 'musica', 'ext'];
  function anotar(registro) {
    if (!estado) return;
    try {
      fs.mkdirSync(path.dirname(estado), { recursive: true });
      fs.appendFileSync(estado, JSON.stringify(registro) + '\n', 'utf8');
    } catch {
      // sin disco sigue andando en memoria
    }
  }
  function anotarTarea(t) {
    const r = { que: 'tarea' };
    for (const k of CAMPOS_TAREA) r[k] = t[k];
    if (r.finEn === Infinity) r.finEn = null; // trabada: JSON no tiene Infinity
    if (t.pistas) r.pistas = t.pistas.map((p) => p.id);
    anotar(r);
  }
  let recuperadas = 0;
  if (estado && fs.existsSync(estado)) {
    for (const linea of fs.readFileSync(estado, 'utf8').split(/\r?\n/)) {
      if (!linea.trim()) continue;
      let r;
      try {
        r = JSON.parse(linea);
      } catch {
        continue; // una linea a medias (se corto la app escribiendola)
      }
      if (r.que === 'saldo' && Number.isFinite(r.saldoInicial)) saldoInicial = r.saldoInicial;
      if (r.que !== 'tarea' || !r.taskId) continue;
      const t = { ...r, finEn: r.finEn === null ? Infinity : r.finEn, ultimaConsulta: null, enterado: true, tipo: r.tipo || 'jobs' };
      delete t.que;
      if (Array.isArray(r.pistas)) t.pistas = r.pistas.map((id) => pistaDe(id)).filter(Boolean);
      tareas.set(t.taskId, t);
      const clave = `${t.modelo}\n${t.prompt}`;
      porClave.set(clave, [...(porClave.get(clave) || []), t]);
      numero = Math.max(numero, Number(t.numero) || 0);
      recuperadas++;
    }
  }

  // ---- saldo: lo que cobro kie es lo que termino bien
  function cuentaDeSaldo(ahora = Date.now()) {
    let gastado = 0;
    let reservado = 0;
    for (const t of tareas.values()) {
      const e = estadoDe(t, ahora);
      if (e === 'success') gastado += t.creditos;
      else if (!ESTADOS_FINALES.has(e)) reservado += t.creditos;
    }
    const redondo = (x) => Math.round(x * 10) / 10;
    return { inicial: saldoInicial, gastado: redondo(gastado), reservado: redondo(reservado), restante: redondo(saldoInicial - gastado) };
  }
  const alcanza = (creditos, ahora) => {
    const c = cuentaDeSaldo(ahora);
    return c.restante - c.reservado >= creditos;
  };

  function estadoDe(t, ahora) {
    if (t.destino === 'trabada') return ahora < t.waitingHasta ? 'waiting' : 'generating';
    if (ahora >= t.finEn) return t.destino === 'exito' ? 'success' : 'fail';
    if (ahora < t.waitingHasta) return 'waiting';
    if (ahora < t.queuingHasta) return 'queuing';
    return 'generating';
  }

  function enMarcha(ahora) {
    let n = 0;
    for (const t of tareas.values()) if (!ESTADOS_FINALES.has(estadoDe(t, ahora))) n++;
    return n;
  }

  /** "ancho:alto" de un PNG subido a este simulado; si no se puede leer, 9:16 (el de los anuncios). */
  function aspectoDeImagenSubida(url) {
    const id = String(url || '').match(/\/archivos\/subidas\/([0-9a-f]+)\//)?.[1];
    const b = id ? subidas.get(id)?.buffer : null;
    if (b && b.length >= 24 && b.readUInt32BE(0) === 0x89504e47) return `${b.readUInt32BE(16)}:${b.readUInt32BE(20)}`;
    return '9:16';
  }

  function crear(cuerpo) {
    const ahora = Date.now();
    const modelo = String(cuerpo.model);
    const input = cuerpo.input && typeof cuerpo.input === 'object' ? cuerpo.input : {};
    const prompt = String(input.prompt ?? '');
    const clave = `${modelo}\n${prompt}`;
    const anteriores = porClave.get(clave) || [];
    const intento = anteriores.length + 1;

    // Lo que importa para la cuenta es lo que KIE ve: una tarea igual que
    // sigue en marcha (aunque el motor la haya dado por perdida) o que ya
    // termino bien se cobra otra vez.
    const viva = anteriores.find((t) => !ESTADOS_FINALES.has(estadoDe(t, ahora)));
    const bien = anteriores.find((t) => estadoDe(t, ahora) === 'success');

    numero++;
    const taskId = `sim${String(numero).padStart(5, '0')}${crypto.randomBytes(4).toString('hex')}`;
    const musica = esMusica(modelo);
    const video = !musica && esVideo(modelo);
    const segundos = video ? duracionPedida(input) : null;
    // PixVerse no tiene aspect_ratio: su video sale con el aspecto de la imagen inicial.
    const aspecto = input.aspect_ratio ?? (video ? aspectoDeImagenSubida(input.first_frame_image_url ?? input.first_frame_url) : undefined);
    const [ancho, alto] = musica ? [0, 0] : video ? tamanoVideo(aspecto) : tamanoImagen(aspecto);

    const [min, max] = latenciaS(modelo);
    const uLat = fraccion(semilla, 'latencia', modelo, prompt, intento);
    const latenciaMs = Math.max(50, Math.round((min + uLat * (max - min)) * 1000 * escala));

    let destino = 'exito';
    const desde = opcFallos.trabadasDesde || 1;
    if (opcFallos.trabadas && numero >= desde && numero < desde + opcFallos.trabadas) destino = 'trabada';
    else if (fallaSiempre(modelo)) destino = 'falloContenido';
    // (2026-11-21h) un prompt con la marca SIM-PROHIBIDO se rechaza por contenido con TODOS los modelos, como una
    // palabra que el filtro de kie no deja pasar: asi se prueba que la app reescribe la imagen sola y la vuelve a pedir
    else if (/\bSIM-PROHIBIDO\b/.test(String(prompt))) destino = 'falloContenido';
    else if (fraccion(semilla, 'contenido', modelo, prompt) * 100 < opcFallos.contenidoPct) destino = 'falloContenido';
    else if (fraccion(semilla, 'servidor', modelo, prompt, intento) * 100 < opcFallos.servidorPct) destino = 'falloServidor';

    // Un fallo llega en algun momento entre el 30 y el 100% de la latencia.
    const finMs = destino === 'exito' ? latenciaMs : Math.round(latenciaMs * (0.3 + 0.7 * fraccion(semilla, 'fin', modelo, prompt, intento)));

    const t = {
      taskId,
      numero,
      modelo,
      prompt,
      intento,
      input,
      video,
      segundos,
      ancho,
      alto,
      transparente: input.background === 'transparent',
      creditos: creditosDe(modelo, input, segundos),
      destino,
      creado: ahora,
      waitingHasta: ahora + Math.round(latenciaMs * 0.1),
      queuingHasta: ahora + Math.round(latenciaMs * 0.2),
      finEn: destino === 'trabada' ? Infinity : ahora + finMs,
      latenciaMs: finMs,
      ultimaConsulta: null,
      enterado: false,
      tipo: 'jobs',
      musica,
      ext: musica ? 'mp3' : video ? 'mp4' : 'png',
    };
    // El extend de Suno: la cancion ENTERA (lo ya cantado hasta continue_at y
    // el bloque nuevo), en dos versiones, como en kie.
    if (musica) {
      const original = pistaDe(input.audio_id);
      if (!original) stats.suno.audioDesconocido++;
      const desde = Number(input.continue_at) || original?.duracion || 0;
      t.pistas = [1, 2].map((version) =>
        nuevaPista({
          taskId,
          version,
          letra: String(input.prompt ?? ''),
          estilo: String(input.style ?? original?.estilo ?? ''),
          titulo: String(input.title ?? original?.titulo ?? ''),
          modelo: String(input.model ?? original?.modelo ?? 'V5_5'),
          instrumental: original?.instrumental ?? false,
          voz: input.vocal_gender ?? original?.voz ?? null,
          plan: planDeCancion(String(input.prompt ?? ''), { version, previas: original?.palabras || [], desde }),
        })
      );
      stats.suno.extensiones++;
    }
    tareas.set(taskId, t);
    anotarTarea(t);
    anteriores.push(t);
    porClave.set(clave, anteriores);
    // Lo que el simulado entrega tambien es una URL conocida: el motor usa la
    // URL de una hoja generada como referencia de las tomas.
    urlsConocidas.add(`${base}/archivos/resultados/${taskId}.${t.ext}`);

    stats.creaciones.aceptadas++;
    stats.creaciones.porModelo[modelo] = (stats.creaciones.porModelo[modelo] || 0) + 1;
    stats.destinos[destino === 'trabada' ? 'trabadas' : destino]++;
    stats.maxEnMarcha = Math.max(stats.maxEnMarcha, enMarcha(ahora));

    if (viva || bien) {
      const anterior = viva || bien;
      stats.posiblesDuplicados.push({
        taskId,
        anterior: anterior.taskId,
        motivo: viva ? 'la anterior seguia en marcha en kie' : 'la anterior ya habia terminado bien',
        modelo,
        prompt: prompt.slice(0, 100),
      });
    }

    const desconocidas = urlsDelInput(input).filter((u) => !urlsConocidas.has(u));
    if (desconocidas.length) {
      stats.urlsDesconocidas.total += desconocidas.length;
      for (const u of desconocidas) if (stats.urlsDesconocidas.ejemplos.length < 10) stats.urlsDesconocidas.ejemplos.push(u);
    }

    const que = musica ? `extend de ${input.audio_id || '?'}` : video ? `${segundos}s ${ancho}x${alto}` : `${ancho}x${alto}`;
    const fin = destino === 'trabada' ? 'trabada' : `${destino} en ${(finMs / 1000).toFixed(1)} s`;
    registrar(`  ..  createTask #${numero} ${modelo} (${que}) -> ${fin}${viva || bien ? '  [POSIBLE DUPLICADO]' : ''}`);
    return t;
  }

  function datosDe(t, ahora) {
    const state = estadoDe(t, ahora);
    const fallo = t.destino === 'falloContenido' ? FALLO_CONTENIDO : FALLO_SERVIDOR;
    const url = `${base}/archivos/resultados/${t.taskId}.${t.ext}`;
    return {
      taskId: t.taskId,
      model: t.modelo,
      state,
      param: JSON.stringify({ model: t.modelo, input: t.input }),
      resultJson:
        state !== 'success'
          ? ''
          : t.musica
            ? JSON.stringify({ resultUrls: t.pistas.map((p) => urlDePista(p.id)), data: t.pistas.map(pistaPublica) })
            : JSON.stringify({ resultUrls: [url] }),
      failCode: state === 'fail' ? fallo.failCode : '',
      failMsg: state === 'fail' ? fallo.failMsg : '',
      creditsConsumed: state === 'success' ? t.creditos : state === 'fail' ? 0 : null,
      costTime: ESTADOS_FINALES.has(state) ? t.latenciaMs : null,
      createTime: t.creado,
      updateTime: ahora,
      completeTime: ESTADOS_FINALES.has(state) ? t.finEn : null,
      progress: ESTADOS_FINALES.has(state) ? '1.00' : Math.min(0.99, (ahora - t.creado) / (t.latenciaMs || 1)).toFixed(2),
    };
  }

  function consultar(taskId, res) {
    const ahora = Date.now();
    stats.consultas.total++;
    const t = tareas.get(taskId);
    // Una tarea de /api/v1/generate (Suno) no existe para la API de jobs.
    if (!t || t.tipo !== 'jobs') {
      stats.consultas.desconocidas++;
      return json(res, 200, { code: 422, msg: 'recordInfo is null', data: null });
    }

    // Cadencia de consulta: el hueco entre dos consultas de la misma tarea
    // mientras seguia sin terminar (el plan pide no pasar de 5 s).
    const estadoAnterior = t.ultimaConsulta === null ? null : estadoDe(t, t.ultimaConsulta);
    if (t.ultimaConsulta !== null && !ESTADOS_FINALES.has(estadoAnterior)) {
      const hueco = ahora - t.ultimaConsulta;
      stats.consultas.maxHuecoMs = Math.max(stats.consultas.maxHuecoMs, hueco);
      stats.consultas.minHuecoMs = stats.consultas.minHuecoMs === null ? hueco : Math.min(stats.consultas.minHuecoMs, hueco);
    }
    t.ultimaConsulta = ahora;

    if (opcFallos.consulta500Pct && azarConsultas() * 100 < opcFallos.consulta500Pct) {
      stats.consultas.devueltas500++;
      // Mitad JSON, mitad pagina de error: kie de verdad devuelve de las dos.
      return ++consultas500 % 2
        ? json(res, 500, { code: 500, msg: 'Internal Server Error', data: null })
        : texto(res, 500, '<html><body><h1>500 Internal Server Error</h1></body></html>', 'text/html');
    }

    const datos = datosDe(t, ahora);
    if (ESTADOS_FINALES.has(datos.state) && !t.enterado) {
      t.enterado = true;
      const demora = ahora - t.finEn;
      stats.consultas.enteradas++;
      stats.consultas.demoraEnterarseTotalMs += demora;
      stats.consultas.demoraEnterarseMaxMs = Math.max(stats.consultas.demoraEnterarseMaxMs, demora);
      registrar(`${datos.state === 'success' ? '  OK  ' : '  !  '}tarea #${t.numero} ${datos.state} (el motor se entero ${(demora / 1000).toFixed(1)} s despues)`);
    }
    return json(res, 200, { code: 200, msg: 'success', data: datos });
  }

  function subir(cuerpo, res) {
    const m = String(cuerpo.base64Data || '').match(/^data:([^;]+);base64,(.*)$/s);
    const buffer = Buffer.from(m ? m[2] : String(cuerpo.base64Data || ''), 'base64');
    if (!buffer.length) return json(res, 200, { success: false, code: 400, msg: 'base64Data vacio', data: null });
    const id = crypto.randomBytes(6).toString('hex');
    const nombre = String(cuerpo.fileName || 'archivo').replace(/[^\w.-]+/g, '_');
    // Lo subido solo se guarda mientras no pase de 512 MB: el motor nunca lo
    // vuelve a bajar, pero la URL tiene que responder si alguien la abre.
    if (bytesSubidosEnMemoria + buffer.length <= 512 * 1024 * 1024) {
      subidas.set(id, { buffer, mime: m ? m[1] : 'application/octet-stream' });
      bytesSubidosEnMemoria += buffer.length;
    }
    stats.subidas.total++;
    stats.subidas.bytes += buffer.length;
    const downloadUrl = `${base}/archivos/subidas/${id}/${nombre}`;
    urlsConocidas.add(downloadUrl);
    return json(res, 200, {
      success: true,
      code: 200,
      msg: 'File uploaded successfully',
      data: {
        fileName: nombre,
        filePath: `${cuerpo.uploadPath || 'anuncios-ia'}/${nombre}`,
        downloadUrl,
        fileSize: buffer.length,
        mimeType: m ? m[1] : 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
      },
    });
  }

  async function servirResultado(nombre, res) {
    const taskId = nombre.replace(/\.[a-z0-9]+$/i, '');
    const t = tareas.get(taskId);
    const ahora = Date.now();
    if (!t || t.tipo !== 'jobs' || t.musica) return texto(res, 404, 'no existe');
    if (estadoDe(t, ahora) !== 'success') {
      stats.descargas.antesDeTiempo++;
      return texto(res, 404, 'la tarea no termino bien');
    }
    let cuerpo;
    if (t.video) {
      cuerpo = fs.readFileSync(await cache.video(t.ancho, t.alto, t.segundos));
    } else {
      cuerpo = pngConMarca(fs.readFileSync(await cache.imagen(t.ancho, t.alto, t.transparente)), t.taskId);
    }
    stats.descargas.total++;
    stats.descargas.bytes += cuerpo.length;
    res.writeHead(200, { 'Content-Type': t.video ? 'video/mp4' : 'image/png', 'Content-Length': cuerpo.length });
    res.end(cuerpo);
  }

  // ---------------------------------------------------------------- Suno

  // Declaradas como function (no const): las usa la recuperacion del estado, mas arriba.
  function urlDePista(id) {
    return `${base}/archivos/musica/${id}.mp3`;
  }
  function rutaPista(id, ext) {
    return path.join(dirSuno, `${String(id).replace(/[^\w-]/g, '_')}.${ext}`);
  }

  /** Una pista por su audioId: de la memoria o, tras reiniciar, de su .json en dirCache. */
  function pistaDe(id) {
    if (!id) return null;
    if (pistas.has(id)) return pistas.get(id);
    try {
      const p = JSON.parse(fs.readFileSync(rutaPista(id, 'json'), 'utf8'));
      pistas.set(id, p);
      return p;
    } catch {
      return null;
    }
  }

  function nuevaPista({ taskId, version, letra, estilo, titulo, modelo, instrumental, voz, plan }) {
    const p = {
      id: crypto.randomUUID(),
      taskId,
      version,
      letra,
      estilo,
      titulo,
      modelo,
      instrumental,
      voz,
      duracion: plan.duracion,
      palabras: plan.palabras,
      creada: new Date().toISOString(),
    };
    pistas.set(p.id, p);
    urlsConocidas.add(urlDePista(p.id));
    // En disco, para que un extend o una descarga despues de reiniciar la app la encuentren.
    try {
      fs.mkdirSync(dirSuno, { recursive: true });
      fs.writeFileSync(rutaPista(p.id, 'json'), JSON.stringify(p) + '\n', 'utf8');
    } catch {
      // sin disco sigue andando en memoria
    }
    return p;
  }

  /** Una pista con la forma de sunoData (las URL van en las dos grafias: el motor lee audio_url). */
  function pistaPublica(p) {
    const url = urlDePista(p.id);
    return {
      id: p.id,
      audioUrl: url,
      audio_url: url,
      sourceAudioUrl: url,
      source_audio_url: url,
      streamAudioUrl: url,
      stream_audio_url: url,
      imageUrl: '',
      prompt: p.instrumental ? '' : p.letra,
      modelName: `chirp-${String(p.modelo).toLowerCase().replace(/_/g, '-')}`,
      title: p.titulo,
      tags: p.estilo,
      createTime: p.creada,
      duration: p.duracion,
    };
  }

  function crearSuno(cuerpo) {
    const ahora = Date.now();
    const modelo = `suno/${cuerpo.model}`;
    const instrumental = cuerpo.instrumental === true;
    const letra = String(cuerpo.prompt ?? '');
    const estilo = String(cuerpo.style ?? '');
    // Para el rechazo por contenido y los duplicados cuenta lo que se canta y como.
    const prompt = `${estilo}\n${letra}`;
    const clave = `${modelo}\n${prompt}`;
    const anteriores = porClave.get(clave) || [];
    const intento = anteriores.length + 1;
    const viva = anteriores.find((x) => !ESTADOS_FINALES.has(estadoDe(x, ahora)));
    const bien = anteriores.find((x) => estadoDe(x, ahora) === 'success');

    numero++;
    const taskId = `sim${String(numero).padStart(5, '0')}${crypto.randomBytes(4).toString('hex')}`;
    const [min, max] = latenciaS(modelo);
    const latenciaMs = Math.max(50, Math.round((min + fraccion(semilla, 'latencia', modelo, prompt, intento) * (max - min)) * 1000 * escala));
    let destino = 'exito';
    const desde = opcFallos.trabadasDesde || 1;
    if (opcFallos.trabadas && numero >= desde && numero < desde + opcFallos.trabadas) destino = 'trabada';
    else if (fraccion(semilla, 'contenido', modelo, prompt) * 100 < opcFallos.contenidoPct) destino = 'falloContenido';
    else if (fraccion(semilla, 'servidor', modelo, prompt, intento) * 100 < opcFallos.servidorPct) destino = 'falloServidor';
    const finMs = destino === 'exito' ? latenciaMs : Math.round(latenciaMs * (0.3 + 0.7 * fraccion(semilla, 'fin', modelo, prompt, intento)));
    const duracion = cuerpo.duration != null ? Number(cuerpo.duration) : null;

    const t = {
      taskId,
      numero,
      modelo,
      prompt,
      intento,
      input: cuerpo,
      video: false,
      segundos: null,
      creditos: creditosDe(modelo, cuerpo, null),
      destino,
      creado: ahora,
      waitingHasta: ahora + Math.round(latenciaMs * 0.25),
      queuingHasta: ahora + Math.round(latenciaMs * 0.6),
      finEn: destino === 'trabada' ? Infinity : ahora + finMs,
      latenciaMs: finMs,
      ultimaConsulta: null,
      enterado: false,
      tipo: 'suno',
      musica: true,
      ext: 'mp3',
    };
    t.pistas = [1, 2].map((version) =>
      nuevaPista({
        taskId,
        version,
        letra,
        estilo,
        titulo: String(cuerpo.title ?? ''),
        modelo: String(cuerpo.model),
        instrumental,
        voz: cuerpo.vocalGender ?? null,
        plan: planDeCancion(letra, { instrumental, duracion, version }),
      })
    );
    tareas.set(taskId, t);
    anotarTarea(t);
    anteriores.push(t);
    porClave.set(clave, anteriores);

    stats.creaciones.aceptadas++;
    stats.creaciones.porModelo[modelo] = (stats.creaciones.porModelo[modelo] || 0) + 1;
    stats.destinos[destino === 'trabada' ? 'trabadas' : destino]++;
    stats.maxEnMarcha = Math.max(stats.maxEnMarcha, enMarcha(ahora));
    stats.suno.generaciones++;
    if (viva || bien) {
      const anterior = viva || bien;
      stats.posiblesDuplicados.push({
        taskId,
        anterior: anterior.taskId,
        motivo: viva ? 'la anterior seguia en marcha en kie' : 'la anterior ya habia terminado bien',
        modelo,
        prompt: prompt.slice(0, 100),
      });
    }
    const fin = destino === 'trabada' ? 'trabada' : `${destino} en ${(finMs / 1000).toFixed(1)} s`;
    registrar(`  ..  Suno #${numero} ${cuerpo.model} ${instrumental ? 'instrumental' : 'cantada'} (${t.pistas.map((p) => `${p.duracion.toFixed(0)} s`).join(' y ')}) -> ${fin}${viva || bien ? '  [POSIBLE DUPLICADO]' : ''}`);
    return t;
  }

  /** Los estados de Suno: PENDING -> TEXT_SUCCESS -> FIRST_SUCCESS -> SUCCESS (o uno de fallo). */
  function estadoSuno(t, ahora) {
    const e = estadoDe(t, ahora);
    if (e === 'success') return 'SUCCESS';
    if (e === 'fail') return t.destino === 'falloContenido' ? 'SENSITIVE_WORD_ERROR' : 'GENERATE_AUDIO_FAILED';
    if (e === 'waiting') return 'PENDING';
    if (e === 'queuing' || t.destino === 'trabada') return 'TEXT_SUCCESS';
    return 'FIRST_SUCCESS';
  }

  function validarSuno(c) {
    if (!c || typeof c !== 'object') return 'body is required';
    if (!SUNO.modelos.includes(c.model)) return `model must be one of ${SUNO.modelos.join(', ')}`;
    if (!c.callBackUrl) return 'callBackUrl cannot be empty';
    if (c.customMode) {
      if (!c.style) return 'style is required in custom mode';
      if (!c.title) return 'title is required in custom mode';
      if (!c.instrumental && !c.prompt) return 'prompt is required when instrumental is false';
    } else if (!c.prompt) return 'prompt is required';
    if (String(c.prompt ?? '').length > (c.model === 'V4' ? 3000 : SUNO.maxLetra)) return 'prompt is too long';
    if (String(c.style ?? '').length > SUNO.maxEstilo) return 'style is too long';
    if (String(c.title ?? '').length > SUNO.maxTitulo) return 'title is too long';
    if (c.duration != null && !(Number(c.duration) >= SUNO.duracion[0] && Number(c.duration) <= SUNO.duracion[1])) {
      return `duration must be between ${SUNO.duracion[0]} and ${SUNO.duracion[1]}`;
    }
    return null;
  }

  function consultarSuno(taskId, res) {
    const ahora = Date.now();
    stats.suno.consultas++;
    const t = tareas.get(taskId);
    if (!t || t.tipo !== 'suno') return json(res, 200, { code: 422, msg: 'recordInfo is null', data: null });
    t.ultimaConsulta = ahora;
    if (opcFallos.consulta500Pct && azarConsultas() * 100 < opcFallos.consulta500Pct) {
      stats.consultas.devueltas500++;
      return ++consultas500 % 2
        ? json(res, 500, { code: 500, msg: 'Internal Server Error', data: null })
        : texto(res, 500, '<html><body><h1>500 Internal Server Error</h1></body></html>', 'text/html');
    }
    const status = estadoSuno(t, ahora);
    if ((status === 'SUCCESS' || status.endsWith('_ERROR') || status.endsWith('_FAILED')) && !t.enterado) {
      t.enterado = true;
      registrar(`${status === 'SUCCESS' ? '  OK  ' : '  !  '}Suno #${t.numero} ${status}`);
    }
    const fallo = t.destino === 'falloContenido' ? 'Your lyrics contain sensitive words. Please modify them and try again.' : FALLO_SERVIDOR.failMsg;
    const listas = status === 'SUCCESS' || status === 'FIRST_SUCCESS';
    return json(res, 200, {
      code: 200,
      msg: 'success',
      data: {
        taskId: t.taskId,
        parentMusicId: '',
        param: JSON.stringify(t.input),
        response: listas
          ? {
              taskId: t.taskId,
              // FIRST_SUCCESS: solo la primera, y todavia sin el mp3 final.
              sunoData: (status === 'SUCCESS' ? t.pistas : t.pistas.slice(0, 1)).map((p) =>
                status === 'SUCCESS' ? pistaPublica(p) : { ...pistaPublica(p), audioUrl: '', audio_url: '', sourceAudioUrl: '', source_audio_url: '' }
              ),
            }
          : null,
        status,
        type: 'GENERATE',
        operationType: 'generate',
        errorCode: status.endsWith('_ERROR') || status.endsWith('_FAILED') ? (t.destino === 'falloContenido' ? 400 : 500) : null,
        errorMessage: status.endsWith('_ERROR') || status.endsWith('_FAILED') ? fallo : null,
      },
    });
  }

  function letraSuno(cuerpo, res) {
    stats.suno.letras++;
    const p = pistaDe(cuerpo?.audioId);
    const t = tareas.get(cuerpo?.taskId);
    // Los tiempos de Suno solo existen para las pistas de /generate, no para un extend.
    if (!p || (t && t.tipo !== 'suno') || p.taskId !== cuerpo?.taskId) return json(res, 200, { code: 422, msg: 'No lyrics found for this taskId and audioId', data: null });
    if (p.instrumental || !p.palabras?.length) return json(res, 200, { code: 400, msg: 'This track is instrumental: there are no lyrics to align', data: null });
    return json(res, 200, {
      code: 200,
      msg: 'success',
      data: {
        alignedWords: p.palabras.map((w) => ({ word: `${w.texto} `, success: true, startS: w.inicio, endS: w.fin, palign: 0 })),
        waveformData: [],
        hootCer: 0.08,
        isStreamed: false,
      },
    });
  }

  /** El mp3 de una pista: se arma la primera vez que se baja y queda en dirCache/suno/. */
  async function servirPista(id, res) {
    const p = pistaDe(id);
    if (!p) return texto(res, 404, 'no existe');
    const t = tareas.get(p.taskId);
    if (t && estadoDe(t, Date.now()) !== 'success') {
      stats.descargas.antesDeTiempo++;
      return texto(res, 404, 'la tarea no termino bien');
    }
    const ruta = rutaPista(p.id, 'mp3');
    if (!fs.existsSync(ruta)) {
      if (!pistasEnCurso.has(p.id)) {
        const armar = (async () => {
          const muestras = new Float32Array(Math.ceil(p.duracion * MUESTREO));
          sumarMusica(muestras, { semilla: `${semilla}-${p.id}`, nivel: p.instrumental ? 0.12 : 0.07 });
          if (p.palabras?.length) sumarVoz(muestras, p.palabras, { tono: p.voz === 'm' ? 140 : 230, nivel: 0.3, semilla: p.id, melodia: true });
          await escribirMp3(ruta, muestras, {
            palabras: p.palabras?.length ? p.palabras : null,
            etiquetas: { title: p.titulo || 'Suno simulado', artist: 'Suno simulado' },
            canales: 2,
          });
        })().finally(() => pistasEnCurso.delete(p.id));
        pistasEnCurso.set(p.id, armar);
      }
      await pistasEnCurso.get(p.id);
    }
    const cuerpo = fs.readFileSync(ruta);
    stats.descargas.total++;
    stats.descargas.bytes += cuerpo.length;
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': cuerpo.length });
    res.end(cuerpo);
  }

  function json(res, codigo, obj) {
    const cuerpo = JSON.stringify(obj);
    res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(cuerpo) });
    res.end(cuerpo);
  }

  function texto(res, codigo, cuerpo, tipo = 'text/plain') {
    res.writeHead(codigo, { 'Content-Type': `${tipo}; charset=utf-8`, 'Content-Length': Buffer.byteLength(cuerpo) });
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
      req.on('end', () => resolve(Buffer.concat(partes).toString('utf8')));
      req.on('error', reject);
    });
  }

  const conClave = (req) => /^Bearer\s+\S+/i.test(String(req.headers.authorization || ''));

  async function atender(req, res) {
    const u = new URL(req.url, 'http://simulado');
    const ruta = u.pathname;

    if (req.method === 'GET' && ruta === '/__stats') return json(res, 200, resumenStats());
    if (req.method === 'GET' && ruta === '/__tareas') return json(res, 200, listaTareas());
    if (req.method === 'POST' && ruta === '/__reiniciar') {
      reiniciarStats();
      return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && ruta === '/__saldo') {
      let cuerpo = {};
      try {
        cuerpo = JSON.parse(await leerCuerpo(req));
      } catch {
        // sin cuerpo: se muestra el saldo sin tocarlo
      }
      if (Number.isFinite(Number(cuerpo.creditos))) fijarSaldo(Number(cuerpo.creditos));
      return json(res, 200, cuentaDeSaldo());
    }
    if (req.method === 'GET' && ruta.startsWith('/archivos/resultados/')) return servirResultado(path.basename(ruta), res);
    if (req.method === 'GET' && ruta.startsWith('/archivos/musica/')) return servirPista(path.basename(ruta, '.mp3'), res);
    if (req.method === 'GET' && ruta.startsWith('/archivos/subidas/')) {
      const s = subidas.get(ruta.split('/')[3]);
      if (!s) return texto(res, 404, 'no existe (o no se guardo: el simulado guarda hasta 512 MB)');
      res.writeHead(200, { 'Content-Type': s.mime, 'Content-Length': s.buffer.length });
      return res.end(s.buffer);
    }

    const esApi = [RUTAS.crearTarea, RUTAS.consultarTarea, RUTAS.creditos, RUTAS.subirBase64, RUTAS.sunoGenerar, RUTAS.sunoConsultar, RUTAS.sunoLetra].includes(ruta);
    if (esApi && !conClave(req)) {
      stats.sinClave++;
      // kie contesta 200 con el rechazo en el cuerpo (ver verificar.js).
      return json(res, 200, { code: 401, msg: 'You do not have access permissions', data: null });
    }

    if (req.method === 'POST' && ruta === RUTAS.crearTarea) {
      stats.creaciones.intentos++;
      const ahora = Date.now();
      ventana = ventana.filter((x) => x > ahora - lim.ventanaMs);
      if (ventana.length >= lim.maximo) {
        stats.creaciones.devueltas429++;
        registrar(`  !  createTask rechazado con 429 (${ventana.length} creaciones en los ultimos ${lim.ventanaMs / 1000} s)`);
        return json(res, 429, { code: 429, msg: `Too many requests: el simulado admite ${lim.maximo} createTask cada ${lim.ventanaMs / 1000} s`, data: null });
      }
      let cuerpo;
      try {
        cuerpo = JSON.parse(await leerCuerpo(req));
      } catch {
        return json(res, 400, { code: 400, msg: 'cuerpo que no es JSON', data: null });
      }
      if (!cuerpo?.model || typeof cuerpo.model !== 'string') return json(res, 200, { code: 422, msg: 'model is required', data: null });
      if (!cuerpo.input || typeof cuerpo.input !== 'object') return json(res, 200, { code: 422, msg: 'input is required', data: null });
      const invalido = validarCuerpo(String(cuerpo.model), cuerpo.input);
      if (invalido) {
        stats.cuerposInvalidos++;
        registrar(`  !  createTask rechazado (422): ${cuerpo.model}: ${invalido}`);
        return json(res, 200, { code: 422, msg: invalido, data: null });
      }
      if (!alcanza(creditosDe(String(cuerpo.model), cuerpo.input, esVideo(String(cuerpo.model)) ? duracionPedida(cuerpo.input) : null), ahora)) {
        stats.sinSaldo++;
        registrar(`  !  createTask rechazado: sin saldo (${cuentaDeSaldo(ahora).restante} creditos)`);
        return json(res, 200, { ...SIN_SALDO, data: null });
      }
      ventana.push(ahora);
      const t = crear(cuerpo);
      return json(res, 200, { code: 200, msg: 'success', data: { taskId: t.taskId } });
    }
    if (req.method === 'GET' && ruta === RUTAS.consultarTarea) return consultar(u.searchParams.get('taskId') || '', res);
    if (req.method === 'GET' && ruta === RUTAS.creditos) return json(res, 200, { code: 200, msg: 'success', data: cuentaDeSaldo().restante });
    if (req.method === 'POST' && ruta === RUTAS.sunoGenerar) {
      stats.creaciones.intentos++;
      const ahora = Date.now();
      ventana = ventana.filter((x) => x > ahora - lim.ventanaMs);
      if (ventana.length >= lim.maximo) {
        stats.creaciones.devueltas429++;
        return json(res, 429, { code: 429, msg: `Too many requests: el simulado admite ${lim.maximo} pedidos cada ${lim.ventanaMs / 1000} s`, data: null });
      }
      let cuerpo;
      try {
        cuerpo = JSON.parse(await leerCuerpo(req));
      } catch {
        return json(res, 400, { code: 400, msg: 'cuerpo que no es JSON', data: null });
      }
      const error = validarSuno(cuerpo);
      if (error) {
        stats.suno.rechazadas++;
        return json(res, 200, { code: 422, msg: error, data: null });
      }
      if (!alcanza(SUNO.creditos, ahora)) {
        stats.sinSaldo++;
        return json(res, 200, { ...SIN_SALDO, data: null });
      }
      ventana.push(ahora);
      const t = crearSuno(cuerpo);
      return json(res, 200, { code: 200, msg: 'success', data: { taskId: t.taskId } });
    }
    if (req.method === 'GET' && ruta === RUTAS.sunoConsultar) return consultarSuno(u.searchParams.get('taskId') || '', res);
    if (req.method === 'POST' && ruta === RUTAS.sunoLetra) {
      let cuerpo;
      try {
        cuerpo = JSON.parse(await leerCuerpo(req));
      } catch {
        return json(res, 400, { code: 400, msg: 'cuerpo que no es JSON', data: null });
      }
      return letraSuno(cuerpo, res);
    }
    if (req.method === 'POST' && ruta === RUTAS.subirBase64) {
      let cuerpo;
      try {
        cuerpo = JSON.parse(await leerCuerpo(req));
      } catch {
        return json(res, 400, { success: false, code: 400, msg: 'cuerpo que no es JSON', data: null });
      }
      return subir(cuerpo, res);
    }

    // Algo que el motor pide y el simulado no imita: se
    // anota para que se vea en las estadisticas, en vez de inventar una respuesta.
    const k = `${req.method} ${ruta}`;
    stats.rutasDesconocidas[k] = (stats.rutasDesconocidas[k] || 0) + 1;
    return json(res, 404, { code: 404, msg: `kie simulado: ${k} no esta imitado`, data: null });
  }

  function resumenStats() {
    const ahora = Date.now();
    const s = structuredClone(stats);
    s.escala = escala;
    s.semilla = semilla;
    s.fallos = { ...opcFallos, texto: describirFallos(opcFallos) };
    s.limite = lim;
    s.saldo = cuentaDeSaldo(ahora);
    s.recuperadas = recuperadas;
    s.enMarchaAhora = enMarcha(ahora);
    s.consultas.demoraEnterarseMediaMs = s.consultas.enteradas ? Math.round(s.consultas.demoraEnterarseTotalMs / s.consultas.enteradas) : null;
    s.creaciones.maxEnVentana = maxEnVentanaDesde(stats.desde);
    return s;
  }

  // El maximo real de creaciones en cualquier ventana de 10 s, recorriendo
  // todas las tareas creadas desde el ultimo reinicio de las estadisticas.
  function maxEnVentanaDesde(desdeIso) {
    const desde = Date.parse(desdeIso);
    const instantes = [...tareas.values()].map((t) => t.creado).filter((x) => x >= desde).sort((a, b) => a - b);
    let max = 0;
    for (let i = 0, j = 0; j < instantes.length; j++) {
      while (instantes[j] - instantes[i] >= lim.ventanaMs) i++;
      max = Math.max(max, j - i + 1);
    }
    return max;
  }

  function listaTareas() {
    const ahora = Date.now();
    return [...tareas.values()].map((t) => ({
      numero: t.numero,
      taskId: t.taskId,
      modelo: t.modelo,
      estado: estadoDe(t, ahora),
      destino: t.destino,
      intento: t.intento,
      creadoMs: t.creado,
      latenciaMs: t.destino === 'trabada' ? null : t.latenciaMs,
      segundos: t.segundos,
      prompt: t.prompt.slice(0, 80),
      tipo: t.musica ? (t.tipo === 'suno' ? 'suno' : 'suno-extend') : t.video ? 'video' : 'imagen',
    }));
  }

  function reiniciarStats() {
    stats = statsVacias();
  }

  /** Deja el saldo restante en `creditos` (lo ya gastado no se devuelve). */
  function fijarSaldo(creditos) {
    saldoInicial = Number(creditos) + cuentaDeSaldo().gastado;
    anotar({ que: 'saldo', saldoInicial });
    return cuentaDeSaldo();
  }

  const servidor = http.createServer((req, res) => {
    atender(req, res).catch((e) => {
      if (!res.headersSent) json(res, 500, { code: 500, msg: `kie simulado: ${e.message}`, data: null });
      else res.destroy();
    });
  });
  // Muchas conexiones a la vez (el motor consulta decenas de tareas): sin tope bajo.
  servidor.keepAliveTimeout = 5000;

  await new Promise((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(puerto, host, resolve);
  });
  const puertoReal = servidor.address().port;
  base = `http://${host}:${puertoReal}`;
  // Lo que entregaron las tareas recuperadas tambien es conocido (con la direccion de ahora).
  for (const t of tareas.values()) {
    urlsConocidas.add(`${base}/archivos/resultados/${t.taskId}.${t.ext}`);
    for (const p of t.pistas || []) urlsConocidas.add(urlDePista(p.id));
  }

  return {
    url: base,
    puerto: puertoReal,
    stats: resumenStats,
    tareas: listaTareas,
    reiniciarStats,
    saldo: () => cuentaDeSaldo(),
    fijarSaldo,
    /**
     * Genera de antemano los PNG y MP4 base (quedan en dirCache para las
     * proximas corridas), asi la primera descarga de una medicion no carga
     * con el tiempo de ffmpeg.
     */
    async precalentar({ aspectos = ['9:16'], duraciones = [] } = {}) {
      for (const a of aspectos) {
        const [w, h] = tamanoImagen(a);
        await cache.imagen(w, h, false);
      }
      await cache.imagen(1024, 1024, false);
      await cache.imagen(1024, 1024, true);
      for (const a of aspectos) {
        const [w, h] = tamanoVideo(a);
        for (const d of duraciones) await cache.video(w, h, d);
      }
    },
    cerrar: () =>
      new Promise((resolve) => {
        servidor.close(() => resolve());
        servidor.closeAllConnections?.();
      }),
  };
}

// ---------------------------------------------------------------- resumen legible

const seg = (ms) => (ms === null || ms === undefined ? '-' : `${(ms / 1000).toFixed(1)} s`);
const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;

/** Las estadisticas en lineas, con la sangria del motor. Lo usa tambien probar-velocidad.js. */
export function lineasDeStats(s) {
  const L = [];
  const c = s.creaciones;
  L.push(`      createTask aceptados       ${c.aceptadas}   (intentos ${c.intentos}, 429 devueltos ${c.devueltas429})`);
  L.push(`      maximo en ${s.limite.ventanaMs / 1000} s             ${c.maxEnVentana}   (kie admite ${s.limite.maximo})`);
  L.push(`      maximo en marcha a la vez  ${s.maxEnMarcha}`);
  const d = s.destinos;
  L.push(`      exito / fallo 500 / contenido / trabadas   ${d.exito} / ${d.falloServidor} / ${d.falloContenido} / ${d.trabadas}`);
  const q = s.consultas;
  L.push(
    `      consultas                  ${q.total}   (HTTP 500 devueltos ${q.devueltas500}; hueco entre consultas ` +
      `${q.minHuecoMs === null ? '-' : seg(q.minHuecoMs)} a ${seg(q.maxHuecoMs)})`
  );
  L.push(`      demora en enterarse        media ${seg(q.demoraEnterarseMediaMs)}, maxima ${seg(q.demoraEnterarseMaxMs)}`);
  L.push(`      subidas ${s.subidas.total} (${mb(s.subidas.bytes)})   descargas ${s.descargas.total} (${mb(s.descargas.bytes)})`);
  if (Object.keys(c.porModelo).length) {
    L.push(`      por modelo                 ${Object.entries(c.porModelo).map(([m, n]) => `${m} ${n}`).join(', ')}`);
  }
  L.push(`      posibles duplicados        ${s.posiblesDuplicados.length}`);
  for (const p of s.posiblesDuplicados.slice(0, 10)) L.push(`        ${p.taskId} igual a ${p.anterior} (${p.motivo}): ${p.modelo} "${p.prompt.slice(0, 60)}..."`);
  if (s.urlsDesconocidas.total) L.push(`      URLs de entrada que el simulado no entrego   ${s.urlsDesconocidas.total} (por ejemplo ${s.urlsDesconocidas.ejemplos[0]})`);
  const rutas = Object.entries(s.rutasDesconocidas);
  if (rutas.length) L.push(`      rutas que el simulado no imita   ${rutas.map(([r, n]) => `${r} x${n}`).join(', ')}`);
  if (s.sinClave) L.push(`      pedidos sin clave (401)    ${s.sinClave}`);
  if (s.cuerposInvalidos) L.push(`      cuerpos rechazados (422)   ${s.cuerposInvalidos}`);
  if (s.descargas.antesDeTiempo) L.push(`      descargas antes de terminar  ${s.descargas.antesDeTiempo}`);
  if (s.enMarchaAhora) L.push(`      siguen en marcha ahora     ${s.enMarchaAhora}`);
  if (s.saldo) L.push(`      creditos cobrados          ${s.saldo.gastado}   (quedan ${s.saldo.restante}${s.sinSaldo ? `; ${s.sinSaldo} pedido(s) rechazados sin saldo` : ''})`);
  const su = s.suno;
  if (su && (su.generaciones || su.extensiones || su.consultas)) {
    L.push(`      Suno                       ${su.generaciones} generacion(es), ${su.extensiones} extend, ${su.consultas} consultas, ${su.letras} pedidos de letra con tiempos${su.rechazadas ? `, ${su.rechazadas} rechazadas por validacion` : ''}`);
  }
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
    console.log('\n  Uso: node produccion/pruebas/kie-simulado.js [--puerto 8787] [--escala 0.05] [--semilla 1]');
    console.log('                                               [--fallos servidor=10,contenido=5,trabadas=1,consulta500=5]');
    console.log('                                               [--limite 20] [--saldo 300] [--callado]\n');
    return;
  }
  const puerto = Number(valorDe(args, '--puerto', 8787));
  const escala = Number(valorDe(args, '--escala', 0.05));
  const semilla = Number(valorDe(args, '--semilla', 1));
  const fallos = parsearFallos(valorDe(args, '--fallos', ''));
  const maximo = Number(valorDe(args, '--limite', LIMITE_KIE.maximo));
  const saldo = Number(valorDe(args, '--saldo', SALDO_POR_DEFECTO));
  const callado = args.includes('--callado');

  const sim = await iniciar({
    puerto,
    escala,
    semilla,
    fallos,
    limite: { maximo },
    saldo,
    alRegistrar: callado ? null : (l) => console.log(l),
  });

  console.log(`\n=== kie.ai SIMULADO — ${sim.url} ===\n`);
  console.log(`  Escala ${escala} (las latencias reales x ${escala}), semilla ${semilla}, fallos: ${describirFallos(fallos)}`);
  console.log(`  Limite: ${maximo} createTask cada ${LIMITE_KIE.ventanaMs / 1000} s (429 si se pasa). Saldo: ${saldo} creditos (402 si no alcanza)`);
  console.log('  Suno: /api/v1/generate, record-info, get-timestamped-lyrics y el extend por createTask\n');
  console.log('  Para apuntar el motor aqui, en OTRA ventana de PowerShell:');
  console.log(`      $env:KIE_BASE_URL = "${sim.url}"`);
  console.log(`      $env:KIE_BASE_ARCHIVOS_URL = "${sim.url}"`);
  console.log('      $env:KIE_API_KEY = "simulada"');
  console.log('  (o, mas facil y con todos los controles: node produccion/pruebas/probar-velocidad.js <anuncio>)\n');
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

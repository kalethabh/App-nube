// CAMBIAR EL PRODUCTO de un video que ya existe: el video queda tal cual (tomas, tiempos, música, personas) y solo
// cambian (1) las escenas donde sale el otro producto, que se rehacen con el tuyo, (2) la voz, traducida con la
// MISMA voz del original y diciendo tu producto, y (3) los subtítulos: se borran los del original y van los nuevos
// en español. Es el modo «Cambiar el producto» de la clonación (skill anuncios-clonacion).
//
//   node produccion/cambiar-producto.js analizar temp/<slug>            tomas, transcripción y textos (centavos)
//   node produccion/cambiar-producto.js plan     temp/<slug>            el costo, sin gastar nada
//   node produccion/cambiar-producto.js producir temp/<slug> --si       lo hace todo (cobra: escenas y voz)
//
// La carpeta lleva:
//   original.mp4            el video que se cambia (subido o bajado de un link)
//   producto.png            la foto de tu producto
//   cambio.json             qué se cambia (lo escribe Claude mirando analisis/ y lo revisa el usuario):
//     {
//       "producto": "Aguaje Complex",
//       "idioma_destino": "es",                  // la voz nueva
//       "subtitulos": "es",                      // los subtítulos nuevos
//       "borrar_subtitulos": true,               // si el original trae texto quemado
//       "escenas": [ { "toma": 3, "desde": 2.2, "hasta": 5.7,
//                      "prompt_imagen": "en inglés: qué cambiar en el cuadro (el frasco del otro por el de la foto)…",
//                      "prompt_video": "en inglés: el mismo movimiento de la toma original…" } ],
//       "voz": [ { "desde": 0.0, "hasta": 1.27, "texto": "¿Qué le pasa a un hombre si toma…" } ]
//     }
// Deja output/<slug>_cambiado.mp4 (y _sin-subtitulos.mp4). Retoma: lo que ya está hecho no se vuelve a pagar.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RAIZ, DIR_OUTPUT, cargarEnv, creditosClip, PRECIOS, MODELOS, creditosAUsd } from './config.js';
import { generarImagen, generarVideo, subirArchivo } from './kie-client.js';
import { ELEVENLABS } from './elevenlabs-client.js';
import { borrarSubtitulos, entornoListo } from './borrar-subtitulos.js';

const MODELO_IMAGEN = 'nano-banana-2';
const RES_IMAGEN = '2K';
const MODELO_VIDEO = MODELOS.video.principal;
const MODELO_VOZ = 'eleven_multilingual_v2';
const CREDITOS_ELEVEN_AISLAR_POR_MIN = 1000; // aislar la voz: ~1000 caracteres por minuto de audio (ElevenLabs)

const leerJSON = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const existe = (f) => fs.existsSync(f);
const decir = (t) => console.log(`  ${t}`);

function ffmpeg(args, que) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`ffmpeg (${que}): ${(r.stderr || '').slice(-400)}`);
}
function duracionDe(f) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' });
  return Number(r.stdout.trim()) || 0;
}
/** Un video que se puede abrir y dura algo (uno cortado a la mitad no tiene duración). */
const videoCompleto = (f, minimo = 0.3) => existe(f) && duracionDe(f) >= minimo;
function medidasDe(f) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'json', f], { encoding: 'utf8' });
  const s = JSON.parse(r.stdout).streams[0];
  const [a, b] = String(s.r_frame_rate).split('/').map(Number);
  return { w: s.width, h: s.height, fps: b ? a / b : a || 30 };
}

function carpetaDe(arg) {
  const c = path.resolve(RAIZ, arg || '');
  if (!arg || !existe(c)) throw new Error('Uso: node produccion/cambiar-producto.js <analizar|plan|producir> temp/<slug> [--si]');
  return c;
}
function originalDe(c) {
  const f = fs.readdirSync(c).find((x) => /^original\.(mp4|mov|m4v|webm)$/i.test(x));
  if (!f) throw new Error(`Falta el video: ${path.join(c, 'original.mp4')}`);
  return path.join(c, f);
}
function cambioDe(c) {
  const f = path.join(c, 'cambio.json');
  if (!existe(f)) throw new Error('Falta cambio.json (qué escenas y qué voz se cambian).');
  const m = leerJSON(f);
  const errores = [];
  if (!Array.isArray(m.escenas)) errores.push('"escenas" tiene que ser una lista (puede ir vacía).');
  if (!Array.isArray(m.voz)) errores.push('"voz" tiene que ser una lista de { desde, hasta, texto }.');
  for (const [i, e] of (m.escenas || []).entries()) {
    if (!(Number(e.hasta) > Number(e.desde))) errores.push(`escena ${i + 1}: "hasta" tiene que ser mayor que "desde".`);
    if (!String(e.prompt_imagen || '').trim()) errores.push(`escena ${i + 1}: falta "prompt_imagen".`);
    if (!String(e.prompt_video || '').trim()) errores.push(`escena ${i + 1}: falta "prompt_video".`);
  }
  for (const [i, v] of (m.voz || []).entries()) {
    if (!(Number(v.hasta) > Number(v.desde)) || !String(v.texto || '').trim()) errores.push(`voz ${i + 1}: falta "texto" o los tiempos están al revés.`);
  }
  if (m.escenas?.length && !existe(path.join(c, 'producto.png')) && !existe(path.join(c, 'producto.jpg'))) errores.push('Falta la foto de tu producto (producto.png).');
  if (errores.length) throw new Error(`cambio.json tiene errores:\n  - ${errores.join('\n  - ')}`);
  return m;
}
const fotoProducto = (c) => [path.join(c, 'producto.png'), path.join(c, 'producto.jpg')].find(existe);

// ---------------------------------------------------------------- analizar

function analizar(c) {
  const original = originalDe(c);
  const script = path.join(RAIZ, '.claude', 'skills', 'anuncios-clonacion', 'scripts', 'analizar-referencia.mjs');
  decir('Analizando el video: tomas, fotogramas y lo que se dice...');
  const r = spawnSync(process.execPath, [script, original, path.join(c, 'analisis')], { stdio: 'inherit', cwd: RAIZ });
  if (r.status !== 0) throw new Error('No pude analizar el video.');
  decir(`Listo: ${path.join(c, 'analisis')} (hoja-tomas.jpg, adn-base.json, transcripcion.json).`);
}

// ---------------------------------------------------------------- el costo

export function plan(c) {
  const m = cambioDe(c);
  const original = originalDe(c);
  const dur = duracionDe(original);
  const escenas = m.escenas.map((e, i) => {
    const seg = Number(e.hasta) - Number(e.desde);
    const clip = creditosClip(MODELO_VIDEO, Math.max(seg, 4));
    return { i: i + 1, seg, imagen: PRECIOS.imagen[MODELO_IMAGEN][RES_IMAGEN], video: clip.creditos, duracion: clip.duracion };
  });
  const kie = escenas.reduce((s, e) => s + e.imagen + (e.video || 0), 0);
  const caracteres = m.voz.reduce((s, v) => s + String(v.texto).length, 0);
  const aislar = Math.ceil((dur / 60) * CREDITOS_ELEVEN_AISLAR_POR_MIN);
  return { escenas, kie, kieUsd: creditosAUsd(kie), caracteres, aislar, duracion: dur };
}

function mostrarPlan(c) {
  const p = plan(c);
  console.log('\n  CAMBIAR EL PRODUCTO · lo que cuesta (no se gastó nada)\n');
  for (const e of p.escenas) decir(`Escena ${e.i}: ${e.seg.toFixed(1)} s → imagen ${e.imagen} cr + clip de ${e.duracion} s ${e.video} cr`);
  decir(`kie.ai: ${p.kie} créditos = US$${p.kieUsd.toFixed(2)}`);
  decir(`ElevenLabs: ~${p.caracteres + p.aislar} caracteres de tu plan (voz nueva ${p.caracteres} + aislar la voz original ~${p.aislar})`);
  decir('Borrar subtítulos: gratis, en este computador.\n');
  return p;
}

// ---------------------------------------------------------------- ElevenLabs: aislar, clonar y hablar

const claveEleven = () => {
  const k = (process.env.ELEVENLABS_API_KEY || '').trim();
  if (!k) throw new Error('Falta ELEVENLABS_API_KEY en el .env.');
  return k;
};
async function eleven(ruta, opciones) {
  const r = await fetch(ELEVENLABS.base + ruta, { ...opciones, headers: { 'xi-api-key': claveEleven(), ...(opciones?.headers || {}) } });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status} en ${ruta}: ${(await r.text()).slice(0, 300)}`);
  return r;
}
const archivoForm = (f, tipo = 'audio/mpeg') => new Blob([fs.readFileSync(f)], { type: tipo });

async function aislarVoz(audio, destino) {
  if (existe(destino)) return destino;
  const fd = new FormData();
  fd.append('audio', archivoForm(audio), path.basename(audio));
  const r = await eleven('/v1/audio-isolation', { method: 'POST', body: fd });
  fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
  return destino;
}

async function clonarVoz(muestra, nombre, estado, guardar) {
  if (estado.voz_clonada) return estado.voz_clonada;
  const fd = new FormData();
  fd.append('name', nombre.slice(0, 60));
  fd.append('description', 'Voz clonada para «Cambiar el producto» (Kads Studio). Se borra al terminar.');
  fd.append('files', archivoForm(muestra), path.basename(muestra));
  const r = await eleven('/v1/voices/add', { method: 'POST', body: fd });
  const { voice_id } = await r.json();
  estado.voz_clonada = voice_id;
  guardar();
  return voice_id;
}

async function hablar(vozId, texto, destino) {
  if (existe(destino)) return destino;
  const r = await eleven(`/v1/text-to-speech/${encodeURIComponent(vozId)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: texto, model_id: MODELO_VOZ, voice_settings: { stability: 0.5, similarity_boost: 0.85, style: 0.2, use_speaker_boost: true } }),
  });
  fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
  return destino;
}

// ---------------------------------------------------------------- el fondo (música y efectos sin la voz)

/** La música y los efectos del original, sin la voz (Demucs, en el entorno del borrador). null si no se puede. */
function separarFondo(audio, carpeta) {
  const destino = path.join(carpeta, 'fondo.wav');
  if (existe(destino)) return destino;
  const py = process.platform === 'win32' ? path.join(RAIZ, '.venv-limpio', 'Scripts', 'python.exe') : path.join(RAIZ, '.venv-limpio', 'bin', 'python');
  if (!existe(py)) return null;
  const sal = path.join(carpeta, 'demucs');
  const r = spawnSync(py, ['-m', 'demucs', '--two-stems=vocals', '-n', 'htdemucs', '-o', sal, audio], { stdio: 'inherit' });
  if (r.status !== 0) return null;
  const f = path.join(sal, 'htdemucs', path.basename(audio).replace(/\.[^.]+$/, ''), 'no_vocals.wav');
  if (!existe(f)) return null;
  fs.copyFileSync(f, destino);
  return destino;
}

// ---------------------------------------------------------------- subtítulos (ASS, quemados con ffmpeg)

function tiempoAss(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = (s % 60).toFixed(2).padStart(5, '0');
  return `${h}:${String(m).padStart(2, '0')}:${seg}`;
}
/** Los subtítulos en tarjetas de 1 a 3 palabras, repartidas en el tiempo de cada frase (como los del original). */
function escribirAss(voz, { w, h }, destino, centroY = 0.7) {
  const tam = Math.round(h * 0.052);
  const lineas = [];
  for (const v of voz) {
    const palabras = String(v.texto).trim().split(/\s+/);
    // tarjetas cortas (hasta 14 letras o 3 palabras): una sola línea, como los subtítulos de los anuncios
    const grupos = [];
    for (const pal of palabras) {
      const ult = grupos[grupos.length - 1];
      if (ult && ult.split(' ').length < 3 && (ult + ' ' + pal).length <= 14) grupos[grupos.length - 1] = `${ult} ${pal}`;
      else grupos.push(pal);
    }
    const ini = Number(v.inicio_real ?? v.desde);
    const fin = Number(v.fin_real ?? v.hasta);
    const paso = (fin - ini) / Math.max(1, grupos.length);
    grupos.forEach((g, k) => {
      const t = g.toUpperCase().replace(/[{}]/g, '');
      lineas.push(`Dialogue: 0,${tiempoAss(ini + k * paso)},${tiempoAss(ini + (k + 1) * paso)},Kads,,0,0,0,,${t}`);
    });
  }
  const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Kads,Arial Black,${tam},&H00FFFFFF,&H000000FF,&H00101010,&H64000000,1,0,0,0,100,100,0,0,1,${Math.max(3, Math.round(tam * 0.09))},2,2,40,40,${Math.round(h * (1 - centroY) - tam / 2)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${lineas.join('\n')}
`;
  fs.writeFileSync(destino, ass, 'utf8');
  return destino;
}

// ---------------------------------------------------------------- producir

async function producir(c, { si }) {
  cargarEnv();
  const m = cambioDe(c);
  const p = mostrarPlan(c);
  if (!si) {
    decir('Para hacerlo, vuelve a correr con --si (cobra lo de arriba).');
    return;
  }
  const slug = path.basename(c);
  const trabajo = path.join(c, 'trabajo');
  fs.mkdirSync(trabajo, { recursive: true });
  const fEstado = path.join(trabajo, 'estado.json');
  const estado = existe(fEstado) ? leerJSON(fEstado) : {};
  const guardar = () => fs.writeFileSync(fEstado, JSON.stringify(estado, null, 2));
  const original = originalDe(c);
  const med = medidasDe(original);

  // 1. el video sin subtítulos (gratis, en este computador)
  let base = original;
  if (m.borrar_subtitulos !== false) {
    const limpio = path.join(trabajo, 'limpio.mp4');
    // uno de una vez anterior que quedó cortado (p. ej. se apagó la Mac): se rehace
    if (existe(limpio) && !videoCompleto(limpio, duracionDe(original) * 0.9)) fs.rmSync(limpio, { force: true });
    if (!existe(limpio)) {
      if (!entornoListo()) throw new Error('Para borrar los subtítulos falta: npm run subtitulos:instalar (o pon "borrar_subtitulos": false).');
      decir('1/5 Borrando los subtítulos del original...');
      // a un archivo aparte y se renombra al final: si se corta a la mitad, no queda un limpio.mp4 incompleto
      const parcial = path.join(trabajo, 'limpio-parcial.mp4');
      // los textos ya encontrados en una vez anterior no se vuelven a buscar
      const textoPrevio = limpio.replace(/\.mp4$/, '.texto.json');
      if (existe(textoPrevio)) fs.copyFileSync(textoPrevio, parcial.replace(/\.mp4$/, '.texto.json'));
      borrarSubtitulos(original, parcial, { rapido: m.borrado === 'rapido' });
      fs.renameSync(parcial, limpio);
      if (existe(parcial.replace(/\.mp4$/, '.texto.json'))) fs.renameSync(parcial.replace(/\.mp4$/, '.texto.json'), limpio.replace(/\.mp4$/, '.texto.json'));
    }
    base = limpio;
  }

  // 2. las escenas con tu producto (kie.ai)
  const foto = fotoProducto(c);
  const urlFoto = m.escenas.length ? await subirArchivo(foto) : null;
  // de a 4 a la vez (kie.ai las hace en paralelo): 8 escenas tardan lo que 2
  let listas = m.escenas.filter((_, i) => videoCompleto(path.join(trabajo, `escena-${i + 1}.mp4`))).length;
  if (m.escenas.length) decir(`2/5 Escenas: ${listas} de ${m.escenas.length} listas`);
  const unaEscena = async (e, i) => {
    const n = i + 1;
    const cuadro = path.join(trabajo, `escena-${n}-original.png`);
    const imagen = path.join(trabajo, `escena-${n}.png`);
    const clip = path.join(trabajo, `escena-${n}.mp4`);
    if (videoCompleto(clip)) return;
    decir(`   escena ${n}: ${Number(e.desde).toFixed(1)}–${Number(e.hasta).toFixed(1)} s`);
    if (!existe(cuadro)) ffmpeg(['-ss', String(Number(e.desde) + 0.05), '-i', base, '-frames:v', '1', cuadro], 'cuadro de la escena');
    if (!existe(imagen)) {
      const urlCuadro = await subirArchivo(cuadro);
      const prompt = `${e.prompt_imagen}\n\nEdit the FIRST image only where the other product appears: replace it with the exact product from the SECOND image (same shape, colors, label and proportions). Keep everything else identical: people, hands, background, light, framing and camera angle. No text, no captions, no logos other than the product label.`;
      await generarImagen({ modelo: MODELO_IMAGEN, prompt, imagenesReferencia: [urlCuadro, urlFoto], resolucion: RES_IMAGEN, aspectRatio: med.w >= med.h ? '16:9' : '9:16', rutaDestino: imagen });
    }
    const seg = Number(e.hasta) - Number(e.desde);
    const { duracion, resolucion } = creditosClip(MODELO_VIDEO, Math.max(seg, 4));
    const urlImagen = await subirArchivo(imagen);
    await generarVideo({
      modelo: MODELO_VIDEO,
      prompt: `${e.prompt_video}\nNo one speaks: no dialogue, no voices. No text appears.`,
      frameInicial: urlImagen,
      aspectRatio: med.w >= med.h ? '16:9' : '9:16',
      resolucionApi: resolucion.api,
      duracion,
      rutaDestino: clip,
    });
    listas++;
    decir(`2/5 Escenas: ${listas} de ${m.escenas.length} listas`);
  };
  const cola = [...m.escenas.entries()];
  await Promise.all(Array.from({ length: Math.min(4, cola.length) }, async () => {
    for (let x = cola.shift(); x; x = cola.shift()) await unaEscena(x[1], x[0]);
  }));

  // 3. la voz nueva, con la misma voz del original (ElevenLabs)
  const audioOriginal = path.join(trabajo, 'audio-original.mp3');
  if (!existe(audioOriginal)) ffmpeg(['-i', original, '-vn', '-ac', '1', '-ar', '44100', '-b:a', '128k', audioOriginal], 'audio del original');
  const vozMix = path.join(trabajo, 'voz-nueva.wav');
  if (!existe(vozMix)) {
    decir('3/5 La voz: aislando la del original y clonándola...');
    const aislada = await aislarVoz(audioOriginal, path.join(trabajo, 'voz-original.mp3'));
    const muestra = path.join(trabajo, 'voz-muestra.mp3');
    if (!existe(muestra)) ffmpeg(['-i', aislada, '-t', '120', '-af', 'silenceremove=stop_periods=-1:stop_duration=0.4:stop_threshold=-40dB', muestra], 'muestra de la voz');
    const vozId = await clonarVoz(muestra, `Kads ${slug}`, estado, guardar);
    const entradas = [];
    for (const [i, v] of m.voz.entries()) {
      decir(`   frase ${i + 1}/${m.voz.length}`);
      const f = await hablar(vozId, v.texto, path.join(trabajo, `voz-${i + 1}.mp3`));
      // si la frase nueva es más larga que su lugar, se acelera hasta 1,3x; si aún no entra, ocupa lo que necesita
      const largo = duracionDe(f);
      const hueco = Number(v.hasta) - Number(v.desde);
      const tempo = Math.min(1.3, Math.max(1, largo / hueco));
      v.inicio_real = Number(v.desde);
      v.fin_real = Number(v.desde) + largo / tempo;
      entradas.push({ f, tempo, desde: Number(v.desde) });
    }
    // todas las frases en su lugar
    const args = [];
    const filtros = [];
    entradas.forEach((e, k) => {
      args.push('-i', e.f);
      filtros.push(`[${k}:a]atempo=${e.tempo.toFixed(3)},adelay=${Math.round(e.desde * 1000)}|${Math.round(e.desde * 1000)}[v${k}]`);
    });
    filtros.push(`${entradas.map((_, k) => `[v${k}]`).join('')}amix=inputs=${entradas.length}:normalize=0,apad=whole_dur=${p.duracion.toFixed(2)}[voz]`);
    ffmpeg([...args, '-filter_complex', filtros.join(';'), '-map', '[voz]', '-ac', '2', '-ar', '44100', vozMix], 'voz nueva');
    fs.writeFileSync(path.join(trabajo, 'voz-tiempos.json'), JSON.stringify(m.voz, null, 2));
    // la voz clonada se borra de tu cuenta (los planes tienen un tope de voces)
    try {
      await eleven(`/v1/voices/${encodeURIComponent(vozId)}`, { method: 'DELETE' });
      delete estado.voz_clonada;
      guardar();
    } catch {
      /* si no se pudo borrar, queda en tu cuenta con el nombre "Kads <anuncio>" */
    }
  }
  const vozTiempos = existe(path.join(trabajo, 'voz-tiempos.json')) ? leerJSON(path.join(trabajo, 'voz-tiempos.json')) : m.voz;

  // 4. el fondo: la música y los efectos del original, sin la voz
  decir('4/5 La música del original, sin la voz...');
  const fondo = separarFondo(audioOriginal, trabajo);
  if (!fondo) decir('   (no pude separar la música del original: el video sale solo con la voz nueva; npm run subtitulos:instalar trae el separador)');

  // 5. armar: el original (limpio) con tus escenas, la voz nueva, el fondo y los subtítulos nuevos
  decir('5/5 Armando el video...');
  const piezas = [];
  let t = 0;
  const escenas = m.escenas.map((e, i) => ({ ...e, n: i + 1 })).sort((a, b) => a.desde - b.desde);
  const corte = (desde, hasta, k) => {
    const f = path.join(trabajo, `pieza-${String(k).padStart(2, '0')}.mp4`);
    ffmpeg(['-ss', desde.toFixed(3), '-to', hasta.toFixed(3), '-i', base, '-an', '-vf', `scale=${med.w}:${med.h},fps=${med.fps.toFixed(3)},format=yuv420p`, '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', f], 'pieza del original');
    return f;
  };
  let k = 0;
  for (const e of escenas) {
    if (e.desde > t + 0.04) piezas.push(corte(t, e.desde, k++));
    const f = path.join(trabajo, `pieza-${String(k++).padStart(2, '0')}.mp4`);
    ffmpeg(['-i', path.join(trabajo, `escena-${e.n}.mp4`), '-t', (e.hasta - e.desde).toFixed(3), '-an', '-vf', `scale=${med.w}:${med.h}:force_original_aspect_ratio=increase,crop=${med.w}:${med.h},fps=${med.fps.toFixed(3)},format=yuv420p`, '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', f], 'escena nueva');
    piezas.push(f);
    t = e.hasta;
  }
  if (p.duracion > t + 0.04) piezas.push(corte(t, p.duracion, k++));
  const lista = path.join(trabajo, 'piezas.txt');
  fs.writeFileSync(lista, piezas.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
  const video = path.join(trabajo, 'video.mp4');
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', video], 'unir las piezas');

  const audio = path.join(trabajo, 'audio.wav');
  if (fondo) ffmpeg(['-i', vozMix, '-i', fondo, '-filter_complex', '[1:a]volume=0.9[f];[0:a][f]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[a]', '-map', '[a]', audio], 'mezcla');
  else fs.copyFileSync(vozMix, audio);

  fs.mkdirSync(DIR_OUTPUT, { recursive: true });
  const sinSubs = path.join(DIR_OUTPUT, `${slug}_sin-subtitulos.mp4`);
  ffmpeg(['-i', video, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', sinSubs], 'video sin subtítulos');
  const fin = path.join(DIR_OUTPUT, `${slug}_cambiado.mp4`);
  if (m.subtitulos !== false && m.subtitulos !== 'no') {
    let centroY = 0.7;
    try {
      const tx = leerJSON(path.join(trabajo, 'limpio.texto.json'));
      centroY = tx.captions?.style?.position?.center_y_norm || centroY;
    } catch {
      /* sin análisis de texto: abajo, a un 70 % */
    }
    const ass = escribirAss(vozTiempos, med, path.join(trabajo, 'subtitulos.ass'), centroY);
    ffmpeg(['-i', sinSubs, '-vf', `ass=${ass.replace(/\\/g, '/').replace(/:/g, '\\:')}`, '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-c:a', 'copy', '-movflags', '+faststart', fin], 'subtítulos');
  } else fs.copyFileSync(sinSubs, fin);
  decir(`\n  Listo: ${fin}\n         ${sinSubs}\n`);
}

// ---------------------------------------------------------------- uso directo
const [, script, accion, arg, ...resto] = process.argv;
if (script && path.resolve(script) === fileURLToPath(import.meta.url)) {
  (async () => {
    try {
      const c = carpetaDe(arg);
      if (accion === 'analizar') analizar(c);
      else if (accion === 'plan') mostrarPlan(c);
      else if (accion === 'producir') await producir(c, { si: resto.includes('--si') });
      else throw new Error('Acciones: analizar, plan, producir');
    } catch (e) {
      console.error(`\n  ${e.message}\n`);
      process.exit(1);
    }
  })();
}

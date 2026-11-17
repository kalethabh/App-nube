// TU PROPIO VIDEO EN EL EDITOR (2026-11-14): prepara cualquier video (uno tuyo, uno que bajaste o el que dejó
// «Cambiar el producto») para abrirlo en el editor de la app como si fuera un anuncio. Gratis (ffmpeg en esta PC);
// solo los subtítulos, si se piden, transcriben el audio con ElevenLabs (centavos).
//
//   node produccion/video-propio.js temp/<slug> [--subtitulos] [--idioma spa|eng|por]
//   node produccion/video-propio.js temp/<slug> --transcribir    (después, desde el editor: transcribirVoz)
//
// Lee temp/<slug>/original.<ext> y deja la carpeta como la de un anuncio con voz en off:
//   video/completo.mp4       el video entero, 720x1280 a 30 fps (si no es vertical, va entero sobre su fondo difuminado)
//   video/toma-N.mp4         una toma por escena (donde cambia la imagen), sin audio
//   audio/voz.mp3            el audio del video (lo que se dice, la música y los sonidos): va aparte, como la voz en
//                            off, así se pueden cortar, mover, acelerar o reemplazar escenas sin cortar lo que se dice
//   subtitulos.json          (con --subtitulos) lo que se dice, palabra por palabra
//   plan-montaje.json        las tomas una detrás de otra, el audio y los subtítulos: lo que lee el editor
//   manifiesto.json          estilo "video-propio" (así la app lo lista como anuncio)
//   portada.jpg
//   output/<slug>_original.mp4   el video tal como entró (la versión «Tu video» del anuncio)
//
// Lo que dice mientras trabaja, para la app:  @@avance {"etapa","texto","valor"}  ·  @@listo {...}  ·  @@error {...}
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RAIZ, DIR_OUTPUT, cargarEnv } from './config.js';

export const ANCHO = 720;
export const ALTO = 1280;
export const FPS = 30;
export const MAX_SEGUNDOS = 600; // 10 minutos
const UMBRAL_ESCENA = 0.3; // cuánto tiene que cambiar la imagen para contar como corte (el de anuncios-clonacion)
const TOMA_MINIMA = 0.6; // cortes más seguidos que esto se juntan
const TOMA_MAXIMA = 12; // una escena muy larga se parte, así hay dónde cortar y mover

const avisar = (marca, datos) => process.stdout.write(`@@${marca} ${JSON.stringify(datos)}\n`);
const avance = (etapa, texto, valor) => avisar('avance', { etapa, texto, valor });
const r3 = (x) => Math.round(Number(x) * 1000) / 1000;
const enCuadro = (t) => Math.round(t * FPS) / FPS;

function correr(cmd, args, que) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  if (r.error) throw new Error(`${que}: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${que}: ${(r.stderr || '').split(/\r?\n/).filter(Boolean).slice(-3).join(' ')}`);
  return r;
}
const ffmpeg = (args, que) => correr('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], que);

export function sondear(f) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', f], { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) return null;
  try {
    const d = JSON.parse(r.stdout);
    const v = (d.streams || []).find((s) => s.codec_type === 'video');
    return { duracion: Number(d.format?.duration) || 0, video: Boolean(v), audio: (d.streams || []).some((s) => s.codec_type === 'audio'), w: v?.width || 0, h: v?.height || 0 };
  } catch {
    return null;
  }
}

/** El filtro que lo deja en 720x1280: vertical (9:16 o casi) se llena; si no, entero sobre su propio fondo difuminado. */
export function filtroVertical(w, h) {
  const fin = `setsar=1,fps=${FPS},format=yuv420p`;
  const relacion = w && h ? w / h : ANCHO / ALTO;
  if (Math.abs(relacion - ANCHO / ALTO) / (ANCHO / ALTO) < 0.08) {
    return `scale=${ANCHO}:${ALTO}:force_original_aspect_ratio=increase,crop=${ANCHO}:${ALTO},${fin}`;
  }
  return (
    `split=2[a][b];[a]scale=${ANCHO}:${ALTO}:force_original_aspect_ratio=increase,crop=${ANCHO}:${ALTO},boxblur=24:2,eq=brightness=-0.08[fondo];` +
    `[b]scale=${ANCHO}:${ALTO}:force_original_aspect_ratio=decrease[frente];[fondo][frente]overlay=(W-w)/2:(H-h)/2,${fin}`
  );
}

/** Dónde cambia la imagen: [0, c1, c2, …, duracion] (en cuadros exactos). */
function limitesDeEscenas(video, duracion) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', video, '-filter:v', `select='gt(scene,${UMBRAL_ESCENA})',showinfo`, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  const cortes = [...(r.stderr || '').matchAll(/pts_time:([\d.]+)/g)].map((m) => enCuadro(Number(m[1]))).filter((t) => t > 0.05 && t < duracion - 0.05);
  const limites = [0];
  for (const c of cortes) if (c - limites[limites.length - 1] >= TOMA_MINIMA) limites.push(c);
  if (duracion - limites[limites.length - 1] < TOMA_MINIMA && limites.length > 1) limites.pop();
  limites.push(duracion);
  // las escenas muy largas se parten en partes iguales
  const salida = [0];
  for (let i = 1; i < limites.length; i++) {
    const a = limites[i - 1];
    const b = limites[i];
    const partes = Math.ceil((b - a) / TOMA_MAXIMA);
    for (let k = 1; k < partes; k++) salida.push(enCuadro(a + ((b - a) * k) / partes));
    salida.push(b);
  }
  return salida;
}

export const ESTILO_SUBTITULOS = {
  tamano: 0.06137,
  interlineado: 1.1,
  contornoRespectoTamano: 0.135,
  desdeAbajo: 0.26,
  coloresResaltado: ['#E8442A', '#F5A524', '#2F7DE1', '#159A5B', '#B5279B', '#E01E5A', '#7B3FE4', '#0FA3B1', '#D64500', '#3B7A2A'],
  cajaPadding: 0.12,
  cajaRedondeo: 0.1,
  colorResaltado: '#0FA3B1',
};

async function subtitulosDe(mp3, idioma) {
  cargarEnv();
  const { transcribir } = await import('./subtitulos-dialogo.js');
  const { bloquesDeSubtitulos } = await import('./subtitulos.js');
  const todo = await transcribir(mp3, idioma || null, { eventos: false });
  const palabras = todo.filter((w) => w.type === 'word' && String(w.text || '').trim()).map((w) => ({ texto: String(w.text).trim(), inicio: r3(w.start), fin: r3(w.end) }));
  return palabras.length ? bloquesDeSubtitulos(palabras) : [];
}

export async function preparar(carpeta, { subtitulos = false, idioma = null } = {}) {
  const c = path.resolve(RAIZ, carpeta);
  const slug = path.basename(c);
  const original = fs.readdirSync(c).find((f) => /^original\.[a-z0-9]{2,5}$/i.test(f));
  if (!original) throw new Error('Falta el video (original.mp4).');
  const entrada = path.join(c, original);
  const info = sondear(entrada);
  if (!info?.video || !(info.duracion > 0.3)) throw new Error('Ese archivo no es un video que se pueda abrir.');
  fs.mkdirSync(path.join(c, 'video'), { recursive: true });
  fs.mkdirSync(path.join(c, 'audio'), { recursive: true });

  // 1. el video entero, vertical
  avance('preparar', 'Dejando tu video vertical', 5);
  const completo = path.join(c, 'video', 'completo.mp4');
  const t = Math.min(info.duracion, MAX_SEGUNDOS);
  ffmpeg(
    ['-i', entrada, '-t', String(t), '-filter_complex', `[0:v:0]${filtroVertical(info.w, info.h)}[v]`, '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', completo],
    'preparar el video'
  );
  const duracion = r3(enCuadro(Math.min(sondear(completo)?.duracion || t, t)));

  // 2. el audio, aparte (silencio si no tiene)
  avance('audio', 'Separando el audio', 35);
  const voz = path.join(c, 'audio', 'voz.mp3');
  if (info.audio) ffmpeg(['-i', entrada, '-t', String(duracion), '-vn', '-ac', '2', '-ar', '44100', '-b:a', '192k', voz], 'separar el audio');
  else ffmpeg(['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', String(duracion), '-b:a', '64k', voz], 'audio en silencio');
  fs.copyFileSync(voz, path.join(c, 'audio', 'voz-original.mp3')); // de aquí salen los cortes (quitarTramo)

  // 3. las escenas
  avance('escenas', 'Buscando las escenas', 45);
  const limites = limitesDeEscenas(completo, duracion);
  const bloques = [];
  for (let i = 0; i < limites.length - 1; i++) {
    const desde = limites[i];
    const hasta = limites[i + 1];
    const n = i + 1;
    const archivo = `toma-${n}.mp4`;
    avance('escenas', `Cortando la escena ${n} de ${limites.length - 1}`, 45 + Math.round((35 * i) / (limites.length - 1)));
    // (un poco más largo que su lugar: el editor puede alargarla o deslizarla un poco)
    ffmpeg(['-ss', String(desde), '-i', completo, '-t', String(Math.min(duracion - desde, hasta - desde + 0.5)), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', path.join(c, 'video', archivo)], `cortar la escena ${n}`);
    const largo = r3(sondear(path.join(c, 'video', archivo))?.duracion || hasta - desde);
    bloques.push({
      linea: n,
      texto: '',
      inicio: r3(desde),
      fin: r3(hasta),
      ventana: r3(hasta - desde),
      tipo: 'B',
      toma: { archivo, largoOriginal: largo, duracion: r3(hasta - desde), desde: r3(desde), metodo: 'sin-ajuste', velocidad: 1, recorte: 0, recorteInicio: 0, recorteFin: 0 },
    });
  }

  // 4. subtítulos (si se pidieron)
  let subs = [];
  let aviso = null;
  if (subtitulos && info.audio) {
    avance('subtitulos', 'Escribiendo los subtítulos de lo que se dice', 82);
    try {
      subs = await subtitulosDe(voz, idioma);
      if (!subs.length) aviso = 'No encontré palabras en el audio: va sin subtítulos.';
    } catch (e) {
      aviso = `No pude hacer los subtítulos (${String(e.message || e).slice(0, 160)}). Va sin subtítulos.`;
    }
    for (const b of bloques) {
      b.texto = subs.flatMap((s) => s.palabras || []).filter((p) => (p.inicio + p.fin) / 2 >= b.inicio && (p.inicio + p.fin) / 2 < b.fin).map((p) => p.texto).join(' ');
    }
  }

  // 5. el plan, el manifiesto y la portada
  avance('guardar', 'Abriendo en el editor', 94);
  const plan = {
    generado: new Date().toISOString(),
    aprobado: true,
    videoPropio: true,
    duracion,
    audio: { voz: 'audio/voz.mp3', ducking: 0, fadeMs: 80 },
    fuente: [{ desde: 0, hasta: duracion }], // qué partes del original quedan, en orden (quitarTramo las recorta)
    musica: null,
    bloques,
    subtitulos: subs,
    estiloSubtitulos: ESTILO_SUBTITULOS,
    transiciones: [],
    brollFuera: [],
    avisos: aviso ? [aviso] : [],
  };
  fs.writeFileSync(path.join(c, 'plan-montaje.json'), JSON.stringify(plan, null, 2));
  if (subs.length) fs.writeFileSync(path.join(c, 'subtitulos.json'), JSON.stringify(subs, null, 2));
  const previo = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(c, 'manifiesto.json'), 'utf8'));
    } catch {
      return {};
    }
  })();
  const pedido = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(c, 'app', 'video-propio.json'), 'utf8'));
    } catch {
      return {};
    }
  })();
  const titulo = String(pedido.nombre || '').replace(/\.[^.]+$/, '').replace(/_(cambiado|sin-subtitulos)$/i, '').replace(/[_-]+/g, ' ').trim();
  const manifiesto = {
    ...previo,
    ...(titulo && !previo.titulo ? { titulo: titulo.charAt(0).toUpperCase() + titulo.slice(1) } : {}),
    estilo: 'video-propio',
    modo_audio: 'voz_en_off',
    idioma: previo.idioma || 'es',
    aspect_ratio: '9:16',
    video_propio: { ...(previo.video_propio || {}), archivo: original, duracion, escenas: bloques.length, subtitulos: subs.length > 0 },
    tomas: bloques.map((b) => ({ n: b.linea, duracion: b.ventana })),
  };
  fs.writeFileSync(path.join(c, 'manifiesto.json'), JSON.stringify(manifiesto, null, 2));
  ffmpeg(['-ss', String(Math.min(0.5, duracion / 2)), '-i', completo, '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', path.join(c, 'portada.jpg')], 'la portada');

  // 6. «Tu video» en output/: el original vertical con su audio
  fs.mkdirSync(DIR_OUTPUT, { recursive: true });
  const salida = path.join(DIR_OUTPUT, `${slug}_original.mp4`);
  ffmpeg(['-i', completo, '-i', voz, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', salida], 'guardar tu video');

  const listo = { slug, duracion, escenas: bloques.length, subtitulos: subs.length, aviso };
  avisar('listo', listo);
  return listo;
}

// ---------------------------------------------------------------- quitar un tramo (el video queda más corto)

/** Un segundo del video de antes en el de ahora, si se quita [a, b]. */
const correrT = (t, a, b) => (t <= a ? t : t >= b ? t - (b - a) : a);

/**
 * Quita del video los segundos [a, b] (del video como está ahora): la imagen y el audio. Lo que sigue se corre hacia
 * adelante y el video queda más corto. Rehace solo el audio (audio/voz-<n>.mp3, a partir de voz-original.mp3) y el
 * plan: las escenas, los subtítulos y la duración. Las tomas no se tocan (una escena cortada por la mitad usa la misma
 * toma con otra entrada).
 *   -> { plan, mapa }   mapa: índice de cada bloque de subtítulos de antes -> el de ahora (o null si se fue)
 */
export function quitarTramo(carpeta, desde, hasta) {
  const c = path.resolve(RAIZ, carpeta);
  const archivoPlan = path.join(c, 'plan-montaje.json');
  const plan = JSON.parse(fs.readFileSync(archivoPlan, 'utf8'));
  if (!plan.videoPropio) throw new Error('Solo se pueden quitar partes de tus propios videos.');
  const dur = Number(plan.duracion) || 0;
  const a = r3(enCuadro(Math.max(0, Math.min(dur, Number(desde)))));
  const b = r3(enCuadro(Math.max(0, Math.min(dur, Number(hasta)))));
  if (!(b - a >= 1 / FPS)) throw new Error('Esa parte es demasiado corta para quitarla.');
  if (dur - (b - a) < 0.5) throw new Error('No puedes quitar todo el video.');
  const d = b - a;

  // 1. qué partes del original quedan
  const fuente = Array.isArray(plan.fuente) && plan.fuente.length ? plan.fuente : [{ desde: 0, hasta: dur }];
  const nueva = [];
  let t = 0;
  for (const f of fuente) {
    const largo = f.hasta - f.desde;
    const i = t;
    const z = t + largo;
    t = z;
    if (z <= a || i >= b) {
      nueva.push(f);
      continue;
    }
    if (i < a) nueva.push({ desde: f.desde, hasta: r3(f.desde + (a - i)) });
    if (z > b) nueva.push({ desde: r3(f.desde + (b - i)), hasta: f.hasta });
  }

  // 2. el audio, de nuevo desde el original
  const original = path.join(c, 'audio', 'voz-original.mp3');
  if (!existeArchivo(original)) fs.copyFileSync(path.join(c, plan.audio?.voz || 'audio/voz.mp3'), original);
  const n = (Number(plan.cortes) || 0) + 1;
  const rel = `audio/voz-${n}-${Date.now().toString(36)}.mp3`;
  const filtros = nueva.map((f, k) => `[0:a]atrim=start=${f.desde}:end=${f.hasta},asetpts=PTS-STARTPTS[a${k}]`);
  const grafo = `${filtros.join(';')};${nueva.map((_, k) => `[a${k}]`).join('')}concat=n=${nueva.length}:v=0:a=1[a]`;
  ffmpeg(['-i', original, '-filter_complex', grafo, '-map', '[a]', '-ac', '2', '-ar', '44100', '-b:a', '192k', path.join(c, rel)], 'recortar el audio');

  // 3. las escenas
  const bloques = [];
  for (const bl of plan.bloques || []) {
    const i = Number(bl.inicio);
    const f = Number(bl.fin);
    const ri = Number(bl.toma?.recorteInicio) || 0;
    const parte = (ini, fin, entrada) => {
      if (fin - ini < 1 / FPS) return;
      bloques.push({ ...bl, inicio: r3(ini), fin: r3(fin), ventana: r3(fin - ini), toma: { ...bl.toma, desde: r3(ini), duracion: r3(fin - ini), recorteInicio: r3(entrada) } });
    };
    if (f <= a) parte(i, f, ri);
    else if (i >= b) parte(i - d, f - d, ri);
    else if (i >= a && f <= b) continue;
    else if (i < a && f > b) {
      parte(i, a, ri);
      parte(a, f - d, ri + (b - i));
    } else if (i < a) parte(i, a, ri);
    else parte(a, f - d, ri + (b - i));
  }
  bloques.forEach((bl, k) => (bl.linea = k + 1));

  // 4. los subtítulos: las palabras que quedan, corridas
  const mapa = {};
  const subtitulos = [];
  (plan.subtitulos || []).forEach((s, k) => {
    const palabras = (s.palabras || [])
      .filter((p) => !((p.inicio + p.fin) / 2 > a && (p.inicio + p.fin) / 2 < b))
      .map((p) => ({ ...p, inicio: r3(correrT(p.inicio, a, b)), fin: r3(correrT(p.fin, a, b)) }));
    if (!palabras.length) {
      mapa[k] = null;
      return;
    }
    const cola = Math.max(0, Number(s.fin) - Number(s.palabras?.at(-1)?.fin ?? s.fin));
    mapa[k] = subtitulos.length;
    subtitulos.push({ ...s, inicio: palabras[0].inicio, fin: r3(Math.min(correrT(Number(s.fin), a, b), palabras.at(-1).fin + cola) || palabras.at(-1).fin), texto: palabras.map((p) => p.texto).join(' '), palabras });
  });

  const nuevoPlan = { ...plan, duracion: r3(dur - d), fuente: nueva, cortes: n, audio: { ...plan.audio, voz: rel }, bloques, subtitulos };
  fs.writeFileSync(archivoPlan, JSON.stringify(nuevoPlan, null, 2));
  if (subtitulos.length || existeArchivo(path.join(c, 'subtitulos.json'))) fs.writeFileSync(path.join(c, 'subtitulos.json'), JSON.stringify(subtitulos, null, 2));
  return { plan: nuevoPlan, mapa, desde: a, hasta: b };
}
const existeArchivo = (f) => fs.existsSync(f);

// ---------------------------------------------------------------- transcribir la voz después (centavos)

/**
 * Las palabras del audio ORIGINAL llevadas al video de ahora: `fuente` dice qué partes del original quedan, en orden
 * (quitarTramo las recorta). Una palabra va si su mitad cae en una parte que quedó. FUNCIÓN PURA.
 *   palabras: [{ texto, inicio, fin }] en segundos del original -> las mismas en segundos del video de ahora
 */
export function palabrasEnElVideo(palabras, fuente) {
  const partes = [];
  let t = 0;
  for (const f of fuente || []) {
    partes.push({ desde: Number(f.desde), hasta: Number(f.hasta), t0: t });
    t += Number(f.hasta) - Number(f.desde);
  }
  const salida = [];
  for (const w of palabras || []) {
    const medio = (w.inicio + w.fin) / 2;
    const p = partes.find((x) => medio >= x.desde && medio < x.hasta);
    if (!p) continue;
    const llevar = (x) => r3(p.t0 + Math.max(p.desde, Math.min(p.hasta, x)) - p.desde);
    salida.push({ texto: w.texto, inicio: llevar(w.inicio), fin: llevar(w.fin) });
  }
  return salida;
}

/**
 * «Transcribir la voz» desde el editor (un video tuyo subido sin «Subtítulos»): transcribe el audio original con
 * ElevenLabs una sola vez (centavos; queda en app/video-propio/palabras.json) y pone las palabras con sus tiempos en el
 * plan de ahora y en cada versión guardada (deshacer y rehacer los cortes las conservan). Así se puede buscar y
 * censurar lo que se dice, y se ven los subtítulos.
 */
export async function transcribirVoz(carpeta, { idioma = null } = {}) {
  const c = path.resolve(RAIZ, carpeta);
  const archivoPlan = path.join(c, 'plan-montaje.json');
  const plan = JSON.parse(fs.readFileSync(archivoPlan, 'utf8'));
  if (!plan.videoPropio) throw new Error('Solo se transcribe la voz de tus propios videos.');
  const cache = path.join(c, 'app', 'video-propio', 'palabras.json');
  let palabras = null;
  try {
    palabras = JSON.parse(fs.readFileSync(cache, 'utf8')).palabras;
  } catch {
    palabras = null;
  }
  if (!Array.isArray(palabras)) {
    avance('transcribir', 'Escuchando lo que se dice', 20);
    const original = existeArchivo(path.join(c, 'audio', 'voz-original.mp3')) ? path.join(c, 'audio', 'voz-original.mp3') : path.join(c, plan.audio?.voz || 'audio/voz.mp3');
    cargarEnv();
    const { transcribir } = await import('./subtitulos-dialogo.js');
    const todo = await transcribir(original, idioma || null, { eventos: false });
    palabras = todo.filter((w) => w.type === 'word' && String(w.text || '').trim()).map((w) => ({ texto: String(w.text).trim(), inicio: r3(w.start), fin: r3(w.end) }));
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    fs.writeFileSync(cache, JSON.stringify({ generado: new Date().toISOString(), palabras }, null, 2));
  }
  avance('guardar', 'Poniendo las palabras en el video', 85);
  const { bloquesDeSubtitulos } = await import('./subtitulos.js');
  const conPalabras = (p) => {
    const ws = palabrasEnElVideo(palabras, Array.isArray(p.fuente) && p.fuente.length ? p.fuente : [{ desde: 0, hasta: p.duracion }]);
    const subtitulos = ws.length ? bloquesDeSubtitulos(ws) : [];
    const bloques = (p.bloques || []).map((b) => ({ ...b, texto: ws.filter((w) => (w.inicio + w.fin) / 2 >= b.inicio && (w.inicio + w.fin) / 2 < b.fin).map((w) => w.texto).join(' ') }));
    return { ...p, subtitulos, bloques };
  };
  const nuevo = conPalabras(plan);
  fs.writeFileSync(archivoPlan, JSON.stringify(nuevo, null, 2));
  fs.writeFileSync(path.join(c, 'subtitulos.json'), JSON.stringify(nuevo.subtitulos, null, 2));
  // las versiones guardadas (deshacer y rehacer los cortes del editor)
  const dirVersiones = path.join(c, 'app', 'video-propio', 'versiones');
  for (const n of existeArchivo(dirVersiones) ? fs.readdirSync(dirVersiones) : []) {
    if (!/\.json$/.test(n)) continue;
    try {
      const v = JSON.parse(fs.readFileSync(path.join(dirVersiones, n), 'utf8'));
      fs.writeFileSync(path.join(dirVersiones, n), JSON.stringify(conPalabras(v)) + '\n');
    } catch {
      // una versión dañada se queda como estaba
    }
  }
  try {
    const m = JSON.parse(fs.readFileSync(path.join(c, 'manifiesto.json'), 'utf8'));
    m.video_propio = { ...(m.video_propio || {}), subtitulos: nuevo.subtitulos.length > 0 };
    fs.writeFileSync(path.join(c, 'manifiesto.json'), JSON.stringify(m, null, 2));
  } catch {
    // sin manifiesto: igual quedan en el plan
  }
  const listo = { palabras: palabras.length, subtitulos: nuevo.subtitulos.length };
  avisar('listo', listo);
  return listo;
}

const esPrincipal = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esPrincipal) {
  const args = process.argv.slice(2);
  const carpeta = args.find((a) => !a.startsWith('--') && !/^(spa|eng|por)$/.test(a));
  const idioma = args.includes('--idioma') ? args[args.indexOf('--idioma') + 1] : null;
  if (!carpeta) {
    console.error('Uso: node produccion/video-propio.js temp/<slug> [--subtitulos] [--idioma spa]');
    process.exit(1);
  }
  (args.includes('--transcribir') ? transcribirVoz(carpeta, { idioma }) : preparar(carpeta, { subtitulos: args.includes('--subtitulos'), idioma })).catch((e) => {
    avisar('error', { error: String(e.message || e) });
    process.exit(1);
  });
}

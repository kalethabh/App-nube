// TU PROPIO VIDEO EN EL EDITOR (2026-11-14): prepara cualquier video (uno tuyo, uno que bajaste o el que dejó
// «Cambiar el producto») para abrirlo en el editor de la app como si fuera un anuncio. Gratis (ffmpeg en esta PC);
// solo los subtítulos, si se piden, transcriben el audio con ElevenLabs (centavos).
//
//   node produccion/video-propio.js temp/<slug> [--subtitulos] [--idioma spa|eng|por]
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

const esPrincipal = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esPrincipal) {
  const args = process.argv.slice(2);
  const carpeta = args.find((a) => !a.startsWith('--') && !/^(spa|eng|por)$/.test(a));
  const idioma = args.includes('--idioma') ? args[args.indexOf('--idioma') + 1] : null;
  if (!carpeta) {
    console.error('Uso: node produccion/video-propio.js temp/<slug> [--subtitulos] [--idioma spa]');
    process.exit(1);
  }
  preparar(carpeta, { subtitulos: args.includes('--subtitulos'), idioma }).catch((e) => {
    avisar('error', { error: String(e.message || e) });
    process.exit(1);
  });
}

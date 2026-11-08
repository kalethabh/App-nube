// Analiza un video de referencia para clonarlo: lo corta en tomas (donde cambia
// la imagen), saca un fotograma de cada toma y una hoja con todas, y transcribe
// lo que se dice con el tiempo de cada palabra. No genera nada en kie.ai; la
// transcripción usa ElevenLabs (centavos).
//
//   node .claude/skills/anuncios-clonacion/scripts/analizar-referencia.mjs <video> <carpeta-salida> [--idioma spa|eng|por] [--sin-audio]
//
// Deja en <carpeta-salida>:
//   tomas/toma-01.jpg ...   un fotograma por toma (a la mitad de la toma)
//   hoja-tomas.jpg          todas las tomas en una sola imagen, en orden
//   transcripcion.json      las palabras con sus tiempos (y eventos: música, risas...)
//   adn-base.json           las tomas con sus tiempos, su fotograma y lo que se dice en cada una
//
// Es de la skill anuncios-clonacion (propia del usuario, no del sistema): vive
// en su carpeta para que las actualizaciones no la toquen.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const UMBRAL_ESCENA = 0.3; // cuánto tiene que cambiar la imagen para contar como corte
const TOMA_MINIMA = 0.6; // segundos: cortes más seguidos que esto se juntan

const args = process.argv.slice(2);
const [video, salida] = args.filter((a) => !a.startsWith('--') && !/^(spa|eng|por)$/.test(a));
const idioma = args.includes('--idioma') ? args[args.indexOf('--idioma') + 1] : null;
if (!video || !salida || !fs.existsSync(video)) {
  console.error('\n  Uso: node .claude/skills/anuncios-clonacion/scripts/analizar-referencia.mjs <video> <carpeta-salida> [--idioma spa|eng|por]\n');
  process.exit(1);
}
fs.mkdirSync(path.join(salida, 'tomas'), { recursive: true });

// 1. Duración y tamaño
const info = JSON.parse(
  execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=width,height,codec_type', '-of', 'json', video], { encoding: 'utf8' })
);
const duracion = Number(info.format.duration);
const vs = info.streams.find((s) => s.codec_type === 'video');
const tieneAudio = info.streams.some((s) => s.codec_type === 'audio');

// 2. Cortes de escena
const r = spawnSync('ffmpeg', ['-hide_banner', '-i', video, '-filter:v', `select='gt(scene,${UMBRAL_ESCENA})',showinfo`, '-f', 'null', '-'], { encoding: 'utf8' });
const cortes = [...(r.stderr || '').matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1])).filter((t) => t > 0.05 && t < duracion - 0.05);
const limites = [0];
for (const c of cortes) if (c - limites[limites.length - 1] >= TOMA_MINIMA) limites.push(c);
if (duracion - limites[limites.length - 1] < TOMA_MINIMA && limites.length > 1) limites.pop();
limites.push(duracion);
const tomas = limites.slice(0, -1).map((desde, i) => ({ n: i + 1, desde: +desde.toFixed(2), hasta: +limites[i + 1].toFixed(2) }));

// 3. Un fotograma por toma y la hoja con todas
for (const t of tomas) {
  const archivo = path.join(salida, 'tomas', `toma-${String(t.n).padStart(2, '0')}.jpg`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String((t.desde + t.hasta) / 2), '-i', video, '-frames:v', '1', '-vf', 'scale=480:-2', archivo]);
  t.duracion = +(t.hasta - t.desde).toFixed(2);
  t.fotograma = path.relative(salida, archivo).replace(/\\/g, '/');
}
const columnas = Math.min(6, tomas.length);
const filas = Math.ceil(tomas.length / columnas);
spawnSync('ffmpeg', [
  '-v', 'error', '-y', '-framerate', '1', '-i', path.join(salida, 'tomas', 'toma-%02d.jpg'),
  '-vf', `scale=240:-2,pad=iw+8:ih+8:4:4:white,tile=${columnas}x${filas}:color=white`, '-frames:v', '1', path.join(salida, 'hoja-tomas.jpg'),
]);

// 4. Transcripción con tiempos (ElevenLabs, la misma función que usan los subtítulos del motor)
let palabras = [];
let eventos = [];
let avisoAudio = null;
if (tieneAudio && !args.includes('--sin-audio')) {
  const mp3 = path.join(salida, 'audio-referencia.mp3');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-vn', '-ac', '1', '-ar', '44100', '-b:a', '128k', mp3]);
  try {
    const { cargarEnv } = await import(pathToFileURL(path.join(RAIZ, 'produccion', 'config.js')).href);
    cargarEnv();
    const { transcribir } = await import(pathToFileURL(path.join(RAIZ, 'produccion', 'subtitulos-dialogo.js')).href);
    const todo = await transcribir(mp3, idioma, { eventos: true });
    palabras = todo.filter((w) => w.type === 'word').map((w) => ({ texto: w.text, desde: w.start, hasta: w.end }));
    eventos = todo.filter((w) => w.type === 'audio_event').map((w) => ({ texto: w.text, desde: w.start, hasta: w.end }));
  } catch (e) {
    avisoAudio = `No pude transcribir el audio: ${e.message}`;
  }
} else if (!tieneAudio) {
  avisoAudio = 'El video no tiene audio.';
}
fs.writeFileSync(path.join(salida, 'transcripcion.json'), JSON.stringify({ palabras, eventos }, null, 2));

// 5. Lo que se dice en cada toma
for (const t of tomas) {
  t.dice = palabras
    .filter((p) => (p.desde + p.hasta) / 2 >= t.desde && (p.desde + p.hasta) / 2 < t.hasta)
    .map((p) => p.texto)
    .join(' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
  t.eventos = eventos.filter((e) => e.desde < t.hasta && e.hasta > t.desde).map((e) => e.texto);
}
const texto = palabras.map((p) => p.texto).join(' ').replace(/\s+([,.;:!?])/g, '$1');
const ritmo = palabras.length && duracion ? +(palabras.length / duracion).toFixed(2) : 0;
const adn = {
  video: path.basename(video),
  duracion: +duracion.toFixed(2),
  formato: vs ? `${vs.width}x${vs.height}` : null,
  vertical: vs ? vs.height > vs.width : null,
  tomas,
  texto,
  palabras_por_segundo: ritmo,
  eventos_de_audio: [...new Set(eventos.map((e) => e.texto))],
  aviso: avisoAudio,
};
fs.writeFileSync(path.join(salida, 'adn-base.json'), JSON.stringify(adn, null, 2));

// 6. Resumen
console.log(`\n=== Video de referencia: ${adn.video} ===\n`);
console.log(`  Duración:   ${adn.duracion}s · ${adn.formato}${adn.vertical ? ' (vertical)' : ''}`);
console.log(`  Tomas:      ${tomas.length} (cortes de imagen)`);
console.log(`  Ritmo:      ${ritmo} palabras por segundo`);
if (adn.eventos_de_audio.length) console.log(`  Sonidos:    ${adn.eventos_de_audio.join(', ')}`);
if (avisoAudio) console.log(`  OJO:        ${avisoAudio}`);
console.log('');
for (const t of tomas) console.log(`  ${String(t.n).padStart(2)}  ${t.desde.toFixed(1).padStart(5)}–${t.hasta.toFixed(1).padEnd(5)} ${t.dice ? `"${t.dice}"` : '(sin voz)'}`);
console.log(`\n  Mira ${path.join(salida, 'hoja-tomas.jpg')} y los fotogramas de tomas/ para ver qué pasa en cada toma.\n`);

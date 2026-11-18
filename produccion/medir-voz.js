// Mide la VOZ de un audio (la del narrador de un video de referencia), en la computadora y gratis: qué tan grave o
// aguda es (el tono, F0), qué tanto sube y baja (expresiva o plana) y su ritmo. Sirve para elegir la voz de ElevenLabs
// más parecida cuando el usuario no eligió una (app/server/lib/voz-auto.js).
//
//   medirVoz(audio, palabras?) -> { f0, genero: 'masculina' | 'femenina' | null, variacion, expresiva, ritmo, muestras }
//                                 | null (sin audio, sin voz o sin ffmpeg)
//
// palabras: [{ desde, hasta }] de la transcripción; si vienen, solo se mide donde se habla (sin la música de las
// pausas). El tono sale por autocorrelación de cuadros de 40 ms con voz; la mediana es robusta a la música de fondo.
// Un tono medio de 165 Hz o menos es una voz grave (casi siempre masculina); 185 Hz o más, aguda (casi siempre
// femenina); entre los dos, dudosa (null).
import { spawnSync } from 'node:child_process';

const TASA = 16000;
const CUADRO = 640; // 40 ms
const PASO = 320; // 20 ms
const LAG_MIN = Math.floor(TASA / 400); // 400 Hz
const LAG_MAX = Math.ceil(TASA / 70); // 70 Hz

/** El audio como muestras mono de 16 kHz (Float32Array), o null. */
export function muestrasDe(audio, ffmpeg = process.env.FFMPEG_BIN || 'ffmpeg') {
  const r = spawnSync(ffmpeg, ['-v', 'error', '-i', audio, '-vn', '-ac', '1', '-ar', String(TASA), '-f', 'f32le', '-'], { maxBuffer: 400 * 1024 * 1024 });
  if (r.status !== 0 || !r.stdout?.length) return null;
  const b = r.stdout;
  return new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4));
}

/** El tono (Hz) de un cuadro por autocorrelación normalizada, o 0 si no es voz clara. */
export function tonoDelCuadro(x, desde) {
  let energia = 0;
  for (let i = 0; i < CUADRO; i++) energia += x[desde + i] * x[desde + i];
  if (energia < 1e-4) return 0;
  const rs = new Float32Array(LAG_MAX + 2);
  let mejor = 0;
  for (let lag = LAG_MIN; lag <= LAG_MAX + 1; lag++) {
    let s = 0;
    let e1 = 0;
    let e2 = 0;
    for (let i = 0; i < CUADRO - lag; i++) {
      const a = x[desde + i];
      const b = x[desde + i + lag];
      s += a * b;
      e1 += a * a;
      e2 += b * b;
    }
    rs[lag] = s / Math.sqrt(e1 * e2 + 1e-12);
    if (lag <= LAG_MAX && rs[lag] > mejor) mejor = rs[lag];
  }
  if (mejor < 0.55) return 0;
  // el PRIMER pico casi tan alto como el mejor: los múltiplos del período (una octava abajo) también correlacionan
  for (let lag = LAG_MIN + 1; lag <= LAG_MAX; lag++) {
    if (rs[lag] >= mejor * 0.9 && rs[lag] >= rs[lag - 1] && rs[lag] >= rs[lag + 1]) return TASA / lag;
  }
  return 0;
}

const mediana = (l) => {
  const o = [...l].sort((a, b) => a - b);
  return o.length ? o[Math.floor(o.length / 2)] : 0;
};

/** Mide la voz de unas muestras (Float32Array de 16 kHz). */
export function medirMuestras(x, palabras = null) {
  if (!x?.length) return null;
  let maxRms = 0;
  const rms = [];
  for (let i = 0; i + CUADRO <= x.length; i += PASO) {
    let e = 0;
    for (let k = 0; k < CUADRO; k += 4) e += x[i + k] * x[i + k];
    const v = Math.sqrt(e / (CUADRO / 4));
    rms.push(v);
    if (v > maxRms) maxRms = v;
  }
  const hablaEn = (t) => !palabras?.length || palabras.some((p) => t >= p.desde && t <= p.hasta);
  const tonos = [];
  for (let k = 0, i = 0; i + CUADRO <= x.length; k++, i += PASO) {
    if (rms[k] < maxRms * 0.12) continue;
    if (!hablaEn((i + CUADRO / 2) / TASA)) continue;
    const f = tonoDelCuadro(x, i);
    if (f >= 70 && f <= 400) tonos.push(f);
  }
  if (tonos.length < 15) return null;
  const f0 = mediana(tonos);
  // qué tanto sube y baja, en semitonos (desviación alrededor de la mediana)
  const st = tonos.map((f) => 12 * Math.log2(f / f0));
  const variacion = Math.sqrt(st.reduce((a, b) => a + b * b, 0) / st.length);
  const duracion = x.length / TASA;
  return {
    f0: Math.round(f0),
    genero: f0 <= 165 ? 'masculina' : f0 >= 185 ? 'femenina' : null,
    variacion: +variacion.toFixed(2),
    expresiva: variacion >= 3,
    ritmo: palabras?.length && duracion ? +(palabras.length / duracion).toFixed(2) : null,
    muestras: tonos.length,
  };
}

/** Mide la voz de un archivo de audio o video. null si no se pudo (sin ffmpeg, sin voz). */
export function medirVoz(audio, palabras = null) {
  try {
    return medirMuestras(muestrasDe(audio), palabras);
  } catch {
    return null;
  }
}

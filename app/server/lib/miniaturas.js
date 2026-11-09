// Miniaturas livianas para las rejillas: las imagenes del motor pesan 1-6 MB (Sunburst 2K) y una
// rejilla de 40 se volveria lenta. Se achican con el ffmpeg que ya trae Remotion (gratis, local) y
// se guardan en app/.cache/miniaturas/. Nunca se toca el archivo original.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { APP, RAIZ } from './rutas.js';

const CACHE = path.join(APP, '.cache', 'miniaturas');
// El ffmpeg que trae Remotion para este sistema (compositor-win32-x64-msvc, compositor-darwin-arm64, ...);
// si no esta, el del PATH.
function buscarFfmpeg() {
  const dir = path.join(RAIZ, 'remotion', 'node_modules', '@remotion');
  try {
    for (const n of fs.readdirSync(dir).filter((x) => x.startsWith('compositor-'))) {
      const bin = path.join(dir, n, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
      if (fs.existsSync(bin)) return bin;
    }
  } catch {
    /* sin remotion */
  }
  return 'ffmpeg';
}
const FFMPEG = buscarFfmpeg();
/** El ffmpeg que usa la app (el de Remotion, o el del PATH). */
export const rutaFfmpeg = () => FFMPEG;

export const ANCHOS = [160, 240, 320, 480, 640, 720, 960];
export const anchoPermitido = (n) => ANCHOS.find((a) => a >= Number(n)) || ANCHOS[ANCHOS.length - 1];

// Pocas a la vez: es la PC del alumno.
const MAXIMO = 3;
let enCurso = 0;
const fila = [];
const pendientes = new Map(); // clave -> promesa

function turno(tarea) {
  return new Promise((resolve, reject) => {
    const correr = () => {
      enCurso++;
      tarea()
        .then(resolve, reject)
        .finally(() => {
          enCurso--;
          fila.shift()?.();
        });
    };
    if (enCurso < MAXIMO) correr();
    else fila.push(correr);
  });
}

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG, args, { timeout: 30000, windowsHide: true }, (err) => (err ? reject(err) : resolve()));
  });
}

/**
 * Devuelve la ruta de la miniatura (JPEG, o PNG si el original tiene transparencia como los iconos).
 * `segundo` solo para videos: de que momento sacar el cuadro.
 */
export async function miniatura(origen, ancho, { segundo = 0.8 } = {}) {
  const st = fs.statSync(origen);
  const esVideo = /\.(mp4|mov|webm)$/i.test(origen);
  const conTransparencia = /[\\/]icono-[^\\/]+\.png$/i.test(origen);
  const ext = conTransparencia ? '.png' : '.jpg';
  const clave = crypto
    .createHash('sha1')
    .update([origen, st.size, st.mtimeMs, ancho, esVideo ? segundo : ''].join('|'))
    .digest('hex');
  const destino = path.join(CACHE, `${clave}${ext}`);
  if (fs.existsSync(destino)) return destino;
  if (pendientes.has(clave)) return pendientes.get(clave);

  const promesa = turno(async () => {
    fs.mkdirSync(CACHE, { recursive: true });
    const tmp = `${destino}.${process.pid}.tmp${ext}`;
    const escala = `scale='min(${ancho},iw)':-2:flags=lanczos`;
    const args = esVideo
      ? ['-v', 'error', '-y', '-ss', String(segundo), '-i', origen, '-frames:v', '1', '-vf', escala, '-q:v', '3', tmp]
      : ['-v', 'error', '-y', '-i', origen, '-frames:v', '1', '-vf', escala, ...(conTransparencia ? [] : ['-q:v', '3']), tmp];
    try {
      await ffmpeg(args);
      fs.renameSync(tmp, destino);
      return destino;
    } catch (e) {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* no estaba */
      }
      throw e;
    }
  }).finally(() => pendientes.delete(clave));
  pendientes.set(clave, promesa);
  return promesa;
}

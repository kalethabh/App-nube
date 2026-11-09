// Borrar los subtítulos y textos quemados de un video, en este computador (gratis).
//
//   npm run subtitulos:instalar                      prepara el entorno de Python, una sola vez (unos 2 GB, 5-15 min)
//   npm run subtitulos:borrar -- <video> [salida]    deja <video>_limpio.mp4 (o <salida>) sin subtítulos ni avisos
//
// El motor es el de la skill «Video Limpio» (produccion/video-limpio/): detecta el texto con OCR (RapidOCR) y lo
// borra con la red STTN, que reconstruye el fondo mirando los cuadros de antes y de después. Allá corría en una
// tarjeta NVIDIA en Modal; aquí usa la GPU de la Mac con chip Apple (MPS) o, si no hay, el procesador: más lento,
// misma calidad. Con CLONADOR_TELEA=1 usa el método rápido de respaldo (deja manchas).
//
// El entorno vive en <carpeta>/.venv-limpio (fuera de git). Necesita Python 3.10+ y ffmpeg en el PATH.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RAIZ } from './config.js';
import { buscarPython, comandoPython } from './recortar-host.js';

const MOTOR = path.join(RAIZ, 'produccion', 'video-limpio');
const VENV = path.join(RAIZ, '.venv-limpio');
const PY_VENV = process.platform === 'win32' ? path.join(VENV, 'Scripts', 'python.exe') : path.join(VENV, 'bin', 'python');
const PAQUETES = ['torch==2.7.1', 'numpy<2.3', 'opencv-python-headless', 'onnxruntime==1.22.0', 'Pillow', 'pyclipper', 'PyYAML', 'Shapely', 'six'];

function correr(cmd, args, opciones = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', windowsHide: true, ...opciones });
  if (r.error) throw r.error;
  return r.status ?? 1;
}

export const entornoListo = () =>
  fs.existsSync(PY_VENV) && spawnSync(PY_VENV, ['-c', 'import torch, cv2, rapidocr_onnxruntime'], { windowsHide: true }).status === 0;

export function instalar() {
  if (entornoListo()) {
    console.log('  El borrador de subtítulos ya está listo.');
    return 0;
  }
  const py = buscarPython();
  if (!py) {
    console.error('  Falta Python 3.10 o más nuevo. En la Mac: brew install python@3.12 (o el lanzador de la app lo instala).');
    return 1;
  }
  const [mayor, menor] = py.version.split('.').map(Number);
  if (mayor !== 3 || menor < 10) {
    console.error(`  Tu Python es ${py.version}; hace falta 3.10 o más nuevo.`);
    return 1;
  }
  console.log(`\n  Preparando el borrador de subtítulos con ${comandoPython(py)} ${py.version}.`);
  console.log('  Baja unos 2 GB (PyTorch y el lector de texto). Tarda entre 5 y 15 minutos, una sola vez.\n');
  if (!fs.existsSync(PY_VENV) && correr(py.cmd, [...py.pre, '-m', 'venv', VENV]) !== 0) return 1;
  if (correr(PY_VENV, ['-m', 'pip', 'install', '-q', '--upgrade', 'pip']) !== 0) return 1;
  if (correr(PY_VENV, ['-m', 'pip', 'install', '-q', ...PAQUETES]) !== 0) return 1;
  // sin dependencias: rapidocr pide su propio onnxruntime, que pisaría al de arriba
  if (correr(PY_VENV, ['-m', 'pip', 'install', '-q', '--no-deps', 'rapidocr-onnxruntime==1.2.3']) !== 0) return 1;
  if (!entornoListo()) {
    console.error('  Algo no quedó bien instalado. Vuelve a correr: npm run subtitulos:instalar');
    return 1;
  }
  console.log('\n  Listo: el borrador de subtítulos está instalado.\n');
  return 0;
}

/** Borra el texto de `video` y deja el resultado en `salida`. Devuelve la ruta, o lanza con el motivo. */
export function borrarSubtitulos(video, salida, { modo = 'auto' } = {}) {
  if (!entornoListo()) throw new Error('El borrador de subtítulos no está instalado: npm run subtitulos:instalar');
  const entrada = path.resolve(video);
  if (!fs.existsSync(entrada)) throw new Error(`No encuentro el video: ${entrada}`);
  const fin = path.resolve(salida || entrada.replace(/(\.[^.]+)?$/, '_limpio.mp4'));
  const texto = fin.replace(/\.mp4$/, '.texto.json');
  // PYTORCH_ENABLE_MPS_FALLBACK: en la Mac, lo poco que la GPU (MPS) no sabe hacer va al procesador en vez de fallar
  const env = { ...process.env, CLONADOR_SALIDA: 'original', PYTHONPATH: MOTOR, PYTHONUTF8: '1', PYTORCH_ENABLE_MPS_FALLBACK: '1' };
  const t0 = Date.now();
  console.log('\n  1/2 Buscando los textos del video (subtítulos, precios, avisos)...');
  if (correr(PY_VENV, ['-m', 'clonador.detectar_texto', entrada, texto], { cwd: MOTOR, env }) !== 0) throw new Error('No pude leer los textos del video.');
  console.log('  2/2 Borrándolos y reconstruyendo el fondo (en un computador sin tarjeta gráfica tarda varios minutos)...');
  if (correr(PY_VENV, ['-m', 'clonador.borrar_texto', entrada, texto, fin, modo], { cwd: MOTOR, env }) !== 0) throw new Error('No pude borrar los textos del video.');
  const s = Math.round((Date.now() - t0) / 1000);
  console.log(`  Tardó ${Math.floor(s / 60)} min ${s % 60} s.`);
  return fin;
}

// ---------------------------------------------------------------- uso directo
const [, script, ...args] = process.argv;
if (script && path.resolve(script) === fileURLToPath(import.meta.url)) {
  if (args[0] === '--instalar') process.exit(instalar());
  if (!args[0]) {
    console.error('Uso: npm run subtitulos:borrar -- <video> [salida.mp4]');
    process.exit(1);
  }
  try {
    const f = borrarSubtitulos(args[0], args[1]);
    console.log(`\n  Listo: ${f}\n`);
  } catch (e) {
    console.error(`\n  ${e.message}\n`);
    process.exit(1);
  }
}

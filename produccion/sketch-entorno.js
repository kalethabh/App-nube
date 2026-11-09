// El Python del estilo sketch (.claude/skills/anuncios-sketch/scripts): un entorno propio, .venv-sketch, con
// faster-whisper, Pillow y NumPy (el montaje y la revisión transcriben cada toma). Se instala solo la primera vez
// que la app produce un sketch: unos 200 MB, y la primera revisión baja además los modelos de transcripción (~3 GB).
//
//   node produccion/sketch-entorno.js --instalar
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RAIZ } from './config.js';
import { buscarPython, comandoPython } from './recortar-host.js';

export const SCRIPTS = path.join(RAIZ, '.claude', 'skills', 'anuncios-sketch', 'scripts');
const VENV = path.join(RAIZ, '.venv-sketch');
export const PY_SKETCH = process.platform === 'win32' ? path.join(VENV, 'Scripts', 'python.exe') : path.join(VENV, 'bin', 'python');

export const entornoListo = () => fs.existsSync(PY_SKETCH) && spawnSync(PY_SKETCH, ['-c', 'import faster_whisper, PIL, numpy'], { windowsHide: true }).status === 0;

function correr(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', windowsHide: true });
  if (r.error) throw r.error;
  return r.status ?? 1;
}

export function instalar() {
  if (entornoListo()) {
    console.log('  El entorno del sketch ya está listo.');
    return 0;
  }
  const py = buscarPython();
  if (!py) {
    console.error('  Falta Python 3.10 o más nuevo: cierra la app y ábrela con doble clic en «Abrir Anuncios con IA», que lo instala solo.');
    return 1;
  }
  const [mayor, menor] = py.version.split('.').map(Number);
  if (mayor !== 3 || menor < 10) {
    console.error(`  Tu Python es ${py.version}; hace falta 3.10 o más nuevo.`);
    return 1;
  }
  console.log(`  Preparando el entorno del sketch con ${comandoPython(py)} ${py.version} (una sola vez)...`);
  if (!fs.existsSync(PY_SKETCH) && correr(py.cmd, [...py.pre, '-m', 'venv', VENV]) !== 0) return 1;
  if (correr(PY_SKETCH, ['-m', 'pip', 'install', '-q', '--upgrade', 'pip']) !== 0) return 1;
  if (correr(PY_SKETCH, ['-m', 'pip', 'install', '-q', '-r', path.join(SCRIPTS, 'requirements.txt')]) !== 0) return 1;
  if (!entornoListo()) {
    console.error('  Algo no quedó bien instalado. Vuelve a intentarlo.');
    return 1;
  }
  console.log('  Listo: el entorno del sketch está instalado.');
  return 0;
}

const [, script, ...args] = process.argv;
if (script && path.resolve(script) === fileURLToPath(import.meta.url) && args[0] === '--instalar') process.exit(instalar());

// Los programas que usa la app y su motor (ffmpeg, ffprobe, Python, Node, Claude Code): donde estan y si sirven.
//
// El lanzador ("Abrir Anuncios con IA") instala lo que falta en una carpeta propia del usuario, sin contrasena:
//   Windows  %LOCALAPPDATA%\AnunciosConIA\programas
//   macOS    ~/Library/Application Support/AnunciosConIA/programas
// (AIA_PROGRAMAS_DIR elige otra, para las pruebas) y pone esas carpetas primero en el PATH antes de abrir el
// servidor: el servidor y el motor los encuentran por el PATH, como siempre.
//
// Si algo se instalo despues de abrir la app (el PATH de este proceso ya no cambia), "Volver a revisar" lo busca
// tambien en esa carpeta y, si lo encuentra, la suma al PATH de este proceso: lo que la app lance despues ya lo ve.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawnSync } from 'node:child_process';

const WIN = process.platform === 'win32';

/** La carpeta donde el lanzador deja los programas que instala. */
export function carpetaDeProgramas() {
  if (process.env.AIA_PROGRAMAS_DIR) return path.resolve(process.env.AIA_PROGRAMAS_DIR);
  if (WIN) return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'AnunciosConIA', 'programas');
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'AnunciosConIA', 'programas');
  return path.join(os.homedir(), '.local', 'share', 'AnunciosConIA', 'programas');
}

const esCarpeta = (d) => {
  try {
    return fs.statSync(d).isDirectory();
  } catch {
    return false;
  }
};
const esArchivo = (f) => {
  try {
    return fs.statSync(f).isFile();
  } catch {
    return false;
  }
};

/** Las carpetas con ejecutables dentro de la de programas: cada programa en la suya, suelto, en bin/ o en Scripts/. */
export function carpetasDeProgramas() {
  const base = carpetaDeProgramas();
  const fuera = [base, path.join(base, 'bin')];
  let entradas = [];
  try {
    entradas = fs.readdirSync(base, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const e of entradas) {
    if (e.name.startsWith('.')) continue;
    const d = path.join(base, e.name);
    // (un enlace a una carpeta cuenta como carpeta)
    if (!e.isDirectory() && !(e.isSymbolicLink() && esCarpeta(d))) continue;
    fuera.push(d, path.join(d, 'bin'), path.join(d, 'Scripts'));
  }
  return fuera.filter(esCarpeta);
}

const carpetasDelPath = () => String(process.env.PATH || process.env.Path || '').split(path.delimiter).filter(Boolean);
const EXTENSIONES = WIN ? ['.exe', '.cmd', '.bat'] : [''];

function buscarEn(dirs, nombre) {
  for (const dir of dirs) {
    for (const ext of EXTENSIONES) {
      const ruta = path.join(dir, nombre + ext);
      if (esArchivo(ruta)) return ruta;
    }
  }
  return null;
}

/**
 * Donde esta un programa: { ruta, enPath } (enPath = lo encuentra el motor por el PATH), o null.
 * Solo se mira si el archivo existe: no se ejecuta nada.
 */
export function buscarPrograma(nombre) {
  const enPath = buscarEn(carpetasDelPath(), nombre);
  if (enPath) return { ruta: enPath, enPath: true };
  const propio = buscarEn(carpetasDeProgramas(), nombre);
  return propio ? { ruta: propio, enPath: false } : null;
}

/** Pone una carpeta primero en el PATH de este proceso (lo heredan el motor y Claude Code que se lancen despues). */
export function sumarAlPath(dir) {
  if (!dir) return;
  const actuales = carpetasDelPath();
  const igual = (a, b) => (WIN ? a.toLowerCase() === b.toLowerCase() : a === b);
  if (actuales.some((d) => igual(path.resolve(d), path.resolve(dir)))) return;
  process.env.PATH = [dir, ...actuales].join(path.delimiter);
}

/** Corre un programa sin consola y sin shell: { ok, stdout } (nunca tira). */
function correr(cmd, args, timeout = 20000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd: os.tmpdir(), timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) =>
      resolve({ ok: !err, stdout: String(stdout || '') })
    );
  });
}

/**
 * El programa de video: { ffmpeg, ffprobe, vp9 }.
 *   ffmpeg / ffprobe  true si estan
 *   vp9               true si ffmpeg trae libvpx-vp9 (el video con fondo transparente del podcast en esquina);
 *                     null si no hay ffmpeg o no respondio
 */
export async function revisarVideo() {
  const ffmpeg = buscarPrograma('ffmpeg');
  const ffprobe = buscarPrograma('ffprobe');
  for (const p of [ffmpeg, ffprobe]) if (p && !p.enPath) sumarAlPath(path.dirname(p.ruta));
  let vp9 = null;
  if (ffmpeg && !/\.(cmd|bat)$/i.test(ffmpeg.ruta)) {
    const r = await correr(ffmpeg.ruta, ['-hide_banner', '-encoders']);
    if (r.ok) vp9 = /\blibvpx-vp9\b/.test(r.stdout);
  }
  return { ffmpeg: Boolean(ffmpeg), ffprobe: Boolean(ffprobe), vp9 };
}

// Los mismos Python que prueba el motor (produccion/recortar-host.js), en el mismo orden.
const CANDIDATOS_PYTHON = WIN ? [['python'], ['py', '-3'], ['python3']] : [['python3'], ['python']];
// modulo -> nombre para pip, los del podcast en esquina, la entrevista y los iconos
export const PAQUETES_PYTHON = [
  ['rembg', 'rembg'],
  ['onnxruntime', 'onnxruntime'],
  ['PIL', 'pillow'],
  ['numpy', 'numpy'],
];
// Ademas, si esta onnxruntime, se importa (solo ese, es rapido): en un Windows recien instalado le puede faltar el
// runtime de Visual C++ y entonces no carga ("DLL load failed") aunque este instalado.
const CODIGO_PYTHON =
  'import sys, json, importlib.util as u\n' +
  `f = [m for m in ${JSON.stringify(PAQUETES_PYTHON.map(([m]) => m))} if u.find_spec(m) is None]\n` +
  'dll = False\n' +
  'if "onnxruntime" not in f:\n' +
  '    try:\n' +
  '        import onnxruntime\n' +
  '    except Exception as e:\n' +
  '        dll = "DLL load failed" in str(e)\n' +
  'print(json.dumps({"v": list(sys.version_info[:3]), "faltan": f, "dll": dll}))';

/** En una Mac sin las herramientas de programador, /usr/bin/python3 no es Python: es un atajo que abre la ventana para instalarlas. */
let sinHerramientasMac;
export function esAtajoDePythonDeMac(ruta) {
  if (process.platform !== 'darwin' || !/^\/usr\/bin\/python3?$/.test(String(ruta))) return false;
  if (sinHerramientasMac === undefined) {
    try {
      sinHerramientasMac = spawnSync('xcode-select', ['-p'], { stdio: 'ignore', timeout: 5000 }).status !== 0;
    } catch {
      sinHerramientasMac = true;
    }
  }
  return sinHerramientasMac;
}
const AVISO_VISUAL_CPP =
  'Python está, pero a Windows le falta un componente (Microsoft Visual C++ Redistributable). Cierra la ventana negra y vuelve a abrir Anuncios con IA: intenta arreglarlo solo. Si sigue igual, instálalo desde https://aka.ms/vs/17/release/vc_redist.x64.exe';

/**
 * Python 3 con sus paquetes: { ok, version, faltan: [nombres de pip], comando }.
 * Se miran los paquetes sin importarlos (find_spec: es instantaneo; importar rembg tarda).
 */
export async function revisarPython() {
  const todos = PAQUETES_PYTHON.map(([, pip]) => pip);
  for (const soloDelPath of [true, false]) {
    for (const [cmd, ...pre] of CANDIDATOS_PYTHON) {
      const p = buscarPrograma(cmd);
      if (!p || p.enPath !== soloDelPath || /\.(cmd|bat)$/i.test(p.ruta) || esAtajoDePythonDeMac(p.ruta)) continue;
      const r = await correr(p.ruta, [...pre, '-E', '-c', CODIGO_PYTHON], 30000);
      if (!r.ok) continue; // el atajo de la Microsoft Store (python.exe que no es Python) no responde
      let v = null;
      try {
        v = JSON.parse(r.stdout.trim().split(/\r?\n/).pop());
      } catch {
        continue;
      }
      if (!Array.isArray(v?.v) || v.v[0] !== 3) continue;
      if (!p.enPath) {
        sumarAlPath(path.dirname(p.ruta));
        sumarAlPath(path.join(path.dirname(p.ruta), 'Scripts'));
      }
      const faltan = PAQUETES_PYTHON.filter(([m]) => (v.faltan || []).includes(m)).map(([, pip]) => pip);
      const comando = [cmd, ...pre].join(' ');
      if (!faltan.length && v.dll) return { ok: false, version: v.v.join('.'), faltan: ['onnxruntime'], comando: null, aviso: AVISO_VISUAL_CPP };
      return { ok: !faltan.length, version: v.v.join('.'), faltan, comando: `${comando} -m pip install --user ${(faltan.length ? faltan : todos).join(' ')}` };
    }
  }
  return { ok: false, version: null, faltan: todos, comando: `${WIN ? 'python' : 'python3'} -m pip install --user ${todos.join(' ')}` };
}

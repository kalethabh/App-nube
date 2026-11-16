// ¿La interfaz armada (app/dist) es la de los archivos que hay en disco? Si algo trajo pantallas nuevas sin volver a
// armarla (el guardado automático junta lo de GitHub cada 2 minutos, o un git pull a mano), la app seguiría
// mostrando la versión vieja aunque Ajustes diga la nueva. Aquí se nota eso y se vuelve a armar sola, en segundo
// plano; /api/estado cuenta cuándo se armó por última vez y la página ofrece recargar (marco/BandaVersionNueva.jsx).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { APP } from './rutas.js';

const DIST_INDEX = path.join(APP, 'dist', 'index.html');
const FUENTES = [path.join(APP, 'src'), path.join(APP, 'index.html'), path.join(APP, 'public'), path.join(APP, 'vite.config.js')];

function masNuevo(p, hondo = 0) {
  let st;
  try {
    st = fs.statSync(p);
  } catch {
    return 0;
  }
  if (!st.isDirectory()) return st.mtimeMs;
  if (hondo > 8) return 0;
  let max = 0;
  for (const e of fs.readdirSync(p)) if (!e.startsWith('.')) max = Math.max(max, masNuevo(path.join(p, e), hondo + 1));
  return max;
}
const huellaFuentes = () => Math.max(...FUENTES.map((f) => masNuevo(f)));
function armadaEn() {
  try {
    return fs.statSync(DIST_INDEX).mtimeMs;
  } catch {
    return 0;
  }
}

let armando = null; // la promesa del armado en curso
let fallo = null; // { huella, salida }: no se reintenta hasta que cambien los archivos

/** true si hay pantallas en disco más nuevas que la interfaz armada. */
export function interfazVieja() {
  const armada = armadaEn();
  return armada > 0 && huellaFuentes() > armada + 1000;
}

/** Vuelve a armar la interfaz (uno a la vez). Devuelve true si quedó armada. */
export function rearmarInterfaz() {
  if (armando) return armando;
  const huella = huellaFuentes();
  armando = new Promise((ok) => {
    let salida = '';
    let p;
    try {
      p = spawn('npm', ['run', 'build'], { cwd: APP, windowsHide: true, shell: process.platform === 'win32' });
    } catch (e) {
      fallo = { huella, salida: String(e?.message || e) };
      return ok(false);
    }
    const t = setTimeout(() => p.kill(), 300000);
    p.stdout.on('data', (d) => (salida += d));
    p.stderr.on('data', (d) => (salida += d));
    const fin = (codigo) => {
      clearTimeout(t);
      const bien = codigo === 0;
      fallo = bien ? null : { huella, salida: salida.slice(-1500) };
      if (!bien) console.error('  [interfaz] no se pudo volver a armar:', salida.slice(-400));
      ok(bien);
    };
    p.on('error', () => fin(1));
    p.on('close', fin);
  }).finally(() => {
    armando = null;
  });
  return armando;
}

/** Para /api/estado: cuándo se armó (cambia al volver a armarla), si se está armando y si falló. */
export function estadoInterfaz() {
  return { armada: Math.round(armadaEn()), armando: !!armando, error: !!fallo };
}

/** Mira cada 30 s si hay pantallas nuevas sin armar y las arma. Solo con la interfaz armada (no en --dev). */
export function vigilarInterfaz() {
  const mirar = () => {
    if (armando || !interfazVieja()) return;
    if (fallo && fallo.huella === huellaFuentes()) return; // ya falló con estos mismos archivos
    console.log('  [interfaz] hay pantallas nuevas: armándolas...');
    rearmarInterfaz();
  };
  setTimeout(mirar, 5000).unref?.();
  setInterval(mirar, 30000).unref?.();
}

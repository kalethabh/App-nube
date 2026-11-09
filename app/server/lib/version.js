// ¿El servidor que corre es el de los archivos que hay en disco? Al arrancar se anota la fecha del archivo más nuevo
// del servidor y del motor; si después aparece uno más nuevo («Actualizar», o un git pull), el servidor está
// desactualizado: lo nuevo no se usa hasta reiniciarlo. Los lanzadores y la pantalla lo miran en /api/estado.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { APP, RAIZ } from './rutas.js';

const CARPETAS = [path.join(APP, 'server'), path.join(RAIZ, 'produccion')];

function masNuevo(dir, hondo = 0) {
  let max = 0;
  let lista = [];
  try {
    lista = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of lista) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === 'pruebas' || e.name === '__pycache__') continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (hondo < 4) max = Math.max(max, masNuevo(f, hondo + 1));
    } else if (/\.(m?js|json)$/.test(e.name)) {
      try {
        max = Math.max(max, fs.statSync(f).mtimeMs);
      } catch {
        /* se borró mientras se miraba */
      }
    }
  }
  return max;
}
const huella = () => Math.max(...CARPETAS.map((d) => masNuevo(d)));
const AL_ARRANCAR = huella();
let cache = { t: 0, valor: false };

/** true si hay archivos del servidor o del motor más nuevos que este servidor (se mira cada 10 s como mucho). */
export function desactualizado() {
  if (Date.now() - cache.t > 10000) cache = { t: Date.now(), valor: huella() > AL_ARRANCAR + 1000 };
  return cache.valor;
}

/**
 * Reinicia el servidor con lo nuevo. Con el lanzador (app/inicio/arrancar.mjs) basta con salir con el código 75; si
 * no, se deja lanzado uno nuevo, aparte, que espera a que este suelte el puerto.
 */
const ocupados = [];
/** Quien tiene trabajo que no se puede cortar registra aquí cómo saberlo (p. ej. lib/cambiar.js). */
export function registrarOcupado(fn) {
  ocupados.push(fn);
}
/** El motivo por el que ahora no conviene reiniciar, o null. */
export const motivoParaNoReiniciar = () => ocupados.map((f) => f()).find(Boolean) || null;

export function reiniciar() {
  if (motivoParaNoReiniciar()) return false;
  if (process.env.AIA_SUPERVISADO !== '1') {
    const hijo = spawn(process.execPath, [path.join(APP, 'inicio', 'arrancar.mjs')], { cwd: APP, detached: true, stdio: 'ignore', env: { ...process.env, AIA_ESPERAR_PUERTO: '1' }, windowsHide: true });
    hijo.unref();
  }
  setTimeout(() => process.exit(process.env.AIA_SUPERVISADO === '1' ? 75 : 0), 800).unref?.();
  return true;
}

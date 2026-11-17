// Dibujar imágenes de las plantillas desde el servidor: un solo trabajador de larga vida (./trabajador.mjs, un proceso
// hijo con su navegador abierto y el armado de Remotion guardado). Cada imagen tarda 1-2 s con el navegador caliente.
//
//   renderizar({ composicion, props, salida }) -> Promise<{ ms }>   (lanza si falla)
//   calentar() -> Promise<{ ms, armado }>                            (arma y abre el navegador antes de que haga falta)
//   composicionDe(formato) -> 'Plantilla-1x1' | 'Plantilla-4x5' | 'Plantilla-9x16'
//   medidas() -> { renders, msPromedio, msUltimo, primero }          (lo que se midió en esta sesión)
import path from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RAIZ } from '../rutas.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const TRABAJADOR = path.join(AQUI, 'trabajador.mjs');

let hijo = null;
let siguiente = 1;
const pendientes = new Map(); // id -> { resolve, reject }
const medida = { renders: 0, total: 0, ultimo: null, primero: null, calentar: null };

function asegurar() {
  if (hijo) return hijo;
  hijo = fork(TRABAJADOR, [], {
    cwd: path.join(RAIZ, 'remotion'),
    env: { ...process.env, ANUNCIOS_RAIZ: RAIZ },
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    serialization: 'advanced',
  });
  const este = hijo;
  hijo.on('message', (m) => {
    const p = pendientes.get(m?.id);
    if (!p) return;
    pendientes.delete(m.id);
    if (m.ok) p.resolve(m);
    else p.reject(new Error(m.error || 'No pude dibujar la imagen.'));
  });
  hijo.on('exit', (codigo) => {
    if (hijo === este) hijo = null;
    for (const [id, p] of pendientes) {
      pendientes.delete(id);
      p.reject(new Error(`El dibujante de imágenes se cerró (código ${codigo}).`));
    }
  });
  hijo.on('error', () => {});
  return hijo;
}

function pedir(mensaje) {
  return new Promise((resolve, reject) => {
    const id = siguiente++;
    pendientes.set(id, { resolve, reject });
    try {
      asegurar().send({ ...mensaje, id });
    } catch (e) {
      pendientes.delete(id);
      reject(e);
    }
  });
}

export const composicionDe = (formato) => (formato === '9:16' ? 'Plantilla-9x16' : formato === '4:5' ? 'Plantilla-4x5' : 'Plantilla-1x1');

/** Dibuja una imagen y la deja en `salida` (PNG, de una vez). */
export async function renderizar({ composicion, props, salida }) {
  const r = await pedir({ tipo: 'render', composicion, props, salida });
  medida.renders++;
  medida.total += r.ms;
  medida.ultimo = r.ms;
  if (medida.primero === null) medida.primero = r.ms;
  return { ms: r.ms };
}

let calentando = null;
/** Arma (o lee el armado guardado) y abre el navegador. Se puede llamar muchas veces: lo hace una. */
export function calentar() {
  if (!calentando) {
    calentando = pedir({ tipo: 'calentar' })
      .then((r) => {
        medida.calentar = r;
        return r;
      })
      .finally(() => {
        setTimeout(() => (calentando = null), 1000).unref?.();
      });
  }
  return calentando;
}

export const medidas = () => ({ renders: medida.renders, msPromedio: medida.renders ? Math.round(medida.total / medida.renders) : null, msUltimo: medida.ultimo, primero: medida.primero, calentar: medida.calentar });

/** Para cerrar en las pruebas. */
export function cerrar() {
  if (hijo) {
    hijo.disconnect?.();
    hijo = null;
  }
}

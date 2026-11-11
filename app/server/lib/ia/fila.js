// La fila de las sesiones de IA, UNA para Claude (claude.js) y ChatGPT (codex.js): como mucho MAX_SESIONES a la vez en
// toda la app (ficha, guion, produccion, editor, lotes); las demas esperan su turno en orden. Y el registro de las
// sesiones activas (trabajando, consultando la cuenta o esperando turno), tambien uno solo: con eso sesionActiva(uuid) y
// cancelarSesion(uuid) sirven para las dos IA, y la prueba de humo cuenta las sesiones de lotes de las dos.
//
// Movido sin cambios de claude.js (que lo vuelve a exportar con los mismos nombres). Lo nuevo: registrarActiva,
// quitarActiva, el tope de turno() y anotarLotes (claude.js no puede cambiar maximoDeLotes desde afuera).
//
//   registrarActiva(uuid, entrada) · quitarActiva(uuid)    entrada = { control: AbortController, hijo, tipo, conTurno }
//   turno(senal, { tope }) -> Promise<boolean>   true = tiene su lugar (al terminar, soltarTurno()); false = se cancelo
//   tieneQueEsperar({ tope })                    true si turno() con ese tope esperaria ahora (para avisar "Esperando turno")
//   anotarLotes(tipo)                            despues de conseguir el turno: cuantas de lotes hubo a la vez como mucho
//   enCurso                                      cuantas tienen su lugar ahora (un numero, no una funcion)
//   sesionActiva(uuid) · sesionesEnCurso() · cancelarSesion(uuid) · matar(hijo)
import { spawn } from 'node:child_process';

const WIN = process.platform === 'win32';

// Sesiones de IA a la vez (las demas esperan su turno). La etapa 3 decide el numero con el plan del usuario.
export const MAX_SESIONES = 2;
// Las de ChatGPT, como mucho (codex.js pide turno(senal, { tope: MAX_SESIONES_CODEX })). No se sabe cuantas a la vez
// acepta su plan: si en las pruebas gratis un 429 sale mas de una vez, pasa a 1.
export const MAX_SESIONES_CODEX = 2;

export const activas = new Map(); // uuid -> { control: AbortController, hijo, tipo, conTurno }
export let enCurso = 0;
const cola = [];

/**
 * Espera su lugar. `tope`: cuantas sesiones (de cualquier IA) puede haber trabajando, contando esta, para que entre;
 * nunca mas que MAX_SESIONES. Sin tope, todo como siempre: el lugar que se libera pasa al primero de la cola.
 */
export function turno(senal, { tope = MAX_SESIONES } = {}) {
  const max = Math.max(1, Math.min(MAX_SESIONES, Number(tope) || MAX_SESIONES));
  return new Promise((resolve) => {
    if (enCurso < max) {
      enCurso++;
      return resolve(true);
    }
    const espera = { resolve, max };
    cola.push(espera);
    senal.addEventListener('abort', () => {
      const i = cola.indexOf(espera);
      if (i >= 0) cola.splice(i, 1);
      resolve(false);
    }, { once: true });
  });
}
export function soltarTurno() {
  // el lugar pasa al primero que espera y entra con su tope (sin topes, el primero de la cola)
  const i = cola.findIndex((e) => enCurso - 1 < e.max);
  const siguiente = i >= 0 ? cola.splice(i, 1)[0] : null;
  if (siguiente) siguiente.resolve(true); // el lugar pasa al que esperaba
  else enCurso = Math.max(0, enCurso - 1);
}
export const tieneQueEsperar = ({ tope = MAX_SESIONES } = {}) => enCurso >= Math.max(1, Math.min(MAX_SESIONES, Number(tope) || MAX_SESIONES));

/** Anota una sesion en el registro (antes de consultar la cuenta: desde ahi ya cuenta como activa). */
export function registrarActiva(uuid, entrada) {
  if (!entrada?.control) throw new Error('registrarActiva: falta el control de la sesion');
  activas.set(uuid, entrada);
  return entrada;
}
/** La saca del registro al terminar (con o sin turno). */
export const quitarActiva = (uuid) => activas.delete(uuid);

export const sesionActiva = (uuid) => activas.has(uuid);
// Las de los ANUNCIOS DE IMAGEN (tipo imagen-ads-…) que estan trabajando ahora, y cuantas hubo a la vez como mucho: lo
// mira la prueba de humo (nunca tiene que haber 2). Solo se cuentan; no cambian nada de como se lanzan.
const DE_LOTES = /^imagen-ads-/;
let maximoDeLotes = 0;
const lotesTrabajando = () => [...activas.values()].filter((a) => a.conTurno && DE_LOTES.test(String(a.tipo || ''))).length;
export const sesionesEnCurso = () => ({ trabajando: enCurso, esperando: cola.length, maximo: MAX_SESIONES, deLotes: lotesTrabajando(), maximoDeLotes });
/** Despues de que una sesion consigue su turno (con su entrada.conTurno = true). */
export function anotarLotes(tipo) {
  if (DE_LOTES.test(String(tipo || ''))) maximoDeLotes = Math.max(maximoDeLotes, lotesTrabajando());
}

/** Corta una sesion (con todo lo que lanzo). true si habia algo que cortar. */
export function cancelarSesion(uuid) {
  const a = activas.get(uuid);
  if (!a) return false;
  a.control.abort();
  if (a.hijo) matar(a.hijo);
  return true;
}

/** Termina un proceso y todos los que lanzo (en Windows kill() dejaria vivos sus comandos). */
export function matar(hijo) {
  if (!hijo || hijo.exitCode !== null || hijo.signalCode !== null) return; // ya termino: su numero pudo reusarse
  try {
    if (WIN && hijo.pid) spawn('taskkill', ['/pid', String(hijo.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('error', () => {});
    else hijo.kill('SIGKILL');
  } catch {
    /* ya no estaba */
  }
}

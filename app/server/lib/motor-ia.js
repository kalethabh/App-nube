// El selector de la IA: Claude (claude.js) o ChatGPT (codex.js), la que eligio el usuario. Tiene la misma forma que
// claude.js, asi que las tareas lo llaman igual: lanzarSesion(o) mira la eleccion en el momento de lanzar y la pasa a
// la IA que toca. Ninguna tarea lee la eleccion.
//
// La eleccion se guarda en app/config.json con la clave `motor` ('claude' | 'codex'); sin ella, todavia no hay IA
// elegida. NUNCA se deduce de lo que hay instalado (si Claude Code faltara un rato, el alumno no puede pasar a "Todavia
// no elegiste tu IA"). En las pruebas, AIA_MOTOR la fija sin tocar el config.
//
//   MOTORES · MENSAJE_SIN_MOTOR
//   motorElegido() · motorActual()   -> 'claude' | 'codex' | null
//   migrarMotor()                    -> { motor, migrado, error? }   quien ya vio la bienvenida usaba Claude (una vez)
//   elegirMotor(id)                  -> Promise<{ ok, elegido, anterior, cambio }>   o tira ErrorApp 400 / 409
//   datosIA(id?) · nombreIA(id?)     -> los nombres para los textos: 'Claude', 'ChatGPT' o 'tu IA'
//   lanzarSesion(o)                  -> el resultado de la IA elegida (el contrato de claude.js), con `motor`
//   estadoIA({ todos })              -> { elegido, nombre, programa, cuenta, planes, motores, instalando, login, trabajando }
//   alCambiarDeMotor(fn)             fn({ motor, anterior }) despues de guardar otra IA (lo registra el conductor)
//   alPreguntarLotesOcupados(fn)     fn() -> true si un lote de imagen esta revisando o ajustando (lo registra imagen)
//   alPreguntarInstalacion(fn)       fn() -> { motor, fase, desde, error? } | null, la instalacion en curso (la registra
//                                    quien la lanza, rutas/ia.js); estadoIA la devuelve en `instalando`
//   (los tres registradores devuelven una funcion que lo vuelve a sacar)
//   prohibidasComunes · enTerminales · describirHerramienta    de claude.js: un solo idioma de permisos, el de Claude
//   sesionesEnCurso · sesionActiva · cancelarSesion            de ia/fila.js: una sola fila para las dos IA
//
// codex.js se carga recien cuando hace falta: si no esta o no carga, Codex cuenta como no instalado y el resto anda.
// Este archivo no depende del servidor: app/inicio/preparar-motor.mjs lo usa (migrarMotor) antes de que arranque.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { leerConfig, guardarConfig } from './config.js';
import { lanzarSesion as lanzarConClaude, estadoClaude, olvidarEstadoClaude } from './claude.js';
import { activas, sesionesEnCurso } from './ia/fila.js';

export { prohibidasComunes, enTerminales, describirHerramienta } from './claude.js';
export { sesionesEnCurso, sesionActiva, cancelarSesion } from './ia/fila.js';

// ---------------------------------------------------------------- las dos IA

export const MOTORES = Object.freeze({
  claude: Object.freeze({ id: 'claude', nombre: 'Claude', programa: 'Claude Code', cuenta: 'tu cuenta de Claude', planes: 'Pro o Max' }),
  codex: Object.freeze({ id: 'codex', nombre: 'ChatGPT', programa: 'Codex', cuenta: 'tu cuenta de ChatGPT', planes: '' }),
});
// cuando todavia no se eligio ninguna
const SIN_IA = Object.freeze({ id: null, nombre: 'tu IA', programa: 'el programa de tu IA', cuenta: 'tu cuenta', planes: '' });

export const MENSAJE_SIN_MOTOR = 'Todavía no elegiste tu IA. Ve a Ajustes › Conexiones y elige Claude o ChatGPT.';
const MENSAJE_OCUPADA = 'Tu IA está escribiendo algo ahora. Espera a que termine y vuelve a intentarlo.';
const MENSAJE_ELIGE = 'Elige Claude o ChatGPT.';
const MENSAJE_SIN_CODEX = 'Falta Codex, el programa de ChatGPT, en tu PC. Ve a Ajustes › Conexiones y toca "Instalar".';

const motorValido = (id) => (typeof id === 'string' && Object.hasOwn(MOTORES, id) ? id : null);

/** La IA elegida: AIA_MOTOR (solo pruebas), si no la de config.json, si no null. Nunca la deduce. */
export function motorElegido() {
  const forzado = motorValido(String(process.env.AIA_MOTOR || '').trim().toLowerCase());
  if (forzado) return forzado;
  try {
    return motorValido(leerConfig().motor);
  } catch {
    return null;
  }
}
/** Lo mismo que motorElegido() (lo leen colas.claudeEnFila y el planificador de imagen). */
export const motorActual = () => motorElegido();

/** La entrada de MOTORES (una copia), o la de "tu IA" si no hay una. */
export function datosIA(id = motorElegido()) {
  const m = motorValido(id);
  return { ...(m ? MOTORES[m] : SIN_IA) };
}
/** 'Claude', 'ChatGPT' o 'tu IA'. */
export const nombreIA = (id = motorElegido()) => datosIA(id).nombre;

// ---------------------------------------------------------------- guardar la eleccion

/**
 * Antes de esta version solo existia Claude: quien ya paso la bienvenida usaba Claude, asi que se le guarda
 * { motor: 'claude' } una sola vez. Quien todavia no la vio no se migra (ve las dos opciones). Se puede llamar las
 * veces que sea: con un motor guardado no hace nada. (Desde esta version la bienvenida solo queda vista con una IA
 * elegida, rutas/ajustes.js: un alumno nuevo que la cierra sin elegir no se toma por uno de antes.)
 */
export function migrarMotor() {
  try {
    const config = leerConfig();
    const guardado = motorValido(config.motor);
    if (guardado) return { motor: guardado, migrado: false };
    if (config.bienvenidaVista !== true) return { motor: null, migrado: false };
    guardarConfig({ motor: 'claude' });
    return { motor: 'claude', migrado: true };
  } catch (e) {
    return { motor: null, migrado: false, error: e?.message || String(e) };
  }
}

const alCambiar = new Set();
const preguntasDeLotes = new Set();
const preguntasDeInstalacion = new Set();

const registrar = (conjunto, fn) => {
  if (typeof fn !== 'function') return () => false;
  conjunto.add(fn);
  return () => conjunto.delete(fn);
};
/** Registra quien se entera cuando se elige otra IA (el conductor: limpia la pausa de la anterior y retoma). */
export const alCambiarDeMotor = (fn) => registrar(alCambiar, fn);
/** Registra la pregunta "¿hay un lote de imagen revisando o ajustando?" (puede devolver una promesa). */
export const alPreguntarLotesOcupados = (fn) => registrar(preguntasDeLotes, fn);
/** Registra de donde sale la instalacion en curso ({ motor, fase, desde, error? } o null; puede ser una promesa). */
export const alPreguntarInstalacion = (fn) => registrar(preguntasDeInstalacion, fn);

async function lotesOcupados() {
  for (const fn of preguntasDeLotes) {
    try {
      if (await fn()) return true;
    } catch {
      /* si no se pudo mirar, no frena el cambio */
    }
  }
  return false;
}

// El error de la app (rutas/*.js lo reconocen con instanceof): se carga recien aca para no traer productos.js (y
// todo lo que importa) a preparar-motor.mjs.
let ClaseErrorApp = null;
async function claseErrorApp() {
  if (ClaseErrorApp) return ClaseErrorApp;
  try {
    ClaseErrorApp = (await import('./productos.js')).ErrorApp || null;
  } catch {
    /* sin productos.js: uno con la misma forma */
  }
  ClaseErrorApp ||= class ErrorApp extends Error {
    constructor(status, mensaje, extra = {}) {
      super(mensaje);
      this.status = status;
      Object.assign(this, extra);
    }
  };
  return ClaseErrorApp;
}

/**
 * Guarda la IA elegida ('claude' o 'codex'). No se puede cambiar mientras haya una sesion registrada en la fila
 * (trabajando, consultando la cuenta o esperando turno) o un lote de imagen revisando o ajustando: 409. Elegir la que
 * ya estaba no cambia nada.
 */
export async function elegirMotor(id) {
  const ErrorApp = await claseErrorApp();
  const motor = motorValido(id);
  if (!motor) throw new ErrorApp(400, MENSAJE_ELIGE);
  const anterior = motorValido(leerConfig().motor);
  if (motor === anterior) return { ok: true, elegido: motor, anterior, cambio: false };
  const codex = motor === 'codex' || anterior === 'codex' ? await cargarCodex() : null;
  const conLotes = await lotesOcupados();
  // (despues de la ultima espera: entre esta mirada y guardar no puede entrar otra sesion)
  if (activas.size > 0 || conLotes) throw new ErrorApp(409, MENSAJE_OCUPADA);
  guardarConfig({ motor });
  // lo que se sabia de cada cuenta se vuelve a preguntar (la pantalla y la primera sesion de la nueva)
  olvidarEstadoClaude();
  try {
    codex?.olvidarEstadoCodex?.();
  } catch {
    /* no frena */
  }
  for (const fn of alCambiar) {
    try {
      const p = fn({ motor, anterior });
      if (p && typeof p.catch === 'function') p.catch((e) => console.error(`[motor-ia] alCambiarDeMotor: ${e?.message || e}`));
    } catch (e) {
      console.error(`[motor-ia] alCambiarDeMotor: ${e?.message || e}`);
    }
  }
  return { ok: true, elegido: motor, anterior, cambio: true };
}

// ---------------------------------------------------------------- codex.js, cuando hace falta

const RUTA_CODEX = fileURLToPath(new URL('./codex.js', import.meta.url));
let modCodex = null;
let ultimoAviso = '';

/** El modulo de Codex, o null si no esta (o no carga: eso se avisa en la consola, una vez por error). */
async function cargarCodex() {
  if (modCodex) return modCodex;
  if (!fs.existsSync(RUTA_CODEX)) return null;
  try {
    modCodex = await import('./codex.js');
  } catch (e) {
    const texto = `no pude cargar codex.js: ${e?.message || e}`;
    if (texto !== ultimoAviso) console.error(`[motor-ia] ${texto}`);
    ultimoAviso = texto;
    return null;
  }
  return modCodex;
}

// ---------------------------------------------------------------- lanzar

const sinIA = (o, extra) => ({ ok: false, sinClaude: true, ...extra, sesion: o?.uuid, turnos: 0, costo: 0, frases: [] });

/** Corre la tarea con la IA elegida ahora. Mismo contrato que claude.js:lanzarSesion, mas `motor`. */
export async function lanzarSesion(o) {
  // (2026-11-20q) una tarea puede pedir su IA (las landings: «Claude Code» o «Codex»); si no, la de Ajustes
  const motor = o?.motor === 'claude' || o?.motor === 'codex' ? o.motor : motorElegido();
  let r;
  if (motor === 'claude') r = await lanzarConClaude(o);
  else if (motor === 'codex') {
    const codex = await cargarCodex();
    r = typeof codex?.lanzarSesion === 'function' ? await codex.lanzarSesion(o) : sinIA(o, { error: MENSAJE_SIN_CODEX });
  } else r = sinIA(o, { sinMotor: true, error: MENSAJE_SIN_MOTOR });
  if (r && typeof r === 'object') r.motor = motor;
  return r;
}

// ---------------------------------------------------------------- lo que ve la pantalla

const NO_SE_SABE = () => ({ instalado: false, version: null, sesion: 'desconocido' });

async function estadoDeCodex(codex) {
  if (typeof codex?.estadoCodex !== 'function') return { instalado: false, sesion: 'sin-sesion' };
  let e;
  try {
    e = await codex.estadoCodex();
  } catch {
    return NO_SE_SABE();
  }
  let enUso = false;
  try {
    enUso = Boolean(codex.codexEnUso?.()); // con sesiones de ChatGPT o un inicio de sesion abierto: no se reinstala
  } catch {
    /* no se sabe: queda en false */
  }
  return { ...e, enUso };
}

function loginDeCodex(codex, deCodex) {
  try {
    if (typeof codex?.estadoLoginCodex === 'function') return codex.estadoLoginCodex() ?? null;
  } catch {
    return null;
  }
  return deCodex?.login ?? null;
}

async function instalacionEnCurso() {
  for (const fn of preguntasDeInstalacion) {
    try {
      const i = await fn();
      if (i) return i;
    } catch {
      /* esa no se pudo mirar */
    }
  }
  return null;
}

/**
 * Para GET /api/ia/estado. Solo pregunta por la cuenta de la IA elegida (tarda); por las dos, con `todos`.
 *   motores.claude = estadoClaude() · motores.codex = estadoCodex() mas enUso (codexEnUso(): no se reinstala)
 *   instalando = lo que diga alPreguntarInstalacion: { motor, fase, desde, error? } | null
 *   login = el inicio de sesion de ChatGPT en curso, de codex.estadoLoginCodex() (o estadoCodex().login) | null
 *   trabajando = sesionesEnCurso() de la fila compartida
 */
export async function estadoIA({ todos = false } = {}) {
  const elegido = motorElegido();
  const { nombre, programa, cuenta, planes } = datosIA(elegido);
  const pedir = todos ? Object.keys(MOTORES) : elegido ? [elegido] : [];
  const codex = pedir.includes('codex') ? await cargarCodex() : null;
  // mientras se reinstala Codex no se corre `codex --version` ni `login status` (en Windows un .exe abierto no se
  // puede reemplazar, y la pantalla pregunta cada 3 s)
  const instalando = await instalacionEnCurso();
  const instalandoCodex = instalando?.motor === 'codex' && !instalando.error;
  const [deClaude, deCodex] = await Promise.all([
    pedir.includes('claude') ? Promise.resolve(estadoClaude()).catch(NO_SE_SABE) : null,
    !pedir.includes('codex') ? null : instalandoCodex ? { ...NO_SE_SABE(), enUso: false } : estadoDeCodex(codex),
  ]);
  const motores = {};
  if (deClaude) motores.claude = deClaude;
  if (deCodex) motores.codex = deCodex;
  return { elegido, nombre, programa, cuenta, planes, motores, instalando, login: loginDeCodex(codex, deCodex), trabajando: sesionesEnCurso() };
}

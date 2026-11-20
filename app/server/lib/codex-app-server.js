// La cuenta de ChatGPT (correo y plan) y los limites de uso con su hora de reinicio, por `codex app-server`. Solo
// para eso: el trabajo va siempre por `codex exec`. JSON-RPC por stdin y stdout, una linea por mensaje:
//   initialize { clientInfo } -> initialized -> account/read -> account/rateLimits/read
// y despues se cierra stdin y se mata el proceso. Tope de 8 s. Sin sesion, rateLimits responde -32600 y se devuelve
// null: la pantalla y el trabajo siguen sin esos datos (nunca se frena por una consulta que fallo).
// Una sola consulta de cuenta a la vez: app-server y `codex login status` (codex.js) pasan por cuentaEnFila, y nunca
// mientras hay un `codex login` abierto. Asi no hay dos procesos renovando la sesion a la vez.
//
//   consultarCuenta() -> { email, plan, espacio } | null   refrescarCuenta() -> lo mismo pidiendo un token nuevo (el plan al día)        limitesFrescos() -> lim | null   (sin cache: antes de cada mensaje)
//   limitesCacheados() -> lim | null  (60 s, solo para la pantalla) · olvidarLimites()
//   sinUsoOrdinario(lim) -> boolean                    horaDeReinicio(lim) -> ISO | null
//   cuentaEnFila(fn, { siHayLogin }) · cuentaLibre() · marcarLogin(abierto) · hayLoginAbierto()
//   preguntarAppServer(metodos) -> { ok, respuestas: { <metodo>: { result } | { error } }, codexHome, error? }
//
// lim = { primary, secondary: { usedPercent, windowDurationMins, resetsAt } | null, rateLimitReachedType,
//         ordinaryUsageAllowed, planType, usado (el % mas alto), ordinario, reinicio (ISO | null), leido }
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RAIZ } from './rutas.js';
import { matar } from './claude.js';
import { resolverCodex, entornoCodex, carpetasCodex, argsAppServer } from './codex-rutas.js';

const TOPE = 8000;
const RECUERDO_LIMITES = 60000;

// ---------------------------------------------------------------- de a una

let cadena = Promise.resolve();
let loginAbierto = false;

/** codex.js lo marca mientras corre un `codex login` (navegador o codigo). */
export const marcarLogin = (abierto) => {
  loginAbierto = Boolean(abierto);
};
export const hayLoginAbierto = () => loginAbierto;

/**
 * Corre `fn` cuando termina la consulta de cuenta anterior. Con un `codex login` abierto no corre: devuelve
 * `siHayLogin` (null). Lo usan app-server y `codex login status`.
 */
export function cuentaEnFila(fn, { siHayLogin = null } = {}) {
  const turno = cadena.then(() => (loginAbierto ? siHayLogin : fn()));
  cadena = turno.then(
    () => {},
    () => {}
  );
  return turno;
}

/** Se cumple cuando no queda ninguna consulta de cuenta en curso (antes de abrir un `codex login`). */
export const cuentaLibre = () => cadena;

// ---------------------------------------------------------------- app-server

function versionApp() {
  for (const f of [path.join(RAIZ, 'VERSION'), path.join(RAIZ, 'paquete-app', 'VERSION')]) {
    try {
      const v = fs.readFileSync(f, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/)[0].trim();
      if (v) return v;
    } catch {
      /* en la otra */
    }
  }
  return 'desarrollo';
}

const existeCarpeta = (d) => {
  try {
    return fs.statSync(d).isDirectory();
  } catch {
    return false;
  }
};

/**
 * Lanza `codex app-server` y pregunta `metodos` (despues de initialize). No pasa por la fila: para eso estan
 * consultarCuenta y limitesFrescos (y las pruebas). `args` y `params` ({ metodo: params }) son solo para las pruebas
 * (probar-codex.mjs --contrato compara model/list con y sin el modo rapido).
 */
export function preguntarAppServer(metodos = ['account/read', 'account/rateLimits/read'], { tope = TOPE, args = argsAppServer(), params = {} } = {}) {
  const bin = resolverCodex();
  if (!bin) return Promise.resolve({ ok: false, error: 'sin-codex', respuestas: {}, codexHome: null });
  return new Promise((resolve) => {
    const { trabajo } = carpetasCodex();
    const respuestas = {};
    const ids = new Map(); // id -> metodo
    let codexHome = null;
    let terminado = false;
    let hijo = null;
    let reloj = null;
    const fin = (extra = {}) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(reloj);
      try {
        hijo?.stdin.end();
      } catch {
        /* ya estaba cerrado */
      }
      matar(hijo);
      resolve({ ok: !extra.error, respuestas, codexHome, ...extra });
    };
    try {
      hijo = spawn(bin.cmd, [...bin.pre, ...args], { cwd: existeCarpeta(trabajo) ? trabajo : os.tmpdir(), env: entornoCodex(), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    } catch (err) {
      return resolve({ ok: false, error: err.code || err.message, respuestas, codexHome });
    }
    reloj = setTimeout(() => fin({ error: 'tiempo' }), tope);
    hijo.on('error', (err) => fin({ error: err.code || err.message }));
    hijo.on('close', () => fin(Object.keys(respuestas).length === metodos.length ? {} : { error: 'se-cerro' }));
    hijo.stdin.on('error', () => {});
    hijo.stderr.on('data', () => {}); // (avisos de Codex: no se guardan)
    const mandar = (m) => {
      try {
        hijo.stdin.write(`${JSON.stringify(m)}\n`);
      } catch {
        /* se cerro: lo dice 'close' */
      }
    };
    let buf = '';
    hijo.stdout.setEncoding('utf8'); // (una letra partida entre dos trozos espera al siguiente: no queda «�»)
    hijo.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const linea = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        let m = null;
        try {
          m = JSON.parse(linea);
        } catch {
          continue;
        }
        if (!m || typeof m !== 'object' || m.id === undefined) continue; // avisos sin id (remoteControl/status/changed…)
        if (m.id === 1) {
          if (m.error) return fin({ error: `initialize ${m.error.code ?? ''}`.trim(), errorInicial: m.error });
          codexHome = typeof m.result?.codexHome === 'string' ? m.result.codexHome : null;
          mandar({ method: 'initialized' });
          metodos.forEach((metodo, k) => {
            ids.set(k + 2, metodo);
            if (params[metodo] !== undefined) mandar({ id: k + 2, method: metodo, params: params[metodo] });
            else mandar(metodo === 'account/read' ? { id: k + 2, method: metodo, params: {} } : { id: k + 2, method: metodo });
          });
          if (!metodos.length) fin();
          continue;
        }
        if (!ids.has(m.id)) continue;
        respuestas[ids.get(m.id)] = m.error ? { error: m.error } : { result: m.result };
        if (Object.keys(respuestas).length === metodos.length) fin();
      }
    });
    mandar({ id: 1, method: 'initialize', params: { clientInfo: { name: 'anuncios-con-ia', version: versionApp() } } });
  });
}

// ---------------------------------------------------------------- la cuenta

function cuentaDe(res) {
  const a = res?.account;
  if (!a || typeof a !== 'object') return null;
  if (a.type && a.type !== 'chatgpt') return null; // (con una clave de API no hay correo ni plan: lo dice login status)
  return { email: typeof a.email === 'string' ? a.email : null, plan: typeof a.planType === 'string' ? a.planType : null, espacio: typeof a.workspaceName === 'string' && a.workspaceName.trim() ? a.workspaceName.trim() : null };
}

/** El correo y el plan de la cuenta de ChatGPT, o null (sin sesion, sin Codex, o la consulta fallo o tardo). */
export async function consultarCuenta() {
  const r = await cuentaEnFila(() => preguntarAppServer(['account/read', 'account/rateLimits/read']));
  if (!r) return null;
  guardarLimites(r); // la pantalla aprovecha la misma consulta
  const res = r.respuestas?.['account/read'];
  return res && !res.error ? cuentaDe(res.result) : null;
}

let ultimoRefresco = 0;
/** Después de iniciar o cerrar sesión: el próximo refresco va de una. */
export const olvidarRefresco = () => {
  ultimoRefresco = 0;
};
/**
 * (2026-11-20s) Le pide a ChatGPT un token NUEVO antes de leer la cuenta y los límites: el plan viaja dentro del token, así
 * que después de pagar un plan (Plus, Pro, Business…) o de cambiar de espacio de trabajo, Codex seguía viendo el de antes
 * hasta que renovara el token solo (días). A lo sumo una vez cada 2 minutos (fuerza: true lo salta).
 * -> { cuenta, lim } | null
 */
export async function refrescarCuenta({ fuerza = false } = {}) {
  if (!fuerza && Date.now() - ultimoRefresco < 120000) return null;
  ultimoRefresco = Date.now();
  const r = await cuentaEnFila(() => preguntarAppServer(['account/read', 'account/rateLimits/read'], { params: { 'account/read': { refreshToken: true } }, tope: 15000 }));
  if (!r) return null;
  cacheLim = null;
  const lim = guardarLimites(r);
  const res = r.respuestas?.['account/read'];
  return { cuenta: res && !res.error ? cuentaDe(res.result) : null, lim };
}

// ---------------------------------------------------------------- los limites

const numero = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const aMs = (s) => Number(s) * (Number(s) < 1e12 ? 1000 : 1);
const delLimite = (lim) => (lim && typeof lim.rateLimits === 'object' && lim.rateLimits ? lim.rateLimits : lim || {});

/**
 * true si ya no queda uso ordinario del plan: rateLimitReachedType, una ventana al 100 % (primary o secondary) u
 * ordinaryUsageAllowed === false. Mandar un mensaje asi gastaria creditos comprados del usuario: no se manda.
 * Acepta lo que da limitesFrescos() o la respuesta tal cual de account/rateLimits/read. Sin datos, false (se sigue).
 */
// Los planes de ESPACIO DE TRABAJO (Business, Team, Enterprise, Edu…): el uso de Codex puede salir de los créditos del
// espacio (los paga la empresa con el plan), no del uso «ordinario» de un plan personal. (2026-11-20s)
export const esPlanDeEspacio = (plan) => /^(team|business|self_serve_business|enterprise|ent\d|edu|sci)/i.test(String(plan || ''));

export function sinUsoOrdinario(lim) {
  if (!lim || typeof lim !== 'object') return false;
  const rl = delLimite(lim);
  if (rl.rateLimitReachedType !== null && rl.rateLimitReachedType !== undefined) return true;
  const plan = lim.planType || rl.planType;
  const creditos = lim.creditos || (rl.credits && typeof rl.credits === 'object' ? { hay: rl.credits.hasCredits === true, ilimitados: rl.credits.unlimited === true } : null);
  // (2026-11-20s) en un espacio de trabajo, con créditos del espacio (o sin saberlo) se deja trabajar: si de verdad no
  // queda, el propio Codex lo dice y la app lo muestra. Antes se frenaba a una cuenta Business recién pagada.
  if (esPlanDeEspacio(plan)) return Boolean(creditos && !creditos.hay && !creditos.ilimitados && [rl.primary, rl.secondary].some((v) => numero(v?.usedPercent) >= 100));
  if ([rl.primary, rl.secondary].some((v) => numero(v?.usedPercent) !== null && numero(v.usedPercent) >= 100)) return true;
  const ordinario = typeof lim.ordinaryUsageAllowed === 'boolean' ? lim.ordinaryUsageAllowed : rl.ordinaryUsageAllowed;
  return ordinario === false;
}

/**
 * Cuando se renueva el uso (ISO) o null: el resetsAt de la ventana que llego al 100 % (la mas tardia si son las dos);
 * si no quedo uso por otro motivo, el de la ventana mas usada.
 */
export function horaDeReinicio(lim) {
  if (!lim || typeof lim !== 'object') return null;
  const rl = delLimite(lim);
  const ventanas = [rl.primary, rl.secondary].filter((v) => v && numero(v.resetsAt) > 0);
  if (!ventanas.length) return null;
  let elegidas = ventanas.filter((v) => numero(v.usedPercent) >= 100);
  if (!elegidas.length) {
    if (!sinUsoOrdinario(lim)) return null;
    const mas = Math.max(...ventanas.map((v) => numero(v.usedPercent) || 0));
    elegidas = ventanas.filter((v) => (numero(v.usedPercent) || 0) === mas);
  }
  return new Date(Math.max(...elegidas.map((v) => aMs(v.resetsAt)))).toISOString();
}

function normalizarLimites(r) {
  if (!r || typeof r !== 'object') return null;
  const rl = r.rateLimits && typeof r.rateLimits === 'object' ? r.rateLimits : {};
  const ventana = (v) => (v && typeof v === 'object' ? { usedPercent: numero(v.usedPercent), windowDurationMins: numero(v.windowDurationMins), resetsAt: numero(v.resetsAt) } : null);
  const ordinario = typeof r.ordinaryUsageAllowed === 'boolean' ? r.ordinaryUsageAllowed : typeof rl.ordinaryUsageAllowed === 'boolean' ? rl.ordinaryUsageAllowed : null;
  const lim = {
    primary: ventana(rl.primary),
    secondary: ventana(rl.secondary),
    rateLimitReachedType: rl.rateLimitReachedType ?? null,
    ordinaryUsageAllowed: ordinario,
    planType: typeof rl.planType === 'string' ? rl.planType : null,
    creditos: rl.credits && typeof rl.credits === 'object' ? { hay: rl.credits.hasCredits === true, ilimitados: rl.credits.unlimited === true, saldo: rl.credits.balance ?? null } : null,
    leido: new Date().toISOString(),
  };
  const usados = [lim.primary, lim.secondary].map((v) => v?.usedPercent).filter((v) => v !== null && v !== undefined);
  lim.usado = usados.length ? Math.max(...usados) : null;
  lim.ordinario = !sinUsoOrdinario(lim);
  lim.reinicio = horaDeReinicio(lim);
  return lim;
}

let cacheLim = null; // { t, lim, promesa }

// Lo que dio una consulta, tambien para la pantalla (si hay una consulta de la pantalla en curso, la guarda ella).
function guardarLimites(r) {
  const res = r?.respuestas?.['account/rateLimits/read'];
  const lim = res && !res.error && res.result ? normalizarLimites(res.result) : null;
  if (r && !cacheLim?.promesa) cacheLim = { t: Date.now(), lim, promesa: null };
  return lim;
}

/** Que la pantalla vuelva a preguntar (despues de iniciar o cerrar sesion). */
export const olvidarLimites = () => {
  cacheLim = null;
};

/**
 * Los limites de ahora, sin cache: codex.js los pide antes de cada mensaje (exec y resume). null si no se pudo saber
 * (sin sesion, la consulta fallo o tardo mas de 8 s): en ese caso se sigue.
 */
export async function limitesFrescos() {
  const r = await cuentaEnFila(() => preguntarAppServer(['account/rateLimits/read']));
  return guardarLimites(r);
}

/** Para la pantalla: los de hace menos de 60 s (10 s si no se supieron); si no, una consulta nueva compartida. */
export function limitesCacheados() {
  if (cacheLim?.promesa) return cacheLim.promesa;
  if (cacheLim && Date.now() - cacheLim.t < (cacheLim.lim ? RECUERDO_LIMITES : 10000)) return Promise.resolve(cacheLim.lim);
  const promesa = limitesFrescos().catch(() => null);
  cacheLim = { t: 0, lim: null, promesa };
  promesa.then((lim) => {
    if (cacheLim?.promesa === promesa) cacheLim = { t: Date.now(), lim, promesa: null };
  });
  return promesa;
}

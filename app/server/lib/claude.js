// Lanzador de Claude Code: el binario oficial que instalo el usuario, sin modificar, en modo headless (-p) y con el
// login de SU cuenta de Claude (Pro o Max). Nunca con una clave de API de Anthropic y nunca con --bare (con --bare
// Claude Code no lee el login de la cuenta, solo una clave). La app no lee ni guarda credenciales: si hay sesion lo
// dice `claude auth status`, y el login lo hace Claude Code en su propia ventana (`claude auth login`).
//
// Copiado de Landing Studio (Automatizacion Landing Page/app/lib/claude.js y procesos.js) con estos ajustes:
//   - claude.exe sin shell; si solo esta el claude.cmd de npm, se abre lo que ese .cmd lanza (tambien sin shell).
//   - el entorno sin ninguna variable ANTHROPIC_* ni CLAUDE_* (si la app se abrio desde otra sesion de Claude Code,
//     heredaria CLAUDE_CODE_SIMPLE=1, que es --bare, y ANTHROPIC_BASE_URL), ni las claves del motor. Solo se agrega
//     CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR=1: la terminal vuelve a la raiz despues de cada comando.
//   - -p con stream-json de ida y vuelta, --permission-mode dontAsk y --permission-prompts none: lo que no esta
//     permitido se rechaza solo, nadie contesta preguntas de permisos.
//   - --session-id <uuid> propio (o --resume <uuid>) para poder pedir cambios en la misma conversacion.
//   - --append-system-prompt con el texto MODO APP (app/server/claude/modo-app.md).
//   - --allowedTools / --disallowedTools con las reglas en Bash Y en PowerShell (en Windows Claude usa las dos).
//   - --setting-sources project: los permisos que el usuario tenga en su ~/.claude/settings.json no entran, y tampoco
//     los de .claude/settings.local.json (Claude Code lo escribe solo cuando alguien que trabaja en esta carpeta
//     elige "no volver a preguntar": esas aprobaciones no pueden valer en las sesiones de la app).
//   - --strict-mcp-config: sin conectores (ni los de claude.ai): estas tareas no los necesitan. La excepcion es una
//     tarea con o.conectores (la busqueda de "Mejores anuncios" en TrendTrack, lib/ganadores.js): sin ese flag
//     aparecen los conectores de claude.ai del usuario, pero con --permission-mode dontAsk solo corre lo que esa
//     tarea permite en o.permitidas (las herramientas de lectura que necesita); todo lo demas se rechaza solo.
//   - el aviso de limite de uso reconoce "You've hit your session/weekly/Opus limit" (el de Landing Studio no).
//   - plazos: sin salida durante un rato largo = colgado; tope total por tarea. Cancelar = taskkill /T /F.
//
// Lo que Claude entrega es un ARCHIVO, no el texto de su respuesta: `verificar` (de quien lanza la sesion) lo revisa
// contra su esquema. Si no pasa, se le dice a Claude en la misma sesion que lo corrija (una vez); si sigue sin pasar,
// la sesion cuenta como fallida.
//
//   lanzarSesion({ tipo, cwd, uuid, resume, prompt, permitidas, prohibidas, alProgreso, timeoutMs, ... })
//     -> Promise<{ ok, resultado?, error?, limite?, reinicio?, sinSesion?, cancelado?, turnos, costo, uso, ... }>
//   cancelarSesion(uuid) · sesionActiva(uuid) · estadoClaude() · abrirLogin()
//   validarEsquema(valor, esquema) · cargarEsquema(nombre) · textoClaude(nombre, valores)
//
// La fila de 2 sesiones a la vez y el registro de las activas estan en ia/fila.js (los comparte con codex.js); de aca
// se vuelven a exportar con los mismos nombres (MAX_SESIONES, sesionActiva, sesionesEnCurso, cancelarSesion, matar).
import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { APP, RAIZ } from './rutas.js';
import { MAX_SESIONES, activas, enCurso, turno, soltarTurno, anotarLotes, sesionActiva, sesionesEnCurso, cancelarSesion, matar } from './ia/fila.js';

export { MAX_SESIONES, sesionActiva, sesionesEnCurso, cancelarSesion, matar };

const WIN = process.platform === 'win32';
export const DIR_CLAUDE = path.join(APP, 'server', 'claude'); // modo-app.md, tarea-*.md y esquemas/

// La version mas vieja que tiene --permission-prompts (sin eso Claude podria quedarse esperando una respuesta).
export const VERSION_MINIMA = '2.1.259';

// ---------------------------------------------------------------- entorno

// Las unicas variables de Claude que pasan: donde guarda su configuracion (si el usuario la movio) y su terminal.
const QUEDAN = new Set(['CLAUDE_CONFIG_DIR', 'CLAUDE_CODE_GIT_BASH_PATH', 'CLAUDE_CODE_USE_POWERSHELL_TOOL']);
// Lo del motor no le sirve a Claude (y asi ninguna clave queda escrita en su registro).
export const DEL_MOTOR = /^(KIE_|ELEVENLABS_|APIMART_|SUNO_|ANUNCIOS_MODO_PRUEBA$|NODE_USE_ENV_PROXY$|HTTPS?_PROXY$|NO_PROXY$)/i;

/** El entorno de Claude: el de la app sin nada que cambie la credencial (siempre el login de la cuenta). */
export function entornoHijo(extra = {}) {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    const K = k.toUpperCase();
    if (QUEDAN.has(K)) continue;
    if (K.startsWith('ANTHROPIC_') || K.startsWith('CLAUDE_') || K === 'CLAUDECODE' || K === 'AWS_BEARER_TOKEN_BEDROCK' || DEL_MOTOR.test(K)) delete env[k];
  }
  for (const [k, v] of Object.entries(extra || {})) {
    if (v === null || v === undefined) delete env[k];
    else env[k] = String(v);
  }
  return env;
}

// ---------------------------------------------------------------- donde esta claude

const SEP_PATH = WIN ? ';' : ':';

function carpetasDelPath() {
  const dirs = String(process.env.PATH || process.env.Path || '').split(SEP_PATH).filter(Boolean);
  // donde lo deja el instalador oficial y donde npm deja sus comandos, por si la app se abrio sin ellos en el PATH
  const extra = WIN
    ? [path.join(os.homedir(), '.local', 'bin'), process.env.APPDATA && path.join(process.env.APPDATA, 'npm')]
    : [path.join(os.homedir(), '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin'];
  for (const d of extra) if (d && !dirs.includes(d)) dirs.push(d);
  return dirs;
}

function buscar(nombre) {
  for (const dir of carpetasDelPath()) {
    const ruta = path.join(dir, nombre);
    try {
      if (fs.statSync(ruta).isFile()) return ruta;
    } catch {
      /* no esta aca */
    }
  }
  return null;
}

// El claude.cmd que deja `npm i -g @anthropic-ai/claude-code` solo lanza otra cosa: un cli.js con node, o un
// claude.exe. Se lanza eso directo (sin cmd.exe: cmd rompe los argumentos con saltos de linea o comillas).
export function destinoDelCmd(rutaCmd) {
  let texto = '';
  try {
    texto = fs.readFileSync(rutaCmd, 'utf8');
  } catch {
    return null;
  }
  // (el shim de npm nombra tambien "%dp0%\node.exe", el node que trae al lado si lo hay: ese no es claude)
  for (const r of texto.matchAll(/"%~?dp0%?\\([^"]+?\.(?:js|cjs|mjs|exe))"/gi)) {
    if (/^node\.exe$/i.test(r[1])) continue;
    const destino = path.join(path.dirname(rutaCmd), r[1]);
    if (!fs.existsSync(destino)) continue;
    return /\.exe$/i.test(destino) ? { cmd: destino, pre: [], via: 'npm-exe' } : { cmd: process.execPath, pre: [destino], via: 'npm-js' };
  }
  return null;
}

let cacheBin = null; // { t, valor }

/** Que la proxima vez se vuelva a buscar claude (Ajustes > Tu PC > "Volver a revisar"). */
export function olvidarClaude() {
  cacheBin = null;
}

/**
 * Como se lanza claude en esta PC: { cmd, pre: [argumentos antes de los nuestros], via } o null si no esta.
 * ANUNCIOS_CLAUDE_BIN (solo pruebas): otro ejecutable, o un .js que imita a Claude Code (se corre con este Node).
 */
export function resolverClaude() {
  const forzado = process.env.ANUNCIOS_CLAUDE_BIN;
  if (forzado) return /\.[cm]?js$/i.test(forzado) ? { cmd: process.execPath, pre: [forzado], via: 'prueba' } : { cmd: forzado, pre: [], via: 'prueba' };
  if (cacheBin && Date.now() - cacheBin.t < 60000) return cacheBin.valor;
  let valor = null;
  if (WIN) {
    const exe = buscar('claude.exe');
    if (exe) valor = { cmd: exe, pre: [], via: 'exe' };
    else {
      const cmd = buscar('claude.cmd');
      if (cmd) valor = destinoDelCmd(cmd) || { cmd: process.env.ComSpec || 'cmd.exe', pre: ['/d', '/s', '/c', cmd], via: 'cmd' };
    }
  } else {
    const bin = buscar('claude');
    if (bin) valor = { cmd: bin, pre: [], via: 'bin' };
  }
  cacheBin = { t: Date.now(), valor };
  return valor;
}

// Con cmd.exe de por medio (ultimo recurso) los saltos de linea cortan el comando: se pasan como espacios.
const argumentoSeguro = (bin, a) => (bin?.via === 'cmd' ? String(a).replace(/\r?\n+/g, ' ').replace(/"/g, "'") : String(a));

function correrCorto(args, { timeout = 20000 } = {}) {
  const bin = resolverClaude();
  if (!bin) return Promise.resolve({ err: { code: 'ENOENT' }, stdout: '', stderr: '' });
  return new Promise((resolve) => {
    execFile(bin.cmd, [...bin.pre, ...args], { cwd: RAIZ, env: entornoHijo(), timeout, windowsHide: true, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) =>
      resolve({ err, stdout: String(stdout || ''), stderr: String(stderr || '') })
    );
  });
}

// ---------------------------------------------------------------- estado de la cuenta

const compararVersion = (a, b) => {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
};

let cacheEstado = null; // { t, valor, promesa }
export const olvidarEstadoClaude = () => {
  cacheEstado = null;
};
// CAMBIAR DE CUENTA (2026-11-19g): después de abrir el inicio de sesión, la cuenta se vuelve a mirar cada pocos
// segundos durante 10 min (no cada 10: así se nota enseguida la cuenta nueva), y cuando entra OTRA cuenta se avisa
// (el conductor saca la pausa por límite de uso y sigue con los anuncios que esperaban)
const MIRAR_DESPUES_DEL_LOGIN_MS = 10 * 60000;
let loginAbierto = 0;
let ultimoEmail = null;
const alCambiarCuenta = new Set();
/** fn({ antes, ahora }) cuando la cuenta de Claude Code pasa a ser otra. Devuelve la función para dejar de escuchar. */
export function alCambiarCuentaClaude(fn) {
  alCambiarCuenta.add(fn);
  return () => alCambiarCuenta.delete(fn);
}
function anotarCuenta(valor) {
  const email = valor?.sesion === 'ok' ? valor.cuenta?.email || null : null;
  if (!email) return;
  const antes = ultimoEmail;
  ultimoEmail = email;
  if (!antes || antes === email) return;
  console.log('[claude] Entró otra cuenta de Claude.');
  for (const fn of alCambiarCuenta) {
    try {
      fn({ antes, ahora: email });
    } catch {
      /* quien escucha no frena */
    }
  }
}

/**
 * { instalado, version, sesion: "ok" | "sin-sesion" | "desconocido", cuenta?: { email, plan }, actualizar?, motivo? }
 * Se guarda un rato y las consultas simultaneas comparten el mismo `claude auth status`. Con la sesion iniciada, 10
 * min, y mientras hay una sesion de Claude trabajando no se vuelve a preguntar (esa sesion ya prueba la cuenta):
 * consultar la cuenta cada pocos segundos al lado de sesiones abiertas puede cruzarse con la renovacion del inicio de
 * sesion. Sin sesion, 10 s (para notar enseguida cuando el usuario la inicia; "Iniciar sesion" la olvida igual).
 * Si una sesion falla porque la cuenta no tiene la sesion iniciada, se olvida en el acto (correr()).
 */
export function estadoClaude() {
  if (cacheEstado?.promesa) return cacheEstado.promesa;
  const conSesion = cacheEstado?.valor?.sesion === 'ok';
  const recienLogin = Date.now() - loginAbierto < MIRAR_DESPUES_DEL_LOGIN_MS;
  if (cacheEstado && conSesion && enCurso > 0 && !recienLogin) return Promise.resolve(cacheEstado.valor);
  if (cacheEstado && Date.now() - cacheEstado.t < (recienLogin ? 4000 : conSesion ? 10 * 60000 : 10000)) return Promise.resolve(cacheEstado.valor);
  const promesa = consultarEstado().catch(() => ({ instalado: false, version: null, sesion: 'desconocido' }));
  cacheEstado = { t: 0, valor: null, promesa };
  promesa.then((valor) => {
    if (cacheEstado?.promesa === promesa) cacheEstado = { t: Date.now(), valor, promesa: null };
    anotarCuenta(valor);
  });
  return promesa;
}

async function consultarEstado() {
  const v = await correrCorto(['--version'], { timeout: 15000 });
  if (v.err && (v.err.code === 'ENOENT' || !resolverClaude())) return { instalado: false, version: null, sesion: 'sin-sesion', motivo: 'Falta Claude Code en tu PC.' };
  const version = (v.stdout.match(/\d+\.\d+\.\d+/) || [])[0] || null;
  const base = { instalado: true, version };
  if (version && compararVersion(version, VERSION_MINIMA) < 0) {
    base.actualizar = true;
    base.motivo = `Tu Claude Code es la versión ${version}: actualízalo (claude update) para que la app pueda usarlo.`;
  }
  const a = await correrCorto(['auth', 'status'], { timeout: 20000 });
  let j = null;
  try {
    j = JSON.parse(a.stdout.slice(a.stdout.indexOf('{')));
  } catch {
    return { ...base, sesion: 'desconocido' };
  }
  if (j.loggedIn && j.authMethod === 'claude.ai') {
    return { ...base, sesion: 'ok', cuenta: { email: j.email || null, plan: j.subscriptionType || null, organizacion: j.orgName || null } };
  }
  if (j.loggedIn) {
    // hay sesion, pero con una clave de API o una cuenta de consola: la app necesita la cuenta de Claude (Pro o Max)
    return { ...base, sesion: 'sin-sesion', otraCuenta: true, motivo: 'Tu Claude Code entró con una clave de API, no con tu cuenta de Claude. Inicia sesión con tu cuenta (Pro o Max).' };
  }
  return { ...base, sesion: 'sin-sesion' };
}

/**
 * Abre el inicio de sesion oficial de Anthropic en una ventana de terminal (la app no toca tokens). Con
 * `cambiar`, primero cierra la sesion que tiene Claude Code (`claude auth logout`) para entrar con OTRA cuenta (la del
 * programa de escritorio de Claude es aparte: Claude Code guarda la suya).
 */
export function abrirLogin({ cambiar = false } = {}) {
  olvidarEstadoClaude();
  loginAbierto = Date.now();
  const env = entornoHijo();
  const bin = resolverClaude();
  if (bin?.via === 'prueba') {
    const pasos = cambiar ? [['auth', 'logout'], ['auth', 'login']] : [['auth', 'login']];
    const correr = (i) => {
      if (i >= pasos.length) return;
      const h = spawn(bin.cmd, [...bin.pre, ...pasos[i]], { env, detached: true, stdio: 'ignore' });
      h.on('error', () => {});
      h.on('exit', () => correr(i + 1));
      h.unref();
    };
    correr(0);
    return true;
  }
  if (WIN) {
    // Una ventana de consola que queda abierta (cmd /k) con el login oficial. La linea se arma a mano
    // (windowsVerbatimArguments): Node escaparia las comillas con \" y cmd no las entiende. Con claude.exe va su ruta
    // entera entre comillas (puede no estar en el PATH, o tener espacios); con el claude.cmd de npm, por su nombre.
    const claudeWin = bin?.via === 'exe' ? `"${bin.cmd}"` : 'claude';
    const comando = cambiar ? `${claudeWin} auth logout & ${claudeWin} auth login` : `${claudeWin} auth login`;
    spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'start', '""', 'cmd', '/k', comando], { env, detached: true, stdio: 'ignore', windowsHide: false, windowsVerbatimArguments: true })
      .on('error', () => {})
      .unref();
    return true;
  }
  if (process.platform === 'darwin') {
    // una ventana de Terminal con un .command propio (sin AppleScript: no pide permisos de automatizacion)
    try {
      const archivo = path.join(os.tmpdir(), 'anuncios-ia-iniciar-sesion.command');
      const q = (t) => `'${String(t).replace(/'/g, "'\\''")}'`;
      const texto = [
        '#!/bin/bash',
        'unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN ANTHROPIC_BASE_URL CLAUDE_CODE_OAUTH_TOKEN CLAUDE_CODE_SIMPLE',
        ...(cambiar ? ['echo "Cerrando la sesión de la cuenta anterior en Claude Code..."', `${q(bin?.cmd || 'claude')} auth logout`, 'echo', 'echo "Ahora entra con la otra cuenta de Claude:"'] : []),
        `${q(bin?.cmd || 'claude')} auth login`,
        'echo',
        'echo "Listo. Vuelve a Kads Studio; ya puedes cerrar esta ventana."',
        '',
      ].join('\n');
      fs.writeFileSync(archivo, texto, { encoding: 'utf8', mode: 0o755 });
      spawn('open', ['-a', 'Terminal', archivo], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
      return true;
    } catch {
      return false;
    }
  }
  if (!bin) return false;
  if (cambiar) {
    const h = spawn(bin.cmd, [...bin.pre, 'auth', 'logout'], { env, stdio: 'ignore' });
    h.on('error', () => {});
    h.on('exit', () => spawn(bin.cmd, [...bin.pre, 'auth', 'login'], { env, detached: true, stdio: 'ignore' }).on('error', () => {}).unref());
    return true;
  }
  spawn(bin.cmd, [...bin.pre, 'auth', 'login'], { env, detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  return true;
}

// ---------------------------------------------------------------- textos (modo-app.md, tarea-*.md) y esquemas

const cacheArchivos = new Map(); // ruta -> { marca, valor }

function leerConCache(ruta, convertir) {
  const st = fs.statSync(ruta);
  const marca = `${st.mtimeMs}:${st.size}`;
  const c = cacheArchivos.get(ruta);
  if (c?.marca === marca) return c.valor;
  const valor = convertir(fs.readFileSync(ruta, 'utf8').replace(/^﻿/, ''));
  cacheArchivos.set(ruta, { marca, valor });
  return valor;
}

/** El texto MODO APP (va como --append-system-prompt en todas las sesiones). */
export const textoModoApp = () => leerConCache(path.join(DIR_CLAUDE, 'modo-app.md'), (t) => t.trim());

/**
 * Un texto de app/server/claude/<nombre>.md con sus {{marcas}} reemplazadas. Las lineas que empiezan con "<!--" son
 * notas para Diego y no se mandan.
 */
export function textoClaude(nombre, valores = {}) {
  const crudo = leerConCache(path.join(DIR_CLAUDE, `${nombre}.md`), (t) => t);
  const sinNotas = crudo.replace(/<!--[\s\S]*?-->\s*/g, '');
  return sinNotas
    .replace(/\{\{(\w+)\}\}/g, (todo, clave) => (Object.hasOwn(valores, clave) ? String(valores[clave] ?? '') : todo))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** El esquema app/server/claude/esquemas/<nombre>.json. */
export const cargarEsquema = (nombre) => leerConCache(path.join(DIR_CLAUDE, 'esquemas', `${nombre}.json`), (t) => JSON.parse(t));

const tipoDe = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
const encaja = (v, tipo) => (tipo === 'number' ? typeof v === 'number' && Number.isFinite(v) : tipo === 'integer' ? Number.isInteger(v) : tipoDe(v) === tipo);

/**
 * Valida contra un JSON Schema (lo que usan los esquemas de la app: type, enum, const, required, properties,
 * additionalProperties, items, min/maxItems, min/maxLength, minimum/maximum, pattern). Devuelve la lista de
 * errores en espanol ([] = valido).
 */
export function validarEsquema(valor, esquema, donde = '', errores = []) {
  const aqui = donde || 'el archivo';
  if (!esquema || typeof esquema !== 'object') return errores;
  if (esquema.type) {
    const tipos = Array.isArray(esquema.type) ? esquema.type : [esquema.type];
    if (!tipos.some((t) => encaja(valor, t))) {
      errores.push(`${aqui}: tiene que ser ${tipos.map((t) => NOMBRE_TIPO[t] || t).join(' o ')}`);
      return errores;
    }
  }
  if (esquema.const !== undefined && valor !== esquema.const) errores.push(`${aqui}: tiene que ser ${JSON.stringify(esquema.const)}`);
  if (Array.isArray(esquema.enum) && !esquema.enum.includes(valor)) errores.push(`${aqui}: tiene que ser uno de ${esquema.enum.map((x) => JSON.stringify(x)).join(', ')}`);
  if (typeof valor === 'string') {
    if (typeof esquema.minLength === 'number' && valor.trim().length < esquema.minLength) errores.push(`${aqui}: está vacío`);
    if (typeof esquema.maxLength === 'number' && valor.length > esquema.maxLength) errores.push(`${aqui}: es demasiado largo (máximo ${esquema.maxLength} caracteres)`);
    if (esquema.pattern && !new RegExp(esquema.pattern).test(valor)) errores.push(`${aqui}: no tiene la forma esperada`);
  }
  if (typeof valor === 'number') {
    if (typeof esquema.minimum === 'number' && valor < esquema.minimum) errores.push(`${aqui}: tiene que ser ${esquema.minimum} o más`);
    if (typeof esquema.maximum === 'number' && valor > esquema.maximum) errores.push(`${aqui}: tiene que ser ${esquema.maximum} o menos`);
  }
  if (Array.isArray(valor)) {
    if (typeof esquema.minItems === 'number' && valor.length < esquema.minItems) errores.push(`${aqui}: necesita al menos ${esquema.minItems}`);
    if (typeof esquema.maxItems === 'number' && valor.length > esquema.maxItems) errores.push(`${aqui}: tiene más de ${esquema.maxItems}`);
    if (esquema.items) valor.forEach((x, i) => validarEsquema(x, esquema.items, `${donde}[${i}]`, errores));
  }
  if (tipoDe(valor) === 'object') {
    for (const r of esquema.required || []) if (!Object.hasOwn(valor, r) || valor[r] === undefined) errores.push(`${donde ? `${donde}.` : ''}${r}: falta`);
    const props = esquema.properties || {};
    for (const [k, v] of Object.entries(valor)) {
      const sub = donde ? `${donde}.${k}` : k;
      if (props[k]) validarEsquema(v, props[k], sub, errores);
      else if (esquema.additionalProperties === false) errores.push(`${sub}: no va en este archivo`);
      else if (esquema.additionalProperties && typeof esquema.additionalProperties === 'object') validarEsquema(v, esquema.additionalProperties, sub, errores);
    }
  }
  return errores;
}
const NOMBRE_TIPO = { string: 'un texto', number: 'un número', integer: 'un número entero', boolean: 'sí o no (true/false)', array: 'una lista', object: 'un objeto', null: 'null' };

/** Lee un JSON escrito por Claude y lo valida: { ok, datos?, errores[] }. */
export function leerYValidar(ruta, nombreEsquema) {
  let texto;
  try {
    texto = fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '');
  } catch {
    return { ok: false, errores: [`No existe ${path.basename(ruta)}: tienes que escribirlo.`] };
  }
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch (e) {
    return { ok: false, errores: [`${path.basename(ruta)} no es JSON válido (${e.message}). Revisa comillas dobles y comas.`] };
  }
  const errores = validarEsquema(datos, cargarEsquema(nombreEsquema)).map((e) => `${path.basename(ruta)} → ${e}`);
  return { ok: errores.length === 0, datos, errores };
}

// ---------------------------------------------------------------- permisos

// Scripts del motor que cobran, llaman a un servicio o cargan la PC. Claude nunca los corre (los corre la app).
// Ninguna regla lleva el slug del anuncio: un producto que se llame "producir" no puede tapar su propio validar.
const SCRIPTS_PROHIBIDOS = [
  'generar-', 'producir', 'rehacer-toma', 'test-imagen', 'variante-gancho', 'continuidad', 'revisar-voces', 'revisar-videos',
  'lineas-habladas', 'subtitulos', 'cortar-cola-ugc', 'recortar-', 'ensamblar', 'planear-montaje', 'extraer-frames', 'nivelar-voz',
  'tiempos-cancion', 'estimar-video', 'preparar-producto', 'skills-sync', 'verificar', 'voces', 'kie-client', 'pista-fija', 'suno-retomable', 'exportar-edicion',
];

function scriptsNpm() {
  try {
    return Object.keys(JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).scripts || {});
  } catch {
    return ['imagenes', 'videos', 'producir', 'audio', 'musica', 'cancion', 'rehacer', 'continuidad', 'recortar', 'voz', 'lineas'];
  }
}

/** La misma regla de comando para la terminal Bash y para PowerShell (en Windows Claude usa cualquiera de las dos). */
export const enTerminales = (...patrones) => patrones.flatMap((p) => [`Bash(${p})`, `PowerShell(${p})`]);

// Los comandos de solo lectura que Claude Code deja pasar sin preguntar aunque no esten permitidos (en dontAsk
// tambien): con ellos se leeria cualquier archivo del proyecto (el .env, los anuncios de otros) sin pasar por las
// reglas Read(...). Ninguna tarea los necesita: la unica terminal que se usa es el comando exacto que nombra la tarea.
const LECTURA_EN_TERMINAL = [
  'cat', 'type', 'head', 'tail', 'more', 'less', 'wc', 'ls', 'dir', 'tree', 'find', 'findstr', 'grep', 'egrep', 'fgrep', 'rg',
  'sed', 'awk', 'cut', 'sort', 'uniq', 'strings', 'od', 'xxd', 'hexdump', 'base64', 'nl', 'tac', 'rev', 'diff', 'cmp', 'file',
  'stat', 'du', 'jq', 'xargs', 'where', 'which', 'Get-Content', 'get-content', 'gc', 'Get-ChildItem', 'get-childitem', 'gci',
  'Get-Item', 'get-item', 'gi', 'Select-String', 'select-string', 'sls', 'Format-Hex', 'Import-Csv', 'Resolve-Path', 'Test-Path',
];

/** Lo que ninguna sesion de la app puede hacer (gana sobre cualquier permiso del proyecto). */
export function prohibidasComunes({ terminal = true } = {}) {
  // (escribir fuera de la carpeta de la tarea ya lo rechaza dontAsk; estas son por si el proyecto tiene permisos de mas)
  // Leer: ni las claves (las de este proyecto ni las de otra carpeta de la PC: Glob y Grep van sin carpeta), ni el
  // codigo del motor ni el de Remotion (Read manda tambien sobre Glob y Grep). La carpeta app/ no se nombra: cada
  // anuncio tiene la suya (temp/<slug>/app/) y Claude la tiene que leer.
  // Escribir: ningun archivo que Node pueda correr (ni un produccion/ de mentira dentro de la carpeta del anuncio): el
  // unico comando permitido es `node produccion/...` y tiene que ser siempre el del motor.
  const r = [
    'WebFetch', 'WebSearch', 'Skill', 'NotebookEdit', 'Read(./.env)', 'Read(./**/.env*)', 'Read(//**/.env*)', 'Read(//**/.ENV*)', 'Read(~/.claude/**)',
    'Read(./produccion/**)', 'Read(./remotion/**)', 'Read(./node_modules/**)',
    'Edit(./.env)', 'Edit(./.claude/**)', 'Edit(./produccion/**)',
    'Edit(./**/produccion/**)', 'Edit(./**/*.js)', 'Edit(./**/*.mjs)', 'Edit(./**/*.cjs)', 'Edit(./**/package.json)', 'Edit(./**/.claude/**)',
  ];
  if (!terminal) return [...r, 'Bash', 'PowerShell'];
  return [
    ...r,
    ...LECTURA_EN_TERMINAL.flatMap((c) => enTerminales(c, `${c} *`)),
    ...enTerminales('*.env*', '*credentials*', '*.claude/*', '*.claude\\*'),
    ...enTerminales('git *', 'curl *', 'wget *', 'Invoke-WebRequest *', 'Invoke-RestMethod *', 'iwr *', 'irm *', 'Start-Process *'),
    ...SCRIPTS_PROHIBIDOS.flatMap((s) => enTerminales(`*produccion/${s}*`, `*produccion\\${s}*`)),
    ...scriptsNpm().flatMap((s) => enTerminales(`npm run ${s}*`)),
    // Lo que hace correr otro codigo que el que nombra el comando: npm entero (sus opciones precargan modulos o usan
    // otro package.json), npx y parecidos, node con opciones antes del script (-e, -r, --import…), NODE_OPTIONS y
    // otra terminal dentro de la terminal. Ninguna tarea los necesita: validar va con su comando exacto.
    ...enTerminales('npm *', 'npx *', 'pnpm *', 'yarn *', 'bun *', 'node -*', '*NODE_OPTIONS*', 'env *', 'cmd *', 'cmd.exe *', 'powershell*', 'pwsh*', 'bash *', 'sh *'),
    // Cambiar de carpeta: `node produccion/validar-manifiesto.js ...` desde otra carpeta correria otro archivo con
    // ese nombre. La terminal vuelve sola a la raiz despues de cada comando (correr(): MAINTAIN_PROJECT_WORKING_DIR).
    ...enTerminales('cd', 'cd*', 'chdir*', 'pushd*', 'popd*', 'sl', 'sl *', 'Set-Location*', 'set-location*', 'Push-Location*', 'push-location*', 'Pop-Location*', 'pop-location*'),
  ];
}

// ---------------------------------------------------------------- avance en palabras simples

const IMAGEN = /\.(png|jpe?g|webp|gif)$/i;

/** Lo que esta haciendo Claude, en una frase para el usuario (sin rutas, sin nombres de herramientas). null = nada. */
export function describirHerramienta(nombre, e = {}) {
  const ruta = String(e.file_path || e.notebook_path || e.path || '').replace(/\\/g, '/');
  const archivo = ruta.split('/').pop() || '';
  // Los anuncios de imagen (sus lotes son temp/_img-…, y su skill anuncios-imagen-ads): frases propias. Ningun video
  // tiene estos archivos, asi que para los videos todo sigue igual.
  if (nombre === 'Read' && /\.claude\/skills\/anuncios-imagen-ads\//.test(ruta)) {
    if (/\/formatos\//.test(ruta)) return 'Eligiendo el formato de cada anuncio';
    if (archivo === 'angulos.json') return 'Eligiendo los ángulos de venta';
  }
  if (/(^|\/)temp\/_img-[^/]+\//.test(ruta)) {
    if (nombre === 'Read') {
      if (/\/revision\/V\d{2,3}_(1x1|9x16)_(r\d|vista)\.(png|jpe?g)$/i.test(ruta)) return 'Leyendo los textos de cada imagen';
      if (archivo === 'plan.json') return 'Repasando el plan del lote';
      if (/^V\d{2,3}\.json$/.test(archivo)) return 'Repasando cada anuncio';
    } else if (nombre === 'Write' || nombre === 'Edit' || nombre === 'MultiEdit') {
      if (archivo === 'plan.json') return 'Armando el plan del lote';
      if (archivo === 'estrategia.json') return 'Armando la estrategia';
      if (archivo === 'producto.json') return 'Anotando lo que sabe de tu producto';
      if (/^V\d{2,3}\.json$/.test(archivo)) return nombre === 'Write' ? 'Escribiendo cada anuncio' : 'Ajustando un anuncio';
      if (/^R\d{3}\.json$/.test(archivo)) return 'Anotando lo que vio en las imágenes';
      if (/^A\d{3}\.json$/.test(archivo)) return 'Preparando los cambios que pediste';
    }
  }
  if (nombre === 'Read') {
    if (/\.claude\/skills\//.test(ruta)) return 'Leyendo las instrucciones del estilo';
    if (/\/recursos\/esqueletos\//.test(ruta)) return 'Mirando los esqueletos del catálogo';
    if (IMAGEN.test(ruta)) {
      // los cuadros que se sacan de cada clip para revisarlo (qa/), las imagenes del anuncio, o las fotos del producto
      if (/\/qa\//.test(ruta)) return 'Mirando los cuadros de los clips';
      if (/\/_productos\//.test(ruta) || /^producto\.[a-z]+$/i.test(archivo)) return 'Mirando las fotos de tu producto';
      return 'Mirando las imágenes del anuncio';
    }
    if (archivo === 'pagina.txt') return 'Leyendo tu página';
    if (archivo === 'producto.json') return 'Leyendo lo que contaste de tu producto';
    if (archivo === 'ficha.json') return 'Repasando la ficha de tu producto';
    if (archivo === 'manifiesto.json' || archivo === 'guion.json') return 'Repasando el guion';
    if (archivo === 'transiciones.json') return 'Repasando las transiciones';
    if (archivo === 'letras.json' || archivo === 'peticion.json' || archivo === 'lineas.txt') return 'Repasando la letra';
    if (archivo === 'pares.txt') return 'Mirando cada par de escenas';
    return 'Leyendo';
  }
  if (nombre === 'Write' || nombre === 'Edit' || nombre === 'MultiEdit') {
    const nuevo = nombre === 'Write';
    if (archivo === 'manifiesto.json') return nuevo ? 'Escribiendo el guion y cada escena' : 'Ajustando el guion';
    if (archivo === 'guion.json') return 'Pasando el guion en limpio';
    if (archivo === 'transiciones.json') return 'Marcando las transiciones';
    if (archivo === 'ficha.json') return nuevo ? 'Armando la ficha de tu producto' : 'Ajustando la ficha de tu producto';
    if (archivo === 'bloqueo.json') return 'Anotando lo que falta';
    if (archivo === 'letras.json') return nuevo ? 'Escribiendo las letras' : 'Ajustando las letras';
    if (archivo === 'peticion.json') return 'Escribiendo la letra de la canción';
    if (archivo === 'letra-cambios.json') return 'Cambiando una frase de la letra';
    if (archivo === 'rechazo.json') return 'Buscando otra forma de decir la frase';
    if (archivo === 'pasos.json') return 'Escribiendo el paso entre cada escena';
    if (archivo === 'cadena.json') return 'Anotando lo que vio en las uniones';
    if (/^revision-(clips|bloques)\.json$/.test(archivo)) return 'Anotando lo que vio en los clips';
    if (archivo === 'revision-persona.json') return 'Anotando lo que vio en la imagen de la persona';
    if (/^revision|^revisar-imagenes|^imagenes\.json$/.test(archivo)) return 'Anotando lo que vio en las imágenes';
    return 'Guardando';
  }
  if (nombre === 'Glob' || nombre === 'Grep') return 'Buscando en los archivos';
  if (nombre === 'Bash' || nombre === 'PowerShell') {
    const c = String(e.command || '');
    if (/validar-manifiesto|npm run validar/.test(c)) return 'Revisando que el guion esté completo';
    if (/rehacer-toma/.test(c)) return 'Mirando una toma de cerca';
    return 'Revisando';
  }
  return null; // TodoWrite y lo demas: no se muestra
}

// ---------------------------------------------------------------- errores en palabras simples

// "You've hit your session limit · resets 3pm", "weekly limit", "Opus limit", "usage limit reached"…
export const LIMITE_DE_USO = /hit your .*limit|usage limit|limit (has been )?reached|rate.?limit|5-hour limit|weekly limit|session limit|out of (extra )?usage/i;
const SIN_SESION = /not logged in|please run \/login|\/login|invalid api key|authentication_failed|oauth token (has )?(expired|revoked)|credit balance is too low|invalid bearer token|401/i;
const SESION_NO_EXISTE = /no conversation found/i;
const SESION_EN_USO = /already in use/i;

const MENSAJES = {
  limite: 'Se acabó por ahora el uso de tu plan de Claude. Toca "Reintentar" cuando se renueve: lo ya hecho no se repite.',
  sinSesion: 'Tu Claude Code no tiene la sesión iniciada con tu cuenta. Toca "Iniciar sesión" y después "Reintentar".',
  sinClaude: 'Falta Claude Code en tu PC. Cierra la ventana negra y vuelve a abrir Anuncios con IA: lo instala solo.',
  claveApi: 'Tu Claude Code está usando una clave de API, no tu cuenta de Claude. Inicia sesión con tu cuenta (Pro o Max) y reintenta.',
  error_max_turns: 'Claude llegó al límite de pasos de esta tarea sin terminarla. Toca "Reintentar": sigue desde donde quedó.',
  error_during_execution: 'Claude tuvo un error mientras trabajaba. Toca "Reintentar".',
  cancelado: 'Se canceló.',
  colgado: 'Claude dejó de responder. Toca "Reintentar": sigue desde donde quedó.',
  tiempo: 'Claude tardó demasiado en esta tarea. Toca "Reintentar": sigue desde donde quedó.',
};

function horaDe(reinicio) {
  const d = reinicio ? new Date(reinicio) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return ` (se renueva a las ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')})`;
}

function textoDeResultado(c) {
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((x) => (typeof x === 'string' ? x : x?.type === 'text' ? x.text : '')).join('\n');
  return '';
}

// ---------------------------------------------------------------- sesiones

// activas, enCurso, turno(), soltarTurno(), sesionActiva, sesionesEnCurso, cancelarSesion y matar: en ia/fila.js.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Corre una tarea en una sesion headless de Claude Code con la cuenta del usuario.
 *
 * @param {object} o
 * @param {'ficha'|'guion'|'cambios'|'revision'} o.tipo   para el registro y los mensajes
 * @param {string} [o.cwd]            carpeta de trabajo (por defecto la raiz del proyecto)
 * @param {string} o.uuid             el id de la conversacion (se crea con --session-id; con resume, --resume)
 * @param {boolean} [o.resume]        seguir esa conversacion (si no existe todavia, se crea; y al reves)
 * @param {string} o.prompt           el mensaje de la tarea (va por stdin como stream-json)
 * @param {string[]} [o.permitidas]   reglas --allowedTools
 * @param {string[]} [o.prohibidas]   reglas --disallowedTools (ganan siempre)
 * @param {string[]} [o.herramientas] --tools: las unicas herramientas que existen en la sesion
 * @param {(frase:string) => void} [o.alProgreso]
 * @param {number} [o.timeoutMs]      tope total (60 min por defecto)
 * @param {number} [o.silencioMs]     sin ninguna salida durante esto = colgada (10 min por defecto)
 * @param {number} [o.maxTurnos]      --max-turns (80)
 * @param {string} [o.modelo]         --model (por defecto, el de la cuenta)
 * @param {string} [o.registro]       archivo donde queda cada evento (sin los parciales)
 * @param {() => Promise<{ok:boolean, errores?:string[], final?:boolean, error?:string}>} [o.verificar]
 *        revisa el archivo que tenia que escribir. Si no pasa, se le pide a Claude que lo corrija en la misma sesion
 * @param {number} [o.correcciones]   cuantas veces se le pide corregir (1)
 * @param {object} [o.entorno]        variables extra para Claude (null = quitarla)
 * @param {AbortSignal} [o.senal]     si se aborta, la sesion se corta (como cancelarSesion)
 * @param {boolean} [o.conectores]    sin --strict-mcp-config: la sesion ve los conectores de claude.ai del usuario
 *        (solo corren los que esten en o.permitidas)
 * @param {(nombre:string, texto:string, extra:{error:boolean}) => void} [o.alResultadoHerramienta]
 *        recibe lo que devolvio cada herramienta tal cual (p. ej. el JSON de un conector), sin que Claude lo copie
 * @returns {Promise<{ok:boolean, resultado?:string, error?:string, detalle?:string, limite?:boolean, reinicio?:string,
 *   sinSesion?:boolean, sinClaude?:boolean, cancelado?:boolean, sesion:string, modo:string, turnos:number,
 *   costo:number, uso:object|null, duracionMs:number, denegados:any[], init:object|null, frases:string[]}>}
 */
export async function lanzarSesion(o) {
  if (!o || !UUID.test(String(o.uuid || ''))) throw new Error('lanzarSesion: falta un uuid válido');
  if (!o.prompt) throw new Error('lanzarSesion: falta el prompt');
  if (activas.has(o.uuid)) return { ok: false, error: 'Claude ya está trabajando en esto.', ocupada: true, sesion: o.uuid };
  const control = new AbortController();
  const entrada = { control, hijo: null, tipo: o.tipo || null, conTurno: false };
  activas.set(o.uuid, entrada);
  const alProgreso = typeof o.alProgreso === 'function' ? o.alProgreso : () => {};
  // la senal de quien la lanza (p. ej. Detener en la produccion) corta la sesion con todo lo que lanzo
  const alAbortar = () => {
    control.abort();
    if (entrada.hijo) matar(entrada.hijo);
  };
  o.senal?.addEventListener('abort', alAbortar, { once: true });
  try {
    if (o.senal?.aborted) return { ok: false, cancelado: true, error: MENSAJES.cancelado, sesion: o.uuid };
    // Solo con la cuenta de Claude del usuario: si `claude auth status` no lo confirma, no se lanza nada.
    let cuenta = await estadoClaude();
    if (cuenta?.sesion === 'desconocido') {
      olvidarEstadoClaude();
      cuenta = await estadoClaude();
    }
    if (cuenta?.sesion !== 'ok') {
      const error = !cuenta?.instalado ? MENSAJES.sinClaude : cuenta.otraCuenta ? MENSAJES.claveApi : MENSAJES.sinSesion;
      return { ok: false, sinSesion: !!cuenta?.instalado, sinClaude: !cuenta?.instalado, error, sesion: o.uuid, turnos: 0, frases: [] };
    }
    if (control.signal.aborted) return { ok: false, cancelado: true, error: MENSAJES.cancelado, sesion: o.uuid };
    if (enCurso >= MAX_SESIONES) alProgreso('Esperando turno: Claude está terminando otra tarea');
    const conTurno = await turno(control.signal);
    if (!conTurno) return { ok: false, cancelado: true, error: MENSAJES.cancelado, sesion: o.uuid };
    entrada.conTurno = true;
    anotarLotes(o.tipo);
    try {
      let modo = o.resume ? 'resume' : 'nueva';
      let r = await correr(o, modo, entrada);
      // la conversacion no existe todavia (el primer intento no llego a empezar) o ya existe (se reintenta con el
      // mismo id): se cambia de forma una vez
      if (!r.ok && !r.cancelado && modo === 'resume' && r.sesionNoExiste) r = await correr(o, (modo = 'nueva'), entrada);
      else if (!r.ok && !r.cancelado && modo === 'nueva' && r.sesionEnUso) r = await correr(o, (modo = 'resume'), entrada);
      return r;
    } finally {
      entrada.conTurno = false;
      soltarTurno();
    }
  } finally {
    o.senal?.removeEventListener('abort', alAbortar);
    activas.delete(o.uuid);
  }
}

function argumentos(o, modo, bin) {
  const args = [
    '-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    '--permission-mode', 'dontAsk', '--permission-prompts', 'none',
    '--setting-sources', 'project',
    ...(o.conectores ? [] : ['--strict-mcp-config']),
    '--max-turns', String(o.maxTurnos || 80),
    modo === 'resume' ? '--resume' : '--session-id', o.uuid,
    '--append-system-prompt', argumentoSeguro(bin, textoModoApp()),
  ];
  if (o.herramientas?.length) args.push('--tools', o.herramientas.join(','));
  if (o.permitidas?.length) args.push('--allowedTools', o.permitidas.map((x) => argumentoSeguro(bin, x)).join(','));
  if (o.prohibidas?.length) args.push('--disallowedTools', o.prohibidas.map((x) => argumentoSeguro(bin, x)).join(','));
  if (o.modelo) args.push('--model', o.modelo);
  return args;
}

function correr(o, modo, entrada) {
  const alProgreso = typeof o.alProgreso === 'function' ? o.alProgreso : () => {};
  const t0 = Date.now();
  const timeoutMs = o.timeoutMs || 60 * 60000;
  const silencioMs = o.silencioMs || 10 * 60000;
  let correcciones = Number.isInteger(o.correcciones) ? o.correcciones : 1;

  return new Promise((resolve) => {
    const base = { sesion: o.uuid, modo, turnos: 0, costo: 0, uso: null, duracionMs: 0, denegados: [], init: null, frases: [] };
    const bin = resolverClaude();
    if (!bin) return resolve({ ...base, ok: false, sinClaude: true, error: MENSAJES.sinClaude });
    if (entrada.control.signal.aborted) return resolve({ ...base, ok: false, cancelado: true, error: MENSAJES.cancelado });

    const args = argumentos(o, modo, bin);
    // El registro se escribe linea por linea, en el acto: si la app se cae, lo que paso queda.
    let registro = o.registro || null;
    const anotar = (linea) => {
      if (!registro) return;
      try {
        fs.appendFileSync(registro, linea + '\n', 'utf8');
      } catch {
        registro = null;
      }
    };
    if (registro) {
      try {
        fs.mkdirSync(path.dirname(registro), { recursive: true });
      } catch {
        registro = null;
      }
      // todo tal cual (los permisos tambien, para poder revisarlos), menos el texto MODO APP, que es largo y fijo
      const visibles = args.map((a, i) => (args[i - 1] === '--append-system-prompt' ? `<modo-app.md, ${a.length} caracteres>` : a));
      anotar(JSON.stringify({ type: 'app', momento: new Date().toISOString(), tipo: o.tipo, modo, via: bin.via, args: visibles }));
    }

    let hijo;
    try {
      // la terminal de Claude vuelve a la carpeta de trabajo despues de cada comando (un `cd` no queda para el siguiente)
      const entorno = { CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR: '1', ...(o.entorno || {}) };
      hijo = spawn(bin.cmd, [...bin.pre, ...args], { cwd: o.cwd || RAIZ, env: entornoHijo(entorno), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    } catch (e) {
      return resolve({ ...base, ok: false, error: `No pude abrir Claude Code (${e.message}).` });
    }
    entrada.hijo = hijo;

    let terminado = false;
    let buffer = '';
    let errTxt = '';
    let ultima = Date.now();
    let ultimaFrase = '';
    let limite = false;
    let reinicio = null;
    let errorDeCuenta = null; // 'sinSesion' | 'claveApi'
    let resultadoTexto = '';
    let verificando = false;
    let salio = false; // el proceso de Claude ya termino (no se le puede pedir que corrija)
    let enTurno = true;
    const fondo = new Set(); // comandos que Claude dejo en segundo plano y no terminaron
    const bloques = new Map(); // indice -> { nombre, json } de la herramienta que se esta escribiendo (parciales)
    const nombresHerramienta = new Map(); // tool_use id -> nombre (para o.alResultadoHerramienta)

    const frase = (f) => {
      if (!f || f === ultimaFrase) return;
      ultimaFrase = f;
      base.frases.push(f);
      try {
        alProgreso(f);
      } catch (err) {
        console.error(`[claude] alProgreso: ${err.message}`);
      }
    };

    const cerrar = (res) => {
      if (terminado) return;
      terminado = true;
      clearInterval(reloj);
      try {
        hijo.stdin.end();
      } catch {
        /* ya cerrado */
      }
      // si no sale solo, se termina con todo lo que lanzo
      setTimeout(() => matar(hijo), 4000).unref?.();
      base.duracionMs = Date.now() - t0;
      const final = { ...base, ...res };
      anotar(JSON.stringify({ type: 'app', momento: new Date().toISOString(), fin: { ok: final.ok, error: final.error || null, limite: !!final.limite, turnos: final.turnos, costo: final.costo, duracionMs: final.duracionMs } }));
      resolve(final);
    };

    // Por que no termino bien, en este orden: limite de uso, cuenta, conversacion; si no, lo que diga `extra`.
    const fallo = (extra = {}) => {
      const texto = `${resultadoTexto}\n${errTxt}`;
      const detalle = extra.detalle || texto.trim().slice(-600) || undefined;
      if (limite || LIMITE_DE_USO.test(texto)) return cerrar({ ...extra, ok: false, limite: true, reinicio, error: MENSAJES.limite.replace('se renueve', `se renueve${horaDe(reinicio)}`), detalle });
      if (errorDeCuenta === 'claveApi') return cerrar({ ...extra, ok: false, sinSesion: true, error: MENSAJES.claveApi });
      if (errorDeCuenta === 'sinSesion' || SIN_SESION.test(texto)) {
        olvidarEstadoClaude(); // la pantalla tiene que mostrar enseguida "Iniciar sesion"
        return cerrar({ ...extra, ok: false, sinSesion: true, error: MENSAJES.sinSesion, detalle });
      }
      if (SESION_NO_EXISTE.test(texto)) return cerrar({ ...extra, ok: false, sesionNoExiste: true, error: 'No encontré la conversación anterior con Claude.' });
      if (SESION_EN_USO.test(texto)) return cerrar({ ...extra, ok: false, sesionEnUso: true, error: 'Esa conversación con Claude ya estaba abierta.' });
      return cerrar({ ok: false, error: 'Claude no terminó bien la tarea. Toca "Reintentar".', ...extra, detalle });
    };

    const enviar = (texto) => {
      if (terminado) return;
      try {
        hijo.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: texto } }) + '\n');
      } catch {
        /* Claude ya salio */
      }
    };

    // Plazos: el total y el silencio (sin ninguna linea: con los mensajes parciales, mientras Claude escribe sale algo
    // todo el tiempo). Tras un resultado con comandos en segundo plano, 3 min de espera.
    const reloj = setInterval(() => {
      if (terminado) return;
      const ahora = Date.now();
      if (ahora - t0 > timeoutMs) {
        matar(hijo);
        return cerrar({ ok: false, error: MENSAJES.tiempo, tiempo: true });
      }
      const quieto = !enTurno && fondo.size ? 3 * 60000 : silencioMs;
      if (!verificando && ahora - ultima > quieto) {
        if (!enTurno && fondo.size && resultadoTexto) return terminarBien(); // lo que quedo en fondo se cierra con el resto
        matar(hijo);
        return cerrar({ ok: false, error: MENSAJES.colgado, colgado: true });
      }
    }, 2000);
    reloj.unref?.();

    const alCancelar = () => {
      matar(hijo);
      cerrar({ ok: false, cancelado: true, error: MENSAJES.cancelado });
    };
    entrada.control.signal.addEventListener('abort', alCancelar, { once: true });
    hijo.on('exit', () => entrada.control.signal.removeEventListener('abort', alCancelar));

    // El resultado de Claude estuvo bien: falta revisar el archivo que tenia que escribir.
    const terminarBien = async () => {
      if (terminado || verificando) return;
      if (typeof o.verificar !== 'function') return cerrar({ ok: true, resultado: resultadoTexto });
      verificando = true;
      let v;
      try {
        v = await o.verificar();
      } catch (e) {
        v = { ok: false, errores: [e.message] };
      }
      verificando = false;
      ultima = Date.now();
      if (terminado) return;
      if (v?.ok) return cerrar({ ok: true, resultado: resultadoTexto, verificacion: v });
      const errores = (v?.errores || []).filter(Boolean).slice(0, 12);
      if (!v?.final && !salio && correcciones > 0 && errores.length) {
        correcciones--;
        enTurno = true;
        frase('Corrigiendo lo que faltaba');
        anotar(JSON.stringify({ type: 'app', momento: new Date().toISOString(), correccion: errores }));
        enviar(textoCorreccion(errores));
        return;
      }
      cerrar({ ok: false, error: v?.error || 'Claude terminó, pero lo que dejó escrito no está completo. Toca "Reintentar".', bloqueado: !!v?.bloqueado, faltan: v?.faltan, verificacion: v, detalle: errores.join('\n') || undefined });
    };

    hijo.stdin.on('error', () => {}); // escribirle cuando Claude ya salio no debe tumbar la app
    enviar(o.prompt);

    hijo.stdout.on('data', (d) => {
      ultima = Date.now();
      buffer += d.toString('utf8');
      let i;
      while ((i = buffer.indexOf('\n')) >= 0) {
        const linea = buffer.slice(0, i).trim();
        buffer = buffer.slice(i + 1);
        if (!linea || terminado) continue;
        let ev;
        try {
          ev = JSON.parse(linea);
        } catch {
          continue;
        }
        if (ev.type === 'stream_event') {
          alParcial(ev.event);
          continue; // los parciales no van al registro (son miles)
        }
        anotar(linea);
        alEvento(ev);
      }
    });

    // Mientras Claude escribe una herramienta (p. ej. el manifiesto, que tarda minutos) ya se puede decir que hace.
    function alParcial(e) {
      if (!e) return;
      if (e.type === 'content_block_start' && e.content_block?.type === 'tool_use') {
        bloques.set(e.index, { nombre: e.content_block.name, json: '', dicho: false });
      } else if (e.type === 'content_block_delta' && e.delta?.type === 'input_json_delta') {
        const b = bloques.get(e.index);
        if (!b || b.dicho) return;
        if (b.json.length < 1200) b.json += e.delta.partial_json || '';
        const r = b.json.match(/"(file_path|command)"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (r) {
          b.dicho = true;
          let valor = r[2];
          try {
            valor = JSON.parse(`"${r[2]}"`);
          } catch {
            /* como vino */
          }
          frase(describirHerramienta(b.nombre, { [r[1]]: valor }));
        }
      } else if (e.type === 'content_block_stop') {
        bloques.delete(e.index);
      }
    }

    function alEvento(ev) {
      if (ev.type === 'system') {
        if (ev.subtype === 'init') {
          enTurno = true;
          if (!base.init) {
            base.init = { modelo: ev.model || null, herramientas: ev.tools || [], permisos: ev.permissionMode || null, claveApi: ev.apiKeySource || null, version: ev.claude_code_version || null, mcp: (ev.mcp_servers || []).map((s) => s?.name).filter(Boolean) };
            // Nunca con una clave de API: con la cuenta de claude.ai Claude Code dice "none". Cualquier otra cosa
            // (ANTHROPIC_API_KEY, apiKeyHelper, "/login managed key" de una cuenta de Console…) se cobra por tokens:
            // se corta antes de que trabaje.
            if (String(ev.apiKeySource ?? '') !== 'none') {
              errorDeCuenta = 'claveApi';
              matar(hijo);
              return fallo();
            }
            frase(o.fraseInicio || 'Claude empezó a trabajar');
          }
        } else if (ev.subtype === 'task_started' && ev.task_id && ev.is_backgrounded) fondo.add(ev.task_id);
        else if ((ev.subtype === 'task_notification' || ev.subtype === 'task_updated') && ev.task_id) {
          if (ev.subtype === 'task_notification' || /^(completed|failed|killed|stopped|cancel|error)/i.test(ev.patch?.status || '')) fondo.delete(ev.task_id);
        } else if (ev.subtype === 'background_tasks_changed' && Array.isArray(ev.tasks)) {
          fondo.clear();
          for (const t of ev.tasks) if (t?.task_id) fondo.add(t.task_id);
        }
        return;
      }
      if (ev.type === 'rate_limit_event') {
        const info = ev.rate_limit_info || {};
        if (info.status === 'rejected') {
          limite = true;
          if (info.resetsAt) reinicio = new Date(Number(info.resetsAt) * (Number(info.resetsAt) < 1e12 ? 1000 : 1)).toISOString();
        }
        return;
      }
      if (ev.type === 'assistant') {
        enTurno = true;
        if (ev.error === 'rate_limit') limite = true;
        else if (ev.error === 'authentication_failed') errorDeCuenta = 'sinSesion';
        if (ev.parent_tool_use_id) return; // lo que hace un ayudante no se cuenta
        for (const b of ev.message?.content || []) {
          if (b?.type !== 'tool_use') continue;
          if (b.id) nombresHerramienta.set(b.id, b.name);
          frase(describirHerramienta(b.name, b.input || {}));
        }
        return;
      }
      if (ev.type === 'user') {
        enTurno = true;
        if (typeof o.alResultadoHerramienta === 'function' && !ev.parent_tool_use_id) {
          for (const b of Array.isArray(ev.message?.content) ? ev.message.content : []) {
            if (b?.type !== 'tool_result') continue;
            const texto = typeof b.content === 'string' ? b.content : (Array.isArray(b.content) ? b.content : []).filter((x) => x?.type === 'text').map((x) => x.text).join('');
            try {
              o.alResultadoHerramienta(nombresHerramienta.get(b.tool_use_id) || '', texto, { error: Boolean(b.is_error) });
            } catch (err) {
              console.error(`[claude] alResultadoHerramienta: ${err.message}`);
            }
          }
        }
        return;
      }
      if (ev.type === 'result') {
        enTurno = false;
        base.turnos += ev.num_turns || 0;
        base.costo = Math.max(base.costo, Number(ev.total_cost_usd) || 0); // viene acumulado (es una estimacion, no la cuota)
        if (ev.usage) base.uso = ev.usage;
        if (Array.isArray(ev.permission_denials)) {
          const vistos = new Set(base.denegados.map((x) => x?.tool_use_id || JSON.stringify(x)));
          for (const x of ev.permission_denials) {
            const k = x?.tool_use_id || JSON.stringify(x);
            if (!vistos.has(k)) base.denegados.push(x);
          }
        }
        resultadoTexto = textoDeResultado(ev.result) || resultadoTexto;
        const ok = !ev.is_error && ev.subtype === 'success';
        if (!ok) return fallo({ error: MENSAJES[ev.subtype] || 'Claude no terminó bien la tarea. Toca "Reintentar".', subtipo: ev.subtype });
        if (fondo.size) return; // quedan comandos en segundo plano: Claude vuelve solo cuando terminen (o vence la espera)
        terminarBien();
      }
    }

    hijo.stderr.on('data', (d) => {
      ultima = Date.now();
      errTxt = (errTxt + d.toString('utf8')).slice(-4000);
    });
    hijo.on('error', (e) => {
      if (e.code === 'ENOENT') {
        cacheBin = null;
        return cerrar({ ok: false, sinClaude: true, error: MENSAJES.sinClaude });
      }
      cerrar({ ok: false, error: `No pude abrir Claude Code (${e.message}).` });
    });
    hijo.on('exit', (codigo) => {
      salio = true;
      if (terminado) return;
      // se cerro sin un resultado final (o mientras se revisaba el archivo)
      setTimeout(() => {
        if (terminado || verificando) return;
        fallo({ error: 'Claude se cerró sin terminar. Toca "Reintentar".', codigo });
      }, 300);
    });
  });
}

function textoCorreccion(errores) {
  try {
    return textoClaude('tarea-correccion', { errores: errores.map((e) => `- ${e}`).join('\n') });
  } catch {
    return `La app revisó lo que escribiste y todavía no está bien:\n${errores.map((e) => `- ${e}`).join('\n')}\n\nCorrígelo sin cambiar nada más y responde solo LISTO.`;
  }
}

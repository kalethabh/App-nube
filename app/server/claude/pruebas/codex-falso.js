// Un "codex" falso para probar la app con ChatGPT SIN gastar el plan de nadie (§6.1 de DISENO-motor-codex.md). Imita
// al binario de verdad, Codex 0.167.0 (scratchpad/codex-diseno/mapa-codex-real.md): --version, login [--device-auth],
// login status (por stderr, con salida 0 o 1), logout, delete <hilo>, app-server (initialize, account/read,
// account/rateLimits/read) y exec / exec resume con su JSONL: thread.started, el aviso de Code Mode, turn.started, un
// "Reconnecting...", el agent_message con la respuesta y turn.completed con su usage.
//
//   ANUNCIOS_CODEX_BIN=app/server/claude/pruebas/codex-falso.js   la app lo lanza en vez del codex de verdad
//
// LAS RESPUESTAS salen de los Claude falsos que ya existen (no se tocan): por cada mensaje corre claude-falso.js (o el de
// FALSO_CODEX_CLAUDE) como proceso hijo, con la conversación de esta tarea en stream-json, como lo lanza lib/claude.js
// (la TAREA es el primer mensaje, tal como la recibe Claude; después, RESULTADO DE TU MENSAJE ANTERIOR, la corrección y
// la respuesta cortada). Antes y después de cada mensaje saca una foto (ruta, tamaño, mtime) de las carpetas de la
// tarea. Lo que el falso escribió (lo que anunció con Write/Edit, o un texto que LO QUE PUEDES ESCRIBIR deja escribir)
// lo deja como estaba y lo devuelve: los nuevos en `archivos` y los que ya existían en `ediciones` (cada `buscar`
// aparece una sola vez). La app es la que escribe. Lo binario que copia un falso (las hojas de muestra) queda en disco:
// la app solo guarda texto. Si la TAREA tiene comandos, el primer mensaje pide uno en `comandos` con SEGUIR. La
// conversación queda en CODEX_HOME/sessions/<hilo>.json, para los resume.
//
// LO QUE CONTROLA: cada exec y cada resume deja una línea en FALSO_ARGS y en HUMO_REGISTRO (si están):
//   { tipo: 'codex-exec' | 'codex-resume', ok, problemas: [...], hilo, clase, tarea, material, faltan, malos, deMas,
//     envProhibidas, codexHome, stdinCerrado, imagenes, conSecreto, conReglas, reglas, partes, materialFaltante,
//     materialDeMas, deRetoma, leer, comando, fuera, edicionesMal }
//   ok = problemas vacío. faltan/malos/deMas: las banderas de §2.4 (25 --disable, 9 -c, --strict-config, -s read-only
//   o -c sandbox_mode, --ignore-user-config, --ignore-rules, --skip-git-repo-check, --json, --output-schema).
//   conReglas = developer_instructions trae el MODO APP y «CÓMO TRABAJAS AQUÍ» y el mensaje no los repite.
//   materialFaltante = lo de material-esperado.json que no llegó (en MATERIAL, IMÁGENES ADJUNTAS o DISPONIBLES).
//   Después de responder deja { tipo: 'codex-respuesta', hilo, estado, archivos, ediciones, leer, comandos, ... }.
//   app-server y login dejan { tipo: 'codex-app-server' | 'codex-login' | 'codex-login-status' | 'codex-logout' |
//   'codex-delete', ok, problemas, faltan, envProhibidas }. Un error del propio falso va como { tipo: 'error' }.
//
// FALSO_CODEX_MODO (o FALSO_CODEX_CONFIG = un .json { "guion": "mal", "todo": "ok" } que se lee en cada llamada; la
// clave es el id de la tarea en material-esperado.json, su tipo o la primera palabra de su TAREA). Se juntan con +:
//   ok              todo bien
//   mal             un archivo .json llega cortado a la mitad (incompleto); lo arregla cuando la app manda la corrección
//                   («La app revisó lo que escribiste…», por resume), no antes
//   mal-siempre     nunca lo arregla
//   limite          turn.failed con «You’ve hit your usage limit… Try again at 8:14 PM.»; después, rateLimits alcanzado
//   sin-sesion      la secuencia 401 de verdad (10 Reconnecting y turn.failed); borra la marca de la sesión
//   cuelga          no manda turn.started          muere   sale con 1
//   sin-json        el agent_message no es JSON (una vez); después contesta bien
//   fuera           además devuelve ../.env, app/config.json, temp/otro/x.json, <carpeta>/app/conductor.json, <carpeta>/x.js,
//                   <carpeta>/modelos.json, <carpeta>/img/log-modelos.json, <carpeta>/video/x.json (y producto.json en la
//                   ficha): la app no tiene que guardar ninguno. Solo en una carpeta de prueba (el CI), nunca en la de trabajo.
//   resume-perdido  el primer resume de la tarea falla con «no rollout found»
//   muchas          con más de 48 imágenes en un mensaje, turn.failed (input_too_large): exige el reparto en 2 mensajes
//   plan-sin-codex  turn.failed con «Quota exceeded. Check your plan and billing details.»
//   plan-sin-codex-plus  la otra variante: «To use Codex with your ChatGPT plan, upgrade to Plus…»
//   limite-a-mitad  el primer mensaje sale bien y pide otro; desde ahí rateLimits da ordinaryUsageAllowed: false
//   contexto        el segundo mensaje falla con «Codex ran out of room in the model's context window…» (una vez)
//   cortada         el agent_message llega cortado a la mitad (response_incomplete); después entrega de a un archivo
//   por-partes      entrega de a un archivo con SEGUIR, sin leer ni comandos; el último con LISTO
//   ediciones-mal   la primera vez que manda ediciones, una con un `buscar` que aparece 2 veces; después las arregla
//   saltos-json     el primer .json nuevo llega con los \n de sus textos como saltos de línea de verdad (no se lee);
//                   la app los tiene que pasar a \n al guardarlo, sin gastar una corrección ni otro mensaje
//   refresh         el primer envío falla con «…your refresh token was already used…»; el siguiente sale bien
//   alta-demanda    un turn.failed con «We're currently experiencing high demand…»; el siguiente sale bien
//   herramientas    4 item.started de tipo collab_tool_call antes de responder (la app tiene que cortarlo)
//   herramientas-exec  4 intentos de `exec` que, como en el de verdad, no son items: solo dejan en stderr «ERROR
//                   codex_core::tools::router: error=code-mode host is disabled» (la app tiene que contarlos y cortarlo)
// Siempre: con «Faltan N imágenes» contesta SEGUIR sin nada y hace la tarea con «Ya tienes todas las imágenes».
// Otras variables: FALSO_CODEX_SESION=ok|no|api (si no está, la marca CODEX_HOME/falso-sesion.json, que deja login),
//   FALSO_CODEX_LIMITE=si (rateLimits alcanzado siempre), FALSO_CODEX_PLAN (plus), FALSO_CODEX_LOGIN=ok|puerto|sin-codigo|
//   cuelga, FALSO_CODEX_LOGIN_MS (2000), FALSO_CODEX_LEER=1 (el primer mensaje pide en `leer` una skill y ../.env),
//   FALSO_CODEX_PAUSA (ms entre eventos), FALSO_CODEX_DEMORA (ms antes de responder), FALSO_CODEX_DEMORA_UNA_VEZ (lo
//   mismo, solo en el primer mensaje de la tarea: un cuelgue que no se repite), FALSO_CODEX_TOKENS (se suman a
//   input_tokens), FALSO_CODEX_CLAUDE (otro Claude falso, p. ej. la prueba de humo), FALSO_CODEX_TOPE_CLAUDE (ms por
//   mensaje, 180000), FALSO_CODEX_ESPERA_ENTRADA_MS (5000), FALSO_CODEX_HERRAMIENTAS_MS (3000).
// Nunca escribe en ~/.codex y nunca abre un .env, un auth.json, un config.toml ni app/config.json (solo mira si existen).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');
const VERSION = '0.167.0';
const SIN_MAYUSCULAS = process.platform === 'win32' || process.platform === 'darwin';
const ARGS = process.argv.slice(2);

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const pausa = () => dormir(Number(process.env.FALSO_CODEX_PAUSA) || 5);
const sha1 = (t) => crypto.createHash('sha1').update(t).digest('hex');
const ahora = () => new Date().toISOString();
const existe = (f) => {
  try {
    fs.statSync(f);
    return true;
  } catch {
    return false;
  }
};
const leerJSON = (f, d = null) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
  } catch {
    return d;
  }
};
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const emitir = (o) => process.stdout.write(JSON.stringify(o) + '\n');
function salir(codigo) {
  process.exitCode = codigo;
  process.stdout.write('', () => process.exit(codigo));
}

// ---------------------------------------------------------------- rutas

const barras = (p) => String(p).replace(/\\/g, '/');
const RAIZ_B = barras(RAIZ).normalize('NFC');
const comparable = (p) => (SIN_MAYUSCULAS ? p.toLowerCase() : p);
/** La ruta desde la raíz del proyecto, con / (o la absoluta, con /, si cae afuera). */
function rel(p) {
  let s = barras(String(p).trim()).normalize('NFC').replace(/^[`'"«]+|[`'"»]+$/g, '');
  if (comparable(s).startsWith(comparable(`${RAIZ_B}/`))) s = s.slice(RAIZ_B.length + 1);
  return s.replace(/^\.\//, '');
}
const clave = (p) => comparable(rel(p));
const abs = (r) => (path.isAbsolute(r) ? r : path.join(RAIZ, ...String(r).split('/')));
const EXT_IMAGEN = /\.(png|jpe?g|webp|gif)$/i;
const EXT_TEXTO = /\.(json|md|txt|csv|srt|vtt|tsv)$/i;
const ESCRIBIBLE = /\.(json|md|txt)$/i; // lo unico que la app guarda (§2.10)
/** Archivos que nunca se abren: solo se mira si existen. */
const esSecreto = (r) => /(^|\/)(\.env[^/]*|auth\.json|config\.toml|credentials[^/]*)$/i.test(barras(r)) || /^app\/config\.json$/i.test(rel(r));

const EXT_RUTA = '(?:png|jpe?g|webp|gif|json|md|txt|csv|srt|vtt|tsv|jsonl|log|mp4|mp3|wav|js|mjs|env)';
const FIN_RUTA = '(?=$|[\\s`"\'»),;:\\]]|\\.(?=$|[\\s`"\'»)]))';
const CUERPO = '[^\\s`"«»,;()]*?';
const RAICES = [...new Set([RAIZ.normalize('NFC'), RAIZ_B])];
const RX_ABS = new RegExp(`(?:${RAICES.map(escapar).join('|')})[\\\\/]${CUERPO}\\.${EXT_RUTA}${FIN_RUTA}`, SIN_MAYUSCULAS ? 'gi' : 'g');
const RX_REL = new RegExp(`(?<![\\w/\\\\.-])(?:\\.\\/)?(?:temp|\\.claude|recursos)[\\\\/]${CUERPO}\\.${EXT_RUTA}${FIN_RUTA}`, 'gi');
const RX_CON_EXT = new RegExp(`\\.${EXT_RUTA}$`, 'i');

/** Las rutas que nombra un texto (absolutas de la raíz, temp/…, .claude/…, recursos/… o entre backticks), sin repetir. */
function rutasEn(texto) {
  const t = String(texto).normalize('NFC');
  const out = new Map();
  const poner = (s) => {
    const x = String(s).trim().replace(/[.:]+$/, '');
    if (!RX_CON_EXT.test(x)) return;
    const k = clave(x);
    if (!out.has(k)) out.set(k, rel(x));
  };
  for (const m of t.matchAll(/`([^`\n]+)`/g)) if (/[\\/]/.test(m[1]) && !/\s(?:node|npm)\s/.test(` ${m[1]}`)) poner(m[1]);
  for (const m of t.matchAll(RX_ABS)) poner(m[0]);
  for (const m of t.matchAll(RX_REL)) poner(m[0]);
  return [...out.values()];
}

/** La ruta de una línea de lista ("- temp/x/a.png (0,6 MB)", "`…`"). */
function rutaDeLinea(s) {
  const t = String(s).trim().replace(/^[-*•]\s+/, '').trim();
  const bt = t.match(/^`([^`]+)`/);
  if (bt) return rel(bt[1]);
  const m = t.match(new RegExp(`^(.*?\\.${EXT_RUTA})(?:\\s+\\(.*\\))?\\s*$`, 'i'));
  return rel(m ? m[1] : t);
}

const globARegex = (g) =>
  new RegExp(
    `^${g
      .split('**')
      .map((p) => p.split('*').map(escapar).join('[^/]*'))
      .join('.*')}$`
  );

/** Las rutas de un patrón con marcas ya puestas: {a,b} y * (solo las que existen). */
function expandir(patron) {
  const b = patron.match(/\{([^{}]+)\}/);
  if (b) return b[1].split(',').flatMap((x) => expandir(patron.replace(b[0], x)));
  const esArchivo = (x) => {
    try {
      return fs.statSync(abs(x)).isFile();
    } catch {
      return false;
    }
  };
  if (!patron.includes('*')) return esArchivo(patron) ? [patron] : [];
  let actuales = [''];
  for (const parte of patron.split('/')) {
    const sig = [];
    for (const base of actuales) {
      if (!parte.includes('*')) {
        sig.push(base ? `${base}/${parte}` : parte);
        continue;
      }
      const rx = new RegExp(`^${parte.split('*').map(escapar).join('[^/]*')}$`, SIN_MAYUSCULAS ? 'i' : '');
      let ents = [];
      try {
        ents = fs.readdirSync(abs(base || '.'));
      } catch {
        /* no existe */
      }
      for (const e of ents) if (rx.test(e)) sig.push(base ? `${base}/${e}` : e);
    }
    actuales = sig;
  }
  return actuales.filter(esArchivo).sort();
}

// ---------------------------------------------------------------- los argumentos (como clap)

const CON_VALOR = new Set(['-c', '--disable', '--enable', '-i', '-s', '-C', '--output-schema', '-m', '-o', '-p', '--color', '-a', '--add-dir', '--local-provider']);
const ALIAS = { '--config': '-c', '--image': '-i', '--sandbox': '-s', '--cd': '-C', '--model': '-m', '--output-last-message': '-o', '--profile': '-p', '--ask-for-approval': '-a' };

function leerArgs(args) {
  const valores = new Map();
  const banderas = new Set();
  const pos = [];
  for (let i = 0; i < args.length; i++) {
    let x = args[i];
    if (x === '-' || !x.startsWith('-')) {
      pos.push(x);
      continue;
    }
    let v = null;
    const eq = x.startsWith('--') ? x.indexOf('=') : -1;
    if (eq > 0) {
      v = x.slice(eq + 1);
      x = x.slice(0, eq);
    }
    const n = ALIAS[x] || x;
    if (CON_VALOR.has(n)) {
      if (v === null) v = args[++i] ?? '';
      if (!valores.has(n)) valores.set(n, []);
      valores.get(n).push(v);
    } else banderas.add(n);
  }
  return { valores, banderas, pos, uno: (n) => valores.get(n)?.[0] ?? null, todos: (n) => valores.get(n) || [] };
}

/** Un valor de -c como lo lee Codex (TOML; sin comillas, texto). */
function valorToml(t) {
  const s = String(t).trim();
  if (/^".*"$/s.test(s)) {
    try {
      return JSON.parse(s);
    } catch {
      return s.slice(1, -1);
    }
  }
  if (/^'.*'$/s.test(s)) return s.slice(1, -1);
  if (s === 'true' || s === 'false') return s === 'true';
  if (/^-?\d+$/.test(s)) return Number(s);
  return s;
}
function configDe(a) {
  const c = new Map();
  for (const x of a.todos('-c')) {
    const i = String(x).indexOf('=');
    if (i <= 0) c.set(String(x), { crudo: '', valor: undefined, malo: true });
    else c.set(x.slice(0, i).trim(), { crudo: x.slice(i + 1), valor: valorToml(x.slice(i + 1)) });
  }
  return c;
}
const resumir = (s) => (String(s).length > 60 ? `${String(s).slice(0, 57)}…` : String(s));

// Las 25 de §2.4 (las 16 del perfil verificado, daemon_auto_start, las 6 activas que nadie usa y el modo rapido).
const DISABLE = [
  'shell_tool', 'unified_exec', 'browser_use', 'computer_use', 'in_app_browser', 'apps', 'plugins', 'image_generation',
  'code_mode_host', 'sleep_tool', 'multi_agent', 'goals', 'view_image', 'tool_suggest', 'skill_search', 'hooks',
  'daemon_auto_start', 'shell_snapshot', 'workspace_dependencies', 'remote_plugin', 'plugin_discovery_prefetch',
  'skill_mcp_dependency_install', 'secret_auth_storage', 'fast_mode', 'ultrafast_mode',
];
// Los 9 -c de exec y resume, con lo que tienen que valer.
const C_EXEC = {
  web_search: (v) => v === 'disabled',
  'skills.include_instructions': (v) => v === false,
  model_reasoning_effort: (v) => v === 'high' || v === 'medium',
  check_for_update_on_startup: (v) => v === false,
  project_doc_max_bytes: (v) => v === 0,
  forced_login_method: (v) => v === 'chatgpt',
  cli_auth_credentials_store: (v) => v === 'file',
  model_auto_compact_token_limit: (v) => typeof v === 'number' && v >= 1e9,
  developer_instructions: (v) => typeof v === 'string' && v.trim().length > 0,
};
const C_CUENTA = { forced_login_method: (v) => v === 'chatgpt', cli_auth_credentials_store: (v) => v === 'file' };
const ESQUEMA_CAMPOS = ['estado', 'respuesta', 'archivos', 'ediciones', 'leer', 'comandos'];

function revisarC(c, esperados, faltan, malos) {
  for (const [k, ok] of Object.entries(esperados)) {
    const x = c.get(k);
    if (!x) faltan.push(`-c ${k}`);
    else if (!ok(x.valor)) malos.push(`-c ${k}=${resumir(x.crudo)}`);
  }
}

// ---------------------------------------------------------------- lo que se anota

function anotar(o) {
  const linea = `${JSON.stringify({ t: ahora(), ...o })}\n`;
  for (const f of new Set([process.env.FALSO_ARGS, process.env.HUMO_REGISTRO].filter(Boolean))) {
    try {
      fs.appendFileSync(f, linea);
    } catch {
      /* sin registro */
    }
  }
}
const anotarError = (e) => anotar({ tipo: 'error', de: 'codex-falso', error: String(e?.stack || e).slice(0, 2000) });

const PROHIBIDAS = /^(OPENAI_|AZURE_OPENAI_|KIE_|ELEVENLABS_|APIMART_|SUNO_|ANTHROPIC_|CLAUDE_)|^(CODEX_(?!HOME$).*|CLAUDECODE|AWS_BEARER_TOKEN_BEDROCK|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|AWS_PROFILE|RUST_LOG)$/i;
const HOME_USUARIO = path.join(os.homedir(), '.codex');
// (con realpath: en Mac /var es un enlace a /private/var y process.cwd() devuelve la ruta real)
const rutaReal = (p) => {
  try {
    return fs.realpathSync.native(p);
  } catch {
    return path.resolve(p);
  }
};
const mismaCarpeta = (a, b) => comparable(barras(rutaReal(a)).replace(/\/+$/, '').normalize('NFC')) === comparable(barras(rutaReal(b)).replace(/\/+$/, '').normalize('NFC'));

function revisarEntorno(problemas) {
  const envProhibidas = Object.keys(process.env).filter((k) => PROHIBIDAS.test(k));
  const home = process.env.CODEX_HOME || '';
  const delUsuario = !home || mismaCarpeta(home, HOME_USUARIO);
  if (envProhibidas.length) problemas.push(`el entorno trae ${envProhibidas.join(', ')}`);
  if (!home) problemas.push('falta CODEX_HOME: Codex usaría ~/.codex');
  else if (delUsuario) problemas.push('CODEX_HOME es la carpeta de Codex del usuario (~/.codex)');
  return { envProhibidas, codexHome: { definido: Boolean(home), delUsuario: Boolean(home) && delUsuario }, noColor: process.env.NO_COLOR === '1' };
}

/** Donde guarda lo suyo: el CODEX_HOME de la app, nunca ~/.codex (ahí, una carpeta temporal propia). */
function carpetaFalsa() {
  const home = process.env.CODEX_HOME;
  if (home && !mismaCarpeta(home, HOME_USUARIO)) return path.resolve(home);
  return path.join(os.tmpdir(), 'codex-falso-sin-home');
}

// marcas de una sola vez y de estado (un archivo por marca: dos procesos a la vez no se pisan)
const dirMarcas = () => path.join(carpetaFalsa(), 'falso-codex');
function marcaUnaVez(nombre, datos = {}) {
  fs.mkdirSync(dirMarcas(), { recursive: true });
  try {
    fs.writeFileSync(path.join(dirMarcas(), `${nombre}.json`), JSON.stringify({ ...datos, desde: ahora() }), { flag: 'wx' });
    return true;
  } catch {
    return false;
  }
}
function ponerMarca(nombre, datos = {}) {
  fs.mkdirSync(dirMarcas(), { recursive: true });
  fs.writeFileSync(path.join(dirMarcas(), `${nombre}.json`), JSON.stringify({ ...datos, desde: ahora() }));
}
const leerMarca = (nombre) => leerJSON(path.join(dirMarcas(), `${nombre}.json`));
const borrarMarca = (nombre) => fs.rmSync(path.join(dirMarcas(), `${nombre}.json`), { force: true });

// ---------------------------------------------------------------- los modos

function modosDe(claves = []) {
  let m = process.env.FALSO_CODEX_MODO || 'ok';
  if (process.env.FALSO_CODEX_CONFIG) {
    const c = leerJSON(process.env.FALSO_CODEX_CONFIG, {}) || {};
    const k = claves.find((x) => x && c[x]);
    if (k) m = c[k];
    else if (c.todo) m = c.todo;
  }
  return new Set(String(m).split('+').map((s) => s.trim()).filter(Boolean));
}

// ---------------------------------------------------------------- la sesion de ChatGPT (de mentira)

const marcaSesion = () => path.join(carpetaFalsa(), 'falso-sesion.json');
function sesionActual() {
  const s = process.env.FALSO_CODEX_SESION;
  if (s === 'ok' || s === 'no' || s === 'api') return s;
  return existe(marcaSesion()) ? 'ok' : 'no';
}
const PLAN = () => process.env.FALSO_CODEX_PLAN || 'plus';

/** La próxima vez que sean las 20:14 (hora local), en segundos unix. */
function proximas2014() {
  const d = new Date();
  d.setHours(20, 14, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return Math.floor(d.getTime() / 1000);
}

function limitesDeAhora() {
  let alcanzado = process.env.FALSO_CODEX_LIMITE === 'si';
  let ordinario = true;
  for (const [nombre, modo] of [['limite', 'limite'], ['limite-a-mitad', 'limite-a-mitad']]) {
    const m = leerMarca(nombre);
    if (!m) continue;
    if (!modosDe(m.claves || []).has(modo)) {
      borrarMarca(nombre);
      continue;
    }
    if (modo === 'limite') alcanzado = true;
    else ordinario = false;
  }
  if (alcanzado) ordinario = false;
  const primary = { usedPercent: alcanzado ? 100 : ordinario ? 12 : 97, windowDurationMins: 10080, resetsAt: proximas2014() };
  const rateLimits = { limitId: 'codex', primary, secondary: null, credits: { hasCredits: false, unlimited: false, balance: '0' }, planType: PLAN(), rateLimitReachedType: alcanzado ? 'rate_limit_reached' : null };
  return { ordinaryUsageAllowed: ordinario, rateLimits, rateLimitsByLimitId: { codex: rateLimits }, rateLimitResetCredits: { availableCount: 0 } };
}

function revisarCuenta(a, problemas, { conEstricto = false } = {}) {
  const faltan = [];
  const malos = [];
  revisarC(configDe(a), C_CUENTA, faltan, malos);
  for (const d of ['secret_auth_storage', 'daemon_auto_start']) if (!a.todos('--disable').includes(d)) faltan.push(`--disable ${d}`);
  if (conEstricto && !a.banderas.has('--strict-config')) faltan.push('--strict-config');
  if (faltan.length) problemas.push(`faltan banderas: ${faltan.join(', ')}`);
  if (malos.length) problemas.push(`banderas con otro valor: ${malos.join(', ')}`);
  return { faltan, malos };
}

function loginStatus(a) {
  const problemas = [];
  const r = { tipo: 'codex-login-status', ...revisarCuenta(a, problemas), ...revisarEntorno(problemas) };
  if (a.banderas.has('--strict-config')) {
    anotar({ ...r, ok: false, problemas: [...problemas, '--strict-config no se acepta en login'] });
    process.stderr.write('Error: --strict-config is not supported for `codex login`\n');
    return salir(1);
  }
  const s = sesionActual();
  anotar({ ...r, sesion: s, ok: !problemas.length, problemas });
  // como el real: el texto va por stderr y stdout queda vacio
  if (s === 'ok') process.stderr.write('Logged in using ChatGPT\n');
  else if (s === 'api') process.stderr.write('Logged in using an API key - sk-falso-****-1234\n');
  else process.stderr.write('Not logged in\n');
  salir(s === 'no' ? 1 : 0);
}

async function login(a) {
  const problemas = [];
  const conCodigo = a.banderas.has('--device-auth');
  const r = { tipo: 'codex-login', conCodigo, ...revisarCuenta(a, problemas), ...revisarEntorno(problemas) };
  if (a.banderas.has('--strict-config')) {
    anotar({ ...r, ok: false, problemas: [...problemas, '--strict-config no se acepta en login'] });
    process.stderr.write('Error: --strict-config is not supported for `codex login`\n');
    return salir(1);
  }
  anotar({ ...r, ok: !problemas.length, problemas });
  const modo = process.env.FALSO_CODEX_LOGIN || 'ok';
  const color = (t) => (process.env.NO_COLOR ? t : `\u001b[1;36m${t}\u001b[0m`);
  if (modo === 'puerto' && !conCodigo) {
    process.stderr.write('Error: failed to bind the login server to 127.0.0.1:1455: address in use (os error 10048)\n');
    return salir(1);
  }
  if (modo === 'sin-codigo' && conCodigo) {
    process.stderr.write('Error: device code login is not enabled for this Codex server. Use the browser login or verify the server URL.\n');
    return salir(1);
  }
  if (conCodigo) {
    process.stdout.write(
      `\nFollow these steps to sign in with ChatGPT using device code authorization:\n\n1. Open this link in your browser and sign in to your account\n   ${color('https://auth.openai.com/codex/device')}\n\n2. Enter this one-time code ${'\u001b[2m'}(expires in 15 minutes)${'\u001b[0m'}\n   ${color('ABCD-12345')}\n\n`
    );
  } else {
    process.stdout.write(`Starting local login server on http://localhost:1455.\nIf your browser did not open, navigate to this URL to authenticate:\n\n${color('https://auth.openai.com/oauth/authorize?falso=1')}\n\n`);
  }
  if (modo === 'cuelga') return setInterval(() => {}, 1 << 30);
  await dormir(Number(process.env.FALSO_CODEX_LOGIN_MS) || 2000);
  fs.mkdirSync(carpetaFalsa(), { recursive: true });
  fs.writeFileSync(marcaSesion(), JSON.stringify({ falso: true, email: 'alumno@ejemplo.com', desde: ahora() }));
  process.stdout.write('Successfully logged in\n');
  salir(0);
}

function logout(a) {
  const problemas = [];
  anotar({ tipo: 'codex-logout', ...revisarCuenta(a, problemas), ...revisarEntorno(problemas), ok: !problemas.length, problemas });
  fs.rmSync(marcaSesion(), { force: true });
  process.stdout.write('Successfully logged out\n');
  salir(0);
}

function borrarHilo(a) {
  const problemas = [];
  const hilo = a.pos[1] || '';
  anotar({ tipo: 'codex-delete', hilo, ...revisarCuenta(a, problemas), ...revisarEntorno(problemas), ok: !problemas.length, problemas });
  const f = rutaSesion(hilo);
  if (!f || !existe(f)) {
    process.stderr.write(`Error: thread not found: ${hilo}\n`);
    return salir(1);
  }
  fs.rmSync(f, { force: true });
  process.stdout.write(`Deleted thread ${hilo}\n`);
  salir(0);
}

function appServer(a) {
  const problemas = [];
  const faltan = [];
  const malos = [];
  if (!a.banderas.has('--strict-config')) faltan.push('--strict-config');
  for (const d of DISABLE) if (!a.todos('--disable').includes(d)) faltan.push(`--disable ${d}`);
  revisarC(configDe(a), { ...C_CUENTA, check_for_update_on_startup: (v) => v === false }, faltan, malos);
  if (faltan.length) problemas.push(`faltan banderas: ${faltan.join(', ')}`);
  if (malos.length) problemas.push(`banderas con otro valor: ${malos.join(', ')}`);
  const ent = revisarEntorno(problemas);
  anotar({ tipo: 'codex-app-server', faltan, malos, ...ent, ok: !problemas.length, problemas });
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', (l) => {
    let m;
    try {
      m = JSON.parse(l);
    } catch {
      return;
    }
    if (m?.id === undefined || m.id === null) return; // una notificacion
    const base = m.jsonrpc ? { jsonrpc: '2.0', id: m.id } : { id: m.id };
    const ok = (result) => emitir({ ...base, result });
    const mal = (code, message) => emitir({ ...base, error: { code, message } });
    const s = sesionActual();
    if (m.method === 'initialize') return ok({ userAgent: `codex_cli_rs/${VERSION} (codex falso)` });
    if (m.method === 'account/read') {
      if (s === 'ok') return ok({ account: { type: 'chatgpt', email: 'alumno@ejemplo.com', planType: PLAN() }, requiresOpenaiAuth: true });
      if (s === 'api') return ok({ account: { type: 'apiKey' }, requiresOpenaiAuth: true });
      return ok({ account: null, requiresOpenaiAuth: true });
    }
    if (m.method === 'account/rateLimits/read') {
      if (s !== 'ok') return mal(-32600, 'codex account authentication required to read rate limits');
      return ok(limitesDeAhora());
    }
    return mal(-32601, `method not found: ${m.method}`);
  });
  rl.on('close', () => salir(0));
}

// ---------------------------------------------------------------- el mensaje

const CABECERAS = [
  ['material', /^## MATERIAL(?: NUEVO)?\s*$/],
  ['imagenes', /^## IMÁGENES ADJUNTAS/],
  ['disponibles', /^## DISPONIBLES SI LOS PIDES/],
  ['tarea', /^## TAREA\s*$/],
  ['escribir', /^## LO QUE PUEDES ESCRIBIR/],
  ['comandos', /^## COMANDOS QUE LA APP CORRE POR TI/],
];
const RX_MODO_APP = /^# MODO APP\b/m;
const RX_COMO_TRABAJAS = /^# CÓMO TRABAJAS AQUÍ/m;
// la clave falsa del .env de la prueba de humo, o una linea de clave (la skill de imagen trae un ejemplo: ese no cuenta)
const RX_SECRETO = /simulada-prueba-de-humo|(?:^|[^`\w])(?:KIE|ELEVENLABS)_API_KEY=(?!pega_aqui_tu_clave\b|tu_clave\b)[^\s`]/m;

function analizarMensaje(crudo) {
  const texto = String(crudo).normalize('NFC');
  const L = texto.split('\n').map((l) => l.replace(/\r$/, ''));
  const archivos = [];
  const carpetas = [];
  const dentro = new Uint8Array(L.length);
  const sinFin = [];
  for (let i = 0; i < L.length; i++) {
    // ARCHIVO y CARPETA (el material) y ANTES (lo de antes de cada toma tocada): lo de adentro no se lee como partes
    const a = L[i].match(/^===== (ARCHIVO|CARPETA|ANTES): (.+) =====$/);
    if (!a) continue;
    const ruta = a[1] === 'ANTES' ? a[2].trim() : a[2].replace(/ \((?:[\d.,]+\s*(?:bytes?|[KMG]?B)|[\d.,]+ archivos?|[^()]*caracteres)\)$/i, '').trim();
    let j = i + 1;
    while (j < L.length && L[j] !== `===== FIN: ${ruta} =====`) j++;
    if (j >= L.length && a[1] !== 'ANTES') sinFin.push(ruta);
    if (a[1] === 'ARCHIVO') archivos.push({ ruta: rel(ruta) });
    else if (a[1] === 'CARPETA') carpetas.push({ ruta: rel(ruta) });
    for (let k = i; k <= Math.min(j, L.length - 1); k++) dentro[k] = 1;
    i = j;
  }
  const fuera = L.filter((_, i) => !dentro[i]);
  const esqueleto = fuera.join('\n');
  const marcas = [];
  for (let i = 0; i < L.length; i++) {
    if (dentro[i]) continue;
    for (const [n, rx] of CABECERAS) if (rx.test(L[i])) marcas.push({ nombre: n, linea: i });
  }
  const seccion = (n, hasta = null) => {
    const m = marcas.find((x) => x.nombre === n);
    if (!m) return null;
    const sig = marcas.find((x) => x.linea > m.linea && (!hasta || hasta.includes(x.nombre)));
    return L.slice(m.linea + 1, sig ? sig.linea : L.length).join('\n');
  };
  const tarea = (seccion('tarea', ['escribir', 'comandos']) ?? '').replace(/^\s*\n/, '').replace(/\n\s*$/, '').trim() || null;
  const listaImagenes = [];
  for (const l of (seccion('imagenes') || '').split('\n')) {
    const m = l.match(/Image #(\d+)\s*[=:]\s*(.+)$/i);
    if (m) listaImagenes.push({ n: Number(m[1]), ruta: rutaDeLinea(m[2]) });
  }
  const disponibles = [];
  for (const l of (seccion('disponibles') || '').split('\n')) {
    if (!l.trim()) continue;
    const r = rutaDeLinea(l);
    if (RX_CON_EXT.test(r)) disponibles.push(r);
    else disponibles.push(...rutasEn(l));
  }
  const comandos = [];
  for (const l of (seccion('comandos') || '').split('\n')) {
    const c = l.trim().replace(/^[-*•]\s+/, '').replace(/^`|`$/g, '').trim();
    if (/^node\s+produccion[\\/]/.test(c)) {
      const n = barras(c).replace(/\s+/g, ' ');
      if (!comandos.includes(n)) comandos.push(n);
    }
  }
  const sinCambios = [];
  for (const l of fuera) {
    const m = l.match(/\(sin cambios desde la última vez: (.+)\)/);
    if (m) for (const r of m[1].split(/,\s*/)) sinCambios.push(rel(r.replace(/^`|`$/g, '')));
  }
  let clase = 'otro';
  if (tarea && marcas.some((x) => x.nombre === 'escribir')) clase = /^\s*\(Tarea nueva en esta misma conversación/.test(texto) ? 'retoma' : /^\s*\(Esta tarea ya empezó en otra conversación/.test(texto) ? 'deNuevo' : 'tarea';
  else if (texto.includes('La app revisó lo que escribiste y todavía no está bien')) clase = 'correccion';
  else if (texto.includes('Tu respuesta anterior llegó cortada')) clase = 'cortada';
  else if (/^\s*RESULTADO DE TU MENSAJE ANTERIOR/.test(texto)) clase = 'resultado';
  else if (texto.includes('Ya tienes todas las imágenes')) clase = 'imagenes';
  else if (texto.includes('Tu respuesta no fue el JSON pedido')) clase = 'json';
  else if (texto.includes('No tienes herramientas ni subagentes')) clase = 'herramientas';
  else if (/^\s*Cambiaste [\s\S]*?El usuario pidió: «/.test(texto)) clase = 'tomasTocadas';
  // «Faltan 3 imágenes: llegan…» o «Falta 1 imagen: llega…» (lib/ia/material.js, lineaFaltanImagenes)
  const faltanImagenes = Number((esqueleto.match(/Faltan? (\d+) (?:imágenes|imagen): llegan? en el próximo mensaje/) || [])[1]) || 0;
  return {
    texto,
    largo: texto.length,
    esqueleto,
    clase,
    tarea,
    escribir: seccion('escribir', ['comandos']) || '',
    archivos,
    carpetas,
    sinFin,
    listaImagenes,
    disponibles,
    comandos,
    sinCambios,
    faltanImagenes,
    partes: Object.fromEntries(CABECERAS.map(([n]) => [n, marcas.some((x) => x.nombre === n)])),
  };
}

/** Los patrones de LO QUE PUEDES ESCRIBIR: archivos exactos, comodines y carpetas (desde la raíz). */
function patronesDeEscritura(seccion) {
  const t = String(seccion || '').normalize('NFC');
  const rx = new RegExp(`(?:${RAICES.map(escapar).join('|')})[\\\\/][^\\s\`"«»,;()]*|(?<![\\w/\\\\.-])(?:\\.\\/)?(?:temp|\\.claude|recursos)[\\\\/][^\\s\`"«»,;()]*`, SIN_MAYUSCULAS ? 'gi' : 'g');
  const pats = new Set();
  for (const m of t.matchAll(rx)) {
    const s = rel(m[0].replace(/[.:]+$/, ''));
    if (s) pats.add(s);
  }
  return [...pats];
}
function puedeEscribir(r, pats) {
  const k = comparable(r);
  return pats.some((p) => {
    const q = comparable(p);
    if (q.includes('*')) return globARegex(q).test(k);
    if (/\.[a-z0-9]+$/i.test(q)) return q === k;
    return k.startsWith(`${q.replace(/\/+$/, '')}/`);
  });
}
// lo que escribe la app o el motor (nunca un Claude falso): no se le atribuye si no lo anuncio
const DE_LA_APP = [
  /\/app\/(brief|sesion|conductor|proceso|informe|montaje|edicion|voces|ventanas|ugc|habla|manifiesto-antes-de-ventanas)\.json$/i,
  /\/app\/[^/]*-estado\.json$/i,
  /\/app\/(cancion|clips|control-final)-[^/]*\.json$/i,
  /\/app\/(rehacer|exportes|gasto|registro|historial-guion|edicion)\//i,
  /\/(img|video|audio|musica|qa|efectos|registro)\//i,
  /(^|\/)(modelos|estado|log-modelos|tarea)\.json$/i,
];
const deLaApp = (r) => DE_LA_APP.some((rx) => rx.test(`/${r}`));

// ---------------------------------------------------------------- lo que tiene que llegar (material-esperado.json)

let LISTA = null;
const lista = () => (LISTA ||= leerJSON(path.join(AQUI, 'material-esperado.json'), { tareas: [], nuncaDeben: [] }));
const entradaDe = (tarea) => (tarea ? lista().tareas.find((t) => new RegExp(t.reconocer, 'm').test(tarea)) || null : null);

function marcasDe(tarea) {
  const m = {};
  const carpeta = (rx) => {
    const x = String(tarea || '').match(rx);
    return x ? rel(x[1].trim().replace(/[`.]+$/, '')) : null;
  };
  const anuncio = carpeta(/^Carpeta del anuncio: (.+)$/m);
  const lote = carpeta(/^Carpeta del lote: (.+)$/m);
  const producto = carpeta(/^Carpeta del producto: (.+)$/m);
  if (anuncio) {
    m.carpeta = anuncio;
    if (/^temp\//i.test(anuncio)) m.slug = anuncio.slice(5);
  }
  if (lote) {
    m.carpeta ||= lote;
    if (/^temp\//i.test(lote)) m.lote = lote.slice(5);
  }
  if (producto) {
    m.carpeta ||= producto;
    m.producto = producto;
  } else {
    const p = String(tarea || '').normalize('NFC').match(/temp[\\/]_productos[\\/]([^\\/\s`'"»,;)]+)/);
    if (p) m.producto = `temp/_productos/${p[1]}`;
  }
  const s = String(tarea || '').match(/\.claude[\\/]skills[\\/]([a-z0-9-]+)[\\/]SKILL\.md/i);
  if (s) m.skill = s[1];
  return m;
}
const conMarcas = (t, m) => {
  let falta = false;
  const r = String(t).replace(/<(\w+)>/g, (_, n) => {
    if (m[n] === undefined) falta = true;
    return m[n] ?? '';
  });
  return falta ? null : r;
};

/** Las rutas que pide una entrada de la lista: [{ ruta, como }]. */
function resolver(it, m, tarea) {
  const como = (r) => {
    if (it.como === 'imagen') return EXT_IMAGEN.test(r) ? 'imagen' : null;
    if (it.como === 'texto' || it.como === 'pegado') return EXT_TEXTO.test(r) ? it.como : null;
    return EXT_IMAGEN.test(r) ? it.comoImagen || 'imagen' : EXT_TEXTO.test(r) ? it.comoTexto || 'texto' : null;
  };
  let rutas = [];
  if (it.ruta) {
    const p = conMarcas(it.ruta, m);
    if (p) rutas = expandir(p);
  } else if (it.enLineas) {
    const rx = new RegExp(it.enLineas);
    let texto = tarea;
    if (it.enArchivo) {
      const f = conMarcas(it.enArchivo, m);
      texto = f && !esSecreto(f) ? (() => {
        try {
          return fs.readFileSync(abs(f), 'utf8');
        } catch {
          return '';
        }
      })() : '';
    }
    for (const l of String(texto).normalize('NFC').split(/\r?\n/)) {
      const x = l.match(rx);
      if (!x) continue;
      if (it.plantilla) {
        const p = conMarcas(it.plantilla.replace(/\$(\d)/g, (_, i) => x[Number(i)] ?? ''), m);
        if (p) rutas.push(...expandir(p));
      } else rutas.push(...rutasEn(l).filter((r) => existe(abs(r))));
    }
  } else if (it.json) {
    const f = conMarcas(it.json.archivo, m);
    const pre = conMarcas(it.json.prefijo || '', m) ?? '';
    const v = f ? leerJSON(abs(f)) : null;
    for (const x of Array.isArray(v?.[it.json.campo]) ? v[it.json.campo] : []) if (typeof x === 'string' && existe(abs(pre + x))) rutas.push(pre + x);
  } else if (it.especial === 'hojas' && m.carpeta) {
    const man = leerJSON(abs(`${m.carpeta}/manifiesto.json`));
    for (const r of Array.isArray(man?.referencias) ? man.referencias : []) {
      const x = ['png', 'jpg'].map((e) => `${m.carpeta}/img/${r?.id}.${e}`).find((y) => r?.id && existe(abs(y)));
      if (x) rutas.push(x);
    }
  } else if ((it.especial === 'formatos-de-la-tanda' || it.especial === 'referencias-de-la-tanda') && m.lote) {
    const ids = ((String(tarea).match(/Haz solo el PASO 5 de:? ([^.\n]+)\./) || [])[1]?.match(/V\d{2,3}/g)) || [];
    const plan = leerJSON(abs(`temp/${m.lote}/plan.json`));
    const indice = leerJSON(abs('.claude/skills/anuncios-imagen-ads/formatos/indice.json'));
    for (const id of ids) {
      const v = (plan?.variaciones || []).find((x) => x?.id === id);
      if (!v) continue;
      if (it.especial === 'formatos-de-la-tanda' && v.fuente !== 'referencia' && v.formato_id) {
        const f = (indice?.formatos || []).find((y) => y.id === v.formato_id);
        if (f?.archivo) rutas.push(`.claude/skills/anuncios-imagen-ads/${f.archivo}`);
      }
      if (it.especial === 'referencias-de-la-tanda' && v.fuente === 'referencia' && v.referencia) {
        const r = String(v.referencia);
        rutas.push(r.startsWith('temp/') ? r : `temp/${m.lote}/${r.replace(/^.*?(entrada\/referencias\/)/i, '$1')}`);
      }
    }
    rutas = rutas.filter((r) => existe(abs(r)));
  }
  const out = [];
  for (const r of rutas) {
    const c = como(r);
    if (c && !esSecreto(r)) out.push({ ruta: rel(r), como: c });
  }
  return out;
}

function esperadoPara(tarea) {
  const e = entradaDe(tarea);
  if (!e) return { id: null, tipo: null, deben: [], noDeben: [] };
  const m = marcasDe(tarea);
  const vale = (it) => !it.si || new RegExp(it.si, 'm').test(tarea);
  const unir = (items) => {
    const vistos = new Map();
    for (const it of items.filter(vale)) for (const x of resolver(it, m, tarea)) if (!vistos.has(clave(x.ruta))) vistos.set(clave(x.ruta), x);
    return [...vistos.values()];
  };
  return { id: e.id, tipo: e.tipo, deben: unir(e.deben || []), noDeben: unir((e.noDeben || []).map((x) => ({ como: 'segun-extension', ...x }))) };
}

/** Lo que llegó en un mensaje: { pegados, sinCambios, disponibles, imagenes } (claves). */
function llegadoDe(msg, imagenesExtra = []) {
  return {
    pegados: new Set(msg.archivos.map((a) => clave(a.ruta))),
    sinCambios: new Set(msg.sinCambios.map(clave)),
    disponibles: new Set(msg.disponibles.map(clave)),
    imagenes: new Set([...msg.listaImagenes.map((x) => clave(x.ruta)), ...imagenesExtra.map(clave)]),
  };
}

function revisarMaterial(tarea, llegado) {
  const esp = esperadoPara(tarea);
  const llego = (e) => {
    const k = clave(e.ruta);
    if (e.como === 'imagen') return llegado.imagenes.has(k);
    if (e.como === 'pegado') return llegado.pegados.has(k) || llegado.sinCambios.has(k);
    return llegado.pegados.has(k) || llegado.sinCambios.has(k) || llegado.disponibles.has(k);
  };
  const algo = (k) => llegado.pegados.has(k) || llegado.disponibles.has(k) || llegado.imagenes.has(k);
  const materialFaltante = esp.deben.filter((e) => !llego(e)).map((e) => `${e.como}: ${e.ruta}`);
  const materialDeMas = esp.noDeben.filter((e) => algo(clave(e.ruta))).map((e) => e.ruta);
  const nunca = (lista().nuncaDeben || []).map((x) => new RegExp(x, 'i'));
  for (const k of [...llegado.pegados, ...llegado.disponibles, ...llegado.imagenes]) if (nunca.some((rx) => rx.test(k)) && !materialDeMas.includes(k)) materialDeMas.push(k);
  return { material: esp.id, tipoDeTarea: esp.tipo, materialEsperado: esp.deben.length, materialFaltante, materialDeMas };
}

// ---------------------------------------------------------------- la conversacion guardada (para los resume)

function rutaSesion(hilo) {
  if (!/^[\w-]{6,80}$/.test(String(hilo || ''))) return null;
  return path.join(carpetaFalsa(), 'sessions', `${hilo}.json`);
}
const cargarSesion = (hilo) => {
  const f = rutaSesion(hilo);
  return f ? leerJSON(f) : null;
};
function guardarSesion(ses) {
  const f = rutaSesion(ses.hilo);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  ses.usado = ahora();
  const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(ses));
  fs.renameSync(tmp, f);
}

function carpetasDe(marcas, pats) {
  const c = new Set();
  if (marcas.carpeta) c.add(marcas.carpeta);
  for (const p of pats) {
    const d = p.includes('*') ? p.slice(0, p.indexOf('*')).replace(/\/[^/]*$/, '') : /\.[a-z0-9]+$/i.test(p) ? p.replace(/\/[^/]*$/, '') : p.replace(/\/+$/, '');
    if (d) c.add(d);
  }
  const todas = [...c].filter((d) => /^temp\/[^/]+/i.test(d) && !d.includes('..'));
  return todas.filter((d) => !todas.some((o) => o !== d && comparable(d).startsWith(`${comparable(o)}/`)));
}

function nuevoSegmento(ses, msg) {
  const e = entradaDe(msg.tarea);
  const marcas = marcasDe(msg.tarea);
  const pats = patronesDeEscritura(msg.escribir);
  const seg = {
    uuid: crypto.randomUUID(),
    id: e?.id || null,
    tipo: e?.tipo || null,
    claves: [e?.id, e?.tipo, (msg.tarea.match(/^TAREA: (\S+)/m) || [])[1]].filter(Boolean),
    marca: `${e?.id || 'tarea'}-${sha1(marcas.carpeta || msg.tarea.slice(0, 300)).slice(0, 10)}`,
    tarea: msg.tarea,
    marcas,
    pats,
    carpetas: carpetasDe(marcas, pats),
    comandos: msg.comandos,
    disponibles: msg.disponibles,
    pegados: msg.archivos.map((a) => a.ruta),
    retoma: msg.clase === 'retoma',
    deNuevo: msg.clase === 'deNuevo',
    conversacion: [{ texto: msg.tarea, procesado: false }],
    producido: {},
    enviados: {},
    resultadoClaude: null,
    f: {},
  };
  ses.segmentos.push(seg);
  return seg;
}

// ---------------------------------------------------------------- el puente con los Claude falsos

function escanear(carpetas) {
  const archivos = new Map();
  const dirs = new Set();
  const visitar = (dir, hondo) => {
    let ents;
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    dirs.add(clave(dir));
    for (const e of ents) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'node_modules' && e.name !== '.git' && hondo < 10) visitar(f, hondo + 1);
        continue;
      }
      if (!e.isFile()) continue;
      let st;
      try {
        st = fs.statSync(f);
      } catch {
        continue;
      }
      const r = rel(f);
      const it = { r, size: st.size, mtimeMs: st.mtimeMs, atimeMs: st.atimeMs };
      if (ESCRIBIBLE.test(e.name) && st.size <= 3e6 && !esSecreto(r)) {
        try {
          it.buf = fs.readFileSync(f);
        } catch {
          /* se esta escribiendo */
        }
      }
      archivos.set(comparable(r), it);
    }
  };
  for (const c of carpetas) visitar(abs(c), 0);
  return { archivos, dirs };
}

function restaurar(c) {
  const f = abs(c.r);
  if (!c.antes) return fs.rmSync(f, { force: true });
  const tmp = `${f}.codex-falso-${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, c.antes.buf);
    fs.renameSync(tmp, f);
  } catch {
    fs.rmSync(tmp, { force: true });
    fs.writeFileSync(f, c.antes.buf);
  }
  try {
    // la misma fecha de antes: la app mira tamaño y fecha de lo que reviso
    fs.utimesSync(f, new Date(c.antes.atimeMs), new Date(c.antes.mtimeMs));
  } catch {
    /* sin fecha */
  }
}

/**
 * Corre el Claude falso con la conversacion del segmento: lo que hizo con cada mensaje nuevo queda en seg.producido;
 * el disco queda como estaba. { ok, error?, quedanEnDisco, fueraDeLaFoto, ajenos }
 */
async function puente(seg) {
  const conv = seg.conversacion;
  const bin = process.env.FALSO_CODEX_CLAUDE ? path.resolve(RAIZ, process.env.FALSO_CODEX_CLAUDE) : path.join(AQUI, 'claude-falso.js');
  const env = { ...process.env };
  delete env.FALSO_ARGS; // lo de este falso; el de Claude anotaria otra cosa en el mismo archivo
  delete env.FALSO_DESPACHADO;
  const args = [
    '-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    '--permission-mode', 'dontAsk', '--permission-prompts', 'none', '--setting-sources', 'project', '--strict-mcp-config',
    '--max-turns', '80', seg.retoma ? '--resume' : '--session-id', seg.uuid,
    '--append-system-prompt', '(el MODO APP le llega a Codex en developer_instructions)',
    '--tools', 'Read,Glob,Grep,Write,Edit,Bash,PowerShell',
  ];
  const hijo = spawn(process.execPath, [bin, ...args], { cwd: RAIZ, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  hijo.stdin.on('error', () => {});
  const resultados = [];
  let esperando = null;
  let salio = false;
  let reclamados = new Set();
  let errTxt = '';
  let buffer = '';
  const avisar = (r) => {
    if (esperando) {
      const f = esperando;
      esperando = null;
      f(r);
    } else resultados.push(r);
  };
  hijo.stdout.on('data', (d) => {
    buffer += d.toString('utf8');
    let i;
    while ((i = buffer.indexOf('\n')) >= 0) {
      const l = buffer.slice(0, i).trim();
      buffer = buffer.slice(i + 1);
      if (!l) continue;
      let ev;
      try {
        ev = JSON.parse(l);
      } catch {
        continue;
      }
      if (ev.type === 'assistant') {
        for (const b of ev.message?.content || []) if (b?.type === 'tool_use' && /^(Write|Edit|MultiEdit|NotebookEdit)$/.test(b.name) && b.input?.file_path) reclamados.add(clave(b.input.file_path));
      } else if (ev.type === 'result') avisar({ ok: !ev.is_error && ev.subtype === 'success', ev });
    }
  });
  hijo.stderr.on('data', (d) => {
    errTxt = (errTxt + d.toString('utf8')).slice(-2000);
  });
  hijo.on('exit', () => {
    salio = true;
    avisar({ ok: false, salio: true });
  });
  hijo.on('error', (e) => {
    errTxt += String(e.message);
    salio = true;
    avisar({ ok: false, salio: true });
  });
  const tope = Number(process.env.FALSO_CODEX_TOPE_CLAUDE) || 180000;
  const esperar = () =>
    new Promise((res) => {
      if (resultados.length) return res(resultados.shift());
      esperando = res;
      setTimeout(() => {
        if (esperando === res) {
          esperando = null;
          res({ ok: false, tiempo: true });
        }
      }, tope).unref?.();
    });

  const info = { ok: true, quedanEnDisco: [], fueraDeLaFoto: [], ajenos: [] };
  for (let j = 0; j < conv.length; j++) {
    if (salio) break;
    const antes = escanear(seg.carpetas);
    reclamados = new Set();
    hijo.stdin.write(`${JSON.stringify({ type: 'user', message: { role: 'user', content: conv[j].texto } })}\n`);
    const r = await esperar();
    await dormir(30); // que termine de escribir lo ultimo
    const despues = escanear(seg.carpetas);
    const cambios = [];
    for (const k of new Set([...antes.archivos.keys(), ...despues.archivos.keys()])) {
      const a = antes.archivos.get(k);
      const d = despues.archivos.get(k);
      const igual = a && d && (a.buf && d.buf ? a.buf.equals(d.buf) : a.size === d.size && a.mtimeMs === d.mtimeMs);
      if (igual || (!a && !d)) continue;
      const r0 = (d || a).r;
      const texto = ESCRIBIBLE.test(r0) && !esSecreto(r0);
      const atribuible = reclamados.has(k) || (texto && puedeEscribir(r0, seg.pats) && !deLaApp(r0));
      if (!atribuible) {
        if (!conv[j].procesado) info.ajenos.push(r0);
        continue;
      }
      // lo binario (o un texto de mas de 3 MB, que no se guardo antes) queda en el disco: no se puede devolver
      if (!texto || (a && !a.buf)) {
        if (!conv[j].procesado && !info.quedanEnDisco.includes(r0)) info.quedanEnDisco.push(r0);
        continue;
      }
      cambios.push({ r: r0, antes: a || null, ahora: d?.buf ?? (d ? fs.readFileSync(abs(r0)) : null) });
    }
    // lo que anuncio fuera de las carpetas de la foto: se toma, pero no se puede dejar como estaba
    for (const k of reclamados) {
      if (antes.archivos.has(k) || despues.archivos.has(k)) continue;
      const r0 = rel(k);
      if (!ESCRIBIBLE.test(r0) || esSecreto(r0) || !existe(abs(r0))) continue;
      info.fueraDeLaFoto.push(r0);
      if (!conv[j].procesado) seg.producido[r0] = fs.readFileSync(abs(r0), 'utf8');
    }
    if (!conv[j].procesado) {
      for (const c of cambios) {
        if (c.ahora) seg.producido[c.r] = c.ahora.toString('utf8');
        else delete seg.producido[c.r];
      }
      if (r.ev) seg.resultadoClaude = String(r.ev.result || '').trim() || seg.resultadoClaude;
    }
    for (const c of cambios) restaurar(c);
    // las carpetas que creo y quedaron vacias
    for (const d of [...despues.dirs].filter((x) => !antes.dirs.has(x)).sort((x, y) => y.length - x.length)) {
      try {
        fs.rmdirSync(abs(rel(d)));
      } catch {
        /* no esta vacia */
      }
    }
    if (!r.ok) {
      // un falso que se cierra despues del primer mensaje (el de rehacer) no contesta los siguientes: no es un error;
      // si falla el primero, o contesta con un error a uno nuevo, si
      if (j === 0 || (r.ev && !conv[j].procesado)) {
        info.ok = false;
        info.error = r.tiempo ? 'el Claude falso no contestó a tiempo' : r.salio ? `el Claude falso se cerró sin terminar${errTxt ? `: ${errTxt.trim().slice(-300)}` : ''}` : `el Claude falso no terminó: ${String(r.ev?.result || r.ev?.subtype || '').slice(0, 300)}`;
      }
      conv[j].procesado = true;
      break;
    }
    conv[j].procesado = true;
  }
  for (const x of conv) x.procesado = true;
  try {
    hijo.stdin.end();
  } catch {
    /* ya salio */
  }
  const fin = Date.now() + 3000;
  while (!salio && Date.now() < fin) await dormir(20);
  if (!salio) hijo.kill();
  return info;
}

// ---------------------------------------------------------------- archivos y ediciones

const partirLineas = (t) => t.match(/[^\n]*\n|[^\n]+$/g) || [];
function contar(texto, buscado) {
  let n = 0;
  let i = -1;
  while ((i = texto.indexOf(buscado, i + 1)) !== -1) if (++n > 1) break;
  return n;
}
const aplicarUna = (texto, e) => {
  const i = texto.indexOf(e.buscar);
  return texto.slice(0, i) + e.reemplazar + texto.slice(i + e.buscar.length);
};

/** Los tramos distintos entre dos listas de líneas: [{ ai, aj, bi, bj }]. */
function tramosDe(A, B) {
  let p = 0;
  while (p < A.length && p < B.length && A[p] === B[p]) p++;
  let s = 0;
  while (s < A.length - p && s < B.length - p && A[A.length - 1 - s] === B[B.length - 1 - s]) s++;
  const n = A.length - p - s;
  const m = B.length - p - s;
  if (!n || !m || n * m > 4e6) return [{ ai: p, aj: A.length - s, bi: p, bj: B.length - s }];
  const ids = new Map();
  const id = (l) => {
    if (!ids.has(l)) ids.set(l, ids.size);
    return ids.get(l);
  };
  const a = Int32Array.from(A.slice(p, p + n), id);
  const b = Int32Array.from(B.slice(p, p + m), id);
  const W = m + 1;
  const L = new Uint32Array((n + 1) * W);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i * W + j] = a[i] === b[j] ? L[(i + 1) * W + j + 1] + 1 : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
  const tramos = [];
  let i = 0;
  let j = 0;
  let t = null;
  const cerrar = () => {
    if (!t) return;
    t.aj = p + i;
    t.bj = p + j;
    tramos.push(t);
    t = null;
  };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      cerrar();
      i++;
      j++;
      continue;
    }
    if (!t) t = { ai: p + i, bi: p + j };
    if (i < n && (j >= m || L[(i + 1) * W + j] >= L[i * W + j + 1])) i++;
    else j++;
  }
  cerrar();
  const juntos = [];
  for (const x of tramos) {
    const u = juntos[juntos.length - 1];
    if (u && x.ai - u.aj < 3) {
      u.aj = x.aj;
      u.bj = x.bj;
    } else juntos.push({ ...x });
  }
  return juntos;
}

/** Las ediciones que llevan `antes` a `despues` (cada buscar, una sola vez en su momento), o null: mejor entero. */
function edicionesDe(antes, despues) {
  if (antes === despues) return [];
  if (!antes) return null;
  const A = partirLineas(antes);
  const B = partirLineas(despues);
  const tramos = tramosDe(A, B);
  if (!tramos.length || tramos.length > 40) return null;
  const actual = A.slice();
  let corrimiento = 0;
  const eds = [];
  for (const t of tramos) {
    const i0 = t.ai + corrimiento;
    const i1 = t.aj + corrimiento;
    const nuevas = B.slice(t.bi, t.bj);
    const todo = actual.join('');
    let c0 = i0;
    let c1 = i1;
    let turno = true;
    for (;;) {
      const buscar = actual.slice(c0, c1).join('');
      if (buscar && contar(todo, buscar) === 1) break;
      const puedeAntes = c0 > 0;
      const puedeDespues = c1 < actual.length;
      if (!puedeAntes && !puedeDespues) break;
      if (puedeAntes && (turno || !puedeDespues)) c0--;
      else c1++;
      turno = !turno;
    }
    const buscar = actual.slice(c0, c1).join('');
    if (!buscar) return null;
    const reemplazo = [...actual.slice(c0, i0), ...nuevas, ...actual.slice(i1, c1)];
    eds.push({ buscar, reemplazar: reemplazo.join('') });
    actual.splice(c0, c1 - c0, ...reemplazo);
    corrimiento += nuevas.length - (t.aj - t.ai);
  }
  let x = antes;
  for (const e of eds) {
    if (contar(x, e.buscar) !== 1) return null;
    x = aplicarUna(x, e);
  }
  return x === despues ? eds : null;
}

/** Un pedazo que aparece por lo menos 2 veces (para la edición mala de ediciones-mal). */
function repetido(texto) {
  const cuenta = new Map();
  for (const l of partirLineas(texto)) if (l.trim()) cuenta.set(l, (cuenta.get(l) || 0) + 1);
  let mejor = null;
  for (const [l, n] of cuenta) if (n >= 2 && (!mejor || l.length > mejor.length)) mejor = l;
  if (mejor) return mejor;
  for (const ch of ['"', '{', ':', ',', ' ']) if (contar(texto, ch) >= 2) return ch;
  return null;
}

const mitad = (t) => t.slice(0, Math.max(1, Math.floor(t.length / 2)));
const leerTexto = (r) => {
  if (esSecreto(r)) return null;
  try {
    return fs.readFileSync(abs(r), 'utf8');
  } catch {
    return null;
  }
};

/** Lo que el falso produjo y todavía no está en el disco (ni se mandó ya igual y la app lo rechazó). */
function pendientesDe(seg, info) {
  const out = [];
  for (const [r, contenido] of Object.entries(seg.producido)) {
    if (esSecreto(r)) continue;
    const actual = leerTexto(r);
    if (actual === contenido) continue;
    if (seg.enviados[r] && seg.enviados[r] === sha1(contenido)) {
      (info.yaEnviados ||= []).push(r);
      continue;
    }
    out.push({ r, actual, contenido });
  }
  return out;
}

/** La ruta como la nombra la tarea: la absoluta si la tarea la da así (voz en off), si no, desde la raíz. */
function comoLaTarea(seg, r) {
  const nativa = path.join(RAIZ, ...r.split('/')).normalize('NFC');
  return comparable(seg.tarea.normalize('NFC')).includes(comparable(nativa)) ? nativa : r;
}

/** Algo para pedir en `leer`: una skill de DISPONIBLES, otro de DISPONIBLES o la skill de la tarea. */
function algoParaLeer(seg) {
  return (
    seg.disponibles.find((x) => /^\.claude\/skills\//i.test(x)) ||
    seg.disponibles[0] ||
    (seg.marcas.skill ? `.claude/skills/${seg.marcas.skill}/SKILL.md` : null) ||
    seg.pegados[0] ||
    null
  );
}

function rutasFuera(seg) {
  const c = seg.marcas.carpeta || 'temp/x';
  const extra = ['../.env', 'app/config.json', 'temp/otro/x.json', `${c}/app/conductor.json`, `${c}/x.js`, `${c}/modelos.json`, `${c}/img/log-modelos.json`, `${c}/video/x.json`];
  if (seg.id === 'ficha') extra.push(`${c}/producto.json`);
  return extra;
}
const estadoDe = (r) => {
  try {
    const st = fs.statSync(abs(r));
    return { existe: true, size: st.size, mtimeMs: st.mtimeMs };
  } catch {
    return { existe: false };
  }
};

// ---------------------------------------------------------------- exec / exec resume

function revisarBanderasExec(a, esResume, problemas) {
  const faltan = [];
  const malos = [];
  const deMas = [];
  for (const b of ['--json', '--strict-config', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules']) if (!a.banderas.has(b)) faltan.push(b);
  for (const d of DISABLE) if (!a.todos('--disable').includes(d)) faltan.push(`--disable ${d}`);
  const c = configDe(a);
  revisarC(c, C_EXEC, faltan, malos);
  if (esResume) {
    const sm = c.get('sandbox_mode');
    if (!sm) faltan.push('-c sandbox_mode');
    else if (sm.valor !== 'read-only') malos.push(`-c sandbox_mode=${resumir(sm.crudo)}`);
  } else {
    if (!a.uno('-s')) faltan.push('-s read-only');
    else if (a.uno('-s') !== 'read-only') malos.push(`-s ${a.uno('-s')}`);
    if (!a.uno('-C')) faltan.push('-C <carpeta de trabajo>');
  }
  const esquema = a.uno('--output-schema');
  if (!esquema) faltan.push('--output-schema');
  else {
    const e = leerJSON(path.resolve(process.cwd(), esquema));
    const req = Array.isArray(e?.required) ? e.required : [];
    if (!e) malos.push(`--output-schema ${resumir(esquema)} (no existe o no es JSON)`);
    else if (ESQUEMA_CAMPOS.some((k) => !req.includes(k)) || e.additionalProperties !== false) malos.push('--output-schema (no es el esquema de §2.8)');
  }
  for (const [k, x] of c) if (x.malo) malos.push(`-c ${k} (sin =)`);
  for (const k of c.keys()) if (!(k in C_EXEC) && k !== 'sandbox_mode' && k !== 'service_tier' && !c.get(k).malo) deMas.push(`-c ${k}`);
  for (const d of a.todos('--disable')) if (!DISABLE.includes(d)) deMas.push(`--disable ${d}`);
  for (const e of a.todos('--enable')) deMas.push(`--enable ${e}`);
  for (const b of ['--ephemeral', '--full-auto', '--dangerously-bypass-approvals-and-sandbox', '--oss', '--last', '--all']) if (a.banderas.has(b)) deMas.push(b);
  for (const v of ['-m', '-p', '-o', '-a', '--add-dir', '--local-provider']) if (a.uno(v) !== null) deMas.push(v);
  for (const b of a.banderas) if (!['--json', '--strict-config', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules', '--ephemeral', '--full-auto', '--dangerously-bypass-approvals-and-sandbox', '--oss', '--last', '--all'].includes(b)) deMas.push(b);
  // el mensaje va por stdin: en exec no hay argumento de prompt; en resume, <hilo> y "-" al final
  const pos = a.pos.slice(esResume ? 2 : 1);
  if (esResume ? pos.length !== 2 || pos[1] !== '-' : pos.length) deMas.push(`argumentos sueltos: ${pos.join(' ') || '(falta el "-")'}`);
  if (faltan.length) problemas.push(`faltan banderas: ${faltan.join(', ')}`);
  if (malos.length) problemas.push(`banderas con otro valor: ${malos.join(', ')}`);
  if (deMas.length) problemas.push(`banderas que el perfil no lleva: ${deMas.join(', ')}`);
  // la carpeta de trabajo: vacia de AGENTS.md y .git, fuera del proyecto
  const trabajo = esResume ? process.cwd() : a.uno('-C') || process.cwd();
  const dentroDelProyecto = comparable(`${barras(path.resolve(trabajo)).normalize('NFC')}/`).startsWith(comparable(`${RAIZ_B}/`));
  if (dentroDelProyecto) problemas.push('la carpeta de trabajo de Codex está dentro del proyecto');
  if (!esResume && a.uno('-C')) {
    if (!mismaCarpeta(process.cwd(), a.uno('-C'))) problemas.push('el proceso no corre en la carpeta de -C');
    for (const n of ['AGENTS.md', '.git']) if (existe(path.join(a.uno('-C'), n))) problemas.push(`la carpeta de trabajo tiene ${n}`);
  }
  return {
    faltan,
    malos,
    deMas,
    esfuerzo: c.get('model_reasoning_effort')?.valor ?? null,
    serviceTier: c.get('service_tier')?.valor ?? null,
    desarrollador: typeof c.get('developer_instructions')?.valor === 'string' ? c.get('developer_instructions').valor : '',
  };
}

function revisarImagenes(rutas) {
  const faltan = [];
  const noSonImagen = [];
  for (const f0 of rutas) {
    const f = path.resolve(process.cwd(), f0);
    if (esSecreto(barras(f)) || /(^|[\\/])app[\\/]config\.json$/i.test(f)) {
      noSonImagen.push(f0);
      continue;
    }
    if (!existe(f)) {
      faltan.push(f0);
      continue;
    }
    if (!EXT_IMAGEN.test(f)) {
      noSonImagen.push(f0);
      continue;
    }
    let cab = Buffer.alloc(0);
    try {
      const fd = fs.openSync(f, 'r');
      cab = Buffer.alloc(12);
      fs.readSync(fd, cab, 0, 12, 0);
      fs.closeSync(fd);
    } catch {
      /* no se pudo leer */
    }
    const png = cab.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const jpg = cab[0] === 0xff && cab[1] === 0xd8;
    const webp = cab.toString('latin1', 0, 4) === 'RIFF' && cab.toString('latin1', 8, 12) === 'WEBP';
    const gif = cab.toString('latin1', 0, 4) === 'GIF8';
    if (!(png || jpg || webp || gif)) noSonImagen.push(f0);
  }
  return { faltan, noSonImagen };
}

function leerEntrada(reg) {
  return new Promise((resolve) => {
    const trozos = [];
    let listo = false;
    const espera = Number(process.env.FALSO_CODEX_ESPERA_ENTRADA_MS) || 5000;
    const aviso = setTimeout(() => {
      if (listo) return;
      reg.stdinCerrado = false;
      reg.problemas.push(`la entrada no se cerró: a los ${Math.round(espera / 1000)} s Codex seguía esperando el final del mensaje`);
      process.stderr.write('Reading additional input from stdin...\n');
      anotar({ ...reg, ok: false });
    }, espera);
    const fin = () => {
      if (listo) return;
      listo = true;
      clearTimeout(aviso);
      resolve(Buffer.concat(trozos).toString('utf8'));
    };
    process.stdin.on('data', (d) => trozos.push(d));
    process.stdin.on('end', fin);
    process.stdin.on('error', fin);
  });
}

const TEXTOS = {
  codeMode: 'Code Mode is unavailable because code-mode host is disabled. Enable the code_mode_host feature to use it.',
  reconectando: 'Reconnecting... 1/5 (stream disconnected before completion: codex falso, la conexión se cortó un momento)',
  limite: 'You’ve hit your usage limit. Visit https://chatgpt.com/settings/usage to purchase more credits. Try again at 8:14 PM.',
  cuota: 'Quota exceeded. Check your plan and billing details.',
  plus: 'To use Codex with your ChatGPT plan, upgrade to Plus: https://chatgpt.com/explore/plus.',
  refresh: 'Your access token could not be refreshed because your refresh token was already used. Please log out and sign in again.',
  demanda: "We're currently experiencing high demand, which may cause temporary errors.",
  contexto: "Codex ran out of room in the model's context window. Start a new thread or clear earlier history before retrying.",
  cortada: 'Response incomplete: the model stopped before finishing its answer (response_incomplete).',
  sinJson: 'Hice la tarea y dejé los archivos listos. {LISTO}',
};
const err401 = (url) => `unexpected status 401 Unauthorized: Missing bearer or basic authentication in header, url: ${url}`;

let nItem = 0;
const item = (type, extra = {}) => ({ id: `item_${nItem++}`, type, ...extra });

async function turnoFallido(texto, codigo, { empezado = false } = {}) {
  if (!empezado) {
    emitir({ type: 'turn.started' });
    await pausa();
  }
  emitir({ type: 'error', message: texto });
  emitir({ type: 'turn.failed', error: { message: texto, ...(codigo ? { codex_error_info: codigo } : {}) } });
  return salir(1);
}

// Como el Codex de verdad (P0, punto 9): el usage de turn.completed es el ACUMULADO del hilo, la suma de todos sus
// turnos (cada turno manda la conversacion entera: lo de antes y su mensaje), no el del ultimo turno.
function uso(ses, salida) {
  const extra = Number(process.env.FALSO_CODEX_TOKENS) || 0;
  let input = 0;
  let output = 0;
  let chars = 0;
  let imgs = 0;
  ses.mensajes.forEach((m, k) => {
    chars += m.largo || 0;
    imgs += m.imagenes || 0;
    input += 8900 + Math.round(chars / 3.5) + 1300 * imgs + extra;
    const r = ses.respuestas[k];
    if (r) {
      chars += r.largo || 0;
      output += Math.max(1, Math.round((r.largo || 0) / 3.5));
    }
  });
  if (!output) output = Math.max(1, Math.round(String(salida || '').length / 3.5));
  return { input_tokens: input, cached_input_tokens: Math.round(input * 0.4), output_tokens: output };
}

/** Lo que dejó el mensaje anterior y se mira en este (lecturas, comando, fuera, ediciones-mal). */
function revisarDevoluciones(seg, msg, reg) {
  const f = seg.f;
  if (f.leer && !f.leer.revisado && ['resultado', 'correccion', 'otro'].includes(msg.clase)) {
    f.leer.revisado = true;
    const [pedido] = f.leer.pedidos;
    const llegoPedido = !pedido || msg.archivos.some((a) => clave(a.ruta) === clave(pedido)) || msg.sinCambios.some((x) => clave(x) === clave(pedido));
    const llegoEnv = msg.archivos.some((a) => /(^|\/)\.env/i.test(a.ruta)) || RX_SECRETO.test(msg.texto);
    const negado = /No te mando:[^\n]*\.env/.test(msg.texto);
    reg.leer = { pedidos: f.leer.pedidos, llegoPedido, llegoEnv, negadoConMotivo: negado };
    if (!llegoPedido) reg.problemas.push(`pedí ${pedido} en leer y no llegó`);
    if (llegoEnv) reg.problemas.push('pedí ../.env en leer y la app lo mandó');
  }
  if (f.comandoPedido && !f.comandoRevisado && ['resultado', 'correccion', 'otro'].includes(msg.clase)) {
    f.comandoRevisado = true;
    const devuelto = barras(msg.esqueleto).replace(/[ \t]+/g, ' ').includes(`### ${f.comandoPedido}`);
    reg.comando = { pedido: f.comandoPedido, devuelto };
    if (!devuelto) reg.problemas.push(`pedí «${f.comandoPedido}» en comandos y la app no devolvió lo que imprimió`);
  }
  if (f.fuera && !f.fueraRevisado) {
    f.fueraRevisado = true;
    const guardados = f.fuera.filter((x) => JSON.stringify(estadoDe(x.ruta)) !== JSON.stringify(x.antes)).map((x) => x.ruta);
    reg.fuera = { pedidos: f.fuera.map((x) => x.ruta), guardados };
    if (guardados.length) reg.problemas.push(`la app guardó lo que no podía: ${guardados.join(', ')}`);
  }
  if (f.edicionesMal && !f.edicionesMal.revisado) {
    f.edicionesMal.revisado = true;
    const ahora_ = leerTexto(f.edicionesMal.ruta);
    const intacto = ahora_ !== null && sha1(ahora_) === f.edicionesMal.sha;
    const avisado = /No apliqué ninguna edición de/.test(msg.texto);
    reg.edicionesMal = { ruta: f.edicionesMal.ruta, intacto, avisado };
    if (!intacto) reg.problemas.push(`la app aplicó ediciones de ${f.edicionesMal.ruta} aunque una no se podía aplicar (tenían que ir todas o ninguna)`);
    if (!avisado) reg.problemas.push(`la app no avisó que no aplicó las ediciones de ${f.edicionesMal.ruta}`);
  }
}

async function exec(a) {
  const esResume = a.pos[1] === 'resume';
  const hiloPedido = esResume ? a.pos[2] : null;
  const reg = { tipo: esResume ? 'codex-resume' : 'codex-exec', hilo: hiloPedido, problemas: [] };
  Object.assign(reg, revisarBanderasExec(a, esResume, reg.problemas));
  const desarrollador = reg.desarrollador;
  delete reg.desarrollador;
  Object.assign(reg, revisarEntorno(reg.problemas));
  if (esResume && (a.uno('-s') !== null || a.uno('-C') !== null)) {
    anotar({ ...reg, ok: false });
    process.stderr.write(`error: unexpected argument '${a.uno('-s') !== null ? '-s' : '-C'}' found\n\nUsage: codex exec resume [OPTIONS] [SESSION_ID] [PROMPT]\n`);
    return salir(2);
  }
  reg.stdinCerrado = true;
  const texto = await leerEntrada(reg);
  if (!texto.trim()) {
    anotar({ ...reg, ok: false, problemas: [...reg.problemas, 'el mensaje llegó vacío'] });
    process.stderr.write('No prompt provided via stdin.\n');
    return salir(1);
  }
  const msg = analizarMensaje(texto);
  const imagenesArgs = a.todos('-i');

  // la conversacion: la del hilo (resume) o una nueva
  let ses = null;
  if (esResume) {
    ses = cargarSesion(hiloPedido);
    const segPrevio = ses?.segmentos?.[ses.segmentos.length - 1];
    if (ses && segPrevio && modosDe(segPrevio.claves).has('resume-perdido') && marcaUnaVez(`resume-perdido-${segPrevio.marca}`)) {
      fs.rmSync(rutaSesion(hiloPedido), { force: true });
      ses = null;
    }
    if (!ses) {
      anotar({ ...reg, clase: msg.clase, ok: !reg.problemas.length });
      process.stderr.write(`Error: thread/resume: thread/resume failed: no rollout found for thread id ${hiloPedido} (code -32600)\n`);
      return salir(1);
    }
  } else ses = { hilo: crypto.randomUUID(), creado: ahora(), mensajes: [], respuestas: [], segmentos: [] };
  reg.hilo = ses.hilo;

  let seg = ses.segmentos[ses.segmentos.length - 1] || null;
  if (['tarea', 'retoma', 'deNuevo'].includes(msg.clase)) seg = nuevoSegmento(ses, msg);
  else if (!seg) {
    reg.problemas.push('el primer mensaje de un hilo nuevo no trae TAREA, LO QUE PUEDES ESCRIBIR y COMANDOS');
    seg = nuevoSegmento(ses, { ...msg, tarea: msg.texto.slice(0, 4000), escribir: '', comandos: [], disponibles: [], archivos: [] });
  }
  const modos = modosDe(seg.claves);
  reg.clase = msg.clase;
  reg.tarea = (seg.tarea.match(/^TAREA: .+$/m) || [''])[0].slice(0, 120);
  reg.modo = [...modos].join('+');

  // las reglas del MODO APP: en developer_instructions, nunca en el mensaje
  const di = desarrollador.normalize('NFC');
  reg.reglas = {
    enInstrucciones: { modoApp: RX_MODO_APP.test(di), comoTrabajas: RX_COMO_TRABAJAS.test(di) },
    enMensaje: { modoApp: RX_MODO_APP.test(msg.esqueleto), comoTrabajas: RX_COMO_TRABAJAS.test(msg.esqueleto) },
  };
  reg.conReglas = reg.reglas.enInstrucciones.modoApp && reg.reglas.enInstrucciones.comoTrabajas && !reg.reglas.enMensaje.modoApp && !reg.reglas.enMensaje.comoTrabajas;
  if (!reg.conReglas) reg.problemas.push('las reglas no van bien: el MODO APP y «CÓMO TRABAJAS AQUÍ» van en developer_instructions y no en el mensaje');
  reg.conSecreto = RX_SECRETO.test(msg.texto) || RX_SECRETO.test(di);
  if (reg.conSecreto) reg.problemas.push('el mensaje trae una clave (la del .env de la prueba o una línea KIE_/ELEVENLABS_API_KEY=)');
  if (msg.sinFin.length) reg.problemas.push(`archivos de MATERIAL sin su «===== FIN»: ${msg.sinFin.join(', ')}`);

  // las imagenes: cada -i existe y es una imagen, y la lista IMAGENES ADJUNTAS va con ellas, en el mismo orden
  const ri = revisarImagenes(imagenesArgs);
  const nombre = (r) => comparable(path.parse(barras(r)).name);
  const distintas = msg.listaImagenes.filter((x, i) => imagenesArgs[i] === undefined || nombre(x.ruta) !== nombre(imagenesArgs[i])).map((x) => x.ruta);
  reg.imagenes = { total: imagenesArgs.length, listadas: msg.listaImagenes.length, faltan: ri.faltan, noSonImagen: ri.noSonImagen, distintas };
  if (ri.faltan.length) reg.problemas.push(`imágenes que no existen: ${ri.faltan.join(', ')}`);
  if (ri.noSonImagen.length) reg.problemas.push(`-i que no son imágenes: ${ri.noSonImagen.join(', ')}`);
  if (msg.listaImagenes.length !== imagenesArgs.length) reg.problemas.push(`IMÁGENES ADJUNTAS lista ${msg.listaImagenes.length} y llegaron ${imagenesArgs.length} -i`);
  else if (distintas.length) reg.problemas.push(`IMÁGENES ADJUNTAS no coincide con los -i: ${distintas.join(', ')}`);

  // las partes del mensaje, la retoma y el material
  if (['tarea', 'retoma', 'deNuevo'].includes(msg.clase)) {
    reg.partes = msg.partes;
    if (!msg.partes.comandos) reg.problemas.push('falta COMANDOS QUE LA APP CORRE POR TI');
    if (esResume) {
      reg.deRetoma = { conAviso: msg.clase === 'retoma', tarea: msg.partes.tarea, escribir: msg.partes.escribir, comandos: msg.partes.comandos };
      reg.deRetoma.ok = Object.values(reg.deRetoma).every(Boolean);
      if (!reg.deRetoma.ok) reg.problemas.push('la retoma con otra tarea no empieza con «(Tarea nueva en esta misma conversación…» o le falta TAREA, LO QUE PUEDES ESCRIBIR o COMANDOS');
    }
    if (msg.faltanImagenes) seg.materialParcial = { pegados: msg.archivos.map((x) => x.ruta), sinCambios: msg.sinCambios, disponibles: msg.disponibles, imagenes: msg.listaImagenes.map((x) => x.ruta) };
    else Object.assign(reg, revisarMaterial(seg.tarea, llegadoDe(msg)));
  } else if (msg.clase === 'imagenes' && seg.materialParcial) {
    const p = seg.materialParcial;
    const llegado = llegadoDe({ archivos: p.pegados.map((ruta) => ({ ruta })), sinCambios: p.sinCambios, disponibles: p.disponibles, listaImagenes: msg.listaImagenes }, p.imagenes);
    Object.assign(reg, revisarMaterial(seg.tarea, llegado));
    delete seg.materialParcial;
  } else if (esResume && msg.clase === 'otro') {
    reg.deRetoma = { ok: false, conAviso: false, tarea: false, escribir: false, comandos: false };
    reg.problemas.push('un mensaje que no reconozco: si es otra tarea, va con TAREA, LO QUE PUEDES ESCRIBIR y COMANDOS (§2.5)');
  }
  if ('material' in reg && !reg.material) reg.problemas.push('material-esperado.json no tiene esta tarea: agrégala a mano');
  if (reg.materialFaltante?.length) reg.problemas.push(`no llegó: ${reg.materialFaltante.join(', ')}`);
  if (reg.materialDeMas?.length) reg.problemas.push(`llegó lo que no tenía que llegar: ${reg.materialDeMas.join(', ')}`);
  revisarDevoluciones(seg, msg, reg);
  const sinUsoOrdinario = Boolean(leerMarca('limite-a-mitad')) && modos.has('limite-a-mitad');
  if (sinUsoOrdinario) reg.problemas.push('llegó otro mensaje con el uso ordinario del plan agotado (ordinaryUsageAllowed: false)');
  reg.ok = !reg.problemas.length;
  anotar(reg);

  // el mensaje queda en la conversacion aunque el turno falle (como el real)
  ses.mensajes.push({ clase: msg.clase, largo: msg.largo, imagenes: imagenesArgs.length });
  if (['resultado', 'correccion', 'cortada', 'tomasTocadas', 'otro'].includes(msg.clase)) seg.conversacion.push({ texto: msg.texto, procesado: false });
  guardarSesion(ses);

  // ---- el turno
  const f = seg.f;
  const unaVez = !seg.deNuevo; // lo que pasa una vez por tarea no se repite al arrancar de nuevo
  emitir({ type: 'thread.started', thread_id: ses.hilo });
  await pausa();
  emitir({ type: 'item.completed', item: item('error', { message: TEXTOS.codeMode }) });
  await pausa();
  if (modos.has('cuelga')) return setInterval(() => {}, 1 << 30);
  if (modos.has('muere')) {
    emitir({ type: 'turn.started' });
    process.stderr.write('codex falso: algo se rompió adentro\n');
    return salir(1);
  }
  if (modos.has('sin-sesion')) {
    emitir({ type: 'turn.started' });
    for (let n = 1; n <= 5; n++) emitir({ type: 'error', message: `Reconnecting... ${n}/5 (${err401('wss://api.openai.com/v1/responses')})` });
    emitir({ type: 'item.completed', item: item('error', { message: 'Falling back from WebSockets to HTTPS transport. stream disconnected before completion' }) });
    for (let n = 1; n <= 5; n++) emitir({ type: 'error', message: `Reconnecting... ${n}/5 (${err401('https://api.openai.com/v1/responses')})` });
    emitir({ type: 'turn.failed', error: { message: err401('https://api.openai.com/v1/responses') } });
    fs.rmSync(marcaSesion(), { force: true });
    return salir(1);
  }
  if (modos.has('plan-sin-codex-plus')) return turnoFallido(TEXTOS.plus, 'usage_not_included');
  if (modos.has('plan-sin-codex')) return turnoFallido(TEXTOS.cuota, 'quota_exceeded');
  if (modos.has('limite')) {
    ponerMarca('limite', { claves: seg.claves });
    return turnoFallido(TEXTOS.limite, 'usage_limit_exceeded');
  }
  if (sinUsoOrdinario) return turnoFallido(TEXTOS.limite, 'usage_limit_exceeded'); // lo que pasaria sin creditos
  if (modos.has('muchas') && imagenesArgs.length > 48) return turnoFallido(`Input exceeds the maximum length: ${imagenesArgs.length} images in one message (the limit is 48) (input_too_large)`, 'input_too_large');
  if (modos.has('refresh') && marcaUnaVez(`refresh-${seg.marca}`)) return turnoFallido(TEXTOS.refresh, 'refresh_token_failed');
  if (modos.has('alta-demanda') && marcaUnaVez(`alta-demanda-${seg.marca}`)) return turnoFallido(TEXTOS.demanda, 'server_overloaded');
  // el segundo mensaje del hilo (no uno que trae una tarea entera)
  if (modos.has('contexto') && ses.mensajes.length >= 2 && !['tarea', 'deNuevo'].includes(msg.clase) && marcaUnaVez(`contexto-${seg.marca}`)) return turnoFallido(TEXTOS.contexto, 'context_window_exceeded');

  emitir({ type: 'turn.started' });
  await pausa();
  emitir({ type: 'error', message: TEXTOS.reconectando });
  await pausa();

  const resp = { estado: 'LISTO', respuesta: 'LISTO', archivos: [], ediciones: [], leer: [], comandos: [] };
  const info = { tipo: 'codex-respuesta', hilo: ses.hilo, clase: msg.clase, tarea: reg.tarea, problemas: [] };

  if (modos.has('herramientas') && unaVez && !f.herramientas) {
    f.herramientas = true;
    guardarSesion(ses);
    for (let n = 0; n < 4; n++) {
      emitir({ type: 'item.started', item: item('collab_tool_call', { tool: 'spawn_agent', status: 'in_progress', prompt: 'Lee la skill y escribe el archivo.' }) });
      await pausa();
    }
    await dormir(Number(process.env.FALSO_CODEX_HERRAMIENTAS_MS) || 3000);
    info.herramientasSinCortar = true; // si llega aca, la app no lo corto
    info.problemas.push('mandé 4 herramientas y la app no me cortó');
  }
  // como el de verdad (P0, punto 2): un intento de `exec` no es un item, solo una linea del router en stderr
  if (modos.has('herramientas-exec') && unaVez && !f.herramientasExec) {
    f.herramientasExec = true;
    guardarSesion(ses);
    for (let n = 0; n < 4; n++) {
      process.stderr.write(`${new Date().toISOString()} ERROR codex_core::tools::router: error=code-mode host is disabled\n`);
      await pausa();
    }
    await dormir(Number(process.env.FALSO_CODEX_HERRAMIENTAS_MS) || 3000);
    info.herramientasSinCortar = true;
    info.problemas.push('intenté 4 veces exec (solo en stderr) y la app no me cortó');
  }

  // lo que se marca al armar esta respuesta; si la respuesta se pierde (cortada, sin JSON), vuelve a como estaba
  const fAntes = { comandoPedido: f.comandoPedido, leer: f.leer, fuera: f.fuera, edicionesMal: f.edicionesMal, mal: f.mal, malRuta: f.malRuta, malArreglado: f.malArreglado, forzado: f.forzado };
  if (msg.faltanImagenes) {
    // la primera mitad de las imagenes: solo SEGUIR, sin archivos
    Object.assign(resp, { estado: 'SEGUIR', respuesta: 'Espero las imágenes que faltan.' });
  } else {
    if (seg.conversacion.some((x) => !x.procesado)) {
      const p = await puente(seg);
      Object.assign(info, { quedanEnDisco: p.quedanEnDisco, fueraDeLaFoto: p.fueraDeLaFoto, ajenos: p.ajenos.length ? p.ajenos : undefined });
      if (!p.ok) {
        info.problemas.push(p.error);
        anotar({ ...info, ok: false });
        anotar({ tipo: 'error', de: 'codex-falso (puente)', error: p.error });
        guardarSesion(ses);
        return turnoFallido(`El Claude falso no terminó la tarea: ${p.error}`, null, { empezado: true });
      }
    }
    if (modos.has('por-partes')) f.deAUno = true;
    if (process.env.FALSO_CODEX_LEER === '1' && unaVez && !f.leer) {
      const pedido = algoParaLeer(seg);
      f.leer = { pedidos: [pedido, '../.env'].filter(Boolean) };
      Object.assign(resp, { estado: 'SEGUIR', respuesta: 'Necesito leer esto primero.', leer: f.leer.pedidos });
    } else {
      let lista = pendientesDe(seg, info);
      // mal / mal-siempre: un .json cortado a la mitad. En mal sigue así hasta que llega la corrección de la app
      // (no se arregla con el resultado de un comando: así la prueba pasa por la corrección)
      if (modos.has('mal') && f.mal && !f.malArreglado && msg.clase === 'correccion') f.malArreglado = true;
      if (modos.has('mal-siempre') || (modos.has('mal') && f.mal && !f.malArreglado)) {
        const r = f.malRuta || (modos.has('mal-siempre') ? lista.find((x) => /\.json$/i.test(x.r))?.r : null);
        if (r && seg.producido[r] !== undefined) {
          f.malRuta = r;
          const malo = mitad(seg.producido[r]);
          const actual = leerTexto(r);
          lista = lista.filter((x) => x.r !== r);
          if (actual !== malo) lista.unshift({ r, actual, contenido: malo });
        }
      } else if (modos.has('mal') && unaVez && !f.mal) {
        const x = lista.find((y) => /\.json$/i.test(y.r));
        if (x) {
          f.mal = true;
          f.malRuta = x.r;
          x.contenido = mitad(x.contenido);
        }
      }
      // saltos-json: el primer .json nuevo llega con los \n de sus textos como saltos de linea de verdad (lo que hizo el
      // Codex de verdad con el «Negative prompt:» de los claymation): la app los tiene que pasar a \n al guardarlo
      if (modos.has('saltos-json') && unaVez && !f.saltosJson) {
        const x = lista.find((y) => /\.json$/i.test(y.r) && y.actual === null && /(?<!\\)\\n/.test(y.contenido));
        if (x) {
          f.saltosJson = x.r;
          x.contenido = x.contenido.replace(/(?<!\\)\\n/g, '\n');
        }
      }
      // de a un archivo
      let resto = 0;
      if (f.deAUno && lista.length > 1) {
        resto = lista.length - 1;
        lista = lista.slice(0, 1);
      }
      // el comando de la tarea, en el primer mensaje que entrega algo; o forzar un segundo mensaje
      const forzar = (modos.has('limite-a-mitad') || modos.has('resume-perdido') || modos.has('contexto')) && !f.forzado;
      if (seg.comandos.length && !f.comandoPedido && !modos.has('por-partes')) {
        f.comandoPedido = seg.comandos[0];
        resp.comandos = [seg.comandos[0]];
      } else if (forzar && !resto) {
        if (lista.length > 1) {
          resto = lista.length - 1;
          lista = lista.slice(0, 1);
        } else {
          const x = algoParaLeer(seg);
          if (x) resp.leer = [x];
        }
      }
      if (forzar) f.forzado = true;
      const enviadosAhora = {};
      for (const x of lista) {
        const ruta = comoLaTarea(seg, x.r);
        const eds = x.actual === null ? null : edicionesDe(x.actual, x.contenido);
        if (eds === null) resp.archivos.push({ ruta, contenido: x.contenido });
        else for (const e of eds) resp.ediciones.push({ ruta, ...e });
        enviadosAhora[x.r] = sha1(x.contenido);
      }
      // ediciones-mal: una edicion mas, al final, con un buscar que aparece 2 veces
      if (modos.has('ediciones-mal') && unaVez && !f.edicionesMal && resp.ediciones.length) {
        const ruta = resp.ediciones[0].ruta;
        const r = rel(ruta);
        const actual = leerTexto(r);
        let despuesDeLasBuenas = actual;
        try {
          for (const e of resp.ediciones.filter((y) => y.ruta === ruta)) despuesDeLasBuenas = aplicarUna(despuesDeLasBuenas, e);
        } catch {
          despuesDeLasBuenas = actual;
        }
        const rep = repetido(despuesDeLasBuenas || '') || repetido(actual || '');
        if (rep && actual !== null) {
          const ultima = resp.ediciones.map((y) => y.ruta).lastIndexOf(ruta);
          resp.ediciones.splice(ultima + 1, 0, { ruta, buscar: rep, reemplazar: rep });
          f.edicionesMal = { ruta: r, sha: sha1(actual) };
          delete enviadosAhora[r];
          resto = Math.max(resto, 1); // SEGUIR: la app avisa sin gastar una correccion
        }
      }
      // fuera: lo que la app nunca tiene que guardar
      if (modos.has('fuera') && unaVez && !f.fuera) {
        f.fuera = rutasFuera(seg).map((ruta) => ({ ruta, antes: estadoDe(ruta) }));
        for (const x of f.fuera) resp.archivos.push({ ruta: x.ruta, contenido: /\.json$/i.test(x.ruta) ? '{ "falso": "fuera: la app no tiene que guardar esto" }\n' : 'FALSO_CODEX=fuera\n' });
      }
      if (resp.comandos.length || resp.leer.length || resto > 0) Object.assign(resp, { estado: 'SEGUIR', respuesta: resto > 0 ? 'Sigo con el próximo archivo.' : 'Sigo con la tarea.' });
      else if (/^BLOQUEADO\b/.test(seg.resultadoClaude || '')) Object.assign(resp, { estado: 'BLOQUEADO', respuesta: 'BLOQUEADO' });
      seg.enviadosPendientes = enviadosAhora;
    }
  }

  // ---- la respuesta
  const demora = Number(process.env.FALSO_CODEX_DEMORA) || 0;
  if (demora) await dormir(demora);
  // solo el primer mensaje de la tarea se demora: un cuelgue mudo que no se repite (pruebas reales, P5, objeto-clips)
  const demoraUna = Number(process.env.FALSO_CODEX_DEMORA_UNA_VEZ) || 0;
  if (demoraUna && marcaUnaVez(`demora-una-vez-${seg.marca}`)) await dormir(demoraUna);
  let textoResp = JSON.stringify(resp);
  const cortar = modos.has('cortada') && unaVez && !f.cortada && !msg.faltanImagenes && (resp.archivos.length || resp.ediciones.length);
  const sinJson = !cortar && modos.has('sin-json') && unaVez && !f.sinJson && !msg.faltanImagenes;
  if (cortar || sinJson) Object.assign(f, fAntes);
  if (cortar) {
    f.cortada = true;
    f.deAUno = true;
    textoResp = textoResp.slice(0, Math.floor(textoResp.length / 2));
  } else if (sinJson) {
    f.sinJson = true;
    textoResp = TEXTOS.sinJson;
  } else {
    Object.assign(seg.enviados, seg.enviadosPendientes || {});
  }
  delete seg.enviadosPendientes;
  if (modos.has('limite-a-mitad') && !cortar && !sinJson && !msg.faltanImagenes) {
    seg.f.limiteMitad = true;
    ponerMarca('limite-a-mitad', { claves: seg.claves });
  }
  ses.respuestas.push({ largo: textoResp.length });
  guardarSesion(ses);
  Object.assign(info, {
    estado: cortar ? 'cortada' : sinJson ? 'sin-json' : resp.estado,
    archivos: resp.archivos.map((x) => x.ruta),
    ediciones: [...new Set(resp.ediciones.map((x) => x.ruta))],
    nEdiciones: resp.ediciones.length,
    leer: resp.leer,
    comandos: resp.comandos,
    yaEnviados: info.yaEnviados,
  });
  info.ok = !info.problemas.length;
  anotar(info);
  emitir({ type: 'item.completed', item: item('agent_message', { text: textoResp }) });
  if (cortar) {
    await pausa();
    emitir({ type: 'error', message: TEXTOS.cortada });
    emitir({ type: 'turn.failed', error: { message: TEXTOS.cortada, codex_error_info: 'response_incomplete' } });
    return salir(1);
  }
  await pausa();
  emitir({ type: 'turn.completed', usage: uso(ses, textoResp) });
  return salir(0);
}

// ---------------------------------------------------------------- arranque

async function main() {
  const a = leerArgs(ARGS);
  if (a.banderas.has('--version') || a.banderas.has('-V')) {
    process.stdout.write(`codex-cli ${VERSION}\n`);
    return salir(0);
  }
  const sub = a.pos[0];
  if (sub === 'login') return a.pos[1] === 'status' ? loginStatus(a) : login(a);
  if (sub === 'logout') return logout(a);
  if (sub === 'delete') return borrarHilo(a);
  if (sub === 'app-server') return appServer(a);
  if (sub === 'exec') return exec(a);
  process.stderr.write(`error: unrecognized subcommand '${sub || ''}'\n\nUsage: codex [OPTIONS] [PROMPT]\n`);
  return salir(2);
}

main().catch((e) => {
  anotarError(e);
  process.stderr.write(`codex falso: ${e?.stack || e}\n`);
  salir(1);
});

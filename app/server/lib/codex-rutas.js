// Donde esta Codex (el programa de ChatGPT) y todo lo que necesita para lanzarse igual en cada lugar: la version fija,
// la carpeta de programas, sus carpetas propias (CODEX_HOME, trabajo, cache, hilos), su config.toml, su entorno y las
// banderas exactas de cada subcomando. Lo comparten lib/codex.js, lib/codex-app-server.js, lib/instalar-motor.js y
// app/herramientas/probar-codex.mjs: asi la app y las pruebas lanzan exactamente el mismo comando.
//
//   VERSION_CODEX · carpetaProgramas() · carpetaCodex() · carpetasCodex() -> { home, trabajo, cache, hilos, config }
//   resolverCodex() -> { cmd, pre, via } | null · olvidarCodex() · leerVersionCodex({ timeout }) · sinColores(texto)
//   esHomeDelUsuario(home) · CONFIG_TOML · asegurarConfigCodex(home) · vaciarTrabajo(dir) · entornoCodex({ home })
//   ARGS_DISABLE (las 25 --disable) · ARGS_CONFIG (los -c fijos de exec) · ARGS_CUENTA · ESQUEMA_RESPUESTA
//   argsExec({ esfuerzo, developerInstructions, esquema, imagenes, trabajo }) · argsResume({ …, thread })
//   argsCuenta(['login', 'status']) · argsDelete(thread) · argsAppServer() · argsPromptInput({…}) (pruebas)
//
// El freno de la sesion del usuario: si el CODEX_HOME de la app fuera ~/.codex (solo pasa en las pruebas con
// --home-usuario), la app nunca escribe ahi su config.toml, nunca corre login, logout ni delete ahi y nunca borra nada
// ahi. Las banderas -c y --disable van igual.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as claude from './claude.js';
import { APP, RAIZ } from './rutas.js';
import { escribirSeguro } from './archivos.js';
import { carpetaDeProgramas } from './programas.js';

export const VERSION_CODEX = '0.167.0';
const WIN = process.platform === 'win32';
const MAC = process.platform === 'darwin';

// El esquema de la respuesta de Codex (estado, respuesta, archivos, ediciones, leer, comandos).
export const ESQUEMA_RESPUESTA = path.join(APP, 'server', 'claude', 'esquemas', 'codex-respuesta.json');
// El nivel de servicio: no se fija (null) salvo que la prueba de contrato encuentre una razon (DISENO §2.4).
export const SERVICE_TIER = null;

// ---------------------------------------------------------------- carpetas

/** La carpeta de la app fuera de su carpeta: la de arriba de programas (programas-windows.ps1:35, programas-mac.sh:33). */
function carpetaBase() {
  if (WIN) return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'AnunciosConIA');
  if (MAC) return path.join(os.homedir(), 'Library', 'Application Support', 'AnunciosConIA');
  return path.join(os.homedir(), '.local', 'share', 'AnunciosConIA'); // (Linux: solo para pruebas)
}

/** Donde la app deja sus programas (Node, ffmpeg, Python y Codex). AIA_PROGRAMAS_DIR, para el CI y las pruebas. */
export const carpetaProgramas = () => carpetaDeProgramas();

/** La carpeta de esta version de Codex: <programas>/codex-0.167.0. */
export const carpetaCodex = () => path.join(carpetaProgramas(), `codex-${VERSION_CODEX}`);

// Para comparar rutas: NFC y, en Windows y Mac, sin distinguir mayusculas (D:\ contra d:\).
function normal(ruta) {
  const r = path.resolve(String(ruta || '')).normalize('NFC').replace(/[\\/]+$/, '');
  return WIN || MAC ? r.toLowerCase() : r;
}
const realOMisma = (ruta) => {
  try {
    return fs.realpathSync.native(ruta);
  } catch {
    return ruta;
  }
};
const dentroDe = (ruta, base) => {
  const a = normal(realOMisma(ruta));
  const b = normal(realOMisma(base));
  return a === b || a.startsWith(b + (WIN ? '\\' : '/'));
};

/**
 * true si `home` es la sesion de Codex del propio usuario: ~/.codex (o la que dijera su CODEX_HOME). Ahi la app no
 * escribe config.toml, no corre login, logout ni delete y no borra nada.
 */
export function esHomeDelUsuario(home) {
  if (!home) return false;
  const delUsuario = [path.join(os.homedir(), '.codex')];
  if (process.env.CODEX_HOME) delUsuario.push(process.env.CODEX_HOME);
  return delUsuario.some((u) => normal(home) === normal(u) || normal(realOMisma(home)) === normal(realOMisma(u)));
}

/**
 * Las carpetas propias de Codex en la app (fuera de la carpeta de la app: ni el zip ni "Actualizar" las tocan):
 *   home    el CODEX_HOME: la sesion de ChatGPT y las conversaciones (AIA_CODEX_HOME, solo pruebas)
 *   trabajo la carpeta de trabajo, vacia y fija (-C y cwd): <home>/../codex-trabajo
 *   cache   las imagenes convertidas: <home>/../codex-cache
 *   hilos   uuid de la app -> thread de Codex: <home>/anuncios-hilos.json
 * Si home es la del usuario (pruebas con --home-usuario), trabajo, cache e hilos van a la carpeta de la app: la app
 * no deja archivos suyos dentro de ~/.codex ni al lado.
 */
export function carpetasCodex() {
  const home = process.env.AIA_CODEX_HOME ? path.resolve(process.env.AIA_CODEX_HOME) : path.join(carpetaBase(), 'codex-home');
  const delUsuario = esHomeDelUsuario(home);
  const afuera = delUsuario ? carpetaBase() : path.dirname(home);
  return {
    home,
    trabajo: path.join(afuera, 'codex-trabajo'),
    cache: path.join(afuera, 'codex-cache'),
    hilos: delUsuario ? path.join(afuera, 'anuncios-hilos-home-usuario.json') : path.join(home, 'anuncios-hilos.json'),
    config: path.join(home, 'config.toml'),
  };
}

// ---------------------------------------------------------------- donde esta codex

// El paquete de npm de cada plataforma y la carpeta de su binario. En Windows ARM el Node de la app es x64 a
// proposito (.bat:50), asi que npm baja el de x64; si alguna vez corre con un Node arm64, sirven los dos.
function plataformas() {
  const exe = WIN ? 'codex.exe' : 'codex';
  if (WIN) {
    const x64 = { paquete: '@openai/codex-win32-x64', triple: 'x86_64-pc-windows-msvc', exe };
    return process.arch === 'arm64' ? [{ paquete: '@openai/codex-win32-arm64', triple: 'aarch64-pc-windows-msvc', exe }, x64] : [x64];
  }
  if (MAC) return [process.arch === 'arm64' ? { paquete: '@openai/codex-darwin-arm64', triple: 'aarch64-apple-darwin', exe } : { paquete: '@openai/codex-darwin-x64', triple: 'x86_64-apple-darwin', exe }];
  return [process.arch === 'arm64' ? { paquete: '@openai/codex-linux-arm64', triple: 'aarch64-unknown-linux-musl', exe } : { paquete: '@openai/codex-linux-x64', triple: 'x86_64-unknown-linux-musl', exe }];
}

const esArchivo = (ruta) => {
  try {
    return fs.statSync(ruta).isFile();
  } catch {
    return false;
  }
};

/** El binario nativo dentro de <programas>/codex-0.167.0 (npm o el respaldo de la release), o null. */
function buscarBinario(dir = carpetaCodex()) {
  const lanzador = path.join(dir, 'node_modules', '@openai', 'codex', 'package.json');
  for (const p of plataformas()) {
    const carpetas = [];
    // como lo hace el propio bin/codex.js: encuentra el paquete aplanado o anidado
    try {
      carpetas.push(path.dirname(createRequire(lanzador).resolve(`${p.paquete}/package.json`)));
    } catch {
      /* sin el lanzador, o sin ese paquete: se mira a mano */
    }
    const partes = p.paquete.split('/');
    carpetas.push(path.join(dir, 'node_modules', ...partes), path.join(dir, 'node_modules', '@openai', 'codex', 'node_modules', ...partes));
    for (const c of carpetas) {
      const bin = path.join(c, 'vendor', p.triple, 'bin', p.exe);
      if (esArchivo(bin)) return bin;
    }
  }
  const release = path.join(dir, 'release', 'bin', WIN ? 'codex.exe' : 'codex');
  return esArchivo(release) ? release : null;
}

let cacheBin = null; // { t, valor }

/** Que la proxima vez se vuelva a buscar Codex (despues de instalar, o "Volver a revisar"). */
export function olvidarCodex() {
  cacheBin = null;
}

/**
 * Como se lanza Codex: { cmd, pre: [argumentos antes de los nuestros], via } o null si no esta.
 * Siempre el binario nativo de la carpeta de programas de la app, sin shell y sin el codex.js de npm. Nunca un codex
 * del PATH ni del npm global: las banderas "sin herramientas" dependen de la version exacta.
 * ANUNCIOS_CODEX_BIN (solo pruebas): otro ejecutable, o un .js que imita a Codex (se corre con este Node).
 */
export function resolverCodex() {
  const forzado = process.env.ANUNCIOS_CODEX_BIN;
  if (forzado) return /\.[cm]?js$/i.test(forzado) ? { cmd: process.execPath, pre: [forzado], via: 'prueba' } : { cmd: forzado, pre: [], via: 'prueba' };
  if (cacheBin && Date.now() - cacheBin.t < 60000) return cacheBin.valor;
  const bin = buscarBinario();
  const valor = bin ? { cmd: bin, pre: [], via: 'nativo' } : null;
  cacheBin = { t: Date.now(), valor };
  return valor;
}

/**
 * `codex --version`: { version: '0.167.0' | null, texto, err }. 20 s de tope, salvo la primera vez despues de
 * instalar (2 min: el antivirus revisa el .exe de 369 MB).
 */
export function leerVersionCodex({ timeout = 20000, bin = resolverCodex() } = {}) {
  if (!bin) return Promise.resolve({ version: null, texto: '', err: { code: 'ENOENT' } });
  return new Promise((resolve) => {
    execFile(bin.cmd, [...bin.pre, '--version'], { cwd: os.tmpdir(), env: entornoCodex(), timeout, windowsHide: true, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      // (la version sale por stdout; por stderr pueden venir avisos, como el de las carpetas temporales)
      const m = sinColores(`${stdout || ''}\n${stderr || ''}`).match(/codex-cli\s+(\d+\.\d+\.\d+\S*)/);
      const texto = m ? m[0] : sinColores(`${stdout || ''}${stderr || ''}`).trim().slice(-600);
      resolve({ version: m ? m[1] : null, texto, err: err || null });
    });
  });
}

/** El texto de Codex sin los codigos de color de la terminal. */
export const sinColores = (t) => String(t || '').replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '').replace(/\x1b\][^\x07]*\x07/g, '');

// ---------------------------------------------------------------- config.toml propio

// login status, logout y delete no aceptan --strict-config y sin este archivo usarian los valores de fabrica (en
// 0.167 secret_auth_storage viene activa: en Mac podria guardar la sesion en el Llavero). exec y resume van con
// --ignore-user-config: por eso las mismas claves van ademas por -c y --disable en cada comando.
export const CONFIG_TOML = `# Lo escribe Anuncios con IA. No lo cambies: la app lo vuelve a escribir al arrancar.
cli_auth_credentials_store = "file"
forced_login_method = "chatgpt"
check_for_update_on_startup = false

[features]
secret_auth_storage = false
daemon_auto_start = false
`;

/**
 * Escribe <CODEX_HOME>/config.toml si falta o si alguien lo cambio. Nunca en la sesion del usuario (~/.codex).
 * -> { ok, escrito, motivo? }
 */
export function asegurarConfigCodex(home = carpetasCodex().home) {
  if (esHomeDelUsuario(home)) return { ok: false, escrito: false, motivo: 'home-del-usuario' };
  const ruta = path.join(home, 'config.toml');
  let actual = null;
  try {
    actual = fs.readFileSync(ruta, 'utf8');
  } catch {
    /* todavia no esta */
  }
  if (actual === CONFIG_TOML) return { ok: true, escrito: false };
  fs.mkdirSync(home, { recursive: true });
  escribirSeguro(ruta, CONFIG_TOML);
  return { ok: true, escrito: true };
}

/**
 * Deja vacia la carpeta de trabajo (al arrancar la app): ahi no hay ningun AGENTS.md ni .git. Solo una carpeta que se
 * llama codex-trabajo y que no esta dentro de la sesion del usuario. -> { dir, quedaron }
 */
export function vaciarTrabajo(dir = carpetasCodex().trabajo) {
  if (path.basename(dir) !== 'codex-trabajo') throw new Error(`vaciarTrabajo: ${dir} no es la carpeta de trabajo de Codex`);
  if (dentroDe(dir, path.join(os.homedir(), '.codex')) || normal(dir) === normal(os.homedir())) throw new Error(`vaciarTrabajo: ${dir} está en la sesión del usuario`);
  fs.mkdirSync(dir, { recursive: true });
  let quedaron = 0;
  for (const nombre of fs.readdirSync(dir)) {
    try {
      fs.rmSync(path.join(dir, nombre), { recursive: true, force: true });
    } catch {
      quedaron++; // (un archivo abierto por otro programa: se borra la proxima vez)
    }
  }
  return { dir, quedaron };
}

// ---------------------------------------------------------------- entorno

// Lo del motor (kie, ElevenLabs, APIMart, Suno y los proxys): el de claude.js:50, para que las dos IA lo pierdan igual.
const DEL_MOTOR = claude.DEL_MOTOR instanceof RegExp ? claude.DEL_MOTOR : /^(KIE_|ELEVENLABS_|APIMART_|SUNO_|ANUNCIOS_MODO_PRUEBA$|NODE_USE_ENV_PROXY$|HTTPS?_PROXY$|NO_PROXY$)/i;
const DE_OTRAS_CUENTAS = /^(OPENAI_|CODEX_|AZURE_OPENAI_|ANTHROPIC_|CLAUDE_)/;
const SUELTAS = new Set(['CLAUDECODE', 'AWS_BEARER_TOKEN_BEDROCK', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_PROFILE', 'RUST_LOG']);

/**
 * El entorno de Codex: el de la app sin nada que cambie la cuenta (siempre la de ChatGPT, nunca una clave de API) ni
 * las claves del motor, con el CODEX_HOME de la app y sin colores.
 */
export function entornoCodex({ home = carpetasCodex().home } = {}) {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    const K = k.toUpperCase();
    if (DE_OTRAS_CUENTAS.test(K) || SUELTAS.has(K) || DEL_MOTOR.test(K)) delete env[k];
  }
  env.CODEX_HOME = home;
  env.NO_COLOR = '1';
  return env;
}

// ---------------------------------------------------------------- las banderas (DISENO §2.4)

// Las 16 del perfil verificado, daemon_auto_start (que no quede ningun proceso vivo), las 6 que vienen activas en
// 0.167 y ninguna tarea necesita, y el modo rapido (fast_mode, ultrafast_mode), apagado (el modo rapido no se usa).
export const FUNCIONES_APAGADAS = Object.freeze([
  'shell_tool', 'unified_exec', 'browser_use', 'computer_use', 'in_app_browser', 'apps', 'plugins', 'image_generation',
  'code_mode_host', 'sleep_tool', 'multi_agent', 'goals', 'view_image', 'tool_suggest', 'skill_search', 'hooks',
  'daemon_auto_start',
  'shell_snapshot', 'workspace_dependencies', 'remote_plugin', 'plugin_discovery_prefetch', 'skill_mcp_dependency_install', 'secret_auth_storage',
  'fast_mode', 'ultrafast_mode',
]);
export const ARGS_DISABLE = Object.freeze(FUNCIONES_APAGADAS.flatMap((f) => ['--disable', f]));

// Los -c de exec y resume, menos model_reasoning_effort y developer_instructions (cambian en cada sesion).
export const ARGS_CONFIG = Object.freeze([
  '-c', 'web_search="disabled"',
  '-c', 'skills.include_instructions=false',
  '-c', 'check_for_update_on_startup=false',
  '-c', 'project_doc_max_bytes=0',
  '-c', 'forced_login_method="chatgpt"',
  '-c', 'cli_auth_credentials_store="file"',
  '-c', 'model_auto_compact_token_limit=1000000000', // nunca resume la conversacion por su cuenta (§2.9)
]);

// login, login status, logout y delete: sin --strict-config (no lo aceptan); los respalda el config.toml propio.
export const ARGS_CUENTA = Object.freeze(['-c', 'forced_login_method=chatgpt', '-c', 'cli_auth_credentials_store=file', '--disable', 'daemon_auto_start', '--disable', 'secret_auth_storage']);

const ARGS_FIJOS = Object.freeze(['--json', '--strict-config', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules']);

// high en guion, cambios, tomas, estrategia y prompts; medium en lo demas. Nunca el de fabrica (conto mal, prueba 3).
function esfuerzoDe(e) {
  const v = String(e || '').toLowerCase();
  if (v === 'high' || v === 'alto') return 'high';
  return 'medium';
}

// Las --disable y los -c (con el esfuerzo y el MODO APP), iguales en exec y resume.
function argsPerfil({ esfuerzo, developerInstructions }) {
  if (typeof developerInstructions !== 'string' || !developerInstructions.trim()) throw new Error('argsExec: faltan las developer_instructions (MODO APP)');
  return [
    ...ARGS_DISABLE,
    ...ARGS_CONFIG,
    '-c', `model_reasoning_effort="${esfuerzoDe(esfuerzo)}"`,
    // como cadena TOML: las secuencias de JSON (\n, \", \\, \uXXXX) valen en TOML
    '-c', `developer_instructions=${JSON.stringify(developerInstructions)}`,
    ...(SERVICE_TIER ? ['-c', `service_tier="${SERVICE_TIER}"`] : []),
  ];
}

// El esquema de la respuesta (va en cada mensaje: las banderas no quedan guardadas) y las imagenes, cada una con su
// -i (en resume, "-i a b" falla). Las rutas relativas se toman desde la raiz del proyecto.
function argsSalida({ esquema = ESQUEMA_RESPUESTA, imagenes = [] }) {
  const imgs = (imagenes || []).map((i) => (path.isAbsolute(String(i)) ? String(i) : path.resolve(RAIZ, String(i))));
  return ['--output-schema', esquema, ...imgs.flatMap((i) => ['-i', i])];
}

/**
 * El primer mensaje: `codex exec …` (el mensaje va por stdin, que se escribe entero y se cierra; sin argumento de
 * prompt detras de las imagenes). cwd y -C = la carpeta de trabajo.
 */
export function argsExec({ esfuerzo, developerInstructions, esquema, imagenes, trabajo = carpetasCodex().trabajo } = {}) {
  return ['exec', ...ARGS_FIJOS, '-s', 'read-only', '-C', trabajo, ...argsPerfil({ esfuerzo, developerInstructions }), ...argsSalida({ esquema, imagenes })];
}

const THREAD = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Los mensajes siguientes: `codex exec resume … <thread_id> -` (sin -s ni -C, que resume no acepta; el sandbox va por
 * -c). El mensaje, por stdin.
 */
export function argsResume({ esfuerzo, developerInstructions, esquema, imagenes, thread } = {}) {
  if (!THREAD.test(String(thread || ''))) throw new Error(`argsResume: el hilo "${thread}" no es un id de Codex`);
  return ['exec', 'resume', ...ARGS_FIJOS, ...argsPerfil({ esfuerzo, developerInstructions }), '-c', 'sandbox_mode="read-only"', ...argsSalida({ esquema, imagenes }), String(thread), '-'];
}

/**
 * Solo para las pruebas: `codex debug prompt-input` con el mismo perfil (lo que ve el modelo, sin gastar nada). El texto
 * va antes de las imagenes: aca -i toma varios valores y se lo comeria.
 */
export function argsPromptInput({ esfuerzo, developerInstructions, imagenes = [], prompt = '' } = {}) {
  const imgs = argsSalida({ imagenes }).slice(2);
  return ['debug', 'prompt-input', ...argsPerfil({ esfuerzo, developerInstructions }), String(prompt), ...imgs];
}

/**
 * Un subcomando de la cuenta con sus -c y --disable: argsCuenta(['login', 'status']), ['login', '--device-auth'],
 * ['logout'], ['delete', <thread>]. El freno: con la sesion del usuario como CODEX_HOME solo deja `login status`.
 */
export function argsCuenta(sub, { home = carpetasCodex().home } = {}) {
  const partes = (Array.isArray(sub) ? sub : [sub]).map(String);
  const soloMira = partes[0] === 'login' && partes[1] === 'status';
  if (!soloMira && ['login', 'logout', 'delete'].includes(partes[0]) && esHomeDelUsuario(home)) {
    throw new Error(`freno: la app no corre "codex ${partes[0]}" en la sesión del usuario (${home})`);
  }
  return [...partes, ...ARGS_CUENTA];
}

/**
 * Borra una conversacion vieja de la app (§2.12): `codex delete --force <thread>`. Sin --force, delete pregunta antes
 * de borrar y con la entrada cerrada no borra nada. Solo con un id de hilo, nunca con un nombre.
 */
export function argsDelete(thread, opciones) {
  if (!THREAD.test(String(thread || ''))) throw new Error(`argsDelete: el hilo "${thread}" no es un id de Codex`);
  return argsCuenta(['delete', '--force', String(thread)], opciones);
}

/** `codex app-server`, solo para la cuenta y los limites: con --strict-config, las mismas --disable y los -c de cuenta. */
export function argsAppServer() {
  return ['app-server', '--strict-config', ...ARGS_DISABLE, '-c', 'forced_login_method="chatgpt"', '-c', 'cli_auth_credentials_store="file"', '-c', 'check_for_update_on_startup=false'];
}

// Instala el programa de la IA elegida, desde Node. Lo usan el lanzador (app/inicio/preparar-motor.mjs) y la app
// (POST /api/ia/instalar):
//   instalarCodex({ alProgreso })   Codex 0.167.0 con su propio lockfile (app/inicio/codex/) y npm ci, en
//                                   <programas>/codex-0.167.0. De respaldo, el .tar.gz oficial de la release con su
//                                   sha256 (release-0.167.0.json) y el tar del sistema, en codex-0.167.0/release/.
//   instalarClaude({ alProgreso, verSalida })  Claude Code con el instalador oficial de Anthropic (el mismo de los
//                                   lanzadores); con verSalida, su avance se ve en la ventana negra.
//   codexInstalado()                el binario, la huella (.anuncios-huella) y la version exacta.
// alProgreso(frase, { porcentaje? }) recibe las frases que ve el usuario. Devuelven { ok, via?, error?, detalle? }.
// En modo prueba, o con ANUNCIOS_CODEX_BIN / ANUNCIOS_CLAUDE_BIN, no se baja nada: se simula el avance y termina bien.
// AIA_CODEX_FORZAR_RELEASE=1 salta npm y usa el respaldo de la release (para el CI).
// El freno "Codex en uso" (en Windows no se puede reemplazar un .exe que esta corriendo) lo pone la ruta que llama.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { APP } from './rutas.js';
import { leerJSON } from './archivos.js';
import { matar, resolverClaude, olvidarClaude } from './claude.js';
import { VERSION_CODEX, carpetaProgramas, carpetaCodex, resolverCodex, olvidarCodex, leerVersionCodex } from './codex-rutas.js';

const WIN = process.platform === 'win32';
const MAC = process.platform === 'darwin';
const DIR_FUENTE = path.join(APP, 'inicio', 'codex'); // package.json, package-lock.json, .npmrc y release-0.167.0.json
const ARCHIVOS_NPM = ['package.json', 'package-lock.json', '.npmrc'];
const HUELLA = '.anuncios-huella';
const VENCE_CANDADO = 20 * 60000;

const NO_PUDE = 'No pude instalarlo. Revisa tu internet y que tengas al menos 1 GB libre, y vuelve a intentarlo.';
const FRASES_CODEX = {
  bajando: `Bajando Codex (unos ${MAC ? 150 : 180} MB)…`,
  preparando: 'Preparando Codex…',
  comprobando: 'Comprobando Codex (la primera vez tarda un poco)…',
  listo: 'Codex listo.',
};
const FRASES_CLAUDE = {
  instalando: 'Instalando Claude Code con el instalador oficial de Anthropic (solo la primera vez)…',
  listo: 'Claude Code listo.',
};

// (como modoPrueba() de modo-prueba.js)
const enModoPrueba = () => process.env.ANUNCIOS_MODO_PRUEBA === '1';

/** Las frases, sin repetir la misma dos veces seguidas (el porcentaje si pasa siempre). */
function avisador(alProgreso) {
  let ultima = null;
  return (frase, extra) => {
    if (typeof alProgreso !== 'function' || (frase === ultima && !extra)) return;
    ultima = frase;
    try {
      alProgreso(frase, extra || {});
    } catch (err) {
      console.error(`[instalar] alProgreso: ${err.message}`);
    }
  };
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

async function simular(decir, frases) {
  for (const f of frases) {
    decir(f);
    await pausa(150);
  }
  return { ok: true, via: 'prueba', simulado: true };
}

/**
 * Corre un programa sin ventana y junta lo que dice (los ultimos 16 KB). Con tope: lo corta entero. ver: true deja
 * su salida en la ventana negra (el lanzador: se ve el avance del instalador) y no la junta.
 */
function correr(cmd, args, { cwd, env = process.env, shell = false, timeout = 10 * 60000, ver = false } = {}) {
  return new Promise((resolve) => {
    let salida = '';
    const juntar = (d) => {
      salida = (salida + d).slice(-16384);
    };
    // en Mac, en un grupo propio: al vencer el tope se corta el grupo entero (matar() solo corta al de arriba y un
    // curl de `curl … | bash` que quedo colgado con los tubos abiertos haria esperar el 'close' para siempre)
    const grupo = !WIN;
    let hijo;
    try {
      hijo = spawn(cmd, args, { cwd, env, shell, windowsHide: true, detached: grupo, stdio: ver ? ['ignore', 'inherit', 'inherit'] : ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      return resolve({ codigo: -1, salida: err.message });
    }
    let listo = false;
    const fin = (r) => {
      if (listo) return;
      listo = true;
      clearTimeout(reloj);
      resolve(r);
    };
    const reloj = setTimeout(() => {
      salida += '\n(se cortó: tardó demasiado)';
      if (grupo && hijo.pid) {
        try {
          process.kill(-hijo.pid, 'SIGKILL');
        } catch {
          matar(hijo); // (el grupo ya no estaba)
        }
      } else matar(hijo);
      // si algo heredo los tubos y sigue vivo, no se espera el 'close'
      const t = setTimeout(() => {
        hijo.stdout?.destroy();
        hijo.stderr?.destroy();
        fin({ codigo: -1, salida });
      }, 5000);
      t.unref?.();
    }, timeout);
    // (un decodificador por tubo: una letra partida entre dos trozos no queda como «�»)
    hijo.stdout?.setEncoding('utf8');
    hijo.stderr?.setEncoding('utf8');
    hijo.stdout?.on('data', juntar);
    hijo.stderr?.on('data', juntar);
    hijo.on('error', (err) => fin({ codigo: -1, salida: `${salida}\n${err.message}` }));
    hijo.on('close', (codigo) => fin({ codigo: codigo ?? -1, salida }));
  });
}

// ---------------------------------------------------------------- Codex: huella y candado

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const huellaDelLock = () => sha256(fs.readFileSync(path.join(DIR_FUENTE, 'package-lock.json')));

/** Lo que dice <programas>/codex-0.167.0/.anuncios-huella (o null). */
export const leerHuellaCodex = (dir = carpetaCodex()) => leerJSON(path.join(dir, HUELLA));

function huellaBuena(h) {
  try {
    return Boolean(h) && h.lock === huellaDelLock() && h.plataforma === process.platform && h.arquitectura === process.arch && h.version === VERSION_CODEX;
  } catch {
    return false; // (sin el lockfile de la app no se puede comparar)
  }
}

function escribirHuella(dir, via) {
  const h = { lock: huellaDelLock(), plataforma: process.platform, arquitectura: process.arch, via, version: VERSION_CODEX, fecha: new Date().toISOString() };
  fs.writeFileSync(path.join(dir, HUELLA), `${JSON.stringify(h, null, 2)}\n`);
}

/**
 * true si Codex esta listo: el binario, la huella de esta version y plataforma, y `--version` = codex-cli 0.167.0.
 * Con via ('npm' | 'release'), ademas tiene que haberse instalado por esa via.
 */
export async function codexInstalado({ via } = {}) {
  const bin = resolverCodex();
  if (!bin) return false;
  if (bin.via !== 'prueba') {
    const h = leerHuellaCodex();
    if (!huellaBuena(h) || (via && h.via !== via)) return false;
  }
  const v = await leerVersionCodex({ bin });
  return v.version === VERSION_CODEX;
}

const pidVivo = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
};

const rutaCandado = () => path.join(carpetaProgramas(), '.instalando-codex');

/** El candado <programas>/.instalando-codex (pid y hora; vence a los 20 min): el lanzador y la app no instalan a la vez. */
function tomarCandado() {
  const ruta = rutaCandado();
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  for (let i = 0; i < 2; i++) {
    try {
      fs.writeFileSync(ruta, JSON.stringify({ pid: process.pid, hora: new Date().toISOString() }), { flag: 'wx' });
      return true;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      const c = leerJSON(ruta);
      const edad = Date.now() - (Date.parse(c?.hora || '') || 0);
      if (edad < VENCE_CANDADO && Number(c?.pid) && Number(c.pid) !== process.pid && pidVivo(Number(c.pid))) return false;
      fs.rmSync(ruta, { force: true }); // vencido, o de un proceso que ya no esta
    }
  }
  return false;
}

function soltarCandado() {
  try {
    const c = leerJSON(rutaCandado());
    if (Number(c?.pid) === process.pid) fs.rmSync(rutaCandado(), { force: true });
  } catch {
    /* ya no estaba */
  }
}

// ---------------------------------------------------------------- Codex: npm ci

/** El entorno de npm: sin claves (las del motor ni las de otras cuentas) y con el npm del Node de la app primero. */
function entornoNpm() {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/^(KIE_|ELEVENLABS_|APIMART_|SUNO_|OPENAI_|CODEX_|AZURE_OPENAI_|ANTHROPIC_|CLAUDE_)/i.test(k)) delete env[k];
  const kPath = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') || 'PATH';
  env[kPath] = [path.dirname(process.execPath), env[kPath]].filter(Boolean).join(path.delimiter);
  return env;
}

// npm es npm.cmd en Windows: desde Node 20.12 un .cmd solo se lanza con shell. Ahi va como una sola linea (los
// argumentos son fijos, sin espacios; la carpeta va por cwd): con shell y una lista de argumentos Node avisa
// DEP0190 en la ventana negra. --include=optional ademas del .npmrc: los binarios de cada plataforma son dependencias
// opcionales de @openai/codex y un npm con omit=optional no los bajaria.
const ARGS_NPM_CI = ['ci', '--include=optional', '--no-audit', '--no-fund', '--ignore-scripts', '--loglevel=error'];
const npmCi = (dir) =>
  WIN
    ? correr(['npm', ...ARGS_NPM_CI].join(' '), [], { cwd: dir, env: entornoNpm(), shell: true, timeout: 20 * 60000 })
    : correr('npm', ARGS_NPM_CI, { cwd: dir, env: entornoNpm(), timeout: 20 * 60000 });

const deNpm = (bin) => Boolean(bin) && bin.cmd.split(/[\\/]/).includes('node_modules');

// ---------------------------------------------------------------- Codex: el respaldo de la release

function paqueteDeRelease() {
  const j = JSON.parse(fs.readFileSync(path.join(DIR_FUENTE, `release-${VERSION_CODEX}.json`), 'utf8'));
  // (en Windows ARM, el de x64: el Node de la app es x64 y corre emulado, como ffmpeg)
  const clave = WIN ? 'win32-x64' : `${process.platform}-${process.arch}`;
  const p = j.paquetes?.[clave];
  if (!p?.url || !/^[0-9a-f]{64}$/.test(p.sha256 || '')) throw new Error(`la release no tiene el paquete de ${clave}`);
  return p;
}

/** Baja `url` a `destino` comprobando su sha256 mientras baja, con el porcentaje real (content-length). */
async function bajar(url, destino, { sha256: esperado, bytes, decir, frase }) {
  const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30 * 60000) });
  if (!r.ok || !r.body) throw new Error(`la descarga respondió ${r.status}`);
  const total = Number(r.headers.get('content-length')) || Number(bytes) || 0;
  const h = crypto.createHash('sha256');
  let llevo = 0;
  let ultimo = -1;
  // con pipeline: si el disco se llena (ENOSPC) el error vuelve aca y no tumba el proceso (antes el archivo podia
  // emitir 'error' sin nadie escuchando); y el archivo queda cerrado, asi se puede borrar enseguida
  const contar = new Transform({
    transform(trozo, _cod, cb) {
      h.update(trozo);
      llevo += trozo.length;
      const p = total ? Math.min(100, Math.floor((llevo * 100) / total)) : null;
      if (p !== null && p !== ultimo) {
        ultimo = p;
        decir(frase, { porcentaje: p });
      }
      cb(null, trozo);
    },
  });
  await pipeline(Readable.fromWeb(r.body), contar, fs.createWriteStream(destino));
  const sha = h.digest('hex');
  if (sha !== esperado) throw new Error(`la huella del paquete no coincide (${sha.slice(0, 12)}… en vez de ${esperado.slice(0, 12)}…)`);
}

// El tar del sistema (viene en Windows 10/11 y en Mac). En Windows, el de System32 y no otro del PATH (el de Git no
// entiende C:\).
function tarDelSistema() {
  if (WIN) {
    const t = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
    return fs.existsSync(t) ? t : 'tar';
  }
  return fs.existsSync('/usr/bin/tar') ? '/usr/bin/tar' : 'tar';
}

/** Baja el .tar.gz de la release, comprueba su sha256 y lo deja en <dir>/release (sin carpeta de arriba). */
async function instalarDeRelease(dir, decir) {
  const p = paqueteDeRelease();
  const descarga = path.join(dir, '.descarga');
  const nuevo = path.join(dir, 'release.nuevo');
  fs.rmSync(descarga, { recursive: true, force: true });
  fs.rmSync(nuevo, { recursive: true, force: true });
  fs.mkdirSync(descarga, { recursive: true });
  fs.mkdirSync(nuevo, { recursive: true });
  try {
    const archivo = path.join(descarga, p.archivo);
    let error = null;
    for (let intento = 0; intento < 3; intento++) {
      try {
        decir(FRASES_CODEX.bajando);
        await bajar(p.url, archivo, { sha256: p.sha256, bytes: p.bytes, decir, frase: FRASES_CODEX.bajando });
        error = null;
        break;
      } catch (err) {
        error = err;
        fs.rmSync(archivo, { force: true });
      }
    }
    if (error) throw error;
    decir(FRASES_CODEX.preparando);
    // con rutas relativas: el tar de Windows puede no entender una carpeta con tildes o eñes en sus argumentos
    const r = await correr(tarDelSistema(), ['-xzf', path.join('..', '.descarga', p.archivo)], { cwd: nuevo, timeout: 10 * 60000 });
    const bin = path.join(nuevo, 'bin', WIN ? 'codex.exe' : 'codex');
    if (r.codigo !== 0 || !fs.existsSync(bin)) throw new Error(`no se pudo abrir el paquete: ${r.salida.slice(-600)}`);
    if (!WIN) fs.chmodSync(bin, 0o755);
    const release = path.join(dir, 'release');
    fs.rmSync(release, { recursive: true, force: true });
    fs.renameSync(nuevo, release);
  } finally {
    fs.rmSync(descarga, { recursive: true, force: true });
    fs.rmSync(nuevo, { recursive: true, force: true });
  }
}

/** Borra otras versiones de Codex de la carpeta de programas (codex-<version> que no son la de ahora). */
function borrarOtrasVersiones() {
  const base = carpetaProgramas();
  let nombres = [];
  try {
    nombres = fs.readdirSync(base);
  } catch {
    return;
  }
  for (const n of nombres) {
    if (!/^codex-\d+\.\d+\.\d+/.test(n) || n === `codex-${VERSION_CODEX}`) continue;
    try {
      fs.rmSync(path.join(base, n), { recursive: true, force: true });
    } catch {
      /* un programa abierto: se borra la proxima vez */
    }
  }
}

let instalandoCodex = false;

/**
 * Deja Codex 0.167.0 listo en <programas>/codex-0.167.0: npm ci con el lockfile de la app (un reintento) y, si falla
 * dos veces o no aparece el binario, el .tar.gz oficial de la release con su sha256. La primera `--version` tiene 2 min
 * de tope y sirve de arranque en frio. -> { ok, via: 'npm' | 'release', ya?, ocupado?, error?, detalle? }
 */
export async function instalarCodex({ alProgreso } = {}) {
  const decir = avisador(alProgreso);
  if (enModoPrueba() || process.env.ANUNCIOS_CODEX_BIN) return simular(decir, [FRASES_CODEX.bajando, FRASES_CODEX.preparando, FRASES_CODEX.comprobando, FRASES_CODEX.listo]);
  const ocupado = { ok: false, ocupado: true, error: 'Codex ya se está instalando. Espera a que termine.' };
  if (instalandoCodex) return ocupado;
  instalandoCodex = true;
  try {
    if (!tomarCandado()) return ocupado;
    const forzarRelease = process.env.AIA_CODEX_FORZAR_RELEASE === '1';
    olvidarCodex();
    if (await codexInstalado({ via: forzarRelease ? 'release' : undefined })) {
      decir(FRASES_CODEX.listo);
      return { ok: true, via: leerHuellaCodex()?.via || null, ya: true };
    }
    const dir = carpetaCodex();
    fs.mkdirSync(dir, { recursive: true });
    fs.rmSync(path.join(dir, HUELLA), { force: true }); // una instalacion a medias nunca cuenta como lista
    let via = null;
    const detalles = [];
    try {
      for (const f of ARCHIVOS_NPM) fs.copyFileSync(path.join(DIR_FUENTE, f), path.join(dir, f));
      if (!forzarRelease) {
        decir(FRASES_CODEX.bajando);
        let r = await npmCi(dir);
        if (r.codigo !== 0) r = await npmCi(dir); // un corte de internet a la mitad: una vez mas
        decir(FRASES_CODEX.preparando);
        olvidarCodex();
        if (r.codigo === 0 && deNpm(resolverCodex())) via = 'npm';
        else detalles.push(`npm ci (${r.codigo}): ${r.salida.trim().slice(-1500) || 'sin el binario de esta PC'}`);
      }
    } catch (err) {
      detalles.push(`npm: ${err.message}`);
    }
    if (!via) {
      try {
        await instalarDeRelease(dir, decir);
        via = 'release';
      } catch (err) {
        detalles.push(`release: ${err.message}`);
      }
    }
    if (!via) return { ok: false, error: NO_PUDE, detalle: detalles.join('\n') };
    // lo de la otra via no queda: el que busca el binario mira primero node_modules
    fs.rmSync(path.join(dir, via === 'npm' ? 'release' : 'node_modules'), { recursive: true, force: true });
    olvidarCodex();
    decir(FRASES_CODEX.comprobando);
    const v = await leerVersionCodex({ timeout: 2 * 60000 });
    if (v.version !== VERSION_CODEX) return { ok: false, error: NO_PUDE, detalle: [...detalles, `--version: ${v.texto || v.err?.message || 'sin respuesta'}`].join('\n') };
    escribirHuella(dir, via);
    borrarOtrasVersiones();
    decir(FRASES_CODEX.listo);
    return { ok: true, via, version: VERSION_CODEX, ...(detalles.length ? { detalle: detalles.join('\n') } : {}) };
  } catch (err) {
    return { ok: false, error: NO_PUDE, detalle: err.message };
  } finally {
    soltarCandado();
    olvidarCodex();
    instalandoCodex = false;
  }
}

// ---------------------------------------------------------------- Claude Code

/** El entorno del instalador: el de la app sin claves (los proxys quedan: el instalador baja de internet). */
function entornoInstalador() {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/^(KIE_|ELEVENLABS_|APIMART_|SUNO_|OPENAI_|CODEX_|ANTHROPIC_|CLAUDE_CODE_OAUTH_TOKEN$)/i.test(k)) delete env[k];
  return env;
}

// Que la Terminal tambien lo encuentre cuando la abras tu (lo mismo que el .command:66-69).
function agregarAlZshrc() {
  try {
    const zshrc = path.join(os.homedir(), '.zshrc');
    const bin = path.join(os.homedir(), '.local', 'bin', 'claude');
    if (!fs.existsSync(bin)) return;
    let texto = '';
    try {
      texto = fs.readFileSync(zshrc, 'utf8');
    } catch {
      /* todavia no existe */
    }
    if (!texto.includes('.local/bin')) fs.appendFileSync(zshrc, 'export PATH="$HOME/.local/bin:$PATH"\n');
  } catch {
    /* no es necesario para la app: ella lo encuentra igual */
  }
}

let instalandoClaude = false;

/**
 * Claude Code con el instalador oficial de Anthropic (los de los lanzadores de hoy), desde Node. Baja unos 250 MB:
 * con internet lento tarda mas de 10 min, asi que el tope (60 min) es solo contra un instalador colgado; no se corta
 * por estar callado (mientras baja casi no escribe nada). verSalida: su avance en la ventana negra (el lanzador).
 * -> { ok, via: 'oficial', ocupado?, error?, detalle? }
 */
export async function instalarClaude({ alProgreso, verSalida = false } = {}) {
  const decir = avisador(alProgreso);
  if (enModoPrueba() || process.env.ANUNCIOS_CLAUDE_BIN) return simular(decir, [FRASES_CLAUDE.instalando, FRASES_CLAUDE.listo]);
  if (instalandoClaude) return { ok: false, ocupado: true, error: 'Claude Code ya se está instalando. Espera a que termine.' };
  instalandoClaude = true;
  try {
    decir(FRASES_CLAUDE.instalando);
    const env = entornoInstalador();
    const timeout = 60 * 60000;
    const ver = Boolean(verSalida);
    let r;
    if (WIN) {
      const ps = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      r = await correr(fs.existsSync(ps) ? ps : 'powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'irm https://claude.ai/install.ps1 | iex'], { cwd: os.homedir(), env, timeout, ver });
    } else {
      r = await correr('/bin/bash', ['-c', 'curl -fsSL https://claude.ai/install.sh | bash'], { cwd: os.homedir(), env, timeout, ver });
    }
    olvidarClaude();
    if (!resolverClaude()) return { ok: false, error: NO_PUDE, detalle: r.salida.trim().slice(-1500) };
    if (MAC) agregarAlZshrc();
    decir(FRASES_CLAUDE.listo);
    return { ok: true, via: 'oficial' };
  } catch (err) {
    return { ok: false, error: NO_PUDE, detalle: err.message };
  } finally {
    instalandoClaude = false;
  }
}

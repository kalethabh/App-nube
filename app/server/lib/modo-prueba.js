// MODO PRUEBA de la app: todo lo que cobra va a simuladores locales y nada del
// motor sale a internet.
//
//   npm run dev:prueba     la app como con npm run dev, pero con ANUNCIOS_MODO_PRUEBA=1
//
// Con ANUNCIOS_MODO_PRUEBA=1 la app arranca, en este mismo proceso y en 127.0.0.1:
//   - el kie.ai simulado (produccion/pruebas/kie-simulado.js): imagenes, videos,
//     Suno (musica y canciones) y el saldo de la cuenta;
//   - el ElevenLabs simulado (produccion/pruebas/elevenlabs-simulado.js): la voz
//     con tiempos y Scribe;
//   - la GUARDIA: un proxy que contesta 403 a todo. Los procesos del motor corren
//     con NODE_USE_ENV_PROXY=1 y HTTP(S)_PROXY apuntando aqui (como en
//     produccion/pruebas/probar-velocidad.js): si algo quisiera salir a kie.ai,
//     a ElevenLabs o a cualquier otro lado, muere aqui y queda anotado.
//
// Cada proceso del motor que lanza el conductor se arranca con el entorno de
// entornoMotor(): las direcciones de los simuladores (KIE_BASE_URL,
// KIE_BASE_ARCHIVOS_URL, ELEVENLABS_BASE_URL), claves falsas ("simulada": el
// .env no las pisa, process.loadEnvFile no toca lo que ya esta en el entorno),
// las esperas del motor a la escala del simulado y la guardia.
//
// Antes de dar el primer entorno se COMPRUEBA, en un proceso hijo con ese mismo
// entorno, que config.js y elevenlabs-client.js del motor apuntan a los
// simuladores, que las claves son las falsas aun despues de cargar el .env y que
// la guardia corta. Si algo no da, entornoMotor() tira un error y no se corre
// nada: el modo prueba nunca cae a lo real sin avisar.
//
// Sin la variable no arranca nada de esto, y entornoMotor() devuelve el entorno
// de siempre (todo va real).
//
// Ajustes opcionales, como variables al arrancar la app:
//   ANUNCIOS_PRUEBA_ESCALA=0.05     las latencias reales de kie por esta escala (0.05: una
//                                   imagen tarda 3 a 9 s en vez de 1 a 3 minutos)
//   ANUNCIOS_PRUEBA_FALLOS=servidor=10,contenido=5,trabadas=1,consulta500=5   (kie-simulado.js)
//   ANUNCIOS_PRUEBA_FALLOS_VOZ=tts500=20,vozColada=10,scribe500=5,sinCuota=1   (elevenlabs-simulado.js)
//   ANUNCIOS_PRUEBA_SALDO=300       los creditos que le quedan a la cuenta de kie simulada al
//                                   abrir la app (por defecto, de sobra)
//   ANUNCIOS_PRUEBA_SEMILLA=1       misma semilla, mismos fallos
//   ANUNCIOS_PRUEBA_LIMPIO=1        arranca sin las tareas de la sesion anterior
//
// El kie simulado guarda sus tareas en temp/_modo-prueba/kie-estado.jsonl: al
// cerrar y abrir la app, las tareas pendientes del motor (*.kie-pendiente.json)
// se siguen consultando, el saldo sigue donde quedo y /__stats cuenta los
// duplicados contra lo de antes. Lo que dicen los simuladores, linea por linea,
// queda en temp/_modo-prueba/simulados.log.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { RAIZ, TEMP, ENV, CONFIG, PUERTO_DE_PRUEBA } from './rutas.js';

const PRUEBAS = path.join(RAIZ, 'produccion', 'pruebas');
// "_": el tablero no lo toma por un anuncio. Una app de prueba en otro puerto (PUERTO=…) tiene los suyos aparte:
// su propio saldo simulado y sus tareas, sin mezclarse con las de otra app de prueba abierta a la vez.
export const DIR_MODO_PRUEBA = path.join(TEMP, PUERTO_DE_PRUEBA ? `_modo-prueba-${PUERTO_DE_PRUEBA}` : '_modo-prueba');
const ESTADO_KIE = path.join(DIR_MODO_PRUEBA, 'kie-estado.jsonl');
const REGISTRO = path.join(DIR_MODO_PRUEBA, 'simulados.log');

export const CLAVE_FALSA = 'simulada';

// Las esperas del motor en tiempo real (config.js). Se escalan igual que las
// latencias del simulado: con 0.05 una imagen avisa a los 18 s y se da por
// perdida a los 90 s, no a los 6 y 30 minutos.
const ESPERAS_REALES_MS = {
  KIE_AVISO_ESPERA_IMAGEN_MS: 6 * 60 * 1000,
  KIE_TOPE_ESPERA_IMAGEN_MS: 30 * 60 * 1000,
  KIE_AVISO_ESPERA_VIDEO_MS: 15 * 60 * 1000,
  KIE_TOPE_ESPERA_VIDEO_MS: 45 * 60 * 1000,
};
// Nunca menos que esto: con una escala muy chica el motor daria por perdida
// una tarea que el simulado todavia esta "generando".
const ESPERA_MINIMA_MS = 15000;

// Lo que nunca puede venir de afuera en modo prueba: apuntaria el motor a otro lado.
const PROTEGIDAS = /^(KIE_BASE_URL|KIE_BASE_ARCHIVOS_URL|KIE_API_KEY|ELEVENLABS_BASE_URL|ELEVENLABS_API_KEY|NODE_USE_ENV_PROXY|HTTPS?_PROXY|ALL_PROXY|NO_PROXY)$/i;
// Lo heredado que se saca antes de armar el entorno simulado.
const HEREDADAS_FUERA = /^(KIE_|ELEVENLABS_API_KEY$|ELEVENLABS_BASE_URL$|ELEVENLABS_VOICE_ID$|APIMART_|SUNO_|NODE_USE_ENV_PROXY$|(HTTPS?|ALL|NO)_PROXY$)/i;

/** true si la app arranco en modo prueba (se lee cada vez: npm run dev:prueba la pone antes de todo). */
export function modoPrueba() {
  return process.env.ANUNCIOS_MODO_PRUEBA === '1';
}

const numeroDe = (nombre, porDefecto) => {
  const n = Number(process.env[nombre]);
  return process.env[nombre] !== undefined && process.env[nombre] !== '' && Number.isFinite(n) ? n : porDefecto;
};

function opcionesDelEntorno() {
  return {
    escala: numeroDe('ANUNCIOS_PRUEBA_ESCALA', 0.05),
    semilla: numeroDe('ANUNCIOS_PRUEBA_SEMILLA', 1),
    fallos: process.env.ANUNCIOS_PRUEBA_FALLOS || '',
    fallosVoz: process.env.ANUNCIOS_PRUEBA_FALLOS_VOZ || '',
    saldo: process.env.ANUNCIOS_PRUEBA_SALDO ? numeroDe('ANUNCIOS_PRUEBA_SALDO', undefined) : undefined,
    limpio: process.env.ANUNCIOS_PRUEBA_LIMPIO === '1',
  };
}

// ---------------------------------------------------------------- estado

let arranque = null; // la promesa de iniciarModoPrueba(), una sola por proceso
let sims = null; // { kie, elevenlabs, guardia, opciones, desde }
let ultimoError = null;
let avisos = [];
const salidas = { total: 0, ultimas: [] }; // lo que la guardia corto (sin contar su propia sonda)

function anotarLinea(origen, linea) {
  try {
    fs.appendFileSync(REGISTRO, `${new Date().toLocaleTimeString('es-AR', { hour12: false })} [${origen}] ${linea.trim()}\n`, 'utf8');
  } catch {
    // sin registro sigue andando
  }
}

// ---------------------------------------------------------------- guardia de red

/** Proxy local que contesta 403 a todo y anota cada intento de salida. */
async function arrancarGuardia() {
  const anotar = (que) => {
    salidas.total++;
    salidas.ultimas.push({ cuando: new Date().toISOString(), que });
    if (salidas.ultimas.length > 20) salidas.ultimas.shift();
    anotarLinea('guardia', que.includes('modo-prueba.invalid') ? `la sonda de la comprobacion salio cortada (bien): ${que}` : `BLOQUEADA ${que}`);
  };
  const srv = http.createServer((req, res) => {
    anotar(`${req.method} ${req.url}`);
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Modo prueba: salida a internet bloqueada');
  });
  srv.on('connect', (req, socket) => {
    anotar(`CONNECT ${req.url}`);
    socket.on('error', () => {});
    socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
  });
  await new Promise((resolve, reject) => {
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', resolve);
  });
  return {
    url: `http://127.0.0.1:${srv.address().port}`,
    cerrar: () =>
      new Promise((resolve) => {
        srv.close(() => resolve());
        srv.closeAllConnections?.();
      }),
  };
}

// ---------------------------------------------------------------- voces conocidas

/** El ELEVENLABS_VOICE_ID del .env, si hay (solo esa linea: las claves no se leen). */
function vozDelEnv() {
  try {
    const m = fs.readFileSync(ENV, 'utf8').match(/^\s*ELEVENLABS_VOICE_ID\s*=\s*["']?([^"'\s#]+)/m);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

const comoVoz = (v) => (typeof v === 'string' ? { id: v } : { id: v?.id, nombre: v?.nombre });

/**
 * Las voces que la app ya uso: vozPorEstilo de app/config.json y la `voz` de
 * cada temp/<slug>/app/brief.json. La cuenta simulada las tiene todas, asi
 * seleccionarVoz() encuentra la del anuncio aunque quien lanza el proceso
 * ponga ELEVENLABS_VOICE_ID por su cuenta, despues de entornoMotor().
 */
// (se guarda unos segundos: cada proceso del motor la pide, y leer todos los brief.json con la PC ocupada frenaba la app)
let vocesGuardadas = { t: 0, lista: [] };
function vocesDeLaApp() {
  if (Date.now() - vocesGuardadas.t < 5000) return vocesGuardadas.lista;
  const voces = [];
  try {
    const c = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
    voces.push(...Object.values(c?.vozPorEstilo || {}).map(comoVoz));
  } catch {
    // sin config todavia
  }
  let carpetas = [];
  try {
    carpetas = fs.readdirSync(TEMP, { withFileTypes: true }).filter((d) => d.isDirectory());
  } catch {
    // sin temp/ todavia
  }
  for (const d of carpetas) {
    try {
      const b = JSON.parse(fs.readFileSync(path.join(TEMP, d.name, 'app', 'brief.json'), 'utf8'));
      if (b?.voz) voces.push(comoVoz(b.voz));
    } catch {
      // no es un anuncio de la app (o el brief esta a medio escribir)
    }
  }
  vocesGuardadas = { t: Date.now(), lista: voces.filter((v) => v.id) };
  return vocesGuardadas.lista;
}

// ---------------------------------------------------------------- entorno

/** El entorno de un proceso del motor contra los simuladores (sin la voz: la pone entornoMotor). */
function entornoSimulado(s) {
  const env = { ...process.env };
  // En Windows las variables no distinguen mayusculas: se borran todas las
  // grafias y las nuevas van solo en mayuscula.
  for (const k of Object.keys(env)) if (HEREDADAS_FUERA.test(k)) delete env[k];
  Object.assign(env, {
    ANUNCIOS_MODO_PRUEBA: '1',
    // El render usa el Remotion ya instalado: npm/npx tampoco consultan
    // actualizaciones ni descargan paquetes durante una prueba sin internet.
    NPM_CONFIG_OFFLINE: 'true',
    NPM_CONFIG_UPDATE_NOTIFIER: 'false',
    KIE_BASE_URL: s.kie.url,
    KIE_BASE_ARCHIVOS_URL: s.kie.url,
    ELEVENLABS_BASE_URL: s.elevenlabs.url,
    KIE_API_KEY: CLAVE_FALSA,
    ELEVENLABS_API_KEY: CLAVE_FALSA,
    NODE_USE_ENV_PROXY: '1',
    HTTP_PROXY: s.guardia.url,
    HTTPS_PROXY: s.guardia.url,
    NO_PROXY: '127.0.0.1,localhost,::1',
  });
  for (const [k, ms] of Object.entries(ESPERAS_REALES_MS)) env[k] = String(Math.max(ESPERA_MINIMA_MS, Math.round(ms * s.opciones.escala)));
  return env;
}

/**
 * LA COMPROBACION, en un hijo con el entorno simulado (como lo van a ver los
 * comandos del motor): adonde apuntan KIE.base, KIE.baseArchivos y
 * ELEVENLABS.base, si las claves siguen siendo las falsas despues de
 * cargarEnv(), y si la guardia corta una salida de prueba.
 */
async function comprobar(s) {
  const env = { ...entornoSimulado(s), ELEVENLABS_VOICE_ID: 'sim-narrador' };
  const sonda = 'guardia.modo-prueba.invalid';
  const url = (archivo) => JSON.stringify(pathToFileURL(path.join(RAIZ, 'produccion', archivo)).href);
  const codigo = [
    `const cfg = await import(${url('config.js')});`,
    `const el = await import(${url('elevenlabs-client.js')});`,
    'const r = { kie: cfg.KIE?.base ?? null, kieArchivos: cfg.KIE?.baseArchivos ?? null, eleven: el.ELEVENLABS?.base ?? null };',
    "try { cfg.cargarEnv?.(); r.env = 'ok'; } catch (e) { r.env = String(e.message).split('\\n')[0]; }",
    `r.claves = process.env.KIE_API_KEY === ${JSON.stringify(CLAVE_FALSA)} && process.env.ELEVENLABS_API_KEY === ${JSON.stringify(CLAVE_FALSA)};`,
    `try { await fetch('https://${sonda}/'); r.salio = true; } catch { r.salio = false; }`,
    "console.log('@@CHEQUEO@@' + JSON.stringify(r));",
  ].join('\n');

  const antes = salidas.total;
  const { codigo: salida, stdout, stderr } = await new Promise((resolve) => {
    const p = spawn(process.execPath, ['--input-type=module', '-e', codigo], { cwd: RAIZ, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    const reloj = setTimeout(() => p.kill(), 60000);
    p.on('error', (e) => (err += `\n${e.message}`));
    p.on('close', (c) => {
      clearTimeout(reloj);
      resolve({ codigo: c, stdout: out, stderr: err });
    });
  });
  const linea = stdout.split(/\r?\n/).find((l) => l.startsWith('@@CHEQUEO@@'));
  if (salida !== 0 || !linea) {
    return { motivos: [`no pude importar el motor para comprobarlo (salio con ${salida}): ${stderr.trim().split('\n').slice(-2).join(' | ')}`], avisos: [] };
  }
  const r = JSON.parse(linea.slice('@@CHEQUEO@@'.length));
  const local = (u, esperado) => {
    try {
      const x = new URL(u);
      return x.hostname === '127.0.0.1' && x.origin === new URL(esperado).origin;
    } catch {
      return false;
    }
  };
  const motivos = [];
  const avisosNuevos = [];
  if (!local(r.kie, s.kie.url)) motivos.push(`KIE.base = ${r.kie} (tiene que ser ${s.kie.url})`);
  if (!local(r.kieArchivos, s.kie.url)) motivos.push(`KIE.baseArchivos = ${r.kieArchivos} (tiene que ser ${s.kie.url})`);
  if (!local(r.eleven, s.elevenlabs.url)) motivos.push(`ELEVENLABS.base = ${r.eleven} (tiene que ser ${s.elevenlabs.url}; elevenlabs-client.js no lee ELEVENLABS_BASE_URL)`);
  if (!r.claves) motivos.push('despues de cargar el .env las claves del motor no son las falsas');
  // Sin .env el motor no arranca ningun comando (cargarEnv lo exige), en prueba
  // y en real: no es un riesgo de gasto, pero el conductor va a fallar en el primer paso.
  if (r.env !== 'ok') avisosNuevos.push(`el motor no pudo cargar su .env: ${r.env}`);
  // La sonda sale por la guardia: no cuenta como salida del motor.
  const vio = salidas.ultimas.some((x) => x.que.includes(sonda));
  if (r.salio || !vio) motivos.push('la guardia de red no corto la salida de prueba (hace falta Node 24 por NODE_USE_ENV_PROXY)');
  salidas.ultimas = salidas.ultimas.filter((x) => !x.que.includes(sonda));
  salidas.total = antes;
  return { motivos, avisos: avisosNuevos };
}

// ---------------------------------------------------------------- arrancar y cerrar

async function arrancar() {
  const opciones = opcionesDelEntorno();
  fs.mkdirSync(DIR_MODO_PRUEBA, { recursive: true });
  if (opciones.limpio) fs.rmSync(ESTADO_KIE, { force: true });
  try {
    // Se agrega (puede haber otro proceso en modo prueba escribiendo); pasado 5 MB se empieza de nuevo.
    if (fs.existsSync(REGISTRO) && fs.statSync(REGISTRO).size > 5 * 1024 * 1024) fs.rmSync(REGISTRO, { force: true });
    fs.appendFileSync(REGISTRO, `\n==== Modo prueba ${new Date().toISOString()} (proceso ${process.pid})\n`, 'utf8');
  } catch {
    // sin registro sigue andando
  }

  const kieSim = await import(pathToFileURL(path.join(PRUEBAS, 'kie-simulado.js')).href);
  const elSim = await import(pathToFileURL(path.join(PRUEBAS, 'elevenlabs-simulado.js')).href);

  const abiertos = [];
  try {
    const kie = await kieSim.iniciar({
      escala: opciones.escala,
      semilla: opciones.semilla,
      fallos: opciones.fallos || null,
      dirCache: path.join(DIR_MODO_PRUEBA, 'cache'),
      estado: ESTADO_KIE,
      alRegistrar: (l) => anotarLinea('kie', l),
    });
    abiertos.push(kie);
    // ANUNCIOS_PRUEBA_SALDO es lo que queda AL ABRIR la app, aunque el estado
    // traiga lo gastado en la sesion anterior.
    if (opciones.saldo !== undefined) kie.fijarSaldo(opciones.saldo);
    const voces = [vozDelEnv(), ...vocesDeLaApp()].filter(Boolean).map(comoVoz);
    const elevenlabs = await elSim.iniciar({
      semilla: opciones.semilla,
      fallos: opciones.fallosVoz || null,
      voces,
      dirCache: path.join(DIR_MODO_PRUEBA, 'cache', 'elevenlabs'),
      alRegistrar: (l) => anotarLinea('elevenlabs', l),
    });
    abiertos.push(elevenlabs);
    const guardia = await arrancarGuardia();
    abiertos.push(guardia);

    const s = { kie, elevenlabs, guardia, opciones, desde: new Date().toISOString() };
    const chequeo = await comprobar(s);
    if (chequeo.motivos.length) {
      throw new Error(`Modo prueba: el motor NO apunta a los simuladores, no corro nada.\n  - ${chequeo.motivos.join('\n  - ')}`);
    }
    avisos = chequeo.avisos;
    sims = s;
    ultimoError = null;
    console.log(`\n  MODO PRUEBA: no se gasta nada. kie ${kie.url}, ElevenLabs ${elevenlabs.url}, guardia ${guardia.url}`);
    console.log(`  Escala ${opciones.escala}, fallos kie: ${kieSim.describirFallos(kieSim.parsearFallos(opciones.fallos))}, voz: ${elSim.describirFallos(elSim.parsearFallos(opciones.fallosVoz))}`);
    for (const a of avisos) console.log(`  ojo: ${a}`);
    console.log(`  Registro: ${path.relative(RAIZ, REGISTRO)}\n`);
    return s;
  } catch (e) {
    for (const x of abiertos.reverse()) await x.cerrar().catch(() => {});
    throw e;
  }
}

/**
 * Arranca los simuladores y la guardia (una sola vez por proceso; si fallo, el
 * proximo llamado lo reintenta). Sin modo prueba devuelve null y no hace nada.
 */
export function iniciarModoPrueba() {
  if (!modoPrueba()) return Promise.resolve(null);
  if (!arranque) {
    arranque = arrancar().catch((e) => {
      arranque = null;
      ultimoError = e.message;
      throw e;
    });
  }
  return arranque;
}

export async function cerrarModoPrueba() {
  const s = sims;
  sims = null;
  arranque = null;
  if (!s) return;
  await Promise.all([s.kie.cerrar(), s.elevenlabs.cerrar(), s.guardia.cerrar()].map((p) => p.catch(() => {})));
}

/**
 * El entorno para lanzar un proceso del motor (spawn(..., { env })).
 *
 *   extra   variables que pide quien llama (KIE_LIMITE_CREACIONES, ...). En modo
 *           prueba no pueden pisar las direcciones, las claves ni la guardia.
 *   voz     { id, nombre }: la voz del anuncio. Va como ELEVENLABS_VOICE_ID (no
 *           se toca el .env) y, en modo prueba, la cuenta simulada la registra
 *           para que seleccionarVoz() la encuentre. Tambien vale pasarla como
 *           extra.ELEVENLABS_VOICE_ID.
 *
 * En modo prueba, sin voz, va la del .env o, si no hay, la primera del
 * simulado: generar-audio nunca se queda preguntando.
 *
 * Sin modo prueba: el entorno de siempre con `extra` y la voz, y sin las
 * direcciones de prueba que pudieran haber quedado heredadas (todo va real).
 */
export async function entornoMotor(extra = {}, { voz = null } = {}) {
  if (!modoPrueba()) {
    const env = { ...process.env };
    for (const k of Object.keys(env)) if (/^(KIE_BASE_URL|KIE_BASE_ARCHIVOS_URL|ELEVENLABS_BASE_URL)$/i.test(k)) delete env[k];
    Object.assign(env, extra);
    if (voz?.id) env.ELEVENLABS_VOICE_ID = String(voz.id);
    return env;
  }
  const s = await iniciarModoPrueba();
  const env = entornoSimulado(s);
  for (const [k, v] of Object.entries(extra || {})) if (!PROTEGIDAS.test(k) && v !== undefined && v !== null) env[k] = String(v);
  const vozId = String(voz?.id || extra?.ELEVENLABS_VOICE_ID || vozDelEnv() || 'sim-narrador');
  // Las de los anuncios de la app primero (con su nombre), despues la de este proceso.
  for (const v of vocesDeLaApp()) s.elevenlabs.agregarVoz(v);
  s.elevenlabs.agregarVoz({ id: vozId, nombre: voz?.nombre });
  env.ELEVENLABS_VOICE_ID = vozId;
  return env;
}

/**
 * Para la banda y para depurar: { activo, listo, error, kie, elevenlabs,
 * guardia, opciones, salidasBloqueadas: { total, ultimas }, avisos }. Las
 * salidas bloqueadas son intentos del motor de ir a internet: con el motor
 * sano tiene que quedar en 0.
 */
export function estadoModoPrueba() {
  const activo = modoPrueba();
  return {
    activo,
    listo: Boolean(sims),
    error: activo ? ultimoError : null,
    kie: sims?.kie.url ?? null,
    elevenlabs: sims?.elevenlabs.url ?? null,
    guardia: sims?.guardia.url ?? null,
    desde: sims?.desde ?? null,
    opciones: sims?.opciones ?? (activo ? opcionesDelEntorno() : null),
    salidasBloqueadas: { total: salidas.total, ultimas: [...salidas.ultimas] },
    avisos: [...avisos],
  };
}

/** Las estadisticas de los dos simuladores (las de /__stats), o null fuera del modo prueba. */
export function statsModoPrueba() {
  if (!sims) return null;
  return { kie: sims.kie.stats(), elevenlabs: sims.elevenlabs.stats() };
}

/**
 * El saldo de la cuenta de kie simulada: { inicial, gastado, reservado,
 * restante } en creditos. Es el que ve el motor (GET /api/v1/chat/credit). Para
 * que /api/saldo muestre este y no el real cuando la app esta en modo prueba.
 */
export async function saldoSimulado() {
  const s = await iniciarModoPrueba();
  return s ? s.kie.saldo() : null;
}

/** Deja el saldo simulado en `creditos` (para probar "recarga y toca Continuar"). */
export async function fijarSaldoSimulado(creditos) {
  const s = await iniciarModoPrueba();
  return s ? s.kie.fijarSaldo(Number(creditos)) : null;
}

/** Los simuladores mismos (para pruebas: sim.kie.tareas(), sim.elevenlabs.voces()...). */
export function simuladores() {
  return sims;
}

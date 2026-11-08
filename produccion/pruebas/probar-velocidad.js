// Mide cuanto tarda el motor contra el kie.ai SIMULADO (kie-simulado.js), sin
// gastar un credito y sin tocar el anuncio de verdad.
//
//   node produccion/pruebas/probar-velocidad.js zenme-triptofano                    imagenes, escala 0.05
//   node produccion/pruebas/probar-velocidad.js zenme-triptofano --comando videos
//   node produccion/pruebas/probar-velocidad.js zenme-triptofano --comando producir
//   node produccion/pruebas/probar-velocidad.js zenme-triptofano --fallos servidor=10,contenido=5,trabadas=1
//   node produccion/pruebas/probar-velocidad.js zenme-triptofano --motor temp/_prueba-velocidad/_motor-HEAD
//   node produccion/pruebas/probar-velocidad.js --preparar-motor-viejo [HEAD]        copia el motor de ese commit
//   node produccion/pruebas/probar-velocidad.js zenme-triptofano -- --tomas 1,2     lo de despues de "--" va al motor
//
// Otras opciones: --escala 0.05, --semilla 1, --limite 20 (createTask cada 10 s
// que admite el simulado), --tope-imagen S / --tope-video S / --aviso-imagen S /
// --aviso-video S (segundos; por defecto los del motor por la escala), --callado
// (no muestra la salida del motor; igual queda en el .log), --ver-simulado
// (una linea por cada tarea del simulado), --sin-guardia (solo para un Node
// sin NODE_USE_ENV_PROXY; la comprobacion de KIE.base se hace igual).
//
// Que hace:
//   1. Arranca el kie simulado y una "guardia": un proxy local que corta
//      cualquier salida a internet del motor (NODE_USE_ENV_PROXY de Node 24).
//   2. COMPRUEBA, antes de lanzar nada del motor, importando su config.js en un
//      proceso hijo con el mismo entorno, que KIE.base y KIE.baseArchivos
//      apuntan al simulado en 127.0.0.1, que la clave es la falsa y que la
//      guardia corta de verdad. Si algo no da, aborta sin correr nada.
//   3. Copia temp/<anuncio>/ a temp/_prueba-velocidad/<anuncio>/ sin img/ (con
//      img/ si el comando es videos) y sin video/, historial/ ni qa/. audio/ va
//      siempre: los videos de voz en off lo necesitan. Con producir, si el
//      anuncio es de voz en off sin audio/voz.mp3 (producir llamaria a
//      ElevenLabs), aborta sin correr nada.
//   4. Le pide al motor el plan con --solo-plan (no crea tareas) para saber que
//      archivos tienen que salir, y corre el comando con --si midiendo el tiempo.
//   5. Imprime tiempo total, archivos esperados vs generados, cuando llego cada
//      uno y las estadisticas del simulado (429, duplicados, cadencia de
//      consulta...). Deja el detalle en temp/_prueba-velocidad/resultados/.
//
// --motor <raiz> corre la misma prueba con OTRO arbol del motor (por ejemplo
// el de antes de un cambio, preparado con --preparar-motor-viejo) para
// comparar velocidades con la misma semilla.

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { iniciar, parsearFallos, describirFallos, lineasDeStats } from './kie-simulado.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const DIR_PRUEBAS = path.join(RAIZ, 'temp', '_prueba-velocidad');
const DIR_RESULTADOS = path.join(DIR_PRUEBAS, 'resultados');

const COMANDOS = {
  imagenes: 'produccion/generar-imagenes.js',
  videos: 'produccion/generar-videos.js',
  producir: 'produccion/producir.js',
};

// Las esperas del motor en tiempo real (config.js), que se escalan igual que
// las latencias del simulado: con escala 0.05 una imagen avisa a los 18 s y
// se da por perdida a los 90 s, no a los 6 y 30 minutos.
const ESPERAS_REALES_MS = {
  avisoImagen: 6 * 60 * 1000,
  topeImagen: 30 * 60 * 1000,
  avisoVideo: 15 * 60 * 1000,
  topeVideo: 45 * 60 * 1000,
};

const rel = (p) => path.relative(RAIZ, p) || '.';

/** true si p es dir o esta dentro de dir (en Windows, otra unidad nunca esta dentro). */
function dentroDe(dir, p) {
  const r = path.relative(dir, p);
  return r === '' || (!r.startsWith('..') && !path.isAbsolute(r));
}
const seg = (ms) => `${(ms / 1000).toFixed(1)} s`;

function valorDe(args, nombre, porDefecto) {
  const i = args.indexOf(nombre);
  return i !== -1 && args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[i + 1] : porDefecto;
}

// ---------------------------------------------------------------- guardia de red

/**
 * Proxy local que contesta 403 a todo. El motor corre con NODE_USE_ENV_PROXY=1
 * y HTTP(S)_PROXY apuntando aqui, y NO_PROXY solo para 127.0.0.1: si algo del
 * motor quisiera salir a kie.ai, a ElevenLabs o a cualquier otro lado, la
 * conexion muere aqui y queda anotada.
 */
async function arrancarGuardia() {
  const salidas = [];
  const srv = http.createServer((req, res) => {
    salidas.push(`${req.method} ${req.url}`);
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('probar-velocidad: salida a internet bloqueada');
  });
  srv.on('connect', (req, socket) => {
    salidas.push(`CONNECT ${req.url}`);
    socket.on('error', () => {});
    socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
  });
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${srv.address().port}`,
    salidas,
    cerrar: () =>
      new Promise((resolve) => {
        srv.close(() => resolve());
        srv.closeAllConnections?.();
      }),
  };
}

/** El entorno del motor: nada heredado puede apuntar a otro lado. */
function entornoDelMotor(sim, guardia, esperasMs) {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (/^(KIE_|ELEVENLABS_API_KEY$)/i.test(k) || /^(https?|all|no)_proxy$/i.test(k) || /^NODE_USE_ENV_PROXY$/i.test(k)) delete env[k];
  }
  Object.assign(env, {
    KIE_BASE_URL: sim.url,
    KIE_BASE_ARCHIVOS_URL: sim.url,
    // Claves falsas: config.js carga el .env sin pisar lo que ya esta en el
    // entorno, asi que la clave de verdad no sale ni hacia el simulado.
    KIE_API_KEY: 'simulada',
    ELEVENLABS_API_KEY: 'simulada',
    KIE_AVISO_ESPERA_IMAGEN_MS: String(esperasMs.avisoImagen),
    KIE_TOPE_ESPERA_IMAGEN_MS: String(esperasMs.topeImagen),
    KIE_AVISO_ESPERA_VIDEO_MS: String(esperasMs.avisoVideo),
    KIE_TOPE_ESPERA_VIDEO_MS: String(esperasMs.topeVideo),
  });
  if (guardia) {
    // En Windows las variables no distinguen mayusculas: van solo en mayuscula.
    Object.assign(env, {
      NODE_USE_ENV_PROXY: '1',
      HTTP_PROXY: guardia.url,
      HTTPS_PROXY: guardia.url,
      NO_PROXY: '127.0.0.1,localhost,::1',
    });
  }
  return env;
}

// ---------------------------------------------------------------- procesos hijos

/** Corre un proceso SIN bloquear (el simulado y la guardia viven en este mismo proceso). */
function correr(args, { cwd, env, eco = false, rutaLog = null, timeoutMs = 0 }) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const p = spawn(process.execPath, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    let stderr = '';
    const log = rutaLog ? fs.createWriteStream(rutaLog, { flags: 'a' }) : null;
    p.stdout.on('data', (d) => {
      stdout += d;
      log?.write(d);
      if (eco) process.stdout.write(d);
    });
    p.stderr.on('data', (d) => {
      stderr += d;
      log?.write(d);
      if (eco) process.stderr.write(d);
    });
    const reloj = timeoutMs ? setTimeout(() => p.kill(), timeoutMs) : null;
    p.on('error', (e) => {
      stderr += `\n${e.message}`;
    });
    p.on('close', (codigo, senal) => {
      if (reloj) clearTimeout(reloj);
      log?.end();
      resolve({ codigo: codigo ?? (senal ? `senal ${senal}` : null), stdout, stderr, ms: performance.now() - t0 });
    });
  });
}

/**
 * LA COMPROBACION. Importa config.js del motor en un hijo con el entorno de la
 * prueba (como lo va a importar el comando) y mira adonde apunta. Despues carga
 * el .env (como hace el comando) para ver que no pise la clave falsa, e intenta
 * salir a internet para ver que la guardia corta.
 */
async function comprobarEntorno(motorRaiz, env, sim, guardia) {
  const rutaConfig = path.join(motorRaiz, 'produccion', 'config.js');
  const sonda = 'guardia.probar-velocidad.invalid';
  const codigo = [
    "const { pathToFileURL } = await import('node:url');",
    `const cfg = await import(pathToFileURL(${JSON.stringify(rutaConfig)}).href);`,
    'const r = { base: cfg.KIE?.base ?? null, baseArchivos: cfg.KIE?.baseArchivos ?? null };',
    "try { cfg.cargarEnv?.(); r.env = 'ok'; } catch (e) { r.env = String(e.message).split('\\n')[0]; }",
    "r.claveFalsa = process.env.KIE_API_KEY === 'simulada' && process.env.ELEVENLABS_API_KEY === 'simulada';",
    `try { await fetch('https://${sonda}/'); r.salio = true; } catch { r.salio = false; }`,
    "console.log('@@CHEQUEO@@' + JSON.stringify(r));",
  ].join('\n');

  const antes = guardia ? guardia.salidas.length : 0;
  const { codigo: salida, stdout, stderr } = await correr(['--input-type=module', '-e', codigo], { cwd: motorRaiz, env, timeoutMs: 60000 });
  const linea = stdout.split(/\r?\n/).find((l) => l.startsWith('@@CHEQUEO@@'));
  if (salida !== 0 || !linea) {
    return { ok: false, motivos: [`no pude importar ${rel(rutaConfig)} (salio con ${salida}): ${stderr.trim().split('\n').slice(-3).join(' | ')}`] };
  }
  const r = JSON.parse(linea.slice('@@CHEQUEO@@'.length));
  const origenSim = new URL(sim.url).origin;
  const alSimulado = (u) => {
    try {
      const x = new URL(u);
      return x.hostname === '127.0.0.1' && x.origin === origenSim;
    } catch {
      return false;
    }
  };
  const motivos = [];
  if (!alSimulado(r.base)) motivos.push(`KIE.base = ${r.base} (tiene que ser ${sim.url})`);
  if (!alSimulado(r.baseArchivos)) motivos.push(`KIE.baseArchivos = ${r.baseArchivos} (tiene que ser ${sim.url})`);
  if (!r.claveFalsa) motivos.push('la clave del motor no es la falsa ("simulada")');
  if (r.env !== 'ok') motivos.push(`el motor no pudo cargar su .env: ${r.env}`);
  if (guardia) {
    const vio = guardia.salidas.slice(antes).some((s) => s.includes(sonda));
    if (!vio || r.salio) motivos.push('la guardia de red no corto la salida de prueba (hace falta Node 24 por NODE_USE_ENV_PROXY; o usa --sin-guardia)');
    // La sonda no cuenta como salida del motor.
    guardia.salidas.splice(antes);
  }
  return { ok: motivos.length === 0, motivos, r };
}

// ---------------------------------------------------------------- copias

/** Borra una carpeta SOLO si esta dentro de temp/_prueba-velocidad/. */
function borrarDePruebas(dir) {
  if (!dentroDe(DIR_PRUEBAS, dir) || path.resolve(dir) === path.resolve(DIR_PRUEBAS)) throw new Error(`me negue a borrar ${dir}: no esta dentro de ${DIR_PRUEBAS}`);
  fs.rmSync(dir, { recursive: true, force: true });
}

function copiarAnuncio(origen, destino, { conImg }) {
  borrarDePruebas(destino);
  const fuera = new Set(['video', 'historial', 'qa', ...(conImg ? [] : ['img'])]);
  fs.cpSync(origen, destino, {
    recursive: true,
    filter: (src) => {
      const r = path.relative(origen, src);
      if (!r) return true;
      if (fuera.has(r.split(path.sep)[0])) return false;
      // Restos de una corrida cortada: no son parte del anuncio.
      return !/\.kie-pendiente\.json$|\.parcial$/i.test(src);
    },
  });
}

/** Los archivos que el motor nombra en su plan: lineas con 6 espacios y un .png / .mp4. */
function archivosDelPlan(salida) {
  const vistos = new Set();
  for (const linea of salida.split(/\r?\n/)) {
    const m = linea.match(/^ {6}([\w.-]+\.(?:png|mp4))(?=\s|$)/);
    if (m) vistos.add(m[1]);
  }
  return [...vistos];
}

/**
 * Los clips del plan de videos. El --solo-plan de videos no los nombra uno por
 * uno en todos los estilos (en uno comun solo muestra la tabla de tramos), asi
 * que se le pide la lista a construirPlan() del mismo motor, con los mismos
 * flags que lee su CLI (--tomas, --pasos, --ganchos, --sin-broll). Es la lista
 * que el CLI usa antes de quitar lo ya generado.
 */
async function clipsDelPlan(scriptVideos, carpeta, paraElMotor, { cwd, env }) {
  const lista = (flag) => {
    const i = paraElMotor.indexOf(flag);
    return i !== -1 && paraElMotor[i + 1] && !paraElMotor[i + 1].startsWith('--')
      ? paraElMotor[i + 1].split(',').map((x) => Number(x.trim())).filter(Number.isInteger)
      : null;
  };
  const opciones = { soloTomas: lista('--tomas'), ganchos: paraElMotor.includes('--ganchos'), soloPasos: lista('--pasos') };
  const codigo = [
    "const { pathToFileURL } = await import('node:url');",
    "const fs = await import('node:fs');",
    `const mod = await import(pathToFileURL(${JSON.stringify(scriptVideos)}).href);`,
    `const m = JSON.parse(fs.readFileSync(${JSON.stringify(path.join(carpeta, 'manifiesto.json'))}, 'utf8'));`,
    `let plan = mod.construirPlan(m, ${JSON.stringify(opciones)});`,
    `if (${paraElMotor.includes('--sin-broll')}) plan = plan.filter((t) => t.clase !== 'broll');`,
    // El B-roll que no entra en el video con esta voz no se pide (2026-10-26):
    // el CLI lo saca con brollQueEntranEnCarpeta. Un motor de antes no la tiene.
    `const pm = await import(pathToFileURL(${JSON.stringify(path.join(path.dirname(scriptVideos), 'planear-montaje.js'))}).href).catch(() => null);`,
    `if (pm?.brollQueEntranEnCarpeta && !${paraElMotor.includes('--todo-el-broll')}) {`,
    `  const r = pm.brollQueEntranEnCarpeta(m, ${JSON.stringify(carpeta)});`,
    "  if (r.aplica) { const f = new Set(r.fuera.map((x) => x.n)); plan = plan.filter((t) => !(t.clase === 'broll' && f.has(t.n))); }",
    '}',
    "console.log('@@PLAN@@' + JSON.stringify(plan.map((t) => t.archivo)));",
  ].join('\n');
  const r = await correr(['--input-type=module', '-e', codigo], { cwd, env, timeoutMs: 60000 });
  const linea = r.stdout.split(/\r?\n/).find((l) => l.startsWith('@@PLAN@@'));
  return linea ? JSON.parse(linea.slice('@@PLAN@@'.length)) : null;
}

/**
 * Lo que npm run producir va a hacer con este anuncio, segun el propio motor
 * (familiaDe, haceVideos y generaVoz de su producir.js), en un hijo con el
 * entorno de la prueba. Los campos que ese motor no exporta (un arbol viejo)
 * vienen en null.
 */
async function queHaceProducir(scriptProducir, carpeta, { cwd, env }) {
  const codigo = [
    "const { pathToFileURL } = await import('node:url');",
    "const fs = await import('node:fs');",
    `const mod = await import(pathToFileURL(${JSON.stringify(scriptProducir)}).href);`,
    `const m = JSON.parse(fs.readFileSync(${JSON.stringify(path.join(carpeta, 'manifiesto.json'))}, 'utf8'));`,
    'const familia = mod.familiaDe ? mod.familiaDe(m) : null;',
    `const r = { familia, haceVideos: mod.haceVideos ? mod.haceVideos(familia, ${JSON.stringify(carpeta)}) : null,`,
    `  generaVoz: mod.generaVoz ? mod.generaVoz(familia, ${JSON.stringify(carpeta)}, m) : null, modoAudio: m.modo_audio ?? null };`,
    "console.log('@@PRODUCIR@@' + JSON.stringify(r));",
  ].join('\n');
  const r = await correr(['--input-type=module', '-e', codigo], { cwd, env, timeoutMs: 60000 });
  const linea = r.stdout.split(/\r?\n/).find((l) => l.startsWith('@@PRODUCIR@@'));
  return linea ? JSON.parse(linea.slice('@@PRODUCIR@@'.length)) : null;
}

function scriptDelComando(motorRaiz, comando) {
  // Lo que diga el package.json de ESE motor (npm run <comando>), y si no, el de siempre.
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(motorRaiz, 'package.json'), 'utf8'));
    const m = String(pkg.scripts?.[comando] || '').match(/^node\s+(\S+\.js)/);
    if (m) return path.join(motorRaiz, m[1]);
  } catch {
    // sin package.json legible: el de siempre
  }
  return path.join(motorRaiz, COMANDOS[comando]);
}

// ---------------------------------------------------------------- motor viejo

/**
 * Copia el motor de un commit (produccion/ y package.json, con git show: no
 * toca el arbol de trabajo) a temp/_prueba-velocidad/_motor-<ref>/, le cambia
 * en config.js SOLO las dos direcciones de kie para que lean KIE_BASE_URL y
 * KIE_BASE_ARCHIVOS_URL, y le pone un .env con claves falsas.
 */
function prepararMotorViejo(ref) {
  const git = (args) => spawnSync('git', args, { cwd: RAIZ, encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 });
  const lista = git(['ls-tree', '-r', '--name-only', ref, '--', 'produccion', 'package.json']);
  if (lista.status !== 0) {
    console.error(`\n  !  git no conoce "${ref}": ${lista.stderr.toString().trim()}\n`);
    process.exitCode = 1;
    return;
  }
  const archivos = lista.stdout.toString('utf8').split(/\r?\n/).filter(Boolean);
  const destino = path.join(DIR_PRUEBAS, `_motor-${ref.replace(/[^\w.-]+/g, '_')}`);
  borrarDePruebas(destino);
  for (const a of archivos) {
    const r = git(['show', `${ref}:${a}`]);
    if (r.status !== 0) throw new Error(`git show ${ref}:${a} fallo: ${r.stderr.toString().trim()}`);
    const ruta = path.join(destino, ...a.split('/'));
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    fs.writeFileSync(ruta, r.stdout);
  }

  const rutaConfig = path.join(destino, 'produccion', 'config.js');
  let config = fs.readFileSync(rutaConfig, 'utf8');
  if (!config.includes('KIE_BASE_URL')) {
    const cambios = [
      [/base:\s*'https:\/\/api\.kie\.ai',/, "base: process.env.KIE_BASE_URL || 'https://api.kie.ai',"],
      [/baseArchivos:\s*'https:\/\/kieai\.redpandaai\.co',/, "baseArchivos: process.env.KIE_BASE_ARCHIVOS_URL || 'https://kieai.redpandaai.co',"],
    ];
    for (const [re, nuevo] of cambios) {
      if (!re.test(config)) {
        borrarDePruebas(destino);
        console.error(`\n  !  No encontre en config.js de ${ref} la linea de ${nuevo.split(':')[0]}: no lo puedo apuntar al simulado.\n`);
        process.exitCode = 1;
        return;
      }
      config = config.replace(re, nuevo);
    }
    fs.writeFileSync(rutaConfig, config, 'utf8');
  }
  fs.writeFileSync(
    path.join(destino, '.env'),
    '# Claves FALSAS: esta copia del motor es solo para probar contra el kie simulado.\n' +
      'KIE_API_KEY=simulada\nELEVENLABS_API_KEY=simulada\nELEVENLABS_VOICE_ID=simulada\n',
    'utf8'
  );
  console.log(`\n  OK  Motor de ${ref} copiado en ${rel(destino)} (${archivos.length} archivos).`);
  console.log('      config.js lee KIE_BASE_URL / KIE_BASE_ARCHIVOS_URL; el .env tiene claves falsas.');
  console.log('      Para comparar, con la misma semilla:');
  console.log(`          node produccion/pruebas/probar-velocidad.js <anuncio> --motor ${rel(destino).replace(/\\/g, '/')}`);
  console.log('          node produccion/pruebas/probar-velocidad.js <anuncio>\n');
}

// ---------------------------------------------------------------- CLI

async function cli() {
  const todos = process.argv.slice(2);
  const corte = todos.indexOf('--');
  const args = corte === -1 ? todos : todos.slice(0, corte);
  const paraElMotor = corte === -1 ? [] : todos.slice(corte + 1);

  if (args.includes('--preparar-motor-viejo')) {
    prepararMotorViejo(valorDe(args, '--preparar-motor-viejo', 'HEAD'));
    return;
  }

  const conValor = new Set(['--comando', '--escala', '--semilla', '--fallos', '--motor', '--limite', '--tope-imagen', '--tope-video', '--aviso-imagen', '--aviso-video']);
  const anuncioArg = args.find((a, i) => !a.startsWith('--') && !conValor.has(args[i - 1]));
  if (!anuncioArg) {
    console.error('\n  Uso: node produccion/pruebas/probar-velocidad.js <anuncio-de-temp> [--comando imagenes|videos|producir]');
    console.error('            [--escala 0.05] [--semilla 1] [--fallos servidor=10,contenido=5,trabadas=1,consulta500=5]');
    console.error('            [--motor <carpeta-raiz>] [--limite 20] [--callado] [--ver-simulado] [-- <flags del motor>]');
    console.error('       node produccion/pruebas/probar-velocidad.js --preparar-motor-viejo [HEAD]\n');
    process.exitCode = 1;
    return;
  }

  const comando = valorDe(args, '--comando', 'imagenes');
  if (!COMANDOS[comando]) {
    console.error(`\n  !  --comando ${comando}: valen ${Object.keys(COMANDOS).join(', ')}.\n`);
    process.exitCode = 1;
    return;
  }
  const escala = Number(valorDe(args, '--escala', 0.05));
  const semilla = Number(valorDe(args, '--semilla', 1));
  const limite = Number(valorDe(args, '--limite', 20));
  let fallos;
  try {
    fallos = parsearFallos(valorDe(args, '--fallos', ''));
  } catch (e) {
    console.error(`\n  !  ${e.message}\n`);
    process.exitCode = 1;
    return;
  }
  if (!(escala > 0) || !Number.isFinite(semilla) || !(limite > 0)) {
    console.error('\n  !  --escala y --limite tienen que ser numeros mayores que 0, y --semilla un numero.\n');
    process.exitCode = 1;
    return;
  }
  const callado = args.includes('--callado');
  const sinGuardia = args.includes('--sin-guardia');

  const segundosDe = (nombre, ms) => {
    const v = valorDe(args, nombre, null);
    return v === null ? Math.max(2000, Math.round(ms * escala)) : Math.round(Number(v) * 1000);
  };
  const esperasMs = {
    avisoImagen: segundosDe('--aviso-imagen', ESPERAS_REALES_MS.avisoImagen),
    topeImagen: segundosDe('--tope-imagen', ESPERAS_REALES_MS.topeImagen),
    avisoVideo: segundosDe('--aviso-video', ESPERAS_REALES_MS.avisoVideo),
    topeVideo: segundosDe('--tope-video', ESPERAS_REALES_MS.topeVideo),
  };

  // El anuncio: una carpeta con manifiesto.json, o el nombre de una de temp/.
  const candidato = fs.existsSync(path.resolve(anuncioArg)) ? path.resolve(anuncioArg) : path.join(RAIZ, 'temp', anuncioArg);
  if (!fs.existsSync(path.join(candidato, 'manifiesto.json'))) {
    console.error(`\n  !  No encuentro ${rel(path.join(candidato, 'manifiesto.json'))}.\n`);
    process.exitCode = 1;
    return;
  }
  const origen = candidato;
  if (dentroDe(DIR_PRUEBAS, origen)) {
    console.error(`\n  !  ${rel(origen)} ya es una copia de prueba. Pasa el anuncio de temp/ (se copia solo).\n`);
    process.exitCode = 1;
    return;
  }
  const nombre = path.basename(origen);
  const copia = path.join(DIR_PRUEBAS, nombre);
  const copiaPlan = path.join(DIR_PRUEBAS, `${nombre}__plan-videos`);
  if (comando === 'videos' && !fs.existsSync(path.join(origen, 'img'))) {
    console.error(`\n  !  ${rel(origen)} no tiene img/: para probar videos hacen falta sus imagenes.\n`);
    process.exitCode = 1;
    return;
  }

  const motorRaiz = path.resolve(valorDe(args, '--motor', RAIZ));
  const script = scriptDelComando(motorRaiz, comando);
  if (!fs.existsSync(script)) {
    console.error(`\n  !  Este motor (${motorRaiz}) no tiene ${path.relative(motorRaiz, script)} para "${comando}".\n`);
    process.exitCode = 1;
    return;
  }
  const scriptImagenes = scriptDelComando(motorRaiz, 'imagenes');
  const scriptVideos = scriptDelComando(motorRaiz, 'videos');

  fs.mkdirSync(DIR_RESULTADOS, { recursive: true });
  const sello = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const etiquetaMotor = motorRaiz === RAIZ ? 'actual' : path.basename(motorRaiz);
  const base = `${sello}-${nombre}-${comando}-${etiquetaMotor}`;
  const rutaLog = path.join(DIR_RESULTADOS, `${base}.log`);

  console.log(`\n=== Prueba de velocidad — ${nombre} (${comando}) ===\n`);
  console.log(`  Motor:     ${motorRaiz}`);
  console.log(`  Comando:   node ${path.relative(motorRaiz, script).replace(/\\/g, '/')} <copia> --si${paraElMotor.length ? ' ' + paraElMotor.join(' ') : ''}`);
  console.log(`  Simulado:  escala ${escala}, semilla ${semilla}, limite ${limite} createTask cada 10 s, fallos: ${describirFallos(fallos)}`);
  console.log(
    `  Esperas:   imagen aviso ${seg(esperasMs.avisoImagen)} / tope ${seg(esperasMs.topeImagen)}, ` +
      `video aviso ${seg(esperasMs.avisoVideo)} / tope ${seg(esperasMs.topeVideo)}\n`
  );

  const sim = await iniciar({
    escala,
    semilla,
    fallos,
    limite: { maximo: limite },
    alRegistrar: args.includes('--ver-simulado') ? (l) => console.log(`  sim${l}`) : null,
  });
  const guardia = sinGuardia ? null : await arrancarGuardia();
  const env = entornoDelMotor(sim, guardia, esperasMs);

  const cerrarTodo = async () => {
    await sim.cerrar();
    await guardia?.cerrar();
  };

  try {
    // 1) La comprobacion, antes de cualquier comando del motor.
    const chequeo = await comprobarEntorno(motorRaiz, env, sim, guardia);
    if (!chequeo.ok) {
      console.error('  !  ABORTADO: el motor NO apunta al kie simulado. No corri nada del motor (cero creditos).');
      for (const m of chequeo.motivos) console.error(`       ${m}`);
      if (chequeo.r && !String(chequeo.r.base || '').startsWith('http://127.0.0.1')) {
        console.error('     Su produccion/config.js todavia no lee KIE_BASE_URL / KIE_BASE_ARCHIVOS_URL.');
        console.error('     Para un arbol viejo: node produccion/pruebas/probar-velocidad.js --preparar-motor-viejo HEAD');
      }
      console.error('');
      process.exitCode = 2;
      return;
    }
    console.log(`  OK  config.js apunta al simulado (${sim.url}), clave falsa${guardia ? ', guardia de red activa' : ''}.`);
    if (!guardia) console.log('  !  --sin-guardia: si el motor quisiera salir a internet, nada lo frenaria (KIE si va al simulado).');

    // 2) La copia.
    copiarAnuncio(origen, copia, { conImg: comando === 'videos' });
    console.log(`  OK  Copia en ${rel(copia)} (${comando === 'videos' ? 'con img/' : 'sin img/'}, sin video/, historial/ ni qa/).`);

    const manifiesto = JSON.parse(fs.readFileSync(path.join(copia, 'manifiesto.json'), 'utf8'));
    const aspecto = manifiesto.aspect_ratio || '9:16';

    // producir: que va a hacer con ESTE anuncio. Si fuera a generar la voz,
    // llamaria a ElevenLabs (cobra caracteres), y eso no se simula: solo lo
    // frenaria la guardia, y con --sin-guardia nada. Se aborta antes.
    let deProducir = null;
    if (comando === 'producir') {
      deProducir = await queHaceProducir(script, copia, { cwd: motorRaiz, env });
      const sinVoz = !fs.existsSync(path.join(copia, 'audio', 'voz.mp3'));
      const generariaVoz = deProducir?.generaVoz ?? (sinVoz && manifiesto.modo_audio === 'voz_en_off' && deProducir?.familia !== 'continuidad');
      if (generariaVoz) {
        console.error(`  !  ABORTADO: ${nombre} es de voz en off y no tiene audio/voz.mp3: producir generaria la voz con`);
        console.error('     ElevenLabs, y esta prueba no la simula. Usa un anuncio con su voz hecha. No corri nada del motor.\n');
        borrarDePruebas(copia);
        process.exitCode = 2;
        return;
      }
    }
    const t0Cache = performance.now();
    await sim.precalentar({
      aspectos: [aspecto],
      duraciones: comando === 'imagenes' ? [] : [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    });
    const msCache = performance.now() - t0Cache;
    if (msCache > 1500) console.log(`  OK  Archivos base del simulado generados con ffmpeg (${seg(msCache)}; quedan cacheados).`);

    // 3) Lo que tiene que salir, segun el propio motor (--solo-plan no crea tareas).
    const plan = async (scriptPlan, carpeta) => {
      const r = await correr([scriptPlan, carpeta, '--solo-plan', ...paraElMotor], { cwd: motorRaiz, env, rutaLog, timeoutMs: 180000 });
      return { archivos: archivosDelPlan(r.stdout), codigo: r.codigo, error: r.stderr.trim().split(/\r?\n/).slice(-4).join(' | ') };
    };
    const esperados = [];
    const avisosPlan = [];
    if (comando === 'imagenes' || comando === 'producir') {
      const p = await plan(scriptImagenes, copia);
      esperados.push(...p.archivos.filter((a) => a.endsWith('.png')).map((a) => `img/${a}`));
      if (!p.archivos.length) avisosPlan.push(`imagenes --solo-plan no dio la lista (salio con ${p.codigo}): ${p.error}`);
    }
    // En UGC, podcast, entrevista, continuidad y voz en off sin la voz, producir
    // hace SOLO las imagenes, a proposito (haceVideos): sus clips no se esperan.
    const videosDeProducir = comando === 'producir' && deProducir?.haceVideos !== false;
    if (comando === 'producir' && !videosDeProducir) console.log(`  OK  producir hace solo las imagenes en este anuncio (familia ${deProducir.familia}): no se esperan clips.`);
    if (comando === 'videos' || videosDeProducir) {
      let carpetaPlan = copia;
      if (comando === 'producir') {
        // Sin imagenes el plan de videos no se muestra: se pide sobre otra
        // copia que si las tiene (las del anuncio original).
        copiarAnuncio(origen, copiaPlan, { conImg: true });
        carpetaPlan = copiaPlan;
      }
      // El --solo-plan se corre igual: si el motor no puede con este anuncio
      // (le faltan imagenes, el manifiesto tiene errores), se ve aqui y no a mitad.
      const p = await plan(scriptVideos, carpetaPlan);
      if (p.codigo !== 0) avisosPlan.push(`videos --solo-plan salio con ${p.codigo}: ${p.error}`);
      const clips = (await clipsDelPlan(scriptVideos, carpetaPlan, paraElMotor, { cwd: motorRaiz, env })) ?? p.archivos.filter((a) => a.endsWith('.mp4'));
      esperados.push(...clips.map((a) => `video/${a}`));
      if (!clips.length) avisosPlan.push('no pude saber que clips tiene el plan de videos');
      if (comando === 'producir') borrarDePruebas(copiaPlan);
    }
    for (const a of avisosPlan) console.log(`  !  ${a}`);
    console.log(`  OK  Plan del motor: ${esperados.length} archivo(s) a generar.\n`);

    // 4) La corrida medida. Lo de antes (comprobacion, planes) no cuenta.
    sim.reiniciarStats();
    const llegadas = new Map();
    // Lo que ya estaba (las imagenes copiadas, en videos) no "llega".
    const previos = new Set();
    for (const sub of ['img', 'video']) {
      try {
        for (const a of fs.readdirSync(path.join(copia, sub))) previos.add(`${sub}/${a}`);
      } catch {
        // sin esa carpeta
      }
    }
    const t0 = performance.now();
    const mirar = () => {
      for (const sub of ['img', 'video']) {
        const dir = path.join(copia, sub);
        let lista = [];
        try {
          lista = fs.readdirSync(dir);
        } catch {
          continue;
        }
        for (const a of lista) {
          const k = `${sub}/${a}`;
          if (/\.(png|mp4)$/i.test(a) && !previos.has(k) && !llegadas.has(k)) llegadas.set(k, performance.now() - t0);
        }
      }
    };
    const vigia = setInterval(mirar, 250);
    console.log(`  ..  Corriendo el motor (salida completa en ${rel(rutaLog)})\n`);
    const r = await correr([script, copia, '--si', ...paraElMotor], { cwd: motorRaiz, env, eco: !callado, rutaLog });
    clearInterval(vigia);
    mirar();
    const msTotal = r.ms;
    const stats = sim.stats();

    // 5) El resumen.
    const existe = (k) => {
      try {
        return fs.statSync(path.join(copia, k)).size > 0;
      } catch {
        return false;
      }
    };
    const generados = esperados.filter(existe);
    const faltan = esperados.filter((k) => !existe(k));
    const restos = [];
    for (const sub of ['img', 'video']) {
      try {
        for (const a of fs.readdirSync(path.join(copia, sub))) if (/\.kie-pendiente\.json$|\.parcial$/i.test(a)) restos.push(`${sub}/${a}`);
      } catch {
        // sin esa carpeta
      }
    }
    const tiempos = (filtro) => [...llegadas.entries()].filter(([k]) => filtro(k)).map(([, ms]) => ms);
    const todosMs = tiempos(() => true);
    const imgMs = tiempos((k) => k.startsWith('img/'));
    const vidMs = tiempos((k) => k.startsWith('video/'));

    console.log(`\n=== Resultado — ${nombre} (${comando}, motor ${etiquetaMotor}) ===\n`);
    console.log(`  Tiempo total:   ${seg(msTotal)}   (el motor salio con codigo ${r.codigo})`);
    console.log(
      `  Archivos:       ${generados.length} de ${esperados.length} esperados` +
        (todosMs.length ? `   (el primero a los ${seg(Math.min(...todosMs))}, el ultimo a los ${seg(Math.max(...todosMs))})` : '')
    );
    if (imgMs.length && vidMs.length) {
      const antes = Math.max(...imgMs) - Math.min(...vidMs);
      console.log(
        `  Imagenes ${seg(Math.min(...imgMs))} a ${seg(Math.max(...imgMs))}; videos ${seg(Math.min(...vidMs))} a ${seg(Math.max(...vidMs))}` +
          (antes > 0 ? `   (el primer video llego ${seg(antes)} antes que la ultima imagen)` : '')
      );
    }
    if (faltan.length) {
      console.log(`  !  Faltan ${faltan.length}:`);
      for (const f of faltan.slice(0, 20)) console.log(`       ${f}`);
      if (faltan.length > 20) console.log(`       ... y ${faltan.length - 20} mas`);
    }
    if (restos.length) console.log(`  !  Quedaron ${restos.length} pendiente(s)/parcial(es): ${restos.join(', ')}`);
    console.log('  kie simulado (solo la corrida medida):');
    for (const l of lineasDeStats(stats)) console.log(l);
    const salidas = guardia ? [...guardia.salidas] : [];
    if (guardia) {
      console.log(
        salidas.length
          ? `  !  La guardia corto ${salidas.length} salida(s) a internet del motor: ${[...new Set(salidas)].slice(0, 5).join(', ')}`
          : '  OK  Ninguna salida a internet (la guardia no corto nada).'
      );
    }
    if (stats.posiblesDuplicados.length) console.log(`  !  ${stats.posiblesDuplicados.length} posible(s) duplicado(s): en kie de verdad se cobrarian dos veces.`);
    if (stats.creaciones.devueltas429) console.log(`  !  El simulado devolvio ${stats.creaciones.devueltas429} vez/veces 429: el motor se paso del limite de creaciones.`);

    const rutaJson = path.join(DIR_RESULTADOS, `${base}.json`);
    fs.writeFileSync(
      rutaJson,
      JSON.stringify(
        {
          anuncio: nombre,
          comando,
          motor: motorRaiz,
          paraElMotor,
          fecha: new Date().toISOString(),
          escala,
          semilla,
          fallos: describirFallos(fallos),
          esperasMs,
          tiempoTotalMs: Math.round(msTotal),
          codigoSalida: r.codigo,
          esperados: esperados.length,
          generados: generados.length,
          faltan,
          restos,
          llegadasMs: Object.fromEntries([...llegadas.entries()].sort((a, b) => a[1] - b[1]).map(([k, ms]) => [k, Math.round(ms)])),
          salidasBloqueadas: salidas,
          simulado: stats,
          tareas: sim.tareas(),
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
    console.log(`\n  Detalle en ${rel(rutaJson)}\n`);

    const bien = r.codigo === 0 && faltan.length === 0 && esperados.length > 0;
    process.exitCode = bien ? 0 : 1;
  } finally {
    await cerrarTodo();
  }
}

// Sin process.exit: el proceso termina solo al cerrar el simulado y la guardia
// (un exit justo despues de un fetch aborta en Windows con Node 24, ver
// generar-imagenes.js).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await cli();

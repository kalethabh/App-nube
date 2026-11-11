// P2 y P3 de las pruebas reales de Codex (DISENO-motor-codex.md §6.3): el guion de los 13 estilos y los cambios al
// guion, por la API de la app, como lo hace la pantalla «Nuevo anuncio» (POST /api/anuncios, GET .../guion y
// POST .../guion/cambios). Nunca aprueba un guion ni sigue a imagenes: se para despues de verificarGuion.
//
//   node app/herramientas/codex/tareas-guiones.mjs [--home-usuario] [--puntos p2,p3,medium] [--solo <estilo>[,…]]
//        [--esfuerzo medium] [--a-la-vez 1|2] [--salida <dir>] [--copia <dir>] [--programas <dir>] [--conservar]
//   import { correrGuiones } from './codex/tareas-guiones.mjs';
//   await correrGuiones({ homeUsuario, puntos, solo, esfuerzo, aLaVez, salida, copia, programas, conservar })
//
// Como trabaja:
//   - arma una COPIA DESCARTABLE del proyecto (los archivos de git con su contenido de ahora + app/dist, sin temp/,
//     output/, .env*, app/config.json, auth.json, config.toml ni credentials*; node_modules como junction) fuera de la
//     carpeta del proyecto, y le copia los 3 productos de temp/_productos/ que usan los estilos;
//   - arranca ahi la app en MODO PRUEBA (ANUNCIOS_MODO_PRUEBA=1: kie, ElevenLabs y Suno van a los simuladores y la
//     guardia corta cualquier otra salida) en el puerto 47460 (o 47462-47469), con AIA_MOTOR=codex. Nunca 4455 ni 4321;
//   - --home-usuario: Codex DE VERDAD con la sesion de ChatGPT del usuario (AIA_CODEX_HOME=~/.codex; codex-rutas.js
//     se niega a escribir config.toml y a correr login, logout o delete ahi). Codex tiene que estar instalado en la
//     carpeta de programas de la app (AIA_PROGRAMAS_DIR o --programas). Antes de CADA tarea lee los limites de uso
//     (app-server, sin cache) y para todo si la ventana semanal pasa del 60 % (la corta, del 80 %) o si ya no queda
//     uso ordinario; lo que ya esta en marcha termina. Anota el uso antes y despues de cada tarea y los hilos de Codex
//     que se crean (para borrarlos a mano despues: aqui nunca se borra nada de ~/.codex);
//   - sin --home-usuario: el Codex FALSO (app/server/claude/pruebas/codex-falso.js, como prueba-humo.mjs), con su
//     propio CODEX_HOME dentro de la carpeta de la copia, y las muestras que usan los Claude falsos de los estilos;
//   - P2 (puntos p2): el guion de los 13 estilos (los 12 de la app y claymation con continuidad), repartidos entre
//     los 3 productos, como mucho 2 a la vez (la fila de la app ya deja 2 sesiones de Codex);
//   - P3 (puntos p3): un cambio concreto a 3 guiones de P2 (claymation, podcast e historia musical) por la ruta del
//     boton de cambios. Mira que termine, que el archivo cambie con `ediciones` (no entero) y, comparando el respaldo
//     de la app (app/historial-guion/NN) con lo de ahora, que solo cambie lo pedido;
//   - medium (puntos medium, o --esfuerzo medium): claymation y entrevista otra vez (o los de --solo) en otra app con
//     AIA_CODEX_ESFUERZO=medium (codex.js solo lo lee en modo prueba), para comparar con high;
//   - los minutos de Claude salen de los registros temp/*/app/registro/guion.log de esta carpeta (solo se leen).
// Deja <salida>/informe.json (se suma al de antes del mismo modo) y una carpeta por estilo con el guion final
// (manifiesto, transiciones, guion.json, letras, peticion, brief y el registro de Codex). Por defecto <salida> es
// temp/_codex-prueba/guiones (o guiones-falso con el Codex falso). Al terminar cierra la app y borra la copia
// (--conservar: la deja). Sale con 0 si todo lo pedido dio bien.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(AQUI, '..', '..');
const RAIZ = path.resolve(APP, '..');
const WIN = process.platform === 'win32';
const HOME_USUARIO = path.join(os.homedir(), '.codex');

const PUERTOS = [47460, 47462, 47463, 47464, 47465, 47466, 47467, 47468, 47469];
const NUNCA = new Set([4455, 4321]);

// ---------------------------------------------------------------- los estilos y los pedidos

const P_ASHWA = 'bestdiet-relax-ashwagandha-7e72';
const P_BLOOM = 'bloom-greens-superfoods-3178';
const P_GUMMI = 'bestdiet-relax-ashwagandha-gummi-22e1';
const PRODUCTOS = [P_ASHWA, P_BLOOM, P_GUMMI];
// la voz del narrador (solo se guarda en el brief: el guion no llama a ElevenLabs)
const VOZ = { id: 'sim-narrador', nombre: 'Narrador de prueba' };

/** Los 13 de P2: clave (la del informe), estilo de la app, producto, respuestas del formulario y si lleva narrador. */
export const ESTILOS_P2 = Object.freeze([
  { clave: 'claymation', estilo: 'claymation', producto: P_ASHWA, voz: true },
  { clave: 'podcast', estilo: 'podcast', producto: P_ASHWA },
  { clave: 'historias-musicales', estilo: 'historias-musicales', producto: P_ASHWA },
  { clave: 'claymation-continuidad', estilo: 'claymation', continuidad: true, producto: P_ASHWA, voz: true },
  { clave: 'estilo-lego', estilo: 'estilo-lego', producto: P_ASHWA, voz: true },
  { clave: 'entrevista', estilo: 'entrevista', producto: P_BLOOM, respuestas: { persona: 'Mujer de 35 que trabaja en una oficina y se siente hinchada después de almorzar', ciudad: 'Lima', idioma: 'Español', cta: 'Pídelo en el botón de abajo' } },
  { clave: 'crochet', estilo: 'crochet', producto: P_BLOOM, voz: true },
  { clave: 'zack-d-films', estilo: 'zack-d-films', producto: P_BLOOM, voz: true, respuestas: { fondo: 'Grilla técnica azul' } },
  { clave: 'ugc', estilo: 'ugc', producto: P_BLOOM },
  { clave: 'estilo-pixar', estilo: 'estilo-pixar', producto: P_GUMMI, voz: true },
  { clave: 'skeleton', estilo: 'skeleton', producto: P_GUMMI, voz: true },
  { clave: 'talking-object-pixar', estilo: 'talking-object-pixar', producto: P_GUMMI },
  { clave: 'musical', estilo: 'musical', producto: P_GUMMI, respuestas: { visual: 'Crochet' } },
]);
const CLAVES = ESTILOS_P2.map((e) => e.clave);
const CANTADOS = new Set(['musical', 'historias-musicales']);
// los que se corren otra vez con esfuerzo medium (§6.3: «Se prueban los dos en claymation y en entrevista»)
const ESFUERZO_COMPARAR = ['claymation', 'entrevista'];

// P3: un pedido concreto por guion, el archivo que se compara antes y despues, y lo que el pedido deja tocar
export const CAMBIOS_P3 = {
  claymation: {
    pedido: 'Cambia solo la frase de la última toma (el cierre) para que diga que el envío es gratis. Todo lo demás queda igual.',
    archivo: 'manifiesto.json',
    alcance: alcanceUltimaToma,
  },
  podcast: {
    pedido: 'Cambia solo la primera línea de la conversación: que sea una pregunta más corta y directa. Todo lo demás queda igual.',
    archivo: 'manifiesto.json',
    alcance: alcancePrimeraLinea,
  },
  'historias-musicales': {
    pedido: 'Cambia solo la última línea de la letra para que termine invitando a probarlo hoy. Todo lo demás queda igual.',
    archivo: 'cancion/peticion.json',
    alcance: alcanceUltimaLinea,
  },
};

// Con el Codex falso, el guion lo arman los Claude falsos de los estilos sobre una muestra (claude-falso-estilos.js,
// MUESTRA, y los cantados): se copian a la copia solo esos archivos (el manifiesto, las transiciones, la peticion y
// las referencias con archivo).
const MUESTRAS_FALSO = [
  'befen-regulador-apetito', 'goli-immune-gummies', 'anuncios-con-ia-pixar', 'zenme-triptofano', 'lymphatic-drainage-lego-2',
  'superhuman-drenaje-linfatico', 'befem-ugc-bloques', 'cayenne-pepper-podcast', 'befem-entrevista-a', 'befem-entrevista-b',
  'kovacol-drenaje-linfatico', 'goli-immune-historia-musical',
];

// ---------------------------------------------------------------- utilidades

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const ahora = () => new Date().toISOString();
const minutos = (ms) => (Number.isFinite(Number(ms)) ? Math.round(Number(ms) / 600) / 100 : null);
const fmin = (x) => (x === null || x === undefined ? '-' : String(x).replace('.', ','));
const existe = (p) => {
  try {
    fs.statSync(p);
    return true;
  } catch {
    return false;
  }
};
function leerJSON(ruta) {
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf8').replace(/^﻿/, ''));
  } catch {
    return null;
  }
}
function escribirJSON(ruta, datos) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const tmp = `${ruta}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(datos, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, ruta);
}
const lineasJSONL = (ruta) => {
  let t = '';
  try {
    t = fs.readFileSync(ruta, 'utf8');
  } catch {
    return [];
  }
  const out = [];
  for (const l of t.split(/\r?\n/)) {
    if (!l.trim()) continue;
    try {
      out.push(JSON.parse(l));
    } catch {
      /* una linea que no es JSON */
    }
  }
  return out;
};
const mediana = (xs) => {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return Math.round((v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2) * 100) / 100;
};
const argumento = (nombre) => {
  const a = process.argv.slice(2);
  const i = a.indexOf(nombre);
  return i >= 0 && a[i + 1] && !a[i + 1].startsWith('--') ? a[i + 1] : null;
};

/** Un puerto libre en 127.0.0.1 (donde escucha la app). */
const libre = (p) =>
  new Promise((ok) => {
    const s = net.createServer();
    s.once('error', () => ok(false));
    s.listen(p, '127.0.0.1', () => s.close(() => ok(true)));
  });

// ---------------------------------------------------------------- la copia descartable

const SECRETO = /(^|\/)\.env[^/]*$|^app\/config\.json$|(^|\/)auth\.json$|(^|\/)config\.toml$|(^|\/)credentials[^/]*$|(^|\/)\.npmrc$|(^|\/)\.netrc$/i;
const SI_VA = new Set(['app/inicio/codex/.npmrc']); // la configuracion de npm del paquete de Codex (sin claves)
const NO_VAN = /^(temp|output|output-alumnos|\.git)\//;
const ENLACES = ['app/node_modules', 'remotion/node_modules'];

/**
 * Los archivos de git (con su contenido de ahora, tambien los nuevos sin seguimiento) y app/dist, sin lo secreto (se
 * mira solo el nombre: nunca se abre) ni temp/ ni output/. node_modules como junction. -> { archivos, sinCopiar }
 */
function crearCopia(destino) {
  if (existe(destino)) throw new Error(`ya existe ${destino}: bórrala o usa otra --copia`);
  const git = (args) => {
    const r = spawnSync('git', args, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${String(r.stderr || r.error?.message || '').slice(0, 300)}`);
    return r.stdout.split('\0').filter(Boolean);
  };
  const lista = [...new Set([...git(['ls-files', '-z']), ...git(['ls-files', '--others', '--exclude-standard', '-z'])])];
  let n = 0;
  const sinCopiar = [];
  for (const rel of lista) {
    if (NO_VAN.test(rel)) continue;
    if (SECRETO.test(rel) && !SI_VA.has(rel)) {
      sinCopiar.push(rel);
      continue;
    }
    const de = path.join(RAIZ, rel);
    let st;
    try {
      st = fs.lstatSync(de);
    } catch {
      continue; // borrado en el arbol de trabajo
    }
    if (!st.isFile()) continue;
    const a = path.join(destino, rel);
    fs.mkdirSync(path.dirname(a), { recursive: true });
    fs.copyFileSync(de, a);
    n++;
  }
  const dist = path.join(APP, 'dist');
  if (!existe(path.join(dist, 'index.html'))) throw new Error('falta app/dist (la interfaz armada): corre `cd app && npx vite build`');
  fs.cpSync(dist, path.join(destino, 'app', 'dist'), { recursive: true });
  for (const e of ENLACES) {
    const real = path.join(RAIZ, e);
    if (!existe(real)) continue;
    fs.mkdirSync(path.dirname(path.join(destino, e)), { recursive: true });
    fs.symlinkSync(real, path.join(destino, e), 'junction');
  }
  fs.mkdirSync(path.join(destino, 'temp', '_productos'), { recursive: true });
  // control: nada secreto en la copia (solo el nombre)
  const malos = [];
  const recorrer = (d) => {
    for (const x of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, x.name);
      if (x.isSymbolicLink()) continue;
      if (x.isDirectory()) recorrer(p);
      else {
        const rel = path.relative(destino, p).split(path.sep).join('/');
        if (SECRETO.test(rel) && !SI_VA.has(rel)) malos.push(rel);
      }
    }
  };
  recorrer(destino);
  if (malos.length) throw new Error(`quedaron en la copia: ${malos.join(', ')}`);
  return { archivos: n, sinCopiar };
}

/** Todos los enlaces (symlink o junction) dentro de dir, sin entrar en ellos. */
function enlacesEn(dir, fuera = []) {
  let ents = [];
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return fuera;
  }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    let st;
    try {
      st = fs.lstatSync(p);
    } catch {
      continue;
    }
    if (st.isSymbolicLink()) fuera.push(p);
    else if (st.isDirectory()) enlacesEn(p, fuera);
  }
  return fuera;
}

/** Saca primero los enlaces (sin seguirlos) y despues borra la carpeta. -> { ok, motivo? } */
async function borrarCarpeta(dir) {
  if (!existe(dir)) return { ok: true };
  for (const l of enlacesEn(dir)) {
    try {
      fs.rmdirSync(l);
    } catch {
      try {
        fs.unlinkSync(l);
      } catch {
        /* lo dice el control de abajo */
      }
    }
  }
  if (enlacesEn(dir).length) return { ok: false, motivo: 'quedaron enlaces: no la borro' };
  for (let i = 0; i < 8; i++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      break;
    } catch {
      await dormir(1500); // (un archivo que un proceso recien cerrado todavia tiene abierto)
    }
  }
  const sanos = ['app/node_modules/express/package.json'].every((r) => existe(path.join(RAIZ, r)));
  if (!sanos) return { ok: false, motivo: 'los node_modules del proyecto no están completos (revisar)' };
  return existe(dir) ? { ok: false, motivo: `no pude borrar ${dir}` } : { ok: true };
}

/** Los productos (lo que escribio el usuario, la ficha, la pagina y las fotos; sin los registros). */
function copiarProductos(copia) {
  const hechos = [];
  for (const id of PRODUCTOS) {
    const de = path.join(RAIZ, 'temp', '_productos', id);
    if (!existe(path.join(de, 'ficha.json'))) throw new Error(`falta temp/_productos/${id} con su ficha.json`);
    const a = path.join(copia, 'temp', '_productos', id);
    fs.mkdirSync(a, { recursive: true });
    for (const f of ['producto.json', 'ficha.json', 'pagina.txt', 'tarea.json']) if (existe(path.join(de, f))) fs.copyFileSync(path.join(de, f), path.join(a, f));
    if (existe(path.join(de, 'fotos'))) fs.cpSync(path.join(de, 'fotos'), path.join(a, 'fotos'), { recursive: true });
    hechos.push(id);
  }
  return hechos;
}

/** Codex falso: las muestras que usan los Claude falsos de los estilos (solo esos archivos, leidos de temp/). */
function copiarMuestras(copia) {
  const hechas = [];
  for (const m of MUESTRAS_FALSO) {
    const de = path.join(RAIZ, 'temp', m);
    if (!existe(de)) continue;
    const a = path.join(copia, 'temp', m);
    for (const rel of ['manifiesto.json', 'transiciones.json', 'cancion/peticion.json']) {
      if (!existe(path.join(de, rel))) continue;
      fs.mkdirSync(path.dirname(path.join(a, rel)), { recursive: true });
      fs.copyFileSync(path.join(de, rel), path.join(a, rel));
    }
    const man = leerJSON(path.join(de, 'manifiesto.json'));
    for (const r of man?.referencias || []) {
      if (r?.tipo === 'producto' || typeof r?.archivo !== 'string' || !r.archivo || r.archivo.includes('..')) continue;
      if (!existe(path.join(de, r.archivo))) continue;
      fs.mkdirSync(path.dirname(path.join(a, r.archivo)), { recursive: true });
      fs.copyFileSync(path.join(de, r.archivo), path.join(a, r.archivo));
    }
    hechas.push(m);
  }
  return hechas;
}

// ---------------------------------------------------------------- procesos

function matar(proc) {
  if (!proc || proc.exitCode !== null || proc.signalCode !== null) return;
  try {
    if (WIN) spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else process.kill(-proc.pid, 'SIGKILL');
  } catch {
    /* ya no estaba */
  }
}

/** Los procesos (pid) cuya linea de comando nombra `ruta` (la copia): la app, Codex o el Codex falso de esta prueba. */
function procesosCon(ruta) {
  const formas = [...new Set([ruta, ruta.replace(/\\/g, '/')])];
  if (WIN) {
    const lista = formas.map((f) => `'${f.replace(/'/g, "''")}'`).join(',');
    const ps = `$r = @(${lista}); Get-CimInstance Win32_Process | Where-Object { $p = $_; $p.ProcessId -ne $PID -and $p.CommandLine -and (@($r | Where-Object { $p.CommandLine.Contains($_) }).Count -gt 0) } | ForEach-Object { $_.ProcessId }`;
    const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', windowsHide: true, timeout: 60000 });
    if (r.status !== 0) return null;
    return r.stdout.split(/\r?\n/).map((l) => Number(l.trim())).filter((n) => Number.isInteger(n) && n > 0 && n !== process.pid);
  }
  const r = spawnSync('ps', ['-axo', 'pid=,args='], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  return r.stdout
    .split('\n')
    .filter((l) => formas.some((f) => l.includes(f)))
    .map((l) => Number(l.trim().split(/\s+/)[0]))
    .filter((n) => Number.isInteger(n) && n !== process.pid);
}

function matarPids(pids) {
  for (const pid of pids || []) {
    try {
      if (WIN) spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else process.kill(pid, 'SIGKILL');
    } catch {
      /* ya no estaba */
    }
  }
}

// ---------------------------------------------------------------- la app de prueba

/** pedir(ruta, { json, metodo, ms }) a la app, con el Origin de la app en lo que cambia algo (como la pantalla). */
function pedirA(base) {
  return async (ruta, o = {}) => {
    const cuerpo = o.json !== undefined ? JSON.stringify(o.json) : undefined;
    const metodo = o.metodo || (cuerpo !== undefined ? 'POST' : 'GET');
    const headers = { Accept: 'application/json', ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(metodo !== 'GET' ? { Origin: base } : {}) };
    const r = await fetch(base + ruta, { method: metodo, headers, body: cuerpo, redirect: 'manual', signal: AbortSignal.timeout(o.ms || 60000) });
    const tipo = r.headers.get('content-type') || '';
    const datos = tipo.includes('json') ? await r.json().catch(() => null) : await r.text();
    return { st: r.status, datos };
  };
}

/** Arranca app/server/index.js de la copia y espera a que responda (2 min). */
async function arrancarApp({ copia, puerto, env, log }) {
  const salidaLog = fs.createWriteStream(log, { flags: 'a' });
  const proc = spawn(process.execPath, ['server/index.js'], { cwd: path.join(copia, 'app'), env: { ...env, PUERTO: String(puerto) }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, detached: !WIN });
  proc.stdout.pipe(salidaLog);
  proc.stderr.pipe(salidaLog);
  let salio = null;
  proc.on('exit', (c, s) => (salio = { codigo: c, senal: s }));
  const base = `http://127.0.0.1:${puerto}`;
  const pedir = pedirA(base);
  let arriba = false;
  for (let i = 0; i < 240 && !salio; i++) {
    try {
      if ((await pedir('/', { ms: 3000 })).st === 200) {
        arriba = true;
        break;
      }
    } catch {
      /* todavia no */
    }
    await dormir(500);
  }
  const cerrar = async () => {
    matar(proc);
    await dormir(1500);
    salidaLog.end();
  };
  return { pedir, arriba, base, salio: () => salio, cerrar, pid: proc.pid };
}

// ---------------------------------------------------------------- los limites de uso

const SEMANA_MIN = 7 * 24 * 60;
const aMs = (s) => Number(s) * (Number(s) < 1e12 ? 1000 : 1);
function resumenLimites(lim) {
  if (!lim) return null;
  const v = (x) => (x ? { usado: x.usedPercent, ventanaMin: x.windowDurationMins, reinicia: x.resetsAt ? new Date(aMs(x.resetsAt)).toISOString() : null } : null);
  const ventanas = [lim.primary, lim.secondary].filter(Boolean);
  const semanal = ventanas.find((x) => Number(x.windowDurationMins) >= SEMANA_MIN - 60) || lim.secondary || null;
  const corta = ventanas.find((x) => x !== semanal) || null;
  return { semanal: v(semanal), corta: v(corta), ordinario: lim.ordinaryUsageAllowed ?? null, alcanzado: lim.rateLimitReachedType ?? null, plan: lim.planType ?? null };
}

/**
 * Lee los limites (sin cache) y los anota. Con la cuenta de verdad: si no se pueden leer dos veces seguidas, si la
 * semanal pasa del 60 %, la corta del 80 % o ya no queda uso ordinario, para (ctx.parado). -> { seguir, resumen }
 */
async function revisarLimites(ctx, donde, { soloLeer = false } = {}) {
  let lim = await ctx.lib.appServer.limitesFrescos().catch(() => null);
  if (!lim && !ctx.falso) {
    await dormir(5000);
    lim = await ctx.lib.appServer.limitesFrescos().catch(() => null);
  }
  const resumen = resumenLimites(lim);
  ctx.informe.limites.push({ donde, momento: ahora(), ...(resumen || { error: 'no se pudieron leer' }) });
  const txt = resumen ? `semanal ${resumen.semanal?.usado ?? '-'} % · corta ${resumen.corta?.usado ?? '-'} %` : 'no se pudieron leer';
  ctx.avisar(`    (límites, ${donde}: ${txt})`);
  if (soloLeer) return { seguir: true, resumen };
  if (ctx.parado) return { seguir: false, resumen };
  if (!lim) {
    if (ctx.falso) return { seguir: true, resumen };
    ctx.parado = `Paré (${donde}): no pude leer los límites de uso dos veces seguidas.`;
    ctx.avisar(`  ${ctx.parado}`);
    return { seguir: false, resumen };
  }
  const pasa = [];
  if (Number(resumen.semanal?.usado) > 60) pasa.push(`semanal ${resumen.semanal.usado} %`);
  if (Number(resumen.corta?.usado) > 80) pasa.push(`corta ${resumen.corta.usado} %`);
  if (ctx.lib.appServer.sinUsoOrdinario(lim)) pasa.push('sin uso ordinario');
  if (pasa.length) {
    ctx.parado = `Paré (${donde}): ${pasa.join(', ')} (el tope es 60 % en la ventana semanal y 80 % en la corta).`;
    ctx.avisar(`  ${ctx.parado}`);
    return { seguir: false, resumen };
  }
  return { seguir: true, resumen };
}

// ---------------------------------------------------------------- lo que dejo la sesion

/** El registro de codex.js (<tipo>-codex.log): mensajes, correcciones, hilos, esfuerzo, ediciones, denegados… */
function leerRegistroCodex(ruta) {
  const out = { existe: existe(ruta), mensajes: 0, exec: 0, resume: 0, correcciones: 0, errores: [], herramientas: 0, hilos: [], esfuerzos: [], limitesUsado: [], edito: [], guardo: [], denegados: [], comandos: [], tomasTocadas: false, sinCambios: false, deNuevo: [], estados: [], fin: null, fueraDelEnum: 0 };
  for (const e of lineasJSONL(ruta)) {
    if (e.type === 'app') {
      if (e.modo === 'exec' || e.modo === 'resume') {
        out.mensajes++;
        out[e.modo]++;
        const a = (e.args || []).find((x) => /^model_reasoning_effort=/.test(String(x)));
        const v = a ? String(a).match(/"(\w+)"/)?.[1] : null;
        if (v && !out.esfuerzos.includes(v)) out.esfuerzos.push(v);
      }
      if (e.correccion) {
        out.correcciones++;
        out.errores.push(...(Array.isArray(e.correccion) ? e.correccion : [e.correccion]).slice(0, 4).map((x) => String(x).slice(0, 300)));
      }
      if (e.intento === 'herramienta') out.herramientas++;
      if (e.limites && Number.isFinite(Number(e.limites.usado))) out.limitesUsado.push(Number(e.limites.usado));
      if (Array.isArray(e.edito)) out.edito.push(...e.edito);
      if (Array.isArray(e.guardo)) out.guardo.push(...e.guardo);
      if (Array.isArray(e.denegados) && e.denegados.length) out.denegados.push(...e.denegados.map((d) => ({ tipo: d.tipo, ruta: d.ruta || d.comando, motivo: String(d.motivo || '').slice(0, 200) })));
      if (e.comando) out.comandos.push({ comando: e.comando, codigo: e.codigo ?? null, denegado: e.denegado || undefined });
      if (e.tomasTocadas === true) out.tomasTocadas = true;
      if (e.sinCambios === true) out.sinCambios = true; // (en la linea del material, sinCambios es una lista)
      if (e.deNuevo) out.deNuevo.push(e.deNuevo);
      if (e.estado) out.estados.push(e.estado);
      if (e.fin) out.fin = e.fin;
      continue;
    }
    if (e.type === 'thread.started' && e.thread_id && !out.hilos.includes(e.thread_id)) out.hilos.push(e.thread_id);
    const it = e.item;
    if (it && /^item\./.test(String(e.type)) && !['agent_message', 'reasoning', 'error'].includes(it.type)) out.herramientas++;
    if (it?.type === 'agent_message' && e.type === 'item.completed') {
      try {
        const v = JSON.parse(it.text);
        if (!['LISTO', 'BLOQUEADO', 'SEGUIR'].includes(v.estado)) out.fueraDelEnum++;
      } catch {
        /* no era JSON: lo cuenta codex.js */
      }
    }
  }
  return out;
}

/** Lo que la app guardo de la sesion (sesion.json, su ultima medida de ese tipo) y su registro de Codex. */
function medirSesion(ctx, slug, tipo) {
  const dir = path.join(ctx.copia, 'temp', slug);
  const s = leerJSON(path.join(dir, 'app', 'sesion.json')) || {};
  const m = [...(Array.isArray(s.medidas) ? s.medidas : [])].reverse().find((x) => x?.tipo === tipo) || null;
  const reg = leerRegistroCodex(path.join(dir, 'app', 'registro', `${tipo === 'cambios' ? 'cambios' : 'guion'}-codex.log`));
  for (const h of reg.hilos) if (!ctx.informe.hilos.includes(h)) ctx.informe.hilos.push(h);
  return {
    motor: m?.motor ?? null,
    minutos: m ? minutos(m.duracionMs) : null,
    mensajes: m?.turnos ?? reg.mensajes,
    exec: reg.exec,
    resume: reg.resume,
    correcciones: reg.correcciones,
    erroresCorregidos: reg.errores.length ? reg.errores.slice(0, 6) : undefined,
    tokens: m?.uso ? { entrada: m.uso.input_tokens ?? null, cache: m.uso.cached_input_tokens ?? null, salida: m.uso.output_tokens ?? null } : null,
    hilos: reg.hilos,
    esfuerzo: reg.esfuerzos,
    herramientas: reg.herramientas,
    fueraDelEnum: reg.fueraDelEnum,
    denegados: reg.denegados.length ? reg.denegados : [],
    comandos: reg.comandos.length ? reg.comandos : undefined,
    edito: reg.edito.length ? reg.edito : undefined,
    guardo: reg.guardo.length ? reg.guardo.map((x) => ({ ruta: x.ruta, kb: Math.round((Number(x.bytes) || 0) / 1024) })) : undefined,
    tomasTocadasAvisadas: reg.tomasTocadas || undefined,
    sinCambiosAvisado: reg.sinCambios || undefined,
    deNuevo: reg.deNuevo.length ? reg.deNuevo : undefined,
    usoDentro: reg.limitesUsado.length ? { primero: reg.limitesUsado[0], ultimo: reg.limitesUsado.at(-1) } : undefined,
    medidaOk: m ? Boolean(m.ok) : null,
    progreso: Array.isArray(s.progreso) ? s.progreso.slice(-8) : [],
  };
}

const ARCHIVOS_GUION = [
  ['manifiesto.json', 'manifiesto.json'],
  ['transiciones.json', 'transiciones.json'],
  ['app/guion.json', 'guion.json'],
  ['app/letras.json', 'letras.json'],
  ['cancion/peticion.json', 'peticion.json'],
  ['app/brief.json', 'brief.json'],
  ['app/bloqueo.json', 'bloqueo.json'],
  ['app/registro/guion-codex.log', 'guion-codex.log'],
];

/** Copia el guion (y su registro) a <salida>/<carpeta>/. -> { carpeta, archivos } */
function copiarGuion(ctx, slug, carpeta, lista = ARCHIVOS_GUION) {
  const dir = path.join(ctx.copia, 'temp', slug);
  const a = path.join(ctx.salida, carpeta);
  fs.rmSync(a, { recursive: true, force: true });
  fs.mkdirSync(a, { recursive: true });
  const archivos = [];
  for (const [de, nombre] of lista) {
    if (!existe(path.join(dir, de))) continue;
    fs.copyFileSync(path.join(dir, de), path.join(a, nombre));
    archivos.push(nombre);
  }
  return { carpeta: a, archivos };
}

/** validar-manifiesto otra vez, por fuera de la app (gratis: no llama a nadie). */
function validarOtraVez(ctx, slug) {
  const r = spawnSync(process.execPath, ['produccion/validar-manifiesto.js', `temp/${slug}/manifiesto.json`], { cwd: ctx.copia, encoding: 'utf8', windowsHide: true, timeout: 120000 });
  const salida = `${r.stdout || ''}${r.stderr || ''}`;
  return { codigo: r.status, errores: salida.split(/\r?\n/).filter((l) => /^\s*ERROR/.test(l)).slice(0, 5) };
}

/** Musical e historia: que el guion no haya pedido la cancion (ni audio en la carpeta). */
function revisarCancion(ctx, slug) {
  const dir = path.join(ctx.copia, 'temp', slug);
  const audios = [];
  for (const sub of ['cancion', 'audio', 'musica']) {
    let ns = [];
    try {
      ns = fs.readdirSync(path.join(dir, sub));
    } catch {
      continue;
    }
    for (const n of ns) if (/\.(mp3|wav|m4a|ogg)$/i.test(n)) audios.push(`${sub}/${n}`);
  }
  return { audios, peticion: existe(path.join(dir, 'cancion', 'peticion.json')), letras: existe(path.join(dir, 'app', 'letras.json')) };
}

/** Espera a que el guion deje de estar «escribiendo» (o la app se cierre, o se acabe el tiempo). */
async function esperarGuion(ctx, slug, { minutosTope, etiqueta }) {
  const limite = Date.now() + minutosTope * 60000;
  let ultimo = null;
  let vista = '';
  while (Date.now() < limite) {
    if (ctx.app.salio()) return { ...(ultimo || {}), _appCerrada: ctx.app.salio() };
    try {
      const r = await ctx.app.pedir(`/api/anuncios/${slug}/guion`, { ms: 30000 });
      if (r.st === 200 && r.datos) {
        ultimo = r.datos;
        const f = Array.isArray(ultimo.progreso) ? ultimo.progreso.at(-1) : null;
        if (f && f !== vista) {
          vista = f;
          ctx.avisar(`    ${etiqueta}: ${f}`);
        }
        if (ultimo.estado && ultimo.estado !== 'escribiendo') return ultimo;
      }
    } catch (e) {
      ultimo = { ...(ultimo || {}), _errorPedido: e.message };
    }
    await dormir(ctx.falso ? 1000 : 4000);
  }
  return { ...(ultimo || {}), _seAcaboElTiempo: `${minutosTope} min` };
}

// ---------------------------------------------------------------- P2 (y la pasada medium)

async function correrUnGuion(ctx, def, { fase }) {
  const etiqueta = fase === 'medium' ? `${def.clave} (medium)` : def.clave;
  const res = { clave: def.clave, estilo: def.estilo, continuidad: Boolean(def.continuidad), producto: def.producto, esfuerzoPedido: fase === 'medium' ? 'medium (AIA_CODEX_ESFUERZO)' : 'el de la tarea (high)', fecha: ahora() };
  const lim0 = await revisarLimites(ctx, `antes de ${etiqueta}`);
  res.usoAntes = lim0.resumen;
  if (!lim0.seguir) return { ...res, ok: false, omitido: ctx.parado };
  ctx.avisar(`  ${etiqueta}: creando el anuncio (${def.producto})…`);
  const t0 = Date.now();
  const cuerpo = { productoId: def.producto, estilo: def.estilo, continuidad: Boolean(def.continuidad), respuestas: def.respuestas || {}, ...(def.voz ? { voz: VOZ } : {}) };
  let r;
  try {
    r = await ctx.app.pedir('/api/anuncios', { json: cuerpo });
  } catch (e) {
    return { ...res, ok: false, error: `POST /api/anuncios: ${e.message}` };
  }
  if (r.st !== 201 || !r.datos?.slug) return { ...res, ok: false, error: `POST /api/anuncios → ${r.st}: ${JSON.stringify(r.datos).slice(0, 400)}` };
  const slug = r.datos.slug;
  res.slug = slug;
  const g = await esperarGuion(ctx, slug, { minutosTope: ctx.minutosGuion, etiqueta });
  res.minutosTotal = minutos(Date.now() - t0);
  res.usoDespues = (await revisarLimites(ctx, `después de ${etiqueta}`, { soloLeer: true })).resumen;
  Object.assign(res, medirSesion(ctx, slug, 'guion'));
  res.estado = g?.estado ?? null;
  if (g?.error) res.error = g.error.mensaje || JSON.stringify(g.error).slice(0, 400);
  if (g?.error?.detalle) res.detalleError = String(g.error.detalle).slice(0, 600);
  if (g?._seAcaboElTiempo) res.error = `no terminó en ${g._seAcaboElTiempo}`;
  if (g?._appCerrada) res.error = `la app se cerró (${JSON.stringify(g._appCerrada)})`;
  res.partes = Array.isArray(g?.guion?.partes) ? g.guion.partes.length : g?.letras?.opciones?.length ?? null;
  res.titulo = g?.guion?.titulo || g?.letras?.titulo || null;
  // listo = pasó verificarGuion dentro de la app (lanzarSesion solo da ok con verificar ok)
  res.ok = g?.estado === 'listo' && res.medidaOk === true && res.motor === 'codex';
  if (res.ok && !CANTADOS.has(def.estilo)) {
    res.validarOtraVez = validarOtraVez(ctx, slug);
    if (res.validarOtraVez.codigo !== 0) res.ok = false;
  }
  if (CANTADOS.has(def.estilo)) res.cancion = revisarCancion(ctx, slug);
  const carpeta = fase === 'medium' ? `${def.clave}-medium` : def.clave;
  const c = copiarGuion(ctx, slug, carpeta);
  res.copiado = c.carpeta;
  res.guionProducido = CANTADOS.has(def.estilo)
    ? path.join(c.carpeta, def.estilo === 'musical' ? 'letras.json' : 'peticion.json')
    : path.join(c.carpeta, 'manifiesto.json');
  ctx.avisar(`  ${etiqueta}: ${res.ok ? 'bien' : 'MAL'} · ${fmin(res.minutos)} min de ${ctx.nombreIA} (${fmin(res.minutosTotal)} en total) · ${res.mensajes ?? '-'} mensajes · ${res.correcciones} correcciones${res.error ? ` · ${res.error}` : ''}`);
  return res;
}

// ---------------------------------------------------------------- P3: el alcance de cada cambio

const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const porN = (xs, k = 'n') => new Map((Array.isArray(xs) ? xs : []).filter((x) => x && typeof x === 'object').map((x) => [x[k], x]));
const MARCA = /^\s*\[[^\]]*\]\s*$/;
const lineasDe = (letra) => String(letra ?? '').split(/\r?\n/).map((x) => x.trim()).filter((x) => x && !MARCA.test(x));

function cambiadasPorN(a, b, k = 'n') {
  const mA = porN(a, k);
  const mB = porN(b, k);
  return [...new Set([...mA.keys(), ...mB.keys()])].filter((n) => !igual(mA.get(n), mB.get(n)));
}
const otrosCambiados = (A, B, fuera) => [...new Set([...Object.keys(A || {}), ...Object.keys(B || {})])].filter((c) => !fuera.includes(c) && !igual(A?.[c], B?.[c]));

/** Claymation: solo la ultima toma (y los B-roll que van con ella; voz_en_off, si la lleva, acompaña). */
function alcanceUltimaToma(antes, despues) {
  const nUltima = Math.max(...(antes?.tomas || []).map((t) => Number(t?.n)).filter(Number.isFinite));
  const tomas = cambiadasPorN(antes?.tomas, despues?.tomas);
  const broll = cambiadasPorN(antes?.broll, despues?.broll);
  const delCierre = (n) => {
    const b = porN(antes?.broll).get(n) || porN(despues?.broll).get(n) || {};
    return Number(b.despues_de_toma) === nUltima || Number(b.encima_de_toma) === nUltima || Number(b.toma) === nUltima;
  };
  const otros = otrosCambiados(antes, despues, ['tomas', 'broll']);
  const deMas = [...tomas.filter((n) => Number(n) !== nUltima).map((n) => `toma ${n}`), ...broll.filter((n) => !delCierre(n)).map((n) => `B-roll ${n}`)];
  const revisar = otros.filter((c) => c !== 'voz_en_off').map((c) => `\`${c}\``);
  return { pedido: `la toma ${nUltima} (la última)`, tomas, broll, otros, deMas, revisar, ok: tomas.length > 0 && deMas.length === 0 };
}

/** Podcast: solo la linea 1 de la conversacion (guion[].orden 1), la toma que la dice y su B-roll. */
function alcancePrimeraLinea(antes, despues) {
  const lineas = cambiadasPorN(antes?.guion, despues?.guion, 'orden');
  const conLa1 = new Set((antes?.tomas || []).filter((t) => (t?.lineas || []).some((l) => Number(l?.orden) === 1)).map((t) => t.n));
  const tomas = cambiadasPorN(antes?.tomas, despues?.tomas);
  const broll = cambiadasPorN(antes?.broll, despues?.broll);
  const deLa1 = (n) => {
    const b = porN(antes?.broll).get(n) || porN(despues?.broll).get(n) || {};
    return Number(b.en_linea) === 1 || conLa1.has(b.encima_de_toma);
  };
  const otros = otrosCambiados(antes, despues, ['tomas', 'broll', 'guion']);
  const deMas = [...lineas.filter((n) => Number(n) !== 1).map((n) => `línea ${n}`), ...tomas.filter((n) => !conLa1.has(n)).map((n) => `toma ${n}`), ...broll.filter((n) => !deLa1(n)).map((n) => `B-roll ${n}`)];
  return { pedido: 'la línea 1 de la conversación', lineas, tomas, broll, otros, deMas, revisar: otros.map((c) => `\`${c}\``), ok: lineas.includes(1) && deMas.length === 0 };
}

/** Historia musical: solo la ultima linea de la letra (y `bloques`, que repite la letra). */
function alcanceUltimaLinea(antes, despues) {
  const la = lineasDe(antes?.letra);
  const lb = lineasDe(despues?.letra);
  const otros = otrosCambiados(antes, despues, ['letra']);
  const revisar = otros.filter((c) => c !== 'bloques').map((c) => `\`${c}\``);
  if (la.length !== lb.length) {
    const quitadas = la.filter((x) => !lb.includes(x));
    const puestas = lb.filter((x) => !la.includes(x));
    const soloLaUltima = quitadas.length <= 1 && (!quitadas.length || quitadas[0] === la.at(-1));
    return { pedido: `la línea ${la.length} (la última)`, lineasAntes: la.length, lineasDespues: lb.length, quitadas, puestas, otros, deMas: soloLaUltima ? [] : quitadas.filter((x) => x !== la.at(-1)).map((x) => `«${x.slice(0, 60)}»`), revisar: [...revisar, `la letra pasó de ${la.length} a ${lb.length} líneas`], ok: false };
  }
  const cambiadas = la.map((x, i) => (x !== lb[i] ? i + 1 : null)).filter(Boolean);
  const deMas = cambiadas.filter((n) => n !== la.length).map((n) => `línea ${n}`);
  return { pedido: `la línea ${la.length} (la última)`, lineas: cambiadas, antes: la.at(-1), despues: lb.at(-1), otros, deMas, revisar, ok: cambiadas.includes(la.length) && deMas.length === 0 };
}

async function correrUnCambio(ctx, clave, p2) {
  const c = CAMBIOS_P3[clave];
  const res = { clave, pedido: c.pedido, archivo: c.archivo, fecha: ahora() };
  if (!p2?.ok || !p2.slug) return { ...res, ok: false, omitido: `el guion de P2 (${clave}) no salió bien` };
  const lim0 = await revisarLimites(ctx, `antes del cambio a ${clave}`);
  res.usoAntes = lim0.resumen;
  if (!lim0.seguir) return { ...res, ok: false, omitido: ctx.parado };
  const slug = p2.slug;
  res.slug = slug;
  const dir = path.join(ctx.copia, 'temp', slug);
  const transAntes = leerJSON(path.join(dir, 'transiciones.json'));
  ctx.avisar(`  cambio a ${clave}: «${c.pedido}»`);
  const t0 = Date.now();
  let r;
  try {
    r = await ctx.app.pedir(`/api/anuncios/${slug}/guion/cambios`, { json: { pedido: c.pedido } });
  } catch (e) {
    return { ...res, ok: false, error: `POST …/guion/cambios: ${e.message}` };
  }
  if (r.st !== 202) return { ...res, ok: false, error: `POST …/guion/cambios → ${r.st}: ${JSON.stringify(r.datos).slice(0, 400)}` };
  await dormir(300);
  const g = await esperarGuion(ctx, slug, { minutosTope: ctx.minutosCambio, etiqueta: `cambio a ${clave}` });
  res.minutosTotal = minutos(Date.now() - t0);
  res.usoDespues = (await revisarLimites(ctx, `después del cambio a ${clave}`, { soloLeer: true })).resumen;
  Object.assign(res, medirSesion(ctx, slug, 'cambios'));
  res.estado = g?.estado ?? null;
  res.cambiosHechos = g?.cambios ?? null;
  if (g?.error) res.error = g.error.mensaje || JSON.stringify(g.error).slice(0, 400);
  if (g?._seAcaboElTiempo) res.error = `no terminó en ${g._seAcaboElTiempo}`;
  if (g?._appCerrada) res.error = `la app se cerró (${JSON.stringify(g._appCerrada)})`;
  res.pasa = g?.estado === 'listo' && !g?.cambioFallido && res.medidaOk === true && res.motor === 'codex';
  // como llego el cambio: con ediciones (bien) o el archivo entero
  const esElArchivo = (ruta) => String(ruta || '').replace(/\\/g, '/').endsWith(`${slug}/${c.archivo}`);
  res.comoEdiciones = Boolean((res.edito || []).some((x) => esElArchivo(x.ruta)) && !(res.guardo || []).some((x) => esElArchivo(x.ruta)));
  res.enteros = (res.guardo || []).map((x) => x.ruta);
  // el respaldo que hizo la app antes del cambio (app/historial-guion/NN) contra lo de ahora
  const hist = path.join(dir, 'app', 'historial-guion');
  let ultima = null;
  try {
    ultima = fs.readdirSync(hist).filter((n) => /^\d+$/.test(n)).sort().at(-1) || null;
  } catch {
    /* sin respaldo */
  }
  const antes = ultima ? leerJSON(path.join(hist, ultima, path.basename(c.archivo))) : null;
  const despues = leerJSON(path.join(dir, c.archivo));
  if (!antes || !despues) res.alcance = { ok: false, error: !antes ? 'no encontré el respaldo de antes del cambio' : `${c.archivo} no es JSON` };
  else {
    try {
      res.alcance = c.alcance(antes, despues);
    } catch (e) {
      res.alcance = { ok: false, error: e.message };
    }
  }
  if (transAntes && !igual(transAntes, leerJSON(path.join(dir, 'transiciones.json')))) (res.alcance.revisar ||= []).push('transiciones.json cambió');
  // lo que mira el control de la app (ia/material.js tomasTocadas), para el informe
  if (antes && despues) {
    const k = ctx.lib.material.tomasTocadas(antes, despues);
    res.tomasTocadas = { tomas: k.tomas, broll: k.broll, otros: k.otros, lineas: [...new Set(k.lineas.map((x) => x.n))] };
  }
  res.ok = Boolean(res.pasa && res.comoEdiciones && res.alcance?.ok);
  // antes y despues, para el juez
  const a = path.join(ctx.salida, clave, 'cambio');
  fs.rmSync(a, { recursive: true, force: true });
  fs.mkdirSync(path.join(a, 'antes'), { recursive: true });
  if (ultima) for (const n of fs.readdirSync(path.join(hist, ultima))) fs.copyFileSync(path.join(hist, ultima, n), path.join(a, 'antes', n));
  fs.mkdirSync(path.join(a, 'despues'), { recursive: true });
  for (const [de, nombre] of ARCHIVOS_GUION.filter(([x]) => x !== 'app/registro/guion-codex.log' && x !== 'app/brief.json')) if (existe(path.join(dir, de))) fs.copyFileSync(path.join(dir, de), path.join(a, 'despues', nombre));
  if (existe(path.join(dir, 'app', 'registro', 'cambios-codex.log'))) fs.copyFileSync(path.join(dir, 'app', 'registro', 'cambios-codex.log'), path.join(a, 'cambios-codex.log'));
  escribirJSON(path.join(a, 'alcance.json'), { pedido: c.pedido, alcance: res.alcance, tomasTocadas: res.tomasTocadas, comoEdiciones: res.comoEdiciones, edito: res.edito, guardo: res.guardo });
  res.copiado = a;
  const al = res.alcance || {};
  ctx.avisar(`  cambio a ${clave}: ${res.ok ? 'bien' : 'MAL'} · ${fmin(res.minutos)} min · ${res.comoEdiciones ? 'con ediciones' : 'SIN ediciones'} · de más: ${(al.deMas || []).join(', ') || 'nada'}${(al.revisar || []).length ? ` · revisar: ${al.revisar.join(', ')}` : ''}${res.error ? ` · ${res.error}` : ''}`);
  return res;
}

// ---------------------------------------------------------------- Claude: los minutos de sus registros

/** Los guiones que escribio Claude en esta carpeta (temp/*\/app/registro/guion.log y cambios.log; solo se leen). */
function minutosDeClaude() {
  const guion = {};
  const cambios = {};
  const carpetas = [];
  for (const base of [path.join(RAIZ, 'temp'), path.join(RAIZ, 'temp', '_descartados')]) {
    let ns = [];
    try {
      ns = fs.readdirSync(base, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const d of ns) if (d.isDirectory() && !d.name.startsWith('_codex')) carpetas.push(path.join(base, d.name));
  }
  for (const dir of carpetas) {
    const brief = leerJSON(path.join(dir, 'app', 'brief.json'));
    if (!brief?.estilo) continue;
    const clave = `${brief.estilo}${brief.continuidad ? '-continuidad' : ''}`;
    for (const [tipo, destino] of [['guion', guion], ['cambios', cambios]]) {
      const ev = lineasJSONL(path.join(dir, 'app', 'registro', `${tipo}.log`));
      if (!ev.length) continue;
      const fins = ev.filter((e) => e.type === 'app' && e.fin);
      const results = ev.filter((e) => e.type === 'result');
      const ms = fins.length ? fins.reduce((s, e) => s + (Number(e.fin.duracionMs) || 0), 0) : results.reduce((s, e) => s + (Number(e.duration_ms) || 0), 0);
      if (!ms) continue;
      (destino[clave] ||= []).push({ slug: path.basename(dir), minutos: minutos(ms), intentos: Math.max(fins.length, results.length), turnos: results.at(-1)?.num_turns ?? fins.at(-1)?.fin?.turnos ?? null, ok: fins.length ? Boolean(fins.at(-1).fin.ok) : !results.at(-1)?.is_error, fecha: ev[0]?.momento || null });
    }
  }
  const resumir = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { n: v.length, minutosMediana: mediana(v.filter((x) => x.ok).map((x) => x.minutos)), anuncios: v }]));
  return { fuente: 'temp/*/app/registro/guion.log y cambios.log (solo lectura)', guion: resumir(guion), cambios: resumir(cambios) };
}

// ---------------------------------------------------------------- la tabla para Diego

function armarTabla(inf) {
  const filas = [];
  for (const e of ESTILOS_P2) {
    const g = inf.p2?.[e.clave];
    const m = inf.medium?.[e.clave];
    const cl = inf.claude?.guion?.[e.clave];
    if (!g && !m) continue;
    filas.push({
      estilo: e.clave,
      ok: g ? Boolean(g.ok) : null,
      chatgptMin: g?.minutos ?? null,
      chatgptMinTotal: g?.minutosTotal ?? null,
      correcciones: g?.correcciones ?? null,
      mensajes: g?.mensajes ?? null,
      tokens: g?.tokens ?? null,
      mediumMin: m?.minutos ?? null,
      mediumOk: m ? Boolean(m.ok) : null,
      mediumTokens: m?.tokens ?? null,
      claudeMin: cl?.minutosMediana ?? null,
      claudeN: cl?.n ?? 0,
      veces: g?.minutos && cl?.minutosMediana ? Math.round((g.minutos / cl.minutosMediana) * 10) / 10 : null,
    });
  }
  return filas;
}

function imprimirTabla(filas, avisar) {
  const f = (v, d = 1) => (v === null || v === undefined ? '-' : typeof v === 'number' ? v.toFixed(d).replace('.', ',') : String(v));
  avisar('');
  avisar('Estilo                    ChatGPT  medium   Claude (n)   veces  corr.  ok');
  for (const x of filas) {
    avisar(`${x.estilo.padEnd(25)} ${f(x.chatgptMin).padStart(7)}  ${f(x.mediumMin).padStart(6)}   ${`${f(x.claudeMin)} (${x.claudeN})`.padStart(10)}   ${f(x.veces).padStart(5)}  ${f(x.correcciones, 0).padStart(5)}  ${x.ok === null ? '-' : x.ok ? 'sí' : 'NO'}`);
  }
  avisar('(minutos de la sesión de la IA; «veces» = ChatGPT / la mediana de Claude)');
}

// ---------------------------------------------------------------- el informe

function cargarInforme(salida, modo) {
  const previo = leerJSON(path.join(salida, 'informe.json'));
  const base = { herramienta: 'app/herramientas/codex/tareas-guiones.mjs', modo, corridas: [], limites: [], p2: {}, p3: {}, medium: {}, hilos: [] };
  if (!previo || previo.modo !== modo) return base;
  return { ...base, ...previo, corridas: previo.corridas || [], limites: previo.limites || [], p2: previo.p2 || {}, p3: previo.p3 || {}, medium: previo.medium || {}, hilos: previo.hilos || [] };
}

// ---------------------------------------------------------------- lo de afuera

function normalizarPuntos(puntos, esfuerzo) {
  // (p0, p1, p4 y p5 son de otras herramientas de probar-codex.mjs --tareas: aqui no hacen nada)
  const lista = (Array.isArray(puntos) ? puntos : String(puntos || 'p2,p3').split(',')).map((x) => String(x).trim().toLowerCase()).filter((x) => x && !['p0', 'p1', 'p4', 'p5'].includes(x));
  const malos = lista.filter((x) => !['p2', 'p3', 'medium'].includes(x));
  if (malos.length) throw new Error(`--puntos: no conozco ${malos.join(', ')} (van p2, p3 y medium).`);
  const e = esfuerzo === undefined || esfuerzo === null || esfuerzo === '' ? null : String(esfuerzo).toLowerCase();
  if (e && !['medium', 'high'].includes(e)) throw new Error(`--esfuerzo: «${esfuerzo}» no vale (medium o high).`);
  const s = new Set(lista);
  if (e === 'medium') s.add('medium');
  return s;
}

function normalizarSolo(solo) {
  if (solo === undefined || solo === null || solo === '' || solo === true) return null;
  const lista = (Array.isArray(solo) ? solo : String(solo).split(',')).map((x) => String(x).trim()).filter(Boolean);
  const malos = lista.filter((x) => !CLAVES.includes(x));
  if (malos.length) throw new Error(`--solo: no conozco ${malos.join(', ')} (van ${CLAVES.join(', ')}).`);
  return lista;
}

/** <salida> va fuera de la carpeta del proyecto o dentro de temp/ (en otra parte entraria al paquete de los alumnos). */
function salidaValida(dir) {
  const rel = path.relative(RAIZ, dir);
  return rel.startsWith('..') || path.isAbsolute(rel) || /^temp[\\/]/i.test(rel);
}

async function elegirPuerto() {
  for (const p of PUERTOS) if (!NUNCA.has(p) && (await libre(p))) return p;
  return null;
}

async function enParalelo(items, n, fn) {
  const cola = [...items];
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(n, cola.length)) }, async () => {
      while (cola.length) await fn(cola.shift());
    }),
  );
}

/**
 * P2, P3 y la pasada medium (DISENO §6.3). Opciones: homeUsuario (Codex de verdad con ~/.codex; si no, el Codex
 * falso), puntos ('p2,p3' por defecto; tambien 'medium'), solo (estilos), esfuerzo ('medium' suma la pasada medium),
 * aLaVez (1 o 2), salida, copia (la carpeta de la copia descartable), programas (AIA_PROGRAMAS_DIR), conservar,
 * avisar (por donde va el avance; console.log). Las que no vengan se leen de la linea de comando (--salida, --copia,
 * --programas, --a-la-vez, --conservar), asi probar-codex.mjs --tareas solo tiene que pasar las cuatro primeras.
 * -> { ok, informe, ruta, parado } ({ ok: true, nada: true } si no hay nada que correr: p0, p1, p4 y p5 se ignoran)
 */
export async function correrGuiones(opciones = {}) {
  const avisar = typeof opciones.avisar === 'function' ? opciones.avisar : (t) => console.log(t);
  const falso = !opciones.homeUsuario;
  const puntos = normalizarPuntos(opciones.puntos, opciones.esfuerzo);
  const solo = normalizarSolo(opciones.solo);
  const aLaVez = Math.min(2, Math.max(1, Number(opciones.aLaVez ?? argumento('--a-la-vez') ?? 2) || 2));
  const conservar = Boolean(opciones.conservar ?? process.argv.includes('--conservar'));
  const salida = path.resolve(opciones.salida || argumento('--salida') || path.join(RAIZ, 'temp', '_codex-prueba', falso ? 'guiones-falso' : 'guiones'));
  if (!salidaValida(salida)) throw new Error('--salida va fuera de la carpeta del proyecto o dentro de temp/.');
  const programas = opciones.programas || argumento('--programas') || null;

  // lo que se corre
  const p3Lista = puntos.has('p3') ? Object.keys(CAMBIOS_P3).filter((k) => !solo || solo.includes(k)) : [];
  const p2Claves = new Set(puntos.has('p2') ? (solo || CLAVES) : []);
  const paraP3 = p3Lista.filter((k) => !p2Claves.has(k));
  for (const k of p3Lista) p2Claves.add(k);
  const p2Lista = ESTILOS_P2.filter((e) => p2Claves.has(e.clave));
  const mediumLista = puntos.has('medium') ? ESTILOS_P2.filter((e) => (solo || ESFUERZO_COMPARAR).includes(e.clave)) : [];
  if (!p2Lista.length && !mediumLista.length) {
    avisar(`Guiones (P2, P3, medium): no hay nada que correr (puntos ${[...puntos].join(',') || '-'}${solo ? `, solo ${solo.join(',')}` : ''}).`);
    return { ok: true, nada: true, informe: null, ruta: null, parado: null };
  }

  // el entorno de este proceso (los limites y la cuenta los lee codex-app-server.js): se devuelve como estaba
  const VARIABLES = ['AIA_CODEX_HOME', 'ANUNCIOS_CODEX_BIN', 'FALSO_CODEX_SESION', 'AIA_PROGRAMAS_DIR'];
  const antesEnv = Object.fromEntries(VARIABLES.map((k) => [k, process.env[k]]));
  const devolverEnv = () => {
    for (const [k, v] of Object.entries(antesEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };

  const puerto = await elegirPuerto();
  if (!puerto) throw new Error(`No hay un puerto libre entre ${PUERTOS[0]} y ${PUERTOS.at(-1)}.`);
  const base = path.resolve(opciones.copia || argumento('--copia') || path.join(os.tmpdir(), `aia-guiones-${puerto}`));
  if (!path.relative(RAIZ, base).startsWith('..') && !path.isAbsolute(path.relative(RAIZ, base))) throw new Error('--copia va fuera de la carpeta del proyecto.');
  // una carpeta nueva: al terminar se borra entera (nunca una que ya estaba)
  if (existe(base)) throw new Error(`Ya existe ${base} (¿quedó de otra corrida?): bórrala o usa otra --copia.`);
  const copia = path.join(base, 'proyecto');
  const codexFalso = { home: path.join(base, 'codex', 'home'), programas: path.join(base, 'programas'), humo: path.join(base, 'humo.jsonl'), args: path.join(base, 'falso-args.jsonl') };

  if (falso) {
    Object.assign(process.env, { AIA_CODEX_HOME: codexFalso.home, ANUNCIOS_CODEX_BIN: path.join(copia, 'app', 'server', 'claude', 'pruebas', 'codex-falso.js'), FALSO_CODEX_SESION: 'ok', AIA_PROGRAMAS_DIR: codexFalso.programas });
  } else {
    process.env.AIA_CODEX_HOME = HOME_USUARIO;
    delete process.env.ANUNCIOS_CODEX_BIN;
    delete process.env.FALSO_CODEX_SESION;
    if (programas) process.env.AIA_PROGRAMAS_DIR = path.resolve(programas);
  }

  const ctx = {
    falso,
    copia,
    salida,
    avisar,
    parado: null,
    app: null,
    nombreIA: falso ? 'ChatGPT (falso)' : 'ChatGPT',
    minutosGuion: falso ? 6 : 165, // la app corta a los 150 (75 × 2)
    minutosCambio: falso ? 4 : 90, // la app corta a los 80 (40 × 2)
    lib: {},
    informe: cargarInforme(salida, falso ? 'falso' : 'real'),
  };
  const corrida = { fecha: ahora(), puntos: [...puntos], solo, aLaVez, puerto, copia: base, codexHome: falso ? 'Codex falso (CODEX_HOME de la copia)' : 'la sesión de ChatGPT del usuario (~/.codex)' };
  ctx.informe.corridas.push(corrida);
  const guardar = () => {
    ctx.informe.tabla = armarTabla(ctx.informe);
    escribirJSON(path.join(salida, 'informe.json'), ctx.informe);
  };

  let terminado = false;
  const limpiar = async () => {
    if (terminado) return;
    terminado = true;
    try {
      await ctx.app?.cerrar();
    } catch {
      /* ya estaba cerrada */
    }
    await dormir(1500);
    // (Codex nombra la copia en --output-schema y en sus -i; el Codex falso, en la ruta del script)
    const vivos = existe(copia) ? procesosCon(copia) : [];
    if (vivos?.length) {
      matarPids(vivos);
      corrida.procesosQueQuedaban = vivos.length;
    }
    if (!conservar) {
      const b = await borrarCarpeta(base);
      corrida.copiaBorrada = b.ok ? true : b.motivo;
    } else corrida.copiaBorrada = `no (--conservar: ${base})`;
    devolverEnv();
  };
  const alCortar = () => {
    avisar('\nCortado: cierro la app de prueba y borro la copia…');
    corrida.cortado = true;
    limpiar().finally(() => {
      try {
        guardar();
      } catch {
        /* sin informe */
      }
      process.exit(130);
    });
  };
  process.once('SIGINT', alCortar);

  try {
    avisar(`Pruebas de guion con ${falso ? 'el Codex FALSO' : 'Codex DE VERDAD y la sesión de ChatGPT del usuario (~/.codex)'} · puntos ${[...puntos].join(', ')}${solo ? ` · solo ${solo.join(', ')}` : ''} · ${aLaVez} a la vez · puerto ${puerto}`);
    avisar(`  copia: ${copia}`);
    avisar(`  salida: ${salida}`);
    fs.mkdirSync(salida, { recursive: true });

    // ---- las funciones de la app (despues de fijar el entorno) y, con la cuenta de verdad, Codex y la sesion
    const rutas = await import('../../server/lib/codex-rutas.js');
    ctx.lib.appServer = await import('../../server/lib/codex-app-server.js');
    ctx.lib.material = await import('../../server/lib/ia/material.js');
    ctx.informe.version = rutas.VERSION_CODEX;
    ctx.informe.plataforma = `${process.platform}-${process.arch}`;
    const bin = rutas.resolverCodex();
    if (!bin) throw new Error(`Falta Codex ${rutas.VERSION_CODEX} en ${rutas.carpetaCodex()}: corre node app/inicio/preparar-motor.mjs --motor codex o pasa --programas <carpeta> (AIA_PROGRAMAS_DIR).`);
    if (!falso) {
      if (!rutas.esHomeDelUsuario(rutas.carpetasCodex().home)) throw new Error('El CODEX_HOME no es ~/.codex: no sigo.');
      corrida.codex = { via: bin.via };
      const cuenta = await ctx.lib.appServer.consultarCuenta().catch(() => null);
      if (!cuenta) throw new Error('No hay sesión de ChatGPT en ~/.codex (o no se pudo leer la cuenta): no sigo.');
      corrida.plan = cuenta.plan || null;
    }

    // ---- la copia
    const c = crearCopia(copia);
    corrida.copiaArchivos = { archivos: c.archivos, sinCopiarPorSecretos: c.sinCopiar.length };
    corrida.productos = copiarProductos(copia);
    if (falso) corrida.muestras = copiarMuestras(copia);
    // los ajustes de esta app de prueba (en la copia no hay app/config.json: arranca vacia)
    escribirJSON(path.join(copia, 'temp', `_modo-prueba-${puerto}`, 'config.json'), {});
    avisar(`  copia lista: ${c.archivos} archivos (sin copiar por secretos: ${c.sinCopiar.length})`);

    // ---- la app de prueba (high, el de cada tarea)
    const envApp = (extra = {}) => {
      const env = { ...process.env };
      for (const k of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE_|CLAUDECODE$|KIE_|ELEVENLABS_|APIMART_|SUNO_|OPENAI_|CODEX_|AZURE_OPENAI_|AIA_|ANUNCIOS_|FALSO_|HUMO_|NODE_USE_ENV_PROXY$|HTTPS?_PROXY$|ALL_PROXY$|NO_PROXY$|PUERTO$)/i.test(k)) delete env[k];
      Object.assign(env, { ANUNCIOS_MODO_PRUEBA: '1', ANUNCIOS_PRUEBA_LIMPIO: '1', ANUNCIOS_NO_RETOMAR: '1', AIA_MOTOR: 'codex', AIA_CODEX_HOME: process.env.AIA_CODEX_HOME });
      if (process.env.AIA_PROGRAMAS_DIR) env.AIA_PROGRAMAS_DIR = process.env.AIA_PROGRAMAS_DIR;
      if (falso) Object.assign(env, { ANUNCIOS_CODEX_BIN: process.env.ANUNCIOS_CODEX_BIN, FALSO_CODEX_SESION: 'ok', HUMO_REGISTRO: codexFalso.humo, FALSO_ARGS: codexFalso.args });
      return { ...env, ...extra };
    };
    const arrancar = async (extra, nombre) => {
      const app = await arrancarApp({ copia, puerto, env: envApp(extra), log: path.join(base, `app-${nombre}.log`) });
      if (!app.arriba) {
        await app.cerrar();
        const cola = (() => {
          try {
            return fs.readFileSync(path.join(base, `app-${nombre}.log`), 'utf8').slice(-1500);
          } catch {
            return '';
          }
        })();
        throw new Error(`La app de prueba no arrancó en el puerto ${puerto}${app.salio() ? ` (se cerró: ${JSON.stringify(app.salio())})` : ''}: ${cola}`);
      }
      const est = (await app.pedir('/api/ia/estado').catch(() => null))?.datos;
      if (est?.elegido !== 'codex' || est?.motores?.codex?.instalado !== true || est?.motores?.codex?.sesion !== 'ok') {
        await app.cerrar();
        throw new Error(`La app de prueba no ve a ChatGPT listo: ${JSON.stringify({ elegido: est?.elegido, codex: est?.motores?.codex }).slice(0, 400)}`);
      }
      avisar(`  app de prueba arriba (${nombre}) en ${app.base}`);
      return app;
    };
    const modoPruebaDe = async () => (await ctx.app.pedir('/api/estado', { ms: 60000 }).catch(() => null))?.datos?.modoPrueba || null;

    if (p2Lista.length) {
      ctx.app = await arrancar({}, 'high');
      avisar('');
      avisar(`P2 · el guion de ${p2Lista.length} estilo(s)${paraP3.length ? ` (${paraP3.join(', ')} solo para P3)` : ''}`);
      await enParalelo(p2Lista, aLaVez, async (def) => {
        if (ctx.parado) {
          ctx.informe.p2[def.clave] = { clave: def.clave, ok: false, omitido: ctx.parado, fecha: ahora() };
          return guardar();
        }
        let res;
        try {
          res = await correrUnGuion(ctx, def, { fase: 'p2' });
        } catch (e) {
          res = { clave: def.clave, ok: false, error: `se cayó la prueba: ${e?.stack || e}`.slice(0, 800) };
        }
        if (paraP3.includes(def.clave)) res.paraP3 = true;
        ctx.informe.p2[def.clave] = res;
        guardar();
      });

      if (p3Lista.length) {
        avisar('');
        avisar(`P3 · cambios al guion de ${p3Lista.join(', ')}`);
        await enParalelo(p3Lista, aLaVez, async (clave) => {
          let res;
          if (ctx.parado) res = { clave, ok: false, omitido: ctx.parado };
          else {
            try {
              res = await correrUnCambio(ctx, clave, ctx.informe.p2[clave]);
            } catch (e) {
              res = { clave, ok: false, error: `se cayó la prueba: ${e?.stack || e}`.slice(0, 800) };
            }
          }
          ctx.informe.p3[clave] = res;
          guardar();
        });
      }
      corrida.modoPrueba = await modoPruebaDe();
      await ctx.app.cerrar();
      ctx.app = null;
    }

    if (mediumLista.length && !ctx.parado) {
      avisar('');
      avisar(`Esfuerzo medium · ${mediumLista.map((e) => e.clave).join(', ')} (AIA_CODEX_ESFUERZO=medium)`);
      ctx.app = await arrancar({ AIA_CODEX_ESFUERZO: 'medium' }, 'medium');
      await enParalelo(mediumLista, aLaVez, async (def) => {
        let res;
        if (ctx.parado) res = { clave: def.clave, ok: false, omitido: ctx.parado };
        else {
          try {
            res = await correrUnGuion(ctx, def, { fase: 'medium' });
          } catch (e) {
            res = { clave: def.clave, ok: false, error: `se cayó la prueba: ${e?.stack || e}`.slice(0, 800) };
          }
          // el esfuerzo de verdad (lo que llego a Codex en -c model_reasoning_effort)
          res.esfuerzoUsado = res.esfuerzo;
          if (res.ok && !(res.esfuerzo || []).every((x) => x === 'medium')) {
            res.ok = false;
            res.error = `el esfuerzo que llegó a Codex fue ${JSON.stringify(res.esfuerzo)}, no medium`;
          }
          const alto = ctx.informe.p2[def.clave];
          if (alto?.minutos != null) res.contraHigh = { minutosHigh: alto.minutos, minutosMedium: res.minutos, tokensHigh: alto.tokens, tokensMedium: res.tokens, correccionesHigh: alto.correcciones, correccionesMedium: res.correcciones };
        }
        ctx.informe.medium[def.clave] = res;
        guardar();
      });
      corrida.modoPruebaMedium = await modoPruebaDe();
      await ctx.app.cerrar();
      ctx.app = null;
    } else if (mediumLista.length) {
      for (const def of mediumLista) ctx.informe.medium[def.clave] = { clave: def.clave, ok: false, omitido: ctx.parado };
    }

    // ---- el guion en los cantados no pide la cancion (y en modo prueba Suno va al simulador)
    const cantados = ['musical', 'historias-musicales'].map((k) => ctx.informe.p2[k]).filter((x) => x?.slug);
    if (cantados.length) {
      ctx.informe.cantados = {
        nota: 'El paso del guion del musical solo escribe app/letras.json, y el de la historia musical cancion/peticion.json y app/guion.json: ninguno llama a Suno. La canción se pide recién al aprobar (familias/musical.js), y esta prueba no aprueba. Además, en modo prueba Suno va al kie simulado y la guardia corta cualquier salida.',
        porEstilo: Object.fromEntries(cantados.map((x) => [x.clave, x.cancion || null])),
        salidasBloqueadas: corrida.modoPrueba?.salidasBloqueadas ?? null,
      };
    }

    // ---- lo que vio el Codex falso
    if (falso) {
      const msj = lineasJSONL(codexFalso.humo).filter((x) => x.tipo === 'codex-exec' || x.tipo === 'codex-resume');
      const malos = msj.filter((x) => !x.ok);
      ctx.informe.falso = {
        mensajes: msj.length,
        conProblemas: malos.length,
        problemas: malos.slice(0, 8).map((x) => ({ tipo: x.tipo, tarea: String(x.tarea || '').slice(0, 60), problemas: x.problemas })),
        materialFaltante: msj.filter((x) => (x.materialFaltante || []).length).slice(0, 8).map((x) => ({ tarea: String(x.tarea || '').slice(0, 60), falta: x.materialFaltante })),
        conClaves: msj.filter((x) => x.conSecreto || (x.envProhibidas || []).length).length,
      };
    }

    ctx.informe.claude = minutosDeClaude();
    ctx.informe.parado = ctx.parado || null;
  } catch (e) {
    corrida.error = String(e?.message || e);
    avisar(`\nNo pude seguir: ${corrida.error}`);
  } finally {
    process.removeListener('SIGINT', alCortar);
    await limpiar();
    corrida.fin = ahora();
    if (ctx.parado) corrida.parado = ctx.parado;
    guardar();
  }

  // ---- el resumen
  const inf = ctx.informe;
  imprimirTabla(inf.tabla, avisar);
  const deEsta = (sec, claves) => claves.map((k) => inf[sec][k]).filter(Boolean);
  const todos = [...deEsta('p2', p2Lista.map((e) => e.clave)), ...deEsta('p3', p3Lista), ...deEsta('medium', mediumLista.map((e) => e.clave))];
  const ok = !corrida.error && !ctx.parado && todos.length === p2Lista.length + p3Lista.length + mediumLista.length && todos.every((x) => x.ok);
  avisar('');
  if (p3Lista.length) for (const k of p3Lista) avisar(`P3 ${k}: ${inf.p3[k]?.ok ? 'bien' : 'MAL'}${inf.p3[k]?.omitido ? ` (${inf.p3[k].omitido})` : ''}`);
  if (!falso && inf.hilos.length) avisar(`Hilos de Codex creados en ~/.codex (en informe.hilos, para borrarlos a mano): ${inf.hilos.length}`);
  if (ctx.parado) avisar(ctx.parado);
  avisar(`Copia: ${corrida.copiaBorrada === true ? 'borrada' : corrida.copiaBorrada}`);
  avisar(`Informe: ${path.join(salida, 'informe.json')}`);
  avisar(`${ok ? 'Todo bien.' : 'Algo no salió: mira el informe.'}`);
  return { ok, informe: inf, ruta: path.join(salida, 'informe.json'), parado: ctx.parado || null };
}

// ---------------------------------------------------------------- suelta

const esDirecto = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esDirecto) {
  const a = process.argv.slice(2);
  if (a.includes('--ayuda') || a.includes('-h')) {
    console.log('Uso: node app/herramientas/codex/tareas-guiones.mjs [--home-usuario] [--puntos p2,p3,medium] [--solo <estilo>[,…]] [--esfuerzo medium] [--a-la-vez 1|2] [--salida <dir>] [--copia <dir>] [--programas <dir>] [--conservar]');
    console.log(`Estilos: ${CLAVES.join(', ')}`);
    process.exit(0);
  }
  try {
    const r = await correrGuiones({ homeUsuario: a.includes('--home-usuario'), puntos: argumento('--puntos') || undefined, solo: argumento('--solo') || undefined, esfuerzo: argumento('--esfuerzo') || undefined });
    process.exit(r.ok ? 0 : 1);
  } catch (e) {
    console.log(String(e?.message || e));
    process.exit(1);
  }
}

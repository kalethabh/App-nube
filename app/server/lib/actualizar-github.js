// Actualizar desde GitHub: el botón "Actualizar" de la barra de arriba baja lo último del repositorio de la app.
//
//   revisar()     -> { repositorio, rama, atrasados, adelantados, ultimo: { titulo, fecha } | null, error? }
//                    (git fetch: solo pregunta, no cambia nada)
//   actualizar()  -> { ok, cambios, reabrir, mensaje } | { ok: false, mensaje }
//
// Antes de bajar, guarda lo tuyo (el mismo guardado de cada 2 minutos: lib/guardado.js), así lo de tus anuncios nunca
// choca con lo nuevo. Después junta lo del repositorio (git pull, sin reescribir nada), instala lo que haga falta si
// cambiaron las dependencias y vuelve a armar la interfaz. Si cambió el servidor o el motor, avisa que hay que cerrar
// la ventana de la app y volver a abrirla. Nunca borra nada tuyo: si algo choca, lo deja como estaba y lo dice.
import { motivoParaNoReiniciar, reiniciar } from './version.js';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { RAIZ, APP } from './rutas.js';
import { guardarAhora } from './guardado.js';
import { EN_SERVIDOR } from './servidor.js';
import { interfazVieja, rearmarInterfaz } from './interfaz.js';

function correr(cmd, args, { cwd = RAIZ, ms = 180000 } = {}) {
  return new Promise((ok) => {
    let salida = '';
    let p;
    try {
      p = spawn(cmd, args, { cwd, windowsHide: true, shell: process.platform === 'win32' && cmd === 'npm', env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' } });
    } catch (e) {
      return ok({ ok: false, salida: String(e.message || e) });
    }
    const t = setTimeout(() => p.kill(), ms);
    p.stdout.on('data', (d) => (salida += d));
    p.stderr.on('data', (d) => (salida += d));
    p.on('error', (e) => {
      clearTimeout(t);
      ok({ ok: false, salida: String(e.message || e) });
    });
    p.on('close', (codigo) => {
      clearTimeout(t);
      ok({ ok: codigo === 0, salida: salida.trim() });
    });
  });
}
const git = (args, ms) => correr('git', args, { ms });

let ocupado = false;

async function rama() {
  const r = await git(['rev-parse', '--abbrev-ref', 'HEAD']);
  return r.ok && r.salida && r.salida !== 'HEAD' ? r.salida : null;
}

// Lo PUBLICADO vive siempre en main (ahí se unen los cambios). Antes se comparaba contra la rama en la que estaba la
// carpeta: si la Mac había quedado en otra rama (p. ej. una de trabajo vieja), lo publicado en main nunca aparecía en
// «Actualizar». Ahora se compara y se baja siempre main, esté la carpeta en la rama que esté.
const PUBLICADA = process.env.KADS_RAMA_PUBLICADA || 'main';

// La última respuesta de revisar(), para no ir a GitHub más de una vez por minuto con varias pestañas abiertas.
let ultimaRevision = null;
const VIGENCIA_REVISION_MS = 60 * 1000;

/** revisar() con memoria de un minuto; `forzar` (abrir «Actualizar») va a GitHub siempre. */
export async function revisarConMemoria({ forzar = false } = {}) {
  if (!forzar && ultimaRevision && Date.now() - ultimaRevision.t < VIGENCIA_REVISION_MS) return ultimaRevision.r;
  const r = await revisar();
  ultimaRevision = { t: Date.now(), r };
  return r;
}

/** Pregunta a GitHub si hay algo nuevo publicado (no cambia nada). */
export async function revisar() {
  if (!fs.existsSync(path.join(RAIZ, '.git'))) return { repositorio: false, error: 'Esta carpeta no es un repositorio de GitHub: clónala desde GitHub para poder actualizarla con un clic.' };
  const r = await rama();
  if (!r) return { repositorio: true, error: 'No sé en qué rama está la app.' };
  // (con refspec explícito: así se actualiza origin/main aunque la carpeta se haya clonado con una sola rama)
  const f = await git(['fetch', '-q', 'origin', `+refs/heads/${PUBLICADA}:refs/remotes/origin/${PUBLICADA}`], 120000);
  if (!f.ok) return { repositorio: true, rama: r, publicada: PUBLICADA, error: 'No pude conectar con GitHub. Revisa tu internet y vuelve a probar.' };
  const cuenta = await git(['rev-list', '--left-right', '--count', `HEAD...origin/${PUBLICADA}`]);
  const [adelantados, atrasados] = cuenta.ok ? cuenta.salida.split(/\s+/).map(Number) : [0, 0];
  const u = await git(['log', '-1', '--format=%s%x1f%cI', `origin/${PUBLICADA}`]);
  const [titulo, fecha] = u.ok ? u.salida.split('\x1f') : [];
  return { repositorio: true, rama: r, publicada: PUBLICADA, atrasados: atrasados || 0, adelantados: adelantados || 0, ultimo: titulo ? { titulo, fecha } : null, pantallaSinArmar: interfazVieja(), revisado: new Date().toISOString() };
}

/** Baja lo último. Nunca corren dos a la vez. */
export async function actualizar() {
  if (ocupado) return { ok: false, mensaje: 'Ya se está actualizando. Espera unos segundos.' };
  ocupado = true;
  try {
    const antes = await revisar();
    if (antes.error) return { ok: false, mensaje: antes.error };
    if (!antes.atrasados) {
      // lo nuevo ya bajó (el guardado automático junta lo de GitHub) pero la pantalla quedó sin armar
      if (interfazVieja()) {
        const bien = await rearmarInterfaz();
        return bien
          ? { ok: true, cambios: 0, reabrir: false, recargar: true, mensaje: 'Ya tenías lo último, pero faltaba armar la pantalla nueva. Listo: recarga la página para verla.' }
          : { ok: false, mensaje: 'No pude armar la pantalla nueva. Cierra la ventana de la app y vuelve a abrirla: el lanzador la arma solo.' };
      }
      return { ok: true, cambios: 0, reabrir: false, mensaje: 'Ya tienes lo último: no hay nada nuevo en GitHub.' };
    }

    // lo tuyo primero (guiones, ajustes, aprendizajes…): así no choca con lo que baja
    await guardarAhora();
    const viejo = (await git(['rev-parse', 'HEAD'])).salida;
    const identidad = (await git(['config', 'user.email'])).ok ? [] : ['-c', 'user.name=Kads Studio', '-c', 'user.email=anuncios-ia@localhost'];
    // lo publicado (main) se junta con lo de aquí, esté la carpeta en la rama que esté
    const p = await git([...identidad, 'pull', '--no-rebase', '--no-edit', 'origin', PUBLICADA], 300000);
    if (!p.ok) {
      await git(['merge', '--abort']);
      return { ok: false, mensaje: 'Lo nuevo choca con un cambio que hiciste aquí, así que no toqué nada. Pídele a Claude Code que lo junte.', detalle: p.salida.slice(-400) };
    }
    const cambiados = (await git(['diff', '--name-only', viejo, 'HEAD'])).salida.split('\n').filter(Boolean);

    // dependencias nuevas y la interfaz armada de nuevo
    if (cambiados.some((f) => f === 'app/package-lock.json' || f === 'app/package.json')) await correr('npm', ['install', '--no-audit', '--no-fund'], { cwd: APP, ms: 600000 });
    if (cambiados.some((f) => f === 'remotion/package-lock.json' || f === 'remotion/package.json')) await correr('npm', ['install', '--no-audit', '--no-fund'], { cwd: path.join(RAIZ, 'remotion'), ms: 600000 });
    let interfaz = true;
    if (cambiados.some((f) => f.startsWith('app/src/') || f === 'app/index.html' || f.startsWith('app/public/') || f.startsWith('app/vite'))) {
      interfaz = await rearmarInterfaz();
    }
    // el servidor que corre es el de antes: lo nuevo del servidor o del motor se usa al volver a abrir la app
    const reabrir = cambiados.some((f) => f.startsWith('app/server/') || f.startsWith('produccion/') || f.startsWith('app/inicio/') || /^app\/package/.test(f));
    const n = antes.atrasados;
    // en el servidor no hay ventana que cerrar: la app se reinicia sola (el servicio la vuelve a levantar)
    // en tu computador también se reinicia sola, la haya abierto el lanzador o no (lib/version.js)
    if (reabrir && !EN_SERVIDOR && reiniciar()) {
      return { ok: true, cambios: n, reabrir: false, reinicia: true, mensaje: `Listo: ${n} ${n === 1 ? 'cambio nuevo' : 'cambios nuevos'}. La app se reinicia sola y la página se recarga en unos segundos.` };
    }
    if (reabrir && EN_SERVIDOR) {
      setTimeout(() => process.exit(0), 1500).unref?.();
      return { ok: true, cambios: n, reabrir: false, reinicia: true, mensaje: `Listo: ${n} ${n === 1 ? 'cambio nuevo' : 'cambios nuevos'}. La app se reinicia sola: recarga la página en unos 20 segundos.` };
    }
    return {
      ok: true,
      cambios: n,
      reabrir,
      mensaje: !interfaz
        ? 'Bajé lo nuevo, pero no pude armar la interfaz. Cierra la ventana de la app y vuelve a abrirla: el lanzador la arma solo.'
        : reabrir
          ? `Listo: ${n} ${n === 1 ? 'cambio nuevo' : 'cambios nuevos'}. ${motivoParaNoReiniciar() ? 'Hay un video produciéndose: cuando termine, toca «Reiniciar la app» en la franja de arriba.' : 'Para usarlos todos, cierra la ventana de la app (la ventana negra) y vuelve a abrirla.'}`
          : `Listo: ${n} ${n === 1 ? 'cambio nuevo' : 'cambios nuevos'}. Recarga la página para verlos.`,
    };
  } finally {
    ocupado = false;
    ultimaRevision = null; // lo que diga GitHub ahora ya es otra cosa
  }
}

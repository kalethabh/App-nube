// El TRABAJADOR que dibuja las imágenes de las plantillas (proceso hijo de larga vida; lo lanza ./render.js con la
// carpeta de trabajo en remotion/, porque Remotion busca ahí su navegador).
//
// Lo que lo hace rápido (pedido: «que no se tarde en generar»):
//   - el armado de Remotion (bundle) se hace UNA vez y queda guardado en .cache/plantillas-imagen/<huella>/, con la
//     huella del código de remotion/src/plantillas-imagen y la versión de Remotion: al abrir la app de nuevo no se arma
//     otra vez (solo si el código cambió);
//   - un solo navegador abierto (openBrowser) que se reutiliza en cada imagen (puppeteerInstance), y las composiciones
//     se leen una vez;
//   - varias imágenes a la vez, hasta la cantidad de núcleos del computador;
//   - las imágenes (producto, escena, logo) se sirven desde un servidor local chiquito, solo de la carpeta de la app.
// El navegador se cierra tras 15 minutos sin trabajo (para no ocupar memoria) y se vuelve a abrir en medio segundo.
//
// Mensajes (IPC): { tipo: 'render', id, composicion, props, salida } -> { id, ok, ms, error? }
//                 { tipo: 'calentar', id } -> { id, ok, ms, armado: 'cache'|'nuevo' }
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const RAIZ = process.env.ANUNCIOS_RAIZ || path.resolve(process.cwd(), '..');
const DIR_REMOTION = path.join(RAIZ, 'remotion');
const DIR_PLANTILLAS = path.join(DIR_REMOTION, 'src', 'plantillas-imagen');
const DIR_CACHE = path.join(RAIZ, '.cache', 'plantillas-imagen');
const req = createRequire(path.join(DIR_REMOTION, 'package.json'));
const A_LA_VEZ = Math.max(1, Math.min(Number(process.env.PLANTILLAS_A_LA_VEZ) || os.cpus().length || 2, 8));
const OCIOSO_MS = 15 * 60000;

const ahora = () => performance.now();
const enviar = (m) => {
  try {
    process.send?.(m);
  } catch {
    /* el padre se fue */
  }
};

// ---------------------------------------------------------------- el armado (una vez, guardado)

function huellaDelCodigo() {
  const h = crypto.createHash('sha1');
  const visitar = (dir) => {
    for (const n of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dir, n.name);
      if (n.isDirectory()) visitar(abs);
      else if (n.isFile()) {
        h.update(path.relative(DIR_PLANTILLAS, abs));
        h.update(fs.readFileSync(abs));
      }
    }
  };
  visitar(DIR_PLANTILLAS);
  try {
    h.update(JSON.parse(fs.readFileSync(req.resolve('@remotion/renderer/package.json'), 'utf8')).version);
  } catch {
    /* sin versión: igual sirve */
  }
  return h.digest('hex').slice(0, 16);
}

let armado = null; // Promise<{ serveUrl, nuevo }>
function armar() {
  if (armado) return armado;
  armado = (async () => {
    const huella = huellaDelCodigo();
    const destino = path.join(DIR_CACHE, huella);
    if (fs.existsSync(path.join(destino, 'index.html'))) return { serveUrl: destino, nuevo: false };
    const { bundle } = req('@remotion/bundler');
    const tmp = path.join(DIR_CACHE, `.armando-${process.pid}-${Date.now()}`);
    fs.mkdirSync(DIR_CACHE, { recursive: true });
    await bundle({ entryPoint: path.join(DIR_PLANTILLAS, 'entrada.jsx'), publicDir: path.join(DIR_PLANTILLAS, 'publico'), outDir: tmp });
    try {
      fs.renameSync(tmp, destino);
    } catch {
      // otro proceso lo dejó primero: se usa ese
      fs.rmSync(tmp, { recursive: true, force: true });
    }
    // los armados viejos se borran
    for (const n of fs.readdirSync(DIR_CACHE)) if (n !== huella && !n.startsWith('.armando')) fs.rmSync(path.join(DIR_CACHE, n), { recursive: true, force: true });
    return { serveUrl: destino, nuevo: true };
  })().catch((e) => {
    armado = null;
    throw e;
  });
  return armado;
}

// ---------------------------------------------------------------- el servidor de las imágenes

const TIPOS = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const ficha = crypto.randomBytes(12).toString('hex');
let servidor = null; // Promise<puerto>
function servir() {
  if (servidor) return servidor;
  servidor = new Promise((resolve, reject) => {
    const s = http.createServer((rq, rs) => {
      try {
        const u = new URL(rq.url, 'http://x');
        const [, f, ...resto] = u.pathname.split('/');
        const abs = path.resolve(decodeURIComponent(resto.join('/')));
        const rel = path.relative(RAIZ, abs);
        const tipo = TIPOS[path.extname(abs).toLowerCase()];
        if (f !== ficha || !tipo || rel.startsWith('..') || path.isAbsolute(rel) || !fs.statSync(abs).isFile()) {
          rs.writeHead(404).end();
          return;
        }
        rs.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': 'max-age=3600', 'Access-Control-Allow-Origin': '*' });
        fs.createReadStream(abs).pipe(rs);
      } catch {
        rs.writeHead(404).end();
      }
    });
    s.listen(0, '127.0.0.1', () => resolve(s.address().port));
    s.on('error', reject);
  });
  return servidor;
}

/** Una ruta del disco -> la URL del servidor local (con la fecha: si el archivo cambia, el navegador no usa la vieja). */
function urlDe(puerto, abs) {
  let v = '0';
  try {
    v = String(Math.round(fs.statSync(abs).mtimeMs));
  } catch {
    /* sin archivo: el navegador no la encuentra y la plantilla sigue */
  }
  return `http://127.0.0.1:${puerto}/${ficha}/${encodeURIComponent(abs)}?v=${v}`;
}

// ---------------------------------------------------------------- el navegador y las composiciones

let navegador = null; // Promise<browser>
let composiciones = null; // Promise<Map>
let temporizador = null;

function abrirNavegador() {
  if (!navegador) {
    const { openBrowser } = req('@remotion/renderer');
    navegador = openBrowser('chrome', { logLevel: 'error' }).catch((e) => {
      navegador = null;
      throw e;
    });
  }
  return navegador;
}

async function cerrarNavegador() {
  const n = navegador;
  navegador = null;
  composiciones = null;
  if (n) await (await n.catch(() => null))?.close({ silent: true }).catch(() => {});
}

function leerComposiciones(serveUrl, browser) {
  if (!composiciones) {
    const { getCompositions } = req('@remotion/renderer');
    composiciones = getCompositions(serveUrl, { puppeteerInstance: browser, logLevel: 'error' })
      .then((lista) => new Map(lista.map((c) => [c.id, c])))
      .catch((e) => {
        composiciones = null;
        throw e;
      });
  }
  return composiciones;
}

function tocar() {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    if (!enMarcha) cerrarNavegador();
  }, OCIOSO_MS);
  temporizador.unref?.();
}

// ---------------------------------------------------------------- dibujar

let enMarcha = 0;
const cola = [];

async function dibujar({ composicion, props, salida }) {
  const t0 = ahora();
  const { serveUrl } = await armar();
  const puerto = await servir();
  const browser = await abrirNavegador();
  const comps = await leerComposiciones(serveUrl, browser);
  const comp = comps.get(composicion);
  if (!comp) throw new Error(`No existe la composición ${composicion}.`);
  // las rutas del disco pasan a URL del servidor local
  const p = structuredClone(props || {});
  for (const k of ['producto', 'escena', 'logo']) if (p[k]?.archivo) p[k] = { ...p[k], url: urlDe(puerto, p[k].archivo), archivo: undefined };
  const { renderStill } = req('@remotion/renderer');
  fs.mkdirSync(path.dirname(salida), { recursive: true });
  const tmp = `${salida}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.png`;
  try {
    await renderStill({
      serveUrl,
      composition: { ...comp, props: p },
      inputProps: p,
      output: tmp,
      frame: 0,
      imageFormat: 'png',
      overwrite: true,
      puppeteerInstance: browser,
      logLevel: 'error',
      timeoutInMilliseconds: 30000,
    });
    fs.renameSync(tmp, salida);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    // el navegador pudo haberse caído: la próxima vez se abre otro
    if (/Target closed|Browser closed|Protocol error|disconnected/i.test(String(e?.message || e))) await cerrarNavegador();
    throw e;
  }
  return Math.round(ahora() - t0);
}

function seguir() {
  while (enMarcha < A_LA_VEZ && cola.length) {
    const m = cola.shift();
    enMarcha++;
    dibujar(m)
      .then((ms) => enviar({ id: m.id, ok: true, ms }))
      .catch((e) => enviar({ id: m.id, ok: false, error: String(e?.message || e).slice(0, 600) }))
      .finally(() => {
        enMarcha--;
        tocar();
        seguir();
      });
  }
}

process.on('message', async (m) => {
  if (!m || typeof m !== 'object') return;
  if (m.tipo === 'render') {
    cola.push(m);
    seguir();
  } else if (m.tipo === 'calentar') {
    const t0 = ahora();
    try {
      const a = await armar();
      await servir();
      const b = await abrirNavegador();
      await leerComposiciones(a.serveUrl, b);
      tocar();
      enviar({ id: m.id, ok: true, ms: Math.round(ahora() - t0), armado: a.nuevo ? 'nuevo' : 'cache', aLaVez: A_LA_VEZ });
    } catch (e) {
      enviar({ id: m.id, ok: false, error: String(e?.message || e).slice(0, 600) });
    }
  }
});

// si la app se cierra, este proceso también
process.on('disconnect', () => {
  cerrarNavegador().finally(() => process.exit(0));
});

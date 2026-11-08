// Ajustes de la app y la revision de la PC.
//
// GET /api/ajustes               -> preferencias, si ya se vio la bienvenida, la marca y la version, y "Tu PC"
// POST /api/ajustes/revisar       -> "Volver a revisar": la proxima lectura de "Tu PC" mide todo de nuevo
// PUT /api/ajustes/preferencias  -> { idioma, mercado, subtitulos, aLaVez } (solo lo que cambia)
// PUT /api/ajustes/bienvenida    -> { vista: true | false }
//
// Todo se guarda en app/config.json. Las claves NO pasan por aca: van al .env de la raiz con
// PUT /api/claves (rutas/claves.js), y el saldo de kie sale de GET /api/saldo.
// "Tu PC" se lee con node:os y fs.statfs, y los programas que usa el motor se buscan en el PATH y en la carpeta
// donde los instala el lanzador (lib/programas.js): solo se corren "ffmpeg -encoders" y una linea de Python para ver
// sus paquetes (gratis, local, sin internet). Se guarda 1 minuto.
// Nada sensible en la respuesta: ni rutas de carpetas, ni la direccion de la app, ni IPs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { APP, RAIZ, TEMP } from '../lib/rutas.js';
import { leerJSON, existe } from '../lib/archivos.js';
import { leerConfig, guardarConfig } from '../lib/config.js';
import { slugsDeAnuncios } from '../lib/anuncios.js';
import { MAX_A_LA_VEZ } from '../lib/conductor.js';
import { anunciosALaVez } from '../lib/colas.js';
import { revisarPython, revisarVideo } from '../lib/programas.js';
import { olvidarClaude, resolverClaude } from '../lib/claude.js';

// ---------------------------------------------------------------- preferencias

const IDIOMAS = ['es', 'en', 'pt'];
const MERCADOS = ['LatAm', 'US', 'BR'];
// Los 10 estilos de subtitulos del editor, con los mismos ids (src/pantallas/editor/subtitulos/estilos.jsx).
// "caja" es el de siempre. "clave-emoji" era el id viejo de "claves": se acepta y queda como "claves".
const SUBTITULOS = ['caja', 'pop', 'gigante', 'karaoke', 'creador', 'degradado', 'de-a-una', 'limpio', 'barra', 'claves'];
const SUBTITULOS_VIEJOS = { 'clave-emoji': 'claves' };
const A_LA_VEZ = ['auto', 1, 2, 3, 4, 5, 6];

const PREFERENCIAS_POR_DEFECTO = { idioma: 'es', mercado: 'LatAm', subtitulos: 'caja', aLaVez: 'auto' };

function preferencias(config) {
  const p = { ...PREFERENCIAS_POR_DEFECTO, ...(config.preferencias && typeof config.preferencias === 'object' ? config.preferencias : {}) };
  if (!IDIOMAS.includes(p.idioma)) p.idioma = PREFERENCIAS_POR_DEFECTO.idioma;
  if (!MERCADOS.includes(p.mercado)) p.mercado = PREFERENCIAS_POR_DEFECTO.mercado;
  if (SUBTITULOS_VIEJOS[p.subtitulos]) p.subtitulos = SUBTITULOS_VIEJOS[p.subtitulos];
  if (!SUBTITULOS.includes(p.subtitulos)) p.subtitulos = PREFERENCIAS_POR_DEFECTO.subtitulos;
  if (!A_LA_VEZ.includes(p.aLaVez)) p.aLaVez = PREFERENCIAS_POR_DEFECTO.aLaVez;
  return { idioma: p.idioma, mercado: p.mercado, subtitulos: p.subtitulos, aLaVez: p.aLaVez };
}

// ---------------------------------------------------------------- Tu PC

const GB = 1024 ** 3;

function nombreDelSistema() {
  if (process.platform === 'win32') {
    // os.version() dice "Windows 10" en algunos Windows 11: el numero de compilacion manda.
    const compilacion = Number(String(os.release()).split('.')[2] || 0);
    const v = os.version() || 'Windows';
    return compilacion >= 22000 ? v.replace(/Windows 10/, 'Windows 11') : v;
  }
  if (process.platform === 'darwin') return `macOS ${os.release()}`;
  return os.version() || os.type();
}

function disco() {
  try {
    const s = fs.statfsSync(RAIZ);
    return {
      unidad: process.platform === 'win32' ? path.parse(RAIZ).root.replace(/\\$/, '') : path.parse(RAIZ).root,
      libre: s.bavail * s.bsize,
      total: s.blocks * s.bsize,
    };
  } catch {
    return null;
  }
}

/** El navegador con el que Remotion arma el video final (lo baja la primera vez). */
function navegadorDelRender() {
  return existe(path.join(RAIZ, 'remotion', 'node_modules', '.remotion', 'chrome-headless-shell'));
}

/** Remotion, el que arma el video final y el editor (lo instala el lanzador en remotion/node_modules). */
function remotionInstalado() {
  return existe(path.join(RAIZ, 'remotion', 'node_modules', 'remotion', 'package.json'));
}

/**
 * Lo que necesita la app para producir, revisado de verdad. Cada revision: { id, ok, obligatorio, ... }.
 *   obligatorio: false = solo hace falta para algunas cosas (Python: el podcast con el host en la esquina, la
 *   entrevista y los iconos; VP9: el host en la esquina) o se resuelve solo (el navegador del render se baja la
 *   primera vez). Se guarda 1 minuto; "Volver a revisar" (POST /api/ajustes/revisar) mide de nuevo.
 */
let cacheRevisiones = null; // { t, valor, promesa }

function revisiones() {
  if (cacheRevisiones?.promesa) return cacheRevisiones.promesa;
  if (cacheRevisiones?.valor && Date.now() - cacheRevisiones.t < 60000) return Promise.resolve(cacheRevisiones.valor);
  const promesa = (async () => {
    const [video, python] = await Promise.all([revisarVideo(), revisarPython()]);
    const nodeVersion = process.versions.node;
    const [ma, mi] = nodeVersion.split('.').map(Number);
    const valor = [
      { id: 'node', ok: ma > 20 || (ma === 20 && mi >= 19), obligatorio: true, version: nodeVersion },
      { id: 'claude', ok: Boolean(resolverClaude()), obligatorio: true },
      { id: 'ffmpeg', ok: video.ffmpeg, obligatorio: true },
      { id: 'ffprobe', ok: video.ffprobe, obligatorio: true },
      { id: 'remotion', ok: remotionInstalado(), obligatorio: true },
      { id: 'navegador', ok: navegadorDelRender(), obligatorio: false },
      // sin ffmpeg no se sabe: ahi ya avisa la fila del programa de video
      { id: 'vp9', ok: video.vp9 !== false, obligatorio: false },
      { id: 'python', ok: python.ok, obligatorio: false, version: python.version, faltan: python.faltan, comando: python.ok ? null : python.comando, aviso: python.aviso || null },
    ];
    cacheRevisiones = { t: Date.now(), valor, promesa: null };
    return valor;
  })().catch(() => {
    cacheRevisiones = null;
    return [];
  });
  cacheRevisiones = { ...(cacheRevisiones || {}), promesa };
  return promesa;
}

// Cuanto ocupa en promedio un anuncio (las carpetas de temp/ que se muestran). Se calcula una vez
// cada 10 min recorriendo las carpetas (solo se leen tamanos).
let cacheTamano = null; // { t, valor, promesa }

async function tamanoCarpeta(dir, profundidad = 0) {
  if (profundidad > 6) return 0;
  let total = 0;
  let entradas = [];
  try {
    entradas = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entradas) {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) total += await tamanoCarpeta(ruta, profundidad + 1);
    else if (e.isFile()) {
      try {
        total += (await fs.promises.stat(ruta)).size;
      } catch {
        /* se borro mientras se medía */
      }
    }
  }
  return total;
}

function tamanoDeAnuncios() {
  if (cacheTamano?.valor && Date.now() - cacheTamano.t < 10 * 60 * 1000) return Promise.resolve(cacheTamano.valor);
  if (cacheTamano?.promesa) return cacheTamano.promesa;
  const promesa = (async () => {
    const slugs = slugsDeAnuncios();
    let total = 0;
    for (const s of slugs) total += await tamanoCarpeta(path.join(TEMP, s));
    const valor = { anuncios: slugs.length, total, promedio: slugs.length ? Math.round(total / slugs.length) : null };
    cacheTamano = { t: Date.now(), valor, promesa: null };
    return valor;
  })().catch(() => {
    cacheTamano = null;
    return null;
  });
  cacheTamano = { ...(cacheTamano || {}), promesa };
  return promesa;
}

/**
 * Cuantos anuncios a la vez. Las imagenes y los videos se hacen en internet (no cargan la PC);
 * lo que usa la PC es el armado final del video (el render), que va de a uno. La memoria y los
 * nucleos dicen cuanto aguanta sin trabarse; el disco, cuantos caben.
 */
function recomendar({ memoriaGB, nucleos, discoLibre, promedio }) {
  let n = 1;
  let motivo = 'Con menos de 12 GB de memoria conviene hacer un anuncio a la vez: el armado del video usa casi toda la memoria.';
  if (memoriaGB >= 32 && nucleos >= 12) {
    n = 5;
    motivo = 'Tienes memoria y núcleos de sobra: el armado final de cada video va rápido y los demás siguen avanzando mientras tanto.';
  } else if (memoriaGB >= 16 && nucleos >= 8) {
    n = 3;
    motivo = 'Tu PC aguanta bien tres a la vez. Con más, el armado final de los videos empieza a hacer fila.';
  } else if (memoriaGB >= 12) {
    n = 2;
    motivo = 'Dos a la vez es lo cómodo para tu memoria. Con más, el armado final de los videos se pone lento.';
  }
  let porDisco = null;
  if (discoLibre && promedio) {
    porDisco = Math.floor(discoLibre / (promedio * 1.5));
    if (porDisco < n) {
      n = Math.max(1, porDisco);
      motivo = 'Te queda poco espacio en el disco: libera espacio para hacer más anuncios a la vez.';
    }
  }
  return { aLaVez: n, motivo, caben: porDisco };
}

async function equipo() {
  const total = os.totalmem();
  const libre = os.freemem();
  const cpus = os.cpus() || [];
  const nucleos = typeof os.availableParallelism === 'function' ? os.availableParallelism() : cpus.length;
  const d = disco();
  // la medida de las carpetas no puede demorar la pantalla: si tarda, va sin ella
  const tamano = await Promise.race([tamanoDeAnuncios(), new Promise((r) => setTimeout(() => r(null), 3500))]);
  const memoriaGB = Math.round(total / GB);
  const lista = await revisiones();
  return {
    sistema: nombreDelSistema(),
    memoria: { total, libre, nominalGB: memoriaGB },
    procesador: { nucleos, modelo: String(cpus[0]?.model || '').replace(/\s+/g, ' ').trim() || null },
    disco: d,
    anuncios: tamano,
    revisiones: lista,
    // true si no falta nada obligatorio para producir
    listo: lista.length > 0 && lista.every((r) => r.ok || !r.obligatorio),
    recomendacion: recomendar({ memoriaGB, nucleos, discoLibre: d?.libre, promedio: tamano?.promedio }),
  };
}

// ---------------------------------------------------------------- version

function versionDe(archivo) {
  const p = leerJSON(archivo);
  return typeof p?.version === 'string' ? p.version : null;
}

/**
 * La version que se ve en "Acerca de". Los paquetes de alumnos traen un archivo VERSION
 * (p. ej. 2026-10-18b, la que compara el actualizador); la carpeta de Diego no, y ahi va la de la app.
 */
function versionVisible() {
  try {
    const v = fs.readFileSync(path.join(RAIZ, 'VERSION'), 'utf8').trim().split(/\r?\n/)[0].trim();
    if (v && /^[\w.+-]{1,40}$/.test(v)) return v;
  } catch {
    /* sin VERSION */
  }
  return versionDe(path.join(APP, 'package.json'));
}

// ---------------------------------------------------------------- rutas

export default function rutasAjustes(app) {
  app.get('/api/ajustes', async (req, res) => {
    const config = leerConfig();
    res.json({
      preferencias: preferencias(config),
      bienvenidaVista: config.bienvenidaVista === true,
      app: {
        nombre: 'anuncios-IA',
        autor: 'Kalethabh',
        version: versionVisible(),
      },
      equipo: await equipo(),
      // aLaVez: lo mas que la app hace a la vez (Tu PC elige de 1 a esto); ahora: cuantos van ahora (lo elegido, o lo
      // que aguanta la PC en automatico). Las preferencias todavia no se usan al producir: dicen "Muy pronto"
      produccion: { aLaVez: MAX_A_LA_VEZ, ahora: anunciosALaVez(), preferenciasEnUso: false },
    });
  });

  app.put('/api/ajustes/preferencias', (req, res) => {
    const cambios = req.body && typeof req.body === 'object' ? req.body : {};
    const actuales = preferencias(leerConfig());
    const nuevas = { ...actuales };
    if ('idioma' in cambios) {
      if (!IDIOMAS.includes(cambios.idioma)) return res.status(400).json({ error: 'Ese idioma no está disponible.' });
      nuevas.idioma = cambios.idioma;
    }
    if ('mercado' in cambios) {
      if (!MERCADOS.includes(cambios.mercado)) return res.status(400).json({ error: 'Ese mercado no está disponible.' });
      nuevas.mercado = cambios.mercado;
    }
    if ('subtitulos' in cambios) {
      if (SUBTITULOS_VIEJOS[cambios.subtitulos]) cambios.subtitulos = SUBTITULOS_VIEJOS[cambios.subtitulos];
      if (!SUBTITULOS.includes(cambios.subtitulos)) return res.status(400).json({ error: 'Ese estilo de subtítulos no existe.' });
      nuevas.subtitulos = cambios.subtitulos;
    }
    if ('aLaVez' in cambios) {
      const v = cambios.aLaVez === 'auto' ? 'auto' : Number(cambios.aLaVez);
      if (!A_LA_VEZ.includes(v)) return res.status(400).json({ error: 'Elige entre 1 y 6 anuncios a la vez, o automático.' });
      nuevas.aLaVez = v;
    }
    const config = guardarConfig({ preferencias: nuevas });
    res.json({ preferencias: preferencias(config) });
  });

  app.post('/api/ajustes/revisar', (req, res) => {
    if (!cacheRevisiones?.promesa) cacheRevisiones = null;
    olvidarClaude();
    res.json({ ok: true });
  });

  app.put('/api/ajustes/bienvenida', (req, res) => {
    const vista = req.body?.vista !== false;
    const config = guardarConfig({ bienvenidaVista: vista });
    res.json({ bienvenidaVista: config.bienvenidaVista === true });
  });
}

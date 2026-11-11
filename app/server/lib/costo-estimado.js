// El COSTO ESTIMADO antes de producir (excepcion a "sin precios", decision de Diego del 2026-11-09): antes de darle a
// "Me gusta, producir" (guion o letra listos), en la pausa de la cancion de los cantados, y en el formulario de los
// anuncios de imagen. Todo lo demas de la app sigue sin precios.
//
//   costoDelAnuncio(slug, { esperarMs, soloCache })   GET /api/anuncios/:slug/costo (rutas/costo.js) y, solo de la
//                                          cache, el costo por version de GET /api/anuncios/:slug/cancion (rutas/cancion.js)
//   costoDeImagenAds()                     el `costo` de GET /api/imagen-ads/opciones (rutas/imagen-ads.js)
//   costoDePiezas(slug)                    lo que cuesta regenerar cada pieza de un anuncio ya producido (el `costo`
//                                          de cada pieza en GET /api/anuncios/:slug/rehacer, rutas/editor.js)
//
// El numero sale del MOTOR (produccion/estimar-costo.js), corrido en un proceso aparte como el plan del saldo
// (correrSoloPlan en rutas/claves.js): la app NO importa produccion/ (config.js carga el .env y modelos-elegidos.js fija
// el catalogo al importarse). Sin red, sin claves y sin escribir nada. Se guarda por firma (los archivos del anuncio
// que cambian el numero, la eleccion, el catalogo, el modo prueba y el propio motor) y, si falla o tarda mas de
// TOPE_MS, la pantalla sigue como siempre: { disponible: false }. Nunca tira.
//
// La eleccion: la de Ajustes › Modelos si el anuncio todavia no tiene nada en img/ ni video/ (es la que va a usar:
// copiarModelosAlAnuncio se la copia al aprobarlo, y en los cantados otra vez al elegir la cancion), con la
// comparacion por modelo; si ya genero algo, la de su modelos.json y sin comparar (ya no se puede cambiar). Los
// nombres de categorias y opciones son los del catalogo, como en Ajustes (categoriasParaLaPantalla), salvo dos que en
// la tarjeta dirian otra cosa (nombreEnLaTarjeta).
//
// La forma de la respuesta esta documentada en rutas/costo.js.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { RAIZ, TEMP, DOLARES_POR_CREDITO } from './rutas.js';
import { leerJSON, stat, listar } from './archivos.js';
import { modoPrueba } from './procesos.js';
import { slugDeLaApp, leerConductor } from './conductor.js';
import { familiaDe, estadoGuion } from './anuncios-nuevos.js';
import { eleccionDeAjustes, eleccionDelAnuncio, hayAlgoGenerado, categoriasParaLaPantalla, nombreDeModelo } from './modelos.js';

const MOTOR = path.join(RAIZ, 'produccion', 'estimar-costo.js');
const RUTA_CATALOGO = path.join(RAIZ, 'produccion', 'catalogo-modelos.json');
const TOPE_MS = 30000; // el motor tarda menos de un segundo: si pasa de esto, algo anda mal y no se espera mas
const RECORDAR_FALLO_MS = 15000; // un fallo se recuerda un rato (no se lanza un proceso por cada pedido)
const MAXIMO_EN_CACHE = 40;
const CANTADOS = new Set(['musical', 'historia-musical']);
const PASO_PAUSA = 'elegir-cancion'; // familias/musical.js, PASO_PAUSA
/**
 * Lo que se sumaba por rehechos en un lote de anuncios de imagen (+17 % por la revision, +21 % con lo pedido). Desde
 * 2026-11-09 el lote ya no rehace nada solo (la revision solo marca «con detalles»): 0, un solo numero.
 */
const MARGEN_IMAGEN_ADS = 0;
// Los archivos del anuncio que cambian el estimado (si cambia su fecha o su tamano, se vuelve a calcular).
const ARCHIVOS_DE_LA_FIRMA = [
  'manifiesto.json',
  'modelos.json',
  'app/brief.json',
  'app/letras.json',
  'app/guion.json',
  'app/cancion-eleccion.json',
  'cancion/peticion.json',
  'cancion/opciones.json',
  'audio/tiempos.json',
  'audio/voz.mp3',
  'audio/cancion.json',
  'audio/cancion.mp3',
];

const r2 = (x) => Math.round(Number(x) * 100) / 100;
const marca = (ruta) => {
  const st = stat(ruta);
  return st ? `${Math.round(st.mtimeMs)}:${st.size}` : '-';
};
const NO_DISPONIBLE = (motivo) => ({ disponible: false, motivo });

// ---------------------------------------------------------------- el motor, en un proceso aparte

/** El entorno del motor: el de la app sin las claves (no le hacen falta: no pide nada a nadie). */
function entornoSinClaves() {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/(_API_KEY|_TOKEN|_SECRET)$/i.test(k)) delete env[k];
  return env;
}

/** Corre produccion/estimar-costo.js con --json y devuelve lo que imprimio (un objeto), o null si fallo o tardo. */
function correrMotor(slug, args) {
  return new Promise((resolve) => {
    let salida = '';
    let hijo;
    try {
      hijo = spawn(process.execPath, [MOTOR, `temp/${slug}`, '--json', ...args], { cwd: RAIZ, env: entornoSinClaves(), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    } catch {
      return resolve(null);
    }
    const reloj = setTimeout(() => hijo.kill(), TOPE_MS);
    hijo.stdout.on('data', (d) => (salida = (salida + d).slice(-2000000)));
    hijo.stderr.on('data', () => {});
    hijo.on('error', () => {});
    hijo.on('close', () => {
      clearTimeout(reloj);
      const linea = salida.trim().split(/\r?\n/).pop() || '';
      try {
        const r = JSON.parse(linea);
        resolve(r && typeof r === 'object' ? r : null);
      } catch {
        resolve(null);
      }
    });
  });
}

// ---------------------------------------------------------------- para la pantalla

/** "Omni Flash 1.1 y GPT Image 2.5" (sin repetir). */
function enPalabras(nombres) {
  const xs = [...new Set(nombres.filter(Boolean))];
  if (xs.length <= 1) return xs[0] || '';
  return `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`;
}

/**
 * El nombre de una categoria en la tarjeta del costo: el de Ajustes › Modelos, salvo dos que dentro de un anuncio
 * dirian otra cosa: el B-roll del podcast y la entrevista son «Imágenes de apoyo» (como en las notas del motor), y en
 * los cantados «Voz en off» son sus «Videos» (no tienen voz en off).
 */
function nombreEnLaTarjeta(def, familia) {
  if (def.id === 'brollHablado') return 'Imágenes de apoyo';
  if (def.id === 'vozEnOff' && CANTADOS.has(familia)) return 'Videos';
  return def.nombre;
}

/** Las categorias de la comparacion con los nombres del catalogo (como Ajustes), recomendado y elegida. */
function categoriasConNombres(comparar, cats, familia) {
  return (Array.isArray(comparar) ? comparar : [])
    .map((c) => {
      const def = c && cats.find((x) => x.id === c.categoria);
      if (!def) return null;
      const opciones = (Array.isArray(c.opciones) ? c.opciones : [])
        .map((o) => {
          const d = o && (def.opciones || []).find((x) => x.id === o.id);
          if (!d) return null;
          return { id: o.id, nombre: d.nombre, recomendado: d.recomendado === true, elegida: o.elegida === true, creditos: o.creditos, dolares: o.dolares, nota: o.nota || null };
        })
        .filter(Boolean);
      return opciones.length > 1 ? { id: def.id, nombre: nombreEnLaTarjeta(def, familia), elegida: c.elegida, opciones } : null;
    })
    .filter(Boolean);
}

/** Lo que imprime el motor -> la respuesta de GET /api/anuncios/:slug/costo (ver rutas/costo.js). */
function paraLaPantalla(r, { comparar, familia: familiaDelBrief }) {
  const cats = categoriasParaLaPantalla();
  const familia = r.familia || familiaDelBrief;
  const modelos = (Array.isArray(r.modelos) ? r.modelos : []).filter(Boolean).map((x) => {
    const def = cats.find((c) => c.id === x.categoria);
    return { categoria: x.categoria, nombreCategoria: def ? nombreEnLaTarjeta(def, familia) : x.nombreCategoria, opcion: x.opcion, nombre: (def?.opciones || []).find((o) => o.id === x.opcion)?.nombre || x.nombre };
  });
  const categorias = comparar ? categoriasConNombres(r.comparar, cats, familia) : [];
  return {
    disponible: true,
    fase: r.fase,
    familia: r.familia,
    estilo: r.estilo,
    modoPrueba: modoPrueba(),
    margen: r.margen,
    creditos: r.creditos,
    dolares: r.dolares,
    partes: (Array.isArray(r.partes) ? r.partes : []).filter(Boolean).map((p) => ({ id: p.id, nombre: p.nombre, creditos: p.creditos, dolares: p.dolares, piezas: p.piezas })),
    modelos,
    conModelos: enPalabras(modelos.map((x) => x.nombre)),
    elevenlabs: r.elevenlabs || null,
    notas: Array.isArray(r.notas) ? r.notas : [],
    ...(Number.isFinite(r.brollTotal) ? { brollProbables: r.brollProbables, brollTotal: r.brollTotal } : {}),
    ...(Number.isFinite(r.segundos) ? { segundos: r.segundos, segundosDe: r.segundosDe } : {}),
    ...(r.cancion ? { cancion: r.cancion } : {}),
    ...(r.video ? { video: r.video } : {}),
    comparaSobre: r.comparaSobre || 'total',
    puedeCambiar: comparar && categorias.length > 0,
    categorias,
    ...(Array.isArray(r.porCancion)
      ? {
          porCancion: r.porCancion.filter(Boolean).map((v) => ({
            n: v.n,
            segundos: v.segundos,
            creditos: v.creditos,
            dolares: v.dolares,
            ...(comparar ? { categorias: categoriasConNombres(v.comparar, cats, familia) } : {}),
          })),
        }
      : {}),
  };
}

// ---------------------------------------------------------------- cuando hay costo

/**
 * Si este anuncio tiene un costo que mostrar ahora: el guion (o la letra) listo para aprobar (tambien uno reabierto
 * despues de frenarse en su primer paso: estadoGuion lo dice con puedeAprobar), o la pausa de la cancion de los
 * cantados. { ok, familia, brief, pausa } o { ok: false, motivo }.
 */
function cuandoHayCosto(slug) {
  const carpeta = path.join(TEMP, slug);
  const brief = leerJSON(path.join(carpeta, 'app', 'brief.json'));
  if (!brief || brief.familia === 'imagen-ads') return { ok: false, motivo: 'no-aplica' };
  const familia = familiaDe(brief);
  if (!familia) return { ok: false, motivo: 'no-aplica' };
  const g = estadoGuion(slug);
  if (g?.puedeAprobar && !g.cambiando) return { ok: true, familia, brief, pausa: false };
  const c = leerConductor(slug);
  // ya aprobado: solo la pausa de la cancion de los cantados (todavia no hay nada en img/ ni video/)
  if (c && CANTADOS.has(c.familia) && c.paso === PASO_PAUSA) return { ok: true, familia, brief, pausa: true };
  return { ok: false, motivo: c || g?.aprobado ? 'en-produccion' : 'sin-guion' };
}

/** Los argumentos del motor y la firma para la cache. */
async function pedidoDe(slug, { familia, brief }) {
  const carpeta = path.join(TEMP, slug);
  const generado = hayAlgoGenerado(carpeta);
  const eleccion = generado ? eleccionDelAnuncio(slug) : eleccionDeAjustes();
  const comparar = !generado;
  let ganchos = false;
  if (familia === 'ugc') {
    try {
      ganchos = Boolean((await import('./familias/ugc.js')).pideGanchos?.(brief));
    } catch {
      ganchos = false;
    }
  }
  const args = ['--eleccion', JSON.stringify(eleccion)];
  if (comparar) args.push('--comparar');
  if (CANTADOS.has(familia)) args.push('--cancion');
  if (ganchos) args.push('--ganchos');
  if (familia === 'continuidad') args.push('--continuidad');
  const firma = JSON.stringify([
    ARCHIVOS_DE_LA_FIRMA.map((a) => marca(path.join(carpeta, a))),
    listar(path.join(carpeta, 'musica')).join('|'),
    args,
    modoPrueba(),
    marca(RUTA_CATALOGO),
    marca(MOTOR),
  ]);
  return { args, firma, comparar, familia };
}

const cache = new Map(); // slug -> { firma, valor, promesa, fallo }

function guardarEnCache(slug, entrada) {
  cache.delete(slug);
  cache.set(slug, entrada);
  while (cache.size > MAXIMO_EN_CACHE) cache.delete(cache.keys().next().value);
}

/**
 * El costo estimado de un anuncio para la pantalla, o null si el slug no es un anuncio de esta app. Con `esperarMs`,
 * si el calculo tarda mas que eso devuelve { disponible: false, motivo: 'calculando' } (y el calculo sigue: el
 * siguiente pedido lo encuentra hecho). Con `soloCache`, lo que ya este calculado para el anuncio como esta ahora, sin
 * lanzar el motor ni esperarlo ('calculando' si no esta). Nunca tira (ni deja una promesa rechazada sin atender).
 */
export async function costoDelAnuncio(slug, { esperarMs = TOPE_MS, soloCache = false } = {}) {
  try {
    if (!slugDeLaApp(slug)) return null;
    const cuando = cuandoHayCosto(slug);
    if (!cuando.ok) return NO_DISPONIBLE(cuando.motivo);
    const { args, firma, comparar, familia } = await pedidoDe(slug, cuando);
    let c = cache.get(slug);
    if (soloCache) return c?.firma === firma && c.valor ? c.valor : NO_DISPONIBLE(c?.firma === firma && c.fallo ? 'no-se-pudo' : 'calculando');
    if (c?.firma === firma && c.fallo && Date.now() - c.fallo < RECORDAR_FALLO_MS) return NO_DISPONIBLE('no-se-pudo');
    if (c?.firma !== firma || c.fallo) {
      // correrMotor nunca rechaza; si armar la respuesta falla (una salida rara del motor), es un fallo mas: null
      const promesa = correrMotor(slug, args).then((r) => {
        if (!r?.ok) return null;
        try {
          return paraLaPantalla(r, { comparar, familia });
        } catch (e) {
          console.error(`  [costo] ${slug}: ${e?.message || e}`);
          return null;
        }
      });
      c = { firma, promesa };
      guardarEnCache(slug, c);
      promesa
        .then((valor) => {
          if (cache.get(slug)?.promesa !== promesa) return;
          guardarEnCache(slug, valor ? { firma, valor } : { firma, fallo: Date.now() });
        })
        .catch(() => {});
    }
    if (c.valor) return c.valor;
    let reloj;
    const espera = new Promise((resolve) => {
      reloj = setTimeout(() => resolve('calculando'), Math.max(0, esperarMs));
    });
    const valor = await Promise.race([c.promesa, espera]);
    clearTimeout(reloj);
    if (valor === 'calculando') return NO_DISPONIBLE('calculando');
    return valor || NO_DISPONIBLE('no-se-pudo');
  } catch (e) {
    console.error(`  [costo] ${slug}: ${e?.message || e}`);
    return NO_DISPONIBLE('no-se-pudo');
  }
}

// ---------------------------------------------------------------- regenerar una pieza

const cachePiezas = new Map(); // slug -> { firma, valor, promesa, fallo }

/**
 * Lo que cuesta regenerar cada pieza de un anuncio ya producido (el «Regenerar · ≈ US$ 0,42» del proceso y del
 * editor), con los modelos del anuncio (su modelos.json): `estimar-costo.js --piezas`, en un proceso aparte y con
 * cache por firma (el manifiesto, los modelos, el catalogo y el motor). Devuelve
 *   { 'toma-3': { clip: { creditos, dolares }, imagen: {...}, conImagen: {...} }, ... }
 * o null si no se pudo (o si tarda mas de `esperarMs`: el calculo sigue y el proximo pedido lo encuentra hecho).
 * Nunca tira.
 */
export async function costoDePiezas(slug, { esperarMs = 2000 } = {}) {
  try {
    if (!slugDeLaApp(slug)) return null;
    const carpeta = path.join(TEMP, slug);
    const firma = JSON.stringify([['manifiesto.json', 'modelos.json', 'audio/tiempos.json'].map((a) => marca(path.join(carpeta, a))), marca(RUTA_CATALOGO), marca(MOTOR)]);
    let c = cachePiezas.get(slug);
    if (c?.firma === firma && c.valor) return c.valor;
    if (c?.firma === firma && c.fallo && Date.now() - c.fallo < RECORDAR_FALLO_MS) return null;
    if (c?.firma !== firma || c.fallo) {
      const promesa = correrMotor(slug, ['--piezas']).then((r) => (r?.ok && r.piezas && typeof r.piezas === 'object' ? r.piezas : null));
      c = { firma, promesa };
      cachePiezas.set(slug, c);
      while (cachePiezas.size > MAXIMO_EN_CACHE) cachePiezas.delete(cachePiezas.keys().next().value);
      promesa
        .then((valor) => {
          if (cachePiezas.get(slug)?.promesa === promesa) cachePiezas.set(slug, valor ? { firma, valor } : { firma, fallo: Date.now() });
        })
        .catch(() => {});
    }
    let reloj;
    const espera = new Promise((resolve) => {
      reloj = setTimeout(() => resolve(null), Math.max(0, esperarMs));
    });
    const valor = await Promise.race([c.promesa, espera]);
    clearTimeout(reloj);
    return valor || null;
  } catch (e) {
    console.error(`  [costo] ${slug}: ${e?.message || e}`);
    return null;
  }
}

// ---------------------------------------------------------------- anuncios de imagen

/**
 * El precio de cada imagen de un lote: el modelo es FIJO (GPT Image 2.5 a 2K; no sigue Ajustes › Modelos), asi que
 * no hay comparacion. La pantalla multiplica por la cantidad y los formatos. Sale de CREDITOS_POR_IMAGEN de la familia
 * y de DOLARES_POR_CREDITO (una sola fuente). null si no se pudo leer.
 */
export async function costoDeImagenAds() {
  try {
    const f = await import('./familias/imagen-ads.js');
    const creditos = Number(f.CREDITOS_POR_IMAGEN);
    if (!(creditos > 0)) return null;
    return {
      creditosPorImagen: creditos,
      dolaresPorImagen: r2(creditos * DOLARES_POR_CREDITO),
      dolaresPorCredito: DOLARES_POR_CREDITO,
      margen: MARGEN_IMAGEN_ADS,
      modelo: nombreDeModelo(f.MODELO_DE_LAS_IMAGENES) || 'GPT Image 2.5',
    };
  } catch {
    return null;
  }
}

// MEJORES ANUNCIOS (#/ganadores): anuncios de Meta que están funcionando, buscados en TrendTrack con los filtros que
// elige el usuario, para adaptarlos a su producto o tomarlos de referencia (2026-11-14).
//
// TrendTrack se usa con el conector de claude.ai que el usuario ya conectó a su cuenta de Claude: la app no guarda
// ninguna clave. Una sesión headless de Claude (lib/claude.js, con o.conectores) carga search_ads y check_credits
// con ToolSearch, llama cada una UNA vez con los argumentos exactos que arma la app y termina. Lo que devuelve
// TrendTrack llega crudo por o.alResultadoHerramienta: Claude no copia ni resume nada (más rápido y sin errores).
// Solo se permiten esas dos herramientas de lectura; todo lo demás (otros conectores, terminal, archivos) se rechaza
// solo (--permission-mode dontAsk).
//
// Créditos de TrendTrack: 1,5 por anuncio devuelto (lo que no devuelve nada no cobra). Por eso cada búsqueda queda
// en caché 12 horas (la misma búsqueda no se vuelve a pagar) y el tope es 20 anuncios por búsqueda.
//
//   temp/_ganadores/busquedas/<clave>.json   { clave, filtros, args, fecha, anuncios, creditos }   (caché, se borra sola)
//   temp/_ganadores/creditos.json            el último check_credits
//   temp/_ganadores/sesion/                  la carpeta de trabajo de la sesión de Claude (vacía)
//   temp/_ganadores/registro/<clave>.jsonl   lo que pasó en cada sesión (para revisar si algo falla)
//   mis_archivos/ganadores/guardados.json    los que el usuario guardó (se quedan; van con el guardado de la app)
//   temp/_referencias/<id>.mp4               el video de un ganador para «Adaptar a mi producto» (como uno subido)
//
// En modo prueba no se gasta: la búsqueda devuelve anuncios simulados y no se abre Claude.
//
// Desde 2026-11-17m la pantalla es «Inspiración» (#/inspiracion; #/ganadores sigue andando): este módulo pone la
// búsqueda, la caché, los guardados y la sesión con el conector (consultarConector, también para buscar marcas);
// lib/inspiracion.js pone el formato y el sonido de cada anuncio, las marcas que sigues y Replicar.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { RAIZ, TEMP } from './rutas.js';
import { leerJSON, escribirJSONSeguro } from './archivos.js';
import { lanzarSesion } from './claude.js';
import { modoPrueba } from './modo-prueba.js';
import { DIR_REFERENCIAS } from '../rutas/referencias.js';
import { rutaDeArchivoDeMuestra } from './muestras.js';

export const DIR_GANADORES = path.join(TEMP, '_ganadores');
const DIR_BUSQUEDAS = path.join(DIR_GANADORES, 'busquedas');
const DIR_SESION = path.join(DIR_GANADORES, 'sesion');
const DIR_REGISTRO = path.join(DIR_GANADORES, 'registro');
const ARCHIVO_CREDITOS = path.join(DIR_GANADORES, 'creditos.json');
const ARCHIVO_GUARDADOS = path.join(RAIZ, 'mis_archivos', 'ganadores', 'guardados.json');

const HERRAMIENTA_CREDITOS = 'mcp__claude_ai_TrendTrack__check_credits';
export const CREDITOS_POR_ANUNCIO = 1.5;
const CACHE_MS = 12 * 3600000;
const MAX_POR_BUSQUEDA = 20;
const MAX_GUARDADOS = 300;

export class ErrorGanadores extends Error {
  constructor(status, mensaje, extra = {}) {
    super(mensaje);
    this.status = status;
    Object.assign(this, extra);
  }
}

// ---------------------------------------------------------------- filtros -> argumentos de search_ads

/** Los nichos que se ofrecen (ids de categoría de TrendTrack, de lookup_filter_ids). */
export const NICHOS = [
  { id: 646, nombre: 'Salud' },
  { id: 711, nombre: 'Vitaminas y suplementos' },
  { id: 708, nombre: 'Nutrición' },
  { id: 650, nombre: 'Medicina natural' },
  { id: 654, nombre: 'Condiciones de salud' },
  { id: 677, nombre: 'Dolor' },
  { id: 239, nombre: 'Belleza y fitness' },
  { id: 248, nombre: 'Cuidado de la cara y el cuerpo' },
  { id: 254, nombre: 'Cuidado de la piel y uñas' },
  { id: 268, nombre: 'Cuidado del cabello' },
  { id: 251, nombre: 'Maquillaje y cosméticos' },
  { id: 260, nombre: 'Fitness' },
  { id: 257, nombre: 'Moda' },
];
export const PAISES = ['CO', 'EC', 'GT', 'MX', 'PE', 'CL', 'AR', 'BO', 'PA', 'CR', 'DO', 'PY', 'UY', 'SV', 'HN', 'NI', 'VE', 'ES', 'US'];
export const ORDENES = {
  escalando: { sort_by: 'reachDelta7d', texto: 'Escalando esta semana' },
  constantes: { sort_by: 'longestRunning', texto: 'Más tiempo activos' },
  duplicados: { sort_by: 'mostDuplicates', texto: 'Más duplicados' },
  alcance: { sort_by: 'reach', texto: 'Más alcance' },
  nuevos: { sort_by: 'newest', texto: 'Los más nuevos' },
};

const entero = (v, min, max, porDefecto) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : porDefecto;
};

/** Normaliza lo que manda la pantalla (lo que no se reconoce se ignora). */
export function filtrosLimpios(f = {}) {
  // paises: [] = todos los países (sin filtro de país); si no viene nada, Colombia
  const paises = (Array.isArray(f.paises) ? f.paises : f.pais ? [f.pais] : ['CO'])
    .map((p) => String(p || '').toUpperCase())
    .filter((p) => /^[A-Z]{2}$/.test(p))
    .slice(0, 10);
  const nichos = (Array.isArray(f.nichos) ? f.nichos : [])
    .map(Number)
    .filter((n) => NICHOS.some((x) => x.id === n))
    .slice(0, 6);
  const texto = String(f.texto || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  // solo creativos ya validados (por defecto): TrendTrack devuelve solo los activos hace 30 días o más (inspiracion.js
  // esValidado; así no se pagan créditos por anuncios que todavía no probaron nada)
  const soloValidados = f.soloValidados !== false;
  return {
    soloValidados,
    paises: [...new Set(paises)],
    idioma: /^[a-z]{2}$/.test(String(f.idioma || '')) ? String(f.idioma) : 'es',
    texto,
    buscarEn: ['ad_copy', 'brand', 'domain'].includes(f.buscarEn) ? f.buscarEn : 'ad_copy',
    nichos: [...new Set(nichos)],
    formato: ['video', 'image'].includes(f.formato) ? f.formato : '',
    diasMin: Math.max(soloValidados ? 30 : 0, entero(f.diasMin, 0, 365, soloValidados ? 30 : 14)),
    // desde cuándo se vio por primera vez: 0 = todo el tiempo; 7, 30 o 90 = los de esos últimos días
    rango: [7, 30, 90].includes(Number(f.rango)) ? Number(f.rango) : 0,
    orden: Object.hasOwn(ORDENES, f.orden) ? f.orden : 'escalando',
    unoPorMarca: f.unoPorMarca !== false,
    cantidad: entero(f.cantidad, 1, MAX_POR_BUSQUEDA, 12),
    pagina: entero(f.pagina, 1, 50, 1),
  };
}

/** Los argumentos exactos de search_ads. */
export function argumentosBusqueda(f) {
  const a = {
    status: 'active',
    ad_languages: [f.idioma],
    sort_by: ORDENES[f.orden].sort_by,
    order: 'desc',
    limit: f.cantidad,
    page: f.pagina,
  };
  if (f.paises.length) a.ad_countries = { include: f.paises };
  if (f.texto) {
    a.query = f.texto;
    a.search_in = f.buscarEn;
  }
  if (f.nichos.length) a.category_ids = f.nichos;
  if (f.formato) a.media_type = f.formato;
  if (f.diasMin > 0) a.min_days_running = f.diasMin;
  if (f.rango) a.created_after = new Date(Date.now() - f.rango * 86400000).toISOString().slice(0, 10);
  if (f.unoPorMarca) a.max_ads_per_brand = 1;
  return a;
}

export const claveDe = (args) => crypto.createHash('sha1').update(JSON.stringify(args)).digest('hex').slice(0, 16);

// ---------------------------------------------------------------- lo que devuelve TrendTrack -> lo que muestra la app

const urlSegura = (u) => {
  try {
    const x = new URL(String(u || ''));
    return x.protocol === 'https:' ? x.toString() : null;
  } catch {
    return null;
  }
};
export const deTrendtrack = (u) => {
  const x = urlSegura(u);
  return x && /(^|\.)trendtrack\.io$/i.test(new URL(x).hostname) ? x : null;
};
/**
 * Los videos e imágenes de Meta (2026-11-17n: la Biblioteca de anuncios oficial y el botón de Chrome): solo https, y el
 * host tiene que terminar en .fbcdn.net (donde Meta guarda los medios) o ser facebook.com / www.facebook.com.
 */
export const deFacebook = (u) => {
  const x = urlSegura(u);
  if (!x) return null;
  const h = new URL(x).hostname.toLowerCase();
  return h.endsWith('.fbcdn.net') || h === 'facebook.com' || h === 'www.facebook.com' ? x : null;
};
// Lo que el botón de Chrome ya bajó a esta app (temp/_ganadores/chrome/<id de la biblioteca>.<ext>).
export const DIR_CHROME = path.join(DIR_GANADORES, 'chrome');
const MEDIO_CHROME = /^\/api\/inspiracion\/chrome\/media\/(\d{5,25}(?:-p)?\.(?:mp4|jpg|png|webp))$/;
/** El archivo de un medio bajado por el botón de Chrome (solo el nombre exacto que deja la app), o null. */
export function rutaMedioChrome(archivo) {
  return /^\d{5,25}(?:-p)?\.(?:mp4|jpg|png|webp)$/.test(String(archivo || '')) ? path.join(DIR_CHROME, archivo) : null;
}
// En modo prueba los anuncios simulados usan las muestras del paquete (app/muestras/<clave>/), servidas por la app.
const MUESTRA_LOCAL = /^\/archivos\/muestra\/[a-z0-9-]{2,40}\/(imagen\.jpg|video\.mp4)$/;
export const medioPermitido = (u) =>
  deTrendtrack(u) || deFacebook(u) || (MEDIO_CHROME.test(String(u || '')) ? String(u) : null) || (modoPrueba() && MUESTRA_LOCAL.test(String(u || '')) ? String(u) : null);
/** La ruta en disco de un medio local: lo bajado por el botón de Chrome o (modo prueba) una muestra. null si no está. */
export function rutaDeMuestraLocal(u) {
  const c = String(u || '').match(MEDIO_CHROME);
  if (c) {
    const r = rutaMedioChrome(c[1]);
    return r && fs.existsSync(r) ? r : null;
  }
  const m = String(u || '').match(/^\/archivos\/muestra\/([^/]+)\/([^/]+)$/);
  const r = m && MUESTRA_LOCAL.test(u) ? rutaDeArchivoDeMuestra(m[1], m[2]) : null;
  return r && fs.existsSync(r) ? r : null;
}

/**
 * Trae un medio de Meta o de TrendTrack sin dejar que una redirección lo lleve a otro sitio: con un medio de Facebook
 * cada salto tiene que seguir en .fbcdn.net / facebook.com (TrendTrack redirige a su almacenamiento: ahí se sigue
 * como siempre). -> Response (o tira).
 */
export async function traerMedio(url, { headers = {}, signal, saltos = 4 } = {}) {
  if (deTrendtrack(url)) return fetch(url, { headers, redirect: 'follow', signal });
  let actual = deFacebook(url);
  for (let i = 0; actual && i <= saltos; i++) {
    const r = await fetch(actual, { headers, redirect: 'manual', signal });
    if (r.status < 300 || r.status >= 400) return r;
    const destino = r.headers.get('location');
    actual = destino ? deFacebook(new URL(destino, actual).toString()) : null;
  }
  throw new ErrorGanadores(502, 'Ese medio intentó llevarme a otro sitio: no lo traje.');
}
const texto = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const numero = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null);

export function normalizarAnuncio(a) {
  if (!a || typeof a !== 'object') return null;
  const media = a.media || {};
  const tipo = media.type === 'video' ? 'video' : media.type === 'image' ? 'imagen' : 'otro';
  const c = a.content || {};
  const m = a.metrics || {};
  const ad = a.advertiser || {};
  const id = texto(a.id, 80);
  if (!id) return null;
  return {
    id,
    coleccion: texto(a.collationId, 60),
    plataforma: texto(a.platform, 20) || 'facebook',
    activo: a.status ? a.status === 'active' : true,
    dias: numero(a.daysRunning),
    desde: texto(a.firstSeenAt, 40),
    visto: texto(a.lastSeenAt, 40),
    tipo,
    miniatura: medioPermitido(media.thumbnailUrl),
    media: medioPermitido(media.mediaUrl),
    anunciante: {
      nombre: texto(ad.name, 120) || 'Anunciante',
      logo: medioPermitido(ad.logoUrl),
      activos: numero(ad.liveAdsCount),
      pagina: texto(ad.facebookPageId, 40),
    },
    titulo: texto(c.title, 300),
    copy: texto(c.body, 4000),
    transcripcion: texto(c.transcript, 6000),
    cta: texto(c.callToAction, 40),
    landing: urlSegura(c.landingPageUrl),
    dominio: texto(c.landingPageDomain, 120),
    duplicados: numero(m.duplicates),
    alcance: numero(m.reach),
    alcance7d: numero(m.reachDelta7d),
    gasto: numero(m.estimatedSpend),
    // el puesto del anuncio dentro de su página (1 = el que más empuja la marca) y cuánto subió o bajó
    puesto: numero(a.rank?.currentRank),
    puestoCambio: numero(a.rank?.rankDelta),
    paises: Array.isArray(a.audience?.targetedCountries) ? a.audience.targetedCountries.filter((p) => typeof p === 'string').slice(0, 8) : [],
    totalPaises: Array.isArray(a.audience?.targetedCountries) ? a.audience.targetedCountries.length : 0,
    // de dónde salió (2026-11-17n): 'trendtrack', 'meta' (la Biblioteca de anuncios oficial) o 'chrome' (el botón)
    fuente: ['meta', 'chrome'].includes(a.fuente) ? a.fuente : 'trendtrack',
    // el identificador de la Biblioteca de anuncios de Meta (para «Ver en Meta»)
    metaId: /^\d{5,25}$/.test(String(a.metaId ?? '')) ? String(a.metaId) : null,
    plataformas: Array.isArray(a.platforms) ? a.platforms.filter((p) => typeof p === 'string' && /^[a-z_]{2,30}$/i.test(p)).slice(0, 6) : [],
    descripcion: texto(c.description, 600),
    // cuántos anuncios usan este mismo creativo (lo dice la Biblioteca de anuncios)
    creativos: numero(m.creatives),
    // (Meta oficial) el video o la imagen todavía no se sacó del snapshot: la tarjeta lo pide cuando se ve
    medioPendiente: a.fuente === 'meta' && a.mediaPending === true ? true : undefined,
    guardadoEn: a.fuente === 'chrome' ? texto(a.importedAt, 40) : undefined,
  };
}

/** El JSON que devuelve un conector (a veces con texto alrededor), o null. */
export function leerJSONDeConector(textoCrudo) {
  const t = String(textoCrudo || '');
  try {
    return JSON.parse(t);
  } catch {
    const i = t.indexOf('{');
    const k = t.lastIndexOf('}');
    if (i >= 0 && k > i) {
      try {
        return JSON.parse(t.slice(i, k + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * El texto de search_ads -> { anuncios, total, costo, restantes } (null si no se entiende). total: cuántos anuncios
 * tiene TrendTrack con esos filtros (aproximado, lo dice TrendTrack); costo: los créditos que cobró esta página.
 */
export function leerRespuestaBusqueda(textoCrudo) {
  const j = leerJSONDeConector(textoCrudo);
  if (!j || !Array.isArray(j.data)) return null;
  return {
    anuncios: j.data.map(normalizarAnuncio).filter(Boolean),
    total: numero(j.pagination?.total),
    paginas: numero(j.pagination?.totalPages),
    costo: numero(j.credits?.costUnits),
    restantes: numero(j.credits?.creditsRemaining),
  };
}

/** El texto de check_credits -> { plan, restantes, limite, fin } (null si no se entiende). */
export function leerRespuestaCreditos(textoCrudo) {
  try {
    const j = JSON.parse(String(textoCrudo || ''));
    const restantes = numero(j?.credits?.totalRemaining ?? j?.includedQuota?.remaining);
    if (restantes === null) return null;
    return { plan: texto(j?.billing?.planCode, 40), restantes, limite: numero(j?.includedQuota?.limit), fin: texto(j?.billing?.currentPeriodEnd, 40), fecha: new Date().toISOString() };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- la búsqueda

const PROHIBIDAS = ['Bash', 'PowerShell', 'Edit', 'MultiEdit', 'Write', 'NotebookEdit', 'Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Agent', 'Task', 'Skill'];
const TT = (corto) => `mcp__claude_ai_TrendTrack__${corto}`;
// las únicas herramientas de TrendTrack que la app llama así (todas de lectura)
const DE_LECTURA = ['search_ads', 'search_advertisers', 'list_tracked_brands'];

function promptConector(nombre, args) {
  return [
    'Tarea de la app Kads Studio: una consulta en TrendTrack. Haz exactamente esto, en este orden, y nada más:',
    `1. Carga las herramientas con ToolSearch usando exactamente la consulta "select:${nombre},${HERRAMIENTA_CREDITOS}". Si todavía no aparecen, vuelve a buscarlas una vez con la consulta "TrendTrack ${nombre.split('__').pop()}".`,
    `2. Llama ${nombre} UNA sola vez con exactamente estos argumentos (no agregues, quites ni cambies ninguno):`,
    JSON.stringify(args),
    `3. Llama ${HERRAMIENTA_CREDITOS} una vez, sin argumentos.`,
    '4. Responde solo LISTO. No resumas ni copies los resultados: la app los lee directamente.',
    'Si una herramienta falla, no la repitas con otros argumentos: responde ERROR y el motivo en una línea.',
  ].join('\n');
}

let enCurso = null; // una consulta a la vez (cada una abre una sesión de Claude)

/**
 * Llama UNA herramienta de lectura de TrendTrack (más check_credits) con el conector de claude.ai del usuario, en una
 * sesión headless de Claude, y devuelve lo que respondió leído con `leer(texto)`.
 * -> { datos, creditos }   o tira ErrorGanadores (409 si ya hay otra consulta; 502/503 si no se pudo)
 * No mira la caché ni el modo prueba: eso lo hace quien la llama.
 */
export async function consultarConector({ herramienta, args, clave, leer, frase = 'Consultando TrendTrack', alProgreso = () => {} }) {
  if (!DE_LECTURA.includes(herramienta)) throw new ErrorGanadores(400, 'Esa consulta de TrendTrack no está permitida.');
  if (enCurso) throw new ErrorGanadores(409, 'Ya hay una búsqueda en TrendTrack en curso. Espera a que termine.');
  const nombre = TT(herramienta);
  let datos = null;
  let creditos = null;
  let errorHerramienta = null;
  enCurso = clave;
  try {
    fs.mkdirSync(DIR_SESION, { recursive: true });
    const r = await lanzarSesion({
      tipo: 'ganadores',
      uuid: crypto.randomUUID(),
      cwd: DIR_SESION,
      prompt: promptConector(nombre, args),
      conectores: true,
      permitidas: ['ToolSearch', nombre, HERRAMIENTA_CREDITOS],
      prohibidas: PROHIBIDAS,
      maxTurnos: 8,
      timeoutMs: 4 * 60000,
      silencioMs: 2 * 60000,
      // 20 anuncios con su transcripción pueden pasar el tope normal de lo que devuelve un conector
      entorno: { MAX_MCP_OUTPUT_TOKENS: '80000' },
      registro: path.join(DIR_REGISTRO, `${clave}.jsonl`),
      fraseInicio: frase,
      alProgreso,
      alResultadoHerramienta: (n, t, { error }) => {
        if (n === nombre) {
          if (error) errorHerramienta = t.slice(0, 400);
          else datos = leer(t) || datos;
        } else if (n === HERRAMIENTA_CREDITOS && !error) {
          creditos = leerRespuestaCreditos(t) || creditos;
        }
      },
    });
    if (!datos) {
      if (r.limite || r.sinSesion || r.sinClaude) throw new ErrorGanadores(503, r.error);
      if (errorHerramienta) throw new ErrorGanadores(502, `TrendTrack no respondió bien: ${errorHerramienta}`);
      const sinConector = /no (está|tengo|encuentro|aparece)|not available|unavailable|connect/i.test(`${r.resultado || ''} ${r.detalle || ''}`);
      throw new ErrorGanadores(
        502,
        sinConector
          ? 'No encontré TrendTrack en tu cuenta de Claude. Revisa en claude.ai → Ajustes → Conectores que TrendTrack esté conectado y vuelve a intentar.'
          : r.error || 'La consulta a TrendTrack no terminó bien. Vuelve a intentar.'
      );
    }
  } finally {
    enCurso = null;
  }
  if (creditos) escribirJSONSeguro(ARCHIVO_CREDITOS, creditos);
  return { datos, creditos: creditos || leerJSON(ARCHIVO_CREDITOS) };
}

/** Si esta búsqueda ya está guardada y vigente (sale gratis). */
export function busquedaEnCache(filtrosCrudos) {
  const args = argumentosBusqueda(filtrosLimpios(filtrosCrudos));
  const guardada = leerJSON(path.join(DIR_BUSQUEDAS, `${claveDe(args)}.json`));
  return Boolean(guardada && Date.now() - Date.parse(guardada.fecha) < CACHE_MS);
}

/**
 * Busca (o devuelve de la caché) los mejores anuncios con esos filtros.
 * -> { clave, filtros, fecha, anuncios, total, costo, creditos, desdeCache, simulado? }
 */
export async function buscarGanadores(filtrosCrudos, { forzar = false, alProgreso = () => {} } = {}) {
  const filtros = filtrosLimpios(filtrosCrudos);
  const args = argumentosBusqueda(filtros);
  const clave = claveDe(args);
  const archivo = path.join(DIR_BUSQUEDAS, `${clave}.json`);
  const guardada = leerJSON(archivo);
  if (!forzar && guardada && Date.now() - Date.parse(guardada.fecha) < CACHE_MS) return { ...guardada, desdeCache: true };
  if (modoPrueba()) {
    const sim = anunciosSimulados(filtros);
    const r = { clave, filtros, args, fecha: new Date().toISOString(), anuncios: sim.anuncios, total: sim.total, costo: null, creditos: null, simulado: true };
    escribirJSONSeguro(archivo, r);
    return { ...r, desdeCache: false };
  }
  const { datos, creditos } = await consultarConector({ herramienta: 'search_ads', args, clave, leer: leerRespuestaBusqueda, frase: 'Buscando en TrendTrack', alProgreso });
  const resultado = { clave, filtros, args, fecha: new Date().toISOString(), anuncios: datos.anuncios, total: datos.total, costo: datos.costo, creditos };
  escribirJSONSeguro(archivo, resultado);
  limpiarCache();
  return { ...resultado, desdeCache: false };
}

export const busquedaEnCurso = () => enCurso;

/** Una búsqueda ya hecha (para volver a verla sin gastar). */
export function busquedaGuardada(clave) {
  if (!/^[0-9a-f]{16}$/.test(String(clave || ''))) return null;
  const r = leerJSON(path.join(DIR_BUSQUEDAS, `${clave}.json`));
  return r ? { ...r, desdeCache: true } : null;
}

/** Las últimas búsquedas (solo lo que hace falta para la lista). */
export function busquedasRecientes(max = 8) {
  let archivos = [];
  try {
    archivos = fs.readdirSync(DIR_BUSQUEDAS).filter((f) => /^[0-9a-f]{16}\.json$/.test(f));
  } catch {
    return [];
  }
  return archivos
    .map((f) => leerJSON(path.join(DIR_BUSQUEDAS, f)))
    .filter((r) => r?.fecha && r?.filtros)
    .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha))
    .slice(0, max)
    .map((r) => ({ clave: r.clave, filtros: r.filtros, fecha: r.fecha, cantidad: r.anuncios?.length || 0, vigente: Date.now() - Date.parse(r.fecha) < CACHE_MS, simulado: Boolean(r.simulado) }));
}

/** La caché guarda las últimas 120 búsquedas (cada página cuenta como una) y nada de más de 7 días. */
function limpiarCache() {
  try {
    const lista = fs
      .readdirSync(DIR_BUSQUEDAS)
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({ f, t: fs.statSync(path.join(DIR_BUSQUEDAS, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const [i, x] of lista.entries()) if (i >= 120 || Date.now() - x.t > 7 * 86400000) fs.rmSync(path.join(DIR_BUSQUEDAS, x.f), { force: true });
  } catch {
    /* nada que limpiar */
  }
}

export const ultimosCreditos = () => leerJSON(ARCHIVO_CREDITOS);

// ---------------------------------------------------------------- guardados

export function listarGuardados() {
  const j = leerJSON(ARCHIVO_GUARDADOS);
  return Array.isArray(j?.anuncios) ? j.anuncios : [];
}

export function guardarAnuncio(anuncio, nota = '') {
  const a = normalizarDeVuelta(anuncio);
  if (!a) throw new ErrorGanadores(400, 'Ese anuncio no se puede guardar.');
  const lista = listarGuardados().filter((x) => x.id !== a.id);
  lista.unshift({ ...a, guardado: new Date().toISOString(), nota: String(nota || '').slice(0, 500) });
  escribirJSONSeguro(ARCHIVO_GUARDADOS, { v: 1, anuncios: lista.slice(0, MAX_GUARDADOS) });
  return lista[0];
}

export function quitarGuardado(id) {
  const lista = listarGuardados();
  const queda = lista.filter((x) => x.id !== id);
  if (queda.length !== lista.length) escribirJSONSeguro(ARCHIVO_GUARDADOS, { v: 1, anuncios: queda });
}

/** Un anuncio que vuelve de la pantalla: se rearma con las mismas reglas (nada de URLs de otros sitios). */
export function normalizarDeVuelta(a) {
  if (!a || typeof a !== 'object' || !texto(a.id, 80)) return null;
  return normalizarAnuncio({
    id: a.id,
    collationId: a.coleccion,
    platform: a.plataforma,
    status: a.activo === false ? 'inactive' : 'active',
    daysRunning: a.dias,
    firstSeenAt: a.desde,
    lastSeenAt: a.visto,
    media: { type: a.tipo === 'imagen' ? 'image' : a.tipo === 'video' ? 'video' : 'other', thumbnailUrl: a.miniatura, mediaUrl: a.media },
    advertiser: { name: a.anunciante?.nombre, logoUrl: a.anunciante?.logo, liveAdsCount: a.anunciante?.activos, facebookPageId: a.anunciante?.pagina },
    content: { title: a.titulo, body: a.copy, transcript: a.transcripcion, callToAction: a.cta, landingPageUrl: a.landing, landingPageDomain: a.dominio, description: a.descripcion },
    metrics: { duplicates: a.duplicados, reach: a.alcance, reachDelta7d: a.alcance7d, estimatedSpend: a.gasto, creatives: a.creativos },
    rank: { currentRank: a.puesto, rankDelta: a.puestoCambio },
    audience: { targetedCountries: a.paises },
    fuente: a.fuente,
    metaId: a.metaId,
    platforms: a.plataformas,
    mediaPending: a.medioPendiente,
    importedAt: a.guardadoEn,
  });
}

// ---------------------------------------------------------------- usar un ganador

/**
 * Baja el video de un ganador a temp/_referencias/ (como si el usuario lo hubiera subido) para «Adaptar a mi
 * producto»: el formulario de Nuevo anuncio lo recibe como "subido:<id>|<nombre>" y la app lo clona (lib/clonar.js).
 */
export async function bajarParaReferencia(anuncio) {
  const url = medioPermitido(anuncio?.media);
  if (!url || anuncio?.tipo !== 'video') throw new ErrorGanadores(400, 'Ese anuncio no tiene un video para adaptar.');
  const origenNombre = anuncio?.fuente === 'meta' ? 'Meta' : anuncio?.fuente === 'chrome' ? 'Chrome' : 'TrendTrack';
  const nombre = `${String(anuncio?.anunciante?.nombre || 'ganador').replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 60) || 'ganador'} (${origenNombre}).mp4`;
  if (url.startsWith('/')) {
    // lo que bajó el botón de Chrome (o, en modo prueba, una muestra del paquete): se copia, sin internet
    const origen = rutaDeMuestraLocal(url);
    if (!origen) throw new ErrorGanadores(404, 'Esa muestra no está en esta app.');
    const id = `${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
    fs.mkdirSync(DIR_REFERENCIAS, { recursive: true });
    fs.copyFileSync(origen, path.join(DIR_REFERENCIAS, `${id}.mp4`));
    return { id, nombre, valor: `subido:${id}|${nombre}` };
  }
  let r;
  try {
    r = await traerMedio(url, { signal: AbortSignal.timeout(120000) });
  } catch {
    throw new ErrorGanadores(502, `No pude bajar el video de ${origenNombre}. Revisa tu internet y vuelve a intentar.`);
  }
  if (!r.ok) throw new ErrorGanadores(502, `${origenNombre} no entregó el video (${r.status}).`);
  const largo = Number(r.headers.get('content-length') || 0);
  if (largo > 400 * 1024 * 1024) throw new ErrorGanadores(413, 'Ese video pesa demasiado.');
  const datos = Buffer.from(await r.arrayBuffer());
  if (datos.length < 1000) throw new ErrorGanadores(502, `El video que llegó de ${origenNombre} está vacío.`);
  const id = `${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
  fs.mkdirSync(DIR_REFERENCIAS, { recursive: true });
  fs.writeFileSync(path.join(DIR_REFERENCIAS, `${id}.mp4`), datos);
  return { id, nombre, valor: `subido:${id}|${nombre}` };
}

// ---------------------------------------------------------------- modo prueba

// Anuncios simulados (sin TrendTrack): con las muestras de los estilos del paquete como video o imagen, para probar la
// pantalla Inspiración entera (formatos, sonidos, marcas, páginas, Replicar) sin gastar. 3 páginas como mucho.
const SIMULADOS = [
  { muestra: 'claymation', tipo: 'video', marca: 'AMUA', pagina: 'sim_amua', copy: 'Así se va la hinchazón en 7 días 🌿 Pago contra entrega en toda Colombia.', voz: 'Mira lo que pasa dentro de tu cuerpo cuando tomas esto cada mañana.', titulo: 'Desinflama en 7 días' },
  { muestra: 'crochet', tipo: 'video', marca: 'Tejidos Felices', pagina: 'sim_tejidos', copy: 'La historia de Lupita y su rodilla 🧶 Envío gratis hoy.', voz: 'Lupita no podía subir las escaleras hasta que probó esto.', titulo: 'Lupita volvió a caminar' },
  { muestra: 'ugc', tipo: 'video', marca: 'Vitalabh', pagina: 'sim_vitalabh', copy: 'Chicas, les cuento mi experiencia con este colágeno 💕', voz: 'Hola chicas, les cuento mi experiencia: yo probé de todo y nada me funcionaba hasta que encontré esto.', titulo: 'Mi experiencia real' },
  { muestra: 'skeleton', tipo: 'video', marca: 'Huesos Fuertes', pagina: 'sim_huesos', copy: 'Tu esqueleto te está pidiendo ayuda 💀 Calcio + D3.', voz: 'Soy tu esqueleto y necesito que me escuches.', titulo: 'Tu esqueleto habla' },
  { muestra: 'estilo-lego', tipo: 'video', marca: 'Bloques Pro', pagina: 'sim_bloques', copy: 'Armamos tu rutina pieza por pieza.', voz: null, titulo: 'Pieza por pieza' },
  { muestra: 'estilo-pixar', tipo: 'video', marca: 'AMUA', pagina: 'sim_amua', copy: 'Doña Rosa descubrió el secreto de su abuela ✨ Contra entrega.', voz: 'Doña Rosa nunca imaginó que el secreto estaba en la cocina de su abuela.', titulo: 'El secreto de la abuela' },
  { muestra: 'zack-d-films', tipo: 'video', marca: 'Ciencia Natural', pagina: 'sim_ciencia', copy: 'Esto es lo que pasa en tus venas cuando comes azúcar 🫀', voz: 'Esto es lo que pasa dentro de tus venas cuando comes azúcar.', titulo: 'Dentro de tus venas' },
  { muestra: 'realista-narrado', tipo: 'video', marca: 'Vitalabh', pagina: 'sim_vitalabh', copy: 'Les debemos una disculpa: la oferta se acaba hoy.', voz: 'Les debemos una disculpa. Nos quedamos sin unidades dos veces.', titulo: 'Les debemos una disculpa' },
  { muestra: 'musical', tipo: 'video', marca: 'Bloques Pro', pagina: 'sim_bloques', copy: 'La canción que todos están cantando 🎵', voz: '♪ Desinflama, desinflama, toma tu té por la mañana ♪ Desinflama, desinflama ♪', titulo: 'La canción del té' },
  { muestra: 'claymation', tipo: 'imagen', marca: 'Tejidos Felices', pagina: 'sim_tejidos', copy: 'Tu piel 10 años más joven en 30 días. Envío gratis y pagas al recibir.', voz: null, titulo: '10 años más joven' },
  { muestra: 'ugc', tipo: 'imagen', marca: 'AMUA', pagina: 'sim_amua', copy: 'Antes y después real de nuestra clienta 😍 Pago contra entrega.', voz: null, titulo: 'Antes y después' },
  { muestra: 'entrevista', tipo: 'video', marca: 'Huesos Fuertes', pagina: 'sim_huesos', copy: 'Le preguntamos a la gente en la calle qué toman para las rodillas 🎤', voz: 'Disculpa, ¿qué tomas tú para el dolor de rodillas? Yo tomo esto desde hace tres meses.', titulo: 'Preguntamos en la calle' },
];

function anunciosSimulados(f) {
  const marca = f.texto && f.buscarEn !== 'ad_copy' ? f.texto.toLowerCase() : '';
  const base = SIMULADOS.filter(
    (b) => (!f.formato || (f.formato === 'image' ? b.tipo === 'imagen' : b.tipo === 'video')) && (!marca || b.marca.toLowerCase().includes(marca) || b.pagina === marca)
  );
  const total = base.length * 3;
  const anuncios = [];
  for (let k = 0; k < f.cantidad; k++) {
    const n = (f.pagina - 1) * f.cantidad + k + 1; // el número del anuncio en toda la búsqueda
    if (n > total) break;
    const b = base[(n - 1) % base.length];
    const dias = 5 + ((n * 17) % 120);
    anuncios.push(
      normalizarAnuncio({
        id: `simulado_${b.pagina}_${n}`,
        platform: 'facebook',
        status: 'active',
        daysRunning: dias,
        firstSeenAt: new Date(Date.now() - dias * 86400000).toISOString(),
        media: { type: b.tipo === 'imagen' ? 'image' : 'video', thumbnailUrl: `/archivos/muestra/${b.muestra}/imagen.jpg`, mediaUrl: `/archivos/muestra/${b.muestra}/${b.tipo === 'imagen' ? 'imagen.jpg' : 'video.mp4'}` },
        advertiser: { name: b.marca, liveAdsCount: 10 + (n % 40), facebookPageId: b.pagina },
        content: { title: b.titulo, body: b.copy, transcript: b.voz, callToAction: 'SHOP_NOW', landingPageUrl: 'https://ejemplo.com/oferta', landingPageDomain: 'ejemplo.com' },
        metrics: { duplicates: (n * 7) % 90, reach: 1000 * (((n * 37) % 500) + 10), reachDelta7d: 100 * ((n * 13) % 300) },
        rank: { currentRank: 1 + (n % 5), rankDelta: (n % 3) - 1 },
        audience: { targetedCountries: f.paises.length ? f.paises : ['CO'] },
      })
    );
  }
  return { anuncios: anuncios.filter(Boolean), total };
}

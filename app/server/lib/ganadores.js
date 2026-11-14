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
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { RAIZ, TEMP } from './rutas.js';
import { leerJSON, escribirJSONSeguro } from './archivos.js';
import { lanzarSesion } from './claude.js';
import { modoPrueba } from './modo-prueba.js';
import { DIR_REFERENCIAS } from '../rutas/referencias.js';

export const DIR_GANADORES = path.join(TEMP, '_ganadores');
const DIR_BUSQUEDAS = path.join(DIR_GANADORES, 'busquedas');
const DIR_SESION = path.join(DIR_GANADORES, 'sesion');
const DIR_REGISTRO = path.join(DIR_GANADORES, 'registro');
const ARCHIVO_CREDITOS = path.join(DIR_GANADORES, 'creditos.json');
const ARCHIVO_GUARDADOS = path.join(RAIZ, 'mis_archivos', 'ganadores', 'guardados.json');

const HERRAMIENTA_BUSCAR = 'mcp__claude_ai_TrendTrack__search_ads';
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
  return {
    paises: [...new Set(paises)],
    idioma: /^[a-z]{2}$/.test(String(f.idioma || '')) ? String(f.idioma) : 'es',
    texto,
    buscarEn: ['ad_copy', 'brand', 'domain'].includes(f.buscarEn) ? f.buscarEn : 'ad_copy',
    nichos: [...new Set(nichos)],
    formato: ['video', 'image'].includes(f.formato) ? f.formato : '',
    diasMin: entero(f.diasMin, 0, 365, 14),
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
    miniatura: deTrendtrack(media.thumbnailUrl),
    media: deTrendtrack(media.mediaUrl),
    anunciante: {
      nombre: texto(ad.name, 120) || 'Anunciante',
      logo: deTrendtrack(ad.logoUrl),
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
    gasto: numero(m.estimatedSpend),
    paises: Array.isArray(a.audience?.targetedCountries) ? a.audience.targetedCountries.filter((p) => typeof p === 'string').slice(0, 8) : [],
    totalPaises: Array.isArray(a.audience?.targetedCountries) ? a.audience.targetedCountries.length : 0,
  };
}

/** El texto de search_ads -> { anuncios } (null si no se entiende). */
export function leerRespuestaBusqueda(textoCrudo) {
  const t = String(textoCrudo || '');
  let j = null;
  try {
    j = JSON.parse(t);
  } catch {
    const i = t.indexOf('{');
    const k = t.lastIndexOf('}');
    if (i >= 0 && k > i) {
      try {
        j = JSON.parse(t.slice(i, k + 1));
      } catch {
        j = null;
      }
    }
  }
  if (!j || !Array.isArray(j.data)) return null;
  return { anuncios: j.data.map(normalizarAnuncio).filter(Boolean) };
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

function promptBusqueda(args) {
  return [
    'Tarea de la app Kads Studio: una búsqueda en TrendTrack. Haz exactamente esto, en este orden, y nada más:',
    `1. Carga las herramientas con ToolSearch usando exactamente la consulta "select:${HERRAMIENTA_BUSCAR},${HERRAMIENTA_CREDITOS}". Si todavía no aparecen, vuelve a buscarlas una vez con la consulta "TrendTrack search_ads".`,
    `2. Llama ${HERRAMIENTA_BUSCAR} UNA sola vez con exactamente estos argumentos (no agregues, quites ni cambies ninguno):`,
    JSON.stringify(args),
    `3. Llama ${HERRAMIENTA_CREDITOS} una vez, sin argumentos.`,
    '4. Responde solo LISTO. No resumas ni copies los resultados: la app los lee directamente.',
    'Si una herramienta falla, no la repitas con otros argumentos: responde ERROR y el motivo en una línea.',
  ].join('\n');
}

let enCurso = null; // una búsqueda a la vez (cada una abre una sesión de Claude)

/**
 * Busca (o devuelve de la caché) los mejores anuncios con esos filtros.
 * -> { clave, filtros, fecha, anuncios, creditos, desdeCache, simulado? }
 */
export async function buscarGanadores(filtrosCrudos, { forzar = false, alProgreso = () => {} } = {}) {
  const filtros = filtrosLimpios(filtrosCrudos);
  const args = argumentosBusqueda(filtros);
  const clave = claveDe(args);
  const archivo = path.join(DIR_BUSQUEDAS, `${clave}.json`);
  const guardada = leerJSON(archivo);
  if (!forzar && guardada && Date.now() - Date.parse(guardada.fecha) < CACHE_MS) return { ...guardada, desdeCache: true };
  if (modoPrueba()) {
    const r = { clave, filtros, args, fecha: new Date().toISOString(), anuncios: anunciosSimulados(filtros), creditos: null, simulado: true };
    escribirJSONSeguro(archivo, r);
    return { ...r, desdeCache: false };
  }
  if (enCurso) throw new ErrorGanadores(409, 'Ya hay una búsqueda en curso. Espera a que termine.');

  let respuesta = null;
  let creditos = null;
  let errorHerramienta = null;
  enCurso = clave;
  try {
    fs.mkdirSync(DIR_SESION, { recursive: true });
    const r = await lanzarSesion({
      tipo: 'ganadores',
      uuid: crypto.randomUUID(),
      cwd: DIR_SESION,
      prompt: promptBusqueda(args),
      conectores: true,
      permitidas: ['ToolSearch', HERRAMIENTA_BUSCAR, HERRAMIENTA_CREDITOS],
      prohibidas: PROHIBIDAS,
      maxTurnos: 8,
      timeoutMs: 4 * 60000,
      silencioMs: 2 * 60000,
      // 20 anuncios con su transcripción pueden pasar el tope normal de lo que devuelve un conector
      entorno: { MAX_MCP_OUTPUT_TOKENS: '80000' },
      registro: path.join(DIR_REGISTRO, `${clave}.jsonl`),
      fraseInicio: 'Buscando en TrendTrack',
      alProgreso,
      alResultadoHerramienta: (nombre, t, { error }) => {
        if (nombre === HERRAMIENTA_BUSCAR) {
          if (error) errorHerramienta = t.slice(0, 400);
          else respuesta = leerRespuestaBusqueda(t) || respuesta;
        } else if (nombre === HERRAMIENTA_CREDITOS && !error) {
          creditos = leerRespuestaCreditos(t) || creditos;
        }
      },
    });
    if (!respuesta) {
      if (r.limite || r.sinSesion || r.sinClaude) throw new ErrorGanadores(503, r.error);
      if (errorHerramienta) throw new ErrorGanadores(502, `TrendTrack no respondió bien: ${errorHerramienta}`);
      const sinConector = /no (está|tengo|encuentro|aparece)|not available|unavailable|connect/i.test(`${r.resultado || ''} ${r.detalle || ''}`);
      throw new ErrorGanadores(
        502,
        sinConector
          ? 'No encontré TrendTrack en tu cuenta de Claude. Revisa en claude.ai → Ajustes → Conectores que TrendTrack esté conectado y vuelve a intentar.'
          : r.error || 'La búsqueda no terminó bien. Vuelve a intentar.'
      );
    }
  } finally {
    enCurso = null;
  }
  if (creditos) escribirJSONSeguro(ARCHIVO_CREDITOS, creditos);
  const resultado = { clave, filtros, args, fecha: new Date().toISOString(), anuncios: respuesta.anuncios, creditos: creditos || leerJSON(ARCHIVO_CREDITOS) };
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

/** La caché guarda las últimas 40 búsquedas y nada de más de 7 días. */
function limpiarCache() {
  try {
    const lista = fs
      .readdirSync(DIR_BUSQUEDAS)
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({ f, t: fs.statSync(path.join(DIR_BUSQUEDAS, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const [i, x] of lista.entries()) if (i >= 40 || Date.now() - x.t > 7 * 86400000) fs.rmSync(path.join(DIR_BUSQUEDAS, x.f), { force: true });
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
function normalizarDeVuelta(a) {
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
    content: { title: a.titulo, body: a.copy, transcript: a.transcripcion, callToAction: a.cta, landingPageUrl: a.landing, landingPageDomain: a.dominio },
    metrics: { duplicates: a.duplicados, reach: a.alcance, estimatedSpend: a.gasto },
    audience: { targetedCountries: a.paises },
  });
}

// ---------------------------------------------------------------- usar un ganador

/**
 * Baja el video de un ganador a temp/_referencias/ (como si el usuario lo hubiera subido) para «Adaptar a mi
 * producto»: el formulario de Nuevo anuncio lo recibe como "subido:<id>|<nombre>" y la app lo clona (lib/clonar.js).
 */
export async function bajarParaReferencia(anuncio) {
  const url = deTrendtrack(anuncio?.media);
  if (!url || anuncio?.tipo !== 'video') throw new ErrorGanadores(400, 'Ese anuncio no tiene un video para adaptar.');
  const nombre = `${String(anuncio?.anunciante?.nombre || 'ganador').replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 60) || 'ganador'} (TrendTrack).mp4`;
  let r;
  try {
    r = await fetch(url, { signal: AbortSignal.timeout(120000) });
  } catch {
    throw new ErrorGanadores(502, 'No pude bajar el video de TrendTrack. Revisa tu internet y vuelve a intentar.');
  }
  if (!r.ok) throw new ErrorGanadores(502, `TrendTrack no entregó el video (${r.status}).`);
  const largo = Number(r.headers.get('content-length') || 0);
  if (largo > 400 * 1024 * 1024) throw new ErrorGanadores(413, 'Ese video pesa demasiado.');
  const datos = Buffer.from(await r.arrayBuffer());
  if (datos.length < 1000) throw new ErrorGanadores(502, 'El video que llegó de TrendTrack está vacío.');
  const id = `${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
  fs.mkdirSync(DIR_REFERENCIAS, { recursive: true });
  fs.writeFileSync(path.join(DIR_REFERENCIAS, `${id}.mp4`), datos);
  return { id, nombre, valor: `subido:${id}|${nombre}` };
}

// ---------------------------------------------------------------- modo prueba

function anunciosSimulados(f) {
  const base = [
    { tipo: 'video', nombre: 'Marca de prueba 1', copy: '¿Sientes el cuerpo hinchado aunque comas poco? Esto le pasó a María… ✅ Pago contra entrega', dias: 64, duplicados: 128 },
    { tipo: 'imagen', nombre: 'Marca de prueba 2', copy: 'Tu piel 10 años más joven en 30 días. Envío gratis y pagas al recibir.', dias: 41, duplicados: 36 },
    { tipo: 'video', nombre: 'Marca de prueba 3', copy: 'El médico me dijo que no era grasa, era retención de líquidos.', dias: 23, duplicados: 12 },
  ];
  return base.slice(0, Math.min(3, f.cantidad)).map((b, i) =>
    normalizarAnuncio({
      id: `simulado_${i + 1}`,
      platform: 'facebook',
      status: 'active',
      daysRunning: b.dias,
      media: { type: b.tipo === 'imagen' ? 'image' : 'video' },
      advertiser: { name: b.nombre, liveAdsCount: 10 + i },
      content: { body: b.copy, callToAction: 'SHOP_NOW', landingPageDomain: 'ejemplo.com' },
      metrics: { duplicates: b.duplicados, reach: 1000 * (i + 1) },
      audience: { targetedCountries: f.paises },
    })
  );
}

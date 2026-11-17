// INSPIRACIÓN · «Meta (oficial)» (2026-11-17n): los anuncios salen de la Biblioteca de anuncios de Meta con su API
// oficial (Graph API, ads_archive), con el token del usuario (Ajustes › Conexiones, en el .env como META_ADS_TOKEN;
// nunca sale hacia el navegador ni a un registro).
//
// Lo que hay que saber (y la pantalla lo dice tal cual):
//   - Para anuncios que NO son políticos, Meta solo devuelve los que se mostraron en la Unión Europea (y Reino Unido).
//     Un anuncio que solo corre en Latinoamérica no aparece por aquí: para esos está «Desde Chrome».
//   - La API no da el video ni la imagen, solo ad_snapshot_url (una página de Meta que muestra el anuncio). La app abre
//     esa página DESDE EL SERVIDOR con el token, saca de ahí las direcciones del video / la imagen (.fbcdn.net) y la
//     miniatura, y las guarda en temp/_ganadores/meta/<id>.json (12 h: las direcciones de Meta vencen). Se pide solo
//     para las tarjetas que están en pantalla, de a 2 a la vez. Si no se puede, la tarjeta ofrece «Ver en Meta».
//   - Validado: activo hace 30 días o más (ad_delivery_date_max = hoy - 30) o más de 100.000 personas alcanzadas
//     (eu_total_reach). Las mismas reglas de lib/inspiracion.js (paraInspiracion) que TrendTrack.
//
//   buscarEnMeta(filtros, { despues }) -> { clave, filtros, fecha, anuncios, siguiente, desdeCache, simulado? }
//   medioDeMeta(metaId)                 -> { tipo, media, miniatura } | { error }
//   probarToken(token?)                 -> { ok, motivo?, mensaje }
//
// En modo prueba nunca se llama a Meta: respuestas simuladas con las muestras de los estilos (3 páginas).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { leerJSON, escribirJSONSeguro } from './archivos.js';
import { modoPrueba } from './modo-prueba.js';
import { leerClave } from './claves.js';
import { DIR_GANADORES, ErrorGanadores, deFacebook, normalizarAnuncio, traerMedio } from './ganadores.js';

/** La versión de la Graph API: se cambia SOLO aquí. */
export const VERSION_GRAPH = 'v21.0';
export const BASE_GRAPH = `https://graph.facebook.com/${VERSION_GRAPH}`;
export const VARIABLE_TOKEN = 'META_ADS_TOKEN';

const DIR_META = path.join(DIR_GANADORES, 'meta');
const DIR_BUSQUEDAS = path.join(DIR_META, 'busquedas');
const CACHE_MS = 12 * 3600000;
const POR_PAGINA = 24;

/** Los países donde la API devuelve anuncios que no son políticos: la Unión Europea y Reino Unido. */
export const PAISES_META = ['ES', 'PT', 'FR', 'IT', 'DE', 'NL', 'BE', 'IE', 'AT', 'PL', 'SE', 'DK', 'FI', 'GR', 'CZ', 'RO', 'HU', 'BG', 'HR', 'SK', 'SI', 'LT', 'LV', 'EE', 'LU', 'MT', 'CY', 'GB'];

export const CAMPOS = [
  'id',
  'page_id',
  'page_name',
  'ad_creative_bodies',
  'ad_creative_link_titles',
  'ad_creative_link_descriptions',
  'ad_creative_link_captions',
  'ad_delivery_start_time',
  'ad_delivery_stop_time',
  'ad_snapshot_url',
  'publisher_platforms',
  'languages',
  'eu_total_reach',
];

// ---------------------------------------------------------------- filtros -> parámetros de ads_archive

/** Normaliza lo que manda la pantalla para esta fuente. */
export function filtrosMeta(f = {}) {
  const paises = (Array.isArray(f.paises) ? f.paises : [])
    .map((p) => String(p || '').toUpperCase())
    .filter((p) => PAISES_META.includes(p))
    .slice(0, 10);
  const paginas = (Array.isArray(f.paginas) ? f.paginas : [])
    .map(String)
    .filter((p) => /^\d{3,25}$/.test(p))
    .slice(0, 10);
  return {
    soloValidados: f.soloValidados !== false,
    paises: paises.length ? [...new Set(paises)] : ['ES'],
    idioma: /^[a-z]{2}$/.test(String(f.idioma || '')) ? String(f.idioma) : 'es',
    texto: String(f.texto || '').replace(/\s+/g, ' ').trim().slice(0, 100),
    paginas,
    formato: ['video', 'image'].includes(f.formato) ? f.formato : '',
  };
}

/** Los parámetros exactos de ads_archive (sin el token, que se suma solo al llamar). */
export function parametrosMeta(f, { hoy = new Date() } = {}) {
  const p = {
    ad_type: 'ALL',
    ad_active_status: 'ACTIVE',
    ad_reached_countries: JSON.stringify(f.paises),
    fields: CAMPOS.join(','),
    limit: String(POR_PAGINA),
  };
  if (f.texto) p.search_terms = f.texto;
  if (f.paginas.length) p.search_page_ids = JSON.stringify(f.paginas);
  if (f.idioma) p.languages = JSON.stringify([f.idioma]);
  if (f.formato) p.media_type = f.formato === 'video' ? 'VIDEO' : 'IMAGE';
  // activo hace 30 días o más: que haya empezado a mostrarse hasta hace 30 días
  if (f.soloValidados) p.ad_delivery_date_max = new Date(hoy.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  return p;
}

// ---------------------------------------------------------------- lo que devuelve Meta -> lo que muestra la app

const primero = (v) => (Array.isArray(v) ? v.find((x) => typeof x === 'string' && x.trim()) : typeof v === 'string' ? v : null) || null;
const dominioDeCaption = (c) => {
  const t = String(c || '').trim().toLowerCase();
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(t) ? t.replace(/^www\./, '').slice(0, 120) : null;
};

/** Un anuncio de ads_archive -> la forma de siempre (normalizarAnuncio de ganadores.js). */
export function normalizarMeta(x, { formato = '', paises = [] } = {}) {
  if (!x || typeof x !== 'object' || !/^\d{5,25}$/.test(String(x.id ?? ''))) return null;
  const inicio = Date.parse(x.ad_delivery_start_time || '');
  const dias = Number.isFinite(inicio) ? Math.max(0, Math.floor((Date.now() - inicio) / 86400000)) : null;
  const caption = primero(x.ad_creative_link_captions);
  const dominio = dominioDeCaption(caption);
  return normalizarAnuncio({
    id: `meta_${x.id}`,
    metaId: String(x.id),
    fuente: 'meta',
    platform: 'facebook',
    status: x.ad_delivery_stop_time ? 'inactive' : 'active',
    daysRunning: dias,
    firstSeenAt: Number.isFinite(inicio) ? new Date(inicio).toISOString() : null,
    // el tipo exacto sale del snapshot; si se buscó solo video o solo imagen, ya se sabe
    media: { type: formato === 'video' ? 'video' : formato === 'image' ? 'image' : 'other' },
    mediaPending: true,
    advertiser: { name: x.page_name, facebookPageId: /^\d{3,25}$/.test(String(x.page_id ?? '')) ? String(x.page_id) : null },
    content: {
      title: primero(x.ad_creative_link_titles),
      body: primero(x.ad_creative_bodies),
      description: primero(x.ad_creative_link_descriptions),
      landingPageDomain: dominio || (caption ? String(caption).slice(0, 120) : null),
    },
    metrics: { reach: Number.isFinite(Number(x.eu_total_reach)) ? Number(x.eu_total_reach) : null },
    platforms: Array.isArray(x.publisher_platforms) ? x.publisher_platforms.map((p) => String(p).toLowerCase()) : [],
    audience: { targetedCountries: paises },
  });
}

/**
 * Un error de la Graph API -> ErrorGanadores con el motivo en palabras simples. (El mensaje de Meta nunca trae el
 * token; igual no se copia entero.)
 */
export function errorDeMeta(j, estado = 400) {
  const e = j?.error && typeof j.error === 'object' ? j.error : {};
  const codigo = Number(e.code);
  const sub = Number(e.error_subcode);
  if (codigo === 190 || sub === 463 || sub === 467) {
    return new ErrorGanadores(401, 'Tu token de Meta venció o ya no sirve: renuévalo en Ajustes › Conexiones (Meta, Biblioteca de anuncios).', { motivo: 'token-vencido' });
  }
  if ([4, 17, 32, 613, 80004].includes(codigo)) {
    return new ErrorGanadores(429, 'Meta pidió esperar un momento (demasiadas consultas seguidas). Vuelve a intentar en unos minutos.', { motivo: 'esperar' });
  }
  if (codigo === 10 || (codigo >= 200 && codigo < 300) || codigo === 2332002 || codigo === 2332004 || /permission|identity|verif/i.test(String(e.message || ''))) {
    return new ErrorGanadores(
      403,
      'Tu token no tiene acceso a la Biblioteca de anuncios. Meta pide verificar tu identidad una vez: entra a facebook.com/ID, termina la verificación y acepta las condiciones en facebook.com/ads/library/api. Después crea un token nuevo.',
      { motivo: 'sin-permiso' }
    );
  }
  if (codigo === 100) return new ErrorGanadores(400, 'Meta no aceptó esa búsqueda. Prueba con otra palabra u otros países.', { motivo: 'busqueda' });
  if (estado >= 500) return new ErrorGanadores(502, 'Meta tiene un problema en este momento. Vuelve a intentar en un rato.', { motivo: 'servicio' });
  return new ErrorGanadores(502, 'Meta respondió algo que no esperaba. Vuelve a intentar en un rato.', { motivo: 'servicio' });
}

/** La respuesta de ads_archive -> { anuncios, siguiente } (siguiente: el cursor de la página que sigue, sin token). */
export function leerRespuestaMeta(j, opciones = {}) {
  if (!j || !Array.isArray(j.data)) return null;
  const despues = typeof j.paging?.cursors?.after === 'string' && j.paging?.next ? j.paging.cursors.after : null;
  return {
    anuncios: j.data.map((x) => normalizarMeta(x, opciones)).filter(Boolean),
    siguiente: despues && /^[A-Za-z0-9_=-]{1,600}$/.test(despues) ? despues : null,
  };
}

// ---------------------------------------------------------------- llamar a Meta

let base = BASE_GRAPH;
let baseSnapshot = 'https://www.facebook.com/ads/archive/render_ad/';
/** (solo pruebas) otro servidor en lugar de Meta. */
export function _paraPruebas({ graph, snapshot } = {}) {
  if (graph) base = graph;
  if (snapshot) baseSnapshot = snapshot;
}

const tokenGuardado = () => leerClave(VARIABLE_TOKEN);

async function pedirGraph(ruta, params, token) {
  const url = new URL(`${base}/${ruta}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', token);
  let r;
  try {
    r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
  } catch (e) {
    // (nunca se anota la dirección: lleva el token)
    throw new ErrorGanadores(502, e?.name === 'TimeoutError' ? 'Meta no respondió a tiempo. Vuelve a intentar.' : 'No pude conectar con Meta. Revisa tu internet y vuelve a intentar.', { motivo: 'sin-conexion' });
  }
  let j = null;
  try {
    j = await r.json();
  } catch {
    j = null;
  }
  if (!r.ok || j?.error) throw errorDeMeta(j, r.status);
  return j;
}

/** Prueba el token (el guardado, o `token` antes de guardarlo) con una búsqueda mínima. Gratis. */
export async function probarToken(token = null) {
  const t = token || tokenGuardado();
  if (!t) return { ok: false, motivo: 'sin-clave', mensaje: 'Todavía no guardaste tu token de Meta.' };
  if (modoPrueba()) return { ok: true, mensaje: 'Tu token de Meta funciona (simulado: en modo prueba no se llama a Meta).' };
  try {
    await pedirGraph('ads_archive', { search_terms: 'oferta', ad_reached_countries: '["ES"]', ad_active_status: 'ACTIVE', fields: 'id', limit: '1' }, t);
    return { ok: true, mensaje: 'Tu token de Meta funciona: ya puedes ver la Biblioteca de anuncios en Inspiración.' };
  } catch (e) {
    const motivo = e.motivo === 'token-vencido' ? 'clave-invalida' : e.motivo === 'sin-conexion' || e.motivo === 'esperar' || e.motivo === 'servicio' ? 'sin-conexion' : 'sin-permisos';
    return { ok: false, motivo, mensaje: e.message };
  }
}

export const hayToken = () => Boolean(tokenGuardado()) || modoPrueba();

const claveDe = (params, despues) => crypto.createHash('sha1').update(JSON.stringify([params, despues || null])).digest('hex').slice(0, 16);

/**
 * Busca en la Biblioteca de anuncios (o devuelve de la caché de 12 h). `despues`: el cursor de «Cargar más».
 * -> { clave, filtros, fecha, anuncios, siguiente, desdeCache, simulado? }
 */
export async function buscarEnMeta(filtrosCrudos, { despues = null, forzar = false } = {}) {
  const filtros = filtrosMeta(filtrosCrudos);
  if (!filtros.texto && !filtros.paginas.length) throw new ErrorGanadores(400, 'Escribe una palabra (o elige una marca) para buscar en la Biblioteca de anuncios de Meta.');
  const cursor = typeof despues === 'string' && /^[A-Za-z0-9_=-]{1,600}$/.test(despues) ? despues : null;
  const params = parametrosMeta(filtros);
  const clave = claveDe(params, cursor);
  const archivo = path.join(DIR_BUSQUEDAS, `${clave}.json`);
  const guardada = leerJSON(archivo);
  if (!forzar && guardada && Date.now() - Date.parse(guardada.fecha) < CACHE_MS) return { ...guardada, desdeCache: true };
  let datos;
  if (modoPrueba()) {
    datos = leerRespuestaMeta(respuestaSimulada(filtros, cursor), { formato: filtros.formato, paises: filtros.paises });
  } else {
    const token = tokenGuardado();
    if (!token) throw new ErrorGanadores(400, 'Falta tu token de Meta: pégalo en Ajustes › Conexiones (Meta, Biblioteca de anuncios).', { motivo: 'sin-clave' });
    const j = await pedirGraph('ads_archive', cursor ? { ...params, after: cursor } : params, token);
    datos = leerRespuestaMeta(j, { formato: filtros.formato, paises: filtros.paises });
    if (!datos) throw new ErrorGanadores(502, 'Meta respondió algo que no esperaba. Vuelve a intentar en un rato.');
  }
  const r = { clave, filtros, fecha: new Date().toISOString(), anuncios: datos.anuncios, siguiente: datos.siguiente, ...(modoPrueba() ? { simulado: true } : {}) };
  escribirJSONSeguro(archivo, r);
  limpiarCache();
  return { ...r, desdeCache: false };
}

function limpiarCache() {
  for (const dir of [DIR_BUSQUEDAS, DIR_META]) {
    try {
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
        const abs = path.join(dir, f);
        if (Date.now() - fs.statSync(abs).mtimeMs > 7 * 86400000) fs.rmSync(abs, { force: true });
      }
    } catch {
      /* nada que limpiar */
    }
  }
}

// ---------------------------------------------------------------- el video o la imagen (desde el snapshot)

const desescapar = (u) =>
  String(u || '')
    .replace(/\\\//g, '/')
    .replace(/\\u0025/gi, '%')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u003[dD]/g, '=')
    .replace(/&amp;/g, '&');

/**
 * Saca de la página del snapshot (ad_snapshot_url) el video, la imagen y la miniatura del creativo.
 * Solo acepta direcciones https de .fbcdn.net / facebook.com. -> { tipo: 'video'|'imagen', media, miniatura } | null
 */
export function extraerMediosSnapshot(html) {
  const t = String(html || '').slice(0, 4 * 1024 * 1024);
  const buscar = (claves) => {
    for (const k of claves) {
      const re = new RegExp(`"${k}"\\s*:\\s*"((?:\\\\.|[^"\\\\]){10,3000})"`, 'g');
      for (const m of t.matchAll(re)) {
        const u = deFacebook(desescapar(m[1]));
        if (u && /\.fbcdn\.net$/i.test(new URL(u).hostname)) return u;
      }
    }
    return null;
  };
  const etiqueta = (re) => {
    for (const m of t.matchAll(re)) {
      const u = deFacebook(desescapar(m[1]));
      if (u && /\.fbcdn\.net$/i.test(new URL(u).hostname)) return u;
    }
    return null;
  };
  const video = buscar(['video_hd_url', 'video_sd_url', 'playable_url_quality_hd', 'playable_url']) || etiqueta(/<video[^>]*?\ssrc="([^"]+)"/gi) || etiqueta(/<source[^>]*?\ssrc="([^"]+)"/gi);
  const poster = buscar(['video_preview_image_url', 'preferred_thumbnail', 'thumbnail_url']) || etiqueta(/<video[^>]*?\sposter="([^"]+)"/gi);
  const imagen = buscar(['original_image_url', 'resized_image_url', 'watermarked_resized_image_url']);
  if (video) return { tipo: 'video', media: video, miniatura: poster || imagen || null };
  // sin datos: la imagen más grande del creativo (no los íconos de la página, que son chicos: s60x60, p50x50…)
  const img = imagen || etiqueta(/<img[^>]*?\ssrc="(https:\/\/[^"]*fbcdn\.net\/[^"]*)"(?![^>]*\b(?:width|height)="(?:[1-9]|[1-5]\d|60)")/gi);
  if (img && !/[sp](?:[1-9]|[1-5]\d|60)x(?:[1-9]|[1-5]\d|60)/.test(img)) return { tipo: 'imagen', media: img, miniatura: img };
  return null;
}

// de a 2 a la vez (Meta corta si se le piden muchas páginas juntas)
const CONCURRENCIA = 2;
let activos = 0;
const espera = [];
const turno = () =>
  new Promise((r) => {
    if (activos < CONCURRENCIA) {
      activos++;
      r();
    } else espera.push(r);
  });
const soltar = () => {
  const sig = espera.shift();
  if (sig) sig();
  else activos--;
};
const enCurso = new Map();

const archivoMedio = (metaId) => path.join(DIR_META, `${metaId}.json`);

/** El video o la imagen de un anuncio de Meta (caché 12 h; un error se reintenta después de 1 h). */
export async function medioDeMeta(metaId) {
  const id = String(metaId || '');
  if (!/^\d{5,25}$/.test(id)) throw new ErrorGanadores(400, 'Ese anuncio no es de la Biblioteca de anuncios.');
  const guardado = leerJSON(archivoMedio(id));
  if (guardado && Date.now() - Date.parse(guardado.fecha) < (guardado.error ? 3600000 : CACHE_MS)) return limpio(guardado);
  if (enCurso.has(id)) return enCurso.get(id);
  const p = (async () => {
    await turno();
    try {
      const r = modoPrueba() ? medioSimulado(id) : await sacarDelSnapshot(id);
      const valor = { fecha: new Date().toISOString(), ...(r || { error: true }) };
      escribirJSONSeguro(archivoMedio(id), valor);
      return limpio(valor);
    } finally {
      soltar();
      enCurso.delete(id);
    }
  })();
  enCurso.set(id, p);
  return p;
}
const limpio = (v) => (v.error ? { error: 'No pude sacar el video de Meta.' } : { tipo: v.tipo, media: v.media, miniatura: v.miniatura || null });

async function sacarDelSnapshot(id) {
  const token = tokenGuardado();
  if (!token) return null;
  const url = new URL(baseSnapshot);
  url.searchParams.set('id', id);
  url.searchParams.set('access_token', token);
  try {
    let actual = url.toString();
    let r;
    // la página del snapshot puede redirigir, pero solo dentro de facebook.com
    for (let i = 0; i < 4; i++) {
      r = await fetch(actual, {
        redirect: 'manual',
        headers: { Accept: 'text/html', 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8', 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' },
        signal: AbortSignal.timeout(20000),
      });
      if (r.status < 300 || r.status >= 400) break;
      const destino = r.headers.get('location');
      const siguiente = destino ? new URL(destino, actual) : null;
      if (!siguiente || !(deFacebook(siguiente.toString()) || siguiente.origin === new URL(baseSnapshot).origin)) return null;
      actual = siguiente.toString();
    }
    if (!r?.ok) return null;
    const largo = Number(r.headers.get('content-length') || 0);
    if (largo > 4 * 1024 * 1024) return null;
    return extraerMediosSnapshot(await r.text());
  } catch {
    return null; // (sin anotar la dirección: lleva el token)
  }
}

// ---------------------------------------------------------------- modo prueba

const SIM = [
  { muestra: 'claymation', tipo: 'video', marca: 'Natura Clay', pagina: '100000000000001', copy: 'Así se va la hinchazón en 7 días 🌿 Envío a toda España.', titulo: 'Desinflama en 7 días', caption: 'naturaclay.es' },
  { muestra: 'crochet', tipo: 'video', marca: 'Tejidos de la Abuela', pagina: '100000000000002', copy: 'La historia de Lupita y su rodilla 🧶', titulo: 'Lupita volvió a caminar', caption: 'tejidosabuela.com' },
  { muestra: 'ugc', tipo: 'video', marca: 'Colágeno Vida', pagina: '100000000000003', copy: 'Chicas, les cuento mi experiencia con este colágeno 💕', titulo: 'Mi experiencia real', caption: 'colagenovida.es' },
  { muestra: 'estilo-pixar', tipo: 'video', marca: 'Secretos de Rosa', pagina: '100000000000004', copy: 'Doña Rosa descubrió el secreto de su abuela ✨', titulo: 'El secreto de la abuela', caption: 'secretosderosa.com' },
  { muestra: 'skeleton', tipo: 'imagen', marca: 'Huesos de Acero', pagina: '100000000000005', copy: 'Tu esqueleto te está pidiendo ayuda 💀 Calcio + D3.', titulo: 'Tu esqueleto habla', caption: 'huesosdeacero.eu' },
  { muestra: 'zack-d-films', tipo: 'video', marca: 'Ciencia Pura', pagina: '100000000000006', copy: 'Esto es lo que pasa en tus venas cuando comes azúcar 🫀', titulo: 'Dentro de tus venas', caption: 'cienciapura.es' },
  { muestra: 'estilo-lego', tipo: 'imagen', marca: 'Bloques Fit', pagina: '100000000000007', copy: 'Armamos tu rutina pieza por pieza.', titulo: 'Pieza por pieza', caption: 'bloquesfit.com' },
  { muestra: 'realista-narrado', tipo: 'video', marca: 'Vitalabh', pagina: '100000000000008', copy: 'Les debemos una disculpa: la oferta se acaba hoy.', titulo: 'Les debemos una disculpa', caption: 'vitalabh.com' },
];
const PAGINAS_SIM = 3;

/** (modo prueba) una respuesta con la forma de ads_archive, con paging como el de Meta. */
export function respuestaSimulada(f, cursor) {
  const pagina = cursor && /^sim(\d)$/.test(cursor) ? Number(cursor.slice(3)) : 1;
  const filtrados = SIM.filter((b) => (!f.formato || (f.formato === 'image' ? b.tipo === 'imagen' : b.tipo === 'video')) && (!f.paginas.length || f.paginas.includes(b.pagina)));
  const data = [];
  for (let k = 0; k < 8 && filtrados.length; k++) {
    const n = (pagina - 1) * 8 + k + 1;
    const b = filtrados[(n - 1) % filtrados.length];
    const dias = 10 + ((n * 23) % 150);
    data.push({
      id: String(900000000000000 + n * 10 + SIM.indexOf(b)),
      page_id: b.pagina,
      page_name: b.marca,
      ad_creative_bodies: [b.copy],
      ad_creative_link_titles: [b.titulo],
      ad_creative_link_descriptions: ['Pago seguro y envío rápido'],
      ad_creative_link_captions: [b.caption.toUpperCase()],
      ad_delivery_start_time: new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10),
      ad_snapshot_url: `https://www.facebook.com/ads/archive/render_ad/?id=${n}&access_token=SIMULADO`,
      publisher_platforms: ['facebook', 'instagram'],
      languages: ['es'],
      eu_total_reach: 1000 * (((n * 37) % 400) + 5),
    });
  }
  return { data, paging: pagina < PAGINAS_SIM ? { cursors: { before: 'x', after: `sim${pagina + 1}` }, next: `https://graph.facebook.com/${VERSION_GRAPH}/ads_archive?after=sim${pagina + 1}&access_token=SIMULADO` } : { cursors: { before: 'x', after: 'fin' } } };
}

function medioSimulado(id) {
  const b = SIM[Number(id) % 10] || null;
  // uno de cada 9 «falla» a propósito: así se ve «Ver en Meta» en modo prueba
  if (!b || Number(id) % 9 === 0) return null;
  return { tipo: b.tipo, media: `/archivos/muestra/${b.muestra}/${b.tipo === 'imagen' ? 'imagen.jpg' : 'video.mp4'}`, miniatura: `/archivos/muestra/${b.muestra}/imagen.jpg` };
}

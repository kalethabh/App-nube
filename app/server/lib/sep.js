// S.E.P · TUS ANUNCIOS DE META QUE MÁS VENDEN (2026-11-20k). Lee tu cuenta publicitaria de Meta (la API de Marketing,
// permiso `ads_read`) y trae, del rango elegido, tus anuncios con sus compras y métricas (gasto, ingresos, ROAS, CPA,
// CTR, CPM, frecuencia), su imagen y las compras día por día. Con eso el SISTEMA S.E.P le pone a cada anuncio una
// decisión, con sus razones y lo que conviene hacer:
//
//   escalar   vende bien, sostenido y sin fatiga  → subir presupuesto de a poco y duplicarlo a públicos amplios.
//   variar    vende pero se está cansando (frecuencia alta o el CTR cae) → variaciones del ganador (el agente).
//   sostener  cerca del objetivo → dejarlo y probarle ganchos nuevos.
//   pausar    gastó sin vender (o muy por debajo del objetivo) → pausar y rehacer con otro ángulo.
//   probando  todavía sin datos suficientes → esperar.
// Las reglas usan TU objetivo (ROAS objetivo y, si quieres, CPA máximo), que se cambia en la pantalla.
//
// El token: META_MARKETING_TOKEN (Ajustes › Conexiones › «Meta, tu cuenta publicitaria») o, si no está, el de la
// Biblioteca (META_ADS_TOKEN) por si ya tiene ads_read. Solo LEE: nunca cambia nada en tu cuenta.
// En modo prueba nunca se llama a Meta: datos simulados.
//
//   cuentas()                                        -> { bms: [{ id, nombre, cuentas }], cuentas: [{ id, nombre, moneda, activa, bm }] }
//   campanas({ cuenta, rango })                      -> { campanas: [{ id, nombre, compras, gasto }] }
//   informe({ alcance: 'bm'|'cuenta'|'campana', bm, cuenta, campana, rango, roas, cpa, forzar })
//                                                    -> { alcance, cuentas, moneda (null si el BM mezcla monedas), totales, serie, anuncios, reglas, fecha }
//   imagenDe(adId)                                    -> ruta local de su imagen (para hacer variaciones)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { TEMP } from './rutas.js';
import { leerJSON } from './archivos.js';
import { escribirJSON, ErrorApp } from './productos.js';
import { leerClave } from './claves.js';
import { modoPrueba } from './procesos.js';

// (SEP_GRAPH_BASE y SEP_TOKEN_PRUEBA: solo para la prueba con un Meta simulado, probar-sep.mjs)
const GRAPH = process.env.SEP_GRAPH_BASE || 'https://graph.facebook.com/v21.0';
const DIR = path.join(TEMP, '_sep');
const CACHE_MS = 30 * 60000;
const RANGOS = { '7d': 'last_7d', '14d': 'last_14d', '30d': 'last_30d', '90d': 'last_90d' };
// las compras, sin contarlas dos veces: la primera que exista en este orden
const COMPRAS = ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase', 'onsite_web_purchase'];

const token = () => process.env.SEP_TOKEN_PRUEBA || leerClave('META_MARKETING_TOKEN') || leerClave('META_ADS_TOKEN') || '';
export const hayToken = () => modoPrueba() || Boolean(token());
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r2 = (n) => Math.round(n * 100) / 100;

async function graph(ruta, params = {}) {
  const t = token();
  if (!t) throw new ErrorApp(400, 'Falta conectar tu cuenta publicitaria de Meta: pega tu token en Ajustes › Conexiones (Meta, tu cuenta publicitaria).', { motivo: 'sin-clave' });
  const url = new URL(/^https?:\/\//.test(ruta) ? ruta : `${GRAPH}/${ruta}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  url.searchParams.set('access_token', t);
  let r;
  try {
    r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(45000) });
  } catch (e) {
    throw new ErrorApp(502, e?.name === 'TimeoutError' ? 'Meta no respondió a tiempo. Vuelve a intentar.' : 'No pude conectar con Meta. Revisa tu internet.', { motivo: 'sin-conexion' });
  }
  const j = await r.json().catch(() => null);
  if (!r.ok || j?.error) {
    const e = j?.error || {};
    if (e.code === 190) throw new ErrorApp(401, 'Tu token de Meta venció o no es válido: genera uno nuevo y pégalo en Ajustes › Conexiones.', { motivo: 'token' });
    if ([10, 200, 294].includes(e.code) || /permission/i.test(e.message || '')) throw new ErrorApp(403, 'Tu token de Meta no tiene permiso para leer tu cuenta publicitaria (le falta «ads_read»). Genera uno con ads_read y pégalo en Ajustes › Conexiones › Meta, tu cuenta publicitaria.', { motivo: 'permisos' });
    if ([4, 17, 32, 613].includes(e.code)) throw new ErrorApp(429, 'Meta pide esperar un poco (muchas consultas seguidas). Vuelve a intentar en unos minutos.', { motivo: 'esperar' });
    throw new ErrorApp(502, `Meta respondió: ${e.message || `error ${r.status}`}`, { motivo: 'servicio' });
  }
  return j;
}
async function todas(ruta, params, maxPaginas = 5) {
  const out = [];
  let j = await graph(ruta, params);
  for (let i = 0; i < maxPaginas; i++) {
    out.push(...(j.data || []));
    if (!j.paging?.next) break;
    j = await graph(j.paging.next);
  }
  return out;
}

/** Del arreglo actions/action_values: las compras (sin duplicar tipos). */
function compras(lista) {
  const l = Array.isArray(lista) ? lista : [];
  for (const tipo of COMPRAS) {
    const x = l.find((a) => a.action_type === tipo);
    if (x) return num(x.value);
  }
  return 0;
}

// ---------------------------------------------------------------- las cuentas

const SIMULADAS = [
  { id: 'act_100200300', nombre: 'Aguaje Colombia', moneda: 'USD', activa: true, bm: { id: '900100', nombre: 'BM Kads' } },
  { id: 'act_100200301', nombre: 'VitalDrops Colombia', moneda: 'USD', activa: true, bm: { id: '900100', nombre: 'BM Kads' } },
  { id: 'act_100200302', nombre: 'Cuenta personal', moneda: 'USD', activa: true, bm: null },
];

/** (2026-11-20l) Tus cuentas publicitarias con su Business Manager: { bms: [{ id, nombre, cuentas: [ids] }], cuentas }. */
let memoCuentas = null; // { hasta, valor } (10 min: no se le pregunta a Meta en cada informe)
export async function cuentas({ forzar = false } = {}) {
  if (!forzar && memoCuentas && memoCuentas.hasta > Date.now() && memoCuentas.token === token()) return memoCuentas.valor;
  const valor = await cuentasDeMeta();
  memoCuentas = { hasta: Date.now() + 10 * 60000, valor, token: token() };
  return valor;
}
async function cuentasDeMeta() {
  let lista;
  let simul = false;
  if (modoPrueba() && !process.env.SEP_GRAPH_BASE) {
    lista = SIMULADAS;
    simul = true;
  } else {
    const l = await todas('me/adaccounts', { fields: 'id,name,account_status,currency,business{id,name}', limit: '100' }, 5);
    lista = l.map((c) => ({ id: c.id, nombre: c.name || c.id, moneda: c.currency || 'USD', activa: c.account_status === 1, bm: c.business?.id ? { id: c.business.id, nombre: c.business.name || c.business.id } : null }));
  }
  const bms = new Map();
  for (const c of lista) {
    const k = c.bm?.id || 'sin-bm';
    const b = bms.get(k) || { id: k, nombre: c.bm?.nombre || 'Sin Business Manager', cuentas: [] };
    b.cuentas.push(c.id);
    bms.set(k, b);
  }
  return { bms: [...bms.values()].sort((a, b) => (a.id === 'sin-bm') - (b.id === 'sin-bm') || a.nombre.localeCompare(b.nombre)), cuentas: lista, ...(simul ? { simulado: true } : {}) };
}

/** Las campañas de una cuenta con gasto en el rango (las que más venden primero): { campanas: [{ id, nombre, compras, gasto }] }. */
export async function campanas({ cuenta, rango = '30d' } = {}) {
  if (!RANGOS[rango]) rango = '30d';
  if (modoPrueba() && !process.env.SEP_GRAPH_BASE) {
    const por = new Map();
    for (const a of simulado(rango, cuenta)) {
      const x = por.get(a.campanaId) || { id: a.campanaId, nombre: a.campana, compras: 0, gasto: 0 };
      for (const d of a.serie) {
        x.compras += d.compras;
        x.gasto = r2(x.gasto + d.gasto);
      }
      por.set(a.campanaId, x);
    }
    return { campanas: [...por.values()].sort((a, b) => b.compras - a.compras) };
  }
  if (!/^act_\d{3,30}$/.test(String(cuenta || ''))) throw new ErrorApp(400, 'Elige tu cuenta publicitaria.');
  const filas = await todas(`${cuenta}/insights`, { level: 'campaign', date_preset: RANGOS[rango], fields: 'campaign_id,campaign_name,spend,actions', limit: '500' }, 4);
  return { campanas: filas.map((f) => ({ id: f.campaign_id, nombre: f.campaign_name, compras: compras(f.actions), gasto: r2(num(f.spend)) })).filter((c) => c.gasto > 0).sort((a, b) => b.compras - a.compras || b.gasto - a.gasto) };
}

// ---------------------------------------------------------------- el sistema S.E.P

export function reglas({ roas = 2, cpa = null } = {}) {
  return { roas: Math.max(0.1, num(roas) || 2), cpa: num(cpa) > 0 ? num(cpa) : null };
}

/** La decisión S.E.P de un anuncio, con sus razones y lo que conviene hacer. */
export function decidir(a, obj) {
  const razones = [];
  const dias = a.serie || [];
  const mitad = Math.floor(dias.length / 2);
  const ctrDe = (d) => {
    const imp = d.reduce((s, x) => s + num(x.impresiones), 0);
    return imp ? d.reduce((s, x) => s + num(x.clics), 0) / imp : 0;
  };
  const ctrAntes = ctrDe(dias.slice(0, mitad));
  const ctrDespues = ctrDe(dias.slice(mitad));
  const caeCtr = mitad >= 2 && ctrAntes > 0 && ctrDespues < ctrAntes * 0.75;
  const ultimos3 = dias.slice(-3).reduce((s, x) => s + num(x.compras), 0);
  const cpaRef = obj.cpa || (a.compras ? a.gasto / a.compras : null);
  const fatiga = a.frecuencia >= 2.5 || caeCtr;
  const okCpa = !obj.cpa || (a.cpa !== null && a.cpa <= obj.cpa);

  if (a.compras < 3 && a.gasto < (obj.cpa ? obj.cpa * 2 : 30)) {
    razones.push(`Lleva ${a.compras} compra${a.compras === 1 ? '' : 's'} con ${r2(a.gasto)} de gasto: todavía son pocos datos.`);
    return { tipo: 'probando', razones, acciones: ['Déjalo correr hasta tener al menos 3 compras o gastar 2 veces tu CPA objetivo antes de decidir.'] };
  }
  if (a.compras === 0 || a.roas < obj.roas * 0.6 || (obj.cpa && a.cpa !== null && a.cpa > obj.cpa * 1.6)) {
    if (a.compras === 0) razones.push(`Gastó ${r2(a.gasto)} sin ninguna compra.`);
    else razones.push(`ROAS ${r2(a.roas)}, muy por debajo de tu objetivo (${obj.roas}).`);
    if (obj.cpa && a.cpa !== null && a.cpa > obj.cpa) razones.push(`CPA ${r2(a.cpa)}, por encima de tu máximo (${obj.cpa}).`);
    if (a.ctr < 0.8) razones.push(`CTR de ${r2(a.ctr)} %: el gancho no está frenando el scroll.`);
    return { tipo: 'pausar', razones, acciones: ['Pausarlo para no seguir gastando.', a.ctr < 0.8 ? 'Rehacerlo con otro gancho y otro ángulo (el problema empieza en los primeros segundos).' : 'El gancho funciona pero no convierte: revisa la oferta y la página, o prueba otro ángulo.'] };
  }
  if (a.roas >= obj.roas * 1.2 && a.compras >= 5 && okCpa && !fatiga && ultimos3 > 0) {
    razones.push(`ROAS ${r2(a.roas)} (${Math.round((a.roas / obj.roas - 1) * 100)} % sobre tu objetivo) con ${a.compras} compras.`);
    razones.push(`Frecuencia ${r2(a.frecuencia)}: el público todavía no está cansado.`);
    if (ultimos3) razones.push(`Sigue vendiendo: ${ultimos3} compras en los últimos 3 días.`);
    return {
      tipo: 'escalar',
      razones,
      acciones: [
        'Vertical: súbele el presupuesto 20–30 % cada 48–72 h mientras el ROAS se mantenga.',
        'Horizontal: duplícalo en una campaña CBO con público amplio (y otro país si aplica).',
        'Antes de que se canse: prepara 3 a 5 variaciones (nivel A y B) para rotarlas.',
      ],
    };
  }
  if (a.roas >= obj.roas && okCpa && fatiga) {
    if (a.frecuencia >= 2.5) razones.push(`Frecuencia ${r2(a.frecuencia)}: el mismo público ya lo vio varias veces.`);
    if (caeCtr) razones.push(`El CTR bajó de ${r2(ctrAntes * 100)} % a ${r2(ctrDespues * 100)} %: se está cansando.`);
    razones.push(`Todavía rinde: ROAS ${r2(a.roas)}.`);
    return { tipo: 'variar', razones, acciones: ['Hazle variaciones con el agente: conserva el ángulo y cambia gancho, escena o formato (niveles A, B y C).', 'No le subas presupuesto hasta que una variación lo reemplace.', 'Si puedes, abre el público (amplio o lookalike) para bajar la frecuencia.'] };
  }
  razones.push(`ROAS ${r2(a.roas)}, ${a.roas >= obj.roas ? 'en tu objetivo' : 'cerca de tu objetivo'} (${obj.roas}).`);
  if (a.compras) razones.push(`${a.compras} compras a un CPA de ${r2(a.cpa)}.`);
  return { tipo: 'sostener', razones, acciones: ['Déjalo con el mismo presupuesto.', 'Pruébale 2 o 3 ganchos nuevos (variaciones de nivel A) para encontrar uno que lo empuje a escalar.'] };
}

// ---------------------------------------------------------------- el informe

function simulado(rango, cuenta = 'act_100200300') {
  const n = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 }[rango] || 30;
  const hoy = new Date();
  const fechas = Array.from({ length: n }, (_, i) => new Date(hoy.getTime() - (n - 1 - i) * 86400000).toISOString().slice(0, 10));
  const base = [
    ['El secreto del aguaje · glúteos', 'Aguaje · Prospección', 9, 0.9, 1.6, 1.9],
    ['Antes y después 30 días', 'Aguaje · Prospección', 6, 0.75, 3.1, 1.4],
    ['Testimonio Yuliana UGC', 'VitalDrops · Amplio', 4, 0.55, 1.8, 1.3],
    ['Zack · cómo funciona la maca', 'VitalDrops · Amplio', 0.9, 0.42, 1.5, 1.1],
    ['Oferta 3x2 carrusel', 'Aguaje · Remarketing', 0.06, 0.02, 1.2, 0.9],
    ['Pixar · la flaca que come', 'VitalDrops · Pruebas', 0.1, 0.05, 1.2, 0.6],
    ['Gancho callejero nuevo', 'Aguaje · Pruebas', 0.3, 0.25, 1.0, 0.5],
  ];
  // cada cuenta simulada tiene sus anuncios (la de Aguaje, la de VitalDrops y la personal, con uno solo)
  const de = { act_100200300: (c) => /Aguaje/.test(c), act_100200301: (c) => /VitalDrops/.test(c), act_100200302: (c, k) => k === 6 }[cuenta] || (() => true);
  return base.map((x, k) => [x, k]).filter(([x, k]) => de(x[1], k)).map(([[nombre, campana, ventasDia, gastoDia, frec, ctr], k]) => {
    const serie = fechas.map((fecha, i) => {
      const ruido = 0.6 + ((Math.sin(i * 1.7 + k) + 1) / 2) * 0.8;
      const cansa = k === 1 ? Math.max(0.45, 1 - i / (n * 1.4)) : 1;
      const comprasDia = Math.max(0, Math.round(ventasDia * ruido * cansa * (k === 5 ? 0 : 1)));
      const gasto = r2(gastoDia * 40 * (0.85 + ruido * 0.2));
      const impresiones = Math.round(gasto * 85);
      return { fecha, compras: comprasDia, gasto, ingresos: r2(comprasDia * 39.9), impresiones, clics: Math.round(impresiones * (ctr / 100) * cansa) };
    });
    return { id: `2385000000${k}`, nombre, campana, campanaId: `120${[...campana].reduce((t, c) => (t * 31 + c.charCodeAt(0)) % 1e8, 7)}`, conjunto: `${campana} · conjunto ${k + 1}`, estado: k === 6 ? 'PAUSED' : 'ACTIVE', frecuencia: frec, serie, titulo: nombre, texto: 'Texto del anuncio de prueba.', miniatura: null };
  });
}

/** Junta lo de un anuncio (sumas del rango) y calcula sus métricas. */
function metricas(a) {
  const s = a.serie || [];
  const sum = (k) => s.reduce((t, x) => t + num(x[k]), 0);
  const gasto = a.gasto ?? sum('gasto');
  const comprasN = a.compras ?? sum('compras');
  const ingresos = a.ingresos ?? sum('ingresos');
  const impresiones = a.impresiones ?? sum('impresiones');
  const clics = a.clics ?? sum('clics');
  return {
    ...a,
    gasto: r2(gasto),
    compras: comprasN,
    ingresos: r2(ingresos),
    impresiones,
    clics,
    roas: gasto ? r2(ingresos / gasto) : 0,
    cpa: comprasN ? r2(gasto / comprasN) : null,
    ctr: impresiones ? r2((clics / impresiones) * 100) : 0,
    cpm: impresiones ? r2((gasto / impresiones) * 1000) : 0,
  };
}

async function deMeta(cuenta, rango, { campana = null } = {}) {
  const preset = RANGOS[rango];
  const campos = 'ad_id,ad_name,adset_name,campaign_id,campaign_name,spend,impressions,reach,frequency,inline_link_clicks,actions,action_values';
  const deCampana = campana ? [{ field: 'campaign.id', operator: 'EQUAL', value: campana }] : null;
  const filas = await todas(`${cuenta}/insights`, { level: 'ad', date_preset: preset, fields: campos, limit: '500', ...(deCampana ? { filtering: deCampana } : {}) }, 4);
  let anuncios = filas
    .map((f) => ({
      id: f.ad_id,
      nombre: f.ad_name,
      campana: f.campaign_name,
      campanaId: f.campaign_id || null,
      conjunto: f.adset_name,
      gasto: num(f.spend),
      impresiones: num(f.impressions),
      clics: num(f.inline_link_clicks),
      frecuencia: r2(num(f.frequency)),
      compras: compras(f.actions),
      ingresos: compras(f.action_values),
    }))
    .filter((a) => a.gasto > 0);
  // los que más venden primero; de ellos, la serie diaria, la imagen y el estado
  anuncios.sort((a, b) => b.compras - a.compras || b.ingresos - a.ingresos || b.gasto - a.gasto);
  anuncios = anuncios.slice(0, 40);
  const ids = anuncios.map((a) => a.id);
  if (ids.length) {
    const diarias = await todas(`${cuenta}/insights`, { level: 'ad', date_preset: preset, time_increment: '1', fields: 'ad_id,date_start,spend,impressions,inline_link_clicks,actions,action_values', filtering: [{ field: 'ad.id', operator: 'IN', value: ids }], limit: '500' }, 10);
    const porAd = new Map();
    for (const d of diarias) {
      const l = porAd.get(d.ad_id) || [];
      l.push({ fecha: d.date_start, gasto: num(d.spend), compras: compras(d.actions), ingresos: compras(d.action_values), impresiones: num(d.impressions), clics: num(d.inline_link_clicks) });
      porAd.set(d.ad_id, l);
    }
    for (let i = 0; i < ids.length; i += 50) {
      const lote = ids.slice(i, i + 50);
      const info = await graph('', { ids: lote.join(','), fields: 'effective_status,creative{thumbnail_url,image_url,title,body,object_type}' }).catch(() => ({}));
      for (const a of anuncios.slice(i, i + 50)) {
        const x = info?.[a.id];
        a.estado = x?.effective_status || null;
        a.miniatura = x?.creative?.image_url || x?.creative?.thumbnail_url || null;
        a.titulo = x?.creative?.title || null;
        a.texto = x?.creative?.body || null;
        a.tipo = x?.creative?.object_type || null;
      }
    }
    for (const a of anuncios) a.serie = (porAd.get(a.id) || []).sort((x, y) => x.fecha.localeCompare(y.fecha));
  }
  return anuncios;
}

/**
 * (2026-11-20l) El informe de lo que elijas ver: `alcance` 'bm' (todas las cuentas de un Business Manager, juntas),
 * 'cuenta' (una cuenta publicitaria) o 'campana' (una campaña de una cuenta).
 */
export async function informe({ alcance = 'cuenta', bm = null, cuenta = null, campana = null, rango = '30d', roas, cpa, forzar = false } = {}) {
  if (!RANGOS[rango]) rango = '30d';
  if (!['bm', 'cuenta', 'campana'].includes(alcance)) alcance = 'cuenta';
  const obj = reglas({ roas, cpa });
  const simul = modoPrueba() && !process.env.SEP_GRAPH_BASE;
  const todasLasCuentas = (await cuentas()).cuentas;
  const porId = new Map(todasLasCuentas.map((c) => [c.id, c]));
  let deCuentas;
  if (alcance === 'bm') {
    const b = (await cuentas()).bms.find((x) => x.id === String(bm || ''));
    if (!b) throw new ErrorApp(400, 'Elige tu Business Manager.');
    deCuentas = b.cuentas;
  } else {
    if (!/^act_\d{3,30}$/.test(String(cuenta || '')) || !porId.has(cuenta)) throw new ErrorApp(400, 'Elige tu cuenta publicitaria.');
    deCuentas = [cuenta];
  }
  if (alcance === 'campana' && !/^\d{1,30}$/.test(String(campana || ''))) throw new ErrorApp(400, 'Elige la campaña.');
  const clave = `${alcance}|${deCuentas.join(',')}|${alcance === 'campana' ? campana : ''}|${rango}`;
  const archivo = path.join(DIR, `${crypto.createHash('sha1').update(clave).digest('hex').slice(0, 16)}.json`);
  let datos = leerJSON(archivo);
  if (forzar || !datos || Date.now() - Date.parse(datos.fecha) > CACHE_MS) {
    const juntos = [];
    // de a 3 cuentas a la vez (un BM grande no satura a Meta)
    for (let k = 0; k < deCuentas.length; k += 3) {
      const tanda = await Promise.all(
        deCuentas.slice(k, k + 3).map(async (c) => {
          let l = simul ? simulado(rango, c) : await deMeta(c, rango, { campana: alcance === 'campana' ? campana : null });
          if (simul && alcance === 'campana') l = l.filter((a) => a.campanaId === campana);
          return l.map((a) => ({ ...a, cuenta: c, cuentaNombre: porId.get(c)?.nombre || c, moneda: porId.get(c)?.moneda || 'USD' }));
        }),
      );
      juntos.push(...tanda.flat());
    }
    datos = { clave, rango, fecha: new Date().toISOString(), anuncios: juntos };
    fs.mkdirSync(DIR, { recursive: true });
    escribirJSON(archivo, datos);
  }
  const anuncios = datos.anuncios
    .map(metricas)
    .map((a) => ({ ...a, decision: decidir(a, obj) }))
    .sort((a, b) => b.compras - a.compras || b.ingresos - a.ingresos || b.gasto - a.gasto)
    .slice(0, 80);
  // un BM con cuentas en monedas distintas: el dinero no se suma (las compras sí)
  const monedas = [...new Set(anuncios.map((a) => a.moneda))];
  const mezcla = monedas.length > 1;
  // la cuenta día por día (la suma de los anuncios) y los totales
  const porDia = new Map();
  for (const a of anuncios) for (const d of a.serie || []) {
    const x = porDia.get(d.fecha) || { fecha: d.fecha, gasto: 0, compras: 0, ingresos: 0 };
    x.gasto += num(d.gasto);
    x.compras += num(d.compras);
    x.ingresos += num(d.ingresos);
    porDia.set(d.fecha, x);
  }
  const serie = [...porDia.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)).map((x) => ({ ...x, gasto: r2(x.gasto), ingresos: r2(x.ingresos) }));
  const tot = metricas({ gasto: anuncios.reduce((s, a) => s + a.gasto, 0), compras: anuncios.reduce((s, a) => s + a.compras, 0), ingresos: anuncios.reduce((s, a) => s + a.ingresos, 0), impresiones: anuncios.reduce((s, a) => s + a.impresiones, 0), clics: anuncios.reduce((s, a) => s + a.clics, 0) });
  const cuantos = {};
  for (const a of anuncios) cuantos[a.decision.tipo] = (cuantos[a.decision.tipo] || 0) + 1;
  const sinDinero = (x) => (mezcla ? null : x);
  return {
    alcance,
    cuentas: deCuentas.map((c) => ({ id: c, nombre: porId.get(c)?.nombre || c })),
    moneda: mezcla ? null : monedas[0] || porId.get(deCuentas[0])?.moneda || 'USD',
    mezclaDeMonedas: mezcla ? monedas : null,
    rango,
    fecha: datos.fecha,
    reglas: obj,
    totales: { gasto: sinDinero(tot.gasto), compras: tot.compras, ingresos: sinDinero(tot.ingresos), roas: sinDinero(tot.roas), cpa: sinDinero(tot.cpa), ctr: tot.ctr, cpm: sinDinero(tot.cpm) },
    serie: mezcla ? serie.map((x) => ({ ...x, gasto: null, ingresos: null })) : serie,
    cuantos,
    anuncios,
    ...(simul ? { simulado: true } : {}),
  };
}

/** La imagen de un anuncio guardada en la app (para usarla como referencia del agente de variaciones). */
export async function imagenDe(adId) {
  if (!/^\d{1,30}$/.test(String(adId || ''))) throw new ErrorApp(400, 'Ese anuncio no existe.');
  const destino = path.join(DIR, 'imagenes', `${adId}.jpg`);
  if (fs.existsSync(destino)) return destino;
  let url = null;
  for (const f of fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((n) => n.endsWith('.json')) : []) {
    const a = (leerJSON(path.join(DIR, f))?.anuncios || []).find((x) => x.id === adId);
    if (a?.miniatura) url = a.miniatura;
    if (url) break;
  }
  if (!url) throw new ErrorApp(404, 'Ese anuncio no tiene imagen (o es un video sin portada).');
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) }).catch(() => null);
  if (!r?.ok) throw new ErrorApp(502, 'No pude bajar la imagen del anuncio desde Meta.');
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
  return destino;
}

export const _paraPruebas = { decidir, metricas, compras, simulado };

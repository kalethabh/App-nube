// «Salud de plataformas» (2026-11-18, pedido del usuario después de la falla de ElevenLabs de ese día): el estado de
// los servicios que usa la app, para saber de un vistazo si algo que falla es de ellos y no de la app.
//
//   salud({ fresco }) -> { general, revisado, grupos: [{ titulo, servicios: [{ id, nombre, para, estado, detalle,   (Claude,
//                          ChatGPT, ElevenLabs, kie.ai y Meta: Ads Manager, Biblioteca de anuncios y WhatsApp Business)
//                          fuente, enlace }] }] }      (se recuerda 60 s; todo gratis)
//
// estado: 'operativo' | 'lento' | 'degradado' | 'caido' | 'desconocido'. Dos fuentes:
//   - la página de estado oficial (Statuspage: /api/v2/summary.json), mirando SOLO las partes que usa la app (de
//     Claude, «Claude Code» y la API; no «Claude no puede unirse a reuniones»);
//   - una comprobación propia con la clave del usuario cuando no cuesta nada (el saldo de kie y el de ElevenLabs):
//     nota una falla que el servicio todavía no reportó. Lenta (más de 6 s) cuenta como «lento».
import fs from 'node:fs';
import path from 'node:path';
import { saldoKie, saldoElevenLabs, leerClave } from './claves.js';
import { TEMP } from './rutas.js';
import { nombreDeModelo } from './modelos.js';

const ESPERA_PAGINA = 7000;
const ESPERA_PROPIA = 12000;
const LENTO_MS = 8000;
// (2026-11-19d: se quedaba en naranja todo el día) los reintentos de tus generaciones solo cuentan en las últimas 2
// horas y si la última pieza también los necesitó; una comprobación lenta o sin respuesta solo cuenta si se repite
const RECIENTE = 2 * 3600000;
const seguidas = new Map(); // nombre -> cuántas comprobaciones malas seguidas
let recordado = null; // { t, valor, promesa }
// EN VIVO (2026-11-19c, «que se actualice en tiempo real»): mientras alguna pantalla escucha (GET /api/salud/en-vivo),
// se revisa todo cada 30 s y cada resultado nuevo (también el ↻ de una fila) se manda al instante a todas
let CADA_VIVO = 30000;
const oyentes = new Set();
let reloj = null;
function avisar(valor) {
  for (const fn of oyentes) {
    try {
      fn(valor);
    } catch {
      /* una pantalla que se cerró no frena a las otras */
    }
  }
}
function recordar(valor) {
  recordado = { t: Date.now(), valor, promesa: null };
  avisar(valor);
  return valor;
}
/** Escucha cada resultado nuevo: fn(valor). Devuelve la función para dejar de escuchar. */
export function escuchar(fn) {
  oyentes.add(fn);
  if (!reloj) {
    reloj = setInterval(() => salud({ fresco: true }), CADA_VIVO);
    reloj.unref?.();
  }
  if (recordado?.valor) fn(recordado.valor);
  salud(); // (si lo recordado ya es viejo, revisa ya)
  return () => {
    oyentes.delete(fn);
    if (!oyentes.size && reloj) {
      clearInterval(reloj);
      reloj = null;
    }
  };
}
// las páginas de estado (las pruebas las cambian por un servidor simulado)
let PAGINAS = {
  claude: 'https://status.claude.com/api/v2/summary.json',
  openai: 'https://status.openai.com/api/v2/summary.json',
  elevenlabs: 'https://status.elevenlabs.io/api/v2/summary.json',
  meta: 'https://metastatus.com/data/orgs.json',
};
export function _paraPruebas(paginas, { cadaVivo } = {}) {
  PAGINAS = { ...PAGINAS, ...paginas };
  seguidas.clear();
  if (cadaVivo) CADA_VIVO = cadaVivo;
  recordado = null;
}

const ORDEN = { operativo: 0, desconocido: 1, lento: 2, degradado: 3, caido: 4 };
const peor = (...xs) => xs.filter(Boolean).sort((a, b) => ORDEN[b] - ORDEN[a])[0] || 'desconocido';

const hora = (iso) => {
  try {
    return new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date(iso));
  } catch {
    return '';
  }
};

/** Statuspage -> nuestro estado. */
const DE_COMPONENTE = { operational: 'operativo', degraded_performance: 'degradado', partial_outage: 'degradado', major_outage: 'caido', under_maintenance: 'degradado' };
const DE_IMPACTO = { none: 'operativo', minor: 'degradado', major: 'caido', critical: 'caido' };

/**
 * Lee una página de estado (Statuspage). `partes`: regex de los componentes que usa la app (null = todo el servicio).
 * -> { estado, detalle } | null si no se pudo leer
 */
async function deLaPagina(url, partes) {
  let d;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(ESPERA_PAGINA) });
    if (!r.ok) return null;
    d = await r.json();
  } catch {
    return null;
  }
  const componentes = (d.components || []).filter((c) => !partes || partes.test(c.name || ''));
  const nombres = new Set(componentes.map((c) => c.name));
  const abiertos = (d.incidents || []).filter((i) => i && !['resolved', 'postmortem', 'completed'].includes(i.status));
  // un incidente cuenta si toca las partes que usa la app, o si no dice qué partes toca (mejor avisar)
  const nuestros = abiertos.filter((i) => !partes || !(i.components || []).length || (i.components || []).some((c) => nombres.has(c.name)));
  const porComponentes = componentes.length ? peor(...componentes.map((c) => DE_COMPONENTE[c.status] || 'desconocido')) : partes ? 'operativo' : DE_IMPACTO[d.status?.indicator] || 'operativo';
  const porIncidentes = nuestros.length ? peor(...nuestros.map((i) => DE_IMPACTO[i.impact] || 'degradado')) : 'operativo';
  const estado = peor(porComponentes, porIncidentes);
  const i = nuestros[0];
  const detalle = i ? `${i.name}${i.created_at ? ` (desde las ${hora(i.created_at)})` : ''}` : estado === 'operativo' ? '' : 'Reporta problemas en lo que usa la app';
  const otros = abiertos.length - nuestros.length;
  return { estado, detalle, ...(otros ? { otros: `${otros} aviso${otros === 1 ? '' : 's'} en partes que la app no usa` } : {}) };
}

// ---------------------------------------------------------------- Meta (metastatus.com)
// Meta no usa Statuspage: su página (metastatus.com) lee /data/orgs.json, con cada producto y sus partes, y un estado
// por parte: «No known issues», «Low/Some/Medium disruptions» (fallas) o «High/Major disruptions» (graves).
const DE_META = (t) => {
  const x = String(t || '').toLowerCase();
  if (!x || /no known issues/.test(x)) return 'operativo';
  if (/high|major/.test(x)) return 'caido';
  return 'degradado';
};

/** Lee orgs.json de Meta una vez. -> [{ id, name, services }] | null */
async function orgsDeMeta() {
  try {
    const r = await fetch(PAGINAS.meta, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(ESPERA_PAGINA) });
    if (!r.ok) return null;
    const d = await r.json();
    return Array.isArray(d) ? d : null;
  } catch {
    return null;
  }
}

/** El estado de unos productos de Meta (ids de orgs.json; `partes`: regex de las partes que cuentan). */
function deMeta(orgs, ids, partes = null) {
  if (!orgs) return null;
  const servicios = orgs.filter((o) => ids.includes(o.id)).flatMap((o) => (o.services || []).filter((x) => !partes || partes.test(x.name || '')).map((x) => ({ ...x, producto: o.name })));
  if (!servicios.length) return null;
  const malos = servicios.filter((x) => DE_META(x.status) !== 'operativo');
  const estado = peor('operativo', ...malos.map((x) => DE_META(x.status)));
  const detalle = malos.length
    ? malos
        .slice(0, 2)
        .map((x) => `${x.name}: ${x.status}${x.time ? ` (desde las ${hora(typeof x.time === 'number' && x.time < 1e12 ? x.time * 1000 : x.time)})` : ''}`)
        .join(' · ')
    : '';
  return { estado, detalle };
}

// ---------------------------------------------------------------- kie.ai, modelo por modelo
// kie no tiene página de estado: el estado de cada modelo sale de TUS generaciones de los últimos 7 días (el registro de
// cada corrida, temp/*/app/gasto/*.json, y el de los lotes de imágenes, temp/_img-*/img/log-modelos.json): cuántas
// piezas salieron y cuántas necesitaron reintentos o pasar a otro modelo. Amarillo si en las últimas 24 h la mitad o
// más de sus piezas necesitaron reintentos.
const SEMANA = 7 * 24 * 3600000;
const DIA = 24 * 3600000;

function piezasDeKie() {
  const piezas = [];
  const agregar = (lista, cuando) => {
    for (const x of Array.isArray(lista) ? lista : []) {
      const m = String(x?.modelo || '');
      if (!m || /chatgpt/i.test(m)) continue; // (las de ChatGPT no van por kie)
      piezas.push({ modelo: m, cuando, reintento: (Number(x.intentos) || 1) > 1 || Boolean(x.respaldo) });
    }
  };
  let carpetas = [];
  try {
    carpetas = fs.readdirSync(TEMP);
  } catch {
    return piezas;
  }
  const ahora = Date.now();
  for (const c of carpetas) {
    const dirGasto = path.join(TEMP, c, 'app', 'gasto');
    let archivos = [];
    try {
      archivos = fs.readdirSync(dirGasto).filter((n) => n.endsWith('.json'));
    } catch {
      archivos = [];
    }
    for (const n of archivos) {
      try {
        const ruta = path.join(dirGasto, n);
        if (ahora - fs.statSync(ruta).mtimeMs > SEMANA) continue;
        const d = JSON.parse(fs.readFileSync(ruta, 'utf8'));
        const cuando = Date.parse(d.fin || d.inicio) || fs.statSync(ruta).mtimeMs;
        agregar(d.imagenes, cuando);
        agregar(d.videos, cuando);
        if (d.musica) piezas.push({ modelo: 'suno', cuando, reintento: false });
      } catch {
        /* un registro roto no frena el resto */
      }
    }
    if (c.startsWith('_img-')) {
      try {
        const ruta = path.join(TEMP, c, 'img', 'log-modelos.json');
        if (ahora - fs.statSync(ruta).mtimeMs <= SEMANA) {
          const d = JSON.parse(fs.readFileSync(ruta, 'utf8'));
          agregar(d.imagenes, Date.parse(d.generado) || fs.statSync(ruta).mtimeMs);
        }
      } catch {
        /* sin registro */
      }
    }
  }
  return piezas;
}

/** -> [{ nombre, estado, detalle }] por modelo (el más usado primero). */
export function modelosDeKie() {
  const porNombre = new Map();
  const ahora = Date.now();
  for (const p of piezasDeKie()) {
    const nombre = p.modelo === 'suno' ? 'Suno (música)' : nombreDeModelo(p.modelo) || p.modelo;
    const g = porNombre.get(nombre) || { nombre, total: 0, hoy: 0, recientes: 0, conReintento: 0, ultima: 0, ultimaConReintento: false };
    g.total++;
    if (ahora - p.cuando <= DIA) g.hoy++;
    if (ahora - p.cuando <= RECIENTE) {
      g.recientes++;
      if (p.reintento) g.conReintento++;
    }
    if (p.cuando >= g.ultima) {
      g.ultima = p.cuando;
      g.ultimaConReintento = p.reintento;
    }
    porNombre.set(nombre, g);
  }
  const dias = (g) => Math.max(1, Math.round((ahora - g.ultima) / DIA));
  return [...porNombre.values()]
    .sort((a, b) => b.total - a.total)
    .map((g) => {
      // amarillo solo si AHORA viene fallando: varias piezas de las últimas 2 h con reintentos y la última también
      const mal = g.recientes >= 2 && g.conReintento / g.recientes >= 0.5 && g.ultimaConReintento;
      return {
        nombre: g.nombre,
        piezas: g.total,
        estado: mal ? 'degradado' : 'operativo',
        detalle: mal ? `${g.conReintento} de ${g.recientes} piezas en las últimas 2 horas necesitaron reintentos` : g.hoy ? `${g.hoy} ${g.hoy === 1 ? 'pieza' : 'piezas'} hoy` : `Última vez: hace ${dias(g)} ${dias(g) === 1 ? 'día' : 'días'}`,
      };
    });
}

/** Una comprobación propia: lo que tardó y si respondió. -> { estado, detalle } */
export async function propia(fn, nombre) {
  const t0 = Date.now();
  let r;
  try {
    r = await Promise.race([fn(), new Promise((res) => setTimeout(() => res({ tarde: true }), ESPERA_PROPIA))]);
  } catch {
    r = { ok: false };
  }
  const ms = Date.now() - t0;
  const malo = r?.tarde || (r?.ok && ms > LENTO_MS) || (r && !r.ok && !['sin-clave', 'clave-invalida', 'sin-permisos'].includes(r.motivo));
  const veces = malo ? (seguidas.get(nombre) || 0) + 1 : 0;
  seguidas.set(nombre, veces);
  // una sola vez lento o sin respuesta: verde, con la nota (se vuelve a revisar en 30 s)
  if (veces === 1) return { estado: 'operativo', detalle: r?.ok ? `Tardó ${Math.round(ms / 1000)} s en responder; lo vuelvo a revisar` : 'No respondió una vez; lo vuelvo a revisar' };
  if (r?.tarde) return { estado: 'caido', detalle: `${nombre} no respondió en ${ESPERA_PROPIA / 1000} s con tu clave, dos veces seguidas` };
  if (r?.ok) return ms > LENTO_MS ? { estado: 'lento', detalle: `Funciona, pero tardó ${Math.round(ms / 1000)} s en responder (dos veces seguidas)` } : { estado: 'operativo', detalle: '' };
  if (r?.motivo === 'sin-clave') return { estado: 'desconocido', detalle: 'Falta tu clave (Ajustes → Conexiones)' };
  if (r?.motivo === 'clave-invalida' || r?.motivo === 'sin-permisos') return { estado: 'desconocido', detalle: 'Revisa tu clave en Ajustes → Conexiones' };
  return { estado: 'caido', detalle: r?.mensaje ? String(r.mensaje).slice(0, 140) : `${nombre} no respondió con tu clave` };
}

/** Junta la página y la comprobación propia: manda la peor (con su detalle). */
function juntar(pagina, mia) {
  const estado = peor(pagina?.estado, mia?.estado);
  const detalle = (mia && ORDEN[mia.estado] >= ORDEN[pagina?.estado || 'operativo'] && mia.detalle) || pagina?.detalle || mia?.detalle || '';
  const fuente = pagina && mia ? 'Página de estado y comprobación con tu clave' : pagina ? 'Página de estado oficial' : mia ? 'Comprobación con tu clave' : 'No se pudo revisar';
  return { estado: pagina || mia ? estado : 'desconocido', detalle, fuente, ...(pagina?.otros ? { otros: pagina.otros } : {}) };
}

// cada servicio sabe revisarse solo (para el ↻ de cada fila)
const REVISAR = {
  claude: async () => ({ id: 'claude', nombre: 'Claude', grupo: 'IA que escribe', ...juntar(await deLaPagina(PAGINAS.claude, /claude code|claude api|api\.anthropic/i), null), enlace: 'https://status.claude.com' }),
  chatgpt: async () => ({ id: 'chatgpt', nombre: 'ChatGPT (Codex)', grupo: 'IA que escribe', ...juntar(await deLaPagina(PAGINAS.openai, /codex|responses|chat completions|login/i), null), enlace: 'https://status.openai.com' }),
  elevenlabs: async () => {
    const [pagina, mia] = await Promise.all([deLaPagina(PAGINAS.elevenlabs, null), leerClave('ELEVENLABS_API_KEY') ? propia(() => saldoElevenLabs({ fresco: true }), 'ElevenLabs') : null]);
    return { id: 'elevenlabs', nombre: 'ElevenLabs', grupo: 'Voz', ...juntar(pagina, mia), enlace: 'https://status.elevenlabs.io' };
  },
  kie: async () => {
    const mia = leerClave('KIE_API_KEY') ? await propia(() => saldoKie({ fresco: true }), 'kie.ai') : null;
    const modelos = modelosDeKie();
    const base = juntar(null, mia);
    // si la clave responde pero algún modelo viene fallando hoy: amarillo
    // (sin la clave no se sabe si kie responde: el historial solo puede avisar de reintentos, no confirmar que anda)
    const conReintentos = modelos.some((m) => m.estado !== 'operativo');
    const estado = base.estado === 'desconocido' ? (conReintentos ? 'degradado' : 'desconocido') : peor(base.estado, ...modelos.map((m) => m.estado));
    const flojos = modelos.filter((m) => m.estado !== 'operativo').map((m) => m.nombre);
    return { id: 'kie', nombre: 'kie.ai', grupo: 'Imágenes, videos y música', ...base, estado, detalle: base.detalle || (flojos.length ? `Con reintentos hoy: ${flojos.join(', ')}` : ''), modelos, enlace: 'https://kie.ai' };
  },
};
const META = [
  ['meta-ads', 'Ads Manager', ['ads-manager', 'marketing-api'], null],
  ['meta-biblioteca', 'Biblioteca de anuncios', ['ads-transparency'], /ad library/i],
  ['meta-whatsapp', 'WhatsApp Business', ['whatsapp-business-api', 'ctx'], /cloud api$|business account|click to whatsapp|marketing messages/i],
];
for (const [id, nombre, ids, partes] of META) REVISAR[id] = async () => ({ id, nombre, grupo: 'Meta', ...juntar(deMeta(await orgsDeMeta(), ids, partes), null), enlace: 'https://metastatus.com' });

const GRUPOS = ['IA que escribe', 'Voz', 'Imágenes, videos y música', 'Meta'];
function armar(servicios) {
  const grupos = GRUPOS.map((titulo) => ({ titulo, servicios: servicios.filter((x) => x.grupo === titulo).map(({ grupo, ...x }) => x) })).filter((g) => g.servicios.length);
  // el general no cuenta los «desconocido» (por ejemplo, una página de estado que no cargó)
  const general = peor(...servicios.map((x) => (x.estado === 'desconocido' ? 'operativo' : x.estado)));
  return { general, revisado: new Date().toISOString(), grupos };
}

async function revisar() {
  return armar(await Promise.all(Object.values(REVISAR).map((fn) => fn().catch(() => null))).then((l) => l.filter(Boolean)));
}

/** Revisa de nuevo UN servicio (el ↻ de su fila) y lo pone en lo recordado. */
export async function revisarServicio(id) {
  const fn = REVISAR[id];
  if (!fn) return null;
  const nuevo = await fn().catch(() => null);
  const actual = recordado?.valor || (await salud());
  if (!nuevo) return actual;
  const todos = actual.grupos.flatMap((g) => g.servicios.map((x) => ({ ...x, grupo: g.titulo })));
  const grupo = GRUPOS.find((g) => g === nuevo.grupo);
  const lista = todos.some((x) => x.id === id) ? todos.map((x) => (x.id === id ? nuevo : x)) : [...todos, { ...nuevo, grupo }];
  return recordar(armar(lista));
}

export function salud({ fresco = false } = {}) {
  if (recordado?.promesa) return recordado.promesa;
  if (!fresco && recordado?.valor && Date.now() - recordado.t < 60000) return Promise.resolve(recordado.valor);
  const promesa = revisar()
    .then((valor) => recordar(valor))
    .catch(() => {
      recordado = { ...(recordado || {}), promesa: null };
      return recordado?.valor || { general: 'desconocido', revisado: new Date().toISOString(), grupos: [] };
    });
  recordado = { ...(recordado || {}), promesa };
  return promesa;
}

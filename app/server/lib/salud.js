// «Salud de plataformas» (2026-11-18, pedido del usuario después de la falla de ElevenLabs de ese día): el estado de
// los servicios que usa la app, para saber de un vistazo si algo que falla es de ellos y no de la app.
//
//   salud({ fresco }) -> { general, revisado, grupos: [{ titulo, servicios: [{ id, nombre, para, estado, detalle,
//                          fuente, enlace }] }] }      (se recuerda 60 s; todo gratis)
//
// estado: 'operativo' | 'lento' | 'degradado' | 'caido' | 'desconocido'. Dos fuentes:
//   - la página de estado oficial (Statuspage: /api/v2/summary.json), mirando SOLO las partes que usa la app (de
//     Claude, «Claude Code» y la API; no «Claude no puede unirse a reuniones»);
//   - una comprobación propia con la clave del usuario cuando no cuesta nada (el saldo de kie y el de ElevenLabs):
//     nota una falla que el servicio todavía no reportó. Lenta (más de 6 s) cuenta como «lento».
import { saldoKie, saldoElevenLabs, leerClave } from './claves.js';

const ESPERA_PAGINA = 7000;
const ESPERA_PROPIA = 12000;
const LENTO_MS = 6000;
let recordado = null; // { t, valor, promesa }
// las páginas de estado (las pruebas las cambian por un servidor simulado)
let PAGINAS = {
  claude: 'https://status.claude.com/api/v2/summary.json',
  openai: 'https://status.openai.com/api/v2/summary.json',
  elevenlabs: 'https://status.elevenlabs.io/api/v2/summary.json',
};
export function _paraPruebas(paginas) {
  PAGINAS = { ...PAGINAS, ...paginas };
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

/** Una comprobación propia: lo que tardó y si respondió. -> { estado, detalle } */
async function propia(fn, nombre) {
  const t0 = Date.now();
  let r;
  try {
    r = await Promise.race([fn(), new Promise((res) => setTimeout(() => res({ tarde: true }), ESPERA_PROPIA))]);
  } catch {
    r = { ok: false };
  }
  const ms = Date.now() - t0;
  if (r?.tarde) return { estado: 'caido', detalle: `${nombre} no respondió en ${ESPERA_PROPIA / 1000} s con tu clave` };
  if (r?.ok) return ms > LENTO_MS ? { estado: 'lento', detalle: `Respondió con tu clave, pero tardó ${Math.round(ms / 1000)} s` } : { estado: 'operativo', detalle: '' };
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

async function revisar() {
  const [claude, openai, eleven, elevenMia, kieMia] = await Promise.all([
    deLaPagina(PAGINAS.claude, /claude code|claude api|api\.anthropic/i),
    deLaPagina(PAGINAS.openai, /codex|responses|chat completions|login/i),
    deLaPagina(PAGINAS.elevenlabs, null),
    leerClave('ELEVENLABS_API_KEY') ? propia(() => saldoElevenLabs({ fresco: true }), 'ElevenLabs') : null,
    leerClave('KIE_API_KEY') ? propia(() => saldoKie({ fresco: true }), 'kie.ai') : null,
  ]);
  const grupos = [
    {
      titulo: 'IA que escribe',
      servicios: [
        { id: 'claude', nombre: 'Claude', para: 'Guiones, ideas y revisiones', ...juntar(claude, null), enlace: 'https://status.claude.com' },
        { id: 'chatgpt', nombre: 'ChatGPT (Codex)', para: 'Guiones, ideas y revisiones', ...juntar(openai, null), enlace: 'https://status.openai.com' },
      ],
    },
    {
      titulo: 'Voz',
      servicios: [{ id: 'elevenlabs', nombre: 'ElevenLabs', para: 'La voz del narrador y las transcripciones', ...juntar(eleven, elevenMia), enlace: 'https://status.elevenlabs.io' }],
    },
    {
      titulo: 'Imágenes, videos y música',
      servicios: [{ id: 'kie', nombre: 'kie.ai', para: 'GPT Image, Seedream, Kling, Seedance, Veo y Suno', ...juntar(null, kieMia), enlace: 'https://kie.ai' }],
    },
  ];
  const todos = grupos.flatMap((g) => g.servicios);
  // el general no cuenta los «desconocido» (por ejemplo, ChatGPT si no lo usas y su página no cargó)
  const general = peor(...todos.map((s) => (s.estado === 'desconocido' ? 'operativo' : s.estado)));
  return { general, revisado: new Date().toISOString(), grupos };
}

export function salud({ fresco = false } = {}) {
  if (recordado?.promesa) return recordado.promesa;
  if (!fresco && recordado?.valor && Date.now() - recordado.t < 60000) return Promise.resolve(recordado.valor);
  const promesa = revisar()
    .then((valor) => {
      recordado = { t: Date.now(), valor, promesa: null };
      return valor;
    })
    .catch(() => {
      recordado = { ...(recordado || {}), promesa: null };
      return recordado?.valor || { general: 'desconocido', revisado: new Date().toISOString(), grupos: [] };
    });
  recordado = { ...(recordado || {}), promesa };
  return promesa;
}

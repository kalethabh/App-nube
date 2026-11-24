// SISTEMA S.E.P · OBJETIVOS, AVANCE Y COPILOTO (2026-11-24). El lado "plan" de la pantalla S.E.P:
//
//   OBJETIVOS   metas por producto (pedidos/día y CPA máximo en pesos), guardadas en mis_archivos/sep/plan.json.
//   AVANCE      el corte del día en 10 segundos (pedidos por producto + gasto del día): KPIs contra la meta,
//               proyección de cierre (ventana de ventas 6 AM–12 AM), racha de días cumpliendo y guía horaria.
//   BITÁCORA    las decisiones que el usuario anota («apagué X», «dupliqué Y a 150K»), para que el copiloto
//               no recomiende dos veces lo mismo.
//   COPILOTO    un chat con su IA (Claude o ChatGPT, la de Ajustes, motor-ia.js) que SOLO aconseja con el método
//               S.E.P: ventas reales (Lucid/iComfly) + gasto de Meta, barrer anuncio → conjunto → campaña (3/5/14
//               días), escalar duplicando (nunca subir +20 %), testeo 1.2.5 y escala 1.5.5, mínimo 3 días, sin
//               cambios después de las 8 PM. Nunca toca la cuenta de Meta: contesta, no ejecuta.
//
// Todo vive en mis_archivos/sep/ (plan.json y copiloto.json): local, del usuario, respaldado con mis_archivos.
//
//   plan()                       -> { objetivos, hoy, kpis, guia, historial, bitacora, fecha }
//   guardarObjetivos(lista)      -> { objetivos }
//   registrarAvance(datos)       -> plan()        ({ fecha?, pedidos: { producto: n }, gasto? })
//   agregarBitacora(texto)       -> { bitacora }
//   borrarBitacora(id)           -> { bitacora }
//   copiloto()                   -> { mensajes, pensando }
//   copilotoEnviar(texto)        -> copiloto()    (contesta sola, en segundo plano)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { RAIZ, TEMP } from './rutas.js';
import { leerJSON } from './archivos.js';
import { escribirJSON, ErrorApp } from './productos.js';
import { lanzarSesion as preguntarIA, prohibidasComunes, nombreIA } from './motor-ia.js';

const DIR = path.join(RAIZ, 'mis_archivos', 'sep');
const PLAN = path.join(DIR, 'plan.json');
const CHAT = path.join(DIR, 'copiloto.json');
const DIR_INFORMES = path.join(TEMP, '_sep'); // los informes de Meta que ya trajo la pantalla (lib/sep.js)

// la ventana de ventas del día: de 6 AM a 12 de la noche (18 horas)
const HORA_ABRE = 6;
const HORA_CIERRA = 24;
const TOPE_MENSAJES = 120;
const TOPE_BITACORA = 400;

const ahora = () => new Date().toISOString();
const limpio = (t, n = 2000) => String(t ?? '').replace(/\r/g, '').trim().slice(0, n);
const id8 = () => crypto.randomBytes(4).toString('hex');
const r0 = (n) => Math.round(n);

/** La fecha local YYYY-MM-DD (la del computador del usuario, no UTC). */
function fechaLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const esFecha = (f) => /^\d{4}-\d{2}-\d{2}$/.test(String(f || ''));

// ---------------------------------------------------------------- guardar y leer

function leerPlan() {
  const p = leerJSON(PLAN);
  return {
    objetivos: Array.isArray(p?.objetivos) ? p.objetivos : [],
    dias: p?.dias && typeof p.dias === 'object' ? p.dias : {},
    bitacora: Array.isArray(p?.bitacora) ? p.bitacora : [],
  };
}
function guardarPlan(p) {
  fs.mkdirSync(DIR, { recursive: true });
  escribirJSON(PLAN, p);
}

// ---------------------------------------------------------------- objetivos

/** Reemplaza la lista de objetivos (producto, meta de pedidos/día, CPA máximo en pesos, nota). */
export function guardarObjetivos(lista) {
  if (!Array.isArray(lista)) throw new ErrorApp(400, 'Manda la lista de objetivos.');
  const objetivos = lista
    .slice(0, 12)
    .map((o) => ({
      id: /^[a-f0-9]{8}$/.test(String(o?.id || '')) ? o.id : id8(),
      producto: limpio(o?.producto, 60),
      meta: Math.max(0, r0(Number(o?.meta) || 0)),
      cpaMax: Math.max(0, r0(Number(o?.cpaMax) || 0)),
      nota: limpio(o?.nota, 120),
    }))
    .filter((o) => o.producto && o.meta > 0);
  const p = leerPlan();
  p.objetivos = objetivos;
  guardarPlan(p);
  return { objetivos };
}

// ---------------------------------------------------------------- el avance del día

/** Anota el corte del día: pedidos por producto y, si lo tiene, el gasto del día (pesos de Meta). */
export function registrarAvance({ fecha, pedidos, gasto } = {}) {
  const f = esFecha(fecha) ? fecha : fechaLocal();
  const p = leerPlan();
  const dia = p.dias[f] && typeof p.dias[f] === 'object' ? p.dias[f] : { pedidos: {} };
  if (pedidos && typeof pedidos === 'object') {
    for (const [prod, n] of Object.entries(pedidos)) {
      const k = limpio(prod, 60);
      if (!k) continue;
      const v = r0(Number(n));
      if (Number.isFinite(v) && v >= 0) dia.pedidos[k] = v;
      else delete dia.pedidos[k];
    }
  }
  if (gasto !== undefined && gasto !== null && gasto !== '') {
    const g = r0(Number(gasto));
    if (Number.isFinite(g) && g >= 0) dia.gasto = g;
  }
  dia.actualizado = ahora();
  p.dias[f] = dia;
  // no crecer para siempre: guardar los últimos 120 días
  const fechas = Object.keys(p.dias).sort();
  for (const vieja of fechas.slice(0, Math.max(0, fechas.length - 120))) delete p.dias[vieja];
  guardarPlan(p);
  return plan();
}

const totalDia = (dia) => Object.values(dia?.pedidos || {}).reduce((a, b) => a + (Number(b) || 0), 0);

/** Qué fracción de la ventana de ventas (6 AM–12 AM) ya pasó hoy (0 a 1). */
function fraccionDelDia(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  return Math.max(0, Math.min(1, (h - HORA_ABRE) / (HORA_CIERRA - HORA_ABRE)));
}

/** La guía horaria: cuántos pedidos deberías llevar a cada hora para cerrar en la meta. */
function guiaHoraria(metaTotal) {
  if (!(metaTotal > 0)) return [];
  return [10, 12, 14, 16, 18, 20, 22, 24].map((h) => ({
    hora: h === 24 ? '12 AM' : h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`,
    pedidos: r0((metaTotal * (h - HORA_ABRE)) / (HORA_CIERRA - HORA_ABRE)),
  }));
}

/** El plan completo: objetivos, el corte de hoy con sus KPIs, la guía, el historial y la bitácora. */
export function plan() {
  const p = leerPlan();
  const hoy = fechaLocal();
  const dia = p.dias[hoy] || { pedidos: {} };
  const metaTotal = p.objetivos.reduce((a, o) => a + o.meta, 0);
  const pedidosHoy = totalDia(dia);
  const fraccion = fraccionDelDia();
  const cpaMaxTotal = (() => {
    // el CPA tolerable del día: el promedio de los topes, pesado por la meta de cada producto
    const conTope = p.objetivos.filter((o) => o.cpaMax > 0);
    const base = conTope.reduce((a, o) => a + o.meta, 0);
    return base ? r0(conTope.reduce((a, o) => a + o.cpaMax * o.meta, 0) / base) : 0;
  })();

  // la racha: días seguidos cumpliendo la meta total, contando desde ayer hacia atrás (hoy no cerró todavía)
  let racha = 0;
  if (metaTotal > 0) {
    const d = new Date();
    for (let i = 1; i <= 60; i += 1) {
      const f = fechaLocal(new Date(d.getFullYear(), d.getMonth(), d.getDate() - i));
      if (totalDia(p.dias[f]) >= metaTotal) racha += 1;
      else break;
    }
    if (pedidosHoy >= metaTotal) racha += 1; // hoy ya la cumplió: cuenta
  }

  const historial = [];
  const d = new Date();
  for (let i = 13; i >= 0; i -= 1) {
    const f = fechaLocal(new Date(d.getFullYear(), d.getMonth(), d.getDate() - i));
    const x = p.dias[f];
    historial.push({ fecha: f, pedidos: totalDia(x), gasto: Number(x?.gasto) || 0, porProducto: x?.pedidos || {} });
  }

  return {
    objetivos: p.objetivos,
    hoy: { fecha: hoy, pedidos: dia.pedidos || {}, gasto: Number(dia.gasto) || 0, actualizado: dia.actualizado || null },
    kpis: {
      metaTotal,
      pedidosHoy,
      porProducto: p.objetivos.map((o) => ({ ...o, pedidos: r0(Number(dia.pedidos?.[o.producto]) || 0) })),
      cpaHoy: pedidosHoy && dia.gasto ? r0(dia.gasto / pedidosHoy) : null,
      cpaMaxTotal,
      proyeccion: fraccion > 0.08 && pedidosHoy ? r0(pedidosHoy / fraccion) : null,
      fraccion: Math.round(fraccion * 100) / 100,
      racha,
    },
    guia: guiaHoraria(metaTotal),
    historial,
    bitacora: p.bitacora.slice(0, 60),
    fecha: ahora(),
  };
}

// ---------------------------------------------------------------- bitácora

export function agregarBitacora(texto) {
  const t = limpio(texto, 300);
  if (!t) throw new ErrorApp(400, 'Escribe qué decidiste.');
  const p = leerPlan();
  p.bitacora.unshift({ id: id8(), fecha: ahora(), texto: t });
  p.bitacora = p.bitacora.slice(0, TOPE_BITACORA);
  guardarPlan(p);
  return { bitacora: p.bitacora.slice(0, 60) };
}

export function borrarBitacora(id) {
  const p = leerPlan();
  p.bitacora = p.bitacora.filter((b) => b.id !== id);
  guardarPlan(p);
  return { bitacora: p.bitacora.slice(0, 60) };
}

// ---------------------------------------------------------------- el copiloto

let pensando = false;

const leerChat = () => {
  const c = leerJSON(CHAT);
  return { mensajes: Array.isArray(c?.mensajes) ? c.mensajes : [] };
};
const guardarChat = (c) => {
  fs.mkdirSync(DIR, { recursive: true });
  c.mensajes = c.mensajes.slice(-TOPE_MENSAJES);
  escribirJSON(CHAT, c);
};

export const copiloto = () => ({ ...leerChat(), pensando });

/** El último informe de Meta que ya trajo la pantalla S.E.P (si hay uno fresco), resumido para el copiloto. */
function resumenInforme() {
  try {
    if (!fs.existsSync(DIR_INFORMES)) return '';
    let mejor = null;
    for (const n of fs.readdirSync(DIR_INFORMES).filter((x) => x.endsWith('.json'))) {
      const ruta = path.join(DIR_INFORMES, n);
      const st = fs.statSync(ruta);
      if (Date.now() - st.mtimeMs > 24 * 3600000) continue;
      if (!mejor || st.mtimeMs > mejor.mtimeMs) mejor = { ruta, mtimeMs: st.mtimeMs };
    }
    const d = mejor ? leerJSON(mejor.ruta) : null;
    if (!Array.isArray(d?.anuncios) || !d.anuncios.length) return '';
    const filas = d.anuncios.slice(0, 15).map((a) => `- ${a.nombre} (${a.campana}): ${a.decision?.tipo || '?'} · ${a.compras} compras · ROAS ${a.roas} · CPA ${a.cpa} · gasto ${a.gasto}`);
    return `\nLO ÚLTIMO QUE TRAJO LA PANTALLA S.E.P DE META (puede tener horas):\n${filas.join('\n')}\n`;
  } catch {
    return '';
  }
}

function textoPrompt(rel, mensajes) {
  const p = plan();
  const objetivos = p.objetivos.length
    ? p.objetivos.map((o) => `- ${o.producto}: ${o.meta} pedidos/día, CPA máximo ${o.cpaMax ? `$${o.cpaMax.toLocaleString('es-CO')}` : 'sin tope'}${o.nota ? ` (${o.nota})` : ''}`).join('\n')
    : '- (todavía no definió objetivos)';
  const avance = p.historial
    .filter((h) => h.pedidos || h.gasto)
    .slice(-7)
    .map((h) => `- ${h.fecha}: ${h.pedidos} pedidos (${Object.entries(h.porProducto).map(([k, v]) => `${k} ${v}`).join(', ') || 'sin detalle'})${h.gasto ? ` · gasto $${h.gasto.toLocaleString('es-CO')}` : ''}`)
    .join('\n');
  const bitacora = p.bitacora.slice(0, 20).map((b) => `- ${b.fecha.slice(0, 10)}: ${b.texto}`).join('\n');
  const charla = mensajes.slice(-16).map((m) => `${m.de === 'tu' ? 'USUARIO' : 'COPILOTO'}: ${m.texto}`).join('\n');
  const hoyKpis = `Hoy ${p.hoy.fecha}: ${p.kpis.pedidosHoy} pedidos de ${p.kpis.metaTotal || '?'} de meta` +
    `${p.kpis.cpaHoy ? ` · CPA del día $${p.kpis.cpaHoy.toLocaleString('es-CO')}` : ''}` +
    `${p.kpis.proyeccion ? ` · proyección de cierre ~${p.kpis.proyeccion}` : ''}` +
    ` · racha ${p.kpis.racha} día(s).`;

  return `Eres el COPILOTO S.E.P de esta app: el asesor de campañas de Meta Ads del usuario (ecommerce COD en Colombia, pesos colombianos). SOLO aconsejas: no tienes acceso a su cuenta de Meta y no ejecutas nada.

EL MÉTODO (no lo contradigas nunca):
- La meta se mide en PEDIDOS REALES (Lucid/iComfly); el gasto se mide en Meta.
- Para apagar: barrer SIEMPRE anuncio → conjunto → campaña, mirando ventanas de 3, 5 y 14 días. Nunca apagar una campaña entera por un solo anuncio malo. El presupuesto liberado va a lo que sí funciona.
- Escalar = DUPLICAR los ganadores (S.E.P), nunca subirle +20 % al presupuesto de lo que ya corre.
- Testeo 1.2.5 (1 campaña ABO · 2 conjuntos · 5 creativos); escala 1.5.5.
- Una campaña nueva no se toca en sus primeros 3 días. Sin cambios después de las 8 PM; publicar a las 12 AM o 4 AM.
- El CPA tolerable por producto es el del objetivo definido abajo.
- Responde SIEMPRE en español simple y corto, con esta forma: diagnóstico (2-3 líneas) → qué apagar o bajar → qué duplicar o escalar → proyección o siguiente paso. Si te faltan datos (el corte de pedidos, el gasto, o las métricas de un anuncio), pídelos en una línea en vez de inventarlos.

SUS OBJETIVOS:
${objetivos}

AVANCE (últimos días con registro):
${avance || '- (sin registros todavía: recuérdale anotar el corte del día en «Objetivos y avance»)'}
${hoyKpis}

BITÁCORA DE DECISIONES (no recomiendes repetir lo ya hecho):
${bitacora || '- (vacía)'}
${resumenInforme()}
LA CONVERSACIÓN:
${charla}

Contesta el último mensaje del usuario. Escribe el archivo ${rel} con EXACTAMENTE este JSON:
{ "respuesta": "tu respuesta en español, máximo ~1800 caracteres, sin markdown pesado (guiones y saltos de línea están bien)" }`;
}

async function responder() {
  pensando = true;
  const salida = path.join(DIR, `respuesta-${id8()}.json`);
  const rel = path.relative(RAIZ, salida).replace(/\\/g, '/');
  let texto = '';
  try {
    const c = leerChat();
    let r = { ok: false };
    try {
      r = await preguntarIA({
        tipo: 'guion',
        uuid: crypto.randomUUID(),
        prompt: textoPrompt(rel, c.mensajes),
        herramientas: ['Read', 'Write'],
        permitidas: [`Write(./${rel})`, `Edit(./${rel})`],
        prohibidas: prohibidasComunes({ terminal: false }),
        registro: path.join(DIR, 'registro.log'),
        timeoutMs: 5 * 60000,
        maxTurnos: 8,
        verificar: async () => {
          const d = leerJSON(salida);
          return typeof d?.respuesta === 'string' && d.respuesta.trim() ? { ok: true } : { ok: false, errores: [`Escribe ${rel} con { "respuesta": "…" }.`] };
        },
      });
    } catch (e) {
      r = { ok: false, error: e.message };
    }
    const d = leerJSON(salida);
    fs.rmSync(salida, { force: true });
    texto = limpio(d?.respuesta, 3000);
    if (!texto) texto = r?.sinMotor ? 'Todavía no elegiste tu IA: ve a Ajustes › Conexiones y vuelve a escribirme.' : r?.limite ? `Se acabó el uso de tu plan de ${nombreIA(r.motor)} por ahora. Escríbeme cuando se renueve.` : 'No pude contestarte esta vez. ¿Me lo escribes de nuevo?';
  } catch (e) {
    console.error('[sep-copiloto]', e);
    texto = 'Algo falló de mi lado. ¿Me lo escribes de nuevo?';
  } finally {
    const c = leerChat();
    c.mensajes.push({ id: id8(), de: 'copiloto', texto, fecha: ahora() });
    guardarChat(c);
    pensando = false;
  }
}

export async function copilotoEnviar(texto) {
  const t = limpio(texto, 2000);
  if (!t) throw new ErrorApp(400, 'Escribe tu mensaje.');
  if (pensando) throw new ErrorApp(409, 'El copiloto todavía te está contestando. Espera un momento.');
  const c = leerChat();
  c.mensajes.push({ id: id8(), de: 'tu', texto: t, fecha: ahora() });
  guardarChat(c);
  pensando = true;
  responder();
  return copiloto();
}

// OFICINA VIRTUAL · CHAT CON LA COORDINADORA y APRENDER CON 👍/👎 (2026-11-19r).
//
// Chat: le escribes a la coordinadora («hazme 3 anuncios UGC de Aguaje»); tu IA (Claude o ChatGPT, la de Ajustes) lee
// tus productos, los estilos, lo que pasa en la oficina y la conversación, y contesta con un JSON: su respuesta y las
// acciones que la app ejecuta (crear el guion de un anuncio, investigar un mercado, recrear un anuncio para otro
// producto, anotar una regla). NUNCA produce nada que cobre: los guiones quedan esperando tu aprobación (con su costo),
// como siempre. Lo que falta para un estilo (lo obligatorio) lo pregunta antes.
//
//   chat()                      -> { mensajes: [{ id, de: 'tu'|'coordinadora', texto, acciones, fecha }], pensando }
//   enviar(texto)               -> lo mismo (contesta sola, en segundo plano)
//   opinar({ slug, voto, partes, texto, paraTodos }) -> { reglas }   (el 👍/👎 de un anuncio terminado)
//   aprendido()                 -> por agente: { bien, mal, semana: [{ regla, fecha }] }
//
// Vive en temp/_oficina/ (chat.json, aprendido.json). Las reglas van a los aprendizajes de siempre (lib/aprendizajes.js),
// que se leen al escribir cada guion.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { RAIZ, TEMP } from './rutas.js';
import { leerJSON } from './archivos.js';
import { ErrorApp, escribirJSON, listarProductos } from './productos.js';
import { lanzarSesion as preguntarIA, prohibidasComunes, nombreIA } from './motor-ia.js';
import { agregarRegla } from './aprendizajes.js';

const DIR = path.join(TEMP, '_oficina');
const CHAT = path.join(DIR, 'chat.json');
const APRENDIDO = path.join(DIR, 'aprendido.json');
const TOPE_MENSAJES = 200;
const MAX_ANUNCIOS = 5; // por mensaje

const ahora = () => new Date().toISOString();
const limpio = (t, n = 2000) => String(t ?? '').replace(/\r/g, '').trim().slice(0, n);
const leerChat = () => {
  const c = leerJSON(CHAT);
  return { mensajes: Array.isArray(c?.mensajes) ? c.mensajes : [] };
};
const guardarChat = (c) => {
  fs.mkdirSync(DIR, { recursive: true });
  escribirJSON(CHAT, { mensajes: c.mensajes.slice(-TOPE_MENSAJES) });
};
let pensando = false;

// ---------------------------------------------------------------- el estado de lo que se creó desde el chat

async function estadoDeAccion(a) {
  if (!a?.slug) return a;
  try {
    const { anuncioNuevo } = await import('./anuncios-nuevos.js');
    const x = anuncioNuevo(a.slug);
    if (!x) return { ...a, estado: 'no-esta' };
    const estado = x.estado === 'guion' ? (x.etapa === 'aprobar' ? 'aprobar' : 'escribiendo') : x.estado;
    return { ...a, estado };
  } catch {
    return a;
  }
}

export async function chat() {
  const c = leerChat();
  const mensajes = await Promise.all(
    c.mensajes.slice(-80).map(async (m) => (Array.isArray(m.acciones) && m.acciones.length ? { ...m, acciones: await Promise.all(m.acciones.map(estadoDeAccion)) } : m))
  );
  return { mensajes, pensando };
}

export function borrarChat() {
  if (pensando) throw new ErrorApp(409, 'La coordinadora está contestando. Espera un momento.');
  guardarChat({ mensajes: [] });
  return { mensajes: [], pensando: false };
}

// ---------------------------------------------------------------- lo que sabe la coordinadora

async function contexto() {
  const { ESTILOS, AJUSTES_OBLIGATORIOS, listarAnunciosNuevos } = await import('./anuncios-nuevos.js');
  const productos = listarProductos().slice(0, 40);
  const estilos = Object.entries(ESTILOS)
    .filter(([k]) => k !== 'agregar') // «Agregar» necesita un video subido: se hace desde Nuevo anuncio
    .map(([k, d]) => {
      const falta = AJUSTES_OBLIGATORIOS(k);
      return `${k} | ${d.nombre}${falta.length ? ` | OBLIGATORIO preguntar antes: ${falta.map((f) => `${f.campo} (${f.texto})`).join('; ')}` : ''}`;
    });
  let anuncios = [];
  try {
    anuncios = listarAnunciosNuevos().slice(0, 25);
  } catch {
    /* sin anuncios */
  }
  let oficina = null;
  try {
    oficina = await (await import('./oficina.js')).oficina();
  } catch {
    /* sin oficina */
  }
  return { productos, estilos, anuncios, oficina };
}

function textoPrompt({ productos, estilos, anuncios, oficina }, mensajes, rel) {
  const coord = oficina?.agentes?.find((a) => a.id === 'coordinacion');
  const equipo = (oficina?.agentes || []).map((a) => `${a.nombre} (${a.rol}): ${a.estado}${a.ahora.length ? ` — ahora: ${a.ahora.map((t) => t.titulo).join(', ')}` : ''}${a.necesita.length && a.id !== 'coordinacion' ? ` — te necesita: ${a.necesita.map((t) => t.titulo).join(', ')}` : ''}`);
  const historia = mensajes.slice(-16).map((m) => `${m.de === 'tu' ? 'USUARIO' : 'TÚ'}: ${m.texto}${m.acciones?.length ? ` [acciones: ${m.acciones.map((a) => `${a.titulo}${a.ok === false ? ' (falló)' : ''}`).join('; ')}]` : ''}`);
  return `TAREA: coordinadora de la oficina virtual. Te ejecuta la app Kads Studio, sin chat ni terminal: no uses nada más que Write.

Eres ${coord?.nombre || 'Valentina'}, la coordinadora de ${oficina?.nombre || 'la oficina'} de anuncios con IA del usuario. Hablas en español sencillo, cálida y BREVE (2 a 5 frases), de tú. Repartes el trabajo entre tu equipo y le avisas al usuario lo que espera su decisión.

Tus productos (id | nombre | ficha lista):
${productos.map((p) => `${p.id} | ${p.nombre} | ${p.fichaLista ? 'sí' : 'no (primero hay que armar su ficha en Nuevo anuncio, paso 1)'}`).join('\n') || '(todavía ninguno: que cree uno en Nuevo anuncio, paso 1)'}

Los estilos de video (clave | nombre | lo que hay que preguntar antes):
${estilos.join('\n')}

Tu equipo ahora:
${equipo.join('\n') || '(sin datos)'}

Los últimos anuncios (slug | título | estilo | producto | estado):
${anuncios.map((a) => `${a.slug} | ${a.tituloGuion || a.titulo} | ${a.estilo} | ${a.productoId} | ${a.estado}${a.etapa ? ` (${a.etapa})` : ''}`).join('\n') || '(ninguno)'}

La conversación (lo último va al final):
${historia.join('\n')}

Contesta el ÚLTIMO mensaje del USUARIO. Puedes pedirle a la app estas acciones (la app las hace y le muestra el enlace):
- { "tipo": "crear-anuncio", "productoId": "<id>", "estilo": "<clave>", "cantidad": 1-${MAX_ANUNCIOS}, "duracion": "<lo que pidió, ej. 45 segundos>" | null, "respuestas": { "<campo>": "<valor>" }, "idea": "<el ángulo o lo que pidió, opcional>" } → escribe el guion (no cobra nada; el usuario lo revisa y lo aprueba con su costo).
- { "tipo": "investigar", "productoId": "<id>", "pais": "<país>" | null } → la investigación de mercado y de la competencia.
- { "tipo": "recrear", "slug": "<slug de un anuncio>", "productoId": "<id del otro producto>" } → el mismo guion para otro producto.
- { "tipo": "regla", "texto": "<la regla, general, sin producto ni marca>", "estilo": "<clave>" | null } → cuando el usuario dice cómo quiere las cosas de ahora en adelante («que los ganchos sean más cortos», «nunca uses…»).
Reglas: usa SOLO ids, claves y slugs de las listas de arriba. Si falta algo obligatorio (el producto, el estilo o lo que su estilo pide preguntar), NO crees la acción: pregúntalo. Si no dice estilo y el pedido es claro, propón uno y pregunta. Nunca prometas producir ni gastar: producir lo aprueba el usuario en cada guion. Si te pregunta cómo va el trabajo, contesta con lo de tu equipo. Si pide algo que la app no hace desde aquí, dile dónde hacerlo en la app.

Escribe ${rel} con este JSON y nada más: { "respuesta": "…", "acciones": [ … ] }
Tu respuesta final: solo LISTO.`;
}

// ---------------------------------------------------------------- las acciones

const TITULO_ESTADO = { aprobar: 'espera tu aprobación', escribiendo: 'escribiendo el guion' };

async function ejecutar(acciones, ctx) {
  const hechas = [];
  const ids = new Set(ctx.productos.map((p) => p.id));
  const nombreDe = (id) => ctx.productos.find((p) => p.id === id)?.nombre || id;
  for (const a of (Array.isArray(acciones) ? acciones : []).slice(0, 8)) {
    if (!a || typeof a !== 'object') continue;
    try {
      if (a.tipo === 'crear-anuncio') {
        const { crearAnuncio, ESTILOS } = await import('./anuncios-nuevos.js');
        if (!ids.has(a.productoId)) throw new Error('No encuentro ese producto.');
        if (!ESTILOS[a.estilo] || a.estilo === 'agregar') throw new Error('No conozco ese estilo.');
        const n = Math.max(1, Math.min(MAX_ANUNCIOS, Number(a.cantidad) || 1));
        const respuestas = a.respuestas && typeof a.respuestas === 'object' && !Array.isArray(a.respuestas) ? { ...a.respuestas } : {};
        for (let i = 0; i < n; i++) {
          const idea = limpio(a.idea, 400);
          const extra = n > 1 ? ` (versión ${i + 1} de ${n}: un ángulo y un gancho DISTINTOS a las otras)` : '';
          const r = crearAnuncio({ productoId: a.productoId, estilo: a.estilo, duracion: a.duracion ? limpio(a.duracion, 60) : null, respuestas, pedido: `${idea}${extra}`.trim() });
          hechas.push({ tipo: 'anuncio', titulo: `Guion ${ESTILOS[a.estilo].nombre} de ${nombreDe(a.productoId)}${n > 1 ? ` (${i + 1}/${n})` : ''}`, href: `#/nuevo?producto=${encodeURIComponent(a.productoId)}&paso=2&anuncios=${r.slug}`, slug: r.slug, ok: true });
        }
      } else if (a.tipo === 'investigar') {
        if (!ids.has(a.productoId)) throw new Error('No encuentro ese producto.');
        const inv = await import('./investigacion.js');
        inv.investigar(a.productoId, { pais: a.pais ? limpio(a.pais, 60) : null });
        hechas.push({ tipo: 'investigar', titulo: `Investigación de ${nombreDe(a.productoId)}`, href: `#/investigacion/${a.productoId}`, ok: true });
      } else if (a.tipo === 'recrear') {
        if (!ids.has(a.productoId)) throw new Error('No encuentro ese producto.');
        const { recrearAnuncio } = await import('./anuncios-nuevos.js');
        const r = recrearAnuncio(String(a.slug || ''), { productoId: a.productoId });
        hechas.push({ tipo: 'anuncio', titulo: `Recreado para ${nombreDe(a.productoId)}`, href: `#/nuevo?producto=${encodeURIComponent(a.productoId)}&paso=2&anuncios=${r.slug}`, slug: r.slug, ok: true });
      } else if (a.tipo === 'regla') {
        const { ESTILOS } = await import('./anuncios-nuevos.js');
        const estilo = ESTILOS[a.estilo] ? a.estilo : null;
        const r = agregarRegla(a.texto, { estilo });
        if (!r) continue;
        anotar({ agente: estilo ? 'guion' : 'coordinacion', regla: r.regla, estilo, voto: 'regla', origen: 'chat' });
        hechas.push({ tipo: 'regla', titulo: `Aprendido${estilo ? ` (${ESTILOS[estilo].nombre})` : ' (todos los estilos)'}: ${r.regla}`, href: '#/aprendizajes', ok: true });
      }
    } catch (e) {
      const que = { 'crear-anuncio': 'Crear el anuncio', investigar: 'Investigar', recrear: 'Recrear', regla: 'Anotar la regla' }[a.tipo] || 'Una acción';
      hechas.push({ tipo: a.tipo, titulo: `${que}: ${e.message}`, ok: false });
    }
  }
  return hechas;
}

// ---------------------------------------------------------------- contestar

async function responder() {
  pensando = true;
  const id = crypto.randomBytes(4).toString('hex');
  const salida = path.join(DIR, `respuesta-${id}.json`);
  const rel = path.relative(RAIZ, salida).replace(/\\/g, '/');
  let texto = '';
  let acciones = [];
  try {
    const ctx = await contexto();
    const c = leerChat();
    let r = { ok: false };
    try {
      r = await preguntarIA({
        tipo: 'guion',
        uuid: crypto.randomUUID(),
        prompt: textoPrompt(ctx, c.mensajes, rel),
        herramientas: ['Write'],
        permitidas: [`Write(./${rel})`, `Edit(./${rel})`],
        prohibidas: prohibidasComunes({ terminal: false }),
        registro: path.join(DIR, 'registro', 'chat.log'),
        timeoutMs: 4 * 60000,
        maxTurnos: 4,
        verificar: async () => {
          const d = leerJSON(salida);
          return typeof d?.respuesta === 'string' && d.respuesta.trim() ? { ok: true } : { ok: false, errores: [`Escribe ${rel} con { "respuesta": "…", "acciones": [] }.`] };
        },
      });
    } catch (e) {
      r = { ok: false, error: e.message };
    }
    const d = leerJSON(salida);
    fs.rmSync(salida, { force: true });
    texto = limpio(d?.respuesta, 3000);
    if (texto) acciones = await ejecutar(d?.acciones, ctx);
    else texto = r?.sinMotor ? 'Todavía no elegiste tu IA: ve a Ajustes › Conexiones y vuelve a escribirme.' : r?.limite ? `Se acabó el uso de tu plan de ${nombreIA(r.motor)} por ahora. Escríbeme cuando se renueve.` : 'No pude contestarte esta vez. ¿Me lo escribes de nuevo?';
  } catch (e) {
    console.error('[oficina-chat]', e);
    texto = 'Algo falló de mi lado. ¿Me lo escribes de nuevo?';
  } finally {
    const c = leerChat();
    c.mensajes.push({ id: crypto.randomBytes(5).toString('hex'), de: 'coordinadora', texto, acciones, fecha: ahora() });
    guardarChat(c);
    pensando = false;
  }
}

export async function enviar(texto) {
  const t = limpio(texto, 2000);
  if (!t) throw new ErrorApp(400, 'Escribe tu mensaje.');
  if (pensando) throw new ErrorApp(409, 'La coordinadora todavía te está contestando. Espera un momento.');
  const c = leerChat();
  c.mensajes.push({ id: crypto.randomBytes(5).toString('hex'), de: 'tu', texto: t, fecha: ahora() });
  guardarChat(c);
  pensando = true;
  responder();
  return chat();
}

// ---------------------------------------------------------------- aprender: el 👍/👎

// las partes de un anuncio que se califican y el agente que las hace
export const PARTES = {
  guion: { nombre: 'el guion', agente: 'guion' },
  imagenes: { nombre: 'las imágenes y las personas', agente: 'arte' },
  clips: { nombre: 'los clips de video', agente: 'video' },
  voz: { nombre: 'las voces y la música', agente: 'video' },
  edicion: { nombre: 'el montaje y los subtítulos', agente: 'edicion' },
};

function anotar(x) {
  const lista = leerJSON(APRENDIDO);
  const todo = Array.isArray(lista) ? lista : [];
  todo.push({ ...x, fecha: ahora() });
  fs.mkdirSync(DIR, { recursive: true });
  escribirJSON(APRENDIDO, todo.slice(-500));
}

export async function opinar({ slug, voto, partes, texto, paraTodos } = {}) {
  const { anuncioNuevo } = await import('./anuncios-nuevos.js');
  const a = anuncioNuevo(String(slug || ''));
  if (!a) throw new ErrorApp(404, 'No encuentro ese anuncio.');
  if (voto !== 'bien' && voto !== 'mal') throw new ErrorApp(400, 'Elige 👍 o 👎.');
  const t = limpio(texto, 400).replace(/\s+/g, ' ');
  const lasPartes = (Array.isArray(partes) ? partes : []).filter((p) => PARTES[p]);
  if (voto === 'mal' && !t) throw new ErrorApp(400, 'Cuéntame qué no te gustó, para no repetirlo.');
  const estilo = paraTodos ? null : a.estilo;
  const reglas = [];
  if (t) {
    const donde = lasPartes.length ? ` (${lasPartes.map((p) => PARTES[p].nombre).join(', ')})` : '';
    const r = agregarRegla(voto === 'mal' ? `Evitar${donde}: ${t}` : `Funciona, repetirlo${donde}: ${t}`, { estilo });
    if (r) reglas.push(r.regla);
  }
  const agentes = lasPartes.length ? [...new Set(lasPartes.map((p) => PARTES[p].agente))] : ['guion'];
  for (const agente of agentes) anotar({ agente, voto, slug: a.slug, estilo: a.estilo, regla: reglas[0] || null, origen: 'opinion' });
  // la opinión del anuncio (para que la entrega muestre que ya la diste)
  try {
    escribirJSON(path.join(TEMP, a.slug, 'app', 'opinion.json'), { voto, partes: lasPartes, texto: t, paraTodos: Boolean(paraTodos), fecha: ahora() });
  } catch {
    /* sin carpeta */
  }
  return { ok: true, reglas };
}

export function opinionDe(slug) {
  return leerJSON(path.join(TEMP, String(slug || ''), 'app', 'opinion.json'));
}

/** Por agente: cuántos 👍/👎 recibió su trabajo y lo que aprendió en los últimos 7 días. */
export function aprendido() {
  const lista = leerJSON(APRENDIDO);
  const semana = Date.now() - 7 * 24 * 3600000;
  const out = {};
  for (const x of Array.isArray(lista) ? lista : []) {
    const o = (out[x.agente] ||= { bien: 0, mal: 0, semana: [] });
    if (x.voto === 'bien') o.bien++;
    if (x.voto === 'mal') o.mal++;
    if (x.regla && Date.parse(x.fecha) > semana && !o.semana.some((s) => s.regla === x.regla)) o.semana.push({ regla: x.regla, fecha: x.fecha });
  }
  for (const o of Object.values(out)) o.semana = o.semana.reverse().slice(0, 10);
  return out;
}

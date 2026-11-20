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
// (2026-11-20e) COMO UNA ASISTENTE DE VERDAD: le adjuntas archivos (imágenes, PDF, Word, texto) y los lee; habla
// natural y corto; y lo que encarga lo SIGUE ella sola (seguimiento cada 15 s): cuando el guion queda listo te escribe
// con el costo y te pregunta si lo produce; con tu sí («dale») lo aprueba y lo produce; cuando termina te entrega el
// enlace, y si algo se frena te avisa. También encarga anuncios de imagen al agente de variaciones (con tu imagen de
// referencia o desde la investigación) con el mismo «¿le doy?» por el costo, y escribe ella misma lo que le pides
// (10 variaciones de un texto, una revisión, un copy) como una «entrega» que copias o descargas.
//   subirAdjunto(bytes, nombre) -> { id, nombre, tipo: imagen|pdf|documento|video, url }
//
// Vive en temp/_oficina/ (chat.json, aprendido.json, adjuntos/<id>/). Las reglas van a los aprendizajes de siempre (lib/aprendizajes.js),
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
const ADJUNTOS = path.join(DIR, 'adjuntos');
const TOPE_MENSAJES = 200;
const MAX_ANUNCIOS = 5; // por mensaje
const MAX_IMAGENES = 10;
const MAX_ADJUNTOS = 6; // por mensaje
const RE_ADJUNTO = /^[a-f0-9]{12}$/;

const ahora = () => new Date().toISOString();
const limpio = (t, n = 2000) => String(t ?? '').replace(/\r/g, '').trim().slice(0, n);
const leerChat = () => {
  const c = leerJSON(CHAT);
  return { mensajes: Array.isArray(c?.mensajes) ? c.mensajes : [], encargos: Array.isArray(c?.encargos) ? c.encargos : [] };
};
const guardarChat = (c) => {
  fs.mkdirSync(DIR, { recursive: true });
  escribirJSON(CHAT, { mensajes: c.mensajes.slice(-TOPE_MENSAJES), encargos: (c.encargos || []).slice(-60) });
};
// lo que ella escribe sola (el seguimiento) va marcado como aviso
const decir = (c, texto, acciones = []) => c.mensajes.push({ id: crypto.randomBytes(5).toString('hex'), de: 'coordinadora', texto, acciones, aviso: true, fecha: ahora() });
const dinero = (n) => `US$${(Math.round(Number(n) * 100) / 100).toFixed(2)}`;

// ---------------------------------------------------------------- los archivos que le pasas

function metaAdjunto(id) {
  if (!RE_ADJUNTO.test(String(id || ''))) return null;
  const m = leerJSON(path.join(ADJUNTOS, id, 'meta.json'));
  return m?.id === id ? m : null;
}
const urlAdjunto = (m) => `/archivos/oficina/adjuntos/${m.id}/${m.archivo}`;
const paraLaPantallaAdjunto = (m) => ({ id: m.id, nombre: m.nombre, tipo: m.tipo, url: urlAdjunto(m) });
export const rutaAdjunto = (id, archivo) => {
  const m = metaAdjunto(id);
  return m && (archivo === m.archivo || archivo === 'texto.md') ? path.join(ADJUNTOS, id, archivo) : null;
};

const esVideo = (b) => b.length > 12 && b.slice(4, 8).toString('latin1') === 'ftyp' && /^(isom|iso\d|mp4\d|mp41|mp42|qt {2}|M4V |avc1|dash)/.test(b.slice(8, 12).toString('latin1'));

/** Guarda un archivo que le pasas en el chat (hasta 25 MB): imagen, PDF, Word/texto o un video (que no puede ver). */
export async function subirAdjunto(bytes, nombre = '') {
  if (!Buffer.isBuffer(bytes) || !bytes.length) throw new ErrorApp(400, 'No llegó ningún archivo.');
  const id = crypto.randomBytes(6).toString('hex');
  const dir = path.join(ADJUNTOS, id);
  const original = limpio(nombre, 120).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').trim() || 'archivo';
  const ext = (path.extname(original).slice(1) || '').toLowerCase();
  const { formatoDeBytes } = await import('./productos.js');
  let meta = null;
  fs.mkdirSync(dir, { recursive: true });
  try {
    if (esVideo(bytes) || ['mp4', 'mov', 'webm', 'm4v'].includes(ext)) {
      const archivo = `archivo.${['mov', 'webm', 'm4v'].includes(ext) ? ext : 'mp4'}`;
      fs.writeFileSync(path.join(dir, archivo), bytes);
      meta = { tipo: 'video', archivo };
    } else if (formatoDeBytes(bytes)) {
      const { normalizarImagen } = await import('./imagen-ads/local.js');
      const abs = await normalizarImagen(bytes, path.join(dir, 'archivo'), formatoDeBytes(bytes));
      meta = { tipo: 'imagen', archivo: path.basename(abs) };
    } else {
      const { investigacionATexto } = await import('./imagen-ads/biblioteca-referencias.js');
      const r = investigacionATexto(bytes, original);
      if (!r) throw new ErrorApp(400, 'No pude leer ese archivo. Pásamelo como imagen, PDF, Word (.docx) o texto.');
      if (r.pdf) {
        fs.writeFileSync(path.join(dir, 'archivo.pdf'), bytes);
        meta = { tipo: 'pdf', archivo: 'archivo.pdf' };
      } else {
        const archivo = `archivo.${ext === 'docx' ? 'docx' : ['md', 'csv', 'txt', 'json', 'html'].includes(ext) ? ext : 'txt'}`;
        fs.writeFileSync(path.join(dir, archivo), bytes);
        fs.writeFileSync(path.join(dir, 'texto.md'), r.texto.slice(0, 200000));
        meta = { tipo: 'documento', archivo };
      }
    }
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw e;
  }
  meta = { id, nombre: original, ...meta, bytes: bytes.length, fecha: ahora() };
  escribirJSON(path.join(dir, 'meta.json'), meta);
  return paraLaPantallaAdjunto(meta);
}

/** Cómo ve la IA un archivo: la ruta que puede leer (el texto ya sacado de un Word). */
function adjuntoParaLaIA(m) {
  const rel = (f) => path.relative(RAIZ, path.join(ADJUNTOS, m.id, f)).replace(/\\/g, '/');
  if (m.tipo === 'video') return `«${m.nombre}» (un video: no lo puedes ver; si quiere rehacerlo o clonarlo, que lo suba en Nuevo anuncio › Agregar)`;
  if (m.tipo === 'documento') return `«${m.nombre}» (documento, su texto en ${rel('texto.md')}) [id ${m.id}]`;
  return `«${m.nombre}» (${m.tipo}, en ${rel(m.archivo)}) [id ${m.id}]`;
}
let pensando = false;

// ---------------------------------------------------------------- el estado de lo que se creó desde el chat

async function estadoDeAccion(a) {
  if (a?.lote) {
    try {
      const { leerConductor } = await import('./conductor.js');
      const c = leerConductor(a.lote);
      return { ...a, estado: !c ? 'aprobar' : c.estado === 'listo' ? 'listo' : c.estado === 'error' ? 'error' : 'produciendo' };
    } catch {
      return a;
    }
  }
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
    c.mensajes.slice(-80).map(async (m) => {
      const x = Array.isArray(m.acciones) && m.acciones.length ? { ...m, acciones: await Promise.all(m.acciones.map(estadoDeAccion)) } : { ...m };
      if (Array.isArray(m.adjuntos)) x.adjuntos = m.adjuntos.map(metaAdjunto).filter(Boolean).map(paraLaPantallaAdjunto);
      return x;
    })
  );
  const pendientes = c.encargos.filter((e) => e.estado === 'espera-si').map((e) => ({ id: e.id, titulo: e.titulo, costo: e.costo }));
  return { mensajes, pensando, pendientes };
}

export function borrarChat() {
  if (pensando) throw new ErrorApp(409, 'La coordinadora está contestando. Espera un momento.');
  const c = leerChat();
  guardarChat({ mensajes: [], encargos: c.encargos.filter((e) => !['listo', 'error', 'cancelado'].includes(e.estado)) });
  return { mensajes: [], pensando: false, pendientes: [] };
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
  let conFoto = [];
  try {
    conFoto = (await import('./imagen-ads/lotes.js')).productosConFoto();
  } catch {
    /* sin fotos */
  }
  return { productos, estilos, anuncios, oficina, conFoto, encargos: leerChat().encargos };
}

function textoPrompt({ productos, estilos, anuncios, oficina, conFoto, encargos }, mensajes, rel) {
  const coord = oficina?.agentes?.find((a) => a.id === 'coordinacion');
  const equipo = (oficina?.agentes || []).filter((a) => a.estado !== 'libre').map((a) => `${a.nombre} (${a.rol}): ${a.estado}${a.ahora.length ? ` — ahora: ${a.ahora.map((t) => t.titulo).join(', ')}` : ''}${a.necesita.length && a.id !== 'coordinacion' ? ` — te necesita: ${a.necesita.map((t) => t.titulo).join(', ')}` : ''}`);
  const fotos = new Map((conFoto || []).map((p) => [p.id, p]));
  const recientes = mensajes.slice(-16);
  const historia = recientes.map((m, k) => {
    const adj = (m.adjuntos || []).map(metaAdjunto).filter(Boolean);
    // los archivos de los últimos mensajes van con su ruta (para leerlos); los viejos, solo el nombre
    const verAdj = adj.length ? ` [adjuntó: ${adj.map((x) => (k >= recientes.length - 6 ? adjuntoParaLaIA(x) : `«${x.nombre}»`)).join('; ')}]` : '';
    const acc = m.acciones?.length ? ` [acciones: ${m.acciones.map((a) => `${a.titulo}${a.ok === false ? ' (falló)' : ''}`).join('; ')}]` : '';
    const ent = m.entrega ? ` [entregaste: ${m.entrega.titulo}]` : '';
    return `${m.de === 'tu' ? 'USUARIO' : 'TÚ'}: ${m.texto}${verAdj}${acc}${ent}`;
  });
  const enCurso = (encargos || []).filter((e) => !['listo', 'cancelado'].includes(e.estado)).slice(-12);
  return `TAREA: coordinadora de la oficina virtual. Te ejecuta la app Kads Studio, sin chat ni terminal: solo puedes leer los archivos que te pasó el usuario (Read) y escribir tu respuesta (Write).

Eres ${coord?.nombre || 'Valentina'}, la asistente y coordinadora de ${oficina?.nombre || 'la oficina'} de anuncios con IA del usuario. Le escribes por chat como una persona de verdad: natural, cálida, de tú, con frases cortas y sin sonar a robot. Nada de listas, títulos, negritas ni textos largos y perfectos: normalmente 1 a 3 frases, como un mensaje de WhatsApp de una compañera de trabajo. Si te falta un dato, pregúntalo (una o dos cosas a la vez, no un formulario). No repitas lo que ya dijo ni expliques de más.

Tus productos (id | nombre | ficha lista para video | foto para imágenes | investigación de mercado):
${productos.map((p) => `${p.id} | ${p.nombre} | ${p.fichaLista ? 'sí' : 'no'} | ${fotos.has(p.id) ? 'sí' : 'no'} | ${fotos.get(p.id)?.investigacion ? 'sí' : 'no'}`).join('\n') || '(todavía ninguno: que cree uno en Productos o en Nuevo anuncio, paso 1)'}

Los estilos de video (clave | nombre | lo que hay que preguntar antes):
${estilos.join('\n')}

Tu equipo ahora:
${equipo.join('\n') || '(todos libres)'}

Lo que tú estás siguiendo (id | qué | estado${enCurso.some((e) => e.costo != null) ? ' | costo' : ''}):
${enCurso.map((e) => `${e.id} | ${e.titulo} | ${{ escribiendo: 'escribiendo el guion', 'espera-si': 'ESPERA EL SÍ DEL USUARIO para producir', produciendo: 'produciéndose', error: `se frenó${e.error ? `: ${e.error}` : ''}`, pausado: 'en pausa: el usuario tiene que entrar a decidir algo' }[e.estado] || e.estado}${e.costo != null ? ` | ${dinero(e.costo)}` : ''}`).join('\n') || '(nada)'}

Los últimos anuncios de video (slug | título | estilo | producto | estado):
${anuncios.map((a) => `${a.slug} | ${a.tituloGuion || a.titulo} | ${a.estilo} | ${a.productoId} | ${a.estado}${a.etapa ? ` (${a.etapa})` : ''}`).join('\n') || '(ninguno)'}

La conversación (lo último va al final):
${historia.join('\n')}

Contesta el ÚLTIMO mensaje del USUARIO. Si adjuntó archivos, LÉELOS con Read antes de contestar (imágenes y PDF también) y úsalos: es lo que te está pasando para que trabajes con eso.
Puedes pedirle a la app estas acciones (la app las hace, le muestra el enlace y TÚ sigues el trabajo: cuando el guion esté listo le escribes con el costo, y cuando termine le entregas el resultado):
- { "tipo": "crear-anuncio", "productoId": "<id>", "estilo": "<clave>", "cantidad": 1-${MAX_ANUNCIOS}, "duracion": "<lo que pidió>" | null, "respuestas": { "<campo>": "<valor>" }, "idea": "<el ángulo, lo que pidió y lo que sacaste de sus archivos>" } → un anuncio de video: tu equipo escribe el guion (gratis) y tú le avisas el costo antes de producir.
- { "tipo": "producir", "id": "<id de lo que estás siguiendo>" } → SOLO si eso ESPERA EL SÍ y el usuario acaba de decir que sí (dale, hazlo, de una, ok, sí…) después de ver el costo. Aprueba y produce: ahí se cobra.
- { "tipo": "imagenes", "productoId": "<id con foto>", "cantidad": 1-${MAX_IMAGENES}, "formato": "1:1" | "9:16" | "ambos", "referencia": "<id de una imagen que adjuntó>" | null, "pais": "<país>" | null, "publico": "<público>" | null, "idea": "<lo que pidió>" } → anuncios de imagen con el agente de variaciones: con su imagen de referencia (variaciones de ese anuncio) o, sin referencia, desde la investigación de mercado del producto (si no la tiene, primero investigar). La app le muestra el costo y espera su sí.
- { "tipo": "investigar", "productoId": "<id>", "pais": "<país>" | null } → la investigación de mercado y de la competencia (sin costo de imágenes).
- { "tipo": "recrear", "slug": "<slug>", "productoId": "<id del otro producto>" } → el mismo guion para otro producto.
- { "tipo": "seguir", "slug": "<slug de un anuncio de video>" } → empiezas a seguir un anuncio que ya existe (te encargas de avisarle el costo y producirlo).
- { "tipo": "cancelar", "id": "<id de lo que estás siguiendo>" } → si ya no lo quiere.
- { "tipo": "regla", "texto": "<la regla, general, sin producto ni marca>", "estilo": "<clave>" | null } → cuando dice cómo quiere las cosas de ahora en adelante.
Y si te pide algo que puedes ESCRIBIR tú misma (variaciones de un texto o de un copy, títulos, ganchos, una revisión de algo que te pasó, un resumen, un guion corto para revisar…), hazlo de verdad y ponlo en "entrega": { "titulo": "<corto>", "texto": "<el contenido completo, bien hecho, con las variaciones numeradas>" }. Ahí sí puede ser largo; tu "respuesta" sigue siendo corta («Listo, aquí van las 10 👇»).
Reglas: usa SOLO ids, claves y slugs de las listas de arriba. Si falta algo obligatorio (el producto, el estilo o lo que su estilo pide preguntar), NO crees la acción: pregúntalo. Si no dice estilo y el pedido es claro, propón uno y pregunta. Nunca produzcas ni gastes sin que haya visto el costo y dicho que sí. Si te pregunta cómo va algo, contesta con lo que estás siguiendo y lo de tu equipo. Si pide algo que la app no hace desde aquí, dile dónde hacerlo.

Escribe ${rel} con este JSON y nada más: { "respuesta": "…", "acciones": [ … ], "entrega": null | { "titulo": "…", "texto": "…" } }
Tu respuesta final: solo LISTO.`;
}

// ---------------------------------------------------------------- las acciones

const TITULO_ESTADO = { aprobar: 'espera tu aprobación', escribiendo: 'escribiendo el guion' };

/** Anota algo que la coordinadora sigue (lo relee y lo guarda al toque: el seguimiento corre en paralelo). */
function encargar(e) {
  const c = leerChat();
  c.encargos = c.encargos.filter((x) => x.id !== e.id);
  c.encargos.push({ estado: 'escribiendo', creado: ahora(), ...e });
  guardarChat(c);
}
function cambiarEncargo(id, cambios) {
  const c = leerChat();
  const e = c.encargos.find((x) => x.id === id);
  if (e) Object.assign(e, cambios);
  guardarChat(c);
  return e;
}

/** Anuncios de imagen con el agente de variaciones: arma el lote (borrador) con la referencia que adjuntó, si hay. */
async function loteDeImagenes(a, ctx) {
  const lotes = await import('./imagen-ads/lotes.js');
  const p = (ctx.conFoto || []).find((x) => x.id === a.productoId);
  if (!p) throw new Error('Ese producto no tiene foto todavía: súbela en Productos.');
  const ref = a.referencia ? metaAdjunto(a.referencia) : null;
  if (a.referencia && (!ref || ref.tipo !== 'imagen')) throw new Error('No encuentro esa imagen de referencia.');
  if (!ref && !p.investigacion) throw new Error(`${p.nombre} todavía no tiene investigación de mercado: hazla primero o pásame un anuncio de referencia.`);
  const cantidad = Math.max(1, Math.min(MAX_IMAGENES, Number(a.cantidad) || 5));
  const formatos = a.formato === 'ambos' ? ['1:1', '9:16'] : a.formato === '9:16' ? ['9:16'] : ['1:1'];
  const antes = p.ultimoLote?.datos || {};
  const r = lotes.crearLote({
    productoId: p.id,
    fotoProducto: p.fotoSugerida || p.fotos[0].n,
    datos: { nombre: p.nombre, publico: limpio(a.publico || antes.publico, 300), pais: limpio(a.pais || antes.pais || 'Colombia', 60), idioma: 'es', adicional: limpio(a.idea, 600) },
    cantidad,
    formatos,
    logo: null,
    modo: ref ? 'variantes' : 'nuevos',
    agente: 'variaciones',
    fiel: Boolean(ref),
    rapido: false,
    usarInvestigacion: true,
    ...(ref ? { referenciasPropias: [], conceptosReferencias: [limpio(a.idea, 300)], refs: [] } : {}),
  });
  const { R, carpetaDe, guardarJSON } = await import('./imagen-ads/disco.js');
  const carpeta = carpetaDe(r.lote);
  if (ref) {
    const { normalizarImagen } = await import('./imagen-ads/local.js');
    const { formatoDeBytes } = await import('./productos.js');
    const bytes = fs.readFileSync(path.join(ADJUNTOS, ref.id, ref.archivo));
    const abs = await normalizarImagen(bytes, path.join(R.referencias(carpeta), 'R01'), formatoDeBytes(bytes));
    const brief = lotes.leerBrief(carpeta);
    brief.referencias = [`entrada/referencias/${path.basename(abs)}`];
    guardarJSON(R.brief(carpeta), brief);
  }
  const falta = lotes.faltaDelBorrador(carpeta, lotes.leerBrief(carpeta));
  if (falta) throw new Error(falta);
  const { costoDeImagenAds } = await import('./costo-estimado.js');
  const { costoMaximoDeLaAccion } = await import('./imagen-ads/costo.js');
  const costo = costoMaximoDeLaAccion(await costoDeImagenAds(), lotes.leerBrief(carpeta), null);
  return { lote: r.lote, producto: p, cantidad: cantidad * formatos.length, costo, conRef: Boolean(ref) };
}

/** El «sí» del usuario: aprueba y produce lo que esperaba (ya vio el costo). */
async function producir(e) {
  const { esperarFamilias, iniciarProduccion, leerConductor } = await import('./conductor.js');
  await esperarFamilias();
  if (e.tipo === 'imagenes') {
    if (leerConductor(e.lote)) return;
    const lotes = await import('./imagen-ads/lotes.js');
    const { carpetaDe } = await import('./imagen-ads/disco.js');
    const brief = lotes.leerBrief(carpetaDe(e.lote));
    const { costoDeImagenAds } = await import('./costo-estimado.js');
    const { costoMaximoDeLaAccion } = await import('./imagen-ads/costo.js');
    const ahoraCuesta = costoMaximoDeLaAccion(await costoDeImagenAds(), brief, null);
    if (ahoraCuesta === null || ahoraCuesta > (e.costo ?? 0) + 0.001) throw new Error(`el precio cambió (ahora ${ahoraCuesta === null ? '¿?' : dinero(ahoraCuesta)}): confírmamelo otra vez`);
    iniciarProduccion(e.lote);
    return;
  }
  if (leerConductor(e.slug)) return;
  const { aprobarYProducir } = await import('./anuncios-nuevos.js');
  await aprobarYProducir(e.slug);
}

async function ejecutar(acciones, ctx) {
  const hechas = [];
  const avisos = [];
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
          const titulo = `${ESTILOS[a.estilo].nombre} de ${nombreDe(a.productoId)}${n > 1 ? ` (${i + 1}/${n})` : ''}`;
          hechas.push({ tipo: 'anuncio', titulo: `Guion ${titulo}`, href: `#/nuevo?producto=${encodeURIComponent(a.productoId)}&paso=2&anuncios=${r.slug}`, slug: r.slug, ok: true });
          encargar({ id: r.slug, tipo: 'video', slug: r.slug, productoId: a.productoId, titulo });
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
        encargar({ id: r.slug, tipo: 'video', slug: r.slug, productoId: a.productoId, titulo: `el anuncio para ${nombreDe(a.productoId)}` });
      } else if (a.tipo === 'seguir') {
        const { anuncioNuevo } = await import('./anuncios-nuevos.js');
        const x = anuncioNuevo(String(a.slug || ''));
        if (!x) throw new Error('No encuentro ese anuncio.');
        if (!leerChat().encargos.some((e) => e.id === x.slug && !['listo', 'cancelado'].includes(e.estado))) encargar({ id: x.slug, tipo: 'video', slug: x.slug, productoId: x.productoId, titulo: x.tituloGuion || x.titulo || x.slug });
        hechas.push({ tipo: 'anuncio', titulo: `Lo sigo yo: ${x.tituloGuion || x.titulo || x.slug}`, href: `#/anuncio/${x.slug}`, slug: x.slug, ok: true });
      } else if (a.tipo === 'producir') {
        const e = leerChat().encargos.find((x) => x.id === String(a.id || ''));
        if (!e) throw new Error('No encuentro eso entre lo que sigo.');
        if (e.estado !== 'espera-si') throw new Error(e.estado === 'produciendo' ? 'ya se está produciendo' : 'todavía no te dije el costo');
        await producir(e);
        cambiarEncargo(e.id, { estado: 'produciendo', aprobado: ahora() });
        hechas.push(e.tipo === 'imagenes' ? { tipo: 'imagenes', titulo: `Generando ${e.titulo}`, href: `#/imagenes/${e.lote}`, lote: e.lote, ok: true } : { tipo: 'anuncio', titulo: `Produciendo ${e.titulo}`, href: `#/anuncio/${e.slug}/produccion`, slug: e.slug, ok: true });
      } else if (a.tipo === 'imagenes') {
        if (!ids.has(a.productoId)) throw new Error('No encuentro ese producto.');
        const r = await loteDeImagenes(a, ctx);
        const titulo = `${r.cantidad} imágenes de ${r.producto.nombre}${r.conRef ? ' (variaciones de tu referencia)' : ''}`;
        if (r.costo === null) throw new Error('No pude calcular el costo de las imágenes. Intenta otra vez en un rato.');
        if (r.costo === 0) {
          encargar({ id: r.lote, tipo: 'imagenes', lote: r.lote, productoId: r.producto.id, titulo, costo: 0, estado: 'espera-si' });
          await producir({ tipo: 'imagenes', lote: r.lote, costo: 0 });
          cambiarEncargo(r.lote, { estado: 'produciendo', aprobado: ahora() });
          hechas.push({ tipo: 'imagenes', titulo: `Generando ${titulo} (sin costo por imagen)`, href: `#/imagenes/${r.lote}`, lote: r.lote, ok: true });
        } else {
          encargar({ id: r.lote, tipo: 'imagenes', lote: r.lote, productoId: r.producto.id, titulo, costo: r.costo, estado: 'espera-si', costoAvisado: ahora() });
          hechas.push({ tipo: 'imagenes', titulo: `${titulo} · ${dinero(r.costo)}`, href: `#/imagenes/${r.lote}`, lote: r.lote, ok: true });
          avisos.push(`Las ${r.cantidad} imágenes salen en ${dinero(r.costo)}. ¿Le doy?`);
        }
      } else if (a.tipo === 'cancelar') {
        const e = cambiarEncargo(String(a.id || ''), { estado: 'cancelado' });
        if (!e) throw new Error('No encuentro eso entre lo que sigo.');
        hechas.push({ tipo: 'cancelar', titulo: `Ya no sigo: ${e.titulo}`, ok: true });
      } else if (a.tipo === 'regla') {
        const { ESTILOS } = await import('./anuncios-nuevos.js');
        const estilo = ESTILOS[a.estilo] ? a.estilo : null;
        const r = agregarRegla(a.texto, { estilo });
        if (!r) continue;
        anotar({ agente: estilo ? 'guion' : 'coordinacion', regla: r.regla, estilo, voto: 'regla', origen: 'chat' });
        hechas.push({ tipo: 'regla', titulo: `Aprendido${estilo ? ` (${ESTILOS[estilo].nombre})` : ' (todos los estilos)'}: ${r.regla}`, href: '#/aprendizajes', ok: true });
      }
    } catch (e) {
      const que = { 'crear-anuncio': 'Crear el anuncio', investigar: 'Investigar', recrear: 'Recrear', regla: 'Anotar la regla', imagenes: 'Las imágenes', producir: 'Producir', seguir: 'Seguirlo', cancelar: 'Cancelar' }[a.tipo] || 'Una acción';
      hechas.push({ tipo: a.tipo, titulo: `${que}: ${e.message}`, ok: false });
    }
  }
  return { hechas, avisos };
}

// ---------------------------------------------------------------- contestar

async function responder() {
  pensando = true;
  const id = crypto.randomBytes(4).toString('hex');
  const salida = path.join(DIR, `respuesta-${id}.json`);
  const rel = path.relative(RAIZ, salida).replace(/\\/g, '/');
  let texto = '';
  let acciones = [];
  let entrega = null;
  try {
    const ctx = await contexto();
    const c = leerChat();
    let r = { ok: false };
    try {
      r = await preguntarIA({
        tipo: 'guion',
        uuid: crypto.randomUUID(),
        prompt: textoPrompt(ctx, c.mensajes, rel),
        herramientas: ['Read', 'Write'],
        permitidas: [`Write(./${rel})`, `Edit(./${rel})`, `Read(./${path.relative(RAIZ, ADJUNTOS).replace(/\\/g, '/')}/**)`],
        prohibidas: prohibidasComunes({ terminal: false }),
        registro: path.join(DIR, 'registro', 'chat.log'),
        timeoutMs: 6 * 60000,
        maxTurnos: 12,
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
    if (texto) {
      const r2 = await ejecutar(d?.acciones, ctx);
      acciones = r2.hechas;
      if (r2.avisos.length) texto = `${texto} ${r2.avisos.join(' ')}`;
      const e = d?.entrega && typeof d.entrega === 'object' ? { titulo: limpio(d.entrega.titulo, 120) || 'Entrega', texto: limpio(d.entrega.texto, 30000) } : null;
      if (e?.texto) entrega = e;
    }
    else texto = r?.sinMotor ? 'Todavía no elegiste tu IA: ve a Ajustes › Conexiones y vuelve a escribirme.' : r?.limite ? `Se acabó el uso de tu plan de ${nombreIA(r.motor)} por ahora. Escríbeme cuando se renueve.` : 'No pude contestarte esta vez. ¿Me lo escribes de nuevo?';
  } catch (e) {
    console.error('[oficina-chat]', e);
    texto = 'Algo falló de mi lado. ¿Me lo escribes de nuevo?';
  } finally {
    const c = leerChat();
    c.mensajes.push({ id: crypto.randomBytes(5).toString('hex'), de: 'coordinadora', texto, acciones, ...(entrega ? { entrega } : {}), fecha: ahora() });
    guardarChat(c);
    pensando = false;
    seguimiento(); // por si lo que encargó ya cambió
  }
}

export async function enviar(texto, adjuntos = []) {
  const adj = (Array.isArray(adjuntos) ? adjuntos : []).slice(0, MAX_ADJUNTOS).map(String).filter((id) => metaAdjunto(id));
  const t = limpio(texto, 2000) || (adj.length ? '(te pasé estos archivos)' : '');
  if (!t) throw new ErrorApp(400, 'Escribe tu mensaje.');
  if (pensando) throw new ErrorApp(409, 'La coordinadora todavía te está contestando. Espera un momento.');
  const c = leerChat();
  c.mensajes.push({ id: crypto.randomBytes(5).toString('hex'), de: 'tu', texto: t, ...(adj.length ? { adjuntos: adj } : {}), fecha: ahora() });
  guardarChat(c);
  pensando = true;
  responder();
  return chat();
}

// ---------------------------------------------------------------- el seguimiento: lo que ella encargó, hasta entregarlo

let siguiendo = false;
const DE_ERROR = (c) => (c?.pasos || []).find((p) => p.error)?.error?.mensaje || null;

/** Revisa lo que sigue y le escribe al usuario cuando cambia algo que le importa. Nunca tira. */
export async function seguimiento() {
  if (siguiendo) return;
  siguiendo = true;
  try {
    const activos = leerChat().encargos.filter((e) => !['listo', 'cancelado'].includes(e.estado));
    if (!activos.length) return;
    const { leerConductor } = await import('./conductor.js');
    const nuevos = []; // { id, cambios, texto, accion }
    for (const e of activos) {
      try {
        const cond = leerConductor(e.slug || e.lote);
        if (e.tipo === 'imagenes') {
          if (!cond) continue;
          const href = `#/imagenes/${e.lote}`;
          if (cond.estado === 'listo') nuevos.push({ id: e.id, cambios: { estado: 'listo' }, texto: `Ya están tus ${e.titulo} 👀 Échales un ojo y me dices qué tal.`, accion: { tipo: 'imagenes', titulo: `Ver ${e.titulo}`, href, lote: e.lote, ok: true } });
          else if ((cond.estado === 'error' || (cond.estado === 'pausado' && DE_ERROR(cond))) && e.estado !== 'error') nuevos.push({ id: e.id, cambios: { estado: 'error', error: DE_ERROR(cond) }, texto: `Uy, las ${e.titulo} se frenaron${DE_ERROR(cond) ? `: ${DE_ERROR(cond)}` : ''}. Míralo aquí y lo retomas.`, accion: { tipo: 'imagenes', titulo: e.titulo, href, lote: e.lote, ok: true } });
          else if (cond.estado === 'corriendo' && e.estado !== 'produciendo') nuevos.push({ id: e.id, cambios: { estado: 'produciendo' } });
          continue;
        }
        const an = await import('./anuncios-nuevos.js');
        const x = an.anuncioNuevo(e.slug);
        if (!x) {
          nuevos.push({ id: e.id, cambios: { estado: 'cancelado' } });
          continue;
        }
        const titulo = x.tituloGuion ? `«${x.tituloGuion}»` : e.titulo;
        if (!cond) {
          const g = an.estadoGuion(e.slug);
          if (g?.estado === 'listo' && g.puedeAprobar && e.estado === 'escribiendo') {
            const { costoDelAnuncio } = await import('./costo-estimado.js');
            const costo = await costoDelAnuncio(e.slug, { esperarMs: 90000 });
            if (!costo?.disponible || !(Number(costo.dolares) >= 0)) continue; // todavía calculando: en la próxima vuelta
            nuevos.push({ id: e.id, cambios: { estado: 'espera-si', costo: Number(costo.dolares), costoAvisado: ahora(), titulo }, texto: `Ya quedó el guion de ${titulo} 🙌 Producirlo sale como ${dinero(costo.dolares)}. Léelo si quieres y me dices: ¿le doy?`, accion: { tipo: 'anuncio', titulo: `Guion de ${titulo}`, href: `#/nuevo?producto=${encodeURIComponent(x.productoId)}&paso=2&anuncios=${e.slug}`, slug: e.slug, ok: true } });
          } else if (g?.estado === 'error' && e.estado !== 'error') {
            nuevos.push({ id: e.id, cambios: { estado: 'error', error: g.error?.mensaje || null }, texto: `Se me trabó el guion de ${titulo}${g.error?.mensaje ? `: ${g.error.mensaje}` : ''}. Míralo aquí y lo reintentas, o dime y lo vemos.`, accion: { tipo: 'anuncio', titulo: `Guion de ${titulo}`, href: `#/nuevo?producto=${encodeURIComponent(x.productoId)}&paso=2&anuncios=${e.slug}`, slug: e.slug, ok: true } });
          }
          continue;
        }
        const href = `#/anuncio/${e.slug}`;
        if (cond.estado === 'listo') nuevos.push({ id: e.id, cambios: { estado: 'listo' }, texto: `¡Listo ${titulo}! 🎉 Aquí lo tienes. Si algo no te cuadra me dices y lo ajustamos.`, accion: { tipo: 'anuncio', titulo: `Ver ${titulo}`, href, slug: e.slug, ok: true } });
        else if ((cond.estado === 'error' || (cond.estado === 'pausado' && DE_ERROR(cond))) && e.estado !== 'error') nuevos.push({ id: e.id, cambios: { estado: 'error', error: DE_ERROR(cond) }, texto: `Ojo: ${titulo} se frenó${DE_ERROR(cond) ? ` (${DE_ERROR(cond)})` : ''}. Entra aquí y lo retomas, no se pierde lo que ya está hecho.`, accion: { tipo: 'anuncio', titulo: `${titulo}`, href: `#/anuncio/${e.slug}/produccion`, slug: e.slug, ok: true } });
        else if (cond.estado === 'pausado' && !DE_ERROR(cond) && e.estado !== 'pausado' && e.estado !== 'espera-si') nuevos.push({ id: e.id, cambios: { estado: 'pausado' }, texto: `${titulo} va bien, pero necesito que elijas algo para seguir. Entra aquí 👇`, accion: { tipo: 'anuncio', titulo: `${titulo}`, href: `#/anuncio/${e.slug}/produccion`, slug: e.slug, ok: true } });
        else if (['corriendo', 'esperando'].includes(cond.estado) && e.estado !== 'produciendo') nuevos.push({ id: e.id, cambios: { estado: 'produciendo' } });
      } catch (err) {
        console.error('[oficina-chat] seguimiento', e.id, err?.message || err);
      }
    }
    if (!nuevos.length) return;
    const c = leerChat();
    for (const n of nuevos) {
      const e = c.encargos.find((x) => x.id === n.id);
      if (!e) continue;
      Object.assign(e, n.cambios);
      if (n.texto) decir(c, n.texto, n.accion ? [n.accion] : []);
    }
    guardarChat(c);
  } finally {
    siguiendo = false;
  }
}
if (!process.env.OFICINA_SIN_SEGUIMIENTO) setInterval(() => seguimiento().catch(() => {}), Number(process.env.OFICINA_SEGUIMIENTO_MS) || 15000).unref();

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

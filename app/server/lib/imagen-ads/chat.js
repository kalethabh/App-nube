// CHAT DE IMÁGENES (2026-11-27a). Pedido: «un chat libre especializado para generar imágenes, pero que tenga el
// conocimiento de cómo las quiero y tenga en cuenta todo de la app». Decisiones del usuario: sección propia en el menú,
// GENERA DIRECTO (sin preguntar en cada mensaje) y las imágenes quedan EN LA CARPETA DEL PRODUCTO.
//
// Cada chat es un LOTE del producto (brief.chat): sus imágenes salen en Anuncios de imagen → la carpeta del producto,
// con todo lo del lote (versiones, «Me funciona», descargar, editar, regenerar, cambiar el tamaño). La IA conversa con
// UNA sesión que se retoma (memoria real) y, cuando hay que crear imágenes, escribe el anuncio de cada una (V##.json,
// como el PASO 5 de la skill); la app las agrega al lote y el motor de siempre las genera (sin revisión: quedan listas
// apenas salen). Un cambio sobre una imagen («cambia el fondo de V02») va como pedido ya traducido (sin tanda de ajuste).
//
//   temp/_chat-imagenes/<id>/chat.json   { id, titulo, productoId, lote, uuid, turnos, mensajes[], autorizado, fecha }
//   temp/_chat-imagenes/<id>/adjuntos/   las imágenes que adjuntaste (A0001.png…)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { TEMP, RAIZ } from '../rutas.js';
import { leerJSON, existe, listar } from '../archivos.js';
import { ErrorApp, leerProducto, leerFicha, rutaFoto, fotoPrincipal } from '../productos.js';
import { lanzarSesion, nombreIA } from '../motor-ia.js';
import { textoParaClaude } from '../aprendizajes.js';
import { costoDeImagenAds } from '../costo-estimado.js';
import { leerConductor, iniciarProduccion, reabrir, estadoDeLaFila } from '../conductor.js';
import * as funcionan from '../funcionan.js';
import { R, RE_V, idsDelLote, piezaId, guardarJSON, fotoDelLote, carpetaDe, MAXIMO_VARIACIONES } from './disco.js';
import { leerEstado } from './estado.js';
import { permisos, textoManualMayaverra, textoVenta, REGLAS_CONVERSION, DETALLE_VISUAL, DISENO_LIMPIO } from './sesiones.js';
import { textoReglasImagen } from './supervisor.js';
import { textoTitulosMayaverra } from './titulares.js';
import { textoCuerpo, textoMomentos } from './cuerpo.js';
import { verificarV } from './verificar.js';
import * as lotes from './lotes.js';
import { rutaPieza } from './piezas.js';

export const DIR = path.join(TEMP, '_chat-imagenes');
const RE_ID = /^[a-f0-9]{10}$/;
export const MAX_NUEVAS = 4;
const TOPE_MENSAJES = 300;
const FORMATOS = ['1:1', '9:16', '4:5'];
const pensando = new Map(); // id -> fecha de inicio (el chat en el que la IA está contestando)

const ahora = () => new Date().toISOString();
const limpio = (t, n = 4000) => String(t ?? '').replace(/\r/g, '').trim().slice(0, n);
const dirDe = (id) => {
  if (!RE_ID.test(String(id || ''))) throw new ErrorApp(404, 'No encuentro ese chat.');
  return path.join(DIR, id);
};
const rutaChat = (id) => path.join(dirDe(id), 'chat.json');
function leerChat(id) {
  const c = leerJSON(rutaChat(id));
  if (!c) throw new ErrorApp(404, 'No encuentro ese chat.');
  c.mensajes = Array.isArray(c.mensajes) ? c.mensajes : [];
  return c;
}
function guardarChat(c) {
  c.mensajes = c.mensajes.slice(-TOPE_MENSAJES);
  c.actualizado = ahora();
  guardarJSON(rutaChat(c.id), c);
}

// ---------------------------------------------------------------- la lista, crear, borrar

export function listarChats() {
  return listar(DIR)
    .filter((n) => RE_ID.test(n))
    .map((n) => leerJSON(path.join(DIR, n, 'chat.json')))
    .filter(Boolean)
    .sort((a, b) => String(b.actualizado || b.fecha).localeCompare(String(a.actualizado || a.fecha)))
    .map((c) => ({ id: c.id, titulo: c.titulo, productoId: c.productoId, producto: leerProducto(c.productoId)?.nombre || c.producto || '', lote: c.lote, fecha: c.fecha, actualizado: c.actualizado || c.fecha, ultimo: limpio(c.mensajes?.[c.mensajes.length - 1]?.texto, 120), imagenes: Number(lotes.leerBrief(carpetaDe(c.lote))?.cantidad) || 0, pensando: pensando.has(c.id) }));
}

/** El primer número de foto del producto que existe (1-8). */
function primeraFoto(productoId) {
  for (let n = 1; n <= 8; n++) if (rutaFoto(productoId, n)) return n;
  return null;
}

/** POST /api/chat-imagenes { productoId } -> el chat nuevo, con su lote (en la carpeta del producto). */
export function crearChat({ productoId } = {}) {
  const p = leerProducto(String(productoId || ''));
  if (!p) throw new ErrorApp(404, 'Elige el producto del chat.');
  const foto = primeraFoto(productoId);
  if (!foto) throw new ErrorApp(400, 'Este producto no tiene foto: súbela en Productos y vuelve.');
  const ajustes = leerJSON(path.join(TEMP, '_productos', productoId, 'anuncios-imagen.json')) || {};
  const r = lotes.crearLote({
    productoId,
    fotoProducto: foto,
    datos: { nombre: p.nombre || 'Producto', pais: ajustes.pais || p.pais || 'Colombia', idioma: 'es', publico: p.publico || '', precio: p.precio || '', moneda: p.moneda || '' },
    cantidad: 1,
    formatos: ['1:1'],
    modo: 'nuevos',
    logo: null,
  });
  const id = crypto.randomBytes(5).toString('hex');
  const carpeta = carpetaDe(r.lote);
  // el lote del chat: empieza sin imágenes (la cantidad sube con cada imagen que pidas)
  const brief = { ...r.brief, cantidad: 0, titulo: `Chat · ${p.nombre || 'producto'}`, chat: { id, aspectos: {} } };
  guardarJSON(R.brief(carpeta), brief);
  // la foto del producto, ya en el lote (la IA la mira desde el primer mensaje)
  if (!fotoDelLote(carpeta)) {
    const abs = rutaFoto(productoId, foto) || fotoPrincipal(productoId);
    const ext = path.extname(abs).toLowerCase().replace('.jpeg', '.jpg');
    fs.copyFileSync(abs, path.join(R.entrada(carpeta), `producto${ext}`));
  }
  const ficha = leerFicha(productoId);
  if (ficha && !existe(R.ficha(carpeta))) guardarJSON(R.ficha(carpeta), ficha);
  const c = { id, titulo: `Chat · ${p.nombre || 'producto'}`, productoId, producto: p.nombre || '', lote: r.lote, uuid: crypto.randomUUID(), turnos: 0, mensajes: [], autorizado: null, fecha: ahora() };
  fs.mkdirSync(path.join(dirDe(id), 'adjuntos'), { recursive: true });
  guardarChat(c);
  return vistaChat(id);
}

/** DELETE: borra la conversación; las imágenes siguen en la carpeta del producto (su lote). */
export function borrarChat(id) {
  if (pensando.has(id)) throw new ErrorApp(409, 'Espera a que termine de contestarte.');
  const c = leerChat(id);
  fs.rmSync(dirDe(id), { recursive: true, force: true });
  return { ok: true, lote: c.lote };
}

// ---------------------------------------------------------------- adjuntos

/** POST …/adjuntos: una imagen (bytes) o una de «Mis piezas» (?pieza=). -> { archivo: 'A0001.png', url } */
export function subirAdjunto(id, { datos = null, tipo = '', pieza = null } = {}) {
  const dir = path.join(dirDe(id), 'adjuntos');
  leerChat(id);
  fs.mkdirSync(dir, { recursive: true });
  let entrada = pieza ? rutaPieza(pieza) : null;
  if (pieza && !entrada) throw new ErrorApp(404, 'No encuentro esa pieza.');
  if (!entrada) {
    const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[String(tipo || '').split(';')[0].trim()];
    if (!ext) throw new ErrorApp(400, 'Adjunta una imagen PNG, JPG o WEBP.');
    if (!Buffer.isBuffer(datos) || datos.length < 100) throw new ErrorApp(400, 'La imagen llegó vacía.');
    if (datos.length > 15 * 1024 * 1024) throw new ErrorApp(413, 'La imagen pesa más de 15 MB.');
    entrada = path.join(dir, `.subida-${process.pid}-${Date.now()}.${ext}`);
    fs.writeFileSync(entrada, datos);
  }
  const n = Math.max(0, ...listar(dir).map((x) => Number(/^A(\d{4})\./.exec(x)?.[1]) || 0)) + 1;
  const png = /\.png$/i.test(entrada);
  const nombre = `A${String(n).padStart(4, '0')}.${png ? 'png' : 'jpg'}`;
  try {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', entrada, '-vf', "scale='min(2048,iw)':-2", ...(png ? [] : ['-q:v', '2']), path.join(dir, nombre)]);
  } catch {
    throw new ErrorApp(400, 'No pude abrir esa imagen. Guárdala como JPG o PNG y vuelve a adjuntarla.');
  } finally {
    if (!pieza) fs.rmSync(entrada, { force: true });
  }
  return { archivo: nombre, url: urlAdjunto(id, nombre) };
}
const urlAdjunto = (id, nombre) => `/archivos/chat-imagenes/${id}/${encodeURIComponent(nombre)}`;
export function rutaAdjunto(id, nombre) {
  if (!/^A\d{4}\.(png|jpg)$/.test(String(nombre || ''))) return null;
  const abs = path.join(dirDe(id), 'adjuntos', nombre);
  return existe(abs) ? abs : null;
}

// ---------------------------------------------------------------- el costo («genera directo»)

/** Lo que cuesta cada imagen y si este chat ya puede crear sin preguntar. */
export async function costoDelChat(c) {
  const precio = await costoDeImagenAds();
  const porImagen = precio?.conChatGPT ? 0 : Number(precio?.dolaresPorImagen);
  const conChatGPT = Boolean(precio?.conChatGPT);
  const sinPrecio = !conChatGPT && !(porImagen > 0);
  const autorizado = conChatGPT || (!sinPrecio && Number(c?.autorizado?.dolaresPorImagen) >= porImagen);
  return { conChatGPT, dolaresPorImagen: conChatGPT ? 0 : porImagen || null, autorizado, sinPrecio };
}

/** POST …/autorizar { dolaresPorImagen }: «Sí, crear directo» (una vez por chat; si el precio sube, se pregunta otra vez). */
export async function autorizar(id, { dolaresPorImagen } = {}) {
  const c = leerChat(id);
  const k = await costoDelChat(c);
  if (k.sinPrecio) throw new ErrorApp(503, 'No pude calcular el costo. Vuelve a intentarlo.');
  const n = Number(dolaresPorImagen);
  if (!k.conChatGPT && !(n >= k.dolaresPorImagen)) throw new ErrorApp(428, 'Confirma el costo por imagen. Si cambió el precio, recarga la pantalla.');
  c.autorizado = { dolaresPorImagen: k.conChatGPT ? 0 : n, fecha: ahora() };
  guardarChat(c);
  return vistaChat(id);
}

// ---------------------------------------------------------------- la vista

/** GET: los mensajes (con las imágenes de cada respuesta, de la vista del lote), si la IA está contestando y el costo. */
export async function vistaChatCompleta(id, vistaDelLote) {
  const c = leerChat(id);
  const carpeta = carpetaDe(c.lote);
  const brief = lotes.leerBrief(carpeta);
  const conductor = leerConductor(c.lote);
  const vista = brief && Number(brief.cantidad) > 0 ? vistaDelLote({ lote: c.lote, carpeta, brief, conductor, fila: null, modoPrueba: Boolean(conductor?.modoPrueba) }) : null;
  const porV = new Map((vista?.variaciones || []).map((x) => [x.v, x]));
  const costo = await costoDelChat(c);
  return {
    ...vistaChat(id),
    costo,
    lote: c.lote,
    conductor: conductor ? { estado: conductor.estado, paso: conductor.paso, error: conductor.error?.mensaje || null } : null,
    mensajes: c.mensajes.map((m) => ({
      ...m,
      adjuntos: (m.adjuntos || []).map((a) => ({ archivo: a, url: urlAdjunto(id, a) })),
      imagenes: (m.imagenes || []).map((v) => porV.get(v)).filter(Boolean),
    })),
  };
}
function vistaChat(id) {
  const c = leerChat(id);
  return { id: c.id, titulo: c.titulo, productoId: c.productoId, producto: leerProducto(c.productoId)?.nombre || c.producto || '', lote: c.lote, pensando: pensando.has(c.id), autorizado: c.autorizado || null };
}

// ---------------------------------------------------------------- el conocimiento

/** Todo lo que sabe la app de cómo quieres tus imágenes, para la primera vez de cada chat (y si se pierde la sesión). */
export function conocimiento(c, brief, carpeta) {
  const lote = c.lote;
  const p = leerProducto(c.productoId) || {};
  const ganadoras = funcionan.listar({ tipo: 'imagen' }).slice(0, 12);
  const partes = [
    `## El producto
- Nombre: ${brief?.datos?.nombre || p.nombre || ''}. País: ${brief?.datos?.pais || ''}.${brief?.datos?.publico ? ` Público: ${brief.datos.publico}.` : ''}
- Su foto (míralo con Read ANTES de escribir nada; el frasco o el envase sale IDÉNTICO, con la etiqueta legible): \`temp/${lote}/${fotoDelLote(carpeta) || 'entrada/producto.png'}\`.
${existe(R.ficha(carpeta)) ? `- Lo que la app ya sabe del producto: \`temp/${lote}/entrada/ficha-producto.json\`.\n` : ''}${brief?.investigacion ? `- Su investigación de mercado (deseos, dolores, palabras del cliente, ángulos): \`temp/${lote}/${brief.investigacion}\`. Úsala para los textos.\n` : ''}${brief?.ganchos ? `- Ganchos ya validados (TrendTrack): \`temp/${lote}/${brief.ganchos}\`.\n` : ''}${(brief?.validados || []).length ? `- Anuncios que YA LE FUNCIONAN al usuario (aprende de ellos el gancho, el tono y la estructura; no los copies salvo que lo pida): ${brief.validados.map((x) => `\`temp/${lote}/${x.archivo}\``).join(', ')}.\n` : ''}`,
    textoVenta(brief || {}),
    textoManualMayaverra(),
    textoTitulosMayaverra(brief || {}),
    textoCuerpo(brief || {}),
    textoMomentos(),
    REGLAS_CONVERSION,
    `\n${DETALLE_VISUAL}\n`,
    DISENO_LIMPIO,
    textoReglasImagen(),
    (() => {
      try {
        return textoParaClaude(null) || '';
      } catch {
        return '';
      }
    })(),
    ganadoras.length ? `\n## «Me funciona» (las imágenes que el usuario marcó como ganadoras; si las nombra, son estas)\n${ganadoras.map((x) => `- ${x.titulo || x.id}${x.producto ? ` (${x.producto})` : ''}${x.concepto ? `: ${x.concepto}` : ''}`).join('\n')}\n` : '',
  ];
  return partes.filter(Boolean).join('\n');
}

// ---------------------------------------------------------------- un turno

const relRespuesta = (n) => `app/chat/respuesta-${n}.json`;

function resumenImagenes(c, brief, carpeta) {
  const est = leerEstado(carpeta);
  const ids = idsDelLote(Number(brief?.cantidad) || 0);
  if (!ids.length) return '(todavía no hay imágenes en este chat)';
  return ids
    .map((v) => {
      const p = est?.piezas?.[piezaId(v, '1:1')];
      const ad = leerJSON(R.v(carpeta, v));
      const titular = (ad?.text_layers || [])[0]?.text || '';
      return `- ${v} (${p?.aspecto || brief.chat?.aspectos?.[v] || '1:1'}, versión ${p?.version || 0}${p?.fase && p.fase !== 'final' ? ', haciéndose' : ''}): «${limpio(titular, 90)}» · su anuncio \`temp/${c.lote}/${v}.json\` · su imagen \`temp/${c.lote}/img/${v}_1x1.png\``;
    })
    .join('\n');
}

/** (2026-11-27b) Un chat LIBRE: el tamaño y la cantidad solo si el usuario los eligió abajo. */
function textoPreferido(p) {
  const partes = [];
  if (p.formato) partes.push(`en ${p.formato}`);
  if (p.cantidad) partes.push(`${p.cantidad} ${p.cantidad === 1 ? 'imagen' : 'imágenes'}`);
  const elegido = partes.length ? `El usuario eligió abajo: ${partes.join(', ')}; respétalo salvo que el mensaje diga otra cosa. ` : '';
  const libre = [
    !p.cantidad ? 'Haz las que pida el mensaje (si no dice cuántas, una).' : '',
    !p.formato ? 'El tamaño: el que diga el mensaje; si no dice, el de la imagen que adjuntó (si es una referencia) o el que mejor sirva para lo que pide (1:1 para el feed, 9:16 para historias o reels, 4:5 para el feed vertical).' : '',
  ].filter(Boolean).join(' ');
  return `${elegido}${libre} Al CAMBIAR una imagen, se queda con su tamaño.`;
}

function textoTurno(c, brief, carpeta, { primera, mensaje, n, preferido }) {
  const lote = c.lote;
  const antes = Number(brief?.cantidad) || 0;
  const libres = idsDelLote(antes + MAX_NUEVAS).slice(antes);
  const adj = (mensaje.adjuntos || []).map((a) => `\`temp/_chat-imagenes/${c.id}/adjuntos/${a}\``);
  const charla = primera && c.mensajes.length > 1 ? c.mensajes.slice(-13, -1).map((m) => `${m.de === 'tu' ? 'USUARIO' : 'TÚ'}: ${limpio(m.texto, 600)}`).join('\n') : '';
  const cabeza = primera
    ? `TAREA: imagen-ads-chat
Carpeta del lote: temp/${lote}
Eres el CHAT DE IMÁGENES de esta app: un director creativo experto en anuncios de imagen de alto CTR para Facebook/Instagram/TikTok, que conversa en español simple y corto con el usuario (no es programador) y CREA las imágenes que pide para su producto. Conoces cómo las quiere (todo lo de abajo manda) y la forma de trabajar de la app (la skill \`.claude/skills/anuncios-imagen-ads/SKILL.md\`: léela entera la primera vez; tú haces solo su PASO 5, el JSON de cada imagen).
${conocimiento(c, brief, carpeta)}
`
    : `TAREA: imagen-ads-chat (sigue la misma conversación)\nCarpeta del lote: temp/${lote}\n(Con todo lo que ya sabes del producto y de cómo quiere sus imágenes.)\n`;
  return `${cabeza}
## Cómo trabajas en cada mensaje
- Si pide imágenes NUEVAS: créalas YA (el usuario eligió que el chat genere directo, sin preguntar). ${textoPreferido(preferido)} (Tamaños posibles: 1:1, 9:16 o 4:5; hasta ${MAX_NUEVAS} por mensaje.) Usa estos ids, en orden: ${libres.join(', ')}. Para cada una escribe \`temp/${lote}/<id>.json\` con el JSON del PASO 5 de la skill (global_identity, visual_prompt detallado por zonas, text_layers con todos los textos visibles letra por letra, mandatory_visual_elements, final_generation_exclusions, ad_info.variation_id = el id…). Cada una distinta (ningún titular repetido con las que ya hay).
- Si es un cambio CHICO sobre una imagen (borrar un texto, cambiar a la persona, un color, la tipografía, el tamaño de algo): NO leas la skill ni otros archivos y no analices: escribe directo la respuesta (una línea) con el cambio.
- Si pide CAMBIAR una que ya existe («cambia el fondo de V02», «la última más grande»): no escribas su JSON; anótalo en "cambios" con la instrucción en inglés para el editor de imagen (\`instruccion_en\`, corta y concreta: what to change and keep everything else identical) y \`textos: true\` si cambia algún texto.
- Si solo pregunta o conversa: contesta, sin crear nada.
- Si adjuntó imágenes, míralas con Read y úsalas como dice (pose, estilo, referencia de diseño…).
- Nunca inventes avales, sellos, registros, cifras, estrellas ni testimonios con nombre; nunca uses la marca, el frasco ni los textos de otra marca; nada de promesas médicas.

## Las imágenes de este chat
${resumenImagenes(c, brief, carpeta)}
${charla ? `\n## Lo último de la conversación\n${charla}\n` : ''}
${(mensaje.seleccion || []).length ? `## Las imágenes que eligió el usuario: ${mensaje.seleccion.join(', ')}\nAplica el pedido a CADA una (un cambio por imagen en "cambios", con su pieza V##_1x1), salvo que pida imágenes nuevas a partir de ellas.\n\n` : ''}## El mensaje del usuario
${limpio(mensaje.texto, 4000) || '(sin texto)'}${adj.length ? `\nAdjuntó: ${adj.join(', ')}` : ''}

Escribe \`temp/${lote}/${relRespuesta(n)}\` con EXACTAMENTE este JSON:
{ "respuesta": "lo que le dices, en español simple y corto (qué hiciste y por qué vende; máximo ~900 caracteres)", "nuevas": [{ "v": "${libres[0]}", "aspecto": "${preferido.formato || '1:1 | 9:16 | 4:5'}" }], "cambios": [{ "pieza": "V01_1x1", "instruccion_en": "…", "textos": false }] }
(Para CAMBIAR EL TAMAÑO de una imagen, su cambio lleva "aspecto": "9:16" | "4:5" | "1:1" y no necesita instruccion_en.)
("nuevas" y "cambios" pueden ir vacíos.) No escribas ningún otro archivo.`;
}

/** Revisa la respuesta del turno: el JSON, los anuncios de las nuevas y los cambios. */
function verificarTurno(c, carpeta, n) {
  const brief = lotes.leerBrief(carpeta);
  const d = leerJSON(path.join(carpeta, ...relRespuesta(n).split('/')));
  const errores = [];
  if (!d || typeof d.respuesta !== 'string' || !d.respuesta.trim()) return { ok: false, errores: [`Escribe temp/${c.lote}/${relRespuesta(n)} con { "respuesta": "…", "nuevas": [], "cambios": [] }.`] };
  const antes = Number(brief?.cantidad) || 0;
  const libres = idsDelLote(antes + MAX_NUEVAS).slice(antes);
  const nuevas = Array.isArray(d.nuevas) ? d.nuevas : [];
  if (nuevas.length > MAX_NUEVAS) errores.push(`nuevas: hasta ${MAX_NUEVAS} por mensaje`);
  nuevas.forEach((x, i) => {
    if (x?.v !== libres[i]) errores.push(`nuevas[${i}].v: tiene que ser "${libres[i]}" (en orden)`);
    if (!FORMATOS.includes(x?.aspecto)) errores.push(`nuevas[${i}].aspecto: 1:1, 9:16 o 4:5`);
    else if (RE_V.test(String(x?.v || ''))) errores.push(...verificarV(carpeta, x.v, { brief }).errores);
  });
  const est = leerEstado(carpeta);
  (Array.isArray(d.cambios) ? d.cambios : []).forEach((x, i) => {
    if (!est?.piezas?.[x?.pieza]) errores.push(`cambios[${i}].pieza: «${x?.pieza}» no está en este chat`);
    if (x?.aspecto !== undefined && !FORMATOS.includes(x.aspecto)) errores.push(`cambios[${i}].aspecto: 1:1, 9:16 o 4:5`);
    if (!x?.aspecto && !String(x?.instruccion_en || '').trim()) errores.push(`cambios[${i}].instruccion_en: falta la instrucción en inglés`);
  });
  return { ok: errores.length === 0, errores: errores.slice(0, 12) };
}

const enMarcha = (lote) => {
  const f = estadoDeLaFila();
  return f.activos.includes(lote) || f.fila.includes(lote);
};

/** Suma al lote las imágenes nuevas y los cambios, y lo pone a trabajar. -> { nuevas: ['V01'], cambios: n, avisos } */
function aplicarTurno(c, carpeta, d, mensajeUsuario) {
  const brief = lotes.leerBrief(carpeta);
  const nuevas = (Array.isArray(d.nuevas) ? d.nuevas : []).slice(0, MAX_NUEVAS);
  const avisos = [];
  if (nuevas.length) {
    const plan = leerJSON(R.plan(carpeta)) || { producto: brief.datos?.nombre || '', lote: c.lote, cantidad: 0, proporciones: ['1:1'], variaciones: [] };
    for (const x of nuevas) {
      const ad = leerJSON(R.v(carpeta, x.v)) || {};
      const titular = limpio((ad.text_layers || [])[0]?.text, 160) || 'Imagen del chat';
      plan.variaciones = (plan.variaciones || []).filter((y) => y?.id !== x.v);
      plan.variaciones.push({ id: x.v, fuente: 'chat', angulo_id: 'chat', angulo: 'Chat', concepto: limpio(mensajeUsuario, 300) || 'Pedido en el chat', titular, escena: limpio(ad.visual_prompt, 300) || 'Del chat', camara: 'La del anuncio' });
    }
    plan.variaciones.sort((a, b) => String(a.id).localeCompare(String(b.id), 'en', { numeric: true }));
    plan.cantidad = plan.variaciones.length;
    guardarJSON(R.plan(carpeta), plan);
    brief.cantidad = Math.min(MAXIMO_VARIACIONES, (Number(brief.cantidad) || 0) + nuevas.length);
    brief.chat = { ...(brief.chat || {}), aspectos: { ...(brief.chat?.aspectos || {}), ...Object.fromEntries(nuevas.map((x) => [x.v, x.aspecto])) } };
    guardarJSON(R.brief(carpeta), brief);
  }
  let cambios = 0;
  for (const x of Array.isArray(d.cambios) ? d.cambios : []) {
    try {
      // (2026-11-27c) cambiar el tamaño: versión nueva de la misma imagen en ese tamaño
      if (FORMATOS.includes(x.aspecto)) lotes.agregarTamano(c.lote, { pieza: x.pieza, formato: x.aspecto });
      else lotes.agregarPedido(c.lote, { pieza: x.pieza, instruccion: limpio(mensajeUsuario, 600) || 'Cambio pedido en el chat', instruccion_en: limpio(x.instruccion_en, 800), textos: x.textos === true });
      cambios++;
    } catch (e) {
      avisos.push(`${x.pieza}: ${e.message}`);
    }
  }
  if (nuevas.length || cambios) {
    try {
      if (!leerConductor(c.lote)) iniciarProduccion(c.lote);
      else if (!enMarcha(c.lote)) reabrir(c.lote, 'anuncios', { tambienPausado: true });
    } catch (e) {
      avisos.push(`No pude poner a trabajar el lote: ${e.message}`);
    }
  }
  return { nuevas: nuevas.map((x) => x.v), cambios, avisos };
}

async function responder(id, mensaje, preferido) {
  const c = leerChat(id);
  const carpeta = carpetaDe(c.lote);
  const n = (Number(c.turnos) || 0) + 1;
  const salida = path.join(carpeta, ...relRespuesta(n).split('/'));
  fs.rmSync(salida, { force: true });
  let texto = '';
  let imagenes = [];
  try {
    const brief = lotes.leerBrief(carpeta);
    const primera = !c.turnos;
    const libres = idsDelLote((Number(brief?.cantidad) || 0) + MAX_NUEVAS).slice(Number(brief?.cantidad) || 0);
    const escribe = [relRespuesta(n), ...libres.map((v) => `${v}.json`)];
    const per = permisos(c.lote, escribe, { conSkill: true });
    const base = {
      tipo: 'imagen-ads-chat',
      cwd: RAIZ,
      ...per,
      permitidas: [...per.permitidas, `Read(./temp/_chat-imagenes/${id}/adjuntos/**)`],
      registro: path.join(dirDe(id), 'registro.log'),
      timeoutMs: 20 * 60000,
      maxTurnos: 60,
      correcciones: 2,
      verificar: async () => verificarTurno(c, carpeta, n),
    };
    let r = await lanzarSesion({ ...base, uuid: c.uuid, resume: !primera, prompt: textoTurno(c, brief, carpeta, { primera, mensaje, n, preferido }) });
    // (la sesión de antes no se pudo retomar: una nueva, con todo el conocimiento y lo último de la charla)
    if (!r?.ok && !primera && !leerJSON(salida) && (r?.sinSesion || /resume|session|sesi/i.test(String(r?.error || '')))) {
      c.uuid = crypto.randomUUID();
      r = await lanzarSesion({ ...base, uuid: c.uuid, resume: false, prompt: textoTurno(c, brief, carpeta, { primera: true, mensaje, n, preferido }) });
    }
    const d = leerJSON(salida);
    if (d && verificarTurno(c, carpeta, n).ok) {
      const a = aplicarTurno(c, carpeta, d, mensaje.texto);
      imagenes = [...a.nuevas, ...(Array.isArray(d.cambios) ? d.cambios.map((x) => String(x.pieza || '').split('_')[0]).filter((v) => RE_V.test(v)) : [])];
      const k = await costoDelChat(leerChat(id));
      const cuantas = a.nuevas.length + a.cambios;
      texto = limpio(d.respuesta, 3000) + (cuantas && !k.conChatGPT && k.dolaresPorImagen ? `\n\n(${cuantas} ${cuantas === 1 ? 'imagen' : 'imágenes'} · ~US$ ${(cuantas * k.dolaresPorImagen).toFixed(2)})` : '') + (a.avisos.length ? `\n\n${a.avisos.join('\n')}` : '');
    } else {
      texto = r?.limite ? `Se acabó el uso de tu plan de ${nombreIA(r.motor)} por ahora. Escríbeme cuando se renueve.` : r?.sinMotor || r?.sinClaude ? 'Todavía no elegiste tu IA: ve a Ajustes › Conexiones y vuelve a escribirme.' : 'No pude terminar esta vez. ¿Me lo escribes de nuevo?';
    }
  } catch (e) {
    console.error('[chat-imagenes]', e);
    texto = 'Algo falló de mi lado. ¿Me lo escribes de nuevo?';
  } finally {
    const c2 = leerChat(id);
    c2.uuid = c.uuid;
    c2.turnos = n;
    c2.mensajes.push({ id: crypto.randomBytes(4).toString('hex'), de: 'chat', texto, imagenes: [...new Set(imagenes)], fecha: ahora() });
    guardarChat(c2);
    fs.rmSync(salida, { force: true });
    pensando.delete(id);
  }
}

/** POST …/mensajes { texto, adjuntos, formato, cantidad }: guarda tu mensaje y la IA contesta de fondo. */
export async function enviar(id, { texto = '', adjuntos = [], formato = null, cantidad = null, seleccion = [] } = {}) {
  const c = leerChat(id);
  const t = limpio(texto, 4000);
  const lista = (Array.isArray(adjuntos) ? adjuntos : []).map(String).filter((a) => rutaAdjunto(id, a)).slice(0, 6);
  // (2026-11-27c) las imágenes que elegiste para cambiarlas juntas
  const ids = idsDelLote(Number(lotes.leerBrief(carpetaDe(c.lote))?.cantidad) || 0);
  const elegidas = [...new Set((Array.isArray(seleccion) ? seleccion : []).map((v) => String(v).toUpperCase()))];
  if (elegidas.length > 12) throw new ErrorApp(400, 'Elige hasta 12 imágenes a la vez.');
  if (elegidas.some((v) => !ids.includes(v))) throw new ErrorApp(400, 'Una de las imágenes que elegiste no está en este chat.');
  if (elegidas.length && !t) throw new ErrorApp(400, '¿Qué les cambio? Escríbelo.');
  if (!t && !lista.length) throw new ErrorApp(400, 'Escribe tu mensaje.');
  if (pensando.has(id)) throw new ErrorApp(409, 'Todavía te estoy contestando. Espera un momento.');
  const k = await costoDelChat(c);
  if (k.sinPrecio) throw new ErrorApp(503, 'No pude calcular el costo de las imágenes. Vuelve a intentarlo.');
  if (!k.autorizado) throw new ErrorApp(428, 'Antes de crear, confirma el costo por imagen.');
  // (2026-11-27b) chat libre: sin tamaño ni cantidad salvo que los elijas
  const preferido = { formato: FORMATOS.includes(formato) ? formato : null, cantidad: Number(cantidad) >= 1 ? Math.min(MAX_NUEVAS, Math.round(Number(cantidad))) : null };
  const mensaje = { id: crypto.randomBytes(4).toString('hex'), de: 'tu', texto: t, adjuntos: lista, ...(elegidas.length ? { seleccion: elegidas } : {}), fecha: ahora() };
  c.mensajes.push(mensaje);
  if (c.mensajes.filter((m) => m.de === 'tu').length === 1 && t) c.titulo = `${limpio(t, 48)}${t.length > 48 ? '…' : ''}`;
  guardarChat(c);
  // (2026-11-27b) un cambio chico sobre una imagen: directo al editor de imagen, sin pasar por la IA (rápido)
  const atajo = cambioSimple(c, t, lista, elegidas);
  if (atajo) {
    const r = await hacerCambioSimple(c, atajo, t);
    if (r) return vistaChat(id);
  }
  pensando.set(id, ahora());
  responder(id, mensaje, preferido);
  return vistaChat(id);
}

export const chatPensando = (id) => pensando.has(id);

// ---------------------------------------------------------------- los cambios chicos, sin la IA (2026-11-27b)
// «Cuando sean cosas muy sencillas (borrar un texto, cambiar solamente una persona, el color de algo, la tipografía, el
// tamaño de algo) no debe darle mucho análisis y hacerlo lo más rápido y mejor posible»: el pedido va directo al modelo
// de imagen (que entiende el español), como una edición de la imagen de ahora que deja todo lo demás igual.
const RE_CAMBIO = /\b(borra|b[oó]rra(le|lo|la)|quita|qu[ií]ta(le|lo|la)|elimina|cambia|c[aá]mbia(le|lo|la)|pon|p[oó]n(le|lo|la)|reemplaza|mueve|agranda|achica|aumenta|reduce|corrige|arregla|m[aá]s grande|m[aá]s peque[nñ]|m[aá]s chic|color|tipograf|letra|fuente|persona|modelo|mujer|fondo|tama[nñ]o)/i;
const RE_NUEVAS = /\b(im[aá]genes|anuncios|hazme|haz\s+(otra|otras|\d|una|dos|tres|cuatro)|crea|cr[eé]ame|genera|gen[eé]rame|nuevas?|otra imagen|otras im[aá]genes|m[aá]s im[aá]genes|variante|versiones|como (esta|la)\b.*(pero|otra))/i;
const RE_TAMANO_IMAGEN = /\b(vertical|cuadrad|horizontal|retrato|9:16|4:5|1:1|historias|stories|reels?|formato)\b/i;

const RE_OTRO_CAMBIO = /\b(color|tipograf|letra|fuente|persona|modelo|mujer|fondo|texto|t[ií]tulo|titular|borra|quita|elimina|logo|precio|bot[oó]n)/i;
const formatoDelTexto = (t) => (/\b(9:16|vertical|historias?|stories|reels?)\b/i.test(t) ? '9:16' : /\b(4:5|retrato)\b/i.test(t) ? '4:5' : /\b(1:1|cuadrad[ao]s?)\b/i.test(t) ? '1:1' : null);
const listaDeVs = (vs) => (vs.length <= 1 ? vs.join('') : `${vs.slice(0, -1).join(', ')} y ${vs[vs.length - 1]}`);

/**
 * ¿Es un cambio chico sobre imágenes del chat? Las imágenes: las que ELEGISTE (2026-11-27c), o la que nombras, o
 * «la última». -> { tipo: 'editar' | 'tamano', formato?, vs: ['V01', …] } | null (entonces lo ve la IA)
 */
export function cambioSimple(c, texto, adjuntos = [], seleccion = []) {
  const t = String(texto || '').trim();
  if (!t || t.length > 220 || (adjuntos || []).length || RE_NUEVAS.test(t)) return null;
  // cambiar el TAMAÑO («pásalas a vertical», «en 4:5»): solo si el mensaje no pide otra cosa
  const formato = RE_TAMANO_IMAGEN.test(t) ? formatoDelTexto(t) : null;
  let tipo = null;
  if (formato && t.length <= 90 && !RE_OTRO_CAMBIO.test(t)) tipo = 'tamano';
  else if (!RE_TAMANO_IMAGEN.test(t) && RE_CAMBIO.test(t)) tipo = 'editar';
  if (!tipo) return null;
  const carpeta = carpetaDe(c.lote);
  const brief = lotes.leerBrief(carpeta);
  const ids = idsDelLote(Number(brief?.cantidad) || 0);
  if (!ids.length) return null;
  let vs = (seleccion || []).filter((v) => ids.includes(v));
  if (!vs.length) {
    const nombradas = [...new Set((t.match(/\bV\d{2,3}\b/gi) || []).map((x) => x.toUpperCase()))].filter((v) => ids.includes(v));
    if (nombradas.length) vs = nombradas;
    else if (/\b(la [uú]ltima|esta|esa|la anterior|la de arriba)\b/i.test(t)) {
      // la última imagen que salió en el chat
      let v = null;
      for (const m of [...c.mensajes].reverse()) if (m.de === 'chat' && (m.imagenes || []).length) { v = m.imagenes[m.imagenes.length - 1]; break; }
      vs = [v || ids[ids.length - 1]];
    }
  }
  if (!vs.length) return null;
  return { tipo, ...(tipo === 'tamano' ? { formato } : {}), vs };
}

/** Pide los cambios al instante (uno por imagen) y contesta. -> false si ninguno se pudo pedir (que lo vea la IA). */
async function hacerCambioSimple(c, atajo, texto) {
  const carpeta = carpetaDe(c.lote);
  const est = leerEstado(carpeta);
  const pedido = texto.replace(/^\s*cambia en V\d{2,3}\s*:\s*/i, '').trim() || texto;
  const hechas = [];
  const avisos = [];
  for (const v of atajo.vs) {
    const pieza = piezaId(v, '1:1');
    const p = est?.piezas?.[pieza];
    if (!p || p.fase !== 'final' || !existe(R.img(carpeta, pieza))) {
      avisos.push(`${v} todavía se está haciendo: pídemelo cuando termine.`);
      continue;
    }
    try {
      if (atajo.tipo === 'tamano') {
        if ((p.aspecto || p.formato || '1:1') === atajo.formato) {
          avisos.push(`${v} ya está en ${atajo.formato}.`);
          continue;
        }
        lotes.agregarTamano(c.lote, { pieza, formato: atajo.formato });
      } else {
        lotes.agregarPedido(c.lote, {
          pieza,
          instruccion: limpio(texto, 600),
          instruccion_en: `The user asked, in Spanish: «${limpio(pedido, 500)}». Apply ONLY this change to the image; keep everything else exactly identical (layout, all other texts, colors, people, product, lighting).`,
          textos: false,
        });
      }
      hechas.push(v);
    } catch (e) {
      avisos.push(`${v}: ${e.message}`);
    }
  }
  if (!hechas.length && !avisos.some((a) => /ya está en/.test(a))) return false;
  try {
    if (hechas.length && !leerConductor(c.lote)) iniciarProduccion(c.lote);
    else if (hechas.length && !enMarcha(c.lote)) reabrir(c.lote, 'anuncios', { tambienPausado: true });
  } catch (e) {
    avisos.push(`No pude poner a trabajar el lote: ${e.message}`);
  }
  const k = await costoDelChat(c);
  const n = hechas.length;
  const que = atajo.tipo === 'tamano' ? `la paso a ${atajo.formato} (la de antes queda en «Versiones anteriores»)` : limpio(pedido, 200);
  const c2 = leerChat(c.id);
  c2.mensajes.push({
    id: crypto.randomBytes(4).toString('hex'),
    de: 'chat',
    texto: `${n ? `Listo, lo hago en ${listaDeVs(hechas)}: ${que}.` : 'No hay nada que cambiar.'}${n && !k.conChatGPT && k.dolaresPorImagen ? `\n\n(${n} ${n === 1 ? 'imagen' : 'imágenes'} · ~US$ ${(n * k.dolaresPorImagen).toFixed(2)})` : ''}${avisos.length ? `\n\n${avisos.join('\n')}` : ''}`,
    imagenes: atajo.vs.filter((v) => hechas.includes(v) || avisos.some((a) => a.startsWith(`${v} ya está`))),
    rapido: true,
    fecha: ahora(),
  });
  guardarChat(c2);
  return true;
}

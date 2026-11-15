// INVESTIGACIÓN DE MERCADO de un producto (sección «Investigación de mercado», 2026-11-15). Se hace UNA vez por
// producto, solo con su foto: la IA sigue la skill .claude/skills/investigacion-mercado (busca en internet: es la única
// sesión de la app con WebSearch y WebFetch) y deja temp/_productos/<id>/investigacion/investigacion.json, que la
// pantalla muestra con gráficas. El usuario RESALTA lo que le importa (resaltados.json) y los lotes de «Anuncios de
// imagen» de ese producto la usan sola (aMarkdown -> entrada/investigacion.md del lote, con lo resaltado primero).
//
//   estado(id)                      -> { producto, tarea, investigacion, resaltados }
//   listar()                        -> [{ id, nombre, foto, estado, fecha, veredicto, pais }]
//   investigar(id, { pais })        lanza la sesión (no espera) -> { tarea }
//   guardarResaltados(id, lista)    -> lista limpia
//   resumenDe(id)                   -> { fecha, pais } | null   (para saber si un producto ya la tiene)
//   aMarkdown(id)                   -> el texto que lee la estrategia de un lote, o null
//
// Solo con Claude: la sesión de ChatGPT de la app trabaja sin internet.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { esDeEstaApp } from './rutas.js';
import { leerJSON, existe, listar as listarDir } from './archivos.js';
import { sesionActiva, prohibidasComunes, textoClaude, leerYValidar } from './claude.js';
import { lanzarSesion } from './colas.js';
import { motorElegido, nombreIA } from './motor-ia.js';
import { PRODUCTOS, ErrorApp, escribirJSON, idValido, leerProducto, leerFicha, relProducto, urlFoto, errorPublico } from './productos.js';

export const SKILL = 'investigacion-mercado';
const dir = (id) => path.join(PRODUCTOS, id, 'investigacion');
const rutaInv = (id) => path.join(dir(id), 'investigacion.json');
const rutaTarea = (id) => path.join(dir(id), 'tarea.json');
const rutaResaltados = (id) => path.join(dir(id), 'resaltados.json');
const ahora = () => new Date().toISOString();
const leerTarea = (id) => leerJSON(rutaTarea(id));
const guardarTarea = (id, t) => escribirJSON(rutaTarea(id), { ...t, actualizado: ahora() });
const enMarcha = new Map();

const numeroDeFoto = (f) => Number(String(f).match(/(\d+)\./)?.[1]);

function leerInvestigacion(id) {
  const v = existe(rutaInv(id)) ? leerYValidar(rutaInv(id), 'investigacion-mercado') : null;
  return v?.ok ? v.datos : null;
}

export function resumenDe(id) {
  if (!idValido(id) || !existe(rutaInv(id))) return null;
  const t = leerTarea(id);
  if (t?.estado === 'investigando') return null;
  const inv = leerInvestigacion(id);
  return inv ? { fecha: t?.fin || null, pais: inv.pais || null } : null;
}

const vistaDeTarea = (t) =>
  t
    ? { estado: t.estado, progreso: (t.progreso || []).slice(-12), error: t.error || null, limite: Boolean(t.limite), reinicio: t.reinicio || null, inicio: t.inicio || null, fin: t.fin || null, pais: t.pais || null }
    : { estado: 'sin', progreso: [], error: null };

export function estado(id) {
  const p = leerProducto(id);
  if (!p) return null;
  const t = leerTarea(id);
  const fotos = (p.fotos || []).map(numeroDeFoto).filter(Number.isInteger);
  return {
    producto: { id, nombre: leerFicha(id)?.nombre || p.nombre || 'Producto sin nombre', foto: fotos.length ? urlFoto(id, fotos[0]) : null },
    tarea: vistaDeTarea(t),
    investigacion: t?.estado === 'investigando' ? null : leerInvestigacion(id),
    resaltados: leerResaltados(id),
  };
}

export function listar() {
  const salida = [];
  for (const id of listarDir(PRODUCTOS)) {
    if (!idValido(id)) continue;
    const p = leerProducto(id);
    if (!p || !esDeEstaApp(p)) continue;
    const fotos = (p.fotos || []).map(numeroDeFoto).filter(Number.isInteger);
    if (!fotos.length) continue;
    const t = leerTarea(id);
    const inv = t?.estado === 'investigando' ? null : leerInvestigacion(id);
    salida.push({
      id,
      nombre: leerFicha(id)?.nombre || p.nombre || 'Producto sin nombre',
      foto: urlFoto(id, fotos[0]),
      estado: t?.estado === 'investigando' ? 'investigando' : inv ? 'lista' : t?.estado === 'error' ? 'error' : 'sin',
      fecha: inv ? t?.fin || null : null,
      veredicto: inv?.veredicto?.viable || null,
      pais: inv?.pais || t?.pais || null,
      resaltados: inv ? leerResaltados(id).length : 0,
      creado: p.creado || null,
    });
  }
  return salida.sort((a, b) => String(b.fecha || b.creado || '').localeCompare(String(a.fecha || a.creado || '')));
}

// ---------------------------------------------------------------- la sesión

function armarSesion(id, { pais, retomar }) {
  const p = leerProducto(id);
  const rel = relProducto(id);
  const archivo = `${rel}/investigacion/investigacion.json`;
  const ficha = leerFicha(id);
  const datos = { nombre: ficha?.nombre || p.nombre || '', que_es: ficha?.queEs || p.descripcion || '', pagina: p.url || '', oferta: ficha?.oferta || '' };
  const fotos = (p.fotos || []).slice(0, 4).map((f, i) => `  - ${rel}/${f}${i === 0 ? ' (la principal)' : ''}`).join('\n');
  const prompt = textoClaude('tarea-investigacion-mercado', {
    carpeta: rel,
    fotos,
    datos: JSON.stringify(datos, null, 2),
    pais: pais ? `investigación general MÁS la capa local de ${pais} (Paso 3B). En el JSON, "pais": "${pais}".` : 'investigación GENERAL (sin capa local). En el JSON, "pais": null.',
    archivo,
  });
  // como las demás sesiones (sin terminal, sin leer el .env ni el motor), pero CON internet: lo pide la skill
  const prohibidas = prohibidasComunes({ terminal: false }).filter((x) => x !== 'WebFetch' && x !== 'WebSearch');
  return {
    tipo: 'ficha',
    resume: retomar,
    prompt: retomar ? `${prompt}\n\n(La app se cerró mientras trabajabas: mira lo que ya escribiste y termina.)` : prompt,
    herramientas: ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'WebSearch', 'WebFetch'],
    permitidas: [`Read(./${rel}/**)`, `Read(./.claude/skills/${SKILL}/**)`, 'Glob', 'Grep', 'WebSearch', 'WebFetch', `Write(./${archivo})`, `Edit(./${archivo})`],
    prohibidas,
    fraseInicio: `${nombreIA()} está investigando tu mercado`,
    timeoutMs: 75 * 60000,
    silencioMs: 12 * 60000,
    maxTurnos: 220,
    correcciones: 2,
    verificar: async () => {
      const v = leerYValidar(rutaInv(id), 'investigacion-mercado');
      return v.ok ? { ok: true } : { ok: false, errores: v.errores.slice(0, 12) };
    },
  };
}

/** POST /api/investigacion/:id: lanza la investigación (no espera). */
export function investigar(id, { pais = null, retomar = false } = {}) {
  const p = leerProducto(id);
  if (!p) throw new ErrorApp(404, 'No encuentro ese producto.');
  if (!(p.fotos || []).length) throw new ErrorApp(400, 'Sube la foto del producto para investigarlo.');
  if (motorElegido() !== 'claude') throw new ErrorApp(409, 'La investigación de mercado busca en internet y por ahora solo funciona con Claude. Elige Claude en Ajustes › Conexiones.');
  const previa = leerTarea(id);
  if (enMarcha.has(id) || (previa?.estado === 'investigando' && previa?.uuid && sesionActiva(previa.uuid))) return { tarea: previa?.id || null, yaEstaba: true };
  const paisLimpio = String(pais || '').replace(/[^\p{L} .-]/gu, '').trim().slice(0, 60) || null;
  const uuid = retomar && previa?.uuid ? previa.uuid : crypto.randomUUID();
  const tarea = { id: uuid, uuid, estado: 'investigando', pais: retomar ? previa?.pais || paisLimpio : paisLimpio, progreso: [], intentos: (previa?.intentos || 0) + 1, inicio: ahora(), error: null };
  fs.mkdirSync(path.join(dir(id), 'registro'), { recursive: true });
  guardarTarea(id, tarea);
  const promesa = correr(id, tarea, { retomar })
    .catch((e) => {
      console.error('[investigacion]', e);
      guardarTarea(id, { ...tarea, estado: 'error', fin: ahora(), error: { mensaje: 'Algo salió mal al investigar. Toca «Reintentar».', tipo: 'otro', detalle: String(e.message || e).slice(0, 400) } });
    })
    .finally(() => enMarcha.delete(id));
  enMarcha.set(id, promesa);
  return { tarea: tarea.id };
}

async function correr(id, tarea, { retomar }) {
  const avanzar = (f) => {
    if (!f) return;
    if (tarea.progreso[tarea.progreso.length - 1] !== f) tarea.progreso.push(f);
    tarea.progreso = tarea.progreso.slice(-30);
    guardarTarea(id, tarea);
  };
  // la anterior queda de respaldo hasta que la nueva salga bien
  const anterior = path.join(dir(id), 'investigacion-anterior.json');
  if (!retomar && existe(rutaInv(id))) fs.renameSync(rutaInv(id), anterior);
  const r = await lanzarSesion({ ...armarSesion(id, { pais: tarea.pais, retomar }), uuid: tarea.uuid, alProgreso: avanzar, registro: path.join(dir(id), 'registro', 'investigacion.log') });
  const fin = { ...tarea, fin: ahora(), medida: { turnos: r.turnos, duracionMs: r.duracionMs, motor: r.motor || null } };
  if (r.ok && leerInvestigacion(id)) {
    fs.rmSync(anterior, { force: true });
    guardarTarea(id, { ...fin, estado: 'lista', error: null });
    return;
  }
  if (existe(rutaInv(id)) && !leerInvestigacion(id)) fs.renameSync(rutaInv(id), path.join(dir(id), 'investigacion-incompleta.json'));
  if (!existe(rutaInv(id)) && existe(anterior)) fs.renameSync(anterior, rutaInv(id));
  guardarTarea(id, { ...fin, estado: 'error', error: errorPublico(r), limite: Boolean(r.limite), reinicio: r.reinicio || null });
}

/** Al arrancar la app: una investigación que quedó a medias (la app se cerró) se marca para reintentar. */
export function cerrarLasCortadas() {
  for (const id of listarDir(PRODUCTOS)) {
    const t = leerTarea(id);
    if (t?.estado === 'investigando' && !enMarcha.has(id) && !(t.uuid && sesionActiva(t.uuid))) {
      guardarTarea(id, { ...t, estado: 'error', fin: ahora(), error: { mensaje: 'La app se cerró mientras investigaba. Toca «Reintentar».', tipo: 'cortada' } });
    }
  }
}

// ---------------------------------------------------------------- lo que resaltó el usuario

function leerResaltados(id) {
  const l = leerJSON(rutaResaltados(id));
  return Array.isArray(l) ? l.filter((x) => x && typeof x.texto === 'string') : [];
}

export function guardarResaltados(id, lista) {
  if (!leerProducto(id)) throw new ErrorApp(404, 'No encuentro ese producto.');
  const vistos = new Set();
  const limpia = (Array.isArray(lista) ? lista : [])
    .map((x) => ({
      id: /^[a-z0-9]{4,16}$/.test(String(x?.id || '')) ? x.id : crypto.randomBytes(4).toString('hex'),
      texto: String(x?.texto || '').replace(/\s+/g, ' ').trim().slice(0, 600),
      seccion: String(x?.seccion || '').slice(0, 60),
      nota: String(x?.nota || '').replace(/\s+/g, ' ').trim().slice(0, 300),
    }))
    .filter((x) => x.texto.length >= 2 && !vistos.has(x.texto) && vistos.add(x.texto))
    .slice(0, 80);
  fs.mkdirSync(dir(id), { recursive: true });
  escribirJSON(rutaResaltados(id), limpia);
  return limpia;
}

// ---------------------------------------------------------------- para los lotes de anuncios de imagen

const lista = (titulo, items) => (items?.length ? `\n## ${titulo}\n${items.map((x) => `- ${x}`).join('\n')}\n` : '');
const txt = (x) => (typeof x === 'string' ? x.trim() : '');

/** La investigación como texto para la estrategia de un lote (lo resaltado por el usuario va primero y manda). */
export function aMarkdown(id) {
  const inv = idValido(id) ? leerInvestigacion(id) : null;
  if (!inv) return null;
  const res = leerResaltados(id);
  const a = inv.avatar || {};
  const e = inv.estrategia || {};
  const partes = [
    `# Investigación de mercado: ${inv.producto}${inv.pais ? ` (${inv.pais})` : ''}`,
    res.length ? `\n## LO QUE EL USUARIO RESALTÓ (tenlo en cuenta primero: es lo que más le importa)\n${res.map((r) => `- ${r.texto}${r.nota ? ` — nota del usuario: ${r.nota}` : ''}`).join('\n')}\n` : '',
    `\n## Deseo central\n${txt(inv.deseo_central?.frase)}\n${Object.entries(inv.deseo_central?.capas || {}).filter(([, v]) => txt(v)).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n`,
    `\n## Beneficio principal\n${txt(inv.beneficio_principal)}\n`,
    lista('Puntos de dolor (del más fuerte al menos; intensidad de 1 a 10)', (inv.puntos_dolor || []).map((d) => `${d.dolor} (${d.intensidad}/10)${txt(d.sentimiento) ? ` — siente: ${d.sentimiento}` : ''}${txt(d.solucion_que_piden) ? ` — pide: ${d.solucion_que_piden}` : ''}`)),
    lista('Cómo lo dice el cliente (patrón → ángulo)', (inv.lenguaje || []).map((l) => `${txt(l.patron)} → ${txt(l.angulo)}`)),
    `\n## Avatar\n${[txt(a.nombre), txt(a.edad), txt(a.ocupacion), txt(a.ciudad)].filter(Boolean).join(', ')}\n${txt(a.dolor_masivo) ? `Dolor que no lo deja dormir: ${a.dolor_masivo}\n` : ''}${txt(a.resultado_deseado) ? `Resultado deseado: ${a.resultado_deseado}\n` : ''}`,
    lista('Qué lo hace comprar o dudar', a.puntos_debiles),
    lista('Beneficios en orden de peso', (inv.impulso?.beneficios || []).map((b) => `${txt(b.beneficio)} (${b.peso}/10)`)),
    lista('Resultados deseados', inv.impulso?.resultados_deseados),
    e.posicionamiento ? `\n## Posicionamiento\n${Object.entries(e.posicionamiento).filter(([, v]) => txt(v)).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n` : '',
    txt(e.oferta) ? `\n## Oferta\n${e.oferta}\n` : '',
    lista('Ángulos creativos recomendados', (e.angulos || []).map((x) => `${txt(x.nombre)}: ${txt(x.idea)} (${x.fuerza}/10)`)),
    lista('Objeciones', (e.objeciones || []).map((o) => `${txt(o.objecion)} → ${txt(o.respuesta)}`)),
    lista('Cumplimiento (lo que NO se puede decir)', e.cumplimiento),
    lista('Títulos propuestos para imágenes', (inv.titulos || []).map((t) => `${t.probar_primero ? '[probar primero] ' : ''}${t.titulo}${txt(t.apoyo) ? ` — ${t.apoyo}` : ''}`)),
    lista('Alertas', inv.alertas),
  ];
  return partes.filter(Boolean).join('').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

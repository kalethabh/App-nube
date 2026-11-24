// INVESTIGACIÓN COMPETITIVA CON TRENDTRACK de un producto (2026-11-16; en la pantalla va debajo del PDF de la
// investigación de mercado). La IA sigue la skill .claude/skills/investigacion-trendtrack y hace sus 6 etapas DE UNA
// VEZ (investigación maestra, ganadores, base de hooks, saturación de ángulos, avatares y validación en el país), con
// el conector de TrendTrack que el usuario tiene en su cuenta de Claude (como «Mejores anuncios»: la app no guarda
// ninguna clave). Deja temp/_productos/<id>/competencia/competencia.json, en bloques que la pantalla dibuja.
//
//   estado(id)                         -> { tarea, competencia }
//   investigar(id, { enlace, producto, pais, brandtracker })   lanza la sesión (no espera) -> { tarea }
//   aMarkdown(id)                      -> lo esencial para la estrategia de un lote (oportunidades y veredicto), o ''
//
// Gasta créditos de TrendTrack del usuario (una investigación completa: de 450 a 650). Solo con Claude.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { leerJSON, existe, listar as listarDir } from './archivos.js';
import { sesionActiva, prohibidasComunes, textoClaude, leerYValidar } from './claude.js';
import { lanzarSesion } from './colas.js';
import { motorElegido, nombreIA } from './motor-ia.js';
import { PRODUCTOS, ErrorApp, escribirJSON, leerProducto, leerFicha, relProducto, errorPublico } from './productos.js';

export const SKILL = 'investigacion-trendtrack';
import { TT, ttTodas } from './trendtrack-conector.js'; // (el nombre del conector, en todas sus formas)
// solo lectura; agregar al brandtracker (gasta créditos) va aparte, si el usuario lo permitió
const HERRAMIENTAS_TT = ['check_credits', 'brief_competitor', 'list_tracked_brands', 'get_brandtracker_transcripts', 'search_ads', 'scan_ad', 'find_similar_shops', 'search_shops', 'lookup', 'lookup_filter_ids', 'get_landing_page', 'search_landing_pages', 'get_product', 'get_product_ads', 'search_products', 'search_advertisers'].flatMap(ttTodas);
const TIPOS = ['subtitulo', 'parrafo', 'vinetas', 'metricas', 'barras', 'escala', 'tabla', 'anuncios', 'hooks', 'avatares', 'caja', 'plan'];

const dir = (id) => path.join(PRODUCTOS, id, 'competencia');
const rutaDatos = (id) => path.join(dir(id), 'competencia.json');
const rutaTarea = (id) => path.join(dir(id), 'tarea.json');
const ahora = () => new Date().toISOString();
const leerTarea = (id) => leerJSON(rutaTarea(id));
const guardarTarea = (id, t) => escribirJSON(rutaTarea(id), { ...t, actualizado: ahora() });
const enMarcha = new Map();

function validar(id) {
  const v = leerYValidar(rutaDatos(id), 'investigacion-trendtrack');
  if (!v.ok) return v;
  const errores = [];
  v.datos.etapas.forEach((e, i) =>
    (e.bloques || []).forEach((b, k) => {
      const donde = `etapas[${i}].bloques[${k}]`;
      if (!TIPOS.includes(b?.tipo)) errores.push(`${donde}.tipo: "${b?.tipo}" no existe (valen ${TIPOS.join(', ')})`);
      if (['metricas', 'barras', 'escala', 'anuncios', 'hooks', 'avatares', 'vinetas', 'plan'].includes(b?.tipo) && !(Array.isArray(b.items) && b.items.length)) errores.push(`${donde}.items: falta la lista`);
      if (b?.tipo === 'barras' && Array.isArray(b.items) && !b.items.every((x) => Number.isFinite(Number(x?.valor)))) errores.push(`${donde}: cada barra lleva "valor" en número`);
      if (b?.tipo === 'tabla' && !(Array.isArray(b.columnas) && Array.isArray(b.filas) && b.filas.every((f) => Array.isArray(f) && f.length === b.columnas.length))) errores.push(`${donde}: cada fila de la tabla lleva una celda por columna`);
    })
  );
  return errores.length ? { ok: false, errores: errores.slice(0, 15) } : v;
}

function leer(id) {
  const v = existe(rutaDatos(id)) ? validar(id) : null;
  return v?.ok ? v.datos : null;
}

/** Lo que quedó de una investigación que no terminó (las etapas que alcanzó a escribir), para no perder lo pagado. */
function leerParcial(id) {
  const d = leerJSON(path.join(dir(id), 'competencia-incompleta.json'));
  if (!d || !Array.isArray(d.etapas)) return null;
  const etapas = d.etapas.filter((e) => e && typeof e.titulo === 'string' && Array.isArray(e.bloques) && e.bloques.length).map((e) => ({ ...e, bloques: e.bloques.filter((b) => TIPOS.includes(b?.tipo)) }));
  return etapas.length ? { ...d, etapas, incompleta: true } : null;
}

export function estado(id) {
  if (!leerProducto(id)) return null;
  const t = leerTarea(id);
  return {
    tarea: t
      ? { estado: t.estado, progreso: (t.progreso || []).slice(-10), error: t.error || null, inicio: t.inicio || null, fin: t.fin || null, enlace: t.enlace || '', producto: t.producto || '', pais: t.pais || '', brandtracker: Boolean(t.brandtracker) }
      : { estado: 'sin', progreso: [], error: null },
    competencia: t?.estado === 'investigando' ? null : leer(id) || leerParcial(id),
  };
}

function armarSesion(id, t, { retomar }) {
  const rel = relProducto(id);
  const archivo = `${rel}/competencia/competencia.json`;
  const p = leerProducto(id);
  const ficha = leerFicha(id);
  const inv = leerJSON(path.join(PRODUCTOS, id, 'investigacion', 'investigacion.json'));
  const mio = ficha?.nombre || p?.nombre || inv?.producto || '';
  const prompt = textoClaude('tarea-investigacion-trendtrack', {
    carpeta: rel,
    enlace: t.buscar && !t.enlace
      ? `NINGUNA: búscala tú. Con search_products y search_shops de TrendTrack (y find_similar_shops si ayuda), busca la tienda que MÁS vende un producto como «${mio || 'el del usuario'}» (misma categoría y promesa: mira la foto y la investigación de mercado de la carpeta) en ${t.pais} o, si allí no hay, en Estados Unidos; elige la de más ventas o más anuncios activos, di en "advertencias" cuál elegiste y por qué, y sigue con las 6 etapas sobre esa tienda.`
      : t.enlace,
    producto: t.producto || 'no se indicó: investiga la marca entera (o su producto principal).',
    pais: t.pais,
    fecha: new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }).format(new Date()),
    brandtracker: t.brandtracker
      ? 'si la marca no está en el brandtracker, PUEDES agregarla con add_to_brandtracker (el usuario ya dio permiso; gasta créditos).'
      : 'NO puedes agregar la marca al brandtracker. Si no está, sigue sin transcripciones y dilo en las advertencias.',
    contexto: mio ? `- Quien investiga vende «${mio}» en ${t.pais}: es contexto para la etapa 6, no un filtro (no descartes hallazgos por encaje).` : '',
    archivo,
  });
  const prohibidas = prohibidasComunes({ terminal: false }).filter((x) => x !== 'WebFetch' && x !== 'WebSearch');
  return {
    tipo: 'ficha',
    resume: retomar,
    prompt: retomar ? `${prompt}\n\n(La app se cerró o el intento anterior no terminó: lee lo que ya escribiste en el archivo y sigue desde la etapa que falta, sin repetir búsquedas ya hechas.)` : prompt,
    conectores: true,
    permitidas: ['ToolSearch', ...HERRAMIENTAS_TT, ...(t.brandtracker ? ttTodas('add_to_brandtracker') : []), `Read(./${rel}/**)`, `Read(./.claude/skills/${SKILL}/**)`, 'Glob', 'Grep', 'WebSearch', 'WebFetch', `Write(./${archivo})`, `Edit(./${archivo})`],
    prohibidas,
    entorno: { MAX_MCP_OUTPUT_TOKENS: '80000' },
    fraseInicio: `${nombreIA()} está investigando a tu competencia en TrendTrack`,
    timeoutMs: 150 * 60000,
    silencioMs: 15 * 60000,
    maxTurnos: 400,
    correcciones: 3,
    verificar: async () => {
      const v = validar(id);
      return v.ok ? { ok: true } : { ok: false, errores: v.errores.slice(0, 15) };
    },
  };
}

/**
 * Los ganchos validados de la investigación con TrendTrack (etapa «Base de hooks»), para jugar con ellos en los títulos
 * de los anuncios de imagen: [{ id: 'G1', gancho (el mejorado, en español), original, categoria, avatar, gatillo,
 * saturacion, evidencia }], primero los menos saturados. [] si el producto no tiene esa investigación.
 */
export function ganchosValidados(id, max = 30) {
  const c = leer(id);
  if (!c) return [];
  const t = (x, n = 400) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, n) : '');
  const orden = { baja: 0, media: 1, alta: 2 };
  const items = c.etapas.flatMap((e) => (e.bloques || []).filter((b) => b?.tipo === 'hooks').flatMap((b) => b.items || []));
  const vistos = new Set();
  return items
    .map((h) => ({ gancho: t(h?.mejorado) || t(h?.traduccion), original: t(h?.texto), categoria: t(h?.categoria, 60), avatar: t(h?.avatar, 120), gatillo: t(h?.gatillo, 80), saturacion: t(h?.saturacion, 20).toLowerCase(), evidencia: t(h?.evidencia, 200) }))
    .filter((h) => h.gancho && !vistos.has(h.gancho.toLowerCase()) && vistos.add(h.gancho.toLowerCase()))
    .sort((a, b) => (orden[a.saturacion] ?? 1) - (orden[b.saturacion] ?? 1))
    .slice(0, max)
    .map((h, i) => ({ id: `G${i + 1}`, ...h }));
}

/** POST /api/investigacion/:id/competencia: lanza las 6 etapas (no espera). */
export function investigar(id, { enlace = '', producto = '', pais = '', brandtracker = false, retomar = false, buscar = false } = {}) {
  if (!leerProducto(id)) throw new ErrorApp(404, 'No encuentro ese producto.');
  if (motorElegido() !== 'claude') throw new ErrorApp(409, 'La investigación con TrendTrack usa el conector de tu cuenta de Claude. Elige Claude en Ajustes › Conexiones.');
  const previa = leerTarea(id);
  if (enMarcha.has(id) || (previa?.estado === 'investigando' && previa?.uuid && sesionActiva(previa.uuid))) return { tarea: previa?.id || null, yaEstaba: true };
  const limpio = (x, n) => String(x || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  const t0 = retomar && previa ? previa : null;
  const datos = { enlace: t0?.enlace || limpio(enlace, 400), producto: t0?.producto ?? limpio(producto, 200), pais: t0?.pais || limpio(pais, 60) || 'Colombia', brandtracker: t0 ? Boolean(t0.brandtracker) : Boolean(brandtracker) };
  // (2026-11-19o) sin marca, con `buscar`: la IA busca en TrendTrack la tienda que más vende algo como tu producto
  if (datos.enlace.length < 3 && !buscar && !t0?.buscar) throw new ErrorApp(400, 'Pega el link de TrendTrack de la marca que quieres investigar (o su dominio).');
  if (datos.enlace.length < 3) datos.buscar = true;
  const uuid = t0?.uuid || crypto.randomUUID();
  const tarea = { id: uuid, uuid, estado: 'investigando', ...datos, progreso: [], intentos: (previa?.intentos || 0) + 1, inicio: ahora(), error: null };
  fs.mkdirSync(path.join(dir(id), 'registro'), { recursive: true });
  guardarTarea(id, tarea);
  const promesa = correr(id, tarea, { retomar: Boolean(t0) })
    .catch((e) => {
      console.error('[competencia]', e);
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
  const anterior = path.join(dir(id), 'competencia-anterior.json');
  const incompleta = path.join(dir(id), 'competencia-incompleta.json');
  if (retomar && !existe(rutaDatos(id)) && existe(incompleta)) fs.renameSync(incompleta, rutaDatos(id));
  else if (!retomar && existe(rutaDatos(id))) fs.renameSync(rutaDatos(id), anterior);
  const r = await lanzarSesion({ ...armarSesion(id, tarea, { retomar }), uuid: tarea.uuid, alProgreso: avanzar, registro: path.join(dir(id), 'registro', 'competencia.log') });
  const fin = { ...tarea, fin: ahora(), medida: { turnos: r.turnos, duracionMs: r.duracionMs, motor: r.motor || null } };
  if (r.ok && leer(id)) {
    fs.rmSync(anterior, { force: true });
    fs.rmSync(incompleta, { force: true });
    guardarTarea(id, { ...fin, estado: 'lista', error: null });
    return;
  }
  // lo que alcanzó a escribir se guarda aparte (ya se pagó en créditos): se muestra y «Reintentar» sigue desde ahí
  if (existe(rutaDatos(id)) && !leer(id)) fs.renameSync(rutaDatos(id), incompleta);
  if (!existe(rutaDatos(id)) && existe(anterior)) fs.renameSync(anterior, rutaDatos(id));
  const e = errorPublico(r);
  const sinConector = /TrendTrack/i.test(String(r.error || r.detalle || '')) && /no (aparece|encontr)|not found|no existe/i.test(String(r.error || r.detalle || ''));
  guardarTarea(id, { ...fin, estado: 'error', error: sinConector ? { ...e, mensaje: 'No encontré TrendTrack en tu cuenta de Claude. Revisa en claude.ai → Ajustes → Conectores que esté conectado y vuelve a intentar.' } : e, limite: Boolean(r.limite) });
}

/** Al arrancar la app: una investigación que quedó a medias (la app se cerró) se marca para reintentar. */
export function cerrarLasCortadas() {
  for (const id of listarDir(PRODUCTOS)) {
    const t = leerTarea(id);
    if (t?.estado === 'investigando' && !enMarcha.has(id) && !(t.uuid && sesionActiva(t.uuid))) {
      if (existe(rutaDatos(id)) && !leer(id)) fs.renameSync(rutaDatos(id), path.join(dir(id), 'competencia-incompleta.json'));
      guardarTarea(id, { ...t, estado: 'error', fin: ahora(), error: { mensaje: 'La app se cerró mientras investigaba. Toca «Reintentar»: sigue desde donde quedó.', tipo: 'cortada' } });
    }
  }
}

const t = (x) => String(x ?? '').replace(/\*\*/g, '').trim();

/** Lo esencial de la competencia para la estrategia de un lote: lo clave, las oportunidades y el veredicto del país. */
export function aMarkdown(id) {
  const c = leer(id);
  if (!c) return '';
  const lineas = [`\n## Competencia (TrendTrack): ${t(c.marca)}${c.producto ? ` · ${t(c.producto)}` : ''}`];
  for (const e of c.etapas) {
    const cajas = (e.bloques || []).filter((b) => b?.tipo === 'caja' && ['oportunidad', 'clave', 'veredicto', 'hipotesis'].includes(b.estilo));
    if (!cajas.length) continue;
    lineas.push(`\n### ${t(e.titulo)}`);
    for (const b of cajas) lineas.push(`- ${[t(b.titulo), t(b.texto), ...(b.items || []).map(t)].filter(Boolean).join(' — ')}`);
  }
  const hooks = c.etapas.flatMap((e) => (e.bloques || []).filter((b) => b?.tipo === 'hooks').flatMap((b) => b.items || [])).filter((h) => t(h?.mejorado) && h.saturacion !== 'alta').slice(0, 12);
  if (hooks.length) lineas.push(`\n### Ganchos del mercado, mejorados (poco saturados)\n${hooks.map((h) => `- ${t(h.mejorado)}`).join('\n')}`);
  return lineas.join('\n').slice(0, 12000) + '\n';
}

/** (solo las pruebas) la sesión que se armaría */
export const _armarSesion = (id, t) => armarSesion(id, t, { retomar: false });

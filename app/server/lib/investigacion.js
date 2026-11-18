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
// La skill es la «Investigación de mercado profunda»: su PDF (portada, 14 secciones, guía visual de 4 mensajes y
// fuentes) llega como JSON de bloques y la pantalla lo dibuja con el mismo diseño (Documento.jsx).
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

// Dos formatos: "documento" (el de ahora: el contenido del PDF de la skill, que la app dibuja igual) y el de la
// primera versión (datos sueltos con gráficas; las investigaciones ya hechas se siguen viendo así).
const TIPOS_DE_BLOQUE = ['parrafo', 'subtitulo', 'vinetas', 'numerada', 'tabla', 'ficha', 'caja', 'cita', 'propuesta', 'opcion', 'franja', 'nota', 'guia-visual'];

function validarInvestigacion(id) {
  const crudo = leerJSON(rutaInv(id));
  if (crudo?.formato !== 'documento') return leerYValidar(rutaInv(id), 'investigacion-mercado');
  const v = leerYValidar(rutaInv(id), 'investigacion-documento');
  if (!v.ok) return v;
  const errores = [];
  let guia = 0;
  v.datos.secciones.forEach((sec, i) =>
    (sec.bloques || []).forEach((b, k) => {
      const donde = `secciones[${i}].bloques[${k}]`;
      if (!TIPOS_DE_BLOQUE.includes(b?.tipo)) errores.push(`${donde}.tipo: "${b?.tipo}" no existe (valen ${TIPOS_DE_BLOQUE.join(', ')})`);
      if (b?.tipo === 'guia-visual') guia++;
      if (b?.tipo === 'tabla' && !(Array.isArray(b.columnas) && Array.isArray(b.filas) && b.filas.every((f) => Array.isArray(f) && f.length === b.columnas.length))) errores.push(`${donde}: cada fila de la tabla lleva una celda por columna`);
      if (b?.tipo === 'ficha' && !(Array.isArray(b.filas) && b.filas.every((f) => Array.isArray(f) && f.length === 2))) errores.push(`${donde}: cada fila de la ficha es [dato, valor]`);
      if (['vinetas', 'numerada'].includes(b?.tipo) && !(Array.isArray(b.items) && b.items.length)) errores.push(`${donde}.items: falta la lista`);
      if (['parrafo', 'subtitulo', 'cita', 'nota'].includes(b?.tipo) && !(typeof b.texto === 'string' && b.texto.trim())) errores.push(`${donde}.texto: falta`);
    })
  );
  if (guia !== 1) errores.push('Falta el bloque { "tipo": "guia-visual" } al final de la sección 14 (uno solo).');
  return errores.length ? { ok: false, errores: errores.slice(0, 15) } : v;
}

// ---------------------------------------------------------------- Conceptos para Meta (Andromeda), 2026-11-18

export const TITULO_ANDROMEDA = 'Conceptos para Meta (Andromeda)';
const esAndromeda = (sec) => /andromeda/i.test(String(sec?.titulo || ''));
/** ¿La investigación ya trae la sección de Andromeda? */
export const tieneAndromeda = (inv) => inv?.formato === 'documento' && (inv.secciones || []).some(esAndromeda);

/** Lo que le falta a la sección de Andromeda (la tabla de facetas y la matriz de 6 conceptos o más). */
export function erroresAndromeda(inv) {
  const sec = (inv?.secciones || []).find(esAndromeda);
  if (!sec) return [`Falta la sección «${TITULO_ANDROMEDA}» al final de "secciones" (sección 3b de la skill).`];
  const tablas = (sec.bloques || []).filter((b) => b?.tipo === 'tabla');
  const conColumna = (re) => tablas.find((t) => (t.columnas || []).some((c) => re.test(String(c))));
  const errores = [];
  if (!conColumna(/faceta/i)) errores.push(`«${TITULO_ANDROMEDA}»: falta la tabla de facetas (Persona base / Faceta / Dolor en sus palabras / Escenario visual).`);
  const matriz = tablas.find((t) => (t.columnas || []).some((c) => /hook/i.test(String(c))) && (t.columnas || []).some((c) => /formato/i.test(String(c))));
  if (!matriz || (matriz.filas || []).length < 6) errores.push(`«${TITULO_ANDROMEDA}»: la matriz de conceptos (# / Faceta / Problema / Contexto / Formato / Hook) lleva 8 filas.`);
  if (!conColumna(/momento/i)) errores.push(`«${TITULO_ANDROMEDA}»: falta la tabla de momentos y contexto.`);
  return errores;
}

function leerInvestigacion(id) {
  const v = existe(rutaInv(id)) ? validarInvestigacion(id) : null;
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
    ? { estado: t.estado, modo: t.modo || null, progreso: (t.progreso || []).slice(-12), error: t.error || null, limite: Boolean(t.limite), reinicio: t.reinicio || null, inicio: t.inicio || null, fin: t.fin || null, pais: t.pais || null }
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
      avatar: inv?.portada?.avatar || null,
      pais: inv?.pais || t?.pais || null,
      resaltados: inv ? leerResaltados(id).length : 0,
      creado: p.creado || null,
    });
  }
  return salida.sort((a, b) => String(b.fecha || b.creado || '').localeCompare(String(a.fecha || a.creado || '')));
}

// ---------------------------------------------------------------- la sesión

/** La sesión corta que agrega la sección de Andromeda a una investigación ya hecha (sin internet, sin rehacer nada). */
function armarSesionAndromeda(id, { pais, retomar }) {
  const rel = relProducto(id);
  const archivo = `${rel}/investigacion/investigacion.json`;
  const prompt = textoClaude('tarea-investigacion-andromeda', {
    carpeta: rel,
    pais: pais || leerInvestigacion(id)?.pais || 'Colombia',
    fecha: new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }).format(new Date()),
    archivo,
  });
  return {
    tipo: 'ficha',
    resume: retomar,
    prompt: retomar ? `${prompt}\n\n(La app se cerró mientras trabajabas: mira lo que ya escribiste y termina.)` : prompt,
    herramientas: ['Read', 'Glob', 'Grep', 'Edit'],
    permitidas: [`Read(./${rel}/**)`, `Read(./.claude/skills/${SKILL}/**)`, 'Glob', 'Grep', `Edit(./${archivo})`],
    prohibidas: prohibidasComunes({ terminal: false }),
    fraseInicio: `${nombreIA()} está armando los conceptos para Meta`,
    timeoutMs: 25 * 60000,
    silencioMs: 8 * 60000,
    maxTurnos: 60,
    correcciones: 3,
    verificar: async () => {
      const v = validarInvestigacion(id);
      if (!v.ok) return { ok: false, errores: v.errores.slice(0, 15) };
      const e = erroresAndromeda(v.datos);
      return e.length ? { ok: false, errores: e } : { ok: true };
    },
  };
}

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
    pais: pais || 'Colombia',
    fecha: new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }).format(new Date()),
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
    timeoutMs: 90 * 60000,
    silencioMs: 12 * 60000,
    maxTurnos: 260,
    correcciones: 3,
    verificar: async () => {
      const crudo = leerJSON(rutaInv(id));
      if (crudo && crudo.formato !== 'documento') return { ok: false, errores: ['"formato" tiene que ser "documento" (el formato de la tarea).'] };
      const v = validarInvestigacion(id);
      if (!v.ok) return { ok: false, errores: v.errores.slice(0, 15) };
      const e = erroresAndromeda(v.datos);
      return e.length ? { ok: false, errores: e } : { ok: true };
    },
  };
}

/** POST /api/investigacion/:id: lanza la investigación (no espera). Con `soloAndromeda`, solo le agrega a la que ya
 *  está hecha la sección «Conceptos para Meta (Andromeda)» (unos minutos, sin internet). */
export function investigar(id, { pais = null, retomar = false, soloAndromeda = false } = {}) {
  const p = leerProducto(id);
  if (!p) throw new ErrorApp(404, 'No encuentro ese producto.');
  if (!(p.fotos || []).length) throw new ErrorApp(400, 'Sube la foto del producto para investigarlo.');
  const previa = leerTarea(id);
  // (los conceptos para Meta salen de la investigación hecha, sin internet: también con ChatGPT)
  const soloConceptos = retomar ? previa?.modo === 'andromeda' : soloAndromeda;
  if (!soloConceptos && motorElegido() !== 'claude') throw new ErrorApp(409, 'La investigación de mercado busca en internet y por ahora solo funciona con Claude. Elige Claude en Ajustes › Conexiones.');
  if (enMarcha.has(id) || (previa?.estado === 'investigando' && previa?.uuid && sesionActiva(previa.uuid))) return { tarea: previa?.id || null, yaEstaba: true };
  const paisLimpio = String(pais || '').replace(/[^\p{L} .-]/gu, '').trim().slice(0, 60) || null;
  const modo = soloConceptos ? 'andromeda' : null;
  if (modo === 'andromeda') {
    const actual = leerInvestigacion(id);
    if (actual?.formato !== 'documento') throw new ErrorApp(409, 'Esta investigación es del formato anterior: vuelve a investigar el producto y ya trae los conceptos para Meta.');
    if (!retomar && tieneAndromeda(actual)) throw new ErrorApp(409, 'Esta investigación ya tiene los conceptos para Meta.');
  }
  const uuid = retomar && previa?.uuid ? previa.uuid : crypto.randomUUID();
  const tarea = { id: uuid, uuid, estado: 'investigando', ...(modo ? { modo } : {}), pais: retomar ? previa?.pais || paisLimpio : modo === 'andromeda' ? previa?.pais || paisLimpio : paisLimpio, progreso: [], intentos: (previa?.intentos || 0) + 1, inicio: ahora(), error: null };
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
  // la anterior queda de respaldo hasta que la nueva salga bien (con Andromeda, se copia: la sesión edita la misma)
  const anterior = path.join(dir(id), 'investigacion-anterior.json');
  const andromeda = tarea.modo === 'andromeda';
  if (!retomar && existe(rutaInv(id))) (andromeda ? fs.copyFileSync : fs.renameSync)(rutaInv(id), anterior);
  const sesion = andromeda ? armarSesionAndromeda(id, { pais: tarea.pais, retomar }) : armarSesion(id, { pais: tarea.pais, retomar });
  const r = await lanzarSesion({ ...sesion, uuid: tarea.uuid, alProgreso: avanzar, registro: path.join(dir(id), 'registro', andromeda ? 'andromeda.log' : 'investigacion.log') });
  const fin = { ...tarea, fin: ahora(), medida: { turnos: r.turnos, duracionMs: r.duracionMs, motor: r.motor || null } };
  if (r.ok && leerInvestigacion(id) && (!andromeda || tieneAndromeda(leerInvestigacion(id)))) {
    fs.rmSync(anterior, { force: true });
    guardarTarea(id, { ...fin, estado: 'lista', error: null });
    return;
  }
  // (con Andromeda, si no salió, vuelve la investigación tal como estaba)
  if (existe(rutaInv(id)) && (!leerInvestigacion(id) || (andromeda && existe(anterior)))) fs.renameSync(rutaInv(id), path.join(dir(id), 'investigacion-incompleta.json'));
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
const sinNegrita = (t) => String(t ?? '').replace(/\*\*/g, '');

/** Un bloque del documento como texto. */
function bloqueATexto(b) {
  const t = sinNegrita;
  switch (b?.tipo) {
    case 'subtitulo':
      return `\n### ${t(b.texto)}`;
    case 'parrafo':
    case 'nota':
      return t(b.texto);
    case 'vinetas':
    case 'numerada':
      return (b.items || []).map((x) => `- ${t(x)}`).join('\n');
    case 'tabla':
      return (b.filas || []).map((f) => `- ${f.map((c, i) => `${t(b.columnas?.[i])}: ${t(c)}`).join(' | ')}`).join('\n');
    case 'ficha':
      return (b.filas || []).map((f) => `- ${t(f[0])}: ${t(f[1])}`).join('\n');
    case 'caja':
      return [b.titulo && `${t(b.titulo)}:`, b.texto && t(b.texto), ...(b.items || []).map((x) => `- ${t(x)}`), b.pie && t(b.pie)].filter(Boolean).join('\n');
    case 'cita':
      return `«${t(b.texto)}»`;
    case 'propuesta':
      return `${t(b.titulo)}\n- Dolor: ${t(b.dolor)}\n- Propuesta: ${t(b.propuesta)}\n- Tiempo: ${t(b.tiempo)}`;
    case 'opcion':
      return `- ${t(b.etiqueta)}: ${t(b.titulo)}${b.subtitulo ? ` — ${t(b.subtitulo)}` : ''}`;
    case 'franja':
      return `${t(b.etiqueta)} ${t(b.texto)}`;
    default:
      return '';
  }
}

function documentoAMarkdown(inv, res) {
  const partes = [
    `# Investigación de mercado: ${inv.producto} (${inv.pais})`,
    res.length ? `\n## LO QUE EL USUARIO RESALTÓ (tenlo en cuenta primero: es lo que más le importa)\n${res.map((r) => `- ${r.texto}${r.nota ? ` — nota del usuario: ${r.nota}` : ''}`).join('\n')}` : '',
    `\n## Lo más importante\n- Deseo central: ${inv.claves.deseo_central}\n- Beneficio principal: ${inv.claves.beneficio_principal}\n- Puntos de dolor:\n${inv.claves.puntos_dolor.map((d) => `  - ${d}`).join('\n')}\n- Avatar: ${inv.portada.avatar}`,
    ...inv.secciones.map((sec, i) => `\n## ${i + 1}. ${sec.titulo}\n${(sec.bloques || []).map(bloqueATexto).filter(Boolean).join('\n')}`),
  ];
  return partes.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 90000) + '\n';
}

export function aMarkdown(id) {
  const inv = idValido(id) ? leerInvestigacion(id) : null;
  if (!inv) return null;
  const res = leerResaltados(id);
  if (inv.formato === 'documento') return documentoAMarkdown(inv, res);
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

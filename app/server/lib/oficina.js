// OFICINA VIRTUAL (2026-11-19q, pedido: «una oficina de agentes como la del video, para lo que hace la app»): el
// trabajo REAL de la app repartido entre agentes con nombre y personaje, cada uno en su departamento, con lo que está
// haciendo ahora, lo que te necesita y lo que hizo. No inventa trabajo: lo lee de los anuncios, los lotes de imagen y
// las investigaciones (lo mismo que ve el resto de la app).
//
//   oficina()                 -> { configurada, agentes: [{ id, rol, depto, nombre, avatar, color, estado, ahora, tareas,
//                                  hechos, aprendizajes }], resumen }
//   guardarAgentes(cambios)   { agentes: { [id]: { nombre, avatar, genero: 'mujer'|'hombre' } } }  (los nombres y personajes, en app/config.json)
//
// estado de un agente: 'te-necesita' (algo suyo espera tu decisión o falló) · 'trabajando' · 'libre'.
//
// (2026-11-19r) DISEÑAR LA OFICINA: cada oficina ocupa un LUGAR de la planta (0..12, ver LUGARES); el usuario las mueve,
// les cambia el nombre y el color, y crea las suyas (con un tipo de sala). Las secciones «Próximamente» del menú
// (Landings, Embudo WhatsApp, S.E.P) salen como oficinas en construcción. Se guardan en app/config.json oficina.zonas
// y oficina.propias.   guardarZonas({ zonas: [{ id | nueva: true, lugar, nombre?, color?, tipo? }] })
// También: lo que se está haciendo se ve en las pantallas (`vista` de cada tarea: el último clip o imagen generada) y
// las IAs caídas (lib/salud.js) se muestran en `ias` y en cada agente que las usa (`caida`).
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, TEMP } from './rutas.js';
import { leerJSON } from './archivos.js';
import { leerConfig, guardarConfig } from './config.js';
import { listarAnunciosNuevos } from './anuncios-nuevos.js';
import crypto from 'node:crypto';
import { OUTPUT } from './rutas.js';

// Los agentes y su trabajo. `pasos`: los pasos de producción que hace (por su id: lib/familias/*.js PASOS).
const COLOR_DEP = { video: '#60a5fa', imagen: '#f472b6', investigacion: '#fb923c', landing: '#38bdf8', whatsapp: '#22c55e', analisis: '#c084fc', coordinacion: '#a3e635' };
export const NOMBRE_DEP = { video: 'Anuncios de video', imagen: 'Anuncios de imagen', investigacion: 'Investigación de mercado', landing: 'Landing pages', whatsapp: 'Embudos de WhatsApp', analisis: 'Análisis y optimización', coordinacion: 'Coordinación' };
export const AGENTES = [
  { id: 'coordinacion', dep: 'coordinacion', genero: 'mujer', rol: 'Coordinadora', depto: 'Dirección', nombre: 'Valentina', avatar: '👩‍💼', color: '#a3e635', hace: 'Reparte el trabajo, revisa el costo y te avisa lo que espera tu decisión.' },
  { id: 'guion', dep: 'video', estacion: 'v-guion', genero: 'hombre', rol: 'Guionista', depto: 'Guiones', nombre: 'Mateo', avatar: '✍️', color: '#fbbf24', hace: 'Escribe los guiones de cada estilo con tu investigación y tus aprendizajes.' },
  { id: 'arte', dep: 'video', estacion: 'v-imagenes', genero: 'mujer', rol: 'Directora de arte', depto: 'Arte', nombre: 'Lucía', avatar: '🎨', color: '#f472b6', hace: 'Crea las personas, los lugares y la imagen de cada escena, y los anuncios de imagen.' },
  { id: 'video', dep: 'video', estacion: 'v-produccion', genero: 'hombre', rol: 'Productor de video', depto: 'Producción', nombre: 'Andrés', avatar: '🎬', color: '#60a5fa', hace: 'Genera los clips, las voces y la música de cada anuncio.' },
  { id: 'edicion', dep: 'video', estacion: 'v-edicion', genero: 'mujer', rol: 'Editora', depto: 'Edición', nombre: 'Camila', avatar: '✂️', color: '#c084fc', hace: 'Arma el montaje, los subtítulos y exporta los videos.' },
  { id: 'calidad', dep: 'video', estacion: 'v-revision', genero: 'hombre', rol: 'Revisor de calidad', depto: 'Calidad', nombre: 'Tomás', avatar: '🔍', color: '#2dd4bf', hace: 'Revisa cada imagen y cada clip antes de entregar, y deja avisos.' },
  { id: 'investigacion', dep: 'investigacion', estacion: 'r-recopilacion', genero: 'mujer', rol: 'Investigadora', depto: 'Investigación', nombre: 'Sofía', avatar: '🔭', color: '#fb923c', hace: 'Investiga tu mercado y tu competencia en TrendTrack.' },
  // (2026-11-20) los agentes de cada estación de las cadenas de producción (lib/oficina-produccion.js)
  ...[
    ['v-plan', 'video', 'Planificador de producción', 'Julián', 'hombre', '🗂️', 'Revisa el guion, tu saldo, la voz y los tiempos antes de gastar.'],
    ['i-investigacion', 'imagen', 'Investigadora de producto', 'Daniela', 'mujer', '🔎', 'Prepara cada lote con tu producto, su investigación y las plantillas.'],
    ['i-estrategia', 'imagen', 'Estratega creativa', 'Mariana', 'mujer', '🧠', 'Elige el ángulo, el dolor y la promesa de cada variación.'],
    ['i-prompts', 'imagen', 'Ingeniero de prompts', 'Samuel', 'hombre', '⌨️', 'Escribe el prompt de cada imagen y lo ajusta si la revisión lo devuelve.'],
    ['i-generacion', 'imagen', 'Generadora de imágenes', 'Isabella', 'mujer', '🖼️', 'Genera cada imagen con el modelo conectado.'],
    ['i-revision', 'imagen', 'Revisor de imágenes', 'Martín', 'hombre', '✅', 'Revisa textos, producto y composición; devuelve lo que no pasa.'],
    ['i-entrega', 'imagen', 'Entregas', 'Paula', 'mujer', '📦', 'Guarda las aprobadas y arma el informe con el costo.'],
    ['r-competencia', 'investigacion', 'Analista de competencia', 'Felipe', 'hombre', '🕵️', 'Investiga en TrendTrack lo que más vende tu competencia.'],
    ['r-publico', 'investigacion', 'Analista de público', 'Laura', 'mujer', '👥', 'Arma el avatar: quién compra, qué le duele y qué desea.'],
    ['r-oportunidades', 'investigacion', 'Oportunidades', 'Nicolás', 'hombre', '💡', 'Saca los conceptos para Meta y los ángulos con más potencial.'],
    ['r-sintesis', 'investigacion', 'Síntesis y validación', 'Gabriela', 'mujer', '📑', 'Valida y entrega el informe completo.'],
    ['l-investigacion', 'landing', 'Investigación de producto', 'Emilio', 'hombre', '🔎', 'Próximamente: investigará el producto para su landing.'],
    ['l-copy', 'landing', 'Copywriter', 'Valeria', 'mujer', '✍️', 'Próximamente: escribirá los textos que venden.'],
    ['l-conversion', 'landing', 'Arquitecto de conversión', 'Simón', 'hombre', '📐', 'Próximamente: ordenará la página para que convierta.'],
    ['l-diseno', 'landing', 'Diseñadora visual', 'Antonia', 'mujer', '🎨', 'Próximamente: diseñará la página.'],
    ['l-desarrollo', 'landing', 'Desarrollador', 'Lucas', 'hombre', '💻', 'Próximamente: construirá la página.'],
    ['l-pruebas', 'landing', 'Pruebas', 'Renata', 'mujer', '🧪', 'Próximamente: probará que todo funcione.'],
    ['w-estrategia', 'whatsapp', 'Estratega conversacional', 'Carolina', 'mujer', '💬', 'Próximamente: diseñará la conversación de venta.'],
    ['w-mensajes', 'whatsapp', 'Redactora de mensajes', 'Andrea', 'mujer', '✍️', 'Próximamente: escribirá cada mensaje.'],
    ['w-flujos', 'whatsapp', 'Diseñador de flujos', 'Sebastián', 'hombre', '🔀', 'Próximamente: armará los flujos del embudo.'],
    ['w-automatizacion', 'whatsapp', 'Automatización', 'Emiliano', 'hombre', '⚙️', 'Próximamente: conectará las automatizaciones.'],
    ['w-pruebas', 'whatsapp', 'Pruebas', 'Juliana', 'mujer', '🧪', 'Próximamente: probará el embudo.'],
    ['w-optimizacion', 'whatsapp', 'Optimización', 'Alejandro', 'hombre', '📈', 'Próximamente: mejorará lo que más convierte.'],
    ['a-metricas', 'analisis', 'Métricas', 'Manuela', 'mujer', '📊', 'Próximamente: juntará las métricas reales de tus anuncios.'],
    ['a-rendimiento', 'analisis', 'Rendimiento', 'Santiago', 'hombre', '📈', 'Próximamente: analizará qué rinde y qué no.'],
    ['a-problemas', 'analisis', 'Diagnóstico', 'Ricardo', 'hombre', '🩺', 'Próximamente: encontrará los problemas.'],
    ['a-propuestas', 'analisis', 'Propuestas', 'Elena', 'mujer', '💡', 'Próximamente: propondrá mejoras.'],
    ['a-reporte', 'analisis', 'Reporte', 'Matías', 'hombre', '📑', 'Próximamente: te entregará el reporte.'],
  ].map(([id, dep, rol, nombre, genero, avatar, hace]) => ({ id, dep, estacion: id, genero, rol, depto: dep, nombre, avatar, color: COLOR_DEP[dep], hace, extra: true })),
];

/** El agente que hace un paso de producción (por su id). */
export function agenteDelPaso(paso) {
  const p = String(paso || '');
  if (!p) return 'coordinacion';
  if (/revision|control|revisar/.test(p)) return 'calidad';
  if (/montaje|render|exportar|recorte|informe|subtitul/.test(p)) return 'edicion';
  if (/imagen|persona|hoja|referencia|portada/.test(p)) return 'arte';
  if (/video|clip|bloque|voz|voces|musica|cancion|gancho|ventana|historia/.test(p)) return 'video';
  return 'coordinacion'; // validar, saldo, aprobar…
}

const leerOficina = () => leerConfig().oficina || {};

// ---------------------------------------------------------------- las salas y su lugar en la planta

// (2026-11-20) la planta de la imagen de referencia: seis departamentos alrededor del logo K, la coordinación arriba al
// medio, la sala de estar abajo al medio y una fila nueva adelante (8-11) para tus oficinas propias.
export const LUGARES = 12; // 0-5 departamentos (izq./der. en tres filas) · 6 coordinación · 7 sala de estar · 8-11 fila nueva
const VERSION_PLANTA = 2; // los lugares guardados con la planta anterior no valen en esta
const FIJAS = [
  { id: 'video', tipo: 'video', lugar: 0, dep: true },
  { id: 'imagen', tipo: 'imagen', lugar: 1, dep: true },
  { id: 'investigacion', tipo: 'investigacion', lugar: 2, dep: true },
  { id: 'landing', tipo: 'landing', lugar: 3, dep: true, pronto: true, href: '#/landings' },
  { id: 'whatsapp', tipo: 'whatsapp', lugar: 4, dep: true, pronto: true, href: '#/embudo-whatsapp' },
  { id: 'analisis', tipo: 'analisis', lugar: 5, dep: true, pronto: true, href: '#/sep' },
  { id: 'coordinacion', tipo: 'coordinacion', lugar: 6, dep: true },
  { id: 'sala', tipo: 'sala', lugar: 7, nombre: 'Sala de estar', color: '#a3e635' },
];
// los tipos de sala para las oficinas que crea el usuario
export const TIPOS = {
  escritorios: 'Escritorios en fila',
  creativos: 'Creativos (pantallas grandes)',
  estudio: 'Estudio de video',
  reuniones: 'Sala de reuniones',
  datos: 'Pared de datos',
  biblioteca: 'Biblioteca',
  vidrio: 'Oficina de vidrio',
  cafe: 'Café',
  sala: 'Sala de estar',
};
const COLOR = /^#[0-9a-f]{6}$/i;

/** Las salas con su lugar, nombre y color (lo guardado encima de lo de siempre). */
function zonasDe(cfg, porId = {}) {
  const vale = cfg.planta === VERSION_PLANTA; // con la planta anterior, cada sala vuelve a su lugar de siempre
  const guardadas = cfg.zonas || {};
  const fijas = FIJAS.map((z) => {
    const g = guardadas[z.id] || {};
    const gente = AGENTES.filter((a) => (a.dep || 'coordinacion') === z.id).length;
    return { ...z, nombre: (vale && g.nombre) || z.nombre || NOMBRE_DEP[z.id] || z.id, color: (vale && g.color) || z.color || COLOR_DEP[z.id] || '#a3e635', lugar: vale && Number.isInteger(g.lugar) ? g.lugar : z.lugar, agente: false, ...(gente ? { de: `${gente} ${gente === 1 ? 'agente' : 'agentes'}` } : {}), ...(z.id === 'coordinacion' ? { de: porId.coordinacion?.nombre || 'Valentina' } : {}) };
  });
  const propias = (Array.isArray(cfg.propias) ? cfg.propias : []).map((z) => ({ id: z.id, tipo: TIPOS[z.tipo] ? z.tipo : 'escritorios', nombre: z.nombre, color: z.color, lugar: vale ? z.lugar : -1, propia: true }));
  // si dos quedaron en el mismo lugar (o fuera de la planta), la segunda va al primer lugar libre
  const usados = new Set();
  return [...fijas, ...propias].map((z) => {
    let lugar = z.lugar;
    if (!(lugar >= 0 && lugar < LUGARES) || usados.has(lugar)) lugar = [...Array(LUGARES).keys()].find((n) => !usados.has(n)) ?? -1;
    usados.add(lugar);
    return { ...z, lugar };
  }).filter((z) => z.lugar >= 0);
}

/** Guarda el diseño: dónde va cada sala, su nombre y color, y las oficinas propias (las que no vienen se borran). */
export function guardarZonas(cuerpo = {}) {
  const actual = leerOficina();
  const lista = Array.isArray(cuerpo.zonas) ? cuerpo.zonas.slice(0, LUGARES) : null;
  if (!lista) throw Object.assign(new Error('Faltan las oficinas.'), { status: 400 });
  const usados = new Set();
  const zonas = {};
  const propias = [];
  const viejas = new Map((actual.propias || []).map((z) => [z.id, z]));
  for (const z of lista) {
    if (!z || typeof z !== 'object') continue;
    const lugar = Number(z.lugar);
    if (!Number.isInteger(lugar) || lugar < 0 || lugar >= LUGARES) throw Object.assign(new Error('Ese lugar no está en la planta.'), { status: 400 });
    if (usados.has(lugar)) throw Object.assign(new Error('Dos oficinas quedaron en el mismo lugar.'), { status: 400 });
    usados.add(lugar);
    const nombre = String(z.nombre ?? '').replace(/\s+/g, ' ').trim().slice(0, 30);
    const color = COLOR.test(String(z.color || '')) ? String(z.color) : null;
    if (FIJAS.some((f) => f.id === z.id)) {
      zonas[z.id] = { lugar, ...(nombre ? { nombre } : {}), ...(color ? { color } : {}) };
    } else if (z.nueva || viejas.has(z.id)) {
      if (!nombre) throw Object.assign(new Error('Ponle un nombre a tu oficina.'), { status: 400 });
      propias.push({ id: viejas.has(z.id) ? z.id : `propia-${crypto.randomBytes(3).toString('hex')}`, nombre, color: color || '#a3e635', tipo: TIPOS[z.tipo] ? z.tipo : 'escritorios', lugar });
    }
  }
  // las de siempre que no vinieron conservan su lugar si está libre
  if (actual.planta === VERSION_PLANTA) for (const f of FIJAS) if (!zonas[f.id] && actual.zonas?.[f.id]) zonas[f.id] = actual.zonas[f.id];
  guardarConfig({ oficina: { ...actual, zonas, propias, planta: VERSION_PLANTA } });
  return oficina();
}

// ---------------------------------------------------------------- lo que se ve en las pantallas

const MEDIO = /\.(mp4|webm|png|jpe?g|webp)$/i;
/** El último clip o imagen generada en esas carpetas: { tipo: 'video'|'imagen', url }. */
function ultimoMedio(dirBase, subdirs, url) {
  let mejor = null;
  for (const sub of subdirs) {
    let nombres = [];
    try {
      nombres = fs.readdirSync(path.join(dirBase, sub));
    } catch {
      continue;
    }
    for (const n of nombres) {
      if (!MEDIO.test(n) || n.startsWith('.')) continue;
      let st;
      try {
        st = fs.statSync(path.join(dirBase, sub, n));
      } catch {
        continue;
      }
      if (st.size < 2000) continue;
      if (!mejor || st.mtimeMs > mejor.t) mejor = { t: st.mtimeMs, sub, n };
    }
  }
  if (!mejor) return null;
  return { tipo: /\.(mp4|webm)$/i.test(mejor.n) ? 'video' : 'imagen', url: `${url}/${mejor.sub}/${encodeURIComponent(mejor.n)}?v=${Math.round(mejor.t)}` };
}
export const _ultimoMedio = (...a) => ultimoMedio(...a);
const vistaDeAnuncio = (slug) => ultimoMedio(path.join(TEMP, slug), ['video', 'img'], `/archivos/anuncio/${encodeURIComponent(slug)}`);
function vistaFinal(slug) {
  try {
    const f = fs.readdirSync(OUTPUT).filter((n) => n.startsWith(slug) && /\.mp4$/i.test(n)).sort().pop();
    return f ? { tipo: 'video', url: `/archivos/salida/${encodeURIComponent(f)}` } : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- las IAs caídas

// qué agentes usan cada servicio de Salud de plataformas
const USAN = { claude: ['coordinacion', 'guion', 'investigacion', 'calidad'], chatgpt: ['coordinacion', 'guion', 'investigacion', 'calidad'], kie: ['arte', 'video'], elevenlabs: ['video', 'edicion'] };
async function iasConProblemas() {
  try {
    const { salud } = await import('./salud.js');
    const s = await Promise.race([salud(), new Promise((ok) => setTimeout(() => ok(null), 1500))]);
    const servicios = (s?.grupos || []).flatMap((g) => g.servicios || []);
    return servicios
      .filter((x) => ['caido', 'degradado', 'lento'].includes(x.estado))
      .map((x) => ({ id: x.id, nombre: x.nombre, estado: x.estado, detalle: x.detalle || '', afecta: USAN[x.id] || ['coordinacion'] }));
  } catch {
    return [];
  }
}

/** (2026-11-20j) La coordinadora como la ve el usuario (su nombre y personaje), sin armar toda la oficina. */
export function coordinadora() {
  const base = AGENTES.find((a) => a.id === 'coordinacion');
  const propio = leerOficina().agentes?.coordinacion || {};
  return { nombre: propio.nombre || base.nombre, avatar: propio.avatar || base.avatar, color: base.color };
}

/** Los nombres y personajes que eligió el usuario. */
export function guardarAgentes(cambios = {}) {
  const actual = leerOficina();
  const agentes = { ...(actual.agentes || {}) };
  for (const a of AGENTES) {
    const c = cambios?.agentes?.[a.id];
    if (!c || typeof c !== 'object') continue;
    const nombre = String(c.nombre ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const avatar = String(c.avatar ?? '').trim().slice(0, 16);
    const genero = c.genero === 'mujer' || c.genero === 'hombre' ? c.genero : null;
    agentes[a.id] = { ...(agentes[a.id] || {}), ...(nombre ? { nombre } : {}), ...(avatar ? { avatar } : {}), ...(genero ? { genero } : {}) };
  }
  guardarConfig({ oficina: { ...actual, agentes, configurada: true, ...(cambios.nombreOficina ? { nombre: String(cambios.nombreOficina).trim().slice(0, 50) } : {}) } });
  return oficina();
}

/** Cuántas reglas aprendió la app (aprendizajes): por agente, las de su trabajo. */
function aprendizajes() {
  const dir = path.join(RAIZ, 'mis_archivos', 'biblioteca', 'aprendizajes');
  const cuenta = {};
  let archivos = [];
  try {
    archivos = fs.readdirSync(dir).filter((n) => n.endsWith('.md'));
  } catch {
    return { total: 0, porArchivo: {} };
  }
  let total = 0;
  for (const n of archivos) {
    let t = '';
    try {
      t = fs.readFileSync(path.join(dir, n), 'utf8');
    } catch {
      continue;
    }
    const reglas = t.split('\n').filter((l) => /^\s*[-*]\s+\S/.test(l)).length;
    cuenta[n.replace(/\.md$/, '')] = reglas;
    total += reglas;
  }
  return { total, porArchivo: cuenta };
}

const tarea = (t) => ({ titulo: t.titulo, detalle: t.detalle || null, href: t.href || null, cuando: t.cuando || null, ...(t.vista ? { vista: t.vista } : {}) });

export async function oficina() {
  const cfg = leerOficina();
  const porId = Object.fromEntries(AGENTES.map((a) => [a.id, { ...a, ...(cfg.agentes?.[a.id] || {}), ahora: [], necesita: [], hechos: [] }]));
  const hoy = Date.now() - 24 * 3600000;

  // los anuncios de video: el guion (guionista), cada paso de la producción (su agente) y lo terminado hoy
  let anuncios = [];
  try {
    anuncios = listarAnunciosNuevos();
  } catch {
    anuncios = [];
  }
  for (const a of anuncios) {
    // lo que dejaste para después no te pide nada (queda en «Para después» del tablero)
    if (a.paraDespues && (a.teNecesita || a.estado === 'error')) continue;
    const nombre = a.tituloGuion || a.titulo || a.slug;
    const href = `#/anuncio/${a.slug}`;
    if (a.estado === 'guion') {
      if (a.teNecesita) porId.guion.necesita.push(tarea({ titulo: `Aprobar el guion de «${nombre}»`, detalle: a.estiloNombre, href: `#/nuevo?producto=${encodeURIComponent(a.productoId || '')}&paso=2&anuncios=${a.slug}`, cuando: a.fecha }));
      else porId.guion.ahora.push(tarea({ titulo: a.etapa === 'cambiando' ? `Cambiando el guion de «${nombre}»` : `Escribiendo el guion de «${nombre}»`, detalle: a.estiloNombre, href, cuando: a.fecha }));
    } else if (a.estado === 'produciendo') {
      const ag = agenteDelPaso(a.etapa);
      porId[ag].ahora.push(tarea({ titulo: `«${nombre}»`, detalle: `${a.estiloNombre || ''}${a.etapa ? ` · ${a.etapa}` : ''}`, href: `#/anuncio/${a.slug}/produccion`, cuando: a.fecha, vista: vistaDeAnuncio(a.slug) }));
    } else if (a.estado === 'error') {
      const ag = a.enGuion ? 'guion' : agenteDelPaso(a.etapa);
      porId[ag].necesita.push(tarea({ titulo: `«${nombre}» se frenó`, detalle: a.error || 'Míralo y toca Continuar o Reintentar.', href: a.enGuion ? href : `#/anuncio/${a.slug}/produccion`, cuando: a.fecha }));
    } else if (a.estado === 'listo' && Date.parse(a.fecha) > hoy) {
      porId.edicion.hechos.push(tarea({ titulo: `Entregó «${nombre}»`, detalle: a.estiloNombre, href, cuando: a.fecha, vista: vistaFinal(a.slug) }));
    }
  }

  // los anuncios de imagen (directora de arte)
  // (2026-11-20g) por qué se frenó un lote (el mensaje del paso con error), para verlo en «En vivo» sin abrirlo
  let leerCond = null;
  try {
    leerCond = (await import('./conductor.js')).leerConductor;
  } catch {
    /* sin conductor */
  }
  const motivoDelLote = (lote) => {
    try {
      const c = leerCond?.(lote);
      return (c?.pasos || []).find((p) => p.error)?.error?.mensaje || null;
    } catch {
      return null;
    }
  };
  try {
    const { listarLotes } = await import('./imagen-ads/lotes.js');
    for (const l of listarLotes()) {
      const nombre = l.titulo || l.lote;
      const href = `#/imagenes/${l.lote}`;
      if (l.estado === 'corriendo' || l.estado === 'esperando') porId.arte.ahora.push(tarea({ titulo: `Anuncios de imagen: ${nombre}`, detalle: `${l.listas ?? 0} de ${l.total ?? '?'} listas${l.estado === 'esperando' ? ' · en la fila' : ''}`, href, cuando: l.actualizado || l.creado, vista: ultimoMedio(path.join(TEMP, l.lote), ['img'], `/archivos/imagen-ads/${encodeURIComponent(l.lote)}`) }));
      else if (l.estado === 'error' || (l.estado === 'pausado' && l.motivo !== 'detenido')) porId.arte.necesita.push(tarea({ titulo: `Anuncios de imagen: ${nombre} ${l.motivo === 'saldo' ? 'espera tu saldo' : 'se frenó'}`, detalle: motivoDelLote(l.lote), href, cuando: l.actualizado || l.creado }));
      else if (l.estado === 'listo' && Date.parse(l.terminado || l.creado) > hoy) porId.arte.hechos.push(tarea({ titulo: `Entregó ${l.total ?? ''} imágenes de ${nombre}`, href, cuando: l.terminado }));
    }
  } catch {
    /* sin lotes */
  }

  // las investigaciones (investigadora): la de mercado y la de la competencia
  try {
    const inv = await import('./investigacion.js');
    const comp = await import('./competencia.js');
    for (const p of inv.listar()) {
      const href = `#/investigacion/${p.id}`;
      if (p.estado === 'investigando') porId.investigacion.ahora.push(tarea({ titulo: `Investigando el mercado de ${p.nombre}`, href }));
      else if (p.estado === 'error') porId.investigacion.necesita.push(tarea({ titulo: `La investigación de ${p.nombre} no terminó`, href }));
      else if (p.estado === 'lista' && Date.parse(p.fecha) > hoy) porId.investigacion.hechos.push(tarea({ titulo: `Terminó la investigación de ${p.nombre}`, href, cuando: p.fecha }));
      const c = comp.estado(p.id)?.tarea;
      if (c?.estado === 'investigando') porId.investigacion.ahora.push(tarea({ titulo: `Investigando la competencia de ${p.nombre} en TrendTrack`, detalle: c.enlace || 'buscando la tienda que más vende', href }));
    }
  } catch {
    /* sin investigaciones */
  }

  // la coordinadora ve todo lo que te necesita
  const todoLoQueNecesita = AGENTES.flatMap((a) => porId[a.id].necesita.map((t) => ({ ...t, agente: a.id })));
  const ap = aprendizajes();
  const reglasDe = { coordinacion: ap.porArchivo.general || 0, guion: ap.total - (ap.porArchivo.generaciones || 0), calidad: ap.porArchivo.generaciones || 0 };
  // lo que aprendió cada uno de tus 👍/👎 y de lo que le dijiste a la coordinadora (lib/oficina-chat.js)
  let deTi = {};
  try {
    deTi = (await import('./oficina-chat.js')).aprendido();
  } catch {
    deTi = {};
  }
  const ias = await iasConProblemas();
  // las cadenas de producción (lib/oficina-produccion.js): el estado de cada estación sale de lo que registra la app
  let prod = { departamentos: [] };
  try {
    prod = await (await import('./oficina-produccion.js')).produccion();
  } catch (e) {
    console.warn('[oficina] producción:', e.message);
  }
  const RANGO = { error: 5, corrigiendo: 4, revisando: 3, trabajando: 3, esperando: 2 };
  const enEstacion = {}; // estación -> { estado, trabajos: [...] }
  for (const d of prod.departamentos) {
    for (const t of d.trabajos) {
      if (t.estado === 'listo' || t.paraDespues) continue;
      for (const [e, v] of Object.entries(t.estaciones)) {
        if (!RANGO[v]) continue;
        const x = (enEstacion[e] ||= { estado: null, trabajos: [] });
        if (!x.estado || RANGO[v] > RANGO[x.estado]) x.estado = v;
        x.trabajos.push({ titulo: t.titulo, detalle: d.estaciones.find((s) => s.id === e)?.nombre || '', href: t.href, cuando: t.cuando, estado: v, error: t.error?.estacion === e ? t.error.mensaje : null });
      }
    }
  }
  // lo de las estaciones nuevas (las de los agentes de siempre ya lo cuentan arriba)
  for (const a of AGENTES) {
    if (!a.extra) continue;
    for (const t of enEstacion[a.estacion]?.trabajos || []) {
      if (t.estado === 'error') porId[a.id].necesita.push(tarea({ titulo: `«${t.titulo}» se frenó`, detalle: t.error || t.detalle, href: t.href, cuando: t.cuando }));
      else porId[a.id].ahora.push(tarea({ titulo: t.titulo, detalle: t.detalle, href: t.href, cuando: t.cuando }));
    }
  }
  const pronto = new Set(prod.departamentos.filter((d) => d.pronto).map((d) => d.id));
  const agentes = AGENTES.map((a) => {
    const x = porId[a.id];
    const caidas = ias.filter((i) => i.afecta.includes(a.id));
    const necesita = a.id === 'coordinacion' ? todoLoQueNecesita : x.necesita;
    const estado = necesita.length ? 'te-necesita' : x.ahora.length ? 'trabajando' : 'libre';
    return {
      id: a.id,
      rol: a.rol,
      depto: a.depto,
      hace: a.hace,
      nombre: x.nombre,
      avatar: x.avatar,
      genero: x.genero === 'hombre' ? 'hombre' : 'mujer',
      color: a.color,
      dep: a.dep || 'coordinacion',
      estacion: a.estacion || null,
      // lo que hace en su estación ahora: trabajando, revisando, corrigiendo, error, esperando, libre o pronto
      enEstacion: pronto.has(a.dep) ? 'pronto' : enEstacion[a.estacion]?.estado || 'libre',
      estado,
      ahora: x.ahora.slice(0, 12),
      necesita: necesita.slice(0, 12),
      hechos: x.hechos.slice(0, 12),
      aprendizajes: reglasDe[a.id] || 0,
      caida: caidas.length ? `${caidas.map((i) => i.nombre).join(' y ')} ${caidas.some((i) => i.estado === 'caido') ? (caidas.length > 1 ? 'están caídos' : 'está caído') : 'va lento'}` : null,
      opiniones: { bien: deTi[a.id]?.bien || 0, mal: deTi[a.id]?.mal || 0 },
      semana: deTi[a.id]?.semana || [],
    };
  });
  return {
    configurada: Boolean(cfg.configurada),
    nombre: cfg.nombre || 'Tu oficina',
    agentes,
    zonas: zonasDe(cfg, Object.fromEntries(agentes.map((a) => [a.id, a]))),
    tipos: TIPOS,
    lugares: LUGARES,
    ias,
    produccion: prod,
    resumen: {
      trabajando: agentes.filter((a) => a.estado === 'trabajando').length,
      teNecesitan: todoLoQueNecesita.length,
      hechosHoy: agentes.reduce((s, a) => s + a.hechos.length, 0),
      aprendizajes: ap.total,
    },
  };
}


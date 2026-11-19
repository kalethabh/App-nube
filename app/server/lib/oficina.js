// OFICINA VIRTUAL (2026-11-19q, pedido: «una oficina de agentes como la del video, para lo que hace la app»): el
// trabajo REAL de la app repartido entre agentes con nombre y personaje, cada uno en su departamento, con lo que está
// haciendo ahora, lo que te necesita y lo que hizo. No inventa trabajo: lo lee de los anuncios, los lotes de imagen y
// las investigaciones (lo mismo que ve el resto de la app).
//
//   oficina()                 -> { configurada, agentes: [{ id, rol, depto, nombre, avatar, color, estado, ahora, tareas,
//                                  hechos, aprendizajes }], resumen }
//   guardarAgentes(cambios)   { agentes: { [id]: { nombre, avatar } } }  (los nombres y personajes, en app/config.json)
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
export const AGENTES = [
  { id: 'coordinacion', rol: 'Coordinadora', depto: 'Dirección', nombre: 'Valentina', avatar: '👩‍💼', color: '#a3e635', hace: 'Reparte el trabajo, revisa el costo y te avisa lo que espera tu decisión.' },
  { id: 'guion', rol: 'Guionista', depto: 'Guiones', nombre: 'Mateo', avatar: '✍️', color: '#fbbf24', hace: 'Escribe los guiones de cada estilo con tu investigación y tus aprendizajes.' },
  { id: 'arte', rol: 'Directora de arte', depto: 'Arte', nombre: 'Lucía', avatar: '🎨', color: '#f472b6', hace: 'Crea las personas, los lugares y la imagen de cada escena, y los anuncios de imagen.' },
  { id: 'video', rol: 'Productor de video', depto: 'Producción', nombre: 'Andrés', avatar: '🎬', color: '#60a5fa', hace: 'Genera los clips, las voces y la música de cada anuncio.' },
  { id: 'edicion', rol: 'Editora', depto: 'Edición', nombre: 'Camila', avatar: '✂️', color: '#c084fc', hace: 'Arma el montaje, los subtítulos y exporta los videos.' },
  { id: 'calidad', rol: 'Revisor de calidad', depto: 'Calidad', nombre: 'Tomás', avatar: '🔍', color: '#2dd4bf', hace: 'Revisa cada imagen y cada clip antes de entregar, y deja avisos.' },
  { id: 'investigacion', rol: 'Investigadora', depto: 'Investigación', nombre: 'Sofía', avatar: '🔭', color: '#fb923c', hace: 'Investiga tu mercado y tu competencia en TrendTrack.' },
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

export const LUGARES = 13; // 0-3 fondo · 4 izquierda · 5 derecha · 6-8 adelante (7 al medio) · 9-12 la fila nueva
// las salas de siempre: las de los agentes, el café, la sala de estar y las de «Próximamente»
const FIJAS = [
  { id: 'coordinacion', tipo: 'coordinacion', lugar: 0 },
  { id: 'guion', tipo: 'guion', lugar: 1 },
  { id: 'arte', tipo: 'arte', lugar: 2 },
  { id: 'investigacion', tipo: 'investigacion', lugar: 3 },
  { id: 'video', tipo: 'video', lugar: 4 },
  { id: 'calidad', tipo: 'calidad', lugar: 5 },
  { id: 'cafe', tipo: 'cafe', lugar: 6, nombre: 'Café', color: '#f59e0b' },
  { id: 'sala', tipo: 'sala', lugar: 7, nombre: 'Sala de estar', color: '#a3e635' },
  { id: 'edicion', tipo: 'edicion', lugar: 8 },
  { id: 'landings', tipo: 'pronto', lugar: 9, nombre: 'Landings', color: '#38bdf8', pronto: true, href: '#/landings' },
  { id: 'embudo-whatsapp', tipo: 'pronto', lugar: 10, nombre: 'Embudo WhatsApp', color: '#22c55e', pronto: true, href: '#/embudo-whatsapp' },
  { id: 'sep', tipo: 'pronto', lugar: 11, nombre: 'S.E.P', color: '#e879f9', pronto: true, href: '#/sep' },
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
  const guardadas = cfg.zonas || {};
  const fijas = FIJAS.map((z) => {
    const a = AGENTES.find((x) => x.id === z.id);
    const g = guardadas[z.id] || {};
    return { ...z, nombre: g.nombre || z.nombre || a?.depto || z.id, color: g.color || z.color || a?.color || '#a3e635', lugar: Number.isInteger(g.lugar) ? g.lugar : z.lugar, agente: Boolean(a), ...(a ? { de: porId[a.id]?.nombre || a.nombre } : {}) };
  });
  const propias = (Array.isArray(cfg.propias) ? cfg.propias : []).map((z) => ({ id: z.id, tipo: TIPOS[z.tipo] ? z.tipo : 'escritorios', nombre: z.nombre, color: z.color, lugar: z.lugar, propia: true }));
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
  for (const f of FIJAS) if (!zonas[f.id] && actual.zonas?.[f.id]) zonas[f.id] = actual.zonas[f.id];
  guardarConfig({ oficina: { ...actual, zonas, propias } });
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

/** Los nombres y personajes que eligió el usuario. */
export function guardarAgentes(cambios = {}) {
  const actual = leerOficina();
  const agentes = { ...(actual.agentes || {}) };
  for (const a of AGENTES) {
    const c = cambios?.agentes?.[a.id];
    if (!c || typeof c !== 'object') continue;
    const nombre = String(c.nombre ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const avatar = String(c.avatar ?? '').trim().slice(0, 16);
    agentes[a.id] = { ...(agentes[a.id] || {}), ...(nombre ? { nombre } : {}), ...(avatar ? { avatar } : {}) };
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
  try {
    const { listarLotes } = await import('./imagen-ads/lotes.js');
    for (const l of listarLotes()) {
      const nombre = l.titulo || l.lote;
      const href = `#/imagenes/${l.lote}`;
      if (l.estado === 'corriendo' || l.estado === 'esperando') porId.arte.ahora.push(tarea({ titulo: `Anuncios de imagen: ${nombre}`, detalle: `${l.listas ?? 0} de ${l.total ?? '?'} listas${l.estado === 'esperando' ? ' · en la fila' : ''}`, href, cuando: l.actualizado || l.creado, vista: ultimoMedio(path.join(TEMP, l.lote), ['img'], `/archivos/imagen-ads/${encodeURIComponent(l.lote)}`) }));
      else if (l.estado === 'error' || (l.estado === 'pausado' && l.motivo !== 'detenido')) porId.arte.necesita.push(tarea({ titulo: `Anuncios de imagen: ${nombre} ${l.motivo === 'saldo' ? 'espera tu saldo' : 'se frenó'}`, detalle: null, href, cuando: l.actualizado || l.creado }));
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
      color: a.color,
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
    resumen: {
      trabajando: agentes.filter((a) => a.estado === 'trabajando').length,
      teNecesitan: todoLoQueNecesita.length,
      hechosHoy: agentes.reduce((s, a) => s + a.hechos.length, 0),
      aprendizajes: ap.total,
    },
  };
}


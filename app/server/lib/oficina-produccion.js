// LAS CADENAS DE PRODUCCIÓN DE LA OFICINA (2026-11-20, «una empresa digital operativa: cada agente ejecuta una parte
// real, entrega al siguiente, recibe correcciones»). Cada departamento es una fila de estaciones; cada estación es un
// agente con su parte del trabajo. El estado de cada estación SALE DE LO QUE LA APP REGISTRA (nada se simula):
//
//   video          los pasos del conductor de cada anuncio (temp/<slug>/app/conductor.json) y la sesión del guion
//   imagen         los lotes de anuncios de imagen: sus pasos y, dentro, las tandas de la IA (estrategia, prompts,
//                  revisión, ajustes) y cada pieza (temp/_img-*/app/imagen-ads/estado.json)
//   investigacion  la investigación de mercado y la de la competencia de cada producto
//   landing, whatsapp, analisis   todavía sin herramientas en la app: sus estaciones están quietas («en construcción»)
//
//   produccion() -> { departamentos: [{ id, nombre, pronto, estaciones: [{ id, nombre, hace, icono, agente }],
//                     trabajos: [{ id, titulo, href, estado, actual, estaciones: { [est]: estadoDeEstacion },
//                                  correcciones: { [est]: n }, error: { estacion, mensaje } | null, cuando }] }] }
//
// estadoDeEstacion: 'hecho' | 'trabajando' | 'revisando' | 'corrigiendo' | 'error' | 'pendiente'
// La pantalla compara un sondeo con el anterior para dibujar las transferencias (verde), las devoluciones de la
// revisión (naranja) y los errores (rojo): al recargar, el estado se reconstruye igual, sin animar lo ya pasado.
import fs from 'node:fs';
import path from 'node:path';
import { TEMP } from './rutas.js';
import { leerJSON } from './archivos.js';

// ---------------------------------------------------------------- los departamentos y sus estaciones

export const DEPARTAMENTOS = [
  {
    id: 'video',
    nombre: 'Anuncios de video',
    color: '#60a5fa',
    estaciones: [
      { id: 'v-guion', nombre: 'Guion y estructura', icono: 'documento', agente: 'guion', hace: 'Escribe el guion con tu investigación y tus aprendizajes; lo apruebas tú.' },
      { id: 'v-plan', nombre: 'Plan de producción', icono: 'reloj', agente: 'v-plan', hace: 'Revisa el guion, tu saldo, la voz y los tiempos antes de gastar.' },
      { id: 'v-imagenes', nombre: 'Storyboard e imágenes', icono: 'imagen', agente: 'arte', hace: 'Crea las personas y la imagen de cada escena.' },
      { id: 'v-produccion', nombre: 'Producción audiovisual', icono: 'play', agente: 'video', hace: 'Genera los clips, las voces y la música.' },
      { id: 'v-edicion', nombre: 'Edición y montaje', icono: 'tijera', agente: 'edicion', hace: 'Monta, subtitula y exporta el video.' },
      { id: 'v-revision', nombre: 'Revisión', icono: 'check', agente: 'calidad', hace: 'Revisa imágenes, clips y el video final; devuelve lo que hay que rehacer.' },
    ],
  },
  {
    id: 'imagen',
    nombre: 'Anuncios de imagen',
    color: '#f472b6',
    estaciones: [
      { id: 'i-investigacion', nombre: 'Investigación', icono: 'lupa', agente: 'i-investigacion', hace: 'Prepara el lote: tu producto, su investigación y las plantillas elegidas.' },
      { id: 'i-estrategia', nombre: 'Estrategia creativa', icono: 'varita', agente: 'i-estrategia', hace: 'Elige los ángulos, los dolores y la promesa de cada variación.' },
      { id: 'i-prompts', nombre: 'Ingeniería de prompts', icono: 'documento', agente: 'i-prompts', hace: 'Escribe el prompt de cada imagen y lo ajusta cuando la revisión lo devuelve.' },
      { id: 'i-generacion', nombre: 'Generación', icono: 'imagen', agente: 'i-generacion', hace: 'Genera cada imagen con el modelo conectado.' },
      { id: 'i-revision', nombre: 'Control de calidad', icono: 'check', agente: 'i-revision', hace: 'Revisa textos, producto y composición; devuelve las que no pasan.' },
      { id: 'i-entrega', nombre: 'Entrega', icono: 'caja', agente: 'i-entrega', hace: 'Guarda las aprobadas y arma el informe con el costo.' },
    ],
  },
  {
    id: 'investigacion',
    nombre: 'Investigación de mercado',
    color: '#fb923c',
    estaciones: [
      { id: 'r-recopilacion', nombre: 'Recopilación', icono: 'lupa', agente: 'investigacion', hace: 'Busca en internet, Reddit y reseñas lo que dice tu mercado.' },
      { id: 'r-competencia', nombre: 'Competencia', icono: 'grafico', agente: 'r-competencia', hace: 'Investiga en TrendTrack la tienda y los anuncios que más venden.' },
      { id: 'r-publico', nombre: 'Público', icono: 'personas', agente: 'r-publico', hace: 'Arma el avatar: quién compra, qué le duele y qué desea.' },
      { id: 'r-oportunidades', nombre: 'Oportunidades', icono: 'varita', agente: 'r-oportunidades', hace: 'Saca los conceptos para Meta (Andromeda) y los ángulos.' },
      { id: 'r-sintesis', nombre: 'Síntesis', icono: 'check', agente: 'r-sintesis', hace: 'Valida y entrega el informe completo.' },
    ],
  },
  {
    id: 'landing',
    nombre: 'Landing pages',
    color: '#38bdf8',
    pronto: true,
    href: '#/landings',
    estaciones: [
      { id: 'l-investigacion', nombre: 'Investigación de producto', icono: 'lupa', agente: 'l-investigacion' },
      { id: 'l-copy', nombre: 'Copywriting', icono: 'documento', agente: 'l-copy' },
      { id: 'l-conversion', nombre: 'Arquitectura de conversión', icono: 'grafico', agente: 'l-conversion' },
      { id: 'l-diseno', nombre: 'Diseño visual', icono: 'imagen', agente: 'l-diseno' },
      { id: 'l-desarrollo', nombre: 'Desarrollo', icono: 'codigo', agente: 'l-desarrollo' },
      { id: 'l-pruebas', nombre: 'Pruebas', icono: 'check', agente: 'l-pruebas' },
    ],
  },
  {
    id: 'whatsapp',
    nombre: 'Embudos de WhatsApp',
    color: '#22c55e',
    pronto: true,
    href: '#/embudo-whatsapp',
    estaciones: [
      { id: 'w-estrategia', nombre: 'Estrategia conversacional', icono: 'mensaje', agente: 'w-estrategia' },
      { id: 'w-mensajes', nombre: 'Redacción de mensajes', icono: 'documento', agente: 'w-mensajes' },
      { id: 'w-flujos', nombre: 'Diseño de flujos', icono: 'flujo', agente: 'w-flujos' },
      { id: 'w-automatizacion', nombre: 'Automatización', icono: 'codigo', agente: 'w-automatizacion' },
      { id: 'w-pruebas', nombre: 'Pruebas', icono: 'check', agente: 'w-pruebas' },
      { id: 'w-optimizacion', nombre: 'Optimización', icono: 'grafico', agente: 'w-optimizacion' },
    ],
  },
  {
    id: 'analisis',
    nombre: 'Análisis y optimización',
    color: '#c084fc',
    pronto: true,
    href: '#/sep',
    estaciones: [
      { id: 'a-metricas', nombre: 'Métricas', icono: 'grafico', agente: 'a-metricas' },
      { id: 'a-rendimiento', nombre: 'Rendimiento', icono: 'torta', agente: 'a-rendimiento' },
      { id: 'a-problemas', nombre: 'Problemas', icono: 'lupa', agente: 'a-problemas' },
      { id: 'a-propuestas', nombre: 'Propuestas', icono: 'varita', agente: 'a-propuestas' },
      { id: 'a-reporte', nombre: 'Reporte', icono: 'documento', agente: 'a-reporte' },
    ],
  },
];

// ---------------------------------------------------------------- video: los pasos del conductor -> su estación

const PASO_A_ESTACION = [
  [/^(revision|control)/, 'v-revision'],
  [/^(montaje|recorte|render|ganchos|informe)/, 'v-edicion'],
  [/^(persona|imagenes$|pares)/, 'v-imagenes'],
  [/^(bloques|videos|imagenes-y-videos|voces|voz-historia|musica|cancion|elegir-cancion)/, 'v-produccion'],
  [/^(validar|saldo|voz$|ventanas|preparar|duraciones)/, 'v-plan'],
];
export function estacionDelPaso(paso) {
  const p = String(paso || '');
  for (const [re, e] of PASO_A_ESTACION) if (re.test(p)) return e;
  return 'v-plan';
}
const ORDEN_VIDEO = DEPARTAMENTOS[0].estaciones.map((e) => e.id);

function trabajoDeVideo(a) {
  const c = leerJSON(path.join(TEMP, a.slug, 'app', 'conductor.json'));
  const estaciones = Object.fromEntries(ORDEN_VIDEO.map((e) => [e, 'pendiente']));
  const correcciones = {};
  let actual = 'v-guion';
  let error = null;
  if (!c) {
    // todavía en el guion: escribiéndolo, cambiándolo o esperando tu aprobación
    estaciones['v-guion'] = a.estado === 'error' ? 'error' : a.etapa === 'aprobar' ? 'hecho' : a.etapa === 'cambiando' ? 'corrigiendo' : 'trabajando';
    if (a.estado === 'error') error = { estacion: 'v-guion', mensaje: a.error || 'El guion no salió.' };
  } else {
    estaciones['v-guion'] = 'hecho';
    for (const p of c.pasos || []) {
      const e = estacionDelPaso(p.id);
      const ahora = p.estado === 'error' ? 'error' : p.estado === 'corriendo' || p.id === c.paso && c.estado === 'corriendo' ? (e === 'v-revision' ? 'revisando' : 'trabajando') : p.estado === 'hecho' ? 'hecho' : null;
      // una estación con varios pasos: manda lo que está pasando (error > trabajando > hecho)
      const rango = { error: 4, revisando: 3, trabajando: 3, corrigiendo: 3, hecho: 1, pendiente: 0 };
      if (ahora && rango[ahora] >= rango[estaciones[e]]) estaciones[e] = ahora;
      if (p.estado === 'error') error = { estacion: e, mensaje: p.error?.mensaje || 'Este paso se frenó.' };
    }
    actual = c.paso ? estacionDelPaso(c.paso) : actual;
    if (c.estado === 'listo') actual = 'v-edicion';
    // lo que la revisión devolvió (conductor.rehechos: lo rehecho por cada toma, clip o bloque)
    for (const [k, n] of Object.entries(c.rehechos || {})) {
      const destino = /bloque|clip|video|habla/.test(k) ? 'v-produccion' : /montaje|final|render/.test(k) ? 'v-edicion' : 'v-imagenes';
      correcciones[destino] = (correcciones[destino] || 0) + (Number(n) || 0);
    }
    if (c.estado === 'pausado' && c.paso === 'elegir-cancion') estaciones['v-produccion'] = 'esperando';
  }
  return {
    id: a.slug,
    titulo: a.tituloGuion || a.titulo || a.slug,
    detalle: a.estiloNombre || '',
    href: c ? `#/anuncio/${a.slug}/produccion` : `#/nuevo?producto=${encodeURIComponent(a.productoId || '')}&paso=2&anuncios=${a.slug}`,
    // lo que dejaste para después queda «Pausado» (no te pide nada)
    estado: a.estado === 'listo' ? 'listo' : a.paraDespues && (error || a.teNecesita) ? 'pausado' : error ? 'error' : a.teNecesita ? 'te-necesita' : 'activo',
    paraDespues: Boolean(a.paraDespues && (error || a.teNecesita)),
    actual,
    estaciones,
    correcciones,
    error,
    cuando: a.fecha,
  };
}

// ---------------------------------------------------------------- imagen: los pasos del lote y sus tandas

function trabajoDeLote(l) {
  const dir = path.join(TEMP, l.lote, 'app');
  const c = leerJSON(path.join(dir, 'conductor.json'));
  const est = leerJSON(path.join(dir, 'imagen-ads', 'estado.json'));
  const estaciones = { 'i-investigacion': 'pendiente', 'i-estrategia': 'pendiente', 'i-prompts': 'pendiente', 'i-generacion': 'pendiente', 'i-revision': 'pendiente', 'i-entrega': 'pendiente' };
  const correcciones = {};
  let error = null;
  const paso = (id) => (c?.pasos || []).find((p) => p.id === id);
  const marca = (e, p) => {
    if (!p) return;
    if (p.estado === 'hecho') estaciones[e] = 'hecho';
    else if (p.estado === 'error') {
      estaciones[e] = 'error';
      error = { estacion: e, mensaje: p.error?.mensaje || 'Este paso se frenó.' };
    } else if (p.estado === 'corriendo' || c?.paso === p.id) estaciones[e] = 'trabajando';
  };
  marca('i-investigacion', paso('preparar'));
  marca('i-estrategia', paso('estrategia'));
  const anuncios = paso('anuncios');
  const piezas = Object.values(est?.piezas || {});
  const tandas = Object.values(est?.tandas || {});
  const enCurso = (tipo) => tandas.some((t) => t?.tipo === tipo && t.estado === 'en-curso');
  if (tandas.some((t) => t?.tipo === 'prompts' && t.estado === 'hecha') || piezas.length) estaciones['i-prompts'] = 'hecho';
  if (enCurso('prompts')) estaciones['i-prompts'] = 'trabajando';
  if (enCurso('ajuste')) estaciones['i-prompts'] = 'corrigiendo';
  if (enCurso('estrategia')) estaciones['i-estrategia'] = 'trabajando';
  const listas = piezas.filter((p) => p.resultado === 'listo').length;
  const generando = piezas.some((p) => !p.resultado && p.fase !== 'final');
  if (listas) estaciones['i-generacion'] = 'hecho';
  if (generando && anuncios?.estado !== 'hecho') estaciones['i-generacion'] = 'trabajando';
  if (piezas.some((p) => p.revision)) estaciones['i-revision'] = 'hecho';
  if (enCurso('revision')) estaciones['i-revision'] = 'revisando';
  // lo que la revisión no aprobó y volvió a los prompts (un ajuste o una ronda nueva de la pieza)
  const devueltas = piezas.filter((p) => p.revision?.ok === false || (p.ronda || 1) > 1).length;
  if (devueltas) correcciones['i-prompts'] = devueltas;
  const fallos = piezas.filter((p) => p.resultado === 'sin-imagen').length;
  if (fallos) correcciones['i-generacion'] = fallos;
  marca('i-entrega', paso('informe'));
  if (anuncios?.estado === 'error') {
    estaciones['i-generacion'] = 'error';
    error = { estacion: 'i-generacion', mensaje: anuncios.error?.mensaje || 'La generación se frenó.' };
  }
  const orden = ['i-entrega', 'i-revision', 'i-generacion', 'i-prompts', 'i-estrategia', 'i-investigacion'];
  const actual = orden.find((e) => ['trabajando', 'revisando', 'corrigiendo', 'error'].includes(estaciones[e])) || (c?.estado === 'listo' ? 'i-entrega' : 'i-investigacion');
  return {
    id: l.lote,
    titulo: l.titulo || l.lote,
    detalle: `${listas} de ${l.total ?? piezas.length} listas`,
    href: `#/imagenes/${l.lote}`,
    estado: c?.estado === 'listo' || l.estado === 'listo' ? 'listo' : error || l.estado === 'error' ? 'error' : l.estado === 'pausado' ? 'pausado' : 'activo',
    actual,
    estaciones,
    correcciones,
    error,
    cuando: l.actualizado || l.creado || null,
  };
}

// ---------------------------------------------------------------- investigación de mercado y competencia

function trabajoDeInvestigacion(p, comp) {
  const t = leerJSON(path.join(TEMP, '_productos', p.id, 'investigacion', 'tarea.json'));
  let texto = '';
  try {
    texto = fs.readFileSync(path.join(TEMP, '_productos', p.id, 'investigacion', 'investigacion.json'), 'utf8');
  } catch {
    texto = '';
  }
  const lista = p.estado === 'lista';
  const estaciones = {
    'r-recopilacion': p.estado === 'investigando' ? 'trabajando' : lista ? 'hecho' : p.estado === 'error' ? 'error' : 'pendiente',
    'r-competencia': comp?.estado === 'investigando' ? 'trabajando' : comp?.estado === 'lista' ? 'hecho' : comp?.estado === 'error' ? 'error' : 'pendiente',
    'r-publico': lista && /avatar/i.test(texto) ? 'hecho' : 'pendiente',
    'r-oportunidades': lista && /andromeda|conceptos/i.test(texto) ? 'hecho' : 'pendiente',
    'r-sintesis': lista ? 'hecho' : 'pendiente',
  };
  const error = p.estado === 'error' ? { estacion: 'r-recopilacion', mensaje: t?.error?.mensaje || 'La investigación no terminó.' } : comp?.estado === 'error' ? { estacion: 'r-competencia', mensaje: 'La investigación de la competencia no terminó.' } : null;
  const trabajando = Object.entries(estaciones).find(([, v]) => v === 'trabajando')?.[0];
  return {
    id: `inv-${p.id}`,
    titulo: `Investigación de ${p.nombre}`,
    detalle: p.pais || '',
    href: `#/investigacion/${p.id}`,
    estado: error ? 'error' : lista && comp?.estado !== 'investigando' ? 'listo' : 'activo',
    actual: trabajando || (lista ? 'r-sintesis' : 'r-recopilacion'),
    estaciones,
    correcciones: {},
    error,
    cuando: t?.fin || t?.inicio || p.fecha || null,
  };
}

// ---------------------------------------------------------------- todo junto

const RECIENTE = 3 * 24 * 3600000; // lo terminado de los últimos 3 días se sigue viendo (en «Terminados»)

export async function produccion() {
  const deps = Object.fromEntries(DEPARTAMENTOS.map((d) => [d.id, { ...d, trabajos: [] }]));
  const reciente = (cuando) => !cuando || Date.now() - Date.parse(cuando) < RECIENTE;
  try {
    const { listarAnunciosNuevos } = await import('./anuncios-nuevos.js');
    for (const a of listarAnunciosNuevos()) {
      if (a.modoPrueba && !process.env.ANUNCIOS_MODO_PRUEBA) continue;
      if (a.estado === 'listo' && !reciente(a.fecha)) continue;
      deps.video.trabajos.push(trabajoDeVideo(a));
    }
  } catch {
    /* sin anuncios */
  }
  try {
    const { listarLotes } = await import('./imagen-ads/lotes.js');
    for (const l of listarLotes()) {
      if (l.estado === 'borrador') continue;
      if (l.estado === 'listo' && !reciente(l.terminado || l.actualizado)) continue;
      deps.imagen.trabajos.push(trabajoDeLote(l));
    }
  } catch {
    /* sin lotes */
  }
  try {
    const inv = await import('./investigacion.js');
    const comp = await import('./competencia.js');
    for (const p of inv.listar()) {
      const c = comp.estado(p.id)?.tarea;
      if (p.estado === 'sin' && (!c || c.estado === 'sin')) continue;
      const t = trabajoDeInvestigacion(p, c);
      if (t.estado === 'listo' && !reciente(t.cuando)) continue;
      deps.investigacion.trabajos.push(t);
    }
  } catch {
    /* sin investigaciones */
  }
  // lo activo primero, después lo que espera o falló, y lo terminado al final (más nuevo arriba)
  const peso = { activo: 0, 'te-necesita': 1, error: 1, pausado: 2, listo: 3 };
  for (const d of Object.values(deps)) d.trabajos.sort((x, y) => (peso[x.estado] ?? 2) - (peso[y.estado] ?? 2) || String(y.cuando || '').localeCompare(String(x.cuando || '')));
  return { departamentos: DEPARTAMENTOS.map((d) => ({ ...deps[d.id], trabajos: deps[d.id].trabajos.slice(0, 20) })) };
}

// (para las pruebas: armar un trabajo desde sus archivos)
export const _paraPruebas = { trabajoDeVideo, trabajoDeLote };

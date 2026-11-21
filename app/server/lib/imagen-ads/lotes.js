// Los lotes de ANUNCIOS DE IMAGEN como los ve la app: crear uno (borrador), listarlos, los productos que se pueden usar,
// los pedidos del usuario (Regenerar, "Escribir de nuevo"), lo que se hereda del lote anterior del mismo producto y el
// informe (ESPECIFICACION-imagen-ads.md §4, §9 y §12).
//
//   opciones() · productosConFoto() · crearLote(cuerpo) · listarLotes() · leerBrief(carpeta) · esLoteDeEstaApp(lote)
//   agregarPedido(lote, cuerpo) · pedidosSinTerminar(carpeta) · asegurarPedidos(lote)
//   loteAnterior(productoId, excepto) · usadosDe(productoId, excepto) · armarInforme(carpeta, brief) · piezasPorHacer(carpeta, brief)
//
// Solo los lotes de ESTA app (una app de prueba en otro puerto tiene los suyos: brief.puerto, como los videos).
import fs from 'node:fs';
import { resumenDe, aMarkdown } from '../investigacion.js';
import { aMarkdown as competenciaAMarkdown, ganchosValidados } from '../competencia.js';
import crypto from 'node:crypto';
import * as funcionan from '../funcionan.js';
import * as bibliotecaReferencias from './biblioteca-referencias.js';
import path from 'node:path';
import { TEMP, PUERTO_DE_PRUEBA, esDeEstaApp } from '../rutas.js';
import { leerJSON, existe, listar } from '../archivos.js';
import { leerProducto, rutaFoto, urlFoto, idValido, PRODUCTOS, ErrorApp, aKebab, leerFicha } from '../productos.js';
import { leerConfig } from '../config.js';
import { modoPrueba } from '../procesos.js';
import * as gasto from '../gasto.js';
import { leerSkill } from './verificar.js';
import { leerEstado, resumenDelLote } from './estado.js';
import { PEDIDO_TERMINADO } from './planificador.js';
import { POR_ID, escenasDe, catalogoParaLaPantalla } from './catalogo-plantillas.js';
import * as plantillasRef from './plantillas-referencia.js';
import { repartoDeFormatos } from './desde0.js';
import {
  FAMILIA, RE_LOTE, RE_PIEZA, RE_V, R, POSICIONES, NOMBRE_POSICION, MAXIMO_VARIACIONES, MAXIMO_REFERENCIAS, carpetaDe, guardarJSON, idsDelLote,
  vDe, formatoDe, piezaId, ordenDePiezas, ordenDeV, fotoDelLote,
} from './disco.js';

const IDIOMAS = ['es', 'en', 'pt'];
const ahora = () => new Date().toISOString();

// ---------------------------------------------------------------- lo que elige el formulario

/** GET /api/imagen-ads/opciones */
export function opciones() {
  const { angulos } = leerSkill();
  let idioma = 'es';
  try {
    const p = leerConfig().preferencias?.idioma;
    if (IDIOMAS.includes(p)) idioma = p;
  } catch {
    /* sin ajustes: espanol */
  }
  return {
    angulos: [...angulos.values()].map((a) => ({ id: a.id, nombre: a.nombre, queAtaca: a.que_ataca || '' })),
    posiciones: POSICIONES.map((id) => ({ id, nombre: NOMBRE_POSICION[id] })),
    maximo: MAXIMO_VARIACIONES,
    maxReferencias: MAXIMO_REFERENCIAS,
    idiomaPorDefecto: idioma,
    // las plantillas (la app dibuja los textos; solo las de escena usan el modelo de imagen)
    plantillas: catalogoParaLaPantalla(),
    // las PLANTILLAS de imagen (2026-11-18s): anuncios validados que van al modelo como referencia
    plantillasReferencia: plantillasRef.catalogo(),
  };
}

// ---------------------------------------------------------------- los lotes en disco

export const leerBrief = (carpeta) => leerJSON(R.brief(carpeta));

/** ¿Es un lote de anuncios de imagen (por su nombre y su brief)? */
export function esLote(lote) {
  if (typeof lote !== 'string' || !RE_LOTE.test(lote)) return false;
  const b = leerBrief(carpetaDe(lote));
  return b?.familia === FAMILIA;
}

/** ¿Es un lote de esta app (y no de una app de prueba en otro puerto, o al reves)? */
export const esLoteDeEstaApp = (lote) => esLote(lote) && esDeEstaApp(leerBrief(carpetaDe(lote)));

/** Los lotes de esta app (sus nombres), del mas nuevo al mas viejo. */
export function lotesDeEstaApp() {
  return listar(TEMP)
    .filter((n) => RE_LOTE.test(n))
    .map((n) => ({ n, b: leerBrief(carpetaDe(n)) }))
    .filter((x) => x.b?.familia === FAMILIA && esDeEstaApp(x.b))
    .sort((a, b) => String(b.b.creado || '').localeCompare(String(a.b.creado || '')))
    .map((x) => x.n);
}

/** GET /api/imagen-ads */
export function listarLotes() {
  return lotesDeEstaApp().map((lote) => {
    const carpeta = carpetaDe(lote);
    return resumenDelLote({ lote, carpeta, brief: leerBrief(carpeta), conductor: leerJSON(R.conductor(carpeta)) });
  });
}

/** slug -> "Anuncios de imagen: Crema Luna" (para decir a cual espera un anuncio en la fila). */
export function titulosDeLotes() {
  return new Map(
    listar(TEMP)
      .filter((n) => RE_LOTE.test(n))
      .map((n) => [n, leerBrief(carpetaDe(n))])
      .filter(([, b]) => b?.familia === FAMILIA)
      .map(([n, b]) => [n, `Anuncios de imagen: ${b.titulo || b.datos?.nombre || 'sin nombre'}`])
  );
}

// ---------------------------------------------------------------- los productos

const porNumero = (a, b) => (Number(a.match(/(\d+)\./)?.[1]) || 0) - (Number(b.match(/(\d+)\./)?.[1]) || 0);

/** El ultimo lote de un producto (de esta app). Con `listo`, solo uno que haya terminado. */
function ultimoLoteDe(productoId, { excepto = null, listo = false } = {}) {
  for (const lote of lotesDeEstaApp()) {
    if (lote === excepto) continue;
    const c = carpetaDe(lote);
    const b = leerBrief(c);
    if (b?.productoId !== productoId) continue;
    if (listo && leerJSON(R.conductor(c))?.estado !== 'listo') continue;
    return { lote, carpeta: c, brief: b };
  }
  return null;
}

/**
 * GET /api/imagen-ads/productos: los productos de esta app que tienen al menos una foto, del más nuevo al más viejo.
 * `creado` es solo para mostrar: dos productos con el mismo nombre se distinguen por su fecha.
 */
export function productosConFoto() {
  const salida = [];
  for (const id of listar(PRODUCTOS)) {
    if (!idValido(id)) continue;
    const p = leerProducto(id);
    if (!p || !esDeEstaApp(p)) continue;
    const fotos = (p.fotos || [])
      .slice()
      .sort(porNumero)
      .map((f) => ({ n: Number(f.match(/(\d+)\./)?.[1]), archivo: f }))
      .filter((f) => Number.isInteger(f.n) && rutaFoto(id, f.n))
      .map((f) => ({ n: f.n, url: urlFoto(id, f.n), deLaPagina: (p.fotosDeLaPagina || []).includes(f.archivo) }));
    if (!fotos.length) continue;
    const ficha = leerJSON(path.join(PRODUCTOS, id, 'ficha.json'));
    const ultimo = ultimoLoteDe(id);
    salida.push({
      id,
      nombre: ficha?.nombre || p.nombre || 'Producto sin nombre',
      fotos,
      fotoSugerida: (fotos.find((f) => !f.deLaPagina) || fotos[0]).n,
      ultimoLote: ultimo ? { datos: ultimo.brief.datos || {} } : null,
      // su investigación de mercado, si ya la tiene (sección «Investigación de mercado»): los lotes la usan sola
      investigacion: resumenDe(id),
      creado: p.creado || null,
    });
  }
  return salida.sort((a, b) => String(b.creado).localeCompare(String(a.creado)));
}

// ---------------------------------------------------------------- crear un lote (borrador)

function texto(v, max, campo, { obligatorio = false } = {}) {
  if (v === undefined || v === null) v = '';
  if (typeof v !== 'string' && typeof v !== 'number') throw new ErrorApp(400, `Revisa el campo «${campo}».`);
  const t = String(v).trim();
  if (obligatorio && !t) throw new ErrorApp(400, `Falta «${campo}».`);
  if (t.length > max) throw new ErrorApp(400, `«${campo}» es demasiado largo (hasta ${max} caracteres).`);
  return t;
}

function fechaCarpeta(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** POST /api/imagen-ads: valida todo y reserva la carpeta del lote (borrador: todavia no se paga nada). */
export function crearLote(cuerpo = {}) {
  const productoId = String(cuerpo.productoId || '');
  const producto = idValido(productoId) ? leerProducto(productoId) : null;
  if (!producto || !esDeEstaApp(producto)) throw new ErrorApp(404, 'No encuentro ese producto.');
  const fotoProducto = Number(cuerpo.fotoProducto ?? 1);
  if (!Number.isInteger(fotoProducto) || !rutaFoto(productoId, fotoProducto)) throw new ErrorApp(400, 'Elige cuál es la foto de tu producto.');
  const d = cuerpo.datos && typeof cuerpo.datos === 'object' ? cuerpo.datos : {};
  const datos = {
    nombre: texto(d.nombre, 120, 'Nombre', { obligatorio: true }),
    publico: texto(d.publico, 300, 'Público'),
    precio: texto(d.precio, 40, 'Precio'),
    moneda: texto(d.moneda, 12, 'Moneda'),
    cta: texto(d.cta, 160, 'Llamado a la acción'),
    pais: texto(d.pais, 60, 'País', { obligatorio: true }),
    idioma: IDIOMAS.includes(d.idioma) ? d.idioma : 'es', // la pantalla ya no lo pregunta: siempre en español
    adicional: texto(d.adicional, 4000, 'Información adicional'),
    angulo: d.angulo === null || d.angulo === undefined || d.angulo === '' ? null : String(d.angulo),
  };
  if (!datos.idioma) throw new ErrorApp(400, 'Elige el idioma de los textos (español, inglés o portugués).');
  if (datos.angulo && !leerSkill().angulos.has(datos.angulo)) throw new ErrorApp(400, 'Ese ángulo no está en la lista.');
  const cantidad = Number(cuerpo.cantidad);
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAXIMO_VARIACIONES) throw new ErrorApp(400, `La cantidad va de 1 a ${MAXIMO_VARIACIONES}.`);
  const f = Array.isArray(cuerpo.formatos) ? [...new Set(cuerpo.formatos.map(String))] : ['1:1'];
  if (!(f.length === 1 && f[0] === '1:1') && !(f.length === 2 && f.includes('1:1') && f.includes('9:16'))) throw new ErrorApp(400, 'Elige «Solo cuadrado 1:1» o «Cuadrado + vertical 9:16».');
  const formatos = f.length === 2 ? ['1:1', '9:16'] : ['1:1'];
  let logo = null;
  // (con plantillas, «Variantes» no aplica: las plantillas son diseños propios)
  if (cuerpo.logo && typeof cuerpo.logo === 'object') {
    const posicion = cuerpo.logo.posicion || 'arriba-centro';
    if (!POSICIONES.includes(posicion)) throw new ErrorApp(400, 'Elige dónde va el logo.');
    logo = { posicion, archivo: null };
  }
  fs.mkdirSync(TEMP, { recursive: true });
  const base = `_img-${aKebab(datos.nombre, 24) || 'lote'}-${fechaCarpeta()}`;
  let lote = null;
  for (let i = 1; i < 500 && !lote; i++) {
    const nombre = i === 1 ? base : `${base}-${i}`;
    try {
      fs.mkdirSync(carpetaDe(nombre)); // sin recursive: si ya existe, falla y se prueba el siguiente
      lote = nombre;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }
  if (!lote) throw new ErrorApp(409, 'No pude reservar la carpeta del lote. Vuelve a intentarlo en un minuto.');
  const carpeta = carpetaDe(lote);
  fs.mkdirSync(R.entrada(carpeta), { recursive: true });
  const brief = {
    slug: lote,
    estilo: FAMILIA,
    familia: FAMILIA,
    titulo: datos.nombre,
    productoId,
    fotoProducto,
    datos,
    cantidad,
    formatos,
    referencias: [],
    // «Nuevos» (de cero, con los ganchos validados) o «Variantes» (de creativos que ya te funcionaron)
    modo: cuerpo.modo === 'variantes' ? 'variantes' : 'nuevos',
    // las referencias (por número) que son del MISMO producto (un creativo tuyo que funciona): conservan hasta la paleta
    referenciasPropias: Array.isArray(cuerpo.referenciasPropias) ? [...new Set(cuerpo.referenciasPropias.map(Number).filter((k) => Number.isInteger(k) && k >= 1 && k <= 50))] : [],
    // (2026-11-19h) el CONCEPTO creativo de cada referencia de «Variantes» (por qué vende, lo escribiste en «Lo que me
    // funciona»), en el mismo orden: la variante lo conserva y cambia la ejecución y el título
    conceptosReferencias: Array.isArray(cuerpo.conceptosReferencias) ? cuerpo.conceptosReferencias.slice(0, 50).map((t) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, 500)) : [],
    // Solo «Variantes» copia el diseño de sus referencias (y el modelo de imagen las ve). «Nuevos» siempre crea
    // diseños nuevos: la opción «Variar solo los títulos» de Nuevos hacía lo mismo que Variantes y se quitó (2026-11-16).
    fiel: cuerpo.modo === 'variantes' || cuerpo.rapido !== false,
    // (2026-11-20) el AGENTE DE VARIACIONES (el prompt maestro del usuario, skill agente-variaciones.md): solo en
    // «Variantes» y siempre con la estrategia de la IA (el modo rápido no analiza el ganador)
    // (2026-11-20b) …y también SIN referencia, desde la investigación de mercado («Nuevos»): el agente hace todo
    ...(cuerpo.agente === 'variaciones' ? { agente: 'variaciones' } : {}),
    // (2026-11-21) MODO NUEVO DESDE 0: las 6 zonas y los 8 formatos (imagen-ads/desde0.js), con revisión de la IA
    ...(cuerpo.modo !== 'variantes' && cuerpo.desde0 === true && cuerpo.agente !== 'variaciones' ? { desde0: { formatos: [] }, modo: 'nuevos', fiel: false } : {}),
    // (2026-11-21) MODO REPLICAR VALIDADO: el anuncio validado EXACTO; solo cambian modelo, escenario, pose y titular
    ...(cuerpo.modo === 'variantes' && cuerpo.replicar === true && cuerpo.agente !== 'variaciones' ? { replicar: true } : {}),
    // Ya no se eligen títulos antes (2026-11-16: «elimina lo de seleccionar títulos»): los pone la app o la IA.
    elegirTitulos: false,
    // Modo rápido por defecto («como pedirle a ChatGPT que me las varíe», imagen-ads/rapido.js); rapido: false = con
    // la estrategia de la IA (más lento).
    rapido: cuerpo.agente === 'variaciones' || (cuerpo.modo !== 'variantes' && cuerpo.desde0 === true) ? false : cuerpo.modo === 'variantes' && cuerpo.replicar === true ? true : cuerpo.rapido !== false,
    // la investigación de mercado (entrada/investigacion.md o .pdf), si subiste una
    investigacion: null,
    // PLANTILLAS (2026-11-17p): la app dibuja los textos; solo las de escena usan el modelo de imagen (sin texto)
    ...(plantillasDelCuerpo(cuerpo) && cuerpo.agente !== 'variaciones' && cuerpo.desde0 !== true ? { plantillas: plantillasDelCuerpo(cuerpo), fiel: false, modo: 'nuevos' } : {}),
    // PLANTILLAS DE REFERENCIA (2026-11-18s): las elegidas (o una mezcla variada) van al modelo como referencia; el
    // modelo mantiene su diseño y cambia el producto, los textos y la paleta (rapido.js, modo «copiar»)
    ...(cuerpo.plantillasReferencia && !plantillasDelCuerpo(cuerpo) && cuerpo.agente !== 'variaciones' && cuerpo.desde0 !== true ? { desdePlantillas: true, fiel: true, rapido: true, modo: 'nuevos' } : {}),
    logo,
    creado: ahora(),
    ...(PUERTO_DE_PRUEBA ? { puerto: PUERTO_DE_PRUEBA } : {}),
  };
  // la investigación de mercado del producto (si ya la tiene y no se pidió sin ella) va al lote: la estrategia la lee
  if (cuerpo.usarInvestigacion !== false) {
    const md = aMarkdown(productoId);
    if (md) {
      // (con lo esencial de la investigación competitiva de TrendTrack, si la tiene)
      fs.writeFileSync(R.investigacion(carpeta, 'md'), md + competenciaAMarkdown(productoId));
      brief.investigacion = 'entrada/investigacion.md';
      brief.investigacionDelProducto = true;
    }
    // con plantillas y sin formatos elegidos: los que propuso la investigación, con sus textos (el costo cuenta esos)
    const propuestas = resumenDe(productoId)?.propuestas || [];
    if (brief.plantillas && !brief.video && !brief.plantillas.elegidas.length && propuestas.length) brief.plantillas = { ...brief.plantillas, elegidas: propuestas, deLaInvestigacion: true };
  }
  if (brief.desde0) {
    // el reparto de formatos lo decide la app (máx. 3 iguales, pregunta y respuesta máx. 1; bodegón solo con ingredientes)
    const f = leerFicha(productoId) || {};
    brief.desde0 = { formatos: repartoDeFormatos(cantidad, { conIngredientes: Array.isArray(f.ingredientes) && f.ingredientes.length >= 2, semilla: lote }) };
  }
  if (brief.desdePlantillas) {
    // (sin elegidas: una mezcla variada, con las de productos relacionados primero)
    // (los temas del video, si el lote sale de un video, van primero)
    const temas = [...new Set([...(Array.isArray(cuerpo.temasExtra) ? cuerpo.temasExtra.map(String) : []), ...plantillasRef.temasDeProducto(productoId)])];
    const ids = plantillasRef.elegir(cantidad, cuerpo.plantillasReferencia?.elegidas, { temas });
    brief.plantillasReferencia = ids;
    brief.referencias = plantillasRef.copiarAlLote(carpeta, ids);
  }
  // «Nuevos»: tus anuncios ya validados («Me funciona», los de este producto primero, y tu biblioteca de referencias)
  // van al lote como guía de lo que funciona. La IA los estudia; no los copia (eso es «Variantes»).
  if (brief.modo === 'nuevos' && !brief.desdePlantillas) {
    const validados = prepararValidados(carpeta, productoId);
    if (validados.length) brief.validados = validados;
  }
  // los ganchos ya validados de la investigación con TrendTrack: los títulos juegan con ellos
  const ganchos = ganchosValidados(productoId);
  if (ganchos.length) {
    guardarJSON(path.join(R.entrada(carpeta), 'ganchos.json'), { ganchos });
    brief.ganchos = 'entrada/ganchos.json';
  }
  guardarJSON(R.brief(carpeta), brief);
  return { lote, brief };
}

/** { elegidas: [ids], kitElegido? } si el formulario pidió plantillas (cuerpo.plantillas), o null. */
function plantillasDelCuerpo(cuerpo) {
  const p = cuerpo?.plantillas;
  if (!p || typeof p !== 'object') return null;
  const elegidas = (Array.isArray(p.elegidas) ? p.elegidas : []).map(String).filter((x) => POR_ID.has(x));
  const kit = p.kit && typeof p.kit === 'object' ? p.kit : null;
  return { elegidas: [...new Set(elegidas)], ...(kit ? { kitElegido: kit } : {}) };
}

// Cuántos anuncios validados van a un lote de «Nuevos»: los de «Me funciona» hasta MAX_FUNCIONAN (los del mismo
// producto primero) y de la biblioteca de referencias lo que falte hasta MAX_VALIDADOS (mirarlos le cuesta tiempo a la IA).
const MAX_FUNCIONAN = 6;
const MAX_VALIDADOS = 8;
const MAX_CATALOGO = 4; // (2026-11-20t) plantillas del catálogo que van como guía interna en «Nuevos»

/**
 * Copia al lote (entrada/validados/) los anuncios ya validados del usuario y devuelve
 * [{ archivo: 'entrada/validados/A01.png', origen: 'me-funciona'|'biblioteca', mismoProducto, producto?, titulo? }].
 * La misma imagen nunca va dos veces (una referencia de «Variantes» también pudo quedar en la biblioteca).
 */
export function prepararValidados(carpeta, productoId) {
  let deFunciona = [];
  try {
    const todos = funcionan.listar();
    deFunciona = [...todos.filter((x) => x.productoId === productoId), ...todos.filter((x) => x.productoId !== productoId)].slice(0, MAX_FUNCIONAN);
  } catch {
    /* sin lista: sigue con la biblioteca */
  }
  let deBiblioteca = [];
  try {
    deBiblioteca = bibliotecaReferencias.conRuta();
  } catch {
    /* sin biblioteca */
  }
  // (2026-11-20t) el CATÁLOGO de plantillas validadas (app/plantillas-referencia/): también va como guía interna en
  // «Nuevos» (desde la investigación, el agente de variaciones, lo que pide la coordinadora). Las de productos como el
  // tuyo primero y de tipos distintos. No se muestran: la IA las estudia (no las copia) y lo tuyo pesa más.
  let deCatalogo = [];
  try {
    const temas = plantillasRef.temasDeProducto(productoId);
    deCatalogo = plantillasRef.elegir(MAX_CATALOGO, [], { temas }).map((id) => ({ abs: plantillasRef.rutaDeArchivo(`${id}.jpg`), ficha: plantillasRef.fichaDe(id), temas }));
  } catch {
    /* sin catálogo */
  }
  const propios = [
    ...deFunciona.map((x) => ({ abs: funcionan.rutaDeImagen(x), origen: 'me-funciona', mismoProducto: x.productoId === productoId, producto: x.producto || '', titulo: x.titulo || '', tipo: x.tipo })),
    ...deBiblioteca.map((x) => ({ abs: x.abs, origen: 'biblioteca', mismoProducto: false })),
  ].filter((x) => x.abs);
  const delCatalogo = deCatalogo
    .filter((x) => x.abs && x.ficha)
    .map((x) => ({ abs: x.abs, origen: 'catalogo', mismoProducto: false, plantilla: x.ficha.id, nombre: x.ficha.nombre || '', familia: x.ficha.familia || '', titular: x.ficha.titular || '', relacionada: (x.ficha.temas || []).some((t) => t !== 'hombres' && x.temas.includes(t)) }));
  // lo tuyo primero, pero siempre quedan lugares para el catálogo (MAX_CATALOGO)
  const candidatos = [...propios.slice(0, MAX_VALIDADOS - Math.min(MAX_CATALOGO, delCatalogo.length)), ...delCatalogo, ...propios.slice(MAX_VALIDADOS - Math.min(MAX_CATALOGO, delCatalogo.length))];
  const vistos = new Set();
  const salida = [];
  for (const c of candidatos) {
    if (salida.length >= MAX_VALIDADOS) break;
    let huella;
    try {
      huella = crypto.createHash('sha1').update(fs.readFileSync(c.abs)).digest('hex');
    } catch {
      continue;
    }
    if (vistos.has(huella)) continue;
    vistos.add(huella);
    const ext = path.extname(c.abs).toLowerCase() === '.png' ? 'png' : 'jpg';
    const rel = `entrada/validados/A${String(salida.length + 1).padStart(2, '0')}.${ext}`;
    try {
      fs.mkdirSync(path.join(carpeta, 'entrada', 'validados'), { recursive: true });
      fs.copyFileSync(c.abs, path.join(carpeta, rel));
    } catch {
      continue;
    }
    const { abs, ...datos } = c;
    salida.push({ archivo: rel, ...datos });
  }
  return salida;
}

/**
 * Lo que le falta a un borrador para empezar (null si nada). Lo pregunta el conductor antes de crear conductor.json
 * (familias/imagen-ads.js, faltaParaProducir).
 */
export function faltaDelBorrador(carpeta, brief) {
  // la foto: la que ya se copio al lote, o la elegida del producto
  if (!fotoDelLote(carpeta) && !(brief?.productoId && rutaFoto(brief.productoId, brief.fotoProducto ?? 1))) return 'Falta la foto del producto.';
  const faltan = (brief?.referencias || []).filter((r) => !existe(path.join(carpeta, r))).length;
  if (faltan) return faltan === 1 ? 'Falta subir una referencia.' : `Faltan subir ${faltan} referencias.`;
  // «Variantes» sale SIEMPRE de un creativo que ya te funciona (sin eso no hay de dónde variar)
  if (brief?.modo === 'variantes' && !(brief.referencias || []).length) return 'Elige al menos un anuncio que ya te funcione.';
  // el agente sin referencia trabaja desde la investigación de mercado del producto
  if (brief?.agente === 'variaciones' && brief.modo !== 'variantes' && !brief.investigacion) return 'Este producto todavía no tiene investigación de mercado: hazla primero (o sube un anuncio de referencia).';
  if (brief?.logo?.posicion && !existe(R.logo(carpeta))) return 'Falta subir tu logo.';
  return null;
}

// ---------------------------------------------------------------- los pedidos del usuario

const leerPedidos = (carpeta) => {
  const j = leerJSON(R.pedidos(carpeta));
  return Array.isArray(j?.pedidos) ? j.pedidos : [];
};

/** Los pedidos que todavia no terminaron (los del estado y los que no entraron todavia). */
export function pedidosSinTerminar(carpeta) {
  const est = leerEstado(carpeta);
  return leerPedidos(carpeta).filter((x) => {
    const e = est?.pedidos?.[x.id];
    return !e || !PEDIDO_TERMINADO.has(e.estado);
  });
}

/**
 * POST /api/imagen-ads/:lote/regenerar: { pieza, instruccion? } o { v, tipo: 'prompt' }. Lo agrega a pedidos.json (solo
 * las rutas escriben ahi, y solo agregan). 409 si esa imagen ya tiene un cambio en camino o todavia se esta creando.
 */
export function agregarPedido(lote, cuerpo = {}) {
  const carpeta = carpetaDe(lote);
  const brief = leerBrief(carpeta);
  const est = leerEstado(carpeta);
  if (!est) throw new ErrorApp(409, 'Este lote todavía se está preparando: espera a que salgan sus primeras imágenes.');
  const ocupada = (v) => pedidosSinTerminar(carpeta).some((x) => (x.v || vDe(x.pieza || '')) === v);
  let pedido;
  if (cuerpo.tipo === 'prompt') {
    const v = String(cuerpo.v || '');
    if (!RE_V.test(v) || !est.variaciones?.[v]) throw new ErrorApp(404, 'No encuentro ese anuncio en el lote.');
    if (est.variaciones[v].prompt !== 'sin-prompt') throw new ErrorApp(409, 'Este anuncio ya está escrito.');
    if (ocupada(v)) throw new ErrorApp(409, 'Este anuncio ya tiene un cambio en camino.');
    pedido = { tipo: 'prompt', v };
  } else {
    const pieza = String(cuerpo.pieza || '');
    if (!RE_PIEZA.test(pieza) || !est.piezas?.[pieza] || !(brief.formatos || []).includes(formatoDe(pieza))) throw new ErrorApp(404, 'No encuentro esa imagen en el lote.');
    const instruccion = typeof cuerpo.instruccion === 'string' ? cuerpo.instruccion.trim() : '';
    if (instruccion.length > 600) throw new ErrorApp(400, 'Lo que quieres cambiar es demasiado largo (hasta 600 caracteres).');
    if (ocupada(vDe(pieza))) throw new ErrorApp(409, 'Esta imagen ya tiene un cambio en camino.');
    const p = est.piezas[pieza];
    if (est.variaciones?.[vDe(pieza)]?.prompt === 'sin-prompt') throw new ErrorApp(409, 'Este anuncio quedó sin escribir: usa «Escribir de nuevo».');
    if (p.fase !== 'final') throw new ErrorApp(409, 'Esta imagen todavía se está creando: espera a que termine.');
    if (formatoDe(pieza) === '9:16') {
      const c = est.piezas[piezaId(vDe(pieza), '1:1')];
      if (c && (c.fase !== 'final' || !existe(R.img(carpeta, piezaId(vDe(pieza), '1:1'))))) throw new ErrorApp(409, 'Su imagen cuadrada no salió: rehaz primero la cuadrada.');
    }
    pedido = { pieza, instruccion };
  }
  const lista = leerPedidos(carpeta);
  const n = Math.max(0, ...lista.map((x) => Number(String(x.id || '').slice(1)) || 0)) + 1;
  const nuevo = { id: `U${String(n).padStart(4, '0')}`, ...pedido, fecha: ahora() };
  guardarJSON(R.pedidos(carpeta), { pedidos: [...lista, nuevo] });
  return nuevo;
}

/**
 * Un lote terminado con pedidos sin terminar (por ejemplo, la app se cerro justo despues de un Regenerar): se reabre.
 * Lo llaman el GET del lote y un barrido al arrancar. Devuelve true si lo reabrio.
 */
export async function asegurarPedidos(lote) {
  const carpeta = carpetaDe(lote);
  const brief = leerBrief(carpeta);
  if (brief?.familia !== FAMILIA || !esDeEstaApp(brief)) return false;
  const c = leerJSON(R.conductor(carpeta));
  if (!c || c.estado !== 'listo' || Boolean(c.modoPrueba) !== modoPrueba()) return false;
  if (!pedidosSinTerminar(carpeta).length) return false;
  const conductor = await import('../conductor.js');
  if (!conductor.tomarElMando()) return false;
  try {
    conductor.reabrir(lote, 'anuncios');
    return true;
  } catch (e) {
    console.error(`[imagen-ads] ${lote}: no pude reabrir el lote para sus pedidos: ${e?.message || e}`);
    return false;
  }
}

// ---------------------------------------------------------------- lo que se hereda del lote anterior del mismo producto

/** La identidad visual del ultimo lote listo del mismo producto (de esta app), o null. */
export function loteAnterior(productoId, excepto) {
  const u = ultimoLoteDe(productoId, { excepto, listo: true });
  if (!u) return null;
  const p = leerJSON(R.productoJson(u.carpeta));
  const e = leerJSON(R.estrategia(u.carpeta));
  if (!p?.identidad_visual) return null;
  return { lote: u.lote, identidad_visual: p.identidad_visual, descripcion_visual_en: p.descripcion_visual_en || '', paleta: Array.isArray(e?.paleta) ? e.paleta : [] };
}

/** Las combinaciones angulo + formato ya usadas en los lotes de este producto (de esta app). */
export function usadosDe(productoId, excepto) {
  const vistos = new Set();
  const salida = [];
  for (const lote of lotesDeEstaApp()) {
    if (lote === excepto) continue;
    const c = carpetaDe(lote);
    if (leerBrief(c)?.productoId !== productoId) continue;
    for (const x of leerJSON(R.plan(c))?.variaciones || []) {
      if (!x?.angulo_id || !x?.formato_id) continue;
      const k = `${x.angulo_id}|${x.formato_id}`;
      if (vistos.has(k)) continue;
      vistos.add(k);
      salida.push({ angulo_id: x.angulo_id, formato_id: x.formato_id });
    }
  }
  return salida;
}

// ---------------------------------------------------------------- el saldo y el informe

/** Cuantas imagenes faltan por hacer (para el paso del saldo: cada una a 10 creditos con GPT Image 2.5 a 2K). */
export function piezasPorHacer(carpeta, brief) {
  const est = leerEstado(carpeta);
  // plantillas: solo las escenas cuestan (una por variación con escena: el vertical reutiliza la del cuadrado)
  const total = brief?.plantillas ? (brief.video ? 0 : escenasDe(brief.cantidad, brief.plantillas.elegidas)) : (Number(brief?.cantidad) || 0) * (brief?.formatos?.length || 1);
  if (!est) return total;
  let n = 0;
  for (const p of Object.values(est.piezas || {})) if (p.fase !== 'final' && est.variaciones?.[p.v]?.prompt !== 'sin-prompt') n++;
  for (const x of pedidosSinTerminar(carpeta)) n += brief?.plantillas ? 1 : x.tipo === 'prompt' ? brief.formatos.length : formatoDe(x.pieza) === '1:1' ? brief.formatos.length : 1;
  return n;
}

/** app/informe.json (§4.9): como salio la revision y lo que costo (lo unico con precio, y solo con el lote terminado). */
export function armarInforme(carpeta, brief) {
  const est = leerEstado(carpeta);
  const g = gasto.resumenDeGasto(carpeta);
  const piezas = Object.keys(est?.piezas || {}).sort(ordenDePiezas);
  const de = (resultado) => piezas.filter((p) => est.piezas[p].fase === 'final' && est.piezas[p].resultado === resultado && est.variaciones[est.piezas[p].v]?.prompt !== 'sin-prompt');
  const sinPrompt = Object.keys(est?.variaciones || {})
    .filter((v) => est.variaciones[v].prompt === 'sin-prompt')
    .sort(ordenDeV);
  const conImagen = piezas.filter((p) => existe(brief?.plantillas ? R.final(carpeta, p) : R.img(carpeta, p)));
  const informe = {
    tipo: FAMILIA,
    fecha: ahora(),
    variaciones: Object.keys(est?.variaciones || {}).filter((v) => est.variaciones[v].prompt === 'listo').length,
    archivos: conImagen.length,
    modoPrueba: modoPrueba(),
    // plantillas: los textos los dibuja la app (no hay revisión de la IA ni nada «regenerado por ti» al empezar)
    ...(brief?.plantillas ? { plantillas: true, deVideo: Boolean(brief.video) } : {}),
    revision: {
      // bien a la primera = bien en la ronda 1 de la revision; las que quedaron bien despues de un cambio tuyo van aparte
      aLaPrimera: brief?.plantillas ? de('listo').length : de('listo').filter((p) => est.piezas[p].revision?.ronda === 1).length,
      rehechasPorTi: brief?.plantillas ? de('listo').filter((p) => est.piezas[p].pedido || est.piezas[p].ronda === 'u') : de('listo').filter((p) => est.piezas[p].revision?.ronda !== 1),
      arregladas: de('arreglado'), // (solo en lotes de antes del 2026-11-09: ya no hay reintento automatico)
      // las que la revision marco: quedan con su nota (todo al primer intento) para que el usuario decida
      conDetalles: de('con-detalles').map((p) => ({ pieza: p, problemas: est.piezas[p].revision?.problemas || [] })),
      sinRevisar: de('sin-revisar'),
      sinImagen: de('sin-imagen').map((p) => ({ pieza: p, motivo: est.piezas[p].mensaje || 'kie no pudo hacer esta imagen' })),
      sinPrompt,
    },
    costo: {
      creditos: g.creditos,
      dolares: g.dolares,
      piezas: (g.imagenes?.piezas || 0) + (g.sinRegistro?.piezas || 0),
      estimadas: g.sinRegistro?.piezas || 0,
      estimado: Boolean(g.estimado),
    },
  };
  guardarJSON(R.informe(carpeta), informe);
  return informe;
}

export { idsDelLote };

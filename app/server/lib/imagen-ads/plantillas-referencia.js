// Las PLANTILLAS de los anuncios de imagen (2026-11-18s, pedido: «tomes de plantilla las imágenes de referencia y eso
// pasaría como referencia al modelo y simplemente sería reemplazar el producto y textos»). Son 30 anuncios validados de
// la categoría (app/plantillas-referencia/, con su indice.json). No se dibujan con la app: cada una va al modelo de
// imagen como REFERENCIA junto a la foto del producto, en el modo rápido «copiar» (imagen-ads/rapido.js y
// produccion/imagen-ads.js RAPIDO_COPIAR): misma estructura, composición, jerarquía y tipografía; otro producto, otros
// textos (en español, con los beneficios del producto, sin precios ni ofertas) y la paleta del empaque.
//
//   catalogo()                    -> { familias, plantillas: [{ id, nombre, familia, url, miniatura }] }
//   elegir(n, elegidas)           -> [ids]  las elegidas (hasta MAXIMO), o una mezcla variada si no hay ninguna
//   copiarAlLote(carpeta, ids)    -> ['entrada/referencias/R01.jpg', …]  (como si las hubieras subido)
//   rutaDeArchivo(nombre, mini)   -> la ruta del archivo, o null
//   temasDeProducto(productoId)   -> ['gluteos', 'curvas', …]  de qué trata el producto (ficha e investigación)
//   relacionadas(productoId)      -> { temas, ids }  las plantillas de productos relacionados, la más cercana primero
//
// PRODUCTOS RELACIONADOS (2026-11-18w, «que identifique por productos relacionados para tomar referencias»): cada
// plantilla dice de qué producto viene (`temas`: glúteos, abdomen, celulitis, hinchazón, piel…). «Que la app elija»
// toma primero las de productos como el tuyo, sin perder la variedad de formas.
import fs from 'node:fs';
import path from 'node:path';
import { APP } from '../rutas.js';
import { leerJSON } from '../archivos.js';
import { PRODUCTOS, idValido, leerFicha } from '../productos.js';
import { R } from './disco.js';

export const DIR = path.join(APP, 'plantillas-referencia');
// (las referencias de un lote van de R01 a R10: más de 10 no le aporta variedad al modelo y alarga el pedido)
export const MAXIMO = 10;
const RE_ID = /^p\d{2}$/;

let indice = null;
function leerIndice() {
  if (indice) return indice;
  const j = leerJSON(path.join(DIR, 'indice.json'));
  const plantillas = (Array.isArray(j?.plantillas) ? j.plantillas : []).filter((p) => RE_ID.test(p?.id) && fs.existsSync(path.join(DIR, `${p.id}.jpg`)));
  indice = { familias: Array.isArray(j?.familias) ? j.familias : [], temas: j?.temas || {}, plantillas, porId: new Map(plantillas.map((p) => [p.id, p])) };
  return indice;
}

export function catalogo() {
  const { familias, temas, plantillas } = leerIndice();
  return {
    familias,
    temas,
    plantillas: plantillas.map((p) => ({ id: p.id, nombre: p.nombre, familia: p.familia, ...(p.fuente?.dias ? { dias: p.fuente.dias } : {}), temas: p.temas || [], url: `/api/imagen-ads/plantillas-referencia/${p.id}.jpg`, miniatura: `/api/imagen-ads/plantillas-referencia/mini/${p.id}.jpg` })),
  };
}

export const esPlantilla = (id) => leerIndice().porId.has(String(id));

/** { id, nombre, familia, titular (la estructura de su titular), ejemplo } o null. */
export const fichaDe = (id) => leerIndice().porId.get(String(id)) || null;

/**
 * Las plantillas del lote. Con elegidas: esas (sin repetir, hasta MAXIMO). Sin ninguna: `n` repartidas entre las
 * familias (una de cada familia por vuelta) y nunca dos del mismo grupo, así cada imagen trae una idea distinta
 * (la matriz creativa: diversidad real). El orden de cada familia cambia con el día, para no repetir siempre las mismas.
 */
export function elegir(n, elegidas = [], { dia = Math.floor(Date.now() / 86400000), temas = [] } = {}) {
  const { plantillas, porId } = leerIndice();
  const propias = [...new Set((elegidas || []).map(String))].filter((id) => porId.has(id));
  if (propias.length) return propias.slice(0, MAXIMO);
  const cuantas = Math.max(1, Math.min(MAXIMO, Number(n) || 1));
  const porFamilia = new Map();
  for (const p of plantillas) {
    if (!porFamilia.has(p.familia)) porFamilia.set(p.familia, []);
    porFamilia.get(p.familia).push(p);
  }
  // (con los temas del producto: en cada familia, primero las de productos relacionados; y primero las familias que
  // tienen alguna relacionada)
  const puntos = (p) => {
    const comunes = temas.length ? (p.temas || []).filter((t) => temas.includes(t)) : [];
    return comunes.some((t) => t !== 'hombres') ? comunes.length : 0;
  };
  const colas = [...porFamilia.values()]
    .map((l, i) => {
      const corrido = (dia + i * 3) % l.length;
      return [...l.slice(corrido), ...l.slice(0, corrido)].sort((a, b) => puntos(b) - puntos(a));
    })
    .sort((a, b) => puntos(b[0]) - puntos(a[0]));
  const salida = [];
  const grupos = new Set();
  for (let vuelta = 0; salida.length < cuantas && colas.some((c) => c.length); vuelta++) {
    for (const c of colas) {
      if (salida.length >= cuantas) break;
      const k = c.findIndex((p) => !grupos.has(p.grupo));
      if (k === -1) continue;
      const [p] = c.splice(k, 1);
      grupos.add(p.grupo);
      salida.push(p.id);
    }
    if (vuelta > plantillas.length) break;
  }
  return salida;
}

/** Copia las plantillas al lote como sus referencias (R01, R02…). */
export function copiarAlLote(carpeta, ids) {
  const dir = R.referencias(carpeta);
  fs.mkdirSync(dir, { recursive: true });
  return ids.map((id, i) => {
    const nombre = `R${String(i + 1).padStart(2, '0')}.jpg`;
    fs.copyFileSync(path.join(DIR, `${id}.jpg`), path.join(dir, nombre));
    return `entrada/referencias/${nombre}`;
  });
}

export function rutaDeArchivo(nombre, mini = false) {
  const m = /^(p\d{2})\.jpg$/.exec(String(nombre || ''));
  if (!m || !esPlantilla(m[1])) return null;
  const abs = path.join(DIR, ...(mini ? ['mini'] : []), `${m[1]}.jpg`);
  return fs.existsSync(abs) ? abs : null;
}

// ---------------------------------------------------------------- los productos relacionados

// palabras de la ficha o la investigación -> tema (sin tildes, en minúscula)
const PALABRAS = {
  gluteos: ['glute', 'pompi', 'nalga', 'trasero', 'cola plana', 'cola caida', 'levantar la cola', 'butt', 'booty', 'plana', 'atras'],
  curvas: ['curva', 'cadera', 'volumen', 'figura', 'llenar el jean', 'reloj de arena'],
  piernas: ['pierna', 'muslo', 'tobillo', 'pantorrilla', 'pies hinchados'],
  abdomen: ['abdomen', 'barriga', 'panza', 'vientre', 'cintura', 'abdominal'],
  hinchazon: ['hinchaz', 'retencion', 'liquido', 'drenaje', 'linfatic', 'inflamad', 'desinflam'],
  celulitis: ['celulitis', 'piel de naranja'],
  piel: ['piel', 'colageno', 'arruga', 'firmeza', 'flacidez', 'estria', 'acne', 'manchas'],
  peso: ['peso', 'adelgaz', 'grasa', 'quema', 'kilo', 'talla', 'metabolismo', 'apetito'],
  detox: ['detox', 'higado', 'depura', 'toxinas'],
  digestion: ['digesti', 'estren', 'intestin', 'fibra', 'gases', 'colon'],
  menopausia: ['menopaus', 'hormon', 'sofoco'],
  musculo: ['musculo', 'proteina', 'creatina', 'masa muscular'],
  brazos: ['brazo'],
  hombres: ['hombre', 'masculin'],
  // (sin plantillas propias todavía: así un producto respiratorio no toma las de otra cosa)
  respiratorio: ['respir', 'tos', 'flema', 'pulmon', 'pecho apretado', 'bronqu'],
  sueno: ['dormir', 'insomnio', 'sueno'],
};
const sinTildes = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Los temas de un texto, del más nombrado al menos (los que aparecen al menos una vez). */
export function temasDeTexto(texto) {
  const t = sinTildes(texto);
  return Object.entries(PALABRAS)
    .map(([tema, palabras]) => [tema, palabras.reduce((n, p) => n + (t.split(p).length - 1), 0)])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([tema]) => tema);
}

/** De qué trata el producto: su ficha (nombre, qué es, beneficios, dolor, público) y el deseo central de la investigación. */
export function temasDeProducto(productoId) {
  if (!idValido(productoId)) return [];
  const f = leerFicha(productoId) || {};
  const inv = leerJSON(path.join(PRODUCTOS, productoId, 'investigacion', 'investigacion.json'));
  const deseo = (inv?.secciones || []).find((s) => /deseo central/i.test(s?.titulo || ''));
  const texto = [f.nombre, f.queEs, ...(Array.isArray(f.beneficios) ? f.beneficios : []), f.dolor, f.publico, JSON.stringify(deseo?.bloques || []).slice(0, 4000)].join(' \n ');
  // (si no es para hombres, «hombres» no cuenta; y los temas que casi no se nombran, tampoco: los 4 primeros)
  return temasDeTexto(texto).slice(0, 4);
}

/** Las plantillas de productos relacionados con el tuyo, la más cercana primero. */
export function relacionadas(productoId) {
  const temas = temasDeProducto(productoId);
  if (!temas.length) return { temas, ids: [] };
  const { plantillas } = leerIndice();
  const ids = plantillas
    // («hombres» solo suma junto a otro tema: un producto para hombres con tos no es un producto de abdomen)
    .map((p) => {
      const comunes = (p.temas || []).filter((t) => temas.includes(t));
      return { id: p.id, n: comunes.some((t) => t !== 'hombres') ? comunes.length : 0, primero: (p.temas || []).includes(temas[0]) };
    })
    .filter((x) => x.n)
    .sort((a, b) => Number(b.primero) - Number(a.primero) || b.n - a.n)
    .map((x) => x.id);
  return { temas, ids };
}

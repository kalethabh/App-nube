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
import fs from 'node:fs';
import path from 'node:path';
import { APP } from '../rutas.js';
import { leerJSON } from '../archivos.js';
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
  indice = { familias: Array.isArray(j?.familias) ? j.familias : [], plantillas, porId: new Map(plantillas.map((p) => [p.id, p])) };
  return indice;
}

export function catalogo() {
  const { familias, plantillas } = leerIndice();
  return {
    familias,
    plantillas: plantillas.map((p) => ({ id: p.id, nombre: p.nombre, familia: p.familia, ...(p.fuente?.dias ? { dias: p.fuente.dias } : {}), url: `/api/imagen-ads/plantillas-referencia/${p.id}.jpg`, miniatura: `/api/imagen-ads/plantillas-referencia/mini/${p.id}.jpg` })),
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
export function elegir(n, elegidas = [], { dia = Math.floor(Date.now() / 86400000) } = {}) {
  const { plantillas, porId } = leerIndice();
  const propias = [...new Set((elegidas || []).map(String))].filter((id) => porId.has(id));
  if (propias.length) return propias.slice(0, MAXIMO);
  const cuantas = Math.max(1, Math.min(MAXIMO, Number(n) || 1));
  const porFamilia = new Map();
  for (const p of plantillas) {
    if (!porFamilia.has(p.familia)) porFamilia.set(p.familia, []);
    porFamilia.get(p.familia).push(p);
  }
  const colas = [...porFamilia.values()].map((l, i) => {
    const corrido = (dia + i * 3) % l.length;
    return [...l.slice(corrido), ...l.slice(0, corrido)];
  });
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

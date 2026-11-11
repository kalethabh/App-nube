// Los modelos que usa CADA anuncio, elegidos en Ajustes › Modelos de la app.
//
// El catalogo (produccion/catalogo-modelos.json) dice que opciones hay en cada
// categoria y en que orden se prueban los modelos de cada una (la cascada: si
// el primero falla, el siguiente). Es JSON puro: lo leen este archivo y la app,
// que no importa el motor.
//
// La eleccion de un anuncio vive en temp/<slug>/modelos.json, con la forma
// { vozEnOff: 'omni', ..., guardado: 'ISO' }. La escribe la app (al crear el
// anuncio y antes de producir, mientras no haya nada generado). SIN ese archivo
// todo sale EXACTAMENTE como antes de que existiera la eleccion: los anuncios
// viejos y la CLI no cambian.
//
// Importarlo no hace nada mas que leer el catalogo.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESTILOS_HABLADOS, MODELOS_VIDEO, MODELOS, creditosClip, RESOLUCION_VIDEO } from './config.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RUTA_CATALOGO = path.join(AQUI, 'catalogo-modelos.json');
export const ARCHIVO_ELECCION = 'modelos.json';

export const CATALOGO = JSON.parse(fs.readFileSync(RUTA_CATALOGO, 'utf8'));

// Lo de siempre, para una categoria u opcion que no trae la cascada pedida
// (p. ej. un B-roll en un anuncio UGC). Son las cascadas de antes de la eleccion.
const OMNI = 'google/gemini-omni-flash-1-1';
const KLING = 'kling-3.0/video';
const CASCADA_FRAMES_DE_SIEMPRE = Object.freeze([OMNI, KLING]);
const CASCADA_REFERENCIAS_DE_SIEMPRE = Object.freeze([OMNI]);

const categoriaPorId = new Map(CATALOGO.categorias.map((c) => [c.id, c]));

/** { vozEnOff: 'omni', objetoParlante: 'omni', ugc: 'omni', podcastEntrevista: 'omni', brollHablado: 'kling', imagen: 'gpt25' } */
export const ELECCION_POR_DEFECTO = Object.freeze(Object.fromEntries(CATALOGO.categorias.map((c) => [c.id, c.porDefecto])));

function categoria(id) {
  const c = categoriaPorId.get(id);
  if (!c) throw new Error(`No conozco la categoria de modelos "${id}".`);
  return c;
}

function opcionElegida(eleccion, idCategoria) {
  const c = categoria(idCategoria);
  const elegida = normalizarEleccion(eleccion)[idCategoria];
  return c.opciones.find((o) => o.id === elegida) ?? c.opciones.find((o) => o.id === c.porDefecto);
}

/**
 * Completa con los por defecto e ignora lo que no existe (ids de opcion que no
 * estan en su categoria, categorias desconocidas, "guardado"). Nunca lanza.
 */
export function normalizarEleccion(obj) {
  const entrada = obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  const salida = {};
  for (const c of CATALOGO.categorias) {
    const v = entrada[c.id];
    salida[c.id] = typeof v === 'string' && c.opciones.some((o) => o.id === v) ? v : c.porDefecto;
  }
  return salida;
}

/**
 * La eleccion de un anuncio: <carpeta>/modelos.json si existe, si no la de
 * siempre. Un archivo roto o con ids que no existen no corta nada: se avisa en
 * consola y se usa lo de siempre en lo que no se entienda.
 */
export function leerEleccion(carpetaAnuncio) {
  const ruta = path.join(String(carpetaAnuncio ?? ''), ARCHIVO_ELECCION);
  let texto;
  try {
    if (!carpetaAnuncio || !fs.existsSync(ruta)) return { ...ELECCION_POR_DEFECTO };
    texto = fs.readFileSync(ruta, 'utf8');
  } catch (e) {
    console.warn(`  !  No pude leer ${ruta} (${e.message}); uso los modelos de siempre.`);
    return { ...ELECCION_POR_DEFECTO };
  }
  let crudo;
  try {
    crudo = JSON.parse(texto.replace(/^﻿/, ''));
  } catch (e) {
    console.warn(`  !  ${ruta} no es un JSON valido (${e.message}); uso los modelos de siempre.`);
    return { ...ELECCION_POR_DEFECTO };
  }
  const eleccion = normalizarEleccion(crudo);
  if (crudo && typeof crudo === 'object') {
    const ignorados = CATALOGO.categorias.filter((c) => crudo[c.id] !== undefined && crudo[c.id] !== eleccion[c.id]).map((c) => `${c.id}=${JSON.stringify(crudo[c.id])}`);
    if (ignorados.length) console.warn(`  !  ${ruta}: no conozco ${ignorados.join(', ')}; en eso uso los modelos de siempre.`);
  }
  return eleccion;
}

/** Si el trabajo va por el camino de referencias (bloque R de UGC, gancho, toma H por ingredientes). */
export function usaReferencias(trabajo) {
  const t = trabajo || {};
  return t.tipo === 'R' || t.clase === 'gancho' || t.porIngredientes === true || (t.tipo === 'H' && Array.isArray(t.ingredientes) && t.ingredientes.length > 0);
}

/**
 * La categoria de un clip. `trabajo` puede ser una toma o un B-roll del
 * manifiesto o un trabajo del plan de generar-videos.js (con clase).
 *
 *   podcast / entrevista     B-roll -> 'brollHablado'; lo demas -> 'podcastEntrevista'
 *   UGC (tomas R)            'ugc'
 *   continuidad, voz en off  'vozEnOff'
 *   y musica
 *   el resto (dialogo        'objetoParlante'
 *   nativo: objeto
 *   parlante, sketch)
 */
export function categoriaDeVideo(manifiesto, trabajo = null) {
  const m = manifiesto || {};
  const t = trabajo || {};
  const esBroll = t.clase === 'broll' || t.tipo === 'broll';
  if (ESTILOS_HABLADOS.includes(m.estilo)) return esBroll ? 'brollHablado' : 'podcastEntrevista';
  if (t.tipo === 'R' || t.clase === 'gancho' || (m.tomas || []).some((x) => x?.tipo === 'R')) return 'ugc';
  if (m.continuidad != null) return 'vozEnOff';
  if (m.modo_audio === 'voz_en_off' || m.modo_audio === 'musica') return 'vozEnOff';
  return 'objetoParlante';
}

/**
 * Los modelos, en orden de intento, de una categoria. Con `referencias: true`
 * la del camino de referencias; si no, la de las tomas con imagen (frames).
 * Si la opcion no tiene esa cascada se usa la de la opcion por defecto, y si
 * tampoco, la de siempre (Omni y Kling; Omni solo por referencias).
 */
export function cascadaVideo(eleccion, idCategoria, { referencias = false } = {}) {
  const tipo = referencias ? 'referencias' : 'frames';
  const c = categoria(idCategoria);
  const lista = opcionElegida(eleccion, idCategoria)?.cascadas?.[tipo];
  if (Array.isArray(lista) && lista.length) return [...lista];
  const porDefecto = c.opciones.find((o) => o.id === c.porDefecto)?.cascadas?.[tipo];
  if (Array.isArray(porDefecto) && porDefecto.length) return [...porDefecto];
  return [...(referencias ? CASCADA_REFERENCIAS_DE_SIEMPRE : CASCADA_FRAMES_DE_SIEMPRE)];
}

/** Atajo: la cascada de un trabajo del plan (categoria + camino). */
export function cascadaDelTrabajo(eleccion, manifiesto, trabajo) {
  return cascadaVideo(eleccion, categoriaDeVideo(manifiesto, trabajo), { referencias: usaReferencias(trabajo) });
}

/** Si la eleccion es la de siempre en todas las categorias. */
export function esEleccionPorDefecto(eleccion) {
  const e = normalizarEleccion(eleccion);
  return CATALOGO.categorias.every((c) => e[c.id] === c.porDefecto);
}

/**
 * Por que un modelo de la cascada NO puede hacer un clip, o null si puede. La
 * cascada salta ese nivel sin pedir ni cobrar nada.
 *
 *   referencias   el clip va por el camino de referencias (bloque R, toma H por
 *                 ingredientes): sin frames, con image_urls
 *   frameFinal    el clip trae imagen final (toma B, paso de continuidad)
 *
 * Los textos se muestran en consola tal cual.
 */
export function motivoParaSaltar(modelo, { referencias = false, frameFinal = false } = {}) {
  const def = MODELOS_VIDEO[modelo];
  if (!def) return `${modelo} no esta en MODELOS_VIDEO (config.js)`;
  if (referencias) {
    if (!def.referencias) return `${modelo} no recibe imagenes de referencia`;
    return null;
  }
  if (def.sinFrames) return `${modelo} solo trabaja con imagenes de referencia, sin imagen inicial`;
  if (frameFinal && !def.frameFinal) return `${modelo} no acepta frame final`;
  if (!frameFinal && def.frameFinalObligatorio) return `${modelo} necesita imagen inicial y final, y este clip no trae imagen final`;
  return null;
}

/**
 * El primer modelo de la cascada que puede hacer el clip (ver
 * motivoParaSaltar). Si ninguno puede, el primero (y la cascada lo dira al
 * generar). Es el que se usa para estimar el costo.
 */
export function primerModeloQueSirve(cascada, clip = {}) {
  const lista = Array.isArray(cascada) ? cascada : [];
  return lista.find((m) => motivoParaSaltar(m, clip) === null) ?? lista[0] ?? null;
}

/** Si dos cascadas son la misma lista, en el mismo orden. */
export function mismaCascada(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * El modelo que de verdad hace un clip de `segundos`, con la misma regla que
 * generarConCascada: el primero que puede hacerlo (motivoParaSaltar) y, si su
 * tope no alcanza y la cascada es una elegida (distinta de `deSiempre`, la de
 * ese clip sin modelos.json), el siguiente que si lo cubre. Con la cascada de
 * siempre, como antes: el primero (y quien estima avisa que hay que dividir).
 * Es el que se usa para estimar el costo del clip.
 */
export function modeloParaClip(cascada, clip = {}, segundos = null, { deSiempre = null } = {}) {
  const primero = primerModeloQueSirve(cascada, clip);
  if (!primero || !Number.isFinite(segundos) || mismaCascada(cascada, deSiempre)) return primero;
  if (!MODELOS_VIDEO[primero] || !creditosClip(primero, segundos, RESOLUCION_VIDEO).excedeTope) return primero;
  const otro = (cascada || []).find(
    (x) => MODELOS_VIDEO[x] && motivoParaSaltar(x, clip) === null && !creditosClip(x, segundos, RESOLUCION_VIDEO).excedeTope
  );
  return otro ?? primero;
}

/**
 * Continuidad: el modelo con el que se calculan los largos de la cadena (los
 * pasos y propios llevan imagen final): el primero de la cascada de voz en off
 * que acepta imagen final. Sin eleccion, el de siempre (Omni, con sus tramos).
 */
export function modeloDeCadena(eleccion) {
  if (!eleccion) return MODELOS.video.principal;
  return primerModeloQueSirve(cascadaVideo(eleccion, 'vozEnOff'), { frameFinal: true }) ?? MODELOS.video.principal;
}

/** { cascada, resoluciones } de las imagenes (tomas, B-roll y hojas; los iconos no). */
export function cascadaImagen(eleccion) {
  const o = opcionElegida(eleccion, 'imagen');
  return { cascada: [...o.cascada], resoluciones: { ...o.resoluciones } };
}

/**
 * El id del catalogo que corresponde a un id de modelo: el mismo, o el mas
 * largo que sea su comienzo (kie devuelve variantes como
 * 'gpt-image-2-5-sunburst-text-to-image').
 */
function idDelCatalogo(id) {
  const s = String(id ?? '');
  if (!s) return null;
  if (Object.hasOwn(CATALOGO.modelos, s)) return s;
  let mejor = null;
  for (const k of Object.keys(CATALOGO.modelos)) if (s.startsWith(k) && (!mejor || k.length > mejor.length)) mejor = k;
  return mejor;
}

/** 'google/gemini-omni-flash-1-1' -> 'Omni Flash 1.1'. null si no esta en el catalogo. */
export function nombreModelo(id) {
  const k = idDelCatalogo(id);
  return k ? CATALOGO.modelos[k].nombre : null;
}

/** Si el modelo genera habla con boca sincronizada (campo "dialogo" del catalogo). */
export function esModeloConDialogo(id) {
  const k = idDelCatalogo(id);
  return k ? CATALOGO.modelos[k].dialogo === true : false;
}

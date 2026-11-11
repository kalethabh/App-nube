// El COSTO ESTIMADO de un anuncio ANTES de producirlo, y cuanto costaria con
// cada modelo que se puede elegir en Ajustes › Modelos. Sin red, sin escribir
// nada y sin claves: no consulta el saldo ni pide nada a nadie.
//
//   node produccion/estimar-costo.js temp/mi-anuncio
//   node produccion/estimar-costo.js temp/mi-anuncio --json
//   node produccion/estimar-costo.js temp/mi-anuncio --json --comparar
//   node produccion/estimar-costo.js temp/mi-anuncio --json --eleccion '{"vozEnOff":"grok15"}'
//   node produccion/estimar-costo.js temp/mi-anuncio --json --cancion       (cantados: una entrada por version)
//   node produccion/estimar-costo.js temp/mi-anuncio --json --segundos 120  (cantados: la cancion dura eso)
//   node produccion/estimar-costo.js temp/mi-anuncio --json --ganchos       (UGC: con los ganchos alternativos)
//   node produccion/estimar-costo.js temp/mi-anuncio --json --piezas        lo que cuesta REGENERAR cada pieza
//        (el clip, y con su imagen), con los modelos del anuncio (su modelos.json): el «Regenerar · ≈ US$ 0,42»
//
// El numero sale del motor, pieza por pieza, con las MISMAS funciones que
// deciden que se pide y que se cobra: construirPlan de generar-imagenes.js (y
// su filtro del CLI), estimar() de estimar-video.js, construirPlan de
// generar-videos.js para los ganchos, modelos-elegidos.js para la cascada de
// cada clip (modeloParaClip: PixVerse solo con imagen final, Grok v1 solo por
// referencias, los topes de duracion) y los precios de config.js. Medido sobre
// los anuncios de la app: con los B-roll que de verdad entraron, coincide al
// credito con lo cobrado (produccion/pruebas/probar-estimar-costo.js).
//
// Que cuenta (solo kie.ai: imagenes, videos y Suno). La voz y la transcripcion
// de ElevenLabs van por el plan del usuario: se dicen en una linea, sin numero.
//
//   min  lo probable
//   max  igual a min: desde 2026-11-09 la app genera todo al primer intento y no
//        regenera nada sola por calidad (la revision solo deja un aviso), asi que
//        no hay margen de rehechos (MARGEN_POR_FAMILIA en 0). Lo tecnico (kie que
//        falla) no se cobra. Lo que el usuario regenera despues se cobra aparte.
//
// Antes de la voz (voz en off y musica) no se sabe que B-roll entra en el
// video: se predice con la regla del montaje (repartirVentana) y la duracion
// de cada toma del manifiesto (acierta 78,6 % de los B-roll; en creditos +3,2 %).
// Con audio/tiempos.json valido (y su voz), la regla de verdad.
//
// Continuidad: el manifiesto aprobado todavia no trae el bloque; se simula en
// memoria lo que hace `continuidad.js --preparar` (el B-roll pasa a
// continuidad.broll_descartado y no se produce) y la cadena se estima.
//
// Musical e historia musical antes de las tomas (no hay manifiesto): la cancion
// es exacta (12 por generacion de Suno y 12 por cada parte que se agrega) y el
// video sale de un manifiesto TIPICO del estilo armado con los segundos de la
// cancion (CANTADO_TIPICO), cobrado con las mismas funciones. Calibrado contra
// los cantados reales de temp/ en la prueba.
//
// Exporta las funciones puras (las usa la prueba). El CLI solo corre si este
// archivo es el que se ejecuta.

import fs from 'node:fs';
import path from 'node:path';
import {
  MODELOS,
  MODELOS_VIDEO,
  PRECIOS,
  RAIZ,
  RESOLUCION_VIDEO,
  ESTILOS_HABLADOS,
  ESTILOS_SIN_MUSICA,
  ESTILOS_CON_CONTINUIDAD,
  creditosAUsd,
  creditosClip,
} from './config.js';
import { estimar as estimarVideos } from './estimar-video.js';
import { construirPlan as planDeImagenes } from './generar-imagenes.js';
import { construirPlan as planDeVideos } from './generar-videos.js';
import { tieneContinuidad, VERSION_CONTINUIDAD } from './continuidad.js';
import { repartirVentana, brollQueEntranEnCarpeta } from './planear-montaje.js';
import { tomaDelBroll } from './referencias.js';
import { itemDeTrabajo, modoSinCobro } from './clips-sin-cobro.js';
import { repetidas } from './imagenes-repetidas.js';
import { MUSICA } from './generar-musica.js';
import { pistaFijaDe } from './pista-fija.js';
import {
  CATALOGO,
  ELECCION_POR_DEFECTO,
  categoriaDeVideo,
  cascadaDelTrabajo,
  cascadaVideo,
  leerEleccion,
  modeloParaClip,
  motivoParaSaltar,
  nombreModelo,
  normalizarEleccion,
  usaReferencias,
} from './modelos-elegidos.js';

// ---------------------------------------------------------------- constantes

/**
 * Lo que se suma por rehechos en cada familia: 0 en todas desde 2026-11-09 (todo
 * al primer intento: la app ya no regenera sola por calidad; antes era lo medido
 * en mapa-calibrar, 0,10 a 0,20). Queda la tabla por si alguna familia vuelve a
 * necesitarlo.
 */
export const MARGEN_POR_FAMILIA = Object.freeze({
  'voz-en-off': 0,
  continuidad: 0,
  'objeto-parlante': 0,
  ugc: 0,
  hablado: 0,
  musical: 0,
  'historia-musical': 0,
});

/** Suno: 12 creditos por generacion (2 versiones por estilo) y por cada extend (generar-musica.js). */
export const CREDITOS_SUNO = MUSICA.creditos;

/**
 * Los estilos con pista fija en recursos/musica/ (sin Suno ni costo). Estilo
 * lego la pone el motor (pista-fija.js); zack-d-films y skeleton se copian a
 * mano antes de npm run musica (familias/voz-en-off.js de la app, DEL_ESTILO).
 * Sin el archivo, la musica va por Suno.
 */
export const PISTA_FIJA = Object.freeze({
  'zack-d-films': 'zack-d-films.mp3',
  skeleton: 'esqueleto.mp3',
  ...(pistaFijaDe('estilo-lego') ? { 'estilo-lego': pistaFijaDe('estilo-lego') } : {}),
});

/** Los estilos de la app y su familia (la misma tabla que app/server/lib/anuncios-nuevos.js ESTILOS). */
const FAMILIA_DEL_ESTILO = Object.freeze({
  claymation: 'voz-en-off',
  crochet: 'voz-en-off',
  'zack-d-films': 'voz-en-off',
  'estilo-pixar': 'voz-en-off',
  skeleton: 'voz-en-off',
  'estilo-lego': 'voz-en-off',
  'talking-object-pixar': 'objeto-parlante',
  ugc: 'ugc',
  podcast: 'hablado',
  entrevista: 'hablado',
  musical: 'musical',
  musicales: 'musical',
  'historias-musicales': 'historia-musical',
});

const CANTADAS = new Set(['musical', 'historia-musical']);

/**
 * Un cantado tipico, para estimar el video antes de que existan las tomas
 * (mapa-calibrar.md, seccion D y 6): segundos por toma, B-roll por toma, hojas
 * de referencia que se generan y que parte de las tomas son B (con imagen
 * final). Sale de kovacol (musical corto: 24 tomas en 108 s, 14 B-roll de 4 s,
 * 1 hoja, 4 B) y de las dos historias (53 y 59 tomas en 268 y 287 s, sin
 * B-roll, 7 a 9 hojas, 2 o 3 B).
 *   segundosSinCancion  sin cancion ni otra pista (el musical; la historia usa sus palabras)
 *   palabrasPorSegundo  la historia antes de la cancion: palabras de la letra / 2,1
 */
export const CANTADO_TIPICO = Object.freeze({
  musical: Object.freeze({ segundosPorToma: 4.5, brollPorToma: 0.58, segundosBroll: 4, hojas: 1, fraccionB: 1 / 6, segundosSinCancion: 100, palabrasPorSegundo: null }),
  'historia-musical': Object.freeze({ segundosPorToma: 5, brollPorToma: 0, segundosBroll: 4, hojas: 8, fraccionB: 0.045, segundosSinCancion: 300, palabrasPorSegundo: 2.1 }),
});

/**
 * Las duraciones de las tomas del cantado tipico, alrededor de la media (la
 * media de los factores es 1). Imitan el reparto real de largos: con Omni, que
 * cobra por tramo, una sola duracion para todas se pasaria o se quedaria corta.
 */
const FACTORES_DURACION = Object.freeze([0.62, 0.84, 1, 1.16, 1.38]);

const r2 = (x) => Math.round(Number(x) * 100) / 100;
const esObjeto = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

// ---------------------------------------------------------------- dinero y textos

/** { min, max } en dolares: el minimo redondeado al centavo y el maximo hacia arriba (el rango nunca se queda corto). */
export function dolaresDe(creditos) {
  const min = Number(creditos?.min) || 0;
  const max = Number(creditos?.max ?? min) || 0;
  // un solo numero (sin margen): el mismo redondeo para los dos, si no saldria «US$ 5,06 a 5,07»
  if (max === min) {
    const d = Math.round(creditosAUsd(min) * 100 + 1e-6) / 100;
    return { min: d, max: d };
  }
  return {
    min: Math.round(creditosAUsd(min) * 100 + 1e-6) / 100,
    max: Math.ceil(creditosAUsd(max) * 100 - 1e-6) / 100,
  };
}

/** "US$ 3,10" (el mismo formato que dinero() de app/src/datos/formato.js). */
export function textoDolares(usd) {
  return `US$ ${Number(usd).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })}`;
}

/** El rango con margen: min = lo probable; max = lo variable con el margen + lo fijo (Suno). Sin margen, max = min. */
export function rango(variable, fijo, margen) {
  const min = r2(variable + fijo);
  if (!(Number(margen) > 0)) return { min, max: min };
  const max = Math.ceil(variable * (1 + margen) + fijo - 1e-9);
  return { min, max: Math.max(max, Math.ceil(min - 1e-9)) };
}

const nombreDeOpcion = (cat, id) => CATALOGO.categorias.find((c) => c.id === cat)?.opciones.find((o) => o.id === id)?.nombre ?? id;
const nombreDeCategoria = (cat) => CATALOGO.categorias.find((c) => c.id === cat)?.nombre ?? cat;
const escenas = (k) => (k === 1 ? 'Una escena' : `${k} escenas`);

// ---------------------------------------------------------------- familia

/**
 * La familia del anuncio, con el brief de la app si esta (su estilo manda: un
 * musical tiene en el manifiesto el estilo visual) y si no con el manifiesto
 * (el mismo orden que producir.js familiaDe). `continuidad` (el brief la pidio)
 * vale aunque el manifiesto aprobado todavia no traiga el bloque.
 */
export function familiaDe({ manifiesto: m = null, brief = null, continuidad = false } = {}) {
  const estilo = brief?.estilo ?? m?.estilo ?? null;
  const delEstilo = FAMILIA_DEL_ESTILO[estilo] ?? null;
  if (delEstilo && CANTADAS.has(delEstilo)) return delEstilo;
  if (!m) return delEstilo;
  if (m.modo_audio === 'musica') return m.estilo === 'historias-musicales' ? 'historia-musical' : 'musical';
  const pidioContinuidad = continuidad || brief?.continuidad === true;
  if (tieneContinuidad(m) || (pidioContinuidad && m.modo_audio === 'voz_en_off' && ESTILOS_CON_CONTINUIDAD.includes(m.estilo))) return 'continuidad';
  if (ESTILOS_HABLADOS.includes(m.estilo)) return 'hablado';
  if ((m.tomas || []).some((t) => t?.tipo === 'R')) return 'ugc';
  if (m.modo_audio === 'voz_en_off') return 'voz-en-off';
  return 'objeto-parlante';
}

/** Lo que va por ElevenLabs (el plan del usuario, nunca en el numero). */
export function notaElevenlabs(familia) {
  if (familia === 'voz-en-off' || familia === 'continuidad') return 'La voz y la transcripción salen de tu plan de ElevenLabs.';
  if (familia) return 'La transcripción sale de tu plan de ElevenLabs.';
  return null;
}

// ---------------------------------------------------------------- piezas

/**
 * Continuidad antes de producir: lo que hace `continuidad.js --preparar`, en
 * memoria (el B-roll del paquete pasa a continuidad.broll_descartado y "broll"
 * queda vacio; los pasos se escriben despues). Un manifiesto que ya trae el
 * bloque queda como esta.
 */
export function simularPreparar(m) {
  if (tieneContinuidad(m)) return m;
  return { ...m, broll: [], continuidad: { version: VERSION_CONTINUIDAD, broll_descartado: Array.isArray(m.broll) ? m.broll : [], pasos: [] } };
}

/**
 * Los B-roll que PROBABLEMENTE entran en el video, antes de la voz: la regla
 * del montaje (repartirVentana, uno por toma: el ultimo) con la duracion de
 * cada toma del manifiesto como ventana. Es lo mismo que brollQueEntran con
 * unos tiempos sinteticos (cada linea dura lo que su toma). Solo en voz en off
 * y musica, sin continuidad y fuera de los hablados; en lo demas no decide.
 * La forma de brollQueEntran: { aplica, entran: [n], fuera: [{ n }] }.
 */
export function reglaBrollProbable(m) {
  if (!esObjeto(m)) return { aplica: false, motivo: 'no hay manifiesto' };
  if (ESTILOS_HABLADOS.includes(m.estilo) || tieneContinuidad(m)) return { aplica: false, motivo: 'la regla no decide en este anuncio' };
  if (m.modo_audio !== 'voz_en_off' && m.modo_audio !== 'musica') return { aplica: false, motivo: 'la regla no decide en este anuncio' };
  const broll = (Array.isArray(m.broll) ? m.broll : []).filter(esObjeto);
  const porToma = new Map();
  for (const b of broll) porToma.set(tomaDelBroll(b), b);
  const entran = new Set();
  for (const t of Array.isArray(m.tomas) ? m.tomas : []) {
    if (!esObjeto(t)) continue;
    const b = porToma.get(t.n);
    if (!b) continue;
    const r = repartirVentana(t, b, Number(t.duracion) || 0);
    if (r.duracionBroll !== null) entran.add(b.n);
  }
  return {
    aplica: true,
    probable: true,
    entran: broll.filter((b) => entran.has(b.n)).map((b) => b.n),
    fuera: broll.filter((b) => !entran.has(b.n)).map((b) => ({ n: b.n, toma: tomaDelBroll(b) })),
  };
}

/**
 * Unos audio/tiempos.json sinteticos (cada linea dura lo que su toma): con
 * ellos brollQueEntran da lo mismo que reglaBrollProbable. Solo para la prueba.
 */
export function tiemposSinteticos(m) {
  let inicio = 0;
  const lineas = (m.tomas || []).map((t) => {
    const l = { toma: t.n, tipo: t.tipo, texto: t.linea, duracionPrevista: t.duracion, inicio: r2(inicio), fin: r2(inicio + t.duracion), encontrada: true };
    inicio += Number(t.duracion) || 0;
    return l;
  });
  return { duracion: r2(inicio), lineas };
}

/** El precio de una imagen del plan (el mismo calculo que el CLI de generar-imagenes.js). null = sin precio medido. */
export function creditosDeImagen(t) {
  if (!t.cascada) return PRECIOS.imagen[MODELOS.imagen.principal]?.['1K'] ?? null;
  return PRECIOS.imagen[t.cascada[0]]?.[t.resoluciones?.[t.cascada[0]] || '1K'] ?? null;
}

/**
 * Las imagenes que se pagan: el plan de generar-imagenes.js filtrado como su
 * CLI (sin los frames heredados ni las copias de referencia, que no se pagan,
 * y sin la imagen de los B-roll que no entran). Lo que ya esta en img/ SI se
 * cuenta: es el costo del anuncio entero, no lo que falta.
 */
function imagenesPagadas(m, { eleccion, brollFuera = [], deduplicar = true } = {}) {
  const fuera = new Set(brollFuera);
  const plan = planDeImagenes(m, { eleccion: normalizarEleccion(eleccion) }).filter(
    (t) =>
      !(t.clase === 'broll' && fuera.has(t.n)) &&
      !((t.clase === 'toma' || t.clase === 'broll') && modoSinCobro(itemDeTrabajo(m, t)) === 'biblioteca')
  );
  // Igual que generar-imagenes: primero biblioteca/B-roll fuera, despues las
  // imagenes identicas que se copian sin cobro. Al regenerar UNA pieza la
  // imagen se pide suelta, aunque otra pieza comparta su prompt.
  const copias = deduplicar ? repetidas(plan) : new Map();
  return plan.filter((t) => t.clase !== 'heredado' && t.clase !== 'copia-de-referencia' && !copias.has(t));
}

export function costoImagenes(m, { eleccion, brollFuera = [] } = {}) {
  const plan = imagenesPagadas(m, { eleccion, brollFuera });
  let creditos = 0;
  let sinPrecio = 0;
  const porClase = {};
  for (const t of plan) {
    const c = creditosDeImagen(t);
    if (c === null) sinPrecio++;
    else creditos = r2(creditos + c);
    porClase[t.clase] = (porClase[t.clase] || 0) + 1;
  }
  return { creditos, piezas: plan.length, sinPrecio, porClase };
}

/** El tope de duracion de un modelo (el ultimo tramo o duracionMax). */
function topeDe(modelo) {
  const def = MODELOS_VIDEO[modelo];
  if (!def) return null;
  return Array.isArray(def.duraciones) && def.duraciones.length ? def.duraciones[def.duraciones.length - 1] : def.duracionMax ?? null;
}

/** Lo que cuesta un clip que pasa el tope del modelo: partido en las partes iguales que hagan falta. */
function creditosPartido(modelo, segundos, sonido) {
  const tope = topeDe(modelo);
  if (!tope || !Number.isFinite(segundos) || segundos <= 0) return { creditos: 0, partes: 0 };
  const partes = Math.ceil(segundos / tope);
  const r = creditosClip(modelo, segundos / partes, RESOLUCION_VIDEO, typeof sonido === 'boolean' ? { sonido } : {});
  return { creditos: r.excedeTope ? 0 : r2((r.creditos || 0) * partes), partes };
}

/** Si un clip de estimar() lleva imagen final y si va por referencias (para la cascada y las notas). */
function infoDelClip(m, d) {
  if (d.rol) return { frameFinal: d.tipo === 'paso' || d.tipo === 'B', referencias: false, clase: d.rol === 'paso' ? 'paso' : 'toma' };
  if (String(d.id).startsWith('broll-')) return { frameFinal: false, referencias: false, clase: 'broll' };
  const n = Number(String(d.id).replace(/^toma-/, ''));
  const t = (m.tomas || []).find((x) => x?.n === n) || { tipo: d.tipo };
  return { frameFinal: t.tipo === 'B', referencias: usaReferencias(t), clase: 'toma', toma: t };
}

/** La cascada de un clip del detalle de estimar(). */
function cascadaDelClip(m, d, eleccion) {
  if (d.rol) return cascadaVideo(eleccion, 'vozEnOff');
  const info = infoDelClip(m, d);
  const trabajo = info.clase === 'broll' ? { clase: 'broll', tipo: 'broll' } : { ...info.toma };
  return cascadaDelTrabajo(eleccion, m, trabajo);
}

/** La categoria de Ajustes › Modelos de un clip del detalle de estimar(). */
function categoriaDelClip(m, d) {
  if (d.rol) return 'vozEnOff';
  const info = infoDelClip(m, d);
  return categoriaDeVideo(m, info.clase === 'broll' ? { clase: 'broll', tipo: 'broll' } : info.toma);
}

/**
 * Por que un clip NO va con el primer modelo de su cascada, en palabras del
 * alumno (va despues de "Una escena" / "N escenas"): 'sin imagen final', 'con
 * imagen final', 'con referencias', 'con imagen inicial' o 'de mas de N s' (el
 * tope del primero).
 */
function porQueOtroModelo(primero, info) {
  const motivo = motivoParaSaltar(primero, info);
  if (!motivo) return topeDe(primero) ? `de más de ${topeDe(primero)} s` : 'más larga';
  if (/necesita imagen inicial y final/.test(motivo)) return 'sin imagen final';
  if (/no acepta frame final/.test(motivo)) return 'con imagen final';
  if (/no recibe imagenes de referencia/.test(motivo)) return 'con referencias';
  if (/solo trabaja con imagenes de referencia/.test(motivo)) return 'con imagen inicial';
  return 'que ese modelo no hace';
}

/**
 * Los videos: estimar() de estimar-video.js con la eleccion y la regla del
 * B-roll. Los clips que pasan el tope del modelo (estimar los deja en
 * `excedidos`) se suman partidos, que es lo que habria que hacer. Devuelve
 * tambien las notas de modelos (un clip que hace otro modelo de la cascada, o
 * un modelo que cobra un minimo de segundos).
 */
export function costoVideos(m, { eleccion, reglaBroll = { aplica: false }, tiempos = null } = {}) {
  const e = normalizarEleccion(eleccion);
  const est = estimarVideos(m, { eleccion: e, reglaBroll, tiempos });
  let creditos = est.creditos;
  let piezas = est.detalle.length;
  let partidos = 0;
  for (const c of est.excedidos) {
    const p = creditosPartido(c.modelo ?? MODELOS.video.principal, c.segundos, c.sonido);
    creditos = r2(creditos + p.creditos);
    piezas += p.partes;
    partidos++;
  }
  // Notas de modelos: los clips que hace otro modelo de su cascada, agrupados.
  const otros = new Map(); // `${modelo}|${porque}` -> cuantos
  const minimos = new Map(); // modelo -> segundos minimos cobrados
  const categorias = new Set();
  for (const d of est.detalle) {
    categorias.add(categoriaDelClip(m, d));
    const cascada = cascadaDelClip(m, d, e);
    const primero = cascada[0];
    if (d.modelo && primero && d.modelo !== primero) {
      const k = `${d.modelo}|${porQueOtroModelo(primero, infoDelClip(m, d))}`;
      otros.set(k, (otros.get(k) || 0) + 1);
    }
    const def = MODELOS_VIDEO[d.modelo];
    if (def?.cobro === 'por-segundo' && Number.isFinite(d.duracion) && d.duracion > Math.ceil(Number(d.segundos) - 1e-9) && def.duracionMin) minimos.set(d.modelo, def.duracionMin);
  }
  for (const c of est.excedidos) {
    categorias.add(categoriaDelClip(m, c));
  }
  const notasModelo = [];
  for (const [k, n] of otros) {
    const [modelo, porque] = k.split('|');
    notasModelo.push(`${escenas(n)} ${porque} se ${n === 1 ? 'hace' : 'hacen'} con ${nombreModelo(modelo) ?? modelo}.`);
  }
  for (const [modelo, s] of minimos) notasModelo.push(`${nombreModelo(modelo) ?? modelo} cobra como mínimo ${s} s por escena.`);
  const notas = [];
  if (partidos) {
    notas.push(`${escenas(partidos)} ${partidos === 1 ? 'dura' : 'duran'} más de lo que el modelo hace de una vez: se ${partidos === 1 ? 'cuenta partida' : 'cuentan partidas'}.`);
  }
  return { creditos, piezas, detalle: est.detalle, excedidos: est.excedidos.map((c) => c.id), categorias: [...categorias], notas, notasModelo };
}

/**
 * Los ganchos alternativos de UGC (si el brief los pide): el plan de
 * generar-videos.js con { ganchos: true }, cada uno con el modelo que de verdad
 * lo hace (modeloParaClip, por referencias).
 */
export function costoGanchos(m, { eleccion } = {}) {
  const e = normalizarEleccion(eleccion);
  const ganchos = planDeVideos(m, { ganchos: true, eleccion: e }).filter((t) => t.clase === 'gancho');
  let creditos = 0;
  const notasModelo = [];
  for (const g of ganchos) {
    const deSiempre = cascadaDelTrabajo(ELECCION_POR_DEFECTO, m, g);
    const modelo = modeloParaClip(g.cascada, { referencias: true }, g.segundos, { deSiempre });
    const r = creditosClip(modelo, g.segundos, RESOLUCION_VIDEO);
    creditos = r2(creditos + (r.excedeTope ? creditosPartido(modelo, g.segundos).creditos : r.creditos || 0));
    const def = MODELOS_VIDEO[modelo];
    if (def?.cobro === 'por-segundo' && def.duracionMin > Math.ceil(Number(g.segundos) - 1e-9)) {
      const t = `${nombreModelo(modelo) ?? modelo} cobra como mínimo ${def.duracionMin} s por escena.`;
      if (!notasModelo.includes(t)) notasModelo.push(t);
    }
  }
  return { creditos, piezas: ganchos.length, notasModelo };
}

/**
 * La musica de fondo: Suno (12) donde se genera y todavia no esta. Nada en los
 * cantados (la cancion es la musica), ni en podcast y entrevista (sin musica),
 * ni donde va la pista fija del estilo (si el archivo esta; con continuidad la
 * app nunca la pide a Suno).
 */
export function creditosMusica(familia, estilo, { hayMusica = false, pistaFijaDisponible = false } = {}) {
  if (hayMusica) return 0;
  if (CANTADAS.has(familia) || familia === 'hablado') return 0;
  if (ESTILOS_SIN_MUSICA.includes(estilo)) return 0;
  if (PISTA_FIJA[estilo] && (pistaFijaDisponible || familia === 'continuidad')) return 0;
  return CREDITOS_SUNO;
}

/**
 * La cancion de un cantado: 12 por estilo en la primera tanda (si todavia no
 * hay versiones) y 12 por cada parte que se agrega a la elegida (si la letra va
 * en bloques y la cancion todavia no esta completa).
 */
export function creditosCancion({ estilos = 1, bloques = 1, hayVersiones = false, completa = false } = {}) {
  const generaciones = hayVersiones ? 0 : Math.max(1, estilos);
  const extensiones = completa ? 0 : Math.max(0, bloques - 1);
  return { creditos: CREDITOS_SUNO * (generaciones + extensiones), generaciones, extensiones };
}

// ---------------------------------------------------------------- cantado tipico

/**
 * El manifiesto TIPICO de un cantado de `segundos` (ver CANTADO_TIPICO): las
 * tomas con largos alrededor de la media, las B repartidas, el B-roll del
 * musical (4 s, uno por toma, repartido) y las hojas que se generan. No se
 * produce nunca: solo se cobra con las mismas funciones que un manifiesto real.
 */
export function manifiestoTipico(familia, segundos) {
  const t = CANTADO_TIPICO[familia];
  if (!t) throw new Error(`No hay un cantado tipico para la familia "${familia}".`);
  const s = Math.max(10, Number(segundos) || t.segundosSinCancion);
  const n = Math.max(2, Math.round(s / t.segundosPorToma));
  const hojas = Array.from({ length: t.hojas }, (_, i) => ({ id: `hoja-${i + 1}`, tipo: 'personaje', prompt: `hoja tipica ${i + 1}` }));
  const tomas = [];
  for (let i = 0; i < n; i++) {
    const esB = Math.floor((i + 1) * t.fraccionB + 1e-9) > Math.floor(i * t.fraccionB + 1e-9);
    tomas.push({
      n: i + 1,
      tipo: esB ? 'B' : 'A',
      duracion: r2(t.segundosPorToma * FACTORES_DURACION[i % FACTORES_DURACION.length]),
      linea: '',
      prompt_imagen_inicial: `toma tipica ${i + 1} inicial`,
      ...(esB ? { prompt_imagen_final: `toma tipica ${i + 1} final` } : {}),
      prompt_video: 'toma tipica',
      referencias: hojas.length ? [hojas[i % hojas.length].id] : [],
    });
  }
  const nb = Math.min(n, Math.round(n * t.brollPorToma));
  const broll = Array.from({ length: nb }, (_, j) => ({
    n: j + 1,
    despues_de_toma: 1 + Math.floor((j * n) / nb),
    duracion: t.segundosBroll,
    prompt_imagen: `apoyo tipico ${j + 1}`,
    prompt_video: 'apoyo tipico',
    referencias: [],
  }));
  return {
    estilo: familia === 'historia-musical' ? 'historias-musicales' : 'musical',
    modo_audio: 'musica',
    referencias: [...hojas, { id: 'producto', tipo: 'producto', archivo: 'producto.png' }],
    tomas,
    broll,
  };
}

/** Las palabras que se cantan (sin las etiquetas [Verso], [Coro]...). */
export function palabrasDeLaLetra(letra) {
  return String(letra || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .split(/\s+/)
    .filter((p) => /[\p{L}\p{N}]/u.test(p)).length;
}

/**
 * Cuanto dura la cancion de un cantado, para el video: `segundos` (pedidos),
 * la de la cancion ya elegida, la de la version elegida o la media de las
 * versiones; sin cancion, en la historia las palabras de la letra / 2,1 y en el
 * musical CANTADO_TIPICO.segundosSinCancion. { segundos, de }.
 */
export function segundosDelCantado(familia, { segundos = null, cancion = null, versiones = [], elegida = null, letra = null, duracionEstimada = null } = {}) {
  const t = CANTADO_TIPICO[familia];
  if (Number(segundos) > 0) return { segundos: Number(segundos), de: 'pedido' };
  if (Number(cancion?.duracion) > 0) return { segundos: Number(cancion.duracion), de: 'cancion' };
  const conDuracion = versiones.filter((v) => Number(v.segundos) > 0);
  const laElegida = conDuracion.find((v) => v.n === Number(elegida));
  if (laElegida) return { segundos: laElegida.segundos, de: 'cancion' };
  if (conDuracion.length) return { segundos: r2(conDuracion.reduce((s, v) => s + v.segundos, 0) / conDuracion.length), de: 'versiones' };
  if (t?.palabrasPorSegundo && letra) {
    const p = palabrasDeLaLetra(letra);
    if (p > 0) return { segundos: Math.round(p / t.palabrasPorSegundo), de: 'letra' };
  }
  if (Number(duracionEstimada) > 0) return { segundos: Number(duracionEstimada), de: 'guion' };
  return { segundos: t?.segundosSinCancion ?? 100, de: 'tipico' };
}

/**
 * Las versiones de cancion/opciones.json con lo que va a durar la cancion
 * entera: en la historia con la letra en bloques, cada version es solo el
 * bloque 1 y la cancion dura lo que esa version / la parte de la letra que trae
 * (como opcionesDeCancion de la app).
 */
export function versionesDeCancion(opciones, peticion) {
  const pistas = Array.isArray(opciones?.pistas) ? opciones.pistas : [];
  const bloques = Array.isArray(peticion?.bloques) && peticion.bloques.length > 1 ? peticion.bloques : null;
  const largo = (t) => String(t || '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim().length;
  const fraccion = bloques ? largo(bloques[0]) / Math.max(1, bloques.reduce((s, b) => s + largo(b), 0)) : 1;
  return pistas.map((p, i) => {
    const d = Number(p?.duracion) || 0;
    return { n: i + 1, duracion: d || null, segundos: d > 0 ? Math.round(fraccion > 0.05 ? d / fraccion : d) : null };
  });
}

// ---------------------------------------------------------------- el estimado

/**
 * El estimado de un anuncio con UNA eleccion de modelos. `entrada`:
 *   { familia, estilo, manifiesto?, reglaBrollReal?, tiempos?, hayMusica?, pistaFijaDisponible?,
 *     ganchos?, cantado?: { segundos, estilos, bloques, hayVersiones, completa } }
 * Con manifiesto, pieza por pieza; sin el (cantados antes de las tomas), con el
 * manifiesto tipico de cantado.segundos.
 *
 * Devuelve { creditos: { min, max }, dolares, margen, partes, variable, fijo,
 * categorias (las de Ajustes › Modelos que usa), notas, notasModelo,
 * brollProbables?, brollTotal?, segundos? }.
 */
export function estimarCosto(entrada, { eleccion = null } = {}) {
  const e = normalizarEleccion(eleccion ?? ELECCION_POR_DEFECTO);
  const familia = entrada.familia;
  const margen = MARGEN_POR_FAMILIA[familia] ?? 0;
  const partes = [];
  const notas = [];
  const notasModelo = [];
  const categorias = new Set();
  let variable = 0;
  let fijo = 0;
  const extra = {};

  const cantadoSinTomas = CANTADAS.has(familia) && !entrada.manifiesto;
  let m = cantadoSinTomas ? manifiestoTipico(familia, entrada.cantado?.segundos) : entrada.manifiesto;
  if (!m) throw new Error('No hay manifiesto ni cancion que estimar.');
  if (familia === 'continuidad') m = simularPreparar(m);

  // La cancion (cantados): exacta.
  if (CANTADAS.has(familia) && entrada.cantado) {
    const c = creditosCancion(entrada.cantado);
    if (c.creditos > 0) {
      partes.push({ id: 'cancion', nombre: 'Canción', creditos: c.creditos, piezas: c.generaciones + c.extensiones });
      fijo += c.creditos;
    }
    if (cantadoSinTomas) extra.segundos = r2(entrada.cantado.segundos);
  }

  // El B-roll que entra: el de verdad (con la voz) o el probable; sin regla, todo.
  let regla = { aplica: false };
  if (!cantadoSinTomas && familia !== 'continuidad') {
    if (entrada.reglaBrollReal?.aplica) regla = entrada.reglaBrollReal;
    else {
      const probable = reglaBrollProbable(m);
      if (probable.aplica) regla = probable;
    }
  }
  const brollTotal = (m.broll || []).length;
  if (regla.aplica && brollTotal) {
    extra.brollTotal = brollTotal;
    extra.brollProbables = regla.entran.length;
    if (regla.probable && regla.entran.length < brollTotal) {
      notas.push(`Cuenta ${regla.entran.length} de ${brollTotal} imágenes de apoyo: las demás seguramente no entran en el video cuando esté la voz.`);
    }
  }
  const brollFuera = regla.aplica ? regla.fuera.map((f) => f.n) : [];

  // Imagenes
  const img = costoImagenes(m, { eleccion: e, brollFuera });
  if (img.piezas) {
    partes.push({ id: 'imagenes', nombre: 'Imágenes', creditos: img.creditos, piezas: img.piezas });
    variable += img.creditos;
    // los iconos de la entrevista no cambian con la eleccion: sin otras imagenes no hay nada que comparar
    if (img.piezas > (img.porClase.icono || 0)) categorias.add('imagen');
  }
  if (img.sinPrecio) notas.push(`${img.sinPrecio === 1 ? 'Una imagen no tiene' : `${img.sinPrecio} imágenes no tienen`} precio conocido: no ${img.sinPrecio === 1 ? 'está' : 'están'} en el número.`);

  // Videos
  const vid = costoVideos(m, { eleccion: e, reglaBroll: regla, tiempos: familia === 'continuidad' ? entrada.tiempos ?? null : null });
  if (vid.piezas) {
    partes.push({ id: 'videos', nombre: 'Videos', creditos: vid.creditos, piezas: vid.piezas });
    variable += vid.creditos;
  }
  for (const c of vid.categorias) categorias.add(c);
  notas.push(...vid.notas);
  notasModelo.push(...vid.notasModelo);

  // Ganchos alternativos (UGC, si el brief los pide)
  if (familia === 'ugc' && entrada.ganchos) {
    const g = costoGanchos(m, { eleccion: e });
    if (g.piezas) {
      partes.push({ id: 'ganchos', nombre: 'Otros ganchos', creditos: g.creditos, piezas: g.piezas });
      variable += g.creditos;
      categorias.add('ugc');
      notas.push(`Incluye ${g.piezas === 1 ? 'el gancho extra que pediste' : `los ${g.piezas} ganchos extra que pediste`}.`);
      for (const t of g.notasModelo) if (!notasModelo.includes(t)) notasModelo.push(t);
    }
  }

  // Musica de fondo
  const musica = creditosMusica(familia, entrada.estilo ?? m.estilo, { hayMusica: entrada.hayMusica, pistaFijaDisponible: entrada.pistaFijaDisponible });
  if (musica) {
    partes.push({ id: 'musica', nombre: 'Música', creditos: musica, piezas: 1 });
    fijo += musica;
  }

  variable = r2(variable);
  fijo = r2(fijo);
  const creditos = rango(variable, fijo, margen);
  for (const p of partes) p.dolares = dolaresDe({ min: p.creditos, max: p.creditos }).min;
  return {
    creditos,
    dolares: dolaresDe(creditos),
    margen,
    variable,
    fijo,
    partes,
    // en el orden de Ajustes › Modelos (los videos primero, las imagenes al final)
    categorias: CATALOGO.categorias.map((c) => c.id).filter((c) => categorias.has(c)),
    notas,
    notasModelo,
    ...extra,
  };
}

/** Solo el video de un cantado (imagenes y clips, sin la cancion): lo que cambia con el modelo y con la version. */
export function estimarVideoCantado(entrada, opciones) {
  // la cancion ya hecha y completa: no suma nada (lo demas, igual)
  return estimarCosto({ ...entrada, cantado: entrada.cantado ? { ...entrada.cantado, hayVersiones: true, completa: true } : null }, opciones);
}

/**
 * Cada opcion de cada categoria que usa el anuncio, UNA a la vez (las demas
 * como estan en `eleccion`), con el mismo estimarCosto. Las categorias donde
 * todas las opciones dan lo mismo no se devuelven. `soloVideo` (cantados):
 * sin la cancion, que no cambia con el modelo.
 */
export function compararModelos(entrada, { eleccion = null, categorias = null, soloVideo = false } = {}) {
  const e = normalizarEleccion(eleccion ?? ELECCION_POR_DEFECTO);
  const calcular = soloVideo ? estimarVideoCantado : estimarCosto;
  const base = calcular(entrada, { eleccion: e });
  const usadas = categorias ?? base.categorias;
  const salida = [];
  for (const cat of usadas) {
    const def = CATALOGO.categorias.find((c) => c.id === cat);
    if (!def) continue;
    const opciones = def.opciones.map((o) => {
      const r = o.id === e[cat] ? base : calcular(entrada, { eleccion: { ...e, [cat]: o.id } });
      return {
        id: o.id,
        nombre: o.nombre,
        elegida: o.id === e[cat],
        creditos: r.creditos,
        dolares: r.dolares,
        ...(r.notasModelo.length ? { nota: r.notasModelo.join(' ') } : {}),
      };
    });
    const distintas = new Set(opciones.map((o) => `${o.creditos.min}|${o.creditos.max}`));
    if (distintas.size < 2) continue;
    salida.push({ categoria: cat, nombre: def.nombre, elegida: e[cat], opciones });
  }
  return salida;
}

// ---------------------------------------------------------------- la carpeta

const leerJSON = (ruta) => {
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf8').replace(/^﻿/, ''));
  } catch {
    return null;
  }
};
const hayAudioEn = (dir) => {
  try {
    return fs.readdirSync(dir).some((n) => /\.(mp3|wav|m4a|ogg|flac)$/i.test(n));
  } catch {
    return false;
  }
};

/**
 * Lo que hace falta de la carpeta del anuncio (solo lee). `opciones.continuidad`
 * fuerza la continuidad aunque el brief no la diga.
 */
export function leerCarpeta(carpeta, { continuidad = false } = {}) {
  const abs = path.resolve(carpeta);
  const manifiesto = leerJSON(path.join(abs, 'manifiesto.json'));
  const brief = leerJSON(path.join(abs, 'app', 'brief.json'));
  const familia = familiaDe({ manifiesto, brief, continuidad });
  const estilo = (CANTADAS.has(familia) ? brief?.estilo : null) ?? manifiesto?.estilo ?? brief?.estilo ?? null;
  const ctx = {
    carpeta: abs,
    familia,
    estilo,
    manifiesto: manifiesto && Array.isArray(manifiesto.tomas) ? manifiesto : null,
    brief,
    hayMusica: hayAudioEn(path.join(abs, 'musica')),
    pistaFijaDisponible: Boolean(PISTA_FIJA[estilo] && fs.existsSync(path.join(RAIZ, 'recursos', 'musica', PISTA_FIJA[estilo]))),
  };
  if (ctx.manifiesto && familia !== 'continuidad' && !ESTILOS_HABLADOS.includes(ctx.manifiesto.estilo)) {
    ctx.reglaBrollReal = brollQueEntranEnCarpeta(ctx.manifiesto, abs);
  }
  if (ctx.manifiesto && familia === 'continuidad') ctx.tiempos = leerJSON(path.join(abs, 'audio', 'tiempos.json'));
  if (CANTADAS.has(familia)) {
    const peticion = leerJSON(path.join(abs, 'cancion', 'peticion.json'));
    const opciones = leerJSON(path.join(abs, 'cancion', 'opciones.json'));
    const letras = leerJSON(path.join(abs, 'app', 'letras.json'));
    const guion = leerJSON(path.join(abs, 'app', 'guion.json'));
    const eleccionCancion = leerJSON(path.join(abs, 'app', 'cancion-eleccion.json'));
    const cancion = leerJSON(path.join(abs, 'audio', 'cancion.json'));
    const completa = fs.existsSync(path.join(abs, 'audio', 'cancion.mp3')) && Number(cancion?.duracion) > 0;
    // la letra: la de la peticion (historia, o el musical ya aprobado) o la elegida de letras.json
    const elegidaN = Number(letras?.elegida ?? brief?.letraElegida);
    const opLetra = Array.isArray(letras?.opciones) ? letras.opciones.find((o) => Number(o?.n) === elegidaN) ?? (letras.opciones.length === 1 ? letras.opciones[0] : null) : null;
    const estilos = Array.isArray(peticion?.estilos) && peticion.estilos.length ? peticion.estilos.length : peticion?.estilo || opLetra ? 1 : familia === 'historia-musical' ? 2 : 1;
    const bloques = Array.isArray(peticion?.bloques) && peticion.bloques.length > 1 ? peticion.bloques.length : 1;
    const versiones = versionesDeCancion(opciones, peticion);
    ctx.cancion = {
      estilos,
      bloques,
      hayVersiones: versiones.length > 0,
      completa,
      versiones,
      elegida: Number(eleccionCancion?.n) || null,
      duracionCancion: completa ? Number(cancion.duracion) : null,
      letra: peticion?.letra ?? opLetra?.letra ?? null,
      duracionEstimada: Number(guion?.duracionEstimada) || null,
    };
  }
  return ctx;
}

/** La fase: 'guion' (hay manifiesto), 'letra' (cantado sin versiones de la cancion) o 'cancion' (la pausa). */
export function faseDe(ctx) {
  if (ctx.manifiesto) return 'guion';
  if (CANTADAS.has(ctx.familia)) return ctx.cancion?.hayVersiones ? 'cancion' : 'letra';
  return null;
}

/**
 * Todo junto, con la forma que imprime --json (ver arriba y API-costo):
 *   { ok, fase, familia, estilo, eleccion, margen, creditos, dolares, partes, notas, elevenlabs,
 *     modelos, brollProbables?, brollTotal?, segundos?, segundosDe?, comparaSobre?, comparar?,
 *     cancion?, video?, porCancion? }
 */
export function estimarCarpeta(ctx, { eleccion = null, comparar = false, segundos = null, porCancion = false, ganchos = false } = {}) {
  const fase = faseDe(ctx);
  if (!fase || !ctx.familia) {
    return { ok: false, error: 'Este anuncio todavía no tiene guion para estimar.', familia: ctx.familia ?? null, estilo: ctx.estilo ?? null };
  }
  const e = normalizarEleccion(eleccion ?? ELECCION_POR_DEFECTO);
  const base = {
    familia: ctx.familia,
    estilo: ctx.estilo,
    manifiesto: ctx.manifiesto,
    reglaBrollReal: ctx.reglaBrollReal ?? null,
    tiempos: ctx.tiempos ?? null,
    hayMusica: ctx.hayMusica,
    pistaFijaDisponible: ctx.pistaFijaDisponible,
    ganchos,
  };
  const cantado = CANTADAS.has(ctx.familia) && fase !== 'guion';
  let seg = null;
  if (cantado) {
    const c = ctx.cancion;
    seg = segundosDelCantado(ctx.familia, {
      segundos,
      cancion: c.duracionCancion ? { duracion: c.duracionCancion } : null,
      versiones: c.versiones,
      elegida: c.elegida,
      letra: c.letra,
      duracionEstimada: c.duracionEstimada,
    });
    base.cantado = { estilos: c.estilos, bloques: c.bloques, hayVersiones: c.hayVersiones, completa: c.completa, segundos: seg.segundos };
  }
  const r = estimarCosto(base, { eleccion: e });
  const usadas = [...r.categorias];
  const salida = {
    ok: true,
    fase,
    familia: ctx.familia,
    estilo: ctx.estilo,
    eleccion: e,
    margen: r.margen,
    creditos: r.creditos,
    dolares: r.dolares,
    partes: r.partes,
    ...(r.brollTotal !== undefined ? { brollProbables: r.brollProbables, brollTotal: r.brollTotal } : {}),
    ...(seg ? { segundos: seg.segundos, segundosDe: seg.de } : {}),
    modelos: usadas.map((cat) => ({ categoria: cat, nombreCategoria: nombreDeCategoria(cat), opcion: e[cat], nombre: nombreDeOpcion(cat, e[cat]) })),
    elevenlabs: notaElevenlabs(ctx.familia),
    notas: [...r.notas, ...r.notasModelo],
  };
  if (cantado) {
    const video = estimarVideoCantado(base, { eleccion: e });
    const cancionParte = r.partes.find((p) => p.id === 'cancion');
    salida.cancion = { creditos: cancionParte?.creditos ?? 0, dolares: cancionParte?.dolares ?? 0 };
    salida.video = { creditos: video.creditos, dolares: video.dolares };
    salida.comparaSobre = 'video';
    if (fase === 'cancion' && !ctx.cancion.completa) {
      const tanda = CREDITOS_SUNO * Math.max(1, ctx.cancion.estilos);
      salida.notas.push(`Si pides otras versiones de la canción, cada vez suma ${textoDolares(dolaresDe({ min: tanda }).min)}.`);
    }
  } else {
    salida.comparaSobre = 'total';
  }
  if (comparar) salida.comparar = compararModelos(base, { eleccion: e, categorias: usadas, soloVideo: cantado });
  if (porCancion && cantado && ctx.cancion.versiones.length) {
    salida.porCancion = ctx.cancion.versiones.map((v) => {
      const conEsta = { ...base, cantado: { ...base.cantado, segundos: v.segundos || seg.segundos } };
      const video = estimarVideoCantado(conEsta, { eleccion: e });
      return {
        n: v.n,
        segundos: v.segundos,
        creditos: video.creditos,
        dolares: video.dolares,
        ...(comparar ? { comparar: compararModelos(conEsta, { eleccion: e, categorias: usadas, soloVideo: true }) } : {}),
      };
    });
  }
  return salida;
}

// ---------------------------------------------------------------- regenerar una pieza

/**
 * Lo que cuesta REGENERAR cada pieza de un anuncio ya producido (el «Regenerar · ≈ US$ 0,42» del proceso y del
 * editor), con la eleccion del anuncio y las mismas funciones que el total: el clip con estimar() (o partido si pasa
 * el tope del modelo) y cada imagen con el precio del plan de generar-imagenes.js. Las hojas de personaje y las
 * copias de una referencia no se regeneran sueltas: no vienen.
 *   { ok, eleccion, piezas: { 'toma-3': { clip, imagen, conImagen }, 'broll-2': {...}, 'paso-4': {...}, 'gancho-1b': {...} } }
 * cada valor { creditos, dolares }. imagen = solo sus imagenes; conImagen = clip + imagenes.
 */
export function costoDePiezas(ctx, { eleccion = null } = {}) {
  const m = ctx?.manifiesto;
  if (!m || !Array.isArray(m.tomas)) return { ok: false, error: 'Este anuncio todavía no tiene guion para estimar.' };
  const e = normalizarEleccion(eleccion ?? ELECCION_POR_DEFECTO);
  const piezas = {};
  const sumar = (id, campo, creditos) => {
    if (!id) return;
    const p = (piezas[id] ||= { clip: 0, imagen: 0 });
    p[campo] = r2(p[campo] + (Number(creditos) || 0));
  };
  const est = estimarVideos(m, { eleccion: e, reglaBroll: { aplica: false }, tiempos: ctx.tiempos ?? null });
  for (const d of est.detalle) sumar(d.id, 'clip', d.creditos);
  for (const c of est.excedidos) sumar(c.id, 'clip', creditosPartido(c.modelo ?? MODELOS.video.principal, c.segundos, c.sonido).creditos);
  for (const t of imagenesPagadas(m, { eleccion: e, deduplicar: false })) {
    if (t.clase === 'heredado' || t.clase === 'copia-de-referencia') continue;
    const id = t.clase === 'broll' ? `broll-${t.n}` : t.clase === 'toma' ? `toma-${t.n}` : null;
    const c = creditosDeImagen(t);
    if (id && c !== null) sumar(id, 'imagen', c);
  }
  if (Array.isArray(m.ganchos_alternativos) && m.ganchos_alternativos.length) {
    for (const g of planDeVideos(m, { ganchos: true, eleccion: e }).filter((t) => t.clase === 'gancho')) {
      const deSiempre = cascadaDelTrabajo(ELECCION_POR_DEFECTO, m, g);
      const modelo = modeloParaClip(g.cascada, { referencias: true }, g.segundos, { deSiempre });
      const r = creditosClip(modelo, g.segundos, RESOLUCION_VIDEO);
      const id = String(g.id ?? g.archivo ?? '').replace(/\.mp4$/i, '');
      sumar(id.startsWith('gancho-') ? id : `gancho-${id}`, 'clip', r.excedeTope ? creditosPartido(modelo, g.segundos).creditos : r.creditos || 0);
    }
  }
  const conDolares = (cr) => ({ creditos: r2(cr), dolares: dolaresDe({ min: cr, max: cr }).min });
  return {
    ok: true,
    eleccion: e,
    piezas: Object.fromEntries(Object.entries(piezas).map(([id, p]) => [id, { clip: conDolares(p.clip), imagen: conDolares(p.imagen), conImagen: conDolares(p.clip + p.imagen) }])),
  };
}

// ---------------------------------------------------------------- CLI

/** --eleccion como JSON ('{"vozEnOff":"grok15"}') o como lista (vozEnOff=grok15,imagen=nb21). */
export function leerArgEleccion(texto) {
  const s = String(texto ?? '').trim();
  if (!s) return null;
  try {
    const v = JSON.parse(s);
    return esObjeto(v) ? v : null;
  } catch {
    const v = {};
    for (const par of s.split(/[,;\s]+/)) {
      const [k, x] = par.split('=');
      if (k && x) v[k.trim()] = x.trim();
    }
    return Object.keys(v).length ? v : null;
  }
}

function textoResumen(r, nombre) {
  const L = [`\n=== Costo estimado — ${nombre} ===\n`];
  if (!r.ok) return [...L, `  ${r.error}\n`].join('\n');
  const dinero = (d) => (d.min === d.max ? textoDolares(d.min) : `${textoDolares(d.min)} a ${textoDolares(d.max).replace('US$ ', '')}`);
  L.push(`  Familia: ${r.familia} (${r.estilo})   fase: ${r.fase}`);
  L.push(`  Modelos: ${r.modelos.map((x) => `${x.nombreCategoria}: ${x.nombre}`).join(' · ') || '—'}`);
  L.push(`  Total:   ${r.creditos.min} a ${r.creditos.max} creditos = ≈ ${dinero(r.dolares)}`);
  for (const p of r.partes) L.push(`           ${p.nombre.padEnd(14)} ${String(p.creditos).padStart(8)} creditos (${p.piezas})`);
  if (r.segundos) L.push(`  Cancion: unos ${Math.round(r.segundos)} s (${r.segundosDe})`);
  for (const n of r.notas) L.push(`  · ${n}`);
  if (r.elevenlabs) L.push(`  · ${r.elevenlabs}`);
  for (const c of r.comparar || []) {
    L.push(`\n  ${c.nombre}${r.comparaSobre === 'video' ? ' (solo el video)' : ''}:`);
    for (const o of c.opciones) L.push(`    ${o.elegida ? '*' : ' '} ${o.nombre.padEnd(34)} ${String(o.creditos.min).padStart(8)} a ${String(o.creditos.max).padStart(6)} cr = ≈ ${dinero(o.dolares)}${o.nota ? `   (${o.nota})` : ''}`);
  }
  for (const v of r.porCancion || []) L.push(`  Version ${v.n}: ${v.segundos} s -> video ≈ ${dinero(v.dolares)}`);
  L.push('\n  Sin red: no se pidio ni se cobro nada.\n');
  return L.join('\n');
}

if (process.argv[1] && path.basename(process.argv[1]) === 'estimar-costo.js') {
  const args = process.argv.slice(2);
  const valor = (k) => {
    const i = args.indexOf(k);
    return i !== -1 && args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[i + 1] : null;
  };
  const conValor = new Set(['--eleccion', '--segundos']);
  const carpetaArg = args.find((a, i) => !a.startsWith('--') && !conValor.has(args[i - 1]));
  const json = args.includes('--json');
  const salir = (r, codigo) => {
    if (json) process.stdout.write(`${JSON.stringify(r)}\n`);
    else console.log(textoResumen(r, carpetaArg ? path.basename(path.resolve(carpetaArg)) : '?'));
    process.exitCode = codigo;
  };
  if (!carpetaArg) {
    console.error('\n  Uso: node produccion/estimar-costo.js <carpeta-del-anuncio> [--json] [--eleccion <json>] [--comparar] [--cancion] [--segundos N] [--ganchos] [--continuidad]\n');
    process.exitCode = 1;
  } else if (!fs.existsSync(path.resolve(carpetaArg))) {
    salir({ ok: false, error: 'No encuentro la carpeta de ese anuncio.' }, 1);
  } else {
    try {
      const ctx = leerCarpeta(carpetaArg, { continuidad: args.includes('--continuidad') });
      const pedida = leerArgEleccion(valor('--eleccion'));
      const eleccion = pedida ? normalizarEleccion(pedida) : leerEleccion(ctx.carpeta);
      if (args.includes('--piezas')) {
        const r = costoDePiezas(ctx, { eleccion });
        if (json) process.stdout.write(`${JSON.stringify(r)}\n`);
        else for (const [id, p] of Object.entries(r.piezas || {})) console.log(`  ${id.padEnd(12)} clip ${textoDolares(p.clip.dolares)}   con su imagen ${textoDolares(p.conImagen.dolares)}`);
        process.exitCode = r.ok ? 0 : 1;
      } else {
        const r = estimarCarpeta(ctx, {
          eleccion,
          comparar: args.includes('--comparar'),
          segundos: Number(valor('--segundos')) || null,
          porCancion: args.includes('--cancion'),
          ganchos: args.includes('--ganchos'),
        });
        salir(r, r.ok ? 0 : 1);
      }
    } catch (e) {
      salir({ ok: false, error: 'No pude calcular el costo de este anuncio.', detalle: String(e?.message || e).slice(0, 300) }, 1);
    }
  }
}

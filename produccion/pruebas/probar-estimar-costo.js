// Prueba SIN RED del costo estimado (produccion/estimar-costo.js). No pide nada a
// nadie, no escribe nada en el proyecto (solo una carpeta temporal del sistema
// para el CLI) y no levanta ningun servidor.
//
//   node produccion/pruebas/probar-estimar-costo.js
//
// Sale con 0 si todo da; con 1 y el detalle de lo que fallo si no.
//
//   1. Manifiestos de ejemplo chicos, armados aca, uno por familia: voz en off
//      (con la regla del B-roll antes de la voz), continuidad (simulando
//      --preparar), objeto parlante, UGC con ganchos, podcast, entrevista con
//      iconos, musical e historia musical sin manifiesto (letra y pausa de la
//      cancion), clips que pasan el tope; la musica de fondo de cada estilo.
//   2. Comparar modelos: cada opcion = estimarCosto con esa eleccion, y las
//      caidas de la cascada (PixVerse sin imagen final -> Grok 1.5, Grok v1 desde
//      6 s, el tope de Omni).
//   3. El CLI con --json en una carpeta temporal.
//   4. Si estan, los anuncios reales de temp/ (en el CI no estan: se salta con
//      un aviso): con los B-roll que de verdad entraron, lo estimado = lo cobrado
//      (bloom 1.126, claymation 1047 626, claymation 1913 772 sin el rehecho,
//      objeto parlante 1.932); la matriz por modelo medida antes de la voz; y los
//      cantados (cancion tipica) dentro de +-25 % de lo que da su manifiesto real.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { creditosClip, PRECIOS } from '../config.js';
import { brollQueEntran } from '../planear-montaje.js';
import { CATALOGO, ELECCION_POR_DEFECTO, leerEleccion } from '../modelos-elegidos.js';
import {
  CANTADO_TIPICO,
  CREDITOS_SUNO,
  MARGEN_POR_FAMILIA,
  compararModelos,
  costoDePiezas,
  costoImagenes,
  creditosCancion,
  creditosMusica,
  dolaresDe,
  estimarCarpeta,
  estimarCosto,
  estimarVideoCantado,
  familiaDe,
  leerArgEleccion,
  leerCarpeta,
  manifiestoTipico,
  palabrasDeLaLetra,
  rango,
  reglaBrollProbable,
  segundosDelCantado,
  simularPreparar,
  textoDolares,
  tiemposSinteticos,
  versionesDeCancion,
} from '../estimar-costo.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const TEMP = path.join(RAIZ, 'temp');
const SCRIPT = path.join(RAIZ, 'produccion', 'estimar-costo.js');

const OMNI = 'google/gemini-omni-flash-1-2';
const KLING = 'kling-3.0/video';
const GROK15 = 'grok-imagine-video-1-5-preview';
const GROK1 = 'grok-imagine/image-to-video';
const PIXVERSE = 'pixverse-v6/transition';
const cr = (modelo, s, o) => creditosClip(modelo, s, '720p', o).creditos;
const r2 = (x) => Math.round(x * 100) / 100;

let ok = 0;
const fallos = [];
function caso(nombre, fn) {
  try {
    fn();
    ok++;
  } catch (e) {
    fallos.push(`${nombre}\n      ${String(e.message).split('\n').join('\n      ')}`);
  }
}
const seccion = (t) => console.log(`\n${t}`);
function bloque(titulo, fn) {
  const antes = fallos.length;
  const okAntes = ok;
  fn();
  console.log(`  ${fallos.length === antes ? 'OK' : 'FALLA'}  ${titulo} (${ok - okAntes + (fallos.length - antes)} comprobaciones)`);
}
const parte = (r, id) => r.partes.find((p) => p.id === id)?.creditos ?? 0;
const opcion = (comp, cat, id) => comp.find((c) => c.categoria === cat)?.opciones.find((o) => o.id === id);

// ------------------------------------------------------------------ ejemplos

const hoja = (id) => ({ id, tipo: 'personaje', prompt: `hoja ${id}` });
const producto = { id: 'producto', tipo: 'producto', archivo: 'producto.png' };

/** Voz en off: toma 1 corta (su B-roll no entra), toma 2 B y toma 3 A largas (sus B-roll entran). */
function claymation() {
  return {
    estilo: 'claymation',
    modo_audio: 'voz_en_off',
    referencias: [hoja('nina'), hoja('perro'), producto],
    tomas: [
      { n: 1, tipo: 'A', duracion: 2.5, linea: 'Uno.', prompt_imagen_inicial: 'imagen de prueba 1', prompt_video: 'x', referencias: ['nina'] },
      { n: 2, tipo: 'B', duracion: 4.5, linea: 'Dos.', prompt_imagen_inicial: 'imagen de prueba 2', prompt_imagen_final: 'imagen de prueba 3', prompt_video: 'x', referencias: ['nina', 'producto'] },
      { n: 3, tipo: 'A', duracion: 5, linea: 'Tres.', prompt_imagen_inicial: 'imagen de prueba 4', prompt_video: 'x', referencias: ['nina'] },
    ],
    broll: [
      { n: 1, despues_de_toma: 1, duracion: 3, prompt_imagen: 'imagen de prueba 5', prompt_video: 'x', referencias: ['perro'] },
      { n: 2, despues_de_toma: 2, duracion: 2, prompt_imagen: 'imagen de prueba 6', prompt_video: 'x', referencias: [] },
      { n: 3, despues_de_toma: 3, duracion: 3, prompt_imagen: 'imagen de prueba 7', prompt_video: 'x', referencias: [] },
    ],
  };
}

function objetoParlante() {
  return {
    estilo: 'talking-object-pixar',
    modo_audio: 'dialogo_nativo',
    referencias: [hoja('chicle'), producto],
    tomas: [
      { n: 1, tipo: 'A', duracion: 6, linea: 'Hola.', prompt_imagen_inicial: 'imagen de prueba 8', prompt_video: 'x', referencias: ['chicle'] },
      { n: 2, tipo: 'C', duracion: 8, linea: 'Chau.', prompt_imagen_inicial: 'imagen de prueba 9', prompt_video: 'x', referencias: ['chicle'] },
    ],
    broll: [{ n: 1, encima_de_toma: 2, duracion: 3, prompt_imagen: 'imagen de prueba 10', prompt_video: 'x', referencias: [] }],
  };
}

function ugc() {
  return {
    estilo: 'ugc',
    modo_audio: 'dialogo_nativo',
    referencias: [hoja('persona'), producto],
    tomas: [
      { n: 1, tipo: 'R', duracion: 10, prompt_video: 'x', referencias: ['persona', 'producto'] },
      { n: 2, tipo: 'R', duracion: 4, prompt_video: 'x', referencias: ['persona', 'producto'] },
    ],
    broll: [],
    ganchos_alternativos: [{ id: '1b', reemplaza: 1, duracion: 10, prompt_video: 'x', referencias: ['persona', 'producto'] }],
  };
}

function podcast() {
  return {
    estilo: 'podcast',
    modo_audio: 'dialogo_nativo',
    referencias: [hoja('host-a'), hoja('host-b'), producto],
    tomas: [
      { n: 1, tipo: 'H', duracion: 10, frame_inicial: 'host-a', prompt_video: 'x', referencias: [] },
      { n: 2, tipo: 'H', duracion: 6, frame_inicial: 'host-b', prompt_video: 'x', referencias: [] },
    ],
    broll: [{ n: 1, encima_de_toma: 1, duracion: 5, prompt_imagen: 'imagen de prueba 11', prompt_video: 'x', referencias: ['producto'] }],
  };
}

function entrevista() {
  return {
    estilo: 'entrevista',
    modo_audio: 'dialogo_nativo',
    referencias: [hoja('persona'), hoja('calle'), producto],
    tomas: [
      { n: 1, tipo: 'H', duracion: 8, prompt_imagen_inicial: 'imagen de prueba 12', prompt_video: 'x', referencias: ['persona', 'calle'], ingredientes: ['imagen', 'persona'] },
      { n: 2, tipo: 'H', duracion: 6, prompt_imagen_inicial: 'imagen de prueba 13', prompt_video: 'x', referencias: ['persona', 'calle'] },
    ],
    broll: [],
    iconos: [{ grupo: 'g1', toma: 2, iconos: [{ id: 'icono-sol', prompt: 'x' }, { id: 'icono-luna', prompt: 'x' }] }],
  };
}

const entrada = (m, extra = {}) => ({ familia: familiaDe({ manifiesto: m }), estilo: m.estilo, manifiesto: m, hayMusica: false, ...extra });

// ------------------------------------------------------------------ 1
seccion('1. Ejemplos por familia');

bloque('voz en off: la regla del B-roll antes de la voz, imágenes, videos y música', () => {
  const m = claymation();
  const regla = reglaBrollProbable(m);
  caso('regla probable: entran los B-roll de las tomas 2 y 3', () => assert.deepEqual(regla.entran, [2, 3]));
  caso('regla probable = brollQueEntran con tiempos sintéticos', () => {
    const b = brollQueEntran(m, tiemposSinteticos(m));
    assert.equal(b.aplica, true);
    assert.deepEqual(b.entran, regla.entran);
  });
  const r = estimarCosto(entrada(m));
  // hojas nina + perro (perro solo la usa el B-roll 1, que no entra, pero la hoja se genera igual), 3 iniciales, 1 final, 2 B-roll
  caso('imágenes: 2 hojas + 3 iniciales + 1 final + 2 B-roll = 8 × 10', () => assert.equal(parte(r, 'imagenes'), 80));
  const videos = cr(OMNI, 2.5) + cr(OMNI, 4.5) + cr(OMNI, 5) + cr(OMNI, 2) + cr(OMNI, 3);
  caso(`videos: 3 tomas + 2 B-roll con Omni = ${videos}`, () => assert.equal(parte(r, 'videos'), videos));
  caso('música de fondo con Suno (claymation) = 12', () => assert.equal(parte(r, 'musica'), CREDITOS_SUNO));
  caso('min = imágenes + videos + música', () => assert.equal(r.creditos.min, 80 + videos + 12));
  caso('max = min: sin margen de rehechos (todo al primer intento)', () => assert.equal(r.creditos.max, r.creditos.min));
  caso('dólares = créditos × 0,005, un solo número', () => assert.deepEqual(r.dolares, { min: r2(r.creditos.min * 0.005), max: r2(r.creditos.min * 0.005) }));
  caso('margen de voz en off = 0', () => assert.equal(r.margen, 0));
  caso('cuenta 2 de 3 imágenes de apoyo y lo dice', () => {
    assert.equal(r.brollProbables, 2);
    assert.equal(r.brollTotal, 3);
    assert.ok(r.notas.some((n) => /2 de 3 imágenes de apoyo/.test(n)), r.notas);
  });
  caso('categorías: voz en off e imágenes', () => assert.deepEqual(r.categorias, ['vozEnOff', 'imagen']));
  // con la voz de verdad (la regla que da la carpeta) entra el que diga ella
  const real = estimarCosto(entrada(m, { reglaBrollReal: { aplica: true, entran: [1, 2, 3], fuera: [] } }));
  caso('con la regla de la voz real: cuenta los 3 B-roll', () => assert.equal(parte(real, 'videos'), videos + cr(OMNI, 3)));
  const conMusica = estimarCosto(entrada(m, { hayMusica: true }));
  caso('con la música ya hecha no se suma Suno', () => assert.equal(parte(conMusica, 'musica'), 0));
});

bloque('continuidad: simula --preparar y estima la cadena', () => {
  const m = claymation();
  const sim = simularPreparar(m);
  caso('--preparar en memoria: broll vacío y el del paquete en broll_descartado', () => {
    assert.deepEqual(sim.broll, []);
    assert.equal(sim.continuidad.broll_descartado.length, 3);
    assert.deepEqual(sim.continuidad.pasos, []);
    assert.equal(m.broll.length, 3, 'el manifiesto original no cambia');
  });
  const e = { familia: familiaDe({ manifiesto: m, brief: { estilo: 'claymation', continuidad: true } }), estilo: 'claymation', manifiesto: m, hayMusica: false };
  caso('familia continuidad con el brief', () => assert.equal(e.familia, 'continuidad'));
  const r = estimarCosto(e);
  // la hoja "perro" solo la usaba el B-roll descartado: no se genera
  caso('imágenes: hoja nina + 3 iniciales + 1 final (sin B-roll ni su hoja) = 5 × 10', () => assert.equal(parte(r, 'imagenes'), 50));
  // paso-1 (2,5 s), toma-2 propio (4,5 s), paso-2 (B: el tramo mínimo, 3 s con Omni 1.2), cierre toma-3 (5 s)
  const cadena = cr(OMNI, 2.5) + cr(OMNI, 4.5) + cr(OMNI, 3) + cr(OMNI, 5);
  caso(`cadena: 2 pasos + 1 propio + cierre = ${cadena}`, () => assert.equal(parte(r, 'videos'), cadena));
  caso('4 clips', () => assert.equal(r.partes.find((p) => p.id === 'videos').piezas, 4));
  caso('margen continuidad 0 y Suno en claymation', () => {
    assert.equal(r.margen, 0);
    assert.equal(parte(r, 'musica'), 12);
  });
  caso('sin regla del B-roll (no hay B-roll)', () => assert.equal(r.brollTotal, undefined));
  const pix = estimarCosto(e, { eleccion: { vozEnOff: 'pixverse-grok15' } });
  // PixVerse hace lo que tiene imagen final (pasos y propio); el cierre de una A va a Grok 1.5
  const esperado = cr(PIXVERSE, 2.5) + cr(PIXVERSE, 4.5) + cr(PIXVERSE, 3) + cr(GROK15, 5);
  caso(`PixVerse: pasos y propio con PixVerse, el cierre con Grok 1.5 (${esperado})`, () => assert.equal(parte(pix, 'videos'), esperado));
  caso('PixVerse: la nota dice qué escena va con Grok 1.5', () => assert.ok(pix.notasModelo.some((n) => /Una escena sin imagen final se hace con Grok Imagine 1\.5/.test(n)), pix.notasModelo));
  const skeleton = estimarCosto({ ...e, estilo: 'skeleton', manifiesto: { ...m, estilo: 'skeleton' } });
  caso('continuidad en skeleton: sin Suno', () => assert.equal(parte(skeleton, 'musica'), 0));
});

bloque('objeto parlante: todo el B-roll, sin margen', () => {
  const m = objetoParlante();
  const r = estimarCosto(entrada(m));
  caso('familia objeto-parlante', () => assert.equal(familiaDe({ manifiesto: m }), 'objeto-parlante'));
  caso('imágenes: 1 hoja + 2 iniciales + 1 B-roll = 40', () => assert.equal(parte(r, 'imagenes'), 40));
  caso('videos: 6 s + 8 s + B-roll 3 s con Omni', () => assert.equal(parte(r, 'videos'), cr(OMNI, 6) + cr(OMNI, 8) + cr(OMNI, 3)));
  caso('Suno 12 y sin margen', () => {
    assert.equal(parte(r, 'musica'), 12);
    assert.equal(r.margen, 0);
  });
  caso('categorías: personajes que hablan e imágenes', () => assert.deepEqual(r.categorias, ['objetoParlante', 'imagen']));
  const grok = estimarCosto(entrada(m), { eleccion: { objetoParlante: 'grok15' } });
  caso('con Grok 1.5', () => assert.equal(parte(grok, 'videos'), cr(GROK15, 6) + cr(GROK15, 8) + cr(GROK15, 3)));
});

bloque('UGC: bloques por referencias y ganchos', () => {
  const m = ugc();
  const sin = estimarCosto(entrada(m));
  const con = estimarCosto(entrada(m, { ganchos: true }));
  caso('familia ugc', () => assert.equal(familiaDe({ manifiesto: m }), 'ugc'));
  caso('imágenes: solo la hoja de la persona (GPT Image 2.5 a 2K) = 10', () => assert.equal(parte(sin, 'imagenes'), 10));
  caso('videos: bloques de 10 y 4 s con Omni', () => assert.equal(parte(sin, 'videos'), cr(OMNI, 10) + cr(OMNI, 4)));
  caso('sin pedirlos, no hay ganchos', () => assert.equal(parte(sin, 'ganchos'), 0));
  caso('con ganchos: uno de 10 s con Omni = 126, aparte', () => {
    assert.equal(parte(con, 'ganchos'), cr(OMNI, 10));
    assert.ok(con.notas.some((n) => /gancho extra/.test(n)), con.notas);
  });
  caso('UGC sin margen, con los ganchos: max = min', () => assert.equal(con.creditos.max, r2(10 + cr(OMNI, 10) + cr(OMNI, 4) + cr(OMNI, 10) + 12)));
  const grok = estimarCosto(entrada(m, { ganchos: true }), { eleccion: { ugc: 'grok' } });
  caso('Grok Imagine (v1): el bloque de 4 s se cobra de 6 s', () => assert.equal(parte(grok, 'videos'), cr(GROK1, 10) + cr(GROK1, 6)));
  caso('Grok Imagine: el gancho también', () => assert.equal(parte(grok, 'ganchos'), cr(GROK1, 10)));
  caso('Grok Imagine: la nota del mínimo de 6 s', () => assert.ok(grok.notasModelo.some((n) => /Grok Imagine cobra como mínimo 6 s/.test(n)), grok.notasModelo));
  const nb = estimarCosto(entrada(m), { eleccion: { imagen: 'nb21' } });
  caso('Nano Banana 2.1: la hoja a 6', () => assert.equal(parte(nb, 'imagenes'), 6));
});

bloque('podcast: copias gratis, B-roll mudo con Kling, sin música', () => {
  const m = podcast();
  const r = estimarCosto(entrada(m));
  caso('familia hablado', () => assert.equal(familiaDe({ manifiesto: m }), 'hablado'));
  caso('imágenes: 2 hojas + 1 B-roll (las tomas H copian su frame, gratis) = 30', () => assert.equal(parte(r, 'imagenes'), 30));
  caso('videos: Omni 10 s + 6 s, B-roll de 5 s con Kling mudo', () => assert.equal(parte(r, 'videos'), r2(cr(OMNI, 10) + cr(OMNI, 6) + cr(KLING, 5, { sonido: false }))));
  caso('sin música y sin margen', () => {
    assert.equal(parte(r, 'musica'), 0);
    assert.equal(r.margen, 0);
  });
  caso('categorías: podcast y entrevista, su B-roll e imágenes', () => assert.deepEqual(r.categorias, ['podcastEntrevista', 'brollHablado', 'imagen']));
  const grok = estimarCosto(entrada(m), { eleccion: { podcastEntrevista: 'grok', brollHablado: 'grok15' } });
  caso('Grok: las H con frame van con Grok 1.5 y el B-roll con Grok 1.5', () => assert.equal(parte(grok, 'videos'), cr(GROK15, 10) + cr(GROK15, 6) + cr(GROK15, 5)));
});

bloque('entrevista: tomas por ingredientes e iconos fijos', () => {
  const m = entrevista();
  const r = estimarCosto(entrada(m));
  caso('imágenes: 2 hojas + 2 iniciales a 10 y 2 iconos a 6', () => assert.equal(parte(r, 'imagenes'), 4 * 10 + 2 * PRECIOS.imagen['gpt-image-2']['1K']));
  caso('el plan de imágenes por clase (como el CLI de generar-imagenes)', () =>
    assert.deepEqual(costoImagenes(m, { eleccion: ELECCION_POR_DEFECTO }).porClase, { referencia: 2, toma: 2, icono: 2 })
  );
  const nb = estimarCosto(entrada(m), { eleccion: { imagen: 'nb21' } });
  caso('Nano Banana 2.1 no cambia los iconos', () => assert.equal(parte(nb, 'imagenes'), 4 * 6 + 2 * 6));
  const grok = estimarCosto(entrada(m), { eleccion: { podcastEntrevista: 'grok' } });
  caso('Grok: la H por ingredientes con Grok Imagine (v1) y la otra con Grok 1.5', () => assert.equal(parte(grok, 'videos'), cr(GROK1, 8) + cr(GROK15, 6)));
  caso('sin B-roll no aparece su categoría', () => assert.deepEqual(r.categorias, ['podcastEntrevista', 'imagen']));
});

bloque('clips que pasan el tope del modelo', () => {
  // Omni 1.2 hace hasta 15 s, pero con imagen final hasta 10: una B de 12 s se parte en dos de 6 s
  const sinFinal = claymation();
  sinFinal.tomas[2].duracion = 12;
  sinFinal.broll = [];
  caso('una A de 12 s: Omni 1.2 la hace de una vez', () => assert.equal(parte(estimarCosto(entrada(sinFinal)), 'videos'), cr(OMNI, 2.5) + cr(OMNI, 4.5) + cr(OMNI, 12)));
  const m = claymation();
  m.tomas[2] = { ...m.tomas[2], tipo: 'B', duracion: 12, prompt_imagen_final: 'imagen de prueba final' };
  m.broll = [];
  const r = estimarCosto(entrada(m));
  caso('una B de 12 s con la cascada de siempre se cuenta partida (2 × 6 s con Omni)', () => assert.equal(parte(r, 'videos'), cr(OMNI, 2.5) + cr(OMNI, 4.5) + 2 * cr(OMNI, 6)));
  caso('y lo dice', () => assert.ok(r.notas.some((n) => /Una escena dura más de lo que el modelo hace de una vez/.test(n)), r.notas));
  const grok = estimarCosto(entrada(m), { eleccion: { vozEnOff: 'grok15' } });
  caso('Grok 1.5 llega a 15 s: sin partir', () => assert.equal(parte(grok, 'videos'), cr(GROK15, 2.5) + cr(GROK15, 4.5) + cr(GROK15, 12)));
});

bloque('música de fondo según el estilo', () => {
  caso('claymation, crochet, pixar, objeto parlante y UGC: Suno', () => {
    for (const [f, e] of [['voz-en-off', 'claymation'], ['voz-en-off', 'crochet'], ['voz-en-off', 'estilo-pixar'], ['objeto-parlante', 'talking-object-pixar'], ['ugc', 'ugc']]) assert.equal(creditosMusica(f, e), 12, e);
  });
  caso('zack-d, skeleton y lego con su pista: 0; sin la pista: Suno', () => {
    for (const e of ['zack-d-films', 'skeleton', 'estilo-lego']) {
      assert.equal(creditosMusica('voz-en-off', e, { pistaFijaDisponible: true }), 0, e);
      assert.equal(creditosMusica('voz-en-off', e, { pistaFijaDisponible: false }), 12, e);
      assert.equal(creditosMusica('continuidad', e), 0, e);
    }
  });
  caso('podcast, entrevista y cantados: 0', () => {
    assert.equal(creditosMusica('hablado', 'podcast'), 0);
    assert.equal(creditosMusica('hablado', 'entrevista'), 0);
    assert.equal(creditosMusica('musical', 'musical'), 0);
    assert.equal(creditosMusica('historia-musical', 'historias-musicales'), 0);
  });
  caso('con la música ya en musica/: 0', () => assert.equal(creditosMusica('voz-en-off', 'claymation', { hayMusica: true }), 0));
});

bloque('cantados sin manifiesto: la canción exacta y el video típico', () => {
  caso('canción: 12 × estilos + 12 × (bloques − 1)', () => {
    assert.equal(creditosCancion({ estilos: 1, bloques: 1 }).creditos, 12);
    assert.equal(creditosCancion({ estilos: 2, bloques: 3 }).creditos, 48);
    assert.equal(creditosCancion({ estilos: 2, bloques: 3, hayVersiones: true }).creditos, 24);
    assert.equal(creditosCancion({ estilos: 2, bloques: 3, hayVersiones: true, completa: true }).creditos, 0);
  });
  const mt = manifiestoTipico('musical', 100);
  caso('musical típico de 100 s: 22 tomas (3 B), 13 B-roll de 4 s, 1 hoja', () => {
    assert.equal(mt.tomas.length, 22);
    assert.equal(mt.tomas.filter((t) => t.tipo === 'B').length, 3);
    assert.equal(mt.broll.length, 13);
    assert.ok(mt.broll.every((b) => b.duracion === 4));
    assert.equal(new Set(mt.broll.map((b) => b.despues_de_toma)).size, 13, 'uno por toma');
    assert.equal(mt.referencias.filter((r) => r.prompt).length, 1);
  });
  caso('la media de los largos es la de CANTADO_TIPICO', () => {
    const h = manifiestoTipico('historia-musical', 300);
    const media = h.tomas.reduce((s, t) => s + t.duracion, 0) / h.tomas.length;
    assert.ok(Math.abs(media - CANTADO_TIPICO['historia-musical'].segundosPorToma) < 0.1, media);
    assert.equal(h.broll.length, 0);
  });
  const e = { familia: 'musical', estilo: 'musical', manifiesto: null, hayMusica: false, cantado: { estilos: 1, bloques: 1, hayVersiones: false, completa: false, segundos: 100 } };
  const r = estimarCosto(e);
  caso('musical en la letra: canción 12 + imágenes 1 + 22 + 3 + 13 a 10', () => {
    assert.equal(parte(r, 'cancion'), 12);
    assert.equal(parte(r, 'imagenes'), (1 + 22 + 3 + 13) * 10);
  });
  caso('sin margen: max = min (canción incluida)', () => assert.equal(r.creditos.max, r.creditos.min));
  caso('sin música de fondo', () => assert.equal(parte(r, 'musica'), 0));
  caso('el video solo (estimarVideoCantado) = total − canción', () => assert.equal(estimarVideoCantado(e).creditos.min, r2(r.creditos.min - 12)));
  caso('segundos de la historia: palabras / 2,1; la versión elegida; la media; lo pedido', () => {
    const letra = `[Verso]\n${'palabra '.repeat(420)}\n[Coro]\n${'otra '.repeat(210)}`;
    assert.equal(palabrasDeLaLetra(letra), 630);
    assert.deepEqual(segundosDelCantado('historia-musical', { letra }), { segundos: 300, de: 'letra' });
    assert.deepEqual(segundosDelCantado('musical', { letra }), { segundos: 100, de: 'tipico' });
    const versiones = [{ n: 1, segundos: 100 }, { n: 2, segundos: 120 }];
    assert.deepEqual(segundosDelCantado('musical', { versiones }), { segundos: 110, de: 'versiones' });
    assert.deepEqual(segundosDelCantado('musical', { versiones, elegida: 2 }), { segundos: 120, de: 'cancion' });
    assert.deepEqual(segundosDelCantado('musical', { versiones, segundos: 90 }), { segundos: 90, de: 'pedido' });
  });
  caso('versiones de la historia en bloques: la canción entera = versión / parte de la letra', () => {
    const pet = { bloques: ['a'.repeat(100), 'b'.repeat(300)] };
    const v = versionesDeCancion({ pistas: [{ duracion: 60 }, { duracion: 80 }] }, pet);
    assert.deepEqual(v.map((x) => x.segundos), [240, 320]);
    assert.deepEqual(versionesDeCancion({ pistas: [{ duracion: 101.4 }] }, {}).map((x) => x.segundos), [101]);
  });
});

// ------------------------------------------------------------------ 2
seccion('2. Comparar modelos');

bloque('cada opción = estimarCosto con esa elección (una categoría a la vez)', () => {
  const ejemplos = {
    'voz en off': entrada(claymation()),
    continuidad: { familia: 'continuidad', estilo: 'claymation', manifiesto: claymation(), hayMusica: false },
    'objeto parlante': entrada(objetoParlante()),
    ugc: entrada(ugc(), { ganchos: true }),
    podcast: entrada(podcast()),
    entrevista: entrada(entrevista()),
    musical: { familia: 'musical', estilo: 'musical', manifiesto: null, hayMusica: false, cantado: { estilos: 1, bloques: 1, segundos: 100 } },
  };
  for (const [nombre, e] of Object.entries(ejemplos)) {
    for (const base of [ELECCION_POR_DEFECTO, { ...ELECCION_POR_DEFECTO, vozEnOff: 'grok15', imagen: 'nb21', podcastEntrevista: 'grok' }]) {
      const soloVideo = e.familia === 'musical';
      const comp = compararModelos(e, { eleccion: base, soloVideo });
      caso(`${nombre}: hay categorías para comparar`, () => assert.ok(comp.length >= 1, JSON.stringify(comp)));
      for (const c of comp) {
        for (const o of c.opciones) {
          caso(`${nombre} · ${c.categoria}=${o.id}`, () => {
            const el = { ...base, [c.categoria]: o.id };
            const directo = soloVideo ? estimarVideoCantado(e, { eleccion: el }) : estimarCosto(e, { eleccion: el });
            assert.deepEqual(o.creditos, directo.creditos);
            assert.deepEqual(o.dolares, directo.dolares);
            assert.equal(o.elegida, o.id === base[c.categoria]);
            assert.ok(o.creditos.min <= o.creditos.max);
          });
        }
      }
    }
  }
  caso('voz en off con PixVerse: la nota de las escenas sin imagen final', () => {
    const comp = compararModelos(ejemplos['voz en off']);
    const o = opcion(comp, 'vozEnOff', 'pixverse-grok15');
    assert.match(o.nota || '', /sin imagen final se hacen con Grok Imagine 1\.5/);
    // Omni 1.2 cobra por segundo desde 3 s: un paso más corto se cobra como de 3 y la nota lo dice
    assert.match(opcion(comp, 'vozEnOff', 'omni').nota || '', /Omni Flash 1\.2 cobra como mínimo 3 s por escena/);
  });
  caso('las categorías salen en el orden de Ajustes (las imágenes al final)', () => {
    const comp = compararModelos(ejemplos.podcast);
    assert.deepEqual(comp.map((c) => c.categoria), ['podcastEntrevista', 'brollHablado', 'imagen']);
    assert.deepEqual(comp.map((c) => c.nombre), comp.map((c) => CATALOGO.categorias.find((x) => x.id === c.categoria).nombre));
  });
  caso('una categoría donde todas las opciones dan lo mismo no se devuelve', () => {
    const m = claymation();
    m.tomas = m.tomas.map((t) => ({ ...t, tipo: 'A', prompt_imagen_final: undefined }));
    m.broll = [];
    // sin imagen final PixVerse no hace nada: igual queda distinto de Omni, asi que la categoria sigue
    const comp = compararModelos(entrada(m), { categorias: ['vozEnOff', 'imagen', 'ugc'] });
    assert.ok(!comp.some((c) => c.categoria === 'ugc'));
  });
});

bloque('rango y dinero', () => {
  caso('rango: el margen solo sobre lo variable', () => assert.deepEqual(rango(1000, 12, 0.1), { min: 1012, max: 1112 }));
  caso('rango sin margen: min = max', () => assert.deepEqual(rango(626, 0, 0), { min: 626, max: 626 }));
  caso('rango sin margen con decimales (Grok 4,5 por segundo): min = max, sin redondear hacia arriba', () => assert.deepEqual(rango(1011.5, 0, 0), { min: 1011.5, max: 1011.5 }));
  caso('dólares de un solo número: el mismo redondeo (nunca «US$ 5,06 a 5,07»)', () => assert.deepEqual(dolaresDe({ min: 1011.5, max: 1011.5 }), { min: 5.06, max: 5.06 }));
  caso('todas las familias sin margen de rehechos', () => assert.ok(Object.values(MARGEN_POR_FAMILIA).every((x) => x === 0), MARGEN_POR_FAMILIA));
  caso('dólares: el mínimo al centavo y el máximo hacia arriba', () => assert.deepEqual(dolaresDe({ min: 334.5, max: 368 }), { min: 1.67, max: 1.84 }));
  caso('texto: US$ 3,10 y miles con punto', () => {
    assert.equal(textoDolares(3.1), 'US$ 3,10');
    assert.equal(textoDolares(1234.5), 'US$ 1.234,50');
  });
  caso('--eleccion como JSON o como lista', () => {
    assert.deepEqual(leerArgEleccion('{"vozEnOff":"grok15"}'), { vozEnOff: 'grok15' });
    assert.deepEqual(leerArgEleccion('vozEnOff=grok15,imagen=nb21'), { vozEnOff: 'grok15', imagen: 'nb21' });
    assert.equal(leerArgEleccion(''), null);
  });
});

// ------------------------------------------------------------------ 3
seccion('3. El CLI con --json (carpeta temporal)');

bloque('regenerar una pieza (costoDePiezas, --piezas)', () => {
  const m = claymation();
  const p = costoDePiezas({ manifiesto: m }, { eleccion: ELECCION_POR_DEFECTO });
  caso('ok y una entrada por clip', () => assert.ok(p.ok && p.piezas['toma-1'] && p.piezas['toma-2'] && p.piezas['broll-2'], Object.keys(p.piezas || {})));
  caso('el clip de una toma = lo que cobra su clip (Omni)', () => assert.equal(p.piezas['toma-1'].clip.creditos, cr(OMNI, 2.5)));
  caso('con su imagen = clip + sus imágenes (inicial, y la final en una B)', () => {
    for (const [id, x] of Object.entries(p.piezas)) assert.equal(x.conImagen.creditos, r2(x.clip.creditos + x.imagen.creditos), id);
    assert.ok(p.piezas['toma-1'].imagen.creditos >= 10);
  });
  caso('las hojas de personaje no vienen (no se regeneran sueltas)', () => assert.ok(!Object.keys(p.piezas).some((k) => !/^(toma|broll|paso|gancho)-/.test(k)), Object.keys(p.piezas)));
  caso('dólares de un solo número', () => assert.equal(p.piezas['toma-1'].clip.dolares, r2(cr(OMNI, 2.5) * 0.005)));
});

bloque('estimar-costo.js --json', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'probar-estimar-costo-'));
  const escribir = (rel, v) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), typeof v === 'string' ? v : JSON.stringify(v, null, 2));
  };
  const correr = (carpeta, ...args) => {
    const r = spawnSync(process.execPath, [SCRIPT, carpeta, '--json', ...args], { encoding: 'utf8', timeout: 30000, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...(process.env.RESOLUCION_VIDEO ? { RESOLUCION_VIDEO: process.env.RESOLUCION_VIDEO } : {}) } });
    let datos = null;
    try {
      datos = JSON.parse(r.stdout);
    } catch {
      /* abajo */
    }
    return { codigo: r.status, datos, err: r.stderr };
  };
  try {
    escribir('voz/manifiesto.json', claymation());
    escribir('voz/app/brief.json', { estilo: 'claymation', continuidad: false });
    let r = correr(path.join(dir, 'voz'), '--comparar');
    caso('voz en off: código 0 y ok', () => assert.equal(r.codigo, 0, r.err) || assert.equal(r.datos?.ok, true));
    caso('voz en off: la forma de la salida', () => {
      const d = r.datos;
      for (const k of ['fase', 'familia', 'estilo', 'eleccion', 'margen', 'creditos', 'dolares', 'partes', 'modelos', 'notas', 'elevenlabs', 'comparar', 'comparaSobre']) assert.ok(k in d, `falta ${k}`);
      assert.equal(d.fase, 'guion');
      assert.equal(d.familia, 'voz-en-off');
      assert.equal(d.comparaSobre, 'total');
      assert.deepEqual(d.comparar.map((c) => c.categoria), ['vozEnOff', 'imagen']);
      assert.deepEqual(d.modelos.map((x) => x.nombre), ['Omni Flash 1.2', 'GPT Image 2.5']);
      assert.equal(d.creditos.min, estimarCosto(entrada(claymation())).creditos.min);
    });
    r = correr(path.join(dir, 'voz'), '--eleccion', '{"vozEnOff":"grok15","imagen":"nb21"}');
    caso('--eleccion manda (Grok 1.5 y Nano Banana 2.1)', () => {
      assert.equal(r.datos?.eleccion?.vozEnOff, 'grok15');
      assert.equal(r.datos?.creditos?.min, estimarCosto(entrada(claymation()), { eleccion: { vozEnOff: 'grok15', imagen: 'nb21' } }).creditos.min);
      assert.equal(r.datos?.comparar, undefined, 'sin --comparar no compara');
    });
    escribir('voz/app/brief.json', { estilo: 'claymation', continuidad: true });
    r = correr(path.join(dir, 'voz'));
    caso('el brief pide continuidad: la cadena', () => assert.equal(r.datos?.familia, 'continuidad'));

    // musical en la letra (sin manifiesto ni cancion)
    escribir('mus/app/brief.json', { estilo: 'musical' });
    escribir('mus/app/letras.json', { opciones: [{ n: 1, titulo: 'x', letra: '[Verso]\nla la la', estiloSuno: 'pop' }], elegida: 1 });
    r = correr(path.join(dir, 'mus'), '--comparar');
    caso('musical en la letra: fase letra, canción 12, video aparte y comparación sobre el video', () => {
      const d = r.datos;
      assert.equal(d?.fase, 'letra');
      assert.equal(d.familia, 'musical');
      assert.equal(d.cancion.creditos, 12);
      assert.equal(d.segundos, 100);
      assert.equal(d.segundosDe, 'tipico');
      assert.equal(d.comparaSobre, 'video');
      assert.deepEqual(d.comparar.map((c) => c.categoria), ['vozEnOff', 'imagen']);
      assert.equal(opcion(d.comparar, 'vozEnOff', 'omni').creditos.min, d.video.creditos.min);
      assert.equal(d.creditos.min, r2(d.video.creditos.min + 12));
    });
    r = correr(path.join(dir, 'mus'), '--segundos', '60');
    caso('--segundos cambia el video', () => assert.equal(r.datos?.segundos, 60) || assert.equal(r.datos?.segundosDe, 'pedido'));

    // historia en la pausa de la cancion (4 versiones, letra en 2 bloques)
    escribir('his/app/brief.json', { estilo: 'historias-musicales' });
    escribir('his/cancion/peticion.json', { letra: 'uno dos\n\ntre sei', estilos: ['a', 'b'], bloques: ['uno dos', 'tre sei'], titulo: 't' });
    escribir('his/cancion/opciones.json', { pistas: [{ duracion: 140 }, { duracion: 150 }, { duracion: 130 }, { duracion: 160 }] });
    r = correr(path.join(dir, 'his'), '--cancion', '--comparar');
    caso('historia en la pausa: fase cancion, falta solo el extend (12) y una entrada por versión', () => {
      const d = r.datos;
      assert.equal(d?.fase, 'cancion');
      assert.equal(d.familia, 'historia-musical');
      assert.equal(d.cancion.creditos, 12);
      assert.equal(d.porCancion.length, 4);
      assert.deepEqual(d.porCancion.map((v) => v.segundos), [280, 300, 260, 320]);
      assert.ok(d.porCancion.every((v) => v.creditos.min > 0 && v.creditos.min <= v.creditos.max && Array.isArray(v.comparar)));
      assert.ok(d.porCancion[3].creditos.min > d.porCancion[2].creditos.min, 'la más larga cuesta más');
      assert.ok(d.notas.some((n) => /otras versiones de la canción, cada vez suma US\$ 0,12/.test(n)), d.notas);
    });
    escribir('his/app/cancion-eleccion.json', { n: 2 });
    r = correr(path.join(dir, 'his'));
    caso('con una versión marcada, el video es el de esa', () => assert.equal(r.datos?.segundos, 300));

    escribir('nada/app/brief.json', { estilo: 'claymation' });
    r = correr(path.join(dir, 'nada'));
    caso('sin guion: ok false, código 1', () => assert.equal(r.codigo, 1) || assert.equal(r.datos?.ok, false));
    r = correr(path.join(dir, 'no-existe'));
    caso('sin la carpeta: ok false', () => assert.equal(r.datos?.ok, false));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ------------------------------------------------------------------ 4
seccion('4. Anuncios reales de temp/');

const existe = (slug) => fs.existsSync(path.join(TEMP, slug, 'manifiesto.json'));
const reales = [
  // con los B-roll que de verdad entraron (la voz real) y sin la musica ya hecha: lo cobrado (app/informe.json)
  { slug: 'bloom-greens-superfoods-claymation-20261026-1317', cobrado: 1126, imagenes: 190, videos: 924 },
  { slug: 'bestdiet-relax-ashwagandha-claymation-20261109-1047', cobrado: 626, imagenes: 110, videos: 504 },
  // 876 cobrados = 772 + 104 de la toma 5 rehecha (2 imagenes y 1 clip)
  { slug: 'bestdiet-relax-ashwagandha-claymation-20261108-1913', cobrado: 772, imagenes: 130, videos: 630 },
  // 2.310 cobrados = 1.932 + los clips rehechos
  { slug: 'bestdiet-relax-ashwagandha-gum-talking-object-pixar-20261105-1919', cobrado: 1932, imagenes: 240, videos: 1680 },
];

if (!fs.existsSync(TEMP) || !reales.some((x) => existe(x.slug))) {
  console.log('  (no están los anuncios reales de temp/: esta parte se salta, como en el CI)');
} else {
  bloque('lo estimado con la voz real = lo cobrado', () => {
    for (const x of reales) {
      if (!existe(x.slug)) {
        console.log(`      (falta ${x.slug}: se salta)`);
        continue;
      }
      const ctx = { ...leerCarpeta(path.join(TEMP, x.slug)), hayMusica: false };
      const r = estimarCarpeta(ctx, { eleccion: leerEleccion(ctx.carpeta), comparar: true });
      caso(`${x.slug}: ${x.cobrado} créditos`, () => {
        assert.equal(r.ok, true);
        assert.equal(r.creditos.min, x.cobrado);
        assert.equal(parte(r, 'imagenes'), x.imagenes);
        assert.equal(parte(r, 'videos'), x.videos);
      });
      caso(`${x.slug}: cada opción de comparar = el estimado con esa elección`, () => {
        for (const c of r.comparar) {
          for (const o of c.opciones) {
            const otra = estimarCarpeta(ctx, { eleccion: { ...r.eleccion, [c.categoria]: o.id } });
            assert.deepEqual(o.creditos, otra.creditos, `${c.categoria}=${o.id}`);
          }
        }
      });
    }
  });

  // Antes de la voz (reglaBrollReal null: el B-roll probable), sin la musica: la matriz de mapa-motor.md (C).
  const matriz = [
    ['bestdiet-relax-ashwagandha-claymation-20261108-1913', {}, [['omni', 'gpt25', 906], ['omni', 'nb21', 846], ['grok15', 'gpt25', 334.5], ['grok15', 'nb21', 274.5], ['pixverse-grok15', 'gpt25', 361.5], ['pixverse-grok15', 'nb21', 301.5]], 'vozEnOff'],
    ['cayenne-pepper-continuidad', {}, [['omni', 'gpt25', 1785], ['omni', 'nb21', 1701], ['grok15', 'gpt25', 682.5], ['grok15', 'nb21', 598.5], ['pixverse-grok15', 'gpt25', 949.8], ['pixverse-grok15', 'nb21', 865.8]], 'vozEnOff'],
    ['bestdiet-relax-ashwagandha-gum-talking-object-pixar-20261105-1919', {}, [['omni', 'gpt25', 1920], ['omni', 'nb21', 1824], ['grok15', 'gpt25', 753], ['grok15', 'nb21', 657]], 'objetoParlante'],
    ['befem-ugc-bloques', { ganchos: true }, [['omni', 'gpt25', 871], ['omni', 'nb21', 867], ['grok', 'gpt25', 316], ['grok', 'nb21', 312]], 'ugc'],
  ];
  bloque('la matriz por modelo antes de la voz (mapa-motor C)', () => {
    for (const [slug, opts, filas, cat] of matriz) {
      if (!existe(slug)) {
        console.log(`      (falta ${slug}: se salta)`);
        continue;
      }
      const ctx = { ...leerCarpeta(path.join(TEMP, slug)), hayMusica: false, reglaBrollReal: null };
      for (const [video, imagen, esperado] of filas) {
        caso(`${slug}: ${cat}=${video} + ${imagen} = ${esperado} (+ música)`, () => {
          const r = estimarCarpeta(ctx, { eleccion: { [cat]: video, imagen }, ...opts });
          assert.equal(r2(r.creditos.min - parte(r, 'musica')), esperado);
        });
      }
    }
    const hablados = [
      ['cayenne-pepper-podcast', [['omni', 'kling', 1116.5], ['omni', 'omni', 1142], ['omni', 'grok15', 957.5], ['grok', 'kling', 573.5], ['grok', 'omni', 599], ['grok', 'grok15', 414.5]], 20],
      ['befem-entrevista-b', [['omni', 'kling', 807.6], ['omni', 'omni', 801], ['omni', 'grok15', 744], ['grok', 'kling', 414.6], ['grok', 'omni', 408], ['grok', 'grok15', 351]], 36],
    ];
    for (const [slug, filas, menosNb] of hablados) {
      if (!existe(slug)) continue;
      const ctx = leerCarpeta(path.join(TEMP, slug));
      for (const [pe, bh, esperado] of filas) {
        caso(`${slug}: ${pe} / ${bh} / gpt25 = ${esperado} y con nb21 ${r2(esperado - menosNb)}`, () => {
          assert.equal(estimarCarpeta(ctx, { eleccion: { podcastEntrevista: pe, brollHablado: bh } }).creditos.min, esperado);
          assert.equal(estimarCarpeta(ctx, { eleccion: { podcastEntrevista: pe, brollHablado: bh, imagen: 'nb21' } }).creditos.min, r2(esperado - menosNb));
        });
      }
    }
  });

  bloque('B-roll probable = brollQueEntran con tiempos sintéticos (manifiestos reales)', () => {
    for (const d of fs.readdirSync(TEMP, { withFileTypes: true })) {
      if (!d.isDirectory() || d.name.startsWith('_')) continue;
      let m;
      try {
        m = JSON.parse(fs.readFileSync(path.join(TEMP, d.name, 'manifiesto.json'), 'utf8').replace(/^﻿/, ''));
      } catch {
        continue;
      }
      const p = reglaBrollProbable(m);
      if (!p.aplica || !(m.broll || []).length) continue;
      caso(d.name, () => {
        const b = brollQueEntran(m, tiemposSinteticos(m));
        assert.equal(b.aplica, true, b.motivo);
        assert.deepEqual(p.entran, b.entran);
      });
    }
  });

  // Cantados: el video de la cancion tipica (los segundos de la cancion real) contra el de su manifiesto real.
  const cantados = [
    ['kovacol-drenaje-linfatico', 'musical'],
    ['goli-immune-historia-musical', 'historia-musical'],
    ['anuncios-con-ia-historia-musical', 'historia-musical'],
  ];
  bloque('cantados: la canción típica dentro de ±25 % de su manifiesto real, con cada modelo', () => {
    for (const [slug, familia] of cantados) {
      if (!existe(slug)) {
        console.log(`      (falta ${slug}: se salta)`);
        continue;
      }
      const ctx = leerCarpeta(path.join(TEMP, slug));
      const cancion = JSON.parse(fs.readFileSync(path.join(TEMP, slug, 'audio', 'cancion.json'), 'utf8'));
      const tipico = { familia, estilo: familia, manifiesto: null, hayMusica: true, cantado: { estilos: 1, bloques: 1, hayVersiones: true, completa: true, segundos: cancion.duracion } };
      for (const video of ['omni', 'grok15', 'pixverse-grok15']) {
        for (const imagen of ['gpt25', 'nb21']) {
          caso(`${slug} (${Math.round(cancion.duracion)} s): ${video} + ${imagen}`, () => {
            const eleccion = { vozEnOff: video, imagen };
            const real = estimarCarpeta({ ...ctx, hayMusica: true }, { eleccion }).creditos.min;
            const est = estimarVideoCantado(tipico, { eleccion }).creditos.min;
            const desvio = (est - real) / real;
            assert.ok(Math.abs(desvio) <= 0.25, `típico ${est} contra real ${real}: ${(desvio * 100).toFixed(1)} %`);
          });
        }
      }
    }
    // historia goli: lo cobrado de verdad (6.072 a precios de su fecha, con la canción de 2 estilos y los rehechos)
    // cae dentro del rango con Omni + GPT Image 2.5
    if (existe('goli-immune-historia-musical')) {
      caso('goli: lo cobrado (6.072) dentro del rango de la canción típica, ±25 %', () => {
        const r = estimarCosto({ familia: 'historia-musical', estilo: 'historias-musicales', manifiesto: null, hayMusica: true, cantado: { estilos: 2, bloques: 1, segundos: 287.232 } });
        assert.ok(6072 >= r.creditos.min * 0.75 && 6072 <= r.creditos.max * 1.25, JSON.stringify(r.creditos));
      });
    }
  });
}

// ------------------------------------------------------------------ fin
const total = ok + fallos.length;
if (fallos.length) {
  console.log(`\nFALLARON ${fallos.length} de ${total}:\n`);
  for (const f of fallos) console.log(`  - ${f}`);
  process.exitCode = 1;
} else {
  console.log(`\nTodo bien: ${ok}/${total} comprobaciones.`);
}

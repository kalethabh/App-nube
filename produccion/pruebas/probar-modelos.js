// Prueba sin red de la eleccion de modelos: catalogo-modelos.json,
// modelos-elegidos.js, los modelos nuevos de config.js y lo que el kie simulado
// acepta o rechaza de ellos. No pide nada a nadie ni levanta ningun servidor.
//
//   node produccion/pruebas/probar-modelos.js
//
// Sale con 0 si todo da; con 1 y el detalle de lo que fallo si no.
//
//   1. Sin modelos.json todas las cascadas (y la de imagen) son las de antes
//      de que existiera la eleccion, tambien sobre los manifiestos de temp/.
//   2. Cada opcion del catalogo arma la cascada acordada.
//   3. Los adaptadores nuevos arman los cuerpos de la prueba real del
//      2026-11-08 (temp/prueba-modelos-baratos/correr.mjs), "Imagen N" -> "@imageN" incluido.
//   4. Los costos del catalogo coinciden con creditosClip / PRECIOS.
//   5. normalizarEleccion y leerEleccion ignoran lo que no existe.
//   6. Todo modelo del catalogo tiene adaptador y definicion.
//   7. El kie simulado acepta esos cuerpos (y los de siempre) y rechaza los mal armados.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADAPTADORES_IMAGEN,
  ADAPTADORES_VIDEO,
  MODELO_IMAGEN_POR_DEFECTO,
  MODELOS_VIDEO,
  PRECIOS,
  creditosClip,
  duracionPara,
  referenciasParaGrok,
} from '../config.js';
import {
  CATALOGO,
  ELECCION_POR_DEFECTO,
  cascadaDelTrabajo,
  cascadaImagen,
  cascadaVideo,
  categoriaDeVideo,
  esModeloConDialogo,
  leerEleccion,
  modeloParaClip,
  nombreModelo,
  normalizarEleccion,
} from '../modelos-elegidos.js';
import { validarCuerpo } from './kie-simulado.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const TEMP = path.join(RAIZ, 'temp');

const OMNI = 'google/gemini-omni-flash-1-2';
const KLING = 'kling-3.0/video';
const GROK15 = 'grok-imagine-video-1-5-preview';
const GROK1 = 'grok-imagine/image-to-video';
const PIXVERSE = 'pixverse-v6/transition';
const SUNBURST = 'gpt-image-2-5-sunburst';
const NB2 = 'nano-banana-2';
const NB21 = 'nano-banana-2-1';

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
const listo = (antes, n) => console.log(`  ${fallos.length === antes ? 'OK' : 'FALLA'}  ${n}`);
function bloque(titulo, fn) {
  const antes = fallos.length;
  const okAntes = ok;
  fn();
  listo(antes, `${titulo} (${ok - okAntes + (fallos.length - antes)} comprobaciones)`);
}

// ------------------------------------------------------------------ 1
seccion('1. Sin modelos.json, todo como antes');

/** La cascada que usaba el motor antes de la eleccion (generar-videos.js en HEAD 0685d86). */
function cascadaDeHoy(m, t) {
  if (m.continuidad != null) return [OMNI, KLING];
  const hablado = ['podcast', 'entrevista'].includes(m.estilo);
  if (t.tipo === 'R' || t.clase === 'gancho') return [OMNI]; // generarBloqueR con MODELO_VIDEO_UGC
  if (t.tipo === 'H' && Array.isArray(t.ingredientes) && t.ingredientes.length) return [OMNI]; // por ingredientes
  if (t.tipo === 'H' && hablado) return [OMNI]; // ESTILOS_SIN_RESPALDO_VIDEO
  if (t.clase === 'broll' && hablado) return [KLING]; // MODELO_VIDEO_BROLL_POR_ESTILO
  return [OMNI, KLING]; // MODELOS.video principal + respaldo
}

bloque('elección por defecto y cascadas de cada tipo de clip', () => {
  caso('ELECCION_POR_DEFECTO', () =>
    assert.deepEqual({ ...ELECCION_POR_DEFECTO }, { vozEnOff: 'omni', objetoParlante: 'omni', ugc: 'omni', podcastEntrevista: 'omni', brollHablado: 'kling', imagen: 'gpt25' })
  );
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'probar-modelos-'));
  try {
    caso('leerEleccion sin archivo = por defecto', () => assert.deepEqual(leerEleccion(dir), { ...ELECCION_POR_DEFECTO }));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const e = leerEleccion(null);
  caso('leerEleccion(null) = por defecto', () => assert.deepEqual(e, { ...ELECCION_POR_DEFECTO }));

  const casos = [
    ['voz en off, toma A', { modo_audio: 'voz_en_off', estilo: 'estilo-pixar' }, { tipo: 'A' }, [OMNI, KLING]],
    ['voz en off, toma B', { modo_audio: 'voz_en_off', estilo: 'claymation' }, { tipo: 'B', clase: 'toma' }, [OMNI, KLING]],
    ['voz en off, B-roll', { modo_audio: 'voz_en_off', estilo: 'crochet' }, { clase: 'broll', tipo: 'broll' }, [OMNI, KLING]],
    ['continuidad, paso', { modo_audio: 'voz_en_off', estilo: 'estilo-lego', continuidad: {} }, { clase: 'paso', tipo: 'paso' }, [OMNI, KLING]],
    ['musica, toma', { modo_audio: 'musica', estilo: 'historias-musicales' }, { tipo: 'A' }, [OMNI, KLING]],
    ['objeto parlante, toma', { modo_audio: 'dialogo_nativo', estilo: 'talking-object-pixar' }, { tipo: 'A' }, [OMNI, KLING]],
    ['objeto parlante, B-roll', { modo_audio: 'dialogo_nativo', estilo: 'talking-object-pixar' }, { clase: 'broll' }, [OMNI, KLING]],
    ['UGC, bloque R', { modo_audio: 'dialogo_nativo', estilo: 'ugc', tomas: [{ tipo: 'R' }] }, { tipo: 'R' }, [OMNI]],
    ['UGC, gancho', { modo_audio: 'dialogo_nativo', estilo: 'ugc', tomas: [{ tipo: 'R' }] }, { tipo: 'R', clase: 'gancho' }, [OMNI]],
    ['UGC, B-roll (no deberia haber)', { modo_audio: 'dialogo_nativo', estilo: 'ugc', tomas: [{ tipo: 'R' }] }, { clase: 'broll' }, [OMNI, KLING]],
    ['podcast, toma H', { modo_audio: 'dialogo_nativo', estilo: 'podcast' }, { tipo: 'H' }, [OMNI]],
    ['entrevista, H por ingredientes', { modo_audio: 'dialogo_nativo', estilo: 'entrevista' }, { tipo: 'H', ingredientes: ['imagen', 'mano'] }, [OMNI]],
    ['entrevista, H por ingredientes (plan)', { modo_audio: 'dialogo_nativo', estilo: 'entrevista' }, { tipo: 'H', porIngredientes: true, clase: 'toma' }, [OMNI]],
    ['podcast, B-roll', { modo_audio: 'dialogo_nativo', estilo: 'podcast' }, { clase: 'broll', tipo: 'broll' }, [KLING]],
    ['entrevista, B-roll', { modo_audio: 'dialogo_nativo', estilo: 'entrevista' }, { clase: 'broll', tipo: 'broll' }, [KLING]],
  ];
  for (const [nombre, m, t, esperada] of casos) {
    caso(`cascada: ${nombre}`, () => assert.deepEqual(cascadaDelTrabajo(e, m, t), esperada));
    caso(`cascada de hoy: ${nombre}`, () => assert.deepEqual(cascadaDeHoy(m, t), esperada));
  }
  caso('cascada de imagen = MODELO_IMAGEN_POR_DEFECTO', () => {
    assert.deepEqual(cascadaImagen(e), { cascada: [SUNBURST, NB2], resoluciones: { [SUNBURST]: '2K', [NB2]: '1K' } });
    assert.deepEqual(cascadaImagen(e), { cascada: [...MODELO_IMAGEN_POR_DEFECTO.cascada], resoluciones: { ...MODELO_IMAGEN_POR_DEFECTO.resoluciones } });
    assert.deepEqual(cascadaImagen(undefined), cascadaImagen(e));
  });
});

bloque('manifiestos reales de temp/ (tomas, B-roll y ganchos)', () => {
  let manifiestos = 0;
  let clips = 0;
  const carpetas = fs.existsSync(TEMP) ? fs.readdirSync(TEMP, { withFileTypes: true }).filter((d) => d.isDirectory()) : [];
  for (const d of carpetas) {
    const carpeta = path.join(TEMP, d.name);
    const ruta = path.join(carpeta, 'manifiesto.json');
    if (!fs.existsSync(ruta)) continue;
    let m;
    try {
      m = JSON.parse(fs.readFileSync(ruta, 'utf8').replace(/^﻿/, ''));
    } catch {
      continue;
    }
    if (!m || typeof m !== 'object') continue;
    manifiestos++;
    if (!fs.existsSync(path.join(carpeta, 'modelos.json'))) {
      caso(`${d.name}: leerEleccion = por defecto`, () => assert.deepEqual(leerEleccion(carpeta), { ...ELECCION_POR_DEFECTO }));
    }
    const e = { ...ELECCION_POR_DEFECTO };
    const trabajos = [
      ...(Array.isArray(m.tomas) ? m.tomas.map((t) => ({ ...t, clase: 'toma' })) : []),
      ...(Array.isArray(m.broll) ? m.broll.map((b) => ({ ...b, clase: 'broll', tipo: 'broll' })) : []),
      ...(Array.isArray(m.ganchos_alternativos) ? m.ganchos_alternativos.map((g) => ({ ...g, clase: 'gancho', tipo: 'R' })) : []),
    ];
    for (const t of trabajos) {
      clips++;
      caso(`${d.name}: ${t.clase} ${t.n ?? t.id ?? ''}`, () => assert.deepEqual(cascadaDelTrabajo(e, m, t), cascadaDeHoy(m, t)));
    }
  }
  console.log(`      (${manifiestos} manifiestos, ${clips} clips)`);
});

// ------------------------------------------------------------------ 2
seccion('2. Cada opción arma la cascada acordada');

const CONTRATO = {
  vozEnOff: {
    omni: { frames: [OMNI, KLING] },
    grok15: { frames: [GROK15, OMNI, KLING] },
    'pixverse-grok15': { frames: [PIXVERSE, GROK15, OMNI, KLING] },
  },
  objetoParlante: {
    omni: { frames: [OMNI, KLING] },
    grok15: { frames: [GROK15, OMNI, KLING] },
  },
  ugc: {
    omni: { referencias: [OMNI] },
    grok: { referencias: [GROK1, OMNI] },
  },
  podcastEntrevista: {
    omni: { frames: [OMNI], referencias: [OMNI] },
    grok: { frames: [GROK15, OMNI], referencias: [GROK1, OMNI] },
  },
  brollHablado: {
    kling: { frames: [KLING] },
    omni: { frames: [OMNI, KLING] },
    grok15: { frames: [GROK15, KLING] },
  },
};
const CONTRATO_IMAGEN = {
  gpt25: { cascada: [SUNBURST, NB2], resoluciones: { [SUNBURST]: '2K', [NB2]: '1K' } },
  nb21: { cascada: [NB21, NB2], resoluciones: { [NB21]: '2K', [NB2]: '1K' } },
};

bloque('categorías, opciones y cascadas', () => {
  caso('categorías en orden', () =>
    assert.deepEqual(
      CATALOGO.categorias.map((c) => c.id),
      ['vozEnOff', 'objetoParlante', 'ugc', 'podcastEntrevista', 'brollHablado', 'imagen']
    )
  );
  for (const c of CATALOGO.categorias) {
    caso(`${c.id}: un solo recomendado y es el por defecto`, () => {
      const rec = c.opciones.filter((o) => o.recomendado === true).map((o) => o.id);
      assert.deepEqual(rec, [c.porDefecto]);
      for (const o of c.opciones) assert.equal(typeof o.recomendado, 'boolean');
    });
    caso(`${c.id}: textos`, () => {
      assert.ok(c.nombre && c.descripcion);
      for (const o of c.opciones) {
        assert.ok(o.nombre, `${o.id} sin nombre`);
        assert.ok(o.nota === null || (typeof o.nota === 'string' && o.nota), `${o.id}: nota`);
      }
    });
  }
  for (const [cat, opciones] of Object.entries(CONTRATO)) {
    const c = CATALOGO.categorias.find((x) => x.id === cat);
    caso(`${cat}: opciones exactas`, () => assert.deepEqual(c.opciones.map((o) => o.id), Object.keys(opciones)));
    for (const [op, cascadas] of Object.entries(opciones)) {
      const e = normalizarEleccion({ [cat]: op });
      caso(`${cat}=${op}: elección válida`, () => assert.equal(e[cat], op));
      for (const tipo of ['frames', 'referencias']) {
        if (!cascadas[tipo]) continue;
        caso(`${cat}=${op}: ${tipo}`, () => assert.deepEqual(cascadaVideo(e, cat, { referencias: tipo === 'referencias' }), cascadas[tipo]));
      }
      caso(`${cat}=${op}: sin cascadas de más en el catálogo`, () =>
        assert.deepEqual(Object.keys(c.opciones.find((o) => o.id === op).cascadas).sort(), Object.keys(cascadas).sort())
      );
    }
  }
  const ci = CATALOGO.categorias.find((x) => x.id === 'imagen');
  caso('imagen: opciones exactas', () => assert.deepEqual(ci.opciones.map((o) => o.id), Object.keys(CONTRATO_IMAGEN)));
  for (const [op, esperada] of Object.entries(CONTRATO_IMAGEN)) {
    caso(`imagen=${op}`, () => assert.deepEqual(cascadaImagen({ imagen: op }), esperada));
  }
  // Lo que llega por cada camino de un anuncio de cada tipo, con una opcion no por defecto.
  const e = { vozEnOff: 'pixverse-grok15', objetoParlante: 'grok15', ugc: 'grok', podcastEntrevista: 'grok', brollHablado: 'grok15', imagen: 'nb21' };
  const porTrabajo = [
    [{ modo_audio: 'voz_en_off' }, { tipo: 'B' }, [PIXVERSE, GROK15, OMNI, KLING]],
    [{ modo_audio: 'musica' }, { tipo: 'A' }, [PIXVERSE, GROK15, OMNI, KLING]],
    [{ modo_audio: 'voz_en_off', continuidad: {} }, { clase: 'paso' }, [PIXVERSE, GROK15, OMNI, KLING]],
    [{ modo_audio: 'dialogo_nativo' }, { tipo: 'A' }, [GROK15, OMNI, KLING]],
    [{ modo_audio: 'dialogo_nativo', tomas: [{ tipo: 'R' }] }, { tipo: 'R' }, [GROK1, OMNI]],
    [{ estilo: 'entrevista' }, { tipo: 'H', ingredientes: ['imagen'] }, [GROK1, OMNI]],
    [{ estilo: 'podcast' }, { tipo: 'H' }, [GROK15, OMNI]],
    [{ estilo: 'podcast' }, { clase: 'broll' }, [GROK15, KLING]],
  ];
  for (const [m, t, esperada] of porTrabajo) {
    caso(`por trabajo ${categoriaDeVideo(m, t)} ${JSON.stringify(t)}`, () => assert.deepEqual(cascadaDelTrabajo(e, m, t), esperada));
  }
  caso('categoriaDeVideo', () => {
    assert.equal(categoriaDeVideo({ modo_audio: 'voz_en_off' }, { tipo: 'A' }), 'vozEnOff');
    assert.equal(categoriaDeVideo({ modo_audio: 'musica' }, { tipo: 'A' }), 'vozEnOff');
    assert.equal(categoriaDeVideo({ modo_audio: 'voz_en_off', continuidad: {} }, { clase: 'paso' }), 'vozEnOff');
    assert.equal(categoriaDeVideo({ modo_audio: 'dialogo_nativo', estilo: 'sketch' }, { tipo: 'A' }), 'objetoParlante');
    assert.equal(categoriaDeVideo({ tomas: [{ tipo: 'R' }] }, { tipo: 'R' }), 'ugc');
    assert.equal(categoriaDeVideo({ estilo: 'podcast' }, { tipo: 'H' }), 'podcastEntrevista');
    assert.equal(categoriaDeVideo({ estilo: 'entrevista' }, { clase: 'broll' }), 'brollHablado');
    assert.equal(categoriaDeVideo({ estilo: 'entrevista' }, { tipo: 'broll' }), 'brollHablado');
  });
  caso('categoría desconocida lanza', () => assert.throws(() => cascadaVideo({}, 'noExiste')));
});

// ------------------------------------------------------------------ 3
seccion('3. Cuerpos de los adaptadores nuevos = los de la prueba real (correr.mjs)');

function leerManifiesto(nombre) {
  try {
    return JSON.parse(fs.readFileSync(path.join(TEMP, nombre, 'manifiesto.json'), 'utf8').replace(/^﻿/, ''));
  } catch {
    return null;
  }
}
const mBefen = leerManifiesto('befen-regulador-apetito');
const mBefem = leerManifiesto('befem-ugc-bloques');
const mBest = leerManifiesto('bestdiet-relax-ashwagandha-gum-talking-object-pixar-20261105-1919');
const promptClay = mBefen?.tomas?.find((t) => t.n === 12)?.prompt_video?.replace('5s.', '6s.') ?? 'Plastilina, 6s. Una mano toma el frasco.';
const promptUgc = mBefem?.tomas?.find((t) => t.n === 2)?.prompt_video ?? 'La persona de la Imagen 1 sostiene el producto de la imagen 2 y dice: "esto me cambió".';
const promptUgcGrok = promptUgc.replace(/[Ii]magen 1\b/g, '@image1').replace(/[Ii]magen 2\b/g, '@image2');
const promptTaza = mBest?.tomas?.find((t) => t.n === 2)?.prompt_video?.replace('Duración: 6.5s.', 'Duración: 7s.') ?? 'Una taza que habla. Duración: 7s.';
const promptCafe = mBest?.referencias?.find((r) => r.id === 'cafe')?.prompt ?? 'Una cafetería luminosa.';
const promptToma2 = mBest?.tomas?.find((t) => t.n === 2)?.prompt_imagen_inicial ?? 'La taza sobre la mesa del café.';
const u = {
  clayIni: 'https://ejemplo.test/clay-ini.png',
  clayFin: 'https://ejemplo.test/clay-fin.png',
  personaje: 'https://ejemplo.test/personaje.png',
  productoBefem: 'https://ejemplo.test/producto.png',
  tazaIni: 'https://ejemplo.test/taza-ini.png',
  cafe: 'https://ejemplo.test/cafe.png',
};
const mismoJson = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));
const CUERPOS = {};

bloque('grok 1.5, pixverse, grok v1 y nano banana 2.1', () => {
  if (!mBefen || !mBefem || !mBest) console.log('      (faltan manifiestos de la prueba real en temp/: se usan prompts de ejemplo)');
  CUERPOS.clayGrok15 = ADAPTADORES_VIDEO[GROK15]({ prompt: promptClay, frameInicial: u.clayIni, frameFinal: u.clayFin, aspectRatio: '9:16', resolucionApi: '720p', duracion: 6 });
  caso('clay-grok15', () =>
    mismoJson(CUERPOS.clayGrok15, { model: GROK15, input: { prompt: promptClay, first_frame_url: u.clayIni, last_frame_url: u.clayFin, duration: 6, resolution: '720p', aspect_ratio: '9:16' } })
  );
  CUERPOS.tazaGrok15 = ADAPTADORES_VIDEO[GROK15]({ prompt: promptTaza, frameInicial: u.tazaIni, frameFinal: null, aspectRatio: '9:16', resolucionApi: '720p', duracion: 7 });
  caso('taza-grok15 (sin imagen final)', () =>
    mismoJson(CUERPOS.tazaGrok15, { model: GROK15, input: { prompt: promptTaza, first_frame_url: u.tazaIni, duration: 7, resolution: '720p', aspect_ratio: '9:16' } })
  );
  CUERPOS.clayPixverse = ADAPTADORES_VIDEO[PIXVERSE]({ prompt: promptClay, frameInicial: u.clayIni, frameFinal: u.clayFin, aspectRatio: '9:16', resolucionApi: '720p', duracion: 6 });
  caso('clay-pixverse', () =>
    mismoJson(CUERPOS.clayPixverse, {
      model: PIXVERSE,
      input: { prompt: promptClay, first_frame_image_url: u.clayIni, last_frame_image_url: u.clayFin, quality: '720p', duration: 6, generate_audio_switch: false },
    })
  );
  caso('pixverse sin imagen final lanza', () =>
    assert.throws(() => ADAPTADORES_VIDEO[PIXVERSE]({ prompt: 'x', frameInicial: u.clayIni, frameFinal: null, resolucionApi: '720p', duracion: 6 }))
  );
  CUERPOS.ugcGrok1 = ADAPTADORES_VIDEO[GROK1]({
    prompt: promptUgc,
    frameInicial: null,
    frameFinal: null,
    imagenesReferencia: [u.personaje, u.productoBefem],
    aspectRatio: '9:16',
    resolucionApi: '720p',
    duracion: 10,
  });
  caso('ugc-grok1 (con @imageN)', () =>
    mismoJson(CUERPOS.ugcGrok1, {
      model: GROK1,
      input: { prompt: promptUgcGrok, image_urls: [u.personaje, u.productoBefem], duration: '10', resolution: '720p', aspect_ratio: '9:16', mode: 'normal' },
    })
  );
  caso('referenciasParaGrok', () => {
    assert.equal(referenciasParaGrok('La persona de la Imagen 1 con la imagen 2 y la imagen 10.'), 'La persona de la @image1 con la @image2 y la @image10.');
    assert.equal(referenciasParaGrok('Sin imagen aquí; imagenes 1 no; GPT Image 2 no.'), 'Sin imagen aquí; imagenes 1 no; GPT Image 2 no.');
  });
  caso('grok v1 con frame lanza', () =>
    assert.throws(() => ADAPTADORES_VIDEO[GROK1]({ prompt: 'x', frameInicial: u.clayIni, imagenesReferencia: [u.personaje], resolucionApi: '720p', duracion: 6 }))
  );
  caso('grok v1 con 8 referencias lanza', () =>
    assert.throws(() => ADAPTADORES_VIDEO[GROK1]({ prompt: 'x', imagenesReferencia: Array(8).fill(u.personaje), resolucionApi: '720p', duracion: 6 }))
  );
  CUERPOS.nb21Toma2 = ADAPTADORES_IMAGEN[NB21]({ prompt: promptToma2, referencias: [u.cafe], aspectRatio: '9:16', resolucion: '2K', formato: 'png' });
  caso('nb21-toma2 (con referencia)', () =>
    mismoJson(CUERPOS.nb21Toma2, { model: NB21, input: { prompt: promptToma2, image_input: [u.cafe], aspect_ratio: '9:16', resolution: '2K', output_format: 'png' } })
  );
  // correr.mjs no mandaba image_input sin referencias; el adaptador manda [] como nano-banana-2 desde siempre.
  CUERPOS.nb21Cafe = ADAPTADORES_IMAGEN[NB21]({ prompt: promptCafe, referencias: [], aspectRatio: '9:16', resolucion: '2K', formato: 'png' });
  caso('nb21-cafe (sin referencias, mismo cuerpo que nano-banana-2)', () => {
    mismoJson(CUERPOS.nb21Cafe, { model: NB21, input: { prompt: promptCafe, image_input: [], aspect_ratio: '9:16', resolution: '2K', output_format: 'png' } });
    const nb2 = ADAPTADORES_IMAGEN[NB2]({ prompt: promptCafe, referencias: [], aspectRatio: '9:16', resolucion: '2K', formato: 'png' });
    mismoJson({ ...CUERPOS.nb21Cafe, model: NB2 }, nb2);
  });
});

// ------------------------------------------------------------------ 4
seccion('4. Costos del catálogo = creditosClip / PRECIOS');

bloque('créditos', () => {
  caso('Kling 3.0: 10 s con sonido 227, sin sonido 151, por defecto con sonido', () => {
    assert.equal(creditosClip(KLING, 10, '720p', { sonido: true }).creditos, 227);
    assert.equal(creditosClip(KLING, 10, '720p', { sonido: false }).creditos, 151);
    assert.equal(creditosClip(KLING, 10).creditos, 227);
    assert.equal(creditosClip(KLING, 3, '720p', { sonido: false }).creditos, 45.3);
    assert.equal(creditosClip(KLING, 10, '1080p', { sonido: false }).creditos, 202);
    assert.equal(creditosClip(KLING, 10, '1080p').creditos, 302);
  });
  caso('Omni: igual con o sin sonido', () => {
    // Omni Flash 1.2 cobra por segundo (9 cr/s a 720p) y pide el largo exacto, de 3 a 15 s
    for (const [s, cr] of [[3, 27], [4, 36], [5, 45], [6, 54], [10, 90], [15, 135]]) {
      assert.equal(creditosClip(OMNI, s).creditos, cr);
      assert.equal(creditosClip(OMNI, s, '720p', { sonido: false }).creditos, cr);
    }
    assert.equal(creditosClip(OMNI, 10, '1080p').creditos, 100);
  });
  caso('Omni 1.2: largo libre, y con imagen final hasta 10 s', () => {
    assert.equal(duracionPara(OMNI, 2), 3);
    assert.equal(duracionPara(OMNI, 7.2), 8);
    assert.equal(duracionPara(OMNI, 12), 12);
    assert.equal(duracionPara(OMNI, 16), null);
    assert.equal(duracionPara(OMNI, 10, { conFinal: true }), 10);
    assert.equal(duracionPara(OMNI, 12, { conFinal: true }), null);
    assert.equal(creditosClip(OMNI, 12, '720p', { conFinal: true }).excedeTope, true);
  });
  caso('medidos en la prueba real', () => {
    assert.equal(creditosClip(GROK15, 6).creditos, 27);
    assert.equal(creditosClip(GROK15, 7).creditos, 31.5);
    assert.equal(creditosClip(GROK15, 6, '720p', { sonido: false }).creditos, 27); // Grok no apaga el audio
    assert.equal(creditosClip(PIXVERSE, 6).creditos, 43.2);
    assert.equal(creditosClip(PIXVERSE, 6, '720p', { sonido: true }).creditos, 43.2); // va siempre mudo
    assert.equal(creditosClip(GROK1, 10).creditos, 45);
    assert.equal(PRECIOS.imagen[NB21]['2K'], 6);
  });
  caso('duraciones libres', () => {
    assert.equal(duracionPara(GROK1, 4), 6); // Grok v1 empieza en 6: se pide 6 y se usa lo del bloque
    assert.equal(duracionPara(GROK1, 30), 30);
    assert.equal(duracionPara(GROK1, 31), null);
    assert.equal(duracionPara(GROK15, 4.2), 5);
    assert.equal(duracionPara(GROK15, 16), null);
    assert.equal(duracionPara(PIXVERSE, 1), 1);
    assert.equal(duracionPara(PIXVERSE, 15), 15);
    assert.equal(creditosClip(GROK1, 4).duracion, 6);
    assert.equal(creditosClip(GROK1, 4).creditos, 27);
  });

  for (const c of CATALOGO.categorias) {
    for (const o of c.opciones) {
      caso(`${c.id}=${o.id}: costo`, () => {
        if (c.id === 'imagen') {
          const primero = o.cascada[0];
          const cr = PRECIOS.imagen[primero][o.resoluciones[primero]];
          assert.equal(typeof cr, 'number', `${primero} a ${o.resoluciones[primero]} sin precio`);
          assert.deepEqual(o.costo, { min: cr, max: cr, por: 'imagen' });
          return;
        }
        // Un clip de 10 s a 720p con el primer modelo de cada cascada (y, si ese
        // exige imagen final, tambien el siguiente: el clip sin imagen final va
        // por el). El B-roll hablado va mudo, como hoy.
        const opciones = { sonido: c.id === 'brollHablado' ? false : undefined };
        const valores = [];
        for (const lista of Object.values(o.cascadas)) {
          for (const modelo of lista) {
            valores.push(creditosClip(modelo, 10, '720p', opciones).creditos);
            if (!MODELOS_VIDEO[modelo].frameFinalObligatorio) break;
          }
        }
        assert.deepEqual(o.costo, { min: Math.min(...valores), max: Math.max(...valores), por: 'clip de 10 s' });
      });
    }
  }
  caso('pixverse-grok15: 45 a 72', () => {
    const o = CATALOGO.categorias.find((c) => c.id === 'vozEnOff').opciones.find((x) => x.id === 'pixverse-grok15');
    assert.deepEqual(o.costo, { min: 45, max: 72, por: 'clip de 10 s' });
  });
});

// ------------------------------------------------------------------ 5
seccion('5. Elecciones inválidas o rotas');

bloque('normalizarEleccion y leerEleccion', () => {
  caso('ids que no existen se ignoran', () =>
    assert.deepEqual(normalizarEleccion({ vozEnOff: 'kling', ugc: 'grok', imagen: 'nb21', brollHablado: 42, foo: 'bar', guardado: '2026-11-08T00:00:00Z' }), {
      ...ELECCION_POR_DEFECTO,
      ugc: 'grok',
      imagen: 'nb21',
    })
  );
  caso('cosas que no son objeto', () => {
    for (const x of [null, undefined, 'omni', 3, ['omni']]) assert.deepEqual(normalizarEleccion(x), { ...ELECCION_POR_DEFECTO });
  });
  caso('opción de otra categoría no vale (grok en vozEnOff)', () => assert.equal(normalizarEleccion({ vozEnOff: 'grok' }).vozEnOff, 'omni'));
  caso('cascadaVideo con elección mala = por defecto', () => assert.deepEqual(cascadaVideo({ vozEnOff: 'nada' }, 'vozEnOff'), [OMNI, KLING]));

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'probar-modelos-'));
  const avisos = [];
  const warn = console.warn;
  console.warn = (...a) => avisos.push(a.join(' '));
  try {
    const ruta = path.join(dir, 'modelos.json');
    fs.writeFileSync(ruta, '{ esto no es json');
    caso('archivo roto = por defecto y avisa', () => {
      assert.deepEqual(leerEleccion(dir), { ...ELECCION_POR_DEFECTO });
      assert.equal(avisos.length, 1);
    });
    fs.writeFileSync(ruta, '﻿' + JSON.stringify({ vozEnOff: 'grok15', ugc: 'inventado', guardado: '2026-11-08T00:00:00Z' }));
    caso('archivo parcial con BOM e id malo: completa y avisa', () => {
      assert.deepEqual(leerEleccion(dir), { ...ELECCION_POR_DEFECTO, vozEnOff: 'grok15' });
      assert.equal(avisos.length, 2);
    });
    fs.writeFileSync(ruta, JSON.stringify({ ...ELECCION_POR_DEFECTO, podcastEntrevista: 'grok', guardado: '2026-11-08T00:00:00Z' }));
    caso('archivo bueno', () => assert.deepEqual(leerEleccion(dir), { ...ELECCION_POR_DEFECTO, podcastEntrevista: 'grok' }));
    fs.writeFileSync(ruta, 'null');
    caso('archivo con null = por defecto', () => assert.deepEqual(leerEleccion(dir), { ...ELECCION_POR_DEFECTO }));
  } finally {
    console.warn = warn;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ------------------------------------------------------------------ 6
seccion('6. Todo modelo del catálogo tiene adaptador y definición');

bloque('modelos', () => {
  const usados = new Set();
  for (const c of CATALOGO.categorias) {
    for (const o of c.opciones) {
      for (const lista of Object.values(o.cascadas || {})) lista.forEach((m) => usados.add(`video:${m}`));
      for (const m of o.cascada || []) usados.add(`imagen:${m}`);
      for (const m of Object.keys(o.resoluciones || {})) {
        caso(`imagen=${o.id}: ${m} en la cascada`, () => assert.ok(o.cascada.includes(m)));
      }
    }
  }
  for (const clave of usados) {
    const [tipo, m] = [clave.slice(0, clave.indexOf(':')), clave.slice(clave.indexOf(':') + 1)];
    caso(`${m}: en "modelos" como ${tipo}`, () => assert.equal(CATALOGO.modelos[m]?.tipo, tipo));
  }
  for (const [id, info] of Object.entries(CATALOGO.modelos)) {
    caso(`${id}: nombre y dialogo`, () => {
      assert.ok(info.nombre);
      assert.equal(typeof info.dialogo, 'boolean');
      assert.equal(nombreModelo(id), info.nombre);
      assert.equal(esModeloConDialogo(id), info.dialogo);
    });
    if (info.tipo === 'video') {
      caso(`${id}: adaptador y MODELOS_VIDEO`, () => {
        assert.equal(typeof ADAPTADORES_VIDEO[id], 'function');
        assert.ok(MODELOS_VIDEO[id]);
        assert.equal(MODELOS_VIDEO[id].dialogo, info.dialogo, 'dialogo distinto en config.js');
        assert.ok(MODELOS_VIDEO[id].resoluciones['720p'], 'sin 720p');
      });
    } else {
      caso(`${id}: adaptador y PRECIOS.imagen`, () => {
        assert.equal(typeof ADAPTADORES_IMAGEN[id], 'function');
        assert.ok(PRECIOS.imagen[id]);
      });
    }
  }
  caso('dialogo en todos los MODELOS_VIDEO', () => {
    for (const [id, def] of Object.entries(MODELOS_VIDEO)) assert.equal(typeof def.dialogo, 'boolean', id);
    assert.equal(MODELOS_VIDEO[OMNI].dialogo, true);
    assert.equal(MODELOS_VIDEO[KLING].dialogo, false);
    assert.equal(MODELOS_VIDEO['kling-4.0/keyframe-to-video'].dialogo, false);
  });
  caso('banderas de los modelos nuevos', () => {
    assert.equal(MODELOS_VIDEO[PIXVERSE].frameFinalObligatorio, true);
    assert.equal(MODELOS_VIDEO[PIXVERSE].frameFinal, true);
    assert.equal(MODELOS_VIDEO[GROK1].sinFrames, true);
    assert.equal(MODELOS_VIDEO[GROK1].frameFinal, false);
    assert.equal(MODELOS_VIDEO[GROK1].referencias.max, 7);
    assert.equal(MODELOS_VIDEO[GROK15].frameFinal, true);
    assert.ok(!MODELOS_VIDEO[GROK15].referencias);
    assert.ok(!MODELOS_VIDEO[OMNI].sinFrames && !MODELOS_VIDEO[OMNI].frameFinalObligatorio);
  });
  caso('nombres de variantes de kie', () => {
    assert.equal(nombreModelo('gpt-image-2-5-sunburst-text-to-image'), 'GPT Image 2.5');
    assert.equal(nombreModelo('gpt-image-2-image-to-image'), 'GPT Image 2');
    assert.equal(nombreModelo('no-existe'), null);
    assert.equal(esModeloConDialogo('no-existe'), false);
  });
});

// ------------------------------------------------------------------ 7
seccion('7. El kie simulado acepta los cuerpos buenos y rechaza los malos');

bloque('validarCuerpo', () => {
  for (const [nombre, c] of Object.entries(CUERPOS)) {
    caso(`acepta ${nombre}`, () => assert.equal(validarCuerpo(c.model, c.input), null));
  }
  // Los de siempre, tal como los arman sus adaptadores: se aceptan igual.
  const deSiempre = [
    ADAPTADORES_VIDEO[OMNI]({ prompt: 'p', frameInicial: u.clayIni, frameFinal: u.clayFin, aspectRatio: '9:16', resolucionApi: '720p', duracion: 6 }),
    ADAPTADORES_VIDEO[OMNI]({ prompt: 'p', imagenesReferencia: [u.personaje, u.productoBefem], aspectRatio: '9:16', resolucionApi: '720p', duracion: 10 }),
    ADAPTADORES_VIDEO[KLING]({ prompt: 'p', frameInicial: u.clayIni, frameFinal: null, aspectRatio: '9:16', resolucionApi: 'std', duracion: 5, sonido: false }),
    ADAPTADORES_IMAGEN[SUNBURST]({ prompt: 'p', referencias: [], aspectRatio: '9:16', resolucion: '2K' }),
    ADAPTADORES_IMAGEN[SUNBURST]({ prompt: 'p', referencias: [u.cafe], aspectRatio: '9:16', resolucion: '2K' }),
    ADAPTADORES_IMAGEN[NB2]({ prompt: 'p', referencias: [], aspectRatio: '9:16', resolucion: '1K', formato: 'png' }),
    ADAPTADORES_IMAGEN['gpt-image-2']({ prompt: 'p', referencias: [], aspectRatio: '1:1', resolucion: '1K', fondo: 'transparente' }),
  ];
  for (const c of deSiempre) caso(`acepta ${c.model}`, () => assert.equal(validarCuerpo(c.model, c.input), null));

  const sin = (o, k) => {
    const x = { ...o };
    delete x[k];
    return x;
  };
  const malos = [
    ['pixverse sin imagen final', PIXVERSE, sin(CUERPOS.clayPixverse.input, 'last_frame_image_url')],
    ['pixverse sin imagen inicial', PIXVERSE, sin(CUERPOS.clayPixverse.input, 'first_frame_image_url')],
    ['pixverse duración texto', PIXVERSE, { ...CUERPOS.clayPixverse.input, duration: '6' }],
    ['pixverse 16 s', PIXVERSE, { ...CUERPOS.clayPixverse.input, duration: 16 }],
    ['grok v1 duración número', GROK1, { ...CUERPOS.ugcGrok1.input, duration: 10 }],
    ['grok v1 duración 4', GROK1, { ...CUERPOS.ugcGrok1.input, duration: '4' }],
    ['grok v1 duración 31', GROK1, { ...CUERPOS.ugcGrok1.input, duration: '31' }],
    ['grok v1 con first_frame_url', GROK1, { ...CUERPOS.ugcGrok1.input, first_frame_url: u.clayIni }],
    ['grok v1 sin referencias', GROK1, { ...CUERPOS.ugcGrok1.input, image_urls: [] }],
    ['grok v1 con 8 referencias', GROK1, { ...CUERPOS.ugcGrok1.input, image_urls: Array(8).fill(u.personaje) }],
    ['grok 1.5 duración texto', GROK15, { ...CUERPOS.clayGrok15.input, duration: '6' }],
    ['grok 1.5 duración 16', GROK15, { ...CUERPOS.clayGrok15.input, duration: 16 }],
    ['grok 1.5 duración 0', GROK15, { ...CUERPOS.clayGrok15.input, duration: 0 }],
    ['grok 1.5 sin imagen inicial', GROK15, sin(CUERPOS.clayGrok15.input, 'first_frame_url')],
    ['nb21 resolución 3K', NB21, { ...CUERPOS.nb21Toma2.input, resolution: '3K' }],
    ['nb21 sin prompt', NB21, { ...CUERPOS.nb21Toma2.input, prompt: '' }],
  ];
  for (const [nombre, modelo, input] of malos) caso(`rechaza ${nombre}`, () => assert.equal(typeof validarCuerpo(modelo, input), 'string'));
});

// ------------------------------------------------------------------ 8
seccion('8. El modelo que de verdad hace cada clip (tope de duracion), como generar-videos');
bloque('modeloParaClip', () => {
  const deSiempre = [OMNI, KLING];
  // Con la cascada de siempre, como antes: el primero, aunque no llegue (se avisa que hay que dividir).
  caso('de siempre, 12 s: Omni', () => assert.equal(modeloParaClip(deSiempre, {}, 12, { deSiempre }), OMNI));
  caso('de siempre, 6 s: Omni', () => assert.equal(modeloParaClip(deSiempre, {}, 6, { deSiempre }), OMNI));
  // B-roll hablado con Omni elegido: Omni 1.2 llega a 15 s (el 1.1 llegaba a 10 y a los 12 lo hacia Kling).
  const brollOmni = cascadaVideo({ ...ELECCION_POR_DEFECTO, brollHablado: 'omni' }, 'brollHablado');
  const brollDeSiempre = cascadaVideo(ELECCION_POR_DEFECTO, 'brollHablado');
  caso('B-roll Omni 12 s -> Omni (1.2 llega a 15)', () => assert.equal(modeloParaClip(brollOmni, {}, 12, { deSiempre: brollDeSiempre }), OMNI));
  caso('toma B de 12 s con Omni elegido -> Kling (con imagen final Omni llega a 10)', () =>
    assert.equal(modeloParaClip(cascadaVideo(ELECCION_POR_DEFECTO, 'vozEnOff'), { frameFinal: true }, 12, { deSiempre: [] }), KLING));
  caso('B-roll Omni 8 s -> Omni', () => assert.equal(modeloParaClip(brollOmni, {}, 8, { deSiempre: brollDeSiempre }), OMNI));
  caso('B-roll Kling 12 s -> Kling', () => assert.equal(modeloParaClip(brollDeSiempre, {}, 12, { deSiempre: brollDeSiempre }), KLING));
  // PixVerse se salta sin imagen final; con imagen final la hace el.
  const pv = cascadaVideo({ ...ELECCION_POR_DEFECTO, vozEnOff: 'pixverse-grok15' }, 'vozEnOff');
  caso('PixVerse sin imagen final -> Grok 1.5', () => assert.equal(modeloParaClip(pv, { frameFinal: false }, 6, { deSiempre }), GROK15));
  caso('PixVerse con imagen final -> PixVerse', () => assert.equal(modeloParaClip(pv, { frameFinal: true }, 6, { deSiempre }), PIXVERSE));
  // Sin segundos, el primero que sirve.
  caso('sin segundos', () => assert.equal(modeloParaClip(brollOmni, {}, null, { deSiempre: brollDeSiempre }), OMNI));
});

// ------------------------------------------------------------------ 9
seccion('9. La salida de Grok y PixVerse queda como una de Omni (normalizarClip, con ffmpeg)');
{
  const { normalizarClip } = await import('../generar-videos.js');
  const { execFileSync } = await import('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'probar-normalizar-'));
  const medir = (f) =>
    JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', f], { encoding: 'utf8' }));
  // Como lo da Grok 1.5: 704x1280 con audio y una portada mjpeg como segundo video.
  const portada = path.join(dir, 'portada.jpg');
  const grok = path.join(dir, 'grok.mp4');
  const ffmpeg = (args) => execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'ignore' });
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=blue:s=704x1280', '-frames:v', '1', portada]);
  const sinPortada = path.join(dir, 'sin-portada.mp4');
  ffmpeg(['-f', 'lavfi', '-i', 'testsrc=s=704x1280:r=24:d=2', '-f', 'lavfi', '-i', 'sine=d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', sinPortada]);
  ffmpeg(['-i', sinPortada, '-i', portada, '-map', '0', '-map', '1', '-c', 'copy', '-disposition:v:1', 'attached_pic', grok]);
  // Una de Omni: 720x1280, un video y un audio.
  const omni = path.join(dir, 'omni.mp4');
  ffmpeg(['-f', 'lavfi', '-i', 'testsrc=s=720x1280:r=24:d=2', '-f', 'lavfi', '-i', 'sine=d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', omni]);
  const omniAntes = fs.readFileSync(omni);
  bloque('normalizarClip', () => {
    caso('grok: cambia', () => assert.equal(normalizarClip(grok, '9:16'), true));
    const m = medir(grok);
    const videos = m.streams.filter((s) => s.codec_type === 'video');
    caso('grok: un solo video de 720x1280', () => assert.deepEqual(videos.map((s) => `${s.width}x${s.height}`), ['720x1280']));
    caso('grok: conserva el audio', () => assert.equal(m.streams.filter((s) => s.codec_type === 'audio').length, 1));
    caso('grok: mismo largo', () => assert.ok(Math.abs(Number(m.format.duration) - 2) < 0.1, m.format.duration));
    caso('grok: otra vez no cambia', () => assert.equal(normalizarClip(grok, '9:16'), false));
    caso('omni: no se toca', () => {
      assert.equal(normalizarClip(omni, '9:16'), false);
      assert.ok(fs.readFileSync(omni).equals(omniAntes));
    });
  });
  fs.rmSync(dir, { recursive: true, force: true });
}

// ------------------------------------------------------------------ fin
console.log('');
if (fallos.length) {
  console.log(`FALLARON ${fallos.length} de ${ok + fallos.length} comprobaciones:\n`);
  for (const f of fallos) console.log(`  x ${f}\n`);
  process.exit(1);
}
console.log(`Todo bien: ${ok} comprobaciones.`);

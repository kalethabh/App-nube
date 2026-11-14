// Configuracion central de la capa de produccion.
// Endpoints y nombres de modelo tomados de https://docs.kie.ai (no de memoria).

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DIR_TEMP = path.join(RAIZ, 'temp');
export const DIR_OUTPUT = path.join(RAIZ, 'output');

// Carga .env sin dependencias externas (Node >= 20.12).
export function cargarEnv() {
  const ruta = path.join(RAIZ, '.env');
  if (!fs.existsSync(ruta)) {
    throw new Error('No encuentro el archivo .env en la raiz del proyecto. Copia .env.example como .env y pega tus claves.');
  }
  process.loadEnvFile(ruta);
}

export function requerirClave(nombre, comoObtenerla) {
  const valor = (process.env[nombre] || '').trim();
  if (!valor) {
    throw new Error(`Falta ${nombre} en el archivo .env.\n  Como obtenerla: ${comoObtenerla}`);
  }
  return valor;
}

// KIE_BASE_URL y KIE_BASE_ARCHIVOS_URL existen SOLO para las pruebas sin gastar:
// apuntan el motor al kie simulado local (produccion/pruebas/kie-simulado.js,
// 127.0.0.1). En el .env no van. Se leen al importar este archivo, antes de
// cargarEnv(), asi que tienen que venir del entorno del proceso; y aunque
// estuvieran en el .env, process.loadEnvFile no pisa una variable que ya esta
// puesta en el entorno (comprobado con Node 24.19).
export const KIE = {
  base: process.env.KIE_BASE_URL || 'https://api.kie.ai',
  crearTarea: '/api/v1/jobs/createTask',
  consultarTarea: '/api/v1/jobs/recordInfo',
  // OJO: la subida de archivos NO vive en api.kie.ai sino en este host.
  // La pagina de docs muestra api.kie.ai, pero ese devuelve 404. Verificado a mano.
  baseArchivos: process.env.KIE_BASE_ARCHIVOS_URL || 'https://kieai.redpandaai.co',
  subirBase64: '/api/file-base64-upload',
  creditos: '/api/v1/chat/credit',
  // https://kie.ai/pricing  <- precios vigentes. No hardcodear costos aqui.
  precios: 'https://kie.ai/pricing',
};

export const MODELOS = {
  // Desde el 2026-10-24 las imagenes de TODOS los estilos salen de
  // MODELO_IMAGEN_POR_DEFECTO (GPT Image 2.5 Sunburst, abajo). Este par queda
  // como el respaldo de las hojas UGC y de los iconos, y para npm run test:imagen.
  imagen: {
    principal: 'nano-banana-2',
    respaldo: 'gpt-image-2',
  },
  video: {
    // OJO con la eleccion de este modelo. En kie.ai conviven dos "Omni":
    //
    //   gemini-omni-video            image_urls son solo REFERENCIAS.
    //                                No acepta frame final. firstFrameUrl y
    //                                lastFrameUrl ahi son campos de SALIDA.
    //   google/gemini-omni-flash-1-1 y 1-2 aceptan first_frame_url + last_frame_url.
    //
    // Nuestras tomas Tipo B necesitan frame final, asi que va el flash. Desde
    // el 2026-11-13 es el 1.2 (pedido del usuario: "el nuevo, reemplazar el
    // 1.1"): cobra por segundo (10 s a 1080p = 100 cr; el 1.1 cobraba 126 por
    // el tramo de 10 s), hace clips de 3 a 15 s (3 a 10 con frame final),
    // mejor habla y labios, y sostiene mejor caras y producto. Verificado en:
    //   https://docs.kie.ai/market/google/gemini-omni-flash-1-2
    //   https://kie.ai/gemini-omni-1-2-flash (precios)
    principal: 'google/gemini-omni-flash-1-2',
    // Kling 3.0. El 2026-10-24 se cambio a Kling 4.0 y se probo con clips reales
    // (ESTADO-ACTUAL 1.16): mejor lip-sync, pero 28,5 cr/s. Diego, 2026-10-25: "es
    // bueno, pero es caro; me parece mas razonable el 3.0 para respaldo". La
    // definicion de kling-4.0/keyframe-to-video queda abajo, sin usar.
    respaldo: 'kling-3.0/video',
  },
};

/**
 * Resolucion de video por defecto para TODO el pipeline, respaldos incluidos.
 *
 * 1080p desde el 2026-11-08 (traido de IA-VID-AUTOMATIC, a pedido del usuario,
 * para que los anuncios se vean tan nitidos como los de referencia): el modelo
 * principal era gemini-omni-flash-1-1, que cobraba IGUAL en 720p y en 1080p; el
 * 1.2 (2026-11-13) cobra 9 cr/s a 720p y 10 a 1080p; Kling, el
 * respaldo, cobra por segundo un poco mas (ver MODELOS_VIDEO). El MP4 final
 * sale tambien en 1080x1920 (ensamblar.js le pasa a Remotion --scale=1.5;
 * ESCALA_RENDER) y los clips quietos (clips-sin-cobro.js) se arman del mismo
 * tamano. Para volver a 720p: RESOLUCION_VIDEO=720p en el .env.
 */
function textoDelEnv(nombre, porDefecto, permitidos) {
  let v = process.env[nombre];
  if (v === undefined) {
    try {
      const m = fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').match(new RegExp(`^\\s*${nombre}\\s*=\\s*([^\\s#]+)`, 'm'));
      v = m?.[1];
    } catch {
      v = undefined;
    }
  }
  v = String(v || '').trim().toLowerCase();
  return permitidos.includes(v) ? v : porDefecto;
}
export const RESOLUCION_VIDEO = textoDelEnv('RESOLUCION_VIDEO', '1080p', ['720p', '1080p']);
/** Cuanto se agranda el render de Remotion (compuesto a 720x1280): 1.5 = 1080x1920. */
export const ESCALA_RENDER = RESOLUCION_VIDEO === '1080p' ? 1.5 : 1;

/**
 * UGC POR BLOQUES (tomas tipo "R" = solo referencias, cero frames).
 *
 * En un manifiesto con tomas R no se genera ningun frame: cada bloque se pide
 * a Omni con la imagen del personaje y la foto del producto como REFERENCIAS
 * (image_urls), no como primer cuadro. Lo unico que se genera en la etapa de
 * imagen es la hoja de cada personaje.
 *
 * Por que modelos propios y no MODELOS.imagen / MODELOS.video:
 *
 *  - Imagen: la hoja del personaje sale con GPT Image 2.5 Sunburst a 2K. Fue la
 *    de la prueba real del 2026-10-04 (temp/prueba-ugc-bloques/, Befem): piel
 *    con textura real y cara que Omni sostuvo en los dos bloques. Desde el
 *    2026-10-24 es el mismo modelo de todos los estilos (MODELO_IMAGEN_POR_DEFECTO);
 *    se deja aparte porque su respaldo es MODELOS.imagen.principal.
 *  - Video: solo flash-1-1 sabe mandar image_urls en ADAPTADORES_VIDEO. Si
 *    algun dia MODELOS.video.principal cambia, los bloques R no se pueden ir con
 *    el: siguen aqui. Y NO tienen respaldo (decision de Diego, 2026-10-04):
 *    Kling (3.0 entonces) usa las imagenes como frames, no genera dialogo y
 *    pronuncia mal. Con Kling 4.0 (keyframe-to-video) sigue igual: solo frames.
 */
export const MODELO_IMAGEN_UGC = 'gpt-image-2-5-sunburst';
export const RESOLUCION_IMAGEN_UGC = '2K';
export const MODELO_VIDEO_UGC = 'google/gemini-omni-flash-1-2';

/**
 * MODELO DE IMAGEN DE TODOS LOS ESTILOS (decision de Diego, 2026-10-24: "para
 * imagen siempre GPT Image 2.5 Sunburst"; era el punto 4 de su hoja de ruta).
 *
 * Todas las imagenes de un anuncio salen con esta cascada: hojas (personaje,
 * lugar, producto), frames iniciales, frames finales y B-roll. GPT Image 2.5
 * Sunburst de principal a 2K (su unico precio medido, ver PRECIOS) y
 * nano-banana-2 de respaldo a su 1K de siempre. Sin referencias sale el
 * text-to-image y con referencias el image-to-image: eso lo decide
 * ADAPTADORES_IMAGEN, no esta cascada. Ya era la de estilo-lego (2026-10-05) y
 * la de podcast y entrevista (2026-10-13), probada en sus anuncios reales.
 *
 * Aparte quedan las hojas de los bloques UGC tipo R (MODELO_IMAGEN_UGC, el mismo
 * Sunburst a 2K) y los iconos de entrevista (MODELO_IMAGEN_ICONOS, gpt-image-2
 * con fondo transparente).
 */
export const MODELO_IMAGEN_POR_DEFECTO = {
  cascada: ['gpt-image-2-5-sunburst', 'nano-banana-2'],
  resoluciones: { 'gpt-image-2-5-sunburst': '2K', 'nano-banana-2': '1K' },
};

/**
 * EXCEPCIONES POR ESTILO. Un estilo que esta en esta tabla genera TODAS sus
 * imagenes con su propia cascada y resoluciones en vez de MODELO_IMAGEN_POR_DEFECTO.
 * Hoy no hay ninguna: estilo-lego, podcast y entrevista estaban aqui con la misma
 * cascada que ahora es la de todos.
 */
export const MODELO_IMAGEN_POR_ESTILO = {};

/** La cascada de imagen de un estilo: su excepcion, o la de todos. */
export const modeloImagenDelEstilo = (estilo) =>
  Object.hasOwn(MODELO_IMAGEN_POR_ESTILO, estilo ?? '') ? MODELO_IMAGEN_POR_ESTILO[estilo] : MODELO_IMAGEN_POR_DEFECTO;

/**
 * ESTILOS QUE ADMITEN CONTINUIDAD (produccion/continuidad.js): los animados con
 * narrador en voz en off. Cada video va de la imagen de una toma a la de la
 * siguiente, sin B-roll ni transiciones del editor. Son los valores de
 * "estilo" que escriben sus skills en el manifiesto. La app local lee esta
 * misma lista para ofrecer "¿Deseas continuidad?".
 *
 * Fuera quedan los que tienen la voz dentro del clip (UGC, objeto parlante) o
 * cantada (historias musicales, musicales): encadenar los clips la rompe.
 */
export const ESTILOS_CON_CONTINUIDAD = ['estilo-pixar', 'claymation', 'zack-d-films', 'crochet', 'estilo-lego', 'skeleton'];

/**
 * ESTILOS HABLADOS (podcast y entrevista, 2026-10-13). Ver
 * ESPECIFICACION-podcast-entrevista.md. Sus tomas son tipo "H": la persona
 * habla dentro del clip (dialogo nativo) y la imagen del clip
 * (img/toma-N-inicial.png) se genera con las referencias (hojas, producto).
 * El video se pide a Omni de una de dos maneras (first_frame_url e
 * image_urls no se mezclan en la misma llamada):
 *
 *  - Frame inicial (podcast, y una toma de entrevista sin "ingredientes"):
 *    esa imagen como first_frame_url, sin referencias.
 *  - Por ingredientes (entrevista, ESTILOS_CON_INGREDIENTES, 2026-10-14):
 *    "tomas[].ingredientes" en orden, como image_urls: "imagen" es la imagen
 *    del clip (imagen 1, que el prompt pide usar como frame inicial) y los
 *    demas son ids de referencias (en B la mano con el microfono y, si sale,
 *    la foto del producto). Asi lo hace Diego en Flow y el habla sale mucho
 *    mas limpia (pruebas Befem A y B). Mismo modelo, mismo precio.
 *
 * Todo lo que ramifica por estos estilos ramifica SOLO por ellos: un
 * manifiesto de cualquier otro estilo pasa por el motor exactamente igual que
 * antes. Decisiones de Diego (2026-10-13):
 *
 *  - Sin musica de fondo: ni Suno, ni pista fija, ni el aviso de "sin musica".
 *  - Sin modelo de respaldo para las tomas habladas (Kling no genera dialogo).
 *  - El B-roll de estos estilos se genera con Kling 3.0 (mas barato, a su
 *    criterio), siempre mudo (en el montaje va sin audio), desde una imagen
 *    generada como el B-roll de siempre. Kling cobra por segundo: 15,1 cr/s a
 *    720p sin audio, 22,7 con audio (kie, 2026-11-07; ver MODELOS_VIDEO). Del 2026-10-24 al 25 fue
 *    Kling 4.0 (28,5 cr/s); Diego lo volvio a 3.0 por el precio.
 *  - Los iconos (entrevista) se generan con gpt-image-2 a 1K, cuadrados, con
 *    fondo transparente (campo "background" de la API; si el modelo lo
 *    ignora, el montaje los muestra dentro de una tarjeta blanca).
 */
export const ESTILOS_HABLADOS = ['podcast', 'entrevista'];
export const ESTILOS_SIN_MUSICA = ['podcast', 'entrevista'];
export const ESTILOS_SIN_RESPALDO_VIDEO = ['podcast', 'entrevista'];
export const MODELO_VIDEO_BROLL_POR_ESTILO = { podcast: 'kling-3.0/video', entrevista: 'kling-3.0/video' };
export const SONIDO_BROLL_POR_ESTILO = { podcast: false, entrevista: false };
export const MODELO_IMAGEN_ICONOS = 'gpt-image-2';
export const RESOLUCION_IMAGEN_ICONOS = '1K';
/**
 * Lo que se puede pedir para una toma hablada (tipo H). Con Omni Flash 1.1
 * eran los tramos 4, 6, 8 y 10; el 1.2 (2026-11-13) acepta cualquier entero de
 * 3 a 15 y cobra por segundo: la toma se pide con su largo medido, redondeado
 * hacia arriba, sin pagar segundos de mas.
 */
export const DURACIONES_H = Object.freeze(Array.from({ length: 13 }, (_, i) => i + 3));
/**
 * Estilos cuyas tomas H se generan por INGREDIENTES ("tomas[].ingredientes",
 * ver arriba). El podcast no esta: Diego lo aprobo con frame inicial y por
 * ingredientes no se probo. El validador no deja el campo en ningun otro estilo.
 */
export const ESTILOS_CON_INGREDIENTES = ['entrevista'];
/** El ingrediente que es la imagen del clip (img/toma-N-inicial.png); el resto son ids de referencias. */
export const INGREDIENTE_IMAGEN = 'imagen';

/**
 * Capacidades y precios de cada modelo de video. Verificado el 2026-09-01 en
 * https://docs.kie.ai y https://kie.ai/pricing
 *
 * Ojo con dos cosas:
 *  - gemini-omni-video cobra POR VIDEO segun el tramo de duracion, y cobra
 *    IGUAL en 360p, 720p y 1080p. Solo 4k cuesta mas.
 *  - kling-3.0 cobra POR SEGUNDO y ahi 720p si es mas barato que 1080p.
 *
 * Campos que deciden por donde puede ir un clip (los lee la cascada de
 * generar-videos.js; los modelos que se eligen en la app estan en
 * catalogo-modelos.json y la eleccion de cada anuncio en modelos-elegidos.js):
 *
 *  - dialogo                el modelo genera habla con boca sincronizada si el
 *                           prompt la pide. Va tambien en el catalogo y en
 *                           video/log-modelos.json.
 *  - frameFinal             acepta imagen final (tomas B, pasos de continuidad).
 *  - frameFinalObligatorio  SOLO funciona con imagen inicial y final: un clip
 *                           sin imagen final salta este modelo sin pedirle nada.
 *  - sinFrames              no acepta primer ni ultimo frame: solo sirve por el
 *                           camino de referencias (bloques R de UGC y tomas H por
 *                           ingredientes). Un clip con frame lo salta.
 *  - duracionMaxConFinal    lo mas largo que hace CON imagen final (si es menos
 *                           que duracionMax): una B o un paso de continuidad mas
 *                           largo excede su tope (duracionPara con conFinal).
 */
export const MODELOS_VIDEO = {
  // Omni Flash 1.2 (2026-11-13, el principal). Lo nuevo frente al 1.1, segun la
  // doc de kie: duracion entera de 3 a 15 s (3 a 10 con first + last frame),
  // cobro POR SEGUNDO (antes por tramo), hasta 6 referencias (antes 7) que no se
  // mezclan con frames, audio con habla, musica y efectos sincronizados (habla
  // mas natural, labios mas claros, varios hablantes distintos) y mas
  // consistencia de caras, ropa, empaque y producto entre tomas.
  'google/gemini-omni-flash-1-2': {
    dialogo: true,
    resoluciones: {
      '360p': { alto: 360, api: '360p' },
      '720p': { alto: 720, api: '720p' },
      '1080p': { alto: 1080, api: '1080p' },
      '4k': { alto: 2160, api: '4k' },
    },
    duraciones: null, // libre: un entero
    duracionMin: 3,
    duracionMax: 15,
    duracionMaxConFinal: 10,
    frameFinal: true, // first_frame_url + last_frame_url
    referencias: { max: 6 },
    // El audio ahora esta documentado (habla, musica y efectos), pero sigue sin
    // parametro: sale solo, como en el 1.1.
    audio: {
      soportado: true,
      documentado: true,
      parametro: null,
      contenido: 'habla, musica y efectos sincronizados (doc de kie, 2026-11-13)',
    },
    cobro: 'por-segundo',
    // Creditos por segundo (kie.ai/gemini-omni-1-2-flash, 2026-11-13).
    precio: { '360p': 4, '720p': 9, '1080p': 10, '4k': 22 },
  },
  'google/gemini-omni-flash-1-1': {
    dialogo: true,
    // nombre canonico -> { alto en pixeles, valor que espera la API }
    resoluciones: {
      '360p': { alto: 360, api: '360p' },
      '720p': { alto: 720, api: '720p' },
      '1080p': { alto: 1080, api: '1080p' },
      '4k': { alto: 2160, api: '4k' },
    },
    duraciones: [4, 6, 8, 10],
    frameFinal: true, // first_frame_url + last_frame_url
    // Sin frames, acepta hasta 7 imagenes de REFERENCIA en image_urls (no se
    // pueden mezclar con first_frame_url). Lo usan los bloques UGC tipo R y
    // las tomas H de la entrevista por ingredientes (ESTILOS_CON_INGREDIENTES).
    // Probado el 2026-10-04 con 2 (personaje + producto), 10 s 720p = 126 cr.
    referencias: { max: 7 },
    // AUDIO: la doc no expone ningun parametro (no hay sound / generate_audio /
    // enable_audio), y su unico campo de audio, audio_ids, es "mutually exclusive
    // with first_frame_url". Sin embargo, VERIFICADO A MANO el 2026-09-01: los
    // clips SI vienen con pista AAC de ambiente y efectos, sin voces, usando
    // first_frame_url + last_frame_url. Medido con volumedetect: mean -33 a
    // -45 dB con picos de -2 a -14 dB (una pista muda daria ~-91 dB).
    //
    // O sea: hay audio nativo no documentado, gratis, y es justo lo que
    // queremos. No se puede pedir ni apagar por parametro. Si algun dia deja de
    // venir, el plan B es agregar los efectos en Remotion.
    audio: {
      soportado: true,
      documentado: false,
      parametro: null, // sale solo, no se pide
      contenido: 'ambiente y efectos, sin voces (verificado 2026-09-01)',
    },
    cobro: 'por-video',
    // Creditos por video segun el tramo. Identico en 360p, 720p y 1080p.
    precio: {
      '360p': { 4: 63, 6: 84, 8: 105, 10: 126 },
      '720p': { 4: 63, 6: 84, 8: 105, 10: 126 },
      '1080p': { 4: 63, 6: 84, 8: 105, 10: 126 },
      '4k': { 4: 147, 6: 168, 8: 189, 10: 210 },
    },
  },
  'kling-3.0/video': {
    dialogo: false,
    // En Kling la resolucion se pide con "mode", no con un campo resolution.
    resoluciones: {
      '720p': { alto: 720, api: 'std' },
      '1080p': { alto: 1080, api: 'pro' },
      '4k': { alto: 2160, api: '4K' },
    },
    duraciones: null, // libre
    duracionMin: 3,
    duracionMax: 15,
    frameFinal: true, // image_urls[1] es el frame de cierre
    // DECISION TOMADA (Diego, 2026-09-06): Kling va SIEMPRE con sound: true.
    // Vale para los SEIS estilos: este campo es lo unico que lo decide.
    //
    // Revierte la decision del 2026-09-01, que lo tenia en false. Aquella se
    // tomo por miedo a que Kling generara una voz encimada a la narracion: su
    // "sound" es un interruptor de todo o nada y no permite excluir voces.
    //
    // Por que se revirtio, con el caso que lo mostro: en el primer anuncio de
    // zack-d las tomas 6 y 14 cayeron al respaldo y salieron MUDAS. Las dos son
    // de una sola persona (una estornudando, otra enferma bajo una manta), o sea
    // justo donde no hay dos personajes hablandose, que es el unico sitio donde
    // se han observado voces coladas. Y el estornudo es exactamente el sonido
    // que el modelo pone solo. Se perdio ambiente a cambio de un riesgo que ahi
    // no existia.
    //
    // El riesgo real se maneja aguas abajo y ya esta probado: el chequeo de voces
    // del ESTADO-ACTUAL 5.10 transcribe los clips, y un clip con habla se
    // silencia. En ese mismo anuncio se detectaron y silenciaron 3 clips del
    // modelo PRINCIPAL con esa misma tecnica.
    //
    // Cuesta mas y se acepta: 720p pasaba de 14 a 20 creditos por segundo.
    audio: { soportado: true, campo: 'sound', usar: true, puedeExcluirVoces: false },
    cobro: 'por-segundo',
    // Creditos por segundo, leidos en kie el 2026-11-07 (antes 14/18/67 y 20/27/67).
    // creditosClip usa precioConAudio cuando el clip va con sound: true.
    precio: { '720p': 15.1, '1080p': 20.2, '4k': 75.5 }, // sin audio
    precioConAudio: { '720p': 22.7, '1080p': 30.2, '4k': 75.5 },
  },
  // Grok Imagine Video 1.5 (preview). Probado de verdad el 2026-11-08
  // (temp/prueba-modelos-baratos/correr.mjs): 6 s con imagen inicial y final =
  // 27 cr, 7 s con solo imagen inicial = 31,5 cr, o sea 4,5 cr/s a 720p.
  //  - first_frame_url y last_frame_url opcional.
  //  - duration ENTERO de 1 a 15.
  //  - resolution '480p' | '720p' | '1080p' (1080p sin precio medido: no se lista).
  //  - aspect_ratio del manifiesto ('9:16').
  //  - Sin referencias. El audio va siempre (no hay campo para apagarlo) y el
  //    dialogo escrito en el prompt se habla.
  'grok-imagine-video-1-5-preview': {
    dialogo: true,
    // La salida trae una portada (mjpeg) como 2.o video y a veces otro ancho
    // (704x1280): generar-videos la deja como una de Omni (normalizarClip).
    normalizarSalida: true,
    resoluciones: {
      '480p': { alto: 480, api: '480p' },
      '720p': { alto: 720, api: '720p' },
    },
    duraciones: null, // libre, entero
    duracionMin: 1,
    duracionMax: 15,
    frameFinal: true,
    audio: { soportado: true, campo: null, usar: true, puedeExcluirVoces: false },
    cobro: 'por-segundo',
    precio: { '480p': 2.4, '720p': 4.5 },
    precioConAudio: { '480p': 2.4, '720p': 4.5 },
  },
  // PixVerse V6 Transition. Probado de verdad el 2026-11-08: 6 s a 720p mudo =
  // 43,2 cr (7,2 cr/s).
  //  - first_frame_image_url y last_frame_image_url, LOS DOS OBLIGATORIOS: un
  //    clip sin imagen final no puede ir por aqui (frameFinalObligatorio).
  //  - quality '720p' (no tiene campo resolution ni aspect_ratio: la salida
  //    sigue a las imagenes).
  //  - duration ENTERO de 1 a 15.
  //  - generate_audio_switch: false siempre (con audio cobra 9,6 cr/s). Sin dialogo.
  'pixverse-v6/transition': {
    dialogo: false,
    // La salida trae una portada (mjpeg) como 2.o video y a veces otro ancho
    // (704x1280): generar-videos la deja como una de Omni (normalizarClip).
    normalizarSalida: true,
    resoluciones: {
      '720p': { alto: 720, api: '720p' },
    },
    duraciones: null, // libre, entero
    duracionMin: 1,
    duracionMax: 15,
    frameFinal: true,
    frameFinalObligatorio: true,
    audio: { soportado: true, campo: null, usar: false, puedeExcluirVoces: false },
    cobro: 'por-segundo',
    precio: { '720p': 7.2 },
    precioConAudio: { '720p': 9.6 },
  },
  // Grok Imagine (v1) imagen a video. Probado de verdad el 2026-11-08 con un
  // bloque UGC de 10 s (personaje + producto como referencias) = 45 cr, 4,5 cr/s.
  //  - image_urls: de 1 a 7 REFERENCIAS, sin primer ni ultimo frame
  //    (sinFrames): solo sirve para los bloques R y las tomas H por ingredientes.
  //  - El prompt nombra las referencias como @image1, @image2...: el adaptador
  //    traduce el "Imagen N" / "imagen N" de nuestros prompts (asi se probo).
  //  - duration TEXTO de '6' a '30'. Un bloque de 4 s se pide de 6 y se usa con
  //    la duracion del bloque.
  //  - resolution '720p', aspect_ratio '9:16', mode 'normal'.
  //  - El audio va siempre y el dialogo escrito en el prompt se habla.
  'grok-imagine/image-to-video': {
    dialogo: true,
    // La salida trae una portada (mjpeg) como 2.o video y a veces otro ancho
    // (704x1280): generar-videos la deja como una de Omni (normalizarClip).
    normalizarSalida: true,
    // 1080p solo acepta una referencia; esta categoria usa personaje + producto.
    // Se pide como maximo 720p para que el costo y la solicitud coincidan y
    // la cascada no pague un modelo distinto por un rechazo de resolucion.
    resoluciones: {
      '480p': { alto: 480, api: '480p' },
      '720p': { alto: 720, api: '720p' },
    },
    duraciones: null, // libre, entero (se manda como texto)
    duracionMin: 6,
    duracionMax: 30,
    frameFinal: false,
    sinFrames: true,
    referencias: { max: 7 },
    audio: { soportado: true, campo: null, usar: true, puedeExcluirVoces: false },
    cobro: 'por-segundo',
    precio: { '480p': 2.4, '720p': 4.5 },
    precioConAudio: { '480p': 2.4, '720p': 4.5 },
  },
  // Kling 4.0 "Keyframe To Video". SIN USAR desde el 2026-10-25 (Diego volvio el
  // respaldo a Kling 3.0 por el precio); se deja para cuando se quiera. Leido el
  // 2026-10-24 en https://docs.kie.ai/market/kling/v4-keyframe-to-video.md y
  // https://kie.ai/kling-4-0:
  //  - first_frame_url y last_frame_url (y hasta 8 keyframe_urls que no usamos);
  //    con un frame, la salida sigue el aspecto del frame y aspect_ratio no cuenta.
  //  - duration ENTERO de 3 a 30 (Kling 3.0 lo pedia como texto y hasta 15).
  //  - resolution '720p' o '1080p' (4K "proximamente"): campo resolution, no mode.
  //  - Sin parametro de audio: la pagina habla de audio sincronizado y el precio
  //    "sin video de entrada" es el mismo con o sin el. Por eso sonido se ignora.
  //  - 28,5 cr/s a 720p y 42,5 a 1080p (el ejemplo oficial: 10 s a 720p = 285 cr).
  //  - El prompt puede nombrar los frames con @first_frame / @last_frame; no es
  //    obligatorio y nuestros prompts no lo hacen.
  'kling-4.0/keyframe-to-video': {
    dialogo: false,
    resoluciones: {
      '720p': { alto: 720, api: '720p' },
      '1080p': { alto: 1080, api: '1080p' },
    },
    duraciones: null, // libre, entero
    duracionMin: 3,
    duracionMax: 30,
    frameFinal: true, // last_frame_url
    audio: { soportado: true, campo: null, usar: true, puedeExcluirVoces: false },
    cobro: 'por-segundo',
    precio: { '720p': 28.5, '1080p': 42.5 },
    precioConAudio: { '720p': 28.5, '1080p': 42.5 },
  },
};

/**
 * Devuelve la resolucion que hay que pedirle a un modelo.
 * Si el modelo ofrece la preferida, esa. Si no, la mas cercana por altura.
 */
export function resolucionPara(modelo, preferida = RESOLUCION_VIDEO) {
  const def = MODELOS_VIDEO[modelo];
  if (!def) throw new Error(`No conozco el modelo de video "${modelo}"`);

  const disponibles = Object.entries(def.resoluciones);
  const exacta = disponibles.find(([nombre]) => nombre.toLowerCase() === preferida.toLowerCase());
  if (exacta) return { nombre: exacta[0], api: exacta[1].api, alto: exacta[1].alto, exacta: true };

  const objetivo = Number(String(preferida).replace(/[^0-9]/g, '')) || 720;
  const [nombre, datos] = disponibles.reduce((mejor, actual) =>
    Math.abs(actual[1].alto - objetivo) < Math.abs(mejor[1].alto - objetivo) ? actual : mejor
  );
  return { nombre, api: datos.api, alto: datos.alto, exacta: false };
}

/**
 * Duracion que hay que pedir para cubrir `segundos` sin quedarse corto.
 * `conFinal`: el clip lleva imagen final (una B, un paso de continuidad); un
 * modelo con duracionMaxConFinal (Omni 1.2: 10 s) no pasa de ahi.
 */
export function duracionPara(modelo, segundos, { conFinal = false } = {}) {
  const def = MODELOS_VIDEO[modelo];
  if (!def) throw new Error(`No conozco el modelo de video "${modelo}"`);

  if (def.duraciones) {
    const tramo = def.duraciones.find((d) => d >= segundos);
    // Mas largo que el tope del modelo: se divide, no se trunca (seccion 6.3).
    return tramo ?? null;
  }
  const d = Math.max(def.duracionMin ?? 1, Math.ceil(segundos));
  const tope = conFinal && def.duracionMaxConFinal ? Math.min(def.duracionMaxConFinal, def.duracionMax ?? Infinity) : def.duracionMax;
  return tope && d > tope ? null : d;
}

/**
 * Si el clip sale con audio y se cobra como tal. Un modelo con interruptor de
 * audio (Kling: campo "sound") va con `sonido` si llega como booleano y si no
 * con su audio.usar; uno sin interruptor (Omni, Grok, PixVerse) va siempre con
 * su audio.usar, se pase lo que se pase.
 */
export function audioActivo(modelo, sonido) {
  const audio = MODELOS_VIDEO[modelo]?.audio;
  if (!audio?.soportado) return false;
  if (audio.campo) return typeof sonido === 'boolean' ? sonido : Boolean(audio.usar);
  return Boolean(audio.usar);
}

/**
 * Creditos de un clip, ya resueltos modelo + resolucion + duracion. Con audio
 * activo (ver audioActivo) usa precioConAudio si el modelo lo tiene.
 * `{ sonido }` es opcional: lo pasa quien sabe que el clip va mudo (el B-roll
 * de los estilos hablados, SONIDO_BROLL_POR_ESTILO).
 */
export function creditosClip(modelo, segundos, preferida = RESOLUCION_VIDEO, { sonido, conFinal = false } = {}) {
  const def = MODELOS_VIDEO[modelo];
  const res = resolucionPara(modelo, preferida);
  const dur = duracionPara(modelo, segundos, { conFinal });
  if (dur === null) return { creditos: null, resolucion: res, duracion: null, excedeTope: true };

  const tabla = audioActivo(modelo, sonido) && def.precioConAudio ? def.precioConAudio : def.precio;
  const crudo = def.cobro === 'por-segundo' ? tabla[res.nombre] * dur : tabla[res.nombre][dur];
  // Precios con decimales (15,1 cr/s): sin el redondeo, 15.1 * 3 da 45.300000000000004.
  const creditos = typeof crudo === 'number' ? Math.round(crudo * 100) / 100 : crudo;
  return { creditos, resolucion: res, duracion: dur, excedeTope: false };
}

/**
 * Arma el cuerpo de la peticion de video para cada modelo.
 *
 * OJO en flash-1-1: "image_urls" y "first_frame_url" son MUTUAMENTE EXCLUYENTES.
 * Como nosotros siempre partimos de un frame ya generado, usamos first_frame_url
 * (y last_frame_url en las Tipo B). Las referencias de personaje y producto ya
 * se aplicaron en la etapa de imagen: aqui no se vuelven a mandar.
 *
 * UNICA EXCEPCION, los bloques UGC tipo R: no tienen frames. Llegan con
 * `imagenesReferencia` y SIN frame inicial ni final, y entonces se mandan como
 * image_urls (maximo 7, en el orden recibido: es el "Imagen 1, Imagen 2" del
 * prompt), sin first_frame_url. Ese es el cuerpo de la prueba real del
 * 2026-10-04. En cuanto llega un frame, las referencias se IGNORAN y el cuerpo
 * sale exactamente igual que antes: ningun otro estilo cambia. Las tomas H de
 * la entrevista por ingredientes (2026-10-14) llegan igual que un bloque R: la
 * imagen del clip va como la primera de image_urls, no como first_frame_url.
 */
/**
 * Grok Imagine (v1) nombra las referencias como @image1, @image2... Nuestros
 * prompts dicen "Imagen 1" / "imagen 2" (el orden de image_urls). Solo se
 * tocan esas palabras seguidas de un numero.
 */
export const referenciasParaGrok = (prompt) => String(prompt ?? '').replace(/\b[Ii]magen\s+(\d+)\b/g, '@image$1');

export const ADAPTADORES_VIDEO = {
  // Omni Flash 1.2: el mismo cuerpo que el 1.1 (frames, o referencias sin
  // frames), con la duracion como entero y hasta 6 referencias. Una sola
  // manera por pedido: con first_frame_url no van image_urls.
  'google/gemini-omni-flash-1-2': ({ prompt, frameInicial, frameFinal, imagenesReferencia, aspectRatio, resolucionApi, duracion }) => {
    const modelo = 'google/gemini-omni-flash-1-2';
    if (!frameInicial && !frameFinal && Array.isArray(imagenesReferencia) && imagenesReferencia.length > 0) {
      const max = MODELOS_VIDEO[modelo].referencias.max;
      if (imagenesReferencia.length > max) {
        // No se recorta en silencio: la imagen que sobra es una que el prompt nombra y que el modelo nunca veria.
        throw new Error(`${modelo} acepta hasta ${max} referencias y llegaron ${imagenesReferencia.length}.`);
      }
      return { model: modelo, input: { prompt, image_urls: [...imagenesReferencia], duration: Number(duracion), aspect_ratio: aspectRatio, resolution: resolucionApi } };
    }
    if (frameFinal && Number(duracion) > MODELOS_VIDEO[modelo].duracionMaxConFinal) {
      throw new Error(`${modelo} con imagen final llega hasta ${MODELOS_VIDEO[modelo].duracionMaxConFinal} s y se pidieron ${duracion}.`);
    }
    return {
      model: modelo,
      input: {
        prompt,
        first_frame_url: frameInicial,
        ...(frameFinal ? { last_frame_url: frameFinal } : {}),
        duration: Number(duracion),
        aspect_ratio: aspectRatio,
        resolution: resolucionApi,
      },
    };
  },
  'google/gemini-omni-flash-1-1': ({ prompt, frameInicial, frameFinal, imagenesReferencia, aspectRatio, resolucionApi, duracion }) => {
    if (!frameInicial && !frameFinal && Array.isArray(imagenesReferencia) && imagenesReferencia.length > 0) {
      const max = MODELOS_VIDEO['google/gemini-omni-flash-1-1'].referencias.max;
      if (imagenesReferencia.length > max) {
        // No se recorta en silencio: la imagen que sobra es una que el prompt
        // nombra ("Imagen 8") y que el modelo nunca veria.
        throw new Error(`google/gemini-omni-flash-1-1 acepta hasta ${max} referencias y llegaron ${imagenesReferencia.length}.`);
      }
      return {
        model: 'google/gemini-omni-flash-1-1',
        input: {
          prompt,
          image_urls: [...imagenesReferencia],
          duration: String(duracion),
          aspect_ratio: aspectRatio,
          resolution: resolucionApi,
        },
      };
    }
    return {
      model: 'google/gemini-omni-flash-1-1',
      input: {
        prompt,
        first_frame_url: frameInicial,
        ...(frameFinal ? { last_frame_url: frameFinal } : {}),
        duration: String(duracion),
        aspect_ratio: aspectRatio,
        resolution: resolucionApi,
      },
    };
  },
  'kling-3.0/video': ({ prompt, frameInicial, frameFinal, aspectRatio, resolucionApi, duracion, sonido }) => ({
    model: 'kling-3.0/video',
    input: {
      prompt,
      image_urls: frameFinal ? [frameInicial, frameFinal] : [frameInicial],
      // UNA sola fuente de verdad: el campo declarado en MODELOS.video.respaldo.
      // Hasta el 2026-09-06 esto estaba cableado a false aqui, ignorando ese
      // campo, asi que cambiarlo alla no tenia ningun efecto sobre la llamada.
      //
      // `sonido` (opcional) lo pasa SOLO el B-roll de los estilos hablados
      // (SONIDO_BROLL_POR_ESTILO): ese B-roll va mudo en el montaje y sin audio
      // Kling cobra 14 cr/s en vez de 20. Quien no lo pasa sigue con el de siempre.
      sound: typeof sonido === 'boolean' ? sonido : MODELOS_VIDEO['kling-3.0/video'].audio.usar,
      duration: String(duracion),
      aspect_ratio: aspectRatio,
      mode: resolucionApi,
      multi_shots: false,
    },
  }),
  // Grok Imagine 1.5: imagen inicial y, si hay, final. Sin referencias ni campo
  // de audio (`sonido` no se manda). Cuerpo probado el 2026-11-08.
  'grok-imagine-video-1-5-preview': ({ prompt, frameInicial, frameFinal, aspectRatio, resolucionApi, duracion }) => {
    if (!frameInicial) throw new Error('grok-imagine-video-1-5-preview necesita imagen inicial.');
    return {
      model: 'grok-imagine-video-1-5-preview',
      input: {
        prompt,
        first_frame_url: frameInicial,
        ...(frameFinal ? { last_frame_url: frameFinal } : {}),
        duration: Number(duracion),
        resolution: resolucionApi,
        aspect_ratio: aspectRatio,
      },
    };
  },
  // PixVerse V6 Transition: las DOS imagenes son obligatorias (la cascada salta
  // este modelo sin pedir nada cuando el clip no trae imagen final; si aun asi
  // llega aqui, es un error del motor). Siempre mudo. Sin aspect_ratio.
  'pixverse-v6/transition': ({ prompt, frameInicial, frameFinal, resolucionApi, duracion }) => {
    if (!frameInicial || !frameFinal) {
      throw new Error('pixverse-v6/transition necesita imagen inicial y final; este clip no las trae las dos.');
    }
    return {
      model: 'pixverse-v6/transition',
      input: {
        prompt,
        first_frame_image_url: frameInicial,
        last_frame_image_url: frameFinal,
        quality: resolucionApi,
        duration: Number(duracion),
        generate_audio_switch: false,
      },
    };
  },
  // Grok Imagine (v1): SOLO referencias, sin frames (sinFrames). El "Imagen N"
  // de nuestros prompts pasa a "@imageN", como en la prueba real.
  'grok-imagine/image-to-video': ({ prompt, frameInicial, frameFinal, imagenesReferencia, aspectRatio, resolucionApi, duracion }) => {
    if (frameInicial || frameFinal) {
      throw new Error('grok-imagine/image-to-video no acepta imagen inicial ni final: solo referencias.');
    }
    const refs = Array.isArray(imagenesReferencia) ? imagenesReferencia : [];
    const max = MODELOS_VIDEO['grok-imagine/image-to-video'].referencias.max;
    if (refs.length < 1 || refs.length > max) {
      throw new Error(`grok-imagine/image-to-video acepta de 1 a ${max} referencias y llegaron ${refs.length}.`);
    }
    return {
      model: 'grok-imagine/image-to-video',
      input: {
        prompt: referenciasParaGrok(prompt),
        image_urls: [...refs],
        duration: String(duracion),
        resolution: resolucionApi,
        aspect_ratio: aspectRatio,
        mode: 'normal',
      },
    };
  },
  // `sonido` no se manda: Kling 4.0 no tiene ese campo (el B-roll mudo de los
  // estilos hablados se silencia en el montaje, como siempre).
  'kling-4.0/keyframe-to-video': ({ prompt, frameInicial, frameFinal, aspectRatio, resolucionApi, duracion }) => ({
    model: 'kling-4.0/keyframe-to-video',
    input: {
      prompt,
      first_frame_url: frameInicial,
      ...(frameFinal ? { last_frame_url: frameFinal } : {}),
      duration: Number(duracion),
      resolution: resolucionApi,
      aspect_ratio: aspectRatio,
    },
  }),
};

/**
 * Cada modelo de imagen nombra sus campos distinto. Este adaptador traduce
 * nuestra peticion generica al cuerpo que espera cada uno.
 *
 *   nano-banana-2   -> image_input
 *   gpt-image-2     -> input_urls, y ADEMAS cambia el string del modelo
 *                      segun haya o no referencias.
 *   gpt-image-2-5-sunburst -> igual que gpt-image-2: input_urls, y el string
 *                      del modelo cambia segun haya o no referencias. Es el
 *                      modelo de todas las imagenes de todos los estilos (ver
 *                      MODELO_IMAGEN_POR_DEFECTO) y de las hojas de manifiestos
 *                      con tomas R (ver MODELO_IMAGEN_UGC).
 *
 * Verificado en docs.kie.ai (2026-08-31):
 *   https://docs.kie.ai/market/google/nanobanana2
 *   https://docs.kie.ai/market/gpt/gpt-image-2-text-to-image
 *   https://docs.kie.ai/market/gpt/gpt-image-2-image-to-image
 *
 * Sunburst: el text-to-image se uso de verdad el 2026-10-04 con estos mismos
 * campos (prompt, aspect_ratio, resolution 2K -> 10 creditos, ver
 * temp/prueba-ugc-bloques/prompts-usados.json). El image-to-image
 * (gpt-image-2-5-sunburst-image-to-image con input_urls) sigue la misma forma
 * que gpt-image-2 pero todavia no se ha llamado nunca desde aqui.
 * Los dos verificados en docs.kie.ai el 2026-10-05, coinciden con este cuerpo:
 *   https://docs.kie.ai/market/gpt/gpt-image-2-5-sunburst-text-to-image
 *   https://docs.kie.ai/market/gpt/gpt-image-2-5-sunburst-image-to-image
 * prompt hasta 20000 caracteres, input_urls hasta 16 imagenes (obligatorio en
 * el image-to-image), 9:16 admite 2K. "background" es opcional: solo se manda
 * con fondo 'opaco' (anuncios de imagen); los videos no lo mandan.
 */
export const ADAPTADORES_IMAGEN = {
  'nano-banana-2': ({ prompt, referencias, aspectRatio, resolucion, formato }) => ({
    model: 'nano-banana-2',
    input: {
      prompt,
      image_input: referencias,
      aspect_ratio: aspectRatio,
      resolution: resolucion,
      output_format: formato,
    },
  }),
  // Nano Banana 2.1: el mismo cuerpo que nano-banana-2. Probado el 2026-11-08 a
  // 2K (6 creditos), con y sin referencias.
  'nano-banana-2-1': ({ prompt, referencias, aspectRatio, resolucion, formato }) => ({
    model: 'nano-banana-2-1',
    input: {
      prompt,
      image_input: referencias,
      aspect_ratio: aspectRatio,
      resolution: resolucion,
      output_format: formato,
    },
  }),
  // `fondo: 'transparente'` (opcional) lo piden SOLO los iconos de los estilos
  // hablados (ver MODELO_IMAGEN_ICONOS): manda background: "transparent". Quien
  // no lo pasa manda el mismo cuerpo de siempre.
  'gpt-image-2': ({ prompt, referencias, aspectRatio, resolucion, fondo }) => {
    const extra = fondo === 'transparente' ? { background: 'transparent' } : {};
    return referencias.length > 0
      ? {
          model: 'gpt-image-2-image-to-image',
          input: { prompt, input_urls: referencias, aspect_ratio: aspectRatio, resolution: resolucion, ...extra },
        }
      : {
          model: 'gpt-image-2-text-to-image',
          input: { prompt, aspect_ratio: aspectRatio, resolution: resolucion, ...extra },
        };
  },
  // `fondo: 'opaco'` (opcional) lo pide SOLO la seccion de anuncios de imagen
  // (produccion/imagen-ads.js, FONDO): manda background: "opaque", como la
  // skill (kie_cliente.py). Sin `fondo` (los videos), el cuerpo de siempre.
  'gpt-image-2-5-sunburst': ({ prompt, referencias, aspectRatio, resolucion, fondo }) => {
    const extra = fondo === 'opaco' ? { background: 'opaque' } : {};
    return referencias.length > 0
      ? {
          model: 'gpt-image-2-5-sunburst-image-to-image',
          input: { prompt, input_urls: referencias, aspect_ratio: aspectRatio, resolution: resolucion, ...extra },
        }
      : {
          model: 'gpt-image-2-5-sunburst-text-to-image',
          input: { prompt, aspect_ratio: aspectRatio, resolution: resolucion, ...extra },
        };
  },
};

/**
 * Precios en creditos por generacion. Consultados en https://kie.ai/pricing
 * el 2026-09-01 y releidos el 2026-11-07 (ese dia cambio Kling 3.0 y se
 * midieron los modelos nuevos; Omni seguia igual). LOS PRECIOS CAMBIAN: si la estimacion se ve rara, vuelve a
 * mirar la pagina y actualiza esta tabla.
 *
 * El costo real de cada tarea llega en "creditsConsumed" al consultarla, asi
 * que lo que se reporta al final del proceso es el gasto real, no el estimado.
 */
export const PRECIOS = {
  consultado: '2026-11-07',
  usdPorCredito: 0.005, // 168 creditos = US$0.84 en toda la tabla
  imagen: {
    'nano-banana-2': { '1K': 8, '2K': 12, '4K': 18 },
    'gpt-image-2': { '1K': 6, '2K': 10, '4K': 16 },
    // 2K MEDIDO el 2026-10-04 (saldo antes/despues de la prueba de UGC por
    // bloques: 10 creditos justos). 1K y 4K NO VERIFICADOS: van en null a
    // proposito, para que nadie estime con un numero inventado. Quien los use,
    // que los mida primero y los anote aqui.
    // El image-to-image (estilo-lego) se estima con este mismo 2K: la pagina
    // del modelo, https://kie.ai/gpt-image-2-5 (leida el 2026-10-05), publica
    // el mismo precio para text-to-image e image-to-image, 6 / 10 / 16
    // creditos a 1K / 2K / 4K. Solo el 2K esta medido.
    'gpt-image-2-5-sunburst': { '1K': null, '2K': 10, '4K': null },
    // 2K MEDIDO el 2026-11-08 (temp/prueba-modelos-baratos: 6 creditos cada una,
    // con y sin referencias). 1K y 4K sin medir: en null por lo mismo que arriba.
    'nano-banana-2-1': { '1K': null, '2K': 6, '4K': null },
  },
  // Los precios de video viven en MODELOS_VIDEO, arriba: alli dependen
  // de resolucion y tramo de duracion, no de un solo numero.
};

export const creditosAUsd = (creditos) => creditos * PRECIOS.usdPorCredito;

/**
 * VELOCIDAD (aprobado por Diego, 2026-10-24). Cuantas tareas hay en marcha a la
 * vez en kie.ai: siempre hasta N; cuando una termina entra la siguiente (pool,
 * no tandas que esperan a la mas lenta). Hasta el 2026-10-24 eran 4 y 3.
 *
 * kie.ai admite 20 pedidos nuevos (createTask) cada 10 s y mas de 100 tareas en
 * marcha por cuenta. Lo que frena es lo primero, y eso lo cuida
 * LIMITE_CREACIONES (abajo), no estos numeros.
 */
export const CONCURRENCIA = 12;
export const CONCURRENCIA_VIDEO = 10; // los videos pesan mas y tardan mas

/**
 * ESPERA DE UNA TAREA: AVISO y TOPE (opcion segura de Diego, 2026-10-24).
 *
 * Mientras kie diga que una tarea sigue "generando", NUNCA se crea otra igual:
 * crear otra podia cobrar dos veces si la primera terminaba despues. Por eso el
 * tiempo de espera ya no corta:
 *
 *   AVISO  (POLLING.timeoutMs para imagen, TIMEOUT_VIDEO_MS para video): se
 *          dice una vez que esta tardando y se SIGUE esperando la misma tarea.
 *   TOPE   (TOPE_ESPERA_*): recien ahi se deja de esperar, con un error que
 *          dice que la tarea sigue en kie (err.sigueEnKie). Su taskId queda
 *          anotada junto al archivo (<archivo>.kie-pendiente.json) y la proxima
 *          corrida la retoma en vez de crear otra.
 *
 * Solo se vuelve a pedir cuando kie dice que la tarea fallo (los fallos no
 * cobran). Las variables KIE_AVISO_* y KIE_TOPE_* son para las pruebas con el
 * kie simulado; en el .env no van.
 */
export const TIMEOUT_VIDEO_MS = Number(process.env.KIE_AVISO_ESPERA_VIDEO_MS) || 15 * 60 * 1000; // AVISO de video, no corta
export const TOPE_ESPERA_IMAGEN_MS = Number(process.env.KIE_TOPE_ESPERA_IMAGEN_MS) || 30 * 60 * 1000;
export const TOPE_ESPERA_VIDEO_MS = Number(process.env.KIE_TOPE_ESPERA_VIDEO_MS) || 45 * 60 * 1000;

/**
 * Pedidos nuevos (createTask) por ventana deslizante, para TODO el proceso.
 * kie.ai admite 20 cada 10 s; se usa 18 de margen (lo que mide kie es la
 * llegada, y dos pedidos pueden llegar mas juntos de lo que salieron). Un 429
 * igual se espera y se reintenta (ver kie-client.js): un 429 no crea tarea.
 */
export const LIMITE_CREACIONES = { maximo: Number(process.env.KIE_LIMITE_CREACIONES) || 18, ventanaMs: 10000 };

export const POLLING = {
  intervaloInicialMs: 3000,
  // 5 s como maximo (hasta el 2026-10-24 eran 15): una tarea que termina se
  // nota enseguida y entra la siguiente del pool.
  intervaloMaximoMs: 5000,
  factor: 1.4,
  // AVISO de imagen (no corta: ver TOPE_ESPERA_IMAGEN_MS). Quien llama a
  // esperarTarea sin topeMs lo sigue teniendo como tope, como antes.
  timeoutMs: Number(process.env.KIE_AVISO_ESPERA_IMAGEN_MS) || 6 * 60 * 1000,
};

export const REINTENTOS_POR_MODELO = 3;

/**
 * Recorte de silencios en los bordes, para modo_audio: dialogo_nativo.
 *
 * En este modo el clip es el amo: el personaje habla dentro del clip y no hay
 * pista de narracion externa. Pero los clips llegan con aire muerto en los
 * bordes y, concatenados tal cual, el anuncio arrastra silencio entre escenas.
 *
 * Solo se recortan los BORDES EXTERIORES. Nunca por dentro del dialogo: ahi
 * esta el lip-sync y cualquier corte lo rompe.
 *
 * VALORES MEDIDOS sobre un clip real de google/gemini-omni-flash-1-1
 * (8s, 720p, 9:16, first_frame_url + last_frame_url, 2026-09-03,
 *  ver temp/prueba-ugc-dialogo/):
 *
 *   aire muerto al inicio  1.07 s
 *   aire muerto al final   1.87 s
 *   dialogo util           5.06 s de 8   (37% del clip era silencio)
 *
 * OJO CON EL UMBRAL. No lo "ajustes a un valor mas razonable":
 *
 *   -30 dB  corte limpio, un solo tramo de silencio en cada borde.  <-- este
 *   -35 dB  parte la cola en tres pedazos y NO detecta la cabeza.
 *   -38 dB  no detecta nada.
 *   -40 dB  no detecta nada.
 *
 * El piso de ambiente del modelo ronda los -45 dB, pero trae transitorios que
 * se cuelan por encima de -38. Un umbral "conservador" de -40 dB parece mas
 * seguro y en la practica desactiva el recorte entero sin avisar.
 *
 * El margen existe porque la boca empieza a articular ~0.2 s ANTES de que entre
 * el audio. Con menos de 250 ms el clip abre con la boca ya en movimiento.
 *
 * CUIDADO AL IMPLEMENTAR: silencedetect devuelve TODOS los tramos de silencio,
 * tambien los de adentro. Un segundo clip de prueba (clip-enie.mp4, misma linea)
 * trajo una PAUSA INTERIOR de 1.31 s en mitad del dialogo:
 *
 *   0.00 - 1.28   silencio de cabeza    <- se recorta
 *   1.28 - 3.50   habla
 *   3.50 - 4.82   PAUSA INTERIOR        <- NO se toca, ahi vive el lip-sync
 *   4.82 - 6.83   habla
 *   6.83 - 8.00   silencio de cola      <- se recorta
 *
 * Solo se recortan el PRIMER y el ULTIMO tramo, y solo si tocan el borde
 * (empiezan en 0 / terminan en la duracion del clip). Un recorte que se lleve
 * todos los tramos detectados destroza el clip.
 */
export const RECORTE_BORDES = {
  umbralDb: -30,
  duracionMinimaS: 0.3, // d= de silencedetect: cuanto silencio seguido cuenta
  margenMs: 250,
  medidoCon: 'google/gemini-omni-flash-1-1',
  medidoEl: '2026-09-03',
};

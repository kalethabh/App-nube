// ANUNCIOS DE IMAGEN — lo que comparten el motor (generar-imagen-ads.js) y el
// servidor (app/server/lib/imagen-ads/*): textos del prompt, zona del logo,
// geometria del logo, nombres de las piezas y la huella de cada pedido.
//
// PURO: no habla con nadie ni importa config.js ni kie-client.js (el servidor
// lo importa sin cargar el motor). Solo lee archivos en huellaPieza y
// firmaDeArchivo.
//
// Los prompts son un port LETRA POR LETRA de los .py de la skill
// (.claude/skills/anuncios-imagen-ads/scripts/):
//   construirPrompt          generar_lote.py, construir_prompt (:57-92)
//   construirPromptVertical  extender_vertical.py, construir_prompt (:90-131)
//   textoExacto              kie_cliente.py, texto_exacto (:175-182)
// Sin logo y sin app_nota_vertical dan EXACTAMENTE el mismo texto que Python
// (mismas secciones, mismo orden, "\n\n" entre ellas, mismas constantes). Lo
// que agrega la app (la zona del logo, la nota del vertical y la edicion) va
// aparte y solo cuando se pide. Python se imita tambien en lo chico: un campo
// que falta da el valor por defecto ("text"), pero uno que esta en null se
// escribe "None"; "vacio" es lo que Python llama falso ('' , [], {}, 0, None).

import crypto from 'node:crypto';
import fs from 'node:fs';

// ---------------------------------------------------------------- constantes

/** GPT Image 2.5 Sunburst a 2K, fijo en esta seccion (sin cascada ni Ajustes > Modelos). */
export const MODELO = 'gpt-image-2-5-sunburst';
export const RESOLUCION = '2K';
/** 'opaco' -> background: "opaque" (adaptador de config.js). Si kie no lo aceptara: null (una linea). */
export const FONDO = 'opaco';
/** kie admite 20000; 10 de margen, como kie_cliente.py (LIMITE_PROMPT - 10). */
export const TOPE_PROMPT = 19990;

/** Las 6 posiciones del logo (lo que guarda el brief) y como se dicen en el prompt. */
export const POSICIONES = {
  'arriba-izquierda': 'top left',
  'arriba-centro': 'top center',
  'arriba-derecha': 'top right',
  'abajo-izquierda': 'bottom left',
  'abajo-centro': 'bottom center',
  'abajo-derecha': 'bottom right',
};
export const POSICION_POR_DEFECTO = 'arriba-centro';

/** Una pieza: V01_1x1, V100_9x16. */
export const RE_PIEZA = /^V\d{2,3}_(1x1|9x16)$/;
export const piezaId = (v, formato) => `${v}_${formato === '1:1' ? '1x1' : '9x16'}`;
/** Para ordenar por numero (V100 va despues de V99), nunca como texto. */
export const numeroDeV = (v) => Number(String(v).slice(1));
/** 'V03_9x16' -> 'V03'. */
export const vDePieza = (pieza) => String(pieza).split('_')[0];
/** 'V03_9x16' -> '9:16'; 'V03_1x1' -> '1:1'. */
export const formatoDePieza = (pieza) => (String(pieza).endsWith('_9x16') ? '9:16' : '1:1');

// Copiadas letra por letra de extender_vertical.py.
// Zona segura: Instagram y TikTok tapan arriba y abajo con su interfaz.
export const ZONA_SEGURA =
  'Keep the top 15% and the bottom 15% of the vertical canvas free of important text ' +
  'and free of the product label, because Instagram, Facebook and TikTok cover those ' +
  'areas with their own interface. All headlines, texts and the product label must stay ' +
  'inside the central safe zone and remain perfectly legible.';

export const CAMBIO_DIMENSION =
  'The ONLY change is the dimension: convert it to a vertical 9:16 portrait layout for ' +
  'Instagram Stories, Reels and TikTok. Re-arrange the same elements so they fit ' +
  'naturally and look premium in the tall format: let the headline breathe at the top, ' +
  'give the person and the product more vertical room in the center, and spread the ' +
  'remaining blocks down the canvas instead of cramming them. Do not simply add empty ' +
  'bands, borders, blurred strips or solid color bars above and below the original ' +
  'square. Do not crop or cut off any element. Keep generous negative space and a clear ' +
  'visual hierarchy.';

// El modelo tiende a poner fondo blanco cuando recrea un lienzo de color plano.
export const FIDELIDAD_COLOR =
  'CRITICAL - colors must not change: the background keeps exactly the same color as in ' +
  'the first attached image, and every text, graphic element and highlight keeps exactly ' +
  'the color it already has there. Never turn a colored background into white or into a ' +
  'lighter tone. Never swap, invert or reassign colors between the background, the texts ' +
  'and the graphic elements. If the original background is a flat solid color, the ' +
  'vertical version must use that same flat solid color edge to edge.';

export const CIERRE =
  'Do not add, remove or rewrite any text, price, badge, seal, icon or visual block. ' +
  'Do not change the design, the palette, the typography, the person or the product.';

// De generar_lote.py (:87-91): la frase final del cuadrado.
export const FIDELIDAD_PRODUCTO =
  "The attached image is the user's real product. Reproduce it with total fidelity: " +
  'same shape, packaging, cap, label, label text, colors and proportions. ' +
  'Never redesign, replace or reinterpret it.';

// «Más de lo mismo» (2026-11-15): el modelo ve el anuncio de referencia y hace el mismo diseño para otro producto.
const COPIAR_REFERENCIA =
  'The FIRST attached image is a REFERENCE AD. Create a new ad that is the same design made for a different product: ' +
  'keep its exact layout, composition, block structure, visual hierarchy, spacing, background treatment and graphic style, ' +
  'and keep its exact typography (same font style, weight, casing, relative sizes, text effects and text placement). ' +
  'Change only three things: (1) the product: replace the product of the reference with the product of the SECOND attached image, ' +
  'in the same place, size and angle; (2) the texts: replace every text of the reference with the texts listed below, ' +
  'each one in the place and style of the equivalent text of the reference; (3) the colors, only where the brand palette below asks for it. ' +
  "Do not add or remove blocks. Do not copy the reference's brand name, logo, product or wording.";

// (2026-11-26a) «Vecinas» y «Conceptos nuevos»: el anuncio ganador va como referencia de ESTILO, no de composición.
const ESTILO_REFERENCIA =
  'The FIRST attached image is the winning ad of this brand: use the reference only for style, product and offer; do not copy its layout. ' +
  'Take from it only the visual quality, the feel of the brand, how the product looks and how the offer is presented. ' +
  'Build a completely different composition: the one described below.';

// MODO RÁPIDO («como pedirle a ChatGPT que me las varíe», 2026-11-16): la app arma cada V##.json sin la IA de texto.
// El modelo ve la referencia (primera imagen) y el producto (segunda); el titular va exacto y los demás textos los
// escribe el modelo, cortos y en español, con los beneficios del producto (app_rapido: 'copiar' | 'inspirar').
// Lo primero que hace el modelo con la referencia (2026-11-17, pedido del usuario: «debe detectar el ángulo, el hook;
// por ejemplo el VitalDrops es para glúteos; si hay antes y después debe verse el cambio notorio»): leer su ángulo, su
// gancho y su formato, y conservarlos. Va en los dos modos rápidos y al copiar una referencia.
const LEER_REFERENCIA =
  'FIRST, READ THE REFERENCE AD before designing anything: ' +
  '(a) its ANGLE: the exact body area, problem or desire it sells (for example glutes and curves, belly fat, swollen legs, cough and lungs, wrinkles, energy, sleep); ' +
  '(b) its HOOK: the idea that stops the scroll (a before/after, a big promise, a number or timeline, a question, a testimonial, a shocking fact, an us-vs-them comparison); ' +
  '(c) its FORMAT: what is shown and how (person, body close-up, split screen, product hero, chart, screenshot, collage). ' +
  'Your ad MUST sell the SAME angle with the SAME hook and format: if the reference is about glutes, yours is about glutes, shown the same way; ' +
  'never switch to another body area or another benefit.';
// El antes y después: que el cambio se vea de un vistazo, en la misma zona del cuerpo.
const ANTES_DESPUES =
  'IF THERE IS A BEFORE/AFTER (or a day-by-day progression): the change must be DRAMATIC and obvious at first glance, never subtle, ' +
  'and in the exact body area of the angle (for glutes: a flat, small butt BEFORE and a visibly rounder, fuller, lifted butt AFTER, same side or back view). ' +
  'Same person, same pose, same outfit, same camera angle, same framing and same lighting in both halves, so the ONLY difference is the result; ' +
  'the BEFORE looks worse (posture, lighting slightly duller) and the AFTER looks better and confident. Label them clearly (ANTES / DESPUÉS or the days). ' +
  'Keep it realistic and tasteful (fully clothed: leggings, jeans or a fitted dress), never explicit.';
// Lo que hacen los ganadores (referencia interna: .claude/skills/anuncios-imagen-ads/referencias-ganadoras.md).
const COMO_GANADORES =
  'Like winning ads: one single idea per image; the angle is understood before reading (the body area or the result fills most of the frame); ' +
  'the headline names the pain or the result in the customer\'s words (with a timeframe only if listed below); never a price or discount in the headline of a pain or result image (an offer goes only in a small bottom strip). ';
const RAPIDO_COPIAR =
  'The FIRST attached image is a REFERENCE AD that already works. Make a variation of it for a different product, the way a designer would. ' +
  LEER_REFERENCIA +
  ' ' + COMO_GANADORES +
  'Keep its layout, composition, block structure, visual hierarchy, spacing, background treatment, graphic style and typography ' +
  '(same font style, weight, casing, relative sizes, text effects and text placement). ' +
  'Replace the product of the reference with the product of the SECOND attached image, in the same place, size and angle. ' +
  'MAIN HEADLINE: use the one listed below if it says the same thing as the hook of the reference (same angle); if it does not, write instead the hook of the reference rewritten for this product, in short Spanish, same idea and same structure (for example the same number, timeline or question). Put it in the place and style of the main headline of the reference. ' +
  'Rewrite every other text of the reference (subtitles, bullets, badges, buttons) in short, natural Spanish for this product, keeping the same angle and using only the benefits listed below, with perfect spelling and accents. ' +
  "Never keep the reference's brand, logo, product, prices, claims or wording. " +
  ANTES_DESPUES;
// MODO REPLICAR VALIDADO (2026-11-21, pedido del usuario): la referencia es un anuncio que YA ESTÁ VALIDADO y se replica
// EXACTO. Su mapa (zonas, jerarquía, tipografía y paleta, ángulo) lo sacó antes la IA (imagen-ads/replicar.js) y va en
// «WHAT TO MAKE». Lo ÚNICO que cambia: la modelo, el escenario de la foto, la pose y el encuadre, y la redacción del
// titular (misma promesa, otras palabras). Prohibido mover bloques, cambiar fuentes o paleta, cambiar el ángulo o
// inventar claims.
const RAPIDO_REPLICAR =
  'MODE: REPLICATE A VALIDATED AD. The FIRST attached image is a VALIDATED, WINNING AD. Reproduce it EXACTLY, as a pixel-faithful layout clone: ' +
  'every block stays in the same position, the same size and the same alignment (headline, model or before/after, product bottle, benefit bullets or checks, offer block and call to action); ' +
  'the same reading hierarchy (what is read first, second and third does not change); the same fonts (style, weight, casing, size and effects), the same colors and the same background of every text block (ribbon, badge, box). ' +
  'The sales angle is IDENTICAL: same central desire, same main benefit, same pain. ' +
  'ONLY these things change, and they MUST change: (1) the MODEL is a different woman (the age, body type and skin tone given below), believable and ordinary, never a fashion model; ' +
  '(2) the SETTING/background of the photo (the one given below); (3) her POSE and the FRAMING (given below); (4) the WORDING of the main headline (given below: same promise, other words, about the same length, so it fits the same zone). ' +
  'FORBIDDEN: moving, adding or removing blocks; changing fonts; changing the palette; changing the angle; inventing new claims, numbers or testimonials; changing the offer or the call to action. ' +
  'Replace the product bottle of the reference with the product of the SECOND attached image, in the same place, size and angle. ' +
  'Every other text keeps exactly the text given below, in its same zone and style, perfectly spelled. ' +
  'GLOBAL RULES: the brand name and the label of the bottle EXACT, letter by letter, as in the product photo; no text closer than 5% to any edge; legible on a phone at half screen. ' +
  ANTES_DESPUES;
// MODO NUEVO DESDE 0 (2026-11-21): las 6 zonas y las reglas globales; el formato y los textos van en el V##.json
// (imagen-ads/desde0.js). Sin referencia: solo la foto del producto.
const DESDE0 =
  'MODE: NEW AD FROM ZERO, built with SIX ZONES (the visual order may change with the format, but all six exist): ' +
  'Z1 HOOK: the headline in the top 15-20% of the image, very bold, ALL CAPS, max 8 words. ' +
  'Z2 MAIN VISUAL: 45-55% of the image (the model, the before/after or the product, as the format says); the emotion lives here. ' +
  'Z3 BENEFITS: 2 or 3 bullets with a check icon, max 5 words each, never more than 3. ' +
  'Z4 PRODUCT: the bottle, faithful to the real label of the attached photo (brand name and label EXACT, letter by letter), never smaller than 15% of the image, with its differentiating seal. ' +
  'Z5 OFFER: a highlighted badge or ribbon, not exaggerated, with the offer text and "Pagas al recibir". ' +
  'Z6 CTA: one single short chip. ' +
  'GLOBAL RULES: simple Colombian Spanish, little text, legible on a phone at half screen; no text closer than 5% to any edge; soft claims only; never medical promises, invented numbers or guarantees; a clean, uncluttered, premium direct-response look. ';
const RAPIDO_INSPIRAR =
  'The FIRST attached image is a WINNING AD, used as inspiration. Create a NEW ad for the product of the SECOND attached image. ' +
  LEER_REFERENCIA +
  ' ' + COMO_GANADORES +
  'Use the same kind of format (type of layout, visual hierarchy, amount of text, photographic or graphic style), but with a fresh composition of its own. ' +
  'MAIN HEADLINE (the biggest text): use the one listed below if it fits that same angle; if it does not, write a new one in short Spanish with the same hook idea as the reference, for this product. ' +
  'Any other text (one short subtitle, two or three benefit bullets, a button) is written by you in short, natural Spanish for this product, keeping the same angle and using only the benefits listed below, with perfect spelling and accents. ' +
  "Never copy the reference's brand, logo, product, prices, claims or wording. " +
  ANTES_DESPUES;

// PLANTILLA (2026-11-18t, app_rapido 'plantilla'): la referencia pone la FORMA y el producto el ÁNGULO. «Si la
// plantilla es un antes y después de hinchazón en las piernas y el producto es para caderas, glúteos y piernas, debe
// verse así como lo plasma la plantilla; lo mismo con día 1, día 14, día 30; si sale una persona, debe verse el ángulo.»
// Cada imagen trae además su concepto de Andromeda (a quién le habla, qué problema muestra y en qué momento).
const RAPIDO_PLANTILLA =
  'The FIRST attached image is a TEMPLATE: a winning ad of ANOTHER brand, often about ANOTHER body area or problem. Use it for its FORM, never for its topic. ' +
  'STEP 1, read the template: (a) its VISUAL MECHANISM: a before/after split, a day-by-day or week-by-week progression (count the panels and read their labels), ' +
  'one person whose body or face shows a result, a comparison of two states, a labeled body diagram or illustration, a product hero with benefit icons, a native social post or screenshot; ' +
  '(b) its BLOCKS: where the headline, the person or body, the product, the labels, the icons, the badges and the small texts are, and how big each one is; ' +
  '(c) its LOOK: typography style (weight, casing, effects), backgrounds, graphic elements, photo or illustration style. ' +
  'STEP 2, transpose it to THIS product: keep the same mechanism, the same number of panels, the same framing, positions, sizes, hierarchy and look, ' +
  'but SHOW THIS PRODUCT\'S ANGLE described below: change the body area, the problem, the result and the person to the ones of this product. ' +
  'Examples: a template with a before/after of swollen legs, for a product that gives fuller glutes, hips and legs, becomes a before/after of the SAME woman with a flat, small butt, narrow hips and thin legs BEFORE ' +
  'and a rounder, fuller, lifted butt, wider hips and toned legs AFTER, in the same split, the same pose type and with the same kind of labels; ' +
  'a template «Day 1 / Day 14 / Day 30» becomes the same panels showing the progressive change of THIS product\'s body area, one step more in each panel; ' +
  'a template with one single person becomes one person whose body, pose or expression shows THIS product\'s result, so the angle is understood before reading a word; ' +
  'a diagram of one organ becomes a diagram of this product\'s area; a comparison keeps its two sides with this product\'s two states. ' +
  'The person is a real Latin-American customer that matches the CONCEPT below (age, look, situation and place): with Meta Andromeda the creative IS the targeting, ' +
  'so the image must show clearly WHO it is for, WHAT problem or desire and WHEN (the moment). ' +
  'Replace the product of the template with the product of the SECOND attached image. ' +
  'TEXTS: the MAIN HEADLINE goes in the place and style of the template\'s main headline and follows the template\'s HEADLINE STRUCTURE given below, attacking directly the main desire or benefit of this product and connected to what the image shows. Rewrite every other text of the template (labels, subtitles, bullets, badges, buttons) ' +
  'for this product in short, natural Spanish, in the customer\'s words: concrete, at most 6 words per label, each one about this product\'s angle and benefits, perfect spelling and accents. ' +
  'Panel labels (ANTES / DESPUÉS, days or weeks) only with the timeframes allowed below. ' +
  "Never keep the template's brand, logo, product, claims, prices, discounts or wording; where it has an offer badge, put a short benefit instead. " +
  ANTES_DESPUES;

// De extender_vertical.py (:110-112): con la foto del producto como segunda imagen.
const PRODUCTO_SEGUNDA =
  'The SECOND attached image is the real product: keep the product and its label ' +
  'identical to it, with the same shape, cap, label text, colors and proportions. ' +
  'Do not redesign or reinterpret it.';

const RECREAR =
  'Recreate this exact advertisement (the FIRST attached image) without changing ' +
  'anything in its design. Keep absolutely everything the same: the same texts word ' +
  'for word with exactly the same spelling and accents, the same typography, the ' +
  'same colors, the same photographic style and lighting, the same person (same ' +
  'face, hair, clothes, pose and expression), the same background and the same ' +
  'product';

const SIN_TEXTO = 'The image must contain NO text at all.';
const TITULO_TEXTOS_CUADRADO = 'EXACT VISIBLE TEXT (render exactly, no spelling changes):';
const TITULO_TEXTOS_VERTICAL = 'Exact visible texts (each appears exactly once, correctly spelled, nothing else added):';

// Lo que agrega la app cuando el lote lleva logo (nunca lo dibuja el modelo).
export const SIN_LOGO_DIBUJADO = 'Do not draw any logo, brand mark, monogram or watermark anywhere.';

// ---------------------------------------------------------------- Python en JS

// Los espacios que quita str.strip() de Python (str.isspace), que no son los mismos que quita trim() de JS.
const ESPACIO_PY = '\\t\\n\\x0b\\x0c\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const RE_BORDES_PY = new RegExp(`^[${ESPACIO_PY}]+|[${ESPACIO_PY}]+$`, 'g');
const stripPy = (s) => s.replace(RE_BORDES_PY, '');

/** Lo que Python llama falso: None, False, 0, '', [] y {}. */
function vacioPy(x) {
  if (x === null || x === undefined || x === false || x === 0 || x === '') return true;
  if (Array.isArray(x)) return x.length === 0;
  if (typeof x === 'object') return Object.keys(x).length === 0;
  return false;
}

/** repr() de Python para lo que puede traer un JSON (solo se usa dentro de listas y objetos). */
function reprPy(x) {
  if (typeof x === 'string') {
    const comilla = x.includes("'") && !x.includes('"') ? '"' : "'";
    const cuerpo = x
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .split(comilla)
      .join(`\\${comilla}`);
    return `${comilla}${cuerpo}${comilla}`;
  }
  if (Array.isArray(x)) return `[${x.map(reprPy).join(', ')}]`;
  if (x && typeof x === 'object') return `{${Object.entries(x).map(([k, v]) => `${reprPy(k)}: ${reprPy(v)}`).join(', ')}}`;
  return strPy(x);
}

/** str() de Python (lo que escribe un f-string). */
function strPy(x) {
  if (x === null || x === undefined) return 'None';
  if (x === true) return 'True';
  if (x === false) return 'False';
  if (typeof x === 'string') return x;
  if (typeof x === 'number') return String(x);
  return reprPy(x);
}

/** list(x) de Python para lo que puede traer un JSON. */
function listaPy(x) {
  if (Array.isArray(x)) return [...x];
  if (typeof x === 'string') return [...x];
  if (x && typeof x === 'object') return Object.keys(x);
  return [];
}

/** dict.get(clave, porDefecto): el valor por defecto solo si FALTA la clave (un null se queda null). */
const getPy = (obj, clave, porDefecto) => (obj && typeof obj === 'object' && clave in obj ? obj[clave] : porDefecto);

/** `x or {}` / `x or []` de Python. */
const oPy = (x, porDefecto) => (vacioPy(x) ? porDefecto : x);

// ---------------------------------------------------------------- textos

/**
 * Un texto con saltos de linea, escrito sin separadores que el modelo pueda
 * dibujar. Port literal de kie_cliente.py:175-182 (texto_exacto).
 */
export function textoExacto(t) {
  const texto = strPy(t);
  const lineas = texto.split('\n').filter((l) => stripPy(l));
  if (lineas.length <= 1) return `"${stripPy(texto)}"`;
  return `${lineas.length} stacked lines: ` + lineas.map((l, i) => `line ${i + 1}: "${l}"`).join('; ');
}

/** "arriba-centro" (o { posicion }) -> "arriba-centro"; null si no hay logo. */
function posicionDe(logo) {
  if (!logo) return null;
  const p = typeof logo === 'string' ? logo : logo.posicion;
  if (!p) return null;
  return POSICIONES[p] ? p : POSICION_POR_DEFECTO;
}

/**
 * El bloque que reserva la zona del logo real (la app lo pega despues, ya
 * generada la imagen). 1:1: al 4-5 % de los bordes. 9:16: dentro de la zona
 * segura, justo debajo del 15 % de arriba (o encima del 15 % de abajo).
 */
export function bloqueLogo(formato, posicion) {
  const pos = POSICIONES[posicion] ? posicion : POSICION_POR_DEFECTO;
  const donde = POSICIONES[pos];
  if (formato !== '9:16') {
    return (
      `RESERVED LOGO AREA: keep a clean, empty area at the ${donde} of the canvas, about 20% of the canvas width and 15% of its height, ` +
      '4-5% from the edges, showing only the background. Draw no logo, text, icon, person or product there, and keep every button, ' +
      'badge and text block a little away from it (nothing touches it): the real brand logo is placed there after generation.'
    );
  }
  const inicio =
    'RESERVED LOGO AREA: the first attached image has an intentionally empty area reserved for the brand logo. ' +
    `In the vertical canvas keep an equivalent clean, empty area at the ${donde}, `;
  if (pos.startsWith('abajo')) {
    return inicio + 'immediately above the bottom 15% safe band (from about 77% to 85% of the height), about 20% of the width, showing only the background. ' +
      'Draw no logo there, and keep every button, badge and text block a little away from it (nothing touches it).';
  }
  return (
    inicio +
    'immediately below the top 15% safe band (from about 15% to 23% of the height), about 20% of the width, showing only the background. ' +
    'Draw no logo there, and keep every button, badge and text block a little away from it (nothing touches it). Place the headline below this empty area.'
  );
}

/** La lista de textos del vertical (y de la edicion): "- funcion: texto". */
function bloqueTextosVertical(ad) {
  const capas = oPy(getPy(oPy(ad, {}), 'text_layers', undefined), []);
  if (vacioPy(capas)) return ad !== null && ad !== undefined ? SIN_TEXTO : null;
  const lineas = [TITULO_TEXTOS_VERTICAL];
  for (const t of listaPy(capas)) {
    const funcion = getPy(t, 'reference_function', 'text');
    lineas.push(`- ${strPy(funcion)}: ${textoExacto(t?.text)}`);
  }
  return lineas.join('\n');
}

/** Lo mas largo que se acepta de la correccion que escribe la revision (ingles). */
export const TOPE_CORRECCION = 600;

/**
 * Otra version de una imagen que la revision marco (la pide el usuario con
 * «Corregir esto»; desde 2026-11-09 nada se rehace solo) lleva lo que salio
 * mal: la correccion corta en ingles que escribio la revision (correccion_en).
 * Vacio si no hay. No es un texto para mostrar en la imagen.
 */
export function bloqueCorreccion(correccion) {
  const t = String(correccion ?? '').replace(/\s+/g, ' ').trim().slice(0, TOPE_CORRECCION);
  if (!t) return '';
  return (
    'FIX FROM THE REVIEW OF A PREVIOUS ATTEMPT: a previous image of this same ad was rejected. ' +
    `Avoid this problem and keep everything else exactly as specified above: ${t} ` +
    '(This note is an instruction for you: only the texts listed above may appear in the image.)'
  );
}

// PLANTILLAS (2026-11-17p): la app dibuja todos los textos encima (remotion/src/plantillas-imagen/); el modelo solo
// hace la escena, SIN NINGÚN texto, y deja limpias las zonas donde van los textos de la plantilla.
export const ESCENA_SIN_TEXTO =
  'ABSOLUTELY NO TEXT IN THE IMAGE: no text, no letters, no words, no numbers, no captions, no labels, no logos, no watermarks, ' +
  'no signs, no stickers, no arrows, no user interface and no frames. The app adds every text and graphic later, so leave the ' +
  "areas described above clean. The only exception is the printed label of the real product if the product appears: reproduce it exactly as in the attached photo. " +
  'Photorealistic (or clean illustration when asked), high quality, sharp, well lit, natural colors.';

/** El prompt de la escena de una plantilla (V##.json con app_plantilla.escena): la descripción + sin texto + el producto. */
export function construirPromptEscena(ad, { correccion = null, referencia = false } = {}) {
  const partes = [`SCENE FOR AN AD TEMPLATE:\n${strPy(ad.visual_prompt)}`, ESCENA_SIN_TEXTO];
  const fix = bloqueCorreccion(correccion);
  if (fix) partes.push(fix);
  partes.push(
    referencia
      ? 'The SECOND attached image is the real product: if it appears, keep it identical (same shape, packaging, cap, label, colors and proportions).'
      : 'The attached image is the real product. Only if the scene shows the product, reproduce it with total fidelity (same shape, packaging, cap, label, colors and proportions); otherwise, do not show it.'
  );
  return partes.join('\n\n');
}

/**
 * El prompt del cuadrado 1:1 (generar_lote.py:57-92). Con `logo` (la posicion
 * o { posicion }): ademas, en STRICT EXCLUSIONS, que no dibuje ningun logo, y
 * antes de la frase de fidelidad del producto, la zona reservada. Con
 * `correccion` (la otra version que pidio el usuario), lo que salio mal, antes de la zona
 * del logo.
 */
export function construirPrompt(ad, { logo = null, correccion = null, referencia = false } = {}) {
  if (ad?.app_plantilla?.escena) return construirPromptEscena(ad, { correccion, referencia });
  const pos = posicionDe(logo);
  // «Más de lo mismo» (referencia: true): la PRIMERA imagen adjunta es el anuncio de referencia y la SEGUNDA, el producto
  const estilo = referencia === 'estilo';
  const rapido = referencia === true && ['copiar', 'inspirar', 'plantilla', 'replicar'].includes(ad?.app_rapido) ? ad.app_rapido : null;
  const desde0 = !rapido && ad?.app_desde0 ? DESDE0 : null;
  const partes = desde0
    ? [desde0, 'WHAT TO MAKE:\n' + strPy(ad.visual_prompt)]
    : rapido
    ? [{ copiar: RAPIDO_COPIAR, inspirar: RAPIDO_INSPIRAR, plantilla: RAPIDO_PLANTILLA, replicar: RAPIDO_REPLICAR }[rapido], 'WHAT TO MAKE:\n' + strPy(ad.visual_prompt)]
    : estilo
      ? [ESTILO_REFERENCIA, 'WHAT TO MAKE:\n' + strPy(ad.visual_prompt)]
    : referencia
      ? [COPIAR_REFERENCIA, LEER_REFERENCIA, ANTES_DESPUES, 'SCENE DESCRIPTION (same composition as the reference):\n' + strPy(ad.visual_prompt)]
      : [strPy(ad.visual_prompt)];

  const capas = oPy(getPy(ad, 'text_layers', undefined), []);
  if (!vacioPy(capas)) {
    // (rápido: solo el titular va exacto; el resto lo escribe el modelo)
    const lineas = [
      desde0
        ? 'TEXTS (render each one EXACTLY as written, no spelling changes, in its zone and style):'
        : rapido === 'replicar'
        ? 'TEXTS (render each one EXACTLY as written, no spelling changes, in its zone and with the same style as in the reference):'
        : rapido === 'plantilla'
        ? 'MAIN HEADLINE (write it with the HEADLINE STRUCTURE given above, about this product\'s main desire or benefit; the text below is the idea: render it exactly when it already fits that structure; the other texts are yours, all perfectly spelled):'
        : rapido
          ? 'MAIN HEADLINE (if it fits the angle and hook of the reference, render it exactly, no spelling changes; if not, follow the rule above; the other texts are yours):'
          : TITULO_TEXTOS_CUADRADO,
    ];
    for (const t of listaPy(capas)) {
      lineas.push(
        `- ${strPy(getPy(t, 'reference_function', 'text'))} ` +
          `(${strPy(getPy(t, 'reference_position', ''))}): ${textoExacto(t?.text)} — ${strPy(getPy(t, 'text_style', ''))}`
      );
    }
    partes.push(lineas.join('\n'));
  } else {
    partes.push(SIN_TEXTO);
  }

  const identidad = oPy(getPy(ad, 'global_identity', undefined), {});
  // (con referencia, la tipografía es la de la referencia: no se manda otra)
  const lineasId = (referencia === true ? ['color_palette'] : ['color_palette', 'text_typography']).filter((k) => !vacioPy(getPy(identidad, k, undefined))).map((k) => `${k}: ${strPy(identidad[k])}`);
  if (lineasId.length) partes.push('BRAND IDENTITY:\n- ' + lineasId.join('\n- '));

  const obligatorios = getPy(ad, 'mandatory_visual_elements', undefined);
  if (!vacioPy(obligatorios)) partes.push('MANDATORY ELEMENTS:\n- ' + listaPy(obligatorios).map(strPy).join('\n- '));

  const exclusiones = listaPy(oPy(getPy(ad, 'final_generation_exclusions', undefined), []));
  const prohibidos = listaPy(oPy(getPy(oPy(getPy(ad, 'reference_structure_analysis', undefined), {}), 'forbidden_additions', undefined), []));
  // Como el list comprehension de Python: "p not in exclusiones" mira la lista de ANTES de sumar.
  const agregados = prohibidos.filter((p) => !exclusiones.includes(p)).map((p) => `Do not add: ${strPy(p)}`);
  const todas = [...exclusiones, ...agregados];
  if (pos) todas.push(SIN_LOGO_DIBUJADO);
  if (todas.length) partes.push('STRICT EXCLUSIONS:\n- ' + todas.map(strPy).join('\n- '));

  const fix = bloqueCorreccion(correccion);
  if (fix) partes.push(fix);
  if (pos) partes.push(bloqueLogo('1:1', pos));
  partes.push(referencia ? PRODUCTO_SEGUNDA : FIDELIDAD_PRODUCTO);
  return partes.join('\n\n');
}

/** "Que debe quedar igual" a partir del V##.json (extender_vertical.py:72-87). */
function resumenIdentidad(ad) {
  const partes = [];
  const gi = oPy(getPy(ad, 'global_identity', undefined), {});
  if (!vacioPy(getPy(gi, 'color_palette', undefined))) partes.push(`the same colors (${strPy(gi.color_palette)})`);
  if (!vacioPy(getPy(gi, 'text_typography', undefined))) partes.push(`the same typography (${strPy(gi.text_typography)})`);
  if (!vacioPy(getPy(gi, 'visual_style', undefined))) partes.push(`the same visual style (${strPy(gi.visual_style)})`);
  const elementos = oPy(getPy(ad, 'mandatory_visual_elements', undefined), []);
  if (!vacioPy(elementos)) partes.push('the same visual blocks: ' + listaPy(elementos).map(strPy).join('; '));
  return partes.join(', ');
}

/**
 * El prompt de recreacion cuadrado -> vertical (extender_vertical.py:90-131).
 * La app lo usa siempre con conProducto: true, como generar_lote.py:125.
 * Agrega, antes de CIERRE y solo si vienen: la nota del vertical del V##.json
 * (app_nota_vertical, la escribe la sesion de ajuste), lo que salio mal en un
 * intento anterior (`correccion`, la otra version que pidio el usuario) y la zona del logo.
 */
export function construirPromptVertical(ad, { conProducto = true, logo = null, correccion = null } = {}) {
  const pos = posicionDe(logo);
  let p1 = RECREAR;
  if (!vacioPy(ad)) {
    const resumen = resumenIdentidad(ad);
    if (resumen) p1 += '. Specifically preserve: ' + resumen;
  }
  p1 += '.';

  const bloques = [p1, FIDELIDAD_COLOR, CAMBIO_DIMENSION, ZONA_SEGURA];
  if (conProducto) bloques.push(PRODUCTO_SEGUNDA);

  const textos = bloqueTextosVertical(ad);
  if (textos) bloques.push(textos);

  const regla = getPy(oPy(ad, {}), 'language_rule', undefined);
  if (!vacioPy(regla)) bloques.push(strPy(regla));

  const nota = ad && typeof ad.app_nota_vertical === 'string' ? ad.app_nota_vertical.trim() : '';
  if (nota) bloques.push(`EXTRA LAYOUT NOTE FOR THE VERTICAL: ${nota}`);
  const fix = bloqueCorreccion(correccion);
  if (fix) bloques.push(fix);
  if (pos) bloques.push(bloqueLogo('9:16', pos));
  bloques.push(CIERRE);
  return bloques.join('\n\n');
}

/**
 * Regenerar con instruccion = EDITAR la imagen (imagen a imagen sobre la
 * imagen limpia actual, sin logo, mas la foto del producto). `instruccion` va
 * en ingles (instruccion_en de la sesion de ajuste). Con `textos`, la lista
 * exacta de textos del V##.json ya puesto al dia.
 */
export function construirPromptEdicion(ad, { instruccion, formato, textos = false, logo = null } = {}) {
  const pos = posicionDe(logo);
  const bloques = [
    `Edit this advertising image (the FIRST attached image) following this instruction: "${String(instruccion ?? '').trim()}". ` +
      'Keep everything else exactly as it is (layout, texts, colors, typography, person, product) unless the instruction says otherwise. ' +
      'The SECOND attached image is the real product photo: the product must stay identical to it. Do not add new elements.',
  ];
  if (textos) {
    const lista = bloqueTextosVertical(ad);
    if (lista) bloques.push(lista);
  }
  if (formato === '9:16') bloques.push(ZONA_SEGURA);
  if (pos) bloques.push(bloqueLogo(formato === '9:16' ? '9:16' : '1:1', pos));
  const regla = getPy(oPy(ad, {}), 'language_rule', undefined);
  if (!vacioPy(regla)) bloques.push(strPy(regla));
  return bloques.join('\n\n');
}

/**
 * Si el prompt armado pasa de TOPE_PROMPT, acorta SOLO el visual_prompt (en el
 * ultimo punto que entra) y lo vuelve a armar con `armar(adAcortado)`. Nunca
 * toca los textos ni el cierre (kie_cliente.py:137-138 cortaba el final, que
 * es donde estan los textos y la fidelidad del producto). Si el visual_prompt
 * no esta en ese prompt (el vertical y la edicion no lo llevan), lo deja igual.
 */
export function ajustarLargo(prompt, ad, armar) {
  let actual = String(prompt);
  if (actual.length <= TOPE_PROMPT || !ad || typeof armar !== 'function') return actual;
  let visual = strPy(ad.visual_prompt);
  for (let vuelta = 0; vuelta < 6 && actual.length > TOPE_PROMPT && visual.length; vuelta++) {
    const entra = visual.length - (actual.length - TOPE_PROMPT);
    if (entra <= 0) {
      visual = '';
    } else {
      const corte = visual.slice(0, entra);
      const punto = corte.lastIndexOf('.');
      visual = punto > 0 ? corte.slice(0, punto + 1) : corte.trimEnd();
    }
    const nuevo = String(armar({ ...ad, visual_prompt: visual }));
    if (nuevo.length >= actual.length) break; // el visual_prompt no esta en este prompt
    actual = nuevo;
  }
  return actual;
}

// ---------------------------------------------------------------- logo

/**
 * Donde y de que tamano va el logo real (una sola fuente para la zona del
 * prompt y para el pegado con ffmpeg). W y H: el lienzo; lw y lh: el logo.
 *   ancho round(0.12 W); alto como mucho 0.12 W (si el logo es alto, se achica)
 *   margen lateral round(0.045 W)
 *   1:1   arriba y = round(0.045 H); abajo y = H - round(0.045 H) - alto
 *   9:16  arriba y = round(0.155 H); abajo y = round(0.845 H) - alto (dentro de la zona segura)
 * Devuelve { x, y, ancho, alto } en pixeles enteros.
 */
export function geometriaLogo({ W, H, formato, posicion, lw, lh }) {
  const w0 = Number(W);
  const h0 = Number(H);
  const lw0 = Number(lw);
  const lh0 = Number(lh);
  if (!(w0 > 0 && h0 > 0 && lw0 > 0 && lh0 > 0)) throw new Error(`geometriaLogo: medidas que no sirven (W=${W}, H=${H}, logo ${lw}x${lh}).`);
  const pos = POSICIONES[posicion] ? posicion : POSICION_POR_DEFECTO;
  const vertical = formato === '9:16' || formato === '9x16';
  const caja = 0.12 * w0;
  let ancho = Math.round(caja);
  let alto = Math.round((ancho * lh0) / lw0);
  if (alto > caja) {
    alto = Math.round(caja);
    ancho = Math.round((alto * lw0) / lh0);
  }
  ancho = Math.max(1, ancho);
  alto = Math.max(1, alto);
  const m = Math.round(0.045 * w0);
  const lado = pos.split('-')[1];
  const x = lado === 'izquierda' ? m : lado === 'derecha' ? w0 - m - ancho : Math.round((w0 - ancho) / 2);
  const arriba = pos.startsWith('arriba');
  const y = vertical
    ? arriba
      ? Math.round(0.155 * h0)
      : Math.round(0.845 * h0) - alto
    : arriba
      ? Math.round(0.045 * h0)
      : h0 - Math.round(0.045 * h0) - alto;
  return { x, y, ancho, alto };
}

// ---------------------------------------------------------------- huella y firma

/** sha1 del CONTENIDO de un archivo, con cache por ruta, tamano y fecha. */
function sha1DeArchivo(ruta, cache) {
  const st = fs.statSync(ruta);
  const clave = `${ruta}|${st.size}|${st.mtimeMs}`;
  let h = cache.get(clave);
  if (!h) {
    h = crypto.createHash('sha1').update(fs.readFileSync(ruta)).digest('hex');
    cache.set(clave, h);
  }
  return h;
}

/**
 * La huella de un pedido (contrato con kie-client.js: con la misma huella,
 * generarImagen retoma la tarea anotada en <destino>.kie-pendiente.json en vez
 * de pedir y pagar otra). La formula de huellaDeImagen (generar-imagenes.js),
 * con el modelo, la resolucion y el fondo de esta seccion: sha1 de
 * { modelo, prompt, aspecto, resolucion, fondo, entradas } con el sha1 del
 * CONTENIDO de cada imagen de entrada, en orden (nunca las URLs, que cambian
 * en cada subida). null si falta algun archivo.
 */
export function huellaPieza({ prompt, aspecto, archivos }, cache = new Map()) {
  const lista = Array.isArray(archivos) ? archivos : [];
  if (!lista.every((a) => a && fs.existsSync(a))) return null;
  const entradas = lista.map((a) => sha1DeArchivo(a, cache));
  return crypto
    .createHash('sha1')
    .update(JSON.stringify({ modelo: MODELO, prompt, aspecto, resolucion: RESOLUCION, fondo: FONDO, entradas }))
    .digest('hex');
}

/** "tamano-fecha" de un archivo (la firma que mira la revision), o null si no esta. */
export function firmaDeArchivo(abs) {
  try {
    const st = fs.statSync(abs);
    return st.isFile() ? `${st.size}-${Math.round(st.mtimeMs)}` : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- mensajes de una pieza sin imagen

/** Lo que ve el usuario cuando una pieza queda sin imagen (por su `motivo` en T###.resultado.json). */
export const MENSAJES_SIN_IMAGEN = {
  contenido: 'kie no quiso hacer esta imagen por sus reglas de contenido',
  'fallo-de-kie': 'kie no pudo hacer esta imagen',
  'contenido-chatgpt': 'ChatGPT no quiso hacer esta imagen por sus reglas de contenido',
  'fallo-de-chatgpt': 'ChatGPT no pudo hacer esta imagen',
  'pedido-invalido': 'kie no pudo hacer esta imagen',
  'no-se-pudo-bajar': 'kie la hizo pero no se pudo bajar',
  'falta-cuadrado': 'No se pudo hacer la vertical porque falta su imagen cuadrada',
  'falta-imagen': 'No hay una imagen para cambiar: regenérala sin instrucciones',
};

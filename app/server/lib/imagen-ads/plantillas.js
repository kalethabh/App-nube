// Los lotes con PLANTILLAS (2026-11-17p, pedido: «que se vean limpias y llamativas como Grüns, y que no se tarde en
// generar»). La app dibuja los textos y los gráficos (titular, letra a mano, flechas, sticker, burbujas, tuit, íconos,
// barra de datos, franja de oferta, línea legal) con Remotion, en la computadora; el modelo de imagen solo hace la escena
// SIN texto, y solo en las plantillas que la necesitan. Las demás salen de la foto del producto: sin costo y en segundos.
//
//   prepararPlantillas(carpeta, brief)   escribe producto.json, estrategia.json, plan.json y cada V##.json
//                                        (app_plantilla: { id, escena, textos }) sin la IA de texto
//   componerPendientes(carpeta)          dibuja lo que falta o cambió (vista previa con la escena en camino, y otra vez
//                                        cuando llega la escena). Devuelve cuántas dibujó.
//   componerVariacion(carpeta, v)        dibuja ya los formatos de una variación (al editar un texto)
//   estadoComposicion(carpeta, pieza)    { existe, alDia, completa }
//   editarTextos(carpeta, v, textos)     guarda los textos de una variación y la vuelve a dibujar (1-2 s, sin costo)
//   otraVersion(carpeta, v)              otros textos para una plantilla que no usa escena (gratis)
//   kitDe(productoId) · guardarKit(productoId, kit) · kitAutomatico(foto)   el kit de marca del producto
//   piezaLocal(est, pieza)               ¿esta pieza la hace solo la app? (sin el modelo de imagen)
//
// Disco: final/<pieza>.png (lo que se ve y se descarga) y final/<pieza>.json { huella, completa, ms }. La escena de
// una variación es img/<V>_1x1.png (la hace el motor de siempre, con su huella y sin pagar dos veces): el vertical la
// reutiliza (un solo pedido pagado por variación, aunque el lote tenga los dos tamaños).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { RAIZ } from '../rutas.js';
import { leerJSON, existe } from '../archivos.js';
import { PRODUCTOS, idValido, rutaFoto, fotoPrincipal } from '../productos.js';
import { R, guardarJSON, idsDelLote, fotoDelLote, firma, piezaId, vDe, formatoDe } from './disco.js';
import { leerEstado } from './estado.js';
import { asignar, POR_ID } from './catalogo-plantillas.js';
import { contextoDelLote, textosPara, textosPorAngulo, limpiarTextos } from './textos-plantillas.js';
import { renderizar, composicionDe } from '../plantillas/render.js';
import { pixeles } from './local.js';

const ahora = () => new Date().toISOString();
const ANGULO_NOMBRE = { dolor: 'Dolor', 'antes-despues': 'Antes y después', mecanismo: 'Mecanismo', 'prueba-social': 'Prueba social', estatus: 'Estatus', objecion: 'Objeción', ingrediente: 'Ingrediente', producto: 'Producto' };
export const esLoteDePlantillas = (brief) => Boolean(brief?.plantillas);
export const plantillaDe = (carpeta, v) => leerJSON(R.v(carpeta, v))?.app_plantilla || null;

// ---------------------------------------------------------------- el código de las plantillas (para la huella)

const DIR_PLANTILLAS = path.join(RAIZ, 'remotion', 'src', 'plantillas-imagen');
let huellaCodigo = null;
function codigo() {
  if (huellaCodigo) return huellaCodigo;
  const h = crypto.createHash('sha1');
  const visitar = (dir) => {
    let lista = [];
    try {
      lista = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return;
    }
    for (const n of lista) {
      const abs = path.join(dir, n.name);
      if (n.isDirectory()) visitar(abs);
      else if (/\.(jsx?|mjs)$/.test(n.name)) h.update(n.name).update(fs.readFileSync(abs));
    }
  };
  visitar(DIR_PLANTILLAS);
  huellaCodigo = h.digest('hex').slice(0, 12);
  return huellaCodigo;
}

// ---------------------------------------------------------------- el kit de marca (por producto)

const KIT_POR_DEFECTO = { primario: '#1F6F4A', secundario: '#F2C14E', fuenteTitulo: 'Anton', fuenteScript: 'Caveat', sticker: 'estallido' };
export const FUENTES_TITULO = ['Anton', 'Bebas Neue', 'Archivo Black'];
export const FUENTES_MANO = ['Caveat', 'Permanent Marker'];
export const STICKERS = ['estallido', 'circulo', 'cinta'];
const rutaKit = (id) => path.join(PRODUCTOS, id, 'kit-marca.json');
const esHex = (x) => /^#[0-9a-f]{6}$/i.test(String(x || ''));

export function limpiarKit(k = {}) {
  return {
    primario: esHex(k.primario) ? k.primario.toUpperCase() : KIT_POR_DEFECTO.primario,
    secundario: esHex(k.secundario) ? k.secundario.toUpperCase() : KIT_POR_DEFECTO.secundario,
    fuenteTitulo: FUENTES_TITULO.includes(k.fuenteTitulo) ? k.fuenteTitulo : KIT_POR_DEFECTO.fuenteTitulo,
    fuenteScript: FUENTES_MANO.includes(k.fuenteScript) ? k.fuenteScript : KIT_POR_DEFECTO.fuenteScript,
    sticker: STICKERS.includes(k.sticker) ? k.sticker : KIT_POR_DEFECTO.sticker,
  };
}

const rgbAHsl = (r, g, b) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
const hslAHex = (h, s, l) => {
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return `#${[f(0), f(8), f(4)].map((x) => x.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
};

/**
 * Los 2 colores del kit sacados de la foto del producto: los dominantes que no son neutros (ni blanco, ni negro, ni
 * gris). El primero va de fondo (se oscurece si es muy claro, para que el texto blanco se lea); el segundo, de acento.
 */
export async function kitAutomatico(foto) {
  const px = foto ? await pixeles(foto, 48, 48) : null;
  if (!px) return { ...KIT_POR_DEFECTO, automatico: false };
  const bins = new Map(); // tono de a 20° -> { peso, h, s, l }
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    const [h, s, l] = rgbAHsl(px[i], px[i + 1], px[i + 2]);
    if (s < 0.28 || l < 0.14 || l > 0.86) continue;
    // la piel, la madera y el cartón (naranjas apagados) casi nunca son el color de la marca: pesan poco
    const piel = h >= 5 && h <= 45 && s < 0.7;
    const k = Math.floor(h / 20);
    const b = bins.get(k) || { peso: 0, h: 0, s: 0, l: 0 };
    const w = s * s * (piel ? 0.15 : 1);
    b.peso += w;
    b.h += h * w;
    b.s += s * w;
    b.l += l * w;
    bins.set(k, b);
  }
  const lista = [...bins.entries()].map(([k, b]) => ({ k, peso: b.peso, h: b.h / b.peso, s: b.s / b.peso, l: b.l / b.peso })).sort((a, b) => b.peso - a.peso);
  if (!lista.length || lista[0].peso < 3) return { ...KIT_POR_DEFECTO, automatico: true, neutro: true };
  const a = lista[0];
  const distancia = (x, y) => Math.min(Math.abs(x - y), 360 - Math.abs(x - y));
  const b = lista.find((x) => distancia(x.h, a.h) >= 40 && x.peso >= a.peso * 0.08);
  const primario = hslAHex(a.h, Math.min(0.85, Math.max(0.5, a.s)), Math.min(0.42, Math.max(0.3, a.l)));
  // sin un segundo color en la foto: un acento cálido que contraste con el primero
  // sin un segundo color en la foto: un amarillo cálido (el acento que mejor resalta sobre casi cualquier fondo); si el
  // fondo ya es amarillo o naranja, un azul profundo
  const secundario = b ? hslAHex(b.h, Math.min(0.9, Math.max(0.6, b.s)), Math.min(0.68, Math.max(0.52, b.l))) : a.h >= 25 && a.h <= 75 ? hslAHex(222, 0.55, 0.24) : hslAHex(46, 0.95, 0.62);
  return { ...KIT_POR_DEFECTO, primario, secundario, automatico: true };
}

/** El kit de marca de un producto: el guardado o, si no tiene, el automático de su foto (y se guarda). */
export async function kitDe(productoId) {
  if (!idValido(productoId)) return { ...KIT_POR_DEFECTO, automatico: false };
  const guardado = leerJSON(rutaKit(productoId));
  if (guardado && esHex(guardado.primario)) return { ...limpiarKit(guardado), automatico: Boolean(guardado.automatico) };
  const auto = await kitAutomatico(fotoPrincipal(productoId) || rutaFoto(productoId, 1));
  guardarJSON(rutaKit(productoId), { ...limpiarKit(auto), automatico: true, fecha: ahora() });
  return { ...limpiarKit(auto), automatico: true };
}

export function guardarKit(productoId, kit) {
  const k = limpiarKit(kit);
  guardarJSON(rutaKit(productoId), { ...k, automatico: false, fecha: ahora() });
  return k;
}

// ---------------------------------------------------------------- la foto del producto (con o sin fondo)

/** ¿La foto ya viene sin fondo? (PNG con las esquinas transparentes) */
async function sinFondo(abs) {
  if (!/\.png$/i.test(abs)) return false;
  const px = await pixeles(abs, 16, 16);
  if (!px) return false;
  const a = (x, y) => px[(y * 16 + x) * 4 + 3];
  return [a(0, 0), a(15, 0), a(0, 15), a(15, 15)].every((v) => v < 24);
}

/**
 * La foto del producto que usan las plantillas: la recortada (entrada/producto-recorte.png, si se pudo quitar el fondo
 * gratis en este computador), la original si ya viene sin fondo, o la original sobre una tarjeta limpia.
 */
async function productoDelLote(carpeta) {
  const recorte = path.join(carpeta, 'entrada', 'producto-recorte.png');
  if (existe(recorte)) return { archivo: recorte, recortado: true };
  const rel = fotoDelLote(carpeta);
  if (!rel) return null;
  const abs = path.join(carpeta, rel);
  const cache = path.join(carpeta, 'entrada', 'producto-info.json');
  const f = firma(abs);
  let info = leerJSON(cache);
  if (info?.firma !== f) {
    info = { firma: f, recortado: await sinFondo(abs) };
    guardarJSON(cache, info);
  }
  return { archivo: abs, recortado: Boolean(info.recortado) };
}

// ---------------------------------------------------------------- la escena (el prompt sin texto)

/** El neón de la silueta: el acento del kit (como lo dibuja la plantilla). */
const neonDe = (kit) => (/^#[0-9a-f]{6}$/i.test(kit?.secundario || '') ? kit.secundario : KIT_POR_DEFECTO.secundario);

/** Lo que el modelo de imagen tiene que hacer para la escena de esa plantilla (en inglés; el contexto en español). */
export function descripcionEscena(id, ctx, textos, kit = KIT_POR_DEFECTO) {
  const contexto =
    `Product context (Spanish, from the product sheet): product: «${ctx.nombre}»${ctx.queEs ? ` (${ctx.queEs})` : ''}; ` +
    `audience: «${ctx.publico || 'adults'}»; problem: «${ctx.dolor || ctx.dolores[0] || ''}»; result: «${ctx.beneficios.slice(0, 2).join('; ')}».`;
  const persona = 'Same person (same face, hair, body type and skin tone), same pose, same outfit, same camera angle, same framing and same lighting in every part, so the ONLY difference is the result in the body area of the problem.';
  const decente = 'Realistic and tasteful: fully clothed (leggings, jeans or a fitted dress), never explicit.';
  // como los ganadores (referencias-ganadoras.md): el ángulo se ve antes de leerse
  const ganador = 'Like the winning ads of this category: the body area of the problem fills 60-70% of the frame, tight clothing that shows the shape, an ordinary real setting with nothing distracting, no props, no text.';
  switch (id) {
    case 'antes-despues':
      return [
        'A single realistic smartphone photo split vertically into two equal halves side by side, with the split exactly in the center.',
        'LEFT half = BEFORE: the problem clearly visible in the body area. RIGHT half = AFTER: the result clearly visible in the same body area; the change must be dramatic and obvious at first glance, never subtle.',
        persona,
        'The BEFORE looks a bit worse (posture, slightly duller light); the AFTER looks better and confident.',
        'Shot like a real phone photo at home (plain wall or mirror, ordinary floor), front or side view, nothing staged.',
        ganador,
        decente,
        'Do NOT show the product in the photo (the app places the real product photo later).',
        'Keep the top 15% of both halves calm and plain (wall or background), and the bottom-right corner free.',
        contexto,
      ].join(' ');
    case 'linea-tiempo': {
      const n = (textos?.etapas || []).length || 3;
      return [
        `A single realistic photo divided into ${n} vertical panels of equal width, side by side, separated by thin straight gaps.`,
        'Clean plain light background (white or warm beige), side profile or back three-quarter view so the body area reads at a glance.',
        ganador,
        `Each panel shows the same person at a different moment (${(textos?.etapas || []).join(', ') || 'day 1, day 7, day 14'}), from left to right, with the result growing gradually panel by panel in the body area of the problem; the last panel shows the clearest result.`,
        persona,
        decente,
        'Do NOT show the product in the photo.',
        'Keep the top 18% and the bottom 14% of every panel calm and plain (the app adds the headline above and the labels below).',
        contexto,
      ].join(' ');
    }
    case 'mapa-cuerpo':
      return [
        'A clean, modern medical-style illustration on a plain white background: the same person shown twice, full body, front view, standing side by side and centered.',
        'The LEFT figure shows the problem in the body area; the RIGHT figure shows the result in the same body area, clearly visible.',
        'Both figures occupy only the central 50% of the width (from 25% to 75%); the left 25% and the right 25% margins and the top 12% must be completely empty plain white (the app adds labels and arrows there).',
        decente,
        'Do NOT show the product.',
        contexto,
      ].join(' ');
    case 'foto-tiktok':
      return [
        'A casual, authentic smartphone photo in UGC style (natural light, slightly imperfect framing) of a real person of the audience at home (bathroom mirror, bedroom or kitchen), happy and confident, holding the product of the attached photo naturally in one hand.',
        'The product must look exactly like the attached product photo (same shape, colors and label).',
        'Keep the upper 45% of the image visually calm (wall, mirror or background, no busy details): the app adds white caption boxes there. The person and the product in the lower part.',
        decente,
        contexto,
      ].join(' ');
    case 'foto-titular':
      return [
        'A clean, bright lifestyle photo (real, natural light, sharp) of a real person of the audience in a everyday moment related to the result of the product, confident and natural.',
        'The product of the attached photo may appear small and natural in the scene, exactly as in the photo.',
        'Keep the top 32% of the image calm and simple (sky, wall or soft background): the app puts a big headline there; keep the bottom-right corner free for the product card.',
        decente,
        contexto,
      ].join(' ');
    // ---- Ángulos ganadores (referencias-ganadoras.md): la escena muestra el ángulo; el texto lo pone la app
    case 'silueta-zonas':
      return [
        `A glowing neon line-art outline drawing of the full body of a person of the audience, standing, back three-quarter view, thin bright neon lines in the color ${neonDe(kit)} with a soft glow, on a PURE BLACK background, no fill, no facial details.`,
        'The outline emphasizes the body area of the result (the shape clearly defined and attractive), sneakers on, sporty fitted outfit drawn as lines.',
        'The figure is centered and occupies the central 45% of the width and 90% of the height; everything else is pure black #000000 (the app adds labels and lines on both sides).',
        'Elegant, minimal, premium. Not explicit. Do NOT show the product.',
        contexto,
      ].join(' ');
    case 'solo-vs-con':
      return [
        'A clean, modern medical-style illustration (soft painted, realistic proportions) on a warm cream background (#F7F1E6): the same body area of the problem shown twice side by side, split exactly in the vertical center.',
        `LEFT half = only «${textos?.sin || 'without help'}»: the problem clearly visible (for example swelling shown as translucent blue fluid, or the area looking worse). RIGHT half = the result in the same area, clean and clearly better.`,
        'Same framing, same scale and same lighting on both halves; the area fills 80% of the frame. Keep the bottom-right corner calm (the app places the product there).',
        decente,
        'Do NOT show the product.',
        contexto,
      ].join(' ');
    case 'nosotros-vs-ellos': {
      const alternativa = ctx.probo || 'the usual generic alternative of this category';
      return [
        `A close-up still life of the usual alternative the customer already tried: «${alternativa}», unbranded and generic, looking dull and unappealing, on a plain neutral grey background with soft studio light.`,
        'The object is placed on the LEFT edge of the frame and fills the left 60%, cropped by the left edge (the app shows only that part); the rest is plain grey.',
        'No brand names, no logos, no labels, no people. Do NOT show the product of the attached photo.',
        contexto,
      ].join(' ');
    }
    case 'no-compres':
    case 'historia':
      return [
        'A single realistic smartphone photo split vertically into two equal halves side by side, with the split exactly in the center.',
        'LEFT half = BEFORE: the problem clearly visible in the body area, a casual mirror selfie at home (bedroom or bathroom), ordinary clothes. RIGHT half = AFTER: the result clearly visible in the same body area, confident and happier; the change must be dramatic and obvious at first glance, never subtle.',
        persona.replace('same outfit, ', ''),
        id === 'historia' ? 'Keep the bottom 40% of both halves less important (the app covers it with a text panel): the face and the body area of the problem in the upper 60%.' : 'Keep the top 35% of both halves calm (wall or background: the app adds black caption boxes there) and the bottom-center free.',
        ganador,
        decente,
        'Do NOT show the product in the photo.',
        contexto,
      ].join(' ');
    case 'pregunta-revelacion':
      return [
        `A realistic studio photo of a real person of the audience on a plain solid background in the color ${kit.primario}, placed on the LEFT half of the frame: the body area of the problem clearly visible, a surprised or frustrated expression (hands on the head), tight simple clothing.`,
        'The person occupies only the left 50% of the frame; the right half is the plain background color (the app adds the question, the product and the text there).',
        ganador.replace('an ordinary real setting with nothing distracting, ', ''),
        decente,
        'Do NOT show the product.',
        contexto,
      ].join(' ');
    case 'zonas-semanas':
      return [
        'A clean, minimal hand-drawn illustration on a warm cream background (#F5EFE3): the body areas of the problem shown as 2 or 3 small separate sketches side by side (for example thighs, glutes, arms, belly), soft skin tones, fine lines showing the problem (cellulite, swelling or sagging) subtly.',
        'Wide composition, everything centered with generous empty cream margins. Elegant and tasteful, never explicit. No text, no labels, no product.',
        contexto,
      ].join(' ');
    case 'foto-iconos':
      return [
        'A vertical, sharp, bright lifestyle photo of a real person of the audience seen from behind or in profile, the body area of the result filling 70% of the frame (tight leggings, shorts or jeans that show the shape), confident pose, real home or studio setting with a soft background.',
        'Natural light, high quality, like a fitness or wellness brand photo. The person is centered (the app crops the photo to a tall card).',
        decente,
        'Do NOT show the product.',
        contexto,
      ].join(' ');
    // ---- los clones de los validados (clones.jsx)
    case 'etapas-neon':
      return [
        `Three glowing neon line-art outlines of the same person of the audience walking in side profile, in a row from left to right: small and dim on the left, medium in the middle, large and bright on the right, the result in the body area of the problem growing stage by stage (the last one clearly the best).`,
        `Thin bright neon lines in the color ${neonDe(kit)} with a soft glow, no fill, no facial details, on a PURE BLACK background; sporty fitted outfit and sneakers drawn as lines. Leave the bottom-left 25% black and empty.`,
        'Elegant and premium, never explicit. No text, no labels, no product.',
        contexto,
      ].join(' ');
    case 'antes-despues-plazo':
      return [
        'A dramatic, high-contrast black and white studio photo split exactly in the vertical center into two halves: LEFT = BEFORE, RIGHT = AFTER of the body area of the problem (for example the legs from the knees down, the belly or the glutes), front view, filling the frame.',
        persona,
        'The change must be dramatic and obvious at first glance. Dark seamless background; the top 25% dark and empty (the app puts the headline there) and the center bottom free (the product goes there on a pedestal).',
        decente,
        'No text, no labels, do NOT show the product.',
        contexto,
      ].join(' ');
    case 'dos-mitades':
      return [
        `A flat, modern vector illustration with the background split vertically in two equal halves: LEFT half solid color ${kit.primario}, RIGHT half solid color ${kit.secundario}.`,
        'LEFT: the body area of the problem looking bad (swollen, tired, heavy; cool tones and small motion lines). RIGHT: the same body area healthy, light and defined (warm tones, small sparkle lines).',
        'The body areas fill the lower 75% of each half; keep the center vertical strip (20% of the width) and the top 22% free (the app puts the product and the headline there).',
        decente,
        'No text, no labels, no product.',
        contexto,
      ].join(' ');
    case 'rotulos-anatomia':
      return [
        'A realistic medical-style illustration on a pure white background, split in two halves: LEFT the body area of the problem with the issue clearly visible (swelling, trapped fluid, redness or sagging, shown in a tasteful medical way); RIGHT the same body area healthy and defined.',
        'Same scale, framing and skin tone on both halves; the body area fills each half; the center vertical strip (25% of the width) stays plain white (the product goes there).',
        decente,
        'No text, no labels, no arrows, no product.',
        contexto,
      ].join(' ');
    case 'estado-vs-estado':
      return [
        'A hand-drawn colored sketch illustration (ink lines with pencil and watercolor shading) on a pure white background: the same person of the audience twice, waist up or full body.',
        'LEFT: with the problem in the body area, sad and tired, slouched. RIGHT: with the result in the same body area, smiling and confident. Each figure centered in its half; the center vertical strip (20% of the width) stays plain white.',
        decente,
        'No text, no labels, no product.',
        contexto,
      ].join(' ');
    case 'cuadricula-tiempo':
      return [
        'A single image divided into a 2x2 grid of four equal panels separated by thin white lines: the same person in side profile, same pose and same framing on the body area of the problem, painted-realistic illustration on a light grey-blue background.',
        'Top-left = before (problem clearly visible), top-right = a little better, bottom-left = better, bottom-right = the clearest result. The change grows panel by panel.',
        persona,
        decente,
        'No text, no labels, no product.',
        contexto,
      ].join(' ');
    case 'beneficios-lados':
      return [
        'A realistic photo split in two halves in the same real home room: LEFT = BEFORE, the same person with the problem visible in the body area, worried; RIGHT = AFTER, the result clearly visible, happy and confident.',
        persona,
        'The people stand in the central 50% of the width; the left 25% and the right 25% of the image are calm background (the app puts icon lists there); the center bottom stays free for the product.',
        ganador,
        decente,
        'No text, do NOT show the product.',
        contexto,
      ].join(' ');
    case 'dias-producto':
      return [
        'A single clean photo with 3 vertical panels on a pure white seamless studio background, separated by white gaps: the same person of the audience seen from the back (three-quarter back view), same pose, black tight sportswear and white sneakers, full body.',
        'From left to right the result in the body area grows (left = start, right = clearest result).',
        persona,
        decente,
        'No text, no labels, no product. Keep the bottom 6% white.',
        contexto,
      ].join(' ');
    default:
      return contexto;
  }
}

// ---------------------------------------------------------------- preparar el lote (sin la IA de texto)

/** Escribe todo lo que antes escribía la estrategia de la IA. { ok, escenas, plantillas } */
export async function prepararPlantillas(carpeta, brief) {
  const n = Number(brief?.cantidad) || 0;
  if (!n) return { ok: false, motivo: 'sin cantidad' };
  const ids = idsDelLote(n);
  // «De un video, imágenes»: cada variación es un cuadro del video con su ángulo y su plantilla (el cuadro es la escena)
  const deVideo = Array.isArray(brief.video?.cuadros) && brief.video.cuadros.length ? brief.video.cuadros : null;
  const ctx = contextoDelLote(carpeta, brief);
  // sin formatos elegidos y con textos de la investigación de mercado: las plantillas que propuso la investigación
  const propuestas = (ctx.anuncios || []).map((x) => x.plantilla);
  const elegidas = brief.plantillas?.elegidas?.length ? brief.plantillas.elegidas : propuestas;
  const asignadas = deVideo ? ids.map((_, i) => deVideo[i]?.plantilla || 'foto-titular') : asignar(n, elegidas);
  const kit = brief.productoId ? await kitDe(brief.productoId) : limpiarKit(brief.plantillas?.kit);
  brief.plantillas = { ...(brief.plantillas || {}), kit: limpiarKit(brief.plantillas?.kitElegido || kit), asignadas };
  brief.fiel = false;
  brief.rapido = true;
  guardarJSON(R.brief(carpeta), brief);
  const lote = leerJSON(R.lote(carpeta));
  if (lote?.fiel) guardarJSON(R.lote(carpeta), { ...lote, fiel: false });

  guardarJSON(R.productoJson(carpeta), {
    slug: brief.slug || path.basename(carpeta),
    nombre: ctx.nombre,
    analisis: ctx.queEs || ctx.nombre,
    tipo_producto: 'producto físico',
    descripcion_visual_en: 'Use the attached product photo exactly as it is.',
    foto_producto: fotoDelLote(carpeta) || 'entrada/producto.png',
    datos: brief.datos || {},
    identidad_visual: { color_palette: `${brief.plantillas.kit.primario} and ${brief.plantillas.kit.secundario}`, text_typography: `${brief.plantillas.kit.fuenteTitulo} + ${brief.plantillas.kit.fuenteScript}` },
    beneficios: ctx.beneficios.slice(0, 6),
    caracteristicas: ctx.ingredientes.map((x) => x.nombre).slice(0, 6),
  });
  guardarJSON(R.estrategia(carpeta), {
    resumen: `Plantillas: ${n} ${n === 1 ? 'anuncio' : 'anuncios'} armados por la app con tus textos y tu kit de marca; ${asignadas.filter((x) => POR_ID.get(x)?.escena).length} con una escena del modelo de imagen (sin texto).`,
    paleta: [{ hex: brief.plantillas.kit.primario, nombre: 'fondo' }, { hex: brief.plantillas.kit.secundario, nombre: 'acento' }],
    tipografia: `${brief.plantillas.kit.fuenteTitulo} + ${brief.plantillas.kit.fuenteScript}`,
    estilo: 'Plantillas limpias: una idea por imagen, titular enorme, el producto real y grande.',
    beneficios: ctx.beneficios.slice(0, 6),
    caracteristicas: ctx.ingredientes.map((x) => x.nombre).slice(0, 6),
    puntos_dolor: ctx.dolores.slice(0, 6),
    plantillas: true,
  });
  const veces = new Map();
  const variaciones = ids.map((id, i) => {
    const plantilla = asignadas[i];
    const k = veces.get(plantilla) || 0;
    veces.set(plantilla, k + 1);
    const cuadro = deVideo?.[i] || null;
    const textos = cuadro ? { ...textosPorAngulo(cuadro.angulo, plantilla, ctx, k), ...(cuadro.textos || {}) } : textosPara(plantilla, ctx, k);
    const cat = POR_ID.get(plantilla);
    // (con un cuadro del video, la escena ya está: no se le pide nada al modelo de imagen)
    const conEscena = Boolean(cat.escena && !cuadro);
    const titular = textos.titular || textos.titulo || textos.buena || (textos.lineas || []).join(' ') || textos.texto || '';
    guardarJSON(R.v(carpeta, id), {
      ad_info: { variation_id: id },
      visual_prompt: conEscena ? descripcionEscena(plantilla, ctx, textos, brief.plantillas.kit) : cuadro ? 'Frame from the user video, composed by the app (no image model).' : 'Template-only ad: the app composes it from the product photo (no image model).',
      text_layers: [],
      mandatory_visual_elements: [],
      final_generation_exclusions: [],
      language_rule: 'No visible text at all: the app adds every text.',
      app_plantilla: { id: plantilla, escena: conEscena, textos, k, fecha: ahora(), ...(cuadro ? { escenaFija: cuadro.archivo, angulo: cuadro.angulo } : {}) },
    });
    const angulo = cuadro ? ANGULO_NOMBRE[cuadro.angulo] || cuadro.angulo : cat.familia === 'angulo' ? cat.nombre : cat.familia === 'dolor' ? 'Dolor y resultado' : cat.familia === 'beneficio' ? 'Beneficio' : cat.familia === 'nativo' ? 'Nativo de redes' : 'Oferta';
    return { id, fuente: 'plantilla', plantilla, angulo, formato: cat.nombre, titular: String(titular).replace(/\*/g, '').slice(0, 120), escena: conEscena, ...(cuadro ? { cuadro: cuadro.archivo } : {}) };
  });
  guardarJSON(R.plan(carpeta), { producto: ctx.nombre, lote: brief.slug || path.basename(carpeta), cantidad: n, proporciones: brief.formatos || ['1:1'], variaciones, plantillas: true });
  return { ok: true, escenas: variaciones.filter((x) => x.escena).length, plantillas: asignadas };
}

// ---------------------------------------------------------------- la muestra de cada plantilla (en el formulario)

const CONTEXTO_DE_EJEMPLO = {
  nombre: 'Tu producto',
  marca: 'TU MARCA',
  queEs: 'Lo que es tu producto, en una frase.',
  publico: '',
  beneficios: ['Tu beneficio principal', 'Un segundo beneficio', 'Fácil de usar', 'Para todos los días', 'Sin complicaciones', 'Hecho para ti'],
  ingredientes: [{ nombre: 'Ingrediente 1', valor: null }, { nombre: 'Ingrediente 2', valor: null }, { nombre: 'Ingrediente 3', valor: null }],
  dolores: ['El problema que más le molesta', 'Lo que ya probó y no le sirvió', 'Lo que le da vergüenza'],
  dolor: '',
  probo: 'Lo de siempre',
  comoSeUsa: '',
  oferta: '',
  precio: '',
  cta: 'Pídelo hoy',
  ganchos: ['Tu gancho validado aquí'],
  hooks: [],
  objeciones: ['¿Esto sí sirve?'],
  citas: [],
  deseo: '',
  etapas: ['Día 1', 'Día 7', 'Día 14'],
  legal: '',
};

/** Los textos de la muestra de una plantilla: los del producto elegido o, sin producto, unos de ejemplo. */
export function textosDeMuestra(id, productoId, ficha, anuncio = null) {
  if (!productoId || !idValido(productoId)) return textosPara(id, CONTEXTO_DE_EJEMPLO, 0);
  const ctx = contextoDelLote(path.join(PRODUCTOS, productoId), { productoId, datos: { nombre: ficha?.nombre || '' } });
  // (el texto número `anuncio` de la investigación de mercado, para verlo dibujado en la pantalla de la investigación)
  const elegido = Number.isInteger(anuncio) ? (ctx.anuncios || []).find((x) => x.indice === anuncio) : null;
  if (elegido?.plantilla === id) return { ...textosPara(id, { ...ctx, anuncios: [] }, 0), ...elegido.textos };
  return textosPara(id, ctx, 0);
}

// ---------------------------------------------------------------- qué hace solo la app

/** ¿Esta pieza la hace solo la app (sin el modelo de imagen)? Las de plantillas sin escena y los verticales con escena. */
export function piezaLocal(ap, pieza) {
  if (!ap) return false;
  return !ap.escena || formatoDe(pieza) === '9:16';
}

/** Las piezas que pasan por el motor (las escenas): solo el cuadrado de las variaciones con escena. */
export function piezasConEscena(carpeta, brief) {
  return idsDelLote(brief?.cantidad)
    .filter((v) => plantillaDe(carpeta, v)?.escena)
    .map((v) => piezaId(v, '1:1'));
}

// ---------------------------------------------------------------- dibujar

/** La escena de una variación (si ya salió), o null. */
function escenaDe(carpeta, v, est) {
  const p = est?.piezas?.[piezaId(v, '1:1')];
  const abs = R.img(carpeta, piezaId(v, '1:1'));
  if (!existe(abs)) return null;
  if (p && (p.version || 0) < 1) return null;
  return abs;
}

async function propsDe(carpeta, pieza, { brief, est, producto }) {
  const v = vDe(pieza);
  const ap = plantillaDe(carpeta, v);
  if (!ap) return null;
  // la escena: la del modelo (si la usa y ya salió) o el cuadro del video (escenaFija)
  const fija = ap.escenaFija && existe(path.join(carpeta, ap.escenaFija)) ? path.join(carpeta, ap.escenaFija) : null;
  const escena = (ap.escena ? escenaDe(carpeta, v, est) : null) || fija;
  const kit = limpiarKit(brief?.plantillas?.kit);
  const logo = brief?.logo?.posicion && existe(R.logo(carpeta)) ? R.logo(carpeta) : null;
  const formato = formatoDe(pieza);
  const props = {
    plantilla: ap.id,
    formato,
    textos: ap.textos || {},
    kit,
    producto: producto ? { archivo: producto.archivo, recortado: producto.recortado } : null,
    escena: escena ? { archivo: escena } : null,
    logo: logo ? { archivo: logo } : null,
  };
  const huella = crypto
    .createHash('sha1')
    .update(JSON.stringify({ c: codigo(), plantilla: ap.id, formato, textos: props.textos, kit, producto: producto ? [producto.archivo, firma(producto.archivo), producto.recortado] : null, escena: escena ? firma(escena) : null, logo: logo ? firma(logo) : null }))
    .digest('hex');
  return { props, huella, completa: (!ap.escena && (!ap.escenaFija || Boolean(fija))) || Boolean(escena) };
}

/** { existe, alDia, completa } de la imagen dibujada de una pieza (sin dibujar nada). */
export function estadoComposicion(carpeta, pieza) {
  const j = leerJSON(R.finalJson(carpeta, pieza));
  return { existe: existe(R.final(carpeta, pieza)), huella: j?.huella || null, completa: Boolean(j?.completa) };
}

const enCurso = new Map(); // carpeta -> Promise
const dibujando = new Map(); // `${carpeta}|${pieza}` -> Promise

async function dibujarPieza(carpeta, pieza, datos) {
  const clave = `${carpeta}|${pieza}`;
  while (dibujando.has(clave)) await dibujando.get(clave).catch(() => {});
  const p = (async () => {
    const x = await propsDe(carpeta, pieza, datos);
    if (!x) return null;
    const actual = estadoComposicion(carpeta, pieza);
    if (actual.existe && actual.huella === x.huella) return null;
    const r = await renderizar({ composicion: composicionDe(formatoDe(pieza)), props: x.props, salida: R.final(carpeta, pieza) });
    guardarJSON(R.finalJson(carpeta, pieza), { huella: x.huella, completa: x.completa, plantilla: x.props.plantilla, ms: r.ms, fecha: ahora() });
    return r.ms;
  })();
  dibujando.set(clave, p);
  try {
    return await p;
  } finally {
    if (dibujando.get(clave) === p) dibujando.delete(clave);
  }
}

/** Las piezas del lote que ya se pueden dibujar (las de las variaciones escritas). */
function piezasDelLote(carpeta, brief) {
  const salida = [];
  for (const v of idsDelLote(brief?.cantidad)) {
    if (!existe(R.v(carpeta, v))) continue;
    for (const f of brief.formatos || ['1:1']) salida.push(piezaId(v, f));
  }
  return salida;
}

/** ¿Todo lo dibujado está al día? (lo usa el lote para saber si terminó) */
export async function todoAlDia(carpeta, brief) {
  const est = leerEstado(carpeta);
  const producto = await productoDelLote(carpeta);
  for (const pieza of piezasDelLote(carpeta, brief)) {
    const x = await propsDe(carpeta, pieza, { brief, est, producto });
    if (!x) continue;
    const e = estadoComposicion(carpeta, pieza);
    if (!e.existe || e.huella !== x.huella) return false;
  }
  return true;
}

/**
 * Dibuja todo lo que falta o cambió (en paralelo: el trabajador reparte entre los núcleos). Una sola pasada por lote a
 * la vez; si la llaman mientras corre, devuelve la que corre. -> { dibujadas, ms }
 */
export function componerPendientes(carpeta, brief = leerJSON(R.brief(carpeta))) {
  if (enCurso.has(carpeta)) return enCurso.get(carpeta);
  const t0 = Date.now();
  const p = (async () => {
    const est = leerEstado(carpeta);
    const producto = await productoDelLote(carpeta);
    const datos = { brief, est, producto };
    const r = await Promise.allSettled(piezasDelLote(carpeta, brief).map((pieza) => dibujarPieza(carpeta, pieza, datos)));
    const fallas = r.filter((x) => x.status === 'rejected');
    if (fallas.length) console.error(`[plantillas] ${path.basename(carpeta)}: ${fallas.length} sin dibujar: ${fallas[0].reason?.message || fallas[0].reason}`);
    return { dibujadas: r.filter((x) => x.status === 'fulfilled' && typeof x.value === 'number').length, fallas: fallas.length, ms: Date.now() - t0 };
  })().finally(() => enCurso.delete(carpeta));
  enCurso.set(carpeta, p);
  return p;
}

/** Dibuja ya los formatos de una variación (después de editar sus textos). -> { ms, piezas } */
export async function componerVariacion(carpeta, v) {
  const brief = leerJSON(R.brief(carpeta));
  const est = leerEstado(carpeta);
  const producto = await productoDelLote(carpeta);
  const t0 = Date.now();
  const piezas = (brief.formatos || ['1:1']).map((f) => piezaId(v, f));
  await Promise.all(piezas.map((pieza) => dibujarPieza(carpeta, pieza, { brief, est, producto })));
  return { ms: Date.now() - t0, piezas };
}

// ---------------------------------------------------------------- editar

/** Guarda los textos de una variación y la vuelve a dibujar. */
export async function editarTextos(carpeta, v, textos) {
  const ruta = R.v(carpeta, v);
  const ad = leerJSON(ruta);
  if (!ad?.app_plantilla) throw Object.assign(new Error('Este anuncio no es de una plantilla.'), { status: 404 });
  const limpios = limpiarTextos(ad.app_plantilla.id, textos);
  if (!limpios) throw Object.assign(new Error('Revisa los textos.'), { status: 400 });
  ad.app_plantilla = { ...ad.app_plantilla, textos: { ...(ad.app_plantilla.textos || {}), ...limpios }, editado: ahora() };
  guardarJSON(ruta, ad);
  actualizarTitularDelPlan(carpeta, v, ad.app_plantilla.textos);
  return componerVariacion(carpeta, v);
}

function actualizarTitularDelPlan(carpeta, v, t) {
  const plan = leerJSON(R.plan(carpeta));
  const x = plan?.variaciones?.find((y) => y.id === v);
  if (!x) return;
  x.titular = String(t.titular || t.titulo || t.buena || (t.lineas || []).join(' ') || t.texto || x.titular || '').replace(/\*/g, '').slice(0, 120);
  guardarJSON(R.plan(carpeta), plan);
}

/** Otra versión gratis de una plantilla sin escena: los textos de la siguiente vuelta (otro titular, otros puntos). */
export async function otraVersion(carpeta, v) {
  const ruta = R.v(carpeta, v);
  const ad = leerJSON(ruta);
  if (!ad?.app_plantilla) throw Object.assign(new Error('Este anuncio no es de una plantilla.'), { status: 404 });
  const brief = leerJSON(R.brief(carpeta));
  const ctx = contextoDelLote(carpeta, brief);
  // la siguiente vuelta que dé otros textos (si la ficha tiene pocos, puede repetirse alguno, nunca todos)
  const antes = JSON.stringify(ad.app_plantilla.textos || {});
  let k = Number(ad.app_plantilla.k) || 0;
  let textos = ad.app_plantilla.textos;
  for (let i = 0; i < 12; i++) {
    k++;
    textos = textosPara(ad.app_plantilla.id, ctx, k);
    if (JSON.stringify(textos) !== antes) break;
  }
  ad.app_plantilla = { ...ad.app_plantilla, k, textos, editado: ahora() };
  guardarJSON(ruta, ad);
  actualizarTitularDelPlan(carpeta, v, ad.app_plantilla.textos);
  return componerVariacion(carpeta, v);
}

/** Una nota del usuario para la próxima escena («otra persona», «más luz»…): va al final de la descripción. */
export function notaParaEscena(carpeta, v, nota) {
  const ruta = R.v(carpeta, v);
  const ad = leerJSON(ruta);
  if (!ad?.app_plantilla?.escena) return false;
  const base = String(ad.visual_prompt || '').replace(/\s*User note for this new version \(Spanish\):[\s\S]*$/, '');
  ad.visual_prompt = nota ? `${base} User note for this new version (Spanish): «${String(nota).slice(0, 600)}».` : base;
  guardarJSON(ruta, ad);
  return true;
}

// ---------------------------------------------------------------- «Pulir con IA» un cuadro del video (opcional, cuesta)

const PULIR =
  'The FIRST attached image is a frame taken from a video ad. Recreate it as a clean, polished, sharp, high-quality photo: ' +
  'the same person (same face, hair, body and outfit), the same pose, the same place and the same composition and framing, ' +
  'with better light, focus and detail. Remove every text, subtitle, caption, sticker, watermark and user interface from it. ' +
  'If the product appears, it must look exactly like the product of the SECOND attached image.';

/**
 * Prepara una variación de un cuadro del video para pulirla con el modelo de imagen: el cuadro pasa a ser la referencia
 * (entrada/referencias/R##.png) y la escena se pide como siempre (sin texto). Después la pide un pedido normal.
 */
export function prepararPulido(carpeta, v) {
  const ruta = R.v(carpeta, v);
  const ad = leerJSON(ruta);
  const ap = ad?.app_plantilla;
  if (!ap?.escenaFija || !existe(path.join(carpeta, ap.escenaFija))) throw Object.assign(new Error('Esta imagen no sale de un cuadro de tu video.'), { status: 409 });
  const n = Number(String(v).slice(1));
  if (!(n >= 1 && n <= 99)) throw Object.assign(new Error('Esa imagen no se puede pulir.'), { status: 400 });
  const ref = `entrada/referencias/R${String(n).padStart(2, '0')}.png`;
  fs.mkdirSync(R.referencias(carpeta), { recursive: true });
  fs.copyFileSync(path.join(carpeta, ap.escenaFija), path.join(carpeta, ref));
  ad.visual_prompt = PULIR;
  ad.app_plantilla = { ...ap, escena: true, pulir: true, fecha: ahora() };
  guardarJSON(ruta, ad);
  const plan = leerJSON(R.plan(carpeta));
  const x = plan?.variaciones?.find((y) => y.id === v);
  if (x) {
    Object.assign(x, { fuente: 'referencia', referencia: ref, escena: true });
    guardarJSON(R.plan(carpeta), plan);
  }
  const lote = leerJSON(R.lote(carpeta));
  if (lote && !lote.fiel) guardarJSON(R.lote(carpeta), { ...lote, fiel: true });
  return { referencia: ref };
}

// ---------------------------------------------------------------- quitar el fondo del producto (gratis, si se puede)

/**
 * Si en este computador ya está rembg con un modelo bajado (lo usa el podcast en esquina), quita el fondo de la foto del
 * producto una vez (se guarda en la carpeta del producto) y la copia al lote. No baja nada: si no está, las plantillas
 * usan la foto sobre una tarjeta limpia. No espera: el lote se vuelve a dibujar solo cuando llega.
 */
export function recortarProductoDeFondo(carpeta, brief) {
  if (process.env.ANUNCIOS_SIN_RECORTE === '1') return;
  const rel = fotoDelLote(carpeta);
  if (!rel || existe(path.join(carpeta, 'entrada', 'producto-recorte.png'))) return;
  const abs = path.join(carpeta, rel);
  import('./recorte-producto.js')
    .then((m) => m.recortar(abs, brief?.productoId ? path.join(PRODUCTOS, brief.productoId) : null))
    .then((hecho) => {
      if (!hecho) return;
      fs.copyFileSync(hecho, path.join(carpeta, 'entrada', 'producto-recorte.png'));
      componerPendientes(carpeta).catch(() => {});
    })
    .catch(() => {});
}

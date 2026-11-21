// MODO RÁPIDO de los anuncios de imagen (2026-11-16): «como pedirle a ChatGPT que me las varíe».
//
// Antes, cada lote pasaba por la IA de texto tres veces antes de la primera imagen (proponer títulos, que el usuario
// los eligiera, y una estrategia que lee la skill de 106 KB) y después revisaba cada imagen: 15-20 minutos para 5
// imágenes. En el modo rápido la app arma sola los archivos que antes escribía la estrategia (producto.json,
// estrategia.json, plan.json y cada V##.json) en segundos, y el modelo de imagen recibe la referencia y la foto del
// producto con la instrucción de variarla (produccion/imagen-ads.js, app_rapido). Sin títulos que elegir y sin la
// revisión de la IA.
//
//   Variantes          app_rapido 'copiar'    el mismo diseño de lo que ya te funciona, con otro titular
//   Nuevos             app_rapido 'inspirar'  una composición nueva con el mismo tipo de formato que lo validado
//
// Los titulares: primero los ganchos validados de la investigación con TrendTrack (entrada/ganchos.json), después los
// beneficios de la ficha del producto; nunca dos iguales en el lote. Las referencias: las que subió o eligió el usuario
// y, en Nuevos sin ninguna, los anuncios validados (entrada/validados/, «Me funciona» y la biblioteca).
//
//   prepararRapido(carpeta, brief) -> { ok: true } | { ok: false, motivo }   (escribe todo y deja el brief al día)
import fs from 'node:fs';
import path from 'node:path';
import { leerJSON, existe } from '../archivos.js';
import { leerFicha } from '../productos.js';
import { R, guardarJSON, idsDelLote, fotoDelLote } from './disco.js';
import { leerSkill } from './verificar.js';
import { contextoCreativo, MOMENTOS } from './angulo-producto.js';
import { fichaDe } from './plantillas-referencia.js';
import { leerMapa, variedad } from './replicar.js';

const corto = (t, max) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, max);
const sinComillas = (t) => corto(t, 200).replace(/^["«“']+|["»”']+$/g, '').trim();

/** Ángulos que se van turnando (todos están en angulos.json de la skill). */
const ANGULOS = ['beneficio-principal', 'dolor', 'transformacion', 'prueba-social', 'curiosidad', 'mecanismo-unico', 'objecion-confianza', 'promesa-emocional'];

/** Los titulares del lote (distintos): ganchos validados, después beneficios de la ficha, después el nombre. */
export function titularesDelLote(carpeta, brief, n) {
  const salida = [];
  const vistos = new Set();
  const sumar = (t, base) => {
    const x = sinComillas(t);
    if (!x || x.length < 6 || vistos.has(x.toLowerCase())) return;
    vistos.add(x.toLowerCase());
    salida.push({ titulo: x.length > 90 ? `${x.slice(0, 87).replace(/\s+\S*$/, '')}…` : x, base });
  };
  const ganchos = brief?.ganchos ? leerJSON(path.join(carpeta, brief.ganchos))?.ganchos || [] : [];
  for (const g of ganchos) sumar(g.gancho, `${g.id || 'gancho'} · investigación con TrendTrack${g.evidencia ? `: ${corto(g.evidencia, 120)}` : ''}`);
  const ficha = brief?.productoId ? leerFicha(brief.productoId) : null;
  for (const b of Array.isArray(ficha?.beneficios) ? ficha.beneficios : []) sumar(b, 'beneficio de la ficha del producto');
  const nombre = corto(brief?.datos?.nombre || ficha?.nombre || '', 60);
  if (ficha?.dolor) sumar(`¿${corto(ficha.dolor, 70).replace(/[.?¿!¡]+$/g, '')}?`, 'dolor de la ficha del producto');
  if (nombre) {
    sumar(`Descubre ${nombre}`, 'nombre del producto');
    sumar(`${nombre}: lo que tu cuerpo estaba esperando`, 'nombre del producto');
  }
  if (!salida.length) return [];
  // si hay menos que la cantidad, se repiten en orden (el modelo cambia los textos secundarios en cada una)
  return Array.from({ length: n }, (_, i) => salida[i % salida.length]);
}

/** Las referencias del lote: las del usuario; en Nuevos sin ninguna, se copian las validadas a entrada/referencias/. */
function referenciasDelLote(carpeta, brief) {
  const propias = (brief.referencias || []).filter((r) => existe(path.join(carpeta, r)));
  if (propias.length) return propias;
  const validados = (Array.isArray(brief.validados) ? brief.validados : []).filter((x) => x?.archivo && existe(path.join(carpeta, x.archivo)));
  if (!validados.length) return [];
  fs.mkdirSync(R.referencias(carpeta), { recursive: true });
  return validados.slice(0, 10).map((x, i) => {
    const ext = path.extname(x.archivo).toLowerCase() === '.png' ? '.png' : '.jpg';
    const rel = `entrada/referencias/R${String(i + 1).padStart(2, '0')}${ext}`;
    fs.copyFileSync(path.join(carpeta, x.archivo), path.join(carpeta, rel));
    return rel;
  });
}

/**
 * Arma el lote sin la IA de texto. { ok: false, motivo } si no se puede (sin referencias ni titulares): entonces el
 * lote sigue por el camino de siempre (la estrategia de la IA).
 */
export function prepararRapido(carpeta, brief) {
  const n = Number(brief?.cantidad) || 0;
  if (!n) return { ok: false, motivo: 'sin cantidad' };
  const refs = referenciasDelLote(carpeta, brief);
  if (!refs.length) return { ok: false, motivo: 'sin referencias' };
  const replicar = Boolean(brief.replicar) && brief.modo === 'variantes';
  const titulares = replicar ? Array.from({ length: n }, () => ({ titulo: '', base: 'el mapa de la referencia' })) : titularesDelLote(carpeta, brief, n);
  if (!titulares.length) return { ok: false, motivo: 'sin titulares' };
  // (2026-11-21) MODO REPLICAR VALIDADO: cada referencia trae su mapa (replicar.js) y cada imagen, su combinación
  const mapas = replicar ? refs.map((_, k) => leerMapa(carpeta, k + 1)) : [];
  if (replicar && mapas.some((m) => !m)) return { ok: false, motivo: 'sin mapa' };
  const combos = replicar ? variedad(n, brief.slug || path.basename(carpeta)) : [];
  const usados = new Map(); // referencia -> cuántos titulares de su mapa ya se usaron

  const ficha = brief.productoId ? leerFicha(brief.productoId) || {} : {};
  const nombre = corto(brief.datos?.nombre || ficha.nombre || 'el producto', 80);
  const beneficios = (Array.isArray(ficha.beneficios) ? ficha.beneficios : []).map((b) => corto(b, 120)).filter(Boolean).slice(0, 6);
  const caracteristicas = (Array.isArray(ficha.ingredientes) ? ficha.ingredientes : []).map((x) => corto(x, 120)).filter(Boolean).slice(0, 6);
  // (producto.json y estrategia.json piden al menos 4 de cada una: se completan con lo genérico, solo para el archivo)
  const almenos4 = (lista, relleno) => [...lista, ...relleno].slice(0, Math.max(4, lista.length));
  const publico = corto(brief.datos?.publico || ficha.publico || '', 200);
  const pais = corto(brief.datos?.pais || ficha.pais || '', 60);
  // (las plantillas de referencia se copian como Variantes: mismo diseño, otro producto, textos y paleta)
  const modo = brief.modo === 'variantes' && brief.replicar ? 'replicar' : brief.modo === 'variantes' || brief.desdePlantillas ? 'copiar' : 'inspirar';
  const propias = new Set(brief.referenciasPropias || []);
  const conceptoDeRef = (k) => (brief.modo === 'variantes' && Array.isArray(brief.conceptosReferencias) ? String(brief.conceptosReferencias[k - 1] || '').trim() : '');
  const { angulos } = leerSkill();
  const ids = idsDelLote(n);
  // con plantillas: el ángulo del producto y los conceptos de Andromeda (angulo-producto.js)
  const creativo = brief.desdePlantillas ? contextoCreativo(brief.productoId) : null;
  // «De un video» (2026-11-19): el ángulo y los conceptos salen del análisis del video (video-imagenes.js)
  if (creativo && brief.desdeVideo?.conceptos?.length) {
    const v = brief.desdeVideo.video || {};
    creativo.deseo = v.deseo || v.promesa || creativo.deseo;
    if (v.dolor) creativo.dolor = v.dolor;
    creativo.conceptos = brief.desdeVideo.conceptos.map((c) => ({ faceta: c.faceta, problema: c.angulo, contexto: c.momento, escenario: c.escena, dolor: '', hook: v.gancho ? `con la mecánica del gancho del video: ${v.gancho}` : '', titular: c.titular }));
  }
  // (si hay menos conceptos que imágenes, el que se repite cambia de momento y de titular: para Andromeda, dos anuncios
  // que cambian menos de 2 de faceta, momento y plantilla son el mismo)
  const L = creativo?.conceptos?.length || 0;
  const conceptoDe = (i) => {
    if (!L) return null;
    const c = creativo.conceptos[i % L];
    return i < L ? c : { ...c, contexto: MOMENTOS[i % MOMENTOS.length], escenario: '', hook: '', titular: '' };
  };
  const titularDe = (i) => (i < L ? conceptoDe(i).titular || conceptoDe(i).hook || '' : '');

  // el brief: las referencias que se usan (en Nuevos pueden ser las validadas) y «fiel» para que el motor las adjunte
  brief.referencias = refs;
  brief.fiel = true;
  guardarJSON(R.brief(carpeta), brief);

  const foto = fotoDelLote(carpeta) || 'entrada/producto.png';
  guardarJSON(R.productoJson(carpeta), {
    slug: brief.slug || path.basename(carpeta),
    nombre,
    analisis: corto(ficha.queEs || `${nombre}.`, 600) || nombre,
    tipo_producto: corto(ficha.tipo || 'producto físico', 80) || 'producto físico',
    descripcion_visual_en: 'Use the attached product photo exactly as it is (packaging, label, colors and proportions).',
    foto_producto: foto,
    datos: brief.datos || {},
    identidad_visual: {
      color_palette: 'the colors of the product packaging',
      visual_style: 'the style of the reference ad',
      visual_atmosphere: 'the atmosphere of the reference ad',
      graphic_language: 'the graphic language of the reference ad',
      text_typography: 'the typography of the reference ad',
      art_direction: modo !== 'inspirar' ? 'same design as the reference ad' : 'new composition inspired by the reference ad',
    },
    beneficios: almenos4(beneficios, ['Beneficio principal del producto', 'Fácil de usar', 'Calidad', 'Resultados visibles']),
    caracteristicas: almenos4(caracteristicas, ['Producto real de la foto', 'Empaque original', 'Uso diario', 'Envío a domicilio']),
  });
  guardarJSON(R.estrategia(carpeta), {
    resumen: `Modo rápido: ${n} ${modo === 'replicar' ? 'réplicas exactas de tu anuncio validado (cambian la modelo, el escenario, la pose y el titular)' : modo === 'copiar' ? 'variaciones de lo que ya te funciona' : 'anuncios nuevos inspirados en anuncios validados'}, con un titular distinto en cada una.`,
    paleta: [{ hex: '#000000', nombre: 'la del empaque del producto' }, { hex: '#FFFFFF', nombre: 'la de cada referencia' }],
    tipografia: 'la de cada referencia',
    estilo: modo !== 'inspirar' ? 'el de cada referencia' : 'inspirado en cada referencia',
    beneficios: almenos4(beneficios, ['Beneficio principal del producto', 'Fácil de usar', 'Calidad', 'Resultados visibles']),
    caracteristicas: almenos4(caracteristicas, ['Producto real de la foto', 'Empaque original', 'Uso diario', 'Envío a domicilio']),
    rapido: true,
  });

  const variaciones = ids.map((id, i) => {
    const angulo_id = ANGULOS[i % ANGULOS.length];
    const ref = refs[i % refs.length];
    return {
      id,
      fuente: 'referencia',
      referencia: ref,
      angulo_id: angulos.has(angulo_id) ? angulo_id : [...angulos.keys()][0] || 'beneficio-principal',
      angulo: angulos.get(angulo_id)?.nombre || angulo_id,
      concepto: modo === 'replicar' ? 'Réplica exacta del anuncio validado' : modo === 'copiar' ? 'Variación del creativo que ya funciona' : 'Anuncio nuevo inspirado en un anuncio validado',
      titular: brief.variacionesChat?.[i]?.titular ? corto(brief.variacionesChat[i].titular, 140) : replicar ? corto((mapas[i % refs.length]?.titulares || [])[Math.floor(i / refs.length)] || mapas[i % refs.length]?.titular_original, 120) : corto(titularDe(i), 90) || titulares[i].titulo,
      escena: modo === 'replicar' ? `${combos[i]?.escenario} · ${combos[i]?.pose}` : modo === 'copiar' ? 'la de la referencia' : 'nueva, del mismo tipo que la referencia',
      camara: 'la de la referencia',
      base_titular: titulares[i].base,
    };
  });
  guardarJSON(R.plan(carpeta), { producto: nombre, lote: brief.slug || path.basename(carpeta), cantidad: n, proporciones: brief.formatos || ['1:1'], variaciones, rapido: true });

  variaciones.forEach((x, i) => {
    const k = (refs.indexOf(x.referencia) + 1) || 1;
    const deEsteProducto = modo === 'copiar' && propias.has(k);
    if (replicar) {
      const m = mapas[k - 1];
      const j = usados.get(k) || 0;
      usados.set(k, j + 1);
      const titulos = (m.titulares || []).map((t) => corto(t, 120)).filter(Boolean);
      guardarJSON(R.v(carpeta, x.id), variacionReplicar({ id: x.id, mapa: m, combo: combos[i], titular: titulos[j % titulos.length] || m.titular_original, nombre }));
      return;
    }
    if (creativo) {
      // (la plantilla de esta imagen: la referencia R0k es la k-ésima elegida)
      const plantilla = fichaDe((brief.plantillasReferencia || [])[refs.indexOf(x.referencia)]);
      guardarJSON(R.v(carpeta, x.id), variacionDePlantilla({ id: x.id, i, titular: x.titular, nombre, publico, pais, beneficios, creativo, concepto: conceptoDe(i), plantilla }));
      return;
    }
    const visual = [
      `Product: ${nombre}${publico ? `, for ${publico}` : ''}${pais ? ` (market: ${pais})` : ''}.`,
      beneficios.length ? `Benefits to use in the secondary texts (Spanish, short): ${beneficios.join('; ')}.` : 'Secondary texts: short and about the main benefit of the product.',
      // el ángulo es el de la referencia (el modelo lo lee: LEER_REFERENCIA en produccion/imagen-ads.js); el de la
      // biblioteca solo sugiere el tono del texto si la referencia no tiene uno claro
      `Angle: the SAME one as the reference ad (same body area, problem or desire, same hook). Only if the reference has no clear angle, use: ${x.angulo}.`,
      // (2026-11-19h) una variante parte de lo que ya funciona: su CONCEPTO creativo se conserva
      modo === 'copiar' && conceptoDeRef(k)
        ? `WINNING CREATIVE CONCEPT of this reference (why it sells, in the owner's words; KEEP this concept, change only the execution details and the headline): ${conceptoDeRef(k)}`
        : null,
      modo === 'copiar'
        ? deEsteProducto
          ? 'This reference is an ad of this same product: keep everything (also its colors); change only the texts.'
          : "Adapt the color palette to the product's packaging, keeping the same contrast and hierarchy as the reference."
        : 'Use a color palette that matches the product packaging. Make it look like a premium, scroll-stopping social media ad.',
      'All visible text in Spanish, perfectly spelled, with accents. The product must look exactly like the attached product photo.',
      // (2026-11-21d) VARIACIONES DEL CHAT: lo que cambia en esta imagen, lo que pidió el usuario y lo que ya votó
      brief.variacionesChat?.[i]?.cambio ? `WHAT CHANGES IN THIS VARIATION (and only this, the rest stays like the reference): ${brief.variacionesChat[i].cambio}` : null,
      brief.variacionesChat ? `The headline PLAYS with the winning headline of the reference keeping its essence (same promise, same desire, same timeframe if it has one), never generic. If there is a before/after, the change must be obvious at first glance: two clearly different moments, the AFTER body visibly improved in the area of the angle.${brief.indicacionesChat ? ` THE CLIENT ASKED: ${brief.indicacionesChat}` : ''}` : null,
      brief.leccionesChat || null,
    ]
      .filter(Boolean)
      .join('\n');
    guardarJSON(R.v(carpeta, x.id), {
      ad_info: { variation_id: x.id },
      global_identity: { color_palette: deEsteProducto ? 'the same colors as the reference' : "the colors of the product's packaging", text_typography: 'the typography of the reference ad' },
      visual_prompt: visual.length >= 200 ? visual : `${visual}\nKeep the composition clean, with generous negative space and a clear visual hierarchy.`,
      text_layers: [
        {
          reference_function: 'main headline',
          reference_position: modo === 'copiar' ? 'same place as the main headline of the reference' : 'top area, the biggest text',
          text: x.titular,
          text_style: modo === 'copiar' ? 'same style as the main headline of the reference' : 'bold, high contrast, very legible',
        },
      ],
      mandatory_visual_elements: ['the real product from the attached product photo'],
      final_generation_exclusions: ['any logo, brand name or text from the reference ad', 'misspelled words'],
      reference_structure_analysis: { forbidden_additions: ["the reference ad's brand, prices or claims"], detected_visual_blocks: [] },
      language_rule: 'All visible text in Spanish.',
      app_rapido: modo,
      ...(brief.variacionesChat?.[i] ? { app_chat: { cambio: brief.variacionesChat[i].cambio || '' } } : {}),
    });
  });
  return { ok: true, referencias: refs.length, titulares: titulares.length, modo };
}

/**
 * Una variación del MODO REPLICAR VALIDADO (app_rapido 'replicar', produccion/imagen-ads.js RAPIDO_REPLICAR): el mapa
 * de la referencia, EXACTO, y lo único que cambia en esta imagen (modelo, escenario, pose y encuadre, titular).
 */
export function variacionReplicar({ id, mapa, combo, titular, nombre }) {
  const z = mapa.zonas || {};
  const tp = mapa.tipografia_paleta || {};
  const a = mapa.angulo || {};
  const visual = [
    `PRODUCT: ${nombre}. It replaces the product of the reference, in the same zone, size and angle.`,
    'MAP OF THE REFERENCE (fixed, nothing moves):',
    `- Headline: ${z.titular}`,
    `- Model / before-after: ${z.modelo}`,
    `- Product bottle: ${z.producto}`,
    `- Benefit bullets / checks: ${z.beneficios}`,
    `- Offer block and CTA: ${z.oferta_cta}`,
    z.otros ? `- Other blocks: ${z.otros}` : null,
    `READING HIERARCHY (unchanged): ${(mapa.jerarquia || []).map((x, i) => `${i + 1}) ${x}`).join('  ')}`,
    `TYPOGRAPHY: ${tp.fuentes}`,
    `PALETTE: ${tp.colores}`,
    `TEXT BLOCK BACKGROUNDS: ${tp.fondos_de_bloques}`,
    `SALES ANGLE (identical): desire: ${a.deseo}; main benefit: ${a.beneficio}; pain: ${a.dolor}.`,
    'WHAT CHANGES IN THIS IMAGE (and only this):',
    `- MODEL: ${combo.modelo}. If the reference has a before/after, it is this same new woman in both halves.`,
    `- SETTING / BACKGROUND OF THE PHOTO: ${combo.escenario}.`,
    `- POSE AND FRAMING: ${combo.pose}, inside the same zone and the same % of the image as the reference.`,
    '- HEADLINE WORDING: the one given in TEXTS (same promise, other words).',
  ]
    .filter(Boolean)
    .join('\n');
  const textos = (Array.isArray(mapa.textos) ? mapa.textos : []).filter((t) => t && String(t.texto || '').trim()).slice(0, 12);
  return {
    ad_info: { variation_id: id },
    global_identity: { color_palette: `exactly the same as the reference: ${tp.colores}`, text_typography: `exactly the same as the reference: ${tp.fuentes}` },
    visual_prompt: visual,
    text_layers: [
      { reference_function: 'main headline', reference_position: z.titular, text: titular, text_style: 'the same style, size and background as the headline of the reference' },
      ...textos.map((t) => ({ reference_function: corto(t.zona, 60) || 'text', reference_position: 'the same zone as in the reference', text: corto(t.texto, 200), text_style: 'the same style and background as in the reference' })),
    ],
    mandatory_visual_elements: ['the real product from the attached product photo, where the reference has its bottle', `a different woman: ${combo.modelo}`],
    final_generation_exclusions: ['moving, adding or removing any block', 'a different font or palette', 'any new claim, number or testimonial', "the reference's brand or logo", 'misspelled words'],
    reference_structure_analysis: { forbidden_additions: ['new blocks', 'new claims'], detected_visual_blocks: Object.keys(z) },
    language_rule: 'All visible text in Spanish.',
    app_rapido: 'replicar',
    app_replicar: { modelo: combo.modelo, escenario: combo.escenario, pose: combo.pose },
  };
}

/**
 * Una variación de un lote con PLANTILLAS (app_rapido 'plantilla', produccion/imagen-ads.js RAPIDO_PLANTILLA): lo que
 * el modelo tiene que mostrar con la forma de la plantilla. El ÁNGULO es el del producto (deseo central, resultados,
 * zona del cuerpo); el CONCEPTO (faceta, problema, momento y escenario) cambia en cada imagen, como pide Andromeda.
 */
export function variacionDePlantilla({ id, i, titular, nombre, publico, pais, beneficios, creativo, concepto, plantilla = null }) {
  const c = creativo;
  const deseo = c.deseo || c.resultados[0] || beneficios[0] || '';
  const lineas = [
    `PRODUCT: ${nombre}${pais ? ` (market: ${pais}, Spanish of ${pais})` : ''}.`,
    `THIS PRODUCT'S ANGLE (what the image must SHOW, in the template's form): ${deseo || 'the main result of the product'}.`,
    c.resultados.length ? `Desired results, most important first: ${c.resultados.slice(0, 3).join(' · ')}.` : null,
    beneficios.length ? `Benefits (for the secondary texts): ${beneficios.join('; ')}.` : null,
    c.dolor ? `The pain in the customer's words: ${c.dolor}` : null,
    c.avatar || publico ? `Customer: ${c.avatar || publico}` : null,
    concepto
      ? `CONCEPT of this image (one of the Andromeda matrix, different from the other images of the batch): facet «${concepto.faceta}»${concepto.problema ? `; problem «${concepto.problema}»` : ''}${concepto.contexto ? `; moment «${concepto.contexto}»` : ''}${concepto.dolor ? `; the customer says «${concepto.dolor}»` : ''}${concepto.hook ? `; hook «${concepto.hook}»` : ''}. Show that person in that moment, inside the template's form.`
      : `CONCEPT of this image (different from the other images of the batch): the customer ${MOMENTOS[i % MOMENTOS.length]}. Show that person in that moment, inside the template's form.`,
    // la escena (la que escribió la IA o el usuario): lo que la imagen tiene que mostrar, con detalle
    concepto?.escenario ? `WHAT THE IMAGE SHOWS (follow this scene closely, inside the template's form; make it vivid, eye-catching and scroll-stopping): ${concepto.escenario}` : null,
    // el TITULAR con la estructura de la plantilla, atacando el deseo o beneficio principal (2026-11-18u)
    plantilla?.titular
      ? `HEADLINE STRUCTURE of this template: ${plantilla.titular} (the template, for another product, says: «${plantilla.ejemplo}»). Write THIS image's main headline and labels with exactly that structure, filled with THIS product's main desire or benefit (${deseo || 'its main result'}), in the customer's words, so the headline names the very result the image shows. Idea from the research: «${titular}» (use its words when they fit the structure).`
      : `HEADLINE: attack directly the product's main desire or benefit (${deseo || 'its main result'}), in the customer's words, naming the very result the image shows. Idea: «${titular}».`,
    'THE RESULT MUST BE BIG AND OBVIOUS, even as a small thumbnail: if the desire is MORE volume or shape (glutes, hips, legs, bust, curves), the AFTER, the last panel or the single person shows clearly MORE volume, roundness and lift, with the body area filling 60 to 70 % of its panel, in fitted clothes (leggings, jeans, a fitted dress), seen from the side or 3/4 back; if the desire is LESS of something (belly, swelling, cellulite, fat), show it clearly reduced. The headline and the labels name that same result.',
    c.tiempos.length
      ? `Allowed timeframes (for the panel labels and the headline): ${c.tiempos.map((t) => `${t.que}: ${t.cuando}`).join(' · ')}.${c.notaTiempos ? ` Rule: ${c.notaTiempos}` : ''} If the template has more panels than allowed timeframes, label them ANTES / DESPUÉS or with the steps, never with invented days.`
      : 'Timeframes: keep the template\'s panel labels (days or weeks) only if they make sense for this product; never invent a number.',
    "Color palette: the colors of the product's packaging, with the same contrast and hierarchy as the template.",
    'All visible text in Spanish, perfectly spelled, with accents. The product must look exactly like the attached product photo.',
  ].filter(Boolean);
  return {
    ad_info: { variation_id: id },
    global_identity: { color_palette: "the colors of the product's packaging", text_typography: 'the typography of the template' },
    visual_prompt: lineas.join('\n'),
    text_layers: [{ reference_function: 'main headline', reference_position: 'same place as the main headline of the template', text: titular, text_style: 'same style as the main headline of the template' }],
    mandatory_visual_elements: ['the real product from the attached product photo', "this product's angle shown in the template's visual mechanism"],
    final_generation_exclusions: ['any logo, brand name or text from the template', "the template's body area or problem when it is not this product's", 'prices, discounts or offers', 'misspelled words'],
    reference_structure_analysis: { forbidden_additions: ["the template's brand, prices or claims"], detected_visual_blocks: [] },
    language_rule: 'All visible text in Spanish.',
    app_rapido: 'plantilla',
    app_concepto: concepto ? { faceta: concepto.faceta, contexto: concepto.contexto } : { momento: MOMENTOS[i % MOMENTOS.length] },
  };
}

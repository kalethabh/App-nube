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
  const titulares = titularesDelLote(carpeta, brief, n);
  if (!titulares.length) return { ok: false, motivo: 'sin titulares' };

  const ficha = brief.productoId ? leerFicha(brief.productoId) || {} : {};
  const nombre = corto(brief.datos?.nombre || ficha.nombre || 'el producto', 80);
  const beneficios = (Array.isArray(ficha.beneficios) ? ficha.beneficios : []).map((b) => corto(b, 120)).filter(Boolean).slice(0, 6);
  const caracteristicas = (Array.isArray(ficha.ingredientes) ? ficha.ingredientes : []).map((x) => corto(x, 120)).filter(Boolean).slice(0, 6);
  // (producto.json y estrategia.json piden al menos 4 de cada una: se completan con lo genérico, solo para el archivo)
  const almenos4 = (lista, relleno) => [...lista, ...relleno].slice(0, Math.max(4, lista.length));
  const publico = corto(brief.datos?.publico || ficha.publico || '', 200);
  const pais = corto(brief.datos?.pais || ficha.pais || '', 60);
  const modo = brief.modo === 'variantes' ? 'copiar' : 'inspirar';
  const propias = new Set(brief.referenciasPropias || []);
  const { angulos } = leerSkill();
  const ids = idsDelLote(n);

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
      art_direction: modo === 'copiar' ? 'same design as the reference ad' : 'new composition inspired by the reference ad',
    },
    beneficios: almenos4(beneficios, ['Beneficio principal del producto', 'Fácil de usar', 'Calidad', 'Resultados visibles']),
    caracteristicas: almenos4(caracteristicas, ['Producto real de la foto', 'Empaque original', 'Uso diario', 'Envío a domicilio']),
  });
  guardarJSON(R.estrategia(carpeta), {
    resumen: `Modo rápido: ${n} ${modo === 'copiar' ? 'variaciones de lo que ya te funciona' : 'anuncios nuevos inspirados en anuncios validados'}, con un titular distinto en cada una.`,
    paleta: [{ hex: '#000000', nombre: 'la del empaque del producto' }, { hex: '#FFFFFF', nombre: 'la de cada referencia' }],
    tipografia: 'la de cada referencia',
    estilo: modo === 'copiar' ? 'el de cada referencia' : 'inspirado en cada referencia',
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
      concepto: modo === 'copiar' ? 'Variación del creativo que ya funciona' : 'Anuncio nuevo inspirado en un anuncio validado',
      titular: titulares[i].titulo,
      escena: modo === 'copiar' ? 'la de la referencia' : 'nueva, del mismo tipo que la referencia',
      camara: 'la de la referencia',
      base_titular: titulares[i].base,
    };
  });
  guardarJSON(R.plan(carpeta), { producto: nombre, lote: brief.slug || path.basename(carpeta), cantidad: n, proporciones: brief.formatos || ['1:1'], variaciones, rapido: true });

  variaciones.forEach((x, i) => {
    const k = (refs.indexOf(x.referencia) + 1) || 1;
    const deEsteProducto = modo === 'copiar' && propias.has(k);
    const visual = [
      `Product: ${nombre}${publico ? `, for ${publico}` : ''}${pais ? ` (market: ${pais})` : ''}.`,
      beneficios.length ? `Benefits to use in the secondary texts (Spanish, short): ${beneficios.join('; ')}.` : 'Secondary texts: short and about the main benefit of the product.',
      `Angle of this variation: ${x.angulo}.`,
      modo === 'copiar'
        ? deEsteProducto
          ? 'This reference is an ad of this same product: keep everything (also its colors); change only the texts.'
          : "Adapt the color palette to the product's packaging, keeping the same contrast and hierarchy as the reference."
        : 'Use a color palette that matches the product packaging. Make it look like a premium, scroll-stopping social media ad.',
      'All visible text in Spanish, perfectly spelled, with accents. The product must look exactly like the attached product photo.',
    ].join('\n');
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
    });
  });
  return { ok: true, referencias: refs.length, titulares: titulares.length, modo };
}

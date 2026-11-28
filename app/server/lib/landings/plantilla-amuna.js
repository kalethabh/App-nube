// CREAR UNA LANDING CON LA PLANTILLA AMUNA (2026-11-27f). Pedido: «esa plantilla… teniendo en cuenta cómo se están
// colocando los textos del Amuna, la posición, si sale una persona, con qué intención sale, los títulos, los testimonios,
// los textos, números, cifras, absolutamente todo… Así debemos hacer las landing con esa estructura… Las imágenes las
// genera GPT».
//
// La plantilla es de DATOS (plantillas/amuna: datos.js con el ejemplo AMUNA y la gris, guia.js con qué hace cada parte y
// las imágenes con su medida exacta, render.js arma la página). El equipo:
//   1. Emilio  · la estrategia (como en la de CEN)
//   2. Antonia · los colores del empaque (la letra es siempre Inter)
//   3. Valeria · TODOS los textos, con la guía y el ejemplo de AMUNA (mismo largo, misma intención)
//   4. Mateo   · un prompt por imagen (31), mirando la de AMUNA que le corresponde
//   5. Renata  · revisa textos y prompts (nada inventado, sin variables) y después la página terminada (capturas)
// Las imágenes: ChatGPT con la foto del producto y la referencia de AMUNA, recortadas a la medida exacta.
// La prueba social (decisión del usuario, «Reales + GPT»): testimonio, «Ellas cuentan», experiencias, reseñas, la nota y
// la cantidad salen SOLO de las reseñas reales que da el dueño; sin ellas, esas secciones no van. Las fotos de las
// secciones de historias son de estilo de vida (GPT) y sus títulos no dicen que son clientas.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { RAIZ } from '../rutas.js';
import { leerJSON } from '../archivos.js';
import { escribirJSON, leerFicha, listarProductos, rutaFoto } from '../productos.js';
import { modoPrueba } from '../procesos.js';
import { agente, disenoFinal, limpiarPrecios, limpiarResenas, RE_VARIABLE, RE_CIFRA_CLIENTES, ANTI_EFECTOS, colorDeBorde, contraste, mezclar, leible, esHex, lum, aHex, aRgb, cop } from './plantilla.js';
import { REALISMO, publicoVisual, personaDe, direccionPersona, consultaDe, slotsResenas, conFotosResenas,marcarRevisionImagenes,procesarImagenes } from './personas.js';
import { AMUNA } from './plantillas/amuna/datos.js';
import { GUIA, SLOTS } from './plantillas/amuna/guia.js';
import { htmlDeLanding } from './plantillas/amuna/render.js';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'plantillas', 'amuna');
export const PLANTILLA_AMUNA = 'amuna';
const rel = (carpeta, f) => path.relative(RAIZ, path.join(carpeta, f)).replace(/\\/g, '/');
const delRepo = (abs) => path.relative(RAIZ, abs).replace(/\\/g, '/');
const T = (x, n = 600) => (typeof x === 'string' ? x.trim().slice(0, n) : '');
const lista = (x) => (Array.isArray(x) ? x : []);

export const EQUIPO_AMUNA = [
  { id: 'estratega', nombre: 'Emilio', rol: 'Estratega (investigación)', archivo: 'estrategia.json' },
  { id: 'diseno', nombre: 'Antonia', rol: 'Diseñadora visual', archivo: 'diseno.json' },
  { id: 'copy', nombre: 'Valeria', rol: 'Copywriter', archivo: 'textos-nuevos.json' },
  { id: 'imagenes', nombre: 'Mateo', rol: 'Director de imágenes', archivo: 'imagenes-nuevas.json' },
  { id: 'revision', nombre: 'Renata', rol: 'Revisión', archivo: 'revision.json' },
  { id: 'visual', nombre: 'Renata', rol: 'Revisión visual', archivo: 'revision-visual.json' },
];
const Q = (id) => EQUIPO_AMUNA.find((q) => q.id === id);

// ---------------------------------------------------------------- los textos (lo que escribe Valeria)

/** El ejemplo de AMUNA solo con los textos (sin imágenes, precios, reseñas ni prueba social): el molde de Valeria. */
export function moldeDeTextos() {
  const A = AMUNA;
  return {
    producto: { nombre: A.producto.nombre, corto: A.producto.corto, marca: A.producto.marca, unidad: A.producto.unidad, unidades: A.producto.unidades },
    tituloPagina: `${A.producto.nombre} · Pide y paga al recibir`,
    descripcion: 'Gotas con ingredientes de origen vegetal para tu rutina diaria. Elige tu combo y paga al recibir.',
    titulo: A.titulo,
    oferta: { titulo: A.oferta.titulo, combos: { tres: { nombre: A.oferta.combos[0].nombre, insignia: A.oferta.combos[0].insignia }, dos: { nombre: A.oferta.combos[1].nombre }, uno: { nombre: A.oferta.combos[2].nombre } }, envio: A.oferta.envio, boton: A.oferta.boton, subBoton: A.oferta.subBoton },
    dudas: A.dudas,
    aviso: A.aviso,
    ellas: { titulo: A.ellas.titulo, sub: A.ellas.sub },
    historias: { usuario: A.historias.usuario, stickers: A.historias.stickers, titulo: 'Tu ritual con AMUNA', texto: 'Un momento para ti, todos los días, con tu rutina de gotas y a tu ritmo.', boton: A.historias.boton, nota: 'Fotos del día a día con Vitaldrops™.' },
    ruta: A.ruta,
    experiencias: { pill: A.experiencias.pill, titulo: A.experiencias.titulo },
    ugc: { titulo: 'Así se vive VitalDrops' },
    pasos: { titulo: A.pasos.titulo, sub: A.pasos.sub, items: A.pasos.items.map((x) => ({ titulo: x.titulo, texto: x.texto })) },
    franja: A.franja,
    comparacion: A.comparacion,
    compraClara: A.compraClara,
    cuidado: { titulo: A.cuidado.titulo, parrafos: A.cuidado.parrafos },
    resenas: { titulo: A.resenas.titulo },
    faq: A.faq,
    pie: { contacto: A.pie.contacto, enlaces: A.pie.enlaces, tienda: A.pie.tienda, correo: '', empresa: A.pie.empresa, pais: A.pie.pais, legal: A.pie.legal, copy: A.pie.copy },
  };
}

// lo que no puede faltar (ruta en el JSON -> cuántos, si es una lista)
const REQUERIDOS = [
  ['producto.nombre'], ['producto.unidad'], ['producto.unidades'], ['titulo.lede'], ['titulo.checks', 4], ['oferta.titulo'], ['oferta.combos.tres.nombre'], ['oferta.combos.tres.insignia'], ['oferta.combos.dos.nombre'], ['oferta.combos.uno.nombre'], ['oferta.envio.texto'], ['oferta.boton'],
  ['dudas', 4], ['aviso.titulo'], ['aviso.texto'], ['historias.titulo'], ['historias.texto'], ['historias.boton'], ['ruta.titulo'], ['ruta.pasos', 4], ['ugc.titulo'], ['pasos.titulo'], ['pasos.items', 3], ['franja', 3],
  ['comparacion.titulo'], ['comparacion.nuestra'], ['comparacion.filas', 6], ['compraClara.titulo'], ['compraClara.texto'], ['compraClara.boton'], ['compraClara.garantias', 3], ['cuidado.titulo'], ['cuidado.parrafos', 3], ['faq.titulo'], ['faq.items', 11], ['pie.legal', 2],
];
export const leerRuta = (o, ruta) => ruta.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
function ponerRuta(o, ruta, v) {
  const ks = ruta.split('.');
  let x = o;
  for (const k of ks.slice(0, -1)) {
    if (x[k] == null || typeof x[k] !== 'object') return false;
    x = x[k];
  }
  const u = ks[ks.length - 1];
  if (!(u in x) || typeof x[u] !== typeof v) return false;
  x[u] = v;
  return true;
}
/** Los textos que dejó la plantilla de ejemplo o de la gris (Producto X, TU MARCA, Nombre A.…), además de las variables. */
const RE_GRIS = /Producto X|TU MARCA|Tu Marca|\bNombre [A-Z]\b|correo@tutienda|N\.NNN|\bN testimonios|Título corto de la reseña/;
const conVariable = (t) => RE_VARIABLE.test(t) || RE_CIFRA_CLIENTES.test(t) || RE_GRIS.test(t);

// la marca del ejemplo (se permite solo si el producto es ese)
// (2026-11-27j) promesas de cura (la clase: «bienestar, nunca cura»; INVIMA y Meta)
export const RE_CURA = /\b(cura|curar|cur[oa]n|sana[rn]?|elimina(?:r)? (?:la|el|las|los) (?:diabetes|hipertensi[oó]n|enfermedad|c[aá]ncer|artritis)|trata(?:r|miento m[eé]dico) (?:la|el) (?:diabetes|hipertensi[oó]n|enfermedad)|adi[oó]s a la (?:diabetes|enfermedad)|reemplaza (?:tu|el) medicamento)\b/i;
const RE_EJEMPLO = /\bAMUNA\b|\bAMUA\b|vital ?drops|klickshoppe/i;
/** Qué le falta o qué está mal en los textos de Valeria (vacío = bien). */
export function erroresTextos(d, { nombre = '' } = {}) {
  const ejemplo = !RE_EJEMPLO.test(nombre);
  if (!d || typeof d !== 'object') return ['Escribe el JSON de textos completo, con el mismo formato del ejemplo.'];
  const e = [];
  for (const [r, n] of REQUERIDOS) {
    const v = leerRuta(d, r);
    // (2026-11-27h) «la misma estructura y cantidad de info»: exactamente los de AMUNA
    if (n ? !Array.isArray(v) || v.length !== n : !T(v)) e.push(n ? `«${r}»: deben ser exactamente ${n}, como en el ejemplo (hay ${Array.isArray(v) ? v.length : 0}).` : `Falta «${r}».`);
  }
  const malos = [];
  const ver = (x, ruta) => {
    if (typeof x === 'string') {
      if (conVariable(x) || (ejemplo && RE_EJEMPLO.test(x))) malos.push(`«${ruta}»: «${x.slice(0, 80)}»`);
    } else if (Array.isArray(x)) x.forEach((y, i) => ver(y, `${ruta}.${i}`));
    else if (x && typeof x === 'object') for (const [k, y] of Object.entries(x)) ver(y, ruta ? `${ruta}.${k}` : k);
  };
  // (2026-11-27j) bienestar, nunca curas
  const curas = [];
  const verCuras = (x, ruta) => {
    if (typeof x === 'string') {
      if (RE_CURA.test(x)) curas.push(`«${ruta}»: «${x.slice(0, 80)}»`);
    } else if (Array.isArray(x)) x.forEach((y, i) => verCuras(y, `${ruta}.${i}`));
    else if (x && typeof x === 'object') for (const [k, y] of Object.entries(x)) if (!['pie', 'cuidado', 'faq', 'resumen'].includes(k) || ruta) verCuras(y, ruta ? `${ruta}.${k}` : k);
  };
  verCuras(d, '');
  if (curas.length) e.push(`Bienestar, nunca curas ni enfermedades: ${curas.slice(0, 4).join('; ')}`);
  // (2026-11-27h) cada texto con el largo de su par en AMUNA (70 % a 135 % de las palabras; los de 6 palabras o más)
  const palabras = (t) => String(t).replace(/[*]/g, '').split(/\s+/).filter(Boolean).length;
  const largos = [];
  const comparar = (m, x, ruta) => {
    if (typeof m === 'string') {
      const a = palabras(m);
      if (a >= 6 && typeof x === 'string') {
        const b = palabras(x);
        if (b < a * 0.7 || b > a * 1.35) largos.push(`«${ruta}» tiene ${b} palabras y la de AMUNA ${a}`);
      }
    } else if (Array.isArray(m)) m.forEach((y, i) => comparar(y, Array.isArray(x) ? x[i] : undefined, `${ruta}.${i}`));
    else if (m && typeof m === 'object') for (const [k, y] of Object.entries(m)) if (!['producto', 'pie'].includes(k) || ruta) comparar(y, x?.[k], ruta ? `${ruta}.${k}` : k);
  };
  comparar(moldeDeTextos(), d, '');
  if (largos.length) e.push(`Cada texto con el largo del de AMUNA (± 30 %): ${largos.slice(0, 8).join('; ')}`);
  // (el resumen es para el dueño: puede nombrar la plantilla)
  for (const [k, y] of Object.entries(d)) if (k !== 'resumen') ver(y, k);
  if (malos.length) e.push(`Sin variables, cifras de clientas, textos de la plantilla ni la marca del ejemplo (AMUNA / VitalDrops): ${malos.slice(0, 6).join('; ')}`);
  if (!T(d.resumen)) e.push('Falta "resumen".');
  return e;
}

/** Quita lo que aún tenga una variable (una cadena vacía; de una lista, el elemento entero). */
export function sinVariables(x) {
  if (typeof x === 'string') return conVariable(x) ? '' : x;
  if (Array.isArray(x)) return x.filter((y) => !(typeof y === 'string' ? conVariable(y) : Array.isArray(y) ? y.some((z) => typeof z === 'string' && conVariable(z)) : false)).map(sinVariables);
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, sinVariables(v)]));
  return x;
}

// ---------------------------------------------------------------- los colores

/** Los colores de la landing a partir del color del empaque (el de los botones puede ser claro, como el amarillo de AMUNA). */
export function temaDe(dIA, kit) {
  const d = disenoFinal(dIA, kit);
  const base = esHex(dIA?.paleta?.accent) ? dIA.paleta.accent : esHex(kit?.primario) ? kit.primario : '#FECD4D';
  const tinta = contraste('#111111', base) >= 4.5 ? '#111111' : '#FFFFFF';
  const fondo = d.bg;
  return {
    diseno: d,
    tema: {
      amarillo: base, fuerte: leible(base, fondo, 3), suave: mezclar(base, '#ffffff', 0.85), borde: mezclar(base, '#ffffff', 0.55), estrella: d.star,
      sobre: tinta, tinta, pie: base, aviso: mezclar(base, '#ffffff', 0.93), foto: mezclar(base, '#ffffff', 0.9), sombra: `${base}47`,
      chip: leible(mezclar(base, '#000000', 0.45), mezclar(base, '#ffffff', 0.85), 4.5), fondo, fondo2: mezclar(fondo, '#2b3a67', 0.04),
    },
  };
}

// ---------------------------------------------------------------- las imágenes

// (2026-11-27g) solo los tamaños que ChatGPT hace de verdad (1:1 y 2:3): pedirle 9:16 hacía que se recortara un 15 % de
// cada lado y se cortaban textos y personas
export const RATIO_GPT = { '1:1': 1, '2:3': 2 / 3, '3:2': 3 / 2 };
export const aspectoGpt = (w, h) => (w / h < 0.85 ? '2:3' : w / h > 1.2 ? '3:2' : '1:1');

/**
 * La imagen a la medida exacta (JPG), SIN cortar contenido: una pieza con textos entra entera y se rellena con el color
 * del fondo de la página; una foto solo pierde el sobrante del borde (el prompt deja a la persona en el centro).
 */
async function aMedida(origen, destino, w, h, { pieza = false, fondo = '#ffffff' } = {}) {
  const { comprobarFfmpeg } = await import('../imagen-ads/local.js');
  const bin = (await comprobarFfmpeg())?.bin;
  if (!bin) throw new Error('No encuentro ffmpeg.');
  const r = w / h;
  const tmp = `${destino}.${process.pid}.tmp.jpg`;
  await new Promise((ok, mal) =>
    execFile(bin, ['-v', 'error', '-y', '-i', origen, '-frames:v', '1', '-vf', pieza ? `scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x${String(fondo).replace('#', '')}` : `crop='min(iw,ih*${r})':'min(ih,iw/${r})',scale=${w}:${h}:flags=lanczos`, '-q:v', '3', tmp], { timeout: 120000 }, (e) => (e ? mal(e) : ok()))
  );
  fs.renameSync(tmp, destino);
}

// (2026-11-27k) la imagen de «cuidado» sin profesional real: una consulta médica ILUSTRATIVA, sin el producto, sin nombre
// ni escarapela; la página pone debajo «Imagen ilustrativa. No representa una recomendación médica del producto».
export const CONSULTA =
  'Realistic, natural photo of a medical consultation in Colombia: a friendly, trustworthy Colombian doctor (a woman or a man, about 40) in a clean white coat, ' +
  'sitting at a desk and talking with a female patient in a bright, modern consulting room with soft window light. The doctor faces the camera at three quarters ' +
  'with a warm smile; the patient is seen from the side. Calm and professional mood. NO product, no bottles, no pills, no supplements anywhere, ' +
  'no name tag or readable badge, no text, no logos, no watermark. Keep the lower part of the photo simple and light (the web page fades it to white).';

/**
 * (2026-11-27i) ¿Algo de la pieza toca el borde de arriba o de abajo (un titular cortado)? Mira las filas de los bordes
 * contra el color del fondo pedido: si más del 12 % de una fila es otra cosa, está cortada.
 */
export async function tocaElBorde(ruta, fondo) {
  const N = 48;
  const px = await (await import('../imagen-ads/local.js')).pixeles(ruta, N, N);
  if (!px) return false;
  const bg = aRgb(fondo);
  const fila = (y) => {
    let otros = 0;
    for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      if ([0, 1, 2].some((c) => Math.abs(px[i + c] - bg[c]) > 45)) otros++;
    }
    return otros / N;
  };
  return fila(0) > 0.12 || fila(1) > 0.12 || fila(N - 1) > 0.12;
}

/** El prompt final de una imagen: el de Mateo + las reglas fijas (producto, referencia, fondo, sin efectos, medida). */
export function promptDeImagen(slot, base, { bg, accent, conFoto, persona = null, publico = '', conGuia = true }) {
  const pieza = slot.tipo === 'pieza';
  if (slot.tipo === 'consulta') return [base, REALISMO, ANTI_EFECTOS, `Final size ${slot.w}×${slot.h} px: keep both faces inside the central area, never near the edges.`].join('\n\n');
  const g = RATIO_GPT[aspectoGpt(slot.w, slot.h)];
  const r = slot.w / slot.h;
  // lo que se ve de la foto después de llevarla a su medida (de lado o de alto)
  const visible = r < g ? `the central ${Math.round((100 * r) / g)}% of the width` : r > g ? `the central ${Math.round((100 * g) / r)}% of the height` : 'the whole image';
  return [
    conGuia ? `${conFoto ? 'Reference image 1 is the REAL PRODUCT: show it exactly as it is (same packaging, label, colors and proportions); never redesign it. Reference image 2' : 'Reference image 1'} is ONLY a LAYOUT and STYLE guide from another brand: copy its composition, block layout, visual hierarchy and how it uses one brand color, but NEVER its brand, product, packaging, people, numbers or texts.` : (conFoto ? 'Reference image 1 is only the REAL PRODUCT. Preserve packaging, label, dimensions and colors exactly; never use it as a reference for a person or a face.' : 'Create an original scene following the product and audience brief.'),
    base,
    pieza
      ? `BACKGROUND: flat solid ${bg} from edge to edge (no gradient, no vignette, no frame), so it blends with the web page. Every text in Spanish (Colombia), perfectly spelled, large and readable on a phone; headlines in a heavy geometric sans serif (like Inter Black or Montserrat Black) in near-black, with the highlighted words in ${accent}. Never invent seals, guarantees, registrations, numbers of customers or ratings that are not in this prompt.`
      : slot.id.startsWith('combo-') ? `PRODUCT PHOTOGRAPHY: exactly ${slot.id.slice(-1)} identical units of the real product, credible scale and label, clean soft lighting on ${bg}. No people, hands, extra packages, text or testimonial elements.` : `HOMEMADE PHOTO: a casual phone photograph, natural light only, no studio retouching. ${persona || ''} ${direccionPersona({publico,escena:slot.tipo==='resena'?slot.que:slot.id.startsWith('paso-')?'Demonstrate this specific step of the approved mode of use, with credible hands and only label-supported actions':slot.id.startsWith('historia-') || slot.id.startsWith('ugc-')?'A natural moment in the actual product routine, in an appropriate everyday setting': 'Present the real product naturally to its intended adult audience',indice:slot.indiceVisual ?? slot.indiceResena ?? 0})}`,
    pieza ? `${REALISMO} Any person inside the design must match this audience: ${publico}. The reference's gender, body, clothes and setting do not define this product's audience. Do not depict a physical transformation as proof. Body areas, example timelines, sportswear and props in the layout reference are NOT product facts; adapt them to the approved copy and category.` : '',
    ANTI_EFECTOS,
    pieza
      ? `CANVAS: this image is generated as ${aspectoGpt(slot.w, slot.h)} (${aspectoGpt(slot.w, slot.h) === '2:3' ? '1024×1536' : aspectoGpt(slot.w, slot.h) === '3:2' ? '1536×1024' : '1024×1024'} px). Compose the WHOLE design for THIS canvas: the layout reference may be taller or wider, so shrink and rearrange its blocks until everything fits. Leave at least 8% EMPTY background at the top and at the bottom and 6% on each side: the headline must start well below the top edge and the last line must end well above the bottom edge. Nothing may touch or be cut by any edge.`
      : `Final size ${slot.w}×${slot.h} px: only ${visible} will be shown, so keep the whole head when visible, relevant hands and the product inside that central area, never near the edges.`,
  ].join('\n\n');
}

// ---------------------------------------------------------------- las reseñas reales

/** La prueba social, SOLO con las reseñas reales del dueño (ya limpias, con su foto en assets/ si la subió). */
export function pruebaSocialReal(reales, marca, fotoProducto = null) {
  if (!reales.length) return {};
  const n = reales.length;
  const prom = reales.reduce((a, r) => a + r.estrellas, 0) / n;
  const nota = (Math.round(prom * 10) / 10).toFixed(1).replace('.', ',');
  const conFoto = reales.filter((r) => r.foto);
  const notaFoto=r=>r.fotoNota?{fotoNota:r.fotoNota}:{};
  const barras = [5, 4, 3, 2, 1].map((e) => reales.filter((r) => r.estrellas === e).length);
  return {
    pruebaSocial: { avatares: conFoto.filter(r=>!r.fotoNota).slice(0, 4).map((r) => r.foto), texto: 'Opiniones de clientas', enlace: `${nota} de 5 · ${n} ${n === 1 ? 'opinión' : 'opiniones'}`, nota },
    testimonio: { nombre: reales[0].nombre, texto: reales[0].texto, estrellas: reales[0].estrellas, ...notaFoto(reales[0]), ...(reales[0].foto ? { foto: reales[0].foto } : {}) },
    // (2026-11-27h) con 1 sola reseña real ya salen todas las secciones de AMUNA: primero las que tienen foto; sin foto, la
    // del producto (nunca una persona inventada). Experiencias: las que no salieron en «Ellas cuentan» y, si no hay, las mismas
    ellasItems: [...conFoto, ...reales.filter((r) => !r.foto)].slice(0, 5).map((r) => ({ nombre: r.nombre, ciudad: r.ciudad, texto: r.texto, foto: r.foto || fotoProducto, ...notaFoto(r), estrellas: r.estrellas })).filter((x) => x.foto),
    experienciasItems: (() => {
      const orden = [...conFoto, ...reales.filter((r) => !r.foto)];
      const resto = orden.slice(5);
      return (resto.length ? resto : orden).slice(0, 3).map((r) => ({ nombre: r.nombre, texto: r.texto, foto: r.foto || fotoProducto, ...notaFoto(r), estrellas: r.estrellas })).filter((x) => x.foto);
    })(),
    resenas: {
      nota,
      cuantas: `${n} ${n === 1 ? 'opinión' : 'opiniones'} de clientas`,
      barras,
      fotos: conFoto.filter(r=>!r.fotoNota).map((r) => r.foto),
      items: reales.map((r) => ({ nombre: r.nombre, titulo: r.titulo, texto: r.texto, lugar: r.ciudad, ...notaFoto(r), estrellas: r.estrellas, ...(r.foto ? { foto: r.foto } : {}) })),
      tituloPorDefecto: `La comunidad ${marca} opina`,
    },
    pieCuidado: `${n} ${n === 1 ? 'testimonio compartido' : 'testimonios compartidos'} por nuestras clientas`,
  };
}

/** Los datos de la página: los textos + precios + imágenes + reseñas reales + colores. */
export function armarDatos({ textos, p, imagenes, reales, tema, fotoProducto, capturas = [], profesional = null, notaCuidado = null }) {
  const t = sinVariables(textos);
  const P = { ...t.producto };
  const img = (id) => imagenes[id] || (() => {
    const s = SLOTS.find((x) => x.id === id);
    return `gris:${s.w}x${s.h}:${s.que.split(/[.:]/)[0].slice(0, 60)}`;
  })();
  const n = { tres: 3, dos: 2, uno: 1 };
  const precio = { tres: p.tres, dos: p.dos, uno: p.uno };
  const combos = ['tres', 'dos', 'uno'].map((k) => {
    const c = t.oferta?.combos?.[k] || {};
    const antes = p.antes ? p.antes * n[k] : null;
    return { id: k, cantidad: n[k], precio: precio[k], antes: antes && antes > precio[k] ? antes : null, nombre: T(c.nombre, 160), ...(T(c.insignia) ? { insignia: T(c.insignia, 30) } : {}), foto: img(`combo-${n[k]}`) };
  });
  const social = pruebaSocialReal(reales, P.marca || P.corto || P.nombre, fotoProducto || imagenes['combo-1'] || null);
  const D = {
    tema,
    tituloPagina: T(t.tituloPagina, 120) || P.nombre,
    descripcion: T(t.descripcion, 200),
    producto: P,
    galeria: SLOTS.filter((s) => s.id.startsWith('galeria-')).map((s) => img(s.id)),
    ...(social.pruebaSocial ? { pruebaSocial: social.pruebaSocial } : {}),
    titulo: t.titulo,
    oferta: { titulo: t.oferta?.titulo, combos, elegido: 'tres', envio: t.oferta?.envio, boton: t.oferta?.boton, subBoton: t.oferta?.subBoton },
    ...(social.testimonio ? { testimonio: social.testimonio } : {}),
    dudas: t.dudas,
    aviso: t.aviso,
    creativo: img('creativo'),
    ellas: { titulo: t.ellas?.titulo, sub: t.ellas?.sub, items: social.ellasItems || [] },
    ingredientes: img('ingredientes'),
    historias: { ...t.historias, usuario: /^@[\w.]{2,30}$/.test(String(t.historias?.usuario || '')) ? t.historias.usuario : `@${String(P.marca || P.corto || P.nombre || 'tienda').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '').slice(0, 24)}`, fotos: [1, 2, 3, 4, 5, 6].map((k) => img(`historia-${k}`)) },
    ruta: t.ruta,
    experiencias: { pill: t.experiencias?.pill, titulo: t.experiencias?.titulo, fotoProducto: fotoProducto || img('combo-1'), precioDesde: p.uno, items: social.experienciasItems || [] },
    // (2026-11-27g) con capturas reales de clientas: ellas, tal cual y enteras («Experiencias con …»); sin: fotos caseras
    ugc: capturas.length ? { titulo: `Experiencias con ${P.corto || P.nombre}`, fotos: capturas, reales: true, estrellas: reales.length > 0 } : { titulo: t.ugc?.titulo, fotos: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => img(`ugc-${k}`)) },
    pasos: { titulo: t.pasos?.titulo, sub: t.pasos?.sub, items: lista(t.pasos?.items).slice(0, 3).map((x, k) => ({ ...x, foto: img(`paso-${k + 1}`) })) },
    franja: t.franja,
    comparacion: t.comparacion,
    compraClara: t.compraClara,
    // (2026-11-27k) el profesional real (con su placa) o la consulta ilustrativa con su nota
    cuidado: { titulo: t.cuidado?.titulo, parrafos: t.cuidado?.parrafos, ...(profesional ? { foto: profesional.foto, profesional: { nombre: profesional.nombre, especialidad: profesional.especialidad } } : { foto: img('cuidado'), nota: notaCuidado || 'Imagen ilustrativa. No representa una recomendación médica del producto.' }), ...(social.pieCuidado ? { pie: social.pieCuidado } : {}) },
    ...(social.resenas ? { resenas: { titulo: T(t.resenas?.titulo) || social.resenas.tituloPorDefecto, ...social.resenas } } : {}),
    faq: t.faq,
    pie: t.pie,
  };
  return D;
}

// ---------------------------------------------------------------- el equipo

/** -> { titulo, agentes, cambiados, diseno, fondo, resenas, imagenes } (como crearConEquipo). */
export async function crearConAmuna({ carpeta, productoId, pedido = '', motor, guardar, avanzar, precios = null, registro = '', resenas = [], capturasReales = [], profesional = null }) {
  // (2026-11-27k) el profesional de la salud REAL que autorizó al dueño (su foto ya está en assets/): va en «cuidado»
  const pro = profesional && /^assets\/profesional\.(jpg|png)$/.test(String(profesional.foto || '')) && T(profesional.nombre) && T(profesional.especialidad) ? { foto: profesional.foto, nombre: T(profesional.nombre, 60), especialidad: T(profesional.especialidad, 60) } : null;
  // (2026-11-27g) las capturas REALES de clientas (chats, mensajes) que subió el dueño: van tal cual en el carrusel
  const reales2 = (Array.isArray(capturasReales) ? capturasReales : []).filter((c) => /^assets\/[\w.-]+\.(jpg|jpeg|png|webp)$/i.test(String(c))).slice(0, 9);
  const reales = limpiarResenas(resenas);
  const slots = [...SLOTS.filter((s) => !(reales2.length && s.id.startsWith('ugc-')) && !(pro && s.id === 'cuidado')), ...slotsResenas(reales)].map((s,k)=>({...s,indiceVisual:k}));
  const p = limpiarPrecios(precios);
  if (!p) throw Object.assign(new Error('precios'), { publico: 'Pon los precios de tus combos (1, 2 y 3 unidades) para crear la landing.' });
  const prod = listarProductos().find((x) => x.id === productoId);
  const ficha = leerFicha(productoId) || {};
  let investigacion = '';
  try {
    investigacion = (await import('../investigacion.js')).aMarkdown(productoId) || '';
  } catch {
    /* sin investigación */
  }
  fs.mkdirSync(path.join(carpeta, 'assets'), { recursive: true });
  const foto = rutaFoto(productoId, 1);
  let fotoProducto = null;
  if (foto) {
    fotoProducto = `assets/producto${path.extname(foto) || '.png'}`;
    fs.copyFileSync(foto, path.join(carpeta, fotoProducto));
  }
  const agentes = EQUIPO_AMUNA.map((q) => ({ id: q.id, nombre: q.nombre, rol: q.rol, estado: 'esperando', resumen: null }));
  const marcar = (id, cambios) => {
    Object.assign(agentes.find((a) => a.id === id), cambios);
    guardar({ agentes: agentes.map((a) => ({ ...a })) });
  };
  guardar({ agentes, plantilla: PLANTILLA_AMUNA });
  const reg = String(registro || '').trim().slice(0, 60);
  // (2026-11-27j) la promesa de los anuncios del producto (el tiempo y los deseos de sus ajustes de imágenes)
  let anuncios = '';
  try {
    const a = (await import('../imagen-ads/ajustes-producto.js')).ajustesDe(productoId) || {};
    anuncios = [a.tiempo && `tiempo: ${a.tiempo}`, a.deseo_principal && `deseo principal: ${a.deseo_principal}`, a.deseo_central && `deseo central: ${a.deseo_central}`, a.promesa && `promesa: ${a.promesa}`].filter(Boolean).join(' · ');
  } catch {
    /* sin ajustes */
  }
  const producto = `PLANTILLA AMUNA.\nSu producto: ${prod?.nombre || productoId}\nFicha: ${JSON.stringify(ficha).slice(0, 6000)}`;
  const datosTxt = `
PRECIOS DEL DUEÑO (la app los pone en la página): 1 unidad ${cop(p.uno)}, 2 unidades ${cop(p.dos)}, 3 unidades ${cop(p.tres)}${p.antes ? `; precio normal de 1 unidad ${cop(p.antes)}` : ''}.
${reg ? `REGISTRO SANITARIO: ${reg}.` : 'Sin registro sanitario: no menciones INVIMA ni registros en ningún texto ni imagen.'}
${reales.length ? `El dueño dio ${reales.length} reseña(s) REAL(ES): la app las pone tal cual (testimonio, «Ellas cuentan», reseñas, la nota y la cantidad). Tú no escribes reseñas.` : 'El dueño no dio reseñas reales: la página va sin testimonios, sin reseñas y sin cifras de clientas.'}
Nunca inventes testimonios, opiniones, nombres de clientas o de médicos, cifras de clientas, calificaciones, estudios ni garantías que la tienda no tenga. Sin variables: todo terminado.${pedido ? `\nLO QUE PIDE EL DUEÑO (manda sobre lo demás):\n${pedido}` : ''}`;

  // 1. Emilio
  marcar('estratega', { estado: 'trabajando' });
  const estrategia = await agente({
    carpeta, motor, quien: Q('estratega'), avanzar,
    valida: (d) => d && T(d.resumen) && T(d.angulo) && T(d.promesa),
    prompt: `${producto}\n${investigacion ? `Su investigación de mercado:\n${investigacion.slice(0, 16000)}\n` : 'Este producto NO tiene investigación de mercado todavía: trabaja con la ficha y dilo en el resumen.\n'}${datosTxt}
Lee la investigación como un estratega de respuesta directa y decide la estrategia de la landing. Escribe ${rel(carpeta, Q('estratega').archivo)}:
{ "avatar": "quién compra (edad, momento de vida, situación)", "dolor_principal": "", "deseo": "", "angulo": "", "mecanismo": "por qué funciona, simple y verdadero", "promesa": "la promesa principal con su tiempo, sin exagerar", "tiempo": "el tiempo de transformación del tratamiento", "objeciones": [""], "palabras_del_cliente": [""], "tono": "", "resumen": "" }
En suplementos, bienestar y nunca cura.${anuncios ? `\nLa promesa de los anuncios de este producto (sus ajustes): ${anuncios}` : ''}`,
  });
  marcar('estratega', { estado: 'listo', resumen: T(estrategia.resumen, 800) });
  const publico=publicoVisual({estrategia,ficha,producto:prod?.nombre || productoId,pedido});
  const consulta=consultaDe(publico,ficha);
  const persona=Object.fromEntries(slots.filter(s=>['foto','resena'].includes(s.tipo) && !s.id.startsWith('combo-')).map((s,k)=>[s.id,personaDe(k,publico)]));

  // 2. Antonia: solo los colores
  let kit = null;
  try {
    kit = await (await import('../imagen-ads/plantillas.js')).kitDe(productoId);
  } catch {
    /* sin kit */
  }
  marcar('diseno', { estado: 'trabajando' });
  const disenoIA = await agente({
    carpeta, motor, quien: Q('diseno'), avanzar, leer: foto ? [foto] : [],
    valida: (d) => d && T(d.resumen) && d.paleta && typeof d.paleta === 'object',
    prompt: `${producto}\n${kit ? `El kit de marca (de su empaque): ${JSON.stringify(kit)}\n` : ''}${foto ? `La foto del producto: ${delRepo(foto)} (ábrela con Read).\n` : ''}
La landing usa la plantilla AMUNA: fondo claro y limpio, UN color de marca para los botones, los sellos, los resaltados y el pie (en AMUNA, el amarillo #FECD4D), texto casi negro y la letra Inter (ya está puesta: no la elijas). Elige ese color del empaque. Escribe ${rel(carpeta, Q('diseno').archivo)}:
{ "paleta": { "accent": "#hex (el color de la marca, como en el empaque)", "bg": "#hex (fondo de la página y de las imágenes: blanco o un tono muy claro)", "star": "#hex (estrellas)" }, "resumen": "" }`,
  });
  const { diseno, tema } = temaDe(disenoIA, kit);
  marcar('diseno', { estado: 'listo', resumen: T(disenoIA.resumen, 800) });

  // 3 y 4 a la vez: Valeria (textos) y Mateo (imágenes)
  const comun = `${producto}\nLa estrategia de Emilio:\n${JSON.stringify(estrategia).slice(0, 5000)}\n${datosTxt}\n${GUIA}`;
  const molde = moldeDeTextos();
  marcar('copy', { estado: 'trabajando' });
  marcar('imagenes', { estado: 'trabajando' });
  const refs = Object.fromEntries(slots.map((s) => [s.id, path.join(DIR, 'referencias', `${s.id}.jpg`)]));
  const [copy, imgs] = await Promise.all([
    agente({
      carpeta, motor, quien: Q('copy'), avanzar, maxTurnos: 16,
      valida: (d) => erroresTextos(d, { nombre: prod?.nombre || '' }).length === 0,
      errores: (d) => erroresTextos(d, { nombre: prod?.nombre || '' }),
      prompt: `${comun}
Escribe TODOS los textos de la landing de este producto con la estructura de AMUNA: el MISMO formato JSON del ejemplo de abajo, las mismas claves y la misma cantidad de elementos, cada texto del mismo largo (± 15 % de palabras) y con la MISMA intención que el de AMUNA (lee la guía de arriba), pero para este producto, su avatar y su estrategia. Usa las palabras del cliente de la investigación. *asteriscos* = la palabra resaltada en el color; **dos** = negrita.
- producto: el nombre real (con ™ si lo usa), un nombre corto, la marca, y cómo se llama una unidad (frasco, tarro, caja…) en singular y plural.
- historias y ugc: títulos que hablan del ritual o del día a día, NUNCA de clientas. historias.usuario: el @ de la marca en Instagram (inventa uno simple con el nombre de la marca si no está en la ficha); historias.stickers: 6 frases cortas (2 a 5 palabras) de la marca, como stickers de una historia de Instagram (sin citas de clientas ni resultados).
- comparacion.nuestra: el nombre corto del producto (máximo 12 letras: va en una columna angosta).
- pie.correo: solo si está en la ficha; si no, "".
- Nada de reseñas, testimonios, nombres de clientas, cifras de clientas, calificaciones ni porcentajes.
Escribe ${rel(carpeta, Q('copy').archivo)} con ese JSON y "resumen".
<<<EJEMPLO
${JSON.stringify(molde, null, 1)}
EJEMPLO>>>`,
    }).then((d) => {
      marcar('copy', { estado: 'listo', resumen: T(d.resumen, 800) });
      return d;
    }),
    agente({
      carpeta, motor, quien: Q('imagenes'), avanzar, maxTurnos: 30, leer: [...Object.values(refs).filter(r=>fs.existsSync(r)), ...(foto ? [foto] : [])],
      valida: (d) => d && T(d.resumen) && slots.filter((s) => !['consulta','resena'].includes(s.tipo)).every((s) => lista(d.imagenes).some((x) => x?.slot === s.id && T(x.prompt))),
      errores: (d) => slots.filter((s) => !['consulta','resena'].includes(s.tipo) && !lista(d?.imagenes).some((x) => x?.slot === s.id && T(x.prompt))).map((s) => `Falta el prompt de «${s.id}».`),
      prompt: `${comun}
Colores: el de la marca ${tema.amarillo}, el fondo de la página ${tema.fondo}, texto casi negro.
${foto ? `La foto del producto: ${delRepo(foto)} (ábrela con Read).` : ''}
Escribe el prompt de CADA imagen de la landing. Cada una tiene su referencia de AMUNA (ábrela con Read: mira su composición, sus bloques, sus textos, la persona y con qué intención sale) y su medida exacta. La de este producto es una TRADUCCIÓN de esa imagen: la misma composición e intención, con el producto real, su avatar de la investigación (edad, género, entorno y mercado del producto), su promesa y su tiempo, y sus textos en español (los de las piezas, escritos completos entre comillas, cortos y grandes). Nunca copies la marca, el frasco, las personas ni los textos de AMUNA.
DIRECCIÓN DE PERSONAS (manda sobre el género y la ropa del ejemplo AMUNA): ${publico}. Las fotos son naturales, distintas y acordes al mensaje de cada sección. Los combos son fotos de producto SIN personas. ${REALISMO}
${slots.filter((s) => !['consulta','resena'].includes(s.tipo)).map((s) => `SLOT ${s.id} · ${s.w}×${s.h} px · ${s.tipo === 'pieza' ? 'pieza gráfica con textos' : 'foto casera sin textos'} · referencia ${delRepo(refs[s.id])}\n  ${s.que}${persona[s.id] ? `\n  Persona y escena: ${persona[s.id]}` : ''}`).join('\n')}
Escribe ${rel(carpeta, Q('imagenes').archivo)}: { "imagenes": [ { "slot": "<id>", "prompt": "<en inglés, detallado; los textos que van dentro, en español y entre comillas>" } ], "resumen": "" }`,
    }).then((d) => {
      marcar('imagenes', { estado: 'listo', resumen: T(d.resumen, 800) });
      return d;
    }),
  ]);

  // 5. Renata: los textos y los prompts
  marcar('revision', { estado: 'trabajando' });
  const textos = JSON.parse(JSON.stringify(copy));
  const revision = await agente({
    carpeta, motor, quien: Q('revision'), avanzar,
    valida: (d) => d && T(d.resumen) && (d.cambios === undefined || typeof d.cambios === 'object'),
    prompt: `${producto}\n${investigacion ? `La investigación:\n${investigacion.slice(0, 6000)}\n` : ''}La estrategia:\n${JSON.stringify(estrategia).slice(0, 3000)}\n${datosTxt}
Los textos de la landing (JSON):
${JSON.stringify(textos, null, 1).slice(0, 24000)}
Los prompts de las imágenes:
${JSON.stringify(imgs.imagenes || []).slice(0, 12000)}

Revisa todo como la última persona antes de publicar: nada inventado (cifras, estudios, testimonios, nombres, calificaciones, registros, garantías que la tienda no tenga), sin promesas médicas ni de curar, coherente con el producto y sus precios, sin variables, la ortografía, y que cada texto cumpla la intención de su sección según la guía:
${GUIA.slice(0, 6000)}
Escribe ${rel(carpeta, Q('revision').archivo)}:
{ "cambios": { "<ruta en el JSON, p. ej. titulo.lede o faq.items.3.1>": "<texto corregido>" }, "imagenes": [ { "slot": "<id>", "prompt": "<prompt corregido>" } ], "pendientes": ["lo que el dueño debe revisar él mismo"], "resumen": "" }`,
  });
  let cambiados = 0;
  for (const [r, v] of Object.entries(revision.cambios || {})) if (typeof v === 'string' && ponerRuta(textos, r, v.trim())) cambiados++;
  const pendientes = lista(revision.pendientes).map((x) => T(x, 300)).filter(Boolean).slice(0, 10);
  marcar('revision', { estado: 'listo', resumen: T(revision.resumen, 800), pendientes });

  // las imágenes: ChatGPT con la foto del producto y la referencia de AMUNA, a la medida exacta
  const corregidos = new Map(lista(revision.imagenes).map((x) => [String(x?.slot), T(x?.prompt, 4000)]));
  const prompts = new Map(lista(imgs.imagenes).map((x) => [String(x?.slot), corregidos.get(String(x?.slot)) || T(x?.prompt, 4000)]));
  const imagenes = {};
  const enviados = [];
  const bordes = [];
  let hechas = 0;
  const estados=slots.map(s=>({id:s.id,estado:'en-cola',tipo:s.tipo}));
  const actualizar=(id,c)=>{Object.assign(estados.find(s=>s.id===id),c);guardar({imagenesEstado:estados.map(s=>({...s}))});};
  guardar({imagenesEstado:estados});
  avanzar(`ChatGPT está haciendo ${slots.length} imágenes con tu producto, 3 a la vez (cada una con la medida de la plantilla)…`);
  const { motorDeImagenes, codexParaImagenes } = await import('../motor-imagenes.js');
  const codex = modoPrueba() ? null : motorDeImagenes() === 'chatgpt' ? codexParaImagenes() : null;
  if (!modoPrueba() && !codex) avanzar('Las imágenes se hacen con tu ChatGPT: conéctalo en Ajustes › Conexiones (quedaron los recuadros grises con su medida).');
  const hacer = async (s) => {
    const base = s.tipo === 'consulta' ? consulta.prompt : s.tipo === 'resena' ? direccionPersona({publico,escena:s.que,indice:s.indiceResena+20}) : prompts.get(s.id);
    if (!base || (!modoPrueba() && !codex)){actualizar(s.id,{estado:'error',error:!base?'Falta la dirección de esta imagen.':'Conecta ChatGPT para generar esta imagen.'});return;}
    actualizar(s.id,{estado:'generando'});
    const seccion=s.id.startsWith('paso-')?textos.pasos:s.id.startsWith('historia-')?textos.historias:s.id==='cuidado'?textos.cuidado:s.id.startsWith('resena-')?{uso:ficha.modo_de_uso || ficha.uso}:s.id==='galeria-08'?textos.comparacion:{producto:textos.producto,propuesta:textos.titulo};
    const mensaje=`${base}\n\nAPPROVED SECTION COPY (use as source of truth; never invent a stronger claim): ${JSON.stringify(seccion).slice(0,2500)}`;
    const prompt = promptDeImagen(s, mensaje, { bg: tema.fondo, accent: tema.fuerte, conFoto: Boolean(foto) && s.tipo !== 'consulta', persona: persona[s.id] || null, publico, conGuia:s.tipo === 'pieza' });
    // (la consulta médica: sin el producto ni referencia: nada que la vuelva un aval)
    const referencias = s.tipo === 'consulta' ? [] : [...(foto ? [foto] : []), ...(s.tipo === 'pieza'?[refs[s.id]]:[])].filter((r) => r && fs.existsSync(r));
    const archivo = `assets/${s.id}-${crypto.randomBytes(3).toString('hex')}.jpg`;
    const crudo = path.join(carpeta, '_crudo', `${s.id}.png`);
    try {
      fs.mkdirSync(path.dirname(crudo), { recursive: true });
      if (modoPrueba()) {
        if (!foto) return;
        fs.copyFileSync(foto, crudo);
      } else {
        const { generarConChatGPT } = await import('../../../../produccion/chatgpt-imagen.js');
        await generarConChatGPT({ prompt, referencias, aspecto: aspectoGpt(s.w, s.h), rutaDestino: crudo, codex });
        // (2026-11-27i) una pieza con algo pegado al borde (un titular cortado): se rehace una vez, más chica
        if (s.tipo === 'pieza' && (await tocaElBorde(crudo, tema.fondo))) {
          avanzar(`La imagen ${s.id} salió cortada en el borde: la rehago con más margen.`);
          await generarConChatGPT({ prompt: `${prompt}\n\nIMPORTANT: a previous attempt had the headline or the last line cut off by the edge of the canvas. Make every block about 15% smaller and keep a clearly empty background band at the top and at the bottom.`, referencias, aspecto: aspectoGpt(s.w, s.h), rutaDestino: crudo, codex });
        }
      }
      await aMedida(crudo, path.join(carpeta, archivo), s.w, s.h, { pieza: s.tipo === 'pieza', fondo: tema.fondo });
      imagenes[s.id] = archivo;
      enviados.push({ slot: s.id, w: s.w, h: s.h, archivo, prompt, aspecto: aspectoGpt(s.w, s.h), referencias: referencias.map(delRepo) });
      if (s.tipo === 'pieza') bordes.push(await colorDeBorde(path.join(carpeta, archivo)));
      hechas++;
      actualizar(s.id,{estado:'lista',archivo});
      avanzar(`Imagen ${hechas} de ${slots.length} lista (${s.id}).`);
    } catch (e) {
      actualizar(s.id,{estado:'error',error:String(e?.message || e).slice(0,160)});
      avanzar(`La imagen ${s.id} no salió (${String(e?.message || e).slice(0, 100)}): queda el recuadro gris con su medida.`);
    } finally {
      fs.rmSync(crudo, { force: true });
    }
  };
  // (2026-11-27g) «lo más rápido posible»: 3 imágenes a la vez
  await procesarImagenes(slots,hacer);
  fs.rmSync(path.join(carpeta, '_crudo'), { recursive: true, force: true });

  // el fondo de la página = el que quedó en los bordes de las piezas (si es claro y el texto se lee)
  const fondo = { pedido: tema.fondo, medido: null, usado: tema.fondo };
  // (2026-11-27g) solo si es casi el pedido (un borde que mezcla foto y fondo no tiñe la página)
  const cerca = (c) => aRgb(c).every((v, i) => Math.abs(v - aRgb(tema.fondo)[i]) <= 24);
  const claros = bordes.filter((c) => c && lum(c) > 0.7 && contraste('#111111', c) >= 7 && cerca(c));
  if (claros.length) {
    fondo.medido = aHex([0, 1, 2].map((i) => claros.map((c) => aRgb(c)[i]).sort((a, b) => a - b)[Math.floor(claros.length / 2)]));
    fondo.usado = fondo.medido;
    tema.fondo = fondo.medido;
    tema.fondo2 = mezclar(fondo.medido, '#2b3a67', 0.04);
  }

  // armar la página
  let D = armarDatos({ textos, p, imagenes, reales:conFotosResenas(reales,imagenes), tema, fotoProducto, capturas: reales2, profesional: pro, notaCuidado:consulta.nota });
  const escribir = () => fs.writeFileSync(path.join(carpeta, 'index.html'), htmlDeLanding(D));
  escribirJSON(path.join(carpeta, 'datos-landing.json'), D);
  escribir();

  // 6. Renata mira la página terminada contra la de AMUNA
  let capturas = [];
  try {
    const { capturarSecciones } = await import('./capturas.js');
    capturas = (await capturarSecciones({ id: path.basename(carpeta), carpeta }))?.capturas || [];
  } catch {
    capturas = [];
  }
  const base = fs.existsSync(path.join(DIR, 'capturas')) ? fs.readdirSync(path.join(DIR, 'capturas')).filter((f) => /\.(png|webp)$/.test(f)).map((f) => path.join(DIR, 'capturas', f)) : [];
  if (!capturas.length) {
    marcar('visual', { estado: 'listo', resumen: 'No pude tomar las capturas de la página (sin navegador): la revisión visual se saltó.' });
  } else {
    marcar('visual', { estado: 'trabajando' });
    const nuevas = capturas.map((c) => path.join(carpeta, c.archivo));
    try {
      const visual = await agente({
        carpeta, motor, quien: Q('visual'), avanzar, leer: [...base, ...nuevas], maxTurnos: 16,
        valida: (d) => d && T(d.resumen) && (d.cambios === undefined || typeof d.cambios === 'object'),
        prompt: `${producto}\n${datosTxt}
Las capturas de AMUNA, una por sección (nombre del archivo = sección): ${base.map(delRepo).join(', ')}
Las capturas de la landing TERMINADA, en orden: ${nuevas.map(delRepo).join(', ')}
Ábrelas con Read y compara sección por sección: ¿tiene la misma estructura e intención que la de AMUNA, se lee bien, el fondo de las imágenes se funde con la página, no hay recuadros grises (imágenes que no salieron), efectos recargados, textos cortados, nada inventado ni variables?
Revisa también el realismo de las personas (piel, manos, dientes, anatomía, escala), que sean acordes al público y al mensaje, que no se repitan todas las caras y que el empaque no haya cambiado. Las opiniones deben conservar su texto real y las fotos generadas su nota ilustrativa. No inventes problemas que no puedas ver.
Mapa de imágenes generadas: ${enviados.map(i=>`${i.slot}: ${i.archivo}`).join(', ')}.
${base.length?'Las capturas base están disponibles para comparar.':'No hay capturas base disponibles: evalúa la nueva página con la guía, sin afirmar una comparación visual que no hiciste.'}
Los textos (JSON): ${JSON.stringify(textos).slice(0, 16000)}
Escribe ${rel(carpeta, Q('visual').archivo)}: { "cambios": { "<ruta en el JSON>": "<texto corregido>" }, "problemas": ["lo que viste y no se arregla con texto"], "imagenes_con_problemas": [{ "slot": "<id del mapa>", "motivo": "defecto visible o discordancia" }], "resumen": "" }`,
      });
      marcarRevisionImagenes(estados,visual.imagenes_con_problemas);guardar({imagenesEstado:estados.map(s=>({...s}))});
      let n2 = 0;
      for (const [r, v] of Object.entries(visual.cambios || {})) if (typeof v === 'string' && ponerRuta(textos, r, v.trim())) n2++;
      if (n2) {
        D = armarDatos({ textos, p, imagenes, reales:conFotosResenas(reales,imagenes), tema, fotoProducto, capturas: reales2, profesional: pro, notaCuidado:consulta.nota });
        escribirJSON(path.join(carpeta, 'datos-landing.json'), D);
        escribir();
        avanzar(`Renata corrigió ${n2} texto(s) al ver la página terminada.`);
      }
      cambiados += n2;
      marcar('visual', { estado: 'listo', resumen: T(visual.resumen, 800), pendientes: lista(visual.problemas).map((x) => T(x, 300)).filter(Boolean).slice(0, 8) });
    } catch (e) {
      marcar('visual', { estado: 'listo', resumen: `La revisión visual no terminó (${String(e?.publico || e?.message || e).slice(0, 120)}): la landing quedó como la dejó la revisión de textos.` });
    }
  }
  if (modoPrueba()) {
    escribirJSON(path.join(carpeta, 'prueba-imagenes.json'), enviados);
    escribirJSON(path.join(carpeta, 'prueba-fondo.json'), fondo);
  }
  escribirJSON(path.join(carpeta,'imagenes-estado.json'),estados);
  const faltan = slots.length - hechas;
  if (faltan) avanzar(`${faltan} imagen(es) quedaron como recuadro gris con su medida: vuelve a crear la landing cuando ChatGPT esté conectado.`);
  return { titulo: D.tituloPagina, agentes, cambiados, diseno, fondo, resenas: reales.length, imagenes: { hechas, pedidas: slots.length, quitadas: 0, faltantes:estados.filter(s=>s.estado!=='lista').map(s=>s.id) }, capturas: reales2.length };
}

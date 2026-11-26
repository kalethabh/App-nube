// LO DE VENTA DE CADA PRODUCTO PARA SUS ANUNCIOS DE IMAGEN (2026-11-26a). Pedido: «campos nuevos en el formulario
// (opcionales, se guardan por producto para no repetirlos): Oferta, Sellos de confianza, País, Prohibido decir».
// Viven en temp/_productos/<id>/anuncios-imagen.json, como el kit de marca (plantillas.js).
//
//   { oferta: 'Tratamiento completo x3 $139.900', sellos: ['REGISTRO SANITARIO INVIMA RSA-…', 'Pago contra entrega'],
//     pais: 'CO', prohibido: ['cura', 'milagroso'],
//     cuerpo: { zonas: ['glúteos', 'piernas'], resultado: 'glúteo redondo y levantado…' } }   (2026-11-26e)
import path from 'node:path';
import { leerJSON } from '../archivos.js';
import { PRODUCTOS, idValido } from '../productos.js';
import { guardarJSON } from './disco.js';
import { paisDe, normalizarOferta } from './precios.js';

const ruta = (id) => path.join(PRODUCTOS, id, 'anuncios-imagen.json');
const lista = (x, max, largo) =>
  (Array.isArray(x) ? x : String(x || '').split(/\r?\n/))
    .map((s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, largo))
    .filter(Boolean)
    .filter((s, i, a) => a.indexOf(s) === i)
    .slice(0, max);

// (2026-11-26e) LAS ZONAS DEL CUERPO que mejora un producto (para que la imagen muestre SU resultado, no la zona de la
// referencia), con cómo las nombra el prompt en inglés y si van con jean o leggins (decisión del usuario: siempre con ropa).
export const ZONAS_CUERPO = {
  'glúteos': { en: /glute|butt\b|buttock|booty|derri[eè]re|bum\b|hips?\b|gl[uú]teo/i, ropa: true },
  piernas: { en: /\blegs?\b|thighs?|calves|calf\b|pierna|muslo/i, ropa: true },
  caderas: { en: /\bhips?\b|cadera/i, ropa: true },
  cintura: { en: /waist|waistline|cintura/i, ropa: true },
  abdomen: { en: /belly|tummy|abdomen|stomach|waist|vientre|barriga/i, ropa: true },
  brazos: { en: /\barms?\b|upper arm|brazo/i, ropa: false },
  cara: { en: /\bface\b|facial|jaw|cheek|cara|rostro/i, ropa: false },
  piel: { en: /\bskin\b|piel/i, ropa: false },
  cabello: { en: /\bhair\b|cabello|pelo/i, ropa: false },
  busto: { en: /bust|chest|breast|busto/i, ropa: true },
};
const normalZona = (z) => String(z || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
/** 'Glúteos', 'gluteos', 'cola'… -> la clave de ZONAS_CUERPO, o null. */
export function zonaDe(z) {
  const n = normalZona(z);
  if (!n) return null;
  for (const k of Object.keys(ZONAS_CUERPO)) if (normalZona(k) === n || normalZona(k).startsWith(n) || n.startsWith(normalZona(k).slice(0, 5))) return k;
  if (/cola|nalga|trasero|pompa/.test(n)) return 'glúteos';
  if (/muslo/.test(n)) return 'piernas';
  if (/vientre|barriga|panza/.test(n)) return 'abdomen';
  return null;
}
/** { zonas: [claves], resultado } o null. */
export function limpiarCuerpo(c) {
  if (!c || typeof c !== 'object') return null;
  const zonas = [...new Set((Array.isArray(c.zonas) ? c.zonas : String(c.zonas || '').split(/[,\n]/)).map(zonaDe).filter(Boolean))].slice(0, 3);
  const resultado = String(c.resultado || '').replace(/\s+/g, ' ').trim().slice(0, 240);
  return zonas.length ? { zonas, ...(resultado ? { resultado } : {}) } : null;
}

/**
 * (2026-11-26e) Los sellos van letra por letra en la imagen: si el usuario escribió una INSTRUCCIÓN («Agregar logo y
 * sello de registro INVIMA RSA-…»), se queda solo el texto que va en la imagen («REGISTRO INVIMA RSA-…»). Nunca logo.
 */
export function selloLimpio(s) {
  const original = String(s || '').replace(/\s+/g, ' ').trim();
  let t = original
    .replace(/^(por favor,?\s+)?(agregar|agrega|agregue|añadir|añade|añada|poner|pon|ponga|incluir|incluye|incluya|colocar|coloca|coloque|usar|usa|mostrar|muestra|escribir|escribe)\b[:\s]*/i, '')
    .replace(/\b(el |la |mi |nuestro |nuestra )?logo(tipo)?\b( de la marca)?\s*(y|e|,|\+)?\s*/gi, '')
    .replace(/^(el |la |un |una )?(sello|texto|leyenda)( de| del)?\s+/i, '')
    .replace(/^[\s,.:;+-]+|[\s,.:;+-]+$/g, '');
  if (!t || /^(sello|logo|texto)s?$/i.test(t)) return '';
  // si era una instrucción, el texto va como sello (en mayúsculas)
  return t !== original ? t.toUpperCase() : t;
}

/** Lo de venta limpio: la oferta con el separador del país, los sellos (sin instrucciones), uno por línea, y el cuerpo. */
export function limpiarAjustes(a = {}) {
  const pais = paisDe(a.pais) || null;
  const oferta = String(a.oferta || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  const cuerpo = limpiarCuerpo(a.cuerpo);
  // (2026-11-26f) el tiempo de transformación del producto («Tratamiento de 3 meses · se nota desde la semana 4»)
  const tiempo = String(a.tiempo || '').replace(/\s+/g, ' ').trim().slice(0, 140);
  return {
    oferta: oferta ? normalizarOferta(oferta, pais || 'CO') : '',
    sellos: lista(lista(a.sellos, 6, 120).map(selloLimpio), 6, 120),
    pais,
    prohibido: lista(Array.isArray(a.prohibido) ? a.prohibido : String(a.prohibido || '').split(/[,\n]/), 30, 60),
    ...(cuerpo ? { cuerpo } : {}),
    ...(tiempo ? { tiempo } : {}),
  };
}

export function ajustesDe(productoId) {
  if (!idValido(productoId)) return limpiarAjustes({});
  return limpiarAjustes(leerJSON(ruta(productoId)) || {});
}

export function guardarAjustes(productoId, a) {
  const limpio = limpiarAjustes(a);
  if (idValido(productoId)) guardarJSON(ruta(productoId), { ...limpio, fecha: new Date().toISOString() });
  return limpio;
}

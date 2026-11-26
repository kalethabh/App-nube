// LO DE VENTA DE CADA PRODUCTO PARA SUS ANUNCIOS DE IMAGEN (2026-11-26a). Pedido: «campos nuevos en el formulario
// (opcionales, se guardan por producto para no repetirlos): Oferta, Sellos de confianza, País, Prohibido decir».
// Viven en temp/_productos/<id>/anuncios-imagen.json, como el kit de marca (plantillas.js).
//
//   { oferta: 'Tratamiento completo x3 $139.900', sellos: ['REGISTRO SANITARIO INVIMA RSA-…', 'Pago contra entrega'],
//     pais: 'CO', prohibido: ['cura', 'milagroso'] }
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

/** Lo de venta limpio: la oferta con el separador del país, los sellos tal cual (uno por línea). */
export function limpiarAjustes(a = {}) {
  const pais = paisDe(a.pais) || null;
  const oferta = String(a.oferta || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  return {
    oferta: oferta ? normalizarOferta(oferta, pais || 'CO') : '',
    sellos: lista(a.sellos, 6, 120),
    pais,
    prohibido: lista(Array.isArray(a.prohibido) ? a.prohibido : String(a.prohibido || '').split(/[,\n]/), 30, 60),
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

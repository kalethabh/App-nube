// EL AUDITOR DE LA CLASE «CADA PÁGINA ES UNA LANDING» (Joaquín Buelvas), 2026-11-27j. Los 6 pilares y sus 18 puntos,
// revisados con los datos de la página (sin IA): un porcentaje y por dónde empezar. Lo que depende de material real (las
// capturas y las reseñas) baja la nota cuando falta y dice qué subir: nunca se inventa.
import { ORDEN_SCROLL } from './render.js';
import { TIEMPO } from '../../../imagen-ads/titulares.js';

const lista = (x) => (Array.isArray(x) ? x : []);
const esGris = (x) => /^gris:/.test(String(x || ''));
const RE_CURA = /\b(cura|curar|cur[oa]n|sana[rn]?|enfermedad(es)?)\b/i;

/** -> { porcentaje, pilares: [{ nombre, puntos: [{ texto, ok, falta? }], cumple, total }], empezarPor } */
export function auditarLanding(D) {
  const secciones = ORDEN_SCROLL.filter((k) => hay(D, k));
  const pos = (k) => secciones.indexOf(k);
  const social = ['testimonio-destacado', 'ellas-cuentan', 'experiencias', 'resenas'].filter((k) => hay(D, k));
  const reales = lista(D.resenas?.items);
  const textos = JSON.stringify({ t: D.titulo, d: D.dolor, du: D.dudas, r: D.ruta, p: D.pasos, cc: D.compraClara, c: D.comparacion });
  const imagenes = [...lista(D.galeria), D.creativo, D.ingredientes, ...lista(D.historias?.fotos), ...lista(D.ugc?.fotos), ...lista(D.pasos?.items).map((x) => x.foto), D.cuidado?.foto].filter(Boolean);
  const grises = imagenes.filter(esGris).length;
  const P = (texto, ok, falta) => ({ texto, ok: Boolean(ok), ...(ok ? {} : { falta }) });
  const pilares = [
    { nombre: 'Copy de respuesta directa', puntos: [
      P('El titular habla del resultado, no del producto', D.titulo?.titular && TIEMPO.test(D.titulo.titular), 'El titular debe ser beneficio + tiempo + deseo.'),
      P('Hay un bloque de dolor con frases de clientes', lista(D.dolor?.frases).length >= 3, 'Falta el bloque «¿Te pasa esto?» con 3 frases.'),
      P('Ninguna frase promete curar una enfermedad', !RE_CURA.test(textos), 'Quita las promesas de cura: bienestar y experiencia.'),
    ] },
    { nombre: 'Prueba social auténtica', puntos: [
      P('Capturas reales de WhatsApp o comentarios', D.ugc?.reales, 'Sube capturas reales de chats o comentarios de tus clientas.'),
      P('Citas con nombre, ciudad y un detalle concreto', reales.length && reales.every((r) => r.nombre && r.lugar), 'Pega reseñas reales con nombre y ciudad.'),
      P('Sin logos ni sellos sin contexto', true),
    ] },
    { nombre: 'Above the fold', puntos: [
      P('Titular de resultado visible sin bajar', D.titulo?.titular && pos('titulo-y-beneficios') <= 2, 'El titular de resultado va justo después de la galería.'),
      P('Subtítulo que dice para quién es', /^para\b/i.test(String(D.titulo?.subtitulo || '').trim()), 'Agrega el subtítulo «Para …».'),
      P('Prueba social y botón claro en la primera pantalla', D.pruebaSocial && D.titulo?.boton, D.titulo?.boton ? 'Con reseñas reales sale la prueba social junto al titular.' : 'Falta el botón «Pedir ahora · pago al recibir».'),
    ] },
    { nombre: 'Historia visual', puntos: [
      P('Beneficios, ingredientes y garantía no dependen del carrusel', D.creativo && D.ingredientes && D.compraClara, 'Faltan imágenes apiladas de beneficios o ingredientes.'),
      P('Las imágenes de venta están apiladas a lo largo del scroll', hay(D, 'creativo') && hay(D, 'ingredientes') && hay(D, 'pasos'), 'Apila las imágenes de venta en el scroll.'),
      P('Ninguna imagen quedó sin hacer', !grises, `${grises} imagen(es) quedaron como recuadro gris: vuelve a crearla con ChatGPT conectado.`),
    ] },
    { nombre: 'Navegación simplificada', puntos: [
      P('No hay menú con categorías ni blog', true),
      P('No hay «otros productos» ni ventanas emergentes', !lista(D.avisosCompra).length),
      P('La única salida es el botón de pedido', true),
    ] },
    { nombre: 'Arquitectura del scroll', puntos: [
      P('La prueba social está en medio, no solo al final', social.length && social.every((k) => pos(k) > pos('titulo-y-beneficios') && pos(k) < pos('oferta')), 'Con reseñas reales, los testimonios salen en medio del scroll.'),
      P('Los combos aparecen después de beneficios y pruebas', pos('oferta') > pos('creativo') && pos('oferta') > Math.max(-1, ...social.map(pos)), 'Los combos van después de beneficios y pruebas.'),
      P('Pago al recibir, envío y garantía están antes del formulario', hay(D, 'compra-clara') && hay(D, 'aviso-pedido'), 'Falta la parte de pago al recibir y envío.'),
    ] },
  ].map((p) => ({ ...p, cumple: p.puntos.filter((x) => x.ok).length, total: p.puntos.length }));
  const total = pilares.reduce((a, p) => a + p.total, 0);
  const ok = pilares.reduce((a, p) => a + p.cumple, 0);
  const peor = [...pilares].sort((a, b) => a.cumple / a.total - b.cumple / b.total)[0];
  return { porcentaje: Math.round((100 * ok) / total), pilares, empezarPor: peor.cumple < peor.total ? peor.nombre : null };
}

/** ¿La página tiene esa sección (con contenido)? */
function hay(D, k) {
  switch (k) {
    case 'prueba-social': return Boolean(D.pruebaSocial);
    case 'dolor': return lista(D.dolor?.frases).length > 0;
    case 'testimonio-destacado': return Boolean(D.testimonio);
    case 'ellas-cuentan': return lista(D.ellas?.items).length > 0;
    case 'historias': return lista(D.historias?.fotos).length > 0;
    case 'experiencias': return lista(D.experiencias?.items).length > 0;
    case 'experiencias-fotos': return lista(D.ugc?.fotos).length > 0;
    case 'resenas': return lista(D.resenas?.items).length > 0;
    case 'creativo': return Boolean(D.creativo);
    case 'ingredientes': return Boolean(D.ingredientes);
    case 'ruta': return lista(D.ruta?.pasos).length > 0;
    case 'pasos': return lista(D.pasos?.items).length > 0;
    case 'franja': return lista(D.franja).length > 0;
    case 'comparacion': return lista(D.comparacion?.filas).length > 0;
    case 'compra-clara': return Boolean(D.compraClara);
    case 'cuidado': return Boolean(D.cuidado);
    case 'dudas-rapidas': return lista(D.dudas).length > 0;
    case 'aviso-pedido': return Boolean(D.aviso);
    case 'preguntas-frecuentes': return lista(D.faq?.items).length > 0;
    default: return true;
  }
}

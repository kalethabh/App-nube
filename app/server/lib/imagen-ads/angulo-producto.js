// EL ÁNGULO DEL PRODUCTO para las plantillas de imagen (2026-11-18t). Pedido: «si la plantilla es un antes y después
// de hinchazón en las piernas y el producto nuevo es para aumentar caderas, glúteos y piernas, debe verse así como lo
// plasma la plantilla; lo mismo con día 1, día 14, día 30; si sale una persona, debe verse el ángulo; buenos textos y
// bien plasmado lo de Andromeda».
//
// La plantilla pone la FORMA (antes y después, días, una persona, comparación…); el producto pone el ÁNGULO (la zona
// del cuerpo, el problema, el resultado) y cada imagen un CONCEPTO de Andromeda (a quién le habla, qué problema muestra
// y en qué momento: el creativo es la segmentación). Esto junta lo que sabe la app del producto:
//
//   contextoCreativo(productoId) -> {
//     deseo, dolor, publico, avatar, pais,            (de la investigación; si no hay, de la ficha)
//     resultados: [texto], beneficios: [texto],
//     tiempos: [{ que, cuando }], notaTiempos,         (los tiempos de transformación y su advertencia)
//     conceptos: [{ faceta, problema, contexto, escenario, dolor, hook, titular }],   (matriz de Andromeda, o los textos de anuncios)
//   }
import path from 'node:path';
import { leerJSON } from '../archivos.js';
import { PRODUCTOS, idValido, leerFicha } from '../productos.js';

const limpio = (t, max = 300) =>
  String(t ?? '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
const norm = (t) =>
  limpio(t, 200)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const seccion = (inv, inicio) => (inv?.secciones || []).find((s) => norm(s.titulo).startsWith(norm(inicio)));
const bloques = (s) => (Array.isArray(s?.bloques) ? s.bloques : []);

/** Las filas de una tabla como objetos, con las columnas que contienen cada palabra (sin tildes ni mayúsculas). */
function filasDe(tabla, claves) {
  const cols = (tabla.columnas || []).map(norm);
  const idx = Object.fromEntries(Object.entries(claves).map(([k, palabras]) => [k, cols.findIndex((c) => palabras.some((p) => c.includes(p)))]));
  return (tabla.filas || []).map((f) => Object.fromEntries(Object.entries(idx).map(([k, i]) => [k, i >= 0 ? limpio(f[i], 200) : ''])));
}

function tablaCon(inv, palabras) {
  for (const s of inv?.secciones || []) for (const b of bloques(s)) if (b.tipo === 'tabla' && palabras.every((p) => (b.columnas || []).some((c) => norm(c).includes(p)))) return b;
  return null;
}

export function contextoCreativo(productoId) {
  const ficha = (idValido(productoId) && leerFicha(productoId)) || {};
  const inv = idValido(productoId) ? leerJSON(path.join(PRODUCTOS, productoId, 'investigacion', 'investigacion.json')) : null;
  const lista = (v) => (Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : []).map((x) => limpio(x, 160)).filter(Boolean);

  // el deseo central (la cita de «Deseo central…») y los resultados deseados
  const deseoSec = bloques(seccion(inv, 'Deseo central'));
  const deseo = limpio(deseoSec.find((b) => b.tipo === 'cita')?.texto || '', 300);
  const resultados = bloques(seccion(inv, 'Los 5 resultados'))
    .flatMap((b) => (Array.isArray(b.items) ? b.items : []))
    .map((x) => limpio(String(x).split(/\.\s/)[0], 140))
    .filter(Boolean)
    .slice(0, 5);

  // los tiempos de transformación (qué se nota y cuándo) y su advertencia para los anuncios
  const tablaTiempos = bloques(seccion(inv, 'Tiempos de transformacion')).find((b) => b.tipo === 'tabla');
  const tiempos = tablaTiempos ? filasDe(tablaTiempos, { que: ['que notan', 'que', 'resultado'], cuando: ['cuando', 'tiempo'] }).filter((t) => t.que && t.cuando).slice(0, 6) : [];
  const notaTiempos = limpio(tablaTiempos?.nota || '', 300);

  // el avatar (la caja «avatar» de «Avatar principal»)
  const caja = bloques(seccion(inv, 'Avatar principal')).find((b) => b.tipo === 'caja');
  const avatar = caja ? limpio(`${caja.titulo || ''}. ${caja.texto || ''}`, 300) : '';

  // Andromeda: la matriz de conceptos (15.4) con el escenario y el dolor de cada faceta (15.2)
  const facetas = tablaCon(inv, ['faceta', 'escenario']);
  const porFaceta = new Map((facetas ? filasDe(facetas, { faceta: ['faceta'], dolor: ['dolor'], escenario: ['escenario'], persona: ['persona'] }) : []).map((f) => [norm(f.faceta), f]));
  const matriz = tablaCon(inv, ['faceta', 'hook']);
  let conceptos = matriz
    ? filasDe(matriz, { faceta: ['faceta'], problema: ['problema'], contexto: ['contexto', 'momento'], hook: ['hook', 'gancho'] })
        .filter((c) => c.faceta)
        .map((c) => {
          const f = porFaceta.get(norm(c.faceta)) || [...porFaceta.values()].find((x) => norm(x.faceta).includes(norm(c.faceta)) || norm(c.faceta).includes(norm(x.faceta)));
          return { ...c, escenario: f?.escenario || '', dolor: f?.dolor || '', persona: f?.persona || '', titular: '' };
        })
    : [];
  // los textos de anuncios de la investigación (cada uno de un concepto): su titular (con las correcciones del usuario)
  const anuncios = (Array.isArray(inv?.anuncios_imagen) ? inv.anuncios_imagen : []).filter((a) => a && typeof a === 'object');
  const titularDe = (a) => limpio(a?.textos?.titular || a?.textos?.pregunta || '', 90);
  if (conceptos.length) {
    conceptos.forEach((c, i) => {
      const a = anuncios.find((x) => Number(x.concepto) === i + 1) || anuncios.find((x) => norm(x.faceta) === norm(c.faceta));
      if (a) c.titular = titularDe(a);
    });
  } else {
    conceptos = anuncios
      .map((a) => ({ faceta: limpio(a.faceta, 80), problema: limpio(a.angulo, 40), contexto: limpio(a.contexto, 80), hook: '', escenario: '', dolor: '', persona: '', titular: titularDe(a) }))
      .filter((c) => c.faceta || c.titular);
  }

  return {
    deseo,
    dolor: limpio(ficha.dolor, 300),
    publico: limpio(ficha.publico, 240),
    avatar,
    pais: limpio(inv?.pais || ficha.pais || '', 60),
    resultados,
    beneficios: lista(ficha.beneficios).slice(0, 6),
    tiempos,
    notaTiempos,
    conceptos: conceptos.slice(0, 12),
  };
}

// Si el producto no tiene investigación con Andromeda: momentos distintos (siempre los mismos para todo producto), para
// que cada imagen igual le hable a otra situación y no sean variaciones de lo mismo.
export const MOMENTOS = [
  'getting dressed in the morning, in front of the mirror at home',
  'trying on clothes in a fitting room',
  'getting ready for a December family gathering',
  'packing for a beach trip',
  'arriving home tired after work, in the evening',
  'taking a photo with friends on the weekend',
  'on payday, choosing something for themselves',
  'a quiet moment alone, looking at an old photo of themselves',
];

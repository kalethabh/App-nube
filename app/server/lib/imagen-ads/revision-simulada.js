// La revision de las imagenes en MODO PRUEBA (ESPECIFICACION-imagen-ads.md §13): sin Claude y siempre igual, para
// probar los caminos de la revision sin gastar el plan de nadie. Va con modoPrueba() y sin ANUNCIOS_REVISION_REAL=1,
// el mismo criterio de la revision de las imagenes de los videos (voz-en-off.js).
//
// Todo al primer intento (2026-11-09): no hay ronda 2 automatica; lo que falla queda «con detalles» con su nota.
//   pieza      ronda 1   queda
//   V02_1x1    falla     con-detalles ("Revísala")
//   V03_1x1    falla     con-detalles
//   V02_9x16   falla     con-detalles (el vertical se hace igual desde su cuadrado)
//   lo demas y la ronda 'u' (lo que pidio el usuario: Regenerar): pasa -> listo
import { modoPrueba } from '../procesos.js';

export const PROBLEMA_DE_PRUEBA = '(prueba) el titular tiene una letra cambiada';
/** La correccion en ingles que acompaña al problema (va con «otra version» si el usuario la pide). */
export const CORRECCION_DE_PRUEBA = '(test) Write the headline exactly as written in the text list, letter by letter.';

/** ¿La revision va simulada? (modo prueba sin ANUNCIOS_REVISION_REAL=1) */
export const revisionSimulada = () => modoPrueba() && process.env.ANUNCIOS_REVISION_REAL !== '1';

const FALLAN = { V02_1x1: [1], V03_1x1: [1], V02_9x16: [1] };

/** Lo que "ve" la revision simulada de una pieza en su ronda: { pieza, ok, problemas }. */
export function revisarSimulada(pieza, ronda) {
  const falla = ronda !== 'u' && (FALLAN[pieza] || []).includes(Number(ronda));
  return { pieza, ok: !falla, problemas: falla ? [PROBLEMA_DE_PRUEBA] : [], ...(falla ? { correccion_en: CORRECCION_DE_PRUEBA } : {}) };
}

/** El R###.json de una tanda simulada: { revisadas: [...] }. */
export const revisionDeLaTanda = (piezas) => ({ revisadas: piezas.map((x) => revisarSimulada(x.pieza, x.ronda)), simulada: true });

// Que B-roll entran en el video: la regla del motor, la misma con la que el montaje reparte cada frase entre su toma
// y su B-roll (produccion/planear-montaje.js: brollQueEntran, ventanasDeLaVoz). Con la voz ya hecha, generar-imagenes
// y generar-videos no piden (ni pagan) el B-roll que no entra; la app usa la misma regla para contar las piezas, para
// lo que se ve de la produccion, el editor y el informe, y para su paso "ventanas" (familias/voz-en-off.js).
//
// Solo se sabe con la voz (o la cancion) de ESTE guion: audio/tiempos.json, y en voz en off tambien audio/voz.mp3.
// Antes de eso, y donde la regla no decide (los hablados, el objeto parlante y el UGC, donde el lugar del B-roll
// depende del clip ya generado; la continuidad, que no lleva), cuentan todos, igual que los pide el motor.
//
//   brollDe(carpeta, manifiesto)   -> { aplica, entra(n), fuera: [{ n, toma, porque, razon }] }
//   ventanasDeLaVoz(m, tiempos)    -> la del motor (lanza un error si el motor no se pudo cargar)
//
// SOLO LECTURA: la regla mira el manifiesto y los tiempos; nunca escribe nada.

let motor = null;
try {
  // Las funciones puras del motor (no hablan con nadie ni cobran). Si no cargan, la app abre igual: cuenta todo.
  motor = await import('../../../produccion/planear-montaje.js');
} catch (e) {
  console.error('[broll] No pude cargar la regla del motor (produccion/planear-montaje.js): se cuentan todos los B-roll.', e?.message || e);
}

const TODOS = Object.freeze({ aplica: false, entra: () => true, fuera: [] });

/**
 * Que B-roll del manifiesto entran en el video con la voz de la carpeta. `entra(n)` es true para todos mientras la
 * regla no decide (sin voz todavia, o un estilo donde no aplica). `fuera` trae los que no entran, con la razon.
 */
export function brollDe(carpeta, manifiesto) {
  if (!motor?.brollQueEntranEnCarpeta || !manifiesto || typeof manifiesto !== 'object') return TODOS;
  let r;
  try {
    r = motor.brollQueEntranEnCarpeta(manifiesto, carpeta);
  } catch {
    return TODOS;
  }
  if (!r?.aplica || !Array.isArray(r.fuera)) return TODOS;
  const fuera = new Set(r.fuera.map((f) => f.n));
  return {
    aplica: true,
    entra: (n) => !fuera.has(n),
    fuera: r.fuera.map((f) => ({ n: f.n, toma: f.toma, porque: f.porque, razon: f.razon })),
  };
}

/** Las ventanas de la voz, como las arma el montaje (la funcion del motor). */
export function ventanasDeLaVoz(manifiesto, tiempos) {
  if (!motor?.ventanasDeLaVoz) throw new Error('No pude cargar la regla del montaje (produccion/planear-montaje.js).');
  return motor.ventanasDeLaVoz(manifiesto, tiempos);
}

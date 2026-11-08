// DATOS DE EJEMPLO que quedan: solo los de la SIMULACIÓN de la pantalla de producción, que se abre a
// propósito con ?simular=1 sobre un anuncio ya terminado (Vista previa del diseño). El tablero, el menú y
// la producción de verdad salen de los conductor.json reales: aquí ya no hay nada de eso.

/**
 * Lo que abre la simulación con ?simular=1&decision=<tipo> (#/anuncio/:slug/produccion):
 *   revision -> la revisión de clips con todos los clips ya llegados (estilos hablados)
 *   cancion  -> elegir entre las dos versiones reales de la canción (cantados): solo esperan las imágenes
 *   toma     -> una toma que llegó con un defecto que no se arregló solo: se abre su panel para decidir
 */
export const decisionesProduccion = {
  cancion: {
    titulo: 'Ese lunes',
    versiones: [
      { archivo: 'cancion/opcion-1.mp3', detalle: 'Balada pop latina: guitarra y piano, un coro grande' },
      { archivo: 'cancion/opcion-2.mp3', detalle: 'Pop acústico: más íntima, el coro crece de a poco' },
    ],
  },
  toma: {
    pieza: 'img:toma-7-inicial',
    problema: 'la mano salió con los dedos raros',
  },
};

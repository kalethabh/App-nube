// La duración de un anuncio en la pantalla. Lo que se entiende de lo que escribe el usuario ("35 s", "1 minuto",
// "2 minutos") es exactamente lo que entiende el servidor: viene de server/lib/duracion.js, sin copias.
//
// En el formulario (ajuste.duracion): null = la decide la IA (lo recomendado); un texto = lo que escribió el usuario,
// que es aproximado.
import { entenderDuracion } from '../../server/lib/duracion.js';

export { conDuracion, entenderDuracion, duracionAprox, duracionCorta, leerDuracion } from '../../server/lib/duracion.js';

/** ajuste.duracion -> { decide: 'ia' } | { decide: 'usuario', texto, segundos } | { decide: 'usuario', texto, segundos: null, motivo } */
export function duracionDeAjuste(valor) {
  if (valor === null || valor === undefined) return { decide: 'ia' };
  const texto = typeof valor === 'number' ? `${valor} s` : String(valor);
  const r = entenderDuracion(texto);
  return r.ok ? { decide: 'usuario', texto: texto.trim(), segundos: r.segundos } : { decide: 'usuario', texto, segundos: null, motivo: r.motivo };
}

// La produccion de una HISTORIA MUSICAL (4 a 10+ minutos cantados de principio a fin sobre animacion 3D estilo
// Pixar, una toma por linea de la letra), paso por paso.
//
// Son los mismos pasos que el musical (musical.js, pasosCantados), con tres diferencias que salen de la skill
// anuncios-historias-musicales y de COMO-PRODUCIR seccion 9:
//   - la letra la escribio la IA en el guion, con sus dos estilos y, si es larga, partida en bloques
//     (cancion/peticion.json; la sesion de guion de anuncios-nuevos.js la revisa): aca se vuelve a revisar
//     (tildes, "duration" nunca) y se valida con el motor (generar-cancion --solo-plan, gratis);
//   - Suno da 4 versiones (2 por estilo) y, si la letra iba en bloques, --elegir la extiende sola;
//   - los clips van mudos (clips_mudos: true): no hay voces coladas que buscar. Sin B-roll, sin musica, sin
//     transiciones; los textos en pantalla van en datos-editor.md (el informe los lista para agregarlos al montar).
import { existe } from '../archivos.js';
import { pasosCantados, ARRANCA_SIN_MANIFIESTO as SIN_MANIFIESTO, PASO_PAUSA as PAUSA, RUTAS } from './musical.js';

export const FAMILIA = 'historia-musical';
export const ESTILOS = ['historias-musicales'];
/** El guion aprobado es la letra: el manifiesto se escribe en la produccion, despues de elegir la cancion. */
export const ARRANCA_SIN_MANIFIESTO = SIN_MANIFIESTO;
export const FASE_GUION = 'letras';
/** El paso donde la produccion espera al usuario (conductor "pausado" con este paso). */
export const PASO_PAUSA = PAUSA;

export const PASOS = pasosCantados({ historia: true });

/** Las sesiones de la IA son las del musical (§3.1 del diseño): con un ctx de historia, arman las de la historia. */
export { armarSesionLetra, armarSesionTomas, armarSesionRevisionLote } from './musical.js';

/**
 * Lo que tiene que estar para poder arrancar la produccion (en vez del manifiesto, que todavia no existe): null si
 * esta todo, o lo que falta en palabras simples. Para iniciarProduccion (conductor.js).
 */
export function faltaParaProducir(carpeta) {
  if (!existe(RUTAS.guion(carpeta))) return 'El guion todavía no está listo.';
  if (!existe(RUTAS.peticion(carpeta))) return 'Falta la letra de la canción.';
  return null;
}

// Fotogramas de los subestilos como referencia del generador de imagenes
// (2026-11-07).
//
// Cada subestilo trae 12 fotogramas de un anuncio real que vende
// (.claude/skills/<skill>/subestilos/<id>/ref-NN.jpg) y su version sin texto
// (limpio/ref-NN.jpg, la deja produccion/limpiar-fotogramas.py). Una toma, su
// frame final, un B-roll o una hoja pueden pedir que su fotograma vaya
// ADJUNTO al generador, junto con el prompt:
//
//   "fotograma":       ".claude/skills/anuncios-estilo-pixar/subestilos/glow-up-senal-dorada/ref-03.jpg"
//   "fotograma_final": "...ref-04.jpg"            (solo tomas B: el frame final)
//
// Se escribe la ruta del fotograma de siempre; el motor manda SIEMPRE la
// version de limpio/ (sin subtitulos), y nunca la original. Va como la ULTIMA
// imagen de referencia, y al prompt se le agrega la nota de que de ahi solo se
// toma el encuadre, la pose, la luz y la calidad: ni texto, ni marcas, ni el
// producto, ni la cara de nadie.
//
// No cambia el tiempo de produccion: es una imagen chica mas, que se sube una
// sola vez (kie-client guarda la URL) y en paralelo con lo demas. Tampoco
// cambia el costo: las referencias no se cobran.

import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './config.js';

export const NOTA_FOTOGRAMA =
  'The LAST attached reference image is only a composition and quality guide taken from another ad: ' +
  'match its camera angle, shot size, framing, pose and body language, lighting direction and color, color palette, ' +
  'set dressing and render quality as closely as possible. Do NOT copy anything else from it: no text, captions, ' +
  'numbers, logos, labels, brand names, packaging or product, and not the face or identity of its people or characters ' +
  '(any smudged or blurred patch in it is removed text: ignore it). The characters and the product come ONLY from the ' +
  'other reference images and this prompt.';

/** La ruta del fotograma sin texto (limpio/) para el que pide el manifiesto. */
export function rutaLimpia(valor) {
  if (typeof valor !== 'string' || !valor.trim()) return null;
  const abs = path.resolve(RAIZ, valor.trim());
  if (path.basename(path.dirname(abs)) === 'limpio') return abs;
  return path.join(path.dirname(abs), 'limpio', path.basename(abs));
}

/** null si esta bien; si no, el motivo (para el validador y el motor). */
export function problemaConFotograma(valor) {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string' || !valor.trim()) return 'tiene que ser la ruta de un fotograma (ref-NN.jpg) de un subestilo';
  const abs = path.resolve(RAIZ, valor.trim());
  const skills = path.join(RAIZ, '.claude', 'skills');
  const rel = path.relative(skills, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel) || !rel.split(path.sep).includes('subestilos')) {
    return `tiene que ser un fotograma de .claude/skills/<skill>/subestilos/ (dice ${valor})`;
  }
  const limpio = rutaLimpia(valor);
  if (!fs.existsSync(limpio)) {
    return fs.existsSync(abs)
      ? `falta su version sin texto (${path.relative(RAIZ, limpio)}). Corre: python3 produccion/limpiar-fotogramas.py`
      : `no existe ${valor}`;
  }
  return null;
}

/** El prompt con la nota del fotograma, si el trabajo lleva uno. */
export const promptConFotograma = (prompt, fotograma) => (fotograma ? `${prompt}\n\n${NOTA_FOTOGRAMA}` : prompt);

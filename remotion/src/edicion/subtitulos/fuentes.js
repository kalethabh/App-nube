// Fuentes de los estilos de subtítulos y de los textos en pantalla. Van DENTRO del proyecto (archivos/,
// sin internet) y son las MISMAS en la vista previa del editor y en el video exportado: la composición
// AnuncioEditado las registra con nombres propios ("Edicion ..."), así no depende de que la interfaz de la
// app haya cargado las suyas ni de lo que tenga instalado cada PC.
//   - "Arial Black": la del render de siempre (estilo Caja), igual que remotion/src/Anuncio.jsx.
//   - Bricolage Grotesque e Inter (licencia OFL, archivos/LICENCIA-*.txt), en latín y latín extendido:
//     normal, angosta (eje de ancho de Bricolage) y cursiva (Inter).
//
// Un import de .woff2 da su URL tanto en Vite (la app) como en el webpack de Remotion (el render).
import titulo from './archivos/bricolage-grotesque-latin-wght-normal.woff2';
import tituloExt from './archivos/bricolage-grotesque-latin-ext-wght-normal.woff2';
import angosta from './archivos/bricolage-grotesque-latin-wdth-normal.woff2';
import angostaExt from './archivos/bricolage-grotesque-latin-ext-wdth-normal.woff2';
import texto from './archivos/inter-latin-wght-normal.woff2';
import textoExt from './archivos/inter-latin-ext-wght-normal.woff2';
import cursiva from './archivos/inter-latin-wght-italic.woff2';
import cursivaExt from './archivos/inter-latin-ext-wght-italic.woff2';

export const FUENTES = {
  caja: '"Arial Black", "Arial Bold", Gadget, sans-serif',
  titulo: '"Edicion Titulo", "Bricolage Grotesque Variable", "Arial Black", sans-serif',
  angosta: '"Edicion Angosta", "Bricolage Grotesque Variable", Impact, sans-serif',
  ui: '"Edicion Texto", "Inter Variable", "Segoe UI", Arial, sans-serif',
  cursiva: '"Edicion Cursiva", "Inter Variable", "Segoe UI", Arial, sans-serif',
  emoji: '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
};

const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1E00-1E9F, U+20A0-20AB, U+20AD-20C0, U+2C60-2C7F, U+A720-A7FF';

const CARAS = [
  ['Edicion Titulo', titulo, { weight: '200 800', unicodeRange: LATIN }],
  ['Edicion Titulo', tituloExt, { weight: '200 800', unicodeRange: LATIN_EXT }],
  ['Edicion Angosta', angosta, { weight: '200 800', stretch: '75% 100%', unicodeRange: LATIN }],
  ['Edicion Angosta', angostaExt, { weight: '200 800', stretch: '75% 100%', unicodeRange: LATIN_EXT }],
  ['Edicion Texto', texto, { weight: '100 900', unicodeRange: LATIN }],
  ['Edicion Texto', textoExt, { weight: '100 900', unicodeRange: LATIN_EXT }],
  ['Edicion Cursiva', cursiva, { weight: '100 900', unicodeRange: LATIN }],
  ['Edicion Cursiva', cursivaExt, { weight: '100 900', unicodeRange: LATIN_EXT }],
];

let cargando = null;

/**
 * Registra las fuentes (una sola vez por página) y devuelve una promesa que se cumple cuando están cargadas
 * (o cuando no se pudo: entonces se usa la de respaldo y la promesa igual se cumple, nunca falla).
 */
export function cargarFuentesSubtitulos() {
  if (cargando) return cargando;
  if (typeof window === 'undefined' || typeof FontFace === 'undefined' || !document?.fonts) return Promise.resolve();
  const promesas = [];
  for (const [familia, url, desc] of CARAS) {
    try {
      const cara = new FontFace(familia, `url(${url}) format('woff2-variations'), url(${url}) format('woff2')`, desc);
      document.fonts.add(cara);
      promesas.push(cara.load().catch(() => null));
    } catch {
      /* si el navegador no puede, se usa la fuente de respaldo */
    }
  }
  cargando = Promise.all(promesas).then(() => undefined);
  return cargando;
}

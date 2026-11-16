// «Me funciona»: los creativos propios marcados como ganadores (imágenes de un lote y videos terminados). Se filtran y
// se eligen en «Anuncios de imagen → Variantes». Servidor: rutas/funcionan.js.
import { createContext } from 'react';
import { invalidar, pedirNuevo, useDatos } from './api.js';

export const CLAVE_FUNCIONAN = 'funcionan';
const pedir = () => pedirNuevo('/api/funcionan');

/** { items, claves } — todos (el filtro se hace en la pantalla, son pocos). */
export const useFuncionan = (opciones) => useDatos(CLAVE_FUNCIONAN, pedir, opciones);

export const claveImagen = (lote, pieza) => `imagen:${lote}:${pieza}`;
export const claveVideo = (slug) => `video:${slug}`;

export async function marcarFunciona(cuerpo) {
  const r = await pedirNuevo('/api/funcionan', { metodo: 'POST', cuerpo });
  invalidar(CLAVE_FUNCIONAN);
  return r;
}
export async function quitarFunciona(idOClave) {
  const r = await pedirNuevo(`/api/funcionan/${encodeURIComponent(idOClave)}`, { metodo: 'DELETE' });
  invalidar(CLAVE_FUNCIONAN);
  return r;
}

/** El lote que se está mirando (para el botón de cada imagen); null en la simulación. */
export const LoteFunciona = createContext(null);

// La sección «Investigación de mercado» (rutas/investigacion.js): una por producto, solo con su foto.
import { pedirNuevo, useDatos } from './api.js';

const BASE = '/api/investigacion';
const enc = encodeURIComponent;

export const apiInvestigacion = {
  /** { productos: [{ id, nombre, foto, estado: 'sin'|'investigando'|'lista'|'error', fecha, veredicto, pais, resaltados }], motor } */
  lista: () => pedirNuevo(BASE),
  /** { producto, tarea: { estado, progreso, error }, investigacion, resaltados } */
  una: (id) => pedirNuevo(`${BASE}/${enc(id)}`),
  investigar: (id, pais) => pedirNuevo(`${BASE}/${enc(id)}`, { metodo: 'POST', cuerpo: { pais: pais || null } }),
  resaltar: (id, resaltados) => pedirNuevo(`${BASE}/${enc(id)}/resaltados`, { metodo: 'PUT', cuerpo: { resaltados } }),
};

export const CLAVE_INVESTIGACIONES = 'investigacion:lista';
export const claveInvestigacion = (id) => `investigacion:${id}`;
export const useInvestigaciones = (opciones) => useDatos(CLAVE_INVESTIGACIONES, apiInvestigacion.lista, opciones);
export const useInvestigacion = (id, opciones) => useDatos(id ? claveInvestigacion(id) : null, () => apiInvestigacion.una(id), opciones);

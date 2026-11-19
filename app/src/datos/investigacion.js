// La sección «Investigación de mercado» (rutas/investigacion.js): una por producto, solo con su foto.
import { pedirNuevo, useDatos } from './api.js';

const BASE = '/api/investigacion';
const enc = encodeURIComponent;

export const apiInvestigacion = {
  /** { productos: [{ id, nombre, foto, estado: 'sin'|'investigando'|'lista'|'error', fecha, veredicto, pais, resaltados }], motor } */
  lista: () => pedirNuevo(BASE),
  /** { producto, tarea: { estado, progreso, error }, investigacion, resaltados } */
  una: (id) => pedirNuevo(`${BASE}/${enc(id)}`),
  /** La de mercado y, a la vez, la de la competencia en TrendTrack (`competencia`: link o dominio; vacío = la IA la busca). */
  investigar: (id, pais, competencia = '') => pedirNuevo(`${BASE}/${enc(id)}`, { metodo: 'POST', cuerpo: { pais: pais || null, competencia: competencia || '' } }),
  /** Le agrega a la investigación hecha los conceptos para Meta (Andromeda), sin rehacerla (unos minutos). */
  agregarAndromeda: (id) => pedirNuevo(`${BASE}/${enc(id)}`, { metodo: 'POST', cuerpo: { soloAndromeda: true } }),
  /** La investigación competitiva con TrendTrack: { tarea, competencia } */
  competencia: (id) => pedirNuevo(`${BASE}/${enc(id)}/competencia`),
  /** { enlace, producto?, pais?, brandtracker?, retomar? } lanza sus 6 etapas de una vez (gasta créditos de TrendTrack) */
  competir: (id, cuerpo) => pedirNuevo(`${BASE}/${enc(id)}/competencia`, { metodo: 'POST', cuerpo }),
  /** Corrige un texto de anuncio de la investigación (queda como aprendizaje): { anuncio } */
  editarAnuncio: (id, i, textos) => pedirNuevo(`${BASE}/${enc(id)}/anuncios/${i}`, { metodo: 'PUT', cuerpo: { textos } }),
  resaltar: (id, resaltados) => pedirNuevo(`${BASE}/${enc(id)}/resaltados`, { metodo: 'PUT', cuerpo: { resaltados } }),
};

export const CLAVE_INVESTIGACIONES = 'investigacion:lista';
export const claveInvestigacion = (id) => `investigacion:${id}`;
export const useInvestigaciones = (opciones) => useDatos(CLAVE_INVESTIGACIONES, apiInvestigacion.lista, opciones);
export const useInvestigacion = (id, opciones) => useDatos(id ? claveInvestigacion(id) : null, () => apiInvestigacion.una(id), opciones);
export const useCompetencia = (id, opciones) => useDatos(id ? `investigacion:${id}:competencia` : null, () => apiInvestigacion.competencia(id), opciones);

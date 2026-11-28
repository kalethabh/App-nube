import { pedirNuevo,useDatos } from './api.js';
export { tienePermiso,seccionesDePantalla,SECCIONES } from '../../compartido/permisos.js';
export function useCuenta(){return useDatos('cuenta-acceso',()=>pedirNuevo('/api/acceso/yo'),{cadaMs:15000}).datos;}

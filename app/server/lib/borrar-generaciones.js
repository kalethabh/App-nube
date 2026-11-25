// El alcance es una lista explícita de proyectos vistos por el usuario, nunca todo un producto.
import fs from 'node:fs';
import path from 'node:path';
import { TEMP } from './rutas.js';
import { ErrorApp } from './productos.js';
import { aLaPapelera, eliminarAnuncio } from './papelera.js';
import { estadoDeLaFila } from './conductor.js';
import { listarLotes } from './imagen-ads/lotes.js';
import { listarAnuncios } from './anuncios.js';
import { listarAnunciosNuevos, comprobarBorradoGeneracion } from './anuncios-nuevos.js';
import { listar as embudos, comprobarBorrado } from './embudo/index.js';
import { listar as landings, carpetaDe, leer } from './landings/index.js';
import { listarTrabajos } from './shopify/trabajos.js';
import { listarSketches, comprobarBorradoSketch } from './sketch.js';
import { listarCambios, comprobarBorradoCambio } from './cambiar.js';

const listas={imagenes:listarLotes,videos:()=>[...listarAnuncios(),...listarAnunciosNuevos()],embudo:()=>embudos().embudos,landings:()=>landings().landings,sketch:listarSketches,cambiar:listarCambios};
const grupoDe=p=>p.productoId?`producto:${p.productoId}`:`proyecto:${p.id || p.lote || p.slug}`;

export function borrarGeneraciones(tipo,{ids,grupo}={}) {
 if(!Object.hasOwn(listas,tipo) || !Array.isArray(ids) || !ids.length || ids.length>500 || ids.some(id=>typeof id!=='string')) throw new ErrorApp(400,'Selecciona las generaciones que quieres borrar (hasta 500 a la vez).');
 const proyectos=listas[tipo](), fila=estadoDeLaFila(), planes=[];
 for(const id of new Set(ids)) {
  const p=proyectos.find(p=>(p.id || p.lote || p.slug)===id);
  if(!p || (grupo && grupoDe(p)!==grupo)) throw new ErrorApp(409,'La carpeta cambió. Recarga y revisa las generaciones antes de borrar.');
  if(fila.activos.includes(id) || fila.fila.includes(id)) throw new ErrorApp(409,'Una generación está trabajando o en cola. Detenla o espera antes de borrar.');
  let carpeta=path.join(TEMP,id);
  if(tipo==='embudo')carpeta=comprobarBorrado(id);
  if(tipo==='videos')comprobarBorradoGeneracion(id);
  if(tipo==='sketch' && !comprobarBorradoSketch(id) || tipo==='cambiar' && !comprobarBorradoCambio(id)) throw new ErrorApp(409,'Esta generación sigue trabajando. Espera a que termine antes de borrarla.');
  if(tipo==='landings') {
   if(leer(id).trabajando || listarTrabajos().trabajos.some(t=>t.landingId===id && t.trabajando)) throw new ErrorApp(409,'Esta landing sigue trabajando o subiendo a una tienda. Espera antes de borrarla.');
   carpeta=carpetaDe(id);
  }
  if(!fs.existsSync(carpeta) || fs.lstatSync(carpeta).isSymbolicLink()) throw new ErrorApp(409,'No pude comprobar la carpeta. Recarga antes de borrar.');
  planes.push({id,carpeta});
 }
 // Prevalidación completa y movimientos sin esperas: no arranca otro trabajo entre comprobación y movimiento.
 const eliminados=[],errores=[];
 for(const {id,carpeta} of planes)try {
  if(['videos','sketch','cambiar'].includes(tipo))eliminarAnuncio(id);else aLaPapelera(carpeta);
  eliminados.push(id);
 }catch(e){errores.push({id,mensaje:e.status?e.message:'No pude mover esta generación. Vuelve a intentarlo.'});}
 return {ok:!errores.length,eliminados,errores};
}

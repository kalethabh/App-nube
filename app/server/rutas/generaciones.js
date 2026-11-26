import express from 'express';
import { soloDesdeLaApp } from '../lib/productos.js';
import { borrarGeneraciones } from '../lib/borrar-generaciones.js';
import { leerNombres, ponerNombre, olvidarNombres } from '../lib/nombres-generaciones.js';
const fallo=(res,e,que)=>{if(!e.status)console.error(`[${que}]`,e.message);res.status(e.status || 500).json({error:e.status?e.message:'No pude guardar el cambio. Vuelve a intentarlo.'});};
export default function rutasGeneraciones(app) {
 app.post('/api/generaciones/:tipo/borrar',soloDesdeLaApp,express.json({limit:'64kb'}),(req,res)=>{
  try {const r=borrarGeneraciones(req.params.tipo,req.body);try{olvidarNombres(req.params.tipo,r.eliminados || []);}catch{/* el nombre es lo de menos */}res.set('Cache-Control','no-store').json(r);}
  catch(e){if(!e.status)console.error('[borrar-generaciones]',e.message);res.status(e.status || 500).json({error:e.status?e.message:'No pude borrar las generaciones. Vuelve a intentarlo.'});}
 });
 // (2026-11-26c) el nombre propio de cada bloque dentro de la carpeta de un producto («Ángulo 1»…)
 app.get('/api/generaciones/nombres',(req,res)=>{res.set('Cache-Control','no-store').json({nombres:leerNombres()});});
 app.put('/api/generaciones/:tipo/nombre',soloDesdeLaApp,express.json({limit:'8kb'}),(req,res)=>{
  try {res.set('Cache-Control','no-store').json(ponerNombre(req.params.tipo,req.body));}catch(e){fallo(res,e,'nombre-generacion');}
 });
}

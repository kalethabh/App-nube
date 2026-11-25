import express from 'express';
import { soloDesdeLaApp } from '../lib/productos.js';
import { borrarGeneraciones } from '../lib/borrar-generaciones.js';
export default function rutasGeneraciones(app) {
 app.post('/api/generaciones/:tipo/borrar',soloDesdeLaApp,express.json({limit:'64kb'}),(req,res)=>{
  try {res.set('Cache-Control','no-store').json(borrarGeneraciones(req.params.tipo,req.body));}
  catch(e){if(!e.status)console.error('[borrar-generaciones]',e.message);res.status(e.status || 500).json({error:e.status?e.message:'No pude borrar las generaciones. Vuelve a intentarlo.'});}
 });
}

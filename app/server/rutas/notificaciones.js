import { soloDesdeLaApp } from '../lib/productos.js';
import { listarNotificaciones,marcarNotificacionLeida } from '../lib/notificaciones.js';
export default function rutas(app) {
 app.get('/api/notificaciones',(req,res)=>res.set('Cache-Control','no-store').json(listarNotificaciones()));
 app.post('/api/notificaciones/:id/leer',soloDesdeLaApp,(req,res)=>{try{res.json(marcarNotificacionLeida(req.params.id));}catch(e){res.status(e.status || 500).json({error:e.status?e.message:'No se pudo guardar el aviso.'});}});
}

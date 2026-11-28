import { GENERADORES,tienePermiso } from '../../compartido/permisos.js';
const cualquierGenerador=[...GENERADORES,'editor'];
/** null = recurso común de la interfaz; [] = solo el dueño. Lo desconocido se deniega. */
export function seccionesDeSolicitud(ruta,metodo='GET') {
 const lectura=['GET','HEAD'].includes(metodo);
 if(ruta==='/api/acceso/yo' || ruta==='/api/acceso/salir')return null;
 if(/^\/(assets\/|favicon\.)/.test(ruta) || ruta==='/' || ruta==='/index.html')return null;
 if(lectura && /^\/api\/(estado|ajustes|salud|ia\/estado|claude\/estado|imagenes\/motor)(\/|$)/.test(ruta))return null;
 if(/^\/api\/(acceso\/usuarios|acceso\/configuracion|acceso\/permisos\.sql|actualizar|claves|ia|claude|github|guardado|conector|telegram|_nube|anuncios-github|abrir-carpeta)(\/|$)/.test(ruta) || ruta==='/usuarios')return [];
 if(/^\/api\/oficina(\/|$)/.test(ruta) && !lectura)return [];
 if(/^\/api\/generaciones\/[^/]+\/borrar$/.test(ruta))return ({imagenes:['imagenes'],videos:['videos','anuncios'],embudo:['embudo'],landings:['landings'],sketch:['videos'],cambiar:['videos']})[ruta.split('/')[3]] || [];
 if(lectura && ruta==='/api/shopify/tiendas')return ['shopify','landings','sep'];
 if(/^\/api\/productos(\/|$)/.test(ruta))return lectura?['productos',...cualquierGenerador]:['productos'];
 if(/^\/api\/investigacion(\/|$)/.test(ruta))return lectura?['investigacion',...GENERADORES]:['investigacion'];
 if(/^\/api\/biblioteca(\/|$)/.test(ruta))return lectura?['biblioteca',...cualquierGenerador]:['biblioteca'];
 if(/^\/api\/(material|referencias)(\/|$)/.test(ruta))return ['biblioteca',...cualquierGenerador];
 if(lectura && /^\/api\/(conductores|tablero)(\/|$)/.test(ruta))return ['tablero','videos','anuncios','editor'];
 if(/^\/api\/(estilos|subestilos|voces|videos-propios|cambiar|sketch|conductores|produccion)(\/|$)/.test(ruta) || ruta.startsWith('/subestilos/'))return ['videos'];
 if(/^\/api\/anuncios(\/|$)/.test(ruta)) {
  if(/\/(editor|editar|edicion|exportar|version-principal)(\/|$)/.test(ruta))return ['editor'];
  return lectura?['videos','anuncios','editor','tablero']:ruta==='/api/anuncios'?['videos']:['videos','anuncios'];
 }
 if(/^\/api\/entrega\//.test(ruta))return ['videos','anuncios'];
 if(/^\/api\/editor(\/|$)/.test(ruta))return ['editor'];
 if(/^\/api\/(dashboard)(\/|$)/.test(ruta))return ['inicio'];
 if(/^\/api\/organizar-productos(\/|$)/.test(ruta))return ['productos'];
 if(/^\/api\/funcionan(\/|$)/.test(ruta))return ['aprendizajes','imagenes'];
 if(/^\/api\/(inversion|saldo|costo)(\/|$)/.test(ruta))return ['saldo'];
 if(/^\/api\/notificaciones(\/|$)/.test(ruta) || ruta.startsWith('/landing/'))return ['landings'];
 const k=ruta.split('/')[2];
 const m={'imagen-ads':'imagenes','chat-imagenes':'chat-imagenes',embudos:'embudo',landings:'landings',sep:'sep',carpetas:'carpetas',shopify:'shopify',oficina:'oficina',tablero:'tablero',aprendizajes:'aprendizajes',inspiracion:'inspiracion'};
 if(ruta.startsWith('/api/') && m[k])return [m[k]];
 if(ruta.startsWith('/archivos/')) {
  const media=ruta.replace('/archivos/miniatura/','/archivos/').split('/')[2];
  return ({'imagen-ads':['imagenes'],'video-imagenes':['imagenes'],oficina:['oficina'],biblioteca:['biblioteca',...cualquierGenerador],referencia:['biblioteca',...cualquierGenerador],subida:cualquierGenerador,producto:['productos',...cualquierGenerador],productos:['productos',...cualquierGenerador],anuncio:['videos','anuncios','editor'],salida:['videos','anuncios','editor'],muestra:['videos'],cambio:['videos'],sketch:['videos'],funcionan:['aprendizajes','imagenes']})[media] || [];
 }
 return [];
}
export function puedeSolicitud(cuenta,ruta,metodo) {
 if(cuenta.rol==='owner')return true;
 const requerida=seccionesDeSolicitud(ruta,metodo);
 if(requerida===null)return true;
 // Antes de aplicar la migración, conserva el acceso anterior de las cuentas ya aprobadas.
 if(cuenta.permisosPreparados===false && requerida.length)return true;
 return tienePermiso({...cuenta,activo:true},...requerida);
}

// Las acciones que trasladan o crean contenido entre dos secciones necesitan ambos accesos.
export function puedeAccion(cuenta,ruta,body={}) {
 if(!cuenta || cuenta.rol==='owner' || cuenta.permisosPreparados===false)return true;
 const tiene=(...ids)=>tienePermiso({...cuenta,activo:true},...ids);
 if(/^\/api\/imagen-ads\/video(\/|$)/.test(ruta))return tiene('imagenes') && tiene('videos');
 if(ruta==='/api/inspiracion/replicar-imagen')return tiene('inspiracion') && tiene('imagenes');
 if(ruta==='/api/shopify/landing')return tiene('shopify') && tiene('landings');
 if(/^\/api\/carpetas\/[^/]+\/desde$/.test(ruta))return tiene('carpetas') && (body?.tipo==='imagen-lote'?tiene('imagenes'):body?.tipo==='video'?tiene('videos','anuncios','editor'):false);
 return true;
}
export function porteroAcciones(req,res,next) {
 if(!['GET','HEAD','OPTIONS'].includes(req.method) && !puedeAccion(req.cuenta,req.path,req.body))return res.status(403).json({error:'Esta acción necesita permiso para las dos secciones que utiliza. Pide acceso al administrador.'});
 next();
}

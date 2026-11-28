// Catálogo único para el panel del dueño, la interfaz y el portero del servidor.
export const SECCIONES = [
 ['inicio','Inicio','/inicio'],['oficina','Oficina virtual (consulta)','/oficina'],['imagenes','Anuncios de imagen','/imagenes'],['chat-imagenes','Chat de imágenes','/chat-imagenes'],['investigacion','Investigación de mercado','/investigacion'],['videos','Estilos, videos, Sketch y Cambiar producto','/estilos'],['embudo','Embudo','/embudo-whatsapp'],['landings','Landings','/landings'],['sep','S.E.P','/sep'],['productos','Productos','/productos'],['anuncios','Anuncios','/anuncios'],['editor','Editor','/editor'],['biblioteca','Biblioteca','/biblioteca'],['carpetas','Carpetas','/carpetas'],['shopify','Shopify','/shopify'],['tablero','Progreso','/tablero'],['saldo','Saldo y costos','/saldo'],['aprendizajes','Aprendizajes','/aprendizajes'],['inspiracion','Inspiración','/inspiracion'],
].map(([id,nombre,ruta])=>({id,nombre,ruta}));
export const IDS_SECCIONES=SECCIONES.map(s=>s.id);
export const GENERADORES=['imagenes','chat-imagenes','videos','embudo','landings','sep'];
export const normalizarSecciones=x=>Array.isArray(x)?[...new Set(x.filter(s=>IDS_SECCIONES.includes(s)))]:[];
export const tienePermiso=(cuenta,...secciones)=>Boolean(cuenta && (cuenta.activo===false || cuenta.rol==='owner' || cuenta.permisosPreparados===false && secciones.some(s=>IDS_SECCIONES.includes(s)) || (cuenta.secciones || []).some(s=>secciones.includes(s))));
export function seccionesDePantalla(ruta) {
 const k=String(ruta || '').split('?')[0].replace(/^#/, '').split('/')[1] || 'inicio';
 return ({nuevo:['videos'],estilos:['videos'],sketch:['videos'],cambiar:['videos'],anuncio:['videos','anuncios'],produccion:['videos','anuncios'],entrega:['videos','anuncios'],'embudo-whatsapp':['embudo'],editor:['editor'],'editor-videos':['editor'],whatsapp:['embudo'],ajustes:[],usuarios:[]})[k] || [k];
}

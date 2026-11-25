// Eventos persistentes de la app; cada hito se avisa una sola vez, incluso tras reiniciar.
import path from 'node:path';
import crypto from 'node:crypto';
import { TEMP, PUERTO_DE_PRUEBA } from './rutas.js';
import { leerJSON } from './archivos.js';
import { escribirJSON, ErrorApp } from './productos.js';
const archivo=()=>path.join(TEMP,PUERTO_DE_PRUEBA?`_modo-prueba-${PUERTO_DE_PRUEBA}`:'_notificaciones','notificaciones.json');
const leer=()=>leerJSON(archivo()) || {eventos:[]};
export const listarNotificaciones=()=>({notificaciones:leer().eventos.filter(n=>!n.leida).sort((a,b)=>b.fecha.localeCompare(a.fecha))});
function anotar(clave,datos) {
 try {const d=leer(), id='n-'+crypto.createHash('sha256').update(clave).digest('hex').slice(0,24);if(d.eventos.some(n=>n.id===id))return id;d.eventos.push({id,...datos,fecha:new Date().toISOString(),leida:null});escribirJSON(archivo(),d);return id;}
 catch {console.error('[notificaciones] No pude guardar el aviso de una landing.');return null;}
}
export function marcarNotificacionLeida(id) {
 if(!/^n-[a-f0-9]{24}$/.test(id || ''))throw new ErrorApp(404,'No encuentro ese aviso.');
 const d=leer(),n=d.eventos.find(n=>n.id===id);if(!n)throw new ErrorApp(404,'No encuentro ese aviso.');
 n.leida ||= new Date().toISOString();escribirJSON(archivo(),d);return {ok:true};
}
export function notificarLandingLista(l) {
 if(l?.estado!=='lista' || !l.id)return null;
 return anotar(`landing:${l.id}:lista`,{tipo:'landing-lista',titulo:'Landing lista',texto:`«${l.titulo || 'Tu landing'}» ${l.modo==='adaptar'?'está hecha':'está clonada'} y lista para revisar.`,destino:`#/landings?proyecto=${encodeURIComponent(l.id)}`});
}
export function notificarLandingPublicada(t) {
 // Con solo acceso a temas hay instrucciones manuales, no confirmación de publicación.
 if(t?.tipo!=='landing' || !['lista','publicado'].includes(t.estado) || !t.publicado || !/^https:\/\//i.test(t.pagina || '') || !t.id)return null;
 return anotar(`landing:${t.id}:publicada`,{tipo:'landing-publicada',titulo:'Landing publicada',texto:`La publicación de «${t.titulo || 'tu landing'}» está confirmada en tu tienda.`,destino:'#/landings/tiendas',urlPublica:t.pagina});
}

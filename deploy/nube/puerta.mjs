import crypto from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {supabase,llave,sellar,abrir,esperar,rutaSegura,idSeguro,origenPublico} from './comun.mjs';
import {puedeSolicitud} from '../../app/server/lib/permisos.js';
const LIBRE=/^\/(entrar(?:\?|$)|favicon\.|api\/acceso\/(?:entrar|registro|google(?:\/callback)?|salir)(?:\?|$)|mcp\/[a-zA-Z0-9_-]+(?:\?|$)|api\/inspiracion\/importar(?:\?|$))/;
const HOP=new Set(['host','connection','transfer-encoding','content-length','forwarded','x-forwarded-host','x-forwarded-proto','x-forwarded-for','x-vercel-id','x-kads-cuerpo']);
function cabeceras(req){return Object.entries(req.headers).filter(([k])=>!HOP.has(k) && !k.startsWith('x-vercel-') && !k.startsWith('x-kads-')).map(([k,v])=>[k,Array.isArray(v)?v.join(','):String(v)]);}
export function sesion(req){const m=String(req.headers.cookie || '').match(/(?:^|;\s*)kads_sesion=([^;]*)/);try{return m?decodeURIComponent(m[1]):null;}catch{return null;}}
function json(res,st,d){res.statusCode=st;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.end(JSON.stringify(d));}
async function cuerpo(req,max=1024*1024){const a=[];let n=0;for await(const b of req){n+=b.length;if(n>max)throw Object.assign(new Error('Usa la subida directa para archivos grandes.'),{status:413});a.push(b);}return Buffer.concat(a);}
export function crearPuerta({sb=supabase(),key=llave(),origen=origenPublico(),fetcher=fetch,dormir=esperar,ahora=Date.now}={}) {
 const cache=new Map();
 async function identidad(req){
  const token=sesion(req);if(!token)return null;
  const hash=crypto.createHash('sha256').update(token).digest('hex'),c=cache.get(hash);if(c && c.hasta>ahora())return c.u;
  const r=await fetcher(`${process.env.KADS_SUPABASE_URL}/auth/v1/user`,{headers:{apikey:process.env.KADS_SUPABASE_ANON,Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});
  const u=r.ok?await r.json():null;if(cache.size>1000)cache.clear();cache.set(hash,{u,hasta:ahora()+15000});return u;
 }
 async function usuario(req){
  const token=sesion(req),u=await identidad(req);if(!u?.id)return null;
  const permiso=await fetcher(`${process.env.KADS_SUPABASE_URL}/rest/v1/rpc/kads_mi_acceso`,{method:'POST',headers:{apikey:process.env.KADS_SUPABASE_ANON,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});
  if(!permiso.ok)return null;const dato=await permiso.json(),rol=Array.isArray(dato)?dato[0]?.rol:dato?.rol;
  return ['owner','socio','empleado'].includes(rol)?{...u,acceso:Array.isArray(dato)?dato[0]:dato}:null;
 }
 return async function puerta(req,res){
  let ruta;
  try {
   ruta=rutaSegura(req.url || '/');
   // El dominio de producción es fijo; un Host o cabecera de proxy no puede alterar el callback de Google.
   if(req.headers.host && req.headers.host!==new URL(origen).host)return json(res,421,{error:'Usa la dirección de producción de Kads.'});
   const metodo=req.method || 'GET',escritura=!['GET','HEAD','OPTIONS'].includes(metodo);
   if(escritura && (req.headers.origin && req.headers.origin!==origen || req.headers['sec-fetch-site']==='cross-site') && !/^\/(mcp\/|api\/inspiracion\/importar)/.test(ruta))return json(res,403,{error:'Solo desde Kads.'});
   if(ruta.split('?')[0]==='/api/nube/subida') {
    if(metodo!=='POST')return json(res,405,{error:'Usa POST.'});
    const u=await usuario(req);if(!u)return json(res,403,{error:'Entra con una cuenta aprobada.'});
    const d=JSON.parse((await cuerpo(req,16384)).toString()),destino=rutaSegura(d.ruta);
    if(!destino.startsWith('/api/') || destino.startsWith('/api/nube/') || !['POST','PUT','PATCH'].includes(d.metodo))return json(res,400,{error:'Subida inválida.'});
    if(!puedeSolicitud({...u.acceso,activo:true},destino.split('?')[0],d.metodo))return json(res,403,{error:'No tienes permiso para subir archivos en esa sección.'});
    if(!Number.isSafeInteger(d.bytes) || d.bytes<1 || d.bytes>2*1024**3)return json(res,413,{error:'El archivo supera 2 GB.'});
    const id=crypto.randomUUID(),obj=`entradas/${id}`;
    await sb.rpc('kads_motor_nueva_subida',{p_id:id,p_usuario:u.id,p_ruta:destino,p_metodo:d.metodo,p_objeto:obj});
    return json(res,200,{id,url:await sb.subirFirmado('kads-transferencias',obj)});
   }
   // Los enlaces MCP/importación conservan su portero propio dentro del motor.
   if(!LIBRE.test(ruta) && !sesion(req) && !/(?:^|;\s*)kads_refresco=[^;]+/.test(String(req.headers.cookie || ''))) {
    if(ruta.startsWith('/api/') || ruta.startsWith('/archivos/'))return json(res,401,{error:'Entra en Kads.'});
    res.statusCode=303;res.setHeader('Location','/entrar');res.end();return;
   }
   let actualizar=false;
   if(escritura && (/^\/api\/actualizar(?:\/|\?|$)/.test(ruta) || ruta==='/api/github/actualizar')) {
    const u=await usuario(req);if(u?.acceso?.rol!=='owner')return json(res,403,{error:'Solo el administrador actualiza Kads.'});
    if(!['/api/actualizar/publica','/api/github/actualizar'].includes(ruta))return json(res,409,{error:'En Vercel usa «Actualizar» para desplegar desde GitHub. Los ZIP locales se conservan para Mac y Contabo.'});
    actualizar=true;
   }
   const lider=(await sb.tabla('kads_motor_lider','id=eq.1&select=vence'))?.[0];
   if(!lider || new Date(lider.vence).getTime()<ahora())return json(res,503,{error:'El motor está iniciando. Intenta de nuevo en unos segundos.'});
   let body,objeto;
   if(req.headers['x-kads-cuerpo']) {
    const id=String(req.headers['x-kads-cuerpo']);if(!idSeguro(id))return json(res,400,{error:'Subida inválida.'});
    const u=await usuario(req);if(!u)return json(res,403,{error:'Entra con una cuenta aprobada.'});
    objeto=await sb.rpc('kads_motor_usar_subida',{p_id:id,p_usuario:u.id,p_ruta:ruta,p_metodo:metodo});
    if(!objeto)return json(res,400,{error:'La subida venció, ya fue usada o pertenece a otro pedido.'});
   }else if(escritura)body=(await cuerpo(req)).toString('base64');
   const id=crypto.randomUUID(),u=await identidad(req),cliente=crypto.createHmac('sha256',key).update(u?.id || String(req.headers['x-real-ip'] || req.socket?.remoteAddress || 'sin-ip')).digest('hex');
   await sb.rpc('kads_motor_encolar',{p_id:id,p_cliente:cliente,p_sobre:sellar({ruta,metodo,headers:cabeceras(req),body,objeto,actualizar},key),p_limite:u?.id?600:30});
   const inicio=ahora();let n=-1,iniciado=false;
   while(ahora()-inicio<770000 && !res.destroyed){
    const [p]=await sb.tabla('kads_motor_pedidos',`id=eq.${id}&select=estado,respuesta`);
    if(p?.estado==='incierto')return json(res,503,{error:'El motor se reinició durante este pedido. Revisa su estado antes de repetirlo.',revisar:true});
    if(p?.respuesta) {
     const r=abrir(p.respuesta,key);
     if(!iniciado) {
      res.statusCode=r.status;const cookies=[];
      for(const [k,v] of r.headers || []){if(k==='set-cookie')cookies.push(v);else if(!HOP.has(k))res.setHeader(k,v);}
      if(cookies.length)res.setHeader('Set-Cookie',cookies);
      res.setHeader('Cache-Control','private, no-store');iniciado=true;
     }
     if(r.stream) {
      const partes=await sb.tabla('kads_motor_tramos',`pedido=eq.${id}&n=gt.${n}&order=n.asc&limit=100`);
      for(const x of partes){const b=abrir(x.sobre,key);res.write(Buffer.from(b.body,'base64'));n=x.n;}
      if(r.fin && partes.length<100){res.end();return;}
     }else {
      if(metodo==='HEAD'){res.end();return;}
      if(r.objeto) {
       const origenArchivo=await fetcher(await sb.firmar('kads-transferencias',r.objeto,60),{signal:AbortSignal.timeout(120000)});
       if(!origenArchivo.ok)throw new Error('No se pudo entregar el archivo.');
       await pipeline(Readable.fromWeb(origenArchivo.body),res);return;
      }
      let bytes=Buffer.from(r.body || '','base64');
      if((r.headers || []).some(([k,v])=>k==='content-type' && v.includes('text/html'))) {
       bytes=Buffer.from(bytes.toString().replace(/<head([^>]*)>/i,'<head$1><meta name="kads-nube" content="1"><script src="/kads-nube.js"></script>'));
       res.removeHeader('content-length');res.removeHeader('etag');
      }
      res.end(bytes);return;
     }
    }
    await dormir(p?.respuesta?250:150);
   }
   if(!res.headersSent)json(res,504,{error:'El pedido sigue sin respuesta. Revisa su estado antes de repetirlo.'});else res.end();
  }catch(e){if(!res.headersSent)json(res,e.status===413?413:503,{error:e.status===413?e.message:'No se pudo conectar con el motor. Revisa el estado antes de repetir el pedido.'});else res.end();}
 };
}

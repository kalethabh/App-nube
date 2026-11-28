import crypto from 'node:crypto';
import http from 'node:http';
import {Readable} from 'node:stream';
export function pedirLocal(url,{method='GET',headers,body,signal}={}) {
 return new Promise((resolve,reject)=>{
  const r=http.request(url,{method,headers:Object.fromEntries(new Headers(headers)),signal},respuesta=>{
   const hs=[];for(let i=0;i<respuesta.rawHeaders.length;i+=2)hs.push([respuesta.rawHeaders[i],respuesta.rawHeaders[i+1]]);
   resolve(new Response(method==='HEAD' || [204,304].includes(respuesta.statusCode)?null:Readable.toWeb(respuesta),{status:respuesta.statusCode,headers:hs}));
  });r.on('error',reject);
  if(body instanceof ReadableStream){Readable.fromWeb(body).on('error',e=>r.destroy(e)).pipe(r);}else r.end(body);
 });
}
export const esperar=ms=>new Promise(r=>setTimeout(r,ms));
export function llave(valor=process.env.KADS_CIFRADO) {
 if(!/^[a-f0-9]{64}$/i.test(valor || ''))throw new Error('Configura KADS_CIFRADO con 32 bytes hexadecimales.');
 return Buffer.from(valor,'hex');
}
export function cifrar(bytes,key,aad='kads-v1') {
 const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv);c.setAAD(Buffer.from(aad));
 const datos=Buffer.concat([c.update(bytes),c.final()]);return Buffer.concat([iv,c.getAuthTag(),datos]);
}
export function descifrar(bytes,key,aad='kads-v1') {
 const b=Buffer.from(bytes);if(b.length<28)throw new Error('Sobre inválido.');
 const d=crypto.createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));d.setAAD(Buffer.from(aad));
 return Buffer.concat([d.update(b.subarray(28)),d.final()]);
}
export const sellar=(dato,key)=>cifrar(Buffer.from(JSON.stringify(dato)),key).toString('base64');
export const abrir=(sobre,key)=>JSON.parse(descifrar(Buffer.from(sobre,'base64'),key));
export function rutaSegura(ruta) {
 if(typeof ruta!=='string' || !ruta.startsWith('/') || ruta.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(ruta) || ruta.length>8192)throw new Error('Ruta inválida.');
 return ruta;
}
export const idSeguro=id=>/^[a-f0-9-]{36}$/.test(id || '');
export function origenPublico() {
 const u=new URL(process.env.KADS_URL_PUBLICA || '');
 if(u.protocol!=='https:' || u.pathname!=='/' || u.search || u.hash || u.username || u.password)throw new Error('Configura KADS_URL_PUBLICA con la dirección HTTPS de producción.');
 return u.origin;
}
export function supabase({url=process.env.KADS_SUPABASE_URL,secret=process.env.KADS_SUPABASE_SERVICE_ROLE,fetcher=fetch}={}) {
 if(!url || !secret)throw new Error('Falta configurar Supabase en el servidor.');
 const base=new URL(url);if(base.protocol!=='https:' && !['127.0.0.1','localhost'].includes(base.hostname))throw new Error('Supabase necesita HTTPS.');
 async function pedir(ruta,{method='GET',body,headers={},raw=false}={}) {
  const r=await fetcher(`${base.origin}${ruta}`,{method,headers:{apikey:secret,Authorization:`Bearer ${secret}`,...(body && !raw?{'Content-Type':'application/json'}:{}),...headers},body:body?(raw?body:JSON.stringify(body)):undefined,signal:AbortSignal.timeout(120000)});
  if(!r.ok)throw Object.assign(new Error(`Supabase no pudo completar el pedido (${r.status}).`),{status:r.status});
  if(raw)return Buffer.from(await r.arrayBuffer());
  const t=await r.text();return t?JSON.parse(t):null;
 }
 const objeto=(bucket,key)=>`${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;
 return {pedir,rpc:(fn,args)=>pedir(`/rest/v1/rpc/${fn}`,{method:'POST',body:args}),
  tabla:(tabla,query='',opt={})=>pedir(`/rest/v1/${tabla}${query?'?'+query:''}`,opt),
  put:(bucket,key,b)=>pedir(`/storage/v1/object/${objeto(bucket,key)}`,{method:'POST',body:b,raw:true,headers:{'Content-Type':'application/octet-stream','x-upsert':'true'}}),
  get:(bucket,key)=>pedir(`/storage/v1/object/authenticated/${objeto(bucket,key)}`,{raw:true}),
  async stream(bucket,key){const r=await fetcher(`${base.origin}/storage/v1/object/authenticated/${objeto(bucket,key)}`,{headers:{apikey:secret,Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(780000)});if(!r.ok)throw new Error('No se pudo leer el archivo privado.');return r.body;},
  async putStream(bucket,key,stream,bytes,tipo='application/octet-stream'){
   const r=await fetcher(`${base.origin}/storage/v1/object/${objeto(bucket,key)}`,{method:'POST',headers:{apikey:secret,Authorization:`Bearer ${secret}`,'Content-Type':tipo,'Content-Length':String(bytes),'x-upsert':'true'},body:stream,duplex:'half',signal:AbortSignal.timeout(780000)});if(!r.ok)throw new Error('No se pudo guardar el archivo privado.');
  },
  borrar:(bucket,keys)=>keys.length?pedir(`/storage/v1/object/${encodeURIComponent(bucket)}`,{method:'DELETE',body:{prefixes:keys}}):null,
  async firmar(bucket,key,segundos=300){const d=await pedir(`/storage/v1/object/sign/${objeto(bucket,key)}`,{method:'POST',body:{expiresIn:segundos}});return new URL(`/storage/v1${d.signedURL}`,base.origin).href;},
  async subirFirmado(bucket,key){const d=await pedir(`/storage/v1/object/upload/sign/${objeto(bucket,key)}`,{method:'POST',body:{}});return new URL(`/storage/v1${d.url}`,base.origin).href;}
 };
}

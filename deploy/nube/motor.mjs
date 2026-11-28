// El mismo servidor Express y los mismos generadores. Supabase solo transporta los pedidos y conserva el estado.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import os from 'node:os';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {supabase,llave,abrir,sellar,esperar,origenPublico,rutaSegura,pedirLocal} from './comun.mjs';
import {crearEstado} from './estado.mjs';
const ESCRITURA=m=>!['GET','HEAD','OPTIONS'].includes(m);
export async function ejecutarPedido({pedido,sb,key,dueno,cerca,estado,urlLocal,origen,fetcher=pedirLocal,desplegar,estaActualizando=()=>false}) {
 const contestar=(dato,final=true)=>sb.rpc('kads_motor_contestar',{p_dueno:dueno,p_cerca:cerca,p_id:pedido.id,p_sobre:sellar(dato,key),p_final:final});
 let entrada;
 try {
  entrada=abrir(pedido.sobre,key);rutaSegura(entrada.ruta);
  if(entrada.actualizar){const d=await desplegar();await contestar({status:d.ok?200:409,headers:[['content-type','application/json']],body:Buffer.from(JSON.stringify(d)).toString('base64')});return;}
  const headers=new Headers(entrada.headers);headers.set('host',new URL(origen).host);headers.set('x-forwarded-proto','https');
  headers.delete('content-length');headers.delete('connection');headers.delete('accept-encoding');
  let body=entrada.body?Buffer.from(entrada.body,'base64'):undefined;
  if(entrada.objeto)body=await sb.stream('kads-transferencias',entrada.objeto);
  const r=await fetcher(`${urlLocal}${entrada.ruta}`,{method:entrada.metodo,headers,body:ESCRITURA(entrada.metodo)?body:undefined,...(entrada.objeto?{duplex:'half'}:{}),redirect:'manual',signal:AbortSignal.timeout(780000)});
  const hs=[...r.headers].filter(([k])=>!['set-cookie','connection','transfer-encoding','content-encoding','content-length'].includes(k));
  for(const v of r.headers.getSetCookie?.() || [])hs.push(['set-cookie',v]);
  const tipo=r.headers.get('content-type') || '';
  if(tipo.includes('text/event-stream')) {
   await contestar({status:r.status,headers:hs,stream:true},false);
   let n=0;const inicio=Date.now();
   for await(const b of r.body) {
    const ok=await sb.rpc('kads_motor_tramo',{p_dueno:dueno,p_cerca:cerca,p_id:pedido.id,p_n:n++,p_sobre:sellar({body:Buffer.from(b).toString('base64')},key)});
    if(!ok || Date.now()-inicio>60000){await r.body.cancel?.().catch(()=>{});break;}
   }
   await contestar({status:r.status,headers:hs,stream:true,fin:true});return;
  }
  let respuesta={status:r.status,headers:hs};
  const largo=Number(r.headers.get('content-length'));
  if(!/text\/html/.test(tipo) && (!largo || largo>512*1024) && r.body) {
   const temporal=await fs.mkdtemp(path.join(os.tmpdir(),'kads-entrega-')),f=path.join(temporal,'archivo');
   try{await pipeline(Readable.fromWeb(r.body),createWriteStream(f));const st=await fs.stat(f),obj=`salidas/${pedido.id}`;
    if(st.size>512*1024){await sb.putStream('kads-transferencias',obj,createReadStream(f),st.size,tipo);respuesta={...respuesta,objeto:obj,tipo};}
    else respuesta.body=(await fs.readFile(f)).toString('base64');
   }finally{await fs.rm(temporal,{recursive:true,force:true});}
  }else respuesta.body=Buffer.from(await r.arrayBuffer()).toString('base64');
  if(entrada.ruta==='/api/estado' && estaActualizando() && respuesta.body){const d=JSON.parse(Buffer.from(respuesta.body,'base64'));d.servidor={...d.servidor,reinicioPedido:true};respuesta.body=Buffer.from(JSON.stringify(d)).toString('base64');}
  if(ESCRITURA(entrada.metodo))await estado.guardar();
  if(!await contestar(respuesta))throw new Error('Se perdió el turno del motor.');
 }catch(e){await contestar({status:503,headers:[['content-type','application/json']],body:Buffer.from(JSON.stringify({error:'El pedido no pudo completarse. Revisa su estado antes de repetirlo.',revisar:true})).toString('base64')}).catch(()=>{});}
 finally{if(entrada?.objeto)await sb.borrar('kads-transferencias',[entrada.objeto]).catch(()=>{});}
}
export async function iniciarMotor() {
 if(!process.env.KADS_SUPABASE_ANON)throw new Error('El motor en nube requiere el acceso con cuentas de Kads.');
 const sb=supabase(),key=llave(),origen=origenPublico(),dueno=crypto.randomUUID();
 const raiz=path.resolve(process.env.KADS_RAIZ || path.join(path.dirname(fileURLToPath(import.meta.url)),'../..'));
 const hogar=process.env.KADS_HOME;
 let cerca=null,vence=0,hijo=null,saliendo=false,actualizando=false;
 const matar=()=>{if(hijo?.pid)try{process.kill(-hijo.pid,'SIGKILL');}catch{};};
 // Nunca se escribe el estado ni se atiende con dos motores a la vez, incluso durante un redeploy.
 async function renovar(){if(cerca!==null && Date.now()>vence)throw new Error('Turno vencido.');const f=await sb.rpc('kads_motor_arrendar',{p_dueno:dueno});if(f===null || cerca!==null && Number(f)!==Number(cerca))throw new Error('Otro motor tiene el turno.');cerca=f;vence=Date.now()+70000;}
 while(cerca===null){try{await renovar();}catch{await esperar(5000);}}
 const latido=setInterval(()=>renovar().catch(()=>{if(Date.now()>vence){matar();process.exit(1);}}),15000);
 const estado=crearEstado({raiz,hogar,key,almacen:{put:(n,b)=>sb.put('kads-motor',n,b),get:n=>sb.get('kads-motor',n)},
  publicar:async objeto=>{if(!await sb.rpc('kads_motor_guardar',{p_dueno:dueno,p_cerca:cerca,p_objeto:objeto}))throw new Error('No se pudo confirmar el respaldo.');},
  leerActual:async()=> (await sb.tabla('kads_motor_estado','id=eq.1&select=objeto'))?.[0]?.objeto});
 try{await estado.restaurar();}catch{clearInterval(latido);throw new Error('No se pudo restaurar el estado. El motor no arrancó para proteger tus datos.');}
 const urlLocal=`http://127.0.0.1:${process.env.PUERTO || '4455'}`;
 if(process.getuid?.()===0){const {execFileSync}=await import('node:child_process');execFileSync('chown',['-R','10001:10001',raiz,...(hogar?[hogar]:[])]);}
 const control=crypto.randomBytes(32).toString('hex');
 const entorno={...process.env,HOME:hogar || process.env.HOME,KADS_NUBE:'1',KADS_CONTROL_MOTOR:control,AIA_SUPERVISADO:'1',ANUNCIOS_DOMINIO:new URL(origen).host,KADS_URL_PUBLICA:origen};
 for(const k of ['KADS_CIFRADO','KADS_SUPABASE_SERVICE_ROLE','VERCEL_OIDC_TOKEN','KADS_DEPLOY_HOOK'])delete entorno[k];
 hijo=spawn(process.execPath,['app/server/index.js'],{cwd:raiz,detached:true,stdio:'inherit',...(process.getuid?.()===0?{uid:10001,gid:10001}:{}),env:entorno});
 hijo.once('exit',()=>{if(!saliendo)process.exit(1);});
 // El host del servidor sigue protegido aunque la prueba interna use loopback.
 for(let i=0;i<180;i++){try{await fetch(urlLocal+'/entrar',{redirect:'manual',signal:AbortSignal.timeout(1000)});break;}catch{if(i===179)throw new Error('El motor no arrancó.');await esperar(1000);}}
 let guardando=false;
 const respaldo=setInterval(async()=>{if(guardando)return;guardando=true;try{await estado.guardar();}catch{console.error('[nube] Respaldo pendiente; se reintentará.');}finally{guardando=false;}},5000);
 const limpieza=setInterval(async()=>{try{
  const antes=encodeURIComponent(new Date(Date.now()-86400000).toISOString());
  const viejos=await sb.tabla('kads_motor_pedidos',`vence=lt.${antes}&select=id&limit=100`);
  const subidas=await sb.tabla('kads_motor_subidas',`vence=lt.${antes}&select=id,objeto&limit=100`);
  await sb.borrar('kads-transferencias',[...viejos.map(x=>`salidas/${x.id}`),...subidas.map(x=>x.objeto)]);
  for(const x of viejos)await sb.tabla('kads_motor_pedidos',`id=eq.${x.id}`,{method:'DELETE'});
  for(const x of subidas)await sb.tabla('kads_motor_subidas',`id=eq.${x.id}`,{method:'DELETE'});
 }catch{console.error('[nube] Limpieza temporal pendiente.');}},60000);
 const activos=new Set();
 async function desplegar(){
  if(actualizando)return {ok:false,mensaje:'La actualización ya está en curso.'};
  const r=await pedirLocal(urlLocal+'/__kads_motor',{headers:{'x-kads-control':control},signal:AbortSignal.timeout(3000)});
  if(!r.ok || (await r.json()).ocupado)return {ok:false,mensaje:'Espera a que terminen las generaciones antes de actualizar.'};
  const hook=new URL(process.env.KADS_DEPLOY_HOOK || 'https://no-configurado.invalid');
  if(hook.protocol!=='https:' || hook.hostname!=='api.vercel.com' || !hook.pathname.startsWith('/v1/integrations/deploy/'))return {ok:false,mensaje:'Configura el Deploy Hook de producción de Vercel antes de actualizar.'};
  await estado.guardar();const d=await fetch(hook,{method:'POST',signal:AbortSignal.timeout(15000)});
  if(!d.ok)return {ok:false,mensaje:'Vercel no aceptó la actualización. Revisa el despliegue.'};
  actualizando=true;return {ok:true,mensaje:'Vercel está actualizando Kads. Conservamos los datos y esperamos el nuevo motor.',reinicia:true,cambios:['Actualización del despliegue desde GitHub.']};
 }
 async function salir(){
  if(saliendo)return;saliendo=true;const limite=Date.now()+3540000;
  while(Date.now()<limite){
   const r=await pedirLocal(urlLocal+'/__kads_motor',{headers:{'x-kads-control':control},signal:AbortSignal.timeout(3000)}).catch(()=>null);
   if(r?.ok && !(await r.json()).ocupado && activos.size===0)break;
   await esperar(1000);
  }
  clearInterval(respaldo);clearInterval(limpieza);await estado.guardar();matar();await sb.rpc('kads_motor_soltar',{p_dueno:dueno,p_cerca:cerca});clearInterval(latido);process.exit(0);
 }
 process.once('SIGTERM',()=>salir().catch(()=>{matar();process.exit(1);}));process.once('SIGINT',()=>salir().catch(()=>{matar();process.exit(1);}));
 console.log('[nube] Motor preparado; proveedores y modelos de la app conservados.');
 while(true){
  if(Date.now()>vence){matar();throw new Error('Se perdió el turno del motor.');}
  if(activos.size>=16){await Promise.race(activos);continue;}
  const [p]=await sb.rpc('kads_motor_tomar',{p_dueno:dueno,p_cerca:cerca});
  if(!p){await esperar(300);continue;}
  if(saliendo && ESCRITURA(abrir(p.sobre,key).metodo)){
   await sb.rpc('kads_motor_contestar',{p_dueno:dueno,p_cerca:cerca,p_id:p.id,p_sobre:sellar({status:503,headers:[['content-type','application/json']],body:Buffer.from(JSON.stringify({error:'Kads está actualizando el motor. Espera a que termine.'})).toString('base64')},key),p_final:true});continue;
  }
  const trabajo=ejecutarPedido({pedido:p,sb,key,dueno,cerca,estado,urlLocal,origen,desplegar,estaActualizando:()=>actualizando}).finally(()=>activos.delete(trabajo));activos.add(trabajo);
 }
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))iniciarMotor().catch(()=>{console.error('[nube] No arrancó el motor. Revisa configuración, migración y respaldo.');process.exit(1);});

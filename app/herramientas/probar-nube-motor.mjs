// Solo dentro de un contenedor desechable. Arranca DOS motores sucesivos, con disco nuevo y Supabase simulado.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {supabase,pedirLocal,llave,esperar} from '../../deploy/nube/comun.mjs';
import {crearPuerta} from '../../deploy/nube/puerta.mjs';
await fs.access('/.dockerenv').catch(()=>{throw new Error('Esta prueba se ejecuta solo en un contenedor desechable.');});
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'kads-ciclo-'));await fs.chmod(tmp,0o755);
const raiz=path.join(tmp,'kads'),hogar=path.join(tmp,'hogar'),datos=path.join(tmp,'objetos');await fs.mkdir(datos);
const pedidos=new Map();let dueno=null,cerca=0,vence=0,actual=null,motor;
const servidor=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://local'),trozos=[];for await(const b of req)trozos.push(b);const bytes=Buffer.concat(trozos);
 const json=d=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(d));};
 try{
  if(u.pathname.startsWith('/storage/v1/object/')){
   const rel=u.pathname.replace('/storage/v1/object/','').replace(/^authenticated\//,'');
   if(rel.includes('..'))throw new Error('ruta');const f=path.join(datos,rel);
   if(req.method==='POST'){await fs.mkdir(path.dirname(f),{recursive:true});await fs.writeFile(f,bytes);return json({Key:rel});}
   if(req.method==='GET')return res.end(await fs.readFile(f));
  }
  const b=bytes.length?JSON.parse(bytes):{},fn=u.pathname.split('/').at(-1);
  if(u.pathname.startsWith('/rest/v1/rpc/')){
   if(fn==='kads_motor_arrendar'){if(dueno && dueno!==b.p_dueno && vence>Date.now())return json(null);if(dueno!==b.p_dueno)cerca++;dueno=b.p_dueno;vence=Date.now()+90000;return json(cerca);}
   if(fn==='kads_motor_soltar'){vence=0;return json(true);}
   if(fn==='kads_motor_tomar'){const p=[...pedidos.values()].find(p=>p.estado==='pendiente');if(!p)return json([]);p.estado='trabajando';return json([p]);}
   if(fn==='kads_motor_contestar'){const p=pedidos.get(b.p_id);p.respuesta=b.p_sobre;p.estado=b.p_final?'listo':'trabajando';return json(true);}
   if(fn==='kads_motor_guardar'){actual=b.p_objeto;return json(true);}
   if(fn==='kads_motor_encolar'){pedidos.set(b.p_id,{id:b.p_id,sobre:b.p_sobre,estado:'pendiente'});return json(b.p_id);}
   if(fn==='kads_motor_cancelar')return json(true);
   throw new Error('RPC no prevista: '+fn);
  }
  if(fn==='kads_motor_estado')return json(actual?[{objeto:actual}]:[]);
  if(fn==='kads_motor_lider')return json([{vence:new Date(vence).toISOString()}]);
  if(fn==='kads_motor_pedidos')return json([pedidos.get(u.searchParams.get('id')?.replace('eq.',''))]);
  if(fn==='kads_motor_subidas')return json([]);
  throw new Error('Ruta no prevista');
 }catch{res.statusCode=500;json({error:'fallo del simulador'});}
});
await new Promise(r=>servidor.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${servidor.address().port}`,clave=crypto.randomBytes(32).toString('hex');
const env={...process.env,KADS_MODO:'vercel',KADS_RAIZ:raiz,KADS_HOME:hogar,KADS_SUPABASE_URL:url,KADS_SUPABASE_SERVICE_ROLE:'servicio-falso',KADS_SUPABASE_ANON:'anon-falso',KADS_CIFRADO:clave,KADS_URL_PUBLICA:'https://kads-prueba.vercel.app',ANUNCIOS_MODO_PRUEBA:'1'};
const puente=http.createServer(crearPuerta({sb:supabase({url,secret:'servicio-falso'}),key:llave(clave),origen:env.KADS_URL_PUBLICA}));await new Promise(r=>puente.listen(0,'127.0.0.1',r));
const entrada=`http://127.0.0.1:${puente.address().port}`;
async function arrancar(){
 motor=spawn(process.execPath,['/opt/kads/deploy/nube/arrancar.mjs'],{env,stdio:'inherit'});
 for(let i=0;i<180;i++){
  if(motor.exitCode!==null)throw new Error('El supervisor salió antes de arrancar.');
  if(vence>Date.now()){
   const r=await pedirLocal(entrada+'/entrar',{headers:{host:'kads-prueba.vercel.app'},signal:AbortSignal.timeout(5000)}).catch(()=>null);
   if(r?.ok){assert.match(await r.text(),/Google/);return;}
  }
  await esperar(1000);
 }
 throw new Error('El motor no arrancó a tiempo.');
}
async function parar(){const p=motor;if(!p || p.exitCode!==null)return;let reloj;p.kill('SIGTERM');try{await Promise.race([new Promise((r,j)=>p.once('exit',c=>c===0?r():j(new Error('Cierre no limpio.')))),new Promise((_,j)=>{reloj=setTimeout(()=>{p.kill('SIGKILL');j(new Error('No drenó el motor.'));},60000);})]);}finally{clearTimeout(reloj);}}
try{
 await arrancar();await fs.mkdir(path.join(raiz,'mis_archivos'),{recursive:true});await fs.writeFile(path.join(raiz,'mis_archivos/avatar-prueba.bin'),Buffer.alloc(1024,73));
 // El root de pruebas se apropia de este archivo; el supervisor lo respalda y vuelve a asignar al UID del motor.
 await parar();assert(actual,'Se confirmó un manifiesto antes de cerrar');
 await fs.rm(raiz,{recursive:true,force:true});await fs.rm(hogar,{recursive:true,force:true});
 await arrancar();assert.deepEqual(await fs.readFile(path.join(raiz,'mis_archivos/avatar-prueba.bin')),Buffer.alloc(1024,73));
 await parar();console.log('OK motor real: API por cola, cierre limpio, disco borrado, restauración cifrada y nuevo arranque.');
}finally{if(motor?.exitCode===null)motor.kill('SIGKILL');puente.closeAllConnections();servidor.closeAllConnections();puente.close();servidor.close();await fs.rm(tmp,{recursive:true,force:true});}

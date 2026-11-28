import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {Readable} from 'node:stream';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
import {llave,cifrar,descifrar,sellar,abrir,rutaSegura,supabase,pedirLocal} from '../../deploy/nube/comun.mjs';
import {crearEstado,almacenLocal} from '../../deploy/nube/estado.mjs';
import {respaldoLocal,restaurarLocal} from '../../deploy/nube/respaldo.mjs';
import {crearPuerta} from '../../deploy/nube/puerta.mjs';
import {ejecutarPedido} from '../../deploy/nube/motor.mjs';
const key=crypto.randomBytes(32),temporal=()=>fs.mkdtemp(path.join(os.tmpdir(),'kads-nube-test-'));
const levantar=async(fn)=>{const s=http.createServer(fn);await new Promise(r=>s.listen(0,'127.0.0.1',r));return {s,url:`http://127.0.0.1:${s.address().port}`,cerrar:()=>new Promise(r=>s.close(r))};};
test('sobres cifrados, manipulación y validación de rutas',()=>{
 const b=cifrar(Buffer.from('credencial solo de prueba'),key);assert.equal(descifrar(b,key).toString(),'credencial solo de prueba');
 assert(!b.includes(Buffer.from('credencial')));b[20]^=1;assert.throws(()=>descifrar(b,key));
 assert.throws(()=>llave('corta'));assert.throws(()=>rutaSegura('//externo'));assert.throws(()=>rutaSegura('/api/\nmal'));
 assert.deepEqual(abrir(sellar({a:3},key),key),{a:3});
});
test('la extensión admite Kads HTTPS sin conceder acceso global ni aceptar destinos inseguros',async()=>{
 const contexto=vm.createContext({URL});vm.runInContext(await fs.readFile(new URL('../../extension-chrome/direccion.js',import.meta.url),'utf8'),contexto);
 assert.equal(contexto.direccionKads('https://kads.vercel.app/'),'https://kads.vercel.app');assert.equal(contexto.direccionKads('http://localhost:4455'),'http://localhost:4455');
 for(const d of ['http://remoto.invalid','javascript:alert(1)','https://usuario:clave@remoto.invalid','https://remoto.invalid/otra-ruta','https://remoto.invalid/?codigo=secreto'])assert.equal(contexto.direccionKads(d),null);
 const m=JSON.parse(await fs.readFile(new URL('../../extension-chrome/manifest.json',import.meta.url),'utf8'));assert(!m.host_permissions.includes('https://*/*'));assert(m.optional_host_permissions.includes('https://*/*'));
});
test('estado cifrado: cambios, borrado, bloques y restauración independiente',async()=>{
 const tmp=await temporal();try{
 const root=path.join(tmp,'a'),dest=path.join(tmp,'b'),storage=new Map();await fs.mkdir(path.join(root,'temp'),{recursive:true});
 await fs.writeFile(path.join(root,'temp/estado.json'),'secreto ficticio');await fs.writeFile(path.join(root,'temp/grande'),Buffer.alloc(9*1024**2,42));
 let actual;const almacen={put:async(n,b)=>storage.set(n,Buffer.from(b)),get:async n=>storage.get(n)};
 const estado=crearEstado({raiz:root,key,almacen,publicar:async o=>{actual=o;}});await estado.guardar();const primero=actual;
 assert.equal(await estado.guardar(),null);assert([...storage.values()].every(b=>!b.includes(Buffer.from('secreto ficticio'))));
 await fs.rm(path.join(root,'temp/estado.json'));await fs.writeFile(path.join(root,'temp/nuevo'),'resultado');await estado.guardar();assert.notEqual(actual,primero);
 await crearEstado({raiz:dest,key,almacen}).restaurar(actual);assert.equal(await fs.readFile(path.join(dest,'temp/nuevo'),'utf8'),'resultado');
 await assert.rejects(fs.access(path.join(dest,'temp/estado.json')));assert.equal((await fs.stat(path.join(dest,'temp/grande'))).size,9*1024**2);
 const malo=new Map(storage),bloque=[...malo.keys()].find(n=>n.startsWith('bloques/'));const roto=Buffer.from(malo.get(bloque));roto[18]^=1;malo.set(bloque,roto);
 await assert.rejects(crearEstado({raiz:path.join(tmp,'c'),key,almacen:{get:async n=>malo.get(n)}}).restaurar(primero));
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
});
test('restaurar rechaza rutas fuera de Kads y padres con enlaces',async()=>{
 const tmp=await temporal();try{
 const manifiesto={formato:1,entradas:[{ruta:'raiz/../fuera',bytes:0,partes:[],modo:384}]};
 await assert.rejects(crearEstado({raiz:tmp,key,almacen:{get:async()=>cifrar(Buffer.from(JSON.stringify(manifiesto)),key,'manifiesto')}}).restaurar('versiones/prueba'));
 await fs.mkdir(path.join(tmp,'fuera'));await fs.symlink(path.join(tmp,'fuera'),path.join(tmp,'temp'));
 manifiesto.entradas[0].ruta='raiz/temp/no';
 await assert.rejects(crearEstado({raiz:tmp,key,almacen:{get:async()=>cifrar(Buffer.from(JSON.stringify(manifiesto)),key,'manifiesto')}}).restaurar('versiones/prueba'));
 assert.deepEqual(await fs.readdir(path.join(tmp,'fuera')),[]);
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
});
test('respaldar mientras se produce un archivo no bloquea otras secciones ni publica bytes a medio escribir',async()=>{
 const tmp=await temporal();try{
 const raiz=path.join(tmp,'a');await fs.mkdir(path.join(raiz,'temp'),{recursive:true});await fs.writeFile(path.join(raiz,'temp/clip.mp4'),'primer trozo');
 const objetos=new Map();let cambiar=true,actual;
 const almacen={put:async(n,b)=>{objetos.set(n,b);if(cambiar && n.startsWith('bloques/')){cambiar=false;await fs.appendFile(path.join(raiz,'temp/clip.mp4'),' segundo trozo');}},get:async n=>objetos.get(n)};
 const e=crearEstado({raiz,key,almacen,publicar:async n=>{actual=n;}});await e.guardar();let m=JSON.parse(descifrar(objetos.get(actual),key,'manifiesto'));assert.deepEqual(m.pendientes,['raiz/temp/clip.mp4']);assert.equal(m.entradas.length,0);
 await e.guardar();m=JSON.parse(descifrar(objetos.get(actual),key,'manifiesto'));assert.equal(m.pendientes.length,0);assert.equal(m.entradas[0].bytes,26);
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
});
test('respaldo Contabo local: llave separada, permisos y restauración sin pisar datos',async()=>{
 const tmp=await temporal();try{
 const raiz=path.join(tmp,'app'),destino=path.join(tmp,'respaldo'),archivoLlave=path.join(tmp,'llave');await fs.mkdir(path.join(raiz,'mis_archivos'),{recursive:true});await fs.writeFile(path.join(raiz,'mis_archivos/avatar.json'),'avatar ficticio');
 await respaldoLocal({raiz,destino,archivoLlave});assert.equal((await fs.stat(archivoLlave)).mode&0o777,0o600);
 const salida=path.join(tmp,'restaurada');await restaurarLocal({origen:destino,destino:salida,archivoLlave});assert.equal(await fs.readFile(path.join(salida,'mis_archivos/avatar.json'),'utf8'),'avatar ficticio');
 await assert.rejects(restaurarLocal({origen:destino,destino:salida,archivoLlave}));
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
});
function baseFalsa(){
 const jobs=new Map(),files=new Map(),tickets=new Map(),tramos=new Map();
 const sb={jobs,files,tickets,tramos,async rpc(fn,d){
  if(fn==='kads_motor_encolar'){jobs.set(d.p_id,{id:d.p_id,sobre:d.p_sobre,estado:'pendiente'});return d.p_id;}
  if(fn==='kads_motor_contestar'){const p=jobs.get(d.p_id);p.respuesta=d.p_sobre;p.estado=d.p_final?'listo':'trabajando';return true;}
  if(fn==='kads_motor_tramo'){const a=tramos.get(d.p_id)||[];a.push({n:d.p_n,sobre:d.p_sobre});tramos.set(d.p_id,a);return true;}
  if(fn==='kads_motor_nueva_subida'){tickets.set(d.p_id,{usuario:d.p_usuario,ruta:d.p_ruta,metodo:d.p_metodo,objeto:d.p_objeto});return true;}
  if(fn==='kads_motor_usar_subida'){const t=tickets.get(d.p_id);if(!t || t.usado || t.usuario!==d.p_usuario || t.ruta!==d.p_ruta || t.metodo!==d.p_metodo)return null;t.usado=true;return t.objeto;}
  throw new Error(fn);
 },async tabla(t,q,opt){
  if(t==='kads_motor_lider')return [{vence:new Date(Date.now()+90000).toISOString()}];
  if(t==='kads_motor_pedidos')return [jobs.get(q.match(/id=eq\.([^&]+)/)[1])];
  if(t==='kads_motor_tramos')return (tramos.get(q.match(/pedido=eq\.([^&]+)/)[1]) || []).filter(x=>x.n>Number(q.match(/n=gt\.([^&]+)/)[1]));
  if(t==='kads_motor_subidas'){tickets.set(opt.body.id,opt.body);return null;}
 },async put(bucket,n,b){files.set(n,Buffer.from(b));},async putStream(bucket,n,body){const b=[];for await(const p of body)b.push(p);files.set(n,Buffer.concat(b));},
 async get(bucket,n){return files.get(n);},async stream(bucket,n){return Readable.toWeb(Readable.from([files.get(n)]));},async firmar(bucket,n){return 'https://almacen.invalid/'+n;},async subirFirmado(bucket,n){return 'https://almacen.invalid/subir/'+n;},async borrar(){}};
 return sb;
}
test('puerta → cola cifrada → motor: cookies, copia de cabeceras, HTML, archivos grandes y Range',async()=>{
 const sb=baseFalsa();let recibida,guardados=0;
 const origen='https://kads-prueba.vercel.app';
 const motor=await levantar(async(req,res)=>{recibida={url:req.url,host:req.headers.host,proto:req.headers['x-forwarded-proto']};
  if(req.url==='/grande'){res.setHeader('Content-Type','video/mp4');res.statusCode=206;res.setHeader('Content-Range','bytes 0-699999/1000000');res.end(Buffer.alloc(700000,31));}
  else{res.setHeader('Set-Cookie',['uno=1; HttpOnly; Secure','dos=2; HttpOnly; Secure']);res.setHeader('Content-Type','text/html');res.end('<html><head></head><body>listo</body></html>');}
 });
 const puerta=crearPuerta({sb,key,origen,fetcher:async(url,opts)=>url.endsWith('/auth/v1/user')?Response.json({id:'cuenta-de-prueba'}):url.startsWith('https://almacen.invalid/')?new Response(sb.files.get(url.replace('https://almacen.invalid/',''))):fetch(url,opts),dormir:async()=>new Promise(r=>setTimeout(r,1))});
 const web=await levantar(puerta),pendientes=new Set();
 const timer=setInterval(()=>{for(const p of sb.jobs.values())if(p.estado==='pendiente' && !pendientes.has(p.id)){pendientes.add(p.id);p.estado='trabajando';ejecutarPedido({pedido:p,sb,key,dueno:crypto.randomUUID(),cerca:1,estado:{guardar:async()=>{guardados++;}},urlLocal:motor.url,origen}).catch(()=>{});}},2);
 try{
  let r=await pedirLocal(web.url+'/entrar',{headers:{host:'kads-prueba.vercel.app'}});assert.equal(r.status,200);assert.equal(r.headers.getSetCookie().length,2);assert.match(await r.text(),/kads-nube.js/);assert.equal(recibida.host,'kads-prueba.vercel.app');assert.equal(recibida.proto,'https');
  r=await pedirLocal(web.url+'/grande',{headers:{host:'kads-prueba.vercel.app',cookie:'kads_sesion=prueba',range:'bytes=0-699999'}});assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),'bytes 0-699999/1000000');assert.equal((await r.arrayBuffer()).byteLength,700000);
  r=await pedirLocal(web.url+'/api/ejemplo',{method:'POST',headers:{host:'kads-prueba.vercel.app',cookie:'kads_sesion=prueba',origin:origen},body:'datos'});assert.equal(r.status,200);assert.equal(guardados,1);
  assert([...sb.jobs.values()].every(p=>!p.sobre.includes('prueba')));
  r=await pedirLocal(web.url+'/api/ejemplo',{method:'POST',headers:{host:'kads-prueba.vercel.app',origin:'https://ajeno.invalid'}});assert.equal(r.status,403);
  r=await pedirLocal(web.url+'/api/ejemplo',{headers:{host:'kads-prueba.vercel.app'}});assert.equal(r.status,401);
  r=await pedirLocal(web.url+'/entrar',{headers:{host:'ajeno.invalid'}});assert.equal(r.status,421);
 }finally{clearInterval(timer);await web.cerrar();await motor.cerrar();}
});
test('subida privada exige cuenta aprobada y sección; ticket queda vinculado a ruta y método',async()=>{
 const sb=baseFalsa();let acceso={rol:'empleado',secciones:['landings']};
 const fetcher=async url=>Response.json(url.endsWith('/auth/v1/user')?{id:'usuario'}:acceso);
 const p=await levantar(crearPuerta({sb,key,origen:'https://kads.vercel.app',fetcher}));
 try{
  const pedir=(ruta,galleta='kads_sesion=falsa')=>pedirLocal(p.url+'/api/nube/subida',{method:'POST',headers:{host:'kads.vercel.app',cookie:galleta,'content-type':'application/json'},body:JSON.stringify({ruta,metodo:'POST',bytes:2000000})});
  assert.equal((await pedir('/api/landings/fotos','')).status,403);
  assert.equal((await pedir('/api/biblioteca')).status,403);
  let r=await pedir('/api/landings/fotos');assert.equal(r.status,200);const d=await r.json();assert.match(d.url,/https:\/\/almacen.invalid/);assert.equal(sb.tickets.get(d.id).ruta,'/api/landings/fotos');
  assert.equal(await sb.rpc('kads_motor_usar_subida',{p_id:d.id,p_usuario:'otro',p_ruta:'/api/landings/fotos',p_metodo:'POST'}),null);
  acceso={rol:'pendiente',secciones:[]};assert.equal((await pedir('/api/landings/fotos')).status,403);
 }finally{await p.cerrar();}
});
test('eventos en vivo atraviesan el transporte y terminan sin cambiar sus datos',async()=>{
 const sb=baseFalsa(),id=crypto.randomUUID();
 const motor=await levantar((req,res)=>{res.setHeader('Content-Type','text/event-stream');res.write('data: {"paso":1}\n\n');setTimeout(()=>res.end('data: {"paso":2}\n\n'),10);});
 const p={id,sobre:sellar({ruta:'/api/salud/en-vivo',metodo:'GET',headers:[]},key)};sb.jobs.set(id,{...p,estado:'trabajando'});
 try{await ejecutarPedido({pedido:p,sb,key,dueno:crypto.randomUUID(),cerca:1,estado:{guardar:async()=>{}},urlLocal:motor.url,origen:'https://kads.vercel.app'});
 const dato=abrir(sb.jobs.get(id).respuesta,key);assert(dato.stream && dato.fin);
 assert.equal(sb.tramos.get(id).map(x=>Buffer.from(abrir(x.sobre,key).body,'base64').toString()).join(''),'data: {"paso":1}\n\ndata: {"paso":2}\n\n');
 }finally{await motor.cerrar();}
});
test('una actualización en Vercel se delega al despliegue, sin sobrescribir el contenedor',async()=>{
 const sb=baseFalsa(),id=crypto.randomUUID(),p={id,sobre:sellar({ruta:'/api/actualizar/publica',metodo:'POST',headers:[],actualizar:true},key)};sb.jobs.set(id,{...p,estado:'trabajando'});
 let llamada=false;await ejecutarPedido({pedido:p,sb,key,dueno:crypto.randomUUID(),cerca:1,desplegar:async()=>{llamada=true;return {ok:true,reinicia:true};},fetcher:()=>{throw new Error('No se debe ejecutar el actualizador local.');}});
 assert(llamada);assert.equal(abrir(sb.jobs.get(id).respuesta,key).status,200);
});
test('SQL real: migración repetible, fencing, sin repetición ciega de acciones y denegación a usuarios',async(t)=>{
 const ubicacion=process.env.PGLITE_PACKAGE_PATH;if(!ubicacion){t.skip('Define PGLITE_PACKAGE_PATH para ejecutar PostgreSQL aislado.');return;}
 const {PGlite}=await import(pathToFileURL(path.join(ubicacion,'dist/index.js')).href),db=new PGlite();
 try{
 await db.exec("create role anon; create role authenticated; create role service_role; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);");
 const sql=await fs.readFile(new URL('../../deploy/supabase-motor.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 const a=crypto.randomUUID(),b=crypto.randomUUID(),j=crypto.randomUUID();
 let r=await db.query('select kads_motor_arrendar($1) f',[a]);const f=r.rows[0].f;
 assert.equal((await db.query('select kads_motor_arrendar($1) f',[b])).rows[0].f,null);
 await db.query('select kads_motor_encolar($1,$2,$3,30)',[j,'cliente','cifrado']);
 assert.equal((await db.query('select * from kads_motor_tomar($1,$2)',[a,f])).rows.length,1);
 await db.exec("update kads_motor_lider set vence=now()-interval '1 minute'");
 const f2=(await db.query('select kads_motor_arrendar($1) f',[b])).rows[0].f;assert(Number(f2)>Number(f));
 assert.equal((await db.query('select estado from kads_motor_pedidos')).rows[0].estado,'incierto');
 assert.equal((await db.query('select kads_motor_contestar($1,$2,$3,$4,true) ok',[a,f,j,'tarde'])).rows[0].ok,false);
 const subida=crypto.randomUUID(),usuario=crypto.randomUUID();await db.query("insert into kads_motor_subidas(id,usuario,ruta,metodo,objeto) values($1,$2,'/api/material','POST','entrada-falsa')",[subida,usuario]);
 assert.equal((await db.query("select kads_motor_usar_subida($1,$2,'/api/ajena','POST') o",[subida,usuario])).rows[0].o,null);
 assert.equal((await db.query("select kads_motor_usar_subida($1,$2,'/api/material','POST') o",[subida,usuario])).rows[0].o,'entrada-falsa');
 assert.equal((await db.query("select kads_motor_usar_subida($1,$2,'/api/material','POST') o",[subida,usuario])).rows[0].o,null);
 await assert.rejects(db.query('select kads_motor_encolar($1,$2,$3,1)',[crypto.randomUUID(),'cliente','otro']));
 await db.exec('set role authenticated');await assert.rejects(db.query('select * from kads_motor_pedidos'));await assert.rejects(db.query('select kads_motor_arrendar($1)',[a]));await db.exec('reset role');
 }finally{await db.close();}
});

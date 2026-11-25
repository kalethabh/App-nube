// Solo crea y mueve fixtures propios; no usa servicios de pago ni borra datos personales.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
process.env.PUERTO='4502';process.env.ANUNCIOS_NO_RETOMAR='1';process.env.ANUNCIOS_MODO_PRUEBA='1';
const {TEMP,OUTPUT}=await import('../server/lib/rutas.js');
const {borrarGeneraciones}=await import('../server/lib/borrar-generaciones.js');
const token=crypto.randomBytes(6).toString('hex'), productoId=`borrado-${token}`,creados=[],archivados=[];
const escribir=(f,v)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(v));};
function fixture(tipo,n=1,etapa='listo') {
 const id=tipo==='imagenes'?`_img-borrado-${token}-20261124-000${n}`:tipo==='embudo'?`e-${n===1?token:crypto.randomBytes(6).toString('hex')}`:`${tipo==='sketch'?'sketch':tipo==='cambiar'?'cambio':tipo==='landings'?'landing-borrado':'video-borrado'}-${token}-${n}`;
 const dir=path.join(TEMP,tipo==='landings'?`_landings/${id}`:tipo==='embudo'?`_embudo-${id}`:id);
 assert.equal(fs.existsSync(dir),false);creados.push(dir);fs.mkdirSync(dir,{recursive:true});
 const base={id,productoId,nombre:'Fixture de borrado',titulo:'Fixture de borrado',producto:'Fixture de borrado',puerto:4502,creado:new Date().toISOString(),etapa,estado:etapa};
 if(tipo==='imagenes')escribir(path.join(dir,'app/brief.json'),{...base,familia:'imagen-ads',cantidad:1,formatos:['1:1']});
 if(tipo==='videos'){escribir(path.join(dir,'app/brief.json'),{...base,estilo:'crochet'});escribir(path.join(dir,'app/sesion.json'),{estado:'listo',uuid:`fixture-${token}`});}
 if(tipo==='sketch' || tipo==='cambiar')escribir(path.join(dir,`app/${tipo==='sketch'?'sketch':'cambio'}-estado.json`),base);
 if(tipo==='landings')escribir(path.join(dir,'landing.json'),{...base,estado:'lista',url:'https://example.com/fixture'});
 if(tipo==='embudo')escribir(path.join(dir,'embudo.json'),{...base,reglasVisuales:4,planificadorVersion:2,trabajos:{},imagenes:{},duenos:{}});
 fs.writeFileSync(path.join(dir,'recurso.txt'),'archivo conservado');
 return {id,dir};
}
try {
 for(const tipo of ['imagenes','videos','embudo','landings','sketch','cambiar']) {
  const {id,dir}=fixture(tipo);
  assert.throws(()=>borrarGeneraciones(tipo,{ids:[id],grupo:'producto:otro'}),e=>e.status===409);assert.ok(fs.existsSync(dir));
  const video=path.join(OUTPUT,`${id}_fixture.mp4`);if(['videos','sketch','cambiar'].includes(tipo)){assert.ok(!fs.existsSync(video));fs.mkdirSync(OUTPUT,{recursive:true});fs.writeFileSync(video,'video de prueba');creados.push(video);}
  const r=borrarGeneraciones(tipo,{ids:[id,id],grupo:`producto:${productoId}`});assert.deepEqual(r.eliminados,[id]);assert.equal(r.ok,true);assert.equal(fs.existsSync(dir),false);
  const destino=path.join(TEMP,'_descartados',path.basename(dir));archivados.push(destino);assert.equal(fs.readFileSync(path.join(destino,'recurso.txt'),'utf8'),'archivo conservado');
  if(['videos','sketch','cambiar'].includes(tipo)){assert.ok(!fs.existsSync(video));assert.ok(fs.existsSync(path.join(destino,'output',path.basename(video))));}
  console.log(`OK ${tipo}: borra solo la generación elegida, conserva archivos en papelera y mueve salidas propias`);
 }
 const a=fixture('sketch',2),b=fixture('sketch',3,'escribiendo');
 assert.throws(()=>borrarGeneraciones('sketch',{ids:[a.id,b.id],grupo:`producto:${productoId}`}),e=>e.status===409);assert.ok(fs.existsSync(a.dir));assert.ok(fs.existsSync(b.dir));
 assert.throws(()=>borrarGeneraciones('landings',{ids:['../_productos']}),e=>e.status===409);
 assert.throws(()=>borrarGeneraciones('__proto__',{ids:['x']}),e=>e.status===400);
 assert.throws(()=>borrarGeneraciones('imagenes',{ids:[]}),e=>e.status===400);
 const nuevo=fixture('imagenes',4);assert.throws(()=>borrarGeneraciones('imagenes',{ids:[nuevo.id,'no-existe']}),e=>e.status===409);assert.ok(fs.existsSync(nuevo.dir));
 const segundo=fixture('imagenes',5),posterior=fixture('imagenes',6);
 const grupo=borrarGeneraciones('imagenes',{ids:[nuevo.id,segundo.id],grupo:`producto:${productoId}`});assert.equal(grupo.eliminados.length,2);assert.ok(fs.existsSync(posterior.dir),'Una generación fuera del alcance confirmado se conserva');
 for(const f of [nuevo,segundo])archivados.push(path.join(TEMP,'_descartados',path.basename(f.dir)));
 console.log('OK validación completa antes de mover: activos, carpeta ajena, identificadores inválidos y proyecto desaparecido');
 console.log('OK borrado conjunto de dos generaciones; conserva las nuevas o ajenas a la confirmación');
 const bloqueado=fixture('imagenes',7),libre=fixture('imagenes',8),rename=fs.renameSync;
 let parcial;
 try {fs.renameSync=(de,a)=>{if(de===bloqueado.dir)throw Object.assign(new Error('Archivo de prueba abierto'),{code:'EIO'});return rename(de,a);};parcial=borrarGeneraciones('imagenes',{ids:[bloqueado.id,libre.id],grupo:`producto:${productoId}`});}finally{fs.renameSync=rename;}
 archivados.push(path.join(TEMP,'_descartados',path.basename(libre.dir)));
 assert.equal(parcial.ok,false);assert.deepEqual(parcial.eliminados,[libre.id]);assert.equal(parcial.errores[0].id,bloqueado.id);assert.ok(fs.existsSync(bloqueado.dir));assert.ok(!fs.existsSync(libre.dir));
 console.log('OK fallo parcial de archivo abierto: informa qué se movió y qué queda pendiente sin perderlo');
}finally{
 for(const f of [...creados,...archivados])fs.rmSync(f,{recursive:true,force:true});
}

// Navegación real con proyectos sintéticos en las seis secciones. Ningún proveedor recibe solicitudes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { pathToFileURL,fileURLToPath } from 'node:url';
import { proyectosDe,agruparProyectos } from '../src/pantallas/generacion/datos.js';
const APP=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'), RAIZ=path.dirname(APP), puerto=4496, base=`http://127.0.0.1:${puerto}`;
const producto={id:'producto-prueba',nombre:'Producto de prueba'}, fecha='2026-11-24T12:00:00Z';
const comun={productoId:producto.id,titulo:'Proyecto de prueba',nombre:'Proyecto de prueba',producto:producto.nombre,creado:fecha,actualizado:fecha,estado:'lista',etapa:'listo'};
const dos=(key)=>[1,2].map(n=>({...comun,[key]:`proyecto-${n}`}));
const fixtures={
 '/api/productos':{productos:[producto]},
 '/api/imagen-ads':{lotes:dos('lote')},
 '/api/anuncios':{anuncios:[...dos('slug').map(x=>({...x,estilo:'crochet'})),{...comun,slug:'otro-estilo',estilo:'claymation'}]},
 '/api/embudos':{embudos:dos('id'),productos:[]},
 '/api/landings':{landings:dos('id').map(x=>({...x,url:'https://example.com/producto',progreso:[],modo:'clonar'}))},
 '/api/sketch':{sketches:dos('slug')},
 '/api/cambiar':{trabajos:dos('slug')},
};
const mezclados=proyectosDe('imagenes',{lotes:[...dos('lote'),{lote:'antiguo-1',titulo:producto.nombre},{lote:'antiguo-2',titulo:producto.nombre},{...comun,lote:'otro-id',productoId:'otro-producto'}]},[producto]);
const grupos=agruparProyectos(mezclados);
assert.equal(grupos.length,4);assert.equal(grupos.find(x=>x.id===`producto:${producto.id}`).proyectos.length,2);
assert.equal(grupos.filter(x=>x.id.startsWith('proyecto:')).length,2);
assert.equal(proyectosDe('videos',fixtures['/api/anuncios'],[producto],'crochet').length,2);
assert.equal(proyectosDe('videos',fixtures['/api/anuncios'],[producto],'crochet',true).length,0);
console.log('OK Agrupa por identificador, conserva proyectos antiguos y separa estilos y productos homónimos');
const env={...process.env,PUERTO:String(puerto),ANUNCIOS_MODO_PRUEBA:'1',ANUNCIOS_BIBLIOTECA_PRUEBA:'1',ANUNCIOS_NO_RETOMAR:'1',ANUNCIOS_SIN_GUARDADO:'1',AIA_MOTOR:'claude',ANUNCIOS_CLAUDE_BIN:path.join(APP,'server/claude/pruebas/claude-falso.js')};
for(const k of Object.keys(env))if(/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|OPENAI_|CODEX_)/i.test(k))delete env[k];
const dir=fs.mkdtempSync(path.join(RAIZ,'temp/_probar-carpetas-')), log=fs.createWriteStream(path.join(dir,'servidor.log'));
const server=cp.spawn(process.execPath,['server/index.js'],{cwd:APP,env,stdio:['ignore','pipe','pipe'],detached:true});server.stdout.pipe(log);server.stderr.pipe(log);
const dormir=ms=>new Promise(r=>setTimeout(r,ms));let browser;
try{
 for(let n=0;n<80;n++){try{if((await fetch(base+'/api/estilos')).ok)break;}catch{}await dormir(300);}
 const {chromium}=await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE_PATH,'index.mjs')).href);
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROME});
 const p=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}), errores=[],mutaciones=[];
 p.on('pageerror',e=>errores.push(e.message));
 await p.route('**/api/**',async route=>{
  const u=new URL(route.request().url());
  if(route.request().method()!=='GET'){mutaciones.push(u.pathname);await route.fulfill({status:405,json:{error:'Prueba de lectura'}});return;}
  if(fixtures[u.pathname]){await route.fulfill({json:fixtures[u.pathname]});return;}
  try {const r=await route.fetch();if(u.pathname==='/api/ajustes')await route.fulfill({response:r,json:{...await r.json(),bienvenidaVista:true}});else await route.fulfill({response:r});}catch{await route.fulfill({json:{}});}
 });
 await p.route('**/landing/**',route=>route.fulfill({contentType:'text/html',body:'<html><body>Vista de prueba</body></html>'}));
 const secciones=[['imagenes','/imagenes','Crear anuncios de imagen'],['videos','/nuevo?estilo=crochet','Crear anuncio de video'],['embudo','/embudo-whatsapp','Crear embudo'],['landings','/landings','Crear landing'],['sketch','/sketch','Crear sketch'],['cambiar','/cambiar','Crear cambio de producto']];
 for(const [tipo,ruta,accion] of secciones){
  await p.goto(base+'/#'+ruta);await p.locator('.ge-carpeta').waitFor();assert.equal(await p.locator('.ge-carpeta').count(),1);
  assert.match(await p.locator('.ge-carpeta').innerText(),/2 generaciones guardadas/);
  await p.getByLabel('Buscar carpeta').fill('No existe');assert.equal(await p.locator('.ge-carpeta').count(),0);
  await p.getByLabel('Buscar carpeta').fill('Producto de prueba');await p.locator('.ge-carpeta').click();await p.locator('.ge-proyecto').first().waitFor();
  assert.equal(await p.locator('.ge-proyecto').count(),2);
  const direccion=p.url();await p.reload();await p.locator('.ge-proyecto').first().waitFor();assert.equal(p.url(),direccion);
  const crear=await p.getByRole('link',{name:accion,exact:true}).getAttribute('href');assert.ok(crear.includes(tipo==='imagenes'?'/imagenes/nuevo':'crear=1'));
  if(tipo==='videos'){assert.match(crear,/estilo=crochet/);assert.match(crear,/producto=producto-prueba/);}
  if(tipo==='landings'){
   await p.locator('.ge-proyecto').first().click();await p.locator('.ld-item').waitFor();assert.equal(await p.locator('.ld-item').count(),1);assert.equal(await p.locator('.ld-nueva').count(),0);assert.ok(p.url().includes('proyecto='));await p.getByRole('link',{name:'Carpetas de Landings',exact:true}).click();await p.locator('.ge-carpeta').waitFor();
  }else{await p.getByRole('link',{name:'Todas las carpetas',exact:true}).click();await p.locator('.ge-carpeta').waitFor();}
  console.log(`OK ${tipo}: carpetas, búsqueda, generaciones, recarga y acceso a creación`);
 }
 // Las seis entradas de creación siguen disponibles; abrirlas nunca inicia una generación.
 for(const ruta of ['/nuevo?crear=1','/nuevo?inicio=1','/embudo-whatsapp?crear=1','/landings?crear=1','/sketch?crear=1','/cambiar?crear=1','/imagenes/nuevo']){
  await p.goto(base+'/#'+ruta);await p.locator('.ge-volver,.img-crear__arriba').first().waitFor();assert.equal(await p.getByText('Esta pantalla tuvo un problema',{exact:true}).count(),0);
 }
 await p.goto(base+'/#/imagenes');await p.locator('.ge-carpeta').waitFor();
 const capturas=process.env.CARPETAS_CAPTURAS;if(capturas){fs.mkdirSync(capturas,{recursive:true});await p.screenshot({animations:'disabled',path:path.join(capturas,'carpetas-oscuro.png')});}
 await p.getByRole('button',{name:'Cambiar a modo claro',exact:true}).click();
 if(capturas)await p.screenshot({animations:'disabled',path:path.join(capturas,'carpetas-claro.png')});
 await p.setViewportSize({width:390,height:844});await p.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);
 if(capturas)await p.screenshot({animations:'disabled',path:path.join(capturas,'carpetas-movil.png'),fullPage:true});
 assert.deepEqual(errores,[]);assert.deepEqual(mutaciones,[]);
 console.log('OK Formularios, temas oscuro/claro, móvil sin desborde, sin errores ni solicitudes de generación');
} catch(e){console.error(e);process.exitCode=1;console.error('Registro: '+dir);}
finally{if(browser)await browser.close();try{process.kill(-server.pid,'SIGTERM');}catch{}await dormir(250);log.end();if(!process.exitCode)fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(path.join(RAIZ,`temp/_modo-prueba-${puerto}`),{recursive:true,force:true});}

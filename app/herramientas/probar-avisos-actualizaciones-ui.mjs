import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const APP=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),RAIZ=path.dirname(APP),puerto=4501,base=`http://127.0.0.1:${puerto}`;
const env={...process.env,PUERTO:String(puerto),ANUNCIOS_MODO_PRUEBA:'1',ANUNCIOS_BIBLIOTECA_PRUEBA:'1',ANUNCIOS_NO_RETOMAR:'1',ANUNCIOS_SIN_GUARDADO:'1',AIA_MOTOR:'claude',ANUNCIOS_CLAUDE_BIN:path.join(APP,'server/claude/pruebas/claude-falso.js')};
for(const k of Object.keys(env))if(/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|OPENAI_|CODEX_)/i.test(k))delete env[k];
const dir=fs.mkdtempSync(path.join(RAIZ,'temp/_probar-avisos-')),log=fs.createWriteStream(path.join(dir,'servidor.log'));
const server=cp.spawn(process.execPath,['server/index.js'],{cwd:APP,env,stdio:['ignore','pipe','pipe'],detached:true});server.stdout.pipe(log);server.stderr.pipe(log);
const dormir=ms=>new Promise(r=>setTimeout(r,ms));let browser;
try {
 for(let i=0;i<80;i++){try{if((await fetch(base+'/api/estilos')).ok)break;}catch{}await dormir(300);}
 const {chromium}=await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE_PATH,'index.mjs')).href);
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROME});
 const p=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errores=[],posts=[];p.on('pageerror',e=>errores.push(e.message));
 let modo='github',revision='uno',mostrar=true,reinicio=false,avisos=[];
 const resumen={version:'2026-11-24q',titulo:'Secciones y avisos más claros',cambios:['Genera secciones sin bloquear tus títulos.','Recibe avisos de tus landings.']};
 const l={id:'landing-fixture',titulo:'Landing de prueba',url:'https://example.com/producto',estado:'lista',creado:'2026-11-24T12:00:00Z',modo:'tal-cual',analisis:{resumen:'Una propuesta de valor seguida de beneficios.',secciones:[{n:1,tipo:'hero',titulo:'Tu rutina, más simple',objetivo:'Presentar la propuesta.',analisis:'La escena y el título presentan un uso cotidiano.',porQueFunciona:'Podría reducir el esfuerzo percibido.',mejora:'Precisar para quién es.',captura:{id:'S1',titulo:'Tu rutina, más simple',url:'/landing/landing-fixture/seccion-01.webp',fuente:'Captura de la copia analizada'}},{n:2,tipo:'beneficios',titulo:'Beneficios que puedes entender',objetivo:'Explicar el valor.',analisis:'Describe una aplicación práctica.',captura:{id:'S2',titulo:'Beneficios que puedes entender',url:'/landing/landing-fixture/seccion-02.webp'}}]}};
 await p.route('**/api/**',async route=>{
  const u=new URL(route.request().url()),metodo=route.request().method();
  if(metodo!=='GET'){
   posts.push(u.pathname);
   if(u.pathname==='/api/github/actualizar'){mostrar=false;await route.fulfill({json:{ok:true,mensaje:'Cambios instalados desde GitHub.',reabrir:true}});return;}
   if(u.pathname==='/api/reiniciar'){await route.fulfill({json:{ok:true,pendiente:true}});return;}
   if(u.pathname==='/api/actualizar/publica'){mostrar=false;await route.fulfill({json:{ok:true,version:resumen.version,mensaje:'Actualización instalada. Reinicia la app para activarla.',reabrir:true}});return;}
   if(/^\/api\/notificaciones\/[^/]+\/leer$/.test(u.pathname)){avisos=avisos.filter(n=>!u.pathname.includes(n.id));await route.fulfill({json:{ok:true}});return;}
   await route.fulfill({status:405,json:{error:'Mutación no esperada en esta prueba'}});return;
  }
  if(u.pathname==='/api/github/actualizar'){await route.fulfill({json:modo==='github'?{repositorio:true,atrasados:mostrar?2:0,ultimo:{fecha:revision,titulo:'Cambio de prueba'},resumen}:{repositorio:false}});return;}
  if(u.pathname==='/api/actualizar/publica'){await route.fulfill({json:{version:'2026-11-24p',nueva:resumen.version,hayNueva:modo==='publica'&&mostrar,notas:'- Fondos más cuidados.\n- Avisos de publicación.'}});return;}
  if(u.pathname==='/api/actualizar/resumen'){await route.fulfill({json:resumen});return;}
  if(u.pathname==='/api/notificaciones'){await route.fulfill({json:{notificaciones:avisos}});return;}
  if(u.pathname==='/api/landings'){await route.fulfill({json:{landings:[l]}});return;}
  if(u.pathname==='/api/imagen-ads'){await route.fulfill({json:{lotes:[]}});return;}
  try{const r=await route.fetch(),d=await r.json();if(u.pathname==='/api/estado')d.servidor={...d.servidor,desactualizado:reinicio,reinicioPedido:false,ocupado:false,interfaz:{armada:'estable',armando:false}};if(u.pathname==='/api/ajustes')d.bienvenidaVista=true;await route.fulfill({response:r,json:d});}catch{await route.fulfill({json:{}});}
 });
 await p.route('**/landing/**',async route=>{const u=new URL(route.request().url());if(u.pathname.endsWith('.webp')){const imagen=path.join(process.env.CAPTURAS_TEST_DIR,path.basename(u.pathname));await route.fulfill({contentType:'image/webp',body:fs.readFileSync(imagen)});}else await route.fulfill({contentType:'text/html',body:'<!doctype html><html><body>Landing de prueba</body></html>'});});
 const abrir=async()=>{await p.goto(base+'/#/imagenes');await p.reload();await p.getByRole('dialog').waitFor();};
 await abrir();assert.equal(await p.getByRole('dialog').count(),1);assert.ok(await p.getByText(resumen.cambios[0],{exact:true}).isVisible());
 const rect=await p.getByRole('dialog').boundingBox();assert.ok(rect.width>=500 && rect.width<=600);assert.ok(Math.abs(rect.x+rect.width/2-720)<3);if(process.env.AVISOS_CAPTURAS){fs.mkdirSync(process.env.AVISOS_CAPTURAS,{recursive:true});await p.screenshot({path:path.join(process.env.AVISOS_CAPTURAS,'actualizacion-oscuro.png'),animations:'disabled'});}
 await p.getByRole('button',{name:'Después',exact:true}).click();await p.reload();await p.locator('.ge').waitFor();assert.equal(await p.getByRole('dialog').count(),0);
 await p.getByRole('button',{name:'Actualizar',exact:true}).click();await p.getByRole('dialog').waitFor();assert.equal(await p.getByRole('dialog').count(),1);await p.getByRole('button',{name:'Después',exact:true}).click();
 revision='dos';await abrir();assert.equal(await p.getByRole('dialog').count(),1);await p.getByRole('button',{name:'Después',exact:true}).click();console.log('OK actualización GitHub: un diálogo central mediano con resumen, posponer por versión y reabrir desde Actualizar');
 await p.getByRole('button',{name:'Actualizar',exact:true}).click();await p.getByRole('dialog').waitFor();await p.getByRole('button',{name:'Actualizar ahora',exact:true}).click();await p.getByText('Cambios instalados desde GitHub.',{exact:true}).waitFor();await p.getByRole('button',{name:'Después',exact:true}).click();assert.equal(posts.filter(x=>x==='/api/github/actualizar').length,1);
 modo='publica';mostrar=true;await abrir();assert.ok(await p.getByText('Fondos más cuidados.',{exact:true}).isVisible());await p.getByRole('button',{name:'Actualizar ahora',exact:true}).click();await p.getByText('Actualización instalada. Reinicia la app para activarla.',{exact:true}).waitFor();assert.equal(posts.filter(x=>x==='/api/actualizar/publica').length,1);await p.getByRole('button',{name:'Después',exact:true}).click();console.log('OK actualización pública usa el mismo diálogo y confirma instalación sin duplicar ventanas');
 reinicio=true;await p.goto(base+'/#/imagenes');await p.reload();await p.getByRole('button',{name:'Actualizar',exact:true}).click();await p.getByRole('dialog').waitFor();assert.ok(await p.getByRole('button',{name:'Reiniciar la app',exact:true}).isVisible());await p.getByRole('button',{name:'Reiniciar la app',exact:true}).click();await p.getByText('La app se reiniciará cuando terminen los trabajos en curso.',{exact:true}).waitFor();await p.getByRole('button',{name:'Después',exact:true}).click();reinicio=false;
 avisos=[{id:'n-'+('1'.repeat(24)),titulo:'Landing lista',texto:'Tu landing está clonada y lista para revisar.',destino:'#/landings?proyecto=landing-fixture'},{id:'n-'+('2'.repeat(24)),titulo:'Landing publicada',texto:'La publicación está confirmada.',destino:'#/landings/tiendas',urlPublica:'https://example.com/pages/producto'}];
 await p.goto(base+'/#/imagenes');await p.locator('.nl-aviso').first().waitFor();assert.equal(await p.locator('.nl-aviso').count(),2);assert.equal(await p.getByRole('link',{name:'Ver página publicada',exact:true}).getAttribute('href'),'https://example.com/pages/producto');
 await p.getByRole('link',{name:'Ver landing',exact:true}).click();await p.locator('.ld-seccion-analizada').first().waitFor();assert.equal(await p.locator('.ld-seccion-analizada').count(),2);assert.equal(await p.locator('.ld-seccion-analizada img').count(),2);assert.ok(await p.getByRole('heading',{name:'Tu rutina, más simple',exact:true}).isVisible());assert.ok(await p.getByText('La escena y el título presentan un uso cotidiano.',{exact:true}).isVisible());
 await p.locator('.ld-seccion-analizada img').evaluateAll(xs=>xs.forEach(x=>x.loading='eager'));await p.waitForFunction(()=>[...document.querySelectorAll('.ld-seccion-analizada img')].every(x=>x.complete && x.naturalWidth>0));
 const imagenes=await p.locator('.ld-seccion-analizada img').evaluateAll(xs=>xs.map(x=>({src:x.src,cargada:x.complete&&x.naturalWidth>0})));assert.ok(imagenes.every(x=>x.cargada),JSON.stringify(imagenes));
 await p.getByRole('button',{name:'Cerrar aviso: Landing publicada',exact:true}).click();await p.waitForFunction(()=>document.querySelectorAll('.nl-aviso').length===0);console.log('OK avisos desde otra sección, enlace a landing, publicación diferenciada y lectura persistente');
 const out=process.env.AVISOS_CAPTURAS;if(out){fs.mkdirSync(out,{recursive:true});await p.screenshot({path:path.join(out,'analisis-secciones.png'),fullPage:true,animations:'disabled'});}
 await p.setViewportSize({width:390,height:844});await p.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);if(out)await p.screenshot({path:path.join(out,'analisis-movil.png'),fullPage:true,animations:'disabled'});
 mostrar=true;modo='github';revision='tres';await abrir();if(out)await p.screenshot({path:path.join(out,'actualizacion-movil.png'),animations:'disabled'});const movil=await p.getByRole('dialog').boundingBox();assert.ok(movil.width<=390);assert.deepEqual(errores,[]);
 console.log('OK análisis con captura/título/objetivo/análisis/mejora; móvil sin desborde y actualización accesible');
} catch(e){console.error(e);process.exitCode=1;console.error('Registro: '+dir);}
finally {if(browser)await browser.close();try{process.kill(-server.pid,'SIGTERM');}catch{}await dormir(250);log.end();if(!process.exitCode)fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(path.join(RAIZ,`temp/_modo-prueba-${puerto}`),{recursive:true,force:true});}

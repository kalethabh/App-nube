// Integración de Embudo: servidor aislado, producto/research sintéticos y proveedores locales. Sin gasto.
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const APP=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'), RAIZ=path.dirname(APP);
const PUERTO=Number(process.env.PUERTO)||4495, BASE=`http://127.0.0.1:${PUERTO}`;
const dir=fs.mkdtempSync(path.join(RAIZ,'temp','_probar-embudo-'));
const envFile=path.join(RAIZ,'.env'), envPropio=!fs.existsSync(envFile);
if(envPropio) fs.writeFileSync(envFile,'# Prueba de Embudo: claves falsas\nKIE_API_KEY=simulada\nELEVENLABS_API_KEY=simulada\n');
const env={...process.env};for(const k of Object.keys(env))if(/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|OPENAI_|CODEX_)/i.test(k))delete env[k];
Object.assign(env,{PUERTO:String(PUERTO),ANUNCIOS_MODO_PRUEBA:'1',ANUNCIOS_BIBLIOTECA_PRUEBA:'1',ANUNCIOS_NO_RETOMAR:'1',ANUNCIOS_PRUEBA_LIMPIO:'1',ANUNCIOS_SIN_GUARDADO:'1',ANUNCIOS_CLAUDE_BIN:path.join(APP,'server/claude/pruebas/claude-falso.js'),AIA_MOTOR:'claude'});
const log=fs.createWriteStream(path.join(dir,'servidor.log'));const app=cp.spawn(process.execPath,['server/index.js'],{cwd:APP,env,stdio:['ignore','pipe','pipe'],detached:true});app.stdout.pipe(log);app.stderr.pipe(log);
let productoId, embudoId, pasan=0;const otrosEmbudoIds=[];
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
async function pedir(ruta,{metodo,json,bytes,headers={}}={}){const r=await fetch(BASE+ruta,{method:metodo||(json||bytes?'POST':'GET'),headers:{...(json?{'Content-Type':'application/json'}:{}),...headers},body:json?JSON.stringify(json):bytes,signal:AbortSignal.timeout(60000)});const data=await r.json().catch(()=>null);return{st:r.status,data};}
function check(nombre,fn){fn();pasan++;console.log('OK '+nombre)}
async function listo(){let e;for(let i=0;i<150;i++){e=(await pedir(`/api/embudos/${embudoId}`)).data;if(e?.trabajo&&e.trabajo.estado!=='generando')return e;await dormir(1000)}throw new Error('La generación no terminó: '+JSON.stringify(e?.trabajo));}
try{
 let arriba=false;for(let i=0;i<80&&!arriba;i++){try{arriba=(await pedir('/api/estilos')).st===200}catch{}if(!arriba)await dormir(300)}assert.ok(arriba);
 let r=await pedir('/api/productos',{json:{nombre:'Producto sintético Embudo',tipo:'fisico'}});productoId=r.data.id;assert.ok(productoId);
 const pd=path.join(RAIZ,'temp/_productos',productoId);
 const foto=path.join(dir,'foto.png');cp.execFileSync('ffmpeg',['-v','error','-y','-f','lavfi','-i','color=c=0x367c67:s=640x640','-frames:v','1',foto]);
 await pedir(`/api/productos/${productoId}/fotos/1`,{metodo:'PUT',bytes:fs.readFileSync(foto),headers:{'Content-Type':'image/png'}});
 fs.writeFileSync(path.join(pd,'ficha.json'),JSON.stringify({nombre:'Producto sintético Embudo',queEs:'Serum de prueba',beneficios:['Aplicación sencilla'],ingredientes:'Aloe de la etiqueta',comoSeUsa:'Aplicar según la etiqueta',publico:'Adultos'}));
 r=await pedir('/api/embudos',{json:{productoId}});check('Sin investigación no crea un embudo',()=>assert.equal(r.st,428));
 const secciones=['hero','dolor','beneficios','ingredientes','uso'];
 const inv={producto:'Producto sintético Embudo',pais:'Colombia',fecha:'2026-11-24',veredicto:{viable:'si',texto:'Prueba'},alertas:['Investigación sintética, no real'],deseo_central:{frase:'Cuidado cotidiano'},beneficio_principal:'Aplicación sencilla',puntos_dolor:[1,2,3].map(n=>({dolor:'Rutina '+n,intensidad:5})),avatar:{nombre:'Persona de prueba'},titulos:Array.from({length:6},(_,i)=>({titulo:'Título antiguo '+i,apoyo:'Apoyo antiguo'})),fuentes:[],embudo:Object.fromEntries(secciones.map(s=>[s,[1,2].map(n=>({titulo:`${s}: mensaje ${n}`,subtitulo:`Propuesta de valor ${s} ${n}`,elementos:[`Contenido ${s} documentado`]}))]))};
 const invdir=path.join(pd,'investigacion');fs.mkdirSync(invdir,{recursive:true});const invfile=path.join(invdir,'investigacion.json');fs.writeFileSync(invfile,JSON.stringify(inv));
 r=await pedir('/api/embudos',{json:{productoId}});assert.equal(r.st,200,JSON.stringify(r.data));let e=r.data;embudoId=e.id;
 check('Cinco secciones en orden, con todos los pares literales y su origen',()=>{assert.deepEqual(e.secciones.map(s=>s.id),secciones);for(const s of e.secciones){assert.equal(s.opciones.length,2);assert.equal(s.opciones[1].subtitulo,`Propuesta de valor ${s.id} 2`);assert.match(s.opciones[0].origen,/embudo\./);assert.equal(s.elegida,null)}});
 check('No expone archivos ni miniaturas de las referencias de ejemplo',()=>assert.doesNotMatch(JSON.stringify(e),/codex-clipboard|AMUA|AMUNA|Metabolae/));
 r=await pedir(`/api/embudos/${embudoId}/presupuesto`,{json:{version:e.version,secciones:['hero']}});check('Sin elección no prepara producción',()=>assert.equal(r.st,428));
 r=await pedir(`/api/embudos/${embudoId}/generar`,{json:{version:e.version}});check('Sin presupuesto aprobado no genera',()=>assert.equal(r.st,428));
 r=await pedir(`/api/embudos/${embudoId}`,{metodo:'PUT',json:{version:e.version,seleccion:{hero:'inexistente'}}});check('Rechaza opciones ajenas a la investigación',()=>assert.equal(r.st,400));
 const seleccion=Object.fromEntries(e.secciones.map(s=>[s.id,s.opciones[1].id]));e=(await pedir(`/api/embudos/${embudoId}`,{metodo:'PUT',json:{version:e.version,seleccion}})).data;
 check('La selección persiste al volver a abrir',()=>assert.deepEqual(e.secciones.map(s=>s.elegida),secciones.map(s=>seleccion[s])));
 let q=(await pedir(`/api/embudos/${embudoId}/presupuesto`,{json:{version:e.version,secciones}})).data;
 check('Presupuesto incluye 5 secciones y un avatar reutilizable, sin generar todavía',()=>{assert.equal(q.cantidad,6);assert.ok(q.secciones.includes('avatar'));assert.ok(q.importe>0);assert.equal(e.trabajo,null)});
 e=(await pedir(`/api/embudos/${embudoId}`,{metodo:'PUT',json:{version:e.version,estilo:'Verde botánico'}})).data;
 r=await pedir(`/api/embudos/${embudoId}/generar`,{json:{token:q.token,version:q.version}});check('Un cambio invalida el presupuesto anterior',()=>assert.equal(r.st,428));
 q=(await pedir(`/api/embudos/${embudoId}/presupuesto`,{json:{version:e.version,secciones}})).data;
 r=await pedir(`/api/embudos/${embudoId}/generar`,{json:{token:q.token,version:q.version}});assert.equal(r.st,200,JSON.stringify(r.data));let trabajo=r.data.trabajo;
 r=await pedir(`/api/embudos/${embudoId}/generar`,{json:{token:q.token,version:q.version}});check('Confirmar dos veces no duplica el trabajo',()=>assert.equal(r.data.trabajo.id,trabajo.id));
 r=await pedir(`/api/embudos/${embudoId}`,{metodo:'PUT',json:{version:e.version,formato:'1:1'}});check('No cambia las entradas mientras genera',()=>assert.equal(r.st,409));
 e=await listo();check('Genera cinco imágenes independientes con el proveedor simulado',()=>{assert.equal(e.trabajo.estado,'lista',JSON.stringify(e.trabajo));assert.ok(e.secciones.every(s=>s.imagen?.url));assert.equal(new Set(e.secciones.map(s=>s.imagen.url)).size,5)});
 check('Hero 9:16 y demás 4:5 con medidas y bordes compartidos',()=>{for(const s of e.secciones){assert.equal(s.formato,s.id==='hero'?'9:16':'4:5');const b=fs.readFileSync(path.join(RAIZ,`temp/_embudo-${embudoId}`,s.imagen.archivo));assert.equal(b.readUInt32BE(16),1080);assert.equal(b.readUInt32BE(20),s.id==='hero'?1920:1350);const pixel=cp.execFileSync('ffmpeg',['-v','error','-i',path.join(RAIZ,`temp/_embudo-${embudoId}`,s.imagen.archivo),'-vf','crop=1:1:0:0','-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1']);assert.deepEqual([...pixel],[255,255,255]);}});
 check('Las secciones se solapan en el tiempo y tienen estado individual',()=>{const estados=Object.values(e.trabajo.estados);assert.ok(estados.every(x=>x.estado==='lista'));const eventos=estados.flatMap(x=>[{t:x.inicio,d:1},{t:x.fin,d:-1}]).filter(x=>x.t).sort((a,b)=>a.t.localeCompare(b.t)||a.d-b.d);let n=0,max=0;for(const x of eventos){n+=x.d;max=Math.max(max,n);}assert.equal(max,2);});
 const primerJob=JSON.parse(fs.readFileSync(path.join(RAIZ,`temp/_embudo-${embudoId}/trabajos/${e.trabajo.id}/trabajo.json`)));
 check('No repite avatar ni depende de imágenes de otras secciones',()=>{assert.ok(primerJob.visualPorSeccion);assert.equal(primerJob.piezas.find(p=>p.id==='dolor').visual,'enfoque');assert.match(primerJob.piezas.find(p=>p.id==='dolor').prompt,/blood-vessel/);assert.match(primerJob.piezas.find(p=>p.id==='ingredientes').prompt,/No human portrait/);assert.ok(primerJob.piezas.filter(p=>p.id!=='avatar').every(p=>p.formato===(p.id==='hero'?'9:16':'4:5')));});
 const lib=(await pedir('/api/biblioteca')).data;
 const a=lib.avatares.find(a=>a.id===e.avatarGuardado?.id);
 check('El retrato se guarda automáticamente en la Biblioteca, separado del anuncio',()=>{assert.ok(a);assert.equal(a.estilo,'realista-narrado');assert.equal(a.personas.length,1);assert.ok(e.avatarGuardado.url);const j=JSON.parse(fs.readFileSync(path.join(RAIZ,`temp/_embudo-${embudoId}/trabajos/${e.trabajo.id}/trabajo.json`)));assert.equal(j.piezas[0].id,'avatar');assert.match(j.piezas[0].prompt,/standalone reusable/)});
 const estadoInicial=path.join(RAIZ,`temp/_embudo-${embudoId}/embudo.json`);const corte=JSON.parse(fs.readFileSync(estadoInicial));corte.trabajo.estado='generando';corte.imagenes={};delete corte.avatar.guardado;fs.writeFileSync(estadoInicial,JSON.stringify(corte));e=(await pedir(`/api/embudos/${embudoId}`)).data;
 check('Tras un cierre recupera las imágenes y el mismo avatar sin duplicarlo',()=>{assert.equal(e.trabajo.estado,'lista');assert.equal(e.avatarGuardado.id,a.id);assert.ok(e.secciones.every(s=>s.imagen));});
 const av=await fetch(BASE+e.avatarGuardado.url);check('El avatar de la Biblioteca se puede abrir',()=>assert.equal(av.status,200));
 let otro=(await pedir('/api/embudos',{json:{productoId}})).data;otrosEmbudoIds.push(otro.id);
 otro=(await pedir(`/api/embudos/${otro.id}`,{metodo:'PUT',json:{version:otro.version,seleccion:{hero:otro.secciones[0].opciones[0].id},avatar:{modo:'biblioteca',estilo:a.estilo,id:a.id,rol:a.personas[0].rol}}})).data;
 const qOtro=(await pedir(`/api/embudos/${otro.id}/presupuesto`,{json:{version:otro.version,secciones:['hero']}})).data;
 check('Otro embudo reutiliza el avatar sin cotizar un retrato nuevo',()=>{assert.equal(qOtro.cantidad,1);assert.equal(otro.avatarGuardado.id,a.id)});
 await pedir(`/api/embudos/${otro.id}/generar`,{json:{version:qOtro.version,token:qOtro.token}});
 for(let i=0;i<100;i++){otro=(await pedir(`/api/embudos/${otro.id}`)).data;if(otro.trabajo?.estado!=='generando')break;await dormir(500)}
 check('La reutilización conserva el avatar y no duplica la Biblioteca',()=>{assert.equal(otro.trabajo.estado,'lista');const j=JSON.parse(fs.readFileSync(path.join(RAIZ,`temp/_embudo-${otro.id}/trabajos/${otro.trabajo.id}/trabajo.json`)));assert.ok(j.avatarArchivo.startsWith('avatar-base'));assert.equal(j.piezas.some(p=>p.id==='avatar'),false)});
 const libReusada=(await pedir('/api/biblioteca')).data;check('Una sola entrada de avatar después de reutilizarlo',()=>assert.equal(libReusada.avatares.length,1));
 const urls=e.secciones.map(s=>s.imagen.url);const imagen=await fetch(BASE+urls[0]+'?descargar=1');check('Imagen descargable en PNG',()=>{assert.equal(imagen.status,200);assert.match(imagen.headers.get('content-disposition'),/hero.png/)});
 e=(await pedir(`/api/embudos/${embudoId}`,{metodo:'PUT',json:{version:e.version,correcciones:{hero:'Agranda el producto y cambia el fondo'}}})).data;
 q=(await pedir(`/api/embudos/${embudoId}/presupuesto`,{json:{version:e.version,secciones:['hero'],corregir:true}})).data;check('La corrección cotiza solo la sección elegida',()=>assert.equal(q.cantidad,1));
 await pedir(`/api/embudos/${embudoId}/generar`,{json:{token:q.token,version:q.version}});e=await listo();check('Corrige solo Hero y conserva las otras cuatro imágenes',()=>{assert.equal(e.trabajo.estado,'lista');assert.notEqual(e.secciones[0].imagen.url,urls[0]);assert.deepEqual(e.secciones.slice(1).map(s=>s.imagen.url),urls.slice(1))});
 const job=JSON.parse(fs.readFileSync(path.join(RAIZ,`temp/_embudo-${embudoId}/trabajos/${e.trabajo.id}/trabajo.json`),'utf8'));check('La corrección usa la imagen anterior y el pedido exacto',()=>{assert.equal(job.piezas.length,1);assert.match(job.piezas[0].anterior,/hero.png$/);assert.match(job.piezas[0].prompt,/Agranda el producto y cambia el fondo/)});
 check('La versión anterior sigue descargable',()=>assert.ok(fs.existsSync(path.join(RAIZ,`temp/_embudo-${embudoId}/trabajos/${trabajo.id}/hero.png`))));
 // Simula un cierre tras descargar la corrección, antes de anotar su resultado. Se recupera el MISMO archivo.
 const proyecto=path.join(RAIZ,`temp/_embudo-${embudoId}`), estadoFile=path.join(proyecto,'embudo.json');
 const guardado=JSON.parse(fs.readFileSync(estadoFile));guardado.trabajo.estado='generando';fs.writeFileSync(estadoFile,JSON.stringify(guardado));
 e=(await pedir(`/api/embudos/${embudoId}`)).data;check('Reconcilia resultados ya terminados sin llamar al proveedor',()=>assert.equal(e.trabajo.estado,'lista'));
 guardado.trabajo.estado='generando';fs.writeFileSync(estadoFile,JSON.stringify(guardado));
 fs.unlinkSync(path.join(proyecto,`trabajos/${e.trabajo.id}/hero.resultado.json`));
 e=(await pedir(`/api/embudos/${embudoId}`)).data;check('Reconoce la generación interrumpida y conserva los archivos',()=>assert.equal(e.trabajo.estado,'interrumpido'));
 q=(await pedir(`/api/embudos/${embudoId}/presupuesto`,{json:{version:e.version,retomar:e.trabajo.id}})).data;
 await pedir(`/api/embudos/${embudoId}/generar`,{json:{token:q.token,version:q.version}});e=await listo();
 check('Retomar recupera la descarga sin pedir otra imagen',()=>{assert.equal(e.trabajo.estado,'lista');assert.equal(JSON.parse(fs.readFileSync(path.join(proyecto,`trabajos/${e.trabajo.id}/hero.resultado.json`))).recuperada,true)});
 r=await pedir('/api/embudos',{json:{productoId},headers:{Origin:'https://sitio-ajeno.example'}});check('Otro sitio no puede iniciar trabajos',()=>assert.equal(r.st,403));
 inv.embudo.hero[1].titulo='Nueva investigación';fs.writeFileSync(invfile,JSON.stringify(inv));e=(await pedir(`/api/embudos/${embudoId}`)).data;check('Detecta investigación modificada',()=>assert.equal(e.fuenteCambio,true));
 r=await pedir(`/api/embudos/${embudoId}/presupuesto`,{json:{version:e.version,secciones:['hero']}});check('No genera con la investigación desactualizada',()=>assert.equal(r.st,409));
 e=(await pedir(`/api/embudos/${embudoId}`,{metodo:'PUT',json:{version:e.version,actualizarTextos:true}})).data;check('Actualizar limpia selecciones desaparecidas y conserva imágenes con aviso',()=>{assert.equal(e.secciones[0].elegida,null);assert.equal(e.secciones[0].imagen.desactualizada,true);assert.equal(e.fuenteCambio,false)});
 // Textos manuales y propuestas nuevas sin generar imágenes ni perder la elección.
 const previo=e.trabajo.id;
 e=(await pedir(`/api/embudos/${embudoId}`,{metodo:'PUT',json:{version:e.version,manuales:{hero:{titulo:'Mi título manual',subtitulo:'Mi propuesta de valor'}}}})).data;
 const manual=e.secciones[0].elegida;
 check('Escribir un par manual lo guarda y selecciona',()=>{const o=e.secciones[0].opciones.find(o=>o.id===manual);assert.equal(o.titulo,'Mi título manual');assert.equal(o.origen,'Escrito por ti');});
 r=await pedir(`/api/embudos/${embudoId}`,{metodo:'PUT',json:{version:e.version,manuales:{dolor:{titulo:'Incompleto',subtitulo:''}}}});check('No acepta un mensaje manual incompleto',()=>assert.equal(r.st,400));
 e=(await pedir(`/api/embudos/${embudoId}`,{metodo:'PUT',json:{version:e.version,actualizarTextos:true}})).data;
 check('Actualizar investigación conserva los mensajes escritos por ti',()=>assert.equal(e.secciones[0].elegida,manual));
 r=await pedir(`/api/embudos/${embudoId}/titulos`,{json:{version:e.version,seccion:'hero'}});assert.equal(r.st,200);
 for(let i=0;i<60;i++){e=(await pedir(`/api/embudos/${embudoId}`)).data;if(e.titulos?.estado!=='generando')break;await dormir(100);}
 check('Regenerar títulos añade propuestas sin cambiar elección ni generar imágenes',()=>{assert.equal(e.titulos.estado,'lista',JSON.stringify(e.titulos));assert.equal(e.secciones[0].opciones.filter(o=>o.tipo==='generado').length,3);assert.equal(e.secciones[0].elegida,manual);assert.equal(e.trabajo.id,previo);});
 r=await pedir(`/api/embudos/${embudoId}`,{metodo:'PUT',json:{version:e.version,fondo:'red'}});check('Rechaza fondos que no sean colores válidos',()=>assert.equal(r.st,400));
 e=(await pedir(`/api/embudos/${embudoId}`,{metodo:'PUT',json:{version:e.version,visuales:{hero:'producto',dolor:'anatomia'},fondo:'#F3F0EC'}})).data;
 q=(await pedir(`/api/embudos/${embudoId}/presupuesto`,{json:{version:e.version,secciones:['dolor']}})).data;
 check('Anatomía por sección se guarda y no necesita otro avatar',()=>{assert.equal(q.cantidad,1);assert.equal(e.secciones[1].visual,'anatomia');assert.equal(e.fondo,'#F3F0EC');});
 if(process.env.EMBUDO_UI==='1') { const {validarEmbudoUI}=await import('./probar-embudo-ui.mjs');await validarEmbudoUI({base:BASE,id:embudoId}); }
 console.log(`\n${pasan}/${pasan} OK · sin gasto`);
}catch(err){if(embudoId)fs.cpSync(path.join(RAIZ,`temp/_embudo-${embudoId}`),path.join(dir,'embudo-fallido'),{recursive:true});console.error(err);process.exitCode=1;console.error('Registro de prueba:',path.join(dir,'servidor.log'));}
finally{
 try{process.kill(-app.pid,'SIGTERM')}catch{app.kill('SIGTERM')}await dormir(250);log.end();
 if(!process.exitCode){fs.rmSync(dir,{recursive:true,force:true});}
 if(productoId)fs.rmSync(path.join(RAIZ,'temp/_productos',productoId),{recursive:true,force:true});
 for(const id of otrosEmbudoIds)fs.rmSync(path.join(RAIZ,`temp/_embudo-${id}`),{recursive:true,force:true});
 if(embudoId)fs.rmSync(path.join(RAIZ,`temp/_embudo-${embudoId}`),{recursive:true,force:true});
 fs.rmSync(path.join(RAIZ,'temp',`_modo-prueba-${PUERTO}`),{recursive:true,force:true});
 if(envPropio)fs.rmSync(envFile,{force:true});
}

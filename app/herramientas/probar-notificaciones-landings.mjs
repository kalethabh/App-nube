import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
process.env.PUERTO='4499';
const {TEMP}=await import('../server/lib/rutas.js');
const dir=path.join(TEMP,'_modo-prueba-4499');
assert.equal(fs.existsSync(dir),false,'La carpeta de prueba ya existe; no se toca.');
const n=await import('../server/lib/notificaciones.js');
const {resumirCambios}=await import('../server/lib/resumen-actualizacion.js');
try {
 assert.equal(n.notificarLandingLista({id:'a',estado:'trabajando'}),null);
 assert.equal(n.notificarLandingLista({id:'a',estado:'error'}),null);
 const l={id:'landing-prueba',estado:'lista',titulo:'Landing de prueba',modo:'tal-cual'};
 const id=n.notificarLandingLista(l);assert.ok(id);assert.equal(n.notificarLandingLista(l),id);assert.equal(n.listarNotificaciones().notificaciones.length,1);
 const noPublicada={id:'publicacion-prueba',tipo:'landing',estado:'vista-previa',pagina:'https://example.com/?preview=1'};
 assert.equal(n.notificarLandingPublicada(noPublicada),null);
 assert.equal(n.notificarLandingPublicada({...noPublicada,estado:'lista',pagina:null,publicado:new Date().toISOString()}),null);
 const publicada={...noPublicada,estado:'lista',pagina:'https://example.com/pages/producto',publicado:new Date().toISOString(),titulo:'Producto'};
 const idPub=n.notificarLandingPublicada(publicada);assert.ok(idPub);assert.equal(n.notificarLandingPublicada(publicada),idPub);
 assert.equal(n.listarNotificaciones().notificaciones.length,2);
 assert.equal(n.listarNotificaciones().notificaciones.find(x=>x.id===idPub).tipo,'landing-publicada');
 n.marcarNotificacionLeida(id);assert.equal(n.listarNotificaciones().notificaciones.length,1);n.marcarNotificacionLeida(id);assert.equal(n.notificarLandingLista(l),id);assert.equal(n.listarNotificaciones().notificaciones.length,1);
 const disco=JSON.parse(fs.readFileSync(path.join(dir,'notificaciones.json')));assert.ok(disco.eventos.find(x=>x.id===id).leida);
 assert.throws(()=>n.marcarNotificacionLeida('../otro'));
 const resumen=resumirCambios('# Cambios\n\n## 2026-11-24q · Secciones independientes\n\n- Puedes elegir títulos.\n- Recibes avisos.\n\n## 2026-11-24p · Antes\n- Fondo anterior.\n','2026-11-24q');
 assert.equal(resumen.version,'2026-11-24q');assert.equal(resumen.titulo,'Secciones independientes');assert.deepEqual(resumen.cambios,['Puedes elegir títulos.','Recibes avisos.']);
 console.log('OK avisos persistentes, una vez por hito, lectura idempotente, lista ≠ publicada, sin aviso de publicación para vista previa o acceso solo a temas');
 console.log('OK resumen de cambios de la versión, sin mezclar versiones anteriores');
} finally {fs.rmSync(dir,{recursive:true,force:true});}

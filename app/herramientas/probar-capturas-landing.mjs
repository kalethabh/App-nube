import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import { capturarSecciones,vincularCapturas } from '../server/lib/landings/capturas.js';
import { limpiarAnalisis } from '../server/lib/landings/index.js';
const RAIZ=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),dir=fs.mkdtempSync(path.join(RAIZ,'temp/_probar-capturas-'));
let apiLlamadas=0;
const html=`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;font-family:Arial}section{box-sizing:border-box;height:650px;padding:50px 24px}h1,h2{font-size:40px}section:nth-child(1){background:#c9dacf}section:nth-child(2){background:#e8c8ba}section:nth-child(3){background:#cad3ec}</style></head><body><img src="/api/peligro" style="width:1px;height:1px"><main><section><h1>Tu rutina, más simple</h1><p>Una propuesta de valor clara.</p></section><section><h2>Beneficios que puedes entender</h2><p>Una aplicación sencilla y práctica.</p></section><section><h2>Modo de uso</h2><p>Consulta las instrucciones de la etiqueta.</p></section></main><script>fetch('/api/peligro',{method:'POST'});document.querySelector('h1').textContent='NO DEBE EJECUTARSE';</script></body></html>`;
const server=http.createServer((req,res)=>{if(req.url.startsWith('/api/')){apiLlamadas++;res.end('no');return;}res.setHeader('Content-Type','text/html');res.end(html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
try {
 const r=await capturarSecciones({id:'landing-fixture',carpeta:dir,url:`http://127.0.0.1:${server.address().port}/landing/landing-fixture/index.html`});
 assert.equal(r.capturas.length,3,JSON.stringify(r));assert.equal(apiLlamadas,0);assert.equal(r.capturas[0].titulo,'Tu rutina, más simple');
 for(const c of r.capturas){const b=fs.readFileSync(path.join(dir,c.archivo));assert.equal(b.subarray(0,4).toString(),'RIFF');assert.ok(b.length>1000);}
 const secciones=vincularCapturas([{titulo:'Tu rutina, más simple',capturaId:'S1'},{titulo:'Beneficios que puedes entender'},{titulo:'No existe',capturaId:'S99'}],r.capturas);
 const repetidas=[...r.capturas,{...r.capturas[0],id:'S4'}];assert.equal(vincularCapturas([{titulo:r.capturas[0].titulo,capturaId:'S4'}],repetidas)[0].captura.id,'S4');assert.equal(vincularCapturas([{titulo:r.capturas[0].titulo}],repetidas)[0].captura,null);
 assert.equal(secciones[0].captura.id,'S1');assert.equal(secciones[1].captura.id,'S2');assert.equal(secciones[2].captura,null);
 const a=limpiarAnalisis({resumen:'Ejemplo de revisión',secciones:[{titulo:'Hero',analisis:'El título presenta la promesa.',porQueFunciona:'Reduce el esfuerzo percibido.',mejora:'Precisar el contexto.',capturaId:'S1'}]});assert.equal(a.secciones[0].capturaId,'S1');assert.ok(a.secciones[0].analisis);
 console.log('OK tres capturas WebP reales, títulos y áreas de sección; scripts de la landing y acceso a API bloqueados');
 console.log('OK asociación por ID/título real, sin inventar correspondencia, y análisis enriquecido compatible');
 const out=process.env.CAPTURAS_LANDING;if(out){fs.mkdirSync(out,{recursive:true});for(const c of r.capturas)fs.copyFileSync(path.join(dir,c.archivo),path.join(out,path.basename(c.archivo)));}
} finally {await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}

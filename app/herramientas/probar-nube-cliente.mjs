import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const paquete=process.env.PLAYWRIGHT_PACKAGE_PATH;
if(!paquete)throw new Error('Define PLAYWRIGHT_PACKAGE_PATH.');
const {chromium}=await import(pathToFileURL(path.join(paquete,'index.mjs')).href);
const script=await fs.readFile(new URL('../public/kads-nube.js',import.meta.url),'utf8');
let ticket,bytesSubidos=0,bytesPuerta=0,recibida;
const s=http.createServer(async(req,res)=>{
 let b=[];for await(const x of req)b.push(x);b=Buffer.concat(b);
 if(req.url==='/kads-nube.js'){res.setHeader('Content-Type','application/javascript');return res.end(script);}
 if(req.url==='/api/nube/subida'){ticket=JSON.parse(b);res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({id:'ticket-falso',url:`http://127.0.0.1:${s.address().port}/almacen`}));}
 if(req.url==='/almacen'){bytesSubidos+=b.length;res.statusCode=200;return res.end();}
 if(req.url==='/api/carga'){bytesPuerta+=b.length;recibida=req.headers;res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({ok:true}));}
 res.setHeader('Content-Type','text/html');res.end(`<html><head>${req.url==='/local'?'':'<meta name="kads-nube" content="1">'}<script src="/kads-nube.js"></script></head><body>Kads</body></html>`);
});
await new Promise(r=>s.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROME || undefined,headless:true});
try{
 const p=await browser.newPage();const fallos=[];p.on('pageerror',e=>fallos.push(e.message));
 await p.goto(`http://127.0.0.1:${s.address().port}/`);
 assert(await p.evaluate(()=>Boolean(window.kadsNube)));
 const resultado=await p.evaluate(async()=>{const r=await fetch('/api/carga',{method:'POST',headers:{'Content-Type':'video/mp4'},body:new Blob([new Uint8Array(2*1024**2)],{type:'video/mp4'})});return r.json();});
 assert(resultado.ok);assert.equal(bytesSubidos,2*1024**2);assert.equal(bytesPuerta,0);assert.equal(recibida['x-kads-cuerpo'],'ticket-falso');assert.equal(recibida['content-type'],'video/mp4');assert.equal(ticket.metodo,'POST');
 const avance=await p.evaluate(async()=>{const valores=[];await window.kadsNube.enviar('/api/carga',{method:'POST',body:new Blob([new Uint8Array(1500000)]),onprogress:n=>valores.push(n)});return valores;});
 assert(avance.includes(100));assert(avance.some(n=>n>0 && n<100));
 await p.goto(`http://127.0.0.1:${s.address().port}/local`);assert.equal(await p.evaluate(()=>Boolean(window.kadsNube)),false);assert.deepEqual(fallos,[]);
 console.log('OK navegador: subida directa grande, progreso XHR, cuerpo sin video en la función, cabeceras y Mac sin transporte cloud.');
}finally{await browser.close();s.closeAllConnections();await new Promise(r=>s.close(r));}

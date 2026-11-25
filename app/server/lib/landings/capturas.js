// Capturas reales de la copia local. No ejecuta scripts de la tienda ni permite solicitudes a la API de la app.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { RAIZ, PUERTO } from '../rutas.js';
import { rutaDelNavegador,AGENTE } from './navegador.js';
const cargar=createRequire(path.join(RAIZ,'remotion','package.json'));
let cola=Promise.resolve();
export function capturarSecciones({id,carpeta,url=`http://127.0.0.1:${PUERTO}/landing/${encodeURIComponent(id)}/index.html`}) {
 const promesa=cola.then(()=>capturar({id,carpeta,url}));cola=promesa.catch(()=>{});return promesa;
}
async function capturar({id,carpeta,url}) {
 const bin=rutaDelNavegador();if(!bin)return {capturas:[],error:'No encontré el navegador para las capturas.'};
 let browser,plazo;const version='v-'+crypto.randomBytes(6).toString('hex'), dir=path.join(carpeta,'analisis-capturas',version);
 try {
  const {openBrowser}=cargar('@remotion/renderer');
  browser=await openBrowser('chrome',{browserExecutable:bin,logLevel:'error',chromiumOptions:{userAgent:AGENTE,headless:true}});
  plazo=setTimeout(()=>browser.close({silent:true}).catch(()=>{}),90000);plazo.unref?.();
  const page=await browser.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:()=>{},onLog:()=>{}});
  await page.setViewport({width:412,height:915,deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const client=page._client(),permitida=new URL(url),prefijo=permitida.pathname.slice(0,permitida.pathname.lastIndexOf('/')+1);
  await client.send('Emulation.setScriptExecutionDisabled',{value:true});
  client.on('Fetch.requestPaused',async e=>{try{const u=new URL(e.request.url);if(e.request.method==='GET' && (u.protocol==='data:' || (u.origin===permitida.origin && u.pathname.startsWith(prefijo))))await client.send('Fetch.continueRequest',{requestId:e.requestId});else await client.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'});}catch{try{await client.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'});}catch{}}});
  await client.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  await page.goto({url,timeout:30000,options:{waitUntil:'load'}});
  await page.evaluate(()=>{for(const i of document.images)i.loading='eager';});
  await new Promise(r=>setTimeout(r,1000));
  const secciones=await page.evaluate(()=>{
   const main=document.querySelector('main') || document.body;
   const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0 && r.height>0 && s.display!=='none' && s.visibility!=='hidden' && s.position!=='fixed' && !e.closest('nav,footer,[aria-hidden="true"]');};
   let hs=[...main.querySelectorAll('h1,h2,h3')].filter(e=>visible(e) && e.textContent.trim().length>2);
   hs=hs.filter((h,i)=>!hs.slice(0,i).some(p=>Math.abs(p.getBoundingClientRect().top-h.getBoundingClientRect().top)<70));
   let bases=hs.map((h,i)=>{const r=h.getBoundingClientRect(),c=h.closest('section,article,[data-section-id],.shopify-section'),cr=c?.getBoundingClientRect();const y=i===0?Math.max(0,main.getBoundingClientRect().top+scrollY):cr && cr.height<3200 && cr.top<=r.top && c.querySelectorAll('h1,h2,h3').length<3?cr.top+scrollY:r.top+scrollY-24;return {titulo:h.textContent.trim().slice(0,200),texto:(c?.innerText || h.parentElement?.innerText || h.textContent).trim().slice(0,600),y:Math.max(0,Math.floor(y))};});
   if(!bases.length)bases=[...main.querySelectorAll('img')].filter(i=>visible(i) && i.getBoundingClientRect().height>=180 && i.getBoundingClientRect().width>=180).map((i,k)=>({titulo:i.alt || `Bloque visual ${k+1}`,texto:i.alt || '',y:Math.max(0,Math.floor(i.getBoundingClientRect().top+scrollY))}));
   const alto=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight);
   return bases.sort((a,b)=>a.y-b.y).filter((b,i)=>i===0 || b.y>bases[i-1].y+40).slice(0,30).map((b,i,bs)=>({...b,alto:Math.max(80,Math.min(3200,(bs[i+1]?.y || alto)-b.y)),parcial:(bs[i+1]?.y || alto)-b.y>3200}));
  });
  if(!secciones.length)return {capturas:[],error:'No pude identificar secciones visibles en esta copia. El análisis de texto sigue disponible.'};
  fs.mkdirSync(dir,{recursive:true});const capturas=[];
  for(let i=0;i<secciones.length;i++){
   const s=secciones[i],nombre=`seccion-${String(i+1).padStart(2,'0')}.webp`;
   const shot=await client.send('Page.captureScreenshot',{format:'webp',quality:85,fromSurface:true,captureBeyondViewport:true,clip:{x:0,y:s.y,width:412,height:s.alto,scale:1}});
   fs.writeFileSync(path.join(dir,nombre),Buffer.from(shot.value?.data || shot.data,'base64'));
   capturas.push({id:`S${i+1}`,...s,archivo:`analisis-capturas/${version}/${nombre}`,url:`/landing/${encodeURIComponent(id)}/analisis-capturas/${version}/${nombre}`});
  }
  return {capturas,fuente:'Captura real de la copia local al momento del análisis',fecha:new Date().toISOString()};
 }catch(e) {console.warn('[capturas]',String(e.message || e).slice(0,180));return {capturas:[],error:'No pude capturar las secciones. El análisis de texto sigue disponible.'};}
 finally {clearTimeout(plazo);if(browser)await browser.close({silent:true}).catch(()=>{});}
}
const normal=t=>String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function vincularCapturas(secciones,capturas) {
 return secciones.map(s=>{
  const id=capturas.find(c=>c.id===s.capturaId),exactas=capturas.filter(c=>normal(c.titulo)===normal(s.titulo) && normal(s.titulo).length>3);
  const c=id && (!exactas.length || exactas.some(c=>c.id===id.id))?id:exactas.length===1?exactas[0]:null;
  return {...s,captura:c?{id:c.id,url:c.url,titulo:c.titulo,parcial:c.parcial,fuente:'Captura de la copia analizada'}:null};
 });
}

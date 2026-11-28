/* Subidas directas al bucket privado. Sin claves de servidor en el navegador. La Mac no activa este transporte. */
(() => {
 if(!document.querySelector('meta[name="kads-nube"][content="1"]') || window.kadsNube)return;
 const original=window.fetch.bind(window);
 async function preparar(url,metodo,archivo,signal){
  const r=await original('/api/nube/subida',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ruta:url,metodo,bytes:archivo.size}),signal});
  const d=await r.json();if(!r.ok)throw new Error(d.error || 'No se pudo preparar la subida.');return d;
 }
 async function enviar(url,{method='POST',headers={},body,signal,onprogress}={}){
  const destino=new URL(url,location.href),ruta=destino.pathname+destino.search;
  const blob=body instanceof Blob?body:new Blob([body]);
  const t=await preparar(ruta,method,blob,signal);
  if(onprogress)await new Promise((ok,no)=>{
   const x=new XMLHttpRequest();x.open('PUT',t.url);x.setRequestHeader('Content-Type',blob.type || 'application/octet-stream');
   x.upload.onprogress=e=>e.lengthComputable && onprogress(Math.round(e.loaded/e.total*95));
   x.onload=()=>x.status>=200 && x.status<300?ok():no(new Error('No se pudo subir el archivo.'));
   x.onerror=()=>no(new Error('Se interrumpió la subida.'));x.onabort=()=>no(new DOMException('Cancelado','AbortError'));
   signal?.addEventListener('abort',()=>x.abort(),{once:true});x.send(blob);
  });else{const r=await original(t.url,{method:'PUT',body:blob,headers:{'Content-Type':blob.type || 'application/octet-stream'},signal});if(!r.ok)throw new Error('No se pudo subir el archivo.');}
  const hs=new Headers(headers);hs.set('x-kads-cuerpo',t.id);
  const r=await original(destino.href,{method,headers:hs,signal});onprogress?.(100);return r;
 }
 window.kadsNube={enviar};
 window.fetch=async(input,init)=>{
  const req=new Request(input,init),u=new URL(req.url);
  if(u.origin!==location.origin || !u.pathname.startsWith('/api/') || u.pathname.startsWith('/api/nube/') || ['GET','HEAD'].includes(req.method))return original(input,init);
  const b=await req.clone().blob();
  if(b.size<1024*1024)return original(input,init);
  return enviar(u.href,{method:req.method,headers:req.headers,body:b,signal:req.signal});
 };
})();

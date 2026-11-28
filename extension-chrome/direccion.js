'use strict';
function direccionKads(valor) {
 try {
  const u=new URL(String(valor || '').trim());
  if(u.username || u.password || u.pathname!=='/' || u.search || u.hash)return null;
  if(u.protocol==='https:' || u.protocol==='http:' && ['127.0.0.1','localhost'].includes(u.hostname))return u.origin;
 }catch{}
 return null;
}

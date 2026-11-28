import crypto from 'node:crypto';
import { DOMINIO,PUERTA } from './servidor.js';
export const volverSeguro=(x)=>{const s=String(x || '/');return s.startsWith('/') && !s.startsWith('//') && !/[\\\u0000-\u001f\u007f]/.test(s)?s:'/';};
export function origenAcceso(req) {
 const origen=String(process.env.KADS_URL_PUBLICA || (PUERTA?`https://${PUERTA}`:DOMINIO?`https://${DOMINIO}`:`http://${req.headers.host}`));
 const u=new URL(origen);
 if(u.username || u.password || u.pathname!=='/' || u.search || u.hash || !(u.protocol==='https:' || u.protocol==='http:' && ['127.0.0.1','localhost','[::1]'].includes(u.hostname)))throw new Error('Configura la dirección pública HTTPS de Kads.');
 return u.origin;
}
export function registrarGoogle(app,{url,sb,ponerCookies,pagina}) {
 const flujos=new Map(),duracion=10*60*1000;
 const nombreCookie=req=>req.secure || String(req.headers['x-forwarded-proto'] || '').includes('https')?'__Host-kads_google':'kads_google';
 const cookie=(req,res,valor,max=600)=>res.append('Set-Cookie',`${nombreCookie(req)}=${valor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${max}${req.secure || String(req.headers['x-forwarded-proto'] || '').includes('https')?'; Secure':''}`);
 const fallar=(res)=>res.status(400).set('Cache-Control','no-store').type('html').send(pagina('No se pudo entrar con Google','<p>El acceso no se completó o venció. Intenta de nuevo desde Kads.</p><p>Si se repite, el administrador debe activar Google y autorizar la dirección de Kads en Supabase.</p><a href="/entrar">Volver a entrar</a>'));
 app.get('/api/acceso/google', (req,res)=>{
  try {
   for(const [id,f] of flujos)if(Date.now()-f.fecha>duracion)flujos.delete(id);
   if(flujos.size>=256)flujos.delete(flujos.keys().next().value);
   const id=crypto.randomBytes(32).toString('hex'),verifier=crypto.randomBytes(64).toString('base64url');
   const callback=new URL('/api/acceso/google/callback',origenAcceso(req));callback.searchParams.set('flujo',id);
   flujos.set(id,{verifier,volver:volverSeguro(req.query.volver),fecha:Date.now()});cookie(req,res,id);
   const destino=new URL(`${url}/auth/v1/authorize`);
   destino.searchParams.set('provider','google');destino.searchParams.set('redirect_to',callback.href);
   destino.searchParams.set('code_challenge',crypto.createHash('sha256').update(verifier).digest('base64url'));destino.searchParams.set('code_challenge_method','s256');
   res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}).redirect(302,destino.href);
  }catch{fallar(res);}
 });
 app.get('/api/acceso/google/callback',async(req,res)=>{
  const nombre=nombreCookie(req);
  const id=String(req.query.flujo || ''),match=String(req.headers.cookie || '').split(';').map(x=>x.trim()).find(x=>x.startsWith(`${nombre}=`)),valor=match?.slice(nombre.length+1) || '';
  const f=flujos.get(id);
  if(!/^[a-f0-9]{64}$/.test(id) || !/^[a-f0-9]{64}$/.test(valor) || !crypto.timingSafeEqual(Buffer.from(id),Buffer.from(valor)))return fallar(res);
  flujos.delete(id);cookie(req,res,'',0);
  if(!f || Date.now()-f.fecha>duracion || req.query.error || typeof req.query.code!=='string' || !req.query.code || req.query.code.length>4096)return fallar(res);
  try {
   const r=await sb('/auth/v1/token?grant_type=pkce',{metodo:'POST',cuerpo:{auth_code:req.query.code,code_verifier:f.verifier}});
   if(!r.ok || !r.datos?.access_token || !r.datos?.refresh_token)return fallar(res);
   ponerCookies(req,res,r.datos);res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}).redirect(303,f.volver);
  }catch{fallar(res);}
 });
}

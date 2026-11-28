import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
const raiz=process.env.KADS_RAIZ || '/srv/kads',hogar=process.env.KADS_HOME || '/srv/home';
await fs.mkdir(raiz,{recursive:true});await fs.mkdir(hogar,{recursive:true,mode:0o700});
// Los programas y el código vienen de la imagen; los datos del volumen/restauración nunca se pisan.
for(const n of await fs.readdir('/opt/kads')) {
 if(['temp','output','mis_archivos','.env'].includes(n))continue;
 if(n==='.claude') {try{await fs.access(path.join(raiz,n));continue;}catch{}}
 if(n==='app') {
  await fs.mkdir(path.join(raiz,n),{recursive:true});
  for(const f of await fs.readdir('/opt/kads/app'))if(f!=='config.json' && !f.startsWith('.'))await fs.cp(`/opt/kads/app/${f}`,path.join(raiz,'app',f),{recursive:true,force:true});
 }else await fs.cp(`/opt/kads/${n}`,path.join(raiz,n),{recursive:true,force:true});
}
const nube=process.env.KADS_MODO!=='contabo';
if(nube)await (await import('./motor.mjs')).iniciarMotor();
else {
 if(process.getuid?.()===0){const {execFileSync}=await import('node:child_process');execFileSync('chown',['-R','10001:10001',raiz,hogar]);}
 const hijo=spawn(process.execPath,['app/server/index.js'],{cwd:raiz,stdio:'inherit',...(process.getuid?.()===0?{uid:10001,gid:10001}:{}),env:{...process.env,KADS_BIND_HOST:'0.0.0.0'}});
 for(const s of ['SIGTERM','SIGINT'])process.once(s,()=>hijo.kill(s));hijo.once('exit',c=>process.exit(c || 0));
}

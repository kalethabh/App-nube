import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {cifrar,descifrar} from './comun.mjs';
const BLOQUE=8*1024*1024;
export const PERSISTENTES=['temp','output','mis_archivos','.claude','.git','app/config.json','app/.extension-chrome.json','app/.guardado.json','app/.guardado-config.json','.env'];
const HOGAR=['.claude','.claude.json','.codex','.local/share/AnunciosConIA','.config/gh','.gitconfig','.git-credentials'];
const OMITIR=new Set(['node_modules','__pycache__','.cache','.venv','.venv-sketch']);
export function nombreSeguro(s) {
 if(typeof s!=='string' || !s || s.includes('\\') || s.startsWith('/') || s.split('/').some(x=>!x || x==='.' || x==='..') || /[\u0000-\u001f]/.test(s))throw new Error('Nombre de respaldo inválido.');
 return s;
}
export function crearEstado({raiz,hogar,key,almacen,publicar=async()=>{},leerActual=async()=>null,incluirGit=true}) {
 let cola=Promise.resolve(),firmaAnterior=null;
 const conocidos=new Map();
 const destinos={raiz:path.resolve(raiz),hogar:hogar?path.resolve(hogar):null};
 async function archivos(dir,rel,out) {
  let st;try{st=await fs.lstat(dir);}catch(e){if(e.code==='ENOENT')return;throw e;}
  if(st.isSymbolicLink())throw new Error(`El respaldo requiere una ruta local, sin enlaces simbólicos: ${rel}`);
  if(st.isDirectory()){for(const n of (await fs.readdir(dir)).sort())if(!OMITIR.has(n))await archivos(path.join(dir,n),`${rel}/${n}`,out);}
  else if(st.isFile())out.push({dir,rel,st});
 }
 async function capturar() {
  const lista=[];for(const n of PERSISTENTES){if(n==='.git'){if(!incluirGit)continue;try{if(!(await fs.lstat(path.join(destinos.raiz,n))).isDirectory())continue;}catch{continue;}}await archivos(path.join(destinos.raiz,n),`raiz/${n}`,lista);}
  if(destinos.hogar)for(const n of HOGAR)await archivos(path.join(destinos.hogar,n),`hogar/${n}`,lista);
  const entradas=[],pendientes=[];
  for(const {dir,rel,st} of lista) {
   try {
   const firma=`${st.size}:${st.mtimeMs}:${st.ctimeMs}`,prev=conocidos.get(rel);
   if(prev?.firma===firma){entradas.push(prev.entrada);continue;}
   const fd=await fs.open(dir,'r'),partes=[];let pos=0;
   try{do {
    const b=Buffer.alloc(Math.min(BLOQUE,Math.max(0,st.size-pos)));let bytesRead=0;
    while(bytesRead<b.length){const r=await fd.read(b,bytesRead,b.length-bytesRead,pos+bytesRead);if(!r.bytesRead)break;bytesRead+=r.bytesRead;}
    if(bytesRead!==b.length)throw Object.assign(new Error('Archivo en escritura.'),{code:'KADS_CAMBIO'});
    const hash=crypto.createHash('sha256').update(b).digest('hex'),obj=`bloques/${hash}`;
    if(!conocidos.has(obj)){await almacen.put(obj,cifrar(b,key,hash));conocidos.set(obj,true);}
    partes.push({obj,hash,bytes:bytesRead});pos+=bytesRead;
   }while(pos<st.size);}finally{await fd.close();}
   const despues=await fs.stat(dir);
   if(`${despues.size}:${despues.mtimeMs}:${despues.ctimeMs}`!==firma)throw Object.assign(new Error('Archivo en escritura.'),{code:'KADS_CAMBIO'});
   const entrada={ruta:rel,bytes:st.size,modo:st.mode&0o777,partes};entradas.push(entrada);conocidos.set(rel,{firma,entrada});
   }catch(e){
    if(!['KADS_CAMBIO','ENOENT'].includes(e.code))throw e;
    pendientes.push(rel);const anterior=conocidos.get(rel)?.entrada;
    if(anterior && e.code!=='ENOENT')entradas.push(anterior);
   }
  }
  const datos=Buffer.from(JSON.stringify({formato:1,entradas,pendientes})),firma=crypto.createHash('sha256').update(datos).digest('hex');
  if(firma===firmaAnterior)return null;
  const obj=`versiones/${Date.now()}-${crypto.randomUUID()}.kads`;
  await almacen.put(obj,cifrar(datos,key,'manifiesto'));await publicar(obj);firmaAnterior=firma;
  return obj;
 }
 function guardar(){const p=cola.then(capturar);cola=p.catch(()=>{});return p;}
 async function restaurar(objeto) {
  const obj=objeto || await leerActual();if(!obj)return false;nombreSeguro(obj);
  const m=JSON.parse(descifrar(await almacen.get(obj),key,'manifiesto'));
  if(m.formato!==1 || !Array.isArray(m.entradas))throw new Error('Respaldo no reconocido.');
  const vistas=new Set();
  for(const base of Object.values(destinos))if(base){await fs.mkdir(base,{recursive:true,mode:0o700});if((await fs.lstat(base)).isSymbolicLink())throw new Error('Destino inseguro.');}
  for(const e of m.entradas) {
   nombreSeguro(e.ruta);const [grupo,...resto]=e.ruta.split('/'),base=destinos[grupo];
   const rel=resto.join('/');
   if(!base || vistas.has(e.ruta) || !Array.isArray(e.partes) || !Number.isSafeInteger(e.bytes) || e.bytes<0)throw new Error('Respaldo inválido.');
   if(grupo==='raiz' && !PERSISTENTES.some(n=>rel===n || rel.startsWith(n+'/')))throw new Error('Ruta fuera de los datos de Kads.');
   if(grupo==='hogar' && !HOGAR.some(n=>rel===n || rel.startsWith(n+'/')))throw new Error('Ruta de cuenta inválida.');
   vistas.add(e.ruta);
  }
  // Primero se verifica todo; una clave incorrecta o un bloque roto no modifica el destino.
  const verificados=new Set();
  for(const e of m.entradas)for(const b of e.partes) {
   if(!/^bloques\/[a-f0-9]{64}$/.test(b.obj) || b.obj!==`bloques/${b.hash}` || b.bytes<0 || b.bytes>BLOQUE)throw new Error('Bloque inválido.');
   if(!verificados.has(b.obj)) {const x=descifrar(await almacen.get(b.obj),key,b.hash);if(x.length!==b.bytes || crypto.createHash('sha256').update(x).digest('hex')!==b.hash)throw new Error('Respaldo dañado.');verificados.add(b.obj);}
  }
  for(const e of m.entradas) {
   const [grupo,...resto]=e.ruta.split('/'),dest=path.join(destinos[grupo],...resto),temporal=`${dest}.restaurando-${crypto.randomUUID()}`;
   // Ningún padre existente puede ser un enlace que escape del destino.
   let padre=destinos[grupo];
   for(const n of resto.slice(0,-1)){padre=path.join(padre,n);try{const st=await fs.lstat(padre);if(st.isSymbolicLink() || !st.isDirectory())throw new Error('Destino inseguro.');}catch(err){if(err.code!=='ENOENT')throw err;await fs.mkdir(padre,{mode:0o700});}}
   await fs.mkdir(path.dirname(dest),{recursive:true,mode:0o700});
   const fd=await fs.open(temporal,'wx',0o600);let bytes=0;
   try{for(const b of e.partes){const x=descifrar(await almacen.get(b.obj),key,b.hash);let pos=0;while(pos<x.length){const {bytesWritten}=await fd.write(x,pos,x.length-pos);if(!bytesWritten)throw new Error('No se pudo escribir el respaldo.');pos+=bytesWritten;}bytes+=pos;}if(bytes!==e.bytes)throw new Error('Tamaño incorrecto.');}finally{await fd.close();}
   await fs.chmod(temporal,e.ruta.startsWith('hogar/')?(e.modo&0o100?0o700:0o600):/\.env$/.test(e.ruta)?0o600:e.modo&0o777);await fs.rename(temporal,dest);
  }
  return true;
 }
 return {guardar,restaurar};
}
export function almacenLocal(carpeta) {
 const root=path.resolve(carpeta);
 return {async put(n,b){nombreSeguro(n);const f=path.join(root,n);await fs.mkdir(path.dirname(f),{recursive:true,mode:0o700});await fs.writeFile(f,b,{mode:0o600});},async get(n){nombreSeguro(n);return fs.readFile(path.join(root,n));}};
}

// Exportación cifrada portátil: compatible con nube y Contabo. Las claves nunca se imprimen.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {crearEstado,almacenLocal} from './estado.mjs';
import {llave,supabase} from './comun.mjs';
export async function respaldoLocal({raiz,hogar,destino,archivoLlave}) {
 const dest=path.resolve(destino),root=path.resolve(raiz);
 if(dest===root || dest.startsWith(root+path.sep))throw new Error('Guarda el respaldo fuera de la app.');
 if(path.resolve(archivoLlave).startsWith(dest+path.sep))throw new Error('Guarda la llave fuera del respaldo.');
 await fs.mkdir(dest,{recursive:true,mode:0o700});
 const key=crypto.randomBytes(32);await fs.writeFile(archivoLlave,key.toString('hex'),{flag:'wx',mode:0o600});
 let objeto;const e=crearEstado({raiz,hogar,key,almacen:almacenLocal(dest),incluirGit:false,publicar:async n=>{objeto=n;}});
 await e.guardar();await fs.writeFile(path.join(dest,'respaldo.json'),JSON.stringify({formato:1,objeto,fecha:new Date().toISOString()}),{mode:0o600});
 return {objeto};
}
export async function restaurarLocal({destino,origen,archivoLlave,hogar}) {
 const key=llave((await fs.readFile(archivoLlave,'utf8')).trim()),m=JSON.parse(await fs.readFile(path.join(origen,'respaldo.json'),'utf8'));
 try{if((await fs.readdir(destino)).length)throw new Error('Restaura primero en una carpeta vacía para no pisar tu app.');}catch(e){if(e.code!=='ENOENT')throw e;await fs.mkdir(destino,{recursive:true,mode:0o700});}
 return crearEstado({raiz:destino,hogar,key,almacen:almacenLocal(origen)}).restaurar(m.objeto);
}
async function cli(){
 const [accion,raiz,destino,archivoLlave]=process.argv.slice(2);
 if(accion==='crear' && raiz && destino && archivoLlave){await respaldoLocal({raiz,destino,archivoLlave});console.log('Respaldo cifrado creado. Guarda la llave por separado.');}
 else if(accion==='restaurar' && raiz && destino && archivoLlave){await restaurarLocal({origen:raiz,destino,archivoLlave,hogar:process.env.KADS_HOME});console.log('Respaldo restaurado y verificado.');}
 else if(accion==='exportar-nube' && raiz){
  const sb=supabase(),key=llave(),[m]=await sb.tabla('kads_motor_estado','id=eq.1&select=objeto');if(!m)throw new Error('No hay respaldo en nube.');
  const tmp=path.resolve(raiz);try{if((await fs.readdir(tmp)).length)throw new Error('El destino debe estar vacío.');}catch(e){if(e.code!=='ENOENT')throw e;}await fs.mkdir(tmp,{recursive:true,mode:0o700});
  await crearEstado({raiz:tmp,hogar:process.env.KADS_HOME,key,almacen:{get:n=>sb.get('kads-motor',n)}}).restaurar(m.objeto);
  console.log('Estado de Supabase restaurado en la carpeta indicada. Detén el motor anterior antes de usarlo en Contabo.');
 }else throw new Error('Uso: crear <app> <respaldo> <llave nueva> | restaurar <respaldo> <destino vacío> <llave> | exportar-nube <destino vacío>');
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))cli().catch(e=>{console.error(e.message);process.exit(1);});

import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './rutas.js';
export function resumirCambios(texto='',version='') {
 const secciones=String(texto).split(/^##\s+/m).slice(1);
 const bloque=secciones.find(s=>s.startsWith(version+' ') || s.startsWith(version+'\n')) || secciones[0] || '';
 const [cabecera,...lineas]=bloque.split('\n');
 const cambios=lineas.filter(l=>/^\s*-\s+/.test(l)).slice(0,6).map(l=>l.replace(/^\s*-\s+/,'').replace(/\*\*/g,'').trim().slice(0,420));
 return {version:version || cabecera?.split(' ')[0] || '',titulo:cabecera?.replace(/^\S+\s*[·—-]?\s*/,'') || 'Mejoras de Kads Studio',cambios};
}
export function resumenLocal() {try{return resumirCambios(fs.readFileSync(path.join(RAIZ,'CAMBIOS.md'),'utf8'),fs.readFileSync(path.join(RAIZ,'VERSION'),'utf8').trim());}catch{return {version:'',titulo:'Mejoras de Kads Studio',cambios:[]};}}

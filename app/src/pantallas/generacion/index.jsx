import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, Folder, FolderOpen, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Boton, CabeceraPagina, CampoTexto, EstadoVacio, Modal } from '../../componentes/index.js';
import { pedirNuevo, useDatos, invalidar } from '../../datos/api.js';
import { fechaRelativa } from '../../datos/formato.js';
import { agruparProyectos, proyectosDe } from './datos.js';
import './generacion.css';

const TIPOS={
 imagenes:{nombre:'Anuncios de imagen',api:'/api/imagen-ads',raiz:'/imagenes',crear:'/imagenes/nuevo',accion:'Crear anuncios de imagen'},
 videos:{nombre:'Anuncios de video',api:'/api/anuncios',raiz:'/nuevo',crear:'/nuevo',accion:'Crear anuncio de video'},
 embudo:{nombre:'Embudo',api:'/api/embudos',raiz:'/embudo-whatsapp',crear:'/embudo-whatsapp',accion:'Crear embudo'},
 landings:{nombre:'Landings',api:'/api/landings',raiz:'/landings',crear:'/landings',accion:'Crear landing'},
 sketch:{nombre:'Sketch de comedia',api:'/api/sketch',raiz:'/sketch',crear:'/sketch',accion:'Crear sketch'},
 cambiar:{nombre:'Cambiar el producto',api:'/api/cambiar',raiz:'/cambiar',crear:'/cambiar',accion:'Crear cambio de producto'},
};
const ESTADOS={listo:'Listo',lista:'Listo',borrador:'Sin empezar',corriendo:'Generando',generando:'Generando',trabajando:'Generando',produciendo:'Generando','en-produccion':'Generando',esperando:'En cola',error:'Requiere atención',parcial:'Pendiente',revisar:'Por revisar',escribiendo:'Preparando guion','revisar-fotos':'Revisa las fotos','guion-listo':'Guion listo',pausado:'En pausa'};
const conConsulta=(ruta,q)=>`#${ruta}${q.toString()?`?${q}`:''}`;
function parametros(consulta) {
 const q=new URLSearchParams();
 for(const k of ['estilo','continuidad','clonar']) if(consulta?.get(k)) q.set(k,consulta.get(k));
 return q;
}

export default function EntradaGeneracion({tipo,Pantalla,consulta,params,...resto}) {
 const c=TIPOS[tipo];
 const directo=Boolean(params?.id || params?.slug || consulta?.get('crear')==='1' || consulta?.get('proyecto') || consulta?.get('producto') || consulta?.get('anuncios') || consulta?.get('inicio') || consulta?.get('referencia') || consulta?.get('paso') || consulta?.get('simular'));
 if(directo) return <><div className="pagina ge-volver"><Boton variante="fantasma" icono={ArrowLeft} href={conConsulta(c.raiz,parametros(consulta))}>Carpetas de {c.nombre}</Boton></div><Pantalla consulta={consulta} params={params} {...resto} /></>;
 return <CarpetasGeneracion key={`${tipo}:${consulta?.get('estilo') || ''}:${consulta?.get('carpeta') || ''}`} tipo={tipo} consulta={consulta} />;
}
function CarpetasGeneracion({tipo,consulta}) {
 const c=TIPOS[tipo], base=parametros(consulta), estilo=tipo==='videos'?consulta?.get('estilo'):null;
 const {datos,error,recargar}=useDatos(`generacion:${tipo}`,()=>pedirNuevo(c.api),{cadaMs:5000});
 const {datos:productos}=useDatos('generacion:productos',()=>pedirNuevo('/api/productos'),{cadaMs:15000});
 const [busqueda,setBusqueda]=useState('');
 const [borrado,setBorrado]=useState(null),[borrando,setBorrando]=useState(false),[fallo,setFallo]=useState(''),[aviso,setAviso]=useState('');
 const preguntar=(nombre,proyectos,grupo,esCarpeta=false)=>{setFallo('');setBorrado({nombre,proyectos:[...proyectos],grupo,esCarpeta});};
 async function confirmarBorrado() {
  if(borrando || !borrado)return;
  setBorrando(true);setFallo('');
  try {
   const r=await pedirNuevo(`/api/generaciones/${tipo}/borrar`,{metodo:'POST',cuerpo:{ids:borrado.proyectos.map(p=>p.id),grupo:borrado.grupo}});
   invalidar('');await recargar();
   const restantes=borrado.proyectos.filter(p=>!r.eliminados.includes(p.id));
   if(r.errores.length){setBorrado({...borrado,proyectos:restantes});setFallo(`${r.eliminados.length?`${r.eliminados.length} generaciones borradas. `:''}${r.errores.map(e=>e.mensaje).join(' ')}`);}
   else {setAviso(borrado.esCarpeta?'Se borraron las generaciones seleccionadas de la carpeta.':'Generación borrada.');setBorrado(null);if(borrado.esCarpeta && elegida)location.hash=conConsulta(c.raiz,base).slice(1);}
  } catch(e){setFallo(e.message);}finally{setBorrando(false);}
 }

 const proyectos=proyectosDe(tipo,datos,productos?.productos,estilo==='continuidad'?'estilo-pixar':estilo,estilo==='continuidad' || consulta?.get('continuidad')==='1');
 const grupos=agruparProyectos(proyectos), elegida=consulta?.get('carpeta'), carpeta=grupos.find(g=>g.id===elegida);
 const qCrear=new URLSearchParams(base); qCrear.set('crear','1');
 // Solo los formularios que ya admiten un producto lo reciben. Los demás conservan su elección habitual.
 if(carpeta?.productoId && ['videos','imagenes'].includes(tipo))qCrear.set('producto',carpeta.productoId);
 const crear=conConsulta(c.crear,qCrear);
 const filtrar=t=>String(t).toLocaleLowerCase('es').includes(busqueda.trim().toLocaleLowerCase('es'));
 const titulo=estilo?`${c.nombre} · ${estilo.replaceAll('-',' ')}`:c.nombre;
 return <div className="pagina ge pila" style={{'--hueco':'var(--e-5)'}}>
  <CabeceraPagina sobretitulo="CREAR / CARPETAS" titulo={carpeta?.nombre || titulo} descripcion={carpeta?'Tus generaciones de este producto o proyecto. Abre una para continuar.':'Tus productos y proyectos, cada uno en su carpeta. Abre una para ver sus generaciones o crea una nueva.'} acciones={<>{carpeta?<Boton icono={Trash2} onClick={()=>preguntar(carpeta.nombre,carpeta.proyectos,carpeta.id,true)}>Borrar carpeta</Boton>:null}<Boton variante="primario" icono={Plus} href={crear}>{c.accion}</Boton></>} />
  <div className="ge-barra">{elegida?<Boton variante="fantasma" icono={ArrowLeft} href={conConsulta(c.raiz,base)}>Todas las carpetas</Boton>:<span>{grupos.length} {grupos.length===1?'carpeta':'carpetas'}</span>}<CampoTexto etiqueta={carpeta?'Buscar generación':'Buscar carpeta'} value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder={carpeta?'Nombre del proyecto…':'Nombre del producto o proyecto…'} icono={Search} /></div>
  {aviso?<p role="status">{aviso}</p>:null}
  {error?<EstadoVacio titulo="No pude abrir tus carpetas" descripcion={error.message} acciones={<Boton icono={RefreshCw} onClick={recargar}>Volver a intentar</Boton>} />:!datos?<p role="status">Cargando tus carpetas…</p>:elegida && !carpeta?<EstadoVacio icono={FolderOpen} titulo="Esta carpeta ya no tiene proyectos" descripcion="Vuelve a tus carpetas para elegir otra o crear una generación." />:carpeta?<div className="ge-proyectos" aria-label="Generaciones de la carpeta">{carpeta.proyectos.filter(p=>filtrar(p.nombre)).map(p=><div key={p.id} className="ge-tarjeta"><a className="ge-proyecto" href={p.href}><div className="ge-proyecto__arriba"><FolderOpen size={24}/><span>{ESTADOS[p.estado] || (p.estado?'En proceso':'Guardado')}</span></div><h2>{p.nombre}</h2>{p.detalle?<p>{p.detalle}</p>:null}<small>{p.fecha?fechaRelativa(p.fecha):'Proyecto guardado'}</small><span className="ge-abrir">Abrir proyecto <ArrowUpRight size={16}/></span></a><Boton variante="fantasma" icono={Trash2} className="ge-borrar" onClick={()=>preguntar(p.nombre,[p],p.grupo)} aria-label={`Borrar generación ${p.nombre}`}>Borrar generación</Boton></div>)}{!carpeta.proyectos.some(p=>filtrar(p.nombre))?<p>No hay generaciones con ese nombre.</p>:null}</div>:grupos.length?<div className="ge-carpetas" aria-label="Carpetas de generación">{grupos.filter(g=>filtrar(g.nombre)).map(g=>{const q=new URLSearchParams(base);q.set('carpeta',g.id);return <div key={g.id} className="ge-tarjeta"><a className="ge-carpeta" href={conConsulta(c.raiz,q)}><div className="ge-carpeta__icono"><Folder size={40} strokeWidth={1.5}/><span>{g.proyectos.length}</span></div><h2>{g.nombre}</h2><p>{g.proyectos.length} {g.proyectos.length===1?'generación guardada':'generaciones guardadas'}</p><small>{g.fecha?`Último cambio ${fechaRelativa(g.fecha)}`:'Abre para continuar'}</small><span className="ge-abrir">Abrir carpeta <ArrowUpRight size={16}/></span></a><Boton variante="fantasma" icono={Trash2} className="ge-borrar" onClick={()=>preguntar(g.nombre,g.proyectos,g.id,true)} aria-label={`Borrar carpeta ${g.nombre}`}>Borrar carpeta</Boton></div>})}{!grupos.some(g=>filtrar(g.nombre))?<p>No hay carpetas con ese nombre.</p>:null}</div>:<EstadoVacio icono={Folder} titulo="Tu primera carpeta empieza con un proyecto" descripcion="Crea una generación. Al guardarse, aparecerá aquí en la carpeta de su producto o proyecto." acciones={<>{carpeta?<Boton icono={Trash2} onClick={()=>preguntar(carpeta.nombre,carpeta.proyectos,carpeta.id,true)}>Borrar carpeta</Boton>:null}<Boton variante="primario" icono={Plus} href={crear}>{c.accion}</Boton></>} />}
  <Modal className="ge-borrado" abierto={Boolean(borrado)} onCerrar={()=>{if(!borrando)setBorrado(null);}} titulo={borrado?.esCarpeta?'¿Borrar esta carpeta?':'¿Borrar esta generación?'} icono={Trash2} tono="peligro" pie={<><Boton variante="fantasma" disabled={borrando} onClick={()=>setBorrado(null)}>Cancelar</Boton><Boton variante="peligro" cargando={borrando} onClick={confirmarBorrado}>{borrado?.esCarpeta?'Borrar carpeta y generaciones':'Sí, borrar generación'}</Boton></>}>
   {borrado?<><p><strong>{borrado.nombre}</strong></p><p>{borrado.proyectos.length===1?'Se quitará':'Se quitarán'} {borrado.proyectos.length} {borrado.proyectos.length===1?'generación':'generaciones'} de {c.nombre}, con sus archivos. Se conservará una copia en la papelera local.</p><ul className="ge-lista-borrado">{borrado.proyectos.map(p=><li key={p.id}>{p.nombre}</li>)}</ul><p>El producto, la investigación y los recursos guardados en tu biblioteca se conservan. Las páginas ya publicadas en tiendas siguen publicadas.</p>{fallo?<p role="alert">{fallo}</p>:null}</>:null}
  </Modal>
 </div>;
}

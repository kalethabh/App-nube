// Un único diálogo para actualización publicada, instalación, reinicio e interfaz nueva.
import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Boton,Modal } from '../componentes/index.js';
import { pedirNuevo,useDatos,useEstado } from '../datos/api.js';
import { revisarGithub,revisarPublica,actualizarDesdeGithub,CADA_MS_GITHUB } from './BotonActualizar.jsx';
import './actualizaciones.css';
const LLAVE='kads:actualizacion-modal-despues';
const leer=()=>{try{return localStorage.getItem(LLAVE) || '';}catch{return '';}};
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
export function Actualizaciones() {
 const {datos:estado}=useEstado({cadaMs:15000});
 const {datos:gh,recargar:recargarGh}=useDatos('github-actualizar',revisarGithub,{cadaMs:CADA_MS_GITHUB});
 const {datos:publica,recargar:recargarPublica}=useDatos(gh?.repositorio===false?'actualizar-publica':null,revisarPublica,{cadaMs:CADA_MS_GITHUB});
 const {datos:local,recargar:recargarLocal}=useDatos('actualizar-resumen',()=>pedirNuevo('/api/actualizar/resumen'));
 const [forzado,setForzado]=useState(false),[oculta,setOculta]=useState(leer),[fase,setFase]=useState(''),[resultado,setResultado]=useState(null);
 const primeraInterfaz=useRef(null),vivo=useRef(true),esperando=useRef(false);
 const servidor=estado?.servidor,armada=servidor?.interfaz?.armada;
 if(armada && !primeraInterfaz.current)primeraInterfaz.current=armada;
 const interfazNueva=Boolean(armada && primeraInterfaz.current && armada!==primeraInterfaz.current);
 const repositorio=gh?.repositorio!==false;
 const remoto=repositorio?Boolean(gh?.atrasados || gh?.pantallaSinArmar):Boolean(publica?.hayNueva);
 const reinicio=Boolean(servidor?.desactualizado || servidor?.reinicioPedido || (resultado?.ok && resultado?.reabrir));
 const clave=reinicio?`reinicio:${local?.version || ''}`:interfazNueva?`interfaz:${armada}`:remoto?`remoto:${repositorio?gh?.ultimo?.fecha || gh?.resumen?.version:publica?.nueva}`:servidor?.interfaz?.armando?'armando':'';
 const ocupado=['actualizando','reiniciando'].includes(fase);
 const abierto=forzado || ocupado || Boolean(clave && clave!==oculta);
 const resumen=remoto && repositorio?gh?.resumen:local;
 const cambios=!repositorio && remoto?String(publica?.notas || '').split('\n').filter(l=>/^\s*-\s+/.test(l)).slice(0,6).map(l=>l.replace(/^\s*-\s+/,'').replace(/\*\*/g,'').slice(0,420)):resumen?.cambios || [];
 useEffect(()=>{vivo.current=true;const abrir=()=>{setForzado(true);setResultado(null);recargarGh();recargarPublica();recargarLocal();};window.addEventListener('kads:abrir-actualizaciones',abrir);return()=>{vivo.current=false;window.removeEventListener('kads:abrir-actualizaciones',abrir);};},[]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(reinicio || interfazNueva)recargarLocal();},[reinicio,interfazNueva]); // eslint-disable-line react-hooks/exhaustive-deps
 const esperar=async()=>{if(esperando.current)return;esperando.current=true;await dormir(3000);while(vivo.current){const e=await fetch('/api/estado',{cache:'no-store',signal:AbortSignal.timeout(5000)}).then(r=>r.ok?r.json():null,()=>null);if(e?.servidor && !e.servidor.desactualizado && !e.servidor.reinicioPedido){window.location.reload();return;}await dormir(3000);}esperando.current=false;};
 useEffect(()=>{if(servidor?.reinicioPedido){setFase(servidor.ocupado?'esperando':'reiniciando');esperar();}},[servidor?.reinicioPedido,servidor?.ocupado]); // eslint-disable-line react-hooks/exhaustive-deps
 const cerrar=()=>{if(ocupado)return;setForzado(false);setResultado(null);setOculta(clave);try{localStorage.setItem(LLAVE,clave);}catch{}};
 const ejecutar=async()=>{
  setForzado(true);setResultado(null);
  if(interfazNueva && !reinicio && !remoto){window.location.reload();return;}
  setFase(reinicio?'reiniciando':'actualizando');
  try {
   if(reinicio){const r=await pedirNuevo('/api/reiniciar',{metodo:'POST'});if(r?.error || r?.ok===false)throw new Error(r.error || r.mensaje);if(r?.pendiente)setFase('esperando');esperar();return;}
   const r=repositorio?await actualizarDesdeGithub():await pedirNuevo('/api/actualizar/publica',{metodo:'POST'});
   setResultado(r);
   if(r?.recargar || (r?.ok && r.cambios && !r.reabrir && !r.reinicia)){window.location.reload();return;}
   if(r?.reinicia){setFase('reiniciando');esperar();return;}
  }catch(e){setResultado({ok:false,mensaje:e.message || 'No pude completar la actualización. Vuelve a intentarlo.'});}
  setFase('');recargarGh();recargarPublica();recargarLocal();
 };
 const titulo=fase==='actualizando'?'Actualizando Kads Studio':fase==='reiniciando'?'Preparando el reinicio':fase==='esperando'?'Reinicio al terminar los trabajos':reinicio?'Actualización lista para activar':interfazNueva?'Pantalla nueva disponible':remoto?'Hay una actualización disponible':'Tu versión de Kads Studio';
 return <Modal abierto={abierto} onCerrar={cerrar} titulo={titulo} descripcion={remoto?(resumen?.titulo || `Versión ${publica?.nueva || ''}`):resumen?.titulo || 'Resumen de los cambios de la app'} icono={RefreshCw} tamano="normal" cerrarAfuera={!ocupado} className="actualizaciones-modal" pie={<><Boton variante="fantasma" disabled={ocupado} onClick={cerrar}>{remoto || reinicio?'Después':'Cerrar'}</Boton>{remoto || reinicio || interfazNueva?<Boton variante="primario" icono={RefreshCw} cargando={ocupado} disabled={fase==='esperando'} onClick={ejecutar}>{reinicio?servidor?.ocupado?'Reiniciar al terminar':'Reiniciar la app':interfazNueva && !remoto?'Recargar':'Actualizar ahora'}</Boton>:null}</>}>
  {resumen?.version || publica?.nueva?<p className="actualizaciones-version">{remoto && !repositorio?publica?.nueva:resumen?.version}</p>:null}
  {cambios.length?<ul className="actualizaciones-cambios">{cambios.map((c,i)=><li key={i}>{c}</li>)}</ul>:<p>{remoto?'Hay mejoras disponibles. Puedes instalarlas desde esta ventana.':'Aquí aparecerá el resumen de esta versión.'}</p>}
  {ocupado || fase==='esperando'?<p role="status" className="actualizaciones-estado"><RefreshCw size={18} className="girando"/>{fase==='actualizando'?'Descargando e instalando la actualización…':fase==='esperando' || servidor?.reinicioPedido || servidor?.ocupado?'La app se reiniciará cuando terminen los trabajos en curso.':'Reiniciando la app. La página se recargará sola…'}</p>:servidor?.interfaz?.armando?<p role="status">Preparando la pantalla nueva…</p>:null}
  {resultado?<p role={resultado.ok===false?'alert':'status'}>{resultado.error || resultado.mensaje || (resultado.ok?'La actualización está instalada. Reinicia la app para activarla.':'No pude actualizar.')}</p>:null}
 </Modal>;
}

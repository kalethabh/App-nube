import { useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { pedirNuevo,useDatos } from '../datos/api.js';
import './notificaciones-landing.css';
export function NotificacionesLanding({ completa=false }) {
 const {datos,recargar}=useDatos('notificaciones',()=>pedirNuevo('/api/notificaciones'),{cadaMs:5000});
 const [error,setError]=useState('');
 const leida=async id=>{try{await pedirNuevo(`/api/notificaciones/${id}/leer`,{metodo:'POST'});await recargar();setError('');}catch{setError('No pude guardar que viste el aviso.');}};
 return <aside className={`notificaciones-landing${completa?' notificaciones-landing--completa':''}`} aria-label="Avisos de tus landings" aria-live="polite">{(datos?.notificaciones || []).slice(0,3).map(n=><article key={n.id} className="nl-aviso" role="status"><CheckCircle2 size={22}/><div><strong>{n.titulo}</strong><p>{n.texto}</p><a href={n.urlPublica || n.destino} target={n.urlPublica?'_blank':undefined} rel={n.urlPublica?'noopener noreferrer':undefined} onClick={()=>leida(n.id)}>{n.urlPublica?'Ver página publicada':'Ver landing'}</a></div><button className="nl-cerrar" aria-label={`Cerrar aviso: ${n.titulo}`} onClick={()=>leida(n.id)}><X size={16}/></button></article>)}{error?<p role="alert">{error}</p>:null}</aside>;
}

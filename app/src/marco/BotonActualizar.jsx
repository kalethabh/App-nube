// Botón común de actualizaciones: abre el único resumen central para GitHub, paquete publicado y reinicio.
import { RefreshCw } from 'lucide-react';
import { Boton } from '../componentes/Boton.jsx';
import { useDatos, invalidar } from '../datos/api.js';

/** Lo que dice GitHub (el servidor lo recuerda un minuto; `ahora` pregunta sí o sí). */
export async function revisarGithub({ ahora = false } = {}) {
  const r = await fetch(`/api/github/actualizar${ahora ? '?ahora=1' : ''}`, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('No pude revisar GitHub.');
  return r.json();
}
const revisar = () => revisarGithub();
export const CADA_MS_GITHUB = 2 * 60000;

/**
 * Solicita la actualización. El diálogo central se encarga de esperar el reinicio y recargar.
 * Devuelve la respuesta del servidor ({ ok, mensaje, cambios, reinicia, recargar }).
 */
export async function actualizarDesdeGithub() {
  const r = await fetch('/api/github/actualizar', { method: 'POST', headers: { Accept: 'application/json' } });
  const d = await r.json().catch(() => ({}));
  const resultado = d?.mensaje ? d : { ok: false, mensaje: 'No pude actualizar. Vuelve a intentarlo.' };
  invalidar('github-actualizar');
  return resultado;
}

export async function revisarPublica() {
 const r=await fetch('/api/actualizar/publica',{headers:{Accept:'application/json'}});
 if(!r.ok)throw new Error('No pude revisar la versión publicada.');return r.json();
}
export function BotonActualizar() {
 const {datos:gh}=useDatos('github-actualizar',revisar,{cadaMs:CADA_MS_GITHUB});
 const {datos:publica}=useDatos(gh?.repositorio===false?'actualizar-publica':null,revisarPublica,{cadaMs:CADA_MS_GITHUB});
 const hay=gh?.repositorio===false?publica?.hayNueva:gh?.atrasados || gh?.pantallaSinArmar;
 return <span className="barra__actualizar"><Boton variante="secundario" tamano="chico" icono={RefreshCw} onClick={()=>window.dispatchEvent(new Event('kads:abrir-actualizaciones'))}>Actualizar</Boton>{hay?<span className="barra__actualizar-punto" aria-label="Hay una versión nueva"/>:null}</span>;
}

// LA COORDINADORA EN CUALQUIER PANTALLA (2026-11-20j, «algo flotante o una notificación en cualquier parte donde la
// coordinadora me escriba o necesite alguna aprobación»): una burbuja abajo a la derecha con su cara y un número (sus
// mensajes que no has leído + lo que espera tu sí). Cuando te escribe sola (un guion listo con su costo, algo que
// terminó o se frenó) sale una tarjeta con lo que dice; si es una aprobación, con «Dale» ahí mismo. Tocar la burbuja
// abre su chat flotante, el mismo de la oficina (Chat.jsx): le respondes sin salir de donde estás.
// En la oficina no sale (allí está su chat). Lo leído se recuerda en este navegador (coordinadora:visto).
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { pedirNuevo, useDatos } from '../datos/api.js';
import { Chat } from '../pantallas/oficina/Chat.jsx';
import '../pantallas/oficina/oficina.css';
import './aviso-coordinadora.css';

const VISTO = 'coordinadora:visto';
const leer = () => {
  try {
    return localStorage.getItem(VISTO) || '';
  } catch {
    return '';
  }
};
const guardar = (v) => {
  try {
    localStorage.setItem(VISTO, v);
  } catch {
    /* sin almacenamiento */
  }
};
const dinero = (n) => `US$${(Math.round(Number(n) * 100) / 100).toFixed(2)}`;

export function AvisoCoordinadora({ oculto = false }) {
  const { datos, recargar } = useDatos('oficina:chat', () => pedirNuevo('/api/oficina/chat'), { cadaMs: 8000 });
  const [abierto, setAbierto] = useState(false);
  const [visto, setVisto] = useState(leer);
  const [tarjeta, setTarjeta] = useState(null); // el último mensaje que llegó solo
  const [enviando, setEnviando] = useState(false);
  const ultimoAvisado = useRef(null);
  const mensajes = datos?.mensajes || [];
  const pendientes = datos?.pendientes || [];
  const quien = datos?.coordinadora || { nombre: 'Coordinadora', avatar: '👩‍💼', color: '#ffc774' };
  const ultimo = mensajes.at(-1) || null;

  // sus mensajes que no leíste (después del último que viste)
  const k = visto ? mensajes.findIndex((m) => m.id === visto) : -1;
  const sinLeer = (k >= 0 ? mensajes.slice(k + 1) : visto ? [] : mensajes).filter((m) => m.de === 'coordinadora').length;
  const numero = sinLeer + pendientes.length;

  // la primera vez: lo que ya había se da por leído (no aparece una tarjeta de mensajes viejos)
  useEffect(() => {
    if (!visto && ultimo) {
      guardar(ultimo.id);
      setVisto(ultimo.id);
    }
  }, [visto, ultimo]);
  // abierto: todo leído
  useEffect(() => {
    if (abierto && ultimo && ultimo.id !== visto) {
      guardar(ultimo.id);
      setVisto(ultimo.id);
    }
  }, [abierto, ultimo, visto]);
  // llegó un mensaje suyo nuevo: la tarjeta, unos segundos (las aprobaciones se quedan hasta que respondas)
  useEffect(() => {
    if (!ultimo || ultimo.de !== 'coordinadora' || abierto || oculto || !visto || ultimo.id === visto || ultimoAvisado.current === ultimo.id) return undefined;
    ultimoAvisado.current = ultimo.id;
    setTarjeta(ultimo);
    if (pendientes.length) return undefined;
    const t = setTimeout(() => setTarjeta(null), 12000);
    return () => clearTimeout(t);
  }, [ultimo, abierto, oculto, visto, pendientes.length]);

  if (oculto) return null;
  const abrir = () => {
    setTarjeta(null);
    setAbierto(true);
  };
  const dale = async (p) => {
    setEnviando(true);
    try {
      await pedirNuevo('/api/oficina/chat', { metodo: 'POST', cuerpo: { texto: `Dale, apruébalo y produce ${p.titulo} (${dinero(p.costo)})` } });
      setTarjeta(null);
      setAbierto(true);
      await recargar?.();
    } finally {
      setEnviando(false);
    }
  };
  const pend = pendientes.at(-1);

  return (
    <div className="avc" style={{ '--color': quien.color }}>
      {abierto ? (
        <div className="avc__panel of--pro" role="dialog" aria-label={`Chat con ${quien.nombre}`}>
          <Chat coordinadora={quien} onCerrar={() => setAbierto(false)} />
        </div>
      ) : null}
      {tarjeta && !abierto ? (
        <div className="avc__tarjeta" role="status" aria-live="polite">
          <button type="button" className="avc__cerrar" onClick={() => setTarjeta(null)} aria-label="Cerrar el aviso">
            <X size={14} />
          </button>
          <span className="avc__quien">
            <span aria-hidden="true">{quien.avatar}</span> {quien.nombre} {pend ? 'necesita tu aprobación' : 'te escribió'}
          </span>
          <p>{tarjeta.texto.length > 220 ? `${tarjeta.texto.slice(0, 220)}…` : tarjeta.texto}</p>
          <div className="avc__botones">
            {pend ? (
              <button type="button" className="avc__dale" onClick={() => dale(pend)} disabled={enviando}>
                Dale · {dinero(pend.costo)}
              </button>
            ) : null}
            <button type="button" className="avc__responder" onClick={abrir}>
              {pend ? 'Ver primero' : 'Responder'}
            </button>
          </div>
        </div>
      ) : null}
      <button type="button" className={`avc__burbuja${numero ? ' avc__burbuja--avisa' : ''}${abierto ? ' avc__burbuja--abierta' : ''}`} onClick={() => (abierto ? setAbierto(false) : abrir())} aria-label={abierto ? `Cerrar el chat con ${quien.nombre}` : `Hablar con ${quien.nombre}${numero ? ` (${numero} sin ver)` : ''}`} title={`Hablar con ${quien.nombre}`}>
        {abierto ? <X size={20} /> : <span aria-hidden="true">{quien.avatar}</span>}
        {numero && !abierto ? <b className="avc__numero">{numero > 9 ? '9+' : numero}</b> : null}
        {datos?.pensando && !abierto ? <i className="avc__pensando" aria-hidden="true" /> : null}
      </button>
    </div>
  );
}

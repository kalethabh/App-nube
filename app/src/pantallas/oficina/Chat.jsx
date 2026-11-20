// El chat con la coordinadora (2026-11-19r): le escribes lo que quieres («hazme 3 anuncios UGC de Aguaje») y ella
// reparte el trabajo: los guiones quedan esperando tu aprobación (nada se cobra sin tu sí). Cada acción trae su enlace
// y su estado en vivo. Servidor: GET/POST/DELETE /api/oficina/chat (lib/oficina-chat.js).
import { useEffect, useRef, useState } from 'react';
import { Check, Eraser, Send, X } from 'lucide-react';
import { useAvisos } from '../../componentes/index.js';
import { invalidar, pedirNuevo, useDatos } from '../../datos/api.js';

const CLAVE = 'oficina:chat';
const ESTADO = { escribiendo: 'escribiendo el guion…', aprobar: 'espera tu aprobación', produciendo: 'produciéndose', listo: 'listo', error: 'se frenó', 'no-esta': 'ya no está' };
const IDEAS = ['Hazme 3 anuncios UGC de mi producto', '¿Cómo va el trabajo?', 'Investiga el mercado de mi producto en Colombia', 'De ahora en adelante, los ganchos más cortos'];

export function Chat({ coordinadora, onCerrar, inicial = '' }) {
  const { aviso } = useAvisos();
  const [texto, setTexto] = useState(inicial);
  const [enviando, setEnviando] = useState(false);
  const [rapido, setRapido] = useState(false);
  const { datos, recargar } = useDatos(CLAVE, () => pedirNuevo('/api/oficina/chat'), { cadaMs: rapido ? 1500 : 6000 });
  const pensando = Boolean(datos?.pensando);
  const mensajes = datos?.mensajes || [];
  const fondo = useRef(null);
  useEffect(() => setRapido(pensando), [pensando]);
  useEffect(() => {
    fondo.current?.scrollIntoView({ block: 'end' });
  }, [mensajes.length, pensando]);
  const nombre = coordinadora?.nombre || 'Coordinadora';

  const enviar = async (t = texto) => {
    const limpio = t.trim();
    if (!limpio || enviando || pensando) return;
    setEnviando(true);
    try {
      await pedirNuevo('/api/oficina/chat', { metodo: 'POST', cuerpo: { texto: limpio } });
      setTexto('');
      setRapido(true);
      await recargar?.();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude enviarlo', texto: e.message });
    } finally {
      setEnviando(false);
    }
  };
  const borrar = async () => {
    try {
      await pedirNuevo('/api/oficina/chat', { metodo: 'DELETE' });
      invalidar(CLAVE);
      await recargar?.();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude borrarlo', texto: e.message });
    }
  };

  return (
    <aside className="of-chat" style={{ '--color': coordinadora?.color || '#a3e635' }} aria-label={`Chat con ${nombre}`}>
      <header className="of-chat__cabeza">
        <span className="of-chat__cara" aria-hidden="true">{coordinadora?.avatar || '👩‍💼'}</span>
        <span className="of-chat__quien">
          <strong>{nombre}</strong>
          <span>{pensando ? 'escribiendo…' : 'Coordinadora · reparte el trabajo'}</span>
        </span>
        {mensajes.length ? (
          <button type="button" className="of-chat__icono" onClick={borrar} aria-label="Borrar la conversación" title="Borrar la conversación">
            <Eraser size={15} />
          </button>
        ) : null}
        <button type="button" className="of-chat__icono" onClick={onCerrar} aria-label="Cerrar el chat">
          <X size={16} />
        </button>
      </header>
      <div className="of-chat__mensajes" role="log" aria-live="polite">
        {!mensajes.length ? (
          <div className="of-chat__vacio">
            <p>Hola, soy {nombre}. Dime qué necesitas y lo reparto en el equipo. Los guiones te esperan para que los apruebes: nada se cobra sin tu sí.</p>
            <div className="of-chat__ideas">
              {IDEAS.map((i) => (
                <button key={i} type="button" onClick={() => enviar(i)} disabled={enviando || pensando}>
                  {i}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {mensajes.map((m) => (
          <div key={m.id} className={`of-msg of-msg--${m.de}`}>
            <p>{m.texto}</p>
            {m.acciones?.length ? (
              <ul className="of-msg__acciones">
                {m.acciones.map((a, i) => (
                  <li key={i}>
                    {a.href && a.ok ? (
                      <a href={a.href} className="of-accion">
                        <Check size={13} aria-hidden="true" /> <span>{a.titulo}</span>
                        {a.estado ? <small className={`of-accion__estado of-accion__estado--${a.estado}`}>{ESTADO[a.estado] || a.estado}</small> : null}
                      </a>
                    ) : (
                      <span className={`of-accion${a.ok === false ? ' of-accion--mal' : ''}`}>{a.titulo}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
        {pensando ? (
          <div className="of-msg of-msg--coordinadora of-msg--pensando" aria-label={`${nombre} está escribiendo`}>
            <span /> <span /> <span />
          </div>
        ) : null}
        <div ref={fondo} />
      </div>
      <form
        className="of-chat__escribir"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <textarea
          rows={2}
          maxLength={2000}
          placeholder={`Escríbele a ${nombre}…`}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
          aria-label={`Mensaje para ${nombre}`}
        />
        <button type="submit" className="of-chat__enviar" disabled={!texto.trim() || enviando || pensando} aria-label="Enviar">
          <Send size={16} />
        </button>
      </form>
    </aside>
  );
}

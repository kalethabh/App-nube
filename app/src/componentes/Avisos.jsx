import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleCheck, Info, TriangleAlert, CircleAlert, X } from 'lucide-react';
import './Avisos.css';

const Contexto = createContext(null);

const TIPOS = {
  ok: { icono: CircleCheck },
  info: { icono: Info },
  aviso: { icono: TriangleAlert },
  error: { icono: CircleAlert },
};

/**
 * Avisos que aparecen abajo a la derecha y se van solos.
 * Va una sola vez alrededor de la app (main.jsx). Desde cualquier pantalla:
 *
 *   const { aviso } = useAvisos();
 *   aviso({ tipo: 'ok', titulo: 'Guardado', texto: 'Tu música quedó en el anuncio.' });
 *   aviso({ tipo: 'error', titulo: 'No se pudo exportar', accion: { etiqueta: 'Reintentar', alHacer: exportar } });
 *
 * tipo: ok | info | aviso | error · duracion en ms (0 = no se va solo)
 */
export function ProveedorAvisos({ children }) {
  const [lista, setLista] = useState([]);
  const timers = useRef(new Map());

  const cerrar = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setLista((l) => l.map((a) => (a.id === id ? { ...a, saliendo: true } : a)));
    setTimeout(() => setLista((l) => l.filter((a) => a.id !== id)), 200);
  }, []);

  const aviso = useCallback(
    ({ tipo = 'info', titulo, texto, accion, duracion = 4500 }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setLista((l) => [...l.slice(-3), { id, tipo, titulo, texto, accion, duracion }]);
      if (duracion > 0) timers.current.set(id, setTimeout(() => cerrar(id), duracion));
      return id;
    },
    [cerrar]
  );

  const valor = useMemo(() => ({ aviso, cerrar }), [aviso, cerrar]);

  return (
    <Contexto.Provider value={valor}>
      {children}
      {createPortal(
        <div className="avisos" aria-live="polite" aria-atomic="false">
          {lista.map((a) => {
            const Icono = TIPOS[a.tipo]?.icono || Info;
            return (
              <div key={a.id} role={a.tipo === 'error' ? 'alert' : 'status'} className={`aviso aviso--${a.tipo}${a.saliendo ? ' aviso--saliendo' : ''}`}>
                <span className="aviso__icono" aria-hidden="true">
                  <Icono size={17} strokeWidth={2.2} />
                </span>
                <div className="aviso__textos">
                  {a.titulo ? <p className="aviso__titulo">{a.titulo}</p> : null}
                  {a.texto ? <p className="aviso__texto">{a.texto}</p> : null}
                  {a.accion ? (
                    <button
                      type="button"
                      className="aviso__accion"
                      onClick={() => {
                        a.accion.alHacer?.();
                        cerrar(a.id);
                      }}
                    >
                      {a.accion.etiqueta}
                    </button>
                  ) : null}
                </div>
                <button type="button" className="aviso__cerrar" aria-label="Cerrar aviso" onClick={() => cerrar(a.id)}>
                  <X size={15} strokeWidth={2.2} />
                </button>
                {a.duracion > 0 ? <span className="aviso__tiempo" style={{ animationDuration: `${a.duracion}ms` }} aria-hidden="true" /> : null}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </Contexto.Provider>
  );
}

export function useAvisos() {
  const c = useContext(Contexto);
  if (!c) throw new Error('useAvisos necesita <ProveedorAvisos> alrededor de la app.');
  return c;
}

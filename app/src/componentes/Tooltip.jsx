import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './Tooltip.css';

/**
 * Globo de ayuda al pasar el mouse o al enfocar con el teclado.
 *   <Tooltip texto="Se ve cuando la app se conecte a kie.ai"><Boton …/></Tooltip>
 *   <Tooltip texto={<>Atajo <kbd>N</kbd></>} lado="derecha">…</Tooltip>
 * lado: arriba | abajo | izquierda | derecha (si no cabe, se da vuelta solo)
 */
export function Tooltip({ texto, lado = 'arriba', retraso = 280, children, className = '' }) {
  const ancla = useRef(null);
  const globo = useRef(null);
  const timer = useRef(null);
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState(null);

  const abrir = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAbierto(true), retraso);
  }, [retraso]);
  const cerrar = useCallback(() => {
    clearTimeout(timer.current);
    setAbierto(false);
    setPos(null);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  useLayoutEffect(() => {
    if (!abierto || !ancla.current || !globo.current) return;
    const a = ancla.current.getBoundingClientRect();
    const g = globo.current.getBoundingClientRect();
    const m = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let l = lado;
    if (l === 'arriba' && a.top - g.height - m < 4) l = 'abajo';
    else if (l === 'abajo' && a.bottom + g.height + m > vh - 4) l = 'arriba';
    else if (l === 'derecha' && a.right + g.width + m > vw - 4) l = 'izquierda';
    else if (l === 'izquierda' && a.left - g.width - m < 4) l = 'derecha';
    let top;
    let left;
    if (l === 'arriba' || l === 'abajo') {
      top = l === 'arriba' ? a.top - g.height - m : a.bottom + m;
      left = a.left + a.width / 2 - g.width / 2;
    } else {
      top = a.top + a.height / 2 - g.height / 2;
      left = l === 'izquierda' ? a.left - g.width - m : a.right + m;
    }
    left = Math.max(6, Math.min(vw - g.width - 6, left));
    top = Math.max(6, Math.min(vh - g.height - 6, top));
    setPos({ top, left, lado: l });
  }, [abierto, lado, texto]);

  if (!texto) return children;

  return (
    <>
      <span
        ref={ancla}
        className={`tooltip-ancla ${className}`}
        onMouseEnter={abrir}
        onMouseLeave={cerrar}
        onFocus={abrir}
        onBlur={cerrar}
        aria-describedby={abierto ? id : undefined}
      >
        {children}
      </span>
      {abierto
        ? createPortal(
            <div
              ref={globo}
              id={id}
              role="tooltip"
              className={`tooltip tooltip--${pos?.lado || lado}`}
              style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999, visibility: 'hidden' }}
            >
              {texto}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Boton } from './Boton.jsx';
import './Modal.css';

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Ventana encima de la pantalla.
 *   <Modal abierto={x} onCerrar={() => setX(false)} titulo="¿Rehacer este clip?" descripcion="…"
 *          icono={Wand} pie={<><Boton variante="fantasma">Cancelar</Boton><Boton variante="primario">Sí, rehacer</Boton></>}>
 *     …contenido…
 *   </Modal>
 * tamano: chico (420) | normal (560) | grande (820) · Escape o clic afuera la cierran.
 */
export function Modal({ abierto, onCerrar, titulo, descripcion, icono: Icono, tono = 'acento', pie, tamano = 'normal', cerrarAfuera = true, children, className = '' }) {
  const ref = useRef(null);
  const anterior = useRef(null);
  const idTitulo = useId();
  const idDesc = useId();
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;

  useEffect(() => {
    if (!abierto) return undefined;
    anterior.current = document.activeElement;
    const enfocar = requestAnimationFrame(() => {
      const lista = [...(ref.current?.querySelectorAll(ENFOCABLES) || [])].filter((el) => !el.classList.contains('modal__cerrar'));
      const primero = ref.current?.querySelector('[data-autofocus]') || lista[0];
      (primero || ref.current)?.focus();
    });
    const alTeclado = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        cerrarRef.current?.();
      }
      if (e.key === 'Tab' && ref.current) {
        const lista = [...ref.current.querySelectorAll(ENFOCABLES)];
        if (!lista.length) return;
        const [primero, ultimo] = [lista[0], lista[lista.length - 1]];
        if (e.shiftKey && document.activeElement === primero) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primero.focus();
        }
      }
    };
    document.addEventListener('keydown', alTeclado);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(enfocar);
      document.removeEventListener('keydown', alTeclado);
      document.body.style.overflow = overflow;
      anterior.current?.focus?.();
    };
  }, [abierto]);

  if (!abierto) return null;

  return createPortal(
    <div className="modal-velo" onMouseDown={(e) => cerrarAfuera && e.target === e.currentTarget && onCerrar?.()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titulo ? idTitulo : undefined}
        aria-describedby={descripcion ? idDesc : undefined}
        tabIndex={-1}
        className={`modal modal--${tamano} ${className}`}
      >
        <Boton variante="fantasma" tamano="chico" soloIcono icono={X} etiqueta="Cerrar" className="modal__cerrar" onClick={onCerrar} />
        {titulo || descripcion ? (
          <div className="modal__cabecera">
            {Icono ? (
              <span className={`modal__icono modal__icono--${tono}`} aria-hidden="true">
                <Icono size={20} strokeWidth={2} />
              </span>
            ) : null}
            <div className="modal__textos">
              {titulo ? (
                <h2 id={idTitulo} className="modal__titulo">
                  {titulo}
                </h2>
              ) : null}
              {descripcion ? (
                <p id={idDesc} className="modal__descripcion">
                  {descripcion}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
        {children ? <div className="modal__cuerpo">{children}</div> : null}
        {pie ? <div className="modal__pie">{pie}</div> : null}
      </div>
    </div>,
    document.body
  );
}

import './Interruptor.css';

/**
 * Interruptor sí/no.
 *   <Interruptor activado={continuidad} onCambio={setContinuidad} etiqueta="¿Deseas continuidad?"
 *                descripcion="Cada escena se transforma en la siguiente, sin cortes." />
 */
export function Interruptor({ activado = false, onCambio, etiqueta, descripcion, deshabilitado = false, tamano = 'normal', className = '' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activado}
      disabled={deshabilitado}
      onClick={() => onCambio?.(!activado)}
      className={`interruptor interruptor--${tamano} ${className}`}
    >
      <span className="interruptor__pista" aria-hidden="true">
        <span className="interruptor__perilla" />
      </span>
      {etiqueta || descripcion ? (
        <span className="interruptor__texto">
          {etiqueta ? <span className="interruptor__etiqueta">{etiqueta}</span> : null}
          {descripcion ? <span className="interruptor__descripcion">{descripcion}</span> : null}
        </span>
      ) : null}
    </button>
  );
}

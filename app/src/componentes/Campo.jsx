import { forwardRef, useId } from 'react';
import { ChevronDown, CircleAlert } from 'lucide-react';
import './Campo.css';

/** Envoltorio común: etiqueta arriba, ayuda o error abajo. Lo usan CampoTexto, AreaTexto y Selector. */
export function Campo({ etiqueta, opcional, ayuda, error, id, children, className = '' }) {
  return (
    <div className={`campo${error ? ' campo--error' : ''} ${className}`}>
      {etiqueta ? (
        <label className="campo__etiqueta" htmlFor={id}>
          {etiqueta}
          {opcional ? <span className="campo__opcional">opcional</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <span className="campo__error" id={`${id}-error`} role="alert">
          <CircleAlert size={13} strokeWidth={2.2} aria-hidden="true" />
          {error}
        </span>
      ) : ayuda ? (
        <span className="campo__ayuda" id={`${id}-ayuda`}>
          {ayuda}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Campo de texto.
 *   <CampoTexto etiqueta="Link de tu página" placeholder="https://…" icono={Link} value={…} onChange={…} />
 *   <CampoTexto etiqueta="Precio" sufijo="US$" ayuda="Lo que paga tu cliente" />
 */
export const CampoTexto = forwardRef(function CampoTexto({ etiqueta, opcional, ayuda, error, icono: Icono, sufijo, id, className = '', ...resto }, ref) {
  const propio = useId();
  const idc = id || propio;
  return (
    <Campo etiqueta={etiqueta} opcional={opcional} ayuda={ayuda} error={error} id={idc} className={className}>
      <div className="campo__control">
        {Icono ? <Icono size={16} strokeWidth={2} className="campo__icono" aria-hidden="true" /> : null}
        <input
          ref={ref}
          id={idc}
          className="campo__entrada"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${idc}-error` : ayuda ? `${idc}-ayuda` : undefined}
          {...resto}
        />
        {sufijo ? <span className="campo__sufijo">{sufijo}</span> : null}
      </div>
    </Campo>
  );
});

/** Área de texto (varias líneas). `filas` = alto inicial. */
export const AreaTexto = forwardRef(function AreaTexto({ etiqueta, opcional, ayuda, error, filas = 4, id, className = '', ...resto }, ref) {
  const propio = useId();
  const idc = id || propio;
  return (
    <Campo etiqueta={etiqueta} opcional={opcional} ayuda={ayuda} error={error} id={idc} className={className}>
      <div className="campo__control campo__control--area">
        <textarea
          ref={ref}
          id={idc}
          rows={filas}
          className="campo__entrada"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${idc}-error` : ayuda ? `${idc}-ayuda` : undefined}
          {...resto}
        />
      </div>
    </Campo>
  );
});

/**
 * Selector (lista desplegable).
 *   <Selector etiqueta="Duración" value={d} onChange={(e) => setD(e.target.value)}
 *             opciones={[{ valor: '30', etiqueta: '30 segundos' }, …]} />
 */
export const Selector = forwardRef(function Selector({ etiqueta, opcional, ayuda, error, opciones = [], icono: Icono, id, className = '', ...resto }, ref) {
  const propio = useId();
  const idc = id || propio;
  return (
    <Campo etiqueta={etiqueta} opcional={opcional} ayuda={ayuda} error={error} id={idc} className={className}>
      <div className="campo__control campo__control--selector">
        {Icono ? <Icono size={16} strokeWidth={2} className="campo__icono" aria-hidden="true" /> : null}
        <select ref={ref} id={idc} className="campo__entrada" aria-invalid={error ? true : undefined} {...resto}>
          {opciones.map((o) => (
            <option key={o.valor} value={o.valor} disabled={o.deshabilitada}>
              {o.etiqueta}
            </option>
          ))}
        </select>
        <ChevronDown size={16} strokeWidth={2} className="campo__flecha" aria-hidden="true" />
      </div>
    </Campo>
  );
});

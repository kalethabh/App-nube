import { Eye } from 'lucide-react';
import { Tooltip } from './Tooltip.jsx';
import './VistaPrevia.css';

const EXPLICACION = 'Esto todavía no está conectado: lo que ves son datos de ejemplo tomados de un anuncio real.';

/**
 * La marca discreta "Vista previa del diseño" para lo que todavía no funciona de verdad.
 *   <VistaPrevia />                                  (insignia chica, con explicación al pasar el mouse)
 *   <VistaPrevia texto="Ejemplo" />
 *   <VistaPrevia enfocable={false} />            (dentro de un enlace o botón)
 *   <VistaPrevia variante="banda">El guion lo va a escribir Claude Code con tu cuenta.</VistaPrevia>
 */
export function VistaPrevia({ texto = 'Vista previa del diseño', variante = 'insignia', explicacion = EXPLICACION, enfocable = true, children, className = '' }) {
  if (variante === 'banda') {
    return (
      <div className={`vista-previa vista-previa--banda ${className}`} role="note">
        <Eye size={15} strokeWidth={2} aria-hidden="true" />
        <span>
          <strong>{texto}.</strong> {children || explicacion}
        </span>
      </div>
    );
  }
  return (
    <Tooltip texto={explicacion} lado="abajo">
      <span className={`vista-previa ${className}`} tabIndex={enfocable ? 0 : undefined}>
        <Eye size={12} strokeWidth={2.2} aria-hidden="true" />
        {texto}
      </span>
    </Tooltip>
  );
}

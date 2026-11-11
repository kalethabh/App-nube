import { Calculator } from 'lucide-react';
import { Tooltip } from './Tooltip.jsx';
import './Estimado.css';

const EXPLICACION = 'Calculado con las piezas de este anuncio y los precios de kie: el registro de gastos no guardó todas las tandas.';

/**
 * La marca "Estimado" junto a un costo que no sale del registro completo, en el informe de costo real de la entrega
 * (cuando el anuncio ya está hecho). El costo estimado ANTES de producir es otra cosa (pantallas/nuevo/CostoEstimado.jsx)
 * y no lleva esta marca.
 *   {dinero(c.dolares)} {c.estimado ? <Estimado /> : null}
 */
export function Estimado({ texto = 'Estimado', explicacion = EXPLICACION, enfocable = true, className = '' }) {
  return (
    <Tooltip texto={explicacion} lado="abajo">
      <span className={`estimado ${className}`} tabIndex={enfocable ? 0 : undefined}>
        <Calculator size={11} strokeWidth={2.2} aria-hidden="true" />
        {texto}
      </span>
    </Tooltip>
  );
}

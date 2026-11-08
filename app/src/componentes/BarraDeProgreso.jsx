import './BarraDeProgreso.css';

/**
 * Barra de progreso.
 *   <BarraDeProgreso valor={42} />                               (0 a 100)
 *   <BarraDeProgreso valor={42} tono="cian" animada etiqueta="Clips" mostrarValor />
 *   <BarraDeProgreso indeterminada tono="cian" />                (no se sabe cuánto falta)
 *
 * tono: acento | cian (generando) | ok | aviso | error | marca
 * grosor: fina (3) | normal (6) | gruesa (10)
 * animada: destello que recorre el relleno (algo se está generando ahora)
 */
export function BarraDeProgreso({
  valor = 0,
  tono = 'acento',
  grosor = 'normal',
  animada = false,
  indeterminada = false,
  etiqueta,
  mostrarValor = false,
  detalle,
  className = '',
}) {
  const v = Math.max(0, Math.min(100, Number(valor) || 0));
  return (
    <div className={`progreso progreso--${tono} progreso--${grosor}${animada ? ' progreso--animada' : ''}${indeterminada ? ' progreso--indeterminada' : ''} ${className}`}>
      {etiqueta || mostrarValor || detalle ? (
        <div className="progreso__cabecera">
          {etiqueta ? <span className="progreso__etiqueta">{etiqueta}</span> : <span />}
          <span className="progreso__valor t-num">
            {detalle}
            {mostrarValor && !indeterminada ? `${Math.round(v)} %` : null}
          </span>
        </div>
      ) : null}
      <div
        className="progreso__pista"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminada ? undefined : Math.round(v)}
        aria-label={typeof etiqueta === 'string' ? etiqueta : 'Progreso'}
      >
        <div className="progreso__relleno" style={indeterminada ? undefined : { width: `${v}%` }} />
      </div>
    </div>
  );
}

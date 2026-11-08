import './Tarjeta.css';

/**
 * Superficie base de la app.
 *
 *   <Tarjeta>…</Tarjeta>
 *   <Tarjeta variante="elevada" relleno="compacto" interactiva onClick={…}>…</Tarjeta>
 *   <Tarjeta variante="destacada">  (borde con el degradado de la marca: lo importante de la pantalla)
 *
 * variante: normal | elevada | vidrio | contorno | destacada
 * relleno:  normal (24) | compacto (16) | amplio (32) | ninguno
 * interactiva: sube y se ilumina al pasar el mouse · seleccionada: borde azul
 */
export function Tarjeta({
  as: Etiqueta = 'div',
  variante = 'normal',
  relleno = 'normal',
  interactiva = false,
  seleccionada = false,
  className = '',
  children,
  ...resto
}) {
  const clases = [
    'tarjeta',
    `tarjeta--${variante}`,
    `tarjeta--relleno-${relleno}`,
    interactiva && 'tarjeta--interactiva',
    seleccionada && 'tarjeta--seleccionada',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Etiqueta className={clases} {...resto}>
      {children}
    </Etiqueta>
  );
}

/** Cabecera de tarjeta: icono en cuadrito + título + subtítulo + acciones a la derecha. */
export function TarjetaCabecera({ icono: Icono, tono = 'acento', titulo, subtitulo, acciones, className = '' }) {
  return (
    <div className={`tarjeta__cabecera ${className}`}>
      {Icono ? (
        <span className={`tarjeta__icono tarjeta__icono--${tono}`} aria-hidden="true">
          <Icono size={18} strokeWidth={2} />
        </span>
      ) : null}
      <div className="tarjeta__textos">
        {titulo ? <h3 className="tarjeta__titulo">{titulo}</h3> : null}
        {subtitulo ? <p className="tarjeta__subtitulo">{subtitulo}</p> : null}
      </div>
      {acciones ? <div className="tarjeta__acciones">{acciones}</div> : null}
    </div>
  );
}

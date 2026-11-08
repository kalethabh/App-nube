import './Esqueleto.css';

/**
 * Lugar reservado mientras algo carga (nunca un spinner solo en medio de la pantalla).
 *   <Esqueleto forma="texto" ancho="60%" />
 *   <Esqueleto forma="texto" lineas={3} />
 *   <Esqueleto forma="miniatura" />          (9:16, como MiniaturaVideo)
 *   <Esqueleto forma="circulo" ancho={32} />
 *   <Esqueleto alto={120} />                 (rectángulo)
 */
export function Esqueleto({ forma = 'rect', ancho, alto, lineas = 1, className = '', style }) {
  if (forma === 'texto' && lineas > 1) {
    return (
      <span className={`esqueleto-lineas ${className}`} style={style} aria-hidden="true">
        {Array.from({ length: lineas }, (_, i) => (
          <span key={i} className="esqueleto esqueleto--texto" style={{ width: i === lineas - 1 ? '62%' : '100%' }} />
        ))}
      </span>
    );
  }
  const s = {
    width: typeof ancho === 'number' ? `${ancho}px` : ancho,
    height: typeof alto === 'number' ? `${alto}px` : alto,
    ...(forma === 'circulo' && ancho ? { height: typeof ancho === 'number' ? `${ancho}px` : ancho } : {}),
    ...style,
  };
  return <span className={`esqueleto esqueleto--${forma} ${className}`} style={s} aria-hidden="true" />;
}

/** Una rejilla de miniaturas de carga, con su título y subtítulo. */
export function EsqueletoMiniaturas({ cantidad = 6, min = 188 }) {
  return (
    <div className="rejilla-videos" style={{ '--min': `${min}px` }} aria-busy="true" aria-label="Cargando">
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i} className="pila" style={{ '--hueco': '10px' }}>
          <Esqueleto forma="miniatura" />
          <Esqueleto forma="texto" ancho="78%" />
          <Esqueleto forma="texto" ancho="46%" alto={10} />
        </div>
      ))}
    </div>
  );
}

import { useLayoutEffect, useRef, useState } from 'react';
import './Pestanas.css';

/**
 * Pestañas.
 *   <Pestanas
 *     items={[{ id: 'medios', etiqueta: 'Medios', icono: Film, contador: 12 }, …]}
 *     activa={pestana}
 *     onCambio={setPestana}
 *     variante="subrayado" />          (subrayado: secciones de una pantalla · segmentado: interruptor de vista)
 * Con el teclado: flechas izquierda/derecha.
 */
export function Pestanas({ items, activa, onCambio, variante = 'subrayado', tamano = 'normal', etiqueta = 'Secciones', className = '' }) {
  const contenedor = useRef(null);
  const [indicador, setIndicador] = useState(null);

  useLayoutEffect(() => {
    const medir = () => {
      const el = contenedor.current?.querySelector('[aria-selected="true"]');
      if (!el) return setIndicador(null);
      setIndicador({ left: el.offsetLeft, width: el.offsetWidth });
    };
    medir();
    const ro = new ResizeObserver(medir);
    if (contenedor.current) ro.observe(contenedor.current);
    return () => ro.disconnect();
  }, [activa, items]);

  const alTeclado = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const habilitados = items.filter((i) => !i.deshabilitada);
    const i = habilitados.findIndex((x) => x.id === activa);
    const siguiente = habilitados[(i + (e.key === 'ArrowRight' ? 1 : -1) + habilitados.length) % habilitados.length];
    if (siguiente) {
      onCambio?.(siguiente.id);
      requestAnimationFrame(() => contenedor.current?.querySelector('[aria-selected="true"]')?.focus());
    }
  };

  return (
    <div
      ref={contenedor}
      role="tablist"
      aria-label={etiqueta}
      className={`pestanas pestanas--${variante} pestanas--${tamano} ${className}`}
      onKeyDown={alTeclado}
    >
      {indicador ? <span className="pestanas__indicador" style={{ left: indicador.left, width: indicador.width }} aria-hidden="true" /> : null}
      {items.map(({ id, etiqueta: texto, icono: Icono, contador, deshabilitada }) => {
        const sel = id === activa;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={sel}
            tabIndex={sel ? 0 : -1}
            disabled={deshabilitada}
            className="pestana"
            onClick={() => onCambio?.(id)}
          >
            {Icono ? <Icono size={16} strokeWidth={2} aria-hidden="true" /> : null}
            <span>{texto}</span>
            {contador !== undefined && contador !== null ? <span className="pestana__contador t-num">{contador}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

// La galería de estilos de subtítulos: cada estilo con su muestra animada, hecha con palabras y
// tiempos reales de este anuncio sobre una toma real. Tocar uno lo pone en la vista previa al instante.
import { useEffect, useRef, useState } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import { Boton } from '../../componentes/index.js';
import { ESTILOS_SUBTITULOS, Subtitulos, colorDeEstilo } from './subtitulos/estilos.jsx';
import { useAhora, useAncho, useVisible } from './piezas.jsx';

// Cada muestra es un ACERCAMIENTO a la franja del subtítulo (1,6 veces): el cuadro muestra el centro del
// video y la letra sale con el tamaño que tiene en el video, así se nota la diferencia entre estilos.
const ZOOM = 1.6;
const ANCHO_ZOOM = Math.round(720 / ZOOM);
const ALTO_ZOOM = Math.round(1280 / ZOOM);

export function MuestraEstilo({ estilo, muestra, colorAnuncio, colorElegido, tamano, alturaBase, marcas, seleccionado, onElegir, compacta = false, recomendado }) {
  const marco = useRef(null);
  const ancho = useAncho(marco);
  const visible = useVisible(marco);
  const ahora = useAhora(visible);
  const largo = Math.max(0.5, muestra.hasta - muestra.desde);
  const t = muestra.desde + ((ahora / 1000) % largo);
  const color = colorDeEstilo(estilo.id, colorElegido, colorAnuncio);
  return (
    <button
      type="button"
      className={`ed-muestra${seleccionado ? ' es-sel' : ''}${compacta ? ' ed-muestra--compacta' : ''}`}
      onClick={() => onElegir(estilo.id)}
      aria-pressed={seleccionado}
      aria-label={`Estilo ${estilo.nombre}: ${estilo.descripcion}`}
      data-estilo={estilo.id}
    >
      <span className="ed-muestra__marco" ref={marco}>
        {muestra.fondo ? (
          <img className="ed-muestra__fondo" src={muestra.fondo} alt="" draggable="false" style={{ '--zoom': ZOOM, transformOrigin: `50% ${(1 - alturaBase) * 100}%` }} />
        ) : null}
        <span className="ed-muestra__velo" aria-hidden="true" />
        {ancho > 0 ? (
          <span className="ed-muestra__lienzo" style={{ width: ANCHO_ZOOM, height: ALTO_ZOOM, transform: `scale(${ancho / ANCHO_ZOOM})` }} aria-hidden="true">
            <Subtitulos t={t} bloques={muestra.bloques} estilo={estilo.id} color={color} tamano={tamano} altura={alturaBase} alturaBase={alturaBase} marcas={marcas} ancho={ANCHO_ZOOM} alto={ALTO_ZOOM} anchoFuente={720} />
          </span>
        ) : null}
        {seleccionado ? (
          <span className="ed-muestra__uso">
            <Check size={11} strokeWidth={3} aria-hidden="true" />
            En uso
          </span>
        ) : estilo.id === 'caja' ? (
          <span className="ed-muestra__defecto">El de siempre</span>
        ) : null}
        {recomendado === estilo.id ? (
          <span className="ed-muestra__ideal">
            <Sparkles size={10} strokeWidth={2.6} aria-hidden="true" />
            Ideal aquí
          </span>
        ) : null}
      </span>
      <span className="ed-muestra__pie">
        <span className="ed-muestra__nombre">{estilo.nombre}</span>
        {compacta ? null : <span className="ed-muestra__desc">{estilo.descripcion}</span>}
      </span>
    </button>
  );
}

export function RejillaEstilos({ compacta, actual, onElegir, ...resto }) {
  return (
    <div className={`ed-rejilla-estilos${compacta ? ' ed-rejilla-estilos--compacta' : ''}`}>
      {ESTILOS_SUBTITULOS.map((e) => (
        <MuestraEstilo key={e.id} estilo={e} seleccionado={actual === e.id} onElegir={onElegir} compacta={compacta} {...resto} />
      ))}
    </div>
  );
}

/** El cajón que sale por la derecha: la vista previa grande queda a la vista mientras eliges. */
export function GaleriaSubtitulos({ abierta, onCerrar, actual, onElegir, muestra, ...resto }) {
  const [montada, setMontada] = useState(abierta);
  const ref = useRef(null);

  useEffect(() => {
    if (abierta) {
      setMontada(true);
      return undefined;
    }
    const id = setTimeout(() => setMontada(false), 240);
    return () => clearTimeout(id);
  }, [abierta]);

  useEffect(() => {
    if (!abierta) return undefined;
    const enfocar = requestAnimationFrame(() => ref.current?.querySelector('.ed-muestra.es-sel, .ed-muestra')?.focus());
    const alTeclado = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCerrar();
      }
    };
    document.addEventListener('keydown', alTeclado);
    return () => {
      cancelAnimationFrame(enfocar);
      document.removeEventListener('keydown', alTeclado);
    };
  }, [abierta, onCerrar]);

  if (!montada || !muestra) return null;
  return (
    <aside ref={ref} className={`ed-galeria${abierta ? ' es-abierta' : ' es-saliendo'}`} role="dialog" aria-modal="false" aria-label="Estilos de subtítulos">
      <header className="ed-galeria__cabecera">
        <span className="ed-galeria__icono" aria-hidden="true">
          <Sparkles size={18} strokeWidth={2} />
        </span>
        <div className="ed-galeria__textos">
          <h2 className="ed-galeria__titulo">Estilos de subtítulos</h2>
          <p className="ed-galeria__bajada">Toca uno y míralo en tu video. Ninguno mueve los tiempos de las palabras.</p>
        </div>
        <Boton variante="fantasma" tamano="chico" soloIcono icono={X} etiqueta="Cerrar la galería" onClick={onCerrar} />
      </header>
      <div className="ed-galeria__cuerpo">
        <RejillaEstilos actual={actual} onElegir={onElegir} muestra={muestra} {...resto} />
      </div>
      <footer className="ed-galeria__pie">
        El sistema entrega siempre <strong>Caja</strong>. Los demás son opciones tuyas: cambias cuando quieras.
      </footer>
    </aside>
  );
}

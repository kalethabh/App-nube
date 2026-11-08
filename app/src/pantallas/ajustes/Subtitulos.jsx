// Galería de estilos de subtítulos (Preferencias). Usa el MISMO dibujo que la galería del editor
// (src/pantallas/editor/subtitulos/estilos.jsx): cada muestra es un acercamiento a la franja del
// subtítulo, con la letra al tamaño que tiene en el video, y se mueve sola mientras se ve.
// La frase es neutra (no sale de ningún anuncio) y va en el idioma de tus anuncios. De fondo, un cuadro
// de tu anuncio más reciente; si todavía no tienes ninguno, una escena oscura de la app.
import { useEffect, useMemo, useRef } from 'react';
import { Check } from 'lucide-react';
import { miniatura } from '../../datos/api.js';
import { ESTILOS_SUBTITULOS as ESTILOS_EDITOR, Subtitulos, colorDeEstilo } from '../editor/subtitulos/estilos.jsx';
import { cargarFuentesSubtitulos } from '../editor/subtitulos/fuentes.js';
import { useAhora, useAncho, useVisible } from '../editor/piezas.jsx';

/** Los 10 estilos, con los mismos ids que el editor (los guarda /api/ajustes/preferencias). */
export const ESTILOS_SUBTITULOS = ESTILOS_EDITOR.map((e) => ({ id: e.id, nombre: e.nombre, lema: e.lema, como: e.descripcion, deSiempre: e.id === 'caja' }));

// Acercamiento a la franja del subtítulo, como en el editor (allí 1,6; aquí las tarjetas son más chicas).
const ZOOM = 1.8;
const ANCHO_ZOOM = Math.round(720 / ZOOM);
const ALTO_ZOOM = Math.round(1280 / ZOOM);
const ALTURA = 0.26; // desde abajo, la de los anuncios del sistema
const COLOR = '#E8442A'; // el resaltado de siempre cuando el anuncio no trae el suyo
// El acercamiento del fondo se centra un poco más arriba que la franja del subtítulo: así en un
// anuncio con una persona se ve su cara y la letra cae sobre el pecho, como en un video de verdad.
const ORIGEN_FONDO = '50% 40%';

// Tres bloques cortos por idioma (ninguna palabra larga: entran en la tarjeta aun con "Una palabra gigante").
// `clave` = la palabra que resalta "Palabras clave + emoji", con su emoji.
const FRASES = {
  es: [{ p: ['Así', 'se', 'ven'] }, { p: ['tus', 'videos'], clave: 1, emoji: '🎬' }, { p: ['con', 'este', 'estilo'], clave: 2, emoji: '✨' }],
  en: [{ p: ['This', 'is', 'how'] }, { p: ['your', 'videos'], clave: 1, emoji: '🎬' }, { p: ['will', 'look'], clave: 1, emoji: '✨' }],
  pt: [{ p: ['Assim', 'ficam'] }, { p: ['seus', 'vídeos'], clave: 1, emoji: '🎬' }, { p: ['com', 'este', 'estilo'], clave: 2, emoji: '✨' }],
};

/** Bloques con tiempos por palabra (como los de ElevenLabs) y las marcas del estilo "claves". */
function armarMuestra(idioma) {
  const frase = FRASES[idioma] || FRASES.es;
  let t = 0.08;
  const bloques = frase.map((b, id) => {
    const inicio = t;
    const palabras = b.p.map((texto) => {
      const largo = 0.2 + 0.034 * [...texto].length;
      const p = { texto, inicio: t, fin: t + largo };
      t += largo + 0.03;
      return p;
    });
    t += 0.2;
    return { id, inicio, fin: t, texto: b.p.join(' '), palabras };
  });
  bloques[bloques.length - 1].fin = t + 0.45;
  const marcas = frase.map((b) => ({
    claves: b.p.map((_, j) => j === b.clave),
    emoji: b.emoji ? { indice: b.clave, caracter: b.emoji } : null,
  }));
  return { bloques, marcas, desde: 0, hasta: bloques[bloques.length - 1].fin + 0.35 };
}

const reducirMovimiento = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function MuestraSubtitulo({ estilo, muestra, fondo, seleccionado, onElegir }) {
  const marco = useRef(null);
  const ancho = useAncho(marco);
  const visible = useVisible(marco);
  const quieto = useMemo(reducirMovimiento, []);
  const ahora = useAhora(visible && !quieto);
  const largo = Math.max(0.5, muestra.hasta - muestra.desde);
  // con "reducir movimiento" queda quieta en una palabra resaltada del segundo bloque
  const t = quieto ? muestra.bloques[1].palabras[1].inicio + 0.05 : muestra.desde + ((ahora / 1000) % largo);
  const color = colorDeEstilo(estilo.id, null, COLOR);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={seleccionado}
      onClick={() => onElegir?.(estilo.id)}
      className={`muestra-sub${seleccionado ? ' muestra-sub--elegida' : ''}`}
      aria-label={`${estilo.nombre}: ${estilo.como}`}
      title={estilo.como}
    >
      <span className={`muestra-sub__marco${fondo ? '' : ' muestra-sub__marco--escena'}`} ref={marco}>
        {fondo ? <img className="muestra-sub__fondo" src={fondo} alt="" loading="lazy" draggable="false" style={{ '--zoom': ZOOM, transformOrigin: ORIGEN_FONDO }} /> : null}
        <span className="muestra-sub__velo" aria-hidden="true" />
        {ancho > 0 ? (
          <span className="muestra-sub__lienzo" style={{ width: ANCHO_ZOOM, height: ALTO_ZOOM, transform: `scale(${ancho / ANCHO_ZOOM})` }} aria-hidden="true">
            <Subtitulos t={t} bloques={muestra.bloques} estilo={estilo.id} color={color} altura={ALTURA} alturaBase={ALTURA} marcas={muestra.marcas} ancho={ANCHO_ZOOM} alto={ALTO_ZOOM} anchoFuente={720} />
          </span>
        ) : null}
        {seleccionado ? (
          <span className="muestra-sub__elegido">
            <Check size={11} strokeWidth={3} aria-hidden="true" />
            Elegido
          </span>
        ) : null}
      </span>
      <span className="muestra-sub__textos">
        <span className="muestra-sub__nombre">{estilo.nombre}</span>
        <span className="muestra-sub__lema">{estilo.lema}</span>
      </span>
    </button>
  );
}

/**
 * <GaleriaSubtitulos elegido="caja" idioma="es" fondo={urlDeUnCuadro} onElegir={(id) => …} />
 * `fondo` es opcional: sin él, cada muestra va sobre una escena oscura.
 */
export function GaleriaSubtitulos({ elegido, idioma = 'es', fondo, onElegir }) {
  useEffect(() => {
    cargarFuentesSubtitulos();
  }, []);
  const muestra = useMemo(() => armarMuestra(idioma), [idioma]);
  const imagen = fondo ? miniatura(fondo, 480) : null;
  return (
    <div className="galeria-subs" role="radiogroup" aria-label="Estilo de subtítulos por defecto">
      {ESTILOS_SUBTITULOS.map((s) => (
        <MuestraSubtitulo key={s.id} estilo={s} muestra={muestra} fondo={imagen} seleccionado={elegido ? s.id === elegido : s.deSiempre} onElegir={onElegir} />
      ))}
    </div>
  );
}

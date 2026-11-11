// Dónde va el logo: una rejilla de 3 × 2 (arriba / abajo · izquierda, centro, derecha) y una vista previa chica
// del cuadrado y del vertical. En el vertical el logo va más adentro, dentro de la zona que Instagram y TikTok no
// tapan (la misma geometría que pega el servidor: lugarDelLogo de src/datos/imagenes.js).
import { useRef } from 'react';
import { POSICIONES_LOGO, POSICION_POR_DEFECTO, lugarDelLogo } from '../../datos/imagenes.js';

const ORDEN = ['arriba-izquierda', 'arriba-centro', 'arriba-derecha', 'abajo-izquierda', 'abajo-centro', 'abajo-derecha'];

function Lienzo({ formato, posicion, logoUrl }) {
  const l = lugarDelLogo(posicion, formato);
  return (
    <span className={`img-pos__lienzo img-pos__lienzo--${formato === '9:16' ? 'vertical' : 'cuadrado'}`}>
      {formato === '9:16' ? <span className="img-pos__segura" aria-hidden="true" /> : null}
      <span className="img-pos__logo" style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.ancho}%`, height: `${l.alto}%` }}>
        {logoUrl ? <img src={logoUrl} alt="" draggable="false" /> : null}
      </span>
      <span className="img-pos__formato">{formato}</span>
    </span>
  );
}

export function PosicionLogo({ valor = POSICION_POR_DEFECTO, onCambiar, posiciones, deshabilitada = false, logoUrl, conVertical = true }) {
  const lista = ORDEN.map((id) => (posiciones || []).find((p) => p.id === id) || POSICIONES_LOGO.find((p) => p.id === id));
  const actual = lista.find((p) => p.id === valor) || lista[1];
  const grupo = useRef(null);

  // flechas: como un grupo de opciones (izquierda/derecha en la fila, arriba/abajo entre filas)
  const alTeclado = (e) => {
    const i = ORDEN.indexOf(actual.id);
    const mover = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 }[e.key];
    if (mover === undefined) return;
    e.preventDefault();
    const j = (i + mover + ORDEN.length) % ORDEN.length;
    onCambiar(ORDEN[j]);
    requestAnimationFrame(() => grupo.current?.querySelector('[aria-checked="true"]')?.focus());
  };

  return (
    <div className={`img-pos${deshabilitada ? ' img-pos--apagada' : ''}`}>
      <div className="img-pos__elegir">
        <div ref={grupo} className="img-pos__rejilla" role="radiogroup" aria-label="Posición del logo" aria-disabled={deshabilitada || undefined} onKeyDown={alTeclado}>
          {lista.map((p) => {
            const sel = p.id === actual.id;
            const [fila, col] = p.id.split('-');
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={sel}
                aria-label={p.nombre}
                title={p.nombre}
                tabIndex={sel ? 0 : -1}
                disabled={deshabilitada}
                className={`img-pos__opcion${sel ? ' img-pos__opcion--sel' : ''}`}
                onClick={() => onCambiar(p.id)}
              >
                <span className={`img-pos__marca img-pos__marca--${fila} img-pos__marca--${col}`} aria-hidden="true" />
              </button>
            );
          })}
        </div>
        <span className="img-pos__nombre">{deshabilitada ? 'Sube tu logo para elegir dónde va' : actual.nombre}</span>
      </div>
      <div className="img-pos__vistas" aria-hidden="true">
        <Lienzo formato="1:1" posicion={actual.id} logoUrl={deshabilitada ? null : logoUrl} />
        {conVertical ? <Lienzo formato="9:16" posicion={actual.id} logoUrl={deshabilitada ? null : logoUrl} /> : null}
      </div>
    </div>
  );
}

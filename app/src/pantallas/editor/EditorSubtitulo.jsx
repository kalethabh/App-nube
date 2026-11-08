// El globo para corregir un subtítulo (doble clic en un bloque de la línea de tiempo).
// Mientras se escribe, la vista previa ya muestra el texto nuevo. Enter guarda, Escape deshace.
import { useEffect, useRef, useState } from 'react';
import { EyeOff, PencilLine } from 'lucide-react';
import { Boton } from '../../componentes/index.js';
import { codigoDeTiempo } from '../../datos/formato.js';
import { Globo } from './piezas.jsx';

export function EditorSubtitulo({ bloque, ancla, onBorrador, onGuardar, onCancelar, onOcultar }) {
  const [texto, setTexto] = useState(bloque?.texto || '');
  const entrada = useRef(null);

  useEffect(() => {
    setTexto(bloque?.texto || '');
    const id = requestAnimationFrame(() => {
      entrada.current?.focus();
      entrada.current?.select();
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloque?.id]);

  if (!bloque) return null;
  const cambio = texto.trim() !== String(bloque.original).trim();

  return (
    <Globo abierto ancla={ancla} onCerrar={onCancelar} lado="arriba" ancho={364} etiqueta={`Corregir el subtítulo ${bloque.id + 1}`} className="ed-corregir">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onGuardar(texto.trim());
        }}
      >
        <div className="ed-corregir__cabeza">
          <span className="ed-corregir__icono" aria-hidden="true">
            <PencilLine size={14} strokeWidth={2.2} />
          </span>
          <span className="ed-corregir__titulo">Corregir subtítulo</span>
          <span className="ed-corregir__tiempo t-mono">{codigoDeTiempo(bloque.inicio)}</span>
        </div>
        <input
          ref={entrada}
          className="ed-corregir__entrada"
          value={texto}
          spellCheck
          aria-label="Texto del subtítulo"
          onChange={(e) => {
            setTexto(e.target.value);
            onBorrador(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              onCancelar();
            }
          }}
        />
        <p className="ed-corregir__ayuda">
          {cambio ? (
            <>
              Decía: <q>{bloque.original}</q>
            </>
          ) : (
            'Ya lo ves en el video mientras escribes. Los tiempos no se mueven.'
          )}
        </p>
        <div className="ed-corregir__pie">
          <Boton variante="fantasma" tamano="chico" icono={EyeOff} onClick={onOcultar}>
            Ocultar
          </Boton>
          <span className="ed-corregir__teclas t-mini">
            <kbd>Enter</kbd> guarda · <kbd>Esc</kbd> sale
          </span>
          <Boton variante="primario" tamano="chico" type="submit">
            Guardar
          </Boton>
        </div>
      </form>
    </Globo>
  );
}

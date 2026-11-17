// Debajo de la miniatura de un anuncio (Editor y Anuncios): «Me funciona» (el trofeo, para hacer variantes
// ganadoras) y Eliminar (pregunta antes; no se borra nada: va a temp/_descartados/ y se puede recuperar).
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Boton } from './Boton.jsx';
import { Modal } from './Modal.jsx';
import { Tooltip } from './Tooltip.jsx';
import { useAvisos } from './Avisos.jsx';
import { BotonFunciona } from './BotonFunciona.jsx';
import { invalidar, pedirNuevo } from '../datos/api.js';

/** `funciona`: muestra el trofeo (solo con video terminado). `onEliminado`: tras eliminarlo. */
export function AccionesAnuncio({ slug, titulo, funciona = true, onEliminado }) {
  const { aviso } = useAvisos();
  const [preguntando, setPreguntando] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const eliminar = async () => {
    setEliminando(true);
    try {
      await pedirNuevo(`/api/anuncios/${encodeURIComponent(slug)}/eliminar`, { metodo: 'POST' });
      setPreguntando(false);
      invalidar('anuncios');
      aviso({ tipo: 'ok', titulo: 'Anuncio eliminado', texto: `«${titulo}» ya no está en la app.` });
      onEliminado?.(slug);
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude eliminarlo', texto: e?.message || 'Vuelve a intentarlo.' });
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="acciones-anuncio">
      {funciona ? <BotonFunciona tipo="video" slug={slug} /> : null}
      <Tooltip texto="Eliminar">
        <Boton variante="fantasma" tamano="chico" soloIcono icono={Trash2} etiqueta={`Eliminar ${titulo}`} onClick={() => setPreguntando(true)} />
      </Tooltip>
      <Modal
        abierto={preguntando}
        onCerrar={() => !eliminando && setPreguntando(false)}
        titulo="¿Eliminar este anuncio?"
        descripcion={`«${titulo}» se quita de la app con sus videos. No se pierde: queda guardado aparte por si lo necesitas recuperar.`}
        icono={Trash2}
        tono="error"
        tamano="chico"
        pie={
          <>
            <Boton variante="fantasma" onClick={() => setPreguntando(false)} disabled={eliminando}>
              Cancelar
            </Boton>
            <Boton variante="peligro" icono={Trash2} onClick={eliminar} cargando={eliminando}>
              Eliminar
            </Boton>
          </>
        }
      />
    </div>
  );
}

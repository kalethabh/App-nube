// «Botón de Chrome»: el código de emparejamiento (para pegarlo en la extensión), bajar la extensión y los 4 pasos
// para instalarla. La extensión vive en extension-chrome/ y la app la entrega en un zip armado al momento.
import { useEffect, useState } from 'react';
import { Copy, Download, Puzzle, RefreshCw } from 'lucide-react';
import { Boton, Modal, useAvisos } from '../../componentes/index.js';
import { inspiracion } from './datos.js';

export function BotonChrome({ abierto, onCerrar }) {
  const { aviso } = useAvisos();
  const [codigo, setCodigo] = useState(null);
  const [error, setError] = useState(null);
  const [cambiando, setCambiando] = useState(false);

  useEffect(() => {
    if (!abierto || codigo) return;
    inspiracion
      .codigoChrome()
      .then((r) => setCodigo(r.codigo))
      .catch((e) => setError(e.message));
  }, [abierto, codigo]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      aviso({ tipo: 'ok', titulo: 'Código copiado', texto: 'Pégalo en las Opciones de la extensión.' });
    } catch {
      aviso({ tipo: 'aviso', titulo: 'No pude copiarlo', texto: 'Selecciónalo y cópialo a mano.' });
    }
  };
  const cambiar = async () => {
    setCambiando(true);
    try {
      setCodigo((await inspiracion.nuevoCodigoChrome()).codigo);
      aviso({ tipo: 'ok', titulo: 'Código nuevo', texto: 'El anterior ya no sirve: pega este en la extensión.' });
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No se pudo', texto: e.message });
    } finally {
      setCambiando(false);
    }
  };

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      icono={Puzzle}
      titulo="Botón de Chrome «Guardar en Kads»"
      descripcion="Guarda en un clic los anuncios que ves en la Biblioteca de anuncios de Meta, también los que solo corren en Latinoamérica."
      className="insp-chrome"
      pie={
        <Boton variante="primario" icono={Download} href="/api/inspiracion/chrome/extension.zip" download>
          Descargar la extensión
        </Boton>
      }
    >
      <div className="insp-chrome__codigo">
        <span className="insp-chrome__etiqueta">Tu código de emparejamiento</span>
        <div className="insp-chrome__fila">
          <code className="t-mono" data-codigo>{codigo || (error ? '—' : 'Cargando…')}</code>
          <Boton variante="secundario" tamano="chico" icono={Copy} onClick={copiar} disabled={!codigo}>
            Copiar
          </Boton>
          <Boton variante="fantasma" tamano="chico" soloIcono icono={RefreshCw} etiqueta="Hacer un código nuevo (el anterior deja de servir)" onClick={cambiar} cargando={cambiando} disabled={!codigo} />
        </div>
        {error ? <p className="insp__error">{error}</p> : null}
        <p className="insp-chrome__nota">Solo con este código la extensión puede guardar en tu app. No lo compartas.</p>
      </div>
      <ol className="insp-chrome__pasos">
        <li>
          Toca <strong>Descargar la extensión</strong> y descomprime el zip (queda la carpeta «kads-guardar-en-chrome»).
        </li>
        <li>
          En Chrome abre <code className="t-mono">chrome://extensions</code> y prende el <strong>Modo de desarrollador</strong> (arriba a la derecha).
        </li>
        <li>
          Toca <strong>Cargar descomprimida</strong> y elige la carpeta «kads-guardar-en-chrome».
        </li>
        <li>
          Se abren sus <strong>Opciones</strong> (o tócala en la barra de Chrome): pega tu código, toca Guardar y luego Probar conexión.
        </li>
      </ol>
      <p className="insp-chrome__nota">
        Después abre la Biblioteca de anuncios de Meta: cada anuncio tendrá el botón verde <strong>Guardar en Kads</strong>. Solo se guarda el que tocas
        (con su video o su imagen) y aparece aquí en «Desde Chrome». Kads tiene que estar abierta.
      </p>
    </Modal>
  );
}

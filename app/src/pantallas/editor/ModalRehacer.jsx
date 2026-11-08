// "Rehacer con IA": lo único del editor que vuelve a generar algo (y por eso cuesta). El usuario dice con sus
// palabras qué quiere cambiar; Claude escribe los prompts nuevos (sin poder correr nada que cobre), la app los
// aplica, vuelve a generar esa pieza y vuelve a armar el anuncio. Sin precios: el costo real se ve en el informe
// de la entrega. Antes del "Sí" se dice qué va a pasar.
import { useEffect, useState } from 'react';
import { Clock, Film, History, ImageIcon, TriangleAlert, WandSparkles } from 'lucide-react';
import { AreaTexto, Boton, Interruptor, Modal, Selector, Tarjeta } from '../../componentes/index.js';
import { duracion as formatoDuracion } from '../../datos/formato.js';

export function ModalRehacer({ abierto, onCerrar, objetivo, pistas, reh, alPedir }) {
  const opciones = [...pistas.video, ...pistas.broll].filter((o) => o.pieza && reh.piezas[o.pieza] && o.clip);
  const [id, setId] = useState(null);
  const [conImagen, setConImagen] = useState(false);
  const [pedido, setPedido] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!abierto) return;
    const elegido = opciones.find((o) => o.id === objetivo?.id) || opciones.find((o) => o.pieza === objetivo?.pieza) || opciones[0];
    setId(elegido?.id || null);
    setConImagen(false);
    setPedido('');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, objetivo?.id]);

  const item = opciones.find((o) => o.id === id) || opciones[0];
  if (!item) return null;
  const pieza = reh.piezas[item.pieza];
  const puedeImagen = Boolean(pieza?.imagen);
  const conImg = puedeImagen && conImagen;
  const listo = pedido.trim().length >= 3;

  const confirmar = async () => {
    if (!listo) {
      setError('Cuéntale a la IA qué quieres cambiar.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await alPedir({ pieza: item.pieza, pedido: pedido.trim(), conImagen: conImg }, item);
      onCerrar();
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const queEs = item.tipo === 'broll' ? 'B-roll' : pieza?.tipo === 'R' ? 'bloque' : pieza?.tipo === 'H' ? 'clip' : 'toma';

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      icono={WandSparkles}
      titulo="¿Rehacer este clip con IA?"
      descripcion="Esto vuelve a generar ese clip. La línea del guion, su duración y el resto del anuncio no cambian."
      className="ed-rehacer"
      pie={
        <>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton variante="primario" icono={WandSparkles} onClick={confirmar} cargando={enviando} disabled={!listo} data-autofocus={listo || undefined}>
            Sí, rehacer
          </Boton>
        </>
      }
    >
      <div className="ed-rehacer__cuerpo">
        <div className="ed-rehacer__clip">
          <img className="ed-rehacer__foto" src={item.foto || item.miniatura} alt="" />
          <div className="ed-rehacer__textos">
            <span className="ed-rehacer__nombre">{item.nombre}</span>
            {item.texto ? <q className="ed-elegido__cita">{item.texto}</q> : null}
            <span className="t-mini t-3">
              <Clock size={11} strokeWidth={2.2} aria-hidden="true" /> Dura {formatoDuracion(item.fin - item.inicio)} en el anuncio
            </span>
          </div>
        </div>

        {opciones.length > 1 ? (
          <Selector
            etiqueta="¿Qué clip?"
            value={item.id}
            onChange={(e) => setId(e.target.value)}
            opciones={opciones.map((o) => ({ valor: o.id, etiqueta: `${o.nombre}${o.texto ? ` · ${String(o.texto).slice(0, 42)}${String(o.texto).length > 42 ? '…' : ''}` : ''}` }))}
          />
        ) : null}

        <AreaTexto
          etiqueta="¿Qué quieres cambiar?"
          filas={3}
          value={pedido}
          onChange={(e) => setPedido(e.target.value)}
          placeholder={item.tipo === 'broll' ? 'Ej.: que se vea el frasco abierto y más cerca' : 'Ej.: que mire a cámara al final y que el frasco se vea más grande'}
          data-autofocus={!listo || undefined}
          maxLength={600}
        />

        {puedeImagen ? (
          <Interruptor activado={conImagen} onCambio={setConImagen} etiqueta="Rehacer también su imagen" descripcion="Úsalo si lo que falla es el dibujo (la escena, el personaje, el producto), no el movimiento." />
        ) : null}

        <Tarjeta variante="elevada" relleno="compacto" className="ed-pasara">
          <div className="ed-pasara__cabeza">
            <span className="ed-pasara__etiqueta">Lo que va a pasar</span>
          </div>
          <ul className="ed-pasara__lista">
            <li>
              <span className="ed-pasara__icono ed-pasara__icono--ia" aria-hidden="true">
                <WandSparkles size={14} strokeWidth={2.2} />
              </span>
              <span>
                La IA escribe {queEs === 'toma' || queEs === 'clip' ? 'la escena' : `el ${queEs}`} de nuevo con tu pedido y vuelve a generar <strong>{item.nombre}</strong>
                {conImg ? ' desde una imagen nueva' : puedeImagen ? ' con la misma imagen' : ''}.
              </span>
            </li>
            {conImg ? (
              <li>
                <span className="ed-pasara__icono" aria-hidden="true">
                  <ImageIcon size={14} strokeWidth={2.2} />
                </span>
                <span>Primero hace de nuevo su imagen y de ella sale el clip.</span>
              </li>
            ) : null}
            <li>
              <span className="ed-pasara__icono" aria-hidden="true">
                <Film size={14} strokeWidth={2.2} />
              </span>
              <span>Después vuelve a armar el anuncio con el clip nuevo: montaje, subtítulos y los videos.</span>
            </li>
            <li>
              <span className="ed-pasara__icono" aria-hidden="true">
                <Clock size={14} strokeWidth={2.2} />
              </span>
              <span>Tarda unos minutos. Puedes seguir editando mientras tanto: tus cambios no se pierden.</span>
            </li>
            <li>
              <span className="ed-pasara__icono ed-pasara__icono--ok" aria-hidden="true">
                <History size={14} strokeWidth={2.2} />
              </span>
              <span>La versión anterior queda guardada en la carpeta del anuncio.</span>
            </li>
          </ul>
          {error ? (
            <p className="ed-pasara__saldo" role="alert">
              <TriangleAlert size={14} strokeWidth={2.2} aria-hidden="true" />
              {error}
            </p>
          ) : null}
        </Tarjeta>
      </div>
    </Modal>
  );
}

// «Editar esta imagen» en el panel de una imagen de la producción: escribes UN cambio («quítale el logo», «que
// sonría») y el modelo de imagen cambia solo eso. El botón de IA (arriba a la derecha del campo) mira la imagen y
// te propone el pedido. Antes de cobrar, el costo; si la imagen ya tenía su clip, puedes rehacerlo con la nueva.
// Servidor: server/rutas/editar-imagen.js.
import { useEffect, useState } from 'react';
import { CircleAlert, LoaderCircle, Sparkles, WandSparkles } from 'lucide-react';
import { Boton, Interruptor, Modal, useAvisos } from '../../componentes/index.js';
import { invalidar } from '../../datos/api.js';
import './editar-imagen.css';

const usd = (n) => `US$${(Number(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "/archivos/anuncio/<slug>/img/toma-3-inicial.png?v=1" -> { slug, archivo } */
export function partesDeImagen(url) {
  const m = String(url || '').split('?')[0].match(/^\/archivos\/anuncio\/([^/]+)\/(img\/[^/]+)$/);
  return m ? { slug: decodeURIComponent(m[1]), archivo: decodeURIComponent(m[2]) } : null;
}

async function pedir(url, cuerpo) {
  const r = await fetch(url, cuerpo ? { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(cuerpo) } : { headers: { Accept: 'application/json' } });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.error || 'Algo salió mal. Vuelve a intentarlo.');
  return d;
}

export function EditarImagen({ url, onEditada }) {
  const { aviso } = useAvisos();
  const partes = partesDeImagen(url);
  const [pedido, setPedido] = useState('');
  const [porque, setPorque] = useState(null);
  const [sugiriendo, setSugiriendo] = useState(false);
  const [editando, setEditando] = useState(false);
  const [costo, setCosto] = useState(null);
  const [rehacerClip, setRehacerClip] = useState(true);
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setPedido('');
    setPorque(null);
    setError(null);
    setCosto(null);
    if (!partes) return;
    pedir(`/api/anuncios/${encodeURIComponent(partes.slug)}/imagen/costo?archivo=${encodeURIComponent(partes.archivo)}`)
      .then(setCosto)
      .catch(() => setCosto(null));
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!partes) return null;
  const base = `/api/anuncios/${encodeURIComponent(partes.slug)}/imagen`;
  const conClip = Boolean(costo?.clip?.existe && costo.clip.sePuede && rehacerClip);
  const total = (costo?.imagen?.dolares || 0) + (conClip ? costo.clip.dolares : 0);

  const sugerir = async () => {
    setSugiriendo(true);
    setError(null);
    try {
      const r = await pedir(`${base}/sugerir`, { archivo: partes.archivo });
      setPedido(r.pedido || '');
      setPorque(r.porque || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSugiriendo(false);
    }
  };
  const editar = async () => {
    setConfirmar(false);
    setEditando(true);
    setError(null);
    try {
      const r = await pedir(`${base}/editar`, { archivo: partes.archivo, pedido, rehacerClip: conClip });
      aviso({ tipo: 'ok', titulo: 'Imagen editada', texto: r.clipRehaciendo ? 'Ahora se rehace su clip con la imagen nueva; el anuncio se vuelve a armar solo.' : r.nota || 'Ya se usa la imagen nueva.', duracion: 9000 });
      setPedido('');
      setPorque(null);
      invalidar(`anuncio:${partes.slug}`);
      invalidar(`costo:${partes.slug}`);
      onEditada?.(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setEditando(false);
    }
  };

  return (
    <div className="ei">
      <span className="t-etiqueta">
        <WandSparkles size={12} strokeWidth={2.4} aria-hidden="true" /> Editar esta imagen
      </span>
      <div className="ei__campo">
        <textarea
          className="ei__texto"
          rows={3}
          maxLength={600}
          value={pedido}
          disabled={editando}
          placeholder="Qué cambiar, solo eso. Ej.: que la etiqueta del frasco se lea clara; quítale el logo de la camiseta."
          onChange={(e) => setPedido(e.target.value)}
          aria-label="Qué cambiar en la imagen"
        />
        <button type="button" className="ei__ia" onClick={sugerir} disabled={sugiriendo || editando} title="Que la IA mire la imagen y te proponga qué cambiar" aria-label="Que la IA me proponga qué cambiar">
          {sugiriendo ? <LoaderCircle size={15} className="girando" /> : <Sparkles size={15} strokeWidth={2.2} />}
        </button>
      </div>
      {sugiriendo ? <span className="t-mini">La IA está mirando la imagen…</span> : porque ? <span className="t-mini">La IA vio: {porque}</span> : null}
      {costo?.clip?.existe ? (
        costo.clip.sePuede ? (
          <Interruptor
            tamano="chico"
            activado={rehacerClip}
            onCambio={setRehacerClip}
            deshabilitado={editando}
            etiqueta="Rehacer también su clip con la imagen nueva"
            descripcion={`~${usd(costo.clip.dolares)} (${costo.clip.creditos} créditos). Si no, el clip sigue siendo el de antes.`}
          />
        ) : (
          <span className="t-mini">{costo.clip.motivo}</span>
        )
      ) : null}
      {error ? (
        <span className="ei__error" role="alert">
          <CircleAlert size={13} aria-hidden="true" /> {error}
        </span>
      ) : null}
      <div className="ei__pie">
        <Boton variante="primario" tamano="chico" icono={WandSparkles} disabled={!pedido.trim() || !costo} cargando={editando} onClick={() => setConfirmar(true)}>
          {editando ? 'Editando…' : 'Editar imagen'}
        </Boton>
        {costo ? (
          <span className="t-mini">
            Cuesta ~{usd(total)} ({costo.imagen.creditos + (conClip ? costo.clip.creditos : 0)} créditos de kie.ai)
          </span>
        ) : null}
      </div>
      <Modal
        abierto={confirmar}
        onCerrar={() => setConfirmar(false)}
        icono={WandSparkles}
        tamano="chico"
        titulo="¿Editar la imagen?"
        descripcion={`Se cambia solo esto: «${pedido.trim()}». La imagen de antes queda guardada en el historial.`}
        pie={
          <>
            <Boton variante="fantasma" onClick={() => setConfirmar(false)}>
              Cancelar
            </Boton>
            <Boton variante="primario" icono={WandSparkles} onClick={editar}>
              Sí, editar (~{usd(total)})
            </Boton>
          </>
        }
      >
        <p className="t-chico">
          Imagen: {costo?.imagen?.creditos} créditos{conClip ? ` · su clip: ${costo.clip.creditos} créditos` : ''}. Tarda uno o dos minutos{conClip ? ', más el clip' : ''}.
        </p>
      </Modal>
    </div>
  );
}

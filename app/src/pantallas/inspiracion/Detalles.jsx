// «Detalles» de un anuncio de Inspiración: el video o la imagen en grande, todo el copy, lo que dice (la transcripción
// de TrendTrack), las cifras, la página a la que lleva y los países. Desde aquí también se sigue la marca.
import { Bookmark, BookmarkCheck, Copy, ExternalLink, Info, UserCheck, UserPlus, Wand2 } from 'lucide-react';
import { Boton, Modal } from '../../componentes/index.js';
import { Insignias, Medio } from './Tarjeta.jsx';
import { PAIS, corto, fechaCorta, miles } from './datos.js';

export function Detalles({ a, c, formatos, sonidos, abierto, onCerrar, guardado, onGuardar, onReplicar, replicando, onCopiar, siguiendo, onSeguir, onVerMarca }) {
  if (!a) return null;
  const cifras = [
    ['Personas que lo vieron', a.alcance != null ? miles(a.alcance) : null],
    ['Más en los últimos 7 días', a.alcance7d ? `+${miles(a.alcance7d)}` : null],
    ['Gasto estimado', a.gasto != null ? `${corto(a.gasto)} USD` : null],
    ['Días activo', a.dias != null ? `${a.dias} (desde el ${fechaCorta(a.desde)})` : null],
    ['Copias y variantes', a.duplicados != null ? miles(a.duplicados) : null],
    ['Puesto en su marca', a.puesto ? `Nº${a.puesto}${a.puestoCambio ? ` (${a.puestoCambio > 0 ? 'subió' : 'bajó'} ${Math.abs(a.puestoCambio)})` : ''}` : null],
    ['Anuncios activos de la marca', a.anunciante.activos != null ? miles(a.anunciante.activos) : null],
    ['Botón', a.cta ? a.cta.replace(/_/g, ' ').toLowerCase() : null],
    ['Países', a.paises?.length ? `${a.paises.map((p) => PAIS[p] || p).join(', ')}${a.totalPaises > a.paises.length ? ` y ${a.totalPaises - a.paises.length} más` : ''}` : null],
  ].filter(([, v]) => v);
  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      tamano="grande"
      icono={Info}
      titulo={a.titulo || `Anuncio de ${a.anunciante.nombre}`}
      descripcion={`${a.anunciante.nombre}${a.dominio ? ` · ${a.dominio}` : ''}`}
      className="insp-detalles"
      pie={
        <>
          <Boton variante="fantasma" icono={guardado ? BookmarkCheck : Bookmark} onClick={onGuardar}>
            {guardado ? 'Guardado' : 'Guardar'}
          </Boton>
          {a.copy || a.transcripcion ? (
            <Boton variante="secundario" icono={Copy} onClick={onCopiar}>
              Copiar el texto
            </Boton>
          ) : null}
          <Boton variante="primario" icono={Wand2} onClick={onReplicar} cargando={replicando} disabled={!a.media && !a.miniatura}>
            Replicar
          </Boton>
        </>
      }
    >
      <div className="insp-detalles__rejilla">
        <Medio a={a} grande />
        <div className="insp-detalles__info">
          <Insignias a={a} c={c} formatos={formatos} sonidos={sonidos} />
          <div className="insp-detalles__marca">
            <Boton variante={siguiendo ? 'secundario' : 'fantasma'} tamano="chico" icono={siguiendo ? UserCheck : UserPlus} onClick={onSeguir}>
              {siguiendo ? 'Sigues esta marca' : 'Seguir esta marca'}
            </Boton>
            <Boton variante="fantasma" tamano="chico" onClick={onVerMarca}>
              Ver sus anuncios
            </Boton>
          </div>
          {a.copy ? (
            <section>
              <h4>El texto del anuncio</h4>
              <p className="insp-detalles__texto">{a.copy}</p>
            </section>
          ) : null}
          {a.transcripcion ? (
            <section>
              <h4>Lo que dice</h4>
              <p className="insp-detalles__texto insp-detalles__texto--voz">{a.transcripcion}</p>
            </section>
          ) : null}
          {cifras.length ? (
            <dl className="insp-detalles__cifras">
              {cifras.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {a.landing ? (
            <a className="insp-detalles__landing" href={a.landing} target="_blank" rel="noreferrer noopener">
              <ExternalLink size={13} aria-hidden="true" /> {a.dominio || 'Ver la página'}
            </a>
          ) : null}
          <p className="insp-detalles__nota">
            {c?.formatoFuente === 'ia'
              ? 'El formato lo reconoció tu IA mirando la imagen.'
              : c?.formatoFuente === 'texto'
                ? 'El formato sale de las palabras del anuncio.'
                : 'Todavía no se sabe el formato de este anuncio.'}{' '}
            {c?.sonidoFuente === 'texto' ? 'El sonido sale de la transcripción de TrendTrack.' : ''}
          </p>
        </div>
      </div>
    </Modal>
  );
}

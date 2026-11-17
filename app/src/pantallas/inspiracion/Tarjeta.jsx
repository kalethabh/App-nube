// Una tarjeta del feed de Inspiración (como en Starpop): la marca, cuándo salió y cuántos días lleva, guardar, el video
// (se reproduce ahí mismo) o la imagen, las insignias (puesto, creciendo, variantes, formato, sonido), el título, el
// copy en 2 líneas y «Replicar» / copiar el texto / «Detalles».
// Los de «Meta (oficial)» traen el video recién cuando la tarjeta se ve (MedioPendiente); si Meta no lo deja sacar,
// la tarjeta ofrece «Ver en Meta». Los de «Desde Chrome» se pueden borrar y dicen si están validados.
import { useEffect, useRef, useState } from 'react';
import { Bookmark, BookmarkCheck, Copy, ExternalLink, Film, Image as IconoImagen, Info, Layers, LoaderCircle, Play, ShieldCheck, Sparkles, Trash2, TrendingUp, Trophy, Wand2 } from 'lucide-react';
import { Boton, Tooltip } from '../../componentes/index.js';
import { corto, enlaceMeta, fechaCorta, miles, urlMedia } from './datos.js';

export function Avatar({ nombre, logo, tamano = 32 }) {
  const [falla, setFalla] = useState(false);
  return logo && !falla ? (
    <img className="insp-avatar" src={logo} alt="" width={tamano} height={tamano} loading="lazy" referrerPolicy="no-referrer" onError={() => setFalla(true)} />
  ) : (
    <span className="insp-avatar insp-avatar--letra" style={{ width: tamano, height: tamano }} aria-hidden="true">
      {(nombre || '?').trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** (Meta oficial) el video todavía no se sacó: se pide cuando la tarjeta aparece en pantalla. */
function MedioPendiente({ a, grande, onPedir }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !onPedir) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      onPedir();
      return undefined;
    }
    const io = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          onPedir();
          io.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [a.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={ref} className={`insp-medio insp-medio--cargando${grande ? ' insp-medio--grande' : ''}`}>
      <span className="insp-medio__sin insp-medio__aviso">
        <LoaderCircle size={22} className="girando" aria-hidden="true" />
        Trayendo de Meta…
      </span>
    </div>
  );
}

export function Medio({ a, grande = false, onPedirMedio }) {
  const ref = useRef(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  if (a.medioPendiente) return <MedioPendiente a={a} grande={grande} onPedir={onPedirMedio} />;
  if (a.sinMedio || (a.fuente === 'meta' && !a.media && !a.miniatura)) {
    return (
      <div className={`insp-medio${grande ? ' insp-medio--grande' : ''}`}>
        <span className="insp-medio__sin insp-medio__aviso">
          <Film size={26} aria-hidden="true" />
          No pude traer el video desde Meta.
          {a.metaId ? (
            <a className="insp-medio__enlace" href={enlaceMeta(a.metaId)} target="_blank" rel="noreferrer noopener">
              <ExternalLink size={13} aria-hidden="true" /> Ver en Meta
            </a>
          ) : null}
        </span>
      </div>
    );
  }
  const video = a.tipo === 'video' && a.media;
  const poster = urlMedia(a.miniatura) || undefined;
  if (video) {
    return (
      <div className={`insp-medio${grande ? ' insp-medio--grande' : ''}`}>
        <video
          ref={ref}
          src={urlMedia(a.media)}
          poster={poster}
          controls={reproduciendo}
          playsInline
          preload="none"
          onPlay={() => setReproduciendo(true)}
        />
        {!reproduciendo ? (
          <button
            type="button"
            className="insp-medio__play"
            aria-label={`Reproducir el anuncio de ${a.anunciante.nombre}`}
            onClick={() => {
              setReproduciendo(true);
              ref.current?.play().catch(() => {});
            }}
          >
            <Play size={22} fill="currentColor" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    );
  }
  const img = urlMedia(a.media || a.miniatura);
  return (
    <div className={`insp-medio${grande ? ' insp-medio--grande' : ''}`}>
      {img ? (
        <img src={img} alt={`Anuncio de ${a.anunciante.nombre}`} loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <div className="insp-medio__sin">{a.tipo === 'imagen' ? <IconoImagen size={28} /> : <Film size={28} />}</div>
      )}
    </div>
  );
}

/** Las insignias de un anuncio (también en Detalles). */
export function Insignias({ a, c, formatos, sonidos }) {
  const formato = formatos.find((f) => f.id === c?.formato);
  const sonido = sonidos.find((s) => s.id === c?.sonido);
  return (
    <div className="insp-insignias">
      {a.puesto ? (
        <Tooltip texto="El puesto de este anuncio entre los de su marca (1 = el que más empuja)">
          <span className="insp-ins insp-ins--puesto">
            <Trophy size={11} aria-hidden="true" /> Nº{a.puesto}
          </span>
        </Tooltip>
      ) : null}
      {a.alcance7d > 0 ? (
        <Tooltip texto={`Lo vieron ${miles(a.alcance7d)} personas más en los últimos 7 días`}>
          <span className="insp-ins insp-ins--crece">
            <TrendingUp size={11} aria-hidden="true" /> {corto(a.alcance7d)}
          </span>
        </Tooltip>
      ) : null}
      {a.duplicados ? (
        <Tooltip texto="Cuántas copias o variantes de este anuncio tiene activas la marca">
          <span className="insp-ins">
            <Layers size={11} aria-hidden="true" /> {miles(a.duplicados)}
          </span>
        </Tooltip>
      ) : null}
      {formato ? (
        <Tooltip texto={c.formatoFuente === 'ia' ? 'Formato reconocido por tu IA mirando la imagen' : 'Formato sacado del texto del anuncio'}>
          <span className="insp-ins insp-ins--formato">
            {c.formatoFuente === 'ia' ? <Sparkles size={11} aria-hidden="true" /> : null}
            {formato.nombre}
          </span>
        </Tooltip>
      ) : null}
      {sonido ? <span className="insp-ins">{sonido.nombre}</span> : null}
      {a.creativos > 1 ? (
        <Tooltip texto="Cuántos anuncios usan este mismo creativo (lo dice la Biblioteca de anuncios)">
          <span className="insp-ins">
            <Layers size={11} aria-hidden="true" /> {miles(a.creativos)} anuncios
          </span>
        </Tooltip>
      ) : null}
      {a.fuente === 'chrome' ? (
        <Tooltip texto={a.validado ? 'Activo hace 30 días o más (o más de 100.000 personas alcanzadas)' : 'Todavía no cumple 30 días activo: lo guardaste igual'}>
          <span className={`insp-ins${a.validado ? ' insp-ins--validado' : ' insp-ins--sin-validar'}`}>
            {a.validado ? <ShieldCheck size={11} aria-hidden="true" /> : null}
            {a.validado ? 'Validado' : 'Sin validar'}
          </span>
        </Tooltip>
      ) : null}
    </div>
  );
}

export function Tarjeta({ a, c, formatos, sonidos, guardado, onGuardar, onReplicar, replicando, onCopiar, onDetalles, onMarca, onPedirMedio, onBorrar, onImagenes, sacandoImagenes }) {
  return (
    <article className="insp-tarjeta" data-id={a.id}>
      <header className="insp-tarjeta__cabeza">
        <button type="button" className="insp-tarjeta__marca" onClick={onMarca} title={`Ver los anuncios de ${a.anunciante.nombre}`}>
          <Avatar nombre={a.anunciante.nombre} logo={urlMedia(a.anunciante.logo)} />
          <span className="insp-tarjeta__marca-texto">
            <strong>{a.anunciante.nombre}</strong>
            <span>
              {a.desde ? `Salió el ${fechaCorta(a.desde)}` : 'Activo'}
              {a.dias != null ? ` · ${a.dias} d` : ''}
            </span>
          </span>
        </button>
        <Boton
          variante="fantasma"
          tamano="chico"
          soloIcono
          icono={guardado ? BookmarkCheck : Bookmark}
          etiqueta={guardado ? 'Quitar de guardados' : 'Guardar'}
          onClick={onGuardar}
          className={guardado ? 'insp-guardado' : ''}
          aria-pressed={guardado}
        />
      </header>
      <Medio a={a} onPedirMedio={onPedirMedio} />
      <div className="insp-tarjeta__cuerpo">
        <Insignias a={a} c={c} formatos={formatos} sonidos={sonidos} />
        {a.titulo ? <h3 className="insp-tarjeta__titulo">{a.titulo}</h3> : null}
        {a.copy ? <p className="insp-tarjeta__copy">{a.copy}</p> : null}
        <div className="insp-tarjeta__acciones">
          <Boton variante="primario" tamano="chico" icono={Wand2} onClick={onReplicar} cargando={replicando} disabled={!a.media && !a.miniatura}>
            Replicar
          </Boton>
          {/* «De un video, imágenes»: los cuadros de este video, armados con las plantillas (gratis) */}
          {onImagenes && a.tipo === 'video' && a.media ? (
            <Tooltip texto="Imágenes de este video (gratis)">
              <Boton variante="secundario" tamano="chico" soloIcono icono={IconoImagen} etiqueta="Hacer imágenes de este video" onClick={onImagenes} cargando={sacandoImagenes} />
            </Tooltip>
          ) : null}
          {a.copy || a.transcripcion ? <Boton variante="secundario" tamano="chico" soloIcono icono={Copy} etiqueta="Copiar el texto" onClick={onCopiar} /> : null}
          <Boton variante="secundario" tamano="chico" icono={Info} onClick={onDetalles}>
            Detalles
          </Boton>
          {onBorrar ? <Boton variante="fantasma" tamano="chico" soloIcono icono={Trash2} etiqueta="Borrar de «Desde Chrome»" onClick={onBorrar} /> : null}
        </div>
      </div>
    </article>
  );
}

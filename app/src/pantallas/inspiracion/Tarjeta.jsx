// Una tarjeta del feed de Inspiración (como en Starpop): la marca, cuándo salió y cuántos días lleva, guardar, el video
// (se reproduce ahí mismo) o la imagen, las insignias (puesto, creciendo, variantes, formato, sonido), el título, el
// copy en 2 líneas y «Replicar» / copiar el texto / «Detalles».
import { useRef, useState } from 'react';
import { Bookmark, BookmarkCheck, Copy, Film, Image as IconoImagen, Info, Layers, Play, Sparkles, TrendingUp, Trophy, Wand2 } from 'lucide-react';
import { Boton, Tooltip } from '../../componentes/index.js';
import { corto, fechaCorta, miles, urlMedia } from './datos.js';

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

export function Medio({ a, grande = false }) {
  const ref = useRef(null);
  const [reproduciendo, setReproduciendo] = useState(false);
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
    </div>
  );
}

export function Tarjeta({ a, c, formatos, sonidos, guardado, onGuardar, onReplicar, replicando, onCopiar, onDetalles, onMarca }) {
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
      <Medio a={a} />
      <div className="insp-tarjeta__cuerpo">
        <Insignias a={a} c={c} formatos={formatos} sonidos={sonidos} />
        {a.titulo ? <h3 className="insp-tarjeta__titulo">{a.titulo}</h3> : null}
        {a.copy ? <p className="insp-tarjeta__copy">{a.copy}</p> : null}
        <div className="insp-tarjeta__acciones">
          <Boton variante="primario" tamano="chico" icono={Wand2} onClick={onReplicar} cargando={replicando} disabled={!a.media && !a.miniatura}>
            Replicar
          </Boton>
          {a.copy || a.transcripcion ? <Boton variante="secundario" tamano="chico" soloIcono icono={Copy} etiqueta="Copiar el texto" onClick={onCopiar} /> : null}
          <Boton variante="secundario" tamano="chico" icono={Info} onClick={onDetalles}>
            Detalles
          </Boton>
        </div>
      </div>
    </article>
  );
}

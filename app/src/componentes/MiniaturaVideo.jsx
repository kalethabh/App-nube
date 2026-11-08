import { useEffect, useRef, useState } from 'react';
import { Clapperboard, Play } from 'lucide-react';
import { duracion as formatoDuracion } from '../datos/formato.js';
import { miniatura } from '../datos/api.js';
import './MiniaturaVideo.css';

/**
 * Miniatura de un video 9:16: muestra la imagen y, al pasar el mouse (o enfocarla con el teclado),
 * reproduce el MP4 sin sonido desde el principio, con una línea de avance abajo.
 *
 *   <MiniaturaVideo
 *     imagen={a.miniatura} video={a.video} duracion={a.duracion} estilo={a.estiloNombre}
 *     titulo={a.titulo} subtitulo="Hace 3 días · 3 versiones"
 *     insignia={<Insignia estado="listo" variante="vidrio" />}
 *     href={enlace.anuncio(a.slug)} />
 *
 * - La imagen se pide achicada (miniatura de anchoImagen px, por defecto 480); si no hay imagen pero
 *   hay video, se usa un cuadro del video. El video se carga recién al primer hover.
 * - `children` se dibuja encima de la imagen, abajo (p. ej. una BarraDeProgreso en "en producción").
 * - relacion: '9 / 16' (por defecto) | '1 / 1' | '4 / 5' | '16 / 9'
 */
export function MiniaturaVideo({
  imagen,
  video,
  duracion,
  estilo,
  titulo,
  subtitulo,
  insignia,
  etiqueta,
  href,
  onClick,
  relacion = '9 / 16',
  anchoImagen = 480,
  reproducirAlPasar = true,
  seleccionada = false,
  atenuada = false,
  children,
  className = '',
  ...resto
}) {
  const [cargada, setCargada] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [usarOriginal, setUsarOriginal] = useState(false);
  const [activo, setActivo] = useState(false);
  const [reproduciendo, setReproduciendo] = useState(false);
  const videoRef = useRef(null);
  const avanceRef = useRef(null);
  const encima = useRef(false);
  const timer = useRef(null);
  const raf = useRef(0);

  const puedeReproducir = Boolean(video) && reproducirAlPasar;
  // la miniatura liviana; si el servidor no la puede hacer, el original
  const fuente = imagen || (video ? video : null);
  const src = !fuente ? null : usarOriginal && imagen ? imagen : miniatura(fuente, anchoImagen, imagen ? undefined : { segundo: 0.8 });

  const reproducir = () => {
    const v = videoRef.current;
    if (!v || !encima.current) return;
    try {
      v.currentTime = 0;
    } catch {
      /* todavía sin metadatos */
    }
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  };

  const empezar = () => {
    encima.current = true;
    if (!puedeReproducir) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!encima.current) return;
      if (!activo) setActivo(true);
      else reproducir();
    }, 110);
  };

  const parar = () => {
    encima.current = false;
    clearTimeout(timer.current);
    cancelAnimationFrame(raf.current);
    videoRef.current?.pause();
    setReproduciendo(false);
  };

  useEffect(() => {
    if (activo) reproducir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      cancelAnimationFrame(raf.current);
    },
    []
  );

  const alReproducir = () => {
    setReproduciendo(true);
    const paso = () => {
      const v = videoRef.current;
      if (v && v.duration && avanceRef.current) avanceRef.current.style.transform = `scaleX(${Math.min(1, v.currentTime / v.duration)})`;
      raf.current = requestAnimationFrame(paso);
    };
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(paso);
  };

  const clases = [
    'miniatura',
    reproduciendo && 'miniatura--reproduciendo',
    seleccionada && 'miniatura--seleccionada',
    atenuada && 'miniatura--atenuada',
    (href || onClick) && 'miniatura--interactiva',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const eventos = {
    onMouseEnter: empezar,
    onMouseLeave: parar,
    onFocus: empezar,
    onBlur: parar,
  };

  const marco = (
    <div className="miniatura__marco" style={{ aspectRatio: relacion }}>
      {src && !fallo ? (
        <img
          className={`miniatura__imagen${cargada ? ' miniatura__imagen--cargada' : ''}`}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable="false"
          onLoad={() => setCargada(true)}
          onError={() => (!usarOriginal && imagen ? setUsarOriginal(true) : setFallo(true))}
        />
      ) : (
        <div className="miniatura__vacia" aria-hidden="true">
          <Clapperboard size={26} strokeWidth={1.6} />
        </div>
      )}
      {src && !fallo && !cargada ? <div className="miniatura__cargando" aria-hidden="true" /> : null}

      {activo ? (
        <video
          ref={videoRef}
          className={`miniatura__video${reproduciendo ? ' miniatura__video--visible' : ''}`}
          src={video}
          muted
          playsInline
          loop
          preload="auto"
          disablePictureInPicture
          onPlaying={alReproducir}
          onPause={() => cancelAnimationFrame(raf.current)}
        />
      ) : null}

      <div className="miniatura__sombra" aria-hidden="true" />

      {estilo || insignia ? (
        <div className="miniatura__arriba">
          {estilo ? <span className="miniatura__chip">{estilo}</span> : <span />}
          {insignia || null}
        </div>
      ) : null}

      {puedeReproducir ? (
        <span className="miniatura__play" aria-hidden="true">
          <Play size={20} strokeWidth={2.2} fill="currentColor" />
        </span>
      ) : null}

      {children ? <div className="miniatura__encima">{children}</div> : null}

      {duracion || etiqueta ? (
        <div className="miniatura__abajo">
          {etiqueta ? <span className="miniatura__etiqueta">{etiqueta}</span> : <span />}
          {duracion ? <span className="miniatura__chip miniatura__duracion">{formatoDuracion(duracion)}</span> : null}
        </div>
      ) : null}

      {puedeReproducir ? <span ref={avanceRef} className="miniatura__avance" aria-hidden="true" /> : null}
    </div>
  );

  const pie =
    titulo || subtitulo ? (
      <div className="miniatura__pie">
        {titulo ? <span className="miniatura__titulo">{titulo}</span> : null}
        {subtitulo ? <span className="miniatura__subtitulo">{subtitulo}</span> : null}
      </div>
    ) : null;

  if (href) {
    return (
      <a href={href} className={clases} {...eventos} {...resto}>
        {marco}
        {pie}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" className={clases} onClick={onClick} {...eventos} {...resto}>
        {marco}
        {pie}
      </button>
    );
  }
  return (
    <div className={clases} {...eventos} tabIndex={puedeReproducir ? 0 : undefined} {...resto}>
      {marco}
      {pie}
    </div>
  );
}

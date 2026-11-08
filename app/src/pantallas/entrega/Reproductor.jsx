// Reproductor 9:16 de la entrega: video grande con controles propios (play, línea de avance que se
// puede arrastrar, tiempo, sonido, pantalla completa). Al cambiar de versión sigue en el mismo segundo,
// así se compara "con subtítulos" contra "sin subtítulos" en el mismo momento.
//
//   const ref = useRef();
//   <Reproductor ref={ref} src={url} poster={img} etiqueta="Completa" />
//   ref.current.irA(29.2)      -> salta a ese segundo y reproduce
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { LoaderCircle, Maximize, Minimize, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { duracion as formatoDuracion } from '../../datos/formato.js';

const OCULTAR_EN = 2200;

export const Reproductor = forwardRef(function Reproductor({ src, poster, etiqueta, alto, duracion }, ref) {
  const caja = useRef(null);
  const video = useRef(null);
  const pista = useRef(null);
  const timer = useRef(0);
  const ultimo = useRef({ tiempo: 0, reproduciendo: false });
  const pendiente = useRef(null);
  const srcPrevio = useRef(src);

  const [reproduciendo, setReproduciendo] = useState(false);
  const [tiempo, setTiempo] = useState(0);
  // arranca con la duración que ya se sabe (la del archivo): nunca "0:00 / 0:00" mientras carga
  const [total, setTotal] = useState(() => Number(duracion) || 0);
  const [cargado, setCargado] = useState(0);
  const [mudo, setMudo] = useState(false);
  const [esperando, setEsperando] = useState(false);
  const [controles, setControles] = useState(true);
  const [completa, setCompleta] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [empezo, setEmpezo] = useState(false);

  const play = useCallback(() => {
    const p = video.current?.play();
    if (p?.catch) p.catch(() => {});
  }, []);
  const alternar = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) play();
    else v.pause();
  }, [play]);
  const saltar = useCallback((seg) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min((v.duration || 0) - 0.05, seg));
    setTiempo(v.currentTime);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      irA(seg, { reproducir = true } = {}) {
        saltar(seg);
        if (reproducir) play();
        caja.current?.focus({ preventScroll: true });
      },
      pausar() {
        video.current?.pause();
      },
    }),
    [play, saltar]
  );

  // cambio de versión: seguir en el mismo segundo y con el mismo estado
  useLayoutEffect(() => {
    if (srcPrevio.current === src) return;
    srcPrevio.current = src;
    pendiente.current = { ...ultimo.current };
    setEsperando(true);
  }, [src]);

  const alCargarDatos = () => {
    const v = video.current;
    if (!v) return;
    if (Number.isFinite(v.duration) && v.duration > 0) setTotal(v.duration);
    const p = pendiente.current;
    if (p) {
      pendiente.current = null;
      if (p.tiempo > 0) v.currentTime = Math.min(p.tiempo, (v.duration || p.tiempo) - 0.05);
      if (p.reproduciendo) play();
    }
  };

  // si el video ya tenía sus datos antes de que React escuchara (llegando desde otra pantalla), se leen igual
  useEffect(() => {
    if (video.current && video.current.readyState >= 1) alCargarDatos();
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (duracion && !total) setTotal(Number(duracion));
  }, [duracion]); // eslint-disable-line react-hooks/exhaustive-deps

  const alAvanzar = () => {
    const v = video.current;
    if (!v) return;
    ultimo.current.tiempo = v.currentTime;
    if (!arrastrando) setTiempo(v.currentTime);
    if (v.buffered.length) setCargado(v.buffered.end(v.buffered.length - 1));
  };

  // controles: se esconden solos mientras se reproduce
  const mostrar = useCallback(() => {
    setControles(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (video.current && !video.current.paused) setControles(false);
    }, OCULTAR_EN);
  }, []);
  useEffect(() => {
    if (!reproduciendo) {
      clearTimeout(timer.current);
      setControles(true);
    } else mostrar();
    return () => clearTimeout(timer.current);
  }, [reproduciendo, mostrar]);

  useEffect(() => {
    const cambio = () => setCompleta(document.fullscreenElement === caja.current);
    document.addEventListener('fullscreenchange', cambio);
    return () => document.removeEventListener('fullscreenchange', cambio);
  }, []);
  const pantallaCompleta = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else caja.current?.requestFullscreen?.().catch(() => {});
  };

  // línea de avance: clic o arrastre
  const desdePuntero = (e) => {
    const r = pista.current.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    return f * (total || 0);
  };
  const alBajar = (e) => {
    if (!total) return;
    e.preventDefault();
    pista.current.setPointerCapture?.(e.pointerId);
    setArrastrando(true);
    const s = desdePuntero(e);
    setTiempo(s);
    saltar(s);
  };
  const alMover = (e) => {
    if (!arrastrando) return;
    const s = desdePuntero(e);
    setTiempo(s);
    saltar(s);
  };
  const alSoltar = () => setArrastrando(false);

  const alTeclado = (e) => {
    if (e.target.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
    const v = video.current;
    if (!v) return;
    const tecla = e.key.toLowerCase();
    if (tecla === ' ' || tecla === 'k') {
      e.preventDefault();
      alternar();
    } else if (tecla === 'arrowright' || tecla === 'l') {
      e.preventDefault();
      saltar(v.currentTime + 5);
    } else if (tecla === 'arrowleft' || tecla === 'j') {
      e.preventDefault();
      saltar(v.currentTime - 5);
    } else if (tecla === 'm') {
      v.muted = !v.muted;
      setMudo(v.muted);
    } else if (tecla === 'f') {
      pantallaCompleta();
    } else return;
    mostrar();
  };

  const pct = total ? (tiempo / total) * 100 : 0;
  const pctCargado = total ? Math.min(100, (cargado / total) * 100) : 0;
  const visibles = controles || !reproduciendo || arrastrando;

  return (
    <div
      ref={caja}
      className={`ent-rep${visibles ? ' ent-rep--controles' : ''}${reproduciendo ? ' ent-rep--reproduciendo' : ''}${completa ? ' ent-rep--completa' : ''}`}
      style={alto ? { '--alto-rep': alto } : undefined}
      tabIndex={0}
      role="group"
      aria-label={`Reproductor${etiqueta ? `: versión ${etiqueta}` : ''}. Espacio para reproducir o pausar, flechas para adelantar.`}
      onKeyDown={alTeclado}
      onMouseMove={mostrar}
      onMouseLeave={() => reproduciendo && setControles(false)}
    >
      <video
        ref={video}
        className="ent-rep__video"
        src={src}
        poster={empezo ? undefined : poster}
        playsInline
        preload="metadata"
        onClick={alternar}
        onLoadedMetadata={alCargarDatos}
        onTimeUpdate={alAvanzar}
        onProgress={alAvanzar}
        onPlay={() => {
          setReproduciendo(true);
          setEmpezo(true);
          ultimo.current.reproduciendo = true;
        }}
        onPause={() => {
          setReproduciendo(false);
          ultimo.current.reproduciendo = false;
        }}
        onWaiting={() => setEsperando(true)}
        onPlaying={() => setEsperando(false)}
        onCanPlay={() => setEsperando(false)}
        onSeeked={() => setEsperando(false)}
        onVolumeChange={(e) => setMudo(e.currentTarget.muted)}
        onEnded={() => setControles(true)}
      />

      {etiqueta ? <span className="ent-rep__version">{etiqueta}</span> : null}

      {esperando && reproduciendo ? (
        <span className="ent-rep__espera" aria-hidden="true">
          <LoaderCircle size={30} strokeWidth={2} className="girando" />
        </span>
      ) : null}

      {!reproduciendo ? (
        <button type="button" className="ent-rep__grande" onClick={alternar} aria-label="Reproducir" tabIndex={-1}>
          <Play size={28} strokeWidth={2} fill="currentColor" />
        </button>
      ) : null}

      <div className="ent-rep__barra">
        <div
          ref={pista}
          className={`ent-rep__pista${arrastrando ? ' ent-rep__pista--arrastrando' : ''}`}
          role="slider"
          tabIndex={-1}
          aria-label="Avance del video"
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(tiempo)}
          aria-valuetext={`${formatoDuracion(tiempo)} de ${formatoDuracion(total)}`}
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
        >
          <span className="ent-rep__cargado" style={{ width: `${pctCargado}%` }} />
          <span className="ent-rep__hecho" style={{ width: `${pct}%` }} />
          <span className="ent-rep__cabezal" style={{ left: `${pct}%` }} />
        </div>
        <div className="ent-rep__fila">
          <button type="button" className="ent-rep__boton" onClick={alternar} aria-label={reproduciendo ? 'Pausar' : 'Reproducir'}>
            {reproduciendo ? <Pause size={18} strokeWidth={2.2} fill="currentColor" /> : <Play size={18} strokeWidth={2.2} fill="currentColor" />}
          </button>
          <span className="ent-rep__tiempo">
            {formatoDuracion(tiempo)} <span>/ {formatoDuracion(total)}</span>
          </span>
          <span className="ent-rep__hueco" />
          <button
            type="button"
            className="ent-rep__boton"
            onClick={() => {
              const v = video.current;
              if (!v) return;
              v.muted = !v.muted;
              setMudo(v.muted);
            }}
            aria-label={mudo ? 'Activar el sonido' : 'Silenciar'}
          >
            {mudo ? <VolumeX size={18} strokeWidth={2.2} /> : <Volume2 size={18} strokeWidth={2.2} />}
          </button>
          <button type="button" className="ent-rep__boton" onClick={pantallaCompleta} aria-label={completa ? 'Salir de pantalla completa' : 'Pantalla completa'}>
            {completa ? <Minimize size={17} strokeWidth={2.2} /> : <Maximize size={17} strokeWidth={2.2} />}
          </button>
        </div>
      </div>
    </div>
  );
});

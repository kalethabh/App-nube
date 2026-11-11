// La línea de tiempo del editor, como la de CapCut: pistas de Textos, Subtítulos, B-roll, Video (con
// candado), Voz (con candado) y Música, con miniaturas reales, formas de onda reales y un cabezal que
// sigue al Player y que se arrastra para saltar.
//
// El cabezal y el reloj se mueven tocando el DOM directo (no con estado de React), así la línea de
// tiempo no se vuelve a dibujar 30 veces por segundo mientras el video se reproduce.
//
// Como en CapCut: una pieza se arrastra para moverla (las escenas cambian de lugar; las imágenes de apoyo, los textos y
// la música se corren en el tiempo) y sus bordes para recortarla. Con Alt (o en un clip que no se mueve, como tu
// video en continuidad), arrastrar DESLIZA su contenido: cambia qué parte del clip se ve sin mover su lugar. Mientras
// se arrastra, la pantalla dibuja el resultado (cortes.js) y al soltar lo guarda como un solo paso del historial. La
// voz no se mueve.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AudioLines, Captions, Clapperboard, Diamond, Eye, EyeOff, Film, Lock, Maximize2, MousePointerClick, Music, Plus, ScanEye, Scissors, Snowflake, Trash2, Type, Upload, Volume2, VolumeX, ZoomIn, ZoomOut } from 'lucide-react';
import { Tooltip } from '../../componentes/index.js';
import { codigoDeTiempo } from '../../datos/formato.js';
import { FPS, nombreDeQuienHabla } from './modelo.js';
import { Onda } from './piezas.jsx';
import { usePicos, picosDePalabras } from './ondas.js';
import { useAncho } from './piezas.jsx';

const PAD = 16; // margen antes del segundo 0
const COLA = 120; // espacio después del final
const PASOS = [0.5, 1, 2, 5, 10, 15, 30, 60];

function etiquetaDeTiempo(t) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  const entero = Math.abs(s - Math.round(s)) < 0.001;
  return `${m}:${entero ? String(Math.round(s)).padStart(2, '0') : s.toFixed(1).padStart(4, '0')}`;
}

// ---------------------------------------------------------------- regla

const Regla = memo(function Regla({ duracion, pps, ancho }) {
  const paso = PASOS.find((p) => p * pps >= 72) || 60;
  const menor = paso * pps >= 160 ? paso / 5 : paso / 4;
  const marcas = [];
  const total = Math.floor(duracion / menor + 0.0001);
  for (let i = 0; i <= total; i++) {
    const t = i * menor;
    const mayor = Math.abs(t / paso - Math.round(t / paso)) < 0.001;
    marcas.push(
      <span key={i} className={`lt-regla__marca${mayor ? ' es-mayor' : ''}`} style={{ left: PAD + t * pps }}>
        {mayor ? <span className="lt-regla__texto">{etiquetaDeTiempo(t)}</span> : null}
      </span>
    );
  }
  return (
    <div className="lt-regla" style={{ width: ancho }}>
      {marcas}
      <span className="lt-regla__fin" style={{ left: PAD + duracion * pps }} />
    </div>
  );
});

// ---------------------------------------------------------------- onda en tramos (un canvas no puede ser infinito)

const TRAMO = 3000;
function OndaLarga({ datos, ancho, alto, segundos, tAudio = 0, repetir, color, espejo, opacidad, nivel, tLinea = 0 }) {
  if (!datos || ancho <= 0) return null;
  const n = Math.ceil(ancho / TRAMO);
  return (
    <span className="lt-onda" aria-hidden="true">
      {Array.from({ length: n }, (_, k) => {
        const w = Math.min(TRAMO, ancho - k * TRAMO);
        return (
          <span key={k} className="lt-onda__tramo" style={{ left: k * TRAMO, width: w }}>
            <Onda
              datos={datos}
              ancho={w}
              alto={alto}
              segundos={(w / ancho) * segundos}
              tAudio={tAudio + ((k * TRAMO) / ancho) * segundos}
              tLinea={tLinea + ((k * TRAMO) / ancho) * segundos}
              nivel={nivel}
              repetir={repetir}
              color={color}
              espejo={espejo}
              opacidad={opacidad}
            />
          </span>
        );
      })}
    </span>
  );
}

// ---------------------------------------------------------------- un clip (botón) de una pista

/**
 * arrastre (opcional) = { mover: bool, bordes: bool | { inicio, fin }, deslizar: bool, empezar(e, item, modo) }
 *   modo: 'mover' (la pieza entera) | 'inicio' | 'fin' (un borde) | 'deslizar' (su contenido: con Alt, o si no se mueve)
 */
function Pieza({ pista, item, pps, seleccionado, onTocar, onDobleClic, className = '', children, titulo, arrastre = null }) {
  const left = PAD + item.inicio * pps;
  const width = Math.max(3, (item.fin - item.inicio) * pps - 2);
  const bordes = arrastre?.bordes && width > 16 ? (arrastre.bordes === true ? { inicio: true, fin: true } : arrastre.bordes) : null;
  const empezar = (e, modo) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onTocar?.(e, item);
    if (modo) arrastre.empezar(e, item, modo);
  };
  const modoAlTocar = (e) => (arrastre?.deslizar && (e.altKey || !arrastre.mover) ? 'deslizar' : arrastre?.mover ? 'mover' : null);
  return (
    <button
      type="button"
      className={`lt-pieza lt-pieza--${pista} ${seleccionado ? 'es-sel' : ''} ${arrastre?.mover ? 'es-movible' : ''} ${arrastre?.deslizar && !arrastre.mover ? 'es-deslizable' : ''} ${className}`}
      style={{ left, width }}
      title={titulo}
      aria-label={titulo}
      aria-pressed={seleccionado}
      data-id={item.id}
      data-ancho={width < 40 ? 'chico' : width < 90 ? 'medio' : 'grande'}
      onPointerDown={(e) => empezar(e, modoAlTocar(e))}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDobleClic?.(e, item);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (onDobleClic || onTocar)?.(e, item);
        }
      }}
    >
      {children}
      {bordes?.inicio ? <span className="lt-pieza__borde lt-pieza__borde--inicio" aria-hidden="true" title="Arrastra para recortar el comienzo" onPointerDown={(e) => empezar(e, 'inicio')} /> : null}
      {bordes?.fin ? <span className="lt-pieza__borde lt-pieza__borde--fin" aria-hidden="true" title="Arrastra para recortar el final" onPointerDown={(e) => empezar(e, 'fin')} /> : null}
    </button>
  );
}

// ---------------------------------------------------------------- envolvente de volumen de la música

/**
 * El volumen de un tramo de la música en cada segundo del anuncio (0..1): sus fundidos y la subida del final,
 * con la misma curva que el montaje.
 */
function curvaTramo(plan, tramo) {
  const m = plan.musica || {};
  const p = m.payoffDesdeSeg;
  const sube = m.subeEnPayoffDb ?? 0;
  const base = 0.62;
  const alza = p && sube ? Math.min(0.95, base * Math.pow(10, sube / 20)) : base;
  const fi = tramo.fadeIn;
  const fo = tramo.fadeOut;
  return (t) => {
    let k = base;
    if (p && sube) k = t < p - 1.5 ? base : t < p ? base + ((alza - base) * (t - (p - 1.5))) / 1.5 : alza;
    const entra = fi > 0 ? (t - tramo.desde) / fi : 1;
    const sale = fo > 0 ? (tramo.hasta - t) / fo : 1;
    return k * Math.max(0, Math.min(1, entra, sale));
  };
}

function Envolvente({ tramo, plan, pps, alto, volumen = 1 }) {
  const curva = curvaTramo(plan, tramo);
  const largo = tramo.hasta - tramo.desde;
  const y = (k) => (alto - 4) * (1 - Math.min(1, k * volumen) * 0.9) + 2;
  // puntos donde cambia la curva: bordes, fundidos y la subida del final
  const m = plan.musica || {};
  const marcas = [tramo.desde, tramo.desde + tramo.fadeIn, tramo.hasta - tramo.fadeOut, tramo.hasta];
  if (m.payoffDesdeSeg && m.subeEnPayoffDb) marcas.push(m.payoffDesdeSeg - 1.5, m.payoffDesdeSeg);
  const ts = [...new Set(marcas.map((t) => Math.max(tramo.desde, Math.min(tramo.hasta, t))))].sort((a, b) => a - b);
  const d = ts.map((t, i) => `${i ? 'L' : 'M'}${((t - tramo.desde) * pps).toFixed(1)},${y(curva(t)).toFixed(1)}`).join(' ');
  const ancho = Math.max(1, largo * pps);
  return (
    <svg className="lt-envolvente" width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} aria-hidden="true">
      <path d={`${d} L${ancho},${alto} L0,${alto} Z`} className="lt-envolvente__area" />
      <path d={d} className="lt-envolvente__linea" />
    </svg>
  );
}

/**
 * Lo que le cambiaste al clip: «Tu video» y la velocidad («1,5×»), arriba a la derecha de la pieza. Y si la revisión
 * notó algo en ese clip (`aviso`), el ojo ámbar (como en el proceso): se ve sin tener que tocarlo.
 */
function ChipsClip({ item, aviso = null }) {
  const v = item.ajuste?.velocidad;
  const conVelocidad = v !== null && v !== undefined && Math.abs(v - 1) > 0.001;
  if (!item.reemplazado && !conVelocidad && !aviso) return null;
  return (
    <span className="lt-pieza__chips" aria-hidden="true">
      {aviso ? (
        <span className="lt-pieza__chip lt-pieza__chip--aviso">
          <ScanEye size={10} strokeWidth={2.6} />
        </span>
      ) : null}
      {item.reemplazado ? <span className="lt-pieza__chip">Tu video</span> : null}
      {conVelocidad ? <span className="lt-pieza__chip lt-pieza__chip--suave">{String(Math.round(v * 100) / 100).replace('.', ',')}×</span> : null}
    </span>
  );
}

/** La marca de un clip que no alcanza a llenar su lugar: se ve quieto al final. */
function Quieto({ segundos }) {
  return (
    <span className="lt-pieza__quieto" aria-hidden="true">
      <Snowflake size={9} strokeWidth={2.6} />
      {String(segundos).replace('.', ',')} s
    </span>
  );
}

// ---------------------------------------------------------------- cabecera de pista

function Cabecera({ icono: Icono, nombre, tono, candado, alternar, alto, children }) {
  return (
    <div className={`lt-cab lt-cab--${tono}`} style={{ height: alto }}>
      <span className="lt-cab__icono" aria-hidden="true">
        <Icono size={13} strokeWidth={2.2} />
      </span>
      <span className="lt-cab__nombre">{nombre}</span>
      <span className="lt-cab__acciones">
        {children}
        {candado ? (
          <Tooltip texto={candado} lado="derecha">
            <span className="lt-cab__candado" tabIndex={0} aria-label={candado}>
              <Lock size={12} strokeWidth={2.4} />
            </span>
          </Tooltip>
        ) : null}
        {alternar ? (
          <Tooltip texto={alternar.texto} lado="derecha">
            <button type="button" className={`lt-cab__boton${alternar.apagado ? ' es-apagado' : ''}`} onClick={alternar.onClick} aria-label={alternar.texto} aria-pressed={!alternar.apagado}>
              <alternar.icono size={13} strokeWidth={2.2} />
            </button>
          </Tooltip>
        ) : null}
      </span>
    </div>
  );
}

const ALTOS_NORMALES = { textos: 24, subtitulos: 30, broll: 36, video: 46, voz: 34, musica: 34 };
// pantallas bajas (720-800 px de alto): pistas más finas para que la vista previa siga grande
const ALTOS_COMPACTOS = { textos: 16, subtitulos: 21, broll: 25, video: 34, voz: 23, musica: 23 };
const CONSULTA_BAJA = '(max-height: 800px)';
function usePantallaBaja() {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(CONSULTA_BAJA);
      mq.addEventListener('change', avisar);
      return () => mq.removeEventListener('change', avisar);
    },
    () => window.matchMedia(CONSULTA_BAJA).matches,
    () => false
  );
}

// ---------------------------------------------------------------- la línea de tiempo

export function LineaDeTiempo({ plan, pistas, playerRef, playerListo, seleccion, onSeleccionar, onEditarSubtitulo, editando, ed, acciones, onArrastrar }) {
  const ALTOS = usePantallaBaja() ? ALTOS_COMPACTOS : ALTOS_NORMALES;
  const carrilRef = useRef(null);
  const cabezalRef = useRef(null);
  const relojRef = useRef(null);
  const hoverRef = useRef(null);
  const anclaZoom = useRef(null);
  const anchoCarril = useAncho(carrilRef);
  const dur = pistas.duracion;
  // lo que notó la revisión en el clip de una pieza (no en tu video: ese aviso es del clip de la app, que ahí no va)
  const avisoDe = (x) => (x.pieza && !x.reemplazado ? acciones?.reh?.porPieza?.[x.pieza]?.aviso || null : null);
  const conAviso = (x) => (avisoDe(x) ? ` (la revisión notó: ${avisoDe(x).texto})` : '');

  const ajuste = Math.max(2, (anchoCarril - PAD - 48) / dur);
  const maxZoom = Math.max(2, 240 / ajuste);
  const [zoom, setZoom] = useState(1);
  const z = Math.min(zoom, maxZoom);
  const pps = ajuste * z;
  const ppsRef = useRef(pps);
  ppsRef.current = pps;
  const anchoContenido = PAD + dur * pps + COLA;

  const vozArchivo = pistas.voz?.segmentos?.[0]?.url && pistas.voz.modo !== 'en-clips' ? pistas.voz.segmentos[0].url : null;
  const picosVoz = usePicos(vozArchivo);
  const picosPalabras = useMemo(() => (pistas.voz?.modo === 'en-clips' ? picosDePalabras(pistas.subtitulos, dur) : null), [pistas.voz?.modo, pistas.subtitulos, dur]);
  const picosMusica = usePicos(pistas.musica?.url || null);
  const nivelesMusica = useMemo(() => {
    const vol = Math.min(1, ed.musica.volumen);
    return new Map(
      (pistas.tramosMusica || []).map((tr) => {
        const curva = curvaTramo(plan, tr);
        return [tr.id, (t) => (0.12 + 0.88 * (curva(t) / 0.95)) * vol];
      })
    );
  }, [plan, pistas.tramosMusica, ed.musica.volumen]);

  // ---------------------------------------------------------------- arrastrar piezas (mover y recortar)
  const arrastrarRef = useRef(onArrastrar);
  arrastrarRef.current = onArrastrar;
  const empezarPieza = useCallback(
    (pista) => (e, item, modo) => {
      if (!arrastrarRef.current) return;
      const x0 = e.clientX;
      let activo = false;
      let dt = 0;
      const op = (extra) =>
        modo === 'deslizar'
          ? { tipo: 'deslizar', pista, id: item.id, ...extra }
          : { tipo: modo === 'mover' ? 'mover' : 'recortar', borde: modo === 'mover' ? undefined : modo, pista, id: item.id, ...extra };
      const quitar = () => {
        window.removeEventListener('pointermove', mover);
        window.removeEventListener('pointerup', soltar);
        window.removeEventListener('pointercancel', cancelar);
        document.body.classList.remove('lt-arrastrando');
      };
      const mover = (ev) => {
        const dx = ev.clientX - x0;
        if (!activo && Math.abs(dx) < 4) return;
        if (!activo) document.body.classList.add('lt-arrastrando');
        activo = true;
        dt = dx / ppsRef.current;
        arrastrarRef.current(op({ dt }), false);
      };
      const soltar = () => {
        quitar();
        if (activo) arrastrarRef.current(op({ dt }), true);
      };
      const cancelar = () => {
        quitar();
        if (activo) arrastrarRef.current(null);
      };
      window.addEventListener('pointermove', mover);
      window.addEventListener('pointerup', soltar);
      window.addEventListener('pointercancel', cancelar);
    },
    []
  );
  const cortes = pistas.cortes || {};
  const arrastreDe = (pista, item) => {
    if (!onArrastrar) return null;
    const deslizar = Boolean(item.puede?.deslizar);
    if (pista === 'video') {
      if (cortes.tomas) return { mover: true, bordes: { inicio: pistas.video[0]?.id !== item.id, fin: pistas.video[pistas.video.length - 1]?.id !== item.id }, deslizar, empezar: empezarPieza('video') };
      return deslizar ? { mover: false, deslizar: true, empezar: empezarPieza('video') } : null;
    }
    if (pista === 'broll') {
      if (cortes.brolls && item.editable) return { mover: true, bordes: true, deslizar, empezar: empezarPieza('broll') };
      return deslizar && !item.quitado ? { mover: false, deslizar: true, empezar: empezarPieza('broll') } : null;
    }
    if (pista === 'textos') return item.editable ? { mover: true, bordes: true, empezar: empezarPieza('textos') } : null;
    if (pista === 'musica') return { mover: true, bordes: true, empezar: empezarPieza('musica') };
    return null;
  };

  // ---------------------------------------------------------------- cabezal y reloj
  const reproduciendo = useRef(false);
  const mover = useCallback((frame, { traer = false } = {}) => {
    const t = Math.max(0, frame / FPS);
    const x = PAD + t * ppsRef.current;
    if (cabezalRef.current) cabezalRef.current.style.transform = `translateX(${x}px)`;
    if (relojRef.current) relojRef.current.textContent = codigoDeTiempo(t);
    const c = carrilRef.current;
    if (c && (reproduciendo.current || traer)) {
      if (x > c.scrollLeft + c.clientWidth - 48 || x < c.scrollLeft + 8) c.scrollLeft = Math.max(0, x - (reproduciendo.current ? 64 : c.clientWidth / 2));
    }
  }, []);

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return undefined;
    const alCuadro = (e) => mover(e.detail.frame);
    const alSaltar = (e) => mover(e.detail.frame, { traer: !arrastrando.current });
    const alPlay = () => {
      reproduciendo.current = true;
    };
    const alPausa = () => {
      reproduciendo.current = false;
    };
    p.addEventListener('frameupdate', alCuadro);
    p.addEventListener('seeked', alSaltar);
    p.addEventListener('play', alPlay);
    p.addEventListener('pause', alPausa);
    p.addEventListener('ended', alPausa);
    mover(p.getCurrentFrame());
    return () => {
      p.removeEventListener('frameupdate', alCuadro);
      p.removeEventListener('seeked', alSaltar);
      p.removeEventListener('play', alPlay);
      p.removeEventListener('pause', alPausa);
      p.removeEventListener('ended', alPausa);
    };
  }, [playerRef, playerListo, mover]);

  // al cambiar el zoom: el cabezal se reacomoda y lo que estaba bajo el mouse queda en su lugar
  useLayoutEffect(() => {
    const c = carrilRef.current;
    const p = playerRef.current;
    if (anclaZoom.current && c) {
      const { t, x } = anclaZoom.current;
      c.scrollLeft = Math.max(0, PAD + t * pps - x);
      anclaZoom.current = null;
    }
    if (p) mover(p.getCurrentFrame());
  }, [pps, mover, playerRef]);

  const cambiarZoom = useCallback(
    (nuevo, enX) => {
      const c = carrilRef.current;
      if (c) {
        const x = enX ?? (cabezalRef.current ? Math.min(c.clientWidth - 40, Math.max(40, (PAD + ((playerRef.current?.getCurrentFrame() || 0) / FPS) * ppsRef.current) - c.scrollLeft)) : c.clientWidth / 2);
        anclaZoom.current = { t: (c.scrollLeft + x - PAD) / ppsRef.current, x };
      }
      setZoom(Math.max(1, Math.min(maxZoom, nuevo)));
    },
    [maxZoom, playerRef]
  );

  // ---------------------------------------------------------------- saltar y arrastrar el cabezal
  const arrastrando = useRef(false);
  const tiempoDesdeEvento = (e) => {
    const c = carrilRef.current;
    const r = c.getBoundingClientRect();
    return Math.max(0, Math.min(dur, (e.clientX - r.left + c.scrollLeft - PAD) / ppsRef.current));
  };
  const saltarA = useCallback(
    (t) => {
      const p = playerRef.current;
      if (!p) return;
      p.seekTo(Math.min(Math.round(dur * FPS) - 1, Math.max(0, Math.round(t * FPS))));
    },
    [playerRef, dur]
  );

  const empezarArrastre = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const p = playerRef.current;
    if (p?.isPlaying()) p.pause();
    arrastrando.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    saltarA(tiempoDesdeEvento(e));
  };
  const seguirArrastre = (e) => {
    if (hoverRef.current) {
      const c = carrilRef.current;
      const r = c.getBoundingClientRect();
      hoverRef.current.style.transform = `translateX(${e.clientX - r.left + c.scrollLeft}px)`;
      hoverRef.current.style.opacity = '1';
    }
    if (!arrastrando.current) return;
    saltarA(tiempoDesdeEvento(e));
  };
  const terminarArrastre = () => {
    arrastrando.current = false;
  };

  const tocarCarril = (e) => {
    if (e.button !== 0) return;
    onSeleccionar(null);
    empezarArrastre(e);
  };

  const tocarPieza = (pista) => (e, item) => {
    onSeleccionar({ pista, id: item.id });
    if (e.clientX) saltarA(tiempoDesdeEvento(e));
  };

  // rueda: horizontal por defecto, zoom con Ctrl
  useEffect(() => {
    const c = carrilRef.current;
    if (!c) return undefined;
    const alRodar = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const r = c.getBoundingClientRect();
        cambiarZoom(z * (e.deltaY < 0 ? 1.18 : 1 / 1.18), e.clientX - r.left);
      } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        c.scrollLeft += e.deltaY;
      }
    };
    c.addEventListener('wheel', alRodar, { passive: false });
    return () => c.removeEventListener('wheel', alRodar);
  }, [cambiarZoom, z]);

  // teclas + y - (las manda la pantalla)
  useEffect(() => {
    const alZoom = (e) => cambiarZoom(e.detail > 0 ? z * 1.35 : z / 1.35);
    window.addEventListener('editor:zoom', alZoom);
    return () => window.removeEventListener('editor:zoom', alZoom);
  }, [cambiarZoom, z]);

  const esSel = (pista, id) => seleccion?.pista === pista && seleccion?.id === id;
  const valorZoom = maxZoom > 1 ? (Math.log(z) / Math.log(maxZoom)) * 100 : 0;

  const { video, broll, efectos, textos, voz, musica, subtitulos } = pistas;
  const sugeridos = textos.filter((x) => x.tipo === 'sugerido');
  const sinMusicaPosible = voz?.modo === 'cancion';

  return (
    <section className="lt" aria-label="Línea de tiempo">
      <div className="lt__barra">
        <div className="lt__reloj">
          <span ref={relojRef} className="lt__reloj-actual">
            00:00.00
          </span>
          <span className="lt__reloj-total">/ {codigoDeTiempo(dur)}</span>
        </div>
        <div className="lt__herramientas" role="toolbar" aria-label="Herramientas de corte">
          <Tooltip texto={<>Dividir en el cursor <kbd>Ctrl B</kbd></>}>
            <button type="button" className="lt__icono" onClick={acciones.dividir} aria-label="Dividir en el cursor">
              <Scissors size={15} strokeWidth={2} />
            </button>
          </Tooltip>
          <Tooltip texto={acciones.puedeBorrar ? <>Borrar lo elegido <kbd>Supr</kbd></> : 'Elige un clip, un texto o la música para borrarlo'}>
            <button type="button" className="lt__icono" onClick={acciones.borrar} disabled={!acciones.puedeBorrar} aria-label="Borrar lo elegido">
              <Trash2 size={15} strokeWidth={2} />
            </button>
          </Tooltip>
          <Tooltip texto="Agregar un texto donde está el cursor">
            <button type="button" className="lt__boton" onClick={acciones.agregarTexto}>
              <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
              Texto
            </button>
          </Tooltip>
        </div>
        <p className="lt__pista-ayuda">
          <MousePointerClick size={14} strokeWidth={2} aria-hidden="true" />
          Arrastra un clip para moverlo y sus bordes para recortarlo; con Alt, deslizas lo que se ve
        </p>
        <div className="lt__zoom">
          <Tooltip texto={<>Alejar <kbd>−</kbd></>}>
            <button type="button" className="lt__icono" onClick={() => cambiarZoom(z / 1.35)} disabled={z <= 1.001} aria-label="Alejar">
              <ZoomOut size={15} strokeWidth={2} />
            </button>
          </Tooltip>
          <input
            type="range"
            className="lt__zoom-barra"
            min={0}
            max={100}
            step={1}
            value={valorZoom}
            onChange={(e) => cambiarZoom(Math.pow(maxZoom, Number(e.target.value) / 100))}
            aria-label="Zoom de la línea de tiempo"
            style={{ '--pct': `${valorZoom}%` }}
          />
          <Tooltip texto={<>Acercar <kbd>+</kbd></>}>
            <button type="button" className="lt__icono" onClick={() => cambiarZoom(z * 1.35)} disabled={z >= maxZoom - 0.001} aria-label="Acercar">
              <ZoomIn size={15} strokeWidth={2} />
            </button>
          </Tooltip>
          <Tooltip texto="Ver todo el anuncio">
            <button type="button" className="lt__icono" onClick={() => cambiarZoom(1)} aria-label="Ver todo el anuncio">
              <Maximize2 size={14} strokeWidth={2} />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="lt__cuerpo">
        <div className="lt__cabeceras">
          <div className="lt__esquina" />
          <Cabecera
            icono={Type}
            nombre="Textos"
            tono="textos"
            alto={ALTOS.textos}
            alternar={
              sugeridos.length
                ? {
                    icono: sugeridos.some((x) => x.visible) ? Eye : EyeOff,
                    apagado: !sugeridos.some((x) => x.visible),
                    texto: sugeridos.some((x) => x.visible) ? 'Ocultar los textos en pantalla' : 'Mostrar los textos sugeridos en el video',
                    onClick: acciones.alternarTextos,
                  }
                : null
            }
          />
          <Cabecera
            icono={Captions}
            nombre="Subtítulos"
            tono="subtitulos"
            alto={ALTOS.subtitulos}
            alternar={
              subtitulos.length
                ? { icono: ed.subtitulos.visible ? Eye : EyeOff, apagado: !ed.subtitulos.visible, texto: ed.subtitulos.visible ? 'Quitar los subtítulos' : 'Mostrar los subtítulos', onClick: acciones.alternarSubtitulos }
                : null
            }
          />
          <Cabecera
            icono={Clapperboard}
            nombre="Apoyo"
            tono="broll"
            alto={ALTOS.broll}
            alternar={
              broll.some((b) => b.removible)
                ? {
                    icono: broll.some((b) => !b.quitado) ? Eye : EyeOff,
                    apagado: broll.every((b) => b.quitado || !b.removible),
                    texto: broll.some((b) => !b.quitado && b.removible) ? 'Quitar todas las imágenes de apoyo' : 'Volver a poner las imágenes de apoyo',
                    onClick: acciones.alternarBrolls,
                  }
                : null
            }
          />
          <Cabecera icono={Film} nombre="Video" tono="video" alto={ALTOS.video} candado={cortes.tomas ? null : cortes.motivo || 'Los cortes los pone la voz: cada toma dura lo que dura su frase.'} />
          <Cabecera
            icono={AudioLines}
            nombre={voz?.modo === 'cancion' ? 'Canción' : 'Voz'}
            tono="voz"
            alto={ALTOS.voz}
            candado={voz?.modo === 'cancion' ? 'La canción manda: el video sigue a la canción.' : 'La voz manda: todo el anuncio sigue a la voz.'}
            alternar={{ icono: ed.voz.silenciada ? VolumeX : Volume2, apagado: ed.voz.silenciada, texto: ed.voz.silenciada ? 'Volver a escuchar la voz' : 'Silenciar la voz en la vista previa', onClick: acciones.alternarVoz }}
          />
          <Cabecera
            icono={Music}
            nombre="Música"
            tono="musica"
            alto={ALTOS.musica}
            alternar={musica && !musica.falta ? { icono: ed.musica.silenciada ? VolumeX : Volume2, apagado: ed.musica.silenciada, texto: ed.musica.silenciada ? 'Volver a escuchar la música' : 'Silenciar la música', onClick: acciones.alternarMusica } : null}
          />
        </div>

        <div className="lt__carril" ref={carrilRef} onPointerMove={seguirArrastre} onPointerUp={terminarArrastre} onPointerCancel={terminarArrastre} onPointerLeave={() => hoverRef.current && (hoverRef.current.style.opacity = '0')}>
          <div className="lt__contenido" style={{ width: anchoContenido }}>
            <div className="lt__regla-zona" onPointerDown={empezarArrastre}>
              <Regla duracion={dur} pps={pps} ancho={anchoContenido} />
            </div>

            <div className="lt__pistas" onPointerDown={tocarCarril}>
              {/* Textos */}
              <div className="lt-carril lt-carril--textos" style={{ height: ALTOS.textos }}>
                {textos.length ? (
                  textos.map((x) => (
                    <Pieza
                      key={x.id}
                      pista="textos"
                      item={x}
                      pps={pps}
                      seleccionado={esSel('textos', x.id)}
                      onTocar={tocarPieza('textos')}
                      arrastre={arrastreDe('textos', x)}
                      className={x.tipo === 'sugerido' && !x.visible ? 'es-sugerido' : ''}
                      titulo={`${x.tipo === 'icono' ? 'Icono' : 'Texto'}: ${x.texto}${x.tipo === 'sugerido' && !x.visible ? ' (sugerido, no se ve en el video)' : ''}`}
                    >
                      {x.imagen ? <img className="lt-pieza__icono" src={x.imagen} alt="" draggable="false" /> : <Type size={11} strokeWidth={2.4} aria-hidden="true" />}
                      <span className="lt-pieza__texto">{x.texto}</span>
                    </Pieza>
                  ))
                ) : (
                  <span className="lt-carril__nada" style={{ left: PAD }}>
                    Sin textos en pantalla: agrega uno con «+ Texto»
                  </span>
                )}
              </div>

              {/* Subtítulos */}
              <div className="lt-carril lt-carril--subtitulos" style={{ height: ALTOS.subtitulos }}>
                {subtitulos.length ? (
                  subtitulos.map((b) => (
                    <Pieza
                      key={b.id}
                      pista="subtitulos"
                      item={b}
                      pps={pps}
                      seleccionado={esSel('subtitulos', b.id) || editando === b.id}
                      onTocar={tocarPieza('subtitulos')}
                      onDobleClic={(e) => onEditarSubtitulo(b.id, e.currentTarget)}
                      className={`${b.oculto ? 'es-oculto' : ''} ${b.corregido ? 'es-corregido' : ''} ${!ed.subtitulos.visible ? 'es-apagado' : ''}`}
                      titulo={`Subtítulo: ${b.texto}${b.corregido ? ' (corregido)' : ''}${b.oculto ? ' (oculto)' : ''}. Doble clic para corregirlo.`}
                    >
                      <span className="lt-pieza__texto">{b.texto}</span>
                    </Pieza>
                  ))
                ) : (
                  <span className="lt-carril__nada" style={{ left: PAD }}>
                    Este anuncio no lleva subtítulos
                  </span>
                )}
              </div>

              {/* B-roll */}
              <div className="lt-carril lt-carril--broll" style={{ height: ALTOS.broll }}>
                {broll.length ? (
                  broll.map((b) => (
                    <Pieza
                      key={b.id}
                      pista="broll"
                      item={b}
                      pps={pps}
                      seleccionado={esSel('broll', b.id)}
                      onTocar={tocarPieza('broll')}
                      arrastre={arrastreDe('broll', b)}
                      className={`${b.quitado ? 'es-quitado' : ''} ${b.tipo === 'reaccion' ? 'es-reaccion' : ''}`}
                      titulo={`${b.nombre}${b.texto ? `: ${b.texto}` : ''}${b.reemplazado ? ' (tu video)' : ''}${b.quitado ? ' (oculto)' : ''}${b.quieto ? ` (se ve quieta ${String(b.quieto).replace('.', ',')} s al final)` : ''}${conAviso(b)}`}
                    >
                      <span className="lt-pieza__tira" style={{ backgroundImage: `url("${b.miniatura}")` }} />
                      <span className="lt-pieza__etiqueta">
                        {b.quitado ? <EyeOff size={10} strokeWidth={2.6} aria-hidden="true" /> : null}
                        {b.nombre}
                      </span>
                      <ChipsClip item={b} aviso={avisoDe(b)} />
                      {b.quieto && !b.quitado ? <Quieto segundos={b.quieto} /> : null}
                    </Pieza>
                  ))
                ) : (
                  <span className="lt-carril__nada" style={{ left: PAD }}>
                    {pistas.familia === 'continuidad' ? 'Con continuidad no hay imágenes de apoyo: cada escena se transforma en la siguiente' : 'Este anuncio no lleva imágenes de apoyo'}
                  </span>
                )}
              </div>

              {/* Video */}
              <div className="lt-carril lt-carril--video" style={{ height: ALTOS.video }}>
                {video.map((v) => (
                  <Pieza
                    key={v.id}
                    pista="video"
                    item={v}
                    pps={pps}
                    seleccionado={esSel('video', v.id)}
                    onTocar={tocarPieza('video')}
                    arrastre={arrastreDe('video', v)}
                    className={v.oculto ? 'es-solo-voz' : ''}
                    titulo={`${v.nombre}${v.texto ? `: «${v.texto}»` : ''}${v.reemplazado ? ' (tu video)' : ''}${v.oculto ? ' (solo se oye: la tapa una imagen de apoyo)' : ''}${v.quieto ? ` (se ve quieta ${String(v.quieto).replace('.', ',')} s al final)` : ''}${conAviso(v)}`}
                  >
                    <span className="lt-pieza__tira" style={{ backgroundImage: `url("${v.miniatura}")` }} />
                    <span className="lt-pieza__etiqueta">{v.nombre}</span>
                    <ChipsClip item={v} aviso={avisoDe(v)} />
                    {v.quieto ? <Quieto segundos={v.quieto} /> : null}
                  </Pieza>
                ))}
                {efectos.map((x, i) => (
                  <Tooltip key={`${x.t}-${i}`} texto={x.detalle ? `${x.nombre}: ${x.detalle}` : x.nombre}>
                    <span className="lt-efecto" style={{ left: PAD + x.t * pps }} tabIndex={0} aria-label={`Efecto: ${x.nombre}`}>
                      <Diamond size={9} strokeWidth={3} />
                    </span>
                  </Tooltip>
                ))}
              </div>

              {/* Voz */}
              <div className={`lt-carril lt-carril--voz${ed.voz.silenciada ? ' es-silenciada' : ''}`} style={{ height: ALTOS.voz }}>
                {(voz?.segmentos || []).map((s) => {
                  const ancho = Math.max(3, (s.fin - s.inicio) * pps - 2);
                  return (
                    <Pieza
                      key={s.id}
                      pista="voz"
                      item={s}
                      pps={pps}
                      seleccionado={esSel('voz', s.id)}
                      onTocar={tocarPieza('voz')}
                      titulo={s.texto ? `${s.habla ? nombreDeQuienHabla(s.habla) : 'Voz'}: «${s.texto}»` : s.nombre}
                    >
                      <OndaLarga
                        datos={voz.modo === 'en-clips' ? picosPalabras : picosVoz}
                        ancho={ancho}
                        alto={ALTOS.voz - 10}
                        segundos={s.fin - s.inicio}
                        tAudio={voz.modo === 'en-clips' ? s.inicio : 0}
                        color="#34d39a"
                        opacidad={0.9}
                      />
                      {s.avatar ? <img className="lt-pieza__avatar" src={s.avatar} alt="" draggable="false" /> : null}
                      {voz.modo !== 'en-clips' || ancho > 60 ? (
                        <span className="lt-pieza__etiqueta">
                          <Lock size={9} strokeWidth={2.8} aria-hidden="true" />
                          {s.nombre || (s.habla ? nombreDeQuienHabla(s.habla) : 'Voz')}
                        </span>
                      ) : null}
                    </Pieza>
                  );
                })}
              </div>

              {/* Música */}
              <div className={`lt-carril lt-carril--musica${ed.musica.silenciada ? ' es-silenciada' : ''}`} style={{ height: ALTOS.musica }}>
                {musica && !musica.falta ? (
                  (pistas.tramosMusica || []).map((tr) => {
                    const largo = tr.hasta - tr.desde;
                    const ancho = Math.max(3, largo * pps - 2);
                    return (
                      <Pieza
                        key={tr.id}
                        pista="musica"
                        item={{ id: tr.id, inicio: tr.desde, fin: tr.hasta }}
                        pps={pps}
                        seleccionado={esSel('musica', tr.id)}
                        onTocar={tocarPieza('musica')}
                        arrastre={arrastreDe('musica', tr)}
                        titulo={`Música: ${musica.nombre}`}
                      >
                        <OndaLarga datos={picosMusica} ancho={ancho} alto={ALTOS.musica - 8} segundos={largo} tAudio={tr.entrada} tLinea={tr.desde} repetir={musica.repetir} color="#f7b84b" opacidad={0.5} nivel={nivelesMusica.get(tr.id)} />
                        <Envolvente tramo={tr} plan={plan} pps={pps} alto={ALTOS.musica - 2} volumen={ed.musica.volumen} />
                        <span className="lt-pieza__etiqueta">
                          <Music size={10} strokeWidth={2.6} aria-hidden="true" />
                          {musica.nombre}
                          {musica.fuente === 'propia' ? <span className="lt-pieza__chip">Tuya</span> : null}
                          <span className="lt-pieza__chip lt-pieza__chip--suave">{Math.round(ed.musica.volumen * 100)} %</span>
                        </span>
                      </Pieza>
                    );
                  })
                ) : sinMusicaPosible ? (
                  <span className="lt-carril__nada" style={{ left: PAD }}>
                    En los musicales la canción es el anuncio: no lleva música aparte
                  </span>
                ) : (
                  <button
                    type="button"
                    className="lt-soltar"
                    style={{ left: PAD, width: Math.max(260, dur * pps - 2) }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={acciones.abrirMusica}
                  >
                    <Upload size={14} strokeWidth={2.2} aria-hidden="true" />
                    {musica?.falta ? 'No encontré tu canción en este equipo: arrástrala otra vez o elige otra' : 'Arrastra una canción aquí o elige una de tus otros anuncios'}
                  </button>
                )}
              </div>
            </div>

            <div className="lt__hover" ref={hoverRef} aria-hidden="true" />
            <div className="lt__cabezal" ref={cabezalRef} aria-hidden="true">
              <span className="lt__cabezal-mango" onPointerDown={empezarArrastre} />
              <span className="lt__cabezal-linea" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

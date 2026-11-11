// Una pieza (imagen o clip) en la cuadrícula: su miniatura real y un punto de estado.
//   en espera   -> marco vacío con trama
//   generando   -> destello cian (si es un clip, su imagen de partida atenuada y una línea que la recorre)
//   lista       -> la miniatura entra con un fogonazo suave; al pasar el mouse, el clip se reproduce
//   arreglada   -> punto ámbar · te necesita -> anillo rojo que respira
//   con aviso   -> borde ámbar y un ojo arriba a la izquierda: la revisión notó algo (no se rehízo sola: tú decides)
//   la pides de nuevo -> un reloj (en la fila) o un círculo que gira (regenerándose) arriba a la izquierda
import { createContext, memo, useContext, useEffect, useRef, useState } from 'react';
import { Clock, Film, Hand, LoaderCircle, ScanEye } from 'lucide-react';
import { PuntoEstado } from '../../componentes/index.js';
import { miniatura } from '../../datos/api.js';
import { duracion as fmtDuracion } from '../../datos/formato.js';
import { miniaturaDe } from './modelo.js';

const TERMINADA = new Set(['listo', 'arreglado', 'te-necesita']);

/**
 * false mientras la pantalla muestra el detalle guardado de otra visita (todavía no llegó el de ahora): puede nombrar
 * la imagen o el clip de una toma que se está rehaciendo, que ya no existen, y su miniatura daría 404. Las piezas se
 * ven igual, solo sin la miniatura, hasta que llega el detalle de ahora.
 */
export const MiniaturasAlDia = createContext(true);

const TEXTO = {
  listo: 'Lista',
  arreglado: 'Se arregló sola',
  'te-necesita': 'Te necesita',
  generando: 'Generándose',
  'en-cola': 'En espera',
};

export const Pieza = memo(function Pieza({ pieza: p, estado = 'en-cola', nota, seleccionada, onAbrir, tamano = 'normal', mostrarEtiqueta = true }) {
  const terminada = TERMINADA.has(estado);
  const alDia = useContext(MiniaturasAlDia);
  const [llega, setLlega] = useState(false);
  const [cargada, setCargada] = useState(false);
  const [jugando, setJugando] = useState(false);
  const previo = useRef(estado);
  const timer = useRef(null);
  const videoRef = useRef(null);

  // el fogonazo de llegada: solo cuando pasa de "generando" a terminada mientras la miras
  useEffect(() => {
    const antes = previo.current;
    previo.current = estado;
    if (!TERMINADA.has(antes) && TERMINADA.has(estado) && antes === 'generando') {
      setLlega(true);
      const id = setTimeout(() => setLlega(false), 1100);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [estado]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const src = terminada && alDia ? miniaturaDe(p, tamano === 'grande' ? 320 : 240) : null;
  const fuente = alDia && estado === 'generando' && p.clase === 'clip' && p.fuente ? miniatura(p.fuente, 240) : null;
  const puedeReproducir = terminada && p.clase === 'clip' && p.video;

  const entrar = () => {
    if (!puedeReproducir) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setJugando(true), 120);
  };
  const salir = () => {
    clearTimeout(timer.current);
    setJugando(false);
  };

  const conAviso = terminada && Boolean(p.avisos?.length);
  const pedida = nota === 'regenerando' || nota === 'en-fila';
  const clases = [
    'prod-pieza',
    `prod-pieza--${estado}`,
    `prod-pieza--${tamano}`,
    p.tipo === 'icono' && 'prod-pieza--icono',
    p.clase === 'clip' ? 'prod-pieza--clip' : 'prod-pieza--imagen',
    llega && 'prod-pieza--llega',
    seleccionada && 'prod-pieza--seleccionada',
    nota === 'frenada' && 'prod-pieza--frenada',
    conAviso && 'prod-pieza--con-aviso',
    pedida && `prod-pieza--${nota}`,
  ]
    .filter(Boolean)
    .join(' ');
  const textoExtra = pedida ? (nota === 'en-fila' ? ', en la fila para regenerarse' : ', regenerándose') : conAviso ? ', con un aviso de la revisión' : '';

  return (
    <button
      type="button"
      className={clases}
      data-pieza={p.id}
      onClick={() => onAbrir?.(p.id)}
      onMouseEnter={entrar}
      onMouseLeave={salir}
      onFocus={entrar}
      onBlur={salir}
      aria-label={`${p.titulo}: ${TEXTO[estado] || estado}${textoExtra}`}
      aria-pressed={seleccionada || undefined}
    >
      <span className="prod-pieza__marco" style={p.relacion ? { aspectRatio: p.relacion } : undefined}>
        {src ? (
          <img
            className={`prod-pieza__img${cargada ? ' prod-pieza__img--cargada' : ''}`}
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            draggable="false"
            onLoad={() => setCargada(true)}
          />
        ) : null}
        {src && !cargada ? <span className="prod-pieza__cargando" aria-hidden="true" /> : null}
        {fuente ? <img className="prod-pieza__fuente" src={fuente} alt="" loading="lazy" decoding="async" draggable="false" /> : null}
        {estado === 'generando' ? (
          <span className="prod-pieza__generando" aria-hidden="true">
            <span className="prod-pieza__barrido" />
            <LoaderCircle size={tamano === 'grande' ? 18 : 15} strokeWidth={2.2} className="girando" />
          </span>
        ) : null}
        {estado === 'en-cola' ? (
          <span className="prod-pieza__espera" aria-hidden="true">
            {nota === 'frenada' ? <Hand size={14} strokeWidth={2} /> : <Clock size={14} strokeWidth={2} />}
          </span>
        ) : null}
        {jugando && puedeReproducir ? (
          <video
            ref={videoRef}
            className="prod-pieza__video"
            src={p.video}
            muted
            loop
            autoPlay
            playsInline
            preload="auto"
            disablePictureInPicture
          />
        ) : null}
        <span className="prod-pieza__sombra" aria-hidden="true" />
        <span className="prod-pieza__punto" aria-hidden="true">
          <PuntoEstado estado={estado} />
        </span>
        {pedida ? (
          <span className={`prod-pieza__marca prod-pieza__marca--${nota}`} aria-hidden="true" title={nota === 'en-fila' ? 'En la fila para regenerarse' : 'Regenerándose'}>
            {nota === 'en-fila' ? <Clock size={11} strokeWidth={2.4} /> : <LoaderCircle size={11} strokeWidth={2.4} className="girando" />}
          </span>
        ) : conAviso ? (
          <span className="prod-pieza__marca prod-pieza__marca--aviso" aria-hidden="true" title="La revisión notó algo">
            <ScanEye size={11} strokeWidth={2.4} />
          </span>
        ) : null}
        {terminada && p.clase === 'clip' ? (
          <span className="prod-pieza__dur t-mono">
            <Film size={10} strokeWidth={2.4} aria-hidden="true" />
            {p.duracion ? fmtDuracion(p.duracion) : ''}
          </span>
        ) : null}
        {llega ? <span className="prod-pieza__destello" aria-hidden="true" /> : null}
      </span>
      {mostrarEtiqueta ? <span className="prod-pieza__etiqueta">{p.etiquetaVisible || p.etiqueta}</span> : null}
    </button>
  );
});

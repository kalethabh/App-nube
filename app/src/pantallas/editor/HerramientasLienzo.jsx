// Las herramientas de la vista previa (2026-11-17): una barra vertical a la derecha del video, como en los editores
// profesionales. Zona segura (Meta o TikTok), cuadrícula para centrar, pincel para censurar, velocidad de la vista
// previa y guardar el cuadro actual como imagen. (Los atajos de teclado están arriba, en la barra del editor.)
import { useEffect, useRef, useState } from 'react';
import { Brush, Camera, Gauge, Grid3x3, Move, ScanLine, ZoomIn, ZoomOut } from 'lucide-react';
import { Tooltip, useAvisos } from '../../componentes/index.js';

export const VELOCIDADES = [1, 1.5, 2, 0.5];

const ZONAS = [
  { id: '', texto: 'Sin zona segura' },
  { id: 'meta', texto: 'Meta (Feed y Reels)' },
  { id: 'tiktok', texto: 'TikTok' },
];

function Herramienta({ icono: Icono, texto, activo = false, onClick, children, ...resto }) {
  return (
    <Tooltip texto={texto} lado="izquierda">
      <button type="button" className={`ed-herr__boton${activo ? ' es-activo' : ''}`} aria-label={texto} aria-pressed={activo} onClick={onClick} {...resto}>
        <Icono size={17} strokeWidth={2} aria-hidden="true" />
        {children}
      </button>
    </Tooltip>
  );
}

/** Lo que se dibuja encima del video: la zona segura elegida y la cuadrícula. */
export function GuiasLienzo({ zona, cuadricula }) {
  return (
    <>
      {zona === 'meta' ? (
        <div className="ed-meta" aria-hidden="true">
          <div className="ed-meta__arriba">
            <span>Nombre de la cuenta</span>
          </div>
          <div className="ed-meta__lado">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="ed-meta__abajo">
            <span>Texto del anuncio y botón</span>
          </div>
        </div>
      ) : null}
      {zona === 'tiktok' ? (
        <div className="ed-meta ed-meta--tiktok" aria-hidden="true">
          <div className="ed-meta__arriba">
            <span>Siguiendo · Para ti</span>
          </div>
          <div className="ed-meta__lado">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="ed-meta__abajo">
            <span>Usuario, texto y música</span>
          </div>
        </div>
      ) : null}
      {cuadricula ? (
        <div className="ed-cuadricula" aria-hidden="true">
          <i className="v1" />
          <i className="v2" />
          <i className="h1" />
          <i className="h2" />
          <b className="cv" />
          <b className="ch" />
        </div>
      ) : null}
    </>
  );
}


export function HerramientasLienzo({ slug, playerRef, fps, zona, onZona, cuadricula, onCuadricula, pincel, onPincel, velocidad, onVelocidad, piezaAhora, onEncuadre }) {
  const { aviso } = useAvisos();
  const [menuZona, setMenuZona] = useState(false);
  const caja = useRef(null);

  useEffect(() => {
    if (!menuZona) return undefined;
    const fuera = (e) => !caja.current?.contains(e.target) && setMenuZona(false);
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [menuZona]);

  const guardarCuadro = () => {
    const p = playerRef.current;
    p?.pause();
    const t = (p?.getCurrentFrame() || 0) / fps;
    const a = document.createElement('a');
    a.href = `/api/anuncios/${encodeURIComponent(slug)}/cuadro?t=${t.toFixed(3)}`;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
    aviso({ tipo: 'ok', titulo: 'Cuadro guardado', texto: 'Se descargó como imagen (el video tal cual, sin los textos que agregaste aquí).' });
  };

  // el video de la escena que se ve ahora: acercar, alejar y volver a centrar (también se arrastra con el mouse)
  const encuadre = (cambio, etiqueta) => {
    const p = piezaAhora?.();
    if (!p) {
      aviso({ tipo: 'info', titulo: 'Aquí no se puede', texto: 'En este estilo el video de cada escena va fijo. Mueve los textos, las imágenes y los íconos.' });
      return;
    }
    playerRef.current?.pause();
    const e0 = p.encuadre || { x: 0, y: 0, zoom: 1 };
    onEncuadre(p.pieza, cambio(e0), { etiqueta });
  };

  const siguiente = VELOCIDADES[(VELOCIDADES.indexOf(velocidad) + 1) % VELOCIDADES.length];

  return (
    <div className="ed-herr" role="toolbar" aria-label="Herramientas de la vista previa" aria-orientation="vertical">
      <div className="ed-herr__grupo" ref={caja}>
        <Herramienta icono={ScanLine} texto="Zona segura: lo que tapa la app" activo={Boolean(zona)} onClick={() => setMenuZona((v) => !v)} aria-haspopup="menu" aria-expanded={menuZona} />
        {menuZona ? (
          <div className="ed-herr__menu" role="menu">
            {ZONAS.map((z) => (
              <button
                key={z.id || 'ninguna'}
                type="button"
                role="menuitemradio"
                aria-checked={zona === z.id}
                className={`ed-herr__opcion${zona === z.id ? ' es-activo' : ''}`}
                onClick={() => {
                  onZona(z.id);
                  setMenuZona(false);
                }}
              >
                {z.texto}
              </button>
            ))}
          </div>
        ) : null}
        <Herramienta icono={Grid3x3} texto="Cuadrícula para centrar" activo={cuadricula} onClick={() => onCuadricula(!cuadricula)} />
      </div>
      <span className="ed-herr__separador" aria-hidden="true" />
      <div className="ed-herr__grupo" aria-label="El video de esta escena">
        <Herramienta icono={ZoomIn} texto="Acercar el video de esta escena (o Ctrl/⌘ + rueda)" onClick={() => encuadre((e) => ({ ...e, zoom: Math.min(4, Math.round(e.zoom * 1.1 * 1000) / 1000) }), 'Acercar el video de la escena')} />
        <Herramienta icono={ZoomOut} texto="Alejar el video de esta escena" onClick={() => encuadre((e) => ({ ...e, zoom: Math.max(0.5, Math.round((e.zoom / 1.1) * 1000) / 1000) }), 'Alejar el video de la escena')} />
        <Herramienta icono={Move} texto="Volver a centrar el video de esta escena (arrástralo para moverlo)" onClick={() => encuadre(() => ({ x: 0, y: 0, zoom: 1 }), 'Centrar el video de la escena')} />
      </div>
      <span className="ed-herr__separador" aria-hidden="true" />
      <div className="ed-herr__grupo">
        <Herramienta icono={Brush} texto="Pincel para censurar" activo={pincel} onClick={onPincel} />
        <Herramienta icono={Camera} texto="Guardar este cuadro como imagen" onClick={guardarCuadro} />
      </div>
      <span className="ed-herr__separador" aria-hidden="true" />
      <div className="ed-herr__grupo">
        <Herramienta icono={Gauge} texto={`Velocidad de la vista previa (pasar a ${String(siguiente).replace('.', ',')}×)`} activo={velocidad !== 1} onClick={() => onVelocidad(siguiente)}>
          <span className="ed-herr__valor t-num">{String(velocidad).replace('.', ',')}×</span>
        </Herramienta>
      </div>
    </div>
  );
}

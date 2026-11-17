// EL PINCEL PARA CENSURAR (2026-11-17): con el video en pausa, pintas encima de lo que quieres tapar (un logo, una
// marca, una cara, un texto) y la app lo sigue sola en esa escena (rutas/seguimiento.js → lib/seguir-zona.js, gratis
// en esta PC). Queda una censura difuminada (un texto «caja» que sigue la zona; AnuncioEditado.jsx → Difuminado).
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Brush, Check, Eraser, LoaderCircle, X } from 'lucide-react';
import { Boton, Chip, useAvisos } from '../../componentes/index.js';
import { pedirNuevo } from '../../datos/api.js';

const TAMANOS = [
  { id: 'chico', texto: 'Fino', radio: 0.025 },
  { id: 'medio', texto: 'Medio', radio: 0.045 },
  { id: 'grande', texto: 'Grueso', radio: 0.075 },
];

/**
 * Encima de la vista previa (dentro de .ed-lienzo). `t()` el segundo actual; `alListo({ apariciones, desde, hasta })`
 * con lo seguido; `onCerrar()` sin hacer nada.
 */
export function PincelCensura({ slug, t, alListo, onCerrar, barraEn = null }) {
  const { aviso } = useAvisos();
  const lienzo = useRef(null);
  const caja = useRef(null); // { x0, y0, x1, y1 } en 0..1
  const pintando = useRef(false);
  const ultimo = useRef(null);
  const [tamano, setTamano] = useState('medio');
  const [hayTrazo, setHayTrazo] = useState(false);
  const [siguiendo, setSiguiendo] = useState(false);
  const radio = TAMANOS.find((x) => x.id === tamano).radio;

  // el lienzo del tamaño de la vista previa (nítido en pantallas retina)
  useEffect(() => {
    const c = lienzo.current;
    if (!c) return undefined;
    const ajustar = () => {
      const r = c.getBoundingClientRect();
      const d = window.devicePixelRatio || 1;
      c.width = Math.round(r.width * d);
      c.height = Math.round(r.height * d);
      caja.current = null;
      setHayTrazo(false);
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(c);
    const tecla = (e) => e.key === 'Escape' && !siguiendo && onCerrar();
    window.addEventListener('keydown', tecla);
    return () => {
      ro.disconnect();
      window.removeEventListener('keydown', tecla);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const punto = (e) => {
    const r = lienzo.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const pintar = (p) => {
    const c = lienzo.current;
    const g = c.getContext('2d');
    const rx = radio * c.width;
    g.fillStyle = 'rgba(157, 246, 38, 0.45)';
    g.strokeStyle = 'rgba(157, 246, 38, 0.45)';
    g.lineCap = 'round';
    g.lineWidth = rx * 2;
    const a = ultimo.current;
    if (a) {
      g.beginPath();
      g.moveTo(a.x * c.width, a.y * c.height);
      g.lineTo(p.x * c.width, p.y * c.height);
      g.stroke();
    } else {
      g.beginPath();
      g.arc(p.x * c.width, p.y * c.height, rx, 0, Math.PI * 2);
      g.fill();
    }
    ultimo.current = p;
    // lo pintado (con el grosor del pincel)
    const ry = (radio * c.width) / c.height;
    const k = caja.current || { x0: 1, y0: 1, x1: 0, y1: 0 };
    caja.current = { x0: Math.min(k.x0, p.x - radio), y0: Math.min(k.y0, p.y - ry), x1: Math.max(k.x1, p.x + radio), y1: Math.max(k.y1, p.y + ry) };
    setHayTrazo(true);
  };

  const borrar = () => {
    const c = lienzo.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    caja.current = null;
    setHayTrazo(false);
  };

  const censurar = async () => {
    const k = caja.current;
    if (!k) return;
    const x0 = Math.max(0, k.x0);
    const y0 = Math.max(0, k.y0);
    const x1 = Math.min(1, k.x1);
    const y1 = Math.min(1, k.y1);
    setSiguiendo(true);
    try {
      const r = await pedirNuevo(`/api/anuncios/${encodeURIComponent(slug)}/censura/seguir`, {
        metodo: 'POST',
        cuerpo: { t: t(), x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 },
      });
      alListo(r);
      aviso({
        tipo: 'ok',
        titulo: 'Censurado',
        texto: r.quieta
          ? 'Esa zona casi no tiene dibujo: la dejé fija durante la escena.'
          : `Lo sigo de ${r.desde.toFixed(1).replace('.', ',')} s a ${r.hasta.toFixed(1).replace('.', ',')} s${r.perdida === 'perdida' ? ' (ahí deja de verse)' : ''}. Muévelo o alárgalo en la línea de tiempo si hace falta.`,
      });
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude seguirlo', texto: e?.message || 'Vuelve a intentarlo.' });
      setSiguiendo(false);
    }
  };

  const barra = (
      <div className="ed-pincel__barra">
        <span className="ed-pincel__ayuda">
          {siguiendo ? (
            <>
              <LoaderCircle size={14} strokeWidth={2.2} className="girando" aria-hidden="true" /> Buscándolo en la escena…
            </>
          ) : (
            <>
              <Brush size={14} strokeWidth={2.2} aria-hidden="true" /> Pinta encima del video lo que quieres censurar
            </>
          )}
        </span>
        <div className="ed-pincel__tamanos" role="group" aria-label="Grosor del pincel">
          {TAMANOS.map((x) => (
            <Chip key={x.id} tamano="chico" activo={tamano === x.id} onClick={() => setTamano(x.id)} disabled={siguiendo}>
              {x.texto}
            </Chip>
          ))}
        </div>
        <div className="ed-pincel__botones">
          <Boton variante="fantasma" tamano="chico" icono={Eraser} onClick={borrar} disabled={!hayTrazo || siguiendo}>
            Borrar
          </Boton>
          <Boton variante="secundario" tamano="chico" icono={X} onClick={onCerrar} disabled={siguiendo}>
            Cancelar
          </Boton>
          <Boton variante="primario" tamano="chico" icono={Check} onClick={censurar} disabled={!hayTrazo} cargando={siguiendo}>
            Censurar
          </Boton>
        </div>
      </div>
  );

  return (
    <div className="ed-pincel" role="dialog" aria-label="Pincel para censurar">
      <canvas
        ref={lienzo}
        className="ed-pincel__lienzo"
        onPointerDown={(e) => {
          if (siguiendo) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          pintando.current = true;
          ultimo.current = null;
          pintar(punto(e));
        }}
        onPointerMove={(e) => pintando.current && pintar(punto(e))}
        onPointerUp={() => {
          pintando.current = false;
          ultimo.current = null;
        }}
        style={{ cursor: siguiendo ? 'progress' : 'crosshair' }}
      />
      {barraEn ? createPortal(barra, barraEn) : barra}
    </div>
  );
}

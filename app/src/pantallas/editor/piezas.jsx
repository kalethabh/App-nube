// Piezas chicas que solo usa el editor (no hay equivalentes en src/componentes).
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// ---------------------------------------------------------------- medir un elemento

export function useAncho(ref) {
  const [ancho, setAncho] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setAncho(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return ancho;
}

// ---------------------------------------------------------------- un solo reloj para todas las muestras animadas

const oyentes = new Set();
let raf = 0;
let ultimo = 0;
function vuelta(ahora) {
  if (ahora - ultimo >= 32) {
    ultimo = ahora;
    for (const f of oyentes) f(ahora);
  }
  raf = oyentes.size ? requestAnimationFrame(vuelta) : 0;
}

/** performance.now() que se actualiza ~30 veces por segundo mientras `activo` */
export function useAhora(activo = true) {
  const [ahora, setAhora] = useState(() => performance.now());
  useEffect(() => {
    if (!activo) return undefined;
    oyentes.add(setAhora);
    if (!raf) raf = requestAnimationFrame(vuelta);
    return () => {
      oyentes.delete(setAhora);
    };
  }, [activo]);
  return ahora;
}

/** true mientras el elemento está a la vista (para no animar lo que no se ve) */
export function useVisible(ref) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return visible;
}

// ---------------------------------------------------------------- deslizador

/**
 * <Deslizador etiqueta="Volumen de la voz" valor={v} min={0} max={1} onCambio={...} porDefecto={1} />
 * Doble clic vuelve al valor por defecto (la marquita sobre la pista).
 */
export function Deslizador({ etiqueta, valor, min = 0, max = 1, paso = 0.01, onCambio, onSoltar, formato = (v) => `${Math.round(v * 100)} %`, porDefecto, icono: Icono, deshabilitado = false, ayuda, extra }) {
  const id = useId();
  const v = Math.max(min, Math.min(max, Number(valor) || 0));
  const pct = ((v - min) / (max - min)) * 100;
  const marca = porDefecto !== undefined && porDefecto !== null ? ((porDefecto - min) / (max - min)) * 100 : null;
  return (
    <div className={`ed-deslizador${deshabilitado ? ' es-deshabilitado' : ''}`}>
      <div className="ed-deslizador__cabecera">
        <label htmlFor={id} className="ed-deslizador__etiqueta">
          {Icono ? <Icono size={14} strokeWidth={2} aria-hidden="true" /> : null}
          {etiqueta}
        </label>
        {extra}
        <span className="ed-deslizador__valor t-num">{formato(v)}</span>
      </div>
      <div className="ed-deslizador__pista" style={{ '--pct': `${pct}%` }}>
        {marca !== null ? <span className="ed-deslizador__marca" style={{ left: `${marca}%` }} aria-hidden="true" /> : null}
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={paso}
          value={v}
          disabled={deshabilitado}
          aria-valuetext={formato(v)}
          onChange={(e) => onCambio?.(Number(e.target.value))}
          onPointerUp={() => onSoltar?.()}
          onKeyUp={() => onSoltar?.()}
          onDoubleClick={() => porDefecto !== undefined && onCambio?.(porDefecto)}
        />
      </div>
      {ayuda ? <p className="ed-deslizador__ayuda">{ayuda}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------- globo flotante anclado a un elemento

/**
 * <Globo abierto ancla={rect | elemento} onCerrar={...} lado="arriba">…</Globo>
 * Se cierra con Escape o con un clic afuera. Se acomoda solo para no salirse de la ventana.
 */
export function Globo({ abierto, ancla, onCerrar, lado = 'abajo', ancho = 320, className = '', children, etiqueta }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;

  useLayoutEffect(() => {
    if (!abierto || !ancla) return;
    const r = typeof ancla.getBoundingClientRect === 'function' ? ancla.getBoundingClientRect() : ancla;
    const g = ref.current?.getBoundingClientRect();
    const alto = g?.height || 160;
    const m = 10;
    let l = lado;
    if (l === 'arriba' && r.top - alto - m < 8) l = 'abajo';
    else if (l === 'abajo' && r.bottom + alto + m > window.innerHeight - 8) l = 'arriba';
    const top = l === 'arriba' ? r.top - alto - m : r.bottom + m;
    const centro = r.left + r.width / 2;
    const left = Math.max(10, Math.min(window.innerWidth - ancho - 10, centro - ancho / 2));
    setPos({ top, left, lado: l, flecha: Math.max(18, Math.min(ancho - 18, centro - left)) });
  }, [abierto, ancla, lado, ancho]);

  useEffect(() => {
    if (!abierto) return undefined;
    const alTeclado = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        cerrarRef.current?.();
      }
    };
    const alTocar = (e) => {
      if (ref.current && !ref.current.contains(e.target)) cerrarRef.current?.();
    };
    document.addEventListener('keydown', alTeclado, true);
    const id = setTimeout(() => document.addEventListener('pointerdown', alTocar, true), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('keydown', alTeclado, true);
      document.removeEventListener('pointerdown', alTocar, true);
    };
  }, [abierto]);

  if (!abierto) return null;
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={etiqueta}
      className={`ed-globo ed-globo--${pos?.lado || lado} ${className}`}
      style={{ width: ancho, ...(pos ? { top: pos.top, left: pos.left, '--flecha': `${pos.flecha}px` } : { top: -9999, left: -9999, visibility: 'hidden' }) }}
    >
      {children}
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------- forma de onda

/**
 * Barras de una forma de onda en un canvas.
 *   datos      { picos, porSeg, duracion } (ondas.js)
 *   tAudio     segundo del audio que cae en el borde izquierdo
 *   segundos   cuántos segundos de audio entran en el ancho
 *   repetir    si el audio es más corto, vuelve a empezar
 *   nivel      (opcional) t -> 0..1: achica las barras según el volumen en ese segundo de la línea
 *   tLinea     segundo de la línea de tiempo que cae en el borde izquierdo (para `nivel`)
 */
export function Onda({ datos, tAudio = 0, segundos, ancho, alto, color = '#34d39a', repetir = false, espejo = true, opacidad = 1, nivel, tLinea = 0 }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c || !datos || !(ancho > 0) || !(segundos > 0)) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.min(8192, Math.round(ancho * dpr)));
    const h = Math.max(1, Math.round(alto * dpr));
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.globalAlpha = opacidad;
    const { picos, porSeg } = datos;
    const n = picos.length;
    const barra = Math.max(1, Math.round(2 * dpr));
    const paso = barra + Math.max(1, Math.round(1 * dpr));
    const segPorPx = segundos / w;
    for (let x = 0; x < w; x += paso) {
      const a = Math.floor((tAudio + x * segPorPx) * porSeg);
      const z = Math.max(a + 1, Math.ceil((tAudio + (x + paso) * segPorPx) * porSeg));
      let pico = 0;
      let suma = 0;
      let cuenta = 0;
      for (let i = a; i < z; i++) {
        let k = i;
        if (repetir && n) k = ((i % n) + n) % n;
        if (k < 0 || k >= n) continue;
        if (picos[k] > pico) pico = picos[k];
        suma += picos[k];
        cuenta += 1;
      }
      // mitad pico, mitad promedio: con zoom lejano se sigue viendo la dinámica
      let m = cuenta ? pico * 0.5 + (suma / cuenta) * 0.5 : 0;
      if (!repetir && a >= n) break;
      if (nivel) m *= nivel(tLinea + (x + paso / 2) * segPorPx);
      const bh = Math.max(dpr, m * (h - 2 * dpr));
      const y = espejo ? (h - bh) / 2 : h - bh - dpr;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, barra, bh, barra / 2);
        ctx.fill();
      } else ctx.fillRect(x, y, barra, bh);
    }
  }, [datos, tAudio, segundos, ancho, alto, color, repetir, espejo, opacidad, nivel, tLinea]);
  return <canvas ref={ref} className="ed-onda" style={{ width: ancho, height: alto }} aria-hidden="true" />;
}

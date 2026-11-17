// Las piezas que comparten todas las plantillas de imagen: el texto que se achica solo hasta entrar en su caja, el
// titular grande, la letra a mano, la foto del producto (recortada o sobre una tarjeta), las flechas dibujadas a mano,
// el sticker girado, la franja de oferta, la línea legal, las estrellas, la marca de verificado y la escena (o, si
// todavía no llegó, un fondo de espera sin texto de la escena).
//
// Reglas de diseño (del análisis de Grüns, Sonvital, Amua y BlockFusion): una idea por imagen; el foco ocupa del 50 al
// 70 % del cuadro; un fondo de un color fuerte o una foto limpia; titular enorme y condensado, de 2 a 4 palabras por
// línea, a todo el ancho; como mucho 2 tipografías (la gruesa y la de mano); el producto real y grande; un solo sticker
// girado como acento de oferta; la oferta nunca en el titular de una imagen de dolor (solo en una franja abajo); la
// línea legal, chiquita.
import { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, Img, useVideoConfig } from 'remotion';

// ---------------------------------------------------------------- colores

const hexARgb = (hex) => {
  const h = String(hex || '').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [0, 0, 0];
};
const rgbAHex = (r, g, b) => `#${[r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`;

/** Luminancia relativa (WCAG). */
export function luminancia(hex) {
  const [r, g, b] = hexARgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Blanco o casi negro: el que más contrasta sobre ese fondo. */
export const tintaSobre = (hex) => (luminancia(hex) > 0.36 ? '#141414' : '#FFFFFF');
/** Mezcla dos colores (t = 0 da a, t = 1 da b). */
export function mezclar(a, b, t) {
  const x = hexARgb(a);
  const y = hexARgb(b);
  return rgbAHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}

/** La paleta de una imagen a partir del kit de marca (2 colores). */
export function paleta(kit = {}) {
  const primario = /^#[0-9a-f]{6}$/i.test(kit.primario || '') ? kit.primario : '#1F6F4A';
  const secundario = /^#[0-9a-f]{6}$/i.test(kit.secundario || '') ? kit.secundario : '#F2C14E';
  return {
    primario,
    secundario,
    sobrePrimario: tintaSobre(primario),
    sobreSecundario: tintaSobre(secundario),
    suave: mezclar(primario, '#FFFFFF', 0.9),
    crema: '#FBF7EF',
    tinta: '#141414',
    // un tono oscuro de la marca para textos sobre fondos claros
    profundo: luminancia(primario) > 0.25 ? mezclar(primario, '#000000', 0.55) : primario,
  };
}

// ---------------------------------------------------------------- tipografías

export const FUENTES_TITULO = { Anton: 'Anton', 'Bebas Neue': 'Bebas Neue', 'Archivo Black': 'Archivo Black' };
export const FUENTES_MANO = { Caveat: 'Caveat', 'Permanent Marker': 'Permanent Marker' };
export const fuenteTitulo = (kit) => `'${FUENTES_TITULO[kit?.fuenteTitulo] || 'Anton'}', 'Inter', sans-serif`;
export const fuenteMano = (kit) => `'${FUENTES_MANO[kit?.fuenteScript] || 'Caveat'}', cursive`;
export const FUENTE_TEXTO = "'Inter', sans-serif";
/** Bebas y Anton son condensadas y se leen mejor un poco más grandes que Archivo Black. */
export const escalaTitulo = (kit) => (kit?.fuenteTitulo === 'Archivo Black' ? 0.78 : 1);

// ---------------------------------------------------------------- el texto que se achica hasta entrar

/**
 * Un texto que ocupa toda su caja (el padre le da el tamaño) y se achica solo hasta que entra entero, sin cortar
 * palabras (las palabras largas en español nunca se parten: si una no entra a lo ancho, baja el tamaño).
 *   max / min    tamaño de letra en px (búsqueda binaria entre los dos)
 *   alineado     'center' | 'left' | 'right'
 *   vertical     'center' | 'start' | 'end'
 */
export function Ajustado({ children, max = 160, min = 12, alineado = 'center', vertical = 'center', estilo = {}, balance = true, className }) {
  const caja = useRef(null);
  const texto = useRef(null);
  useLayoutEffect(() => {
    const c = caja.current;
    const t = texto.current;
    if (!c || !t) return;
    const ancho = c.clientWidth;
    const alto = c.clientHeight;
    const cabe = (s) => {
      t.style.fontSize = `${s}px`;
      return t.scrollWidth <= t.clientWidth + 0.5 && t.scrollWidth <= ancho + 0.5 && t.getBoundingClientRect().height <= alto + 0.5;
    };
    let lo = Math.floor(min);
    let hi = Math.ceil(max);
    let mejor = lo;
    while (lo <= hi) {
      const m = Math.floor((lo + hi) / 2);
      if (cabe(m)) {
        mejor = m;
        lo = m + 1;
      } else hi = m - 1;
    }
    t.style.fontSize = `${mejor}px`;
  });
  return (
    <div
      ref={caja}
      className={className}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: vertical === 'start' ? 'flex-start' : vertical === 'end' ? 'flex-end' : 'center', overflow: 'hidden', minHeight: 0 }}
    >
      <div
        ref={texto}
        style={{
          width: '100%',
          textAlign: alineado,
          overflowWrap: 'normal',
          wordBreak: 'keep-all',
          hyphens: 'manual',
          whiteSpace: 'pre-line',
          ...(balance ? { textWrap: 'balance' } : {}),
          // las tildes de las mayúsculas (Á, É, Ó) quedan por encima de la línea: un poco de aire arriba para que no se corten
          ...(estilo.textTransform === 'uppercase' ? { paddingTop: '0.14em' } : {}),
          ...estilo,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** El titular: enorme, condensado, en mayúsculas, a todo el ancho de su caja. */
export function Titular({ texto, kit, color, max = 190, min = 28, alineado = 'center', vertical = 'center', resaltado = null, sombra = false }) {
  const e = escalaTitulo(kit);
  // una palabra entre *asteriscos* va con el color de acento (resaltado)
  const partes = String(texto || '').split(/(\*[^*]+\*)/g).filter(Boolean);
  // apretado como en los anuncios que funcionan, pero con aire si hay tildes (la Á de abajo no toca la línea de arriba)
  const conTildes = /[ÁÉÍÓÚÑÜáéíóúñü]/.test(String(texto || ''));
  return (
    <Ajustado
      max={max * e}
      min={min}
      alineado={alineado}
      vertical={vertical}
      estilo={{ fontFamily: fuenteTitulo(kit), color, textTransform: 'uppercase', lineHeight: conTildes ? 1.06 : 0.95, letterSpacing: kit?.fuenteTitulo === 'Bebas Neue' ? '0.01em' : '0', ...(sombra ? { textShadow: '0 6px 24px rgba(0,0,0,0.35)' } : {}) }}
    >
      {partes.map((p, i) => (p.startsWith('*') && p.endsWith('*') ? <span key={i} style={{ color: resaltado || color }}>{p.slice(1, -1)}</span> : <span key={i}>{p}</span>))}
    </Ajustado>
  );
}

/** La letra a mano (Caveat o Permanent Marker), girada un poco. */
export function Mano({ texto, kit, color, max = 80, min = 18, alineado = 'center', giro = -3, vertical = 'center' }) {
  return (
    <div style={{ width: '100%', height: '100%', transform: `rotate(${giro}deg)` }}>
      <Ajustado max={max} min={min} alineado={alineado} vertical={vertical} estilo={{ fontFamily: fuenteMano(kit), color, lineHeight: 1.02, fontWeight: kit?.fuenteScript === 'Permanent Marker' ? 400 : 700 }}>
        {texto}
      </Ajustado>
    </div>
  );
}

/** Texto común (Inter), para lo que imita una pantalla: notas, chats, tuits, comentarios. */
export function Texto({ texto, color = '#141414', max = 48, min = 14, peso = 500, alineado = 'left', vertical = 'start', alto = 1.28, balance = false }) {
  return (
    <Ajustado max={max} min={min} alineado={alineado} vertical={vertical} balance={balance} estilo={{ fontFamily: FUENTE_TEXTO, color, fontWeight: peso, lineHeight: alto }}>
      {texto}
    </Ajustado>
  );
}

// ---------------------------------------------------------------- el producto

/**
 * La foto real del producto. Recortada (PNG sin fondo): con su sombra. Con fondo: sobre una tarjeta blanca con una
 * base (así se ve limpia aunque la foto tenga su fondo). Ocupa toda su caja.
 */
export function Producto({ producto, tarjeta = 'auto', base = true, giro = 0, sombra = true, fondoTarjeta = '#FFFFFF' }) {
  if (!producto?.url) return null;
  const conTarjeta = tarjeta === true || (tarjeta === 'auto' && !producto.recortado);
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: giro ? `rotate(${giro}deg)` : undefined }}>
      {base ? (
        <div style={{ position: 'absolute', left: '14%', right: '14%', bottom: conTarjeta ? '1%' : '2%', height: '7%', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(0,0,0,0.32), rgba(0,0,0,0))' }} />
      ) : null}
      {conTarjeta ? (
        <div style={{ position: 'relative', height: '92%', aspectRatio: '1 / 1', maxWidth: '100%', borderRadius: 34, background: fondoTarjeta, boxShadow: sombra ? '0 18px 50px rgba(0,0,0,0.22)' : 'none', padding: '6%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <Img src={producto.url} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 18 }} />
        </div>
      ) : (
        <Img src={producto.url} style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'contain', filter: sombra ? 'drop-shadow(0 22px 30px rgba(0,0,0,0.28))' : 'none' }} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- la escena

/** La escena que hizo el modelo de imagen (sin texto), a sangre; si todavía no llegó, un fondo de espera. */
export function Escena({ escena, kit, posicion = 'center' }) {
  const p = paleta(kit);
  if (escena?.url) return <Img src={escena.url} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: posicion }} />;
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${mezclar(p.primario, '#ffffff', 0.72)}, ${mezclar(p.secundario, '#ffffff', 0.78)})` }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.35, backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.7) 0 18px, rgba(255,255,255,0) 18px 44px)' }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 26px', borderRadius: 999, background: 'rgba(255,255,255,0.85)', fontFamily: FUENTE_TEXTO, fontWeight: 600, fontSize: 30, color: '#333' }}>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
        {escena?.espera || 'Creando la escena…'}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- dibujado a mano

/**
 * Una flecha dibujada a mano de (x1,y1) a (x2,y2) en px del lienzo, con curva (curva > 0 hacia un lado, < 0 al otro).
 * Va en un SVG que cubre todo el lienzo.
 */
export function Flecha({ x1, y1, x2, y2, curva = 0.25, color = '#141414', grosor = 7, punta = 26 }) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cx = mx - dy * curva;
  const cy = my + dx * curva;
  // la punta: dos trazos desde el final, en la dirección de la tangente
  const tx = x2 - cx;
  const ty = y2 - cy;
  const l = Math.hypot(tx, ty) || 1;
  const ux = tx / l;
  const uy = ty / l;
  const ang = 0.5;
  const p1 = [x2 - punta * (ux * Math.cos(ang) - uy * Math.sin(ang)), y2 - punta * (uy * Math.cos(ang) + ux * Math.sin(ang))];
  const p2 = [x2 - punta * (ux * Math.cos(-ang) - uy * Math.sin(-ang)), y2 - punta * (uy * Math.cos(-ang) + ux * Math.sin(-ang))];
  return (
    <g fill="none" stroke={color} strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round">
      <path d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`} />
      <path d={`M ${p1[0]} ${p1[1]} L ${x2} ${y2} L ${p2[0]} ${p2[1]}`} />
    </g>
  );
}

/** El lienzo de las flechas: un SVG del tamaño del cuadro, encima de todo y sin capturar nada. */
export function CapaDibujo({ children }) {
  const { width, height } = useVideoConfig();
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {children}
    </svg>
  );
}

/** Un subrayado a mano (bajo un texto). */
export function Subrayado({ color, grosor = 10 }) {
  return (
    <svg viewBox="0 0 300 24" preserveAspectRatio="none" style={{ width: '100%', height: 24, display: 'block' }}>
      <path d="M4 16 C 60 6, 140 22, 296 9" fill="none" stroke={color} strokeWidth={grosor} strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------- sticker, franja, legal

const estallido = (n = 18, r1 = 50, r2 = 43) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 ? r2 : r1;
    const a = (Math.PI * i) / n - Math.PI / 2;
    return `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`;
  }).join(' ');

/** El sticker girado (uno solo por imagen, como acento de la oferta): estallido, círculo o cinta. */
export function Sticker({ texto, kit, tam = 260, giro = -12, estilo }) {
  const p = paleta(kit);
  const forma = estilo || kit?.sticker || 'estallido';
  const fondo = p.secundario;
  const tinta = p.sobreSecundario;
  if (forma === 'cinta') {
    return (
      <div style={{ transform: `rotate(${giro}deg)`, background: fondo, color: tinta, padding: `${tam * 0.08}px ${tam * 0.16}px`, boxShadow: '0 10px 26px rgba(0,0,0,0.25)', borderRadius: 10, width: tam * 1.4, height: tam * 0.42, boxSizing: 'border-box' }}>
        <Ajustado max={tam * 0.3} min={14} estilo={{ fontFamily: fuenteTitulo(kit), textTransform: 'uppercase', lineHeight: 0.95 }}>
          {texto}
        </Ajustado>
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', width: tam, height: tam, transform: `rotate(${giro}deg)`, filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.28))' }}>
      <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0 }}>
        {forma === 'circulo' ? <circle cx="50" cy="50" r="49" fill={fondo} /> : <polygon points={estallido()} fill={fondo} />}
        <circle cx="50" cy="50" r={forma === 'circulo' ? 43 : 38} fill="none" stroke={tinta} strokeOpacity="0.35" strokeWidth="1.2" strokeDasharray="2 2.4" />
      </svg>
      <div style={{ position: 'absolute', left: '18%', right: '18%', top: '22%', bottom: '22%' }}>
        <Ajustado max={tam * 0.3} min={12} estilo={{ fontFamily: fuenteTitulo(kit), color: tinta, textTransform: 'uppercase', lineHeight: 0.92 }}>
          {texto}
        </Ajustado>
      </div>
    </div>
  );
}

/** La franja de la oferta (siempre abajo; nunca en el titular de una imagen de dolor). */
export function FranjaOferta({ texto, kit, alto = 110, invertida = false }) {
  const p = paleta(kit);
  if (!texto) return null;
  const fondo = invertida ? p.tinta : p.secundario;
  return (
    <div style={{ height: alto, width: '100%', background: fondo, color: tintaSobre(fondo), display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 48px', boxSizing: 'border-box', flexShrink: 0 }}>
      <Ajustado max={alto * 0.48} min={14} estilo={{ fontFamily: fuenteTitulo(kit), textTransform: 'uppercase', letterSpacing: '0.02em' }}>
        {texto}
      </Ajustado>
    </div>
  );
}

/** La línea legal: chiquita. */
export function Legal({ texto, color = 'rgba(0,0,0,0.55)', alto = 30 }) {
  if (!texto) return null;
  return (
    <div style={{ height: alto, width: '100%', flexShrink: 0, padding: '0 40px', boxSizing: 'border-box' }}>
      <Ajustado max={17} min={9} estilo={{ fontFamily: FUENTE_TEXTO, color, fontWeight: 500 }}>
        {texto}
      </Ajustado>
    </div>
  );
}

/** Una etiqueta tipo píldora (ANTES / DESPUÉS / DÍA 7). */
export function Pildora({ texto, fondo = '#FFFFFF', color = '#141414', kit, alto = 70, ancho = 260 }) {
  return (
    <div style={{ height: alto, width: ancho, borderRadius: 999, background: fondo, color, padding: '0 22px', boxSizing: 'border-box', boxShadow: '0 8px 22px rgba(0,0,0,0.22)' }}>
      <Ajustado max={alto * 0.62} min={12} estilo={{ fontFamily: fuenteTitulo(kit), textTransform: 'uppercase', letterSpacing: '0.03em', lineHeight: 1 }}>
        {texto}
      </Ajustado>
    </div>
  );
}

// ---------------------------------------------------------------- estrellas, verificado, logo

export function Estrellas({ n = 5, tam = 34, color = '#F5B301' }) {
  return (
    <div style={{ display: 'flex', gap: tam * 0.12 }}>
      {Array.from({ length: Math.max(0, Math.min(5, Math.round(n))) }, (_, i) => (
        <svg key={i} width={tam} height={tam} viewBox="0 0 24 24">
          <path d="M12 2.2l2.95 6.3 6.85.75-5.1 4.65 1.4 6.8L12 17.3l-6.1 3.4 1.4-6.8-5.1-4.65 6.85-.75z" fill={color} />
        </svg>
      ))}
    </div>
  );
}

export function Verificado({ tam = 34, color = '#1D9BF0' }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path d="M12 1.5l2.4 1.8 3-.2 1 2.8 2.6 1.5-.6 2.9 1.4 2.7-2.1 2.1-.2 3-2.9.6-1.8 2.4-2.8-1-2.8 1-1.8-2.4-2.9-.6-.2-3-2.1-2.1 1.4-2.7-.6-2.9L5.6 5.9l1-2.8 3 .2z" fill={color} />
      <path d="M7.6 12.3l3 3 6-6.2" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** El logo real de la marca, si el lote lo trae (arriba a la izquierda o donde lo pongan). */
export function Logo({ logo, alto = 70 }) {
  if (!logo?.url) return null;
  return <Img src={logo.url} style={{ height: alto, width: 'auto', maxWidth: 260, objectFit: 'contain' }} />;
}

/** Un fondo de color con un brillo suave (para que el color fuerte no se vea plano). */
export function FondoColor({ color }) {
  return (
    <AbsoluteFill style={{ background: color }}>
      <AbsoluteFill style={{ background: 'radial-gradient(120% 80% at 50% 38%, rgba(255,255,255,0.16), rgba(255,255,255,0) 60%)' }} />
    </AbsoluteFill>
  );
}

/** El alto de las bandas de seguridad del 9:16 (Instagram y TikTok tapan arriba y abajo). */
export function margenes(formato) {
  if (formato === '9:16') return { arriba: 0.11, abajo: 0.13 };
  if (formato === '4:5') return { arriba: 0.045, abajo: 0.04 };
  return { arriba: 0.045, abajo: 0.035 };
}

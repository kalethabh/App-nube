// Familia «Ángulos ganadores» (2): CLONES de anuncios validados de la categoría, con su misma composición y su misma
// tipografía; solo cambian la paleta (el kit de marca) y el producto. Ninguno lleva oferta: atacan directo el dolor,
// el beneficio principal o el deseo central, casi siempre con el tiempo de transformación.
// (referencia interna: .claude/skills/anuncios-imagen-ads/referencias-ganadoras.md)
//
//   etapas-neon          3 siluetas de neón que crecen (Etapa 1/2/3), «Bye bye» + el dolor
//   antes-despues-plazo  antes y después en blanco y negro, titular + plazo en color, producto al centro en un pedestal
//   dos-mitades          fondo partido en 2 colores (problema | resultado), titular que cambia de color en la mitad
//   rotulos-anatomia     «¿Tu X todavía se ve así?», ahora → después de N días, rótulos con flechas y franja de íconos
//   estado-vs-estado     «BARRIGA HINCHADA | BARRIGA DRENADA», dos figuras ilustradas y el producto en medio
//   cuadricula-tiempo    2×2 (Antes / 24 horas / 1 semana / 4 semanas) y el producto grande al lado
//   beneficios-lados     antes y después con 4 íconos de dolor a la izquierda y 4 de beneficio a la derecha
//   dias-producto        fondo blanco, la marca arriba, Día 1 / 14 / 30 y el producto abajo al centro
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { Ajustado, CapaDibujo, Escena, Flecha, Legal, Mano, Producto, Titular, fuenteTitulo, luminancia, margenes, mezclar, paleta } from './base.jsx';
import { Icono, iconoPara } from './iconos.jsx';

export const FUENTE_POP = "'Poppins', 'Inter', sans-serif";
export const FUENTE_SERIF = "'DM Serif Display', Georgia, serif";

function zona(H, formato) {
  const m = margenes(formato);
  return { top: H * m.arriba, bottom: H - H * m.abajo, alto: H - H * m.arriba - H * m.abajo };
}
const neon = (p) => (luminancia(p.secundario) > 0.25 ? p.secundario : mezclar(p.secundario, '#FFFFFF', 0.45));
/** Un color de acento que se lee sobre oscuro. */
const acentoClaro = (p) => (luminancia(p.secundario) > 0.3 ? p.secundario : mezclar(p.secundario, '#FFFFFF', 0.5));
/** Un color de acento que se lee sobre blanco. */
const acentoOscuro = (p) => (luminancia(p.primario) < 0.35 ? p.primario : p.profundo);

/** Un texto en Poppins (la letra redonda y gruesa de Sonvital, Grüns y Muna). */
function Pop({ texto, color = '#141414', max = 90, min = 12, peso = 800, alineado = 'center', mayus = false, alto = 1.04, vertical = 'center', espacio = '-0.01em', balance = true }) {
  return (
    <Ajustado max={max} min={min} alineado={alineado} vertical={vertical} balance={balance} estilo={{ fontFamily: FUENTE_POP, fontWeight: peso, color, lineHeight: alto, letterSpacing: espacio, ...(mayus ? { textTransform: 'uppercase' } : {}) }}>
      {texto}
    </Ajustado>
  );
}

// ---------------------------------------------------------------- etapas en neón (Muna «Etapa 1/2/3»)

export function EtapasNeon({ t, kit, producto, escena, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const z = zona(H, formato);
  const vertical = formato === '9:16';
  const luz = neon(p);
  const brillo = `drop-shadow(0 0 10px ${luz}) drop-shadow(0 0 24px ${mezclar(luz, '#000000', 0.25)})`;
  const arriba = z.alto * (vertical ? 0.07 : 0.1);
  const tit = z.alto * (vertical ? 0.12 : 0.15);
  const figTop = z.top + arriba + tit;
  const figAlto = z.bottom - figTop - (vertical ? z.alto * 0.2 : 20);
  const etapas = (t.etapas || []).filter(Boolean).slice(0, 3);
  const pos = [
    [0.22, 0.56],
    [0.5, 0.68],
    [0.8, 0.95],
  ];
  const prod = W * (vertical ? 0.22 : 0.17);
  return (
    <AbsoluteFill style={{ background: '#060607' }}>
      <div style={{ position: 'absolute', left: 60, right: 60, top: z.top, height: arriba }}>
        <Mano texto={t.arriba} kit={kit} color="#FFFFFF" max={130} giro={-1} />
      </div>
      <div style={{ position: 'absolute', left: 30, right: 30, top: z.top + arriba, height: tit, filter: brillo }}>
        <Titular texto={t.titular} kit={kit} color={luz} max={200} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: figTop, height: figAlto, overflow: 'hidden', mixBlendMode: escena?.url ? 'screen' : 'normal' }}>
        <Escena escena={escena} kit={kit} posicion="center 60%" />
      </div>
      {etapas.map((e, i) => (
        <div key={i} style={{ position: 'absolute', left: W * pos[i][0] - 130, width: 260, top: figTop + figAlto * pos[i][1] - 60, height: 64 }}>
          <Ajustado max={58} min={14} estilo={{ fontFamily: fuenteTitulo(kit), color: luz, textTransform: 'uppercase', filter: `drop-shadow(0 0 6px ${mezclar(luz, '#000000', 0.3)})` }}>
            {e}
          </Ajustado>
        </div>
      ))}
      {t.conProducto !== false ? (
        <div style={{ position: 'absolute', left: 26, top: vertical ? z.bottom - z.alto * 0.19 : z.bottom - prod * 1.25, width: prod, height: prod * 1.2, filter: `drop-shadow(0 0 26px ${mezclar(luz, '#000000', 0.35)})` }}>
          <Producto producto={producto} base={false} tarjeta={producto?.recortado ? false : true} fondoTarjeta="#141416" />
        </div>
      ) : null}
      {t.caja ? (
        <div style={{ position: 'absolute', left: prod + 46, width: W * 0.3, top: vertical ? z.bottom - z.alto * 0.17 : z.bottom - prod * 1.05, height: prod * 0.8, border: `3px solid ${mezclar(luz, '#000000', 0.25)}`, borderRadius: 22, padding: '10px 20px', boxSizing: 'border-box', boxShadow: `0 0 18px ${mezclar(luz, '#000000', 0.6)}` }}>
          <Pop texto={t.caja} color="#FFFFFF" max={46} peso={800} mayus />
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - 28 }}>
        <Legal texto={t.legal} color="rgba(255,255,255,0.5)" />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- antes y después con plazo (Sonvital, piernas en B/N)

export function AntesDespuesPlazo({ t, kit, producto, escena, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const z = zona(H, formato);
  const vertical = formato === '9:16';
  const acento = acentoClaro(p);
  const tit = z.alto * (vertical ? 0.16 : 0.2);
  const prod = W * (vertical ? 0.36 : 0.3);
  return (
    <AbsoluteFill style={{ background: '#0E0E0E' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, filter: 'grayscale(1) contrast(1.05)' }}>
        <Escena escena={escena} kit={kit} posicion="center 60%" />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: z.top + tit + 60, background: 'linear-gradient(180deg, rgba(10,10,10,0.92) 60%, rgba(10,10,10,0))' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: H * 0.2, background: 'linear-gradient(0deg, rgba(10,10,10,0.9) 35%, rgba(10,10,10,0))' }} />
      <div style={{ position: 'absolute', left: 40, right: 40, top: z.top + 6, height: tit * 0.5 }}>
        <Pop texto={t.titular} color="#FFFFFF" max={110} peso={900} mayus />
      </div>
      <div style={{ position: 'absolute', left: 40, right: 40, top: z.top + 6 + tit * 0.5, height: tit * 0.5 }}>
        <Pop texto={t.plazo} color={acento} max={110} peso={900} mayus />
      </div>
      {t.marca ? (
        <div style={{ position: 'absolute', left: W * 0.3, right: W * 0.3, top: z.top + tit + 14, height: 50 }}>
          <Pop texto={t.marca} color="#FFFFFF" max={40} peso={700} mayus espacio="0.04em" />
        </div>
      ) : null}
      {/* el pedestal y el producto al centro */}
      <div style={{ position: 'absolute', left: W / 2 - prod * 0.55, width: prod * 1.1, top: z.bottom - 120, height: 70, borderRadius: '50%', background: 'radial-gradient(closest-side, #3A3A3A, #1A1A1A)', boxShadow: '0 12px 30px rgba(0,0,0,0.6)' }} />
      {t.conProducto !== false ? (
        <div style={{ position: 'absolute', left: W / 2 - prod / 2, top: z.bottom - 95 - prod * 1.15, width: prod, height: prod * 1.15 }}>
          <Producto producto={producto} base={false} tarjeta={producto?.recortado ? false : true} />
        </div>
      ) : null}
      {[
        [t.antes, 40, 'left'],
        [t.despues, null, 'right'],
      ].map(([x, izq, al], i) =>
        x ? (
          <div key={i} style={{ position: 'absolute', ...(izq !== null ? { left: izq } : { right: 40 }), width: W * 0.3, top: z.bottom - 66, height: 52 }}>
            <div style={{ height: 3, background: acento, width: '70%', marginLeft: al === 'right' ? 'auto' : 0, marginBottom: 6 }} />
            <Pop texto={x} color="#FFFFFF" max={34} peso={800} mayus alineado={al} espacio="0.03em" />
          </div>
        ) : null
      )}
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - 8 }}>
        <Legal texto={t.legal} color="rgba(255,255,255,0.55)" alto={24} />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- dos mitades de color (Sonvital, pies ilustrados)

export function DosMitades({ t, kit, producto, escena, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const z = zona(H, formato);
  const vertical = formato === '9:16';
  const izq = luminancia(p.primario) > 0.45 ? mezclar(p.primario, '#000000', 0.45) : p.primario;
  const der = p.secundario;
  const tinta = luminancia(der) > 0.45 ? mezclar(izq, '#000000', 0.25) : '#FFFFFF';
  const tit = z.alto * (vertical ? 0.15 : 0.2);
  const prod = W * (vertical ? 0.36 : 0.3);
  const caja = { left: 40, right: 40, top: z.top + 6, height: tit };
  // el titular dos veces, recortado a cada mitad: blanco sobre el color de la izquierda, oscuro sobre el de la derecha
  const titular = (color, clip) => (
    <div style={{ position: 'absolute', ...caja, clipPath: clip }}>
      <Pop texto={t.titular} color={color} max={120} peso={800} alto={1.02} />
    </div>
  );
  return (
    <AbsoluteFill style={{ background: izq }}>
      <div style={{ position: 'absolute', left: W / 2, top: 0, width: W / 2, height: H, background: der }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.top + tit, bottom: H - z.bottom + (vertical ? 120 : 90), overflow: 'hidden' }}>
        <Escena escena={escena} kit={kit} />
      </div>
      {titular('#FFFFFF', `inset(0 ${W / 2 - 40}px 0 0)`)}
      {titular(tinta, `inset(0 0 0 ${W / 2 - 40}px)`)}
      {t.pildora ? (
        <div style={{ position: 'absolute', left: W * 0.2, right: W * 0.2, top: z.top + tit + 8, height: vertical ? 84 : 70, borderRadius: 999, background: mezclar(izq, '#000000', 0.25), padding: '0 30px', boxSizing: 'border-box', boxShadow: '0 8px 20px rgba(0,0,0,0.2)' }}>
          <Pop texto={t.pildora} color="#FFFFFF" max={40} peso={700} />
        </div>
      ) : null}
      {t.conProducto !== false ? (
        <div style={{ position: 'absolute', left: W / 2 - prod / 2, top: z.top + tit + (z.bottom - z.top - tit) * 0.24, width: prod, height: prod * 1.2 }}>
          <Producto producto={producto} base tarjeta={producto?.recortado ? false : true} />
        </div>
      ) : null}
      {t.boton ? (
        <div style={{ position: 'absolute', left: W * 0.22, right: W * 0.22, top: z.bottom - (vertical ? 190 : 150), height: vertical ? 90 : 76, borderRadius: 999, background: mezclar(izq, '#000000', 0.2), border: '3px solid rgba(255,255,255,0.9)', padding: '0 30px', boxSizing: 'border-box' }}>
          <Pop texto={t.boton} color="#FFFFFF" max={40} peso={800} mayus />
        </div>
      ) : null}
      {t.marca
        ? [
            ['#FFFFFF', `inset(0 ${W / 2}px 0 0)`],
            [tinta, `inset(0 0 0 ${W / 2}px)`],
          ].map(([color, clip], i) => (
            <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - (vertical ? 90 : 66), height: 54, clipPath: clip }}>
              <div style={{ position: 'absolute', left: W * 0.25, right: W * 0.25, top: 0, bottom: 0 }}>
                <Pop texto={t.marca} color={color} max={50} peso={800} mayus espacio="0.02em" />
              </div>
            </div>
          ))
        : null}
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - 10 }}>
        <Legal texto={t.legal} color="rgba(0,0,0,0.55)" alto={22} />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- rótulos sobre la anatomía (Lymphoria)

function Rotulo({ texto }) {
  return (
    <div style={{ width: '100%', height: '100%', background: '#FFFFFF', borderRadius: 18, padding: '8px 14px', boxSizing: 'border-box', boxShadow: '0 6px 16px rgba(0,0,0,0.15)' }}>
      <Ajustado max={34} min={11} estilo={{ fontFamily: FUENTE_POP, fontWeight: 500, color: '#141414', lineHeight: 1.12 }}>
        {texto}
      </Ajustado>
    </div>
  );
}

export function RotulosAnatomia({ t, kit, producto, escena, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const z = zona(H, formato);
  const vertical = formato === '9:16';
  const tit = z.alto * (vertical ? 0.12 : 0.13);
  const sub = z.alto * (vertical ? 0.07 : 0.085);
  const cab = z.alto * 0.09;
  const escTop = z.top + tit + sub + cab + 10;
  const franja = vertical ? 150 : 120;
  const escAlto = z.bottom - escTop - franja;
  const izq = (t.izquierda || []).filter(Boolean).slice(0, 2);
  const der = (t.derecha || []).filter(Boolean).slice(0, 2);
  const iconos = (t.iconos || []).filter(Boolean).slice(0, 3);
  const verde = '#3FAE2A';
  const r = { w: W * 0.24, h: Math.min(110, escAlto * 0.16) };
  const yI = [0.2, 0.62];
  const yD = [0.28, 0.56];
  const prod = W * (vertical ? 0.3 : 0.25);
  const dorado = acentoClaro(p);
  return (
    <AbsoluteFill style={{ background: '#FFFFFF' }}>
      <div style={{ position: 'absolute', left: 40, right: 40, top: z.top, height: tit }}>
        <Pop texto={t.titular} color="#111" max={96} peso={900} mayus alto={1.0} />
      </div>
      <div style={{ position: 'absolute', left: 70, right: 70, top: z.top + tit, height: sub }}>
        <Pop texto={t.subtitulo} color="#222" max={34} peso={400} alto={1.2} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: escTop, height: escAlto, overflow: 'hidden' }}>
        <Escena escena={escena} kit={kit} />
        <div style={{ position: 'absolute', left: W / 2 - 1, top: 0, bottom: 0, width: 2, background: 'rgba(0,0,0,0.75)' }} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: escTop - cab - 6, height: cab + 30, background: 'linear-gradient(180deg, #FFFFFF 70%, rgba(255,255,255,0))' }} />
      <div style={{ position: 'absolute', left: 30, width: W * 0.38, top: escTop - cab, height: cab }}>
        <Pop texto={t.ahora} color="#111" max={46} peso={900} mayus alto={1.0} />
      </div>
      <div style={{ position: 'absolute', right: 30, width: W * 0.38, top: escTop - cab, height: cab }}>
        <Pop texto={t.despues} color="#111" max={46} peso={900} mayus alto={1.0} />
      </div>
      <svg width={W * 0.16} height={cab} viewBox="0 0 160 80" style={{ position: 'absolute', left: W * 0.42, top: escTop - cab }}>
        <defs>
          <linearGradient id="fl" x1="0" x2="1">
            <stop offset="0" stopColor={verde} stopOpacity="0.2" />
            <stop offset="1" stopColor={verde} />
          </linearGradient>
        </defs>
        <path d="M0 26 H110 V6 L158 40 L110 74 V54 H0 Z" fill="url(#fl)" />
      </svg>
      {izq.map((x, i) => (
        <div key={`i${i}`} style={{ position: 'absolute', left: 22, top: escTop + escAlto * yI[i], width: r.w, height: r.h }}>
          <Rotulo texto={x} />
        </div>
      ))}
      {der.map((x, i) => (
        <div key={`d${i}`} style={{ position: 'absolute', right: 22, top: escTop + escAlto * yD[i], width: r.w, height: r.h }}>
          <Rotulo texto={x} />
        </div>
      ))}
      <CapaDibujo>
        {izq.map((_, i) => (
          <Flecha key={`a${i}`} x1={22 + r.w / 2} y1={escTop + escAlto * yI[i] + r.h} x2={W * 0.3} y2={escTop + escAlto * (yI[i] + 0.16)} curva={0.1} color="#111" grosor={2.5} punta={12} />
        ))}
        {der.map((_, i) => (
          <Flecha key={`b${i}`} x1={W - 22 - r.w / 2} y1={escTop + escAlto * yD[i] + r.h} x2={W * 0.72} y2={escTop + escAlto * (yD[i] + 0.16)} curva={-0.1} color="#111" grosor={2.5} punta={12} />
        ))}
      </CapaDibujo>
      {t.conProducto !== false ? (
        <div style={{ position: 'absolute', left: W / 2 - prod / 2, top: escTop + escAlto * 0.08, width: prod, height: escAlto * 0.86 }}>
          <Producto producto={producto} base={false} tarjeta={producto?.recortado ? false : true} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - franja, height: franja + (vertical ? 0 : H - z.bottom), background: `linear-gradient(90deg, ${mezclar(dorado, '#000000', 0.15)}, ${dorado})`, display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 20px', boxSizing: 'border-box' }}>
        {iconos.map((x, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, width: `${100 / Math.max(1, iconos.length)}%`, height: franja * 0.7 }}>
            <Icono nombre={iconoPara(x, i)} tam={franja * 0.45} color="#111" grosor={2.4} />
            <div style={{ flex: 1, height: '100%' }}>
              <Pop texto={x} color="#111" max={30} peso={900} mayus alineado="left" alto={1.0} />
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- estado vs. estado (Aurelys, barriga hinchada / drenada)

export function EstadoVsEstado({ t, kit, producto, escena, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const z = zona(H, formato);
  const vertical = formato === '9:16';
  const rojo = '#D8262E';
  const cab = z.alto * (vertical ? 0.17 : 0.22);
  const prod = W * (vertical ? 0.24 : 0.2);
  const columna = (lado, palabra, color, sub) => (
    <div style={{ position: 'absolute', [lado]: 20, width: W / 2 - 40, top: z.top, height: cab, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: '40%' }}>
        <Titular texto={t.zona} kit={{ ...kit, fuenteTitulo: 'Anton' }} color="#111" max={110} />
      </div>
      <div style={{ height: '40%' }}>
        <Titular texto={palabra} kit={{ ...kit, fuenteTitulo: 'Anton' }} color={color} max={110} />
      </div>
      <div style={{ height: '20%' }}>
        <Pop texto={sub} color="#222" max={30} peso={500} />
      </div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: '#FFFFFF' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.top + cab, bottom: H - z.bottom + 30, overflow: 'hidden' }}>
        <Escena escena={escena} kit={kit} posicion="center 30%" />
      </div>
      <div style={{ position: 'absolute', left: W / 2 - 1.5, width: 3, top: z.top, bottom: H - z.bottom + 30, background: '#555' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: z.top + cab, background: '#FFFFFF' }} />
      {columna('left', t.mal, rojo, t.sub_mal)}
      {columna('right', t.bien, rojo, t.sub_bien)}
      {t.conProducto !== false ? (
        <div style={{ position: 'absolute', left: W / 2 - prod / 2, top: z.top + cab + (z.bottom - z.top - cab) * 0.12, width: prod, height: prod * 1.35 }}>
          <Producto producto={producto} base={false} tarjeta={producto?.recortado ? false : true} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - 26 }}>
        <Legal texto={t.legal} color="rgba(0,0,0,0.5)" />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- cuadrícula de tiempos (Aurelys 2×2)

export function CuadriculaTiempo({ t, kit, producto, escena, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const z = zona(H, formato);
  const vertical = formato === '9:16';
  const fondo = '#E9E6E1';
  const verde = acentoOscuro(p);
  const tit = z.alto * (vertical ? 0.13 : 0.17);
  const etapas = (t.etapas || []).filter(Boolean).slice(0, 4);
  const gridW = vertical ? W - 60 : W * 0.6;
  const gridTop = z.top + tit + 10;
  const gridAlto = vertical ? z.alto * 0.55 : z.bottom - gridTop - 30;
  const etq = Math.min(56, gridAlto * 0.09);
  const celdaW = (gridW - 16) / 2;
  const celdaH = (gridAlto - 2 * etq - 16) / 2;
  const prod = vertical ? W * 0.42 : W * 0.36;
  return (
    <AbsoluteFill style={{ background: fondo }}>
      <div style={{ position: 'absolute', left: 40, right: 40, top: z.top, height: tit }}>
        <Titular texto={t.titular} kit={{ ...kit, fuenteTitulo: 'Anton' }} color={verde} max={120} />
      </div>
      {/* la escena es una sola imagen 2×2: la app la recorta en las 4 celdas */}
      {[0, 1, 2, 3].map((i) => {
        const col = i % 2;
        const fila = Math.floor(i / 2);
        const x = 30 + col * (celdaW + 16);
        const y = gridTop + fila * (celdaH + etq + 16) + etq;
        return (
          <div key={i}>
            <div style={{ position: 'absolute', left: x, top: y - etq, width: celdaW, height: etq }}>
              <Ajustado max={etq * 0.8} min={12} estilo={{ fontFamily: fuenteTitulo({ fuenteTitulo: 'Anton' }), color: '#141414', textTransform: 'uppercase' }}>
                {etapas[i] || ''}
              </Ajustado>
            </div>
            <div style={{ position: 'absolute', left: x, top: y, width: celdaW, height: celdaH, overflow: 'hidden', borderRadius: 6, border: '2px solid #FFFFFF' }}>
              <div style={{ position: 'absolute', left: -col * (celdaW + 16), top: -fila * (celdaH + 16), width: celdaW * 2 + 16, height: celdaH * 2 + 16 }}>
                <Escena escena={escena} kit={kit} />
              </div>
            </div>
          </div>
        );
      })}
      {t.conProducto !== false ? (
        <div style={{ position: 'absolute', right: vertical ? W / 2 - prod / 2 : 20, top: vertical ? gridTop + gridAlto + 20 : gridTop + gridAlto * 0.08, width: prod, height: vertical ? z.bottom - gridTop - gridAlto - 40 : gridAlto * 0.85 }}>
          <Producto producto={producto} tarjeta={producto?.recortado ? false : true} fondoTarjeta={fondo} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - 26 }}>
        <Legal texto={t.legal} color="rgba(0,0,0,0.5)" />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- antes y después con íconos a los lados (Natures Sunshine)

export function BeneficiosLados({ t, kit, producto, escena, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const z = zona(H, formato);
  const vertical = formato === '9:16';
  const oscuro = acentoOscuro(p);
  const tit = z.alto * (vertical ? 0.14 : 0.16);
  const escTop = z.top + tit + 8;
  const franja = vertical ? 0 : 84;
  const escAlto = z.bottom - escTop - franja - 6;
  const males = (t.males || []).filter(Boolean).slice(0, 4);
  const bienes = (t.bienes || []).filter(Boolean).slice(0, 4);
  const colW = W * 0.25;
  const prod = W * (vertical ? 0.3 : 0.24);
  const filaH = (escAlto * 0.7) / 4;
  const atributos = (t.atributos || []).filter(Boolean).slice(0, 3);
  const lista = (items, lado, icoColor) =>
    items.map((x, i) => (
      <div key={`${lado}${i}`} style={{ position: 'absolute', [lado]: 16, width: colW, top: escTop + escAlto * 0.25 + i * filaH, height: filaH - 8, display: 'flex', alignItems: 'center', gap: 8, flexDirection: lado === 'left' ? 'row' : 'row-reverse' }}>
        <div style={{ width: filaH * 0.62, height: filaH * 0.62, borderRadius: 999, background: icoColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 10px rgba(0,0,0,0.25)' }}>
          <Icono nombre={iconoPara(x, i)} tam={filaH * 0.36} color="#FFFFFF" grosor={2.2} />
        </div>
        <div style={{ flex: 1, height: '100%', background: 'rgba(255,255,255,0.82)', borderRadius: 10, padding: '2px 8px', boxSizing: 'border-box' }}>
          <Pop texto={x} color="#141414" max={26} peso={600} alto={1.1} alineado={lado === 'left' ? 'left' : 'right'} />
        </div>
      </div>
    ));
  return (
    <AbsoluteFill style={{ background: '#F4F1EA' }}>
      <div style={{ position: 'absolute', left: 30, right: 30, top: z.top, height: tit * 0.55 }}>
        <Pop texto={t.titular} color={oscuro} max={90} peso={900} mayus alto={1.0} />
      </div>
      <div style={{ position: 'absolute', left: 30, right: 30, top: z.top + tit * 0.55, height: tit * 0.45 }}>
        <Pop texto={t.subtitulo} color="#141414" max={60} peso={800} mayus alto={1.0} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: escTop, height: escAlto, overflow: 'hidden' }}>
        <Escena escena={escena} kit={kit} />
      </div>
      {[
        [t.antes, { left: 20 }, '#141414'],
        [t.despues, { right: 20 }, oscuro],
      ].map(([x, pos, color], i) =>
        x ? (
          <div key={i} style={{ position: 'absolute', ...pos, top: escTop + 14, width: W * 0.22, height: 56, background: color, borderRadius: 8, padding: '0 14px', boxSizing: 'border-box' }}>
            <Pop texto={x} color="#FFFFFF" max={32} peso={800} mayus />
          </div>
        ) : null
      )}
      {lista(males, 'left', '#2B2B2B')}
      {lista(bienes, 'right', oscuro)}
      {t.sello ? (
        <div style={{ position: 'absolute', left: W / 2 - 95, top: escTop + escAlto * 0.04, width: 190, height: 190, borderRadius: 999, background: '#FFFFFF', border: `4px solid ${oscuro}`, padding: 24, boxSizing: 'border-box', boxShadow: '0 8px 20px rgba(0,0,0,0.2)' }}>
          <Pop texto={t.sello} color={oscuro} max={30} peso={800} mayus alto={1.05} />
        </div>
      ) : null}
      {t.conProducto !== false ? (
        <div style={{ position: 'absolute', left: W / 2 - prod / 2, top: escTop + escAlto - prod * 1.3, width: prod, height: prod * 1.25 }}>
          <Producto producto={producto} base={false} tarjeta={producto?.recortado ? false : true} />
        </div>
      ) : null}
      {franja ? (
        <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - franja, height: franja + (H - z.bottom), background: oscuro, display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 20px', boxSizing: 'border-box' }}>
          {atributos.map((x, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, width: `${100 / Math.max(1, atributos.length)}%`, height: franja * 0.6 }}>
              <Icono nombre={iconoPara(x, i)} tam={franja * 0.42} color="#FFFFFF" grosor={2} />
              <div style={{ flex: 1, height: '100%' }}>
                <Pop texto={x} color="#FFFFFF" max={24} peso={700} mayus alineado="left" alto={1.05} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- días con el producto (Muna, fondo blanco)

export function DiasProducto({ t, kit, producto, escena, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const z = zona(H, formato);
  const vertical = formato === '9:16';
  const etapas = (t.etapas || []).filter(Boolean).slice(0, 3);
  const n = Math.max(1, etapas.length || 3);
  const marca = z.alto * (vertical ? 0.07 : 0.09);
  const escTop = z.top + marca + 6;
  const escAlto = z.alto * (vertical ? 0.5 : 0.56);
  const etq = 60;
  const prod = W * (vertical ? 0.34 : 0.26);
  return (
    <AbsoluteFill style={{ background: '#FFFFFF' }}>
      <div style={{ position: 'absolute', left: W * 0.2, right: W * 0.2, top: z.top, height: marca }}>
        <Pop texto={t.marca} color="#111" max={80} peso={800} espacio="-0.03em" />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: escTop, height: escAlto, overflow: 'hidden' }}>
        <Escena escena={escena} kit={kit} />
      </div>
      {etapas.map((e, i) => (
        <div key={i} style={{ position: 'absolute', left: (i * W) / n + 20, width: W / n - 40, top: escTop + escAlto + 8, height: etq }}>
          <Pop texto={e} color="#111" max={52} peso={800} mayus />
        </div>
      ))}
      {t.conProducto !== false ? (
        <div style={{ position: 'absolute', left: W / 2 - prod / 2, top: escTop + escAlto + etq + 14, width: prod, height: z.bottom - (escTop + escAlto + etq + 14) - 30 }}>
          <Producto producto={producto} tarjeta={producto?.recortado ? false : true} base={false} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - 26 }}>
        <Legal texto={t.legal} />
      </div>
    </AbsoluteFill>
  );
}


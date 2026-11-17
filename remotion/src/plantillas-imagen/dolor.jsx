// Familia «Dolor y resultado»: antes/después real, línea de tiempo, pizarra «tu objeción vs. esto» y mapa del cuerpo.
// La oferta nunca va acá (solo en las de la familia «Oferta»).
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { CapaDibujo, Escena, Flecha, FondoColor, Legal, Mano, Pildora, Producto, Titular, Ajustado, fuenteMano, fuenteTitulo, margenes, paleta, FUENTE_TEXTO, mezclar } from './base.jsx';
import { Icono } from './iconos.jsx';

/** Con lugar para una banda de titular arriba (4:5 y 9:16): la escena queda abajo de ella. */
function conBanda(W, H) {
  return H - W >= 200;
}

// ---------------------------------------------------------------- antes / después

export function AntesDespues({ t, kit, producto, escena, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const banda = conBanda(W, H);
  const m = margenes(formato);
  // la escena: a sangre en el cuadrado; con banda, debajo del titular
  const top = banda ? Math.round(H * m.arriba + (formato === '9:16' ? 300 : 210)) : 0;
  const alto = banda ? Math.min(W, H - top - Math.round(H * m.abajo) - (formato === '9:16' ? 40 : 0)) : H;
  const prod = Math.round(W * (banda ? 0.24 : 0.22));
  return (
    <AbsoluteFill style={{ background: p.primario }}>
      {banda ? <FondoColor color={p.primario} /> : null}
      {banda ? (
        <div style={{ position: 'absolute', left: 50, right: 50, top: H * m.arriba, height: top - H * m.arriba - 24 }}>
          <Titular texto={t.titular} kit={kit} color={p.sobrePrimario} resaltado={p.secundario} max={150} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 0, top, width: W, height: alto, overflow: 'hidden' }}>
        <Escena escena={escena} kit={kit} />
        {/* la línea del medio */}
        <div style={{ position: 'absolute', left: W / 2 - 4, top: 0, bottom: 0, width: 8, background: '#FFFFFF', boxShadow: '0 0 18px rgba(0,0,0,0.25)' }} />
        <div style={{ position: 'absolute', left: W * 0.25 - 150, top: 34, width: 300 }}>
          <Pildora texto={t.antes || 'ANTES'} kit={kit} fondo="#FFFFFF" color="#141414" ancho={300} alto={78} />
        </div>
        <div style={{ position: 'absolute', left: W * 0.75 - 150, top: 34, width: 300 }}>
          <Pildora texto={t.despues || 'DESPUÉS'} kit={kit} fondo={p.secundario} color={p.sobreSecundario} ancho={300} alto={78} />
        </div>
        {!banda && t.titular ? (
          <div style={{ position: 'absolute', left: 40, right: prod + 50, bottom: 60, height: 170 }}>
            <Titular texto={t.titular} kit={kit} color="#FFFFFF" sombra max={110} />
          </div>
        ) : null}
      </div>
      {t.conProducto !== false ? (
        <div style={banda ? { position: 'absolute', left: W / 2 - prod / 2, top: top + alto - prod * 0.62, width: prod, height: prod } : { position: 'absolute', right: 28, bottom: 44, width: prod, height: prod }}>
          <Producto producto={producto} tarjeta base={false} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 0, width: banda ? W : W * 0.72, bottom: banda ? H * m.abajo - 34 : 8 }}>
        <Legal texto={t.legal} color={banda ? mezclar(p.sobrePrimario, p.primario, 0.35) : 'rgba(255,255,255,0.85)'} />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- línea de tiempo

export function LineaTiempo({ t, kit, escena, producto, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const m = margenes(formato);
  const etapas = (Array.isArray(t.etapas) && t.etapas.length ? t.etapas : ['DÍA 1', 'DÍA 7', 'DÍA 14']).slice(0, 4);
  const n = etapas.length;
  const bandaAlto = formato === '9:16' ? 520 : formato === '4:5' ? 330 : 250;
  const top = formato === '9:16' ? H * m.arriba + bandaAlto : bandaAlto;
  const abajo = formato === '9:16' ? H * m.abajo : 0;
  const alto = H - top - abajo;
  return (
    <AbsoluteFill style={{ background: p.primario }}>
      <FondoColor color={p.primario} />
      <div style={{ position: 'absolute', left: 46, right: 46, top: formato === '9:16' ? H * m.arriba : 26, height: bandaAlto - 46 }}>
        <Titular texto={t.titular} kit={kit} color={p.sobrePrimario} resaltado={p.secundario} max={150} />
      </div>
      <div style={{ position: 'absolute', left: 0, top, width: W, height: alto, overflow: 'hidden' }}>
        <Escena escena={escena} kit={kit} posicion="center 70%" />
        {Array.from({ length: n - 1 }, (_, i) => (
          <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: ((i + 1) * W) / n - 3, width: 6, background: '#FFFFFF' }} />
        ))}
        {etapas.map((e, i) => (
          <div key={i} style={{ position: 'absolute', left: (i * W) / n + (W / n - Math.min(250, W / n - 30)) / 2, bottom: formato === '9:16' ? 36 : 58, width: Math.min(250, W / n - 30) }}>
            <Pildora texto={e} kit={kit} fondo={i === n - 1 ? p.secundario : '#FFFFFF'} color={i === n - 1 ? p.sobreSecundario : '#141414'} ancho={Math.min(250, W / n - 30)} alto={70} />
          </div>
        ))}
      </div>
      {formato === '9:16' ? (
        <div style={{ position: 'absolute', right: 40, bottom: H * m.abajo + 120, width: 230, height: 230 }}>
          <Producto producto={producto} tarjeta base={false} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: formato === '9:16' ? H * m.abajo - 34 : 4 }}>
        <Legal texto={t.legal} color={formato === '9:16' ? mezclar(p.sobrePrimario, p.primario, 0.35) : 'rgba(255,255,255,0.85)'} />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- pizarra: tu objeción vs. esto

export function Pizarra({ t, kit, producto, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const m = margenes(formato);
  const tinta = '#1B2A41';
  const rojo = '#D93A2B';
  const verde = '#1E9E5A';
  const vertical = formato === '9:16';
  const marco = { left: 34, right: 34, top: H * m.arriba, bottom: H * m.abajo };
  const altoTablero = H - marco.top - marco.bottom;
  const items = (t.puntos || []).filter(Boolean).slice(0, 4);
  const prod = vertical ? W * 0.42 : W * 0.4;
  return (
    <AbsoluteFill style={{ background: mezclar(p.primario, '#ffffff', 0.25) }}>
      <FondoColor color={mezclar(p.primario, '#ffffff', 0.2)} />
      <div style={{ position: 'absolute', ...marco, background: '#FBFBF8', borderRadius: 18, border: '16px solid #C9CDD2', boxShadow: 'inset 0 0 40px rgba(0,0,0,0.06), 0 16px 40px rgba(0,0,0,0.25)' }}>
        {/* rastros de borrador */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(40% 20% at 70% 80%, rgba(120,130,150,0.08), transparent), radial-gradient(30% 15% at 20% 30%, rgba(120,130,150,0.06), transparent)' }} />
        <div style={{ position: 'absolute', left: 40, right: 40, top: 26, height: altoTablero * (vertical ? 0.17 : 0.2) }}>
          <Mano texto={t.titular} kit={kit} color={tinta} max={110} giro={-2} />
        </div>
        {/* la comparación: lo de siempre (tachado) contra el producto (en un círculo) */}
        <div style={{ position: 'absolute', left: 40, right: 40, top: altoTablero * (vertical ? 0.19 : 0.23), height: altoTablero * (vertical ? 0.14 : 0.17), display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ flex: 1, height: '100%', position: 'relative' }}>
            <Mano texto={t.antes} kit={kit} color={rojo} max={70} giro={-4} />
            <svg viewBox="0 0 100 30" preserveAspectRatio="none" style={{ position: 'absolute', left: '6%', right: '6%', top: '38%', width: '88%', height: '24%' }}>
              <path d="M2 18 C 30 8, 60 24, 98 10" stroke={rojo} strokeWidth="4" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <svg width="110" height="60" viewBox="0 0 110 60" style={{ flexShrink: 0 }}>
            <path d="M6 34 C 40 20, 70 44, 98 28" stroke={tinta} strokeWidth="5" fill="none" strokeLinecap="round" />
            <path d="M84 16 L 100 28 L 84 40" stroke={tinta} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ flex: 1, height: '100%', position: 'relative' }}>
            <svg viewBox="0 0 100 50" preserveAspectRatio="none" style={{ position: 'absolute', inset: '-6% -4%', width: '108%', height: '112%' }}>
              <ellipse cx="50" cy="25" rx="47" ry="22" stroke={verde} strokeWidth="2.4" fill="none" transform="rotate(-3 50 25)" />
            </svg>
            <Mano texto={t.despues} kit={kit} color={verde} max={70} giro={-2} />
          </div>
        </div>
        <div style={{ position: 'absolute', left: 48, width: vertical ? W - 130 : W * 0.55, top: altoTablero * (vertical ? 0.36 : 0.43), height: altoTablero * (vertical ? 0.34 : 0.5), display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((x, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, minHeight: 0 }}>
              <Icono nombre="check" tam={vertical ? 58 : 48} color={verde} grosor={3.4} />
              <div style={{ flex: 1, height: '100%' }}>
                <Ajustado max={60} min={16} alineado="left" balance={false} estilo={{ fontFamily: fuenteMano(kit), color: tinta, fontWeight: 700, lineHeight: 1 }}>
                  {x}
                </Ajustado>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', right: vertical ? 40 : 20, bottom: vertical ? H * m.abajo - 30 : 10, width: prod, height: prod }}>
        <Producto producto={producto} />
      </div>
      <div style={{ position: 'absolute', left: 0, width: W * 0.6, bottom: vertical ? H * m.abajo - 60 : 0 }}>
        <Legal texto={t.legal} color="rgba(0,0,0,0.55)" />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- mapa del cuerpo con etiquetas

export function MapaCuerpo({ t, kit, escena, producto, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const m = margenes(formato);
  const vertical = formato === '9:16';
  const bandaAlto = vertical ? 420 : formato === '4:5' ? 300 : 210;
  const top = (vertical ? H * m.arriba : 20) + bandaAlto;
  const alto = H - top - (vertical ? H * m.abajo : 0);
  const izq = (t.izquierda || []).filter(Boolean).slice(0, 3);
  const der = (t.derecha || []).filter(Boolean).slice(0, 3);
  const alturas = [0.3, 0.52, 0.74];
  const rojo = '#D93A2B';
  const caja = { w: W * 0.25, h: Math.min(130, alto * 0.16) };
  return (
    <AbsoluteFill style={{ background: '#FFFFFF' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: top, background: p.primario }} />
      <div style={{ position: 'absolute', left: 46, right: 46, top: vertical ? H * m.arriba : 24, height: bandaAlto - 30 }}>
        <Titular texto={t.titular} kit={kit} color={p.sobrePrimario} resaltado={p.secundario} max={140} />
      </div>
      <div style={{ position: 'absolute', left: 0, top, width: W, height: alto, overflow: 'hidden' }}>
        <Escena escena={escena} kit={kit} />
      </div>
      {/* los rótulos de arriba: sin / con */}
      <div style={{ position: 'absolute', left: W * 0.3 - 140, top: top + 20, width: 280 }}>
        <Pildora texto={t.sin || 'ANTES'} kit={kit} fondo="#141414" color="#FFFFFF" ancho={280} alto={64} />
      </div>
      <div style={{ position: 'absolute', left: W * 0.7 - 140, top: top + 20, width: 280 }}>
        <Pildora texto={t.con || 'DESPUÉS'} kit={kit} fondo={p.secundario} color={p.sobreSecundario} ancho={280} alto={64} />
      </div>
      {izq.map((x, i) => (
        <div key={`i${i}`} style={{ position: 'absolute', left: 18, top: top + alto * alturas[i] - caja.h / 2, width: caja.w, height: caja.h, background: 'rgba(255,255,255,0.9)', borderRadius: 16, border: `3px solid ${rojo}`, padding: '8px 12px', boxSizing: 'border-box' }}>
          <Ajustado max={40} min={12} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 800, color: rojo, lineHeight: 1.05 }}>
            {x}
          </Ajustado>
        </div>
      ))}
      {der.map((x, i) => (
        <div key={`d${i}`} style={{ position: 'absolute', right: 18, top: top + alto * alturas[i] - caja.h / 2, width: caja.w, height: caja.h, background: 'rgba(255,255,255,0.9)', borderRadius: 16, border: `3px solid ${p.profundo}`, padding: '8px 12px', boxSizing: 'border-box' }}>
          <Ajustado max={40} min={12} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 800, color: p.profundo, lineHeight: 1.05 }}>
            {x}
          </Ajustado>
        </div>
      ))}
      <CapaDibujo>
        {izq.map((_, i) => (
          <Flecha key={`fi${i}`} x1={18 + caja.w + 6} y1={top + alto * alturas[i]} x2={W * 0.36} y2={top + alto * (alturas[i] + 0.02)} curva={0.18} color={rojo} grosor={6} punta={20} />
        ))}
        {der.map((_, i) => (
          <Flecha key={`fd${i}`} x1={W - 18 - caja.w - 6} y1={top + alto * alturas[i]} x2={W * 0.64} y2={top + alto * (alturas[i] + 0.02)} curva={-0.18} color={p.profundo} grosor={6} punta={20} />
        ))}
      </CapaDibujo>
      {vertical ? (
        <div style={{ position: 'absolute', left: W / 2 - 110, bottom: H * m.abajo + 10, width: 220, height: 220 }}>
          <Producto producto={producto} tarjeta base={false} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: vertical ? H * m.abajo - 34 : 2 }}>
        <Legal texto={t.legal} color="rgba(0,0,0,0.55)" />
      </div>
    </AbsoluteFill>
  );
}

export { fuenteTitulo };

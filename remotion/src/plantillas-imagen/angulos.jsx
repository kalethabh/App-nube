// Familia «Ángulos ganadores»: los conceptos validados de la categoría (referencia interna:
// .claude/skills/anuncios-imagen-ads/referencias-ganadoras.md). Ninguno lleva oferta: comunican el ángulo de venta
// (la zona del cuerpo, el resultado, la objeción, la comparación) y la oferta va en otro anuncio.
//
//   silueta-zonas       silueta en línea de neón sobre negro, «Bye bye + el dolor» y las zonas rotuladas
//   solo-vs-con         «Solo X» | «X + tu producto»: ilustración partida, titular abajo y un botón (sin precio)
//   nosotros-vs-ellos   mitad tu producto / mitad lo de siempre, 3 diferencias por lado con flechas
//   no-compres          psicología inversa sobre un antes y después, con recuadros negros como TikTok
//   pregunta-revelacion la persona con el problema, la pregunta y la revelación («no es lo que crees»)
//   historia            antes y después arriba y la historia en primera persona abajo, con 3 íconos
//   zonas-semanas       las zonas del cuerpo dibujadas y lo que pasa semana a semana
//   foto-iconos         la zona del resultado en una foto grande, el titular, 3 íconos y el producto
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { Ajustado, CapaDibujo, Escena, Flecha, FondoColor, Legal, Mano, Pildora, Producto, Titular, fuenteMano, fuenteTitulo, luminancia, margenes, mezclar, paleta, tintaSobre, FUENTE_TEXTO } from './base.jsx';
import { Icono, iconoPara } from './iconos.jsx';

function zona(H, formato) {
  const m = margenes(formato);
  return { top: H * m.arriba, bottom: H - H * m.abajo, alto: H - H * m.arriba - H * m.abajo };
}

/** El color de neón: el acento del kit, aclarado si es muy oscuro (sobre negro tiene que brillar). */
function neon(p) {
  return luminancia(p.secundario) > 0.25 ? p.secundario : mezclar(p.secundario, '#FFFFFF', 0.45);
}

/** Un círculo con un ícono (para las filas de beneficios). */
function Circulo({ texto, i, color, fondo = 'transparent', tam = 84, grosor = 2 }) {
  return (
    <div style={{ width: tam, height: tam, borderRadius: 999, border: `${Math.max(2, tam * 0.035)}px solid ${color}`, background: fondo, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icono nombre={iconoPara(texto, i)} tam={tam * 0.52} color={color} grosor={grosor} />
    </div>
  );
}

// ---------------------------------------------------------------- silueta con zonas (neón)

export function SiluetaZonas({ t, kit, producto, escena, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const z = zona(H, formato);
  const vertical = formato === '9:16';
  const luz = neon(p);
  const brillo = `drop-shadow(0 0 10px ${luz}) drop-shadow(0 0 26px ${mezclar(luz, '#000000', 0.2)})`;
  const altoArriba = z.alto * (vertical ? 0.06 : 0.09);
  const altoTitular = z.alto * (vertical ? 0.11 : 0.15);
  const figTop = z.top + altoArriba + altoTitular + 16;
  const figBottom = z.bottom - (vertical ? z.alto * 0.16 : 34);
  const figAlto = figBottom - figTop;
  const figW = W * 0.4;
  const izq = (t.izquierda || []).filter(Boolean).slice(0, 3);
  const der = (t.derecha || []).filter(Boolean).slice(0, 2);
  const alturasI = izq.length === 1 ? [0.5] : izq.length === 2 ? [0.4, 0.62] : [0.36, 0.52, 0.68];
  const alturasD = der.length === 1 ? [0.36] : [0.3, 0.56];
  const caja = { w: W * 0.24, h: Math.min(120, figAlto * 0.13) };
  const prod = vertical ? Math.min(W * 0.26, z.bottom - figBottom - 50) : W * 0.2;
  const rotulo = (x, alineado) => (
    <Ajustado max={58} min={14} alineado={alineado} estilo={{ fontFamily: fuenteTitulo(kit), color: luz, textTransform: 'uppercase', lineHeight: 0.98, filter: `drop-shadow(0 0 8px ${mezclar(luz, '#000000', 0.3)})` }}>
      {x}
    </Ajustado>
  );
  return (
    <AbsoluteFill style={{ background: '#08080A' }}>
      <AbsoluteFill style={{ background: `radial-gradient(60% 45% at 50% 55%, ${mezclar(luz, '#08080A', 0.86)}, rgba(0,0,0,0) 70%)` }} />
      <div style={{ position: 'absolute', left: 60, right: 60, top: z.top, height: altoArriba }}>
        <Mano texto={t.arriba} kit={kit} color="#FFFFFF" max={110} giro={-2} />
      </div>
      <div style={{ position: 'absolute', left: 40, right: 40, top: z.top + altoArriba + 4, height: altoTitular, filter: brillo }}>
        <Titular texto={t.titular} kit={kit} color={luz} max={190} />
      </div>
      {/* la silueta (la escena, en línea de neón sobre negro: se funde con el fondo) */}
      <div style={{ position: 'absolute', left: (W - figW) / 2, top: figTop, width: figW, height: figAlto, overflow: 'hidden', mixBlendMode: escena?.url ? 'screen' : 'normal', borderRadius: escena?.url ? 0 : 24 }}>
        <Escena escena={escena} kit={kit} posicion="center 40%" />
      </div>
      {izq.map((x, i) => (
        <div key={`i${i}`} style={{ position: 'absolute', left: 26, top: figTop + figAlto * alturasI[i] - caja.h / 2, width: caja.w, height: caja.h }}>
          {rotulo(x, 'right')}
        </div>
      ))}
      {der.map((x, i) => (
        <div key={`d${i}`} style={{ position: 'absolute', right: 26, top: figTop + figAlto * alturasD[i] - caja.h / 2, width: caja.w, height: caja.h }}>
          {rotulo(x, 'left')}
        </div>
      ))}
      <CapaDibujo>
        <g style={{ filter: `drop-shadow(0 0 6px ${luz})` }}>
          {izq.map((_, i) => {
            const y = figTop + figAlto * alturasI[i];
            return (
              <g key={`li${i}`}>
                <circle cx={26 + caja.w + 22} cy={y} r={9} fill={luz} />
                <line x1={26 + caja.w + 22} y1={y} x2={W * 0.47} y2={y + figAlto * 0.03} stroke={luz} strokeWidth={4} strokeLinecap="round" />
                <circle cx={W * 0.47} cy={y + figAlto * 0.03} r={7} fill={luz} />
              </g>
            );
          })}
          {der.map((_, i) => {
            const y = figTop + figAlto * alturasD[i];
            return (
              <g key={`ld${i}`}>
                <circle cx={W - 26 - caja.w - 22} cy={y} r={9} fill={luz} />
                <line x1={W - 26 - caja.w - 22} y1={y} x2={W * 0.55} y2={y + figAlto * 0.06} stroke={luz} strokeWidth={4} strokeLinecap="round" />
                <circle cx={W * 0.55} cy={y + figAlto * 0.06} r={7} fill={luz} />
              </g>
            );
          })}
        </g>
      </CapaDibujo>
      {t.conProducto !== false ? (
        <div style={{ position: 'absolute', left: vertical ? W / 2 - prod / 2 : 34, top: vertical ? figBottom + 10 : z.bottom - prod - 20, width: prod, height: prod, filter: `drop-shadow(0 0 30px ${mezclar(luz, '#000000', 0.35)})` }}>
          <Producto producto={producto} base={false} tarjeta={producto?.recortado ? false : true} fondoTarjeta="#16161A" />
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: vertical ? 0 : W * 0.2, right: 0, top: z.bottom - 30 }}>
        <Legal texto={t.legal} color="rgba(255,255,255,0.55)" />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- solo X | X + tu producto

export function SoloVsCon({ t, kit, producto, escena, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const z = zona(H, formato);
  const vertical = formato === '9:16';
  const fondo = '#F7F1E6';
  const linea = p.profundo;
  const cabecera = z.alto * (vertical ? 0.12 : 0.15);
  const escTop = z.top + cabecera + 10;
  const escAlto = z.alto * (vertical ? 0.44 : 0.42);
  const textoTop = escTop + escAlto + 18;
  const boton = { w: Math.min(W * 0.52, 560), h: vertical ? 96 : 82 };
  const prod = W * (vertical ? 0.28 : 0.24);
  return (
    <AbsoluteFill style={{ background: fondo }}>
      <div style={{ position: 'absolute', left: 50, width: W / 2 - 80, top: z.top, height: cabecera }}>
        <Ajustado max={72} min={18} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 900, color: '#141414', lineHeight: 1.02, letterSpacing: '-0.02em' }}>
          {t.sin}
        </Ajustado>
      </div>
      <div style={{ position: 'absolute', right: 50, width: W / 2 - 80, top: z.top, height: cabecera }}>
        <Ajustado max={72} min={18} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 900, color: '#141414', lineHeight: 1.02, letterSpacing: '-0.02em' }}>
          {t.con}
        </Ajustado>
      </div>
      <div style={{ position: 'absolute', left: W * 0.07, width: W * 0.86, top: escTop, height: escAlto, overflow: 'hidden', borderRadius: 6 }}>
        <Escena escena={escena} kit={kit} />
      </div>
      <div style={{ position: 'absolute', left: W / 2 - 3, width: 6, top: z.top + 10, height: cabecera + escAlto, background: linea, borderRadius: 3 }} />
      {t.conProducto !== false ? (
        <div style={{ position: 'absolute', right: W * 0.07, top: escTop + escAlto - prod * 0.95, width: prod, height: prod }}>
          <Producto producto={producto} base={false} tarjeta={producto?.recortado ? false : true} fondoTarjeta={fondo} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 60, right: 60, top: textoTop, height: z.alto * (vertical ? 0.15 : 0.14) }}>
        <Ajustado max={vertical ? 92 : 76} min={22} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 900, color: '#141414', textTransform: 'uppercase', lineHeight: 1.04, letterSpacing: '-0.01em' }}>
          {t.titular}
        </Ajustado>
      </div>
      <div style={{ position: 'absolute', left: 70, right: 70, top: textoTop + z.alto * (vertical ? 0.155 : 0.145), height: z.alto * (vertical ? 0.08 : 0.07) }}>
        <Ajustado max={44} min={14} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 500, color: '#222', lineHeight: 1.18 }}>
          {t.subtitulo}
        </Ajustado>
      </div>
      {t.boton ? (
        <div style={{ position: 'absolute', left: (W - boton.w) / 2, top: Math.min(z.bottom - boton.h - 36, textoTop + z.alto * (vertical ? 0.25 : 0.235)), width: boton.w, height: boton.h, borderRadius: 999, background: p.profundo, padding: '0 34px', boxSizing: 'border-box' }}>
          <Ajustado max={boton.h * 0.5} min={14} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 900, color: luminancia(p.secundario) > 0.3 ? p.secundario : '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.01em' }}>
            {t.boton}
          </Ajustado>
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - 32 }}>
        <Legal texto={t.legal} />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- nosotros vs. ellos

export function NosotrosVsEllos({ t, kit, producto, escena, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const z = zona(H, formato);
  const vertical = formato === '9:16';
  const gris = '#9A9A9A';
  const caja = { top: z.top + 10, alto: z.alto * (vertical ? 0.14 : 0.17) };
  const sub = { top: caja.top + caja.alto - 14, alto: z.alto * (vertical ? 0.06 : 0.075) };
  const cuerpoTop = sub.top + sub.alto + 30;
  const cuerpoAlto = z.bottom - cuerpoTop - 40;
  const nuestros = (t.nuestros || []).filter(Boolean).slice(0, 3);
  const suyos = (t.suyos || []).filter(Boolean).slice(0, 3);
  const filaAlto = (cuerpoAlto - cuerpoAlto * 0.17) / 3;
  const colW = W * 0.27;
  return (
    <AbsoluteFill style={{ background: p.secundario }}>
      {/* las dos mitades: la tuya con el color de la marca, la de ellos en gris */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: W / 2, height: H, background: `radial-gradient(70% 50% at 70% 55%, ${mezclar(p.secundario, '#FFFFFF', 0.45)}, ${p.secundario})` }} />
      <div style={{ position: 'absolute', left: W / 2, top: 0, width: W / 2, height: H, background: 'radial-gradient(70% 50% at 30% 55%, #D7D7D7, #8E8E8E)' }} />
      {/* lo de siempre (la escena), recortado a la mitad derecha */}
      <div style={{ position: 'absolute', left: W / 2, top: cuerpoTop + cuerpoAlto * 0.12, width: W * 0.36, height: cuerpoAlto * 0.8, overflow: 'hidden', borderRadius: '0 999px 999px 0' }}>
        <Escena escena={escena} kit={kit} posicion="left center" />
      </div>
      {/* tu producto, del lado izquierdo, contra la línea del medio */}
      <div style={{ position: 'absolute', left: W * 0.3, top: cuerpoTop + cuerpoAlto * 0.12, width: W * 0.2, height: cuerpoAlto * 0.8 }}>
        <Producto producto={producto} base={false} tarjeta={producto?.recortado ? false : true} />
      </div>
      <div style={{ position: 'absolute', left: W * 0.12, right: W * 0.12, top: caja.top, height: caja.alto, background: p.profundo, borderRadius: 26, padding: '10px 30px', boxSizing: 'border-box' }}>
        <Titular texto={t.titular} kit={kit} color={luminancia(p.secundario) > 0.3 ? p.secundario : '#FFFFFF'} max={150} />
      </div>
      {t.subtitulo ? (
        <div style={{ position: 'absolute', left: W * 0.1, right: W * 0.1, top: sub.top, height: sub.alto, background: '#FFFDF6', borderRadius: 999, padding: '0 34px', boxSizing: 'border-box', boxShadow: '0 8px 20px rgba(0,0,0,0.12)' }}>
          <Ajustado max={50} min={14} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 800, color: p.profundo }}>
            {t.subtitulo}
          </Ajustado>
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 36, width: W / 2 - 60, top: cuerpoTop, height: cuerpoAlto * 0.13 }}>
        <Ajustado max={80} min={18} alineado="left" estilo={{ fontFamily: fuenteMano(kit), fontWeight: 700, color: p.profundo, lineHeight: 1 }}>
          {t.nuestro}
        </Ajustado>
      </div>
      <div style={{ position: 'absolute', right: 36, width: W / 2 - 60, top: cuerpoTop, height: cuerpoAlto * 0.13 }}>
        <Ajustado max={60} min={16} alineado="right" estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 900, color: '#FFFFFF', lineHeight: 1 }}>
          {t.ellos}
        </Ajustado>
      </div>
      {nuestros.map((x, i) => (
        <div key={`n${i}`} style={{ position: 'absolute', left: 36, width: colW, top: cuerpoTop + cuerpoAlto * 0.17 + i * filaAlto, height: filaAlto * 0.62 }}>
          <Ajustado max={52} min={14} alineado="left" balance={false} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 850, color: tintaSobre(p.secundario), lineHeight: 1.05 }}>
            {x}
          </Ajustado>
        </div>
      ))}
      {suyos.map((x, i) => (
        <div key={`s${i}`} style={{ position: 'absolute', right: 36, width: colW, top: cuerpoTop + cuerpoAlto * 0.17 + i * filaAlto, height: filaAlto * 0.62 }}>
          <Ajustado max={52} min={14} alineado="right" balance={false} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 850, color: '#4A4A4A', lineHeight: 1.05 }}>
            {x}
          </Ajustado>
        </div>
      ))}
      <CapaDibujo>
        {nuestros.map((_, i) => {
          const y = cuerpoTop + cuerpoAlto * 0.17 + i * filaAlto + filaAlto * 0.72;
          return <Flecha key={`fn${i}`} x1={60} y1={y} x2={W * 0.29} y2={y + 6} curva={-0.18} color={mezclar(p.profundo, '#2FBF5B', 0.5)} grosor={4} punta={16} />;
        })}
        {suyos.map((_, i) => {
          const y = cuerpoTop + cuerpoAlto * 0.17 + i * filaAlto + filaAlto * 0.72;
          return <Flecha key={`fs${i}`} x1={W - 70} y1={y} x2={W * 0.72} y2={y + 6} curva={0.18} color="#FFFFFF" grosor={4} punta={16} />;
        })}
      </CapaDibujo>
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - 32 }}>
        <Legal texto={t.legal} color="rgba(0,0,0,0.6)" />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- no compres esto si… (psicología inversa)

/** Un recuadro negro con texto blanco, como los subtítulos de TikTok (una caja por renglón del bloque). */
function Recuadros({ texto, max, alto, ancho, peso = 700 }) {
  return (
    <div style={{ width: ancho, height: alto, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Ajustado max={max} min={14} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: peso, color: '#FFFFFF', lineHeight: 1.32, letterSpacing: '-0.02em' }}>
        <span style={{ background: '#000000', padding: '0.06em 0.3em', borderRadius: '0.22em', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}>{texto}</span>
      </Ajustado>
    </div>
  );
}

function Sirena({ tam = 60 }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <rect x="3" y="19" width="18" height="3" rx="1" fill="#2B2B2B" />
      <path d="M6 19v-6a6 6 0 0 1 12 0v6z" fill="#E8352B" />
      <path d="M9 12.5a3 3 0 0 1 3-3" stroke="#FFD2CF" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M12 2.5v2M4.2 5.6l1.5 1.4M19.8 5.6l-1.5 1.4" stroke="#E8352B" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function NoCompres({ t, kit, producto, escena, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const z = zona(H, formato);
  const vertical = formato === '9:16';
  const tit = { top: z.top + 20, alto: z.alto * (vertical ? 0.12 : 0.16) };
  const txt = { top: tit.top + tit.alto + 10, alto: z.alto * (vertical ? 0.16 : 0.22) };
  const prod = W * (vertical ? 0.3 : 0.25);
  return (
    <AbsoluteFill style={{ background: '#111' }}>
      <Escena escena={escena} kit={kit} />
      <div style={{ position: 'absolute', left: W / 2 - 2, top: 0, bottom: 0, width: 4, background: 'rgba(255,255,255,0.75)' }} />
      <div style={{ position: 'absolute', left: 30, right: 30, top: tit.top, height: tit.alto, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Sirena tam={vertical ? 70 : 58} />
        <div style={{ flex: 1, height: '100%' }}>
          <Recuadros texto={t.titular} max={vertical ? 74 : 64} alto={tit.alto} ancho="100%" peso={800} />
        </div>
        <Sirena tam={vertical ? 70 : 58} />
      </div>
      {t.texto ? (
        <div style={{ position: 'absolute', left: W * 0.1, right: W * 0.1, top: txt.top, height: txt.alto }}>
          <Recuadros texto={t.texto} max={vertical ? 50 : 44} alto={txt.alto} ancho="100%" peso={600} />
        </div>
      ) : null}
      {t.conProducto !== false ? (
        <div style={{ position: 'absolute', left: W / 2 - prod / 2, top: z.bottom - prod - (vertical ? 40 : 46), width: prod, height: prod }}>
          <Producto producto={producto} base={false} tarjeta={producto?.recortado ? false : true} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - 34 }}>
        <Legal texto={t.legal} color="rgba(255,255,255,0.9)" />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- pregunta y revelación

export function PreguntaRevelacion({ t, kit, producto, escena, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const z = zona(H, formato);
  const vertical = formato === '9:16';
  const fondo = luminancia(p.primario) > 0.45 ? mezclar(p.primario, '#000000', 0.45) : p.primario;
  const claro = mezclar(p.secundario, '#FFFFFF', 0.35);
  const col = { left: W * 0.44, right: 40 };
  const prod = W * (vertical ? 0.36 : 0.3);
  return (
    <AbsoluteFill style={{ background: fondo }}>
      <FondoColor color={fondo} />
      {/* la persona con el problema, a la izquierda, fundida con el fondo */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: W * 0.56, height: H, overflow: 'hidden' }}>
        <Escena escena={escena} kit={kit} posicion="left center" />
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, rgba(0,0,0,0) 62%, ${fondo} 99%)` }} />
      </div>
      <div style={{ position: 'absolute', left: col.left, right: col.right, top: z.top + 20, height: z.alto * 0.2 }}>
        <Ajustado max={92} min={18} alineado="right" estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.08, letterSpacing: '-0.02em' }}>
          {t.pregunta}
        </Ajustado>
      </div>
      <div style={{ position: 'absolute', left: col.left - 20, right: col.right, top: z.top + 20 + z.alto * 0.21, height: z.alto * (vertical ? 0.19 : 0.23) }}>
        <Titular texto={t.revelacion} kit={kit} color={claro} resaltado="#FFFFFF" alineado="right" max={170} sombra />
      </div>
      {t.conProducto !== false ? (
        <div style={{ position: 'absolute', right: W * 0.05, top: z.top + z.alto * (vertical ? 0.46 : 0.47), width: prod, height: prod, transform: 'rotate(-8deg)' }}>
          <Producto producto={producto} base={false} tarjeta={producto?.recortado ? false : true} />
        </div>
      ) : null}
      {t.cierre ? (
        <div style={{ position: 'absolute', left: W * 0.46, right: 30, top: z.bottom - z.alto * (vertical ? 0.16 : 0.2) - 30, height: z.alto * (vertical ? 0.16 : 0.2), background: mezclar(p.secundario, '#FF5C8A', 0.35), borderRadius: 30, padding: '10px 26px', boxSizing: 'border-box', boxShadow: '0 12px 30px rgba(0,0,0,0.25)', transform: 'rotate(-2deg)' }}>
          <Ajustado max={72} min={16} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.02 }}>
            {t.cierre}
          </Ajustado>
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - 30 }}>
        <Legal texto={t.legal} color="rgba(255,255,255,0.7)" />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- historia (antes y después + primera persona)

export function Historia({ t, kit, producto, escena, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const z = zona(H, formato);
  const vertical = formato === '9:16';
  const crema = '#F6F0E4';
  const fotoAlto = H * (vertical ? 0.58 : 0.6);
  const panelTop = fotoAlto - 50;
  const iconos = (t.iconos || []).filter(Boolean).slice(0, 3);
  const prod = W * (vertical ? 0.32 : 0.3);
  const izqTexto = prod + 40;
  return (
    <AbsoluteFill style={{ background: crema }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: fotoAlto, overflow: 'hidden' }}>
        <Escena escena={escena} kit={kit} posicion="center 30%" />
        <div style={{ position: 'absolute', left: W / 2 - 3, top: 0, bottom: 0, width: 6, background: '#FFFFFF' }} />
        <div style={{ position: 'absolute', left: 34, top: z.top + 10 }}>
          <Pildora texto={t.antes || 'Antes'} kit={kit} fondo="rgba(255,250,240,0.92)" color="#141414" ancho={220} alto={62} />
        </div>
        <div style={{ position: 'absolute', right: 34, top: z.top + 10 }}>
          <Pildora texto={t.despues || 'Después'} kit={kit} fondo="rgba(255,250,240,0.92)" color="#141414" ancho={220} alto={62} />
        </div>
      </div>
      {/* el panel crema con su onda */}
      <svg width={W} height={H - panelTop} viewBox={`0 0 ${W} ${H - panelTop}`} style={{ position: 'absolute', left: 0, top: panelTop }}>
        <path d={`M0 70 C ${W * 0.3} 0, ${W * 0.62} 110, ${W} 30 L ${W} ${H} L 0 ${H} Z`} fill={crema} />
      </svg>
      <div style={{ position: 'absolute', left: izqTexto, right: 44, top: panelTop + 70, height: (z.bottom - panelTop) * 0.42 }}>
        <Ajustado max={92} min={20} alineado="left" estilo={{ fontFamily: "'DM Serif Display', Georgia, serif", fontWeight: 400, color: '#1A1A1A', lineHeight: 1.02, letterSpacing: '-0.01em' }}>
          {t.frase}
        </Ajustado>
      </div>
      <div style={{ position: 'absolute', left: izqTexto, right: 44, top: panelTop + 70 + (z.bottom - panelTop) * 0.43, height: (z.bottom - panelTop) * 0.14 }}>
        <Titular texto={t.remate} kit={kit} color="#1A1A1A" resaltado={p.profundo} alineado="left" max={64} min={16} />
      </div>
      <div style={{ position: 'absolute', left: izqTexto, right: 34, top: panelTop + 70 + (z.bottom - panelTop) * 0.6, bottom: H - z.bottom + 34, display: 'flex', gap: 14 }}>
        {iconos.map((x, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, borderLeft: i ? '2px solid rgba(0,0,0,0.12)' : 'none', paddingLeft: i ? 8 : 0 }}>
            <Icono nombre={iconoPara(x, i)} tam={vertical ? 64 : 52} color="#1A1A1A" grosor={1.8} />
            <div style={{ width: '100%', flex: 1, minHeight: 0 }}>
              <Ajustado max={34} min={14} vertical="start" estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 600, color: '#2A2A2A', lineHeight: 1.1 }}>
                {x}
              </Ajustado>
            </div>
          </div>
        ))}
      </div>
      {t.conProducto !== false ? (
        <div style={{ position: 'absolute', left: 20, top: panelTop + 40, width: prod, height: Math.min(prod * 1.25, z.bottom - panelTop - 20) }}>
          <Producto producto={producto} tarjeta={producto?.recortado ? false : true} fondoTarjeta={crema} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - 30 }}>
        <Legal texto={t.legal} />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- zonas y semanas

export function ZonasSemanas({ t, kit, producto, escena, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const z = zona(H, formato);
  const vertical = formato === '9:16';
  const crema = '#F5EFE3';
  const tit = z.alto * (vertical ? 0.14 : 0.17);
  const escTop = z.top + tit + 10;
  const escAlto = z.alto * (vertical ? 0.33 : 0.34);
  const listaTop = escTop + escAlto + 24;
  const pasos = (t.pasos || []).filter((x) => x?.ingrediente || x?.beneficio).slice(0, 3);
  const prod = W * (vertical ? 0.34 : 0.3);
  const listaAlto = z.bottom - listaTop - 40;
  return (
    <AbsoluteFill style={{ background: crema }}>
      <div style={{ position: 'absolute', left: 50, right: 50, top: z.top, height: tit }}>
        <Titular texto={t.titular} kit={kit} color={p.profundo} max={120} />
      </div>
      <div style={{ position: 'absolute', left: W * 0.08, right: W * 0.08, top: escTop, height: escAlto, overflow: 'hidden', borderRadius: 18 }}>
        <Escena escena={escena} kit={kit} />
      </div>
      {t.conProducto !== false ? (
        <div style={{ position: 'absolute', left: 30, top: listaTop, width: prod, height: Math.min(listaAlto, prod * 1.2) }}>
          <Producto producto={producto} tarjeta={producto?.recortado ? false : true} fondoTarjeta={crema} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: prod + 60, right: 46, top: listaTop, height: listaAlto, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {pasos.map((x, i) => (
          <div key={i} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: '42%' }}>
              <Ajustado max={46} min={14} alineado="left" estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 900, color: '#1A1A1A', lineHeight: 1 }}>
                {x.ingrediente ? `${x.ingrediente}:` : ''}
              </Ajustado>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <Ajustado max={38} min={12} alineado="left" vertical="start" balance={false} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 500, color: '#2A2A2A', lineHeight: 1.15 }}>
                {x.beneficio}
              </Ajustado>
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - 32 }}>
        <Legal texto={t.legal} />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- foto grande con íconos

export function FotoIconos({ t, kit, producto, escena, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const z = zona(H, formato);
  const vertical = formato === '9:16';
  const fondo = mezclar(p.secundario, '#FFFFFF', 0.72);
  const acento = luminancia(p.primario) < 0.5 ? p.primario : p.profundo;
  const iconos = (t.iconos || []).filter(Boolean).slice(0, 3);
  const tit = z.alto * (vertical ? 0.2 : 0.26);
  const cuerpoTop = z.top + tit + 10;
  const cuerpoAlto = z.bottom - cuerpoTop - 30;
  const fotoW = W * 0.5;
  const prod = W * (vertical ? 0.38 : 0.32);
  const icono = vertical ? 96 : 80;
  return (
    <AbsoluteFill style={{ background: fondo }}>
      <FondoColor color={fondo} />
      {/* la foto: a la derecha, de arriba hasta abajo, con esquinas redondeadas */}
      <div style={{ position: 'absolute', right: 30, top: cuerpoTop - tit * 0.15, width: fotoW, height: cuerpoAlto + tit * 0.15, overflow: 'hidden', borderRadius: 30, boxShadow: '0 16px 40px rgba(0,0,0,0.18)' }}>
        <Escena escena={escena} kit={kit} />
      </div>
      <div style={{ position: 'absolute', left: 40, right: 40, top: z.top, height: tit * 0.86 }}>
        <Titular texto={t.titular} kit={kit} color={acento} resaltado={mezclar(p.secundario, '#000000', 0.15)} max={150} />
      </div>
      <div style={{ position: 'absolute', left: 30, width: W - fotoW - 80, top: cuerpoTop, height: cuerpoAlto * 0.5, display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
        {iconos.map((x, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, height: icono + 10 }}>
            <Circulo texto={x} i={i} color={acento} fondo="#FFFFFF" tam={icono} />
            <div style={{ flex: 1, height: '100%' }}>
              <Ajustado max={36} min={12} alineado="left" balance={false} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 800, color: acento, textTransform: 'uppercase', lineHeight: 1.05 }}>
                {x}
              </Ajustado>
            </div>
          </div>
        ))}
      </div>
      {t.conProducto !== false ? (
        <div style={{ position: 'absolute', left: 30, top: cuerpoTop + cuerpoAlto * 0.5, width: prod, height: Math.min(prod * 1.1, cuerpoAlto * 0.5) }}>
          <Producto producto={producto} tarjeta={producto?.recortado ? false : true} />
        </div>
      ) : null}
      {t.nota ? (
        <div style={{ position: 'absolute', right: 60, width: fotoW * 0.7, top: z.bottom - 150, height: 130 }}>
          <Mano texto={t.nota} kit={kit} color="#FFFFFF" max={70} giro={-6} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 0, width: W * 0.5, top: z.bottom - 28 }}>
        <Legal texto={t.legal} />
      </div>
    </AbsoluteFill>
  );
}

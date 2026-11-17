// Familia «Oferta» (siempre aparte de las imágenes de dolor): sticker, «casi agotado» y «buena noticia / mala noticia».
// El producto real y grande; un solo sticker girado; la oferta en su franja de abajo.
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { Ajustado, FondoColor, FranjaOferta, Legal, Producto, Sticker, Titular, fuenteTitulo, margenes, mezclar, paleta, FUENTE_TEXTO } from './base.jsx';

function zona(W, H, formato) {
  const m = margenes(formato);
  return { top: H * m.arriba, bottom: H - H * m.abajo, alto: H - H * m.arriba - H * m.abajo };
}

export function StickerOferta({ t, kit, producto, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const z = zona(W, H, formato);
  const vertical = formato === '9:16';
  const tit = z.alto * (vertical ? 0.2 : 0.22);
  const franja = vertical ? 130 : 110;
  const prodTop = z.top + tit + 10;
  const prodAlto = z.bottom - prodTop - franja - 50;
  return (
    <AbsoluteFill>
      <FondoColor color={p.primario} />
      <div style={{ position: 'absolute', left: 44, right: 44, top: z.top, height: tit }}>
        <Titular texto={t.titular} kit={kit} color={p.sobrePrimario} resaltado={p.secundario} max={160} />
      </div>
      <div style={{ position: 'absolute', left: W * 0.14, width: W * 0.72, top: prodTop, height: prodAlto }}>
        <Producto producto={producto} />
      </div>
      {t.sticker ? (
        <div style={{ position: 'absolute', right: 34, top: prodTop + prodAlto * 0.04 }}>
          <Sticker texto={t.sticker} kit={kit} tam={vertical ? 300 : 250} giro={12} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - franja - 36 }}>
        <FranjaOferta texto={t.franja} kit={kit} alto={franja} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - 32 }}>
        <Legal texto={t.legal} color={mezclar(p.sobrePrimario, p.primario, 0.3)} />
      </div>
    </AbsoluteFill>
  );
}

export function CasiAgotado({ t, kit, producto, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const z = zona(W, H, formato);
  const vertical = formato === '9:16';
  const fondo = '#141414';
  const rojo = '#E5322D';
  const tit = z.alto * (vertical ? 0.2 : 0.22);
  const franja = vertical ? 130 : 108;
  const barra = 150;
  const prodTop = z.top + tit + 10;
  const prodAlto = z.bottom - prodTop - franja - barra - 70;
  const lleno = Math.max(0.5, Math.min(0.97, Number(t.nivel) || 0.88));
  return (
    <AbsoluteFill style={{ background: fondo }}>
      <AbsoluteFill style={{ background: `radial-gradient(70% 50% at 50% 50%, ${mezclar(p.primario, fondo, 0.35)}, ${fondo})` }} />
      <div style={{ position: 'absolute', left: 44, right: 44, top: z.top, height: tit }}>
        <Titular texto={t.titular} kit={kit} color="#FFFFFF" resaltado={rojo} max={170} />
      </div>
      <div style={{ position: 'absolute', left: W * 0.2, width: W * 0.6, top: prodTop, height: prodAlto }}>
        <Producto producto={producto} />
      </div>
      <div style={{ position: 'absolute', left: 60, right: 60, top: prodTop + prodAlto + 20, height: barra, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ height: 52 }}>
          <Ajustado max={40} min={14} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 800, color: '#FFFFFF' }}>
            {t.estado}
          </Ajustado>
        </div>
        <div style={{ height: 46, borderRadius: 999, background: 'rgba(255,255,255,0.16)', overflow: 'hidden', border: '3px solid rgba(255,255,255,0.35)' }}>
          <div style={{ width: `${lleno * 100}%`, height: '100%', background: `repeating-linear-gradient(-45deg, ${rojo} 0 22px, ${mezclar(rojo, '#000000', 0.18)} 22px 44px)`, borderRadius: 999 }} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - franja - 36 }}>
        <FranjaOferta texto={t.franja} kit={kit} alto={franja} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - 32 }}>
        <Legal texto={t.legal} color="rgba(255,255,255,0.6)" />
      </div>
    </AbsoluteFill>
  );
}

export function BuenaMala({ t, kit, producto, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const z = zona(W, H, formato);
  const vertical = formato === '9:16';
  const verde = '#1E9E5A';
  const rojo = '#D93A2B';
  const ancho = vertical ? W - 100 : W * 0.6;
  const bloqueAlto = (z.alto - (vertical ? z.alto * 0.4 : 60)) / 2 - 20;
  const Bloque = ({ y, etiqueta, texto, color }) => (
    <div style={{ position: 'absolute', left: 50, top: y, width: ancho, height: bloqueAlto, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ alignSelf: 'flex-start', background: color, color: '#fff', borderRadius: 14, padding: '10px 22px', height: 74, minWidth: 300, boxSizing: 'border-box', transform: 'rotate(-2deg)' }}>
        <Ajustado max={52} min={14} estilo={{ fontFamily: fuenteTitulo(kit), textTransform: 'uppercase', lineHeight: 1 }}>
          {etiqueta}
        </Ajustado>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Ajustado max={vertical ? 150 : 96} min={18} alineado="left" vertical="start" estilo={{ fontFamily: fuenteTitulo(kit), color: '#141414', textTransform: 'uppercase', lineHeight: 0.98 }}>
          {texto}
        </Ajustado>
      </div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: p.crema }}>
      <Bloque y={z.top} etiqueta={t.buenaEtiqueta || 'Buena noticia:'} texto={t.buena} color={verde} />
      <Bloque y={z.top + bloqueAlto + 30} etiqueta={t.malaEtiqueta || 'Mala noticia:'} texto={t.mala} color={rojo} />
      <div style={{ position: 'absolute', ...(vertical ? { left: W * 0.22, width: W * 0.56, top: z.top + bloqueAlto * 2 + 70, bottom: H - z.bottom + 140 } : { right: 20, width: W * 0.36, top: z.top + 40, bottom: H - z.bottom + 110 }) }}>
        <Producto producto={producto} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - (vertical ? 130 : 100) - 34 }}>
        <FranjaOferta texto={t.franja} kit={kit} alto={vertical ? 130 : 100} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - 32 }}>
        <Legal texto={t.legal} />
      </div>
    </AbsoluteFill>
  );
}

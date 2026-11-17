// Familia «Nativo de redes»: lo que se ve como contenido de la gente y no como un anuncio. Nota de texto plano,
// burbujas de chat «tus problemas / nuestro consejo», foto casera con subtítulos de TikTok, reseña tipo tuit con 3
// íconos y captura de un comentario con su respuesta. Solo la foto casera necesita una escena.
import { AbsoluteFill, Img, useVideoConfig } from 'remotion';
import { Ajustado, Escena, Estrellas, Legal, Mano, Producto, Verificado, margenes, paleta, FUENTE_TEXTO, mezclar, fuenteTitulo } from './base.jsx';
import { Icono, iconoPara } from './iconos.jsx';

function zona(W, H, formato) {
  const m = margenes(formato);
  return { top: H * m.arriba, bottom: H - H * m.abajo, alto: H - H * m.arriba - H * m.abajo };
}

/** Un círculo con la inicial (o la foto del producto, si se pide). */
function Avatar({ tam = 84, nombre = '', color = '#999', producto = null }) {
  if (producto?.url) {
    return (
      <div style={{ width: tam, height: tam, borderRadius: 999, overflow: 'hidden', background: '#fff', border: '2px solid #e5e5e5', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Img src={producto.url} style={{ width: '86%', height: '86%', objectFit: 'contain' }} />
      </div>
    );
  }
  return (
    <div style={{ width: tam, height: tam, borderRadius: 999, background: color, color: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FUENTE_TEXTO, fontWeight: 800, fontSize: tam * 0.44 }}>
      {String(nombre || '?').trim().charAt(0).toUpperCase()}
    </div>
  );
}

// ---------------------------------------------------------------- nota de texto plano

export function NotaTexto({ t, kit, producto, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const z = zona(W, H, formato);
  const vertical = formato === '9:16';
  const prod = W * (vertical ? 0.34 : 0.26);
  return (
    <AbsoluteFill style={{ background: '#FFFFFF' }}>
      <div style={{ position: 'absolute', left: 60, right: 60, top: z.top, height: 56, display: 'flex', alignItems: 'center', gap: 10, fontFamily: FUENTE_TEXTO, fontSize: 30, fontWeight: 600, color: '#E0A100' }}>
        <svg width="22" height="34" viewBox="0 0 12 20"><path d="M10 2 2 10l8 8" fill="none" stroke="#E0A100" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Notas
      </div>
      <div style={{ position: 'absolute', left: 60, right: 60, top: z.top + 80, height: z.alto * (vertical ? 0.2 : 0.25) }}>
        <Ajustado max={vertical ? 96 : 84} min={24} alineado="left" vertical="start" balance={false} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 850, color: '#111', lineHeight: 1.06, letterSpacing: '-0.02em' }}>
          {t.titulo}
        </Ajustado>
      </div>
      <div style={{ position: 'absolute', left: 60, right: 60, top: z.top + 80 + z.alto * (vertical ? 0.22 : 0.27), bottom: H - z.bottom + prod * 0.62 }}>
        <Ajustado max={vertical ? 50 : 44} min={16} alineado="left" vertical="start" balance={false} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 450, color: '#2a2a2a', lineHeight: 1.36 }}>
          {t.texto}
        </Ajustado>
      </div>
      <div style={{ position: 'absolute', right: 40, top: z.bottom - prod - 10, width: prod, height: prod, transform: 'rotate(4deg)' }}>
        <Producto producto={producto} base={false} />
      </div>
      <div style={{ position: 'absolute', left: 0, width: W * 0.62, top: z.bottom - 32 }}>
        <Legal texto={t.legal} />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- burbujas: tus problemas / nuestro consejo

export function Burbujas({ t, kit, producto, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const z = zona(W, H, formato);
  const vertical = formato === '9:16';
  const problemas = (t.problemas || []).filter(Boolean).slice(0, 3);
  const azul = '#0A84FF';
  const cabecera = 120;
  const cuerpoTop = z.top + cabecera + 20;
  const cuerpoAlto = z.bottom - cuerpoTop - (vertical ? 260 : 40);
  const n = problemas.length + 1;
  const hueco = 18;
  const altoBurbuja = (cuerpoAlto - 90 - hueco * n) / n;
  return (
    <AbsoluteFill style={{ background: '#FFFFFF' }}>
      {/* la cabecera del chat */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.top, height: cabecera, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, borderBottom: '2px solid #ececec' }}>
        <Avatar tam={70} producto={producto} />
        <div style={{ fontFamily: FUENTE_TEXTO, fontSize: 24, fontWeight: 600, color: '#333' }}>{t.contacto}</div>
      </div>
      <div style={{ position: 'absolute', left: 40, top: cuerpoTop - 18, width: W * 0.5, height: 64 }}>
        <Mano texto={t.etiquetaProblemas || 'tus problemas'} kit={kit} color="#8a8a8e" max={54} alineado="left" giro={-2} />
      </div>
      {problemas.map((x, i) => (
        <div key={i} style={{ position: 'absolute', left: 36, top: cuerpoTop + 50 + i * (altoBurbuja + hueco), maxWidth: W * 0.72, width: W * 0.72, height: altoBurbuja, display: 'flex' }}>
          <div style={{ background: '#E9E9EB', borderRadius: 36, borderBottomLeftRadius: 10, padding: '16px 28px', boxSizing: 'border-box', width: '100%', height: '100%' }}>
            <Ajustado max={46} min={14} alineado="left" balance={false} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 500, color: '#111', lineHeight: 1.22 }}>
              {x}
            </Ajustado>
          </div>
        </div>
      ))}
      <div style={{ position: 'absolute', right: 40, top: cuerpoTop + 50 + problemas.length * (altoBurbuja + hueco) - 14, width: W * 0.5, height: 64 }}>
        <Mano texto={t.etiquetaConsejo || 'nuestro consejo'} kit={kit} color={azul} max={54} alineado="right" giro={-2} />
      </div>
      <div style={{ position: 'absolute', right: 36, top: cuerpoTop + 90 + problemas.length * (altoBurbuja + hueco), width: W * 0.78, height: altoBurbuja }}>
        <div style={{ background: azul, borderRadius: 36, borderBottomRightRadius: 10, padding: '16px 28px', boxSizing: 'border-box', width: '100%', height: '100%' }}>
          <Ajustado max={48} min={14} alineado="left" balance={false} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 600, color: '#fff', lineHeight: 1.22 }}>
            {t.consejo}
          </Ajustado>
        </div>
      </div>
      {vertical ? (
        <div style={{ position: 'absolute', left: W / 2 - 120, top: z.bottom - 250, width: 240, height: 240 }}>
          <Producto producto={producto} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - 30 }}>
        <Legal texto={t.legal} />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- foto casera con subtítulos de TikTok

export function FotoTiktok({ t, kit, escena, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const z = zona(W, H, formato);
  const lineas = (t.lineas || []).filter(Boolean).slice(0, 3);
  const vertical = formato === '9:16';
  return (
    <AbsoluteFill style={{ background: '#222' }}>
      <Escena escena={escena} kit={kit} posicion="center 60%" />
      <div style={{ position: 'absolute', left: 60, right: 60, top: z.top + z.alto * (vertical ? 0.12 : 0.08), height: z.alto * (vertical ? 0.3 : 0.36) }}>
        <Ajustado max={vertical ? 72 : 64} min={18} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 800, color: '#111', lineHeight: 1.62 }}>
          {lineas.map((l, i) => (
            <span key={i}>
              <span style={{ background: '#FFFFFF', padding: '0.06em 0.32em', borderRadius: '0.22em', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}>{l}</span>
              {i < lineas.length - 1 ? '\n' : ''}
            </span>
          ))}
        </Ajustado>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - 34 }}>
        <Legal texto={t.legal} color="rgba(255,255,255,0.85)" />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- reseña tipo tuit + 3 íconos

export function ResenaTuit({ t, kit, producto, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const z = zona(W, H, formato);
  const vertical = formato === '9:16';
  const iconos = (t.iconos || []).filter(Boolean).slice(0, 3);
  const tarjetaAlto = z.alto * (vertical ? 0.44 : 0.58);
  const abajoTop = z.top + tarjetaAlto + 30;
  const abajoAlto = z.bottom - abajoTop - 30;
  const estrellas = Number(t.estrellas) || 0;
  return (
    <AbsoluteFill style={{ background: p.primario }}>
      <div style={{ position: 'absolute', left: 40, right: 40, top: z.top, height: tarjetaAlto, background: '#FFFFFF', borderRadius: 34, padding: '34px 40px', boxSizing: 'border-box', boxShadow: '0 18px 40px rgba(0,0,0,0.22)', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, height: 92, flexShrink: 0 }}>
          <Avatar tam={88} nombre={t.nombre} color={p.profundo} producto={t.avatarProducto ? producto : null} />
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FUENTE_TEXTO, fontWeight: 800, fontSize: 36, color: '#0f1419', whiteSpace: 'nowrap', overflow: 'hidden' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.nombre}</span>
              {t.verificado !== false ? <Verificado tam={34} /> : null}
            </div>
            <div style={{ fontFamily: FUENTE_TEXTO, fontSize: 28, color: '#536471', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.usuario}</div>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <Ajustado max={vertical ? 64 : 58} min={18} alineado="left" vertical="start" balance={false} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 500, color: '#0f1419', lineHeight: 1.3 }}>
            {t.texto}
          </Ajustado>
        </div>
        {estrellas > 0 ? <Estrellas n={estrellas} tam={42} /> : null}
      </div>
      <div style={{ position: 'absolute', left: 40, top: abajoTop, width: vertical ? W - 80 : W * 0.56, height: vertical ? 190 : abajoAlto, display: 'flex', flexDirection: vertical ? 'row' : 'column', gap: 14 }}>
        {iconos.map((x, i) => (
          <div key={i} style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: vertical ? 'column' : 'row', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 62, height: 62, borderRadius: 999, background: p.secundario, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icono nombre={iconoPara(x, i)} tam={34} color={p.sobreSecundario} grosor={2.6} />
            </div>
            <div style={{ flex: 1, height: '100%', width: '100%', minHeight: 0 }}>
              <Ajustado max={40} min={12} alineado={vertical ? 'center' : 'left'} balance={false} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 750, color: p.sobrePrimario, lineHeight: 1.1 }}>
                {x}
              </Ajustado>
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: vertical ? W * 0.25 : W * 0.6, top: vertical ? abajoTop + 210 : abajoTop - 10, width: vertical ? W * 0.6 : W * 0.38, height: vertical ? abajoAlto - 210 : abajoAlto + 20 }}>
        <Producto producto={producto} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - 32 }}>
        <Legal texto={t.legal} color={mezclar(p.sobrePrimario, p.primario, 0.3)} />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- captura de un comentario

export function Comentario({ t, kit, producto, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const z = zona(W, H, formato);
  const vertical = formato === '9:16';
  const bloque = z.alto * (vertical ? 0.5 : 0.62);
  const Burbuja = ({ nombre, texto, avatar, verificado, ancho, alto, x, y }) => (
    <div style={{ position: 'absolute', left: x, top: y, width: ancho, height: alto, display: 'flex', gap: 16 }}>
      {avatar}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <div style={{ flex: 1, minHeight: 0, background: '#FFFFFF', borderRadius: 30, padding: '18px 26px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FUENTE_TEXTO, fontWeight: 750, fontSize: 30, color: '#050505', height: 40, flexShrink: 0 }}>
            {nombre}
            {verificado ? <Verificado tam={28} color="#0866FF" /> : null}
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Ajustado max={44} min={14} alineado="left" vertical="start" balance={false} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 450, color: '#050505', lineHeight: 1.28 }}>
              {texto}
            </Ajustado>
          </div>
        </div>
        <div style={{ fontFamily: FUENTE_TEXTO, fontSize: 24, fontWeight: 700, color: '#65676B', display: 'flex', gap: 28, paddingLeft: 22, height: 30 }}>
          <span>Me gusta</span>
          <span>Responder</span>
        </div>
      </div>
    </div>
  );
  const altoPregunta = bloque * 0.46;
  return (
    <AbsoluteFill style={{ background: '#F0F2F5' }}>
      <Burbuja x={36} y={z.top} ancho={W - 72} alto={altoPregunta} nombre={t.nombre} texto={t.comentario} avatar={<Avatar tam={78} nombre={t.nombre} color="#8C939D" />} />
      <Burbuja x={120} y={z.top + altoPregunta + 26} ancho={W - 156} alto={bloque - altoPregunta - 26} nombre={t.marca} texto={t.respuesta} verificado avatar={<Avatar tam={70} producto={producto} />} />
      <div style={{ position: 'absolute', left: W * 0.2, width: W * 0.6, top: z.top + bloque + 24, bottom: H - z.bottom + 40 }}>
        <Producto producto={producto} />
      </div>
      {t.nota ? (
        <div style={{ position: 'absolute', left: 30, width: W * 0.26, top: z.top + bloque + 60, height: 160 }}>
          <Mano texto={t.nota} kit={kit} color={p.profundo} max={46} giro={-6} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - 32 }}>
        <Legal texto={t.legal} />
      </div>
    </AbsoluteFill>
  );
}

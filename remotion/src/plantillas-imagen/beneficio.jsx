// Familia «Beneficio explicado»: producto con flechas, lista de beneficios con íconos, producto protagonista con la
// barra de datos y el mecanismo con una flecha. Ninguna necesita una escena: salen de la foto del producto.
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { Ajustado, CapaDibujo, Flecha, FondoColor, Legal, Mano, Producto, Titular, fuenteTitulo, margenes, mezclar, paleta, FUENTE_TEXTO } from './base.jsx';
import { Icono, iconoPara } from './iconos.jsx';

/** La zona útil (sin las bandas de seguridad del 9:16). */
function zona(W, H, formato) {
  const m = margenes(formato);
  const top = H * m.arriba;
  const bottom = H - H * m.abajo;
  return { top, bottom, alto: bottom - top };
}

// ---------------------------------------------------------------- producto con flechas

export function ProductoFlechas({ t, kit, producto, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const z = zona(W, H, formato);
  const vertical = formato === '9:16';
  const tit = z.alto * (vertical ? 0.2 : 0.22);
  const cuerpoTop = z.top + tit + 10;
  const cuerpoAlto = z.bottom - cuerpoTop - 40;
  const prod = { w: W * (vertical ? 0.4 : 0.36), h: cuerpoAlto * (vertical ? 0.62 : 0.82) };
  const prodX = W / 2 - prod.w / 2;
  const prodY = cuerpoTop + (cuerpoAlto - prod.h) / 2;
  const etiquetas = (t.flechas || []).filter((x) => x && (x.ingrediente || x.beneficio)).slice(0, 4);
  const caja = { w: W * 0.29, h: Math.min(cuerpoAlto * (vertical ? 0.2 : 0.3), 260) };
  // las 4 esquinas: arriba-izquierda, arriba-derecha, abajo-izquierda, abajo-derecha
  const lugares = vertical
    ? [
        { x: 26, y: cuerpoTop + cuerpoAlto * 0.12 },
        { x: W - 26 - caja.w, y: cuerpoTop + cuerpoAlto * 0.12 },
        { x: 26, y: cuerpoTop + cuerpoAlto * 0.88 - caja.h },
        { x: W - 26 - caja.w, y: cuerpoTop + cuerpoAlto * 0.88 - caja.h },
      ]
    : [
        { x: 30, y: cuerpoTop + cuerpoAlto * 0.04 },
        { x: W - 30 - caja.w, y: cuerpoTop + cuerpoAlto * 0.04 },
        { x: 30, y: cuerpoTop + cuerpoAlto * 0.96 - caja.h },
        { x: W - 30 - caja.w, y: cuerpoTop + cuerpoAlto * 0.96 - caja.h },
      ];
  return (
    <AbsoluteFill>
      <FondoColor color={p.primario} />
      <div style={{ position: 'absolute', left: 44, right: 44, top: z.top, height: tit }}>
        <Titular texto={t.titular} kit={kit} color={p.sobrePrimario} resaltado={p.secundario} max={150} />
      </div>
      <div style={{ position: 'absolute', left: prodX, top: prodY, width: prod.w, height: prod.h }}>
        <Producto producto={producto} />
      </div>
      {etiquetas.map((x, i) => {
        const l = lugares[i];
        const der = i % 2 === 1;
        return (
          <div key={i} style={{ position: 'absolute', left: l.x, top: l.y, width: caja.w, height: caja.h, display: 'flex', flexDirection: 'column', alignItems: der ? 'flex-end' : 'flex-start' }}>
            <div style={{ height: '40%', width: '100%' }}>
              <Ajustado max={58} min={14} alineado={der ? 'right' : 'left'} vertical="end" estilo={{ fontFamily: fuenteTitulo(kit), color: p.secundario, textTransform: 'uppercase', lineHeight: 0.95 }}>
                {x.ingrediente}
              </Ajustado>
            </div>
            <div style={{ height: '60%', width: '100%' }}>
              <Mano texto={x.beneficio} kit={kit} color={p.sobrePrimario} max={52} alineado={der ? 'right' : 'left'} giro={der ? 2 : -2} vertical="start" />
            </div>
          </div>
        );
      })}
      <CapaDibujo>
        {etiquetas.map((_, i) => {
          const l = lugares[i];
          const der = i % 2 === 1;
          const abajo = i >= 2;
          const x1 = der ? l.x + caja.w * 0.35 : l.x + caja.w * 0.65;
          const y1 = abajo ? l.y - 8 : l.y + caja.h + 8;
          const x2 = der ? prodX + prod.w * 0.92 : prodX + prod.w * 0.08;
          const y2 = abajo ? prodY + prod.h * 0.72 : prodY + prod.h * 0.3;
          return <Flecha key={i} x1={x1} y1={y1} x2={x2} y2={y2} curva={(der ? -1 : 1) * (abajo ? -0.22 : 0.22)} color={p.sobrePrimario} grosor={6} punta={22} />;
        })}
      </CapaDibujo>
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - 34 }}>
        <Legal texto={t.legal} color={mezclar(p.sobrePrimario, p.primario, 0.3)} />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- lista de beneficios con íconos

export function ListaIconos({ t, kit, producto, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const z = zona(W, H, formato);
  const vertical = formato === '9:16';
  const filas = (t.beneficios || []).filter(Boolean).slice(0, 6);
  const tit = z.alto * (vertical ? 0.17 : 0.22);
  const cuerpoTop = z.top + tit + 16;
  const cuerpoAlto = z.bottom - cuerpoTop - 36;
  const listaW = vertical ? W - 80 : W * 0.6;
  const listaAlto = vertical ? cuerpoAlto * 0.56 : cuerpoAlto;
  const prodBox = vertical ? { left: W * 0.2, top: cuerpoTop + listaAlto + 20, w: W * 0.6, h: cuerpoAlto - listaAlto - 20 } : { left: W * 0.62, top: cuerpoTop + cuerpoAlto * 0.08, w: W * 0.36, h: cuerpoAlto * 0.86 };
  return (
    <AbsoluteFill style={{ background: p.crema }}>
      <div style={{ position: 'absolute', left: 44, right: 44, top: z.top, height: tit }}>
        <Titular texto={t.titular} kit={kit} color={p.profundo} resaltado={p.primario} max={140} />
      </div>
      <div style={{ position: 'absolute', left: 40, top: cuerpoTop, width: listaW, height: listaAlto, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filas.map((x, i) => (
          <div key={i} style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', gap: 18, background: '#FFFFFF', borderRadius: 22, padding: '0 20px', boxShadow: '0 4px 14px rgba(0,0,0,0.06)' }}>
            <div style={{ width: 64, height: 64, borderRadius: 999, background: p.primario, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icono nombre={iconoPara(x, i)} tam={36} color={p.sobrePrimario} grosor={2.4} />
            </div>
            <div style={{ flex: 1, height: '78%' }}>
              <Ajustado max={44} min={14} alineado="left" balance={false} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 750, color: '#141414', lineHeight: 1.1 }}>
                {x}
              </Ajustado>
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: prodBox.left, top: prodBox.top, width: prodBox.w, height: prodBox.h }}>
        <Producto producto={producto} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - 32 }}>
        <Legal texto={t.legal} />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- producto protagonista + barra de datos

export function BarraDatos({ t, kit, producto, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const z = zona(W, H, formato);
  const vertical = formato === '9:16';
  const datos = (t.datos || []).filter((x) => x && (x.valor || x.etiqueta)).slice(0, 3);
  const tit = z.alto * (vertical ? 0.2 : 0.21);
  const barraAlto = vertical ? 230 : 170;
  const prodTop = z.top + tit + 10;
  const prodAlto = z.bottom - prodTop - barraAlto - 60;
  return (
    <AbsoluteFill>
      <FondoColor color={p.primario} />
      <div style={{ position: 'absolute', left: 44, right: 44, top: z.top, height: tit }}>
        <Titular texto={t.titular} kit={kit} color={p.sobrePrimario} resaltado={p.secundario} max={160} />
      </div>
      <div style={{ position: 'absolute', left: W * 0.15, width: W * 0.7, top: prodTop, height: prodAlto }}>
        <Producto producto={producto} />
      </div>
      <div style={{ position: 'absolute', left: 36, right: 36, top: z.bottom - barraAlto - 44, height: barraAlto, background: '#FFFFFF', borderRadius: 30, display: 'flex', alignItems: 'stretch', boxShadow: '0 14px 30px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        {datos.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 14px', borderLeft: i ? `3px dotted ${mezclar(p.primario, '#ffffff', 0.55)}` : 'none', minWidth: 0 }}>
            <div style={{ height: '58%' }}>
              <Ajustado max={vertical ? 92 : 78} min={14} estilo={{ fontFamily: fuenteTitulo(kit), color: p.profundo, textTransform: 'uppercase', lineHeight: 0.95 }}>
                {d.valor}
              </Ajustado>
            </div>
            <div style={{ height: '42%' }}>
              <Ajustado max={32} min={11} estilo={{ fontFamily: FUENTE_TEXTO, fontWeight: 650, color: '#333', lineHeight: 1.05 }}>
                {d.etiqueta}
              </Ajustado>
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - 36 }}>
        <Legal texto={t.legal} color={mezclar(p.sobrePrimario, p.primario, 0.3)} />
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- mecanismo con flecha

export function Mecanismo({ t, kit, producto, formato }) {
  const { width: W, height: H } = useVideoConfig();
  const p = paleta(kit);
  const z = zona(W, H, formato);
  const vertical = formato === '9:16';
  const tit = z.alto * (vertical ? 0.18 : 0.22);
  const top = z.top + tit + 20;
  const alto = z.bottom - top - 50;
  const rojo = '#D93A2B';
  // tres pasos: el problema, el producto, el resultado
  const caja = vertical ? { w: W - 120, h: alto * 0.2 } : { w: W * 0.3, h: alto * 0.42 };
  const prod = vertical ? { w: W * 0.42, h: alto * 0.34 } : { w: W * 0.32, h: alto * 0.78 };
  const lugares = vertical
    ? { a: { x: 60, y: top }, prod: { x: W / 2 - prod.w / 2, y: top + caja.h + alto * 0.08 }, b: { x: 60, y: top + alto - caja.h } }
    : { a: { x: 26, y: top + alto * 0.08 }, prod: { x: W / 2 - prod.w / 2, y: top + (alto - prod.h) / 2 }, b: { x: W - 26 - caja.w, y: top + alto * 0.5 } };
  const Tarjeta = ({ l, titulo, texto, color, icono }) => (
    <div style={{ position: 'absolute', left: l.x, top: l.y, width: caja.w, height: caja.h, background: '#FFFFFF', borderRadius: 26, border: `4px solid ${color}`, padding: 18, boxSizing: 'border-box', display: 'flex', flexDirection: vertical ? 'row' : 'column', gap: 10, alignItems: vertical ? 'center' : 'stretch' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: vertical ? '100%' : '28%', flexShrink: 0, width: vertical ? '34%' : '100%' }}>
        <Icono nombre={icono} tam={44} color={color} grosor={3} />
        <div style={{ flex: 1, height: '100%' }}>
          <Ajustado max={46} min={12} alineado="left" estilo={{ fontFamily: fuenteTitulo(kit), color, textTransform: 'uppercase', lineHeight: 0.95 }}>
            {titulo}
          </Ajustado>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, height: '100%' }}>
        <Ajustado max={40} min={12} alineado="left" balance={false} estilo={{ fontFamily: FUENTE_TEXTO, color: '#1b1b1b', fontWeight: 650, lineHeight: 1.15 }}>
          {texto}
        </Ajustado>
      </div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: p.suave }}>
      <div style={{ position: 'absolute', left: 44, right: 44, top: z.top, height: tit }}>
        <Titular texto={t.titular} kit={kit} color={p.profundo} resaltado={p.primario} max={140} />
      </div>
      <div style={{ position: 'absolute', left: lugares.prod.x, top: lugares.prod.y, width: prod.w, height: prod.h }}>
        <Producto producto={producto} />
      </div>
      <Tarjeta l={lugares.a} titulo={t.problemaTitulo || 'El problema'} texto={t.problema} color={rojo} icono="x" />
      <Tarjeta l={lugares.b} titulo={t.resultadoTitulo || 'El resultado'} texto={t.resultado} color={p.profundo} icono="check" />
      <CapaDibujo>
        {vertical ? (
          <>
            <Flecha x1={W * 0.2} y1={lugares.a.y + caja.h + 6} x2={lugares.prod.x - 10} y2={lugares.prod.y + prod.h * 0.45} curva={0.25} color={p.profundo} grosor={7} />
            <Flecha x1={lugares.prod.x + prod.w + 10} y1={lugares.prod.y + prod.h * 0.55} x2={W * 0.8} y2={lugares.b.y - 8} curva={0.25} color={p.profundo} grosor={7} />
          </>
        ) : (
          <>
            <Flecha x1={lugares.a.x + caja.w * 0.55} y1={lugares.a.y + caja.h + 10} x2={lugares.prod.x + 10} y2={lugares.prod.y + prod.h * 0.62} curva={0.3} color={p.profundo} grosor={7} />
            <Flecha x1={lugares.prod.x + prod.w - 10} y1={lugares.prod.y + prod.h * 0.36} x2={lugares.b.x + caja.w * 0.45} y2={lugares.b.y - 10} curva={0.3} color={p.profundo} grosor={7} />
          </>
        )}
      </CapaDibujo>
      {t.nota ? (
        <div style={{ position: 'absolute', left: vertical ? 60 : 30, width: vertical ? W - 120 : W * 0.3, top: vertical ? lugares.prod.y + prod.h + 6 : top + alto * 0.62, height: vertical ? alto * 0.12 : alto * 0.3 }}>
          <Mano texto={t.nota} kit={kit} color={p.profundo} max={54} giro={-3} />
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 0, right: 0, top: z.bottom - 32 }}>
        <Legal texto={t.legal} />
      </div>
    </AbsoluteFill>
  );
}

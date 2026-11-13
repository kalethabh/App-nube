// Los 10 estilos de subtítulos del editor (PROPUESTA-APP.md, sección H).
//
// Todos salen de los MISMOS tiempos por palabra del plan de montaje (ElevenLabs / Scribe): cambiar de
// estilo nunca mueve un tiempo. Se dibujan en el espacio del video (720 × 1280) y con el segundo `t`
// que se les pase, así sirven igual para la vista previa grande y el video exportado (dentro de la
// composición AnuncioEditado, sincronizados con su cuadro) y para las muestras animadas de la galería.
//
// "Caja" es copia fiel de los subtítulos de remotion/src/Anuncio.jsx: es lo que entrega el sistema.
//
// Vive en remotion/src/edicion/ para que la vista previa del editor (app/, con Vite) y el render
// (produccion/exportar-edicion.js, con el webpack de Remotion) usen este mismo archivo.
import { createContext, useContext } from 'react';
import { FUENTES } from './fuentes.js';
import { COLOR_PROPIO, colorDeEstilo } from '../capas.mjs';

// ---------------------------------------------------------------- utilidades

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** rápido al principio y frena suave */
const salida = (k) => 1 - Math.pow(1 - clamp01(k), 3);
/** resorte: arranca en 0, se pasa de 1 y se asienta en 1 */
const resorte = (dt, firmeza = 11, frecuencia = 24) => (dt <= 0 ? 0 : 1 - Math.exp(-dt * firmeza) * Math.cos(dt * frecuencia));
/** la palabra que se está diciendo (mismo margen que el render) */
const activa = (p, t) => t >= p.inicio - 0.02 && t < p.fin + 0.06;
/** margen para que una palabra que crece empuje a sus vecinas en vez de pisarlas */
const empuje = (s, texto, k = 0.3) => (s > 1 ? `0 ${((s - 1) * k * [...String(texto)].length).toFixed(3)}em` : 0);

function aRgb(hex) {
  const h = String(hex || '#ffffff').replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const aHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

/** mezcla dos colores: k = 0 -> a, k = 1 -> b */
export function mezclar(a, b, k) {
  const x = aRgb(a);
  const y = aRgb(b);
  return aHex(x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k);
}

/** gira el tono de un color (para el segundo tono del degradado) */
export function girar(hex, grados) {
  let [r, g, b] = aRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = (h * 60 + grados + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return aHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/** índice del bloque que se ve en el segundo t (o -1) */
export function indiceDeBloque(bloques, t) {
  let lo = 0;
  let hi = bloques.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const b = bloques[mid];
    if (t < b.inicio) hi = mid - 1;
    else if (t >= b.fin) lo = mid + 1;
    else return mid;
  }
  return -1;
}

// ---------------------------------------------------------------- piezas comunes

/**
 * Lo que la capa de un subtítulo recibe de Subtitulos: su marca para el editor (data-capa="sub:<bloque>", con la que
 * se arrastra en la vista previa; el rectángulo es el de su contenido) y el corrimiento a lo ancho, en píxeles.
 * En las muestras de la galería no hay: la capa queda como siempre.
 */
const LugarDeCapa = createContext(null);

function Capa({ abajo, children, style }) {
  const lugar = useContext(LugarDeCapa);
  return (
    <div
      {...(lugar?.capa ? { 'data-capa': lugar.capa, 'data-capa-contenido': '' } : {})}
      style={{
        ...(lugar?.dx ? { transform: `translateX(${lugar.dx}px)` } : {}),
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: abajo,
        paddingLeft: '8%',
        paddingRight: '8%',
        pointerEvents: 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

const fila = { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', textAlign: 'center', maxWidth: '100%' };
const palabra = { display: 'inline-block', whiteSpace: 'nowrap', position: 'relative' };

// ---------------------------------------------------------------- 1. Caja (el de siempre)

function Caja({ b, t, fs, abajo, color }) {
  const contorno = Math.max(1, Math.round(fs * 0.135));
  const pad = fs * 0.12;
  return (
    <Capa abajo={abajo}>
      <div style={{ ...fila, columnGap: '0.26em', rowGap: fs * 0.06, fontFamily: FUENTES.caja, fontSize: fs, lineHeight: 1.1, color: 'white', textTransform: 'uppercase' }}>
        {b.palabras.map((p, j) => {
          const a = activa(p, t);
          return (
            <span
              key={j}
              style={{
                ...palabra,
                padding: a ? `${pad * 0.5}px ${pad}px` : 0,
                margin: a ? 0 : `${pad * 0.5}px ${pad}px`,
                borderRadius: a ? fs * 0.1 : 0,
                backgroundColor: a ? color : 'transparent',
                WebkitTextStroke: `${contorno}px black`,
                paintOrder: 'stroke fill',
                textShadow: '0 5px 14px rgba(0,0,0,0.55)',
              }}
            >
              {p.texto}
            </span>
          );
        })}
      </div>
    </Capa>
  );
}

// ---------------------------------------------------------------- 2. Pop

function Pop({ b, t, fs, abajo, color }) {
  const f = fs * 1.06;
  const tono = mezclar(color, '#ffffff', 0.12);
  return (
    <Capa abajo={abajo}>
      <div style={{ ...fila, columnGap: '0.28em', rowGap: f * 0.04, fontFamily: FUENTES.titulo, fontWeight: 800, fontSize: f, lineHeight: 1.06, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
        {b.palabras.map((p, j) => {
          const a = activa(p, t);
          const dt = t - p.inicio + 0.02;
          const s = a ? 0.9 + 0.24 * resorte(dt, 10, 22) : 1;
          const giro = a ? -3 * (1 - clamp01(dt / 0.28)) : 0;
          return (
            <span
              key={j}
              style={{
                ...palabra,
                zIndex: a ? 1 : 0,
                margin: empuje(s, p.texto, 0.34),
                color: a ? tono : '#fff',
                transform: `scale(${s}) rotate(${giro}deg)`,
                transformOrigin: '50% 70%',
                WebkitTextStroke: `${Math.round(f * 0.13)}px #000`,
                paintOrder: 'stroke fill',
                textShadow: `0 ${f * 0.07}px ${f * 0.22}px rgba(0,0,0,0.55)`,
              }}
            >
              {p.texto}
            </span>
          );
        })}
      </div>
    </Capa>
  );
}

// ---------------------------------------------------------------- 3. Una palabra gigante

function Gigante({ b, i, t, fs, abajo, alto, ancho, color }) {
  let j = 0;
  for (let k = 0; k < b.palabras.length; k++) if (t >= b.palabras[k].inicio - 0.03) j = k;
  const p = b.palabras[j];
  const texto = String(p.texto).toUpperCase();
  const largo = Math.max(3, [...texto].length);
  const f = Math.min(fs * 2.5, (ancho * 0.86) / (largo * 0.5));
  const dt = t - p.inicio + 0.03;
  const k = salida(dt / 0.16);
  const resaltada = (i + j) % 2 === 1;
  return (
    <Capa abajo={Math.max(abajo, alto * 0.3)}>
      <div
        style={{
          fontFamily: FUENTES.angosta,
          fontWeight: 800,
          fontStretch: '75%',
          fontSize: f,
          lineHeight: 0.95,
          whiteSpace: 'nowrap',
          color: resaltada ? mezclar(color, '#ffffff', 0.08) : '#fff',
          WebkitTextStroke: `${Math.round(f * 0.055)}px #000`,
          paintOrder: 'stroke fill',
          textShadow: `0 ${f * 0.05}px 0 rgba(0,0,0,0.9), 0 ${f * 0.1}px ${f * 0.32}px rgba(0,0,0,0.5)`,
          transform: `scale(${1.45 - 0.45 * k}) rotate(${(1 - k) * -5}deg)`,
          opacity: clamp01(dt / 0.05 + 0.3),
        }}
      >
        {texto}
      </div>
    </Capa>
  );
}

// ---------------------------------------------------------------- 4. Karaoke

function Karaoke({ b, t, fs, abajo, color }) {
  const relleno = mezclar(color, '#ffffff', 0.1);
  const borde = `${Math.max(2, Math.round(fs * 0.11))}px #000`;
  const capa = { WebkitTextStroke: borde, paintOrder: 'stroke fill' };
  return (
    <Capa abajo={abajo}>
      <div
        style={{
          ...fila,
          columnGap: '0.26em',
          rowGap: fs * 0.05,
          fontFamily: FUENTES.ui,
          fontWeight: 900,
          fontSize: fs,
          lineHeight: 1.1,
          textTransform: 'uppercase',
          letterSpacing: '-0.015em',
          textShadow: `0 ${fs * 0.07}px ${fs * 0.2}px rgba(0,0,0,0.5)`,
        }}
      >
        {b.palabras.map((p, j) => {
          const prog = clamp01((t - p.inicio) / Math.max(0.06, p.fin - p.inicio)) * 100;
          return (
            <span key={j} style={palabra}>
              <span style={{ ...capa, color: '#fff' }}>{p.texto}</span>
              {prog > 0 ? (
                <span aria-hidden="true" style={{ ...capa, position: 'absolute', left: 0, top: 0, color: relleno, textShadow: 'none', clipPath: `inset(-30% ${100 - prog}% -30% -10%)` }}>
                  {p.texto}
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
    </Capa>
  );
}

// ---------------------------------------------------------------- 5. Creador

function Creador({ b, t, fs, abajo, color }) {
  const f = fs * 1.04;
  return (
    <Capa abajo={abajo}>
      <div
        style={{
          ...fila,
          columnGap: '0.22em',
          rowGap: f * 0.02,
          fontFamily: FUENTES.cursiva,
          fontWeight: 900,
          fontSize: f,
          lineHeight: 1.06,
          textTransform: 'uppercase',
          letterSpacing: '-0.01em',
          transform: 'rotate(-3.5deg)',
        }}
      >
        {b.palabras.map((p, j) => {
          const a = activa(p, t);
          const s = a ? 1 + 0.1 * salida((t - p.inicio + 0.02) / 0.12) : 1;
          return (
            <span
              key={j}
              style={{
                ...palabra,
                zIndex: a ? 1 : 0,
                margin: empuje(s, p.texto, 0.36),
                color: a ? color : '#fff',
                WebkitTextStroke: `${Math.round(f * 0.2)}px #000`,
                paintOrder: 'stroke fill',
                textShadow: `${f * 0.03}px ${f * 0.09}px 0 #000`,
                transform: `scale(${s})`,
              }}
            >
              {p.texto}
            </span>
          );
        })}
      </div>
    </Capa>
  );
}

// ---------------------------------------------------------------- 6. Degradado

function Degradado({ b, t, fs, abajo, color }) {
  const f = fs * 1.05;
  const claro = mezclar(color, '#ffffff', 0.55);
  const otro = girar(mezclar(color, '#ffffff', 0.1), 42);
  const borde = `${Math.max(2, Math.round(f * 0.11))}px #000`;
  return (
    <Capa abajo={abajo}>
      <div
        style={{
          ...fila,
          columnGap: '0.26em',
          rowGap: f * 0.04,
          fontFamily: FUENTES.titulo,
          fontWeight: 800,
          fontSize: f,
          lineHeight: 1.08,
          textTransform: 'uppercase',
          letterSpacing: '-0.012em',
        }}
      >
        {b.palabras.map((p, j) => {
          const a = activa(p, t);
          const s = a ? 1 + 0.1 * salida((t - p.inicio + 0.02) / 0.14) : 1;
          return (
            <span key={j} style={{ ...palabra, zIndex: a ? 1 : 0, margin: empuje(s, p.texto, 0.34), transform: `scale(${s})` }}>
              {/* debajo: el contorno negro; encima: el relleno (blanco o el degradado) */}
              <span style={{ color: '#000', WebkitTextStroke: borde, paintOrder: 'stroke fill', textShadow: `0 ${f * 0.07}px ${f * 0.2}px rgba(0,0,0,0.5)` }}>{p.texto}</span>
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  ...(a
                    ? { color: 'transparent', backgroundImage: `linear-gradient(170deg, ${claro} 10%, ${color} 55%, ${otro} 100%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text' }
                    : { color: '#fff' }),
                }}
              >
                {p.texto}
              </span>
            </span>
          );
        })}
      </div>
    </Capa>
  );
}

// ---------------------------------------------------------------- 7. De a una

function DeAUna({ b, t, fs, abajo }) {
  const f = fs * 1.02;
  return (
    <Capa abajo={abajo}>
      <div style={{ ...fila, columnGap: '0.26em', rowGap: f * 0.04, fontFamily: FUENTES.titulo, fontWeight: 760, fontSize: f, lineHeight: 1.08, letterSpacing: '-0.015em' }}>
        {b.palabras.map((p, j) => {
          const dt = t - p.inicio + 0.03;
          const k = salida(dt / 0.16);
          return (
            <span
              key={j}
              style={{
                ...palabra,
                color: '#fff',
                opacity: dt > 0 ? k : 0,
                transform: `translateY(${(1 - k) * f * 0.45}px) scale(${0.84 + 0.16 * k})`,
                WebkitTextStroke: `${Math.round(f * 0.1)}px #000`,
                paintOrder: 'stroke fill',
                textShadow: `0 ${f * 0.07}px ${f * 0.2}px rgba(0,0,0,0.5)`,
              }}
            >
              {p.texto}
            </span>
          );
        })}
      </div>
    </Capa>
  );
}

// ---------------------------------------------------------------- 8. Limpio

function Limpio({ b, fs, abajo }) {
  const f = fs * 0.92;
  return (
    <Capa abajo={abajo}>
      <div
        style={{
          maxWidth: '94%',
          fontFamily: FUENTES.ui,
          fontWeight: 660,
          fontSize: f,
          lineHeight: 1.24,
          color: '#fff',
          textAlign: 'center',
          letterSpacing: '-0.012em',
          textShadow: `0 ${f * 0.05}px ${f * 0.24}px rgba(0,0,0,0.75), 0 0 ${f * 0.06}px rgba(0,0,0,0.55)`,
        }}
      >
        {b.texto}
      </div>
    </Capa>
  );
}

// ---------------------------------------------------------------- 9. Barra (noticia)

function Barra({ b, t, fs, abajo, alto, color }) {
  const f = fs * 0.82;
  const viva = mezclar(color, '#ffffff', 0.3);
  return (
    <Capa abajo={Math.max(alto * 0.06, abajo - alto * 0.02)}>
      <div
        style={{
          display: 'inline-flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          columnGap: '0.3em',
          rowGap: f * 0.1,
          maxWidth: '100%',
          padding: `${f * 0.44}px ${f * 0.64}px ${f * 0.44}px ${f * 0.78}px`,
          background: 'linear-gradient(180deg, rgba(22,22,30,0.9), rgba(8,8,12,0.9))',
          borderRadius: f * 0.24,
          boxShadow: `inset ${f * 0.18}px 0 0 ${color}, inset 0 1px 0 rgba(255,255,255,0.12), 0 ${f * 0.24}px ${f * 0.7}px rgba(0,0,0,0.5)`,
          fontFamily: FUENTES.ui,
          fontWeight: 800,
          fontSize: f,
          lineHeight: 1.16,
          textTransform: 'uppercase',
          letterSpacing: '0.01em',
        }}
      >
        {b.palabras.map((p, j) => {
          const a = activa(p, t);
          const dicha = t >= p.fin;
          return (
            <span key={j} style={{ ...palabra, color: a ? viva : dicha ? '#ffffff' : 'rgba(255,255,255,0.5)', transition: 'none' }}>
              {p.texto}
            </span>
          );
        })}
      </div>
    </Capa>
  );
}

// ---------------------------------------------------------------- 10. Palabras clave + emoji

function Claves({ b, t, fs, abajo, color, marcas }) {
  const f = fs * 1.04;
  const tono = mezclar(color, '#ffffff', 0.1);
  const em = marcas?.emoji || null;
  const pe = em ? b.palabras[em.indice] : null;
  const dtE = pe ? t - pe.inicio + 0.06 : -1;
  return (
    <Capa abajo={abajo}>
      {em && dtE > 0 ? (
        <div
          style={{
            fontFamily: FUENTES.emoji,
            fontSize: f * 1.6,
            lineHeight: 1,
            marginBottom: f * 0.16,
            transform: `scale(${resorte(dtE, 9, 18)}) rotate(${(1 - clamp01(dtE / 0.4)) * -18}deg)`,
            filter: `drop-shadow(0 ${f * 0.12}px ${f * 0.24}px rgba(0,0,0,0.45))`,
          }}
        >
          {em.caracter}
        </div>
      ) : null}
      <div style={{ ...fila, columnGap: '0.24em', rowGap: f * 0.04, fontFamily: FUENTES.titulo, fontWeight: 800, fontSize: f, lineHeight: 1.06, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
        {b.palabras.map((p, j) => {
          const clave = Boolean(marcas?.claves?.[j]);
          const a = activa(p, t);
          const dt = t - p.inicio + 0.02;
          const s = clave ? (a ? 0.98 + 0.2 * resorte(dt, 10, 22) : 1.1) : a ? 1.03 : 1;
          return (
            <span
              key={j}
              style={{
                ...palabra,
                zIndex: clave ? 1 : 0,
                margin: empuje(s, p.texto, 0.34),
                color: clave ? tono : '#fff',
                transform: `scale(${s})`,
                WebkitTextStroke: `${Math.round(f * 0.11)}px #000`,
                paintOrder: 'stroke fill',
                textShadow: `0 ${f * 0.07}px ${f * 0.2}px rgba(0,0,0,0.55)`,
              }}
            >
              {p.texto}
            </span>
          );
        })}
      </div>
    </Capa>
  );
}

// ---------------------------------------------------------------- la lista

export const ESTILOS_SUBTITULOS = [
  { id: 'caja', nombre: 'Caja', lema: 'El de siempre', descripcion: 'Blanco con contorno y la palabra que se dice en una caja de color.', Componente: Caja },
  { id: 'pop', nombre: 'Pop', lema: 'Con rebote', descripcion: 'La palabra que se dice crece con rebote y se pinta de color.', Componente: Pop },
  { id: 'gigante', nombre: 'Una palabra gigante', lema: 'Impacto', descripcion: 'Una sola palabra a la vez, enorme, que entra con fuerza.', Componente: Gigante },
  { id: 'karaoke', nombre: 'Karaoke', lema: 'Se llena', descripcion: 'Cada palabra se llena de color mientras se dice.', Componente: Karaoke },
  { id: 'creador', nombre: 'Creador', lema: 'Estilo TikTok', descripcion: 'Contorno negro grueso, palabra amarilla y un toque inclinado.', Componente: Creador, colorPropio: COLOR_PROPIO.creador },
  { id: 'degradado', nombre: 'Degradado', lema: 'Dos tonos', descripcion: 'La palabra que suena brilla con dos tonos del color del anuncio.', Componente: Degradado },
  { id: 'de-a-una', nombre: 'De a una', lema: 'Aparecen', descripcion: 'Las palabras aparecen justo cuando se dicen.', Componente: DeAUna },
  { id: 'limpio', nombre: 'Limpio', lema: 'Natural', descripcion: 'Sin caja y sin mayúsculas. Ideal para UGC y podcast.', Componente: Limpio },
  { id: 'barra', nombre: 'Barra', lema: 'Noticia', descripcion: 'Sobre una barra oscura, como en las noticias.', Componente: Barra },
  { id: 'claves', nombre: 'Palabras clave + emoji', lema: 'Resalta', descripcion: 'Números, marca y beneficios resaltados, con un emoji que salta.', Componente: Claves, colorPropio: COLOR_PROPIO.claves },
];

export const ESTILO_POR_ID = Object.fromEntries(ESTILOS_SUBTITULOS.map((e) => [e.id, e]));

// El color con que se pinta un estilo (el que eligió el usuario, el propio del estilo o el del anuncio):
// la cuenta vive en capas.mjs, que también la usa el render.
export { colorDeEstilo };

/**
 * Los subtítulos de un instante.
 *   t           segundo actual
 *   bloques     [{ id, inicio, fin, texto, palabras: [{ texto, inicio, fin }], desdeAbajo? }]
 *   tamano      fracción del ancho (la del plan × la del usuario)
 *   altura      fracción desde abajo elegida (alturaBase = la del plan)
 *   lado        corrimiento a lo ancho, fracción del ancho (0 = centrado)
 *   porBloque   los subtítulos movidos solos: { [id]: { altura, lado } } (mandan sobre altura y lado)
 *   marcas      resultado de marcarClaves, indexado por id de bloque
 */
export function Subtitulos({ t, bloques, estilo = 'caja', color, tamano = 0.0722, altura, alturaBase = 0.26, lado = 0, porBloque = null, marcas, ancho = 720, alto = 1280, anchoFuente, conMarca = false }) {
  if (!bloques?.length) return null;
  const i = indiceDeBloque(bloques, t);
  if (i < 0) return null;
  const b = bloques[i];
  if (!b.palabras?.length) return null;
  // anchoFuente: las muestras de la galería son un acercamiento (un cuadro más chico con la letra del video)
  const fs = Math.round((anchoFuente ?? ancho) * tamano);
  const propio = porBloque?.[b.id ?? i] || null;
  const alturaB = Number.isFinite(Number(propio?.altura)) && propio?.altura !== null ? Number(propio.altura) : altura ?? alturaBase;
  const ladoB = Number.isFinite(Number(propio?.lado)) && propio?.lado !== null ? Number(propio.lado) : Number(lado) || 0;
  const desde = (b.desdeAbajo ?? alturaBase) + (alturaB - alturaBase);
  const abajo = alto * Math.max(0.04, Math.min(0.78, desde));
  const { Componente } = ESTILO_POR_ID[estilo] || ESTILO_POR_ID.caja;
  const dx = Math.round(Math.max(-0.35, Math.min(0.35, ladoB)) * ancho);
  return (
    <LugarDeCapa.Provider value={dx || conMarca ? { dx, capa: conMarca ? `sub:${b.id ?? i}` : null } : null}>
      <Componente b={b} i={b.id ?? i} t={t} fs={fs} abajo={abajo} color={color} marcas={marcas?.[b.id ?? i]} ancho={ancho} alto={alto} />
    </LugarDeCapa.Provider>
  );
}

// (2026-11-28a) LA PALETA DE LA OFICINA 3D: sale del tema de la app (estilos/tokens.css y la capa «Ciudad creativa» de
// estilos/tema-juego.css), no de colores propios. Así la escena se ve como el resto de la app: en «Juego», noche violeta
// con neón rosa y turquesa; en «Claro», día de papel lila con rosa; en «Oscuro», la noche de siempre con su acento.
// Oficina3D.jsx la lee una vez al armar la escena (y se vuelve a armar cuando cambia el tema).

const POR_DEFECTO = {
  tema: 'juego',
  neon: '#ff4fa3',
  acento: '#ff4fa3',
  cian: '#29f0dc',
  ok: '#3ef0a8',
  aviso: '#ffb347',
  error: '#ff4d6d',
  neutro: '#9d8cb8',
  tinta: '#090610',
  papel: '#fff4e9',
  rosa: '#ff73b8',
  dorado: '#ffc774',
  turquesa: '#69eadb',
  superficie: '#150d27',
  fuente: "'Bricolage Grotesque Variable', 'Inter Variable', system-ui, sans-serif",
};

let lienzo = null;
/** Cualquier color CSS (#rgb, #rrggbbaa, rgb(), nombre) a '#rrggbb' (sin transparencia), o null si no es un color. */
export function aHex(valor) {
  const v = String(valor || '').trim();
  if (!v) return null;
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  if (/^#[0-9a-f]{8}$/i.test(v)) return v.slice(0, 7).toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) return `#${[...v.slice(1)].map((c) => c + c).join('')}`.toLowerCase();
  try {
    lienzo = lienzo || document.createElement('canvas').getContext('2d');
    lienzo.fillStyle = '#000000';
    lienzo.fillStyle = v;
    const r = lienzo.fillStyle;
    if (/^#[0-9a-f]{6}$/i.test(r)) return r.toLowerCase();
    const m = r.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return `#${m.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
  } catch {
    /* sin canvas */
  }
  return null;
}

/** Mezcla dos colores hex (t = 0 → a, t = 1 → b). */
export function mezclar(a, b, t) {
  const n = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [n(a), n(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

/** La paleta de la escena para el tema que se ve ahora ('juego', 'claro' u 'oscuro'). */
export function paletaDeEscena(tema) {
  const P = { ...POR_DEFECTO, tema: tema || 'juego' };
  let css = null;
  try {
    css = getComputedStyle(document.documentElement);
  } catch {
    return escenario(P);
  }
  const leer = (nombre, si) => aHex(css.getPropertyValue(nombre)) || si;
  P.acento = leer('--acento', P.acento);
  // el neón necesita el tono luminoso: en «Claro» el --acento es oscuro (para letra sobre papel), el de fondo no
  P.neon = leer('--acento-fondo', P.acento);
  P.cian = leer('--cian', P.cian);
  P.ok = leer('--ok', P.ok);
  P.aviso = leer('--aviso', P.aviso);
  P.error = leer('--error', P.error);
  P.neutro = leer('--neutro', P.neutro);
  P.superficie = leer('--superficie-1', P.superficie);
  P.tinta = leer('--ciudad-tinta', tema === 'oscuro' ? '#0b0d0b' : P.tinta);
  P.rosa = leer('--ciudad-rosa', P.neon);
  P.dorado = leer('--ciudad-dorado', P.aviso);
  P.turquesa = leer('--ciudad-turquesa', P.cian);
  const fuente = css.getPropertyValue('--fuente-titulo').trim();
  if (fuente) P.fuente = fuente;
  // los estados de las líneas y las estaciones, con los mismos colores que las insignias de la app
  if (tema === 'claro') {
    // en el día, los tonos de letra del tema claro son oscuros: para brillar en 3D van sus versiones luminosas
    P.cian = P.turquesa === '#087c79' ? '#2fd6cf' : P.turquesa;
    P.ok = '#3fd29a';
    P.aviso = '#ffb347';
    P.error = '#ff5d7a';
  }
  return escenario(P);
}

/** Los colores de la estructura (fondo, piso, losa, paredes, tapicería) según el tema. */
function escenario(P) {
  const claro = P.tema === 'claro';
  const juego = P.tema === 'juego';
  return {
    ...P,
    estado: { trabajando: P.neon, revisando: P.cian, corrigiendo: P.aviso, error: P.error, esperando: P.aviso, hecho: P.ok, libre: P.neutro },
    evento: { pasa: P.cian, devuelve: P.aviso, error: P.error },
    // la losa y los bordes de la planta: la tinta violeta de la ciudad (o el grafito en el tema oscuro)
    losa: juego ? '#241634' : claro ? '#4a3256' : '#24272a',
    negro: juego ? '#120a1e' : claro ? '#2b1a33' : '#0b0b0b',
    // la tapicería de sillones y cojines: rosa, dorado y ciruela en vez del verde oliva de antes
    tapiz: juego ? '#7b3f78' : claro ? '#d48ab8' : '#4b5563',
    cojin: P.rosa,
    cojinB: P.dorado,
    // el día (tema claro) es de papel lila; la noche de «Juego», violeta; la del tema oscuro, la de siempre
    cielo: { dia: claro ? '#efe3ef' : '#e4dcea', noche: '#0d1117', neon: '#160a26' },
    fachada: { dia: claro ? '#c3afcc' : '#a99bb5', noche: '#2a3038', neon: '#3a2052' },
    suelo: { dia: claro ? '#fff6fb' : '#ffffff', noche: '#ffffff', neon: '#6d5f80' },
    luzCielo: { dia: claro ? '#fff0f8' : '#fff6e8', noche: '#fff6e8', neon: '#ffb0dc' },
  };
}

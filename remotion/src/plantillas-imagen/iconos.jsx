// Íconos de línea para las listas y las filas de íconos (trazos de 24×24 al estilo de Lucide, ISC). Se eligen solos
// por las palabras del texto (iconoPara) o por nombre.

const P = {
  check: ['M20 6 9 17l-5-5'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  hoja: ['M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z', 'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12'],
  corazon: ['M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'],
  rayo: ['M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z'],
  escudo: ['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z', 'm9 12 2 2 4-4'],
  reloj: ['M12 6v6l4 2', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z'],
  gota: ['M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z'],
  luna: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
  llama: ['M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z'],
  sonrisa: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z', 'M8 14s1.5 2 4 2 4-2 4-2', 'M9 9h.01', 'M15 9h.01'],
  pulso: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  estrella: ['M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z'],
  sol: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 2v2', 'M12 20v2', 'm4.93 4.93 1.41 1.41', 'm17.66 17.66 1.41 1.41', 'M2 12h2', 'M20 12h2', 'm6.34 17.66-1.41 1.41', 'm19.07 4.93-1.41 1.41'],
  balanza: ['M12 3v18', 'M5 7h14', 'M5 7l-3 7a3 3 0 0 0 6 0z', 'M19 7l-3 7a3 3 0 0 0 6 0z', 'M8 21h8'],
  capsula: ['m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z', 'm8.5 8.5 7 7'],
  flecha: ['M5 12h14', 'm12 5 7 7-7 7'],
  caja: ['M21 8 12 3 3 8v8l9 5 9-5z', 'M3 8l9 5 9-5', 'M12 13v8'],
};

/** Elige un ícono por las palabras del texto (sin tildes). */
export function iconoPara(texto, i = 0) {
  const t = String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  const reglas = [
    [/natural|planta|hierba|extracto|fruto|raiz|vegan|organic/, 'hoja'],
    [/energ|vital|cansan|fuerza|rendim/, 'rayo'],
    [/dorm|sueno|noche|descans/, 'luna'],
    [/grasa|quema|metabol|calor/, 'llama'],
    [/agua|hidrat|retenc|liquid|hinch/, 'gota'],
    [/sin rebote|seguro|garant|confia|protec|defens/, 'escudo'],
    [/rapido|minuto|dia|semana|mes|tiempo/, 'reloj'],
    [/corazon|amor|cuida/, 'corazon'],
    [/peso|engorda|kilo|balanc/, 'balanza'],
    [/capsul|tableta|pastill|dosis|toma/, 'capsula'],
    [/piel|brillo|luz|radiant/, 'sol'],
    [/feliz|confianza|segur|autoestima|sonr/, 'sonrisa'],
    [/salud|circula|digest|pulso/, 'pulso'],
    [/triple|accion|formula|mejor|calidad/, 'estrella'],
  ];
  for (const [re, n] of reglas) if (re.test(t)) return n;
  return ['check', 'estrella', 'hoja', 'rayo', 'escudo', 'corazon'][i % 6];
}

export function Icono({ nombre = 'check', tam = 40, color = '#141414', grosor = 2.2 }) {
  const trazos = P[nombre] || P.check;
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {trazos.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

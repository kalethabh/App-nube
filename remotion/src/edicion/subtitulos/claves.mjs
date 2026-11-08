// Estilo "Palabras clave + emoji": qué palabras se resaltan y qué emoji salta en cada bloque.
// Se marca con reglas simples (sin créditos ni IA): números, la marca del producto y palabras de
// beneficio conocidas.
//
// Va en .mjs (JavaScript puro, sin JSX ni remotion) porque lo usan tres: la composición AnuncioEditado
// (Remotion y la vista previa del editor) y produccion/exportar-edicion.js (Node).

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const limpiar = (w) => sinTildes(String(w).toLowerCase()).replace(/[^a-z0-9ñ]/g, '');

const NUMEROS = /^(\d+.*|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|cuarenta|cincuenta|cien|ciento|mil|primer|primera|primero|doble|triple|mitad)$/;

const EMOJIS = [
  [/^(dorm|duerm|sueno|insomn|desvel|despiert|almohad|noche)/, '😴'],
  [/^(cerebr|mente|memori|concentr|enfoc|neuron)/, '🧠'],
  [/^(corazon)/, '❤️'],
  [/^(energi|cansad|cansanc|agotad|vitalid)/, '⚡'],
  [/^(pierna|rodill|tobill|pies$)/, '🦵'],
  [/^(sangre|circul|vena)/, '🩸'],
  [/^(gratis|envio)/, '🚚'],
  [/^(garanti)/, '✅'],
  [/^(dia$|dias$|semana|mes$|meses)/, '📅'],
  [/^(grasa|peso|kilo|adelgaz|apetit|hambre|antoj|ansied|dulce)/, '🔥'],
  [/^(piel|arrug|brill|radiant|hidrat)/, '✨'],
  [/^(agua|sed$)/, '💧'],
  [/^(dolor|duel|inflam|hinch)/, '😣'],
  [/^(feliz|alegr|sonri)/, '😊'],
  [/^(dinero|precio|pagas|pago|barat|ahorr|oferta|descuent)/, '💸'],
  [/^(rapid|inmediat|minuto)/, '⏱️'],
  [/^(natural|planta|hierba|raiz|organic)/, '🌿'],
  [/^(defensa|inmun|resfri|gripe|virus)/, '🛡️'],
  [/^(muscul|fuerza|fuerte)/, '💪'],
  [/^(secret|truco)/, '🤫'],
  [/^(medic|doctor|cientif|estudio)/, '🩺'],
  [/^(capsul|pastill|gomit|tableta)/, '💊'],
  [/^(cafe$|cafes)/, '☕'],
  [/^(alarma|desperta|reloj)/, '⏰'],
  [/^(manana$|sol$|amanec)/, '☀️'],
  [/^(cama$|colchon)/, '🛏️'],
  [/^(estomag|gastrit|digest|intestin|panza|barriga)/, '🫶'],
];

const VACIAS = new Set(['para', 'como', 'pero', 'porque', 'cuando', 'donde', 'esto', 'esta', 'este', 'todo', 'todos', 'nada', 'algo', 'cada', 'desde', 'hasta', 'sobre', 'entre', 'tambien']);

/** Palabras de la marca o del producto (del título del anuncio). */
export function palabrasDeMarca(titulo) {
  return new Set(
    String(titulo || '')
      .split(/\s+/)
      .map(limpiar)
      .filter((w) => w.length >= 4 && !VACIAS.has(w))
  );
}

/**
 * Para cada bloque de subtítulos: qué palabras son clave y qué emoji lleva.
 *   -> [{ claves: [true, false, ...], emoji: { indice: 2, caracter: '😴' } | null }]
 */
export function marcarClaves(bloques, marca) {
  return bloques.map((b) => {
    const palabras = b.palabras || [];
    const claves = palabras.map((p) => {
      const w = limpiar(p.texto);
      if (!w) return false;
      if (NUMEROS.test(w) || marca.has(w)) return true;
      return EMOJIS.some(([re]) => re.test(w));
    });
    let emoji = null;
    for (let j = 0; j < palabras.length && !emoji; j++) {
      const w = limpiar(palabras[j].texto);
      const hallado = EMOJIS.find(([re]) => re.test(w));
      if (hallado) emoji = { indice: j, caracter: hallado[1] };
    }
    if (!emoji && /^¿/.test(palabras[0]?.texto || '')) emoji = { indice: 0, caracter: '🤔' };
    if (!emoji) {
      const j = palabras.findIndex((p) => marca.has(limpiar(p.texto)));
      if (j >= 0) emoji = { indice: j, caracter: '⭐' };
    }
    return { claves, emoji };
  });
}

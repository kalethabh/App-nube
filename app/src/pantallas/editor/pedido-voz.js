// Editar con IA, sin la IA: «Lo que diga AMUA mutearlo» se entiende aquí y se hace gratis (EditarConIA.jsx).
// Todo es cálculo puro.
const MUTEAR = /\b(mute|mutea\w*|mutear\w*|muteo|muted?|silenci\w*|calla\w*|enmudec\w*|sin sonido|quit\w* (el )?(sonido|audio)|que no (se )?(escuche|oiga|suene))\b/i;
const PITAR = /\b(pitido|piti\w*|bip\w*|beep\w*|pita\w*|censur\w*|tapa\w* con un (bip|pitido))\b/i;
// lo que habla de la PANTALLA, de escenas o de textos nuevos va a la IA
const DE_PANTALLA = /\b(pantalla|se ve|se lee|escrit\w*|letrero|texto|textos|coloca\w*|pon\w*|reemplaz\w*|difumin\w*|escena\w*|toma\w*|recort\w*|imagen\w*|logo)\b/i;
const SOBRAN = new Set(['lo', 'la', 'los', 'las', 'le', 'se', 'que', 'y', 'en', 'el', 'de', 'del', 'todo', 'toda', 'todas', 'todos', 'cada', 'vez', 'veces', 'cuando', 'donde', 'mutear', 'mutearlo', 'mutea', 'muteala', 'mutealo', 'silencia', 'silenciar', 'silenciarlo', 'silencialo', 'censura', 'censurar', 'censuralo', 'censurarlo', 'pitido', 'bip', 'beep', 'con', 'un', 'una', 'por', 'favor', 'quita', 'quitar', 'sonido', 'audio', 'callar', 'calla']);

/**
 * «Lo que diga AMUA mutearlo», «silencia cuando dice "gratis"», «pitido en todo lo que diga amua»: pedidos de callar o
 * ponerle pitido a lo que dice la voz, que se hacen aquí mismo, gratis y al instante (capas.buscarDichas, el mismo de la
 * pestaña Audio). -> { palabras: [...], modo } o null (si no se entiende, o habla de la pantalla: va a la IA).
 */
export function pedidoDeVoz(texto) {
  const t = String(texto || '').trim();
  const mutea = MUTEAR.test(t);
  const pita = PITAR.test(t);
  if (!mutea && !pita) return null;
  if (DE_PANTALLA.test(t.replace(/["«“'‘][^"»”'’]+["»”'’]/g, ' '))) return null;
  const modo = mutea && !/\b(pitido|bip\w*|beep\w*)\b/i.test(t) ? 'silencio' : 'pitido';
  // entre comillas: «amua», "gratis", 'a mua'
  const comillas = [...t.matchAll(/["«“'‘]([^"»”'’]{1,60})["»”'’]/g)].map((m) => m[1].trim()).filter(Boolean);
  if (comillas.length) return { palabras: comillas, modo };
  // después de «diga», «dice», «la palabra»: hasta el verbo o el final
  const m = /\b(?:diga|digan|dice|dicen|dijo|menciona|mencione|nombra|nombre|pronuncia|la palabra|palabra)\s+(.+)$/i.exec(t);
  if (m) {
    const partes = m[1].split(/[\s,.;:!?¡¿]+/).filter(Boolean);
    const salida = [];
    for (const w of partes) {
      if (SOBRAN.has(w.toLowerCase()) || MUTEAR.test(w) || PITAR.test(w)) break;
      salida.push(w);
      if (salida.length >= 3) break;
    }
    if (salida.length) return { palabras: [salida.join(' ')], modo };
  }
  // una palabra en MAYÚSCULAS («mutea AMUA»)
  const mayus = t.split(/[\s,.;:!?¡¿]+/).filter((w) => w.length >= 2 && w === w.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(w) && !SOBRAN.has(w.toLowerCase()));
  if (mayus.length) return { palabras: [mayus.join(' ')], modo };
  return null;
}


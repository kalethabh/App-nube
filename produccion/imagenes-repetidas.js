// Imagenes repetidas: si dos trabajos piden exactamente la misma imagen (mismo
// prompt y mismas referencias), se genera la primera y la otra se copia, sin
// pagarla. Traido de IA-VID-AUTOMATIC (2026-11-08), a pedido del usuario.
// Tambien cuenta el "fotograma" adjunto: con otro fotograma sale otra imagen.
//
// No cuenta como repetida una imagen que depende de su contexto: el frame
// final de una B lleva su propio frame inicial ("frame_inicial_de_esta_toma")
// y "frame_anterior" es la imagen de la toma de antes. Con el mismo texto, esas
// salen distintas.

const CONTEXTUALES = new Set(['frame_inicial_de_esta_toma', 'frame_anterior']);

/** La clave de una imagen, o null si no se puede reusar. */
export function claveDeImagen(prompt, referencias = [], fotograma = null) {
  if (typeof prompt !== 'string' || !prompt.trim()) return null;
  const refs = Array.isArray(referencias) ? referencias : [];
  if (refs.some((r) => CONTEXTUALES.has(r))) return null;
  return `${prompt.trim().replace(/\s+/g, ' ')}|${[...refs].sort().join(',')}|${fotograma || ''}`;
}

/**
 * Para cada trabajo repetido, el trabajo anterior del que se copia.
 * Solo frames de toma y B-roll: las hojas e iconos tienen su propio archivo.
 */
export function repetidas(trabajos) {
  const primera = new Map();
  const copias = new Map();
  for (const t of trabajos) {
    if (t.clase !== 'toma' && t.clase !== 'broll') continue;
    const clave = claveDeImagen(t.prompt, t.referencias, t.fotograma);
    if (!clave) continue;
    if (primera.has(clave)) copias.set(t, primera.get(clave));
    else primera.set(clave, t);
  }
  return copias;
}

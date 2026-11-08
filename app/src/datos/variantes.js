// Variantes del mismo anuncio (otro gancho, otro encuadre): arrancan con la misma toma.
// Para que una rejilla no muestre dos o tres miniaturas iguales, la 2.ª y la 3.ª usan otro cuadro de su video.
import { miniatura } from './api.js';

// solo las variantes que de verdad arrancan con la misma imagen: otro gancho u otro encuadre del mismo anuncio
const VARIANTE = /-(gancho-[a-z0-9]+|esquina)$/;
const baseDe = (a) => `${a.estilo || a.estiloNombre}|${a.slug.replace(VARIANTE, '')}`;

/** Map slug -> url de un cuadro distinto (solo para las variantes que se repetirían). */
export function imagenesDistintas(lista) {
  const vistas = new Map();
  const res = new Map();
  for (const a of lista) {
    const k = baseDe(a);
    const n = vistas.get(k) || 0;
    vistas.set(k, n + 1);
    if (n && a.video && a.duracion) res.set(a.slug, miniatura(a.video, 480, { segundo: Math.round(a.duracion * (0.45 + 0.17 * (n - 1)) * 10) / 10 }));
  }
  return res;
}

// Seguimiento (rutas/seguimiento.js): lo que comparten el panel de un texto o una imagen (PanelCambios: Seguimiento)
// y el campo de la pestaña Textos que crea textos con IA (PanelMedios: CampoTextosIA).
import { useEffect, useState } from 'react';
import { pedirNuevo, useDatos } from '../../datos/api.js';

/** Los textos leídos del video: { estado, valor, error, pistas, leer() } (se refresca solo mientras se leen). */
export function useTextosVideo(slug) {
  const [cadaMs, setCadaMs] = useState(undefined);
  const { datos, recargar } = useDatos(`textos-video:${slug}`, () => pedirNuevo(`/api/anuncios/${encodeURIComponent(slug)}/textos-video`), { cadaMs });
  const estado = datos?.estado || null;
  useEffect(() => setCadaMs(estado === 'leyendo' ? 1500 : undefined), [estado]);
  const leer = async () => {
    await pedirNuevo(`/api/anuncios/${encodeURIComponent(slug)}/textos-video`, { metodo: 'POST', cuerpo: {} });
    await recargar();
  };
  return { estado, valor: datos?.valor || 0, error: datos?.error || null, pistas: datos?.pistas || [], leer };
}

/**
 * Los cambios de un texto o una imagen para que siga a esos textos del video (ids de pistas): { sigue, inicio, fin } o
 * null si ninguno existe. Una pista por aparición (si sale dos veces a la vez, va una copia encima de cada una).
 */
export function cambiosParaSeguir(pistas, ids, siempre, total) {
  const elegidas = pistas.filter((p) => ids.includes(p.id));
  if (!elegidas.length) return null;
  const desde = Math.min(...elegidas.map((p) => p.desde));
  const hasta = Math.max(...elegidas.map((p) => p.hasta));
  const texto = [...new Set(elegidas.map((p) => p.texto))].slice(0, 3).join(' · ');
  const sigue = { texto, siempre: Boolean(siempre), pistas: elegidas.map((p) => p.apariciones) };
  return siempre
    ? { sigue, inicio: 0, fin: Math.round(total * 100) / 100 }
    : { sigue, inicio: Math.max(0, desde - 0.6), fin: Math.min(total, hasta + 0.7) };
}

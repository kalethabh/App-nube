// Lo que la pantalla de producción pide además del detalle del anuncio (server/rutas/produccion.js).
import { useDatos } from '../../datos/api.js';

async function pedirProduccion(slug) {
  let r;
  try {
    r = await fetch(`/api/anuncios/${encodeURIComponent(slug)}/produccion`, { headers: { Accept: 'application/json' } });
  } catch {
    throw new Error('No pude conectar con la app. ¿Sigue abierta la ventana del servidor?');
  }
  const datos = await r.json().catch(() => null);
  if (!r.ok) throw new Error(datos?.error || 'No pude leer la producción de este anuncio.');
  return datos;
}

/** { arreglos, modelos, revisiones, oido, fechas } */
export const useProduccion = (slug, opciones) => useDatos(slug ? `produccion:${slug}` : null, () => pedirProduccion(slug), opciones);

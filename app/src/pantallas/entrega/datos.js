// Datos propios de la entrega: el informe (GET /api/entrega/:slug) y "Abrir carpeta"
// (POST /api/abrir-carpeta). Las dos rutas están en server/rutas/tablero.js.
import { useDatos } from '../../datos/api.js';

async function pedir(url, opciones) {
  let r;
  try {
    r = await fetch(url, { headers: { Accept: 'application/json', ...(opciones?.body ? { 'Content-Type': 'application/json' } : {}) }, ...opciones });
  } catch {
    throw new Error('No pude conectar con la app. ¿Sigue abierta la ventana del servidor?');
  }
  const datos = await r.json().catch(() => null);
  if (!r.ok) throw new Error(datos?.error || 'Algo salió mal. Vuelve a intentarlo.');
  return datos;
}

/** { decisiones, transiciones, problemas, costo, versionesEsperadas, hermanos, informe? (el informe.json de la app), modoPrueba? } */
export const useEntrega = (slug) => useDatos(slug ? `entrega:${slug}` : null, () => pedir(`/api/entrega/${encodeURIComponent(slug)}`));

/** Abre el explorador de archivos: donde = "videos" (output/, con el video marcado) o "piezas" (temp/<slug>/). */
export const abrirCarpeta = ({ slug, donde = 'videos', archivo }) =>
  pedir('/api/abrir-carpeta', { method: 'POST', body: JSON.stringify({ slug, donde, ...(archivo ? { archivo } : {}) }) });

/** Nombre corto de cada versión (para el reproductor y los botones). */
export const NOMBRE_CORTO = {
  'con-subtitulos': 'Completa',
  'solo-subtitulos': 'Solo subtítulos',
  'sin-subtitulos': 'Sin subtítulos',
  'sin-subtitulos-sin-musica': 'Para CapCut',
};

/** Lo que se muestra de una versión que todavía no está (se está preparando). */
export const VERSION_ESPERADA = {
  'con-subtitulos': { nombre: 'Completa', descripcion: 'Con subtítulos y música' },
  'solo-subtitulos': { nombre: 'Solo subtítulos', descripcion: 'Con subtítulos, sin música' },
  'sin-subtitulos': { nombre: 'Sin subtítulos', descripcion: 'Para poner tus propios textos en CapCut' },
  'sin-subtitulos-sin-musica': { nombre: 'Sin subtítulos ni música', descripcion: 'Limpia, para editar en CapCut' },
};

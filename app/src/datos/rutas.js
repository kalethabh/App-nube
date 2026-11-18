// Enrutador mínimo con hash: #/inicio, #/tablero, #/anuncio/<slug>/editor, #/nuevo?estilo=crochet
// Sin librerías: useRuta() devuelve la ruta actual y cambia sola con el hash.
import { useSyncExternalStore } from 'react';

function leerHash() {
  const h = window.location.hash.replace(/^#/, '') || '/';
  return h.startsWith('/') ? h : `/${h}`;
}

function suscribir(avisar) {
  window.addEventListener('hashchange', avisar);
  return () => window.removeEventListener('hashchange', avisar);
}

/** La ruta completa actual ("/anuncio/befen/editor?x=1"). */
export function useHash() {
  return useSyncExternalStore(suscribir, leerHash, () => '/');
}

/** Separa "/a/b?x=1" en { camino: "/a/b", consulta: URLSearchParams } */
export function partirRuta(ruta) {
  const i = ruta.indexOf('?');
  return {
    camino: i === -1 ? ruta : ruta.slice(0, i),
    consulta: new URLSearchParams(i === -1 ? '' : ruta.slice(i + 1)),
  };
}

/** "/anuncio/:slug/editor" contra "/anuncio/befen/editor" -> { slug: "befen" } o null */
export function emparejar(patron, camino) {
  const p = patron.split('/').filter(Boolean);
  const c = camino.split('/').filter(Boolean);
  if (p.length !== c.length) return null;
  const params = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) {
      try {
        params[p[i].slice(1)] = decodeURIComponent(c[i]);
      } catch {
        return null;
      }
    } else if (p[i] !== c[i]) return null;
  }
  return params;
}

/** Navega a una ruta de la app: ir('/anuncio/befen') */
export function ir(ruta, { reemplazar = false } = {}) {
  const destino = `#${ruta.startsWith('/') ? ruta : `/${ruta}`}`;
  if (reemplazar) {
    window.history.replaceState(null, '', destino);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = destino;
  }
}

const s = (slug) => encodeURIComponent(slug);

/** Las rutas de la app. En un <a> usa href={enlace.anuncio(slug)}; para navegar desde código, ir(rutas.anuncio(slug)). */
export const rutas = {
  inicio: () => '/inicio',
  productos: () => '/productos',
  landings: () => '/landings',
  tablero: () => '/tablero',
  nuevo: (consulta) => `/nuevo${consulta ? `?${new URLSearchParams(consulta)}` : ''}`,
  anuncio: (slug) => `/anuncio/${s(slug)}`,
  produccion: (slug) => `/anuncio/${s(slug)}/produccion`,
  editor: (slug) => `/anuncio/${s(slug)}/editor`,
  estilos: (consulta) => `/estilos${consulta ? `?${new URLSearchParams(consulta)}` : ''}`,
  anuncios: () => '/anuncios',
  editorVideos: () => '/editor',
  saldo: () => '/saldo',
  cambiar: (slug) => (slug ? `/cambiar/${s(slug)}` : '/cambiar'),
  sketch: (slug) => (slug ? `/sketch/${s(slug)}` : '/sketch'),
  aprendizajes: () => '/aprendizajes',
  biblioteca: (consulta) => `/biblioteca${consulta ? `?${new URLSearchParams(consulta)}` : ''}`,
  ajustes: () => '/ajustes',
  componentes: () => '/componentes',
  imagenes: (c) => '/imagenes' + (c ? '?' + new URLSearchParams(c) : ''),
  crearImagenes: (c) => '/imagenes/nuevo' + (c ? '?' + new URLSearchParams(c) : ''),
  loteImagenes: (lote) => `/imagenes/${s(lote)}`,
  inspiracion: (c) => '/inspiracion' + (c ? '?' + new URLSearchParams(c) : ''),
  ganadores: (c) => '/inspiracion' + (c ? '?' + new URLSearchParams(c) : ''), // la antigua «Mejores anuncios»
  investigacion: (id) => (id ? `/investigacion/${s(id)}` : '/investigacion'),
};

/** Lo mismo que `rutas`, pero listo para href ("#/anuncio/befen"). */
export const enlace = Object.fromEntries(Object.entries(rutas).map(([k, f]) => [k, (...a) => `#${f(...a)}`]));

/** El guion de un anuncio de la app (paso 2 de "Nuevo anuncio"): ahí se aprueba, se piden cambios o se reintenta. */
export const enlaceDelGuion = (slug, productoId) => enlace.nuevo({ paso: '2', anuncios: slug, ...(productoId ? { producto: productoId } : {}) });

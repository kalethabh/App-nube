// Los pedidos de Mejores anuncios (server/rutas/ganadores.js).
import { pedirNuevo, useDatos } from '../../datos/api.js';

const enc = encodeURIComponent;

export const ganadores = {
  /** { opciones, creditos, recientes, guardados, buscando } */
  estado: () => pedirNuevo('/api/ganadores'),
  /** { clave, filtros, fecha, anuncios, creditos, desdeCache } */
  buscar: (filtros, { forzar = false } = {}) => pedirNuevo('/api/ganadores/buscar', { metodo: 'POST', cuerpo: { filtros, forzar } }),
  busqueda: (clave) => pedirNuevo(`/api/ganadores/busquedas/${enc(clave)}`),
  guardar: (anuncio) => pedirNuevo('/api/ganadores/guardados', { metodo: 'POST', cuerpo: { anuncio } }),
  quitar: (id) => pedirNuevo(`/api/ganadores/guardados/${enc(id)}`, { metodo: 'DELETE' }),
  /** { id, nombre, valor: "subido:<id>|<nombre>" } */
  adaptar: (anuncio) => pedirNuevo('/api/ganadores/adaptar', { metodo: 'POST', cuerpo: { anuncio } }),
};

export const useGanadores = () => useDatos('ganadores', ganadores.estado);

export const PAIS = { CO: 'Colombia', EC: 'Ecuador', GT: 'Guatemala', MX: 'México', PE: 'Perú', CL: 'Chile', AR: 'Argentina', BO: 'Bolivia', PA: 'Panamá', CR: 'Costa Rica', DO: 'Rep. Dominicana', PY: 'Paraguay', UY: 'Uruguay', SV: 'El Salvador', HN: 'Honduras', NI: 'Nicaragua', VE: 'Venezuela', ES: 'España', US: 'Estados Unidos' };

/** "Drenaje linfático · Colombia, Ecuador · video · 14+ días" */
export function resumenFiltros(f, nichos = []) {
  if (!f) return '';
  const partes = [];
  if (f.texto) partes.push(`«${f.texto}»`);
  partes.push(f.paises?.length ? f.paises.map((p) => PAIS[p] || p).join(', ') : 'Todos los países');
  const n = (f.nichos || []).map((id) => nichos.find((x) => x.id === id)?.nombre).filter(Boolean);
  if (n.length) partes.push(n.join(', '));
  if (f.formato) partes.push(f.formato === 'image' ? 'imagen' : 'video');
  if (f.diasMin) partes.push(`${f.diasMin}+ días`);
  return partes.filter(Boolean).join(' · ');
}

/** Agrupa los anuncios del mismo anunciante (TrendTrack a veces devuelve varias versiones del mismo). */
export function agruparPorMarca(anuncios) {
  const grupos = new Map();
  for (const a of anuncios || []) {
    const k = a.anunciante?.pagina || a.anunciante?.nombre || a.id;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(a);
  }
  return [...grupos.entries()].map(([clave, lista]) => ({ clave, lista }));
}

/** El video de un anuncio, servido por la app (se reproduce en cualquier navegador). */
export const urlMedia = (url) => `/api/ganadores/media?u=${encodeURIComponent(url)}`;

export const miles = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString('es-CO') : '—');

// Los pedidos de Inspiración: la búsqueda, los guardados y el video siguen en /api/ganadores (server/rutas/ganadores.js);
// los formatos, las marcas y replicar una imagen, en /api/inspiracion (server/rutas/inspiracion.js).
import { pedirNuevo, useDatos } from '../../datos/api.js';

const enc = encodeURIComponent;

export const ganadores = {
  /** { opciones, creditos, recientes, guardados, buscando } */
  estado: () => pedirNuevo('/api/ganadores'),
  /** { clave, filtros, fecha, anuncios, total, costo, creditos, desdeCache } */
  buscar: (filtros, { forzar = false } = {}) => pedirNuevo('/api/ganadores/buscar', { metodo: 'POST', cuerpo: { filtros, forzar } }),
  guardar: (anuncio) => pedirNuevo('/api/ganadores/guardados', { metodo: 'POST', cuerpo: { anuncio } }),
  quitar: (id) => pedirNuevo(`/api/ganadores/guardados/${enc(id)}`, { metodo: 'DELETE' }),
  /** { id, nombre, valor: "subido:<id>|<nombre>" } */
  adaptar: (anuncio) => pedirNuevo('/api/ganadores/adaptar', { metodo: 'POST', cuerpo: { anuncio } }),
};

export const inspiracion = {
  /** { formatos, sonidos, marcas, clasificacion } */
  estado: () => pedirNuevo('/api/inspiracion'),
  /** { enCache, creditos } */
  costo: (filtros) => pedirNuevo('/api/inspiracion/costo', { metodo: 'POST', cuerpo: { filtros } }),
  /** { clasif: { id: { formato, formatoFuente, sonido, sonidoFuente, mirado } }, estado } */
  clasificar: (anuncios, iniciar = false) => pedirNuevo('/api/inspiracion/clasificar', { metodo: 'POST', cuerpo: { anuncios, iniciar } }),
  seguir: (marca) => pedirNuevo('/api/inspiracion/marcas', { metodo: 'POST', cuerpo: { marca } }),
  dejar: (id) => pedirNuevo(`/api/inspiracion/marcas/${enc(id)}`, { metodo: 'DELETE' }),
  /** { marcas, desdeCache, gastados, creditos } */
  buscarMarcas: (texto) => pedirNuevo('/api/inspiracion/marcas/buscar', { metodo: 'POST', cuerpo: { texto } }),
  brandtracker: () => pedirNuevo('/api/inspiracion/marcas/buscar', { metodo: 'POST', cuerpo: { brandtracker: true } }),
  /** tus marcas (nunca salen en Inspiración): { misMarcas } */
  agregarMiMarca: (nombre) => pedirNuevo('/api/inspiracion/mis-marcas', { metodo: 'POST', cuerpo: { nombre } }),
  quitarMiMarca: (nombre) => pedirNuevo(`/api/inspiracion/mis-marcas/${enc(nombre)}`, { metodo: 'DELETE' }),
  /** { archivo, url, nombre } */
  replicarImagen: (anuncio) => pedirNuevo('/api/inspiracion/replicar-imagen', { metodo: 'POST', cuerpo: { anuncio } }),
};

export const useGanadores = () => useDatos('ganadores', ganadores.estado);
export const useInspiracion = () => useDatos('inspiracion', inspiracion.estado);

export const PAIS = { CO: 'Colombia', EC: 'Ecuador', GT: 'Guatemala', MX: 'México', PE: 'Perú', CL: 'Chile', AR: 'Argentina', BO: 'Bolivia', PA: 'Panamá', CR: 'Costa Rica', DO: 'Rep. Dominicana', PY: 'Paraguay', UY: 'Uruguay', SV: 'El Salvador', HN: 'Honduras', NI: 'Nicaragua', VE: 'Venezuela', ES: 'España', US: 'Estados Unidos' };

/** El video o la imagen de un anuncio: lo de TrendTrack pasa por la app (se reproduce en cualquier navegador). */
export const urlMedia = (url) => (!url ? null : url.startsWith('/') ? url : `/api/ganadores/media?u=${encodeURIComponent(url)}`);

export const miles = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString('es-CO') : '—');

/** 1.284.586 -> «1,3 M»; 95.101 -> «95 mil» */
export function corto(n) {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`;
  if (n >= 1e4) return `${Math.round(n / 1e3).toLocaleString('es-CO')} mil`;
  return miles(n);
}

export const fechaCorta = (iso) => (iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '');

/**
 * Lo que se le pide a «Agregar» al replicar un video: el estilo de la app que se parece a su formato (si hay uno y no
 * es el mismo look de siempre: un video realista o UGC sale igual sin pedirlo).
 */
export function pedidoParaAgregar(formato, formatos = [], estilos = []) {
  const f = formatos.find((x) => x.id === formato);
  if (!f?.estilo || ['realista-narrado', 'ugc'].includes(f.estilo)) return '';
  const nombre = estilos.find((e) => e.clave === f.estilo)?.nombre || f.nombre;
  return `El mismo video para mi producto, en el estilo «${nombre}» de la app (como el original, que es ${f.nombre.toLowerCase()}), manteniendo el guion y los ángulos`;
}

/** Los filtros que van a TrendTrack: con una marca elegida, se buscan sus anuncios (por su página web o su nombre). */
export function filtrosConMarca(filtros, marca) {
  if (!marca) return filtros;
  return { ...filtros, texto: marca.dominio || marca.nombre, buscarEn: marca.dominio ? 'domain' : 'brand', paises: [], nichos: [], unoPorMarca: false };
}

/** Cuántos hay de cada valor (sobre lo cargado). */
export function contar(anuncios, clasif, campo) {
  const c = { _todos: anuncios.length, _sin: 0 };
  for (const a of anuncios) {
    const v = clasif[a.id]?.[campo];
    if (v) c[v] = (c[v] || 0) + 1;
    else c._sin++;
  }
  return c;
}

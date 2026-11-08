// Lo que la Biblioteca le pide al servidor (server/rutas/biblioteca.js).
import { invalidar, useDatos } from '../../datos/api.js';

async function pedir(url, { metodo = 'GET', cuerpo, crudo, nombre } = {}) {
  let r;
  try {
    r = await fetch(url, {
      method: metodo,
      headers: {
        Accept: 'application/json',
        ...(crudo ? { 'Content-Type': crudo.type || 'application/octet-stream', 'X-Nombre': encodeURIComponent(nombre || crudo.name || '') } : {}),
        ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: crudo || (cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined),
    });
  } catch {
    throw new Error('No pude conectar con la app. ¿Sigue abierta la ventana del servidor?');
  }
  let datos = null;
  try {
    datos = await r.json();
  } catch {
    datos = null;
  }
  if (!r.ok) throw new Error(datos?.error || 'Algo salió mal. Vuelve a intentarlo.');
  return datos;
}

const listo = (x) => {
  invalidar('biblioteca');
  return x;
};

export const biblioteca = {
  leer: (estilo) => pedir(`/api/biblioteca${estilo ? `?estilo=${encodeURIComponent(estilo)}` : ''}`),
  sincronizar: () => pedir('/api/biblioteca/sincronizar', { metodo: 'POST' }).then(listo),
  /** Sube un archivo (imagen o audio) y devuelve { ref, url } para guardarlo después. */
  subir: (archivo) => pedir('/api/biblioteca/subir', { metodo: 'POST', crudo: archivo }),
  referencias: (estilo) => pedir(`/api/biblioteca/referencias/${encodeURIComponent(estilo)}`),
  personajes: (slug) => pedir(`/api/biblioteca/personajes/${encodeURIComponent(slug)}`),
  crearAvatar: (d) => pedir('/api/biblioteca/avatares', { metodo: 'POST', cuerpo: d }).then(listo),
  editarAvatar: (estilo, id, d) => pedir(`/api/biblioteca/avatares/${encodeURIComponent(estilo)}/${encodeURIComponent(id)}`, { metodo: 'PATCH', cuerpo: d }).then(listo),
  borrarAvatar: (estilo, id) => pedir(`/api/biblioteca/avatares/${encodeURIComponent(estilo)}/${encodeURIComponent(id)}`, { metodo: 'DELETE' }).then(listo),
  guardarAudio: (d) => pedir('/api/biblioteca/audios', { metodo: 'POST', cuerpo: d }).then(listo),
  borrarAudio: (estilo, id) => pedir(`/api/biblioteca/audios/${encodeURIComponent(estilo)}/${encodeURIComponent(id)}`, { metodo: 'DELETE' }).then(listo),
};

/** La biblioteca entera (o la de un estilo, por su clave de la app). */
export function useBiblioteca(estilo, { cadaMs } = {}) {
  return useDatos(`biblioteca:${estilo || '*'}`, () => biblioteca.leer(estilo), { cadaMs });
}

/** Los estilos que usan avatares, con su carpeta en la biblioteca (el nombre de la skill sin "anuncios-"). */
export const ESTILOS_BIBLIOTECA = [
  { clave: 'ugc', carpeta: 'ugc', nombre: 'UGC' },
  { clave: 'podcast', carpeta: 'podcast', nombre: 'Podcast' },
  { clave: 'entrevista', carpeta: 'entrevista', nombre: 'Entrevista callejera' },
  { clave: 'talking-object-pixar', carpeta: 'talking-object-pixar', nombre: 'Objeto parlante' },
  { clave: 'realista-narrado', carpeta: 'realista-narrado', nombre: 'Realista con narrador' },
  { clave: 'skeleton', carpeta: 'skeleton-ads', nombre: 'Esqueleto' },
  { clave: 'estilo-pixar', carpeta: 'estilo-pixar', nombre: 'Estilo Pixar' },
  { clave: 'zack-d-films', carpeta: 'zack-d-films', nombre: 'Zack D Films' },
  { clave: 'claymation', carpeta: 'claymation', nombre: 'Claymation' },
  { clave: 'crochet', carpeta: 'crochet', nombre: 'Crochet' },
  { clave: 'estilo-lego', carpeta: 'estilo-lego', nombre: 'Estilo Lego' },
  { clave: 'musical', carpeta: 'musicales', nombre: 'Musical' },
  { clave: 'historias-musicales', carpeta: 'historias-musicales', nombre: 'Historia musical' },
  { clave: 'sketch', carpeta: 'sketch', nombre: 'Sketch de comedia' },
];
export const nombreDeCarpeta = (c) => ESTILOS_BIBLIOTECA.find((e) => e.carpeta === c)?.nombre || (c === 'general' ? 'Para todos' : c);
export const claveDeCarpeta = (c) => ESTILOS_BIBLIOTECA.find((e) => e.carpeta === c)?.clave || c;

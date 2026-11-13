// Lo que el editor le pide a la app (server/rutas/editor.js): guardar los cambios en la carpeta del anuncio,
// subir la canción propia y exportar. Regenerar una pieza y subir tu propio video van por src/datos/regenerar.js
// (lo mismo que usa el proceso).
//
//   GET  /api/anuncios/:slug/edicion            -> { estado, t, canciones: [{ id, url }] }
//   PUT  /api/anuncios/:slug/edicion            { estado, t, contexto } -> { ok, t }
//   POST /api/anuncios/:slug/edicion/musica     (el archivo) ?id=&nombre= -> { ok, id, url }
//   POST /api/anuncios/:slug/edicion/imagen     (el archivo) ?id=&nombre= -> { ok, id, archivo, url }
//   GET  /api/anuncios/:slug/exportar           -> { trabajo, hechos, desactualizada }
//   POST /api/anuncios/:slug/exportar           { calidad, version, subtitulos, srt, estado, contexto } -> { trabajo }
//   POST /api/anuncios/:slug/exportar/cancelar  -> { trabajo }
export class ErrorServidor extends Error {
  constructor(mensaje, estado) {
    super(mensaje);
    this.estado = estado;
  }
}

async function pedir(url, { metodo = 'GET', cuerpo, archivo } = {}) {
  let r;
  try {
    r = await fetch(url, {
      method: metodo,
      headers: archivo
        ? { Accept: 'application/json', 'Content-Type': archivo.type || 'application/octet-stream' }
        : { Accept: 'application/json', ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: archivo || (cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined),
    });
  } catch {
    throw new ErrorServidor('No pude conectar con la app. ¿Sigue abierta la ventana del servidor?', 0);
  }
  let datos = null;
  try {
    datos = await r.json();
  } catch {
    datos = null;
  }
  if (!r.ok) throw new ErrorServidor(datos?.error || 'Algo salió mal. Vuelve a intentarlo.', r.status);
  return datos;
}

const base = (slug) => `/api/anuncios/${encodeURIComponent(slug)}`;

export const servidor = {
  leerEdicion: (slug) => pedir(`${base(slug)}/edicion`),
  guardarEdicion: (slug, datos) => pedir(`${base(slug)}/edicion`, { metodo: 'PUT', cuerpo: datos }),
  subirImagen: (slug, { id, nombre, archivo }) => pedir(`${base(slug)}/edicion/imagen?${new URLSearchParams({ id, nombre: nombre || '' })}`, { metodo: 'POST', archivo }),
  subirCancion: (slug, { id, nombre, archivo }) => pedir(`${base(slug)}/edicion/musica?${new URLSearchParams({ id, nombre: nombre || '' })}`, { metodo: 'POST', archivo }),
  exportacion: (slug) => pedir(`${base(slug)}/exportar`),
  exportar: (slug, datos) => pedir(`${base(slug)}/exportar`, { metodo: 'POST', cuerpo: datos }),
  cancelarExportacion: (slug) => pedir(`${base(slug)}/exportar/cancelar`, { metodo: 'POST', cuerpo: {} }),
};

/** Dirección para ver o bajar un archivo de output/. */
export const urlSalida = (archivo) => `/archivos/salida/${encodeURIComponent(archivo)}`;

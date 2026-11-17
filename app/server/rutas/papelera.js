// ELIMINAR UN ANUNCIO (lib/papelera.js): no se borra nada, va a temp/_descartados/.
//
//   POST /api/anuncios/:slug/eliminar  -> { ok, eliminado, papelera }
import { soloDesdeLaApp } from '../lib/productos.js';
import { eliminarAnuncio } from '../lib/papelera.js';

export default function rutasPapelera(app) {
  app.post('/api/anuncios/:slug/eliminar', soloDesdeLaApp, (req, res) => {
    try {
      res.json(eliminarAnuncio(req.params.slug));
    } catch (e) {
      const status = Number.isInteger(e?.status) ? e.status : 500;
      if (!e?.status) console.error('[papelera]', e);
      res.status(status).json({ error: e?.status ? e.message : 'No pude eliminar el anuncio. Vuelve a intentarlo.' });
    }
  });
}

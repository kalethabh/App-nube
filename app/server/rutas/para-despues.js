// «Terminar después» (lib/para-despues.js):
//   POST   /api/anuncios/:slug/despues   -> lo saca de «Te necesitan» y lo deja en «Para después»
//   DELETE /api/anuncios/:slug/despues   -> lo vuelve a poner en «Te necesitan»
import { soloDesdeLaApp } from '../lib/productos.js';
import { posponer, retomar } from '../lib/para-despues.js';

export default function rutasParaDespues(app) {
  const r = (fn) => (req, res) => {
    try {
      res.set('Cache-Control', 'no-store').json(fn(req.params.slug));
    } catch (e) {
      res.status(e?.status || 500).json({ error: e?.status ? e.message : 'No pude guardarlo. Vuelve a intentar.' });
    }
  };
  app.post('/api/anuncios/:slug/despues', soloDesdeLaApp, r(posponer));
  app.delete('/api/anuncios/:slug/despues', soloDesdeLaApp, r(retomar));
}

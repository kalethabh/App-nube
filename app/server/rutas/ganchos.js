// Más ganchos de un anuncio terminado (lib/ganchos.js).
//   GET  /api/anuncios/:slug/ganchos   -> { estado, versiones, error?, sePuede, motivo? }
//   POST /api/anuncios/:slug/ganchos { cuantos } -> lo mismo, ya escribiendo
import { soloDesdeLaApp } from '../lib/productos.js';
import { estadoGanchos, pedirGanchos, porQueNo } from '../lib/ganchos.js';

const SLUG = /^[a-z0-9][a-z0-9-]{2,160}$/;

export default function rutasGanchos(app) {
  app.get('/api/anuncios/:slug/ganchos', (req, res) => {
    const { slug } = req.params;
    if (!SLUG.test(slug)) return res.status(404).json({ error: 'No encuentro ese anuncio.' });
    const motivo = porQueNo(slug);
    res.set('Cache-Control', 'no-store').json({ ...estadoGanchos(slug), sePuede: !motivo, motivo });
  });
  app.post('/api/anuncios/:slug/ganchos', soloDesdeLaApp, (req, res) => {
    const { slug } = req.params;
    if (!SLUG.test(slug)) return res.status(404).json({ error: 'No encuentro ese anuncio.' });
    try {
      res.status(202).json(pedirGanchos(slug, { cuantos: req.body?.cuantos }));
    } catch (e) {
      res.status(e.status || 500).json({ error: e.status ? e.message : 'No pude empezar los ganchos.' });
    }
  });
}

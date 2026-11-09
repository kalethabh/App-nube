// El costo aproximado de un anuncio y si tu saldo de kie alcanza (lib/costo-anuncio.js). No cobra nada.
//   GET /api/anuncios/:slug/costo -> { falta, gastado, total, saldo, semaforo }
import { slugValido } from '../lib/anuncios.js';
import { costoDeAnuncio } from '../lib/costo-anuncio.js';

export default function rutasCosto(app) {
  app.get('/api/anuncios/:slug/costo', async (req, res) => {
    if (!slugValido(req.params.slug)) return res.status(404).json({ error: 'No encuentro ese anuncio.' });
    try {
      const c = await costoDeAnuncio(req.params.slug);
      if (!c) return res.status(404).json({ error: 'Todavía no hay guion.' });
      res.set('Cache-Control', 'no-store').json(c);
    } catch (e) {
      res.status(500).json({ error: 'No pude calcular el costo.' });
    }
  });
}

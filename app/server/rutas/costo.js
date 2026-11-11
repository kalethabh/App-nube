// El costo antes de producir y los gastos/saldo actuales de Kads comparten esta ruta.
// Los dos contratos se conservan: el selector de modelos usa disponible/categorias y
// el panel de gastos usa falta/gastado/total/saldo/semaforo. Consultar no genera piezas.
import { slugValido } from '../lib/anuncios.js';
import { costoDeAnuncio } from '../lib/costo-anuncio.js';
import { costoDelAnuncio } from '../lib/costo-estimado.js';
import { soloDesdeLaApp } from '../lib/productos.js';

export default function rutasCosto(app) {
  app.get('/api/anuncios/:slug/costo', soloDesdeLaApp, async (req, res) => {
    if (!slugValido(req.params.slug)) return res.status(404).json({ error: 'No encuentro ese anuncio.' });
    try {
      const [estimado, gastos] = await Promise.allSettled([
        costoDelAnuncio(req.params.slug),
        costoDeAnuncio(req.params.slug),
      ]);
      const plan = estimado.status === 'fulfilled' ? estimado.value : null;
      const actual = gastos.status === 'fulfilled' ? gastos.value : null;
      if (!plan && !actual) return res.status(404).json({ error: 'Todavía no hay guion.' });
      res.set('Cache-Control', 'no-store').json({
        ...(plan || { disponible: false, motivo: 'no-se-pudo' }),
        ...(actual || {}),
      });
    } catch {
      res.status(500).json({ error: 'No pude calcular el costo.' });
    }
  });
}

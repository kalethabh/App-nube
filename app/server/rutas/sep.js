// S.E.P (lib/sep.js): tus anuncios de Meta que más venden y qué hacer con cada uno. Solo lee tu cuenta.
//   GET /api/sep/cuentas                                         -> { cuentas, simulado? }
//   GET /api/sep/informe?cuenta=act_…&rango=30d&roas=2&cpa=&forzar=1   -> el informe
//   GET /api/sep/imagen/:adId                                    -> la imagen del anuncio (guardada en la app)
import { cuentas, informe, imagenDe, hayToken } from '../lib/sep.js';

export default function rutasSep(app) {
  const conErrores = (fn) => async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store').json(await fn(req));
    } catch (e) {
      if (e?.status) return res.status(e.status).json({ error: e.message, motivo: e.motivo || null });
      console.error('[sep]', e);
      res.status(500).json({ error: 'Algo falló leyendo tus anuncios. Vuelve a intentar.' });
    }
  };
  app.get('/api/sep/cuentas', conErrores(async () => (hayToken() ? cuentas() : { cuentas: [], sinToken: true })));
  app.get('/api/sep/informe', conErrores((req) => informe({ cuenta: String(req.query.cuenta || ''), rango: String(req.query.rango || '30d'), roas: req.query.roas, cpa: req.query.cpa, forzar: req.query.forzar === '1' })));
  app.get('/api/sep/imagen/:adId', async (req, res) => {
    try {
      res.sendFile(await imagenDe(String(req.params.adId)));
    } catch (e) {
      res.status(e?.status || 500).json({ error: e?.message || 'No pude traer la imagen.' });
    }
  });
}

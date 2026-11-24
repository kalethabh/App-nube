// S.E.P (lib/sep.js): tus anuncios de Meta que más venden y qué hacer con cada uno. Solo lee tu cuenta.
//   GET /api/sep/cuentas                                         -> { cuentas, simulado? }
//   GET /api/sep/campanas?cuenta=act_…&rango=30d                  -> { campanas }
//   GET /api/sep/informe?alcance=bm|cuenta|campana&bm=&cuenta=act_…&campana=&rango=30d&roas=2&cpa=&forzar=1   -> el informe
//   GET /api/sep/imagen/:adId                                    -> la imagen del anuncio (guardada en la app)
import { cuentas, campanas, informe, imagenDe, hayToken } from '../lib/sep.js';
import { plan, guardarObjetivos, registrarAvance, agregarBitacora, borrarBitacora, copiloto, copilotoEnviar } from '../lib/sep-plan.js';

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
  app.get('/api/sep/cuentas', conErrores(async (req) => (hayToken() ? cuentas({ forzar: req.query.forzar === '1' }) : { bms: [], cuentas: [], sinToken: true })));
  app.get('/api/sep/campanas', conErrores((req) => campanas({ cuenta: String(req.query.cuenta || ''), rango: String(req.query.rango || '30d') })));
  app.get('/api/sep/informe', conErrores((req) => informe({ alcance: String(req.query.alcance || 'cuenta'), bm: String(req.query.bm || ''), cuenta: String(req.query.cuenta || ''), campana: String(req.query.campana || ''), rango: String(req.query.rango || '30d'), roas: req.query.roas, cpa: req.query.cpa, forzar: req.query.forzar === '1' })));
  // El Sistema S.E.P (lib/sep-plan.js): objetivos, el avance del día, la bitácora y el copiloto. Todo local.
  app.get('/api/sep/plan', conErrores(() => plan()));
  app.post('/api/sep/objetivos', conErrores((req) => guardarObjetivos(req.body?.objetivos)));
  app.post('/api/sep/avance', conErrores((req) => registrarAvance(req.body || {})));
  app.post('/api/sep/bitacora', conErrores((req) => agregarBitacora(req.body?.texto)));
  app.delete('/api/sep/bitacora/:id', conErrores((req) => borrarBitacora(String(req.params.id))));
  app.get('/api/sep/copiloto', conErrores(() => copiloto()));
  app.post('/api/sep/copiloto', conErrores((req) => copilotoEnviar(req.body?.texto)));
  app.get('/api/sep/imagen/:adId', async (req, res) => {
    try {
      res.sendFile(await imagenDe(String(req.params.adId)));
    } catch (e) {
      res.status(e?.status || 500).json({ error: e?.message || 'No pude traer la imagen.' });
    }
  });
}

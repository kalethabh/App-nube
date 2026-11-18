// GET /api/dashboard -> lo del inicio que no da otra consulta: la serie de los últimos 14 días, este mes contra el
// anterior, los modelos más usados y lo último que terminó (lib/dashboard.js).
import { resumenDashboard } from '../lib/dashboard.js';

export default function rutasDashboard(app) {
  app.get('/api/dashboard', (_req, res) => {
    res.set('Cache-Control', 'no-store').json(resumenDashboard());
  });
}

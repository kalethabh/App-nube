// Organizar productos (lib/unir-productos.js).
//
// GET  /api/organizar-productos           -> { repetidos: [[{ id, nombre, foto, creado, usos, sugerido }]] }
// POST /api/organizar-productos/unir      { principal, otros: [ids] } -> { principal, unidos, archivos }
import { repetidos, unir } from '../lib/unir-productos.js';
import { ErrorApp, soloDesdeLaApp } from '../lib/productos.js';

export default function rutasOrganizarProductos(app) {
  app.get('/api/organizar-productos', (req, res) => res.set('Cache-Control', 'no-store').json({ repetidos: repetidos() }));
  app.post('/api/organizar-productos/unir', soloDesdeLaApp, (req, res, next) => {
    try {
      res.json(unir(String(req.body?.principal || ''), req.body?.otros));
    } catch (e) {
      if (e instanceof ErrorApp) return res.status(e.status).json({ error: e.message });
      next(e);
    }
  });
}

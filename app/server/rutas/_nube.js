// Los anuncios terminados viven en Google Drive (lib/guardado.js): lo pesado se borra de la Mac.
//   - Antes de editar, rehacer, exportar o sacar más ganchos, lo que hace falta se trae solo de vuelta.
//   - GET  /api/anuncios/:slug/nube          -> { enLaNube, archivos, carpeta? }
//   - POST /api/anuncios/:slug/nube/traer    -> lo trae de vuelta ya
// (El archivo empieza con "_" para cargarse antes que las demas rutas: el paso previo corre antes que ellas.)
import { marcaNube, marcarOcupado, traerDeVuelta } from '../lib/guardado.js';
import { soloDesdeLaApp } from '../lib/productos.js';

const SLUG = /^[a-z0-9][a-z0-9-]{2,160}$/;
// el editor, exportar y rehacer necesitan los archivos; los ganchos, solo al pedirlos (su GET es el estado)
const NECESITAN_ARCHIVOS = /^(edicion|exportar|rehacer)$/;

export default function rutasNube(app) {
  app.use('/api/anuncios/:slug/:accion', (req, res, next) => {
    const { slug, accion } = req.params;
    if (!SLUG.test(slug) || !(NECESITAN_ARCHIVOS.test(accion) || (accion === 'ganchos' && req.method === 'POST'))) return next();
    marcarOcupado(slug);
    if (!marcaNube(slug)) return next();
    const r = traerDeVuelta(slug);
    if (!r.ok) return res.status(409).json({ error: r.mensaje });
    next();
  });
  app.get('/api/anuncios/:slug/nube', (req, res) => {
    const m = SLUG.test(req.params.slug) ? marcaNube(req.params.slug) : null;
    res.set('Cache-Control', 'no-store').json({ enLaNube: Boolean(m), archivos: (m?.archivos?.length || 0) + (m?.finales?.length || 0) });
  });
  app.post('/api/anuncios/:slug/nube/traer', soloDesdeLaApp, (req, res) => {
    if (!SLUG.test(req.params.slug)) return res.status(404).json({ error: 'No encuentro ese anuncio.' });
    const r = traerDeVuelta(req.params.slug);
    if (!r.ok) return res.status(409).json({ error: r.mensaje });
    res.json({ ok: true });
  });
}

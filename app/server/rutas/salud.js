// «Salud de plataformas»: el estado de ElevenLabs, kie.ai, Claude y ChatGPT (lib/salud.js).
//
// GET /api/salud[?fresco=1]          -> { general, revisado, grupos: [{ titulo, servicios: [...] }] }
// GET /api/salud?servicio=<id>        revisa de nuevo solo ese (el ↻ de su fila) y devuelve todo
import { salud, revisarServicio } from '../lib/salud.js';

export default function rutasSalud(app) {
  app.get('/api/salud', async (req, res) => {
    const id = typeof req.query.servicio === 'string' ? req.query.servicio : null;
    res.set('Cache-Control', 'no-store').json(id ? (await revisarServicio(id)) || (await salud()) : await salud({ fresco: req.query.fresco === '1' }));
  });
}

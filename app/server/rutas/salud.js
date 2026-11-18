// «Salud de plataformas»: el estado de ElevenLabs, kie.ai, Claude y ChatGPT (lib/salud.js).
//
// GET /api/salud[?fresco=1]  -> { general, revisado, grupos: [{ titulo, servicios: [...] }] }
import { salud } from '../lib/salud.js';

export default function rutasSalud(app) {
  app.get('/api/salud', async (req, res) => {
    res.set('Cache-Control', 'no-store').json(await salud({ fresco: req.query.fresco === '1' }));
  });
}

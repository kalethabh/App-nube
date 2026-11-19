// «Salud de plataformas»: el estado de ElevenLabs, kie.ai, Claude y ChatGPT (lib/salud.js).
//
// GET /api/salud[?fresco=1]          -> { general, revisado, grupos: [{ titulo, servicios: [...] }] }
// GET /api/salud?servicio=<id>        revisa de nuevo solo ese (el ↻ de su fila) y devuelve todo
// GET /api/salud/en-vivo              EN VIVO (Server-Sent Events): cada resultado nuevo, al instante (se revisa cada 30 s)
import { salud, revisarServicio, escuchar } from '../lib/salud.js';

export default function rutasSalud(app) {
  app.get('/api/salud/en-vivo', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 5000\n\n');
    const dejar = escuchar((valor) => res.write(`data: ${JSON.stringify(valor)}\n\n`));
    // (un comentario cada 25 s: que nada en el camino corte la conexión por estar callada)
    const latido = setInterval(() => res.write(': sigo\n\n'), 25000);
    req.on('close', () => {
      clearInterval(latido);
      dejar();
    });
  });
  app.get('/api/salud', async (req, res) => {
    const id = typeof req.query.servicio === 'string' ? req.query.servicio : null;
    res.set('Cache-Control', 'no-store').json(id ? (await revisarServicio(id)) || (await salud()) : await salud({ fresco: req.query.fresco === '1' }));
  });
}

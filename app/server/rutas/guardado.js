// El guardado automatico en GitHub y Google Drive (lib/guardado.js): arranca con la app.
//   GET  /api/guardado   -> { github: { ok, mensaje, fecha? }, drive: { ok, mensaje }, repositorio, revisado }
//   POST /api/guardado   -> guarda ya y devuelve lo mismo
import { soloDesdeLaApp } from '../lib/productos.js';
import { estadoGuardado, guardarAhora, iniciarGuardado } from '../lib/guardado.js';

export default function rutasGuardado(app) {
  iniciarGuardado();
  app.get('/api/guardado', (req, res) => res.set('Cache-Control', 'no-store').json(estadoGuardado()));
  app.post('/api/guardado', soloDesdeLaApp, async (req, res) => {
    await guardarAhora();
    res.json(estadoGuardado());
  });
}

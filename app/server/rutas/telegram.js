// Tu coordinadora por Telegram (lib/telegram.js), desde Ajustes.
//   GET  /api/telegram                  -> { token, activo, vinculado, chatNombre, nombreBot, codigo, error }
//   PUT  /api/telegram { activo }       -> lo mismo
//   POST /api/telegram/codigo           -> un código nuevo para vincular
//   POST /api/telegram/desvincular      -> suelta el chat vinculado
import express from 'express';
import { soloDesdeLaApp } from '../lib/productos.js';
import { estado, configurar, nuevoCodigo, desvincular } from '../lib/telegram.js';

const json = express.json({ limit: '4kb' });

export default function rutasTelegram(app) {
  const r = (fn) => async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store').json(await fn(req));
    } catch (e) {
      console.error('[telegram]', e);
      res.status(500).json({ error: 'No pude con Telegram. Vuelve a intentar.' });
    }
  };
  app.get('/api/telegram', r(() => estado()));
  app.put('/api/telegram', soloDesdeLaApp, json, r((req) => configurar({ activo: req.body?.activo === true })));
  app.post('/api/telegram/codigo', soloDesdeLaApp, r(() => nuevoCodigo()));
  app.post('/api/telegram/desvincular', soloDesdeLaApp, r(() => desvincular()));
}

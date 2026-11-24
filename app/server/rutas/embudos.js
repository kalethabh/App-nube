import express from 'express';
import { soloDesdeLaApp } from '../lib/productos.js';
import * as embudo from '../lib/embudo/index.js';
const json = express.json({ limit: '32kb' });
export default function rutasEmbudo(app) {
  const r = (fn) => async (req, res) => {
    try { res.set('Cache-Control', 'no-store').json(await fn(req)); }
    catch (e) { if (!e.status) console.error('[embudo]', e.message); res.status(e.status || 500).json({ error: e.status ? e.message : 'No se pudo completar el embudo. Vuelve a intentarlo.' }); }
  };
  app.get('/api/embudos', r(() => embudo.listar()));
  app.post('/api/embudos', soloDesdeLaApp, json, r((req) => embudo.crear(req.body || {})));
  app.post('/api/embudos/:id/guardar-avatar', soloDesdeLaApp, r((req) => embudo.guardarAvatarPendiente(req.params.id)));
  app.get('/api/embudos/:id', r((req) => embudo.ver(req.params.id)));
  app.put('/api/embudos/:id', soloDesdeLaApp, json, r((req) => embudo.editar(req.params.id, req.body || {})));
  app.post('/api/embudos/:id/presupuesto', soloDesdeLaApp, json, r((req) => embudo.presupuestar(req.params.id, req.body || {})));
  app.post('/api/embudos/:id/generar', soloDesdeLaApp, json, r((req) => embudo.generar(req.params.id, req.body || {})));
  app.get('/api/embudos/:id/imagenes/:job/:seccion', (req, res) => {
    try {
      const f = embudo.imagen(req.params.id, req.params.job, req.params.seccion);
      res.set('Cache-Control', 'private, max-age=31536000, immutable');
      if (req.query.descargar === '1') res.download(f, `${req.params.seccion}.png`); else res.sendFile(f);
    } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'No pude abrir la imagen.' }); }
  });
}

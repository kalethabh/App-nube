// OFICINA VIRTUAL (lib/oficina.js): los agentes, con lo que están haciendo.
//   GET /api/oficina            -> { configurada, nombre, agentes, resumen }
//   PUT /api/oficina/agentes    { agentes: { [id]: { nombre, avatar } }, nombreOficina? }  -> lo mismo, al día
//   PUT /api/oficina/zonas      { zonas: [{ id | nueva, lugar, nombre?, color?, tipo? }] }  (diseñar la oficina)
//   GET /api/oficina/chat · POST /api/oficina/chat { texto } · DELETE /api/oficina/chat   (lib/oficina-chat.js)
//   GET/POST /api/anuncios/:slug/opinion { voto: 'bien'|'mal', partes, texto, paraTodos }  (el 👍/👎 que enseña)
import express from 'express';
import { soloDesdeLaApp } from '../lib/productos.js';
import { oficina, guardarAgentes, guardarZonas } from '../lib/oficina.js';
import { chat, enviar, borrarChat, opinar, opinionDe } from '../lib/oficina-chat.js';

const json = express.json({ limit: '32kb' });

export default function rutasOficina(app) {
  app.get('/api/oficina', async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store').json(await oficina());
    } catch (e) {
      console.error('[oficina]', e);
      res.status(500).json({ error: 'No pude armar la oficina. Vuelve a intentar.' });
    }
  });
  app.put('/api/oficina/agentes', soloDesdeLaApp, json, async (req, res) => {
    try {
      res.json(await guardarAgentes(req.body || {}));
    } catch (e) {
      console.error('[oficina]', e);
      res.status(500).json({ error: 'No pude guardar los nombres.' });
    }
  });
  const conErrores = (fn) => async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store').json(await fn(req));
    } catch (e) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('[oficina]', e);
      res.status(500).json({ error: 'Algo falló. Vuelve a intentar.' });
    }
  };
  app.put('/api/oficina/zonas', soloDesdeLaApp, json, conErrores((req) => guardarZonas(req.body || {})));
  app.get('/api/oficina/chat', conErrores(() => chat()));
  app.post('/api/oficina/chat', soloDesdeLaApp, json, conErrores((req) => enviar(req.body?.texto)));
  app.delete('/api/oficina/chat', soloDesdeLaApp, conErrores(() => borrarChat()));
  app.get('/api/anuncios/:slug/opinion', conErrores((req) => ({ opinion: opinionDe(req.params.slug) || null })));
  app.post('/api/anuncios/:slug/opinion', soloDesdeLaApp, json, conErrores((req) => opinar({ ...(req.body || {}), slug: req.params.slug })));
}

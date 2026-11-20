// OFICINA VIRTUAL (lib/oficina.js): los agentes, con lo que están haciendo.
//   GET /api/oficina            -> { configurada, nombre, agentes, resumen }
//   PUT /api/oficina/agentes    { agentes: { [id]: { nombre, avatar } }, nombreOficina? }  -> lo mismo, al día
//   PUT /api/oficina/zonas      { zonas: [{ id | nueva, lugar, nombre?, color?, tipo? }] }  (diseñar la oficina)
//   GET /api/oficina/chat · POST /api/oficina/chat { texto, adjuntos: [id] } · DELETE /api/oficina/chat   (lib/oficina-chat.js)
//   POST /api/oficina/chat/adjuntos (el archivo en crudo, su nombre en x-nombre) -> { id, nombre, tipo, url }
//   GET /archivos/oficina/adjuntos/:id/:archivo
//   GET/POST /api/anuncios/:slug/opinion { voto: 'bien'|'mal', partes, texto, paraTodos }  (el 👍/👎 que enseña)
import express from 'express';
import { soloDesdeLaApp } from '../lib/productos.js';
import { oficina, guardarAgentes, guardarZonas } from '../lib/oficina.js';
import { chat, enviar, borrarChat, opinar, opinionDe, subirAdjunto, rutaAdjunto } from '../lib/oficina-chat.js';

const json = express.json({ limit: '32kb' });
const crudo = express.raw({ type: () => true, limit: '25mb' });

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
  app.post('/api/oficina/chat', soloDesdeLaApp, json, conErrores((req) => enviar(req.body?.texto, req.body?.adjuntos)));
  app.post(
    '/api/oficina/chat/adjuntos',
    soloDesdeLaApp,
    (req, res, next) => crudo(req, res, (err) => (err ? res.status(err.status === 413 ? 413 : 400).json({ error: err.status === 413 ? 'Ese archivo pesa más de 25 MB. Pásame uno más liviano.' : 'No pude leer ese archivo.' }) : next())),
    conErrores((req) => subirAdjunto(Buffer.isBuffer(req.body) ? req.body : null, decodeURIComponent(String(req.headers['x-nombre'] || '')))),
  );
  app.get('/archivos/oficina/adjuntos/:id/:archivo', (req, res) => {
    const f = rutaAdjunto(String(req.params.id), String(req.params.archivo));
    if (!f) return res.status(404).end();
    res.sendFile(f, { headers: { 'Cache-Control': 'private, max-age=86400' } });
  });
  app.delete('/api/oficina/chat', soloDesdeLaApp, conErrores(() => borrarChat()));
  app.get('/api/anuncios/:slug/opinion', conErrores((req) => ({ opinion: opinionDe(req.params.slug) || null })));
  app.post('/api/anuncios/:slug/opinion', soloDesdeLaApp, json, conErrores((req) => opinar({ ...(req.body || {}), slug: req.params.slug })));
}

// OFICINA VIRTUAL (lib/oficina.js): los agentes, con lo que están haciendo.
//   GET /api/oficina            -> { configurada, nombre, agentes, resumen }
//   PUT /api/oficina/agentes    { agentes: { [id]: { nombre, avatar } }, nombreOficina? }  -> lo mismo, al día
import express from 'express';
import { soloDesdeLaApp } from '../lib/productos.js';
import { oficina, guardarAgentes } from '../lib/oficina.js';

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
}

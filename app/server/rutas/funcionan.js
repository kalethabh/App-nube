// LO QUE ME FUNCIONA (lib/funcionan.js): los creativos propios marcados como ganadores.
//
//   GET    /api/funcionan?tipo=imagen|video&producto=<id>  -> { items, claves }
//   POST   /api/funcionan          { tipo: 'imagen', lote, pieza } | { tipo: 'video', slug }  -> el creativo marcado
//   DELETE /api/funcionan/:id      (id del creativo o su clave 'imagen:<lote>:<pieza>' / 'video:<slug>')
//   GET    /archivos/funcionan/:nombre   su imagen
import express from 'express';
import { soloDesdeLaApp } from '../lib/productos.js';
import { archivo, listar, marcar, origenes, quitar } from '../lib/funcionan.js';

const json = express.json({ limit: '64kb' });
const error = (res, e, porDefecto) => {
  const status = Number.isInteger(e?.status) ? e.status : 500;
  if (!e?.status) console.error('[funcionan]', e);
  res.status(status).json({ error: e?.status ? e.message : porDefecto });
};

export default function rutasFuncionan(app) {
  app.get('/api/funcionan', (req, res) => {
    const tipo = ['imagen', 'video'].includes(req.query.tipo) ? req.query.tipo : null;
    const productoId = typeof req.query.producto === 'string' && req.query.producto ? req.query.producto : null;
    res.set('Cache-Control', 'no-store').json({ items: listar({ tipo, productoId }), claves: origenes() });
  });
  app.post('/api/funcionan', soloDesdeLaApp, json, async (req, res) => {
    try {
      res.json(await marcar(req.body || {}));
    } catch (e) {
      error(res, e, 'No pude marcarlo. Vuelve a intentar.');
    }
  });
  app.delete('/api/funcionan/:id', soloDesdeLaApp, (req, res) => {
    try {
      res.json(quitar(String(req.params.id)));
    } catch (e) {
      error(res, e, 'No pude quitar la marca.');
    }
  });
  app.get('/archivos/funcionan/:nombre', (req, res) => {
    const abs = archivo(req.params.nombre);
    if (!abs) return res.status(404).end();
    res.set('Cache-Control', 'private, max-age=3600').sendFile(abs);
  });
}

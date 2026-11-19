// LO QUE ME FUNCIONA (lib/funcionan.js): los creativos propios marcados como ganadores.
//
//   GET    /api/funcionan?tipo=imagen|video&producto=<id>  -> { items, claves }
//   POST   /api/funcionan          { tipo: 'imagen', lote, pieza } | { tipo: 'video', slug }  -> el creativo marcado
//   DELETE /api/funcionan/:id      (id del creativo o su clave 'imagen:<lote>:<pieza>' / 'video:<slug>')
//   GET    /archivos/funcionan/:nombre   su imagen
//   POST   /api/funcionan/subir    (2026-11-19h) el archivo crudo (imagen o video, hasta 300 MB); cabeceras X-Nombre,
//                                  X-Producto, X-Titulo y X-Concepto (con encodeURIComponent) -> el creativo
//   PATCH  /api/funcionan/:id      { concepto?, titulo?, productoId? }   el concepto creativo (lo conservan las Variantes)
//   GET    /archivos/funcionan/videos/:nombre   el video que subiste
import express from 'express';
import { soloDesdeLaApp } from '../lib/productos.js';
import { archivo, archivoVideo, editar, listar, marcar, origenes, quitar, subir } from '../lib/funcionan.js';

const crudo = express.raw({ type: () => true, limit: '300mb' });
const cabecera = (req, k) => {
  try {
    return decodeURIComponent(String(req.get(k) || ''));
  } catch {
    return '';
  }
};

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
  app.post('/api/funcionan/subir', soloDesdeLaApp, crudo, async (req, res) => {
    try {
      res.json(await subir(req.body, { nombre: cabecera(req, 'X-Nombre'), tipo: req.get('Content-Type'), productoId: cabecera(req, 'X-Producto') || null, titulo: cabecera(req, 'X-Titulo'), concepto: cabecera(req, 'X-Concepto') }));
    } catch (e) {
      error(res, e, 'No pude guardar ese archivo. Vuelve a intentar.');
    }
  });
  app.patch('/api/funcionan/:id', soloDesdeLaApp, json, (req, res) => {
    try {
      const b = req.body || {};
      res.json(editar(String(req.params.id), { concepto: b.concepto, titulo: b.titulo, productoId: b.productoId }));
    } catch (e) {
      error(res, e, 'No pude guardar el cambio.');
    }
  });
  app.get('/archivos/funcionan/videos/:nombre', (req, res) => {
    const abs = archivoVideo(req.params.nombre);
    if (!abs) return res.status(404).end();
    res.set('Cache-Control', 'private, max-age=3600').sendFile(abs);
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

// CARPETAS DE PRODUCTO (lib/carpetas.js): imágenes y videos guardados por carpeta, y su descarga en zip.
//   GET    /api/carpetas                               -> { carpetas }
//   POST   /api/carpetas { nombre, productoId? }       -> la carpeta nueva
//   GET    /api/carpetas/:id                           -> { id, nombre, imagenes: [...], videos: [...] }
//   PUT    /api/carpetas/:id { nombre }                -> renombrar
//   DELETE /api/carpetas/:id
//   POST   /api/carpetas/:id/archivos   (binario, x-nombre)   -> subir una imagen o un video tuyo
//   POST   /api/carpetas/:id/desde { tipo: 'imagen-lote', lote, pieza } | { tipo: 'video', archivo }
//   GET    /api/carpetas/:id/archivo/:tipo/:nombre     -> el archivo (tipo: imagenes | videos)
//   DELETE /api/carpetas/:id/archivo/:tipo/:nombre
//   GET    /api/carpetas/:id/zip                       -> la carpeta entera (imagenes/ y videos/)
import express from 'express';
import { soloDesdeLaApp } from '../lib/productos.js';
import * as c from '../lib/carpetas.js';
import { prepararZip, enviarZip } from '../lib/imagen-ads/zip.js';

const json = express.json({ limit: '8kb' });
const crudo = express.raw({ type: () => true, limit: '600mb' });

export default function rutasCarpetas(app) {
  const r = (fn) => async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store').json(await fn(req));
    } catch (e) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('[carpetas]', e);
      res.status(500).json({ error: 'Algo falló con la carpeta. Vuelve a intentar.' });
    }
  };
  app.get('/api/carpetas', r(() => c.listar()));
  app.post('/api/carpetas', soloDesdeLaApp, json, r((req) => c.crear(req.body || {})));
  app.get('/api/carpetas/:id', r((req) => c.leer(req.params.id)));
  app.put('/api/carpetas/:id', soloDesdeLaApp, json, r((req) => c.renombrar(req.params.id, req.body?.nombre)));
  app.delete('/api/carpetas/:id', soloDesdeLaApp, r((req) => c.borrar(req.params.id)));
  app.post(
    '/api/carpetas/:id/archivos',
    soloDesdeLaApp,
    (req, res, next) => crudo(req, res, (err) => (err ? res.status(err.status === 413 ? 413 : 400).json({ error: err.status === 413 ? 'Ese archivo pesa más de 600 MB.' : 'No pude leer ese archivo.' }) : next())),
    r((req) => c.guardarArchivo(req.params.id, req.body, decodeURIComponent(String(req.headers['x-nombre'] || 'archivo')))),
  );
  app.post('/api/carpetas/:id/desde', soloDesdeLaApp, json, r((req) => c.guardarDesde(req.params.id, req.body || {})));
  app.get('/api/carpetas/:id/archivo/:tipo/:nombre', (req, res) => {
    try {
      res.set('Cache-Control', 'private, max-age=60').sendFile(c.rutaDeArchivo(req.params.id, req.params.tipo, req.params.nombre));
    } catch (e) {
      res.status(e?.status || 404).json({ error: e?.message || 'No encuentro ese archivo.' });
    }
  });
  app.delete('/api/carpetas/:id/archivo/:tipo/:nombre', soloDesdeLaApp, r((req) => c.quitarArchivo(req.params.id, req.params.tipo, req.params.nombre)));
  app.get('/api/carpetas/:id/zip', async (req, res) => {
    try {
      const { nombre, entradas } = c.entradasDelZip(req.params.id);
      if (!entradas.length) return res.status(400).json({ error: 'La carpeta está vacía.' });
      const plan = await prepararZip(entradas);
      res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nombre)}.zip`, 'Cache-Control': 'no-store' });
      await enviarZip(res, plan);
    } catch (e) {
      if (!res.headersSent) res.status(e?.status || 500).json({ error: e?.message || 'No pude armar el zip.' });
    }
  });
}

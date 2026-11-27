// EL CHAT DE IMÁGENES (2026-11-27a, lib/imagen-ads/chat.js): conversas con tu IA y crea las imágenes de tu producto
// (cada chat es un lote del producto: salen en Anuncios de imagen → su carpeta).
//   GET    /api/chat-imagenes                       -> { chats }
//   POST   /api/chat-imagenes { productoId }        -> el chat nuevo
//   GET    /api/chat-imagenes/:id                   -> { …, mensajes (con sus imágenes), pensando, costo }
//   POST   /api/chat-imagenes/:id/mensajes { texto, adjuntos, formato, cantidad }  (428 si falta autorizar el costo)
//   POST   /api/chat-imagenes/:id/autorizar { dolaresPorImagen }
//   POST   /api/chat-imagenes/:id/adjuntos          (la imagen en el cuerpo, o ?pieza=<id de Mis piezas>) -> { archivo, url }
//   DELETE /api/chat-imagenes/:id
//   GET    /archivos/chat-imagenes/:id/:archivo     un adjunto
import express from 'express';
import { ErrorApp, soloDesdeLaApp } from '../lib/productos.js';
import * as chat from '../lib/imagen-ads/chat.js';
import { vistaDelLote } from '../lib/imagen-ads/estado.js';

const conErrores = (fn) => async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const r = await fn(req, res);
    if (!res.headersSent) res.json(r);
  } catch (e) {
    if (e instanceof ErrorApp || (Number.isInteger(e?.status) && e.status >= 400 && e.status < 600)) {
      if (!res.headersSent) return res.status(e.status).json({ error: e.message });
      return;
    }
    next(e);
  }
};
const crudo = express.raw({ type: () => true, limit: '20mb' });

export default function rutasChatImagenes(app) {
  app.get('/api/chat-imagenes', conErrores(() => ({ chats: chat.listarChats() })));
  app.post('/api/chat-imagenes', soloDesdeLaApp, conErrores((req) => chat.crearChat({ productoId: String(req.body?.productoId || '') })));
  app.get('/api/chat-imagenes/:id', conErrores((req) => chat.vistaChatCompleta(String(req.params.id), vistaDelLote)));
  app.post('/api/chat-imagenes/:id/mensajes', soloDesdeLaApp, conErrores((req) =>
    chat.enviar(String(req.params.id), { texto: req.body?.texto, adjuntos: req.body?.adjuntos, formato: req.body?.formato, cantidad: req.body?.cantidad, seleccion: req.body?.seleccion })
  ));
  app.post('/api/chat-imagenes/:id/autorizar', soloDesdeLaApp, conErrores((req) => chat.autorizar(String(req.params.id), { dolaresPorImagen: req.body?.dolaresPorImagen })));
  app.post('/api/chat-imagenes/:id/adjuntos', soloDesdeLaApp, (req, res, next) => (req.query.pieza ? next() : crudo(req, res, next)), conErrores((req) =>
    chat.subirAdjunto(String(req.params.id), req.query.pieza ? { pieza: String(req.query.pieza) } : { datos: req.body, tipo: req.get('Content-Type') })
  ));
  app.delete('/api/chat-imagenes/:id', soloDesdeLaApp, conErrores((req) => chat.borrarChat(String(req.params.id))));
  app.get('/archivos/chat-imagenes/:id/:archivo', (req, res) => {
    try {
      const abs = chat.rutaAdjunto(String(req.params.id), String(req.params.archivo));
      if (!abs) return res.status(404).end();
      res.set('Cache-Control', 'private, max-age=3600').sendFile(abs);
    } catch {
      res.status(404).end();
    }
  });
}

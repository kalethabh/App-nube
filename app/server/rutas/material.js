// POST /api/material -> sube un video o una imagen para usar en un anuncio (el cuerpo crudo, como las referencias).
// Queda en temp/_material/<id>.<ext> hasta que el anuncio se crea (lib/material-propio.js lo copia a
// temp/<slug>/material/). Responde { id, nombre, tipo: 'video' | 'imagen' }.
import express from 'express';
import { soloDesdeLaApp } from '../lib/productos.js';
import { guardarSubida } from '../lib/material-propio.js';

const crudo = express.raw({ type: () => true, limit: '400mb' });

export default function rutasMaterial(app) {
  app.post('/api/material', soloDesdeLaApp, (req, res) =>
    crudo(req, res, (err) => {
      if (err) return res.status(err.status === 413 ? 413 : 400).json({ error: err.status === 413 ? 'Ese archivo pesa demasiado (más de 400 MB).' : 'No pude leer ese archivo.' });
      try {
        const nombre = decodeURIComponent(String(req.headers['x-nombre'] || 'archivo')).replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 80);
        res.status(201).json(guardarSubida(req.body, { nombre, tipo: req.headers['content-type'] }));
      } catch (e) {
        res.status(e.status || 500).json({ error: e.status ? e.message : 'No pude guardar ese archivo.' });
      }
    })
  );
}

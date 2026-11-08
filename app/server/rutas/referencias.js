// POST /api/referencias -> sube un video de referencia para clonar (el cuerpo crudo, como las fotos del producto).
// Queda en temp/_referencias/<id>.<ext> hasta que un anuncio lo use (lo copia a temp/<slug>/referencia/original.<ext>).
// Responde { id, nombre }: en el formulario va como "subido:<id>|<nombre>".
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import { TEMP } from '../lib/rutas.js';
import { soloDesdeLaApp } from '../lib/productos.js';

export const DIR_REFERENCIAS = path.join(TEMP, '_referencias');
const crudo = express.raw({ type: () => true, limit: '400mb' });
const EXT = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-m4v': 'm4v' };

export default function rutasReferencias(app) {
  app.post('/api/referencias', soloDesdeLaApp, (req, res) =>
    crudo(req, res, (err) => {
      if (err) return res.status(err.status === 413 ? 413 : 400).json({ error: err.status === 413 ? 'Ese video pesa demasiado (más de 400 MB).' : 'No pude leer ese video.' });
      const tipo = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const nombre = String(req.headers['x-nombre'] || 'video').replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 80) || 'video';
      const ext = EXT[tipo] || (/\.(mp4|mov|webm|m4v)$/i.exec(nombre)?.[1] || '').toLowerCase();
      if (!ext || !Buffer.isBuffer(req.body) || req.body.length < 1000) return res.status(400).json({ error: 'Sube un video (mp4, mov o webm).' });
      const id = `${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
      fs.mkdirSync(DIR_REFERENCIAS, { recursive: true });
      fs.writeFileSync(path.join(DIR_REFERENCIAS, `${id}.${ext}`), req.body);
      res.status(201).json({ id, nombre });
    })
  );
}

/** La ruta del video subido con ese id, o null. */
export function rutaDeReferencia(id) {
  if (!/^[a-z0-9]{6,30}$/.test(String(id || ''))) return null;
  try {
    const f = fs.readdirSync(DIR_REFERENCIAS).find((n) => n.startsWith(`${id}.`));
    return f ? path.join(DIR_REFERENCIAS, f) : null;
  } catch {
    return null;
  }
}

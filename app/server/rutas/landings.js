// LANDINGS (lib/landings/): clonar por URL, optimizar, adaptar con IA, medir la velocidad, ver y descargar.
//   GET    /api/landings                      -> { landings }
//   POST   /api/landings { url, prompt?, analizar? } (o { modo: 'tal-cual'|'adaptar', motor, productoId }) -> la landing (se arma de fondo)
//   GET    /api/landings/:id                  -> la landing (estado, progreso, informe, puntajes)
//   DELETE /api/landings/:id
//   POST   /api/landings/:id/medir            -> vuelve a medir la velocidad
//   GET    /api/landings/:id/descargar        -> el zip (index.html + assets/)
//   GET    /landing/:id/*                     -> la copia, comprimida como la serviría un hosting (para verla y medirla)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import express from 'express';
import { soloDesdeLaApp } from '../lib/productos.js';
import { listar, leer, crear, crearDesdePlantilla, borrar, medirDeNuevo, analizarDeNuevo, carpetaDe } from '../lib/landings/index.js';
import { prepararZip, enviarZip } from '../lib/imagen-ads/zip.js';

const json = express.json({ limit: '16kb' });
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.ico': 'image/x-icon' };

export default function rutasLandings(app) {
  const r = (fn) => async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store').json(await fn(req));
    } catch (e) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('[landings]', e);
      res.status(500).json({ error: 'Algo falló con la landing. Vuelve a intentar.' });
    }
  };
  app.get('/api/landings', r(() => listar()));
  app.post('/api/landings', soloDesdeLaApp, json, r((req) => crear(req.body || {})));
  // (2026-11-25f) crear desde la plantilla con el equipo de agentes: { productoId, prompt?, motor? }
  app.post('/api/landings/crear', soloDesdeLaApp, json, r((req) => crearDesdePlantilla(req.body || {})));
  app.get('/api/landings/:id', r((req) => leer(req.params.id)));
  app.delete('/api/landings/:id', soloDesdeLaApp, r((req) => borrar(req.params.id)));
  app.post('/api/landings/:id/medir', soloDesdeLaApp, r((req) => medirDeNuevo(req.params.id)));
  app.post('/api/landings/:id/analizar', soloDesdeLaApp, json, r((req) => analizarDeNuevo(req.params.id, req.body || {})));
  app.get('/api/landings/:id/descargar', async (req, res) => {
    try {
      const l = leer(req.params.id);
      const dir = carpetaDe(l.id);
      const entradas = [{ nombre: 'index.html', origen: path.join(dir, 'index.html') }];
      for (const f of fs.existsSync(path.join(dir, 'assets')) ? fs.readdirSync(path.join(dir, 'assets')) : []) entradas.push({ nombre: `assets/${f}`, origen: path.join(dir, 'assets', f) });
      const plan = await prepararZip(entradas);
      res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="landing-${l.id}.zip"`, 'Cache-Control': 'no-store' });
      await enviarZip(res, plan);
    } catch (e) {
      if (!res.headersSent) res.status(e?.status || 500).json({ error: e?.message || 'No pude armar el zip.' });
    }
  });
  app.get('/landing/:id/*ruta', (req, res) => {
    let dir;
    try {
      dir = carpetaDe(req.params.id);
    } catch {
      return res.status(404).end();
    }
    const pedido = [].concat(req.params.ruta || []).join('/') || 'index.html';
    const f = path.resolve(dir, pedido);
    if (!f.startsWith(path.resolve(dir) + path.sep) || /(^|\/)(landing\.json|registro|textos|nuevos-|nuevas-|original\.html)/.test(pedido) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return res.status(404).end();
    const ext = path.extname(f).toLowerCase();
    const h = { 'Content-Type': TIPOS[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000' };
    if (/\.(html|css|js|svg)$/.test(ext) && /gzip/.test(req.headers['accept-encoding'] || '')) {
      res.set({ ...h, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
      return res.end(zlib.gzipSync(fs.readFileSync(f), { level: 9 }));
    }
    res.set(h);
    res.sendFile(f);
  });
}

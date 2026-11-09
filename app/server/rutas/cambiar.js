// Cambiar el producto en un video que ya existe (lib/cambiar.js, pantalla #/cambiar).
//   GET  /api/cambiar                       -> { trabajos }
//   POST /api/cambiar                       { video: "subido:<id>" | link, productoId } -> { slug }
//   GET  /api/cambiar/:slug                 -> el trabajo (etapa, tomas, propuesta, salidas)
//   PUT  /api/cambiar/:slug/cambio          { cambio } -> lo guarda
//   POST /api/cambiar/:slug/proponer        Claude vuelve a proponer
//   POST /api/cambiar/:slug/producir        produce (cobra)
//   POST /api/cambiar/:slug/reintentar
import { soloDesdeLaApp } from '../lib/productos.js';
import path from 'node:path';
import { TEMP } from '../lib/rutas.js';
import { dentroDe } from '../lib/archivos.js';
import { enviar } from './archivos.js';
import { crearCambio, slugValido, guardarCambio, listarCambios, producirCambio, reintentar, revisarAlAbrir, verCambio, volverAProponer } from '../lib/cambiar.js';

const fallar = (res, e) => res.status(e?.status || 500).json({ error: e?.status ? e.message : 'Algo salió mal. Vuelve a intentarlo.' });

export default function rutasCambiar(app) {
  revisarAlAbrir();
  app.get('/archivos/cambio/:slug/*ruta', (req, res) => {
    const { slug } = req.params;
    if (!slugValido(slug)) return res.status(404).json({ error: 'No encuentro ese trabajo.' });
    const partes = Array.isArray(req.params.ruta) ? req.params.ruta : String(req.params.ruta || '').split('/');
    const abs = dentroDe(path.join(TEMP, slug), partes);
    if (!abs || partes[0] === 'app') return res.status(400).json({ error: 'Ruta no válida.' });
    enviar(res, abs);
  });
  app.get('/api/cambiar', (req, res) => res.set('Cache-Control', 'no-store').json({ trabajos: listarCambios() }));
  app.post('/api/cambiar', soloDesdeLaApp, (req, res) => {
    try {
      res.status(201).json(crearCambio(req.body || {}));
    } catch (e) {
      fallar(res, e);
    }
  });
  app.get('/api/cambiar/:slug', async (req, res) => {
    const t = await verCambio(req.params.slug);
    if (!t) return res.status(404).json({ error: 'No encuentro ese trabajo.' });
    res.set('Cache-Control', 'no-store').json(t);
  });
  app.put('/api/cambiar/:slug/cambio', soloDesdeLaApp, (req, res) => {
    try {
      res.json({ cambio: guardarCambio(req.params.slug, req.body?.cambio) });
    } catch (e) {
      fallar(res, e);
    }
  });
  app.post('/api/cambiar/:slug/proponer', soloDesdeLaApp, (req, res) => res.json({ ok: volverAProponer(req.params.slug) }));
  app.post('/api/cambiar/:slug/producir', soloDesdeLaApp, (req, res) => {
    try {
      producirCambio(req.params.slug);
      res.json({ ok: true });
    } catch (e) {
      fallar(res, e);
    }
  });
  app.post('/api/cambiar/:slug/reintentar', soloDesdeLaApp, (req, res) => {
    reintentar(req.params.slug);
    res.json({ ok: true });
  });
}

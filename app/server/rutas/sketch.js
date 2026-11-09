// El sketch de comedia en la app (lib/sketch.js, pantalla #/sketch).
//   GET  /api/sketch                          -> { sketches }
//   POST /api/sketch                          { productoId, indicaciones, pais, oferta, video, guionPropio } -> { slug }
//   GET  /api/sketch/:slug                    -> el sketch (etapa, guion, costo, tomas, salidas)
//   POST /api/sketch/:slug/cambios            { pedido }   Claude cambia el guion
//   POST /api/sketch/:slug/fotos              aprobado: hace las referencias y las fotos de cada toma (cobra)
//   POST /api/sketch/:slug/producir           hace los clips, el montaje y la revisión (cobra)
//   POST /api/sketch/:slug/rehacer-fotos      { ids }      rehace la foto de esas tomas (cobra)
//   POST /api/sketch/:slug/detener · /reintentar
//   GET  /archivos/sketch/:slug/*ruta         sus imágenes y clips
import path from 'node:path';
import { TEMP } from '../lib/rutas.js';
import { dentroDe } from '../lib/archivos.js';
import { soloDesdeLaApp } from '../lib/productos.js';
import { enviar } from './archivos.js';
import { crearSketch, detenerSketch, listarSketches, pedirCambios, producirSketch, reintentarSketch, rehacerFotos, revisarAlAbrir, slugValido, verSketch } from '../lib/sketch.js';

const fallar = (res, e) => res.status(e?.status || 500).json({ error: e?.message || 'Algo salió mal. Vuelve a intentarlo.' });

export default function rutasSketch(app) {
  revisarAlAbrir();
  app.get('/archivos/sketch/:slug/*ruta', (req, res) => {
    const { slug } = req.params;
    if (!slugValido(slug)) return res.status(404).json({ error: 'No encuentro ese sketch.' });
    const partes = Array.isArray(req.params.ruta) ? req.params.ruta : String(req.params.ruta || '').split('/');
    const abs = dentroDe(path.join(TEMP, slug), partes);
    if (!abs || partes[0] === 'app') return res.status(400).json({ error: 'Ruta no válida.' });
    enviar(res, abs);
  });
  app.get('/api/sketch', (req, res) => res.set('Cache-Control', 'no-store').json({ sketches: listarSketches() }));
  app.post('/api/sketch', soloDesdeLaApp, (req, res) => {
    try {
      res.status(201).json(crearSketch(req.body || {}));
    } catch (e) {
      fallar(res, e);
    }
  });
  app.get('/api/sketch/:slug', (req, res) => {
    const s = verSketch(req.params.slug);
    if (!s) return res.status(404).json({ error: 'No encuentro ese sketch.' });
    res.set('Cache-Control', 'no-store').json(s);
  });
  const accion = (ruta, fn) =>
    app.post(`/api/sketch/:slug/${ruta}`, soloDesdeLaApp, (req, res) => {
      try {
        fn(req.params.slug, req.body || {});
        res.json({ ok: true });
      } catch (e) {
        fallar(res, e);
      }
    });
  accion('cambios', (slug, b) => pedirCambios(slug, b.pedido));
  accion('fotos', (slug) => producirSketch(slug, { hasta: 'fotos' }));
  accion('producir', (slug) => producirSketch(slug, { hasta: 'final' }));
  accion('rehacer-fotos', (slug, b) => rehacerFotos(slug, b.ids));
  accion('rehacer-clips', (slug, b) => rehacerFotos(slug, b.ids, 'video'));
  accion('detener', (slug) => detenerSketch(slug));
  accion('reintentar', (slug) => reintentarSketch(slug));
}

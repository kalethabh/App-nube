// SHOPIFY (lib/shopify/): tus tiendas, sus temas y los trabajos de la IA en ellas.
//   GET    /api/shopify/tiendas                      -> { tiendas }   (sin las claves)
//   POST   /api/shopify/tiendas { dominio, token, nombre }  -> la tienda (la prueba antes de guardarla)
//   DELETE /api/shopify/tiendas/:id
//   GET    /api/shopify/tiendas/:id/temas            -> { temas: [{ id, nombre, rol }] }
//   GET    /api/shopify/trabajos                     -> { trabajos }
//   POST   /api/shopify/trabajos { tiendaId, temaId, pedido, motor }   -> el trabajo (la IA edita el tema de fondo)
//   GET    /api/shopify/trabajos/:id · DELETE /api/shopify/trabajos/:id
//   POST   /api/shopify/trabajos/:id/publicar · /descartar · /admin/:i (aplica un cambio de la API que propuso la IA)
//   POST   /api/shopify/landing { landingId, tiendaId, titulo, direccion, producto }  -> sube una landing a la tienda
import express from 'express';
import { soloDesdeLaApp } from '../lib/productos.js';
import { listarTiendas, agregarTienda, quitarTienda, editarTienda, tiendaConClave, conectarConCuenta, estadoConexion } from '../lib/shopify/tiendas.js';
import { temas } from '../lib/shopify/api.js';
import { listarTrabajos, leerTrabajo, borrarTrabajo, crearTrabajo, crearTrabajos, publicarTrabajo, descartarTema, aplicarAdmin, subirLanding, crearCopia, publicarCopia, descartarCopia, partesDelTema } from '../lib/shopify/trabajos.js';

const json = express.json({ limit: '32kb' });

export default function rutasShopify(app) {
  const r = (fn) => async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store').json(await fn(req));
    } catch (e) {
      if (e?.status) return res.status(e.status).json({ error: e.message });
      console.error('[shopify]', e?.message || e);
      res.status(502).json({ error: e?.message || 'Algo falló con Shopify. Vuelve a intentar.' });
    }
  };
  app.get('/api/shopify/tiendas', r(() => ({ tiendas: listarTiendas() })));
  app.post('/api/shopify/tiendas', soloDesdeLaApp, json, r((req) => agregarTienda(req.body || {})));
  app.delete('/api/shopify/tiendas/:id', soloDesdeLaApp, r((req) => quitarTienda(req.params.id)));
  app.get('/api/shopify/tiendas/:id/temas', r(async (req) => ({ temas: await temas(tiendaConClave(req.params.id)) })));
  app.get('/api/shopify/trabajos', r(() => listarTrabajos()));
  // (2026-11-24) con tiendaIds: el mismo pedido en varias tiendas -> { trabajos }
  app.post('/api/shopify/trabajos', soloDesdeLaApp, json, r((req) => (Array.isArray(req.body?.tiendaIds) ? crearTrabajos(req.body) : crearTrabajo(req.body || {}))));
  app.get('/api/shopify/trabajos/:id', r((req) => leerTrabajo(req.params.id)));
  app.delete('/api/shopify/trabajos/:id', soloDesdeLaApp, r((req) => borrarTrabajo(req.params.id)));
  app.post('/api/shopify/trabajos/:id/publicar', soloDesdeLaApp, r((req) => publicarTrabajo(req.params.id)));
  app.post('/api/shopify/trabajos/:id/descartar', soloDesdeLaApp, r((req) => descartarTema(req.params.id)));
  app.post('/api/shopify/trabajos/:id/admin/:i', soloDesdeLaApp, r((req) => aplicarAdmin(req.params.id, Number(req.params.i))));
  app.post('/api/shopify/landing', soloDesdeLaApp, json, r((req) => subirLanding(req.body || {})));
  // (2026-11-24) copiar de una tienda a otras y lo de cada tienda
  app.get('/api/shopify/tiendas/:id/partes', r((req) => partesDelTema(req.params.id, req.query.tema ? String(req.query.tema) : null)));
  // (2026-11-24) con mi cuenta de Shopify: el enlace y el código para aprobar en el navegador, y su estado
  app.post('/api/shopify/conexiones', soloDesdeLaApp, json, r((req) => conectarConCuenta(req.body || {})));
  app.get('/api/shopify/conexiones/:id', r((req) => estadoConexion(req.params.id)));
  app.post('/api/shopify/copias', soloDesdeLaApp, json, r((req) => crearCopia(req.body || {})));
  app.post('/api/shopify/trabajos/:id/destinos/:tienda/publicar', soloDesdeLaApp, r((req) => publicarCopia(req.params.id, req.params.tienda)));
  app.post('/api/shopify/trabajos/:id/destinos/:tienda/descartar', soloDesdeLaApp, r((req) => descartarCopia(req.params.id, req.params.tienda)));
  app.put('/api/shopify/tiendas/:id', soloDesdeLaApp, json, r((req) => editarTienda(req.params.id, req.body || {})));
}

// El producto del usuario (se carga una vez y sirve para todos los estilos). Ver lib/productos.js.
//
// GET    /api/productos                  -> [{ id, nombre, tipo, foto, fichaLista, estado, creado }]
// POST   /api/productos                  { nombre?, tipo, url?, descripcion?, guionPropio? } -> { id, producto }
// PUT    /api/productos/:id              lo mismo, para cambiar lo que escribio (solo lo que viene)
// PUT    /api/productos/:id/fotos/:n     cuerpo binario de la imagen (n = 1..8; la 1 es la principal) -> { n, archivo, url }
// GET    /api/productos/:id/fotos/:n     la foto
// DELETE /api/productos/:id/fotos/:n
// POST   /api/productos/:id/analizar     baja la pagina y lanza la sesion "ficha" de Claude -> { tarea }
// GET    /api/productos/:id              -> { producto, ficha, tarea: { estado: analizando|lista|error|sin, progreso, error, limite } }
// PUT    /api/productos/:id/ficha        { correcciones?: { campo: valor }, respuestas?: { campo: valor } } -> la ficha
import express from 'express';
import {
  ErrorApp, crearProducto, actualizarProducto, guardarFoto, borrarFoto, rutaFoto, analizarProducto, estadoProducto, corregirFicha,
  listarProductos, idValido, retomarFichas, soloDesdeLaApp,
} from '../lib/productos.js';

const TIPOS_FOTO = { '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

// Los errores con su mensaje para el usuario; lo demas, al manejador general.
const conErrores = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e instanceof ErrorApp) return res.status(e.status).json({ error: e.message, ...(e.tipo ? { tipo: e.tipo } : {}), ...(e.detalle ? { detalle: e.detalle } : {}) });
    next(e);
  }
};

// El cuerpo de la foto llega crudo (sin JSON: el JSON de la app tiene un tope de 2 MB).
const crudo = express.raw({ type: () => true, limit: '25mb' });
const leerFoto = (req, res, next) =>
  crudo(req, res, (err) => {
    if (err) return res.status(err.status === 413 ? 413 : 400).json({ error: err.status === 413 ? 'Esa foto pesa demasiado (más de 25 MB). Prueba con una más liviana.' : 'No pude leer esa foto.' });
    next();
  });

export default function rutasProductos(app) {
  app.get('/api/productos', (req, res) => res.json({ productos: listarProductos() }));

  app.post('/api/productos', soloDesdeLaApp, conErrores((req, res) => {
    const producto = crearProducto(req.body || {});
    res.status(201).json({ id: producto.id, producto });
  }));

  app.put('/api/productos/:id', soloDesdeLaApp, conErrores((req, res) => {
    if (!idValido(req.params.id)) throw new ErrorApp(404, 'No encuentro ese producto.');
    res.json({ producto: actualizarProducto(req.params.id, req.body || {}) });
  }));

  app.put('/api/productos/:id/fotos/:n', soloDesdeLaApp, leerFoto, conErrores(async (req, res) => {
    if (!idValido(req.params.id)) throw new ErrorApp(404, 'No encuentro ese producto.');
    res.json(await guardarFoto(req.params.id, req.params.n, Buffer.isBuffer(req.body) ? req.body : null));
  }));

  app.get('/api/productos/:id/fotos/:n', (req, res) => {
    const abs = idValido(req.params.id) ? rutaFoto(req.params.id, req.params.n) : null;
    if (!abs) return res.status(404).json({ error: 'No encuentro esa foto.' });
    const ext = abs.slice(abs.lastIndexOf('.')).toLowerCase();
    res.sendFile(abs, { dotfiles: 'deny', maxAge: 0, headers: { 'Content-Type': TIPOS_FOTO[ext] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' } });
  });

  app.delete('/api/productos/:id/fotos/:n', soloDesdeLaApp, conErrores((req, res) => {
    if (!idValido(req.params.id)) throw new ErrorApp(404, 'No encuentro ese producto.');
    res.json(borrarFoto(req.params.id, req.params.n));
  }));

  app.post('/api/productos/:id/analizar', soloDesdeLaApp, conErrores((req, res) => {
    if (!idValido(req.params.id)) throw new ErrorApp(404, 'No encuentro ese producto.');
    res.status(202).json(analizarProducto(req.params.id));
  }));

  app.get('/api/productos/:id', (req, res) => {
    const e = idValido(req.params.id) ? estadoProducto(req.params.id) : null;
    if (!e) return res.status(404).json({ error: 'No encuentro ese producto.' });
    res.json(e);
  });

  app.put('/api/productos/:id/ficha', soloDesdeLaApp, conErrores((req, res) => {
    if (!idValido(req.params.id)) throw new ErrorApp(404, 'No encuentro ese producto.');
    res.json({ ficha: corregirFicha(req.params.id, req.body || {}) });
  }));

  // Lo que quedo analizandose cuando se cerro la app sigue solo (un momento despues de arrancar).
  if (!process.env.ANUNCIOS_NO_RETOMAR) setTimeout(retomarFichas, 3000).unref();
}

// El guion de un anuncio nuevo: lo escribe Claude Code con la cuenta del usuario y el usuario lo aprueba o pide
// cambios con sus palabras. Ver lib/anuncios-nuevos.js.
//
// POST /api/anuncios                          { productoId, estilo, duracion, voz: { id, nombre }, continuidad, respuestas }
//                                             -> { slug } (crea el brief, prepara la foto y lanza la sesion "guion")
// GET  /api/anuncios/:slug/guion              -> { estado: escribiendo|listo|error, guion?, progreso: [frases], error?, limite, ... }
// POST /api/anuncios/:slug/guion/cambios      { pedido } -> la misma conversacion de Claude (--resume)
// PUT  /api/anuncios/:slug/guion/lineas      { lineas: [{ n, dice }] } editar a mano lo que se dice -> { directo } | { conIA }
// POST /api/anuncios/:slug/guion/regenerar-linea { n, actual?, idea? } otra versión de una parte (no guarda) -> { dice }
// POST /api/anuncios/:slug/guion/reintentar   vuelve a correr lo que fallo (sigue desde donde quedo)
// POST /api/anuncios/:slug/guion/letra        { n } el musical: elige una de las letras (se puede cambiar hasta producir)
// PUT  /api/anuncios/:slug/voz                { id, nombre } | { auto: true } la voz del narrador (antes de generarla) -> { voz }
// PUT  /api/anuncios/:slug/voz                { id, nombre } | { auto: true }: la voz del narrador, antes de generarla
// DELETE /api/anuncios/:slug                  descarta un anuncio que todavia no se produce (va a temp/_descartados/)
//
// POST /api/anuncios/:slug/producir (aprobar y arrancar) lo atiende rutas/produccion.js con el conductor.
import { ErrorApp, soloDesdeLaApp } from '../lib/productos.js';
import { cambiarVoz, crearAnuncio, editarLineas, regenerarLinea, descartarAnuncio, elegirLetra, estadoGuion, pedirCambios, reintentarGuion, retomarGuiones } from '../lib/anuncios-nuevos.js';

const conErrores = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e instanceof ErrorApp) return res.status(e.status).json({ error: e.message, ...(e.tipo ? { tipo: e.tipo } : {}), ...(e.detalle ? { detalle: e.detalle } : {}) });
    next(e);
  }
};

export default function rutasGuion(app) {
  app.post('/api/anuncios', soloDesdeLaApp, conErrores((req, res) => {
    res.status(201).json(crearAnuncio(req.body || {}));
  }));

  app.get('/api/anuncios/:slug/guion', (req, res) => {
    const e = estadoGuion(req.params.slug);
    if (!e) return res.status(404).json({ error: 'No encuentro ese anuncio.' });
    res.set('Cache-Control', 'no-store').json(e);
  });

  app.post('/api/anuncios/:slug/guion/cambios', soloDesdeLaApp, conErrores((req, res) => {
    res.status(202).json(pedirCambios(req.params.slug, req.body?.pedido));
  }));

  app.put('/api/anuncios/:slug/guion/lineas', soloDesdeLaApp, conErrores(async (req, res) => {
    res.json(await editarLineas(req.params.slug, req.body?.lineas));
  }));

  app.post('/api/anuncios/:slug/guion/regenerar-linea', soloDesdeLaApp, conErrores(async (req, res) => {
    res.json(await regenerarLinea(req.params.slug, req.body || {}));
  }));

  app.post('/api/anuncios/:slug/guion/reintentar', soloDesdeLaApp, conErrores((req, res) => {
    res.status(202).json(reintentarGuion(req.params.slug));
  }));

  app.post('/api/anuncios/:slug/guion/letra', soloDesdeLaApp, conErrores((req, res) => {
    res.json(elegirLetra(req.params.slug, req.body?.n));
  }));

  app.put('/api/anuncios/:slug/voz', soloDesdeLaApp, conErrores(async (req, res) => {
    res.json(await cambiarVoz(req.params.slug, req.body || {}));
  }));

  app.delete('/api/anuncios/:slug', soloDesdeLaApp, conErrores((req, res) => {
    res.json(descartarAnuncio(req.params.slug));
  }));

  // Los guiones que quedaron a medias cuando se cerro la app siguen solos (un momento despues de arrancar).
  if (!process.env.ANUNCIOS_NO_RETOMAR) setTimeout(retomarGuiones, 3000).unref();
}

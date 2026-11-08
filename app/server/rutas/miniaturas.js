// Miniaturas livianas (JPEG achicado) de cualquier imagen o video de un anuncio.
//
// GET /archivos/miniatura/anuncio/:slug/<ruta>?ancho=480        imagen de temp/<slug>/ achicada
// GET /archivos/miniatura/anuncio/:slug/<ruta.mp4>?ancho=480&t=1 un cuadro del clip en el segundo t
// GET /archivos/miniatura/salida/<archivo.mp4>?ancho=480&t=1     un cuadro de un MP4 final
// GET /archivos/miniatura/muestra/<clave>/<archivo>?ancho=480    la muestra de un estilo que trae el paquete
//
// En la interfaz no se arman a mano: miniatura(url, 480) en src/datos/api.js convierte cualquier
// url de /archivos/... en su miniatura. Si algo falla, se redirige al original.
import path from 'node:path';
import { TEMP, OUTPUT } from '../lib/rutas.js';
import { dentroDe, segmentoValido, stat, esImagen, esVideo } from '../lib/archivos.js';
import { slugValido, urlAnuncio, urlSalida } from '../lib/anuncios.js';
import { miniatura, anchoPermitido } from '../lib/miniaturas.js';
import { rutaDeArchivoDeMuestra, urlMuestra } from '../lib/muestras.js';

async function responder(req, res, abs, original) {
  const st = stat(abs);
  const nombre = path.basename(abs);
  if (!st?.isFile() || !(esImagen(nombre) || esVideo(nombre))) return res.status(404).json({ error: 'No encuentro ese archivo.' });
  const ancho = anchoPermitido(req.query.ancho || 480);
  const t = Math.max(0, Math.min(600, Math.round((Number(req.query.t) || 0.8) * 10) / 10));
  try {
    const archivo = await miniatura(abs, ancho, { segundo: t });
    // la carpeta .cache es de la app (la ruta la arma el servidor, no la URL): por eso dotfiles 'allow'
    res.sendFile(archivo, { dotfiles: 'allow', cacheControl: true, maxAge: 0, headers: { 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    if (esImagen(nombre)) return res.redirect(302, original);
    res.status(404).json({ error: 'No pude sacar un cuadro de ese video.' });
  }
}

export default function rutasMiniaturas(app) {
  app.get('/archivos/miniatura/anuncio/:slug/*ruta', (req, res) => {
    const { slug } = req.params;
    if (!slugValido(slug)) return res.status(404).json({ error: 'No encuentro ese anuncio.' });
    const partes = Array.isArray(req.params.ruta) ? req.params.ruta : String(req.params.ruta || '').split('/');
    const abs = dentroDe(path.join(TEMP, slug), partes);
    if (!abs) return res.status(400).json({ error: 'Ruta no válida.' });
    return responder(req, res, abs, urlAnuncio(slug, partes.join('/')));
  });

  app.get('/archivos/miniatura/salida/:archivo', (req, res) => {
    const { archivo } = req.params;
    if (!segmentoValido(archivo)) return res.status(400).json({ error: 'Ruta no válida.' });
    const abs = dentroDe(OUTPUT, [archivo]);
    if (!abs) return res.status(400).json({ error: 'Ruta no válida.' });
    return responder(req, res, abs, urlSalida(archivo));
  });

  app.get('/archivos/miniatura/muestra/:clave/:archivo', (req, res) => {
    const { clave, archivo } = req.params;
    const abs = rutaDeArchivoDeMuestra(clave, archivo);
    if (!abs) return res.status(404).json({ error: 'No encuentro ese archivo.' });
    return responder(req, res, abs, urlMuestra(clave, archivo));
  });
}

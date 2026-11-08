// Sirve imagenes, videos y audios de los anuncios (con Range: los videos se pueden adelantar).
//
// GET /archivos/anuncio/:slug/<ruta>   -> un archivo dentro de temp/<slug>/   (p. ej. img/toma-1-inicial.png)
// GET /archivos/salida/<archivo>       -> un archivo suelto de output/        (p. ej. <slug>_9x16_con-subtitulos.mp4)
// GET /archivos/muestra/<clave>/<arch> -> la muestra de un estilo que trae el paquete (app/muestras/<clave>/video.mp4
//                                         o imagen.jpg): solo esos archivos, de solo lectura
//
// Solo medios (ver TIPOS_MEDIO). Los JSON del motor nunca salen por aca. Ninguna ruta puede salirse de su carpeta.
import path from 'node:path';
import { TEMP, OUTPUT } from '../lib/rutas.js';
import { dentroDe, segmentoValido, stat, TIPOS_MEDIO } from '../lib/archivos.js';
import { slugValido } from '../lib/anuncios.js';
import { rutaDeArchivoDeMuestra } from '../lib/muestras.js';

function enviar(res, abs) {
  const tipo = TIPOS_MEDIO[path.extname(abs).toLowerCase()];
  if (!tipo) return res.status(404).json({ error: 'Ese archivo no se puede abrir desde la app.' });
  const st = stat(abs);
  if (!st?.isFile()) return res.status(404).json({ error: 'No encuentro ese archivo.' });
  // res.sendFile atiende Range (206), ETag y Last-Modified por su cuenta.
  res.sendFile(abs, {
    dotfiles: 'deny',
    acceptRanges: true,
    cacheControl: true,
    maxAge: 0, // el motor puede rehacer un archivo con el mismo nombre: siempre se revalida (304 si no cambio)
    headers: { 'Content-Type': tipo, 'X-Content-Type-Options': 'nosniff' },
  });
}

export default function rutasArchivos(app) {
  app.get('/archivos/anuncio/:slug/*ruta', (req, res) => {
    const { slug } = req.params;
    if (!slugValido(slug)) return res.status(404).json({ error: 'No encuentro ese anuncio.' });
    const partes = Array.isArray(req.params.ruta) ? req.params.ruta : String(req.params.ruta || '').split('/');
    const abs = dentroDe(path.join(TEMP, slug), partes);
    if (!abs) return res.status(400).json({ error: 'Ruta no válida.' });
    enviar(res, abs);
  });

  app.get('/archivos/salida/:archivo', (req, res) => {
    const { archivo } = req.params;
    if (!segmentoValido(archivo)) return res.status(400).json({ error: 'Ruta no válida.' });
    const abs = dentroDe(OUTPUT, [archivo]);
    if (!abs) return res.status(400).json({ error: 'Ruta no válida.' });
    enviar(res, abs);
  });

  app.get('/archivos/muestra/:clave/:archivo', (req, res) => {
    const abs = rutaDeArchivoDeMuestra(req.params.clave, req.params.archivo);
    if (!abs) return res.status(404).json({ error: 'No encuentro ese archivo.' });
    enviar(res, abs);
  });
}

// Los anuncios terminados guardados en GitHub, por producto (lib/anuncios-github.js).
//   GET  /api/anuncios-github            -> { estado, productos: [{ producto, nombre, anuncios: [...] }] }
//   POST /api/anuncios-github/traer      -> trae lo nuevo de GitHub ya
//   GET  /archivos/github/<ruta>         un video o imagen del repositorio (se baja la primera vez y queda guardado)
import path from 'node:path';
import { soloDesdeLaApp } from '../lib/productos.js';
import { stat, TIPOS_MEDIO } from '../lib/archivos.js';
import { miniatura, anchoPermitido } from '../lib/miniaturas.js';
import { archivoLocal, estadoAnunciosGithub, iniciarAnunciosGithub, listarAnunciosGithub, ponerAlDia } from '../lib/anuncios-github.js';

export const urlGithub = (ruta) => (ruta ? `/archivos/github/${ruta.split('/').map(encodeURIComponent).join('/')}` : null);

export default function rutasAnunciosGithub(app) {
  iniciarAnunciosGithub();

  app.get('/api/anuncios-github', async (req, res) => {
    const productos = (await listarAnunciosGithub()).map((p) => ({
      ...p,
      anuncios: p.anuncios.map((a) => ({ ...a, portada: urlGithub(a.portada || a.versiones[0]?.ruta), versiones: a.versiones.map((v) => ({ ...v, url: urlGithub(v.ruta) })) })),
    }));
    res.set('Cache-Control', 'no-store').json({ estado: estadoAnunciosGithub(), productos });
  });

  app.post('/api/anuncios-github/traer', soloDesdeLaApp, async (req, res) => {
    await ponerAlDia();
    res.json({ estado: estadoAnunciosGithub() });
  });

  const servir = async (req, res, comoMiniatura) => {
    const partes = Array.isArray(req.params.ruta) ? req.params.ruta : String(req.params.ruta || '').split('/');
    const abs = await archivoLocal(partes.join('/'));
    const tipo = abs && TIPOS_MEDIO[path.extname(abs).toLowerCase()];
    if (!tipo || !stat(abs)?.isFile()) return res.status(404).json({ error: 'No encuentro ese archivo en GitHub.' });
    if (comoMiniatura) {
      try {
        const m = await miniatura(abs, anchoPermitido(req.query.ancho || 480), { segundo: Number(req.query.t) || 0.8 });
        return res.sendFile(m, { dotfiles: 'allow', cacheControl: true, maxAge: 0 });
      } catch {
        /* sigue con el original */
      }
    }
    res.sendFile(abs, { dotfiles: 'allow', acceptRanges: true, cacheControl: true, maxAge: '1d', headers: { 'Content-Type': tipo, 'X-Content-Type-Options': 'nosniff' } });
  };
  app.get('/archivos/github/*ruta', (req, res) => servir(req, res, false));
  app.get('/archivos/miniatura/github/*ruta', (req, res) => servir(req, res, true));
}

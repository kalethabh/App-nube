// MEJORES ANUNCIOS / INSPIRACIÓN (lib/ganadores.js): buscar en TrendTrack con el conector de claude.ai del usuario.
// Lo propio de Inspiración (formatos, marcas, replicar imágenes) está en rutas/inspiracion.js.
//
//   GET    /api/ganadores                 -> { opciones: { nichos, paises, ordenes, creditosPorAnuncio }, creditos,
//                                             recientes, guardados, buscando }
//   POST   /api/ganadores/buscar          { filtros, forzar? } -> { clave, filtros, fecha, anuncios, creditos, desdeCache }
//                                             (tarda unos segundos: abre una sesión de Claude; la caché responde al instante)
//   GET    /api/ganadores/busquedas/:clave -> una búsqueda ya hecha (sin gastar)
//   POST   /api/ganadores/guardados       { anuncio, nota? } -> { anuncio }
//   DELETE /api/ganadores/guardados/:id
//   GET    /api/ganadores/media?u=<url>   el video de un anuncio servido por la app (TrendTrack lo redirige a su
//                                             almacenamiento y algunos navegadores no lo reproducen así); con Range
//   POST   /api/ganadores/adaptar         { anuncio } -> { id, nombre, valor: "subido:<id>|<nombre>" } (baja el video
//                                             para «Adaptar a mi producto» en Nuevo anuncio)
import { Readable } from 'node:stream';
import express from 'express';
import { soloDesdeLaApp } from '../lib/productos.js';
import {
  CREDITOS_POR_ANUNCIO,
  NICHOS,
  ORDENES,
  PAISES,
  bajarParaReferencia,
  deTrendtrack,
  buscarGanadores,
  busquedaEnCurso,
  busquedaGuardada,
  busquedasRecientes,
  guardarAnuncio,
  listarGuardados,
  quitarGuardado,
  ultimosCreditos,
} from '../lib/ganadores.js';
import { actualizarMarcasDesde } from '../lib/inspiracion.js';

const json = express.json({ limit: '1mb' });

const responderError = (res, e, porDefecto) => {
  const status = Number.isInteger(e?.status) ? e.status : 500;
  if (status >= 500 && !e?.status) console.error('[ganadores]', e);
  res.status(status).json({ error: e?.status ? e.message : porDefecto });
};

export default function rutasGanadores(app) {
  app.get('/api/ganadores', (req, res) => {
    res.set('Cache-Control', 'no-store').json({
      opciones: { nichos: NICHOS, paises: PAISES, ordenes: Object.entries(ORDENES).map(([id, o]) => ({ id, texto: o.texto })), creditosPorAnuncio: CREDITOS_POR_ANUNCIO },
      creditos: ultimosCreditos(),
      recientes: busquedasRecientes(),
      guardados: listarGuardados(),
      buscando: Boolean(busquedaEnCurso()),
    });
  });

  app.post('/api/ganadores/buscar', soloDesdeLaApp, json, async (req, res) => {
    try {
      const r = await buscarGanadores(req.body?.filtros || {}, { forzar: req.body?.forzar === true });
      actualizarMarcasDesde(r.anuncios); // las marcas que sigues se ponen al día gratis
      res.json(r);
    } catch (e) {
      responderError(res, e, 'La búsqueda no terminó bien. Vuelve a intentar.');
    }
  });

  app.get('/api/ganadores/busquedas/:clave', (req, res) => {
    const r = busquedaGuardada(req.params.clave);
    if (!r) return res.status(404).json({ error: 'Esa búsqueda ya no está guardada. Búscala de nuevo.' });
    res.set('Cache-Control', 'no-store').json(r);
  });

  app.post('/api/ganadores/guardados', soloDesdeLaApp, json, (req, res) => {
    try {
      res.status(201).json({ anuncio: guardarAnuncio(req.body?.anuncio, req.body?.nota) });
    } catch (e) {
      responderError(res, e, 'No pude guardar ese anuncio.');
    }
  });

  app.delete('/api/ganadores/guardados/:id', soloDesdeLaApp, (req, res) => {
    quitarGuardado(String(req.params.id || ''));
    res.json({ ok: true });
  });

  app.get('/api/ganadores/media', async (req, res) => {
    const url = deTrendtrack(req.query.u);
    if (!url) return res.status(400).json({ error: 'Ese archivo no es de TrendTrack.' });
    const corte = new AbortController();
    res.on('close', () => corte.abort());
    try {
      const r = await fetch(url, { headers: req.headers.range ? { Range: String(req.headers.range) } : {}, redirect: 'follow', signal: corte.signal });
      res.status(r.status);
      for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
        const v = r.headers.get(h);
        if (v) res.set(h, v);
      }
      res.set('Cache-Control', 'private, max-age=86400');
      if (!r.body) return res.end();
      Readable.fromWeb(r.body).on('error', () => res.destroy()).pipe(res);
    } catch {
      if (!res.headersSent) res.status(502).json({ error: 'No pude traer ese video de TrendTrack.' });
      else res.destroy();
    }
  });

  app.post('/api/ganadores/adaptar', soloDesdeLaApp, json, async (req, res) => {
    try {
      res.status(201).json(await bajarParaReferencia(req.body?.anuncio));
    } catch (e) {
      responderError(res, e, 'No pude preparar ese video.');
    }
  });
}

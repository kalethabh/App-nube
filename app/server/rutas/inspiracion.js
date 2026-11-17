// INSPIRACIÓN (lib/inspiracion.js, sobre lib/ganadores.js). La búsqueda, los guardados y el video siguen en
// /api/ganadores/*; aquí va lo nuevo:
//
//   GET    /api/inspiracion                    -> { formatos, sonidos, marcas, clasificacion }
//   POST   /api/inspiracion/costo              { filtros } -> { enCache, creditos }   (lo que costaría buscar eso)
//   POST   /api/inspiracion/clasificar         { anuncios, iniciar? } -> { clasif: { id: {...} }, estado }
//                                              (iniciar: suma a la IA los que falta mirar; sin gastar TrendTrack)
//   POST   /api/inspiracion/marcas             { marca } -> { marca }        seguir
//   DELETE /api/inspiracion/marcas/:id                                       dejar de seguir
//   POST   /api/inspiracion/marcas/buscar      { texto } | { brandtracker: true } -> { marcas, desdeCache, gastados, creditos }
//   POST   /api/inspiracion/replicar-imagen    { anuncio } -> { archivo, url, nombre }
//   GET    /api/inspiracion/imagenes/:archivo  la imagen bajada para replicar
import express from 'express';
import { soloDesdeLaApp } from '../lib/productos.js';
import { CREDITOS_POR_ANUNCIO, busquedaEnCache, filtrosLimpios, normalizarDeVuelta } from '../lib/ganadores.js';
import {
  FORMATOS,
  SONIDOS,
  bajarImagenParaReplicar,
  buscarMarcas,
  clasificacionDe,
  clasificarConIA,
  dejarDeSeguir,
  estadoClasificacion,
  listarMarcas,
  rutaImagen,
  seguirMarca,
} from '../lib/inspiracion.js';

const json = express.json({ limit: '2mb' });

const responderError = (res, e, porDefecto) => {
  const status = Number.isInteger(e?.status) ? e.status : 500;
  if (status >= 500 && !e?.status) console.error('[inspiracion]', e);
  res.status(status).json({ error: e?.status ? e.message : porDefecto });
};

export default function rutasInspiracion(app) {
  app.get('/api/inspiracion', (req, res) => {
    res.set('Cache-Control', 'no-store').json({ formatos: FORMATOS, sonidos: SONIDOS, marcas: listarMarcas(), clasificacion: estadoClasificacion() });
  });

  app.post('/api/inspiracion/costo', soloDesdeLaApp, json, (req, res) => {
    const f = filtrosLimpios(req.body?.filtros || {});
    res.json({ enCache: busquedaEnCache(f), creditos: Math.ceil(f.cantidad * CREDITOS_POR_ANUNCIO) });
  });

  app.post('/api/inspiracion/clasificar', soloDesdeLaApp, json, (req, res) => {
    const anuncios = (Array.isArray(req.body?.anuncios) ? req.body.anuncios : []).slice(0, 200).map(normalizarDeVuelta).filter(Boolean);
    const estado = req.body?.iniciar === true ? clasificarConIA(anuncios) : estadoClasificacion();
    res.json({ clasif: Object.fromEntries(anuncios.map((a) => [a.id, clasificacionDe(a)])), estado });
  });

  app.post('/api/inspiracion/marcas', soloDesdeLaApp, json, (req, res) => {
    try {
      res.status(201).json({ marca: seguirMarca(req.body?.marca) });
    } catch (e) {
      responderError(res, e, 'No pude seguir esa marca.');
    }
  });

  app.delete('/api/inspiracion/marcas/:id', soloDesdeLaApp, (req, res) => {
    dejarDeSeguir(String(req.params.id || ''));
    res.json({ ok: true });
  });

  app.post('/api/inspiracion/marcas/buscar', soloDesdeLaApp, json, async (req, res) => {
    try {
      res.json(await buscarMarcas(req.body?.texto, { brandtracker: req.body?.brandtracker === true }));
    } catch (e) {
      responderError(res, e, 'No pude buscar marcas. Vuelve a intentar.');
    }
  });

  app.post('/api/inspiracion/replicar-imagen', soloDesdeLaApp, json, async (req, res) => {
    try {
      res.status(201).json(await bajarImagenParaReplicar(normalizarDeVuelta(req.body?.anuncio)));
    } catch (e) {
      responderError(res, e, 'No pude preparar esa imagen.');
    }
  });

  app.get('/api/inspiracion/imagenes/:archivo', (req, res) => {
    const ruta = rutaImagen(req.params.archivo);
    if (!ruta) return res.status(404).end();
    res.set('Cache-Control', 'private, max-age=86400').sendFile(ruta, (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  });
}

// La sección «Investigación de mercado» (lib/investigacion.js): una por producto, solo con su foto.
//
//   GET  /api/investigacion                      -> { productos: [{ id, nombre, foto, estado, fecha, veredicto, pais, resaltados }], motor }
//   GET  /api/investigacion/:id                  -> { producto, tarea, investigacion, resaltados }
//   POST /api/investigacion/:id  { pais?, soloAndromeda? }  lanza la investigación (10 a 30 minutos; no espera) -> { tarea }
//                                                 (soloAndromeda: le agrega a la hecha los conceptos para Meta, unos minutos)
//   PUT  /api/investigacion/:id/resaltados { resaltados: [{ id?, texto, seccion?, nota? }] } -> { resaltados }
//   GET  /api/investigacion/:id/competencia      -> { tarea, competencia }   la investigación competitiva con TrendTrack
//   POST /api/investigacion/:id/competencia { enlace, producto?, pais?, brandtracker?, retomar? }   lanza sus 6 etapas
//        de una vez (gasta créditos de TrendTrack del usuario; no espera) -> { tarea }
import { soloDesdeLaApp, ErrorApp, idValido } from '../lib/productos.js';
import { motorElegido } from '../lib/motor-ia.js';
import * as inv from '../lib/investigacion.js';
import * as competencia from '../lib/competencia.js';

const conErrores = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e instanceof ErrorApp || (Number.isInteger(e?.status) && e.status >= 400 && e.status < 600)) return res.status(e.status).json({ error: e.message });
    next(e);
  }
};

const elId = (req) => {
  const id = String(req.params.id || '');
  if (!idValido(id)) throw new ErrorApp(404, 'No encuentro ese producto.');
  return id;
};

export default function rutasInvestigacion(app) {
  inv.cerrarLasCortadas();
  competencia.cerrarLasCortadas();

  app.get('/api/investigacion', (req, res) => res.set('Cache-Control', 'no-store').json({ productos: inv.listar(), motor: motorElegido() }));

  app.get('/api/investigacion/:id', conErrores((req, res) => {
    const e = inv.estado(elId(req));
    if (!e) throw new ErrorApp(404, 'No encuentro ese producto.');
    res.set('Cache-Control', 'no-store').json(e);
  }));

  app.post('/api/investigacion/:id', soloDesdeLaApp, conErrores((req, res) => {
    res.status(202).json(inv.investigar(elId(req), { pais: req.body?.pais || null, soloAndromeda: req.body?.soloAndromeda === true }));
  }));

  app.get('/api/investigacion/:id/competencia', conErrores((req, res) => {
    const e = competencia.estado(elId(req));
    if (!e) throw new ErrorApp(404, 'No encuentro ese producto.');
    res.set('Cache-Control', 'no-store').json(e);
  }));

  app.post('/api/investigacion/:id/competencia', soloDesdeLaApp, conErrores((req, res) => {
    const c = req.body || {};
    res.status(202).json(competencia.investigar(elId(req), { enlace: c.enlace, producto: c.producto, pais: c.pais, brandtracker: c.brandtracker === true, retomar: c.retomar === true }));
  }));

  app.put('/api/investigacion/:id/resaltados', soloDesdeLaApp, conErrores((req, res) => {
    res.json({ resaltados: inv.guardarResaltados(elId(req), req.body?.resaltados) });
  }));
}

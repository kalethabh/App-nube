// La sección «Investigación de mercado» (lib/investigacion.js): una por producto, solo con su foto.
//
//   GET  /api/investigacion                      -> { productos: [{ id, nombre, foto, estado, fecha, veredicto, pais, resaltados }], motor }
//   GET  /api/investigacion/:id                  -> { producto, tarea, investigacion, resaltados }
//   POST /api/investigacion/:id  { pais? }       lanza la investigación (10 a 30 minutos; no espera) -> { tarea }
//   PUT  /api/investigacion/:id/resaltados { resaltados: [{ id?, texto, seccion?, nota? }] } -> { resaltados }
import { soloDesdeLaApp, ErrorApp, idValido } from '../lib/productos.js';
import { motorElegido } from '../lib/motor-ia.js';
import * as inv from '../lib/investigacion.js';

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

  app.get('/api/investigacion', (req, res) => res.set('Cache-Control', 'no-store').json({ productos: inv.listar(), motor: motorElegido() }));

  app.get('/api/investigacion/:id', conErrores((req, res) => {
    const e = inv.estado(elId(req));
    if (!e) throw new ErrorApp(404, 'No encuentro ese producto.');
    res.set('Cache-Control', 'no-store').json(e);
  }));

  app.post('/api/investigacion/:id', soloDesdeLaApp, conErrores((req, res) => {
    res.status(202).json(inv.investigar(elId(req), { pais: req.body?.pais || null }));
  }));

  app.put('/api/investigacion/:id/resaltados', soloDesdeLaApp, conErrores((req, res) => {
    res.json({ resaltados: inv.guardarResaltados(elId(req), req.body?.resaltados) });
  }));
}

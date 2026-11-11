// El guardado automático y la selección local del destino (la selección no mueve anuncios anteriores).
import { soloDesdeLaApp } from '../lib/productos.js';
import { EN_SERVIDOR } from '../lib/servidor.js';
import { estadoGuardado, guardarAhora, iniciarGuardado } from '../lib/guardado.js';
import { guardarAlmacenamiento, seleccionarCarpeta } from '../lib/almacenamiento.js';

const error = (res, e) => res.status(e?.status || 422).json({ error: e?.status ? e.message : 'No pude cambiar el guardado. Vuelve a intentarlo.' });

/** El diálogo se abre en la máquina del servidor; nunca se ofrece a una sesión remota. */
export function esPedidoLocal(req) {
  const direccion = String(req.socket?.remoteAddress || '').toLowerCase();
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(direccion)) return false;
  try {
    const host = new URL(`http://${req.headers.host || ''}`).hostname.toLowerCase();
    return ['localhost', '127.0.0.1', '[::1]'].includes(host);
  } catch {
    return false;
  }
}

export default function rutasGuardado(app) {
  iniciarGuardado();
  app.get('/api/guardado', (req, res) => res.set('Cache-Control', 'no-store').json(estadoGuardado()));
  app.put('/api/guardado/configuracion', soloDesdeLaApp, (req, res) => {
    try {
      guardarAlmacenamiento(req.body);
      res.set('Cache-Control', 'no-store').json(estadoGuardado());
    } catch (e) {
      error(res, e);
    }
  });
  app.post('/api/guardado/elegir-carpeta', soloDesdeLaApp, async (req, res) => {
    if (EN_SERVIDOR || !esPedidoLocal(req)) return res.status(403).json({ error: 'El selector de carpetas solo se puede usar desde la app en este computador. Puedes escribir la ruta del destino.' });
    try {
      res.set('Cache-Control', 'no-store').json(await seleccionarCarpeta());
    } catch (e) {
      error(res, e);
    }
  });
  app.post('/api/guardado', soloDesdeLaApp, async (req, res) => {
    await guardarAhora();
    res.json(estadoGuardado());
  });
}

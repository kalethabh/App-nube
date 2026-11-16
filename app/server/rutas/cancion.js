// La canción de los anuncios cantados (musical e historia musical): la ÚNICA pausa de su producción.
//
//   GET  /api/anuncios/:slug/cancion           { estado, titulo, estilos, elegida, puedeOtra, opciones: [{ n, url, duracion, grupo, detalle, costo? }] }
//                                              estado: no-hay | generando | eligiendo | esperando | elegida
//                                              costo (si se pudo calcular): el video estimado con esa versión,
//                                              { creditos: { min, max }, dolares: { min, max }, segundos }
//   GET  /api/anuncios/:slug/cancion/:n/audio  el mp3 de la versión n (con Range: se puede adelantar)
//   POST /api/anuncios/:slug/cancion {n}       elige la versión n y la producción sigue sola -> { ok, conductor }
//   POST /api/anuncios/:slug/cancion {otra:true}  "ninguna me convence": otra tanda con la misma letra (tope 2)
//
// El conductor queda "pausado" en el paso "elegir-cancion" hasta que llega la elección (familias/musical.js);
// elegir escribe app/cancion-eleccion.json y llama a continuar(): de ahí sigue desde donde quedó, sin pagar dos
// veces. El audio se sirve por aca (y no por /archivos) porque mientras se elige todavía no hay manifiesto.
// Los POST solo desde la propia app (una página cualquiera podría mandarle un POST a 127.0.0.1).
import { PUERTO } from '../lib/rutas.js';
import { origenesPermitidos } from '../lib/servidor.js';
import { slugDeLaApp, leerConductor, continuar } from '../lib/conductor.js';
import { costoDelAnuncio } from '../lib/costo-estimado.js';
import { copiarModelosAlAnuncio } from '../lib/modelos.js';

const ORIGENES = origenesPermitidos(PUERTO); // el mismo chequeo en toda la app (lib/servidor.js), con el dominio del servidor si lo hay
const CANTADOS = new Set(['musical', 'historia-musical']);
const PASO_PAUSA = 'elegir-cancion'; // familias/musical.js, PASO_PAUSA

// La familia se carga al usarla: si tuviera un problema, falla esta ruta y no la app entera.
let familia = null;
async function cantados() {
  familia ||= import('../lib/familias/musical.js');
  return familia;
}

function desdeLaApp(req, res) {
  const origen = req.headers.origin;
  const sitio = String(req.headers['sec-fetch-site'] || '');
  if ((origen && !ORIGENES.has(String(origen).toLowerCase())) || sitio === 'cross-site') {
    res.status(403).json({ error: 'Solo desde la app.' });
    return false;
  }
  return true;
}

/**
 * El costo estimado del VIDEO con cada versión (excepción a "sin precios" del 2026-11-09): opciones[i].costo =
 * { creditos: { min, max }, dolares: { min, max }, segundos } (lo que va a durar la canción entera con esa versión).
 * Solo si ya está calculado (lib/costo-estimado.js, la caché de GET /costo): esta ruta no lanza el motor ni lo
 * espera. La pausa pide GET /costo aparte (su porCancion tiene lo mismo), así que las versiones nunca se demoran por
 * el costo; si todavía no está, van sin costo.
 */
async function conCostoPorVersion(slug, datos) {
  if (!Array.isArray(datos?.opciones) || !datos.opciones.length || datos.estado === 'elegida') return;
  try {
    const costo = await costoDelAnuncio(slug, { soloCache: true });
    if (!costo?.disponible || !Array.isArray(costo.porCancion)) return;
    for (const o of datos.opciones) {
      const v = costo.porCancion.find((x) => x.n === o.n);
      if (v) o.costo = { creditos: v.creditos, dolares: v.dolares, segundos: v.segundos };
    }
  } catch {
    /* sin costo: la pantalla sigue como siempre */
  }
}

/** conductor.json para la pantalla: sin los saldos de kie (ningún número a la vista). */
function paraLaPantalla(c) {
  if (!c || typeof c !== 'object') return c;
  const { saldoFinal, ...resto } = c; // el saldo inicial se muestra (con su color) en el registro
  return resto;
}

export default function rutasCancion(app) {
  app.get('/api/anuncios/:slug/cancion', async (req, res) => {
    const { slug } = req.params;
    if (!slugDeLaApp(slug)) return res.status(404).json({ error: 'No encuentro ese anuncio.' });
    const c = leerConductor(slug);
    if (c && !CANTADOS.has(c.familia)) return res.status(404).json({ error: 'Este anuncio no lleva canción.' });
    const { opcionesDeCancion } = await cantados();
    const datos = opcionesDeCancion(slug, c);
    await conCostoPorVersion(slug, datos);
    res.set('Cache-Control', 'no-store').json(datos);
  });

  app.get('/api/anuncios/:slug/cancion/:n/audio', async (req, res) => {
    const { slug, n } = req.params;
    if (!slugDeLaApp(slug) || !/^\d{1,3}$/.test(String(n))) return res.status(404).json({ error: 'No encuentro esa versión.' });
    const { rutaDeVersion } = await cantados();
    const abs = rutaDeVersion(slug, Number(n));
    if (!abs) return res.status(404).json({ error: 'No encuentro esa versión.' });
    res.sendFile(abs, { dotfiles: 'deny', acceptRanges: true, maxAge: 0, headers: { 'Content-Type': 'audio/mpeg', 'X-Content-Type-Options': 'nosniff' } });
  });

  app.post('/api/anuncios/:slug/cancion', async (req, res) => {
    if (!desdeLaApp(req, res)) return;
    const { guardarEleccion, pedirOtraTanda } = await cantados();
    const { slug } = req.params;
    if (!slugDeLaApp(slug)) return res.status(404).json({ error: 'No encuentro ese anuncio.' });
    const c = leerConductor(slug);
    if (!c || !CANTADOS.has(c.familia)) return res.status(404).json({ error: 'Este anuncio no lleva canción.' });
    if (c.paso !== PASO_PAUSA) return res.status(409).json({ error: 'Ahora no hay una canción para elegir.' });
    if (c.estado !== 'pausado') return res.status(409).json({ error: 'Estoy preparando las versiones: espera a que terminen.' });
    const cuerpo = req.body && typeof req.body === 'object' ? req.body : {};
    const otra = cuerpo.otra === true;
    const r = otra ? pedirOtraTanda(slug) : guardarEleccion(slug, cuerpo.n);
    if (!r.ok) return res.status(r.status || 400).json({ error: r.error });
    // la pausa muestra el costo con los modelos de Ajustes y deja cambiarlos («Usar este»): el anuncio sigue con esos
    // (ya aprobado, es la unica otra vez que se le copian: lib/modelos.js, copiarModelosAlAnuncio)
    if (!otra) copiarModelosAlAnuncio(slug, { alAprobar: true });
    try {
      res.json({ ok: true, conductor: paraLaPantalla(continuar(slug)) });
    } catch (e) {
      // si la produccion no pudo seguir (otra ventana tiene el mando, otro modo), la eleccion no queda a medias
      const { deshacerEleccion } = await cantados();
      deshacerEleccion(slug, { otra });
      if (e?.status) return res.status(e.status).json({ error: e.message });
      throw e;
    }
  });
}

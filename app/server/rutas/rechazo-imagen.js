// IMAGEN RECHAZADA (producción, 2026-11-15): el modelo de imagen (kie) no quiso hacer una imagen por su contenido y el
// anuncio quedó frenado en «Crear las imágenes». Con el mismo texto vuelve a fallar: aquí se ve la descripción que
// rechazó, se cambia a mano o se le pide a la IA una versión que sí pase, y se sigue.
//
//   GET  /api/anuncios/:slug/rechazo-imagen          -> { pieza: { clave, que, linea, prompt, dijo } | null }
//   POST /api/anuncios/:slug/rechazo-imagen          { clave, prompt }  guarda la descripción nueva en el manifiesto
//        (después la pantalla toca «Continuar», que rehace solo esa imagen)
//   POST /api/anuncios/:slug/rechazo-imagen/sugerir  { clave, prompt? }  la IA elegida escribe otra descripción que
//        es la misma escena (no pierde la esencia) sin las palabras que frenan al filtro -> { prompt, motivo }   (no guarda nada: se revisa primero)
//
// (2026-11-21h) Antes de llegar aquí la app ya lo intenta sola (lib/rechazo-imagen.js rescatarRechazadas, hasta 4
// vueltas): esta pantalla queda para lo que ni así pasó.
// La pieza sale de lo que dijo produccion/generar-imagenes.js en temp/<slug>/app/registro/imagenes.log
// («<descripcion> fallo con los dos modelos»). clave: 'toma-3-inicial' | 'toma-3-final' | 'referencia-<id>'.
import { slugDeLaApp } from '../lib/conductor.js';
import { nombreIA } from '../lib/motor-ia.js';
import { guardar, piezaRechazada, sugerirDescripcion } from '../lib/rechazo-imagen.js';
import { desdeLaApp } from './editor.js';

const Mayus = (t) => String(t).charAt(0).toUpperCase() + String(t).slice(1);

const sugiriendo = new Set();

export default function rutasRechazoImagen(app) {
  app.get('/api/anuncios/:slug/rechazo-imagen', (req, res) => {
    const { slug } = req.params;
    if (!slugDeLaApp(slug)) return res.status(404).json({ error: 'No encuentro ese anuncio.' });
    res.set('Cache-Control', 'no-store').json({ pieza: piezaRechazada(slug) });
  });

  app.post('/api/anuncios/:slug/rechazo-imagen', (req, res) => {
    const { slug } = req.params;
    if (!desdeLaApp(req, res)) return;
    if (!slugDeLaApp(slug)) return res.status(404).json({ error: 'No encuentro ese anuncio.' });
    const pieza = piezaRechazada(slug);
    const texto = String(req.body?.prompt || '').trim();
    if (!pieza || pieza.clave !== req.body?.clave) return res.status(409).json({ error: 'Esa imagen ya no está frenada. Recarga la página.' });
    if (texto.length < 20) return res.status(400).json({ error: 'Escribe la descripción de la imagen (qué se ve).' });
    if (texto.length > 6000) return res.status(400).json({ error: 'La descripción es muy larga.' });
    if (texto === pieza.prompt.trim()) return res.status(400).json({ error: 'Es la misma descripción que rechazó el modelo: cámbiala o pide una sugerencia.' });
    try {
      if (!guardar(slug, pieza.clave, texto)) return res.status(409).json({ error: 'No encuentro esa imagen en el anuncio.' });
    } catch (e) {
      return res.status(500).json({ error: `No pude guardar la descripción: ${e.message}` });
    }
    res.json({ ok: true });
  });

  app.post('/api/anuncios/:slug/rechazo-imagen/sugerir', async (req, res) => {
    const { slug } = req.params;
    if (!desdeLaApp(req, res)) return;
    if (!slugDeLaApp(slug)) return res.status(404).json({ error: 'No encuentro ese anuncio.' });
    const pieza = piezaRechazada(slug);
    if (!pieza || pieza.clave !== req.body?.clave) return res.status(409).json({ error: 'Esa imagen ya no está frenada. Recarga la página.' });
    if (sugiriendo.has(slug)) return res.status(409).json({ error: 'Ya estoy escribiendo una sugerencia. Espera unos segundos.' });
    sugiriendo.add(slug);
    let r;
    try {
      // lo que hay ahora en el campo (si ya lo cambió y tampoco le gusta), para no repetirlo
      r = await sugerirDescripcion(slug, pieza, { otra: String(req.body?.prompt || '') });
    } finally {
      sugiriendo.delete(slug);
    }
    if (!r.ok) return res.status(502).json({ error: r.sinMotor ? 'Elige tu IA en Ajustes › Conexiones para pedir una sugerencia.' : `${Mayus(nombreIA(r.motor))} no pudo responder. Vuelve a intentarlo o cámbiala a mano.` });
    res.json({ prompt: r.prompt, motivo: r.motivo });
  });
}

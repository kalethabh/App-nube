// El botón "Actualizar" (lib/actualizar-github.js): baja lo último del repositorio de la app en GitHub.
//   GET  /api/github/actualizar[?ahora=1]   -> { repositorio, rama, publicada, atrasados, adelantados, ultimo } (solo pregunta)
//   POST /api/github/actualizar   -> { ok, cambios, reabrir, mensaje }
import { soloDesdeLaApp } from '../lib/productos.js';
import { PUERTO_DE_PRUEBA } from '../lib/rutas.js';
import { actualizar, revisarConMemoria } from '../lib/actualizar-github.js';

const deprueba = () => PUERTO_DE_PRUEBA || process.env.ANUNCIOS_MODO_PRUEBA === '1';

export default function rutasGithub(app) {
  app.get('/api/github/actualizar', async (req, res) => {
    // ?ahora=1 (al abrir «Actualizar») pregunta a GitHub sí o sí; si no, vale lo revisado hace menos de un minuto
    res.set('Cache-Control', 'no-store').json(await revisarConMemoria({ forzar: req.query?.ahora === '1' }));
  });
  app.post('/api/github/actualizar', soloDesdeLaApp, async (req, res) => {
    if (deprueba()) return res.json({ ok: false, mensaje: 'En modo prueba no se actualiza: abre la app normal para bajar lo último.' });
    res.json(await actualizar());
  });
}

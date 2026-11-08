// El botón "Actualizar" (lib/actualizar-github.js): baja lo último del repositorio de la app en GitHub.
//   GET  /api/github/actualizar   -> { repositorio, rama, atrasados, adelantados, ultimo } (solo pregunta)
//   POST /api/github/actualizar   -> { ok, cambios, reabrir, mensaje }
import { soloDesdeLaApp } from '../lib/productos.js';
import { PUERTO_DE_PRUEBA } from '../lib/rutas.js';
import { actualizar, revisar } from '../lib/actualizar-github.js';

const deprueba = () => PUERTO_DE_PRUEBA || process.env.ANUNCIOS_MODO_PRUEBA === '1';

export default function rutasGithub(app) {
  app.get('/api/github/actualizar', async (req, res) => {
    res.set('Cache-Control', 'no-store').json(await revisar());
  });
  app.post('/api/github/actualizar', soloDesdeLaApp, async (req, res) => {
    if (deprueba()) return res.json({ ok: false, mensaje: 'En modo prueba no se actualiza: abre la app normal para bajar lo último.' });
    res.json(await actualizar());
  });
}

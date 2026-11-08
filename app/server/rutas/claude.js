// Claude Code con la cuenta del usuario (ver lib/claude.js).
//
// GET  /api/claude/estado -> { instalado, version, sesion: "ok" | "sin-sesion" | "desconocido", cuenta?, actualizar?, motivo?, trabajando }
// POST /api/claude/login  -> abre `claude auth login` en una ventana (el login lo hace Claude Code: la app no toca tokens)
import { estadoClaude, abrirLogin, sesionesEnCurso } from '../lib/claude.js';
import { soloDesdeLaApp } from '../lib/productos.js';

export default function rutasClaude(app) {
  app.get('/api/claude/estado', async (req, res) => {
    res.json({ ...(await estadoClaude()), trabajando: sesionesEnCurso() });
  });

  app.post('/api/claude/login', soloDesdeLaApp, (req, res) => {
    const ok = abrirLogin();
    if (!ok) return res.status(503).json({ error: 'No pude abrir la ventana para iniciar sesión. Abre una terminal y escribe: claude auth login' });
    res.json({ ok: true, mensaje: 'Se abrió una ventana: inicia sesión con tu cuenta de Claude y vuelve aquí.' });
  });
}

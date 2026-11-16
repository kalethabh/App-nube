// Quien hace las imagenes de los anuncios de imagen (lib/motor-imagenes.js): tu ChatGPT o kie.ai.
//
//   GET /api/imagenes/motor  -> { motor: 'chatgpt'|'kie', opciones, chatgpt: { instalado, version, sesion, plan,
//                                 limites: { usado5h, renueva5h, usadoSemana, renuevaSemana } | null }, login, instalando }
//   PUT /api/imagenes/motor { motor } -> { motor }   (anuncios de imagen)
//   PUT /api/imagenes/motor { motorVideo } -> { motorVideo }   (las imágenes de los videos; con respaldo en kie)
//
// Para instalar Codex o iniciar sesion en ChatGPT se usan las de siempre (/api/ia/instalar y /api/ia/login con
// motor 'codex'): no cambian la IA que escribe.
import express from 'express';
import { estadoIA } from '../lib/motor-ia.js';
import { motorDeImagenes, elegirMotorDeImagenes, motorImagenesVideo, elegirMotorImagenesVideo, MOTORES_IMAGEN } from '../lib/motor-imagenes.js';
import { soloDesdeLaApp, ErrorApp } from '../lib/productos.js';

const json = express.json({ limit: '10kb' });

const porcentaje = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(100, Math.round(Number(v)))) : null);
const fecha = (s) => (Number.isFinite(Number(s)) && Number(s) > 0 ? new Date(Number(s) * 1000).toISOString() : null);

function limitesDe(l) {
  if (!l || typeof l !== 'object') return null;
  return {
    usado5h: porcentaje(l.primary?.usedPercent),
    renueva5h: fecha(l.primary?.resetsAt),
    usadoSemana: porcentaje(l.secondary?.usedPercent),
    renuevaSemana: fecha(l.secondary?.resetsAt),
  };
}

export default function rutasMotorImagenes(app) {
  app.get('/api/imagenes/motor', async (req, res) => {
    let e = null;
    try {
      e = await estadoIA({ todos: true });
    } catch {
      /* sin estado: la pantalla dice que no pudo revisar */
    }
    const c = e?.motores?.codex || null;
    const instalando = e?.instalando?.motor === 'codex' ? e.instalando : null;
    res.set('Cache-Control', 'no-store').json({
      motor: motorDeImagenes(),
      // las imágenes de los VIDEOS (aparte): 'kie' por defecto, 'chatgpt' con respaldo en kie
      motorVideo: motorImagenesVideo(),
      opciones: Object.values(MOTORES_IMAGEN),
      chatgpt: c
        ? {
            instalado: Boolean(c.instalado),
            actualizar: Boolean(c.actualizar),
            version: c.version || null,
            sesion: ['ok', 'sin-sesion'].includes(c.sesion) ? c.sesion : 'desconocido',
            plan: c.cuenta && typeof c.cuenta === 'object' ? c.cuenta.plan || null : null,
            limites: limitesDe(c.limites),
          }
        : null,
      login: e?.login && typeof e.login === 'object' ? e.login : null,
      instalando,
    });
  });

  app.put('/api/imagenes/motor', soloDesdeLaApp, json, (req, res) => {
    try {
      // { motor } = anuncios de imagen; { motorVideo } = las imágenes de los videos
      if (req.body?.motorVideo !== undefined) return res.json({ motorVideo: elegirMotorImagenesVideo(String(req.body.motorVideo || '')) });
      res.json({ motor: elegirMotorDeImagenes(String(req.body?.motor || '')) });
    } catch (err) {
      const status = err instanceof ErrorApp || Number.isInteger(err?.status) ? err.status : 500;
      res.status(status).json({ error: status < 500 ? err.message : 'No pude guardar tu elección.' });
    }
  });
}

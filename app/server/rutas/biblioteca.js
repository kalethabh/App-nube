// La biblioteca (lib/biblioteca.js): avatares y audios para reutilizar, sincronizada con GitHub.
//
//   GET    /api/biblioteca[?estilo=<clave>]          -> { estado, avatares, audios, roles }
//   POST   /api/biblioteca/sincronizar               -> sincroniza ya y devuelve el estado
//   POST   /api/biblioteca/subir                     (cuerpo crudo: una imagen o un audio; X-Nombre) -> { ref }
//   GET    /api/biblioteca/referencias/:estilo       -> { personajes } de los anuncios de referencia (subestilos)
//   GET    /api/biblioteca/personajes/:slug          -> { personajes } de un anuncio (para guardarlos como avatar)
//   POST   /api/biblioteca/avatares                  { estilo, nombre, personas: [{ rol, nombre?, imagen, descripcion? }] }
//   PATCH  /api/biblioteca/avatares/:estilo/:id      { nombre?, descripciones? }
//   DELETE /api/biblioteca/avatares/:estilo/:id
//   POST   /api/biblioteca/audios                    { estilo, nombre, ruta, tipo?, notas? }
//   DELETE /api/biblioteca/audios/:estilo/:id
//   GET    /archivos/biblioteca/<ruta>               un archivo de mis_archivos/biblioteca/ (solo medios)
//   GET    /archivos/miniatura/biblioteca/<ruta>     su miniatura
//   GET    /archivos/referencia/<ruta>               un retrato de un subestilo (.claude/skills/<skill>/subestilos/<id>/avatar/…)
//   GET    /archivos/miniatura/referencia/<ruta>     su miniatura
import path from 'node:path';
import express from 'express';
import { RAIZ, SKILLS } from '../lib/rutas.js';
import { soloDesdeLaApp } from '../lib/productos.js';
import { dentroDe, stat, esImagen, TIPOS_MEDIO } from '../lib/archivos.js';
import { slugValido } from '../lib/anuncios.js';
import { miniatura, anchoPermitido } from '../lib/miniaturas.js';
import {
  DIR_BIBLIOTECA,
  ROLES_AVATAR,
  avataresDeReferencia,
  borrarAudio,
  borrarAvatar,
  carpetaDeEstilo,
  crearAvatar,
  editarAvatar,
  estadoBiblioteca,
  guardarAudio,
  guardarSubida,
  iniciarBiblioteca,
  listarAudios,
  listarAvatares,
  personajesDelAnuncio,
  sincronizar,
} from '../lib/biblioteca.js';

const crudo = express.raw({ type: () => true, limit: '60mb' });
const BASE_BIBLIOTECA = 'mis_archivos/biblioteca/';
const BASE_SKILLS = '.claude/skills/';

/** La URL de un archivo de la biblioteca o de un retrato de subestilo (por su ruta dentro de la carpeta del sistema). */
export function urlDeArchivo(rutaRel) {
  const r = String(rutaRel || '');
  const codificar = (x) => x.split('/').map(encodeURIComponent).join('/');
  if (r.startsWith(BASE_BIBLIOTECA)) return `/archivos/biblioteca/${codificar(r.slice(BASE_BIBLIOTECA.length))}`;
  if (r.startsWith(BASE_SKILLS)) return `/archivos/referencia/${codificar(r.slice(BASE_SKILLS.length))}`;
  if (r.startsWith('temp/')) {
    const [, slug, ...resto] = r.split('/');
    return `/archivos/anuncio/${encodeURIComponent(slug)}/${codificar(resto.join('/'))}`;
  }
  return null;
}

const conUrls = {
  avatar: (a) => ({ ...a, personas: a.personas.map((p) => ({ ...p, url: urlDeArchivo(p.imagen) })) }),
  audio: (a) => ({ ...a, url: urlDeArchivo(a.ruta) }),
};

function partes(req) {
  return Array.isArray(req.params.ruta) ? req.params.ruta : String(req.params.ruta || '').split('/');
}
/** Un retrato de subestilo: solo lo que está en .claude/skills/<skill>/subestilos/<id>/avatar/ (y su limpio/). */
function absReferencia(p) {
  if (p.length < 5 || p[1] !== 'subestilos' || p[3] !== 'avatar') return null;
  const abs = dentroDe(SKILLS, p);
  return abs && esImagen(abs) ? abs : null;
}

function enviar(res, abs) {
  const tipo = abs && TIPOS_MEDIO[path.extname(abs).toLowerCase()];
  if (!tipo || !stat(abs)?.isFile()) return res.status(404).json({ error: 'No encuentro ese archivo.' });
  // la ruta la arma el servidor (dentroDe): 'allow' porque los retratos viven bajo .claude/
  res.sendFile(abs, { dotfiles: 'allow', acceptRanges: true, cacheControl: true, maxAge: 0, headers: { 'Content-Type': tipo, 'X-Content-Type-Options': 'nosniff' } });
}
async function enviarMiniatura(req, res, abs, original) {
  if (!abs || !stat(abs)?.isFile() || !esImagen(abs)) return res.status(404).json({ error: 'No encuentro ese archivo.' });
  try {
    const archivo = await miniatura(abs, anchoPermitido(req.query.ancho || 480), { segundo: 0 });
    res.sendFile(archivo, { dotfiles: 'allow', cacheControl: true, maxAge: 0, headers: { 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    res.redirect(302, original);
  }
}

const fallar = (res, e) => res.status(e?.status || 500).json({ error: e?.status ? e.message : 'No pude guardar eso en la biblioteca.' });

export default function rutasBiblioteca(app) {
  iniciarBiblioteca();

  app.get('/api/biblioteca', (req, res) => {
    const estilo = req.query.estilo ? String(req.query.estilo) : null;
    res.set('Cache-Control', 'no-store').json({
      estado: estadoBiblioteca(),
      avatares: listarAvatares(estilo || undefined).map(conUrls.avatar),
      audios: listarAudios(estilo || undefined).map(conUrls.audio),
      roles: estilo ? ROLES_AVATAR[carpetaDeEstilo(estilo)] || null : ROLES_AVATAR,
    });
  });

  app.post('/api/biblioteca/sincronizar', soloDesdeLaApp, async (req, res) => res.json({ estado: await sincronizar() }));

  app.post('/api/biblioteca/subir', soloDesdeLaApp, (req, res) =>
    crudo(req, res, (err) => {
      if (err) return res.status(err.status === 413 ? 413 : 400).json({ error: err.status === 413 ? 'Ese archivo pesa demasiado (más de 60 MB).' : 'No pude leer ese archivo.' });
      try {
        const tipo = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        const nombre = String(req.headers['x-nombre'] || '').slice(0, 120);
        const ref = guardarSubida(req.body, tipo, nombre);
        res.status(201).json({ ref, url: `/archivos/subida/${encodeURIComponent(ref.slice(7))}` });
      } catch (e) {
        fallar(res, e);
      }
    })
  );

  app.get('/api/biblioteca/referencias/:estilo', (req, res) => {
    res.json({ personajes: avataresDeReferencia(String(req.params.estilo)).map((p) => ({ ...p, url: urlDeArchivo(p.imagen) })) });
  });

  app.get('/api/biblioteca/personajes/:slug', (req, res) => {
    if (!slugValido(req.params.slug)) return res.status(404).json({ error: 'No encuentro ese anuncio.' });
    res.set('Cache-Control', 'no-store').json({ personajes: personajesDelAnuncio(req.params.slug).map((p) => ({ ...p, url: urlDeArchivo(p.imagen) })) });
  });

  app.post('/api/biblioteca/avatares', soloDesdeLaApp, express.json({ limit: '1mb' }), (req, res) => {
    try {
      const { estilo, nombre, personas } = req.body || {};
      res.status(201).json({ avatar: conUrls.avatar(crearAvatar(String(estilo || ''), nombre, personas)) });
    } catch (e) {
      fallar(res, e);
    }
  });
  app.patch('/api/biblioteca/avatares/:estilo/:id', soloDesdeLaApp, express.json({ limit: '1mb' }), (req, res) => {
    try {
      res.json({ avatar: conUrls.avatar(editarAvatar(req.params.estilo, req.params.id, req.body || {})) });
    } catch (e) {
      fallar(res, e);
    }
  });
  app.delete('/api/biblioteca/avatares/:estilo/:id', soloDesdeLaApp, (req, res) => {
    try {
      borrarAvatar(req.params.estilo, req.params.id);
      res.json({ ok: true });
    } catch (e) {
      fallar(res, e);
    }
  });

  app.post('/api/biblioteca/audios', soloDesdeLaApp, express.json({ limit: '1mb' }), (req, res) => {
    try {
      res.status(201).json({ audio: conUrls.audio(guardarAudio(req.body || {})) });
    } catch (e) {
      fallar(res, e);
    }
  });
  app.delete('/api/biblioteca/audios/:estilo/:id', soloDesdeLaApp, (req, res) => {
    try {
      borrarAudio(req.params.estilo, req.params.id);
      res.json({ ok: true });
    } catch (e) {
      fallar(res, e);
    }
  });

  // ---- los archivos
  app.get('/archivos/biblioteca/*ruta', (req, res) => enviar(res, dentroDe(DIR_BIBLIOTECA, partes(req))));
  app.get('/archivos/miniatura/biblioteca/*ruta', (req, res) => {
    const p = partes(req);
    enviarMiniatura(req, res, dentroDe(DIR_BIBLIOTECA, p), `/archivos/biblioteca/${p.map(encodeURIComponent).join('/')}`);
  });
  app.get('/archivos/referencia/*ruta', (req, res) => enviar(res, absReferencia(partes(req))));
  app.get('/archivos/miniatura/referencia/*ruta', (req, res) => {
    const p = partes(req);
    enviarMiniatura(req, res, absReferencia(p), `/archivos/referencia/${p.map(encodeURIComponent).join('/')}`);
  });
  app.get('/archivos/subida/:archivo', (req, res) => {
    const n = String(req.params.archivo || '');
    if (!/^[a-z0-9]{6,30}\.(png|jpe?g|webp|mp3|wav|m4a|ogg)$/.test(n)) return res.status(404).json({ error: 'No encuentro ese archivo.' });
    enviar(res, path.join(RAIZ, 'temp', '_biblioteca-subidas', n));
  });
}

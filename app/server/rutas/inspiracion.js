// INSPIRACIÓN (lib/inspiracion.js, sobre lib/ganadores.js). La búsqueda, los guardados y el video siguen en
// /api/ganadores/*; aquí va lo nuevo:
//
//   GET    /api/inspiracion                    -> { formatos, sonidos, marcas, clasificacion }
//   POST   /api/inspiracion/costo              { filtros } -> { enCache, creditos }   (lo que costaría buscar eso)
//   POST   /api/inspiracion/clasificar         { anuncios, iniciar? } -> { clasif: { id: {...} }, estado }
//                                              (iniciar: suma a la IA los que falta mirar; sin gastar TrendTrack)
//   POST   /api/inspiracion/marcas             { marca } -> { marca }        seguir
//   DELETE /api/inspiracion/marcas/:id                                       dejar de seguir
//   POST   /api/inspiracion/marcas/buscar      { texto } | { brandtracker: true } -> { marcas, desdeCache, gastados, creditos }
//   POST   /api/inspiracion/replicar-imagen    { anuncio } -> { archivo, url, nombre }
//   GET    /api/inspiracion/imagenes/:archivo  la imagen bajada para replicar
//
// Las otras fuentes del feed (2026-11-17n):
//   POST   /api/inspiracion/meta/buscar        { filtros, despues?, forzar? } -> { anuncios, siguiente, quitados, ... }
//                                              la Biblioteca de anuncios oficial (lib/meta-biblioteca.js; solo UE + GB)
//   GET    /api/inspiracion/meta/media/:id     -> { tipo, media, miniatura } | { error } (sacado del snapshot)
//   GET    /api/inspiracion/chrome             -> { anuncios, quitados }   lo guardado con el botón de Chrome
//   DELETE /api/inspiracion/chrome/:id
//   GET    /api/inspiracion/chrome/media/:archivo
//   GET    /api/inspiracion/chrome/codigo      -> { codigo }   POST: un código nuevo
//   GET    /api/inspiracion/chrome/extension.zip   la extensión para cargarla en Chrome
//   POST   /api/inspiracion/importar           (SOLO la extensión, con X-Kads-Codigo: lib/desde-chrome.js porteroImportar)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { RAIZ } from '../lib/rutas.js';
import { escribirZip } from '../../herramientas/zip.mjs';
import { PAISES_META, VERSION_GRAPH, buscarEnMeta, hayToken, medioDeMeta } from '../lib/meta-biblioteca.js';
import { borrarDesdeChrome, cambiarCodigo, codigoEmparejamiento, importarAnuncio, listarDesdeChrome } from '../lib/desde-chrome.js';
import { rutaMedioChrome } from '../lib/ganadores.js';
import { soloDesdeLaApp } from '../lib/productos.js';
import { CREDITOS_POR_ANUNCIO, busquedaEnCache, filtrosLimpios, normalizarDeVuelta } from '../lib/ganadores.js';
import {
  FORMATOS,
  SONIDOS,
  bajarImagenParaReplicar,
  buscarMarcas,
  clasificacionDe,
  clasificarConIA,
  dejarDeSeguir,
  estadoClasificacion,
  listarMarcas,
  listarMisMarcas,
  agregarMiMarca,
  quitarMiMarca,
  rutaImagen,
  seguirMarca,
  actualizarMarcasDesde,
  paraInspiracion,
} from '../lib/inspiracion.js';

const json = express.json({ limit: '2mb' });

const responderError = (res, e, porDefecto) => {
  const status = Number.isInteger(e?.status) ? e.status : 500;
  if (status >= 500 && !e?.status) console.error('[inspiracion]', e);
  res.status(status).json({ error: e?.status ? e.message : porDefecto });
};

export default function rutasInspiracion(app) {
  app.get('/api/inspiracion', (req, res) => {
    res.set('Cache-Control', 'no-store').json({
      formatos: FORMATOS,
      sonidos: SONIDOS,
      marcas: listarMarcas(),
      misMarcas: listarMisMarcas(),
      clasificacion: estadoClasificacion(),
      meta: { conToken: hayToken(), paises: PAISES_META, version: VERSION_GRAPH },
      chrome: { cantidad: listarDesdeChrome().length },
    });
  });

  // tus marcas: nunca salen en Inspiración (lib/inspiracion.js, mis_archivos/ganadores/mis-marcas.json)
  app.post('/api/inspiracion/mis-marcas', soloDesdeLaApp, json, (req, res) => {
    try {
      res.status(201).json({ misMarcas: agregarMiMarca(req.body?.nombre) });
    } catch (e) {
      responderError(res, e, 'No pude guardar tu marca.');
    }
  });
  app.delete('/api/inspiracion/mis-marcas/:nombre', soloDesdeLaApp, (req, res) => {
    res.json({ misMarcas: quitarMiMarca(req.params.nombre) });
  });

  app.post('/api/inspiracion/costo', soloDesdeLaApp, json, (req, res) => {
    const f = filtrosLimpios(req.body?.filtros || {});
    res.json({ enCache: busquedaEnCache(f), creditos: Math.ceil(f.cantidad * CREDITOS_POR_ANUNCIO) });
  });

  app.post('/api/inspiracion/clasificar', soloDesdeLaApp, json, (req, res) => {
    const anuncios = (Array.isArray(req.body?.anuncios) ? req.body.anuncios : []).slice(0, 200).map(normalizarDeVuelta).filter(Boolean);
    const estado = req.body?.iniciar === true ? clasificarConIA(anuncios) : estadoClasificacion();
    res.json({ clasif: Object.fromEntries(anuncios.map((a) => [a.id, clasificacionDe(a)])), estado });
  });

  app.post('/api/inspiracion/marcas', soloDesdeLaApp, json, (req, res) => {
    try {
      res.status(201).json({ marca: seguirMarca(req.body?.marca) });
    } catch (e) {
      responderError(res, e, 'No pude seguir esa marca.');
    }
  });

  app.delete('/api/inspiracion/marcas/:id', soloDesdeLaApp, (req, res) => {
    dejarDeSeguir(String(req.params.id || ''));
    res.json({ ok: true });
  });

  app.post('/api/inspiracion/marcas/buscar', soloDesdeLaApp, json, async (req, res) => {
    try {
      res.json(await buscarMarcas(req.body?.texto, { brandtracker: req.body?.brandtracker === true }));
    } catch (e) {
      responderError(res, e, 'No pude buscar marcas. Vuelve a intentar.');
    }
  });

  app.post('/api/inspiracion/replicar-imagen', soloDesdeLaApp, json, async (req, res) => {
    try {
      res.status(201).json(await bajarImagenParaReplicar(normalizarDeVuelta(req.body?.anuncio)));
    } catch (e) {
      responderError(res, e, 'No pude preparar esa imagen.');
    }
  });

  app.get('/api/inspiracion/imagenes/:archivo', (req, res) => {
    const ruta = rutaImagen(req.params.archivo);
    if (!ruta) return res.status(404).end();
    res.set('Cache-Control', 'private, max-age=86400').sendFile(ruta, (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  });

  // ---------------------------------------------------------------- Meta (oficial)
  app.post('/api/inspiracion/meta/buscar', soloDesdeLaApp, json, async (req, res) => {
    try {
      const r = await buscarEnMeta(req.body?.filtros || {}, { despues: req.body?.despues || null, forzar: req.body?.forzar === true });
      actualizarMarcasDesde(r.anuncios);
      const { anuncios, quitados } = paraInspiracion(r.anuncios || [], { soloValidados: r.filtros?.soloValidados !== false });
      res.json({ ...r, anuncios, quitados, recibidos: (r.anuncios || []).length });
    } catch (e) {
      responderError(res, e, 'No pude buscar en la Biblioteca de anuncios de Meta. Vuelve a intentar.');
    }
  });

  app.get('/api/inspiracion/meta/media/:id', soloDesdeLaApp, async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store').json(await medioDeMeta(req.params.id));
    } catch (e) {
      responderError(res, e, 'No pude traer el video de Meta.');
    }
  });

  // ---------------------------------------------------------------- Desde Chrome
  app.get('/api/inspiracion/chrome', (req, res) => {
    // lo que guardaste a propósito no se esconde por no estar validado (se ve la insignia); tus marcas sí se quitan
    const { anuncios, quitados } = paraInspiracion(listarDesdeChrome(), { soloValidados: false });
    res.set('Cache-Control', 'no-store').json({ anuncios, quitados });
  });

  app.delete('/api/inspiracion/chrome/:id', soloDesdeLaApp, (req, res) => {
    if (!borrarDesdeChrome(String(req.params.id || ''))) return res.status(404).json({ error: 'Ese anuncio ya no está.' });
    res.json({ ok: true });
  });

  app.get('/api/inspiracion/chrome/media/:archivo', (req, res) => {
    const ruta = rutaMedioChrome(req.params.archivo);
    if (!ruta) return res.status(404).end();
    // (el nombre ya está validado: dotfiles 'allow' solo para que ande aunque la app viva dentro de una carpeta oculta)
    res.set('Cache-Control', 'private, max-age=86400').set('X-Content-Type-Options', 'nosniff').sendFile(ruta, { dotfiles: 'allow' }, (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  });

  app.get('/api/inspiracion/chrome/codigo', soloDesdeLaApp, (req, res) => {
    res.set('Cache-Control', 'no-store').json({ codigo: codigoEmparejamiento() });
  });
  app.post('/api/inspiracion/chrome/codigo', soloDesdeLaApp, (req, res) => {
    res.json({ codigo: cambiarCodigo() });
  });

  // la extensión en un zip, armado al momento desde extension-chrome/ (con el escritor de zip del paquete)
  app.get('/api/inspiracion/chrome/extension.zip', (req, res) => {
    const carpeta = path.join(RAIZ, 'extension-chrome');
    let archivos = [];
    try {
      archivos = fs.readdirSync(carpeta, { withFileTypes: true, recursive: true }).filter((e) => e.isFile() && !e.name.startsWith('.'));
    } catch {
      return res.status(404).json({ error: 'No encuentro la carpeta de la extensión en esta app.' });
    }
    const entradas = archivos.map((e) => {
      const abs = path.join(e.parentPath || e.path, e.name);
      return { nombre: `kads-guardar-en-chrome/${path.relative(carpeta, abs).split(path.sep).join('/')}`, origen: abs };
    });
    const tmp = path.join(os.tmpdir(), `kads-extension-${process.pid}-${Date.now()}.zip`);
    try {
      escribirZip(tmp, entradas);
    } catch {
      fs.rmSync(tmp, { force: true });
      return res.status(500).json({ error: 'No pude armar el zip de la extensión.' });
    }
    res.download(tmp, 'kads-guardar-en-chrome.zip', () => fs.rmSync(tmp, { force: true }));
  });

  // lo que manda el botón de Chrome (ya pasó por porteroImportar: código, origen, tamaño y pedidos por minuto)
  app.post('/api/inspiracion/importar', async (req, res) => {
    if (req.desdeExtension !== true) return res.status(403).json({ error: 'Solo desde el botón de Chrome de Kads.' });
    if (req.body?.probar === true) return res.json({ ok: true, mensaje: 'Conectado con Kads Studio.' });
    try {
      const r = await importarAnuncio(req.body?.anuncio);
      const mio = paraInspiracion([r.anuncio], { soloValidados: false }).quitados.tuyos > 0;
      res.status(201).json({ ok: true, id: r.anuncio.id, tipo: r.anuncio.tipo, avisos: mio ? [...r.avisos, 'Es de una de tus marcas: lo guardé, pero no sale en Inspiración.'] : r.avisos });
    } catch (e) {
      responderError(res, e, 'No pude guardar ese anuncio.');
    }
  });
}

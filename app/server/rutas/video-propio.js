// EDITAR UN VIDEO TUYO (2026-11-14): cualquier video entra al editor como si fuera un anuncio. Gratis (ffmpeg en esta
// PC); solo los subtítulos, si se piden, transcriben el audio con ElevenLabs (centavos).
//
//   POST /api/videos-propios?nombre=<archivo>&subtitulos=1    el video en el cuerpo (hasta 1 GB, solo desde la app)
//        -> { slug }   y se prepara solo (produccion/video-propio.js por la fila pesada)
//   POST /api/videos-propios/desde-salida  { archivo, subtitulos }   un MP4 que ya está en output/ (p. ej. el de
//        «Cambiar el producto»: <slug>_cambiado.mp4) -> { slug }
//   GET  /api/videos-propios/:slug  -> { slug, etapa: 'preparando'|'listo'|'error', texto, valor, error, aviso }
//   POST /api/videos-propios/:slug/quitar    { desde, hasta, edicion }  quita esos segundos (imagen y audio): el video
//        queda más corto (produccion/video-propio.js quitarTramo). Guarda antes el plan y los cambios del editor en
//        app/video-propio/cortes/<n>.json para deshacer. -> { mapa, desde, hasta, duracion, puedeDeshacer }
//   POST /api/videos-propios/:slug/deshacer  vuelve a poner lo último que se quitó -> { edicion, puedeDeshacer }
//   GET  /api/videos-propios/:slug/cortes    -> { puedeDeshacer }
//
// La carpeta queda en temp/<slug>/ (video-<nombre>-<fecha>) con el estado en app/video-propio.json. Mientras se
// prepara no tiene manifiesto.json, así que no aparece en Anuncios; al terminar es un anuncio más (estilo
// "video-propio") y se abre en #/anuncio/<slug>/editor.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { TEMP, OUTPUT, RAIZ } from '../lib/rutas.js';
import { leerJSON, existe, segmentoValido } from '../lib/archivos.js';
import { entornoDelMotor } from '../lib/procesos.js';
import * as colas from '../lib/colas.js';
import { desdeLaApp, anuncioConPlan } from './editor.js';
import { quitarTramo } from '../../../produccion/video-propio.js';

const MAX_VIDEO = 1024 * 1024 * 1024;
const EXT_VIDEO = /\.(mp4|m4v|mov|webm|mkv|avi|3gp|mpe?g)$/i;
const MOTOR = path.join(RAIZ, 'produccion', 'video-propio.js');
const SLUG = /^video-[a-z0-9-]{1,80}$/;
const enMarcha = new Set();
const MAX_DESHACER = 30;

const dirCortes = (slug) => path.join(dirDe(slug), 'app', 'video-propio', 'cortes');
function cortesGuardados(slug) {
  try {
    return fs
      .readdirSync(dirCortes(slug))
      .map((n) => Number(/^(\d+)\.json$/.exec(n)?.[1]))
      .filter((n) => Number.isInteger(n))
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}
const esVideoPropio = (slug) => SLUG.test(slug) && anuncioConPlan(slug) && leerJSON(path.join(dirDe(slug), 'plan-montaje.json'))?.videoPropio === true;

const dirDe = (slug) => path.join(TEMP, slug);
const archivoEstado = (slug) => path.join(dirDe(slug), 'app', 'video-propio.json');
const leerEstado = (slug) => leerJSON(archivoEstado(slug));
function guardarEstado(slug, cambios) {
  const e = { ...(leerEstado(slug) || {}), ...cambios, actualizado: new Date().toISOString() };
  fs.mkdirSync(path.dirname(archivoEstado(slug)), { recursive: true });
  fs.writeFileSync(archivoEstado(slug), JSON.stringify(e, null, 2) + '\n', 'utf8');
  return e;
}

/** video-<nombre del archivo>-<fecha>: sin «prueba» (esas carpetas la app no las muestra). */
function slugNuevo(nombre) {
  const base =
    String(nombre || 'video')
      .replace(/\.[^.]+$/, '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/prueba/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'tuyo';
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const fecha = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  let slug = `video-${base}-${fecha}`;
  for (let i = 2; existe(dirDe(slug)); i++) slug = `video-${base}-${fecha}-${i}`;
  return slug;
}

/** Guarda el cuerpo del pedido en el disco mientras llega, con tope. { ok, bytes } | { ok: false, demasiado | cortado } */
function recibir(req, destino, max) {
  return new Promise((resolve) => {
    let bytes = 0;
    let listo = false;
    const terminar = (r) => {
      if (listo) return;
      listo = true;
      resolve(r);
    };
    const out = fs.createWriteStream(destino);
    req.on('data', (d) => {
      bytes += d.length;
      if (bytes > max) {
        req.unpipe(out);
        out.destroy();
        req.resume();
        terminar({ ok: false, demasiado: true });
      }
    });
    req.on('aborted', () => {
      out.destroy();
      terminar({ ok: false, cortado: true });
    });
    out.on('finish', () => terminar({ ok: true, bytes }));
    out.on('error', () => terminar({ ok: false, cortado: true }));
    req.pipe(out);
  });
}

const enPalabras = (m) => {
  const t = String(m || '');
  if (/no es un video|no se pueda abrir/i.test(t)) return 'No pude abrir ese video. Prueba exportarlo como MP4.';
  if (/ffmpeg|preparar el video|cortar la escena/i.test(t)) return 'No pude preparar ese video. Prueba exportarlo como MP4 y vuelve a subirlo.';
  return t.slice(0, 300) || 'No pude preparar tu video.';
};

/** Prepara el video (en segundo plano, por la fila pesada). */
function preparar(slug, { subtitulos }) {
  if (enMarcha.has(slug)) return;
  enMarcha.add(slug);
  (async () => {
    let soltar = null;
    try {
      guardarEstado(slug, { etapa: 'preparando', texto: 'Esperando turno', valor: 0 });
      soltar = await colas.entrar(slug, { pesada: true }, { alEsperar: () => guardarEstado(slug, { texto: 'Esperando a que termine otro video' }) });
      const env = await entornoDelMotor().catch(() => process.env);
      const args = [MOTOR, path.join('temp', slug), ...(subtitulos ? ['--subtitulos'] : [])];
      const r = await new Promise((resolve) => {
        const p = spawn(process.execPath, args, { cwd: RAIZ, env, windowsHide: true });
        let resto = '';
        let error = null;
        let listo = null;
        let errTexto = '';
        p.stdout.on('data', (d) => {
          resto += String(d);
          const lineas = resto.split(/\r?\n/);
          resto = lineas.pop();
          for (const l of lineas) {
            const m = /^@@(avance|listo|error) (.*)$/.exec(l.trim());
            if (!m) continue;
            let datos = {};
            try {
              datos = JSON.parse(m[2]);
            } catch {
              continue;
            }
            if (m[1] === 'avance') guardarEstado(slug, { texto: datos.texto || null, valor: Number(datos.valor) || 0 });
            if (m[1] === 'listo') listo = datos;
            if (m[1] === 'error') error = datos.error;
          }
        });
        p.stderr.on('data', (d) => {
          errTexto = (errTexto + String(d)).slice(-2000);
        });
        p.on('error', (e) => resolve({ codigo: 1, error: e.message }));
        p.on('close', (codigo) => resolve({ codigo, listo, error: error || (codigo ? errTexto.trim().split(/\r?\n/).pop() : null) }));
      });
      if (r.codigo !== 0 || !r.listo) throw new Error(r.error || 'No pude preparar tu video.');
      guardarEstado(slug, { etapa: 'listo', texto: null, valor: 100, aviso: r.listo.aviso || null, escenas: r.listo.escenas, subtitulos: r.listo.subtitulos });
    } catch (e) {
      console.error(`[video-propio] ${slug}: ${e?.message || e}`);
      guardarEstado(slug, { etapa: 'error', error: enPalabras(e?.message) });
    } finally {
      soltar?.();
      enMarcha.delete(slug);
    }
  })();
}

export default function rutasVideoPropio(app) {
  app.post('/api/videos-propios', async (req, res) => {
    if (!desdeLaApp(req, res)) return;
    const nombre = path.basename(String(req.query.nombre || 'video')).slice(0, 160) || 'video';
    const tipo = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!tipo.startsWith('video/') && !EXT_VIDEO.test(nombre)) return res.status(400).json({ error: 'Ese archivo no es un video. Usa un MP4, MOV o WEBM.' });
    if (Number(req.headers['content-length']) > MAX_VIDEO) return res.status(413).json({ error: 'Ese video pesa más de 1 GB. Expórtalo más liviano y vuelve a subirlo.' });
    const slug = slugNuevo(nombre);
    const ext = (EXT_VIDEO.exec(nombre)?.[1] || 'mp4').toLowerCase();
    fs.mkdirSync(path.join(dirDe(slug), 'app'), { recursive: true });
    const destino = path.join(dirDe(slug), `original.${ext}`);
    const r = await recibir(req, destino, MAX_VIDEO);
    if (!r.ok || !r.bytes) {
      fs.rmSync(dirDe(slug), { recursive: true, force: true });
      return res.status(r.demasiado ? 413 : 400).json({ error: r.demasiado ? 'Ese video pesa más de 1 GB. Expórtalo más liviano y vuelve a subirlo.' : 'El video no llegó entero. Vuelve a subirlo.' });
    }
    guardarEstado(slug, { slug, nombre, creado: new Date().toISOString(), etapa: 'preparando', texto: 'Recibido', valor: 0, subtitulosPedidos: req.query.subtitulos === '1' });
    preparar(slug, { subtitulos: req.query.subtitulos === '1' });
    res.json({ slug });
  });

  app.post('/api/videos-propios/desde-salida', (req, res) => {
    if (!desdeLaApp(req, res)) return;
    const archivo = String(req.body?.archivo || '');
    if (!segmentoValido(archivo) || !/\.mp4$/i.test(archivo) || !existe(path.join(OUTPUT, archivo))) return res.status(404).json({ error: 'No encuentro ese video.' });
    const nombre = archivo.replace(/_(cambiado|sin-subtitulos)\.mp4$/i, '.mp4');
    const slug = slugNuevo(nombre);
    fs.mkdirSync(path.join(dirDe(slug), 'app'), { recursive: true });
    fs.copyFileSync(path.join(OUTPUT, archivo), path.join(dirDe(slug), 'original.mp4'));
    const subtitulos = req.body?.subtitulos === true;
    guardarEstado(slug, { slug, nombre: archivo, creado: new Date().toISOString(), etapa: 'preparando', texto: 'Recibido', valor: 0, subtitulosPedidos: subtitulos });
    preparar(slug, { subtitulos });
    res.json({ slug });
  });

  app.get('/api/videos-propios/:slug', (req, res) => {
    const { slug } = req.params;
    if (!SLUG.test(slug) || !segmentoValido(slug)) return res.status(404).json({ error: 'No encuentro ese video.' });
    const e = leerEstado(slug);
    if (!e) return res.status(404).json({ error: 'No encuentro ese video.' });
    // la app se cerró a mitad: se vuelve a preparar
    if (e.etapa === 'preparando' && !enMarcha.has(slug)) preparar(slug, { subtitulos: Boolean(e.subtitulosPedidos) });
    res.set('Cache-Control', 'no-store').json({ slug, etapa: e.etapa, texto: e.texto || null, valor: e.valor ?? 0, error: e.error || null, aviso: e.aviso || null, nombre: e.nombre || null });
  });

  app.get('/api/videos-propios/:slug/cortes', (req, res) => {
    const { slug } = req.params;
    if (!esVideoPropio(slug)) return res.status(404).json({ error: 'No encuentro ese video.' });
    res.set('Cache-Control', 'no-store').json({ puedeDeshacer: cortesGuardados(slug).length > 0 });
  });

  app.post('/api/videos-propios/:slug/quitar', (req, res) => {
    const { slug } = req.params;
    if (!desdeLaApp(req, res)) return;
    if (!esVideoPropio(slug)) return res.status(404).json({ error: 'No encuentro ese video.' });
    const desde = Number(req.body?.desde);
    const hasta = Number(req.body?.hasta);
    if (!Number.isFinite(desde) || !Number.isFinite(hasta) || hasta <= desde) return res.status(400).json({ error: 'Elige qué parte quitar.' });
    const plan = leerJSON(path.join(dirDe(slug), 'plan-montaje.json'));
    try {
      const r = quitarTramo(path.join('temp', slug), desde, hasta);
      // lo de antes, para deshacer (el audio de antes sigue en su archivo: cada corte hace uno nuevo)
      const lista = cortesGuardados(slug);
      const n = (lista.at(-1) || 0) + 1;
      fs.mkdirSync(dirCortes(slug), { recursive: true });
      const edicion = req.body?.edicion && typeof req.body.edicion === 'object' ? req.body.edicion : null;
      fs.writeFileSync(path.join(dirCortes(slug), `${n}.json`), JSON.stringify({ plan, edicion, fecha: new Date().toISOString() }) + '\n', 'utf8');
      for (const viejo of lista.slice(0, Math.max(0, lista.length + 1 - MAX_DESHACER))) fs.rmSync(path.join(dirCortes(slug), `${viejo}.json`), { force: true });
      res.json({ mapa: r.mapa, desde: r.desde, hasta: r.hasta, duracion: r.plan.duracion, puedeDeshacer: true });
    } catch (e) {
      res.status(400).json({ error: String(e?.message || e).slice(0, 200) || 'No pude quitar esa parte.' });
    }
  });

  app.post('/api/videos-propios/:slug/deshacer', (req, res) => {
    const { slug } = req.params;
    if (!desdeLaApp(req, res)) return;
    if (!esVideoPropio(slug)) return res.status(404).json({ error: 'No encuentro ese video.' });
    const lista = cortesGuardados(slug);
    const n = lista.at(-1);
    const guardado = n ? leerJSON(path.join(dirCortes(slug), `${n}.json`)) : null;
    if (!guardado?.plan) return res.status(409).json({ error: 'No hay nada que volver a poner.' });
    fs.writeFileSync(path.join(dirDe(slug), 'plan-montaje.json'), JSON.stringify(guardado.plan, null, 2));
    fs.writeFileSync(path.join(dirDe(slug), 'subtitulos.json'), JSON.stringify(guardado.plan.subtitulos || [], null, 2));
    fs.rmSync(path.join(dirCortes(slug), `${n}.json`), { force: true });
    res.json({ edicion: guardado.edicion || null, puedeDeshacer: lista.length > 1 });
  });
}

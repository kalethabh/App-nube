// TU PROPIO VIDEO en lugar de un clip del anuncio (editor: «Reemplazar con tu video», 2026-11-09). Gratis: no pide nada
// a kie. Comparte la cola de regenerar de rutas/editor.js (encolar).
//
//   POST /api/anuncios/:slug/reemplazo?pieza=<toma-N|broll-N|paso-K>&nombre=<archivo>   el video en el cuerpo
//        (hasta 300 MB, solo desde la app). Se guarda al disco mientras llega, se mira con ffprobe y se normaliza con
//        ffmpeg (H.264 yuv420p, AAC, 720x1280 recortado al centro, 30 fps, +faststart: un .mov HEVC del iPhone o un
//        .webm tienen que verse en Chrome) en temp/<slug>/video/subidos/<id>.mp4. Prepararlo va por la fila pesada
//        (como un render) y se toman a lo sumo sus primeros 3 minutos.
//        Segun el estilo (capas.mjs queSePuedeConElClip):
//          modo 'edicion' (voz en off, musicales, continuidad y cualquier imagen de apoyo): no toca el anuncio. La
//            respuesta { id, archivo: 'subidos/<id>.mp4', url, largo, conAudio, nombre, pieza, modo: 'edicion' } y el
//            editor guarda en edicion.json reemplazos[pieza] = { id, archivo, largo, nombre, mudo }.
//          modo 'anuncio' (UGC, objeto parlante, podcast, entrevista: el audio del clip es la voz): reemplaza la pieza
//            de verdad (lo viejo a historial/) y vuelve a armar desde el paso que mide la voz. Entra a la cola de
//            regenerar: { ...lo mismo, modo: 'anuncio', pedido: { id }, trabajo, cola, esperaA }. Antes de recibir
//            el video se mira que el anuncio se pueda volver a armar (disponibilidad de rutas/editor.js): si no,
//            409 { error } con el porqué (sin producción de la app, o hecho en el otro modo).
//   POST /api/anuncios/:slug/reemplazo/original   { pieza }   «Volver al clip original» de una pieza reemplazada EN EL
//        ANUNCIO (en la edicion basta con quitar reemplazos[pieza] en edicion.json). Entra a la cola (o 409, igual).
//   GET  /api/anuncios/:slug/reemplazo  -> { subidos: [{ id, archivo, url, largo, conAudio, nombre, fecha, pieza }],
//        enAnuncio: { 'toma-3': { id, archivo, url, nombre, fecha } }, piezas: { 'toma-3': { velocidad, deslizar,
//        reemplazar: 'edicion'|'anuncio'|null, motivo } } }
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { TEMP } from '../lib/rutas.js';
import { urlAnuncio } from '../lib/anuncios.js';
import { leerJSON, existe, listar, stat, segmentoValido } from '../lib/archivos.js';
import { buscarPrograma } from '../lib/programas.js';
import { leerSubidas } from '../lib/subidos.js';
import * as colas from '../lib/colas.js';
import * as capas from '../../../remotion/src/edicion/capas.mjs';
import { encolar, anuncioConPlan, desdeLaApp, disponibilidad } from './editor.js';

export const MAX_VIDEO = 300 * 1024 * 1024;
const EXT_VIDEO = /\.(mp4|m4v|mov|webm|mkv|avi|3gp|mpe?g)$/i;
const GUARDAR_SIN_USO = 8; // los subidos que nadie usa: se quedan los ultimos (deshacer puede volver a uno)
const PIEZA = /^(toma|broll|paso)-\d+$/;
// Lo mas largo que se prepara de un video tuyo: una pieza dura segundos (y deslizar mueve dentro de eso). Un video de
// una hora no se normaliza entero: se toman sus primeros 3 minutos.
const MAX_SEGUNDOS = 180;
// Lo que dejo a medias una subida o un ffmpeg que no termino (la app se cerro): se borra cuando ya es viejo.
const VIEJO_MS = 60 * 60000;

const dirSubidos = (slug) => path.join(TEMP, slug, 'video', 'subidos');
const programa = (nombre) => buscarPrograma(nombre)?.ruta || nombre;

/** Corre un programa sin consola: { ok, stdout, stderr }. */
function correr(cmd, args, timeout) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => resolve({ ok: !err, stdout: String(stdout || ''), stderr: String(stderr || '') }));
  });
}

/** Lo que trae un archivo de video: { video, audio, duracion } o null si ffprobe no lo pudo leer. */
async function sondear(ruta) {
  const r = await correr(programa('ffprobe'), ['-v', 'error', '-show_entries', 'stream=codec_type:format=duration', '-of', 'json', ruta], 60000);
  if (!r.ok) return null;
  try {
    const d = JSON.parse(r.stdout);
    const tipos = (d.streams || []).map((s) => s.codec_type);
    return { video: tipos.includes('video'), audio: tipos.includes('audio'), duracion: Number(d.format?.duration) || 0 };
  } catch {
    return null;
  }
}

/** El video tal como lo pide la composicion: H.264 yuv420p, AAC, 720x1280 recortado al centro, 30 fps, +faststart. */
async function normalizar(entrada, salida, conAudio) {
  const tmp = `${salida}.armando.mp4`;
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    entrada,
    '-t',
    String(MAX_SEGUNDOS),
    '-map',
    '0:v:0',
    ...(conAudio ? ['-map', '0:a:0'] : []),
    '-vf',
    `scale=${capas.ANCHO}:${capas.ALTO}:force_original_aspect_ratio=increase,crop=${capas.ANCHO}:${capas.ALTO},setsar=1,fps=${capas.FPS},format=yuv420p`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    ...(conAudio ? ['-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2'] : ['-an']),
    '-movflags',
    '+faststart',
    tmp,
  ];
  const r = await correr(programa('ffmpeg'), args, 20 * 60000);
  if (!r.ok || !existe(tmp)) {
    fs.rmSync(tmp, { force: true });
    return { ok: false, detalle: r.stderr.split(/\r?\n/).filter(Boolean).slice(-4).join('\n') };
  }
  fs.renameSync(tmp, salida);
  return { ok: true };
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

/** Las piezas con clip del plan de montaje ('toma-3', 'broll-2', 'paso-4'), en orden. */
function piezasDelPlan(plan) {
  const archivos = [
    ...(plan?.bloques || []).flatMap((b) => [b?.toma?.archivo, b?.broll?.archivo]),
    ...(plan?.continuidad?.clips || []).map((c) => c?.archivo),
    ...(plan?.escena?.piezas || []).filter((x) => x?.tipo === 'clip').map((x) => x.archivo),
  ];
  return [...new Set(archivos.map(capas.piezaDeArchivo).filter(Boolean))];
}

/** El nombre de la pieza para el alumno (como en rutas/editor.js piezasDe). */
function nombreDePieza(slug, pieza) {
  const [clase, n] = pieza.split('-');
  if (clase === 'broll') return `Imagen de apoyo ${n}`;
  if (clase === 'paso') return `Paso ${n}`;
  const tipo = (leerJSON(path.join(TEMP, slug, 'manifiesto.json'))?.tomas || []).find((t) => t.n === Number(n))?.tipo;
  return tipo === 'R' ? `Bloque ${n}` : tipo === 'H' ? `Clip ${n}` : `Escena ${n}`;
}

function subidosGuardados(slug) {
  return listar(dirSubidos(slug))
    .filter((n) => /^[a-z0-9]{6,40}\.mp4$/i.test(n))
    .map((n) => {
      const id = n.replace(/\.mp4$/i, '');
      const meta = leerJSON(path.join(dirSubidos(slug), `${id}.json`)) || {};
      return {
        id,
        archivo: `subidos/${n}`,
        url: urlAnuncio(slug, `video/subidos/${n}`),
        largo: Number(meta.largo) || null,
        conAudio: Boolean(meta.conAudio),
        nombre: meta.nombre || null,
        pieza: meta.pieza || null,
        fecha: meta.fecha || null,
        mtime: stat(path.join(dirSubidos(slug), n))?.mtimeMs || 0,
      };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

/** Lo que dejo a medias una subida o una preparacion que no termino (la app se cerro a mitad), si ya es viejo. */
function limpiarAMedias(slug) {
  const dir = dirSubidos(slug);
  for (const n of listar(dir)) {
    if (!/^\..+\.subiendo$/.test(n) && !/\.armando\.mp4$/.test(n)) continue;
    const st = stat(path.join(dir, n));
    if (st && Date.now() - st.mtimeMs > VIEJO_MS) fs.rmSync(path.join(dir, n), { force: true });
  }
}

/** Saca los subidos que nadie usa (ni la edicion, ni el anuncio, ni un pedido en marcha), salvo los ultimos. */
function limpiarViejos(slug) {
  limpiarAMedias(slug);
  const app = path.join(TEMP, slug, 'app');
  const usados = new Set([
    ...Object.values(leerJSON(path.join(app, 'edicion.json'))?.estado?.reemplazos || {}).map((r) => r?.id),
    ...Object.values(leerSubidas(path.join(TEMP, slug))).map((s) => s?.id),
    ...(leerJSON(path.join(app, 'rehacer', 'cola.json'))?.pedidos || []).map((x) => x?.subido?.id),
    ...(leerJSON(path.join(app, 'rehacer', 'trabajo.json'))?.piezas || []).map((x) => x?.subido?.id),
  ]);
  const sinUso = subidosGuardados(slug).filter((s) => !usados.has(s.id));
  for (const s of sinUso.slice(GUARDAR_SIN_USO)) {
    fs.rmSync(path.join(dirSubidos(slug), `${s.id}.mp4`), { force: true });
    fs.rmSync(path.join(dirSubidos(slug), `${s.id}.json`), { force: true });
  }
}

export default function rutasReemplazo(app) {
  // al abrir la app: lo que dejo a medias una subida de otra vez (hasta 300 MB cada uno) no se queda para siempre
  setTimeout(() => {
    try {
      for (const slug of listar(TEMP)) if (segmentoValido(slug) && existe(dirSubidos(slug))) limpiarAMedias(slug);
    } catch (e) {
      console.error('[reemplazo] No pude limpiar lo que quedó a medias:', e?.message || e);
    }
  }, 5000).unref?.();

  app.get('/api/anuncios/:slug/reemplazo', (req, res) => {
    const { slug } = req.params;
    if (!anuncioConPlan(slug)) return res.status(404).json({ error: 'No encuentro ese anuncio.' });
    const plan = leerJSON(path.join(TEMP, slug, 'plan-montaje.json'));
    const ed = capas.completarEdicion(leerJSON(path.join(TEMP, slug, 'app', 'edicion.json'))?.estado);
    const enAnuncio = Object.fromEntries(
      Object.entries(leerSubidas(path.join(TEMP, slug))).map(([p, s]) => [p, { id: s.id, archivo: s.archivo, url: s.archivo ? urlAnuncio(slug, `video/${s.archivo}`) : null, nombre: s.nombre || null, fecha: s.fecha || null }])
    );
    res.set('Cache-Control', 'no-store');
    res.json({
      subidos: subidosGuardados(slug).map(({ mtime, ...s }) => s),
      enAnuncio,
      piezas: Object.fromEntries(piezasDelPlan(plan).map((p) => [p, capas.queSePuedeConElClip(plan, p, ed)])),
    });
  });

  app.post('/api/anuncios/:slug/reemplazo', async (req, res) => {
    const { slug } = req.params;
    if (!desdeLaApp(req, res)) return;
    if (!anuncioConPlan(slug)) return res.status(404).json({ error: 'No encuentro ese anuncio.' });
    const pieza = String(req.query.pieza || '');
    if (!PIEZA.test(pieza)) return res.status(400).json({ error: 'Elige qué clip quieres reemplazar.' });
    const plan = leerJSON(path.join(TEMP, slug, 'plan-montaje.json'));
    if (!piezasDelPlan(plan).includes(pieza)) return res.status(400).json({ error: 'Ese clip no está en el anuncio.' });
    const puede = capas.queSePuedeConElClip(plan, pieza, null);
    if (!puede.reemplazar) return res.status(400).json({ error: puede.motivo || 'Ese clip no se puede reemplazar.' });
    // en el anuncio (la app lo vuelve a armar): antes de recibir y preparar el video, que se pueda (un anuncio sin su
    // producción en la app, o hecho en el otro modo, no se vuelve a armar: el pedido quedaría esperando para siempre)
    if (puede.reemplazar === 'anuncio') {
      const d = await disponibilidad(slug);
      if (!d.disponible) return res.status(409).json({ error: d.motivo });
    }
    const nombre = path.basename(String(req.query.nombre || 'video')).replace(/[^\p{L}\p{N} ._()-]/gu, '').slice(0, 120) || 'video';
    const tipo = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!tipo.startsWith('video/') && !EXT_VIDEO.test(nombre)) return res.status(400).json({ error: 'Ese archivo no es un video. Usa un MP4, MOV o WEBM.' });
    if (Number(req.headers['content-length']) > MAX_VIDEO) return res.status(413).json({ error: 'Ese video es muy pesado (más de 300 MB). Expórtalo más liviano y vuelve a subirlo.' });
    const id = crypto.randomBytes(8).toString('hex');
    const dir = dirSubidos(slug);
    fs.mkdirSync(dir, { recursive: true });
    const crudo = path.join(dir, `.${id}.subiendo`);
    try {
      const r = await recibir(req, crudo, MAX_VIDEO);
      if (!r.ok) return res.status(r.demasiado ? 413 : 400).json({ error: r.demasiado ? 'Ese video es muy pesado (más de 300 MB). Expórtalo más liviano y vuelve a subirlo.' : 'El video no llegó entero. Vuelve a subirlo.' });
      if (!r.bytes) return res.status(400).json({ error: 'El video llegó vacío.' });
      const info = await sondear(crudo);
      if (!info?.video) return res.status(400).json({ error: 'No pude leer ese video. Prueba exportarlo como MP4.' });
      if (puede.reemplazar === 'anuncio' && !info.audio) return res.status(400).json({ error: 'Ese video no trae sonido: en este estilo la voz va dentro del clip. Sube uno con su voz.' });
      const final = path.join(dir, `${id}.mp4`);
      // prepararlo es pesado (libx264): va por la fila pesada, como un render o una exportacion (nunca al lado de uno
      // del mismo anuncio, y en la PC de a lo que aguante). Si te vas de la pagina mientras espera, no se hace.
      const control = new AbortController();
      res.on('close', () => {
        if (!res.writableEnded) control.abort();
      });
      const soltar = await colas.entrar(slug, { pesada: true }, { senal: control.signal });
      if (!soltar) return;
      let n;
      try {
        n = await normalizar(crudo, final, info.audio);
      } finally {
        soltar();
      }
      if (!n.ok) return res.status(400).json({ error: 'No pude preparar ese video para el anuncio. Prueba exportarlo como MP4.', detalle: n.detalle || null });
      const listo = await sondear(final);
      const largo = Math.round((listo?.duracion || info.duracion || 0) * 1000) / 1000;
      if (!(largo > 0)) {
        fs.rmSync(final, { force: true });
        return res.status(400).json({ error: 'No pude leer cuánto dura ese video. Prueba exportarlo como MP4.' });
      }
      const meta = { id, nombre, largo, conAudio: info.audio, fecha: new Date().toISOString(), pieza };
      fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(meta, null, 2) + '\n', 'utf8');
      const base = { id, archivo: `subidos/${id}.mp4`, url: urlAnuncio(slug, `video/subidos/${id}.mp4`), largo, conAudio: info.audio, nombre, pieza };
      let respuesta = { ...base, modo: 'edicion' };
      if (puede.reemplazar === 'anuncio') {
        const e = encolar(slug, { pieza, nombre: nombreDePieza(slug, pieza), modo: 'subido', subido: { id, archivo: base.archivo, nombre } });
        respuesta = { ...base, modo: 'anuncio', pedido: { id: e.id }, trabajo: e.trabajo, cola: e.cola, esperaA: e.esperaA };
      }
      limpiarViejos(slug);
      res.json(respuesta);
    } catch (e) {
      console.error(`[reemplazo] ${slug}: ${e?.stack || e}`);
      if (!res.headersSent) res.status(500).json({ error: 'No pude guardar ese video. Vuelve a intentarlo.' });
    } finally {
      fs.rmSync(crudo, { force: true });
    }
  });

  app.post('/api/anuncios/:slug/reemplazo/original', async (req, res) => {
    const { slug } = req.params;
    if (!desdeLaApp(req, res)) return;
    if (!anuncioConPlan(slug)) return res.status(404).json({ error: 'No encuentro ese anuncio.' });
    const pieza = String(req.body?.pieza || '');
    if (!PIEZA.test(pieza)) return res.status(400).json({ error: 'Elige qué clip quieres devolver a como estaba.' });
    if (!leerSubidas(path.join(TEMP, slug))[pieza]) {
      return res.status(400).json({ error: 'Esa parte no tiene tu video en el anuncio. Si lo pusiste en la edición, quítalo desde el editor (es gratis).' });
    }
    const d = await disponibilidad(slug);
    if (!d.disponible) return res.status(409).json({ error: d.motivo });
    const e = encolar(slug, { pieza, nombre: nombreDePieza(slug, pieza), modo: 'original' });
    res.json({ pedido: { id: e.id }, trabajo: e.trabajo, cola: e.cola, esperaA: e.esperaA });
  });
}

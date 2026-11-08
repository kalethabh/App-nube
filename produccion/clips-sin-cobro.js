// Clips que no se le pagan al generador de video (2026-11-07).
//
// Son el clip mas caro que no hace falta pedir. Hay dos clases:
//
//   1. "quieto": un plano que no necesita accion (el producto en la mesa, los
//      ingredientes, el bodegon final). Se arma AQUI, con ffmpeg, desde su
//      imagen ya generada: un acercamiento o un paneo suave (Ken Burns). Cero
//      creditos. Vale en el B-roll y en las tomas tipo A de los estilos con
//      narrador.
//
//         "quieto": true                       acercamiento suave (el de siempre)
//         "quieto": "acercar" | "alejar" | "paneo-izquierda" | "paneo-derecha"
//
//   2. "desde_biblioteca": un clip ya pagado en otro anuncio, guardado en
//      mis_archivos/biblioteca/clips/. Se copia tal cual (y su primer y ultimo
//      fotograma, como las imagenes de la toma). Cero creditos y cero imagenes.
//
//         "desde_biblioteca": "mis_archivos/biblioteca/clips/estilo-pixar/drenaje-linfatico-1a2b.mp4"
//
// Y para llenar la biblioteca, una toma o un B-roll puede pedir que su clip,
// una vez generado, se guarde para otros anuncios:
//
//         "guardar_en_biblioteca": { "tipo": "mecanismo", "nombre": "Drenaje linfatico en 3D", "producto": "Lymphoria" }
//
// tipo: producto | ingrediente | mecanismo | escena | broll (descriptivo).
// Lo que se guarda: el mp4, su primer fotograma (png) y un json con los
// prompts, la duracion, el estilo y de que anuncio salio.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as config from './config.js';

const { RAIZ } = config;
// 1080p si el motor lo trae (ESCALA_RENDER); si no, el tamano de siempre (720x1280).
const ESCALA_RENDER = Number(config.ESCALA_RENDER) || 1;

export const DIR_CLIPS = path.join(RAIZ, 'mis_archivos', 'biblioteca', 'clips');
export const MOVIMIENTOS_QUIETO = ['acercar', 'alejar', 'paneo-izquierda', 'paneo-derecha'];

// Como el resto del motor: ffmpeg y ffprobe del PATH (la instalacion los deja ahi).
const FFMPEG = 'ffmpeg';
const FFPROBE = 'ffprobe';

/** El movimiento de un clip quieto, o null si no es quieto. */
export function movimientoQuieto(item) {
  if (!item || item.quieto === undefined || item.quieto === false || item.quieto === null) return null;
  if (item.quieto === true) return 'acercar';
  return MOVIMIENTOS_QUIETO.includes(item.quieto) ? item.quieto : null;
}

/** Ruta absoluta del clip de biblioteca que usa el item, o null. */
export function clipDeBiblioteca(item) {
  if (!item || typeof item.desde_biblioteca !== 'string' || !item.desde_biblioteca.trim()) return null;
  return path.resolve(RAIZ, item.desde_biblioteca.trim());
}

/** 'quieto' | 'biblioteca' | null: si el clip de este item se arma sin cobrar. */
export function modoSinCobro(item) {
  if (clipDeBiblioteca(item)) return 'biblioteca';
  if (movimientoQuieto(item)) return 'quieto';
  return null;
}

/** El item del manifiesto (toma o B-roll) de un trabajo de imagen o de video. */
export function itemDeTrabajo(m, trabajo) {
  if (trabajo.clase === 'broll') return (m.broll || []).find((b) => b.n === trabajo.n) || null;
  if (trabajo.clase === 'toma') return (m.tomas || []).find((t) => t.n === trabajo.n) || null;
  return null;
}

/** Dentro de RAIZ/mis_archivos/biblioteca/clips, y que exista. */
export function problemaConClipDeBiblioteca(item) {
  const ruta = clipDeBiblioteca(item);
  if (!ruta) return null;
  const rel = path.relative(DIR_CLIPS, ruta);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return `"desde_biblioteca" tiene que estar dentro de mis_archivos/biblioteca/clips/ (dice ${item.desde_biblioteca})`;
  if (!fs.existsSync(ruta)) return `no encuentro el clip de la biblioteca ${item.desde_biblioteca}`;
  return null;
}

/** Duracion en segundos de un video (ffprobe), o null. */
export function duracionDe(ruta) {
  try {
    const s = execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', ruta], { encoding: 'utf8' });
    const n = Number(s.trim());
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * Arma un clip quieto desde una imagen: 720x1280 (o el formato del anuncio),
 * 25 fps, como los del generador, con un movimiento suave. Con silencio de
 * audio: el montaje pone la voz y la musica encima.
 */
export function armarClipQuieto(imagen, destino, segundos, movimiento = 'acercar', aspectRatio = '9:16') {
  // Del tamano del anuncio final (720x1280, o 1080x1920 con RESOLUCION_VIDEO=1080p).
  const [aw, ah] = (aspectRatio === '16:9' ? [1280, 720] : aspectRatio === '1:1' ? [960, 960] : [720, 1280]).map((x) => Math.round(x * ESCALA_RENDER));
  const fps = 25;
  const frames = Math.max(1, Math.round(segundos * fps));
  // Se escala al doble antes del zoompan para que el movimiento no tiemble.
  const W = aw * 2;
  const H = ah * 2;
  const z = {
    acercar: `zoom='1+0.10*on/${frames}'`,
    alejar: `zoom='1.10-0.10*on/${frames}'`,
    'paneo-izquierda': `zoom='1.12'`,
    'paneo-derecha': `zoom='1.12'`,
  }[movimiento];
  const x = {
    acercar: `x='iw/2-(iw/zoom/2)'`,
    alejar: `x='iw/2-(iw/zoom/2)'`,
    'paneo-izquierda': `x='(iw-iw/zoom)*(1-on/${frames})'`,
    'paneo-derecha': `x='(iw-iw/zoom)*on/${frames}'`,
  }[movimiento];
  const filtro =
    `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},` +
    `zoompan=${z}:${x}:y='ih/2-(ih/zoom/2)':d=${frames}:s=${aw}x${ah}:fps=${fps},format=yuv420p`;
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const tmp = `${destino}.tmp.mp4`;
  // Con una pista de silencio, como los clips del generador (que traen ambiente):
  // el montaje los trata igual.
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-loop', '1', '-i', imagen, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-vf', filtro, '-frames:v', String(frames), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-c:a', 'aac', '-shortest', '-map', '0:v', '-map', '1:a', tmp], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  fs.renameSync(tmp, destino);
  return destino;
}

/** Saca un fotograma (primero o ultimo) de un video a png. */
export function fotogramaDe(video, destino, cual = 'primero') {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const args = cual === 'ultimo' ? ['-v', 'error', '-y', '-sseof', '-0.1', '-i', video, '-frames:v', '1', destino] : ['-v', 'error', '-y', '-i', video, '-frames:v', '1', destino];
  execFileSync(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  return destino;
}

const slug = (s) =>
  String(s || 'clip')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'clip';

/** Todos los clips de la biblioteca: [{ id, ruta (relativa a RAIZ), ...datos }]. */
export function listarClips() {
  if (!fs.existsSync(DIR_CLIPS)) return [];
  const out = [];
  for (const estilo of fs.readdirSync(DIR_CLIPS, { withFileTypes: true })) {
    if (!estilo.isDirectory()) continue;
    const dir = path.join(DIR_CLIPS, estilo.name);
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        const mp4 = path.join(dir, f.replace(/\.json$/, '.mp4'));
        if (!fs.existsSync(mp4)) continue;
        out.push({ ...d, ruta: path.relative(RAIZ, mp4).split(path.sep).join('/'), imagen: path.relative(RAIZ, mp4.replace(/\.mp4$/, '.png')).split(path.sep).join('/') });
      } catch {
        /* un json roto no frena la lista */
      }
    }
  }
  return out.sort((a, b) => (b.creado || 0) - (a.creado || 0));
}

/**
 * Guarda en la biblioteca el clip recien generado de un item con
 * "guardar_en_biblioteca". Nunca lanza: si algo falla, devuelve el motivo.
 * No guarda dos veces el mismo clip (misma huella).
 */
export function guardarEnBiblioteca({ manifiesto, carpeta, item, archivoClip, clase }) {
  const g = item?.guardar_en_biblioteca;
  if (!g || typeof g !== 'object') return null;
  try {
    const origen = path.join(carpeta, 'video', archivoClip);
    if (!fs.existsSync(origen)) return { error: `no existe ${archivoClip}` };
    const huella = crypto.createHash('sha1').update(fs.readFileSync(origen)).digest('hex').slice(0, 10);
    const estilo = slug(manifiesto.estilo || 'general');
    const dir = path.join(DIR_CLIPS, estilo);
    fs.mkdirSync(dir, { recursive: true });
    const ya = listarClips().find((c) => c.huella === huella);
    if (ya) return { yaEstaba: ya.ruta };
    const id = `${slug(g.nombre || g.tipo)}-${huella.slice(0, 4)}`;
    const destino = path.join(dir, `${id}.mp4`);
    fs.copyFileSync(origen, destino);
    try {
      fotogramaDe(destino, destino.replace(/\.mp4$/, '.png'));
    } catch {
      /* sin miniatura igual sirve */
    }
    const datos = {
      id,
      nombre: g.nombre || id,
      tipo: g.tipo || (clase === 'broll' ? 'broll' : 'escena'),
      producto: g.producto || null,
      estilo: manifiesto.estilo || null,
      duracion: duracionDe(destino) ?? item.duracion ?? null,
      prompt_imagen: item.prompt_imagen_inicial || item.prompt_imagen || null,
      prompt_imagen_final: item.prompt_imagen_final || null,
      prompt_video: item.prompt_video || null,
      notas: g.notas || '',
      huella,
      origen: { anuncio: path.basename(carpeta), archivo: archivoClip },
      creado: Date.now(),
    };
    fs.writeFileSync(destino.replace(/\.mp4$/, '.json'), JSON.stringify(datos, null, 2) + '\n', 'utf8');
    return { guardado: path.relative(RAIZ, destino).split(path.sep).join('/') };
  } catch (e) {
    return { error: e.message };
  }
}

// Lectura segura de archivos. Nada de lo que viene en una URL puede salirse de su carpeta.
import fs from 'node:fs';
import path from 'node:path';

/** Lee un JSON; si no existe o esta roto devuelve null (nunca tira). */
export function leerJSON(ruta) {
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf8'));
  } catch {
    return null;
  }
}

export function existe(ruta) {
  try {
    fs.accessSync(ruta);
    return true;
  } catch {
    return false;
  }
}

export function stat(ruta) {
  try {
    return fs.statSync(ruta);
  } catch {
    return null;
  }
}

const PAUSA = new Int32Array(new SharedArrayBuffer(4));

/**
 * Renombra el temporal sobre el archivo final. En Windows un lector (la pantalla, el antivirus, otra app) puede
 * tenerlo abierto un instante y el renombre falla con EPERM/EBUSY: se reintenta con una espera corta. Si no se
 * pudo, el temporal se borra (no quedan .tmp sueltos) y se tira el error.
 */
export function renombrarSeguro(tmp, ruta) {
  for (let i = 0; ; i++) {
    try {
      fs.renameSync(tmp, ruta);
      return;
    } catch (e) {
      if (i >= 8 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) {
        try {
          fs.rmSync(tmp, { force: true });
        } catch {
          /* queda: el proximo guardado lo pisa */
        }
        throw e;
      }
      Atomics.wait(PAUSA, 0, 0, 40 * (i + 1));
    }
  }
}

/** Escribe un archivo de una vez (temporal con nombre propio + renombre seguro): nunca queda a medias. */
export function escribirSeguro(ruta, contenido) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const tmp = `${ruta}.${process.pid}.${Math.random().toString(16).slice(2, 8)}.tmp`;
  fs.writeFileSync(tmp, contenido, typeof contenido === 'string' ? 'utf8' : undefined);
  renombrarSeguro(tmp, ruta);
}

/** Un JSON con escribirSeguro. */
export const escribirJSONSeguro = (ruta, valor) => escribirSeguro(ruta, JSON.stringify(valor, null, 2) + '\n');

/** Nombres de una carpeta (vacio si no existe). */
export function listar(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

// Un segmento valido de ruta: sin "..", sin barras, sin ":" (unidades de Windows), sin NUL,
// sin empezar con punto (nada de .env ni archivos ocultos).
const SEGMENTO = /^[^/\\:\0]+$/;
export function segmentoValido(s) {
  return typeof s === 'string' && s.length > 0 && s.length < 200 && SEGMENTO.test(s) && !s.startsWith('.') && s !== '..';
}

/**
 * Une `base` con los segmentos y devuelve la ruta absoluta SOLO si queda dentro de `base`.
 * Si algun segmento es raro o la ruta se escapa, devuelve null.
 */
export function dentroDe(base, segmentos) {
  const partes = Array.isArray(segmentos) ? segmentos : String(segmentos).split(/[/\\]+/).filter(Boolean);
  if (!partes.length || !partes.every(segmentoValido)) return null;
  const raiz = path.resolve(base);
  const final = path.resolve(raiz, ...partes);
  if (final !== raiz && !final.startsWith(raiz + path.sep)) return null;
  return final;
}

// Lo unico que se sirve por /archivos: medios para ver y escuchar. Los JSON del motor
// (manifiesto, plan) salen solo por la API, ya traducidos.
export const TIPOS_MEDIO = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.srt': 'text/plain; charset=utf-8',
  '.vtt': 'text/vtt; charset=utf-8',
};

export const esImagen = (n) => /\.(png|jpe?g|webp|gif)$/i.test(n);
export const esVideo = (n) => /\.(mp4|webm|mov)$/i.test(n);
export const esAudio = (n) => /\.(mp3|wav|m4a|aac|ogg)$/i.test(n);

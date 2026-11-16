// La BIBLIOTECA DE REFERENCIAS de «Anuncios de imagen» (2026-11-15): los anuncios que te gustan, guardados para usarlos
// otra vez con cualquier producto. Viven en mis_archivos/biblioteca/referencias-imagen/<id>.<png|jpg> (id = el
// comienzo del sha1 de la imagen: la misma imagen nunca queda dos veces) y se sirven con /archivos/biblioteca/….
// Cada referencia que subes a un lote se guarda aquí sola.
//
//   listar()            -> [{ id, url, miniatura, fecha }]   (la más nueva primero)
//   guardar(abs)        copia esa imagen (ya normalizada: PNG o JPG) -> { id, nueva }
//   borrar(id)          -> true si estaba
//   investigacionATexto(bytes, nombre) -> { texto } | { pdf: true } | null   (lo que subiste como investigación)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { DIR_BIBLIOTECA } from '../biblioteca.js';
import { abrirZip } from '../actualizar.js';

export const DIR_REFERENCIAS = path.join(DIR_BIBLIOTECA, 'referencias-imagen');
const RE_ARCHIVO = /^([a-f0-9]{16})\.(png|jpg)$/;
export const RE_ID = /^[a-f0-9]{16}$/;

const archivos = () => {
  try {
    return fs.readdirSync(DIR_REFERENCIAS).filter((n) => RE_ARCHIVO.test(n));
  } catch {
    return [];
  }
};

export function listar() {
  return archivos()
    .map((n) => {
      const st = fs.statSync(path.join(DIR_REFERENCIAS, n));
      const v = Math.round(st.mtimeMs).toString(36);
      return { id: n.slice(0, 16), url: `/archivos/biblioteca/referencias-imagen/${n}?v=${v}`, miniatura: `/archivos/miniatura/biblioteca/referencias-imagen/${n}?ancho=480&v=${v}`, fecha: st.mtime.toISOString(), ms: st.mtimeMs };
    })
    .sort((a, b) => b.ms - a.ms)
    .map(({ ms, ...x }) => x);
}

/** Las referencias guardadas con su ruta en disco, la más nueva primero: [{ id, abs }]. */
export function conRuta() {
  return archivos()
    .map((n) => ({ id: n.slice(0, 16), abs: path.join(DIR_REFERENCIAS, n), ms: fs.statSync(path.join(DIR_REFERENCIAS, n)).mtimeMs }))
    .sort((a, b) => b.ms - a.ms)
    .map(({ ms, ...x }) => x);
}

export function guardar(abs) {
  const ext = path.extname(abs).toLowerCase() === '.png' ? 'png' : 'jpg';
  const id = crypto.createHash('sha1').update(fs.readFileSync(abs)).digest('hex').slice(0, 16);
  const ya = archivos().find((n) => n.startsWith(`${id}.`));
  if (ya) return { id, nueva: false };
  fs.mkdirSync(DIR_REFERENCIAS, { recursive: true });
  const destino = path.join(DIR_REFERENCIAS, `${id}.${ext}`);
  const tmp = `${destino}.${process.pid}.tmp`;
  fs.copyFileSync(abs, tmp);
  fs.renameSync(tmp, destino);
  return { id, nueva: true };
}

export function borrar(id) {
  if (!RE_ID.test(String(id || ''))) return false;
  const n = archivos().find((x) => x.startsWith(`${id}.`));
  if (!n) return false;
  fs.rmSync(path.join(DIR_REFERENCIAS, n), { force: true });
  return true;
}

// ---------------------------------------------------------------- la investigación de mercado

const MAXIMO_TEXTO = 120000;
const limpiar = (t) => String(t).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/\n{4,}/g, '\n\n\n').trim().slice(0, MAXIMO_TEXTO);
const XML = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };

/** El texto de un .docx (word/document.xml: un renglón por párrafo). */
function textoDeDocx(bytes) {
  const tmp = path.join(os.tmpdir(), `kads-docx-${process.pid}-${Date.now()}.zip`);
  fs.writeFileSync(tmp, bytes);
  let zip = null;
  try {
    zip = abrirZip(tmp);
    const e = zip.entradas.find((x) => x.nombre === 'word/document.xml');
    if (!e) return null;
    const xml = zip.leer(e).toString('utf8');
    return xml
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML[m]);
  } catch {
    return null;
  } finally {
    try {
      zip?.cerrar();
    } catch {
      /* ya estaba cerrado */
    }
    fs.rmSync(tmp, { force: true });
  }
}

/**
 * Lo que subió el usuario como investigación de mercado: texto (pegado, .txt, .md), Word (.docx) o PDF.
 * -> { texto } · { pdf: true } (se guarda tal cual: la IA lo lee) · null (no sirve)
 */
export function investigacionATexto(bytes, nombre = '') {
  if (!Buffer.isBuffer(bytes) || !bytes.length) return null;
  if (bytes.slice(0, 5).toString('latin1') === '%PDF-') return { pdf: true };
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const t = textoDeDocx(bytes);
    const limpio = t ? limpiar(t) : '';
    return limpio.length >= 20 ? { texto: limpio } : null;
  }
  // texto plano: sin bytes nulos (no es un binario)
  if (bytes.includes(0)) return null;
  const limpio = limpiar(bytes.toString('utf8'));
  return limpio.length >= 20 ? { texto: limpio } : null;
}

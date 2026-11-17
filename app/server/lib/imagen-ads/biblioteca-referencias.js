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
import { RAIZ } from '../rutas.js';
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

// ---------------------------------------------------------------- referencias de TENDENCIA (TrendTrack)
// Creativos de imagen de marcas de salud que están funcionando, bajados de TrendTrack y guardados en
// mis_archivos/referencias-tendencia/<categoria>/<id>.jpg con su indice.json (marca, alcance, crecimiento a 7 días).
// Son de solo lectura: se eligen como cualquier referencia, pero no se borran desde la app.
export const DIR_TENDENCIAS = path.join(RAIZ, 'mis_archivos', 'referencias-tendencia');
const RE_CATEGORIA = /^[a-z0-9-]{2,40}$/;
const RE_ARCHIVO_TENDENCIA = /^[0-9a-z_-]{4,40}\.jpg$/i;

/** { categorias: [{ id, nombre, cuantas }], referencias: [{ id, categoria, marca, alcance, alcance7d, dias, url, miniatura }] } */
export function listarTendencias() {
  let indice = null;
  try {
    indice = JSON.parse(fs.readFileSync(path.join(DIR_TENDENCIAS, 'indice.json'), 'utf8'));
  } catch {
    return { categorias: [], referencias: [], fecha: null };
  }
  const refs = (Array.isArray(indice?.referencias) ? indice.referencias : []).filter((r) => {
    const [cat, archivo] = String(r?.archivo || '').split('/');
    return RE_CATEGORIA.test(cat || '') && RE_ARCHIVO_TENDENCIA.test(archivo || '') && fs.existsSync(path.join(DIR_TENDENCIAS, cat, archivo));
  });
  const nombres = indice?.categorias && typeof indice.categorias === 'object' ? indice.categorias : {};
  const cuenta = new Map();
  for (const r of refs) cuenta.set(r.categoria, (cuenta.get(r.categoria) || 0) + 1);
  return {
    fecha: indice?.fecha || null,
    categorias: [...cuenta.keys()].map((id) => ({ id, nombre: String(nombres[id] || id), cuantas: cuenta.get(id) })),
    referencias: refs
      .sort((a, b) => (Number(b.alcance) || 0) - (Number(a.alcance) || 0))
      .map((r) => {
        const [cat, archivo] = r.archivo.split('/');
        const url = `/api/imagen-ads/tendencias/${encodeURIComponent(cat)}/${encodeURIComponent(archivo)}`;
        return { id: `t-${r.id}`, categoria: r.categoria, marca: String(r.marca || ''), alcance: Number(r.alcance) || 0, alcance7d: Number(r.alcance_7d) || 0, dias: Number(r.dias) || 0, url, miniatura: url };
      }),
  };
}

/** La ruta en disco de una referencia de tendencia (validada), o null. */
export function rutaTendencia(categoria, archivo) {
  if (!RE_CATEGORIA.test(String(categoria || '')) || !RE_ARCHIVO_TENDENCIA.test(String(archivo || ''))) return null;
  const abs = path.join(DIR_TENDENCIAS, categoria, archivo);
  return fs.existsSync(abs) ? abs : null;
}

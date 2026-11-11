// El zip de un lote de ANUNCIOS DE IMAGEN, en streaming (ESPECIFICACION-imagen-ads.md §9.3). Sin comprimir (STORE: los
// PNG ya vienen comprimidos), nombres en UTF-8 (bit 11) y sin zip64: hasta 65535 archivos y menos de 4 GiB.
// Dos pasadas por archivo: primero su CRC (zlib.crc32, leyendo de a trozos y con cache por tamaño y fecha), despues la
// cabecera con el tamaño y el CRC ya conocidos y el archivo, respetando la contrapresion. Sin "data descriptor": el zip
// lo abre cualquier descompresor. El tamaño total (Content-Length) se sabe antes de empezar.
// (No es app/herramientas/zip.mjs: ese lo usan el CI y el empaquetador.)
//
//   const plan = await prepararZip([{ nombre: 'Crema Luna/V01-cuadrado.png', origen: abs }, ...])  -> { tamano, ... }
//   await enviarZip(res, plan)      escribe el zip en `res` (si el navegador corta, deja de leer)
//
// Cada archivo se abre ANTES de mandar su cabecera y se compara con lo que se midio (tamaño y fecha): si el motor lo
// reemplazo o lo movio entre las dos pasadas, o algo falla al leer, la respuesta se corta (res.destroy) y el navegador
// ve la descarga como fallida, en vez de quedarse esperando o de bajar un archivo dañado. Abierto, el archivo es ese
// aunque despues lo renombren (los que escriben siempre lo hacen con un temporal y un renombre).
import fs from 'node:fs';
import zlib from 'node:zlib';

const cacheCrc = new Map(); // `${ruta}|${size}|${mtimeMs}` -> crc

async function crcDe(abs, st) {
  const clave = `${abs}|${st.size}|${st.mtimeMs}`;
  if (cacheCrc.has(clave)) return cacheCrc.get(clave);
  let crc = 0;
  for await (const trozo of fs.createReadStream(abs, { highWaterMark: 1024 * 1024 })) crc = zlib.crc32(trozo, crc);
  if (cacheCrc.size > 4000) cacheCrc.clear();
  cacheCrc.set(clave, crc);
  return crc;
}

function fechaDos(d) {
  const anio = Math.max(1980, d.getFullYear());
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    dia: ((anio - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export class ZipMuyGrande extends Error {
  constructor() {
    super('Es muy grande para un solo zip: descárgalo en dos partes.');
    this.status = 413;
  }
}

/** Mide y calcula el CRC de cada archivo. `entradas`: [{ nombre, origen }]. Lo que no existe se salta. */
export async function prepararZip(entradas) {
  const partes = [];
  let pos = 0;
  for (const e of entradas) {
    let st;
    try {
      st = fs.statSync(e.origen);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    const nombre = Buffer.from(String(e.nombre).replace(/\\/g, '/'), 'utf8');
    const crc = await crcDe(e.origen, st);
    const { hora, dia } = fechaDos(st.mtime);
    partes.push({ nombre, origen: e.origen, tamano: st.size, mtimeMs: st.mtimeMs, crc, hora, dia, desde: pos });
    pos += 30 + nombre.length + st.size;
  }
  if (partes.length > 0xffff) throw new ZipMuyGrande();
  const central = Buffer.concat(
    partes.map((p) => {
      const b = Buffer.alloc(46);
      b.writeUInt32LE(0x02014b50, 0);
      b.writeUInt16LE(20, 4); // hecho por: 2.0
      b.writeUInt16LE(20, 6); // necesita: 2.0
      b.writeUInt16LE(0x0800, 8); // nombres en UTF-8
      b.writeUInt16LE(0, 10); // STORE
      b.writeUInt16LE(p.hora, 12);
      b.writeUInt16LE(p.dia, 14);
      b.writeUInt32LE(p.crc >>> 0, 16);
      b.writeUInt32LE(p.tamano, 20);
      b.writeUInt32LE(p.tamano, 24);
      b.writeUInt16LE(p.nombre.length, 28);
      b.writeUInt16LE(0, 30); // extra
      b.writeUInt16LE(0, 32); // comentario
      b.writeUInt16LE(0, 34); // disco
      b.writeUInt16LE(0, 36); // atributos internos
      b.writeUInt32LE(0, 38); // atributos externos
      b.writeUInt32LE(p.desde, 42);
      return Buffer.concat([b, p.nombre]);
    })
  );
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(0, 4);
  fin.writeUInt16LE(0, 6);
  fin.writeUInt16LE(partes.length, 8);
  fin.writeUInt16LE(partes.length, 10);
  fin.writeUInt32LE(central.length, 12);
  fin.writeUInt32LE(pos, 16);
  fin.writeUInt16LE(0, 20);
  const tamano = pos + central.length + fin.length;
  if (tamano >= 0xffffffff || pos >= 0xffffffff) throw new ZipMuyGrande();
  return { partes, central, fin, tamano };
}

function cabeceraLocal(p) {
  const b = Buffer.alloc(30);
  b.writeUInt32LE(0x04034b50, 0);
  b.writeUInt16LE(20, 4);
  b.writeUInt16LE(0x0800, 6);
  b.writeUInt16LE(0, 8);
  b.writeUInt16LE(p.hora, 10);
  b.writeUInt16LE(p.dia, 12);
  b.writeUInt32LE(p.crc >>> 0, 14);
  b.writeUInt32LE(p.tamano, 18);
  b.writeUInt32LE(p.tamano, 22);
  b.writeUInt16LE(p.nombre.length, 26);
  b.writeUInt16LE(0, 28);
  return Buffer.concat([b, p.nombre]);
}

/** Escribe respetando la contrapresion. false si el que recibe ya corto. */
function escribir(res, buf) {
  if (res.destroyed || res.writableEnded) return Promise.resolve(false);
  if (res.write(buf)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const listo = () => {
      res.off('close', cortado);
      resolve(true);
    };
    const cortado = () => {
      res.off('drain', listo);
      resolve(false);
    };
    res.once('drain', listo);
    res.once('close', cortado);
  });
}

/** Un archivo del zip: su cabecera y su contenido, desde el archivo ya abierto. false si algo no salio. */
async function mandarArchivo(res, p) {
  let fh = null;
  try {
    fh = await fs.promises.open(p.origen, 'r');
    const st = await fh.stat();
    // otro archivo que el que se midio (lo reemplazaron entre las dos pasadas): su CRC ya no sirve
    if (st.size !== p.tamano || Math.abs(st.mtimeMs - p.mtimeMs) > 1) return false;
    if (!(await escribir(res, cabeceraLocal(p)))) return false;
    let enviados = 0;
    const lector = fh.createReadStream({ highWaterMark: 256 * 1024, autoClose: false });
    for await (const trozo of lector) {
      const resto = p.tamano - enviados;
      if (resto <= 0) break;
      const pedazo = trozo.length > resto ? trozo.subarray(0, resto) : trozo;
      enviados += pedazo.length;
      if (!(await escribir(res, pedazo))) {
        lector.destroy();
        return false;
      }
    }
    return enviados === p.tamano;
  } catch {
    return false;
  } finally {
    await fh?.close().catch(() => {});
  }
}

/** Manda el zip preparado. Devuelve true si salio entero; si no, corta la respuesta (nunca la deja colgada). */
export async function enviarZip(res, plan) {
  let ok = true;
  for (const p of plan.partes) {
    if (!(await mandarArchivo(res, p))) {
      ok = false;
      break;
    }
  }
  if (ok) ok = (await escribir(res, plan.central)) && (await escribir(res, plan.fin));
  if (!ok) {
    if (!res.destroyed) res.destroy();
    return false;
  }
  res.end();
  return true;
}

// Duracion de un MP4 sin ffprobe: se lee la caja "mvhd" dentro de "moov".
// Solo se leen los encabezados de las cajas (unos bytes), nunca el video entero.
import fs from 'node:fs';

const cache = new Map(); // ruta -> { firma, duracion }

function leer(fd, posicion, largo) {
  const b = Buffer.alloc(largo);
  const n = fs.readSync(fd, b, 0, largo, posicion);
  return n === largo ? b : null;
}

/** Recorre las cajas entre `desde` y `hasta` y devuelve { inicio, fin } de la primera con ese tipo. */
function buscarCaja(fd, desde, hasta, tipo) {
  let pos = desde;
  while (pos + 8 <= hasta) {
    const h = leer(fd, pos, 16);
    if (!h) return null;
    let tam = h.readUInt32BE(0);
    const t = h.toString('latin1', 4, 8);
    let cabecera = 8;
    if (tam === 1) {
      tam = Number(h.readBigUInt64BE(8));
      cabecera = 16;
    } else if (tam === 0) {
      tam = hasta - pos;
    }
    if (tam < cabecera) return null;
    if (t === tipo) return { inicio: pos + cabecera, fin: pos + tam };
    pos += tam;
  }
  return null;
}

/** Segundos del MP4, o null si no se puede leer. */
export function duracionMp4(ruta) {
  let st;
  try {
    st = fs.statSync(ruta);
  } catch {
    return null;
  }
  const firma = `${st.size}:${st.mtimeMs}`;
  const guardado = cache.get(ruta);
  if (guardado && guardado.firma === firma) return guardado.duracion;

  let duracion = null;
  let fd;
  try {
    fd = fs.openSync(ruta, 'r');
    const moov = buscarCaja(fd, 0, st.size, 'moov');
    const mvhd = moov && buscarCaja(fd, moov.inicio, moov.fin, 'mvhd');
    if (mvhd) {
      const b = leer(fd, mvhd.inicio, 32);
      if (b) {
        const version = b.readUInt8(0);
        if (version === 1) {
          const escala = b.readUInt32BE(20);
          const dur = Number(b.readBigUInt64BE(24));
          duracion = escala ? dur / escala : null;
        } else {
          const escala = b.readUInt32BE(12);
          const dur = b.readUInt32BE(16);
          duracion = escala ? dur / escala : null;
        }
      }
    }
  } catch {
    duracion = null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  if (duracion !== null) duracion = Math.round(duracion * 1000) / 1000;
  cache.set(ruta, { firma, duracion });
  return duracion;
}

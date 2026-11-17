// PINCEL PARA CENSURAR (editor, 2026-11-17): el usuario pinta una zona del video en un momento y aquí se sigue lo que
// hay pintado, cuadro a cuadro, hacia adelante y hacia atrás dentro de la misma escena (se corta en un cambio de plano
// o cuando lo pierde). Gratis, en esta PC: ffmpeg saca los cuadros en gris y chiquitos (10 por segundo, 160 px de
// ancho) y se busca la zona en cada uno por correlación (NCC) alrededor de donde estaba en el cuadro anterior.
//
//   seguirZona(video, { t, x, y, w, h, desde, hasta }) -> { apariciones: [[t, x, y, w, h], ...], quieta, perdida }
//     video: el MP4 a leer; t, desde, hasta en segundos DE ESE MP4; x, y el centro y w, h el tamaño (0 a 1).
import { spawn } from 'node:child_process';
import zlib from 'node:zlib';
import { rutaFfmpeg } from './miniaturas.js';

const ANCHO = 160;
const FPS = 10;
const MAX_LADO = 24; // la zona, ya achicada, no pasa de esto (así la búsqueda es rápida)
const UMBRAL = 0.5; // con menos parecido que esto, se perdió
const CAMBIO_DE_PLANO = 28; // diferencia media (0-255) entre dos cuadros seguidos que se toma como corte

// El ffmpeg de Remotion no trae el formato «crudo»: los cuadros salen en PNG gris (uno detrás de otro) y se leen aquí.
function leerPngs(buf) {
  const salida = [];
  let i = 0;
  while (i + 8 <= buf.length) {
    if (buf.readUInt32BE(i) !== 0x89504e47) break;
    i += 8;
    let ancho = 0;
    let alto = 0;
    let tipo = 0;
    let bits = 8;
    const idat = [];
    for (;;) {
      const largo = buf.readUInt32BE(i);
      const nombre = buf.toString('latin1', i + 4, i + 8);
      const datos = buf.subarray(i + 8, i + 8 + largo);
      i += 12 + largo;
      if (nombre === 'IHDR') {
        ancho = datos.readUInt32BE(0);
        alto = datos.readUInt32BE(4);
        bits = datos[8];
        tipo = datos[9];
      } else if (nombre === 'IDAT') idat.push(datos);
      else if (nombre === 'IEND') break;
    }
    if (tipo !== 0 || bits !== 8) throw new Error('Formato de cuadro inesperado');
    const z = zlib.inflateSync(Buffer.concat(idat));
    const px = Buffer.alloc(ancho * alto);
    for (let y = 0; y < alto; y++) {
      const f = z[y * (ancho + 1)];
      const o = y * (ancho + 1) + 1;
      for (let x = 0; x < ancho; x++) {
        const a = x > 0 ? px[y * ancho + x - 1] : 0;
        const b = y > 0 ? px[(y - 1) * ancho + x] : 0;
        const c = x > 0 && y > 0 ? px[(y - 1) * ancho + x - 1] : 0;
        let v = z[o + x];
        if (f === 1) v += a;
        else if (f === 2) v += b;
        else if (f === 3) v += (a + b) >> 1;
        else if (f === 4) {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        }
        px[y * ancho + x] = v & 255;
      }
    }
    salida.push({ px, ancho, alto });
  }
  return salida;
}

/** Los cuadros (gris, 160 px de ancho, 10 por segundo) de [desde, desde + dur): [{ px, ancho, alto }]. */
function cuadros(video, desde, dur, uno = false) {
  return new Promise((ok, mal) => {
    const args = ['-v', 'error', '-ss', String(Math.max(0, desde)), ...(uno ? [] : ['-t', String(Math.max(0.1, dur))]), '-i', video, '-vf', `scale=${ANCHO}:-2,format=gray`, '-r', String(FPS), ...(uno ? ['-frames:v', '1'] : []), '-c:v', 'png', '-f', 'image2pipe', '-'];
    const p = spawn(rutaFfmpeg(), args, { windowsHide: true });
    const partes = [];
    let err = '';
    p.stdout.on('data', (d) => partes.push(d));
    p.stderr.on('data', (d) => (err = (err + d).slice(-600)));
    p.on('error', mal);
    p.on('close', (c) => {
      if (c !== 0) return mal(new Error(err || 'ffmpeg no pudo leer el video'));
      try {
        ok(leerPngs(Buffer.concat(partes)));
      } catch (e) {
        mal(e);
      }
    });
  });
}

/** Achica un cuadro (Uint8 ANCHO x alto) por s (promedio de cada bloque de s x s). */
function achicar(buf, off, ancho, alto, s) {
  const w = Math.floor(ancho / s);
  const h = Math.floor(alto / s);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let suma = 0;
      for (let j = 0; j < s; j++) {
        const fila = off + (y * s + j) * ancho + x * s;
        for (let i = 0; i < s; i++) suma += buf[fila + i];
      }
      out[y * w + x] = suma / (s * s);
    }
  }
  return { px: out, w, h };
}

function plantilla(f, x0, y0, tw, th) {
  const t = new Float32Array(tw * th);
  let m = 0;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) m += t[y * tw + x] = f.px[(y0 + y) * f.w + x0 + x];
  m /= tw * th;
  let v = 0;
  for (let k = 0; k < t.length; k++) {
    t[k] -= m;
    v += t[k] * t[k];
  }
  return { t, norma: Math.sqrt(v), desv: Math.sqrt(v / t.length), tw, th };
}

function ncc(f, T, x0, y0) {
  const { t, tw, th, norma } = T;
  let m = 0;
  for (let y = 0; y < th; y++) {
    const fila = (y0 + y) * f.w + x0;
    for (let x = 0; x < tw; x++) m += f.px[fila + x];
  }
  m /= tw * th;
  let num = 0;
  let v = 0;
  for (let y = 0; y < th; y++) {
    const fila = (y0 + y) * f.w + x0;
    for (let x = 0; x < tw; x++) {
      const d = f.px[fila + x] - m;
      num += d * t[y * tw + x];
      v += d * d;
    }
  }
  return v > 0 && norma > 0 ? num / (Math.sqrt(v) * norma) : 0;
}

function diferencia(a, b) {
  let s = 0;
  for (let k = 0; k < a.px.length; k += 3) s += Math.abs(a.px[k] - b.px[k]);
  return s / Math.ceil(a.px.length / 3);
}

/** Sigue la zona desde el cuadro k0 en una dirección (paso +1 / -1). Devuelve [{ k, x, y }] (esquina, en la grilla chica). */
function seguir(fs, k0, x0, y0, T0, paso) {
  const salida = [];
  let T = T0;
  let x = x0;
  let y = y0;
  const R = Math.max(3, Math.round(0.6 * Math.max(T.tw, T.th)));
  for (let k = k0 + paso; k >= 0 && k < fs.length; k += paso) {
    if (diferencia(fs[k], fs[k - paso]) > CAMBIO_DE_PLANO) return { salida, perdida: 'corte' };
    let mejor = -2;
    let bx = x;
    let by = y;
    const f = fs[k];
    for (let yy = Math.max(0, y - R); yy <= Math.min(f.h - T.th, y + R); yy++) {
      for (let xx = Math.max(0, x - R); xx <= Math.min(f.w - T.tw, x + R); xx++) {
        const c = ncc(f, T, xx, yy);
        if (c > mejor) {
          mejor = c;
          bx = xx;
          by = yy;
        }
      }
    }
    if (mejor < UMBRAL) return { salida, perdida: 'perdida' };
    x = bx;
    y = by;
    salida.push({ k, x, y });
    // se adapta de a poco (luz, giros suaves), solo cuando está seguro
    if (mejor > 0.75) {
      const nuevo = plantilla(f, x, y, T.tw, T.th);
      const t = new Float32Array(T.t.length);
      let v = 0;
      for (let i = 0; i < t.length; i++) {
        t[i] = 0.85 * T.t[i] + 0.15 * nuevo.t[i];
        v += t[i] * t[i];
      }
      T = { ...T, t, norma: Math.sqrt(v) };
    }
  }
  return { salida, perdida: null };
}

export async function seguirZona(video, { t, x, y, w, h, desde, hasta }) {
  const ini = Math.max(desde, t - 20);
  const fin = Math.min(hasta, t + 20);
  const lista = await cuadros(video, ini, fin - ini);
  const n = lista.length;
  if (!n) throw new Error('No pude leer esa parte del video.');
  const altoGrande = lista[0].alto;
  // la zona en la grilla de 160 px y cuánto se achica para buscarla rápido
  const bw = Math.max(4, w * ANCHO);
  const bh = Math.max(4, h * altoGrande);
  const s = Math.max(1, Math.ceil(Math.max(bw, bh) / MAX_LADO));
  const fs = lista.map((q) => achicar(q.px, 0, ANCHO, altoGrande, s));
  const W = fs[0].w;
  const H = fs[0].h;
  const tw = Math.max(3, Math.min(W, Math.round(bw / s)));
  const th = Math.max(3, Math.min(H, Math.round(bh / s)));
  const k0 = Math.max(0, Math.min(n - 1, Math.round((t - ini) * FPS)));
  const x0 = Math.max(0, Math.min(W - tw, Math.round((x * ANCHO) / s - tw / 2)));
  const y0 = Math.max(0, Math.min(H - th, Math.round((y * altoGrande) / s - th / 2)));
  const T = plantilla(fs[k0], x0, y0, tw, th);
  let puntos;
  let quieta = false;
  let perdida = null;
  if (T.desv < 4) {
    // casi sin dibujo (un fondo liso): no hay qué seguir; se queda quieta hasta el cambio de plano
    quieta = true;
    const quietos = [{ k: k0, x: x0, y: y0 }];
    for (let k = k0 + 1; k < n && diferencia(fs[k], fs[k - 1]) <= CAMBIO_DE_PLANO; k++) quietos.push({ k, x: x0, y: y0 });
    for (let k = k0 - 1; k >= 0 && diferencia(fs[k], fs[k + 1]) <= CAMBIO_DE_PLANO; k--) quietos.unshift({ k, x: x0, y: y0 });
    puntos = quietos;
  } else {
    const adelante = seguir(fs, k0, x0, y0, T, 1);
    const atras = seguir(fs, k0, x0, y0, T, -1);
    perdida = adelante.perdida || atras.perdida;
    puntos = [...atras.salida.reverse(), { k: k0, x: x0, y: y0 }, ...adelante.salida];
  }
  // suavizado (sin temblor) y a la forma de las pistas: [t, x, y, w, h] con el centro, de 0 a 1
  const r4 = (v) => Math.round(v * 10000) / 10000;
  const apariciones = puntos.map((p, i) => {
    const vecinos = puntos.slice(Math.max(0, i - 2), i + 3);
    const mx = vecinos.reduce((a, q) => a + q.x, 0) / vecinos.length;
    const my = vecinos.reduce((a, q) => a + q.y, 0) / vecinos.length;
    return [Math.round((ini + p.k / FPS) * 1000) / 1000, r4(((mx + tw / 2) * s) / ANCHO), r4(((my + th / 2) * s) / altoGrande), r4(w), r4(h)];
  });
  return { apariciones, quieta, perdida };
}

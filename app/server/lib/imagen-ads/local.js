// El carril LOCAL de los ANUNCIOS DE IMAGEN: lo que hace ffmpeg en la PC, gratis (ESPECIFICACION-imagen-ads.md §6.5 y
// §8). Siempre con execFile asincrono (no traba el servidor) y como mucho 2 a la vez en toda la app.
//
//   comprobarFfmpeg()                      { ok, bin, faltan } (el paso preparar, antes de pagar nada)
//   hacerRecortes(carpeta, pieza)          la vista (≤1280) y los 4 cuartos de 56 % (≤1568, en PNG) para la revision
//   hacerVista(carpeta, pieza)             solo la vista
//   componerLogo(carpeta, lote, pieza, brief)  final/<pieza>.png con el logo real pegado, y final/<pieza>.json
//   prepararLogo(carpeta, bytes)           el logo subido: PNG RGBA de 1024 px como mucho, recortado a lo que se ve
//   normalizarImagen(bytes, destino)       una referencia subida: 1600 px de lado como mucho (WEBP y GIF pasan a PNG)
//   medirPng(abs) · sha1DelLogo(carpeta) · enFilaDelLote(lote, fn)
//
// final/ tiene un solo escritor a la vez: todo lo que lo toca pasa por enFilaDelLote (la familia con el lote en marcha
// y las rutas con el lote quieto usan la misma fila, asi nunca se pisan).
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { RAIZ } from '../rutas.js';
import { geometriaLogo } from '../../../../produccion/imagen-ads.js';
import { R, firma, guardarJSON, sha1Archivo, formatoDe } from './disco.js';

// ---------------------------------------------------------------- ffmpeg

function ffmpegDeRemotion() {
  const dir = path.join(RAIZ, 'remotion', 'node_modules', '@remotion');
  try {
    for (const n of fs.readdirSync(dir).filter((x) => x.startsWith('compositor-'))) {
      const bin = path.join(dir, n, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
      if (fs.existsSync(bin)) return bin;
    }
  } catch {
    /* sin remotion */
  }
  return null;
}

function ejecutar(bin, args, { senal = null, timeout = 120000, maxBuffer = 8 * 1024 * 1024, binario = false } = {}) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout, windowsHide: true, maxBuffer, encoding: binario ? 'buffer' : 'utf8', ...(senal ? { signal: senal } : {}) }, (err, stdout, stderr) =>
      resolve({ ok: !err, err, stdout, stderr: String(stderr || '') })
    );
  });
}

const FILTROS = ['scale', 'crop', 'split', 'overlay'];
let cacheFfmpeg = null; // { bin, faltan }

/** El ffmpeg que usa esta seccion (el del PATH y, si no, el de Remotion) y si tiene los filtros que hacen falta. */
export async function comprobarFfmpeg({ otraVez = false } = {}) {
  if (cacheFfmpeg && !otraVez && !cacheFfmpeg.faltan.length) return { ok: true, ...cacheFfmpeg };
  let mejor = null;
  for (const bin of ['ffmpeg', ffmpegDeRemotion()].filter(Boolean)) {
    const r = await ejecutar(bin, ['-hide_banner', '-filters'], { timeout: 30000 });
    if (!r.ok) continue;
    const lista = String(r.stdout || '');
    const faltan = FILTROS.filter((f) => !new RegExp(`^\\s*\\S+\\s+${f}\\s`, 'm').test(lista));
    if (!faltan.length) {
      mejor = { bin, faltan };
      break;
    }
    mejor ||= { bin, faltan };
  }
  cacheFfmpeg = mejor || { bin: null, faltan: [...FILTROS] };
  return { ok: Boolean(cacheFfmpeg.bin) && !cacheFfmpeg.faltan.length, ...cacheFfmpeg };
}

async function binFfmpeg() {
  const c = await comprobarFfmpeg();
  if (!c.bin) throw new Error('No encuentro ffmpeg.');
  return c.bin;
}

// Como mucho 2 procesos de ffmpeg a la vez en toda la app (es la PC del alumno).
const A_LA_VEZ = 2;
let enCurso = 0;
const espera = [];
async function conTurno(fn) {
  if (enCurso >= A_LA_VEZ) await new Promise((r) => espera.push(r));
  enCurso++;
  try {
    return await fn();
  } finally {
    enCurso--;
    espera.shift()?.();
  }
}

async function ffmpeg(args, opciones = {}) {
  const bin = await binFfmpeg();
  return conTurno(() => ejecutar(bin, ['-hide_banner', '-loglevel', 'error', '-y', ...args], opciones));
}

/** Renombra el temporal sobre el final (en Windows, con reintentos si alguien lo tiene abierto un instante). */
async function renombrar(tmp, final) {
  for (let i = 0; ; i++) {
    try {
      fs.renameSync(tmp, final);
      return;
    } catch (e) {
      if (i >= 8 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) {
        fs.rmSync(tmp, { force: true });
        throw e;
      }
      await new Promise((r) => setTimeout(r, 40 * (i + 1)));
    }
  }
}

const tmpDe = (ruta) => {
  const ext = path.extname(ruta);
  return `${ruta.slice(0, -ext.length)}.${process.pid}.tmp${ext}`;
};

// ---------------------------------------------------------------- medidas

/** Ancho y alto de un PNG por su cabecera (IHDR, bytes 16 a 23), sin abrir la imagen entera. null si no es PNG. */
export function medirPng(abs) {
  let fd;
  try {
    fd = fs.openSync(abs, 'r');
    const b = Buffer.alloc(24);
    fs.readSync(fd, b, 0, 24, 0);
    if (b[0] !== 0x89 || b.slice(1, 4).toString('latin1') !== 'PNG' || b.slice(12, 16).toString('latin1') !== 'IHDR') return null;
    return { ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20) };
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

// ---------------------------------------------------------------- vista y recortes (para la revision)

const ESCALA_VISTA = "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))':flags=lanczos";
const ESCALA_RECORTE = "scale='if(gt(iw,ih),min(1568,iw),-2)':'if(gt(iw,ih),-2,min(1568,ih))':flags=lanczos";

/**
 * La vista entera (1280 px de lado como mucho) y los 4 cuartos de 56 % que se solapan (sin achicar, salvo que pasen de
 * 1568 px: el modelo los reduciria y borraria letras), en PNG para no perder tildes. Todo en un solo proceso. Al
 * final escribe revision/<pieza>.firma con la firma de la imagen que se corto. Devuelve esa firma (o null).
 */
export async function hacerRecortes(carpeta, pieza, { senal = null } = {}) {
  const origen = R.img(carpeta, pieza);
  const f = firma(origen);
  if (!f) return null;
  fs.mkdirSync(R.dirRevision(carpeta), { recursive: true });
  fs.rmSync(R.firmaRecortes(carpeta, pieza), { force: true });
  const salidas = [R.vista(carpeta, pieza), ...[1, 2, 3, 4].map((i) => R.recorte(carpeta, pieza, i))];
  const tmps = salidas.map(tmpDe);
  const grafo = [
    '[0]split=5[v][a][b][c][d]',
    `[v]${ESCALA_VISTA}[vo]`,
    `[a]crop=w=iw*0.56:h=ih*0.56:x=0:y=0,${ESCALA_RECORTE}[o1]`,
    `[b]crop=w=iw*0.56:h=ih*0.56:x=iw-ow:y=0,${ESCALA_RECORTE}[o2]`,
    `[c]crop=w=iw*0.56:h=ih*0.56:x=0:y=ih-oh,${ESCALA_RECORTE}[o3]`,
    `[d]crop=w=iw*0.56:h=ih*0.56:x=iw-ow:y=ih-oh,${ESCALA_RECORTE}[o4]`,
  ].join(';');
  const args = ['-i', origen, '-filter_complex', grafo, '-map', '[vo]', '-frames:v', '1', '-update', '1', '-q:v', '2', tmps[0]];
  for (let i = 1; i <= 4; i++) args.push('-map', `[o${i}]`, '-frames:v', '1', '-update', '1', tmps[i]);
  const r = await ffmpeg(args, { senal });
  if (!r.ok || tmps.some((t) => !fs.existsSync(t))) {
    for (const t of tmps) fs.rmSync(t, { force: true });
    if (senal?.aborted) return null;
    throw new Error(`No pude preparar la revisión de ${pieza}: ${r.stderr.trim().split('\n').slice(-2).join(' ') || r.err?.message || ''}`);
  }
  for (let i = 0; i < salidas.length; i++) await renombrar(tmps[i], salidas[i]);
  // la imagen pudo cambiar mientras se cortaba: la firma es la de antes (si cambio, se cortara otra vez)
  fs.writeFileSync(R.firmaRecortes(carpeta, pieza), f, 'utf8');
  return f;
}

/** Solo la vista (la de un cuadrado que hace falta para revisar su vertical, o para un ajuste). */
export async function hacerVista(carpeta, pieza, { senal = null } = {}) {
  const origen = R.img(carpeta, pieza);
  if (!firma(origen)) return false;
  fs.mkdirSync(R.dirRevision(carpeta), { recursive: true });
  const destino = R.vista(carpeta, pieza);
  const tmp = tmpDe(destino);
  const r = await ffmpeg(['-i', origen, '-vf', ESCALA_VISTA, '-frames:v', '1', '-update', '1', '-q:v', '2', tmp], { senal });
  if (!r.ok || !fs.existsSync(tmp)) {
    fs.rmSync(tmp, { force: true });
    if (senal?.aborted) return false;
    throw new Error(`No pude preparar la vista de ${pieza}.`);
  }
  await renombrar(tmp, destino);
  return true;
}

/** Los recortes de una pieza ya revisada (la vista queda: la usa la revision de su vertical). */
export function borrarRecortes(carpeta, pieza) {
  for (let i = 1; i <= 4; i++) fs.rmSync(R.recorte(carpeta, pieza, i), { force: true });
  fs.rmSync(R.firmaRecortes(carpeta, pieza), { force: true });
}

/** La firma de los recortes listos de una pieza (los 4 cuartos y la vista en su lugar), o null. */
export function firmaDeRecortes(carpeta, pieza) {
  let f = null;
  try {
    f = fs.readFileSync(R.firmaRecortes(carpeta, pieza), 'utf8').trim();
  } catch {
    return null;
  }
  if (!fs.existsSync(R.vista(carpeta, pieza))) return null;
  for (let i = 1; i <= 4; i++) if (!fs.existsSync(R.recorte(carpeta, pieza, i))) return null;
  return f || null;
}

// ---------------------------------------------------------------- el logo

const filas = new Map(); // lote -> promesa: lo que escribe en final/, de a uno
/** Corre `fn` cuando termina lo anterior del mismo lote que toca final/ (un solo escritor a la vez). */
export function enFilaDelLote(lote, fn) {
  const antes = filas.get(lote) || Promise.resolve();
  const ahora = antes.catch(() => {}).then(fn);
  const cola = ahora.catch(() => {});
  filas.set(lote, cola);
  cola.then(() => {
    if (filas.get(lote) === cola) filas.delete(lote);
  });
  return ahora;
}

const cacheSha = new Map(); // ruta -> { firma, sha }
/** El sha1 del logo del lote (con cache por tamaño y fecha), o null si no tiene. */
export function sha1DelLogo(carpeta) {
  const ruta = R.logo(carpeta);
  const f = firma(ruta);
  if (!f) return null;
  const c = cacheSha.get(ruta);
  if (c?.firma === f) return c.sha;
  const sha = sha1Archivo(ruta);
  cacheSha.set(ruta, { firma: f, sha });
  return sha;
}

/** ¿final/<pieza> esta al dia (misma imagen, mismo logo, misma posicion)? */
export function finalAlDia(carpeta, pieza, { posicion, shaLogo = sha1DelLogo(carpeta) } = {}) {
  if (!shaLogo) return false;
  const j = (() => {
    try {
      return JSON.parse(fs.readFileSync(R.finalJson(carpeta, pieza), 'utf8'));
    } catch {
      return null;
    }
  })();
  return Boolean(j) && j.firmaImagen === firma(R.img(carpeta, pieza)) && j.sha1Logo === shaLogo && (!posicion || j.posicion === posicion) && fs.existsSync(R.final(carpeta, pieza));
}

/**
 * Pega el logo real sobre img/<pieza>.png (sin tocarla) y deja final/<pieza>.png y final/<pieza>.json. La medida y el
 * lugar salen de geometriaLogo (la misma cuenta que reservo la zona en el prompt): en el 9:16, dentro de la zona segura.
 */
export function componerLogo(carpeta, lote, pieza, brief, { senal = null } = {}) {
  return enFilaDelLote(lote, async () => {
    const origen = R.img(carpeta, pieza);
    const logo = R.logo(carpeta);
    const posicion = brief?.logo?.posicion;
    const fImg = firma(origen);
    const shaLogo = sha1DelLogo(carpeta);
    if (!fImg || !shaLogo || !posicion) return false;
    if (finalAlDia(carpeta, pieza, { posicion, shaLogo })) return true;
    const lienzo = medirPng(origen);
    const lg = medirPng(logo);
    if (!lienzo || !lg) throw new Error(`No pude medir la imagen o el logo de ${pieza}.`);
    const g = geometriaLogo({ W: lienzo.ancho, H: lienzo.alto, formato: formatoDe(pieza), posicion, lw: lg.ancho, lh: lg.alto });
    fs.mkdirSync(R.dirFinal(carpeta), { recursive: true });
    const destino = R.final(carpeta, pieza);
    const tmp = tmpDe(destino);
    const r = await ffmpeg(['-i', origen, '-i', logo, '-filter_complex', `[1]scale=${g.ancho}:${g.alto}:flags=lanczos[l];[0][l]overlay=${g.x}:${g.y}:format=auto`, '-frames:v', '1', '-update', '1', tmp], { senal });
    if (!r.ok || !fs.existsSync(tmp)) {
      fs.rmSync(tmp, { force: true });
      if (senal?.aborted) return false;
      throw new Error(`No pude poner el logo en ${pieza}: ${r.stderr.trim().split('\n').slice(-2).join(' ')}`);
    }
    await renombrar(tmp, destino);
    guardarJSON(R.finalJson(carpeta, pieza), { firmaImagen: fImg, sha1Logo: shaLogo, posicion, x: g.x, y: g.y, ancho: g.ancho, alto: g.alto });
    return true;
  });
}

/** Quita final/ entero (el usuario saco el logo): pasa por la misma fila que el pegado. */
export function quitarFinales(carpeta, lote) {
  return enFilaDelLote(lote, async () => {
    fs.rmSync(R.dirFinal(carpeta), { recursive: true, force: true });
  });
}

/**
 * El logo que subio el usuario: ffmpeg lo pasa a PNG RGBA de 1024 px como mucho, se leen sus pixeles y se recorta al
 * recuadro de lo que se ve (alfa > 16). Queda entrada/logo.png y entrada/logo.json = { ancho, alto, transparente }.
 */
export async function prepararLogo(carpeta, bytes, ext) {
  const dir = R.entrada(carpeta);
  fs.mkdirSync(dir, { recursive: true });
  const subida = path.join(dir, `.logo-subida-${process.pid}.${ext}`);
  const medio = path.join(dir, `.logo-1024-${process.pid}.png`);
  const destino = R.logo(carpeta);
  const tmp = tmpDe(destino);
  fs.writeFileSync(subida, bytes);
  try {
    let r = await ffmpeg(['-i', subida, '-frames:v', '1', '-vf', "scale='if(gt(iw,ih),min(1024,iw),-2)':'if(gt(iw,ih),-2,min(1024,ih))':flags=lanczos,format=rgba", '-pix_fmt', 'rgba', '-update', '1', medio]);
    const tam = r.ok ? medirPng(medio) : null;
    if (!tam) throw Object.assign(new Error('No pude abrir tu logo. Guárdalo como PNG y súbelo otra vez.'), { status: 400 });
    const bin = await binFfmpeg();
    r = await conTurno(() => ejecutar(bin, ['-hide_banner', '-loglevel', 'error', '-i', medio, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { binario: true, maxBuffer: tam.ancho * tam.alto * 4 + 1024 }));
    const px = Buffer.isBuffer(r.stdout) ? r.stdout : null;
    if (!r.ok || !px || px.length < tam.ancho * tam.alto * 4) throw Object.assign(new Error('No pude leer tu logo. Guárdalo como PNG y súbelo otra vez.'), { status: 400 });
    let x0 = tam.ancho;
    let y0 = tam.alto;
    let x1 = -1;
    let y1 = -1;
    let transparente = false;
    for (let y = 0; y < tam.alto; y++) {
      for (let x = 0; x < tam.ancho; x++) {
        const a = px[(y * tam.ancho + x) * 4 + 3];
        if (a < 250) transparente = true;
        if (a > 16) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) throw Object.assign(new Error('Tu logo se ve vacío (es todo transparente). Sube otro archivo.'), { status: 400 });
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    r = await ffmpeg(['-i', medio, '-vf', `crop=${w}:${h}:${x0}:${y0},format=rgba`, '-pix_fmt', 'rgba', '-frames:v', '1', '-update', '1', tmp]);
    if (!r.ok || !fs.existsSync(tmp)) throw Object.assign(new Error('No pude preparar tu logo. Guárdalo como PNG y súbelo otra vez.'), { status: 400 });
    await renombrar(tmp, destino);
    const info = { ancho: w, alto: h, transparente };
    guardarJSON(R.logoJson(carpeta), info);
    return info;
  } finally {
    for (const f of [subida, medio, tmp]) fs.rmSync(f, { force: true });
  }
}

/**
 * Una imagen subida (una referencia): 1600 px de lado como mucho (Claude Code no abre mas de 2000). JPG queda JPG; PNG,
 * WEBP y GIF pasan a PNG (pueden tener transparencia); lo demas, a JPG. `destinoSinExt`: la ruta sin la extension.
 * Devuelve la ruta final.
 */
export async function normalizarImagen(bytes, destinoSinExt, formato) {
  const ext = ['png', 'webp', 'gif'].includes(formato) ? 'png' : 'jpg';
  const dir = path.dirname(destinoSinExt);
  fs.mkdirSync(dir, { recursive: true });
  const subida = path.join(dir, `.subida-${process.pid}-${Date.now()}.${formato || 'bin'}`);
  const destino = `${destinoSinExt}.${ext}`;
  const tmp = tmpDe(destino);
  fs.writeFileSync(subida, bytes);
  try {
    const escala = "scale='if(gt(iw,ih),min(1600,iw),-2)':'if(gt(iw,ih),-2,min(1600,ih))':flags=lanczos";
    const r = await ffmpeg(['-i', subida, '-frames:v', '1', '-vf', escala, ...(ext === 'jpg' ? ['-q:v', '2'] : []), '-update', '1', tmp]);
    if (!r.ok || !fs.existsSync(tmp)) {
      throw Object.assign(new Error(formato === 'heic' || formato === 'avif' ? 'Esa imagen está en un formato de iPhone que no puedo abrir. Guárdala como JPG y súbela otra vez.' : 'No pude abrir esa imagen. Guárdala como JPG o PNG y súbela otra vez.'), { status: 400 });
    }
    for (const e of ['png', 'jpg', 'jpeg', 'webp']) if (e !== ext) fs.rmSync(`${destinoSinExt}.${e}`, { force: true });
    await renombrar(tmp, destino);
    return destino;
  } finally {
    fs.rmSync(subida, { force: true });
    fs.rmSync(tmp, { force: true });
  }
}

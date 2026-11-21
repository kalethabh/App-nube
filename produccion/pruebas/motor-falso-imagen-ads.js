// Un motor FALSO de los anuncios de imagen, para probar la app sin red y sin el motor de verdad (lo usa solo
// app/herramientas/probar-imagen-ads.mjs, con ANUNCIOS_MOTOR_IMAGEN_ADS=pruebas/motor-falso-imagen-ads.js). Cumple el
// contrato de produccion/generar-imagen-ads.js (ESPECIFICACION-imagen-ads.md §5.2): lee las ordenes
// app/imagen-ads/motor/T###.json, escribe T###.resultado.json, img/, prompts/, nuevas/, versiones/ e img/log-modelos.json
// en el mismo orden, y sale con 0 cuando lleva un rato sin trabajo. Las imagenes son PNG de verdad (un color liso por
// pieza y version), hechos aca sin ffmpeg. Nunca llama a nadie.
//
//   node produccion/pruebas/motor-falso-imagen-ads.js temp/<lote> [--ociosa 2]
//   MOTOR_FALSO_MS=50              lo que tarda cada imagen
//   MOTOR_FALSO_SIN_IMAGEN=V02_1x1 esas piezas quedan sin imagen (3 intentos, motivo contenido)
//   MOTOR_FALSO_CODIGO=1           sale con ese codigo apenas arranca (para probar los fallos del motor)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { construirPrompt, construirPromptVertical, construirPromptEdicion, MENSAJES_SIN_IMAGEN } from '../imagen-ads.js';

const args = process.argv.slice(2);
const carpeta = path.resolve(args.find((a) => !a.startsWith('--')) || '.');
const iOciosa = args.indexOf('--ociosa');
const OCIOSA_MS = (iOciosa >= 0 ? Number(args[iOciosa + 1]) : Number(process.env.MOTOR_FALSO_OCIOSA) || 2) * 1000;
const MS = Number(process.env.MOTOR_FALSO_MS) || 50;
const SIN_IMAGEN = new Set(String(process.env.MOTOR_FALSO_SIN_IMAGEN || '').split(',').map((s) => s.trim()).filter(Boolean));
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const leer = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
};
const escribir = (f, v) => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, typeof v === 'string' || Buffer.isBuffer(v) ? v : JSON.stringify(v, null, 2) + '\n');
  fs.renameSync(tmp, f);
};


// ---------------------------------------------------------------- un PNG de un color

const TABLA = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function png(ancho, alto, [r, g, b]) {
  const trozo = (tipo, datos) => {
    const t = Buffer.from(tipo, 'ascii');
    const l = Buffer.alloc(4);
    l.writeUInt32BE(datos.length);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(Buffer.concat([t, datos])));
    return Buffer.concat([l, t, datos, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const fila = Buffer.alloc(1 + ancho * 3);
  for (let x = 0; x < ancho; x++) {
    const franja = Math.floor((x / ancho) * 4) % 2 === 0;
    fila[1 + x * 3] = franja ? r : 255 - r;
    fila[2 + x * 3] = g;
    fila[3 + x * 3] = b;
  }
  const crudo = Buffer.concat(Array.from({ length: alto }, () => fila));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), trozo('IHDR', ihdr), trozo('IDAT', zlib.deflateSync(crudo)), trozo('IEND', Buffer.alloc(0))]);
}
const colorDe = (texto) => {
  const h = crypto.createHash('sha1').update(texto).digest();
  return [h[0], h[1], h[2]];
};

// ---------------------------------------------------------------- el motor

async function principal() {
  const lote = leer(path.join(carpeta, 'lote.json'));
  if (!lote) {
    console.log(`  Falta lote.json en ${carpeta}`);
    process.exitCode = 2;
    return;
  }
  const dirOrdenes = path.join(carpeta, 'app', 'imagen-ads', 'motor');
  const log = { generado: new Date().toISOString(), segundos: 0, imagenes: [] };
  const t0 = Date.now();
  let ociosoDesde = Date.now();
  let hechas = 0;
  for (;;) {
    const ordenes = (fs.existsSync(dirOrdenes) ? fs.readdirSync(dirOrdenes) : []).filter((n) => /^T\d+\.json$/.test(n)).sort();
    let trabajo = false;
    for (const n of ordenes) {
      const orden = leer(path.join(dirOrdenes, n));
      if (!orden?.piezas) continue;
      const rutaRes = path.join(dirOrdenes, n.replace(/\.json$/, '.resultado.json'));
      const res = leer(rutaRes) || { id: orden.id, actualizado: null, terminado: false, piezas: {} };
      if (res.terminado) continue;
      for (const x of orden.piezas) {
        const r = res.piezas[x.pieza];
        if (r && r.orden === x.orden && ['lista', 'sin-imagen'].includes(r.estado)) continue;
        trabajo = true;
        res.piezas[x.pieza] = hacerPieza(x, lote, log);
        hechas++;
        res.actualizado = new Date().toISOString();
        escribir(rutaRes, res);
        log.generado = new Date().toISOString();
        log.segundos = Math.round((Date.now() - t0) / 1000);
        escribir(path.join(carpeta, 'img', 'log-modelos.json'), log);
        await dormir(MS);
      }
      res.terminado = orden.piezas.every((x) => ['lista', 'sin-imagen'].includes(res.piezas[x.pieza]?.estado) && res.piezas[x.pieza]?.orden === x.orden);
      res.actualizado = new Date().toISOString();
      escribir(rutaRes, res);
    }
    if (trabajo) ociosoDesde = Date.now();
    else if (Date.now() - ociosoDesde > OCIOSA_MS) break;
    await dormir(200);
  }
  console.log(`  Listo en ${Math.round((Date.now() - t0) / 1000)} s: ${hechas} hechas.`);
  process.exitCode = 0;
}

function hacerPieza(x, lote, log) {
  const v = x.pieza.split('_')[0];
  const vertical = x.pieza.endsWith('_9x16');
  const ad = leer(path.join(carpeta, `${v}.json`));
  const img = path.join(carpeta, 'img', `${x.pieza}.png`);
  const base = { orden: x.orden, version: x.version, intentosApi: 1, modeloReal: 'gpt-image-2-5-sunburst-image-to-image', creditos: 10, taskId: `falso-${crypto.randomBytes(4).toString('hex')}` };
  if (!ad) return { ...base, estado: 'sin-imagen', motivo: 'pedido-invalido', mensaje: MENSAJES_SIN_IMAGEN['pedido-invalido'], creditos: 0 };
  if (x.orden === 'g' && fs.existsSync(img)) return { ...base, estado: 'lista', firma: firma(img), creditos: 0 };
  if (vertical && !fs.existsSync(path.join(carpeta, 'img', `${v}_1x1.png`))) return { ...base, estado: 'sin-imagen', motivo: 'falta-cuadrado', mensaje: MENSAJES_SIN_IMAGEN['falta-cuadrado'], creditos: 0 };
  if (SIN_IMAGEN.has(x.pieza)) return { ...base, estado: 'sin-imagen', intentosApi: 3, motivo: 'contenido', mensaje: MENSAJES_SIN_IMAGEN.contenido, creditos: 0 };
  // (2026-11-21h) un anuncio con la marca SIM-PROHIBIDO lo rechaza «el filtro» (como kie con su política de contenido)
  if (JSON.stringify(ad).includes('SIM-PROHIBIDO')) return { ...base, estado: 'sin-imagen', intentosApi: 3, motivo: 'contenido', mensaje: MENSAJES_SIN_IMAGEN.contenido, creditos: 0 };
  const logo = lote.logo || null;
  const prompt =
    x.modo === 'editar'
      ? construirPromptEdicion(ad, { instruccion: x.instruccion_en, formato: vertical ? '9:16' : '1:1', textos: Boolean(x.textos), logo })
      : vertical
        ? construirPromptVertical(ad, { conProducto: true, logo })
        : construirPrompt(ad, { logo });
  const imagen = png(vertical ? 288 : 512, 512, colorDe(`${x.pieza}|${x.version}|${x.orden}`));
  const registro = { id: x.pieza, archivo: `${x.pieza}.png`, modelo: base.modeloReal, respaldo: false, intentos: 1, referencias: vertical ? 2 : 1, creditos: 10, taskId: base.taskId };
  if (x.orden === 'g') {
    escribir(path.join(carpeta, 'prompts', `${x.pieza}.txt`), prompt);
    escribir(img, imagen);
  } else {
    // rehacer: (a) la anotacion, (b) el indice, (c) la de antes a versiones/, (d) la nueva a img/, (e) borrar la anotacion
    const nuevas = path.join(carpeta, 'nuevas');
    escribir(path.join(nuevas, `${x.pieza}.txt`), prompt);
    escribir(path.join(nuevas, `${x.pieza}.png`), imagen);
    escribir(path.join(nuevas, `${x.pieza}.json`), { orden: x.orden, huella: 'falsa', creditos: 10, taskId: base.taskId, modeloReal: base.modeloReal });
    const rutaIndice = path.join(carpeta, 'versiones', 'indice.json');
    const indice = leer(rutaIndice) || { piezas: {} };
    const n = Math.max(1, (Number(x.version) || 2) - 1);
    const lista = (indice.piezas[x.pieza] ||= []);
    if (!lista.some((e) => e.reemplazadaPor === x.orden)) {
      lista.push({ n, archivo: `versiones/${x.pieza}.v${n}.png`, prompt: `versiones/${x.pieza}.v${n}.txt`, reemplazadaPor: x.orden, motivo: x.motivo || (String(x.orden).startsWith('U') ? 'pedido' : 'revision'), fecha: new Date().toISOString() });
      escribir(rutaIndice, indice);
    }
    fs.mkdirSync(path.join(carpeta, 'versiones'), { recursive: true });
    if (fs.existsSync(img)) fs.renameSync(img, path.join(carpeta, 'versiones', `${x.pieza}.v${n}.png`));
    const txt = path.join(carpeta, 'prompts', `${x.pieza}.txt`);
    if (fs.existsSync(txt)) fs.renameSync(txt, path.join(carpeta, 'versiones', `${x.pieza}.v${n}.txt`));
    fs.mkdirSync(path.dirname(img), { recursive: true });
    fs.mkdirSync(path.dirname(txt), { recursive: true });
    fs.renameSync(path.join(nuevas, `${x.pieza}.png`), img);
    fs.renameSync(path.join(nuevas, `${x.pieza}.txt`), txt);
    fs.rmSync(path.join(nuevas, `${x.pieza}.json`), { force: true });
  }
  log.imagenes.push(registro);
  console.log(`  OK  ${x.pieza} — 10 cr`);
  return { ...base, estado: 'lista', firma: firma(img) };
}

function firma(abs) {
  try {
    const st = fs.statSync(abs);
    return `${st.size}-${Math.round(st.mtimeMs)}`;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- arranque (al final: lo de arriba ya esta definido)
if (process.env.MOTOR_FALSO_CODIGO) {
  console.log('  (motor falso) algo raro paso adentro');
  process.exitCode = Number(process.env.MOTOR_FALSO_CODIGO);
} else {
  await principal();
}

// Las imágenes de los VIDEOS con la suscripción de ChatGPT (2026-11-16), sin gastar nada:
// un ChatGPT simulado (un «codex» falso que deja una imagen o contesta «usage limit») y el kie.ai simulado.
//
//   node --test produccion/pruebas/probar-imagenes-chatgpt.js
//
// Comprueba en generarConCascada (generar-imagenes.js):
//   - con ChatGPT bien: la imagen sale de ChatGPT, 0 créditos, y kie no recibe ningún pedido;
//   - ChatGPT llega al límite: esa imagen y las siguientes van con kie (se cobran) y la corrida no se frena;
//   - un icono (fondo transparente) va siempre con kie;
//   - sin ChatGPT elegido: todo con kie, como siempre.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'imagenes-chatgpt-'));
const sim = await (await import('./kie-simulado.js')).iniciar({ escala: 0.005, dirCache: path.join(tmp, 'cache') });
process.env.KIE_BASE_URL = sim.url;
process.env.KIE_BASE_ARCHIVOS_URL = sim.url;
process.env.KIE_API_KEY = 'clave-falsa-de-prueba-0000';
const { generarConCascada, chatgptDeLaCorrida } = await import('../generar-imagenes.js');
const { KIE } = await import('../config.js');
assert.equal(KIE.base, sim.url, 'la prueba tiene que ir al kie simulado');

// el «codex» falso: lee el mensaje, deja un PNG 9:16 en <home>/generated_images/<hilo>/ y contesta su ruta
const falso = path.join(tmp, 'codex-falso.mjs');
fs.writeFileSync(falso, `
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
let entrada = ''; process.stdin.on('data', (d) => (entrada += d)); process.stdin.on('end', () => {
  const hilo = 'hilo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  console.log(JSON.stringify({ type: 'thread.started', thread_id: hilo }));
  if (fs.existsSync(path.join(process.env.CODEX_HOME, 'LIMITE'))) {
    console.log(JSON.stringify({ type: 'error', message: "You've hit your usage limit. Try again in 3 hours." }));
    return;
  }
  // un PNG mínimo de 9x16 (1 pixel por celda) válido
  const ancho = 9, alto = 16, filas = [];
  for (let y = 0; y < alto; y++) filas.push(Buffer.concat([Buffer.from([0]), Buffer.alloc(ancho * 3, 120)]));
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const trozo = (tipo, datos) => { const l = Buffer.alloc(4); l.writeUInt32BE(datos.length); const td = Buffer.concat([Buffer.from(tipo), datos]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(ancho, 0); ihdr.writeUInt32BE(alto, 4); ihdr[8] = 8; ihdr[9] = 2;
  const png = Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), trozo('IHDR', ihdr), trozo('IDAT', zlib.deflateSync(Buffer.concat(filas))), trozo('IEND', Buffer.alloc(0))]);
  const dir = path.join(process.env.CODEX_HOME, 'generated_images', hilo); fs.mkdirSync(dir, { recursive: true });
  const ruta = path.join(dir, 'img.png'); fs.writeFileSync(ruta, png);
  console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: ruta } }));
});`);
const home = path.join(tmp, 'codex-home');
fs.mkdirSync(home, { recursive: true });
const codex = { cmd: process.execPath, pre: [falso], home, trabajo: path.join(tmp, 'codex-trabajo') };

test.after(async () => {
  await sim.cerrar();
  fs.rmSync(tmp, { recursive: true, force: true });
});

let n = 0;
function caso({ chatgpt = codex } = {}) {
  const dirImg = path.join(tmp, `anuncio-${++n}`, 'img');
  fs.mkdirSync(dirImg, { recursive: true });
  const ctx = { carpeta: path.dirname(dirImg), carpetaArg: 'temp/x', dirImg, aspectRatio: '9:16', urlsPorId: new Map(), urlsDeReferencias: new Map(), archivosDeReferencias: new Map(), anteriorDe: new Map(), sha1s: new Map(), hojasListas: new Set(), chatgpt, chatgptCaido: null };
  const trabajo = (id, extra = {}) => ({ id, archivo: `${id}.png`, descripcion: id, clase: 'toma', prompt: 'a skeleton drinking coffee, cinematic', referencias: [], cascada: ['gpt-image-2-5-sunburst', 'nano-banana-2'], ...extra });
  return { ctx, trabajo, log: [] };
}
const tareasKie = () => sim.tareas().length;

test('con ChatGPT: la imagen sale de ChatGPT, 0 créditos y sin pedidos a kie', async () => {
  const { ctx, trabajo, log } = caso();
  const antes = tareasKie();
  const r = await generarConCascada(trabajo('toma-1-inicial'), ctx, log);
  assert.ok(fs.existsSync(r.ruta));
  assert.equal(log[0].chatgpt, true);
  assert.equal(log[0].creditos, 0);
  assert.equal(tareasKie(), antes, 'kie no tenía que recibir ningún pedido');
});

test('ChatGPT llega al límite: esa y las siguientes van con kie, y la corrida sigue', async () => {
  fs.writeFileSync(path.join(home, 'LIMITE'), '1');
  try {
    const { ctx, trabajo, log } = caso();
    const antes = tareasKie();
    const r1 = await generarConCascada(trabajo('toma-1-inicial'), ctx, log);
    assert.equal(ctx.chatgptCaido, 'limite');
    const r2 = await generarConCascada(trabajo('toma-2-inicial'), ctx, log);
    assert.ok(fs.existsSync(r1.ruta) && fs.existsSync(r2.ruta));
    assert.equal(tareasKie() - antes, 2, 'las dos con kie');
    assert.ok(log.every((x) => !x.chatgpt && x.creditos > 0));
  } finally {
    fs.rmSync(path.join(home, 'LIMITE'), { force: true });
  }
});

test('un icono (fondo transparente) va siempre con kie', async () => {
  const { ctx, trabajo, log } = caso();
  const antes = tareasKie();
  await generarConCascada(trabajo('icono-1', { clase: 'icono', fondo: 'transparent', cascada: ['gpt-image-2'], aspectRatio: '1:1' }), ctx, log);
  assert.equal(tareasKie() - antes, 1);
  assert.ok(!log[0].chatgpt);
});

test('sin ChatGPT elegido: todo con kie, como siempre', async () => {
  const { ctx, trabajo, log } = caso({ chatgpt: null });
  const antes = tareasKie();
  await generarConCascada(trabajo('toma-1-inicial'), ctx, log);
  assert.equal(tareasKie() - antes, 1);
  assert.equal(chatgptDeLaCorrida({}), null);
  assert.equal(chatgptDeLaCorrida({ AIA_IMAGENES_VIDEO: 'chatgpt', AIA_CHATGPT_IMAGENES: JSON.stringify(codex) })?.home, home);
});

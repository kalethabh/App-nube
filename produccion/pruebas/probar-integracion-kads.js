// Regresiones de la integracion Kads: sin red, claves ni generaciones pagadas.
// node --test produccion/pruebas/probar-integracion-kads.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { costoImagenes, costoDePiezas } from '../estimar-costo.js';
import { clipsDe } from '../estimar-video.js';
import { construirPlan as planImagenes } from '../generar-imagenes.js';
import { normalizarClip } from '../generar-videos.js';
import { creditosClip, RESOLUCION_VIDEO, ESCALA_RENDER } from '../config.js';
import { regenerarBrollTalCual, ponerVideoPropio, volverAlClipOriginal } from '../rehacer-toma.js';
import { completarEdicion, planAjustado, queSePuedeConElClip, capasDeEdicion } from '../../remotion/src/edicion/capas.mjs';

const anuncio = () => ({
  estilo: 'claymation', modo_audio: 'voz_en_off', referencias: [],
  tomas: [
    { n: 1, tipo: 'A', duracion: 4, prompt_imagen_inicial: 'Mismo producto en fondo verde', referencias: [], prompt_video: 'Plano quieto del producto', quieto: true },
    { n: 2, tipo: 'A', duracion: 4, prompt_imagen_inicial: 'Mismo producto en fondo verde', referencias: [], prompt_video: 'La camara se acerca' },
    { n: 3, tipo: 'A', duracion: 4, prompt_imagen_inicial: 'Imagen del clip de biblioteca', referencias: [], desde_biblioteca: 'mis_archivos/biblioteca/clips/prueba.mp4' },
  ],
  broll: [{ n: 1, despues_de_toma: 2, duracion: 3, prompt_imagen: 'Imagen de apoyo', referencias: [], quieto: true }],
});

test('el costo del anuncio descuenta imagenes repetidas, clips quietos y biblioteca', () => {
  const m = anuncio();
  assert.equal(costoImagenes(m).creditos, 20); // una imagen compartida + apoyo
  assert.deepEqual(clipsDe(m).map((c) => c.id), ['toma-2']);
  const p = costoDePiezas({ manifiesto: m });
  assert.equal(p.piezas['toma-1'].clip.creditos, 0);
  assert.equal(p.piezas['toma-1'].imagen.creditos, 10); // regenerar una imagen suelta si cobra
  assert.equal(p.piezas['toma-3'], undefined); // desde biblioteca: no se genera nada
  // 4 s con Omni Flash 1.2, que cobra por segundo (720p: 36; 1080p: 40; el 1.1 cobraba 63 en las dos)
  assert.equal(p.piezas['toma-2'].clip.creditos, creditosClip('google/gemini-omni-flash-1-2', 4, RESOLUCION_VIDEO).creditos);
  assert.equal(p.piezas['toma-2'].clip.creditos, RESOLUCION_VIDEO === '1080p' ? 40 : 36);
});

test('los fotogramas de subestilo siguen en el plan al cambiar de modelo', () => {
  const m = anuncio();
  m.tomas[0].fotograma = 'recursos/subestilos/referencia.png';
  const t = planImagenes(m, { eleccion: { imagen: 'nb21' } }).find((x) => x.id === 'toma-1-inicial');
  assert.equal(t.fotograma, m.tomas[0].fotograma);
  assert.deepEqual(t.cascada, ['nano-banana-2-1', 'nano-banana-2']);
});

test('Grok con referencias mantiene una resolucion aceptada y su precio coincide', () => {
  const c = creditosClip('grok-imagine/image-to-video', 10, '1080p');
  assert.equal(c.resolucion.api, '720p');
  assert.equal(c.creditos, 45);
  assert.equal(ESCALA_RENDER, RESOLUCION_VIDEO === '1080p' ? 1.5 : 1);
});

test('regenerar solo el clip conserva la imagen y todas las versiones anteriores', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'kads-regenerar-'));
  try {
    fs.mkdirSync(path.join(d, 'video'));
    fs.mkdirSync(path.join(d, 'img'));
    fs.writeFileSync(path.join(d, 'manifiesto.json'), JSON.stringify(anuncio()));
    fs.writeFileSync(path.join(d, 'img', 'broll-1.png'), 'imagen pagada');
    const clip = path.join(d, 'video', 'broll-1.mp4');
    fs.writeFileSync(clip, 'version uno');
    regenerarBrollTalCual(d, 1);
    fs.writeFileSync(clip, 'version dos');
    regenerarBrollTalCual(d, 1);
    assert.equal(fs.readFileSync(path.join(d, 'img', 'broll-1.png'), 'utf8'), 'imagen pagada');
    const versiones = fs.readdirSync(path.join(d, 'historial')).map((n) => fs.readFileSync(path.join(d, 'historial', n), 'utf8')).sort();
    assert.deepEqual(versiones, ['version dos', 'version uno']);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('reemplazar y restaurar un clip no altera el guion ni pierde el video subido', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'kads-reemplazar-'));
  try {
    fs.mkdirSync(path.join(d, 'video'));
    const manifiesto = JSON.stringify(anuncio());
    fs.writeFileSync(path.join(d, 'manifiesto.json'), manifiesto);
    const clip = path.join(d, 'video', 'toma-1.mp4');
    const subido = path.join(d, 'subido.mp4');
    fs.writeFileSync(clip, 'clip original');
    fs.writeFileSync(subido, 'video del usuario');
    const r = ponerVideoPropio(d, 'toma-1', subido);
    assert.equal(fs.readFileSync(clip, 'utf8'), 'video del usuario');
    volverAlClipOriginal(d, 'toma-1', r.original);
    assert.equal(fs.readFileSync(clip, 'utf8'), 'clip original');
    assert.equal(fs.readFileSync(path.join(d, 'manifiesto.json'), 'utf8'), manifiesto);
    const historial = fs.readdirSync(path.join(d, 'historial')).map((n) => fs.readFileSync(path.join(d, 'historial', n), 'utf8'));
    assert.ok(historial.includes('video del usuario'));
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('la edicion reemplaza imagen sin mover la ventana de la voz y protege el dialogo', () => {
  const plan = { duracion: 4, audio: { voz: 'audio/voz.mp3' }, bloques: [{ tipo: 'A', inicio: 0, fin: 4, toma: { archivo: 'toma-1.mp4', desde: 0, largoOriginal: 6, velocidad: 1 }, broll: null }] };
  const ed = completarEdicion({ reemplazos: { 'toma-1': { id: 'abc123', archivo: 'subidos/abc123.mp4', largo: 8 } }, clips: { 'toma-1': { velocidad: 1.5, desliza: 2 } } });
  const ajustado = planAjustado(plan, ed);
  assert.deepEqual(capasDeEdicion(plan, ed).voz, { archivo: 'audio/voz.mp3', volumen: 1 });
  assert.equal(plan.audio.voz, 'audio/voz.mp3');
  assert.equal(ajustado.bloques[0].fin, 4);
  assert.equal(ajustado.bloques[0].toma.archivo, 'subidos/abc123.mp4');
  assert.equal(ajustado.bloques[0].toma.recorteInicio, 2);
  assert.equal(ajustado.bloques[0].toma.velocidad, 1.5);
  assert.equal(plan.bloques[0].toma.archivo, 'toma-1.mp4');
  assert.equal(queSePuedeConElClip({ ...plan, audio: {} }, 'toma-1').velocidad, false);
});

test('normalizar un clip nuevo conserva la salida de Kads en 1080p', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'kads-1080-'));
  try {
    const f = path.join(d, 'clip.mp4');
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=green:s=704x1280:r=10:d=0.2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', f]);
    normalizarClip(f, '9:16', '1080p');
    const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'json', f], { encoding: 'utf8' }));
    assert.deepEqual(j.streams.map((s) => [s.width, s.height]), [[1080, 1920]]);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

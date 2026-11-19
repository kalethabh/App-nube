// Prueba de las voces de los hosts del podcast (lib/voces-hosts.js), con un ElevenLabs simulado en esta PC (no gasta):
//   node app/herramientas/probar-voces-hosts.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'voces-hosts-'));
const claves = await import('../server/lib/claves.js');
claves._paraPruebas({ archivo: path.join(TMP, '.env') });
fs.writeFileSync(path.join(TMP, '.env'), 'ELEVENLABS_API_KEY=clave-de-prueba\n');

// el ElevenLabs simulado: «cambiar voz» devuelve un tono distinto por voz, del largo del audio que llega
const pedidos = [];
const servidor = http.createServer((req, res) => {
  const m = req.url.match(/^\/v1\/speech-to-speech\/([^/?]+)/);
  const partes = [];
  req.on('data', (d) => partes.push(d));
  req.on('end', () => {
    if (!m || req.method !== 'POST') return res.writeHead(404).end();
    const cuerpo = Buffer.concat(partes);
    pedidos.push({ voz: m[1], clave: req.headers['xi-api-key'], tieneAudio: cuerpo.includes(Buffer.from('clip.mp3')), modelo: /eleven_multilingual_sts_v2/.test(cuerpo.toString('latin1')) });
    const salida = path.join(TMP, `sts-${pedidos.length}.mp3`);
    const hz = m[1] === 'voz-grave' ? 180 : 520;
    spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i', `sine=frequency=${hz}:duration=1.8`, '-b:a', '128k', salida]);
    res.writeHead(200, { 'Content-Type': 'audio/mpeg' }).end(fs.readFileSync(salida));
  });
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
process.env.ELEVENLABS_BASE_URL = `http://127.0.0.1:${servidor.address().port}`;
const v = await import('../server/lib/voces-hosts.js');

const resultados = [];
const check = (nombre, ok, detalle) => {
  resultados.push(Boolean(ok));
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${ok ? '' : `\n      ${JSON.stringify(detalle)?.slice(0, 400)}`}`);
};
const hash = (f) => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
const duracion = (f) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim());
const clip = (f, hz) => spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=gray:s=320x568:d=2', '-f', 'lavfi', '-i', `sine=frequency=${hz}:duration=2`, '-shortest', '-pix_fmt', 'yuv420p', '-c:a', 'aac', f]);

const carpeta = path.join(TMP, 'anuncio');
fs.mkdirSync(path.join(carpeta, 'video'), { recursive: true });
const m = {
  estilo: 'podcast',
  podcast: { hosts: { A: 'host-a', B: 'host-b' } },
  referencias: [
    { id: 'host-a', tipo: 'personaje', prompt: 'Foto hiperrealista de una mujer adulta colombiana de 27 años, piel trigueña…' },
    { id: 'host-b', tipo: 'personaje', referencias: ['host-a'], prompt: 'Usa la imagen adjunta como referencia del lugar. Cambia a la persona: ahora es otro hombre de 34 años, moreno…' },
  ],
  tomas: [
    { n: 1, tipo: 'H', habla: 'A', lineas: [{ orden: 1, texto: 'Hola' }] },
    { n: 2, tipo: 'H', habla: 'B', lineas: [{ orden: 2, texto: 'Qué tal' }] },
    { n: 3, tipo: 'H', habla: 'A', clase: 'reacciones', lineas: [] },
    { n: 4, tipo: 'H', habla: 'B', lineas: [{ orden: 3, texto: 'Mi video' }] },
  ],
};
for (const n of [1, 2, 3, 4]) clip(path.join(carpeta, 'video', `toma-${n}.mp4`), 300);
const VOCES = [
  { id: 'voz-aguda', nombre: 'Lucía', etiquetas: { gender: 'female', language: 'es', accent: 'latin american' } },
  { id: 'voz-grave', nombre: 'Andrés', etiquetas: { gender: 'male', language: 'es', accent: 'colombian' } },
  { id: 'voz-otra', nombre: 'Sofía', etiquetas: { gender: 'female', language: 'es' } },
];

try {
  check('El género de cada host sale de su hoja (B: «ahora es otro hombre»)', v.generoDelHost(m, 'A') === 'femenina' && v.generoDelHost(m, 'B') === 'masculina', [v.generoDelHost(m, 'A'), v.generoDelHost(m, 'B')]);
  const e = await v.elegirVocesHosts({ carpeta, m, voces: VOCES });
  check('Cada host con su voz, distinta, según su género', e.ok && e.voces.A.id === 'voz-aguda' && e.voces.B.id === 'voz-grave', e);
  const dos = await v.elegirVocesHosts({ carpeta, m, voces: [...VOCES].reverse() });
  check('Una vez elegidas, no cambian (el anuncio suena igual aunque se rehaga algo)', dos.voces.A.id === 'voz-aguda' && dos.voces.B.id === 'voz-grave', dos);
  const soloMujeres = { ...m, referencias: m.referencias.map((r) => ({ ...r, prompt: r.prompt.replace('otro hombre', 'otra mujer') })) };
  const e2 = await v.elegirVocesHosts({ carpeta: path.join(TMP, 'otro'), m: soloMujeres, voces: VOCES });
  check('Dos mujeres: dos voces femeninas, nunca la misma', e2.ok && e2.voces.A.id !== e2.voces.B.id && [e2.voces.A.id, e2.voces.B.id].every((id) => id !== 'voz-grave'), e2.voces);

  const antes = Object.fromEntries([1, 2, 3, 4].map((n) => [n, hash(path.join(carpeta, 'video', `toma-${n}.mp4`))]));
  const r = await v.ponerVoces({ carpeta, m, voces: e.voces, saltar: (id) => id === 'toma-4' });
  check('Se cambia la voz de los clips que hablan (no las reacciones, ni tu video)', r.hechas.join() === 'toma-1,toma-2' && hash(path.join(carpeta, 'video', 'toma-3.mp4')) === antes[3] && hash(path.join(carpeta, 'video', 'toma-4.mp4')) === antes[4], r);
  check('A ElevenLabs le llega el audio, con la voz de cada host, la clave y el modelo de «cambiar voz»', pedidos.length === 2 && pedidos[0].voz === 'voz-aguda' && pedidos[1].voz === 'voz-grave' && pedidos.every((p) => p.clave === 'clave-de-prueba' && p.tieneAudio && p.modelo), pedidos);
  const c1 = path.join(carpeta, 'video', 'toma-1.mp4');
  check('El clip queda con su video y su largo, con el audio nuevo (el de antes queda guardado)', hash(c1) !== antes[1] && Math.abs(duracion(c1) - 2) < 0.15 && fs.existsSync(path.join(carpeta, 'app', 'hablado', 'voz-original', 'toma-1.mp4')), duracion(c1));
  const r2 = await v.ponerVoces({ carpeta, m, voces: e.voces, saltar: (id) => id === 'toma-4' });
  check('Otra vez: lo que ya tiene su voz no se vuelve a pagar', r2.hechas.length === 0 && r2.saltadas.length === 2 && pedidos.length === 2, r2);
  clip(path.join(carpeta, 'video', 'toma-2.mp4'), 440); // el clip 2 se regeneró
  const r3 = await v.ponerVoces({ carpeta, m, voces: e.voces, saltar: (id) => id === 'toma-4' });
  check('Un clip que se regeneró recibe su voz otra vez', r3.hechas.join() === 'toma-2' && pedidos.length === 3, r3);
} catch (err) {
  check('La prueba corre entera', false, String(err?.stack || err));
} finally {
  servidor.close();
  fs.rmSync(TMP, { recursive: true, force: true });
}
const malas = resultados.filter((x) => !x).length;
console.log(`\n${resultados.length - malas}/${resultados.length} OK`);
process.exit(malas ? 1 : 0);

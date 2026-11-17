// Pruebas de la exportación por tramos del editor (produccion/exportar-tramos.js y la medición por tramos de
// produccion/exportar-edicion.js). No arma ningún video con Remotion: las huellas se calculan sobre un plan de
// mentira y la medición usa videos chicos que fabrica ffmpeg (si no está, esa parte se salta y se avisa).
//
//   node app/herramientas/probar-exportar-tramos.mjs        sale con 0 si todo pasó y con 1 si algo falló
//
// Qué prueba:
//   1. los tramos: siempre en los mismos cuadros (0, 120, 240…) y el resto corto pegado al último;
//   2. cambiar un texto de 10 a 12 s solo cambia el tramo de 8 a 12 s (y un texto que cruza un corte, sus dos tramos);
//   3. lo que solo suena (silenciar una palabra, el volumen de la voz o de un clip, la música, tus audios) no cambia
//      ningún tramo, y sí la huella del sonido;
//   4. lo general (el estilo de los subtítulos, el color, el fundido de entrada, la calidad, el código) cambia todos;
//      un campo de la edición que la cuenta no conoce, también;
//   5. cambiar una toma (su color o su archivo) solo cambia los tramos donde se ve; un archivo que cambia en el disco
//      (otro tamaño o fecha), también;
//   6. juntar los congelados medidos por partes;
//   7. la medición por tramos (con ffmpeg): un congelado de 1,7 s que cruza una unión se encuentra igual midiendo el
//      video entero, midiendo solo el tramo del medio y su unión, o con todo ya medido; y un negro dentro de un tramo.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const tramos = await import(pathToFileURL(path.join(RAIZ, 'produccion', 'exportar-tramos.js')).href);
const capas = await import(pathToFileURL(path.join(RAIZ, 'remotion', 'src', 'edicion', 'capas.mjs')).href);

let fallas = 0;
let pasadas = 0;
function ok(condicion, que) {
  if (condicion) pasadas++;
  else {
    fallas++;
    console.log(`  FALLA  ${que}`);
  }
}
const FPS = 30;
const copia = (x) => JSON.parse(JSON.stringify(x));

// ---------------------------------------------------------------- un anuncio de mentira (4 tomas de 5 s, 20 s)

const palabras = (texto, inicio, fin) => {
  const ps = texto.split(' ');
  const paso = (fin - inicio) / ps.length;
  return ps.map((p, i) => ({ texto: p, inicio: inicio + i * paso, fin: inicio + (i + 1) * paso - 0.01 }));
};
const plan = {
  duracion: 20,
  audio: { voz: null, ducking: 0, fadeMs: 80 },
  musica: { archivo: 'musica/fondo.mp3', db: -22, fadeInSeg: 1.2, fadeOutSeg: 1.5 },
  bloques: [0, 1, 2, 3].map((i) => ({ linea: i + 1, tipo: 'R', inicio: i * 5, fin: i * 5 + 5, texto: `linea ${i + 1}`, toma: { archivo: `toma-${i + 1}.mp4`, desde: i * 5, duracion: 5, largoOriginal: 9, velocidad: 1, recorteInicio: 0 } })),
  subtitulos: [
    { inicio: 0.5, fin: 2, texto: 'hola a todos', palabras: palabras('hola a todos', 0.5, 2) },
    { inicio: 6, fin: 7.5, texto: 'esto es otra', palabras: palabras('esto es otra', 6, 7.5) },
    { inicio: 13, fin: 14.5, texto: 'y una mas', palabras: palabras('y una mas', 13, 14.5) },
  ],
  estiloSubtitulos: { colorResaltado: '#E8442A', desdeAbajo: 0.26 },
  transiciones: [{ toma: 3, desde: 10, animacion: 'zoom', efecto: 'woosh', archivo: 'efectos/woosh.mp3', adelantoSeg: 0.05 }],
  reglasTransiciones: { duracionSeg: 0.45 },
};
const contexto = { titulo: 'Producto de prueba', overlays: [], color: '#E01E5A', musica: null };
const edicionBase = {
  subtitulos: { visible: true, estilo: 'caja' },
  textosNuevos: [
    { id: 't1', texto: 'AL COMIENZO', inicio: 1, fin: 3 },
    { id: 't2', texto: 'EN EL MEDIO', inicio: 10, fin: 12 },
  ],
};
const total = Math.round(plan.duracion * FPS); // 600 cuadros = 5 tramos
const archivos = new Map([
  ['video/toma-1.mp4', [1000, 1]],
  ['video/toma-2.mp4', [2000, 2]],
  ['video/toma-3.mp4', [3000, 3]],
  ['video/toma-4.mp4', [4000, 4]],
  ['musica/fondo.mp3', [500, 5]],
  ['efectos/woosh.mp3', [600, 6]],
]);
const base = { codigo: 'c1', calidad: '720', scale: 1, fps: FPS, codificador: 'x264', ajustes: { crf: 21, x264Preset: 'veryfast' } };

function huellas(edicion, { baseX = base, archivosX = archivos, planX = plan } = {}) {
  const estado = capas.completarEdicion(edicion);
  // (la música con su url, como la arma exportar-edicion.js)
  const musica = capas.musicaDeEdicion(planX, estado, (fuente) => (fuente === 'original' ? planX.musica?.archivo || null : null));
  const c = capas.capasDeEdicion(planX, estado, { ...contexto, musica });
  const lista = tramos.huellasDeTramos({ capas: c, estado, inicial: capas.INICIAL, fps: FPS, total, base: baseX, firmaArchivo: (r) => archivosX.get(r) ?? null });
  const sonido = tramos.huellaDeSonido({ capas: c, estado, inicial: capas.INICIAL, total, base: baseX, archivos: [...archivosX.entries()] });
  return { lista: lista.map((t) => t.huella), sonido, cortes: lista };
}
/** Los índices de los tramos que cambian entre dos ediciones. */
function cambian(a, b) {
  return a.lista.map((h, i) => (h !== b.lista[i] ? i : null)).filter((i) => i !== null);
}

// ---------------------------------------------------------------- 1. los tramos

{
  const c = tramos.cortesDeTramos(600);
  ok(c.length === 5 && c[0].desde === 0 && c[4].hasta === 600 && c.every((t) => t.hasta - t.desde === 120), '600 cuadros = 5 tramos de 120');
  const d = tramos.cortesDeTramos(1158);
  ok(d.length === 10 && d[9].desde === 1080 && d[9].hasta === 1158, '1158 cuadros: el último tramo de 78');
  const e = tramos.cortesDeTramos(1210);
  ok(e.length === 10 && e[9].hasta === 1210 && e[9].hasta - e[9].desde === 130, 'un resto de 10 cuadros va pegado al último tramo');
  ok(tramos.cortesDeTramos(50).length === 1, 'un video de menos de 4 s es un solo tramo');
  const v = tramos.cuadrosEntre(10, 12, FPS);
  ok(v.desde === 300 && v.hasta === 360, `un texto de 10 a 12 s se ve en los cuadros 300 a 359 (salió ${v.desde}-${v.hasta - 1})`);
}

// ---------------------------------------------------------------- 2. un texto

const h0 = huellas(edicionBase);
ok(new Set(h0.lista).size === h0.lista.length, 'cada tramo tiene su propia huella');
ok(JSON.stringify(huellas(copia(edicionBase)).lista) === JSON.stringify(h0.lista), 'la misma edición da las mismas huellas');
{
  const e = copia(edicionBase);
  e.textosNuevos[1].texto = 'OTRO TEXTO';
  const h = huellas(e);
  ok(JSON.stringify(cambian(h0, h)) === '[2]', `cambiar el texto de 10 a 12 s solo cambia el tramo 3 (cambiaron ${cambian(h0, h)})`);
  ok(h.sonido === h0.sonido, 'cambiar un texto no cambia el sonido');
}
{
  const e = copia(edicionBase);
  e.textosNuevos[1].inicio = 11;
  e.textosNuevos[1].fin = 13;
  ok(JSON.stringify(cambian(h0, huellas(e))) === '[2,3]', `mover el texto a 11-13 s cambia los tramos 3 y 4 (cambiaron ${cambian(h0, huellas(e))})`);
}
{
  const e = copia(edicionBase);
  e.textosNuevos[1].x = 0.3;
  e.textosNuevos[1].color = '#00FF00';
  ok(JSON.stringify(cambian(h0, huellas(e))) === '[2]', 'cambiar el lugar y el color de un texto solo cambia su tramo');
}
{
  const e = copia(edicionBase);
  e.textosNuevos.push({ id: 't3', texto: 'NUEVO', inicio: 16.5, fin: 18 });
  ok(JSON.stringify(cambian(h0, huellas(e))) === '[4]', 'agregar un texto de 16,5 a 18 s solo cambia el último tramo');
}
{
  const e = copia(edicionBase);
  e.correcciones = { 1: 'esto era otra' };
  ok(JSON.stringify(cambian(h0, huellas(e))) === '[1]', `corregir el subtítulo de 6 a 7,5 s solo cambia el tramo 2 (cambiaron ${cambian(h0, huellas(e))})`);
  const f = copia(edicionBase);
  f.ocultos = [2];
  ok(JSON.stringify(cambian(h0, huellas(f))) === '[3]', 'ocultar el subtítulo de 13 a 14,5 s solo cambia el tramo 4');
}

// ---------------------------------------------------------------- 3. lo que solo suena

for (const [que, cambiar] of [
  ['silenciar una palabra (pitido)', (e) => (e.censuras = [{ id: 'c1', desde: 12.2, hasta: 12.6, modo: 'pitido', palabra: 'x' }])],
  ['silenciar una palabra (silencio)', (e) => (e.censuras = [{ id: 'c1', desde: 3.2, hasta: 3.6, modo: 'silencio', palabra: 'x' }])],
  ['el volumen de la voz', (e) => (e.voz = { volumen: 0.5 })],
  ['silenciar la voz', (e) => (e.voz = { silenciada: true })],
  ['el volumen de la música', (e) => (e.musica = { volumen: 0.3 })],
  ['silenciar la música', (e) => (e.musica = { silenciada: true })],
  ['el volumen de un clip', (e) => (e.clips = { 'toma-2': { volumen: 0.2 } })],
  ['tus audios', (e) => (e.audios = [{ id: 'a1', archivo: 'app/edicion/audios/aud-abc.mp3', nombre: 'Efecto', desde: 4, hasta: 6, duracion: 2 }])],
  ['las partes de la voz', (e) => (e.voz = { tramos: [{ id: 'v1', desde: 0, hasta: 10, volumen: 1 }, { id: 'v2', desde: 10, hasta: 20, volumen: 0 }] })],
]) {
  const e = copia(edicionBase);
  cambiar(e);
  const h = huellas(e);
  ok(cambian(h0, h).length === 0, `${que}: no cambia ningún tramo (cambiaron ${cambian(h0, h)})`);
  ok(h.sonido !== h0.sonido, `${que}: cambia la huella del sonido`);
}

// ---------------------------------------------------------------- 4. lo general

for (const [que, cambiar, opciones = {}] of [
  ['el estilo de los subtítulos', (e) => (e.subtitulos = { visible: true, estilo: 'creador' })],
  ['la altura de los subtítulos', (e) => (e.subtitulos = { visible: true, estilo: 'caja', altura: 0.4 })],
  ['un campo nuevo que la cuenta no conoce', (e) => (e.algoNuevo = { brillo: 2 })],
  ['la calidad', () => {}, { baseX: { ...base, calidad: '1080', scale: 1.5 } }],
  ['el código de remotion/src', () => {}, { baseX: { ...base, codigo: 'c2' } }],
  ['el codificador', () => {}, { baseX: { ...base, codificador: 'videotoolbox', ajustes: { videoBitrate: '6M' } } }],
]) {
  const e = copia(edicionBase);
  cambiar(e);
  const h = huellas(e, opciones);
  ok(cambian(h0, h).length === h0.lista.length, `${que}: cambia todos los tramos (cambiaron ${cambian(h0, h).length} de ${h0.lista.length})`);
}
{
  // el color del anuncio (el de los textos y subtítulos sin color propio) también es de todos
  const estado = capas.completarEdicion(edicionBase);
  const c = capas.capasDeEdicion(plan, estado, { ...contexto, color: '#00AAFF' });
  const lista = tramos.huellasDeTramos({ capas: c, estado, inicial: capas.INICIAL, fps: FPS, total, base, firmaArchivo: (r) => archivos.get(r) ?? null });
  ok(lista.every((t, i) => t.huella !== h0.lista[i]), 'el color del anuncio cambia todos los tramos');
}
{
  const e = copia(edicionBase);
  e.fundido = { entrada: 1, salida: 0 };
  ok(JSON.stringify(cambian(h0, huellas(e))) === '[0]', 'un fundido de entrada de 1 s solo cambia el primer tramo');
  const f = copia(edicionBase);
  f.fundido = { entrada: 0, salida: 2 };
  ok(JSON.stringify(cambian(h0, huellas(f))) === '[4]', 'un fundido de salida de 2 s solo cambia el último tramo');
}

// ---------------------------------------------------------------- 5. las tomas y sus archivos

{
  const e = copia(edicionBase);
  e.clips = { 'toma-2': { color: { brillo: 1.3 } } };
  ok(JSON.stringify(cambian(h0, huellas(e))) === '[1,2]', `el color de la toma 2 (5 a 10 s) cambia los tramos 2 y 3 (cambiaron ${cambian(h0, huellas(e))})`);
  const f = copia(edicionBase);
  f.encuadres = { 'toma-4': { x: 0.1, y: 0, zoom: 1.2 } };
  ok(JSON.stringify(cambian(h0, huellas(f))) === '[3,4]', `el encuadre de la toma 4 (15 a 20 s) cambia los tramos 4 y 5 (cambiaron ${cambian(h0, huellas(f))})`);
}
{
  const otros = new Map(archivos);
  otros.set('video/toma-3.mp4', [3001, 99]);
  const h = huellas(edicionBase, { archivosX: otros });
  ok(JSON.stringify(cambian(h0, h)) === '[2,3]', `si el archivo de la toma 3 (10 a 15 s) cambia en el disco, cambian sus tramos 3 y 4 (cambiaron ${cambian(h0, h)})`);
  ok(h.sonido !== h0.sonido, 'y también la huella del sonido');
}
{
  // la animación de entrada de la toma 3 (transición) es parte de la toma: cambiarla cambia sus tramos
  const p = copia(plan);
  p.transiciones[0].animacion = 'deslizar-izquierda';
  const h = huellas(edicionBase, { planX: p });
  ok(JSON.stringify(cambian(h0, h)) === '[2,3]', `cambiar la animación de la toma 3 cambia sus tramos (cambiaron ${cambian(h0, h)})`);
}

// ---------------------------------------------------------------- 6. juntar congelados

{
  const j = tramos.juntarCongelados([{ desde: 3.4, hasta: 4 }, { desde: 4, hasta: 5 }, { desde: 8, hasta: 9 }, { desde: 3.5, hasta: 3.9 }], FPS);
  ok(j.length === 2 && j[0].desde === 3.4 && j[0].hasta === 5 && j[1].desde === 8, 'los tramos quietos que se tocan se juntan');
}

// ---------------------------------------------------------------- 7. la medición por tramos (con ffmpeg)

const hayFfmpeg = cp.spawnSync('ffmpeg', ['-hide_banner', '-filters'], { encoding: 'utf8' });
if (hayFfmpeg.status !== 0 || !/freezeframes/.test(hayFfmpeg.stdout)) {
  console.log('  (sin ffmpeg con freezeframes: salto la medición por tramos)');
} else {
  const { medirPorTramos } = await import(pathToFileURL(path.join(RAIZ, 'produccion', 'exportar-edicion.js')).href);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tramos-'));
  try {
    const ff = (args) => {
      const r = cp.spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args], { encoding: 'utf8' });
      if (r.status !== 0) throw new Error(r.stderr);
    };
    // 12 s que se mueven; quieto de 3,333 a 5,0 s (cruza la unión de los 4 s) y negro de 9 a 9,5 s
    const entero = path.join(dir, 'entero.mp4');
    ff([
      '-f', 'lavfi', '-i', 'testsrc2=s=160x284:r=30:d=12',
      '-filter_complex', "[0:v]split[a][b];[a][b]freezeframes=first=100:last=149:replace=100,lutyuv=y=0:u=128:v=128:enable='between(t,9,9.49)'",
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '10', '-g', '120', '-keyint_min', '120', '-sc_threshold', '0', '-pix_fmt', 'yuv420p', entero,
    ]);
    const lista = tramos.cortesDeTramos(360).map((t) => ({ ...t, huella: `${String(t.i).repeat(40)}`.slice(0, 40), archivo: path.join(dir, `tramo-${t.i}.mp4`) }));
    for (const t of lista) ff(['-ss', String(t.desde / FPS), '-i', entero, '-c', 'copy', '-frames:v', String(t.hasta - t.desde), t.archivo]);
    const cache = path.join(dir, 'cache');
    fs.mkdirSync(cache);
    const revisar = (m, que) => {
      ok(!m.error, `${que}: midió (${m.error || ''})`);
      if (m.error) return;
      const c = m.congelados.find((x) => x.desde < 4 && x.hasta > 4);
      ok(Boolean(c) && Math.abs(c.desde - 3.333) < 0.1 && Math.abs(c.hasta - 5) < 0.1, `${que}: el congelado que cruza la unión (3,3 a 5 s) aparece (${JSON.stringify(m.congelados)})`);
      ok(m.congelados.length === 1, `${que}: no aparece ningún otro congelado`);
      ok(m.negros.length === 1 && Math.abs(m.negros[0].desde - 9) < 0.05 && Math.abs(m.negros[0].hasta - 9.5) < 0.05, `${que}: el negro de 9 a 9,5 s aparece (${JSON.stringify(m.negros)})`);
    };
    // a) todo nuevo: mide el video entero y lo reparte
    revisar(await medirPorTramos({ archivo: entero, tramos: lista, dirCache: cache, fps: FPS }), 'todo nuevo');
    ok(lista.every((t) => fs.existsSync(path.join(cache, `${t.huella}.json`))), 'todo nuevo: guarda la medición de cada tramo');
    // b) todo ya medido
    revisar(await medirPorTramos({ archivo: entero, tramos: lista, dirCache: cache, fps: FPS }), 'todo ya medido');
    // c) solo el tramo del medio es nuevo (en él solo hay 1 s quieto: lo encuentra la medición de la unión)
    fs.rmSync(path.join(cache, `${lista[1].huella}.json`));
    for (const n of fs.readdirSync(cache)) if (n.startsWith('union-')) fs.rmSync(path.join(cache, n));
    revisar(await medirPorTramos({ archivo: entero, tramos: lista, dirCache: cache, fps: FPS }), 'solo el tramo del medio es nuevo');
    ok(fs.readdirSync(cache).filter((n) => n.startsWith('union-')).length === 2, 'solo el tramo del medio es nuevo: mide sus dos uniones');
    // d) solo el primero es nuevo
    fs.rmSync(path.join(cache, `${lista[0].huella}.json`));
    revisar(await medirPorTramos({ archivo: entero, tramos: lista, dirCache: cache, fps: FPS }), 'solo el primer tramo es nuevo');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- podar lo guardado

{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tramos-poda-'));
  try {
    for (let i = 0; i < 10; i++) {
      const n = path.join(dir, `${String(i).repeat(40)}.mp4`);
      fs.writeFileSync(n, Buffer.alloc(1000));
      fs.writeFileSync(n.replace('.mp4', '.json'), '{}');
      const t = new Date(Date.now() - (10 - i) * 60000);
      fs.utimesSync(n, t, t);
    }
    const enUso = new Set([`${'0'.repeat(40)}.mp4`]);
    tramos.podarCache(dir, { enUso, maxArchivos: 4 });
    const quedan = fs.readdirSync(dir).filter((n) => n.endsWith('.mp4'));
    ok(quedan.length === 4 && quedan.includes(`${'0'.repeat(40)}.mp4`) && quedan.includes(`${'9'.repeat(40)}.mp4`), `podar deja lo usado y lo más reciente (${quedan.length})`);
    ok(fs.readdirSync(dir).filter((n) => n.endsWith('.json')).length === 4, 'podar se lleva la medición de cada tramo borrado');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log(`\n  ${pasadas} comprobaciones bien, ${fallas} mal.\n`);
process.exit(fallas ? 1 : 0);

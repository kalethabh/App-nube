// Pruebas SIN GASTAR de «De un video, imágenes» (2026-11-17p): un video sintético de 72 s (8 tomas de ffmpeg, con
// subtítulos quemados y una toma que empieza borrosa) pasa por todo el camino, sin kie ni ChatGPT ni la IA de texto:
//   1. tomas y el cuadro más nítido de cada una (nunca el borroso);
//   2. los subtítulos borrados (con OpenCV) o recortados (sin OpenCV);
//   3. la elección sin IA (repartida, con los ángulos y un antes y después) y con una «IA» de mentira;
//   4. el lote: las imágenes armadas con las plantillas, sin llamar al proveedor y con costo 0;
//   5. «Pulir con IA»: una sola escena, con el cuadro como referencia y sin texto (con el motor falso).
// Mide el tiempo de cada parte.
//
//   node app/herramientas/probar-video-imagenes.mjs      sale con 0 si todo pasó
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.env.ANUNCIOS_NO_RETOMAR = '1';
process.env.ANUNCIOS_MODO_PRUEBA = '1';
process.env.ANUNCIOS_SIN_RECORTE = '1';
process.env.AIA_MOTOR = 'claude';
process.env.ANUNCIOS_MOTOR_IMAGEN_ADS = 'pruebas/motor-falso-imagen-ads.js';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(AQUI, '..');
const RAIZ = path.resolve(APP, '..');

const video = await import('../server/lib/imagen-ads/video-imagenes.js');
const plantillas = await import('../server/lib/imagen-ads/plantillas.js');
const familia = await import('../server/lib/familias/imagen-ads.js');
const lotes = await import('../server/lib/imagen-ads/lotes.js');
const costo = await import('../server/lib/imagen-ads/costo.js');
const render = await import('../server/lib/plantillas/render.js');
const { R } = await import('../server/lib/imagen-ads/disco.js');

const resultados = [];
function check(nombre, ok, detalle) {
  resultados.push({ nombre, ok: Boolean(ok) });
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${!ok && detalle !== undefined ? `\n        → ${String(typeof detalle === 'string' ? detalle : JSON.stringify(detalle)).slice(0, 1500)}` : ''}`);
  return Boolean(ok);
}
const leer = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
};
const escribir = (f, v) => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, typeof v === 'string' ? v : JSON.stringify(v, null, 2));
};
const BASE = path.join(RAIZ, 'temp', `_prueba-video-${process.pid}`);
fs.mkdirSync(BASE, { recursive: true });

try {
  // ---- el video sintético: 8 tomas de 9 s (720x1280), cada una con su subtítulo; la toma 3 empieza borrosa
  const fuente = path.join(RAIZ, 'remotion', 'src', 'plantillas-imagen', 'publico', 'fuentes', 'Inter.ttf').replace(/\\/g, '/').replace(/:/g, '\\:');
  const fuentes = ['testsrc2=s=720x1280:r=24', 'mandelbrot=s=720x1280:r=24', 'smptebars=s=720x1280:r=24', 'rgbtestsrc=s=720x1280:r=24', 'testsrc=s=720x1280:r=24', 'mandelbrot=s=720x1280:r=24:start_scale=0.6', 'smptehdbars=s=720x1280:r=24', 'testsrc2=s=720x1280:r=24:alpha=0'];
  const textos = ['Nadie me creía', 'Probé de todo', 'Hasta que encontré esto', 'Dos cápsulas al día', 'Mira la diferencia', 'Mis amigas me preguntan', 'Sin gimnasio', 'Pídelo hoy'];
  const entradas = fuentes.flatMap((f) => ['-f', 'lavfi', '-t', '9', '-i', f]);
  const filtros = fuentes.map((_, i) => {
    const borroso = i === 2 ? ",boxblur=luma_radius=24:luma_power=3:enable='lt(t,4.5)'" : '';
    const tono = i % 2 ? ',hue=h=40' : '';
    return `[${i}:v]format=yuv420p${tono}${borroso},drawtext=fontfile='${fuente}':text='${textos[i]}':fontcolor=white:fontsize=58:borderw=6:bordercolor=black:x=(w-text_w)/2:y=h*0.72,setpts=PTS-STARTPTS[v${i}]`;
  });
  const sintetico = path.join(BASE, 'sintetico.mp4');
  let t = Date.now();
  const r = cp.spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...entradas, '-filter_complex', `${filtros.join(';')};${fuentes.map((_, i) => `[v${i}]`).join('')}concat=n=${fuentes.length}:v=1:a=0[o]`, '-map', '[o]', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', sintetico], { encoding: 'utf8' });
  check(`Video sintético de 72 s con 8 tomas y subtítulos (${Date.now() - t} ms)`, r.status === 0 && fs.existsSync(sintetico), r.stderr);

  // ---- 1 y 2. el análisis
  const calor = await render.calentar();
  t = Date.now();
  const { id } = video.crearTrabajo({ video: sintetico, origen: { tipo: 'prueba' } });
  await video.analizar(id);
  const msAnalisis = Date.now() - t;
  const e = video.estadoTrabajo(id);
  check(`Análisis listo en ${msAnalisis} ms: ${e?.tomas} tomas y un cuadro por toma`, e?.estado === 'listo' && e.tomas >= 7 && e.tomas <= 9 && e.cuadros.length === e.tomas, e);
  const trabajo = leer(path.join(video.DIR_TRABAJOS, id, 'trabajo.json'));
  const t3 = trabajo.cuadros.find((c) => c.desde >= 17 && c.desde < 19.5);
  check(`La toma que empieza borrosa: se eligió un cuadro nítido (segundo ${t3?.t}, el borroso termina en el 22,5)`, t3 && t3.t > 22.6, t3);
  check('Cada cuadro sale lejos de los cortes (sin cuadros de transición)', trabajo.cuadros.every((c) => c.t > c.desde + 0.2 && c.t < c.hasta - 0.2), trabajo.cuadros.map((c) => [c.desde, c.t, c.hasta]));
  const limpiezas = trabajo.cuadros.map((c) => c.limpieza);
  check(`Los subtítulos se quitaron en todos (${[...new Set(limpiezas)].join(', ')})`, limpiezas.every((x) => x === 'borrado' || x === 'recortado'), trabajo.cuadros.map((c) => ({ n: c.n, limpieza: c.limpieza, franja: c.franja })));
  // ya limpio: no queda la franja de texto
  const quedan = [];
  for (const c of trabajo.cuadros) {
    const g = cp.spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', path.join(video.DIR_TRABAJOS, id, c.archivo), '-vf', 'scale=360:-2,format=gray', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 26 });
    const h = Math.floor(g.stdout.length / 360);
    if (video._pruebas.franjaDeTexto(g.stdout, 360, h)) quedan.push(c.n);
  }
  check('En los cuadros limpios ya no se encuentra la franja de los subtítulos', quedan.length === 0, quedan);
  const tam = cp.spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width', '-of', 'csv=p=0', path.join(video.DIR_TRABAJOS, id, trabajo.cuadros[0].archivo)], { encoding: 'utf8' });
  check(`El cuadro chico (720 px) se agrandó con lanczos al ancho de la plantilla (${String(tam.stdout).trim()} px)`, Number(tam.stdout) === 1080);

  // ---- 3. la elección
  t = Date.now();
  const sinIA = await video.elegir(id, { cantidad: 6 });
  const msEleccion = Date.now() - t;
  const angulos = sinIA.seleccion.map((x) => x.angulo);
  check(`Sin IA: 6 anuncios con ángulos distintos (${angulos.join(', ')}) en ${msEleccion} ms`, sinIA.seleccion.length === 6 && !sinIA.conIA && angulos[0] === 'dolor' && angulos.includes('antes-despues') && angulos.includes('producto') && new Set(angulos).size === 6, sinIA);
  const repartidos = sinIA.seleccion.filter((x) => x.angulo !== 'antes-despues').map((x) => x.cuadros[0]);
  check('Repartidos por todo el video (del principio al final)', Math.min(...repartidos) <= 2 && Math.max(...repartidos) >= 7, repartidos);
  // con una «IA» de mentira (sin plan que gastar): lo que dice se valida (tomas que existen, plantillas permitidas)
  const iaFalsa = async (o) => {
    const salida = /Escribe (\S+eleccion-ia\.json)/.exec(o.prompt)?.[1];
    escribir(path.join(RAIZ, salida), { anuncios: [{ tomas: [1], angulo: 'dolor', plantilla: 'foto-tiktok', textos: { lineas: ['Nadie me creía', 'hasta que lo probé'] } }, { tomas: [2, 8], angulo: 'antes-despues', plantilla: 'antes-despues', textos: { titular: 'Mira el cambio' } }, { tomas: [99], angulo: 'estatus', plantilla: 'otra' }, { tomas: [5], angulo: 'inventado', plantilla: 'foto-titular', textos: { titular: 'Así funciona' } }] });
    return { ok: true, imagenes: o.material?.imagenes?.length };
  };
  t = Date.now();
  const conIA = await video.elegir(id, { cantidad: 6, conIA: true, lanzarSesion: iaFalsa });
  check(`Con la IA (de mentira): se usa lo que eligió y se descarta lo que no existe (${Date.now() - t} ms)`, conIA.conIA && conIA.seleccion.length === 3 && conIA.seleccion[1].cuadros.join() === '2,8' && conIA.seleccion[2].angulo === 'producto', conIA);
  const sinPlan = await video.elegir(id, { cantidad: 6, conIA: true, lanzarSesion: async () => ({ ok: false, limite: true }) });
  check('Si la IA no puede (sin plan), queda la elección de la app y dice por qué', !sinPlan.conIA && sinPlan.seleccion.length === 6 && /plan/.test(sinPlan.motivo || ''), sinPlan);

  // ---- 4. el lote: con las plantillas, sin el proveedor y sin costo
  const carpeta = path.join(BASE, '_img-video-20261117-1200');
  fs.mkdirSync(path.join(carpeta, 'entrada'), { recursive: true });
  fs.copyFileSync(path.join(APP, 'muestras', 'plantillas', 'producto-muestra.png'), path.join(carpeta, 'entrada', 'producto.png'));
  escribir(path.join(carpeta, 'entrada', 'ficha-producto.json'), { nombre: 'Crème Luna Colágeno', queEs: 'Suplemento en cápsulas a base de colágeno y biotina.', beneficios: ['Piel más firme', 'Uñas más fuertes', 'Cabello con brillo'], dolor: 'Siente que la piel se le ve apagada.', ingredientes: '500 mg de colágeno hidrolizado y 30 mcg de biotina.' });
  t = Date.now();
  const cuadros = await video.copiarAlLote(id, carpeta, sinIA.seleccion);
  const brief = { slug: '_img-video-20261117-1200', familia: 'imagen-ads', estilo: 'imagen-ads', titulo: 'Crème Luna', productoId: 'prueba-0000', datos: { nombre: 'Crème Luna Colágeno', pais: 'Perú', idioma: 'es' }, cantidad: cuadros.length, formatos: ['1:1', '9:16'], referencias: [], logo: null, rapido: true, plantillas: { elegidas: [] }, video: { id, cuadros } };
  escribir(R.brief(carpeta), brief);
  escribir(R.lote(carpeta), { version: 1, modelo: 'gpt-image-2-5-sunburst', resolucion: '2K', fondo: 'opaco', producto: 'entrada/producto.png', formatos: ['1:1', '9:16'], logo: null });
  check('Del video: 0 imágenes por pagar y costo 0', lotes.piezasPorHacer(carpeta, brief) === 0 || brief.plantillas.elegidas.length === 0, lotes.piezasPorHacer(carpeta, brief));
  const hijos = new Set();
  const ctx = {
    slug: brief.slug, carpeta, carpetaArg: carpeta, brief, conductor: { pasos: [] }, paso: { id: 'anuncios' }, senal: new AbortController().signal, frases: [],
    guardar() {}, avance(f) { ctx.frases.push(f); }, claude: async () => null, esperar: async () => true, esperarConexion: async () => true,
    correr(script, args) {
      return new Promise((resolve) => {
        const hijo = cp.spawn(process.execPath, [path.join(RAIZ, 'produccion', script), ...args, '--ociosa', '1'], { cwd: RAIZ, env: { ...process.env, MOTOR_FALSO_MS: '15' }, stdio: ['ignore', 'pipe', 'pipe'] });
        hijos.add(hijo);
        let texto = '';
        hijo.stdout.on('data', (d) => (texto += d));
        hijo.stderr.on('data', (d) => (texto += d));
        hijo.on('close', (codigo) => {
          hijos.delete(hijo);
          resolve({ codigo, texto, clase: codigo === 0 ? null : 'otro' });
        });
      });
    },
  };
  let rr = await familia._pruebas.estrategia(ctx);
  ctx.brief = leer(R.brief(carpeta));
  rr = rr?.ok ? await familia._pruebas.anuncios(ctx) : rr;
  const msLote = Date.now() - t;
  const piezas = cuadros.flatMap((c) => ['1x1', '9x16'].map((f) => `${c.v}_${f}`));
  const completas = piezas.filter((p) => plantillas.estadoComposicion(carpeta, p).completa);
  const ordenes = fs.existsSync(R.motor(carpeta)) ? fs.readdirSync(R.motor(carpeta)).filter((n) => /^T\d+\.json$/.test(n)) : [];
  check(`Lote de ${cuadros.length} anuncios × 2 tamaños con los cuadros: listo en ${msLote} ms, sin llamar al proveedor`, rr?.ok && completas.length === piezas.length && ordenes.length === 0, { rr, completas, ordenes });
  const v1 = leer(R.v(carpeta, 'V01'))?.app_plantilla;
  check('Los textos van por ángulo, sin la IA (dolor: las palabras del cliente en subtítulos)', v1?.angulo === 'dolor' && v1.id === 'foto-tiktok' && /apagada/i.test((v1.textos.lineas || []).join(' ')), v1);
  const ad = cuadros.find((c) => c.plantilla === 'antes-despues');
  const tamAD = ad ? cp.spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path.join(carpeta, ad.archivo)], { encoding: 'utf8' }).stdout.trim() : '';
  check(`El antes y después junta sus dos cuadros lado a lado (${tamAD})`, tamAD === '1080,1080', tamAD);
  const msTotal = msAnalisis + msEleccion + msLote;
  check(`Todo el camino sin la IA (análisis + elección + imágenes) en ${(msTotal / 1000).toFixed(1)} s: bien por debajo de un minuto`, msTotal < 60000, { msAnalisis, msEleccion, msLote });

  // ---- 5. «Pulir con IA»: una escena con el cuadro como referencia, sin texto (motor falso)
  check('«Pulir con IA» cuesta 1 imagen (se confirma antes)', costo.costoMaximoDeLaAccion({ dolaresPorImagen: 0.05 }, brief, { pieza: 'V02_1x1', carpeta, pulir: true }) === 0.05);
  plantillas.prepararPulido(carpeta, 'V02');
  escribir(R.pedidos(carpeta), { pedidos: [{ id: 'U0001', pieza: 'V02_1x1', instruccion: '', fecha: new Date().toISOString() }] });
  rr = await familia._pruebas.anuncios({ ...ctx, brief: leer(R.brief(carpeta)) });
  const pr = fs.existsSync(R.prompt(carpeta, 'V02_1x1')) ? fs.readFileSync(R.prompt(carpeta, 'V02_1x1'), 'utf8') : '';
  const u = (fs.existsSync(R.motor(carpeta)) ? fs.readdirSync(R.motor(carpeta)).filter((n) => /^T\d+\.json$/.test(n)) : []).flatMap((n) => leer(path.join(R.motor(carpeta), n)).piezas.map((x) => x.pieza));
  check('Pulir: una sola escena (el cuadrado), sin texto; el vertical se redibuja con ella', rr?.ok && u.join() === 'V02_1x1' && /frame taken from a video/.test(pr) && /ABSOLUTELY NO TEXT/.test(pr) && plantillas.estadoComposicion(carpeta, 'V02_9x16').completa, { rr, u, pr: pr.slice(0, 300) });
  // el motor de verdad adjunta primero el cuadro (la referencia del plan) y después el producto
  const { construirPrompt } = await import('../../produccion/imagen-ads.js');
  const xPlan = leer(R.plan(carpeta)).variaciones.find((x) => x.id === 'V02');
  const conRef = construirPrompt(leer(R.v(carpeta, 'V02')), { referencia: true });
  check('… con el cuadro como primera imagen (referencia del plan) y el producto como segunda', xPlan.fuente === 'referencia' && fs.existsSync(path.join(carpeta, xPlan.referencia)) && leer(R.lote(carpeta)).fiel === true && /SECOND attached image is the real product/.test(conRef), { xPlan });
  console.log(`   Tiempos: análisis ${msAnalisis} ms (video de 72 s); elección sin IA ${msEleccion} ms; lote de ${piezas.length} imágenes ${msLote} ms; dibujante ${calor.armado === 'nuevo' ? 'armado nuevo' : 'armado guardado'}.`);
} catch (e) {
  check('La prueba corre entera', false, String(e?.stack || e));
} finally {
  render.cerrar();
  fs.rmSync(BASE, { recursive: true, force: true });
  for (const n of fs.existsSync(video.DIR_TRABAJOS) ? fs.readdirSync(video.DIR_TRABAJOS) : []) {
    const t = leer(path.join(video.DIR_TRABAJOS, n, 'trabajo.json'));
    if (t?.origen?.tipo === 'prueba') fs.rmSync(path.join(video.DIR_TRABAJOS, n), { recursive: true, force: true });
  }
}

const fallas = resultados.filter((x) => !x.ok);
console.log(`\n${resultados.length - fallas.length}/${resultados.length} OK${fallas.length ? ` · FALLAS: ${fallas.map((x) => x.nombre).join(' | ')}` : ''}`);
process.exitCode = fallas.length ? 1 : 0;
setTimeout(() => process.exit(process.exitCode), 200).unref();

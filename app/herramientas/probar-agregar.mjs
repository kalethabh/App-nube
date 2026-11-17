// Prueba del estilo «Agregar» de punta a punta, SIN GASTAR NADA.
//
//   node app/herramientas/probar-agregar.mjs              el anuncio con voz en off, hasta el MP4
//   AGREGAR_UGC=1 node app/herramientas/probar-agregar.mjs    además, uno en formato UGC (alguien habla a cámara), también hasta el MP4
//   PUERTO=<n>   el puerto de la app de prueba (por defecto 4488)
//
// Arranca la app de esta carpeta en MODO PRUEBA (kie.ai, ElevenLabs y Suno simulados, la guardia de red) con el Claude
// falso (app/server/claude/pruebas/claude-falso.js: el guion de «Agregar» lo escribe claude-falso-estilos.js), y:
//   · arma un video de referencia con ffmpeg y lo sube como en la pantalla (POST /api/referencias);
//   · sin video, «Agregar» no se crea (400, falta-ajuste «clonar»);
//   · crea el producto con su foto y su ficha, y el anuncio «Agregar» con ese video;
//   · el análisis del video queda en temp/<slug>/referencia/ (adn-base.json, hoja-tomas.jpg) y el guion listo, con la
//     familia que salió del video (voz-en-off), el modelo de cada escena en guion.json («modelos») y en el costo
//     estimado («Modelo elegido por escena: …») antes de aprobar;
//   · aprueba y produce hasta el MP4: cada clip con su modelo (video/log-modelos.json: PixVerse en el antes y después,
//     Grok Imagine 1.5 en el B-roll) y el B-roll quieto sin cobrar;
//   · al terminar borra lo que dejó (el anuncio, el producto, el video subido y los MP4 de la prueba).
// Sale con 0 si todo pasó y con 1 si algo falló.
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = path.resolve(APP, '..');
const PUERTO = Number(process.env.PUERTO) || 4488;
const BASE = `http://127.0.0.1:${PUERTO}`;
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
const leerJSON = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
};
let fallas = 0;
let pasan = 0;
const check = (que, ok, detalle) => {
  if (ok) pasan++;
  else fallas++;
  console.log(`${ok ? '  ok ' : '  MAL'}  ${que}${ok || detalle === undefined ? '' : `\n        ${JSON.stringify(detalle).slice(0, 900)}`}`);
  return Boolean(ok);
};
async function pedir(ruta, o = {}) {
  const cuerpo = o.json !== undefined ? JSON.stringify(o.json) : o.cuerpo;
  const headers = { Accept: 'application/json', ...(o.json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(o.headers || {}) };
  const r = await fetch(BASE + ruta, { method: o.metodo || (cuerpo !== undefined ? 'POST' : 'GET'), headers, body: cuerpo, signal: AbortSignal.timeout(60000) });
  const tipo = r.headers.get('content-type') || '';
  return { st: r.status, datos: tipo.includes('json') ? await r.json().catch(() => null) : await r.text() };
}
async function esperar(minutos, leer, listo) {
  const hasta = Date.now() + minutos * 60000;
  let ultimo = null;
  while (Date.now() < hasta) {
    try {
      ultimo = await leer();
      if (listo(ultimo)) return ultimo;
    } catch (e) {
      ultimo = { error: e.message };
    }
    await dormir(1500);
  }
  return { ...ultimo, _seAcaboElTiempo: true };
}

const TMP = fs.mkdtempSync(path.join(RAIZ, 'temp', '_probar-agregar-'));
const ffmpeg = (args) => cp.execFileSync('ffmpeg', ['-v', 'error', '-y', ...args]);
// el video de referencia: dos escenas (un corte) con sonido, vertical
const VIDEO = path.join(TMP, 'referencia.mp4');
ffmpeg(['-f', 'lavfi', '-i', 'color=c=0x334455:s=360x640:d=2', '-f', 'lavfi', '-i', 'color=c=0xddaa55:s=360x640:d=2', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4', '-filter_complex', '[0][1]concat=n=2:v=1:a=0[v]', '-map', '[v]', '-map', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', VIDEO]);
const FOTO = path.join(TMP, 'producto.png');
ffmpeg(['-f', 'lavfi', '-i', 'color=c=0xcc3355:s=640x640', '-frames:v', '1', FOTO]);

const ENV = path.join(RAIZ, '.env');
const envPropio = !fs.existsSync(ENV);
if (envPropio) fs.writeFileSync(ENV, '# Lo escribió probar-agregar.mjs: claves falsas (el modo prueba no las usa).\nKIE_API_KEY=simulada\nELEVENLABS_API_KEY=simulada\n');
const env = { ...process.env };
for (const k of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|OPENAI_|CODEX_)/i.test(k)) delete env[k];
Object.assign(env, {
  PUERTO: String(PUERTO),
  ANUNCIOS_MODO_PRUEBA: '1',
  ANUNCIOS_PRUEBA_LIMPIO: '1',
  ANUNCIOS_CLAUDE_BIN: path.join(APP, 'server', 'claude', 'pruebas', 'claude-falso.js'),
  AIA_MOTOR: 'claude',
  FALSO_PROMPTS: path.join(TMP, 'tareas'), // lo que recibe el Claude falso, para mirar la tarea del guion
});
const log = fs.createWriteStream(path.join(TMP, 'app.log'));
const app = cp.spawn(process.execPath, ['server/index.js'], { cwd: APP, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
app.stdout.pipe(log);
app.stderr.pipe(log);
const t0 = Date.now();
const creados = { slugs: [], producto: null, referencia: null };

async function cerrar() {
  try {
    process.kill(-app.pid, 'SIGTERM');
    await dormir(1500);
    process.kill(-app.pid, 'SIGKILL');
  } catch {
    /* ya cerró */
  }
}

async function principal() {
  let arriba = false;
  for (let i = 0; i < 120 && !arriba; i++) {
    try {
      arriba = (await pedir('/api/estilos')).st === 200;
    } catch {
      await dormir(500);
    }
  }
  if (!check('La app de prueba arranca', arriba)) return;

  let r = await pedir('/api/estilos');
  const agregar = (r.datos?.estilos || []).find((e) => e.clave === 'agregar');
  check('/api/estilos trae «Agregar», instalado, en la familia «Desde tu video»', agregar?.instalado && agregar?.familia === 'referencia' && agregar?.familiaNombre === 'Desde tu video', agregar);

  // ------------------------------------------------------------ el producto
  r = await pedir('/api/productos', { json: { nombre: 'Producto Zeta', tipo: 'fisico', descripcion: 'Un suplemento para levantar y tonificar glúteos y piernas. Dos cápsulas al día.' } });
  const id = r.datos?.id;
  creados.producto = id;
  if (!check('Se crea el producto', r.st === 201 && id, r)) return;
  r = await pedir(`/api/productos/${id}/fotos/1`, { metodo: 'PUT', cuerpo: fs.readFileSync(FOTO), headers: { 'Content-Type': 'image/png' } });
  check('Se sube la foto del producto', r.st === 200, r);
  await pedir(`/api/productos/${id}/analizar`, { json: {} });
  const ficha = await esperar(5, async () => (await pedir(`/api/productos/${id}`)).datos, (d) => ['lista', 'error'].includes(d?.tarea?.estado));
  if (!check('La ficha queda lista', ficha?.tarea?.estado === 'lista', ficha?.tarea)) return;

  // ------------------------------------------------------------ sin video no hay «Agregar»
  r = await pedir('/api/anuncios', { json: { productoId: id, estilo: 'agregar', voz: { id: 'sim-narrador', nombre: 'Narrador de prueba' }, respuestas: {} } });
  check('Sin video, «Agregar» no se crea (400: falta el video)', r.st === 400 && r.datos?.tipo === 'falta-ajuste' && /video/i.test(r.datos?.error || ''), r);

  // ------------------------------------------------------------ el video, como lo sube la pantalla
  r = await pedir('/api/referencias', { cuerpo: fs.readFileSync(VIDEO), headers: { 'Content-Type': 'video/mp4', 'X-Nombre': 'referencia.mp4' } });
  creados.referencia = r.datos?.id;
  if (!check('Se sube el video de referencia (POST /api/referencias)', r.st >= 200 && r.st < 300 && r.datos?.id, r)) return;
  const clonar = `subido:${r.datos.id}|referencia.mp4`;

  const casos = [{ nombre: 'voz en off', respuestas: { clonar, angulo: 'Glúteos y piernas más levantados y firmes' }, familia: 'voz-en-off', producir: true }];
  if (process.env.AGREGAR_UGC === '1') casos.push({ nombre: 'UGC', respuestas: { clonar, formato: 'Una persona habla a cámara' }, familia: 'ugc', producir: true });

  // ------------------------------------------------------------ con un pedido que nombra otro estilo
  const pedidos = [
    { pedido: 'Quiero este mismo video pero estilo Pixar narrado, que dure 1:30, manteniendo el guion y los ángulos', estilo: 'estilo-pixar', skill: 'anuncios-estilo-pixar', duracion: '1:30', guion: true },
    // (el musical sigue con su letra: el Claude falso no tiene letra de muestra aqui, asi que solo se mira el paso al estilo)
    { pedido: 'Hazlo como musical, de 1 minuto', estilo: 'musical', skill: 'anuncios-musicales', duracion: null, guion: false },
  ];
  for (const x of pedidos) {
    console.log(`\n  — «Agregar» con tu pedido: «${x.pedido}»`);
    r = await pedir('/api/anuncios', { json: { productoId: id, estilo: 'agregar', voz: { id: 'sim-narrador', nombre: 'Narrador de prueba' }, respuestas: { clonar, pedido: x.pedido } } });
    const slug = r.datos?.slug;
    if (!check('Se crea el anuncio «Agregar» con el pedido escrito', r.st === 201 && slug, r)) continue;
    creados.slugs.push(slug);
    const dir = path.join(RAIZ, 'temp', slug);
    const pasado = await esperar(6, async () => leerJSON(path.join(dir, 'app', 'brief.json')), (b) => b?.estilo === x.estilo);
    check(`El plan pasa el anuncio a ${x.estilo} (brief.estilo, con el pedido y el plan en brief.agregar)`, pasado?.estilo === x.estilo && pasado?.agregar?.plan?.estilo === x.estilo && /1:30|1 minuto|musical/.test(pasado?.agregar?.pedido || ''), { estilo: pasado?.estilo, agregar: pasado?.agregar });
    if (x.duracion) check(`La duración del pedido queda en el anuncio (${x.duracion})`, pasado?.duracion?.decide === 'usuario' && pasado?.duracion?.segundos === 90, pasado?.duracion);
    if (x.estilo === 'musical') check('El musical se lleva lo que el pedido contesta (visual: Zack D Films)', pasado?.opciones?.visual === 'zack-d-films' && pasado?.faseGuion === 'letras', pasado?.opciones);
    const tarea = await esperar(1, async () => {
      const d = path.join(TMP, 'tareas');
      return (fs.existsSync(d) ? fs.readdirSync(d) : []).map((f) => fs.readFileSync(path.join(d, f), 'utf8')).find((t) => t.includes(`temp/${slug}`) && t.includes(`skills/${x.skill}/SKILL.md`) && /TAREA: guion/.test(t)) || '';
    }, (t) => Boolean(t));
    check(`La segunda sesión sigue la skill de ese estilo (${x.skill}) con el video y el pedido`, /## El video y el pedido del usuario \(Agregar\)/.test(tarea) && /guion-clonado\.md/.test(tarea) && /nunca se corta el final/.test(tarea) && /modelo_video/.test(tarea));
    if (!x.guion) continue;
    const g = await esperar(6, async () => (await pedir(`/api/anuncios/${slug}/guion`)).datos, (d) => ['listo', 'error', 'bloqueado'].includes(d?.estado));
    if (!check('El guion de ese estilo queda listo', g?.estado === 'listo', { estado: g?.estado, error: g?.error, progreso: g?.progreso })) continue;
    check('En la revisión se ve lo que entendió: estilo, duración y lo que se conserva', g.plan?.estiloNombre === 'Estilo Pixar' && g.plan?.duracion === '1:30' && g.plan?.conserva?.length > 0 && g.brief?.estilo === 'estilo-pixar', g.plan);
    check('El progreso cuenta el paso al estilo pedido', (g.progreso || []).some((p) => /Tu pedido: Estilo Pixar/.test(p)), g.progreso);
    const costo = await esperar(1, async () => (await pedir(`/api/anuncios/${slug}/costo`)).datos, (d) => d?.disponible === true || d?.motivo === 'no-se-pudo');
    check('El costo se muestra antes de aprobar, con el modelo de cada escena', costo?.disponible === true && costo?.familia === 'voz-en-off' && (costo?.notas || []).some((n) => /Modelo elegido por escena/.test(n)), costo);
    const lista = (await pedir('/api/anuncios')).datos;
    const enLista = JSON.stringify(lista || '').includes('Agregar · Estilo Pixar');
    check('En Mis anuncios se ve «Agregar · Estilo Pixar»', enLista);
  }

  for (const caso of casos) {
    console.log(`\n  — «Agregar» (${caso.nombre})`);
    r = await pedir('/api/anuncios', { json: { productoId: id, estilo: 'agregar', voz: { id: 'sim-narrador', nombre: 'Narrador de prueba' }, respuestas: caso.respuestas } });
    const slug = r.datos?.slug;
    if (!check('Se crea el anuncio «Agregar»', r.st === 201 && slug, r)) continue;
    creados.slugs.push(slug);
    const dir = path.join(RAIZ, 'temp', slug);
    const g = await esperar(6, async () => (await pedir(`/api/anuncios/${slug}/guion`)).datos, (d) => ['listo', 'error', 'bloqueado'].includes(d?.estado));
    if (!check('El guion queda listo', g?.estado === 'listo', { estado: g?.estado, error: g?.error, progreso: g?.progreso?.slice?.(-6) })) continue;
    check('El video quedó analizado (referencia/adn-base.json y hoja-tomas.jpg)', fs.existsSync(path.join(dir, 'referencia', 'adn-base.json')) && fs.existsSync(path.join(dir, 'referencia', 'hoja-tomas.jpg')));
    const brief = leerJSON(path.join(dir, 'app', 'brief.json'));
    check(`La familia salió del video: ${caso.familia} (brief.produccion y /guion)`, brief?.produccion === caso.familia && brief?.familia === caso.familia && g.familia === caso.familia, { brief: { produccion: brief?.produccion, familia: brief?.familia }, guion: g.familia });
    const modelos = g.guion?.modelos || [];
    check('guion.json trae el modelo de cada escena («modelos», contado del manifiesto)', modelos.length >= 1 && modelos.every((x) => x.modelo && x.para), modelos);
    const dirTareas = path.join(TMP, 'tareas');
    const tarea = (fs.existsSync(dirTareas) ? fs.readdirSync(dirTareas) : []).map((f) => fs.readFileSync(path.join(dirTareas, f), 'utf8')).find((t) => t.includes(`temp/${slug}`) && /TAREA: guion/.test(t)) || '';
    check('El plan de tu pedido se muestra (el mismo look del video)', g.plan?.estilo === 'agregar' && g.plan?.conserva?.length > 0, g.plan);
    check('La tarea del guion nombra la skill anuncios-agregar y «Tu video»', /anuncios-agregar\/SKILL\.md/.test(tarea) && /Tu video/.test(tarea));

    const costo = await esperar(1, async () => (await pedir(`/api/anuncios/${slug}/costo`)).datos, (d) => d?.disponible === true || d?.motivo === 'no-se-pudo');
    check('El costo estimado se muestra antes de aprobar (> 0)', costo?.disponible === true && Number(costo?.creditos?.min) > 0, costo);
    check('El costo dice cuántas escenas van con cada modelo', (costo?.notas || []).some((n) => /Modelo elegido por escena/.test(n)), costo?.notas);
    if (!caso.producir) continue;

    r = await pedir(`/api/anuncios/${slug}/producir`, { json: {} });
    if (!check('Se aprueba y arranca la producción', r.st >= 200 && r.st < 300, r)) continue;
    const vistos = new Map();
    const c = await esperar(30, async () => {
      const d = (await pedir(`/api/anuncios/${slug}/conductor`)).datos;
      for (const p of d?.pasos || []) {
        if (vistos.get(p.id) !== p.estado) {
          vistos.set(p.id, p.estado);
          if (p.estado !== 'pendiente') console.log(`        · ${Math.round((Date.now() - t0) / 1000)} s  ${p.id}: ${p.estado}${p.nota ? ` (${String(p.nota).slice(0, 100)})` : ''}`);
        }
      }
      return d;
    }, (d) => ['listo', 'error', 'pausado'].includes(d?.estado));
    if (!check('La producción termina («listo»)', c?.estado === 'listo', { estado: c?.estado, paso: c?.paso, pasos: (c?.pasos || []).map((p) => `${p.id}=${p.estado}${p.error ? `:${p.error.mensaje}` : ''}`) })) continue;
    check('La familia que produjo es la del video', c?.familia === caso.familia, c?.familia);
    const log = leerJSON(path.join(dir, 'video', 'log-modelos.json'));
    const usados = Object.fromEntries((log?.clips || log?.registros || []).map((x) => [x.id || x.clip || x.archivo, x.modelo]));
    const plano = JSON.stringify(log || {});
    if (caso.familia === 'ugc') check('Los bloques salieron con Omni Flash 1.2 (su modelo_video)', /gemini-omni-flash-1-2/.test(plano), log);
    else check('Cada clip salió con su modelo (PixVerse en el antes y después, Grok Imagine 1.5 en el B-roll)', /pixverse-v6/.test(plano) && /grok-imagine-video-1-5/.test(plano) && /gemini-omni-flash-1-2/.test(plano), usados && Object.keys(usados).length ? usados : log);
    if (caso.familia !== 'ugc') check('El B-roll quieto no se le pidió a kie (sin clip generado por modelo)', !/broll-2[^}]*pixverse|broll-2[^}]*grok/.test(plano));
    const informe = leerJSON(path.join(dir, 'app', 'informe.json'));
    console.log(`        (cobrado en el simulador: ${informe?.costo?.creditos ?? '?'} créditos; estimado antes de aprobar: ${costo?.creditos?.min ?? '?'})`);
    const mp4 = fs.readdirSync(path.join(RAIZ, 'output')).filter((f) => f.startsWith(slug) && f.endsWith('.mp4'));
    check(`Sale el MP4 (${mp4.join(', ') || 'ninguno'})`, mp4.length >= 1);
  }
}

try {
  await principal();
} catch (e) {
  check('La prueba no se cae', false, String(e?.stack || e));
} finally {
  await cerrar();
  // lo que dejó la prueba (nunca otra cosa)
  for (const slug of creados.slugs) {
    fs.rmSync(path.join(RAIZ, 'temp', slug), { recursive: true, force: true });
    for (const f of fs.existsSync(path.join(RAIZ, 'output')) ? fs.readdirSync(path.join(RAIZ, 'output')) : []) if (f.startsWith(slug)) fs.rmSync(path.join(RAIZ, 'output', f), { recursive: true, force: true });
  }
  if (creados.producto) fs.rmSync(path.join(RAIZ, 'temp', '_productos', creados.producto), { recursive: true, force: true });
  if (creados.referencia) for (const f of fs.readdirSync(path.join(RAIZ, 'temp', '_referencias')).filter((n) => n.startsWith(creados.referencia))) fs.rmSync(path.join(RAIZ, 'temp', '_referencias', f), { force: true });
  try {
    fs.rmdirSync(path.join(RAIZ, 'temp', '_referencias')); // solo si quedó vacía (la creó la prueba)
  } catch {
    /* tiene otros videos, o no está */
  }
  fs.rmSync(path.join(RAIZ, 'temp', `_modo-prueba-${PUERTO}`), { recursive: true, force: true });
  if (envPropio) fs.rmSync(ENV, { force: true });
  if (fallas) console.log(`\n  Registro de la app: ${path.join(TMP, 'app.log')}`);
  else fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n  ${pasan} bien, ${fallas} mal · ${Math.round((Date.now() - t0) / 1000)} s\n`);
  process.exit(fallas ? 1 : 0);
}

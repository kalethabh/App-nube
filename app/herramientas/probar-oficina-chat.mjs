// Prueba del chat con la coordinadora y del 👍/👎 que enseña (lib/oficina-chat.js), SIN GASTAR NADA.
//   node app/herramientas/probar-oficina-chat.mjs        (PUERTO=<n>, por defecto 4492)
// Arranca la app en MODO PRUEBA con el Claude falso y:
//   · crea un producto con su ficha;
//   · le escribe a la coordinadora «hazme 2 anuncios»: contesta, crea 2 guiones de Claymation (con el pedido en el brief) y la
//     acción muestra su estado en vivo; nada pasa a producción;
//   · «regla: …» se anota en los aprendizajes (general.md) y aparece en el panel de la coordinadora;
//   · el 👎 sin texto se rechaza; con texto y partes queda como regla del estilo y en el panel del agente de esa parte;
//   · al terminar deja todo como estaba (anuncios, producto, chat y aprendizajes).
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = path.resolve(APP, '..');
const PUERTO = Number(process.env.PUERTO) || 4492;
const BASE = `http://127.0.0.1:${PUERTO}`;
const leerSesion = (slug) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', slug, 'app', 'sesion.json'), 'utf8'));
  } catch {
    return null;
  }
};
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
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
    await dormir(700);
  }
  return { ...ultimo, _seAcaboElTiempo: true };
}

// lo que la prueba toca y deja como estaba
const APRENDIZAJES = path.join(RAIZ, 'mis_archivos', 'biblioteca', 'aprendizajes');
const RESPALDOS = [path.join(RAIZ, 'temp', `_modo-prueba-${PUERTO}`, 'config.json'), path.join(APRENDIZAJES, 'general.md'), path.join(APRENDIZAJES, 'claymation.md'), path.join(RAIZ, 'temp', '_oficina', 'chat.json'), path.join(RAIZ, 'temp', '_oficina', 'aprendido.json')];
const antes = new Map(RESPALDOS.map((f) => [f, fs.existsSync(f) ? fs.readFileSync(f) : null]));
const oficinaExistia = fs.existsSync(path.join(RAIZ, 'temp', '_oficina'));

const TMP = fs.mkdtempSync(path.join(RAIZ, 'temp', '_probar-oficina-'));
const FOTO = path.join(TMP, 'producto.png');
cp.execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0xcc3355:s=640x640', '-frames:v', '1', FOTO]);
const ENV = path.join(RAIZ, '.env');
const envPropio = !fs.existsSync(ENV);
if (envPropio) fs.writeFileSync(ENV, '# Lo escribió probar-oficina-chat.mjs: claves falsas.\nKIE_API_KEY=simulada\nELEVENLABS_API_KEY=simulada\n');
const env = { ...process.env };
for (const k of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|OPENAI_|CODEX_)/i.test(k)) delete env[k];
Object.assign(env, { PUERTO: String(PUERTO), ANUNCIOS_MODO_PRUEBA: '1', ANUNCIOS_PRUEBA_LIMPIO: '1', ANUNCIOS_SIN_GUARDADO: '1', ANUNCIOS_CLAUDE_BIN: path.join(APP, 'server', 'claude', 'pruebas', 'claude-falso.js'), AIA_MOTOR: 'claude' });
const log = fs.createWriteStream(path.join(TMP, 'app.log'));
const app = cp.spawn(process.execPath, ['server/index.js'], { cwd: APP, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
app.stdout.pipe(log);
app.stderr.pipe(log);
const t0 = Date.now();
const creados = { slugs: [], producto: null };

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
  await pedir('/api/oficina/chat', { metodo: 'DELETE' });

  let r = await pedir('/api/productos', { json: { nombre: 'Producto Oficina', tipo: 'fisico', descripcion: 'Un colágeno en polvo para la piel. Una cucharada al día.' } });
  const id = r.datos?.id;
  creados.producto = id;
  if (!check('Se crea el producto', r.st === 201 && id, r)) return;
  await pedir(`/api/productos/${id}/fotos/1`, { metodo: 'PUT', cuerpo: fs.readFileSync(FOTO), headers: { 'Content-Type': 'image/png' } });
  await pedir(`/api/productos/${id}/analizar`, { json: {} });
  const ficha = await esperar(5, async () => (await pedir(`/api/productos/${id}`)).datos, (d) => ['lista', 'error'].includes(d?.tarea?.estado));
  if (!check('La ficha queda lista', ficha?.tarea?.estado === 'lista', ficha?.tarea)) return;

  // ------------------------------------------------------------ el chat
  r = await pedir('/api/oficina/chat', { json: { texto: '   ' } });
  check('Un mensaje vacío se rechaza (400)', r.st === 400, r);
  r = await pedir('/api/oficina/chat', { json: { texto: 'Hazme 2 anuncios para vender más' } });
  check('El mensaje se guarda y la coordinadora queda «pensando»', r.st === 200 && r.datos?.mensajes?.at(-1)?.de === 'tu' && r.datos?.pensando === true, r.datos);
  const r2 = await pedir('/api/oficina/chat', { json: { texto: 'otro' } });
  check('Mientras contesta no se le puede escribir otra vez (409)', r2.st === 409, r2);
  let c = await esperar(3, async () => (await pedir('/api/oficina/chat')).datos, (d) => d && !d.pensando);
  const resp = c?.mensajes?.at(-1);
  check('Contesta la coordinadora', resp?.de === 'coordinadora' && /guion/i.test(resp?.texto || ''), c);
  const anuncios = (resp?.acciones || []).filter((a) => a.tipo === 'anuncio' && a.ok);
  creados.slugs.push(...anuncios.map((a) => a.slug));
  check('Crea los 2 guiones de Claymation con su enlace', anuncios.length === 2 && anuncios.every((a) => /^#\/nuevo\?producto=/.test(a.href) && a.slug), resp?.acciones);
  const brief = JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', anuncios[0]?.slug || '-', 'app', 'brief.json'), 'utf8'));
  check('El pedido llega al brief del guion (con «versión 1 de 2»)', brief.estilo === 'claymation' && /versión 1 de 2/.test(brief.pedido || ''), brief);
  // (el Claude falso escribe el guion copiando la muestra temp/befen-regulador-apetito; sin ella, solo se ve que arrancó)
  const hayMuestra = fs.existsSync(path.join(RAIZ, 'temp', 'befen-regulador-apetito', 'manifiesto.json'));
  if (hayMuestra) {
    c = await esperar(3, async () => (await pedir('/api/oficina/chat')).datos, (d) => d?.mensajes?.at(-1)?.acciones?.filter((a) => a.slug).every((a) => a.estado === 'aprobar'));
    check('El estado de cada guion se ve en vivo y queda esperando tu aprobación', c?.mensajes?.at(-1)?.acciones?.filter((a) => a.slug).every((a) => a.estado === 'aprobar'), c?.mensajes?.at(-1)?.acciones);
  } else {
    c = (await pedir('/api/oficina/chat')).datos;
    const acc = c?.mensajes?.at(-1)?.acciones?.filter((a) => a.slug) || [];
    check('Cada guion arrancó y su estado se ve en vivo (sin la muestra del Claude falso no se termina)', acc.length === 2 && acc.every((a) => a.estado && a.estado !== 'no-esta' && leerSesion(a.slug)?.tipo === 'guion'), acc);
  }
  check('Nada pasó a producción', anuncios.every((a) => !fs.existsSync(path.join(RAIZ, 'temp', a.slug, 'app', 'conductor.json'))));

  r = await pedir('/api/oficina/chat', { json: { texto: 'regla: los ganchos de prueba duran menos de 3 segundos' } });
  c = await esperar(3, async () => (await pedir('/api/oficina/chat')).datos, (d) => d && !d.pensando && d.mensajes.at(-1)?.de === 'coordinadora');
  const regla = c?.mensajes?.at(-1)?.acciones?.[0];
  check('«regla: …» queda anotada', regla?.tipo === 'regla' && regla.ok, c?.mensajes?.at(-1));
  const general = fs.readFileSync(path.join(APRENDIZAJES, 'general.md'), 'utf8');
  check('…en los aprendizajes generales (general.md)', general.includes('- los ganchos de prueba duran menos de 3 segundos'));

  // ------------------------------------------------------------ el 👍/👎
  const slug = anuncios[0].slug;
  r = await pedir(`/api/anuncios/${slug}/opinion`, { json: { voto: 'mal', partes: ['clips'] } });
  check('👎 sin decir qué no gustó se rechaza (400)', r.st === 400, r);
  r = await pedir(`/api/anuncios/${slug}/opinion`, { json: { voto: 'mal', partes: ['clips', 'guion'], texto: 'los clips de prueba se ven oscuros' } });
  check('👎 con texto queda como regla', r.st === 200 && /Evitar .*clips.*: los clips de prueba se ven oscuros/.test(r.datos?.reglas?.[0] || ''), r);
  const ugc = fs.readFileSync(path.join(APRENDIZAJES, 'claymation.md'), 'utf8');
  check('…de su estilo (claymation.md)', ugc.includes('los clips de prueba se ven oscuros'));
  r = await pedir(`/api/anuncios/${slug}/opinion`);
  check('La entrega sabe que ya opinaste', r.datos?.opinion?.voto === 'mal', r);
  const of = (await pedir('/api/oficina')).datos;
  const video = of.agentes.find((a) => a.id === 'video');
  const guion = of.agentes.find((a) => a.id === 'guion');
  const coord = of.agentes.find((a) => a.id === 'coordinacion');
  check('El productor de video (clips) y el guionista cuentan el 👎 y lo aprendido esta semana', video.opiniones.mal === 1 && video.semana.some((s) => /oscuros/.test(s.regla)) && guion.opiniones.mal === 1, { video, guion: guion.opiniones });
  check('La coordinadora muestra la regla del chat', coord.semana.some((s) => /3 segundos/.test(s.regla)), coord.semana);
  // ------------------------------------------------------------ diseñar la oficina
  let d = (await pedir('/api/oficina')).datos;
  const base = d.zonas.map((z) => ({ id: z.id, lugar: z.lugar, nombre: z.nombre, color: z.color, tipo: z.tipo }));
  const cafe = base.find((z) => z.id === 'cafe');
  const guionZ = base.find((z) => z.id === 'guion');
  const libre = [...Array(d.lugares).keys()].find((n) => !base.some((z) => z.lugar === n));
  const cambiada = base.map((z) => (z.id === 'cafe' ? { ...z, lugar: guionZ.lugar } : z.id === 'guion' ? { ...z, lugar: cafe.lugar, nombre: 'Guionistas', color: '#38bdf8' } : z));
  r = await pedir('/api/oficina/zonas', { metodo: 'PUT', json: { zonas: [...cambiada, { nueva: true, nombre: 'Tráfico pago', tipo: 'datos', color: '#fb923c', lugar: libre }] } });
  const z2 = r.datos?.zonas || [];
  const propia = z2.find((z) => z.propia);
  check('Se intercambian dos salas, se renombra una y se crea una propia en el lugar libre', r.st === 200 && z2.find((z) => z.id === 'cafe')?.lugar === guionZ.lugar && z2.find((z) => z.id === 'guion')?.nombre === 'Guionistas' && propia?.nombre === 'Tráfico pago' && propia.tipo === 'datos' && propia.lugar === libre, r);
  r = await pedir('/api/oficina/zonas', { metodo: 'PUT', json: { zonas: [...cambiada, { nueva: true, nombre: 'Otra', tipo: 'datos', lugar: cafe.lugar }] } });
  check('Dos salas en el mismo lugar se rechazan (400)', r.st === 400, r);
  r = await pedir('/api/oficina/zonas', { metodo: 'PUT', json: { zonas: base } });
  check('Guardar sin la propia la borra y todo vuelve a su lugar', r.st === 200 && !r.datos.zonas.some((z) => z.propia) && r.datos.zonas.find((z) => z.id === 'cafe')?.lugar === cafe.lugar, r.datos?.zonas);
  r = await pedir(`/api/anuncios/no-existe/opinion`, { json: { voto: 'bien' } });
  check('Opinar de un anuncio que no existe da 404', r.st === 404, r);
}

try {
  await principal();
} catch (e) {
  check('La prueba no se cae', false, String(e?.stack || e));
} finally {
  try {
    process.kill(-app.pid, 'SIGTERM');
    await dormir(1500);
    process.kill(-app.pid, 'SIGKILL');
  } catch {
    /* ya cerró */
  }
  for (const slug of creados.slugs) if (slug) fs.rmSync(path.join(RAIZ, 'temp', slug), { recursive: true, force: true });
  if (creados.producto) fs.rmSync(path.join(RAIZ, 'temp', '_productos', creados.producto), { recursive: true, force: true });
  for (const [f, v] of antes) {
    if (v === null) fs.rmSync(f, { force: true });
    else fs.writeFileSync(f, v);
  }
  if (!oficinaExistia) fs.rmSync(path.join(RAIZ, 'temp', '_oficina'), { recursive: true, force: true });
  fs.rmSync(path.join(RAIZ, 'temp', `_modo-prueba-${PUERTO}`), { recursive: true, force: true });
  if (envPropio) fs.rmSync(ENV, { force: true });
  if (fallas) console.log(`\n  Registro de la app: ${path.join(TMP, 'app.log')}`);
  else fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n  ${pasan} bien, ${fallas} mal · ${Math.round((Date.now() - t0) / 1000)} s\n`);
  process.exit(fallas ? 1 : 0);
}

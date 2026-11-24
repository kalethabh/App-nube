// Prueba de LANDINGS (lib/landings/, rutas/landings.js), sin internet: una tienda falsa en este proceso (HTML con CSS en
// <link> y <style>, @import, una fuente, imágenes, un carrusel tipo Swiper con una diapositiva clonada, un GIF, scripts
// de la tienda y enlaces relativos) y la app en MODO PRUEBA con el Claude falso.
//   node app/herramientas/probar-landings.mjs        (PUERTO=<n>, por defecto 4493)
// Revisa: validaciones, clonar «tal cual» (textos e imágenes de la original, imágenes locales, sin scripts de la tienda,
// carrusel armado y sin clones, CSS podado, enlaces a la tienda original), la vista comprimida y lo que no se deja ver,
// el zip, «Para mi producto» (la IA cambia los textos y la imagen del producto), medir otra vez y borrar.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = path.resolve(APP, '..');
const PUERTO = Number(process.env.PUERTO) || 4493;
const BASE = `http://127.0.0.1:${PUERTO}`;
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
  return { st: r.status, datos: await r.json().catch(() => null) };
}
async function esperar(seg, leer, listo) {
  const hasta = Date.now() + seg * 1000;
  let u = null;
  while (Date.now() < hasta) {
    u = await leer();
    if (listo(u)) return u;
    await dormir(500);
  }
  return u;
}

const TMP = fs.mkdtempSync(path.join(RAIZ, 'temp', '_probar-landings-'));
const ff = (...a) => cp.execFileSync('ffmpeg', ['-v', 'error', '-y', ...a]);
ff('-f', 'lavfi', '-i', 'color=c=0x33aa55:s=640x640', '-frames:v', '1', path.join(TMP, 'producto.png'));
ff('-f', 'lavfi', '-i', 'testsrc=s=900x600', '-frames:v', '1', path.join(TMP, 'portada.png'));
ff('-f', 'lavfi', '-i', 'testsrc2=s=600x600', '-frames:v', '1', path.join(TMP, 'slide.png'));
ff('-f', 'lavfi', '-i', 'testsrc=s=320x320:d=2:r=10', path.join(TMP, 'anim.gif'));

// ------------------------------------------------------------ la tienda falsa
const PAGINA = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>MARCAORIGINAL Gotas</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/css/tema.css">
<style>.oferta{color:#c00;font-weight:800}.nunca-se-usa-aqui{color:blue}</style>
<script src="/js/tienda.js"></script>
<script>window.rastreo = 1;</script>
<script type="application/ld+json">{"@type":"Product","name":"MARCAORIGINAL"}</script>
</head><body class="template-product overflow-hidden" style="overflow:hidden"><div class="kl-private-reset-css needsclick klaviyo-form-popup" role="dialog" aria-modal="true" style="position:fixed;inset:0;z-index:999"><h2>Try your luck POPUPRULETA</h2><button>No, thanks</button></div>
<header class="cabeza"><a href="/collections/all">Tienda</a></header>
<main>
<h1 class="titulo">MARCAORIGINAL Gotas para dormir</h1>
<img class="portada" src="/img/portada.png" alt="MARCAORIGINAL frasco">
<p class="oferta">Lleva 2 y ahorra 40%</p>
<div class="swiper"><div class="swiper-wrapper" style="transform:translate3d(-600px,0,0);width:3000px">
<div class="swiper-slide"><img src="/img/slide.png" alt="uno"></div>
<div class="swiper-slide"><img src="/img/slide.png?v=2" alt="dos"></div>
<div class="swiper-slide swiper-slide-duplicate"><img src="/img/slide.png" alt="uno"></div>
</div></div>
<img src="/img/anim.gif" alt="animación">
<p>Lo recomiendan miles de clientes de MARCAORIGINAL.</p>
<div style="height:3000px"></div>
<img src="/img/slide.png?v=3" alt="abajo 1"><img src="/img/slide.png?v=4" alt="abajo 2">
<form action="/cart/add" method="post"><button class="comprar">Comprar ahora</button></form>
</main></body></html>`;
const ARCHIVOS = {
  '/css/tema.css': ['text/css', '@import url("/css/base.css");\n.titulo{font-family:Marca,sans-serif;font-size:28px}.portada{width:100%;background:url(/img/slide.png)}.comprar{background:#111;color:#fff}.clase-que-no-esta{margin:99px}\n@font-face{font-family:Marca;src:url(/fuentes/marca.woff2) format("woff2")}'],
  '/css/base.css': ['text/css', 'body{margin:0;font-family:sans-serif}.otra-que-no-esta{padding:3px}'],
  '/fuentes/marca.woff2': ['font/woff2', Buffer.alloc(2000, 1)],
  '/js/tienda.js': ['text/javascript', 'document.body.dataset.tienda="si";'],
  '/img/portada.png': ['image/png', fs.readFileSync(path.join(TMP, 'portada.png'))],
  '/img/slide.png': ['image/png', fs.readFileSync(path.join(TMP, 'slide.png'))],
  '/img/anim.gif': ['image/gif', fs.readFileSync(path.join(TMP, 'anim.gif'))],
};
const pedidosTienda = [];
const tienda = http.createServer((req, res) => {
  const ruta = req.url.split('?')[0];
  pedidosTienda.push(ruta);
  if (ruta === '/products/gotas') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(PAGINA);
  }
  const a = ARCHIVOS[ruta];
  if (!a) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { 'Content-Type': a[0] });
  res.end(a[1]);
});
await new Promise((ok) => tienda.listen(0, '127.0.0.1', ok));
const TIENDA = `http://127.0.0.1:${tienda.address().port}`;
const URL_LANDING = `${TIENDA}/products/gotas`;

// ------------------------------------------------------------ la app
const ENV = path.join(RAIZ, '.env');
const envPropio = !fs.existsSync(ENV);
if (envPropio) fs.writeFileSync(ENV, '# Lo escribió probar-landings.mjs: claves falsas.\nKIE_API_KEY=simulada\nELEVENLABS_API_KEY=simulada\n');
const landingsExistia = fs.existsSync(path.join(RAIZ, 'temp', '_landings'));
const env = { ...process.env };
for (const k of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|OPENAI_|CODEX_|LANDINGS_)/i.test(k)) delete env[k];
Object.assign(env, { PUERTO: String(PUERTO), ANUNCIOS_MODO_PRUEBA: '1', ANUNCIOS_PRUEBA_LIMPIO: '1', ANUNCIOS_SIN_GUARDADO: '1', ANUNCIOS_CLAUDE_BIN: path.join(APP, 'server', 'claude', 'pruebas', 'claude-falso.js'), AIA_MOTOR: 'claude', OFICINA_SIN_SEGUIMIENTO: '1', NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost' });
const log = fs.createWriteStream(path.join(TMP, 'app.log'));
const app = cp.spawn(process.execPath, ['server/index.js'], { cwd: APP, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
app.stdout.pipe(log);
app.stderr.pipe(log);
const t0 = Date.now();
const creados = { producto: null, landings: [] };
const leerLanding = async (id) => (await pedir(`/api/landings/${id}`)).datos;
const terminada = (d) => ['lista', 'error'].includes(d?.estado);
const html = (id) => fs.readFileSync(path.join(RAIZ, 'temp', '_landings', id, 'index.html'), 'utf8');

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
  let r = await pedir('/api/productos', { json: { nombre: 'Sueño Profundo', tipo: 'fisico', descripcion: 'Unas gotas de melatonina para dormir mejor. Cinco gotas en la noche.' } });
  const prod = r.datos?.id;
  creados.producto = prod;
  await pedir(`/api/productos/${prod}/fotos/1`, { metodo: 'PUT', cuerpo: fs.readFileSync(path.join(TMP, 'producto.png')), headers: { 'Content-Type': 'image/png' } });

  // validaciones
  r = await pedir('/api/landings', { json: { url: 'no-es-url', modo: 'tal-cual', motor: 'claude' } });
  check('Una dirección que no es URL se rechaza', r.st === 400, r);
  r = await pedir('/api/landings', { json: { url: URL_LANDING, modo: 'adaptar', motor: 'claude', productoId: 'no-existe' } });
  check('«Para mi producto» sin un producto real se rechaza', r.st === 400, r);
  r = await pedir('/api/landings', { json: { url: URL_LANDING, modo: 'tal-cual', motor: 'claude' }, headers: { Origin: 'https://otro-sitio.com' } });
  check('Desde otro sitio no se puede crear', r.st === 403, r);

  // tal cual
  r = await pedir('/api/landings', { json: { url: URL_LANDING, modo: 'tal-cual', motor: 'claude' } });
  const id1 = r.datos?.id;
  if (id1) creados.landings.push(id1);
  check('Se crea la landing y arranca a clonar', r.st === 200 && id1 && r.datos.estado === 'trabajando', r);
  let l = await esperar(240, () => leerLanding(id1), terminada);
  check('Termina «lista»', l?.estado === 'lista', l);
  check('El título es el de la página', /MARCAORIGINAL Gotas/.test(l?.titulo || ''), l?.titulo);
  check('Mide la original y la copia (simulado en prueba)', l?.puntajes?.original?.puntaje > 0 && l?.puntajes?.copia?.puntaje >= 80, l?.puntajes);
  const h1 = id1 && fs.existsSync(path.join(RAIZ, 'temp', '_landings', id1, 'index.html')) ? html(id1) : '';
  const assets = id1 ? fs.readdirSync(path.join(RAIZ, 'temp', '_landings', id1, 'assets')) : [];
  check('Conserva los textos de la original', /MARCAORIGINAL Gotas para dormir/.test(h1) && /Lleva 2 y ahorra 40%/.test(h1) && /Comprar ahora/.test(h1), h1.slice(0, 600));
  check('Sin los scripts de la tienda (queda el JSON-LD)', !/tienda\.js|window\.rastreo/.test(h1) && /application\/ld\+json/.test(h1), h1.match(/<script[^>]*>/g));
  check('Las imágenes quedan dentro de la landing (assets/)', /<img[^>]+src="assets\//.test(h1) && !/src="\/img\//.test(h1) && assets.length >= 3, assets);
  check('Las imágenes pesadas pasan a WebP y llevan su tamaño', /\.webp"/.test(h1) && /<img[^>]+width="\d+"[^>]+height="\d+"|<img[^>]+height="\d+"[^>]+width="\d+"/.test(h1), h1.match(/<img[^>]*>/g));
  check('La primera imagen grande se carga primero y las demás perezosas', /fetchpriority="high"/.test(h1) && /loading="lazy"/.test(h1), h1.match(/<img[^>]*>/g));
  check('El carrusel queda armado y sin la diapositiva clonada', /kc-carrusel/.test(h1) && !/swiper-slide-duplicate/.test(h1) && !/translate3d\(-600px/.test(h1) && (h1.match(/swiper-slide"/g) || []).length + (h1.match(/swiper-slide /g) || []).length >= 2, h1.match(/<div class="swiper[^>]*>/g));
  check('El CSS se trae (también el @import) y queda dentro', /\.comprar\{/.test(h1) && /\.oferta\{/.test(h1) && /margin:0/.test(h1) && !/<link[^>]+stylesheet/.test(h1));
  check('El CSS que no se usa se poda', !/clase-que-no-esta|otra-que-no-esta|nunca-se-usa-aqui/.test(h1));
  check('La fuente queda local y con font-display:swap', /url\(assets\/[^)]+\.woff2\)/.test(h1) && /font-display:swap/.test(h1));
  check('Los enlaces y el formulario van a la tienda original', h1.includes(`href="${TIENDA}/collections/all"`) && h1.includes(`action="${TIENDA}/cart/add"`), h1.match(/(href|action)="[^"]*"/g));
  check('(2026-11-24) Sin el popup de la app («Try your luck») ni el bloqueo del scroll: la página se puede usar', !/POPUPRULETA/.test(h1) && !/overflow-hidden/.test((h1.match(/<body[^>]*>/) || [''])[0]) && !/overflow:\s*hidden/.test((h1.match(/<body[^>]*>/) || [''])[0]) && /MARCAORIGINAL Gotas para dormir/.test(h1) && l?.informe?.avisos?.some((a) => /popup/.test(a)), { body: (h1.match(/<body[^>]*>/) || [''])[0], avisos: l?.informe?.avisos });
  check('El informe dice qué hizo', l?.informe?.scripts >= 2 && l.informe.imagenes >= 3 && l.informe.carruseles >= 1 && l.informe.pesos?.html > 0, l?.informe);
  // (2026-11-24) el análisis de la landing (la IA lee sus textos en orden)
  check('Trae su análisis: resumen, gancho, oferta y las secciones en orden', l?.analisis?.resumen && l.analisis.gancho && l.analisis.oferta && l.analisis.secciones?.length >= 2 && l.analisis.secciones[0].n === 1 && l.analisis.ideas?.length >= 1, l?.analisis);
  r = await pedir(`/api/landings/${id1}/analizar`, { metodo: 'POST', json: {} });
  const otra = await esperar(120, () => leerLanding(id1), (x) => x && !x.trabajando && x.estado !== 'analizando');
  check('«Analizar otra vez» la vuelve a analizar', r.st === 200 && otra?.estado === 'lista' && otra.analisis?.fecha && otra.analisis.fecha !== l.analisis.fecha, { st: r.st, estado: otra?.estado });

  // la vista
  let v = await fetch(`${BASE}/landing/${id1}/index.html`, { headers: { 'Accept-Encoding': 'gzip' } });
  check('La vista se sirve comprimida', v.status === 200 && v.headers.get('content-encoding') === 'gzip' && /MARCAORIGINAL/.test(await v.text()));
  v = await fetch(`${BASE}/landing/${id1}/assets/${assets[0]}`);
  check('Y sus imágenes, con caché larga', v.status === 200 && /max-age=31536000/.test(v.headers.get('cache-control') || ''));
  const ocultos = await Promise.all(['landing.json', 'original.html', '..%2F..%2F..%2F.env', 'registro-ia.log'].map(async (f) => (await fetch(`${BASE}/landing/${id1}/${f}`)).status));
  const fuera = await fetch(`${BASE}/landing/${id1}/..%2F..%2F..%2F.env`).then(async (x) => [x.status, await x.text()]);
  check('No deja ver landing.json, la original, el registro ni salir de la carpeta', ocultos.every((s) => s === 404) && !/KIE_API_KEY/.test(fuera[1]), { ocultos, fuera });
  v = await fetch(`${BASE}/api/landings/${id1}/descargar`);
  const zip = Buffer.from(await v.arrayBuffer());
  check('Se descarga en zip (index.html y assets/)', v.status === 200 && /zip/.test(v.headers.get('content-type') || '') && zip.slice(0, 2).toString() === 'PK' && zip.includes(Buffer.from('index.html')) && zip.includes(Buffer.from('assets/')));
  r = await pedir('/api/landings');
  check('La lista la muestra', r.datos?.landings?.some((x) => x.id === id1));

  // para mi producto
  r = await pedir('/api/landings', { json: { url: URL_LANDING, modo: 'adaptar', motor: 'claude', productoId: prod } });
  const id2 = r.datos?.id;
  if (id2) creados.landings.push(id2);
  l = await esperar(300, () => leerLanding(id2), terminada);
  check('«Para mi producto» termina lista', l?.estado === 'lista' && l.modo === 'adaptar' && l.motor === 'claude', l);
  const h2 = id2 && fs.existsSync(path.join(RAIZ, 'temp', '_landings', id2, 'index.html')) ? html(id2) : '';
  check('La IA cambió los textos con la marca por el producto (y el resto quedó)', /Sueño Profundo Gotas para dormir/.test(h2) && /clientes de Sueño Profundo/.test(h2) && /Lleva 2 y ahorra 40%/.test(h2) && !/<h1[^>]*>MARCAORIGINAL/.test(h2), h2.match(/<h1[^>]*>[^<]*/));
  check('La imagen del producto se cambió (ChatGPT; en prueba, la foto)', /<img[^>]+src="assets\/ia-0-/.test(h2) && l?.adaptada?.imagenes === 1, l?.adaptada);
  check('El diseño no se tocó (mismo CSS y carrusel)', /kc-carrusel/.test(h2) && /\.comprar\{/.test(h2));
  check('La IA no ve el archivo de textos desde la vista', (await fetch(`${BASE}/landing/${id2}/nuevos-textos.json`)).status === 404 && (await fetch(`${BASE}/landing/${id2}/textos.json`)).status === 404);

  // medir y borrar
  r = await pedir(`/api/landings/${id1}/medir`, { json: {} });
  l = await esperar(60, () => leerLanding(id1), (d) => d?.estado === 'lista' && d.puntajes?.copia);
  check('«Medir otra vez» vuelve a medir', r.st === 200 && l?.estado === 'lista', { r, l: l?.estado });
  r = await pedir(`/api/landings/${id1}`, { metodo: 'DELETE' });
  check('Borrar la quita (y su carpeta)', r.st === 200 && !fs.existsSync(path.join(RAIZ, 'temp', '_landings', id1)) && (await pedir(`/api/landings/${id1}`)).st === 404, r);
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
  tienda.close();
  for (const id of creados.landings) fs.rmSync(path.join(RAIZ, 'temp', '_landings', id), { recursive: true, force: true });
  if (!landingsExistia) fs.rmSync(path.join(RAIZ, 'temp', '_landings'), { recursive: true, force: true });
  if (creados.producto) fs.rmSync(path.join(RAIZ, 'temp', '_productos', creados.producto), { recursive: true, force: true });
  fs.rmSync(path.join(RAIZ, 'temp', `_modo-prueba-${PUERTO}`), { recursive: true, force: true });
  if (envPropio) fs.rmSync(ENV, { force: true });
  if (fallas) console.log(`\n  Registro de la app: ${path.join(TMP, 'app.log')}`);
  else fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n  ${pasan} bien, ${fallas} mal · ${Math.round((Date.now() - t0) / 1000)} s\n`);
  process.exit(fallas ? 1 : 0);
}

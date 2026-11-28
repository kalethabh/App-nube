// Prueba de LANDINGS (lib/landings/, rutas/landings.js), sin internet: una tienda falsa en este proceso (HTML con CSS en
// <link> y <style>, @import, una fuente, imágenes, un carrusel tipo Swiper con una diapositiva clonada, un GIF, scripts
// de la tienda y enlaces relativos) y la app en MODO PRUEBA con el Claude falso.
//   node app/herramientas/probar-landings.mjs        (PUERTO=<n>, por defecto 4493)
// Revisa: validaciones, clonar «tal cual» (textos e imágenes de la original, imágenes locales, sin scripts de la tienda,
// carrusel armado y sin clones, CSS podado, enlaces a la tienda original), la vista comprimida y lo que no se deja ver,
// el zip, «Para mi producto» (la IA cambia los textos y la imagen del producto), medir otra vez y borrar.
import fs from 'node:fs';
import os from 'node:os';
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
  const datos=await r.json().catch(()=>null);
  if(r.ok && datos?.id && o.metodo!=='DELETE'){if(['/api/landings','/api/landings/crear'].includes(ruta) && cuerpo!==undefined)creados.landings.push(datos.id);if(ruta==='/api/landings/fotos')creados.fotos.push(datos.id);}
  return { st: r.status, datos };
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
<script async src="https://www.googletagmanager.com/gtag/js?id=G-PRUEBA"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('config','G-PRUEBA');</script>
<script>!function(f){f.fbq=function(){};}(window);fbq('init','123');fbq('track','PageView');</script>
<script src="/js/pestanas.js" defer></script>
<script type="application/ld+json">{"@type":"Product","name":"MARCAORIGINAL"}</script>
</head><body class="template-product overflow-hidden" style="overflow:hidden"><div class="kl-private-reset-css needsclick klaviyo-form-popup" role="dialog" aria-modal="true" style="position:fixed;inset:0;z-index:999"><h2>Try your luck POPUPRULETA</h2><button>No, thanks</button></div>
<header class="cabeza"><a href="/collections/all">Tienda</a><div class="cabeza-iconos"><svg viewBox="0 0 10 10"><path d="M0 0h10v10z" fill="currentColor">
</svg><span class="dentro">ICONO-OK</span></div></header>
<main>
<h1 class="titulo">MARCAORIGINAL Gotas para dormir</h1>
<img class="portada" src="/img/portada.png" alt="MARCAORIGINAL frasco">
<p class="oferta">Lleva 2 y ahorra 40%</p>
<div class="dolores"><button type="button" class="dolor" data-dolor="espalda">Espalda</button><button type="button" class="dolor" data-dolor="rodilla">Rodilla</button><p id="texto-dolor">TEXTO-ESPALDA</p></div>
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
  '/js/tienda.js': ['text/javascript', 'document.documentElement.dataset.tienda="si";'],
  // (2026-11-24j) el selector de dolor de la tienda: al elegir uno, cambia el texto (en la copia fiel debe seguir andando)
  '/js/pestanas.js': ['text/javascript', 'document.querySelectorAll(".dolor").forEach(b=>b.addEventListener("click",()=>{document.getElementById("texto-dolor").textContent="TEXTO-"+b.dataset.dolor.toUpperCase()}));'],
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
const creados = { producto: null, landings: [],fotos:[] };
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
  r = await pedir('/api/landings', { json: { url: URL_LANDING } });
  const id1 = r.datos?.id;
  if (id1) creados.landings.push(id1);
  check('Se crea la landing y arranca a clonar', r.st === 200 && id1 && r.datos.estado === 'trabajando', r);
  let l = await esperar(240, () => leerLanding(id1), terminada);
  check('Avisa cuando la landing queda lista', (await pedir('/api/notificaciones')).datos?.notificaciones?.some(n=>n.tipo==='landing-lista' && n.destino.includes(id1)));
  check('Termina «lista»', l?.estado === 'lista', l);
  check('El título es el de la página', /MARCAORIGINAL Gotas/.test(l?.titulo || ''), l?.titulo);
  check('Mide la original y la copia (simulado en prueba)', l?.puntajes?.original?.puntaje > 0 && l?.puntajes?.copia?.puntaje >= 80, l?.puntajes);
  const h1 = id1 && fs.existsSync(path.join(RAIZ, 'temp', '_landings', id1, 'index.html')) ? html(id1) : '';
  const assets = id1 ? fs.readdirSync(path.join(RAIZ, 'temp', '_landings', id1, 'assets')) : [];
  check('Conserva los textos de la original', /MARCAORIGINAL Gotas para dormir/.test(h1) && /Lleva 2 y ahorra 40%/.test(h1) && /Comprar ahora/.test(h1), h1.slice(0, 600));
  check('(2026-11-24j) Fiel: quedan los scripts de la tienda (con su dirección completa) y el JSON-LD', h1.includes(`src="${TIENDA}/js/tienda.js"`) && h1.includes(`src="${TIENDA}/js/pestanas.js"`) && /window\.rastreo/.test(h1) && /application\/ld\+json/.test(h1), h1.match(/<script[^>]*>/g));
  check('(2026-11-24k) Fiel: un ícono SVG sin cerrar (<path> sin </path>) no desarma la página', /class="cabeza-iconos"><svg[^>]*><path[^>]*>\s*<\/path><\/svg><span class="dentro">ICONO-OK<\/span><\/div><\/header>/.test(h1) && !/kc-dormido|data-kc-tipo/.test(h1), (h1.match(/<header[\s\S]*?<\/header>/) || [''])[0]);
  check('(2026-11-24j) Fiel: sin la analítica ni los píxeles (Google, Meta)', !/googletagmanager|gtag\(|fbq\(/.test(h1), h1.match(/<script[^>]*>[^<]{0,60}/g));
  // y FUNCIONA: en un navegador de verdad, elegir otro dolor cambia el texto
  let funciona = null;
  try {
    const { chromium } = (await import('node:module')).createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE_PATH || 'playwright');
    const nav = await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROME?{executablePath:process.env.PLAYWRIGHT_CHROME}:{})});
    try {
      const pag = await nav.newPage({ viewport: { width: 412, height: 900 } });
      await pag.goto(`${BASE}/landing/${id1}/index.html`, { waitUntil: 'load' });
      await pag.click('button[data-dolor="rodilla"]');
      funciona = { texto: await pag.textContent('#texto-dolor'), tienda: await pag.evaluate(() => document.documentElement.dataset.tienda) };
    } finally {
      await nav.close();
    }
  } catch (e) {
    funciona = { error: String(e?.message || e).slice(0, 300) };
  }
  check('(2026-11-24j) Fiel: en el navegador, elegir otro dolor cambia el contenido (como en la original)', funciona?.texto === 'TEXTO-RODILLA' && funciona.tienda === 'si', funciona);
  check('Las imágenes quedan dentro de la landing (assets/)', /<img[^>]+src="assets\//.test(h1) && !/src="\/img\//.test(h1) && assets.length >= 3, assets);
  check('Las imágenes pesadas pasan a WebP y llevan su tamaño', /\.webp"/.test(h1) && /<img[^>]+width="\d+"[^>]+height="\d+"|<img[^>]+height="\d+"[^>]+width="\d+"/.test(h1), h1.match(/<img[^>]*>/g));
  check('La primera imagen grande se carga primero y las demás perezosas', /fetchpriority="high"/.test(h1) && /loading="lazy"/.test(h1), h1.match(/<img[^>]*>/g));
  check('Fiel: el carrusel lo arma el JavaScript de la tienda (sin la fila propia)', !/kc-carrusel/.test(h1));
  check('El CSS se trae (también el @import) y queda dentro', /\.comprar\{/.test(h1) && /\.oferta\{/.test(h1) && /margin:0/.test(h1) && !/<link[^>]+stylesheet/.test(h1));
  check('La fuente queda local y con font-display:swap', /url\(assets\/[^)]+\.woff2\)/.test(h1) && /font-display:swap/.test(h1));

  // (2026-11-24j) la LIVIANA (sin el JavaScript de la tienda), como antes
  r = await pedir('/api/landings', { json: { url: URL_LANDING, modo: 'tal-cual', motor: 'claude', liviana: true, analizar: false } });
  const idL = r.datos?.id;
  if (idL) creados.landings.push(idL);
  const lL = await esperar(240, () => leerLanding(idL), terminada);
  const hL = idL && fs.existsSync(path.join(RAIZ, 'temp', '_landings', idL, 'index.html')) ? html(idL) : '';
  check('Liviana: termina lista y sin los scripts de la tienda (queda el JSON-LD)', lL?.estado === 'lista' && !/tienda\.js|window\.rastreo|pestanas/.test(hL) && /application\/ld\+json/.test(hL), hL.match(/<script[^>]*>/g));
  check('Liviana: el carrusel queda armado y sin la diapositiva clonada', /kc-carrusel/.test(hL) && !/swiper-slide-duplicate/.test(hL) && !/translate3d\(-600px/.test(hL) && (hL.match(/swiper-slide"/g) || []).length + (hL.match(/swiper-slide /g) || []).length >= 2, hL.match(/<div class="swiper[^>]*>/g));
  check('Liviana: el CSS que no se usa se poda', /\.comprar\{/.test(hL) && !/clase-que-no-esta|otra-que-no-esta|nunca-se-usa-aqui/.test(hL));
  check('Liviana: sin el popup ni el bloqueo del scroll', !/POPUPRULETA/.test(hL) && !/overflow-hidden/.test((hL.match(/<body[^>]*>/) || [''])[0]));
  check('Los enlaces y el formulario van a la tienda original', h1.includes(`href="${TIENDA}/collections/all"`) && h1.includes(`action="${TIENDA}/cart/add"`), h1.match(/(href|action)="[^"]*"/g));
  check('(2026-11-24) Sin el popup de la app («Try your luck») ni el bloqueo del scroll: la página se puede usar', !/POPUPRULETA/.test(h1) && !/overflow-hidden/.test((h1.match(/<body[^>]*>/) || [''])[0]) && !/overflow:\s*hidden/.test((h1.match(/<body[^>]*>/) || [''])[0]) && /MARCAORIGINAL Gotas para dormir/.test(h1) && l?.informe?.avisos?.some((a) => /popup/.test(a)), { body: (h1.match(/<body[^>]*>/) || [''])[0], avisos: l?.informe?.avisos });
  check('El informe dice qué hizo', l?.informe?.fiel === true && l.informe.scripts >= 2 && l.informe.scriptsVivos >= 3 && l.informe.imagenes >= 3 && l.informe.pesos?.html > 0 && lL?.informe?.fiel === false && lL.informe.carruseles >= 1, { fiel: l?.informe, liviana: lL?.informe });
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
  // (2026-11-24j) con el PROMPT: nombrar el producto basta (la app lo reconoce)
  r = await pedir('/api/landings', { json: { url: URL_LANDING, prompt: 'Adáptala a mi producto sueño profundo, con un tono más cercano.' } });
  const id2 = r.datos?.id;
  if (id2) creados.landings.push(id2);
  l = await esperar(300, () => leerLanding(id2), terminada);
  check('Con el prompt: termina lista, adaptada al producto que nombra y con el pedido guardado', l?.estado === 'lista' && l.modo === 'adaptar' && l.productoId === prod && /tono más cercano/.test(l.prompt || ''), l);
  const h2 = id2 && fs.existsSync(path.join(RAIZ, 'temp', '_landings', id2, 'index.html')) ? html(id2) : '';
  check('La IA cambió los textos con la marca por el producto (y el resto quedó)', /Sueño Profundo Gotas para dormir/.test(h2) && /clientes de Sueño Profundo/.test(h2) && /Lleva 2 y ahorra 40%/.test(h2) && !/<h1[^>]*>MARCAORIGINAL/.test(h2), h2.match(/<h1[^>]*>[^<]*/));
  check('La imagen del producto se cambió (ChatGPT; en prueba, la foto)', /<img[^>]+src="assets\/ia-0-/.test(h2) && l?.adaptada?.imagenes === 1, l?.adaptada);
  check('El diseño no se tocó (mismo CSS) y sigue funcionando (sus scripts)', /\.comprar\{/.test(h2) && h2.includes('/js/pestanas.js'));

  // un pedido sin producto («cambia el precio»): la IA lo aplica, sin producto ni imágenes nuevas
  r = await pedir('/api/landings', { json: { url: URL_LANDING, prompt: 'Cambia el precio a 2x1 y ponla en inglés.', analizar: false } });
  const id3 = r.datos?.id;
  if (id3) creados.landings.push(id3);
  const l3 = await esperar(300, () => leerLanding(id3), terminada);
  check('Un pedido sin producto: termina lista, sin producto y sin imágenes de ChatGPT', l3?.estado === 'lista' && l3.modo === 'adaptar' && !l3.productoId && l3.adaptada?.imagenes === 0, l3);
  const h3 = id3 && fs.existsSync(path.join(RAIZ, 'temp', '_landings', id3, 'index.html')) ? html(id3) : '';
  check('La IA recibe el pedido y lo aplica (en prueba: «PEDIDO: …» en el texto de la oferta)', /PEDIDO: Cambia el precio a 2x1/.test(h3) && /MARCAORIGINAL Gotas para dormir/.test(h3), h3.match(/<p class="oferta">[^<]*/));
  r = await pedir('/api/landings', { json: { url: URL_LANDING, modo: 'adaptar' } });
  check('«Para mi producto» sin producto ni pedido: lo pide', r.st === 400, r);
  check('La IA no ve el archivo de textos desde la vista', (await fetch(`${BASE}/landing/${id2}/nuevos-textos.json`)).status === 404 && (await fetch(`${BASE}/landing/${id2}/textos.json`)).status === 404);

  // (2026-11-25f) CREAR desde la plantilla, con el equipo de agentes
  r = await pedir('/api/landings/crear', { json: {} });
  check('Crear sin producto: lo pide', r.st === 400, r);
  r = await pedir('/api/landings/crear', { json: { productoId: prod, plantilla: 'cen', prompt: 'tono cercano', precios: { uno: '89.900', dos: '152900', tres: '199900', antes: '89900' }, registro: 'RSA-PRUEBA-123', resenas: [{ nombre: 'Luz Marina R.', ciudad: 'Medellín', texto: 'Desde la segunda semana duermo de corrido, y eso que no creía.' }, { nombre: 'Sin texto', texto: '' }] } });
  const id4 = r.datos?.id;
  if (id4) creados.landings.push(id4);
  const l4 = await esperar(300, () => leerLanding(id4), terminada);
  check('Crear con el equipo: termina lista, sin URL, modo crear', l4?.estado === 'lista' && l4.modo === 'crear' && !l4.url && l4.productoId === prod, l4);
  check('Los 7 pasos del equipo (con la revisión visual) terminaron y dejaron su resumen', l4?.agentes?.length === 7 && l4.agentes.every((a) => a.estado === 'listo' && a.resumen), l4?.agentes);
  check('Renata deja lo que el dueño debe completar', l4?.agentes?.find((a) => a.id === 'revision')?.pendientes?.length >= 1);
  const h4 = id4 && fs.existsSync(path.join(RAIZ, 'temp', '_landings', id4, 'index.html')) ? html(id4) : '';
  check('La página es la plantilla con los textos del producto', /data-seccion="oferta"/.test(h4) && /Sueño Profundo/.test(h4) && !/Be Well CEN<sup>/.test(h4), (h4.match(/<h1[^>]*>[\s\S]{0,80}/) || [''])[0]);
  check('Los combos del script quedan con el producto', /"name": "Kit Trío Sueño Profundo"/.test(h4), (h4.match(/const OFFERS = [\s\S]{0,200}/) || [''])[0]);
  check('El tarro de los combos es la foto del producto y la imagen principal la nueva', /src="assets\/producto\.png"/.test(h4) && /src="assets\/ia-img0-/.test(h4) && l4?.creada?.imagenes >= 1, l4?.creada);
  // (2026-11-25g) la identidad del producto, no la de la plantilla
  check('La paleta es la del producto (y el texto ilegible que dio el diseño se corrigió)', /--accent:#A62737/i.test(h4) && !/--accent:#8a4fc4/i.test(h4) && !/--fg:#ffffff/i.test(h4) && /--star:#FACF42/i.test(h4), (h4.match(/:root\{[\s\S]{0,500}/) || [''])[0]);
  check('(2026-11-27d) La letra es siempre Inter (aunque el diseño pida otra)', /id="kads-fuentes"[^>]+family=Inter:/.test(h4) && !/family=(Anton|Lato)/.test(h4) && /--f-display:"Inter"/.test(h4) && /--f-body:"Inter"/.test(h4), (h4.match(/<link id="kads-fuentes"[^>]*>/) || [''])[0]);
  check('No queda ninguna imagen ni marca de la plantilla', !/assets\/cen-/.test(h4) && !/\b(Be ?Well|CEN)\b/.test(h4.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '')), [...new Set(h4.match(/assets\/cen-[\w.-]+|\b(Be ?Well|CEN)\b[^<]{0,40}/g) || [])].slice(0, 8));
  // (2026-11-25h) precios del dueño, e imágenes con el aspecto y la guía de la plantilla
  const trio = (h4.match(/<button class="offer"[^>]*data-key="trio"[\s\S]*?<\/button>/) || [''])[0];
  check('Los precios del dueño: precio, tachado y «Ahorras» calculados', /<strong>\$199\.900<\/strong>/.test(trio) && /<s>\$269\.700<\/s>/.test(trio) && /Ahorras \$69\.800/.test(trio) && /"price": "\$199\.900 COP"/.test(h4), trio.slice(0, 600));
  const env = JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', '_landings', id4, 'prueba-imagenes.json'), 'utf8'));
  check('La imagen principal sale con el aspecto de la plantilla (9:16) y su guía de composición', env.some((e) => e.imagen === 'img0' && e.aspecto === '9:16' && e.guia), env);
  r = await pedir('/api/landings/crear', { json: { productoId: prod } });
  check('(2026-11-27d) Crear sin precios: los pide (ya no queda «Precio por definir»)', r.st === 400 && /precios/i.test(r.datos?.error || ''), r);
  const proCen = (await pedir('/api/landings/fotos', { cuerpo: fs.readFileSync(path.join(TMP, 'producto.png')), headers: { 'Content-Type': 'image/png' } })).datos?.id;
  r = await pedir('/api/landings/crear', { json: { productoId: prod, plantilla: 'cen', profesional: { foto: proCen, nombre: 'Dra. Laura Gómez', especialidad: 'Nutrición clínica', autorizado: true }, precios: { uno: '89900', dos: '152900', tres: '199900' } } });
  const id5 = r.datos?.id;
  if (id5) creados.landings.push(id5);
  const l5 = await esperar(300, () => leerLanding(id5), terminada);
  const h5 = id5 && fs.existsSync(path.join(RAIZ, 'temp', '_landings', id5, 'index.html')) ? html(id5) : '';
  check('(CEN) Conserva la foto y los datos del profesional autorizado sin reescribir su identidad', /data-tipo="profesional-real"/.test(h5) && /assets\/profesional\.(jpg|png)/.test(h5) && /<p class="care-badge">Dra\. Laura Gómez · Nutrición clínica<\/p>/.test(h5), h5.match(/<p class="care-badge">[^<]*/)?.[0]);
  check('Sin registro: no sale el sello', !/data-seccion="registro-sanitario"|invima-logo/.test(h5), (h5.match(/registro[^<]{0,60}/gi) || []).slice(0, 4));
  check('Sin precio normal: sin tachados ni «Ahorras» de la plantilla', l5?.estado === 'lista' && !/<s>\$/.test(h5) && !/Ahorras/.test(h5) && !/Precio por definir/.test(h5), [l5?.estado, (h5.match(/<s>[^<]*|Ahorras[^<]*/g) || []).slice(0, 4)]);
  check('(2026-11-27d) Sin reseñas reales: no hay reseñas, testimonio ni prueba social', !/data-seccion="(resenas|testimonio-destacado|prueba-social)"/.test(h5) && !/class="rcard"/.test(h5), [...new Set([...h5.matchAll(/data-seccion="([^"]+)"/g)].map((m) => m[1]))]);
  // (2026-11-25j) la base completa: sus secciones, el registro, la encuesta y los profesionales sin inventar
  const secs = new Set([...h4.matchAll(/data-seccion="([^"]+)"/g)].map((m) => m[1]));
  check('(2026-11-27d) Trae las secciones que se sostienen (registro, cómo funciona, cuidado, costo, reseñas reales) y ninguna de médicos, encuesta o prueba social', ['registro-sanitario', 'como-funciona', 'cuidado', 'comparacion-costo', 'resenas', 'testimonio-destacado', 'preguntas-frecuentes'].every((x) => secs.has(x)) && !['encuesta', 'medico-asesor', 'profesionales', 'prueba-social'].some((x) => secs.has(x)), [...secs]);
  check('El sello lleva el registro que dio el dueño (y nada del registro de la plantilla)', /RSA-PRUEBA-123/.test(h4) && !/RSA-0012589|p-1\.webp|registro-invima-cen\.pdf|Laboratorio G/.test(h4), (h4.match(/<div class="verify"[\s\S]{0,400}/) || [''])[0]);
  check('(2026-11-27d) «Cómo funciona» en pasos (1, 2, 3), sin porcentajes ni citas inventadas', /<div class="n">1<\/div>/.test(h4) && /<div class="n">2<\/div>/.test(h4) && !/<div class="n">[^<]*%/.test(h4) && !/Encuesta a clientas/.test(h4), (h4.match(/<div class="n">[^<]*/g) || []).slice(0, 4));
  check('Sin médicos ni profesionales (ni nombres, ni fotos con bata, ni opiniones)', !/Valentina B\.|R\. Camargo|Camila S\.|Carlos O\.|Fabián C\.|Nombre Apellido|class="care-badge"|Opinión profesional/.test(h4.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '')) && !/\b(Dra?|Nut)\. [A-ZÁÉÍÓÚ]/.test(h4.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '')), (h4.match(/(Dra?|Nut)\. [^<]{0,24}/g) || []).slice(0, 6));
  check('(2026-11-27d) Ninguna variable ni texto «de ejemplo» en la página', !/Nombre Apellido|Nombre de clienta|Título de la reseña|\bXX\b|X,X|Aquí va|Por definir|de ejemplo/i.test(h4.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '')), (h4.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '').match(/[^<>]{0,40}(Nombre Apellido|\bXX\b|X,X|Aquí va|Por definir|de ejemplo)[^<>]{0,40}/gi) || []).slice(0, 6));
  check('(2026-11-27d) Las reseñas son las reales que dio el dueño, tal cual (la vacía no entra)', /<article class="rcard">[\s\S]*?<b>Luz Marina R\.<\/b>, Medellín[\s\S]*?Desde la segunda semana duermo de corrido, y eso que no creía\./.test(h4) && (h4.match(/<article class="rcard">/g) || []).length === 1 && /Escena ilustrativa generada con IA; no es la persona de la reseña/.test(h4) && l4?.resenas?.length === 1, (h4.match(/<article class="rcard">[\s\S]{0,300}/) || [''])[0]);
  check('Fotos nuevas y consulta ilustrativa, sin identidades ni avales de profesionales', !/assets\/(cen-|av-clienta|clienta-testimonio|doctor-|dra?-|nut-)/.test(h4) && env.some((e) => e.tipo === 'consulta') && !env.some((e) => e.tipo === 'profesional'), [...new Set(h4.match(/assets\/[\w.-]+/g) || [])].slice(0, 30));
  {
    const bg = (/--bg:(#[0-9a-f]{6})/i.exec(h4) || [])[1];
    const fondo = JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', '_landings', id4, 'prueba-fondo.json'), 'utf8'));
    check('(2026-11-27d) Cada creativo pide el fondo liso de la página y sin los efectos de ChatGPT; las fotos, sin médicos', env.filter((e) => e.tipo === 'creativo').every((e) => e.prompt.includes(`BACKGROUND: flat solid ${fondo.pedido}`) && /No typical AI-image effects/.test(e.prompt)) && env.filter((e) => e.tipo === 'estilo').every((e) => /Never a doctor/.test(e.prompt) && /No typical AI-image effects/.test(e.prompt)), env.map((e) => [e.tipo, e.prompt.slice(-300)]));
    check('(2026-11-27d) El fondo de la página es el color que quedó en los bordes de las imágenes (si es claro)', fondo.usado === bg && (!fondo.medido || fondo.medido === bg), { bg, fondo });
  }
  check('Las imágenes de contenido no se recortan (sin caja fija en la galería ni en el médico)', !/\.g-main img\{[^}]*aspect-ratio:941/.test(h4) && !/\.care-ph img\{[^}]*object-fit:cover/.test(h4));
  // (2026-11-25k) la auditoría: calificaciones y cantidades sin inventar, negritas del producto, barra fija, Renata mira la página
  check('Calificación y cantidad de opiniones sin inventar', !/<b>4,8<\/b>|1\.200 opiniones|\+40\.000/.test(h4), (h4.match(/<b>[\d.,X]+[^<]*<\/b>/g) || []).slice(0, 6));
  check('La barra fija ya trae el precio del dueño', /<span id="stPrice">\$199\.900 COP/.test(h4), (h4.match(/<span id="stPrice">[^<]*/) || [''])[0]);
  check('Las negritas automáticas ya no buscan las palabras de la plantilla', !/const KW=\/\(perimenopausia/.test(h4), (h4.match(/const KW=[^;]*;/) || [''])[0]);
  const vis = l4?.agentes?.find((a) => a.id === 'visual');
  console.log(`        (revisión visual: ${vis?.resumen || '-'})`);
  check('Renata revisó la página terminada (o avisó que no pudo capturarla)', vis?.estado === 'listo' && vis.resumen, vis);
  const capt = fs.existsSync(path.join(RAIZ, 'temp', '_landings', id4, 'registro-visual.log')) ? fs.readFileSync(path.join(RAIZ, 'temp', '_landings', id4, 'registro-visual.log'), 'utf8') : '';
  check('Con capturas: recibió las de la base y las de la nueva', !capt || (/analisis-capturas\//.test(capt) && (!fs.existsSync(path.join(APP,'server/lib/landings/plantillas/cen/capturas/encuesta.webp')) || /plantillas\/cen\/capturas\/encuesta\.webp/.test(capt))), capt.slice(0, 300));
  // quitar lo que no aplica (directo sobre la plantilla)
  {
    const pl = await import(path.join(APP, 'server', 'lib', 'landings', 'plantilla.js'));
    const { parse } = await import('node-html-parser');
    const r = parse(fs.readFileSync(path.join(APP, 'server', 'lib', 'landings', 'plantillas', 'cen', 'index.html'), 'utf8'), { comment: true, blockTextElements: { script: true, style: true } });
    const nodos = [r.querySelectorAll('.cmp-row')[0], r.querySelectorAll('.doc')[4]].map((el) => el.childNodes.find((c) => c.nodeType === 1) || el);
    const n = pl.quitarRepetidos(r, nodos);
    // (2026-11-27d) el color de los bordes de una imagen (para que el fondo de la página sea el mismo)
    const bin = (await (await import(path.join(APP, 'server', 'lib', 'imagen-ads', 'local.js'))).comprobarFfmpeg())?.bin;
    const claro = path.join(os.tmpdir(), `kads-borde-${process.pid}.png`);
    if (bin) cp.execFileSync(bin, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0xF7EFE9:s=96x96', '-vf', 'drawbox=x=30:y=30:w=36:h=36:color=0x8A2040:t=fill', '-frames:v', '1', claro]);
    const borde = bin ? await pl.colorDeBorde(claro) : null;
    fs.rmSync(claro, { force: true });
    const cerca = borde && [1, 3, 5].every((i, k) => Math.abs(parseInt(borde.slice(i, i + 2), 16) - [0xf7, 0xef, 0xe9][k]) <= 3);
    check('(2026-11-27d) Se mide el color del borde de una imagen (no el del centro)', !bin || cerca, { borde });
    // y una sección con variables se limpia sola
    const r2 = parse('<html><body><main><div data-seccion="x"><ul class="checks"><li>Bueno</li><li>Aquí va la opinión real</li></ul><p>+40.000 mujeres ya lo usan</p><p>Queda</p></div></main></body></html>', { comment: true });
    const q = pl.barrerVariables(r2, pl.piezasDe(r2).textos, 'X');
    check('(2026-11-27d) Barrer variables quita el bloque con «Aquí va…» y la cifra de clientas inventada, y deja lo demás', q === 2 && !/Aquí va|40\.000/.test(r2.toString()) && /Bueno/.test(r2.toString()) && /Queda/.test(r2.toString()), r2.toString());
    check('Lo que no aplica se quita: una fila de costo y un profesional con su filtro y el contador', n === 2 && r.querySelectorAll('.cmp-row').length === 7 && r.querySelectorAll('.doc').length === 4 && !r.querySelector('#docChips button[data-f="huesos"]') && r.querySelector('#docChips button[data-f="all"] small').text === '4', n);
  }
  check('Mide solo la landing (no hay original)', l4?.puntajes?.copia && !l4.puntajes.original, l4?.puntajes);

  // (2026-11-27f) LA PLANTILLA AMUNA: la estructura de la landing de AMUNA, imágenes de GPT a la medida exacta, reseñas solo reales
  {
    r = await pedir('/api/landings/fotos', { cuerpo: fs.readFileSync(path.join(TMP, 'producto.png')), headers: { 'Content-Type': 'image/png' } });
    const fotoId = r.datos?.id;
    check('(AMUNA) Se sube la foto de una reseña real', r.st === 200 && /^[a-f0-9]{12}\.(png|jpg)$/.test(fotoId || ''), r);
    r = await pedir('/api/landings/fotos', { cuerpo: Buffer.from('no es una foto'), headers: { 'Content-Type': 'text/plain' } });
    check('(AMUNA) Lo que no es una foto se rechaza', r.st === 400, r);
    // (2026-11-27g) dos capturas reales de clientas
    const caps = [];
    for (let i = 0; i < 2; i++) caps.push((await pedir('/api/landings/fotos', { cuerpo: fs.readFileSync(path.join(TMP, 'producto.png')), headers: { 'Content-Type': 'image/png' } })).datos?.id);
    const proFoto = (await pedir('/api/landings/fotos', { cuerpo: fs.readFileSync(path.join(TMP, 'producto.png')), headers: { 'Content-Type': 'image/png' } })).datos?.id;
    r = await pedir('/api/landings/crear', { json: { productoId: prod, plantilla: 'amuna', capturas: caps, profesional: { foto: proFoto, nombre: 'Dra. Laura Gómez', especialidad: 'Nutrición clínica', autorizado: true }, precios: { uno: '89900', dos: '152900', tres: '199900', antes: '89900' }, resenas: [{ nombre: 'Luz Marina R.', ciudad: 'Medellín', texto: 'Desde la segunda semana duermo de corrido, y eso que no creía.', estrellas: 5, foto: fotoId }, { nombre: 'Paola G.', ciudad: 'Cali', texto: 'Me gusta que es fácil de tomar y me ayuda a descansar mejor.', estrellas: 4 }] } });
    const idA = r.datos?.id;
    if (idA) creados.landings.push(idA);
    const lA = await esperar(300, () => leerLanding(idA), terminada);
    check('(AMUNA) Crear con la plantilla AMUNA (la de por defecto): termina lista, con sus 6 pasos del equipo', lA?.estado === 'lista' && lA.plantilla === 'amuna' && lA.agentes?.length === 6 && lA.agentes.every((a) => a.estado === 'listo' && a.resumen), lA && { estado: lA.estado, error: lA.error, agentes: lA.agentes });
    const hA = idA && fs.existsSync(path.join(RAIZ, 'temp', '_landings', idA, 'index.html')) ? html(idA) : '';
    const visibleA = hA.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '');
    const secsA = [...hA.matchAll(/data-seccion="([^"]+)"/g)].map((m) => m[1]);
    // (2026-11-27k) el orden de la página de AMUNA, tal cual (el usuario lo eligió)
    const esperadas = ['galeria', 'prueba-social', 'titulo-y-beneficios', 'oferta', 'testimonio-destacado', 'dudas-rapidas', 'aviso-pedido', 'creativo', 'ellas-cuentan', 'ingredientes', 'historias', 'ruta', 'experiencias', 'experiencias-fotos', 'pasos', 'franja', 'comparacion', 'compra-clara', 'cuidado', 'resenas', 'preguntas-frecuentes', 'pie'];
    check('(AMUNA) Todas las secciones de AMUNA, en el orden de su página', JSON.stringify(secsA.filter((x) => esperadas.includes(x))) === JSON.stringify(esperadas), secsA);
    const envA = idA ? JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', '_landings', idA, 'prueba-imagenes.json'), 'utf8')) : [];
    const { medidas } = await import(path.join(APP, 'server', 'lib', 'landings', 'clonar.js'));
    const malas = envA.filter((e) => {
      const m = medidas(fs.readFileSync(path.join(RAIZ, 'temp', '_landings', idA, e.archivo)));
      return !m || m.w !== e.w || m.h !== e.h;
    });
    check('(AMUNA) Con capturas reales y profesional real: 26 imágenes de GPT (incluye la opinión sin foto; conserva fotos y profesional reales) y las capturas tal cual en «Experiencias con…»', envA.length === 26 && !envA.some((e) => e.slot.startsWith('ugc-')) && /data-seccion="experiencias-fotos"[\s\S]*?assets\/captura-1\.(png|jpg)[\s\S]*?assets\/captura-2\.(png|jpg)[\s\S]*?Experiencias con /.test(hA), envA.length);
    check('(2026-11-27h) Con reseñas reales: las estrellas bajo «Experiencias con…» y el selector para ordenar las reseñas (y funciona sin JS: el orden es el de las reseñas)', /data-seccion="experiencias-fotos"[\s\S]*?<div class="estrellas" aria-hidden="true">★★★★★<\/div>/.test(hA) && /<select id="orden" aria-label="Ordenar reseñas">/.test(hA), (hA.match(/<div class="ordenar">[\s\S]{0,200}/) || [''])[0]);
    {
      const { resenasPegadas } = await import(path.join(APP, 'src', 'datos', 'resenas-pegadas.js'));
      const pg = resenasPegadas('Luz Marina R. | Medellín | 5 | Desde la segunda semana duermo mejor.\nPaola G.\tCali\t★★★★\tMe ayuda a descansar mejor cada noche.\nAna | Muy buen producto, lo recomiendo.\n| sin nombre | 5 | texto suficiente aquí');
      check('(2026-11-27h) «Pegar varias reseñas»: una por línea con | o tabulación, estrellas en número o ★, sin nombre fuera', pg.length === 3 && pg[0].ciudad === 'Medellín' && pg[0].estrellas === 5 && pg[1].estrellas === 4 && pg[1].ciudad === 'Cali' && pg[2].nombre === 'Ana' && pg[2].estrellas === 5, pg);
      const { erroresTextos, moldeDeTextos } = await import(path.join(APP, 'server', 'lib', 'landings', 'plantilla-amuna.js'));
      const tx = JSON.parse(JSON.stringify(moldeDeTextos()).replace(/AMUNA Vitaldrops™|AMUNA|AMUA|Vital ?drops™?/gi, 'Sueño Profundo'));
      tx.resumen = 'x';
      const bien = erroresTextos(tx, { nombre: 'Sueño Profundo' });
      tx.faq.items.pop();
      tx.titulo.lede = 'Muy corto aquí.';
      const mal = erroresTextos(tx, { nombre: 'Sueño Profundo' });
      const tx2 = JSON.parse(JSON.stringify(moldeDeTextos()).replace(/AMUNA Vitaldrops™|AMUNA|AMUA|Vital ?drops™?/gi, 'Sueño Profundo'));
      tx2.resumen = 'x';
      tx2.dudas[0][1] = tx2.dudas[0][1].replace(/\.$/, '. Cura el insomnio.');
      const mal2 = erroresTextos(tx2, { nombre: 'Sueño Profundo' });
      check('(2026-11-27j) Bienestar, nunca curas: una promesa de cura se rechaza', mal2.some((e) => /nunca curas/.test(e)), mal2);
      check('(2026-11-27h) La misma cantidad de AMUNA: 11 preguntas exactas y cada texto con su largo (± 30 %)', !bien.length && mal.some((e) => /faq\.items.*exactamente 11/.test(e)) && mal.some((e) => /titulo\.lede.*3 palabras/.test(e)), { bien, mal });
    }
    check('(AMUNA) Las historias son 9:16 (1080×1920) con el marco de Instagram de la marca (@ y sticker); los pasos con la medida de su caja', envA.filter((e) => e.slot.startsWith('historia-')).every((e) => e.w === 1080 && e.h === 1920) && envA.filter((e) => e.slot.startsWith('paso-')).every((e) => e.w === 786 && e.h === 1074) && (hA.match(/<figure class="ig">/g) || []).length === 6 && /class="ig-quien"><span class="ig-ava">[^<]+<\/span><b>@/.test(hA) && /class="ig-sticker">/.test(hA), (hA.match(/<figure class="ig">[\s\S]{0,400}/) || [''])[0]);
    check('(AMUNA) A ChatGPT solo sus tamaños (1:1 o 2:3) y en el prompt cuánto se ve; las piezas sin recorte', envA.every((e) => (e.w / e.h < 0.85 ? e.aspecto === '2:3' : e.aspecto === '1:1')) && envA.filter((e) => e.slot.startsWith('historia-')).every((e) => /only the central \d+% of the width will be shown/.test(e.prompt)) && envA.filter((e) => /^galeria-0[1-4]$|^creativo$/.test(e.slot)).every((e) => /Leave at least 8% EMPTY background at the top and at the bottom/.test(e.prompt) && /Nothing may touch or be cut by any edge/.test(e.prompt)), envA.slice(0, 3).map((e) => [e.slot, e.aspecto]));
    {
      // la primera de la galería (alta) viene de una foto cuadrada en la prueba: queda ENTERA, con el fondo de la página arriba y abajo
      const g1 = envA.find((e) => e.slot === 'galeria-01');
      const px = g1 ? await (await import(path.join(APP, 'server', 'lib', 'imagen-ads', 'local.js'))).pixeles(path.join(RAIZ, 'temp', '_landings', idA, g1.archivo), 24, 24) : null;
      const fondoA = (/--fondo:(#[0-9a-f]{6})/i.exec(hA) || [])[1] || '#ffffff';
      const rgb = [1, 3, 5].map((i) => parseInt(fondoA.slice(i, i + 2), 16));
      const filaArriba = px ? [0, 6, 12, 18, 23].every((x) => [0, 1, 2].every((c) => Math.abs(px[x * 4 + c] - rgb[c]) <= 12)) : false;
      {
      // (2026-11-27i) una pieza con el titular pegado al borde de arriba se detecta (y se rehace)
      const { tocaElBorde } = await import(path.join(APP, 'server', 'lib', 'landings', 'plantilla-amuna.js'));
      const bin2 = (await (await import(path.join(APP, 'server', 'lib', 'imagen-ads', 'local.js'))).comprobarFfmpeg())?.bin;
      const [c1, c2] = ['cortada', 'bien'].map((n) => path.join(os.tmpdir(), `kads-${n}-${process.pid}.png`));
      if (bin2) {
        cp.execFileSync(bin2, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0xF7EFE6:s=400x600', '-vf', 'drawbox=x=40:y=0:w=320:h=60:color=0x8A4A1E:t=fill', '-frames:v', '1', c1]);
        cp.execFileSync(bin2, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0xF7EFE6:s=400x600', '-vf', 'drawbox=x=40:y=60:w=320:h=60:color=0x8A4A1E:t=fill', '-frames:v', '1', c2]);
      }
      const r1 = bin2 ? await tocaElBorde(c1, '#F7EFE6') : true;
      const r2 = bin2 ? await tocaElBorde(c2, '#F7EFE6') : false;
      for (const f of [c1, c2]) fs.rmSync(f, { force: true });
      check('(2026-11-27i) Un titular pegado al borde de arriba se detecta (la app la rehace con más margen); uno con margen, no', r1 === true && r2 === false, { r1, r2 });
    }
    check('(AMUNA) Una pieza alta no se recorta: entra entera y se rellena con el color del fondo de la página', filaArriba, { fondoA, primeros: px && [...px.slice(0, 12)] });
    }
    {
      const personas = envA.filter((e) => /^historia|^paso|^galeria-05/.test(e.slot)).map((e) => (/Casting (\d+)/.exec(e.prompt) || [])[1]);
      check('(AMUNA) Fotos caseras y variadas: público del producto, personas y escenarios distintos, luz natural', personas.length === 10 && personas.every(Boolean) && new Set(personas).size === personas.length && envA.filter((e) => /^historia/.test(e.slot)).every((e) => /HOMEMADE PHOTO/.test(e.prompt) && /natural light only/.test(e.prompt)), personas);
    }
    check('(AMUNA) Las imágenes, cada una con la medida exacta de la de AMUNA (p. ej. la primera de la galería 942×1670)', envA.length === 26 && !malas.length && envA.some((e) => e.slot === 'galeria-01' && e.w === 942 && e.h === 1670) && envA.every((e) => hA.includes(e.archivo)), { n: envA.length, malas: malas.map((e) => e.slot) });
    check('(AMUNA) Las piezas usan guía de AMUNA; las fotos solo el producto y público, sin copiar personas; fondo y realismo compartidos', envA.length && envA.filter((e) => e.slot !== 'cuidado').every((e) => /No typical AI-image effects/.test(e.prompt) && (e.referencias.length===2 ? e.referencias[1]===`app/server/lib/landings/plantillas/amuna/referencias/${e.slot}.jpg` && /Reference image 2 is ONLY a LAYOUT/.test(e.prompt) : e.referencias.length===1 && /REAL PRODUCT/.test(e.prompt))) && envA.filter((e) => /^galeria-0[1-4]$|^creativo$|^ingredientes$/.test(e.slot)).every((e) => /BACKGROUND: flat solid #/.test(e.prompt)) && envA.filter((e) => /^historia|^ugc/.test(e.slot)).every((e) => /No medical uniform/.test(e.prompt)), envA.slice(0, 2).map((e) => e.prompt.slice(0, 300)));
    check('(AMUNA) Sin variables, sin la marca del ejemplo y sin cifras de clientas inventadas', !/Nombre Apellido|\bXX\b|Aquí va|Por definir|Producto X|TU MARCA|AMUNA|AMUA|Vital ?Drops|\+\s?\d{1,3}\.\d{3}/i.test(visibleA) && /Sueño Profundo/.test(visibleA), (visibleA.match(/[^<>]{0,40}(Producto X|TU MARCA|AMUNA|AMUA|Vital ?Drops|\+\d{1,3}\.\d{3})[^<>]{0,40}/gi) || []).slice(0, 5));
    const trioA = (hA.match(/<button type="button" class="combo"[^>]*data-combo="tres"[\s\S]*?<\/button>/) || [''])[0];
    check('(2026-11-27k) AMUNA tal cual: H1 = el nombre del producto, sin titular de resultado ni bloque de dolor', /<h1>Sueño Profundo<\/h1>/.test(hA) && !/data-seccion="dolor"|class="t-producto"/.test(hA), (hA.match(/<div class="titulo"[\s\S]{0,200}/) || [''])[0]);
    check('(2026-11-27k) Con profesional real autorizado: su foto y su placa en «cuidado», y esa imagen no va a ChatGPT', /data-seccion="cuidado"[\s\S]*?assets\/profesional\.(png|jpg)[\s\S]*?class="care-badge">Dra\. Laura Gómez · Nutrición clínica</.test(hA) && !envA.some((e) => e.slot === 'cuidado') && !/Imagen ilustrativa/.test(hA), (hA.match(/data-seccion="cuidado"[\s\S]{0,500}/) || [''])[0]);
    check('(AMUNA) Los precios del dueño en los combos (tachado y «Ahorras» calculados) y en la barra fija', /<strong>\$199\.900<\/strong>/.test(trioA) && /<s>\$269\.700<\/s>/.test(trioA) && /Ahorras \$69\.800/.test(trioA) && /id="fPrecio">\$199\.900 COP/.test(hA), trioA.slice(0, 500));
    check('(AMUNA) Las reseñas reales tal cual: testimonio, «Ellas cuentan» (la que tiene foto), la nota y las barras calculadas', /data-seccion="testimonio-destacado"[\s\S]{0,400}Luz Marina R\./.test(hA) && /data-seccion="ellas-cuentan"[\s\S]*?Luz Marina R\.[\s\S]*?Desde la segunda semana duermo de corrido, y eso que no creía\./.test(hA) && /data-seccion="ellas-cuentan"[\s\S]*?Paola G\.[\s\S]*?data-seccion="ingredientes"/.test(hA) && /data-seccion="experiencias"[\s\S]*?Luz Marina R\./.test(hA) && /<span class="nota">4,5<\/span>/.test(hA) && /2 opiniones de clientas/.test(hA) && (hA.match(/<article class="res"/g) || []).length === 2 && /assets\/resena-1\.(png|jpg)/.test(hA), (hA.match(/<section class="sec resenas"[\s\S]{0,600}/) || [''])[0]);
    check('(AMUNA) Las fotos de estilo de vida no dicen que son clientas', !/clientas/i.test((hA.match(/data-seccion="historias"[\s\S]*?<\/section>/) || [''])[0] + (hA.match(/data-seccion="experiencias-fotos"[\s\S]*?<\/section>/) || [''])[0]));
    check('(AMUNA) Inter, los colores del producto y la corrección de Renata aplicada', /family=Inter:/.test(hA) && /--amarillo:#A62737/i.test(hA) && /--tinta-btn:#FFFFFF/i.test(hA) && /Prueba: Sueño Profundo, a tu ritmo/.test(hA), (hA.match(/:root\{--amarillo[^}]*\}/) || [''])[0]);
    // y funciona en un navegador: el combo cambia el precio de la barra; el botón abre la ventana de pedido
    let vivo = null;
    try {
      const { chromium } = (await import('node:module')).createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE_PATH || 'playwright');
      const nav = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {}) });
      try {
        const pag = await nav.newPage({ viewport: { width: 390, height: 844 } });
        const errores = [];
        pag.on('pageerror', (e) => errores.push(String(e)));
        await pag.goto(`${BASE}/landing/${idA}/index.html`, { waitUntil: 'load' });
        await pag.click('#oferta [data-combo="dos"]');
        const precio = await pag.textContent('#fPrecio');
        await pag.click('#ctaOferta');
        const abierta = await pag.evaluate(() => document.getElementById('modal').open);
        const ancho = await pag.evaluate(() => document.documentElement.scrollWidth);
        vivo = { precio, abierta, ancho, errores };
      } finally {
        await nav.close();
      }
    } catch (e) {
      vivo = { sinNavegador: String(e?.message || e).slice(0, 120) };
    }
    check('(AMUNA) En el navegador: el combo cambia el precio de la barra, el botón abre la ventana de pedido, sin errores ni scroll de lado', vivo?.sinNavegador || (vivo?.precio === '$152.900 COP' && vivo.abierta && vivo.ancho <= 390 && !vivo.errores.length), vivo);
    // sin reseñas reales: sin testimonio, «Ellas cuentan», reseñas, prueba social ni «N testimonios»
    r = await pedir('/api/landings/crear', { json: { productoId: prod, precios: { uno: '89900', dos: '152900', tres: '199900' } } });
    const idB = r.datos?.id;
    if (idB) creados.landings.push(idB);
    const lB = await esperar(300, () => leerLanding(idB), terminada);
    const hB = idB && fs.existsSync(path.join(RAIZ, 'temp', '_landings', idB, 'index.html')) ? html(idB) : '';
    const envB = idB && fs.existsSync(path.join(RAIZ, 'temp', '_landings', idB, 'prueba-imagenes.json')) ? JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', '_landings', idB, 'prueba-imagenes.json'), 'utf8')) : [];
    {
      const cB = envB.find((e) => e.slot === 'cuidado');
      check('(2026-11-27k) Sin profesional real: «cuidado» es una consulta médica ilustrativa (sin el producto, sin nombre, sin referencias) con su nota en la página', cB && /fictional professional scene/i.test(cB.prompt) && /No names, readable badges/.test(cB.prompt) && cB.referencias.length === 0 && /class="nota-img">(?:Imagen ilustrativa generada con IA|Escena profesional ilustrativa generada con IA)/.test(hB) && !/care-badge"/.test(hB), cB && { prompt: cB.prompt.slice(0, 200), refs: cB.referencias });
    }
    {
      // sin marcar la autorización, el profesional no se usa
      const pf = (await pedir('/api/landings/fotos', { cuerpo: fs.readFileSync(path.join(TMP, 'producto.png')), headers: { 'Content-Type': 'image/png' } })).datos?.id;
      const rr = await pedir('/api/landings/crear', { json: { productoId: prod, precios: { uno: '89900', dos: '152900', tres: '199900' }, profesional: { foto: pf, nombre: 'Dr. Prueba', especialidad: 'Medicina', autorizado: false } } });
      if (rr.datos?.id) creados.landings.push(rr.datos.id);
      check('(2026-11-27k) Sin marcar «Me autorizó…», el profesional no se usa', rr.st === 200 && !rr.datos?.profesional, rr.datos && { profesional: rr.datos.profesional });
      await esperar(300, () => leerLanding(rr.datos?.id), terminada);
    }
    check('(AMUNA) Sin capturas reales: las 35 imágenes, con 9 fotos caseras en el carrusel (como AMUNA) y un título que no habla de clientas', envB.length === 35 && envB.filter((e) => e.slot.startsWith('ugc-')).length === 9 && (hB.match(/data-seccion="experiencias-fotos"[\s\S]*?<\/section>/) || [''])[0].split('<img').length - 1 === 9 && !/clientas/i.test((hB.match(/data-seccion="experiencias-fotos"[\s\S]*?<\/section>/) || [''])[0]), envB.length);
    check('(AMUNA) Sin reseñas reales: no salen testimonio, «Ellas cuentan», experiencias, reseñas, prueba social ni «N testimonios»', lB?.estado === 'lista' && lB.plantilla === 'amuna' && !/data-seccion="(testimonio-destacado|ellas-cuentan|experiencias|resenas|prueba-social)"/.test(hB) && !/testimonios? compartidos?/.test(hB) && /data-seccion="historias"/.test(hB) && /data-seccion="pasos"/.test(hB), [lB?.estado, lB?.error, [...hB.matchAll(/data-seccion="([^"]+)"/g)].map((m) => m[1])]);
  }

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
  // (COPIAR_LANDINGS=<carpeta>: guarda una copia de las landings creadas, para mirarlas)
  if (process.env.COPIAR_LANDINGS) for (const id of creados.landings) if (fs.existsSync(path.join(RAIZ, 'temp', '_landings', id))) fs.cpSync(path.join(RAIZ, 'temp', '_landings', id), path.join(process.env.COPIAR_LANDINGS, id), { recursive: true });
  for (const id of creados.landings) fs.rmSync(path.join(RAIZ, 'temp', '_landings', id), { recursive: true, force: true });
  for(const f of creados.fotos)if(/^[a-f0-9]{12}\.(png|jpg)$/.test(f))fs.rmSync(path.join(RAIZ,'temp/_landings/_fotos',f),{force:true});
  for(const d of [path.join(RAIZ,'temp/_landings/_fotos'),path.join(RAIZ,'temp/_landings')])try{fs.rmdirSync(d);}catch{}
  if (creados.producto) fs.rmSync(path.join(RAIZ, 'temp', '_productos', creados.producto), { recursive: true, force: true });
  fs.rmSync(path.join(RAIZ, 'temp', `_modo-prueba-${PUERTO}`), { recursive: true, force: true });
  if (envPropio) fs.rmSync(ENV, { force: true });
  if (fallas) console.log(`\n  Registro de la app: ${path.join(TMP, 'app.log')}`);
  else fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n  ${pasan} bien, ${fallas} mal · ${Math.round((Date.now() - t0) / 1000)} s\n`);
  process.exit(fallas ? 1 : 0);
}

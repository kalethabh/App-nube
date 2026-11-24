// Prueba de SHOPIFY (lib/shopify/, rutas/shopify.js), sin Shopify de verdad: un Shopify CLI simulado
// (server/claude/pruebas/shopify-cli-falso.js, con los temas de una tienda falsa en una carpeta) y la API de
// administración simulada en este proceso; la app en MODO PRUEBA con el Claude falso.
//   node app/herramientas/probar-shopify.mjs        (PUERTO=<n>, por defecto 4492)
// Revisa: conectar varias tiendas (validaciones, la prueba de la clave, que la clave nunca sale por la API ni va en la
// línea de comandos, el archivo con permisos 600), ver los temas, pedirle a la IA un cambio (edita el código, sube un
// tema NUEVO sin publicar y no toca el publicado), aplicar un cambio de la API que propuso, publicar, una tienda «solo
// temas» (sin cambios de la API) y descartar su tema, subir una landing (plantilla, imágenes, enlaces, producto, video,
// página creada) y que la coordinadora del chat le pida un cambio a una tienda. Al final deja todo como estaba.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = path.resolve(APP, '..');
const PUERTO = Number(process.env.PUERTO) || 4492;
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
  const texto = await r.text();
  let datos = null;
  try {
    datos = JSON.parse(texto);
  } catch {
    /* no es JSON */
  }
  return { st: r.status, datos, texto };
}
async function esperar(seg, leer, listo) {
  const hasta = Date.now() + seg * 1000;
  let u = null;
  while (Date.now() < hasta) {
    u = await leer();
    if (listo(u)) return u;
    await dormir(400);
  }
  return u;
}

const TMP = fs.mkdtempSync(path.join(RAIZ, 'temp', '_probar-shopify-'));
const FALSO = path.join(TMP, 'tienda-falsa');
const TIENDAS = path.join(TMP, 'tiendas.json');
const TOKEN = 'shpat_bueno1234567890abcdefABCDEF12';
const TOKEN_TEMAS = 'shptka_soloTemas1234567890abcdef12';
const TOKEN_MX = 'shpat_mexico1234567890abcdefABCDEF'; // (2026-11-24) otra cuenta, otro país
const productosCreados = [];

// ------------------------------------------------------------ la API de administración simulada
const consultas = [];
let renovados = 0;
let base = '';
const admin = http.createServer(async (req, res) => {
  const partes = [];
  for await (const p of req) partes.push(p);
  const cuerpo = Buffer.concat(partes);
  const responder = (data, st = 200) => {
    res.writeHead(st, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };
  if (req.url === '/subida') {
    consultas.push({ subida: cuerpo.length });
    res.writeHead(201);
    return res.end();
  }
  if (req.url === '/admin/oauth/access_token') {
    const f = new URLSearchParams(cuerpo.toString());
    consultas.push({ oauth: f.get('client_id'), grant: f.get('grant_type') });
    if (f.get('grant_type') !== 'client_credentials' || f.get('client_secret') !== 'secreto-bueno-1234567890') return responder({ error: 'invalid_client', error_description: 'Client authentication failed' }, 400);
    return responder({ access_token: `shpca_renovado${++renovados}abcdefghijklmnopqrstu`, scope: 'write_themes', expires_in: 5 });
  }
  const tk = req.headers['x-shopify-access-token'];
  if (tk !== TOKEN && tk !== TOKEN_MX && !/^shpca_renovado/.test(tk || '')) return responder({ errors: '[API] Invalid API key or access token' }, 401);
  const { query, variables } = JSON.parse(cuerpo.toString() || '{}');
  consultas.push({ query, variables });
  if (/shop \{ name myshopifyDomain/.test(query)) return responder({ data: { shop: tk === TOKEN_MX ? { name: 'Tienda México', myshopifyDomain: 'mexico.myshopify.com', primaryDomain: { url: 'https://mexico.com' }, currencyCode: 'MXN', billingAddress: { countryCodeV2: 'MX' } } : { name: 'Mi Tienda Bella', myshopifyDomain: 'bella.myshopify.com', primaryDomain: { url: 'https://bella.com' }, currencyCode: 'COP', billingAddress: { countryCodeV2: 'CO' } } } });
  // (2026-11-24) copiar un producto de una tienda a otra
  if (/descriptionHtml/.test(query)) return responder({ data: { shop: { currencyCode: 'COP' }, products: { nodes: variables.q === 'handle:gotas' ? [{ title: 'Gotas', handle: 'gotas', descriptionHtml: '<p>Para dormir</p>', vendor: 'Bella', productType: 'Gotas', tags: ['sueño'], status: 'ACTIVE', options: [{ name: 'Tamaño', values: ['30 ml', '60 ml'] }], seo: { title: null, description: null }, variants: { nodes: [{ price: '59900', compareAtPrice: '89900', sku: 'G30', inventoryPolicy: 'DENY', selectedOptions: [{ name: 'Tamaño', value: '30 ml' }] }, { price: '99900', compareAtPrice: null, sku: 'G60', inventoryPolicy: 'DENY', selectedOptions: [{ name: 'Tamaño', value: '60 ml' }] }] }, media: { nodes: [{ image: { url: 'https://cdn.shopify.com/gotas.jpg', altText: 'Gotas' } }] } }] : [] } } });
  if (/productSet/.test(query)) {
    productosCreados.push({ tk, input: variables.i });
    return responder({ data: { productSet: { product: { id: `gid://shopify/Product/55${productosCreados.length}`, handle: variables.i.handle }, userErrors: [] } } });
  }
  if (/productUpdate/.test(query)) return responder({ data: { productUpdate: { product: { id: variables.p.id }, userErrors: [] } } });
  if (/publications\(first/.test(query)) return responder({ data: { publications: { nodes: [{ id: 'gid://shopify/Publication/1', name: 'Online Store' }] } } });
  if (/publishablePublish/.test(query)) return responder({ data: { publishablePublish: { userErrors: [] } } });
  if (/productDelete/.test(query)) return responder({ data: { productDelete: { deletedProductId: variables.i.id, userErrors: [] } } });
  if (/products\(first/.test(query)) return responder({ data: { shop: { name: 'Mi Tienda Bella', currencyCode: 'COP', primaryDomain: { url: 'https://bella.com' } }, products: { nodes: [{ title: 'Gotas', handle: 'gotas', status: 'ACTIVE' }] }, pages: { nodes: [] } } });
  if (/productByHandle/.test(query)) return responder({ data: { productByHandle: variables.h === 'mi-producto' ? { handle: 'mi-producto', variants: { nodes: [{ id: 'gid://shopify/ProductVariant/777888' }] } } : null } });
  if (/pageCreate/.test(query)) return responder({ data: { pageCreate: { page: { id: 'gid://shopify/Page/1', handle: variables.p.handle }, userErrors: [] } } });
  if (/stagedUploadsCreate/.test(query)) return responder({ data: { stagedUploadsCreate: { stagedTargets: [{ url: `${base}/subida`, resourceUrl: 'https://shopify-staged/abc', parameters: [{ name: 'key', value: 'k' }] }], userErrors: [] } } });
  if (/fileCreate/.test(query)) return responder({ data: { fileCreate: { files: [{ id: 'gid://shopify/Video/9' }], userErrors: [] } } });
  if (/node\(id/.test(query)) return responder({ data: { node: { fileStatus: 'READY', sources: [{ url: 'https://cdn.shopify.com/videos/c/o/v/anim.mp4', mimeType: 'video/mp4' }] } } });
  responder({ errors: [{ message: 'consulta no simulada' }] });
});
await new Promise((ok) => admin.listen(0, '127.0.0.1', ok));
base = `http://127.0.0.1:${admin.address().port}`;

// ------------------------------------------------------------ la app
const RESPALDOS = [path.join(RAIZ, 'temp', '_oficina', 'chat.json')];
const antes = new Map(RESPALDOS.map((f) => [f, fs.existsSync(f) ? fs.readFileSync(f) : null]));
const oficinaExistia = fs.existsSync(path.join(RAIZ, 'temp', '_oficina'));
const shopifyExistia = fs.existsSync(path.join(RAIZ, 'temp', '_shopify'));
const landingsExistia = fs.existsSync(path.join(RAIZ, 'temp', '_landings'));
const ENV = path.join(RAIZ, '.env');
const envPropio = !fs.existsSync(ENV);
if (envPropio) fs.writeFileSync(ENV, '# Lo escribió probar-shopify.mjs: claves falsas.\nKIE_API_KEY=simulada\nELEVENLABS_API_KEY=simulada\n');
const env = { ...process.env };
for (const k of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|OPENAI_|CODEX_|SHOPIFY_)/i.test(k)) delete env[k];
Object.assign(env, {
  PUERTO: String(PUERTO),
  ANUNCIOS_MODO_PRUEBA: '1',
  ANUNCIOS_PRUEBA_LIMPIO: '1',
  ANUNCIOS_SIN_GUARDADO: '1',
  ANUNCIOS_CLAUDE_BIN: path.join(APP, 'server', 'claude', 'pruebas', 'claude-falso.js'),
  AIA_MOTOR: 'claude',
  OFICINA_SIN_SEGUIMIENTO: '1',
  SHOPIFY_CLI_BIN: path.join(APP, 'server', 'claude', 'pruebas', 'shopify-cli-falso.js'),
  SHOPIFY_FALSO_DIR: FALSO,
  SHOPIFY_ADMIN_BASE: base,
  SHOPIFY_TIENDAS_ARCHIVO: TIENDAS,
  NO_PROXY: '127.0.0.1,localhost',
  no_proxy: '127.0.0.1,localhost',
});
const log = fs.createWriteStream(path.join(TMP, 'app.log'));
const app = cp.spawn(process.execPath, ['server/index.js'], { cwd: APP, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
app.stdout.pipe(log);
app.stderr.pipe(log);
const t0 = Date.now();
const creados = { landing: null };
const BELLA = 'bella.myshopify.com';
const OTRA = 'otra.myshopify.com';
const temasFalsos = (tienda = BELLA) => JSON.parse(fs.readFileSync(path.join(FALSO, tienda, 'temas.json'), 'utf8'));
const archivoFalso = (tema, f, tienda = BELLA) => (fs.existsSync(path.join(FALSO, tienda, 'temas', String(tema), f)) ? fs.readFileSync(path.join(FALSO, tienda, 'temas', String(tema), f), 'utf8') : null);
const terminado = (d) => d && !d.trabajando && d.estado !== 'trabajando';

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

  // conectar
  let r = await pedir('/api/shopify/tiendas');
  check('Sin tiendas al principio', r.st === 200 && r.datos?.tiendas?.length === 0, r.datos);
  r = await pedir('/api/shopify/tiendas', { json: { dominio: 'www.bella.com', token: TOKEN } });
  check('Una dirección que no es .myshopify.com se rechaza (y explica dónde verla)', r.st === 400 && /myshopify/.test(r.datos?.error), r.datos);
  r = await pedir('/api/shopify/tiendas', { json: { dominio: 'bella', token: 'hola123' } });
  check('Una clave que no es de Shopify se rechaza', r.st === 400 && /shpat_/.test(r.datos?.error), r.datos);
  r = await pedir('/api/shopify/tiendas', { json: { dominio: 'bella', token: 'shpat_malo1234567890abcdefABCDEF12' } });
  check('Una clave que Shopify no acepta no se guarda', r.st === 400 && /no aceptó/.test(r.datos?.error) && !fs.existsSync(TIENDAS), r.datos);
  r = await pedir('/api/shopify/tiendas', { json: { dominio: 'https://admin.shopify.com/store/bella/products', token: TOKEN } });
  const bella = r.datos;
  check('Conecta con acceso completo (toma el nombre de la tienda y entiende el enlace del admin)', r.st === 200 && bella?.tipo === 'completo' && bella.nombre === 'Mi Tienda Bella' && bella.dominio === 'bella.myshopify.com', r.datos);
  r = await pedir('/api/shopify/tiendas', { json: { dominio: 'otra.myshopify.com', token: TOKEN_TEMAS, nombre: 'Tienda Dos' } });
  const otra = r.datos;
  check('Conecta una SEGUNDA tienda solo para temas (Theme Access)', r.st === 200 && otra?.tipo === 'temas' && otra.nombre === 'Tienda Dos', r.datos);
  r = await pedir('/api/shopify/tiendas');
  check('Las dos tiendas en la lista y SIN sus claves', r.datos?.tiendas?.length === 2 && !r.texto.includes(TOKEN) && !r.texto.includes(TOKEN_TEMAS) && !/"token"\s*:/.test(r.texto) && !/shp(at|tka|ca)_/.test(r.texto), r.texto);
  const modo = fs.statSync(TIENDAS).mode & 0o777;
  check('Las claves quedan en su archivo con permisos 600', process.platform === 'win32' || modo === 0o600, modo.toString(8));
  r = await pedir('/api/shopify/tiendas', { json: { dominio: 'bella', token: TOKEN }, headers: { Origin: 'https://malo.com' } });
  check('Desde otro sitio no se puede conectar', r.st === 403, r.datos);

  r = await pedir('/api/shopify/tiendas', { json: { dominio: 'tres', clientId: 'clienteid1234567890abcd', clientSecret: 'secreto-malo-123456789' } });
  check('Client ID y secreto equivocados: no se guarda y lo explica', r.st === 400 && /Client ID/.test(r.datos?.error), r.datos);
  r = await pedir('/api/shopify/tiendas', { json: { dominio: 'tres', clientId: 'clienteid1234567890abcd', clientSecret: 'secreto-bueno-1234567890', nombre: 'Tienda Tres' } });
  const tres = r.datos;
  check('Conecta con Client ID y secreto del Dev Dashboard (acceso completo)', r.st === 200 && tres?.tipo === 'completo' && tres.forma === 'dev-dashboard' && renovados === 1, r.datos);
  const enArchivo = fs.readFileSync(TIENDAS, 'utf8');
  r = await pedir('/api/shopify/tiendas');
  check('El secreto no sale por la API', !r.texto.includes('secreto-bueno') && !r.texto.includes('shpca_') && !r.texto.includes('clienteid') && enArchivo.includes('secreto-bueno'));
  r = await pedir(`/api/shopify/tiendas/${tres.id}/temas`);
  const llamadaTres = fs.readFileSync(path.join(FALSO, 'tres.myshopify.com', 'llamadas.log'), 'utf8');
  check('Antes de usarla RENUEVA el token que venció (y la CLI recibe el nuevo)', r.st === 200 && renovados >= 2 && /shpca_renovado2/.test(fs.readFileSync(TIENDAS, 'utf8')) && !llamadaTres.includes('shpca_'), { renovados, st: r.st });
  await pedir(`/api/shopify/tiendas/${tres.id}`, { metodo: 'DELETE' });

  r = await pedir(`/api/shopify/tiendas/${bella.id}/temas`);
  check('Ve los temas (el publicado primero)', r.datos?.temas?.[0]?.nombre === 'Dawn' && r.datos.temas[0].rol === 'live' && r.datos.temas.length === 2, r.datos);

  // pedirle a la IA
  r = await pedir('/api/shopify/trabajos', { json: { tiendaId: bella.id, pedido: 'x' } });
  check('Un pedido vacío se rechaza', r.st === 400, r.datos);
  r = await pedir('/api/shopify/trabajos', { json: { tiendaId: bella.id, pedido: 'Pon el botón de comprar en verde y crea una página de preguntas frecuentes', motor: 'claude' } });
  const t1 = r.datos?.id;
  let t = await esperar(120, async () => (await pedir(`/api/shopify/trabajos/${t1}`)).datos, terminado);
  check('El trabajo termina «lista»', t?.estado === 'lista', t);
  check('La IA cambió el código del tema (y dice qué hizo)', t?.archivos?.includes('sections/boton.liquid') && /verde/.test(t.resumen || ''), t);
  const nuevo = t?.nuevoTema;
  check('Lo subió como tema NUEVO sin publicar, con vista previa y editor', nuevo?.id && nuevo.id !== '1001' && /preview_theme_id=/.test(nuevo.vista || '') && /\/editor$/.test(nuevo.editor || '') && temasFalsos().find((x) => String(x.id) === nuevo.id)?.role === 'unpublished', { nuevo, temas: temasFalsos() });
  check('El tema nuevo tiene el cambio y el publicado sigue igual', /Pídelo ya/.test(archivoFalso(nuevo?.id, 'sections/boton.liquid') || '') && /Comprar/.test(archivoFalso(1001, 'sections/boton.liquid')) && archivoFalso(nuevo?.id, 'layout/theme.liquid'));
  check('Propone el cambio de la API (crear la página) y espera tu «Aplicar»', t?.admin?.length === 1 && t.admin[0].estado === 'pendiente' && !consultas.some((c) => /pageCreate/.test(c.query || '')), t?.admin);
  r = await pedir(`/api/shopify/trabajos/${t1}/admin/0`, { json: {} });
  check('«Aplicar» lo hace en la tienda', r.datos?.admin?.[0]?.estado === 'hecho' && consultas.some((c) => /pageCreate/.test(c.query || '') && c.variables?.p?.handle === 'preguntas'), r.datos?.admin);
  r = await pedir(`/api/shopify/trabajos/${t1}/publicar`, { json: {} });
  check('«Publicar» lo deja en vivo', r.datos?.estado === 'publicado' && temasFalsos().find((x) => String(x.id) === nuevo.id)?.role === 'live' && temasFalsos().find((x) => x.id === 1001)?.role === 'unpublished', { r: r.datos?.estado, temas: temasFalsos() });

  // la tienda «solo temas»
  r = await pedir('/api/shopify/trabajos', { json: { tiendaId: otra.id, pedido: 'El botón en verde y una página nueva de contacto', motor: 'claude' } });
  const t2 = r.datos?.id;
  t = await esperar(120, async () => (await pedir(`/api/shopify/trabajos/${t2}`)).datos, terminado);
  check('En una tienda «solo temas» cambia el tema pero no propone cambios de la API', t?.estado === 'lista' && t.nuevoTema?.id && (t.admin || []).length === 0, t);
  const tema2 = t?.nuevoTema?.id;
  r = await pedir(`/api/shopify/trabajos/${t2}/descartar`, { json: {} });
  check('«Descartar» borra ese tema de la tienda', r.datos?.estado === 'descartado' && !temasFalsos(OTRA).some((x) => String(x.id) === tema2), r.datos);
  const llamadas = [BELLA, OTRA].map((x) => fs.readFileSync(path.join(FALSO, x, 'llamadas.log'), 'utf8')).join('').trim().split('\n').map((l) => JSON.parse(l));
  check('Shopify CLI recibió la clave por el entorno y NUNCA en la línea de comandos', llamadas.length > 5 && llamadas.every((l) => l.claveEnEnv && !l.claveEnArgv && l.store), llamadas.slice(0, 3));

  // subir una landing
  const lid = 'probar-shopify-landing';
  creados.landing = lid;
  const dirL = path.join(RAIZ, 'temp', '_landings', lid);
  fs.mkdirSync(path.join(dirL, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dirL, 'assets', 'a1.webp'), Buffer.alloc(500, 1));
  fs.writeFileSync(path.join(dirL, 'assets', 'v1.mp4'), Buffer.alloc(800, 2));
  fs.writeFileSync(path.join(dirL, 'landing.json'), JSON.stringify({ id: lid, url: 'https://original.com/products/gotas', modo: 'tal-cual', titulo: 'Gotas Originales', estado: 'lista', creado: new Date().toISOString() }));
  fs.writeFileSync(
    path.join(dirL, 'index.html'),
    '<!doctype html>\n<html><head><style>.h{background:url(assets/a1.webp)}</style></head><body><h1>Precio {{ especial }}</h1><img src="assets/a1.webp" srcset="assets/a1.webp 480w"><video src="assets/v1.mp4" data-kc-origen="https://cdn.original.com/a.gif" autoplay muted loop playsinline width="320" height="320"></video><a href="https://original.com/products/gotas?variant=1">Comprar</a><form action="https://original.com/cart/add"><input type="hidden" name="id" value="123456"></form></body></html>',
  );
  const paginasAntes = consultas.filter((c) => /pageCreate/.test(c.query || '')).length;
  r = await pedir('/api/shopify/landing', { json: { landingId: lid, tiendaId: bella.id, titulo: 'Gotas para dormir', producto: 'mi-producto' } });
  const t3 = r.datos?.id;
  t = await esperar(120, async () => (await pedir(`/api/shopify/trabajos/${t3}`)).datos, terminado);
  const sufijoL = t?.plantilla?.replace(/^page\./, '');
  check('(2026-11-24) Primero la VISTA PREVIA: el código queda en el tema y la página todavía no existe', t?.estado === 'vista-previa' && t.vistaPrevia === `https://bella.com/?view=${sufijoL}` && !t.pagina && consultas.filter((c) => /pageCreate/.test(c.query || '')).length === paginasAntes, t);
  const vivo = temasFalsos().find((x) => x.role === 'live').id;
  check('La vista previa es la misma plantilla como portada alternativa (index.<sufijo>)', (archivoFalso(vivo, `templates/index.${sufijoL}.liquid`) || '').startsWith('{% layout none %}'));
  r = await pedir(`/api/shopify/trabajos/${t3}/publicar`, { metodo: 'POST' });
  t = r.datos;
  check('«Publicar la página» crea la página publicada con esa plantilla', t?.estado === 'lista' && t.pagina === 'https://bella.com/pages/gotas-para-dormir' && consultas.some((c) => /pageCreate/.test(c.query || '') && c.variables?.p?.templateSuffix === sufijoL), t);
  const plantilla = archivoFalso(vivo, `templates/${t?.plantilla}.liquid`) || '';
  check('Va como plantilla de página en el tema publicado, sin layout de la tienda', plantilla.startsWith('{% layout none %}') && /Precio \{\{ '\{\{' \}\} especial/.test(plantilla), plantilla.slice(0, 300));
  check('Sus imágenes van a los assets del tema (con asset_url)', /\{\{ 'kads-[a-z0-9]+-a1\.webp' \| asset_url \}\}/.test(plantilla) && /url\(\{\{ 'kads-/.test(plantilla) && fs.readdirSync(path.join(FALSO, BELLA, 'temas', String(vivo), 'assets')).some((f) => /^kads-.*a1\.webp$/.test(f)), plantilla);
  check('Los botones van a TU producto (y su variante)', /href="\/products\/mi-producto\?variant=1"/.test(plantilla) && /action="\/cart\/add"/.test(plantilla) && /value="777888"/.test(plantilla) && !/original\.com\/(products|cart)/.test(plantilla), plantilla);
  check('El video sube a Archivos de Shopify', /src="https:\/\/cdn\.shopify\.com\/videos\/c\/o\/v\/anim\.mp4"/.test(plantilla) && consultas.some((c) => c.subida), plantilla);
  check('No tocó lo que ya había en el tema', /Pídelo ya/.test(archivoFalso(vivo, 'sections/boton.liquid') || ''));
  r = await pedir('/api/shopify/landing', { json: { landingId: lid, tiendaId: otra.id, titulo: 'Gotas' } });
  t = await esperar(120, async () => (await pedir(`/api/shopify/trabajos/${r.datos?.id}`)).datos, terminado);
  const p2 = archivoFalso(1001, `templates/${t?.plantilla}.liquid`, OTRA) || '';
  check('En una tienda «solo temas» sube la plantilla con su vista previa y el video vuelve a ser el GIF original', t?.estado === 'vista-previa' && t.vistaPrevia && !t.pagina && /<img src="https:\/\/cdn\.original\.com\/a\.gif"/.test(p2), { t, p2: p2.slice(0, 400) });
  r = await pedir(`/api/shopify/trabajos/${t.id}/publicar`, { metodo: 'POST' });
  check('…y al publicar queda la indicación para crear la página en Shopify', r.datos?.estado === 'lista' && !r.datos.pagina, r.datos);

  // (2026-11-24) CUENTAS Y PAÍSES, VARIAS TIENDAS A LA VEZ Y COPIAR DE UNA A OTRAS
  check('Con acceso completo, el país y la moneda se leen solos (y la cuenta por defecto)', bella.pais === 'CO' && bella.moneda === 'COP' && bella.cuenta === 'Mi cuenta', bella);
  r = await pedir(`/api/shopify/tiendas/${bella.id}`, { metodo: 'PUT', json: { cuenta: 'Cuenta Colombia', pais: 'co' } });
  check('Le pones la cuenta y el país a una tienda (sin tocar su clave)', r.st === 200 && r.datos?.cuenta === 'Cuenta Colombia' && r.datos.pais === 'CO' && fs.readFileSync(TIENDAS, 'utf8').includes(TOKEN), r.datos);
  r = await pedir('/api/shopify/tiendas', { json: { dominio: 'mexico', token: TOKEN_MX, cuenta: 'Cuenta 2' } });
  const mx = r.datos;
  check('Otra cuenta de Shopify: una tienda de México (país y moneda propios)', r.st === 200 && mx?.cuenta === 'Cuenta 2' && mx.pais === 'MX' && mx.moneda === 'MXN', r.datos);
  r = await pedir('/api/shopify/trabajos', { json: { tiendaIds: [bella.id, otra.id], pedido: 'Pon el botón de comprar en verde', motor: 'codex' } });
  const varios = (r.datos?.trabajos || []).map((x) => x.id);
  check('El mismo pedido en dos tiendas a la vez (un trabajo por tienda, con Codex)', r.st === 200 && varios.length === 2 && r.datos.trabajos.every((x) => x.motor === 'codex') && new Set(r.datos.trabajos.map((x) => x.tiendaId)).size === 2, r.datos);
  for (const v of varios) await esperar(120, async () => (await pedir(`/api/shopify/trabajos/${v}`)).datos, terminado);
  // una sección con lo que necesita (un snippet y un css) en el tema publicado de Bella
  const vivoB = temasFalsos().find((x) => x.role === 'live').id;
  const ponerB = (f, txt) => {
    const a = path.join(FALSO, BELLA, 'temas', String(vivoB), f);
    fs.mkdirSync(path.dirname(a), { recursive: true });
    fs.writeFileSync(a, txt);
  };
  ponerB('sections/oferta.liquid', "<div class=\"oferta\">{% render 'kads-sello' %}</div>{{ 'oferta.css' | asset_url | stylesheet_tag }}\n{% schema %}{\"name\":\"Oferta\"}{% endschema %}\n");
  ponerB('snippets/kads-sello.liquid', '<span>Sello</span>\n');
  ponerB('assets/oferta.css', '.oferta{color:red}\n');
  r = await pedir(`/api/shopify/tiendas/${bella.id}/partes`);
  check('Lista las partes del tema de una tienda para elegir', r.st === 200 && r.datos?.archivos?.includes('sections/oferta.liquid') && r.datos.archivos.includes('sections/boton.liquid') && !r.datos.archivos.some((f) => /^(layout|config)\//.test(f)), r.datos);
  r = await pedir('/api/shopify/copias', { json: { origenId: bella.id, destinos: [otra.id], que: 'partes', archivos: ['sections/oferta.liquid'] } });
  let cp1 = await esperar(120, async () => (await pedir(`/api/shopify/trabajos/${r.datos?.id}`)).datos, terminado);
  const d1 = cp1?.destinos?.[0];
  check('Copiar PARTES: van con lo que necesitan (snippet y css)', cp1?.estado === 'lista' && ['sections/oferta.liquid', 'snippets/kads-sello.liquid', 'assets/oferta.css'].every((f) => cp1.archivos?.includes(f)), cp1);
  check('…a la otra tienda como tema NUEVO SIN publicar (con vista previa) y su tema publicado no cambia', d1?.estado === 'lista' && d1.nuevoTema?.id && /preview_theme_id/.test(d1.nuevoTema.vista || '') && archivoFalso(d1.nuevoTema.id, 'sections/oferta.liquid', OTRA) && archivoFalso(d1.nuevoTema.id, 'snippets/kads-sello.liquid', OTRA) && !archivoFalso(temasFalsos(OTRA).find((x) => x.role === 'live').id, 'sections/oferta.liquid', OTRA), { d1, temas: temasFalsos(OTRA) });
  r = await pedir('/api/shopify/copias', { json: { origenId: bella.id, destinos: [otra.id], que: 'tema' } });
  cp1 = await esperar(120, async () => (await pedir(`/api/shopify/trabajos/${r.datos?.id}`)).datos, terminado);
  check('Copiar el TEMA COMPLETO a otra tienda: tema nuevo sin publicar', cp1?.destinos?.[0]?.estado === 'lista' && archivoFalso(cp1.destinos[0].nuevoTema?.id, 'sections/oferta.liquid', OTRA) && temasFalsos(OTRA).find((x) => String(x.id) === cp1.destinos[0].nuevoTema.id)?.role === 'unpublished', cp1);
  r = await pedir('/api/shopify/copias', { json: { origenId: bella.id, destinos: [otra.id], que: 'producto', producto: 'gotas' } });
  check('Un producto no se copia a una tienda «solo temas» (lo explica)', r.st === 400 && /acceso completo/.test(r.datos?.error || ''), r.datos);
  r = await pedir('/api/shopify/copias', { json: { origenId: bella.id, destinos: [mx.id], que: 'producto', producto: 'gotas' } });
  const cpP = r.datos?.id;
  cp1 = await esperar(120, async () => (await pedir(`/api/shopify/trabajos/${cpP}`)).datos, terminado);
  const pc = productosCreados[productosCreados.length - 1];
  check('Copiar un PRODUCTO a la tienda de México: en BORRADOR, con sus variantes, opciones e imágenes', cp1?.destinos?.[0]?.estado === 'lista' && pc?.tk === TOKEN_MX && pc.input.status === 'DRAFT' && pc.input.title === 'Gotas' && pc.input.variants.length === 2 && pc.input.productOptions?.[0]?.name === 'Tamaño' && pc.input.files?.[0]?.originalSource === 'https://cdn.shopify.com/gotas.jpg', { cp1, pc });
  check('…y avisa que la moneda es otra (COP → MXN)', /COP/.test(cp1?.destinos?.[0]?.aviso || '') && /MXN/.test(cp1.destinos[0].aviso), cp1?.destinos?.[0]);
  r = await pedir(`/api/shopify/trabajos/${cpP}/destinos/${mx.id}/publicar`, { json: {} });
  check('«Publicar» en esa tienda: el producto queda activo y en la tienda online', r.datos?.destinos?.[0]?.estado === 'publicado' && consultas.some((c) => /productUpdate/.test(c.query || '') && c.variables?.p?.status === 'ACTIVE') && consultas.some((c) => /publishablePublish/.test(c.query || '')), r.datos);
  await pedir(`/api/shopify/tiendas/${mx.id}`, { metodo: 'DELETE' });

  // la coordinadora
  await pedir('/api/oficina/chat', { json: { texto: 'En la tienda cambia el botón de comprar a verde' } });
  const c = await esperar(60, async () => (await pedir('/api/oficina/chat')).datos, (d) => d?.mensajes?.some((m) => m.de !== 'tu' && /tienda/.test(m.texto)));
  const tr = (await pedir('/api/shopify/trabajos')).datos?.trabajos || [];
  check('La coordinadora le pide el cambio a la tienda desde el chat', c?.mensajes?.some((m) => m.de !== 'tu' && /tienda/.test(m.texto)) && tr.some((x) => x.tipo === 'tema' && /botón de comprar a verde/.test(x.pedido)), { msgs: c?.mensajes?.slice(-2), tr: tr.map((x) => x.pedido) });
  await esperar(60, async () => (await pedir('/api/shopify/trabajos')).datos?.trabajos, (l) => l?.every((x) => !x.trabajando));

  r = await pedir(`/api/shopify/tiendas/${otra.id}`, { metodo: 'DELETE' });
  check('Desconectar una tienda la quita (y su clave)', r.st === 200 && (await pedir('/api/shopify/tiendas')).datos.tiendas.length === 1 && !fs.readFileSync(TIENDAS, 'utf8').includes(TOKEN_TEMAS), r.datos);
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
  admin.close();
  if (creados.landing) fs.rmSync(path.join(RAIZ, 'temp', '_landings', creados.landing), { recursive: true, force: true });
  if (!landingsExistia) fs.rmSync(path.join(RAIZ, 'temp', '_landings'), { recursive: true, force: true });
  if (!shopifyExistia) fs.rmSync(path.join(RAIZ, 'temp', '_shopify'), { recursive: true, force: true });
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

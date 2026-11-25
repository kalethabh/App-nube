// Prueba del INGRESO CON CUENTA (lib/acceso.js, rutas/acceso.js), sin internet: un Supabase falso en este proceso
// (/auth/v1/token, /auth/v1/user, /auth/v1/signup, /auth/v1/logout y las funciones kads_* de deploy/supabase-kads.sql
// imitadas en memoria) y la app en MODO PRUEBA con KADS_SUPABASE_URL apuntando a él.
//   node app/herramientas/probar-acceso.mjs        (PUERTO=<n>, por defecto 4494)
// Revisa: sin sesión se va a /entrar (y la API dice 401), clave mala, entrar, el primero queda dueño, el segundo
// pendiente (no ve nada), el dueño lo aprueba en /usuarios, un empleado usa la app pero no cambia claves ni ajustes ni ve
// /usuarios, la sesión vencida se renueva sola, salir, y el conector /mcp sigue con su propia llave.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = path.resolve(APP, '..');
const PUERTO = Number(process.env.PUERTO) || 4494;
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

// ------------------------------------------------------------ el Supabase falso
const ANON = 'anon-falsa';
const cuentas = new Map([
  ['dueno@x.co', { id: '11111111-1111-1111-1111-111111111111', clave: 'clave-dueno', nombre: 'Dueña' }],
  ['ana@x.co', { id: '22222222-2222-2222-2222-222222222222', clave: 'clave-ana', nombre: 'Ana' }],
]);
const kads = new Map(); // id -> { rol, nombre, correo }
const refrescos = new Map(); // refresh -> correo
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (id, seg) => `${b64({ alg: 'none' })}.${b64({ sub: id, exp: Math.floor(Date.now() / 1000) + seg })}.firma`;
let duracion = 3600;
const sesion = (correo) => {
  const c = cuentas.get(correo);
  const refresh = `r-${Math.random().toString(36).slice(2)}`;
  refrescos.set(refresh, correo);
  return { access_token: jwt(c.id, duracion), refresh_token: refresh, token_type: 'bearer' };
};
const idDe = (req) => {
  const t = String(req.headers.authorization || '').replace(/^Bearer /, '');
  try {
    const p = JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());
    return p.exp * 1000 > Date.now() ? p.sub : null;
  } catch {
    return null;
  }
};
const pedidosSb = [];
const supa = http.createServer(async (req, res) => {
  let cuerpo = '';
  for await (const p of req) cuerpo += p;
  const b = cuerpo ? JSON.parse(cuerpo) : {};
  const u = new URL(req.url, 'http://x');
  pedidosSb.push(u.pathname);
  const json = (st, d) => {
    res.writeHead(st, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(d));
  };
  if (req.headers.apikey !== ANON) return json(401, { message: 'sin apikey' });
  if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'password') {
    const c = cuentas.get(b.email);
    return c && c.clave === b.password ? json(200, sesion(b.email)) : json(400, { error: 'invalid_grant' });
  }
  if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'refresh_token') {
    const correo = refrescos.get(b.refresh_token);
    if (!correo) return json(400, { error: 'invalid_grant' });
    refrescos.delete(b.refresh_token);
    return json(200, sesion(correo));
  }
  if (u.pathname === '/auth/v1/signup') {
    if (cuentas.has(b.email)) return json(422, { msg: 'User already registered' });
    cuentas.set(b.email, { id: `33333333-3333-3333-3333-${String(cuentas.size).padStart(12, '0')}`, clave: b.password, nombre: b.data?.nombre });
    return json(200, sesion(b.email));
  }
  if (u.pathname === '/auth/v1/logout') return json(204, {});
  const id = idDe(req);
  const correo = [...cuentas].find(([, c]) => c.id === id)?.[0];
  if (u.pathname === '/auth/v1/user') return id ? json(200, { id, email: correo }) : json(401, { msg: 'bad jwt' });
  if (!id) return json(401, { message: 'JWT expired' });
  const esDueno = kads.get(id)?.rol === 'owner';
  if (u.pathname === '/rest/v1/rpc/kads_mi_rol') {
    if (!kads.has(id)) kads.set(id, { rol: [...kads.values()].some((k) => k.rol === 'owner') ? 'pendiente' : 'owner', nombre: cuentas.get(correo).nombre, correo });
    return json(200, [{ rol: kads.get(id).rol, nombre: kads.get(id).nombre }]);
  }
  if (u.pathname === '/rest/v1/rpc/kads_lista_usuarios') return esDueno ? json(200, [...kads].map(([i, k]) => ({ id: i, ...k }))) : json(403, { message: 'Solo el dueño' });
  if (u.pathname === '/rest/v1/rpc/kads_cambiar_rol') {
    if (!esDueno) return json(403, { message: 'Solo el dueño' });
    if (!kads.has(b.p_usuario)) return json(400, { message: 'Ese usuario no ha entrado a Kads' });
    kads.get(b.p_usuario).rol = b.p_rol;
    return json(204, null);
  }
  json(404, { message: 'no existe' });
});
await new Promise((ok) => supa.listen(0, '127.0.0.1', ok));

// ------------------------------------------------------------ la app
const ENV = path.join(RAIZ, '.env');
const envPropio = !fs.existsSync(ENV);
if (envPropio) fs.writeFileSync(ENV, '# Lo escribió probar-acceso.mjs: claves falsas.\nKIE_API_KEY=simulada\nELEVENLABS_API_KEY=simulada\n');
const TMP = fs.mkdtempSync(path.join(RAIZ, 'temp', '_probar-acceso-'));
const env = { ...process.env };
for (const k of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|OPENAI_|CODEX_|KADS_)/i.test(k)) delete env[k];
Object.assign(env, { PUERTO: String(PUERTO), ANUNCIOS_MODO_PRUEBA: '1', ANUNCIOS_PRUEBA_LIMPIO: '1', ANUNCIOS_SIN_GUARDADO: '1', ANUNCIOS_CLAUDE_BIN: path.join(APP, 'server', 'claude', 'pruebas', 'claude-falso.js'), AIA_MOTOR: 'claude', OFICINA_SIN_SEGUIMIENTO: '1', KADS_SUPABASE_URL: `http://127.0.0.1:${supa.address().port}`, KADS_SUPABASE_ANON: ANON, KADS_PUERTA: 'puerta.prueba', NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost' });
const log = fs.createWriteStream(path.join(TMP, 'app.log'));
const app = cp.spawn(process.execPath, ['server/index.js'], { cwd: APP, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
app.stdout.pipe(log);
app.stderr.pipe(log);
const t0 = Date.now();

const galletas = (r) => (r.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).filter((c) => !/=$/.test(c)).join('; ');
async function pedir(ruta, { metodo, json, galleta, accept = 'application/json' } = {}) {
  const r = await fetch(BASE + ruta, {
    method: metodo || (json !== undefined ? 'POST' : 'GET'),
    redirect: 'manual',
    headers: { Accept: accept, ...(json !== undefined ? { 'Content-Type': 'application/json', Origin: BASE } : {}), ...(galleta ? { Cookie: galleta } : {}) },
    body: json !== undefined ? JSON.stringify(json) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const texto = await r.text();
  let datos = null;
  try {
    datos = JSON.parse(texto);
  } catch {
    /* html */
  }
  return { st: r.status, datos, texto, donde: r.headers.get('location'), galleta: galletas(r) };
}

// (2026-11-25d) la puerta de Vercel, simulada: reenvía todo a la app (como el rewrite de vercel/vercel.json) y el
// navegador manda el origen de la puerta
const puerta = http.createServer((req, res) => {
  const p = http.request({ host: '127.0.0.1', port: PUERTO, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${PUERTO}`, 'x-forwarded-proto': 'https' } }, (r) => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  p.on('error', () => res.writeHead(502).end());
  req.pipe(p);
});
await new Promise((ok) => puerta.listen(0, '127.0.0.1', ok));
const PUERTA = `http://127.0.0.1:${puerta.address().port}`;

async function principal() {
  let arriba = false;
  for (let i = 0; i < 120 && !arriba; i++) {
    try {
      arriba = [302, 200].includes((await pedir('/')).st);
    } catch {
      await dormir(500);
    }
  }
  if (!check('La app de prueba arranca', arriba)) return;

  let r = await pedir('/', { accept: 'text/html' });
  check('Sin sesión, la app manda a /entrar', r.st === 302 && /^\/entrar\?volver=/.test(r.donde || ''), r);
  r = await pedir('/api/productos');
  check('Sin sesión, la API dice 401', r.st === 401 && /entrar/.test(r.datos?.error || ''), r.datos);
  r = await pedir('/entrar', { accept: 'text/html' });
  check('La página para entrar se ve sin sesión', r.st === 200 && /Entrar/.test(r.texto) && /cuenta de Kads Studio/.test(r.texto) && !/Centro de Control/.test(r.texto));
  r = await pedir('/mcp/clave-que-no-existe', { metodo: 'POST', json: {} });
  check('El conector /mcp sigue con su propia llave (404, no pide ingreso)', r.st === 404, r);

  r = await pedir('/api/acceso/entrar', { json: { correo: 'dueno@x.co', clave: 'mala' } });
  check('Clave mala: no entra', r.st === 401 && !r.galleta, r);
  r = await pedir('/api/acceso/entrar', { json: { correo: 'dueno@x.co', clave: 'clave-dueno' } });
  const dueno = r.galleta;
  check('Entra con su correo y clave (cookies de sesión)', r.st === 200 && /kads_sesion=/.test(dueno) && /kads_refresco=/.test(dueno), r);
  r = await pedir('/api/acceso/yo', { galleta: dueno });
  check('El primero que entra queda dueño', r.datos?.rol === 'owner' && r.datos.correo === 'dueno@x.co', r.datos);
  r = await pedir('/api/productos', { galleta: dueno });
  check('El dueño usa la app', r.st === 200, r);
  r = await pedir('/', { galleta: dueno, accept: 'text/html' });
  check('Y ve la interfaz', r.st === 200 && /<div id="root"|<script/.test(r.texto), r.st);

  r = await pedir('/api/acceso/entrar', { json: { correo: 'ana@x.co', clave: 'clave-ana' } });
  const ana = r.galleta;
  r = await pedir('/api/acceso/yo', { galleta: ana });
  check('El segundo queda pendiente', r.datos?.rol === 'pendiente', r.datos);
  r = await pedir('/api/productos', { galleta: ana });
  check('Pendiente: la API no le da nada', r.st === 403 && /aprueb/.test(r.datos?.error || ''), r.datos);
  r = await pedir('/', { galleta: ana, accept: 'text/html' });
  check('Pendiente: ve «esperando aprobación»', r.st === 403 && /esperando que el dueño/.test(r.texto), r.st);
  r = await pedir('/api/acceso/usuarios', { galleta: ana });
  check('Pendiente: no ve los usuarios', r.st === 403);

  r = await pedir('/usuarios', { galleta: dueno, accept: 'text/html' });
  check('El dueño abre /usuarios', r.st === 200 && /Usuarios/.test(r.texto));
  r = await pedir('/api/acceso/usuarios', { galleta: dueno });
  const idAna = r.datos?.usuarios?.find((x) => x.correo === 'ana@x.co')?.id;
  check('Y ve a los dos con su rol', r.st === 200 && r.datos.usuarios.length === 2 && idAna, r.datos);
  r = await pedir(`/api/acceso/usuarios/${idAna}`, { metodo: 'PUT', json: { rol: 'owner' }, galleta: dueno });
  check('No se puede hacer dueño a otro', r.st === 400, r);
  r = await pedir(`/api/acceso/usuarios/${idAna}`, { metodo: 'PUT', json: { rol: 'empleado' }, galleta: dueno });
  check('El dueño la aprueba como empleada', r.st === 200, r);

  r = await pedir('/api/productos', { galleta: ana });
  check('Aprobada: usa la app', r.st === 200, r);
  r = await pedir('/api/claves', { galleta: ana });
  check('Empleada: ve si hay claves (sin valores)', r.st === 200, r);
  r = await pedir('/api/claves', { metodo: 'PUT', json: { kie: 'otra' }, galleta: ana });
  check('Empleada: no cambia las claves', r.st === 403 && /dueño/.test(r.datos?.error || ''), r);
  r = await pedir('/api/ajustes/preferencias', { metodo: 'PUT', json: {}, galleta: ana });
  check('Empleada: no cambia los ajustes', r.st === 403, r);
  r = await pedir('/usuarios', { galleta: ana, accept: 'text/html' });
  check('Empleada: no abre /usuarios', r.st === 403);
  r = await pedir('/api/acceso/usuarios', { galleta: ana });
  check('Empleada: no ve la lista de usuarios', r.st === 403);

  // sesión vencida: se renueva con la cookie de refresco
  duracion = -10;
  r = await pedir('/api/acceso/entrar', { json: { correo: 'dueno@x.co', clave: 'clave-dueno' } });
  const vencida = r.galleta;
  duracion = 3600;
  r = await pedir('/api/productos', { galleta: vencida });
  check('Sesión vencida: se renueva sola (nuevas cookies) y sigue', r.st === 200 && /kads_sesion=/.test(r.galleta), { st: r.st, galleta: r.galleta });
  r = await pedir('/api/productos', { galleta: vencida.replace(/kads_refresco=[^;]+/, 'kads_refresco=no-sirve') });
  check('Vencida y sin refresco válido: 401', r.st === 401, r);

  r = await pedir('/api/acceso/registro', { json: { nombre: 'Luz', correo: 'luz@x.co', clave: 'clave-luz' } });
  const luz = r.galleta;
  r = await pedir('/api/acceso/yo', { galleta: luz });
  check('Crear cuenta: entra y queda pendiente', r.datos?.rol === 'pendiente' && r.datos.nombre === 'Luz', r.datos);
  r = await pedir('/api/acceso/registro', { json: { nombre: 'Otra', correo: 'luz@x.co', clave: 'clave-luz' } });
  check('Un correo que ya tiene cuenta: avisa', r.st === 400 && /Entrar/.test(r.datos?.error || ''), r.datos);

  // por la puerta de Vercel: entrar (cookie segura), usar la app y cambiar algo con el origen de la puerta
  const porPuerta = (ruta, o = {}) => fetch(PUERTA + ruta, { method: o.metodo || 'GET', redirect: 'manual', headers: { Accept: 'application/json', Origin: 'https://puerta.prueba', ...(o.cuerpo ? { 'Content-Type': 'application/json' } : {}), ...(o.galleta ? { Cookie: o.galleta } : {}) }, body: o.cuerpo });
  let v = await porPuerta('/api/acceso/entrar', { metodo: 'POST', cuerpo: JSON.stringify({ correo: 'dueno@x.co', clave: 'clave-dueno' }) });
  const cv = v.headers.getSetCookie?.() || [];
  const gv = cv.map((c) => c.split(';')[0]).join('; ');
  check('Por la puerta de Vercel: entra (cookie Secure, sin Domain)', v.status === 200 && cv.length === 2 && cv.every((c) => /Secure/.test(c) && !/Domain=/i.test(c)), cv);
  v = await porPuerta('/api/productos', { galleta: gv });
  check('Por la puerta: usa la app', v.status === 200, v.status);
  v = await porPuerta('/api/ajustes/preferencias', { metodo: 'PUT', cuerpo: '{}', galleta: gv });
  check('Por la puerta: un cambio con el origen de Vercel se acepta', v.status !== 403, v.status);
  v = await porPuerta('/', { galleta: '' });
  check('Por la puerta sin sesión: va a /entrar', v.status === 302 && /\/entrar/.test(v.headers.get('location') || ''), v.status);

  r = await pedir('/api/acceso/salir', { metodo: 'POST', json: {}, galleta: dueno });
  check('Salir borra las cookies', r.st === 200 && (r.galleta === ''), r);
  r = await pedir('/api/acceso/entrar', { json: { correo: 'dueno@x.co', clave: 'clave-dueno' } });
  const otra = await fetch(`${BASE}/api/productos`, { method: 'POST', headers: { Cookie: r.galleta, 'Content-Type': 'application/json', Origin: 'https://sitio-malo.com' }, body: '{}' });
  check('Con sesión, un pedido desde otro sitio sigue frenado', otra.status === 403, otra.status);
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
  supa.close();
  puerta.close();
  fs.rmSync(path.join(RAIZ, 'temp', `_modo-prueba-${PUERTO}`), { recursive: true, force: true });
  if (envPropio) fs.rmSync(ENV, { force: true });
  if (fallas) console.log(`\n  Registro de la app: ${path.join(TMP, 'app.log')}`);
  else fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n  ${pasan} bien, ${fallas} mal · ${Math.round((Date.now() - t0) / 1000)} s\n`);
  process.exit(fallas ? 1 : 0);
}

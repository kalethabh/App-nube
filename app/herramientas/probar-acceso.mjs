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
import crypto from 'node:crypto';
import cp from 'node:child_process';
import { fileURLToPath,pathToFileURL } from 'node:url';

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
const codigosGoogle=new Map();
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
  if(u.pathname==='/auth/v1/authorize'){
   const code=crypto.randomBytes(12).toString('hex');codigosGoogle.set(code,u.searchParams.get('code_challenge'));
   const callback=new URL(u.searchParams.get('redirect_to'));callback.searchParams.set('code',code);res.writeHead(302,{Location:callback.href});res.end();return;
  }
  if(u.pathname==='/auth/v1/token' && u.searchParams.get('grant_type')==='pkce'){
   const challenge=codigosGoogle.get(b.auth_code);codigosGoogle.delete(b.auth_code);
   if(!challenge || crypto.createHash('sha256').update(b.code_verifier || '').digest('base64url')!==challenge)return json(400,{error:'pkce no válido'});
   if(!cuentas.has('google@x.co'))cuentas.set('google@x.co',{id:'44444444-4444-4444-4444-444444444444',nombre:'Cuenta Google'});
   return json(200,sesion('google@x.co'));
  }
  if(u.pathname==='/auth/v1/settings')return json(200,{external:{google:true}});
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
  if (['/rest/v1/rpc/kads_mi_rol','/rest/v1/rpc/kads_mi_acceso'].includes(u.pathname)) {
    if (!kads.has(id)) kads.set(id, { rol: [...kads.values()].some((k) => k.rol === 'owner') ? 'pendiente' : 'owner', nombre: cuentas.get(correo).nombre, correo });
    return json(200, [{ rol: kads.get(id).rol, nombre: kads.get(id).nombre,secciones:kads.get(id).secciones || [] }]);
  }
  if (['/rest/v1/rpc/kads_lista_usuarios','/rest/v1/rpc/kads_lista_accesos'].includes(u.pathname)) return esDueno ? json(200, [...kads].map(([i, k]) => ({ id: i, ...k }))) : json(403, { message: 'Solo el dueño' });
  if (['/rest/v1/rpc/kads_cambiar_rol','/rest/v1/rpc/kads_cambiar_acceso'].includes(u.pathname)) {
    if (!esDueno) return json(403, { message: 'Solo el dueño' });
    if (!kads.has(b.p_usuario)) return json(400, { message: 'Ese usuario no ha entrado a Kads' });
    if(b.p_usuario===id || kads.get(b.p_usuario).rol==='owner')return json(400,{message:'No puedes cambiar al administrador'});
    kads.get(b.p_usuario).rol = b.p_rol;
    if(b.p_secciones)kads.get(b.p_usuario).secciones=b.p_secciones;
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
const archivoConector=path.join(RAIZ,'temp/_conector/conector.json'),respaldoConector=path.join(TMP,'conector-original.json'),conectorExistia=fs.existsSync(archivoConector);
if(conectorExistia){fs.copyFileSync(archivoConector,respaldoConector);fs.chmodSync(respaldoConector,0o600);}
const env = { ...process.env };
for (const k of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|OPENAI_|CODEX_|KADS_)/i.test(k)) delete env[k];
Object.assign(env, { PUERTO: String(PUERTO), ANUNCIOS_MODO_PRUEBA: '1', ANUNCIOS_PRUEBA_LIMPIO: '1', ANUNCIOS_SIN_GUARDADO: '1', ANUNCIOS_CLAUDE_BIN: path.join(APP, 'server', 'claude', 'pruebas', 'claude-falso.js'), AIA_MOTOR: 'claude', OFICINA_SIN_SEGUIMIENTO: '1', KADS_SUPABASE_URL: `http://127.0.0.1:${supa.address().port}`, KADS_SUPABASE_ANON: ANON, KADS_PUERTA: 'puerta.prueba', KADS_URL_PUBLICA:BASE, NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost' });
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
  r = await pedir(`/api/acceso/usuarios/${idAna}`, { metodo: 'PUT', json: { rol: 'empleado',secciones:['productos'] }, galleta: dueno });
  check('El dueño la aprueba como empleada', r.st === 200, r);

  r = await pedir('/api/productos', { galleta: ana });
  check('Aprobada: usa la app', r.st === 200, r);
  r = await pedir('/api/claves', { galleta: ana });
  check('Empleada: no ve el apartado de claves', r.st === 403, r);
  r = await pedir('/api/claves', { metodo: 'PUT', json: { kie: 'otra' }, galleta: ana });
  check('Empleada: no cambia las claves', r.st === 403 && /dueño/.test(r.datos?.error || ''), r);
  r = await pedir('/api/ajustes/preferencias', { metodo: 'PUT', json: {}, galleta: ana });
  check('Empleada: no cambia los ajustes', r.st === 403, r);
  r = await pedir('/usuarios', { galleta: ana, accept: 'text/html' });
  check('Empleada: no abre /usuarios', r.st === 403);
  r = await pedir('/api/acceso/usuarios', { galleta: ana });
  check('Empleada: no ve la lista de usuarios', r.st === 403);

  r=await pedir('/api/landings',{galleta:ana});check('Sin permiso de Landings: no puede consultar proyectos',r.st===403,r);
  r=await pedir('/landing/otro/index.html',{galleta:ana});check('Sin permiso: tampoco abre archivos de una landing',r.st===403,r.st);
  r=await pedir('/api/generaciones/embudo/borrar',{json:{ids:['no-existe']},galleta:ana});check('El borrado común respeta el permiso de la sección',r.st===403,r);
  r=await pedir(`/api/acceso/usuarios/${idAna}`,{metodo:'PUT',json:{rol:'empleado',secciones:['landings']},galleta:dueno});check('El administrador elige solo Landings',r.st===200,r);
  r=await pedir('/api/landings',{galleta:ana});check('Con permiso: abre Landings',r.st===200,r.st);
  r=await pedir('/api/productos',{metodo:'POST',json:{nombre:'No crear'},galleta:ana});check('Los productos de entrada se pueden leer, pero no crearlos sin permiso',r.st===403,r);
  r=await pedir(`/api/acceso/usuarios/${idAna}`,{metodo:'PUT',json:{rol:'empleado',secciones:['no-existe']},galleta:dueno});check('No acepta permisos inventados',r.st===400,r);
  r=await pedir(`/api/acceso/usuarios/${idAna}`,{metodo:'PUT',json:{rol:'empleado',secciones:['productos']},galleta:ana});check('Una empleada no se da permisos a sí misma',r.st===403,r);
  r=await pedir(`/api/acceso/usuarios/${idAna}`,{metodo:'PUT',json:{rol:'empleado',secciones:[]},galleta:dueno});
  r=await pedir('/api/landings',{galleta:ana});check('Revocar el permiso bloquea el mismo token inmediatamente',r.st===403,r);
  await pedir(`/api/acceso/usuarios/${idAna}`,{metodo:'PUT',json:{rol:'empleado',secciones:['shopify']},galleta:dueno});
  r=await pedir('/api/shopify/landing',{json:{landingId:'no-existe',tiendaId:'no-existe'},galleta:ana});check('Publicar una landing requiere acceso tanto a Shopify como a Landings',r.st===403,r);
  await pedir(`/api/acceso/usuarios/${idAna}`,{metodo:'PUT',json:{rol:'empleado',secciones:['carpetas']},galleta:dueno});
  r=await pedir('/api/carpetas/carpeta-falsa/desde',{json:{tipo:'imagen-lote',lote:'no-existe',pieza:'V01_1x1'},galleta:ana});check('Copiar a una carpeta no permite saltarse el acceso al origen',r.st===403,r);
  await pedir(`/api/acceso/usuarios/${idAna}`,{metodo:'PUT',json:{rol:'empleado',secciones:['productos']},galleta:dueno});
  r=await pedir('/api/acceso/google?volver='+encodeURIComponent('/#/landings'));
  const googleInicio=r,autorizacion=new URL(r.donde);check('Google inicia PKCE S256 sin exponer el verificador',r.st===302 && autorizacion.searchParams.get('provider')==='google' && autorizacion.searchParams.get('code_challenge_method')==='s256' && !autorizacion.searchParams.has('code_verifier'),r.donde);
  const proveedor=await fetch(r.donde,{redirect:'manual'}),callback=new URL(proveedor.headers.get('location'));
  r=await pedir(callback.pathname+callback.search);check('El callback sin la cookie del navegador no abre sesión',r.st===400 && !r.galleta,r.st);
  r=await pedir(callback.pathname+callback.search,{galleta:googleInicio.galleta});const cuentaGoogle=r.galleta;
  check('Google intercambia el código y devuelve cookies de sesión',r.st===303 && r.donde==='/#/landings' && /kads_sesion=/.test(cuentaGoogle),r.st);
  r=await pedir('/api/acceso/yo',{galleta:cuentaGoogle});check('Una cuenta Google nueva queda pendiente',r.datos?.rol==='pendiente' && r.datos.correo==='google@x.co',r.datos);
  r=await pedir(callback.pathname+callback.search,{galleta:googleInicio.galleta});check('No se puede repetir un callback ya consumido',r.st===400,r.st);
  r=await pedir('/api/acceso/google?volver='+encodeURIComponent('//sitio-malo.example'));
  const otroProveedor=await fetch(r.donde,{redirect:'manual'}),otroCallback=new URL(otroProveedor.headers.get('location'));
  const finalGoogle=await pedir(otroCallback.pathname+otroCallback.search,{galleta:r.galleta});check('Google no permite redirecciones fuera de la app',finalGoogle.donde==='/',finalGoogle.donde);
  r=await pedir('/api/acceso/configuracion',{galleta:dueno});check('El administrador ve cómo activar Google, sin secretos',r.st===200 && r.datos.googleHabilitado===true && !JSON.stringify(r.datos).includes(ANON),r.datos);
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
  const inicioGoogleSeguro=await porPuerta('/api/acceso/google');const cookiesGoogleSeguro=inicioGoogleSeguro.headers.getSetCookie?.() || [];check('Google por HTTPS usa cookie __Host, Secure y sin Domain',inicioGoogleSeguro.status===302 && cookiesGoogleSeguro.some(c=>c.startsWith('__Host-kads_google=') && c.includes('Secure') && c.includes('Path=/;') && !/Domain=/i.test(c)));
  v = await porPuerta('/api/productos', { galleta: gv });
  check('Por la puerta: usa la app', v.status === 200, v.status);
  v = await porPuerta('/api/ajustes/preferencias', { metodo: 'PUT', cuerpo: '{}', galleta: gv });
  check('Por la puerta: un cambio con el origen de Vercel se acepta', v.status !== 403, v.status);
  v = await porPuerta('/', { galleta: '' });
  check('Por la puerta sin sesión: va a /entrar', v.status === 302 && /\/entrar/.test(v.headers.get('location') || ''), v.status);

  if(process.env.PLAYWRIGHT_PACKAGE_PATH){
   const {chromium}=await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE_PATH,'index.mjs')).href);
   const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROME});
   try {
    const errores=[],admin=await browser.newPage({viewport:{width:1440,height:1000}});admin.on('pageerror',e=>errores.push(e.message));
    await admin.context().addCookies(dueno.split('; ').filter(Boolean).map(v=>{const k=v.indexOf('=');return{name:v.slice(0,k),value:v.slice(k+1),url:BASE};}));
    await admin.goto(BASE+'/usuarios');const fila=admin.locator(`[data-usuario="${idAna}"]`);await fila.locator('select').waitFor();
    await fila.locator('summary').click();for(const c of await fila.locator('input[type=checkbox]').all())await c.uncheck();await fila.getByLabel('Landings',{exact:true}).check();await fila.getByRole('button',{name:'Guardar acceso'}).click();await admin.getByRole('status').getByText(/Acceso guardado/).waitFor();
    check('UI administrador: selecciona una sección y guarda el acceso',await fila.getByLabel('Landings',{exact:true}).isChecked());
    const persona=await browser.newPage({viewport:{width:1440,height:1000}});persona.on('pageerror',e=>errores.push(e.message));
    await persona.context().addCookies(ana.split('; ').filter(Boolean).map(v=>{const k=v.indexOf('=');return{name:v.slice(0,k),value:v.slice(k+1),url:BASE};}));
    await persona.goto(BASE+'/');await persona.waitForURL(/#\/landings/);const menu=persona.getByRole('complementary',{name:'Menú principal'});await menu.getByRole('link',{name:'Landings',exact:true}).waitFor();
    check('UI persona: solo ve su sección; no aparece configuración ni imágenes',await menu.getByRole('link',{name:'Anuncios de imagen',exact:true}).count()===0 && await menu.getByRole('link',{name:'Ajustes',exact:true}).count()===0);
    if(process.env.ACCESS_SCREENSHOTS){fs.mkdirSync(process.env.ACCESS_SCREENSHOTS,{recursive:true});await admin.screenshot({path:path.join(process.env.ACCESS_SCREENSHOTS,'administrar-permisos.png')});await persona.screenshot({path:path.join(process.env.ACCESS_SCREENSHOTS,'solo-landings.png')});}
    await persona.goto(BASE+'/#/embudo-whatsapp');await persona.getByRole('heading',{name:'Mis secciones',exact:true}).waitFor();check('UI enlace directo: el formulario prohibido no se monta',await persona.locator('.em-proyecto').count()===0);
    await admin.setViewportSize({width:390,height:844});check('UI administración móvil: sin desborde de la página',await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth) && (await fila.locator('td').first().boundingBox()).width>240);
    if(process.env.ACCESS_SCREENSHOTS)await admin.screenshot({path:path.join(process.env.ACCESS_SCREENSHOTS,'permisos-movil.png')});
    const entrada=await browser.newPage();entrada.on('pageerror',e=>errores.push(e.message));await entrada.goto(BASE+'/entrar');check('UI acceso: botón Google junto al correo, sin errores',await entrada.getByRole('link',{name:'Continuar con Google'}).count()===1 && errores.length===0,errores);
    await pedir(`/api/acceso/usuarios/${idAna}`,{metodo:'PUT',json:{rol:'empleado',secciones:['productos']},galleta:dueno});
   }finally{await browser.close();}
  }
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
  if(conectorExistia){fs.copyFileSync(respaldoConector,archivoConector);fs.rmSync(respaldoConector,{force:true});}else fs.rmSync(archivoConector,{force:true});
  supa.close();
  puerta.close();
  fs.rmSync(path.join(RAIZ, 'temp', `_modo-prueba-${PUERTO}`), { recursive: true, force: true });
  if (envPropio) fs.rmSync(ENV, { force: true });
  if (fallas) console.log(`\n  Registro de la app: ${path.join(TMP, 'app.log')}`);
  else fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n  ${pasan} bien, ${fallas} mal · ${Math.round((Date.now() - t0) / 1000)} s\n`);
  process.exit(fallas ? 1 : 0);
}

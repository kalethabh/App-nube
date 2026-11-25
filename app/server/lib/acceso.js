// EL INGRESO CON CUENTA (2026-11-25a). Pedido: cuentas, dueño y aprobar a los demás en la app en un servidor.
// (2026-11-25b) Kads usa su PROPIO proyecto de Supabase: «el Centro de Control es una cosa y la app Kads es otra, no se
// debe mezclar nada». Los roles van en `kads_usuarios` (deploy/supabase-kads.sql).
//
// Solo se prende con KADS_SUPABASE_URL y KADS_SUPABASE_ANON (la clave anónima, la pública) en el servidor. Sin ellas
// (la app en tu Mac) todo queda como siempre: sin ingreso.
//
//   · el ingreso lo hace el servidor contra Supabase (/auth/v1/token) y guarda la sesión en dos cookies httpOnly;
//   · cada pedido se revisa: sesión válida (/auth/v1/user, en caché 60 s; si venció, se renueva sola) y su rol
//     (`kads_mi_rol()`, en caché 30 s). El PRIMERO que entra queda `owner`; los demás, `pendiente` hasta que el dueño
//     los apruebe en /usuarios. `pendiente` y `rechazado` no ven nada;
//   · CAMBIAR lo delicado (ajustes, claves, conexiones, actualizar, guardado, GitHub, conectar tiendas) es solo del
//     dueño, y lo revisa el servidor (no solo la pantalla). La lista y el cambio de roles los revisa además la base (funciones
//     security definer que exigen ser dueño).
//   · quedan afuera del ingreso, con su propia llave: el conector de Claude (/mcp/<clave>) y el botón de Chrome
//     (/api/inspiracion/importar, con su código de emparejamiento).
import crypto from 'node:crypto';

const URL_SB = String(process.env.KADS_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const ANON = String(process.env.KADS_SUPABASE_ANON || '').trim();
export const ACCESO_ACTIVO = Boolean(URL_SB && ANON);

export const ROLES = ['owner', 'socio', 'empleado', 'pendiente', 'rechazado'];
const CON_ACCESO = new Set(['owner', 'socio', 'empleado']);

// lo que solo CAMBIA el dueño (leerlo, sí: la interfaz lo consulta al abrir, y nunca trae el valor de una clave):
// ajustes, claves, la IA conectada, actualizar, guardado, GitHub, el conector, Telegram y conectar o quitar tiendas
const SOLO_DUENO_ESCRIBIR = [/^\/api\/(ajustes|actualizar|claves|claude|ia|github|guardado|conector|telegram|_nube|anuncios-github)(\/|$)/, /^\/api\/shopify\/(tiendas|conexiones)(\/|$)/];
// lo que no pide ingreso: la página de entrar y sus pedidos
const LIBRES = [/^\/entrar$/, /^\/api\/acceso\/(entrar|registro|salir)$/, /^\/favicon\.(ico|svg|png)$/];

const C_SESION = 'kads_sesion';
const C_REFRESCO = 'kads_refresco';

function cookies(req) {
  const out = {};
  for (const parte of String(req.headers.cookie || '').split(';')) {
    const i = parte.indexOf('=');
    if (i > 0) out[parte.slice(0, i).trim()] = decodeURIComponent(parte.slice(i + 1).trim());
  }
  return out;
}
const segura = (req) => String(req.headers['x-forwarded-proto'] || '').includes('https') || req.secure;
function ponerCookies(req, res, s) {
  const base = `Path=/; HttpOnly; SameSite=Lax${segura(req) ? '; Secure' : ''}`;
  res.append('Set-Cookie', `${C_SESION}=${encodeURIComponent(s.access_token)}; ${base}; Max-Age=${60 * 60 * 24 * 30}`);
  res.append('Set-Cookie', `${C_REFRESCO}=${encodeURIComponent(s.refresh_token)}; ${base}; Max-Age=${60 * 60 * 24 * 30}`);
}
function borrarCookies(req, res) {
  const base = `Path=/; HttpOnly; SameSite=Lax${segura(req) ? '; Secure' : ''}; Max-Age=0`;
  res.append('Set-Cookie', `${C_SESION}=; ${base}`);
  res.append('Set-Cookie', `${C_REFRESCO}=; ${base}`);
}

async function sb(ruta, { metodo = 'GET', token = null, cuerpo } = {}) {
  const r = await fetch(`${URL_SB}${ruta}`, {
    method: metodo,
    headers: { apikey: ANON, Authorization: `Bearer ${token || ANON}`, ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const texto = await r.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = { mensaje: texto.slice(0, 200) };
  }
  return { ok: r.ok, status: r.status, datos };
}

const hashDe = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const usuarios = new Map(); // hash(token) -> { usuario, hasta }
const rolesCache = new Map(); // id -> { rol, nombre, hasta }
const venceEn = (token) => {
  try {
    return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString()).exp * 1000;
  } catch {
    return 0;
  }
};

async function usuarioDe(token) {
  if (!token) return null;
  if (venceEn(token) < Date.now() + 5000) return null;
  const h = hashDe(token);
  const c = usuarios.get(h);
  if (c && c.hasta > Date.now()) return c.usuario;
  const r = await sb('/auth/v1/user', { token });
  if (!r.ok || !r.datos?.id) return null;
  const usuario = { id: r.datos.id, correo: r.datos.email || '' };
  usuarios.set(h, { usuario, hasta: Date.now() + 60000 });
  if (usuarios.size > 500) usuarios.delete(usuarios.keys().next().value);
  return usuario;
}

/** Su rol en Kads (la primera vez lo crea: el primero de todos queda dueño). */
async function rolDe(usuario, token) {
  const c = rolesCache.get(usuario.id);
  if (c && c.hasta > Date.now()) return c;
  const r = await sb('/rest/v1/rpc/kads_mi_rol', { metodo: 'POST', token, cuerpo: {} });
  const fila = Array.isArray(r.datos) ? r.datos[0] : r.datos;
  if (!r.ok || !fila?.rol) {
    const e = new Error(r.status === 404 ? 'Falta preparar Supabase para Kads: corre deploy/supabase-kads.sql en el editor SQL de Supabase.' : 'No pude leer tu rol en Supabase.');
    e.status = 503;
    throw e;
  }
  const v = { rol: fila.rol, nombre: fila.nombre || usuario.correo, hasta: Date.now() + 30000 };
  rolesCache.set(usuario.id, v);
  return v;
}

/** La sesión del pedido (renovándola si venció): { usuario, rol, nombre, token } | null. */
async function sesionDe(req, res) {
  const ck = cookies(req);
  let token = ck[C_SESION];
  let usuario = await usuarioDe(token);
  if (!usuario && ck[C_REFRESCO]) {
    const r = await sb('/auth/v1/token?grant_type=refresh_token', { metodo: 'POST', cuerpo: { refresh_token: ck[C_REFRESCO] } });
    if (r.ok && r.datos?.access_token) {
      ponerCookies(req, res, r.datos);
      token = r.datos.access_token;
      usuario = await usuarioDe(token);
    }
  }
  if (!usuario) return null;
  const { rol, nombre } = await rolDe(usuario, token);
  return { usuario, rol, nombre, token };
}

const esApi = (req) => req.path.startsWith('/api/') || req.path.startsWith('/archivos/');

/** El portero: va después del chequeo de host y antes de todas las rutas. */
export async function porteroAcceso(req, res, next) {
  if (!ACCESO_ACTIVO) return next();
  if (LIBRES.some((r) => r.test(req.path)) || req.desdeExtension === true || req.path.startsWith('/mcp/')) return next();
  let s;
  try {
    s = await sesionDe(req, res);
  } catch (e) {
    return esApi(req) ? res.status(e.status || 503).json({ error: e.message }) : res.status(e.status || 503).type('html').send(pagina('Kads Studio', `<p>${esc(e.message)}</p>`));
  }
  if (!s) {
    if (esApi(req)) return res.status(401).json({ error: 'Tu sesión terminó: vuelve a entrar.', entrar: '/entrar' });
    return res.redirect(302, `/entrar?volver=${encodeURIComponent(req.originalUrl || '/')}`);
  }
  req.cuenta = s;
  if (req.path === '/api/acceso/yo') return next();
  if (!CON_ACCESO.has(s.rol)) {
    const msg = s.rol === 'rechazado' ? 'Tu cuenta no tiene acceso a Kads Studio.' : 'Tu cuenta está esperando que el dueño la apruebe.';
    if (esApi(req)) return res.status(403).json({ error: msg });
    return res.status(403).type('html').send(pagina('Esperando aprobación', `<p>${esc(msg)}</p><p class="suave">Entraste como ${esc(s.usuario.correo)}.</p><form method="post" action="/api/acceso/salir"><button>Salir</button></form>`));
  }
  if (s.rol !== 'owner') {
    const escribe = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if ((escribe && SOLO_DUENO_ESCRIBIR.some((r) => r.test(req.path))) || req.path.startsWith('/api/acceso/usuarios') || req.path === '/usuarios') {
      if (esApi(req)) return res.status(403).json({ error: 'Esto solo lo puede hacer el dueño de la cuenta.' });
      return res.status(403).type('html').send(pagina('Solo el dueño', '<p>Esto solo lo puede hacer el dueño de la cuenta.</p><p><a href="/">Volver a la app</a></p>'));
    }
  }
  next();
}

// ---------------------------------------------------------------- las páginas (sin la interfaz: se ven sin sesión)
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function pagina(titulo, cuerpo) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)} · Kads Studio</title>
<style>:root{--bg:#f6f4fb;--fg:#1c1726;--suave:#6c6479;--linea:#e2dcec;--acento:#6b3fd1;--tarjeta:#fff;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#14111b;--fg:#eee9f6;--suave:#a69eb4;--linea:#2f2840;--acento:#a183ff;--tarjeta:#1d1828;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:24px max(16px,env(safe-area-inset-left))}
main{width:100%;max-width:440px;background:var(--tarjeta);border:1px solid var(--linea);border-radius:14px;padding:28px}
h1{font-size:22px;margin:0 0 4px}.suave{color:var(--suave);font-size:13.5px}label{display:grid;gap:4px;margin-top:12px;font-size:13.5px;font-weight:600}
input,select{font:inherit;padding:10px 12px;border:1px solid var(--linea);border-radius:9px;background:var(--bg);color:var(--fg)}
button{font:inherit;font-weight:700;margin-top:16px;width:100%;padding:11px;border:0;border-radius:9px;background:var(--acento);color:#fff;cursor:pointer}
button.sec{background:transparent;color:var(--acento);border:1px solid var(--linea);margin-top:8px}a{color:var(--acento)}
.error{color:#c0392b;font-size:13.5px;min-height:1.2em;margin:10px 0 0}table{width:100%;border-collapse:collapse;font-size:13.5px;margin-top:14px}
td,th{text-align:left;padding:8px 4px;border-bottom:1px solid var(--linea);vertical-align:middle}td select{padding:6px;width:100%}.ancho{max-width:720px}[hidden]{display:none!important}</style></head>
<body><main${titulo === 'Usuarios' ? ' class="ancho"' : ''}><h1>${esc(titulo)}</h1>${cuerpo}</main></body></html>`;
}

const PAGINA_ENTRAR = (volver) =>
  pagina(
    'Kads Studio',
    `<p class="suave">Entra con tu cuenta de Kads Studio.</p>
<form id="f"><div id="soloRegistro" hidden><label>Nombre<input id="nombre" autocomplete="name"></label></div>
<label>Correo<input id="correo" type="email" autocomplete="email" required></label>
<label>Clave<input id="clave" type="password" autocomplete="current-password" required minlength="6"></label>
<p class="error" id="err" role="alert"></p><button id="b">Entrar</button><button type="button" class="sec" id="cambiar">No tengo cuenta: crear una</button></form>
<script>
let registro=false;const $=(i)=>document.getElementById(i);
$('cambiar').onclick=()=>{registro=!registro;$('soloRegistro').hidden=!registro;$('b').textContent=registro?'Crear mi cuenta':'Entrar';$('cambiar').textContent=registro?'Ya tengo cuenta: entrar':'No tengo cuenta: crear una';$('err').textContent='';};
$('f').onsubmit=async(e)=>{e.preventDefault();$('err').textContent='';$('b').disabled=true;
try{const r=await fetch('/api/acceso/'+(registro?'registro':'entrar'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:$('nombre').value,correo:$('correo').value,clave:$('clave').value})});
const d=await r.json().catch(()=>({}));if(!r.ok){$('err').textContent=d.error||'No se pudo.';return;}
if(d.aviso){$('err').textContent=d.aviso;return;}location.href=${JSON.stringify(volver)};}
catch{$('err').textContent='Sin conexión con la app.';}finally{$('b').disabled=false;}};
</script>`,
  );

const PAGINA_USUARIOS = pagina(
  'Usuarios',
  `<p class="suave">Quienes entran con su cuenta quedan «pendiente» hasta que les des un rol. <b>Socio</b> y <b>empleado</b> usan la app; solo tú ves Ajustes, claves, conexiones y tiendas.</p>
<p class="error" id="err" role="alert"></p><div style="overflow-x:auto"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th></tr></thead><tbody id="t"><tr><td colspan="3" class="suave">Cargando…</td></tr></tbody></table></div>
<p><a href="/">Volver a la app</a></p>
<script>
const NOM={owner:'Dueño',socio:'Socio',empleado:'Empleado',pendiente:'Pendiente',rechazado:'Rechazado'};
const esc=(t)=>String(t??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
async function cargar(){const r=await fetch('/api/acceso/usuarios');const d=await r.json().catch(()=>({}));if(!r.ok){document.getElementById('err').textContent=d.error||'No pude cargar.';return;}
document.getElementById('t').innerHTML=d.usuarios.map(u=>'<tr><td>'+esc(u.nombre)+'</td><td>'+esc(u.correo)+'</td><td>'+(u.rol==='owner'?'Dueño':'<select aria-label="Rol de '+esc(u.correo)+'" data-id="'+esc(u.id)+'">'+['socio','empleado','pendiente','rechazado'].map(x=>'<option value="'+x+'"'+(x===u.rol?' selected':'')+'>'+NOM[x]+'</option>').join('')+'</select>')+'</td></tr>').join('');}
document.addEventListener('change',async(e)=>{const s=e.target.closest('select[data-id]');if(!s)return;document.getElementById('err').textContent='';
const r=await fetch('/api/acceso/usuarios/'+encodeURIComponent(s.dataset.id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({rol:s.value})});
const d=await r.json().catch(()=>({}));if(!r.ok){document.getElementById('err').textContent=d.error||'No se pudo cambiar.';cargar();}});
cargar();
</script>`,
);

/** Las rutas del ingreso (rutas/acceso.js). */
export function rutasAcceso(app, json) {
  if (!ACCESO_ACTIVO) {
    app.get('/api/acceso/yo', (req, res) => res.json({ activo: false }));
    return;
  }
  app.get('/entrar', (req, res) => {
    const volver = String(req.query.volver || '/');
    res.set('Cache-Control', 'no-store').type('html').send(PAGINA_ENTRAR(volver.startsWith('/') && !volver.startsWith('//') ? volver : '/'));
  });
  app.post('/api/acceso/entrar', json, async (req, res) => {
    const correo = String(req.body?.correo || '').trim().toLowerCase();
    const clave = String(req.body?.clave || '');
    if (!correo || !clave) return res.status(400).json({ error: 'Escribe tu correo y tu clave.' });
    const r = await sb('/auth/v1/token?grant_type=password', { metodo: 'POST', cuerpo: { email: correo, password: clave } });
    if (!r.ok || !r.datos?.access_token) return res.status(401).json({ error: /confirm/i.test(JSON.stringify(r.datos || '')) ? 'Confirma tu correo primero (revisa tu bandeja).' : 'Correo o clave incorrectos.' });
    ponerCookies(req, res, r.datos);
    res.json({ ok: true });
  });
  app.post('/api/acceso/registro', json, async (req, res) => {
    const correo = String(req.body?.correo || '').trim().toLowerCase();
    const clave = String(req.body?.clave || '');
    const nombre = String(req.body?.nombre || '').trim().slice(0, 80);
    if (!nombre || !correo || clave.length < 6) return res.status(400).json({ error: 'Escribe tu nombre, tu correo y una clave de al menos 6 letras.' });
    const r = await sb('/auth/v1/signup', { metodo: 'POST', cuerpo: { email: correo, password: clave, data: { nombre } } });
    if (!r.ok) return res.status(400).json({ error: /registered|exists/i.test(JSON.stringify(r.datos || '')) ? 'Ese correo ya tiene cuenta: usa «Entrar».' : 'No pude crear la cuenta.' });
    if (!r.datos?.access_token) return res.json({ ok: true, aviso: 'Listo. Confirma tu correo (revisa tu bandeja) y después entra.' });
    ponerCookies(req, res, r.datos);
    res.json({ ok: true });
  });
  app.post('/api/acceso/salir', async (req, res) => {
    const t = cookies(req)[C_SESION];
    if (t) await sb('/auth/v1/logout', { metodo: 'POST', token: t }).catch(() => {});
    borrarCookies(req, res);
    if (String(req.headers.accept || '').includes('text/html') || req.is('application/x-www-form-urlencoded')) return res.redirect(303, '/entrar');
    res.json({ ok: true });
  });
  app.get('/api/acceso/yo', (req, res) => {
    const s = req.cuenta;
    res.json({ activo: true, correo: s?.usuario?.correo || null, nombre: s?.nombre || null, rol: s?.rol || null });
  });
  app.get('/usuarios', (req, res) => res.set('Cache-Control', 'no-store').type('html').send(PAGINA_USUARIOS));
  app.get('/api/acceso/usuarios', async (req, res) => {
    const r = await sb('/rest/v1/rpc/kads_lista_usuarios', { metodo: 'POST', token: req.cuenta.token, cuerpo: {} });
    if (!r.ok) return res.status(r.status === 403 ? 403 : 502).json({ error: 'No pude leer los usuarios en Supabase.' });
    res.json({ usuarios: r.datos || [] });
  });
  app.put('/api/acceso/usuarios/:id', json, async (req, res) => {
    const rol = String(req.body?.rol || '');
    if (!['socio', 'empleado', 'pendiente', 'rechazado'].includes(rol)) return res.status(400).json({ error: 'Ese rol no existe.' });
    const r = await sb('/rest/v1/rpc/kads_cambiar_rol', { metodo: 'POST', token: req.cuenta.token, cuerpo: { p_usuario: req.params.id, p_rol: rol } });
    if (!r.ok) return res.status(400).json({ error: r.datos?.message || 'No se pudo cambiar el rol.' });
    rolesCache.delete(req.params.id);
    res.json({ ok: true });
  });
}

export const _paraPruebas = { cookies, venceEn };

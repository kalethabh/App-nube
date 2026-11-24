// TUS TIENDAS DE SHOPIFY (2026-11-20r): conectas una o varias (como en ChatGPT) y la app trabaja en cualquiera.
// (2026-11-24) Cada tienda dice de qué CUENTA de Shopify es (la organización; puedes tener varias) y de qué PAÍS (con
// acceso completo se lee solo; si no, lo eliges), para elegir la cuenta y la tienda según el país.
// Cada tienda se conecta con su dirección (<algo>.myshopify.com) y una de estas formas:
//   - Client ID + secreto de una app del Dev Dashboard (dev.shopify.com) instalada en tu tienda: ACCESO COMPLETO. Es la
//     forma de 2026 (desde el 1-ene-2026 Shopify no deja crear «apps propias» con token fijo en el admin). La app los
//     cambia por un token (client credentials, dura ~24 h) y lo RENUEVA sola antes de que venza (renovar()).
//   - shpat_…  el token de una app propia creada antes de 2026: ACCESO COMPLETO (API de administración y Shopify CLI).
//   - shptka_… la contraseña de la app «Theme Access»: solo los temas (Shopify CLI).
//   - (2026-11-24) «Con mi cuenta de Shopify» (conectarConCuenta): sin clave. Shopify CLI abre el inicio de sesión en el
//     navegador con un código; apruebas y queda su sesión guardada. Solo temas.
// Las claves viven en <raíz>/.env.shopify.json (permisos 600; fuera de git, del paquete y de las actualizaciones, como
// el .env) y NUNCA salen por la API de la app ni se muestran.
//
//   listarTiendas() -> [{ id, nombre, dominio, tipo: 'completo'|'temas', agregada, tienda }]   (sin las claves)
//   agregarTienda({ dominio, token, nombre }) -> la tienda (la prueba antes de guardarla)
//   quitarTienda(id) · editarTienda(id, { nombre, cuenta, pais }) · tiendaConClave(id) y renovar(tienda) (solo para
//   lib/shopify) · normalizarDominio(texto)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { RAIZ } from '../rutas.js';
import { ErrorApp } from '../productos.js';

const ARCHIVO = () => process.env.SHOPIFY_TIENDAS_ARCHIVO || path.join(RAIZ, '.env.shopify.json');

function leer() {
  try {
    const d = JSON.parse(fs.readFileSync(ARCHIVO(), 'utf8'));
    return conCarpetas(Array.isArray(d?.tiendas) ? d : { tiendas: [] });
  } catch {
    return { tiendas: [], carpetas: [] };
  }
}
// Las carpetas agrupan negocios, no credenciales ni cuentas de Shopify. Las conexiones antiguas
// se agrupan por su cuenta sin cambiar IDs, claves o sesiones. La migración se persiste al guardar.
function conCarpetas(d) {
  d.carpetas = Array.isArray(d.carpetas) ? d.carpetas : [];
  for (const t of d.tiendas) {
    if (d.carpetas.some((c) => c.id === t.carpetaId)) continue;
    const nombre = String(t.cuenta || 'Mis tiendas').trim();
    let c = d.carpetas.find((x) => x.nombre.toLocaleLowerCase('es') === nombre.toLocaleLowerCase('es'));
    if (!c) {
      c = { id: `negocio-${crypto.createHash('sha256').update(nombre).digest('hex').slice(0, 12)}`, nombre };
      d.carpetas.push(c);
    }
    t.carpetaId = c.id;
  }
  return d;
}

const nombreCarpeta = (nombre) => {
  const n = String(nombre || '').trim().replace(/\s+/g, ' ');
  if (!n || n.length > 60) throw new ErrorApp(400, 'Pon un nombre de carpeta de hasta 60 caracteres.');
  return n;
};
function validarCarpeta(datos, id) {
  const c = datos.carpetas.find((x) => x.id === id);
  if (!c) throw new ErrorApp(404, 'No encuentro esa carpeta. Vuelve a elegirla.');
  return c.id;
}
export const listarCarpetas = () => leer().carpetas;
export function guardarCarpeta({ nombre, id } = {}) {
  const datos = leer();
  const n = nombreCarpeta(nombre);
  if (id) validarCarpeta(datos, id);
  if (datos.carpetas.some((c) => c.id !== id && c.nombre.toLocaleLowerCase('es') === n.toLocaleLowerCase('es'))) throw new ErrorApp(409, 'Ya tienes una carpeta con ese nombre.');
  const c = { id: id || `negocio-${crypto.randomBytes(6).toString('hex')}`, nombre: n };
  datos.carpetas = [...datos.carpetas.filter((x) => x.id !== c.id), c];
  guardar(datos);
  return c;
}
export function quitarCarpeta(id) {
  const datos = leer();
  validarCarpeta(datos, id);
  if (datos.tiendas.some((t) => t.carpetaId === id)) throw new ErrorApp(409, 'Mueve las tiendas a otra carpeta antes de eliminar esta.');
  datos.carpetas = datos.carpetas.filter((c) => c.id !== id);
  guardar(datos);
  return { ok: true };
}

function guardar(d) {
  const f = ARCHIVO();
  const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, f);
  try {
    fs.chmodSync(f, 0o600);
  } catch {
    /* Windows */
  }
}

/** «mitienda», «mitienda.myshopify.com», «https://admin.shopify.com/store/mitienda/…» -> «mitienda.myshopify.com». */
export function normalizarDominio(texto) {
  const t = String(texto || '').trim().toLowerCase();
  const admin = /admin\.shopify\.com\/store\/([a-z0-9][a-z0-9-]*)/.exec(t);
  if (admin) return `${admin[1]}.myshopify.com`;
  const host = t.replace(/^https?:\/\//, '').split(/[/?#]/)[0];
  if (/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(host)) return host;
  if (/^[a-z0-9][a-z0-9-]*$/.test(host)) return `${host}.myshopify.com`;
  return null;
}

export const tipoDeToken = (t) => (/^(shpat|shpca)_[A-Za-z0-9]{20,}$/.test(t) ? 'completo' : /^shptka_[A-Za-z0-9]{20,}$/.test(t) ? 'temas' : null);
const publica = ({ token: _t, clientSecret: _s, clientId: _c, vence: _v, ...t }) => ({ ...t, cuenta: t.cuenta || 'Mi cuenta', pais: t.pais || null, forma: _c ? 'dev-dashboard' : _t ? 'token' : 'cuenta' });

export const listarTiendas = () => leer().tiendas.map(publica);

/** Solo para lib/shopify: la tienda con su clave. */
export function tiendaConClave(idONombre) {
  const q = String(idONombre || '').trim().toLowerCase();
  const ts = leer().tiendas;
  const t = ts.find((x) => x.id === q) || ts.find((x) => x.dominio === q || x.dominio === normalizarDominio(q)) || ts.find((x) => String(x.nombre || '').toLowerCase() === q) || (ts.length === 1 && !q ? ts[0] : null);
  if (!t) throw new ErrorApp(404, 'No encuentro esa tienda: conéctala en Shopify › Tiendas.');
  return t;
}

const baseOauth = (dominio) => process.env.SHOPIFY_ADMIN_BASE || `https://${dominio}`;

/** Client ID + secreto -> { token, vence } (client credentials grant de Shopify). */
async function pedirToken(dominio, clientId, clientSecret) {
  let r;
  try {
    r = await fetch(`${baseOauth(dominio)}/admin/oauth/access_token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }), signal: AbortSignal.timeout(30000) });
  } catch {
    throw new ErrorApp(400, 'No pude conectar con la tienda (revisa la dirección y tu internet).');
  }
  const d = await r.json().catch(() => null);
  if (!r.ok || !d?.access_token) {
    const e = String(d?.error_description || d?.error || d?.errors || '');
    if (/shop_not_permitted|not.*organization/i.test(e)) throw new ErrorApp(400, 'Shopify no deja usar esa app en esta tienda: la app y la tienda tienen que ser de la MISMA organización en el Dev Dashboard, y la app tiene que estar instalada en la tienda.');
    throw new ErrorApp(400, `Shopify no aceptó el Client ID y el secreto${e ? ` (${e.slice(0, 160)})` : ''}. Revisa que la app esté instalada en esta tienda.`);
  }
  const seg = Number(d.expires_in) || 86399;
  return { token: d.access_token, vence: new Date(Date.now() + seg * 1000).toISOString() };
}

/** La tienda con un token vigente (lo renueva si es del Dev Dashboard y vence en menos de 10 minutos). */
export async function renovar(t) {
  if (!t?.clientId || (t.vence && Date.parse(t.vence) - Date.now() > 10 * 60000)) return t;
  const nuevo = await pedirToken(t.dominio, t.clientId, t.clientSecret);
  const datos = leer();
  const i = datos.tiendas.findIndex((x) => x.id === t.id);
  if (i >= 0) {
    datos.tiendas[i] = { ...datos.tiendas[i], ...nuevo };
    guardar(datos);
  }
  return { ...t, ...nuevo };
}

const limpioCuenta = (c) => String(c || '').trim().replace(/\s+/g, ' ').slice(0, 60);
const limpioPais = (p) => (/^[A-Za-z]{2}$/.test(String(p || '').trim()) ? String(p).trim().toUpperCase() : null);

export async function agregarTienda({ dominio, token, nombre, clientId, clientSecret, cuenta, pais, carpetaId } = {}) {
  const d = normalizarDominio(dominio);
  if (!d) throw new ErrorApp(400, 'Pon la dirección de la tienda que termina en .myshopify.com (la ves en Configuración › Dominios).');
  if (carpetaId !== undefined) validarCarpeta(leer(), carpetaId);
  let tk = String(token || '').trim();
  let extra = {};
  const cid = String(clientId || '').trim();
  const csec = String(clientSecret || '').trim();
  if (cid || csec) {
    if (!/^[A-Za-z0-9_-]{16,}$/.test(cid) || csec.length < 16) throw new ErrorApp(400, 'Copia el Client ID y el secreto (Client secret) de tu app en el Dev Dashboard › Configuración.');
    const n = await pedirToken(d, cid, csec);
    tk = n.token;
    extra = { clientId: cid, clientSecret: csec, vence: n.vence };
  }
  const tipo = extra.clientId ? 'completo' : tipoDeToken(tk);
  if (!tipo) throw new ErrorApp(400, 'Esa clave no parece de Shopify: usa el Client ID y el secreto de tu app del Dev Dashboard, un token shpat_ (app creada antes de 2026) o la contraseña shptka_ de Theme Access (solo temas).');
  const { probarTienda } = await import('./api.js');
  const prueba = await probarTienda({ dominio: d, token: tk, tipo });
  if (!prueba.ok) throw new ErrorApp(400, prueba.error);
  const datos = leer();
  const antes = datos.tiendas.find((x) => x.dominio === d);
  const t = { id: antes?.id || `${d.split('.')[0]}-${crypto.randomBytes(2).toString('hex')}`, nombre: String(nombre || '').trim().slice(0, 60) || prueba.nombre || d.split('.')[0], dominio: d, tipo, token: tk, ...extra, carpetaId: carpetaId !== undefined ? validarCarpeta(datos, carpetaId) : antes?.carpetaId, cuenta: limpioCuenta(cuenta) || antes?.cuenta || 'Mi cuenta', pais: limpioPais(pais) || prueba.pais || antes?.pais || null, moneda: prueba.moneda || antes?.moneda || null, agregada: antes?.agregada || new Date().toISOString(), tienda: prueba.url || `https://${d}` };
  datos.tiendas = [...datos.tiendas.filter((x) => x.dominio !== d), t];
  conCarpetas(datos);
  guardar(datos);
  return publica(t);
}

// ---------------------------------------------------------------- con mi cuenta de Shopify (sin clave)
const conexiones = new Map(); // id -> { estado: 'abriendo'|'esperando'|'lista'|'error', url, codigo, tienda, error }

/** Empieza la conexión: Shopify CLI pide iniciar sesión (enlace y código) y, al aprobarla, lista los temas. -> { id } */
export function conectarConCuenta({ dominio, nombre, cuenta, pais, carpetaId } = {}) {
  const d = normalizarDominio(dominio);
  if (!d) throw new ErrorApp(400, 'Pon la dirección de la tienda que termina en .myshopify.com (la ves en Configuración › Dominios).');
  if (carpetaId !== undefined) validarCarpeta(leer(), carpetaId);
  const id = crypto.randomBytes(6).toString('hex');
  const c = { estado: 'abriendo', url: null, codigo: null, tienda: null, error: null };
  conexiones.set(id, c);
  (async () => {
    try {
      const api = await import('./api.js');
      let texto = '';
      await api.temas({ dominio: d, token: null, tipo: 'temas' }, {
        plazoMs: 10 * 60000,
        alLeer: (t) => {
          texto += t;
          const u = /(https:\/\/accounts\.shopify\.com\/\S+)/.exec(texto);
          const k = /verification code:?\s*([A-Z0-9]{4}-?[A-Z0-9]{4})/i.exec(texto);
          if (u && !c.url) Object.assign(c, { estado: 'esperando', url: u[1].replace(/[)\].,]+$/, '') });
          if (k && !c.codigo) c.codigo = k[1];
        },
      });
      const datos = leer();
      const antes = datos.tiendas.find((x) => x.dominio === d);
      const t = { id: antes?.id || `${d.split('.')[0]}-${crypto.randomBytes(2).toString('hex')}`, nombre: String(nombre || '').trim().slice(0, 60) || d.split('.')[0], dominio: d, tipo: 'temas', token: null, carpetaId: carpetaId !== undefined ? validarCarpeta(datos, carpetaId) : antes?.carpetaId, cuenta: limpioCuenta(cuenta) || antes?.cuenta || 'Mi cuenta', pais: limpioPais(pais) || antes?.pais || null, moneda: antes?.moneda || null, agregada: antes?.agregada || new Date().toISOString(), tienda: `https://${d}` };
      datos.tiendas = [...datos.tiendas.filter((x) => x.dominio !== d), t];
      conCarpetas(datos);
      guardar(datos);
      Object.assign(c, { estado: 'lista', tienda: publica(t) });
    } catch (e) {
      Object.assign(c, { estado: 'error', error: e?.message || 'No se pudo conectar.' });
    }
  })();
  return { id };
}

export function estadoConexion(id) {
  const c = conexiones.get(String(id));
  if (!c) throw new ErrorApp(404, 'Esa conexión ya no está: empieza de nuevo.');
  return c;
}

/** Cambia el nombre, la cuenta o el país de una tienda (sin tocar su clave). */
export function editarTienda(id, { nombre, cuenta, pais, carpetaId } = {}) {
  const datos = leer();
  const i = datos.tiendas.findIndex((x) => x.id === id);
  if (i < 0) throw new ErrorApp(404, 'No encuentro esa tienda.');
  const t = { ...datos.tiendas[i] };
  if (nombre !== undefined && String(nombre).trim()) t.nombre = String(nombre).trim().slice(0, 60);
  if (cuenta !== undefined) t.cuenta = limpioCuenta(cuenta) || 'Mi cuenta';
  if (pais !== undefined) t.pais = limpioPais(pais);
  if (carpetaId !== undefined) t.carpetaId = validarCarpeta(datos, carpetaId);
  datos.tiendas[i] = t;
  guardar(datos);
  return publica(t);
}

export function quitarTienda(id) {
  const datos = leer();
  const antes = datos.tiendas.length;
  const quitada = datos.tiendas.find((x) => x.id === id);
  datos.tiendas = datos.tiendas.filter((x) => x.id !== id);
  if (datos.tiendas.length === antes) throw new ErrorApp(404, 'No encuentro esa tienda.');
  guardar(datos);
  // (con mi cuenta) su sesión de Shopify también se borra
  if (quitada && !quitada.token) import('./api.js').then((a) => fs.rmSync(a.dirSesion(quitada.dominio), { recursive: true, force: true })).catch(() => {});
  return { ok: true };
}

// Hablar con Shopify (2026-11-20r): Shopify CLI para los temas (bajar, subir como tema nuevo SIN publicar, publicar,
// borrar) y la API de administración (GraphQL) para lo demás cuando la tienda tiene acceso completo (shpat_).
// Shopify CLI se instala solo la primera vez en app/.cache/shopify-cli (unos 50 MB, un par de minutos) y corre con el
// mismo Node de la app (sin terminal ni shell, también en Windows). La clave va por variable de entorno, nunca en la
// línea de comandos.
//
// Para las pruebas: SHOPIFY_CLI_BIN (un .js que hace de Shopify CLI) y SHOPIFY_ADMIN_BASE (un servidor que hace de la API).
//
//   cli(tienda, args, { cwd, plazoMs }) -> { ok, salida, error, json }
//   temas(tienda) · bajarTema(tienda, temaId, carpeta) · subirTema(tienda, carpeta, { nombre, temaId, solo })
//   publicarTema(tienda, temaId) · borrarTema(tienda, temaId)
//   admin(tienda, query, variables) -> data (lanza con el error de Shopify)
//   probarTienda({ dominio, token, tipo }) -> { ok, nombre, url } | { ok: false, error }
//   subirArchivo(tienda, ruta) -> url pública del archivo en Shopify (Files)
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { APP } from '../rutas.js';
import { renovar } from './tiendas.js';

export const VERSION_CLI = '5.0.1';
export const VERSION_API = '2026-07';
const DIR_CLI = () => path.join(APP, '.cache', 'shopify-cli');
const binCli = () => path.join(DIR_CLI(), 'node_modules', '@shopify', 'cli', 'bin', 'run.js');

function npm() {
  const dir = path.dirname(process.execPath);
  for (const n of process.platform === 'win32' ? ['npm.cmd'] : ['npm']) if (fs.existsSync(path.join(dir, n))) return path.join(dir, n);
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

let instalando = null;
/** Instala Shopify CLI una vez (o usa el de prueba). -> la ruta del .js que se corre con Node */
export function asegurarCli() {
  if (process.env.SHOPIFY_CLI_BIN) return Promise.resolve(process.env.SHOPIFY_CLI_BIN);
  const bin = binCli();
  const versionPuesta = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(DIR_CLI(), 'node_modules', '@shopify', 'cli', 'package.json'), 'utf8')).version;
    } catch {
      return null;
    }
  })();
  if (versionPuesta === VERSION_CLI && fs.existsSync(bin)) return Promise.resolve(bin);
  if (instalando) return instalando;
  fs.mkdirSync(DIR_CLI(), { recursive: true });
  if (!fs.existsSync(path.join(DIR_CLI(), 'package.json'))) fs.writeFileSync(path.join(DIR_CLI(), 'package.json'), '{ "name": "kads-shopify-cli", "private": true }\n');
  instalando = new Promise((ok, mal) => {
    execFile(npm(), ['install', '--no-audit', '--no-fund', '--loglevel=error', `@shopify/cli@${VERSION_CLI}`], { cwd: DIR_CLI(), timeout: 10 * 60000, windowsHide: true, shell: process.platform === 'win32' }, (e) => {
      instalando = null;
      if (e || !fs.existsSync(bin)) return mal(new Error('No pude instalar Shopify CLI (¿hay internet?). Vuelve a intentar.'));
      ok(bin);
    });
  });
  return instalando;
}

const ESC = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const limpiar = (s) => String(s || '').replace(ESC, '').trim();

/** El primer JSON (objeto o lista) que aparezca en la salida. */
function jsonDe(texto) {
  const t = String(texto || '');
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== '{' && t[i] !== '[') continue;
    for (let j = t.length; j > i; j--) {
      if (t[j - 1] !== '}' && t[j - 1] !== ']') continue;
      try {
        return JSON.parse(t.slice(i, j));
      } catch {
        /* sigue */
      }
    }
  }
  return null;
}

/** Corre Shopify CLI en esa tienda. */
export async function cli(tiendaDada, args, { cwd, plazoMs = 10 * 60000, alLeer = null } = {}) {
  const tienda = await renovar(tiendaDada);
  const bin = await asegurarCli();
  const dir = cwd || DIR_CLI();
  fs.mkdirSync(dir, { recursive: true });
  // (2026-11-24) una tienda conectada «con mi cuenta de Shopify» no tiene clave: Shopify CLI usa la sesión que guardó
  // al iniciar sesión en el navegador (y para esa primera vez no va CI=1: así muestra el enlace para entrar)
  const conClave = Boolean(tienda.token);
  const env = { ...process.env, ...(conClave ? { SHOPIFY_CLI_THEME_TOKEN: tienda.token, CI: '1' } : {}), SHOPIFY_FLAG_STORE: tienda.dominio, SHOPIFY_CLI_NO_ANALYTICS: '1', SHOPIFY_CLI_NEVER_USE_PARTNERS_API: '1', NO_COLOR: '1', FORCE_COLOR: '0' };
  if (!conClave) delete env.SHOPIFY_CLI_THEME_TOKEN;
  return new Promise((ok) => {
    const p = spawn(process.execPath, [bin, ...args, '--store', tienda.dominio, '--no-color'], { cwd: dir, env, windowsHide: true });
    const out = [];
    const err = [];
    const t = setTimeout(() => p.kill('SIGKILL'), plazoMs);
    p.stdout.on('data', (d) => {
      out.push(d);
      alLeer?.(d.toString('utf8'));
    });
    p.stderr.on('data', (d) => {
      err.push(d);
      alLeer?.(d.toString('utf8'));
    });
    p.on('error', (e) => {
      clearTimeout(t);
      ok({ ok: false, salida: '', error: e.message });
    });
    p.on('close', (c) => {
      clearTimeout(t);
      const salida = limpiar(Buffer.concat(out).toString('utf8'));
      const error = limpiar(Buffer.concat(err).toString('utf8'));
      // la clave nunca sale en un mensaje
      const sinClave = (s) => (tienda.token ? s.split(tienda.token).join('••••') : s);
      ok({ ok: c === 0, salida: sinClave(salida), error: sinClave(error || (c === 0 ? '' : salida)).slice(-1500), json: jsonDe(salida) });
    });
  });
}

const RUIDO = /^\(node:\d+\)|^\(Use `node|^<claude-code-hint|^\s*$/;
const errorDeCli = (r, que) => {
  const e = [r.json?.error?.message, ...String(r.error || '').split('\n').filter((l) => !RUIDO.test(l))].filter(Boolean).join('\n');
  if (/connecting to your store|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|tunnel|getaddrinfo/i.test(e)) return `${que}: no pude conectar con la tienda (revisa la dirección y tu internet).`;
  if (/401|unauthori[sz]ed|invalid.*(password|token)|access denied/i.test(e)) return `${que}: Shopify no aceptó la clave de la tienda (¿la borraron o le faltan permisos de temas?).`;
  if (/not found|404/i.test(e)) return `${que}: Shopify no encuentra eso en la tienda.`;
  return `${que}: ${e.split('\n').filter(Boolean).slice(-3).join(' ').slice(0, 300) || 'Shopify CLI falló.'}`;
};

export async function temas(tienda, { alLeer = null, plazoMs = 3 * 60000 } = {}) {
  const r = await cli(tienda, ['theme', 'list', '--json'], { plazoMs, alLeer });
  const lista = Array.isArray(r.json) ? r.json : Array.isArray(r.json?.themes) ? r.json.themes : null;
  if (!r.ok || !lista) throw new Error(errorDeCli(r, 'No pude ver los temas'));
  return lista.map((t) => ({ id: String(t.id), nombre: t.name, rol: t.role })).sort((a, b) => (a.rol === 'live' || a.rol === 'main' ? -1 : b.rol === 'live' || b.rol === 'main' ? 1 : 0));
}

export async function bajarTema(tienda, temaId, carpeta) {
  fs.mkdirSync(carpeta, { recursive: true });
  const r = await cli(tienda, ['theme', 'pull', '--theme', String(temaId), '--path', carpeta], { cwd: carpeta });
  if (!r.ok) throw new Error(errorDeCli(r, 'No pude bajar el tema'));
  if (!fs.existsSync(path.join(carpeta, 'layout'))) throw new Error('El tema bajó vacío.');
}

/** Sube la carpeta: como un tema NUEVO sin publicar (nombre) o encima de un tema (temaId, con `solo` los archivos que van). */
export async function subirTema(tienda, carpeta, { nombre, temaId, solo, alEnVivo = false } = {}) {
  const args = ['theme', 'push', '--path', carpeta, '--json'];
  if (temaId) args.push('--theme', String(temaId), '--nodelete');
  else args.push('--unpublished', '--theme', String(nombre || 'Kads Studio').slice(0, 50));
  if (alEnVivo) args.push('--allow-live');
  for (const s of solo || []) args.push('--only', s);
  const r = await cli(tienda, args, { cwd: carpeta });
  if (!r.ok) throw new Error(errorDeCli(r, 'No pude subir el tema'));
  const t = r.json?.theme || r.json || {};
  return { id: t.id ? String(t.id) : temaId ? String(temaId) : null, nombre: t.name || nombre, vista: t.preview_url || (t.id ? `https://${tienda.dominio}/?preview_theme_id=${t.id}` : null), editor: t.editor_url || (t.id ? `https://${tienda.dominio}/admin/themes/${t.id}/editor` : null) };
}

export async function publicarTema(tienda, temaId) {
  const r = await cli(tienda, ['theme', 'publish', '--theme', String(temaId), '--force'], { plazoMs: 3 * 60000 });
  if (!r.ok) throw new Error(errorDeCli(r, 'No pude publicar el tema'));
}

export async function borrarTema(tienda, temaId) {
  const r = await cli(tienda, ['theme', 'delete', '--theme', String(temaId), '--force'], { plazoMs: 3 * 60000 });
  if (!r.ok) throw new Error(errorDeCli(r, 'No pude borrar el tema'));
}

// ---------------------------------------------------------------- la API de administración (GraphQL)

const baseAdmin = (dominio) => process.env.SHOPIFY_ADMIN_BASE || `https://${dominio}`;

async function graphql({ dominio, token }, query, variables = {}) {
  let r;
  try {
    r = await fetch(`${baseAdmin(dominio)}/admin/api/${VERSION_API}/graphql.json`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token, Accept: 'application/json' }, body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(60000) });
  } catch {
    throw new Error('No pude conectar con Shopify (¿hay internet?).');
  }
  const d = await r.json().catch(() => null);
  if (r.status === 401 || r.status === 403) throw new Error('Shopify no aceptó la clave (o a la app de la tienda le falta ese permiso).');
  if (!r.ok) throw new Error(`Shopify respondió ${r.status}.`);
  if (d?.errors?.length) throw new Error(`Shopify: ${d.errors.map((e) => e.message).join(' · ').slice(0, 400)}`);
  return d?.data;
}

export async function admin(tienda, query, variables) {
  if (tienda.tipo !== 'completo') throw new Error('Esa tienda está conectada solo para temas (Theme Access). Para lo demás conéctala con el Client ID y el secreto de tu app del Dev Dashboard.');
  return graphql(await renovar(tienda), query, variables);
}

export async function probarTienda({ dominio, token, tipo }) {
  try {
    if (tipo === 'completo') {
      // (2026-11-24) también el país y la moneda: las tiendas se eligen por país
      const d = await graphql({ dominio, token }, '{ shop { name myshopifyDomain primaryDomain { url } currencyCode billingAddress { countryCodeV2 } } }');
      return { ok: true, nombre: d?.shop?.name, url: d?.shop?.primaryDomain?.url, pais: d?.shop?.billingAddress?.countryCodeV2 || null, moneda: d?.shop?.currencyCode || null };
    }
    await temas({ dominio, token, tipo });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/** Sube un archivo (un video) a Archivos de Shopify y devuelve su URL. Necesita acceso completo (write_files). */
export async function subirArchivo(tienda, ruta) {
  const nombre = path.basename(ruta);
  const mime = /\.mp4$/i.test(nombre) ? 'video/mp4' : /\.webm$/i.test(nombre) ? 'video/webm' : 'application/octet-stream';
  const bytes = fs.readFileSync(ruta);
  const d = await admin(tienda, 'mutation($i:[StagedUploadInput!]!){ stagedUploadsCreate(input:$i){ stagedTargets{ url resourceUrl parameters{ name value } } userErrors{ message } } }', { i: [{ filename: nombre, mimeType: mime, resource: 'VIDEO', fileSize: String(bytes.length), httpMethod: 'POST' }] });
  const t = d?.stagedUploadsCreate?.stagedTargets?.[0];
  if (!t) throw new Error(d?.stagedUploadsCreate?.userErrors?.[0]?.message || 'Shopify no dio dónde subir el archivo.');
  const fd = new FormData();
  for (const p of t.parameters) fd.append(p.name, p.value);
  fd.append('file', new Blob([bytes], { type: mime }), nombre);
  const up = await fetch(t.url, { method: 'POST', body: fd, signal: AbortSignal.timeout(5 * 60000) });
  if (!up.ok) throw new Error(`No se pudo subir el archivo (${up.status}).`);
  const c = await admin(tienda, 'mutation($f:[FileCreateInput!]!){ fileCreate(files:$f){ files{ id } userErrors{ message } } }', { f: [{ originalSource: t.resourceUrl, contentType: 'VIDEO' }] });
  const id = c?.fileCreate?.files?.[0]?.id;
  if (!id) throw new Error(c?.fileCreate?.userErrors?.[0]?.message || 'Shopify no creó el archivo.');
  for (let i = 0; i < 60; i++) {
    const q = await admin(tienda, 'query($id:ID!){ node(id:$id){ ... on Video { fileStatus sources { url mimeType } } } }', { id });
    const n = q?.node;
    if (n?.fileStatus === 'READY' && n.sources?.length) return (n.sources.find((s) => s.mimeType === 'video/mp4') || n.sources[0]).url;
    if (n?.fileStatus === 'FAILED') throw new Error('Shopify no pudo procesar el video.');
    await new Promise((ok) => setTimeout(ok, process.env.SHOPIFY_ADMIN_BASE ? 50 : 3000));
  }
  throw new Error('Shopify tardó demasiado en procesar el video.');
}

// Los anuncios ya terminados que están guardados en GitHub, por producto (el repositorio privado "anuncios-ia-videos"
// de la misma cuenta, o el de ANUNCIOS_REPO en el .env): productos/<producto>/<anuncio>/<anuncio>_9x16_<versión>.mp4,
// con su material/ (manifiesto, imágenes…). Ahí los sube IA-VID-AUTOMATIC al terminar cada anuncio.
//
// Se guarda una copia SIN archivos (git clone --filter=blob:none --no-checkout) en mis_archivos/.anuncios-github/:
// la lista sale del árbol del repositorio sin bajar nada pesado, y cada video o imagen se baja recién cuando se mira
// (git cat-file), y queda en mis_archivos/.anuncios-github-cache/ para la próxima vez. Se pone al día al abrir la app
// y cada hora. Solo lee: nunca sube nada a ese repositorio.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { RAIZ, PUERTO_DE_PRUEBA } from './rutas.js';
import { ESTILOS } from './estilos.js';

const DIR = path.join(RAIZ, 'mis_archivos', '.anuncios-github');
const CACHE = path.join(RAIZ, 'mis_archivos', '.anuncios-github-cache');
const CADA_MS = 60 * 60000;
const NOMBRE_REPO = 'anuncios-ia-videos';
const VERSIONES = {
  'con-subtitulos': 'Completa',
  'solo-subtitulos': 'Solo subtítulos',
  'sin-subtitulos': 'Sin subtítulos',
  'sin-subtitulos-sin-musica': 'Sin subtítulos ni música',
};

let estado = { estado: 'sin-empezar', error: null, ultima: null };
let lista = null; // la última lista armada (se rearma al cambiar el repositorio)
let corriendo = null;

function correr(args, { cwd = DIR, binario = false, ms = 300000 } = {}) {
  return new Promise((ok) => {
    const trozos = [];
    let err = '';
    let p;
    try {
      p = spawn('git', args, { cwd, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', GIT_SSH_COMMAND: 'ssh -o BatchMode=yes' } });
    } catch (e) {
      return ok({ ok: false, salida: String(e.message || e) });
    }
    const t = setTimeout(() => p.kill(), ms);
    p.stdout.on('data', (d) => trozos.push(d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => {
      clearTimeout(t);
      ok({ ok: false, salida: String(e.message || e) });
    });
    p.on('close', (codigo) => {
      clearTimeout(t);
      const buf = Buffer.concat(trozos);
      ok({ ok: codigo === 0, salida: binario ? buf : buf.toString('utf8').trim(), error: err.trim() });
    });
  });
}

function delEnv(nombre) {
  if (process.env[nombre]) return process.env[nombre].trim();
  try {
    return fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').match(new RegExp(`^\\s*${nombre}\\s*=\\s*([^\\s#]+)`, 'm'))?.[1] || '';
  } catch {
    return '';
  }
}

async function urlDelRepo() {
  const propio = delEnv('ANUNCIOS_REPO');
  if (propio) return /^(https?:|git@|file:|\/)/.test(propio) ? propio : `https://github.com/${propio.replace(/\.git$/, '')}.git`;
  const origen = await correr(['remote', 'get-url', 'origin'], { cwd: RAIZ });
  const m = origen.ok ? origen.salida.match(/github\.com[:/]([^/]+)\//) : null;
  if (!m) return null;
  return origen.salida.startsWith('git@') ? `git@github.com:${m[1]}/${NOMBRE_REPO}.git` : `https://github.com/${m[1]}/${NOMBRE_REPO}.git`;
}

const sinGit = () => PUERTO_DE_PRUEBA || process.env.ANUNCIOS_MODO_PRUEBA === '1';

/** Baja lo nuevo del repositorio (solo el árbol, sin los archivos). Nunca lanza. */
export function ponerAlDia() {
  if (corriendo) return corriendo;
  corriendo = (async () => {
    try {
      const url = await urlDelRepo();
      if (!url) return (estado = { estado: 'error', error: 'No sé de qué cuenta de GitHub es esta app (clónala desde GitHub).', ultima: null });
      if (!fs.existsSync(path.join(DIR, '.git')) && !fs.existsSync(path.join(DIR, 'HEAD'))) {
        fs.mkdirSync(path.dirname(DIR), { recursive: true });
        const c = await correr(['clone', '-q', '--filter=blob:none', '--no-checkout', url, DIR], { cwd: RAIZ, ms: 600000 });
        if (!c.ok) return (estado = { estado: 'sin-repo', error: 'No encontré el repositorio de tus anuncios en GitHub, o este computador no tiene acceso.', ultima: null });
      } else {
        await correr(['remote', 'set-url', 'origin', url]);
        const f = await correr(['fetch', '-q', '--filter=blob:none', 'origin']);
        if (!f.ok) return (estado = { ...estado, estado: 'error', error: 'No pude conectar con GitHub para traer tus anuncios.' });
      }
      lista = null;
      return (estado = { estado: 'listo', error: null, ultima: new Date().toISOString() });
    } catch (e) {
      return (estado = { estado: 'error', error: String(e.message || e).slice(0, 200), ultima: estado.ultima });
    } finally {
      corriendo = null;
    }
  })();
  return corriendo;
}

export function iniciarAnunciosGithub() {
  if (sinGit()) return;
  setTimeout(ponerAlDia, 8000).unref?.();
  setInterval(ponerAlDia, CADA_MS).unref?.();
}

async function rama() {
  const r = await correr(['symbolic-ref', '-q', '--short', 'refs/remotes/origin/HEAD']);
  return r.ok && r.salida ? r.salida : 'origin/main';
}

/** Un archivo del repositorio, bajado una sola vez y guardado en la caché. Devuelve su ruta local, o null. */
export async function archivoLocal(ruta) {
  const limpia = String(ruta || '').replace(/\\/g, '/');
  if (!/^productos\/[^\0]+$/.test(limpia) || limpia.split('/').some((p) => p === '..' || p === '' || p.startsWith('.'))) return null;
  const destino = path.join(CACHE, ...limpia.split('/'));
  if (fs.existsSync(destino)) return destino;
  if (!fs.existsSync(DIR)) return null;
  const r = await correr(['cat-file', 'blob', `${await rama()}:${limpia}`], { binario: true, ms: 600000 });
  if (!r.ok || !r.salida.length) return null;
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const tmp = `${destino}.parcial`;
  fs.writeFileSync(tmp, r.salida);
  fs.renameSync(tmp, destino);
  return destino;
}

async function textoDe(ruta) {
  const f = await archivoLocal(ruta);
  try {
    return f ? fs.readFileSync(f, 'utf8') : null;
  } catch {
    return null;
  }
}

const nombreBonito = (s) => String(s || '').replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/**
 * Los anuncios de GitHub, por producto: [{ producto, nombre, anuncios: [{ id, titulo, estilo, estiloNombre,
 * versiones: [{ tipo, nombre, ruta }], portada }] }]. La primera vez baja los manifiestos (son chicos).
 */
export async function listarAnunciosGithub() {
  if (lista) return lista;
  if (!fs.existsSync(DIR)) return [];
  const r = await correr(['ls-tree', '-r', '--name-only', await rama(), 'productos/']);
  if (!r.ok) return [];
  const archivos = r.salida.split('\n').filter(Boolean);
  const anuncios = new Map(); // "producto/anuncio" -> { mp4s: [], imagenes: [] , manifiesto }
  for (const f of archivos) {
    const p = f.split('/');
    if (p.length < 4) continue;
    const clave = `${p[1]}/${p[2]}`;
    if (!anuncios.has(clave)) anuncios.set(clave, { producto: p[1], id: p[2], mp4s: [], imagenes: [], manifiesto: null });
    const a = anuncios.get(clave);
    if (p.length === 4 && p[3].endsWith('.mp4')) a.mp4s.push(f);
    // el sketch deja sus finales en material/: FINAL_con_musica.mp4 y FINAL_sin_musica.mp4
    else if (p.length === 5 && p[3] === 'material' && /^FINAL_.*\.mp4$/i.test(p[4])) a.mp4s.push(f);
    else if (p.length === 5 && p[3] === 'material' && p[4] === 'GUION.md' && !a.estilo) a.estilo = 'sketch';
    else if (p[3] === 'material' && p[4] === 'manifiesto.json' && p.length === 5) a.manifiesto = f;
    else if (p[3] === 'material' && p[4] === 'img' && /\.(png|jpe?g|webp)$/i.test(f)) a.imagenes.push(f);
    else if (p.length === 4 && /^portada\.(jpe?g|png)$/i.test(p[3])) a.imagenes.unshift(f);
  }
  const porProducto = new Map();
  for (const a of anuncios.values()) {
    if (!a.mp4s.length) continue;
    let estilo = a.estilo || null;
    let titulo = null;
    if (a.manifiesto) {
      try {
        const m = JSON.parse((await textoDe(a.manifiesto)) || '{}');
        estilo = typeof m.estilo === 'string' ? m.estilo : null;
        titulo = m.producto?.nombre || m.titulo || null;
      } catch {
        /* sin manifiesto legible */
      }
    }
    const def = ESTILOS.find((e) => e.clave === estilo || e.skill === `anuncios-${estilo}`) || (estilo === 'sketch' ? { clave: 'sketch', nombre: 'Sketch de comedia' } : null);
    const versiones = a.mp4s
      .map((ruta) => {
        const final = (ruta.match(/FINAL_(con|sin)_musica\.mp4$/i) || [])[1];
        const tipo = final ? (final === 'con' ? 'con-subtitulos' : 'sin-subtitulos-sin-musica') : (ruta.match(/_9x16_([a-z-]+)\.mp4$/) || [])[1] || 'video';
        return { tipo, nombre: VERSIONES[tipo] || nombreBonito(tipo), ruta };
      })
      .sort((x, y) => Object.keys(VERSIONES).indexOf(x.tipo) - Object.keys(VERSIONES).indexOf(y.tipo));
    const portada =
      a.imagenes.find((f) => /portada\./.test(f)) ||
      a.imagenes.find((f) => /material\/img\/[^/]*escena[^/]*1|material\/img\/[^/]*01/.test(f)) || a.imagenes.find((f) => /toma-1-inicial\./.test(f)) || a.imagenes.find((f) => /toma-1/.test(f)) || a.imagenes[0] || null;
    const item = {
      id: a.id,
      producto: a.producto,
      titulo: titulo || nombreBonito(a.id),
      estilo: def?.clave || estilo || null,
      estiloNombre: def?.nombre || (estilo ? nombreBonito(estilo) : null),
      versiones,
      portada,
    };
    if (!porProducto.has(a.producto)) porProducto.set(a.producto, []);
    porProducto.get(a.producto).push(item);
  }
  lista = [...porProducto.entries()]
    .map(([producto, ads]) => ({ producto, nombre: nombreBonito(producto), anuncios: ads.sort((x, y) => x.id.localeCompare(y.id)) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return lista;
}

export const estadoAnunciosGithub = () => (sinGit() && !fs.existsSync(DIR) ? { estado: 'sin-git', error: null, ultima: null } : estado);

/** Un video de GitHub de un estilo (para la vista previa de un estilo que no tiene video): la ruta de su versión completa. */
export async function videoDeEstilo(estilo) {
  const todos = (await listarAnunciosGithub()).flatMap((p) => p.anuncios);
  const a = todos.find((x) => x.estilo === estilo);
  return a ? { video: a.versiones[0]?.ruta || null, portada: a.portada } : null;
}

/** Un video de GitHub cuyo anuncio se llama con algo de `texto` (p. ej. "sketch"). */
export async function videoQueDiga(texto) {
  const todos = (await listarAnunciosGithub()).flatMap((p) => p.anuncios);
  const a = todos.find((x) => x.id.includes(texto));
  return a ? { video: a.versiones[0]?.ruta || null, portada: a.portada } : null;
}

// La biblioteca: lo que se reutiliza de un anuncio a otro, por estilo (traída de IA-VID-AUTOMATIC, 2026-11-08).
//
//   avatares/<estilo>/<id>/avatar.json + imágenes   las personas o personajes, para que salgan iguales en otros anuncios
//   audios/<estilo>/<id>.mp3 + <id>.json             música de fondo (y voces o efectos) que ya se pagó
//   aprendizajes/                                    general.md, uno por estilo y la bitácora (lib/aprendizajes.js)
//   clips/<estilo>/                                  la biblioteca de clips (produccion/clips-sin-cobro.js)
//   imagenes/<estilo>/                               imágenes reutilizables (las llena IA-VID-AUTOMATIC)
//
// <estilo> es el nombre de la skill sin "anuncios-" (ugc, skeleton-ads, musicales…), igual que en IA-VID-AUTOMATIC.
//
// Vive en mis_archivos/biblioteca/ y es una copia del repositorio PRIVADO "biblioteca-anuncios" de la misma cuenta de
// GitHub que esta app (o el de BIBLIOTECA_REPO en el .env). Es el MISMO repositorio que usa IA-VID-AUTOMATIC: lo que
// se guarda en una app aparece en la otra, aprendizajes incluidos. La app lo baja al abrirse y cada 10 minutos, y sube
// lo nuevo unos segundos después de guardar. Los .md se juntan línea a línea si las dos apps escriben a la vez
// (.gitattributes: merge=union). El guardado de la app (lib/guardado.js) NO la sube al repositorio de la app: está en
// el .gitignore.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { RAIZ, SKILLS, TEMP, PUERTO_DE_PRUEBA } from './rutas.js';
import { ESTILOS } from './estilos.js';

export const DIR_BIBLIOTECA = path.join(RAIZ, 'mis_archivos', 'biblioteca');
export const DIR_AVATARES = path.join(DIR_BIBLIOTECA, 'avatares');
export const DIR_AUDIOS = path.join(DIR_BIBLIOTECA, 'audios');
export const DIR_SUBIDAS = path.join(TEMP, '_biblioteca-subidas');
const NOMBRE_REPO = 'biblioteca-anuncios';
const CADA_MS = 10 * 60000;
const ID = /^[a-z0-9][a-z0-9-]{0,80}$/;
const IMAGEN = /\.(png|jpe?g|webp)$/i;
const AUDIO = /\.(mp3|wav|m4a|ogg)$/i;

const leerJSON = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
  } catch {
    return null;
  }
};
const escribirJSON = (f, d) => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, `${JSON.stringify(d, null, 2)}\n`, 'utf8');
};
const rel = (abs) => path.relative(RAIZ, abs).split(path.sep).join('/');

// ---------------------------------------------------------------- los estilos y quiénes forman un avatar

/** La carpeta de un estilo en la biblioteca: el nombre de su skill sin "anuncios-" (como en IA-VID-AUTOMATIC). */
export function carpetaDeEstilo(clave) {
  const def = ESTILOS.find((e) => e.clave === clave || e.skill === `anuncios-${clave}`);
  return def ? def.skill.replace(/^anuncios-/, '') : ID.test(String(clave || '')) ? String(clave) : null;
}
/** La clave de la app de una carpeta de la biblioteca (skeleton-ads -> skeleton), o null si no es un estilo. */
export function claveDeCarpeta(carpeta) {
  return ESTILOS.find((e) => e.skill === `anuncios-${carpeta}`)?.clave || null;
}

const PROTAGONISTA = { roles: [{ id: 'protagonista', nombre: 'Protagonista', desc: 'el personaje principal de la historia' }], extras: 2 };
/** Quiénes forman un avatar en cada estilo (por su carpeta). Los roles son obligatorios; extras, cuántos más se admiten. */
export const ROLES_AVATAR = {
  ugc: { roles: [{ id: 'creadora', nombre: 'Persona que habla', desc: 'quien habla a cámara todo el anuncio' }] },
  podcast: {
    roles: [
      { id: 'host-a', nombre: 'Host A', desc: 'el anfitrión que conduce la conversación' },
      { id: 'host-b', nombre: 'Host B', desc: 'el otro anfitrión, el que recomienda' },
    ],
  },
  entrevista: { roles: [{ id: 'entrevistado', nombre: 'Persona entrevistada', desc: 'la persona en la calle que responde' }] },
  sketch: {
    roles: [
      { id: 'protagonista', nombre: 'Protagonista', desc: 'a quien se le burlan por el problema' },
      { id: 'mensajero', nombre: 'Mensajero', desc: 'quien ya lo resolvió y le pasa el secreto' },
    ],
    extras: 3,
  },
  'talking-object-pixar': { roles: [{ id: 'personaje', nombre: 'Personaje que habla', desc: 'el objeto, ingrediente o parte del cuerpo animado' }], extras: 2 },
  'realista-narrado': { roles: [{ id: 'protagonista', nombre: 'Protagonista', desc: 'la persona que cambia (antes y después)' }], extras: 2 },
  'skeleton-ads': { roles: [{ id: 'esqueleto', nombre: 'Esqueleto', desc: 'el personaje esqueleto' }], extras: 2 },
  crochet: PROTAGONISTA,
  claymation: PROTAGONISTA,
  'zack-d-films': PROTAGONISTA,
  'estilo-pixar': PROTAGONISTA,
  'estilo-lego': PROTAGONISTA,
  musicales: PROTAGONISTA,
  'historias-musicales': PROTAGONISTA,
};

// ---------------------------------------------------------------- sincronización con GitHub

let estado = { estado: 'sin-empezar', repo: null, ultima: null, error: null };
let corriendo = false;
let otraVez = false;
let temporizador = null;

const sinGit = () => PUERTO_DE_PRUEBA || process.env.ANUNCIOS_MODO_PRUEBA === '1' || process.env.ANUNCIOS_SIN_GUARDADO === '1';

function correr(cmd, args, cwd, ms = 180000) {
  return new Promise((ok) => {
    let salida = '';
    let p;
    try {
      p = spawn(cmd, args, {
        cwd,
        windowsHide: true,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', GIT_SSH_COMMAND: 'ssh -o BatchMode=yes', GH_PROMPT_DISABLED: '1' },
      });
    } catch (e) {
      return ok({ ok: false, salida: String(e.message || e) });
    }
    const t = setTimeout(() => p.kill(), ms);
    p.stdout.on('data', (d) => (salida += d));
    p.stderr.on('data', (d) => (salida += d));
    p.on('error', (e) => {
      clearTimeout(t);
      ok({ ok: false, salida: String(e.message || e) });
    });
    p.on('close', (codigo) => {
      clearTimeout(t);
      ok({ ok: codigo === 0, salida: salida.trim() });
    });
  });
}
const git = (args, cwd = DIR_BIBLIOTECA) => correr('git', args, cwd);

function delEnv(nombre) {
  if (process.env[nombre]) return process.env[nombre].trim();
  try {
    return fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').match(new RegExp(`^\\s*${nombre}\\s*=\\s*([^\\s#]+)`, 'm'))?.[1] || '';
  } catch {
    return '';
  }
}

/** El repositorio de la biblioteca: BIBLIOTECA_REPO del .env, o "biblioteca-anuncios" del mismo dueño que esta app. */
export async function repoBiblioteca() {
  const propio = delEnv('BIBLIOTECA_REPO');
  if (propio) {
    const m = propio.match(/github\.com[:/]([^/]+)\//) || propio.match(/^([^/\s]+)\/[^/\s]+$/);
    const url = /^(https?:|git@|file:|\/)/.test(propio) ? propio : `https://github.com/${propio.replace(/\.git$/, '')}.git`;
    return { url, dueno: m?.[1] || '' };
  }
  const origen = await git(['remote', 'get-url', 'origin'], RAIZ);
  const m = origen.ok ? origen.salida.match(/github\.com[:/]([^/]+)\//) : null;
  if (!m) return null;
  // con el mismo tipo de dirección que la app (https o ssh), para usar las mismas credenciales
  const url = origen.salida.startsWith('git@') ? `git@github.com:${m[1]}/${NOMBRE_REPO}.git` : `https://github.com/${m[1]}/${NOMBRE_REPO}.git`;
  return { url, dueno: m[1] };
}

const README = `# Biblioteca del Estudio de anuncios

Privada. La llenan y la sincronizan solas las apps de anuncios (IA-VID-AUTOMATIC y Anuncios con IA): avatares
(personas y personajes), audios (música, voces, efectos), clips, imágenes y aprendizajes, por estilo. No se edita a mano.
`;

/** Los .md modificados aquí y en el repositorio: se juntan (lo del repositorio y, abajo, las líneas nuevas de aquí). */
function juntarLineas(repo, local) {
  const enRepo = new Set(repo.split(/\r?\n/));
  const nuevas = local.split(/\r?\n/).filter((l) => l.trim() && !/^# /.test(l) && !enRepo.has(l));
  return nuevas.length ? `${repo.trimEnd()}\n${nuevas.join('\n')}\n` : repo;
}

async function sincronizarAhora() {
  const repo = await repoBiblioteca();
  // sin repositorio (la app llegó en un zip): la biblioteca vive solo en este computador, y está bien así
  if (!repo) return { estado: 'local', repo: null, error: null };
  fs.mkdirSync(DIR_BIBLIOTECA, { recursive: true });

  // Si el guardado de la app ya la había subido al repositorio de la app, se saca de ahí (los archivos quedan).
  if (fs.existsSync(path.join(RAIZ, '.git'))) {
    const seguidos = await git(['ls-files', '--', 'mis_archivos/biblioteca'], RAIZ);
    if (seguidos.ok && seguidos.salida.trim()) await git(['rm', '-r', '-q', '--cached', '--', 'mis_archivos/biblioteca'], RAIZ);
  }

  let remoto = await git(['ls-remote', '--heads', repo.url], RAIZ);
  if (!remoto.ok && repo.dueno) {
    const creado = await correr('gh', ['repo', 'create', `${repo.dueno}/${NOMBRE_REPO}`, '--private', '--description', 'Biblioteca de las apps de anuncios: avatares, audios y aprendizajes.'], RAIZ);
    if (creado.ok) remoto = await git(['ls-remote', '--heads', repo.url], RAIZ);
  }
  if (!remoto.ok) {
    return {
      estado: 'sin-repo',
      repo: repo.url,
      error: 'El repositorio de la biblioteca no existe todavía o este computador no tiene acceso. Mientras tanto se guarda solo aquí.',
      crearEn: `https://github.com/new?name=${NOMBRE_REPO}&visibility=private`,
    };
  }
  const remotoVacio = !remoto.salida.trim();

  // Primera vez (o una primera vez que se cortó: hay .git pero ningún commit): lo que ya había aquí (los aprendizajes
  // y los clips de esta app) se junta con lo del repositorio.
  const sinHistoria = !fs.existsSync(path.join(DIR_BIBLIOTECA, '.git')) || !(await git(['rev-parse', '-q', '--verify', 'HEAD'])).ok;
  if (sinHistoria) {
    if (!fs.existsSync(path.join(DIR_BIBLIOTECA, '.git'))) await git(['init', '-q', '-b', 'main']);
    if (!(await git(['remote', 'add', 'origin', repo.url])).ok) await git(['remote', 'set-url', 'origin', repo.url]);
    if (!remotoVacio) {
      const f = await git(['fetch', '-q', 'origin', 'main']);
      if (!f.ok) return { estado: 'error', repo: repo.url, error: `No pude bajar la biblioteca: ${f.salida.slice(-300)}` };
      await git(['reset', '-q', 'origin/main']); // el historial del repositorio, sin tocar los archivos de aquí
      await git(['branch', '-q', '--set-upstream-to=origin/main', 'main']);
      const borrados = (await git(['ls-files', '--deleted'])).salida.split('\n').filter(Boolean);
      if (borrados.length) await git(['checkout', '--', ...borrados]); // lo del repositorio que aquí no estaba
      for (const f of (await git(['diff', '--name-only'])).salida.split('\n').filter((x) => x.endsWith('.md'))) {
        const delRepo = await git(['show', `origin/main:${f}`]);
        if (delRepo.ok) fs.writeFileSync(path.join(DIR_BIBLIOTECA, f), juntarLineas(delRepo.salida, fs.readFileSync(path.join(DIR_BIBLIOTECA, f), 'utf8')), 'utf8');
      }
    }
  }
  if (!fs.existsSync(path.join(DIR_BIBLIOTECA, 'README.md'))) fs.writeFileSync(path.join(DIR_BIBLIOTECA, 'README.md'), README);
  const asegurarLineas = (archivo, lineas) => {
    const f = path.join(DIR_BIBLIOTECA, archivo);
    const actual = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    const faltan = lineas.filter((l) => !actual.split(/\r?\n/).includes(l));
    if (faltan.length) fs.writeFileSync(f, `${actual.trimEnd()}${actual.trim() ? '\n' : ''}${faltan.join('\n')}\n`);
  };
  // Los videos pesan demasiado para GitHub; el historial de ediciones y las marcas del barrido son de este computador.
  asegurarLineas('.gitignore', ['*.mp4', '*.mov', '*.webm', '.DS_Store', '.historial-ediciones/', 'aprendizajes/.barrido.json']);
  // Si las dos apps anotan aprendizajes a la vez, git junta las líneas de las dos en vez de pararse.
  asegurarLineas('.gitattributes', ['*.md merge=union']);

  const identidad = (await git(['config', 'user.email'])).ok ? [] : ['-c', 'user.name=Anuncios con IA', '-c', 'user.email=anuncios-con-ia@localhost'];
  await git(['add', '-A']);
  if (!(await git(['diff', '--cached', '--quiet'])).ok) await git([...identidad, 'commit', '-q', '-m', `Biblioteca (Anuncios con IA): ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`]);
  if (!remotoVacio) {
    const p = await git([...identidad, 'pull', '-q', '--no-rebase', '--no-edit', 'origin', 'main']);
    if (!p.ok) {
      await git(['merge', '--abort']);
      return { estado: 'error', repo: repo.url, error: `No pude bajar lo nuevo de la biblioteca: ${p.salida.slice(-300)}` };
    }
  }
  const s = await git(['push', '-q', '-u', 'origin', 'main'], DIR_BIBLIOTECA);
  if (!s.ok) return { estado: 'error', repo: repo.url, error: `No pude subir lo nuevo de la biblioteca: ${s.salida.slice(-300)}` };
  return { estado: 'listo', repo: repo.url, ultima: new Date().toISOString(), error: null };
}

/** Sincroniza ya. Nunca corren dos a la vez: si piden otra mientras corre, se repite al terminar. Nunca lanza. */
export async function sincronizar() {
  if (sinGit()) return (estado = { estado: 'sin-git', repo: null, ultima: null, error: null });
  if (corriendo) {
    otraVez = true;
    return estado;
  }
  corriendo = true;
  estado = { ...estado, estado: 'sincronizando' };
  try {
    do {
      otraVez = false;
      try {
        estado = await sincronizarAhora();
      } catch (e) {
        estado = { estado: 'error', repo: estado.repo, error: String(e?.message || e).slice(0, 300) };
      }
    } while (otraVez);
  } finally {
    corriendo = false;
  }
  return estado;
}

/** Después de guardar algo: sincroniza en unos segundos (junta varios cambios seguidos). */
export function pedirSincronizacion(enMs = 15000) {
  if (sinGit()) return;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => sincronizar(), enMs);
  temporizador.unref?.();
}

export const estadoBiblioteca = () => (sinGit() ? { estado: 'sin-git', repo: null, ultima: null, error: null } : estado);

/** Arranca el ciclo: al abrir la app y cada 10 minutos (no en las apps de prueba). */
export function iniciarBiblioteca() {
  if (sinGit()) return;
  setTimeout(sincronizar, 5000).unref?.();
  setInterval(sincronizar, CADA_MS).unref?.();
}

// ---------------------------------------------------------------- subidas (las imágenes y audios antes de guardarlos)

const EXT_SUBIDA = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/ogg': 'ogg' };

/** Guarda lo subido en temp/_biblioteca-subidas/ y devuelve su id ("subida:<archivo>"). */
export function guardarSubida(buffer, tipo, nombre = '') {
  const ext = EXT_SUBIDA[tipo] || (/\.(png|jpe?g|webp|mp3|wav|m4a|ogg)$/i.exec(nombre)?.[1] || '').toLowerCase().replace('jpeg', 'jpg');
  if (!ext || !Buffer.isBuffer(buffer) || buffer.length < 200) throw Object.assign(new Error('Sube una imagen (png, jpg o webp) o un audio (mp3, wav, m4a).'), { status: 400 });
  fs.mkdirSync(DIR_SUBIDAS, { recursive: true });
  const archivo = `${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(DIR_SUBIDAS, archivo), buffer);
  return `subida:${archivo}`;
}

/**
 * La ruta de un archivo que se va a guardar en la biblioteca: lo subido ("subida:<archivo>"), una imagen o un audio
 * de un anuncio ("temp/<slug>/…") o un retrato de un subestilo (".claude/skills/…/subestilos/…/avatar/…"). Nunca
 * sale de esas carpetas.
 */
function origenSeguro(ref) {
  const r = String(ref || '');
  if (r.startsWith('subida:')) {
    const n = path.basename(r.slice(7));
    const abs = path.join(DIR_SUBIDAS, n);
    return fs.existsSync(abs) ? abs : null;
  }
  const abs = path.resolve(RAIZ, r);
  const dentro = (base) => abs.startsWith(base + path.sep);
  const ok = (dentro(TEMP) && !path.relative(TEMP, abs).startsWith('_')) || (dentro(SKILLS) && /[\\/]subestilos[\\/][^\\/]+[\\/]avatar[\\/]/.test(abs));
  return ok && fs.existsSync(abs) && fs.statSync(abs).isFile() ? abs : null;
}

function slugDe(texto, porDefecto) {
  return (
    String(texto || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || porDefecto
  );
}
const idNuevo = (nombre, porDefecto) => `${slugDe(nombre, porDefecto)}-${crypto.randomBytes(2).toString('hex')}`;

// ---------------------------------------------------------------- avatares

function leerAvatar(carpeta, id) {
  const dir = path.join(DIR_AVATARES, carpeta, id);
  const j = leerJSON(path.join(dir, 'avatar.json'));
  if (!j) return null;
  const personas = (Array.isArray(j.personas) ? j.personas : [])
    .filter((p) => p && typeof p.imagen === 'string' && fs.existsSync(path.join(dir, path.basename(p.imagen))))
    .map((p) => ({
      rol: String(p.rol || ''),
      nombre: String(p.nombre || p.rol || 'Personaje'),
      imagen: rel(path.join(dir, path.basename(p.imagen))),
      descripcion: p.descripcion ? String(p.descripcion) : '',
    }));
  if (!personas.length) return null;
  let creado = Number(j.creado);
  if (!creado) creado = fs.statSync(dir).mtimeMs;
  return { id, nombre: String(j.nombre || id), estilo: carpeta, clave: claveDeCarpeta(carpeta), creado, personas };
}

/** Los avatares guardados (de un estilo por su clave de la app o su carpeta, o de todos), los más nuevos primero. */
export function listarAvatares(estilo) {
  if (!fs.existsSync(DIR_AVATARES)) return [];
  const carpetas = estilo ? [carpetaDeEstilo(estilo)].filter(Boolean) : fs.readdirSync(DIR_AVATARES).filter((e) => ID.test(e));
  const out = [];
  for (const c of carpetas) {
    const dir = path.join(DIR_AVATARES, c);
    if (!fs.existsSync(dir)) continue;
    for (const id of fs.readdirSync(dir)) if (ID.test(id)) out.push(leerAvatar(c, id));
  }
  return out.filter(Boolean).sort((a, b) => b.creado - a.creado);
}

export function avatarPorId(estilo, id) {
  const c = carpetaDeEstilo(estilo);
  return c && ID.test(String(id || '')) ? leerAvatar(c, id) : null;
}

/**
 * Guarda un avatar nuevo con sus imágenes (subidas, de un anuncio o el retrato de un subestilo).
 * personas: [{ rol, nombre?, imagen: <ruta u "subida:…">, descripcion? }]. Exige los personajes obligatorios del estilo.
 */
export function crearAvatar(estilo, nombre, personas) {
  const carpeta = carpetaDeEstilo(estilo);
  const r = ROLES_AVATAR[carpeta];
  if (!r) throw Object.assign(new Error('Ese estilo no usa avatares.'), { status: 400 });
  nombre = String(nombre || '').trim().slice(0, 60);
  if (!nombre) throw Object.assign(new Error('Ponle un nombre al avatar.'), { status: 400 });
  const lista = (Array.isArray(personas) ? personas : []).filter((p) => p && p.imagen);
  const faltan = r.roles.filter((rol) => !lista.some((p) => p.rol === rol.id));
  if (faltan.length) throw Object.assign(new Error(`Falta ${faltan.map((f) => f.nombre).join(' y ')}: este estilo los necesita.`), { status: 400 });
  const extras = lista.filter((p) => !r.roles.some((rol) => rol.id === p.rol));
  if (extras.length > (r.extras || 0)) throw Object.assign(new Error(`Este estilo admite hasta ${r.extras || 0} personaje(s) extra.`), { status: 400 });

  const id = idNuevo(nombre, 'avatar');
  const dir = path.join(DIR_AVATARES, carpeta, id);
  fs.mkdirSync(dir, { recursive: true });
  try {
    let n = 0;
    const guardadas = lista.map((p) => {
      const origen = origenSeguro(p.imagen);
      if (!origen || !IMAGEN.test(origen)) throw Object.assign(new Error(`No encontré la imagen de ${p.nombre || p.rol}.`), { status: 400 });
      const fijo = r.roles.find((x) => x.id === p.rol);
      const rolId = fijo ? fijo.id : `extra-${++n}`;
      const archivo = `${rolId}${path.extname(origen).toLowerCase().replace('.jpeg', '.jpg')}`;
      fs.copyFileSync(origen, path.join(dir, archivo));
      return {
        rol: rolId,
        nombre: fijo?.nombre || String(p.nombre || '').trim().slice(0, 40) || `Personaje ${n}`,
        imagen: archivo,
        descripcion: String(p.descripcion || '').trim().slice(0, 600) || undefined,
      };
    });
    escribirJSON(path.join(dir, 'avatar.json'), { id, nombre, estilo: carpeta, creado: Date.now(), personas: guardadas });
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw e;
  }
  pedirSincronizacion();
  return leerAvatar(carpeta, id);
}

export function editarAvatar(estilo, id, { nombre, descripciones } = {}) {
  const carpeta = carpetaDeEstilo(estilo);
  const f = carpeta && ID.test(String(id || '')) ? path.join(DIR_AVATARES, carpeta, id, 'avatar.json') : null;
  const j = f && leerJSON(f);
  if (!j) throw Object.assign(new Error('No encontré ese avatar.'), { status: 404 });
  if (String(nombre || '').trim()) j.nombre = String(nombre).trim().slice(0, 60);
  for (const p of j.personas || []) {
    const d = descripciones?.[p.rol];
    if (typeof d === 'string') p.descripcion = d.trim().slice(0, 600) || undefined;
  }
  escribirJSON(f, j);
  pedirSincronizacion();
  return leerAvatar(carpeta, id);
}

export function borrarAvatar(estilo, id) {
  const carpeta = carpetaDeEstilo(estilo);
  if (!carpeta || !ID.test(String(id || ''))) throw Object.assign(new Error('Avatar inválido.'), { status: 400 });
  fs.rmSync(path.join(DIR_AVATARES, carpeta, id), { recursive: true, force: true });
  pedirSincronizacion();
}

// ---------------------------------------------------------------- audios

const TIPOS_AUDIO = ['musica', 'voz', 'efecto'];

/** Los audios guardados (de un estilo y de "general", o de todos), los más nuevos primero. */
export function listarAudios(estilo) {
  if (!fs.existsSync(DIR_AUDIOS)) return [];
  const carpetas = estilo ? [carpetaDeEstilo(estilo), 'general'].filter(Boolean) : fs.readdirSync(DIR_AUDIOS).filter((e) => ID.test(e));
  const out = [];
  for (const c of carpetas) {
    const dir = path.join(DIR_AUDIOS, c);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const j = leerJSON(path.join(dir, f)) || {};
      const id = f.replace(/\.json$/, '');
      const sonido = fs.readdirSync(dir).find((x) => x.startsWith(`${id}.`) && AUDIO.test(x));
      if (!sonido) continue;
      out.push({
        id,
        nombre: String(j.nombre || id),
        estilo: c,
        tipo: TIPOS_AUDIO.includes(j.tipo) ? j.tipo : 'musica',
        creado: Number(j.creado) || fs.statSync(path.join(dir, sonido)).mtimeMs,
        ruta: rel(path.join(dir, sonido)),
        notas: j.notas ? String(j.notas) : '',
        origen: j.origen ? String(j.origen) : '',
      });
    }
  }
  return out.sort((a, b) => b.creado - a.creado);
}

export function audioPorId(estilo, id) {
  const c = carpetaDeEstilo(estilo) || (estilo === 'general' ? 'general' : null);
  return listarAudios().find((a) => a.estilo === c && a.id === id) || null;
}

/** Guarda un audio (subido o de un anuncio). Si ya hay uno igual (la misma huella), devuelve ese. */
export function guardarAudio({ estilo, nombre, tipo = 'musica', ruta, notas, origen }) {
  const carpeta = estilo === 'general' ? 'general' : carpetaDeEstilo(estilo);
  if (!carpeta) throw Object.assign(new Error('Elige el estilo del audio.'), { status: 400 });
  const desde = origenSeguro(ruta);
  if (!desde || !AUDIO.test(desde)) throw Object.assign(new Error('No encontré ese audio.'), { status: 400 });
  const huella = crypto.createHash('sha1').update(fs.readFileSync(desde)).digest('hex');
  const dir = path.join(DIR_AUDIOS, carpeta);
  for (const a of listarAudios(carpeta).filter((x) => x.estilo === carpeta)) {
    try {
      if (crypto.createHash('sha1').update(fs.readFileSync(path.join(RAIZ, a.ruta))).digest('hex') === huella) return a;
    } catch {
      /* uno que no se lee no frena */
    }
  }
  const id = idNuevo(nombre, 'musica');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(desde, path.join(dir, `${id}${path.extname(desde).toLowerCase()}`));
  escribirJSON(path.join(dir, `${id}.json`), {
    id,
    nombre: String(nombre || '').trim().slice(0, 80) || 'Música',
    estilo: carpeta,
    tipo: TIPOS_AUDIO.includes(tipo) ? tipo : 'musica',
    creado: Date.now(),
    ...(origen ? { origen: String(origen).slice(0, 200) } : {}),
    ...(notas ? { notas: String(notas).slice(0, 400) } : {}),
  });
  pedirSincronizacion();
  return listarAudios(carpeta).find((a) => a.id === id && a.estilo === carpeta);
}

export function borrarAudio(estilo, id) {
  const carpeta = estilo === 'general' ? 'general' : carpetaDeEstilo(estilo);
  if (!carpeta || !ID.test(String(id || ''))) throw Object.assign(new Error('Audio inválido.'), { status: 400 });
  const dir = path.join(DIR_AUDIOS, carpeta);
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) if (f.startsWith(`${id}.`)) fs.rmSync(path.join(dir, f), { force: true });
  pedirSincronizacion();
}

// ---------------------------------------------------------------- los personajes de los anuncios de referencia

/**
 * Los personajes de los subestilos de un estilo (su retrato sin texto, cómo son y su prompt de hoja), para hacer un
 * avatar "como en un anuncio de referencia". adjuntar=false: persona real filmada, su foto nunca va al generador.
 */
export function avataresDeReferencia(estilo) {
  const def = ESTILOS.find((e) => e.clave === estilo || e.skill === `anuncios-${estilo}`);
  if (!def) return [];
  const dir = path.join(SKILLS, def.skill, 'subestilos');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const j = leerJSON(path.join(dir, d.name, 'avatar', 'avatar.json'));
    if (!j) continue;
    for (const a of Array.isArray(j.avatares) ? j.avatares : []) {
      const archivo = path.basename(String(a.imagen || ''));
      const limpio = path.join(dir, d.name, 'avatar', 'limpio', archivo);
      const original = path.join(dir, d.name, 'avatar', archivo);
      const imagen = fs.existsSync(limpio) ? limpio : fs.existsSync(original) ? original : null;
      if (!imagen) continue;
      out.push({
        subestilo: d.name,
        rol: String(a.rol || ''),
        nombre: String(a.nombre || a.rol || 'Personaje'),
        adjuntar: Boolean(a.adjuntar),
        persona: a.persona === 'man' ? 'man' : 'woman',
        imagen: rel(imagen),
        como: Array.isArray(a.como) ? a.como.map(String) : [],
        prompt: String(a.prompt || '').replace(/\{persona\}/g, a.persona === 'man' ? 'man' : 'woman'),
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------- en un anuncio nuevo

/**
 * Copia las imágenes del avatar elegido a temp/<slug>/ref/avatar-<rol>.<ext> (la corre la app antes del guion) y
 * devuelve lo que la tarea del guion le dice a Claude. null si no hay avatar o ya no existe.
 */
export function prepararAvatar(slug, sel) {
  const a = sel?.id ? avatarPorId(sel.estilo, sel.id) : null;
  if (!a) return null;
  const dirRef = path.join(TEMP, slug, 'ref');
  fs.mkdirSync(dirRef, { recursive: true });
  const personas = a.personas.map((p) => {
    const ext = path.extname(p.imagen).toLowerCase() || '.png';
    const archivo = `ref/avatar-${p.rol}${ext}`;
    fs.copyFileSync(path.join(RAIZ, p.imagen), path.join(TEMP, slug, archivo));
    return { ...p, archivo };
  });
  return [
    '## Las personas: un avatar guardado',
    '',
    `El usuario eligió el avatar «${a.nombre}» de su biblioteca. Esas son las personas de este anuncio: no hagas casting, no sugieras búsquedas de Pinterest para ellas y no las reemplaces por las del subestilo. Mira cada imagen con Read antes de escribir.`,
    '',
    ...personas.map((p) => `- **${p.nombre}** (\`${p.rol}\`): \`temp/${slug}/${p.archivo}\`${p.descripcion ? ` — ${p.descripcion}` : ''}`),
    '',
    `- En el manifiesto, cada una va en "referencias" como referencia aportada: con su "id" (el rol de arriba, o el id que pida la skill) y su "archivo" (la ruta de arriba dentro de la carpeta del anuncio, por ejemplo \`"archivo": "${personas[0].archivo}"\`), sin "prompt": así no se genera ni se cobra. Si la skill genera primero la imagen base del personaje (la hoja, la persona sola, o el host B a partir del A), esa referencia aportada la reemplaza.`,
    '- Pásala en "referencias" de cada toma o B-roll donde aparece, y en cada prompt descríbela tal como se ve en su imagen: misma cara, pelo, edad, cuerpo y estilo de ropa en todo el anuncio. La ropa, el lugar y la luz de cada toma sí cambian según el guion.',
    (ROLES_AVATAR[a.estilo]?.extras || 0) > 0 ? '- Si el guion necesita otros personajes además de estos, créalos tú como siempre.' : null,
    `- Cuéntalo en "decisiones" ("las personas son las del avatar «${a.nombre}»: su imagen no se paga").`,
  ]
    .filter((l) => l !== null)
    .join('\n');
}

/** Copia la música elegida de la biblioteca a temp/<slug>/musica/ (el motor usa esa y no genera otra). */
export function prepararMusica(slug, sel) {
  const a = sel?.id ? audioPorId(sel.estilo, sel.id) : null;
  if (!a) return null;
  const dir = path.join(TEMP, slug, 'musica');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (AUDIO.test(f)) fs.rmSync(path.join(dir, f), { force: true });
  fs.copyFileSync(path.join(RAIZ, a.ruta), path.join(dir, `fondo${path.extname(a.ruta).toLowerCase()}`));
  return a;
}

/**
 * Al terminar un anuncio: guarda sola en la biblioteca la música de fondo que se generó para él (no las pistas fijas
 * de recursos/ ni la que ya salió de la biblioteca). Nunca lanza.
 */
export function guardarMusicaDelAnuncio(slug, brief) {
  try {
    if (!brief?.estilo || brief.musicaBiblioteca?.id) return null;
    const dir = path.join(TEMP, slug, 'musica');
    const f = fs.existsSync(dir) ? fs.readdirSync(dir).find((x) => /^fondo\.(mp3|wav|m4a)$/i.test(x)) : null;
    if (!f) return null;
    const abs = path.join(dir, f);
    const fijas = path.join(RAIZ, 'recursos', 'musica');
    const huella = (x) => crypto.createHash('sha1').update(fs.readFileSync(x)).digest('hex');
    const h = huella(abs);
    if (fs.existsSync(fijas) && fs.readdirSync(fijas).some((x) => AUDIO.test(x) && huella(path.join(fijas, x)) === h)) return null;
    const producto = String(brief.productoId || '').replace(/-[a-z0-9]{4}$/, '').slice(0, 40);
    return guardarAudio({ estilo: brief.estilo, nombre: `${producto || slug} · ${claveDeCarpeta(carpetaDeEstilo(brief.estilo)) || brief.estilo}`, ruta: rel(abs), origen: `temp/${slug}/musica/${f}` });
  } catch (e) {
    console.warn(`[biblioteca] no pude guardar la música de ${slug} (${e.message})`);
    return null;
  }
}

/**
 * Las hojas de los personajes de un anuncio (para guardarlas como avatar): las referencias del manifiesto que no son
 * el producto y tienen su imagen en img/ o ref/.
 */
export function personajesDelAnuncio(slug) {
  const m = leerJSON(path.join(TEMP, slug, 'manifiesto.json'));
  if (!m) return [];
  const refs = Array.isArray(m.referencias) ? m.referencias : [];
  const out = [];
  for (const r of refs) {
    if (!r || typeof r.id !== 'string' || /producto|frasco|envase|logo/i.test(r.id) || r.es_producto) continue;
    const candidatos = [r.archivo, `img/${r.id}.png`, `img/${r.id}.jpg`, `ref/${r.id}.png`].filter(Boolean);
    const archivo = candidatos.find((c) => fs.existsSync(path.join(TEMP, slug, c)) && IMAGEN.test(c));
    if (archivo) out.push({ id: r.id, imagen: `temp/${slug}/${archivo}`, descripcion: String(r.prompt || r.descripcion || '').slice(0, 600) });
  }
  return out;
}

// ---------------------------------------------------------------- imágenes y clips (los llena IA-VID-AUTOMATIC y el motor)

const leerCarpetaJson = (base, carpeta, alArmar) => {
  const dir = path.join(base, carpeta);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const j = leerJSON(path.join(dir, f)) || {};
      return alArmar(dir, f.replace(/\.json$/, ''), j);
    })
    .filter(Boolean);
};

/** Las imágenes reutilizables (imagenes/<estilo>/<id>.png + .json), las más nuevas primero. */
export function listarImagenes() {
  const base = path.join(DIR_BIBLIOTECA, 'imagenes');
  if (!fs.existsSync(base)) return [];
  const out = [];
  for (const c of fs.readdirSync(base).filter((e) => ID.test(e))) {
    out.push(
      ...leerCarpetaJson(base, c, (dir, id, j) => {
        const img = fs.readdirSync(dir).find((x) => x.startsWith(`${id}.`) && IMAGEN.test(x));
        if (!img) return null;
        return { id, estilo: c, nombre: String(j.nombre || id), tipo: String(j.tipo || 'otro'), producto: j.producto ? String(j.producto) : '', prompt: j.prompt ? String(j.prompt) : '', creado: Number(j.creado) || 0, ruta: rel(path.join(dir, img)) };
      })
    );
  }
  return out.sort((a, b) => b.creado - a.creado);
}

/** Los clips guardados (clips/<estilo>/<id>.json + su primer fotograma .png; el .mp4 solo en este computador). */
export function listarClips() {
  const base = path.join(DIR_BIBLIOTECA, 'clips');
  if (!fs.existsSync(base)) return [];
  const out = [];
  for (const c of fs.readdirSync(base).filter((e) => ID.test(e))) {
    out.push(
      ...leerCarpetaJson(base, c, (dir, id, j) => {
        const png = fs.existsSync(path.join(dir, `${id}.png`)) ? rel(path.join(dir, `${id}.png`)) : null;
        const mp4 = fs.existsSync(path.join(dir, `${id}.mp4`)) ? rel(path.join(dir, `${id}.mp4`)) : null;
        if (!png && !mp4) return null;
        return { id, estilo: c, nombre: String(j.nombre || id), tipo: String(j.tipo || 'clip'), producto: j.producto ? String(j.producto) : '', duracion: Number(j.duracion) || null, creado: Number(j.creado) || 0, imagen: png, video: mp4 };
      })
    );
  }
  return out.sort((a, b) => b.creado - a.creado);
}

/** Borra una imagen o un clip de la biblioteca (todos sus archivos con ese id). */
export function borrarDeCarpeta(clase, estilo, id) {
  if (!['imagenes', 'clips'].includes(clase) || !ID.test(String(estilo || '')) || !ID.test(String(id || ''))) throw Object.assign(new Error('Inválido.'), { status: 400 });
  const dir = path.join(DIR_BIBLIOTECA, clase, estilo);
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) if (f.startsWith(`${id}.`)) fs.rmSync(path.join(dir, f), { force: true });
  pedirSincronizacion();
}

// ---------------------------------------------------------------- aprendizajes y preferencias (para verlos y editarlos)

const DIR_APR = path.join(DIR_BIBLIOTECA, 'aprendizajes');
const ARCHIVO_PREFERENCIAS = path.join(RAIZ, 'mis_archivos', 'preferencias.md');

/** Tus preferencias, general.md, uno por estilo y la bitácora, en ese orden. */
export function listarAprendizajes() {
  const lista = [];
  const agregar = (nombre, abs, clase) => {
    try {
      const st = fs.statSync(abs);
      lista.push({ nombre, clase, texto: fs.readFileSync(abs, 'utf8').replace(/^﻿/, ''), fecha: st.mtime.toISOString() });
    } catch {
      /* no existe todavía */
    }
  };
  agregar('preferencias.md', ARCHIVO_PREFERENCIAS, 'preferencias');
  agregar('general.md', path.join(DIR_APR, 'general.md'), 'general');
  const otros = fs.existsSync(DIR_APR) ? fs.readdirSync(DIR_APR).filter((f) => /^[a-z0-9-]+\.md$/.test(f) && !['general.md', 'generaciones.md'].includes(f)).sort() : [];
  for (const f of otros) agregar(f, path.join(DIR_APR, f), 'estilo');
  agregar('generaciones.md', path.join(DIR_APR, 'generaciones.md'), 'bitacora');
  return lista;
}

/** Guarda uno (lo escribe el usuario desde la app). */
export function guardarAprendizaje(nombre, texto) {
  if (!/^[a-z0-9-]+\.md$/.test(String(nombre || ''))) throw Object.assign(new Error('Nombre inválido.'), { status: 400 });
  if (typeof texto !== 'string' || texto.length > 400000) throw Object.assign(new Error('Ese texto no se puede guardar.'), { status: 400 });
  const abs = nombre === 'preferencias.md' ? ARCHIVO_PREFERENCIAS : path.join(DIR_APR, nombre);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, texto.endsWith('\n') ? texto : `${texto}\n`, 'utf8');
  if (nombre !== 'preferencias.md') pedirSincronizacion();
}

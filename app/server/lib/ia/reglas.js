// Las reglas de permisos de Claude (Read(...), Write(...), Edit(...), Bash(...)) leidas para una IA que trabaja sin
// herramientas (Codex): la app decide por ella que se le pasa para leer, que archivos guarda y que comandos corre.
// Hay un solo idioma de permisos, el de Claude (claude.js:prohibidasComunes y lo que arma cada tarea): aca se lee tal
// cual, no se reescribe. Encima van las reglas fijas, que valen aunque una tarea se olvide de alguna prohibicion:
//   leer      nunca .env*, auth.json, config.toml, credentials*, .git/, app/config.json, ~/.codex ni el CODEX_HOME
//   escribir  solo .json, .md o .txt dentro de temp/<carpeta>/; nada que empiece con punto, ni produccion/, remotion/,
//             node_modules/ ni package.json; en un anuncio nunca modelos.json, estado.json, img/, video/, audio/,
//             musica/, qa/ ni efectos/ (deciden que se cobra y que produce el motor); en un producto nunca producto.json
// Las rutas se comparan pasadas a NFC y, en Windows y en Mac, sin mayusculas (D:\ contra d:\, una ñ compuesta contra
// una separada), y despues de resolver los enlaces: realpath de la carpeta mas cercana que existe, dentro de
// realpath(RAIZ). Asi un enlace dentro de temp/ no lleva a otro lado.
//
//   traducir(permitidas, prohibidas, { raiz, home, codexHome }) -> { puedeLeer, puedeEscribir, comandos,
//     comandoPermitido, describirEscribible, describirComandos, raiz, raizReal }
//   aplicarEdiciones(textoActual, ediciones) -> { ok, texto, error, indice, veces }   (la regla del Edit de Claude)
//   prohibidasDeAnuncio(slug) · prohibidasDeProducto(carpetaRel)   (las prohibiciones nuevas, para las dos IA)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RAIZ } from '../rutas.js';

const WIN = process.platform === 'win32';
/** En Windows y en Mac el disco no distingue mayusculas: las rutas se comparan sin ellas. */
export const SIN_MAYUSCULAS = WIN || process.platform === 'darwin';

export const EXT_TEXTO = ['.json', '.md', '.txt', '.csv', '.srt', '.vtt', '.tsv'];
export const EXT_IMAGEN = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
export const EXT_VIDEO = ['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi'];
/** Lo unico que se guarda: los manifiestos y los JSON de la app, lineas.txt y datos-editor.md (las 24 tareas). */
export const EXT_ESCRIBIBLE = ['.json', '.md', '.txt'];
export const TOPE_ESCRITURA_ARCHIVO = 1.5 * 1024 * 1024; // un archivo
export const TOPE_ESCRITURA_MENSAJE = 4 * 1024 * 1024; // todo lo que guarda un mensaje

export const MOTIVO_VIDEO = 'No te puedo mandar videos: mira los cuadros que ya están en `qa/`';
const NO_LEER = 'tu tarea no puede leer ese archivo';
const NO_ESCRIBIR = 'tu tarea no puede escribir ese archivo';
const NO_COMANDO = 'tu tarea no tiene ese comando';

// Dentro de la carpeta de un anuncio (temp/<slug>/): lo que decide que se cobra y que produce el motor. modelos.json
// lo copia la app al crear el anuncio (anuncios-nuevos.js:245) y en img/ y video/ estan los log-modelos.json de los
// que sale el gasto (gasto.js:3). Ninguna de las 24 tareas escribe ahi.
const ARCHIVOS_DEL_MOTOR = ['modelos.json', 'estado.json'];
const CARPETAS_DEL_MOTOR = ['img', 'video', 'audio', 'musica', 'qa', 'efectos'];
const DEL_PROGRAMA = ['produccion', 'remotion', 'node_modules'];

// CON, NUL, AUX, COM1… (tambien con extension: con.txt): Windows no deja usarlos y leerlos puede colgar.
const RESERVADO = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³]|conin\$|conout\$|clock\$)(\..*)?$/i;

// ---------------------------------------------------------------- rutas

export const nfc = (s) => String(s ?? '').normalize('NFC');
const aPosix = (s) => String(s ?? '').replace(/\\/g, '/');
// Sin mayusculas como el disco: pasando por la mayuscula, asi la ſ cuenta como s y la ı como i (NTFS y APFS las
// toman por la misma letra).
const pliegue = (s) => nfc(s).toUpperCase().toLowerCase();
/** Como se compara una ruta: NFC y, en Windows y Mac, sin mayusculas. */
export const clave = (s) => (SIN_MAYUSCULAS ? pliegue(s) : nfc(s));
/** La clave de una ruta relativa (para no repetir ni mandar dos veces lo mismo). */
export const claveDeRuta = (rel) => clave(aPosix(rel).replace(/^(\.\/)+/, '').replace(/\/+$/, ''));
/** Una ruta absoluta del sistema en la forma de las reglas: /d:/x/y en Windows, /x/y en Mac. */
function absPosix(abs) {
  const s = nfc(aPosix(path.resolve(abs)));
  return /^[A-Za-z]:\//.test(s) ? `/${s}` : s;
}
/** a esta dentro de b (o es b), con la comparacion de arriba. */
function dentroDe(a, b) {
  const A = clave(aPosix(a)).replace(/\/+$/, '');
  const B = clave(aPosix(b)).replace(/\/+$/, '');
  return A === B || A.startsWith(`${B}/`);
}
function statSeguro(p, l = false) {
  try {
    return l ? fs.lstatSync(p) : fs.statSync(p);
  } catch {
    return null;
  }
}
function realpath(p) {
  try {
    return fs.realpathSync.native(p);
  } catch (e) {
    if (e.code === 'ENOENT') throw e;
    return fs.realpathSync(p);
  }
}

/** 'texto' | 'imagen' | 'video' | 'otro', por la extension. */
export function tipoDeArchivo(ruta) {
  const ext = path.extname(String(ruta || '')).toLowerCase();
  if (EXT_TEXTO.includes(ext)) return 'texto';
  if (EXT_IMAGEN.includes(ext)) return 'imagen';
  if (EXT_VIDEO.includes(ext)) return 'video';
  return 'otro';
}

/**
 * Donde guarda la app la sesion de Codex (§2.2 del diseño). Lo define codex.js; esto es lo mismo, para no leer nunca
 * ahi aunque quien llame a traducir() no lo pase. AIA_CODEX_HOME manda (las pruebas).
 */
export function codexHomeDeLaApp() {
  if (process.env.AIA_CODEX_HOME) return path.resolve(process.env.AIA_CODEX_HOME);
  if (WIN) return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'AnunciosConIA', 'codex-home');
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'AnunciosConIA', 'codex-home');
  return path.join(os.homedir(), '.local', 'share', 'AnunciosConIA', 'codex-home');
}

/** Lo que sigue a la raiz en una ruta que empieza con ella (por tramos: las mayusculas pueden cambiar el largo). */
export const sinRaiz = (p, raizPosix) => p.split('/').slice(raizPosix.split('/').length).join('/');

const no = (rel, motivo, extra = {}) => ({ ok: false, rel: rel ?? null, abs: extra.abs ?? null, motivo });

/**
 * La forma de una ruta que pide o devuelve la IA: \ pasa a /, sin ./ al principio; si es absoluta tiene que caer
 * dentro de la raiz y pasa a relativa (voz en off da rutas absolutas). Nunca .., NUL, ~, otra unidad, un nombre que
 * termine en punto o en espacio, : (los flujos de NTFS) ni un nombre reservado de Windows.
 */
function normalizar(ruta, ctx) {
  if (typeof ruta !== 'string') return no(null, 'eso no es una ruta');
  let p = nfc(ruta).trim();
  if (!p) return no(p, 'la ruta está vacía');
  if (/[\u0000-\u001f]/.test(p)) return no(p, 'la ruta tiene un carácter que no vale');
  p = aPosix(p);
  if (p.includes('~')) return no(p, 'no puede llevar «~»: la carpeta del usuario no se toca');
  let rel;
  if (/^\/[A-Za-z]:(\/|$)/.test(p)) p = p.slice(1); // /d:/x, la forma de las reglas
  if (/^[A-Za-z]:(\/|$)/.test(p) || p.startsWith('/')) {
    if (p.startsWith('//')) return no(p, 'está fuera de la carpeta de la app');
    const kP = clave(p);
    const kB = clave(ctx.raizPosix);
    if (kP === kB) rel = '';
    else if (kP.startsWith(`${kB}/`)) rel = sinRaiz(p, ctx.raizPosix);
    else if (/^[A-Za-z]:/.test(p) && clave(p.slice(0, 2)) !== clave(ctx.raizPosix.slice(0, 2))) return no(p, 'está en otra unidad, fuera de la carpeta de la app');
    else return no(p, 'está fuera de la carpeta de la app');
  } else if (/^[A-Za-z]:/.test(p)) {
    return no(p, 'está en otra unidad, fuera de la carpeta de la app');
  } else {
    rel = p;
  }
  const segs = [];
  for (const s of rel.split('/')) {
    if (s === '' || s === '.') continue;
    if (s === '..') return no(p, 'no puede subir de carpeta con «..»');
    if (/[. ]$/.test(s)) return no(p, 'un nombre no puede terminar en punto ni en espacio');
    if (/[<>:"|?*]/.test(s)) return no(p, 'un nombre no puede llevar < > : " | ? *');
    if (RESERVADO.test(s)) return no(p, 'CON, NUL, AUX, COM1… son nombres que Windows no deja usar');
    segs.push(s);
  }
  rel = segs.join('/');
  return { ok: true, rel, abs: segs.length ? path.join(ctx.raiz, ...segs) : ctx.raiz, segs };
}

/**
 * Resuelve los enlaces: realpath de la carpeta (o archivo) mas cercana que existe, y tiene que quedar dentro de
 * realpath(RAIZ). Devuelve tambien los tramos reales, relativos a la raiz, para mirar las reglas sobre ellos.
 */
function resolverReal(abs, ctx) {
  let p = abs;
  const resto = [];
  while (!statSeguro(p, true)) {
    const padre = path.dirname(p);
    if (padre === p) return { ok: false, motivo: 'no existe ninguna carpeta de esa ruta' };
    resto.unshift(path.basename(p));
    p = padre;
  }
  let real;
  try {
    real = realpath(p);
  } catch {
    return { ok: false, motivo: 'esa ruta pasa por un enlace que no lleva a ningún lado' };
  }
  if (resto.length && !statSeguro(real)?.isDirectory()) return { ok: false, motivo: 'esa ruta pasa por un archivo, no por una carpeta' };
  const absReal = resto.length ? path.join(real, ...resto) : real;
  if (!dentroDe(absReal, ctx.raizReal)) return { ok: false, motivo: 'esa ruta lleva fuera de la carpeta de la app (por un enlace)' };
  const relReal = aPosix(path.relative(ctx.raizReal, absReal));
  const segsReal = relReal ? relReal.split('/').map(nfc) : [];
  // la misma ruta real, puesta sobre la raiz tal como la nombran las reglas (por si la raiz misma es un enlace)
  return { ok: true, absReal, segsReal, absSobreRaiz: segsReal.length ? path.join(ctx.raiz, ...segsReal) : ctx.raiz };
}

/** Lo que no se lee nunca, diga lo que diga la tarea. carpeta: la ruta es una carpeta. null = nada que decir. */
function fijaDeLectura(segs, { carpeta = false } = {}) {
  const b = segs.map(pliegue);
  // .env* y .git en cualquier tramo (ningun anuncio ni producto empieza con punto)
  for (const s of b) {
    if (s.startsWith('.env')) return 'es un archivo de claves (.env): no se lee nunca';
    if (s === '.git') return 'es de git: no se lee';
  }
  // los demas, por el nombre del archivo (§2.6): la carpeta de un producto «Credentials …» se lee como cualquier otra
  const nombre = carpeta ? '' : b[b.length - 1] || '';
  if (nombre === 'auth.json' || nombre === 'config.toml' || nombre.startsWith('credentials') || nombre === '.npmrc' || nombre === '.netrc') return 'puede tener una sesión o una clave: no se lee nunca';
  const rel = b.join('/');
  if (rel === 'app/config.json' || /^temp\/_modo-prueba[^/]*\/config\.json$/.test(rel)) return 'son los ajustes de la app: no se leen';
  return null;
}

/** Lo que no se escribe nunca, diga lo que diga la tarea (§2.10, punto 4). null = nada que decir. */
function fijaDeEscritura(segs) {
  const b = segs.map(pliegue);
  if (b.some((s) => s.startsWith('.'))) return 'nada que empiece con punto (.env, .claude…) se escribe';
  if (b.some((s) => DEL_PROGRAMA.includes(s))) return 'esa carpeta es del programa: no se escribe';
  const nombre = b[b.length - 1] || '';
  if (nombre === 'package.json' || nombre === 'package-lock.json') return 'package.json es del programa: no se escribe';
  if (b[0] !== 'temp' || b.length < 3) return 'solo se escribe dentro de la carpeta de un anuncio, de un lote o de un producto (temp/…)';
  if (b[1] === '_productos') {
    if (b.length === 4 && nombre === 'producto.json') return 'producto.json lo escribe la app (la ficha va en ficha.json)';
    return null;
  }
  if (b.length === 3 && ARCHIVOS_DEL_MOTOR.includes(nombre)) return `${segs[2]} decide qué se cobra y qué se produce: lo escribe la app`;
  if (b.length > 3 && CARPETAS_DEL_MOTOR.includes(b[2])) return `lo que está en ${segs[2]}/ lo escribe la app (decide qué se cobra y qué se produce)`;
  return null;
}

// ---------------------------------------------------------------- las reglas de Claude

/** "Read(./temp/x/**)" -> { herramienta: 'Read', esp: './temp/x/**' }; "Glob" -> { herramienta: 'Glob', esp: null }. */
function leerRegla(r) {
  const m = /^\s*([A-Za-z]+)\s*(?:\(([\s\S]*)\))?\s*$/.exec(String(r ?? ''));
  return m ? { herramienta: m[1], esp: m[2] === undefined ? null : m[2] } : null;
}

/**
 * El patron de una regla, como ruta absoluta en la forma /d:/x (Windows) o /x (Mac):
 *   ./x, /x o x  desde la raiz      //x  absoluta (en Windows //c:/x)      ~/x  la carpeta del usuario
 */
function patronDe(esp, ctx) {
  const p = nfc(aPosix(String(esp).trim()));
  let abs;
  if (p.startsWith('//')) abs = p.slice(1);
  else if (p === '~' || p.startsWith('~/')) abs = absPosix(ctx.home) + p.slice(1);
  else abs = `${absPosix(ctx.raiz)}/${p.replace(/^(\.\/)+/, '').replace(/^\.$/, '').replace(/^\/+/, '')}`;
  abs = abs.replace(/\/{2,}/g, '/').replace(/(.)\/$/, '$1');
  return { esp, abs, clave: clave(abs) };
}

const regexes = new Map();
const escRe = (s) => s.replace(/[.+^${}()|[\]\\*?]/g, '\\$&');
/** ** = cualquier cantidad de carpetas (tambien ninguna), * = cualquier parte de un nombre. */
function globARegex(g) {
  let re = regexes.get(g);
  if (re) return re;
  let s = '';
  for (let i = 0; i < g.length; ) {
    if (g.startsWith('/**/', i)) {
      s += '(?:/.*)?/';
      i += 4;
    } else if (g.startsWith('/**', i) && i + 3 === g.length) {
      s += '(?:/.*)?';
      i += 3;
    } else if (g.startsWith('**', i)) {
      s += '.*';
      i += 2;
    } else {
      const c = g[i++];
      s += c === '*' ? '[^/]*' : c === '?' ? '[^/]' : escRe(c);
    }
  }
  re = new RegExp(`^${s}$`, 'su');
  regexes.set(g, re);
  return re;
}
const coincide = (patrones, k) => patrones.some((p) => globARegex(p.clave).test(k));

/** Un comando en una sola forma: \ pasa a / y los espacios juntos cuentan como uno. */
export const normalizarComando = (c) => String(c ?? '').replace(/\\/g, '/').replace(/\s+/g, ' ').trim();

/**
 * Las reglas de una sesion (o.permitidas y o.prohibidas, las mismas que recibe Claude), traducidas.
 * opciones: raiz (por defecto RAIZ), home (la carpeta del usuario), codexHome (la sesion de Codex de la app).
 */
export function traducir(permitidas = [], prohibidas = [], opciones = {}) {
  const raiz = path.resolve(opciones.raiz || RAIZ);
  const home = path.resolve(opciones.home || os.homedir());
  const codexHome = path.resolve(opciones.codexHome || codexHomeDeLaApp());
  let raizReal;
  try {
    raizReal = realpath(raiz);
  } catch {
    raizReal = raiz;
  }
  const ctx = { raiz, raizPosix: nfc(aPosix(raiz)).replace(/(.)\/+$/, '$1'), raizReal, home };
  // las sesiones de una IA: nunca se lee ni se escribe ahi (la de la app y la del usuario)
  const sesiones = [codexHome, path.join(home, '.codex')];
  const enSesion = (...ps) => ps.some((p) => p && sesiones.some((s) => dentroDe(p, s)));

  const leer = { permitir: [], prohibir: [], todo: false };
  const escribir = { permitir: [], prohibir: [], todo: false };
  const terminal = { lista: [], prohibir: [], sinShell: new Set() };
  const ES_ESCRITURA = ['Write', 'Edit', 'MultiEdit'];
  const ES_TERMINAL = ['Bash', 'PowerShell'];

  for (const r of Array.isArray(permitidas) ? permitidas : []) {
    const x = leerRegla(r);
    if (!x || x.esp === null) continue; // Glob, Grep, TodoWrite…: no dan rutas
    if (x.herramienta === 'Read') leer.permitir.push(patronDe(x.esp, ctx));
    else if (ES_ESCRITURA.includes(x.herramienta)) escribir.permitir.push(patronDe(x.esp, ctx)); // Edit vale tambien para Write
    else if (ES_TERMINAL.includes(x.herramienta) && !x.esp.includes('*')) {
      const c = normalizarComando(x.esp);
      if (!c) continue;
      let e = terminal.lista.find((y) => y.comando === c);
      if (!e) terminal.lista.push((e = { comando: c, shells: new Set() }));
      e.shells.add(x.herramienta);
    }
  }
  for (const r of Array.isArray(prohibidas) ? prohibidas : []) {
    const x = leerRegla(r);
    if (!x) continue;
    if (x.esp === null) {
      if (x.herramienta === 'Read') leer.todo = true;
      if (ES_ESCRITURA.includes(x.herramienta)) escribir.todo = true;
      if (ES_TERMINAL.includes(x.herramienta)) terminal.sinShell.add(x.herramienta);
      continue;
    }
    if (x.herramienta === 'Read') leer.prohibir.push(patronDe(x.esp, ctx));
    else if (ES_ESCRITURA.includes(x.herramienta)) escribir.prohibir.push(patronDe(x.esp, ctx));
    else if (ES_TERMINAL.includes(x.herramienta)) {
      const c = normalizarComando(x.esp);
      terminal.prohibir.push({ shell: x.herramienta, exacto: c.includes('*') ? null : c, re: c.includes('*') ? new RegExp(`^${c.split('*').map(escRe).join('.*')}$`, 's') : null });
    }
  }

  const claves = (n, r) => [clave(absPosix(n.abs)), clave(absPosix(r.absSobreRaiz))];

  /** Si la IA puede leer esta ruta: { ok, rel, abs, tipo: 'texto'|'imagen'|'carpeta', existe, bytes, motivo }. */
  function puedeLeer(ruta) {
    const n = normalizar(ruta, ctx);
    if (!n.ok) return n;
    const extra = { abs: n.abs };
    const carpeta = Boolean(statSeguro(n.abs)?.isDirectory());
    const fija = fijaDeLectura(n.segs, { carpeta });
    if (fija) return no(n.rel, fija, extra);
    const r = resolverReal(n.abs, ctx);
    if (!r.ok) return no(n.rel, r.motivo, extra);
    const fijaReal = fijaDeLectura(r.segsReal, { carpeta });
    if (fijaReal) return no(n.rel, fijaReal, extra);
    if (enSesion(n.abs, r.absReal)) return no(n.rel, 'es la sesión de tu IA: no se lee', extra);
    if (leer.todo) return no(n.rel, NO_LEER, extra);
    const [kA, kR] = claves(n, r);
    if (!coincide(leer.permitir, kA) || !coincide(leer.permitir, kR)) return no(n.rel, NO_LEER, extra);
    if (coincide(leer.prohibir, kA) || coincide(leer.prohibir, kR)) return no(n.rel, NO_LEER, extra);
    const st = statSeguro(n.abs);
    const tipo = st?.isDirectory() ? 'carpeta' : tipoDeArchivo(n.rel);
    if (tipo === 'video') return no(n.rel, MOTIVO_VIDEO, extra);
    if (tipo === 'otro') return no(n.rel, 'no te puedo mandar ese tipo de archivo: solo textos (.json, .md, .txt…) e imágenes', extra);
    return { ok: true, rel: n.rel, abs: n.abs, tipo, existe: Boolean(st), bytes: st && !st.isDirectory() ? st.size : null, motivo: null };
  }

  /**
   * Si la app puede guardar lo que devolvio la IA en esta ruta: { ok, rel, abs, existe, motivo }. Los 6 controles de
   * §2.10: la forma, el tipo, las reglas de la tarea, las reglas fijas, sin escaparse por un enlace y el tamaño
   * (opciones.bytes, si se sabe).
   */
  function puedeEscribir(ruta, { bytes = null } = {}) {
    const n = normalizar(ruta, ctx);
    if (!n.ok) return n;
    const extra = { abs: n.abs };
    if (!n.rel) return no(n.rel, 'esa es la carpeta de la app, no un archivo', extra);
    if (!EXT_ESCRIBIBLE.includes(path.posix.extname(n.rel).toLowerCase())) return no(n.rel, 'solo se guardan archivos .json, .md o .txt', extra);
    const fija = fijaDeEscritura(n.segs);
    if (fija) return no(n.rel, fija, extra);
    const r = resolverReal(n.abs, ctx);
    if (!r.ok) return no(n.rel, r.motivo, extra);
    const fijaReal = fijaDeEscritura(r.segsReal);
    if (fijaReal) return no(n.rel, fijaReal, extra);
    if (enSesion(n.abs, r.absReal)) return no(n.rel, 'es la sesión de tu IA: no se escribe', extra);
    if (escribir.todo) return no(n.rel, NO_ESCRIBIR, extra);
    const [kA, kR] = claves(n, r);
    if (!coincide(escribir.permitir, kA) || !coincide(escribir.permitir, kR)) return no(n.rel, NO_ESCRIBIR, extra);
    if (coincide(escribir.prohibir, kA) || coincide(escribir.prohibir, kR)) return no(n.rel, `${NO_ESCRIBIR}: es de la app`, extra);
    const st = statSeguro(n.abs);
    if (st?.isDirectory()) return no(n.rel, 'esa ruta es una carpeta', extra);
    if (bytes != null && Number(bytes) > TOPE_ESCRITURA_ARCHIVO) return no(n.rel, 'pesa más de 1,5 MB: es demasiado para un archivo de la tarea', extra);
    return { ok: true, rel: n.rel, abs: n.abs, existe: Boolean(st), motivo: null };
  }

  /**
   * Si la app corre este comando por la IA: { ok, comando, script, args, motivo }. Solo si, pasado a la forma de
   * normalizarComando, es igual a uno de la lista blanca (las Bash(...)/PowerShell(...) sin * de permitidas), ninguna
   * prohibicion lo tapa, empieza con `node produccion/` y el archivo existe.
   */
  function comandoPermitido(cmd) {
    const c = normalizarComando(cmd);
    if (!c) return { ok: false, comando: c, script: null, args: [], motivo: 'el comando está vacío' };
    const e = terminal.lista.find((x) => x.comando === c);
    const tapado = (shell) => terminal.sinShell.has(shell) || terminal.prohibir.some((p) => p.shell === shell && (p.exacto !== null ? p.exacto === c : p.re.test(c)));
    if (!e || ![...e.shells].some((s) => !tapado(s))) return { ok: false, comando: c, script: null, args: [], motivo: NO_COMANDO };
    const m = /^node produccion\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:js|mjs|cjs))(?: (.+))?$/.exec(c);
    if (!m) return { ok: false, comando: c, script: null, args: [], motivo: NO_COMANDO };
    const st = statSeguro(path.join(raiz, 'produccion', m[1]));
    if (!st?.isFile()) return { ok: false, comando: c, script: null, args: [], motivo: 'ese comando no está en esta app' };
    return { ok: true, comando: c, script: m[1], args: m[2] ? m[2].split(' ') : [], motivo: null };
  }

  const comandos = terminal.lista.map((x) => x.comando).filter((c) => comandoPermitido(c).ok);

  /** La ruta de un patron, relativa a la raiz, para mostrarla; null si cae fuera (//**, ~/…). */
  function relDePatron(p) {
    const a = p.abs.replace(/^\/([A-Za-z]:)/, '$1');
    if (clave(a) === clave(ctx.raizPosix)) return '';
    if (!clave(a).startsWith(`${clave(ctx.raizPosix)}/`)) return null;
    return sinRaiz(a, ctx.raizPosix);
  }

  /** Lo que no se escribe dentro de una carpeta que la tarea deja escribir entera (son de la app). */
  function excepcionesEn(dir) {
    const out = [];
    const sumar = (x) => {
      if (x && !out.some((y) => clave(y) === clave(x))) out.push(x);
    };
    const k = `${clave(dir)}/`;
    for (const p of escribir.prohibir) {
      const rel = relDePatron(p);
      if (rel === null || !clave(rel).startsWith(k)) continue;
      const resto = rel.slice(dir.length + 1);
      sumar(resto.endsWith('/**') ? `${resto.slice(0, -3)}/` : resto);
    }
    const segs = dir.split('/').map(pliegue);
    if (segs.length === 2 && segs[0] === 'temp' && segs[1] !== '_productos') {
      for (const f of ARCHIVOS_DEL_MOTOR) sumar(f);
      for (const d of CARPETAS_DEL_MOTOR) sumar(`${d}/`);
    }
    if (segs.length === 3 && segs[0] === 'temp' && segs[1] === '_productos') sumar('producto.json');
    return out;
  }

  /** «LO QUE PUEDES ESCRIBIR», en palabras simples (final de §2.10). */
  function describirEscribible() {
    const lineas = [];
    const vistos = new Set();
    for (const p of escribir.permitir) {
      if (vistos.has(p.clave)) continue; // Write y Edit de la misma ruta: una sola linea
      vistos.add(p.clave);
      const rel = relDePatron(p);
      if (rel === null || rel === '') continue;
      if (!/[*?]/.test(rel)) {
        if (puedeEscribir(rel).ok) lineas.push(`- \`${rel}\``);
        continue;
      }
      const m = /^(.*)\/\*\*$/.exec(rel);
      if (m && !/[*?]/.test(m[1])) {
        if (fijaDeEscritura([...m[1].split('/'), 'x.json'])) continue;
        const menos = excepcionesEn(m[1]);
        lineas.push(`- cualquier archivo \`.json\`, \`.md\` o \`.txt\` dentro de \`${m[1]}/\`${menos.length ? `, menos: ${menos.map((x) => `\`${x}\``).join(', ')} (son de la app)` : ''}`);
        continue;
      }
      lineas.push(`- los archivos \`.json\`, \`.md\` o \`.txt\` que calzan con \`${rel}\` (\`*\` es cualquier parte de un nombre)`);
    }
    return lineas.length ? lineas.join('\n') : 'Nada: esta tarea no guarda archivos.';
  }

  /** «COMANDOS QUE LA APP CORRE POR TI»: los exactos, uno por linea, o «Ninguno.». */
  const describirComandos = () => (comandos.length ? comandos.map((c) => `- \`${c}\``).join('\n') : 'Ninguno.');

  return { puedeLeer, puedeEscribir, comandos, comandoPermitido, describirEscribible, describirComandos, raiz, raizReal, codexHome };
}

// ---------------------------------------------------------------- ediciones (la regla del Edit de Claude)

function contar(texto, buscar) {
  let n = 0;
  for (let i = texto.indexOf(buscar); i !== -1; i = texto.indexOf(buscar, i + 1)) n++;
  return n;
}

/**
 * Aplica las ediciones de UN archivo, en orden, cada una sobre el resultado de la anterior: todas o ninguna.
 * `buscar` tiene que aparecer exactamente una vez en el texto de ese momento (vacio no vale). Se compara tal cual; si
 * no aparece, trae \n y el archivo usa \r\n, se prueba una vez con \n pasado a \r\n (y el reemplazo igual).
 * -> { ok, texto (el nuevo, o el de antes si fallo), error, indice (desde 0, la que fallo), veces }
 */
export function aplicarEdiciones(textoActual, ediciones) {
  const original = String(textoActual ?? '');
  const falla = (indice, veces, error) => ({ ok: false, texto: original, error, indice, veces });
  const lista = Array.isArray(ediciones) ? ediciones : [];
  if (!lista.length) return falla(null, 0, 'no llegó ninguna edición');
  let texto = original;
  // Un archivo que es todo \r\n (los manifiestos de Windows) sigue siendo todo \r\n: los saltos nuevos de `reemplazar`
  // pasan a \r\n aunque `buscar` no tuviera ninguno (P0, punto 3: Codex agrego una linea con \n y el archivo quedo
  // mezclado). Es lo que hace el Edit de Claude, que respeta los saltos del archivo.
  const todoCRLF = original.includes('\r\n') && !/(^|[^\r])\n/.test(original);
  for (let i = 0; i < lista.length; i++) {
    const e = lista[i] || {};
    if (typeof e.buscar !== 'string' || e.buscar === '') return falla(i, 0, `la edición ${i + 1} tiene \`buscar\` vacío`);
    if (typeof e.reemplazar !== 'string') return falla(i, 0, `la edición ${i + 1} no trae \`reemplazar\``);
    let buscar = e.buscar;
    let reemplazar = todoCRLF ? e.reemplazar.replace(/\r?\n/g, '\r\n') : e.reemplazar;
    let veces = contar(texto, buscar);
    if (veces === 0 && buscar.includes('\n') && texto.includes('\r\n')) {
      const conCRLF = buscar.replace(/\r?\n/g, '\r\n');
      const v = contar(texto, conCRLF);
      if (v > 0) {
        buscar = conCRLF;
        reemplazar = reemplazar.replace(/\r?\n/g, '\r\n');
        veces = v;
      }
    }
    if (veces !== 1) return falla(i, veces, `la edición ${i + 1} busca un texto que aparece ${veces} ${veces === 1 ? 'vez' : 'veces'}`);
    const pos = texto.indexOf(buscar);
    texto = texto.slice(0, pos) + reemplazar + texto.slice(pos + buscar.length); // sin replace(): un $& queda tal cual
  }
  return { ok: true, texto, error: null, indice: null, veces: 1 };
}

// ---------------------------------------------------------------- un .json con saltos de linea de verdad

/**
 * Un .json que Codex devolvio con saltos de linea (o tabulaciones) de verdad DENTRO de un texto: JSON no los acepta
 * («Bad control character in string literal»; pruebas reales P2: el «Negative prompt:» del claymation, 3 de 3). Si el
 * archivo no se lee, pasa cada caracter de control que esta dentro de un texto a su escape (\n, \r, \t o \u00XX) y lo
 * vuelve a leer. Lo que esta fuera de los textos no se toca. -> { ok (se lee), texto (el arreglado si quedo bien),
 * arreglados (cuantos), error? (el de JSON.parse, si igual no se lee) }
 * Solo se queda con el arreglo si despues se lee: con una comilla suelta (27" sin escapar, un texto sin cerrar) el
 * recorrido cree que esta dentro de un texto cuando esta fuera y escaparia los saltos de linea de la estructura. En
 * ese caso devuelve el texto tal como llego, para que la correccion de Codex (con el error de JSON) caiga bien.
 */
export function arreglarJSON(texto) {
  const t = String(texto ?? '');
  const leer = (s) => {
    try {
      JSON.parse(s.replace(/^﻿/, ''));
      return null;
    } catch (e) {
      return String(e?.message || e);
    }
  };
  const antes = leer(t);
  if (!antes) return { ok: true, texto: t, arreglados: 0 };
  let out = '';
  let dentro = false;
  let escape = false;
  let n = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (!dentro) {
      if (c === '"') dentro = true;
      out += c;
    } else if (escape) {
      escape = false;
      out += c;
    } else if (c === '\\') {
      escape = true;
      out += c;
    } else if (c === '"') {
      dentro = false;
      out += c;
    } else if (c.charCodeAt(0) < 0x20) {
      n++;
      out += c === '\n' ? '\\n' : c === '\r' ? '\\r' : c === '\t' ? '\\t' : `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`;
    } else out += c;
  }
  if (!n) return { ok: false, texto: t, arreglados: 0, error: antes };
  const despues = leer(out);
  return despues ? { ok: false, texto: t, arreglados: 0, error: antes } : { ok: true, texto: out, arreglados: n };
}

// ---------------------------------------------------------------- las prohibiciones nuevas, para las dos IA

function carpetaRelValida(c) {
  const s = aPosix(c).replace(/^(\.\/)+/, '').replace(/\/+$/, '');
  if (!s || s.split('/').some((x) => !x || x === '.' || x === '..')) throw new Error(`Carpeta no válida para una regla: ${c}`);
  return s;
}

/**
 * Lo que ninguna IA escribe dentro de la carpeta de un anuncio, como reglas de Claude (se suman a las prohibidas del
 * guion, junto a SOLO_DE_LA_APP): ['Edit(./temp/<slug>/modelos.json)', 'Edit(./temp/<slug>/estado.json)',
 * 'Edit(./temp/<slug>/img/**)', …]. Una regla Edit vale tambien para Write.
 */
export function prohibidasDeAnuncio(slug) {
  const s = String(slug ?? '');
  if (!s || /[\\/]/.test(s) || s === '.' || s === '..') throw new Error(`Slug no válido para una regla: ${slug}`);
  const c = `./temp/${s}`;
  return [...ARCHIVOS_DEL_MOTOR.map((f) => `Edit(${c}/${f})`), ...CARPETAS_DEL_MOTOR.map((d) => `Edit(${c}/${d}/**)`)];
}

/** La ficha nunca pisa producto.json: ['Edit(./temp/_productos/<id>/producto.json)'] (carpetaRel = relProducto(id)). */
export function prohibidasDeProducto(carpetaRel) {
  return [`Edit(./${carpetaRelValida(carpetaRel)}/producto.json)`];
}

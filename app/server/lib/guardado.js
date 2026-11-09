// Guardado automático: todo lo que la app crea, cambia o borra queda en tu GitHub (el repositorio de esta carpeta),
// menos lo pesado (videos y audios), que va a tu Google Drive si lo tienes instalado en el computador.
//
//   GitHub   cada 2 minutos, si algo cambió: git add -A (respeta .gitignore) + commit + push. Lo que se borró también
//            se registra (el commit lo dice), y en el historial de GitHub siempre se puede recuperar.
//            Un archivo de más de 45 MB nunca se sube (GitHub los rechaza): se anota en .git/info/exclude.
//   Drive    los videos y audios (temp/<anuncio>/video, audio, musica y los MP4 de output/) se COPIAN a
//            "<Google Drive>/Anuncios con IA/<anuncio>/…". Nunca se borra nada del computador.
//
// Solo corre si la carpeta de la app es un repositorio de git (la clonaste de GitHub). Si no lo es, o el push falla
// (sin internet, sin sesión de GitHub), lo dice en estado() y lo vuelve a intentar en la vuelta siguiente.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { RAIZ, TEMP, OUTPUT, PUERTO_DE_PRUEBA } from './rutas.js';

const CADA_MS = 2 * 60 * 1000;
const TOPE_BYTES = 45 * 1024 * 1024;
const PESADO = /\.(mp4|mov|webm|m4v|mp3|wav|m4a|aac|ogg)$/i;
const CARPETA_DRIVE = 'Anuncios con IA';
const RUTA_ESTADO = path.join(RAIZ, 'app', '.guardado.json');

let corriendo = false;
let ultimo = leerEstado();

function leerEstado() {
  try {
    return JSON.parse(fs.readFileSync(RUTA_ESTADO, 'utf8'));
  } catch {
    return {};
  }
}
function anotar(cambios) {
  ultimo = { ...ultimo, ...cambios, revisado: new Date().toISOString() };
  try {
    fs.writeFileSync(RUTA_ESTADO, JSON.stringify(ultimo, null, 2));
  } catch {
    /* no frena nada */
  }
}

// Asincrono: un push lento no traba la app.
const git = (args, timeout = 120000) =>
  new Promise((ok) => {
    let salida = '';
    let p;
    try {
      p = spawn('git', args, { cwd: RAIZ, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
    } catch (e) {
      return ok({ ok: false, salida: String(e.message || e) });
    }
    const t = setTimeout(() => p.kill(), timeout);
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

export const esRepositorio = () => fs.existsSync(path.join(RAIZ, '.git'));

/** Las carpetas de Google Drive para escritorio de este computador (Mac y Windows), o []. */
export function carpetasDrive() {
  const casa = os.homedir();
  const unidades = ['My Drive', 'Mi unidad', 'Meine Ablage', 'Mon Drive', 'Meu Drive'];
  const out = [];
  const nube = path.join(casa, 'Library', 'CloudStorage');
  try {
    for (const d of fs.readdirSync(nube)) {
      if (!d.startsWith('GoogleDrive')) continue;
      for (const u of unidades) if (fs.existsSync(path.join(nube, d, u))) out.push(path.join(nube, d, u));
    }
  } catch {
    /* no es Mac o no hay Drive */
  }
  if (process.platform === 'win32') {
    for (const letra of 'GHIJKLMNOPQRSTUVWXYZ') for (const u of unidades) if (fs.existsSync(`${letra}:\\${u}`)) out.push(`${letra}:\\${u}`);
  }
  for (const u of unidades) if (fs.existsSync(path.join(casa, 'Google Drive', u))) out.push(path.join(casa, 'Google Drive', u));
  return out;
}

/** Los archivos que pasan del tope (y GitHub rechazaría): a .git/info/exclude, para que git no los suba nunca. */
function excluirGigantes(rutas) {
  if (!rutas.length) return;
  const f = path.join(RAIZ, '.git', 'info', 'exclude');
  let actual = '';
  try {
    actual = fs.readFileSync(f, 'utf8');
  } catch {
    fs.mkdirSync(path.dirname(f), { recursive: true });
  }
  const nuevas = rutas.filter((r) => !actual.split('\n').includes(`/${r}`));
  if (nuevas.length) fs.appendFileSync(f, `${actual && !actual.endsWith('\n') ? '\n' : ''}${nuevas.map((r) => `/${r}`).join('\n')}\n`);
}

async function guardarEnGitHub() {
  const st = await git(['status', '--porcelain', '-uall']);
  if (!st.ok) return anotar({ github: { ok: false, mensaje: 'No pude leer el estado de git en esta carpeta.' } });
  const lineas = st.salida.split('\n').filter(Boolean);
  if (!lineas.length) {
    // nada nuevo, pero quizá quedó algo sin subir de la vuelta anterior
    const sinSubir = await git(['log', '--oneline', '@{u}..HEAD']);
    if (sinSubir.ok && sinSubir.salida) await empujar();
    return;
  }
  const gigantes = [];
  for (const l of lineas) {
    const rel = l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop();
    try {
      if (fs.statSync(path.join(RAIZ, rel)).size > TOPE_BYTES) gigantes.push(rel);
    } catch {
      /* se borró: igual entra (el commit registra que se borró) */
    }
  }
  excluirGigantes(gigantes);
  if (!(await git(['add', '-A'])).ok) return anotar({ github: { ok: false, mensaje: 'git no pudo agregar los cambios.' } });
  const conIdentidad = (await git(['config', 'user.email'])).ok ? [] : ['-c', 'user.name=Anuncios con IA', '-c', 'user.email=anuncios-con-ia@localhost'];
  const borrados = lineas.filter((l) => /^ ?D/.test(l)).length;
  const partes = [lineas.length - borrados ? `${lineas.length - borrados} cambios` : '', borrados ? `${borrados} borrados` : ''].filter(Boolean);
  const msj = `Guardado automático: ${partes.join(', ')}`;
  const c = await git([...conIdentidad, 'commit', '-q', '-m', msj]);
  if (!c.ok && !/nothing to commit/i.test(c.salida)) return anotar({ github: { ok: false, mensaje: 'git no pudo guardar los cambios.', detalle: c.salida.slice(-300) } });
  await empujar(msj);
}

async function empujar(msj = null) {
  let p = await git(['push', '-q'], 10 * 60000);
  // otra máquina (la Mac o el servidor) subió algo antes: se junta con lo de aquí y se vuelve a subir
  if (!p.ok && /rejected|non-fast-forward|fetch first/i.test(p.salida)) {
    const conIdentidad = (await git(['config', 'user.email'])).ok ? [] : ['-c', 'user.name=Kads Studio', '-c', 'user.email=kads-studio@localhost'];
    const j = await git([...conIdentidad, 'pull', '-q', '--no-rebase', '--no-edit'], 10 * 60000);
    if (j.ok) p = await git(['push', '-q'], 10 * 60000);
    else await git(['merge', '--abort']);
  }
  anotar({
    github: p.ok
      ? { ok: true, mensaje: msj ? `Subido a GitHub: ${msj.replace('Guardado automático: ', '')}.` : 'Al día en GitHub.', fecha: new Date().toISOString() }
      : { ok: false, mensaje: 'Guardado en este computador, pero no pude subirlo a GitHub (¿sin internet o sin sesión de GitHub?). Lo intento de nuevo en 2 minutos.', detalle: p.salida.slice(-300) },
  });
}

// Lo que va a Drive (y se borra de la Mac cuando el anuncio ya terminó): videos, audios e imágenes.
const A_DRIVE = /\.(mp4|mov|webm|m4v|mp3|wav|m4a|aac|ogg|png|jpe?g|webp)$/i;
const SUBCARPETAS = ['video', 'audio', 'musica', 'img', 'referencia', 'qa', 'historial'];
const MARCA_NUBE = 'en-la-nube.json';

/** Todos los archivos pesados de un anuncio: [{ rel (dentro de temp/<slug>), abs }]. */
function pesadosDe(slug) {
  const base = path.join(TEMP, slug);
  const out = [];
  const visitar = (dir, prof) => {
    let es = [];
    try {
      es = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of es) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory() && prof < 4) visitar(abs, prof + 1);
      else if (e.isFile() && A_DRIVE.test(e.name)) out.push({ rel: path.relative(base, abs).split(path.sep).join('/'), abs });
    }
  };
  for (const sub of SUBCARPETAS) visitar(path.join(base, sub), 0);
  return out;
}

const tamano = (f) => {
  try {
    return fs.statSync(f).size;
  } catch {
    return -1;
  }
};

function copiar(origen, destino) {
  const a = tamano(origen);
  if (a < 0) return false;
  if (tamano(destino) === a) return true;
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.copyFileSync(origen, destino);
  return tamano(destino) === a;
}

const slugsDeTemp = () => {
  try {
    return fs.readdirSync(TEMP, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.')).map((d) => d.name);
  } catch {
    return [];
  }
};
const leerJSON = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
};
const terminado = (slug) => leerJSON(path.join(TEMP, slug, 'app', 'conductor.json'))?.estado === 'listo';
export const marcaNube = (slug) => leerJSON(path.join(TEMP, slug, 'app', MARCA_NUBE));

/**
 * Copia a Google Drive todo lo pesado y, de los anuncios TERMINADOS, lo borra de la Mac apenas la copia está
 * completa (mismo tamaño). Lo que se movió queda anotado en temp/<slug>/app/en-la-nube.json (eso sí va a GitHub).
 * Los MP4 finales de output/ también se mueven. Un anuncio que se está produciendo o editando no se toca.
 */
function moverADrive() {
  const raiz = carpetasDrive()[0];
  if (!raiz) return anotar({ drive: { ok: false, mensaje: 'No encontré Google Drive para escritorio en este computador: los videos y las imágenes quedan solo aquí, sin borrar nada.' } });
  const base = path.join(raiz, CARPETA_DRIVE);
  let copiados = 0;
  let liberados = 0;
  let bytes = 0;
  for (const slug of slugsDeTemp()) {
    const archivos = pesadosDe(slug);
    const listo = terminado(slug) && !estaOcupado(slug);
    const movidos = [];
    if (listo && archivos.length) hacerPortada(slug, archivos);
    for (const f of archivos) {
      const destino = path.join(base, slug, ...f.rel.split('/'));
      const yaEstaba = tamano(destino) === tamano(f.abs);
      let ok = false;
      try {
        ok = copiar(f.abs, destino);
      } catch {
        ok = false;
      }
      if (ok && !yaEstaba) copiados++;
      if (ok && listo) {
        const t = tamano(f.abs);
        try {
          fs.rmSync(f.abs);
          movidos.push(f.rel);
          liberados++;
          bytes += t;
        } catch {
          /* el siguiente */
        }
      }
    }
    if (movidos.length) {
      const antes = marcaNube(slug)?.archivos || [];
      const marca = { carpeta: path.join(base, slug), archivos: [...new Set([...antes, ...movidos])], fecha: new Date().toISOString() };
      fs.writeFileSync(path.join(TEMP, slug, 'app', MARCA_NUBE), JSON.stringify(marca, null, 2));
    }
  }
  // los MP4 finales
  try {
    for (const f of fs.readdirSync(OUTPUT)) {
      if (!PESADO.test(f)) continue;
      const origen = path.join(OUTPUT, f);
      const destino = path.join(base, 'videos-finales', f);
      const slug = slugsDeTemp().find((s) => f.startsWith(`${s}_`));
      if (!copiar(origen, destino)) continue;
      copiados++;
      if (slug && terminado(slug) && !estaOcupado(slug)) {
        const t = tamano(origen);
        fs.rmSync(origen);
        liberados++;
        bytes += t;
        const marca = marcaNube(slug) || { carpeta: path.join(base, slug), archivos: [] };
        marca.finales = [...new Set([...(marca.finales || []), f])];
        fs.writeFileSync(path.join(TEMP, slug, 'app', MARCA_NUBE), JSON.stringify(marca, null, 2));
      }
    }
  } catch {
    /* sin output todavía */
  }
  const mb = Math.round(bytes / 1048576);
  anotar({
    drive: {
      ok: true,
      carpeta: base,
      mensaje: liberados ? `${liberados} archivo(s) pasaron a Google Drive y se borraron de este computador (${mb} MB liberados).` : copiados ? `${copiados} archivo(s) copiados a Google Drive.` : 'Google Drive al día.',
      liberadoTotalMB: (ultimo.drive?.liberadoTotalMB || 0) + mb,
    },
  });
}

/**
 * Los anuncios que no se mueven ahora: los que trajiste de vuelta o estás editando. Cada pedido del editor, de rehacer
 * o de los ganchos los marca (marcarOcupado); 30 minutos sin tocarlos y vuelven a subirse y a borrarse de la Mac.
 */
const ocupado = new Map();
const QUIETO_MS = 30 * 60 * 1000;
export function marcarOcupado(slug) {
  ocupado.set(slug, Date.now());
}
function estaOcupado(slug) {
  const t = ocupado.get(slug);
  if (!t) return false;
  if (Date.now() - t < QUIETO_MS) return true;
  ocupado.delete(slug);
  return false;
}

/** Una portada chica (portada.jpg, en la raíz del anuncio) para que Mis anuncios siga mostrando su imagen. */
function hacerPortada(slug, archivos) {
  const destino = path.join(TEMP, slug, 'portada.jpg');
  if (tamano(destino) > 0) return;
  const f = archivos.find((x) => /^img\/toma-1-inicial\./.test(x.rel)) || archivos.find((x) => /^img\/.+\.(png|jpe?g|webp)$/i.test(x.rel));
  if (!f) return;
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', f.abs, '-vf', 'scale=480:-2', '-q:v', '4', destino], { windowsHide: true, timeout: 30000 });
}

/** Trae de vuelta desde Drive lo que se movió de un anuncio (para editarlo, rehacer algo o sacar más ganchos). */
export function traerDeVuelta(slug) {
  const marca = marcaNube(slug);
  if (!marca) return { ok: true, nada: true };
  marcarOcupado(slug);
  const faltan = [];
  for (const rel of marca.archivos || []) {
    const desde = path.join(marca.carpeta, ...rel.split('/'));
    const a = path.join(TEMP, slug, ...rel.split('/'));
    try {
      if (tamano(a) < 0) {
        fs.mkdirSync(path.dirname(a), { recursive: true });
        fs.copyFileSync(desde, a);
      }
    } catch {
      faltan.push(rel);
    }
  }
  for (const f of marca.finales || []) {
    try {
      const a = path.join(OUTPUT, f);
      if (tamano(a) < 0) fs.copyFileSync(path.join(path.dirname(marca.carpeta), 'videos-finales', f), a);
    } catch {
      faltan.push(f);
    }
  }
  if (faltan.length) return { ok: false, faltan, mensaje: `No pude traer ${faltan.length} archivo(s) de Google Drive. Revisa que Drive esté abierto y con internet, y vuelve a intentarlo.` };
  fs.rmSync(path.join(TEMP, slug, 'app', MARCA_NUBE), { force: true });
  return { ok: true };
}

export async function guardarAhora() {
  if (corriendo) return ultimo;
  corriendo = true;
  try {
    if (esRepositorio()) await guardarEnGitHub();
    else anotar({ github: { ok: false, mensaje: 'Esta carpeta no es un repositorio de GitHub: clónala desde GitHub para que se guarde sola.' } });
    moverADrive();
  } catch (e) {
    anotar({ error: String(e?.message || e).slice(0, 300) });
  } finally {
    corriendo = false;
  }
  return ultimo;
}

export const estadoGuardado = () => ({ ...ultimo, repositorio: esRepositorio(), drive: ultimo.drive || null });

/** Arranca el ciclo (no en las apps de prueba, ni con ANUNCIOS_SIN_GUARDADO=1). */
export function iniciarGuardado() {
  if (PUERTO_DE_PRUEBA || process.env.ANUNCIOS_MODO_PRUEBA === '1' || process.env.ANUNCIOS_SIN_GUARDADO === '1') return;
  setTimeout(guardarAhora, 30000).unref?.();
  setInterval(guardarAhora, CADA_MS).unref?.();
}

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
import { spawn } from 'node:child_process';
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
  const p = await git(['push', '-q'], 10 * 60000);
  anotar({
    github: p.ok
      ? { ok: true, mensaje: msj ? `Subido a GitHub: ${msj.replace('Guardado automático: ', '')}.` : 'Al día en GitHub.', fecha: new Date().toISOString() }
      : { ok: false, mensaje: 'Guardado en este computador, pero no pude subirlo a GitHub (¿sin internet o sin sesión de GitHub?). Lo intento de nuevo en 2 minutos.', detalle: p.salida.slice(-300) },
  });
}

/** Copia lo pesado (videos y audios) a Google Drive, si no está o cambió. */
function copiarADrive() {
  const raiz = carpetasDrive()[0];
  if (!raiz) return anotar({ drive: { ok: false, mensaje: 'No encontré Google Drive para escritorio en este computador: los videos quedan solo aquí.' } });
  const destinoBase = path.join(raiz, CARPETA_DRIVE);
  let copiados = 0;
  const copiar = (origen, destino) => {
    try {
      const a = fs.statSync(origen);
      const b = fs.existsSync(destino) ? fs.statSync(destino) : null;
      if (b && b.size === a.size) return;
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.copyFileSync(origen, destino);
      copiados++;
    } catch {
      /* el siguiente */
    }
  };
  let slugs = [];
  try {
    slugs = fs.readdirSync(TEMP, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.')).map((d) => d.name);
  } catch {
    slugs = [];
  }
  for (const slug of slugs) {
    for (const sub of ['video', 'audio', 'musica']) {
      const dir = path.join(TEMP, slug, sub);
      let archivos = [];
      try {
        archivos = fs.readdirSync(dir);
      } catch {
        continue;
      }
      for (const f of archivos) if (PESADO.test(f)) copiar(path.join(dir, f), path.join(destinoBase, slug, sub, f));
    }
  }
  try {
    for (const f of fs.readdirSync(OUTPUT)) if (PESADO.test(f)) copiar(path.join(OUTPUT, f), path.join(destinoBase, 'videos-finales', f));
  } catch {
    /* sin output todavía */
  }
  anotar({ drive: { ok: true, mensaje: copiados ? `${copiados} video(s) o audio(s) copiados a Google Drive.` : 'Google Drive al día.', carpeta: destinoBase } });
}

export async function guardarAhora() {
  if (corriendo) return ultimo;
  corriendo = true;
  try {
    if (esRepositorio()) await guardarEnGitHub();
    else anotar({ github: { ok: false, mensaje: 'Esta carpeta no es un repositorio de GitHub: clónala desde GitHub para que se guarde sola.' } });
    copiarADrive();
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

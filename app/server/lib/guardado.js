// Guardado automático: todo lo que la app crea, cambia o borra queda en tu GitHub (el repositorio de esta carpeta),
// menos lo pesado (videos y audios), que va a tu Google Drive si lo tienes instalado en el computador.
//
//   GitHub   cada 2 minutos, si algo cambió: git add -A (respeta .gitignore) + commit + push. Lo que se borró también
//            se registra (el commit lo dice), y en el historial de GitHub siempre se puede recuperar.
//            Un archivo de más de 45 MB nunca se sube (GitHub los rechaza): se anota en .git/info/exclude.
//   Drive    los videos y audios (temp/<anuncio>/video, audio, musica y los MP4 de output/) se COPIAN a
//            la carpeta elegida en Ajustes. Solo se libera espacio después de verificar y registrar la copia.
//
// Solo corre si la carpeta de la app es un repositorio de git (la clonaste de GitHub). Si no lo es, o el push falla
// (sin internet, sin sesión de GitHub), lo dice en estado() y lo vuelve a intentar en la vuelta siguiente.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { RAIZ, TEMP, OUTPUT, PUERTO_DE_PRUEBA } from './rutas.js';
import { configuracionAlmacenamiento } from './almacenamiento.js';
import { crearArchivador } from './archivo-nube.js';
export { carpetasDrive } from './almacenamiento.js';

const CADA_MS = 2 * 60 * 1000;
const TOPE_BYTES = 45 * 1024 * 1024;
const RUTA_ESTADO = PUERTO_DE_PRUEBA ? path.join(TEMP, `_modo-prueba-${PUERTO_DE_PRUEBA}`, 'guardado-estado.json') : path.join(RAIZ, 'app', '.guardado.json');

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
    fs.mkdirSync(path.dirname(RUTA_ESTADO), { recursive: true });
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
      ok({ ok: codigo === 0, salida: salida.trim(), cruda: salida }); // cruda: sin recortar (git status -z)
    });
  });

export const esRepositorio = () => fs.existsSync(path.join(RAIZ, '.git'));

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

/**
 * Las entradas de `git status --porcelain -z`: { estado, ruta }. Con -z git no entrecomilla ni escapa las rutas con
 * tildes o espacios (antes «Aguaje Fórmula.mp4» llegaba como "Aguaje F\303\263rmula.mp4", el tamaño no se podía
 * leer y el tope de 45 MB no se aplicaba). En un cambio de nombre, la ruta de origen viene en la entrada siguiente.
 */
export function entradasDeEstado(salida) {
  const partes = String(salida || '').split('\0');
  const entradas = [];
  for (let i = 0; i < partes.length; i++) {
    const p = partes[i];
    if (p.length < 4) continue;
    const estado = p.slice(0, 2);
    entradas.push({ estado, ruta: p.slice(3) });
    if (/[RC]/.test(estado)) i++; // se salta la ruta de origen del cambio de nombre
  }
  return entradas;
}

async function guardarEnGitHub() {
  const st = await git(['status', '--porcelain', '-uall', '-z']);
  if (!st.ok) return anotar({ github: { ok: false, mensaje: 'No pude leer el estado de git en esta carpeta.' } });
  const lineas = entradasDeEstado(st.cruda);
  if (!lineas.length) {
    // nada nuevo, pero quizá quedó algo sin subir de la vuelta anterior
    const sinSubir = await git(['log', '--oneline', '@{u}..HEAD']);
    if (sinSubir.ok && sinSubir.salida) await empujar();
    return;
  }
  const gigantes = [];
  for (const { ruta: rel } of lineas) {
    try {
      if (fs.statSync(path.join(RAIZ, rel)).size > TOPE_BYTES) gigantes.push(rel);
    } catch {
      /* se borró: igual entra (el commit registra que se borró) */
    }
  }
  excluirGigantes(gigantes);
  if (!(await git(['add', '-A'])).ok) return anotar({ github: { ok: false, mensaje: 'git no pudo agregar los cambios.' } });
  // .git/info/exclude solo frena archivos nuevos: uno que git ya seguía y creció de más igual entraba con add -A, y
  // GitHub rechazaba el push en cada vuelta. Se lo saca de lo que se va a subir (queda la versión anterior).
  if (gigantes.length) await git(['reset', '-q', '--', ...gigantes]);
  const conIdentidad = (await git(['config', 'user.email'])).ok ? [] : ['-c', 'user.name=Anuncios con IA', '-c', 'user.email=anuncios-con-ia@localhost'];
  const borrados = lineas.filter((l) => /^ ?D/.test(l.estado)).length;
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
    else {
      await git(['merge', '--abort']);
      // Lo de aquí y lo de GitHub cambiaron el mismo archivo: no se junta solo (podría pisar algo tuyo). Se avisa claro
      // en vez del mensaje genérico de «sin internet», y lo guardado sigue a salvo en este computador.
      return anotar({
        github: {
          ok: false,
          conflicto: true,
          mensaje: 'Guardado en este computador, pero en GitHub hay cambios de otra máquina sobre los mismos archivos y no los junté solo para no pisar nada. Hace falta juntarlos a mano.',
          detalle: j.salida.slice(-300),
        },
      });
    }
  }
  anotar({
    github: p.ok
      ? { ok: true, mensaje: msj ? `Subido a GitHub: ${msj.replace('Guardado automático: ', '')}.` : 'Al día en GitHub.', fecha: new Date().toISOString() }
      : { ok: false, mensaje: 'Guardado en este computador, pero no pude subirlo a GitHub (¿sin internet o sin sesión de GitHub?). Lo intento de nuevo en 2 minutos.', detalle: p.salida.slice(-300) },
  });
}

// Se conservan las ubicaciones antiguas por archivo al cambiar de carpeta.
const archivador = crearArchivador({ temp: TEMP, output: OUTPUT, ocupado: (slug) => estaOcupado(slug) });
export const marcaNube = archivador.marca;

async function moverADrive() {
  const almacenamiento = configuracionAlmacenamiento();
  const base = almacenamiento.carpetaEfectiva;
  if (almacenamiento.modo === 'local') return anotar({ drive: { ok: true, carpeta: null, mensaje: 'Los archivos se conservan en este computador. El guardado de guiones en GitHub sigue activo.' } });
  if (!base) return anotar({ drive: { ok: false, carpeta: null, mensaje: 'No encontré una carpeta de Google Drive. Elige una en Ajustes → Guardado. Tus archivos se conservan aquí.' } });
  // El modo automático heredado agrega la subcarpeta; solo se crea si Drive sigue conectado.
  if (almacenamiento.modo === 'automatico' && !fs.existsSync(base)) {
    const raiz = path.dirname(base);
    if (!fs.existsSync(raiz)) throw new Error('La carpeta de Google Drive no está disponible. Tus archivos se conservan aquí.');
    fs.mkdirSync(base);
  }
  const r = await archivador.respaldar({ destino: base, liberarEspacio: almacenamiento.liberarEspacio, alLiberar: hacerPortada });
  const mb = Math.round(r.bytes / 1048576);
  const mensaje = r.fallos.length
    ? `No pude copiar ${r.fallos.length} archivo(s). Se conservan los originales que no se pudieron guardar; revisa la carpeta y vuelve a intentarlo.`
    : r.liberados ? `${r.liberados} archivo(s) copiados y verificados; ${mb} MB liberados. La aplicación de nube se encarga de sincronizarlos.`
      : r.copiados ? `${r.copiados} archivo(s) copiados y verificados. La aplicación de nube se encarga de sincronizarlos.`
        : 'La copia en la carpeta elegida está al día. La aplicación de nube se encarga de sincronizarla.';
  anotar({ drive: { ok: r.fallos.length === 0, carpeta: base, mensaje, fallos: r.fallos.length,
    liberadoTotalMB: (ultimo.drive?.liberadoTotalMB || 0) + mb } });
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

const tamano = (f) => { try { return fs.statSync(f).size; } catch { return -1; } };

/** Una portada chica (portada.jpg, en la raíz del anuncio) para que Mis anuncios siga mostrando su imagen. */
function hacerPortada(slug, archivos) {
  const destino = path.join(TEMP, slug, 'portada.jpg');
  if (tamano(destino) > 0) return;
  const f = archivos.find((x) => /^img\/toma-1-inicial\./.test(x.rel)) || archivos.find((x) => /^img\/.+\.(png|jpe?g|webp)$/i.test(x.rel));
  if (!f) return;
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', f.abs, '-vf', 'scale=480:-2', '-q:v', '4', destino], { windowsHide: true, timeout: 30000 });
}

/** Recupera usando la ubicación de cada pieza, incluso si cambió el destino después. */
const trayendo = new Map(); // slug -> promesa: dos pedidos a la vez del mismo anuncio esperan la misma copia
export function traerDeVuelta(slug) {
  marcarOcupado(slug);
  if (!trayendo.has(slug)) {
    // promesa: la copia desde Drive no traba la app
    trayendo.set(slug, archivador.restaurarAsync(slug).finally(() => trayendo.delete(slug)));
  }
  return trayendo.get(slug);
}

export async function guardarAhora() {
  if (corriendo) return ultimo;
  corriendo = true;
  try {
    if (PUERTO_DE_PRUEBA || process.env.ANUNCIOS_MODO_PRUEBA === '1') {
      anotar({ github: { ok: true, mensaje: 'Modo prueba: no se escribe ni se sube nada a GitHub.' }, drive: { ok: true, carpeta: configuracionAlmacenamiento().carpetaEfectiva, mensaje: 'Modo prueba: no se copian ni se eliminan archivos de tus anuncios.' } });
      return ultimo;
    }
    else if (esRepositorio()) await guardarEnGitHub();
    else anotar({ github: { ok: false, mensaje: 'Esta carpeta no es un repositorio de GitHub: clónala desde GitHub para que se guarde sola.' } });
    await moverADrive();
  } catch (e) {
    anotar({ drive: { ok: false, carpeta: configuracionAlmacenamiento().carpetaEfectiva, mensaje: 'No pude usar la carpeta elegida. Revisa que esté conectada y tengas permiso para escribir. Los originales que no se copiaron se conservan aquí.' }, error: String(e?.message || e).slice(0, 300) });
  } finally {
    corriendo = false;
  }
  return ultimo;
}

export const estadoGuardado = () => {
  const almacenamiento = configuracionAlmacenamiento();
  const drive = almacenamiento.modo === 'local'
    ? { ok: true, mensaje: 'Los archivos se conservan en este computador.', carpeta: null }
    : ultimo.drive?.carpeta === almacenamiento.carpetaEfectiva ? ultimo.drive : { ok: null, mensaje: almacenamiento.carpetaEfectiva ? 'Carpeta elegida. Pulsa «Guardar ahora» o espera el guardado automático.' : 'Elige una carpeta de nube para guardar tus archivos.', carpeta: almacenamiento.carpetaEfectiva };
  return { ...ultimo, repositorio: esRepositorio(), drive, almacenamiento };
};

/** Arranca el ciclo (no en las apps de prueba, ni con ANUNCIOS_SIN_GUARDADO=1). */
export function iniciarGuardado() {
  if (PUERTO_DE_PRUEBA || process.env.ANUNCIOS_MODO_PRUEBA === '1' || process.env.ANUNCIOS_SIN_GUARDADO === '1') return;
  setTimeout(guardarAhora, 30000).unref?.();
  setInterval(guardarAhora, CADA_MS).unref?.();
}

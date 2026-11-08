// Deja la app lista para abrir (lo llaman los dos lanzadores, con Node.js ya en el PATH):
//   1. remotion/: npm ci si falta node_modules o si cambió su package-lock.json (va primero: la interfaz importa
//      react, remotion y @remotion/player de remotion/node_modules). El navegador que bajó el armado de los videos
//      (remotion/node_modules/.remotion) se guarda aparte y se devuelve: así no se baja otra vez.
//      Si todavía no está ese navegador, lo baja ahora (remotion browser ensure, solo la primera vez).
//   2. app/: lo mismo con su package-lock.json.
//   3. app/: npm run build, cada vez (unos segundos): la interfaz siempre al día. Si falla, muestra las últimas líneas.
// Siempre npm ci (nunca npm install): el package-lock.json fija las versiones exactas que se probaron.
// Cada node_modules guarda la huella de lo que se instaló (.anuncios-huella): package-lock.json, sistema y Node.js.
// Sale con 0 si quedó todo listo y con 1 si algo falló (después de decir qué).
//   node app/inicio/preparar-app.mjs [--sin-armar]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = path.resolve(APP, '..');
const REMOTION = path.join(RAIZ, 'remotion');
const WIN = process.platform === 'win32';

const decir = (t = '') => console.log(t ? ` ${t}` : '');

// npm es npm.cmd en Windows: desde Node 20.12 un .cmd solo se lanza con shell (los argumentos son fijos, sin espacios)
function npm(args, { cwd, capturar = false } = {}) {
  const r = spawnSync('npm', args, { cwd, shell: WIN, stdio: capturar ? ['ignore', 'pipe', 'pipe'] : 'inherit', encoding: 'utf8', windowsHide: true });
  return { codigo: r.error ? -1 : r.status ?? -1, salida: `${r.stdout || ''}${r.stderr || ''}${r.error ? `\n${r.error.message}` : ''}` };
}

function huella(dir) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(path.join(dir, 'package-lock.json')));
  h.update(`|${process.platform}|${process.arch}|node${process.versions.node.split('.')[0]}`);
  return h.digest('hex');
}

const leer = (f) => {
  try {
    return fs.readFileSync(f, 'utf8').trim();
  } catch {
    return null;
  }
};

/** npm ci en dir si hace falta. guardar: carpetas de node_modules que sobreviven a la reinstalación. */
function instalar(dir, nombre, { guardar = [] } = {}) {
  if (!fs.existsSync(path.join(dir, 'package-lock.json'))) {
    decir(`Falta el archivo ${path.relative(RAIZ, path.join(dir, 'package-lock.json'))}. Vuelve a descomprimir el .zip completo.`);
    return false;
  }
  const nm = path.join(dir, 'node_modules');
  const marca = path.join(nm, '.anuncios-huella');
  const esperada = huella(dir);
  if (leer(marca) === esperada) return true;

  decir();
  decir(`Instalando ${nombre} (la primera vez, o después de actualizar la app; unos minutos)...`);
  // lo que se guarda va al lado de node_modules mientras npm ci lo borra y lo vuelve a armar
  const guardados = [];
  for (const g of guardar) {
    const de = path.join(nm, g);
    const a = path.join(dir, `${g}.guardado`);
    if (!fs.existsSync(de)) continue;
    try {
      fs.rmSync(a, { recursive: true, force: true });
      fs.renameSync(de, a);
      guardados.push([a, de]);
    } catch {
      /* si no se puede mover, se baja otra vez cuando haga falta */
    }
  }
  // también lo guardado por una vez anterior que se cortó a la mitad
  for (const g of guardar) {
    const a = path.join(dir, `${g}.guardado`);
    if (fs.existsSync(a) && !guardados.some(([x]) => x === a)) guardados.push([a, path.join(nm, g)]);
  }

  let r = npm(['ci', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: dir });
  if (r.codigo !== 0) {
    // un corte de internet a la mitad: una vez más
    decir('Hubo un problema al instalar; lo intento una vez más...');
    r = npm(['ci', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: dir });
  }
  for (const [a, de] of guardados) {
    if (!fs.existsSync(nm)) break;
    try {
      fs.rmSync(de, { recursive: true, force: true });
      fs.renameSync(a, de);
    } catch {
      /* queda en <carpeta>.guardado para la próxima */
    }
  }
  if (r.codigo !== 0) {
    decir(`No se pudo instalar ${nombre}. Revisa tu internet, cierra esta ventana y vuelve a abrir el archivo.`);
    return false;
  }
  fs.writeFileSync(marca, `${esperada}\n`);
  decir(`${nombre[0].toUpperCase()}${nombre.slice(1)}: listo.`);
  return true;
}

/** true si ya está el navegador que usa Remotion para armar los videos (remotion/node_modules/.remotion). */
function hayNavegador() {
  const dir = path.join(REMOTION, 'node_modules', '.remotion', 'chrome-headless-shell');
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).some((d) => d.isDirectory());
  } catch {
    return false;
  }
}

// El navegador del armado de los videos se baja ahora y no al exportar el primer anuncio: así el primero no espera, y
// funciona igual en el modo prueba (ahí la guardia de red corta toda salida del motor, también esa descarga).
function bajarNavegador() {
  if (hayNavegador()) return true;
  const cli = path.join(REMOTION, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
  if (!fs.existsSync(cli)) return false;
  decir();
  decir('Bajando el navegador que arma los videos (solo la primera vez, unos 100 MB)...');
  const r = spawnSync(process.execPath, [cli, 'browser', 'ensure'], { cwd: REMOTION, stdio: 'inherit', windowsHide: true });
  if (r.status === 0 && hayNavegador()) {
    decir('Navegador del armado de los videos: listo.');
    return true;
  }
  decir('Aviso: no se pudo bajar el navegador que arma los videos. Se intenta otra vez al exportar el primer anuncio.');
  return true; // no frena la app: el armado lo baja solo cuando haga falta
}

function armarInterfaz() {
  decir('Armando la interfaz...');
  const r = npm(['run', 'build'], { cwd: APP, capturar: true });
  if (r.codigo === 0 && fs.existsSync(path.join(APP, 'dist', 'index.html'))) return true;
  decir();
  decir('No se pudo armar la interfaz de la app. Esto fue lo último que dijo:');
  decir();
  // (sin los códigos de color de la terminal) las primeras líneas del error, que dicen qué archivo falló
  const lineas = r.salida.replace(/\x1b\[[0-9;]*m/g, '').trim().split(/\r?\n/).filter((l) => !/^\s+at /.test(l));
  for (const l of lineas.slice(-25)) decir(`  ${l}`);
  decir();
  decir('Vuelve a abrir el archivo. Si sigue igual, descomprime otra vez el .zip completo de la app.');
  return false;
}

/** La ruta del programa del navegador del armado de los videos (o, si todavía no está, la que va a tener). */
function rutaDelNavegador() {
  const base = path.join(REMOTION, 'node_modules', '.remotion', 'chrome-headless-shell');
  try {
    for (const plataforma of fs.readdirSync(base)) {
      const dir = path.join(base, plataforma);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const sub of fs.readdirSync(dir)) {
        const exe = path.join(dir, sub, 'chrome-headless-shell.exe');
        if (fs.existsSync(exe)) return exe;
      }
    }
  } catch {
    /* todavía no se bajó */
  }
  return path.join(base, 'win64', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
}

// Dónde quedó la carpeta de la app (solo avisa: la app abre igual).
//  - Ruta muy larga: Windows no abre un programa cuya ruta llega a 260 letras, y la del navegador del armado de los
//    videos le suma 114 a la de la carpeta (la carpeta puede tener hasta 145). Pasado ese límite, ningún
//    anuncio se puede exportar.
//  - OneDrive: sube node_modules y los videos de temp/ y output/, y sus archivos "en la nube" traban la instalación.
function revisarCarpeta() {
  if (!WIN) return; // en Mac lo avisa el lanzador (Escritorio, Documentos, Descargas, iCloud)
  const consejo = 'Mueve la carpeta «Anuncios con IA» a tu carpeta de usuario: en el Explorador escribe %USERPROFILE% en la barra de arriba, pulsa Enter y pégala ahí. Después ábrela desde ahí.';
  if (rutaDelNavegador().length >= 260) {
    decir();
    decir(`Aviso: la carpeta de la app está demasiado adentro de otras carpetas (${RAIZ}).`);
    decir('Así Windows no deja abrir el programa que arma los videos y ningún anuncio se va a poder exportar.');
    decir(consejo);
  } else if (/[\\/]OneDrive( - [^\\/]+)?[\\/]/i.test(RAIZ)) {
    decir();
    decir('Consejo: la carpeta de la app está dentro de OneDrive. OneDrive intenta subir tus videos (pesan mucho) y');
    decir('a veces traba la instalación.');
    decir(consejo);
  }
}

let ok = instalar(REMOTION, 'el armado de los videos', { guardar: ['.remotion'] });
ok = ok && bajarNavegador();
ok = ok && instalar(APP, 'la app');
ok = ok && (process.argv.includes('--sin-armar') || armarInterfaz());
revisarCarpeta(); // al final, para que sea lo último que se lee antes de que abra la app
process.exit(ok ? 0 : 1);

// Destino del guardado en ESTE computador. Las rutas de Mac/Windows no se sincronizan por GitHub.
// Elegir una carpeta no mueve archivos: guardado.js decide cuándo copiar o recuperar cada anuncio.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { APP, RAIZ, TEMP, PUERTO_DE_PRUEBA } from './rutas.js';
import { EN_SERVIDOR } from './servidor.js';
import { buscarPrograma } from './programas.js';
import { renombrarSeguro } from './archivos.js';

export const ARCHIVO_ALMACENAMIENTO = PUERTO_DE_PRUEBA
  ? path.join(TEMP, `_modo-prueba-${PUERTO_DE_PRUEBA}`, 'guardado-config.json')
  : path.join(APP, '.guardado-config.json');
const MODOS = new Set(['automatico', 'local', 'nube']);
const HEREDADO = Object.freeze({ modo: 'automatico', carpeta: null, liberarEspacio: true });
const SOLO_LOCAL = Object.freeze({ modo: 'local', carpeta: null, liberarEspacio: false });

export class ErrorAlmacenamiento extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

/** Sin preferencias previas se mantiene el guardado original; un archivo roto nunca activa el borrado. */
export function leerAlmacenamiento() {
  let c;
  try {
    c = JSON.parse(fs.readFileSync(ARCHIVO_ALMACENAMIENTO, 'utf8'));
  } catch (e) {
    return { ...(e.code === 'ENOENT' ? HEREDADO : SOLO_LOCAL) };
  }
  if (!c || typeof c !== 'object' || Array.isArray(c) || !MODOS.has(c.modo)) return { ...SOLO_LOCAL };
  if (c.liberarEspacio !== undefined && typeof c.liberarEspacio !== 'boolean') return { ...SOLO_LOCAL };
  if (c.modo === 'nube' && (typeof c.carpeta !== 'string' || !path.isAbsolute(c.carpeta) || c.carpeta.includes('\0'))) return { ...SOLO_LOCAL };
  return {
    modo: c.modo,
    carpeta: c.modo === 'nube' ? c.carpeta : null,
    liberarEspacio: c.modo !== 'local' && (typeof c.liberarEspacio === 'boolean' ? c.liberarEspacio : c.modo === 'automatico'),
  };
}

/** Las unidades sincronizadas que Drive para escritorio expone en Mac y Windows. */
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
    /* sin Drive en Mac */
  }
  if (process.platform === 'win32') {
    for (const letra of 'GHIJKLMNOPQRSTUVWXYZ') for (const u of unidades) if (fs.existsSync(`${letra}:\\${u}`)) out.push(`${letra}:\\${u}`);
  }
  for (const u of unidades) if (fs.existsSync(path.join(casa, 'Google Drive', u))) out.push(path.join(casa, 'Google Drive', u));
  return [...new Set(out)];
}

const dentro = (base, destino) => {
  const r = path.relative(base, destino);
  return r === '' || (!r.startsWith(`..${path.sep}`) && r !== '..' && !path.isAbsolute(r));
};

/** Comprueba una carpeta existente sin crearla ni tocar sus archivos: solo una prueba temporal exclusiva. */
export function validarCarpetaAlmacenamiento(carpeta) {
  if (typeof carpeta !== 'string' || !carpeta.trim() || carpeta.includes('\0') || carpeta.length > 4096 || !path.isAbsolute(carpeta)) {
    throw new ErrorAlmacenamiento(400, 'Elige una carpeta con su ruta completa en este computador.');
  }
  let real;
  let raizReal;
  try {
    real = fs.realpathSync(carpeta);
    raizReal = fs.realpathSync(RAIZ);
    if (!fs.statSync(real).isDirectory()) throw new ErrorAlmacenamiento(422, 'La ruta elegida no es una carpeta.');
  } catch (e) {
    if (e instanceof ErrorAlmacenamiento) throw e;
    throw new ErrorAlmacenamiento(422, 'No encuentro esa carpeta. Conecta el disco o abre Google Drive y vuelve a elegirla.');
  }
  if (real === path.parse(real).root || dentro(raizReal, real) || dentro(real, raizReal)) {
    throw new ErrorAlmacenamiento(422, 'Elige una carpeta fuera de la app y de las carpetas que la contienen, para no mezclar el respaldo con el trabajo.');
  }
  const prueba = path.join(real, `.kads-prueba-${crypto.randomUUID()}.tmp`);
  let fd;
  let creada = false;
  try {
    fs.accessSync(real, fs.constants.W_OK | fs.constants.X_OK);
    fd = fs.openSync(prueba, 'wx', 0o600);
    creada = true;
    fs.writeFileSync(fd, 'Kads');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.unlinkSync(prueba);
    creada = false;
  } catch {
    throw new ErrorAlmacenamiento(422, 'No puedo escribir en esa carpeta. Revisa sus permisos, el espacio del disco y que Google Drive esté abierto.');
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch { /* ya cerrado */ }
    if (creada) try { fs.unlinkSync(prueba); } catch { /* no toca otros archivos */ }
  }
  return real;
}

/** Guarda de una vez; cambiar de destino no cambia las ubicaciones de los anuncios ya archivados. */
export function guardarAlmacenamiento(cambios) {
  if (!cambios || typeof cambios !== 'object' || Array.isArray(cambios)) throw new ErrorAlmacenamiento(400, 'Revisa las opciones de guardado.');
  const anterior = leerAlmacenamiento();
  const modo = cambios.modo === undefined ? anterior.modo : cambios.modo;
  if (!MODOS.has(modo)) throw new ErrorAlmacenamiento(400, 'Elige guardado automático, solo local o una carpeta de nube.');
  if (cambios.liberarEspacio !== undefined && typeof cambios.liberarEspacio !== 'boolean') throw new ErrorAlmacenamiento(400, 'La opción de liberar espacio debe estar activada o desactivada.');
  const carpeta = modo === 'nube' ? validarCarpetaAlmacenamiento(cambios.carpeta === undefined ? anterior.carpeta : cambios.carpeta) : null;
  const liberarEspacio = modo !== 'local' && (cambios.liberarEspacio ?? (modo === 'automatico' ? (anterior.modo === modo ? anterior.liberarEspacio : true) : false));
  const nueva = { modo, carpeta, liberarEspacio };
  const tmp = `${ARCHIVO_ALMACENAMIENTO}.${crypto.randomUUID()}.tmp`;
  let fd;
  try {
    fs.mkdirSync(path.dirname(ARCHIVO_ALMACENAMIENTO), { recursive: true });
    fd = fs.openSync(tmp, 'wx', 0o600);
    fs.writeFileSync(fd, `${JSON.stringify(nueva, null, 2)}\n`);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    renombrarSeguro(tmp, ARCHIVO_ALMACENAMIENTO);
  } catch {
    throw new ErrorAlmacenamiento(422, 'No pude guardar la configuración. Revisa el espacio y los permisos del computador. Tu selección anterior sigue guardada.');
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch { /* ya cerrado */ }
    try { fs.rmSync(tmp, { force: true }); } catch { /* solo nuestro temporal */ }
  }
  return nueva;
}

/** Comandos fijos: ninguna ruta elegida se interpola en AppleScript, PowerShell ni una shell. */
export function selectorNativo({ plataforma = process.platform, buscar = buscarPrograma } = {}) {
  if (plataforma === 'darwin') return {
    comando: '/usr/bin/osascript',
    args: ['-e', 'POSIX path of (choose folder with prompt "Elige la carpeta donde Kads Studio guardará tus archivos")'],
  };
  if (plataforma === 'win32') return {
    comando: buscar('powershell')?.ruta || 'powershell.exe',
    args: ['-NoProfile', '-STA', '-Command', '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); Add-Type -AssemblyName System.Windows.Forms; $dialogo = New-Object System.Windows.Forms.FolderBrowserDialog; $dialogo.Description = "Elige la carpeta para guardar tus archivos de Kads Studio"; $dialogo.ShowNewFolderButton = $true; try { if ($dialogo.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::WriteLine($dialogo.SelectedPath) } } finally { $dialogo.Dispose() }'],
  };
  if (plataforma === 'linux') {
    const zenity = buscar('zenity');
    return zenity ? { comando: zenity.ruta, args: ['--file-selection', '--directory', '--title=Carpeta de guardado de Kads Studio'] } : null;
  }
  return null;
}

function ejecutarSelector(comando, args) {
  return new Promise((resolve, reject) => {
    execFile(comando, args, { encoding: 'utf8', windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 64 * 1024 }, (e, stdout, stderr) => {
      if (e) {
        e.salidaSelector = `${stderr || ''}`;
        reject(e);
      } else resolve(String(stdout || ''));
    });
  });
}

/** Una sola ventana a la vez. La fábrica permite probar cancelación y concurrencia sin abrir diálogos reales. */
export function crearSelectorCarpeta({ detectar = selectorNativo, ejecutar = ejecutarSelector, enServidor = EN_SERVIDOR } = {}) {
  let eligiendo = false;
  return async function elegir() {
    if (enServidor) throw new ErrorAlmacenamiento(403, 'El selector de carpetas solo se puede usar en el computador donde está abierta la app.');
    if (eligiendo) throw new ErrorAlmacenamiento(409, 'Ya hay una ventana para elegir carpeta abierta. Termina de elegir o cancélala.');
    const selector = detectar();
    if (!selector) return { disponible: false };
    eligiendo = true;
    try {
      const salida = (await ejecutar(selector.comando, selector.args)).trim();
      if (!salida) return { cancelado: true };
      return { carpeta: validarCarpetaAlmacenamiento(salida) };
    } catch (e) {
      if (e instanceof ErrorAlmacenamiento) throw e;
      if (/\(-128\)|user cancel|cancelad/i.test(e.salidaSelector || '') || (selector.comando.includes('zenity') && e.code === 1)) return { cancelado: true };
      if (e.code === 'ENOENT') return { disponible: false };
      throw new ErrorAlmacenamiento(422, 'No pude abrir el selector de carpetas. Puedes pegar la ruta completa de la carpeta.');
    } finally {
      eligiendo = false;
    }
  };
}
export const seleccionarCarpeta = crearSelectorCarpeta();

export function configuracionAlmacenamiento() {
  const c = leerAlmacenamiento();
  const detectadas = carpetasDrive();
  return {
    ...c,
    carpetaEfectiva: c.modo === 'nube' ? c.carpeta : c.modo === 'automatico' && detectadas.length ? path.join(detectadas[0], 'Anuncios con IA') : null,
    carpetaLocal: TEMP,
    carpetasDetectadas: detectadas.map((ruta) => ({ nombre: path.basename(path.dirname(ruta)) || 'Google Drive', ruta })),
    selectorDisponible: !EN_SERVIDOR && Boolean(selectorNativo()),
  };
}

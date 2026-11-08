// Actualizar la app desde un paquete nuevo (Ajustes > Acerca de > "Actualizar la app").
//
// El alumno elige el anuncios-con-ia-app.zip nuevo y el servidor:
//   1. lo abre con el lector de zip de abajo (sin dependencias: Node no trae unzip y asi funciona
//      igual en Windows y en Mac, sin PowerShell, ditto ni unzip, y sin escribir nada todavia);
//   2. comprueba que sea un paquete de esta app (VERSION, los dos lanzadores, app/server...), que no
//      este roto (cada archivo se descomprime y se compara su CRC) y que su VERSION sea MAS NUEVA que
//      la instalada. Si algo no da, se rechaza con un mensaje claro y no se toca nada;
//   3. deja lo que cambia en una carpeta de trabajo (.actualizando/) dentro de la misma carpeta de la
//      app, respalda lo que va a reemplazar o quitar en respaldos/<fecha>/ y recien entonces lo cambia.
//      Si algo falla a mitad de camino, vuelve a poner lo de antes desde el respaldo. VERSION se
//      escribe al final: una actualizacion a medias nunca dice que es la version nueva.
//
// Lo del alumno NUNCA se toca (delAlumno): temp/, output/, .env, app/config.json, app/.cache,
// app/capturas, cualquier node_modules, respaldos/, remotion/out, .git y todo .claude/ menos
// .claude/skills/. Los programas que instala el lanzador viven fuera de esta carpeta.
//
// Lo que la version nueva ya no trae se quita (con su respaldo), pero solo si es del sistema: lo que
// el paquete anterior trajo segun su lista (app/archivos-del-paquete.json, la arma el empaquetador) y
// que este dentro de app/, produccion/, remotion/src/, recursos/ o .claude/skills/. Nunca lo del alumno.
//
// Despues hay que cerrar la ventana de la app y volver a abrir el lanzador: el servidor que esta
// corriendo sigue con el codigo de antes, y el lanzador reinstala lo que haga falta si cambio un
// package-lock.json y vuelve a armar la interfaz.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { RAIZ } from './rutas.js';

/** Lo que dice VERSION: la fecha, con una letra si es el segundo paquete del dia (2026-11-06, 2026-11-06b). */
export const RE_VERSION = /^\d{4}-\d{2}-\d{2}[a-z]?$/;

export const LANZADORES = ['Abrir Anuncios con IA.bat', 'Abrir Anuncios con IA.command'];

/** Sin esto no es un paquete de esta app. */
const IMPRESCINDIBLES = ['VERSION', ...LANZADORES, 'app/server/index.js', 'app/package.json', 'produccion/config.js', 'remotion/package.json'];

/** La lista de lo que trajo cada paquete (para saber que se puede quitar). La arma el empaquetador. */
export const LISTA_DEL_PAQUETE = 'app/archivos-del-paquete.json';

/** Donde se puede quitar lo que la version nueva ya no trae. */
const ZONAS_DEL_SISTEMA = ['app/', 'produccion/', 'remotion/src/', 'recursos/', '.claude/skills/'];

const TRABAJO = '.actualizando';
const RESPALDOS = 'respaldos';

export class ErrorActualizar extends Error {
  constructor(mensaje, estado = 400) {
    super(mensaje);
    this.estado = estado;
  }
}

/** true si la ruta (relativa a la raiz, con /) es del alumno: la actualizacion nunca la escribe, ni la respalda, ni la quita. */
export function delAlumno(rel) {
  const r = String(rel).replace(/\\/g, '/').replace(/^\.\/+/, '');
  const partes = r.split('/').filter(Boolean);
  if (!partes.length) return true;
  const [primera] = partes;
  const nombre = partes[partes.length - 1];
  const bajo = (p) => p.toLowerCase();
  if (['temp', 'output', RESPALDOS, TRABAJO, '.git', 'historial'].includes(bajo(primera))) return true;
  if (partes.some((p) => bajo(p) === 'node_modules')) return true;
  // las claves: .env, .env.local... (la plantilla .env.example si es del sistema)
  if (/^\.env(\..+)?$/i.test(nombre) && bajo(nombre) !== '.env.example') return true;
  const r2 = bajo(r);
  if (r2 === 'app/config.json' || r2.startsWith('app/.cache/') || r2 === 'app/.cache') return true;
  if (r2.startsWith('app/capturas/') || r2 === 'app/capturas') return true;
  if (r2.startsWith('remotion/out/') || r2 === 'remotion/out') return true;
  if (r2 === 'app/server/ocultos.json' || r2 === 'app/server/muestras-estilos.json') return true;
  if (bajo(primera) === '.claude' && !(partes.length > 2 && bajo(partes[1]) === 'skills')) return true;
  if (['.ds_store', 'thumbs.db', 'desktop.ini'].includes(bajo(nombre))) return true;
  return false;
}

// ---------------------------------------------------------------- lector de zip

const SIG_FIN = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

const utf8Estricto = new TextDecoder('utf-8', { fatal: true });
function nombreDe(buf, utf8) {
  if (utf8) return buf.toString('utf8');
  try {
    return utf8Estricto.decode(buf);
  } catch {
    return buf.toString('latin1');
  }
}

/**
 * Abre un zip para leerlo entrada por entrada (nunca entero en memoria).
 * Devuelve { entradas: [{ nombre, carpeta, metodo, crc, comprimido, tamano, atributos, hechoEn, desde }], leer(e), cerrar() }.
 * Soporta lo que arma el empaquetador y lo que arman Windows, macOS y 7-Zip: guardado o deflate, sin cifrar, sin zip64.
 */
export function abrirZip(ruta) {
  let fd;
  try {
    fd = fs.openSync(ruta, 'r');
  } catch (e) {
    throw new ErrorActualizar(`No pude abrir el archivo (${e.code || e.message}).`);
  }
  const cerrar = () => {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        /* ya cerrado */
      }
      fd = undefined;
    }
  };
  try {
    const tam = fs.fstatSync(fd).size;
    const leerEn = (pos, n) => {
      const b = Buffer.alloc(n);
      let hecho = 0;
      while (hecho < n) {
        const r = fs.readSync(fd, b, hecho, n - hecho, pos + hecho);
        if (!r) throw new ErrorActualizar('El paquete está incompleto (se cortó al bajarlo). Vuelve a bajarlo y prueba otra vez.');
        hecho += r;
      }
      return b;
    };
    const noEsZip = () =>
      new ErrorActualizar('Ese archivo no es un paquete de Anuncios con IA (no se puede abrir como zip). Elige el archivo anuncios-con-ia-app.zip que recibiste.');
    // Empieza como un zip pero no tiene el final: se corto al bajarlo (no es "otro archivo").
    const empiezaComoZip = () => tam >= 4 && leerEn(0, 4).readUInt32LE(0) === SIG_LOCAL;
    const incompleto = () => new ErrorActualizar('El paquete está incompleto (se cortó al bajarlo). Vuelve a bajarlo y prueba otra vez.');
    if (tam < 22) throw empiezaComoZip() ? incompleto() : noEsZip();
    const cola = leerEn(Math.max(0, tam - 65557), Math.min(tam, 65557));
    let fin = -1;
    for (let i = cola.length - 22; i >= 0; i--) {
      if (cola.readUInt32LE(i) === SIG_FIN) {
        fin = i;
        break;
      }
    }
    if (fin < 0) throw empiezaComoZip() ? incompleto() : noEsZip();
    const cuantas = cola.readUInt16LE(fin + 10);
    const tamCentral = cola.readUInt32LE(fin + 12);
    const desdeCentral = cola.readUInt32LE(fin + 16);
    if (cuantas === 0xffff || tamCentral === 0xffffffff || desdeCentral === 0xffffffff) {
      throw new ErrorActualizar('Ese zip usa un formato que la app no lee (zip64). Usa el anuncios-con-ia-app.zip tal como lo recibiste, sin volver a comprimirlo.');
    }
    if (desdeCentral + tamCentral > tam) throw new ErrorActualizar('El paquete está incompleto (se cortó al bajarlo). Vuelve a bajarlo y prueba otra vez.');
    const central = leerEn(desdeCentral, tamCentral);
    const entradas = [];
    let p = 0;
    for (let i = 0; i < cuantas; i++) {
      if (p + 46 > central.length || central.readUInt32LE(p) !== SIG_CENTRAL) throw new ErrorActualizar('El paquete está dañado. Vuelve a bajarlo y prueba otra vez.');
      const hechoEn = central.readUInt8(p + 5);
      const banderas = central.readUInt16LE(p + 8);
      const metodo = central.readUInt16LE(p + 10);
      const crc = central.readUInt32LE(p + 16);
      const comprimido = central.readUInt32LE(p + 20);
      const tamano = central.readUInt32LE(p + 24);
      const largoNombre = central.readUInt16LE(p + 28);
      const largoExtra = central.readUInt16LE(p + 30);
      const largoComentario = central.readUInt16LE(p + 32);
      const atributos = central.readUInt32LE(p + 38);
      const desde = central.readUInt32LE(p + 42);
      const nombre = nombreDe(central.subarray(p + 46, p + 46 + largoNombre), Boolean(banderas & 0x800)).replace(/\\/g, '/');
      entradas.push({ nombre, carpeta: nombre.endsWith('/'), metodo, crc, comprimido, tamano, atributos, hechoEn, cifrado: Boolean(banderas & 1), desde });
      p += 46 + largoNombre + largoExtra + largoComentario;
    }
    /** El contenido de una entrada, descomprimido y con su CRC comprobado. */
    const leer = (e) => {
      if (e.carpeta) return Buffer.alloc(0);
      if (e.cifrado) throw new ErrorActualizar('El paquete viene con contraseña: usa el anuncios-con-ia-app.zip tal como lo recibiste.');
      const local = leerEn(e.desde, 30);
      if (local.readUInt32LE(0) !== SIG_LOCAL) throw new ErrorActualizar('El paquete está dañado. Vuelve a bajarlo y prueba otra vez.');
      const inicio = e.desde + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
      const crudo = e.comprimido ? leerEn(inicio, e.comprimido) : Buffer.alloc(0);
      let datos;
      if (e.metodo === 0) datos = crudo;
      else if (e.metodo === 8) {
        try {
          datos = zlib.inflateRawSync(crudo);
        } catch {
          throw new ErrorActualizar(`El paquete está dañado (no se puede descomprimir ${e.nombre}). Vuelve a bajarlo y prueba otra vez.`);
        }
      } else throw new ErrorActualizar('Ese zip usa un tipo de compresión que la app no lee. Usa el anuncios-con-ia-app.zip tal como lo recibiste.');
      if (datos.length !== e.tamano || zlib.crc32(datos) !== e.crc) {
        throw new ErrorActualizar(`El paquete está dañado (${e.nombre} no coincide). Vuelve a bajarlo y prueba otra vez.`);
      }
      return datos;
    };
    return { entradas, leer, cerrar };
  } catch (e) {
    cerrar();
    throw e;
  }
}

// ---------------------------------------------------------------- revisar un paquete

/** La VERSION instalada (null si no hay: una copia sin paquete). */
export function versionInstalada(raiz = RAIZ) {
  try {
    const v = fs.readFileSync(path.join(raiz, 'VERSION'), 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/)[0].trim();
    return RE_VERSION.test(v) ? v : null;
  } catch {
    return null;
  }
}

/** true en la copia de desarrollo (la que tiene .git): ahi no se actualiza desde la app. */
export const esCopiaDeDesarrollo = (raiz = RAIZ) => fs.existsSync(path.join(raiz, '.git')) && process.env.AIA_ACTUALIZAR_EN_GIT !== '1';

/** Una ruta de dentro del zip que no puede salirse de la carpeta de la app. */
function rutaSegura(rel) {
  if (!rel || rel.includes('\0')) return false;
  if (/^[a-z]:/i.test(rel) || rel.startsWith('/')) return false;
  return rel.split('/').every((p) => p !== '..' && p !== '.' && p !== '');
}

/** La entrada "## <version>" de CAMBIOS.md (lo que trae esa version), sin el titulo. */
export function notasDe(cambios, version) {
  if (!cambios) return null;
  const lineas = cambios.replace(/\r\n/g, '\n').split('\n');
  const i = lineas.findIndex((l) => l.trim() === `## ${version}`);
  if (i < 0) return null;
  const resto = [];
  for (const l of lineas.slice(i + 1)) {
    if (/^## /.test(l)) break;
    resto.push(l);
  }
  return resto.join('\n').trim() || null;
}

/**
 * Abre el zip y comprueba que sea un paquete de esta app, entero y mas nuevo que el instalado.
 * Con { comprobarTodo: true } ademas descomprime cada archivo y compara su CRC (unos segundos con 300 MB): asi un
 * paquete danado se rechaza ANTES de pedirle al alumno que confirme, y no recien al aplicarlo.
 * Devuelve { zip, version, versionActual, archivos: Map(rel -> entrada), notas }. El que llama cierra el zip.
 * Lanza ErrorActualizar (con un mensaje para el alumno) si no sirve.
 */
export function revisarPaquete(rutaZip, raiz = RAIZ, { comprobarTodo = false } = {}) {
  const zip = abrirZip(rutaZip);
  try {
    // La carpeta de arriba ("Anuncios con IA/", o la que sea): donde esta VERSION junto a los lanzadores.
    const nombres = new Set(zip.entradas.filter((e) => !e.carpeta).map((e) => e.nombre));
    const candidatos = [...nombres]
      .filter((n) => n === 'VERSION' || n.endsWith('/VERSION'))
      .map((n) => n.slice(0, -'VERSION'.length))
      .filter((pre) => !pre.startsWith('__MACOSX/'))
      .sort((a, b) => a.length - b.length);
    const prefijo = candidatos.find((pre) => LANZADORES.some((l) => nombres.has(pre + l)));
    if (prefijo === undefined) {
      throw new ErrorActualizar('Ese zip no es un paquete de Anuncios con IA. Elige el archivo anuncios-con-ia-app.zip que recibiste.');
    }
    const archivos = new Map();
    for (const e of zip.entradas) {
      if (e.carpeta || !e.nombre.startsWith(prefijo)) continue;
      const rel = e.nombre.slice(prefijo.length);
      if (!rutaSegura(rel)) throw new ErrorActualizar('Ese zip trae rutas que no son de la app. No se cambió nada.');
      archivos.set(rel, e);
    }
    const faltan = IMPRESCINDIBLES.filter((r) => !archivos.has(r));
    if (faltan.length) {
      throw new ErrorActualizar(`Ese zip no es un paquete completo de Anuncios con IA (le falta ${faltan[0]}). Elige el archivo anuncios-con-ia-app.zip que recibiste.`);
    }
    const version = zip.leer(archivos.get('VERSION')).toString('utf8').replace(/^﻿/, '').trim().split(/\r?\n/)[0].trim();
    if (!RE_VERSION.test(version)) throw new ErrorActualizar('Ese paquete no dice qué versión es. Vuelve a bajarlo y prueba otra vez.');
    const versionActual = versionInstalada(raiz);
    if (versionActual && version === versionActual) throw new ErrorActualizar(`Ya tienes esta versión (${version}). No hace falta actualizar.`);
    if (versionActual && version < versionActual) {
      throw new ErrorActualizar(`Ese paquete es de una versión más vieja (${version}) que la que tienes (${versionActual}). No se cambió nada.`);
    }
    let notas = null;
    if (archivos.has('CAMBIOS.md')) notas = notasDe(zip.leer(archivos.get('CAMBIOS.md')).toString('utf8'), version);
    if (comprobarTodo) for (const e of archivos.values()) zip.leer(e); // lanza "El paquete está dañado (...)" si algo no coincide
    return { zip, version, versionActual, archivos, notas };
  } catch (e) {
    zip.cerrar();
    throw e;
  }
}

// ---------------------------------------------------------------- aplicar

const fechaCarpeta = (d = new Date()) => {
  const dos = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}_${dos(d.getHours())}-${dos(d.getMinutes())}-${dos(d.getSeconds())}`;
};

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
function igualAlActual(abs, datos) {
  try {
    const st = fs.statSync(abs);
    if (!st.isFile() || st.size !== datos.length) return false;
    return sha(fs.readFileSync(abs)) === sha(datos);
  } catch {
    return false;
  }
}

/** Todos los archivos de una carpeta (relativos a la raiz, con /), sin entrar a lo del alumno. */
function archivosEn(raiz, base) {
  const salida = [];
  const recorrer = (rel) => {
    let hijos;
    try {
      hijos = fs.readdirSync(path.join(raiz, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const d of hijos) {
      const r = `${rel}/${d.name}`;
      if (delAlumno(r)) continue;
      if (d.isDirectory()) recorrer(r);
      else if (d.isFile()) salida.push(r);
    }
  };
  recorrer(base.replace(/\/$/, ''));
  return salida;
}

/** Lo que el paquete instalado dice que trajo (su lista), o null si no la tiene. */
function listaInstalada(raiz) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(raiz, LISTA_DEL_PAQUETE), 'utf8'));
    return Array.isArray(j?.archivos) ? j.archivos.filter((r) => typeof r === 'string') : null;
  } catch {
    return null;
  }
}

const esEjecutable = (rel) => /\.(command|sh)$/i.test(rel);

/** Quita las carpetas que quedaron vacias, de abajo hacia arriba, sin salir de su zona. */
function quitarVacias(raiz, rels) {
  const carpetas = new Set();
  for (const r of rels) {
    let d = path.posix.dirname(r);
    while (d && d !== '.' && ZONAS_DEL_SISTEMA.some((z) => `${d}/`.startsWith(z) && `${d}/` !== z)) {
      carpetas.add(d);
      d = path.posix.dirname(d);
    }
  }
  for (const d of [...carpetas].sort((a, b) => b.length - a.length)) {
    try {
      fs.rmdirSync(path.join(raiz, d));
    } catch {
      /* no estaba vacia */
    }
  }
}

let enCurso = false;
export const actualizando = () => enCurso;

/**
 * Despues de aplicar una version nueva, el servidor que sigue corriendo es el de antes y el motor (produccion/) ya es
 * el nuevo: hasta cerrar y volver a abrir el lanzador no se empieza ni se retoma nada (rutas/actualizar.js frena las
 * peticiones que cambian algo). null si no hace falta reabrir.
 */
let reabrirPendiente = null;
export const hayQueReabrir = () => reabrirPendiente;

/** Cuantas carpetas de respaldos/ se guardan (las mas nuevas). */
const RESPALDOS_QUE_QUEDAN = 3;
/** Lo que no se guarda en el respaldo una vez que la actualizacion salio bien: no es del alumno y viene en cada paquete. */
const SIN_RESPALDO = ['app/muestras'];

/**
 * Una actualizacion que salio bien: su respaldo se queda sin los videos de muestra (pesan cientos de MB y vuelven con
 * cualquier paquete; durante la actualizacion si estaban, para poder volver atras) y de respaldos/ se borran las
 * carpetas mas viejas, dejando las RESPALDOS_QUE_QUEDAN mas nuevas.
 */
function aligerarRespaldos(raiz, dirRespaldo) {
  for (const rel of SIN_RESPALDO) {
    try {
      fs.rmSync(path.join(dirRespaldo, rel), { recursive: true, force: true });
    } catch {
      /* queda */
    }
  }
  try {
    fs.rmdirSync(path.join(dirRespaldo, 'app')); // solo si quedo vacia
  } catch {
    /* tiene otros archivos, o no estaba */
  }
  let carpetas = [];
  try {
    carpetas = fs.readdirSync(path.join(raiz, RESPALDOS), { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}_/.test(d.name)).map((d) => d.name).sort();
  } catch {
    return;
  }
  for (const c of carpetas.slice(0, Math.max(0, carpetas.length - RESPALDOS_QUE_QUEDAN))) {
    try {
      fs.rmSync(path.join(raiz, RESPALDOS, c), { recursive: true, force: true });
    } catch {
      /* queda para la proxima */
    }
  }
}

/**
 * Aplica el paquete. Devuelve lo que hizo:
 * { versionAnterior, version, reemplazados, nuevos, quitados, iguales, respaldo, dependencias, notas }.
 * Si el paquete no sirve, lanza ErrorActualizar sin tocar nada. Si algo falla mientras reemplaza,
 * vuelve a dejar lo de antes y lanza ErrorActualizar.
 */
export function aplicarActualizacion(rutaZip, raiz = RAIZ) {
  if (enCurso) throw new ErrorActualizar('Ya se está actualizando la app. Espera a que termine.', 409);
  if (esCopiaDeDesarrollo(raiz)) throw new ErrorActualizar('Esta es la copia de desarrollo de la app: aquí no se actualiza desde un paquete.', 409);
  enCurso = true;
  const fecha = fechaCarpeta();
  const dirTrabajo = path.join(raiz, TRABAJO, fecha);
  const dirRespaldo = path.join(raiz, RESPALDOS, fecha);
  let paquete = null;
  try {
    paquete = revisarPaquete(rutaZip, raiz);
    const { zip, version, versionActual, archivos, notas } = paquete;

    // Espacio: lo que pesa descomprimido, dos veces (lo nuevo y el respaldo), con margen.
    const total = [...archivos.values()].reduce((s, e) => s + e.tamano, 0);
    try {
      const libre = fs.statfsSync(raiz);
      if (Number(libre.bavail) * Number(libre.bsize) < total * 2 + 200 * 1024 * 1024) {
        throw new ErrorActualizar('No hay espacio suficiente en el disco para actualizar. Libera espacio y vuelve a intentarlo. No se cambió nada.');
      }
    } catch (e) {
      if (e instanceof ErrorActualizar) throw e;
      /* sin statfs: se sigue */
    }

    // 1. Lo nuevo a la carpeta de trabajo (solo lo que cambia). Cada archivo se descomprime y se comprueba.
    const cambian = []; // [{ rel, nuevo: bool }]
    let iguales = 0;
    let listaNueva = null;
    for (const [rel, e] of archivos) {
      if (delAlumno(rel)) continue;
      const datos = zip.leer(e);
      if (rel === LISTA_DEL_PAQUETE) {
        try {
          listaNueva = JSON.parse(datos.toString('utf8')).archivos;
        } catch {
          listaNueva = null;
        }
      }
      const destino = path.join(raiz, rel);
      if (igualAlActual(destino, datos)) {
        iguales++;
        continue;
      }
      const tmp = path.join(dirTrabajo, rel);
      fs.mkdirSync(path.dirname(tmp), { recursive: true });
      fs.writeFileSync(tmp, datos, esEjecutable(rel) ? { mode: 0o755 } : undefined);
      cambian.push({ rel, nuevo: !fs.existsSync(destino) });
    }
    zip.cerrar();

    // 2. Lo que la version nueva ya no trae: lo del sistema que trajo el paquete anterior (segun su lista;
    // sin lista, lo que hay en las zonas del sistema), solo dentro de esas zonas y nunca lo del alumno.
    const enElNuevo = new Set(archivos.keys());
    const anteriores = listaInstalada(raiz) || ZONAS_DEL_SISTEMA.flatMap((z) => archivosEn(raiz, z));
    const quitar = [...new Set(anteriores)].filter(
      (rel) => rutaSegura(rel) && !delAlumno(rel) && !enElNuevo.has(rel) && ZONAS_DEL_SISTEMA.some((z) => rel.startsWith(z)) && fs.existsSync(path.join(raiz, rel))
    );

    // 3. El respaldo de todo lo que se va a reemplazar o quitar (copia: lo de ahora sigue en su lugar).
    const respaldar = [...cambian.filter((c) => !c.nuevo).map((c) => c.rel), ...quitar];
    for (const rel of respaldar) {
      const r = path.join(dirRespaldo, rel);
      fs.mkdirSync(path.dirname(r), { recursive: true });
      fs.copyFileSync(path.join(raiz, rel), r);
    }

    // 4. Reemplazar, con VERSION al final. Si algo falla, se vuelve a lo de antes.
    cambian.sort((a, b) => (a.rel === 'VERSION') - (b.rel === 'VERSION'));
    const hechos = [];
    try {
      for (const c of cambian) {
        const destino = path.join(raiz, c.rel);
        const tmp = path.join(dirTrabajo, c.rel);
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        try {
          fs.renameSync(tmp, destino);
        } catch {
          fs.copyFileSync(tmp, destino);
        }
        if (esEjecutable(c.rel) && process.platform !== 'win32') fs.chmodSync(destino, 0o755);
        hechos.push(c);
      }
      for (const rel of quitar) fs.rmSync(path.join(raiz, rel), { force: true });
    } catch (e) {
      for (const c of hechos) {
        const destino = path.join(raiz, c.rel);
        try {
          if (c.nuevo) fs.rmSync(destino, { force: true });
          else fs.copyFileSync(path.join(dirRespaldo, c.rel), destino);
        } catch {
          /* se intenta con el resto */
        }
      }
      for (const rel of quitar) {
        const destino = path.join(raiz, rel);
        if (!fs.existsSync(destino)) {
          try {
            fs.copyFileSync(path.join(dirRespaldo, rel), destino);
          } catch {
            /* se intenta con el resto */
          }
        }
      }
      throw new ErrorActualizar(
        `No pude reemplazar los archivos de la app (${e.code || e.message}). Se dejó todo como estaba. Cierra los programas que puedan tener abierta la carpeta de la app y vuelve a intentarlo.`,
        500
      );
    }
    quitarVacias(raiz, quitar);

    const dependencias = cambian.some((c) => /(^|\/)package(-lock)?\.json$/.test(c.rel) && !c.rel.includes('/server/'));
    const resultado = {
      versionAnterior: versionActual,
      version,
      reemplazados: cambian.filter((c) => !c.nuevo).length,
      nuevos: cambian.filter((c) => c.nuevo).length,
      quitados: quitar.length,
      iguales,
      respaldo: respaldar.length ? `${RESPALDOS}/${fecha}` : null,
      dependencias,
      notas,
      fecha: new Date().toISOString(),
    };
    if (respaldar.length) {
      fs.writeFileSync(
        path.join(dirRespaldo, 'actualizacion.json'),
        `${JSON.stringify(
          {
            ...resultado,
            archivos: {
              reemplazados: cambian.filter((c) => !c.nuevo).map((c) => c.rel),
              nuevos: cambian.filter((c) => c.nuevo).map((c) => c.rel),
              quitados: quitar,
            },
            listaNueva: Array.isArray(listaNueva) ? listaNueva.length : null,
          },
          null,
          1
        )}\n`
      );
    }
    aligerarRespaldos(raiz, dirRespaldo);
    reabrirPendiente = { version, desde: versionActual };
    return resultado;
  } finally {
    paquete?.zip?.cerrar();
    fs.rmSync(dirTrabajo, { recursive: true, force: true });
    try {
      fs.rmdirSync(path.join(raiz, TRABAJO));
    } catch {
      /* quedan subidas u otra actualizacion */
    }
    enCurso = false;
  }
}

/** La ultima actualizacion hecha (de su respaldo), para Acerca de. null si nunca se actualizo. */
export function ultimaActualizacion(raiz = RAIZ) {
  let carpetas = [];
  try {
    carpetas = fs.readdirSync(path.join(raiz, RESPALDOS)).filter((n) => /^\d{4}-\d{2}-\d{2}_/.test(n)).sort();
  } catch {
    return null;
  }
  for (const c of carpetas.reverse()) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(raiz, RESPALDOS, c, 'actualizacion.json'), 'utf8'));
      return { version: j.version, versionAnterior: j.versionAnterior, fecha: j.fecha, respaldo: `${RESPALDOS}/${c}` };
    } catch {
      /* otra carpeta */
    }
  }
  return null;
}

// ---------------------------------------------------------------- subidas

export const DIR_SUBIDAS = path.join(RAIZ, TRABAJO, 'subidas');
export const RE_ID_SUBIDA = /^[a-f0-9]{24}$/;
export const rutaSubida = (id) => path.join(DIR_SUBIDAS, `${id}.zip`);
export const nuevoIdSubida = () => crypto.randomBytes(12).toString('hex');

/** Borra las subidas que quedaron (menos `salvo`). */
export function limpiarSubidas(salvo = null) {
  let lista = [];
  try {
    lista = fs.readdirSync(DIR_SUBIDAS);
  } catch {
    return;
  }
  for (const n of lista) if (n !== (salvo ? `${salvo}.zip` : null)) fs.rmSync(path.join(DIR_SUBIDAS, n), { force: true });
  // Sin subidas no queda la carpeta de trabajo (rmdir solo quita carpetas vacias).
  for (const d of [DIR_SUBIDAS, path.dirname(DIR_SUBIDAS)]) {
    try {
      fs.rmdirSync(d);
    } catch {
      /* no estaba vacia */
    }
  }
}

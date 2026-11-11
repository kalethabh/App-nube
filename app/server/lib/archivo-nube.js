// Copias verificadas de medios. La carpeta sincronizada confirma una copia local;
// Google Drive/Dropbox/OneDrive se encargan de subirla después.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { escribirJSONSeguro } from './archivos.js';

const MEDIO = /\.(mp4|mov|webm|m4v|mp3|wav|m4a|aac|ogg|flac|png|jpe?g|webp)$/i;
const VIDEO = /\.(mp4|mov|webm|m4v|mp3|wav|m4a|aac|ogg|flac)$/i;
const SLUG = /^(?:[a-z0-9][a-z0-9-]{2,160}|_img-[a-z0-9-]+)$/;
const MARCA = 'en-la-nube.json';
const dentro = (base, ruta) => {
  const rel = path.relative(base, ruta);
  return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
};
const relativo = (rel) => typeof rel === 'string' && rel.length > 0 && !rel.includes('\\') && !rel.includes('\0') && !path.posix.isAbsolute(rel) && !/^[a-z]:/i.test(rel) && rel.split('/').every((p) => p && p !== '.' && p !== '..');
const leer = (f) => {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
};

export function huella(archivo) {
  if (!fs.lstatSync(archivo).isFile()) throw new Error('El archivo no es un archivo normal.');
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(archivo, 'r');
  const bloque = Buffer.allocUnsafe(1024 * 1024);
  let bytes = 0;
  try {
    let n;
    while ((n = fs.readSync(fd, bloque, 0, bloque.length, null)) > 0) {
      bytes += n;
      hash.update(bloque.subarray(0, n));
    }
  } finally { fs.closeSync(fd); }
  return { bytes, sha256: hash.digest('hex') };
}
const igual = (a, b) => a.bytes === b.bytes && a.sha256 === b.sha256;

/** No deja un destino parcial, ni confunde dos archivos distintos del mismo tamaño. */
export function copiarVerificado(origen, destino, { raiz, copiar = fs.copyFileSync } = {}) {
  if (path.resolve(origen) === path.resolve(destino)) throw new Error('El destino coincide con el original.');
  let raizReal = null;
  if (raiz) {
    raizReal = fs.realpathSync(raiz); // No recrear una unidad de nube desconectada.
    if (!dentro(raizReal, path.resolve(destino))) throw new Error('El destino está fuera de la carpeta elegida.');
    // Comprobar el ancestro existente ANTES de crear subcarpetas: un enlace
    // a otra unidad tampoco debe recibir directorios vacíos fuera del destino.
    let antecesor = path.dirname(path.resolve(destino));
    while (true) {
      try {
        const st = fs.lstatSync(antecesor);
        if (!st.isDirectory() && !st.isSymbolicLink()) throw new Error('El destino no es una carpeta.');
        if (!dentro(raizReal, fs.realpathSync(antecesor))) throw new Error('El destino está fuera de la carpeta elegida.');
        break;
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
        // Un enlace roto cuenta como un destino no disponible; no se recrea.
        try {
          if (fs.lstatSync(antecesor).isSymbolicLink()) throw new Error('La carpeta de destino es un enlace no disponible.');
        } catch (err) { if (err.code !== 'ENOENT') throw err; }
        const arriba = path.dirname(antecesor);
        if (arriba === antecesor) throw e;
        antecesor = arriba;
      }
    }
  }
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  if (raizReal && !dentro(raizReal, fs.realpathSync(path.dirname(destino)))) throw new Error('El destino está fuera de la carpeta elegida.');
  try {
    if (fs.lstatSync(destino).isSymbolicLink()) throw new Error('El destino es un enlace a otro archivo.');
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const original = huella(origen);
  if (fs.existsSync(destino) && igual(original, huella(destino))) return { ...original, nuevo: false };
  const tmp = `${destino}.${crypto.randomUUID()}.tmp`;
  try {
    copiar(origen, tmp, fs.constants.COPYFILE_EXCL);
    if (!igual(original, huella(tmp)) || !igual(original, huella(origen))) throw new Error('El archivo cambió mientras se copiaba. Se conserva el original.');
    const fd = fs.openSync(tmp, 'r+');
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(tmp, destino);
    if (!igual(original, huella(destino))) throw new Error('No se pudo comprobar la copia. Se conserva el original.');
    return { ...original, nuevo: true };
  } finally { fs.rmSync(tmp, { force: true }); }
}

/** Se puede probar con carpetas aisladas, sin GitHub, cuentas ni anuncios reales. */
export function crearArchivador({ temp, output, ocupado = () => false, guardarMarca = escribirJSONSeguro, copiar = copiarVerificado }) {
  const rutaMarca = (slug) => path.join(temp, slug, 'app', MARCA);
  const marca = (slug) => SLUG.test(slug) ? leer(rutaMarca(slug)) : null;
  const trabajos = () => {
    if (!fs.existsSync(temp)) return [];
    return fs.readdirSync(temp, { withFileTypes: true }).filter((d) => d.isDirectory() && SLUG.test(d.name)).map((d) => d.name).filter((s) =>
      ['manifiesto.json', 'lote.json', 'app/brief.json', 'app/cambio-estado.json', 'app/sketch-estado.json'].some((f) => fs.existsSync(path.join(temp, s, f)))
    );
  };
  const sePuedeLiberar = (slug) => {
    const c = leer(path.join(temp, slug, 'app', 'conductor.json'));
    // Estos videos tienen restauración integrada. Los otros tipos mantienen sus
    // originales para sus galerías, aunque también se copian a la carpeta elegida.
    return !slug.startsWith('_') && c?.estado === 'listo' && c.familia !== 'imagen-ads' && !ocupado(slug)
      && !fs.existsSync(path.join(temp, slug, 'app', 'cambio-estado.json'))
      && !fs.existsSync(path.join(temp, slug, 'app', 'sketch-estado.json'));
  };
  const archivos = (slug) => {
    const base = path.join(temp, slug);
    const lista = [];
    const visitar = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith('.') || ['node_modules', 'render-public', 'publico-render'].includes(e.name)) continue;
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) visitar(abs);
        else if (e.isFile() && MEDIO.test(e.name) && abs !== path.join(base, 'portada.jpg')) lista.push({ abs, rel: path.relative(base, abs).split(path.sep).join('/') });
      }
    };
    visitar(base);
    return lista;
  };
  function nuevaMarca(slug, base, entrada, esFinal) {
    const anterior = marca(slug) || {};
    const carpeta = anterior.carpeta || path.join(base, slug);
    const ubicaciones = { ...anterior.ubicaciones };
    const ubicacionesFinales = { ...anterior.ubicacionesFinales };
    // Registrar también el destino de marcas de versiones anteriores, antes de
    // añadir medios en otra carpeta. Cambiar de destino no los deja huérfanos.
    for (const rel of anterior.archivos || []) if (relativo(rel) && !ubicaciones[rel]) ubicaciones[rel] = { archivo: path.join(carpeta, ...rel.split('/')) };
    for (const f of anterior.finales || []) if (relativo(f) && path.basename(f) === f && !ubicacionesFinales[f]) ubicacionesFinales[f] = { archivo: path.join(path.dirname(carpeta), 'videos-finales', f) };
    const campo = esFinal ? 'finales' : 'archivos';
    (esFinal ? ubicacionesFinales : ubicaciones)[entrada.rel] = entrada.ubicacion;
    return { ...anterior, carpeta, archivos: anterior.archivos || [], finales: anterior.finales || [], ubicaciones, ubicacionesFinales,
      [campo]: [...new Set([...(anterior[campo] || []), entrada.rel])], fecha: new Date().toISOString() };
  }

  async function respaldar({ destino, liberarEspacio = false, alLiberar }) {
    const base = fs.realpathSync(destino);
    if (!fs.statSync(base).isDirectory()) throw new Error('La carpeta elegida no está disponible.');
    if ([temp, output].some((p) => dentro(path.resolve(p), base) || dentro(base, path.resolve(p)))) throw new Error('Elige una carpeta fuera de los archivos de trabajo de la app.');
    const resumen = { copiados: 0, liberados: 0, bytes: 0, fallos: [] };
    const slugs = trabajos();
    async function uno(slug, f, esFinal = false) {
      const destinoArchivo = path.join(base, esFinal ? 'videos-finales' : slug, ...f.rel.split('/'));
      try {
        const prueba = copiar(f.abs, destinoArchivo, { raiz: base });
        if (prueba.nuevo) resumen.copiados++;
        if (liberarEspacio && slug && sePuedeLiberar(slug)) {
          const registro = nuevaMarca(slug, base, { rel: f.rel, ubicacion: { archivo: destinoArchivo, bytes: prueba.bytes, sha256: prueba.sha256 } }, esFinal);
          guardarMarca(rutaMarca(slug), registro); // Siempre ANTES de quitar el original.
          if (!igual(prueba, huella(f.abs)) || !igual(prueba, huella(destinoArchivo))) throw new Error('El archivo cambió: se conserva el original.');
          if (!sePuedeLiberar(slug)) return;
          fs.rmSync(f.abs);
          resumen.liberados++;
          resumen.bytes += prueba.bytes;
        }
      } catch (e) { resumen.fallos.push({ archivo: `${slug || 'videos-finales'}/${f.rel}`, mensaje: e.message }); }
      await new Promise((r) => setImmediate(r));
    }
    for (const slug of slugs) {
      const lista = archivos(slug);
      if (liberarEspacio && sePuedeLiberar(slug)) alLiberar?.(slug, lista);
      for (const f of lista) await uno(slug, f);
    }
    if (fs.existsSync(output)) {
      for (const e of fs.readdirSync(output, { withFileTypes: true })) {
        if (!e.isFile() || !VIDEO.test(e.name)) continue;
        const slug = slugs.filter((s) => e.name.startsWith(`${s}_`)).sort((a, b) => b.length - a.length)[0] || null;
        await uno(slug, { abs: path.join(output, e.name), rel: e.name }, true);
      }
    }
    return resumen;
  }

  function restaurar(slug) {
    const m = marca(slug);
    if (!m) return { ok: true, nada: true };
    const faltan = [];
    const fallo = () => ({ ok: false, faltan, mensaje: `No pude recuperar ${faltan.length} archivo(s). Revisa que la carpeta guardada esté disponible y que Drive esté abierto, y vuelve a intentarlo.` });
    if (typeof m !== 'object' || Array.isArray(m) || (m.archivos !== undefined && !Array.isArray(m.archivos)) || (m.finales !== undefined && !Array.isArray(m.finales))) {
      faltan.push('registro de archivos');
      return fallo();
    }
    const traer = (rel, final) => {
      if (!relativo(rel) || !MEDIO.test(rel) || (final && path.basename(rel) !== rel)) { faltan.push(String(rel)); return; }
      try {
        const ubicacion = (final ? m.ubicacionesFinales : m.ubicaciones)?.[rel];
        let desde = ubicacion?.archivo;
        if (!desde) {
          if (typeof m.carpeta !== 'string' || !path.isAbsolute(m.carpeta)) throw new Error('El registro no tiene una carpeta válida.');
          desde = final ? path.join(path.dirname(m.carpeta), 'videos-finales', rel) : path.join(m.carpeta, ...rel.split('/'));
        }
        // Solo recuperar medios con su nombre original: una marca inválida no
        // puede convertir otro archivo (por ejemplo .env) en una imagen pública.
        if (typeof desde !== 'string' || !path.isAbsolute(desde) || path.basename(desde) !== path.posix.basename(rel) || !MEDIO.test(desde)) throw new Error('El registro de ese archivo no es válido.');
        const a = path.join(final ? output : path.join(temp, slug), ...rel.split('/'));
        if (fs.existsSync(a)) return; // Conservar una edición local posterior.
        if (ubicacion?.sha256 && !igual(ubicacion, huella(desde))) throw new Error('La copia guardada cambió.');
        copiar(desde, a, { raiz: final ? output : path.join(temp, slug) });
      } catch { faltan.push(rel); }
    };
    try { fs.mkdirSync(output, { recursive: true }); } catch { faltan.push('carpeta de videos terminados'); return fallo(); }
    for (const rel of m.archivos || []) traer(rel, false);
    for (const rel of m.finales || []) traer(rel, true);
    if (faltan.length) return fallo();
    fs.rmSync(rutaMarca(slug), { force: true });
    return { ok: true };
  }
  return { marca, respaldar, restaurar };
}

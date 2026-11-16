// Actualizar la app con un paquete nuevo (Ajustes > Acerca de > "Actualizar la app"). Ver lib/actualizar.js.
//
// GET  /api/actualizar                     -> { version, desarrollo, ultima }
// POST /api/actualizar                     -> cuerpo: el zip tal cual (Content-Type: application/zip). Lo revisa y
//                                             lo aplica de una vez; responde con lo que hizo.
// POST /api/actualizar?solo=revisar        -> lo revisa y lo guarda: { id, version, versionActual, notas }
// POST /api/actualizar/:id/aplicar         -> aplica el que se guardo con ?solo=revisar
// DELETE /api/actualizar/:id               -> el alumno cancelo: se borra el que se guardo
// GET  /api/actualizar/publica             -> { version, nueva, hayNueva, notas, bajando: { bytes, total } | null, error? }
//                                             la ultima version PUBLICADA (lib/actualizar-publico.js), para quien instalo
//                                             la app con el comando: el boton «Actualizar» de la barra
// POST /api/actualizar/publica             -> la baja y la aplica (lo mismo que subir su zip en Ajustes › Acerca de)
//
// Despues de aplicar, hasta que se cierre y se vuelva a abrir el lanzador, la app no acepta nada que cambie algo
// (POST, PUT, PATCH, DELETE fuera de esta ruta): el servidor que corre es el de antes y el motor ya es el nuevo.
//
// El zip llega como el cuerpo crudo (no como formulario): asi no hace falta ninguna dependencia y el
// paquete (200 MB o mas) va directo a un archivo, sin pasar entero por la memoria. Solo se aceptan
// tipos de zip y binario: un formulario de otra pagina web no puede mandarlo (el navegador pide
// permiso antes, y esta app no se lo da), y si viene un Origin tiene que ser el de esta app.
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { HOST, PUERTO } from '../lib/rutas.js';
import { origenesPermitidos } from '../lib/servidor.js';
import {
  ErrorActualizar,
  aplicarActualizacion,
  actualizando,
  esCopiaDeDesarrollo,
  limpiarSubidas,
  nuevoIdSubida,
  revisarPaquete,
  hayQueReabrir,
  rutaSubida,
  DIR_SUBIDAS,
  RE_ID_SUBIDA,
  ultimaActualizacion,
  versionInstalada,
} from '../lib/actualizar.js';
import { ultimaPublicada, bajarPaquete, avance, esMasNueva } from '../lib/actualizar-publico.js';

const TOPE_BYTES = 4 * 1024 * 1024 * 1024 - 1; // un zip sin zip64 no pasa de 4 GB
const TIPOS = /^(application\/(zip|x-zip|x-zip-compressed|octet-stream))(\s*;.*)?$/i;
const ORIGENES = origenesPermitidos(PUERTO); // el mismo chequeo en toda la app (lib/servidor.js), con el dominio del servidor si lo hay

function permitido(req) {
  if (!TIPOS.test(String(req.headers['content-type'] || ''))) {
    return 'Manda el paquete tal cual (el archivo .zip).';
  }
  const origen = req.headers.origin;
  if (origen && !ORIGENES.has(String(origen).toLowerCase())) return 'Solo desde esta app.';
  return null;
}

/**
 * Algo produciendose ahora: mientras tanto no se cambian los archivos del motor. (El conductor se importa recien aqui
 * para no cambiar el orden en que el servidor carga sus modulos: esta ruta se carga primera, por orden alfabetico.)
 */
async function algoEnMarcha() {
  try {
    const { estadoDeLaFila } = await import('../lib/conductor.js');
    const f = estadoDeLaFila();
    return f.activos.length + f.fila.length + (f.esperandoAClaude?.length || 0) + (f.procesos?.corriendo?.length || 0) > 0;
  } catch {
    return false;
  }
}

/** Guarda el cuerpo de la peticion en un archivo nuevo de subidas. Devuelve { id, ruta }. */
async function guardarSubida(req) {
  fs.mkdirSync(DIR_SUBIDAS, { recursive: true });
  const id = nuevoIdSubida();
  const ruta = rutaSubida(id);
  let bytes = 0;
  const contar = new Transform({
    transform(trozo, _cod, listo) {
      bytes += trozo.length;
      if (bytes > TOPE_BYTES) return listo(new ErrorActualizar('El archivo es demasiado grande para ser un paquete de la app.', 413));
      listo(null, trozo);
    },
  });
  try {
    await pipeline(req, contar, fs.createWriteStream(ruta));
  } catch (e) {
    fs.rmSync(ruta, { force: true });
    if (e instanceof ErrorActualizar) throw e;
    throw new ErrorActualizar('El paquete no terminó de llegar. Vuelve a intentarlo.');
  }
  if (!bytes) {
    fs.rmSync(ruta, { force: true });
    throw new ErrorActualizar('No llegó ningún archivo. Elige el anuncios-con-ia-app.zip y vuelve a intentarlo.');
  }
  return { id, ruta };
}

function responderError(res, e) {
  if (e instanceof ErrorActualizar) return res.status(e.estado || 400).json({ error: e.message });
  console.error('[actualizar]', e?.stack || e);
  return res.status(500).json({ error: 'No se pudo actualizar la app. No se cambió nada. Vuelve a intentarlo.' });
}

async function antesDeEmpezar() {
  const r = hayQueReabrir();
  if (r) throw new ErrorActualizar(mensajeReabrir(r), 409);
  if (esCopiaDeDesarrollo()) throw new ErrorActualizar('Esta es la copia de desarrollo de la app: aquí no se actualiza desde un paquete.', 409);
  if (actualizando()) throw new ErrorActualizar('Ya se está actualizando la app. Espera a que termine.', 409);
  if (await algoEnMarcha()) {
    throw new ErrorActualizar('Hay anuncios produciéndose. Espera a que terminen (o detenlos) y vuelve a intentarlo: se retoman solos después.', 409);
  }
}

const mensajeReabrir = (r) =>
  `La app ya se actualizó a la versión ${r.version}. Para seguir, cierra la ventana del lanzador (la ventana de texto que quedó abierta junto a la app) y vuelve a abrir «Abrir Anuncios con IA».`;

function aplicar(res, ruta) {
  const r = aplicarActualizacion(ruta);
  limpiarSubidas();
  console.log(`[actualizar] ${r.versionAnterior || 'sin version'} -> ${r.version}: ${r.reemplazados} reemplazados, ${r.nuevos} nuevos, ${r.quitados} quitados${r.respaldo ? `, respaldo en ${r.respaldo}` : ''}.`);
  res.json({ ok: true, ...r, reabrir: true });
}

export default function rutasActualizar(app) {
  // Lo que quedo subido de una vez anterior (la app se cerro con el aviso abierto) no sirve: se borra al arrancar.
  limpiarSubidas();

  // Esta ruta se carga primera (orden alfabetico): este freno vale para todas las demas.
  app.use((req, res, next) => {
    const r = hayQueReabrir();
    if (!r || ['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.path.startsWith('/api/actualizar')) return next();
    res.status(409).json({ error: mensajeReabrir(r), reabrir: true });
  });

  // ------------------------------------------------------------ la version publicada (el boton «Actualizar» de la barra)
  app.get('/api/actualizar/publica', async (req, res) => {
    const version = versionInstalada();
    const r = hayQueReabrir();
    const u = await ultimaPublicada({ fresca: req.query.fresca === '1' });
    res.set('Cache-Control', 'no-store').json({
      version,
      nueva: u.version || null,
      hayNueva: !r && !u.error && esMasNueva(u.version, version),
      bytes: u.bytes || null,
      notas: u.notas || '',
      bajando: avance(),
      reabrir: r ? { version: r.version, mensaje: mensajeReabrir(r) } : null,
      ...(u.error ? { error: u.error } : {}),
    });
  });

  app.post('/api/actualizar/publica', async (req, res) => {
    const origen = req.headers.origin;
    if ((origen && !ORIGENES.has(String(origen).toLowerCase())) || String(req.headers['sec-fetch-site'] || '') === 'cross-site') return res.status(403).json({ error: 'Solo desde la app.' });
    let ruta = null;
    try {
      await antesDeEmpezar();
      const u = await ultimaPublicada({ fresca: true });
      if (u.error) throw new ErrorActualizar(u.error, 502);
      if (!esMasNueva(u.version, versionInstalada())) throw new ErrorActualizar('Ya tienes la última versión.', 409);
      fs.mkdirSync(DIR_SUBIDAS, { recursive: true });
      ruta = rutaSubida(nuevoIdSubida());
      try {
        await bajarPaquete(u.url, ruta, { esperados: u.bytes });
      } catch (e) {
        throw new ErrorActualizar(e?.message || 'No pude bajar la versión nueva. Vuelve a intentarlo.', 502);
      }
      await antesDeEmpezar(); // (por si algo arrancó mientras bajaba)
      aplicar(res, ruta);
    } catch (e) {
      if (ruta) fs.rmSync(ruta, { force: true });
      limpiarSubidas();
      responderError(res, e);
    }
  });

  app.get('/api/actualizar', (req, res) => {
    const r = hayQueReabrir();
    res.json({ version: versionInstalada(), desarrollo: esCopiaDeDesarrollo(), ultima: ultimaActualizacion(), reabrir: r ? { version: r.version, mensaje: mensajeReabrir(r) } : null });
  });

  app.post('/api/actualizar', async (req, res) => {
    const motivo = permitido(req);
    if (motivo) return res.status(415).json({ error: motivo });
    let subida = null;
    try {
      await antesDeEmpezar();
      limpiarSubidas();
      subida = await guardarSubida(req);
      if (req.query.solo === 'revisar') {
        // cada archivo con su CRC: uno danado se rechaza aqui, antes de pedir que confirme
        const p = revisarPaquete(subida.ruta, undefined, { comprobarTodo: true });
        p.zip.cerrar();
        return res.json({ id: subida.id, version: p.version, versionActual: p.versionActual, notas: p.notas });
      }
      aplicar(res, subida.ruta);
    } catch (e) {
      if (subida) fs.rmSync(subida.ruta, { force: true });
      limpiarSubidas();
      responderError(res, e);
    }
  });

  app.delete('/api/actualizar/:id', (req, res) => {
    const { id } = req.params;
    if (RE_ID_SUBIDA.test(id)) fs.rmSync(rutaSubida(id), { force: true });
    limpiarSubidas();
    res.json({ ok: true });
  });

  app.post('/api/actualizar/:id/aplicar', async (req, res) => {
    const { id } = req.params;
    const ruta = RE_ID_SUBIDA.test(id) ? rutaSubida(id) : null;
    if (!ruta || !fs.existsSync(ruta)) return res.status(404).json({ error: 'No encuentro el paquete que elegiste. Vuelve a elegirlo.' });
    try {
      await antesDeEmpezar();
      aplicar(res, ruta);
    } catch (e) {
      fs.rmSync(ruta, { force: true });
      limpiarSubidas();
      responderError(res, e);
    }
  });
}

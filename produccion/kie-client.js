// Cliente de la API de kie.ai.
// Patron documentado: createTask -> polling de recordInfo -> descargar el archivo.
// Docs: https://docs.kie.ai/market/common/get-task-detail

import fs from 'node:fs';
import path from 'node:path';
import {
  KIE,
  POLLING,
  TIMEOUT_VIDEO_MS,
  TOPE_ESPERA_IMAGEN_MS,
  TOPE_ESPERA_VIDEO_MS,
  LIMITE_CREACIONES,
  ADAPTADORES_IMAGEN,
  ADAPTADORES_VIDEO,
  requerirClave,
} from './config.js';

function clave() {
  return requerirClave('KIE_API_KEY', 'crea tu cuenta en kie.ai y copia la key desde https://kie.ai/api-key');
}

function cabeceras() {
  return {
    Authorization: `Bearer ${clave()}`,
    'Content-Type': 'application/json',
  };
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** "45 s" o "15 min", para los mensajes. */
const tiempo = (segundos) => (segundos < 120 ? `${segundos} s` : `${Math.round(segundos / 60)} min`);

// ---------------------------------------------------------------- crear

/**
 * LIMITADOR DE PEDIDOS NUEVOS (ventana deslizante, LIMITE_CREACIONES).
 *
 * kie.ai admite 20 createTask cada 10 s por cuenta. Con los pools (12 imagenes,
 * 10 videos en marcha) se pueden juntar muchos pedidos a la vez, asi que cada
 * creacion pide turno aqui. Es uno solo para todo el proceso (lo comparte todo
 * lo que llama a crearTarea). Ojo: es por PROCESO; dos procesos a la vez tienen
 * uno cada uno.
 *
 * Lo que kie cuenta es cuando LLEGA cada pedido, y eso no se sabe: se sabe
 * cuando salio y cuando volvio la respuesta. Por eso cada pedido cuenta desde
 * que sale hasta ventanaMs despues de su respuesta (en vuelo + marcas). Contar
 * desde la salida no alcanza: medido con 40 pedidos a la vez contra un servidor
 * local, los primeros llegaron tarde (abrir las conexiones) y en una ventana de
 * 10 s cayeron 22. Los turnos se dan de a uno, en una cadena de promesas, para
 * que dos pedidos que llegan juntos no vean el mismo hueco.
 */
const marcasDeCreacion = []; // cuando volvio cada pedido (respuesta o error), en orden
let creacionesEnVuelo = 0;
let colaDeTurnos = Promise.resolve();

/** Espera turno y devuelve la funcion que lo cierra (se llama al volver el pedido). */
function turnoDeCreacion() {
  const turno = colaDeTurnos.then(async () => {
    while (true) {
      const { maximo, ventanaMs } = LIMITE_CREACIONES;
      const ahora = Date.now();
      while (marcasDeCreacion.length && ahora - marcasDeCreacion[0] >= ventanaMs) marcasDeCreacion.shift();
      if (creacionesEnVuelo + marcasDeCreacion.length < maximo) {
        creacionesEnVuelo++;
        let cerrado = false;
        return () => {
          if (cerrado) return;
          cerrado = true;
          creacionesEnVuelo--;
          marcasDeCreacion.push(Date.now());
        };
      }
      // Con marcas, hasta que salga la mas vieja; si todo esta en vuelo, un rato corto.
      await dormir(marcasDeCreacion.length ? Math.max(marcasDeCreacion[0] + ventanaMs - ahora + 5, 5) : 50);
    }
  });
  colaDeTurnos = turno.catch(() => {});
  return turno;
}

/**
 * Esperas ante un 429 al crear (demasiadas solicitudes). Un 429 NO crea la
 * tarea, asi que reintentar la creacion no puede duplicar nada. Agotadas, sale
 * el error de siempre, que clasificarFallo lee como del servidor. Es un array
 * exportado para que las pruebas lo acorten.
 */
export const ESPERAS_429_MS = [5000, 10000, 20000, 40000];

/** Crea una tarea y devuelve el taskId. */
export async function crearTarea(modelo, input, { callBackUrl } = {}) {
  const cuerpo = { model: modelo, input };
  if (callBackUrl) cuerpo.callBackUrl = callBackUrl;

  for (let intento = 0; ; intento++) {
    // Cada intento es un pedido nuevo para kie, tambien el que sigue a un 429.
    const cerrarTurno = await turnoDeCreacion();
    let res;
    let texto;
    try {
      res = await fetch(KIE.base + KIE.crearTarea, {
        method: 'POST',
        headers: cabeceras(),
        body: JSON.stringify(cuerpo),
      });
      texto = await res.text();
    } finally {
      cerrarTurno();
    }
    let json = null;
    try {
      json = JSON.parse(texto);
    } catch {
      // se mira abajo: un 429 de un proxy puede venir sin JSON
    }

    // kie contesta casi todo con HTTP 200 y el codigo en el cuerpo: el 429 puede
    // venir de las dos maneras.
    if (res.status === 429 || Number(json?.code) === 429) {
      if (intento < ESPERAS_429_MS.length) {
        const espera = ESPERAS_429_MS[intento];
        console.log(`  ..  kie.ai pidio bajar el ritmo (429): repito el pedido en ${Math.round(espera / 1000)} s (un 429 no crea la tarea)`);
        await dormir(espera);
        continue;
      }
      throw new Error('kie.ai devolvio 429 (demasiadas solicitudes). Espera unos segundos y reintenta.');
    }
    if (json === null) {
      throw new Error(`kie.ai devolvio una respuesta no-JSON (HTTP ${res.status}): ${texto.slice(0, 300)}`);
    }
    if (res.status === 401) {
      throw new Error('kie.ai rechazo la clave (401). Revisa KIE_API_KEY en el .env.');
    }
    if (json.code !== 200 || !json?.data?.taskId) {
      throw new Error(`kie.ai no creo la tarea. code=${json.code} msg=${json.msg || json.message || '(sin mensaje)'}`);
    }
    return json.data.taskId;
  }
}

// ---------------------------------------------------------------- consultar

const marcar = (err, campos) => Object.assign(err, campos);

/**
 * Consulta el estado de una tarea.
 *
 * Un error que se puede volver a consultar sin riesgo (red caida, respuesta
 * no-JSON, HTTP >= 500, 429, sin datos) sale con err.pasajero = true:
 * esperarTarea lo reintenta consultando la MISMA tarea, sin crear nada. La
 * clave rechazada (401/403) no es pasajera. Con una clave buena, una taskId que
 * kie no conoce da {"code":422,"msg":"recordInfo is null"} (comprobado, ver
 * verificar.js): sale ademas con err.noExiste = true. Los mensajes son los de
 * siempre.
 */
export async function consultarTarea(taskId) {
  const url = `${KIE.base}${KIE.consultarTarea}?taskId=${encodeURIComponent(taskId)}`;
  const headers = cabeceras();
  let res;
  let texto;
  try {
    res = await fetch(url, { headers });
    texto = await res.text();
  } catch (e) {
    // La red se cayo (o la respuesta se corto a la mitad): consultar otra vez no crea nada.
    throw marcar(e, { pasajero: true });
  }
  const claveMala = (codigo) => codigo === 401 || codigo === 403;
  let json;
  try {
    json = JSON.parse(texto);
  } catch {
    throw marcar(new Error(`kie.ai devolvio una respuesta no-JSON al consultar la tarea (HTTP ${res.status}): ${texto.slice(0, 300)}`), {
      pasajero: !claveMala(res.status),
    });
  }
  if (!json?.data) {
    const mala = claveMala(res.status) || claveMala(Number(json?.code));
    const noExiste = !mala && (Number(json?.code) === 422 || /recordInfo is null/i.test(String(json?.msg ?? '')));
    throw marcar(new Error(`kie.ai no devolvio datos de la tarea ${taskId}: ${texto.slice(0, 300)}`), { pasajero: !mala, noExiste });
  }
  return json.data;
}

/**
 * Errores pasajeros al consultar: cuanto tiempo SEGUIDO se toleran (3 min) y la
 * espera entre consultas (de 2 s, doblando, hasta 30 s). `noExisteRetomadaMs`:
 * si al retomar un pendiente kie contesta "recordInfo is null" todo ese
 * tiempo, la tarea ya no existe. Exportado (y mutable) solo para que las
 * pruebas lo acorten.
 */
export const ERRORES_CONSULTA = {
  rachaMaximaMs: 3 * 60 * 1000,
  esperaInicialMs: 2000,
  esperaMaximaMs: 30000,
  noExisteRetomadaMs: 20000,
};

/** Error de "la tarea sigue en kie": no se pide otra igual (ver TOPE_ESPERA_* en config.js). */
function errorSigueEnKie(taskId, mensaje) {
  return marcar(new Error(mensaje), { sigueEnKie: true, taskId });
}

/** true si el error dice que la tarea sigue en kie (tope de espera o kie no contesto). */
export function esSigueEnKie(e) {
  return Boolean(e?.sigueEnKie);
}

/**
 * Espera a que la tarea termine. Estados: waiting | queuing | generating | success | fail.
 * Devuelve { urls, datos }.
 *
 * AVISO y TOPE (opcion segura de Diego, 2026-10-24; ver config.js):
 *  - Con topeMs: pasado timeoutMs se llama UNA vez a alAvisar(segundos) y se
 *    SIGUE esperando la misma tarea; pasado topeMs se lanza un error con
 *    err.sigueEnKie = true y err.taskId.
 *  - Sin topeMs (como antes): timeoutMs es el tope, con el mensaje de siempre
 *    ("Timeout esperando la tarea..."), que ahora tambien trae sigueEnKie y taskId.
 *
 * Un error pasajero al consultar (ver consultarTarea) no corta: se vuelve a
 * consultar la MISMA tarea con espera creciente (2, 4, 8, 16, 30 s...), sin
 * crear nada. Despues de 3 min seguidos de errores (ERRORES_CONSULTA), se lanza
 * con sigueEnKie: la tarea puede seguir corriendo, y si termina, kie la cobra.
 *
 * `toleranciaNoExisteMs` (interno, lo pasa la retoma de un pendiente): si en ese
 * tiempo todas las respuestas fueron "recordInfo is null", la tarea ya no existe
 * en kie y se lanza con err.tareaNoExiste = true.
 *
 * state 'fail' lanza como siempre (esFalloDeModelo, failCode, failMsg). Un
 * 'success' sin resultado legible lanza con err.terminada = true.
 */
export async function esperarTarea(taskId, { alActualizar, timeoutMs = POLLING.timeoutMs, topeMs, alAvisar, toleranciaNoExisteMs } = {}) {
  const inicio = Date.now();
  const tope = topeMs ?? timeoutMs;
  const conAviso = topeMs != null && timeoutMs < topeMs;
  let avisado = false;
  let espera = POLLING.intervaloInicialMs;
  let ultimoEstado = null;
  // La racha de errores pasajeros seguidos al consultar.
  let errorDesde = null;
  let esperaError = ERRORES_CONSULTA.esperaInicialMs;
  let soloNoExiste = true;

  while (true) {
    const transcurrido = Date.now() - inicio;
    if (transcurrido > tope) {
      throw errorSigueEnKie(
        taskId,
        topeMs == null
          ? `Timeout esperando la tarea ${taskId} (mas de ${Math.round(timeoutMs / 1000)}s).`
          : `Tope de espera: la tarea ${taskId} sigue en kie.ai despues de ${tiempo(Math.round(transcurrido / 1000))}. ` +
              'No se pide otra igual (si termina, kie la cobra igual).'
      );
    }
    if (conAviso && !avisado && transcurrido > timeoutMs) {
      avisado = true;
      alAvisar?.(Math.round(transcurrido / 1000));
    }

    let datos;
    try {
      datos = await consultarTarea(taskId);
    } catch (e) {
      if (!e.pasajero) throw e;
      const ahora = Date.now();
      if (errorDesde === null) {
        errorDesde = ahora;
        esperaError = ERRORES_CONSULTA.esperaInicialMs;
        soloNoExiste = true;
      }
      if (!e.noExiste) soloNoExiste = false;
      const racha = ahora - errorDesde;
      if (soloNoExiste && toleranciaNoExisteMs != null && racha >= toleranciaNoExisteMs) {
        throw marcar(new Error(`kie.ai ya no tiene la tarea ${taskId} (recordInfo is null).`), { tareaNoExiste: true, taskId });
      }
      if (racha >= ERRORES_CONSULTA.rachaMaximaMs) {
        throw errorSigueEnKie(
          taskId,
          `kie.ai no contesto bien ${tiempo(Math.round(racha / 1000))} seguidos al consultar la tarea ${taskId} ` +
            `(ultimo error: ${String(e.message).slice(0, 200)}). La tarea puede seguir en kie.ai: no se pide otra igual.`
        );
      }
      await dormir(esperaError);
      esperaError = Math.min(esperaError * 2, ERRORES_CONSULTA.esperaMaximaMs);
      continue;
    }
    errorDesde = null;

    if (datos.state !== ultimoEstado) {
      ultimoEstado = datos.state;
      alActualizar?.(datos);
    }

    if (datos.state === 'success') {
      let resultado;
      try {
        resultado = JSON.parse(datos.resultJson || '{}');
      } catch {
        throw marcar(new Error(`No pude leer resultJson de la tarea ${taskId}: ${datos.resultJson}`), { terminada: true, taskId });
      }
      const urls = resultado.resultUrls || [];
      if (urls.length === 0) {
        throw marcar(new Error(`La tarea ${taskId} termino sin URLs de resultado.`), { terminada: true, taskId });
      }
      return { urls, datos };
    }

    if (datos.state === 'fail') {
      const err = new Error(`La tarea ${taskId} fallo. ${datos.failCode || ''} ${datos.failMsg || ''}`.trim());
      err.esFalloDeModelo = true;
      err.failCode = datos.failCode;
      err.failMsg = datos.failMsg;
      err.taskId = taskId;
      throw err;
    }

    await dormir(espera);
    espera = Math.min(Math.round(espera * POLLING.factor), POLLING.intervaloMaximoMs);
  }
}

// ---------------------------------------------------------------- clasificar

// Como se lee un fallo de kie. Era clasificarFalloR, en generar-videos.js (los
// bloques R y las tomas H); se movio aqui tal cual el 2026-10-24 para que
// imagenes y videos lean los fallos igual.
const RE_CONTENIDO = /polic(?:y|ies)|safety|sensitive|prohibit|violat|blocked|moderat|inappropriate|nsfw/i;
const RE_SERVIDOR =
  /internal\s+(?:server\s+)?error|try\s+again\s+later|time\s*-?\s*out|timed\s+out|\bserver\b|overload|\bbusy\b|unavailable|bad\s+gateway|\b429\b|demasiadas solicitudes/i;
const RE_CONTENIDO_SUELTO = /\bcontent\b/i;
const CODIGOS_SERVIDOR = new Set(['500', '502', '503', '504']);

/**
 * De que es un fallo de kie, por su failCode / failMsg (o el mensaje, si la
 * tarea ni se creo):
 *
 *   'contenido'  rechazo por politicas (policy, safety, sensitive, prohibited,
 *                violation, blocked, moderation...). Reintentar el mismo prompt
 *                no sirve.
 *   'servidor'   el servicio fallo (500/502/503/504, internal error, try again
 *                later, timeout, server, overloaded, busy, 429). No se cambia
 *                nada: se espera y se vuelve a pedir. No cobra. Tambien una
 *                tarea que sigue en kie (esSigueEnKie): ahi no se pide otra.
 *   'otro'       ninguna de las dos (clasificarFalloR lo llamaba 'desconocido').
 *
 * Las palabras de politicas mandan sobre el codigo: kie puede devolver un 500
 * con "rejected by content policy", y eso es contenido. "content" a secas
 * cuenta solo si no hay senales de servidor.
 */
export function clasificarFallo(e) {
  if (esSigueEnKie(e)) return 'servidor';
  // Sin failCode (la tarea ni se creo), el codigo sale del mensaje de crearTarea:
  // "code=500" (respuesta JSON) o "HTTP 503" (respuesta que no es JSON).
  const codigo = String(e?.failCode ?? String(e?.message ?? '').match(/\b(?:code=|HTTP )(\d{3})\b/)?.[1] ?? '').trim();
  const texto = [e?.failMsg, e?.message].filter(Boolean).join(' ');
  if (RE_CONTENIDO.test(`${codigo} ${texto}`)) return 'contenido';
  if (CODIGOS_SERVIDOR.has(codigo) || RE_SERVIDOR.test(texto)) return 'servidor';
  if (RE_CONTENIDO_SUELTO.test(texto)) return 'contenido';
  return 'otro';
}

// ---------------------------------------------------------------- subir

/**
 * Sube un archivo local y devuelve su URL publica.
 * kie.ai solo acepta URLs como referencia, no archivos. Subir es gratis y los
 * archivos se borran solos a los 3 dias.
 * Docs: https://docs.kie.ai/file-upload-api/upload-file-base-64
 *
 * La cache guarda la PROMESA, no la URL: con los pools, doce frames que usan la
 * misma hoja piden subirla a la vez, y asi sale una sola subida. Si falla, se
 * olvida y el proximo pedido vuelve a subir. Un fallo pasajero (red, no-JSON,
 * HTTP >= 500, 429) se reintenta dos veces: subir otra vez no cobra.
 */
const cacheSubidas = new Map();
const ESPERAS_SUBIDA_MS = [2000, 5000];

export async function subirArchivo(rutaLocal, { uploadPath = 'anuncios-ia' } = {}) {
  const absoluta = path.resolve(rutaLocal);
  if (!cacheSubidas.has(absoluta)) {
    const promesa = subirSinCache(absoluta, uploadPath);
    cacheSubidas.set(absoluta, promesa);
    promesa.catch(() => {
      if (cacheSubidas.get(absoluta) === promesa) cacheSubidas.delete(absoluta);
    });
  }
  return cacheSubidas.get(absoluta);
}

async function subirSinCache(absoluta, uploadPath) {
  if (!fs.existsSync(absoluta)) {
    throw new Error(`No puedo subir la referencia porque no existe: ${absoluta}`);
  }

  const ext = path.extname(absoluta).slice(1).toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const base64 = fs.readFileSync(absoluta).toString('base64');

  for (let intento = 0; ; intento++) {
    const quedan = intento < ESPERAS_SUBIDA_MS.length;
    let res;
    let texto;
    try {
      res = await fetch(KIE.baseArchivos + KIE.subirBase64, {
        method: 'POST',
        headers: cabeceras(),
        body: JSON.stringify({
          base64Data: `data:${mime};base64,${base64}`,
          uploadPath,
          fileName: `${Date.now()}-${path.basename(absoluta)}`,
        }),
      });
      texto = await res.text();
    } catch (e) {
      if (quedan) {
        await dormir(ESPERAS_SUBIDA_MS[intento]);
        continue;
      }
      throw e;
    }

    let json = null;
    try {
      json = JSON.parse(texto);
    } catch {
      // se mira abajo
    }
    const url = json?.data?.downloadUrl;
    if (url) {
      return url;
    }
    const codigo = Number(json?.code) || res.status;
    const pasajero = json === null ? res.status !== 401 && res.status !== 403 : res.status >= 500 || codigo >= 500 || codigo === 429 || res.status === 429;
    if (pasajero && quedan) {
      await dormir(ESPERAS_SUBIDA_MS[intento]);
      continue;
    }
    if (json === null) {
      throw new Error(`kie.ai devolvio una respuesta no-JSON al subir el archivo (HTTP ${res.status}): ${texto.slice(0, 300)}`);
    }
    throw new Error(`kie.ai no devolvio URL al subir ${path.basename(absoluta)}: ${texto.slice(0, 300)}`);
  }
}

/** Saldo de creditos de la cuenta. Devuelve null si el endpoint no responde. */
export async function consultarCreditos() {
  try {
    const res = await fetch(KIE.base + KIE.creditos, { headers: cabeceras() });
    const json = await res.json();
    const v = json?.data;
    if (typeof v === 'number') return v;
    if (typeof v?.credit === 'number') return v.credit;
    if (typeof v?.credits === 'number') return v.credits;
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- descargar

const ESPERAS_DESCARGA_MS = [2000, 5000];

/** renameSync, con unos reintentos: en Windows un antivirus o un visor puede tener el archivo un instante. */
async function renombrar(de, a) {
  for (let i = 0; ; i++) {
    try {
      fs.renameSync(de, a);
      return;
    } catch (e) {
      if (i < 5 && ['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) {
        await dormir(200 * (i + 1));
        continue;
      }
      throw e;
    }
  }
}

/**
 * Descarga una URL a disco. Devuelve la ruta local.
 *
 * Se escribe a "<ruta>.parcial" y recien completa se renombra a la ruta final:
 * otro proceso (producir lanza cada video apenas esta su imagen) nunca ve un
 * archivo a medias. Un fallo pasajero (red, HTTP >= 500, 429) se reintenta dos
 * veces: bajar otra vez no cobra. Si hubo respuesta, el error trae err.http.
 */
export async function descargar(url, rutaDestino) {
  fs.mkdirSync(path.dirname(rutaDestino), { recursive: true });
  const parcial = `${rutaDestino}.parcial`;

  for (let intento = 0; ; intento++) {
    let buffer;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw marcar(new Error(`No pude descargar ${url} (HTTP ${res.status}).`), { http: res.status });
      }
      buffer = Buffer.from(await res.arrayBuffer());
    } catch (e) {
      const pasajero = e.http == null || e.http >= 500 || e.http === 429;
      if (pasajero && intento < ESPERAS_DESCARGA_MS.length) {
        await dormir(ESPERAS_DESCARGA_MS[intento]);
        continue;
      }
      throw e;
    }

    try {
      fs.writeFileSync(parcial, buffer);
      await renombrar(parcial, rutaDestino);
    } catch (e) {
      try {
        fs.rmSync(parcial, { force: true });
      } catch {
        // si tampoco se puede borrar, queda un .parcial que nadie lee
      }
      // Lo bajado estaba bien: fallo el disco (lleno, sin permiso). err.disco
      // para que correrTarea no lo confunda con un fallo de la red.
      throw marcar(e, { disco: true });
    }
    return rutaDestino;
  }
}

// ---------------------------------------------------------------- pendientes

/**
 * TAREA PENDIENTE (opcion segura de Diego, 2026-10-24).
 *
 * Con `huella` (generarImagen / generarVideo), apenas kie devuelve la taskId se
 * anota junto al archivo de salida: "<rutaDestino>.kie-pendiente.json" con
 * { taskId, modelo, huella, creado }. Se borra cuando la tarea termina bien
 * (despues de bajarla) o falla. Queda si se corta por el tope (sigueEnKie), si
 * termino y no se pudo bajar por algo pasajero (errorPagadaSinBajar) o si el
 * proceso muere: la proxima corrida con la MISMA huella retoma esa tarea en
 * vez de crear otra, que podria cobrar dos veces.
 *
 * La huella la calcula quien llama (sha1 del modelo, el prompt que se manda,
 * las opciones y el CONTENIDO de cada archivo de entrada): si algo cambio, ya no
 * es la misma tarea, y se pide una nueva. El pendiente viejo se reemplaza, pero
 * no a ciegas (apartarPendienteViejo): si esa tarea no fallo, se dice y su
 * taskId queda en "<rutaDestino>.kie-reemplazada.json".
 */
const rutaPendiente = (rutaDestino) => `${rutaDestino}.kie-pendiente.json`;

function leerPendiente(ruta) {
  try {
    const p = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    return p && typeof p.taskId === 'string' && p.taskId ? p : null;
  } catch {
    return null;
  }
}

function escribirPendiente(ruta, datos) {
  const texto = JSON.stringify(datos, null, 2);
  try {
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    // Primero a un temporal y despues el rename: un corte a la mitad no deja un JSON roto.
    const temporal = `${ruta}.parcial`;
    fs.writeFileSync(temporal, texto);
    try {
      fs.renameSync(temporal, ruta);
    } catch {
      fs.writeFileSync(ruta, texto);
      fs.rmSync(temporal, { force: true });
    }
  } catch (e) {
    // No frena: la tarea ya esta creada. Solo se pierde la retoma si el proceso muere.
    console.log(`  !  no pude anotar la tarea ${datos.taskId} en ${path.basename(ruta)} (${e.message}); sigo esperandola`);
  }
}

function borrarPendiente(ruta) {
  for (let i = 0; i < 5; i++) {
    try {
      fs.rmSync(ruta, { force: true });
      return;
    } catch {
      // Windows: el archivo puede estar tomado un instante; se reintenta.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100 * (i + 1));
    }
  }
}

/**
 * Hay un pendiente de OTRO pedido (cambio el prompt, una imagen de entrada o el
 * modelo) y se va a pedir uno nuevo encima. Esa tarea puede seguir en kie y,
 * si termina, se cobra igual: antes de pisarla se mira como esta. Si fallo o
 * kie ya no la tiene, se reemplaza sin decir nada (no cobra). Si no, una linea
 * "  !  " con su taskId, y queda anotada aparte en <archivo>.kie-reemplazada.json
 * (una lista: puede haber mas de una) para no perderla.
 */
async function apartarPendienteViejo(archivoPendiente, pendiente, nombre) {
  let estado = null;
  try {
    estado = (await consultarTarea(pendiente.taskId)).state ?? null;
  } catch (e) {
    if (e.noExiste) estado = 'no-existe';
  }
  if (estado === 'fail' || estado === 'no-existe') return;
  const rutaAparte = archivoPendiente.replace(/\.kie-pendiente\.json$/, '.kie-reemplazada.json');
  let lista = [];
  try {
    lista = JSON.parse(fs.readFileSync(rutaAparte, 'utf8'));
    if (!Array.isArray(lista)) lista = [];
  } catch {
    // no habia ninguna
  }
  lista.push({ ...pendiente, estado: estado ?? 'no se pudo consultar', reemplazada: new Date().toISOString() });
  try {
    fs.writeFileSync(rutaAparte, JSON.stringify(lista, null, 2));
  } catch {
    // queda en la consola
  }
  const como =
    estado === 'success'
      ? 'ya termino en kie.ai (se cobro)'
      : `${estado ? `kie.ai la tiene en "${estado}"` : 'no la pude consultar'}: si termina, kie la cobra igual`;
  console.log(
    `  !  ${nombre}: habia una tarea anotada de un pedido distinto (${pendiente.taskId}, ${pendiente.modelo}) y ${como}. ` +
      `Este pedido cambio (prompt, imagenes o modelo): se pide uno nuevo. Aquella queda anotada en ${path.basename(rutaAparte)}.`
  );
}

/**
 * Bajar el resultado de una tarea que ya termino bien (kie ya la cobro): bajar
 * otra vez no cobra, asi que un fallo pasajero (red, HTTP >= 500, 429) se sigue
 * intentando hasta rachaMaximaMs, con espera creciente; un 4xx se intenta una
 * vez mas (un archivo recien hecho puede tardar en aparecer). Exportado (y
 * mutable) solo para que las pruebas lo acorten.
 */
export const ERRORES_DESCARGA = {
  rachaMaximaMs: 3 * 60 * 1000,
  esperaInicialMs: 5000,
  esperaMaximaMs: 30000,
  esperaNoEstaMs: 5000,
};

/**
 * Una tarea que TERMINO BIEN en kie.ai (o sea, ya cobrada) y cuyo resultado no
 * se pudo bajar o leer. No es un fallo del modelo: pedir otra, con un reintento
 * o con el respaldo, seria pagarla dos veces. Sale con err.pagadaSinBajar y las
 * cascadas cortan ese trabajo sin crear nada (esPagadaSinBajar).
 *
 *   conservaPendiente  algo pasajero (la red, el servidor de archivos, el
 *                      disco): el pendiente queda y la proxima corrida baja
 *                      ESA misma tarea, sin pagar otra.
 *   si no              el resultado no se puede bajar (HTTP 4xx, sin URLs,
 *                      resultJson ilegible): no hay pendiente; volver a correr
 *                      pide una nueva, y esa se cobra otra vez (lo decide el
 *                      usuario).
 */
function errorPagadaSinBajar(e, { taskId, archivoPendiente, conservaPendiente }) {
  const queda = Boolean(conservaPendiente && archivoPendiente && fs.existsSync(archivoPendiente));
  const err = new Error(
    `La tarea ${taskId} ya termino en kie.ai (se cobro), pero su resultado no se pudo bajar: ${String(e.message).split(/\r?\n/)[0]}\n` +
      (queda
        ? `  Quedo anotada en ${path.basename(archivoPendiente)}: al volver a correr se baja ESA misma, sin pedir ni pagar otra.`
        : '  No se pidio otra. Volver a correr pide una nueva, y esa se cobra otra vez.')
  );
  return marcar(err, { pagadaSinBajar: true, conservaPendiente: queda, taskId, http: e.http, causa: e, ...(queda ? { rutaPendiente: archivoPendiente } : {}) });
}

/** true si la tarea termino (cobrada) y su resultado no se pudo bajar: ni reintento ni respaldo. */
export function esPagadaSinBajar(e) {
  return Boolean(e?.pagadaSinBajar);
}

/**
 * Crea la tarea (o retoma la pendiente), la espera y baja el resultado.
 * Lo comparten generarImagen y generarVideo.
 *
 * `antesDeCrear` (opcional; solo lo pasan los anuncios de imagen) se llama justo antes de crear una tarea NUEVA, con
 * { retomadaFallida } (el error de la tarea retomada que fallo o que kie ya no tiene, o null). Si lanza, no se crea
 * nada y el error sale tal cual: asi quien llama aplica su tope de intentos tambien cuando una retomada falla. Sin
 * el, todo queda como siempre.
 */
async function correrTarea({ model, input, rutaDestino, huella, alActualizar, alAvisar, timeoutMs, topeMs, antesDeCrear = null }) {
  const archivoPendiente = huella ? rutaPendiente(rutaDestino) : null;
  const nombre = path.basename(rutaDestino);
  // Sin alAvisar de quien llama, el aviso sale por consola igual.
  const avisar =
    alAvisar ??
    ((segundos) => console.log(`  ..  ${nombre}: kie.ai lleva ${tiempo(segundos)} con esta tarea; sigo esperando la misma (no se pide otra)`));
  // Un timeoutMs mas largo que el tope no se corta antes: manda el mayor.
  const opcionesEspera = { alActualizar, timeoutMs, topeMs: Math.max(topeMs, timeoutMs), alAvisar: avisar };
  const conPendiente = (e) => {
    if (archivoPendiente && esSigueEnKie(e) && fs.existsSync(archivoPendiente)) {
      e.rutaPendiente = archivoPendiente;
      e.message += `\n  Quedo anotada en ${path.basename(archivoPendiente)}: la proxima corrida la retoma en vez de pedir otra.`;
    }
    return e;
  };

  let taskId = null;
  let resultado = null;
  let retomada = false;
  let retomadaFallida = null;

  // 1) La misma tarea quedo en marcha en una corrida anterior: se retoma.
  const pendiente = archivoPendiente ? leerPendiente(archivoPendiente) : null;
  if (pendiente && pendiente.huella === huella) {
    taskId = pendiente.taskId;
    retomada = true;
    console.log(`  ..  ${nombre}: retomo la tarea ${taskId}, que ya estaba en kie.ai (no se pide otra)`);
    alActualizar?.({ state: 'retomada', taskId, modeloReal: pendiente.modelo || model });
    try {
      resultado = await esperarTarea(taskId, { ...opcionesEspera, toleranciaNoExisteMs: ERRORES_CONSULTA.noExisteRetomadaMs });
    } catch (e) {
      if (!e.esFalloDeModelo && !e.tareaNoExiste) {
        // Termino bien pero sin un resultado legible: cobrada, y no se pide otra.
        if (e.terminada) {
          borrarPendiente(archivoPendiente);
          throw errorPagadaSinBajar(e, { taskId, archivoPendiente, conservaPendiente: false });
        }
        throw conPendiente(e);
      }
      // Fallo (no cobra) o kie ya no la tiene: se pide una nueva, abajo.
      borrarPendiente(archivoPendiente);
      console.log(`  ..  ${nombre}: la tarea retomada ${e.tareaNoExiste ? 'ya no existe en kie.ai' : 'fallo en kie.ai'}${antesDeCrear ? '' : '; pido una nueva'}`);
      taskId = null;
      retomada = false;
      retomadaFallida = e;
    }
  } else if (pendiente) {
    // 1b) El pendiente es de otro pedido: antes de pisarlo, que no se pierda.
    await apartarPendienteViejo(archivoPendiente, pendiente, nombre);
  }

  // 2) Una tarea nueva.
  if (!resultado) {
    if (antesDeCrear) await antesDeCrear({ retomadaFallida });
    taskId = await crearTarea(model, input);
    if (archivoPendiente) escribirPendiente(archivoPendiente, { taskId, modelo: model, huella, creado: new Date().toISOString() });
    alActualizar?.({ state: 'created', taskId, modeloReal: model });
    try {
      resultado = await esperarTarea(taskId, opcionesEspera);
    } catch (e) {
      // Termino (mal) en kie: el pendiente ya no sirve. Si sigue en kie, queda.
      if (archivoPendiente && (e.esFalloDeModelo || e.terminada)) borrarPendiente(archivoPendiente);
      if (e.terminada) throw errorPagadaSinBajar(e, { taskId, archivoPendiente, conservaPendiente: false });
      throw conPendiente(e);
    }
  }

  // 3) Termino bien (kie ya la cobro): se baja. Ningun fallo de aca puede
  // terminar en otra tarea (ver errorPagadaSinBajar).
  const { urls, datos } = resultado;
  const desde = Date.now();
  let espera = ERRORES_DESCARGA.esperaInicialMs;
  let otraVezNoEsta = true;
  for (;;) {
    try {
      await descargar(urls[0], rutaDestino);
      break;
    } catch (e) {
      // 4xx: la URL no esta. Disco: el archivo bajo bien y no se pudo escribir.
      const noEsta = !e.disco && e.http != null && e.http < 500 && e.http !== 429;
      const corto = String(e.message).split(/\r?\n/)[0].slice(0, 120);
      if (noEsta && otraVezNoEsta) {
        otraVezNoEsta = false;
        console.log(`  ..  ${nombre}: no pude bajar el resultado de ${taskId} (${corto}); ya esta pagada: pruebo otra vez en ${Math.round(ERRORES_DESCARGA.esperaNoEstaMs / 1000)} s`);
        await dormir(ERRORES_DESCARGA.esperaNoEstaMs);
        continue;
      }
      if (!noEsta && !e.disco && Date.now() - desde + espera <= ERRORES_DESCARGA.rachaMaximaMs) {
        console.log(`  ..  ${nombre}: no pude bajar el resultado de ${taskId} (${corto}); ya esta pagada: reintento la descarga en ${Math.round(espera / 1000)} s (bajar no cobra)`);
        await dormir(espera);
        espera = Math.min(espera * 2, ERRORES_DESCARGA.esperaMaximaMs);
        continue;
      }
      // La URL ya no existe (4xx): ese resultado no se recupera y el pendiente
      // ya no sirve. Un fallo pasajero o del disco deja el pendiente: la
      // proxima corrida la baja sin pagar otra.
      if (archivoPendiente && noEsta) borrarPendiente(archivoPendiente);
      throw errorPagadaSinBajar(e, { taskId, archivoPendiente, conservaPendiente: !noEsta });
    }
  }
  if (archivoPendiente) borrarPendiente(archivoPendiente);
  return { ruta: rutaDestino, url: urls[0], taskId, datos, modeloReal: model, creditos: datos.creditsConsumed ?? null, retomada };
}

// ---------------------------------------------------------------- generar

/**
 * Genera una imagen y la descarga.
 * El cuerpo exacto lo arma el adaptador del modelo (ver ADAPTADORES_IMAGEN):
 * cada modelo nombra sus campos distinto.
 *
 * `huella` (opcional): anota la tarea en "<rutaDestino>.kie-pendiente.json" y
 * retoma la de una corrida anterior con la misma huella (ver correrTarea).
 * `alAvisar(segundos)` (opcional): se llama una vez si pasa el aviso
 * (POLLING.timeoutMs) y se sigue esperando; sin el, el aviso sale por consola.
 * El tope es TOPE_ESPERA_IMAGEN_MS (o `topeMs`). Devuelve tambien `retomada`.
 * `antesDeCrear` (opcional): ver correrTarea.
 */
export async function generarImagen({
  modelo,
  prompt,
  imagenesReferencia = [],
  aspectRatio = 'auto',
  resolucion = '1K',
  formato = 'png',
  fondo = null,
  rutaDestino,
  alActualizar,
  huella = null,
  alAvisar,
  timeoutMs = POLLING.timeoutMs,
  topeMs = TOPE_ESPERA_IMAGEN_MS,
  antesDeCrear = null,
}) {
  const adaptador = ADAPTADORES_IMAGEN[modelo];
  if (!adaptador) {
    throw new Error(`No hay adaptador para el modelo de imagen "${modelo}". Definidos: ${Object.keys(ADAPTADORES_IMAGEN).join(', ')}`);
  }

  // `fondo` (opcional, 'transparente') es solo para los iconos de los estilos
  // hablados; el adaptador que no lo entiende lo ignora.
  const { model, input } = adaptador({
    prompt,
    referencias: imagenesReferencia,
    aspectRatio,
    resolucion,
    formato,
    fondo,
  });

  return correrTarea({ model, input, rutaDestino, huella, alActualizar, alAvisar, timeoutMs, topeMs, antesDeCrear });
}

/**
 * Genera un video y lo descarga.
 * El cuerpo lo arma el adaptador del modelo (ver ADAPTADORES_VIDEO):
 * omni y kling-4.0 usan first_frame_url/last_frame_url; kling-3.0 usaba image_urls[0..1].
 *
 * `imagenesReferencia` (opcional) es solo para los bloques UGC tipo R: URLs ya
 * subidas, en orden, que el adaptador de flash-1-1 manda como image_urls
 * cuando NO hay frames. Quien no lo pasa no ve ningun cambio.
 *
 * `timeoutMs` es el AVISO (TIMEOUT_VIDEO_MS si no viene): no corta. El tope es
 * TOPE_ESPERA_VIDEO_MS (o `topeMs`). `huella` y `alAvisar`, como en generarImagen.
 */
export async function generarVideo({
  modelo,
  prompt,
  frameInicial,
  frameFinal = null,
  imagenesReferencia = null,
  aspectRatio = '9:16',
  resolucionApi,
  duracion,
  sonido = undefined,
  rutaDestino,
  timeoutMs = TIMEOUT_VIDEO_MS,
  topeMs = TOPE_ESPERA_VIDEO_MS,
  alActualizar,
  huella = null,
  alAvisar,
}) {
  const adaptador = ADAPTADORES_VIDEO[modelo];
  if (!adaptador) {
    throw new Error(`No hay adaptador para el modelo de video "${modelo}". Definidos: ${Object.keys(ADAPTADORES_VIDEO).join(', ')}`);
  }

  // `sonido` (opcional, true/false) es solo para el B-roll de los estilos
  // hablados con Kling; sin el, cada adaptador manda lo de siempre.
  const { model, input } = adaptador({ prompt, frameInicial, frameFinal, imagenesReferencia, aspectRatio, resolucionApi, duracion, sonido });

  return correrTarea({ model, input, rutaDestino, huella, alActualizar, alAvisar, timeoutMs, topeMs });
}

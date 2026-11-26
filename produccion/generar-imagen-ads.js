// ANUNCIOS DE IMAGEN — el motor que cobra (ESPECIFICACION-imagen-ads.md, seccion 5.2).
//
//   node produccion/generar-imagen-ads.js temp/<lote> [--motor chatgpt|kie] [--concurrencia 30] [--ociosa 20] [--heredar-log]
//
// --motor chatgpt (lo pasa la app cuando las imagenes van con la suscripcion de ChatGPT, lib/motor-imagenes.js): cada
// pieza la hace Codex con image_gen (produccion/chatgpt-imagen.js), sin kie, sin subir nada y sin costo por imagen;
// 3 a la vez por defecto. Sin sesion o sin uso de ChatGPT se deja de pedir con CHATGPT_SIN_SESION / CHATGPT_LIMITE en
// el texto (la app lo convierte en su mensaje). Lo de abajo (huellas, tareas que se retoman) es de kie.
//
// --heredar-log (lo pasa la app cuando la corrida anterior se corto: la app se cerro de golpe y su gasto quedo
// abierto en app/gasto/en-curso.json): este proceso sigue el img/log-modelos.json que dejo el proceso cortado en vez
// de empezarlo vacio, para que gasto.js vea lo que pago ese proceso y lo que paga este (si no, una pieza hecha antes
// del corte y rehecha despues aparece una sola vez). Solo hereda si ese log se escribio DENTRO de la corrida abierta
// (generado >= su inicio): el de una corrida ya cerrada ya se conto.
//
// Proceso de LARGA VIDA: la app (lib/familias/imagen-ads.js) le deja ordenes
// en temp/<lote>/app/imagen-ads/motor/T###.json y este proceso las va tomando
// (mira la carpeta cada segundo), pide cada pieza a kie.ai con GPT Image 2.5
// Sunburst a 2K (fijo, sin cascada) y anota como va cada una en
// T###.resultado.json. Sale solo (codigo 0) cuando lleva --ociosa segundos sin
// nada que hacer; si justo despues llega una orden, la app ve la orden sin
// terminar y lo vuelve a lanzar.
//
// Lee: lote.json, los V##.json de la raiz del lote, img/, versiones/indice.json
// y las ordenes sin terminar. Escribe: img/<pieza>.png (solo las finales),
// prompts/, nuevas/, versiones/, app/imagen-ads/subidas/, los T###.resultado.json
// e img/log-modelos.json (de este proceso, pieza por pieza: lo lee gasto.js).
// Nunca lee final/ ni pega logos (eso es de la app, con ffmpeg).
//
// NO PAGAR DOS VECES (es lo que mas importa aqui):
//   - Cada pieza se identifica por (pieza, orden). Lo que ya termino (lista o
//     sin imagen) no se vuelve a pedir; una pieza con orden "g" cuya imagen ya
//     esta en img/ esta lista; un rehacer ya anotado en versiones/indice.json
//     tambien.
//   - Hasta 3 intentos de la API por pieza, ANOTADOS EN DISCO ANTES de pedir.
//     Un intento que nunca llego a kie (la app se cerro mientras esperaba turno,
//     o kie no creo la tarea por la clave, el saldo, la red o su servidor) se
//     devuelve: no se gasta. Un rechazo (contenido incluido) o un pedido
//     invalido (4xx) si cuentan.
//   - Cada tarea creada queda anotada por kie-client.js en
//     <destino>.kie-pendiente.json con su huella: al volver a correr, una pieza
//     con la misma huella RETOMA esa tarea en vez de pedir otra.
//   - Rehacer baja a nuevas/ y recien despues reemplaza, en pasos que
//     sobreviven a un corte en cualquier punto (a: nuevas/<pieza>.json; b: la
//     version en versiones/indice.json; c: la anterior a versiones/; d: la
//     nueva a img/; e: se borra nuevas/<pieza>.json). Con (a) en disco no se
//     llama a kie nunca mas: se termina desde ahi.
//
// Codigos de salida: 0 nada pendiente (aunque haya piezas sin imagen); 1 fallo
// general (el texto lo clasifica procesos.clasificarFallo de la app: clave,
// saldo, red o servidor); 2 lote u orden invalidos. Nunca process.exit(): ver
// el final del archivo (Node 24 en Windows).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { creditosAUsd, cargarEnv, requerirClave, RAIZ } from './config.js';
import { generarImagen, subirArchivo, esSigueEnKie, esPagadaSinBajar, clasificarFallo } from './kie-client.js';
import { generarConChatGPT, codexDesdeEntorno, MODELO_CHATGPT } from './chatgpt-imagen.js';
import {
  MODELO,
  RESOLUCION,
  FONDO,
  POSICIONES,
  RE_PIEZA,
  numeroDeV,
  vDePieza,
  formatoDePieza,
  construirPrompt,
  construirPromptVertical,
  construirPromptEdicion,
  TOPE_CORRECCION,
  ajustarLargo,
  huellaPieza,
  firmaDeArchivo,
  MENSAJES_SIN_IMAGEN,
} from './imagen-ads.js';

/** Intentos de la API por pieza (los que cobran o pueden cobrar). */
export const INTENTOS = 3;
/** Topes de espera (TOPE_ESPERA_IMAGEN_MS) que se le dan a una tarea que sigue en kie: el primero y 2 mas. */
const TOPES_DE_ESPERA = 3;
/** Una tarea ya pagada que no se pudo bajar: se vuelve a intentar la descarga 3 veces, cada 30 s. */
const REINTENTOS_DESCARGA = 3;
const ESPERA_DESCARGA_MS = 30000;
/** Cada cuanto se mira la carpeta de ordenes y como mucho cada cuanto se reescribe un resultado. */
const CADA_MS = 1000;

const ESTADOS_FINALES = new Set(['lista', 'sin-imagen']);
const RE_ORDEN = /^T(\d{3,})\.json$/;
const RE_ID_ORDEN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,40}$/;

// ---------------------------------------------------------------- archivos

const PAUSA = new Int32Array(new SharedArrayBuffer(4));
const esperarSincrono = (ms) => Atomics.wait(PAUSA, 0, 0, ms);

/** renameSync con reintentos: en Windows un lector (la app, el antivirus) puede tener el archivo un instante. */
function renombrar(de, a) {
  for (let i = 0; ; i++) {
    try {
      fs.renameSync(de, a);
      return;
    } catch (e) {
      if (i >= 10 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e;
      esperarSincrono(50 * (i + 1));
    }
  }
}

/** Escribe de una vez (temporal + renombre): nadie ve nunca un archivo a medias. */
function escribirAtomico(ruta, contenido) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const tmp = `${ruta}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, contenido);
  try {
    renombrar(tmp, ruta);
  } catch (e) {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      /* queda un .tmp que nadie lee */
    }
    throw e;
  }
}
const escribirJSON = (ruta, valor) => escribirAtomico(ruta, JSON.stringify(valor, null, 2) + '\n');

function leerJSON(ruta) {
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf8'));
  } catch {
    return null;
  }
}
function leerTexto(ruta) {
  try {
    return fs.readFileSync(ruta, 'utf8');
  } catch {
    return null;
  }
}
const existe = (ruta) => {
  try {
    return fs.statSync(ruta).isFile();
  } catch {
    return false;
  }
};
const borrar = (ruta) => {
  try {
    fs.rmSync(ruta, { force: true });
  } catch {
    /* si no se puede, queda */
  }
};

function sha1(ruta) {
  return crypto.createHash('sha1').update(fs.readFileSync(ruta)).digest('hex');
}

/** Mueve `de` a `a` sin pisar nada: si `a` ya esta y es igual, se borra `de`; si es otra, va con otro nombre. */
function moverSinPisar(de, a) {
  if (!existe(a)) return renombrar(de, a);
  if (sha1(de) === sha1(a)) return borrar(de);
  const ext = path.extname(a);
  for (let k = 2; ; k++) {
    const otro = `${a.slice(0, -ext.length)}-${k}${ext}`;
    if (!existe(otro)) return renombrar(de, otro);
  }
}

/** La tarea que dejo anotada kie-client.js para ese destino, o null. */
function leerPendiente(destino) {
  const p = leerJSON(`${destino}.kie-pendiente.json`);
  return p && typeof p === 'object' && typeof p.taskId === 'string' && p.taskId ? p : null;
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const primeraLinea = (t) => String(t ?? '').split(/\r?\n/)[0].slice(0, 200);

// ---------------------------------------------------------------- errores

/** Algo del lote o de una orden no sirve: salida 2. */
class ErrorInvalido extends Error {}

/**
 * El codigo HTTP o de kie que trae un error al crear la tarea o al subir:
 * "code=422" (crearTarea), "(HTTP 502)" (respuesta no-JSON), "(401)" (clave),
 * "429", o el "code":401 de un cuerpo JSON (subirArchivo). null si no trae.
 */
export function codigoDelError(e) {
  const m = String(e?.message ?? e ?? '');
  if (/\(401\)|rechazo la clave/i.test(m)) return 401;
  if (/devolvio 429|\b429\b.*demasiadas/i.test(m)) return 429;
  const c = m.match(/\bcode=(\d{3})\b/) || m.match(/\bHTTP (\d{3})\b/) || m.match(/"code"\s*:\s*(\d{3})\b/);
  return c ? Number(c[1]) : null;
}

/** ¿La clave no sirve? (401 al crear o al subir, o falta en el .env). */
function esDeClave(e) {
  const m = String(e?.message ?? '');
  return codigoDelError(e) === 401 || codigoDelError(e) === 403 || /You do not have access permissions|invalid[_ ]api[_ ]key|Falta KIE_API_KEY/i.test(m);
}

/** El texto de un error de red con su codigo (fetch failed -> "fetch failed (ECONNREFUSED)"). */
function textoDeError(e) {
  const m = String(e?.message ?? e ?? 'error desconocido');
  const codigo = e?.cause?.code || e?.code;
  return codigo && !m.includes(codigo) ? `${m} (${codigo})` : m;
}

// ---------------------------------------------------------------- el lote

/** Lee y valida lote.json. Lanza ErrorInvalido si no sirve. */
export function leerLote(carpeta) {
  const ruta = path.join(carpeta, 'lote.json');
  if (!fs.existsSync(ruta)) throw new ErrorInvalido(`No encuentro ${ruta}.`);
  const lote = leerJSON(ruta);
  if (!lote || typeof lote !== 'object') throw new ErrorInvalido(`${ruta} no es un JSON valido.`);
  if (lote.version !== 1) throw new ErrorInvalido(`lote.json: version ${JSON.stringify(lote.version)} (se espera 1).`);
  if (lote.modelo != null && lote.modelo !== MODELO) throw new ErrorInvalido(`lote.json: modelo "${lote.modelo}" (esta seccion usa solo ${MODELO}).`);
  if (lote.resolucion != null && lote.resolucion !== RESOLUCION) throw new ErrorInvalido(`lote.json: resolucion "${lote.resolucion}" (esta seccion usa ${RESOLUCION}).`);
  if (typeof lote.producto !== 'string' || !lote.producto.trim()) throw new ErrorInvalido('lote.json: falta "producto" (la foto del producto).');
  const producto = path.resolve(carpeta, lote.producto);
  const rel = path.relative(carpeta, producto);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new ErrorInvalido(`lote.json: la foto del producto tiene que estar dentro del lote (${lote.producto}).`);
  if (!existe(producto)) throw new ErrorInvalido(`lote.json: no encuentro la foto del producto (${lote.producto}).`);
  if (lote.formatos != null && !(Array.isArray(lote.formatos) && lote.formatos.every((f) => f === '1:1' || f === '9:16'))) {
    throw new ErrorInvalido(`lote.json: formatos ${JSON.stringify(lote.formatos)} (valen "1:1" y "9:16").`);
  }
  if (lote.logo != null && !(typeof lote.logo === 'object' && POSICIONES[lote.logo.posicion])) {
    throw new ErrorInvalido(`lote.json: logo ${JSON.stringify(lote.logo)} (tiene que ser null o { "posicion": una de ${Object.keys(POSICIONES).join(', ')} }).`);
  }
  return { ...lote, rutaProducto: producto, logo: lote.logo ? { posicion: lote.logo.posicion } : null, fiel: lote.fiel === true, ganador: typeof lote.ganador === 'string' ? lote.ganador : null };
}

/** Valida una orden T###.json. Devuelve la lista de sus piezas (normalizada) o lanza ErrorInvalido. */
export function validarOrden(datos, id) {
  if (!datos || typeof datos !== 'object') throw new ErrorInvalido(`La orden ${id} no es un JSON valido.`);
  if (datos.id !== id) throw new ErrorInvalido(`La orden ${id}.json dice "id": ${JSON.stringify(datos.id)}.`);
  if (!Array.isArray(datos.piezas)) throw new ErrorInvalido(`La orden ${id} no trae "piezas".`);
  const vistas = new Set();
  return datos.piezas.map((p, i) => {
    const donde = `La orden ${id}, pieza ${i + 1}`;
    if (!p || typeof p !== 'object') throw new ErrorInvalido(`${donde}: no es un objeto.`);
    if (!RE_PIEZA.test(String(p.pieza))) throw new ErrorInvalido(`${donde}: "${p.pieza}" no es una pieza (V01_1x1, V01_9x16).`);
    if (vistas.has(p.pieza)) throw new ErrorInvalido(`${donde}: ${p.pieza} esta dos veces en la misma orden.`);
    vistas.add(p.pieza);
    if (typeof p.orden !== 'string' || !RE_ID_ORDEN.test(p.orden)) throw new ErrorInvalido(`${donde} (${p.pieza}): "orden" ${JSON.stringify(p.orden)} no sirve.`);
    if (p.modo !== 'generar' && p.modo !== 'editar') throw new ErrorInvalido(`${donde} (${p.pieza}): "modo" ${JSON.stringify(p.modo)} (vale generar o editar).`);
    if (!Number.isInteger(p.version) || p.version < 1) throw new ErrorInvalido(`${donde} (${p.pieza}): "version" ${JSON.stringify(p.version)}.`);
    if (p.orden === 'g' && p.modo !== 'generar') throw new ErrorInvalido(`${donde} (${p.pieza}): la orden "g" es la primera generacion (modo generar).`);
    if (p.modo === 'editar' && !(typeof p.instruccion_en === 'string' && p.instruccion_en.trim())) {
      throw new ErrorInvalido(`${donde} (${p.pieza}): editar sin "instruccion_en".`);
    }
    return {
      pieza: p.pieza,
      orden: p.orden,
      modo: p.modo,
      version: p.version,
      ...(p.motivo ? { motivo: String(p.motivo) } : {}),
      ...(p.modo === 'editar' ? { instruccion_en: p.instruccion_en.trim(), textos: p.textos === true } : {}),
      // (2026-11-26h) las imágenes que adjuntó el usuario (dentro del lote; solo al editar)
      ...(p.modo === 'editar' && Array.isArray(p.adjuntos) ? { adjuntos: p.adjuntos.map(String).filter((a) => /^entrada\/adjuntos\/A\d{4}\.(png|jpg)$/.test(a)).slice(0, 3) } : {}),
      // la otra version que pidio el usuario: lo que salio mal segun la revision (ingles, corto)
      ...(p.modo === 'generar' && typeof p.correccion_en === 'string' && p.correccion_en.trim() ? { correccion_en: p.correccion_en.trim().slice(0, TOPE_CORRECCION) } : {}),
    };
  });
}

// ---------------------------------------------------------------- el motor

class Motor {
  constructor({ carpeta, carpetaArg, lote, concurrencia, ociosaMs, heredarLog = false, chatgpt = null }) {
    this.carpeta = carpeta;
    // Con la suscripcion de ChatGPT (--motor chatgpt): sin kie, sin subir nada y sin costo por imagen.
    this.chatgpt = chatgpt;
    this.heredarLog = heredarLog;
    this.carpetaArg = carpetaArg;
    this.lote = lote;
    this.concurrencia = concurrencia;
    this.ociosaMs = ociosaMs;
    this.dir = {
      img: path.join(carpeta, 'img'),
      nuevas: path.join(carpeta, 'nuevas'),
      prompts: path.join(carpeta, 'prompts'),
      versiones: path.join(carpeta, 'versiones'),
      motor: path.join(carpeta, 'app', 'imagen-ads', 'motor'),
      subidas: path.join(carpeta, 'app', 'imagen-ads', 'subidas'),
    };
    this.ordenes = new Map(); // id -> { id, ruta, mtime, items, resultado, sucio, ultima }
    this.finales = new Map(); // "pieza|orden" -> el registro final (lista o sin imagen), de cualquier orden
    this.intentosPor = new Map(); // "pieza|orden" -> intentos ya anotados en alguna orden
    this.cola = []; // { T, item }, en el orden de las ordenes y de sus piezas
    this.agendadas = new Set(); // "T###|pieza" ya puestas en la cola en este proceso
    this.enMarcha = new Map(); // pieza -> promesa
    this.abandonadas = new Set(); // "T###|pieza": siguen en kie o pagadas sin bajar (las retoma la proxima corrida)
    this.lecturasFallidas = new Map(); // archivo de orden -> veces que no se pudo leer
    this.sha1s = new Map();
    this.copias = new Map(); // "ruta|tamano|fecha" -> copia en subidas/
    this.cacheV = new Map(); // ruta -> { clave, ad }
    this.log = []; // img/log-modelos.json de este proceso (con --heredar-log, primero lo del proceso cortado)
    this.heredadas = 0; // cuantas entradas del log vienen del proceso cortado (ya estaban pagadas antes)
    this.detenido = null; // { codigo, clase, texto }: no se pide nada mas
    this.quedanEnKie = [];
    this.sinBajar = [];
    this.cuenta = { listas: 0, sinImagen: 0, yaEstaban: 0 };
    this.t0 = Date.now();
    this.avisar = () => {};
    this.guardadoEnCurso = null;
  }

  // ------------------------------------------------------------ rutas

  rutasDe(pieza) {
    return {
      img: path.join(this.dir.img, `${pieza}.png`),
      prompt: path.join(this.dir.prompts, `${pieza}.txt`),
      nuevaPng: path.join(this.dir.nuevas, `${pieza}.png`),
      nuevaTxt: path.join(this.dir.nuevas, `${pieza}.txt`),
      nuevaJson: path.join(this.dir.nuevas, `${pieza}.json`),
      version: (n, ext) => path.join(this.dir.versiones, `${pieza}.v${n}.${ext}`),
    };
  }

  // ------------------------------------------------------------ resultados

  /** Lo ya anotado en todos los resultados: lo final no se vuelve a pedir, ni desde otra orden. */
  cargarFinales() {
    let nombres = [];
    try {
      nombres = fs.readdirSync(this.dir.motor);
    } catch {
      return;
    }
    for (const n of nombres) {
      if (!/^T\d{3,}\.resultado\.json$/.test(n)) continue;
      const r = leerJSON(path.join(this.dir.motor, n));
      for (const [pieza, rec] of Object.entries(r?.piezas || {})) {
        if (!rec || typeof rec.orden !== 'string') continue;
        const clave = `${pieza}|${rec.orden}`;
        if (ESTADOS_FINALES.has(rec.estado)) this.finales.set(clave, { ...rec });
        const antes = this.intentosPor.get(clave) || 0;
        this.intentosPor.set(clave, Math.max(antes, Number(rec.intentosApi) || 0));
      }
    }
  }

  /** Marca el resultado para escribirlo en la proxima pasada (como mucho una vez por segundo). */
  marcar(T) {
    T.sucio = true;
  }

  /** Escribe ya (en el proximo turno, juntando lo de todas las piezas): para lo que tiene que quedar antes de pedir. */
  guardarYa(T) {
    T.sucio = true;
    T.urgente = true;
    if (!this.guardadoEnCurso) {
      this.guardadoEnCurso = new Promise((resolve) => {
        setImmediate(() => {
          this.guardadoEnCurso = null;
          try {
            this.guardarSucios({ soloUrgentes: true });
          } finally {
            resolve();
          }
        });
      });
    }
    return this.guardadoEnCurso;
  }

  guardarSucios({ forzar = false, soloUrgentes = false } = {}) {
    const ahora = Date.now();
    for (const T of this.ordenes.values()) {
      if (!T.sucio) continue;
      if (soloUrgentes ? !T.urgente : !forzar && !T.urgente && ahora - (T.ultima || 0) < CADA_MS) continue;
      this.escribirResultado(T);
    }
  }

  escribirResultado(T) {
    const terminado = T.items.every((it) => ESTADOS_FINALES.has(T.resultado.piezas[it.pieza]?.estado));
    T.resultado.id = T.id;
    T.resultado.actualizado = new Date().toISOString();
    T.resultado.terminado = terminado;
    try {
      escribirJSON(path.join(this.dir.motor, `${T.id}.resultado.json`), T.resultado);
      T.sucio = false;
      T.urgente = false;
      T.ultima = Date.now();
    } catch (e) {
      console.log(`  !  no pude escribir ${T.id}.resultado.json (${e.message}); lo intento en la proxima pasada`);
    }
  }

  // ------------------------------------------------------------ ordenes

  /** Lee las ordenes nuevas (o que cambiaron) y pone en la cola lo que falta. */
  escanear() {
    let nombres;
    try {
      nombres = fs.readdirSync(this.dir.motor);
    } catch {
      return;
    }
    const ordenadas = nombres
      .map((n) => ({ n, m: n.match(RE_ORDEN) }))
      .filter((x) => x.m)
      .sort((a, b) => Number(a.m[1]) - Number(b.m[1]));
    for (const { n } of ordenadas) {
      const id = n.replace(/\.json$/, '');
      const ruta = path.join(this.dir.motor, n);
      let st;
      try {
        st = fs.statSync(ruta);
      } catch {
        continue;
      }
      const conocida = this.ordenes.get(id);
      if (conocida && conocida.mtime === st.mtimeMs) continue;
      const datos = leerJSON(ruta);
      if (!datos) {
        // Puede estar a medio escribir: se espera un par de pasadas antes de darla por mala.
        const veces = (this.lecturasFallidas.get(n) || 0) + 1;
        this.lecturasFallidas.set(n, veces);
        if (veces >= 3) this.detener(2, 'orden', `La orden ${n} no es un JSON valido.`);
        continue;
      }
      this.lecturasFallidas.delete(n);
      let items;
      try {
        items = validarOrden(datos, id);
      } catch (e) {
        this.detener(2, 'orden', e.message);
        continue;
      }
      const T = conocida || { id, ruta, items: [], resultado: null, sucio: false, ultima: 0 };
      T.mtime = st.mtimeMs;
      if (!T.resultado) {
        const previo = leerJSON(path.join(this.dir.motor, `${id}.resultado.json`));
        T.resultado = previo && typeof previo === 'object' && previo.piezas && typeof previo.piezas === 'object' ? previo : { id, piezas: {} };
        if (!previo || previo.terminado !== true) T.sucio = true;
      }
      const ya = new Set(T.items.map((x) => x.pieza));
      for (const item of items) if (!ya.has(item.pieza)) T.items.push(item);
      this.ordenes.set(id, T);
      for (const item of T.items) this.prepararItem(T, item);
    }
  }

  /** El registro de la pieza en el resultado de su orden, y a la cola si no termino. */
  prepararItem(T, item) {
    const clave = `${item.pieza}|${item.orden}`;
    let rec = T.resultado.piezas[item.pieza];
    if (!rec || rec.orden !== item.orden) {
      rec = { orden: item.orden, estado: 'en-cola', intentosApi: this.intentosPor.get(clave) || 0, version: item.version };
      T.resultado.piezas[item.pieza] = rec;
      T.sucio = true;
    }
    if (ESTADOS_FINALES.has(rec.estado)) {
      this.finales.set(clave, { ...rec });
      return;
    }
    // Un intento que quedo abierto sin tarea en kie (la app se cerro mientras esperaba turno para pedir) no se gasto.
    if (rec.intentoAbierto && !rec.taskId) {
      const destino = item.orden === 'g' ? this.rutasDe(item.pieza).img : this.rutasDe(item.pieza).nuevaPng;
      if (!leerPendiente(destino)) {
        rec.intentosApi = Math.max(0, (Number(rec.intentosApi) || 0) - 1);
        rec.intentoAbierto = false;
        T.sucio = true;
      }
    }
    const k = `${T.id}|${item.pieza}`;
    if (this.agendadas.has(k) || this.abandonadas.has(k)) return;
    this.agendadas.add(k);
    this.cola.push({ T, item });
  }

  /** ¿Puede arrancar? Una pieza a la vez, y un 9:16 espera a que termine lo de su 1:1. */
  puedeArrancar({ T, item }) {
    if (this.enMarcha.has(item.pieza)) return false;
    if (formatoDePieza(item.pieza) !== '9:16') return true;
    const cuadrado = `${vDePieza(item.pieza)}_1x1`;
    if (this.enMarcha.has(cuadrado)) return false;
    // Un 1:1 de la misma variacion todavia en la cola (de esta orden o de otra): el vertical sale del cuadrado vigente.
    return !this.cola.some((x) => x.item.pieza === cuadrado);
  }

  lanzar() {
    if (this.detenido) return;
    for (let i = 0; i < this.cola.length && this.enMarcha.size < this.concurrencia; ) {
      const x = this.cola[i];
      if (!this.puedeArrancar(x)) {
        i++;
        continue;
      }
      this.cola.splice(i, 1);
      const p = this.procesar(x.T, x.item)
        .catch((e) => {
          if (e instanceof ErrorInvalido) this.detener(2, 'orden', e.message);
          else this.detener(1, 'otro', `${x.item.pieza}: ${textoDeError(e)}`);
        })
        .finally(() => {
          this.enMarcha.delete(x.item.pieza);
          this.avisar();
        });
      this.enMarcha.set(x.item.pieza, p);
    }
  }

  hayLanzable() {
    return !this.detenido && this.cola.some((x) => this.puedeArrancar(x));
  }

  detener(codigo, clase, texto) {
    if (this.detenido) return;
    this.detenido = { codigo, clase, texto };
    console.log(`\n  !!  ${codigo === 2 ? 'Orden o lote invalido' : 'Se deja de pedir'}: ${primeraLinea(texto)}`);
    if (codigo !== 2) console.log(this.chatgpt ? '      Las que ya estaban en marcha se esperan hasta que terminen.\n' : '      Las que ya estaban en kie se esperan hasta que terminen.\n');
  }

  // ------------------------------------------------------------ una pieza

  /** El V##.json de la variacion (se relee si cambio: la sesion de ajuste lo pone al dia). */
  leerV(v) {
    const ruta = path.join(this.carpeta, `${v}.json`);
    let st;
    try {
      st = fs.statSync(ruta);
    } catch {
      throw new ErrorInvalido(`Falta ${v}.json en el lote: no se puede armar su prompt.`);
    }
    const clave = `${st.size}|${st.mtimeMs}`;
    const c = this.cacheV.get(ruta);
    if (c && c.clave === clave) return c.ad;
    const ad = leerJSON(ruta);
    if (!ad || typeof ad !== 'object' || Array.isArray(ad)) throw new ErrorInvalido(`${v}.json no es un JSON valido.`);
    if (typeof ad.visual_prompt !== 'string' || !ad.visual_prompt.trim()) throw new ErrorInvalido(`${v}.json no trae visual_prompt.`);
    this.cacheV.set(ruta, { clave, ad });
    return ad;
  }

  /**
   * «Más de lo mismo» (lote.fiel): la referencia de esa variacion (plan.json: fuente "referencia"), para que el modelo
   * la vea junto con la foto del producto. null si el lote no es asi, si la variacion sale de la biblioteca o si la
   * imagen no esta (entonces se genera como siempre, solo con la foto).
   */
  /**
   * (2026-11-26b) ESTRUCTURA GANADORA: si el formato de la variación (plan.json → formato_id) trae `referencia` en el
   * índice de la skill (F33-F40: mis_archivos/biblioteca/referencias/…), esa imagen va como guía de diseño. null si no.
   */
  estructuraDe(v) {
    const plan = leerJSON(path.join(this.carpeta, 'plan.json'));
    const x = (plan?.variaciones || []).find((y) => y?.id === v);
    if (!x?.formato_id) return null;
    // (2026-11-26d) la app copia al lote la imagen de cada estructura (también las tuyas, P##) y anota cuál es cuál
    const mapa = leerJSON(path.join(this.carpeta, 'entrada', 'estructuras', 'mapa.json'));
    const enLote = typeof mapa?.[x.formato_id] === 'string' && /^entrada\/estructuras\/[\w.-]+\.(jpe?g|png|webp)$/i.test(mapa[x.formato_id]) ? path.join(this.carpeta, ...mapa[x.formato_id].split('/')) : null;
    if (enLote && existe(enLote)) return enLote;
    this.indice ||= leerJSON(path.join(RAIZ, '.claude', 'skills', 'anuncios-imagen-ads', 'formatos', 'indice.json')) || { formatos: [] };
    const f = (this.indice.formatos || []).find((y) => y?.id === x.formato_id);
    if (!f?.referencia) return null;
    const abs = path.resolve(RAIZ, f.referencia);
    const dentro = path.relative(path.join(RAIZ, 'mis_archivos'), abs);
    if (dentro.startsWith('..') || path.isAbsolute(dentro)) return null;
    return existe(abs) ? abs : null;
  }

  referenciaDe(v) {
    const estructura = this.estructuraDe(v);
    if (estructura) return estructura;
    // (2026-11-26a) «Vecinas»/«Conceptos»: el ganador va como referencia de estilo en todas (ver modoReferencia)
    if (this.lote.ganador) {
      const m = /(entrada\/referencias\/R\d{2}\.[a-z]+)$/i.exec(this.lote.ganador.replace(/\\/g, '/'));
      const abs = m ? path.join(this.carpeta, ...m[1].split('/')) : null;
      return abs && existe(abs) ? abs : null;
    }
    if (!this.lote.fiel) return null;
    const plan = leerJSON(path.join(this.carpeta, 'plan.json'));
    const x = (plan?.variaciones || []).find((y) => y?.id === v);
    if (!x || x.fuente !== 'referencia' || typeof x.referencia !== 'string') return null;
    const m = /(entrada\/referencias\/R\d{2}\.[a-z]+)$/i.exec(x.referencia.replace(/\\/g, '/'));
    if (!m) return null;
    const abs = path.join(this.carpeta, ...m[1].split('/'));
    return existe(abs) ? abs : null;
  }

  /**
   * (2026-11-26a) Cómo usa el modelo la referencia de una variación: 'composicion' (copia el diseño: «Fieles» y las de
   * su mismo formato), 'estilo' (solo estilo, producto y oferta: el resto de «Vecinas»/«Conceptos») o null.
   */
  modoReferencia(v) {
    if (this.estructuraDe(v)) return 'estructura';
    if (!this.referenciaDe(v)) return null;
    if (!this.lote.ganador) return 'composicion';
    const plan = leerJSON(path.join(this.carpeta, 'plan.json'));
    const x = (plan?.variaciones || []).find((y) => y?.id === v);
    return x?.mismo_formato_que_ganador === true ? 'composicion' : 'estilo';
  }

  armarPrompt(item, ad) {
    const formato = formatoDePieza(item.pieza);
    const logo = this.lote.logo;
    let armar;
    if (item.modo === 'editar') {
      const n = (item.adjuntos || []).length;
      const conAdjuntos = n ? ` The ${n === 1 ? 'THIRD attached image is a reference' : `attached images 3 to ${n + 2} are references`} the user attached: use ${n === 1 ? 'it' : 'them'} ONLY as this instruction says, and keep everything else of the current ad exactly as it is.` : '';
      armar = (a) => construirPromptEdicion(a, { instruccion: `${item.instruccion_en}${conAdjuntos}`, formato, textos: item.textos === true, logo });
    } else if (formato === '1:1') {
      const modo = this.modoReferencia(vDePieza(item.pieza));
      const referencia = modo === 'estilo' || modo === 'estructura' ? modo : Boolean(modo);
      armar = (a) => construirPrompt(a, { logo, correccion: item.correccion_en, referencia });
    } else {
      armar = (a) => construirPromptVertical(a, { conProducto: true, logo, correccion: item.correccion_en });
    }
    return ajustarLargo(armar(ad), ad, armar);
  }

  /**
   * Una copia con nombre por contenido en app/imagen-ads/subidas/: la cache de
   * subirArchivo es por ruta y este proceso vive mucho; con el nombre por
   * contenido nunca devuelve un cuadrado viejo.
   */
  copiaParaSubir(abs) {
    const st = fs.statSync(abs);
    const clave = `${abs}|${st.size}|${st.mtimeMs}`;
    const ya = this.copias.get(clave);
    if (ya && existe(ya)) return ya;
    const h = sha1(abs).slice(0, 10);
    const destino = path.join(this.dir.subidas, `${path.basename(abs, path.extname(abs))}-${h}${path.extname(abs) || '.png'}`);
    if (!existe(destino)) {
      fs.mkdirSync(this.dir.subidas, { recursive: true });
      const tmp = `${destino}.${process.pid}.tmp`;
      fs.copyFileSync(abs, tmp);
      renombrar(tmp, destino);
    }
    this.copias.set(clave, destino);
    return destino;
  }

  /** Las URLs de las entradas, en orden. La foto del producto se sube una vez por proceso. */
  async subirEntradas(archivos) {
    const urls = [];
    for (const a of archivos) {
      const subir = a === this.lote.rutaProducto ? a : this.copiaParaSubir(a);
      urls.push(await subirArchivo(subir, { uploadPath: 'imagen-ads' }));
    }
    return urls;
  }

  terminarComoFinal(T, item, rec) {
    this.finales.set(`${item.pieza}|${item.orden}`, { ...rec });
    return this.guardarYa(T);
  }

  async marcarLista(T, item, extra = {}) {
    const rec = T.resultado.piezas[item.pieza];
    Object.assign(rec, {
      estado: 'lista',
      version: item.version,
      firma: firmaDeArchivo(this.rutasDe(item.pieza).img),
      motivo: null,
      mensaje: null,
      intentoAbierto: false,
      ...extra,
    });
    await this.terminarComoFinal(T, item, rec);
  }

  async sinImagen(T, item, motivo, detalle = null) {
    const rec = T.resultado.piezas[item.pieza];
    Object.assign(rec, {
      estado: 'sin-imagen',
      motivo,
      mensaje: MENSAJES_SIN_IMAGEN[motivo] || MENSAJES_SIN_IMAGEN['fallo-de-kie'],
      intentoAbierto: false,
    });
    // Un rehacer que no salio: su texto en nuevas/ ya no sirve (la imagen anterior sigue en img/).
    if (item.orden !== 'g') {
      const r = this.rutasDe(item.pieza);
      if (!existe(r.nuevaPng) && !existe(r.nuevaJson)) borrar(r.nuevaTxt);
    }
    this.cuenta.sinImagen++;
    console.log(`  --  ${item.pieza}: sin imagen (${motivo})${detalle ? ` — ${primeraLinea(detalle)}` : ''}`);
    await this.terminarComoFinal(T, item, rec);
  }

  abandonar(T, item, porque) {
    this.abandonadas.add(`${T.id}|${item.pieza}`);
    (porque === 'sin-bajar' ? this.sinBajar : this.quedanEnKie).push(item.pieza);
    this.marcar(T);
  }

  anotarLog({ pieza, modeloReal, intentos, referencias, creditos, taskId }) {
    // la misma tarea de kie nunca dos veces (p. ej. el proceso cortado ya la anoto y este solo termino de moverla)
    if (taskId && this.log.some((x) => x.taskId === taskId)) return;
    this.log.push({
      id: pieza,
      archivo: `${pieza}.png`,
      modelo: modeloReal || null,
      respaldo: false,
      intentos: Number(intentos) || 1,
      referencias: Number(referencias) || 0,
      creditos: creditos ?? null,
      taskId: taskId || null,
    });
    this.escribirLog();
  }

  escribirLog() {
    try {
      escribirJSON(path.join(this.dir.img, 'log-modelos.json'), {
        generado: new Date().toISOString(),
        segundos: Math.round((Date.now() - this.t0) / 1000),
        imagenes: this.log,
      });
    } catch (e) {
      console.log(`  !  no pude escribir img/log-modelos.json (${e.message})`);
    }
  }

  /** --heredar-log: lo que anoto el proceso que se corto dentro de la misma corrida de gasto (ver la cabecera). */
  heredarRegistro() {
    if (!this.heredarLog) return;
    const abierta = leerJSON(path.join(this.carpeta, 'app', 'gasto', 'en-curso.json'));
    const log = leerJSON(path.join(this.dir.img, 'log-modelos.json'));
    const desde = Date.parse(abierta?.inicio);
    if (!Number.isFinite(desde) || !log || !(Date.parse(log.generado) >= desde) || !Array.isArray(log.imagenes)) return;
    this.log = log.imagenes.filter((x) => x && typeof x === 'object' && typeof x.archivo === 'string');
    this.heredadas = this.log.length;
    if (this.heredadas) console.log(`  ==  sigo el registro de gasto del proceso que se corto (${this.heredadas} ${this.heredadas === 1 ? 'imagen' : 'imagenes'})`);
  }

  // ---- rehacer: pasos (b) a (e)

  leerIndice() {
    const i = leerJSON(path.join(this.dir.versiones, 'indice.json'));
    return i && typeof i === 'object' && i.piezas && typeof i.piezas === 'object' ? i : { piezas: {} };
  }

  entradaDeIndice(pieza, orden) {
    const lista = this.leerIndice().piezas[pieza];
    return Array.isArray(lista) ? lista.find((x) => x && x.reemplazadaPor === orden) || null : null;
  }

  /** (b) La version que se reemplaza, en versiones/indice.json. null si la pieza no tenia imagen. */
  anotarVersion(pieza, a) {
    const ya = this.entradaDeIndice(pieza, a.orden);
    if (ya) return ya;
    const r = this.rutasDe(pieza);
    if (!existe(r.img)) return null;
    const indice = this.leerIndice();
    const lista = Array.isArray(indice.piezas[pieza]) ? indice.piezas[pieza] : [];
    const usados = new Set(lista.map((x) => Number(x?.n)));
    const libre = (n) => n >= 1 && !usados.has(n) && !existe(r.version(n, 'png'));
    let n = Number(a.version) - 1;
    if (!libre(n)) n = Math.max(0, ...usados) + 1;
    while (!libre(n)) n++;
    const entrada = {
      n,
      archivo: `versiones/${pieza}.v${n}.png`,
      prompt: existe(r.prompt) ? `versiones/${pieza}.v${n}.txt` : null,
      reemplazadaPor: a.orden,
      motivo: a.motivo || null,
      fecha: new Date().toISOString(),
    };
    indice.piezas[pieza] = [...lista, entrada];
    escribirJSON(path.join(this.dir.versiones, 'indice.json'), indice);
    return entrada;
  }

  /** (c) y (d), en un orden que se puede repetir desde cualquier punto. */
  completarRehacer(pieza, entrada) {
    const r = this.rutasDe(pieza);
    if (entrada) {
      fs.mkdirSync(this.dir.versiones, { recursive: true });
      if (existe(r.nuevaPng) && existe(r.img)) moverSinPisar(r.img, r.version(entrada.n, 'png'));
      if (existe(r.nuevaTxt) && existe(r.prompt)) moverSinPisar(r.prompt, r.version(entrada.n, 'txt'));
    }
    fs.mkdirSync(this.dir.img, { recursive: true });
    fs.mkdirSync(this.dir.prompts, { recursive: true });
    if (existe(r.nuevaPng)) renombrar(r.nuevaPng, r.img);
    if (existe(r.nuevaTxt)) renombrar(r.nuevaTxt, r.prompt);
  }

  /** De (b) a (e) para una regeneracion ya bajada a nuevas/ (con su nuevas/<pieza>.json). */
  async terminarRehacer(T, item, a, { registrar = true } = {}) {
    const pieza = item?.pieza ?? a.pieza;
    const entrada = this.anotarVersion(pieza, a); // (b)
    this.completarRehacer(pieza, entrada); // (c) y (d)
    if (registrar && !a.adoptada) {
      this.anotarLog({ pieza, modeloReal: a.modeloReal, intentos: a.intentos, referencias: a.referencias, creditos: a.creditos, taskId: a.taskId });
    }
    if (T && item) {
      await this.marcarLista(T, item, { creditos: a.creditos ?? null, taskId: a.taskId || null, modeloReal: a.modeloReal || null });
    }
    borrar(this.rutasDe(pieza).nuevaJson); // (e)
  }

  /**
   * Al arrancar: una regeneracion que quedo a medias (nuevas/<pieza>.json) y
   * cuya orden ya figura lista en un resultado solo necesita terminar de
   * mover archivos (no se cobra ni se anota otra vez).
   */
  barrerNuevas() {
    let nombres = [];
    try {
      nombres = fs.readdirSync(this.dir.nuevas);
    } catch {
      return;
    }
    for (const n of nombres) {
      const m = n.match(/^(V\d{2,3}_(?:1x1|9x16))\.json$/);
      if (!m) continue;
      const a = leerJSON(path.join(this.dir.nuevas, n));
      if (!a || typeof a.orden !== 'string') continue;
      const fin = this.finales.get(`${m[1]}|${a.orden}`);
      if (fin?.estado !== 'lista') continue;
      try {
        const entrada = this.anotarVersion(m[1], a);
        this.completarRehacer(m[1], entrada);
        borrar(path.join(this.dir.nuevas, n));
        console.log(`  ==  ${m[1]}: termine de guardar la regeneracion que quedo a medias (${a.orden})`);
      } catch (e) {
        console.log(`  !  ${m[1]}: no pude terminar de guardar la regeneracion que quedo a medias (${e.message})`);
      }
    }
  }

  /** Lo que hace cada pieza (ver la cabecera). Nunca lanza por un fallo de kie: lo anota. */
  async procesar(T, item) {
    const { pieza, orden } = item;
    const rec = T.resultado.piezas[pieza];
    const r = this.rutasDe(pieza);
    const rehacer = orden !== 'g';
    const formato = formatoDePieza(pieza);

    // 1) Lo que ya esta no se vuelve a pedir.
    const fin = this.finales.get(`${pieza}|${orden}`);
    if (fin) {
      Object.assign(rec, fin);
      this.cuenta.yaEstaban++;
      return this.guardarYa(T);
    }
    if (!rehacer && existe(r.img)) {
      this.cuenta.yaEstaban++;
      return this.marcarLista(T, item);
    }
    if (rehacer) {
      const a = leerJSON(r.nuevaJson);
      if (a && a.orden === orden) {
        // Bajada y pagada en una corrida que se corto (con o sin el paso b): se termina sin llamar a kie,
        // con sus creditos. Si la corrida cortada ya la habia anotado, gasto.js no la cuenta dos veces: la
        // imagen ya no es nueva para esta corrida.
        console.log(`  ==  ${pieza}: la regeneracion ya estaba bajada (${orden}); termino de guardarla sin pedir otra`);
        this.cuenta.listas++;
        return this.terminarRehacer(T, item, a);
      }
      const entrada = this.entradaDeIndice(pieza, orden);
      if (entrada) {
        this.completarRehacer(pieza, entrada);
        this.cuenta.yaEstaban++;
        return this.marcarLista(T, item);
      }
      if (a && typeof a.orden === 'string') {
        // Otra regeneracion de esta pieza quedo a medias: esta pagada, se guarda primero.
        console.log(`  ==  ${pieza}: habia otra regeneracion a medias (${a.orden}); la guardo antes de seguir`);
        await this.terminarRehacer(null, null, { ...a, pieza });
      }
    }

    // 2) El prompt.
    const ad = this.leerV(vDePieza(pieza));
    const prompt = this.armarPrompt(item, ad);

    // 3) Las entradas, en este orden.
    let archivos;
    if (item.modo === 'editar') {
      if (!existe(r.img)) return this.sinImagen(T, item, 'falta-imagen');
      // (2026-11-26h) después de la imagen actual y el producto, las que adjuntó el usuario (3.ª, 4.ª…)
      const adjuntos = (item.adjuntos || []).map((a) => path.join(this.carpeta, ...a.split('/'))).filter((a) => existe(a));
      archivos = [r.img, this.lote.rutaProducto, ...adjuntos];
    } else if (formato === '9:16') {
      const cuadrado = this.rutasDe(`${vDePieza(pieza)}_1x1`).img;
      if (!existe(cuadrado)) return this.sinImagen(T, item, 'falta-cuadrado');
      archivos = [cuadrado, this.lote.rutaProducto];
    } else {
      // «más de lo mismo»: primero la referencia de la variacion (el prompt la nombra como la PRIMERA) y despues el producto
      const ref = this.referenciaDe(vDePieza(pieza));
      archivos = ref ? [ref, this.lote.rutaProducto] : [this.lote.rutaProducto];
    }

    // 4) Destino, texto y huella.
    const destino = rehacer ? r.nuevaPng : r.img;
    const rutaTxt = rehacer ? r.nuevaTxt : r.prompt;
    const huella = huellaPieza({ prompt, aspecto: formato, archivos }, this.sha1s);

    // Una regeneracion bajada justo antes de que se cortara el proceso (sin su nuevas/<pieza>.json):
    // si es de este mismo pedido se usa (ya esta pagada); si no, se descarta.
    if (rehacer && existe(r.nuevaPng) && !leerPendiente(destino)) {
      if (leerTexto(r.nuevaTxt) === prompt) {
        console.log(`  ==  ${pieza}: la regeneracion ya estaba bajada; la guardo`);
        const a = { orden, huella, creditos: null, taskId: null, modeloReal: null, intentos: rec.intentosApi, referencias: archivos.length, version: item.version, motivo: item.motivo || null, adoptada: true };
        escribirJSON(r.nuevaJson, a);
        this.cuenta.listas++;
        return this.terminarRehacer(T, item, a);
      }
      borrar(r.nuevaPng);
    }
    escribirAtomico(rutaTxt, prompt);

    // 5') Con ChatGPT: sin subir nada, sin tareas que retomar y sin costo.
    if (this.chatgpt) return this.procesarConChatGPT(T, item, { prompt, archivos, destino, rehacer, huella, formato });

    // 5) Pedir, con los topes.
    let topes = 0;
    let descargas = 0;
    for (;;) {
      if (this.detenido) return; // queda sin terminar: la proxima corrida la sigue

      let urls;
      try {
        urls = await this.subirEntradas(archivos);
      } catch (e) {
        this.detenerPorError(e, 'subir las imagenes de entrada');
        return;
      }
      if (this.detenido) return;

      const retoma = Boolean(huella && leerPendiente(destino)?.huella === huella);
      let contado = false;
      if (!retoma) {
        if ((Number(rec.intentosApi) || 0) >= INTENTOS) return this.sinImagen(T, item, rec.ultimoMotivo || 'fallo-de-kie');
        rec.intentosApi = (Number(rec.intentosApi) || 0) + 1;
        rec.intentoAbierto = true;
        rec.taskId = null;
        rec.estado = 'creando';
        await this.guardarYa(T); // el intento queda anotado ANTES de pedir
        contado = true;
      } else {
        rec.estado = 'generando';
        this.marcar(T);
      }

      // Si la tarea retomada fallo o kie ya no la tiene, kie-client pide otra en la misma llamada: antes de crearla se
      // aplica el mismo tope y el intento queda anotado ANTES de pedir, igual que arriba (D6).
      const antesDeCrear = async ({ retomadaFallida = null } = {}) => {
        if (retomadaFallida?.esFalloDeModelo) {
          rec.ultimoMotivo = clasificarFallo(retomadaFallida) === 'contenido' ? 'contenido' : 'fallo-de-kie';
          console.log(`  ..  ${pieza}: intento ${rec.intentosApi}/${INTENTOS} fallo en kie (${primeraLinea(retomadaFallida.message).slice(0, 140)})`);
        }
        if (contado) return;
        if ((Number(rec.intentosApi) || 0) >= INTENTOS) throw Object.assign(new Error(`${pieza}: ya se usaron los ${INTENTOS} intentos`), { topeDeIntentos: true });
        if (retomadaFallida?.esFalloDeModelo) await dormir(2000 * (Number(rec.intentosApi) || 1));
        if (this.detenido) throw Object.assign(new Error(`${pieza}: el motor dejo de pedir`), { sinPedir: true });
        rec.intentosApi = (Number(rec.intentosApi) || 0) + 1;
        rec.intentoAbierto = true;
        rec.taskId = null;
        rec.estado = 'creando';
        contado = true;
        await this.guardarYa(T); // el intento queda anotado ANTES de pedir
      };

      let creada = false;
      const alActualizar = (d) => {
        if (d?.state === 'created') {
          creada = true;
          if (!contado) {
            // La retomada fallo en kie y kie-client pidio otra: ese si es un intento.
            rec.intentosApi = (Number(rec.intentosApi) || 0) + 1;
            contado = true;
          }
          rec.intentoAbierto = true;
          Object.assign(rec, { taskId: d.taskId, modeloReal: d.modeloReal || null, estado: 'generando' });
          this.guardarYa(T);
        } else if (d?.state === 'retomada') {
          Object.assign(rec, { taskId: d.taskId, modeloReal: d.modeloReal || null, estado: 'generando' });
          this.marcar(T);
        } else if (d?.state && rec.estado !== 'generando') {
          rec.estado = 'generando';
          this.marcar(T);
        }
      };

      try {
        const res = await generarImagen({
          modelo: MODELO,
          prompt,
          imagenesReferencia: urls,
          aspectRatio: formato,
          resolucion: RESOLUCION,
          ...(FONDO ? { fondo: FONDO } : {}),
          rutaDestino: destino,
          huella,
          alActualizar,
          antesDeCrear,
          alAvisar: (s) => console.log(`  ..  ${pieza}: sigue generando en kie a los ${s} s; se espera la MISMA tarea (no se pide otra)`),
        });
        rec.intentoAbierto = false;
        return this.alSalirBien(T, item, res, { rehacer, huella, referencias: urls.length });
      } catch (e) {
        // La retomada fallo y ya no quedan intentos: no se pidio otra.
        if (e?.topeDeIntentos) return this.sinImagen(T, item, rec.ultimoMotivo || 'fallo-de-kie');
        // El motor se detuvo (clave, saldo…) mientras esta esperaba para pedir otra: queda sin terminar.
        if (e?.sinPedir) {
          rec.estado = 'en-cola';
          rec.intentoAbierto = false;
          this.marcar(T);
          return;
        }
        if (esSigueEnKie(e)) {
          topes++;
          const sigueAnotada = huella && leerPendiente(destino)?.huella === huella;
          if (topes < TOPES_DE_ESPERA && sigueAnotada) {
            console.log(`  ..  ${pieza}: la tarea sigue en kie; la sigo esperando (${topes}/${TOPES_DE_ESPERA - 1} esperas mas)`);
            continue;
          }
          console.log(`  ..  ${pieza}: la tarea ${e.taskId || ''} sigue en kie sin terminar; queda anotada para la proxima corrida`);
          this.abandonar(T, item, 'kie');
          return;
        }
        if (esPagadaSinBajar(e)) {
          if (e.conservaPendiente) {
            descargas++;
            if (descargas <= REINTENTOS_DESCARGA) {
              console.log(`  ..  ${pieza}: kie la hizo pero no se pudo bajar; pruebo de nuevo en ${ESPERA_DESCARGA_MS / 1000} s (bajar no cobra)`);
              await dormir(ESPERA_DESCARGA_MS);
              continue;
            }
            console.log(`  ..  ${pieza}: sigue sin bajar; queda anotada y la proxima corrida la baja sin pagar otra`);
            this.abandonar(T, item, 'sin-bajar');
            return;
          }
          return this.sinImagen(T, item, 'no-se-pudo-bajar', e.message);
        }
        if (e?.esFalloDeModelo) {
          rec.intentoAbierto = false;
          const motivo = clasificarFallo(e) === 'contenido' ? 'contenido' : 'fallo-de-kie';
          rec.ultimoMotivo = motivo;
          console.log(`  ..  ${pieza}: intento ${rec.intentosApi}/${INTENTOS} fallo en kie (${primeraLinea(e.message).slice(0, 140)})`);
          if (rec.intentosApi >= INTENTOS) return this.sinImagen(T, item, motivo, e.message);
          await this.guardarYa(T);
          await dormir(2000 * rec.intentosApi);
          continue;
        }
        if (!creada) {
          // kie no creo la tarea (o ni se llego a pedir).
          const codigo = codigoDelError(e);
          const cuenta = !esDeClave(e) && codigo !== null && codigo >= 400 && codigo < 500 && codigo !== 402 && codigo !== 429;
          if (cuenta) {
            // Un pedido que kie rechaza (4xx): cuenta como intento.
            if (!contado) rec.intentosApi = (Number(rec.intentosApi) || 0) + 1;
            rec.intentoAbierto = false;
            rec.ultimoMotivo = 'pedido-invalido';
            console.log(`  ..  ${pieza}: intento ${rec.intentosApi}/${INTENTOS}: kie no acepto el pedido (${primeraLinea(e.message).slice(0, 140)})`);
            if (rec.intentosApi >= INTENTOS) return this.sinImagen(T, item, 'pedido-invalido', e.message);
            await this.guardarYa(T);
            await dormir(2000 * rec.intentosApi);
            continue;
          }
          // Clave, saldo, red, 429 o el servidor de kie: no se gasto nada, el intento se devuelve.
          if (contado) {
            rec.intentosApi = Math.max(0, rec.intentosApi - 1);
            rec.intentoAbierto = false;
          }
          if (!retoma) rec.estado = 'en-cola';
          await this.guardarYa(T);
          this.detenerPorError(e, 'pedir la imagen');
          return;
        }
        // La tarea se creo y despues algo fallo sin remedio (p. ej. la clave al consultar): queda anotada.
        this.marcar(T);
        this.detenerPorError(e, `esperar ${pieza}`);
        return;
      }
    }
  }

  /**
   * Una pieza con la suscripcion de ChatGPT. Hasta INTENTOS intentos (anotados antes de pedir). Sin sesion o sin uso
   * disponible: el intento se devuelve y se deja de pedir (la app lo dice con su marca CHATGPT_SIN_SESION o
   * CHATGPT_LIMITE).
   */
  async procesarConChatGPT(T, item, { prompt, archivos, destino, rehacer, huella, formato }) {
    const { pieza } = item;
    const rec = T.resultado.piezas[pieza];
    for (;;) {
      if (this.detenido) return;
      if ((Number(rec.intentosApi) || 0) >= INTENTOS) return this.sinImagen(T, item, rec.ultimoMotivo || 'fallo-de-chatgpt');
      rec.intentosApi = (Number(rec.intentosApi) || 0) + 1;
      rec.intentoAbierto = true;
      rec.taskId = null;
      rec.estado = 'generando';
      await this.guardarYa(T);
      try {
        const res = await generarConChatGPT({
          prompt,
          referencias: archivos,
          aspecto: formato,
          rutaDestino: destino,
          codex: this.chatgpt,
          alAvisar: (s) => console.log(`  ..  ${pieza}: ChatGPT sigue haciendo la imagen (${s} s)`),
        });
        rec.intentoAbierto = false;
        return this.alSalirBien(T, item, res, { rehacer, huella, referencias: archivos.length });
      } catch (e) {
        rec.intentoAbierto = false;
        if (e?.sinSesion || e?.limite) {
          rec.intentosApi = Math.max(0, (Number(rec.intentosApi) || 1) - 1);
          rec.estado = 'en-cola';
          await this.guardarYa(T);
          return this.detener(1, e.sinSesion ? 'chatgpt-sesion' : 'chatgpt-limite', `${e.sinSesion ? 'CHATGPT_SIN_SESION' : 'CHATGPT_LIMITE'} ${primeraLinea(e.message)}`);
        }
        const motivo = e?.contenido ? 'contenido-chatgpt' : 'fallo-de-chatgpt';
        rec.ultimoMotivo = motivo;
        console.log(`  ..  ${pieza}: intento ${rec.intentosApi}/${INTENTOS} fallo en ChatGPT (${primeraLinea(e?.message || String(e)).slice(0, 160)})`);
        if (rec.intentosApi >= INTENTOS) return this.sinImagen(T, item, motivo, e?.message);
        await this.guardarYa(T);
        await dormir(3000 * rec.intentosApi);
      }
    }
  }

  /** Un fallo de todo el proceso: deja de pedir, con un texto que procesos.clasificarFallo entiende. */
  detenerPorError(e, que) {
    const codigo = codigoDelError(e);
    if (esDeClave(e)) {
      return this.detener(1, 'clave', `kie.ai rechazo la clave (401) al ${que}. No se pidio nada mas.\n  Detalle: ${primeraLinea(e.message)}`);
    }
    if (codigo === 402) {
      return this.detener(1, 'saldo', `kie.ai no creo la tarea: saldo insuficiente (code=402) al ${que}.\n  Detalle: ${primeraLinea(e.message)}`);
    }
    return this.detener(1, 'general', `No pude ${que}: ${textoDeError(e)}`);
  }

  async alSalirBien(T, item, res, { rehacer, huella, referencias }) {
    const rec = T.resultado.piezas[item.pieza];
    const intentos = Number(rec.intentosApi) || 1;
    if (!rehacer) {
      // Ya quedo en img/ (kie-client baja a .parcial y renombra).
      this.anotarLog({ pieza: item.pieza, modeloReal: res.modeloReal, intentos, referencias, creditos: res.creditos, taskId: res.taskId });
      this.cuenta.listas++;
      console.log(`  OK  ${item.pieza} — ${res.creditos ?? '?'} cr${res.retomada ? ' (retomada)' : ''}`);
      return this.marcarLista(T, item, { creditos: res.creditos ?? null, taskId: res.taskId, modeloReal: res.modeloReal || null });
    }
    // (a) lo que hace falta para terminar sin volver a llamar a kie.
    const a = {
      orden: item.orden,
      huella,
      creditos: res.creditos ?? null,
      taskId: res.taskId,
      modeloReal: res.modeloReal || null,
      intentos,
      referencias,
      version: item.version,
      motivo: item.motivo || null,
    };
    escribirJSON(this.rutasDe(item.pieza).nuevaJson, a);
    this.cuenta.listas++;
    console.log(`  OK  ${item.pieza} — ${res.creditos ?? '?'} cr (version ${item.version}, ${item.orden})${res.retomada ? ' (retomada)' : ''}`);
    return this.terminarRehacer(T, item, a);
  }

  // ------------------------------------------------------------ el bucle

  async correr() {
    console.log(`\n=== Anuncios de imagen — ${path.basename(this.carpeta)} ===\n`);
    console.log(`  Modelo: ${this.chatgpt ? `${MODELO_CHATGPT}, con tu suscripcion (sin costo por imagen)` : `${MODELO} a ${RESOLUCION}${FONDO ? `, fondo ${FONDO}` : ''}`}${this.lote.logo ? `; logo ${this.lote.logo.posicion} (lo pega la app)` : ''}`);
    console.log(`  Hasta ${this.concurrencia} a la vez; sale tras ${Math.round(this.ociosaMs / 1000)} s sin trabajo.\n`);

    this.heredarRegistro();
    this.cargarFinales();
    this.barrerNuevas();
    let ocioDesde = Date.now();
    let ultimaMirada = 0;
    for (;;) {
      if (Date.now() - ultimaMirada >= CADA_MS - 50) {
        this.escanear();
        ultimaMirada = Date.now();
      }
      this.lanzar();
      this.guardarSucios();
      if (!this.enMarcha.size && !this.hayLanzable()) {
        if (this.detenido) break;
        if (Date.now() - ocioDesde >= this.ociosaMs) {
          // Una ultima mirada antes de salir.
          this.escanear();
          this.lanzar();
          if (!this.enMarcha.size && !this.hayLanzable()) break;
          ocioDesde = Date.now();
        }
      } else {
        ocioDesde = Date.now();
      }
      await new Promise((resolve) => {
        const t = setTimeout(fin, CADA_MS);
        function fin() {
          clearTimeout(t);
          resolve();
        }
        this.avisar = fin;
      });
      this.avisar = () => {};
    }
    await Promise.allSettled([...this.enMarcha.values()]);
    this.guardarSucios({ forzar: true });
    if (this.log.length) this.escribirLog();
    return this.cerrar();
  }

  cerrar() {
    const seg = Math.round((Date.now() - this.t0) / 1000);
    const { listas, sinImagen, yaEstaban } = this.cuenta;
    const creditos = this.log.slice(this.heredadas).reduce((s, x) => s + (Number(x.creditos) || 0), 0);
    console.log(
      `\n  Listo en ${seg} s: ${listas} ${listas === 1 ? 'lista' : 'listas'}, ${sinImagen} sin imagen, ${yaEstaban} ${yaEstaban === 1 ? 'ya estaba' : 'ya estaban'}.`
    );
    console.log(`  Gasto real: ${creditos} creditos = US$${creditosAUsd(creditos).toFixed(2)}`);

    if (this.detenido) {
      console.error(`\n  SE DETUVO\n\n  ${this.detenido.texto}\n`);
      return this.detenido.codigo;
    }
    if (this.quedanEnKie.length || this.sinBajar.length) {
      if (this.quedanEnKie.length) {
        console.error(
          `\n  Quedan en kie ${this.quedanEnKie.length} ${this.quedanEnKie.length === 1 ? 'imagen' : 'imagenes'} sin terminar (${this.quedanEnKie.join(', ')}).` +
            '\n  No se pidieron otras para no pagar dos veces: al volver a correr se retoman esas mismas tareas.'
        );
      }
      if (this.sinBajar.length) {
        console.error(
          `\n  ${this.sinBajar.length} ${this.sinBajar.length === 1 ? 'imagen quedo' : 'imagenes quedaron'} sin bajar (${this.sinBajar.join(', ')}): kie ya las hizo.` +
            '\n  Al volver a correr se bajan esas mismas, sin pagar otras.'
        );
      }
      console.error('');
      return 1;
    }
    console.log('');
    return 0;
  }
}

// ---------------------------------------------------------------- CLI

function opcionNumero(args, nombre, porDefecto, { min, max }) {
  const i = args.indexOf(nombre);
  if (i === -1) return porDefecto;
  const n = Number(args[i + 1]);
  if (!Number.isFinite(n) || n < min || n > max) throw new ErrorInvalido(`${nombre} necesita un numero entre ${min} y ${max}.`);
  return n;
}

async function cli() {
  const args = process.argv.slice(2);
  const valores = new Set(['--concurrencia', '--ociosa', '--motor'].map((o) => args.indexOf(o)).filter((i) => i !== -1).map((i) => i + 1));
  const heredarLog = args.includes('--heredar-log');
  const carpetaArg = args.find((a, i) => !a.startsWith('--') && !valores.has(i));
  if (!carpetaArg) {
    console.error('\n  Uso: node produccion/generar-imagen-ads.js temp/<lote> [--motor chatgpt|kie] [--concurrencia 30] [--ociosa 20] [--heredar-log]\n');
    return 2;
  }
  let motor;
  try {
    const carpeta = path.resolve(carpetaArg);
    if (!fs.existsSync(carpeta) || !fs.statSync(carpeta).isDirectory()) throw new ErrorInvalido(`No existe la carpeta del lote: ${carpetaArg}`);
    const iMotor = args.indexOf('--motor');
    const conChatGPT = iMotor !== -1 && args[iMotor + 1] === 'chatgpt';
    if (iMotor !== -1 && !['chatgpt', 'kie'].includes(args[iMotor + 1])) throw new ErrorInvalido('--motor necesita chatgpt o kie.');
    const concurrencia = Math.round(opcionNumero(args, '--concurrencia', conChatGPT ? 3 : 30, { min: 1, max: 100 }));
    const ociosaMs = Math.round(opcionNumero(args, '--ociosa', 20, { min: 0, max: 3600 }) * 1000);
    const lote = leerLote(carpeta);
    let chatgpt = null;
    if (conChatGPT) {
      chatgpt = codexDesdeEntorno();
      if (!chatgpt) {
        console.error('\n  CHATGPT_SIN_SESION Falta conectar ChatGPT para hacer imagenes (Ajustes › Conexiones).\n');
        return 1;
      }
    }
    motor = new Motor({ carpeta, carpetaArg, lote, concurrencia, ociosaMs, heredarLog, chatgpt });
  } catch (e) {
    console.error(`\n  ${e.message}\n`);
    return e instanceof ErrorInvalido ? 2 : 1;
  }

  // La clave: la app la pasa en el entorno en modo prueba (la falsa); si no, del .env, como el resto del motor.
  try {
    cargarEnv();
  } catch {
    // sin .env: vale la que venga en el entorno (requerirClave lo dice si no hay ninguna)
  }
  if (motor.chatgpt) return motor.correr();
  try {
    requerirClave('KIE_API_KEY', 'pegala en Ajustes de la app (sale de https://kie.ai/api-key)');
  } catch (e) {
    console.error(`\n  ${e.message}\n`);
    return 1;
  }
  return motor.correr();
}

// Nunca process.exit(): un process.exit() justo despues de un fetch aborta en
// Windows con Node 24 ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)",
// codigo 127) aunque ya se imprimio todo (ver generar-imagenes.js). Con
// process.exitCode el proceso cierra solo cuando no queda nada pendiente.
if (process.argv[1] && process.argv[1].endsWith('generar-imagen-ads.js')) {
  try {
    process.exitCode = await cli();
  } catch (e) {
    console.error(`\n  SE DETUVO\n\n  ${textoDeError(e)}\n`);
    process.exitCode = e instanceof ErrorInvalido ? 2 : 1;
  }
}

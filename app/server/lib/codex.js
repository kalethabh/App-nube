// Lanzador de Codex, el programa de ChatGPT, para las mismas tareas que hace Claude (claude.js), con la cuenta de
// ChatGPT del usuario (DISENO-motor-codex.md §2). Codex trabaja SIN herramientas: no abre, no busca, no escribe y no
// corre nada. La app lo hace por el, con las MISMAS reglas que recibe Claude (o.permitidas y o.prohibidas):
//   - le pega en el mensaje lo que la tarea puede leer (ia/material.js) y le adjunta las imagenes con -i;
//   - guarda lo que devuelve en `archivos` (enteros) y en `ediciones` (buscar -> reemplazar, la regla del Edit de
//     Claude) solo si la tarea puede escribirlo (ia/reglas.js), con escribirSeguro: nunca queda un archivo a medias
//     (un .json con saltos de linea de verdad dentro de un texto se arregla antes: reglas.arreglarJSON);
//   - corre por el los comandos exactos que la tarea permite y le devuelve lo que imprimieron;
//   - revisa con el mismo verificar() de hoy y, si algo falta, se lo dice en la misma conversacion (exec resume).
// Las reglas del MODO APP (modo-app.md + modo-app-codex.md) van en developer_instructions, en cada mensaje.
// Cada uuid de la app queda unido a un hilo de Codex (<CODEX_HOME>/anuncios-hilos.json) para retomar.
//
//   lanzarSesion(o) -> el contrato de claude.js (ok, error, detalle, limite, reinicio, sinSesion, sinClaude, cancelado,
//     ocupada, tiempo, colgado, bloqueado, faltan, verificacion, resultado, turnos, uso…) mas planSinCodex.
//     o es el de claude.js mas: material (§2.6), esfuerzo ('alto'), cambios { pedido, guionDelUsuario, archivos }
//   estadoCodex() · olvidarEstadoCodex() · codexEnUso()
//   abrirLoginCodex({ conCodigo }) · cancelarLoginCodex() · estadoLoginCodex() · cerrarSesionCodex()
//   limpiarHilosViejos() · MENSAJES · VERSION_CODEX · resolverCodex() · olvidarCodex()
//
// Solo para las pruebas (acortan plazos y topes): AIA_CODEX_PLAZO_ARRANQUE_MS, AIA_CODEX_PLAZO_MENSAJE_MS,
// AIA_CODEX_AVISO_MS, AIA_CODEX_ESPERA_PASAJERO_MS, AIA_CODEX_ESPERA_CANDADO_MS, AIA_CODEX_PLAZO_COMANDO_MS,
// AIA_CODEX_PLAZO_LOGIN_MS, AIA_CODEX_TOPE_CONTEXTO, AIA_CODEX_LIMPIEZA_MS, AIA_CODEX_SESIONES_TOPE_MB y
// AIA_CODEX_SESIONES_BAJAR_MB. Y, solo en modo prueba, AIA_CODEX_ESFUERZO=high|medium (fuerza el esfuerzo: P2).
//
// El freno de la sesion del usuario (codex-rutas.js): si el CODEX_HOME fuera ~/.codex (solo en las pruebas con
// --home-usuario), la app no escribe ahi su config.toml, no corre login, logout ni delete y no borra nada.
import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RAIZ } from './rutas.js';
import { escribirSeguro, escribirJSONSeguro } from './archivos.js';
import { describirHerramienta, textoModoApp, textoClaude } from './claude.js';
import { registrarActiva, quitarActiva, sesionActiva, turno, soltarTurno, tieneQueEsperar, anotarLotes, matar, MAX_SESIONES_CODEX } from './ia/fila.js';
import { traducir, aplicarEdiciones, arreglarJSON, normalizarComando, claveDeRuta, TOPE_ESCRITURA_ARCHIVO, TOPE_ESCRITURA_MENSAJE } from './ia/reglas.js';
import {
  armarMaterial,
  resolverLecturas,
  bloquesDeMensaje,
  repartirImagenes,
  lineaFaltanImagenes,
  LINEA_YA_TODAS,
  estimarTokens,
  TOKENS_POR_IMAGEN_GRANDE,
  tomasTocadas,
  textoTomasTocadas,
  sha1De,
  TOPE_IMAGENES,
  ERROR_NO_ENTRA,
} from './ia/material.js';
import {
  VERSION_CODEX,
  resolverCodex,
  olvidarCodex,
  leerVersionCodex,
  sinColores,
  carpetasCodex,
  esHomeDelUsuario,
  asegurarConfigCodex,
  vaciarTrabajo,
  entornoCodex,
  argsExec,
  argsResume,
  argsCuenta,
  argsDelete,
} from './codex-rutas.js';
import { consultarCuenta, refrescarCuenta, olvidarRefresco, limitesFrescos, limitesCacheados, sinUsoOrdinario, cuentaEnFila, cuentaLibre, marcarLogin, hayLoginAbierto, olvidarLimites } from './codex-app-server.js';

export { VERSION_CODEX, resolverCodex, olvidarCodex };

// ---------------------------------------------------------------- textos (§2.21)

export const MENSAJES = {
  limite: 'Se acabó por ahora el uso de tu plan de ChatGPT. Toca "Reintentar" cuando se renueve: lo ya hecho no se repite.',
  planSinCodex: 'Tu plan de ChatGPT no incluye Codex o ya no le queda uso. Si acabas de pagar un plan o estás en un espacio de trabajo (Business), en Ajustes › Conexiones toca «Cerrar sesión en la app» y vuelve a entrar eligiendo ese espacio; después toca "Reintentar": lo ya hecho no se repite.',
  espacioSinCreditos: 'Tu espacio de trabajo de ChatGPT se quedó sin créditos para Codex. El dueño del espacio puede agregar créditos en chatgpt.com (Configuración del espacio › Facturación). Después toca "Reintentar": lo ya hecho no se repite.',
  espacioLimite: 'Llegaste al límite de uso de Codex que te dio tu espacio de trabajo de ChatGPT. El dueño del espacio lo puede subir; si no, toca "Reintentar" cuando se renueve: lo ya hecho no se repite.',
  // en un paso de la produccion el boton es «Continuar» y la tarjeta ya agrega «Toca "Continuar" para reintentarlo…»
  planSinCodexPaso: 'Tu plan de ChatGPT no incluye Codex o ya no le queda uso. Revisa tu plan en chatgpt.com.',
  herramientas: 'ChatGPT intentó usar herramientas que la app no le da y no terminó. Toca "Reintentar".',
  sinSesion: 'Falta iniciar sesión con tu cuenta de ChatGPT. Toca "Iniciar sesión" y después "Reintentar".',
  sinCodex: 'Falta Codex, el programa de ChatGPT, en tu PC. Ve a Ajustes › Conexiones y toca "Instalar".',
  otraCuenta: 'Codex entró con una clave de API, no con tu cuenta de ChatGPT. Inicia sesión con tu cuenta y reintenta.',
  vueltas: 'ChatGPT llegó al límite de pasos de esta tarea sin terminarla. Toca "Reintentar": sigue desde donde quedó.',
  error: 'ChatGPT tuvo un error mientras trabajaba. Toca "Reintentar".',
  colgado: 'ChatGPT dejó de responder. Toca "Reintentar": sigue desde donde quedó.',
  tiempo: 'ChatGPT tardó demasiado en esta tarea. Toca "Reintentar": sigue desde donde quedó.',
  incompleto: 'ChatGPT terminó, pero lo que dejó escrito no está completo. Toca "Reintentar".',
  cancelado: 'Se canceló.',
};

const OCUPADA = 'ChatGPT ya está trabajando en esto.';
const SE_CERRO = 'ChatGPT se cerró sin terminar. Toca "Reintentar".';
const FALTA_CODEX = 'Falta Codex en tu PC.';
const OTRA_VERSION = 'Tu Codex no es la versión que usa la app. Toca «Instalar» para dejarla lista.';
const FRASE_ESPERA = 'Esperando turno: ChatGPT está terminando otra tarea';
const FRASE_INICIO = 'ChatGPT empezó a trabajar';
const FRASE_SIGUE = 'Sigue escribiendo: lo largo tarda unos minutos más';
const FRASE_CORRIGE = 'Corrigiendo lo que faltaba';
const FRASE_OTRA_VEZ = 'ChatGPT no respondía: lo intento otra vez';
// lo que reconoce el Codex falso de las pruebas (§2.5, §2.7 y §2.9): tiene que ir tal cual
const AVISO_RETOMA = '(Tarea nueva en esta misma conversación. Lo que valía antes para escribir y para los comandos ya no vale: vale solo lo de abajo.)';
const AVISO_DE_NUEVO = '(Esta tarea ya empezó en otra conversación, que se cerró. Lo que escribiste hasta ahora está en MATERIAL con su contenido de ahora: sigue desde ahí y no rehagas lo que ya está bien.)';
const PIDE_JSON = 'Tu respuesta no fue el JSON pedido. Vuelve a mandarla con el formato: estado, respuesta, archivos, ediciones, leer, comandos.';
const SIN_HERRAMIENTAS = 'No tienes herramientas ni subagentes: todo lo que necesitas está en este mensaje. Responde solo con el JSON pedido.';
const SIGUE_PROXIMO = 'Sigue con el próximo archivo.';
const LO_ULTIMO = '## LO QUE PASÓ CON TU ÚLTIMO MENSAJE';

// ---------------------------------------------------------------- plazos y topes

const desdeEntorno = (nombre, def) => {
  const n = Number(process.env[nombre]);
  return Number.isFinite(n) && n > 0 ? n : def;
};
/** Los plazos (§2.14), leidos en cada sesion: las pruebas los acortan con AIA_CODEX_*. */
const plazos = () => ({
  arranque: desdeEntorno('AIA_CODEX_PLAZO_ARRANQUE_MS', 5 * 60000), // sin turn.started = colgado (la entrada sin cerrar, el antivirus)
  mensaje: desdeEntorno('AIA_CODEX_PLAZO_MENSAJE_MS', 45 * 60000), // de turn.started a la respuesta
  aviso: desdeEntorno('AIA_CODEX_AVISO_MS', 5 * 60000), // «Sigue escribiendo…», una vez
  pasajero: desdeEntorno('AIA_CODEX_ESPERA_PASAJERO_MS', 30000), // la segunda espera es 4 veces esta (2 min)
  candado: desdeEntorno('AIA_CODEX_ESPERA_CANDADO_MS', 5000), // el candado del hilo despues de cortar un turno
  comando: desdeEntorno('AIA_CODEX_PLAZO_COMANDO_MS', 3 * 60000),
  login: desdeEntorno('AIA_CODEX_PLAZO_LOGIN_MS', 15 * 60000),
});
const FACTOR_PLAZO = 2; // el plazo total de una sesion es el de Claude por esto (§6.3 lo calibra)
const PLAZO_MAXIMO = 4 * 60 * 60000;
const ENTREGAS = 30; // entregas por partes (no son vueltas)
const MAX_HERRAMIENTAS = 3; // mas intentos de herramientas en un mensaje: se corta (§2.14)
const TOPE_LINEA = 30000; // caracteres de la linea de comando (el de Windows es 32.767)
const TOPE_SALIDA = 16 * 1024; // lo que se devuelve de un comando
const TOPE_COMANDOS = 8; // comandos por mensaje
const TOPE_COPIA = 200 * 1024; // el archivo de ahora que se le manda cuando una edicion no se aplico
// Las revisiones de imagenes y clips tambien van con esfuerzo alto (pruebas reales, P4: con el medio razonaron de 14 a
// 983 tokens y no fueron estables; en la tanda R005, medio 7/8 y alto 8/8 contra lo que hay en las imagenes)
const ESFUERZO_ALTO = new Set(['guion', 'cambios', 'tomas', 'imagen-ads-estrategia', 'imagen-ads-prompts', 'revision', 'revision-clips', 'imagen-ads-revision']);
// El plazo de UN mensaje: 45 min en las que escriben mucho (el guion, sus cambios, las tomas, la estrategia y los
// prompts de imagen, y las que pasan esfuerzo alto, como los pasos de continuidad); 20 en las demas (revisiones,
// ficha, rechazos, letra, ajuste, rehacer). En las pruebas reales ninguna de esas tardo mas de 6,2 min en un mensaje,
// y un cuelgue mudo (P5, objeto-clips: 45 min sin un solo evento) se corta antes y se reintenta solo una vez.
const ESCRIBEN_MUCHO = new Set(['guion', 'cambios', 'tomas', 'imagen-ads-estrategia', 'imagen-ads-prompts']);
const PLAZO_MENSAJE_CORTO = 20 * 60000;
// lo que suma un mensaje a la conversacion, con las imagenes como las cuenta Codex de verdad (P0, punto 5)
const estimarCtx = (texto, n) => estimarTokens(texto, n, { porImagen: TOKENS_POR_IMAGEN_GRANDE });
const CONTEXTO_CHICO = new Set(['guion', 'cambios', 'tomas', 'imagen-ads-estrategia']); // escriben respuestas grandes
// las que el usuario reintenta con «Reintentar» (el guion, sus cambios y la ficha): el plan sin Codex lo nombra; las
// demas son pasos de la produccion (boton «Continuar») o pantallas con su propio texto (imagen ads, el editor)
const TAREAS_CON_REINTENTAR = new Set(['guion', 'cambios', 'ficha']);

function topeDeContexto(tipo) {
  const forzado = desdeEntorno('AIA_CODEX_TOPE_CONTEXTO', 0);
  if (forzado) return forzado;
  return CONTEXTO_CHICO.has(String(tipo || '')) ? 150000 : 200000;
}

function esfuerzoDe(o) {
  // solo las pruebas reales (P2, high contra medium en el guion): AIA_CODEX_ESFUERZO=high|medium manda sobre el de la
  // tarea, y solo en modo prueba (ANUNCIOS_MODO_PRUEBA=1): la app de verdad nunca lo lee
  const forzado = process.env.ANUNCIOS_MODO_PRUEBA === '1' ? String(process.env.AIA_CODEX_ESFUERZO || '').toLowerCase() : '';
  if (forzado === 'high' || forzado === 'medium') return forzado;
  const e = String(o.esfuerzo || '').toLowerCase();
  if (e === 'alto' || e === 'high') return 'high';
  if (e === 'medio' || e === 'medium') return 'medium';
  return ESFUERZO_ALTO.has(String(o.tipo || '')) ? 'high' : 'medium';
}

/** El plazo de un mensaje para esta tarea (AIA_CODEX_PLAZO_MENSAJE_MS, en las pruebas, manda sobre los dos). */
export function plazoDeMensaje(o) {
  const forzado = desdeEntorno('AIA_CODEX_PLAZO_MENSAJE_MS', 0);
  if (forzado) return forzado;
  const e = String(o.esfuerzo || '').toLowerCase();
  return ESCRIBEN_MUCHO.has(String(o.tipo || '')) || e === 'alto' || e === 'high' ? plazos().mensaje : PLAZO_MENSAJE_CORTO;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dormir = (ms, senal) =>
  new Promise((resolve) => {
    if (senal?.aborted) return resolve();
    const listo = () => {
      clearTimeout(t);
      senal?.removeEventListener('abort', listo);
      resolve();
    };
    const t = setTimeout(listo, ms);
    senal?.addEventListener('abort', listo, { once: true });
  });
const kb = (b) => `${Math.max(1, Math.round((Number(b) || 0) / 1024)).toLocaleString('es')} KB`;
const sumarSinRepetir = (lista, x, tope = 300) => {
  if (x && !lista.includes(x)) lista.push(x);
  if (lista.length > tope) lista.splice(0, lista.length - tope);
};

/** Las reglas del MODO APP para Codex: las de Claude (modo-app.md) y como se traducen sin herramientas. */
const instrucciones = () => `${textoModoApp()}\n\n${textoClaude('modo-app-codex')}`;

// ---------------------------------------------------------------- arranque (una vez por CODEX_HOME)

const arrancados = new Set();

/** El config.toml propio, la carpeta de trabajo vacia y, un rato despues, el borrado de los hilos viejos. */
function asegurarArranque() {
  const c = carpetasCodex();
  if (arrancados.has(c.home)) return;
  arrancados.add(c.home);
  try {
    asegurarConfigCodex(c.home); // (con ~/.codex no escribe nada: el freno)
  } catch (e) {
    console.error(`[codex] config.toml: ${e.message}`);
  }
  if (esHomeDelUsuario(c.home)) return; // con la sesion del usuario no se vacia ni se borra nada
  try {
    vaciarTrabajo(c.trabajo);
  } catch (e) {
    console.error(`[codex] carpeta de trabajo: ${e.message}`);
  }
  const t = setTimeout(() => {
    limpiarHilosViejos().catch((e) => console.error(`[codex] hilos viejos: ${e?.message || e}`));
  }, desdeEntorno('AIA_CODEX_LIMPIEZA_MS', 2 * 60000));
  t.unref?.();
}

/** Donde corren los comandos cortos de la cuenta: la carpeta de trabajo si existe (nunca se crea aca). */
function dirCorto() {
  const { trabajo } = carpetasCodex();
  try {
    if (fs.statSync(trabajo).isDirectory()) return trabajo;
  } catch {
    /* todavia no esta */
  }
  return os.tmpdir();
}

/** Un subcomando de la cuenta (login status, logout, delete): { codigo, texto, err, freno? }. Nunca se anota su texto. */
function correrCuenta(sub, { timeout = 20000 } = {}) {
  const bin = resolverCodex();
  if (!bin) return Promise.resolve({ codigo: null, texto: '', err: { code: 'ENOENT' } });
  let args;
  try {
    args = Array.isArray(sub) && sub[0] === 'delete' ? argsDelete(sub[1]) : argsCuenta(sub);
  } catch (e) {
    return Promise.resolve({ codigo: null, texto: '', err: e, freno: /^freno/.test(e.message) });
  }
  return new Promise((resolve) => {
    execFile(bin.cmd, [...bin.pre, ...args], { cwd: dirCorto(), env: entornoCodex(), timeout, windowsHide: true, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      const codigo = !err ? 0 : typeof err.code === 'number' ? err.code : null;
      resolve({ codigo, texto: sinColores(`${stdout || ''}\n${stderr || ''}`), err: err || null });
    });
  });
}

// ---------------------------------------------------------------- estado de la cuenta (§2.18)

const sesionesCodex = new Set(); // las de ChatGPT registradas en la fila (trabajando, esperando turno o mirando la cuenta)
let conTurnoCodex = 0; // las que ya tienen su lugar
let cacheEstado = null; // { t, valor, promesa }
let primeraVersion = true;

/** Que la proxima vez se vuelva a preguntar (despues de iniciar o cerrar sesion, o de cambiar de IA). */
export const olvidarEstadoCodex = () => {
  olvidarRefresco();
  cacheEstado = null;
};

/** true si Codex esta en uso: una sesion de ChatGPT registrada o un inicio de sesion abierto (no se reinstala). */
export const codexEnUso = () => sesionesCodex.size > 0 || Boolean(login?.enCurso) || hayLoginAbierto();

/**
 * { instalado, version, sesion: 'ok'|'sin-sesion'|'desconocido', cuenta?: { email, plan }, avisoPlan?, limites?,
 * actualizar?, otraCuenta?, motivo? }. Se recuerda 10 min con sesion y 10 s sin ella, y mientras hay sesiones de
 * ChatGPT trabajando no se vuelve a preguntar (la misma regla de claude.js). Las consultas simultaneas comparten una.
 */
export function estadoCodex() {
  if (cacheEstado?.promesa) return cacheEstado.promesa;
  const conSesion = cacheEstado?.valor?.sesion === 'ok';
  if (cacheEstado && conSesion && conTurnoCodex > 0) return Promise.resolve(cacheEstado.valor);
  // (sin la version leida, 10 s: la proxima consulta la vuelve a mirar)
  if (cacheEstado && Date.now() - cacheEstado.t < (conSesion && cacheEstado.valor?.version ? 10 * 60000 : 10000)) return Promise.resolve(cacheEstado.valor);
  const promesa = consultarEstado().catch(() => ({ instalado: false, version: null, sesion: 'desconocido' }));
  cacheEstado = { t: 0, valor: null, promesa };
  promesa.then((valor) => {
    if (cacheEstado?.promesa === promesa) cacheEstado = { t: Date.now(), valor, promesa: null };
  });
  return promesa;
}

async function consultarEstado() {
  asegurarArranque();
  const bin = resolverCodex();
  if (!bin) return { instalado: false, version: null, sesion: 'sin-sesion', motivo: FALTA_CODEX };
  // la primera vez de esta app, 2 min: el antivirus revisa el .exe de 369 MB
  const v = await leerVersionCodex({ timeout: primeraVersion ? 120000 : 20000, bin });
  if (v.err && ['ENOENT', 'EACCES', 'ENOTDIR'].includes(v.err.code)) {
    olvidarCodex();
    return { instalado: false, version: null, sesion: 'sin-sesion', motivo: FALTA_CODEX };
  }
  if (v.version) primeraVersion = false;
  const base = { instalado: true, version: v.version };
  // otra version solo si se leyo y es distinta, o si termino sin decirla. Si `--version` se paso del tiempo (el
  // antivirus, la PC ocupada) no se sabe y se sigue con login status, como claude.js (marca solo la version que leyo):
  // la app lanza siempre el Codex de su carpeta codex-0.167.0
  if ((v.version && v.version !== VERSION_CODEX) || (!v.version && !v.err?.killed)) {
    base.actualizar = true;
    base.motivo = OTRA_VERSION;
  }
  // login status: el codigo de salida y el texto de stdout y stderr juntos (el real escribe en stderr)
  const s = await cuentaEnFila(() => correrCuenta(['login', 'status']));
  if (!s) return { ...base, sesion: 'desconocido' }; // hay un inicio de sesion abierto
  if (s.err?.code === 'ENOENT') {
    olvidarCodex();
    return { instalado: false, version: null, sesion: 'sin-sesion', motivo: FALTA_CODEX };
  }
  if (s.codigo === 0 && /Logged in using ChatGPT/i.test(s.texto)) {
    const valor = { ...base, sesion: 'ok' };
    let cuenta = await consultarCuenta().catch(() => null); // sin correo la pantalla igual funciona
    // (2026-11-20s) un plan sin Codex o sin uso: puede ser el token viejo (pagó Business o cambió de espacio): se pide
    // uno nuevo y se vuelve a mirar (a lo sumo cada 2 min)
    if (cuenta && (/^(free|go)$/i.test(String(cuenta.plan || '')) || sinUsoOrdinario(await limitesCacheados().catch(() => null)))) {
      const nuevo = await refrescarCuenta().catch(() => null);
      if (nuevo?.cuenta) cuenta = nuevo.cuenta;
    }
    if (cuenta) {
      valor.cuenta = cuenta;
      if (/^(free|go)$/i.test(String(cuenta.plan || ''))) valor.avisoPlan = true;
    }
    const limites = await limitesCacheados().catch(() => null);
    if (limites) valor.limites = limites;
    return valor;
  }
  // con otra forma de entrar (una clave de API): esa linea no se guarda en ningun lado
  if (s.codigo === 0 && /Logged in using/i.test(s.texto)) return { ...base, sesion: 'sin-sesion', otraCuenta: true, motivo: MENSAJES.otraCuenta };
  if (s.codigo === 1 || /Not logged in/i.test(s.texto)) return { ...base, sesion: 'sin-sesion' };
  return { ...base, sesion: 'desconocido' };
}

// ---------------------------------------------------------------- iniciar y cerrar sesion (§2.18)

let login = null; // { enCurso, modo, url?, enlace?, codigo?, desde, error?, ok?, hijo, reloj }

/** El inicio de sesion de ChatGPT en curso (o el ultimo): { enCurso, modo, url?, enlace?, codigo?, desde, error? } o null. */
export function estadoLoginCodex() {
  if (!login) return null;
  const { hijo, reloj, ...visible } = login;
  return { ...visible };
}

/** Corta el inicio de sesion abierto (el boton «Cancelar», o uno nuevo). true si habia uno. */
export function cancelarLoginCodex() {
  const l = login;
  login = null;
  if (!l?.enCurso) return false;
  l.enCurso = false;
  l.error = 'cancelado';
  clearTimeout(l.reloj);
  if (l.hijo) matar(l.hijo);
  marcarLogin(false);
  olvidarEstadoCodex(); // (terminar() ya no lo hace: enCurso quedo en false) lo de mientras se iniciaba no vale
  return true;
}

const esperarHasta = async (cond, ms) => {
  const fin = Date.now() + ms;
  while (!cond() && Date.now() < fin) await dormir(50);
};

/**
 * Abre el inicio de sesion de ChatGPT como proceso hijo, sin ventana negra: `codex login` abre solo el navegador (y la
 * app guarda la URL por si no se abrio); con conCodigo, `codex login --device-auth` da un enlace y un codigo que vence
 * en 15 min. Un login nuevo corta el anterior. -> { ok:true, login } si se abrio (si despues falla, login.error dice
 * 'puerto', 'sin-codigo', 'tiempo' o 'fallo'), o { ok:false, error? (un texto para la pantalla), motivo?, freno? }.
 */
export async function abrirLoginCodex({ conCodigo = false } = {}) {
  const bin = resolverCodex();
  if (!bin) return { ok: false, error: MENSAJES.sinCodex };
  let args;
  try {
    args = argsCuenta(['login', ...(conCodigo ? ['--device-auth'] : [])]);
  } catch (e) {
    return { ok: false, freno: true, motivo: e.message }; // la sesion del usuario: no se toca
  }
  cancelarLoginCodex();
  asegurarArranque();
  const este = { enCurso: true, modo: conCodigo ? 'codigo' : 'navegador', desde: new Date().toISOString(), hijo: null, reloj: null };
  login = este;
  await cuentaLibre(); // ninguna consulta de cuenta corre a la vez que un login
  if (login !== este) return { ok: false, cancelado: true };
  marcarLogin(true);
  let hijo;
  try {
    hijo = spawn(bin.cmd, [...bin.pre, ...args], { cwd: dirCorto(), env: entornoCodex(), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  } catch (e) {
    este.enCurso = false;
    este.error = 'fallo';
    marcarLogin(false);
    return { ok: false, motivo: e.message };
  }
  este.hijo = hijo;
  let texto = '';
  // (setEncoding: una letra partida entre dos trozos espera al siguiente, no queda «�»)
  hijo.stdout.setEncoding('utf8');
  hijo.stderr.setEncoding('utf8');
  const leer = (d) => {
    texto = (texto + d).slice(-20000);
    const t = sinColores(texto);
    if (conCodigo) {
      if (!este.enlace) este.enlace = (t.match(/https:\/\/auth\.openai\.com\/codex\/device[^\s"'<>)]*/) || [])[0];
      if (!este.codigo) este.codigo = (t.match(/\b[A-Z0-9]{4}-[A-Z0-9]{4,5}\b/) || [])[0];
    } else if (!este.url) este.url = (t.match(/https:\/\/auth\.openai\.com\/[^\s"'<>)]+/) || [])[0];
  };
  hijo.stdout.on('data', leer);
  hijo.stderr.on('data', leer);
  const terminar = (codigo, e = null) => {
    if (!este.enCurso) return;
    este.enCurso = false;
    clearTimeout(este.reloj);
    este.hijo = null;
    if (login === este) marcarLogin(false);
    if (codigo === 0) {
      este.ok = true;
      delete este.error;
    } else if (!este.error) {
      const t = sinColores(texto);
      este.error = /address (already )?in use|is already in use|addrinuse|os error (10048|98|48)\b/i.test(t) ? 'puerto' : /device code login is not enabled/i.test(t) ? 'sin-codigo' : e?.code === 'ENOENT' ? 'sin-codex' : 'fallo';
    }
    olvidarEstadoCodex();
    olvidarLimites();
  };
  este.reloj = setTimeout(() => {
    if (!este.enCurso) return;
    este.error = 'tiempo';
    matar(hijo);
  }, plazos().login);
  este.reloj.unref?.();
  hijo.on('error', (e) => terminar(null, e));
  hijo.on('close', (codigo) => terminar(codigo));
  // un momento, para que la primera respuesta ya traiga la URL (o el enlace y el codigo)
  await esperarHasta(() => !este.enCurso || (conCodigo ? este.enlace && este.codigo : este.url), 5000);
  return { ok: true, login: login === este ? estadoLoginCodex() : null };
}

/** `codex logout` en el CODEX_HOME de la app (nunca en ~/.codex). -> { ok } o { ok:false, error? (para la pantalla), motivo? } */
export async function cerrarSesionCodex() {
  try {
    argsCuenta(['logout']);
  } catch (e) {
    return { ok: false, freno: true, motivo: e.message };
  }
  cancelarLoginCodex();
  const r = await cuentaEnFila(() => correrCuenta(['logout']));
  olvidarEstadoCodex();
  olvidarLimites();
  if (!r) return { ok: false, motivo: 'login-abierto' };
  if (r.codigo === 0) return { ok: true };
  return r.err?.code === 'ENOENT' ? { ok: false, error: MENSAJES.sinCodex } : { ok: false, motivo: 'fallo' };
}

// ---------------------------------------------------------------- los hilos (uuid -> thread de Codex, §2.12)

let almacen = null; // { ruta, datos, marca }
const THREAD = UUID;
const hiloValido = (h) => Boolean(h && typeof h === 'object' && THREAD.test(String(h.thread || '')));
const marcaDe = (ruta) => {
  try {
    const st = fs.statSync(ruta);
    return `${st.mtimeMs}:${st.size}`;
  } catch {
    return null;
  }
};

/** anuncios-hilos.json en memoria; si alguien lo cambio por fuera (otra app, una prueba), se vuelve a leer. */
function hilosGuardados() {
  const ruta = carpetasCodex().hilos;
  const marca = marcaDe(ruta);
  if (!almacen || almacen.ruta !== ruta || almacen.marca !== marca) {
    let datos = {};
    try {
      const v = JSON.parse(fs.readFileSync(ruta, 'utf8').replace(/^﻿/, ''));
      if (v && typeof v === 'object' && !Array.isArray(v)) datos = v;
    } catch {
      /* todavia no hay */
    }
    almacen = { ruta, datos, marca };
  }
  return almacen.datos;
}
/** Guarda los hilos (con escribirJSONSeguro); con uuid y hilo, primero pone ese. */
function guardarHilos(uuid = null, hilo = null) {
  const datos = hilosGuardados();
  if (uuid && hilo) datos[uuid] = hilo;
  try {
    escribirJSONSeguro(almacen.ruta, datos);
    almacen.marca = marcaDe(almacen.ruta);
  } catch (e) {
    console.error(`[codex] no pude guardar los hilos: ${e.message}`);
  }
}

/** `codex delete --force <thread>` (sin --force pregunta y no borra). -> { ok, freno? } */
async function borrarHilo(thread) {
  const r = await correrCuenta(['delete', thread]);
  if (r.freno) return { ok: false, freno: true, error: r.err?.message };
  if (r.codigo === 0 || /not found|no rollout/i.test(r.texto)) return { ok: true };
  return { ok: false };
}

function archivosDeSesiones(dir) {
  const out = [];
  const visitar = (d, hondo) => {
    let ents = [];
    try {
      ents = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of ents) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) {
        if (hondo < 8) visitar(f, hondo + 1);
      } else if (e.isFile()) {
        try {
          out.push({ nombre: e.name, bytes: fs.statSync(f).size });
        } catch {
          /* se borro recien */
        }
      }
    }
  };
  visitar(dir, 0);
  return out;
}

/**
 * Cada vez que arranca la app (§2.12): borra con `codex delete` los hilos que no se usan hace mas de 30 dias y los que
 * quedaron atras al arrancar de nuevo; si <CODEX_HOME>/sessions pasa de 3 GB, los mas viejos hasta bajar de 2 GB.
 * Nunca toca los de una sesion que esta trabajando, y con ~/.codex no hace nada. -> { ok, borrados, … }
 */
export async function limpiarHilosViejos({ dias = 30 } = {}) {
  const c = carpetasCodex();
  if (esHomeDelUsuario(c.home)) return { ok: true, borrados: 0, motivo: 'home-del-usuario' };
  if (!resolverCodex()) return { ok: false, borrados: 0, motivo: 'sin-codex' };
  const datos = hilosGuardados();
  const limite = Date.now() - dias * 86400000;
  let borrados = 0;
  const fallidos = [];
  const borrar = async (thread) => {
    const r = await borrarHilo(thread);
    if (r.freno) throw new Error(r.error || 'freno');
    if (r.ok) borrados++;
    else fallidos.push(thread);
    return r.ok;
  };
  try {
    for (const [uuid, h] of Object.entries(datos)) {
      if (!h || typeof h !== 'object') {
        delete datos[uuid];
        continue;
      }
      if (sesionActiva(uuid)) continue;
      const quedan = [];
      for (const t of Array.isArray(h.anteriores) ? h.anteriores : []) if (THREAD.test(String(t)) && !(await borrar(t))) quedan.push(t);
      if (quedan.length) h.anteriores = quedan;
      else delete h.anteriores;
      const usado = Date.parse(h.usado || h.creado || '') || 0;
      if (usado < limite && (!hiloValido(h) || (await borrar(h.thread)))) delete datos[uuid];
    }
    // el tope de disco de las conversaciones guardadas
    const tope = desdeEntorno('AIA_CODEX_SESIONES_TOPE_MB', 3 * 1024) * 1048576;
    const bajarA = (Number(process.env.AIA_CODEX_SESIONES_BAJAR_MB) >= 0 && process.env.AIA_CODEX_SESIONES_BAJAR_MB !== undefined ? Number(process.env.AIA_CODEX_SESIONES_BAJAR_MB) : 2 * 1024) * 1048576;
    const archivos = archivosDeSesiones(path.join(c.home, 'sessions'));
    let total = archivos.reduce((s, a) => s + a.bytes, 0);
    if (total > tope) {
      const pesoDe = (thread) => archivos.filter((a) => a.nombre.toLowerCase().includes(String(thread).toLowerCase())).reduce((s, a) => s + a.bytes, 0);
      const porUso = Object.entries(datos)
        .filter(([uuid, h]) => hiloValido(h) && !sesionActiva(uuid))
        .sort(([, a], [, b]) => (Date.parse(a.usado || a.creado || '') || 0) - (Date.parse(b.usado || b.creado || '') || 0));
      for (const [uuid, h] of porUso) {
        if (total < bajarA) break;
        const peso = pesoDe(h.thread);
        if (await borrar(h.thread)) {
          delete datos[uuid];
          total -= peso;
        }
      }
    }
  } catch (e) {
    guardarHilos();
    return { ok: false, borrados, freno: true, error: e.message };
  }
  guardarHilos();
  return { ok: !fallidos.length, borrados, fallidos };
}

// ---------------------------------------------------------------- errores (§2.15)

const RX_PLAN = /quota_exceeded|usage_not_included|quota exceeded|to use codex with your chatgpt plan,? upgrade to plus/i;
const RX_LIMITE = /you[’']ve hit your usage limit|usage limit|out of credits|spend cap|usage_limit_reached|usage_limit_exceeded|rate_limit_exceeded|credits_depleted|rate_limit_reached|try again at/i;
const RX_VENCIDA = /refresh token (was already used|has expired|was revoked|is (expired|invalid))|could not be refreshed|refresh_token_failed|\b401\b/i;
const RX_SIN_SESION = /not logged in|codex login|authentication required|gateway_login_required/i;
const RX_CONTEXTO = /context_window_exceeded|ran out of room in the model'?s context window|session_budget_exceeded/i;
const RX_CORTADA = /response_incomplete/i;
const RX_HILO = /no rollout found|thread_not_found|thread not found/i;
// El candado del hilo: otro proceso de Codex todavia escribe esa conversacion. Visto en vivo (P0, punto 12): «thread/
// resume failed: thread <id> already has an active writer (code -32600)», con «thread-store conflict» en stderr. Si el
// proceso se mato (Detener, cierre de la app), el candado se suelta enseguida: retomar al toque anduvo.
const RX_CANDADO = /already has an active writer|thread-store conflict|thread[-_ ]writer[-_ ]lock|writer lock|locked by another|another (process|writer) (is|holds)|could not acquire[^\n]*lock/i;
const RX_LARGO = /input_too_large|maximum length/i;
const RX_PASAJERO = /stream disconnected|retry limit reached|\b5\d\d\b|server_overloaded|high demand|at capacity|flex_unavailable|\b429\b/i;
// Un intento de herramienta que no llega como evento: con code_mode_host apagado, `exec` (y lo que va adentro, como
// view_image o apply_patch) falla antes de ser un item y solo deja en stderr «ERROR codex_core::tools::router:
// error=code-mode host is disabled» (P0, punto 2). Los subagentes si llegan como item (collab_tool_call).
const RX_INTENTO_HERRAMIENTA = /tools::router\b.*\berror=/;

function claseDeTexto(t) {
  if (!t) return null;
  if (RX_PLAN.test(t)) return 'planSinCodex'; // antes que el limite: «usage limit» tambien calza con estos
  if (RX_LIMITE.test(t)) return 'limite';
  if (RX_VENCIDA.test(t)) return 'sesionVencida';
  if (RX_SIN_SESION.test(t)) return 'sinSesion';
  if (RX_CONTEXTO.test(t)) return 'contexto';
  if (RX_CORTADA.test(t)) return 'cortada';
  if (RX_HILO.test(t)) return 'hiloPerdido';
  if (RX_CANDADO.test(t)) return 'candado';
  if (RX_LARGO.test(t)) return 'largo';
  if (RX_PASAJERO.test(t)) return 'transitorio';
  return null;
}

const textoDelFallo = (r) => [r.fallo ? `${r.fallo.message || ''} ${JSON.stringify(r.fallo)}` : '', sinColores(r.stderr)].join('\n');
/** Que fallo: primero turn.failed y stderr; si no dicen nada, los ultimos eventos `error`. */
const clasificar = (r) => claseDeTexto(textoDelFallo(r)) || claseDeTexto(r.errores.join('\n'));
const detalleDe = (r) => `${textoDelFallo(r)}\n${r.errores.slice(-2).join('\n')}`.trim().slice(-600) || undefined;

function horaDe(reinicio) {
  const d = reinicio ? new Date(reinicio) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return ` (se renueva a las ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')})`;
}

const MESES = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
/** La hora del texto del limite: «Try again at 3:04 PM» (hoy, o manana si ya paso) o «… at Nov 13th, 2026 8:14 PM». */
function horaDelTexto(t) {
  const m = /try again at\s+(?:([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\s+)?(\d{1,2}):(\d{2})\s*([AP]M)/i.exec(String(t || ''));
  if (!m) return null;
  const hora = (Number(m[4]) % 12) + (m[6].toUpperCase() === 'PM' ? 12 : 0);
  let d;
  if (m[1]) {
    const mes = MESES[m[1].slice(0, 3).toLowerCase()];
    if (mes === undefined) return null;
    d = new Date(Number(m[3]), mes, Number(m[2]), hora, Number(m[5]), 0, 0);
  } else {
    d = new Date();
    d.setHours(hora, Number(m[5]), 0, 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  }
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const conLimite = (reinicio, detalle, tipo) =>
  /^workspace_/.test(String(tipo || ''))
    ? { ok: false, limite: true, reinicio: reinicio || null, error: /credits_depleted/.test(tipo) ? MENSAJES.espacioSinCreditos : MENSAJES.espacioLimite, detalle }
    : { ok: false, limite: true, reinicio: reinicio || null, error: MENSAJES.limite.replace('se renueve', `se renueve${horaDe(reinicio)}`), detalle };

// ---------------------------------------------------------------- la respuesta (§2.8)

/** { ok, resp } o { ok:false, cortada }: el JSON del ultimo agent_message, con la forma del esquema. */
function leerRespuesta(texto) {
  const t = String(texto ?? '').trim();
  let v;
  try {
    v = JSON.parse(t);
  } catch {
    return { ok: false, cortada: !t.endsWith('}') };
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { ok: false, cortada: false };
  for (const k of ['archivos', 'ediciones', 'leer', 'comandos']) if (v[k] !== undefined && v[k] !== null && !Array.isArray(v[k])) return { ok: false, cortada: false };
  return {
    ok: true,
    resp: {
      // si el enum no se respetara, cualquier otro valor cuenta como SEGUIR
      estado: ['LISTO', 'BLOQUEADO', 'SEGUIR'].includes(v.estado) ? v.estado : 'SEGUIR',
      respuesta: typeof v.respuesta === 'string' ? v.respuesta : '',
      archivos: v.archivos || [],
      ediciones: v.ediciones || [],
      leer: (v.leer || []).filter((x) => typeof x === 'string' && x.trim()),
      comandos: (v.comandos || []).filter((x) => typeof x === 'string' && x.trim()),
    },
  };
}

// ---------------------------------------------------------------- guardar (§2.10)

/**
 * Guarda lo que devolvio Codex: cada ruta pasa por reglas.puedeEscribir; las ediciones de un archivo van todas o
 * ninguna (aplicarEdiciones); todo se valida antes y se escribe con escribirSeguro. -> { guardados: [{ rel, bytes,
 * tipo: 'archivo'|'ediciones', n }], rechazados: [{ tipo: 'escribir'|'editar', ruta, motivo, copia? }], mostrados }
 */
function guardar(resp, reglas, { frase, hilo }) {
  const g = { guardados: [], rechazados: [], mostrados: {} };
  const rechazar = (tipo, ruta, motivo, extra = {}) => g.rechazados.push({ tipo, ruta: String(ruta ?? ''), motivo, ...extra });
  const claveDe = (r, ruta) => (r?.rel ? claveDeRuta(r.rel) : `?${String(ruta)}`);
  // las ediciones, agrupadas por archivo en el orden en que llegaron
  const porArchivo = new Map();
  for (const e of resp.ediciones) {
    if (!e || typeof e.ruta !== 'string' || !e.ruta.trim()) {
      rechazar('editar', e?.ruta, 'la edición no trae `ruta`');
      continue;
    }
    const r = reglas.puedeEscribir(e.ruta);
    const k = claveDe(r, e.ruta);
    if (!porArchivo.has(k)) porArchivo.set(k, { ruta: e.ruta, r, lista: [] });
    porArchivo.get(k).lista.push(e);
  }
  // los archivos enteros (si uno llega dos veces, vale el ultimo)
  const enteros = new Map();
  for (const a of resp.archivos) {
    if (!a || typeof a.ruta !== 'string' || !a.ruta.trim() || typeof a.contenido !== 'string') {
      rechazar('escribir', a?.ruta, 'no trae `ruta` y `contenido` como texto');
      continue;
    }
    const bytes = Buffer.byteLength(a.contenido, 'utf8');
    const r = reglas.puedeEscribir(a.ruta, { bytes });
    enteros.set(claveDe(r, a.ruta), { ruta: a.ruta, contenido: a.contenido, bytes, r });
  }
  // un mismo archivo en archivos y en ediciones: ninguna de las dos
  for (const k of [...enteros.keys()]) {
    if (!porArchivo.has(k)) continue;
    const x = enteros.get(k);
    const motivo = 'llegó en `archivos` y en `ediciones` en el mismo mensaje: mándalo de una sola forma';
    rechazar('escribir', x.r.rel || x.ruta, motivo);
    rechazar('editar', x.r.rel || x.ruta, motivo);
    enteros.delete(k);
    porArchivo.delete(k);
  }
  const aEscribir = [];
  let total = 0;
  const entra = (bytes) => total + bytes <= TOPE_ESCRITURA_MENSAJE;
  // un .json con saltos de linea de verdad dentro de un texto se arregla antes de guardarlo (arreglarJSON); si igual
  // no se lee, se guarda como llego y se le avisa con el error de JSON, para que lo corrija con `ediciones`
  const comoJSON = (rel, contenido) => {
    if (!/\.json$/i.test(String(rel))) return { contenido, arreglados: 0, jsonMal: null };
    const a = arreglarJSON(contenido);
    return { contenido: a.texto, arreglados: a.arreglados, jsonMal: a.ok ? null : a.error };
  };
  for (const x of enteros.values()) {
    if (!x.r.ok) {
      rechazar('escribir', x.r.rel || x.ruta, x.r.motivo);
      continue;
    }
    const j = comoJSON(x.r.rel, x.contenido);
    const bytes = Buffer.byteLength(j.contenido, 'utf8');
    if (bytes > TOPE_ESCRITURA_ARCHIVO) {
      rechazar('escribir', x.r.rel, 'pesa más de 1,5 MB: es demasiado para un archivo de la tarea');
      continue;
    }
    if (!entra(bytes)) {
      rechazar('escribir', x.r.rel, 'no entra en este mensaje (lo que guarda un mensaje pesa como mucho 4 MB): mándalo en el próximo');
      continue;
    }
    total += bytes;
    aEscribir.push({ rel: x.r.rel, abs: x.r.abs, contenido: j.contenido, bytes, existia: x.r.existe, tipo: 'archivo', arreglados: j.arreglados, jsonMal: j.jsonMal });
  }
  for (const y of porArchivo.values()) {
    const ruta = y.r.rel || y.ruta;
    if (!y.r.ok) {
      rechazar('editar', ruta, y.r.motivo);
      continue;
    }
    if (!y.r.existe) {
      rechazar('editar', ruta, 'ese archivo no existe: mándalo entero en `archivos`');
      continue;
    }
    let actual;
    try {
      actual = fs.readFileSync(y.r.abs, 'utf8');
    } catch {
      rechazar('editar', ruta, 'no pude abrir ese archivo');
      continue;
    }
    const a = aplicarEdiciones(actual, y.lista);
    if (!a.ok) {
      // el archivo de ahora va solo si la tarea tambien lo puede leer: lo que no se lee no viaja por ningun camino
      const lect = reglas.puedeLeer(y.r.rel);
      if (lect.ok) rechazar('editar', ruta, a.error, { copia: actual, aplicar: true });
      else rechazar('editar', ruta, `${a.error} (no te lo puedo mandar: ${lect.motivo})`);
      continue;
    }
    const j = comoJSON(y.r.rel, a.texto);
    const bytes = Buffer.byteLength(j.contenido, 'utf8');
    if (bytes > TOPE_ESCRITURA_ARCHIVO) {
      rechazar('editar', ruta, 'el archivo quedaría con más de 1,5 MB');
      continue;
    }
    if (!entra(bytes)) {
      rechazar('editar', ruta, 'no entran en este mensaje (lo que guarda un mensaje pesa como mucho 4 MB): mándalas en el próximo');
      continue;
    }
    total += bytes;
    aEscribir.push({ rel: y.r.rel, abs: y.r.abs, contenido: j.contenido, bytes, existia: true, tipo: 'ediciones', n: y.lista.length, arreglados: j.arreglados, jsonMal: j.jsonMal });
  }
  for (const w of aEscribir) {
    try {
      escribirSeguro(w.abs, w.contenido);
    } catch (e) {
      rechazar(w.tipo === 'archivo' ? 'escribir' : 'editar', w.rel, `no se pudo guardar (${e.code || e.message})`);
      continue;
    }
    g.guardados.push({ rel: w.rel, bytes: w.bytes, tipo: w.tipo, n: w.n || 0, arreglados: w.arreglados || 0, jsonMal: w.jsonMal || null });
    frase(describirHerramienta(w.existia ? 'Edit' : 'Write', { file_path: w.rel }));
    if (hilo) {
      sumarSinRepetir((hilo.escritos ||= []), w.rel);
      // Codex sabe como quedo, salvo si la app le arreglo el JSON: entonces la proxima tarea se lo vuelve a mandar
      if (w.arreglados) delete (hilo.enviados ||= {})[w.rel];
      else (hilo.enviados ||= {})[w.rel] = sha1De(Buffer.from(w.contenido, 'utf8'));
    }
  }
  return g;
}

// ---------------------------------------------------------------- los comandos (§2.11)

function correrUnComando(c, ctx) {
  return new Promise((resolve) => {
    const env = entornoCodex(); // sin las claves del motor ni las de otras cuentas
    delete env.CODEX_HOME;
    let hijo;
    try {
      hijo = spawn(process.execPath, [path.join(RAIZ, 'produccion', c.script), ...c.args], { cwd: RAIZ, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    } catch (e) {
      return resolve({ codigo: null, salida: `No se pudo correr: ${e.message}`, cortado: false });
    }
    ctx.entrada.hijo = hijo; // Detener lo corta tambien
    let texto = '';
    let cortado = false;
    // un decodificador por tubo: una letra partida entre dos trozos no queda como «�»
    hijo.stdout.setEncoding('utf8');
    hijo.stderr.setEncoding('utf8');
    const sumar = (d) => {
      texto = (texto + d).slice(-2 * TOPE_SALIDA);
    };
    hijo.stdout.on('data', sumar);
    hijo.stderr.on('data', sumar);
    const reloj = setTimeout(() => {
      cortado = true;
      matar(hijo);
    }, ctx.P.comando);
    let listo = false;
    const fin = (codigo, extra = '') => {
      if (listo) return;
      listo = true;
      clearTimeout(reloj);
      if (ctx.entrada.hijo === hijo) ctx.entrada.hijo = null;
      resolve({ codigo, salida: sinColores(texto + extra).slice(-TOPE_SALIDA), cortado });
    };
    hijo.on('error', (e) => fin(null, `\n${e.message}`));
    hijo.on('close', (codigo) => fin(codigo));
  });
}

/** Corre los que pidio Codex, uno detras de otro y en orden, solo si son exactamente uno de la lista blanca. */
async function correrComandos(lista, reglas, ctx) {
  const out = [];
  for (let i = 0; i < lista.length; i++) {
    if (ctx.senal.aborted) break;
    const pedido = String(lista[i]);
    if (i >= TOPE_COMANDOS) {
      out.push({ comando: normalizarComando(pedido), denegado: true, motivo: `pide hasta ${TOPE_COMANDOS} comandos por mensaje` });
      continue;
    }
    const c = reglas.comandoPermitido(pedido);
    if (!c.ok) {
      out.push({ comando: normalizarComando(pedido) || pedido, denegado: true, motivo: c.motivo });
      ctx.denegar({ tipo: 'comando', comando: pedido, motivo: c.motivo });
      ctx.anotarApp({ comando: pedido, denegado: c.motivo });
      continue;
    }
    ctx.frase(describirHerramienta('Bash', { command: c.comando }));
    const x = await correrUnComando(c, ctx);
    ctx.anotarApp({ comando: c.comando, codigo: x.codigo, salida: x.salida.slice(-2048) });
    out.push({ comando: c.comando, codigo: x.codigo, salida: x.salida, cortado: x.cortado });
  }
  return out;
}

// ---------------------------------------------------------------- los mensajes siguientes (§2.5, §2.7)

/** Una plantilla de app/server/claude/ con valores largos: van despues, para que su texto quede tal cual. */
function conPlantilla(nombre, valores) {
  const marcas = {};
  const reales = new Map();
  for (const [k, v] of Object.entries(valores)) {
    if (!v) marcas[k] = '';
    else {
      const token = `@@${k.toUpperCase()}@@`;
      marcas[k] = token;
      reales.set(token, v);
    }
  }
  let t = textoClaude(nombre, marcas);
  for (const [token, v] of reales) t = t.split(token).join(v);
  return t;
}

function textoGuardados(g) {
  const enteros = g.guardados.filter((x) => x.tipo === 'archivo');
  const lineas = [];
  if (enteros.length) lineas.push(`Guardé: ${enteros.map((x) => `${x.rel} (${kb(x.bytes)})`).join(', ')}.`);
  for (const x of g.guardados.filter((y) => y.tipo === 'ediciones')) lineas.push(`Apliqué tus ${x.n} ${x.n === 1 ? 'edición' : 'ediciones'} a ${x.rel}.`);
  for (const x of g.guardados.filter((y) => y.arreglados)) {
    lineas.push(`En ${x.rel} había ${x.arreglados === 1 ? 'un salto de línea (o una tabulación)' : `${x.arreglados} saltos de línea (o tabulaciones)`} de verdad dentro de un texto: en JSON van escritos \\n (o \\t), así que los guardé así. Si editas esa parte, en \`buscar\` va \\n.`);
  }
  lineas.push(...lineasDeJSON(g));
  return lineas.length ? lineas.join('\n') : 'No guardé ningún archivo.';
}

/** Los .json guardados que igual no se pueden leer (no era solo un salto de línea): que los corrija con `ediciones`. */
const lineasDeJSON = (g) => g.guardados.filter((x) => x.jsonMal).map((x) => `Ojo: ${x.rel} no es un JSON válido (${x.jsonMal}). Corrígelo con \`ediciones\`.`);

function textoRechazados(g) {
  const partes = [];
  const enteros = g.rechazados.filter((x) => x.tipo === 'escribir');
  if (enteros.length) partes.push(`No guardé estos, porque tu tarea no puede escribirlos: ${enteros.map((x) => `\`${x.ruta}\` (${x.motivo})`).join(', ')}.`);
  for (const x of g.rechazados.filter((y) => y.tipo === 'editar')) {
    let t = `No apliqué ninguna edición de \`${x.ruta}\`: ${x.motivo}.`;
    if (x.aplicar) t += ' Copia `buscar` exacto del archivo de ahora, con más líneas de alrededor si hace falta, y mándalas otra vez.';
    if (typeof x.copia === 'string' && Buffer.byteLength(x.copia, 'utf8') < TOPE_COPIA) {
      const c = x.copia.replace(/^﻿/, '');
      t += `\n\n===== ARCHIVO: ${x.ruta} (${kb(Buffer.byteLength(x.copia, 'utf8'))}) =====\n${c}${c.endsWith('\n') ? '' : '\n'}===== FIN: ${x.ruta} =====`;
      g.mostrados[x.ruta] = sha1De(Buffer.from(x.copia, 'utf8'));
    }
    partes.push(t);
  }
  return partes.join('\n\n');
}

function textoComandos(C) {
  return C.map((c) => {
    if (c.denegado) return `No corrí \`${c.comando}\`: ${c.motivo}.`;
    const fin = c.cortado ? 'no terminó en 3 minutos: lo corté' : `terminó con código ${c.codigo ?? '?'}`;
    return `### ${c.comando} (${fin})\n\`\`\`\n${c.salida.replace(/\s+$/, '') || '(no imprimió nada)'}\n\`\`\``;
  }).join('\n\n');
}

function textoLecturas(L) {
  const lineas = [];
  if (L.textos.length || L.imagenes.length || L.carpetas.length) lineas.push('Te mando lo que pediste: está en MATERIAL NUEVO y en IMÁGENES ADJUNTAS.');
  if (L.denegados.length) lineas.push(`No te mando: ${L.denegados.map((d) => `\`${d.ruta}\` (${d.motivo})`).join(', ')}.`);
  const bloques = bloquesDeMensaje(L, { titulo: 'MATERIAL NUEVO', disponibles: false });
  return [lineas.join('\n'), bloques].filter(Boolean).join('\n\n');
}

/** RESULTADO DE TU MENSAJE ANTERIOR: lo guardado, lo rechazado, lo que imprimieron los comandos y lo que pidio leer. */
function mensajeResultado(g, C = null, L = null) {
  return conPlantilla('tarea-resultado-codex', { guardados: textoGuardados(g), rechazados: textoRechazados(g), comandos: C?.length ? textoComandos(C) : '', lecturas: L ? textoLecturas(L) : '' });
}

/** Lo rechazado en una linea por cosa (para la correccion). */
const lineasDeRechazo = (g) => g.rechazados.map((x) => (x.tipo === 'editar' ? `No apliqué ninguna edición de \`${x.ruta}\`: ${x.motivo}.` : `No guardé \`${x.ruta}\`: ${x.motivo}.`));

function mensajeCorreccion(errores) {
  return conPlantilla('tarea-correccion-codex', { errores: errores.map((e) => `- ${e}`).join('\n') });
}

// ---------------------------------------------------------------- «cambios»: las tomas tocadas (§3.3)

/**
 * La foto de antes de los archivos que cambia «cambios»: el manifiesto, las letras o la peticion de la cancion (las
 * tomas tocadas), y app/guion.json solo para saber si cambio algo (soloControl). Solo lo que la tarea puede escribir
 * y tambien leer: el «antes» de cada toma se le devuelve a la IA.
 */
function fotoParaCambios(o, reglas) {
  const rels = new Map(); // rel -> soloControl
  for (const r of Array.isArray(o.cambios?.archivos) ? o.cambios.archivos : []) rels.set(String(r), false);
  const carpeta = /^[ \t>*-]*Carpeta del anuncio:[ \t]*(.+?)[ \t]*$/m.exec(String(o.prompt || ''))?.[1];
  if (carpeta) {
    const c = carpeta.replace(/[`"'«»]/g, '').replace(/\\/g, '/').replace(/\/+$/, '');
    for (const f of ['manifiesto.json', 'app/letras.json', 'cancion/peticion.json']) if (!rels.has(`${c}/${f}`)) rels.set(`${c}/${f}`, false);
    if (!rels.has(`${c}/app/guion.json`)) rels.set(`${c}/app/guion.json`, true);
  }
  const foto = [];
  for (const [rel, soloControl] of rels) {
    const w = reglas.puedeEscribir(rel);
    if (!w.ok || !w.existe || !reglas.puedeLeer(w.rel).ok || foto.some((x) => x.rel === w.rel)) continue;
    try {
      foto.push({ rel: w.rel, abs: w.abs, antes: fs.readFileSync(w.abs, 'utf8'), soloControl });
    } catch {
      /* no se pudo leer: sin control para ese */
    }
  }
  return foto;
}

/** true si alguno de los archivos de la foto ya no es como antes. */
function algoCambio(foto) {
  return foto.some((f) => {
    try {
      return fs.readFileSync(f.abs, 'utf8') !== f.antes;
    } catch {
      return true; // (lo borro o no se puede abrir: algo paso)
    }
  });
}

/** Lo que pidio el usuario en «cambios» (o.cambios.pedido, o lo que dice la tarea «con sus palabras»). */
const pedidoDe = (o) => o.cambios?.pedido ?? (/con sus palabras:\s*«([\s\S]*?)»/.exec(String(o.prompt || ''))?.[1] || '');

function textoDeTomasTocadas(foto, o) {
  const pedido = pedidoDe(o);
  const textos = [];
  for (const f of foto) {
    if (f.soloControl) continue;
    let ahora;
    try {
      ahora = fs.readFileSync(f.abs, 'utf8');
    } catch {
      continue;
    }
    if (ahora === f.antes) continue;
    const t = textoTomasTocadas(tomasTocadas(f.antes, ahora), { pedido, delUsuario: Boolean(o.cambios?.guionDelUsuario) });
    if (t) textos.push({ rel: f.rel, t });
  }
  if (!textos.length) return null;
  return textos.map((x) => (textos.length > 1 ? `${x.t}\n(Eso es de \`${x.rel}\`.)` : x.t)).join('\n\n');
}

// ---------------------------------------------------------------- un mensaje: exec o exec resume (§2.4, §2.13, §2.14)

const argsVisibles = (args) => args.map((a) => (/^developer_instructions=/.test(a) ? `developer_instructions=<modo-app.md + modo-app-codex.md, ${a.length - 23} caracteres>` : a));
const largoDeLinea = (args) => args.reduce((s, a) => s + String(a).length + 3, 0) + 400;

/**
 * Manda un mensaje y espera su respuesta. -> { thread, empezado, completado, usage, texto (el ultimo agent_message),
 * fallo (turn.failed.error), errores (los ultimos eventos error), stderr, codigo, herramientas, y si pasa: cancelado,
 * colgado, tiempoMensaje, tiempoTotal, cortadoPorHerramientas, enoent, errorSpawn, errorArgs }
 */
function enviarMensaje(envio, ctx) {
  const { entrada, P } = ctx;
  const senal = entrada.control.signal;
  return new Promise((resolve) => {
    const r = { thread: null, empezado: false, completado: false, usage: null, texto: null, fallo: null, errores: [], stderr: '', codigo: null, herramientas: 0 };
    const bin = resolverCodex();
    if (!bin) return resolve({ ...r, enoent: true });
    const { trabajo } = carpetasCodex();
    let args;
    try {
      fs.mkdirSync(trabajo, { recursive: true });
      const comun = { esfuerzo: ctx.esfuerzo, developerInstructions: ctx.dev, imagenes: envio.imagenes.map((i) => i.abs) };
      args = envio.modo === 'resume' ? argsResume({ ...comun, thread: ctx.estado.hilo?.thread }) : argsExec({ ...comun, trabajo });
    } catch (e) {
      return resolve({ ...r, errorArgs: e.message });
    }
    ctx.anotarApp({ motor: 'codex', tipo: ctx.tipo, modo: envio.modo === 'resume' ? 'resume' : 'exec', clase: envio.clase, version: VERSION_CODEX, via: bin.via, args: argsVisibles(args) });
    let hijo;
    try {
      // sin shell, sin ventana, en la carpeta de trabajo vacia
      hijo = spawn(bin.cmd, [...bin.pre, ...args], { cwd: trabajo, env: entornoCodex(), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    } catch (e) {
      return resolve({ ...r, enoent: e.code === 'ENOENT', errorSpawn: e.message });
    }
    entrada.hijo = hijo;
    const t0 = Date.now();
    let tTurno = 0;
    let finTurno = 0;
    let listo = false;
    let cortando = false;
    const items = new Set();
    let sinId = 0;

    const terminar = () => {
      if (listo) return;
      listo = true;
      clearInterval(reloj);
      senal.removeEventListener('abort', alCancelar);
      if (entrada.hijo === hijo) entrada.hijo = null;
      resolve(r);
    };
    const cortar = (extra) => {
      Object.assign(r, extra);
      if (cortando) return;
      cortando = true;
      matar(hijo);
      setTimeout(terminar, 5000).unref?.(); // si no llega 'close'
    };
    const alCancelar = () => cortar({ cancelado: true });
    senal.addEventListener('abort', alCancelar, { once: true });

    // el mensaje entra entero por stdin y la entrada se cierra (si no, Codex espera mas)
    hijo.stdin.on('error', () => {});
    try {
      hijo.stdin.end(envio.texto, 'utf8');
    } catch {
      /* se cerro: lo dice 'close' */
    }

    // Con setEncoding cada tubo pasa por un decodificador que guarda los bytes de una letra cortada hasta el proximo
    // trozo (llegan de a 64 KB): si no, una «ó» partida quedaria «��» dentro del archivo que se guarda.
    hijo.stdout.setEncoding('utf8');
    hijo.stderr.setEncoding('utf8');
    let buffer = '';
    hijo.stdout.on('data', (d) => {
      buffer += d;
      let i;
      while ((i = buffer.indexOf('\n')) >= 0) {
        const linea = buffer.slice(0, i).trim();
        buffer = buffer.slice(i + 1);
        if (!linea) continue;
        ctx.anotarLinea(linea);
        let ev;
        try {
          ev = JSON.parse(linea);
        } catch {
          continue;
        }
        alEvento(ev);
      }
    });
    let colaErr = '';
    let enRouter = 0;
    hijo.stderr.on('data', (d) => {
      const t = d;
      r.stderr = (r.stderr + t).slice(-8000);
      // los intentos de `exec` solo aparecen aca: cuentan para el freno igual que un item
      colaErr += t;
      let i;
      while ((i = colaErr.indexOf('\n')) >= 0) {
        const linea = colaErr.slice(0, i);
        colaErr = colaErr.slice(i + 1);
        if (RX_INTENTO_HERRAMIENTA.test(linea)) {
          ctx.anotarApp({ intento: 'herramienta', stderr: sinColores(linea).trim().slice(-200) }); // (no llega en el JSONL)
          contarIntento(`router-${enRouter++}`);
        }
      }
      if (colaErr.length > 8000) colaErr = colaErr.slice(-8000);
    });
    hijo.on('error', (e) => {
      if (e.code === 'ENOENT') r.enoent = true;
      else r.errorSpawn = e.message;
      terminar();
    });
    hijo.on('close', (codigo) => {
      r.codigo = codigo;
      terminar();
    });

    // el freno (§2.14): mas de MAX_HERRAMIENTAS intentos en un mensaje (items o lineas del router) corta el proceso
    function contarIntento(id) {
      items.add(id);
      r.herramientas = items.size;
      if (items.size > MAX_HERRAMIENTAS && !listo) cortar({ cortadoPorHerramientas: true });
    }

    function alEvento(ev) {
      const tipo = ev?.type;
      if (tipo === 'thread.started') {
        r.thread = ev.thread_id || null;
        if (r.thread) ctx.alHilo(r.thread, envio);
      } else if (tipo === 'turn.started') {
        r.empezado = true;
        tTurno = Date.now();
      } else if (tipo === 'item.started' || tipo === 'item.updated' || tipo === 'item.completed') {
        const it = ev.item || {};
        if (it.type === 'agent_message') {
          if (tipo === 'item.completed' && typeof it.text === 'string') r.texto = it.text; // el ULTIMO cuenta
        } else if (it.type !== 'reasoning' && it.type !== 'error') {
          // una herramienta o un subagente (el «Code Mode is unavailable» llega como error y no cuenta)
          contarIntento(it.id != null ? String(it.id) : `sin-id-${sinId++}`);
        }
      } else if (tipo === 'turn.completed') {
        r.completado = true;
        r.usage = ev.usage || null;
        finTurno = Date.now();
        r.usoTurno = ctx.alCompletar(envio, r.usage); // (el usage es el acumulado del hilo: esto es lo del turno)
      } else if (tipo === 'turn.failed') {
        r.fallo = ev.error && typeof ev.error === 'object' ? ev.error : { message: String(ev.error ?? '') };
        finTurno = Date.now();
      } else if (tipo === 'error' && ev.message) {
        // «Reconnecting…» y parecidos: no son fatales; sirven si despues falla
        r.errores = [...r.errores, String(ev.message)].slice(-6);
      }
    }

    const reloj = setInterval(() => {
      if (listo || cortando) return;
      const ahora = Date.now();
      if (ahora > ctx.fin) return cortar({ tiempoTotal: true });
      if (!r.empezado && !finTurno && ahora - t0 > P.arranque) return cortar({ colgado: true });
      if (r.empezado && !finTurno && ahora - tTurno > P.mensaje) return cortar({ tiempoMensaje: true });
      if (r.empezado && !finTurno && !ctx.avisado.v && ahora - tTurno > P.aviso) {
        ctx.avisado.v = true;
        ctx.frase(FRASE_SIGUE);
      }
      if (finTurno && ahora - finTurno > 10000) cortar({}); // termino el turno pero el proceso no sale
    }, 200);
  });
}

// ---------------------------------------------------------------- el registro (§2.20)

/** Donde pide o.registro, con -codex en lugar de -claude (o agregado antes de la extension). */
function rutaDeRegistro(pedido) {
  if (!pedido) return null;
  const dir = path.dirname(String(pedido));
  const base = path.basename(String(pedido));
  if (/-claude/i.test(base)) return path.join(dir, base.replace(/-claude(?!.*-claude)/i, '-codex'));
  const ext = path.extname(base);
  return path.join(dir, `${base.slice(0, base.length - ext.length)}-codex${ext}`);
}

function abrirRegistro(pedido) {
  let ruta = rutaDeRegistro(pedido);
  if (ruta) {
    try {
      fs.mkdirSync(path.dirname(ruta), { recursive: true });
    } catch {
      ruta = null;
    }
  }
  return (linea) => {
    if (!ruta) return;
    try {
      fs.appendFileSync(ruta, `${linea}\n`, 'utf8');
    } catch {
      ruta = null;
    }
  };
}

// ---------------------------------------------------------------- lanzar una sesion (§2.9)

/**
 * Corre una tarea con Codex y la cuenta de ChatGPT del usuario. Las mismas validaciones y el mismo contrato que
 * claude.js:lanzarSesion (un uuid ocupado, la cuenta, la fila de 2 compartida con Claude, Detener).
 */
export async function lanzarSesion(o) {
  if (!o || !UUID.test(String(o.uuid || ''))) throw new Error('lanzarSesion: falta un uuid válido');
  if (!o.prompt) throw new Error('lanzarSesion: falta el prompt');
  if (sesionActiva(o.uuid)) return { ok: false, error: OCUPADA, ocupada: true, sesion: o.uuid };
  const control = new AbortController();
  const entrada = registrarActiva(o.uuid, { control, hijo: null, tipo: o.tipo || null, conTurno: false });
  sesionesCodex.add(o.uuid);
  const alProgreso = (f) => {
    try {
      if (typeof o.alProgreso === 'function') o.alProgreso(f);
    } catch (e) {
      console.error(`[codex] alProgreso: ${e.message}`);
    }
  };
  // la senal de quien la lanza (Detener en la produccion) corta la sesion con lo que lanzo
  const alAbortar = () => {
    control.abort();
    if (entrada.hijo) matar(entrada.hijo);
  };
  o.senal?.addEventListener('abort', alAbortar, { once: true });
  const cancelado = { ok: false, cancelado: true, error: MENSAJES.cancelado, sesion: o.uuid };
  const sinCuenta = (extra) => ({ ok: false, ...extra, sesion: o.uuid, turnos: 0, frases: [] });
  try {
    if (o.senal?.aborted) return cancelado;
    asegurarArranque();
    // solo con la cuenta de ChatGPT del usuario: si `codex login status` no lo confirma, no se lanza nada
    let cuenta = await estadoCodex();
    if (cuenta?.sesion === 'desconocido') {
      olvidarEstadoCodex();
      cuenta = await estadoCodex();
    }
    if (!cuenta?.instalado) return sinCuenta({ sinClaude: true, error: MENSAJES.sinCodex });
    if (cuenta.actualizar) return sinCuenta({ sinClaude: true, actualizar: true, error: OTRA_VERSION });
    if (cuenta.sesion !== 'ok') return sinCuenta({ sinSesion: true, ...(cuenta.otraCuenta ? { otraCuenta: true } : {}), error: cuenta.otraCuenta ? MENSAJES.otraCuenta : MENSAJES.sinSesion });
    if (control.signal.aborted) return cancelado;
    if (tieneQueEsperar({ tope: MAX_SESIONES_CODEX })) alProgreso(FRASE_ESPERA);
    const conTurno = await turno(control.signal, { tope: MAX_SESIONES_CODEX });
    if (!conTurno) return cancelado;
    entrada.conTurno = true;
    conTurnoCodex++;
    anotarLotes(o.tipo);
    try {
      return await trabajar(o, entrada, cuenta);
    } catch (e) {
      console.error(`[codex] ${e?.stack || e}`);
      return { ok: false, error: MENSAJES.error, detalle: String(e?.message || e).slice(-600), sesion: o.uuid, modo: 'nueva', turnos: 0, costo: 0, frases: [] };
    } finally {
      entrada.conTurno = false;
      conTurnoCodex--;
      soltarTurno();
    }
  } finally {
    o.senal?.removeEventListener('abort', alAbortar);
    quitarActiva(o.uuid);
    sesionesCodex.delete(o.uuid);
  }
}

async function trabajar(o, entrada, cuenta) {
  const t0 = Date.now();
  const P = { ...plazos(), mensaje: plazoDeMensaje(o) };
  const senal = entrada.control.signal;
  const alProgreso = typeof o.alProgreso === 'function' ? o.alProgreso : () => {};
  const base = {
    sesion: o.uuid,
    modo: 'nueva',
    turnos: 0,
    costo: 0, // sale del plan de ChatGPT: no se cobra aparte
    uso: { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 },
    duracionMs: 0,
    denegados: [],
    init: { modelo: null, herramientas: [], permisos: 'app', claveApi: 'chatgpt', version: cuenta?.version || VERSION_CODEX, mcp: [], motor: 'codex' },
    frases: [],
  };
  let ultimaFrase = '';
  const frase = (f) => {
    if (!f || f === ultimaFrase) return;
    ultimaFrase = f;
    base.frases.push(f);
    try {
      alProgreso(f);
    } catch (e) {
      console.error(`[codex] alProgreso: ${e.message}`);
    }
  };
  const anotarLinea = abrirRegistro(o.registro);
  const anotarApp = (x) => anotarLinea(JSON.stringify({ type: 'app', momento: new Date().toISOString(), ...x }));

  // el hilo de este uuid (si lo hay) y lo que queda de los anteriores al arrancar de nuevo
  const guardado = hiloValido(hilosGuardados()[o.uuid]) ? hilosGuardados()[o.uuid] : null;
  const estado = { hilo: guardado };
  const memoria = { escritos: [...(guardado?.escritos || [])], anteriores: [...(guardado?.anteriores || [])] };
  const jubilar = () => {
    const h = estado.hilo;
    if (!h) return;
    for (const e of h.escritos || []) sumarSinRepetir(memoria.escritos, e);
    for (const t of [...(h.anteriores || []), h.thread]) if (THREAD.test(String(t))) sumarSinRepetir(memoria.anteriores, t, 50);
    estado.hilo = null;
  };

  const cerrar = (res) => {
    base.duracionMs = Date.now() - t0;
    const final = { ...base, ...res };
    anotarApp({ fin: { ok: Boolean(final.ok), error: final.error || null, limite: Boolean(final.limite), turnos: final.turnos, duracionMs: final.duracionMs, tokens: estado.hilo?.tokens ?? null } });
    return final;
  };
  const CANCELADO = { ok: false, cancelado: true, error: MENSAJES.cancelado };

  const reglas = traducir(o.permitidas || [], o.prohibidas || [], { codexHome: carpetasCodex().home });
  const cacheDir = carpetasCodex().cache;
  let dev;
  try {
    dev = instrucciones();
  } catch (e) {
    return cerrar({ ok: false, error: MENSAJES.error, detalle: `No encontré las reglas del MODO APP (${e.message}).` });
  }
  const esfuerzo = esfuerzoDe(o);
  const TOPE_CTX = topeDeContexto(o.tipo);
  const VUELTAS = Math.min(16, Math.max(6, Math.ceil((Number(o.maxTurnos) || 80) / 10)));
  let correcciones = (Number.isInteger(o.correcciones) ? o.correcciones : 1) + 1; // una mas que Claude
  const fin = t0 + Math.min((Number(o.timeoutMs) || 60 * 60000) * FACTOR_PLAZO, PLAZO_MAXIMO);
  const fotoCambios = o.tipo === 'cambios' ? fotoParaCambios(o, reglas) : null;

  // ---- el mensaje entero (§2.5): el primero, la retoma con otra tarea o el de arrancar de nuevo
  const topeDeImagenes = (imagenes, tope) => {
    let t = Math.max(1, Math.min(tope, TOPE_IMAGENES));
    const largo = (n) => largoDeLinea(argsExec({ esfuerzo, developerInstructions: dev, imagenes: imagenes.slice(0, n).map((i) => i.abs), trabajo: carpetasCodex().trabajo }));
    while (t > 1 && imagenes.length && largo(Math.min(t, imagenes.length)) > TOPE_LINEA) t = Math.max(1, Math.floor(t * 0.75));
    return t;
  };
  const armar = async (clase, { extra = '', material = o.material, topeImagenes = TOPE_IMAGENES } = {}) => {
    const deNuevo = clase === 'deNuevo';
    const mat = await armarMaterial({ prompt: o.prompt, material: material || {} }, reglas, {
      enviados: clase === 'retoma' ? estado.hilo?.enviados || {} : {},
      escritos: deNuevo ? memoria.escritos : [],
      deNuevo,
      cacheDir,
    });
    for (const d of mat.denegados) base.denegados.push(d);
    anotarApp({ clase, material: mat.textos.map((x) => ({ ruta: x.rel, bytes: x.bytes })), imagenes: mat.imagenes.map((x) => x.rel), aPedido: mat.aPedido.length, sinCambios: mat.sinCambios, nombradasSinPermiso: mat.nombradasSinPermiso, denegados: mat.denegados, faltan: mat.faltan, pasaronAPedido: mat.pasaronAPedido });
    if (mat.error) return { error: mat.error, detalle: mat.detalle };
    const tandas = mat.imagenes.length ? repartirImagenes(mat.imagenes, topeDeImagenes(mat.imagenes, topeImagenes)) : [[]];
    const partes = [];
    if (clase === 'retoma') partes.push(AVISO_RETOMA);
    if (deNuevo) partes.push(AVISO_DE_NUEVO);
    const bloques = bloquesDeMensaje(mat, { imagenes: tandas[0] });
    if (bloques) partes.push(bloques);
    partes.push(`## TAREA\n\n${String(o.prompt).trim()}`, `## LO QUE PUEDES ESCRIBIR\n\n${reglas.describirEscribible()}`, `## COMANDOS QUE LA APP CORRE POR TI\n\n${reglas.describirComandos()}`);
    if (extra) partes.push(`${LO_ULTIMO}\n\n${extra}`);
    let quedan = mat.imagenes.length - tandas[0].length;
    if (quedan > 0) partes.push(lineaFaltanImagenes(quedan));
    const enviados = Object.fromEntries(mat.textos.map((x) => [x.rel, x.sha1]));
    const lista = [{ texto: partes.join('\n\n'), imagenes: tandas[0], modo: clase === 'retoma' ? 'resume' : 'exec', clase, enviados }];
    for (const tanda of tandas.slice(1)) {
      quedan -= tanda.length;
      const lineas = bloquesDeMensaje({ textos: [], carpetas: [], sinCambios: [], aPedido: [] }, { imagenes: tanda });
      // deInicio: las tandas del primer mensaje de una conversacion cuentan en su tamaño de arranque (h.base)
      lista.push({ texto: `${lineas}\n\n${quedan > 0 ? lineaFaltanImagenes(quedan) : LINEA_YA_TODAS}`, imagenes: tanda, modo: 'resume', clase: 'imagenes', noCuenta: true, enviados: {}, deInicio: clase !== 'retoma' });
    }
    return { envios: lista };
  };
  const siguiente = (texto, extra = {}) => ({ texto, imagenes: [], modo: 'resume', clase: 'siguiente', enviados: {}, paraDeNuevo: null, ...extra });

  // ---- lo que pasa en cada mensaje: el hilo nuevo y lo que Codex confirmo recibir
  const alHilo = (thread, envio) => {
    if (envio.modo !== 'exec') return; // resume: el mismo hilo
    if (estado.hilo && estado.hilo.thread !== thread) jubilar();
    const ahora = new Date().toISOString();
    estado.hilo = { thread, tipo: o.tipo || null, creado: ahora, usado: ahora, tokens: 0, base: null, mensajes: 0, enviados: {}, escritos: [...memoria.escritos], ...(memoria.anteriores.length ? { anteriores: [...memoria.anteriores] } : {}) };
    guardarHilos(o.uuid, estado.hilo); // en cuanto llega thread.started: si la app se cierra, no se pierde
  };
  // El usage de turn.completed es el ACUMULADO del hilo (todos sus turnos, tambien los de otros procesos), no el del
  // turno (P0, punto 9: con tres respuestas iguales, la salida da 35, 70 y 105). Lo de este mensaje es la diferencia
  // con lo ultimo que se vio de ese hilo, y el tamaño de la conversacion es la entrada de este turno mas su respuesta.
  const alCompletar = (envio, usage) => {
    const h = estado.hilo;
    const u = usage || {};
    const K = ['input_tokens', 'cached_input_tokens', 'output_tokens'];
    const ahora = Object.fromEntries(K.map((k) => [k, Number(u[k]) || 0]));
    const antes = h?.acumulado || {};
    // (si lo de ahora es menos que lo de antes, el contador volvio a empezar: lo de ahora es del turno)
    const sigue = K.every((k) => ahora[k] >= (Number(antes[k]) || 0));
    const turno = Object.fromEntries(K.map((k) => [k, sigue ? ahora[k] - (Number(antes[k]) || 0) : ahora[k]]));
    if (!h) return turno;
    h.acumulado = ahora; // para el proximo mensaje de este hilo (tambien en otra sesion: queda en anuncios-hilos.json)
    h.tokens = turno.input_tokens + turno.output_tokens; // la entrada de este turno ya trae toda la conversacion
    if (h.base == null || envio.deInicio) h.base = h.tokens; // el tamaño despues de TODAS las tandas del primer mensaje
    h.mensajes = (Number(h.mensajes) || 0) + 1;
    h.usado = new Date().toISOString();
    Object.assign((h.enviados ||= {}), envio.enviados || {}); // recien ahora se sabe que Codex lo recibio
    guardarHilos(o.uuid, h);
    return turno;
  };
  const avisado = { v: false };
  const ctx = { entrada, P, esfuerzo, dev, estado, fin, avisado, tipo: o.tipo || null, frase, anotarApp, anotarLinea, alHilo, alCompletar };

  // ---- el primer mensaje
  let envios;
  if (estado.hilo) {
    base.modo = 'resume';
    let m = await armar('retoma');
    if (m.error) return cerrar({ ok: false, error: m.error, detalle: m.detalle });
    const e0 = m.envios[0];
    if ((Number(estado.hilo.tokens) || 0) + estimarCtx(e0.texto, e0.imagenes.length) > TOPE_CTX) {
      anotarApp({ deNuevo: 'tope-de-contexto', tokens: estado.hilo.tokens, tope: TOPE_CTX });
      jubilar();
      // la tarea de ahora todavia no se mando: va como primera vez, sin «Esta tarea ya empezó…» ni lo que escribio
      // otra tarea (si es la misma retomada, el llamador ya lo dice en su texto)
      m = await armar('inicial');
      if (m.error) return cerrar({ ok: false, error: m.error, detalle: m.detalle });
    }
    envios = m.envios;
  } else {
    const m = await armar('inicial');
    if (m.error) return cerrar({ ok: false, error: m.error, detalle: m.detalle });
    envios = m.envios;
  }

  // si la tarea de ESTA sesion ya llego a una conversacion (una respuesta completa), arrancar de nuevo es seguirla
  // («Esta tarea ya empezó…» y lo que escribio); si no, va como primera vez
  let empezada = false;
  const arrancarDeNuevo = async (motivo, extra = '') => {
    anotarApp({ deNuevo: motivo, empezada });
    jubilar();
    const m = await armar(empezada ? 'deNuevo' : 'inicial', { extra });
    if (m.error) return { error: m.error, detalle: m.detalle };
    envios = m.envios;
    return null;
  };
  // Arrancar de nuevo achica la conversacion solo si crecio desde su primer mensaje entero (h.base, con todas sus
  // tandas) y si una nueva si entraria: si el material solo ya pasa el tope, se sigue en esta (si de verdad se llena,
  // decide el error de contexto, §2.15 fila 6) y no se reenvia todo para nada.
  const pasaDelTope = (envio) => {
    const h = estado.hilo;
    if (!h || envio.modo !== 'resume' || envio.clase === 'imagenes' || envio.clase === 'retoma') return false;
    if (!(Number(h.mensajes) >= 1) || !(Number(h.tokens) > Number(h.base ?? h.tokens))) return false;
    const suma = estimarCtx(envio.texto, envio.imagenes.length);
    if (Number(h.base) + suma > TOPE_CTX) return false;
    return Number(h.tokens) + suma > TOPE_CTX;
  };

  let vueltas = 0;
  let entregas = 0;
  let cortadas = 0;
  let herramientas = 0;
  let pasajeros = 0;
  let candados = 0;
  let reinicios = 0;
  let tomasRevisadas = false;
  let avisoSinCambios = false;
  const guardadosEnLaSesion = new Set(); // lo que la app guardo por Codex en esta sesion (claveDeRuta)
  let dichoInicio = false;
  const unaVez = new Set();

  for (;;) {
    if (senal.aborted) return cerrar(CANCELADO);
    if (Date.now() > fin) return cerrar({ ok: false, tiempo: true, error: MENSAJES.tiempo });
    let envio = envios[0];
    // el tamaño de la conversacion, mirado despues de cada respuesta (antes del proximo mensaje)
    if (reinicios < 2 && pasaDelTope(envio)) {
      reinicios++;
      const e = await arrancarDeNuevo('tope-de-contexto', envio.paraDeNuevo || '');
      if (e) return cerrar({ ok: false, error: e.error, detalle: e.detalle });
      envio = envios[0];
    }
    if (!envio.noCuenta) {
      if (vueltas >= VUELTAS) return cerrar({ ok: false, error: MENSAJES.vueltas });
      vueltas++;
    }
    // los limites, sin cache, antes de CADA mensaje: sin uso ordinario no se manda nada (no se gastan creditos)
    const lim = await limitesFrescos().catch(() => null);
    if (lim) anotarApp({ limites: { usado: lim.usado, ordinario: lim.ordinario } });
    let lim2 = lim;
    // (2026-11-20s) antes de decir «no te queda uso», un token nuevo: el plan pagado o el espacio de trabajo elegido
    // recién se ven con él
    if (lim2 && sinUsoOrdinario(lim2)) lim2 = (await refrescarCuenta({ fuerza: !ctx.refrescado }).catch(() => null))?.lim || lim2;
    ctx.refrescado = true;
    if (lim2 && sinUsoOrdinario(lim2)) return cerrar(conLimite(lim2.reinicio, lim2.rateLimitReachedType ? `limite: ${lim2.rateLimitReachedType}` : undefined, lim2.rateLimitReachedType));
    if (senal.aborted) return cerrar(CANCELADO);
    if (!dichoInicio) {
      dichoInicio = true;
      frase(o.fraseInicio || FRASE_INICIO);
    }

    const r = await enviarMensaje(envio, ctx);
    if (r.completado) empezada = true;
    base.turnos++;
    if (r.usoTurno) for (const k of Object.keys(base.uso)) base.uso[k] += Number(r.usoTurno[k]) || 0;
    if (r.cancelado || senal.aborted) return cerrar(CANCELADO);
    if (r.enoent) {
      olvidarCodex();
      olvidarEstadoCodex();
      return cerrar({ ok: false, sinClaude: true, error: MENSAJES.sinCodex });
    }
    if (r.errorArgs || r.errorSpawn) return cerrar({ ok: false, error: MENSAJES.error, detalle: String(r.errorArgs || r.errorSpawn).slice(-600) });
    if (r.tiempoTotal) return cerrar({ ok: false, tiempo: true, error: MENSAJES.tiempo });
    if ((r.colgado || r.tiempoMensaje) && !unaVez.has('cuelgue')) {
      // un cuelgue mudo (sin un solo evento hasta el plazo) suele ser del servidor y no se repite (P5, objeto-clips):
      // se manda el mismo mensaje una vez mas, sin que el usuario toque «Reintentar» y sin contar otra vuelta
      unaVez.add('cuelgue');
      anotarApp({ reintento: r.colgado ? 'colgado' : 'tiempo-de-mensaje' });
      frase(FRASE_OTRA_VEZ);
      if (!envio.noCuenta) vueltas--;
      continue;
    }
    if (r.colgado) return cerrar({ ok: false, colgado: true, error: MENSAJES.colgado });
    if (r.tiempoMensaje) return cerrar({ ok: false, tiempo: true, error: MENSAJES.tiempo });
    if (r.cortadoPorHerramientas) {
      // el freno (§2.14): se corta y se le recuerda que no tiene herramientas; a la segunda, error
      herramientas++;
      anotarApp({ herramientas: r.herramientas, vez: herramientas });
      if (herramientas >= 2 || !estado.hilo) return cerrar({ ok: false, error: MENSAJES.herramientas, detalle: `Intentó usar ${r.herramientas} herramientas o subagentes en un mismo mensaje (vez ${herramientas}).` });
      envios[0] = siguiente(SIN_HERRAMIENTAS);
      continue;
    }

    const leida = r.completado && typeof r.texto === 'string' ? leerRespuesta(r.texto) : null;
    if (!leida?.ok) {
      let clase = leida ? (leida.cortada ? 'cortada' : 'json') : clasificar(r);
      if (!leida && !clase && typeof r.texto === 'string' && !r.texto.trim().endsWith('}')) clase = 'cortada';
      const detalle = detalleDe(r);
      const otraVez = () => {
        if (!envio.noCuenta) vueltas--; // repetir el mismo envio no es otra vuelta
      };
      if (clase === 'planSinCodex' && !unaVez.has('plan')) {
        // (2026-11-20s) puede ser el token viejo (pagó un plan o eligió otro espacio de trabajo): uno nuevo y otra vez
        unaVez.add('plan');
        anotarApp({ plan: 'token nuevo y otra vez' });
        await refrescarCuenta({ fuerza: true }).catch(() => null);
        otraVez();
        continue;
      }
      if (clase === 'planSinCodex') return cerrar({ ok: false, planSinCodex: true, error: TAREAS_CON_REINTENTAR.has(String(o.tipo || '')) ? MENSAJES.planSinCodex : MENSAJES.planSinCodexPaso, detalle });
      if (clase === 'limite') {
        const l = await limitesFrescos().catch(() => null);
        return cerrar(conLimite(l?.reinicio || horaDelTexto(`${textoDelFallo(r)}\n${r.errores.join('\n')}`), detalle));
      }
      if (clase === 'sesionVencida' || clase === 'sinSesion') {
        olvidarEstadoCodex();
        if (clase === 'sesionVencida' && !unaVez.has('vencida')) {
          // otro proceso pudo renovar la sesion y dejar un auth.json nuevo: una vez, con un proceso nuevo
          unaVez.add('vencida');
          const c = await estadoCodex().catch(() => null);
          if (c?.sesion === 'ok') {
            anotarApp({ reintento: 'sesion-renovada' });
            otraVez();
            continue;
          }
          return cerrar({ ok: false, sinSesion: true, error: c?.otraCuenta ? MENSAJES.otraCuenta : MENSAJES.sinSesion, detalle });
        }
        return cerrar({ ok: false, sinSesion: true, error: MENSAJES.sinSesion, detalle });
      }
      if (clase === 'contexto') {
        if (unaVez.has('contexto')) return cerrar({ ok: false, error: ERROR_NO_ENTRA, detalle });
        unaVez.add('contexto');
        const e = await arrancarDeNuevo('contexto', envio.paraDeNuevo || '');
        if (e) return cerrar({ ok: false, error: e.error, detalle: e.detalle });
        continue;
      }
      if (clase === 'cortada') {
        if (cortadas >= 2 || !estado.hilo) return cerrar({ ok: false, error: MENSAJES.error, detalle: detalle || 'La respuesta llegó cortada.' });
        cortadas++;
        anotarApp({ cortada: cortadas });
        envios[0] = siguiente(textoClaude('tarea-cortada-codex'));
        continue;
      }
      if (clase === 'json') {
        if (correcciones <= 0 || !estado.hilo) return cerrar({ ok: false, error: MENSAJES.error, detalle: `La respuesta no fue el JSON pedido: ${String(r.texto).slice(0, 600)}` });
        correcciones--;
        anotarApp({ correccion: ['la respuesta no fue el JSON pedido'] });
        envios[0] = siguiente(PIDE_JSON);
        continue;
      }
      if (clase === 'candado' && candados < 3 && estado.hilo) {
        candados++;
        anotarApp({ candado: candados });
        await dormir(P.candado, senal);
        otraVez();
        continue;
      }
      if (clase === 'hiloPerdido' || clase === 'candado') {
        if (unaVez.has('hilo')) return cerrar({ ok: false, error: MENSAJES.error, detalle });
        unaVez.add('hilo');
        const e = await arrancarDeNuevo(clase === 'candado' ? 'candado' : 'hilo-perdido', envio.paraDeNuevo || '');
        if (e) return cerrar({ ok: false, error: e.error, detalle: e.detalle });
        continue;
      }
      if (clase === 'largo') {
        // una vez: las skills pasan a pedido y las imagenes van en tandas mas chicas
        if (unaVez.has('largo') || envio.clase === 'siguiente' || envio.clase === 'imagenes') return cerrar({ ok: false, error: MENSAJES.error, detalle });
        unaVez.add('largo');
        const m0 = o.material || {};
        const textos = Array.isArray(m0.textos) ? m0.textos : [];
        const esSkill = (x) => /^\.?\/?\.claude[\\/]skills[\\/]/i.test(String(x));
        const material = { ...m0, skillsAPedido: true, textos: textos.filter((x) => !esSkill(x)), aPedido: [...(Array.isArray(m0.aPedido) ? m0.aPedido : []), ...textos.filter(esSkill)] };
        anotarApp({ largo: 'skills a pedido e imágenes en tandas más chicas' });
        const m = await armar(envio.clase === 'retoma' || envio.clase === 'deNuevo' ? envio.clase : 'inicial', { material, topeImagenes: Math.max(1, Math.floor(TOPE_IMAGENES / 2)) });
        if (m.error) return cerrar({ ok: false, error: m.error, detalle: m.detalle });
        envios = m.envios;
        otraVez();
        continue;
      }
      if (clase === 'transitorio' && pasajeros < 2) {
        pasajeros++;
        anotarApp({ pasajero: pasajeros });
        await dormir(pasajeros === 1 ? P.pasajero : 4 * P.pasajero, senal);
        otraVez();
        continue;
      }
      if (r.fallo || clase) return cerrar({ ok: false, error: MENSAJES.error, detalle });
      return cerrar({ ok: false, error: SE_CERRO, detalle, codigo: r.codigo });
    }

    const resp = leida.resp;
    envios.shift();
    if (envios.length) continue; // las imagenes que faltaban (la respuesta a eso es solo SEGUIR)

    // ---- guardar, leer y correr (§2.10, §2.6, §2.11)
    const g = guardar(resp, reglas, { frase, hilo: estado.hilo });
    for (const x of g.guardados) guardadosEnLaSesion.add(claveDeRuta(x.rel));
    if (estado.hilo && g.guardados.length) guardarHilos(o.uuid, estado.hilo); // lo que escribio (para arrancar de nuevo)
    for (const x of g.rechazados) base.denegados.push({ tipo: x.tipo, ruta: x.ruta, motivo: x.motivo });
    anotarApp({
      guardo: g.guardados.filter((x) => x.tipo === 'archivo').map((x) => ({ ruta: x.rel, bytes: x.bytes })),
      edito: g.guardados.filter((x) => x.tipo === 'ediciones').map((x) => ({ ruta: x.rel, ediciones: x.n })),
      denegados: g.rechazados.map(({ copia, aplicar, ...x }) => x),
      estado: resp.estado,
      ...(g.guardados.some((x) => x.arreglados || x.jsonMal) ? { json: g.guardados.filter((x) => x.arreglados || x.jsonMal).map((x) => ({ ruta: x.rel, arreglados: x.arreglados, mal: x.jsonMal })) } : {}),
    });
    let L = null;
    if (resp.leer.length) {
      if (senal.aborted) return cerrar(CANCELADO);
      L = await resolverLecturas(resp.leer, reglas, { cacheDir });
      if (L.imagenes.length > TOPE_IMAGENES) {
        for (const im of L.imagenes.slice(TOPE_IMAGENES)) L.denegados.push({ tipo: 'leer', ruta: im.rel, motivo: 'no entran tantas imágenes en un mensaje: pídela en el próximo' });
        L.imagenes = L.imagenes.slice(0, TOPE_IMAGENES);
      }
      for (const x of [...L.textos, ...L.carpetas, ...L.imagenes]) frase(describirHerramienta('Read', { file_path: x.rel }));
      for (const d of L.denegados) base.denegados.push(d);
      anotarApp({ leer: resp.leer, mando: L.textos.map((x) => x.rel), imagenes: L.imagenes.map((x) => x.rel), denegados: L.denegados });
    }
    let C = null;
    if (resp.comandos.length) {
      if (senal.aborted) return cerrar(CANCELADO);
      C = await correrComandos(resp.comandos, reglas, { entrada, senal, P, frase, anotarApp, denegar: (d) => base.denegados.push(d) });
      if (senal.aborted) return cerrar(CANCELADO);
    }
    if (L || C) {
      const texto = mensajeResultado(g, C, L);
      const enviados = { ...g.mostrados, ...(L ? Object.fromEntries(L.textos.map((x) => [x.rel, x.sha1])) : {}) };
      // si hay que arrancar de nuevo, las imagenes pedidas no viajan: Codex las vuelve a pedir si las necesita
      const paraDeNuevo = L?.imagenes?.length ? mensajeResultado(g, C, null) : texto;
      envios = [siguiente(texto, { imagenes: L?.imagenes || [], enviados, paraDeNuevo })];
      continue;
    }
    if (resp.estado === 'SEGUIR' && g.guardados.length) {
      // entrega por partes: se guarda y se le pide que siga, sin verificar ni gastar una correccion
      entregas++;
      if (entregas >= ENTREGAS) return cerrar({ ok: false, error: MENSAJES.vueltas });
      const texto = `${mensajeResultado(g)}\n\n${SIGUE_PROXIMO}`;
      envios = [siguiente(texto, { noCuenta: true, enviados: g.mostrados, paraDeNuevo: texto })];
      continue;
    }
    if (resp.estado === 'SEGUIR' && g.rechazados.length) {
      const texto = mensajeResultado(g);
      envios = [siguiente(texto, { enviados: g.mostrados, paraDeNuevo: texto })];
      continue;
    }

    // ---- LISTO, BLOQUEADO o SEGUIR sin nada que hacer
    // «cambios» sin ningun archivo cambiado: una vez y sin gastar una correccion, que haga lo que se pidio (verificar
    // no lo nota: el guion de antes sigue valido)
    // (si guardo algo fuera de la foto, p. ej. transiciones.json, si cambio algo)
    const fueraDeLaFoto = () => [...guardadosEnLaSesion].some((k) => !fotoCambios.some((f) => claveDeRuta(f.rel) === k));
    if (fotoCambios?.length && !avisoSinCambios && resp.estado !== 'BLOQUEADO' && !algoCambio(fotoCambios) && !fueraDeLaFoto()) {
      avisoSinCambios = true;
      const texto = mensajeCorreccion([`No cambiaste ningún archivo y el usuario pidió: «${pedidoDe(o)}». Haz ese cambio; si no se puede sin romper una regla de la skill, haz lo más cercano y explícalo en \`cambios_hechos\` de app/guion.json.`]);
      anotarApp({ sinCambios: true });
      envios = [siguiente(texto, { paraDeNuevo: texto })];
      continue;
    }
    if (fotoCambios?.length && !tomasRevisadas) {
      tomasRevisadas = true; // una sola vez y sin gastar una correccion
      const texto = textoDeTomasTocadas(fotoCambios, o);
      if (texto) {
        anotarApp({ tomasTocadas: true });
        envios = [siguiente(texto, { paraDeNuevo: texto })];
        continue;
      }
    }
    if (senal.aborted) return cerrar(CANCELADO);
    let v;
    try {
      v = typeof o.verificar === 'function' ? await o.verificar() : { ok: true }; // lee del disco: ya esta todo guardado
    } catch (e) {
      v = { ok: false, errores: [e.message] };
    }
    if (senal.aborted) return cerrar(CANCELADO);
    const resultado = resp.estado === 'BLOQUEADO' ? 'BLOQUEADO' : 'LISTO';
    if (v?.ok) return cerrar({ ok: true, resultado, verificacion: v });
    const errores = [...(v?.errores || []).filter(Boolean).slice(0, 12), ...lineasDeRechazo(g), ...lineasDeJSON(g)];
    if (!v?.final && correcciones > 0 && errores.length && estado.hilo) {
      correcciones--;
      frase(FRASE_CORRIGE);
      anotarApp({ correccion: errores });
      const texto = mensajeCorreccion(errores);
      envios = [siguiente(texto, { paraDeNuevo: texto })];
      continue;
    }
    return cerrar({ ok: false, error: v?.error || MENSAJES.incompleto, bloqueado: Boolean(v?.bloqueado), faltan: v?.faltan, verificacion: v, detalle: errores.join('\n') || undefined });
  }
}

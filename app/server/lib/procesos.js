// La fila de procesos del motor: aca se lanza `node produccion/<script>.js ...` para un anuncio.
//
//   correr({ slug, paso, script, args, env, pesado, senal })      un comando, una vez
//   correrConReintentos(opciones, { alEsperar, alReintentar })    con los reintentos de red y de kie
//   cancelar(slug) · enMarcha(slug) · matarHuerfano(slug)
//   clasificarFallo(texto) · hayConexion() · esperarConexion(senal) · entornoDelMotor(extra)
//
// Reglas (plan, "Reglas comunes"):
//   - Directo con el node de la app (process.execPath), nunca con npm.cmd: en Windows, con Node 20.12 o mas
//     nuevo, un .cmd no arranca sin shell (ensamblar.js:675-677). stdin cerrado: sin terminal nadie contesta, y
//     un comando que preguntara algo falla diciendolo en vez de quedarse esperando (como producir.js:197).
//   - Todo lo que dice el comando queda en temp/<slug>/app/registro/<paso>.log (se agrega, no se pisa).
//   - Mientras corre, temp/<slug>/app/proceso.json dice que pid es: si la app se cierra de golpe, el motor puede
//     seguir vivo (en Windows los hijos no mueren con el padre). Al volver a abrir la app, matarHuerfano() lo
//     corta ANTES de relanzar el paso, para que nunca haya dos procesos pidiendo lo mismo a kie.
//   - Lo pesado (render y control final) va de a uno en toda la app: la laptop de 16 GB se traba con dos.
//   - Reintentos solos: un error de red o del servidor de kie se reintenta a los 30 s, 2 min y 5 min; despues
//     el paso queda en "error" y el usuario toca "Continuar". Sin conexion no se cuenta: se espera a que vuelva
//     y se sigue solo. Reintentar es correr el mismo comando: lo ya hecho no se paga otra vez y las tareas que
//     seguian en kie se retoman (*.kie-pendiente.json).
//
// MODO PRUEBA (ANUNCIOS_MODO_PRUEBA=1 al arrancar la app): todo proceso del motor recibe el entorno de
// app/server/lib/modo-prueba.js (kie, ElevenLabs y Suno simulados en 127.0.0.1, claves falsas y la guardia de
// red). Si ese entorno no esta o no apunta a 127.0.0.1, NO se corre nada: mejor un error que un gasto.
import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { RAIZ, TEMP, ENV } from './rutas.js';
import { copiarModelosAlAnuncio } from './modelos.js';

const WIN = process.platform === 'win32';
const DIR_MOTOR = path.join(RAIZ, 'produccion');

// ---------------------------------------------------------------- esperas de los reintentos

/** 30 s, 2 min y 5 min. ANUNCIOS_ESPERAS_REINTENTO_MS="1000,1000,1000" solo para las pruebas en seco. */
export const ESPERAS_REINTENTO_MS = (() => {
  const crudo = String(process.env.ANUNCIOS_ESPERAS_REINTENTO_MS || '').trim();
  const lista = crudo
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return lista.length ? lista : [30000, 120000, 300000];
})();
const CADA_CUANTO_MIRAR_LA_CONEXION_MS = Number(process.env.ANUNCIOS_MIRAR_CONEXION_MS) || 15000;

export const modoPrueba = () => process.env.ANUNCIOS_MODO_PRUEBA === '1';

// ---------------------------------------------------------------- entorno de los procesos del motor

// Lo que solo existe para las pruebas: en modo real no puede llegar al motor aunque la app lo tenga en su entorno.
const SOLO_PRUEBAS = /^(KIE_BASE_URL|KIE_BASE_ARCHIVOS_URL|ELEVENLABS_BASE_URL|SUNO_BASE_URL|KIE_AVISO_ESPERA_\w+|KIE_TOPE_ESPERA_\w+)$/i;
const LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/i;

let proveedorDePrueba = null; // () => env (o promesa): lo pone configurarEntornoDePrueba() o sale de modo-prueba.js

/** Para las pruebas del conductor (y para el integrador): quien da el entorno de modo prueba. */
export function configurarEntornoDePrueba(fn) {
  proveedorDePrueba = typeof fn === 'function' ? fn : null;
}

/**
 * El entorno de modo prueba: entornoMotor() de app/server/lib/modo-prueba.js (arranca los simuladores la primera
 * vez y comprueba la guardia). Devuelve null si ese archivo no esta o no lo da.
 */
async function entornoDeModoPrueba(extra = {}) {
  if (proveedorDePrueba) return proveedorDePrueba(extra);
  let mod;
  try {
    mod = await import(new URL('./modo-prueba.js', import.meta.url).href);
  } catch {
    return null;
  }
  // entornoMotor(extra) de modo-prueba.js: con extra.ELEVENLABS_VOICE_ID registra esa voz en el ElevenLabs
  // simulado (asi generar-audio la encuentra) y no deja que extra pise las direcciones ni las claves.
  return typeof mod.entornoMotor === 'function' ? mod.entornoMotor(extra) : null;
}

/** Lo que tiene que cumplir el entorno de modo prueba para correr algo del motor. Devuelve los motivos si no. */
export function motivosContraElEntornoDePrueba(env) {
  const motivos = [];
  if (!env || typeof env !== 'object') return ['no hay entorno de modo prueba (app/server/lib/modo-prueba.js)'];
  for (const k of ['KIE_BASE_URL', 'KIE_BASE_ARCHIVOS_URL']) if (!LOCAL.test(String(env[k] || ''))) motivos.push(`${k} no apunta a 127.0.0.1`);
  if (env.ELEVENLABS_BASE_URL && !LOCAL.test(String(env.ELEVENLABS_BASE_URL))) motivos.push('ELEVENLABS_BASE_URL no apunta a 127.0.0.1');
  if (String(env.NODE_USE_ENV_PROXY) !== '1') motivos.push('falta la guardia de red (NODE_USE_ENV_PROXY=1)');
  for (const k of ['HTTPS_PROXY', 'HTTP_PROXY']) {
    const v = env[k] ?? env[k.toLowerCase()];
    if (!LOCAL.test(String(v || ''))) motivos.push(`${k} no es la guardia local`);
  }
  if (!String(env.KIE_API_KEY || '').trim()) motivos.push('falta la clave falsa de kie');
  return motivos;
}

/**
 * El entorno de un proceso del motor: el de la app, sin lo que solo sirve para pruebas (en modo real) o con el
 * de modo prueba encima (y comprobado), mas `extra` (p. ej. ELEVENLABS_VOICE_ID de la voz elegida).
 */
export async function entornoDelMotor(extra = {}) {
  let env = { ...process.env };
  if (modoPrueba()) {
    const dePrueba = await entornoDeModoPrueba(extra);
    const motivos = motivosContraElEntornoDePrueba(dePrueba);
    if (motivos.length) {
      const e = new Error(`Modo prueba sin simuladores listos: ${motivos.join('; ')}. No corro nada para no gastar.`);
      e.sinModoPrueba = true;
      throw e;
    }
    // El de modo prueba es la base (ya trae el de la app sin las claves ni los proxys heredados, en todas sus
    // grafias): encima del de la app sobrevivirian un http_proxy o un no_proxy en minuscula del sistema, y en
    // Windows dos grafias de la misma variable no se sabe cual gana.
    // (un proveedor de pruebas que da solo unas pocas variables va encima del de la app, como antes)
    env = dePrueba.PATH || dePrueba.Path ? { ...dePrueba } : { ...env, ...dePrueba };
  } else {
    for (const k of Object.keys(env)) if (SOLO_PRUEBAS.test(k)) delete env[k];
    // las imágenes de los videos con la suscripción de ChatGPT, si se eligió en Ajustes (lib/motor-imagenes.js)
    try {
      Object.assign(env, (await import('./motor-imagenes.js')).entornoImagenesVideo());
    } catch {
      /* sin eso, kie como siempre */
    }
  }
  for (const [k, v] of Object.entries(extra || {})) {
    // En modo prueba nada de afuera pisa las direcciones, las claves falsas ni la guardia.
    if (modoPrueba() && (SOLO_PRUEBAS.test(k) || PROTEGIDAS_EN_PRUEBA.test(k))) continue;
    if (v === null || v === undefined) delete env[k];
    else env[k] = String(v);
  }
  return env;
}
const PROTEGIDAS_EN_PRUEBA = /^(KIE_API_KEY|ELEVENLABS_API_KEY|NODE_USE_ENV_PROXY|HTTPS?_PROXY|NO_PROXY)$/i;

/** Lee una clave del .env del proyecto (sin cargarlo en el proceso de la app). null si no esta. */
export function claveDelEnv(nombre) {
  let texto = '';
  try {
    texto = fs.readFileSync(ENV, 'utf8');
  } catch {
    return null;
  }
  for (const linea of texto.split(/\r?\n/)) {
    const m = linea.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || m[1] !== nombre) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    return v || null;
  }
  return null;
}

// ---------------------------------------------------------------- por que fallo

// En el orden en que se miran: lo primero que casa gana.
const CLASES = [
  // la clave esta mal: reintentar no sirve, hay que ir a Ajustes
  ['clave', /rechazo la clave|You do not have access permissions|invalid[_ ]api[_ ]key|Falta (KIE_API_KEY|ELEVENLABS_API_KEY)|\(401\)/i],
  // (2026-11-27c) ElevenLabs pide un pago (HTTP 402): p. ej. una voz de la biblioteca con un plan gratis, o un pago
  // pendiente. Antes se leía como «saldo de kie» (el 402 casaba con la regla de abajo): no tiene nada que ver con kie.
  ['voz-pago', /ElevenLabs[^\r\n]*\b402\b|paid_plan_required|payment_required|library voices|upgrade your subscription to use/i],
  // la cuota de caracteres de ElevenLabs se termino (antes que el saldo de kie: nunca se confunden)
  ['cuota-voz', /quota_exceeded|exceeds? your (character )?quota|character limit|cuota de caracteres/i],
  // sin saldo en kie (el aviso de --solo-plan, el de generar-musica y el de kie al crear la tarea)
  ['saldo', /no te alcanza|saldo insuficiente|insufficient (credits?|balance)|not enough (credits?|balance)|credits? (is |are )?(insufficient|not enough)|\bcode=402\b|\bHTTP 402\b/i],
  // se fue internet (o el host no se encuentra)
  ['red', /fetch failed|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH|getaddrinfo|socket hang up|network ?error|UND_ERR|other side closed|Connect Timeout/i],
  // el servidor de kie (o de ElevenLabs) fallo, o hay tareas que siguen en kie: se espera y se vuelve a correr
  [
    'servidor',
    /error del servidor|Internal (Server )?Error|try again later|\bHTTP 5\d\d\b|\bcode=5\d\d\b|devolvio HTTP 5\d\d|Bad Gateway|Service Unavailable|Gateway Time-?out|overload|Quedan en kie|siguen? (generando|en kie)|sin bajar|demasiadas solicitudes|devolvio 429|\(429\)|\bHTTP 429\b|\bcode=429\b|Too Many Requests/i,
  ],
  // rechazo por contenido: en voz en off el motor ya paso al respaldo; si llega aca, reintentar no sirve
  ['contenido', /rechaz\w* por contenido|content policy|violat\w* (our )?(content|polic)/i],
];

// En Windows, el navegador del render que "no existe" (spawn ... chrome-headless-shell.exe ENOENT) aunque esta en su
// lugar: la carpeta de la app quedo tan adentro de otras que la ruta del navegador pasa de 260 letras. Reintentar no
// sirve: hay que mover la carpeta.
export const RUTA_LARGA = /chrome-headless-shell[^\r\n]*ENOENT|ENOENT[^\r\n]*chrome-headless-shell/i;

/** 'ruta-larga' | 'clave' | 'voz-pago' | 'cuota-voz' | 'saldo' | 'red' | 'servidor' | 'contenido' | 'otro' */
export function clasificarFallo(texto) {
  const t = String(texto || '');
  if (process.platform === 'win32' && RUTA_LARGA.test(t)) return 'ruta-larga';
  for (const [clase, re] of CLASES) if (re.test(t)) return clase;
  return 'otro';
}

/**
 * Por qué falló un comando del motor, en palabras, con lo que dijo kie (o ElevenLabs) tal cual y lo que se puede
 * hacer. Lo guarda el conductor en paso.error.causa y la producción lo muestra.
 *   -> { porque, dijo, hacer: [frases] } o null si la salida no dice nada útil
 */
export function causaDeFallo(texto) {
  // sin las frases fijas del motor (el resumen y el "Decide tu: a) b) c)"): hablan de rechazos aunque no los haya
  const t = String(texto || '')
    .split(/\r?\n/)
    .filter((l) => !/Si el motivo es un rechazo|ese mensaje dice que hacer|No voy a inventar un prompt|Decide tu:|^\s*(\[\w+\]\s+)?[abc]\) |Para retomar|Lo ya hecho no se paga|Algo no salio\. El detalle/i.test(l))
    .join('\n');
  if (!t.trim()) return null;
  // lo que respondió el servicio: el "Ultimo motivo" del motor, el "msg" de kie, su failMsg, o el código HTTP
  const motivos = [...t.matchAll(/Ultimo motivo:\s*(?:La tarea \S+ fallo\.\s*)?(.+)/gi)].map((m) => m[1].trim());
  const msgs = [...t.matchAll(/"(?:msg|failMsg|message|errorMessage)"\s*:\s*"([^"]{3,240})"/gi)].map((m) => m[1]).filter((m) => !/^success$/i.test(m));
  const http = t.match(/(?:HTTP|code[=:]\s*|devolvio HTTP |\()\s*(4\d\d|5\d\d)\b/i)?.[1] || t.match(/\b(5\d\d) Internal/i)?.[1] || null;
  const dijo = (motivos.length ? motivos[motivos.length - 1] : msgs.length ? msgs[msgs.length - 1] : http ? `Error ${http}` : null)?.slice(0, 240) || null;
  const quedan = t.match(/Quedan en kie[^\d]*(\d+)/i)?.[1];
  // las tomas que no salieron con ninguno de los modelos de video
  const tomas = [...new Set([...t.matchAll(/toma (\d+)[^\n]*fallo con los dos modelos/gi)].map((m) => m[1]))];
  const cuales = tomas.length ? `${tomas.length === 1 ? 'La toma' : 'Las tomas'} ${tomas.length === 1 ? tomas[0] : `${tomas.slice(0, -1).join(', ')} y ${tomas[tomas.length - 1]}`} no ${tomas.length === 1 ? 'salió' : 'salieron'} con ninguno de los dos modelos de video. ` : '';
  const c = (porque, hacer) => ({ porque: `${cuales}${porque}`, dijo, hacer });
  if (/IP whitelist/i.test(t)) return c('Tu clave de kie.ai tiene una lista blanca de IP y la de este computador no está.', ['En kie.ai → API Key, desactiva la lista blanca de IP (o agrega tu IP actual) y toca «Continuar». No se cobró nada.']);
  if (/rechaz\w* por contenido|content policy|violat\w* (our )?(content|polic)|sensitive|nsfw|prohibited/i.test(t))
    return c('El modelo de video rechazó una escena por su contenido (algo que su filtro considera sensible).', ['Abre el anuncio en el editor y rehaz esa toma con otra descripción.', 'O toca «Continuar»: a veces la misma escena pasa en otro intento.']);
  if (quedan || /siguen? (generando|en kie)|sin bajar/i.test(t))
    return c(`kie.ai todavía está generando ${quedan ? `${quedan} clip${quedan === '1' ? '' : 's'}` : 'algunos clips'}: hoy van más lentos de lo normal.`, ['No hagas nada: la app los recoge apenas estén y no se vuelven a pagar.', 'Si tienes prisa, toca «Continuar» para mirar de nuevo ahora.']);
  if (/\b429\b|Too Many Requests|demasiadas solicitudes|rate.?limit/i.test(t))
    return c('kie.ai está frenando pedidos porque llegaron muchos a la vez (límite de velocidad).', ['Espera unos minutos: si se detuvo, toca «Continuar».', 'Evita producir varios anuncios al mismo tiempo.']);
  if (/ElevenLabs[^\r\n]*\b402\b|paid_plan_required|payment_required|library voices/i.test(t))
    return c('ElevenLabs no deja usar esa voz con tu plan (o tiene un pago pendiente). No es tu saldo de kie.', ['Elige otra voz (una «premade» o una tuya) en el anuncio y toca «Continuar».', 'O activa un plan pago en elevenlabs.io: las voces de la biblioteca lo necesitan para usarse por la API.']);
  if (/insufficient|not enough (credits?|balance)|saldo insuficiente|no te alcanza|\b402\b/i.test(t))
    return c('No te alcanza el saldo de kie.ai.', ['Recarga en kie.ai/billing y toca «Continuar»: lo ya hecho no se vuelve a pagar.']);
  if (/rechazo la clave|invalid[_ ]api[_ ]key|You do not have access|\(401\)|\b401\b/i.test(t)) return c('kie.ai no aceptó tu clave.', ['Revisa tu clave de kie.ai en Ajustes → Conexiones y toca «Continuar».']);
  if (/fetch failed|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|ECONNREFUSED|socket hang up|network ?error/i.test(t))
    return c('Se cortó la conexión con kie.ai (tu internet o la de ellos).', ['Revisa tu internet; la app sigue sola apenas vuelva.']);
  if (/overload|saturad|busy|capacity/i.test(t))
    return c('El modelo de video de kie.ai está saturado ahora mismo.', ['Espera unos minutos: si se detuvo, toca «Continuar».', 'Si sigue así un buen rato, vuelve a producir más tarde: lo ya hecho no se vuelve a pagar.']);
  if (/\b5\d\d\b|Internal (Server )?Error|Bad Gateway|Service Unavailable|Gateway Time-?out|error del servidor|try again later/i.test(t))
    return c(`El servidor de kie.ai está fallando${http ? ` (error ${http})` : ''}: es un problema de ellos, no de tu anuncio.`, ['Si arriba dice que lo reintenta sola, no hagas nada.', 'Si se detuvo, toca «Continuar» en unos minutos: lo ya hecho no se vuelve a pagar.', 'Si sigue fallando un buen rato, kie.ai tiene una caída: vuelve a producir más tarde.']);
  if (dijo) return c('kie.ai devolvió un error.', ['Toca «Continuar» para reintentar. Si se repite, rehaz esa toma en el editor con otra descripción.']);
  return null;
}

/** Las que se reintentan solas. */
export const SE_REINTENTA = new Set(['red', 'servidor']);

/** El fallo en palabras simples (para la tarjeta del paso). */
export function mensajeDeFallo(clase, { que = 'este paso' } = {}) {
  switch (clase) {
    case 'ruta-larga':
      return 'Windows no deja abrir el programa que arma el video porque la carpeta de la app quedó muy adentro de otras carpetas. Cierra la app, mueve la carpeta «Anuncios con IA» a tu carpeta de usuario (en el Explorador, escribe %USERPROFILE% arriba y pulsa Enter), vuelve a abrirla y toca “Continuar”.';
    case 'clave':
      return 'Una de tus claves no funciona (kie o ElevenLabs). Revísala en Ajustes y toca “Continuar”.';
    case 'saldo':
      return 'Tu saldo de kie no alcanza: recarga para seguir';
    case 'voz-pago':
      return 'ElevenLabs no dejó grabar la voz: tu plan de ElevenLabs no permite esa voz por la API (las voces de la biblioteca piden un plan pago) o tiene un pago pendiente. Elige otra voz (una «premade» o una tuya) o activa un plan pago en ElevenLabs, y toca “Continuar”. No tiene que ver con tu saldo de kie.';
    case 'cuota-voz':
      return 'Se terminaron los caracteres de tu plan de ElevenLabs. Amplíalo y toca “Continuar”.';
    case 'red':
      return 'Se cortó la conexión a internet.';
    case 'servidor':
      return 'kie no respondió bien (es un problema de su lado, no tuyo).';
    case 'contenido':
      return 'El modelo de video rechazó una escena por su contenido.';
    default:
      return `No pude terminar ${que}.`;
  }
}

// ---------------------------------------------------------------- conexion

function conectar(host, puerto, ms = 5000) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port: puerto });
    const fin = (ok) => {
      s.removeAllListeners();
      s.destroy();
      resolve(ok);
    };
    s.setTimeout(ms, () => fin(false));
    s.once('connect', () => fin(true));
    s.once('error', () => fin(false));
  });
}

/**
 * ¿Hay internet? Una conexion TCP a kie (y a ElevenLabs si kie no contesta): gratis, no llama a ninguna API.
 * En modo prueba se mira el kie simulado (el motor no sale a internet).
 */
export async function hayConexion() {
  if (modoPrueba()) {
    try {
      const env = await entornoDeModoPrueba();
      const u = new URL(env?.KIE_BASE_URL || '');
      return await conectar(u.hostname, Number(u.port) || 80, 3000);
    } catch {
      return false;
    }
  }
  if (await conectar('api.kie.ai', 443)) return true;
  return conectar('api.elevenlabs.io', 443);
}

const despertadores = new Map(); // slug -> () => void: corta la espera de ese anuncio ("Continuar")

/**
 * Espera `ms`. true si paso el tiempo (o si la despertaron con despertar(slug)), false si la cancelaron.
 * Con `slug`, "Continuar" la corta y se reintenta enseguida.
 */
export function dormir(ms, senal, slug = null) {
  return new Promise((resolve) => {
    if (senal?.aborted) return resolve(false);
    const fin = (valor) => {
      clearTimeout(t);
      senal?.removeEventListener('abort', alAbortar);
      if (slug && despertadores.get(slug) === despertar) despertadores.delete(slug);
      resolve(valor);
    };
    const alAbortar = () => fin(false);
    const despertar = () => fin(true);
    const t = setTimeout(() => fin(true), ms);
    senal?.addEventListener('abort', alAbortar, { once: true });
    if (slug) despertadores.set(slug, despertar);
  });
}

/** Corta la espera de un reintento de ese anuncio (si estaba esperando). true si habia una. */
export function despertar(slug) {
  const f = despertadores.get(slug);
  if (!f) return false;
  despertadas.add(slug);
  f();
  return true;
}

/** ¿Ese anuncio esta esperando un reintento o la conexion? */
export const estaEsperando = (slug) => despertadores.has(slug);

/** Espera a que vuelva internet (sin limite). false si lo cancelaron. Con `slug`, "Continuar" la corta. */
export async function esperarConexion(senal, slug = null) {
  while (!senal?.aborted) {
    if (await hayConexion()) return true;
    if (!(await dormir(CADA_CUANTO_MIRAR_LA_CONEXION_MS, senal, slug))) return false;
    if (slug && despertadas.delete(slug)) return true; // "Continuar": se prueba ya, haya o no conexion
  }
  return false;
}
const despertadas = new Set();

/**
 * El saldo de kie en creditos (gratis: /api/v1/chat/credit, como consultarCreditos de kie-client.js), o null si
 * no se pudo. En modo prueba, el del kie simulado. La clave sale del entorno del motor o del .env, y no sale de aca.
 */
export async function consultarSaldoKie() {
  let env;
  try {
    env = await entornoDelMotor();
  } catch {
    return null;
  }
  const base = String(env.KIE_BASE_URL || 'https://api.kie.ai').replace(/\/+$/, '');
  const clave = String(env.KIE_API_KEY || claveDelEnv('KIE_API_KEY') || '').trim();
  if (!clave) return null;
  try {
    const res = await fetch(`${base}/api/v1/chat/credit`, { headers: { Authorization: `Bearer ${clave}` }, signal: AbortSignal.timeout(15000) });
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

// ---------------------------------------------------------------- terminar procesos

/** Termina un proceso y todo lo que lanzo (en Windows con taskkill /T /F; Remotion y ffmpeg cuelgan del motor). */
export function matarArbol(pid) {
  if (!pid) return Promise.resolve();
  return new Promise((resolve) => {
    if (WIN) {
      const k = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      k.on('error', () => resolve());
      k.on('close', () => resolve());
    } else {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {
          /* ya no estaba */
        }
      }
      resolve();
    }
  });
}

/**
 * Los navegadores de Remotion (chrome-headless-shell de remotion/node_modules) que quedaron sin su proceso padre:
 * de un render que se cayo o de una app que se cerro de golpe. Ocupan memoria y hacen fallar los renders que
 * siguen. Los de un render en marcha (su padre vivo, de esta app o de otra) no se tocan. Solo en Windows (en los
 * demas sistemas matarArbol corta el grupo entero). Devuelve cuantos cerro.
 */
export function cerrarNavegadoresSueltos() {
  if (!WIN) return Promise.resolve(0);
  const carpeta = path.join(RAIZ, 'remotion').replace(/'/g, "''");
  const script = [
    '$ps = @(Get-CimInstance Win32_Process)',
    '$vivos = @{}',
    'foreach ($x in $ps) { $vivos[[uint32]$x.ProcessId] = 1 }',
    `$ps | Where-Object { $_.Name -like 'chrome-headless-shell*' -and $_.ExecutablePath -and $_.ExecutablePath.StartsWith('${carpeta}', [StringComparison]::OrdinalIgnoreCase) -and -not $vivos.ContainsKey([uint32]$_.ParentProcessId) } | ForEach-Object { $_.ProcessId }`,
  ].join('; ');
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 30000 }, async (err, stdout) => {
      if (err) return resolve(0);
      const pids = String(stdout || '')
        .split(/\s+/)
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0);
      for (const pid of pids) await matarArbol(pid);
      if (pids.length) console.log(`[procesos] Cerre ${pids.length} navegador${pids.length === 1 ? '' : 'es'} de Remotion que quedaron sueltos.`);
      resolve(pids.length);
    });
  });
}

function vivo(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

/** La linea de comandos de un proceso (para no matar otro que reuso el mismo numero). null si no se pudo saber. */
function lineaDeComandos(pid) {
  return new Promise((resolve) => {
    if (WIN) {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', `(Get-CimInstance Win32_Process -Filter "ProcessId=${Number(pid)}").CommandLine`],
        { windowsHide: true, timeout: 20000 },
        (err, stdout) => resolve(err ? null : String(stdout || '').trim() || null)
      );
    } else {
      execFile('ps', ['-o', 'command=', '-p', String(pid)], { timeout: 5000 }, (err, stdout) => resolve(err ? null : String(stdout || '').trim() || null));
    }
  });
}

// ---------------------------------------------------------------- lo que esta corriendo

const corriendo = new Map(); // slug -> { hijo, paso, script, cancelado }

const dirApp = (slug) => path.join(TEMP, slug, 'app');
const rutaProceso = (slug) => path.join(dirApp(slug), 'proceso.json');

export const enMarcha = (slug) => {
  const x = corriendo.get(slug);
  return x ? { paso: x.paso, script: x.script, pid: x.hijo.pid } : null;
};

/** Corta lo que este corriendo para ese anuncio. true si habia algo. */
export async function cancelar(slug) {
  const x = corriendo.get(slug);
  if (!x) return false;
  x.cancelado = true;
  await matarArbol(x.hijo.pid);
  return true;
}

/** El nombre del programa de un proceso ("node.exe"), por si no se pudo leer su linea de comandos. null = no se sabe. */
function nombreDelProceso(pid) {
  return new Promise((resolve) => {
    if (!WIN) return resolve(null);
    execFile('tasklist', ['/FI', `PID eq ${Number(pid)}`, '/FO', 'CSV', '/NH'], { windowsHide: true, timeout: 10000 }, (err, stdout) => {
      if (err) return resolve(null);
      const m = String(stdout || '').match(/^"([^"]+)","(\d+)"/m);
      resolve(m && Number(m[2]) === Number(pid) ? m[1] : null);
    });
  });
}

/**
 * Un script del motor de verdad ('producir.js', 'pruebas/x.js') o una familia de la app que corre como proceso aparte
 * ('../app/server/lib/familias/objeto-parlante.js', la revision del habla): lo unico que proceso.json puede nombrar.
 */
function esScriptDelMotor(script) {
  const s = String(script || '').replace(/\\/g, '/');
  return /^(pruebas\/|\.\.\/app\/server\/lib\/familias\/)?[a-z0-9][a-z0-9-]*\.m?js$/i.test(s) && existeArchivo(path.join(DIR_MOTOR, s));
}
function existeArchivo(ruta) {
  try {
    return fs.statSync(ruta).isFile();
  } catch {
    return false;
  }
}

/**
 * Si quedo vivo un proceso del motor de una vez anterior de la app (proceso.json con un pid que sigue vivo y que
 * es de verdad ese comando sobre ese anuncio), se corta con todo lo que lanzo. Se llama antes de retomar.
 * Devuelve { habia, matado, pid, dudoso? }. dudoso = sigue vivo y no se pudo saber que es: no se relanza nada
 * (proceso.json queda), porque dos procesos sobre la misma carpeta pedirian dos veces lo mismo a kie.
 */
export async function matarHuerfano(slug) {
  const ruta = rutaProceso(slug);
  let p;
  try {
    p = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  } catch {
    return { habia: false };
  }
  const pid = Number(p?.pid);
  const mio = corriendo.get(slug)?.hijo?.pid === pid;
  if (mio) return { habia: true, matado: false, pid, motivo: 'es de esta misma vez de la app' };
  let matado = false;
  // Un proceso.json que no nombra un script del motor no lo escribio la app: no se corta nada por el.
  if (pid && pid !== process.pid && esScriptDelMotor(p.script) && vivo(pid)) {
    const linea = await lineaDeComandos(pid);
    if (linea) {
      // Solo si es nuestro comando: el script y la carpeta del anuncio en la linea de comandos.
      if (linea.includes(path.basename(String(p.script))) && linea.includes(slug)) {
        await matarArbol(pid);
        matado = true;
      }
    } else {
      // No se pudo leer su linea de comandos (CIM/WMI no contesto): se mira al menos que programa es.
      const nombre = await nombreDelProceso(pid);
      if (nombre && /^node(\.exe)?$/i.test(nombre)) {
        await matarArbol(pid);
        matado = true;
      } else if (!nombre && vivo(pid)) {
        return { habia: true, matado: false, pid, dudoso: true, motivo: 'sigue vivo y no se pudo saber que es' };
      }
    }
  }
  try {
    fs.rmSync(ruta, { force: true });
  } catch {
    /* se pisa al lanzar el proximo */
  }
  return { habia: true, matado, pid };
}

// ---------------------------------------------------------------- la fila pesada (de a uno)

const filaPesada = [];
let pesadoEnCurso = false;

function turnoPesado(senal) {
  return new Promise((resolve) => {
    const entrar = () => {
      pesadoEnCurso = true;
      resolve(true);
    };
    if (!pesadoEnCurso) return entrar();
    const item = { entrar, resolve };
    filaPesada.push(item);
    senal?.addEventListener(
      'abort',
      () => {
        const i = filaPesada.indexOf(item);
        if (i !== -1) {
          filaPesada.splice(i, 1);
          resolve(false);
        }
      },
      { once: true }
    );
  });
}

function soltarPesado() {
  pesadoEnCurso = false;
  const siguiente = filaPesada.shift();
  if (siguiente) siguiente.entrar();
}

// ---------------------------------------------------------------- correr un comando

const MAX_COLA = 96 * 1024; // lo ultimo que dijo el comando, para saber por que fallo

const sello = () => new Date().toISOString();

/**
 * Corre un comando del motor una vez. Devuelve { codigo, texto (lo ultimo que dijo), ms, cancelado, comando }.
 *
 *   slug, paso   donde queda el registro (temp/<slug>/app/registro/<paso>.log)
 *   script       'producir.js' (en produccion/) o 'pruebas/x.js'
 *   args         argumentos, ya como lista (rutas relativas a la raiz del proyecto)
 *   env          variables extra para este proceso
 *   pesado       true: espera su turno en la fila de lo pesado (render, control final)
 *   senal        AbortSignal: cortar
 *   alLinea      (linea) => void, cada linea que dice
 */
export async function correr({ slug, paso, script, args = [], env = {}, pesado = false, senal = null, alLinea = null }) {
  if (corriendo.has(slug)) throw new Error(`Ya hay un proceso del motor corriendo para ${slug} (${corriendo.get(slug).script}).`);
  const comando = `node produccion/${script.replace(/\\/g, '/')} ${args.join(' ')}`.trim();
  const entorno = await entornoDelMotor(env);
  if (senal?.aborted) return { codigo: null, texto: '', ms: 0, cancelado: true, comando };
  // Los modelos del anuncio (temp/<slug>/modelos.json): los de Ajustes › Modelos mientras no este aprobado ni haya
  // nada generado (si el usuario los cambio antes de aprobar, se usa lo nuevo). Aprobado o con algo generado no se
  // tocan: sigue con los que tenia al aprobarlo (lib/modelos.js).
  copiarModelosAlAnuncio(slug);

  if (pesado && !(await turnoPesado(senal))) return { codigo: null, texto: '', ms: 0, cancelado: true, comando };
  try {
    fs.mkdirSync(path.join(dirApp(slug), 'registro'), { recursive: true });
    const registro = fs.createWriteStream(path.join(dirApp(slug), 'registro', `${paso}.log`), { flags: 'a' });
    registro.on('error', () => {});
    registro.write(`\n=== ${sello()}  ${comando}${modoPrueba() ? '   [modo prueba]' : ''}\n`);

    return await new Promise((resolve) => {
      const t0 = Date.now();
      let cola = '';
      let pendiente = '';
      const anotar = (d) => {
        const t = d.toString('utf8');
        registro.write(t);
        cola = (cola + t).slice(-MAX_COLA);
        if (alLinea) {
          pendiente += t;
          let i;
          while ((i = pendiente.indexOf('\n')) >= 0) {
            const l = pendiente.slice(0, i).replace(/\r$/, '');
            pendiente = pendiente.slice(i + 1);
            try {
              alLinea(l);
            } catch {
              /* quien escucha no frena al comando */
            }
          }
        }
      };

      let hijo;
      try {
        hijo = spawn(process.execPath, [path.join(DIR_MOTOR, script), ...args], {
          cwd: RAIZ,
          env: entorno,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
          detached: !WIN, // en Mac/Linux, su propio grupo: matarArbol corta todo
        });
      } catch (e) {
        registro.end(`\n!! No pude arrancar el comando: ${e.message}\n`);
        return resolve({ codigo: 1, texto: e.message, ms: 0, cancelado: false, comando });
      }
      const item = { hijo, paso, script, cancelado: false };
      corriendo.set(slug, item);
      try {
        fs.writeFileSync(
          rutaProceso(slug),
          JSON.stringify({ pid: hijo.pid, paso, script, args, comando, inicio: sello(), app: process.pid }, null, 2) + '\n',
          'utf8'
        );
      } catch {
        /* sin proceso.json solo se pierde la proteccion contra huerfanos */
      }

      const alAbortar = () => {
        item.cancelado = true;
        matarArbol(hijo.pid);
      };
      senal?.addEventListener('abort', alAbortar, { once: true });

      hijo.stdout.on('data', anotar);
      hijo.stderr.on('data', anotar);
      let errorAlArrancar = null;
      hijo.on('error', (e) => {
        errorAlArrancar = e;
      });
      hijo.on('close', (codigo, senial) => {
        senal?.removeEventListener('abort', alAbortar);
        if (corriendo.get(slug) === item) corriendo.delete(slug);
        try {
          const p = JSON.parse(fs.readFileSync(rutaProceso(slug), 'utf8'));
          if (p.pid === hijo.pid) fs.rmSync(rutaProceso(slug), { force: true });
        } catch {
          /* ya no estaba */
        }
        if (pendiente && alLinea) {
          try {
            alLinea(pendiente);
          } catch {
            /* idem */
          }
        }
        const ms = Date.now() - t0;
        const fin = errorAlArrancar ? `!! No pude arrancar el comando: ${errorAlArrancar.message}` : `--- termino con codigo ${codigo ?? senial} en ${Math.round(ms / 1000)} s`;
        registro.end(`\n${fin}\n`);
        resolve({
          codigo: errorAlArrancar ? 1 : typeof codigo === 'number' ? codigo : null,
          texto: errorAlArrancar ? `${cola}\n${errorAlArrancar.message}` : cola,
          ms,
          cancelado: item.cancelado,
          comando,
        });
      });
    });
  } finally {
    if (pesado) soltarPesado();
  }
}

/**
 * Corre un comando y, si falla por la red o por el servidor de kie, lo vuelve a correr solo:
 *   - sin conexion: espera a que vuelva (sin limite, no cuenta como intento) y sigue;
 *   - con conexion: a los 30 s, 2 min y 5 min. Despues devuelve el fallo (el paso queda en "error").
 * Lo demas (clave, saldo, contenido, otro) se devuelve enseguida con su `clase`. "Continuar" (despertar)
 * corta cualquier espera y reintenta ya.
 *
 *   antesDeCorrer()                                                         antes de cada intento
 *   despuesDeCorrer(r)                                                      despues de cada intento (gasto)
 *   alEsperar({ motivo: 'conexion'|'servidor'|'red', hasta, numero, mensaje })  antes de cada espera
 *   alReintentar({ numero })                                                antes de cada reintento
 *
 * Devuelve lo de correr() mas { clase, reintentos }.
 */
export async function correrConReintentos(opciones, { antesDeCorrer = null, despuesDeCorrer = null, alEsperar = null, alReintentar = null } = {}) {
  const senal = opciones.senal || null;
  const slug = opciones.slug;
  let reintentos = 0;
  for (;;) {
    await antesDeCorrer?.();
    const r = await correr(opciones);
    await despuesDeCorrer?.(r);
    if (r.cancelado) return { ...r, clase: 'cancelado', reintentos };
    if (r.codigo === 0) return { ...r, clase: null, reintentos };
    const clase = clasificarFallo(r.texto);
    if (!SE_REINTENTA.has(clase)) return { ...r, clase, reintentos };

    if (!(await hayConexion())) {
      await alEsperar?.({ motivo: 'conexion', hasta: null, numero: reintentos, texto: r.texto, mensaje: 'Se cortó internet: sigo apenas vuelva.' });
      if (!(await esperarConexion(senal, slug))) return { ...r, codigo: null, cancelado: true, clase: 'cancelado', reintentos };
      await alReintentar?.({ numero: reintentos });
      continue; // sin conexion no cuenta como intento
    }
    if (reintentos >= ESPERAS_REINTENTO_MS.length) return { ...r, clase, reintentos };
    const ms = ESPERAS_REINTENTO_MS[reintentos];
    reintentos++;
    const hasta = new Date(Date.now() + ms);
    const hora = hasta.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    await alEsperar?.({
      motivo: clase,
      hasta: hasta.toISOString(),
      numero: reintentos,
      texto: r.texto,
      mensaje: clase === 'red' ? `Falló la conexión con kie: lo intento de nuevo a las ${hora}.` : `kie no respondió bien: lo intento de nuevo a las ${hora}.`,
    });
    if (!(await dormir(ms, senal, slug))) return { ...r, codigo: null, cancelado: true, clase: 'cancelado', reintentos };
    despertadas.delete(slug);
    await alReintentar?.({ numero: reintentos });
  }
}

/** Para las pruebas: cuantos procesos hay corriendo y si la fila pesada esta ocupada. */
export const estadoDeLaFila = () => ({ corriendo: [...corriendo.keys()], pesado: pesadoEnCurso, esperandoPesado: filaPesada.length });

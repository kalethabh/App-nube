// Las claves del usuario (kie.ai y ElevenLabs) en el .env de la raiz, y las consultas gratis que
// dicen si funcionan: el saldo de kie y el usuario de ElevenLabs.
//
//   clavesGuardadas()                 -> { kie: bool, elevenlabs: bool }      (nunca el valor)
//   await guardarClaves({ kie, elevenlabs })                                  (solo las que vienen)
//   await probarClave('kie' | 'elevenlabs')  -> { ok, motivo?, mensaje, saldoKie? }
//   await saldoKie({ fresco })        -> { ok, creditos, consultado } | { ok: false, motivo, mensaje }
//   leerClave('KIE_API_KEY')          -> el valor, SOLO para usarlo aca en el servidor
//
// Reglas:
// - Los valores nunca salen hacia el navegador ni a un registro: ni enteros ni recortados.
// - Al guardar se reemplaza solo la linea de esa clave; el resto del .env (ELEVENLABS_VOICE_ID,
//   comentarios, el orden, los fines de linea) queda igual. Se escribe en un .tmp y se renombra,
//   para que el motor nunca lea un .env a medio escribir.
// - Lo que se guarda tiene que poder leerlo process.loadEnvFile (el motor, config.js:13-19) tal
//   cual: sin espacios, comillas, "#" ni saltos de linea (un salto de linea metido en una clave
//   podria agregar otra variable al .env).
// - Las consultas son gratis: GET /api/v1/chat/credit de kie (la misma que consultarCreditos() de
//   produccion/kie-client.js) y GET /v1/user de ElevenLabs. Siempre van a los servicios reales:
//   el modo prueba simula solo lo que corre el motor, no esta pantalla.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { ENV } from './rutas.js';

export const CLAVES = {
  kie: { variable: 'KIE_API_KEY', nombre: 'kie.ai' },
  elevenlabs: { variable: 'ELEVENLABS_API_KEY', nombre: 'ElevenLabs' },
};

const BASES = {
  kie: 'https://api.kie.ai',
  elevenlabs: 'https://api.elevenlabs.io',
};

const ESPERA_MS = 15000;

// Para las pruebas sin tocar el .env de verdad: otro archivo y otros servidores (p. ej. el kie
// simulado). La app nunca llama a esto.
let archivoEnv = ENV;
let bases = { ...BASES };
export function _paraPruebas({ archivo, kie, elevenlabs } = {}) {
  if (archivo) archivoEnv = archivo;
  if (kie) bases.kie = kie;
  if (elevenlabs) bases.elevenlabs = elevenlabs;
  cacheSaldo = null;
}

// ---------------------------------------------------------------- leer el .env

/** El texto del .env y como estaba escrito (BOM y fin de linea), para devolverlo igual. */
function leerEnv() {
  let b;
  try {
    b = fs.readFileSync(archivoEnv);
  } catch {
    return { existe: false, texto: '', bom: false, eol: '\n' };
  }
  // un .env guardado desde PowerShell 5 puede venir en UTF-16
  let texto;
  let bom = false;
  if (b[0] === 0xff && b[1] === 0xfe) texto = b.toString('utf16le');
  else texto = b.toString('utf8');
  if (texto.charCodeAt(0) === 0xfeff) {
    texto = texto.slice(1);
    bom = true;
  }
  return { existe: true, texto, bom, eol: /\r\n/.test(texto) ? '\r\n' : '\n' };
}

// Las lineas de ejemplo del .env.example ("KIE_API_KEY=" vacia, "pega tu clave aqui") no cuentan.
const PARECE_EJEMPLO = /^(pega|tu[ _-]?clave|aqui|xxx+|<|\.\.\.|changeme)/i;

function valorDeLinea(linea) {
  const r = linea.match(/^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*)$/);
  if (!r) return null;
  let v = r[2].trim();
  if ((v.startsWith('"') || v.startsWith("'")) && v.indexOf(v[0], 1) > 0) v = v.slice(1, v.indexOf(v[0], 1));
  else v = v.replace(/\s+#.*$/, '').trim();
  return { nombre: r[1], valor: v };
}

/** El valor de una variable del .env (o del entorno del sistema si el .env no la trae). Solo para el servidor. */
export function leerClave(variable) {
  for (const linea of leerEnv().texto.split(/\r?\n/)) {
    const l = valorDeLinea(linea);
    if (l?.nombre !== variable) continue;
    if (l.valor) return l.valor;
    break;
  }
  return String(process.env[variable] || '').trim() || null;
}

const sirve = (v) => typeof v === 'string' && v.length >= 8 && !PARECE_EJEMPLO.test(v);

/** { kie: bool, elevenlabs: bool }: solo si hay algo escrito que parece una clave. */
export function clavesGuardadas() {
  const r = {};
  for (const [cual, c] of Object.entries(CLAVES)) r[cual] = sirve(leerClave(c.variable));
  return r;
}

/** Si existe el archivo .env (para el aviso de "Tu PC"). */
export const hayArchivoEnv = () => leerEnv().existe;

// ---------------------------------------------------------------- guardar

// kie da 32 letras y numeros; ElevenLabs, "sk_" y 48 mas. Se acepta un poco mas por si cambian el
// formato, pero nunca nada que rompa el .env.
const FORMA_CLAVE = /^[A-Za-z0-9_\-.+/=:]{8,300}$/;

/** Limpia lo que se pego (espacios, comillas, "KIE_API_KEY=" delante). null si no sirve como clave. */
export function limpiarClave(cual, valor) {
  if (typeof valor !== 'string') return null;
  let v = valor.trim();
  const prefijo = `${CLAVES[cual].variable}=`;
  if (v.startsWith(prefijo)) v = v.slice(prefijo.length).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1).trim();
  if (cual === 'kie' && /^bearer\s+/i.test(v)) v = v.replace(/^bearer\s+/i, '');
  return FORMA_CLAVE.test(v) && !PARECE_EJEMPLO.test(v) ? v : null;
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Escribe en un .tmp y lo renombra. En Windows el renombre falla si otro proceso tiene el .env abierto justo en ese momento: se reintenta. */
async function escribirSeguro(ruta, contenido) {
  const tmp = `${ruta}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, contenido);
  for (let intento = 1; ; intento++) {
    try {
      fs.renameSync(tmp, ruta);
      return;
    } catch (err) {
      if (intento >= 6 || !['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) {
        try {
          fs.unlinkSync(tmp);
        } catch {
          /* ya no esta */
        }
        throw err;
      }
      await esperar(120 * intento);
    }
  }
}

// Una escritura a la vez: dos "Guardar" seguidos no se pisan.
let fila = Promise.resolve();

/**
 * Guarda las claves que vienen ({ kie?, elevenlabs? }, ya limpias con limpiarClave) en el .env.
 * Si el .env no existe, lo crea solo con ellas. Devuelve clavesGuardadas().
 */
export function guardarClaves(nuevas) {
  const tarea = fila.then(async () => {
    const env = leerEnv();
    const lineas = env.existe ? env.texto.split(/\r?\n/) : [];
    // el ultimo elemento vacio es el salto de linea final: se vuelve a poner al unir
    const terminaEnSalto = lineas.length > 0 && lineas[lineas.length - 1] === '';
    if (terminaEnSalto) lineas.pop();

    for (const [cual, valor] of Object.entries(nuevas)) {
      const variable = CLAVES[cual]?.variable;
      if (!variable || !valor) continue;
      let puesta = false;
      for (let i = 0; i < lineas.length; i++) {
        const l = valorDeLinea(lineas[i]);
        if (l?.nombre !== variable) continue;
        if (!puesta) {
          lineas[i] = `${variable}=${valor}`;
          puesta = true;
        } else {
          lineas.splice(i, 1); // una linea repetida mas abajo pisaria la nueva
          i--;
        }
      }
      if (!puesta) lineas.push(`${variable}=${valor}`);
      // Si algo de la app ya cargo el .env en su entorno (process.loadEnvFile no pisa lo que ya
      // esta), los procesos que lance despues heredarian la clave vieja: se pone la nueva.
      if (variable in process.env) process.env[variable] = valor;
      if (cual === 'kie') cacheSaldo = null;
    }

    // Siempre UTF-8 SIN BOM, aunque el original lo trajera (o viniera en UTF-16, como lo deja PowerShell 5):
    // process.loadEnvFile del motor no salta el BOM y la primera variable quedaria con otro nombre.
    const texto = lineas.join(env.eol) + env.eol;
    await escribirSeguro(archivoEnv, Buffer.from(texto, 'utf8'));
    return clavesGuardadas();
  });
  fila = tarea.catch(() => {});
  return tarea;
}

/**
 * Un .env con BOM o en UTF-16 (PowerShell 5 lo deja asi) se lee bien aca, pero el motor no encuentra su primera
 * variable: se reescribe igual, en UTF-8 sin BOM. Se llama al abrir la app. true si lo arreglo.
 */
export async function repararEnv() {
  const env = leerEnv();
  if (!env.existe || !env.bom) return false;
  await guardarClaves({});
  return true;
}

// ---------------------------------------------------------------- consultas gratis

/** fetch con plazo; los errores de red vuelven como { red: true } (nunca tira). */
async function consultar(url, cabeceras) {
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json', ...cabeceras }, signal: AbortSignal.timeout(ESPERA_MS) });
    let json = null;
    try {
      json = await r.json();
    } catch {
      json = null;
    }
    return { estado: r.status, json };
  } catch (err) {
    return { red: true, plazo: err?.name === 'TimeoutError' };
  }
}

const sinConexion = (nombre, plazo) => ({
  ok: false,
  motivo: 'sin-conexion',
  mensaje: plazo ? `${nombre} no respondió a tiempo. Vuelve a probar en un rato.` : `No pude conectar con ${nombre}. Revisa tu internet y vuelve a probar.`,
});

/** El saldo de kie con una clave dada. { ok, creditos } o { ok: false, motivo, mensaje }. */
async function creditosKie(clave) {
  if (!clave) return { ok: false, motivo: 'sin-clave', mensaje: 'Todavía no guardaste tu clave de kie.ai.' };
  const r = await consultar(`${bases.kie}/api/v1/chat/credit`, { Authorization: `Bearer ${clave}` });
  if (r.red) return sinConexion('kie.ai', r.plazo);
  const codigo = Number(r.json?.code ?? r.estado);
  if (r.estado === 401 || r.estado === 403 || codigo === 401 || codigo === 403) {
    return { ok: false, motivo: 'clave-invalida', mensaje: 'kie.ai no reconoce esta clave. Revisa que la hayas copiado entera.' };
  }
  // misma lectura que consultarCreditos() del motor
  const d = r.json?.data;
  const creditos = typeof d === 'number' ? d : typeof d?.credit === 'number' ? d.credit : typeof d?.credits === 'number' ? d.credits : null;
  if (r.estado >= 200 && r.estado < 300 && codigo === 200 && creditos !== null) return { ok: true, creditos };
  if (r.estado >= 500 || codigo >= 500) return { ok: false, motivo: 'servicio', mensaje: 'kie.ai tiene un problema en este momento. Vuelve a probar en unos minutos.' };
  return { ok: false, motivo: 'servicio', mensaje: 'kie.ai respondió algo que no esperaba. Vuelve a probar en un rato.' };
}

const huella = (v) => crypto.createHash('sha256').update(String(v)).digest('hex').slice(0, 16);

// El saldo se guarda 20 s (la pantalla lo pide seguido) y las consultas a la vez comparten la misma.
let cacheSaldo = null; // { huella, t, valor, promesa }

/** El saldo real de kie con la clave del .env: { ok, creditos, consultado } o { ok: false, motivo, mensaje }. */
export function saldoKie({ fresco = false } = {}) {
  const clave = leerClave(CLAVES.kie.variable);
  const h = clave ? huella(clave) : null;
  if (cacheSaldo && cacheSaldo.huella === h) {
    if (cacheSaldo.promesa) return cacheSaldo.promesa;
    if (!fresco && Date.now() - cacheSaldo.t < 20000) return Promise.resolve(cacheSaldo.valor);
  }
  const promesa = creditosKie(clave).then((v) => {
    const valor = v.ok ? { ...v, consultado: new Date().toISOString() } : v;
    if (cacheSaldo?.promesa === promesa) cacheSaldo = { huella: h, t: Date.now(), valor, promesa: null };
    return valor;
  });
  cacheSaldo = { huella: h, t: 0, valor: null, promesa };
  return promesa;
}

/** El saldo ya no es el mismo (se genero algo o se recargo): la proxima consulta va a kie. */
export const olvidarSaldo = () => {
  cacheSaldo = null;
};

const PLANES_ELEVENLABS = {
  free: 'Free',
  starter: 'Starter',
  creator: 'Creator',
  pro: 'Pro',
  scale: 'Scale',
  business: 'Business',
  growing_business: 'Business',
  enterprise: 'Enterprise',
};

/**
 * Lo que queda del plan de ElevenLabs (gratis: solo se lee): { ok, plan, usados, limite, renueva } o
 * { ok: false, motivo, mensaje }. Se guarda 60 s.
 */
let saldoVoz = null;
export async function saldoElevenLabs({ fresco = false, base = null, clave: claveDada = null } = {}) {
  if (!fresco && !base && saldoVoz && Date.now() - saldoVoz.t < 60000) return saldoVoz.r;
  const clave = claveDada || leerClave(CLAVES.elevenlabs.variable);
  if (!clave) return { ok: false, motivo: 'sin-clave', mensaje: 'Todavía no guardaste tu clave de ElevenLabs.' };
  const r = await consultar(`${base || bases.elevenlabs}/v1/user/subscription`, { 'xi-api-key': clave });
  let res;
  if (r.red) res = sinConexion('ElevenLabs', r.plazo);
  else if (r.estado >= 200 && r.estado < 300 && r.json) {
    const tier = String(r.json.tier || '').toLowerCase();
    res = {
      ok: true,
      plan: PLANES_ELEVENLABS[tier] || (tier ? tier.replace(/(^|_)(\w)/g, (_, x, c) => (x ? ' ' : '') + c.toUpperCase()) : null),
      usados: Number(r.json.character_count) || 0,
      limite: Number(r.json.character_limit) || 0,
      renueva: Number(r.json.next_character_count_reset_unix) ? new Date(Number(r.json.next_character_count_reset_unix) * 1000).toISOString() : null,
    };
  } else if (r.estado === 401 || r.estado === 403) {
    res = { ok: false, motivo: 'sin-permisos', mensaje: 'Tu clave de ElevenLabs no deja ver el plan. En ElevenLabs, edita la clave y activa "User" para ver lo que te queda.' };
  } else res = { ok: false, motivo: 'servicio', mensaje: 'No pude leer tu plan de ElevenLabs. Vuelve a probar en unos minutos.' };
  if (!base) saldoVoz = { t: Date.now(), r: res };
  return res;
}

/** La clave de ElevenLabs: el usuario (gratis); si la clave no deja leerlo, la lista de voces (gratis). */
async function usuarioElevenLabs(clave) {
  if (!clave) return { ok: false, motivo: 'sin-clave', mensaje: 'Todavía no guardaste tu clave de ElevenLabs.' };
  const cab = { 'xi-api-key': clave };
  const r = await consultar(`${bases.elevenlabs}/v1/user`, cab);
  if (r.red) return sinConexion('ElevenLabs', r.plazo);
  if (r.estado >= 200 && r.estado < 300) {
    // solo el nombre del plan: la respuesta trae otros datos de la cuenta que no salen de aca
    const tier = String(r.json?.subscription?.tier || '').toLowerCase();
    const plan = PLANES_ELEVENLABS[tier] || (tier ? tier.replace(/(^|_)(\w)/g, (_, s, c) => (s ? ' ' : '') + c.toUpperCase()) : null);
    return { ok: true, mensaje: plan ? `Tu clave de ElevenLabs funciona (plan ${plan}).` : 'Tu clave de ElevenLabs funciona.' };
  }
  // ElevenLabs dice que paso en detail: { type, code, status }. Una clave mal formada vuelve con 400
  // ("invalid_api_key"), una que no existe con 401 (comprobado el 2026-10-25).
  const d = r.json?.detail && typeof r.json.detail === 'object' ? r.json.detail : {};
  const detalle = [d.status, d.code, d.type].filter(Boolean).join(' ');
  if (/missing_permissions/i.test(detalle)) {
    // Clave con permisos recortados: lo que usa la app es ver las voces y hacer la voz.
    const v = await consultar(`${bases.elevenlabs}/v2/voices?page_size=1`, cab);
    if (v.red) return sinConexion('ElevenLabs', v.plazo);
    if (v.estado >= 200 && v.estado < 300) return { ok: true, mensaje: 'Tu clave de ElevenLabs funciona.' };
    return {
      ok: false,
      motivo: 'sin-permisos',
      mensaje: 'Tu clave de ElevenLabs no tiene permiso para ver tus voces. En ElevenLabs, edita la clave y activa "Voices" y "Text to Speech".',
    };
  }
  if (r.estado === 401 || r.estado === 403 || /invalid_api_key|authentication_error|unauthorized/i.test(detalle)) {
    return { ok: false, motivo: 'clave-invalida', mensaje: 'ElevenLabs no reconoce esta clave. Revisa que la hayas copiado entera.' };
  }
  if (r.estado === 429) return { ok: false, motivo: 'servicio', mensaje: 'ElevenLabs está recibiendo muchas consultas. Vuelve a probar en un minuto.' };
  return { ok: false, motivo: 'servicio', mensaje: 'ElevenLabs tiene un problema en este momento. Vuelve a probar en unos minutos.' };
}

/**
 * Prueba una clave (la del .env, o `valor` si se pasa: asi se comprueba antes de guardarla).
 * { ok, motivo?, mensaje, saldoKie? }. Gratis: no se genera nada.
 */
export async function probarClave(cual, { valor } = {}) {
  if (cual === 'kie') {
    const v = valor ? await creditosKie(valor) : await saldoKie({ fresco: true });
    if (!v.ok) return v;
    return { ok: true, mensaje: 'Tu clave de kie.ai funciona.', saldoKie: v.creditos };
  }
  if (cual === 'elevenlabs') return usuarioElevenLabs(valor || leerClave(CLAVES.elevenlabs.variable));
  return { ok: false, motivo: 'desconocida', mensaje: 'Esa conexión no existe.' };
}

// ---------------------------------------------------------------- traer las claves de IA-VID-AUTOMATIC

/**
 * La carpeta de IA-VID-AUTOMATIC en este computador (la otra app: tiene app-web/ y su .env), buscada en la carpeta
 * de usuario hasta 3 niveles (sin Library, node_modules ni carpetas ocultas). Devuelve { ruta, tiene: { kie,
 * elevenlabs } } o null. Nunca devuelve los valores.
 */
export function buscarOtraApp() {
  const casa = os.homedir();
  const SALTAR = new Set(['Library', 'node_modules', 'Applications', 'Pictures', 'Music', 'Movies', 'Public']);
  const propia = path.resolve(path.dirname(archivoEnv));
  const cola = [[casa, 0]];
  while (cola.length) {
    const [dir, prof] = cola.shift();
    let entradas = [];
    try {
      entradas = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    if (dir !== propia && entradas.some((e) => e.name === 'app-web' && e.isDirectory()) && entradas.some((e) => e.name === '.env')) {
      const texto = fs.readFileSync(path.join(dir, '.env'), 'utf8');
      const valores = {};
      for (const linea of texto.split(/\r?\n/)) {
        const l = valorDeLinea(linea);
        if (l) valores[l.nombre] = l.valor;
      }
      const tiene = {};
      for (const [cual, c] of Object.entries(CLAVES)) tiene[cual] = sirve(valores[c.variable]);
      if (Object.values(tiene).some(Boolean)) return { ruta: dir, tiene, valores: Object.fromEntries(Object.entries(CLAVES).map(([cual, c]) => [cual, sirve(valores[c.variable]) ? valores[c.variable] : null])) };
    }
    if (prof >= 3) continue;
    for (const e of entradas) if (e.isDirectory() && !e.name.startsWith('.') && !SALTAR.has(e.name)) cola.push([path.join(dir, e.name), prof + 1]);
  }
  return null;
}

/** Copia a esta app las claves que tiene IA-VID-AUTOMATIC (solo las que aquí faltan, salvo `todas`). */
export async function traerClavesDeOtraApp({ todas = false } = {}) {
  const otra = buscarOtraApp();
  if (!otra) return { ok: false, mensaje: 'No encontré IA-VID-AUTOMATIC en tu carpeta de usuario.' };
  const actuales = clavesGuardadas();
  const nuevas = {};
  for (const [cual, valor] of Object.entries(otra.valores)) if (valor && (todas || !actuales[cual])) nuevas[cual] = valor;
  if (!Object.keys(nuevas).length) return { ok: true, traidas: [], mensaje: 'Ya tenías tus claves: no hizo falta traer nada.' };
  await guardarClaves(nuevas);
  olvidarSaldo();
  return { ok: true, traidas: Object.keys(nuevas), mensaje: `Listo: traje ${Object.keys(nuevas).map((c) => CLAVES[c].nombre).join(' y ')} de IA-VID-AUTOMATIC.` };
}

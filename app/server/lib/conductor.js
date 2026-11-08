// El conductor de produccion: lleva un anuncio aprobado desde el guion hasta los MP4, paso por paso, sin que
// nadie toque la terminal.
//
//   iniciarProduccion(slug)   el usuario aprobo el guion: crea conductor.json y lo pone en la fila
//   continuar(slug)           reintenta el paso que fallo (o sigue despues de recargar el saldo, o corta una
//                             espera de reintento y prueba ya)
//   detener(slug)             corta lo que este corriendo; queda "pausado" y "Continuar" sigue desde ahi
//   retomarTodo()             al abrir la app: cada anuncio sigue en su paso (lo llama rutas/produccion.js)
//   leerConductor(slug)       el estado (temp/<slug>/app/conductor.json)
//   familiaDe(brief)          con que familia se produce un anuncio (null si todavia no se puede)
//
// TODO el estado va en disco (conductor.json se reescribe en cada cambio, de una vez: temporal + rename), asi
// que cerrar la app en cualquier momento no pierde nada: al volver, el paso que estaba corriendo se corre otra
// vez desde el principio, y eso no paga dos veces porque el motor no repite lo que ya existe y retoma las
// tareas que siguen en kie (*.kie-pendiente.json). Antes de relanzarlo se corta el proceso del motor que haya
// quedado vivo de la vez anterior (procesos.matarHuerfano): nunca dos pidiendo lo mismo a kie.
//
// conductor.json (contrato):
//   { slug, familia, estado: 'esperando'|'corriendo'|'pausado'|'error'|'listo', paso: '<id>',
//     pasos: [{ id, nombre, estado: 'pendiente'|'corriendo'|'hecho'|'error'|'saltado', inicio?, fin?, intentos,
//               error?: { mensaje (palabras simples), motivo, detalle, reintentoEn? }, nota?, detalle?,
//               turno?: { recurso: 'pesada'|'elevenlabs', desde } }],
//     rehechos: { 'toma-7': 1, render: 1 }, modoPrueba, actualizado,
//     motivo?: 'saldo'|'detenido'|'modo'|'huerfano'|'limite-claude'|'elegir-cancion'|..., creado, aprobado,
//     terminado?, saldoInicial?, saldoFinal? }
//   "esperando" sin error = en la fila; "esperando" con pasos[].error.mensaje = esperando la conexion, un
//   reintento automatico o que se renueve el plan de Claude (lo lee altoDe() de la pantalla). "pausado" con
//   motivo "saldo" = recargar y Continuar; con motivo "elegir-cancion" = el usuario elige la cancion.
//   pasos[].turno: el paso espera su lugar en una fila compartida (el render de otro anuncio, ElevenLabs).
//
// LAS FAMILIAS. Cada una es server/lib/familias/<archivo>.js y exporta FAMILIA (su id), ESTILOS (las claves de
// estilo que produce) y PASOS ([{ id, nombre, correr(ctx) }], ver voz-en-off.js; opcional pasosPara(brief)).
// Se cargan solas al arrancar: una que todavia no existe se salta y sus estilos no se producen. La de
// continuidad se elige cuando brief.continuidad es true (solo para los estilos de su ESTILOS).
//
// VARIOS ANUNCIOS A LA VEZ (colas.js): entran tantos como diga Ajustes › Tu PC (o lo que aguanta la PC, en
// automatico); los demas esperan en la fila, en el orden en que se aprobaron. Cada uno entra apenas se aprueba
// su guion. Entre los que corren se comparten Claude (2 sesiones; en pausa al primer aviso de limite), kie
// (cada proceso con su parte de los pedidos cada 10 s), ElevenLabs (2) y lo pesado (de a 1, o 2 con 32 GB).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TEMP, PUERTO_DE_PRUEBA, esDeEstaApp } from './rutas.js';
import { leerJSON, existe, listar, segmentoValido } from './archivos.js';
import * as procesos from './procesos.js';
import * as gasto from './gasto.js';
import * as colas from './colas.js';
import { olvidarSaldo } from './claves.js';
import { guardarMusicaDelAnuncio } from './biblioteca.js';

// ---------------------------------------------------------------- las familias

/** En este orden: si dos familias dijeran el mismo estilo, gana la primera. */
const ARCHIVOS_DE_FAMILIAS = ['voz-en-off', 'continuidad', 'objeto-parlante', 'ugc', 'hablado', 'musical', 'historia-musical'];
const DIR_FAMILIAS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'familias');
const CONTINUIDAD = 'continuidad';

/** familia -> modulo. Se llena al arrancar (familiasListas); esperarFamilias() espera a que este. */
export const FAMILIAS = {};
/** estilo -> familia, para los estilos que la app produce (sin la continuidad, que va por brief.continuidad). */
export const ESTILOS_PRODUCIBLES = {};
let familiasCargadas = false;

// Con import() y sin await de nivel superior: una familia puede importar este archivo sin trabar el arranque.
const familiasListas = (async () => {
  for (const archivo of ARCHIVOS_DE_FAMILIAS) {
    const ruta = path.join(DIR_FAMILIAS, `${archivo}.js`);
    if (!existe(ruta)) continue; // todavia no esta: esos estilos dicen "muy pronto"
    try {
      const m = await import(pathToFileURL(ruta).href);
      if (typeof m.FAMILIA !== 'string' || !Array.isArray(m.ESTILOS) || !Array.isArray(m.PASOS) || !m.PASOS.length) {
        console.error(`[conductor] familias/${archivo}.js no exporta FAMILIA, ESTILOS y PASOS: la salto.`);
        continue;
      }
      if (FAMILIAS[m.FAMILIA]) {
        console.error(`[conductor] familias/${archivo}.js repite la familia "${m.FAMILIA}": la salto.`);
        continue;
      }
      FAMILIAS[m.FAMILIA] = m;
      if (m.FAMILIA === CONTINUIDAD) continue;
      for (const e of m.ESTILOS) if (!ESTILOS_PRODUCIBLES[e]) ESTILOS_PRODUCIBLES[e] = m.FAMILIA;
    } catch (e) {
      console.error(`[conductor] No pude cargar familias/${archivo}.js (sus estilos no se producen):`, e?.stack || e);
    }
  }
  familiasCargadas = true;
})();

/** Espera a que esten cargadas las familias (al arrancar tarda unos milisegundos). */
export const esperarFamilias = () => familiasListas;

/** Con que familia se produce el anuncio de este brief, o null si la app todavia no lo produce. */
export function familiaDe(brief) {
  if (!brief?.estilo) return null;
  // La continuidad es solo para los estilos de voz en off: en los demas no aplica y se produce como siempre.
  if (brief.continuidad === true) {
    const f = FAMILIAS[CONTINUIDAD];
    if (f?.ESTILOS.includes(brief.estilo)) return CONTINUIDAD;
    if (!f && FAMILIAS['voz-en-off']?.ESTILOS.includes(brief.estilo)) return null; // la pidio y todavia no esta
  }
  return ESTILOS_PRODUCIBLES[brief.estilo] || null;
}

/** Los pasos de la familia para este anuncio (pasosPara(brief) si la familia los arma segun el anuncio). */
function pasosDe(fam, brief) {
  if (typeof fam.pasosPara === 'function') {
    const p = fam.pasosPara(brief);
    if (Array.isArray(p) && p.length) return p;
  }
  return fam.PASOS;
}

/** Lo mas que la app hace a la vez (Ajustes › Tu PC elige de 1 a esto). Cuantos van ahora: colas.anunciosALaVez(). */
export const MAX_A_LA_VEZ = colas.TOPE_A_LA_VEZ;

const ahora = () => new Date().toISOString();
const dirApp = (slug) => path.join(TEMP, slug, 'app');
const rutaConductor = (slug) => path.join(dirApp(slug), 'conductor.json');

// ---------------------------------------------------------------- el mando (una sola ventana produce)

// Si la app se abre dos veces (doble clic, o un `npm run dev` que se reinicia mientras otra sigue abierta), la
// segunda no puede ponerse a producir lo mismo: correria otro producir sobre la misma carpeta y le cortaria el
// suyo a la primera (matarHuerfano). Produce solo la que tiene el mando: temp/.conductor-mando.json con su pid y
// un latido cada 10 s. Un mando sin latido hace 35 s (la ventana se cerro de golpe) se puede tomar.
// (en temp/: fuera de git, y el tablero no lo ve). Una app de prueba en otro puerto tiene el suyo: produce solo los
// anuncios que creo ella, al lado de la de siempre y de otras apps de prueba.
const RUTA_MANDO = path.join(TEMP, PUERTO_DE_PRUEBA ? `.conductor-mando-${PUERTO_DE_PRUEBA}.json` : '.conductor-mando.json');
const arranque = new Date().toISOString();
const LATIDO_MS = 10000;
const VENCE_MS = 35000;
let tengoElMando = false;

function pidVivo(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

/** true si esta ventana de la app es la que produce (y si nadie lo es, lo toma). */
export function tomarElMando() {
  if (tengoElMando) return true;
  fs.mkdirSync(TEMP, { recursive: true });
  const yo = () => JSON.stringify({ pid: process.pid, desde: arranque, latido: Date.now() });
  try {
    fs.writeFileSync(RUTA_MANDO, yo(), { flag: 'wx' });
  } catch (e) {
    if (e.code !== 'EEXIST') return true; // sin poder escribirlo no se frena la produccion
    const otro = leerJSON(RUTA_MANDO);
    if (otro && otro.pid !== process.pid && Date.now() - Number(otro.latido) < VENCE_MS && pidVivo(Number(otro.pid))) return false;
    fs.writeFileSync(RUTA_MANDO, yo());
    if (leerJSON(RUTA_MANDO)?.pid !== process.pid) return false; // otra lo tomo en el mismo instante
  }
  tengoElMando = true;
  setInterval(() => {
    try {
      fs.writeFileSync(RUTA_MANDO, yo());
    } catch {
      /* el proximo latido */
    }
  }, LATIDO_MS).unref();
  // Cada 3 s: si cambiaste en Tu PC cuantos a la vez (o se libero memoria), los que esperan y ahora caben, entran.
  setInterval(() => {
    colas.revisarFilas();
    siguiente();
  }, 3000).unref();
  process.once('exit', () => {
    try {
      if (leerJSON(RUTA_MANDO)?.pid === process.pid) fs.rmSync(RUTA_MANDO, { force: true });
    } catch {
      /* queda y vence solo */
    }
  });
  return true;
}
const SIN_MANDO = 'La app ya está abierta en otra ventana, y es esa la que produce. Usa esa ventana (o ciérrala y vuelve a abrir esta).';

// ---------------------------------------------------------------- lo que se puede inyectar (pruebas)

let claudeInyectado; // undefined = el de verdad (./claude.js); null = sin Claude; objeto = { lanzarSesion, ... }

/** Para las pruebas: otro lanzador de Claude ({ lanzarSesion }) o null. */
export function configurar({ claude } = {}) {
  if (claude !== undefined) claudeInyectado = claude;
}

async function moduloClaude() {
  if (claudeInyectado !== undefined) return claudeInyectado;
  try {
    const m = await import('./claude.js');
    return typeof m.lanzarSesion === 'function' ? m : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- conductor.json

/** Un slug de anuncio hecho por la app: una carpeta de temp/ con app/brief.json (o con conductor.json). */
export function slugDeLaApp(slug) {
  return (
    segmentoValido(slug) &&
    /^[a-z0-9_][a-z0-9._-]*$/i.test(slug) &&
    slug !== '_productos' &&
    (existe(path.join(dirApp(slug), 'brief.json')) || existe(rutaConductor(slug)))
  );
}

export function leerConductor(slug) {
  const c = leerJSON(rutaConductor(slug));
  return c && Array.isArray(c.pasos) ? c : null;
}

const PAUSA = new Int32Array(new SharedArrayBuffer(4));

function guardar(c) {
  c.actualizado = ahora();
  const ruta = rutaConductor(c.slug);
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const tmp = `${ruta}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(c, null, 2) + '\n', 'utf8');
  // En Windows un lector (la pantalla pide el archivo cada 2 s) puede tenerlo abierto un instante.
  for (let i = 0; ; i++) {
    try {
      fs.renameSync(tmp, ruta);
      return;
    } catch (e) {
      if (i >= 8 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e;
      Atomics.wait(PAUSA, 0, 0, 40 * (i + 1)); // espera corta (sincrona) y vuelve a probar
    }
  }
}

function crearConductor(slug, familia, brief) {
  const pasos = pasosDe(FAMILIAS[familia], brief);
  return {
    slug,
    familia,
    estado: 'esperando',
    paso: pasos[0].id,
    pasos: pasos.map((p) => ({ id: p.id, nombre: p.nombre, estado: 'pendiente', intentos: 0 })),
    rehechos: {},
    modoPrueba: procesos.modoPrueba(),
    creado: ahora(),
    aprobado: ahora(),
    actualizado: ahora(),
  };
}

// ---------------------------------------------------------------- la fila de anuncios

const activos = new Map(); // slug -> { control: AbortController, promesa, c, limiteClaude }
const fila = []; // slugs esperando turno, en el orden en que se aprobaron
const retomasClaude = new Map(); // slug -> timeout: esperan que se renueve el plan de Claude (fuera de la fila)

// Un anuncio que solo espera su lugar en la fila pesada (el render de otro) no cuenta para "a la vez": mientras
// espera, el de la fila puede ir avanzando con sus imagenes, sus videos y su voz.
const cuentanALaVez = () => [...activos.values()].filter((e) => !e.esperaPesada).length;

function encolar(slug) {
  if (activos.has(slug) || fila.includes(slug)) return;
  if (cuentanALaVez() < colas.anunciosALaVez()) arrancar(slug);
  else fila.push(slug);
}

function siguiente() {
  while (fila.length && cuentanALaVez() < colas.anunciosALaVez()) {
    const s = fila.shift();
    const c = leerConductor(s);
    if (c && (c.estado === 'esperando' || c.estado === 'corriendo')) arrancar(s);
  }
}

function arrancar(slug) {
  const control = new AbortController();
  const entrada = { control, promesa: null, c: null, limiteClaude: null };
  activos.set(slug, entrada);
  entrada.promesa = correrConductor(slug, entrada)
    .catch((e) => {
      console.error(`[conductor] ${slug}:`, e?.stack || e);
      try {
        const c = leerConductor(slug);
        if (c && c.estado !== 'listo') {
          c.estado = 'error';
          c.error = { mensaje: 'Algo salió mal en la app. Toca “Continuar” para seguir desde donde quedó.', detalle: String(e?.stack || e) };
          guardar(c);
        }
      } catch (e2) {
        console.error(`[conductor] ${slug}: tampoco pude guardar el error:`, e2?.message || e2);
      }
    })
    .finally(() => {
      if (activos.get(slug) === entrada) activos.delete(slug);
      siguiente();
    });
  return entrada;
}

/** Para las pruebas: espera a que termine (o se frene) la corrida de un anuncio. */
export async function esperarA(slug) {
  while (activos.has(slug) || fila.includes(slug)) {
    await (activos.get(slug)?.promesa ?? new Promise((r) => setTimeout(r, 200)));
  }
  return leerConductor(slug);
}

// ---------------------------------------------------------------- esperar a que se renueve el plan de Claude

const MOTIVO_CLAUDE = 'limite-claude';

function cancelarRetomaClaude(slug) {
  const t = retomasClaude.get(slug);
  if (t) clearTimeout(t);
  retomasClaude.delete(slug);
}

/** A la hora `hasta`, el anuncio vuelve a la fila (si sigue esperando a Claude). */
function programarRetomaClaude(slug, hasta) {
  cancelarRetomaClaude(slug);
  const ms = Math.max(1000, Math.min(Date.parse(hasta) - Date.now(), 2 ** 31 - 1) || 0);
  const t = setTimeout(() => {
    retomasClaude.delete(slug);
    const c = leerConductor(slug);
    if (!c || c.estado !== 'esperando' || c.motivo !== MOTIVO_CLAUDE) return;
    // otra sesion pudo correr la pausa mas tarde (el limite semanal): se espera hasta esa hora
    const pausa = colas.pausaDeClaude();
    if (pausa && Date.parse(pausa.hasta) > Date.now() + 1000) return programarRetomaClaude(slug, pausa.hasta);
    volverALaFila(c);
  }, ms);
  t.unref?.();
  retomasClaude.set(slug, t);
}

function volverALaFila(c) {
  for (const p of c.pasos) if (p.error?.motivo === MOTIVO_CLAUDE) delete p.error;
  delete c.motivo;
  c.estado = 'esperando';
  guardar(c);
  encolar(c.slug);
}

/**
 * El paso necesitaba a Claude y el plan se acabo por ahora: el anuncio deja su lugar (los demas siguen) y vuelve
 * solo a la fila cuando se renueva. Al abrir la app, lo mismo (retomarTodo).
 */
function esperarAClaude(c, p, pausa) {
  const hasta = pausa?.hasta || colas.pausaDeClaude()?.hasta || new Date(Date.now() + 30 * 60000).toISOString();
  const hora = colas.horaDe(hasta);
  p.estado = 'pendiente';
  delete p.detalle;
  delete p.turno;
  p.error = {
    mensaje: `Se acabó por ahora el uso de tu plan de Claude: sigo solo${hora ? ` a las ${hora}` : ' en un rato'}. Lo ya hecho no se repite.`,
    motivo: MOTIVO_CLAUDE,
    reintentoEn: hasta,
  };
  c.estado = 'esperando';
  c.motivo = MOTIVO_CLAUDE;
  guardar(c);
  programarRetomaClaude(c.slug, hasta);
  console.log(`[conductor] ${c.slug}: espera a que se renueve el plan de Claude (${hasta}).`);
}

// ---------------------------------------------------------------- correr los pasos

const TURNO = {
  pesada: 'Esperando su turno: tu PC está armando el video de otro anuncio',
  elevenlabs: 'Esperando su turno con ElevenLabs: está con otro anuncio',
};

// ---------------------------------------------------------------- el render: su avance y sus reintentos

/** "2h 4m 22s" -> segundos (null si no se entiende). */
function segundosDeRemotion(t) {
  const m = String(t || '').match(/(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?/);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
}

/**
 * Lee lo que dice ensamblar.js mientras renderiza y lo deja en el paso (p.render), cada 5 s como mucho:
 *   { renders, n, hechos, total, restante, en }
 * renders: cuantos renders hace (las versiones que no se arman de otra), n: en cual va (1..renders), restante: los
 * segundos que le faltan a ese render segun Remotion. La pantalla suma los renders que faltan.
 */
export function avanceDelRender(c, p) {
  let renders = 1;
  let n = 0;
  let previo = -1;
  let ultimo = 0;
  return (crudo) => {
    // (si el render reescribe la misma linea con \r, cuenta lo ultimo que dijo)
    const linea = String(crudo || '').split('\r').filter((x) => x.trim()).pop() || '';
    const v = linea.match(/^\s*Versiones:\s+(\d+)/);
    if (v) renders = Number(v[1]) || renders;
    const r = linea.match(/^\s*Renders:\s+(\d+)/);
    if (r) renders = Number(r[1]) || renders;
    const m = linea.match(/Rendered (\d+)\/(\d+)(?:, time remaining: ([\dhms ]+))?/);
    if (!m) return;
    const hechos = Number(m[1]);
    const otro = n === 0 || hechos < previo; // empezo el render de la version siguiente
    if (otro) n = Math.max(1, Math.min(renders, n + 1));
    previo = hechos;
    const restante = m[3] ? segundosDeRemotion(m[3]) : null;
    const ahoraMs = Date.now();
    if (!otro && ahoraMs - ultimo < 5000) return;
    ultimo = ahoraMs;
    p.render = { renders, n, hechos, total: Number(m[2]), restante, en: new Date(ahoraMs).toISOString() };
    try {
      guardar(c);
    } catch {
      /* la proxima linea */
    }
  };
}

// LA APP ENTREGA SOLO LA VERSION COMPLETA (decision de Diego, 2026-10-26). Todo render de un anuncio pasa por
// ctx.correr('ensamblar.js'), y ahi se le agrega --solo-completa: todas las familias, cada version con otro gancho
// del UGC y la segunda exportacion del control final. Un render, no dos y un remux. El control final lo sabe solo
// (ensamblar deja qa/versiones.json) y espera esa version. Las otras (sin subtitulos, sin musica, limpia) se sacan
// desde el editor: "Exportar" (ModalExportar.jsx, produccion/exportar-edicion.js).
const SOLO_COMPLETA = '--solo-completa';
const conSoloCompleta = (args) => (args.includes(SOLO_COMPLETA) ? [...args] : [...args, SOLO_COMPLETA]);

// Lo que dice ensamblar cuando el render se cayo por la PC (y no por un archivo que falta o un plan viejo).
const FALLA_DE_RENDER = /El render ".+?" fallo|Timed out after|delayRender|headless|Target closed|Protocol error|No frame found|out of memory|ENOMEM|Failed to launch/i;
const NO_ARRANCO_EL_NAVEGADOR = /setting up the headless browser|Failed to launch/i;

/**
 * ensamblar.js con sus reintentos (todas las familias). Exportar es gratis, y lo que mas lo hace fallar es la PC:
 * poca memoria, el navegador del render que no arranca a tiempo con la maquina ocupada, un fotograma que tarda mas
 * de lo que Remotion espera. Si se cae: se cierran los navegadores de Remotion que quedaron sueltos, se espera un
 * rato y se vuelve a probar mas despacio (la mitad de fotogramas a la vez, y despues de a uno; si el navegador ni
 * arranco, primero con la misma). Hasta 3 intentos. La velocidad que se uso queda en el paso (p.renderLento): si
 * la app se cierra, al volver sigue con esa y no vuelve a arrancar rapido.
 */
export async function exportarConReintentos(ctx, script, args, opciones) {
  const p = ctx.paso;
  const iCon = args.indexOf('--concurrencia');
  const pedida = iCon !== -1 ? Number(args[iCon + 1]) || null : null;
  const base = iCon !== -1 ? [...args.slice(0, iCon), ...args.slice(iCon + 2)] : [...args];
  const conVelocidad = (n) => (n ? [...base, '--concurrencia', String(n)] : base);
  let n = Number(p.renderLento) > 0 ? Math.min(Number(p.renderLento), pedida || Infinity) : pedida;
  let r;
  for (let intento = 1; ; intento++) {
    r = await ctx.correrUnaVez(script, conVelocidad(n), opciones);
    if (r.codigo === 0 || r.cancelado || ctx.senal.aborted) return r;
    if (intento >= 3 || !FALLA_DE_RENDER.test(String(r.texto || ''))) return r;
    // la carpeta de la app esta tan adentro de otras que Windows no abre el navegador: otro intento no sirve
    if (procesos.clasificarFallo(r.texto) === 'ruta-larga') return { ...r, clase: 'ruta-larga' };
    await procesos.cerrarNavegadoresSueltos().catch(() => 0);
    // la que uso: la pedida, o la que eligio ensamblar segun la memoria (lo dice en su salida). Nunca se sube.
    const usada = n || Number([...String(r.texto || '').matchAll(/Concurrencia: (\d+) fotograma/g)].pop()?.[1]) || 4;
    const siguiente = intento === 1 && NO_ARRANCO_EL_NAVEGADOR.test(String(r.texto || '')) ? usada : intento === 1 ? Math.max(1, Math.floor(usada / 2)) : 1;
    n = siguiente;
    p.renderLento = n;
    ctx.guardar();
    console.log(`[conductor] ${ctx.slug}: el render se cayo (intento ${intento}); sigo con ${n} fotograma${n === 1 ? '' : 's'} a la vez.`);
    if (!(await ctx.esperar(20000 * intento, 'La exportación no salió: la intento de nuevo, más despacio.'))) return { ...r, cancelado: true };
  }
}

function contexto(c, p, entrada) {
  const slug = c.slug;
  const carpeta = path.join(TEMP, slug);
  const senal = entrada.control.signal;
  const brief = leerJSON(path.join(dirApp(slug), 'brief.json'));
  const ctx = {
    slug,
    carpeta,
    carpetaArg: `temp/${slug}`,
    brief,
    conductor: c,
    paso: p,
    senal,
    guardar: () => guardar(c),
    /** El lanzador de Claude (o null), con la fila compartida: en pausa por limite de uso no abre sesiones. */
    claude: async () => {
      const m = await moduloClaude();
      return colas.claudeEnFila(m, {
        alLimite: (pausa) => {
          entrada.limiteClaude = pausa;
        },
      });
    },
    /** Una frase de lo que esta haciendo ahora el paso (la pantalla la muestra debajo del paso). */
    avance(frase) {
      if (!frase || p.detalle === frase) return;
      p.detalle = frase;
      guardar(c);
    },
    /** Espera `ms` mostrando `mensaje` ("Continuar" la corta). false si lo detuvieron. */
    async esperar(ms, mensaje) {
      p.error = { mensaje, motivo: 'servidor', reintentoEn: new Date(Date.now() + ms).toISOString() };
      c.estado = 'esperando';
      guardar(c);
      const ok = await procesos.dormir(ms, senal, slug);
      delete p.error;
      if (!senal.aborted) c.estado = 'corriendo';
      guardar(c);
      return ok && !senal.aborted;
    },
    /** Espera a que vuelva internet ("Continuar" la corta). false si lo detuvieron. */
    async esperarConexion() {
      p.error = { mensaje: 'Se cortó internet: sigo apenas vuelva.', motivo: 'conexion' };
      c.estado = 'esperando';
      guardar(c);
      const ok = await procesos.esperarConexion(senal, slug);
      delete p.error;
      if (!senal.aborted) c.estado = 'corriendo';
      guardar(c);
      return ok && !senal.aborted;
    },
    /**
     * Corre un comando del motor con los reintentos de red y de kie, su registro y su gasto, esperando su lugar
     * en las filas compartidas (colas.js) en cada intento, y lo suelta apenas termina (nada queda tomado
     * mientras se espera un reintento).
     *   opciones.que      lo que puede cobrar ('imagenes', 'videos', 'musica', 'cancion', 'voz', 'scribe'): se
     *                     anota la corrida, y dice si va por la fila de ElevenLabs y con su parte de kie
     *   opciones.clipsDe  (texto) => clips que transcribio Scribe (solo con 'scribe')
     *   opciones.env      variables extra; opciones.pesado: la fila pesada (render, control final);
     *   opciones.solo     pesado y sin nada pesado al lado (el recorte del host ya va asi solo)
     * El render (ensamblar.js) va con sus reintentos propios (exportarConReintentos) y solo la completa
     * (--solo-completa, ver SOLO_COMPLETA).
     */
    async correr(script, args = [], opciones = {}) {
      if (path.basename(String(script)) === 'ensamblar.js') return exportarConReintentos(ctx, script, conSoloCompleta(args), opciones);
      return ctx.correrUnaVez(script, args, opciones);
    },
    /** Lo mismo, sin los reintentos del render. */
    async correrUnaVez(script, args = [], opciones = {}) {
      const que = opciones.que || [];
      const recursos = colas.recursosDe(script, args, opciones);
      const env = { ...(opciones.env || {}) };
      // Los argumentos de cada intento: un render que entra con otro corriendo va con menos fotogramas a la vez.
      const argsProceso = [...args];
      const esRender = path.basename(String(script)) === 'ensamblar.js' && !args.includes('--concurrencia');
      // Con un solo lugar pesado va tambien por la fila de procesos.js (por si algo la usa sin pasar por aca).
      const pesadoEnProcesos = recursos.pesada && colas.pesadosALaVez() === 1;
      let soltarFilas = null;
      let soltarKie = null;
      const soltar = () => {
        soltarFilas?.();
        soltarFilas = null;
        soltarKie?.();
        soltarKie = null;
      };
      let detalleAntes;
      const esperando = ({ fila: recurso }) => {
        detalleAntes = p.detalle;
        p.turno = { recurso, desde: ahora() };
        p.detalle = TURNO[recurso] || 'Esperando su turno';
        guardar(c);
        if (recurso === 'pesada') {
          entrada.esperaPesada = true;
          siguiente();
        }
      };
      const yaEntro = () => {
        entrada.esperaPesada = false;
        if (!p.turno) return;
        delete p.turno;
        if (detalleAntes) p.detalle = detalleAntes;
        else delete p.detalle;
        guardar(c);
      };
      let foto = null;
      let inicio = 0;
      // El render dice cuanto le falta ("Rendered 429/1302, time remaining: 2m 3s"): la pantalla lo muestra.
      const alLinea = path.basename(String(script)) === 'ensamblar.js' ? avanceDelRender(c, p) : null;
      try {
        return await procesos.correrConReintentos(
          { slug, paso: p.id, script, args: argsProceso, env, pesado: pesadoEnProcesos, senal, alLinea },
          {
            antesDeCorrer: async () => {
              if (recursos.pesada || recursos.elevenlabs) {
                soltarFilas = await colas.entrar(slug, recursos, { senal, alEsperar: esperando });
                yaEntro();
                if (!soltarFilas) return; // lo detuvieron mientras esperaba: correr() lo ve en la senal y no lanza nada
              }
              if (esRender) {
                argsProceso.splice(0, argsProceso.length, ...args);
                const n = colas.concurrenciaDeRender();
                if (n) argsProceso.push('--concurrencia', String(n));
              }
              if (recursos.kie) {
                const k = colas.cuotaKie(slug, activos.size);
                env.KIE_LIMITE_CREACIONES = String(k.limite);
                soltarKie = k.soltar;
              }
              inicio = Date.now();
              foto = null;
              if (!que.length || senal.aborted) return;
              // La foto queda en disco: si la app se cierra a mitad, la corrida siguiente cuenta tambien lo que
              // alcanzo a generar esta (gasto.js, abrirCorrida).
              const abierta = gasto.abrirCorrida(carpeta, p.id);
              foto = abierta.foto;
              inicio = Math.min(inicio, abierta.inicio);
            },
            despuesDeCorrer: (r) => {
              soltar();
              if (!foto) return;
              olvidarSaldo(); // Ajustes tiene que mostrar el saldo de despues de esta corrida, no el guardado
              try {
                gasto.cerrarCorrida(carpeta, {
                  paso: p.id,
                  comando: r.comando,
                  inicio,
                  codigo: r.codigo,
                  foto,
                  manifiesto: leerJSON(path.join(carpeta, 'manifiesto.json')),
                  que,
                  clips: opciones.clipsDe ? opciones.clipsDe(r.texto) : [],
                  salida: r.texto,
                });
              } catch (e) {
                console.error(`[conductor] ${slug}: no pude anotar el gasto de ${p.id}:`, e?.message || e);
              }
            },
            alEsperar: ({ motivo, hasta, mensaje }) => {
              p.error = { mensaje, motivo: motivo === 'conexion' ? 'conexion' : motivo, ...(hasta ? { reintentoEn: hasta } : {}) };
              c.estado = 'esperando';
              guardar(c);
            },
            alReintentar: () => {
              delete p.error;
              p.reintentos = (p.reintentos || 0) + 1;
              c.estado = 'corriendo';
              guardar(c);
            },
          }
        );
      } finally {
        soltar(); // tambien si correr() tiro un error (nada queda tomado)
        yaEntro();
      }
    },
  };
  return ctx;
}

const MENSAJE_HUERFANO = 'Quedó abierto un proceso de la vez anterior y no pude cerrarlo. Cierra la app, vuelve a abrirla y toca “Continuar”: sigue desde donde quedó.';

/** Un proceso del motor de antes sigue vivo y no se sabe que es: en pausa, sin relanzar nada (nunca dos a la vez). */
function pausarPorHuerfano(c, h) {
  console.log(`[conductor] ${c.slug}: el proceso ${h.pid} de antes sigue vivo y no pude saber que es: queda en pausa.`);
  const p = c.pasos.find((x) => x.id === c.paso) || c.pasos.find((x) => x.estado === 'corriendo');
  if (p) {
    p.estado = 'error';
    p.error = { mensaje: MENSAJE_HUERFANO, motivo: 'huerfano', detalle: `pid ${h.pid}: ${h.motivo || ''}` };
    delete p.detalle;
  }
  c.estado = 'pausado';
  c.motivo = 'huerfano';
  guardar(c);
}

// Si un proceso del motor quedo de la vez anterior (la app se cerro de golpe; vivo y cortado, o ya muerto): kie
// cuenta sus ultimos pedidos 10 s (config.js, LIMITE_CREACIONES) y el proceso nuevo empieza su cuenta en cero.
// Se espera ese rato antes de relanzar, asi entre los dos no pasan del limite.
const ESPERA_TRAS_CORTAR_MS = 11000;

// Las pausas en las que el anuncio espera algo del usuario que no es un error (el paso queda pendiente).
const PAUSAS_SIN_ERROR = new Set(['elegir-cancion']);

async function correrConductor(slug, entrada) {
  await familiasListas;
  let c = leerConductor(slug);
  if (!c) return;
  entrada.c = c;
  // "Continuar" despues de una pausa: si quedo un proceso del motor de antes, se corta primero (o no se sigue).
  if (existe(path.join(dirApp(slug), 'proceso.json'))) {
    const h = await procesos.matarHuerfano(slug);
    if (h.dudoso) return pausarPorHuerfano(c, h);
    // lo que acababa de pedir a kie sigue contando 10 s: el proceso nuevo no arranca encima
    if (h.habia) await procesos.dormir(ESPERA_TRAS_CORTAR_MS, entrada.control.signal);
  }
  const fam = FAMILIAS[c.familia];
  if (!fam) {
    c.estado = 'error';
    c.error = { mensaje: 'Este tipo de anuncio todavía no se puede producir desde la app.', detalle: `familia ${c.familia}` };
    guardar(c);
    return;
  }
  const senal = entrada.control.signal;
  const pasos = pasosDe(fam, leerJSON(path.join(dirApp(slug), 'brief.json')));

  // Un paso que aparecio en una version nueva de la app entra en su lugar, pendiente.
  c.pasos = pasos.map((def) => c.pasos.find((p) => p.id === def.id) || { id: def.id, nombre: def.nombre, estado: 'pendiente', intentos: 0 });
  c.estado = 'corriendo';
  delete c.motivo;
  delete c.error;
  guardar(c);

  for (const def of pasos) {
    const p = c.pasos.find((x) => x.id === def.id);
    if (p.estado === 'hecho' || p.estado === 'saltado') continue;
    c.paso = p.id;
    c.estado = 'corriendo';
    p.estado = 'corriendo';
    p.inicio = p.inicio || ahora();
    p.intentos = (p.intentos || 0) + 1;
    delete p.error;
    delete p.detalle;
    delete p.turno;
    entrada.limiteClaude = null;
    guardar(c);

    let r;
    try {
      r = await def.correr(contexto(c, p, entrada));
    } catch (e) {
      r = senal.aborted
        ? { cancelado: true }
        : {
            ok: false,
            error: {
              mensaje: e?.sinModoPrueba ? 'El modo prueba no está listo: no se corrió nada para no gastar.' : 'Algo salió mal en la app en este paso.',
              motivo: e?.sinModoPrueba ? 'modo-prueba' : 'app',
              detalle: String(e?.stack || e),
            },
          };
    }

    delete p.render;
    if (senal.aborted || r?.cancelado) {
      p.estado = 'pendiente';
      p.retomado = true; // lo detuviste: al seguir, no es que haya fallado
      delete p.error;
      delete p.detalle;
      delete p.turno;
      c.estado = 'pausado';
      c.motivo = 'detenido';
      guardar(c);
      return;
    }
    // El paso necesitaba a Claude y el plan se acabo por ahora: sigue solo cuando se renueve.
    if (entrada.limiteClaude && (r?.pausa || !r || r.ok === false)) return esperarAClaude(c, p, entrada.limiteClaude);
    if (r?.pausa) {
      p.estado = PAUSAS_SIN_ERROR.has(r.pausa.motivo) ? 'pendiente' : 'error';
      p.error = { mensaje: r.pausa.mensaje, motivo: r.pausa.motivo, ...(r.pausa.detalle ? { detalle: r.pausa.detalle } : {}) };
      delete p.detalle;
      delete p.turno;
      c.estado = 'pausado';
      c.motivo = r.pausa.motivo;
      guardar(c);
      return;
    }
    if (!r || r.ok === false) {
      p.estado = 'error';
      delete p.retomado;
      p.fin = ahora();
      p.error = r?.error || { mensaje: 'No pude terminar este paso.', motivo: 'otro' };
      delete p.detalle;
      delete p.turno;
      c.estado = 'error';
      guardar(c);
      return;
    }
    p.estado = r.saltado ? 'saltado' : 'hecho';
    p.fin = ahora();
    if (r.nota) p.nota = r.nota;
    else delete p.nota;
    delete p.error;
    delete p.detalle;
    delete p.turno;
    guardar(c);
  }
  c.estado = 'listo';
  c.terminado = ahora();
  guardar(c);
  // La música que se generó para este anuncio queda en la biblioteca para los próximos (no en modo prueba).
  if (!c.modoPrueba) guardarMusicaDelAnuncio(c.slug, leerJSON(path.join(TEMP, c.slug, 'app', 'brief.json')));
}

// ---------------------------------------------------------------- lo que llama la app

class ErrorDeApp extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

const mensajeDeModo = (c) =>
  c.modoPrueba
    ? 'Este anuncio se empezó en modo prueba. Abre la app en modo prueba para seguirlo (así no se gasta nada).'
    : 'Este anuncio se empezó de verdad. Abre la app sin el modo prueba para seguirlo.';

/**
 * El usuario aprobo el guion: arranca la produccion (o entra a la fila, si ya se hacen todos los que caben).
 * Devuelve el conductor. Errores con .status: 404 sin anuncio, 400 estilo que no se produce todavia, 409 si el
 * guion no esta listo o ya esta producido, 503 si la app esta terminando de arrancar (esperarFamilias() antes).
 */
export function iniciarProduccion(slug) {
  if (!slugDeLaApp(slug)) throw new ErrorDeApp('No encuentro ese anuncio.', 404);
  const brief = leerJSON(path.join(dirApp(slug), 'brief.json'));
  if (!brief) throw new ErrorDeApp('A este anuncio le falta su ficha (brief.json).', 409);
  if (!esDeEstaApp(brief)) throw new ErrorDeApp('Este anuncio es de otra ventana de la app (una de prueba): síguelo desde esa.', 409);
  if (!familiasCargadas) throw new ErrorDeApp('La app está terminando de arrancar. Vuelve a intentarlo en un segundo.', 503);
  const familia = familiaDe(brief);
  if (!familia) {
    throw new ErrorDeApp(
      brief.continuidad === true ? 'Ese estilo con continuidad todavía no se puede producir desde la app: muy pronto.' : 'Ese estilo todavía no se puede producir desde la app: muy pronto.',
      400
    );
  }
  // Los cantados arrancan con la letra aprobada: su manifiesto se escribe en la produccion, despues de la cancion.
  const fam = FAMILIAS[familia];
  if (fam.ARRANCA_SIN_MANIFIESTO && typeof fam.faltaParaProducir === 'function') {
    const falta = fam.faltaParaProducir(path.join(TEMP, slug), brief);
    if (falta && !leerConductor(slug)) throw new ErrorDeApp(falta, 409);
  } else if (!existe(path.join(TEMP, slug, 'manifiesto.json')) || !existe(path.join(dirApp(slug), 'guion.json'))) {
    throw new ErrorDeApp('El guion todavía no está listo.', 409);
  }
  if (!tomarElMando()) throw new ErrorDeApp(SIN_MANDO, 409);
  // sesion.json es de la sesion de guion (anuncios-nuevos.js): escribiendo | cambiando | listo | error | bloqueado |
  // aprobado. Sin sesion.json (un anuncio armado a mano) basta con el guion y el manifiesto.
  const sesion = leerJSON(path.join(dirApp(slug), 'sesion.json'));
  if (sesion && /escrib|cambi/i.test(String(sesion.estado || ''))) throw new ErrorDeApp('La IA todavía está escribiendo el guion. Espera a que termine.', 409);
  if (sesion && !['listo', 'aprobado'].includes(sesion.estado) && !leerConductor(slug)) throw new ErrorDeApp('El guion no está listo: no se puede producir todavía.', 409);

  const c = leerConductor(slug);
  if (c) {
    if (c.estado === 'listo') throw new ErrorDeApp('Este anuncio ya está producido.', 409);
    if (activos.has(slug) || fila.includes(slug)) return c;
    return continuar(slug);
  }
  const nuevo = crearConductor(slug, familia, brief);
  guardar(nuevo);
  encolar(slug);
  return leerConductor(slug);
}

/** "Continuar": reintenta el paso que fallo, sigue despues de una pausa, o corta una espera y prueba ya. */
export function continuar(slug) {
  if (!slugDeLaApp(slug)) throw new ErrorDeApp('No encuentro ese anuncio.', 404);
  const c = leerConductor(slug);
  if (!c) throw new ErrorDeApp('Este anuncio todavía no empezó a producirse.', 404);
  if (c.estado === 'listo') return c;
  if (!esDeEstaApp(leerJSON(path.join(dirApp(slug), 'brief.json')))) throw new ErrorDeApp('Este anuncio es de otra ventana de la app (una de prueba): síguelo desde esa.', 409);
  if (Boolean(c.modoPrueba) !== procesos.modoPrueba()) throw new ErrorDeApp(mensajeDeModo(c), 409);
  // Sin el si del usuario no se produce nada (igual que retomarTodo): un guion sin aprobar no sigue, aunque haya conductor.
  const sesion = leerJSON(path.join(dirApp(slug), 'sesion.json'));
  if (sesion && sesion.estado !== 'aprobado') throw new ErrorDeApp('Primero aprueba el guion: ábrelo y dale a producir.', 409);
  if (!tomarElMando()) throw new ErrorDeApp(SIN_MANDO, 409);
  if (activos.has(slug)) {
    procesos.despertar(slug); // si estaba esperando un reintento o la conexion, prueba ya
    return leerConductor(slug);
  }
  if (fila.includes(slug)) return c;
  // Esperaba que se renovara el plan de Claude: el usuario quiere probar ya (si sigue el limite, vuelve a esperar).
  if (retomasClaude.has(slug) || c.motivo === MOTIVO_CLAUDE) {
    cancelarRetomaClaude(slug);
    colas.reanudarClaude();
  }
  for (const p of c.pasos) {
    if (p.estado === 'error' || p.estado === 'corriendo') p.estado = 'pendiente';
    if (p.estado === 'pendiente') {
      delete p.error;
      delete p.detalle;
      delete p.turno;
    }
  }
  c.estado = 'esperando';
  delete c.motivo;
  delete c.error;
  guardar(c);
  encolar(slug);
  return leerConductor(slug);
}

/** Corta lo que este corriendo. Queda "pausado"; "Continuar" sigue desde el mismo paso (sin pagar dos veces). */
export async function detener(slug) {
  if (!slugDeLaApp(slug)) throw new ErrorDeApp('No encuentro ese anuncio.', 404);
  if (!tomarElMando()) throw new ErrorDeApp(SIN_MANDO, 409);
  const i = fila.indexOf(slug);
  if (i !== -1 || retomasClaude.has(slug)) {
    if (i !== -1) fila.splice(i, 1);
    cancelarRetomaClaude(slug);
    const c = leerConductor(slug);
    if (c && c.estado !== 'listo') {
      for (const p of c.pasos) if (p.error?.motivo === MOTIVO_CLAUDE) delete p.error;
      c.estado = 'pausado';
      c.motivo = 'detenido';
      guardar(c);
    }
    return leerConductor(slug);
  }
  const entrada = activos.get(slug);
  if (!entrada) {
    // No corre en esta app, pero puede estar por arrancar: al abrirla, retomarTodo lo deja "esperando" y lo encola
    // unos segundos despues. Queda en pausa, asi no arranca solo despues de "Detener".
    const c = leerConductor(slug);
    if (c && (c.estado === 'esperando' || c.estado === 'corriendo')) {
      for (const p of c.pasos) {
        if (p.estado !== 'corriendo') continue;
        p.estado = 'pendiente';
        p.retomado = true;
      }
      c.estado = 'pausado';
      c.motivo = 'detenido';
      guardar(c);
    }
    return leerConductor(slug);
  }
  entrada.control.abort();
  await procesos.cancelar(slug);
  await entrada.promesa;
  return leerConductor(slug);
}

/**
 * Al abrir la app: cada anuncio que estaba en marcha sigue en su paso, en el orden en que se aprobaron (entran
 * los que caben; los demas, a la fila). Antes se corta el proceso del motor que haya quedado vivo de la vez
 * anterior. Un anuncio empezado en el otro modo (prueba / real) no se toca: queda en pausa con el aviso. Uno cuyo
 * guion no esta aprobado (sesion.json) tampoco arranca solo: queda en pausa. Uno que
 * esperaba que se renovara el plan de Claude sigue esperando hasta esa hora. Devuelve los slugs retomados.
 * (`solo`: para las pruebas, (slug) => true con los anuncios que se pueden tocar.)
 */
export async function retomarTodo({ solo = null } = {}) {
  await familiasListas;
  if (!tomarElMando()) {
    console.log('  [conductor] Otra ventana de la app tiene el mando de la producción: esta no retoma nada.');
    return [];
  }
  const fecha = (c) => Date.parse(c.aprobado || c.creado || c.actualizado || 0) || 0;
  // cada app retoma los suyos: la de siempre no toca los de una app de prueba (PUERTO=…), ni al reves
  const deEstaApp = (s) => esDeEstaApp(leerJSON(path.join(dirApp(s), 'brief.json')));
  const conductores = listar(TEMP)
    .filter((s) => s !== '_productos' && segmentoValido(s) && existe(rutaConductor(s)) && deEstaApp(s) && (!solo || solo(s)))
    .map((s) => leerConductor(s))
    .filter(Boolean)
    .sort((a, b) => fecha(a) - fecha(b));
  const retomados = [];
  const aLaFila = [];
  let ultimoCorte = 0;
  // los navegadores de un render que quedaron vivos al cerrarse la app de golpe (su padre ya no esta)
  await procesos.cerrarNavegadoresSueltos().catch(() => 0);
  for (const { slug } of conductores) {
    // Un proceso del motor que quedo vivo (la app se cerro de golpe) se corta siempre: nadie lo esta mirando.
    let h = null;
    if (existe(path.join(dirApp(slug), 'proceso.json'))) {
      h = await procesos.matarHuerfano(slug);
      // vivo o no (al cerrarse la app de golpe suele morir enseguida), estaba pidiendo cosas hasta hace un momento
      if (h.habia && !h.dudoso) ultimoCorte = Date.now();
      if (h.matado) console.log(`[conductor] ${slug}: corte el proceso ${h.pid} que quedo de antes (${h.motivo || 'huerfano'}).`);
    }
    // Se lee otra vez despues de las esperas: mientras tanto pudiste tocar "Detener" (y eso no se pisa).
    const c = leerConductor(slug);
    if (!c) continue;
    if (h?.dudoso && (c.estado === 'corriendo' || c.estado === 'esperando')) {
      pausarPorHuerfano(c, h);
      continue;
    }
    if (c.estado !== 'corriendo' && c.estado !== 'esperando') continue;
    if (activos.has(c.slug) || fila.includes(c.slug)) continue;
    // Sin el si del usuario no se produce nada: si el guion de este anuncio no esta aprobado (sesion.json, de la
    // sesion de guion), su conductor no lo escribio la produccion. Queda en pausa en vez de arrancar solo.
    const sesion = leerJSON(path.join(dirApp(c.slug), 'sesion.json'));
    if (sesion && sesion.estado !== 'aprobado') {
      console.log(`[conductor] ${c.slug}: el guion no está aprobado: no se retoma solo (queda en pausa).`);
      for (const p of c.pasos || []) if (p.estado === 'corriendo') p.estado = 'pendiente';
      c.estado = 'pausado';
      c.motivo = 'detenido';
      guardar(c);
      continue;
    }
    if (Boolean(c.modoPrueba) !== procesos.modoPrueba()) {
      const p = c.pasos.find((x) => x.id === c.paso) || c.pasos.find((x) => x.estado === 'corriendo');
      if (p) {
        if (p.estado === 'corriendo') p.estado = 'pendiente';
        p.error = { mensaje: mensajeDeModo(c), motivo: 'modo' };
      }
      c.estado = 'pausado';
      c.motivo = 'modo';
      guardar(c);
      continue;
    }
    for (const p of c.pasos) {
      if (p.estado === 'corriendo') {
        p.estado = 'pendiente';
        p.retomado = true; // no fallo: se cerro la app (la pantalla no dice "el anterior fallo")
      }
      delete p.detalle;
      delete p.turno;
      delete p.render;
    }
    if (c.motivo === MOTIVO_CLAUDE) {
      // la hora a la que se renovaba el plan quedo en el paso que esperaba: la fila de Claude vuelve a la pausa
      const hora = c.pasos.find((p) => p.error?.motivo === MOTIVO_CLAUDE)?.error?.reintentoEn;
      const pausa = Date.parse(hora || '') > Date.now() ? colas.pausarClaude({ hasta: hora }) : colas.pausaDeClaude();
      if (pausa) {
        c.estado = 'esperando';
        guardar(c);
        programarRetomaClaude(c.slug, pausa.hasta);
        retomados.push(c.slug);
        continue;
      }
      for (const p of c.pasos) if (p.error?.motivo === MOTIVO_CLAUDE) delete p.error;
      delete c.motivo;
    }
    c.estado = 'esperando';
    guardar(c);
    aLaFila.push(c.slug);
    retomados.push(c.slug);
  }
  // Todos juntos y despues de cortar los procesos de antes: asi cada uno arranca sabiendo cuantos van a la vez
  // (si el primero arrancara mientras se revisan los demas, se llevaria todo el limite de kie para el solo). Y si
  // se corto alguno, 10 s despues: lo que acababa de pedir a kie sigue contando en su limite ese rato.
  const falta = ultimoCorte ? ultimoCorte + ESPERA_TRAS_CORTAR_MS - Date.now() : 0;
  if (falta > 0) await new Promise((r) => setTimeout(r, falta));
  // (si mientras tanto tocaste "Detener", ya no esta "esperando": no arranca)
  for (const s of aLaFila) if (leerConductor(s)?.estado === 'esperando') encolar(s);
  return retomados;
}

/** Lo que esta pasando en la app ahora (para la pantalla, la fila y las pruebas). */
export const estadoDeLaFila = () => ({
  activos: [...activos.keys()],
  fila: [...fila],
  maximo: colas.anunciosALaVez(),
  tope: MAX_A_LA_VEZ,
  esperandoAClaude: [...retomasClaude.keys()],
  procesos: procesos.estadoDeLaFila(),
});

/** Lo mismo con las filas compartidas (Claude, kie, ElevenLabs, lo pesado): GET /api/produccion/fila. */
export async function estadoCompleto() {
  return { ...estadoDeLaFila(), filas: await colas.estadoDeLasFilas() };
}

export { ErrorDeApp };

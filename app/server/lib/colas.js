// Las filas de la app: lo que comparten los anuncios que se producen a la vez (plan, etapa 3).
//
//   anunciosALaVez()     cuantos anuncios se producen a la vez: lo que elegiste en Ajustes › Tu PC, o con
//                        "Automatico" lo que aguanta tu PC (la misma cuenta que muestra esa pantalla)
//   pesadosALaVez()      lo pesado de tu PC (el render y el recorte del host): de a 1; de a 2 con 32 GB o mas
//   recursosDe(script, args, opciones)   que filas necesita un comando del motor
//   entrar(slug, recursos, { senal, alEsperar })   espera su lugar en las filas -> soltar() (null si lo cortaron)
//   cuotaKie(slug, anunciosActivos, { tope })   su parte del limite de pedidos a kie -> { limite, soltar() }
//   claudeEnFila(modulo, { alLimite, alPlanSinCodex })   el lanzador de la IA con la pausa por limite de uso
//   lanzarSesion(o)                      lo mismo con la IA elegida (motor-ia.js), para quien no tiene el modulo a
//                                        mano (la sesion de guion y la de la ficha)
//   pausaDeClaude(motor) · pausarClaude({ reinicio, hasta, motor }) · reanudarClaude(motor)   una pausa por IA
//                                        ('claude' | 'codex'; sin motor, la de la IA elegida)
//   estadoDeLasFilas()
//
// Las cuatro filas:
//   - La IA (Claude o ChatGPT): 2 sesiones a la vez (eso ya lo cuenta ia/fila.js, MAX_SESIONES, para TODAS las
//     sesiones de las dos IA: guion, ficha y produccion). Aca va la pausa, una por IA: al primer aviso de limite de
//     uso la fila de ESA IA queda en pausa hasta que se renueva el plan (la hora que dio la IA; si no la dio, se
//     vuelve a probar a los 30 min). Mientras tanto ninguna sesion nueva se abre con esa IA: vuelve enseguida con
//     { limite: true } sin gastar un turno. Si se elige la otra IA, esa no esta en pausa y sigue.
//     Al cerrar y abrir la app, la hora vuelve del conductor.json de los anuncios que esperaban (retomarTodo).
//   - kie: un proceso del motor por anuncio (procesos.js no deja correr dos sobre la misma carpeta) y cada uno
//     con su parte de los 18 pedidos cada 10 s (KIE_LIMITE_CREACIONES: el limite del motor es por proceso,
//     config.js:581, y producir lo parte otra vez en dos, producir.js:425-427). La parte es 18 / anuncios
//     activos, sin pasar de lo que dejan libre los procesos que ya estan corriendo (minimo 2: kie de verdad
//     admite 20, y el motor espera solo ante un 429).
//   - ElevenLabs: 2 procesos a la vez (la voz y lo que transcribe Scribe).
//   - Pesada (render, recorte del host): de a 1, o de a 2 con 32 GB de memoria o mas (Tu PC). El recorte del
//     host va SOLO: recortar-host.js se niega a correr con un render al lado (y hay uno solo en toda la PC).
//     Nunca dos procesos pesados del mismo anuncio a la vez (ensamblar escribe .props-remotion.json dentro de
//     la carpeta del anuncio, ensamblar.js:674).
//
// Solo pruebas: ANUNCIOS_A_LA_VEZ=N (anuncios a la vez, pisa lo de Ajustes) y ANUNCIOS_PESADOS_A_LA_VEZ=N.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RAIZ, TEMP } from './rutas.js';
import { leerConfig } from './config.js';
import { motorActual, nombreIA } from './motor-ia.js';

const GB = 1024 ** 3;
/** Lo mas que la app hace a la vez (el selector de Tu PC va de 1 a esto). */
export const TOPE_A_LA_VEZ = 6;
export const LIMITE_KIE = 18; // createTask cada 10 s por cuenta, con margen (kie admite 20)
const MINIMO_KIE = 2;

const ahora = () => new Date().toISOString();
const entero = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 ? n : null;
};

// ---------------------------------------------------------------- cuantos a la vez (Tu PC)

const memoriaGB = () => Math.round(os.totalmem() / GB);
const nucleos = () => (typeof os.availableParallelism === 'function' ? os.availableParallelism() : (os.cpus() || []).length);

// Lo que ocupa en promedio un anuncio en temp/ (para saber cuantos caben en el disco). Se mide de fondo cada
// 10 min, como "Tu PC" (rutas/ajustes.js); mientras no se sabe, se decide solo con la memoria y los nucleos.
let promedioAnuncio = null;
let midiendo = false;
let medidoEn = 0;

async function tamanoCarpeta(dir, profundidad = 0) {
  if (profundidad > 6) return 0;
  let total = 0;
  let entradas = [];
  try {
    entradas = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entradas) {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) total += await tamanoCarpeta(ruta, profundidad + 1);
    else if (e.isFile()) {
      try {
        total += (await fs.promises.stat(ruta)).size;
      } catch {
        /* se borro mientras se media */
      }
    }
  }
  return total;
}

function medirAnunciosDeFondo() {
  if (midiendo || Date.now() - medidoEn < 10 * 60000) return;
  midiendo = true;
  (async () => {
    const { slugsDeAnuncios } = await import('./anuncios.js');
    const slugs = slugsDeAnuncios();
    let total = 0;
    for (const s of slugs) total += await tamanoCarpeta(path.join(TEMP, s));
    promedioAnuncio = slugs.length ? Math.round(total / slugs.length) : null;
  })()
    .catch(() => {})
    .finally(() => {
      midiendo = false;
      medidoEn = Date.now();
    });
}

function cabenEnElDisco() {
  medirAnunciosDeFondo();
  if (!promedioAnuncio) return null;
  try {
    const s = fs.statfsSync(RAIZ);
    return Math.floor((s.bavail * s.bsize) / (promedioAnuncio * 1.5));
  } catch {
    return null;
  }
}

/** Lo que aguanta esta PC: la misma cuenta que recomendar() de rutas/ajustes.js (memoria, nucleos y disco). */
export function recomendadoPorLaPC() {
  const m = memoriaGB();
  const c = nucleos();
  let n = 1;
  if (m >= 32 && c >= 12) n = 5;
  else if (m >= 16 && c >= 8) n = 3;
  else if (m >= 12) n = 2;
  const caben = cabenEnElDisco();
  if (caben !== null && caben < n) n = Math.max(1, caben);
  return n;
}

/** Cuantos anuncios se producen a la vez ahora: Ajustes › Tu PC ("auto" = lo que aguanta la PC). */
export function anunciosALaVez() {
  const forzado = entero(process.env.ANUNCIOS_A_LA_VEZ);
  if (forzado) return Math.min(TOPE_A_LA_VEZ, forzado);
  let elegido = null;
  try {
    elegido = leerConfig().preferencias?.aLaVez;
  } catch {
    /* sin config.json: automatico */
  }
  const n = entero(elegido);
  if (n) return Math.min(TOPE_A_LA_VEZ, n);
  return Math.min(TOPE_A_LA_VEZ, recomendadoPorLaPC());
}

/** Memoria libre que hace falta para que entre un segundo render al lado del primero. */
const LIBRE_PARA_OTRO_RENDER_GB = 6;

/**
 * Cuantos procesos pesados a la vez: 1; 2 si la PC tiene 32 GB de memoria o mas (lo que dice Tu PC) y en este
 * momento le quedan libres al menos 6 GB. Se mira cada vez que alguien pide su lugar: con la PC ocupada (otros
 * programas, otro render grande) un segundo render se cae porque su navegador no arranca a tiempo.
 */
export function pesadosALaVez() {
  const forzado = entero(process.env.ANUNCIOS_PESADOS_A_LA_VEZ);
  if (forzado) return Math.min(2, forzado);
  if (memoriaGB() < 32) return 1;
  return os.freemem() / GB >= LIBRE_PARA_OTRO_RENDER_GB ? 2 : 1;
}

// ---------------------------------------------------------------- que necesita cada comando

const PESADOS = new Set(['ensamblar.js', 'recortar-host.js', 'exportar-edicion.js']);
const SOLOS = new Set(['recortar-host.js']); // no corre con ningun otro pesado al lado
// Los que hablan con ElevenLabs (la voz o Scribe) por si quien los lanza no dijo `que`.
const DE_ELEVENLABS = new Set(['generar-audio.js', 'revisar-voces.js', 'lineas-habladas.js', 'subtitulos-dialogo.js', 'cortar-cola-ugc.js']);
// Los que crean tareas en kie (imagenes, videos, Suno).
const DE_KIE = new Set(['producir.js', 'generar-imagenes.js', 'generar-videos.js', 'generar-musica.js', 'generar-cancion.js', 'suno-retomable.js', 'test-imagen.js', 'test-imagen-crochet.js', 'generar-imagen-ads.js']);
const QUE_KIE = new Set(['imagenes', 'videos', 'musica', 'cancion']);
const QUE_ELEVENLABS = new Set(['voz', 'scribe']);
// Con estas banderas el comando solo mira o calcula: no pide nada ni arma nada.
const SOLO_MIRA = new Set(['--solo-plan', '--verificar', '--contexto']);

/**
 * Las filas que necesita un comando del motor: { pesada, solo, elevenlabs, kie }.
 *   opciones.pesado (render, control final), opciones.solo (que no corra nada pesado al lado),
 *   opciones.elevenlabs y opciones.kie (true/false: habla o no con ese servicio) y opciones.que (lo que cobra: 'imagenes',
 *   'videos', 'musica', 'cancion', 'voz', 'scribe') mandan; el nombre del script completa lo que no se dijo.
 */
export function recursosDe(script, args = [], opciones = {}) {
  const nombre = path.basename(String(script || '').replace(/\\/g, '/'));
  const que = Array.isArray(opciones.que) ? opciones.que : [];
  const soloMira = (args || []).some((a) => SOLO_MIRA.has(String(a)));
  const pesada = !soloMira && (Boolean(opciones.pesado) || Boolean(opciones.solo) || PESADOS.has(nombre));
  return {
    pesada,
    solo: pesada && (Boolean(opciones.solo) || SOLOS.has(nombre)),
    elevenlabs: !soloMira && opciones.elevenlabs !== false && (opciones.elevenlabs === true || que.some((q) => QUE_ELEVENLABS.has(q)) || DE_ELEVENLABS.has(nombre)),
    kie: !soloMira && opciones.kie !== false && (opciones.kie === true || que.some((q) => QUE_KIE.has(q)) || DE_KIE.has(nombre)),
  };
}

// ---------------------------------------------------------------- una fila con lugares

class Fila {
  /**
   * @param {string} nombre
   * @param {() => number} capacidad   cuantos lugares hay (se mira cada vez: Tu PC puede cambiar)
   * @param {{ unoPorAnuncio?: boolean }} opciones
   */
  constructor(nombre, capacidad, { unoPorAnuncio = false } = {}) {
    this.nombre = nombre;
    this.capacidad = capacidad;
    this.unoPorAnuncio = unoPorAnuncio;
    this.ocupados = []; // { slug, solo, desde }
    this.esperando = []; // { slug, solo, desde, entrar }
  }

  cabe(x) {
    if (this.ocupados.some((o) => o.solo)) return false;
    if (x.solo) return this.ocupados.length === 0;
    if (this.unoPorAnuncio && x.slug && this.ocupados.some((o) => o.slug === x.slug)) return false;
    return this.ocupados.length < Math.max(1, this.capacidad());
  }

  /** Deja pasar a los que esperan, en orden. Uno que va SOLO frena a los de atras (si no, nunca le tocaria). */
  revisar() {
    for (const x of [...this.esperando]) {
      if (this.cabe(x)) {
        this.esperando.splice(this.esperando.indexOf(x), 1);
        x.entrar();
      } else if (x.solo) break;
    }
  }

  /** Espera un lugar. Devuelve soltar() o null si `senal` lo corto mientras esperaba. */
  pedir(slug, { solo = false, senal = null, alEsperar = null } = {}) {
    return new Promise((resolve) => {
      if (senal?.aborted) return resolve(null);
      const x = { slug, solo, desde: Date.now(), entro: false };
      const ocupar = () => {
        const lugar = { slug, solo, desde: Date.now() };
        this.ocupados.push(lugar);
        let suelto = false;
        return () => {
          if (suelto) return;
          suelto = true;
          const i = this.ocupados.indexOf(lugar);
          if (i !== -1) this.ocupados.splice(i, 1);
          this.revisar();
        };
      };
      const alAbortar = () => {
        const i = this.esperando.indexOf(x);
        if (i !== -1) {
          this.esperando.splice(i, 1);
          this.revisar();
          resolve(null);
        }
      };
      x.entrar = () => {
        x.entro = true;
        senal?.removeEventListener('abort', alAbortar);
        resolve(ocupar());
      };
      this.esperando.push(x);
      senal?.addEventListener('abort', alAbortar, { once: true });
      this.revisar(); // si hay lugar (y nadie que vaya solo esperando delante), entra ya
      if (x.entro) return;
      try {
        alEsperar?.({ fila: this.nombre, ocupados: this.ocupados.map((o) => o.slug) });
      } catch {
        /* quien escucha no frena la fila */
      }
    });
  }

  estado() {
    return {
      lugares: Math.max(1, this.capacidad()),
      ocupados: this.ocupados.map((o) => ({ slug: o.slug, solo: o.solo || undefined, desde: new Date(o.desde).toISOString() })),
      esperando: this.esperando.map((x) => ({ slug: x.slug, solo: x.solo || undefined, desde: new Date(x.desde).toISOString() })),
    };
  }
}

const filaPesada = new Fila('pesada', pesadosALaVez, { unoPorAnuncio: true });
const filaElevenLabs = new Fila('elevenlabs', () => 2);

/** Cuantos procesos pesados estan corriendo ahora (de todos los anuncios). */
export const pesadosCorriendo = () => filaPesada.ocupados.length;

/**
 * Con dos renders a la vez, cada uno con la mitad de los fotogramas en paralelo que usaria solo (Remotion usa la
 * mitad de los hilos, hasta 8: dos con eso llenan todos los hilos y se traban esperando los cuadros). null si va
 * solo (ensamblar decide con la memoria libre, como siempre).
 */
export function concurrenciaDeRender() {
  if (pesadosCorriendo() < 2) return null;
  const techo = Math.round(Math.min(8, Math.max(1, (os.cpus() || []).length / 2)));
  return Math.max(1, Math.floor(techo / 2));
}

/** Cada tanto: si Tu PC cambio (o la memoria), los que esperan y ahora caben, pasan. */
export function revisarFilas() {
  filaPesada.revisar();
  filaElevenLabs.revisar();
}

/**
 * Espera el lugar de un comando en las filas que necesita (recursosDe). Siempre en el mismo orden (ElevenLabs y
 * despues la pesada), asi dos anuncios nunca se traban esperandose. Devuelve soltar() (suelta todo) o null si
 * `senal` lo corto mientras esperaba (no queda nada tomado).
 *   alEsperar({ fila, ocupados })   si tiene que esperar (para decirlo en la pantalla)
 */
export async function entrar(slug, recursos, { senal = null, alEsperar = null } = {}) {
  const tomados = [];
  const soltarTodo = () => {
    while (tomados.length) tomados.pop()();
  };
  if (recursos?.elevenlabs) {
    const s = await filaElevenLabs.pedir(slug, { senal, alEsperar });
    if (!s) return null;
    tomados.push(s);
  }
  if (recursos?.pesada) {
    const s = await filaPesada.pedir(slug, { solo: Boolean(recursos.solo), senal, alEsperar });
    if (!s) {
      soltarTodo();
      return null;
    }
    tomados.push(s);
  }
  return soltarTodo;
}

// ---------------------------------------------------------------- kie: la parte de cada proceso

const kieEnCurso = new Map(); // id -> { slug, limite, desde }
let ultimoKie = 0;

/**
 * La parte del limite de pedidos a kie para un proceso nuevo de `slug`: 18 / anuncios activos, sin pasar de lo
 * que dejan libre los que ya corren (que siguen con la parte que les toco al arrancar). Minimo 2.
 * Con `tope` (los lotes de anuncios de imagen: 6), nunca mas que eso. Sin tope, la misma cuenta de siempre.
 * Devuelve { limite, soltar() }: soltar al terminar el proceso.
 */
export function cuotaKie(slug, anunciosActivos = 1, { tope = null } = {}) {
  const n = Math.max(1, Number(anunciosActivos) || 1);
  const justo = Math.floor(LIMITE_KIE / n);
  let otros = 0;
  for (const x of kieEnCurso.values()) if (x.slug !== slug) otros += x.limite;
  const limite = Math.max(MINIMO_KIE, Math.min(justo, LIMITE_KIE - otros, Number(tope) > 0 ? Number(tope) : Infinity));
  const id = ++ultimoKie;
  kieEnCurso.set(id, { slug, limite, desde: Date.now() });
  return { limite, soltar: () => kieEnCurso.delete(id) };
}

// ---------------------------------------------------------------- la IA: la pausa por limite de uso, una por IA

const SIN_HORA_MS = 30 * 60000; // sin hora de renovacion: se vuelve a probar a los 30 min
const MARGEN_MS = 60000; // a la hora que dijo la IA, un minuto mas
const TOPE_MS = 8 * 24 * 3600000; // un limite semanal puede ser de dias, no mas

// En memoria: lo que sobrevive a cerrar la app es la hora que quedo en el conductor.json de cada anuncio que
// esperaba (pasos[].error.reintentoEn, con su IA en pasos[].error.motor), y retomarTodo() la vuelve a poner con
// pausarClaude({ hasta, motor }). Cada IA tiene su pausa: el limite de una no frena a la otra.
const pausas = { claude: null, codex: null }; // motor -> { desde, hasta, conHora, motor } | null

// sin IA elegida (o una que no se conoce) cuenta como Claude, la de siempre
const motorDePausa = (motor) => (motor === 'codex' ? 'codex' : 'claude');

/** La pausa de la fila de esa IA (por defecto, la elegida): { desde, hasta, conHora, motor } o null. */
export function pausaDeClaude(motor = motorActual()) {
  const m = motorDePausa(motor);
  const p = pausas[m];
  if (!p) return null;
  if (Date.now() >= Date.parse(p.hasta)) {
    pausas[m] = null;
    return null;
  }
  return { ...p };
}

/**
 * El primer aviso de limite: la fila de esa IA queda en pausa hasta `reinicio` (la hora que dio la IA, mas un
 * minuto) o 30 min si no se sabe. Con `hasta`, esa hora exacta (al abrir la app, la que habia quedado). `motor` es
 * la IA que de verdad llego al limite (por defecto, la elegida).
 */
export function pausarClaude({ reinicio = null, hasta: exacta = null, motor = motorActual() } = {}) {
  const m = motorDePausa(motor);
  const tExacta = Date.parse(exacta || '');
  const t = Date.parse(reinicio || '');
  const conHora = Number.isFinite(tExacta) || (Number.isFinite(t) && t > Date.now());
  const hasta = Math.min(Number.isFinite(tExacta) ? tExacta : conHora ? t + MARGEN_MS : Date.now() + SIN_HORA_MS, Date.now() + TOPE_MS);
  if (hasta <= Date.now()) return pausaDeClaude(m);
  const antes = pausaDeClaude(m);
  // si ya estaba en pausa, gana la hora mas tardia (otra sesion pudo traer la del limite semanal)
  if (antes && Date.parse(antes.hasta) >= hasta) return antes;
  pausas[m] = { desde: antes?.desde || ahora(), hasta: new Date(hasta).toISOString(), conHora, motor: m };
  if (!antes) console.log(`[colas] ${nombreIA(m)} llegó al límite de uso: su fila queda en pausa hasta ${pausas[m].hasta}.`);
  return { ...pausas[m] };
}

/** Saca la pausa de esa IA (por defecto, la elegida): "Continuar" del usuario (probar ya) o se eligio otra IA. */
export function reanudarClaude(motor = motorActual()) {
  pausas[motorDePausa(motor)] = null;
}

export function horaDe(iso) {
  const d = new Date(iso || '');
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

const mensajeDePausa = (p, motor = p?.motor) => `Se acabó por ahora el uso de tu plan de ${nombreIA(motorDePausa(motor))}. Toca "Reintentar" cuando se renueve${p?.conHora ? ` (a las ${horaDe(p.hasta)})` : ''}: lo ya hecho no se repite.`;

/**
 * El lanzador de la IA (motor-ia.js, o el de las pruebas) con la pausa de la fila: con la IA de antes de lanzar en
 * pausa no abre ninguna sesion y devuelve enseguida { ok: false, limite: true, reinicio, enPausa: true }; una sesion
 * que vuelve con el aviso de limite pone la pausa de la IA que trabajo (r.motor). alLimite(pausa) avisa a quien lanzo
 * la sesion (el conductor la retoma sola despues). Un plan sin Codex (r.planSinCodex) no es un limite que se renueve
 * solo: no pausa nada, y alPlanSinCodex(r) avisa (el conductor no lo retoma solo).
 */
export function claudeEnFila(modulo, { alLimite = null, alPlanSinCodex = null } = {}) {
  if (!modulo || typeof modulo.lanzarSesion !== 'function') return modulo;
  const avisar = (fn, x) => {
    try {
      fn?.(x);
    } catch {
      /* quien escucha no frena */
    }
  };
  return {
    ...modulo,
    async lanzarSesion(o) {
      // la IA de antes de lanzar (un modulo de prueba sin motorActual cuenta como Claude)
      const motorAntes = modulo.motorActual?.() || 'claude';
      const enPausa = pausaDeClaude(motorAntes);
      if (enPausa) {
        avisar(alLimite, enPausa);
        try {
          o?.alProgreso?.(`${nombreIA(motorDePausa(motorAntes))} está en pausa hasta que se renueve tu plan`);
        } catch {
          /* idem */
        }
        return { ok: false, limite: true, enPausa: true, reinicio: enPausa.hasta, error: mensajeDePausa(enPausa), sesion: o?.uuid, modo: 'pausa', turnos: 0, costo: 0, uso: null, duracionMs: 0, denegados: [], init: null, frases: [], motor: enPausa.motor };
      }
      const r = await modulo.lanzarSesion(o);
      if (r?.planSinCodex) avisar(alPlanSinCodex, r);
      // la pausa va a la IA que de verdad trabajo: si mientras tanto se eligio otra, no la frena
      else if (r?.limite) avisar(alLimite, pausarClaude({ reinicio: r.reinicio, motor: r.motor || motorAntes }));
      return r;
    },
  };
}

/** lanzarSesion de la IA elegida (motor-ia.js) con la pausa de la fila (para la sesion de guion y la de la ficha). */
export async function lanzarSesion(o) {
  const m = await import('./motor-ia.js');
  return claudeEnFila(m).lanzarSesion(o);
}

// ---------------------------------------------------------------- lo que se ve

/**
 * Para GET /api/produccion/fila y las pruebas (sin precios ni rutas). `claude` es la fila de la IA (las sesiones las
 * comparten las dos) con la pausa de la elegida; `pausas`, la de cada IA.
 */
export async function estadoDeLasFilas() {
  let claude = null;
  try {
    const m = await import('./motor-ia.js');
    claude = typeof m.sesionesEnCurso === 'function' ? m.sesionesEnCurso() : null;
  } catch {
    /* sin motor-ia.js */
  }
  return {
    anunciosALaVez: anunciosALaVez(),
    tope: TOPE_A_LA_VEZ,
    pesada: filaPesada.estado(),
    elevenlabs: filaElevenLabs.estado(),
    kie: { limite: LIMITE_KIE, procesos: [...kieEnCurso.values()].map((x) => ({ slug: x.slug, limite: x.limite })) },
    claude: { ...(claude || {}), pausa: pausaDeClaude() },
    pausas: { claude: pausaDeClaude('claude'), codex: pausaDeClaude('codex') },
  };
}

// La produccion de un anuncio de voz en off CON EL EFECTO CONTINUIDAD (sin cortes), paso por paso.
//
// Cada video va de la imagen de una toma a la imagen de la siguiente y la IA del video hace el paso entre las dos
// escenas. Va encima de los 6 estilos de voz en off (claymation, crochet, zack-d-films, estilo-pixar, skeleton,
// estilo-lego) cuando el brief trae continuidad: true. La secuencia sale de COMO-PRODUCIR (seccion 13), de la skill
// anuncios-continuidad y del plan (etapa 2), y reemplaza la produccion del estilo:
//
//   validar · preparar-cadena · saldo · voz · imagenes · revision-imagenes · duraciones · pares · videos ·
//   revision-cadena · voces · musica · montaje · render · control-final · informe
//
// Misma interfaz que voz-en-off.js: { id, nombre, correr(ctx) } y el conductor los corre en orden. Un paso devuelve
// { ok, nota? } | { saltado, nota } | { pausa: { motivo, mensaje } } | { ok: false, error } | { cancelado }.
//
// Lo que cobra lo corre siempre la app. Claude (la cuenta del usuario) trabaja en tres momentos y NUNCA corre nada
// (sin terminal): mira las imagenes antes de pagar los videos (tarea-continuidad-imagenes.md), escribe el prompt de
// cada paso mirando sus dos imagenes (tarea-continuidad-pares.md: la app ya corrio --pares y le deja la salida) y
// revisa la cadena terminada (tarea-continuidad-cadena.md: la app ya saco los cuadros con extraer-frames). Lo que
// escribe es un archivo en app/ que la app revisa y recien despues copia al manifiesto.
//
// La voz va antes que las imagenes (en la skill es al reves solo porque ahi la voz se elige a mano): asi el anuncio
// que no admite continuidad ("No se puede" de --preparar) sigue por el camino normal de voz en off, con los pasos
// de voz-en-off.js (ventanas, imagenes-y-videos y su revision), y el informe lo dice.
//
// Todo retoma desde donde quedo, sin pagar dos veces: cada comando del motor no repite lo que ya existe y retoma lo
// que sigue en kie; las sesiones de Claude dejan su archivo en disco.
// Todo al primer intento (decision de Diego, 2026-11-09): las dos revisiones (las imagenes y la cadena) NO rehacen
// nada. Lo que ven queda como un aviso en esa pieza (app/avisos.json, lib/avisos.js: img:toma-N-inicial, vid:paso-K,
// vid:toma-N) con el prompt que escribieron como sugerencia, y el usuario decide. Si el plan de la IA se acaba en una
// revision, ese paso se salta con una nota (la revision ya no frena el anuncio).
//
// Archivos de la app (temp/<slug>/app/):
//   continuidad/estado.json        { sinContinuidad?: { motivo, detalle, fecha }, bajadas: [...] }
//   revision.json, revision-estado.json, revision/        la revision de las imagenes (mismos nombres que en voz en
//                                                           off: informe.js los lee igual)
//   continuidad/pares.txt          lo que dijo `continuidad.js --pares` (lo lee Claude)
//   continuidad/pasos.json         lo que escribe Claude: { pasos: [{ de, a, forma, prompt_video }] }
//   continuidad/pares-estado.json  la sesion de los pasos
//   continuidad/cadena.json        lo que escribe Claude al revisar la cadena: [{ clip, motivo, prompt_video, forma? }]
//   continuidad/cadena-estado.json los pedidos y lo que paso con cada uno (desde 2026-11-09: 'aviso')
//   continuidad/respaldo/          los clips que una version anterior aparto para rehacerlos
import { asegurarVoz, faltaVoz } from '../voz-auto.js';
import { leerFicha } from '../productos.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { RAIZ, OUTPUT } from '../rutas.js';
import { leerJSON, existe, listar, escribirSeguro, escribirJSONSeguro } from '../archivos.js';
import { ESPERAS_REINTENTO_MS, mensajeDeFallo, consultarSaldoKie, hayConexion, modoPrueba } from '../procesos.js';
import { armarInforme } from '../informe.js';
import { textoClaude, leerYValidar, validarEsquema, cargarEsquema, prohibidasComunes } from '../claude.js';
import { nombreIA } from '../motor-ia.js';
import { hojasDelManifiesto, contextosDe, rutasEnTexto } from '../ia/material.js';
import * as vozEnOff from './voz-en-off.js';
import { anotarAviso, limpiarAvisosDelPaso, notaDeAvisos, piezasConAviso } from '../avisos.js';
// Las funciones puras del motor (no hablan con nadie ni cobran): la cadena, la prediccion y el validador del bloque.
import * as motor from '../../../../produccion/continuidad.js';
import { CREDITOS_SUNO } from '../../../../produccion/config.js'; // la unica fuente del precio de Suno

/** El modelo de la cadena de este anuncio (su temp/<slug>/modelos.json; sin el, Omni y sus tramos de siempre). */
const modeloDeCadena = (ctx) => motor.modeloDeCadenaEn(ctx.carpeta);

export const FAMILIA = 'continuidad';
/** Los estilos que admiten el efecto (los mismos que ESTILOS_CON_CONTINUIDAD del motor). */
export const ESTILOS = ['claymation', 'crochet', 'zack-d-films', 'estilo-pixar', 'skeleton', 'estilo-lego'];
/** Esta familia va SOLO cuando el brief pide continuidad: sin eso, esos estilos son de voz-en-off. */
export const aplica = (brief) => Boolean(brief?.continuidad) && ESTILOS.includes(brief?.estilo);

const ESTILO = {
  claymation: { nombre: 'Claymation', skill: 'anuncios-claymation', look: 'plastilina de stop-motion (no una foto real, ni un dibujo plano, ni 3D liso)' },
  crochet: { nombre: 'Crochet', skill: 'anuncios-crochet', look: 'un mundo en miniatura tejido en lana a crochet (no una foto real, ni plástico, ni 3D liso)' },
  'zack-d-films': { nombre: 'Zack D Films', skill: 'anuncios-zack-d-films', look: 'animación 3D cinematográfica del estilo, con el mecanismo como dice la skill (no una foto real ni un dibujo plano)' },
  'estilo-pixar': { nombre: 'Estilo Pixar', skill: 'anuncios-estilo-pixar', look: 'animación 3D cálida tipo Pixar en todas las tomas (no una foto real ni un dibujo plano)' },
  skeleton: { nombre: 'Skeleton', skill: 'anuncios-skeleton-ads', look: 'el personaje esqueleto 3D del estilo y su mundo, como dice la skill (no una foto real ni un dibujo plano)' },
  'estilo-lego': {
    nombre: 'Estilo Lego',
    skill: 'anuncios-estilo-lego',
    look: 'minifiguras y ladrillos LEGO para todo lo humano, animación médica 3D para el mecanismo y el producto real dentro del mundo Lego, como dice la skill',
  },
};
const SKILL_CONTINUIDAD = 'anuncios-continuidad';

// La musica: Suno en claymation, crochet y pixar; la pista fija la pone el motor en lego y se copia a mano en
// zack-d-films y skeleton ANTES de npm run musica (si no, iria a Suno y cobraria). COMO-PRODUCIR 3 y 13.
const PISTA_A_MANO = { 'zack-d-films': 'zack-d-films.mp3', skeleton: 'esqueleto.mp3' };
const SIN_SUNO = new Set(['estilo-lego', 'zack-d-films', 'skeleton']);
const EFECTOS = ['woosh.mp3', 'deep-woosh.mp3']; // solo si el anuncio quedo sin continuidad (con cortes)

const MAX_TURNOS = 150; // mirar 20-40 imagenes y escribir: mas que una tarea de guion

const ahora = () => new Date().toISOString();
const r2 = (x) => Math.round(Number(x) * 100) / 100;
const numeroES = (n, d = 1) => Number(n).toLocaleString('es-ES', { maximumFractionDigits: d, minimumFractionDigits: 0 });

function escribirJSON(ruta, valor) {
  escribirJSONSeguro(ruta, valor);
}

// Lo que lleva precios o saldos: no sale en el detalle (ningun precio a la vista salvo el informe).
const CON_PRECIO = /US\$|cr[eé]ditos?\b|\bsaldo\b|\bcr\b|\$\d/i;

/** Las ultimas lineas utiles de lo que dijo un comando (para el detalle de la tarjeta), sin precios ni saldos. */
function ultimasLineas(texto, n = 12) {
  return String(texto || '')
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() && !CON_PRECIO.test(l))
    .slice(-n)
    .join('\n');
}

/** Lo que devuelve un paso cuando su comando fallo, segun por que fallo. */
function fallo(r, { que = 'este paso', mensaje = null } = {}) {
  if (r.cancelado) return { cancelado: true };
  if (r.clase === 'saldo') return { pausa: { motivo: 'saldo', mensaje: mensajeDeFallo('saldo') } };
  return {
    ok: false,
    error: {
      mensaje: mensaje && !['ruta-larga', 'clave', 'cuota-voz', 'voz-pago', 'red', 'servidor', 'contenido'].includes(r.clase) ? mensaje : mensajeDeFallo(r.clase, { que }),
      motivo: r.clase || 'otro',
      detalle: ultimasLineas(r.texto),
    },
  };
}

const errorDeGuion = (r) => ({
  ok: false,
  error: {
    mensaje: 'El guion quedó con un error técnico y así no lo puedo producir. Pide un cambio en el guion para que la IA lo corrija.',
    motivo: 'guion',
    detalle:
      String(r.texto || '')
        .split(/\r?\n/)
        .filter((l) => /^\s*ERROR\b/.test(l))
        .map((l) => l.trim())
        .join('\n') || ultimasLineas(r.texto),
  },
});

// ---------------------------------------------------------------- el anuncio en disco

const rutaManifiesto = (ctx) => path.join(ctx.carpeta, 'manifiesto.json');
const leerManifiesto = (ctx) => leerJSON(rutaManifiesto(ctx));
const dirCont = (ctx) => path.join(ctx.carpeta, 'app', 'continuidad');
const rutaEstado = (ctx) => path.join(dirCont(ctx), 'estado.json');
const leerEstado = (ctx) => leerJSON(rutaEstado(ctx)) || {};
const guardarEstado = (ctx, e) => escribirJSON(rutaEstado(ctx), e);
const sinContinuidad = (ctx) => Boolean(leerEstado(ctx).sinContinuidad);
const estiloDe = (ctx) => leerManifiesto(ctx)?.estilo || ctx.brief?.estilo || '';
const datosDeEstilo = (ctx) => ESTILO[estiloDe(ctx)] || { nombre: estiloDe(ctx) || 'voz en off', skill: null, look: 'el look que pide la skill del estilo' };
const abs = (ctx, ...p) => path.join(RAIZ, 'temp', ctx.slug, ...p);
const rel = (ctx, ...p) => ['temp', ctx.slug, ...p].join('/');
const hayMusica = (carpeta) => listar(path.join(carpeta, 'musica')).some((n) => /\.(mp3|wav|m4a|ogg|flac)$/i.test(n));
const necesitaSuno = (ctx) => !hayMusica(ctx.carpeta) && !SIN_SUNO.has(estiloDe(ctx));

/** Escribe el manifiesto de una vez, con el mismo fin de linea que tenia. */
function escribirManifiesto(ctx, m) {
  const ruta = rutaManifiesto(ctx);
  let crlf = false;
  try {
    crlf = fs.readFileSync(ruta, 'utf8').includes('\r\n');
  } catch {
    /* nuevo */
  }
  let texto = JSON.stringify(m, null, 2) + '\n';
  if (crlf) texto = texto.replace(/\n/g, '\r\n');
  escribirSeguro(ruta, texto);
}

function copiarSiExiste(de, a) {
  if (!existe(de)) return false;
  fs.mkdirSync(path.dirname(a), { recursive: true });
  fs.copyFileSync(de, a);
  return true;
}

/** Mueve un archivo (rename: conserva la fecha, asi el gasto no lo cuenta como nuevo al volver). */
function mover(de, a) {
  if (!existe(de)) return false;
  fs.mkdirSync(path.dirname(a), { recursive: true });
  fs.rmSync(a, { force: true });
  fs.renameSync(de, a);
  return true;
}

// ---------------------------------------------------------------- los pasos de voz en off (sin continuidad)

/** El paso `id` de voz-en-off.js (lo lee al correr: ese archivo puede cambiar sin tocar este). */
function pasoDeVozEnOff(id) {
  const def = Array.isArray(vozEnOff.PASOS) ? vozEnOff.PASOS.find((p) => p.id === id) : null;
  return typeof def?.correr === 'function' ? def.correr : null;
}

/** Corre, en orden, pasos de voz en off dentro de este paso (el anuncio que quedo sin continuidad). */
async function comoVozEnOff(ctx, ids) {
  const notas = [];
  for (const id of ids) {
    const correr = pasoDeVozEnOff(id);
    if (!correr) {
      return { ok: false, error: { mensaje: 'No pude seguir con este anuncio sin continuidad: a la app le falta una parte.', motivo: 'app', detalle: `voz-en-off.js no trae el paso "${id}"` } };
    }
    const r = await correr(ctx);
    if (!r || r.cancelado || r.pausa || r.ok === false) return r;
    if (r.nota) notas.push(r.nota);
  }
  return { ok: true, nota: notas.join(' ') || null };
}

// ---------------------------------------------------------------- las sesiones de la IA

// La IA en los textos: 'Claude', 'ChatGPT' o 'tu IA'. Sin `motor`, la elegida ahora; con el que anoto una sesion
// (estado.sesion.motor, r.motor), la que la hizo. LaIA, para empezar una frase.
const laIA = (motor) => nombreIA(motor || undefined);
const LaIA = (motor) => laIA(motor).replace(/^./, (c) => c.toUpperCase());

/**
 * El armado de una sesion de esta familia, sin lanzarla (§3.1 del diseño): { tipo, cwd, prompt, herramientas,
 * permitidas, prohibidas, material, esfuerzo?, timeoutMs, maxTurnos, verificar }. Lee el anuncio y las skills; escribe
 * SOLO su archivo (`escribe`, relativos a la carpeta del anuncio: el manifiesto, el brief y el conductor son de la
 * app). Quien la lanza agrega uuid, resume, senal, alProgreso y registro.
 */
function armarSesion(ctx, { tipo, prompt, escribe, skills, verificar, material = {}, esfuerzo = null }) {
  const slugRel = rel(ctx);
  return {
    tipo,
    cwd: RAIZ,
    prompt,
    herramientas: ['Read', 'Glob', 'Grep', 'Write', 'Edit'],
    permitidas: [
      `Read(./${slugRel}/**)`,
      ...skills.filter(Boolean).map((s) => `Read(./.claude/skills/${s}/**)`),
      'Glob',
      'Grep',
      ...escribe.flatMap((f) => [`Write(./${slugRel}/${f})`, `Edit(./${slugRel}/${f})`]),
    ],
    prohibidas: prohibidasComunes({ terminal: false }),
    material,
    ...(esfuerzo ? { esfuerzo } : {}),
    timeoutMs: 45 * 60000,
    maxTurnos: MAX_TURNOS,
    verificar,
  };
}

/**
 * Una tarea de la IA que deja UN archivo (o dos) en temp/<slug>/: `sesion` es lo que arma una de las armarSesion… y
 * `escribe` lo que tiene que dejar (lo nombra el segundo intento). Hasta 2 intentos (el segundo sigue la misma
 * conversacion). estado.sesion queda en disco: al retomar, la conversacion sigue.
 * Devuelve lo de lanzarSesion, o { cancelado } si lo detuvieron, o { ok: false, sinClaude } sin la IA.
 */
async function sesionDeClaude(ctx, { estado, guardar, sesion, escribe, frase, registro }) {
  const claude = await ctx.claude();
  if (!claude?.lanzarSesion) return { ok: false, sinClaude: true };
  const slugRel = rel(ctx);
  const uuid = estado.sesion?.uuid || crypto.randomUUID();
  const maxIntentos = Math.max(1, Number(process.env.ANUNCIOS_REVISION_INTENTOS) || 2);
  let r = null;
  for (let i = 0; i < maxIntentos; i++) {
    const previos = estado.sesion?.intentos || 0;
    estado.sesion = { ...(estado.sesion || {}), uuid, intentos: previos + 1, hecha: false, fecha: ahora() };
    guardar();
    ctx.avance(frase);
    r = await claude.lanzarSesion({
      ...sesion,
      uuid,
      resume: previos > 0,
      prompt: previos > 0 ? `Sigue con la tarea de antes y termina ${escribe.map((f) => `${slugRel}/${f}`).join(' y ')}.\n\n${sesion.prompt}` : sesion.prompt,
      alProgreso: (f) => ctx.avance(f),
      registro: path.join(ctx.carpeta, 'app', 'registro', registro),
      senal: ctx.senal, // Detener corta tambien a la IA
    });
    if (r?.motor) estado.sesion.motor = r.motor; // la IA que la hizo (lo que dicen las notas despues)
    if (r?.ok) break;
    if (ctx.senal?.aborted || r?.cancelado) {
      // un intento cortado por Detener no cuenta
      estado.sesion.intentos = previos;
      guardar();
      return { cancelado: true };
    }
    if (r?.limite || r?.sinClaude || r?.sinSesion || r?.planSinCodex) break;
  }
  return r || { ok: false };
}

// Con el conductor de varios a la vez, una pausa con el plan de la IA agotado se convierte sola en "sigo cuando
// se renueve" (conductor.js, esperarAClaude); sin el, queda en pausa y "Continuar" la retoma.
const mensajeLimite = (motor) =>
  `Se acabó por ahora el uso de tu plan de ${laIA(motor)}, y sin él no se pueden mirar las imágenes ni escribir los pasos entre escenas. Cuando se renueve, sigue desde aquí, sin pagar nada de nuevo.`;

const notaSinClaude = (r, que) =>
  r?.limite
    ? `Se acabó por ahora el uso de tu plan de ${laIA(r?.motor)}: ${que}.`
    : r?.sinClaude || r?.sinSesion
      ? `No se pudo abrir ${laIA(r?.motor)}: ${que}.`
      : `${LaIA(r?.motor)} no pudo terminar la revisión: ${que}.`;

// ---------------------------------------------------------------- reglas de los prompts de paso

/** Las lineas del look de un prompt de toma: todas menos la cabecera, Camera y Motion (igual que el motor). */
function lineasFijas(prompt) {
  if (typeof prompt !== 'string' || !prompt.trim()) return [];
  const lineas = prompt
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const trozos =
    lineas.length > 1
      ? lineas.slice(1)
      : lineas[0]
          .split(/(?<=[.!?])\s+(?=[A-Z"“¿¡])/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(1);
  return trozos.filter((l) => !/^(camera|motion)\b/i.test(l));
}

/** Lo que tiene que cumplir el prompt de un paso aunque Claude insista (sin esto, el video no es un paso). */
function reglasDuras(prompt, duracion, donde) {
  const e = [];
  const primera = String(prompt).split(/\r?\n/)[0];
  if (!/START frame\b.*\bEND frame/i.test(primera)) e.push(`${donde}: la primera línea tiene que decir "image-to-video from the START frame to the END frame, ${duracion}s."`);
  const seg = motor.segundosDeCabecera(prompt);
  if (seg !== duracion) e.push(`${donde}: la cabecera tiene que decir ${duracion}s (dice ${seg === null ? 'ningún largo' : `${seg}s`}): es el largo que se pide para ese paso.`);
  const bajo = String(prompt).toLowerCase();
  if (!bajo.includes(motor.FRASE_TOMA_CONTINUA.toLowerCase())) e.push(`${donde}: falta la línea "${motor.FRASE_TOMA_CONTINUA}"`);
  if (!bajo.includes(motor.FRASE_SIN_EFECTOS.toLowerCase())) e.push(`${donde}: falta "${motor.FRASE_SIN_EFECTOS}."`);
  if (/from the shot above/i.test(prompt)) e.push(`${donde}: "from the shot above" va cambiado por "from the START frame to the END frame".`);
  return e;
}

/** El manifiesto con estos prompts de paso puestos (copia: no escribe nada). */
function conPasos(m, lista) {
  const copia = structuredClone(m);
  const pasos = copia.continuidad?.pasos || [];
  for (const x of lista) {
    const i = pasos.findIndex((p) => p.de === x.de && p.a === x.a);
    if (i === -1) continue;
    const { de, a, ventana, duracion, duracion_propio, forma, prompt_video, revisar, ...resto } = pasos[i];
    pasos[i] = {
      de,
      a,
      ventana,
      duracion,
      ...(duracion_propio !== undefined ? { duracion_propio } : {}),
      forma: x.forma ?? forma,
      prompt_video: x.prompt_video,
      ...resto,
    };
    void revisar; // se escribio mirando la imagen de ahora: la marca se va
    void prompt_video;
  }
  return copia;
}

/** Los avisos del validador del motor sobre el prompt de este paso ("paso 3->4: ..."). */
const avisosDelPaso = (avisos, de, a) => avisos.filter((x) => x.startsWith(`paso ${de}->${a}:`)).map((x) => x.replace(/\n\s+/g, ' '));

// ---------------------------------------------------------------- 1. validar

async function validar(ctx) {
  const r = await ctx.correr('validar-manifiesto.js', [`${ctx.carpetaArg}/manifiesto.json`]);
  if (r.cancelado) return { cancelado: true };
  return r.codigo === 0 ? { ok: true } : errorDeGuion(r);
}

// ---------------------------------------------------------------- 2. preparar la cadena

/** "No se puede" de --preparar, en palabras simples. */
function motivoSinContinuidad(texto) {
  const t = String(texto || '');
  if (/modo_audio/.test(t)) return 'en este anuncio la voz va dentro de los videos, y encadenarlos la cortaría.';
  if (/no tiene continuidad/.test(t)) return 'este estilo no tiene el efecto continuidad.';
  if (/al menos 2 tomas/.test(t)) return 'el guion tiene una sola escena, y la continuidad va de una escena a la siguiente.';
  return 'este anuncio no admite el efecto continuidad.';
}

async function prepararCadena(ctx) {
  // El B-roll del estilo pasa a continuidad.broll_descartado y "broll" queda vacio; se agrega el bloque. Se puede
  // correr otra vez sin romper nada ("Ya estaba preparado").
  const r = await ctx.correr('continuidad.js', [ctx.carpetaArg, '--preparar']);
  if (r.cancelado) return { cancelado: true };
  if (r.codigo !== 0) {
    if (/No se puede/i.test(r.texto)) {
      const est = leerEstado(ctx);
      est.sinContinuidad = { motivo: motivoSinContinuidad(r.texto), detalle: ultimasLineas(r.texto, 4), fecha: ahora() };
      guardarEstado(ctx, est);
      return { ok: true, nota: `Va con cortes normales: ${est.sinContinuidad.motivo}` };
    }
    return {
      ok: false,
      error: { mensaje: 'No pude preparar el anuncio para que vaya sin cortes. Pide un cambio en el guion para que la IA lo corrija.', motivo: 'guion', detalle: ultimasLineas(r.texto) },
    };
  }
  const v = await ctx.correr('validar-manifiesto.js', [`${ctx.carpetaArg}/manifiesto.json`]);
  if (v.cancelado) return { cancelado: true };
  return v.codigo === 0 ? { ok: true } : errorDeGuion(v);
}

// ---------------------------------------------------------------- 3. saldo

/** Del texto de producir --solo-plan: { total, saldo, noAlcanza }. Los numeros nunca se muestran. */
function leerPlanDeCosto(texto) {
  const t = String(texto || '');
  const num = (m) => (m ? Number(String(m[1]).replace(',', '.')) : null);
  const total = num(t.match(/TOTAL:\s+([\d.]+) creditos/));
  const img = num(t.match(/Imagenes:\s+([\d.]+) creditos/));
  const vid = num(t.match(/Videos:\s+([\d.]+) creditos/));
  const saldo = num(t.match(/Tu saldo:\s+([\d.]+) creditos/));
  // con continuidad --si paga solo las imagenes y no imprime TOTAL: aca se mira el anuncio entero
  return { total: total ?? (img !== null || vid !== null ? (img || 0) + (vid || 0) : null), saldo, noAlcanza: /no te alcanza/i.test(t) };
}

/** El saldo de kie: el que dijo el comando o, si no lo dijo, consultado directo (gratis), esperando la conexion. */
async function saldoActual(ctx, dicho) {
  let s = dicho;
  for (let intento = 0; s === null; ) {
    s = await consultarSaldoKie();
    if (s !== null) break;
    if (!(await hayConexion())) {
      if (!(await ctx.esperarConexion())) return { cancelado: true };
    } else if (intento < ESPERAS_REINTENTO_MS.length) {
      if (!(await ctx.esperar(ESPERAS_REINTENTO_MS[intento++], 'No pude consultar tu saldo de kie: lo intento de nuevo en un momento.'))) return { cancelado: true };
    } else break;
  }
  return { saldo: s };
}

async function saldo(ctx) {
  const r = await ctx.correr('producir.js', [ctx.carpetaArg, '--solo-plan']);
  if (r.cancelado) return { cancelado: true };
  if (r.codigo !== 0) return fallo(r, { que: 'la cuenta de lo que falta producir' });
  const plan = leerPlanDeCosto(r.texto);
  const s = await saldoActual(ctx, plan.saldo);
  if (s.cancelado) return { cancelado: true };
  if (s.saldo === null) {
    return { ok: false, error: { mensaje: 'No pude consultar tu saldo de kie. Revisa tu clave de kie en Ajustes y toca “Continuar”.', motivo: 'clave', detalle: ultimasLineas(r.texto) } };
  }
  ctx.conductor.saldoInicial = { creditos: s.saldo, fecha: ahora() };
  ctx.guardar();
  const hace = (plan.total || 0) + (necesitaSuno(ctx) ? CREDITOS_SUNO : 0);
  // lo que se calcula gastar (la pantalla lo muestra junto al saldo)
  ctx.conductor.costoPlan = { creditos: hace, fecha: ahora() };
  if (plan.noAlcanza || s.saldo < hace) return { pausa: { motivo: 'saldo', mensaje: mensajeDeFallo('saldo') } };
  return { ok: true };
}

// ---------------------------------------------------------------- 4. voz

async function voz(ctx) {
  // sin voz elegida por el usuario, la elige la app (la más parecida a la del video de referencia o la más indicada)
  if (faltaVoz(ctx.brief)) {
    ctx.avance('Eligiendo la voz del narrador');
    const v = await asegurarVoz({ carpeta: ctx.carpeta, brief: ctx.brief, ficha: leerFicha(ctx.brief?.productoId) || {} });
    if (!v.ok) return { ok: false, error: { mensaje: v.mensaje, motivo: 'voz', detalle: 'voz-auto' } };
  }
  const id = ctx.brief?.voz?.id;
  if (!id) return { ok: false, error: { mensaje: 'Falta elegir la voz del anuncio.', motivo: 'voz', detalle: 'brief.json no trae voz.id' } };
  // La voz va por el entorno de ESTE proceso: el .env no se toca. Si audio/voz.mp3 ya esta, el motor no la repite.
  const r = await ctx.correr('generar-audio.js', [ctx.carpetaArg], { env: { ELEVENLABS_VOICE_ID: id }, que: ['voz'] });
  if (r.cancelado) return { cancelado: true };
  if (r.codigo !== 0) return fallo(r, { que: 'la voz' });
  if (!existe(path.join(ctx.carpeta, 'audio', 'tiempos.json'))) {
    return { ok: false, error: { mensaje: 'La voz salió sin sus tiempos y sin ellos no se puede montar.', motivo: 'otro', detalle: ultimasLineas(r.texto) } };
  }
  return { ok: true };
}

// ---------------------------------------------------------------- 5. imagenes

/** Las imagenes de las tomas que todavia no estan (A, B y C; la final, en las B). */
function imagenesQueFaltan(ctx, m) {
  const faltan = [];
  for (const t of (m?.tomas || []).filter((x) => ['A', 'B', 'C'].includes(x.tipo))) {
    for (const n of [`toma-${t.n}-inicial.png`, ...(t.tipo === 'B' ? [`toma-${t.n}-final.png`] : [])]) {
      if (!existe(path.join(ctx.carpeta, 'img', n))) faltan.push(n);
    }
  }
  return faltan;
}

async function imagenes(ctx) {
  if (sinContinuidad(ctx)) return comoVozEnOff(ctx, ['ventanas', 'imagenes-y-videos']);
  // Con continuidad, producir hace SOLO las imagenes: los pasos se escriben mirandolas (producir.js, familiaDe).
  const r = await ctx.correr('producir.js', [ctx.carpetaArg, '--si'], { que: ['imagenes'] });
  if (r.cancelado) return { cancelado: true };
  if (r.codigo !== 0) return fallo(r, { que: 'las imágenes' });
  const faltan = imagenesQueFaltan(ctx, leerManifiesto(ctx));
  if (faltan.length) return { ok: false, error: { mensaje: 'No salieron todas las imágenes. Toca “Continuar”: se piden solo las que faltan.', motivo: 'otro', detalle: faltan.join(', ') } };
  return { ok: true };
}

// ---------------------------------------------------------------- 6. revision de las imagenes (Claude, antes de los videos)

const rutaRevision = (ctx) => path.join(ctx.carpeta, 'app', 'revision.json');
const rutaEstadoRevision = (ctx) => path.join(ctx.carpeta, 'app', 'revision-estado.json');
const dirRevision = (ctx) => path.join(ctx.carpeta, 'app', 'revision');

/** Valida lo que escribio Claude. Devuelve { pedidos, errores }. Acepta la lista o { rehacer: [...] }. */
export function validarRevisionDeImagenes(valor, manifiesto) {
  const lista = Array.isArray(valor) ? valor : Array.isArray(valor?.rehacer) ? valor.rehacer : null;
  if (!lista) return { pedidos: [], errores: ['revision.json tiene que ser una lista: [] si todo está bien, o [{ "toma", "motivo", "promptsNuevos" }]'] };
  const errores = validarEsquema(lista, cargarEsquema('continuidad-imagenes'), 'revision.json');
  const pedidos = [];
  const vistas = new Set();
  for (const [i, x] of lista.entries()) {
    const donde = `elemento ${i + 1}`;
    const n = Number(x?.toma);
    const toma = (manifiesto?.tomas || []).find((t) => t.n === n);
    if (!Number.isInteger(n) || !toma) {
      errores.push(`${donde}: "toma" tiene que ser el número de una toma del manifiesto`);
      continue;
    }
    if (!['A', 'B', 'C'].includes(toma.tipo)) {
      errores.push(`${donde}: la toma ${n} es tipo ${toma.tipo}; acá solo se marcan tomas A, B o C`);
      continue;
    }
    if (vistas.has(n)) {
      errores.push(`${donde}: la toma ${n} está dos veces`);
      continue;
    }
    const pn = x.promptsNuevos || x.prompts_nuevos || {};
    const falta = [];
    if (typeof x.motivo !== 'string' || !x.motivo.trim()) falta.push('motivo');
    if (typeof pn.prompt_imagen_inicial !== 'string' || pn.prompt_imagen_inicial.trim().length < 40) falta.push('promptsNuevos.prompt_imagen_inicial');
    if (typeof pn.prompt_video !== 'string' || pn.prompt_video.trim().length < 20) falta.push('promptsNuevos.prompt_video');
    if (toma.tipo === 'B' && (typeof pn.prompt_imagen_final !== 'string' || pn.prompt_imagen_final.trim().length < 40)) falta.push('promptsNuevos.prompt_imagen_final (la toma es tipo B)');
    if (falta.length) {
      errores.push(`${donde} (toma ${n}): falta ${falta.join(', ')}`);
      continue;
    }
    const igual = (a, b) => String(a || '').trim() === String(b || '').trim();
    if (igual(pn.prompt_imagen_inicial, toma.prompt_imagen_inicial) && (toma.tipo !== 'B' || igual(pn.prompt_imagen_final, toma.prompt_imagen_final))) {
      errores.push(`${donde} (toma ${n}): el prompt de la imagen es el mismo de antes; rehacer con el mismo prompt da lo mismo`);
      continue;
    }
    vistas.add(n);
    pedidos.push({
      toma: n,
      motivo: x.motivo.trim(),
      prompts: {
        prompt_imagen_inicial: pn.prompt_imagen_inicial,
        ...(toma.tipo === 'B' ? { prompt_imagen_final: pn.prompt_imagen_final } : {}),
        prompt_video: pn.prompt_video,
      },
    });
  }
  return { pedidos, errores };
}

function textoDeRevisionDeImagenes(ctx, manifiesto) {
  const e = datosDeEstilo(ctx);
  const foto = ['producto.png', 'producto.jpg', 'producto.jpeg', 'producto.webp'].find((n) => existe(path.join(ctx.carpeta, n)));
  const tomas = (manifiesto.tomas || []).filter((t) => ['A', 'B', 'C'].includes(t.tipo));
  return textoClaude('tarea-continuidad-imagenes', {
    carpeta: abs(ctx),
    estiloNombre: e.nombre,
    manifiesto: abs(ctx, 'manifiesto.json'),
    foto: foto ? `Mira con Read la foto real del producto: ${abs(ctx, foto)}` : 'Este anuncio no tiene foto del producto.',
    img: abs(ctx, 'img'),
    listaTomas: tomas
      .map((t) => `   - toma ${t.n} (tipo ${t.tipo}): ${abs(ctx, 'img', `toma-${t.n}-inicial.png`)}${t.tipo === 'B' ? ` y ${abs(ctx, 'img', `toma-${t.n}-final.png`)}` : ''}`)
      .join('\n'),
    look: e.look,
    contexto: abs(ctx, 'app', 'revision', 'contexto-toma-N.txt'),
    skillEstilo: e.skill ? path.join(RAIZ, '.claude', 'skills', e.skill, 'SKILL.md') : 'la skill del estilo',
    salida: abs(ctx, 'app', 'revision.json'),
  });
}

/**
 * §3.2 fila 17: la IA mira las imagenes de las tomas antes de pagar los videos y escribe app/revision.json. Ademas
 * de lo que nombra la tarea: las hojas del manifiesto (adjuntas) y los contexto-toma-N.txt que la app ya armo. La
 * skill del estilo queda a pedido.
 */
export function armarSesionRevisionImagenes(ctx, { manifiesto = leerManifiesto(ctx) } = {}) {
  return armarSesion(ctx, {
    tipo: 'revision',
    prompt: textoDeRevisionDeImagenes(ctx, manifiesto),
    escribe: ['app/revision.json'],
    skills: [datosDeEstilo(ctx).skill],
    verificar: async () => {
      if (!existe(rutaRevision(ctx))) return { ok: false, errores: [`No encuentro ${rel(ctx, 'app', 'revision.json')}: escríbelo (una lista, [] si todo está bien).`] };
      const v = validarRevisionDeImagenes(leerJSON(rutaRevision(ctx)), manifiesto);
      return v.errores.length ? { ok: false, errores: v.errores } : { ok: true };
    },
    material: {
      skillsAPedido: true,
      // a pedido: repiten lo del manifiesto pegado y la tarea los lee solo de las tomas que rehace (como Claude)
      aPedido: contextosDe(dirRevision(ctx), 'contexto-toma-*.txt'),
      imagenes: hojasDelManifiesto(ctx.carpeta, manifiesto),
    },
  });
}

/** Modo prueba sin Claude: marca UNA imagen (la primera A despues de la 1): deja un aviso para probar el camino. */
function revisionDeImagenesSimulada(manifiesto) {
  const t = (manifiesto.tomas || []).find((x) => x.tipo === 'A' && x.n > 1) || (manifiesto.tomas || []).find((x) => x.tipo === 'A');
  if (!t) return [];
  return [
    {
      toma: t.n,
      motivo: `Prueba: un aviso de la revisión para probar el camino (modo prueba, sin ${laIA()}).`,
      promptsNuevos: { prompt_imagen_inicial: `${t.prompt_imagen_inicial} Sharper details, clean and readable product label.`, prompt_video: t.prompt_video },
    },
  ];
}

/** Una toma que una version anterior de la app empezo a rehacer: vuelve a como estaba (sus imagenes y el manifiesto). */
function restaurarToma(ctx, n) {
  const dir = path.join(dirRevision(ctx), 'respaldo', `toma-${n}`);
  for (const nombre of listar(path.join(dir, 'img'))) copiarSiExiste(path.join(dir, 'img', nombre), path.join(ctx.carpeta, 'img', nombre));
  copiarSiExiste(path.join(dir, 'manifiesto.json'), rutaManifiesto(ctx));
}

async function revisionImagenes(ctx) {
  if (sinContinuidad(ctx)) return comoVozEnOff(ctx, ['revision-imagenes']);
  const manifiesto = leerManifiesto(ctx);
  if (!manifiesto) return { ok: false, error: { mensaje: 'No encuentro el guion del anuncio.', motivo: 'otro', detalle: 'manifiesto.json' } };
  const estado = leerJSON(rutaEstadoRevision(ctx)) || { sesion: null, pedidos: [] };
  const guardar = () => escribirJSON(rutaEstadoRevision(ctx), estado);

  // (a) la sesion de Claude, una sola vez (lo que escribe queda en disco: al retomar no se repite)
  if (!estado.sesion?.hecha) {
    const simulada = modoPrueba() && process.env.ANUNCIOS_REVISION_REAL !== '1';
    ctx.avance('Preparando la revisión de las imágenes');
    for (const t of (manifiesto.tomas || []).filter((x) => ['A', 'B', 'C'].includes(x.tipo))) {
      const destino = path.join(dirRevision(ctx), `contexto-toma-${t.n}.txt`);
      if (existe(destino)) continue;
      const r = await ctx.correr('rehacer-toma.js', [ctx.carpetaArg, '--toma', String(t.n), '--contexto']);
      if (r.cancelado) return { cancelado: true };
      if (r.codigo === 0) {
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        fs.writeFileSync(destino, r.texto, 'utf8');
      }
    }
    if (ctx.senal?.aborted) return { cancelado: true };
    if (!estado.sesion?.uuid) fs.rmSync(rutaRevision(ctx), { force: true });
    // una revision nueva: lo que dijo la de antes (si la hubo) ya no vale
    limpiarAvisosDelPaso(ctx.carpeta, 'revision-imagenes');

    if (simulada) {
      escribirJSON(rutaRevision(ctx), revisionDeImagenesSimulada(manifiesto));
      estado.sesion = { hecha: true, ok: true, simulada: true, fecha: ahora() };
    } else {
      const r = await sesionDeClaude(ctx, {
        estado,
        guardar,
        sesion: armarSesionRevisionImagenes(ctx, { manifiesto }),
        escribe: ['app/revision.json'],
        frase: `${LaIA()} está mirando las imágenes`,
        registro: 'revision-imagenes-claude.jsonl',
      });
      if (r.cancelado) return { cancelado: true };
      // Sin plan de la IA (o sin la IA): la revision ya no es obligatoria (desde 2026-11-09 solo deja avisos), asi que
      // se salta con una nota y el anuncio sigue. Los pares, que si la necesitan, esperan al plan en su paso.
      if (!r.ok) {
        Object.assign((estado.sesion ||= {}), { hecha: true, ok: false, limite: Boolean(r.limite), error: r.error || null });
        estado.sinRevision = true;
        guardar();
        return { saltado: true, nota: notaSinClaude(r, 'las imágenes no se revisaron y siguen como salieron') };
      }
      estado.sesion.hecha = true;
      estado.sesion.ok = true;
    }
    const v = validarRevisionDeImagenes(leerJSON(rutaRevision(ctx)), manifiesto);
    estado.pedidos = v.pedidos.map((x) => ({ ...x, fase: 'pendiente', resultado: null }));
    estado.descartados = v.errores;
    guardar();
  }

  // (b) cada imagen marcada queda como AVISO en su imagen de inicio, con los prompts que escribio la revision como
  // sugerencia: no se rehace nada solo. (Si el usuario la regenera despues, hay que reescribir los dos pasos que la
  // tocan y pagar sus clips: eso lo hace el conductor con sus pasos de siempre.)
  vozEnOff.aplicarComoAvisos(ctx, estado.pedidos, { paso: 'revision-imagenes', restaurar: (n) => restaurarToma(ctx, n) });
  guardar();
  // los avisos que QUEDAN (uno que el usuario ya corrigió no se vuelve a contar)
  const avisos = piezasConAviso(ctx.carpeta, { paso: 'revision-imagenes' });
  const habia = estado.pedidos.filter((x) => x.resultado === 'aviso').length;
  return { ok: true, nota: avisos ? notaDeAvisos(avisos) : habia ? 'Ya no quedan avisos de la revisión.' : 'Las imágenes pasaron la revisión.' };
}

// ---------------------------------------------------------------- 7. duraciones de la cadena

/**
 * La prediccion del montaje (gratis, sin videos) y, si un clip pasaria de 2,5x y su largo no esta en el minimo, se
 * pide del tramo anterior (skill, Paso 5): el de un paso en continuidad.pasos[].duracion (y en su cabecera, si ya
 * tiene prompt), el propio de una toma B en duracion_propio. Nunca tomas[].duracion ni el cierre. Una vuelta por
 * cambio: cada uno mueve el reparto de los demas. Devuelve los cambios (escribe el manifiesto si hubo).
 */
export function bajarLoMuyRapido(manifiesto, tiempos, modelo = motor.modeloDeCadenaEn(null)) {
  // Los largos y la prediccion con el modelo de la cadena del anuncio (Ajustes > Modelos; sin eleccion, Omni y sus
  // tramos). Un modelo sin tramos (PixVerse, Grok) baja de a un segundo.
  const tramos = motor.tramosDeVideo(modelo);
  const fuerte = motor.REGLAS_CONTINUIDAD.fuerte;
  const m = structuredClone(manifiesto);
  const cambios = [];
  for (let vuelta = 0; vuelta < 40; vuelta++) {
    let pred;
    try {
      pred = motor.prediccionContinuidad({ manifiesto: m, tiempos, modelo });
    } catch {
      break;
    }
    const cadena = motor.cadenaDeClips(m, { estimar: true, tiempos, modelo });
    let hubo = false;
    for (const u of pred.unidades) {
      if (u.ultima || !(u.velocidad > fuerte + 1e-9)) continue;
      const p = (m.continuidad?.pasos || []).find((x) => x.de === u.linea);
      const t = (m.tomas || []).find((x) => x.n === u.linea);
      if (!p || !t) continue;
      const opciones = [];
      const iPaso = tramos.indexOf(p.duracion);
      if (iPaso > 0) opciones.push({ que: 'paso', actual: p.duracion, nueva: tramos[iPaso - 1] });
      if (t.tipo === 'B') {
        const propio = cadena.find((c) => c.rol === 'propio' && c.linea === t.n);
        const actual = propio?.tramo ?? propio?.segundos;
        const iP = tramos.indexOf(actual);
        if (iP > 0) opciones.push({ que: 'propio', actual, nueva: tramos[iP - 1] });
      }
      if (!opciones.length) continue; // ya en el minimo: se paga asi y la velocidad va en el informe
      opciones.sort((a, b) => b.actual - a.actual);
      const o = opciones[0];
      if (o.que === 'paso') {
        p.duracion = o.nueva;
        if (typeof p.prompt_video === 'string') p.prompt_video = motor.ajustarCabecera(p.prompt_video, o.nueva);
      } else p.duracion_propio = o.nueva;
      cambios.push({ que: o.que, toma: t.n, antes: o.actual, despues: o.nueva, velocidad: r2(u.velocidad) });
      hubo = true;
      break;
    }
    if (!hubo) break;
  }
  return { manifiesto: m, cambios };
}

async function duraciones(ctx) {
  if (sinContinuidad(ctx)) return { saltado: true, nota: null };
  // La duracion de cada paso y el cierre, de los tiempos reales de la voz. Conserva los prompts que ya hubiera.
  const r = await ctx.correr('continuidad.js', [ctx.carpetaArg, '--duraciones']);
  if (r.cancelado) return { cancelado: true };
  if (r.codigo !== 0) return { ok: false, error: { mensaje: 'No pude medir cada paso con los tiempos de la voz.', motivo: 'otro', detalle: ultimasLineas(r.texto) } };
  const tiempos = leerJSON(path.join(ctx.carpeta, 'audio', 'tiempos.json'));
  const { manifiesto, cambios } = bajarLoMuyRapido(leerManifiesto(ctx), tiempos, modeloDeCadena(ctx));
  const est = leerEstado(ctx);
  est.bajadas = cambios;
  guardarEstado(ctx, est);
  if (cambios.length) {
    const respaldo = path.join(dirCont(ctx), 'manifiesto-antes-de-bajar.json');
    fs.copyFileSync(rutaManifiesto(ctx), respaldo);
    escribirManifiesto(ctx, manifiesto);
    const v = await ctx.correr('validar-manifiesto.js', [`${ctx.carpetaArg}/manifiesto.json`]);
    if (v.cancelado) return { cancelado: true };
    if (v.codigo !== 0) {
      fs.copyFileSync(respaldo, rutaManifiesto(ctx)); // un largo que el validador no acepta no se paga
      est.bajadas = [];
      guardarEstado(ctx, est);
    }
  }
  // La prediccion queda en el registro del paso (no escribe nada).
  const p = await ctx.correr('planear-montaje.js', [ctx.carpetaArg, '--prediccion']);
  if (p.cancelado) return { cancelado: true };
  return { ok: true, nota: est.bajadas?.length ? `${est.bajadas.length} ${est.bajadas.length === 1 ? 'clip se pide' : 'clips se piden'} más corto para no ir tan acelerado.` : null };
}

// ---------------------------------------------------------------- 8. pares: el prompt de cada paso (Claude)

const rutaPasos = (ctx) => path.join(dirCont(ctx), 'pasos.json');
const rutaEstadoPares = (ctx) => path.join(dirCont(ctx), 'pares-estado.json');

/** Los pasos que hay que escribir: sin prompt, o marcados para revisar (se rehizo una de sus imagenes). */
function pasosPorEscribir(m) {
  return (m?.continuidad?.pasos || []).filter((p) => !(typeof p.prompt_video === 'string' && p.prompt_video.trim()) || p.revisar === true).map((p) => ({ de: p.de, a: p.a, duracion: p.duracion }));
}

/**
 * Revisa pasos.json contra los pasos pedidos y el validador del motor. `estricto`: los avisos del motor sobre el
 * prompt (lineas fijas que faltan, palabras de editor) cuentan como error; sin el, solo lo que hace que el video no
 * sea un paso. Devuelve { ok, errores, lista }.
 */
function verificarPasos(ctx, pedidos, { estricto = false } = {}) {
  const ruta = rutaPasos(ctx);
  if (!existe(ruta)) return { ok: false, errores: [`No encuentro ${rel(ctx, 'app', 'continuidad', 'pasos.json')}: escríbelo.`] };
  const leido = leerYValidar(ruta, 'continuidad-pasos');
  if (!leido.ok) return { ok: false, errores: leido.errores };
  const m = leerManifiesto(ctx);
  const lista = leido.datos.pasos;
  const errores = [];
  const clave = (x) => `${x.de}->${x.a}`;
  const pedidosPorClave = new Map(pedidos.map((p) => [clave(p), p]));
  const vistos = new Set();
  for (const x of lista) {
    const k = clave(x);
    if (!pedidosPorClave.has(k)) {
      errores.push(`pasos.json: el paso ${k} no va (los pasos son: ${pedidos.map(clave).join(', ')}).`);
      continue;
    }
    if (vistos.has(k)) {
      errores.push(`pasos.json: el paso ${k} está dos veces.`);
      continue;
    }
    vistos.add(k);
    errores.push(...reglasDuras(x.prompt_video, pedidosPorClave.get(k).duracion, `paso ${k}`));
  }
  for (const p of pedidos) if (!vistos.has(clave(p))) errores.push(`pasos.json: falta el paso ${clave(p)}.`);
  const validos = lista.filter((x) => pedidosPorClave.has(clave(x)));
  const copia = conPasos(m, validos);
  const { errores: delMotor, avisos } = motor.validarContinuidad(copia, { exigirPasos: true, modelo: modeloDeCadena(ctx) });
  errores.push(...delMotor.map((e) => e.replace(/:?\s*npm run [^\n]*$/i, '.')));
  if (estricto) for (const p of pedidos) errores.push(...avisosDelPaso(avisos, p.de, p.a));
  return errores.length ? { ok: false, errores, lista: validos } : { ok: true, errores: [], lista: validos };
}

function textoDePares(ctx, pedidos) {
  const e = datosDeEstilo(ctx);
  return textoClaude('tarea-continuidad-pares', {
    carpeta: abs(ctx),
    estiloNombre: e.nombre,
    salida: abs(ctx, 'app', 'continuidad', 'pasos.json'),
    skillContinuidad: path.join(RAIZ, '.claude', 'skills', SKILL_CONTINUIDAD, 'SKILL.md'),
    pares: abs(ctx, 'app', 'continuidad', 'pares.txt'),
    manifiesto: abs(ctx, 'manifiesto.json'),
    lista: pedidos.map((p) => `${p.de}->${p.a} (${p.duracion}s)`).join(', '),
  });
}

/**
 * §3.2 fila 18: la IA escribe el prompt de cada paso mirando sus dos imagenes (app/continuidad/pasos.json). La skill
 * de continuidad va entera ("Lee entera") y las imagenes de cada paso salen de app/continuidad/pares.txt (la tarea no
 * las nombra: estan dentro de ese archivo), en orden y sin repetir. Esfuerzo alto. `pedidos`: los pasos que hay que
 * escribir ({ de, a, duracion }). La primera vuelta de verificar es estricta (los avisos del motor cuentan).
 */
export function armarSesionPares(ctx, { pedidos = pasosPorEscribir(leerManifiesto(ctx)) } = {}) {
  let ronda = 0;
  const verificar = async () => {
    ronda++;
    const x = verificarPasos(ctx, pedidos, { estricto: ronda === 1 });
    return x.ok ? { ok: true } : { ok: false, errores: x.errores };
  };
  let pares = '';
  try {
    pares = fs.readFileSync(path.join(dirCont(ctx), 'pares.txt'), 'utf8');
  } catch {
    /* sin pares.txt: las imagenes las pide la IA, o las nombra la tarea */
  }
  return armarSesion(ctx, {
    tipo: 'revision',
    prompt: textoDePares(ctx, pedidos),
    escribe: ['app/continuidad/pasos.json'],
    skills: [SKILL_CONTINUIDAD, datosDeEstilo(ctx).skill],
    verificar,
    material: {
      textos: [`.claude/skills/${SKILL_CONTINUIDAD}/SKILL.md`],
      imagenes: rutasEnTexto(pares).filter((r) => /\.(png|jpe?g|webp|gif)$/i.test(r)),
    },
    esfuerzo: 'alto',
  });
}

/** Modo prueba sin Claude: prompts armados con las reglas de la skill (cabecera, lineas fijas, cierre). */
export function pasosSimulados(m, pedidos) {
  const tomas = m.tomas || [];
  return {
    pasos: pedidos.map((p) => {
      const t = tomas.find((x) => x.n === p.de);
      const sig = tomas.find((x) => x.n === p.a);
      const primera = String(t?.prompt_video || '').split(/\r?\n/)[0].trim();
      let cab = primera.length <= 200 ? primera : (primera.match(/^.*?,\s*\d+(?:[.,]\d+)?\s*s\b\.?(?:\s*Vertical 9:16\.)?/) || [''])[0];
      cab = cab.replace(/from the shot above/i, 'from the START frame to the END frame');
      if (!/START frame\b.*\bEND frame/i.test(cab) || motor.segundosDeCabecera(cab) === null) cab = `Image-to-video from the START frame to the END frame, ${p.duracion}s. Vertical 9:16.`;
      cab = motor.ajustarCabecera(cab, p.duracion);
      const deSig = new Set(lineasFijas(sig?.prompt_video));
      const fijas = [...new Set(lineasFijas(t?.prompt_video))].filter((l) => deSig.has(l));
      return {
        de: p.de,
        a: p.a,
        forma: 'recorrer',
        prompt_video: [
          cab,
          `It starts exactly on the START frame, the scene of shot ${p.de}. The camera moves slowly forward through the scene in one smooth continuous move, following the main subject toward the scene of shot ${p.a}.`,
          'It slows down and comes to rest on the END frame.',
          ...fijas,
          `${motor.FRASE_TOMA_CONTINUA} ${motor.FRASE_SIN_EFECTOS}. No captions, subtitles or added text on screen.`,
        ].join('\n'),
      };
    }),
  };
}

/** Copia los prompts revisados al manifiesto (solo prompt_video y forma; borra "revisar"). */
function aplicarPasos(ctx, lista) {
  const respaldo = path.join(dirCont(ctx), 'manifiesto-antes-de-pares.json');
  fs.mkdirSync(dirCont(ctx), { recursive: true });
  fs.copyFileSync(rutaManifiesto(ctx), respaldo);
  escribirManifiesto(ctx, conPasos(leerManifiesto(ctx), lista));
  return respaldo;
}

async function pares(ctx) {
  if (sinContinuidad(ctx)) return { saltado: true, nota: null };
  const estado = leerJSON(rutaEstadoPares(ctx)) || { sesion: null };
  const guardar = () => escribirJSON(rutaEstadoPares(ctx), estado);
  const pedidos = pasosPorEscribir(leerManifiesto(ctx));

  if (pedidos.length) {
    // 1. lo que dice --pares (gratis): las dos imagenes de cada paso, sus lineas y la cabecera de los prompts
    const rp = await ctx.correr('continuidad.js', [ctx.carpetaArg, '--pares']);
    if (rp.cancelado) return { cancelado: true };
    if (rp.codigo !== 0) return { ok: false, error: { mensaje: 'No pude preparar los pares de imágenes de cada paso.', motivo: 'otro', detalle: ultimasLineas(rp.texto) } };
    fs.mkdirSync(dirCont(ctx), { recursive: true });
    fs.writeFileSync(path.join(dirCont(ctx), 'pares.txt'), rp.texto.replace(/^[\s\S]*?(?==== Continuidad: pares)/, ''), 'utf8');

    // 2. un pasos.json que ya pasa (la sesion termino y la app se cerro antes de copiarlo) se usa tal cual
    let v = estado.sesion?.uuid ? verificarPasos(ctx, pedidos) : { ok: false };
    if (!v.ok) {
      const simulada = modoPrueba() && process.env.ANUNCIOS_REVISION_REAL !== '1';
      if (simulada) {
        escribirJSON(rutaPasos(ctx), pasosSimulados(leerManifiesto(ctx), pedidos));
        estado.sesion = { hecha: true, ok: true, simulada: true, fecha: ahora() };
        guardar();
      } else {
        if (!estado.sesion?.uuid) fs.rmSync(rutaPasos(ctx), { force: true });
        const r = await sesionDeClaude(ctx, {
          estado,
          guardar,
          sesion: armarSesionPares(ctx, { pedidos }),
          escribe: ['app/continuidad/pasos.json'],
          frase: `${LaIA()} está mirando cada par de imágenes`,
          registro: 'pares-claude.jsonl',
        });
        if (r.cancelado) return { cancelado: true };
        if (!r.ok) {
          // Sin los prompts no hay videos: se frena aca (nada se pago todavia por los videos) y "Continuar" lo reintenta.
          if (r.limite) return { pausa: { motivo: 'claude', mensaje: mensajeLimite(r.motor) } };
          return {
            ok: false,
            error: {
              mensaje: r.sinClaude || r.sinSesion ? r.error || `No se pudo abrir ${laIA()} para escribir los pasos entre escenas.` : `${LaIA(r.motor)} no pudo escribir los pasos entre escenas. Toca “Continuar” para que lo intente de nuevo: no se paga nada otra vez.`,
              motivo: 'claude',
              detalle: r.detalle || r.error || null,
            },
          };
        }
        estado.sesion.hecha = true;
        estado.sesion.ok = true;
        guardar();
      }
      v = verificarPasos(ctx, pedidos);
      if (!v.ok) {
        estado.sesion = null; // la proxima vez, otra conversacion
        guardar();
        return { ok: false, error: { mensaje: `Los pasos entre escenas quedaron incompletos. Toca “Continuar” para que ${laIA()} los escriba de nuevo.`, motivo: 'claude', detalle: v.errores.slice(0, 8).join('\n') } };
      }
    }
    // 3. al manifiesto
    const respaldo = aplicarPasos(ctx, v.lista);
    const val = await ctx.correr('validar-manifiesto.js', [`${ctx.carpetaArg}/manifiesto.json`]);
    if (val.cancelado) return { cancelado: true };
    if (val.codigo !== 0) {
      fs.copyFileSync(respaldo, rutaManifiesto(ctx));
      fs.rmSync(rutaPasos(ctx), { force: true });
      estado.sesion = null;
      guardar();
      return errorDeGuion(val);
    }
  }

  // 4. --pares tiene que decir "Prompts escritos: X de X"
  const fin = await ctx.correr('continuidad.js', [ctx.carpetaArg, '--pares']);
  if (fin.cancelado) return { cancelado: true };
  const mm = String(fin.texto).match(/Prompts escritos: (\d+) de (\d+)/);
  if (fin.codigo !== 0 || !mm || mm[1] !== mm[2]) {
    return { ok: false, error: { mensaje: `Quedaron pasos entre escenas sin escribir. Toca “Continuar” para que ${laIA()} los termine.`, motivo: 'claude', detalle: ultimasLineas(fin.texto, 4) } };
  }
  return { ok: true };
}

// ---------------------------------------------------------------- 9. videos de la cadena

/** Del texto de generar-videos --solo-plan: { costo, saldo, noAlcanza }. Los numeros nunca se muestran. */
function leerCostoDeVideos(texto) {
  const t = String(texto || '');
  const num = (m) => (m ? Number(String(m[1]).replace(',', '.')) : null);
  return { costo: num(t.match(/Costo:\s+([\d.]+) creditos/)), saldo: num(t.match(/Tu saldo:\s+([\d.]+) creditos/)), noAlcanza: /no te alcanza/i.test(t) };
}

const clipsQueFaltan = (ctx, m) => motor.cadenaDeClips(m, { modelo: modeloDeCadena(ctx) }).filter((c) => !existe(path.join(ctx.carpeta, 'video', c.archivo))).map((c) => c.archivo);

async function videos(ctx) {
  if (sinContinuidad(ctx)) return { saltado: true, nota: null };
  // Antes de pagar: el plan exige los pasos, sus prompts y el cierre, y dice si el saldo alcanza (gratis).
  const plan = await ctx.correr('generar-videos.js', [ctx.carpetaArg, '--solo-plan']);
  if (plan.cancelado) return { cancelado: true };
  if (plan.codigo !== 0) return fallo(plan, { que: 'los videos', mensaje: 'Los pasos entre escenas quedaron con un error técnico y así no puedo pedir los videos.' });
  const c = leerCostoDeVideos(plan.texto);
  if (c.saldo !== null && (c.noAlcanza || c.saldo < (c.costo || 0) + (necesitaSuno(ctx) ? CREDITOS_SUNO : 0))) {
    return { pausa: { motivo: 'saldo', mensaje: mensajeDeFallo('saldo') } };
  }
  const r = await ctx.correr('generar-videos.js', [ctx.carpetaArg, '--si'], { que: ['videos'] });
  if (r.cancelado) return { cancelado: true };
  if (r.codigo !== 0) return fallo(r, { que: 'los videos' });
  const faltan = clipsQueFaltan(ctx, leerManifiesto(ctx));
  if (faltan.length) return { ok: false, error: { mensaje: 'No salieron todos los videos. Toca “Continuar”: se piden solo los que faltan.', motivo: 'otro', detalle: faltan.join(', ') } };
  return { ok: true };
}

// ---------------------------------------------------------------- 10. revision de la cadena (Claude)

const rutaCadena = (ctx) => path.join(dirCont(ctx), 'cadena.json');
const rutaEstadoCadena = (ctx) => path.join(dirCont(ctx), 'cadena-estado.json');
const dirRespaldoClips = (ctx) => path.join(dirCont(ctx), 'respaldo');

/** Valida la revision de la cadena. `modelo`: el de la cadena del anuncio (modeloDeCadena). Devuelve { pedidos, errores }. */
export function validarCadena(valor, m, { estricto = false, modelo = motor.modeloDeCadenaEn(null) } = {}) {
  if (!Array.isArray(valor)) return { pedidos: [], errores: ['cadena.json tiene que ser una lista: [] si todo está bien, o [{ "clip", "motivo", "prompt_video" }]'] };
  const errores = validarEsquema(valor, cargarEsquema('continuidad-cadena'), 'cadena.json');
  const cadena = motor.cadenaDeClips(m, { modelo });
  const pedidos = [];
  const vistos = new Set();
  for (const [i, x] of valor.entries()) {
    const donde = `elemento ${i + 1}`;
    const c = cadena.find((y) => y.id === x?.clip);
    if (!c) {
      errores.push(`${donde}: "${x?.clip}" no es un clip de la cadena (son: ${cadena.map((y) => y.id).join(', ')}).`);
      continue;
    }
    if (vistos.has(c.id)) {
      errores.push(`${donde}: ${c.id} está dos veces.`);
      continue;
    }
    if (typeof x.prompt_video !== 'string' || x.prompt_video.trim().length < 40 || typeof x.motivo !== 'string' || !x.motivo.trim()) {
      errores.push(`${donde} (${c.id}): falta "motivo" o "prompt_video".`);
      continue;
    }
    if (c.rol === 'paso') {
      const p = m.continuidad.pasos.find((y) => y.de === c.deToma);
      if (x.prompt_video.trim() === String(p?.prompt_video || '').trim()) {
        errores.push(`${donde} (${c.id}): es el mismo prompt de antes; rehacer con el mismo da lo mismo.`);
        continue;
      }
      const duras = reglasDuras(x.prompt_video, p.duracion, c.id);
      const { avisos } = motor.validarContinuidad(conPasos(m, [{ de: p.de, a: p.a, forma: x.forma, prompt_video: x.prompt_video }]), { modelo });
      const blandos = estricto ? avisosDelPaso(avisos, p.de, p.a) : [];
      if (duras.length || blandos.length) {
        errores.push(...duras, ...blandos);
        continue;
      }
    } else {
      const t = m.tomas.find((y) => y.n === c.deToma);
      if (x.prompt_video.trim() === String(t?.prompt_video || '').trim()) {
        errores.push(`${donde} (${c.id}): es el mismo prompt de antes; rehacer con el mismo da lo mismo.`);
        continue;
      }
      const antes = motor.segundosDeCabecera(t.prompt_video);
      const ahoraSeg = motor.segundosDeCabecera(x.prompt_video);
      if (antes !== null && ahoraSeg !== antes) {
        errores.push(`${donde} (${c.id}): la cabecera tiene que decir ${antes}s, como antes (dice ${ahoraSeg === null ? 'ningún largo' : `${ahoraSeg}s`}).`);
        continue;
      }
    }
    vistos.add(c.id);
    pedidos.push({ clip: c.id, rol: c.rol, toma: c.deToma, a: c.aToma ?? null, motivo: x.motivo.trim(), prompt_video: x.prompt_video, ...(c.rol === 'paso' && x.forma ? { forma: x.forma } : {}) });
  }
  return { pedidos, errores };
}

function textoDeCadena(ctx, m) {
  const e = datosDeEstilo(ctx);
  const indice = leerJSON(path.join(ctx.carpeta, 'qa', 'uniones', 'indice.json'));
  const uniones = (indice?.uniones || []).filter((u) => u.tira).map((u) => `   - ${path.join(ctx.carpeta, ...String(u.tira).split('/'))}`);
  const cadena = motor.cadenaDeClips(m, { modelo: modeloDeCadena(ctx) });
  const tiras = cadena
    .map((c) => path.join(ctx.carpeta, 'qa', `${c.id}-tira.jpg`))
    .filter((f) => existe(f))
    .map((f) => `   - ${f}`);
  const log = leerJSON(path.join(ctx.carpeta, 'video', 'log-modelos.json'));
  const deRespaldo = (Array.isArray(log?.clips) ? log.clips : []).filter((x) => x?.respaldo && cadena.some((c) => c.archivo === x.archivo)).map((x) => x.archivo.replace('.mp4', ''));
  return textoClaude('tarea-continuidad-cadena', {
    carpeta: abs(ctx),
    estiloNombre: e.nombre,
    salida: abs(ctx, 'app', 'continuidad', 'cadena.json'),
    skillContinuidad: path.join(RAIZ, '.claude', 'skills', SKILL_CONTINUIDAD, 'SKILL.md'),
    indiceUniones: abs(ctx, 'qa', 'uniones', 'indice.json'),
    listaUniones: uniones.join('\n') || '   (no hay imágenes de uniones)',
    listaTiras: tiras.join('\n') || '   (no hay tiras)',
    respaldo: deRespaldo.length ? `   Estos clips salieron del modelo de respaldo: míralos con más cuidado: ${deRespaldo.join(', ')}.` : '',
    manifiesto: abs(ctx, 'manifiesto.json'),
    skillEstilo: e.skill ? path.join(RAIZ, '.claude', 'skills', e.skill, 'SKILL.md') : 'la skill del estilo',
  });
}

/**
 * §3.2 fila 19: la IA revisa la cadena terminada (las uniones y las tiras que ya saco la app) y escribe
 * app/continuidad/cadena.json. La skill de continuidad va entera; la del estilo, a pedido. La primera vuelta de
 * verificar es estricta.
 */
export function armarSesionCadena(ctx, { m = leerManifiesto(ctx) } = {}) {
  let ronda = 0;
  const verificar = async () => {
    ronda++;
    if (!existe(rutaCadena(ctx))) return { ok: false, errores: [`No encuentro ${rel(ctx, 'app', 'continuidad', 'cadena.json')}: escríbelo (una lista, [] si todo está bien).`] };
    const v = validarCadena(leerJSON(rutaCadena(ctx)), leerManifiesto(ctx), { estricto: ronda === 1, modelo: modeloDeCadena(ctx) });
    return v.errores.length ? { ok: false, errores: v.errores } : { ok: true };
  };
  return armarSesion(ctx, {
    tipo: 'revision',
    prompt: textoDeCadena(ctx, m),
    escribe: ['app/continuidad/cadena.json'],
    skills: [SKILL_CONTINUIDAD, datosDeEstilo(ctx).skill],
    verificar,
    material: { textos: [`.claude/skills/${SKILL_CONTINUIDAD}/SKILL.md`], skillsAPedido: true },
  });
}

/** Modo prueba sin Claude: marca UN paso (el primero): deja un aviso para probar el camino. */
function cadenaSimulada(m) {
  const p = (m.continuidad?.pasos || []).find((x) => typeof x.prompt_video === 'string' && x.prompt_video.trim());
  if (!p) return [];
  const lineas = p.prompt_video.split(/\r?\n/);
  lineas.splice(Math.min(2, lineas.length), 0, 'The camera keeps a slow, steady pace the whole way.');
  return [{ clip: `paso-${p.de}`, motivo: `Prueba: un aviso de la revisión para probar el camino (modo prueba, sin ${laIA()}).`, forma: p.forma || 'recorrer', prompt_video: lineas.join('\n') }];
}

/** El prompt de antes de un pedido que una version anterior de la app dejo a mitad de rehacer: vuelve al manifiesto. */
function devolverPrompt(ctx, x) {
  const m = leerManifiesto(ctx);
  if (x.rol === 'paso') {
    escribirManifiesto(ctx, conPasos(m, [{ de: x.toma, a: x.a, forma: x.formaAntes, prompt_video: x.promptAntes }]));
  } else {
    m.tomas.find((y) => y.n === x.toma).prompt_video = x.promptAntes;
    escribirManifiesto(ctx, m);
  }
}

const archivoDe = (x) => `${x.clip}.mp4`;

async function revisionCadena(ctx) {
  if (sinContinuidad(ctx)) return { saltado: true, nota: null };
  const estado = leerJSON(rutaEstadoCadena(ctx)) || { sesion: null, pedidos: [] };
  const guardar = () => escribirJSON(rutaEstadoCadena(ctx), estado);

  // (a) los cuadros (gratis) y la sesion de Claude, una sola vez
  if (!estado.sesion?.hecha) {
    ctx.avance('Sacando los cuadros de cada unión');
    const f1 = await ctx.correr('extraer-frames.js', [ctx.carpetaArg]);
    if (f1.cancelado) return { cancelado: true };
    const f2 = await ctx.correr('extraer-frames.js', [ctx.carpetaArg, '--uniones']);
    if (f2.cancelado) return { cancelado: true };
    if (f2.codigo !== 0) {
      estado.sesion = { hecha: true, ok: false, fecha: ahora() };
      estado.sinRevision = true;
      guardar();
      return { saltado: true, nota: 'No pude sacar los cuadros de las uniones: la cadena no se revisó.' };
    }
    const m = leerManifiesto(ctx);
    if (!estado.sesion?.uuid) fs.rmSync(rutaCadena(ctx), { force: true });
    // una revision nueva: lo que dijo la de antes (si la hubo) ya no vale
    limpiarAvisosDelPaso(ctx.carpeta, 'revision-cadena');
    const simulada = modoPrueba() && process.env.ANUNCIOS_REVISION_REAL !== '1';
    if (simulada) {
      escribirJSON(rutaCadena(ctx), cadenaSimulada(m));
      estado.sesion = { hecha: true, ok: true, simulada: true, fecha: ahora() };
    } else {
      const r = await sesionDeClaude(ctx, {
        estado,
        guardar,
        sesion: armarSesionCadena(ctx, { m }),
        escribe: ['app/continuidad/cadena.json'],
        frase: `${LaIA()} está mirando cómo pasa cada escena a la siguiente`,
        registro: 'revision-cadena-claude.jsonl',
      });
      if (r.cancelado) return { cancelado: true };
      if (!r.ok) {
        Object.assign((estado.sesion ||= {}), { hecha: true, ok: false, limite: Boolean(r.limite), error: r.error || null });
        estado.sinRevision = true;
        guardar();
        return { saltado: true, nota: notaSinClaude(r, 'las uniones entre escenas no se revisaron y quedan como salieron') };
      }
      estado.sesion.hecha = true;
      estado.sesion.ok = true;
    }
    const v = validarCadena(leerJSON(rutaCadena(ctx)), leerManifiesto(ctx), { modelo: modeloDeCadena(ctx) });
    estado.pedidos = v.pedidos.map((x) => ({ ...x, fase: 'pendiente', resultado: null }));
    estado.descartados = v.errores;
    guardar();
  }

  // (b) cada clip marcado queda como AVISO en su pieza (vid:paso-K o vid:toma-N), con el prompt que escribio la
  // revision como sugerencia: no se rehace nada solo.
  for (const x of estado.pedidos) {
    if (x.resultado) continue;
    // (un pedido que una version anterior dejo a mitad: vuelven su prompt y su clip de antes)
    if (x.fase === 'aplicando' || x.fase === 'aplicado') {
      if (x.promptAntes !== undefined) devolverPrompt(ctx, x);
      const enVideo = path.join(ctx.carpeta, 'video', archivoDe(x));
      const apartado = path.join(dirRespaldoClips(ctx), archivoDe(x));
      if (!existe(enVideo) && existe(apartado)) mover(apartado, enVideo);
    }
    anotarAviso(ctx.carpeta, `vid:${x.clip}`, {
      fuente: 'revision-ia',
      paso: 'revision-cadena',
      texto: x.motivo,
      sugerencia: { prompt_video: x.prompt_video },
    });
    x.fase = 'aviso';
    x.resultado = 'aviso';
  }
  guardar();
  const avisos = piezasConAviso(ctx.carpeta, { paso: 'revision-cadena' });
  const habia = estado.pedidos.filter((x) => x.resultado === 'aviso').length;
  return { ok: true, nota: avisos ? notaDeAvisos(avisos) : habia ? 'Ya no quedan avisos de la revisión.' : 'Cada escena pasa bien a la siguiente.' };
}

// ---------------------------------------------------------------- 11. voces coladas

/** De la salida de revisar-voces: { revisados, conVoz, sinRevisar, transcritos }. */
function leerVoces(texto) {
  const t = String(texto || '');
  const conVoz = [...t.matchAll(/^\s*VOZ\s+(\S+\.mp4)/gm)].map((m) => m[1]);
  const sinRevisar = [...t.matchAll(/^\s*\?\s+(\S+\.mp4)\s+no se pudo transcribir/gm)].map((m) => m[1]);
  const ok = [...t.matchAll(/^\s*ok\s+(\S+\.mp4)/gm)].map((m) => m[1]);
  const revisados = Number((t.match(/(\d+) revisados/) || [])[1]) || conVoz.length + sinRevisar.length + ok.length;
  return { revisados, conVoz, sinRevisar, transcritos: [...ok, ...conVoz] };
}

async function voces(ctx) {
  // Despues de la revision de la cadena: asi tambien se escuchan los clips rehechos.
  let ultimo = null;
  for (let intento = 0; intento <= ESPERAS_REINTENTO_MS.length; intento++) {
    const r = await ctx.correr('revisar-voces.js', [ctx.carpetaArg, '--silenciar'], { que: ['scribe'], clipsDe: (texto) => leerVoces(texto).transcritos });
    if (r.cancelado) return { cancelado: true };
    if (r.codigo !== 0) return fallo(r, { que: 'la búsqueda de voces coladas' });
    ultimo = leerVoces(r.texto);
    if (!(ultimo.revisados && ultimo.sinRevisar.length === ultimo.revisados)) break;
    if (intento < ESPERAS_REINTENTO_MS.length) {
      if (!(await ctx.esperar(ESPERAS_REINTENTO_MS[intento], 'El servicio que escucha los clips no respondió: lo intento de nuevo en un momento.'))) return { cancelado: true };
    }
  }
  escribirJSON(path.join(ctx.carpeta, 'app', 'voces.json'), { fecha: ahora(), ...ultimo });
  if (ultimo.sinRevisar.length) return { ok: true, nota: `${ultimo.sinRevisar.length} clip(s) no se pudieron revisar.` };
  return { ok: true, nota: ultimo.conVoz.length ? `${ultimo.conVoz.length} clip(s) traían una voz que no iba: van sin sonido.` : null };
}

// ---------------------------------------------------------------- 12. musica

async function musica(ctx) {
  // zack-d-films y skeleton: la pista fija se copia ANTES; con ella en su lugar, generar-musica no genera nada.
  const fija = PISTA_A_MANO[estiloDe(ctx)];
  if (fija && !hayMusica(ctx.carpeta)) {
    const origen = path.join(RAIZ, 'recursos', 'musica', fija);
    if (!existe(origen)) {
      return { ok: false, error: { mensaje: 'Falta la música fija de este estilo en la carpeta del sistema. Sin ella no sigo, para no generar otra que se cobra.', motivo: 'otro', detalle: `recursos/musica/${fija}` } };
    }
    copiarSiExiste(origen, path.join(ctx.carpeta, 'musica', 'fondo.mp3'));
  }
  const r = await ctx.correr('suno-retomable.js', ['generar-musica.js', ctx.carpetaArg, '--si'], { que: ['musica'] });
  if (r.cancelado) return { cancelado: true };
  if (r.codigo !== 0) return fallo(r, { que: 'la música' });
  // Con continuidad no hay transiciones ni efectos del editor. Sin ella (cortes normales), los de siempre.
  if (sinContinuidad(ctx)) {
    for (const n of EFECTOS) {
      const destino = path.join(ctx.carpeta, 'efectos', n);
      if (!existe(destino)) copiarSiExiste(path.join(RAIZ, 'recursos', 'efectos-transiciones', n), destino);
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------- 13. montaje

async function montaje(ctx) {
  // plan -> subtitulos -> plan. Con continuidad el plan no corta ningun clip: solo cambia su velocidad.
  for (const [script, nombre] of [
    ['planear-montaje.js', 'el montaje'],
    ['subtitulos.js', 'los subtítulos'],
    ['planear-montaje.js', 'el montaje'],
  ]) {
    const r = await ctx.correr(script, [ctx.carpetaArg]);
    if (r.cancelado) return { cancelado: true };
    if (r.codigo !== 0) return fallo(r, { que: nombre, mensaje: `No pude armar ${nombre}.` });
  }
  return { ok: true };
}

// ---------------------------------------------------------------- 14. render

async function render(ctx) {
  const r = await ctx.correr('ensamblar.js', [ctx.carpetaArg], { pesado: true });
  if (r.cancelado) return { cancelado: true };
  if (r.codigo !== 0) return fallo(r, { que: 'la exportación de los videos', mensaje: 'No pude exportar los videos.' });
  return { ok: true };
}

// ---------------------------------------------------------------- 15. control final

async function controlFinal(ctx) {
  const p = ctx.paso;
  // Un re-render que quedo a medias (la app se cerro) se termina antes de medir.
  if (p.rerender === 'pendiente') {
    const e = await ctx.correr('ensamblar.js', [ctx.carpetaArg], { pesado: true });
    if (e.cancelado) return { cancelado: true };
    if (e.codigo !== 0) return fallo(e, { que: 'la segunda exportación', mensaje: 'No pude exportar los videos otra vez.' });
    p.rerender = 'hecho';
    ctx.guardar();
  }
  const r = await ctx.correr('control-final.js', [ctx.carpetaArg], { pesado: true });
  if (r.cancelado) return { cancelado: true };
  if (r.codigo === 0) return { ok: true, nota: p.rerender === 'hecho' ? 'Se exportó otra vez y quedó limpio.' : null };
  if (r.codigo === 2) return { ok: true, nota: `No pude revisar el video terminado: ${ultimasLineas(r.texto, 2)}` };
  if (r.codigo !== 1) return fallo(r, { que: 'el control final' });

  // Encontro algo: si exportar otra vez lo puede arreglar, se re-renderiza una vez (no cuesta nada) y se mide otra vez.
  const medido = leerJSON(path.join(ctx.carpeta, 'qa', 'control-final.json'));
  if (medido && medido.rerenderAyuda === false) return { ok: true, nota: 'El control final encontró detalles que no se arreglan exportando otra vez: están en el informe.' };
  if (!p.rerender && (ctx.conductor.rehechos?.render || 0) < 1) {
    copiarSiExiste(path.join(ctx.carpeta, 'qa', 'control-final.json'), path.join(ctx.carpeta, 'app', 'control-final-1.json'));
    (ctx.conductor.rehechos ||= {}).render = 1;
    p.rerender = 'pendiente';
    ctx.guardar();
    ctx.avance('El control encontró algo: exporto otra vez');
    const e = await ctx.correr('ensamblar.js', [ctx.carpetaArg], { pesado: true });
    if (e.cancelado) return { cancelado: true };
    if (e.codigo !== 0) return fallo(e, { que: 'la segunda exportación', mensaje: 'No pude exportar los videos otra vez.' });
    p.rerender = 'hecho';
    ctx.guardar();
    const r2b = await ctx.correr('control-final.js', [ctx.carpetaArg], { pesado: true });
    if (r2b.cancelado) return { cancelado: true };
    if (r2b.codigo === 0) return { ok: true, nota: 'Se exportó otra vez y quedó limpio.' };
    if (r2b.codigo === 1) return { ok: true, nota: 'Después de exportar otra vez quedaron detalles: están en el informe.' };
    if (r2b.codigo === 2) return { ok: true, nota: `No pude revisar el video terminado: ${ultimasLineas(r2b.texto, 2)}` };
    return fallo(r2b, { que: 'el control final' });
  }
  return { ok: true, nota: 'Quedaron detalles después de exportar otra vez: están en el informe.' };
}

// ---------------------------------------------------------------- 16. informe

/** "paso-3" / "toma-14" -> la pieza como la muestra la entrega ({ n, unidad, momento }). */
function piezaDe(clip, plan) {
  const r = String(clip).match(/(paso|toma)-(\d+)/);
  const n = r ? Number(r[2]) : null;
  const bloque = (plan?.bloques || []).find((b) => Number(b.linea) === n);
  return { n, unidad: r ? r[1] : 'paso', momento: bloque ? Number(bloque.inicio) || 0 : null };
}

/** Lo propio de la continuidad en el informe que arma informe.js (decisiones y problemas con la misma forma). */
export function completarInforme({ carpeta, conductor, informe: inf, notas = {} }) {
  const est = leerJSON(path.join(carpeta, 'app', 'continuidad', 'estado.json')) || {};
  const plan = leerJSON(path.join(carpeta, 'plan-montaje.json'));
  const d = Array.isArray(inf.decisiones) ? inf.decisiones : (inf.decisiones = []);
  const p = Array.isArray(inf.problemas) ? inf.problemas : (inf.problemas = []);
  // va despues de "manda la voz" y de la voz elegida
  const donde = Math.max(0, ...d.map((x, i) => (['manda', 'voz'].includes(x.id) ? i + 1 : 0)));

  if (est.sinContinuidad) {
    d.splice(donde, 0, {
      id: 'sin-continuidad',
      icono: 'continuidad',
      titulo: 'Va con cortes, sin continuidad',
      detalle: `Pediste el anuncio sin cortes, pero ${String(est.sinContinuidad.motivo || 'este anuncio no admite el efecto.').replace(/^./, (c) => c.toLowerCase())} Se hizo con cortes normales, como el estilo de siempre.`,
    });
  } else if (plan?.continuidad?.resumen) {
    const r = plan.continuidad.resumen;
    const clips = Array.isArray(plan.continuidad.clips) ? plan.continuidad.clips : [];
    const nPasos = clips.filter((c) => c.rol === 'paso').length || clips.length;
    const partes = ['Cada video va de una escena a la siguiente y el montaje no corta ninguno: solo cambia su velocidad para que cada imagen llegue con su frase.'];
    if (r.sobreGuia > 0) {
      partes.push(
        `${r.sobreGuia === 1 ? 'Uno va un poco acelerado' : `${r.sobreGuia} van un poco acelerados`} para llegar a tiempo (el que más, ${numeroES(plan.continuidad.velocidadMaxima, 1)} veces más rápido).`
      );
    }
    if (r.llegadasMovidas > 0) {
      partes.push(
        `${r.llegadasMovidas === 1 ? 'En una escena' : `En ${r.llegadasMovidas} escenas`} la imagen llega un instante antes o después de su frase (como mucho ${numeroES(r.maxDeriva, 1)} s).`
      );
    }
    const bajadas = Array.isArray(est.bajadas) ? est.bajadas.length : 0;
    if (bajadas) partes.push(`${bajadas === 1 ? 'Un clip se pidió' : `${bajadas} clips se pidieron`} más corto para no ir tan rápido.`);
    d.splice(donde, 0, { id: 'continuidad', icono: 'continuidad', titulo: `${nPasos} ${nPasos === 1 ? 'paso encadenado' : 'pasos encadenados'}, sin cortes`, detalle: partes.join(' ') });
  }

  const cad = leerJSON(path.join(carpeta, 'app', 'continuidad', 'cadena-estado.json'));
  const pedidos = Array.isArray(cad?.pedidos) ? cad.pedidos : [];
  // (los rehechos y los que no se pudieron son de anuncios de antes del 2026-11-09: ahora la revision solo deja avisos,
  // que van con los de todo el anuncio en «Lo que notó la revisión», de informe.js)
  const hechos = pedidos.filter((x) => x.resultado === 'rehecha');
  const noSe = pedidos.filter((x) => x.resultado && !['rehecha', 'aviso'].includes(x.resultado));
  if (hechos.length) {
    p.push({
      id: 'pasos-rehechos',
      tipo: 'arreglado',
      titulo: hechos.length === 1 ? 'Un clip de la cadena se rehízo' : `${hechos.length} clips de la cadena se rehicieron`,
      detalle:
        hechos.length === 1
          ? 'La IA miró cómo pasa cada escena a la siguiente y este clip no llegaba bien: se escribió de nuevo y se generó otra vez (una sola vez).'
          : 'La IA miró cómo pasa cada escena a la siguiente y estos clips no llegaban bien: se escribieron de nuevo y se generaron otra vez (una sola vez cada uno).',
      piezas: hechos.map((x) => ({ ...piezaDe(x.clip, plan), valor: x.motivo || null })),
    });
  }
  if (noSe.length) {
    p.push({
      id: 'pasos-no',
      tipo: 'revisar',
      titulo: noSe.length === 1 ? 'Un clip de la cadena no se pudo rehacer' : `${noSe.length} clips de la cadena no se pudieron rehacer`,
      detalle:
        noSe.length === 1
          ? 'La IA vio algo que corregir en cómo pasa de una escena a la otra, pero no se pudo rehacer (o ya se había rehecho una vez, que es el tope). Quedó el que estaba: míralo.'
          : 'La IA vio algo que corregir en cómo pasan de una escena a la otra, pero no se pudieron rehacer (o ya se habían rehecho una vez, que es el tope). Quedaron los que estaban: míralos.',
      piezas: noSe.map((x) => ({ ...piezaDe(x.clip, plan), valor: x.motivo || null })),
    });
  }
  if (cad?.sinRevision) {
    p.push({
      id: 'cadena-no',
      tipo: 'revisar',
      titulo: 'Las uniones entre escenas no se revisaron con la IA',
      detalle: notas['revision-cadena'] || 'No se pudo mirar cómo pasa cada escena a la siguiente: míralo antes de publicarlo.',
      piezas: [],
    });
  }
  inf.sinProblemas = p.length === 0;
  if (inf.costo && Object.keys(conductor?.rehechos || {}).some((k) => /^(paso|clip)-/.test(k))) inf.costo.rehecho = true;
  return inf;
}

async function informe(ctx) {
  const saldoFinal = await consultarSaldoKie();
  if (saldoFinal !== null) {
    ctx.conductor.saldoFinal = { creditos: saldoFinal, fecha: ahora() };
    ctx.guardar();
  }
  const inf = armarInforme({ carpeta: ctx.carpeta, dirOutput: OUTPUT, conductor: ctx.conductor });
  const notas = Object.fromEntries((ctx.conductor.pasos || []).map((x) => [x.id, x.nota || null]));
  escribirJSON(path.join(ctx.carpeta, 'app', 'informe.json'), completarInforme({ carpeta: ctx.carpeta, conductor: ctx.conductor, informe: inf, notas }));
  return { ok: true };
}

// ---------------------------------------------------------------- la secuencia

export const PASOS = [
  { id: 'validar', nombre: 'Revisar el guion', correr: validar },
  { id: 'preparar-cadena', nombre: 'Preparar el anuncio sin cortes', correr: prepararCadena },
  { id: 'saldo', nombre: 'Mirar tu saldo de kie', correr: saldo },
  { id: 'voz', nombre: 'Grabar la voz', correr: voz },
  { id: 'imagenes', nombre: 'Crear las imágenes', correr: imagenes },
  { id: 'revision-imagenes', nombre: 'Revisar las imágenes', correr: revisionImagenes },
  { id: 'duraciones', nombre: 'Medir cada paso con la voz', correr: duraciones },
  { id: 'pares', nombre: 'Escribir el paso entre cada escena', correr: pares },
  { id: 'videos', nombre: 'Crear los videos encadenados', correr: videos },
  { id: 'revision-cadena', nombre: 'Revisar las uniones entre escenas', correr: revisionCadena },
  { id: 'voces', nombre: 'Buscar voces que no van', correr: voces },
  { id: 'musica', nombre: 'Poner la música', correr: musica },
  { id: 'montaje', nombre: 'Armar el montaje y los subtítulos', correr: montaje },
  { id: 'render', nombre: 'Exportar los videos', correr: render },
  { id: 'control-final', nombre: 'Revisar el video terminado', correr: controlFinal },
  { id: 'informe', nombre: 'Preparar el informe', correr: informe },
];

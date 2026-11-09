// La produccion de un anuncio de OBJETO PARLANTE (talking-object-pixar), paso por paso.
//
// Misma interfaz que voz-en-off.js (FAMILIA, ESTILOS, PASOS; cada paso { id, nombre, correr(ctx) } y lo que
// devuelve: { ok, nota? } · { saltado, nota } · { pausa: { motivo, mensaje } } · { ok: false, error }). El ctx lo
// arma el conductor (conductor.js).
//
// Aca no hay narrador: cada personaje dice su frase DENTRO de su clip, con la boca sincronizada (modo_audio
// "dialogo_nativo"). Eso cambia tres cosas respecto de la voz en off (COMO-PRODUCIR 1.1, 2 y 6):
//   - no hay voz que grabar ni ventanas que ajustar: el clip manda y el montaje no acelera las tomas habladas;
//   - un clip que salio del modelo de respaldo (Kling) es un DEFECTO: Kling no hace hablar al personaje, la toma
//     queda sin su frase. Se rehace con Omni segun el motivo que imprimio el motor al cambiar de modelo:
//       error del servidor -> el mismo clip otra vez (con una espera antes: Omni estaba caido);
//       rechazo de contenido -> Claude reescribe SOLO la frase que lo dispara (misma funcion, mismo largo), la app
//       la pone en la `linea` y en la misma frase dentro del `prompt_video`, valida y rehace ese clip;
//   - el habla se revisa: la app transcribe cada clip con Scribe y lo compara con su frase (revisarHabla, la misma
//     revision de las tomas habladas del podcast y la entrevista). Una palabra repetida, trabada, agregada o
//     comida es un clip que se rehace (nunca "suena natural"); Claude mira las tiras de cuadros y escribe el prompt
//     nuevo que lo evita (y marca los defectos que se ven: el objeto hecho persona, el producto cambiado, letras).
//   - en la misma revision Claude mira tambien cada B-roll que entra en el video (sin frase ni transcriptor: solo
//     como se ve; su etiqueta que se borra, una cara de mas...) y la app rehace SOLO ese B-roll (lib/rehacer-broll.js).
// Sin revision obligatoria del usuario (decision de Diego): la hacen la transcripcion y Claude. La app rehace sola,
// con tope: hasta TOPE_CLIP_HABLADO veces cada clip hablado y TOPE_BROLL cada B-roll, por cualquier motivo; lo que
// pase el tope va al informe.
//
// Los pasos (ids del contrato, los mismos de voz en off donde son lo mismo):
//   validar · saldo · imagenes-y-videos · revision-clips · voces · musica · montaje · render · control-final · informe
//
// Lo que se guarda (todo en temp/<slug>/app/, para retomar sin pagar dos veces):
//   clips-modelos.json   de que modelo salio cada clip y, si fue del respaldo, por que (el log del motor se pisa en
//                        cada corrida: esto junta todas). Cada entrada con la huella del archivo (bytes y fecha): un
//                        clip que cambio sin pasar por aca no se da por conocido
//   habla.json           lo que se oyo en cada clip y si dijo su frase limpia (lo escribe el proceso de la revision
//                        del habla, este mismo archivo corrido como script: ver "como script", al final)
//   clips-estado.json    las vueltas de la revision: lo que se vio, las sesiones de Claude y cada pedido de rehacer
//                        con su fase (el tope se cuenta en conductor.rehechos ANTES de pagar); "broll": lo de cada
//                        B-roll (sus veces, que son su tope, tambien antes de pagar; su historial, la ultima vez que
//                        se miro y si estaba mal)
//   clips/               respaldos de cada toma y cada B-roll antes de tocarlos, sus contextos y los prompts que se
//                        aplicaron
//   rechazo.json, revision-clips.json   lo que escribe Claude (tareas compartidas tarea-rechazo.md y
//                        tarea-revisar-clips.md, con sus esquemas)
// Lo que cobra lo corre siempre la app. Claude no corre nada: solo lee y escribe su archivo.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RAIZ, OUTPUT } from '../rutas.js';
import { leerJSON, existe, listar, escribirJSONSeguro } from '../archivos.js';
import { ESPERAS_REINTENTO_MS, mensajeDeFallo, consultarSaldoKie, hayConexion, modoPrueba, clasificarFallo } from '../procesos.js';
import { doblarClipDePrueba } from '../voz-de-prueba.js';
import { notaPedida } from '../duracion.js';
import { TOPE_BROLL, vecesDeBroll, brollQueSeMiran, entradaDeBroll, seccionesDeBroll, validarPedidoDeBroll, pareceDelBroll, cuentasDeBroll, rehacerBroll, resumenDeBroll, detalleDeBrollMal } from '../rehacer-broll.js';

export const FAMILIA = 'objeto-parlante';
export const ESTILOS = ['talking-object-pixar'];

/** Cuantas veces se rehace como mucho un clip hablado, por cualquier motivo (decision de Diego: 3 en los hablados). */
export const TOPE_CLIP_HABLADO = 3;
// Una vuelta mas que el tope para mirar como quedo lo ultimo que se rehizo, y una de margen (un pedido que no
// llega a pagar, porque su cambio no valida, no gasta el tope pero si una vuelta).
const MAX_VUELTAS = TOPE_CLIP_HABLADO + 2;
/** El tope de una toma: el de siempre, mas una vez por cada "Continuar" si fue una escena que no salio nunca. */
const topeDe = (est, n) => TOPE_CLIP_HABLADO + ((est?.extraPara || []).includes(n) ? est.extra || 0 : 0);

const ESTE_ARCHIVO = fileURLToPath(import.meta.url);
const SKILL = 'anuncios-talking-object-pixar';

const ahora = () => new Date().toISOString();

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
  if (r.clase === 'saldo') return { pausa: { motivo: 'saldo', mensaje: mensajeDeFallo('saldo') } };
  return {
    ok: false,
    error: {
      mensaje: mensaje && !['ruta-larga', 'clave', 'cuota-voz', 'red', 'servidor', 'contenido'].includes(r.clase) ? mensaje : mensajeDeFallo(r.clase, { que }),
      motivo: r.clase || 'otro',
      detalle: ultimasLineas(r.texto),
    },
  };
}

const leerManifiesto = (ctx) => leerJSON(path.join(ctx.carpeta, 'manifiesto.json'));
const dirApp = (ctx) => path.join(ctx.carpeta, 'app');
const dirClips = (ctx) => path.join(dirApp(ctx), 'clips');
const rutaModelos = (ctx) => path.join(dirApp(ctx), 'clips-modelos.json');
const rutaEstado = (ctx) => path.join(dirApp(ctx), 'clips-estado.json');
const rutaHabla = (carpeta) => path.join(carpeta, 'app', 'habla.json');
const rutaClip = (ctx, n) => path.join(ctx.carpeta, 'video', `toma-${n}.mp4`);
const relRaiz = (abs) => path.relative(RAIZ, abs).split(path.sep).join('/');

/** Las tomas donde un personaje habla: las A, B y C con su frase (en este estilo, todas las principales). */
export function tomasHabladas(m) {
  return (m?.tomas || []).filter((t) => ['A', 'B', 'C'].includes(t.tipo) && typeof t.linea === 'string' && t.linea.trim());
}

/** Bytes y fecha de un archivo: si cambia cualquiera de los dos, es otro clip. null si no esta. */
export function huella(ruta) {
  try {
    const st = fs.statSync(ruta);
    return st.isFile() && st.size > 0 ? { tamano: st.size, mtime: Math.round(st.mtimeMs) } : null;
  } catch {
    return null;
  }
}
const mismaHuella = (a, b) => Boolean(a && b && a.tamano === b.tamano && Math.abs(a.mtime - b.mtime) < 2);

/** Un error que ya habla de la toma n ("toma 3", no "toma 30"). */
const mencionaToma = (texto, n) => new RegExp(`\\btoma ${n}\\b`).test(texto);

const contarPalabras = (s) => String(s || '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

// ---------------------------------------------------------------- de que modelo salio cada clip

/**
 * Lo que dijo el motor de cada clip que fallo con el modelo principal: Map archivo -> { clase, texto, sinClip? }.
 *   clase   'contenido' (rechazo por politicas), 'servidor' (caida, timeout, 5xx; tambien la red) u 'otro'
 *   texto   el motivo que imprimio (el failMsg de kie)
 *   sinClip true si fallaron los dos modelos (el clip no esta)
 * Lee las lineas de generar-videos.js (tambien con el prefijo "[vid] " de producir.js):
 *   "! toma 3 (C) 7s: <modelo> lo rechazo por contenido (...)."  /  "! toma 3 (C) 7s: fallo 3 veces con <modelo>."
 *   "    Motivo: ..."                                              (y despues "Cambio al modelo de respaldo")
 *   "toma 3 (C) 7s fallo con los dos modelos (a y b)."  +  "Ultimo motivo: ..."
 * Generica: sirve a cualquier familia cuyos clips tengan respaldo.
 */
export function leerMotivosDelMotor(texto) {
  const lineas = String(texto || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\[\w+\]\s?/, ''));
  const out = new Map();
  const archivoDe = (que, n) => `${/^b-roll$/i.test(que) ? 'broll' : 'toma'}-${n}.mp4`;
  const claseDe = (t) => {
    const c = clasificarFallo(t);
    return c === 'contenido' ? 'contenido' : c === 'servidor' || c === 'red' ? 'servidor' : 'otro';
  };
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    let m = l.match(/^\s*!\s+(toma|B-roll) (\d+)\b[^:]*:\s*(.*)$/i);
    if (m) {
      const ml = lineas.slice(i + 1, i + 4).find((x) => /^\s*Motivo:/.test(x));
      const motivo = ml ? ml.replace(/^\s*Motivo:\s*/, '').trim() : '';
      const contenido = /rechaz\w* por contenido/i.test(m[3]);
      out.set(archivoDe(m[1], m[2]), { clase: contenido ? 'contenido' : claseDe(motivo), texto: motivo.slice(0, 500) });
      continue;
    }
    m = l.match(/^\s*(toma|B-roll) (\d+)\b.*\bfallo con los dos modelos/i);
    if (m) {
      const archivo = archivoDe(m[1], m[2]);
      const ul = lineas.slice(i + 1, i + 3).find((x) => /Ultimo motivo:/.test(x));
      const ultimo = ul ? ul.replace(/^.*Ultimo motivo:\s*/, '').trim() : '';
      const antes = out.get(archivo);
      out.set(archivo, {
        clase: antes?.clase === 'contenido' ? 'contenido' : claseDe(ultimo),
        texto: (antes?.texto || ultimo).slice(0, 500),
        sinClip: true,
      });
    }
  }
  return out;
}

/** Despues de una corrida de videos: anota de que modelo salio cada clip nuevo (y por que, si fue del respaldo). */
function anotarModelos(ctx, { desde, texto }) {
  const reg = leerJSON(rutaModelos(ctx)) || { clips: {} };
  reg.clips ||= {};
  const motivos = leerMotivosDelMotor(texto);
  const log = leerJSON(path.join(ctx.carpeta, 'video', 'log-modelos.json'));
  const deEsta = log && Date.parse(log.generado) >= desde - 1000 && Array.isArray(log.clips) ? log.clips : [];
  for (const x of deEsta) {
    if (!x?.archivo) continue;
    const h = huella(path.join(ctx.carpeta, 'video', x.archivo));
    if (!h) continue;
    const antes = reg.clips[x.archivo] || {};
    if (mismaHuella(antes.huella, h)) continue; // ya anotado (este log trae tambien lo de antes)
    const motivo = x.respaldo ? motivos.get(x.archivo) || null : null;
    reg.clips[x.archivo] = {
      modelo: x.modelo || null,
      respaldo: Boolean(x.respaldo),
      huella: h,
      fecha: ahora(),
      ...(motivo ? { motivo: { clase: motivo.clase, texto: motivo.texto } } : {}),
      historial: [...(antes.historial || []), { modelo: x.modelo || null, respaldo: Boolean(x.respaldo), fecha: ahora() }].slice(-8),
    };
  }
  // Los que no salieron con ninguno de los dos modelos: por que (un rechazo de contenido se arregla con la frase).
  for (const [archivo, mo] of motivos) {
    if (!mo.sinClip || huella(path.join(ctx.carpeta, 'video', archivo))) continue;
    reg.clips[archivo] = { ...(reg.clips[archivo] || {}), fallo: { clase: mo.clase, texto: mo.texto, fecha: ahora() } };
  }
  escribirJSON(rutaModelos(ctx), reg);
  return reg;
}

/**
 * Como esta hoy el clip de una toma: { hay, huella, respaldo: true|false|null (no se sabe), modelo, motivo, fallo }.
 * respaldo null = el clip cambio sin pasar por la app (o es de antes): no se sabe de que modelo salio.
 */
function estadoDelClip(ctx, n, reg = leerJSON(rutaModelos(ctx))) {
  const archivo = `toma-${n}.mp4`;
  const h = huella(rutaClip(ctx, n));
  const e = reg?.clips?.[archivo];
  if (!h) return { hay: false, fallo: e?.fallo || null };
  if (e?.huella && mismaHuella(e.huella, h)) return { hay: true, huella: h, respaldo: Boolean(e.respaldo), modelo: e.modelo || null, motivo: e.motivo || null };
  return { hay: true, huella: h, respaldo: null, modelo: null, motivo: null };
}

// ---------------------------------------------------------------- 1. validar

async function validar(ctx) {
  const r = await ctx.correr('validar-manifiesto.js', [`${ctx.carpetaArg}/manifiesto.json`]);
  if (r.cancelado) return { cancelado: true };
  if (r.codigo === 0) return { ok: true };
  const errores = String(r.texto)
    .split(/\r?\n/)
    .filter((l) => /^\s*ERROR\b/.test(l))
    .map((l) => l.trim());
  return {
    ok: false,
    error: {
      mensaje: 'El guion quedó con un error técnico y así no lo puedo producir. Pide un cambio en el guion para que la IA lo corrija.',
      motivo: 'guion',
      detalle: errores.join('\n') || ultimasLineas(r.texto),
    },
  };
}

// ---------------------------------------------------------------- 2. saldo

const CREDITOS_SUNO = 12;
const hayMusica = (carpeta) => listar(path.join(carpeta, 'musica')).some((n) => /\.(mp3|wav|m4a|ogg|flac)$/i.test(n));

async function saldo(ctx) {
  const { leerPlanDeCosto } = await import('./voz-en-off.js');
  const r = await ctx.correr('producir.js', [ctx.carpetaArg, '--solo-plan']);
  if (r.cancelado) return { cancelado: true };
  if (r.codigo !== 0) return fallo(r, { que: 'la cuenta de lo que falta producir' });
  const plan = leerPlanDeCosto(r.texto);
  let saldoActual = plan.saldo;
  for (let intento = 0; saldoActual === null; ) {
    saldoActual = await consultarSaldoKie();
    if (saldoActual !== null) break;
    if (!(await hayConexion())) {
      if (!(await ctx.esperarConexion())) return { cancelado: true };
    } else if (intento < ESPERAS_REINTENTO_MS.length) {
      if (!(await ctx.esperar(ESPERAS_REINTENTO_MS[intento++], 'No pude consultar tu saldo de kie: lo intento de nuevo en un momento.'))) return { cancelado: true };
    } else break;
  }
  if (saldoActual === null) {
    return { ok: false, error: { mensaje: 'No pude consultar tu saldo de kie. Revisa tu clave de kie en Ajustes y toca “Continuar”.', motivo: 'clave', detalle: ultimasLineas(r.texto) } };
  }
  ctx.conductor.saldoInicial = { creditos: saldoActual, fecha: ahora() };
  ctx.guardar();
  const hace = (plan.total || 0) + (hayMusica(ctx.carpeta) ? 0 : CREDITOS_SUNO);
  // lo que se calcula gastar (la pantalla lo muestra junto al saldo)
  ctx.conductor.costoPlan = { creditos: hace, fecha: ahora() };
  if (plan.noAlcanza || saldoActual < hace) return { pausa: { motivo: 'saldo', mensaje: mensajeDeFallo('saldo') } };
  return { ok: true };
}

// ---------------------------------------------------------------- 3. imagenes y videos

/** Las imagenes de una toma que tienen que estar para pedir su clip. */
const imagenesDeToma = (t) => [`toma-${t.n}-inicial.png`, ...(t.tipo === 'B' ? [`toma-${t.n}-final.png`] : [])];
const faltaImagen = (ctx, t) => imagenesDeToma(t).some((n) => !existe(path.join(ctx.carpeta, 'img', n)));

async function imagenesYVideos(ctx) {
  // producir.js: en objeto parlante, imagenes y videos a la vez (cada clip apenas estan sus imagenes).
  const desde = Date.now();
  const r = await ctx.correr('producir.js', [ctx.carpetaArg, '--si'], { que: ['imagenes', 'videos'] });
  if (r.cancelado) return { cancelado: true };
  const reg = anotarModelos(ctx, { desde, texto: r.texto });
  const m = leerManifiesto(ctx);
  const tomas = tomasHabladas(m);
  const delRespaldo = tomas.filter((t) => estadoDelClip(ctx, t.n, reg).respaldo === true).length;
  const nota = delRespaldo ? `${delRespaldo === 1 ? 'Un clip salió' : `${delRespaldo} clips salieron`} del modelo de respaldo: en la revisión se rehace${delRespaldo === 1 ? '' : 'n'} con el principal.` : null;
  if (r.codigo === 0) return { ok: true, nota };
  // Un clip que los DOS modelos rechazaron por contenido no frena el anuncio: si es de una toma, en la revision Claude
  // reescribe su frase; si es un B-roll, el montaje sigue sin el (el informe lo dice). Solo si las imagenes salieron
  // todas y lo unico que falta son clips con ese motivo.
  if (r.clase !== 'saldo' && m) {
    const faltan = [...tomas.map((t) => `toma-${t.n}.mp4`), ...(m.broll || []).map((b) => `broll-${b.n}.mp4`)].filter((a) => !huella(path.join(ctx.carpeta, 'video', a)));
    const porContenido = faltan.length && faltan.every((a) => reg.clips?.[a]?.fallo?.clase === 'contenido');
    if (porContenido && tomas.every((t) => !faltaImagen(ctx, t))) {
      const escenas = faltan.filter((a) => a.startsWith('toma-')).length;
      const notaFaltan = escenas
        ? `${escenas === 1 ? 'Una escena no salió' : `${escenas} escenas no salieron`}: el modelo de video rechazó su frase. En la revisión se reescribe y se hace de nuevo.`
        : `${faltan.length === 1 ? 'Un B-roll no salió' : `${faltan.length} B-roll no salieron`} (el modelo de video no los aceptó): el anuncio va sin ${faltan.length === 1 ? 'él' : 'ellos'}.`;
      return { ok: true, nota: [nota, notaFaltan].filter(Boolean).join(' ') };
    }
  }
  return fallo(r, { que: 'las imágenes y los videos' });
}

// ---------------------------------------------------------------- 4. la revision de los clips hablados

const rutaRevisionClaude = (ctx) => path.join(dirApp(ctx), 'revision-clips.json');
const rutaRechazoClaude = (ctx) => path.join(dirApp(ctx), 'rechazo.json');

/** Claude simulado: solo en modo prueba y si no se pidio uno (el de verdad con ANUNCIOS_REVISION_REAL=1, o el falso). */
const claudeSimulado = () => modoPrueba() && process.env.ANUNCIOS_REVISION_REAL !== '1' && !process.env.ANUNCIOS_CLAUDE_BIN;

/** Lo que tuvo mal el habla de un clip, en palabras del usuario (sin segundos ni nombres tecnicos). */
export function describirHabla(h) {
  if (!h) return null;
  if (/no oyo ninguna/i.test(h.motivo || '')) return 'No se le oye decir su frase';
  if (/no dice el guion/i.test(h.motivo || '')) return 'Dice otra cosa, no su frase';
  const partes = [];
  for (const x of Array.isArray(h.agregadas) ? h.agregadas : []) {
    const t = String(x.texto || '').trim();
    if (!t) continue;
    if (x.tipo === 'repetida') partes.push(`repitió «${t}»`);
    else if (x.tipo === 'trabada') partes.push(`se trabó en «${t}»`);
    else if (x.tipo === 'muletilla') partes.push(`dijo «${t}» de más`);
    else if (x.tipo === 'cambiada') partes.push(`dijo «${t}» en vez de «${x.en_lugar_de}»`);
    else partes.push(`agregó «${t}»`);
  }
  if (Array.isArray(h.omitidas) && h.omitidas.length) partes.push(`no dijo «${h.omitidas.join(' ')}»`);
  if (h.despues) partes.push(`siguió hablando después de su frase («${h.despues}»)`);
  if (!partes.length) partes.push(/no oyo ninguna/i.test(h.motivo || '') ? 'no se le oye decir su frase' : 'no dijo su frase como está en el guion');
  const texto = partes.join('; ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Lo que se oyo en una toma, si es de ESTE clip y de ESTA frase. */
function hablaVigente(ctx, t, e, habla = leerJSON(rutaHabla(ctx.carpeta))?.tomas || {}) {
  const h = habla[String(t.n)];
  if (!h || !e?.huella || !mismaHuella(h.huella, e.huella) || h.linea !== t.linea) return null;
  return h;
}

// ---- respaldos de una toma (antes de tocarla) ----

/** Copia con su misma fecha: un clip que vuelve de su respaldo sigue siendo el mismo (su huella no cambia). */
function copiarSiExiste(de, a) {
  if (!existe(de)) return false;
  fs.mkdirSync(path.dirname(a), { recursive: true });
  fs.copyFileSync(de, a);
  try {
    const st = fs.statSync(de);
    fs.utimesSync(a, st.atime, st.mtime);
  } catch {
    /* sin la fecha, el clip se vuelve a escuchar (centavos) */
  }
  return true;
}

function respaldarToma(ctx, t) {
  const dir = path.join(dirClips(ctx), 'respaldo', `toma-${t.n}`);
  fs.rmSync(dir, { recursive: true, force: true });
  for (const nombre of imagenesDeToma(t)) copiarSiExiste(path.join(ctx.carpeta, 'img', nombre), path.join(dir, 'img', nombre));
  copiarSiExiste(rutaClip(ctx, t.n), path.join(dir, 'video', `toma-${t.n}.mp4`));
  const m = leerManifiesto(ctx);
  escribirJSON(path.join(dir, 'toma.json'), (m.tomas || []).find((x) => x.n === t.n));
  const g = leerJSON(path.join(dirApp(ctx), 'guion.json'));
  const parte = (g?.partes || []).find((p) => p.n === t.n);
  if (parte) escribirJSON(path.join(dir, 'parte.json'), parte);
}

/** La toma vuelve a como estaba: sus imagenes, su clip, su entrada del manifiesto (solo la suya) y su parte del guion. */
function restaurarToma(ctx, n) {
  const dir = path.join(dirClips(ctx), 'respaldo', `toma-${n}`);
  for (const sub of ['img', 'video']) {
    for (const nombre of listar(path.join(dir, sub))) copiarSiExiste(path.join(dir, sub, nombre), path.join(ctx.carpeta, sub, nombre));
  }
  const toma = leerJSON(path.join(dir, 'toma.json'));
  if (toma) {
    const rutaM = path.join(ctx.carpeta, 'manifiesto.json');
    const m = leerJSON(rutaM);
    const i = (m?.tomas || []).findIndex((x) => x.n === n);
    if (i !== -1) {
      m.tomas[i] = toma;
      escribirJSON(rutaM, m);
    }
  }
  const parte = leerJSON(path.join(dir, 'parte.json'));
  if (parte) {
    const rutaG = path.join(dirApp(ctx), 'guion.json');
    const g = leerJSON(rutaG);
    const i = (g?.partes || []).findIndex((p) => p.n === n);
    if (i !== -1) {
      g.partes[i] = parte;
      escribirJSON(rutaG, g);
    }
  }
}

// ---- el rechazo de contenido: la frase nueva ----

/**
 * Pone los cambios de frase de un rechazo en la linea y en la misma frase dentro del prompt de video. Devuelve
 * { linea, prompt_video } o tira un Error con lo que no se puede (en espanol, para que Claude lo corrija). Generica:
 * `toma` es cualquier pieza con `linea` y `prompt_video` (las A/B/C de objeto parlante, un bloque R de UGC...).
 */
export function aplicarCambiosDeFrase(toma, cambios) {
  const linea = String(toma?.linea || '');
  const prompt = String(toma?.prompt_video || '');
  let nueva = linea;
  for (const c of cambios || []) {
    if (!c?.antes || !nueva.includes(c.antes)) throw new Error(`«${c?.antes}» no está tal cual en la frase de la toma ${toma?.n}: cópialo de la línea, con sus tildes y signos.`);
    nueva = nueva.split(c.antes).join(c.nueva);
  }
  let promptNuevo;
  if (prompt.includes(linea)) promptNuevo = prompt.split(linea).join(nueva);
  else {
    // la frase del prompt no es la linea entera (otro estilo): se cambia cada pedazo donde este
    promptNuevo = prompt;
    for (const c of cambios) {
      if (!promptNuevo.includes(c.antes)) throw new Error(`La frase de la toma ${toma?.n} no está tal cual dentro de su prompt de video: no puedo cambiarla en los dos lugares.`);
      promptNuevo = promptNuevo.split(c.antes).join(c.nueva);
    }
  }
  return { linea: nueva, prompt_video: promptNuevo };
}

/**
 * Valida lo que escribio Claude en la tarea "rechazo" (esquema rechazo.json + lo que el esquema no puede decir).
 *   tomas      las del manifiesto que se le pidieron, cada una con n, linea y prompt_video
 *   probadas   Map n -> [lineas ya probadas] (no se repite ninguna)
 * Devuelve { clips: [{ toma, cambios, motivo, linea, prompt_video }], errores }.
 */
export function validarRechazo(valor, { tomas, probadas = new Map() }) {
  const errores = [];
  const clips = [];
  const lista = Array.isArray(valor?.clips) ? valor.clips : null;
  if (!lista) return { clips, errores: ['rechazo.json tiene que traer "clips": una entrada por cada escena rechazada.'] };
  const pedidas = new Map(tomas.map((t) => [t.n, t]));
  const vistas = new Set();
  for (const [i, x] of lista.entries()) {
    const donde = `clips[${i}]`;
    const t = pedidas.get(Number(x?.toma));
    if (!t) {
      errores.push(`${donde}: la toma ${x?.toma} no es una de las escenas rechazadas (${[...pedidas.keys()].join(', ')}).`);
      continue;
    }
    if (vistas.has(t.n)) {
      errores.push(`${donde}: la toma ${t.n} está dos veces.`);
      continue;
    }
    const cambios = Array.isArray(x.cambios) ? x.cambios : [];
    if (!cambios.length || cambios.length > 3) {
      errores.push(`${donde} (toma ${t.n}): "cambios" tiene que traer de 1 a 3 cambios.`);
      continue;
    }
    if (typeof x.motivo !== 'string' || x.motivo.trim().length < 3) {
      errores.push(`${donde} (toma ${t.n}): falta "motivo" (una frase para el usuario).`);
      continue;
    }
    const malos = [];
    for (const c of cambios) {
      if (typeof c?.antes !== 'string' || typeof c?.nueva !== 'string' || !c.antes.trim() || !c.nueva.trim()) malos.push('cada cambio necesita "antes" y "nueva" con texto');
      else if (c.antes === c.nueva) malos.push(`«${c.antes}» quedó igual`);
      else if (/["“”]/.test(c.nueva)) malos.push(`«${c.nueva}» lleva comillas dobles: sácalas`);
      else {
        const dif = Math.abs(contarPalabras(c.nueva) - contarPalabras(c.antes));
        if (dif > Math.max(2, Math.ceil(contarPalabras(c.antes) * 0.3))) malos.push(`«${c.nueva}» no tiene el largo de «${c.antes}» (la duración de la toma está atada a sus palabras)`);
      }
    }
    if (malos.length) {
      errores.push(`${donde} (toma ${t.n}): ${malos.join('; ')}.`);
      continue;
    }
    let r;
    try {
      r = aplicarCambiosDeFrase(t, cambios);
    } catch (e) {
      errores.push(`${donde}: ${e.message}`);
      continue;
    }
    if (r.linea === t.linea) {
      errores.push(`${donde} (toma ${t.n}): la frase quedó igual que antes.`);
      continue;
    }
    if ((probadas.get(t.n) || []).some((l) => l.trim() === r.linea.trim())) {
      errores.push(`${donde} (toma ${t.n}): esa frase ya se probó y también la rechazaron. Prueba otra.`);
      continue;
    }
    if (contarPalabras(r.linea) > contarPalabras(t.linea) + 2) {
      errores.push(`${donde} (toma ${t.n}): la frase quedó más larga que antes; tiene que durar lo mismo.`);
      continue;
    }
    vistas.add(t.n);
    clips.push({ toma: t.n, cambios: cambios.map((c) => ({ antes: c.antes, nueva: c.nueva })), motivo: x.motivo.trim().slice(0, 300), linea: r.linea, prompt_video: r.prompt_video });
  }
  for (const n of pedidas.keys()) if (!vistas.has(n) && !errores.some((e) => mencionaToma(e, n))) errores.push(`Falta la toma ${n}: cada escena rechazada lleva su entrada.`);
  return { clips, errores };
}

/**
 * Valida lo que escribio Claude en la tarea "revisar-clips".
 *   tomas         las del manifiesto que se le mostraron
 *   obligatorias  los n que TIENEN que estar (no dijeron su frase limpia)
 *   opciones      los valores de "rehacer" que acepta el estilo (aca 'clip' y 'toma')
 *   brolls        los B-roll del manifiesto que se le mostraron (van con "broll": true; sin frase)
 *   alTopeBroll   los n de esos B-roll que ya no se rehacen (su tope o la ultima vuelta): solo se dice como quedaron
 * Cada B-roll mostrado tiene que estar dicho: en "clips" (mal), "bien_broll" o, si ya no se rehace, "mal_broll".
 * Devuelve { pedidos: [{ toma, rehacer, motivo, prompts }], pedidosBroll: [{ broll, rehacer, motivo, prompts }],
 *   malBroll: [{ n, motivo }] (los que se vieron mal y ya no se rehacen), errores }.
 */
export function validarRevisionClips(valor, { tomas, obligatorias = [], opciones = ['clip', 'toma'], brolls = [], alTopeBroll = [] }) {
  const errores = [];
  const pedidos = [];
  const pedidosBroll = [];
  const malBroll = [];
  const lista = Array.isArray(valor?.clips) ? valor.clips : Array.isArray(valor) ? valor : null;
  if (!lista) return { pedidos, pedidosBroll, malBroll, errores: ['revision-clips.json tiene que traer "clips": [] si todo está bien, o los clips a rehacer.'] };
  const porN = new Map(tomas.map((t) => [t.n, t]));
  const brollPorN = new Map(brolls.map((b) => [b.n, b]));
  const vistas = new Set();
  const vistosBroll = new Set();
  for (const [i, x] of lista.entries()) {
    const donde = `clips[${i}]`;
    if (x?.broll === true) {
      const b = brollPorN.get(Number(x?.toma));
      if (!b) {
        errores.push(`${donde}: el B-roll ${x?.toma} no es uno de los que te mostré (${[...brollPorN.keys()].join(', ') || 'ninguno'}).`);
        continue;
      }
      if (vistosBroll.has(b.n)) {
        errores.push(`${donde}: el B-roll ${b.n} está dos veces.`);
        continue;
      }
      if (alTopeBroll.includes(b.n)) {
        // ya no se rehace: lo que vio va al informe (los prompts que haya escrito no se usan)
        vistosBroll.add(b.n);
        malBroll.push({ n: b.n, motivo: typeof x.motivo === 'string' && x.motivo.trim() ? x.motivo.trim().slice(0, 300) : null });
        continue;
      }
      const v = validarPedidoDeBroll(x, b, { donde, opciones });
      if (v.error) {
        errores.push(v.error);
        continue;
      }
      vistosBroll.add(b.n);
      pedidosBroll.push(v.pedido);
      continue;
    }
    const t = porN.get(Number(x?.toma));
    if (!t) {
      const pista = brollPorN.has(Number(x?.toma)) ? ` Si es el B-roll ${x?.toma}, agrega "broll": true.` : '';
      errores.push(`${donde}: la toma ${x?.toma} no es uno de los clips que te mostré (${[...porN.keys()].join(', ') || 'ninguna'}).${pista}`);
      continue;
    }
    if (vistas.has(t.n)) {
      errores.push(`${donde}: la toma ${t.n} está dos veces.`);
      continue;
    }
    const rehacer = String(x.rehacer || '');
    if (!opciones.includes(rehacer)) {
      errores.push(`${donde} (toma ${t.n}): "rehacer" tiene que ser ${opciones.map((o) => `"${o}"`).join(' o ')}.`);
      continue;
    }
    const falta = [];
    if (typeof x.motivo !== 'string' || x.motivo.trim().length < 3) falta.push('motivo');
    if (typeof x.prompt_video !== 'string' || x.prompt_video.trim().length < 20) falta.push('prompt_video');
    if (rehacer === 'toma') {
      if (typeof x.prompt_imagen_inicial !== 'string' || x.prompt_imagen_inicial.trim().length < 40) falta.push('prompt_imagen_inicial');
      if (t.tipo === 'B' && (typeof x.prompt_imagen_final !== 'string' || x.prompt_imagen_final.trim().length < 40)) falta.push('prompt_imagen_final (la toma es tipo B)');
    }
    if (falta.length) {
      errores.push(`${donde} (toma ${t.n}): falta ${falta.join(', ')}.`);
      continue;
    }
    // el B-roll N va encima de la toma N: sin "broll": true, su prompt nuevo se pagaria como el de la toma
    const bMismoN = brollPorN.get(t.n);
    const pistaBroll = bMismoN ? ` Si es el B-roll ${t.n}, agrega "broll": true (y no le pongas la frase).` : '';
    if (bMismoN && pareceDelBroll(x.prompt_video, bMismoN, t)) {
      errores.push(`${donde} (toma ${t.n}): ese prompt_video sale del B-roll ${t.n}, no de la toma.${pistaBroll} Si es la toma, parte de su propio prompt_video.`);
      continue;
    }
    if (!x.prompt_video.includes(t.linea)) {
      errores.push(`${donde} (toma ${t.n}): el prompt_video tiene que traer la frase del personaje tal cual, letra por letra: «${t.linea}».${pistaBroll}`);
      continue;
    }
    const mismoVideo = x.prompt_video.trim() === String(t.prompt_video || '').trim();
    const mismaImagen = rehacer !== 'toma' || x.prompt_imagen_inicial.trim() === String(t.prompt_imagen_inicial || '').trim();
    if (mismoVideo && mismaImagen) {
      errores.push(`${donde} (toma ${t.n}): los prompts son los mismos de antes; rehacer con el mismo prompt da lo mismo.`);
      continue;
    }
    vistas.add(t.n);
    pedidos.push({
      toma: t.n,
      rehacer,
      motivo: x.motivo.trim().slice(0, 300),
      prompts: {
        prompt_video: x.prompt_video,
        ...(rehacer === 'toma' ? { prompt_imagen_inicial: x.prompt_imagen_inicial, ...(t.tipo === 'B' ? { prompt_imagen_final: x.prompt_imagen_final } : {}) } : {}),
      },
    });
  }
  for (const n of obligatorias) {
    if (!vistas.has(n) && !errores.some((e) => mencionaToma(e, n))) {
      errores.push(`Falta la toma ${n}: no dijo su frase limpia (lo midió el transcriptor) y tiene que ir en tu lista con su prompt de video nuevo.`);
    }
  }
  // los B-roll que no van en "clips": "bien_broll" o "mal_broll"; ninguno sin decir (si no, uno malo pasaria como bueno)
  if (!Array.isArray(valor) && brolls.length) {
    const c = cuentasDeBroll(valor, { mostrados: brolls.map((b) => b.n), conPedido: [...vistosBroll], alTope: alTopeBroll, errores });
    malBroll.push(...c.mal);
    errores.push(...c.errores);
  }
  return { pedidos, pedidosBroll, malBroll, errores };
}

// ---- las sesiones de Claude ----

/**
 * Una sesion de Claude de la revision, una sola vez por vuelta (lo que escribe queda en el estado: al retomar no se
 * repite). Devuelve la sesion ({ hecha, ok, datos, error }) o { cancelado } / { limite }.
 */
async function sesionDeClaude(ctx, ronda, clave, guardarEstado, { tipo, prompt, archivo, verificar, frase }) {
  const s = (ronda.sesiones[clave] ||= {});
  if (s.hecha) return s;
  const claude = await ctx.claude();
  if (!claude?.lanzarSesion) {
    Object.assign(s, { hecha: true, ok: false, error: 'sin-claude', fecha: ahora() });
    guardarEstado();
    return s;
  }
  const rel = `temp/${ctx.slug}`;
  s.uuid ||= crypto.randomUUID();
  const maxIntentos = Math.max(1, Number(process.env.ANUNCIOS_REVISION_INTENTOS) || 2);
  let r = null;
  for (let intento = (s.intentos || 0) + 1; intento <= maxIntentos; intento++) {
    s.intentos = intento;
    s.fecha = ahora();
    guardarEstado();
    fs.rmSync(archivo, { force: true });
    ctx.avance(frase);
    r = await claude.lanzarSesion({
      tipo,
      cwd: RAIZ,
      uuid: s.uuid,
      resume: intento > 1,
      prompt: intento > 1 ? `Sigue con la tarea de antes y termina ${relRaiz(archivo)}.\n\n${prompt}` : prompt,
      herramientas: ['Read', 'Glob', 'Grep', 'Write', 'Edit'],
      // lee el anuncio y la skill; escribe SOLO su archivo (el manifiesto lo cambia la app, despues de revisarlo)
      permitidas: [`Read(./${rel}/**)`, `Read(./.claude/skills/${SKILL}/**)`, 'Glob', 'Grep', `Write(./${relRaiz(archivo)})`, `Edit(./${relRaiz(archivo)})`],
      prohibidas: typeof claude.prohibidasComunes === 'function' ? claude.prohibidasComunes({ terminal: false }) : ['Bash', 'PowerShell', 'WebFetch', 'WebSearch'],
      // (describirHerramienta dice "fotos de tu producto" para cualquier imagen fuera de img/: aca son las tiras)
      alProgreso: (f) => ctx.avance(f === 'Mirando las fotos de tu producto' ? 'Mirando los clips' : f === 'Guardando' ? 'Anotando lo que vio' : f),
      timeoutMs: 30 * 60000,
      registro: path.join(dirApp(ctx), 'registro', `${clave}-claude.jsonl`),
      verificar,
      senal: ctx.senal, // Detener corta tambien a Claude
    });
    if (r?.ok) {
      Object.assign(s, { hecha: true, ok: true, datos: r.verificacion?.datos ?? null, fecha: ahora() });
      guardarEstado();
      return s;
    }
    if (ctx.senal?.aborted || r?.cancelado) {
      s.intentos = intento - 1; // un intento cortado por Detener no cuenta
      guardarEstado();
      return { cancelado: true };
    }
    if (r?.limite) {
      s.intentos = intento - 1; // sigue cuando se renueve el plan
      guardarEstado();
      return { limite: true, error: r.error || null };
    }
    if (r?.sinClaude || r?.sinSesion) break;
  }
  Object.assign(s, { hecha: true, ok: false, error: r?.error || 'no terminó', fecha: ahora() });
  guardarEstado();
  return s;
}

const LIMITE_CLAUDE = {
  ok: false,
  error: { mensaje: 'Se acabó por ahora el uso de tu plan de Claude: la revisión de los clips sigue cuando se renueve. Lo ya hecho no se repite.', motivo: 'limite-claude' },
};

// ---- lo que se le dice a Claude ----

const DEFECTOS = [
  'el personaje que habla no mueve la boca, la mueve sin seguir la frase, o la dice otro personaje del cuadro;',
  'el objeto se convirtió en una persona disfrazada, o le salió un cuerpo humano que reemplaza su forma (tiene que seguir siendo el objeto, reconocible);',
  'el producto cambiado: otra forma, otras proporciones, otros colores o la etiqueta distinta a la foto real;',
  'letras o textos inventados o ilegibles, subtítulos o marcas de agua dentro del cuadro;',
  'brazos, manos o caras deformes: dedos de más, miembros pegados, ojos o boca rotos, o algo que se deforma en el movimiento;',
  'un personaje fijo que no se parece a su hoja (otra forma, otro color, otra cara);',
  'no es animación 3D estilo Pixar: parece foto real, dibujo plano, anime o plastilina;',
  'la escena no muestra lo que dice su frase, o aparecen personas u objetos que no van.',
];

function reglasPrompt() {
  return [
    '- `rehacer`: "clip" si la imagen de la toma está bien y el problema está en el movimiento o en lo que dice (es lo normal cuando no dijo su frase limpia): se rehace solo el clip, desde la misma imagen. "toma" si la imagen misma está mal (el producto cambiado, el objeto hecho persona, letras, una deformación desde el primer cuadro): se rehacen la imagen y el clip.',
    '- `prompt_video` (siempre): parte del de ahora (está en el contexto). Deja igual la primera línea ("Duración: …"), la frase que dice el personaje (entre comillas, letra por letra: no cambies ni una coma) y la línea del idioma ("Habla en …"). Cambia solo lo que ataca el problema: la cámara, el movimiento, la expresión. Para el habla agrega una instrucción clara en inglés, por ejemplo: "Says the line exactly once, word for word, with no extra words before or after it, then holds the expression in silence."',
    `- Con "toma": también \`prompt_imagen_inicial\` (y \`prompt_imagen_final\` si la toma es tipo B), con las reglas de la skill (${path.join(RAIZ, '.claude', 'skills', SKILL, 'SKILL.md')}): los dos bloques universales y la descripción del personaje se copian tal cual, y el objeto sigue siendo el objeto.`,
    '- Nunca cambies la frase, la duración ni el tipo de la toma.',
  ]
    .map((l) => `   ${l}`)
    .join('\n');
}

function textoDeRevision(ctx, { m, tomas, habla, estado, obligatorias, brolls = [], alTopeBroll = [] }) {
  const C = ctx.carpeta;
  const en = (...p) => path.join(C, ...p);
  const g = leerJSON(path.join(dirApp(ctx), 'guion.json'));
  const quien = (n) => (g?.partes || []).find((p) => p.n === n)?.quien || null;
  const foto = ['producto.png', 'producto.jpg', 'producto.jpeg', 'producto.webp'].find((n) => existe(en(n)));
  const clips = tomas
    .map((t) => {
      const h = habla[t.n];
      const vez = ctx.conductor.rehechos?.[`toma-${t.n}`] || 0;
      // lo que ya se probo para que se vea o se oiga bien (una frase nueva por un rechazo no es una idea de prompt)
      const historial = (estado.clips[t.n]?.historial || []).filter((x) => x.resultado === 'rehecho' && x.como !== 'rechazo').map((x) => x.motivo).filter(Boolean);
      const lineas = [
        `- Toma ${t.n} (tipo ${t.tipo}, ${t.duracion} s)${quien(t.n) ? ` — habla: ${quien(t.n)}` : ''}.`,
        `  Su frase: «${t.linea}»`,
        `  Tira del clip (5 cuadros): ${en('qa', `toma-${t.n}.jpg`)}`,
        `  Imagen de la toma: ${en('img', `toma-${t.n}-inicial.png`)}${t.tipo === 'B' ? ` (y la final: ${en('img', `toma-${t.n}-final.png`)})` : ''}`,
        h ? `  Lo que se oyó: «${h.oido || '(nada)'}»` : '  Lo que se oyó: no se pudo escuchar este clip.',
        h ? (obligatorias.includes(t.n) ? `  NO DIJO SU FRASE LIMPIA: ${h.descripcion}.` : '  Habla: dijo su frase completa y limpia.') : null,
        vez ? `  Ya se rehizo ${vez === 1 ? 'una vez' : `${vez} veces`}${historial.length ? ` (${historial.join('; ')}): no repitas esa idea` : ''}.` : null,
        `  Contexto para reescribirla: ${path.join(dirClips(ctx), `contexto-toma-${t.n}.txt`)}`,
      ];
      return lineas.filter(Boolean).join('\n');
    })
    .concat(
      // los B-roll que entran en el video: sin frase, se miran por como se ven
      brolls.map((b) =>
        entradaDeBroll({
          carpeta: C,
          b,
          m,
          vez: vecesDeBroll(estado.broll?.[b.n]),
          historial: (estado.broll?.[b.n]?.historial || []).filter((x) => x.resultado === 'rehecho').map((x) => x.motivo).filter(Boolean),
          contexto: existe(path.join(dirClips(ctx), `contexto-broll-${b.n}.txt`)) ? path.join(dirClips(ctx), `contexto-broll-${b.n}.txt`) : null,
          alTope: alTopeBroll.includes(b.n),
        })
      )
    )
    .join('\n\n');
  return textoTarea('tarea-revisar-clips', {
    carpeta: C,
    estilo: 'objeto parlante (un objeto, un ingrediente o una parte del cuerpo animado en 3D estilo Pixar que habla en primera persona, con la boca sincronizada)',
    clips,
    manifiesto: en('manifiesto.json'),
    img: en('img'),
    foto: foto ? `Mira con Read la foto real del producto: ${en(foto)}.` : 'Este anuncio no tiene foto del producto.',
    defectos: DEFECTOS.map((d) => `   - ${d}`).join('\n'),
    reglas: reglasPrompt(),
    opciones: '"clip" (solo el clip, desde la misma imagen) o "toma" (la imagen y el clip). En un B-roll, lo mismo: "clip", o "toma" con su "prompt_imagen" corregido.',
    archivo: rutaRevisionClaude(ctx),
    hayBroll: brolls.length > 0,
  });
}

function textoDeRechazo(ctx, { tomas, motivos, probadas }) {
  const g = leerJSON(path.join(dirApp(ctx), 'guion.json'));
  const parte = (n) => (g?.partes || []).find((p) => p.n === n) || {};
  const clips = tomas
    .map((t) => {
      const p = parte(t.n);
      const ya = probadas.get(t.n) || [];
      return [
        `- Toma ${t.n}${p.momento ? ` (${p.momento})` : ''}, ${t.duracion} s, ${contarPalabras(t.linea)} palabras${p.quien ? `; la dice ${p.quien}` : ''}.`,
        `  Su frase (\`linea\`): «${t.linea}»`,
        `  Lo que contestó el modelo de video: «${motivos.get(t.n) || 'rechazada por sus políticas de contenido'}»`,
        ya.length ? `  Ya se probaron (y también las rechazaron): ${ya.map((l) => `«${l}»`).join(' · ')}` : null,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
  return textoTarea('tarea-rechazo', {
    carpeta: ctx.carpeta,
    estilo: 'objeto parlante (el personaje dice su frase dentro del clip)',
    clips,
    manifiesto: path.join(ctx.carpeta, 'manifiesto.json'),
    skill: path.join(RAIZ, '.claude', 'skills', SKILL, 'SKILL.md'),
    donde:
      'En este estilo la frase es la `linea` de la toma y aparece entre comillas, letra por letra, dentro de su `prompt_video` (los dos en `manifiesto.json`). Tú solo escribes el cambio: no edites el manifiesto, lo pone la app en los dos lugares.',
    archivo: rutaRechazoClaude(ctx),
  });
}

/**
 * Un texto de server/claude/<nombre>.md con sus marcas (el mismo formato que textoClaude de claude.js). `hayBroll`
 * (si viene) deja o saca lo que la tarea dice de los B-roll (lib/rehacer-broll.js, seccionesDeBroll).
 */
function textoTarea(nombre, valores) {
  const leido = fs.readFileSync(path.join(RAIZ, 'app', 'server', 'claude', `${nombre}.md`), 'utf8');
  const crudo = Object.hasOwn(valores, 'hayBroll') ? seccionesDeBroll(leido, Boolean(valores.hayBroll)) : leido;
  return crudo
    .replace(/<!--[\s\S]*?-->\s*/g, '')
    .replace(/\{\{(\w+)\}\}/g, (todo, k) => (Object.hasOwn(valores, k) ? String(valores[k] ?? '') : todo))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** La forma que pide el esquema (sin depender de claude.js, que el conductor puede reemplazar en las pruebas). */
async function leerConEsquema(ruta, esquema) {
  if (!existe(ruta)) return { ok: false, errores: [`No encuentro ${relRaiz(ruta)}: escríbelo.`] };
  let datos;
  try {
    datos = JSON.parse(fs.readFileSync(ruta, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    return { ok: false, errores: [`${path.basename(ruta)} no es JSON válido (${e.message}). Revisa comillas dobles y comas.`] };
  }
  try {
    const c = await import('../claude.js');
    const errores = c.validarEsquema(datos, c.cargarEsquema(esquema)).map((e) => `${path.basename(ruta)} → ${e}`);
    if (errores.length) return { ok: false, errores };
  } catch {
    /* sin el validador de esquemas, valen los chequeos de la familia */
  }
  return { ok: true, datos };
}

// ---- simulacion (modo prueba sin Claude) ----

function rechazoSimulado(tomas) {
  return {
    clips: tomas.map((t) => {
      const palabra = String(t.linea).split(/\s+/).filter((w) => /^[\p{L}]{4,}$/u.test(w)).sort((a, b) => b.length - a.length)[0] || String(t.linea).split(/\s+/)[0];
      const nueva = palabra === palabra.toUpperCase() ? palabra.toLowerCase() : palabra.toUpperCase();
      return { toma: t.n, cambios: [{ antes: palabra, nueva }], motivo: 'Prueba: la app reescribe esta frase para probar el camino completo (modo prueba, sin Claude).' };
    }),
  };
}

function revisionSimulada(tomas, obligatorias, brolls = []) {
  return {
    bien_broll: brolls.map((b) => b.n),
    clips: tomas
      .filter((t) => obligatorias.includes(t.n))
      .map((t) => ({
        toma: t.n,
        rehacer: 'clip',
        motivo: 'Prueba: no dijo su frase limpia y la app rehace el clip (modo prueba, sin Claude).',
        prompt_video: `${t.prompt_video}\nSays the line exactly once, word for word, with no extra words before or after it.`,
      })),
    bien: tomas.filter((t) => !obligatorias.includes(t.n)).map((t) => t.n),
  };
}

// ---- la revision del habla (Scribe), en un proceso del motor ----

/** El script, relativo a produccion/ (ctx.correr corre "node produccion/<script>"). */
const SCRIPT_HABLA = path.relative(path.join(RAIZ, 'produccion'), ESTE_ARCHIVO);

async function escucharClips(ctx, numeros) {
  // Modo prueba: los clips del kie simulado son mudos. Se les pone la voz de su frase (voz-de-prueba.js, como el
  // podcast): si no, todos se rehacian hasta el tope y el informe decia que ningun personaje dijo su frase.
  if (modoPrueba()) {
    const m = leerManifiesto(ctx);
    for (const t of tomasHabladas(m).filter((x) => numeros.includes(x.n))) {
      try {
        await doblarClipDePrueba(path.join(ctx.carpeta, 'video', `toma-${t.n}.mp4`), t.linea, { semilla: `${ctx.slug}-${t.n}-${ctx.conductor?.rehechos?.[`toma-${t.n}`] || 0}` });
      } catch (e) {
        console.error(`[objeto-parlante] ${ctx.slug}: no pude ponerle voz de prueba a la toma ${t.n}:`, e?.message || e);
      }
    }
  }
  let faltan = [...numeros];
  for (let intento = 0; faltan.length && intento <= ESPERAS_REINTENTO_MS.length; intento++) {
    ctx.avance('Escuchando lo que dice cada personaje');
    const r = await ctx.correr(SCRIPT_HABLA, [ctx.carpetaArg, '--habla', '--tomas', faltan.join(',')], {
      que: ['scribe'],
      clipsDe: (texto) => [...String(texto).matchAll(/^\s*transcrito:\s+(\S+\.mp4)/gm)].map((x) => x[1]),
    });
    if (r.cancelado || ctx.senal?.aborted) return { cancelado: true };
    // una clave de ElevenLabs que no anda frena (los subtitulos tambien la necesitan); lo demas no frena el anuncio
    if (r.codigo !== 0 && ['clave', 'cuota-voz'].includes(r.clase)) return fallo(r, { que: 'la revisión de lo que dice cada clip' });
    // los que Scribe no pudo escuchar se prueban otra vez despues de una espera (lo ya escuchado no se vuelve a pedir)
    const oidos = leerJSON(rutaHabla(ctx.carpeta))?.tomas || {};
    faltan = faltan.filter((n) => !oidos[String(n)] || oidos[String(n)].error);
    if (!faltan.length) break;
    if (intento < ESPERAS_REINTENTO_MS.length) {
      if (!(await ctx.esperar(ESPERAS_REINTENTO_MS[intento], 'El servicio que escucha los clips no respondió: lo intento de nuevo en un momento.'))) return { cancelado: true };
    }
  }
  // si sigue sin responder, el anuncio sigue: esos clips quedan "sin escuchar" y van al informe
  return null;
}

/**
 * El contexto de cada toma y de cada B-roll (sus prompts de ahora y lo que no se toca), para que Claude escriba los
 * nuevos. Gratis.
 */
async function prepararContextos(ctx, tomas, brolls = []) {
  const piezas = [...tomas.map((t) => ['toma', t.n]), ...brolls.map((b) => ['broll', b.n])];
  for (const [que, n] of piezas) {
    const r = await ctx.correr('rehacer-toma.js', [ctx.carpetaArg, `--${que}`, String(n), '--contexto']);
    if (r.cancelado) return false;
    if (r.codigo === 0) {
      fs.mkdirSync(dirClips(ctx), { recursive: true });
      fs.writeFileSync(path.join(dirClips(ctx), `contexto-${que}-${n}.txt`), r.texto, 'utf8');
    }
  }
  return true;
}

/**
 * Una vuelta de la revision, la parte que MIRA (no paga nada): de que modelo es cada clip, lo que dice, las sesiones
 * de Claude y los pedidos de rehacer. Devuelve null (los pedidos quedan en ronda.pedidos) o lo que tiene que
 * devolver el paso (cancelado, un fallo, el limite de Claude).
 */
async function mirar(ctx, est, ronda, guardarEstado) {
  const m = leerManifiesto(ctx);
  const tomas = tomasHabladas(m);
  const rehechos = ctx.conductor.rehechos || {};
  const vez = (n) => rehechos[`toma-${n}`] || 0;
  const ultima = ronda.n >= MAX_VUELTAS + (est.extra || 0);
  const puede = (n) => !ultima && vez(n) < topeDe(est, n);

  // 1. lo que dice cada clip del modelo principal (solo los que cambiaron desde la ultima vez: no se paga dos veces)
  let reg = leerJSON(rutaModelos(ctx));
  const aEscuchar = tomas.filter((t) => {
    const e = estadoDelClip(ctx, t.n, reg);
    if (!e.hay || e.respaldo === true) return false;
    const h = hablaVigente(ctx, t, e);
    return !h || h.error;
  });
  if (aEscuchar.length) {
    const r = await escucharClips(ctx, aEscuchar.map((t) => t.n));
    if (r) return r;
  }
  const todoHabla = leerJSON(rutaHabla(ctx.carpeta))?.tomas || {};

  // 2. que le pasa a cada toma
  reg = leerJSON(rutaModelos(ctx));
  const habla = {};
  const casos = [];
  for (const t of tomas) {
    const e = estadoDelClip(ctx, t.n, reg);
    const h = e.hay && e.respaldo !== true ? hablaVigente(ctx, t, e, todoHabla) : null;
    if (h && !h.error) habla[t.n] = h;
    let que;
    if (!e.hay) que = e.fallo?.clase === 'contenido' ? 'rechazo' : 'falta';
    else if (e.respaldo === true) que = e.motivo?.clase === 'contenido' ? 'rechazo' : 'respaldo';
    else if (!h || h.error) que = 'sin-revisar';
    else que = h.limpio ? 'limpio' : 'habla';
    const motivo = e.motivo || e.fallo || null;
    // detalle: para el usuario (el informe); h.descripcion, con los segundos, va a Claude
    casos.push({ n: t.n, que, ...(motivo ? { motivo } : {}), ...(que === 'habla' ? { detalle: describirHabla(h) } : {}), ...(que === 'sin-revisar' && h?.error ? { detalle: h.error } : {}) });
    est.clips[t.n] = { ...(est.clips[t.n] || {}), ultimo: { que, ronda: ronda.n, fecha: ahora(), ...(que === 'habla' ? { detalle: describirHabla(h), oido: h.oido } : {}), ...(motivo ? { motivo } : {}) } };
  }
  ronda.casos = casos;
  guardarEstado();

  const pedidos = [];
  const tomaDe = (n) => tomas.find((t) => t.n === n);

  // Una sesion de Claude que ya no pudo (no el limite de uso: ese espera) no se vuelve a abrir en las vueltas
  // siguientes: gastaria el plan sin arreglar nada. Lo que necesitaba va al informe (o se rehace con el mismo prompt).
  const yaFallo = (clave) => (est.rondas || []).some((r) => r !== ronda && r.sesiones?.[clave]?.hecha && r.sesiones[clave].ok === false);

  // 3. rechazo de contenido -> Claude reescribe la frase
  const rechazos = casos.filter((c) => c.que === 'rechazo' && puede(c.n) && !est.clips[c.n]?.sinClaude);
  if (rechazos.length) {
    const tr = rechazos.map((c) => tomaDe(c.n));
    const probadas = new Map(tr.map((t) => [t.n, (est.clips[t.n]?.frases || []).map((f) => f.despues)]));
    const motivos = new Map(rechazos.map((c) => [c.n, c.motivo?.texto || null]));
    let datos = null;
    if (claudeSimulado()) {
      const s = (ronda.sesiones.rechazo ||= {});
      if (!s.hecha) Object.assign(s, { hecha: true, ok: true, simulada: true, datos: validarRechazo(rechazoSimulado(tr), { tomas: tr, probadas }).clips });
      datos = s.datos;
      guardarEstado();
    } else {
      const s = await sesionDeClaude(ctx, ronda, 'rechazo', guardarEstado, {
        tipo: 'rechazo',
        prompt: textoDeRechazo(ctx, { tomas: tr, motivos, probadas }),
        archivo: rutaRechazoClaude(ctx),
        frase: 'Claude está reescribiendo una frase que el modelo de video no aceptó',
        verificar: async () => {
          const l = await leerConEsquema(rutaRechazoClaude(ctx), 'rechazo');
          if (!l.ok) return l;
          const v = validarRechazo(l.datos, { tomas: tr, probadas });
          return v.errores.length ? { ok: false, errores: v.errores } : { ok: true, datos: v.clips };
        },
      });
      if (s.cancelado) return { cancelado: true };
      if (s.limite) return LIMITE_CLAUDE;
      datos = s.ok ? s.datos : null;
      if (!s.ok) for (const c of rechazos) est.clips[c.n].sinClaude = s.error || true;
    }
    for (const x of datos || []) {
      const c = rechazos.find((r) => r.n === x.toma);
      pedidos.push({ toma: x.toma, como: 'rechazo', motivo: x.motivo, cambios: x.cambios, kie: c?.motivo?.texto || null, fase: 'pendiente' });
    }
  }

  // 4. del respaldo por un error del servidor (o no salio por otra cosa): otra vez igual, despues de una espera
  for (const c of casos.filter((x) => (x.que === 'respaldo' || x.que === 'falta') && puede(x.n))) {
    pedidos.push({
      toma: c.n,
      como: 'reintentar',
      esperar: c.motivo?.clase !== 'otro',
      motivo: c.que === 'respaldo' ? 'Salió sin su frase (del modelo de respaldo): se hizo otra vez con el principal.' : 'No salió: se hizo otra vez.',
      fase: 'pendiente',
    });
  }

  // 5. Claude mira los clips: en la primera vuelta todos los del modelo principal; despues, los que se rehicieron y
  //    los que no dijeron su frase limpia. Los que no la dijeron se rehacen siempre (con su prompt nuevo, o con el
  //    mismo si Claude no pudo: lo que falla suele ser la tirada).
  const obligatorias = casos.filter((c) => c.que === 'habla' && puede(c.n)).map((c) => c.n);
  const aMirar = yaFallo('revision')
    ? []
    : casos
        .filter((c) => ['limpio', 'habla', 'sin-revisar'].includes(c.que) && puede(c.n))
        .filter((c) => ronda.n === 1 || c.que === 'habla' || est.clips[c.n]?.rehechaEnRonda === ronda.n - 1)
        .map((c) => tomaDe(c.n));
  // Los B-roll que entran en el video y tienen su clip: en la primera vuelta todos; despues, los que se rehicieron en
  // la anterior (tambien al tope o en la ultima vuelta: se mira como quedo, para el informe, aunque ya no se rehaga).
  const brollAMirar = yaFallo('revision') ? [] : brollQueSeMiran(ctx.carpeta, m).filter((b) => ronda.n === 1 || est.broll[b.n]?.rehechoEnRonda === ronda.n - 1);
  // los que ya no se rehacen (su tope, o la ultima vuelta): Claude solo dice como quedaron, sin prompts
  const alTopeBroll = brollAMirar.filter((b) => ultima || vecesDeBroll(est.broll[b.n]) >= TOPE_BROLL).map((b) => b.n);
  if (aMirar.length || brollAMirar.length) {
    let datos = null;
    if (claudeSimulado()) {
      const s = (ronda.sesiones.revision ||= {});
      if (!s.hecha) {
        const v = validarRevisionClips(revisionSimulada(aMirar, obligatorias, brollAMirar), { tomas: aMirar, obligatorias, brolls: brollAMirar, alTopeBroll });
        Object.assign(s, { hecha: true, ok: true, simulada: true, datos: { pedidos: v.pedidos, pedidosBroll: v.pedidosBroll, malBroll: v.malBroll } });
      }
      datos = s.datos;
      guardarEstado();
    } else {
      if (!ronda.sesiones.revision?.hecha) {
        ctx.avance('Sacando cuadros de cada clip');
        const f = await ctx.correr('extraer-frames.js', [ctx.carpetaArg]);
        if (f.cancelado) return { cancelado: true };
        if (!(await prepararContextos(ctx, aMirar, brollAMirar))) return { cancelado: true };
      }
      const s = await sesionDeClaude(ctx, ronda, 'revision', guardarEstado, {
        tipo: 'revision',
        prompt: textoDeRevision(ctx, { m, tomas: aMirar, habla, estado: est, obligatorias, brolls: brollAMirar, alTopeBroll }),
        archivo: rutaRevisionClaude(ctx),
        frase: 'Claude está mirando los clips',
        verificar: async () => {
          const l = await leerConEsquema(rutaRevisionClaude(ctx), 'revision-clips');
          if (!l.ok) return l;
          const v = validarRevisionClips(l.datos, { tomas: aMirar, obligatorias, brolls: brollAMirar, alTopeBroll });
          return v.errores.length ? { ok: false, errores: v.errores } : { ok: true, datos: { pedidos: v.pedidos, pedidosBroll: v.pedidosBroll, malBroll: v.malBroll } };
        },
      });
      if (s.cancelado) return { cancelado: true };
      if (s.limite) return LIMITE_CLAUDE;
      datos = s.ok ? s.datos : null;
      if (!s.ok) ronda.sinRevision = s.error || true;
    }
    // (una sesion guardada por una version anterior de la app trae solo la lista de las tomas)
    if (Array.isArray(datos)) datos = { pedidos: datos, pedidosBroll: [] };
    for (const x of datos?.pedidos || []) pedidos.push({ toma: x.toma, como: x.rehacer === 'toma' ? 'toma' : 'clip', motivo: x.motivo, prompts: x.prompts, fase: 'pendiente' });
    if (datos) {
      // lo que vio de cada B-roll (el informe dice como quedo cada uno con la ultima mirada)
      for (const b of brollAMirar) {
        const x = (datos.pedidosBroll || []).find((y) => y.broll === b.n) || (datos.malBroll || []).find((y) => y.n === b.n);
        est.broll[b.n] = { ...(est.broll[b.n] || {}), visto: { ronda: ronda.n, mal: Boolean(x), ...(x?.motivo ? { motivo: x.motivo } : {}), fecha: ahora() } };
      }
      for (const x of datos.pedidosBroll || []) pedidos.push({ broll: x.broll, rehacer: x.rehacer, motivo: x.motivo, prompts: x.prompts, fase: 'pendiente', ...(ultima ? { sinVueltas: true } : {}) });
    }
  }
  for (const n of obligatorias) {
    if (pedidos.some((p) => p.toma === n && !p.broll)) continue;
    pedidos.push({ toma: n, como: 'reintentar', esperar: false, motivo: 'No dijo su frase limpia: se hizo otra vez.', fase: 'pendiente' });
  }
  ronda.pedidos = pedidos;
  guardarEstado();
  return null;
}

/** Aplica el cambio de un pedido en el manifiesto (sin pagar nada) y lo valida. { ok } o { ok: false, detalle }. */
async function aplicarCambios(ctx, est, p) {
  const rutaM = path.join(ctx.carpeta, 'manifiesto.json');
  const m = leerJSON(rutaM);
  const t = (m?.tomas || []).find((x) => x.n === p.toma);
  if (!t) return { ok: false, detalle: `la toma ${p.toma} ya no está en el manifiesto` };
  if (p.como === 'reintentar') return { ok: true };
  if (p.como === 'clip') {
    (est.clips[p.toma].promptsAnteriores ||= []).push({ fecha: ahora(), prompt_video: t.prompt_video });
    t.prompt_video = p.prompts.prompt_video;
    escribirJSON(rutaM, m);
  } else if (p.como === 'rechazo') {
    let r;
    try {
      r = aplicarCambiosDeFrase(t, p.cambios);
    } catch (e) {
      return { ok: false, detalle: e.message };
    }
    const antes = t.linea;
    t.linea = r.linea;
    t.prompt_video = r.prompt_video;
    escribirJSON(rutaM, m);
    // lo que ve el usuario del guion tambien dice la frase nueva (la entrega cuenta el cambio)
    const rutaG = path.join(dirApp(ctx), 'guion.json');
    const g = leerJSON(rutaG);
    const parte = (g?.partes || []).find((x) => x.n === p.toma);
    if (parte) {
      parte.dice = r.linea;
      escribirJSON(rutaG, g);
    }
    (est.clips[p.toma].frases ||= []).push({ fecha: ahora(), antes, despues: r.linea, cambios: p.cambios, motivo: p.motivo, kie: p.kie || null });
  } else if (p.como === 'toma') {
    const archivo = path.join(dirClips(ctx), `prompts-toma-${p.toma}.json`);
    escribirJSON(archivo, { ...p.prompts, motivo: `revision de la app: ${p.motivo}` });
    const a = await ctx.correr('rehacer-toma.js', [ctx.carpetaArg, '--toma', String(p.toma), '--aplicar', relRaiz(archivo)]);
    if (a.cancelado) return { cancelado: true };
    if (a.codigo !== 0) return { ok: false, detalle: ultimasLineas(a.texto, 6) };
  }
  const v = await ctx.correr('validar-manifiesto.js', [`${ctx.carpetaArg}/manifiesto.json`]);
  if (v.cancelado) return { cancelado: true };
  if (v.codigo !== 0) {
    const errores = String(v.texto).split(/\r?\n/).filter((l) => /^\s*ERROR\b/.test(l)).map((l) => l.trim());
    return { ok: false, detalle: errores.join('\n') || ultimasLineas(v.texto, 6) };
  }
  return { ok: true };
}

/** Rehace una toma segun su pedido, con el tope contado ANTES de pagar. null si siguio, o lo que devuelve el paso. */
async function aplicarPedido(ctx, est, ronda, p, guardarEstado) {
  const rehechos = (ctx.conductor.rehechos ||= {});
  const clave = `toma-${p.toma}`;
  const n = p.toma;
  const m0 = leerManifiesto(ctx);
  const t0 = (m0?.tomas || []).find((x) => x.n === n);
  if (!t0) {
    p.resultado = 'no-se-pudo';
    p.detalle = 'la toma ya no está en el manifiesto';
    guardarEstado();
    return null;
  }
  est.clips[n] ||= {};
  const anotar = () => {
    (est.clips[n].historial ||= []).push({ ronda: ronda.n, como: p.como, motivo: p.motivo, resultado: p.resultado, ...(p.detalle ? { detalle: p.detalle } : {}), fecha: ahora() });
    guardarEstado();
  };

  if (p.fase === 'pendiente' || p.fase === 'aplicando') {
    if (p.fase === 'aplicando') restaurarToma(ctx, n); // el cambio quedo a medias: la toma vuelve a como estaba y se aplica otra vez
    else {
      if ((rehechos[clave] || 0) >= topeDe(est, n)) {
        p.resultado = 'tope';
        anotar();
        return null;
      }
      respaldarToma(ctx, t0);
      p.fase = 'aplicando';
      guardarEstado();
    }
    const a = await aplicarCambios(ctx, est, p);
    if (a.cancelado) return { cancelado: true };
    if (!a.ok) {
      restaurarToma(ctx, n);
      p.resultado = 'no-se-pudo';
      p.detalle = a.detalle;
      p.fase = 'listo';
      anotar();
      return null;
    }
    // El tope se cuenta ANTES de pagar: si la app se cierra a mitad, al volver no se rehace otra vez.
    p.vez = (rehechos[clave] || 0) + 1;
    rehechos[clave] = p.vez;
    ctx.guardar();
    const t = (leerManifiesto(ctx)?.tomas || []).find((x) => x.n === n);
    p.fase = faltaImagen(ctx, t) ? 'imagen' : 'video';
    p.antes = huella(rutaClip(ctx, n));
    guardarEstado();
  }

  if (p.fase === 'imagen') {
    ctx.avance(`Rehaciendo la imagen de la toma ${n}`);
    const r = await ctx.correr('generar-imagenes.js', [ctx.carpetaArg, '--tomas', String(n), '--si'], { que: ['imagenes'] });
    if (r.cancelado || ctx.senal?.aborted) return { cancelado: true };
    if (r.codigo !== 0) {
      if (r.clase === 'saldo' || ['red', 'servidor'].includes(r.clase)) return fallo(r, { que: `la imagen de la toma ${n}` });
      restaurarToma(ctx, n);
      p.resultado = 'no-se-pudo';
      p.detalle = ultimasLineas(r.texto, 6);
      p.fase = 'listo';
      anotar();
      return null;
    }
    p.fase = 'video';
    p.antes = huella(rutaClip(ctx, n));
    guardarEstado();
  }

  if (p.fase === 'video') {
    const h = huella(rutaClip(ctx, n));
    // ya esta el clip nuevo (la app se cerro despues de bajarlo): no se pide otra vez
    const yaEsta = h && (!p.antes || !mismaHuella(h, p.antes));
    if (!yaEsta) {
      if (p.esperar && !p.esperado) {
        const ms = ESPERAS_REINTENTO_MS[Math.min((p.vez || 1) - 1, ESPERAS_REINTENTO_MS.length - 1)];
        if (!(await ctx.esperar(ms, `El modelo de video falló de su lado: espero un momento para rehacer la toma ${n} con el modelo principal.`))) return { cancelado: true };
        p.esperado = true;
        guardarEstado();
      }
      ctx.avance(`Rehaciendo el clip de la toma ${n}`);
      const desde = Date.now();
      // con el clip de antes en su lugar, --rehacer lo manda a historial/; sin el (se borro, o quedo pedido en kie),
      // sin --rehacer: se retoma la tarea que siguio en kie y no se paga dos veces
      const r = await ctx.correr('generar-videos.js', [ctx.carpetaArg, '--tomas', String(n), '--sin-broll', ...(h ? ['--rehacer'] : []), '--si'], { que: ['videos'] });
      if (r.cancelado || ctx.senal?.aborted) return { cancelado: true };
      anotarModelos(ctx, { desde, texto: r.texto });
      if (r.codigo !== 0) {
        if (r.clase === 'saldo' || ['red', 'servidor'].includes(r.clase)) return fallo(r, { que: `el clip de la toma ${n}` });
        // No salio con ninguno de los dos modelos: vuelve la toma de antes, con su frase y su clip (con su misma
        // fecha: su registro de modelo sigue valiendo). Si fue por contenido, la vuelta siguiente reescribe la frase.
        const motivo = leerMotivosDelMotor(r.texto).get(`toma-${n}.mp4`);
        if (p.como === 'rechazo' && est.clips[n].frases?.length) est.clips[n].frases[est.clips[n].frases.length - 1].rechazada = motivo?.texto || true;
        restaurarToma(ctx, n);
        const reg = leerJSON(rutaModelos(ctx));
        const e = reg?.clips?.[`toma-${n}.mp4`];
        if (e && motivo && e.respaldo && mismaHuella(e.huella, huella(rutaClip(ctx, n)))) {
          e.motivo = { clase: motivo.clase, texto: motivo.texto };
          escribirJSON(rutaModelos(ctx), reg);
        }
        p.resultado = 'no-se-pudo';
        p.detalle = ultimasLineas(r.texto, 6);
        p.fase = 'listo';
        anotar();
        return null;
      }
    }
    p.fase = 'listo';
    p.resultado = 'rehecho';
    est.clips[n].rehechaEnRonda = ronda.n;
    anotar();
  }
  return null;
}

/** Rehace un B-roll segun su pedido (lib/rehacer-broll.js: solo ese B-roll, con su tope). */
function aplicarPedidoBroll(ctx, est, ronda, p, guardarEstado) {
  return rehacerBroll(ctx, {
    p,
    est: (est.broll[p.broll] ||= {}),
    rondaN: ronda.n,
    tope: TOPE_BROLL,
    sinVueltas: Boolean(p.sinVueltas),
    dirTrabajo: dirClips(ctx),
    guardarEstado,
    fallo,
    despuesDeVideos: (x) => anotarModelos(ctx, x),
  });
}

async function revisionClips(ctx) {
  const m = leerManifiesto(ctx);
  if (!m) return { ok: false, error: { mensaje: 'No encuentro el guion del anuncio.', motivo: 'otro', detalle: 'manifiesto.json' } };
  const est = leerJSON(rutaEstado(ctx)) || { rondas: [], clips: {} };
  est.rondas ||= [];
  est.clips ||= {};
  est.broll ||= {};
  const guardarEstado = () => escribirJSON(rutaEstado(ctx), est);
  // "Continuar" despues de una escena que el modelo de video no acepto nunca (abajo): una vuelta mas, y una frase
  // nueva mas para esa escena (solo esa: el tope de las demas no cambia).
  if (est.sinClip?.length) {
    est.extra = (est.extra || 0) + 1;
    est.extraPara = [...new Set([...(est.extraPara || []), ...est.sinClip])];
    for (const n of est.sinClip) if (est.clips[n]) delete est.clips[n].sinClaude; // Claude vuelve a probar
    est.sinClip = null;
    guardarEstado();
  }
  const maxVueltas = MAX_VUELTAS + (est.extra || 0);

  for (let vueltas = 0; vueltas < maxVueltas + 1; vueltas++) {
    if (ctx.senal?.aborted) return { cancelado: true };
    let ronda = est.rondas[est.rondas.length - 1];
    if (!ronda || ronda.fase === 'hecha') {
      if (est.rondas.length >= maxVueltas) break;
      ronda = { n: est.rondas.length + 1, fase: 'mirar', inicio: ahora(), sesiones: {}, pedidos: [] };
      est.rondas.push(ronda);
      guardarEstado();
    }
    if (ronda.fase === 'mirar') {
      const r = await mirar(ctx, est, ronda, guardarEstado);
      if (r) return r;
      if (!ronda.pedidos.length) {
        ronda.fase = 'hecha';
        ronda.fin = ahora();
        guardarEstado();
        break;
      }
      ronda.fase = 'aplicar';
      guardarEstado();
    }
    if (ronda.fase === 'aplicar') {
      for (const p of ronda.pedidos) {
        if (p.resultado) continue;
        if (ctx.senal?.aborted) return { cancelado: true };
        const r = p.broll ? await aplicarPedidoBroll(ctx, est, ronda, p, guardarEstado) : await aplicarPedido(ctx, est, ronda, p, guardarEstado);
        if (r) return r;
      }
      ronda.fase = 'hecha';
      ronda.fin = ahora();
      guardarEstado();
    }
  }

  // Como quedo cada toma (lo que vio la ultima vuelta).
  const ultimaRonda = est.rondas[est.rondas.length - 1];
  const casos = ultimaRonda?.casos || [];
  const sinClip = casos.filter((c) => c.que === 'rechazo' || c.que === 'falta').filter((c) => !huella(rutaClip(ctx, c.n)));
  if (sinClip.length) {
    const n = sinClip.map((c) => c.n);
    est.sinClip = n;
    guardarEstado();
    return {
      ok: false,
      error: {
        mensaje:
          n.length === 1
            ? `La escena ${n[0]} no se pudo hacer: el modelo de video rechazó su frase todas las veces que se reescribió. Toca “Continuar” para que la IA pruebe otra frase.`
            : `Las escenas ${n.join(', ')} no se pudieron hacer: el modelo de video rechazó sus frases todas las veces que se reescribieron. Toca “Continuar” para que la IA pruebe otras.`,
        motivo: 'contenido',
        detalle: sinClip.map((c) => `toma ${c.n}: ${c.motivo?.texto || 'rechazada'}`).join('\n'),
      },
    };
  }
  const rehechas = Object.keys(est.clips).filter((k) => (est.clips[k].historial || []).some((x) => x.resultado === 'rehecho')).length;
  const quedan = casos.filter((c) => ['respaldo', 'rechazo', 'habla', 'falta'].includes(c.que)).length;
  const sinOir = casos.filter((c) => c.que === 'sin-revisar').length;
  const rb = resumenDeBroll(est.broll);
  const partes = [];
  if (rehechas) partes.push(`${rehechas === 1 ? 'un clip se rehízo' : `${rehechas} clips se rehicieron`}`);
  if (rb.rehechos.length) partes.push(`${rb.rehechos.length === 1 ? 'un B-roll se rehízo' : `${rb.rehechos.length} B-roll se rehicieron`}`);
  if (quedan) partes.push(`${quedan === 1 ? 'uno quedó' : `${quedan} quedaron`} con detalles: están en el informe`);
  if (rb.quedanMal.length) partes.push(rb.quedanMal.length === 1 ? 'un B-roll quedó con un defecto: está en el informe' : `${rb.quedanMal.length} B-roll quedaron con un defecto: están en el informe`);
  if (sinOir) partes.push(`${sinOir === 1 ? 'uno no se pudo escuchar' : `${sinOir} no se pudieron escuchar`}`);
  const nota = partes.length ? `${partes.join('; ')}.`.replace(/^./, (c) => c.toUpperCase()) : 'Cada personaje dijo su frase limpia.';
  est.fin = ahora();
  guardarEstado();
  return { ok: true, nota };
}

// ---------------------------------------------------------------- 5. voces coladas (en este modo, solo los B-roll)

async function voces(ctx) {
  const { leerVoces } = await import('./voz-en-off.js');
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
  escribirJSON(path.join(dirApp(ctx), 'voces.json'), { fecha: ahora(), ...ultimo });
  if (ultimo.sinRevisar.length) return { ok: true, nota: `${ultimo.sinRevisar.length} B-roll no se pudieron revisar.` };
  return { ok: true, nota: ultimo.conVoz.length ? `${ultimo.conVoz.length} B-roll traían una voz que no iba: van sin sonido.` : null };
}

// ---------------------------------------------------------------- 6. musica y efectos

const EFECTOS = ['woosh.mp3', 'deep-woosh.mp3'];

async function musica(ctx) {
  // objeto parlante: la pista la genera Suno (COMO-PRODUCIR seccion 3) y el plan la pone a -22 dB.
  const r = await ctx.correr('suno-retomable.js', ['generar-musica.js', ctx.carpetaArg, '--si'], { que: ['musica'] });
  if (r.cancelado) return { cancelado: true };
  if (r.codigo !== 0) return fallo(r, { que: 'la música' });
  // los efectos de las transiciones (seccion 4): viven en recursos/ y Remotion solo lee la carpeta del anuncio
  for (const n of EFECTOS) {
    const destino = path.join(ctx.carpeta, 'efectos', n);
    if (!existe(destino)) copiarSiExiste(path.join(RAIZ, 'recursos', 'efectos-transiciones', n), destino);
  }
  return { ok: true };
}

// ---------------------------------------------------------------- 7. montaje

async function montaje(ctx) {
  // plan -> subtitulos -> plan (COMO-PRODUCIR 1.3). En dialogo_nativo los subtitulos salen de alinear la linea con
  // lo que se oye en cada clip (subtitulos-dialogo.js, con Scribe): el texto es siempre el del manifiesto.
  const tomasOidas = (texto) => [...new Set([...String(texto).matchAll(/^\s*toma (\d+)(?: \(linea \d+\))?: (?:\d+% alineado|SIN SUBTITULOS)/gm)].map((x) => `toma-${x[1]}.mp4`))];
  for (const [script, nombre, opciones] of [
    ['planear-montaje.js', 'el montaje', {}],
    ['subtitulos-dialogo.js', 'los subtítulos', { que: ['scribe'], clipsDe: tomasOidas }],
    ['planear-montaje.js', 'el montaje', {}],
  ]) {
    const r = await ctx.correr(script, [ctx.carpetaArg], opciones);
    if (r.cancelado) return { cancelado: true };
    if (r.codigo !== 0) return fallo(r, { que: nombre, mensaje: `No pude armar ${nombre}.` });
    if (script === 'subtitulos-dialogo.js') {
      const sin = [...new Set([...String(r.texto).matchAll(/^\s*toma (\d+)(?: \(linea \d+\))?: SIN SUBTITULOS/gm)].map((x) => Number(x[1])))];
      escribirJSON(path.join(dirApp(ctx), 'montaje.json'), { fecha: ahora(), sinSubtitulos: sin });
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------- 8. render

async function render(ctx) {
  const r = await ctx.correr('ensamblar.js', [ctx.carpetaArg], { pesado: true });
  if (r.cancelado) return { cancelado: true };
  if (r.codigo !== 0) return fallo(r, { que: 'la exportación de los videos', mensaje: 'No pude exportar los videos.' });
  return { ok: true };
}

// ---------------------------------------------------------------- 9. control final

async function controlFinal(ctx) {
  const p = ctx.paso;
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
    copiarSiExiste(path.join(ctx.carpeta, 'qa', 'control-final.json'), path.join(dirApp(ctx), 'control-final-1.json'));
    (ctx.conductor.rehechos ||= {}).render = 1;
    p.rerender = 'pendiente';
    ctx.guardar();
    ctx.avance('El control encontró algo: exporto otra vez');
    const e = await ctx.correr('ensamblar.js', [ctx.carpetaArg], { pesado: true });
    if (e.cancelado) return { cancelado: true };
    if (e.codigo !== 0) return fallo(e, { que: 'la segunda exportación', mensaje: 'No pude exportar los videos otra vez.' });
    p.rerender = 'hecho';
    ctx.guardar();
    const r2 = await ctx.correr('control-final.js', [ctx.carpetaArg], { pesado: true });
    if (r2.cancelado) return { cancelado: true };
    if (r2.codigo === 0) return { ok: true, nota: 'Se exportó otra vez y quedó limpio.' };
    if (r2.codigo === 1) return { ok: true, nota: 'Después de exportar otra vez quedaron detalles: están en el informe.' };
    if (r2.codigo === 2) return { ok: true, nota: `No pude revisar el video terminado: ${ultimasLineas(r2.texto, 2)}` };
    return fallo(r2, { que: 'el control final' });
  }
  return { ok: true, nota: 'Quedaron detalles después de exportar otra vez: están en el informe.' };
}

// ---------------------------------------------------------------- 10. informe

const tiempo = (s) => {
  const t = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** toma n -> segundo donde empieza en el video (y lo mismo con cada B-roll), como informe.js. */
function momentosDe(plan) {
  const tomas = new Map();
  const broll = new Map();
  for (const b of plan?.bloques || []) {
    const n = Number((String(b.toma?.archivo || '').match(/toma-(\d+)/) || [])[1]) || Number(b.linea) || null;
    if (n && !tomas.has(n)) tomas.set(n, Number(b.inicio) || 0);
    if (b.broll?.n) broll.set(Number(b.broll.n), Number(b.broll.desde) || Number(b.inicio) || 0);
  }
  return { tomas, broll };
}

/**
 * Lo propio de este estilo en el informe que arma informe.js (pensado para la voz en off): manda lo que dice cada
 * personaje (no una voz en off), un clip que quedo del respaldo es un defecto (salio sin su frase) y uno que se
 * rehizo con el principal ya no lo es, las frases que se reescribieron por un rechazo, los clips que se rehicieron
 * por como hablaban y lo que quedo sin arreglar despues del tope. Reescribe app/informe.json.
 */
export function completarInforme(ctx) {
  const ruta = path.join(dirApp(ctx), 'informe.json');
  const inf = leerJSON(ruta);
  if (!inf) return null;
  const plan = leerJSON(path.join(ctx.carpeta, 'plan-montaje.json'));
  const m = leerManifiesto(ctx) || {};
  const mom = momentosDe(plan);
  const est = leerJSON(rutaEstado(ctx)) || { clips: {}, rondas: [] };
  const reg = leerJSON(rutaModelos(ctx));
  const tomas = tomasHabladas(m);
  const pz = (n, valor, unidad = 'toma') => ({ n, unidad, momento: (unidad === 'B-roll' ? mom.broll : mom.tomas).get(n) ?? null, valor });

  // decisiones
  const dur = Number(plan?.duracion) || 0;
  inf.decisiones = (inf.decisiones || [])
    .filter((d) => d.id !== 'voz')
    .map((d) => {
      if (d.id === 'manda') {
        return {
          ...d,
          titulo: 'Mandan las voces de los personajes',
          detalle:
            `Cada personaje dice su frase dentro de su clip, y el video dura lo que duran sus frases: ${tiempo(dur)}. Ninguna se recortó ni se aceleró.${notaPedida(ctx.brief)}`,
        };
      }
      if (d.id === 'subtitulos') return { ...d, detalle: String(d.detalle || '').replace('con la voz', 'con lo que dice cada personaje') };
      if (d.id === 'musica') return { ...d, detalle: String(d.detalle || '').replace('debajo de la voz', 'debajo de lo que dicen los personajes') };
      return d;
    });

  // problemas: se rehace lo del respaldo (informe.js cuenta un clip del respaldo aunque despues se haya rehecho con
  // el principal, porque se llama igual; las imagenes del respaldo se quedan como estaban) y se suma lo de la
  // revision del habla
  const original = (inf.problemas || []).find((x) => x.id === 'respaldo');
  const problemas = (inf.problemas || []).filter((x) => x.id !== 'respaldo');
  const nuevos = [];
  const imagenesRespaldo = (original?.piezas || []).filter((x) => x.valor === 'imagen');
  if (imagenesRespaldo.length) {
    problemas.unshift({
      ...original,
      id: 'respaldo-imagenes',
      titulo: imagenesRespaldo.length === 1 ? 'Una imagen salió con el modelo de respaldo' : `${imagenesRespaldo.length} imágenes salieron con el modelo de respaldo`,
      piezas: imagenesRespaldo,
    });
  }
  const delRespaldo = tomas.filter((t) => estadoDelClip(ctx, t.n, reg).respaldo === true);
  if (delRespaldo.length) {
    nuevos.push({
      id: 'respaldo',
      tipo: 'revisar',
      titulo: delRespaldo.length === 1 ? 'Un clip quedó sin su frase' : `${delRespaldo.length} clips quedaron sin su frase`,
      detalle:
        delRespaldo.length === 1
          ? 'El modelo principal no lo pudo hacer y el de respaldo no hace hablar al personaje: la toma quedó sin su frase. La app lo volvió a intentar varias veces; rehazla desde el editor.'
          : 'El modelo principal no los pudo hacer y el de respaldo no hace hablar al personaje: esas tomas quedaron sin su frase. La app lo volvió a intentar varias veces; rehazlas desde el editor.',
      piezas: delRespaldo.map((t) => pz(t.n, 'sin su frase')),
    });
  }
  const brollRespaldo = (m.broll || []).filter((b) => reg?.clips?.[`broll-${b.n}.mp4`]?.respaldo && mismaHuella(reg.clips[`broll-${b.n}.mp4`].huella, huella(path.join(ctx.carpeta, 'video', `broll-${b.n}.mp4`))));
  if (brollRespaldo.length) {
    nuevos.push({
      id: 'respaldo-broll',
      tipo: 'arreglado',
      titulo: brollRespaldo.length === 1 ? 'Un B-roll salió con el modelo de respaldo' : `${brollRespaldo.length} B-roll salieron con el modelo de respaldo`,
      detalle: 'El modelo principal no lo pudo hacer y la app usó el de respaldo para no frenar el anuncio. En un B-roll nadie habla, así que está bien; puede verse un poco distinto.',
      piezas: brollRespaldo.map((b) => pz(b.n, 'clip', 'B-roll')),
    });
  }
  // la frase aprobada contra la de hoy (si se reescribio mas de una vez, cuenta de donde salio y como quedo)
  const brollSin = (m.broll || []).filter((b) => !huella(path.join(ctx.carpeta, 'video', `broll-${b.n}.mp4`)) && reg?.clips?.[`broll-${b.n}.mp4`]?.fallo);
  if (brollSin.length) {
    nuevos.push({
      id: 'broll-sin-clip',
      tipo: 'arreglado',
      titulo: brollSin.length === 1 ? 'Un B-roll no salió' : `${brollSin.length} B-roll no salieron`,
      detalle: 'El modelo de video no los pudo hacer (ni el de respaldo). Son un apoyo: la escena que acompañaban va entera, con su personaje.',
      piezas: brollSin.map((b) => pz(b.n, reg.clips[`broll-${b.n}.mp4`].fallo.clase === 'contenido' ? 'no aceptado' : 'no salió', 'B-roll')),
    });
  }
  const frases = tomas
    .map((t) => ({ n: t.n, antes: est.clips[t.n]?.frases?.[0]?.antes, despues: t.linea }))
    .filter((f) => f.antes && f.antes !== f.despues);
  if (frases.length) {
    nuevos.push({
      id: 'frases-cambiadas',
      tipo: 'arreglado',
      titulo: frases.length === 1 ? 'Cambié una frase del guion' : `Cambié ${frases.length} frases del guion`,
      detalle: 'El modelo de video no aceptaba esas frases por sus reglas de contenido (pasa con los temas de salud). Se reescribió solo el pedazo que lo frenaba, con el mismo sentido y el mismo largo. Es lo único del guion aprobado que se tocó.',
      piezas: frases.map((f) => pz(f.n, `«${f.antes}» → «${f.despues}»`)),
    });
  }
  const casos = est.rondas?.[est.rondas.length - 1]?.casos || [];
  const casoDe = (n) => casos.find((c) => c.n === n);
  // (las que se rehicieron solo por su frase nueva ya estan en "frases-cambiadas")
  const motivoRehecho = (n) => [...(est.clips[n]?.historial || [])].reverse().find((x) => x.resultado === 'rehecho' && x.como !== 'rechazo')?.motivo;
  const rehechas = tomas.filter((t) => casoDe(t.n)?.que === 'limpio' && (est.clips[t.n]?.historial || []).some((x) => x.resultado === 'rehecho' && x.como !== 'rechazo'));
  if (rehechas.length) {
    nuevos.push({
      id: 'clips-rehechos',
      tipo: 'arreglado',
      titulo: rehechas.length === 1 ? 'Un clip se rehízo' : `${rehechas.length} clips se rehicieron`,
      detalle: 'La app escuchó cada clip y la IA los miró: estos no salieron bien la primera vez y se hicieron de nuevo hasta que el personaje dijo su frase limpia.',
      piezas: rehechas.map((t) => pz(t.n, motivoRehecho(t.n) || null)),
    });
  }
  const conHabla = tomas.filter((t) => casoDe(t.n)?.que === 'habla');
  if (conHabla.length) {
    nuevos.push({
      id: 'habla',
      tipo: 'revisar',
      titulo: conHabla.length === 1 ? 'Un personaje no dijo su frase limpia' : `${conHabla.length} personajes no dijeron su frase limpia`,
      detalle: `Se rehicieron hasta ${TOPE_CLIP_HABLADO} veces y siguen con una palabra de más, repetida o comida. Escúchalos: si te molesta, rehazlos desde el editor.`,
      piezas: conHabla.map((t) => pz(t.n, casoDe(t.n).detalle || null)),
    });
  }
  const sinOir = tomas.filter((t) => casoDe(t.n)?.que === 'sin-revisar');
  if (sinOir.length) {
    nuevos.push({
      id: 'habla-sin-revisar',
      tipo: 'revisar',
      titulo: sinOir.length === 1 ? 'Un clip no se pudo escuchar' : `${sinOir.length} clips no se pudieron escuchar`,
      detalle: 'El servicio que transcribe no respondió y no pude comprobar si el personaje dijo su frase entera. Escúchalos.',
      piezas: sinOir.map((t) => pz(t.n, null)),
    });
  }
  // los B-roll que la IA miro: los que se rehicieron (y por que) y los que siguen mal despues del tope
  const rb = resumenDeBroll(est.broll || {});
  if (rb.rehechos.length) {
    nuevos.push({
      id: 'broll-rehechos',
      tipo: 'arreglado',
      titulo: rb.rehechos.length === 1 ? 'Un B-roll se rehízo' : `${rb.rehechos.length} B-roll se rehicieron`,
      detalle:
        rb.rehechos.length === 1
          ? 'La IA miró cada B-roll que entra en el video: este salió con un defecto y la app lo hizo de nuevo, sola. Al lado, lo que tenía.'
          : 'La IA miró cada B-roll que entra en el video: estos salieron con un defecto y la app los hizo de nuevo, sola. Al lado de cada uno, lo que tenía.',
      piezas: rb.rehechos.map((x) => pz(x.n, x.motivo, 'B-roll')),
    });
  }
  if (rb.quedanMal.length) {
    const uno = rb.quedanMal.length === 1;
    nuevos.push({
      id: 'broll-mal',
      tipo: 'revisar',
      titulo: uno ? 'Un B-roll quedó con un defecto' : `${rb.quedanMal.length} B-roll quedaron con un defecto`,
      detalle: detalleDeBrollMal(rb.quedanMal, TOPE_BROLL),
      piezas: rb.quedanMal.map((x) => pz(x.n, x.motivo, 'B-roll')),
    });
  }
  const sinRevision = (est.rondas || []).some((r) => r.sinRevision) || tomas.some((t) => est.clips[t.n]?.sinClaude);
  if (sinRevision) {
    nuevos.push({ id: 'revision-no', tipo: 'revisar', titulo: 'La IA no pudo mirar todos los clips', detalle: 'Claude no pudo terminar la revisión de los clips: lo que dijo cada personaje sí se comprobó, pero cómo se ven las tomas y los B-roll, no. Míralos.', piezas: [] });
  }
  const sinSubs = leerJSON(path.join(dirApp(ctx), 'montaje.json'))?.sinSubtitulos || [];
  if (sinSubs.length) {
    nuevos.push({
      id: 'sin-subtitulos',
      tipo: 'revisar',
      titulo: sinSubs.length === 1 ? 'Una toma quedó sin subtítulos' : `${sinSubs.length} tomas quedaron sin subtítulos`,
      detalle: 'No se pudo ubicar su frase en lo que se oye del clip, y un subtítulo con tiempos inventados es peor que ninguno.',
      piezas: sinSubs.map((n) => pz(n, null)),
    });
  }
  inf.problemas = [...nuevos.filter((x) => x.tipo === 'revisar'), ...problemas, ...nuevos.filter((x) => x.tipo !== 'revisar')];
  inf.sinProblemas = inf.problemas.length === 0;
  escribirJSON(ruta, inf);
  return inf;
}

async function informe(ctx) {
  const { armarInforme } = await import('../informe.js');
  const saldoFinal = await consultarSaldoKie();
  if (saldoFinal !== null) {
    ctx.conductor.saldoFinal = { creditos: saldoFinal, fecha: ahora() };
    ctx.guardar();
  }
  armarInforme({ carpeta: ctx.carpeta, dirOutput: OUTPUT, conductor: ctx.conductor });
  completarInforme(ctx);
  return { ok: true };
}

// ---------------------------------------------------------------- la secuencia

export const PASOS = [
  { id: 'validar', nombre: 'Revisar el guion', correr: validar },
  { id: 'saldo', nombre: 'Mirar tu saldo de kie', correr: saldo },
  { id: 'imagenes-y-videos', nombre: 'Crear las imágenes y los videos', correr: imagenesYVideos },
  { id: 'revision-clips', nombre: 'Revisar los clips y lo que dice cada personaje', correr: revisionClips },
  { id: 'voces', nombre: 'Buscar voces que no van', correr: voces },
  { id: 'musica', nombre: 'Poner la música', correr: musica },
  { id: 'montaje', nombre: 'Armar el montaje y los subtítulos', correr: montaje },
  { id: 'render', nombre: 'Exportar los videos', correr: render },
  { id: 'control-final', nombre: 'Revisar el video terminado', correr: controlFinal },
  { id: 'informe', nombre: 'Preparar el informe', correr: informe },
];

// ---------------------------------------------------------------- como script: la revision del habla
//
//   node app/server/lib/familias/objeto-parlante.js temp/<slug> --habla [--tomas 1,3]
//
// Lo corre la app como un proceso del motor (ctx.correr), con su entorno: en modo prueba, el Scribe simulado y la
// guardia de red (nunca se llama a Scribe desde el proceso de la app). Para cada toma hablada cuyo clip esta en
// video/ y no se escucho todavia (o cambio), extrae el audio, lo transcribe con Scribe (transcribir() de
// subtitulos-dialogo.js) y lo compara con su frase (revisarHabla() de lineas-habladas.js: la misma revision de las
// tomas habladas del podcast y la entrevista, con la repeticion de una letra tolerada). Ademas, lo que el personaje
// dice DESPUES de su frase cuenta: aca el montaje solo recorta silencio en los bordes, asi que se oiria.
// Escribe app/habla.json despues de cada toma (lo ya transcrito no se vuelve a pagar) e imprime:
//   "  transcrito: toma-3.mp4"   (lo cuenta el gasto)
//   "  ok   toma-3.mp4  ..."  /  "  MAL  toma-3.mp4  repitio ..."  /  "  ?    toma-3.mp4  no se pudo transcribir: ..."
// Sale con 1 solo si no pudo transcribir ninguno (con "error del servidor" en el texto si fue eso: la app reintenta).

/** La app que lanzo este proceso sigue viva (si se cerro de golpe, el proceso no sigue gastando solo). */
function padreVivo() {
  try {
    process.kill(process.ppid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

async function cliHabla(args) {
  const carpetaArg = args.find((a) => !a.startsWith('--'));
  if (!carpetaArg) {
    console.error('\n  Uso: node app/server/lib/familias/objeto-parlante.js temp/<slug> --habla [--tomas 1,3]\n');
    process.exitCode = 1;
    return;
  }
  const iT = args.indexOf('--tomas');
  const soloTomas = iT !== -1 ? String(args[iT + 1] || '').split(',').map(Number).filter(Number.isInteger) : null;
  const carpeta = path.resolve(RAIZ, carpetaArg);
  const motor = (n) => pathToFileURL(path.join(RAIZ, 'produccion', n)).href;
  const config = await import(motor('config.js'));
  try {
    config.cargarEnv();
  } catch (e) {
    if (!process.env.ELEVENLABS_API_KEY) throw e;
  }
  const { transcribir } = await import(motor('subtitulos-dialogo.js'));
  const lh = await import(motor('lineas-habladas.js'));
  const m = JSON.parse(fs.readFileSync(path.join(carpeta, 'manifiesto.json'), 'utf8'));
  const idioma = m.idioma === 'es' ? 'spa' : m.idioma === 'pt' ? 'por' : 'eng';
  const opciones = lh.opcionesDeRevision(m);
  const ruta = rutaHabla(carpeta);
  const datos = leerJSON(ruta) || {};
  datos.tomas ||= {};
  const dirTmp = path.join(carpeta, 'app', '.habla');
  fs.mkdirSync(dirTmp, { recursive: true });

  console.log(`\n=== Revision del habla — ${path.basename(carpeta)} ===\n`);
  let revisados = 0;
  let transcritos = 0;
  let fallidos = 0;
  let delServidor = 0;
  for (const t of tomasHabladas(m)) {
    if (soloTomas && !soloTomas.includes(t.n)) continue;
    const archivo = `toma-${t.n}.mp4`;
    const clip = path.join(carpeta, 'video', archivo);
    const h = huella(clip);
    if (!h) {
      console.log(`  -    ${archivo}  no esta en video/`);
      continue;
    }
    const previa = datos.tomas[String(t.n)];
    if (previa && !previa.error && mismaHuella(previa.huella, h) && previa.linea === t.linea) {
      console.log(`  =    ${archivo}  ya se habia escuchado: ${previa.limpio ? 'limpio' : previa.descripcion}`);
      continue;
    }
    if (!padreVivo()) {
      console.log('  La app que me lanzo ya no esta: corto aca (lo escuchado quedo guardado).');
      break;
    }
    revisados++;
    let palabras;
    try {
      const mp3 = path.join(dirTmp, `toma-${t.n}.mp3`);
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', clip, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', mp3]);
      palabras = await transcribir(mp3, idioma);
      transcritos++;
      console.log(`  transcrito: ${archivo}`);
    } catch (e) {
      fallidos++;
      const servidor = /devolvio 5\d\d|\b5\d\d\b|internal|timeout|ECONNRESET|fetch failed/i.test(String(e.message));
      if (servidor) delServidor++;
      datos.tomas[String(t.n)] = { clip: `video/${archivo}`, huella: h, linea: t.linea, error: String(e.message).slice(0, 300), fecha: new Date().toISOString() };
      escribirJSON(ruta, datos);
      console.log(`  ?    ${archivo}  no se pudo transcribir${servidor ? ' (error del servidor)' : ''}: ${String(e.message).slice(0, 200)}`);
      continue;
    }
    const rev = lh.revisarHabla(t.linea, palabras, opciones);
    // lo que dice despues de su frase (sin etiquetas de sonido como "[risas]"): aca se oiria
    const despues = String(rev.despues || '')
      .replace(/[[(][^\])]*[\])]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const conDespues = /[\p{L}\p{N}]/u.test(despues);
    const limpio = Boolean(rev.limpio) && !conDespues;
    const partes = [];
    const base = lh.describirRevision(rev);
    if (!rev.limpio && base) partes.push(base);
    if (conDespues) partes.push(`siguio hablando despues de su frase: "${despues}"`);
    const entrada = {
      clip: `video/${archivo}`,
      huella: h,
      linea: t.linea,
      oido: palabras.map((w) => w.text).join(' '),
      palabras: palabras.map((w) => ({ text: w.text, start: w.start, end: w.end })),
      limpio,
      calidad: rev.calidad,
      agregadas: rev.agregadas,
      omitidas: rev.omitidas,
      toleradas: rev.toleradas,
      despues: conDespues ? despues : '',
      motivo: rev.motivo || '',
      descripcion: limpio ? '' : partes.join('; ') || 'no dijo su frase limpia',
      fecha: new Date().toISOString(),
    };
    datos.tomas[String(t.n)] = entrada;
    datos.generado = new Date().toISOString();
    escribirJSON(ruta, datos);
    console.log(`  ${limpio ? 'ok ' : 'MAL'}  ${archivo}  ${limpio ? `dijo su frase limpia${rev.toleradas?.length ? ` (tolerada: ${rev.toleradas.map((x) => x.texto).join(', ')})` : ''}` : entrada.descripcion}`);
  }
  fs.rmSync(dirTmp, { recursive: true, force: true });
  console.log(`\n  ${revisados} revisados, ${transcritos} transcritos, ${fallidos} sin transcribir.\n`);
  if (revisados && fallidos === revisados) {
    console.log(delServidor ? '  El servicio que transcribe no respondio (error del servidor): se vuelve a probar en un momento.\n' : '  No pude transcribir ninguno.\n');
    process.exitCode = 1;
  }
}

const mismoArchivo = (a, b) => (process.platform === 'win32' ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() : path.resolve(a) === path.resolve(b));
if (process.argv[1] && mismoArchivo(process.argv[1], ESTE_ARCHIVO) && process.argv.includes('--habla')) {
  cliHabla(process.argv.slice(2)).catch((e) => {
    console.error(`\n  No pude revisar el habla: ${e?.stack || e}\n`);
    process.exitCode = 1;
  });
}

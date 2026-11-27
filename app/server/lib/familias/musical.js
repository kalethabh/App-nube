// La produccion de los anuncios CANTADOS, paso por paso: el MUSICAL (un jingle corto, con la parte visual en
// crochet, claymation o zack-d-films) y, con los mismos pasos, la HISTORIA MUSICAL (historia-musical.js).
//
// Es la misma interfaz que voz-en-off.js: FAMILIA, ESTILOS y PASOS ({ id, nombre, correr(ctx) }), que el
// conductor (conductor.js) corre en orden guardando conductor.json en cada cambio. Un paso devuelve
//   { ok: true, nota? } · { saltado: true, nota } · { pausa: { motivo, mensaje } } · { ok: false, error } · { cancelado }
//
// Lo distinto de un cantado (COMO-PRODUCIR secciones 1, 3 y 9; skills anuncios-musicales y
// anuncios-historias-musicales; ESTADO-ACTUAL 3.8): la canción existe ANTES que las tomas. El guion que el
// usuario aprobó es la LETRA (en musical eligió una de 2 o 3; en historia, la letra del guion por actos), y
// el manifiesto se escribe recién cuando la canción está hecha y elegida, sobre sus tiempos reales:
//
//   letra            la app escribe cancion/peticion.json con la letra aprobada (con sus tildes: se comprueba)
//                    y lo valida con generar-cancion --solo-plan (gratis). En historia lo escribió Claude en el
//                    guion: aca solo se revisa.
//   saldo-cancion    lo que cuesta la canción (12 créditos por estilo, y 12 por cada bloque de extend)
//   cancion          generar-cancion --si: 2 versiones por estilo (Suno, por kie). Si Suno rechaza una palabra
//                    de la letra, Claude cambia solo esa frase (tope 2) y se pide otra vez
//   elegir-cancion   LA UNICA PAUSA de la produccion: el usuario escucha las versiones y elige (rutas/cancion.js;
//                    tambien puede pedir otra tanda, tope 2). Despues --elegir N: la canción queda en
//                    audio/cancion.mp3 con sus tiempos medidos (Scribe) y el mapa
//   tomas            la app reparte la letra en lineas (cancion/lineas.txt, con [intro]/[instrumental]/[cierre]
//                    en los huecos) y las mide (tiempos-cancion --lineas, gratis); Claude escribe el manifiesto
//                    con la skill visual sobre esas ventanas (tarea-visual-musical.md / tarea-visual-historia.md)
//   tiempos          validar + tiempos-cancion: audio/tiempos.json, la columna del montaje
//   ventanas         cada clip tiene que cubrir su ventana real (como en voz en off)
//   saldo · imagenes-y-videos · revision-imagenes · voces (solo musical: en historia los clips van mudos) ·
//   montaje (plan, subtitulos, plan) · render · control-final · informe (con lo propio de un cantado)
//
// Sin música de fondo y sin transiciones (la canción es el audio). Sale solo la versión completa (--solo-completa,
// conductor.js): la que va sin subtítulos se saca desde el editor.
//
// Lo que cobra lo corre siempre la app; Claude solo lee, escribe el manifiesto y corre lo gratis que su tarea
// nombra (validar y tiempos-cancion, que no llaman a nadie). Todo se retoma desde donde quedó: cada paso mira lo
// que ya está en disco antes de pedir nada (opciones.json = la canción ya se pagó; audio/cancion.json = ya se
// eligió; app/tomas-estado.json = el manifiesto ya pasó la revisión).
//
// La canción tampoco se paga dos veces: generar-cancion no guarda la tarea de Suno antes de esperarla, asi que se
// corre por produccion/suno-retomable.js (el mismo script, con cada tarea de Suno anotada apenas kie la crea):
// si la app se cierra (o se corta internet) DURANTE la generación o un extend, al volver sigue esperando esa tarea.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { RAIZ, OUTPUT, TEMP, DOLARES_POR_CREDITO } from '../rutas.js';
import { leerJSON, existe, listar, escribirSeguro, escribirJSONSeguro } from '../archivos.js';
import { ESPERAS_REINTENTO_MS, mensajeDeFallo, consultarSaldoKie, hayConexion, modoPrueba } from '../procesos.js';
import { armarInforme } from '../informe.js';
import { leerFicha, leerProducto, fotoPrincipal, relProducto, detalleDelProducto } from '../productos.js';
import { textoClaude, enTerminales, prohibidasComunes } from '../claude.js';
import { necesidadesDeVentanas, duracionQueCubre, notaBrollFuera, modelosDeLasVentanas, topeDeLasVentanas, aplicarComoAvisos } from './voz-en-off.js';
import { limpiarAvisosDelPaso, notaDeAvisos } from '../avisos.js';
import { brollDe } from '../broll.js';
import { nombreIA, datosIA } from '../motor-ia.js';
import { hojasDelManifiesto, contextosDe } from '../ia/material.js';
import { CREDITOS_SUNO } from '../../../../produccion/config.js'; // la unica fuente del precio de Suno

export const FAMILIA = 'musical';
// "musical" es la clave del catalogo (estilos.js); "musicales" la del contrato de las familias.
export const ESTILOS = ['musical', 'musicales'];
/** El guion aprobado es la letra: el manifiesto se escribe en la produccion, despues de elegir la cancion. */
export const ARRANCA_SIN_MANIFIESTO = true;
export const FASE_GUION = 'letras';
/** El paso donde la produccion espera al usuario (conductor "pausado" con este paso). */
export const PASO_PAUSA = 'elegir-cancion';

/** Los tres estilos visuales de un musical (skill anuncios-musicales, Paso 2.4: solo estos tres). */
export const VISUALES = {
  crochet: { skill: 'anuncios-crochet', nombre: 'Crochet', material: 'todo tejido en lana, a crochet y ganchillo (si parece foto real, plastilina o 3D liso, está mal)' },
  claymation: { skill: 'anuncios-claymation', nombre: 'Claymation', material: 'todo de plastilina en stop-motion (si parece foto real, dibujo plano o 3D liso, está mal)' },
  'zack-d-films': { skill: 'anuncios-zack-d-films', nombre: 'Zack D Films', material: 'animación 3D cinematográfica estilo Zack D Films (si parece foto real o dibujo plano, está mal)' },
};

const TOPE_OTRAS_TANDAS = 2; // "ninguna me convence": dos tandas mas como mucho
const TOPE_REESCRITURAS = 2; // Suno rechazo una palabra de la letra: Claude la cambia, dos veces como mucho
const IMAGENES_POR_LOTE = 24; // la revision de imagenes va en sesiones de Claude de a este tanto (60-80 tomas no caben en una)

const ahora = () => new Date().toISOString();
const r1 = (x) => Math.round(Number(x) * 10) / 10;
const r2 = (x) => Math.round(Number(x) * 100) / 100;
const tiempo = (s) => {
  const t = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
const esHistoria = (ctx) => ctx?.conductor?.familia === 'historia-musical' || ctx?.brief?.estilo === 'historias-musicales';
// La IA en los textos: 'Claude', 'ChatGPT' o 'tu IA'. Sin `motor`, la elegida ahora; con el que anoto una sesion, la
// que la hizo. LaIA, para empezar una frase.
const laIA = (motor) => nombreIA(motor || undefined);
const LaIA = (motor) => laIA(motor).replace(/^./, (c) => c.toUpperCase());

export function escribirJSON(ruta, valor) {
  escribirJSONSeguro(ruta, valor);
}
function escribirTexto(ruta, texto) {
  escribirSeguro(ruta, texto);
}

// Lo que lleva precios o saldos: no sale en el detalle (ningun precio a la vista salvo el informe).
const CON_PRECIO = /US\$|cr[eé]ditos?\b|\bsaldo\b|\bcr\b|\$\d/i;

/** Las ultimas lineas utiles de lo que dijo un comando (para el detalle de la tarjeta), sin precios ni saldos. */
export function ultimasLineas(texto, n = 12) {
  return String(texto || '')
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() && !CON_PRECIO.test(l))
    .slice(-n)
    .join('\n');
}

/** Lo que devuelve un paso cuando su comando fallo, segun por que fallo. */
export function fallo(r, { que = 'este paso', mensaje = null } = {}) {
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

const errorDe = (mensaje, detalle = '', motivo = 'otro') => ({ ok: false, error: { mensaje, motivo, ...(detalle ? { detalle } : {}) } });

// ---------------------------------------------------------------- donde vive cada cosa

/** Los archivos de la cancion y de su eleccion (los usa tambien rutas/cancion.js). */
export const RUTAS = {
  peticion: (c) => path.join(c, 'cancion', 'peticion.json'),
  opciones: (c) => path.join(c, 'cancion', 'opciones.json'),
  lineas: (c) => path.join(c, 'cancion', 'lineas.txt'),
  cancionMp3: (c) => path.join(c, 'audio', 'cancion.mp3'),
  cancionJson: (c) => path.join(c, 'audio', 'cancion.json'),
  tiempos: (c) => path.join(c, 'audio', 'tiempos.json'),
  manifiesto: (c) => path.join(c, 'manifiesto.json'),
  letras: (c) => path.join(c, 'app', 'letras.json'),
  guion: (c) => path.join(c, 'app', 'guion.json'),
  estado: (c) => path.join(c, 'app', 'cancion-estado.json'),
  eleccion: (c) => path.join(c, 'app', 'cancion-eleccion.json'),
  pedido: (c) => path.join(c, 'app', 'cancion-pedido.json'),
  mapa: (c) => path.join(c, 'app', 'mapa-cancion.txt'),
  tabla: (c) => path.join(c, 'app', 'tiempos-por-linea.txt'),
  tomasEstado: (c) => path.join(c, 'app', 'tomas-estado.json'),
  revisionEstado: (c) => path.join(c, 'app', 'revision-estado.json'),
};

const leerEstadoCancion = (carpeta) => leerJSON(RUTAS.estado(carpeta)) || { tandas: [], otras: 0, rechazos: [] };
const guardarEstadoCancion = (carpeta, est) => escribirJSON(RUTAS.estado(carpeta), { ...est, actualizado: ahora() });

// ---------------------------------------------------------------- la letra: tildes e idioma

const ACENTOS = /[áéíóúüñÁÉÍÓÚÜÑãõâêôàçÃÕÂÊÔÀÇ¿¡]/g;
// "quedÃ³": la letra paso por una codificacion equivocada (UTF-8 leido como Latin-1)
const ROTA = /Ã[\u0080-¿]|Â[\u0080-¿¡¿]|�/;

/** Las palabras cantadas de una letra (sin las marcas [Verso 1] / [Coro]), como las cuenta generar-cancion. */
export const palabrasDe = (letra) => String(letra || '').replace(/\[[^\]]*\]/g, ' ').split(/\s+/).map((s) => s.trim()).filter(Boolean);

/**
 * ¿La letra perdio las tildes o se rompio su codificacion? (COMO-PRODUCIR 9.1 y skill musical 5.2: una letra en
 * ASCII le manda a Suno otras palabras: "quedo" no es "quedó".) Solo en espanol y portugues, y con letra suficiente
 * para que no tener ni una tilde sea imposible. Devuelve el problema en palabras simples, o null.
 */
export function problemaDeTildes(letra, idioma) {
  const t = String(letra || '');
  if (ROTA.test(t)) return 'La letra quedó con letras raras (las tildes se rompieron al guardarla).';
  const id = String(idioma || '').toLowerCase();
  if (!/^(es|spa|pt|por)/.test(id)) return null;
  if (palabrasDe(t).length < 25) return null;
  if (!(t.match(ACENTOS) || []).length) return 'La letra quedó escrita sin tildes ni eñes, y así Suno canta otras palabras.';
  return null;
}

/** El idioma de la letra como lo pide Scribe ("spa", "eng", "por"). */
export function idiomaScribe(idioma) {
  const i = String(idioma || '').toLowerCase();
  if (i.startsWith('en')) return 'eng';
  if (i.startsWith('pt') || i.startsWith('por')) return 'por';
  return 'spa';
}

/** "Mujer" / "f" -> "f"; "Hombre" -> "m"; "que elija Suno" -> null. */
export function vozCantada(v) {
  const s = String(v ?? '').toLowerCase().trim();
  if (s === 'f' || /mujer|femen|female|ella/.test(s)) return 'f';
  if (s === 'm' || /hombre|mascul|male|var[oó]n|[ée]l\b/.test(s)) return 'm';
  return null;
}

/** El estilo visual de un musical: crochet | claymation | zack-d-films (o null si no se reconoce). */
export function estiloVisualDe(valor) {
  const s = String(valor ?? '').toLowerCase();
  if (/crochet|tejid|lana|ganchillo/.test(s)) return 'crochet';
  if (/clay|plastilina/.test(s)) return 'claymation';
  if (/zack|3d|cinematogr/.test(s)) return 'zack-d-films';
  return null;
}

// ---------------------------------------------------------------- la letra que se aprobo (musical)

const estiloSunoDe = (op) => String(op?.estiloSuno ?? op?.estilo_suno ?? op?.estilo ?? '').trim();

/**
 * La letra que el usuario eligio en el guion de un musical: app/letras.json (lo escribe Claude; la sesion de guion de
 * anuncios-nuevos.js la revisa y numera las opciones 1, 2, 3) con el numero de la opcion en "elegida" (lo pone la
 * app al aprobar). Nunca se elige sola: sin numero (y con mas de una opcion) es un error.
 * Devuelve { n, op, letras, estiloVisual, vocalGender } o { error }.
 */
export function letraElegida(carpeta, brief = null) {
  const l = leerJSON(RUTAS.letras(carpeta));
  if (!l || !Array.isArray(l.opciones) || !l.opciones.length) return { error: 'No encuentro la letra aprobada de este anuncio.' };
  const unica = l.opciones.length === 1 ? Number(l.opciones[0].n ?? 1) : null;
  const n = Number(l.elegida ?? brief?.letraElegida ?? unica);
  const conNumero = l.opciones.some((o) => o?.n !== undefined);
  const op = conNumero ? l.opciones.find((o) => Number(o?.n) === n) : Number.isInteger(n) ? l.opciones[n - 1] : null;
  if (!Number.isInteger(n) || !op) return { error: 'Falta elegir cuál de las letras se canta.' };
  const estiloVisual =
    estiloVisualDe(l.visual ?? l.estiloVisual) || estiloVisualDe(brief?.opciones?.visual) || estiloVisualDe(brief?.respuestas?.visual) || estiloVisualDe(brief?.respuestas?.estiloVisual);
  const vocalGender = ['f', 'm'].includes(l.vocalGender) ? l.vocalGender : l.vocalGender === null ? null : vozCantada(brief?.opciones?.vocalGender ?? brief?.respuestas?.canta);
  return { n, op, letras: l, estiloVisual, vocalGender };
}

// ---------------------------------------------------------------- el gasto de la cancion

// gasto.js anota Suno solo cuando aparece musica/fondo.mp3 (la musica de fondo): la cancion se anota aca, con la
// misma forma de corrida (app/gasto/NNN-<paso>.json), una por cada generacion o extend de Suno (12 creditos cada
// una: resumenDeGasto cuenta una pista por corrida con "musica"). Scribe (los tiempos de la cancion) va en el
// plan de ElevenLabs del usuario: se anota como en voces coladas.
function anotarGasto(carpeta, { paso, comando, inicio, generaciones = 0, extensiones = 0, scribe = null, que = '' }) {
  const dir = path.join(carpeta, 'app', 'gasto');
  fs.mkdirSync(dir, { recursive: true });
  let numero = listar(dir).reduce((m, n) => Math.max(m, Number((n.match(/^(\d+)-/) || [])[1]) || 0), 0);
  const fin = new Date().toISOString();
  const base = (extra) => ({
    paso,
    comando,
    inicio: new Date(inicio || Date.now()).toISOString(),
    fin,
    codigo: 0,
    imagenes: [],
    videos: [],
    sinRegistro: [],
    ...extra,
  });
  const lote = [];
  for (let i = 0; i < generaciones + extensiones; i++) {
    const cancion = i < generaciones ? 'versiones' : 'extend';
    lote.push(base({ creditos: CREDITOS_SUNO, dolares: r2(CREDITOS_SUNO * DOLARES_POR_CREDITO), musica: { creditos: CREDITOS_SUNO, cancion, que }, elevenlabs: null }));
  }
  if (scribe) {
    if (lote.length) lote[lote.length - 1].elevenlabs = { scribe };
    else lote.push(base({ creditos: 0, dolares: 0, musica: null, elevenlabs: { scribe } }));
  }
  for (const c of lote) {
    numero++;
    const nombre = `${String(numero).padStart(3, '0')}-${paso}.json`;
    escribirJSON(path.join(dir, nombre), { numero, ...c });
  }
  return lote.length;
}

// ---------------------------------------------------------------- 1. letra

/** generar-cancion --solo-plan valida cancion/peticion.json (leerPeticion del motor) sin cobrar nada. */
async function validarPeticion(ctx) {
  if (existe(RUTAS.opciones(ctx.carpeta))) return { ok: true }; // la cancion ya se genero con esta peticion
  const r = await ctx.correr('generar-cancion.js', [ctx.carpetaArg, '--solo-plan']);
  if (r.cancelado) return { cancelado: true };
  if (r.codigo === 0) return { ok: true };
  const errores = String(r.texto)
    .split(/\r?\n/)
    .filter((l) => /^\s+- /.test(l))
    .map((l) => l.trim().replace(/^- /, ''));
  if (r.clase && !['otro'].includes(r.clase)) return fallo(r, { que: 'la letra de la canción' });
  return errorDe('La letra quedó con un error técnico y así no se puede cantar.', errores.join('\n') || ultimasLineas(r.texto), 'guion');
}

async function letraMusical(ctx) {
  const rutaP = RUTAS.peticion(ctx.carpeta);
  const hecha = existe(RUTAS.opciones(ctx.carpeta));
  if (hecha && existe(rutaP)) return { ok: true, nota: 'La canción ya estaba hecha con esta letra.' };

  const e = letraElegida(ctx.carpeta, ctx.brief);
  if (e.error) return errorDe(`${e.error} Abre el guion y pide el cambio de la letra.`, 'app/letras.json', 'guion');
  const letra = String(e.op.letra || '');
  const estilo = estiloSunoDe(e.op);
  const titulo = String(e.op.titulo || e.letras.titulo || 'Canción del anuncio').trim();
  if (!letra.trim()) return errorDe('La letra elegida está vacía.', `opción ${e.n}`, 'guion');
  if (!estilo) return errorDe('A la letra elegida le falta su estilo musical.', `opción ${e.n}: falta "estiloSuno"`, 'guion');
  const tildes = problemaDeTildes(letra, e.letras.idioma);
  if (tildes) return errorDe(`${tildes} Abre el guion y pide el cambio de la letra.`, `opción ${e.n}`, 'guion');

  // La pantalla del guion ya la escribio al aprobar (anuncios-nuevos.js, aprobarGuion): se comprueba que sea la letra
  // elegida, tal cual, y se le agrega el idioma (para que Scribe mida bien la cancion). Si no esta, se escribe aca.
  const actual = leerJSON(rutaP);
  const peticion =
    actual && actual.letra === letra && estiloSunoDe(actual) === estilo
      ? { ...actual }
      : { letra, estilo, titulo: titulo.slice(0, 80), vocalGender: e.vocalGender };
  peticion.duracion = null; // NUNCA un numero: Suno no comprime la letra, la corta y se lleva el cierre (skill 2.2)
  if (!peticion.idioma) peticion.idioma = idiomaScribe(e.letras.idioma);
  if (peticion.vocalGender !== 'f' && peticion.vocalGender !== 'm') peticion.vocalGender = null;
  if (JSON.stringify(actual) !== JSON.stringify(peticion)) escribirJSON(rutaP, peticion);
  // Se lee lo escrito y se compara: lo que va a Suno es exactamente la letra aprobada, con cada tilde.
  const escrita = leerJSON(rutaP);
  const tildesAntes = (letra.match(ACENTOS) || []).length;
  const tildesDespues = (String(escrita?.letra || '').match(ACENTOS) || []).length;
  if (escrita?.letra !== letra || tildesAntes !== tildesDespues) {
    return errorDe('No pude guardar la letra tal como se aprobó.', `tildes: ${tildesAntes} en la letra, ${tildesDespues} en peticion.json`);
  }
  const v = await validarPeticion(ctx);
  if (!v.ok) return v;
  return { ok: true, nota: `Letra ${e.n}: «${escrita.titulo || titulo}».` };
}

async function letraHistoria(ctx) {
  const rutaP = RUTAS.peticion(ctx.carpeta);
  const p = leerJSON(rutaP);
  if (!p) return errorDe('No encuentro la letra de la canción del guion aprobado.', 'cancion/peticion.json', 'guion');
  if (existe(RUTAS.opciones(ctx.carpeta))) return { ok: true, nota: 'La canción ya estaba hecha con esta letra.' };
  const idioma = p.idioma || leerJSON(RUTAS.guion(ctx.carpeta))?.idioma;
  const tildes = problemaDeTildes(p.letra, idioma);
  if (tildes) return errorDe(`${tildes} Abre el guion y pide el cambio de la letra.`, 'cancion/peticion.json', 'guion');
  // "duration" nunca: trunca por el final y se lleva el CTA (skill historias 3.4)
  if (p.duracion != null) {
    p.duracion = null;
    escribirJSON(rutaP, p);
  }
  const v = await validarPeticion(ctx);
  if (!v.ok) return v;
  const estilos = Array.isArray(p.estilos) ? p.estilos.length : 1;
  const bloques = Array.isArray(p.bloques) && p.bloques.length > 1 ? p.bloques.length : 1;
  return { ok: true, nota: `${estilos} ${estilos === 1 ? 'estilo' : 'estilos'}${bloques > 1 ? `, en ${bloques} partes` : ''}.` };
}

// ---------------------------------------------------------------- 2. saldo de la cancion

/** El saldo de kie (gratis), esperando la conexion y con los reintentos de siempre. null si no se pudo. */
async function saldoConReintentos(ctx) {
  for (let intento = 0; ; ) {
    const s = await consultarSaldoKie();
    if (s !== null) return s;
    if (!(await hayConexion())) {
      if (!(await ctx.esperarConexion())) return { cancelado: true };
    } else if (intento < ESPERAS_REINTENTO_MS.length) {
      if (!(await ctx.esperar(ESPERAS_REINTENTO_MS[intento++], 'No pude consultar tu saldo de kie: lo intento de nuevo en un momento.'))) return { cancelado: true };
    } else return null;
  }
}

const sinSaldoConsultado = () => errorDe('No pude consultar tu saldo de kie. Revisa tu clave de kie en Ajustes y toca “Continuar”.', '', 'clave');

async function saldoCancion(ctx) {
  const p = leerJSON(RUTAS.peticion(ctx.carpeta)) || {};
  const estilos = Array.isArray(p.estilos) && p.estilos.length ? p.estilos.length : 1;
  const extends_ = Array.isArray(p.bloques) && p.bloques.length > 1 ? p.bloques.length - 1 : 0;
  const hace = (existe(RUTAS.opciones(ctx.carpeta)) ? 0 : CREDITOS_SUNO * estilos) + CREDITOS_SUNO * extends_;
  const s = await saldoConReintentos(ctx);
  if (s?.cancelado) return { cancelado: true };
  if (s === null) return sinSaldoConsultado();
  // El saldo de antes de pagar nada (el informe lo compara con el de despues).
  if (!ctx.conductor.saldoInicial) {
    ctx.conductor.saldoInicial = { creditos: s, fecha: ahora() };
    ctx.guardar();
  }
  if (s < hace) return { pausa: { motivo: 'saldo', mensaje: mensajeDeFallo('saldo') } };
  return { ok: true };
}

// ---------------------------------------------------------------- 3. la cancion (y otra tanda)

/**
 * §3.2 fila 14: Suno rechazo una palabra de la letra y la IA cambia solo esa frase en cancion/peticion.json (y anota
 * los cambios en app/letra-cambios.json). Sin lanzarla (§3.1): quien la lanza agrega uuid, senal, alProgreso y
 * registro. `antes`: la peticion de antes del cambio (verificar exige que la letra cambie). La skill queda a pedido.
 */
export function armarSesionLetra(ctx, { textoFallo = '', vez = 1, antes = leerJSON(RUTAS.peticion(ctx.carpeta)) } = {}) {
  const rutaP = RUTAS.peticion(ctx.carpeta);
  const rutaCambios = path.join(ctx.carpeta, 'app', 'letra-cambios.json');
  const slugRel = `./temp/${ctx.slug}`;
  const skill = esHistoria(ctx) ? 'anuncios-historias-musicales' : 'anuncios-musicales';
  const verificar = async () => {
    const p = leerJSON(rutaP);
    if (!p || typeof p.letra !== 'string' || !p.letra.trim()) return { ok: false, errores: ['cancion/peticion.json tiene que seguir siendo JSON válido, con "letra".'] };
    if (p.letra === antes.letra) return { ok: false, errores: ['La letra quedó igual: cambia la frase que puede haber frenado a Suno.'] };
    const t = problemaDeTildes(p.letra, p.idioma);
    if (t) return { ok: false, errores: [t] };
    const c = leerJSON(rutaCambios);
    if (!Array.isArray(c) || !c.length) return { ok: false, errores: ['Falta app/letra-cambios.json: [{"antes": "...", "despues": "..."}] con cada frase que cambiaste.'] };
    const v = await validarPeticion(ctx);
    return v.ok ? { ok: true } : { ok: false, errores: [v.error?.detalle || v.error?.mensaje || 'peticion.json no valida'] };
  };
  return {
    tipo: 'letra',
    cwd: RAIZ,
    prompt: textoClaude('tarea-visual-letra', {
      slug: ctx.slug,
      skill,
      motivo: ultimasLineas(textoFallo, 3).replace(/[{}]/g, ''),
      vez: String(vez),
    }),
    herramientas: ['Read', 'Glob', 'Grep', 'Write', 'Edit'],
    permitidas: [`Read(${slugRel}/**)`, `Read(./.claude/skills/${skill}/**)`, 'Glob', 'Grep', `Write(${slugRel}/cancion/peticion.json)`, `Edit(${slugRel}/cancion/peticion.json)`, `Write(${slugRel}/app/letra-cambios.json)`, `Edit(${slugRel}/app/letra-cambios.json)`],
    prohibidas: prohibidasComunes({ terminal: false }),
    material: { skillsAPedido: true },
    timeoutMs: 20 * 60000,
    maxTurnos: 30,
    verificar,
  };
}

/** Suno rechazo una palabra de la letra: la IA cambia solo esa frase (tope 2). { ok } | { cancelado } | error */
async function reescribirLetra(ctx, est, textoFallo) {
  est.rechazos = Array.isArray(est.rechazos) ? est.rechazos : [];
  if (est.rechazos.length >= TOPE_REESCRITURAS) {
    return errorDe(
      'Suno no quiso cantar la letra ni después de cambiar las palabras que lo frenaban. Hay que escribir el anuncio con otra letra.',
      ultimasLineas(textoFallo, 4),
      'contenido'
    );
  }
  const claude = await ctx.claude();
  if (!claude?.lanzarSesion) return errorDe(`Suno rechazó una palabra de la letra y no pude abrir ${laIA()} para cambiarla. Toca “Continuar” para probar otra vez.`, ultimasLineas(textoFallo, 4), 'contenido');
  const rutaP = RUTAS.peticion(ctx.carpeta);
  const antes = leerJSON(rutaP);
  if (!antes) return errorDe('No encuentro la letra de la canción.', 'cancion/peticion.json');
  const vez = est.rechazos.length + 1;
  const respaldo = path.join(ctx.carpeta, 'app', `peticion-antes-del-rechazo-${vez}.json`);
  if (!existe(respaldo)) fs.copyFileSync(rutaP, respaldo);
  const rutaCambios = path.join(ctx.carpeta, 'app', 'letra-cambios.json');
  fs.rmSync(rutaCambios, { force: true });
  ctx.avance(`Suno no quiso cantar una palabra: ${laIA()} la cambia`);
  const r = await claude.lanzarSesion({
    ...armarSesionLetra(ctx, { textoFallo, vez, antes }),
    uuid: crypto.randomUUID(),
    alProgreso: (f) => ctx.avance(f),
    registro: path.join(ctx.carpeta, 'app', 'registro', 'letra-claude.jsonl'),
    senal: ctx.senal,
  });
  if (ctx.senal?.aborted || r?.cancelado) {
    fs.copyFileSync(respaldo, rutaP);
    return { cancelado: true };
  }
  if (!r?.ok) {
    fs.copyFileSync(respaldo, rutaP); // la letra vuelve a como estaba
    return errorDe(`Suno rechazó una palabra de la letra y ${laIA(r?.motor)} no pudo cambiarla: ${r?.error || 'no terminó'}`, ultimasLineas(textoFallo, 4), r?.limite ? 'claude-limite' : 'contenido');
  }
  est.rechazos.push({ fecha: ahora(), motivo: ultimasLineas(textoFallo, 2), cambios: leerJSON(rutaCambios) || [] });
  guardarEstadoCancion(ctx.carpeta, est);
  return { ok: true };
}

/** generar-cancion --si hasta que haya opciones.json (con lo que Suno puede fallar). { ok, opciones } | ... */
async function generarTanda(ctx, est) {
  let fallosSuno = 0;
  for (;;) {
    const inicio = Date.now();
    ctx.avance(esHistoria(ctx) ? 'Suno está cantando tu historia' : 'Suno está componiendo tu canción');
    // (suno-retomable: generar-cancion tal cual, con la tarea de Suno anotada apenas kie la crea: si la app se
    // cierra mientras Suno canta, al volver sigue esperando esa tarea y no se paga otra)
    const r = await ctx.correr('suno-retomable.js', ['generar-cancion.js', ctx.carpetaArg, '--si'], { que: ['cancion'] });
    if (r.cancelado || ctx.senal?.aborted) return { cancelado: true };
    const op = leerJSON(RUTAS.opciones(ctx.carpeta));
    if (Array.isArray(op?.pistas) && op.pistas.length) {
      const generaciones = Array.isArray(op.tareas) && op.tareas.length ? op.tareas.length : 1;
      try {
        anotarGasto(ctx.carpeta, { paso: ctx.paso.id, comando: r.comando, inicio, generaciones, que: 'versiones de la canción' });
      } catch (e) {
        console.error(`[musical] ${ctx.slug}: no pude anotar el gasto de la canción:`, e?.message || e);
      }
      return { ok: true, opciones: op };
    }
    if (r.codigo === 0) return errorDe('La canción no llegó: Suno terminó sin devolver versiones.', ultimasLineas(r.texto));
    if (/SENSITIVE_WORD_ERROR/i.test(r.texto)) {
      const a = await reescribirLetra(ctx, est, r.texto);
      if (!a.ok) return a;
      continue;
    }
    if (/GENERATE_AUDIO_FAILED|CALLBACK_EXCEPTION|CREATE_TASK_FAILED|termino sin devolver pistas/i.test(r.texto) && fallosSuno < ESPERAS_REINTENTO_MS.length) {
      if (!(await ctx.esperar(ESPERAS_REINTENTO_MS[fallosSuno++], 'Suno no pudo terminar la canción: la pido de nuevo en un momento.'))) return { cancelado: true };
      continue;
    }
    return fallo(r, { que: 'la canción' });
  }
}

async function cancion(ctx) {
  const op = leerJSON(RUTAS.opciones(ctx.carpeta));
  if (op?.pistas?.length) return { ok: true, nota: `${op.pistas.length} versiones listas.` };
  const est = leerEstadoCancion(ctx.carpeta);
  const g = await generarTanda(ctx, est);
  if (!g.ok) return g;
  est.tandas = [{ numero: 1, versiones: g.opciones.pistas.length, fecha: ahora() }];
  guardarEstadoCancion(ctx.carpeta, est);
  return { ok: true, nota: `${g.opciones.pistas.length} versiones listas para escuchar.` };
}

/**
 * "Ninguna me convence": la tanda de ahora pasa a cancion/tanda-K/ (se puede seguir eligiendo) y se genera otra
 * con la misma letra. opciones.json termina con TODAS las versiones, las viejas primero: el numero de cada una no
 * cambia. Se retoma: si la app se cierra a mitad, sigue desde el ultimo punto que quedo en disco.
 */
async function otraTanda(ctx, est) {
  const dirC = path.join(ctx.carpeta, 'cancion');
  const k = est.moviendo || (Array.isArray(est.tandas) && est.tandas.length ? est.tandas.length : 1);
  const dirTanda = path.join(dirC, `tanda-${k}`);
  const rutaPrevias = path.join(dirTanda, 'opciones.json');
  let op = leerJSON(RUTAS.opciones(ctx.carpeta));
  if (!est.moviendo && op) {
    // (a) mover la tanda de ahora (los mp3 sueltos; los de tandas anteriores ya estan en su carpeta)
    fs.mkdirSync(dirTanda, { recursive: true });
    for (const p of op.pistas) {
      if (String(p.archivo).includes('/')) continue;
      const de = path.join(dirC, p.archivo);
      const a = path.join(dirTanda, p.archivo);
      if (existe(de)) fs.renameSync(de, a);
      p.archivo = `tanda-${k}/${p.archivo}`;
    }
    escribirJSON(rutaPrevias, op);
    fs.rmSync(RUTAS.opciones(ctx.carpeta), { force: true });
    est.moviendo = k;
    guardarEstadoCancion(ctx.carpeta, est);
    op = null;
  }
  const previas = leerJSON(rutaPrevias);
  if (!op) {
    const g = await generarTanda(ctx, est);
    if (!g.ok) return g;
    op = g.opciones;
  }
  // (b) juntar: las de antes primero (si todavia no se juntaron)
  if (previas?.pistas?.length && !op.pistas.some((p) => String(p.archivo).startsWith('tanda-'))) {
    op = { ...op, tareas: [...(previas.tareas || []), ...(op.tareas || [])], pistas: [...previas.pistas, ...op.pistas] };
    escribirJSON(RUTAS.opciones(ctx.carpeta), op);
  }
  est.tandas = [...(est.tandas || []), { numero: (est.tandas?.length || 1) + 1, versiones: op.pistas.length - (previas?.pistas?.length || 0), fecha: ahora() }];
  est.otras = (est.otras || 0) + 1;
  delete est.moviendo;
  guardarEstadoCancion(ctx.carpeta, est);
  fs.rmSync(RUTAS.pedido(ctx.carpeta), { force: true });
  return { ok: true };
}

// ---------------------------------------------------------------- 4. elegir la cancion (la pausa)

const MENSAJE_ELEGIR = 'Escucha las versiones de tu canción y quédate con una: apenas elijas, sigo sola.';

/** Lo del mapa de la cancion que imprime --elegir (lo que Claude lee antes de escribir las tomas). */
function mapaDe(texto) {
  const t = String(texto || '');
  const i = t.indexOf('--- MAPA DE LA CANCION ---');
  if (i < 0) return '';
  const fin = t.indexOf('Siguiente paso', i);
  return t.slice(i, fin > i ? fin : undefined).trim() + '\n';
}

async function elegirCancion(ctx) {
  const c = ctx.carpeta;
  const est = leerEstadoCancion(c);
  if (est.aplicada && existe(RUTAS.cancionMp3(c)) && existe(RUTAS.cancionJson(c))) return { ok: true, nota: `Elegiste la versión ${est.aplicada}.` };

  const eleccion = leerJSON(RUTAS.eleccion(c));
  const pedido = leerJSON(RUTAS.pedido(c));
  // Otra tanda (pedida y dentro del tope) o una que quedo a medias.
  if (!eleccion && ((pedido?.otra && (est.otras || 0) < TOPE_OTRAS_TANDAS) || est.moviendo)) {
    const o = await otraTanda(ctx, est);
    if (!o.ok) return o;
    return { pausa: { motivo: PASO_PAUSA, mensaje: MENSAJE_ELEGIR } };
  }
  if (pedido) fs.rmSync(RUTAS.pedido(c), { force: true }); // fuera del tope: se ignora

  let op = leerJSON(RUTAS.opciones(c));
  if (!op?.pistas?.length) {
    // (no deberia pasar: el paso de la cancion las dejo) se generan aca
    const g = await generarTanda(ctx, est);
    if (!g.ok) return g;
    op = g.opciones;
  }
  if (!eleccion) return { pausa: { motivo: PASO_PAUSA, mensaje: MENSAJE_ELEGIR } };
  const n = Number(eleccion.n);
  if (!Number.isInteger(n) || n < 1 || n > op.pistas.length) {
    fs.rmSync(RUTAS.eleccion(c), { force: true });
    return { pausa: { motivo: PASO_PAUSA, mensaje: 'Esa versión no existe: elige una de la lista.' } };
  }

  // --elegir: copia la elegida, la extiende si la letra iba en bloques (historia, paga 12 por bloque) y mide los
  // tiempos con Scribe. Los extend ya pagados se reusan solos (opcion-N-bloque-K.json).
  const antes = new Set(listar(path.join(c, 'cancion')).filter((x) => /^opcion-\d+-bloque-\d+\.json$/.test(x)));
  const inicio = Date.now();
  ctx.avance(esHistoria(ctx) && (leerJSON(RUTAS.peticion(c))?.bloques?.length || 0) > 1 ? 'Completando tu canción y midiendo cada palabra' : 'Midiendo cada palabra de tu canción');
  const r = await ctx.correr('suno-retomable.js', ['generar-cancion.js', ctx.carpetaArg, '--elegir', String(n)], { que: ['cancion', 'scribe'] });
  if (r.cancelado || ctx.senal?.aborted) return { cancelado: true };
  const nuevos = listar(path.join(c, 'cancion')).filter((x) => /^opcion-\d+-bloque-\d+\.json$/.test(x) && !antes.has(x));
  const cj = leerJSON(RUTAS.cancionJson(c));
  try {
    const dur = Number(cj?.duracion) || Number(op.pistas[n - 1]?.duracion) || 0;
    const ok = r.codigo === 0;
    anotarGasto(c, {
      paso: ctx.paso.id,
      comando: r.comando,
      inicio,
      extensiones: nuevos.length,
      scribe: ok && dur ? { clips: 1 + 3 * nuevos.length, segundos: r1(dur * (1 + 3 * nuevos.length)), estimado: true } : null,
      que: 'extend de la canción',
    });
  } catch (e) {
    console.error(`[musical] ${ctx.slug}: no pude anotar el gasto de la canción elegida:`, e?.message || e);
  }
  if (r.codigo !== 0) return fallo(r, { que: 'la canción que elegiste' });
  if (!cj || !Array.isArray(cj.palabras) || !existe(RUTAS.cancionMp3(c))) return errorDe('La canción elegida quedó sin sus tiempos.', ultimasLineas(r.texto));
  const mapa = mapaDe(r.texto);
  if (mapa) escribirTexto(RUTAS.mapa(c), mapa);
  est.aplicada = n;
  est.calidad = Number(cj.calidadAlineacion);
  est.duracion = Number(cj.duracion) || null;
  est.extensiones = (est.extensiones || 0) + nuevos.length;
  guardarEstadoCancion(c, est);
  return { ok: true, nota: `Elegiste la versión ${n}: dura ${tiempo(cj.duracion)}.` };
}

// ---------------------------------------------------------------- lo que usa rutas/cancion.js

/** Lo que muestra la pantalla para elegir: { estado, titulo, elegida, puedeOtra, opciones: [{ n, url, duracion, grupo, detalle }] } */
export function opcionesDeCancion(slug, conductor = null) {
  const c = path.join(TEMP, slug);
  const est = leerEstadoCancion(c);
  const op = leerJSON(RUTAS.opciones(c));
  const pet = leerJSON(RUTAS.peticion(c)) || op?.peticion || {};
  const guion = leerJSON(RUTAS.guion(c)) || {};
  const estilos = Array.isArray(pet.estilos) && pet.estilos.length ? pet.estilos : pet.estilo ? [pet.estilo] : [];
  // en historia, cada estilo en palabras del usuario (guion.json "estilos_cancion": lo escribe Claude en espanol)
  const nombresEstilo = Array.isArray(guion?.estilos_cancion) ? guion.estilos_cancion : Array.isArray(guion?.cancion?.estilos) ? guion.cancion.estilos : [];
  const enPausa = conductor?.estado === 'pausado' && conductor?.paso === PASO_PAUSA;
  const generando = conductor?.paso === PASO_PAUSA && ['corriendo', 'esperando'].includes(conductor?.estado) && !est.aplicada;
  const pistas = Array.isArray(op?.pistas) ? op.pistas : [];
  const opciones = pistas.map((p, i) => {
    const grupo = estilos.length > 1 ? Math.max(1, estilos.indexOf(p.estilo) + 1) : 1;
    const tanda = (String(p.archivo).match(/^tanda-(\d+)\//) || [])[1];
    const detalle = [
      estilos.length > 1 ? `Estilo ${grupo}${nombresEstilo[grupo - 1] ? `: ${nombresEstilo[grupo - 1]}` : ''}` : 'La misma letra, otra interpretación',
      tanda ? null : (est.tandas?.length || 1) > 1 ? 'De la última tanda' : null,
    ]
      .filter(Boolean)
      .join(' · ');
    return {
      n: i + 1,
      url: `/api/anuncios/${encodeURIComponent(slug)}/cancion/${i + 1}/audio`,
      duracion: Number(p.duracion) || null,
      grupo,
      detalle,
    };
  });
  const eleccion = leerJSON(RUTAS.eleccion(c));
  // Historia con la letra en bloques: las versiones son solo el bloque 1 (el resto se agrega a la elegida). Cuánto
  // va a durar la canción entera, a ojo: lo que dura una versión, en proporción a la letra que le falta.
  const bloques = Array.isArray(pet.bloques) && pet.bloques.length > 1 ? pet.bloques : null;
  const largoLetra = (t) => String(t || '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim().length;
  const fraccion = bloques ? largoLetra(bloques[0]) / Math.max(1, bloques.reduce((s, b) => s + largoLetra(b), 0)) : 1;
  const durs = opciones.map((o) => o.duracion).filter((d) => d > 0);
  const media = durs.length ? durs.reduce((s, d) => s + d, 0) / durs.length : 0;
  return {
    bloques: bloques ? bloques.length : 1,
    duracionTotal: bloques && media && fraccion > 0.05 ? Math.round(media / fraccion) : null,
    estado: est.aplicada ? 'elegida' : generando ? 'generando' : opciones.length ? (enPausa ? 'eligiendo' : 'esperando') : 'no-hay',
    titulo: String(pet.titulo || guion.titulo || 'tu canción'),
    estilos: estilos.length,
    elegida: est.aplicada || Number(eleccion?.n) || null,
    puedeOtra: !est.aplicada && (est.otras || 0) < TOPE_OTRAS_TANDAS && opciones.length > 0,
    opciones,
  };
}

/** La ruta en disco de la version n (para servir el mp3), o null. */
export function rutaDeVersion(slug, n) {
  const c = path.join(TEMP, slug);
  const op = leerJSON(RUTAS.opciones(c));
  const p = op?.pistas?.[Number(n) - 1];
  if (!p || typeof p.archivo !== 'string' || p.archivo.includes('..') || !/^[\w./-]+\.mp3$/i.test(p.archivo)) return null;
  const abs = path.resolve(c, 'cancion', p.archivo);
  return abs.startsWith(path.resolve(c, 'cancion') + path.sep) && existe(abs) ? abs : null;
}

/** El usuario eligio la version n. Devuelve { ok } o { error, status }. La ruta despues llama a continuar(). */
export function guardarEleccion(slug, n) {
  const c = path.join(TEMP, slug);
  const est = leerEstadoCancion(c);
  if (est.aplicada) return { status: 409, error: 'Ya elegiste la canción de este anuncio.' };
  const op = leerJSON(RUTAS.opciones(c));
  const k = Number(n);
  if (!op?.pistas?.length) return { status: 409, error: 'Las versiones de la canción todavía no están.' };
  if (!Number.isInteger(k) || k < 1 || k > op.pistas.length) return { status: 400, error: 'Esa versión no existe.' };
  escribirJSON(RUTAS.eleccion(c), { n: k, fecha: ahora() });
  fs.rmSync(RUTAS.pedido(c), { force: true });
  return { ok: true };
}

/** Borra la eleccion (o el pedido de otra tanda) que no se pudo aplicar porque la produccion no siguio. */
export function deshacerEleccion(slug, { otra = false } = {}) {
  const c = path.join(TEMP, slug);
  if (leerEstadoCancion(c).aplicada) return;
  fs.rmSync(otra ? RUTAS.pedido(c) : RUTAS.eleccion(c), { force: true });
}

/** "Ninguna me convence": pide otra tanda (dentro del tope). */
export function pedirOtraTanda(slug) {
  const c = path.join(TEMP, slug);
  const est = leerEstadoCancion(c);
  if (est.aplicada) return { status: 409, error: 'Ya elegiste la canción de este anuncio.' };
  if ((est.otras || 0) >= TOPE_OTRAS_TANDAS) return { status: 409, error: 'Ya se hicieron todas las versiones que se pueden pedir: elige una de las que están.' };
  if (!existe(RUTAS.opciones(c))) return { status: 409, error: 'Las versiones de la canción todavía no están.' };
  escribirJSON(RUTAS.pedido(c), { otra: true, fecha: ahora() });
  return { ok: true };
}

// ---------------------------------------------------------------- 5. las tomas (Claude, con la skill visual)

const CAMPOS_FICHA = ['nombre', 'queEs', 'tipo', 'beneficios', 'publico', 'dolor', 'oferta', 'comoCompra', 'idioma', 'mercado', 'pais', 'probo', 'prueba', 'ingredientes', 'comoSeUsa'];

function briefDelProducto(brief) {
  const f = (brief?.productoId && leerFicha(brief.productoId)) || {};
  const p = (brief?.productoId && leerProducto(brief.productoId)) || {};
  const producto = {};
  for (const k of CAMPOS_FICHA) if (f[k] !== undefined) producto[k] = f[k];
  return {
    producto,
    lo_que_conto_el_usuario: p.descripcion || null,
    pagina_del_producto: p.url || null,
    estilo: brief?.estilo || null,
    formato: '9:16',
    ajustes_del_estilo: brief?.respuestas || {},
  };
}

const fotoEnCarpeta = (carpeta) => listar(carpeta).find((n) => /^producto\.(jpg|jpeg|png|webp)$/i.test(n)) || null;

/** La foto del producto dentro de la carpeta del anuncio (preparar-producto, gratis). { foto } | error */
async function asegurarFoto(ctx) {
  const ya = fotoEnCarpeta(ctx.carpeta);
  if (ya) return { foto: ya };
  const origen = ctx.brief?.productoId ? fotoPrincipal(ctx.brief.productoId) : null;
  if (!origen) return { foto: null };
  const r = await ctx.correr('preparar-producto.js', [origen, ctx.slug]);
  if (r.cancelado) return { cancelado: true };
  const foto = fotoEnCarpeta(ctx.carpeta);
  if (r.codigo !== 0 || !foto) return errorDe('No pude preparar la foto de tu producto.', ultimasLineas(r.texto, 4));
  return { foto };
}

function textoFoto(slug, brief, foto) {
  const p = (brief?.productoId && leerProducto(brief.productoId)) || {};
  const otras = (p.fotos || []).slice(1).map((f) => `\`${relProducto(brief.productoId)}/${f}\``);
  if (!foto) return 'El usuario no subió fotos del producto: el manifiesto va sin la entrada del producto y ninguna toma la declara.';
  return [
    `La foto del producto ya está en la carpeta del anuncio: \`temp/${slug}/${foto}\` (la preparó la app). Mírala con Read antes de escribir, como dice la skill.`,
    `En el manifiesto, la entrada del producto lleva \`"archivo": "${foto}"\`, exactamente ese nombre. No corras el comando de la foto: ya está hecho.`,
    otras.length ? `Otras fotos del producto, solo para mirar: ${otras.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

const normal = (s) => String(s ?? '').toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]/gu, '');

/** Las lineas cantadas de una letra, en orden, sin las marcas de seccion ni las lineas vacias. */
export const lineasDeLaLetra = (letra) =>
  String(letra || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\[[^\]]*\]/g, '').trim())
    .filter((l) => l && normal(l));

/**
 * cancion/lineas.txt: una linea por toma, con los huecos sin letra cubiertos por tomas propias. Historia musical
 * (skill 4.3, decision de Diego: la intro y la cola dinamicas): tomas de ~3 s, [intro] repetido redondeo(hueco/3)
 * veces antes de la primera palabra (si pasa de 1,5 s), [cierre] igual al final, [instrumental] en un hueco de mas
 * de 3 s entre dos lineas (repetido si pasa de 4,5 s). Musical (skill 5.3: "los huecos de mas de 3 segundos
 * necesitan su propia toma instrumental"): lo mismo con tomas de ~5 s, para no pagar tomas de mas. Los tiempos de
 * cada linea salen de audio/cancion.json ("palabras": la letra con los tiempos medidos con Scribe, una entrada por
 * palabra, en orden). Pura: devuelve el texto.
 */
export function armarLineas(cancionJson, letra, { tramo = 3, repetirDesde = 4.5 } = {}) {
  const lineas = lineasDeLaLetra(letra);
  const palabras = (Array.isArray(cancionJson?.palabras) ? cancionJson.palabras : []).filter((p) => Number.isFinite(Number(p?.inicio)) && Number.isFinite(Number(p?.fin)));
  const duracion = Number(cancionJson?.duracion) || 0;
  if (!lineas.length) return '';
  // inicio y fin de cada linea: si las palabras son exactamente las de la letra (lo normal) se cortan en orden;
  // si no, se busca hacia adelante la primera palabra de cada linea.
  const tokens = lineas.map((l) => palabrasDe(l));
  const total = tokens.reduce((s, t) => s + t.length, 0);
  const tramos = [];
  let cursor = 0;
  for (const t of tokens) {
    let ini = cursor;
    if (total !== palabras.length) {
      const primera = normal(t[0]);
      const hasta = Math.min(palabras.length, cursor + 12);
      for (let j = cursor; j < hasta; j++) {
        if (normal(palabras[j].texto) === primera) {
          ini = j;
          break;
        }
      }
    }
    const fin = Math.min(palabras.length - 1, ini + t.length - 1);
    tramos.push(ini < palabras.length ? { inicio: Number(palabras[ini].inicio), fin: Number(palabras[Math.max(ini, fin)].fin) } : null);
    cursor = Math.min(palabras.length, ini + t.length);
  }
  const veces = (hueco) => Math.max(1, Math.round(hueco / tramo));
  const salida = [];
  const primera = tramos.find(Boolean);
  if (primera && primera.inicio > 1.5) for (let i = 0; i < veces(primera.inicio); i++) salida.push('[intro]');
  for (let i = 0; i < lineas.length; i++) {
    salida.push(lineas[i]);
    const a = tramos[i];
    const b = tramos.slice(i + 1).find(Boolean);
    if (a && b && i + 1 < lineas.length && tramos[i + 1]) {
      const hueco = b.inicio - a.fin;
      if (hueco > 3) for (let k = 0; k < (hueco > repetirDesde ? Math.max(2, veces(hueco)) : 1); k++) salida.push('[instrumental]');
    }
  }
  const ultima = [...tramos].reverse().find(Boolean);
  if (ultima && duracion - ultima.fin > 1.5) for (let i = 0; i < veces(duracion - ultima.fin); i++) salida.push('[cierre]');
  return salida.join('\n') + '\n';
}

/** cancion/lineas.txt (si no esta) y la tabla de tiempos de cada linea en app/tiempos-por-linea.txt. */
async function prepararLineas(ctx) {
  const c = ctx.carpeta;
  const cj = leerJSON(RUTAS.cancionJson(c));
  const letra = cj?.letra || leerJSON(RUTAS.peticion(c))?.letra;
  if (!existe(RUTAS.lineas(c))) {
    const texto = armarLineas(cj, letra, esHistoria(ctx) ? { tramo: 3, repetirDesde: 4.5 } : { tramo: 5, repetirDesde: 8 });
    if (texto) escribirTexto(RUTAS.lineas(c), texto);
  }
  if (!existe(RUTAS.lineas(c))) return { ok: true, tabla: false };
  const r = await ctx.correr('tiempos-cancion.js', [ctx.carpetaArg, '--lineas']);
  if (r.cancelado) return { cancelado: true };
  if (r.codigo === 0) {
    const i = r.texto.indexOf('=== Tiempos por linea');
    escribirTexto(RUTAS.tabla(c), (i >= 0 ? r.texto.slice(i) : r.texto).trim() + '\n');
    return { ok: true, tabla: true };
  }
  return { ok: true, tabla: false };
}

/** De la salida de tiempos-cancion (sin --lineas): lo que hay que arreglar en el manifiesto antes de pagar. */
export function problemasDeTiempos(texto) {
  const t = String(texto || '');
  const problemas = [];
  const i = t.indexOf('REVISAR ANTES DE GENERAR IMAGENES');
  if (i >= 0) {
    for (const l of t.slice(i).split(/\r?\n/).slice(1)) {
      if (/^\s+- /.test(l)) problemas.push(l.trim().replace(/^- /, ''));
      else if (l.trim() && !/^\s/.test(l)) break;
      else if (!l.trim() && problemas.length) break;
    }
  }
  const sinUbicar = [...t.matchAll(/^\s+toma (\d+): "(.*)"\s*$/gm)].map((m) => ({ toma: Number(m[1]), texto: m[2] }));
  if (/no se ubicaron en la letra/.test(t)) {
    for (const s of sinUbicar) problemas.push(`toma ${s.toma}: su "linea" no aparece en lo que se canta ("${s.texto.slice(0, 60)}"). Tiene que ser el texto exacto de una línea de la letra, o una marca [intro] / [instrumental] / [cierre].`);
  }
  return problemas;
}

/** Revisa lo que escribio Claude en la tarea de las tomas. { ok, errores?, final?, error? } */
async function verificarTomas(ctx, estiloVisual) {
  const c = ctx.carpeta;
  const historia = esHistoria(ctx);
  const bloqueo = leerJSON(path.join(c, 'app', 'bloqueo.json'));
  if (bloqueo?.motivo) return { ok: false, final: true, error: `${LaIA()} no pudo escribir las escenas: ${bloqueo.motivo}` };
  const m = leerJSON(RUTAS.manifiesto(c));
  if (!m) return { ok: false, errores: [`Falta temp/${ctx.slug}/manifiesto.json (o no es JSON válido).`] };
  const errores = [];
  const estilo = historia ? 'historias-musicales' : estiloVisual;
  if (m.estilo !== estilo) errores.push(`manifiesto.json → "estilo" tiene que ser "${estilo}".`);
  if (m.modo_audio !== 'musica') errores.push('manifiesto.json → "modo_audio" tiene que ser "musica": la canción es el audio.');
  if (Object.hasOwn(m, 'voz_en_off')) errores.push('manifiesto.json → en un anuncio cantado no va "voz_en_off": sácalo.');
  const tomas = Array.isArray(m.tomas) ? m.tomas : [];
  if (!tomas.length) errores.push('manifiesto.json → no tiene tomas.');
  for (const t of tomas) if (Number(t?.duracion) > 10) errores.push(`manifiesto.json → la toma ${t.n} dura ${t.duracion} s y un clip no pasa de 10: pártela en dos tomas.`);
  if (historia) {
    if (m.clips_mudos !== true) errores.push('manifiesto.json → "clips_mudos" tiene que ser true (el único audio es la canción).');
    if ((m.broll || []).length) errores.push('manifiesto.json → "broll" va vacío en una historia musical: si una línea necesita dos imágenes, son dos tomas.');
    if ((m.overlays || []).length) errores.push('manifiesto.json → "overlays" va vacío: los textos en pantalla van en datos-editor.md.');
    const lineas = (fs.existsSync(RUTAS.lineas(c)) ? fs.readFileSync(RUTAS.lineas(c), 'utf8') : '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lineas.length && tomas.length !== lineas.length) errores.push(`manifiesto.json → tiene ${tomas.length} tomas y cancion/lineas.txt ${lineas.length} líneas: va una toma por línea, en el mismo orden.`);
    else
      lineas.forEach((l, i) => {
        if (tomas[i] && normal(tomas[i].linea) !== normal(l)) errores.push(`manifiesto.json → la toma ${tomas[i].n} dice "${String(tomas[i].linea).slice(0, 50)}" y la línea ${i + 1} de lineas.txt es "${l.slice(0, 50)}".`);
      });
  }
  const foto = fotoEnCarpeta(c);
  if (foto) {
    const ref = (m.referencias || []).find((r) => r?.tipo === 'producto' || r?.id === 'producto');
    if (!ref) errores.push(`manifiesto.json → falta la entrada del producto en "referencias", con "archivo": "${foto}".`);
    else if (ref.archivo !== foto) errores.push(`manifiesto.json → la entrada del producto tiene que llevar "archivo": "${foto}" (es el nombre real de la foto).`);
  }
  if (errores.length) return { ok: false, errores: errores.slice(0, 12) };

  const v = await ctx.correr('validar-manifiesto.js', [`${ctx.carpetaArg}/manifiesto.json`]);
  if (v.codigo !== 0) {
    const err = String(v.texto).split(/\r?\n/).filter((l) => /^\s*ERROR\b/.test(l)).map((l) => `validar-manifiesto → ${l.trim().replace(/^ERROR\s+/, '')}`);
    return { ok: false, errores: (err.length ? err : [`validar-manifiesto → ${ultimasLineas(v.texto, 3)}`]).slice(0, 12) };
  }
  const t = await ctx.correr('tiempos-cancion.js', [ctx.carpetaArg]);
  if (t.codigo !== 0) return { ok: false, errores: [`tiempos-cancion → ${ultimasLineas(t.texto, 3)}`] };
  const problemas = problemasDeTiempos(t.texto);
  if (problemas.length) return { ok: false, errores: problemas.slice(0, 12).map((p) => `tiempos-cancion → ${p}`) };
  if (historia && !existe(path.join(c, 'datos-editor.md'))) {
    // (los textos en pantalla son opcionales: sin oferta ni semanas no hace falta el archivo)
  }
  return { ok: true };
}

/**
 * §3.2 fila 15 y §3.3 punto 15: la IA escribe las escenas sobre la cancion (manifiesto.json; en la historia tambien
 * cancion/lineas.txt y datos-editor.md), con sus comandos gratis (validar-manifiesto y tiempos-cancion, y --lineas en
 * la historia). Esfuerzo alto. Sin lanzarla (§3.1): quien la lanza agrega uuid, resume, senal, alProgreso y registro.
 *   cj          audio/cancion.json
 *   elegida     la letra elegida (letraElegida; solo el musical) y estiloVisual su estilo visual
 *   foto        la foto del producto en la carpeta del anuncio (o null) · tabla: si se midio tiempos-por-linea.txt
 *   reintento   el intento anterior no termino (el texto lo dice)
 */
export function armarSesionTomas(ctx, { cj = leerJSON(RUTAS.cancionJson(ctx.carpeta)) || {}, elegida, estiloVisual, foto = fotoEnCarpeta(ctx.carpeta), tabla = existe(RUTAS.tabla(ctx.carpeta)), reintento = false } = {}) {
  const c = ctx.carpeta;
  const historia = esHistoria(ctx);
  if (!historia && elegida === undefined) elegida = letraElegida(c, ctx.brief);
  if (!historia && !estiloVisual) estiloVisual = elegida?.estiloVisual || 'crochet';
  const pet = leerJSON(RUTAS.peticion(c)) || {};
  const slugRel = `./temp/${ctx.slug}`;
  const skillVisual = historia ? 'anuncios-historias-musicales' : VISUALES[estiloVisual].skill;
  const valores = {
    slug: ctx.slug,
    skill: skillVisual,
    estiloNombre: historia ? 'Historia musical' : VISUALES[estiloVisual].nombre,
    estiloClave: historia ? 'historias-musicales' : estiloVisual,
    titulo: pet.titulo || cj.titulo || '',
    letra: cj.letra || pet.letra || '',
    concepto: elegida?.op?.concepto || '',
    ideaVisual: elegida?.op?.ideaVisual || elegida?.op?.idea_visual || '',
    angulo: elegida?.letras?.angulo || '',
    duracion: String(r2(cj.duracion)),
    brief: JSON.stringify(briefDelProducto(ctx.brief), null, 2),
    carpetaProducto: ctx.brief?.productoId ? relProducto(ctx.brief.productoId) : 'temp',
    detalleProducto: detalleDelProducto(ctx.brief?.productoId),
    foto: textoFoto(ctx.slug, ctx.brief, foto),
    tabla: tabla ? `temp/${ctx.slug}/app/tiempos-por-linea.txt` : '(no se pudo medir: sácalos de audio/cancion.json)',
  };
  let prompt = textoClaude(historia ? 'tarea-visual-historia' : 'tarea-visual-musical', valores);
  if (reintento) prompt = `(El intento anterior no terminó: revisa lo que ya está escrito en temp/${ctx.slug}/ y sigue desde ahí; lo que ya está bien no lo rehagas.)\n\n${prompt}`;

  const comandos = [
    ...enTerminales(`node produccion/validar-manifiesto.js temp/${ctx.slug}/manifiesto.json`, `node produccion\\validar-manifiesto.js temp\\${ctx.slug}\\manifiesto.json`),
    ...enTerminales(`node produccion/tiempos-cancion.js temp/${ctx.slug}`, `node produccion\\tiempos-cancion.js temp\\${ctx.slug}`),
    ...(historia ? enTerminales(`node produccion/tiempos-cancion.js temp/${ctx.slug} --lineas`, `node produccion\\tiempos-cancion.js temp\\${ctx.slug} --lineas`) : []),
  ];
  const escribibles = ['manifiesto.json', 'app/bloqueo.json', ...(historia ? ['cancion/lineas.txt', 'datos-editor.md'] : [])];
  // tiempos-cancion es gratis y local (lee la cancion y el manifiesto): aca se permite, solo con su comando exacto.
  const prohibidas = prohibidasComunes().filter((x) => !/tiempos-cancion/.test(x));
  return {
    tipo: 'tomas',
    cwd: RAIZ,
    prompt,
    herramientas: ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'TodoWrite', 'Bash', 'PowerShell'],
    permitidas: [
      `Read(./.claude/skills/${skillVisual}/**)`,
      ...(historia ? [] : ['Read(./.claude/skills/anuncios-musicales/**)']),
      `Read(${slugRel}/**)`,
      ...(ctx.brief?.productoId ? [`Read(./${relProducto(ctx.brief.productoId)}/**)`] : []),
      ...escribibles.flatMap((a) => [`Write(${slugRel}/${a})`, `Edit(${slugRel}/${a})`]),
      'Glob',
      'Grep',
      'TodoWrite',
      ...comandos,
    ],
    prohibidas,
    esfuerzo: 'alto',
    fraseInicio: `${LaIA()} empezó a escribir las escenas`,
    timeoutMs: (historia ? 150 : 75) * 60000,
    silencioMs: 15 * 60000,
    maxTurnos: historia ? 220 : 120,
    correcciones: 2,
    verificar: () => verificarTomas(ctx, estiloVisual),
  };
}

async function tomas(ctx) {
  const c = ctx.carpeta;
  const historia = esHistoria(ctx);
  const est = leerJSON(RUTAS.tomasEstado(c)) || {};
  const guardarEst = () => escribirJSON(RUTAS.tomasEstado(c), { ...est, actualizado: ahora() });
  if (est.hecha && existe(RUTAS.manifiesto(c))) return { ok: true, nota: est.nota || null };

  const cj = leerJSON(RUTAS.cancionJson(c));
  if (!cj?.palabras) return errorDe('Falta la canción elegida con sus tiempos.', 'audio/cancion.json');
  let estiloVisual = null;
  let elegida = null;
  if (!historia) {
    elegida = letraElegida(c, ctx.brief);
    if (elegida.error) return errorDe(elegida.error, 'app/letras.json', 'guion');
    estiloVisual = elegida.estiloVisual || 'crochet';
  }

  ctx.avance('Preparando las escenas sobre tu canción');
  const f = await asegurarFoto(ctx);
  if (f.cancelado) return { cancelado: true };
  if (f.ok === false) return f;
  const l = await prepararLineas(ctx);
  if (l.cancelado) return { cancelado: true };
  if (ctx.senal?.aborted) return { cancelado: true };

  const claude = await ctx.claude();
  if (!claude?.lanzarSesion) return errorDe(`No pude abrir ${laIA()} para escribir las escenas. Revisa que ${datosIA().programa} esté instalado y con tu sesión iniciada, y toca “Continuar”.`, '', 'claude');

  const reintento = (est.intentos || 0) > 0;
  const sesion = armarSesionTomas(ctx, { cj, elegida, estiloVisual, foto: f.foto, tabla: l.tabla, reintento });
  est.uuid = est.uuid || crypto.randomUUID();
  est.intentos = (est.intentos || 0) + 1;
  est.estiloVisual = estiloVisual;
  guardarEst();
  fs.rmSync(path.join(c, 'app', 'bloqueo.json'), { force: true });

  ctx.avance(`${LaIA()} está escribiendo las escenas sobre tu canción`);
  const r = await claude.lanzarSesion({
    ...sesion,
    uuid: est.uuid,
    resume: reintento,
    alProgreso: (frase) => ctx.avance(frase),
    registro: path.join(c, 'app', 'registro', 'tomas-claude.jsonl'),
    senal: ctx.senal,
  });
  if (ctx.senal?.aborted || r?.cancelado) return { cancelado: true };
  if (!r?.ok) {
    const porque = String(r?.error || `${LaIA(r?.motor)} no terminó.`).replace(/\s*Toca "Reintentar"[^.]*\.?/g, '').trim();
    return errorDe(
      r?.limite ? r.error : `No pude terminar las escenas: ${porque} Toca “Continuar”: sigue desde donde quedó.`,
      r?.detalle || '',
      r?.limite ? 'claude-limite' : r?.sinSesion || r?.sinClaude || r?.planSinCodex ? 'claude' : 'otro'
    );
  }
  // sin transiciones ni musica de fondo (si Claude las dejo, se sacan: este estilo va con corte seco)
  fs.rmSync(path.join(c, 'transiciones.json'), { force: true });
  const m = leerJSON(RUTAS.manifiesto(c));
  est.hecha = true;
  est.fin = ahora();
  est.nota = `${m.tomas.length} ${m.tomas.length === 1 ? 'escena' : 'escenas'}${(m.broll || []).length ? ` y ${m.broll.length} B-roll` : ''} sobre la canción.`;
  guardarEst();
  return { ok: true, nota: est.nota };
}

// ---------------------------------------------------------------- 6. tiempos (validar + tiempos-cancion)

/** Vuelve a abrir el paso de las tomas (Continuar lo corre otra vez: Claude corrige lo que esta mal). */
function reabrirTomas(ctx) {
  const est = leerJSON(RUTAS.tomasEstado(ctx.carpeta)) || {};
  escribirJSON(RUTAS.tomasEstado(ctx.carpeta), { ...est, hecha: false, actualizado: ahora() });
  const p = ctx.conductor.pasos.find((x) => x.id === 'tomas');
  if (p) {
    p.estado = 'pendiente';
    delete p.nota;
  }
  ctx.guardar();
}

async function pasoTiempos(ctx) {
  const v = await ctx.correr('validar-manifiesto.js', [`${ctx.carpetaArg}/manifiesto.json`]);
  if (v.cancelado) return { cancelado: true };
  if (v.codigo !== 0) {
    reabrirTomas(ctx);
    const errores = String(v.texto).split(/\r?\n/).filter((l) => /^\s*ERROR\b/.test(l)).map((l) => l.trim());
    return errorDe('Las escenas quedaron con un error técnico. Toca “Continuar”: la IA las corrige.', errores.join('\n') || ultimasLineas(v.texto), 'guion');
  }
  const t = await ctx.correr('tiempos-cancion.js', [ctx.carpetaArg]);
  if (t.cancelado) return { cancelado: true };
  if (t.codigo !== 0 || !existe(RUTAS.tiempos(ctx.carpeta))) return fallo(t, { que: 'los tiempos de la canción', mensaje: 'No pude medir las escenas sobre la canción.' });
  const problemas = problemasDeTiempos(t.texto);
  return { ok: true, nota: problemas.length ? `${problemas.length} aviso(s) de tiempos: están en el informe.` : null };
}

// ---------------------------------------------------------------- 7. ventanas

// El reparto de cada ventana entre la toma y su B-roll es el del montaje (el mismo camino en voz en off y en
// musica): necesidadesDeVentanas y duracionQueCubre de familias/voz-en-off.js, sobre ventanasDeLaVoz del motor. Sin
// copia aca. Solo van los B-roll que entran en el video: los demas no se generan.
export { necesidadesDeVentanas, duracionQueCubre };

async function ventanas(ctx) {
  const rutaM = RUTAS.manifiesto(ctx.carpeta);
  const manifiesto = leerJSON(rutaM);
  const tiempos = leerJSON(RUTAS.tiempos(ctx.carpeta));
  if (!manifiesto) return errorDe('No encuentro las escenas del anuncio.', 'manifiesto.json');
  if (!tiempos?.lineas) return errorDe('Faltan los tiempos de la canción.', 'audio/tiempos.json');
  const cambios = [];
  const sinArreglo = [];
  // los modelos del anuncio (Ajustes › Modelos): todos los de su cascada tienen que cubrir la ventana
  const modelos = modelosDeLasVentanas(ctx.carpeta, manifiesto);
  for (const x of necesidadesDeVentanas(manifiesto, tiempos)) {
    const r = duracionQueCubre(x.duracion, x.necesita, modelos);
    if (r.imposible) {
      sinArreglo.push({ que: x.que, n: x.n, toma: x.toma, necesita: r1(x.necesita), motivo: `pide ${r1(x.necesita)} s y un clip llega hasta ${topeDeLasVentanas(modelos)}` });
      continue;
    }
    if (!r.cambia) continue;
    const pieza = x.que === 'toma' ? manifiesto.tomas.find((t) => t.n === x.n) : manifiesto.broll.find((b) => b.n === x.n);
    cambios.push({ que: x.que, n: x.n, toma: x.toma, antes: pieza.duracion, despues: r.duracion, necesita: r1(x.necesita) });
    pieza.duracion = r.duracion;
  }
  // Los B-roll que con esta cancion no entran en el video: imagenes y videos no los piden (no se pagan).
  const brollFuera = brollDe(ctx.carpeta, manifiesto).fuera;
  const registro = { fecha: ahora(), cambios, sinArreglo, brollFuera };
  const notaFuera = notaBrollFuera(brollFuera.length, 'esta canción');
  if (cambios.length) {
    const respaldo = path.join(ctx.carpeta, 'app', 'manifiesto-antes-de-ventanas.json');
    if (!existe(respaldo)) fs.copyFileSync(rutaM, respaldo);
    escribirJSON(rutaM, manifiesto);
    const v = await ctx.correr('validar-manifiesto.js', [`${ctx.carpetaArg}/manifiesto.json`]);
    if (v.cancelado) return { cancelado: true };
    if (v.codigo !== 0) {
      fs.copyFileSync(respaldo, rutaM);
      registro.revertido = true;
      registro.detalle = ultimasLineas(v.texto);
      escribirJSON(path.join(ctx.carpeta, 'app', 'ventanas.json'), registro);
      return { ok: true, nota: ['No se pudo alargar ninguna escena: quedaron como estaban.', notaFuera].filter(Boolean).join(' ') };
    }
  }
  escribirJSON(path.join(ctx.carpeta, 'app', 'ventanas.json'), registro);
  const nota = [cambios.length ? `${cambios.length} escena(s) se pidieron más largas para cubrir su momento.` : null, notaFuera].filter(Boolean).join(' ');
  return { ok: true, nota: nota || null };
}

// ---------------------------------------------------------------- 8. saldo para las imagenes y los videos

/** Del texto de producir --solo-plan: { total, saldo, noAlcanza }. Los numeros nunca se muestran. */
export function leerPlanDeCosto(texto) {
  const t = String(texto || '');
  const num = (m) => (m ? Number(String(m[1]).replace(',', '.')) : null);
  const total = num(t.match(/TOTAL:\s+([\d.]+) creditos/));
  const img = num(t.match(/Imagenes:\s+([\d.]+) creditos/));
  const vid = num(t.match(/Videos:\s+([\d.]+) creditos/));
  const saldo = num(t.match(/Tu saldo:\s+([\d.]+) creditos/));
  return { total: total ?? (img !== null || vid !== null ? (img || 0) + (vid || 0) : null), saldo, noAlcanza: /no te alcanza/i.test(t) };
}

async function saldo(ctx) {
  const r = await ctx.correr('producir.js', [ctx.carpetaArg, '--solo-plan']);
  if (r.cancelado) return { cancelado: true };
  if (r.codigo !== 0) return fallo(r, { que: 'la cuenta de lo que falta producir' });
  const plan = leerPlanDeCosto(r.texto);
  let s = plan.saldo;
  if (s === null) {
    s = await saldoConReintentos(ctx);
    if (s?.cancelado) return { cancelado: true };
    if (s === null) return sinSaldoConsultado();
  }
  if (!ctx.conductor.saldoInicial) {
    ctx.conductor.saldoInicial = { creditos: s, fecha: ahora() };
    ctx.guardar();
  }
  // lo que se calcula gastar (la pantalla lo muestra junto al saldo)
  ctx.conductor.costoPlan = { creditos: plan.total || 0, fecha: ahora() };
  if (plan.noAlcanza || s < (plan.total || 0)) return { pausa: { motivo: 'saldo', mensaje: mensajeDeFallo('saldo') } };
  return { ok: true };
}

// ---------------------------------------------------------------- 9. imagenes y videos

async function imagenesYVideos(ctx) {
  // producir.js en musica: imagenes y videos a la vez (cada clip apenas estan sus imagenes); exige audio/tiempos.json
  const r = await ctx.correr('producir.js', [ctx.carpetaArg, '--si'], { que: ['imagenes', 'videos'] });
  if (r.cancelado) return { cancelado: true };
  if (r.codigo !== 0) return fallo(r, { que: 'las imágenes y los videos' });
  return { ok: true };
}

// ---------------------------------------------------------------- 10. revision de las imagenes (Claude)

const rutaRevisionLote = (ctx, k) => path.join(ctx.carpeta, 'app', 'revision', `lote-${k}.json`);
const dirRevision = (ctx) => path.join(ctx.carpeta, 'app', 'revision');

/** Valida lo que escribio Claude. { pedidos, errores }. Acepta la lista o { rehacer: [...] }. */
export function validarRevision(valor, manifiesto, soloTomas = null) {
  const lista = Array.isArray(valor) ? valor : Array.isArray(valor?.rehacer) ? valor.rehacer : null;
  if (!lista) return { pedidos: [], errores: ['el archivo tiene que ser una lista: [] si todo está bien, o [{ "toma", "motivo", "promptsNuevos" }]'] };
  const errores = [];
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
    if (soloTomas && !soloTomas.has(n)) {
      errores.push(`${donde}: la toma ${n} no es de este lote`);
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
    if (pn.prompt_imagen_inicial.trim() === String(toma.prompt_imagen_inicial || '').trim() && pn.prompt_video.trim() === String(toma.prompt_video || '').trim()) {
      errores.push(`${donde} (toma ${n}): los prompts son los mismos de antes; rehacer con el mismo prompt da lo mismo`);
      continue;
    }
    vistas.add(n);
    pedidos.push({
      toma: n,
      motivo: x.motivo.trim(),
      prompts: { prompt_imagen_inicial: pn.prompt_imagen_inicial, ...(toma.tipo === 'B' ? { prompt_imagen_final: pn.prompt_imagen_final } : {}), prompt_video: pn.prompt_video },
    });
  }
  return { pedidos, errores };
}

/** Las tomas A/B/C en lotes de hasta IMAGENES_POR_LOTE imagenes (una B son dos). */
function lotesDeTomas(manifiesto) {
  const lotes = [];
  let actual = [];
  let imagenes = 0;
  for (const t of (manifiesto.tomas || []).filter((x) => ['A', 'B', 'C'].includes(x.tipo))) {
    const n = t.tipo === 'B' ? 2 : 1;
    if (actual.length && imagenes + n > IMAGENES_POR_LOTE) {
      lotes.push(actual);
      actual = [];
      imagenes = 0;
    }
    actual.push(t);
    imagenes += n;
  }
  if (actual.length) lotes.push(actual);
  return lotes;
}

function textoDeRevision(ctx, manifiesto, lote, k, total, estiloVisual) {
  const C = path.join(RAIZ, 'temp', ctx.slug);
  const en = (...p) => path.join(C, ...p);
  const historia = esHistoria(ctx);
  const foto = fotoEnCarpeta(ctx.carpeta);
  const listaTomas = lote.map((t) => `- toma ${t.n} (tipo ${t.tipo}): ${en('img', `toma-${t.n}-inicial.png`)}${t.tipo === 'B' ? ` y ${en('img', `toma-${t.n}-final.png`)}` : ''}`).join('\n');
  const skill = historia ? 'anuncios-historias-musicales' : VISUALES[estiloVisual]?.skill || 'anuncios-crochet';
  return textoClaude('tarea-visual-revision', {
    carpeta: C,
    estilo: historia ? 'una historia musical en animación 3D estilo Pixar' : `un musical en ${VISUALES[estiloVisual]?.nombre || 'crochet'}`,
    material: historia
      ? 'todo en animación 3D cálida estilo Pixar (si parece foto real, un grid azul o un estudio vacío, está mal)'
      : VISUALES[estiloVisual]?.material || VISUALES.crochet.material,
    extra: historia
      ? '\n   - la protagonista con otra cara que su hoja (protagonista_antes en el dolor, protagonista_despues desde la transformación);\n   - letras o números dentro de la escena (carteles, pantallas, calendarios): no van.'
      : '',
    manifiesto: en('manifiesto.json'),
    foto: foto ? `Mira con Read la foto real del producto: ${en(foto)}` : 'Este anuncio no tiene foto del producto.',
    img: en('img'),
    lote: total > 1 ? ` (parte ${k} de ${total}: solo estas tomas)` : '',
    lista: listaTomas,
    contexto: en('app', 'revision', 'contexto-toma-N.txt'),
    skill: path.join(RAIZ, '.claude', 'skills', skill, 'SKILL.md'),
    salida: path.relative(RAIZ, rutaRevisionLote(ctx, k)).split(path.sep).join('/'),
  });
}

/**
 * §3.2 fila 16: la IA mira las imagenes de un lote de tomas (`lote`, el `k` de `total`) y escribe
 * app/revision/lote-<k>.json. Ademas de lo que nombra la tarea: las hojas del manifiesto (adjuntas) y el contexto de
 * cada toma del lote que la app ya armo (app/revision/contexto-toma-N.txt). La skill queda a pedido. Sin lanzarla
 * (§3.1): quien la lanza agrega uuid, resume, senal, alProgreso y registro.
 */
export function armarSesionRevisionLote(ctx, { manifiesto = leerJSON(RUTAS.manifiesto(ctx.carpeta)), lote, k = 1, total = 1, estiloVisual = null }) {
  const slugRel = `temp/${ctx.slug}`;
  const skill = esHistoria(ctx) ? 'anuncios-historias-musicales' : VISUALES[estiloVisual]?.skill || 'anuncios-crochet';
  const nums = new Set(lote.map((t) => t.n));
  const ruta = rutaRevisionLote(ctx, k);
  const verificar = async () => {
    if (!existe(ruta)) return { ok: false, errores: [`No encuentro ${path.relative(RAIZ, ruta).split(path.sep).join('/')}: escríbelo (una lista, [] si todo está bien).`] };
    const v = validarRevision(leerJSON(ruta), manifiesto, nums);
    return v.errores.length ? { ok: false, errores: v.errores } : { ok: true };
  };
  const contextos = contextosDe(dirRevision(ctx), 'contexto-toma-*.txt').filter((r) => nums.has(Number(/contexto-toma-(\d+)\.txt$/.exec(r)?.[1])));
  return {
    tipo: 'revision',
    cwd: RAIZ,
    prompt: textoDeRevision(ctx, manifiesto, lote, k, total, estiloVisual),
    herramientas: ['Read', 'Glob', 'Grep', 'Write', 'Edit'],
    permitidas: [`Read(./${slugRel}/**)`, `Read(./.claude/skills/${skill}/**)`, 'Glob', 'Grep', `Write(./${slugRel}/app/revision/lote-${k}.json)`, `Edit(./${slugRel}/app/revision/lote-${k}.json)`],
    prohibidas: prohibidasComunes({ terminal: false }),
    // los contextos del lote, a pedido: repiten lo del manifiesto pegado (la tarea los lee solo de las tomas que rehace)
    material: { skillsAPedido: true, aPedido: contextos, imagenes: hojasDelManifiesto(ctx.carpeta, manifiesto) },
    timeoutMs: 30 * 60000,
    verificar,
  };
}

/** Modo prueba sin Claude: marca UNA toma (la primera A) con un prompt apenas distinto: deja un aviso para probar el camino. */
function revisionSimulada(manifiesto) {
  const t = (manifiesto.tomas || []).find((x) => x.tipo === 'A' && x.n > 1) || (manifiesto.tomas || []).find((x) => x.tipo === 'A');
  if (!t) return [];
  return [
    {
      toma: t.n,
      motivo: `Prueba: un aviso de la revisión para probar el camino (modo prueba, sin ${laIA()}).`,
      promptsNuevos: { prompt_imagen_inicial: `${t.prompt_imagen_inicial} Keep every character identical to its reference sheet.`, prompt_video: `${t.prompt_video} Slow, steady movement.` },
    },
  ];
}

function copiarSiExiste(de, a) {
  if (!existe(de)) return false;
  fs.mkdirSync(path.dirname(a), { recursive: true });
  fs.copyFileSync(de, a);
  return true;
}
/** Una toma que una version anterior de la app empezo a rehacer: vuelve a como estaba (imagenes, clip y manifiesto). */
function restaurarToma(ctx, n) {
  const dir = path.join(dirRevision(ctx), 'respaldo', `toma-${n}`);
  for (const sub of ['img', 'video']) for (const nombre of listar(path.join(dir, sub))) copiarSiExiste(path.join(dir, sub, nombre), path.join(ctx.carpeta, sub, nombre));
  copiarSiExiste(path.join(dir, 'manifiesto.json'), RUTAS.manifiesto(ctx.carpeta));
}

async function revisionImagenes(ctx) {
  const manifiesto = leerJSON(RUTAS.manifiesto(ctx.carpeta));
  if (!manifiesto) return errorDe('No encuentro las escenas del anuncio.', 'manifiesto.json');
  const estado = leerJSON(RUTAS.revisionEstado(ctx.carpeta)) || { sesion: null, lotes: {}, pedidos: [] };
  estado.lotes ||= {};
  const guardarEstado = () => escribirJSON(RUTAS.revisionEstado(ctx.carpeta), estado);
  const estiloVisual = leerJSON(RUTAS.tomasEstado(ctx.carpeta))?.estiloVisual || letraElegida(ctx.carpeta, ctx.brief).estiloVisual || 'crochet';

  // (a) las sesiones de Claude, una por lote, una sola vez (lo que escriben queda en disco: al retomar no se repite)
  if (!estado.sesion?.hecha) {
    const simulada = modoPrueba() && process.env.ANUNCIOS_REVISION_REAL !== '1';
    const claude = simulada ? null : await ctx.claude();
    if (!simulada && !claude?.lanzarSesion) {
      estado.sesion = { hecha: true, ok: false, fecha: ahora() };
      estado.sinRevision = true;
      guardarEstado();
      return { saltado: true, nota: `No se pudo abrir ${laIA()} para revisar las imágenes: siguen como salieron.` };
    }
    ctx.avance('Preparando la revisión de las imágenes');
    for (const t of (manifiesto.tomas || []).filter((x) => ['A', 'B', 'C'].includes(x.tipo))) {
      const destino = path.join(dirRevision(ctx), `contexto-toma-${t.n}.txt`);
      if (existe(destino)) continue;
      const r = await ctx.correr('rehacer-toma.js', [ctx.carpetaArg, '--toma', String(t.n), '--contexto']);
      if (r.cancelado || ctx.senal?.aborted) return { cancelado: true };
      if (r.codigo === 0) escribirTexto(destino, r.texto);
    }
    // una revision nueva: lo que dijo la de antes (si la hubo) ya no vale
    limpiarAvisosDelPaso(ctx.carpeta, 'revision-imagenes');
    const lotes = lotesDeTomas(manifiesto);
    let pedidos = [];
    let descartados = [];
    let sinRevisar = 0;
    let limite = false;
    if (simulada) {
      pedidos = validarRevision(revisionSimulada(manifiesto), manifiesto).pedidos;
      estado.sesion = { hecha: true, ok: true, simulada: true, fecha: ahora() };
    } else {
      const maxIntentos = Math.max(1, Number(process.env.ANUNCIOS_REVISION_INTENTOS) || 2);
      let motorUsado = null; // la IA que miro (lo que dice la nota si no termino)
      for (const [i, lote] of lotes.entries()) {
        const k = i + 1;
        const yaLote = estado.lotes[k];
        if (yaLote?.hecho) continue;
        const ruta = rutaRevisionLote(ctx, k);
        const uuid = yaLote?.uuid || crypto.randomUUID();
        let r = null;
        for (let intento = (yaLote?.intentos || 0) + 1; intento <= maxIntentos; intento++) {
          estado.lotes[k] = { uuid, intentos: intento, hecho: false };
          guardarEstado();
          ctx.avance(lotes.length > 1 ? `${LaIA()} está mirando las imágenes (parte ${k} de ${lotes.length})` : `${LaIA()} está mirando las imágenes`);
          const sesion = armarSesionRevisionLote(ctx, { manifiesto, lote, k, total: lotes.length, estiloVisual });
          r = await claude.lanzarSesion({
            ...sesion,
            uuid,
            resume: intento > 1,
            prompt: intento > 1 ? `Sigue con la tarea de antes y termina ${path.relative(RAIZ, ruta).split(path.sep).join('/')}.\n\n${sesion.prompt}` : sesion.prompt,
            alProgreso: (frase) => ctx.avance(frase),
            registro: path.join(ctx.carpeta, 'app', 'registro', `revision-imagenes-claude-${k}.jsonl`),
            senal: ctx.senal,
          });
          if (r?.motor) motorUsado = r.motor;
          if (r?.ok) break;
          if (ctx.senal?.aborted || r?.cancelado) {
            estado.lotes[k].intentos = intento - 1;
            guardarEstado();
            return { cancelado: true };
          }
          if (r?.limite || r?.sinClaude || r?.sinSesion || r?.planSinCodex) break;
        }
        if (r?.ok) estado.lotes[k] = { uuid, hecho: true, ok: true };
        else {
          estado.lotes[k] = { uuid, hecho: true, ok: false, error: r?.error || null };
          sinRevisar += lote.length;
          if (r?.limite) {
            limite = true;
            break; // sin plan de la IA no se sigue con los demas lotes
          }
        }
        guardarEstado();
      }
      for (const [i] of lotes.entries()) {
        const k = i + 1;
        if (!estado.lotes[k]?.ok) continue;
        const v = validarRevision(leerJSON(rutaRevisionLote(ctx, k)), manifiesto, new Set(lotes[i].map((t) => t.n)));
        pedidos.push(...v.pedidos);
        descartados.push(...v.errores);
      }
      if (limite) sinRevisar = lotes.filter((_, i) => !estado.lotes[i + 1]?.ok).reduce((s, l) => s + l.length, 0);
      estado.sesion = { hecha: true, ok: sinRevisar === 0, limite, fecha: ahora(), ...(motorUsado ? { motor: motorUsado } : {}) };
      if (sinRevisar) estado.sinRevision = true;
    }
    estado.pedidos = pedidos.map((x) => ({ ...x, fase: 'pendiente', resultado: null }));
    estado.descartados = descartados;
    estado.sinRevisar = sinRevisar;
    guardarEstado();
    if (!estado.pedidos.length && estado.sinRevision && sinRevisar >= lotes.reduce((s, l) => s + l.length, 0)) {
      return {
        saltado: true,
        nota: limite ? `Se acabó el uso de tu plan de ${laIA(estado.sesion?.motor)} por ahora: las imágenes no se revisaron y siguen como salieron.` : `${LaIA(estado.sesion?.motor)} no pudo terminar la revisión de las imágenes: siguen como salieron.`,
      };
    }
  }

  // (b) cada toma marcada queda como AVISO en su imagen de inicio, con los prompts que escribio la revision como
  // sugerencia (para «Corregir esto»): no se rehace nada solo (igual que voz en off)
  aplicarComoAvisos(ctx, estado.pedidos, { paso: 'revision-imagenes', restaurar: (n) => restaurarToma(ctx, n) });
  guardarEstado();
  const avisos = estado.pedidos.filter((x) => x.resultado === 'aviso').length;
  const partes = [notaDeAvisos(avisos), estado.sinRevisar ? `${estado.sinRevisar} sin revisar.` : null].filter(Boolean);
  return { ok: true, nota: partes.length ? partes.join(' ') : 'Las imágenes pasaron la revisión.' };
}

// ---------------------------------------------------------------- 11. voces coladas (solo musical)

/** De la salida de revisar-voces: { revisados, conVoz, sinRevisar, transcritos }. */
export function leerVoces(texto) {
  const t = String(texto || '');
  const conVoz = [...t.matchAll(/^\s*VOZ\s+(\S+\.mp4)/gm)].map((m) => m[1]);
  const sinRevisar = [...t.matchAll(/^\s*\?\s+(\S+\.mp4)\s+no se pudo transcribir/gm)].map((m) => m[1]);
  const ok = [...t.matchAll(/^\s*ok\s+(\S+\.mp4)/gm)].map((m) => m[1]);
  const revisados = Number((t.match(/(\d+) revisados/) || [])[1]) || conVoz.length + sinRevisar.length + ok.length;
  return { revisados, conVoz, sinRevisar, transcritos: [...ok, ...conVoz] };
}

async function voces(ctx) {
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

// ---------------------------------------------------------------- 12-14. montaje, render y control final

async function montaje(ctx) {
  // plan -> subtitulos -> plan: el plan quiere a los subtitulos y los subtitulos al plan (COMO-PRODUCIR 1.3).
  // En los cantados los subtitulos salen de los tiempos de la cancion (npm run subtitulos, como en voz en off).
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

async function render(ctx) {
  // Un render que falla por la PC (el navegador de Remotion no arranco a tiempo, "No frame found", memoria) lo
  // vuelve a intentar ctx.correr, mas despacio (conductor.js, exportarConReintentos): tarda mas, no cuesta nada.
  const r = await ctx.correr('ensamblar.js', [ctx.carpetaArg], { pesado: true });
  if (r.cancelado) return { cancelado: true };
  if (r.codigo === 0) return { ok: true, ...(ctx.paso.renderLento ? { nota: 'La exportación se cayó una vez; más despacio, salió bien.' } : {}) };
  return fallo(r, { que: 'la exportación de los videos', mensaje: 'No pude exportar los videos.' });
}

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
    const r2_ = await ctx.correr('control-final.js', [ctx.carpetaArg], { pesado: true });
    if (r2_.cancelado) return { cancelado: true };
    if (r2_.codigo === 0) return { ok: true, nota: 'Se exportó otra vez y quedó limpio.' };
    if (r2_.codigo === 1) return { ok: true, nota: 'Después de exportar otra vez quedaron detalles: están en el informe.' };
    if (r2_.codigo === 2) return { ok: true, nota: `No pude revisar el video terminado: ${ultimasLineas(r2_.texto, 2)}` };
    return fallo(r2_, { que: 'el control final' });
  }
  return { ok: true, nota: 'Quedaron detalles después de exportar otra vez: están en el informe.' };
}

// ---------------------------------------------------------------- 15. informe

/** Los textos en pantalla de una historia musical (datos-editor.md, tabla texto / toma / momento). */
function textosDelEditor(carpeta) {
  const ruta = path.join(carpeta, 'datos-editor.md');
  if (!existe(ruta)) return [];
  const filas = [];
  for (const l of fs.readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    if (!/^\s*\|/.test(l) || /^\s*\|\s*-{2,}/.test(l)) continue;
    const celdas = l.split('|').slice(1, -1).map((x) => x.trim().replace(/^\*\*|\*\*$/g, ''));
    if (!celdas.length || /^texto$/i.test(celdas[0])) continue;
    filas.push({ texto: celdas[0].replace(/^["“«]|["”»]$/g, ''), toma: celdas[1] || '', momento: celdas[2] || '' });
  }
  return filas.filter((f) => f.texto);
}

/** Lo que el informe general (informe.js, pensado para voz en off) tiene que decir distinto en un cantado. */
export function ajustarInformeCantado(carpeta, informe, { historia = false } = {}) {
  const cj = leerJSON(RUTAS.cancionJson(carpeta)) || {};
  const est = leerEstadoCancion(carpeta);
  const op = leerJSON(RUTAS.opciones(carpeta));
  const tiempos = leerJSON(RUTAS.tiempos(carpeta));
  const dur = Number(informe.duracion?.real) || Number(cj.duracion) || 0;
  const total = op?.pistas?.length || 0;

  const d = (informe.decisiones || []).filter((x) => x.id !== 'voz' && x.id !== 'manda');
  for (const x of d) {
    if (typeof x.detalle !== 'string') continue;
    if (x.id === 'ventanas') {
      x.detalle = 'En la canción esas frases duran más de lo que se calculó: se pidió cada clip con el largo justo para que no falte imagen. Nunca se acortó ninguna.';
      continue;
    }
    x.detalle = x.detalle
      .replace(/sincronizadas con la voz; la palabra que se dice/g, 'sincronizadas con la canción; la palabra que se canta')
      .replace(/para seguir a la voz/g, 'para seguir a la canción')
      .replace(/de la voz/g, 'de la canción');
  }
  const primeras = [
    {
      id: 'manda',
      icono: 'musica',
      titulo: 'Manda la canción',
      detalle: `El video se armó sobre los ${tiempo(dur)} de tu canción: la canción no se cortó ni se aceleró (las escenas se ajustan a ella), y cada una entra en su momento.${historia ? '' : ' La duración la decide la letra, no un número.'}`,
    },
  ];
  if (est.aplicada) {
    primeras.push({
      id: 'cancion',
      icono: 'musica',
      titulo: `La canción: «${String(cj.titulo || 'tu canción')}»`,
      detalle: `Es la versión ${est.aplicada} que elegiste${total > 1 ? `, de ${total} que se hicieron` : ''}.${historia && (est.extensiones || 0) > 0 ? ' Como la letra es larga, se cantó en partes y se unieron solas.' : ''}`,
    });
  }
  d.unshift(...primeras);
  d.push({
    id: 'sin-fondo',
    icono: 'musica',
    titulo: 'Sin música de fondo ni transiciones',
    detalle: `La canción es el audio del anuncio: no lleva otra música debajo y las escenas cambian con cortes limpios.${historia ? ' Los clips van sin su sonido de ambiente: solo se oye la canción.' : ''}`,
  });
  if (historia) {
    const textos = textosDelEditor(carpeta);
    if (textos.length) {
      d.push({
        id: 'textos-editor',
        icono: 'subtitulos',
        titulo: 'Textos para agregar al montar',
        detalle: `No están en el video: se agregan en el editor si los quieres. ${textos.map((t) => `«${t.texto}»${t.toma ? ` (toma ${t.toma})` : ''}`).join(' · ')}`,
        textos,
      });
    }
  }

  const p = [...(informe.problemas || [])];
  for (const r of est.rechazos || []) {
    const cambios = Array.isArray(r.cambios) ? r.cambios : [];
    p.push({
      id: 'letra-cambiada',
      tipo: 'arreglado',
      titulo: cambios.length === 1 ? 'Se cambió una frase de la letra' : 'Se cambiaron frases de la letra',
      detalle: `Suno no quiso cantar una palabra de la letra y la IA la cambió por otra con el mismo sentido. ${cambios.map((x) => `«${x.antes}» → «${x.despues}»`).join(' · ')}`.trim(),
      piezas: [],
    });
  }
  if (Number.isFinite(Number(est.calidad)) && Number(est.calidad) < 0.6) {
    p.push({
      id: 'tiempos-cancion',
      tipo: 'revisar',
      titulo: 'Los tiempos de la canción pueden no ser exactos',
      detalle: 'No se pudo seguir bien una parte de la letra en la canción: ahí los subtítulos y los cortes pueden ir un poco antes o después. Míralo.',
      piezas: [],
    });
  }
  const sinUbicar = (Array.isArray(tiempos?.lineas) ? tiempos.lineas : []).filter((l) => !l.instrumental && l.encontrada === false);
  if (sinUbicar.length) {
    p.push({
      id: 'lineas-sin-ubicar',
      tipo: 'revisar',
      titulo: sinUbicar.length === 1 ? 'Una línea no se encontró en la canción' : `${sinUbicar.length} líneas no se encontraron en la canción`,
      detalle: 'Suno las cantó distinto (o no las cantó): su escena entra en un momento calculado entre las vecinas. Míralas.',
      piezas: sinUbicar.map((l) => ({ n: l.toma, unidad: 'toma', momento: Number(l.inicio) || null, valor: String(l.texto || '').slice(0, 60) })),
    });
  }

  const costo = informe.costo || {};
  if (Array.isArray(costo.partes)) {
    const scribe = Number(costo.elevenlabs?.scribeSegundos) || 0;
    costo.partes = costo.partes
      .map((x) => {
        if (x.id === 'musica') {
          const tandas = Array.isArray(est.tandas) && est.tandas.length ? est.tandas.length : 1;
          return { ...x, nombre: 'Canción', detalle: `Suno, en kie.ai: ${tandas === 1 ? 'una tanda de versiones' : `${tandas} tandas de versiones`}${est.extensiones ? ` y ${est.extensiones} ${est.extensiones === 1 ? 'parte agregada' : 'partes agregadas'}` : ''}` };
        }
        if (x.id === 'voz') return scribe ? { id: 'voz', nombre: 'Tiempos de la canción', detalle: 'ElevenLabs escuchó la canción para los subtítulos y los cortes (de tu plan)' } : null;
        return x;
      })
      .filter(Boolean);
  }
  return { ...informe, decisiones: d, problemas: p, sinProblemas: p.length === 0, costo, cantado: historia ? 'historia-musical' : 'musical' };
}

async function informe(ctx) {
  const saldoFinal = await consultarSaldoKie();
  if (saldoFinal !== null) {
    ctx.conductor.saldoFinal = { creditos: saldoFinal, fecha: ahora() };
    ctx.guardar();
  }
  const base = armarInforme({ carpeta: ctx.carpeta, dirOutput: OUTPUT, conductor: ctx.conductor });
  escribirJSON(path.join(ctx.carpeta, 'app', 'informe.json'), ajustarInformeCantado(ctx.carpeta, base, { historia: esHistoria(ctx) }));
  return { ok: true };
}

// ---------------------------------------------------------------- la secuencia

/** Los pasos de un cantado. `historia` cambia la letra (la escribio Claude) y saca las voces coladas (clips mudos). */
export function pasosCantados({ historia = false } = {}) {
  return [
    { id: 'letra', nombre: historia ? 'Preparar la letra de tu historia' : 'Preparar la letra de la canción', correr: historia ? letraHistoria : letraMusical },
    { id: 'saldo-cancion', nombre: 'Mirar tu saldo para la canción', correr: saldoCancion },
    { id: 'cancion', nombre: historia ? 'Cantar tu historia' : 'Componer tu canción', correr: cancion },
    { id: PASO_PAUSA, nombre: 'Elegir tu canción', correr: elegirCancion },
    { id: 'tomas', nombre: 'Escribir las escenas sobre la canción', correr: tomas },
    { id: 'tiempos', nombre: 'Medir cada escena en la canción', correr: pasoTiempos },
    { id: 'ventanas', nombre: 'Ajustar el largo de cada escena', correr: ventanas },
    { id: 'saldo', nombre: 'Mirar tu saldo de kie', correr: saldo },
    { id: 'imagenes-y-videos', nombre: 'Crear las imágenes y los videos', correr: imagenesYVideos },
    { id: 'revision-imagenes', nombre: 'Revisar las imágenes', correr: revisionImagenes },
    ...(historia ? [] : [{ id: 'voces', nombre: 'Buscar voces que no van', correr: voces }]),
    { id: 'montaje', nombre: 'Armar el montaje y los subtítulos', correr: montaje },
    { id: 'render', nombre: 'Exportar los videos', correr: render },
    { id: 'control-final', nombre: 'Revisar el video terminado', correr: controlFinal },
    { id: 'informe', nombre: 'Preparar el informe', correr: informe },
  ];
}

export const PASOS = pasosCantados({ historia: false });

/**
 * Lo que tiene que estar para poder arrancar la produccion de un musical (en vez del manifiesto, que todavia no
 * existe: se escribe despues de elegir la cancion): null si esta todo, o lo que falta en palabras simples. Para
 * iniciarProduccion (conductor.js), con las familias que exportan ARRANCA_SIN_MANIFIESTO.
 */
export function faltaParaProducir(carpeta, brief = null) {
  const e = letraElegida(carpeta, brief);
  return e.error || null;
}

/**
 * (2026-11-21i) Los pasos de la canción que reusa «Cambiar solo el audio» (familias/cambiar-audio.js): un anuncio con
 * narrador ya hecho pasa a CANTADO con sus mismos clips (la canción, elegirla, los tiempos, el montaje y el render).
 */
export const PASOS_REUSABLES = { validarPeticion, saldoCancion, cancion, elegirCancion, pasoTiempos, montaje, render, controlFinal, informe };

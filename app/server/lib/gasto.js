// El gasto REAL de un anuncio, corrida por corrida.
//
// El motor pisa img/log-modelos.json y video/log-modelos.json en cada corrida (generar-videos.js:2121-2131,
// generar-imagenes.js:1520), asi que despues de cada comando que cobra la app guarda lo de ESA corrida en
// temp/<slug>/app/gasto/<NNN>-<paso>.json. Una entrada cuenta si el log se escribio despues de empezar la
// corrida y su archivo no estaba antes (lo mismo que producir.js, loDeEstaCorrida).
//
//   const foto = fotografiar(carpeta)                       antes del comando
//   registrarCorrida(carpeta, { paso, comando, inicio, foto, manifiesto, ... })   despues (salio bien o mal)
//   resumenDeGasto(carpeta)                                  la suma de todas, en creditos y en dolares
//
// kie cobra en creditos (US$0,005 cada uno, rutas.js). Suno va por kie: 12 creditos por pista
// (generar-musica.js, MUSICA.creditos), sin registro propio del motor: se anota si aparecio la pista. ElevenLabs
// se informa en lo que mide su plan: caracteres de la voz (lo que se manda, voz_en_off) y segundos de audio que
// transcribio Scribe al buscar voces coladas.
//
// Si la app se cerro de golpe a mitad de una corrida, el motor no llega a escribir su log y esas piezas quedan
// sin registro: `sinRegistro` las cuenta (piezas nuevas en disco que ningun log nombra) y el resumen las estima
// con el promedio de lo registrado. Con un solo anuncio en marcha, la diferencia de saldo de kie antes y
// despues (saldoInicial / saldoFinal del conductor) confirma el total.
import fs from 'node:fs';
import path from 'node:path';
import { DOLARES_POR_CREDITO } from './rutas.js';
import { leerJSON, listar, escribirSeguro, escribirJSONSeguro } from './archivos.js';
import { duracionMp4 } from './mp4.js';

export const CREDITOS_SUNO = 12;
// Para estimar lo que quedo sin registro (los de hoy: Sunburst 2K y Omni de 6 s).
const CREDITOS_IMAGEN_ESTIMADO = 10;
const CREDITOS_CLIP_ESTIMADO = 84;

const redondear = (n, d = 2) => Math.round(Number(n) * 10 ** d) / 10 ** d;
export const aDolares = (creditos) => redondear((Number(creditos) || 0) * DOLARES_POR_CREDITO);
const dirGasto = (carpeta) => path.join(carpeta, 'app', 'gasto');

const PIEZA = /\.(png|jpe?g|webp|mp4)$/i;

/** Lo que hay en disco antes de un comando: { 'img/toma-1-inicial.png': mtimeMs, ... }. */
export function fotografiar(carpeta) {
  const foto = {};
  for (const sub of ['img', 'video', 'musica', 'audio']) {
    for (const n of listar(path.join(carpeta, sub))) {
      try {
        const st = fs.statSync(path.join(carpeta, sub, n));
        if (st.isFile()) foto[`${sub}/${n}`] = st.mtimeMs;
      } catch {
        /* se fue mientras se miraba */
      }
    }
  }
  return foto;
}

/** ¿El archivo es nuevo desde la foto? (no estaba, o se volvio a escribir: --rehacer pisa en el lugar) */
function esNuevo(carpeta, rel, foto) {
  if (!(rel in foto)) return true;
  try {
    return fs.statSync(path.join(carpeta, rel)).mtimeMs > foto[rel] + 1;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- corrida en curso (sobrevive a cerrar la app)

const rutaEnCurso = (carpeta) => path.join(dirGasto(carpeta), 'en-curso.json');

/**
 * Antes de un comando que cobra: la foto de la carpeta, guardada en disco. Si la app se cerro a mitad de la
 * corrida anterior, se usa la foto de ESA (la mas vieja): asi lo que alcanzo a generar la corrida cortada
 * cuenta como nuevo en la siguiente (sin registro del motor, porque murio antes de escribir su log: se estima).
 * Devuelve { foto, inicio }.
 */
export function abrirCorrida(carpeta, paso) {
  const previa = leerJSON(rutaEnCurso(carpeta));
  if (previa?.foto && typeof previa.foto === 'object') return { foto: previa.foto, inicio: Date.parse(previa.inicio) || Date.now(), retomada: true };
  const abierta = { paso, inicio: new Date().toISOString(), foto: fotografiar(carpeta) };
  fs.mkdirSync(dirGasto(carpeta), { recursive: true });
  escribirSeguro(rutaEnCurso(carpeta), JSON.stringify(abierta) + '\n');
  return { foto: abierta.foto, inicio: Date.parse(abierta.inicio), retomada: false };
}

/** Despues del comando: anota lo que costo (registrarCorrida) y cierra la corrida en curso. */
export function cerrarCorrida(carpeta, datos) {
  const r = registrarCorrida(carpeta, datos);
  fs.rmSync(rutaEnCurso(carpeta), { force: true });
  return r;
}

// Precio de hoy de lo que quedo sin registro (config.js): Sunburst 2K 10 cr; Omni por tramo; Kling 3.0 20 cr/s.
const OMNI = { 4: 63, 6: 84, 8: 105, 10: 126 };
function estimarPieza(carpeta, rel) {
  if (!rel.startsWith('video/')) return CREDITOS_IMAGEN_ESTIMADO;
  const d = duracionMp4(path.join(carpeta, rel));
  if (!d) return CREDITOS_CLIP_ESTIMADO;
  const tramo = [4, 6, 8, 10].find((x) => x >= d - 0.15);
  return tramo ? OMNI[tramo] : 20 * Math.ceil(d);
}

/** Las entradas de un log-modelos.json que son de esta corrida. */
function deEstaCorrida(carpeta, sub, campo, desdeMs, foto) {
  const log = leerJSON(path.join(carpeta, sub, 'log-modelos.json'));
  if (!log || !(Date.parse(log.generado) >= desdeMs - 1000)) return [];
  return (Array.isArray(log[campo]) ? log[campo] : [])
    .filter((x) => x && x.archivo && esNuevo(carpeta, `${sub}/${x.archivo}`, foto))
    .map((x) => ({
      archivo: x.archivo,
      id: x.id ?? null,
      modelo: x.modelo ?? null,
      respaldo: Boolean(x.respaldo),
      intentos: Number(x.intentos) || 1,
      creditos: Number(x.creditos) || 0,
    }));
}

function siguienteNumero(carpeta) {
  let max = 0;
  for (const n of listar(dirGasto(carpeta))) {
    const m = n.match(/^(\d+)-/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

const textoDeVoz = (m) => (typeof m?.voz_en_off === 'string' ? m.voz_en_off.trim() : '');

/**
 * Guarda lo que costo una corrida. `que` dice que puede haber cobrado:
 *   imagenes/videos   lee los log-modelos de esta corrida
 *   musica            Suno, si aparecio musica/fondo.mp3 (y no era una pista puesta a mano)
 *   voz               ElevenLabs, si aparecio audio/voz.mp3 (los caracteres de voz_en_off)
 *   scribe            ElevenLabs Scribe: los segundos de los clips que se transcribieron (`clips`)
 * Devuelve la corrida guardada, o null si no costo nada.
 */
export function registrarCorrida(carpeta, { paso, comando, inicio, fin = Date.now(), codigo = null, foto = {}, manifiesto = null, que = [], clips = [], salida = '' }) {
  const desde = typeof inicio === 'number' ? inicio : Date.parse(inicio);
  const imagenes = que.includes('imagenes') ? deEstaCorrida(carpeta, 'img', 'imagenes', desde, foto) : [];
  const videos = que.includes('videos') ? deEstaCorrida(carpeta, 'video', 'clips', desde, foto) : [];

  // Piezas nuevas en disco que ningun log nombra (la corrida se corto antes de escribirlo).
  const nombradas = new Set([...imagenes.map((x) => `img/${x.archivo}`), ...videos.map((x) => `video/${x.archivo}`)]);
  const sinRegistro = [];
  for (const sub of [...(que.includes('imagenes') ? ['img'] : []), ...(que.includes('videos') ? ['video'] : [])]) {
    for (const n of listar(path.join(carpeta, sub))) {
      const rel = `${sub}/${n}`;
      if (!PIEZA.test(n) || !esNuevo(carpeta, rel, foto) || nombradas.has(rel)) continue;
      sinRegistro.push({ archivo: rel, creditosEstimados: estimarPieza(carpeta, rel) });
    }
  }

  let musica = null;
  if (que.includes('musica')) {
    const nueva = !('musica/fondo.mp3' in foto) && fs.existsSync(path.join(carpeta, 'musica', 'fondo.mp3'));
    // generar-musica dice "Ya hay una pista tuya" o "Ya esta la pista fija" cuando no llama a Suno.
    if (nueva && !/Ya hay una pista|pista fija|Sin Suno y sin costo/i.test(salida)) musica = { creditos: CREDITOS_SUNO };
  }

  let voz = null;
  if (que.includes('voz') && !('audio/voz.mp3' in foto) && fs.existsSync(path.join(carpeta, 'audio', 'voz.mp3'))) {
    voz = { caracteres: textoDeVoz(manifiesto).length };
  }

  let scribe = null;
  if (que.includes('scribe') && clips.length) {
    const segundos = clips.reduce((s, c) => s + (duracionMp4(path.join(carpeta, 'video', c)) || 0), 0);
    scribe = { clips: clips.length, segundos: redondear(segundos, 1) };
  }

  const creditos =
    imagenes.reduce((s, x) => s + x.creditos, 0) + videos.reduce((s, x) => s + x.creditos, 0) + (musica?.creditos || 0);
  if (!creditos && !sinRegistro.length && !voz && !scribe) return null;

  const corrida = {
    numero: siguienteNumero(carpeta),
    paso,
    comando,
    inicio: new Date(desde).toISOString(),
    fin: new Date(fin).toISOString(),
    codigo,
    creditos: redondear(creditos, 3),
    dolares: aDolares(creditos),
    imagenes,
    videos,
    musica,
    sinRegistro,
    elevenlabs: voz || scribe ? { ...(voz ? { caracteres: voz.caracteres } : {}), ...(scribe ? { scribe } : {}) } : null,
  };
  fs.mkdirSync(dirGasto(carpeta), { recursive: true });
  const nombre = `${String(corrida.numero).padStart(3, '0')}-${paso}.json`;
  escribirJSONSeguro(path.join(dirGasto(carpeta), nombre), corrida);
  return corrida;
}

/** Todas las corridas guardadas, en orden. */
export function corridas(carpeta) {
  return listar(dirGasto(carpeta))
    .filter((n) => /^\d+-.+\.json$/.test(n))
    .sort()
    .map((n) => leerJSON(path.join(dirGasto(carpeta), n)))
    .filter(Boolean);
}

/**
 * La suma de todo lo que costo el anuncio:
 *   { creditos, dolares, imagenes:{piezas,creditos,dolares}, videos:{...}, musica:{pistas,creditos,dolares},
 *     sinRegistro:{piezas, creditosEstimados}, estimado (true si incluye lo sin registro),
 *     elevenlabs:{caracteres, scribeSegundos}, corridas:N, respaldo:[archivos], verificacion? }
 * `conductor` (opcional) trae saldoInicial / saldoFinal para comparar.
 */
export function resumenDeGasto(carpeta, conductor = null) {
  const lista = corridas(carpeta);
  const sumar = (l) => l.reduce((s, x) => s + (Number(x.creditos) || 0), 0);
  const imgs = lista.flatMap((c) => c.imagenes || []);
  const vids = lista.flatMap((c) => c.videos || []);
  const pistas = lista.filter((c) => c.musica).length;
  const cImg = sumar(imgs);
  const cVid = sumar(vids);
  const cMus = pistas * CREDITOS_SUNO;

  // Lo que quedo sin registro (la corrida se corto antes de que el motor escribiera su log), con el precio de
  // hoy de cada pieza (o el promedio de lo registrado si una corrida vieja no lo anoto).
  const sinMapa = new Map();
  for (const c of lista) {
    for (const x of c.sinRegistro || []) {
      const rel = typeof x === 'string' ? x : x?.archivo;
      if (rel) sinMapa.set(rel, typeof x === 'object' && Number.isFinite(Number(x.creditosEstimados)) ? Number(x.creditosEstimados) : null);
    }
  }
  // Ojo: una pieza estimada en una corrida y que despues aparece en el registro de OTRA corrida se pago dos veces
  // (la otra la volvio a generar: p. ej. la revision rehizo esa toma). No se descuenta. Dentro de una misma corrida
  // lo que el motor si anoto ya no entra en sinRegistro (registrarCorrida).
  const sin = [...sinMapa.keys()];
  const promImg = imgs.length ? cImg / imgs.length : CREDITOS_IMAGEN_ESTIMADO;
  const promVid = vids.length ? cVid / vids.length : CREDITOS_CLIP_ESTIMADO;
  const crSinDe = (pre) => [...sinMapa.entries()].filter(([rel]) => rel.startsWith(pre)).reduce((s, [rel, cr]) => s + (cr ?? (rel.startsWith('img/') ? promImg : promVid)), 0);
  const crSinImg = crSinDe('img/');
  const crSinVid = crSinDe('video/');
  const crSin = crSinImg + crSinVid;
  const nSinImg = sin.filter((r) => r.startsWith('img/')).length;
  const nSinVid = sin.filter((r) => r.startsWith('video/')).length;

  const registrado = cImg + cVid + cMus;
  const creditos = registrado + crSin;
  const caracteres = lista.reduce((s, c) => s + (Number(c.elevenlabs?.caracteres) || 0), 0);
  const scribe = lista.reduce((s, c) => s + (Number(c.elevenlabs?.scribe?.segundos) || 0), 0);

  const resumen = {
    creditos: redondear(creditos, 2),
    dolares: aDolares(creditos),
    dolaresPorCredito: DOLARES_POR_CREDITO,
    imagenes: { piezas: imgs.length, creditos: redondear(cImg, 2), dolares: aDolares(cImg) },
    videos: { piezas: vids.length, creditos: redondear(cVid, 2), dolares: aDolares(cVid) },
    musica: { pistas, creditos: cMus, dolares: aDolares(cMus) },
    sinRegistro: { piezas: sin.length, creditosEstimados: redondear(crSin, 1) },
    estimado: sin.length > 0,
    elevenlabs: { caracteres, scribeSegundos: redondear(scribe, 1) },
    corridas: lista.length,
    respaldo: [...imgs, ...vids].filter((x) => x.respaldo).map((x) => x.archivo),
    // Lo que muestra la entrega, parte por parte (lo sin registro va en su parte, estimado al precio de hoy).
    partes: [
      { id: 'imagenes', piezas: imgs.length + nSinImg, creditos: redondear(cImg + crSinImg, 2), dolares: aDolares(cImg + crSinImg), ...(nSinImg ? { estimadas: nSinImg } : {}) },
      { id: 'videos', piezas: vids.length + nSinVid, creditos: redondear(cVid + crSinVid, 2), dolares: aDolares(cVid + crSinVid), ...(nSinVid ? { estimadas: nSinVid } : {}) },
      ...(pistas ? [{ id: 'musica', piezas: pistas, creditos: cMus, dolares: aDolares(cMus) }] : []),
      { id: 'voz', caracteres },
    ],
  };

  const ini = Number(conductor?.saldoInicial?.creditos);
  const finSaldo = Number(conductor?.saldoFinal?.creditos);
  if (Number.isFinite(ini) && Number.isFinite(finSaldo)) {
    const diferencia = redondear(ini - finSaldo, 2);
    resumen.verificacion = {
      saldoAntes: ini,
      saldoDespues: finSaldo,
      diferencia,
      // un credito de margen (plan, etapa 1: "el costo coincide con la diferencia de saldo, con un credito de
      // margen"). Con piezas estimadas la comparacion es contra el total con lo estimado.
      // (si mientras tanto se uso kie para otra cosa, otro anuncio o la terminal, la diferencia lo incluye)
      coincide: Math.abs(diferencia - creditos) <= 1,
    };
  }
  return resumen;
}

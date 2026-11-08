// FASE 2.3 — genera los clips de video a partir de las imagenes ya generadas.
//
//   node produccion/generar-videos.js temp/mi-anuncio                 todo
//   node produccion/generar-videos.js temp/mi-anuncio --tomas 1,10    solo esas
//   node produccion/generar-videos.js temp/mi-anuncio --broll 9       solo ese B-roll (ninguna toma ni
//                                       otro B-roll; si no entra en el video, tampoco se pide)
//   node produccion/generar-videos.js temp/mi-anuncio --solo-plan     no gasta nada
//   node produccion/generar-videos.js temp/mi-anuncio --si            sin preguntar
//   node produccion/generar-videos.js temp/mi-anuncio --rehacer       regenera lo hecho
//   node produccion/generar-videos.js temp/mi-anuncio --ganchos       suma los ganchos alternativos
//   node produccion/generar-videos.js temp/mi-anuncio --todo-el-broll pide tambien el B-roll que no entra
//                                       en el video con esta voz (ver brollQueEntran, planear-montaje.js)
//   node produccion/generar-videos.js temp/mi-anuncio --pasos 19,20   solo esos pasos (continuidad)
//   node produccion/generar-videos.js temp/mi-anuncio --esperar-imagenes --si
//                                       lo usa npm run producir: ver abajo
//
// Pedidos en marcha (2026-10-24): hasta CONCURRENCIA_VIDEO clips a la vez, y
// cuando uno termina entra el siguiente (antes iban en tandas cerradas que
// esperaban al mas lento). Un fallo no frena a los demas: al final se dice todo
// junto. Ver enMarcha(), abajo. log-modelos.json sale igual, en el orden del plan.
//
// Mientras kie diga que un clip sigue generando NUNCA se pide otro igual: pasado
// TIMEOUT_VIDEO_MS solo se avisa y se sigue esperando el mismo pedido. Cada
// pedido lleva su huella (huellaDeVideo): si el proceso se corta, o se llega al
// tope de espera, la tarea queda anotada en video/<clip>.kie-pendiente.json y al
// volver a correr se retoma esa misma tarea (ver kie-client.js). Pedir otro
// podria cobrar dos veces si el primero termina.
//
// --esperar-imagenes (solo para npm run producir, siempre con --si): las
// imagenes se generan al mismo tiempo en otro proceso. No se exige que ya
// esten: cada clip se pide apenas existen sus archivos de entrada (se mira cada
// 2 s). Cuando aparece <carpeta>/.imagenes-fin.json (lo escribe producir al
// terminar las imagenes), al clip que le falte una imagen se lo da por fallido;
// lo mismo si pasa ESPERA_SIN_IMAGENES_MS sin ninguna novedad de las imagenes.
//
// Continuidad (solo si el manifiesto trae el bloque "continuidad", ver
// continuidad.js): los clips son la cadena — un paso por toma salvo la ultima
// (video/paso-<de>.mp4, de la imagen de una toma a la de la siguiente), el
// clip propio de cada toma B y el cierre (video/toma-<N>.mp4 de la ultima).
// Sin B-roll. --tomas K pide todo lo que toca las imagenes de K (el paso que
// llega, el propio o el cierre de K y el paso que sale); --pasos K, solo ese
// paso. --duracion no se usa: cada largo sale de los tiempos de la voz.
//
// Anuncios por bloques (UGC, tomas tipo R): cada bloque se pide a flash-1-1 SOLO
// con referencias (la hoja del personaje y la foto del producto, en orden, como
// image_urls), sin frames y sin modelo de respaldo. Los "ganchos_alternativos"
// del manifiesto son opcionales: solo se generan con --ganchos, como
// video/gancho-<id>.mp4. Ver generarBloqueR(), abajo.
//
// Lugar repetido (tambien solo R): si un bloque vuelve a un lugar que ya salio
// en otro, lleva como referencia un fotograma de ese otro bloque
// ({ "tipo": "lugar", "de_toma": N, "segundo": S }). El motor lo saca con
// ffmpeg (gratis) a img/<id>.png. Los bloques cuyas referencias ya existen
// arrancan enseguida, y cada uno que esperaba ese fotograma arranca apenas su
// bloque de origen esta generado, sin esperar a los demas. Ver
// ordenarPorLugares() y ejecutarR(), abajo.
//
// Sobre el audio: los clips del modelo principal llegan CON ambiente y efectos
// nativos, sin voces. No se pide ni se apaga por parametro — sale asi. En el
// montaje ese audio se mezcla por debajo de la voz en off (seccion 8).
// El modelo de respaldo (Kling) va con sound: false por decision: su interruptor
// no permite excluir voces y una voz chocaria con la narracion.
//
// Estilos hablados (podcast y entrevista, tomas tipo H; ver
// ESPECIFICACION-podcast-entrevista.md, seccion 2): una toma H va SIN Kling de
// respaldo (no genera el dialogo), y se pide de una de dos maneras:
//
//   - con frame inicial, como una A: img/toma-N-inicial.png como
//     first_frame_url, sin frame final y sin referencias (el podcast, y una
//     toma de entrevista sin "ingredientes": manifiestos de antes);
//   - por INGREDIENTES (entrevista, 2026-10-14): "tomas[].ingredientes" en
//     orden, como image_urls, por el mismo camino que un bloque R
//     (generarBloqueR). "imagen" es img/toma-N-inicial.png (la imagen del
//     clip, imagen 1, que el prompt pide como frame inicial) y el resto son
//     referencias (en B la mano con el microfono y, si sale, el producto).
//     Mismo modelo y mismo precio. Ver rutasDeIngredientes().
//
// Si Omni falla se lee el fallo como en los bloques R (clasificarFallo, de kie-client.js):
// error del servidor -> esperar y volver a correr sin cambiar nada; rechazo de
// contenido -> parar y reescribir el copy de esa toma (errorTomaH). Al
// generar una toma H, lo que se saco de su clip anterior (el original de la
// voz en off y el host recortado) va a historial/, y su medida de
// lineas-habladas.json se quita (sacarDerivadosDeTomaH): el clip nuevo se
// mide otra vez con `npm run lineas` (al final se dice con que tomas). El
// B-roll de estos estilos va a Kling (MODELO_VIDEO_BROLL_POR_ESTILO), mudo
// (SONIDO_BROLL_POR_ESTILO: 14 cr/s en vez de 20), con la duracion entera que
// pide el manifiesto (3 a 15 s). Fuera de estos estilos ningun trabajo cambia.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import {
  MODELOS,
  MODELOS_VIDEO,
  RESOLUCION_VIDEO,
  PRECIOS,
  KIE,
  CONCURRENCIA_VIDEO,
  TIMEOUT_VIDEO_MS,
  TOPE_ESPERA_IMAGEN_MS,
  MODELO_VIDEO_UGC,
  ESTILOS_HABLADOS,
  ESTILOS_SIN_RESPALDO_VIDEO,
  MODELO_VIDEO_BROLL_POR_ESTILO,
  SONIDO_BROLL_POR_ESTILO,
  INGREDIENTE_IMAGEN,
  creditosAUsd,
  creditosClip,
  cargarEnv,
  requerirClave,
} from './config.js';
import { generarVideo, subirArchivo, consultarCreditos, clasificarFallo, esSigueEnKie, esPagadaSinBajar } from './kie-client.js';
import { validarManifiesto } from './validar-manifiesto.js';
import {
  tomaDelBroll,
  listaDeReferencias,
  esGenerada,
  esAportada,
  esLugarDeToma,
  archivoDeHoja,
  archivoDeIngrediente,
} from './referencias.js';
import { archivarSiExiste } from './historial.js';
import { tieneContinuidad, cadenaDeClips, filtrarCadena, textoCuenta, avisosDeLargo } from './continuidad.js';
import { armarClipQuieto, clipDeBiblioteca, guardarEnBiblioteca, itemDeTrabajo, modoSinCobro, movimientoQuieto } from './clips-sin-cobro.js';
import { brollQueEntranEnCarpeta, lineasBrollQueNoEntra } from './planear-montaje.js';

const REINTENTOS = 3;

/**
 * Bloques R: cuanto se espera entre un intento y el siguiente cuando Omni falla
 * por el SERVIDOR (500, caida, timeout, sobrecarga). Antes del 2.o intento 30 s,
 * antes del 3.o 60 s. El 2026-10-04 Omni estuvo caido ~1 hora (13 fallos "500
 * Internal Error, Please try again later.", sin cobro): reintentar al instante
 * no sirve. Un rechazo de CONTENIDO no se reintenta (el mismo prompt falla igual).
 */
export const ESPERAS_SERVIDOR_MS = [30000, 60000];

/** --esperar-imagenes: cada cuanto se mira si ya estan las imagenes de un clip. */
const REVISAR_IMAGENES_MS = 2000;

/**
 * --esperar-imagenes: si pasa este tiempo sin ninguna novedad del proceso de
 * imagenes (ni una imagen nueva en img/, ni un pedido que se crea o termina,
 * que se ve en sus img/<imagen>.kie-pendiente.json, ni el aviso de que las
 * imagenes terminaron, .imagenes-fin.json), los clips que siguen sin sus
 * imagenes se dan por fallidos: el proceso de imagenes se murio o se colgo, y
 * esperar mas no sirve.
 *
 * Tiene que pasar lo que el proceso de imagenes espera UNA tarea en kie
 * (TOPE_ESPERA_IMAGEN_MS, 30 min; a los 6 solo avisa) mas sus rachas de errores
 * al consultar y al bajar (3 min cada una). Antes eran 20 min fijos: una
 * imagen que tardaba 21 en kie hacia fallar sus clips con el proceso de
 * imagenes vivo, y despues la imagen llegaba igual.
 */
const ESPERA_SIN_IMAGENES_MS = TOPE_ESPERA_IMAGEN_MS + 10 * 60 * 1000;

// ---------------------------------------------------------------- plan

/** Un trabajo de bloque R (toma o gancho): sin imagenes propias, solo referencias. */
function trabajoR(b, extra) {
  return {
    ...extra,
    tipo: 'R',
    prompt: b.prompt_video,
    segundos: b.duracion,
    imagenInicial: null,
    imagenFinal: null,
    referencias: [...(b.referencias || [])],
  };
}

/**
 * Continuidad: los trabajos son la cadena de clips (cadenaDeClips), en orden.
 * Cada uno con clase 'paso' o 'toma' (el propio de una B y el cierre son
 * video/toma-<n>.mp4, como hoy) y su rol. Sin B-roll ni ganchos.
 *
 *   soloTomas [K]  todo lo que toca las imagenes de K: paso-(anterior), toma-K
 *                  si es B o la ultima, y paso-K.
 *   soloPasos [K]  solo paso-K.
 *
 * El prompt del propio con duracion_propio y el del cierre ya vienen con el
 * numero de su cabecera ajustado al largo que se pide (ajustarCabecera).
 */
export function planContinuidad(m, { soloTomas = null, soloPasos = null } = {}) {
  return filtrarCadena(cadenaDeClips(m), { soloTomas, soloPasos }).map((c) => ({
    id: c.id,
    clase: c.rol === 'paso' ? 'paso' : 'toma',
    rol: c.rol,
    n: c.linea,
    tipo: c.rol === 'paso' ? 'paso' : c.tipoToma,
    archivo: c.archivo,
    prompt: c.prompt,
    segundos: c.segundos,
    imagenInicial: c.imagenInicial,
    imagenFinal: c.imagenFinal,
    deToma: c.deToma,
    aToma: c.aToma,
    descripcion:
      c.rol === 'paso'
        ? `paso ${c.deToma}->${c.aToma} ${c.segundos}s`
        : `toma ${c.linea} (${c.tipoToma}, ${c.rol}) ${c.segundos}s`,
  }));
}

/**
 * Un clip por toma y uno por B-roll, con las imagenes que necesita cada uno.
 * Con `ganchos: true`, ademas uno por gancho alternativo (solo bloques R).
 * Con `soloBroll: [n]`, solo esos B-roll (ninguna toma ni gancho): rehacer UN
 * B-roll sin tocar nada mas (la revision de los clips de la app).
 * Con continuidad, la cadena (ver planContinuidad).
 */
export function construirPlan(m, { soloTomas, ganchos = false, soloPasos = null, soloBroll = null } = {}) {
  if (tieneContinuidad(m)) return planContinuidad(m, { soloTomas, soloPasos });
  const trabajos = [];

  // Estilos hablados (podcast, entrevista): la toma H va a Omni sin respaldo
  // (ESTILOS_SIN_RESPALDO_VIDEO) y el B-roll a Kling, mudo. Fuera de estos
  // estilos ninguno de estos campos se escribe y los trabajos salen iguales.
  const hablado = ESTILOS_HABLADOS.includes(m.estilo);
  const sinRespaldoH = ESTILOS_SIN_RESPALDO_VIDEO.includes(m.estilo);
  const modeloBroll = hablado ? MODELO_VIDEO_BROLL_POR_ESTILO[m.estilo] ?? MODELOS.video.principal : null;
  const sonidoBroll = hablado && typeof SONIDO_BROLL_POR_ESTILO[m.estilo] === 'boolean' ? SONIDO_BROLL_POR_ESTILO[m.estilo] : undefined;

  const tomas = soloBroll ? [] : soloTomas ? m.tomas.filter((t) => soloTomas.includes(t.n)) : m.tomas;
  for (const t of tomas) {
    if (t.tipo === 'R') {
      // Bloque UGC: no hay frame inicial ni final que buscar en img/.
      trabajos.push(
        trabajoR(t, { id: `toma-${t.n}`, clase: 'toma', n: t.n, archivo: `toma-${t.n}.mp4`, descripcion: `toma ${t.n} (R) ${t.duracion}s` })
      );
      continue;
    }
    if (t.tipo === 'H' && Array.isArray(t.ingredientes) && t.ingredientes.length) {
      // Toma hablada por INGREDIENTES (entrevista): va a generarBloqueR con
      // los ingredientes como image_urls, en su orden ("imagen" = la imagen
      // del clip). imagenInicial queda para comprobar que exista y para
      // mostrarla; al modelo no va como first_frame_url.
      trabajos.push({
        id: `toma-${t.n}`,
        clase: 'toma',
        n: t.n,
        tipo: 'H',
        porIngredientes: true,
        archivo: `toma-${t.n}.mp4`,
        prompt: t.prompt_video,
        segundos: t.duracion,
        imagenInicial: `toma-${t.n}-inicial.png`,
        imagenFinal: null,
        referencias: [...t.ingredientes],
        descripcion: `toma ${t.n} (H, por ingredientes) ${t.duracion}s`,
        cascada: [MODELO_VIDEO_UGC],
      });
      continue;
    }
    trabajos.push({
      id: `toma-${t.n}`,
      clase: 'toma',
      n: t.n,
      tipo: t.tipo,
      archivo: `toma-${t.n}.mp4`,
      prompt: t.prompt_video,
      segundos: t.duracion,
      imagenInicial: `toma-${t.n}-inicial.png`,
      // Solo las Tipo B llevan frame de cierre.
      imagenFinal: t.tipo === 'B' ? `toma-${t.n}-final.png` : null,
      descripcion: `toma ${t.n} (${t.tipo}) ${t.duracion}s`,
      // Toma hablada: solo Omni (Kling no genera el dialogo). Sin esta clave,
      // generarConCascada usa la cascada de siempre.
      ...(t.tipo === 'H' && sinRespaldoH ? { cascada: [MODELOS.video.principal] } : {}),
    });
  }

  const brolls = soloBroll
    ? (m.broll || []).filter((b) => soloBroll.includes(b.n))
    : soloTomas
      ? (m.broll || []).filter((b) => soloTomas.includes(tomaDelBroll(b)))
      : m.broll || [];
  for (const b of brolls) {
    trabajos.push({
      id: `broll-${b.n}`,
      clase: 'broll',
      n: b.n,
      tipo: 'broll',
      archivo: `broll-${b.n}.mp4`,
      prompt: b.prompt_video,
      segundos: b.duracion,
      imagenInicial: `broll-${b.n}.png`,
      imagenFinal: null,
      descripcion: `B-roll ${b.n} ${b.duracion}s${hablado ? ` (${modeloBroll}, mudo)` : ''}`,
      // B-roll de un estilo hablado: Kling, mudo, con la duracion entera que
      // pide el manifiesto (el validador la acota a 3-15 s).
      ...(hablado ? { cascada: [modeloBroll], ...(sonidoBroll !== undefined ? { sonido: sonidoBroll } : {}) } : {}),
    });
  }

  // Ganchos alternativos: otras versiones del bloque que reemplazan, para
  // testear en Meta. Opcionales: solo entran si se piden (--ganchos). Con
  // --tomas, solo los que reemplazan a una de esas tomas.
  if (ganchos && !soloBroll && Array.isArray(m.ganchos_alternativos)) {
    const lista = soloTomas ? m.ganchos_alternativos.filter((g) => soloTomas.includes(g.reemplaza)) : m.ganchos_alternativos;
    for (const g of lista) {
      trabajos.push(
        trabajoR(g, {
          id: `gancho-${g.id}`,
          clase: 'gancho',
          n: g.reemplaza,
          gancho: g.id,
          archivo: `gancho-${g.id}.mp4`,
          descripcion: `gancho ${g.id} (R, reemplaza la toma ${g.reemplaza}) ${g.duracion}s`,
        })
      );
    }
  }

  return trabajos;
}

/**
 * Rutas en disco de las referencias de un bloque R, EN EL ORDEN de la toma:
 * ese orden es el "Imagen 1, Imagen 2" que nombra el prompt.
 *
 * Una referencia con prompt es una hoja generada (img/<id>.png, tambien la
 * generada a partir de una foto); una con solo archivo es la foto que aporto
 * el usuario, en la carpeta del anuncio. Un lugar con "de_toma" es el
 * fotograma que el motor saca de ese bloque, tambien en img/<id>.png.
 */
export function rutasDeReferencias(m, carpeta, ids) {
  const lista = listaDeReferencias(m);
  return ids.map((id) => {
    const r = lista.find((x) => x.id === id);
    if (r && esLugarDeToma(r)) {
      return { id, ruta: path.join(carpeta, 'img', archivoDeHoja(r)), como: 'fotograma de lugar', deToma: r.de_toma, segundo: r.segundo };
    }
    if (r && esGenerada(r)) return { id, ruta: path.join(carpeta, 'img', archivoDeHoja(r)), como: 'hoja generada' };
    if (r && esAportada(r)) return { id, ruta: path.join(carpeta, r.archivo), como: 'foto aportada' };
    return { id, ruta: null, como: 'no esta en la lista de referencias' };
  });
}

/**
 * Rutas en disco de los INGREDIENTES de una toma H de la entrevista, EN SU
 * ORDEN: ese orden es el "(imagen 1)", "(imagen 2)" que nombra el prompt.
 * "imagen" es la imagen del clip, img/toma-N-inicial.png (la genera
 * generar-imagenes.js como siempre); cualquier otro id es su referencia, igual
 * que en rutasDeReferencias (la mano con el microfono, la foto del producto).
 */
export function rutasDeIngredientes(m, carpeta, n, ids) {
  return ids.map((id) =>
    id === INGREDIENTE_IMAGEN
      ? { id, ruta: path.join(carpeta, archivoDeIngrediente(m, n, id)), como: 'imagen del clip' }
      : rutasDeReferencias(m, carpeta, [id])[0]
  );
}

/**
 * Saca UN fotograma de un clip (ffmpeg, gratis) y lo guarda como PNG. Es la
 * referencia de un lugar repetido. Si `segundo` cae al final del clip (donde
 * ffmpeg ya no encuentra cuadro), se toma 0,1 s antes. Escribe a un temporal y
 * despues renombra: un fotograma a medio escribir nunca queda en img/.
 * Devuelve { ruta, segundo } con el segundo que se uso de verdad.
 */
export function sacarFotograma(rutaVideo, segundo, rutaDestino) {
  let s = Number(segundo);
  try {
    const dur = Number(
      execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', rutaVideo], { encoding: 'utf8' }).trim()
    );
    if (Number.isFinite(dur) && dur > 0) s = Math.min(s, Math.max(0, Number((dur - 0.1).toFixed(3))));
  } catch {
    // Sin ffprobe (o sin duracion legible) se intenta con el segundo tal cual.
  }
  fs.mkdirSync(path.dirname(rutaDestino), { recursive: true });
  const tmp = path.join(path.dirname(rutaDestino), `.${path.basename(rutaDestino, '.png')}.tmp.png`);
  try {
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-ss', String(s), '-i', rutaVideo, '-frames:v', '1', tmp], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    const detalle = String(e.stderr || e.message || '').trim().split(/\r?\n/).slice(-2).join(' ');
    throw new Error(`no pude sacar el fotograma de ${path.basename(rutaVideo)} en el segundo ${s} (ffmpeg: ${detalle})`);
  }
  if (!fs.existsSync(tmp) || fs.statSync(tmp).size === 0) {
    fs.rmSync(tmp, { force: true });
    throw new Error(`ffmpeg no devolvio ningun cuadro de ${path.basename(rutaVideo)} en el segundo ${s}`);
  }
  fs.renameSync(tmp, rutaDestino);
  return { ruta: rutaDestino, segundo: s };
}

/**
 * Lugares repetidos de los bloques R de ESTE plan (ya filtrado: solo lo que se
 * va a generar). Para cada referencia de lugar decide de donde sale el
 * fotograma (r.estado) y, con eso, en que pasada va cada trabajo:
 *
 *   'ya-sacado'           img/<id>.png existe y su bloque de origen no se
 *                         regenera en esta corrida: se reusa.
 *   'se-saca-ahora'       no existe, el clip del bloque de origen si: se saca
 *                         antes de generar (gratis).
 *   'despues-del-origen'  el bloque de origen se genera en esta corrida: el
 *                         fotograma se saca de su clip NUEVO (si habia uno
 *                         anterior, va a historial/) y quien lo usa arranca
 *                         apenas ese bloque esta generado.
 *   'falta-origen'        no existe, y el bloque de origen ni esta generado ni
 *                         entra en esta corrida (p. ej. --tomas 4 sin el 1).
 *
 * Marca t.dependeDe (los n de los bloques que tiene que esperar) y t.pasada.
 * Devuelve { pasadas: [[trabajos], ...], faltan: [{ trabajo, ref }] }. Sin
 * lugares, todo queda en una sola pasada, en el orden del plan.
 *
 * Las pasadas son para mostrar el plan (y para que, entre los que pueden
 * arrancar, vayan primero los de las primeras): al generar, ejecutarR no
 * espera a que termine una pasada entera, solo a los bloques de t.dependeDe.
 */
export function ordenarPorLugares(plan, carpeta) {
  const dirVideo = path.join(carpeta, 'video');
  const tomaEnPlan = new Map(plan.filter((t) => t.tipo === 'R' && t.clase === 'toma').map((t) => [t.n, t]));
  const faltan = [];
  for (const t of plan) {
    t.dependeDe = [];
    for (const r of t.rutasReferencias || []) {
      if (r.como !== 'fotograma de lugar') continue;
      r.habiaFotograma = Boolean(r.ruta) && fs.existsSync(r.ruta);
      if (tomaEnPlan.has(r.deToma)) {
        r.estado = 'despues-del-origen';
        if (!t.dependeDe.includes(r.deToma)) t.dependeDe.push(r.deToma);
      } else if (r.habiaFotograma) {
        r.estado = 'ya-sacado';
      } else if (fs.existsSync(path.join(dirVideo, `toma-${r.deToma}.mp4`))) {
        r.estado = 'se-saca-ahora';
      } else {
        r.estado = 'falta-origen';
        faltan.push({ trabajo: t, ref: r });
      }
    }
  }

  // Pasada = 1 + la mayor pasada de sus bloques de origen. El validador ya
  // descarta ciclos; el tope de profundidad es solo una red.
  const memo = new Map();
  const pasadaDe = (t, prof = 0) => {
    if (memo.has(t)) return memo.get(t);
    let p = 1;
    if (prof < 50) {
      for (const n of t.dependeDe) {
        const o = tomaEnPlan.get(n);
        if (o && o !== t) p = Math.max(p, 1 + pasadaDe(o, prof + 1));
      }
    }
    memo.set(t, p);
    return p;
  };
  const pasadas = [];
  for (const t of plan) {
    t.pasada = pasadaDe(t);
    (pasadas[t.pasada - 1] ||= []).push(t);
  }
  return { pasadas: pasadas.filter(Boolean), faltan };
}

// ---------------------------------------------------------------- generacion

/**
 * Toma hablada (H) que se vuelve a generar: lo que se saco de su clip
 * ANTERIOR ya no vale y va a historial/ (costo plata o tiempo: no se tira).
 *
 *   video/originales/toma-N.mp4 y .json   el clip crudo y su medida, que guarda
 *       recortar-voz.js (voz en off de la entrevista A) para partir siempre
 *       del original. Sin ellos, recortar-voz toma el clip nuevo como original.
 *       Van a historial/ como toma-N-original--<fecha>: con el nombre de
 *       siempre chocarian con el clip de video/, archivado en el mismo segundo.
 *   video/recorte-toma-N.webm y su entrada en recorte.json   el host recortado
 *       sin fondo (podcast en esquina, recortar-host.js). Sin la entrada, el
 *       plan vuelve a la ventana en la esquina y avisa que hay que recortar.
 *   su entrada en lineas-habladas.json   donde cae cada palabra, medido sobre
 *       el clip viejo (npm run lineas). Omni entrega los clips de una misma
 *       duracion con el mismo largo (10.005 s, 10.01 s), asi que comparar el
 *       largo no alcanza para darse cuenta de que es de otro clip: se quita, y
 *       el plan, el paso voz y la revision la ven como faltante ("corre npm run
 *       lineas") en vez de cortar el clip nuevo con los tiempos del viejo. No
 *       va a historial/ (se vuelve a medir sin costo de video).
 *
 * Lo llaman generarConCascada y generarBloqueR (solo con tomas H) y
 * rehacer-toma.js. Devuelve los nombres que quedaron en historial/, mas
 * "recorte.json (toma N)" y "lineas-habladas.json (toma N)" si se quito esa
 * entrada (ver entradaQuitada). Si no hay nada, [].
 */
export function sacarDerivadosDeTomaH(carpeta, n) {
  const sacados = [];
  const dirOrig = path.join(carpeta, 'video', 'originales');
  for (const ext of ['.mp4', '.json']) {
    const f = path.join(dirOrig, `toma-${n}${ext}`);
    if (!fs.existsSync(f)) continue;
    const conOtroNombre = path.join(dirOrig, `toma-${n}-original${ext}`);
    fs.renameSync(f, conOtroNombre);
    const guardado = archivarSiExiste(conOtroNombre, carpeta);
    if (guardado) sacados.push(path.basename(guardado));
  }
  const recorte = archivarSiExiste(path.join(carpeta, 'video', `recorte-toma-${n}.webm`), carpeta);
  if (recorte) sacados.push(path.basename(recorte));
  // Las entradas de esa toma en recorte.json y en lineas-habladas.json se
  // midieron sobre el clip viejo.
  for (const archivo of ['recorte.json', 'lineas-habladas.json']) {
    if (quitarEntradaDeToma(path.join(carpeta, archivo), n)) sacados.push(entradaQuitada(archivo, n));
  }
  return sacados;
}

/** Como nombra sacarDerivadosDeTomaH una entrada que quito de un json (no es un archivo de historial/). */
export const entradaQuitada = (archivo, n) => `${archivo} (toma ${n})`;

/**
 * Quita tomas["N"] de un json de la carpeta del anuncio (recorte.json,
 * lineas-habladas.json). true si la habia. Un archivo que no esta o no se
 * puede leer no frena nada: se deja como esta.
 */
function quitarEntradaDeToma(ruta, n) {
  if (!fs.existsSync(ruta)) return false;
  try {
    const datos = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    if (!datos?.tomas || typeof datos.tomas !== 'object' || !(String(n) in datos.tomas)) return false;
    delete datos.tomas[String(n)];
    fs.writeFileSync(ruta, JSON.stringify(datos, null, 2) + '\n', 'utf8');
    return true;
  } catch {
    return false; // ilegible: queda como esta
  }
}

/**
 * Lo de sacarDerivadosDeTomaH, dicho en pocas lineas (o nada si no habia
 * nada): los archivos que fueron a historial/, la entrada de recorte.json y la
 * medida de lineas-habladas.json, con el comando para volver a medir.
 */
function avisarDerivadosSacados(sacados, n, carpetaArg) {
  const medida = entradaQuitada('lineas-habladas.json', n);
  const recorte = entradaQuitada('recorte.json', n);
  const aHistorial = sacados.filter((s) => s !== medida && s !== recorte);
  if (aHistorial.length) console.log(`      (lo que salio del clip anterior se guardo en historial/: ${aHistorial.join(', ')})`);
  if (sacados.includes(recorte)) console.log(`      (su host recortado era del clip anterior: se quito de recorte.json)`);
  if (sacados.includes(medida)) {
    console.log(`      (su medida de lineas-habladas.json era del clip anterior y se quito: midelo con npm run lineas -- ${carpetaArg} --tomas ${n})`);
  }
}

/**
 * UNICA EXCEPCION donde el motor toca un prompt.
 *
 * Los prompts los escribe la skill y el motor no los edita. Pero en
 * dialogo_nativo el video prompt empieza con "Duracion: Ns." y el parametro
 * `duration` de la API solo acepta 4, 6, 8 o 10. Cuando la duracion de la
 * escena se redondea hacia arriba (5.2s -> 6), el numero escrito adentro del
 * prompt y el parametro dejan de coincidir, y le estariamos mandando dos
 * duraciones distintas al mismo modelo en la misma llamada.
 *
 * Por eso, y solo por eso, se reescribe ese numero. Es un dato tecnico, no
 * contenido creativo. Ninguna otra parte del prompt se toca nunca.
 *
 * Acepta las formas que escriben las skills: "Duracion: 6s.", "Duración: 6 s",
 * "Duration: 6s." — con o sin tilde, con o sin espacio, en mayuscula o no.
 */
export function ajustarDuracionEnPrompt(prompt, segundosPedidos) {
  if (typeof prompt !== 'string') return { prompt, cambiado: false };
  const re = /(Duraci[oó]n|Duration)(\s*:\s*)(\d+(?:[.,]\d+)?)(\s*s)/i;
  const m = prompt.match(re);
  if (!m) return { prompt, cambiado: false };
  const escrito = Number(String(m[3]).replace(',', '.'));
  if (escrito === segundosPedidos) return { prompt, cambiado: false };
  return {
    prompt: prompt.replace(re, `$1$2${segundosPedidos}$4`),
    cambiado: true,
    antes: escrito,
    despues: segundosPedidos,
  };
}

// ---------------------------------------------------------------- un pedido, una sola vez

/**
 * sha1 del CONTENIDO de un archivo local de entrada (frame, hoja, foto). Se
 * guarda por ruta, peso y fecha: un frame se lee una sola vez aunque lo usen
 * dos clips (con continuidad cada imagen es la llegada de un paso y la salida
 * del siguiente), y un fotograma de lugar que se vuelve a sacar se lee de nuevo.
 */
const cacheSha1 = new Map();
function sha1DeArchivo(ruta) {
  const absoluta = path.resolve(ruta);
  const st = fs.statSync(absoluta);
  const clave = `${absoluta}|${st.size}|${st.mtimeMs}`;
  if (!cacheSha1.has(clave)) cacheSha1.set(clave, crypto.createHash('sha1').update(fs.readFileSync(absoluta)).digest('hex'));
  return cacheSha1.get(clave);
}

/**
 * La huella de un pedido de video: lo que kie recibe de verdad (modelo, el
 * prompt que se manda, aspecto, resolucion, duracion, sonido si va) y el sha1
 * del contenido de cada archivo local de entrada, en orden. Nunca la URL
 * subida: esa cambia en cada corrida. Con la misma huella, generarVideo retoma
 * la tarea anotada en <clip>.kie-pendiente.json en vez de pedir otra (ver
 * kie-client.js); si algo cambio (otro prompt, otra imagen), es otro pedido.
 */
export function huellaDeVideo({ modelo, prompt, aspecto, resolucion, duracion, sonido, archivos = [] }) {
  const datos = {
    modelo,
    prompt,
    aspecto,
    resolucion,
    duracion,
    ...(typeof sonido === 'boolean' ? { sonido } : {}),
    archivos: archivos.map(sha1DeArchivo),
  };
  return crypto.createHash('sha1').update(JSON.stringify(datos)).digest('hex');
}

/**
 * Lo que se dice cuando un clip pasa TIMEOUT_VIDEO_MS y kie sigue diciendo que
 * lo esta generando. Antes, ahi se cortaba y se pedia otro (y si el primero
 * terminaba, se pagaban los dos); ahora es solo un aviso.
 */
const avisoSigueGenerando = (trabajo) => (segundos) =>
  console.log(
    `  ..  ${trabajo.descripcion}: sigue generando en kie a los ${Math.round(segundos)} s; se sigue esperando el MISMO pedido ` +
      '(no se pide otro para no pagar dos veces)'
  );

/**
 * El comando para volver a correr LO MISMO: con los --tomas, --pasos,
 * --sin-broll y --ganchos de esta corrida (ver el ctx del CLI). Sin ellos,
 * "el mismo comando" pediria todo lo que falta del anuncio.
 */
function comandoVideos(ctx, { ganchos = false } = {}) {
  const extra = [
    ctx.soloTomas?.length ? `--tomas ${ctx.soloTomas.join(',')}` : null,
    ctx.soloBroll?.length ? `--broll ${ctx.soloBroll.join(',')}` : null,
    ctx.soloPasos?.length ? `--pasos ${ctx.soloPasos.join(',')}` : null,
    ctx.sinBroll ? '--sin-broll' : null,
    ctx.todoElBroll ? '--todo-el-broll' : null,
    ganchos || ctx.conGanchos ? '--ganchos' : null,
  ].filter(Boolean);
  return `npm run videos -- ${ctx.carpetaArg}${extra.length ? ` ${extra.join(' ')}` : ''}`;
}

/**
 * Un clip que kie no termino dentro del tope de espera (TOPE_ESPERA_VIDEO_MS),
 * o cuya tarea kie no dejo consultar por varios minutos: sigue en kie con su
 * taskId. No se reintenta ni se pasa al respaldo (pedir otro podria cobrar dos
 * veces si el primero termina). Su pendiente queda en video/ y, volviendo a
 * correr el mismo comando, generarVideo retoma ESA tarea (con el modelo con que
 * se pidio, tambien si fue el de respaldo: ver generarConCascada).
 */
function errorSigueEnKie(trabajo, e, ctx) {
  const err = new Error(
    `${trabajo.descripcion}: sigue en kie (tarea ${e.taskId ?? '(sin taskId)'}) y se dejo de esperar.\n` +
      `  Motivo: ${e.message}\n` +
      '  No se pidio otro ni se paso al modelo de respaldo: si el primero termina, se pagarian los dos.\n' +
      '  Volviendo a correr el mismo comando, SIN --rehacer, se retoma esa misma tarea y se descarga\n' +
      '  apenas este lista (lo ya generado no se vuelve a pagar):\n' +
      `      ${comandoVideos(ctx, { ganchos: trabajo.clase === 'gancho' })}`
  );
  err.trabajo = trabajo;
  err.taskId = e.taskId;
  err.sigueEnKie = true;
  err.claseFallo = 'sigue-en-kie';
  return err;
}

/**
 * Un clip que termino bien en kie (ya cobrado) y no se pudo bajar
 * (esPagadaSinBajar, ver kie-client.js): ni otro intento ni el respaldo, que
 * pedirian y pagarian otro. El mensaje de kie-client ya dice si al volver a
 * correr se baja ese mismo o se pide uno nuevo.
 */
function errorPagadaSinBajar(trabajo, e, ctx) {
  const err = new Error(
    `${trabajo.descripcion}: ${e.message}\n` +
      '  No se reintento ni se paso al modelo de respaldo: los dos pedirian (y pagarian) otro.\n' +
      `  El mismo comando, SIN --rehacer:  ${comandoVideos(ctx, { ganchos: trabajo.clase === 'gancho' })}`
  );
  err.trabajo = trabajo;
  err.taskId = e.taskId;
  err.pagadaSinBajar = true;
  err.claseFallo = 'pagada-sin-bajar';
  return err;
}

/** La tarea que dejo anotada kie-client.js para este clip (contrato), o null. */
function leerPendiente(destino) {
  try {
    const p = JSON.parse(fs.readFileSync(`${destino}.kie-pendiente.json`, 'utf8'));
    return p && typeof p === 'object' && p.huella ? p : null;
  } catch {
    return null;
  }
}

/**
 * Genera un clip a partir de sus imagenes, con reintentos y cascada de modelos.
 *
 * La cascada es la de siempre (principal y respaldo) salvo que el trabajo
 * traiga la suya (`trabajo.cascada`: las tomas H y el B-roll de los estilos
 * hablados, ver construirPlan). `trabajo.sonido` (true/false), si viene, se
 * pasa tal cual a generarVideo (solo lo lee el adaptador de Kling).
 *
 * Toma H (tipo 'H'): cada fallo se lee como en los bloques R
 * (clasificarFalloR): un rechazo de contenido no se reintenta (el mismo
 * prompt falla igual) y un error del servidor espera ESPERAS_SERVIDOR_MS entre
 * intentos. Si se agotan, el error dice que hacer (errorTomaH). Las demas
 * tomas siguen con los reintentos y el mensaje de siempre, salvo un rechazo de
 * CONTENIDO: con ese modelo no se gastan los otros intentos (antes se repetia
 * 3 veces y fallaba igual) y se pasa directo al respaldo, si lo hay.
 *
 * Solo se vuelve a pedir cuando kie dice que fallo (los fallos no se cobran).
 * Un clip que sigue en kie (esSigueEnKie: se llego al tope de espera) no se
 * reintenta ni pasa al respaldo: falla con errorSigueEnKie y se retoma al
 * volver a correr. Cada pedido lleva su huella (huellaDeVideo).
 */
async function generarConCascada(trabajo, ctx, log) {
  const destino = path.join(ctx.dirVideo, trabajo.archivo);
  // Con --rehacer, el clip anterior se archiva en vez de perderse.
  const archivado = archivarSiExiste(destino, ctx.carpeta);
  if (archivado) console.log(`      (el clip anterior se guardo en historial/${path.basename(archivado)})`);
  const cascada = Array.isArray(trabajo.cascada) && trabajo.cascada.length ? trabajo.cascada : [MODELOS.video.principal, MODELOS.video.respaldo];
  const fallos = [];
  // Toma hablada: los errores enteros (failCode / failMsg), para clasificarlos.
  const esH = trabajo.tipo === 'H';
  const erroresH = [];
  // Toma hablada: el original de la voz y el host recortado salieron del clip anterior.
  if (esH && trabajo.clase === 'toma') avisarDerivadosSacados(sacarDerivadosDeTomaH(ctx.carpeta, trabajo.n), trabajo.n, ctx.carpetaArg);

  // Las imagenes se suben una sola vez y la URL queda cacheada.
  const urlInicial = await subirArchivo(path.join(ctx.dirImg, trabajo.imagenInicial));
  const urlFinal = trabajo.imagenFinal ? await subirArchivo(path.join(ctx.dirImg, trabajo.imagenFinal)) : null;
  // Para la huella: el contenido de las mismas imagenes, en el mismo orden.
  const archivosEntrada = [trabajo.imagenInicial, trabajo.imagenFinal].filter(Boolean).map((f) => path.join(ctx.dirImg, f));
  // El modelo anterior de la cascada rechazo el clip por contenido (no se agotaron sus intentos).
  let rechazoPorContenido = false;

  // Una tarea que quedo en kie de una corrida anterior se retoma con el MISMO
  // modelo con que se pidio, como en generar-imagenes.js. Si fue con el
  // respaldo y se empezara por el principal, la huella no coincidiria: se
  // pediria otro al principal y, si volvia a fallar, OTRO al respaldo mientras
  // el primero seguia en kie (que lo cobra al terminar). La huella de cada
  // nivel se arma igual que abajo (su duracion, su resolucion, su prompt).
  const huellaDeNivel = (modelo) => {
    const { resolucion, duracion, excedeTope } = creditosClip(modelo, trabajo.segundos, RESOLUCION_VIDEO);
    if (excedeTope || (trabajo.imagenFinal && !MODELOS_VIDEO[modelo].frameFinal)) return null;
    const prompt = ajustarDuracionEnPrompt(trabajo.prompt, duracion).prompt;
    return huellaDeVideo({ modelo, prompt, aspecto: ctx.aspectRatio, resolucion: resolucion.api, duracion, sonido: trabajo.sonido, archivos: archivosEntrada });
  };
  let desde = 0;
  const pendiente = leerPendiente(destino);
  if (pendiente) {
    const k = cascada.findIndex((m) => huellaDeNivel(m) === pendiente.huella);
    if (k > 0) {
      desde = k;
      console.log(`  ..  ${trabajo.descripcion}: la tarea que quedo en kie se pidio con el respaldo (${cascada[k]}); se retoma con ese modelo`);
    }
  }

  for (let nivel = desde; nivel < cascada.length; nivel++) {
    const modelo = cascada[nivel];
    const def = MODELOS_VIDEO[modelo];
    const { creditos, resolucion, duracion, excedeTope } = creditosClip(modelo, trabajo.segundos, RESOLUCION_VIDEO);

    if (excedeTope) {
      throw new Error(
        `${trabajo.descripcion} dura ${trabajo.segundos}s y pasa el tope de ${modelo}.\n` +
          '  Hay que dividirla en dos tomas en el manifiesto, no truncarla.'
      );
    }

    if (trabajo.imagenFinal && !def.frameFinal) {
      fallos.push(`${modelo} no acepta frame final`);
      continue;
    }

    if (nivel > desde) {
      console.log(
        rechazoPorContenido
          ? `\n  ! ${trabajo.descripcion}: ${cascada[nivel - 1]} lo rechazo por contenido (con ese modelo no se reintenta: el mismo prompt falla igual).`
          : `\n  ! ${trabajo.descripcion}: fallo ${REINTENTOS} veces con ${cascada[0]}.`
      );
      console.log(`    Motivo: ${fallos[fallos.length - 1]}`);
      console.log(`    Cambio al modelo de respaldo: ${modelo} (${resolucion.nombre}, ${duracion}s).`);
      console.log('    Puede haber diferencia visual con el resto de los clips.\n');
    }
    rechazoPorContenido = false;

    for (let intento = 1; intento <= REINTENTOS; intento++) {
      try {
        const ajuste = ajustarDuracionEnPrompt(trabajo.prompt, duracion);
        if (ajuste.cambiado && intento === 1 && nivel === 0) {
          console.log(`      (${trabajo.descripcion}: el prompt decia "Duracion: ${ajuste.antes}s" y el clip se pide de ${ajuste.despues}s; se ajusta el numero dentro del prompt para que no se contradigan)`);
        }
        const huella = huellaDeVideo({
          modelo,
          prompt: ajuste.prompt,
          aspecto: ctx.aspectRatio,
          resolucion: resolucion.api,
          duracion,
          sonido: trabajo.sonido,
          archivos: archivosEntrada,
        });

        const r = await generarVideo({
          modelo,
          prompt: ajuste.prompt,
          frameInicial: urlInicial,
          frameFinal: urlFinal,
          aspectRatio: ctx.aspectRatio,
          resolucionApi: resolucion.api,
          duracion,
          // Solo el B-roll de los estilos hablados lo trae (Kling mudo). Sin
          // el, generarVideo manda el cuerpo de siempre.
          ...(typeof trabajo.sonido === 'boolean' ? { sonido: trabajo.sonido } : {}),
          rutaDestino: destino,
          // Pasado este tiempo solo se avisa: se sigue esperando el mismo pedido.
          timeoutMs: TIMEOUT_VIDEO_MS,
          alAvisar: avisoSigueGenerando(trabajo),
          huella,
        });

        log.push({
          id: trabajo.id,
          archivo: trabajo.archivo,
          modelo: r.modeloReal,
          respaldo: nivel > 0,
          intentos: intento,
          tipo: trabajo.tipo,
          segundosUtiles: trabajo.segundos,
          segundosPedidos: duracion,
          resolucion: resolucion.nombre,
          frameFinal: Boolean(urlFinal),
          creditos: r.creditos,
          taskId: r.taskId,
          ...(typeof trabajo.sonido === 'boolean' ? { sonido: trabajo.sonido } : {}),
          // Solo con continuidad: que papel tiene el clip en la cadena y, en
          // los pasos, de que imagen sale y a cual llega.
          ...(trabajo.rol ? { rol: trabajo.rol } : {}),
          ...(trabajo.clase === 'paso'
            ? { deToma: trabajo.deToma, aToma: trabajo.aToma, desde: trabajo.imagenInicial, hasta: trabajo.imagenFinal }
            : {}),
        });

        const marcaB = urlFinal ? ' [inicial+final]' : '';
        const aviso = nivel > 0 ? '  (RESPALDO)' : '';
        console.log(`  OK  ${trabajo.descripcion} -> ${duracion}s${marcaB} — ${r.creditos ?? '?'} cr${aviso}`);
        return { ruta: r.ruta };
      } catch (e) {
        fallos.push(e.message);
        // Sigue en kie, o termino y no se pudo bajar: ni otro intento ni el
        // respaldo (los dos crearian otra tarea).
        if (esSigueEnKie(e)) throw errorSigueEnKie(trabajo, e, ctx);
        if (esPagadaSinBajar(e)) throw errorPagadaSinBajar(trabajo, e, ctx);
        const quedan = REINTENTOS - intento;
        if (esH) {
          // Toma hablada: misma lectura del fallo que en un bloque R.
          erroresH.push(e);
          const clase = clasificarFalloR(e);
          if (clase === 'contenido') {
            // El mismo prompt va a fallar igual: no se gastan los otros intentos.
            console.log(`  ..  ${trabajo.descripcion}: intento ${intento}/${REINTENTOS} rechazado por contenido (${e.message.slice(0, 130)}) — no se reintenta`);
            rechazoPorContenido = true;
            break;
          }
          const espera = clase === 'servidor' ? ESPERAS_SERVIDOR_MS[Math.min(intento - 1, ESPERAS_SERVIDOR_MS.length - 1)] : 3000 * intento;
          const siguiente = !quedan ? '' : clase === 'servidor' ? ` — error del servidor, reintento en ${Math.round(espera / 1000)} s` : ' — reintento';
          console.log(`  ..  ${trabajo.descripcion}: intento ${intento}/${REINTENTOS} fallo (${e.message.slice(0, 130)})${siguiente}`);
          if (quedan) await new Promise((r) => setTimeout(r, espera));
          continue;
        }
        if (clasificarFallo(e) === 'contenido') {
          // Rechazo por politicas: con este modelo el mismo prompt falla igual.
          // No se gastan los otros intentos; si hay respaldo, se pasa directo.
          const respaldo = cascada[nivel + 1];
          const queSigue = respaldo ? ` — no se reintenta con ${modelo}: paso directo al respaldo (${respaldo})` : ' — no se reintenta (el mismo prompt falla igual)';
          console.log(`  ..  ${trabajo.descripcion}: intento ${intento}/${REINTENTOS} rechazado por contenido (${e.message.slice(0, 130)})${queSigue}`);
          rechazoPorContenido = true;
          break;
        }
        console.log(`  ..  ${trabajo.descripcion}: intento ${intento}/${REINTENTOS} fallo (${e.message.slice(0, 130)})${quedan ? ' — reintento' : ''}`);
        if (quedan) await new Promise((r) => setTimeout(r, 3000 * intento));
      }
    }
  }

  // Toma hablada: que paso y que hacer, como en un bloque R.
  if (esH) throw errorTomaH(trabajo, erroresH, cascada[0], ctx);

  // Un solo modelo en la cascada (hoy, el B-roll de los estilos hablados): no
  // hubo "dos modelos" que probar.
  const conQue =
    cascada.length > 1
      ? `fallo con los dos modelos (${cascada.join(' y ')})`
      : rechazoPorContenido
        ? `fue rechazado por contenido con ${cascada[0]} (no se reintento: el mismo prompt falla igual; en este estilo no tiene modelo de respaldo)`
        : `fallo ${fallos.length} ${fallos.length === 1 ? 'vez' : 'veces'} con ${cascada[0]} (en este estilo no tiene modelo de respaldo)`;

  // Con continuidad (los trabajos traen `rol`) un clip no se puede saltar: la
  // cadena quedaria cortada. El prompt de un paso vive en continuidad.pasos.
  const opciones = !trabajo.rol
    ? '    a) reescribir prompt_video de esa toma en el manifiesto y volver a correr\n' +
      '    b) saltarte esa toma\n' +
      '    c) probar con otro modelo'
    : trabajo.clase === 'paso'
      ? `    a) reescribir continuidad.pasos[de=${trabajo.deToma}].prompt_video en el manifiesto, mirando sus dos imagenes\n` +
        `       (npm run continuidad -- ${ctx.carpetaArg} --pares), y volver a correr solo ese paso:\n` +
        `           npm run videos -- ${ctx.carpetaArg} --pasos ${trabajo.deToma}\n` +
        '    b) probar con otro modelo\n' +
        '  Saltarse el paso no se puede: la cadena quedaria cortada.'
      : `    a) reescribir prompt_video de la toma ${trabajo.n} en el manifiesto y volver a correr\n` +
        '    b) probar con otro modelo\n' +
        '  Saltarse el clip no se puede: la cadena quedaria cortada.';
  throw new Error(
    `${trabajo.descripcion} ${conQue}.\n` +
      `  Ultimo motivo: ${fallos[fallos.length - 1]}\n\n` +
      '  No voy a inventar un prompt distinto por mi cuenta. Decide tu:\n' +
      opciones
  );
}

/**
 * Toma hablada (H) que Omni no genero: el error con lo que paso y que hacer,
 * con la misma forma que el de un bloque R. Servidor -> no cambies nada,
 * espera y vuelve a correr (los intentos fallidos no cobran). Contenido ->
 * reescribe el copy de ESA toma (linea, lineas o dialogo, y prompt_video),
 * con su misma funcion y su mismo largo, y rehazla. Sin respaldo: Kling no
 * genera el dialogo.
 */
function errorTomaH(trabajo, errores, modelo, ctx) {
  const motivo = [...errores].reverse().find((e) => e?.failCode || e?.failMsg) || errores[errores.length - 1] || new Error('(sin detalle)');
  const clase = clasificarFalloR(motivo);
  const carpetaArg = ctx.carpetaArg;
  const vecesFallo = `${errores.length} ${errores.length === 1 ? 'vez' : 'veces'}`;
  const volverACorrer = (s) => `${s}    npm run videos -- ${carpetaArg} --tomas ${trabajo.n}`;
  // `s` = sangria de las lineas de texto; los comandos van 4 espacios mas adentro.
  const reescribir = (s) =>
    [
      `${s}reescribe solo el copy de esta toma (linea, "lineas" o "dialogo" si los tiene, y prompt_video),`,
      `${s}manteniendo su funcion y su largo, y aplicalo con:`,
      `${s}    node produccion/rehacer-toma.js ${carpetaArg} --toma ${trabajo.n} --contexto`,
      `${s}    node produccion/rehacer-toma.js ${carpetaArg} --toma ${trabajo.n} --aplicar nuevos.json`,
    ].join('\n');

  let titulo;
  let queHacer;
  if (clase === 'servidor') {
    titulo = `${trabajo.descripcion}: ${modelo} fallo ${vecesFallo} por un error del servidor.`;
    queHacer =
      '  Error del servidor de Omni, no es un rechazo de contenido: no cambies nada; espera unos\n' +
      '  minutos y vuelve a correr:\n' +
      `${volverACorrer('  ')}\n` +
      '  SIN --rehacer: asi solo se genera lo que falta y lo ya generado no se vuelve a pagar.\n' +
      '  Los intentos fallidos no cobran.';
  } else if (clase === 'contenido') {
    titulo = `${trabajo.descripcion}: ${modelo} la rechazo por contenido (no se reintento: el mismo prompt falla igual).`;
    queHacer =
      '  Es un rechazo por politicas de contenido (pasa sobre todo con temas de salud). Mira en el\n' +
      '  failMsg que palabra o promesa lo disparo, cambiala y\n' +
      reescribir('  ');
  } else {
    titulo = `${trabajo.descripcion}: ${modelo} fallo ${vecesFallo}.`;
    queHacer =
      '  No se reconoce si es un error del servidor o un rechazo de contenido: lee el failMsg.\n' +
      '  a) Si es del servidor (caida, timeout, sobrecarga): no cambies nada; espera unos\n' +
      '     minutos y vuelve a correr, SIN --rehacer (los intentos fallidos no cobran):\n' +
      `${volverACorrer('     ')}\n` +
      '  b) Si es de contenido (politicas): cambia la palabra o promesa que lo disparo,\n' +
      reescribir('     ');
  }

  const err = new Error(
    `${titulo}\n` +
      `  failCode: ${motivo.failCode ?? '(no vino)'}\n` +
      `  failMsg:  ${motivo.failMsg ?? motivo.message}\n\n` +
      '  En las tomas habladas no hay modelo de respaldo (Kling no genera el dialogo), asi que\n' +
      '  aqui se para.\n\n' +
      queHacer
  );
  err.trabajo = trabajo;
  err.failCode = motivo.failCode;
  err.failMsg = motivo.failMsg;
  err.claseFallo = clase;
  return err;
}

/**
 * De que es un fallo de Omni en un bloque R, por su failCode / failMsg (o el
 * mensaje, si la tarea ni se creo):
 *
 *   'contenido'    rechazo por politicas (policy, safety, sensitive, prohibited,
 *                  violation, blocked, moderation...). Reintentar el mismo prompt
 *                  no sirve: se reescribe el copy de ESE bloque.
 *   'servidor'     el servicio fallo (500/502/503/504, internal error, try again
 *                  later, timeout, server, overloaded, busy). No se cambia nada:
 *                  se espera y se vuelve a correr. No cobra.
 *   'desconocido'  ninguna de las dos.
 *
 * La lectura vive en kie-client.js (clasificarFallo, desde el 2026-10-24: la
 * usan tambien las imagenes y el resto de los videos), con la misma logica que
 * tenia aqui. Esta queda como envoltura para no romper a quien la importe, con
 * sus mismas respuestas: 'desconocido' donde clasificarFallo dice 'otro'.
 */
export function clasificarFalloR(e) {
  const clase = clasificarFallo(e);
  return clase === 'otro' ? 'desconocido' : clase;
}

/**
 * Un bloque UGC tipo R (toma o gancho): solo referencias, cero frames, y SIN
 * cascada. Por el mismo camino va una toma H de la entrevista por
 * ingredientes (trabajo.porIngredientes, tipo 'H'): sus ingredientes son las
 * referencias, en orden, y la imagen del clip va primero. Lo que cambia en H:
 * el log dice 'H' (con porIngredientes), el numero de "Duracion:" del prompt
 * se ajusta como en cualquier toma H (ajustarDuracionEnPrompt), lo que salio
 * del clip anterior va a historial/ (sacarDerivadosDeTomaH) y, si falla, el
 * error es el de una toma hablada (errorTomaH). Un bloque R sale igual que antes.
 *
 * Las referencias se suben en el orden de la toma (es el "Imagen 1, Imagen 2"
 * del prompt) y van a flash-1-1 como image_urls. No hay modelo de respaldo
 * (decision de Diego, 2026-10-04): Kling (3.0 entonces, 4.0 desde el 2026-10-24)
 * usa las imagenes como frames, no genera el dialogo y pronuncia mal.
 *
 * Si flash falla, se mira de que es (clasificarFalloR):
 *   - contenido: se para en ese intento (el mismo prompt falla igual) y se dice
 *     que hay que reescribir el copy de ESE bloque.
 *   - servidor: se reintenta hasta REINTENTOS veces, esperando
 *     ESPERAS_SERVIDOR_MS entre intentos; si sigue, se para y se dice que no
 *     hay que cambiar nada, solo volver a correr mas tarde.
 *   - desconocido: los reintentos de siempre y, al final, las dos salidas.
 *   - sigue en kie (esSigueEnKie: se llego al tope de espera): no se reintenta;
 *     falla con errorSigueEnKie y la misma tarea se retoma al volver a correr.
 *   - termino y no se pudo bajar (esPagadaSinBajar): tampoco; ya se cobro.
 *
 * Cada pedido lleva su huella (huellaDeVideo, con el contenido de las
 * referencias en su orden), y pasado TIMEOUT_VIDEO_MS solo se avisa.
 *
 * El prompt va tal cual, sin ajustarDuracionEnPrompt(): el validador ya exige
 * que "Duracion: Ns." coincida con la duracion, y la duracion ya es una de las
 * que acepta el modelo. En R el motor no toca el prompt en absoluto. (En una
 * toma H por ingredientes si, como en cualquier toma H: ahi esa linea del
 * prompt es opcional y el validador solo avisa si no coincide.)
 */
export async function generarBloqueR(trabajo, ctx, log) {
  const destino = path.join(ctx.dirVideo, trabajo.archivo);
  const modelo = MODELO_VIDEO_UGC;
  const { resolucion, duracion, excedeTope } = creditosClip(modelo, trabajo.segundos, RESOLUCION_VIDEO);
  if (excedeTope || duracion !== trabajo.segundos) {
    throw new Error(`${trabajo.descripcion}: ${modelo} solo genera bloques de 4, 6, 8 o 10 s. Corrige "duracion" en el manifiesto.`);
  }

  // Se suben ANTES de archivar el clip anterior: si una subida falla, el clip
  // viejo se queda donde estaba. Las URLs quedan cacheadas para los demas.
  const urls = [];
  for (const r of trabajo.rutasReferencias) urls.push(await subirArchivo(r.ruta));

  const archivado = archivarSiExiste(destino, ctx.carpeta);
  if (archivado) console.log(`      (el clip anterior se guardo en historial/${path.basename(archivado)})`);
  // El recorte de cola (toma-N.cola.json, lo escribe cortar-cola-ugc.js) se
  // midio sobre el clip ANTERIOR: con un clip nuevo ya no vale. Se archiva
  // tambien, para que el montaje no corte el clip nuevo con la medida vieja.
  if (trabajo.clase === 'toma') {
    const cola = archivarSiExiste(path.join(ctx.carpeta, `toma-${trabajo.n}.cola.json`), ctx.carpeta);
    if (cola) console.log(`      (su recorte de cola se guardo en historial/${path.basename(cola)}: hay que volver a medirlo)`);
  }
  // Toma hablada por ingredientes: el original de la voz y el host recortado
  // salieron del clip anterior.
  const esH = trabajo.tipo === 'H';
  if (esH && trabajo.clase === 'toma') avisarDerivadosSacados(sacarDerivadosDeTomaH(ctx.carpeta, trabajo.n), trabajo.n, ctx.carpetaArg);
  // En H el numero de "Duracion:" del prompt se ajusta como en cualquier toma
  // hablada (no-op si ya coincide); en R el prompt va tal cual.
  const ajuste = esH ? ajustarDuracionEnPrompt(trabajo.prompt, duracion) : { prompt: trabajo.prompt, cambiado: false };
  if (ajuste.cambiado) {
    console.log(`      (${trabajo.descripcion}: el prompt decia "Duracion: ${ajuste.antes}s" y el clip se pide de ${ajuste.despues}s; se ajusta el numero dentro del prompt para que no se contradigan)`);
  }

  const fallos = [];
  for (let intento = 1; intento <= REINTENTOS; intento++) {
    try {
      // El fotograma de un lugar se saca en esta corrida: su contenido se lee aqui.
      const huella = huellaDeVideo({
        modelo,
        prompt: ajuste.prompt,
        aspecto: ctx.aspectRatio,
        resolucion: resolucion.api,
        duracion,
        archivos: trabajo.rutasReferencias.map((r) => r.ruta),
      });
      const r = await generarVideo({
        modelo,
        prompt: ajuste.prompt,
        frameInicial: null,
        frameFinal: null,
        imagenesReferencia: urls,
        aspectRatio: ctx.aspectRatio,
        resolucionApi: resolucion.api,
        duracion,
        rutaDestino: destino,
        // Pasado este tiempo solo se avisa: se sigue esperando el mismo pedido.
        timeoutMs: TIMEOUT_VIDEO_MS,
        alAvisar: avisoSigueGenerando(trabajo),
        huella,
      });

      log.push({
        id: trabajo.id,
        archivo: trabajo.archivo,
        modelo: r.modeloReal,
        respaldo: false,
        intentos: intento,
        // 'R' en los bloques (como siempre); 'H' en una toma hablada por ingredientes.
        tipo: esH ? 'H' : 'R',
        ...(esH ? { porIngredientes: true } : {}),
        segundosUtiles: trabajo.segundos,
        segundosPedidos: duracion,
        resolucion: resolucion.nombre,
        frameFinal: false,
        referencias: trabajo.referencias,
        creditos: r.creditos,
        taskId: r.taskId,
      });

      console.log(`  OK  ${trabajo.descripcion} -> ${duracion}s [${esH ? 'ingredientes' : 'refs'}: ${trabajo.referencias.join(', ')}] — ${r.creditos ?? '?'} cr`);
      return { ruta: r.ruta };
    } catch (e) {
      // Sigue en kie, o termino y no se pudo bajar: otro intento crearia otra tarea igual.
      if (esSigueEnKie(e)) throw errorSigueEnKie(trabajo, e, ctx);
      if (esPagadaSinBajar(e)) throw errorPagadaSinBajar(trabajo, e, ctx);
      fallos.push(e);
      const clase = clasificarFalloR(e);
      const quedan = REINTENTOS - intento;
      if (clase === 'contenido') {
        // El mismo prompt va a fallar igual: no se gastan los otros intentos.
        console.log(`  ..  ${trabajo.descripcion}: intento ${intento}/${REINTENTOS} rechazado por contenido (${e.message.slice(0, 130)}) — no se reintenta`);
        break;
      }
      const espera = clase === 'servidor' ? ESPERAS_SERVIDOR_MS[Math.min(intento - 1, ESPERAS_SERVIDOR_MS.length - 1)] : 3000 * intento;
      const siguiente = !quedan ? '' : clase === 'servidor' ? ` — error del servidor, reintento en ${Math.round(espera / 1000)} s` : ' — reintento';
      console.log(`  ..  ${trabajo.descripcion}: intento ${intento}/${REINTENTOS} fallo (${e.message.slice(0, 130)})${siguiente}`);
      if (quedan) await new Promise((r) => setTimeout(r, espera));
    }
  }

  // Toma hablada por ingredientes: que paso y que hacer, como en cualquier
  // toma H (se rehace con rehacer-toma.js, no con la forma corta de los R).
  if (esH) throw errorTomaH(trabajo, fallos, modelo, ctx);

  // El motivo que dio kie. Si algun intento trajo failCode/failMsg (la tarea
  // se creo y el modelo la rechazo), ese es el que importa.
  const motivo = [...fallos].reverse().find((e) => e.failCode || e.failMsg) || fallos[fallos.length - 1];
  const clase = clasificarFalloR(motivo);
  const esGancho = trabajo.clase === 'gancho';
  const carpetaArg = ctx.carpetaArg;
  const volverACorrer = (s) => `${s}    npm run videos -- ${carpetaArg}${esGancho ? ' --ganchos' : ''}`;
  // `s` = sangria de las lineas de texto; el comando va 4 espacios mas adentro.
  const reescribir = (s) =>
    (esGancho
      ? [
          `${s}reescribe solo el copy de este gancho en "ganchos_alternativos" (linea, tramos y`,
          `${s}prompt_video), manteniendo su funcion y su largo, y vuelve a correr:`,
          `${s}    npm run videos -- ${carpetaArg} --ganchos`,
        ]
      : [
          `${s}reescribe solo el copy de este bloque (linea, tramos y prompt_video en el manifiesto),`,
          `${s}manteniendo su funcion y su largo, y vuelve a correr:`,
          `${s}    npm run rehacer -- ${carpetaArg} ${trabajo.n}`,
        ]
    ).join('\n');
  const vecesFallo = `${fallos.length} ${fallos.length === 1 ? 'vez' : 'veces'}`;

  let titulo;
  let queHacer;
  if (clase === 'servidor') {
    titulo = `${trabajo.descripcion}: ${modelo} fallo ${vecesFallo} por un error del servidor.`;
    queHacer =
      '  Error del servidor de Omni, no es un rechazo de contenido: no cambies nada; espera unos\n' +
      '  minutos y vuelve a correr:\n' +
      `${volverACorrer('  ')}\n` +
      '  SIN --rehacer: asi solo se genera lo que falta y lo ya generado no se vuelve a pagar.\n' +
      '  Los intentos fallidos no cobran.';
  } else if (clase === 'contenido') {
    titulo = `${trabajo.descripcion}: ${modelo} lo rechazo por contenido (no se reintento: el mismo prompt falla igual).`;
    queHacer =
      '  Es un rechazo por politicas de contenido (pasa sobre todo con temas de salud). Mira en el\n' +
      '  failMsg que palabra o promesa lo disparo, cambiala y\n' +
      reescribir('  ');
  } else {
    titulo = `${trabajo.descripcion}: ${modelo} fallo ${vecesFallo}.`;
    queHacer =
      '  No se reconoce si es un error del servidor o un rechazo de contenido: lee el failMsg.\n' +
      '  a) Si es del servidor (caida, timeout, sobrecarga): no cambies nada; espera unos\n' +
      '     minutos y vuelve a correr, SIN --rehacer (los intentos fallidos no cobran):\n' +
      `${volverACorrer('     ')}\n` +
      '  b) Si es de contenido (politicas): cambia la palabra o promesa que lo disparo,\n' +
      reescribir('     ');
  }

  const err = new Error(
    `${titulo}\n` +
      `  failCode: ${motivo.failCode ?? '(no vino)'}\n` +
      `  failMsg:  ${motivo.failMsg ?? motivo.message}\n\n` +
      '  En los bloques UGC no hay modelo de respaldo (Kling no genera el dialogo y pronuncia\n' +
      '  mal), asi que aqui se para.\n\n' +
      queHacer
  );
  err.trabajo = trabajo;
  err.failCode = motivo.failCode;
  err.failMsg = motivo.failMsg;
  err.claseFallo = clase;
  throw err;
}

// ---------------------------------------------------------------- en marcha

/**
 * Los archivos locales que un trabajo necesita para pedirse: sus frames en
 * img/, o sus referencias (bloques R y tomas H por ingredientes) en su orden.
 * Un fotograma de lugar no cuenta: lo saca el motor de su bloque de origen
 * cuando ese bloque esta generado (ver ejecutarR).
 */
export function archivosDeEntrada(t, dirImg) {
  if (Array.isArray(t.rutasReferencias)) return t.rutasReferencias.filter((r) => r.como !== 'fotograma de lugar').map((r) => r.ruta);
  return [t.imagenInicial, t.imagenFinal].filter(Boolean).map((f) => path.join(dirImg, f));
}

/**
 * --esperar-imagenes: cuantas imagenes hay en img/ y la fecha de la mas nueva.
 * Si cambia, el proceso de imagenes sigue vivo. Una imagen a medio bajar es
 * "<imagen>.parcial" y no cuenta (kie-client la renombra al terminar). Su
 * "<imagen>.kie-pendiente.json" si cuenta: aparece cuando se pide la imagen y
 * se va cuando termina, asi que una imagen que tarda en kie no parece un
 * proceso muerto.
 */
function firmaDeImagenes(dirImg) {
  let nombres;
  try {
    nombres = fs.readdirSync(dirImg);
  } catch {
    return '0|0';
  }
  let n = 0;
  let ultima = 0;
  for (const f of nombres) {
    if (f.startsWith('.') || !/\.(png|jpe?g|webp)(\.kie-pendiente\.json)?$/i.test(f)) continue;
    try {
      ultima = Math.max(ultima, fs.statSync(path.join(dirImg, f)).mtimeMs);
      n++;
    } catch {
      // se movio mientras se miraba: cuenta en la proxima vuelta
    }
  }
  return `${n}|${ultima}`;
}

/**
 * Lanza los trabajos con hasta `limite` en marcha a la vez: cuando uno termina
 * entra el siguiente (antes iban en tandas cerradas de CONCURRENCIA_VIDEO que
 * esperaban al mas lento). Entre los que pueden arrancar va primero el que
 * esta antes en `trabajos`. Un trabajo arranca cuando:
 *
 *   - existen sus archivos de entrada (archivosDeEntrada). Sin
 *     ctx.esperarImagenes el CLI ya exigio que esten; con el, se mira cada
 *     REVISAR_IMAGENES_MS (los va dejando el proceso de imagenes);
 *   - listo(t) devuelve true (bloques R: sus bloques de origen ya estan).
 *     false = todavia no; un texto = el motivo por el que ya no se puede;
 *   - preparar(t), justo antes de lanzarlo, no devuelve un motivo (bloques R:
 *     sacar el fotograma de su lugar).
 *
 * correr(t) es el pedido; alTerminar(t, error) se llama cuando termina (error
 * null si salio bien) y omitir(t, motivo, { porImagen }) por cada trabajo que
 * no se llega a lanzar. Ningun fallo frena a los demas.
 *
 * --esperar-imagenes: a un trabajo que le falta un archivo se lo omite si ya
 * esta <carpeta>/.imagenes-fin.json (las imagenes terminaron sin el) o si pasa
 * ESPERA_SIN_IMAGENES_MS sin ninguna novedad en img/ (firmaDeImagenes) ni ese aviso.
 */
export async function enMarcha(
  trabajos,
  ctx,
  { correr, alTerminar, omitir, listo = () => true, preparar = () => null, limite = CONCURRENCIA_VIDEO }
) {
  const espera = ctx.esperarImagenes || null;
  const sinNovedadMs = espera?.sinNovedadMs ?? ESPERA_SIN_IMAGENES_MS;
  const revisarMs = espera?.revisarMs ?? REVISAR_IMAGENES_MS;
  const pendientes = [...trabajos];
  const enCurso = new Set();
  const esperaron = new Set(); // los que no tenian sus imagenes la primera vez que se miro
  let firma = espera ? firmaDeImagenes(ctx.dirImg) : null;
  let ultimaNovedad = Date.now();
  let despertar = null;
  const rel = (r) => (r ? path.relative(ctx.carpeta, r).replace(/\\/g, '/') : '(sin archivo)');

  while (pendientes.length || enCurso.size) {
    // El aviso de fin se mira ANTES que los archivos: si aparece entre las dos
    // miradas, la ultima imagen ya estaba escrita y se ve igual.
    const terminaron = espera ? fs.existsSync(espera.rutaFin) : false;
    if (espera) {
      const ahora = firmaDeImagenes(ctx.dirImg);
      if (ahora !== firma) {
        firma = ahora;
        ultimaNovedad = Date.now();
      }
    }
    const sinNovedad = Boolean(espera) && Date.now() - ultimaNovedad >= sinNovedadMs;
    let cambio = false; // se omitio alguno: puede destrabar (u omitir) a otros
    let esperanImagenes = false;

    for (let i = 0; i < pendientes.length; ) {
      const t = pendientes[i];
      const sacar = (motivo, extra = {}) => {
        pendientes.splice(i, 1);
        omitir(t, motivo, extra);
        cambio = true;
      };
      const dep = listo(t);
      if (typeof dep === 'string') {
        sacar(dep);
        continue;
      }
      const faltan = archivosDeEntrada(t, ctx.dirImg).filter((r) => !r || !fs.existsSync(r));
      if (faltan.length) {
        const cuales = faltan.map(rel).join(', ');
        if (!espera) sacar(`falta ${cuales}.`, { porImagen: true });
        else if (terminaron) sacar(`su imagen no se genero (${cuales}): las imagenes terminaron sin ella.`, { porImagen: true });
        else if (sinNovedad) {
          sacar(
            `su imagen no llego (${cuales}): pasaron ${Math.round(sinNovedadMs / 60000)} min sin ninguna novedad del proceso de ` +
              'imagenes (ni una imagen ni un pedido nuevo) ni el aviso de que terminaron.',
            { porImagen: true }
          );
        } else {
          esperaron.add(t);
          esperanImagenes = true;
          i++;
        }
        continue;
      }
      if (dep !== true || enCurso.size >= limite) {
        i++;
        continue;
      }
      const motivo = preparar(t);
      if (motivo) {
        sacar(motivo);
        continue;
      }
      pendientes.splice(i, 1);
      if (esperaron.has(t)) console.log(`  ..  ${t.descripcion}: ya estan sus imagenes, se pide`);
      const p = Promise.resolve()
        .then(() => correr(t))
        .then(
          () => alTerminar(t, null),
          (e) => alTerminar(t, e ?? new Error(`${t.descripcion}: fallo sin detalle`))
        )
        // alTerminar no deberia fallar; si falla, que no tumbe a los demas.
        .catch((e) => console.error(`  !  ${t.descripcion}: ${e?.message ?? e}`))
        .finally(() => {
          enCurso.delete(p);
          despertar?.();
        });
      enCurso.add(p);
    }

    if (cambio) continue;
    if (!pendientes.length && !enCurso.size) break;
    if (!enCurso.size && !esperanImagenes) {
      // Nada en marcha ni imagenes que esperar, y quedan trabajos: esperan a un
      // bloque que no se va a generar (el validador descarta los ciclos; esto es una red).
      for (const t of pendientes.splice(0)) omitir(t, 'espera a un bloque que no se va a generar en esta corrida.', {});
      break;
    }
    // Hasta que termine alguno o, si hay trabajos esperando sus imagenes, un rato.
    await new Promise((resolve) => {
      const reloj = esperanImagenes ? setTimeout(resolve, revisarMs) : null;
      despertar = () => {
        if (reloj) clearTimeout(reloj);
        resolve();
      };
    });
    despertar = null;
  }
}

/**
 * Los clips terminan en cualquier orden (el que tarda menos llega antes): el
 * log de la corrida se deja en el orden del plan.
 */
function ordenarComoElPlan(log, trabajos) {
  const pos = new Map(trabajos.map((t, i) => [t.archivo, i]));
  const enOrden = [...log].sort((a, b) => (pos.get(a.archivo) ?? Number.MAX_SAFE_INTEGER) - (pos.get(b.archivo) ?? Number.MAX_SAFE_INTEGER));
  log.splice(0, log.length, ...enOrden);
}

/**
 * Al final de una corrida: si algo fallo o no se genero, un solo error con
 * todo, en el orden del plan. Un unico fallo sale tal cual (ya dice que hacer).
 */
function lanzarSiHuboFallos(fallidos, omitidos, ctx, trabajos) {
  if (!fallidos.length && !omitidos.length) return;
  if (fallidos.length === 1 && !omitidos.length) throw fallidos[0].error;
  const pos = new Map(trabajos.map((t, i) => [t, i]));
  const enOrden = (a, b) => (pos.get(a.trabajo) ?? 0) - (pos.get(b.trabajo) ?? 0);
  fallidos.sort(enOrden);
  omitidos.sort(enOrden);

  const L = [];
  // Un clip que sigue en kie no fallo: se cuenta aparte.
  const siguen = fallidos.filter((f) => f.error?.claseFallo === 'sigue-en-kie');
  const nFallos = fallidos.length - siguen.length;
  const partes = [];
  if (nFallos) partes.push(`${nFallos} ${nFallos === 1 ? 'clip fallo' : 'clips fallaron'}`);
  if (siguen.length) partes.push(`${siguen.length} ${siguen.length === 1 ? 'sigue' : 'siguen'} en kie`);
  if (omitidos.length) partes.push(`${omitidos.length} no se ${omitidos.length === 1 ? 'genero' : 'generaron'}`);
  L.push(`${partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}` : partes[0]}.`);
  // Cada mensaje ya empieza con el nombre de su clip. Los que siguen en kie
  // van juntos, con una sola explicacion (la de errorSigueEnKie).
  for (const f of fallidos) {
    if (siguen.length > 1 && siguen.includes(f)) continue;
    L.push('', `  ${f.error?.message ?? String(f.error)}`);
  }
  if (siguen.length > 1) {
    L.push('', `  ${siguen.length} clips siguen en kie y se dejo de esperarlos:`);
    for (const f of siguen) L.push(`    ${f.trabajo.descripcion}: tarea ${f.error.taskId ?? '(sin taskId)'}`);
    L.push(
      '  No se pidio otro ni se paso al modelo de respaldo: si el primero termina, se pagarian los dos.',
      '  Volviendo a correr el mismo comando, SIN --rehacer, se retoman esas mismas tareas y se descargan',
      '  apenas esten listas (lo ya generado no se vuelve a pagar):',
      `      ${comandoVideos(ctx, { ganchos: siguen.some((f) => f.trabajo.clase === 'gancho') })}`
    );
    const motivo = siguen[0].error.message.match(/\n {2}Motivo: (.*)/)?.[1];
    if (motivo) L.push(`  (motivo del primero: ${motivo})`);
  }
  if (omitidos.length) {
    L.push('', '  No se generaron:');
    for (const o of omitidos) L.push(`    ${o.trabajo.descripcion}: ${o.motivo}`);
    const porImagen = omitidos.some((o) => o.porImagen);
    const porOrigen = omitidos.some((o) => !o.porImagen);
    if (!porImagen) L.push('  Cuando su bloque de origen este bien, se generan con lo que falta (sin --rehacer):');
    else {
      L.push(
        `  Genera primero sus imagenes (npm run imagenes -- ${ctx.carpetaArg})` +
          `${porOrigen ? ' y, cuando su bloque de origen este bien,' : '; despues'} se generan con lo que falta (sin --rehacer):`
      );
    }
    L.push(`      ${comandoVideos(ctx, { ganchos: omitidos.some((o) => o.trabajo.clase === 'gancho') })}`);
  }
  const err = new Error(L.join('\n'));
  err.fallidos = fallidos;
  err.omitidos = omitidos;
  throw err;
}

/**
 * Bloques R: cada uno arranca apenas existen sus referencias y, si vuelve a un
 * lugar, apenas su bloque de origen (t.dependeDe, ver ordenarPorLugares) esta
 * generado, con hasta CONCURRENCIA_VIDEO en marcha (enMarcha). Antes iban por
 * pasadas enteras: un bloque esperaba a toda la pasada anterior. Entre los que
 * pueden arrancar van primero los de las primeras pasadas (los de origen).
 *
 * Antes de lanzar un trabajo se dejan listos sus fotogramas de lugar (se sacan
 * del clip de origen con ffmpeg si no estan). Cuando un bloque que es origen de
 * un lugar se genera en esta corrida, el fotograma anterior (si habia) va a
 * historial/ y se vuelve a sacar del clip nuevo; eso pasa antes de que arranque
 * cualquiera que lo use, porque todos esperan a ese bloque.
 *
 * Un fallo NO corta la corrida: se termina lo que no depende de el y al final
 * se informa todo junto. Un trabajo cuyo bloque de origen fallo no se genera,
 * y se dice por que. Recibe el plan (o sus pasadas, como antes); el log queda
 * en el orden del plan.
 */
export async function ejecutarR(plan, ctx, log) {
  const trabajos = plan.some(Array.isArray) ? plan.flat() : [...plan];
  const fallidos = []; // { trabajo, error }
  const omitidos = []; // { trabajo, motivo, porImagen }
  const generadas = new Set(); // n de las tomas generadas en esta corrida
  const caidas = new Map(); // n de toma -> por que no esta (para explicar a las que dependian)
  const lugares = ctx.lugares || [];
  const pos = new Map(trabajos.map((t, i) => [t, i]));
  const porPrioridad = [...trabajos].sort((a, b) => (a.pasada ?? 1) - (b.pasada ?? 1) || pos.get(a) - pos.get(b));

  try {
    await enMarcha(porPrioridad, ctx, {
      listo: (t) => {
        const deps = t.dependeDe || [];
        const caida = deps.find((n) => caidas.has(n));
        if (caida !== undefined) return `necesita el fotograma del bloque ${caida}, y el bloque ${caida} ${caidas.get(caida)}.`;
        return deps.every((n) => generadas.has(n));
      },
      preparar: (t) => {
        try {
          for (const r of t.rutasReferencias || []) {
            if (r.como !== 'fotograma de lugar' || fs.existsSync(r.ruta)) continue;
            const clip = path.join(ctx.dirVideo, `toma-${r.deToma}.mp4`);
            if (!fs.existsSync(clip)) throw new Error(`necesita el fotograma del bloque ${r.deToma} y no esta video/toma-${r.deToma}.mp4.`);
            const s = sacarFotograma(clip, r.segundo, r.ruta);
            console.log(`      (lugar "${r.id}": fotograma del bloque ${r.deToma} en el segundo ${s.segundo} -> img/${path.basename(r.ruta)})`);
          }
          return null;
        } catch (e) {
          if (t.clase === 'toma') caidas.set(t.n, 'no se genero');
          return e.message;
        }
      },
      correr: (t) => generarBloqueR(t, ctx, log),
      alTerminar: (t, error) => {
        if (error) {
          fallidos.push({ trabajo: t, error });
          const clase = error?.claseFallo;
          if (t.clase === 'toma') {
            caidas.set(
              t.n,
              clase === 'servidor'
                ? 'fallo por un error del servidor'
                : clase === 'contenido'
                  ? 'fue rechazado por contenido'
                  : clase === 'sigue-en-kie'
                    ? 'sigue generando en kie (se retoma al volver a correr)'
                    : clase === 'pagada-sin-bajar'
                      ? 'termino en kie y no se pudo bajar'
                      : 'fallo'
            );
          }
          return;
        }
        if (t.clase !== 'toma') return;
        // Clip nuevo de un bloque que es origen de un lugar: su fotograma
        // anterior ya no vale. Se guarda y se vuelve a sacar cuando haga falta.
        // (Antes de marcarlo generado: nadie que lo use arranca hasta entonces.)
        for (const l of lugares.filter((x) => x.deToma === t.n)) {
          try {
            const guardado = archivarSiExiste(l.ruta, ctx.carpeta);
            if (guardado) {
              console.log(`      (el fotograma anterior del lugar "${l.id}" se guardo en historial/${path.basename(guardado)}: se vuelve a sacar del clip nuevo)`);
            }
          } catch (e) {
            // Sin moverlo, el que lo usa tomaria el fotograma viejo: se quita.
            console.log(`  !  no pude guardar en historial/ el fotograma anterior del lugar "${l.id}" (${e.message}); se quita para sacarlo del clip nuevo`);
            fs.rmSync(l.ruta, { force: true });
          }
        }
        generadas.add(t.n);
      },
      omitir: (t, motivo, { porImagen = false } = {}) => {
        omitidos.push({ trabajo: t, motivo, porImagen });
        if (t.clase === 'toma' && !caidas.has(t.n)) {
          caidas.set(t.n, porImagen ? 'no se genero (le falto su imagen)' : 'no se genero (esperaba el fotograma de otro bloque)');
        }
      },
    });
  } finally {
    ordenarComoElPlan(log, trabajos);
  }
  lanzarSiHuboFallos(fallidos, omitidos, ctx, trabajos);
}

/**
 * Todo lo que no es un plan de bloques R: voz en off, dialogo_nativo, tomas H
 * (con frame inicial o por ingredientes), continuidad y el B-roll. Hasta
 * CONCURRENCIA_VIDEO en marcha (enMarcha); un fallo no frena a los demas y al
 * final se dice todo junto, como en ejecutarR. El log queda en el orden del plan.
 */
async function ejecutar(trabajos, ctx, log) {
  const fallidos = [];
  const omitidos = [];
  try {
    await enMarcha(trabajos, ctx, {
      // Bloque R, y toma hablada por ingredientes: su propio camino, sin
      // cascada (image_urls). Todo lo demas, como siempre.
      correr: (t) => (t.tipo === 'R' || t.porIngredientes === true ? generarBloqueR(t, ctx, log) : generarConCascada(t, ctx, log)),
      alTerminar: (t, error) => {
        if (error) fallidos.push({ trabajo: t, error });
      },
      omitir: (t, motivo, { porImagen = false } = {}) => omitidos.push({ trabajo: t, motivo, porImagen }),
    });
  } finally {
    ordenarComoElPlan(log, trabajos);
  }
  lanzarSiHuboFallos(fallidos, omitidos, ctx, trabajos);
}

// ---------------------------------------------------------------- continuidad

/**
 * Continuidad: el log de esta corrida FUSIONADO con el que ya habia, por
 * archivo. Fuera de continuidad el log se pisa en cada corrida; aqui se
 * corre por partes (--pasos, --tomas) y no se puede perder que clip salio del
 * modelo de respaldo: el montaje lo avisa para revisar sus uniones.
 *
 * Se quedan las entradas anteriores de clips de la cadena que siguen en
 * video/ y que esta corrida no rehizo; van en el orden de la cadena.
 */
/**
 * Arma los clips sin cobro: el quieto, desde su imagen con un movimiento suave;
 * el de la biblioteca, copiado tal cual. Cero creditos. Un fallo aqui no frena
 * a los demas: se avisa y ese clip queda por hacer.
 */
export function armarSinCobro(trabajos, manifiesto, { dirImg, dirVideo }) {
  fs.mkdirSync(dirVideo, { recursive: true });
  for (const t of trabajos) {
    const item = itemDeTrabajo(manifiesto, t);
    const destino = path.join(dirVideo, t.archivo);
    try {
      if (modoSinCobro(item) === 'biblioteca') {
        fs.copyFileSync(clipDeBiblioteca(item), destino);
        console.log(`  ==  ${t.descripcion} — de la biblioteca (${item.desde_biblioteca}) — 0 cr`);
      } else {
        const imagen = path.join(dirImg, t.imagenInicial);
        if (!fs.existsSync(imagen)) throw new Error(`falta su imagen img/${t.imagenInicial}`);
        armarClipQuieto(imagen, destino, t.segundos, movimientoQuieto(item), manifiesto.aspect_ratio || '9:16');
        console.log(`  ==  ${t.descripcion} — quieto (${movimientoQuieto(item)}) armado desde su imagen — 0 cr`);
      }
    } catch (e) {
      console.log(`  !!  ${t.descripcion}: no pude armarlo sin cobro (${e.message.slice(0, 160)}). Queda por hacer.`);
    }
  }
}

export function fusionarLogContinuidad(rutaLog, log, cadena, dirVideo) {
  let previos = [];
  try {
    if (fs.existsSync(rutaLog)) previos = JSON.parse(fs.readFileSync(rutaLog, 'utf8')).clips ?? [];
  } catch {
    previos = []; // un log ilegible no frena nada: se escribe con lo de esta corrida
  }
  const orden = new Map(cadena.map((c, i) => [c.archivo, i]));
  const nuevos = new Set(log.map((x) => x.archivo));
  const quedan = (Array.isArray(previos) ? previos : []).filter(
    (x) => x && orden.has(x.archivo) && !nuevos.has(x.archivo) && fs.existsSync(path.join(dirVideo, x.archivo))
  );
  const pos = (x) => orden.get(x.archivo) ?? Number.MAX_SAFE_INTEGER;
  return [...quedan, ...log].sort((a, b) => pos(a) - pos(b));
}

// ---------------------------------------------------------------- CLI

// El cuerpo del CLI va en una funcion para poder salir con "return" despues de
// consultarCreditos(): un process.exit() justo despues de un fetch aborta en
// Windows con Node 24 ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)",
// src/win/async.c, codigo 127) aunque ya se imprimio todo. Sin process.exit el
// proceso cierra solo en menos de un segundo, como ya hace la corrida real con --si.
if (process.argv[1] && process.argv[1].endsWith('generar-videos.js')) await cli();

async function cli() {
  const args = process.argv.slice(2);
  const carpetaArg = args.find((a) => !a.startsWith('--'));
  const sinConfirmar = args.includes('--si');
  const soloPlan = args.includes('--solo-plan');
  const rehacer = args.includes('--rehacer');
  const idxTomas = args.indexOf('--tomas');
  const soloTomas =
    idxTomas !== -1 && args[idxTomas + 1]
      ? args[idxTomas + 1].split(',').map((s) => Number(s.trim())).filter(Number.isInteger)
      : null;
  const sinBroll = args.includes('--sin-broll');
  // Solo esos B-roll, sin ninguna toma (la revision de los clips de la app rehace UN B-roll asi).
  const idxBroll = args.indexOf('--broll');
  const soloBroll =
    idxBroll !== -1 && args[idxBroll + 1] && !args[idxBroll + 1].startsWith('--')
      ? args[idxBroll + 1].split(',').map((s) => Number(s.trim())).filter(Number.isInteger)
      : null;
  // Pide tambien los B-roll que no entran en el video con esta voz (ver abajo).
  const todoElBroll = args.includes('--todo-el-broll');
  // Fuerza la duracion de todos los clips, ignorando la del manifiesto. Sirve
  // para regenerar mas corto cuando la voz real resulto mas rapida que lo
  // estimado por la skill.
  const idxDur = args.indexOf('--duracion');
  const duracionForzada = idxDur !== -1 && args[idxDur + 1] ? Number(args[idxDur + 1]) : null;
  // Suma los ganchos alternativos de un anuncio por bloques (gancho-<id>.mp4).
  const conGanchos = args.includes('--ganchos');
  // Solo con continuidad: esos pasos y nada mas (paso-<K>.mp4).
  const idxPasos = args.indexOf('--pasos');
  const soloPasos =
    idxPasos !== -1 && args[idxPasos + 1] && !args[idxPasos + 1].startsWith('--')
      ? args[idxPasos + 1].split(',').map((s) => Number(s.trim())).filter(Number.isInteger)
      : null;
  // Solo para npm run producir: las imagenes se generan al mismo tiempo, en
  // otro proceso, y cada clip se pide apenas estan las suyas (ver enMarcha).
  const esperarImagenes = args.includes('--esperar-imagenes');

  if (!carpetaArg) {
    console.error('\n  Uso: node produccion/generar-videos.js <carpeta-del-anuncio> [--tomas 1,10] [--solo-plan] [--si]');
    console.error('       (--esperar-imagenes --si: solo para npm run producir, que genera las imagenes al mismo tiempo)\n');
    process.exit(1);
  }

  // Sin --si se preguntaria antes de pagar, y con las imagenes generandose en
  // otro proceso no hay a quien preguntarle: producir ya mostro el costo.
  if (esperarImagenes && !sinConfirmar) {
    console.error('\n  --esperar-imagenes es para npm run producir, que genera las imagenes y los videos al mismo');
    console.error('  tiempo: va siempre con --si. Para generar solo los videos, con las imagenes ya hechas:');
    console.error(`      npm run videos -- ${carpetaArg}\n`);
    process.exit(1);
  }

  const carpeta = path.resolve(carpetaArg);
  const rutaManifiesto = path.join(carpeta, 'manifiesto.json');
  if (!fs.existsSync(rutaManifiesto)) {
    console.error(`\n  No encuentro el manifiesto: ${rutaManifiesto}\n`);
    process.exit(1);
  }

  cargarEnv();
  requerirClave('KIE_API_KEY', 'copiala desde https://kie.ai/api-key');

  const manifiesto = JSON.parse(fs.readFileSync(rutaManifiesto, 'utf8'));
  const conContinuidad = tieneContinuidad(manifiesto);

  if (idxBroll !== -1) {
    const otros = [idxTomas !== -1 && '--tomas', idxPasos !== -1 && '--pasos', conGanchos && '--ganchos', sinBroll && '--sin-broll'].filter(Boolean);
    if (!soloBroll || !soloBroll.length) {
      console.error('\n  --broll necesita los numeros de los B-roll, separados por coma:');
      console.error(`      npm run videos -- ${carpetaArg} --broll 9\n`);
      process.exit(1);
    }
    if (otros.length) {
      console.error(`\n  --broll va solo: no se combina con ${otros.join(', ')}.\n`);
      process.exit(1);
    }
    if (conContinuidad) {
      console.error('\n  Con continuidad no hay B-roll (la cadena va sin el): --broll no aplica.\n');
      process.exit(1);
    }
    const hay = new Set((manifiesto.broll || []).map((b) => b?.n));
    const noEstan = soloBroll.filter((n) => !hay.has(n));
    if (noEstan.length) {
      console.error(`\n  --broll ${soloBroll.join(',')}: el manifiesto no tiene ${noEstan.length === 1 ? 'el B-roll' : 'los B-roll'} ${noEstan.join(', ')}.`);
      console.error(`  B-roll de este anuncio: ${[...hay].join(', ') || '(ninguno)'}\n`);
      process.exit(1);
    }
  }

  if (idxPasos !== -1) {
    if (!conContinuidad) {
      console.error('\n  --pasos es solo para anuncios con continuidad (el bloque "continuidad" del manifiesto),');
      console.error('  y este no lo tiene. Para pedir solo algunas tomas:');
      console.error(`      npm run videos -- ${carpetaArg} --tomas 1,10\n`);
      process.exit(1);
    }
    if (!soloPasos || !soloPasos.length) {
      console.error('\n  --pasos necesita los numeros de las tomas de las que sale cada paso, separados por coma:');
      console.error(`      npm run videos -- ${carpetaArg} --pasos 19,20\n`);
      process.exit(1);
    }
  }

  // Con continuidad se exigen los pasos escritos, sus prompts y el cierre, y
  // ningun "revisar": true (sin continuidad, exigirPasos no se lee).
  const { errores } = validarManifiesto(manifiesto, { carpeta, exigirPasos: conContinuidad });
  if (errores.length) {
    console.error('\n  El manifiesto tiene errores. No genero nada hasta que se arreglen:\n');
    for (const e of errores) console.error(`  ERROR  ${e}`);
    console.error('');
    process.exit(1);
  }

  const dirImg = path.join(carpeta, 'img');
  const dirVideo = path.join(carpeta, 'video');
  fs.mkdirSync(dirVideo, { recursive: true });

  let plan = construirPlan(manifiesto, { soloTomas, ganchos: conGanchos, soloPasos, soloBroll });
  if (sinBroll) plan = plan.filter((t) => t.clase !== 'broll');

  // B-ROLL QUE NO ENTRA (2026-10-26). En voz en off y musica, con la voz ya
  // hecha (audio/tiempos.json), el B-roll cuya frase es corta no se pide: el
  // montaje no lo usaria (brollQueEntran, la misma regla de planear-montaje).
  // Tampoco con --rehacer: volver a pagar un clip que no se ve no sirve; si se
  // quiere igual (para montarlo a mano), --todo-el-broll. Sin tiempos todavia,
  // o con unos que no son de este guion, se piden todos, como antes.
  const reglaBroll = brollQueEntranEnCarpeta(manifiesto, carpeta);
  const brollEnPlan = plan.filter((t) => t.clase === 'broll');
  let brollNoEntra = [];
  if (reglaBroll.aplica && brollEnPlan.length) {
    const fueraPorN = new Map(reglaBroll.fuera.map((f) => [f.n, f]));
    brollNoEntra = brollEnPlan.filter((t) => fueraPorN.has(t.n)).map((t) => fueraPorN.get(t.n));
    if (!todoElBroll) plan = plan.filter((t) => !(t.clase === 'broll' && fueraPorN.has(t.n)));
  }

  if (conContinuidad) {
    // Cada largo sale de los tiempos reales de la voz (continuidad.pasos y
    // cierre): forzarlo desde afuera descuadra la cadena entera.
    if (idxDur !== -1) {
      console.error('\n  --duracion no se usa con continuidad.');
      console.error('  Cada clip se pide con el largo que dice el manifiesto (continuidad.pasos[].duracion,');
      console.error('  duracion_propio y continuidad.cierre.duracion), calculado desde los tiempos reales');
      console.error('  de la voz. Si la voz cambio, se recalcula:');
      console.error(`      npm run continuidad -- ${carpetaArg} --duraciones\n`);
      process.exit(1);
    }
    const conPaso = new Set(cadenaDeClips(manifiesto).filter((c) => c.rol === 'paso').map((c) => c.deToma));
    const sinPaso = (soloPasos || []).filter((k) => !conPaso.has(k));
    if (sinPaso.length) {
      console.error(`\n  --pasos ${soloPasos.join(',')}: no hay paso que salga de la toma ${sinPaso.join(', ')}.`);
      console.error('  Cada paso se nombra por la toma de la que sale (paso-19 va de la toma 19 a la siguiente);');
      console.error('  la ultima toma no tiene paso (cierra con su propio video).');
      console.error(`  Pasos de este anuncio: ${[...conPaso].join(', ')}\n`);
      process.exit(1);
    }
  }

  // En los bloques R la duracion esta atada a sus tramos, a su guion y al
  // "Duracion: Ns." del prompt: forzarla desde afuera los descuadra a todos.
  if (duracionForzada && plan.some((t) => t.tipo === 'R')) {
    console.error('\n  --duracion no se usa en los bloques R (UGC por bloques).');
    console.error('  La duracion de cada bloque esta atada a sus tramos y a su guion. Si un bloque');
    console.error('  sale apurado o le sobra tiempo, se corrige en el manifiesto (duracion, tramos y');
    console.error('  prompt_video) y se rehace ese bloque:');
    console.error(`      npm run rehacer -- ${carpetaArg} <N>\n`);
    process.exit(1);
  }
  // Una toma hablada por ingredientes se pide con la duracion exacta (Omni:
  // 4, 6, 8 o 10 s), sin redondear: forzar otra la haria fallar al generar.
  const duracionesOmni = MODELOS_VIDEO[MODELO_VIDEO_UGC].duraciones;
  if (duracionForzada && plan.some((t) => t.porIngredientes) && !duracionesOmni.includes(duracionForzada)) {
    console.error(`\n  --duracion ${duracionForzada}: las tomas habladas por ingredientes solo se piden de ${duracionesOmni.join(', ')} s.`);
    console.error('  Pide una de esas, o corrige "duracion" (y el "Duracion: Ns." del prompt) en el manifiesto.\n');
    process.exit(1);
  }
  if (duracionForzada) for (const t of plan) t.segundos = duracionForzada;

  // Clips sin cobro (clips-sin-cobro.js): los quietos se arman aqui con ffmpeg
  // desde su imagen, y los de la biblioteca se copian. Ninguno va al generador
  // ni entra en el costo. Fuera de continuidad y de los bloques hablados.
  const esSinCobro = (t) => !conContinuidad && (t.clase === 'toma' || t.clase === 'broll') && t.tipo !== 'R' && t.tipo !== 'H' && !t.porIngredientes && modoSinCobro(itemDeTrabajo(manifiesto, t));
  const sinCobro = plan.filter((t) => esSinCobro(t) && (rehacer || !fs.existsSync(path.join(dirVideo, t.archivo))));
  plan = plan.filter((t) => !esSinCobro(t));

  // Sin imagenes no hay video: se avisa antes de cobrar nada.
  const faltantes = [];
  const faltanReferencias = [];
  for (const t of plan) {
    if (t.tipo === 'R') {
      // Bloque R: lo que tiene que existir son sus referencias (la hoja del
      // personaje en img/ y la foto del producto en la carpeta), en su orden.
      t.rutasReferencias = rutasDeReferencias(manifiesto, carpeta, t.referencias);
      for (const r of t.rutasReferencias) {
        // Un lugar repetido no "falta": su fotograma lo saca el motor de su
        // bloque de origen. Eso se resuelve abajo (ordenarPorLugares).
        if (r.como === 'fotograma de lugar') continue;
        if (!r.ruta || !fs.existsSync(r.ruta)) faltanReferencias.push({ trabajo: t, ...r });
      }
      continue;
    }
    if (t.porIngredientes) {
      // Toma hablada por ingredientes: la imagen del clip (img/toma-N-inicial.png)
      // se genera con "imagenes" como siempre; las demas son referencias (la
      // mano con el microfono, la foto del producto), en su orden.
      t.rutasReferencias = rutasDeIngredientes(manifiesto, carpeta, t.n, t.referencias);
      for (const r of t.rutasReferencias) {
        if (r.ruta && fs.existsSync(r.ruta)) continue;
        if (r.como === 'imagen del clip') faltantes.push(t.imagenInicial);
        else faltanReferencias.push({ trabajo: t, ...r });
      }
      continue;
    }
    if (!fs.existsSync(path.join(dirImg, t.imagenInicial))) faltantes.push(t.imagenInicial);
    if (t.imagenFinal && !fs.existsSync(path.join(dirImg, t.imagenFinal))) faltantes.push(t.imagenFinal);
  }
  // Con continuidad cada imagen es la llegada de un clip y la salida del
  // siguiente: se nombra una sola vez.
  if (conContinuidad) faltantes.splice(0, faltantes.length, ...new Set(faltantes));
  // --esperar-imagenes: lo que genera el proceso de imagenes (los frames, la
  // imagen del clip, las hojas de los personajes) no se exige; cada clip lo
  // espera (enMarcha). Una foto aportada no la genera nadie: esa se exige igual.
  let seEsperan = 0;
  if (esperarImagenes) {
    const hojas = faltanReferencias.filter((f) => f.como === 'hoja generada');
    seEsperan = new Set([...faltantes.map((f) => path.join(dirImg, f)), ...hojas.map((f) => f.ruta)]).size;
    faltanReferencias.splice(0, faltanReferencias.length, ...faltanReferencias.filter((f) => f.como !== 'hoja generada'));
    faltantes.length = 0;
  }
  // Como se marca, en el plan, una imagen que todavia no esta.
  const marcaFalta = esperarImagenes ? ', se espera' : ', falta';
  if (faltanReferencias.length) {
    const unicas = [...new Map(faltanReferencias.map((f) => [f.id, f])).values()];
    // (Solo un plan hablado tiene tomas por ingredientes: los bloques R ven el mensaje de siempre.)
    const deQuien = faltanReferencias.some((f) => f.trabajo.porIngredientes) ? 'de las tomas habladas (ingredientes)' : 'de los bloques R';
    console.error(`\n  Faltan ${unicas.length} referencia(s) ${deQuien}:\n`);
    for (const f of unicas) {
      const donde = f.ruta ? path.relative(carpeta, f.ruta).replace(/\\/g, '/') : '(sin archivo)';
      console.error(`      ${f.id.padEnd(16)} ${donde}   (${f.como})`);
    }
    if (unicas.some((f) => f.como === 'hoja generada')) {
      console.error('\n  Las hojas de los personajes se generan con:');
      console.error(`      node produccion/generar-imagenes.js ${carpetaArg}`);
    }
    if (unicas.some((f) => f.como === 'foto aportada')) {
      console.error('\n  La foto del producto se deja lista con:');
      console.error(`      node produccion/preparar-producto.js "<tu-archivo>" ${path.basename(carpeta)}`);
    }
    console.error('');
    // Con --solo-plan no se cobra nada: el plan y su costo se muestran igual.
    // La hoja del personaje recien existe despues de pagarla con "imagenes",
    // y el plan de los bloques se tiene que poder ver antes.
    if (!soloPlan) process.exit(1);
    console.error('  --solo-plan: muestro el plan igual; sin esas referencias no se puede generar.\n');
  }
  if (faltantes.length) {
    console.error(`\n  Faltan ${faltantes.length} imagen(es) en ${dirImg}:\n`);
    for (const f of faltantes.slice(0, 12)) console.error(`      ${f}`);
    if (faltantes.length > 12) console.error(`      ... y ${faltantes.length - 12} mas`);
    console.error('\n  Generalas primero con:');
    // Con --todo-el-broll las imagenes del B-roll que no entra tambien se piden con el mismo flag.
    console.error(`      node produccion/generar-imagenes.js ${carpetaArg}${todoElBroll ? ' --todo-el-broll' : ''}\n`);
    process.exit(1);
  }

  const yaHechos = plan.filter((t) => fs.existsSync(path.join(dirVideo, t.archivo)));
  if (!rehacer && yaHechos.length) plan = plan.filter((t) => !fs.existsSync(path.join(dirVideo, t.archivo)));

  // Bloques R con lugares repetidos: de donde sale cada fotograma y en que
  // pasada va cada bloque. Sin bloques R esto no corre.
  const lugaresPlan = plan.some((t) => t.tipo === 'R') ? ordenarPorLugares(plan, carpeta) : null;
  if (lugaresPlan?.faltan.length) {
    console.error('\n  Hay bloques que vuelven a un lugar cuyo bloque de origen no esta generado ni entra en esta corrida:\n');
    for (const { trabajo, ref } of lugaresPlan.faltan) {
      console.error(`      ${trabajo.descripcion}: usa "${ref.id}", que se saca del bloque ${ref.deToma} (falta video/toma-${ref.deToma}.mp4)`);
    }
    const origenes = [...new Set(lugaresPlan.faltan.map((f) => f.ref.deToma))];
    const pedidas = [...new Set([...(soloTomas || []), ...origenes])].sort((a, b) => a - b);
    console.error('\n  Genera tambien su bloque de origen en la misma corrida (el motor lo genera primero):');
    console.error(`      npm run videos -- ${carpetaArg}${soloTomas ? ` --tomas ${pedidas.join(',')}` : ''}${conGanchos ? ' --ganchos' : ''}\n`);
    if (!soloPlan) process.exit(1);
    console.error('  --solo-plan: muestro el plan igual; asi no se puede generar.\n');
  }

  // Ganchos alternativos que NO entran en esta corrida (no se paso --ganchos).
  // Se avisan siempre, con su costo, para que nadie los olvide ni los pague sin querer.
  const ganchosFuera =
    conGanchos || !Array.isArray(manifiesto.ganchos_alternativos)
      ? []
      : manifiesto.ganchos_alternativos.filter((g) => !soloTomas || soloTomas.includes(g.reemplaza));
  const avisoGanchos = () => {
    if (!ganchosFuera.length) return;
    const cr = ganchosFuera.reduce((s, g) => s + (creditosClip(MODELO_VIDEO_UGC, g.duracion, RESOLUCION_VIDEO).creditos ?? 0), 0);
    const ids = ganchosFuera.map((g) => g.id).join(', ');
    console.log(`  Opcional:   ${ganchosFuera.length} gancho(s) alternativo(s) (${ids}) NO entran en esta corrida:`);
    console.log(`              ${cr} creditos = US$${creditosAUsd(cr).toFixed(2)} mas. Se generan con:`);
    console.log(`                  npm run videos -- ${carpetaArg} --ganchos\n`);
  };

  console.log(`\n=== Generacion de videos — ${path.basename(carpeta)} ===\n`);
  if (conContinuidad) {
    // Que clips de la cadena entran, contando los que ya estan hechos.
    if (soloTomas) {
      const deTomas = construirPlan(manifiesto, { soloTomas }).map((t) => t.archivo.replace('.mp4', ''));
      console.log(`  Limitado a las tomas: ${soloTomas.join(', ')} (los clips que tocan sus imagenes: ${deTomas.join(', ') || 'ninguno'})`);
    }
    if (soloPasos) console.log(`  Limitado a los pasos: ${soloPasos.join(', ')} (${soloPasos.map((k) => `paso-${k}`).join(', ')})`);
    if (soloTomas || soloPasos) console.log('');
  } else if (soloTomas) console.log(`  Limitado a las tomas: ${soloTomas.join(', ')}\n`);
  else if (soloBroll) console.log(`  Limitado ${soloBroll.length === 1 ? 'al B-roll' : 'a los B-roll'} ${soloBroll.join(', ')} (ninguna toma)\n`);

  if (yaHechos.length && !rehacer) {
    console.log(`  Ya generados (no se vuelven a pagar): ${yaHechos.length}\n`);
  }
  // El B-roll que no entra en el video con esta voz: uno por linea, con su porque.
  if (brollNoEntra.length && !todoElBroll) {
    const yaEstan = new Set(brollNoEntra.filter((f) => fs.existsSync(path.join(dirVideo, `broll-${f.n}.mp4`))).map((f) => f.n));
    // Pedido cuando entraba (con otra voz) y con su tarea todavia en kie: esta corrida no la retoma.
    const enKie = new Set(brollNoEntra.filter((f) => fs.existsSync(path.join(dirVideo, `broll-${f.n}.mp4.kie-pendiente.json`))).map((f) => f.n));
    const que = rehacer ? 'no se piden ni se rehacen' : 'no se piden';
    for (const l of lineasBrollQueNoEntra(brollNoEntra, { yaEstan, enKie, que, carpetaArg, comando: 'videos' })) console.log(l);
    console.log('');
  } else if (brollNoEntra.length) {
    console.log(`  --todo-el-broll: se piden tambien ${brollNoEntra.length} B-roll que no entran en el video con esta voz (${brollNoEntra.map((f) => f.n).join(', ')}).\n`);
  } else if (!reglaBroll.aplica && brollEnPlan.length && (reglaBroll.sinTiempos || reglaBroll.tiemposQueNoSirven)) {
    // Voz en off o musica sin unos tiempos que sirvan: no se sabe cual entra.
    console.log(`  B-roll: se piden todos (${brollEnPlan.length}): ${reglaBroll.motivo}. Con la voz hecha se piden solo los que entran en el video.\n`);
  }
  if (seEsperan) {
    console.log(`  --esperar-imagenes (npm run producir): ${seEsperan} imagen(es) todavia no estan; las esta generando`);
    console.log('  el proceso de imagenes. Cada clip se pide apenas esten las suyas.\n');
  }

  // Continuidad: un paso, un propio o un cierre ya hecho con otro largo que el pedido.
  if (conContinuidad) {
    const avisos = avisosDeLargo(manifiesto, dirVideo, { fuera: plan.map((t) => t.archivo), carpetaArg });
    if (avisos.length) console.log(avisos.join('\n'));
  }

  // Los sin cobro: se dicen siempre y se arman ya (los quietos cuya imagen todavia
  // no esta, con --esperar-imagenes, se arman al final, cuando ya esta).
  let sinCobroAlFinal = [];
  if (sinCobro.length) {
    const q = sinCobro.filter((t) => modoSinCobro(itemDeTrabajo(manifiesto, t)) === 'quieto');
    const b = sinCobro.filter((t) => modoSinCobro(itemDeTrabajo(manifiesto, t)) === 'biblioteca');
    console.log(`  Sin cobro: ${sinCobro.length} clip(s)`);
    if (q.length) console.log(`      ${q.length} quieto(s), con movimiento suave desde su imagen: ${q.map((t) => t.archivo).join(', ')}`);
    if (b.length) console.log(`      ${b.length} de la biblioteca de clips: ${b.map((t) => t.archivo).join(', ')}`);
    console.log('');
    if (!soloPlan) {
      const listos = sinCobro.filter((t) => modoSinCobro(itemDeTrabajo(manifiesto, t)) === 'biblioteca' || fs.existsSync(path.join(dirImg, t.imagenInicial)));
      sinCobroAlFinal = sinCobro.filter((t) => !listos.includes(t));
      armarSinCobro(listos, manifiesto, { dirImg, dirVideo });
      if (sinCobroAlFinal.length && !esperarImagenes) {
        for (const t of sinCobroAlFinal) console.log(`  !!  ${t.descripcion}: falta su imagen img/${t.imagenInicial}; se arma cuando este (corre de nuevo "videos").`);
        sinCobroAlFinal = [];
      }
    }
  }
  const armarSinCobroPendientes = async () => {
    if (!sinCobroAlFinal.length) return;
    const limite = Date.now() + 30 * 60 * 1000;
    while (Date.now() < limite && sinCobroAlFinal.some((t) => !fs.existsSync(path.join(dirImg, t.imagenInicial)))) await new Promise((ok) => setTimeout(ok, 3000));
    armarSinCobro(sinCobroAlFinal, manifiesto, { dirImg, dirVideo });
    sinCobroAlFinal = [];
  };

  if (plan.length === 0) {
    await armarSinCobroPendientes();
    console.log('  No hay nada que generar. Todo listo.\n');
    avisoGanchos();
    process.exit(0);
  }

  // Bloques R: que se manda en cada uno, para verlo ANTES de pagar.
  const bloquesR = plan.filter((t) => t.tipo === 'R');
  if (bloquesR.length) {
    console.log('  Bloques UGC (tipo R): solo referencias, sin frames y sin modelo de respaldo.');
    console.log('  Cada uno se manda con estas imagenes, en este orden (Imagen 1, Imagen 2...):\n');
    // Un lugar repetido: de donde sale su fotograma (ver ordenarPorLugares).
    const deDondeSale = (r) => {
      const anterior = r.habiaFotograma ? '; el fotograma anterior va a historial/' : '';
      return {
        'ya-sacado': `fotograma del bloque ${r.deToma} en el segundo ${r.segundo}, ya sacado: se reusa`,
        'se-saca-ahora': `se saca del bloque ${r.deToma} en el segundo ${r.segundo}; su clip ya esta, gratis`,
        'despues-del-origen': `se saca del bloque ${r.deToma} en el segundo ${r.segundo}, cuando el bloque ${r.deToma} este generado${anterior}`,
        'falta-origen': `falta: el bloque ${r.deToma} no esta generado ni entra en esta corrida`,
      }[r.estado];
    };
    const imprimirBloque = (t) => {
      const refs = t.rutasReferencias.map((r, i) =>
        r.como === 'fotograma de lugar'
          ? `${i + 1}) ${r.id} (${path.relative(carpeta, r.ruta).replace(/\\/g, '/')}, ${deDondeSale(r)})`
          : `${i + 1}) ${r.id} (${r.ruta ? path.relative(carpeta, r.ruta).replace(/\\/g, '/') : 'sin archivo'}` +
            `${r.ruta && fs.existsSync(r.ruta) ? '' : marcaFalta})`
      );
      console.log(`      ${t.archivo.padEnd(18)} ${t.descripcion}`);
      console.log(`      ${''.padEnd(18)} ${refs.join('  ')}`);
    };
    const pasadas = lugaresPlan.pasadas;
    if (pasadas.length > 1) {
      // Sin lugares que esperar, una sola lista como siempre. Con ellos, en el
      // orden en que se van a generar.
      for (const [i, pasada] of pasadas.entries()) {
        const origenes = [...new Set(pasada.flatMap((t) => t.dependeDe))].sort((a, b) => a - b);
        console.log(
          i === 0
            ? '    Pasada 1 (sus referencias ya existen):'
            : `    Pasada ${i + 1} (vuelven a un lugar: se generan cuando ya esta${origenes.length > 1 ? 'n' : ''} ` +
                `${origenes.length > 1 ? 'los bloques' : 'el bloque'} ${origenes.join(', ')}):`
        );
        for (const t of pasada) imprimirBloque(t);
      }
    } else {
      for (const t of bloquesR) imprimirBloque(t);
    }
    console.log('');

    // Un bloque que es origen de un lugar se regenera, y hay clips YA hechos
    // con su fotograma viejo que no entran en esta corrida: quedan con el
    // lugar anterior. Se avisa; no se regeneran solos.
    const enPlan = new Set(plan.map((t) => t.archivo));
    for (const l of listaDeReferencias(manifiesto).filter(esLugarDeToma)) {
      if (!plan.some((t) => t.clase === 'toma' && t.n === l.de_toma)) continue;
      const usan = [
        ...manifiesto.tomas.map((t) => ({ uso: t, archivo: `toma-${t.n}.mp4`, nombre: `bloque ${t.n}`, cmd: `${t.n}` })),
        ...(manifiesto.ganchos_alternativos || []).map((g) => ({ uso: g, archivo: `gancho-${g.id}.mp4`, nombre: `gancho ${g.id}`, cmd: `--gancho ${g.id}` })),
      ].filter((x) => (x.uso.referencias || []).includes(l.id) && !enPlan.has(x.archivo) && fs.existsSync(path.join(dirVideo, x.archivo)));
      if (!usan.length) continue;
      console.log(`  OJO: el bloque ${l.de_toma} se regenera y es el origen del lugar "${l.id}". Ya estan generados con`);
      console.log(`  su fotograma anterior, y no entran en esta corrida: ${usan.map((x) => x.nombre).join(', ')}.`);
      console.log('  Revisalos cuando el bloque nuevo este listo; si el lugar cambio, rehazlos:');
      for (const x of usan) console.log(`      npm run rehacer -- ${carpetaArg} ${x.cmd}`);
      console.log('');
    }
  }

  // Continuidad: que se manda en cada clip de la cadena, en orden, para verlo
  // ANTES de pagar (de que imagen sale y a cual llega).
  if (conContinuidad) {
    console.log('  Continuidad: cada clip va de su imagen inicial a la final, en este orden (sin B-roll):\n');
    const ancho = Math.max(...plan.map((t) => t.descripcion.length));
    for (const t of plan) {
      const imagenes = t.imagenFinal ? `${t.imagenInicial} -> ${t.imagenFinal}` : `${t.imagenInicial} (sin imagen final)`;
      console.log(`      ${t.archivo.padEnd(12)} ${t.descripcion.padEnd(ancho)}  ${imagenes}`);
    }
    console.log('');
  }

  // Estilo hablado (podcast, entrevista): tomas H con Omni y B-roll con Kling.
  // Que se manda en cada clip, para verlo ANTES de pagar.
  const hablado = ESTILOS_HABLADOS.includes(manifiesto.estilo);
  const porIngredientes = plan.filter((t) => t.porIngredientes);
  if (hablado) {
    // Las tomas con frame inicial (podcast, y entrevistas de antes) y las que
    // van por ingredientes (entrevista) se explican cada una a su manera.
    if (!porIngredientes.length || porIngredientes.length < plan.filter((t) => t.tipo === 'H').length) {
      console.log('  Tomas habladas (H): su frame inicial como first_frame_url, sin frame final, sin referencias');
      // (Con tomas por ingredientes, lo del B-roll lo dice su parrafo, abajo.)
      console.log(`  y sin modelo de respaldo (Kling no genera el dialogo).${porIngredientes.length ? '' : ' B-roll: Kling, mudo, por segundo.'}\n`);
    }
    if (porIngredientes.length) {
      console.log('  Tomas habladas (H) por ingredientes: estas imagenes como image_urls, en este orden (imagen 1,');
      console.log('  imagen 2... del prompt; la 1 es la imagen del clip, que el prompt pide como frame inicial), sin');
      console.log('  modelo de respaldo (Kling no genera el dialogo). B-roll: Kling, mudo, por segundo.\n');
    }
    const ancho = Math.max(...plan.map((t) => t.descripcion.length));
    for (const t of plan) {
      const toma = t.clase === 'toma' ? manifiesto.tomas.find((x) => x.n === t.n) : null;
      const deDonde = toma && typeof toma.frame_inicial === 'string' && toma.frame_inicial.trim() ? ` (copia de "${toma.frame_inicial}")` : '';
      if (t.porIngredientes) {
        const rel = (r) => (r.ruta ? path.relative(carpeta, r.ruta).replace(/\\/g, '/') : 'sin archivo');
        const ings = t.rutasReferencias.map(
          (r, i) => `${i + 1}) ${r.id} (${rel(r)}${r.como === 'imagen del clip' ? deDonde : ''}${r.ruta && fs.existsSync(r.ruta) ? '' : marcaFalta})`
        );
        console.log(`      ${t.archivo.padEnd(14)} ${t.descripcion.padEnd(ancho)}  ${ings.join('  ')}`);
        continue;
      }
      console.log(`      ${t.archivo.padEnd(14)} ${t.descripcion.padEnd(ancho)}  img/${t.imagenInicial}${deDonde}`);
    }
    console.log('');
  }

  // Costo real clip por clip, segun la duracion de cada uno. Un bloque R va
  // siempre a MODELO_VIDEO_UGC (es el unico que sabe recibir referencias); un
  // trabajo con cascada propia (tomas H, B-roll de los estilos hablados) va al
  // primero de su cascada.
  const modeloDe = (t) => t.cascada?.[0] ?? (t.tipo === 'R' ? MODELO_VIDEO_UGC : MODELOS.video.principal);
  let creditosTotal = 0;
  let segundosPedidos = 0;
  let segundosUtiles = 0;
  const porTramo = {};
  const porModelo = new Map(); // modelo -> { duracion -> clips } (estilos hablados: una tabla por modelo)
  for (const t of plan) {
    const { creditos, duracion, excedeTope } = creditosClip(modeloDe(t), t.segundos, RESOLUCION_VIDEO);
    if (excedeTope) {
      console.error(`\n  ${t.descripcion} pasa el tope del modelo. Hay que dividirla en el manifiesto.\n`);
      process.exit(1);
    }
    t.duracionPedida = duracion;
    t.creditos = creditos;
    creditosTotal += creditos;
    segundosPedidos += duracion;
    segundosUtiles += t.segundos;
    porTramo[duracion] = (porTramo[duracion] || 0) + 1;
    const tramosDelModelo = porModelo.get(modeloDe(t)) || {};
    tramosDelModelo[duracion] = (tramosDelModelo[duracion] || 0) + 1;
    porModelo.set(modeloDe(t), tramosDelModelo);
  }

  const tiposB = plan.filter((t) => t.imagenFinal).length;
  // El validador no deja mezclar bloques R con tomas de otro tipo: o todo el
  // plan es R, o nada lo es.
  const planR = bloquesR.length > 0;
  if (planR) {
    const nGanchos = plan.filter((t) => t.clase === 'gancho').length;
    console.log(`  Clips:      ${plan.length}  (bloques R${nGanchos ? `, ${nGanchos} de ellos gancho(s) alternativo(s)` : ''})`);
    console.log(`  Modelo:     ${MODELO_VIDEO_UGC} a ${RESOLUCION_VIDEO}, referencias como image_urls`);
    console.log('  Audio:      la voz la genera el modelo dentro de cada clip (dialogo con lip-sync)\n');
  } else if (conContinuidad) {
    console.log(`  Clips:      ${textoCuenta(plan)}, ${tiposB} con frame inicial + final`);
    console.log(`  Modelo:     ${MODELOS.video.principal} a ${RESOLUCION_VIDEO}`);
    console.log('  Audio:      ambiente nativo del modelo, sin voces (se mezcla bajo la voz en off)\n');
  } else if (hablado) {
    const nH = plan.filter((t) => t.tipo === 'H').length;
    const nBroll = plan.filter((t) => t.clase === 'broll').length;
    const modeloBroll = plan.find((t) => t.clase === 'broll')?.cascada?.[0];
    console.log(`  Clips:      ${plan.length}  (${nH} toma(s) hablada(s)${nBroll ? ` + ${nBroll} B-roll` : ''})`);
    const comoH = !porIngredientes.length
      ? ''
      : porIngredientes.length === nH
        ? ', por ingredientes'
        : `, ${porIngredientes.length} por ingredientes y ${nH - porIngredientes.length} con frame inicial`;
    console.log(`  Modelo:     ${MODELOS.video.principal} a ${RESOLUCION_VIDEO} para las tomas habladas (sin respaldo${comoH})`);
    if (modeloBroll) console.log(`              ${modeloBroll} a ${RESOLUCION_VIDEO} para el B-roll (sin audio)`);
    console.log('  Audio:      la voz la genera Omni dentro de cada toma (dialogo con lip-sync); el B-roll va mudo\n');
  } else {
    console.log(`  Clips:      ${plan.length}  (${tiposB} con frame inicial + final)`);
    console.log(`  Modelo:     ${MODELOS.video.principal} a ${RESOLUCION_VIDEO}`);
    console.log('  Audio:      ambiente nativo del modelo, sin voces (se mezcla bajo la voz en off)\n');
  }
  if (hablado) {
    // Una tabla por modelo: Omni cobra por tramo, Kling por segundo (sin audio).
    const creditosUnitarios = (modelo, tramo) => {
      const def = MODELOS_VIDEO[modelo];
      return def.cobro === 'por-segundo' ? def.precio[RESOLUCION_VIDEO] * Number(tramo) : def.precio[RESOLUCION_VIDEO][tramo];
    };
    for (const [modelo, tramos] of porModelo) {
      const def = MODELOS_VIDEO[modelo];
      console.log(`  ${modelo}${def.cobro === 'por-segundo' ? ` (${def.precio[RESOLUCION_VIDEO]} creditos por segundo, sin audio)` : ''}:`);
      console.log('  Largo   clips   creditos c/u   subtotal');
      for (const tramo of Object.keys(tramos).sort((a, b) => a - b)) {
        const n = tramos[tramo];
        const cu = creditosUnitarios(modelo, tramo);
        console.log(`   ${String(tramo).padStart(2)}s     ${String(n).padStart(3)}      ${String(cu).padStart(4)}        ${String(n * cu).padStart(5)}`);
      }
    }
  } else {
    const modeloTabla = planR ? MODELO_VIDEO_UGC : MODELOS.video.principal;
    // En UGC por bloques "tramo" es otra cosa (cada timestamp dentro del bloque):
    // ahi la columna se llama "Largo" para no confundir.
    console.log(planR ? '  Largo   clips   creditos c/u   subtotal' : '  Tramo   clips   creditos c/u   subtotal');
    for (const tramo of Object.keys(porTramo).sort((a, b) => a - b)) {
      const n = porTramo[tramo];
      const cu = MODELOS_VIDEO[modeloTabla].precio[RESOLUCION_VIDEO][tramo];
      console.log(`   ${String(tramo).padStart(2)}s     ${String(n).padStart(3)}      ${String(cu).padStart(4)}        ${String(n * cu).padStart(5)}`);
    }
  }

  const saldo = await consultarCreditos();
  console.log(`\n  Costo:      ${creditosTotal} creditos = US$${creditosAUsd(creditosTotal).toFixed(2)}`);
  console.log(`  Metraje:    se pagan ${segundosPedidos}s para cubrir ${segundosUtiles.toFixed(1)}s utiles`);
  if (saldo !== null) {
    console.log(`  Tu saldo:   ${saldo} creditos = US$${creditosAUsd(saldo).toFixed(2)}`);
    if (saldo < creditosTotal) console.log('  ATENCION:   no te alcanza el saldo para todo esto.');
  }
  console.log(`  Precios consultados el ${PRECIOS.consultado} en ${KIE.precios}\n`);
  avisoGanchos();

  if (soloPlan) {
    console.log('  --solo-plan: no se genero nada y no se cobro nada.\n');
    return;
  }

  if (!sinConfirmar) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    const r = (await rl.question('  Genero? Se cobra a tu cuenta de kie.ai [s/N]: ')).trim().toLowerCase();
    rl.close();
    if (r !== 's' && r !== 'si') {
      console.log('\n  Cancelado. No se genero nada ni se cobro nada.\n');
      return;
    }
  }

  // carpetaArg va para los mensajes de los bloques R (el comando a correr si fallan).
  const ctx = {
    carpeta,
    carpetaArg,
    dirImg,
    dirVideo,
    aspectRatio: manifiesto.aspect_ratio || '9:16',
    // Para que "el mismo comando" de los mensajes de error lo sea de verdad.
    soloTomas,
    soloBroll,
    soloPasos,
    sinBroll,
    todoElBroll,
    conGanchos,
    // Con --esperar-imagenes, cada clip espera sus imagenes; producir escribe
    // este archivo cuando el proceso de imagenes termina (ver enMarcha).
    esperarImagenes: esperarImagenes ? { rutaFin: path.join(carpeta, '.imagenes-fin.json') } : null,
  };
  const log = [];
  const t0 = Date.now();

  // Con continuidad el log se fusiona con el anterior (ver fusionarLogContinuidad).
  const rutaLog = path.join(dirVideo, 'log-modelos.json');
  const clipsDelLog = () => (conContinuidad ? fusionarLogContinuidad(rutaLog, log, cadenaDeClips(manifiesto), dirVideo) : log);
  const guardarLog = (parcial) =>
    fs.writeFileSync(
      rutaLog,
      JSON.stringify(
        { generado: new Date().toISOString(), parcial, segundos: Math.round((Date.now() - t0) / 1000), clips: clipsDelLog() },
        null,
        2
      ) + '\n',
      'utf8'
    );

  try {
    console.log('');
    if (planR) {
      // Bloques R: cada uno apenas esta su bloque de origen, con sus
      // fotogramas de lugar (ver ejecutarR).
      ctx.lugares = listaDeReferencias(manifiesto)
        .filter(esLugarDeToma)
        .map((r) => ({ id: r.id, deToma: r.de_toma, ruta: path.join(dirImg, archivoDeHoja(r)) }));
      await ejecutarR(plan, ctx, log);
    } else {
      await ejecutar(plan, ctx, log);
    }

    await armarSinCobroPendientes();
    const creditosReales = log.reduce((s, x) => s + (x.creditos || 0), 0);
    const conRespaldo = log.filter((x) => x.respaldo);
    const seg = ((Date.now() - t0) / 1000).toFixed(0);
    guardarLog(false);

    // Los que piden quedar en la biblioteca de clips, para otros anuncios.
    for (const x of log) {
      const t = construirPlan(manifiesto, {}).find((p) => p.archivo === x.archivo);
      const item = t && itemDeTrabajo(manifiesto, t);
      if (!item?.guardar_en_biblioteca) continue;
      const r = guardarEnBiblioteca({ manifiesto, carpeta, item, archivoClip: x.archivo, clase: t.clase });
      if (r?.guardado) console.log(`  Biblioteca de clips: ${x.archivo} -> ${r.guardado}`);
      else if (r?.yaEstaba) console.log(`  Biblioteca de clips: ${x.archivo} ya estaba (${r.yaEstaba})`);
      else if (r?.error) console.log(`  Biblioteca de clips: no pude guardar ${x.archivo} (${r.error})`);
    }

    console.log(`\n  Listo en ${seg}s. ${log.length} clips en ${dirVideo}`);
    console.log(`  Gasto real: ${creditosReales} creditos = US$${creditosAUsd(creditosReales).toFixed(2)}`);
    if (conRespaldo.length) {
      console.log(`\n  ATENCION: ${conRespaldo.length} clip(s) salieron del modelo de respaldo y pueden verse distintos:`);
      for (const x of conRespaldo) console.log(`      ${x.archivo} -> ${x.modelo}`);
      if (conContinuidad) {
        console.log('  Con continuidad, revisa sus uniones (que arranquen y lleguen a sus imagenes):');
        console.log(`      npm run frames -- ${carpetaArg} --uniones`);
      }
    }
    console.log('  Detalle por clip en video/log-modelos.json\n');
    avisarMedirTomasH(log, manifiesto, carpetaArg, console.log);
  } catch (e) {
    console.error(`\n  SE DETUVO\n\n  ${e.message}\n`);
    if (log.length) {
      guardarLog(true);
      const cr = log.reduce((s, x) => s + (x.creditos || 0), 0);
      console.error(`  Se alcanzaron a generar ${log.length} clips (${cr} creditos). Al volver a correr, esos no se repiten.\n`);
      avisarMedirTomasH(log, manifiesto, carpetaArg, console.error);
    }
    process.exitCode = 1;
  }
}

/**
 * Estilos hablados: las tomas H que salieron en esta corrida no tienen medida
 * (sacarDerivadosDeTomaH quito la del clip anterior) y el plan no las puede
 * cortar por palabras hasta medirlas. Se dice el comando exacto, con sus
 * numeros; las "solo_voz" (voz en off de la entrevista A) pasan despues por el
 * paso voz y se miden otra vez. Sin tomas H en el log no imprime nada.
 */
function avisarMedirTomasH(log, manifiesto, carpetaArg, decir) {
  const ns = [
    ...new Set(log.filter((x) => x.tipo === 'H' && /^toma-\d+$/.test(String(x.id))).map((x) => Number(String(x.id).slice(5)))),
  ].sort((a, b) => a - b);
  if (!ns.length) return;
  const soloVoz = ns.filter((n) => manifiesto.tomas.find((t) => t.n === n)?.solo_voz === true);
  decir(`  Tomas habladas nuevas (${ns.join(', ')}): midelas y revisa que esten limpias antes de planear:`);
  decir(`      npm run lineas -- ${carpetaArg} --tomas ${ns.join(',')}`);
  if (soloVoz.length) {
    decir('  Las de voz en off ("solo_voz"), cuando esten limpias, pasan por el paso voz y se miden otra vez:');
    decir(`      npm run voz -- ${carpetaArg} --tomas ${soloVoz.join(',')}`);
    decir(`      npm run lineas -- ${carpetaArg} --tomas ${soloVoz.join(',')}`);
  }
  decir('');
}

// La revision de los B-roll dentro de la tarea compartida "revisar-clips" (claude/tarea-revisar-clips.md), para
// cualquier familia que la use (objeto parlante, podcast y entrevista; UGC no lleva B-roll).
//
// Un B-roll no tiene frase ni pasa por el transcriptor: Claude lo mira por como se ve (su tira qa/broll-N.jpg y su
// imagen) y, si esta mal, escribe su prompt de video nuevo (y el de su imagen, si el problema ya esta ahi). La app lo
// rehace sola, SOLO ese B-roll (ninguna toma), con su propio tope, y con lo que el motor ya sabe de cada estilo (que
// modelo, con o sin sonido: generar-videos.js, construirPlan). Un B-roll que no entra en el video no se mira ni se
// pide (la regla del motor, broll.js / planear-montaje.js: brollQueEntran).
//
//   TOPE_BROLL                          cuantas veces se rehace como mucho un B-roll en la revision de clips
//   vecesDeBroll(est)                   cuantas veces ya se rehizo (o se esta rehaciendo) en ESTA revision
//   brollQueSeMiran(carpeta, m)         los B-roll que entran en el video y tienen su clip
//   entradaDeBroll({ carpeta, b, m, vez, historial, contexto, alTope })   su entrada en la lista {{clips}} de la tarea
//   seccionesDeBroll(crudo, hay)        la tarea con (o sin) lo que dice de los B-roll (<!--si-broll-->...<!--fin-broll-->)
//   validarPedidoDeBroll(x, b, { donde, opciones })   lo que escribio Claude para ese B-roll -> { pedido } | { error }
//   pareceDelBroll(prompt, b, t)        ¿el prompt_video de una TOMA es en realidad el de su B-roll? (olvido "broll")
//   cuentasDeBroll(valor, { mostrados, conPedido, alTope, errores })   bien_broll / mal_broll y que no falte ninguno
//   rehacerBroll(ctx, { p, est, ... })  aplica el pedido y lo genera (fases, para retomar sin pagar dos veces)
//   resumenDeBroll(estados)             { rehechos, quedanMal } para la nota del paso y el informe
//   detalleDeBrollMal(quedanMal, tope)  el texto del informe para los que quedaron mal
//
// El tope se cuenta en el estado de cada B-roll en la revision (est.veces), ANTES de pagar: no en
// conductor.rehechos['broll-N'], que tambien suma la revision de las imagenes cuando rehace la imagen de un B-roll.
// conductor.rehechos se sigue sumando (la pantalla marca esa pieza como arreglada) y se descuenta si al final no se
// pudo hacer de nuevo (el B-roll volvio a como estaba).
//
// Lo que cobra lo corre la app con ctx.correr (y su gasto queda anotado, como el de las tomas):
//   rehacer-toma.js --broll N --aplicar <prompts>   (escribe el manifiesto, valida, manda el clip a historial/)
//   generar-imagenes.js --broll N --si              (solo si se cambio su imagen)
//   generar-videos.js --broll N --si                (solo ese B-roll; si no entra en el video, tampoco lo pide)
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './rutas.js';
import { leerJSON, existe, escribirJSONSeguro } from './archivos.js';
import { brollDe } from './broll.js';

/** Cuantas veces se rehace como mucho un B-roll, por cualquier motivo (aparte del tope de las tomas). */
export const TOPE_BROLL = 2;

export const claveBroll = (n) => `broll-${n}`;

/** Cuantas veces ya se rehizo (o se esta rehaciendo: se cuenta antes de pagar) este B-roll en esta revision. */
export const vecesDeBroll = (est) => Math.max(0, Number(est?.veces) || 0);

const ahora = () => new Date().toISOString();
const relRaiz = (abs) => path.relative(RAIZ, abs).split(path.sep).join('/');
const rutaClipBroll = (carpeta, n) => path.join(carpeta, 'video', `broll-${n}.mp4`);
const rutaImagenBroll = (carpeta, n) => path.join(carpeta, 'img', `broll-${n}.png`);
const rutaPromptsAnteriores = (carpeta) => path.join(carpeta, 'prompts-anteriores.json');

function hayArchivo(ruta) {
  try {
    const st = fs.statSync(ruta);
    return st.isFile() && st.size > 0;
  } catch {
    return false;
  }
}

/** Las ultimas lineas utiles de lo que dijo un comando, sin precios ni saldos (para el detalle). */
function ultimasLineas(texto, n = 6) {
  return String(texto || '')
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() && !/US\$|cr[eé]ditos?\b|\bsaldo\b|\bcr\b|\$\d/i.test(l))
    .slice(-n)
    .join('\n');
}

/** Los B-roll que se miran: los que entran en el video (la regla del motor) y ya tienen su clip en video/. */
export function brollQueSeMiran(carpeta, m) {
  const regla = brollDe(carpeta, m);
  return (Array.isArray(m?.broll) ? m.broll : []).filter((b) => b && Number.isInteger(b.n) && regla.entra(b.n) && hayArchivo(rutaClipBroll(carpeta, b.n)));
}

/**
 * La entrada de un B-roll en la lista de la tarea (la misma forma que las tomas: "- B-roll N", la tira, la imagen).
 *   vez        cuantas veces ya se rehizo · historial: los motivos de esas veces (para no repetir la idea)
 *   contexto   la ruta de su contexto (rehacer-toma --broll N --contexto), o null
 *   alTope     ya no se rehace mas (su tope, o la ultima vuelta): solo se dice como quedo, sin prompts
 */
export function entradaDeBroll({ carpeta, b, m, vez = 0, historial = [], contexto = null, alTope = false }) {
  const nt = b.encima_de_toma ?? b.despues_de_toma;
  const toma = (m?.tomas || []).find((t) => t.n === nt);
  const donde = nt ? `${b.encima_de_toma !== undefined ? 'va encima de' : 'va después de'} la toma ${nt}` : 'va solo';
  const ancla = b.sincroniza_con ? `, entra con «${b.sincroniza_con}»` : b.cierre ? ', el del cierre' : '';
  const refs = Array.isArray(b.referencias) && b.referencias.length ? `  Lleva: ${b.referencias.join(', ')} (sus hojas, en la carpeta de imágenes, o la foto real del producto).` : null;
  const veces = vez === 1 ? 'una vez' : `${vez} veces`;
  return [
    `- B-roll ${b.n} (${donde}${ancla}, ${b.duracion ?? '?'} s; nadie habla). En tu archivo va con "toma": ${b.n} y "broll": true.`,
    toma?.linea ? `  Acompaña a la frase de la toma ${nt}: «${toma.linea}»` : null,
    `  Tira del clip (5 cuadros): ${path.join(carpeta, 'qa', `broll-${b.n}.jpg`)}`,
    `  Su imagen: ${rutaImagenBroll(carpeta, b.n)}`,
    refs,
    alTope
      ? `  Ya se rehizo${vez ? ` ${veces}` : ''}${historial.length ? ` (${historial.join('; ')})` : ''} y ya no se rehace más: no escribas prompts; solo di cómo quedó (en "bien_broll" si está bien, o en "mal_broll" con su número y el motivo si sigue mal).`
      : vez
        ? `  Ya se rehizo ${veces}${historial.length ? ` (${historial.join('; ')})` : ''}: no repitas esa idea.`
        : null,
    contexto && !alTope ? `  Contexto para reescribirlo: ${contexto}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * La tarea compartida con lo que dice de los B-roll (entre <!--si-broll--> y <!--fin-broll-->) o sin eso, para un
 * anuncio que no tiene B-roll que mirar (UGC): asi no le pide a Claude "bien_broll" ni le muestra un ejemplo de B-roll.
 */
export function seccionesDeBroll(crudo, hay) {
  return String(crudo).replace(/<!--si-broll-->([\s\S]*?)<!--fin-broll-->/g, (todo, dentro) => (hay ? dentro : ''));
}

/**
 * Valida lo que escribio Claude para un B-roll (una entrada de "clips" con "broll": true). `b` es el B-roll del
 * manifiesto que se le mostro. Sin frase: nada de copiarla tal cual en el prompt_video.
 * Devuelve { pedido: { broll, rehacer, motivo, prompts: { prompt_video, prompt_imagen? } } } o { error }.
 */
export function validarPedidoDeBroll(x, b, { donde = 'clips[?]', opciones = ['clip', 'toma'] } = {}) {
  const aqui = `${donde} (B-roll ${b.n})`;
  const rehacer = String(x?.rehacer || '');
  if (!opciones.includes(rehacer)) return { error: `${aqui}: "rehacer" tiene que ser ${opciones.map((o) => `"${o}"`).join(' o ')} ("toma" si el problema ya está en su imagen).` };
  const falta = [];
  if (typeof x.motivo !== 'string' || x.motivo.trim().length < 3) falta.push('motivo');
  if (typeof x.prompt_video !== 'string' || x.prompt_video.trim().length < 20) falta.push('prompt_video');
  if (rehacer === 'toma' && !(typeof x.prompt_imagen === 'string' && x.prompt_imagen.trim().length >= 40)) falta.push('prompt_imagen (con "rehacer": "toma" va también el prompt de su imagen, corregido)');
  if (falta.length) return { error: `${aqui}: falta ${falta.join(', ')}.` };
  const pv = x.prompt_video.trim();
  const pi = rehacer === 'toma' ? x.prompt_imagen.trim() : null;
  const mismoVideo = pv === String(b.prompt_video || '').trim();
  const mismaImagen = !pi || pi === String(b.prompt_imagen || '').trim();
  if (mismoVideo && mismaImagen) return { error: `${aqui}: los prompts son los mismos de antes; rehacer con el mismo prompt da lo mismo.` };
  return {
    pedido: {
      broll: b.n,
      rehacer,
      motivo: x.motivo.trim().slice(0, 300),
      prompts: { prompt_video: pv, ...(pi && !mismaImagen ? { prompt_imagen: pi } : {}) },
    },
  };
}

/** Las palabras de un prompt (minusculas, de 3 letras o mas), para comparar de donde salio. */
function palabras(texto) {
  return new Set(
    String(texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .match(/[a-zñ0-9]{3,}/g) || []
  );
}

/**
 * ¿El prompt_video que Claude escribio para una TOMA salio del de su B-roll (con el mismo numero)? Pasa cuando
 * olvida "broll": true: se pagaria otra vez esa toma con la escena del B-roll. Se mira cuanto del prompt nuevo
 * viene de cada uno de los dos prompts de ahora, sin contar las palabras de la frase (la toma las tiene que traer
 * igual, y pegarlas en el prompt del B-roll no lo vuelve el de la toma). `frases`: lo que se dice en la toma.
 */
export function pareceDelBroll(prompt, b, t, frases = [t?.linea]) {
  const deFrase = palabras(frases.filter(Boolean).join(' '));
  const sinFrase = (texto) => new Set([...palabras(texto)].filter((w) => !deFrase.has(w)));
  const p = sinFrase(prompt);
  if (!p.size || !b?.prompt_video) return false;
  const deB = sinFrase(b.prompt_video);
  const deT = sinFrase(t?.prompt_video);
  let enB = 0;
  let enT = 0;
  for (const w of p) {
    if (deB.has(w) && !deT.has(w)) enB++;
    if (deT.has(w) && !deB.has(w)) enT++;
  }
  // cuenta solo lo propio de cada uno (lo comun, el estilo, no dice nada): mas del B-roll que de la toma
  return enB >= 4 && enB > enT * 1.5;
}

/**
 * Lo que dijo Claude de los B-roll que no van en "clips" ("bien_broll", y "mal_broll" para los que ya no se rehacen)
 * y que cada B-roll mostrado este dicho: si no, un B-roll malo pasaria como bueno sin aviso.
 *   mostrados  los n de los B-roll de la lista · conPedido: los n que ya estan en "clips" (validos)
 *   alTope     los n que ya no se rehacen (los unicos que van en "mal_broll") · errores: los de las entradas
 * Devuelve { mal: [{ n, motivo }], errores } (los errores nuevos, para sumar a los de la familia).
 */
export function cuentasDeBroll(valor, { mostrados = [], conPedido = [], alTope = [], errores: previos = [] } = {}) {
  const errores = [];
  const mal = [];
  const mostradosSet = new Set(mostrados);
  const bien = new Set((Array.isArray(valor?.bien_broll) ? valor.bien_broll : []).map(Number).filter(Number.isInteger));
  const conPedidoSet = new Set(conPedido);
  for (const [i, x] of (Array.isArray(valor?.mal_broll) ? valor.mal_broll : []).entries()) {
    const n = Number(x?.toma);
    const donde = `mal_broll[${i}]`;
    if (!mostradosSet.has(n)) {
      errores.push(`${donde}: el B-roll ${x?.toma} no es uno de los que te mostré (${mostrados.join(', ') || 'ninguno'}).`);
      continue;
    }
    if (!alTope.includes(n)) {
      errores.push(`${donde}: el B-roll ${n} todavía se puede rehacer: va en "clips" con "broll": true y su prompt_video nuevo (o en "bien_broll" si está bien).`);
      continue;
    }
    if (mal.some((y) => y.n === n) || conPedidoSet.has(n)) {
      errores.push(`${donde}: el B-roll ${n} está dos veces.`);
      continue;
    }
    mal.push({ n, motivo: typeof x?.motivo === 'string' && x.motivo.trim() ? x.motivo.trim().slice(0, 300) : null });
  }
  const dicho = (n) => conPedidoSet.has(n) || mal.some((y) => y.n === n);
  for (const n of bien) {
    if (mostradosSet.has(n) && dicho(n)) errores.push(`El B-roll ${n} está en "bien_broll" y también como mal: va en uno solo.`);
  }
  const yaDicho = (n) => [...previos, ...errores].some((e) => new RegExp(`\\bB-roll ${n}\\b`).test(e));
  for (const n of mostrados) {
    if (dicho(n) || bien.has(n) || yaDicho(n)) continue;
    errores.push(
      alTope.includes(n)
        ? `Falta el B-roll ${n}: va en "bien_broll" si quedó bien, o en "mal_broll" ({"toma": ${n}, "motivo": "..."}) si sigue mal.`
        : `Falta el B-roll ${n}: va en "clips" (con "broll": true) si está mal, o en "bien_broll" si está bien.`
    );
  }
  return { mal, errores };
}

// ---- respaldo del B-roll antes de tocarlo ----

/** Copia con su misma fecha: un clip que vuelve de su respaldo sigue siendo el mismo. */
function copiar(de, a) {
  if (!existe(de)) return false;
  fs.mkdirSync(path.dirname(a), { recursive: true });
  fs.copyFileSync(de, a);
  try {
    const st = fs.statSync(de);
    fs.utimesSync(a, st.atime, st.mtime);
  } catch {
    /* sin la fecha, igual sirve */
  }
  return true;
}

function respaldar(carpeta, dir, b) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  copiar(rutaImagenBroll(carpeta, b.n), path.join(dir, 'img', `broll-${b.n}.png`));
  copiar(rutaClipBroll(carpeta, b.n), path.join(dir, 'video', `broll-${b.n}.mp4`));
  // los prompts de antes que guarda rehacer-toma: si el B-roll vuelve a como estaba, el que no se uso no queda ahi
  if (!copiar(rutaPromptsAnteriores(carpeta), path.join(dir, 'prompts-anteriores.json'))) escribirJSONSeguro(path.join(dir, 'sin-prompts-anteriores.json'), { fecha: ahora() });
  escribirJSONSeguro(path.join(dir, 'broll.json'), b);
}

/** El B-roll vuelve a como estaba: su imagen, su clip, su entrada del manifiesto (solo la suya) y los prompts de antes. */
function restaurar(carpeta, dir, n) {
  copiar(path.join(dir, 'img', `broll-${n}.png`), rutaImagenBroll(carpeta, n));
  copiar(path.join(dir, 'video', `broll-${n}.mp4`), rutaClipBroll(carpeta, n));
  if (!copiar(path.join(dir, 'prompts-anteriores.json'), rutaPromptsAnteriores(carpeta)) && existe(path.join(dir, 'sin-prompts-anteriores.json'))) {
    fs.rmSync(rutaPromptsAnteriores(carpeta), { force: true });
  }
  const b = leerJSON(path.join(dir, 'broll.json'));
  if (!b) return;
  const rutaM = path.join(carpeta, 'manifiesto.json');
  const m = leerJSON(rutaM);
  const i = (m?.broll || []).findIndex((x) => x?.n === n);
  if (i !== -1) {
    m.broll[i] = b;
    escribirJSONSeguro(rutaM, m);
  }
}

/**
 * Rehace un B-roll segun su pedido, con el tope contado ANTES de pagar (como las tomas). Retoma por fases si la app
 * se cerro a mitad: pendiente -> aplicando -> imagen? -> video -> listo. Devuelve null si siguio (p.resultado dice
 * como: 'rehecho', 'tope', 'no-entra', 'no-se-pudo'), o lo que tiene que devolver el paso (cancelado, una pausa).
 *   p            el pedido ({ broll, rehacer, motivo, prompts, fase })
 *   est          el estado de ESE B-roll en la familia (aca se anotan veces, historial, rehechoEnRonda y visto)
 *   rondaN       la vuelta de la revision · tope: el de este B-roll · sinVueltas: ya no se puede rehacer nada
 *   dirTrabajo   donde quedan su respaldo y sus prompts (temp/<slug>/app/clips, por ejemplo)
 *   fallo        (r, { que }) => lo que devuelve el paso cuando un comando fallo por saldo, red o servidor
 *   despuesDeVideos({ desde, texto })   lo que la familia anota de cada corrida de videos (de que modelo salio)
 * 'no-se-pudo': el B-roll vuelve a como estaba y su cuenta (est.veces, conductor.rehechos) se descuenta.
 */
export async function rehacerBroll(ctx, { p, est, rondaN, tope = TOPE_BROLL, sinVueltas = false, dirTrabajo, guardarEstado, fallo, despuesDeVideos = null }) {
  const n = p.broll;
  const clave = claveBroll(n);
  const rehechos = (ctx.conductor.rehechos ||= {});
  const dirResp = path.join(dirTrabajo, 'respaldo', clave);
  const anotar = () => {
    (est.historial ||= []).push({ ronda: rondaN, rehacer: p.rehacer, motivo: p.motivo, resultado: p.resultado, ...(p.detalle ? { detalle: p.detalle } : {}), fecha: ahora() });
    guardarEstado();
  };
  const noSePudo = (detalle) => {
    restaurar(ctx.carpeta, dirResp, n);
    if (p.contado) {
      // no hay version nueva: la vez no cuenta (ni para el tope, ni como pieza rehecha)
      est.veces = Math.max(0, vecesDeBroll(est) - 1);
      const r = Math.max(0, (Number(rehechos[clave]) || 0) - 1);
      if (r) rehechos[clave] = r;
      else delete rehechos[clave];
      p.contado = false;
      ctx.guardar();
    }
    p.resultado = 'no-se-pudo';
    p.detalle = detalle;
    p.fase = 'listo';
    anotar();
    return null;
  };
  const m0 = leerJSON(path.join(ctx.carpeta, 'manifiesto.json'));
  const b0 = (m0?.broll || []).find((x) => x?.n === n);
  if (!b0) {
    p.resultado = 'no-se-pudo';
    p.detalle = 'el B-roll ya no está en el manifiesto';
    p.fase = 'listo';
    anotar();
    return null;
  }

  if (p.fase === 'pendiente' || p.fase === 'aplicando') {
    if (p.fase === 'aplicando') restaurar(ctx.carpeta, dirResp, n); // quedo a medias: vuelve a como estaba y se aplica otra vez
    else {
      if (sinVueltas || vecesDeBroll(est) >= tope) {
        p.resultado = 'tope';
        p.fase = 'listo';
        anotar();
        return null;
      }
      // el que no entra en el video no se pide (no se veria): la misma regla del motor
      if (!brollDe(ctx.carpeta, m0).entra(n)) {
        p.resultado = 'no-entra';
        p.fase = 'listo';
        anotar();
        return null;
      }
      respaldar(ctx.carpeta, dirResp, b0);
      p.fase = 'aplicando';
      guardarEstado();
    }
    const archivo = path.join(dirTrabajo, `prompts-${clave}.json`);
    escribirJSONSeguro(archivo, { ...p.prompts, motivo: `revision de la app: ${p.motivo}` });
    const a = await ctx.correr('rehacer-toma.js', [ctx.carpetaArg, '--broll', String(n), '--aplicar', relRaiz(archivo)]);
    if (a.cancelado) return { cancelado: true };
    if (a.codigo !== 0) return noSePudo(ultimasLineas(a.texto));
    // El tope se cuenta ANTES de pagar: si la app se cierra a mitad, al volver no se rehace otra vez.
    est.veces = vecesDeBroll(est) + 1;
    p.vez = est.veces;
    p.contado = true;
    rehechos[clave] = (Number(rehechos[clave]) || 0) + 1;
    ctx.guardar();
    p.fase = hayArchivo(rutaImagenBroll(ctx.carpeta, n)) ? 'video' : 'imagen';
    guardarEstado();
  }

  if (p.fase === 'imagen') {
    ctx.avance(`Rehaciendo la imagen del B-roll ${n}`);
    const r = await ctx.correr('generar-imagenes.js', [ctx.carpetaArg, '--broll', String(n), '--si'], { que: ['imagenes'] });
    if (r.cancelado || ctx.senal?.aborted) return { cancelado: true };
    if (r.codigo !== 0 || !hayArchivo(rutaImagenBroll(ctx.carpeta, n))) {
      if (r.codigo !== 0 && (r.clase === 'saldo' || ['red', 'servidor'].includes(r.clase))) return fallo(r, { que: `la imagen del B-roll ${n}` });
      return noSePudo(ultimasLineas(r.texto));
    }
    p.fase = 'video';
    guardarEstado();
  }

  if (p.fase === 'video') {
    // el clip de antes ya esta en historial/ (rehacer-toma): si hay uno, es el nuevo (la app se cerro despues de
    // bajarlo) y no se pide otra vez. Sin --rehacer: una tarea que quedo en kie se retoma, no se paga dos veces.
    if (!hayArchivo(rutaClipBroll(ctx.carpeta, n))) {
      ctx.avance(`Rehaciendo el B-roll ${n}`);
      const desde = Date.now();
      const r = await ctx.correr('generar-videos.js', [ctx.carpetaArg, '--broll', String(n), '--si'], { que: ['videos'] });
      if (r.cancelado || ctx.senal?.aborted) return { cancelado: true };
      if (despuesDeVideos) despuesDeVideos({ desde, texto: r.texto });
      if (r.codigo !== 0 || !hayArchivo(rutaClipBroll(ctx.carpeta, n))) {
        if (r.codigo !== 0 && (r.clase === 'saldo' || ['red', 'servidor'].includes(r.clase))) return fallo(r, { que: `el B-roll ${n}` });
        return noSePudo(ultimasLineas(r.texto));
      }
    }
    p.fase = 'listo';
    p.resultado = 'rehecho';
    est.rehechoEnRonda = rondaN;
    est.visto = { pendiente: true, ronda: rondaN, fecha: ahora() }; // el clip es otro: falta mirarlo
    anotar();
  }
  return null;
}

/**
 * Como quedo cada B-roll, de sus estados ({ n: { historial, visto } }):
 *   rehechos   [{ n, motivo, veces }] los que se rehicieron y quedaron bien (o no se pudieron volver a mirar)
 *   quedanMal  [{ n, motivo, veces, como }] los que la ultima mirada vio mal y no se arreglaron: como 'tope' (se
 *              rehizo las veces que se puede) o 'no-se-pudo' (la app intento hacerlo de nuevo y no salio)
 */
export function resumenDeBroll(estados = {}) {
  const rehechos = [];
  const quedanMal = [];
  for (const [k, e] of Object.entries(estados || {})) {
    const n = Number(k);
    if (!Number.isInteger(n) || !e) continue;
    const hist = Array.isArray(e.historial) ? e.historial : [];
    const veces = hist.filter((x) => x.resultado === 'rehecho').length;
    const ultimo = hist[hist.length - 1];
    if (e.visto?.mal && ultimo?.resultado !== 'no-entra') {
      quedanMal.push({ n, motivo: e.visto.motivo || ultimo?.motivo || null, veces, como: ultimo?.resultado === 'no-se-pudo' ? 'no-se-pudo' : 'tope' });
    } else if (veces) rehechos.push({ n, motivo: [...hist].reverse().find((x) => x.resultado === 'rehecho')?.motivo || null, veces });
  }
  const orden = (a, b) => a.n - b.n;
  return { rehechos: rehechos.sort(orden), quedanMal: quedanMal.sort(orden) };
}

/** El texto del informe para los B-roll que quedaron mal (los de resumenDeBroll().quedanMal), en palabras sencillas. */
export function detalleDeBrollMal(quedanMal, tope = TOPE_BROLL) {
  const uno = quedanMal.length === 1;
  const hasta = tope === 1 ? 'una vez' : `hasta ${tope} veces`;
  const mirar = uno ? 'Míralo: si te molesta, rehazlo o quítalo desde el editor.' : 'Míralos: si te molestan, rehazlos o quítalos desde el editor.';
  const noSePudo = quedanMal.filter((x) => x.como === 'no-se-pudo').length;
  if (noSePudo === quedanMal.length) return uno ? `La IA lo vio mal, pero la app no pudo hacerlo de nuevo. ${mirar}` : `La IA los vio mal, pero la app no pudo hacerlos de nuevo. ${mirar}`;
  if (!noSePudo) return uno ? `La IA lo vio mal y la app no lo pudo arreglar sola (se rehace ${hasta}). ${mirar}` : `La IA los vio mal y la app no los pudo arreglar sola (cada uno se rehace ${hasta}). ${mirar}`;
  return `La IA los vio mal y la app no los pudo arreglar sola: ${noSePudo === 1 ? 'uno no se pudo hacer de nuevo' : `${noSePudo} no se pudieron hacer de nuevo`} y ${quedanMal.length - noSePudo === 1 ? 'otro siguió igual' : 'los otros siguieron igual'} después de rehacerse ${hasta}. ${mirar}`;
}

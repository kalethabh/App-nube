// Estima lo que cuesta generar los videos de un anuncio, antes de gastar nada.
// Lo usa generar-videos.js en la Fase 2.3 para la pantalla de confirmacion.
//
//   node produccion/estimar-video.js temp/mi-anuncio
//   node produccion/estimar-video.js temp/mi-anuncio --resolucion 1080p
//   node produccion/estimar-video.js temp/mi-anuncio --comparar

import { modoSinCobro } from './clips-sin-cobro.js';
import fs from 'node:fs';
import path from 'node:path';
import {
  MODELOS,
  MODELOS_VIDEO,
  RESOLUCION_VIDEO,
  PRECIOS,
  KIE,
  ESTILOS_HABLADOS,
  MODELO_VIDEO_BROLL_POR_ESTILO,
  SONIDO_BROLL_POR_ESTILO,
  MODELO_VIDEO_UGC,
  creditosAUsd,
  creditosClip,
  resolucionPara,
} from './config.js';
import { tieneContinuidad, cadenaDeClips, proponerDuraciones } from './continuidad.js';
import { brollQueEntran, brollQueEntranEnCarpeta } from './planear-montaje.js';
import { ELECCION_POR_DEFECTO, leerEleccion, cascadaDelTrabajo, cascadaVideo, modeloDeCadena, modeloParaClip, usaReferencias } from './modelos-elegidos.js';

/**
 * Lista plana de clips: cada toma y cada B-roll es un clip.
 *
 * Con continuidad, la cadena (cadenaDeClips): un paso por toma salvo la
 * ultima, el propio de cada B y el cierre, sin B-roll. Lo que todavia no esta
 * escrito se estima (con `tiempos`, lo que propondria --duraciones; sin
 * tiempos, la duracion de cada toma) y va con estimado: true.
 *
 * En los estilos hablados (podcast, entrevista; ESTILOS_HABLADOS) el B-roll
 * no se genera con el modelo principal sino con el de
 * MODELO_VIDEO_BROLL_POR_ESTILO (Kling, por segundo, sin audio): ese clip
 * lleva su `modelo` y `sonido: false`. Los demas estilos no traen ese campo y
 * se estiman como siempre.
 *
 * Con `eleccion` (los modelos del anuncio, modelos-elegidos.js) TODOS los
 * clips llevan su `modelo`: el primero de la cascada de su categoria que lo
 * puede hacer (PixVerse solo si el clip tiene imagen final, Grok v1 solo por
 * referencias). Con la eleccion de siempre salen los mismos modelos que sin
 * ella: Omni para las tomas y los bloques R, Kling mudo para el B-roll hablado.
 *
 * `reglaBroll` (opcional): lo que dijo brollQueEntran(EnCarpeta) para este
 * anuncio. Sin ella sale de `tiempos`. Los comandos la pasan con la carpeta
 * (brollQueEntranEnCarpeta), la misma que usan generar-imagenes y
 * generar-videos para decidir que piden: asi el estimado y lo que se pide no
 * se separan (por ejemplo con audio/tiempos.json de una voz que ya no esta).
 */
export function clipsDe(manifiesto, { tiempos = null, reglaBroll = null, eleccion = null } = {}) {
  if (tieneContinuidad(manifiesto)) {
    const cascada = eleccion ? cascadaVideo(eleccion, 'vozEnOff') : null;
    const deSiempre = cascadaVideo(ELECCION_POR_DEFECTO, 'vozEnOff');
    return cadenaDeClips(manifiesto, { estimar: true, tiempos, ...(eleccion ? { modelo: modeloDeCadena(eleccion) } : {}) }).map((c) => ({
      id: c.id,
      segundos: c.segundos,
      tipo: c.rol === 'paso' ? 'paso' : c.tipoToma,
      rol: c.rol,
      ...(cascada ? { modelo: modeloParaClip(cascada, { frameFinal: Boolean(c.imagenFinal) }, c.segundos, { deSiempre }) } : {}),
      ...(c.estimado ? { estimado: true } : {}),
    }));
  }
  const hablado = ESTILOS_HABLADOS.includes(manifiesto.estilo);
  const modeloBroll = hablado ? MODELO_VIDEO_BROLL_POR_ESTILO[manifiesto.estilo] : null;
  const sonidoBroll = hablado && typeof SONIDO_BROLL_POR_ESTILO[manifiesto.estilo] === 'boolean' ? SONIDO_BROLL_POR_ESTILO[manifiesto.estilo] : undefined;
  // El modelo de un clip con la eleccion del anuncio (ver arriba): el mismo
  // que elige generar-videos, mirando tambien el tope de duracion de cada
  // modelo (modeloParaClip).
  const modeloElegido = (clip) =>
    modeloParaClip(
      cascadaDelTrabajo(eleccion, manifiesto, clip),
      { referencias: usaReferencias(clip), frameFinal: clip.tipo === 'B' },
      clip.segundos,
      { deSiempre: cascadaDelTrabajo(ELECCION_POR_DEFECTO, manifiesto, clip) }
    );
  // Voz en off y musica con los tiempos de la voz: el B-roll que no entra en el
  // video no se pide (brollQueEntran, la regla del montaje), asi que no se
  // cuenta. Sin tiempos, o en otro tipo de anuncio, va todo: es un maximo.
  const regla = reglaBroll ?? (tiempos ? brollQueEntran(manifiesto, tiempos) : { aplica: false });
  const fuera = new Set(regla.aplica ? regla.fuera.map((f) => f.n) : []);
  const clips = [];
  // Los quietos y los de la biblioteca de clips no se le pagan al generador
  // (clips-sin-cobro.js): no entran en la estimacion.
  for (const t of manifiesto.tomas || []) {
    if (t.tipo !== 'R' && t.tipo !== 'H' && modoSinCobro(t)) continue;
    const clip = { id: `toma-${t.n}`, segundos: t.duracion, tipo: t.tipo };
    if (eleccion) clip.modelo = modeloElegido({ ...clip, ...(Array.isArray(t.ingredientes) ? { ingredientes: t.ingredientes } : {}) });
    clips.push(clip);
  }
  for (const b of manifiesto.broll || []) {
    if (fuera.has(b.n)) continue;
    if (modoSinCobro(b)) continue;
    const clip = {
      id: `broll-${b.n}`,
      segundos: b.duracion,
      tipo: 'broll',
      ...(modeloBroll ? { modelo: modeloBroll } : {}),
      ...(sonidoBroll !== undefined ? { sonido: sonidoBroll } : {}),
    };
    if (eleccion) clip.modelo = modeloElegido({ ...clip, clase: 'broll' });
    clips.push(clip);
  }
  return clips;
}

/**
 * El costo de los videos. `eleccion` (los modelos del anuncio; leerEleccion de
 * su carpeta) pone el modelo de cada clip; sin ella ni `modelo`, la eleccion
 * de siempre. Con `modelo` explicito (la comparacion con el respaldo de
 * --comparar) todos los clips van con ese, salvo el B-roll hablado.
 */
export function estimar(manifiesto, { modelo = null, resolucion = RESOLUCION_VIDEO, tiempos = null, reglaBroll: regla = null, eleccion = null } = {}) {
  const conEleccion = modelo ? null : eleccion ?? ELECCION_POR_DEFECTO;
  const modeloBase = modelo ?? MODELOS.video.principal;
  // Lo que la regla del B-roll dice para este anuncio: la que se pasa (la de la
  // carpeta) o, sin ella, la de estos tiempos (sin tiempos: no decide).
  const reglaBroll = regla ?? brollQueEntran(manifiesto, tiempos);
  const clips = clipsDe(manifiesto, { tiempos, reglaBroll, eleccion: conEleccion });
  // Lo que costarian los B-roll que no entran, si se pidieran (no estan en `creditos`).
  const modeloBrollFuera = (segundos) =>
    conEleccion
      ? modeloParaClip(cascadaDelTrabajo(conEleccion, manifiesto, { clase: 'broll' }), {}, segundos, {
          deSiempre: cascadaDelTrabajo(ELECCION_POR_DEFECTO, manifiesto, { clase: 'broll' }),
        })
      : modeloBase;
  const brollQueNoEntra = (reglaBroll.aplica ? reglaBroll.fuera : []).map((f) => {
    const b = manifiesto.broll.find((x) => x.n === f.n);
    return { ...f, segundos: b?.duracion, creditos: creditosClip(modeloBrollFuera(b?.duracion), b?.duracion, resolucion).creditos ?? 0 };
  });
  const detalle = [];
  let creditos = 0;
  let segundosPedidos = 0;
  let segundosUtiles = 0;
  const excedidos = [];

  for (const c of clips) {
    // Un clip con modelo propio se cobra con ese modelo (y sin audio si va
    // mudo); el resto, con el de la estimacion.
    // (una toma B y un paso llevan imagen final: Omni 1.2 los hace hasta 10 s)
    const conFinal = c.tipo === 'B' || c.tipo === 'paso';
    const r = creditosClip(c.modelo ?? modeloBase, c.segundos, resolucion, { ...(typeof c.sonido === 'boolean' ? { sonido: c.sonido } : {}), conFinal });
    if (r.excedeTope) {
      excedidos.push(c);
      continue;
    }
    creditos = Math.round((creditos + r.creditos) * 100) / 100;
    segundosPedidos += r.duracion;
    segundosUtiles += c.segundos;
    detalle.push({ ...c, ...r });
  }

  // El modelo "de la estimacion": el de la mayoria de las tomas (el que se
  // muestra arriba); los demas van en su tabla.
  const cuenta = new Map();
  for (const d of detalle) if (!String(d.id).startsWith('broll-') || !ESTILOS_HABLADOS.includes(manifiesto.estilo)) cuenta.set(d.modelo ?? modeloBase, (cuenta.get(d.modelo ?? modeloBase) || 0) + 1);
  const modeloMostrado = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? modeloBase;
  const res = resolucionPara(modeloMostrado, resolucion);
  return {
    modelo: modeloMostrado,
    resolucionPedida: resolucion,
    resolucionReal: res.nombre,
    resolucionApi: res.api,
    resolucionExacta: res.exacta,
    clips: detalle.length,
    creditos,
    usd: creditosAUsd(creditos),
    segundosPedidos,
    segundosUtiles,
    excedidos,
    detalle,
    // Voz en off y musica: la regla del B-roll (brollQueEntran) y los que no
    // entran, que no se cuentan arriba. Sin tiempos, reglaBroll.aplica es false.
    reglaBroll,
    brollQueNoEntra,
    // Solo con continuidad: si algun clip de la cadena salio estimado.
    ...(tieneContinuidad(manifiesto) ? { estimado: clips.some((c) => c.estimado) } : {}),
  };
}

if (process.argv[1] && process.argv[1].endsWith('estimar-video.js')) {
  const args = process.argv.slice(2);
  const carpetaArg = args.find((a) => !a.startsWith('--'));
  const i = args.indexOf('--resolucion');
  const resolucion = i !== -1 && args[i + 1] ? args[i + 1] : RESOLUCION_VIDEO;
  const comparar = args.includes('--comparar');

  if (!carpetaArg) {
    console.error('\n  Uso: node produccion/estimar-video.js <carpeta-del-anuncio> [--resolucion 720p] [--comparar]\n');
    process.exit(1);
  }

  const rutaManifiesto = path.join(path.resolve(carpetaArg), 'manifiesto.json');
  if (!fs.existsSync(rutaManifiesto)) {
    console.error(`\n  No encuentro el manifiesto: ${rutaManifiesto}\n`);
    process.exit(1);
  }
  const m = JSON.parse(fs.readFileSync(rutaManifiesto, 'utf8'));

  // Con continuidad, lo que falta por escribir se estima con los tiempos
  // reales de la voz, si ya estan.
  const conContinuidad = tieneContinuidad(m);
  // Los modelos de ESTE anuncio (temp/<slug>/modelos.json); sin el, los de siempre.
  const eleccion = leerEleccion(path.resolve(carpetaArg));
  let tiempos = null;
  if (conContinuidad) {
    try {
      const rutaTiempos = path.join(path.resolve(carpetaArg), 'audio', 'tiempos.json');
      if (fs.existsSync(rutaTiempos)) tiempos = JSON.parse(fs.readFileSync(rutaTiempos, 'utf8'));
      // Unos tiempos que no van 1 a 1 con las tomas no sirven para estimar:
      // cadenaDeClips estima entonces con la duracion de cada toma.
      if (tiempos) proponerDuraciones(m, tiempos, { modelo: modeloDeCadena(eleccion) });
    } catch {
      tiempos = null;
    }
  }
  // Voz en off y musica: con la voz hecha no se cuenta el B-roll que no entra en
  // el video (no se pide). La regla con la carpeta, la misma de generar-imagenes
  // y generar-videos: unos tiempos ilegibles, o los de una voz que ya no esta
  // (falta audio/voz.mp3), no deciden nada y el numero es un maximo.
  const reglaBroll = conContinuidad ? null : brollQueEntranEnCarpeta(m, path.resolve(carpetaArg));

  const e = estimar(m, { resolucion, tiempos, reglaBroll, eleccion });

  console.log(`\n=== Costo de los videos — ${path.basename(path.resolve(carpetaArg))} ===\n`);
  console.log(`  Modelo:      ${e.modelo}`);
  console.log(`  Resolucion:  ${e.resolucionReal}${e.resolucionExacta ? '' : `  (el modelo no ofrece ${e.resolucionPedida}; se usa la mas cercana)`}`);
  if (conContinuidad) {
    const n = (rol) => e.detalle.filter((d) => d.rol === rol).length;
    const pasos = n('paso');
    const propios = n('propio');
    console.log(
      `  Clips:       ${e.clips} (${pasos} paso${pasos === 1 ? '' : 's'} + ${propios} propio${propios === 1 ? '' : 's'} B + ${n('cierre')} cierre), con continuidad: sin B-roll`
    );
    if (e.estimado) {
      console.log(
        tiempos
          ? '               (estimado: lo que falta por escribir se calculo con los tiempos de la voz, como lo haria --duraciones)'
          : '               (estimado: lo que falta por escribir se calculo con la duracion de cada toma; se fija despues de imagenes y audio)'
      );
    }
    console.log('');
  } else {
    console.log(`  Clips:       ${e.clips}\n`);
    // Voz en off y musica: el B-roll que no entra en el video no se pide, y no
    // se cuenta; sin los tiempos de la voz el numero es un maximo.
    const nBroll = (m.broll || []).length;
    if (e.brollQueNoEntra.length) {
      const cr = e.brollQueNoEntra.reduce((s, f) => s + f.creditos, 0);
      console.log(`  B-roll:      ${nBroll - e.brollQueNoEntra.length} de ${nBroll}. Los otros ${e.brollQueNoEntra.length} no entran en el video con esta voz y no se piden (${cr} creditos menos):`);
      for (const f of e.brollQueNoEntra) console.log(`               ${f.aviso}`);
      console.log('');
    } else if (nBroll && !e.reglaBroll.aplica && (e.reglaBroll.sinTiempos || e.reglaBroll.tiemposQueNoSirven)) {
      console.log(`  B-roll:      cuenta los ${nBroll}: es un MAXIMO (${e.reglaBroll.motivo}).`);
      console.log('               Con la voz hecha se piden solo los que entran en el video.\n');
    }
  }

  const hablado = ESTILOS_HABLADOS.includes(m.estilo);
  // Una fila por largo, con lo que cuesta cada clip de verdad (creditosClip:
  // por tramo en Omni, por segundo en los demas, sin audio si va mudo).
  const fila = (tramo, n, cu) =>
    console.log(`   ${String(tramo).padStart(2)}s     ${String(n).padStart(3)}      ${String(cu).padStart(4)}        ${String(Math.round(n * cu * 100) / 100).padStart(5)}`);
  const porModelo = new Map(); // modelo -> Map(duracion -> { n, cu, broll })
  for (const d of e.detalle) {
    const modelo = d.modelo ?? e.modelo;
    if (!porModelo.has(modelo)) porModelo.set(modelo, new Map());
    const tramos = porModelo.get(modelo);
    // "sin audio" solo si el modelo tiene interruptor de audio (Kling): Omni o Grok salen con el suyo.
    const x = tramos.get(d.duracion) || { n: 0, cu: d.creditos, broll: d.tipo === 'broll', mudo: d.sonido === false && Boolean(MODELOS_VIDEO[modelo]?.audio?.campo) };
    x.n++;
    tramos.set(d.duracion, x);
  }
  if (hablado || porModelo.size > 1) {
    // Estilo hablado (las tomas H con su modelo y el B-roll con el suyo), o
    // modelos elegidos que reparten los clips: una tabla por modelo.
    for (const [modelo, tramos] of porModelo) {
      const res = resolucionPara(modelo, e.resolucionPedida).nombre;
      const xs = [...tramos.values()];
      const etiqueta = hablado
        ? xs.every((x) => x.broll)
          ? `B-roll${xs.some((x) => x.mudo) ? ', sin audio' : ''}`
          : xs.some((x) => x.broll)
            ? 'tomas habladas (H) y B-roll'
            : 'tomas habladas (H)'
        : conContinuidad
          ? 'clips de la cadena'
          : 'clips';
      console.log(`  ${modelo} a ${res} — ${etiqueta}`);
      console.log('  Tramo   clips   creditos c/u   subtotal');
      for (const tramo of [...tramos.keys()].sort((a, b) => a - b)) fila(tramo, tramos.get(tramo).n, tramos.get(tramo).cu);
      console.log('');
    }
  } else {
    // Cuantos clips caen en cada tramo de duracion
    console.log('  Tramo   clips   creditos c/u   subtotal');
    for (const [, tramos] of porModelo) {
      for (const tramo of [...tramos.keys()].sort((a, b) => a - b)) fila(tramo, tramos.get(tramo).n, tramos.get(tramo).cu);
    }
  }

  console.log(`${hablado || porModelo.size > 1 ? '' : '\n'}  TOTAL:  ${e.creditos} creditos = US$${e.usd.toFixed(2)}`);
  console.log(`  Metraje: se pagan ${e.segundosPedidos}s para cubrir ${e.segundosUtiles.toFixed(1)}s utiles`);

  if (e.excedidos.length) {
    console.log(`\n  ATENCION: ${e.excedidos.length} clip(s) pasan del tope del modelo y hay que dividirlos:`);
    for (const c of e.excedidos) console.log(`      ${c.id} (${c.segundos}s)`);
  }

  if (comparar) {
    console.log('\n  --- comparacion de resoluciones ---');
    for (const r of Object.keys(MODELOS_VIDEO[e.modelo].resoluciones)) {
      const alt = estimar(m, { resolucion: r, tiempos, reglaBroll, eleccion });
      const marca = r.toLowerCase() === e.resolucionReal.toLowerCase() ? '  <- elegida' : '';
      console.log(`    ${r.padEnd(7)} ${String(alt.creditos).padStart(5)} creditos = US$${alt.usd.toFixed(2)}${marca}`);
    }
    if (hablado) {
      // Las tomas H no tienen respaldo (Kling no genera dialogo): si Omni
      // falla, se reintenta o se reescribe el copy de esa toma.
      console.log('\n  --- respaldo ---');
      console.log(`    las tomas habladas (H) no tienen modelo de respaldo: solo ${e.modelo}`);
    } else {
      console.log('\n  --- respaldo ---');
      const resp = estimar(m, { modelo: MODELOS.video.respaldo, resolucion, tiempos, reglaBroll });
      console.log(`    ${resp.modelo} a ${resp.resolucionReal}: ${resp.creditos} creditos = US$${resp.usd.toFixed(2)}`);
      console.log('    (solo se paga por los clips que fallen con el principal)');
    }
  }

  console.log(`\n  Precios consultados el ${PRECIOS.consultado} en ${KIE.precios}\n`);
}

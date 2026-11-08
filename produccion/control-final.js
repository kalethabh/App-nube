// CONTROL FINAL — mide los MP4 terminados de un anuncio antes de entregarlo (ESTADO-ACTUAL 5.10).
//
//   node produccion/control-final.js temp/mi-anuncio
//
// Sale con 0 si todo esta limpio, 1 si encontro algun defecto y 2 si no pudo medir (falta ffmpeg, falta
// el plan, no hay ninguna version, o un control fallo: una medicion sin control no verifica nada, 5.9).
// El detalle queda en <carpeta>/qa/control-final.json. No genera ni cobra nada: solo ffmpeg sobre los
// archivos del anuncio. Renderizar otra vez tampoco cobra: si esto encuentra algo, se puede re-renderizar.
//
// Que mide, en cada version de output/<slug>_9x16_*.mp4:
//
//   1. Fotogramas NEGROS: signalstats, YAVG < 5. Antes de darlo por negro se compara contra el clip
//      fuente (5.10.1): un anuncio que abre de noche puede dar un luma bajo legitimo. Lo que distingue un
//      agujero es que el clip fuente sea brillante y la salida no (en skeleton: fuente 81.7, salida 2.9).
//      Un negro donde el plan no tiene ninguna pieza es un agujero de la linea de tiempo (2.13).
//
//   2. Tramos CONGELADOS: freezedetect=n=0.003:d=1.2 (5.10.2b). Un clip corto no deja negro: congela, y
//      el fotograma repetido tiene luma normal. Antes de confiar en su silencio se valida el filtro con
//      un control: un video fabricado con un congelado a proposito tiene que detectarse, y uno que se
//      mueve, no. Un congelado se compara tambien contra su clip fuente: si la pieza ya pedia mas tiempo
//      del que el clip tiene, es el defecto de siempre (el clip no alcanzo su ventana); si el clip
//      original esta quieto en ese tramo, no es del montaje y va como aviso.
//
//   3. La version SIN MUSICA de verdad la apaga (5.10.3), restando las senales y no comparando tamanos
//      ni mean_volume. Sobre fuentes estereo se cruzan los canales de los dos archivos (c0-c2, c1-c3),
//      NO los del primero (eso mide el ancho estereo de uno solo). Control: restar un archivo contra si
//      mismo tiene que dar ~-91 dB; si no, el filtro esta mal escrito y no se sigue.
//        con-subtitulos  - sin-subtitulos-sin-musica   tiene que quedar la musica (bien por encima de -70 dB)
//        solo-subtitulos - sin-subtitulos-sin-musica   tiene que quedar nada (por debajo de -70 dB)
//      Las tres salen del mismo plan y del mismo render de audio de Remotion: estan alineadas al sample.
//
//   4. Que esten las versiones que tocan (tres con musica; dos en musical y en los estilos sin musica) y
//      que sean de ESTE montaje: mas nuevas que plan-montaje.json (5.10.4, "los recien generados").
//      Si el ultimo render fue solo de la completa (ensamblar.js --solo-completa, lo que hace la app: deja
//      qa/versiones.json), toca solo esa, y se mide solo lo que hizo ese render. La 3 no se mide (no hay
//      version sin musica: sale del editor).
//
//   5. Que cada clip alcance a cubrir su momento: el largo REAL de cada clip (ffprobe), desde donde se
//      empieza a usar y a la velocidad que va, contra lo que el plan le pide. Un clip que se acaba antes
//      deja el ultimo cuadro sostenido. freezedetect no siempre lo ve: medido el 2026-10-25 con un clip de
//      1 s en una ventana de 2,5 s, el render de Remotion no repite el cuadro identico (YDIF ~0,1 entre
//      cuadros) y n=0.003 no salta; esta cuenta si.
//
// Cada defecto dice si renderizar otra vez lo puede arreglar ("rerender"): un negro o un congelado con el
// clip fuente bien es del render; un clip que no alcanza su momento no se arregla renderizando.
//
// La duracion real se anota, no se corrige (5.10.5): no es un defecto.

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DIR_OUTPUT, ESTILOS_SIN_MUSICA } from './config.js';

export const UMBRALES = {
  yavgNegro: 5, // 5.9: "filtrando los fotogramas con YAVG < 5"
  yavgFuenteOscura: 10, // el clip fuente tambien es oscuro ahi: no es un agujero
  freeze: 'freezedetect=n=0.003:d=1.2', // 5.10.2b, tal cual
  restaControlDb: -85, // restarse a si mismo da ~-91 dB
  musicaPresenteDb: -70, // la diferencia con musica queda muy por encima; sin musica, en ~-91
};

const TIPOS = ['con-subtitulos', 'solo-subtitulos', 'sin-subtitulos', 'sin-subtitulos-sin-musica'];
const r3 = (x) => Math.round(Number(x) * 1000) / 1000;
const r1 = (x) => Math.round(Number(x) * 10) / 10;

// ---------------------------------------------------------------- ffmpeg

function correr(bin, args) {
  return new Promise((resolve) => {
    const out = [];
    const err = [];
    let p;
    try {
      p = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    } catch (e) {
      return resolve({ codigo: -1, out: '', err: e.message });
    }
    p.stdout.on('data', (d) => out.push(d));
    p.stderr.on('data', (d) => err.push(d));
    p.on('error', (e) => resolve({ codigo: -1, out: '', err: e.message }));
    p.on('close', (codigo) => resolve({ codigo, out: Buffer.concat(out).toString('utf8'), err: Buffer.concat(err).toString('utf8') }));
  });
}

const ffmpeg = (args) => correr('ffmpeg', ['-hide_banner', '-nostats', ...args]);

async function sonda(ruta) {
  const r = await correr('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,avg_frame_rate,channels:format=duration', '-of', 'json', ruta]);
  if (r.codigo !== 0) return null;
  try {
    const j = JSON.parse(r.out);
    const v = (j.streams || []).find((s) => s.codec_type === 'video');
    const a = (j.streams || []).find((s) => s.codec_type === 'audio');
    const [n, d] = String(v?.avg_frame_rate || '24/1').split('/').map(Number);
    return { duracion: Number(j.format?.duration) || 0, fps: d ? n / d : n || 24, canales: a ? Number(a.channels) || 0 : 0, conAudio: Boolean(a) };
  } catch {
    return null;
  }
}

/** Lo que imprime freezedetect en stderr: [{ desde, hasta|null, duracion|null }] (sin repetidos). */
export function leerCongelados(stderr) {
  const tramos = [];
  for (const linea of String(stderr).split(/\r?\n/)) {
    const ini = linea.match(/lavfi\.freezedetect\.freeze_start:\s*([\d.]+)/);
    if (ini) {
      const desde = Number(ini[1]);
      if (!tramos.some((t) => Math.abs(t.desde - desde) < 1e-6)) tramos.push({ desde, hasta: null, duracion: null });
      continue;
    }
    const dur = linea.match(/lavfi\.freezedetect\.freeze_duration:\s*([\d.]+)/);
    const ultimo = tramos[tramos.length - 1];
    if (dur && ultimo && ultimo.duracion === null) ultimo.duracion = Number(dur[1]);
    const fin = linea.match(/lavfi\.freezedetect\.freeze_end:\s*([\d.]+)/);
    if (fin && ultimo && ultimo.hasta === null) ultimo.hasta = Number(fin[1]);
  }
  return tramos;
}

/** Lo que imprime metadata=print de signalstats: [{ t, yavg }]. */
export function leerYavg(stdout) {
  const cuadros = [];
  let t = null;
  for (const linea of String(stdout).split(/\r?\n/)) {
    const m = linea.match(/pts_time:([-\d.]+)/);
    if (m) {
      t = Number(m[1]);
      continue;
    }
    const y = linea.match(/lavfi\.signalstats\.YAVG=([-\d.]+)/);
    if (y && t !== null) cuadros.push({ t, yavg: Number(y[1]) });
  }
  return cuadros;
}

/** Los cuadros oscuros, juntados en tramos seguidos. */
export function tramosOscuros(cuadros, fps, umbral = UMBRALES.yavgNegro) {
  const paso = 1 / (fps || 24);
  const tramos = [];
  for (const c of cuadros) {
    if (!(c.yavg < umbral)) continue;
    const ult = tramos[tramos.length - 1];
    if (ult && c.t - ult.ultimo <= paso * 1.6) {
      ult.ultimo = c.t;
      ult.cuadros++;
      ult.yavgMin = Math.min(ult.yavgMin, c.yavg);
    } else tramos.push({ desde: c.t, ultimo: c.t, cuadros: 1, yavgMin: c.yavg });
  }
  return tramos.map((x) => ({ desde: r3(x.desde), hasta: r3(x.ultimo + paso), cuadros: x.cuadros, yavgMin: r1(x.yavgMin) }));
}

/** Una pasada por archivo: freezedetect y signalstats juntos. */
async function medirVideo(ruta, fps) {
  const r = await ffmpeg(['-i', ruta, '-map', '0:v:0', '-vf', `${UMBRALES.freeze},signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG:file=-`, '-f', 'null', '-']);
  if (r.codigo !== 0) return { error: r.err.trim().split(/\r?\n/).slice(-3).join(' ') || `ffmpeg salio con ${r.codigo}` };
  const cuadros = leerYavg(r.out);
  return { cuadros: cuadros.length, negros: tramosOscuros(cuadros, fps), congelados: leerCongelados(r.err) };
}

/** YAVG de un cuadro del clip fuente en el segundo `t` (null si no se pudo, o si `t` cae fuera del clip). */
async function yavgEn(ruta, t) {
  const r = await ffmpeg(['-ss', String(Math.max(0, t)), '-i', ruta, '-frames:v', '1', '-vf', 'signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-']);
  if (r.codigo !== 0) return null;
  return leerYavg(r.out)[0]?.yavg ?? null;
}

/** ¿El clip fuente esta quieto entre desde y hasta? */
async function quietoEnLaFuente(ruta, desde, hasta) {
  const dur = Math.max(0.2, hasta - desde);
  const d = Math.max(0.4, r3(dur * 0.8));
  const r = await ffmpeg(['-ss', String(Math.max(0, desde)), '-t', String(dur), '-i', ruta, '-map', '0:v:0', '-vf', `freezedetect=n=0.003:d=${d}`, '-f', 'null', '-']);
  if (r.codigo !== 0) return null;
  return leerCongelados(r.err).length > 0;
}

/**
 * Resta dos audios muestra a muestra y devuelve { mean, max } en dB (volumedetect). Estereo contra estereo:
 * cruzando los canales de los dos archivos (c0-c2, c1-c3), como pide 5.10.3. Si alguno no es estereo, cada
 * uno se baja a mono antes de restar (sigue siendo la diferencia entre los dos, no el ancho de uno).
 */
async function restar(a, b, canalesA, canalesB) {
  const filtro =
    canalesA === 2 && canalesB === 2
      ? '[0:a][1:a]amerge=inputs=2,pan=stereo|c0=c0-c2|c1=c1-c3,volumedetect'
      : '[0:a]aformat=channel_layouts=mono[x];[1:a]aformat=channel_layouts=mono[y];[x][y]amerge=inputs=2,pan=mono|c0=c0-c1,volumedetect';
  const r = await ffmpeg(['-i', a, '-i', b, '-filter_complex', filtro, '-f', 'null', '-']);
  if (r.codigo !== 0) return null;
  const mean = r.err.match(/mean_volume:\s*(-?[\d.]+|-inf) dB/);
  const max = r.err.match(/max_volume:\s*(-?[\d.]+|-inf) dB/);
  if (!mean) return null;
  const num = (m) => (m[1] === '-inf' ? -91 : Number(m[1]));
  return { mean: num(mean), max: max ? num(max) : null };
}

// ---------------------------------------------------------------- los controles

/** Un congelado fabricado se detecta y un video que se mueve no; un tramo negro fabricado aparece donde va. */
async function controles() {
  const fuente =
    'testsrc=d=1:s=160x120:r=24,format=yuv420p[a];' +
    'color=c=black:s=160x120:r=24:d=1,format=yuv420p,lutyuv=y=0[b];' +
    'testsrc=d=1:s=160x120:r=24,format=yuv420p,tpad=stop_mode=clone:stop_duration=2[c];' +
    '[a][b][c]concat=n=3:v=1:a=0[out0]';
  const r = await ffmpeg(['-f', 'lavfi', '-i', fuente, '-vf', `${UMBRALES.freeze},signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG:file=-`, '-f', 'null', '-']);
  if (r.codigo !== 0) return { ok: false, motivo: `ffmpeg no pudo correr el control (${r.err.trim().split(/\r?\n/).pop() || r.codigo})` };
  const congelados = leerCongelados(r.err);
  const negros = tramosOscuros(leerYavg(r.out), 24);
  // El congelado fabricado empieza en el ultimo cuadro del tercer tramo (~2.96 s) y llega al final.
  const okCongelado = congelados.length === 1 && congelados[0].desde > 2.5 && congelados[0].desde < 3.1;
  const okNegro = negros.length === 1 && Math.abs(negros[0].desde - 1) < 0.05 && Math.abs(negros[0].hasta - 2) < 0.1;

  const quieto = await ffmpeg(['-f', 'lavfi', '-i', 'testsrc=d=3:s=160x120:r=24', '-vf', UMBRALES.freeze, '-f', 'null', '-']);
  const okMovimiento = quieto.codigo === 0 && leerCongelados(quieto.err).length === 0;

  const motivos = [];
  if (!okCongelado) motivos.push(`el congelado fabricado no se detecto bien (${JSON.stringify(congelados)})`);
  if (!okMovimiento) motivos.push('un video que se mueve dio congelado');
  if (!okNegro) motivos.push(`el tramo negro fabricado no aparecio entre 1 y 2 s (${JSON.stringify(negros)})`);
  return { ok: motivos.length === 0, motivo: motivos.join('; ') || null, congelado: okCongelado, movimiento: okMovimiento, negro: okNegro };
}

// ---------------------------------------------------------------- el plan: que pieza hay en cada segundo

/** Las piezas de video del plan: [{ archivo, desde, hasta, velocidad, recorteInicio, capa, etiqueta }]. */
export function piezasDelPlan(plan) {
  const piezas = [];
  const etiqueta = (archivo) => String(archivo || '').replace(/\.mp4$/i, '').replace(/^broll-/, 'B-roll ').replace(/^toma-/, 'toma ').replace(/^paso-/, 'paso ');
  if (Array.isArray(plan?.escena?.piezas)) {
    for (const p of plan.escena.piezas) {
      if (p?.tipo !== 'clip' || !p.archivo) continue;
      piezas.push({ archivo: p.archivo, desde: Number(p.desde) || 0, hasta: (Number(p.desde) || 0) + (Number(p.duracion) || 0), velocidad: Number(p.velocidad) || 1, recorteInicio: Number(p.recorteInicio) || 0, capa: Number(p.capa) || 0, etiqueta: etiqueta(p.archivo) });
    }
    return piezas;
  }
  if (Array.isArray(plan?.continuidad?.clips)) {
    for (const c of plan.continuidad.clips) {
      if (!c?.archivo) continue;
      piezas.push({ archivo: c.archivo, desde: Number(c.desde) || 0, hasta: Number(c.hasta) || 0, velocidad: Number(c.velocidad) || 1, recorteInicio: 0, capa: 0, etiqueta: etiqueta(c.archivo) });
    }
    return piezas;
  }
  for (const b of Array.isArray(plan?.bloques) ? plan.bloques : []) {
    for (const [x, capa] of [
      [b.toma, 0],
      [b.broll, 1],
    ]) {
      if (!x?.archivo) continue;
      const desde = Number(x.desde ?? b.inicio) || 0;
      piezas.push({ archivo: x.archivo, desde, hasta: desde + (Number(x.duracion) || 0), velocidad: Number(x.velocidad) || 1, recorteInicio: Number(x.recorteInicio) || 0, capa, etiqueta: etiqueta(x.archivo) });
    }
  }
  return piezas;
}

/** La pieza que se ve en el segundo t (la de arriba si se enciman). */
export function piezaEn(piezas, t) {
  return piezas.filter((p) => t >= p.desde - 1e-3 && t < p.hasta - 1e-3).sort((a, b) => b.capa - a.capa)[0] || null;
}

/** Del segundo del video al segundo del clip fuente. */
const enLaFuente = (p, t) => p.recorteInicio + (t - p.desde) * p.velocidad;

// ---------------------------------------------------------------- un anuncio

function versionesEnDisco(slug) {
  let nombres = [];
  try {
    nombres = fs.readdirSync(DIR_OUTPUT);
  } catch {
    nombres = [];
  }
  const re = new RegExp(`^${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_(?:\\d+x\\d+_)?(${TIPOS.join('|')})\\.mp4$`);
  return nombres
    .map((n) => ({ n, m: n.match(re) }))
    .filter((x) => x.m)
    .map((x) => ({ tipo: x.m[1], archivo: x.n, ruta: path.join(DIR_OUTPUT, x.n) }));
}

/**
 * El registro que deja ensamblar.js --solo-completa (qa/versiones.json: { soloCompleta, versiones: [{ tipo,
 * archivo }] }), o null si el ultimo render fue el de todas las versiones (ese lo borra al empezar).
 */
export function registroSoloCompleta(carpeta) {
  try {
    const r = JSON.parse(fs.readFileSync(path.join(carpeta, 'qa', 'versiones.json'), 'utf8'));
    return r?.soloCompleta === true && Array.isArray(r.versiones) ? r : null;
  } catch {
    return null;
  }
}

/** Las versiones que tocan: todas (tres con musica; dos en musical y sin musica) o, si se pidio asi, la completa. */
export function versionesEsperadas(manifiesto, { soloCompleta = false } = {}) {
  if (soloCompleta) return ['con-subtitulos'];
  const sinMusica = manifiesto?.modo_audio === 'musica' || ESTILOS_SIN_MUSICA.includes(manifiesto?.estilo);
  return sinMusica ? ['con-subtitulos', 'sin-subtitulos'] : ['con-subtitulos', 'solo-subtitulos', 'sin-subtitulos-sin-musica'];
}

export async function controlFinal(carpeta, { log = console.log } = {}) {
  const slug = path.basename(carpeta);
  const salida = { generado: new Date().toISOString(), anuncio: slug, limpio: false, codigo: 2, controles: null, versiones: [], musica: null, defectos: [], avisos: [], noMedido: [] };
  const terminar = (codigo, motivo) => {
    salida.codigo = codigo;
    salida.limpio = codigo === 0;
    if (motivo) salida.motivo = motivo;
    // Las versiones que faltan o quedaron viejas, la musica y lo ilegible se arreglan exportando otra vez.
    for (const d of salida.defectos) if (d.rerender === undefined) d.rerender = true;
    salida.rerenderAyuda = salida.defectos.some((d) => d.rerender);
    fs.mkdirSync(path.join(carpeta, 'qa'), { recursive: true });
    const ruta = path.join(carpeta, 'qa', 'control-final.json');
    fs.writeFileSync(`${ruta}.tmp`, JSON.stringify(salida, null, 2) + '\n', 'utf8');
    fs.renameSync(`${ruta}.tmp`, ruta);
    return salida;
  };

  let plan = null;
  let manifiesto = null;
  try {
    plan = JSON.parse(fs.readFileSync(path.join(carpeta, 'plan-montaje.json'), 'utf8'));
  } catch {
    return terminar(2, 'falta plan-montaje.json (o no se puede leer): sin el plan no se sabe que pieza va en cada segundo');
  }
  try {
    manifiesto = JSON.parse(fs.readFileSync(path.join(carpeta, 'manifiesto.json'), 'utf8'));
  } catch {
    manifiesto = null;
  }
  const mtimePlan = fs.statSync(path.join(carpeta, 'plan-montaje.json')).mtimeMs;

  // (0) los controles: si el filtro no detecta lo que tiene que detectar, su silencio no vale nada
  const c = await controles();
  salida.controles = c;
  if (!c.ok) {
    log(`  !  El control de los filtros fallo: ${c.motivo}`);
    return terminar(2, `control de los filtros: ${c.motivo}`);
  }
  log('  OK  Controles: un congelado fabricado se detecta, un video que se mueve no, y un tramo negro aparece donde va.');

  // (4) que esten las versiones y que sean de este montaje. Si el ultimo render fue solo de la completa
  // (ensamblar.js --solo-completa, la app), se espera y se mide solo lo que ese render hizo: las demas se sacan
  // desde el editor, y una de un render anterior no es de lo que se entrega.
  const registro = registroSoloCompleta(carpeta);
  const esperadas = versionesEsperadas(manifiesto, { soloCompleta: Boolean(registro) });
  if (registro) {
    salida.soloCompleta = true;
    salida.versionesEsperadas = esperadas;
  }
  const deEsteRender = registro ? new Set(registro.versiones.map((v) => v?.archivo).filter(Boolean)) : null;
  const enDisco = versionesEnDisco(slug).filter((v) => !deEsteRender || deEsteRender.has(v.archivo));
  if (!enDisco.length) return terminar(2, `no hay ninguna version de ${slug} en output/`);
  for (const tipo of esperadas) {
    if (!enDisco.some((v) => v.tipo === tipo)) {
      salida.defectos.push({ tipo: 'falta-version', version: tipo, detalle: `falta la version ${tipo}` });
    }
  }

  const piezas = piezasDelPlan(plan);
  const dirVideo = path.join(carpeta, 'video');
  const largos = new Map();
  const largoDe = async (archivo) => {
    if (!largos.has(archivo)) largos.set(archivo, (await sonda(path.join(dirVideo, archivo)))?.duracion ?? null);
    return largos.get(archivo);
  };

  // (5) cada clip alcanza su momento (una vez por plan, no por version)
  for (const p of piezas) {
    const largo = await largoDe(p.archivo);
    if (largo === null) {
      salida.defectos.push({ tipo: 'falta-clip', pieza: p.etiqueta, desde: r3(p.desde), hasta: r3(p.hasta), detalle: `no encuentro el clip ${p.archivo} (o no se puede leer)`, rerender: false });
      continue;
    }
    const cubre = Math.max(0, largo - p.recorteInicio) / (p.velocidad || 1);
    const pide = p.hasta - p.desde;
    if (cubre < pide - 0.1) {
      salida.defectos.push({
        tipo: 'corto',
        pieza: p.etiqueta,
        desde: r3(p.desde + cubre),
        hasta: r3(p.hasta),
        detalle: `${p.etiqueta}: el clip se acaba ${r1(pide - cubre)} s antes de que termine su momento (desde el segundo ${r1(p.desde + cubre)} se ve quieto)`,
        rerender: false,
      });
    }
  }

  for (const v of enDisco) {
    const st = fs.statSync(v.ruta);
    const info = await sonda(v.ruta);
    const ficha = { tipo: v.tipo, archivo: v.archivo, fecha: st.mtime.toISOString(), deEsteMontaje: st.mtimeMs >= mtimePlan - 2000, duracion: info ? r3(info.duracion) : null, fps: info ? r3(info.fps) : null, negros: [], congelados: [] };
    salida.versiones.push(ficha);
    if (!ficha.deEsteMontaje) {
      salida.defectos.push({ tipo: 'version-vieja', version: v.tipo, detalle: `${v.archivo} es de antes del ultimo montaje (no se volvio a renderizar)` });
    }
    if (!info) {
      salida.noMedido.push(`${v.archivo}: ffprobe no lo pudo leer`);
      salida.defectos.push({ tipo: 'ilegible', version: v.tipo, detalle: `${v.archivo} no se puede leer` });
      continue;
    }
    log(`  ..  Midiendo ${v.archivo} (${r1(info.duracion)} s)`);
    const m = await medirVideo(v.ruta, info.fps);
    if (m.error) {
      salida.noMedido.push(`${v.archivo}: ${m.error}`);
      salida.defectos.push({ tipo: 'ilegible', version: v.tipo, detalle: `${v.archivo} no se pudo medir (${m.error})` });
      continue;
    }

    // (1) negros, contra el clip fuente
    for (const n of m.negros) {
      const medio = (n.desde + n.hasta) / 2;
      const p = piezaEn(piezas, medio);
      const tramo = { ...n, pieza: p?.etiqueta ?? null, archivoFuente: p?.archivo ?? null, yavgFuente: null, defecto: true, rerender: false, motivo: '' };
      if (!p) tramo.motivo = 'ninguna pieza del plan cubre ese segundo (agujero en la linea de tiempo)';
      else {
        const tf = enLaFuente(p, medio);
        const largo = await largoDe(p.archivo);
        if (largo !== null && tf > largo) tramo.motivo = `el clip ${p.archivo} dura ${r1(largo)} s y ahi haria falta el segundo ${r1(tf)}`;
        else {
          tramo.yavgFuente = await yavgEn(path.join(dirVideo, p.archivo), tf);
          if (tramo.yavgFuente !== null && tramo.yavgFuente < UMBRALES.yavgFuenteOscura) {
            tramo.defecto = false;
            tramo.motivo = `el clip original tambien es oscuro ahi (YAVG ${r1(tramo.yavgFuente)})`;
          } else {
            tramo.rerender = true; // el clip fuente esta bien: es del render
            tramo.motivo = tramo.yavgFuente === null ? 'no se pudo medir el clip fuente' : `el clip fuente es brillante ahi (YAVG ${r1(tramo.yavgFuente)}) y la salida no`;
          }
        }
      }
      ficha.negros.push(tramo);
      const item = { tipo: 'negro', version: v.tipo, desde: n.desde, hasta: n.hasta, pieza: tramo.pieza, rerender: tramo.rerender, detalle: `${n.cuadros} cuadro(s) negro(s) entre ${r1(n.desde)} y ${r1(n.hasta)} s: ${tramo.motivo}` };
      (tramo.defecto ? salida.defectos : salida.avisos).push(item);
    }

    // (2) congelados, contra el clip fuente
    for (const f of m.congelados) {
      const hasta = f.hasta ?? info.duracion;
      const dur = f.duracion ?? hasta - f.desde;
      const medio = (f.desde + hasta) / 2;
      const p = piezaEn(piezas, medio);
      const tramo = { desde: r3(f.desde), hasta: r3(hasta), duracion: r3(dur), pieza: p?.etiqueta ?? null, archivoFuente: p?.archivo ?? null, defecto: true, rerender: false, motivo: '' };
      if (!p) tramo.motivo = 'ninguna pieza del plan cubre ese tramo';
      else {
        const desdeF = enLaFuente(p, Math.max(f.desde, p.desde));
        const hastaF = enLaFuente(p, Math.min(hasta, p.hasta));
        const largo = await largoDe(p.archivo);
        if (largo !== null && hastaF > largo + 0.05) tramo.motivo = `el clip ${p.archivo} se acaba a los ${r1(largo)} s y la pieza pedia hasta el ${r1(hastaF)}: se repitio su ultimo cuadro`;
        else {
          const quieto = await quietoEnLaFuente(path.join(dirVideo, p.archivo), desdeF, hastaF);
          if (quieto) {
            tramo.defecto = false;
            tramo.motivo = 'el clip original ya esta quieto en ese tramo';
          } else {
            tramo.rerender = true; // el clip original se mueve: es del render
            tramo.motivo = quieto === null ? 'no se pudo medir el clip fuente' : 'el clip original se mueve ahi y la salida no';
          }
        }
      }
      ficha.congelados.push(tramo);
      const item = { tipo: 'congelado', version: v.tipo, desde: tramo.desde, hasta: tramo.hasta, pieza: tramo.pieza, rerender: tramo.rerender, detalle: `${r1(dur)} s de imagen quieta desde ${r1(f.desde)} s: ${tramo.motivo}` };
      (tramo.defecto ? salida.defectos : salida.avisos).push(item);
    }
    log(`      negros: ${m.negros.length}, congelados: ${m.congelados.length}`);
  }

  // (3) la version sin musica de verdad la apaga
  const con = enDisco.find((v) => v.tipo === 'con-subtitulos');
  const sin = enDisco.find((v) => v.tipo === 'sin-subtitulos-sin-musica');
  const solo = enDisco.find((v) => v.tipo === 'solo-subtitulos');
  if (!plan?.musica?.archivo) {
    salida.musica = { medida: false, motivo: 'el plan no lleva musica' };
  } else if (registro && (!con || !sin)) {
    salida.musica = { medida: false, motivo: 'se entrego solo la version completa: la version sin musica sale del editor' };
  } else if (!con || !sin) {
    salida.musica = { medida: false, motivo: 'falta la version completa o la que va sin musica' };
  } else {
    const iCon = await sonda(con.ruta);
    const iSin = await sonda(sin.ruta);
    if (!iCon?.conAudio || !iSin?.conAudio) {
      salida.musica = { medida: false, motivo: 'alguna de las versiones no trae audio' };
      salida.defectos.push({ tipo: 'sin-audio', version: !iCon?.conAudio ? 'con-subtitulos' : 'sin-subtitulos-sin-musica', detalle: 'la version no trae pista de audio' });
    } else {
      const control = await restar(con.ruta, con.ruta, iCon.canales, iCon.canales);
      if (!control || control.mean > UMBRALES.restaControlDb) {
        salida.musica = { medida: false, control };
        return terminar(2, `el control de la resta no dio ~-91 dB (${control ? `${control.mean} dB` : 'no corrio'}): el filtro esta mal o el audio no se puede restar`);
      }
      const conVsSin = await restar(con.ruta, sin.ruta, iCon.canales, iSin.canales);
      salida.musica = { medida: true, control, conVsSin };
      if (!conVsSin) salida.noMedido.push('la resta de la version completa contra la sin musica no corrio');
      else if (conVsSin.mean <= UMBRALES.musicaPresenteDb) {
        salida.defectos.push({ tipo: 'musica', version: 'sin-subtitulos-sin-musica', detalle: `la version sin musica no se distingue de la completa (diferencia ${conVsSin.mean} dB): o la completa no tiene musica, o la sin musica la tiene` });
      }
      if (solo) {
        const iSolo = await sonda(solo.ruta);
        const soloVsSin = iSolo?.conAudio ? await restar(solo.ruta, sin.ruta, iSolo.canales, iSin.canales) : null;
        salida.musica.soloVsSin = soloVsSin;
        if (soloVsSin && soloVsSin.mean > UMBRALES.musicaPresenteDb) {
          salida.defectos.push({ tipo: 'musica', version: 'solo-subtitulos', detalle: `la version solo subtitulos todavia suena distinta a la sin musica (diferencia ${soloVsSin.mean} dB): le quedo musica` });
        }
      }
      log(`  OK  Musica: control ${control.mean} dB; completa - sin musica ${conVsSin?.mean ?? '?'} dB${salida.musica.soloVsSin ? `; solo subtitulos - sin musica ${salida.musica.soloVsSin.mean} dB` : ''}`);
    }
  }

  return terminar(salida.defectos.length ? 1 : 0);
}

// ---------------------------------------------------------------- CLI

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const carpetaArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!carpetaArg) {
    console.error('\n  Uso: node produccion/control-final.js <carpeta-del-anuncio>\n');
    process.exitCode = 2;
  } else {
    const carpeta = path.resolve(carpetaArg);
    console.log(`\n=== Control final — ${path.basename(carpeta)} ===\n`);
    const r = await controlFinal(carpeta);
    if (r.codigo === 2) console.log(`\n  !  No pude medir: ${r.motivo}`);
    for (const d of r.defectos) console.log(`  DEFECTO  [${d.version || '-'}] ${d.detalle}`);
    for (const a of r.avisos) console.log(`  aviso    [${a.version || '-'}] ${a.detalle}`);
    for (const n of r.noMedido) console.log(`  ?        ${n}`);
    if (r.codigo === 0) console.log(r.soloCompleta ? '\n  Limpio: sin negros ni congelados (solo la version completa).' : '\n  Limpio: sin negros, sin congelados y la version sin musica la apaga.');
    if (r.codigo === 1) {
      console.log(
        `\n  ${r.defectos.length} defecto(s). ` +
          (r.rerenderAyuda ? 'Renderizar otra vez no cobra nada y puede arreglarlo.' : 'Renderizar otra vez no lo arregla: hay que rehacer ese clip (o planear de nuevo).')
      );
    }
    for (const v of r.versiones) console.log(`  ${v.archivo}: ${v.duracion ?? '?'} s`);
    console.log(`\n  Detalle en ${path.join(path.basename(carpeta), 'qa', 'control-final.json')}\n`);
    process.exitCode = r.codigo;
  }
}

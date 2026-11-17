// Exporta la version EDITADA de un anuncio: lo que el usuario cambio en el editor de la app, en un MP4 nuevo.
//
//   node produccion/exportar-edicion.js temp/mi-anuncio --pedido temp/mi-anuncio/app/exportes/pedido-2.json
//   node produccion/exportar-edicion.js temp/mi-anuncio [--calidad 720|1080] [--sin-subtitulos] [--sin-musica] [--srt] [--numero N]
//
// Sin --pedido usa los cambios guardados en temp/<slug>/app/edicion.json.
//
// Las versiones que la app ya no entrega (solo entrega la completa, ensamblar --solo-completa) se sacan de aca:
// el pedido trae "subtitulos": "sin" y/o "sinMusica": true (la app los pone segun la version que se elige en
// Exportar: sin subtitulos, sin musica o limpia). Se aplican SOLO a este video, sobre los cambios del usuario: la
// musica de la edicion se silencia aca, no en edicion.json. Igual que en ensamblar, sin musica apaga solo la
// musica: la voz, el sonido de los clips y los efectos de las transiciones quedan.
//
// Deja output/<slug>_editado-N.mp4 (y, con --srt, output/<slug>_editado-N.srt) y su control final en
// temp/<slug>/qa/control-editado-N.json. Las versiones que entrego el sistema (<slug>_9x16_*.mp4) no se tocan.
// No genera ni cobra nada: solo Remotion y ffmpeg en esta PC.
//
// La composicion es "AnuncioEditado" (remotion/src/edicion/AnuncioEditado.jsx), LA MISMA que dibuja la vista
// previa del editor: recibe el plan de montaje, los cambios y su contexto, y calcula las capas con
// remotion/src/edicion/capas.mjs. Por eso lo que se ve en el editor es lo que sale en el MP4.
//
//   calidad   720  -> 720x1280 (el tamano de la composicion)
//             1080 -> 1080x1920 (scale 1.5: Remotion dibuja cada cuadro a 1,5x, no lo estira despues)
//
// Lo que dice mientras trabaja, para la app (una linea cada vez, JSON despues de la marca):
//   @@avance {"etapa":"preparar|armar|render|revisar|guardar","valor":0-100,"cuadro":N,"total":N}
//   @@listo  {"archivo","srt","calidad","control":{"limpio","defectos","avisos"}}
//
// Codigos de salida: 0 listo y limpio · 1 listo con defectos (el archivo queda: estan en el control) ·
// 2 listo pero no se pudo revisar · 3 no se pudo exportar (no queda archivo).
//
// Igual que ensamblar.js: los archivos que usa el render van como ENLACES DUROS en <carpeta>/.render-edicion/
// (Remotion copia la carpeta publica entera en cada render), la concurrencia sale de la memoria libre y un
// render que se cae por memoria se reintenta con menos. Se corre con la carpeta de remotion/ como carpeta de
// trabajo: Remotion busca ahi su navegador (remotion/node_modules/.remotion).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RAIZ, DIR_TEMP, DIR_OUTPUT } from './config.js';
import { UMBRALES, leerCongelados, leerYavg, tramosOscuros, piezasDelPlan, piezaEn } from './control-final.js';

const DIR_REMOTION = path.join(RAIZ, 'remotion');
const DIR_PUBLICO = '.render-edicion';
const CRF = 21; // el mismo de ensamblar.js
const FPS = 30;
const r1 = (x) => Math.round(Number(x) * 10) / 10;
const r3 = (x) => Math.round(Number(x) * 1000) / 1000;

const avisar = (marca, datos) => process.stdout.write(`@@${marca} ${JSON.stringify(datos)}\n`);
let ultimoAvance = { valor: -1, t: 0 };
function avance(etapa, valor, extra = {}) {
  const v = Math.max(0, Math.min(100, Math.round(valor * 10) / 10));
  const ahora = Date.now();
  // no mas de 2 por segundo (salvo al cambiar de etapa)
  if (etapa === ultimoAvance.etapa && v - ultimoAvance.valor < 0.5 && ahora - ultimoAvance.t < 500) return;
  ultimoAvance = { etapa, valor: v, t: ahora };
  avisar('avance', { etapa, valor: v, ...extra });
}

function salir(codigo, mensaje) {
  if (mensaje) console.error(`\n  ${mensaje}\n`);
  process.exit(codigo);
}

// ---------------------------------------------------------------- lo que se pide

function leerArgs(argv) {
  const args = argv.slice(2);
  const valor = (flag) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[i + 1] : null;
  };
  const conValor = new Set(['--pedido', '--calidad', '--numero', '--concurrencia']);
  const carpetaArg = args.find((a, i) => !a.startsWith('--') && !conValor.has(args[i - 1]));
  return {
    carpetaArg,
    pedido: valor('--pedido'),
    calidad: valor('--calidad'),
    numero: valor('--numero'),
    concurrencia: valor('--concurrencia'),
    sinSubtitulos: args.includes('--sin-subtitulos'),
    sinMusica: args.includes('--sin-musica'),
    srt: args.includes('--srt'),
  };
}

const leerJSON = (ruta) => {
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf8').replace(/^﻿/, ''));
  } catch {
    return null;
  }
};

/** El proximo numero libre de <slug>_editado-N.mp4 en output/. */
function proximoNumero(slug) {
  let max = 0;
  const re = new RegExp(`^${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_editado-(\\d+)\\.(mp4|srt)$`);
  for (const n of fs.existsSync(DIR_OUTPUT) ? fs.readdirSync(DIR_OUTPUT) : []) {
    const m = n.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

/**
 * El archivo de la musica que eligio el usuario, o null si es la del anuncio o no hay. Devuelve
 * { ruta } o { falta: 'motivo' }.
 *   propia      la cancion que arrastro: la app la guarda en <carpeta>/app/edicion/musica-<id>.<ext>
 *   biblioteca  la de otro anuncio: /archivos/anuncio/<otro>/<ruta> -> temp/<otro>/<ruta>
 */
function archivoDeMusica(carpeta, m) {
  if (!m || m.fuente === 'original' || m.fuente === 'ninguna') return null;
  if (m.fuente === 'propia') {
    const dir = path.join(carpeta, 'app', 'edicion');
    const id = String(m.id || '');
    if (!/^[a-z0-9]+$/i.test(id)) return { falta: 'la cancion elegida no tiene un id valido' };
    const nombre = (fs.existsSync(dir) ? fs.readdirSync(dir) : []).find((n) => n.startsWith(`musica-${id}.`));
    return nombre ? { ruta: path.join(dir, nombre) } : { falta: `tu cancion (${m.nombre || id}) no llego a guardarse en la carpeta del anuncio` };
  }
  if (m.fuente === 'biblioteca') {
    const r = String(m.url || '').match(/^\/archivos\/anuncio\/([^/]+)\/(.+)$/);
    if (!r) return { falta: 'no se de que anuncio es la musica elegida' };
    let slug;
    let rel;
    try {
      slug = decodeURIComponent(r[1]);
      rel = r[2].split('/').map(decodeURIComponent);
    } catch {
      return { falta: 'la direccion de la musica elegida esta mal formada' };
    }
    const base = path.resolve(DIR_TEMP, slug);
    const ruta = path.resolve(base, ...rel);
    if (!base.startsWith(path.resolve(DIR_TEMP) + path.sep) || !ruta.startsWith(base + path.sep)) return { falta: 'la musica elegida esta fuera de los anuncios' };
    return fs.existsSync(ruta) ? { ruta } : { falta: `la musica de "${m.origen || slug}" ya no esta` };
  }
  return null;
}

// ---------------------------------------------------------------- carpeta publica liviana (como ensamblar.js)

/** Las rutas (relativas a la carpeta) de cada archivo que el plan nombra (directo o dentro de video/). */
function archivosDelPlan(carpeta, plan) {
  const raiz = path.resolve(carpeta);
  const hallados = new Set();
  const visitar = (valor) => {
    if (typeof valor === 'string') {
      if (valor.length > 300 || !/\.[a-z0-9]{2,5}$/i.test(valor)) return;
      for (const rel of [valor, `video/${valor}`]) {
        const abs = path.resolve(raiz, rel);
        if (!abs.startsWith(raiz + path.sep)) continue;
        try {
          if (fs.statSync(abs).isFile()) hallados.add(path.relative(raiz, abs));
        } catch {
          // el plan lo nombra pero no es un archivo de aca
        }
      }
    } else if (Array.isArray(valor)) {
      for (const v of valor) visitar(v);
    } else if (valor && typeof valor === 'object') {
      for (const v of Object.values(valor)) visitar(v);
    }
  };
  visitar(plan);
  return [...hallados].sort();
}

/** Pone el temporal en el lugar del final (aunque exista). false si no se pudo (p. ej. abierto en un reproductor). */
function reemplazar(temporal, final) {
  for (let i = 0; i < 2; i++) {
    try {
      fs.renameSync(temporal, final);
      return true;
    } catch {
      try {
        fs.rmSync(final, { force: true });
      } catch {
        // abierto por otro programa
      }
    }
  }
  fs.rmSync(temporal, { force: true });
  return false;
}

function enlazar(origen, final) {
  fs.mkdirSync(path.dirname(final), { recursive: true });
  try {
    fs.linkSync(origen, final);
  } catch {
    fs.copyFileSync(origen, final);
  }
}

// ---------------------------------------------------------------- memoria (como ensamblar.js)

function concurrenciaSegunMemoria() {
  const libresGB = os.freemem() / 1024 ** 3;
  const techo = Math.round(Math.min(8, Math.max(1, os.cpus().length / 2)));
  return Math.max(1, Math.min(techo, Math.floor(libresGB - 2)));
}
const FIRMA_SIN_MEMORIA = /No frame found|Target closed|Page crashed|ENOMEM|out of memory|allocation failed/i;
// Con la PC muy cargada (otro render, otros programas) un cuadro puede tardar mas de lo que Remotion espera por
// defecto (30 s) en sacar el fotograma de un clip. Se le da mas margen y, si igual se pasa, se reintenta una vez.
const ESPERA_CUADRO_MS = 120000;
const FIRMA_DEMORA = /delayRender\(\)[^\n]*not cleared|Timeout exceeded|timed out/i;

// ---------------------------------------------------------------- ffmpeg (las mismas mediciones de control-final.js)

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
  const r = await correr('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,avg_frame_rate,width,height,nb_frames:format=duration', '-of', 'json', ruta]);
  if (r.codigo !== 0) return null;
  try {
    const j = JSON.parse(r.out);
    const v = (j.streams || []).find((s) => s.codec_type === 'video');
    const a = (j.streams || []).find((s) => s.codec_type === 'audio');
    const [n, d] = String(v?.avg_frame_rate || '30/1').split('/').map(Number);
    return { duracion: Number(j.format?.duration) || 0, fps: d ? n / d : n || FPS, ancho: Number(v?.width) || 0, alto: Number(v?.height) || 0, cuadros: Number(v?.nb_frames) || null, conAudio: Boolean(a) };
  } catch {
    return null;
  }
}

async function medirVideo(ruta, fps) {
  const r = await ffmpeg(['-i', ruta, '-map', '0:v:0', '-vf', `${UMBRALES.freeze},signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG:file=-`, '-f', 'null', '-']);
  if (r.codigo !== 0) return { error: r.err.trim().split(/\r?\n/).slice(-3).join(' ') || `ffmpeg salio con ${r.codigo}` };
  return { negros: tramosOscuros(leerYavg(r.out), fps), congelados: leerCongelados(r.err) };
}

async function yavgEn(ruta, t) {
  const r = await ffmpeg(['-ss', String(Math.max(0, t)), '-i', ruta, '-frames:v', '1', '-vf', 'signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-']);
  if (r.codigo !== 0) return null;
  return leerYavg(r.out)[0]?.yavg ?? null;
}

async function quietoEnLaFuente(ruta, desde, hasta) {
  const dur = Math.max(0.2, hasta - desde);
  const d = Math.max(0.4, r3(dur * 0.8));
  const r = await ffmpeg(['-ss', String(Math.max(0, desde)), '-t', String(dur), '-i', ruta, '-map', '0:v:0', '-vf', `freezedetect=n=0.003:d=${d}`, '-f', 'null', '-']);
  if (r.codigo !== 0) return null;
  return leerCongelados(r.err).length > 0;
}

/** Que los filtros detecten lo que tienen que detectar (5.9: una medicion sin control no verifica nada). */
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
  const okCongelado = congelados.length === 1 && congelados[0].desde > 2.5 && congelados[0].desde < 3.1;
  const okNegro = negros.length === 1 && Math.abs(negros[0].desde - 1) < 0.05 && Math.abs(negros[0].hasta - 2) < 0.1;
  const quieto = await ffmpeg(['-f', 'lavfi', '-i', 'testsrc=d=3:s=160x120:r=24', '-vf', UMBRALES.freeze, '-f', 'null', '-']);
  const okMovimiento = quieto.codigo === 0 && leerCongelados(quieto.err).length === 0;
  const motivos = [];
  if (!okCongelado) motivos.push('el congelado fabricado no se detecto bien');
  if (!okMovimiento) motivos.push('un video que se mueve dio congelado');
  if (!okNegro) motivos.push('el tramo negro fabricado no aparecio entre 1 y 2 s');
  return { ok: motivos.length === 0, motivo: motivos.join('; ') || null };
}

/**
 * Las piezas que SE VEN en el plan con los cambios, con su ventana real. Como piezasDelPlan de
 * control-final.js, salvo en los anuncios por bloques: ahi cada toma se ve desde su arranque hasta el de la
 * siguiente (Anuncio.jsx las encadena asi) menos lo que tapa su B-roll. Si el usuario quito un B-roll, la toma
 * de abajo queda a la vista mas tiempo del que su clip cubre: eso se mide aca.
 */
function piezasVisibles(plan) {
  if (plan?.escena?.piezas || plan?.continuidad?.clips) return piezasDelPlan(plan);
  const bloques = Array.isArray(plan?.bloques) ? plan.bloques : [];
  const inicios = bloques.map((b, i) => (i === 0 ? 0 : Number(b.toma?.desde ?? b.inicio) || 0));
  const piezas = [];
  const etiqueta = (archivo) => String(archivo || '').replace(/\.mp4$/i, '').replace(/^broll-/, 'B-roll ').replace(/^toma-/, 'toma ');
  const fin = Number(plan.duracion) || 0;
  // Anuncio.jsx dibuja el B-roll de cada bloque despues de las tomas de ese bloque y de los anteriores: tapa a
  // esas tomas, no a las que vienen despues. Con cortes del editor los B-roll van en bloques extra al final
  // (capas.mjs, planAjustado), asi que tapan a todas.
  const tapas = bloques.map((b, i) => (b.broll ? { i, desde: Number(b.broll.desde) || 0, hasta: (Number(b.broll.desde) || 0) + (Number(b.broll.duracion) || 0) } : null)).filter(Boolean);
  bloques.forEach((b, i) => {
    const desde = Math.min(inicios[i], fin);
    const hasta = Math.min(i + 1 < inicios.length ? inicios[i + 1] : fin, fin);
    if (b.toma?.archivo && hasta - desde > 1e-3) {
      // origen: donde arranca la Sequence de la toma (su clip va desde ahi, a su velocidad)
      const toma = { archivo: b.toma.archivo, origen: desde, velocidad: Number(b.toma.velocidad) || 1, recorteInicio: Number(b.toma.recorteInicio) || 0, capa: 0, etiqueta: etiqueta(b.toma.archivo) };
      // la ventana de la toma menos lo que le tapan los B-roll de encima
      let tramos = [[desde, hasta]];
      for (const x of tapas) {
        if (x.i < i) continue;
        const nuevos = [];
        for (const [a, z] of tramos) {
          if (x.hasta <= a || x.desde >= z) nuevos.push([a, z]);
          else {
            if (x.desde > a + 1e-3) nuevos.push([a, x.desde]);
            if (x.hasta < z - 0.05) nuevos.push([x.hasta, z]);
          }
        }
        tramos = nuevos;
      }
      for (const [a, z] of tramos) piezas.push({ ...toma, desde: a, hasta: z });
    }
    if (b.broll?.archivo) {
      const bd = Number(b.broll.desde) || 0;
      piezas.push({ archivo: b.broll.archivo, origen: bd, desde: bd, hasta: bd + (Number(b.broll.duracion) || 0), velocidad: Number(b.broll.velocidad) || 1, recorteInicio: Number(b.broll.recorteInicio) || 0, capa: 1, etiqueta: etiqueta(b.broll.archivo) });
    }
  });
  return piezas;
}

/** Del segundo del video al segundo del clip fuente. */
const enLaFuente = (p, t) => p.recorteInicio + (t - (p.origen ?? p.desde)) * p.velocidad;

/**
 * El control final del MP4 exportado: que exista y se pueda leer, que dure lo del plan, que tenga el tamano
 * pedido y sonido, que ningun clip quede quieto porque no alcanza su momento, y negros y congelados contra el
 * clip fuente (como control-final.js). Cada defecto dice si exportar otra vez lo arregla.
 */
async function controlar({ archivo, plan, planP, carpeta, calidad, conSonido }) {
  // las tomas que quedaron a la vista porque el usuario les saco el B-roll de encima
  const brollsQueQuedan = new Set((planP.bloques || []).filter((b) => b.broll?.archivo).map((b) => b.broll.archivo));
  const sinSuBroll = new Set((plan.bloques || []).filter((b) => b.broll?.archivo && !brollsQueQuedan.has(b.broll.archivo) && b.toma?.archivo).map((b) => b.toma.archivo));
  const salida = { generado: new Date().toISOString(), archivo: path.basename(archivo), calidad, limpio: false, codigo: 2, defectos: [], avisos: [], noMedido: [] };
  const terminar = (codigo, motivo) => {
    salida.codigo = codigo;
    salida.limpio = codigo === 0;
    if (motivo) salida.motivo = motivo;
    salida.rerenderAyuda = salida.defectos.some((d) => d.rerender);
    return salida;
  };
  const c = await controles();
  if (!c.ok) return terminar(2, `control de los filtros: ${c.motivo}`);

  const info = await sonda(archivo);
  if (!info) {
    salida.defectos.push({ tipo: 'ilegible', detalle: 'el archivo exportado no se puede leer', rerender: true });
    return terminar(1);
  }
  salida.duracion = r3(info.duracion);
  salida.tamano = `${info.ancho}x${info.alto}`;
  const esperada = Math.max(1, Math.round((Number(planP.duracion) || 1) * FPS)) / FPS;
  if (Math.abs(info.duracion - esperada) > 0.15) {
    salida.defectos.push({ tipo: 'duracion', detalle: `dura ${r1(info.duracion)} s y el montaje dura ${r1(esperada)} s`, rerender: true });
  }
  const [ancho, alto] = calidad === '1080' ? [1080, 1920] : [720, 1280];
  if (info.ancho !== ancho || info.alto !== alto) {
    salida.defectos.push({ tipo: 'tamano', detalle: `salio de ${info.ancho}x${info.alto} y se pidio ${ancho}x${alto}`, rerender: true });
  }
  if (conSonido && !info.conAudio) salida.defectos.push({ tipo: 'sin-audio', detalle: 'el video salio sin sonido', rerender: true });

  const piezas = piezasVisibles(planP);
  const dirVideo = path.join(carpeta, 'video');
  const largos = new Map();
  const largoDe = async (a) => {
    if (!largos.has(a)) largos.set(a, (await sonda(path.join(dirVideo, a)))?.duracion ?? null);
    return largos.get(a);
  };

  // cada clip alcanza su momento (en los cambios: sobre todo una toma que quedo a la vista sin su B-roll)
  for (const p of piezas) {
    const largo = await largoDe(p.archivo);
    if (largo === null) {
      salida.defectos.push({ tipo: 'falta-clip', pieza: p.etiqueta, detalle: `no encuentro el clip ${p.archivo}`, rerender: false });
      continue;
    }
    // hasta que segundo del video llega el clip (el tramo despues de un B-roll sigue desde ese punto del clip)
    // (si el clip se acaba mientras un B-roll lo tapa, lo quieto empieza recien cuando el B-roll se va)
    const cubreHasta = Math.max(p.desde, (p.origen ?? p.desde) + Math.max(0, largo - p.recorteInicio) / (p.velocidad || 1));
    if (cubreHasta < p.hasta - 0.1) {
      const quieto = r1(p.hasta - cubreHasta);
      const item = {
        tipo: 'corto',
        pieza: p.etiqueta,
        desde: r3(cubreHasta),
        hasta: r3(p.hasta),
        rerender: false,
        detalle: sinSuBroll.has(p.archivo)
          ? `${p.etiqueta}: se ve quieta ${quieto} s al final (desde el segundo ${r1(cubreHasta)}) porque le quitaste el B-roll que la tapaba y su clip no alcanza`
          : `${p.etiqueta}: se ve quieta ${quieto} s al final (desde el segundo ${r1(cubreHasta)}): su clip no alcanza`,
        porQuitarBroll: sinSuBroll.has(p.archivo),
      };
      // medio segundo quieto apenas se nota: aviso; mas, defecto
      (quieto >= 0.5 ? salida.defectos : salida.avisos).push(item);
    }
  }

  const m = await medirVideo(archivo, info.fps);
  if (m.error) {
    salida.noMedido.push(m.error);
    return terminar(2, `no se pudo medir el video: ${m.error}`);
  }
  for (const n of m.negros) {
    const medio = (n.desde + n.hasta) / 2;
    const p = piezaEn(piezas, medio);
    const item = { tipo: 'negro', desde: n.desde, hasta: n.hasta, pieza: p?.etiqueta ?? null, rerender: false, detalle: '' };
    let defecto = true;
    if (!p) item.detalle = `${n.cuadros} cuadro(s) negro(s) en ${r1(n.desde)} s donde no hay ninguna pieza`;
    else {
      const tf = enLaFuente(p, medio);
      const largo = await largoDe(p.archivo);
      if (largo !== null && tf > largo) item.detalle = `${n.cuadros} cuadro(s) negro(s) en ${r1(n.desde)} s: el clip ${p.archivo} ya se termino`;
      else {
        const yf = await yavgEn(path.join(dirVideo, p.archivo), tf);
        if (yf !== null && yf < UMBRALES.yavgFuenteOscura) {
          defecto = false;
          item.detalle = `${n.cuadros} cuadro(s) oscuro(s) en ${r1(n.desde)} s: el clip original tambien es oscuro ahi`;
        } else {
          item.rerender = true;
          item.detalle = `${n.cuadros} cuadro(s) negro(s) en ${r1(n.desde)} s y el clip original se ve bien ahi`;
        }
      }
    }
    (defecto ? salida.defectos : salida.avisos).push(item);
  }
  for (const f of m.congelados) {
    const hasta = f.hasta ?? info.duracion;
    const dur = f.duracion ?? hasta - f.desde;
    const p = piezaEn(piezas, (f.desde + hasta) / 2);
    const item = { tipo: 'congelado', desde: r3(f.desde), hasta: r3(hasta), pieza: p?.etiqueta ?? null, rerender: false, detalle: '' };
    let defecto = true;
    if (!p) item.detalle = `${r1(dur)} s de imagen quieta desde ${r1(f.desde)} s donde no hay ninguna pieza`;
    else {
      const desdeF = enLaFuente(p, Math.max(f.desde, p.desde));
      const hastaF = enLaFuente(p, Math.min(hasta, p.hasta));
      const largo = await largoDe(p.archivo);
      if (largo !== null && hastaF > largo + 0.05) item.detalle = `${r1(dur)} s de imagen quieta desde ${r1(f.desde)} s: el clip ${p.archivo} se acaba antes`;
      else {
        const quieto = await quietoEnLaFuente(path.join(dirVideo, p.archivo), desdeF, hastaF);
        if (quieto) {
          defecto = false;
          item.detalle = `${r1(dur)} s de imagen quieta desde ${r1(f.desde)} s: el clip original ya esta quieto ahi`;
        } else {
          item.rerender = true;
          item.detalle = `${r1(dur)} s de imagen quieta desde ${r1(f.desde)} s y el clip original se mueve ahi`;
        }
      }
    }
    // el que ya conto el chequeo de "clip corto" no se repite
    if (defecto && !item.rerender && salida.defectos.some((d) => d.tipo === 'corto' && d.pieza === item.pieza)) continue;
    (defecto ? salida.defectos : salida.avisos).push(item);
  }
  return terminar(salida.defectos.length ? 1 : 0);
}

// ---------------------------------------------------------------- la corrida

async function principal() {
  const a = leerArgs(process.argv);
  if (!a.carpetaArg) salir(3, 'Uso: node produccion/exportar-edicion.js <carpeta-del-anuncio> [--pedido pedido.json] [--calidad 720|1080] [--sin-subtitulos] [--srt]');
  const carpeta = path.resolve(RAIZ, a.carpetaArg);
  const slug = path.basename(carpeta);
  const plan = leerJSON(path.join(carpeta, 'plan-montaje.json'));
  if (!plan || !(plan.duracion > 0)) salir(3, `Falta el plan de montaje de ${slug} (plan-montaje.json): el anuncio todavia no esta armado.`);
  if (!fs.existsSync(path.join(DIR_REMOTION, 'node_modules'))) salir(3, 'Remotion no esta instalado. Entra a remotion/ y ejecuta: npm install');

  // el pedido: el de la app (--pedido) o lo guardado en edicion.json con lo de la linea de comandos
  let pedido;
  if (a.pedido) {
    pedido = leerJSON(path.resolve(RAIZ, a.pedido));
    if (!pedido) salir(3, `No pude leer el pedido ${a.pedido}.`);
  } else {
    const guardado = leerJSON(path.join(carpeta, 'app', 'edicion.json'));
    pedido = { estado: guardado?.estado || null, contexto: guardado?.contexto || {}, calidad: a.calidad || '1080', subtitulos: a.sinSubtitulos ? 'sin' : 'con', sinMusica: a.sinMusica, srt: a.srt, n: a.numero ? Number(a.numero) : null };
  }
  const calidad = String(pedido.calidad || a.calidad || '1080') === '720' ? '720' : '1080';
  const n = Number.isInteger(Number(pedido.n)) && Number(pedido.n) > 0 ? Number(pedido.n) : proximoNumero(slug);
  const nombre = `${slug}_editado-${n}.mp4`;
  const salidaMp4 = path.join(DIR_OUTPUT, nombre);
  const salidaSrt = path.join(DIR_OUTPUT, `${slug}_editado-${n}.srt`);

  // capas.mjs: la misma cuenta que hace la composicion (la carpeta remotion/ no es "type": "module": por eso .mjs)
  const capas = await import(pathToFileURL(path.join(DIR_REMOTION, 'src', 'edicion', 'capas.mjs')).href);
  const estado = capas.completarEdicion(pedido.estado);
  // "Con subtitulos" o "Sin subtitulos" en la exportacion manda sobre lo que se ve en el editor, y la version "sin
  // musica" (o "limpia") silencia la musica que tenga la edicion, solo en este video
  const sinMusica = pedido.sinMusica === true;
  // las imagenes que el usuario puso encima del video: las que ya no estan en la carpeta no van (y se avisa)
  const sinImagen = (estado.textosNuevos || []).filter((x) => x.archivo && !fs.existsSync(path.join(carpeta, x.archivo)));
  for (const x of sinImagen) console.log(`  AVISO: no encuentro la imagen ${x.archivo}: el video sale sin ella.`);
  const edicion = {
    ...estado,
    textosNuevos: (estado.textosNuevos || []).filter((x) => !sinImagen.includes(x)),
    subtitulos: { ...estado.subtitulos, visible: pedido.subtitulos !== 'sin' },
    ...(sinMusica ? { musica: { ...estado.musica, silenciada: true } } : {}),
  };
  const planP = capas.planAjustado(plan, edicion);

  console.log(`\n=== Exportar la version editada — ${slug} ===\n`);
  console.log(`  Archivo:    output/${nombre}`);
  console.log(`  Calidad:    ${calidad === '1080' ? '1080x1920' : '720x1280'}, h264, CRF ${CRF}`);
  console.log(`  Subtitulos: ${edicion.subtitulos.visible ? `si (estilo ${edicion.subtitulos.estilo})` : 'no'}`);
  avance('preparar', 1);

  // la musica que eligio el usuario
  const musicaElegida = sinMusica ? null : archivoDeMusica(carpeta, edicion.musica);
  if (musicaElegida?.falta) salir(3, `No puedo exportar con la musica elegida: ${musicaElegida.falta}. Vuelve a elegirla en el editor.`);
  const extMusica = musicaElegida?.ruta ? path.extname(musicaElegida.ruta).toLowerCase() || '.mp3' : null;
  const relMusica = musicaElegida?.ruta ? `edicion/musica${extMusica}` : null;
  const musica = capas.musicaDeEdicion(plan, edicion, (fuente) => (fuente === 'original' ? plan.musica?.archivo || null : relMusica));
  console.log(
    `  Musica:     ${sinMusica ? 'ninguna (version sin musica)' : `${musica ? (musica.fuente === 'original' ? 'la del anuncio' : musica.nombre) : 'ninguna'}${edicion.musica.silenciada ? ' (silenciada)' : ''}`}`
  );

  // los archivos que el render va a pedir
  // (los del plan y los del plan con los cambios: un video propio que el usuario puso en el editor vive en
  // video/subidos/ y solo lo nombra el plan ajustado)
  const archivos = [...new Set([...archivosDelPlan(carpeta, plan), ...archivosDelPlan(carpeta, planP)])].sort();
  const faltan = [];
  for (const p of piezasVisibles(planP)) if (!fs.existsSync(path.join(carpeta, 'video', p.archivo)) && !faltan.includes(p.archivo)) faltan.push(p.archivo);
  if (plan.audio?.voz && !fs.existsSync(path.join(carpeta, plan.audio.voz))) faltan.push(plan.audio.voz);
  if (!sinMusica && musica?.fuente === 'original' && plan.musica?.archivo && !fs.existsSync(path.join(carpeta, plan.musica.archivo))) faltan.push(plan.musica.archivo);
  if (faltan.length) salir(3, `Faltan archivos del anuncio: ${faltan.join(', ')}.`);

  const publico = path.join(carpeta, DIR_PUBLICO);
  fs.rmSync(publico, { recursive: true, force: true });
  for (const rel of archivos) enlazar(path.join(carpeta, rel), path.join(publico, rel));
  if (relMusica) enlazar(musicaElegida.ruta, path.join(publico, relMusica));
  for (const x of edicion.textosNuevos) if (x.archivo) enlazar(path.join(carpeta, x.archivo), path.join(publico, x.archivo));
  // el pitido de las palabras censuradas (Editar con IA)
  if ((edicion.censuras || []).some((c) => c.modo === 'pitido')) enlazar(path.join(RAIZ, 'recursos', 'efectos-transiciones', 'pitido.mp3'), path.join(publico, capas.ARCHIVO_PITIDO));
  process.on('exit', () => {
    try {
      fs.rmSync(publico, { recursive: true, force: true });
    } catch {
      // la proxima corrida la borra al empezar
    }
  });

  const props = {
    plan,
    edicion,
    contexto: {
      titulo: String(pedido.contexto?.titulo || ''),
      overlays: Array.isArray(pedido.contexto?.overlays) ? pedido.contexto.overlays : [],
      color: pedido.contexto?.color || null,
      musica,
    },
  };
  // (si el usuario silencio la voz y no hay musica, un video sin pista de sonido no es un defecto)
  const conSonido = Boolean((plan.audio?.voz && !edicion.voz.silenciada) || (musica && !edicion.musica.silenciada) || (capas.modoVoz(plan) === 'en-clips' && !edicion.voz.silenciada));

  // Remotion: el navegador lo busca en remotion/node_modules/.remotion segun la carpeta de trabajo
  process.chdir(DIR_REMOTION);
  const req = createRequire(path.join(DIR_REMOTION, 'package.json'));
  const { bundle } = req('@remotion/bundler');
  const { renderMedia, selectComposition, makeCancelSignal } = req('@remotion/renderer');

  avance('armar', 4);
  console.log('\n  Preparando la composicion...');
  let serveUrl;
  try {
    // el armado (con su copia de la carpeta publica) va junto al anuncio, no en la carpeta temporal del sistema:
    // si la exportacion se corta de golpe, la proxima lo borra al empezar
    const armado = path.join(carpeta, `${DIR_PUBLICO}-armado`);
    fs.rmSync(armado, { recursive: true, force: true });
    serveUrl = await bundle({
      entryPoint: path.join(DIR_REMOTION, 'src', 'index.jsx'),
      publicDir: publico,
      outDir: armado,
      onProgress: (p) => avance('armar', 4 + (Number(p) || 0) * 0.08),
    });
  } catch (e) {
    salir(3, `No pude preparar la composicion: ${e?.message || e}`);
  }
  process.on('exit', () => {
    try {
      fs.rmSync(serveUrl, { recursive: true, force: true });
    } catch {
      // queda en la carpeta temporal del sistema
    }
  });

  const composicion = await selectComposition({ serveUrl, id: 'AnuncioEditado', inputProps: props, logLevel: 'error', timeoutInMilliseconds: ESPERA_CUADRO_MS });
  const total = composicion.durationInFrames;
  const pedida = Number(a.concurrencia) > 0 ? Number(a.concurrencia) : null;
  let concurrencia = pedida ?? concurrenciaSegunMemoria();
  console.log(`  Cuadros:    ${total} (${r1(total / FPS)} s), ${concurrencia} a la vez`);

  const temporal = salidaMp4.replace(/\.mp4$/i, '.armando.mp4');
  const { cancelSignal, cancel } = makeCancelSignal();
  let cortado = false;
  for (const s of ['SIGINT', 'SIGTERM']) {
    process.once(s, () => {
      cortado = true;
      cancel();
    });
  }
  process.on('exit', () => fs.rmSync(temporal, { force: true }));

  const renderizar = async (conc, vuelta) => {
    fs.rmSync(temporal, { force: true });
    await renderMedia({
      composition: composicion,
      serveUrl,
      codec: 'h264',
      crf: CRF,
      scale: calidad === '1080' ? 1.5 : 1,
      outputLocation: temporal,
      inputProps: props,
      concurrency: conc,
      overwrite: true,
      logLevel: 'error',
      timeoutInMilliseconds: ESPERA_CUADRO_MS,
      cancelSignal,
      onProgress: ({ renderedFrames, encodedFrames, stitchStage }) => {
        // dibujar y codificar: 12 -> 90. La segunda exportacion (si el control la pide) va de 91 a 97.
        const [etapa, base, ancho] = vuelta ? ['repetir', 91, 6] : ['render', 12, 78];
        const k = stitchStage === 'muxing' ? 1 : (renderedFrames * 0.92 + encodedFrames * 0.08) / Math.max(1, total);
        avance(etapa, base + ancho * Math.min(1, k), { cuadro: Math.min(total, renderedFrames), total });
      },
    });
  };

  let porDemora = false;
  const renderConReintentos = async (vuelta = 0) => {
    const intentos = pedida ? [concurrencia] : [...new Set([concurrencia, Math.max(1, Math.floor(concurrencia / 2)), 1])];
    let demoras = 0;
    for (let i = 0; i < intentos.length; i++) {
      if (i > 0) console.log(`\n  !  Fallo por falta de memoria con ${intentos[i - 1]} cuadros a la vez: pruebo con ${intentos[i]}.`);
      try {
        await renderizar(intentos[i], vuelta);
        concurrencia = intentos[i];
        return true;
      } catch (e) {
        const texto = String(e?.stack || e);
        fs.rmSync(temporal, { force: true });
        if (cortado) {
          console.error('\n  Exportacion cortada.');
          process.exit(3);
        }
        // una demora (la PC muy cargada) se reintenta una vez, con la misma concurrencia
        if (FIRMA_DEMORA.test(texto) && !FIRMA_SIN_MEMORIA.test(texto) && demoras < 1) {
          demoras++;
          console.log('\n  !  Un cuadro tardo demasiado (la PC esta muy cargada): pruebo otra vez.');
          i--;
          continue;
        }
        if (!FIRMA_SIN_MEMORIA.test(texto) || i === intentos.length - 1) {
          console.error(`\n  El render fallo: ${texto.split('\n').slice(0, 4).join(' ')}`);
          porDemora = FIRMA_DEMORA.test(texto);
          return false;
        }
      }
    }
    return false;
  };

  console.log('\n  Armando el video...');
  const t0 = Date.now();
  if (!(await renderConReintentos())) {
    salir(3, porDemora ? 'No pude exportar el video: la PC estaba muy ocupada y un cuadro tardo demasiado. Vuelve a intentarlo (no cuesta nada).' : 'No pude exportar el video.');
  }
  fs.mkdirSync(DIR_OUTPUT, { recursive: true });
  if (!reemplazar(temporal, salidaMp4)) salir(3, `No pude guardar output/${nombre}: puede que este abierto en un reproductor. Ciérralo y exporta otra vez.`);
  console.log(`  OK  ${nombre} en ${Math.round((Date.now() - t0) / 1000)} s (${r1(fs.statSync(salidaMp4).size / 1024 / 1024)} MB)`);

  // el .srt: los mismos bloques que se ven, con las correcciones (vaya o no el subtitulado dentro del video)
  let srt = null;
  if (pedido.srt) {
    const texto = capas.hacerSrt(capas.subtitulosEditados(plan, estado));
    if (texto.trim()) {
      fs.writeFileSync(salidaSrt, '﻿' + texto, 'utf8');
      srt = path.basename(salidaSrt);
      console.log(`  OK  ${srt}`);
    }
  }

  // el control final (y una segunda exportacion si lo que encontro se arregla exportando otra vez)
  avance('revisar', 91);
  console.log('\n  Revisando el video terminado...');
  let control = await controlar({ archivo: salidaMp4, plan, planP, carpeta, calidad, conSonido });
  if (control.codigo === 1 && control.rerenderAyuda) {
    console.log(`  !  Encontre ${control.defectos.length} detalle(s) que se arreglan exportando otra vez: exporto de nuevo.`);
    for (const d of control.defectos) console.log(`       ${d.detalle}`);
    const primero = control;
    if ((await renderConReintentos(1)) && reemplazar(temporal, salidaMp4)) {
      avance('revisar', 97);
      control = await controlar({ archivo: salidaMp4, plan, planP, carpeta, calidad, conSonido });
      control.primerIntento = { defectos: primero.defectos };
      control.segundaExportacion = true;
    }
  }
  fs.mkdirSync(path.join(carpeta, 'qa'), { recursive: true });
  const rutaControl = path.join(carpeta, 'qa', `control-editado-${n}.json`);
  fs.writeFileSync(rutaControl, JSON.stringify(control, null, 2) + '\n', 'utf8');
  for (const d of control.defectos) console.log(`  DEFECTO  ${d.detalle}`);
  for (const x of control.avisos) console.log(`  aviso    ${x.detalle}`);
  if (control.codigo === 0) console.log('  Limpio: sin negros, sin congelados, con su largo y su tamano.');
  if (control.codigo === 2) console.log(`  !  No pude revisarlo: ${control.motivo}`);

  avance('guardar', 100);
  avisar('listo', {
    archivo: nombre,
    srt,
    calidad,
    n,
    control: { limpio: control.limpio, codigo: control.codigo, motivo: control.motivo || null, defectos: control.defectos.map((d) => d.detalle), avisos: control.avisos.map((d) => d.detalle) },
  });
  console.log(`\n  Listo: output/${nombre}\n`);
  process.exitCode = control.codigo;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().catch((e) => {
    const texto = String(e?.stack || e);
    console.error(`\n  Fallo: ${texto}`);
    // la ultima linea es la que ve el usuario (la app toma la ultima frase "No pude ...")
    console.error(
      FIRMA_DEMORA.test(texto)
        ? '\n  No pude exportar el video: la PC estaba muy ocupada y el navegador del render tardo demasiado. Vuelve a intentarlo (no cuesta nada).\n'
        : '\n  No pude exportar el video.\n'
    );
    process.exit(3);
  });
}

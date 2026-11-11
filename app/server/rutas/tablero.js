// Rutas del tablero ("Mis anuncios") y de la entrega de un anuncio. SOLO LECTURA de temp/ y output/.
//
// GET  /api/tablero           -> la ultima actividad de cada anuncio sin terminar: si cambio algo hace poco
//                                es que se esta produciendo ahora; si no, quedo a medio camino.
// GET  /api/entrega/:slug     -> el informe de la entrega en palabras simples: las decisiones del montaje,
//                                lo que salio mal (y si se arreglo solo), el costo y otros anuncios del mismo
//                                producto. Sale de plan-montaje.json, img|video/log-modelos.json e historial/.
//                                Trae `avisos`: lo que noto la revision, una entrada por pieza ([{ clave, pieza,
//                                texto, sugerencia: bool, momento }], lib/avisos.js; desde 2026-11-09 la app no
//                                rehace nada sola por calidad: «Lo que notó la revisión»).
//                                Nunca devuelve prompts ni rutas del disco.
// POST /api/abrir-carpeta     -> { slug, donde: "videos" | "piezas", archivo? } abre el explorador de archivos
//                                en output/ (con el video marcado) o en temp/<slug>/. Nada fuera de ahi.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { TEMP, OUTPUT, PUERTO } from '../lib/rutas.js';
import { leerJSON, listar, stat, segmentoValido, dentroDe, esImagen, esVideo, esAudio } from '../lib/archivos.js';
import { listarAnuncios, resumenAnuncio, slugValido, tituloDeSlug, ultimaActividad, MINUTOS_ACTIVO } from '../lib/anuncios.js';
import { listarAnunciosNuevos, motorDeSesion } from '../lib/anuncios-nuevos.js';
import { listaDeAvisos } from '../lib/avisos.js';

const redondear = (n, d = 2) => Math.round(Number(n) * 10 ** d) / 10 ** d;
// ---------------------------------------------------------------- actividad (tablero)

// ultimaActividad y MINUTOS_ACTIVO viven en lib/anuncios.js: tambien deciden que borradores viejos no se listan.

// ---------------------------------------------------------------- informe (entrega)

const ANIMACIONES = {
  'deslizar-derecha': 'Desliza hacia la derecha',
  'deslizar-izquierda': 'Desliza hacia la izquierda',
  'deslizar-arriba': 'Desliza hacia arriba',
  'deslizar-abajo': 'Desliza hacia abajo',
  zoom: 'Zoom de entrada',
  fundido: 'Fundido',
  corte: 'Corte directo',
};
const EFECTOS = { woosh: 'sonido de pasada', 'deep-woosh': 'sonido de pasada grave', whoosh: 'sonido de pasada', pop: 'un "pop"', swoosh: 'sonido de pasada' };
// 1.6 -> "1,6 veces más rápid" (+o/+a): palabras de todos los días, sin "1,6×"
const masRapido = (v) => `${numeroES(v, 1)} veces más rápid`;

const numeroES = (n, d = 1) => Number(n).toLocaleString('es-ES', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const tiempo = (s) => {
  const t = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
const frase = (s) => {
  const t = String(s || '').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
};
// Las razones las escribe la IA a veces con PALABRAS EN MAYUSCULAS para resaltar: se pasan a normal.
const sinGritos = (s) => String(s || '').replace(/\b([A-ZÁÉÍÓÚÑ]{3,})\b/g, (w) => w.toLowerCase());
// ...y a veces con palabras del oficio o sin tildes: se pasan a palabras de la app.
const PALABRAS_DEL_OFICIO = [
  [/\bhook\b/gi, 'gancho'],
  [/\bpayoff\b/gi, 'remate'],
  [/\bbeats?\b/gi, 'momento'],
  [/\bcta\b/gi, 'llamado a la acción'],
  [/\bsolucion\b/gi, 'solución'],
  [/\batencion\b/gi, 'atención'],
  [/\bgarantia\b/gi, 'garantía'],
  [/\baqui\b/gi, 'aquí'],
  [/\bdespues\b/gi, 'después'],
  [/\baccion\b/gi, 'acción'],
  [/\benvio\b/gi, 'envío'],
  [/\btambien\b/gi, 'también'],
  [/\bultim([oa])\b/gi, 'últim$1'],
  [/\brapid([oa])\b/gi, 'rápid$1'],
];
const enPalabrasDeLaApp = (s) => PALABRAS_DEL_OFICIO.reduce((t, [re, por]) => t.replace(re, por), sinGritos(s));

/** Set de partes ("imagen", "imagen final", "clip") -> "imagen y clip", "imágenes", "clip"... */
function queSeRehizo(partes) {
  const imagenes = ['imagen', 'imagen final'].filter((p) => partes.has(p)).length;
  const img = imagenes > 1 ? 'imágenes' : 'imagen';
  if (partes.has('clip')) return imagenes ? `${img} y clip` : 'clip';
  return img;
}

/** toma n -> segundo donde empieza en el video (para "verlo en el video"). */
function mapaDeMomentos(plan) {
  const tomas = new Map();
  const broll = new Map();
  for (const b of plan?.bloques || []) {
    const inicio = Number(b.inicio) || 0;
    const archivo = b.toma?.archivo || (Array.isArray(b.clips) ? b.clips[0] : null) || '';
    const n = Number((String(archivo).match(/(?:toma|paso)-(\d+)/) || [])[1]) || Number(b.linea) || null;
    if (n && !tomas.has(n)) tomas.set(n, inicio);
    // en el plan, broll.desde ya es el segundo del video donde entra
    if (b.broll?.n) broll.set(Number(b.broll.n), Number.isFinite(Number(b.broll.desde)) ? Number(b.broll.desde) : inicio);
  }
  return { tomas, broll };
}

/** Cuantos de esos B-roll tienen algo en la carpeta (su clip o su imagen): los demas no se generaron. */
function brollEnLaCarpeta(dir, lista) {
  const img = new Set(listar(path.join(dir, 'img')));
  const vid = new Set(listar(path.join(dir, 'video')));
  return lista.filter((n) => vid.has(`broll-${n}.mp4`) || ['png', 'jpg', 'jpeg', 'webp'].some((e) => img.has(`broll-${n}.${e}`))).length;
}

/** Lo que el montaje decidio, contado en palabras de la app. */
function decisionesDe(plan, resumen, m, dir) {
  const d = [];
  if (!plan) return d;
  const bloques = Array.isArray(plan.bloques) ? plan.bloques : [];
  const audio = plan.audio || {};
  const dur = Number(plan.duracion) || resumen.duracion || 0;
  const vozArchivo = String(audio.voz || '');

  // 1. quien manda en el tiempo
  if (/cancion/i.test(vozArchivo)) {
    d.push({ id: 'manda', icono: 'musica', titulo: 'Manda la canción', detalle: `Cada imagen entra y sale al ritmo de la canción, que dura ${tiempo(dur)}.` });
  } else if (vozArchivo) {
    d.push({ id: 'manda', icono: 'voz', titulo: 'Manda la voz', detalle: `El video se adaptó a los ${tiempo(dur)} de la voz en off: ninguna frase se recortó para cuadrar.` });
  } else {
    d.push({ id: 'manda', icono: 'voz', titulo: 'Cada clip trae su propia voz', detalle: `Los personajes hablan en sus clips; el montaje los une sin tocar el movimiento de la boca (${tiempo(dur)} en total).` });
  }

  // 2. la escena (podcast, entrevista)
  const e = plan.escena;
  if (e?.estilo === 'podcast') {
    const modo = e.modoBroll === 'pantalla-dividida' ? 'Pantalla dividida' : e.modoBroll === 'esquina' ? 'El host en una esquina' : 'Un host a la vez';
    d.push({ id: 'escena', icono: 'escena', titulo: modo, detalle: e.lados ? `El host A va a la ${e.lados.A || 'izquierda'} y el B a la ${e.lados.B || 'derecha'}.` : 'Así se ven los dos hosts mientras conversan.' });
  } else if (e?.estilo === 'entrevista') {
    d.push({
      id: 'escena',
      icono: 'escena',
      titulo: `Entrevista, variante ${e.variante || 'A'}`,
      detalle: `El micrófono entra por la ${e.ladoMic || 'izquierda'}${e.ladoIconos ? ` y los iconos van a la ${e.ladoIconos}` : ''}.`,
    });
  }

  // 3. continuidad
  const cont = plan.continuidad?.resumen;
  if (cont) {
    const max = plan.continuidad.velocidadMaxima;
    d.push({
      id: 'continuidad',
      icono: 'continuidad',
      titulo: `${cont.clips} pasos encadenados, sin cortes`,
      detalle:
        cont.sobreGuia > 0
          ? `Cada video va de una escena a la siguiente. ${cont.sobreGuia} van un poco acelerados para llegar a tiempo a su frase (el que más, ${masRapido(max)}o).`
          : 'Cada video va de una escena a la siguiente a su velocidad natural.',
    });
  }

  // 4. ritmo: tomas aceleradas o recortadas
  const conToma = bloques.filter((b) => b.toma);
  const aceleradas = conToma.filter((b) => Number(b.toma.velocidad) > 1.02);
  if (conToma.length && !cont) {
    if (aceleradas.length) {
      const vel = aceleradas.map((b) => Number(b.toma.velocidad)).sort((a, b) => a - b);
      const max = vel[vel.length - 1];
      const mediana = vel[Math.floor(vel.length / 2)];
      const todas = aceleradas.length === conToma.length;
      d.push({
        id: 'ritmo',
        icono: 'ritmo',
        titulo: todas ? 'Todas las tomas, un poco más rápidas' : `${aceleradas.length} de ${conToma.length} tomas aceleradas`,
        detalle:
          `Los clips eran más largos que sus frases: en vez de cortarlos se aceleraron un poco para seguir a la voz` +
          (Math.abs(max - mediana) > 0.05 ? ` (la que más, ${masRapido(max)}a).` : ` (${masRapido(max)}as).`),
      });
    } else {
      d.push({ id: 'ritmo', icono: 'ritmo', titulo: 'Todas las tomas a su velocidad', detalle: `Las ${conToma.length} tomas entraron en su momento sin acelerarlas.` });
    }
  }

  // 5. b-roll
  const usados = bloques.filter((b) => b.broll).length;
  const listaFuera = Array.isArray(plan.brollFuera) ? plan.brollFuera : [];
  const fuera = listaFuera.length;
  if (usados || fuera) {
    // Con la voz ya hecha, el que no entra no se genera; los que ya estaban hechos (de antes) siguen en la carpeta.
    const hechos = brollEnLaCarpeta(dir, listaFuera);
    const queQuedo = `${fuera === 1 ? 'Quedó uno fuera' : `Quedaron ${fuera} fuera`} porque su toma no se hacía larga: no hacía falta tapar nada.`;
    const queSeHizo = !hechos
      ? fuera === 1
        ? ' No se generó.'
        : ' No se generaron.'
      : hechos === fuera
        ? ` ${fuera === 1 ? 'Sigue' : 'Siguen'} en la carpeta por si ${fuera === 1 ? 'lo' : 'los'} quieres usar.`
        : ` ${hechos === 1 ? 'Uno ya estaba hecho y sigue' : `${hechos} ya estaban hechos y siguen`} en la carpeta; los demás no se generaron.`;
    d.push({
      id: 'broll',
      icono: 'broll',
      titulo: `${usados} B-roll en el video`,
      detalle: fuera ? queQuedo + queSeHizo : 'Se usaron todos los que se generaron, cada uno junto a la frase que acompaña.',
    });
  }

  // 6. musica
  const mu = plan.musica;
  if (mu?.archivo) {
    const sube = Number(mu.subeEnPayoffDb) > 0 && mu.payoffDesdeSeg ? ` y sube en el remate, desde el ${tiempo(mu.payoffDesdeSeg)}` : '';
    d.push({
      id: 'musica',
      icono: 'musica',
      titulo: 'Música de fondo',
      detalle: `Va suave debajo de la voz${sube}. Entra y sale con un fundido${mu.loop ? '; se repite para cubrir todo el video' : ''}.`,
    });
  } else if (!/cancion/i.test(vozArchivo) && !vozArchivo) {
    d.push({ id: 'musica', icono: 'musica', titulo: 'Sin música de fondo', detalle: 'En los hablados la conversación va sola, como un clip real.' });
  }

  // 7. transiciones
  const trans = Array.isArray(plan.transiciones) ? plan.transiciones : [];
  if (trans.length) {
    d.push({
      id: 'transiciones',
      icono: 'transicion',
      titulo: `${trans.length} transiciones con sonido`,
      detalle: 'Van solo donde la historia cambia de parte; el resto son cortes limpios.',
    });
  }

  // 8. subtitulos
  const subs = Array.isArray(plan.subtitulos) ? plan.subtitulos.length : 0;
  if (subs) {
    d.push({
      id: 'subtitulos',
      icono: 'subtitulos',
      titulo: 'Subtítulos "Caja"',
      detalle: `${subs} frases sincronizadas palabra por palabra; la que se dice se resalta en una caja de color.`,
      color: plan.estiloSubtitulos?.colorResaltado || null,
    });
  }

  // 9. textos en pantalla
  const overlays = Array.isArray(m?.overlays) ? m.overlays.length : 0;
  if (overlays) d.push({ id: 'textos', icono: 'textos', titulo: `${overlays} textos en pantalla`, detalle: 'Datos y llamados a la acción encima del video.' });

  return d;
}

function transicionesDe(plan) {
  return (Array.isArray(plan?.transiciones) ? plan.transiciones : []).map((t) => ({
    toma: t.toma ?? null,
    momento: Number(t.desde) || 0,
    animacion: ANIMACIONES[t.animacion] || frase(String(t.animacion || 'Transición').replace(/-/g, ' ')),
    efecto: t.efecto ? EFECTOS[t.efecto] || String(t.efecto).replace(/-/g, ' ') : null,
    porque: t.porque ? frase(enPalabrasDeLaApp(t.porque)) : null,
  }));
}

// Los avisos del montaje vienen en texto del motor ("--velocidad-max", "guia de 1.6x"): se traducen.
function avisosDe(plan, momentos) {
  const grupos = new Map(); // clave -> { ...item, tomas: [] }
  const sumar = (clave, base, n, extra) => {
    if (!grupos.has(clave)) grupos.set(clave, { ...base, piezas: [] });
    const g = grupos.get(clave);
    if (n !== null && n !== undefined) g.piezas.push({ n, momento: extra?.momento ?? null, valor: extra?.valor ?? null });
  };
  for (const crudo of Array.isArray(plan?.avisos) ? plan.avisos : []) {
    const a = String(crudo);
    let r;
    if ((r = a.match(/^toma[- ](\d+)(?: \+ paso-\d+)?[^:]*?(?::)?\s*va a ([\d.]+)x/i))) {
      const n = Number(r[1]);
      sumar(
        'rapidas',
        {
          tipo: 'revisar',
          titulo: 'Tomas que van más rápido de lo ideal',
          detalle: 'El clip era más largo que su frase y se aceleró en vez de cortarlo. Si en alguna se nota, puedes rehacer ese clip más corto desde el editor.',
          unidad: 'toma',
        },
        n,
        { momento: momentos.tomas.get(n) ?? null, valor: `${numeroES(Number(r[2]), 1)} veces` }
      );
    } else if ((r = a.match(/^toma (\d+): tiene (\d+) pausa/i))) {
      const n = Number(r[1]);
      sumar(
        'pausas',
        {
          tipo: 'revisar',
          titulo: 'Pausas mientras hablan',
          detalle: 'Hay silencios cortos dentro de lo que dicen. Se dejaron así para no romper el movimiento de la boca; si el ritmo se siente lento, se puede rehacer ese clip.',
          unidad: 'toma',
        },
        n,
        { momento: momentos.tomas.get(n) ?? null, valor: `${r[2]} ${r[2] === '1' ? 'pausa' : 'pausas'}` }
      );
    } else if ((r = a.match(/^(?:B-roll|toma) (\d+): el clip dura ([\d.]+)s y la ventana pide ([\d.]+)s/i))) {
      const falta = Number(r[3]) - Number(r[2]);
      if (falta < 0.05) continue; // centesimas: no se nota
      const esBroll = /^B-roll/i.test(a);
      const n = Number(r[1]);
      sumar(
        esBroll ? 'cortos-broll' : 'cortos',
        {
          tipo: 'revisar',
          titulo: esBroll ? 'B-roll un poco cortos' : 'Clips un poco cortos',
          detalle: 'El clip dura menos que el momento que tenía que cubrir; el montaje sostuvo el último cuadro para no dejar un hueco.',
          unidad: esBroll ? 'B-roll' : 'toma',
        },
        n,
        { momento: (esBroll ? momentos.broll : momentos.tomas).get(n) ?? null, valor: `faltan ${numeroES(falta, 1)} s` }
      );
    } else if ((r = a.match(/^paso-(\d+)\.mp4 salio del modelo de respaldo/i))) {
      const n = Number(r[1]);
      sumar(
        'respaldo-paso',
        {
          tipo: 'arreglado',
          titulo: 'Pasos que salieron con el modelo de respaldo',
          detalle: 'El modelo principal falló y el video salió del de respaldo. Míralo: que arranque y llegue bien a sus dos escenas.',
          unidad: 'paso',
        },
        n,
        { momento: momentos.tomas.get(n) ?? null }
      );
    } else if ((r = a.match(/^B-roll (\d+) \(toma (\d+)\): con esta voz entra en el video/i))) {
      // entra con la voz final y su clip no esta (plan.brollSinClip): su toma cubrio toda la frase
      const n = Number(r[1]);
      sumar(
        'broll-sin-clip',
        {
          tipo: 'revisar',
          titulo: 'B-roll que no están en el video',
          detalle: 'Con la voz final tenían lugar, pero su clip no está: su toma cubre toda la frase, sin huecos. Se puede dejar así.',
          unidad: 'B-roll',
        },
        n,
        { momento: momentos.tomas.get(Number(r[2])) ?? null }
      );
    } else if ((r = a.match(/^B-roll (\d+)(?: \(toma \d+\))?: la frase "([^"]+)"/i))) {
      const n = Number(r[1]);
      sumar(
        `broll-fuera-${n}`,
        {
          tipo: 'revisar',
          titulo: `El B-roll ${n} no entró`,
          detalle: `La frase "${r[2]}" queda muy pegada al final de su toma y el B-roll no alcanzaba a cubrirla. Se dejó la toma sola.`,
          unidad: 'B-roll',
        },
        null
      );
    } else {
      // Desconocido: se muestra la primera frase, sin nada que parezca una orden del motor.
      const limpio = a.replace(/--[\w-]+/g, '').split(/(?<=\.)\s/)[0].replace(/\s+/g, ' ').trim();
      if (limpio) sumar(`otro-${grupos.size}`, { tipo: 'revisar', titulo: frase(limpio), detalle: null }, null);
    }
  }
  return [...grupos.entries()].map(([id, g]) => ({ id, ...g, piezas: g.piezas.sort((a, b) => a.n - b.n) }));
}

// historial/ guarda lo que se rehizo ("toma-9--2026-09-06.mp4", "con-voz-toma-11.mp4", "faja--2026-...png").
function rehechosDe(dir, momentos) {
  const tomas = new Map(); // "toma 9" -> { n, unidad, partes:Set, motivo }
  const hojas = new Set();
  let voz = false;
  for (const n of listar(path.join(dir, 'historial'))) {
    const abs = path.join(dir, 'historial', n);
    if (!stat(abs)?.isFile()) continue;
    if (!(esImagen(n) || esVideo(n) || esAudio(n))) continue;
    if (/^voz--/i.test(n)) {
      voz = true;
      continue;
    }
    const r = n.match(/(toma|broll|paso)-(\d+)(-inicial|-final)?/i);
    if (r) {
      const unidad = r[1].toLowerCase() === 'broll' ? 'B-roll' : r[1].toLowerCase();
      const num = Number(r[2]);
      const clave = `${unidad} ${num}`;
      if (!tomas.has(clave)) tomas.set(clave, { n: num, unidad, partes: new Set(), conVoz: false });
      const t = tomas.get(clave);
      t.partes.add(esVideo(n) ? 'clip' : r[3] === '-final' ? 'imagen final' : 'imagen');
      if (/con-voz/i.test(n)) t.conVoz = true;
      continue;
    }
    const hoja = n.match(/^([a-z0-9-]+?)--/i);
    if (hoja && !/^icono/i.test(hoja[1])) hojas.add(tituloDeSlug(hoja[1]));
  }
  const items = [];
  const lista = [...tomas.values()].sort((a, b) => (a.unidad === b.unidad ? a.n - b.n : a.unidad.localeCompare(b.unidad)));
  const conVoz = lista.filter((t) => t.conVoz);
  const resto = lista.filter((t) => !t.conVoz);
  if (conVoz.length) {
    items.push({
      id: 'voces-coladas',
      tipo: 'arreglado',
      titulo: 'Voces coladas en clips',
      detalle: 'El modelo de video metió una voz que no iba. Se detectó y el clip se rehízo sin voz.',
      piezas: conVoz.map((t) => ({ n: t.n, unidad: t.unidad, momento: (t.unidad === 'B-roll' ? momentos.broll : momentos.tomas).get(t.n) ?? null, valor: null })),
    });
  }
  if (resto.length) {
    items.push({
      id: 'rehechas',
      tipo: 'arreglado',
      titulo: resto.length === 1 ? 'Una pieza se hizo otra vez' : `${resto.length} piezas se hicieron otra vez`,
      detalle: 'Se generaron de nuevo (no salieron bien la primera vez o se pidió otra versión). La versión anterior quedó guardada.',
      piezas: resto.map((t) => ({
        n: t.n,
        unidad: t.unidad,
        momento: (t.unidad === 'B-roll' ? momentos.broll : momentos.tomas).get(t.n) ?? null,
        valor: queSeRehizo(t.partes),
      })),
    });
  }
  if (hojas.size) {
    items.push({
      id: 'hojas',
      tipo: 'arreglado',
      titulo: hojas.size === 1 ? 'Una hoja de referencia se rehízo' : `${hojas.size} hojas de referencia se rehicieron`,
      detalle: `${[...hojas].join(', ')}: se ajustaron para que el personaje o el producto salgan iguales en todas las tomas.`,
      piezas: [],
    });
  }
  if (voz) items.push({ id: 'voz', tipo: 'arreglado', titulo: 'La voz se volvió a generar', detalle: 'Se rehízo la voz en off y el montaje se recalculó con sus tiempos nuevos.', piezas: [] });
  return items;
}

// log-modelos.json: piezas que necesitaron mas de un intento o salieron del modelo de respaldo.
function reintentosDe(dir, momentos) {
  const items = [];
  const li = leerJSON(path.join(dir, 'img', 'log-modelos.json'));
  const lv = leerJSON(path.join(dir, 'video', 'log-modelos.json'));
  const imgs = Array.isArray(li?.imagenes) ? li.imagenes : [];
  const clips = Array.isArray(lv?.clips) ? lv.clips : [];
  const pieza = (id) => {
    const r = String(id || '').match(/(toma|broll|paso)-(\d+)/i);
    if (!r) return { n: null, unidad: tituloDeSlug(String(id || 'pieza')), momento: null };
    const unidad = r[1].toLowerCase() === 'broll' ? 'B-roll' : r[1].toLowerCase();
    const n = Number(r[2]);
    return { n, unidad, momento: (unidad === 'B-roll' ? momentos.broll : momentos.tomas).get(n) ?? null };
  };
  const respaldo = clips.filter((c) => c.respaldo);
  if (respaldo.length) {
    items.push({
      id: 'respaldo',
      tipo: 'arreglado',
      titulo: respaldo.length === 1 ? 'Un clip salió con el modelo de respaldo' : `${respaldo.length} clips salieron con el modelo de respaldo`,
      detalle: 'El modelo principal no respondió y la app usó el de respaldo para no frenar el anuncio.',
      piezas: respaldo.map((c) => ({ ...pieza(c.id || c.archivo), valor: null })),
    });
  }
  const repetidas = [...imgs, ...clips].filter((x) => Number(x.intentos) > 1);
  if (repetidas.length) {
    items.push({
      id: 'reintentos',
      tipo: 'arreglado',
      titulo: repetidas.length === 1 ? 'Una pieza necesitó otro intento' : `${repetidas.length} piezas necesitaron otro intento`,
      detalle: 'El servicio falló a la primera y la app lo volvió a pedir sola.',
      piezas: repetidas.map((x) => ({ ...pieza(x.id || x.archivo), valor: `${x.intentos} intentos` })),
    });
  }
  return items;
}

/** Costo: el del registro y, si no cubre todo, el estimado con las piezas que hay en la carpeta. */
function costoDe(resumen, m, dir) {
  const c = resumen.costo;
  const voz = typeof m?.voz_en_off === 'string' ? m.voz_en_off.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim().length : 0;
  const reg = { li: leerJSON(path.join(dir, 'img', 'log-modelos.json')), lv: leerJSON(path.join(dir, 'video', 'log-modelos.json')) };
  const fechaRegistro = [reg.li?.generado, reg.lv?.generado].filter(Boolean).sort().pop() || null;
  const segundos = (Number(reg.li?.segundos) || 0) + (Number(reg.lv?.segundos) || 0);
  if (!c) return { hayRegistro: false, vozCaracteres: voz || null, piezas: { imagenes: resumen.conteos.imagenes, clips: resumen.conteos.clips } };
  return {
    hayRegistro: true,
    completo: c.completo,
    creditos: c.creditos,
    dolares: c.dolares,
    imagenes: c.imagenes,
    videos: c.videos,
    estimado: c.estimado,
    dolaresPorCredito: c.dolaresPorCredito,
    piezas: { imagenes: resumen.conteos.imagenes, clips: resumen.conteos.clips },
    vozCaracteres: voz || null,
    fechaRegistro,
    segundosRegistro: segundos || null,
  };
}

/** Distancia de edición chica (para "befen" y "befem": la misma marca escrita de dos formas). */
function casiIguales(a, b) {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i) || a.slice(i) === b.slice(i + 1);
}

/** Otros anuncios del mismo producto o marca (la primera palabra del nombre de la carpeta, con alias). */
function hermanosDe(slug) {
  // Un anuncio hecho por la app: los otros anuncios de SU producto (temp/_productos/<id>), no los que se parecen
  // por el nombre de la carpeta (Befem y Befen son productos distintos).
  const brief = leerJSON(path.join(TEMP, slug, 'app', 'brief.json'));
  let lista;
  if (brief?.productoId) {
    const delMotor = new Map(listarAnuncios().map((a) => [a.slug, a]));
    lista = listarAnunciosNuevos()
      .filter((n) => n.slug !== slug && n.productoId === brief.productoId)
      .map((n) => ({
        ...(delMotor.get(n.slug) || {}),
        ...n,
        titulo: n.titulo,
        // la duracion real del video (la del guion es un estimado: saldria 1:00 aca y 1:01 en su entrega)
        duracion: delMotor.get(n.slug)?.duracion ?? n.duracion,
        miniatura: delMotor.get(n.slug)?.miniatura || n.miniatura,
        // un guion sin aprobar no se esta produciendo: su tarjeta lleva al guion
        estado: n.estado === 'guion' ? 'guion' : n.estado === 'listo' && delMotor.get(n.slug)?.estado === 'listo' ? 'listo' : 'en-produccion',
      }));
  } else {
    const marca = slug.split('-')[0];
    if (!marca || marca.length < 3) return [];
    lista = listarAnuncios().filter((a) => a.slug !== slug && casiIguales(a.slug.split('-')[0], marca));
  }
  return lista
    .slice(0, 8)
    .map((a) => ({
      slug: a.slug,
      titulo: a.titulo,
      estiloNombre: a.estiloNombre,
      continuidad: a.continuidad,
      // la misma que muestra su entrega: la del video principal (si no, la del plan)
      duracion: (a.versiones || []).find((v) => v.clase === 'video' && v.principal)?.duracion ?? a.duracion,
      miniatura: a.miniatura,
      video: a.video,
      estado: a.estado,
      productoId: a.productoId || null,
    }));
}

/**
 * Versiones que el motor arma para esta familia (para mostrar "preparando" las que faltan). Los anuncios de la app
 * salen solo con la completa (ensamblar --solo-completa, decision de Diego del 2026-10-26): las demas se sacan
 * desde el editor. Uno viejo que ya tiene las otras las sigue mostrando (la entrega muestra lo que hay en output/).
 */
function versionesEsperadas(resumen, plan, { soloCompleta = false } = {}) {
  if (soloCompleta) return ['con-subtitulos'];
  const conMusica = Boolean(plan?.musica?.archivo) || resumen.familia === 'voz-en-off';
  if (resumen.familia === 'cantado' || resumen.musical || !conMusica) return ['con-subtitulos', 'sin-subtitulos'];
  return ['con-subtitulos', 'solo-subtitulos', 'sin-subtitulos-sin-musica'];
}

// ---------------------------------------------------------------- abrir carpeta

function abrirEnExplorador(abs, { marcar = false } = {}) {
  const opciones = { detached: true, stdio: 'ignore', windowsHide: false };
  let hijo;
  if (process.platform === 'win32') {
    // explorer.exe /select,"<archivo>" abre la carpeta con el archivo marcado
    hijo = marcar
      ? spawn('explorer.exe', [`/select,"${abs}"`], { ...opciones, windowsVerbatimArguments: true })
      : spawn('explorer.exe', [abs], opciones);
  } else if (process.platform === 'darwin') {
    hijo = spawn('open', marcar ? ['-R', abs] : [abs], opciones);
  } else {
    hijo = spawn('xdg-open', [marcar ? path.dirname(abs) : abs], opciones);
  }
  hijo.on('error', () => {});
  hijo.unref();
}

// Solo pedidos de esta misma app: si el navegador dice de donde viene, tiene que ser de aca.
const ORIGENES = new Set([`http://127.0.0.1:${PUERTO}`, `http://localhost:${PUERTO}`, `http://[::1]:${PUERTO}`]);

export default function rutasTablero(app) {
  app.get('/api/tablero', (req, res) => {
    const ahora = Date.now();
    const actividad = {};
    for (const a of listarAnuncios()) {
      if (a.estado !== 'en-produccion') continue;
      const t = ultimaActividad(a.slug);
      actividad[a.slug] = { ultima: t ? new Date(t).toISOString() : null, activo: t ? ahora - t < MINUTOS_ACTIVO * 60000 : false };
    }
    res.json({ actividad, minutosActivo: MINUTOS_ACTIVO });
  });

  app.get('/api/entrega/:slug', (req, res) => {
    const { slug } = req.params;
    if (!slugValido(slug)) return res.status(404).json({ error: 'No encuentro ese anuncio.' });
    const resumen = resumenAnuncio(slug);
    if (!resumen) return res.status(404).json({ error: 'No pude leer ese anuncio.' });
    const dir = path.join(TEMP, slug);
    const m = leerJSON(path.join(dir, 'manifiesto.json')) || {};
    const plan = leerJSON(path.join(dir, 'plan-montaje.json'));
    const momentos = mapaDeMomentos(plan);
    const delRegistro = reintentosDe(dir, momentos);
    const yaRespaldo = delRegistro.some((p) => p.id === 'respaldo');
    const problemas = [...delRegistro, ...rehechosDe(dir, momentos), ...avisosDe(plan, momentos).filter((p) => !(yaRespaldo && p.id === 'respaldo-paso'))];
    // Los anuncios que hizo la app traen su propio informe (app/informe.json, lib/informe.js): decisiones, lo que
    // salio mal y el costo real de las corridas. El saldo de la cuenta no sale de aca (solo si coincide).
    const informe = leerJSON(path.join(dir, 'app', 'informe.json'));
    const v = informe?.costo?.verificacion;
    if (v) informe.costo.verificacion = { diferencia: v.diferencia, coincide: v.coincide };
    const conductor = leerJSON(path.join(dir, 'app', 'conductor.json'));
    // de la app (tiene conductor), o renderizado solo con la completa (qa/versiones.json, ensamblar --solo-completa)
    const soloCompleta = Boolean(conductor) || leerJSON(path.join(dir, 'qa', 'versiones.json'))?.soloCompleta === true;
    // lo que noto la revision, una linea por pieza (sin la instruccion sugerida: solo si la hay)
    const avisos = listaDeAvisos(dir).map((a) => {
      const r = a.clave.match(/^(?:img|vid):(toma|broll|paso)-(\d+)/);
      const momento = r ? ((r[1] === 'broll' ? momentos.broll : momentos.tomas).get(Number(r[2])) ?? null) : null;
      return { clave: a.clave, pieza: a.pieza, texto: a.texto, sugerencia: a.sugerencia, momento };
    });
    res.json({
      slug,
      hayPlan: Boolean(plan),
      duracion: plan?.duracion ? redondear(plan.duracion) : resumen.duracion,
      decisiones: decisionesDe(plan, resumen, m, dir),
      transiciones: transicionesDe(plan),
      problemas,
      costo: costoDe(resumen, m, dir),
      versionesEsperadas: versionesEsperadas(resumen, plan, { soloCompleta }),
      soloCompleta,
      hermanos: hermanosDe(slug),
      // cuando termino la produccion de verdad (despues del control final; el MP4 puede ser de antes)
      terminado: conductor?.estado === 'listo' ? conductor.terminado || null : null,
      informe: informe || null,
      avisos,
      // la IA que escribio el guion (la ultima medida de app/sesion.json): «Lo escribio {IA} con tu cuenta»
      motor: motorDeSesion(leerJSON(path.join(dir, 'app', 'sesion.json'))),
      modoPrueba: Boolean(informe?.modoPrueba ?? conductor?.modoPrueba),
    });
  });

  app.post('/api/abrir-carpeta', (req, res) => {
    const origen = req.headers.origin;
    if (origen && !ORIGENES.has(String(origen).toLowerCase())) return res.status(403).json({ error: 'Solo desde la app.' });
    if (!req.is('application/json')) return res.status(415).json({ error: 'Pedido no válido.' });
    const { slug, donde = 'videos', archivo } = req.body || {};
    if (!slugValido(slug)) return res.status(404).json({ error: 'No encuentro ese anuncio.' });

    if (donde === 'piezas') {
      const abs = dentroDe(TEMP, [slug]);
      if (!abs || !stat(abs)?.isDirectory()) return res.status(404).json({ error: 'No encuentro la carpeta del anuncio.' });
      abrirEnExplorador(abs);
      return res.json({ ok: true, donde: 'piezas' });
    }
    if (donde !== 'videos') return res.status(400).json({ error: 'Pedido no válido.' });

    // El video tiene que ser de este anuncio: <slug>_....mp4 dentro de output/
    if (archivo !== undefined) {
      // (o el de una de sus versiones con otro gancho: <slug>-gancho-<id>_....mp4)
      if (!segmentoValido(archivo) || !(archivo.startsWith(`${slug}_`) || new RegExp(`^${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-gancho-[a-z0-9]+_`, 'i').test(archivo)) || !/\.(mp4|srt)$/i.test(archivo)) {
        return res.status(400).json({ error: 'Ese archivo no es de este anuncio.' });
      }
      const abs = dentroDe(OUTPUT, [archivo]);
      if (!abs || !stat(abs)?.isFile()) return res.status(404).json({ error: 'No encuentro ese video.' });
      abrirEnExplorador(abs, { marcar: true });
      return res.json({ ok: true, donde: 'videos' });
    }
    if (!fs.existsSync(OUTPUT)) return res.status(404).json({ error: 'Todavía no hay videos terminados.' });
    abrirEnExplorador(OUTPUT);
    return res.json({ ok: true, donde: 'videos' });
  });
}

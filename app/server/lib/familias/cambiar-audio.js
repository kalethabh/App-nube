// FAMILIA «cambiar-audio» (2026-11-21i): un anuncio con narrador ya hecho, pasado a CANTADO con sus mismos clips
// (lib/cambiar-audio.js arma la copia). Reusa los pasos de la canción del musical (familias/musical.js,
// PASOS_REUSABLES): la canción, elegirla (la única pausa), medir las frases y el montaje y el render de siempre.
// No genera imágenes ni videos: las escenas son las del original.
//
//   letra          las frases del guion (manifiesto.tomas[].linea), en orden, son la letra; el estilo sale de lo que
//                  pediste («reguetón alegre», «como el video de referencia») y la voz, de lo que elegiste
//   saldo-cancion · cancion · elegir-cancion   como en el musical (2 versiones, eliges de oído)
//   ajustar        recorta la intro y el final largos de la canción (el anuncio arranca con la primera palabra) y
//                  pasa el manifiesto a modo_audio "musica" (la canción es la única pista: sin voz ni música aparte)
//   tiempos        tiempos-cancion.js: cada frase en la canción (audio/tiempos.json, lo que manda el montaje)
//   montaje · render · control-final · informe   como en el musical
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { leerJSON, existe } from '../archivos.js';
import { rutaFfmpeg } from '../miniaturas.js';
import { PASOS_REUSABLES as M, RUTAS, escribirJSON, idiomaScribe, PASO_PAUSA } from './musical.js';

export const FAMILIA = 'cambiar-audio';
export const ESTILOS = []; // no es de un estilo: la elige el brief (brief.cambioDeAudio, conductor.familiaDe)
export { PASO_PAUSA };

const errorDe = (mensaje, detalle = '', motivo = 'otro') => ({ ok: false, error: { mensaje, motivo, ...(detalle ? { detalle } : {}) } });
const esMarca = (t) => /^\s*\[[^\]]*\]\s*$/.test(String(t || ''));
const r3 = (x) => Number(Number(x).toFixed(3));

/** El estilo de la canción para Suno: lo que pidió el usuario y lo que hace falta para un anuncio que se entienda. */
export function estiloDeLaCancion(como, idioma = 'es') {
  const lengua = String(idioma || '').startsWith('en') ? 'English' : String(idioma || '').startsWith('pt') ? 'Portuguese' : 'Spanish';
  const base = String(como || '').trim();
  return `${base ? `${base}. ` : 'Upbeat catchy commercial jingle, modern pop. '}Clear lead vocals sung in ${lengua}, every word easy to understand, energetic from the very first second, short intro.`.slice(0, 900);
}

/** La letra: las frases del guion en orden (una por línea), sin las marcas instrumentales. */
export function letraDelManifiesto(manifiesto) {
  return (manifiesto?.tomas || [])
    .map((t) => String(t.linea || '').trim())
    .filter((l) => l && !esMarca(l))
    .join('\n');
}

async function letra(ctx) {
  const c = ctx.carpeta;
  if (existe(RUTAS.opciones(c)) && existe(RUTAS.peticion(c))) return { ok: true, nota: 'La canción ya estaba hecha con esta letra.' };
  const m = leerJSON(RUTAS.manifiesto(c));
  const texto = letraDelManifiesto(m);
  if (!texto) return errorDe('No encuentro las frases del guion para cantarlas.', 'manifiesto.json sin tomas[].linea');
  const g = leerJSON(RUTAS.guion(c)) || {};
  const pedido = ctx.brief?.cambioDeAudio || {};
  escribirJSON(RUTAS.peticion(c), {
    letra: texto,
    estilo: estiloDeLaCancion(pedido.como, m.idioma || g.idioma),
    titulo: String(g.titulo || ctx.brief?.datos?.nombre || 'Canción del anuncio').slice(0, 80),
    duracion: null,
    vocalGender: pedido.voz === 'f' || pedido.voz === 'm' ? pedido.voz : null,
    idioma: idiomaScribe(m.idioma || g.idioma),
  });
  const v = await M.validarPeticion(ctx);
  if (!v.ok) return v;
  return { ok: true, nota: `${texto.split('\n').length} frases del guion, cantadas.` };
}

/** Recorta la intro y la cola largas (la canción arranca con la primera palabra) y pasa el manifiesto a «musica». */
async function ajustar(ctx) {
  const c = ctx.carpeta;
  const m = leerJSON(RUTAS.manifiesto(c));
  if (!m) return errorDe('No encuentro las escenas del anuncio.', 'manifiesto.json');
  const cj = leerJSON(RUTAS.cancionJson(c));
  const mp3 = RUTAS.cancionMp3(c);
  if (!cj?.palabras?.length || !existe(mp3)) return errorDe('La canción elegida quedó sin sus tiempos.', 'audio/cancion.json');
  let nota = null;
  if (!cj.recorte) {
    const dur = Number(cj.duracion) || 0;
    const primera = Number(cj.palabras[0]?.inicio) || 0;
    const ultima = Number(cj.palabras[cj.palabras.length - 1]?.fin) || dur;
    const desde = primera > 0.6 ? Math.max(0, primera - 0.35) : 0;
    const hasta = dur - ultima > 3 ? Math.min(dur, ultima + 2.2) : dur;
    if (desde > 0 || hasta < dur) {
      const entera = path.join(c, 'audio', 'cancion-entera.mp3');
      if (!existe(entera)) fs.copyFileSync(mp3, entera);
      const largo = hasta - desde;
      const tmp = path.join(c, 'audio', `cancion.recorte-${process.pid}.mp3`);
      // (el fundido del final con volume: el ffmpeg de Remotion no trae afade)
      try {
        execFileSync(rutaFfmpeg(), ['-v', 'error', '-y', '-ss', desde.toFixed(3), '-i', entera, '-t', largo.toFixed(3), '-af', `volume='if(gt(t,${Math.max(0, largo - 1.2).toFixed(3)}),max(0,1-(t-${Math.max(0, largo - 1.2).toFixed(3)})/1.2),1)':eval=frame`, '-c:a', 'libmp3lame', '-b:a', '192k', tmp], { stdio: 'pipe', timeout: 120000 });
        fs.renameSync(tmp, mp3);
      } catch (e) {
        fs.rmSync(tmp, { force: true });
        return errorDe('No pude recortar la canción.', String(e?.stderr || e?.message || e).slice(0, 400));
      }
      const mover = (x) => ({ ...x, inicio: r3(Math.max(0, x.inicio - desde)), fin: r3(Math.max(0, x.fin - desde)) });
      cj.palabras = cj.palabras.map(mover);
      if (Array.isArray(cj.alignedWords)) cj.alignedWords = cj.alignedWords.map((w) => ({ ...w, startS: r3(Math.max(0, (w.startS || 0) - desde)), endS: r3(Math.max(0, (w.endS || 0) - desde)) }));
      cj.duracion = r3(largo);
      nota = `Recorté ${desde > 0 ? `${desde.toFixed(1)} s de intro` : ''}${desde > 0 && hasta < dur ? ' y ' : ''}${hasta < dur ? `${(dur - hasta).toFixed(1)} s del final` : ''}: el anuncio arranca con la primera palabra.`;
    }
    cj.recorte = { desde: r3(desde), hasta: r3(hasta), original: r3(dur) };
    escribirJSON(RUTAS.cancionJson(c), cj);
  }
  if (m.modo_audio !== 'musica') {
    m.modo_audio = 'musica';
    escribirJSON(RUTAS.manifiesto(c), m);
  }
  // lo que era de la voz de antes (si quedó algo) no va: los tiempos salen de la canción
  for (const f of ['voz.mp3', 'tiempos.json']) fs.rmSync(path.join(c, 'audio', f), { force: true });
  return { ok: true, nota };
}

export const PASOS = [
  { id: 'letra', nombre: 'Preparar la letra con tu guion', correr: letra },
  { id: 'saldo-cancion', nombre: 'Mirar tu saldo para la canción', correr: M.saldoCancion },
  { id: 'cancion', nombre: 'Componer tu canción', correr: M.cancion },
  { id: PASO_PAUSA, nombre: 'Elegir tu canción', correr: M.elegirCancion },
  { id: 'ajustar', nombre: 'Dejar la canción lista para tus escenas', correr: ajustar },
  { id: 'tiempos', nombre: 'Medir cada escena en la canción', correr: M.pasoTiempos },
  { id: 'montaje', nombre: 'Armar el montaje y los subtítulos', correr: M.montaje },
  { id: 'render', nombre: 'Exportar los videos', correr: M.render },
  { id: 'control-final', nombre: 'Revisar el video terminado', correr: M.controlFinal },
  { id: 'informe', nombre: 'Preparar el informe', correr: M.informe },
];

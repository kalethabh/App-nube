// SOLO EN MODO PRUEBA. Los clips del kie simulado son mudos, y el Scribe simulado no oye nada en ellos: una familia
// que revisa lo que se dice en cada clip (objeto parlante) lo rehacia hasta el tope y el informe decia que ningun
// personaje dijo su frase. doblarClipDePrueba() le pone a un clip mudo una voz sintetica con las palabras de su frase
// en la etiqueta que lee el Scribe simulado (produccion/pruebas/elevenlabs-simulado.js), como hace hablado.js
// (doblarDePrueba) con el podcast y la entrevista. En modo real no hace nada.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { RAIZ } from './rutas.js';
import { existe } from './archivos.js';
import { modoPrueba } from './procesos.js';
import { duracionMp4 } from './mp4.js';

let modSimulado = null;
async function simuladoDeVoz() {
  if (!modSimulado) modSimulado = await import(pathToFileURL(path.join(RAIZ, 'produccion', 'pruebas', 'elevenlabs-simulado.js')).href);
  return modSimulado;
}

function ffmpeg(args) {
  return new Promise((resolve, reject) =>
    execFile('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { windowsHide: true, timeout: 180000 }, (e, _out, err) =>
      e ? reject(new Error(String(err || e.message).slice(-400))) : resolve()
    )
  );
}

/**
 * Le pone voz a un clip mudo del simulador. `texto`: la frase que dice; `semilla`: para que cada voz suene distinta;
 * `mp3`: donde queda la voz suelta. Devuelve true si lo doblo (false: modo real, ya tenia voz o no hay clip).
 */
export async function doblarClipDePrueba(clip, texto, { semilla = 'prueba', mp3 } = {}) {
  if (!modoPrueba() || !existe(clip) || !String(texto || '').trim()) return false;
  const sim = await simuladoDeVoz();
  const info = await sim.leerPalabras(clip).catch(() => null);
  if (info?.palabras?.length) return false; // ya tiene su voz
  const dur = duracionMp4(clip) || 6;
  let velocidad = 1;
  let palabras = [];
  for (let k = 0; k < 6; k++) {
    palabras = sim.palabrasDeAlineacion(sim.tiemposDeTexto(texto, { velocidad, inicio: 0.25 }));
    const fin = palabras.at(-1)?.fin || 0;
    if (fin <= dur - 0.5) break;
    velocidad *= fin / Math.max(0.5, dur - 0.7);
  }
  const muestras = new Float32Array(Math.ceil(dur * sim.MUESTREO));
  sim.sumarVoz(muestras, palabras, { semilla });
  const salida = mp3 || `${clip}.voz-prueba.mp3`;
  fs.mkdirSync(path.dirname(salida), { recursive: true });
  await sim.escribirMp3(salida, muestras, { palabras });
  const tmp = `${clip}.doblado.mp4`;
  await ffmpeg(['-i', clip, '-i', salida, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-map_metadata', '1', '-movflags', 'use_metadata_tags', tmp]);
  fs.renameSync(tmp, clip);
  if (!mp3) fs.rmSync(salida, { force: true });
  return true;
}

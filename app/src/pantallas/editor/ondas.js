// Formas de onda para las pistas de audio de la línea de tiempo.
//
// - Voz en off, canción y música: se decodifica el archivo real en el navegador (Web Audio, gratis y
//   local) y se guardan los picos, 100 por segundo.
// - Voz dentro de los clips (UGC, podcast, entrevista): no hay un archivo de voz aparte, así que se
//   dibuja con los tiempos por palabra del plan: hay barras donde se habla y silencio donde no.
import { useEffect, useState } from 'react';

const POR_SEG = 100;
const cache = new Map(); // url -> Promise<{ picos, porSeg, duracion }>

export function picosDe(url) {
  if (!url) return Promise.resolve(null);
  if (!cache.has(url)) {
    const promesa = (async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error('No se pudo leer el audio');
      const buf = await r.arrayBuffer();
      const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const ctx = new Ctx(1, 1, 44100);
      const audio = await ctx.decodeAudioData(buf);
      const n = Math.max(1, Math.ceil(audio.duration * POR_SEG));
      const canales = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
      const paso = audio.sampleRate / POR_SEG;
      const picos = new Float32Array(n);
      let max = 0;
      // energía (RMS) de cada tramo de 10 ms: muestra mejor la dinámica que el pico
      for (let i = 0; i < n; i++) {
        const a = Math.floor(i * paso);
        const b = Math.min(canales[0].length, Math.floor((i + 1) * paso));
        let suma = 0;
        let cuenta = 0;
        for (const c of canales) {
          for (let j = a; j < b; j += 2) {
            suma += c[j] * c[j];
            cuenta += 1;
          }
        }
        const rms = cuenta ? Math.sqrt(suma / cuenta) : 0;
        picos[i] = rms;
        if (rms > max) max = rms;
      }
      // normalizado y un poco comprimido para que se lea bien en una pista chica
      if (max > 0) for (let i = 0; i < n; i++) picos[i] = Math.min(1, Math.pow(picos[i] / max, 0.75) * 1.05);
      return { picos, porSeg: POR_SEG, duracion: audio.duration };
    })();
    promesa.catch(() => cache.delete(url));
    cache.set(url, promesa);
  }
  return cache.get(url);
}

/** const datos = usePicos(url) -> null mientras carga (o si falla) */
export function usePicos(url) {
  const [datos, setDatos] = useState(null);
  useEffect(() => {
    let vivo = true;
    setDatos(null);
    if (!url) return undefined;
    picosDe(url).then(
      (d) => vivo && setDatos(d),
      () => vivo && setDatos(null)
    );
    return () => {
      vivo = false;
    };
  }, [url]);
  return datos;
}

/** Picos sintéticos a partir de los tiempos por palabra (para la voz que vive dentro de los clips). */
export function picosDePalabras(subtitulos, duracion) {
  const n = Math.max(1, Math.ceil(duracion * POR_SEG));
  const picos = new Float32Array(n);
  let semilla = 7;
  const azar = () => {
    semilla = (semilla * 16807) % 2147483647;
    return semilla / 2147483647;
  };
  for (let i = 0; i < n; i++) picos[i] = 0.02 + azar() * 0.03;
  for (const b of subtitulos || []) {
    for (const p of b.palabras || []) {
      const a = Math.max(0, Math.floor(p.inicio * POR_SEG));
      const z = Math.min(n, Math.ceil(p.fin * POR_SEG));
      const largo = Math.max(1, z - a);
      const fuerza = 0.55 + azar() * 0.4;
      for (let i = a; i < z; i++) {
        const k = (i - a) / largo;
        const sobre = Math.sin(Math.PI * Math.min(1, k * 1.15)) ** 0.6;
        picos[i] = Math.max(picos[i], fuerza * sobre * (0.55 + 0.45 * azar()));
      }
    }
  }
  return { picos, porSeg: POR_SEG, duracion };
}

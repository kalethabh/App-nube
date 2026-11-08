// Un solo reproductor de audio para las muestras (voces, canciones): si suena una y tocas otra,
// la primera se calla. Lo usan Nuevo anuncio y Estilos.
//
//   const { sonando, alternar } = useMuestraDeAudio();
//   <button onClick={() => alternar('voz-befen', urlVoz('befen-regulador-apetito'), { segundos: 9 })}>
import { useEffect, useSyncExternalStore } from 'react';

let audio = null;
let actual = null; // id de lo que suena
let corte = null;
const oyentes = new Set();
const avisar = () => oyentes.forEach((f) => f());

function parar() {
  clearTimeout(corte);
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  actual = null;
  avisar();
}

function tocar(id, url, { desde = 0, segundos = 10 } = {}) {
  parar();
  if (!audio) {
    audio = new Audio();
    audio.preload = 'auto';
    audio.addEventListener('ended', parar);
    audio.addEventListener('error', parar);
  }
  audio.src = url;
  try {
    audio.currentTime = desde;
  } catch {
    /* sin metadatos todavía */
  }
  actual = id;
  avisar();
  const p = audio.play();
  if (p && p.catch) p.catch(() => parar());
  if (segundos) corte = setTimeout(parar, segundos * 1000);
}

export function useMuestraDeAudio() {
  const sonando = useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    () => actual,
    () => null
  );
  return {
    sonando,
    alternar: (id, url, opciones) => (actual === id ? parar() : tocar(id, url, opciones)),
    parar,
  };
}

/** Al salir de la pantalla, que nada siga sonando. */
export function useCallarAlSalir() {
  useEffect(() => () => parar(), []);
}

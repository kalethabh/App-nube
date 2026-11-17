// «Solo el sonido»: la misma composición, pero sin dibujar nada.
//
// La exportación por tramos (produccion/exportar-edicion.js) arma la imagen por partes y el sonido aparte, en una
// pasada propia. Con un <OffthreadVideo> el navegador igual pide el cuadro de cada clip aunque no se saque ninguna
// foto (en la prueba, el sonido solo tardaba lo mismo que todo el video). En esta pasada cada clip va como <Audio> con
// LAS MISMAS opciones (archivo, recorte, velocidad, volumen cuadro a cuadro y mudo): Remotion mezcla el mismo sonido
// sin sacar ningún cuadro de los clips.
//
// Fuera de esa pasada (la vista previa del editor, el render de siempre) no cambia nada: es el OffthreadVideo de antes.
import { createContext, useContext } from 'react';
import { Audio, OffthreadVideo } from 'remotion';

export const SoloSonido = createContext(false);

/** OffthreadVideo, o solo su sonido si la composición se arma «solo sonido». */
export function VideoOSonido({ src, playbackRate, trimBefore, volume, muted, ...resto }) {
  const solo = useContext(SoloSonido);
  if (!solo) return <OffthreadVideo src={src} playbackRate={playbackRate} trimBefore={trimBefore} volume={volume} muted={muted} {...resto} />;
  if (muted) return null;
  return <Audio src={src} playbackRate={playbackRate} trimBefore={trimBefore} volume={volume} />;
}

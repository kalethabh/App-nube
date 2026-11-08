// El archivo de subtítulos .srt (para subirlo aparte a Meta, TikTok o YouTube).
// Sale de los mismos bloques que se ven en el video, con las palabras corregidas. El texto lo arma
// remotion/src/edicion/capas.mjs: el mismo que deja la exportación junto al MP4.
export { hacerSrt } from '@composicion/edicion/capas.mjs';

/** Descarga un texto como archivo, desde el navegador (no pasa por internet). */
export function descargarTexto(nombre, texto, tipo = 'application/x-subrip') {
  const url = URL.createObjectURL(new Blob(['﻿', texto], { type: `${tipo};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

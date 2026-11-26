import { escenasDe } from './catalogo-plantillas.js';
import { plantillaDe } from './plantillas.js';
/** Máximo de imágenes que puede cobrar una acción, incluidos sus dos formatos. */
export function imagenesDeLaAccion(brief, cuerpo = null) {
  const formatos = (brief?.formatos || ['1:1']).length;
  // plantillas: solo las escenas cuestan (una por variación con escena); lo que dibuja la app es gratis
  if (brief?.plantillas) {
    // (de un video: los cuadros son las escenas; no se pide ninguna)
    if (!cuerpo) return brief.video ? 0 : escenasDe(brief.cantidad, brief.plantillas.elegidas);
    if (cuerpo.tipo === 'prompt' || cuerpo.pulir === true) return 1;
    const v = String(cuerpo.pieza || '').split('_')[0];
    return cuerpo.carpeta && plantillaDe(cuerpo.carpeta, v)?.escena ? 1 : 0;
  }
  if (!cuerpo) return Number(brief?.cantidad || 0) * formatos;
  // (2026-11-26i) «Crear otro tamaño»: una imagen; «Más imágenes»: cantidad × los tamaños del lote
  if (cuerpo.accion === 'tamano') return 1;
  if (cuerpo.accion === 'mas') return Math.max(0, Math.min(10, Number(cuerpo.cantidad) || 0)) * formatos;
  if (cuerpo.tipo === 'prompt' || /_1x1$/.test(String(cuerpo.pieza || ''))) return formatos;
  // Una corrección en el vertical puede cambiar también el texto del cuadrado.
  return cuerpo.instruccion?.trim() ? formatos : 1;
}

export function costoMaximoDeLaAccion(precio, brief, cuerpo = null) {
  if (precio?.conChatGPT) return 0; // con tu ChatGPT: sin costo por imagen
  if (imagenesDeLaAccion(brief, cuerpo) === 0) return 0; // (lo que dibuja la app: gratis)
  const porImagen = Number(precio?.dolaresPorImagen);
  if (!(porImagen > 0)) return null;
  return Math.round(porImagen * imagenesDeLaAccion(brief, cuerpo) * 100) / 100;
}

export function costoAprobado(cuerpo, maximo) {
  const aprobado = cuerpo?.costoMaximoConfirmado;
  return maximo !== null && typeof aprobado === 'number' && Number.isFinite(aprobado) && aprobado >= maximo;
}

/** Máximo de imágenes que puede cobrar una acción, incluidos sus dos formatos. */
export function imagenesDeLaAccion(brief, cuerpo = null) {
  const formatos = (brief?.formatos || ['1:1']).length;
  if (!cuerpo) return Number(brief?.cantidad || 0) * formatos;
  if (cuerpo.tipo === 'prompt' || /_1x1$/.test(String(cuerpo.pieza || ''))) return formatos;
  // Una corrección en el vertical puede cambiar también el texto del cuadrado.
  return cuerpo.instruccion?.trim() ? formatos : 1;
}

export function costoMaximoDeLaAccion(precio, brief, cuerpo = null) {
  if (precio?.conChatGPT) return 0; // con tu ChatGPT: sin costo por imagen
  const porImagen = Number(precio?.dolaresPorImagen);
  if (!(porImagen > 0)) return null;
  return Math.round(porImagen * imagenesDeLaAccion(brief, cuerpo) * 100) / 100;
}

export function costoAprobado(cuerpo, maximo) {
  const aprobado = cuerpo?.costoMaximoConfirmado;
  return maximo !== null && typeof aprobado === 'number' && Number.isFinite(aprobado) && aprobado >= maximo;
}

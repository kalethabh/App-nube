// Presentación del copy: conserva el texto fuente de investigación y solo cambia su caja al mostrar/generar.
export function textoEmbudo(opcion) {
  return { titulo:String(opcion?.titulo || '').toLocaleUpperCase('es'), subtitulo:String(opcion?.subtitulo || '').toLocaleLowerCase('es') };
}

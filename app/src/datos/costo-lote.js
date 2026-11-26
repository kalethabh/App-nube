// El costo estimado de un lote de anuncios de imagen antes de generarlo (excepción a "sin precios" del 2026-11-09).
// Sin dependencias (ni React ni la API): lo usa el formulario por datos/imagenes.js y lo prueba la humo
// (app/herramientas/prueba-humo.mjs) importándolo directo.

/**
 * En dólares: { min, max } o null (min === max: un solo número). `costo` es el de GET /api/imagen-ads/opciones
 * ({ creditosPorImagen, dolaresPorImagen, dolaresPorCredito, margen, modelo }: lo manda el servidor) y `piezas` =
 * anuncios × formatos (el cuadrado y el vertical cuestan igual). Desde 2026-11-09 la app genera todo al primer intento
 * (la revisión no rehace nada sola): no se suma ningún margen, aunque el servidor todavía mande uno. Lo que el usuario
 * regenere después se cobra aparte.
 */
export function costoDelLote(costo, piezas) {
  const k = Math.max(0, Math.round(Number(piezas) || 0));
  // Con tu suscripción de ChatGPT no se cobra por imagen.
  if (costo?.conChatGPT) return k ? { min: 0, max: 0, conChatGPT: true } : null;
  const porImagen = Number(costo?.dolaresPorImagen);
  if (!k || !(porImagen > 0)) return null;
  const cr = Number(costo?.creditosPorImagen);
  const porCredito = Number(costo?.dolaresPorCredito);
  // (con los créditos, si vienen: el mismo número que da kie)
  const de = (x) => (cr > 0 && porCredito > 0 ? Math.round(x * cr * porCredito * 100) / 100 : Math.round(x * porImagen * 100) / 100);
  return { min: de(k), max: de(k) };
}

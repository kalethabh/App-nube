// Datos propios del tablero: las cuentas que salen de la lista de anuncios (anuncios del mes, estilos para los filtros).
// Sin dinero: el costo solo se ve en el informe de la entrega, cuando el anuncio ya está hecho.
/** { actividad: { [slug]: { ultima, activo } } }: vive en src/datos/produccion.js (lo usan también el menú y la barra). */
export { useActividad } from '../../datos/produccion.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Los anuncios terminados este mes (cuántos y de cuántos estilos distintos). */
export function hechosDelMes(anuncios, hoy = new Date()) {
  const mes = hoy.getMonth();
  const anio = hoy.getFullYear();
  const delMes = anuncios.filter((a) => {
    const f = new Date(a.fecha);
    return a.estado === 'listo' && f.getMonth() === mes && f.getFullYear() === anio;
  });
  return {
    mes: MESES[mes],
    anuncios: delMes.length,
    estilos: new Set(delMes.map((a) => a.estilo || a.estiloNombre)).size,
  };
}

/** "Buenos días" · "Buenas tardes" · "Buenas noches" */
export function saludo(hoy = new Date()) {
  const h = hoy.getHours();
  if (h >= 5 && h < 12) return 'Buenos días';
  if (h >= 12 && h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

export function fechaDeHoy(hoy = new Date()) {
  return hoy.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Para buscar sin importar tildes ni mayúsculas. */
export const normalizar = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

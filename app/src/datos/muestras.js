// Las muestras de los estilos (GET /api/estilos) para las ilustraciones: la portada del tablero y la bienvenida.
// En la PC de Diego son anuncios de temp/ (traen slug: se pueden abrir); en la del alumno, las que trae el paquete
// en app/muestras/ (sin slug: no son anuncios suyos, se ven y nada más).
//
//   const { muestras } = useMuestras(['claymation', 'crochet']);
//   -> [{ clave, slug | null, titulo, miniatura, video, duracion, estiloNombre }], primero las del orden pedido
import { useMemo } from 'react';
import { useEstilos } from './api.js';

export function muestrasDeEstilos(datos, orden = []) {
  const conMuestra = (datos?.estilos || []).filter((e) => e.muestra && (e.muestra.imagen || e.muestra.video));
  const porClave = new Map(conMuestra.map((e) => [e.clave, e]));
  const elegidos = [...orden.map((c) => porClave.get(c)).filter(Boolean), ...conMuestra.filter((e) => !orden.includes(e.clave))];
  return elegidos.map((e) => ({
    clave: e.clave,
    slug: e.muestra.slug || null,
    titulo: e.muestra.titulo || e.nombre,
    miniatura: e.muestra.imagen || null,
    video: e.muestra.video || null,
    duracion: e.muestra.duracion ?? null,
    estiloNombre: e.muestra.estiloNombre || e.nombre,
  }));
}

/** `orden` tiene que ser una constante (o memorizada): se usa para recalcular. */
export function useMuestras(orden) {
  const { datos, cargando } = useEstilos();
  const muestras = useMemo(() => muestrasDeEstilos(datos, orden), [datos, orden]);
  return { muestras, cargando: cargando && !datos };
}

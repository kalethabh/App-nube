// TUS ESTRUCTURAS GANADORAS: dónde viven (2026-11-26d). Pedido: «yo también pueda agregar». Van en tu biblioteca
// privada, nunca en la skill (que viaja con el instalador):
//   mis_archivos/biblioteca/estructuras/indice.json    { estructuras: [ entrada como las de formatos/indice.json ] }
//   mis_archivos/biblioteca/estructuras/P01.json       la ficha (el mismo esquema que estructuras/mv-XX.json)
//   mis_archivos/biblioteca/estructuras/img/P01.jpg    la imagen (solo como estructura)
// En las pruebas, todo dentro de temp/_modo-prueba-<puerto>/estructuras/ (nunca se tocan las tuyas).
// Este archivo no importa nada de imagen-ads (lo usa leerSkill, en verificar.js, para sumar las tuyas a la skill).
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, TEMP, PUERTO_DE_PRUEBA } from '../rutas.js';
import { leerJSON } from '../archivos.js';

export const DIR_PROPIAS = PUERTO_DE_PRUEBA ? path.join(TEMP, `_modo-prueba-${PUERTO_DE_PRUEBA}`, 'estructuras') : path.join(RAIZ, 'mis_archivos', 'biblioteca', 'estructuras');
export const INDICE_PROPIAS = path.join(DIR_PROPIAS, 'indice.json');
export const RE_ID_PROPIA = /^P\d{2,3}$/;

/** Las entradas de tus estructuras (con id P##, su ficha y su imagen). */
export function leerPropias() {
  const l = leerJSON(INDICE_PROPIAS)?.estructuras;
  return Array.isArray(l) ? l.filter((x) => x && RE_ID_PROPIA.test(String(x.id || '')) && x.estructura && x.referencia) : [];
}

/** La fecha del índice (0 si no hay): leerSkill vuelve a leer cuando cambia. */
export function marcaPropias() {
  try {
    return fs.statSync(INDICE_PROPIAS).mtimeMs;
  } catch {
    return 0;
  }
}

/** ¿Esta ruta absoluta está donde puede estar la imagen o la ficha de una estructura (mis_archivos/ o la de las tuyas)? */
export function rutaPermitida(abs) {
  for (const base of [path.join(RAIZ, 'mis_archivos'), DIR_PROPIAS]) {
    const rel = path.relative(base, abs);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return true;
  }
  return false;
}

/** Una ruta guardada en el índice (relativa a la raíz) -> absoluta, solo si está permitida; si no, null. */
export function absDePropia(rel) {
  if (!rel) return null;
  const abs = path.resolve(RAIZ, String(rel));
  return rutaPermitida(abs) ? abs : null;
}

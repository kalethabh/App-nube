// NOMBRES PROPIOS DE CADA GENERACIÓN (2026-11-26c). Pedido: dentro de la carpeta de un producto, cada landing, lote o
// anuncio es un bloque con su imagen y un nombre que el usuario elige («Ángulo 1», «Ángulo 2»…).
// No toca los archivos de la generación: guarda un índice aparte.
//   temp/_generaciones/nombres.json   { "<tipo>:<id>": "Ángulo 1", … }   (en las pruebas, dentro de _modo-prueba-<puerto>)
import fs from 'node:fs';
import path from 'node:path';
import { TEMP, PUERTO_DE_PRUEBA } from './rutas.js';
import { ErrorApp } from './productos.js';
import { leerJSON, escribirJSONSeguro } from './archivos.js';

export const TIPOS_CON_NOMBRE = ['imagenes', 'videos', 'embudo', 'landings', 'sketch', 'cambiar'];
const ARCHIVO = PUERTO_DE_PRUEBA ? path.join(TEMP, `_modo-prueba-${PUERTO_DE_PRUEBA}`, 'nombres-generaciones.json') : path.join(TEMP, '_generaciones', 'nombres.json');
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;

export function leerNombres() {
  const d = leerJSON(ARCHIVO);
  return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
}

/** Pone (o quita, con un nombre vacío) el nombre propio de una generación. */
export function ponerNombre(tipo, { id, nombre } = {}) {
  if (!TIPOS_CON_NOMBRE.includes(tipo)) throw new ErrorApp(404, 'No conozco ese tipo de generación.');
  if (typeof id !== 'string' || !ID.test(id)) throw new ErrorApp(400, 'Falta la generación a la que le pones nombre.');
  const limpio = String(nombre ?? '').replace(/\s+/g, ' ').trim();
  if (limpio.length > 80) throw new ErrorApp(400, 'El nombre puede tener hasta 80 letras.');
  const todos = leerNombres();
  if (limpio) todos[`${tipo}:${id}`] = limpio;
  else delete todos[`${tipo}:${id}`];
  fs.mkdirSync(path.dirname(ARCHIVO), { recursive: true });
  escribirJSONSeguro(ARCHIVO, todos);
  return { id, nombre: limpio || null };
}

/** Al borrar generaciones, su nombre propio también se va. */
export function olvidarNombres(tipo, ids = []) {
  const todos = leerNombres();
  let cambio = false;
  for (const id of ids) if (Object.hasOwn(todos, `${tipo}:${id}`)) { delete todos[`${tipo}:${id}`]; cambio = true; }
  if (cambio) escribirJSONSeguro(ARCHIVO, todos);
}

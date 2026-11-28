// Donde vive cada cosa. Todo lo de fuera de app/ se usa SOLO PARA LEER.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const RAIZ = path.resolve(APP, '..');

export const TEMP = path.join(RAIZ, 'temp'); // un anuncio por carpeta (solo lectura)
export const OUTPUT = path.join(RAIZ, 'output'); // los MP4 finales (solo lectura)
export const SKILLS = path.join(RAIZ, '.claude', 'skills'); // los 13 estilos (solo lectura)
export const ENV = path.join(RAIZ, '.env'); // solo se mira si cada clave existe; nunca se lee su valor hacia afuera

export const CONFIG_PRINCIPAL = path.join(APP, 'config.json'); // ajustes de la app (lo unico que la app escribe)
export const DIST = path.join(APP, 'dist');
export const RUTAS_API = path.join(APP, 'server', 'rutas');

export const HOST = process.env.KADS_BIND_HOST === '0.0.0.0' ? '0.0.0.0' : '127.0.0.1';
// 4455 siempre. PUERTO=<n> en el entorno es solo para las pruebas (cada probador levanta su propia app en otro
// puerto, en modo prueba). El 4321 es de Landing Studio: nunca se usa.
const PUERTO_PEDIDO = Number(process.env.PUERTO);
export const PUERTO = Number.isInteger(PUERTO_PEDIDO) && PUERTO_PEDIDO >= 1024 && PUERTO_PEDIDO <= 65535 && PUERTO_PEDIDO !== 4321 ? PUERTO_PEDIDO : 4455;
/**
 * El puerto de una app de prueba (null en la de siempre). Una app de prueba es aparte de las demas: su propio
 * mando (temp/.conductor-mando-<puerto>.json), sus propios simuladores (temp/_modo-prueba-<puerto>/) y solo retoma
 * los anuncios que creo ella (brief.puerto). La de siempre no toca los anuncios de una app de prueba.
 */
export const PUERTO_DE_PRUEBA = PUERTO !== 4455 ? PUERTO : null;

/**
 * Los ajustes que lee y escribe esta app. Una app de prueba tiene los suyos (temp/_modo-prueba-<puerto>/config.json,
 * que arrancan como una copia de los de siempre): lo que cambie un probador (la voz de cada estilo, cuantos a la vez)
 * no toca los ajustes de verdad.
 */
export const CONFIG = PUERTO_DE_PRUEBA ? path.join(TEMP, `_modo-prueba-${PUERTO_DE_PRUEBA}`, 'config.json') : CONFIG_PRINCIPAL;

/** true si esta app puede retomar sola este anuncio (por su brief): cada app, los suyos. */
export const esDeEstaApp = (brief) => (PUERTO_DE_PRUEBA ? brief?.puerto === PUERTO_DE_PRUEBA : !brief?.puerto);

// Precio de kie.ai que usa el motor para pasar creditos a dolares.
export const DOLARES_POR_CREDITO = 0.005;

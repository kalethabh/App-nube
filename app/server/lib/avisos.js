// Los avisos de la revision de un anuncio: lo que la IA (o la transcripcion, o el control final) noto en una pieza.
// Desde 2026-11-09 la app genera todo al primer intento y NO regenera sola por calidad: la revision solo deja un aviso
// en la pieza y el usuario decide (Regenerar, «¿Que salio mal?», «Corregir esto», subir su propio video).
//
//   temp/<slug>/app/avisos.json = { v: 1, piezas: { '<clave>': [ { fuente, paso, texto, sugerencia?, fecha } ] } }
//
// <clave> = el id de la pieza en la pantalla del proceso (app/src/pantallas/produccion/modelo.js): 'img:toma-4-inicial',
// 'img:toma-4-final', 'vid:toma-4', 'img:broll-2', 'vid:broll-2', 'vid:paso-3', 'img:<hoja>', 'vid:gancho-1b'...
// fuente: 'revision-ia' | 'transcripcion' | 'control'. texto: en español, para el alumno, corto y sin jerga.
// sugerencia (opcional): los campos de prompt que la revision ya propuso ({ prompt_imagen_inicial, prompt_video, ... }),
// para «Corregir esto» sin otra sesion de la IA. arreglo (opcional): un cambio gratis que no es un prompt (hoy, el
// segundo del lugar que vuelve de UGC: { lugar, segundo }), tambien para «Corregir esto».
//
//   anotarAviso(carpeta, clave, { fuente, paso, texto, sugerencia })   agrega (sin repetir el mismo texto del mismo paso)
//   leerAvisos(carpeta)                -> { '<clave>': [ ... ] } (vacio si no hay)
//   avisosDe(carpeta, clave)           -> [ ... ]
//   limpiarAvisosDe(carpeta, claves)   saca los avisos de esas piezas (al regenerarlas); claves: string | string[]
//   limpiarAvisosDelPaso(carpeta, paso) saca los de un paso (antes de que ese paso vuelva a revisar)
//   limpiarAvisos(carpeta, { paso, claves, fuente })  saca los que cumplen TODO lo que se pasa (una pieza que se vuelve
//                                      a mirar en un paso: sus avisos de ese paso, y solo de esa fuente si se dice)
//   clavesDeLaPieza('toma-4')          -> ['vid:toma-4', 'img:toma-4-inicial', 'img:toma-4-final'] (y 'broll-N', 'paso-K')
//   notaDeAvisos(3)                    -> 'La revisión dejó 3 avisos: míralos en el proceso.' (la nota de un paso)
//   nombreDeLaPieza('vid:toma-5')      -> 'Escena 5' ('Imagen de apoyo 2', 'Paso 3', 'Hoja de Host A'...)
//   listaDeAvisos(carpeta)             -> [{ clave, pieza, texto, textos, sugerencia, fuentes }] una por pieza, en el
//                                      orden del anuncio (la entrega y el informe)
//
// Lo escribe y lo lee SOLO este modulo, con escritura segura (nunca un archivo a medias).
import path from 'node:path';
import { leerJSON, escribirJSONSeguro } from './archivos.js';
import { tituloDeSlug } from './anuncios.js';

const ARCHIVO = path.join('app', 'avisos.json');
const MAX_TEXTO = 600;
const MAX_POR_PIEZA = 20;

const ruta = (carpeta) => path.join(carpeta, ARCHIVO);
const claveValida = (c) => typeof c === 'string' && /^(img|vid):[A-Za-z0-9._-]{1,120}$/.test(c);

function leer(carpeta) {
  const d = leerJSON(ruta(carpeta));
  const piezas = d && typeof d === 'object' && d.piezas && typeof d.piezas === 'object' && !Array.isArray(d.piezas) ? d.piezas : {};
  const limpio = {};
  for (const [k, v] of Object.entries(piezas)) if (claveValida(k) && Array.isArray(v)) limpio[k] = v.filter((a) => a && typeof a.texto === 'string');
  return limpio;
}

function guardar(carpeta, piezas) {
  const sinVacias = Object.fromEntries(Object.entries(piezas).filter(([, v]) => Array.isArray(v) && v.length));
  escribirJSONSeguro(ruta(carpeta), { v: 1, piezas: sinVacias });
}

/**
 * Agrega un aviso a una pieza. No repite el mismo texto del mismo paso. Devuelve true si lo anoto.
 * `arreglo` (opcional, ademas de la sugerencia): un cambio gratis que no es un prompt, para «Corregir esto». Hoy solo
 * el lugar que vuelve de UGC: { lugar: '<id de la referencia>', segundo: 4.5 } (el fotograma sale de otro segundo).
 */
export function anotarAviso(carpeta, clave, { fuente = 'revision-ia', paso = null, texto, sugerencia = null, arreglo = null } = {}) {
  if (!carpeta || !claveValida(clave)) return false;
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXTO);
  if (!t) return false;
  const piezas = leer(carpeta);
  const lista = piezas[clave] || [];
  if (lista.some((a) => a.texto === t && (a.paso ?? null) === (paso ?? null))) return false;
  const aviso = { fuente: String(fuente || 'revision-ia'), paso: paso ? String(paso) : null, texto: t, fecha: new Date().toISOString() };
  if (sugerencia && typeof sugerencia === 'object' && !Array.isArray(sugerencia)) {
    const s = Object.fromEntries(Object.entries(sugerencia).filter(([k, v]) => /^prompt_[a-z_]+$/.test(k) && typeof v === 'string' && v.trim()));
    if (Object.keys(s).length) aviso.sugerencia = s;
  }
  if (arreglo && typeof arreglo === 'object' && /^[a-z0-9][a-z0-9_-]*$/i.test(String(arreglo.lugar || '')) && Number.isFinite(Number(arreglo.segundo)) && Number(arreglo.segundo) >= 0) {
    aviso.arreglo = { lugar: String(arreglo.lugar), segundo: Number(arreglo.segundo) };
  }
  piezas[clave] = [...lista, aviso].slice(-MAX_POR_PIEZA);
  guardar(carpeta, piezas);
  return true;
}

/** Todos los avisos del anuncio: { '<clave>': [ { fuente, paso, texto, sugerencia?, fecha } ] }. */
export function leerAvisos(carpeta) {
  return carpeta ? leer(carpeta) : {};
}

export const avisosDe = (carpeta, clave) => (leerAvisos(carpeta)[clave] || []).slice();

/** Saca los avisos de esas piezas (al regenerarlas el usuario). */
export function limpiarAvisosDe(carpeta, claves) {
  if (!carpeta) return;
  const lista = (Array.isArray(claves) ? claves : [claves]).filter(claveValida);
  if (!lista.length) return;
  const piezas = leer(carpeta);
  let cambio = false;
  for (const c of lista) if (piezas[c]) {
    delete piezas[c];
    cambio = true;
  }
  if (cambio) guardar(carpeta, piezas);
}

/** Saca los avisos que dejo un paso (antes de que ese paso vuelva a revisar, por ejemplo tras regenerar). */
export function limpiarAvisosDelPaso(carpeta, paso) {
  if (!carpeta || !paso) return;
  const piezas = leer(carpeta);
  let cambio = false;
  for (const [k, v] of Object.entries(piezas)) {
    const quedan = v.filter((a) => a.paso !== paso);
    if (quedan.length !== v.length) {
      piezas[k] = quedan;
      cambio = true;
    }
  }
  if (cambio) guardar(carpeta, piezas);
}

/**
 * Saca los avisos que cumplen TODO lo que se pasa: `paso` (el paso que los dejo), `claves` (string | string[]: esas
 * piezas) y `fuente` ('revision-ia' | 'transcripcion' | 'control'). Sin nada, no saca nada. Para cuando un paso vuelve
 * a mirar algunas piezas: lo que dijo antes de ellas ya no vale, lo de las demas queda.
 */
export function limpiarAvisos(carpeta, { paso = null, claves = null, fuente = null } = {}) {
  if (!carpeta || (!paso && !claves && !fuente)) return;
  const solo = claves === null ? null : new Set((Array.isArray(claves) ? claves : [claves]).filter(claveValida));
  if (solo && !solo.size) return;
  const piezas = leer(carpeta);
  let cambio = false;
  for (const [k, v] of Object.entries(piezas)) {
    if (solo && !solo.has(k)) continue;
    const quedan = v.filter((a) => !((!paso || a.paso === paso) && (!fuente || a.fuente === fuente)));
    if (quedan.length !== v.length) {
      piezas[k] = quedan;
      cambio = true;
    }
  }
  if (cambio) guardar(carpeta, piezas);
}

/** Cuantas piezas tienen al menos un aviso (de ese `paso`, si se dice). */
export function piezasConAviso(carpeta, { paso = null } = {}) {
  return Object.values(leerAvisos(carpeta)).filter((v) => v.some((a) => !paso || a.paso === paso)).length;
}

/** ¿Esa pieza tiene algun aviso (de ese `paso`, si se dice)? */
export const tieneAviso = (carpeta, clave, { paso = null } = {}) => avisosDe(carpeta, clave).some((a) => !paso || a.paso === paso);

/** La nota de un paso que dejo avisos (null si no dejo ninguno). `n`: cuantas piezas quedaron con aviso. */
export function notaDeAvisos(n) {
  const k = Number(n) || 0;
  if (k <= 0) return null;
  return k === 1 ? 'La revisión dejó un aviso: míralo en el proceso.' : `La revisión dejó ${k} avisos: míralos en el proceso.`;
}

/** El nombre de una pieza para el alumno, sin jerga: 'Escena 5', 'Escena 5 · imagen de inicio', 'Imagen de apoyo 2'. */
export function nombreDeLaPieza(clave) {
  const c = String(clave ?? '');
  let m = c.match(/^img:toma-(\d+)-(inicial|final)$/);
  if (m) return `Escena ${m[1]} · ${m[2] === 'inicial' ? 'imagen de inicio' : 'imagen final'}`;
  m = c.match(/^vid:toma-(\d+)$/);
  if (m) return `Escena ${m[1]}`;
  m = c.match(/^(img|vid):broll-(\d+)$/);
  if (m) return `Imagen de apoyo ${m[2]}${m[1] === 'img' ? ' · imagen' : ''}`;
  m = c.match(/^vid:paso-(\d+)$/);
  if (m) return `Paso ${m[1]}`;
  m = c.match(/^vid:gancho-(.+)$/);
  if (m) return `Gancho ${m[1].replace(/^\d+/, '').toUpperCase() || m[1]}`;
  m = c.match(/^img:icono-(.+)$/);
  if (m) return `Icono «${m[1].replace(/[-_]+/g, ' ')}»`;
  m = c.match(/^(img|vid):(.+)$/);
  if (m) return m[2] === 'producto' ? 'Tu producto' : `Hoja de ${tituloDeSlug(m[2])}`;
  return 'Pieza';
}

/** Para ordenar como el anuncio: hojas e iconos, escenas (imagen de inicio, final, clip, paso), apoyo y ganchos. */
function ordenDe(clave) {
  const c = String(clave);
  let m = c.match(/^(img|vid):toma-(\d+)(?:-(inicial|final))?$/);
  if (m) return [1, Number(m[2]), m[3] === 'inicial' ? 0 : m[3] === 'final' ? 1 : 2];
  m = c.match(/^vid:paso-(\d+)$/);
  if (m) return [1, Number(m[1]), 3];
  m = c.match(/^(img|vid):broll-(\d+)$/);
  if (m) return [2, Number(m[2]), m[1] === 'img' ? 0 : 1];
  if (/^vid:gancho-/.test(c)) return [3, 0, 0];
  return [0, 0, /^img:icono-/.test(c) ? 1 : 0];
}

/**
 * Los avisos del anuncio para la entrega y el informe: una entrada por pieza, en el orden del anuncio.
 *   { clave, pieza: 'Escena 5', texto: lo que noto (si son varios, juntos), textos: [...], sugerencia: bool (hay una
 *     instruccion lista para «Corregir esto»), fuentes: ['revision-ia', 'transcripcion'] }
 */
export function listaDeAvisos(carpeta) {
  const piezas = leerAvisos(carpeta);
  const conPunto = (t) => (/[.!?…][»")]*$/.test(t) ? t : `${t}.`);
  return Object.entries(piezas)
    .filter(([, v]) => v.length)
    .sort(([a], [b]) => {
      const x = ordenDe(a);
      const y = ordenDe(b);
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || a.localeCompare(b);
    })
    .map(([clave, v]) => {
      const textos = [...new Set(v.map((a) => a.texto))];
      return {
        clave,
        pieza: nombreDeLaPieza(clave),
        texto: textos.length === 1 ? textos[0] : textos.map(conPunto).join(' '),
        textos,
        sugerencia: v.some((a) => (a.sugerencia && Object.keys(a.sugerencia).length) || a.arreglo),
        fuentes: [...new Set(v.map((a) => a.fuente))],
      };
    });
}

/** Las claves de pantalla de una pieza de rehacer ('toma-4', 'broll-2', 'paso-3', 'gancho-1b'). */
export function clavesDeLaPieza(pieza) {
  const p = String(pieza ?? '');
  let m = p.match(/^toma-(\d+)$/);
  if (m) return [`vid:toma-${m[1]}`, `img:toma-${m[1]}-inicial`, `img:toma-${m[1]}-final`];
  m = p.match(/^broll-(\d+)$/);
  if (m) return [`vid:broll-${m[1]}`, `img:broll-${m[1]}`];
  m = p.match(/^paso-(\d+)$/);
  if (m) return [`vid:paso-${m[1]}`];
  m = p.match(/^gancho-([A-Za-z0-9-]+)$/);
  if (m) return [`vid:gancho-${m[1]}`];
  return [];
}

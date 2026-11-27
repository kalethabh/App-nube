// La carpeta de un lote de ANUNCIOS DE IMAGEN en disco (ESPECIFICACION-imagen-ads.md §3): donde va cada cosa, los
// nombres de las piezas, la firma de una imagen y la escritura de una vez (temporal + renombre).
//
//   temp/_img-<nombre>-<aaaammdd-hhmm>[-n]/
//     app/brief.json · app/conductor.json · app/informe.json · app/registro/ · app/gasto/
//     app/imagen-ads/estado.json (la familia) · pedidos.json (las rutas) · bloqueo.json (Claude) · motor/T###.json
//     lote.json · entrada/ · producto.json, estrategia.json, plan.json, V##.json · ajustes/ · revision/
//     img/<pieza>.png (solo las finales) · nuevas/ · prompts/ · versiones/ · final/ (con el logo)
//
// Los nombres de las piezas son los de produccion/imagen-ads.js (RE_PIEZA, piezaId, numeroDeV): se repiten aca porque
// son una linea cada uno y asi las rutas y el estado no dependen del motor para algo tan chico.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { TEMP } from '../rutas.js';
import { listar, escribirJSONSeguro, escribirSeguro } from '../archivos.js';

export const FAMILIA = 'imagen-ads';
export const RE_LOTE = /^_img-[a-z0-9-]{1,40}-\d{8}-\d{4}(-\d+)?$/;
export const RE_PIEZA = /^V\d{2,3}_(1x1|9x16|4x5)$/;
export const RE_V = /^V\d{2,3}$/;
// (2026-11-26i) 4:5 (retrato): un tamaño extra que se crea de un anuncio ya hecho, desde su cuadrado, como el 9:16
export const FORMATOS = ['1:1', '9:16', '4:5'];
const SUFIJO = { '1:1': '1x1', '9:16': '9x16', '4:5': '4x5' };
const DE_SUFIJO = { '1x1': '1:1', '9x16': '9:16', '4x5': '4:5' };
export const POSICIONES = ['arriba-izquierda', 'arriba-centro', 'arriba-derecha', 'abajo-izquierda', 'abajo-centro', 'abajo-derecha'];
export const NOMBRE_POSICION = {
  'arriba-izquierda': 'Arriba a la izquierda',
  'arriba-centro': 'Arriba al centro',
  'arriba-derecha': 'Arriba a la derecha',
  'abajo-izquierda': 'Abajo a la izquierda',
  'abajo-centro': 'Abajo al centro',
  'abajo-derecha': 'Abajo a la derecha',
};
export const MAXIMO_VARIACIONES = 100;
// (2026-11-27c) «que me deje colocar la cantidad de referencias que quiera»: hasta 99 (R01…R99)
export const MAXIMO_REFERENCIAS = 99;

export const piezaId = (v, formato) => `${v}_${SUFIJO[formato] || '9x16'}`;
export const numeroDeV = (v) => Number(String(v).slice(1));
export const vDe = (pieza) => String(pieza).split('_')[0];
export const formatoDe = (pieza) => DE_SUFIJO[String(pieza).split('_')[1]] || '9:16';
/** El sufijo de un formato ('9:16' -> '9x16'), para nombres de archivo. */
export const sufijoDe = (formato) => SUFIJO[formato] || '9x16';
export const idDeV = (n) => `V${String(n).padStart(2, '0')}`;
export const idsDelLote = (n) => Array.from({ length: Math.max(0, Number(n) || 0) }, (_, i) => idDeV(i + 1));
/** Por numero de variacion (V100 despues de V99) y, en la misma, primero el cuadrado. */
export const ordenDePiezas = (a, b) => numeroDeV(vDe(a)) - numeroDeV(vDe(b)) || FORMATOS.indexOf(formatoDe(a)) - FORMATOS.indexOf(formatoDe(b));
export const ordenDeV = (a, b) => numeroDeV(a) - numeroDeV(b);
export const nombreFormato = (formato) => (formato === '1:1' ? 'cuadrado' : formato === '4:5' ? 'retrato 4:5' : 'vertical');
/**
 * (2026-11-26i) Los tamaños de UNA variación: los del lote (brief.formatos) más los que se pidieron solo para ella
 * («Crear otro tamaño»: brief.extras = { V03: ['9:16', '4:5'] }), en orden.
 */
export const formatosDe = (brief, v) => FORMATOS.filter((f) => (brief?.formatos || ['1:1']).includes(f) || (brief?.extras?.[v] || []).includes(f));

export const carpetaDe = (lote) => path.join(TEMP, lote);
export const relDe = (lote) => `temp/${lote}`;

// ---------------------------------------------------------------- rutas de cada cosa (c = la carpeta del lote)

export const R = {
  dirApp: (c) => path.join(c, 'app'),
  brief: (c) => path.join(c, 'app', 'brief.json'),
  conductor: (c) => path.join(c, 'app', 'conductor.json'),
  informe: (c) => path.join(c, 'app', 'informe.json'),
  dir: (c) => path.join(c, 'app', 'imagen-ads'),
  estado: (c) => path.join(c, 'app', 'imagen-ads', 'estado.json'),
  pedidos: (c) => path.join(c, 'app', 'imagen-ads', 'pedidos.json'),
  bloqueo: (c) => path.join(c, 'app', 'imagen-ads', 'bloqueo.json'),
  motor: (c) => path.join(c, 'app', 'imagen-ads', 'motor'),
  orden: (c, t) => path.join(c, 'app', 'imagen-ads', 'motor', `${t}.json`),
  resultado: (c, t) => path.join(c, 'app', 'imagen-ads', 'motor', `${t}.resultado.json`),
  subidas: (c) => path.join(c, 'app', 'imagen-ads', 'subidas'),
  registro: (c, tanda) => path.join(c, 'app', 'registro', `imagen-ads-${tanda}.jsonl`),
  lote: (c) => path.join(c, 'lote.json'),
  entrada: (c) => path.join(c, 'entrada'),
  ficha: (c) => path.join(c, 'entrada', 'ficha-producto.json'),
  anterior: (c) => path.join(c, 'entrada', 'lote-anterior.json'),
  usados: (c) => path.join(c, 'entrada', 'usados.json'),
  referencias: (c) => path.join(c, 'entrada', 'referencias'),
  investigacion: (c, ext = 'md') => path.join(c, 'entrada', `investigacion.${ext}`),
  logo: (c) => path.join(c, 'entrada', 'logo.png'),
  logoJson: (c) => path.join(c, 'entrada', 'logo.json'),
  productoJson: (c) => path.join(c, 'producto.json'),
  estrategia: (c) => path.join(c, 'estrategia.json'),
  plan: (c) => path.join(c, 'plan.json'),
  v: (c, v) => path.join(c, `${v}.json`),
  ajustes: (c) => path.join(c, 'ajustes'),
  ajuste: (c, id) => path.join(c, 'ajustes', `${id}.json`),
  dirRevision: (c) => path.join(c, 'revision'),
  revision: (c, id) => path.join(c, 'revision', `${id}.json`),
  vista: (c, p) => path.join(c, 'revision', `${p}_vista.jpg`),
  recorte: (c, p, i) => path.join(c, 'revision', `${p}_r${i}.png`),
  firmaRecortes: (c, p) => path.join(c, 'revision', `${p}.firma`),
  dirImg: (c) => path.join(c, 'img'),
  img: (c, p) => path.join(c, 'img', `${p}.png`),
  dirFinal: (c) => path.join(c, 'final'),
  final: (c, p) => path.join(c, 'final', `${p}.png`),
  finalJson: (c, p) => path.join(c, 'final', `${p}.json`),
  prompt: (c, p) => path.join(c, 'prompts', `${p}.txt`),
  dirVersiones: (c) => path.join(c, 'versiones'),
  indiceVersiones: (c) => path.join(c, 'versiones', 'indice.json'),
  versionPng: (c, p, n) => path.join(c, 'versiones', `${p}.v${n}.png`),
  versionTxt: (c, p, n) => path.join(c, 'versiones', `${p}.v${n}.txt`),
};

/** La foto del producto copiada al lote (entrada/producto.<ext>), o null. Relativa a la carpeta del lote. */
export function fotoDelLote(c) {
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) if (fs.existsSync(path.join(c, 'entrada', `producto.${ext}`))) return `entrada/producto.${ext}`;
  return null;
}

// ---------------------------------------------------------------- firma, escritura y numeros

/** "tamaño-mtime" de un archivo (lo que miró la revision), o null si no esta. */
export function firma(abs) {
  try {
    const st = fs.statSync(abs);
    return st.isFile() ? `${st.size}-${Math.round(st.mtimeMs)}` : null;
  } catch {
    return null;
  }
}

/** sha1 del contenido de un archivo (null si no esta). */
export function sha1Archivo(abs) {
  try {
    return crypto.createHash('sha1').update(fs.readFileSync(abs)).digest('hex');
  } catch {
    return null;
  }
}

/** Un JSON de una vez: nunca queda a medias (temporal + renombre, con reintentos en Windows). */
export function guardarJSON(ruta, valor) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  escribirJSONSeguro(ruta, valor);
  return valor;
}

/** Un texto de una vez. */
export function guardarTexto(ruta, texto) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  escribirSeguro(ruta, texto);
}

/** El numero mas alto de los archivos de `dir` que casan con `re` (con el numero en el grupo 1), mas uno. */
export function siguienteEnDisco(dir, re) {
  let max = 0;
  for (const n of listar(dir)) {
    const m = n.match(re);
    if (m) max = Math.max(max, Number(m[1]) || 0);
  }
  return max + 1;
}

/** "T009", "R012"… */
export const conCeros = (letra, n) => `${letra}${String(n).padStart(3, '0')}`;

/** Lo que trae un nombre para el zip y las descargas: sin barras ni caracteres que Windows no acepta. */
export function nombreSeguro(texto, respaldo = 'Anuncios') {
  const t = String(texto || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
    .slice(0, 80);
  return t || respaldo;
}

/** "Crema Luna!" -> "crema-luna" (para el nombre de cada descarga). */
export function kebab(texto, max = 40) {
  return (
    String(texto || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, max)
      .replace(/-+$/g, '') || 'anuncio'
  );
}

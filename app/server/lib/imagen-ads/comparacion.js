// LA COMPARACIÓN CONTRA LA ESTRUCTURA GANADORA (2026-11-26b). Pedido: «por cada imagen generada, un montaje lado a lado
// (referencia a la izquierda, la nuestra a la derecha) en temp/<lote>/comparacion/, 7 puntajes de 0 a 10 (estructura,
// dolor visual, titular, texto limpio, frasco fiel, oferta y confianza, diferencia real); pasa la que saca 8 o más en
// todos; la que falla solo se marca para rehacer (rehacer necesita mi sí, con npm run rehacer); informe.md».
// Los puntajes los da la IA en la revisión (sesiones.js: textoRevisionEstructuras), con la referencia de cada pieza.
//
//   estructurasDelLote(carpeta)            { V01: { formato_id, ficha, referencia (abs), copia (rel del lote) } }
//   copiarEstructuras(carpeta)             las imágenes de referencia al lote (entrada/estructuras/), para la revisión
//   evaluarPuntajes(puntajes)              { pasa, fallan: [criterio] }
//   armarComparacion(carpeta, brief, est)  los montajes y comparacion/informe.md -> { piezas, informe }
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { RAIZ } from '../rutas.js';
import { leerJSON, existe } from '../archivos.js';
import { R, piezaId } from './disco.js';
import { leerSkill } from './verificar.js';
import { rutaPermitida } from './propias-disco.js';
import { fichaDe, rutaFicha } from './estructuras.js';
import { CRITERIOS, NOTA_MINIMA, NOMBRES_CRITERIOS } from './variedad.js';

export { NOMBRES_CRITERIOS };

/** Las variaciones del lote que salen de una estructura ganadora (formato con `referencia` en el índice). */
export function estructurasDelLote(carpeta) {
  const plan = leerJSON(R.plan(carpeta));
  const { formatos } = leerSkill();
  const out = {};
  for (const x of plan?.variaciones || []) {
    const f = formatos.get(x?.formato_id);
    if (!f?.referencia) continue;
    const referencia = path.resolve(RAIZ, f.referencia);
    if (!rutaPermitida(referencia)) continue;
    const ficha = fichaDe(f);
    out[x.id] = { formato_id: f.id, nombre: f.nombre, ficha, referencia, copia: `entrada/estructuras/${path.basename(referencia)}`, propia: f.marca === 'propia' };
  }
  return out;
}

/** Copia al lote las imágenes de unas estructuras (por id de formato): { F33: 'entrada/estructuras/mv-01.jpg' }. */
export function copiarReferenciasDe(carpeta, ids = []) {
  const { formatos } = leerSkill();
  const out = {};
  for (const id of ids) {
    const f = formatos.get(id);
    if (!f?.referencia) continue;
    const abs = path.resolve(RAIZ, f.referencia);
    if (!rutaPermitida(abs) || !existe(abs)) continue;
    const rel = `entrada/estructuras/${path.basename(abs)}`;
    if (!existe(path.join(carpeta, rel))) {
      fs.mkdirSync(path.join(carpeta, 'entrada', 'estructuras'), { recursive: true });
      fs.copyFileSync(abs, path.join(carpeta, rel));
    }
    copiarFichaPropia(carpeta, f);
    anotarMapa(carpeta, { [id]: rel });
    out[id] = rel;
  }
  return out;
}

/**
 * (2026-11-26d) Tus estructuras: su ficha vive en tu biblioteca, que la IA no puede leer; se copia al lote
 * (entrada/estructuras/P01.json). -> la ruta relativa al lote, o null si no es tuya.
 */
export function copiarFichaPropia(carpeta, f) {
  if (f?.marca !== 'propia') return null;
  const abs = rutaFicha(f);
  if (!abs || !existe(abs)) return null;
  const rel = `entrada/estructuras/${f.id}.json`;
  fs.mkdirSync(path.join(carpeta, 'entrada', 'estructuras'), { recursive: true });
  fs.copyFileSync(abs, path.join(carpeta, rel));
  return rel;
}

/**
 * (2026-11-26d) entrada/estructuras/mapa.json { F33: 'entrada/estructuras/mv-01.jpg', P01: '…/P01.jpg' }: el generador
 * (produccion/generar-imagen-ads.js) busca ahí la imagen de cada estructura, también las tuyas.
 */
function anotarMapa(carpeta, nuevos) {
  const archivo = path.join(carpeta, 'entrada', 'estructuras', 'mapa.json');
  const antes = leerJSON(archivo) || {};
  const todo = { ...antes, ...nuevos };
  if (JSON.stringify(todo) === JSON.stringify(antes)) return;
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  fs.writeFileSync(archivo, JSON.stringify(todo, null, 2) + '\n');
}

/** Copia al lote las imágenes de referencia que usa (la revisión solo lee la carpeta del lote). */
export function copiarEstructuras(carpeta) {
  const e = estructurasDelLote(carpeta);
  const { formatos } = leerSkill();
  for (const x of Object.values(e)) {
    const destino = path.join(carpeta, x.copia);
    if (!existe(x.referencia)) continue;
    if (!existe(destino)) {
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.copyFileSync(x.referencia, destino);
    }
    x.copiaFicha = copiarFichaPropia(carpeta, formatos.get(x.formato_id));
    anotarMapa(carpeta, { [x.formato_id]: x.copia });
  }
  return e;
}

/** ¿Pasa? Con 8 o más en los 7 criterios. Sin puntajes: no se sabe (null). */
export function evaluarPuntajes(puntajes) {
  if (!puntajes || typeof puntajes !== 'object') return { pasa: null, fallan: [] };
  const fallan = CRITERIOS.filter((k) => !(Number(puntajes[k]) >= NOTA_MINIMA));
  return { pasa: fallan.length === 0, fallan };
}

/** El montaje: la referencia a la izquierda y la nuestra a la derecha, a la misma altura (1080), con un margen. */
function montar(ref, img, destino) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const tmp = `${destino}.${process.pid}.tmp.jpg`;
  execFileSync('ffmpeg', [
    '-v', 'error', '-y', '-i', ref, '-i', img,
    '-filter_complex', '[0:v]scale=-2:1080,pad=iw+40:ih+80:20:60:white[a];[1:v]scale=-2:1080,pad=iw+40:ih+80:20:60:white[b];[a][b]hstack=inputs=2[s]',
    '-map', '[s]', '-frames:v', '1', '-q:v', '3', tmp,
  ]);
  fs.renameSync(tmp, destino);
}

/** Los montajes y el informe de las piezas cuadradas que salen de una estructura. */
export function armarComparacion(carpeta, brief, est) {
  const e = estructurasDelLote(carpeta);
  const ids = Object.keys(e);
  if (!ids.length) return { piezas: [], informe: null };
  const dir = path.join(carpeta, 'comparacion');
  const filas = [];
  for (const v of ids) {
    const pieza = piezaId(v, '1:1');
    const img = R.img(carpeta, pieza);
    const x = e[v];
    const p = est?.piezas?.[pieza];
    const puntajes = p?.revision?.puntajes || null;
    const { pasa, fallan } = evaluarPuntajes(puntajes);
    let montaje = null;
    if (existe(img) && existe(x.referencia)) {
      try {
        montar(x.referencia, img, path.join(dir, `${v}.jpg`));
        montaje = `comparacion/${v}.jpg`;
      } catch (err) {
        console.error(`[imagen-ads] comparación de ${v}: ${err?.message || err}`);
      }
    }
    filas.push({ v, pieza, formato: x.formato_id, nombre: x.nombre, referencia: path.basename(x.referencia), montaje, puntajes, pasa, fallan, problemas: p?.revision?.problemas || [], correccion: p?.revision?.correccion_en || '' });
  }
  const md = [
    `# Comparación contra las estructuras ganadoras · ${brief?.titulo || brief?.datos?.nombre || ''}`,
    '',
    `Pasa la imagen con ${NOTA_MINIMA} o más en los 7 criterios. La que falla queda marcada para rehacer: se rehace solo con tu sí (\`npm run rehacer temp/${path.basename(carpeta)} --pieza V0X_1x1\`).`,
    '',
    `| Imagen | Estructura | ${CRITERIOS.map((k) => NOMBRES_CRITERIOS[k]).join(' | ')} | Resultado |`,
    `|---|---|${CRITERIOS.map(() => '---').join('|')}|---|`,
    ...filas.map((f) => `| ${f.v} | ${f.formato} (${f.referencia}) | ${CRITERIOS.map((k) => (f.puntajes ? f.puntajes[k] ?? '–' : '–')).join(' | ')} | ${f.pasa === null ? 'sin puntaje' : f.pasa ? 'PASA' : `REHACER (${f.fallan.map((k) => NOMBRES_CRITERIOS[k]).join(', ')})`} |`),
    '',
    ...filas.flatMap((f) => [
      `## ${f.v} · ${f.nombre}`,
      f.montaje ? `![${f.v}](${f.montaje.replace(/^comparacion\//, '')})` : '_(todavía sin imagen)_',
      ...(f.problemas.length ? ['', 'Lo que vio la revisión:', ...f.problemas.map((t) => `- ${t}`)] : []),
      ...(f.pasa === false && f.correccion ? ['', 'Prompt corregido propuesto (se aplica solo con tu sí):', '', '```', f.correccion, '```'] : []),
      '',
    ]),
  ].join('\n');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'informe.md'), md);
  return { piezas: filas, informe: 'comparacion/informe.md' };
}

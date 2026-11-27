// LOS TAMAÑOS DE 2026-11-26i, COMO EN 26j (2026-11-26k). En 26i «Otro tamaño» agregaba una pieza aparte (V01_4x5, en
// brief.extras) que quedaba AL LADO de la imagen. El usuario: «NO QUIERO QUE LA ANTERIOR QUEDE AHÍ». Desde 26j cambiar el
// tamaño es una versión nueva de la misma imagen; esto pasa los lotes viejos a esa forma, una sola vez:
//   - la imagen de ahora de V01_1x1 va a versiones/ (con su tamaño, motivo «tamano»), como lo hace el generador;
//   - la de la pieza aparte pasa a ser la de V01_1x1 (con su tamaño en estado.json → piezas[p].aspecto);
//   - las versiones viejas de la pieza aparte se suman a las de V01_1x1; la pieza aparte y brief.extras se borran.
// Si algo no está (la imagen de la pieza aparte, o no terminó), esa variación queda como estaba.
import fs from 'node:fs';
import path from 'node:path';
import { leerJSON, existe } from '../archivos.js';
import { R, piezaId, guardarJSON, firma, formatoDe } from './disco.js';

const mover = (de, a) => {
  if (!existe(de)) return false;
  fs.mkdirSync(path.dirname(a), { recursive: true });
  fs.renameSync(de, a);
  return true;
};
const borrar = (a) => fs.rmSync(a, { force: true });

/** -> la cantidad de imágenes que pasó (0 si no había nada que pasar). */
export function fusionarTamanosViejos(carpeta) {
  const brief = leerJSON(R.brief(carpeta));
  const extras = brief?.extras;
  if (!extras || typeof extras !== 'object' || !Object.keys(extras).length) return 0;
  const est = leerJSON(R.estado(carpeta));
  if (!est?.piezas) return 0;
  const indice = leerJSON(R.indiceVersiones(carpeta)) || { piezas: {} };
  indice.piezas ||= {};
  let pasadas = 0;
  const quedan = {};
  for (const [v, lista] of Object.entries(extras)) {
    const M = piezaId(v, '1:1');
    const pm = est.piezas[M];
    // las piezas aparte de esta variación, de la más vieja a la más nueva (la última queda como la de ahora)
    const aparte = (Array.isArray(lista) ? lista : [])
      .filter((f) => f !== '1:1' && (brief.formatos || ['1:1']).indexOf(f) === -1)
      .map((f) => ({ f, X: piezaId(v, f) }))
      .filter(({ X }) => est.piezas[X]?.fase === 'final' && existe(R.img(carpeta, X)))
      .sort((a, b) => fs.statSync(R.img(carpeta, a.X)).mtimeMs - fs.statSync(R.img(carpeta, b.X)).mtimeMs);
    const sinTerminar = (Array.isArray(lista) ? lista : []).filter((f) => !aparte.some((x) => x.f === f) && est.piezas[piezaId(v, f)] && est.piezas[piezaId(v, f)].fase !== 'final');
    if (!pm || !existe(R.img(carpeta, M)) || sinTerminar.length) {
      quedan[v] = lista;
      continue;
    }
    const versiones = (indice.piezas[M] ||= []);
    const libre = () => {
      let n = Math.max(0, ...versiones.map((x) => Number(x?.n) || 0)) + 1;
      while (existe(R.versionPng(carpeta, M, n))) n++;
      return n;
    };
    for (const { f, X } of aparte) {
      const px = est.piezas[X];
      // 1) sus versiones viejas, como versiones de la principal (con su tamaño)
      for (const x of (indice.piezas[X] || []).sort((a, b) => Number(a.n) - Number(b.n))) {
        if (!existe(R.versionPng(carpeta, X, x.n))) continue;
        const n = libre();
        mover(R.versionPng(carpeta, X, x.n), R.versionPng(carpeta, M, n));
        const conTxt = mover(R.versionTxt(carpeta, X, x.n), R.versionTxt(carpeta, M, n));
        versiones.push({ ...x, n, archivo: `versiones/${M}.v${n}.png`, prompt: conTxt ? `versiones/${M}.v${n}.txt` : null, aspecto: f });
      }
      delete indice.piezas[X];
      // 2) la imagen de ahora de la principal, a versiones (con su tamaño)
      const n = libre();
      mover(R.img(carpeta, M), R.versionPng(carpeta, M, n));
      const conTxt = mover(R.prompt(carpeta, M), R.versionTxt(carpeta, M, n));
      const antes = pm.aspecto || pm.formato || formatoDe(M);
      versiones.push({ n, archivo: `versiones/${M}.v${n}.png`, prompt: conTxt ? `versiones/${M}.v${n}.txt` : null, reemplazadaPor: 'tamano', motivo: 'tamano', ...(antes !== '1:1' ? { aspecto: antes } : {}), fecha: new Date().toISOString() });
      // 3) la de la pieza aparte pasa a ser la de la principal
      mover(R.img(carpeta, X), R.img(carpeta, M));
      if (!mover(R.prompt(carpeta, X), R.prompt(carpeta, M))) borrar(R.prompt(carpeta, M));
      for (const p of [M, X]) {
        borrar(R.final(carpeta, p));
        borrar(R.finalJson(carpeta, p));
        borrar(R.vista(carpeta, p));
        borrar(R.firmaRecortes(carpeta, p));
        for (let i = 1; i <= 4; i++) borrar(R.recorte(carpeta, p, i));
      }
      Object.assign(pm, {
        version: (Number(pm.version) || 1) + 1,
        firma: firma(R.img(carpeta, M)),
        resultado: px.resultado || 'listo',
        revision: px.revision || null,
        motivo: null,
        mensaje: null,
      });
      if (f !== '1:1') pm.aspecto = f;
      else delete pm.aspecto;
      delete est.piezas[X];
      pasadas++;
    }
  }
  if (!pasadas && Object.keys(quedan).length === Object.keys(extras).length) return 0;
  guardarJSON(R.indiceVersiones(carpeta), indice);
  guardarJSON(R.estado(carpeta), est);
  const nuevo = { ...brief };
  if (Object.keys(quedan).length) nuevo.extras = quedan;
  else delete nuevo.extras;
  guardarJSON(R.brief(carpeta), nuevo);
  return pasadas;
}

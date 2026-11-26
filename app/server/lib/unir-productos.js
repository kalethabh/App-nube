// ORGANIZAR PRODUCTOS (2026-11-18u). Pedido: «hay productos que creé y resulta que es el mismo; necesito organizar por
// producto y las generaciones por producto, y que no salgan como si fueran productos separados».
//
//   repetidos()                  -> [[{ id, nombre, foto, creado, sugerido }], …]  los que tienen el mismo nombre (sin
//                                   importar mayúsculas, tildes ni el orden de las palabras: «VITALABH Aguaje Complex
//                                   3 en 1» = «Aguaje Complex 3 en 1 VitalABH»). `sugerido`: con cuál quedarse.
//   unir(principal, otros)       -> { principal, unidos, archivos }   pasa todo lo de `otros` a `principal`
//
// Unir: cada anuncio, lote de imágenes, «Me funciona», sketch y cambio de producto que apuntaba a otro producto pasa a
// apuntar al principal (su `productoId`). La investigación, la investigación con TrendTrack, el kit de marca y la ficha
// del otro pasan al principal solo si el principal no tiene la suya. El otro producto NO se borra: se guarda en
// temp/_productos/_unidos/<id>/ (con _unidos/indice.json: id -> principal), así se puede recuperar a mano.
import fs from 'node:fs';
import path from 'node:path';
import { TEMP, esDeEstaApp } from './rutas.js';
import { leerJSON, existe } from './archivos.js';
import { PRODUCTOS, ErrorApp, idValido, leerProducto, listarProductos } from './productos.js';

export const DIR_UNIDOS = path.join(PRODUCTOS, '_unidos');

/** El nombre comparable: sin tildes ni mayúsculas, solo letras y números, con las palabras en orden. */
export function claveNombre(nombre) {
  return [
    ...new Set(
      String(nombre || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
    ),
  ]
    .sort()
    .join(' ');
}

/** Cuánto tiene cada producto (para sugerir con cuál quedarse): investigación, ficha y lo generado. */
function peso(id, usos) {
  const dir = path.join(PRODUCTOS, id);
  return (existe(path.join(dir, 'investigacion', 'investigacion.json')) ? 1000 : 0) + (existe(path.join(dir, 'competencia')) ? 300 : 0) + (existe(path.join(dir, 'ficha.json')) ? 100 : 0) + (usos.get(id) || 0) * 10;
}

/** Los archivos que dicen de qué producto son: temp/<carpeta>/app/*.json y temp/_funcionan/lista.json. */
function archivosConProducto() {
  const lista = [];
  let carpetas = [];
  try {
    carpetas = fs.readdirSync(TEMP, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== '_productos');
  } catch {
    return lista;
  }
  for (const d of carpetas) {
    const app = path.join(TEMP, d.name, 'app');
    try {
      for (const n of fs.readdirSync(app)) if (n.endsWith('.json')) lista.push(path.join(app, n));
    } catch {
      /* sin app/ */
    }
  }
  const funcionan = path.join(TEMP, '_funcionan', 'lista.json');
  if (existe(funcionan)) lista.push(funcionan);
  return lista;
}

const reProducto = (id) => new RegExp(`("productoId"\\s*:\\s*")${id.replace(/[-]/g, '\\-')}(")`, 'g');

/** Cuántos anuncios y lotes tiene cada producto. */
function usosPorProducto() {
  const usos = new Map();
  for (const f of archivosConProducto()) {
    if (path.basename(f) !== 'brief.json') continue;
    const id = leerJSON(f)?.productoId;
    if (id) usos.set(id, (usos.get(id) || 0) + 1);
  }
  return usos;
}

export function repetidos() {
  const usos = usosPorProducto();
  const grupos = new Map();
  for (const p of listarProductos()) {
    if (!esDeEstaApp(leerProducto(p.id))) continue;
    const k = claveNombre(p.nombre);
    if (!k) continue;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push({ id: p.id, nombre: p.nombre, foto: p.foto, creado: p.creado, usos: usos.get(p.id) || 0 });
  }
  return [...grupos.values()]
    .filter((g) => g.length > 1)
    .map((g) => {
      const sugerido = [...g].sort((a, b) => peso(b.id, usos) - peso(a.id, usos) || String(a.creado).localeCompare(String(b.creado)))[0].id;
      return g.map((x) => ({ ...x, sugerido: x.id === sugerido }));
    });
}

/** Mueve `de` a `a` (carpeta o archivo) solo si `a` no existe; cambia el id viejo por el nuevo en sus JSON. */
function llevar(de, a, viejo, nuevo) {
  if (!existe(de) || existe(a)) return false;
  fs.renameSync(de, a);
  const cambiarEn = (f) => {
    if (!f.endsWith('.json')) return;
    try {
      const t = fs.readFileSync(f, 'utf8');
      if (t.includes(viejo)) fs.writeFileSync(f, t.split(`/${viejo}/`).join(`/${nuevo}/`));
    } catch {
      /* se deja como estaba */
    }
  };
  const visitar = (p) => {
    const st = fs.statSync(p);
    if (st.isDirectory()) for (const n of fs.readdirSync(p)) visitar(path.join(p, n));
    else cambiarEn(p);
  };
  visitar(a);
  return true;
}

export function unir(principal, otros) {
  const lista = [...new Set((Array.isArray(otros) ? otros : []).map(String))].filter((id) => id !== principal);
  if (!idValido(principal)) throw new ErrorApp(404, 'No encuentro el producto con el que quieres quedarte.');
  if (!lista.length) throw new ErrorApp(400, 'Elige al menos otro producto para unir.');
  for (const id of lista) if (!idValido(id)) throw new ErrorApp(404, 'Uno de esos productos ya no existe. Recarga la pantalla.');
  for (const id of [principal, ...lista]) if (leerJSON(path.join(PRODUCTOS, id, 'tarea.json'))?.estado === 'analizando') throw new ErrorApp(409, 'Uno de esos productos se está analizando. Espera a que termine y vuelve a intentar.');

  // 1. lo que apunta a los otros pasa a apuntar al principal
  let archivos = 0;
  for (const f of archivosConProducto()) {
    let t;
    try {
      t = fs.readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    let nuevo = t;
    for (const id of lista) nuevo = nuevo.replace(reProducto(id), `$1${principal}$2`);
    if (nuevo !== t) {
      const tmp = `${f}.unir-${process.pid}`;
      fs.writeFileSync(tmp, nuevo);
      fs.renameSync(tmp, f);
      archivos++;
    }
  }

  // 2. lo que el principal no tiene, del otro; 3. el otro se guarda aparte (no se borra)
  fs.mkdirSync(DIR_UNIDOS, { recursive: true });
  const rutaIndice = path.join(DIR_UNIDOS, 'indice.json');
  const indice = leerJSON(rutaIndice) || {};
  const dirP = path.join(PRODUCTOS, principal);
  for (const id of lista) {
    const dirO = path.join(PRODUCTOS, id);
    for (const n of ['ficha.json', 'investigacion', 'competencia', 'kit-marca.json', 'anuncios-imagen.json']) llevar(path.join(dirO, n), path.join(dirP, n), id, principal);
    let destino = path.join(DIR_UNIDOS, id);
    if (existe(destino)) destino = `${destino}-${Date.now()}`;
    fs.renameSync(dirO, destino);
    indice[id] = { principal, fecha: new Date().toISOString(), carpeta: path.basename(destino) };
  }
  fs.writeFileSync(rutaIndice, JSON.stringify(indice, null, 2) + '\n');
  return { principal, unidos: lista, archivos };
}

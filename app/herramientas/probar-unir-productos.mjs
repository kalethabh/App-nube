// Prueba de «Unir productos» (lib/unir-productos.js) con productos y un anuncio de prueba, que se borran al final:
//   node app/herramientas/probar-unir-productos.mjs
import fs from 'node:fs';
import path from 'node:path';
import { TEMP } from '../server/lib/rutas.js';
import { PRODUCTOS, idValido } from '../server/lib/productos.js';
import { claveNombre, repetidos, unir, DIR_UNIDOS } from '../server/lib/unir-productos.js';

const resultados = [];
const check = (nombre, ok, detalle) => {
  resultados.push(Boolean(ok));
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${ok ? '' : `\n      ${JSON.stringify(detalle)?.slice(0, 400)}`}`);
};

check('el mismo nombre con otro orden, mayúsculas y tildes', claveNombre('VITALABH Aguaje Complex 3 en 1') === claveNombre('Aguaje Complex 3 en 1 VitalABH') && claveNombre('Crema Lúna') === claveNombre('crema luna') && claveNombre('Aguaje 10X') !== claveNombre('Aguaje 3 en 1'));

const sufijo = String(process.pid);
const A = `prueba-unir-a-${sufijo}`;
const B = `prueba-unir-b-${sufijo}`;
const C = `prueba-unir-c-${sufijo}`;
const ANUNCIO = `prueba-unir-anuncio-${sufijo}`;
const LOTE = `_img-prueba-unir-${sufijo}`;
const crear = (id, nombre, creado) => {
  fs.mkdirSync(path.join(PRODUCTOS, id), { recursive: true });
  fs.writeFileSync(path.join(PRODUCTOS, id, 'producto.json'), JSON.stringify({ id, nombre, creado }));
  fs.writeFileSync(path.join(PRODUCTOS, id, 'ficha.json'), JSON.stringify({ nombre }));
};
const indiceAntes = fs.existsSync(path.join(DIR_UNIDOS, 'indice.json')) ? fs.readFileSync(path.join(DIR_UNIDOS, 'indice.json'), 'utf8') : null;
try {
  crear(A, `Crema Luna ${sufijo}`, '2026-11-01T00:00:00Z');
  crear(B, `crema LUNA ${sufijo}`, '2026-11-02T00:00:00Z');
  crear(C, `Otra cosa ${sufijo}`, '2026-11-03T00:00:00Z');
  // B tiene la investigación y un anuncio; un lote de imágenes es de A
  fs.mkdirSync(path.join(PRODUCTOS, B, 'investigacion'), { recursive: true });
  fs.writeFileSync(path.join(PRODUCTOS, B, 'investigacion', 'investigacion.json'), JSON.stringify({ portada: { foto: `/api/productos/x/fotos/1`, ruta: `temp/_productos/${B}/fotos/1.png` } }));
  fs.mkdirSync(path.join(TEMP, ANUNCIO, 'app'), { recursive: true });
  fs.writeFileSync(path.join(TEMP, ANUNCIO, 'app', 'brief.json'), JSON.stringify({ productoId: B, estilo: 'ugc' }, null, 2));
  fs.mkdirSync(path.join(TEMP, LOTE, 'app'), { recursive: true });
  fs.writeFileSync(path.join(TEMP, LOTE, 'app', 'brief.json'), JSON.stringify({ productoId: A }));

  const grupo = repetidos().find((g) => g.some((x) => x.id === A));
  check('encuentra los repetidos (y no mezcla otro producto)', grupo && grupo.length === 2 && grupo.some((x) => x.id === B) && !grupo.some((x) => x.id === C), grupo);
  check('sugiere quedarse con el que tiene la investigación', grupo?.find((x) => x.sugerido)?.id === B, grupo);

  let error = null;
  try {
    unir(A, [A]);
  } catch (e) {
    error = e.message;
  }
  check('sin otro producto no une nada', /al menos otro/.test(error || ''), error);

  const r = unir(A, [B]);
  check('une: el anuncio de B ahora es de A', JSON.parse(fs.readFileSync(path.join(TEMP, ANUNCIO, 'app', 'brief.json'), 'utf8')).productoId === A && r.archivos >= 1, r);
  check('el lote de A sigue en A', JSON.parse(fs.readFileSync(path.join(TEMP, LOTE, 'app', 'brief.json'), 'utf8')).productoId === A);
  const inv = path.join(PRODUCTOS, A, 'investigacion', 'investigacion.json');
  check('la investigación de B pasa a A (que no tenía), con sus rutas al día', fs.existsSync(inv) && fs.readFileSync(inv, 'utf8').includes(`/${A}/`) && !fs.readFileSync(inv, 'utf8').includes(`/${B}/`));
  check('B ya no aparece como producto, pero no se borró', !idValido(B) && fs.existsSync(path.join(DIR_UNIDOS, B, 'producto.json')) && JSON.parse(fs.readFileSync(path.join(DIR_UNIDOS, 'indice.json'), 'utf8'))[B]?.principal === A);
  check('ya no quedan repetidos de ese nombre', !repetidos().some((g) => g.some((x) => x.id === A)));
} finally {
  for (const p of [path.join(PRODUCTOS, A), path.join(PRODUCTOS, B), path.join(PRODUCTOS, C), path.join(DIR_UNIDOS, B), path.join(TEMP, ANUNCIO), path.join(TEMP, LOTE)]) fs.rmSync(p, { recursive: true, force: true });
  if (indiceAntes === null) fs.rmSync(path.join(DIR_UNIDOS, 'indice.json'), { force: true });
  else fs.writeFileSync(path.join(DIR_UNIDOS, 'indice.json'), indiceAntes);
  try {
    fs.rmdirSync(DIR_UNIDOS);
  } catch {
    /* tiene otros */
  }
}
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${resultados.length} OK`);
process.exit(ok === resultados.length ? 0 : 1);

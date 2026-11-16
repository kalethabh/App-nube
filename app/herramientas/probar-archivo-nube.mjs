// Pruebas aisladas del archivado: no usan cuentas, GitHub ni anuncios reales.
// node --test app/herramientas/probar-archivo-nube.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { crearArchivador, copiarVerificado, huella } from '../server/lib/archivo-nube.js';

const TRABAJO = process.env.AIA_PRUEBAS_TRABAJO || '/workspace/work';
const escribir = (archivo, valor) => {
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  fs.writeFileSync(archivo, typeof valor === 'string' || Buffer.isBuffer(valor) ? valor : JSON.stringify(valor));
  return archivo;
};
const contenido = (archivo) => fs.readFileSync(archivo, 'utf8');
function caso(t, opciones = {}) {
  fs.mkdirSync(TRABAJO, { recursive: true });
  const raiz = fs.mkdtempSync(path.join(TRABAJO, 'prueba-archivo-nube-'));
  t.after(() => fs.rmSync(raiz, { recursive: true, force: true }));
  const temp = path.join(raiz, 'trabajo');
  const output = path.join(raiz, 'terminados');
  const nube = path.join(raiz, 'nube');
  for (const dir of [temp, output, nube]) fs.mkdirSync(dir);
  const crearTrabajo = (slug = 'anuncio-prueba', { familia = 'voz-en-off', tipo = null, estado = 'listo' } = {}) => {
    const dir = path.join(temp, slug);
    escribir(path.join(dir, 'manifiesto.json'), { estilo: 'claymation' });
    escribir(path.join(dir, 'app', 'brief.json'), { slug, familia });
    escribir(path.join(dir, 'app', 'conductor.json'), { estado, familia });
    if (tipo) escribir(path.join(dir, 'app', `${tipo}-estado.json`), {});
    return dir;
  };
  return { raiz, temp, output, nube, crearTrabajo, archivador: crearArchivador({ temp, output, ...opciones }) };
}
const archivosEn = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? archivosEn(path.join(dir, e.name)) : [path.join(dir, e.name)]) : [];

test('cambiar de destino conserva ubicaciones y restaura medios y finales de ambas carpetas', async (t) => {
  const c = caso(t);
  const dir = c.crearTrabajo();
  const antiguo = escribir(path.join(dir, 'img', 'primera.png'), 'imagen original');
  const finalA = escribir(path.join(c.output, 'anuncio-prueba_completo.mp4'), 'video final primero');
  const r1 = await c.archivador.respaldar({ destino: c.nube, liberarEspacio: true });
  assert.deepEqual(r1.fallos, []);
  assert.equal(r1.liberados, 2);
  assert.equal(fs.existsSync(antiguo), false);
  assert.equal(fs.existsSync(finalA), false);
  const nuevaNube = path.join(c.raiz, 'otra-nube');
  fs.mkdirSync(nuevaNube);
  const nuevo = escribir(path.join(dir, 'video', 'segunda.mp4'), 'clip nuevo');
  const finalB = escribir(path.join(c.output, 'anuncio-prueba_sin-musica.mp4'), 'segundo final');
  const r2 = await c.archivador.respaldar({ destino: nuevaNube, liberarEspacio: true });
  assert.deepEqual(r2.fallos, []);
  const marca = c.archivador.marca('anuncio-prueba');
  assert.equal(marca.ubicaciones['img/primera.png'].archivo, path.join(c.nube, 'anuncio-prueba', 'img', 'primera.png'));
  assert.equal(marca.ubicaciones['video/segunda.mp4'].archivo, path.join(nuevaNube, 'anuncio-prueba', 'video', 'segunda.mp4'));
  assert.deepEqual(c.archivador.restaurar('anuncio-prueba'), { ok: true });
  assert.equal(contenido(antiguo), 'imagen original');
  assert.equal(contenido(nuevo), 'clip nuevo');
  assert.equal(contenido(finalA), 'video final primero');
  assert.equal(contenido(finalB), 'segundo final');
  assert.equal(c.archivador.marca('anuncio-prueba'), null);
});

test('mismo tamaño con contenido distinto reemplaza y verifica la copia antes de liberar', async (t) => {
  const c = caso(t);
  const dir = c.crearTrabajo();
  const original = escribir(path.join(dir, 'img', 'foto.png'), 'ABCDE');
  const destino = escribir(path.join(c.nube, 'anuncio-prueba', 'img', 'foto.png'), '12345');
  const r = await c.archivador.respaldar({ destino: c.nube, liberarEspacio: true });
  assert.deepEqual(r.fallos, []);
  assert.equal(r.copiados, 1);
  assert.equal(contenido(destino), 'ABCDE');
  assert.equal(fs.existsSync(original), false);
  assert.equal(c.archivador.restaurar('anuncio-prueba').ok, true);
  assert.equal(contenido(original), 'ABCDE');
});

test('fallo al guardar la marca conserva el original aunque la copia esté completa', async (t) => {
  const c = caso(t, { guardarMarca: () => { throw new Error('disco sin espacio para la marca'); } });
  const original = escribir(path.join(c.crearTrabajo(), 'video', 'toma.mp4'), 'original intacto');
  const r = await c.archivador.respaldar({ destino: c.nube, liberarEspacio: true });
  assert.equal(r.fallos.length, 1);
  assert.equal(r.liberados, 0);
  assert.equal(contenido(original), 'original intacto');
  assert.equal(c.archivador.marca('anuncio-prueba'), null);
});

for (const falla of ['lanza', 'trunca']) {
  test(`una copia que ${falla} no deja archivo parcial ni borra el original`, async (t) => {
    const c = caso(t, { copiar: (desde, a, opciones) => copiarVerificado(desde, a, { ...opciones, copiar: (_origen, temporal) => {
      fs.writeFileSync(temporal, 'parte');
      if (falla === 'lanza') throw new Error('la unidad se desconectó');
    } }) });
    const original = escribir(path.join(c.crearTrabajo(), 'video', 'toma.mp4'), 'archivo completo para copiar');
    const r = await c.archivador.respaldar({ destino: c.nube, liberarEspacio: true });
    assert.equal(r.fallos.length, 1);
    assert.equal(r.liberados, 0);
    assert.equal(contenido(original), 'archivo completo para copiar');
    assert.deepEqual(archivosEn(c.nube), []);
    assert.equal(c.archivador.marca('anuncio-prueba'), null);
  });
}

test('copia fallida conserva también una copia anterior de destino', (t) => {
  const c = caso(t);
  const original = escribir(path.join(c.raiz, 'origen.mp4'), 'nuevo completo');
  const destino = escribir(path.join(c.nube, 'previo.mp4'), 'respaldo anterior');
  assert.throws(() => copiarVerificado(original, destino, { raiz: c.nube, copiar: (_desde, tmp) => {
    fs.writeFileSync(tmp, 'parcial');
    throw new Error('copia interrumpida');
  } }));
  assert.equal(contenido(destino), 'respaldo anterior');
  assert.equal(contenido(original), 'nuevo completo');
  assert.deepEqual(archivosEn(c.nube), [destino]);
});

test('raíz de nube ausente no se recrea y el original sigue local', async (t) => {
  const c = caso(t);
  const original = escribir(path.join(c.crearTrabajo(), 'video', 'toma.mp4'), 'conservar');
  fs.rmSync(c.nube, { recursive: true });
  await assert.rejects(c.archivador.respaldar({ destino: c.nube, liberarEspacio: true }));
  assert.equal(fs.existsSync(c.nube), false);
  assert.equal(contenido(original), 'conservar');
});

test('desconexión entre la primera y segunda copia no recrea la nube ni borra la segunda', async (t) => {
  let n = 0;
  let c;
  c = caso(t, { copiar: (desde, a, opciones) => {
    n++;
    if (n === 2) fs.renameSync(c.nube, `${c.nube}-desconectada`);
    return copiarVerificado(desde, a, opciones);
  } });
  const dir = c.crearTrabajo();
  escribir(path.join(dir, 'video', 'primero.mp4'), 'primero');
  escribir(path.join(dir, 'video', 'segundo.mp4'), 'segundo');
  const r = await c.archivador.respaldar({ destino: c.nube, liberarEspacio: true });
  assert.equal(r.fallos.length, 1);
  assert.equal(fs.existsSync(c.nube), false);
  assert.equal(archivosEn(path.join(dir, 'video')).length, 1);
  assert.equal(r.liberados, 1);
});

test('conservar copia todo y no borra medios, finales ni fotos originales', async (t) => {
  const c = caso(t);
  const dir = c.crearTrabajo();
  const fuente = [escribir(path.join(dir, 'producto.png'), 'foto de producto'), escribir(path.join(dir, 'video', 'toma.mp4'), 'video'), escribir(path.join(c.output, 'anuncio-prueba_completo.mp4'), 'final')];
  const r = await c.archivador.respaldar({ destino: c.nube, liberarEspacio: false });
  assert.equal(r.copiados, 3);
  assert.equal(r.liberados, 0);
  assert.deepEqual(r.fallos, []);
  for (const f of fuente) assert.ok(fs.existsSync(f));
  assert.equal(c.archivador.marca('anuncio-prueba'), null);
});

for (const [slug, opciones] of [['_img-lote-prueba', { familia: 'imagen-ads' }], ['cambiar-prueba', { tipo: 'cambio' }], ['sketch-prueba', { tipo: 'sketch' }]]) {
  test(`${slug} conserva los originales incluso al elegir liberar espacio`, async (t) => {
    const c = caso(t);
    const dir = c.crearTrabajo(slug, opciones);
    const original = escribir(path.join(dir, 'img', 'pieza.png'), 'foto');
    const final = escribir(path.join(c.output, `${slug}_completo.mp4`), 'final');
    const r = await c.archivador.respaldar({ destino: c.nube, liberarEspacio: true });
    assert.deepEqual(r.fallos, []);
    assert.equal(r.copiados, 2);
    assert.equal(r.liberados, 0);
    assert.equal(contenido(original), 'foto');
    assert.equal(contenido(final), 'final');
    assert.equal(c.archivador.marca(slug), null);
  });
}

test('marcas heredadas restauran medios y finales sin mapa por archivo', (t) => {
  const c = caso(t);
  const dir = c.crearTrabajo();
  const carpeta = path.join(c.nube, 'anuncio-prueba');
  escribir(path.join(carpeta, 'img', 'vieja.png'), 'imagen heredada');
  escribir(path.join(c.nube, 'videos-finales', 'anuncio-prueba_completo.mp4'), 'video heredado');
  escribir(path.join(dir, 'app', 'en-la-nube.json'), { carpeta, archivos: ['img/vieja.png'], finales: ['anuncio-prueba_completo.mp4'] });
  assert.deepEqual(c.archivador.restaurar('anuncio-prueba'), { ok: true });
  assert.equal(contenido(path.join(dir, 'img', 'vieja.png')), 'imagen heredada');
  assert.equal(contenido(path.join(c.output, 'anuncio-prueba_completo.mp4')), 'video heredado');
});

test('marca heredada seguida de cambio de destino también conserva ubicaciones antiguas', async (t) => {
  const c = caso(t);
  const dir = c.crearTrabajo();
  const carpeta = path.join(c.nube, 'anuncio-prueba');
  escribir(path.join(carpeta, 'img', 'vieja.png'), 'imagen heredada');
  escribir(path.join(c.nube, 'videos-finales', 'anuncio-prueba_completo.mp4'), 'final heredado');
  escribir(path.join(dir, 'app', 'en-la-nube.json'), { carpeta, archivos: ['img/vieja.png'], finales: ['anuncio-prueba_completo.mp4'] });
  const nuevaNube = path.join(c.raiz, 'otra-nube');
  fs.mkdirSync(nuevaNube);
  escribir(path.join(dir, 'video', 'nuevo.mp4'), 'video nuevo');
  assert.deepEqual((await c.archivador.respaldar({ destino: nuevaNube, liberarEspacio: true })).fallos, []);
  assert.equal(c.archivador.restaurar('anuncio-prueba').ok, true);
  assert.equal(contenido(path.join(dir, 'img', 'vieja.png')), 'imagen heredada');
  assert.equal(contenido(path.join(dir, 'video', 'nuevo.mp4')), 'video nuevo');
  assert.equal(contenido(path.join(c.output, 'anuncio-prueba_completo.mp4')), 'final heredado');
});

test('destino anidado normal y output funcionan sin confundir rutas parecidas', async (t) => {
  const c = caso(t);
  const dir = c.crearTrabajo();
  const nube = path.join(c.raiz, 'trabajo-respaldo', 'Kads', 'archivos');
  fs.mkdirSync(nube, { recursive: true });
  escribir(path.join(dir, 'video', 'toma.mp4'), 'clip');
  escribir(path.join(c.output, 'anuncio-prueba_completo.mp4'), 'salida');
  assert.deepEqual((await c.archivador.respaldar({ destino: nube, liberarEspacio: true })).fallos, []);
  assert.equal(contenido(path.join(nube, 'videos-finales', 'anuncio-prueba_completo.mp4')), 'salida');
  assert.equal(c.archivador.restaurar('anuncio-prueba').ok, true);
});

test('no permite archivar dentro del trabajo/output ni en su antecesor', async (t) => {
  const c = caso(t);
  const dir = c.crearTrabajo();
  const original = escribir(path.join(dir, 'img', 'imagen.png'), 'conservar');
  for (const destino of [c.temp, c.output, c.raiz, path.join(c.temp, 'nube')]) {
    fs.mkdirSync(destino, { recursive: true });
    await assert.rejects(c.archivador.respaldar({ destino, liberarEspacio: true }), /fuera/);
  }
  assert.equal(contenido(original), 'conservar');
});

test('symlink de destino fuera de raíz se rechaza sin escribir ni quitar el original', async (t) => {
  const c = caso(t);
  const original = escribir(path.join(c.crearTrabajo(), 'img', 'imagen.png'), 'conservar');
  const externa = path.join(c.raiz, 'ajena');
  fs.mkdirSync(externa);
  fs.symlinkSync(externa, path.join(c.nube, 'anuncio-prueba'), 'dir');
  const r = await c.archivador.respaldar({ destino: c.nube, liberarEspacio: true });
  assert.equal(r.fallos.length, 1);
  assert.equal(r.liberados, 0);
  assert.equal(contenido(original), 'conservar');
  assert.deepEqual(fs.readdirSync(externa), []);
});

test('una copia alterada después de archivar no se restaura y la marca queda para reintentar', async (t) => {
  const c = caso(t);
  const dir = c.crearTrabajo();
  const original = escribir(path.join(dir, 'video', 'toma.mp4'), 'ABCDE');
  await c.archivador.respaldar({ destino: c.nube, liberarEspacio: true });
  escribir(path.join(c.nube, 'anuncio-prueba', 'video', 'toma.mp4'), '12345');
  assert.equal(c.archivador.restaurar('anuncio-prueba').ok, false);
  assert.equal(fs.existsSync(original), false);
  assert.ok(c.archivador.marca('anuncio-prueba'));
});

test('una edición local posterior no se sobrescribe al restaurar', async (t) => {
  const c = caso(t);
  const dir = c.crearTrabajo();
  const original = escribir(path.join(dir, 'img', 'imagen.png'), 'original');
  await c.archivador.respaldar({ destino: c.nube, liberarEspacio: true });
  escribir(original, 'edición local');
  assert.equal(c.archivador.restaurar('anuncio-prueba').ok, true);
  assert.equal(contenido(original), 'edición local');
});

test('archivado ocupado conserva la pieza y huella distingue contenido sin depender del tamaño', async (t) => {
  const c = caso(t, { ocupado: () => true });
  const original = escribir(path.join(c.crearTrabajo(), 'img', 'foto.png'), 'ABCDE');
  const otro = escribir(path.join(c.raiz, 'otro.png'), '12345');
  assert.equal(huella(original).bytes, huella(otro).bytes);
  assert.notEqual(huella(original).sha256, huella(otro).sha256);
  const r = await c.archivador.respaldar({ destino: c.nube, liberarEspacio: true });
  assert.equal(r.liberados, 0);
  assert.ok(fs.existsSync(original));
});

test('enlace de archivo de destino roto se rechaza y se conserva el enlace y el original', (t) => {
  const c = caso(t);
  const original = escribir(path.join(c.raiz, 'origen.png'), 'imagen íntegra');
  const destino = path.join(c.nube, 'foto.png');
  const externo = path.join(c.raiz, 'no-existe', 'foto.png');
  fs.symlinkSync(externo, destino);
  assert.throws(() => copiarVerificado(original, destino, { raiz: c.nube }), /enlace/);
  assert.ok(fs.lstatSync(destino).isSymbolicLink());
  assert.equal(fs.existsSync(path.dirname(externo)), false);
  assert.equal(contenido(original), 'imagen íntegra');
});

test('enlace roto de carpeta se rechaza sin recrear su destino', (t) => {
  const c = caso(t);
  const original = escribir(path.join(c.raiz, 'origen.png'), 'imagen íntegra');
  const externo = path.join(c.raiz, 'unidad-ausente');
  fs.symlinkSync(externo, path.join(c.nube, 'carpeta'), 'dir');
  assert.throws(() => copiarVerificado(original, path.join(c.nube, 'carpeta', 'img', 'foto.png'), { raiz: c.nube }), /enlace|ENOENT/);
  assert.equal(fs.existsSync(externo), false);
  assert.equal(contenido(original), 'imagen íntegra');
});

test('marca con carpeta heredada inválida informa el fallo y conserva el registro', (t) => {
  const c = caso(t);
  const dir = c.crearTrabajo();
  escribir(path.join(dir, 'app', 'en-la-nube.json'), { carpeta: { rota: true }, archivos: ['img/foto.png'] });
  assert.doesNotThrow(() => c.archivador.restaurar('anuncio-prueba'));
  assert.equal(c.archivador.restaurar('anuncio-prueba').ok, false);
  assert.ok(c.archivador.marca('anuncio-prueba'));
  assert.equal(fs.existsSync(path.join(dir, 'img', 'foto.png')), false);
});

test('marca con lista de archivos inválida no se elimina ni lanza una excepción', (t) => {
  const c = caso(t);
  const dir = c.crearTrabajo();
  escribir(path.join(dir, 'app', 'en-la-nube.json'), { carpeta: path.join(c.nube, 'anuncio-prueba'), archivos: {} });
  assert.equal(c.archivador.restaurar('anuncio-prueba').ok, false);
  assert.ok(c.archivador.marca('anuncio-prueba'));
});

test('un registro no puede recuperar textos, rutas con escape ni disfrazar .env como una imagen', (t) => {
  const c = caso(t);
  const dir = c.crearTrabajo();
  const secretoFalso = escribir(path.join(c.raiz, '.env'), 'SECRETO_FALSO_DE_LA_PRUEBA=solo-fixture');
  const nombre = path.join(dir, 'app', 'en-la-nube.json');
  escribir(nombre, {
    carpeta: path.join(c.nube, 'anuncio-prueba'),
    archivos: ['img/foto.png', '../fuera.png', 'app/ajustes.json'],
    ubicaciones: { 'img/foto.png': { archivo: secretoFalso } },
    finales: ['../../escape.mp4'],
  });
  const r = c.archivador.restaurar('anuncio-prueba');
  assert.equal(r.ok, false);
  assert.equal(r.faltan.length, 4);
  assert.equal(fs.existsSync(path.join(dir, 'img', 'foto.png')), false);
  assert.equal(fs.existsSync(path.join(dir, 'app', 'ajustes.json')), false);
  assert.ok(fs.existsSync(nombre));
});

test('cambio del original durante la copia no reemplaza el respaldo ni borra la versión nueva local', async (t) => {
  const c = caso(t, { copiar: (desde, a, opciones) => copiarVerificado(desde, a, { ...opciones, copiar: (origen, tmp, banderas) => {
    fs.copyFileSync(origen, tmp, banderas);
    fs.writeFileSync(origen, 'BBBBB');
  } }) });
  const original = escribir(path.join(c.crearTrabajo(), 'img', 'foto.png'), 'AAAAA');
  const destino = escribir(path.join(c.nube, 'anuncio-prueba', 'img', 'foto.png'), '00000');
  const r = await c.archivador.respaldar({ destino: c.nube, liberarEspacio: true });
  assert.equal(r.fallos.length, 1);
  assert.equal(r.liberados, 0);
  assert.equal(contenido(original), 'BBBBB');
  assert.equal(contenido(destino), '00000');
  assert.deepEqual(archivosEn(c.nube), [destino]);
});

// ---------------------------------------------------------------- restaurarAsync (traer de vuelta sin trabar la app)
// Las mismas garantías que restaurar(): lo usa la app al abrir el editor de un anuncio guardado en Drive.

test('restaurarAsync trae medios y finales de vuelta y borra la marca', async (t) => {
  const c = caso(t);
  const dir = c.crearTrabajo();
  const img = escribir(path.join(dir, 'img', 'primera.png'), 'imagen original');
  const fin = escribir(path.join(c.output, 'anuncio-prueba_completo.mp4'), 'video final');
  await c.archivador.respaldar({ destino: c.nube, liberarEspacio: true });
  assert.equal(fs.existsSync(img), false);
  assert.deepEqual(await c.archivador.restaurarAsync('anuncio-prueba'), { ok: true });
  assert.equal(contenido(img), 'imagen original');
  assert.equal(contenido(fin), 'video final');
  assert.equal(c.archivador.marca('anuncio-prueba'), null);
});

test('restaurarAsync no restaura una copia alterada y conserva la marca', async (t) => {
  const c = caso(t);
  const dir = c.crearTrabajo();
  const original = escribir(path.join(dir, 'video', 'toma.mp4'), 'ABCDE');
  await c.archivador.respaldar({ destino: c.nube, liberarEspacio: true });
  escribir(path.join(c.nube, 'anuncio-prueba', 'video', 'toma.mp4'), '12345');
  assert.equal((await c.archivador.restaurarAsync('anuncio-prueba')).ok, false);
  assert.equal(fs.existsSync(original), false);
  assert.ok(c.archivador.marca('anuncio-prueba'));
});

test('restaurarAsync conserva una edición local posterior', async (t) => {
  const c = caso(t);
  const original = escribir(path.join(c.crearTrabajo(), 'img', 'imagen.png'), 'original');
  await c.archivador.respaldar({ destino: c.nube, liberarEspacio: true });
  escribir(original, 'edición local');
  assert.equal((await c.archivador.restaurarAsync('anuncio-prueba')).ok, true);
  assert.equal(contenido(original), 'edición local');
});

test('restaurarAsync rechaza registros inválidos, escapes y .env disfrazado', async (t) => {
  const c = caso(t);
  const dir = c.crearTrabajo();
  const secretoFalso = escribir(path.join(c.raiz, '.env'), 'SECRETO_FALSO_DE_LA_PRUEBA=solo-fixture');
  const nombre = escribir(path.join(dir, 'app', 'en-la-nube.json'), {
    carpeta: path.join(c.nube, 'anuncio-prueba'),
    archivos: ['img/foto.png', '../fuera.png', 'app/ajustes.json'],
    ubicaciones: { 'img/foto.png': { archivo: secretoFalso } },
    finales: ['../../escape.mp4'],
  });
  const r = await c.archivador.restaurarAsync('anuncio-prueba');
  assert.equal(r.ok, false);
  assert.equal(r.faltan.length, 4);
  assert.equal(fs.existsSync(path.join(dir, 'img', 'foto.png')), false);
  assert.ok(fs.existsSync(nombre));
  escribir(nombre, { carpeta: path.join(c.nube, 'x'), archivos: {} });
  assert.equal((await c.archivador.restaurarAsync('anuncio-prueba')).ok, false);
  assert.ok(c.archivador.marca('anuncio-prueba'));
});

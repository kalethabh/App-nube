// Sin red externa, cobros ni git: configuración y selector con carpetas temporales y diálogos simulados.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, after } from 'node:test';

const raizApp = path.resolve(import.meta.dirname, '../..');
let puerto;
for (let i = 0; i < 100; i++) {
  const n = 55000 + Math.floor(Math.random() * 9000);
  if (!fs.existsSync(path.join(raizApp, 'temp', `_modo-prueba-${n}`))) { puerto = n; break; }
}
assert.ok(puerto, 'Un espacio de configuración de prueba libre');
process.env.PUERTO = String(puerto);
process.env.ANUNCIOS_MODO_PRUEBA = '1';
process.env.ANUNCIOS_SIN_GUARDADO = '1';
const A = await import('../server/lib/almacenamiento.js');
const { delAlumno } = await import('../server/lib/actualizar.js');
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'kads-almacenamiento-'));
const carpeta = path.join(sandbox, 'Drive elegido con espacios y ñ');
fs.mkdirSync(carpeta);
const configDir = path.dirname(A.ARCHIVO_ALMACENAMIENTO);
after(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
  fs.rmSync(configDir, { recursive: true, force: true });
});
const errorStatus = (status) => (e) => e instanceof A.ErrorAlmacenamiento && e.status === status;
const bytesConfig = () => fs.readFileSync(A.ARCHIVO_ALMACENAMIENTO, 'utf8');

test('Sin configuración mantiene el modo heredado y usa un archivo de prueba aislado', () => {
  assert.deepEqual(A.leerAlmacenamiento(), { modo: 'automatico', carpeta: null, liberarEspacio: true });
  assert.equal(A.ARCHIVO_ALMACENAMIENTO, path.join(raizApp, 'temp', `_modo-prueba-${puerto}`, 'guardado-config.json'));
  assert.equal(fs.existsSync(A.ARCHIVO_ALMACENAMIENTO), false);
  assert.equal(A.configuracionAlmacenamiento().carpetaLocal, path.join(raizApp, 'temp'));
});

test('Carpeta nube exacta, sin liberar espacio por defecto y sin alterar archivos existentes', () => {
  fs.writeFileSync(path.join(carpeta, 'sentinela.txt'), 'Conservar');
  const guardado = A.guardarAlmacenamiento({ modo: 'nube', carpeta });
  assert.deepEqual(guardado, { modo: 'nube', carpeta: fs.realpathSync(carpeta), liberarEspacio: false });
  assert.deepEqual(A.leerAlmacenamiento(), guardado);
  assert.equal(A.configuracionAlmacenamiento().carpetaEfectiva, fs.realpathSync(carpeta));
  assert.equal(fs.readFileSync(path.join(carpeta, 'sentinela.txt'), 'utf8'), 'Conservar');
  assert.deepEqual(fs.readdirSync(carpeta), ['sentinela.txt']);
  assert.deepEqual(fs.readdirSync(configDir), ['guardado-config.json']);
});

test('Solo local impide liberar espacio; activar nube otra vez necesita una elección explícita', () => {
  A.guardarAlmacenamiento({ modo: 'nube', carpeta, liberarEspacio: true });
  assert.equal(A.leerAlmacenamiento().liberarEspacio, true);
  assert.deepEqual(A.guardarAlmacenamiento({ modo: 'local', liberarEspacio: true }), { modo: 'local', carpeta: null, liberarEspacio: false });
  assert.equal(A.configuracionAlmacenamiento().carpetaEfectiva, null);
  assert.equal(A.guardarAlmacenamiento({ modo: 'nube', carpeta }).liberarEspacio, false);
});

test('Rechaza opciones y destinos inválidos sin cambiar la selección anterior', () => {
  const antes = bytesConfig();
  for (const datos of [null, [], { modo: null }, { modo: 'nube', carpeta: null }, { modo: 'otra' }, { liberarEspacio: 'true' }, { modo: 'nube', carpeta: 'relativa' }, { modo: 'nube', carpeta: '/mal\0ruta' }]) {
    assert.throws(() => A.guardarAlmacenamiento(datos), errorStatus(400));
    assert.equal(bytesConfig(), antes);
  }
  fs.writeFileSync(path.join(sandbox, 'archivo.txt'), 'No soy una carpeta');
  for (const destino of [raizApp, path.join(raizApp, 'app'), path.join(raizApp, 'temp'), path.dirname(raizApp), path.parse(raizApp).root, path.join(sandbox, 'no-existe'), path.join(sandbox, 'archivo.txt')]) {
    assert.throws(() => A.guardarAlmacenamiento({ modo: 'nube', carpeta: destino }), errorStatus(422));
    assert.equal(bytesConfig(), antes);
  }
});

test('Una carpeta sin permiso de escritura no cambia la configuración', { skip: process.platform === 'win32' || process.getuid?.() === 0 }, () => {
  const sinPermiso = path.join(sandbox, 'solo-lectura');
  fs.mkdirSync(sinPermiso, { mode: 0o500 });
  const antes = bytesConfig();
  try {
    assert.throws(() => A.guardarAlmacenamiento({ modo: 'nube', carpeta: sinPermiso }), errorStatus(422));
    assert.equal(bytesConfig(), antes);
    assert.deepEqual(fs.readdirSync(sinPermiso), []);
  } finally {
    fs.chmodSync(sinPermiso, 0o700);
  }
});

test('Resuelve enlaces simbólicos para impedir un destino que apunta dentro de la app', () => {
  const aliasApp = path.join(sandbox, 'alias-app');
  const aliasValido = path.join(sandbox, 'alias-drive');
  fs.symlinkSync(raizApp, aliasApp, 'junction');
  fs.symlinkSync(carpeta, aliasValido, 'junction');
  assert.throws(() => A.validarCarpetaAlmacenamiento(aliasApp), errorStatus(422));
  assert.equal(A.guardarAlmacenamiento({ modo: 'nube', carpeta: aliasValido }).carpeta, fs.realpathSync(carpeta));
});

test('Un error al escribir configuración deja intacta la anterior y limpia el temporal', (t) => {
  const anterior = bytesConfig();
  const rename = fs.renameSync;
  t.mock.method(fs, 'renameSync', (desde, hacia) => {
    if (hacia === A.ARCHIVO_ALMACENAMIENTO) throw Object.assign(new Error('Sin espacio'), { code: 'ENOSPC' });
    return rename(desde, hacia);
  });
  assert.throws(() => A.guardarAlmacenamiento({ modo: 'local' }), errorStatus(422));
  assert.equal(bytesConfig(), anterior);
  assert.deepEqual(fs.readdirSync(configDir), ['guardado-config.json']);
});

test('Configuración rota falla de forma segura: permanece local y no borra archivos', () => {
  fs.writeFileSync(A.ARCHIVO_ALMACENAMIENTO, '{incompleto');
  assert.deepEqual(A.leerAlmacenamiento(), { modo: 'local', carpeta: null, liberarEspacio: false });
  fs.writeFileSync(A.ARCHIVO_ALMACENAMIENTO, JSON.stringify({ modo: 'automatico', liberarEspacio: 'false' }));
  assert.deepEqual(A.leerAlmacenamiento(), { modo: 'local', carpeta: null, liberarEspacio: false });
  A.guardarAlmacenamiento({ modo: 'nube', carpeta });
});

test('Selector no disponible y servidor remoto nunca abren un diálogo', async () => {
  const no = A.crearSelectorCarpeta({ detectar: () => null, ejecutar: () => assert.fail('No ejecutar') });
  assert.deepEqual(await no(), { disponible: false });
  const remoto = A.crearSelectorCarpeta({ enServidor: true, detectar: () => assert.fail('No detectar') });
  await assert.rejects(remoto(), errorStatus(403));
});

test('Selector cancela, valida la carpeta y no guarda una elección todavía', async () => {
  const antes = bytesConfig();
  const detectar = () => ({ comando: 'simulado', args: ['sin-shell'] });
  const cancelar = A.crearSelectorCarpeta({ detectar, ejecutar: async () => '' });
  assert.deepEqual(await cancelar(), { cancelado: true });
  const elegir = A.crearSelectorCarpeta({ detectar, ejecutar: async (cmd, args) => { assert.equal(cmd, 'simulado'); assert.deepEqual(args, ['sin-shell']); return `${carpeta}\n`; } });
  assert.deepEqual(await elegir(), { carpeta: fs.realpathSync(carpeta) });
  assert.equal(bytesConfig(), antes);
  const invalida = A.crearSelectorCarpeta({ detectar, ejecutar: async () => raizApp });
  await assert.rejects(invalida(), errorStatus(422));
});

test('Solo puede haber un diálogo abierto, y cancelarlo permite abrir el siguiente', async () => {
  let soltar;
  const elegir = A.crearSelectorCarpeta({ detectar: () => ({ comando: 'simulado', args: [] }), ejecutar: () => new Promise((resolve) => { soltar = resolve; }) });
  const primera = elegir();
  await assert.rejects(elegir(), errorStatus(409));
  soltar('');
  assert.deepEqual(await primera, { cancelado: true });
  const segunda = elegir();
  soltar(carpeta);
  assert.equal((await segunda).carpeta, fs.realpathSync(carpeta));
});

test('Cancelación de Mac/Linux y ejecutable ausente dan respuestas claras', async () => {
  for (const [comando, fallo, esperado] of [
    ['osascript', { salidaSelector: 'User canceled. (-128)', code: 1 }, { cancelado: true }],
    ['/usr/bin/zenity', { code: 1 }, { cancelado: true }],
    ['ausente', { code: 'ENOENT' }, { disponible: false }],
  ]) {
    const elegir = A.crearSelectorCarpeta({ detectar: () => ({ comando, args: [] }), ejecutar: async () => { throw Object.assign(new Error('Prueba'), fallo); } });
    assert.deepEqual(await elegir(), esperado);
  }
});

test('Los selectores nativos usan comandos y argumentos fijos', () => {
  const mac = A.selectorNativo({ plataforma: 'darwin' });
  assert.equal(mac.comando, '/usr/bin/osascript');
  assert.equal(mac.args[0], '-e');
  const win = A.selectorNativo({ plataforma: 'win32', buscar: () => ({ ruta: 'powershell.exe' }) });
  assert.equal(win.comando, 'powershell.exe');
  assert.ok(win.args.includes('-STA'));
  assert.equal(win.args.some((a) => a.includes(carpeta)), false);
  assert.equal(A.selectorNativo({ plataforma: 'linux', buscar: () => null }), null);
});

test('El actualizador protege la configuración y el estado locales', () => {
  assert.equal(delAlumno('app/.guardado-config.json'), true);
  assert.equal(delAlumno('app/.guardado.json'), true);
  assert.equal(delAlumno('app/server/lib/guardado.js'), false);
});

test('API: origen ajeno no puede cambiar configuración ni abrir el selector', async (t) => {
  const express = (await import('express')).default;
  const { default: rutasGuardado, esPedidoLocal } = await import('../server/rutas/guardado.js');
  assert.equal(esPedidoLocal({ socket: { remoteAddress: '192.168.1.12' }, headers: { host: 'localhost:4455' } }), false);
  assert.equal(esPedidoLocal({ socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'otra-web.test' } }), false);
  assert.equal(esPedidoLocal({ socket: { remoteAddress: '::1' }, headers: { host: '[::1]:4455' } }), true);
  const app = express();
  app.use(express.json());
  rutasGuardado(app);
  const servidor = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise((resolve) => servidor.close(resolve)));
  const url = `http://127.0.0.1:${servidor.address().port}`;
  for (const [ruta, method] of [['/api/guardado/configuracion', 'PUT'], ['/api/guardado/elegir-carpeta', 'POST']]) {
    const r = await fetch(url + ruta, { method, headers: { Origin: 'https://otra-web.test', 'Content-Type': 'application/json' }, body: JSON.stringify({ modo: 'local' }) });
    assert.equal(r.status, 403);
  }
  const r = await fetch(url + '/api/guardado/configuracion', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modo: 'nube', carpeta }) });
  assert.equal(r.status, 200);
  assert.equal(A.leerAlmacenamiento().carpeta, fs.realpathSync(carpeta));
  const estado = await (await fetch(url + '/api/guardado')).json();
  assert.equal(typeof estado.repositorio, 'boolean');
});

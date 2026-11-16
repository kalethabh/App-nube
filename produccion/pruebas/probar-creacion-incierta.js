// Revision 2026-11-16, iniciativa C-02: «evitar cobros duplicados al perder la respuesta de kie».
// Sin gastar nada: un servidor local hace de kie.ai y pierde la respuesta a proposito.
//
//   node --test produccion/pruebas/probar-creacion-incierta.js
//
// Comprueba que crearTarea:
//   - marca como INCIERTA la creacion cuando el pedido llego y la respuesta se perdio (conexion cortada, 504),
//     y que no reintenta sola (un solo pedido al servidor);
//   - no la marca cuando ni siquiera hubo conexion (reintentar ahi es seguro);
//   - sigue devolviendo el taskId en el caso normal.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

let pedidos = 0;
let modo = 'ok';
const servidor = http.createServer((req, res) => {
  let cuerpo = '';
  req.on('data', (d) => (cuerpo += d));
  req.on('end', () => {
    pedidos++;
    if (modo === 'cortar') return req.socket.destroy(); // kie recibio el pedido y la respuesta nunca llega
    if (modo === '504') return res.writeHead(504, { 'Content-Type': 'text/html' }).end('<html>Gateway Timeout</html>');
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ code: 200, data: { taskId: 'tarea-simulada-1' } }));
  });
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const { port } = servidor.address();

// Antes de importar el motor: apunta a este servidor y usa una clave falsa (nunca a kie.ai de verdad).
process.env.KIE_BASE_URL = `http://127.0.0.1:${port}`;
process.env.KIE_API_KEY = 'clave-falsa-de-prueba-0000';
const { crearTarea, esCreacionIncierta } = await import('../kie-client.js');
const { KIE } = await import('../config.js');
assert.equal(KIE.base, `http://127.0.0.1:${port}`, 'la prueba tiene que apuntar al servidor local');

test.after(() => servidor.close());

test('caso normal: devuelve el taskId', async () => {
  modo = 'ok';
  pedidos = 0;
  assert.equal(await crearTarea('modelo-x', { prompt: 'hola' }), 'tarea-simulada-1');
  assert.equal(pedidos, 1);
});

test('la conexion se corta despues de mandar el pedido: creacion incierta, sin reintentar', async () => {
  modo = 'cortar';
  pedidos = 0;
  const e = await crearTarea('modelo-x', { prompt: 'hola' }).then(() => null, (err) => err);
  assert.ok(e, 'tenia que fallar');
  assert.equal(esCreacionIncierta(e), true);
  assert.match(e.message, /no se pidio otra/i);
  assert.equal(pedidos, 1, 'un solo pedido: no se reintenta solo');
});

test('un 504 tambien es incierto', async () => {
  modo = '504';
  pedidos = 0;
  const e = await crearTarea('modelo-x', { prompt: 'hola' }).then(() => null, (err) => err);
  assert.equal(esCreacionIncierta(e), true);
  assert.equal(pedidos, 1);
});

test('sin conexion (nada se mando): es un error comun, no incierto', async () => {
  const cerrado = http.createServer();
  await new Promise((ok) => cerrado.listen(0, '127.0.0.1', ok));
  const libre = cerrado.address().port;
  await new Promise((ok) => cerrado.close(ok));
  const antes = KIE.base;
  KIE.base = `http://127.0.0.1:${libre}`; // ahi ya no escucha nadie: ECONNREFUSED
  try {
    const e = await crearTarea('modelo-x', { prompt: 'hola' }).then(() => null, (err) => err);
    assert.ok(e, 'tenia que fallar');
    assert.equal(esCreacionIncierta(e), false);
  } finally {
    KIE.base = antes;
  }
});

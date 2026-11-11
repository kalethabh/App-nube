// Sin red ni generaciones: el costo visible debe coincidir con el motor en 720p y 1080p.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const raiz = fileURLToPath(new URL('../..', import.meta.url));
const codigo = `
import assert from 'node:assert/strict';
import { creditosDeClip, costoDeOpcion, catalogo } from './app/server/lib/modelos.js';
import { MODELOS_VIDEO, creditosClip, RESOLUCION_VIDEO } from './produccion/config.js';
for (const id of Object.keys(MODELOS_VIDEO)) {
  for (const segundos of [4, 6, 10, 15]) {
    for (const sonido of [true, false]) {
      assert.equal(creditosDeClip(id, segundos, { sonido }), creditosClip(id, segundos, RESOLUCION_VIDEO, { sonido }).creditos, id);
    }
  }
}
const broll = catalogo().categorias.find(c => c.id === 'brollHablado');
const kling = broll.opciones.find(o => o.id === 'kling');
const costo = costoDeOpcion(broll, kling);
assert.equal(costo.min, RESOLUCION_VIDEO === '1080p' ? 202 : 151);
assert.equal(costo.max, costo.min);
const ugc = catalogo().categorias.find(c => c.id === 'ugc');
const grok = ugc.opciones.find(o => o.cascadas?.referencias?.[0] === 'grok-imagine/image-to-video');
assert.ok(grok, 'El catálogo incluye Grok con referencias');
// Grok con referencias solo admite 720p: el presupuesto sigue su resolución efectiva.
assert.equal(costoDeOpcion(ugc, grok).max, 45);
console.log(RESOLUCION_VIDEO + ': precios de app, opciones y motor coinciden.');
`;
for (const resolucion of ['720p', '1080p']) {
  const salida = execFileSync(process.execPath, ['--input-type=module', '-e', codigo], {
    cwd: raiz,
    env: { ...process.env, RESOLUCION_VIDEO: resolucion },
    encoding: 'utf8',
  });
  assert.match(salida, /precios de app/);
  process.stdout.write(salida);
}

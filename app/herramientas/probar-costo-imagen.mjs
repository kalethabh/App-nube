// Sin red: ninguna acción de imágenes puede empezar con un costo ausente o no confirmado.
import assert from 'node:assert/strict';
import { imagenesDeLaAccion, costoMaximoDeLaAccion, costoAprobado } from '../server/lib/imagen-ads/costo.js';

const brief = { cantidad: 10, formatos: ['1:1', '9:16'] };
const precio = { dolaresPorImagen: 0.05 };
assert.equal(imagenesDeLaAccion(brief), 20);
assert.equal(costoMaximoDeLaAccion(precio, brief), 1);
assert.equal(costoMaximoDeLaAccion(null, brief), null);
assert.equal(costoAprobado({}, 1), false);
assert.equal(costoAprobado({ costoMaximoConfirmado: '1' }, 1), false);
assert.equal(costoAprobado({ costoMaximoConfirmado: Infinity }, 1), false);
assert.equal(costoAprobado({ costoMaximoConfirmado: 1 }, null), false);
assert.equal(costoAprobado({ costoMaximoConfirmado: 0.5 }, 1), false);
assert.equal(costoAprobado({ costoMaximoConfirmado: 1 }, 1), true);
assert.equal(costoAprobado({ costoMaximoConfirmado: 1 }, costoMaximoDeLaAccion({ dolaresPorImagen: 0.1 }, brief)), false, 'un precio que subió exige confirmar otra vez');
for (const cuerpo of [{ pieza: 'V01_1x1' }, { v: 'V01', tipo: 'prompt' }, { pieza: 'V01_9x16', instruccion: 'Cambiar texto' }]) {
  assert.equal(imagenesDeLaAccion(brief, cuerpo), 2);
  assert.equal(costoMaximoDeLaAccion(precio, brief, cuerpo), 0.1);
}
assert.equal(imagenesDeLaAccion(brief, { pieza: 'V01_9x16' }), 1);
assert.equal(imagenesDeLaAccion({ ...brief, formatos: ['1:1'] }, { pieza: 'V01_1x1' }), 1);
console.log('OK: costo de lotes y regeneraciones, consentimiento obligatorio y precio actualizado.');

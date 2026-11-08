// FASE 1 — prueba minima: generar UNA sola imagen con Nano Banana 2 via kie.ai.
// Uso:  npm run test:imagen        (pide confirmacion)
//       npm run test:imagen -- --si  (sin confirmacion)

import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { DIR_TEMP, MODELOS, KIE, cargarEnv, requerirClave } from './config.js';
import { generarImagen } from './kie-client.js';

const PROMPT =
  'A small handmade crochet coffee cup sitting on a wooden table, soft natural window light, ' +
  'visible yarn texture and stitches, shallow depth of field, cozy miniature diorama, product photography';

const sinConfirmar = process.argv.includes('--si');

cargarEnv();
requerirClave('KIE_API_KEY', 'crea tu cuenta en kie.ai y copia la key desde https://kie.ai/api-key');

console.log('\n=== FASE 1 — prueba de una imagen ===\n');
console.log(`  Modelo:      ${MODELOS.imagen.principal}`);
console.log(`  Imagenes:    1`);
console.log(`  Resolucion:  1K, 9:16`);
console.log(`  Costo:       centavos de USD. Precios vigentes: ${KIE.precios}`);
console.log(`  Prompt:      ${PROMPT.slice(0, 70)}...\n`);

if (!sinConfirmar) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const r = (await rl.question('  Genero la imagen? Se cobra a tu cuenta de kie.ai [s/N]: ')).trim().toLowerCase();
  rl.close();
  if (r !== 's' && r !== 'si') {
    console.log('\n  Cancelado. No se genero nada ni se cobro nada.\n');
    process.exit(0);
  }
}

const destino = path.join(DIR_TEMP, 'prueba', 'prueba-nano-banana-2.png');
const t0 = Date.now();

try {
  const { ruta, url, taskId } = await generarImagen({
    modelo: MODELOS.imagen.principal,
    prompt: PROMPT,
    aspectRatio: '9:16',
    resolucion: '1K',
    formato: 'png',
    rutaDestino: destino,
    alActualizar: (d) => {
      if (d.state === 'created') console.log(`\n  Tarea creada: ${d.taskId}`);
      else console.log(`  Estado: ${d.state}`);
    },
  });

  const seg = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n  LISTO en ${seg}s`);
  console.log(`  taskId:  ${taskId}`);
  console.log(`  URL:     ${url}`);
  console.log(`  Guardada en: ${ruta}\n`);
  console.log('  Fase 1 terminada. Abre la imagen para revisarla.\n');
} catch (e) {
  console.error(`\n  ERROR: ${e.message}\n`);
  if (e.esFalloDeModelo) {
    console.error('  El modelo rechazo o fallo la generacion. En el pipeline real esto activaria');
    console.error('  la cascada de reintentos y el modelo de respaldo (Fase 2.3).\n');
  }
  process.exitCode = 1;
}

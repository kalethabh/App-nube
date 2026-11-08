// Prueba comparativa: misma escena que test-imagen.js, pero con un prompt real
// de la skill de crochet, armado en el orden de 5 partes del Paso 7.2.
//
// Los bloques universales estan pegados TAL CUAL desde skills/anuncios-crochet.skill
// (Paso 4.2) y la linea de iluminacion desde el Paso 4.4. No se parafrasea nada.
//
// Uso:  npm run test:imagen:crochet -- --si

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { DIR_TEMP, MODELOS, KIE, cargarEnv, requerirClave } from './config.js';
import { generarImagen } from './kie-client.js';

// --- Parte 1: descripcion especifica de la escena -------------------------
// Misma escena que la prueba anterior, para que la comparacion sea limpia.
const ESCENA =
  'Stop-motion animation diorama scene, handmade knitted and crocheted miniature world. ' +
  'A small crocheted mug of coffee sits on a knitted wooden kitchen table in a tiny yarn kitchen, ' +
  'a woven kettle and a small knitted shelf with jars behind it, gentle steam suggested by two ' +
  'individual floating wool balls above the mug. Every element is a handmade fabric prop ' +
  'physically crafted from wool and yarn.';

// --- Parte 2: positivo universal (Paso 4.2, pegado tal cual) --------------
const POSITIVO_UNIVERSAL =
  'The entire scene is fully crocheted and knitted — every surface, character, object, and skin is made of visible yarn stitches and fabric loops. No realistic skin, no smooth surfaces, no photorealistic textures anywhere in the frame. Every element, including hands, arms, faces, and backgrounds, must have visible knit and crochet stitch texture throughout. Stop-motion animation diorama scene, handmade knitted and crocheted miniature world.';

// --- Parte 3: iluminacion (Paso 4.4 — plantilla "interior de dia") --------
const ILUMINACION = 'soft natural light from a small diorama window to the left';

// --- Parte 4: negativo universal (Paso 4.2, pegado tal cual) --------------
const NEGATIVO_UNIVERSAL =
  'realistic skin, smooth skin, photorealistic hands, photorealistic faces, realistic textures, smooth surfaces, CGI render, claymation, clay texture, Pixar style, Disney style, 3D animation, plastic texture, flat cartoon, airbrushed, anime, illustrated, 2D, studio lighting, ring light, HDR, symmetrical lighting, harsh shadows, perfectly exposed.';

// Parte 5 (@image1 del producto) no aplica: esta prueba no lleva foto de producto.

const PROMPT = [ESCENA, POSITIVO_UNIVERSAL, ILUMINACION, NEGATIVO_UNIVERSAL].join(' ');

const sinConfirmar = process.argv.includes('--si');

cargarEnv();
requerirClave('KIE_API_KEY', 'crea tu cuenta en kie.ai y copia la key desde https://kie.ai/api-key');

console.log('\n=== Prueba comparativa — prompt real de la skill de crochet ===\n');
console.log(`  Modelo:      ${MODELOS.imagen.principal}`);
console.log(`  Imagenes:    1`);
console.log(`  Resolucion:  1K, 9:16`);
console.log(`  Costo:       centavos de USD. Precios vigentes: ${KIE.precios}`);
console.log(`  Prompt:      ${PROMPT.length} caracteres (4 bloques del Paso 7.2)\n`);

if (!sinConfirmar) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const r = (await rl.question('  Genero la imagen? Se cobra a tu cuenta de kie.ai [s/N]: ')).trim().toLowerCase();
  rl.close();
  if (r !== 's' && r !== 'si') {
    console.log('\n  Cancelado. No se genero nada ni se cobro nada.\n');
    process.exit(0);
  }
}

const destino = path.join(DIR_TEMP, 'prueba', 'prueba-crochet-skill.png');
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

  // Deja el prompt exacto junto a la imagen, para poder comparar despues.
  fs.writeFileSync(destino.replace(/\.png$/, '.prompt.txt'), PROMPT, 'utf8');

  const seg = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n  LISTO en ${seg}s`);
  console.log(`  taskId:  ${taskId}`);
  console.log(`  URL:     ${url}`);
  console.log(`  Guardada en: ${ruta}\n`);
} catch (e) {
  console.error(`\n  ERROR: ${e.message}\n`);
  process.exitCode = 1;
}

// Prueba del motor de los ANUNCIOS DE IMAGEN (ESPECIFICACION-imagen-ads.md, 14.4.1).
//
//   node produccion/pruebas/probar-imagen-ads.js              todo (unos dos minutos)
//   node produccion/pruebas/probar-imagen-ads.js --sin-red    solo lo que no levanta el kie simulado
//   node produccion/pruebas/probar-imagen-ads.js --conservar  deja temp/_prueba-imagen-ads-<pid>/ para mirarlo
//
// Nunca habla con kie.ai: la primera parte no usa la red y la segunda corre el
// motor (produccion/generar-imagen-ads.js) como proceso hijo contra el kie
// SIMULADO de este mismo proceso, con claves falsas y la guardia de red
// (cualquier salida que no sea a 127.0.0.1 muere en la guardia), como
// probar-velocidad.js. Sale con 0 si todo da; con 1 y el detalle si no.
//
// SIN RED
//   1. textoExacto con una y con varias lineas.
//   2. construirPrompt y construirPromptVertical contra textos de referencia
//      escritos a mano desde el Python (sin logo, identicos); las constantes son
//      las de los .py de la skill.
//   3. El bloque del logo en las 6 posiciones y los 2 formatos (y la nota del vertical).
//   4. geometriaLogo dentro del lienzo y, en 9:16, dentro de la franja del 15,5 al 84,5 %.
//   5. ajustarLargo nunca toca los textos.
//   6. La huella es estable y cambia si cambia la foto.
//   7. El adaptador de Sunburst: con fondo 'opaco' manda background; sin fondo, el cuerpo de siempre.
//   8. validarCuerpo del simulado para Sunburst; codigoDelError y validarOrden del motor.
// CONTRA EL SIMULADO
//   9.  3 cuadrados + 3 verticales: 6 tareas; se mata el motor despues del primer
//       createTask y se vuelve a correr: siguen siendo 6. img/log-modelos.json con
//       el formato de gasto.js (registrarCorrida lo lee: 6 imagenes, 60 creditos).
//   10. Un rehacer cortado entre (a) y (b) se termina sin crear otra tarea.
//   11. La regeneracion de un cuadrado en el mismo proceso sube la copia nueva, no la vieja.
//   11b. Regenerar con instruccion edita la imagen limpia; el vertical sale del cuadrado nuevo.
//   12. contenido=100: 3 intentos, sin imagen, codigo 0; al relanzar, ninguna tarea nueva.
//   12b. contenido=100 y se mata el motor con su 3.er intento en kie: al relanzar retoma ESA y, cuando falla, no pide
//        una 4.a (el tope vale tambien cuando una tarea retomada falla).
//   13. Un intento anotado que nunca llego a kie se devuelve.
//   14. Una tarea que sigue en kie: no se pide otra; sale con 1 (clase servidor) y la retoma la siguiente.
//   15. 402 -> codigo 1 y clase saldo; 401 -> clave; sin red -> red; orden invalida -> 2.
//   16. Gasto con la app cerrada de golpe: la corrida que retoma (--heredar-log) rehace una pieza y el registro ve
//       lo que pago el proceso cortado y lo suyo (30 creditos, no 20); una corrida ya cerrada no se hereda.

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as IA from '../imagen-ads.js';
import { ADAPTADORES_IMAGEN } from '../config.js';
import { codigoDelError, validarOrden } from '../generar-imagen-ads.js';
import { validarCuerpo, iniciar } from './kie-simulado.js';
import { clasificarFallo } from '../../app/server/lib/procesos.js';
import { registrarCorrida, fotografiar, abrirCorrida, cerrarCorrida } from '../../app/server/lib/gasto.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const MOTOR = path.join(RAIZ, 'produccion', 'generar-imagen-ads.js');
const SKILL = path.join(RAIZ, '.claude', 'skills', 'anuncios-imagen-ads', 'scripts');
// Una carpeta por corrida (dentro de temp/: el motor necesita la ruta relativa a la raiz): dos corridas a la vez en la
// misma copia no se pisan los lotes.
const DIR_PRUEBA = path.join(RAIZ, 'temp', `_prueba-imagen-ads-${process.pid}`);
const ARGS = process.argv.slice(2);
const SIN_RED = ARGS.includes('--sin-red');
const CONSERVAR = ARGS.includes('--conservar');

let ok = 0;
const fallos = [];
async function caso(nombre, fn) {
  try {
    await fn();
    ok++;
  } catch (e) {
    fallos.push(`${nombre}\n      ${String(e?.message ?? e).split('\n').join('\n      ')}`);
  }
}
const seccion = (t) => console.log(`\n${t}`);
async function bloque(titulo, fn) {
  const antes = fallos.length;
  const okAntes = ok;
  await fn();
  console.log(`  ${fallos.length === antes ? 'OK' : 'FALLA'}  ${titulo} (${ok - okAntes + (fallos.length - antes)} comprobaciones)`);
}

// ------------------------------------------------------------------ los anuncios de ejemplo

const AD = {
  ad_info: { variation_id: 'V01' },
  visual_prompt: 'A premium square ad. Warm light.',
  global_identity: { color_palette: '#1E3A8A navy, #F5F5F5 white', text_typography: 'Poppins Bold', visual_style: 'clean studio' },
  text_layers: [
    { reference_function: 'headline', reference_position: 'top', text: 'Hidratación\nprofunda', text_style: 'bold white' },
    { reference_position: 'bottom', text: '  Compra hoy  ', text_style: 'small' },
  ],
  mandatory_visual_elements: ['the product bottle', 'a water splash'],
  final_generation_exclusions: ['No watermark'],
  reference_structure_analysis: { forbidden_additions: ['price tags', 'No watermark'] },
  language_rule: 'All visible text in Spanish.',
};
const AD_SIN_TEXTO = { visual_prompt: 'Only a product.', text_layers: [] };
const AD_RAROS = { visual_prompt: 'Odd.', text_layers: [{ reference_function: null, reference_position: 'top', text: 'Hola' }], global_identity: { color_palette: '' } };

// Escritos a mano desde extender_vertical.py y generar_lote.py (no se corre Python: kie_cliente.py carga el .env).
const PY_ZONA =
  'Keep the top 15% and the bottom 15% of the vertical canvas free of important text and free of the product label, because Instagram, Facebook and TikTok cover those areas with their own interface. All headlines, texts and the product label must stay inside the central safe zone and remain perfectly legible.';
const PY_CAMBIO =
  'The ONLY change is the dimension: convert it to a vertical 9:16 portrait layout for Instagram Stories, Reels and TikTok. Re-arrange the same elements so they fit naturally and look premium in the tall format: let the headline breathe at the top, give the person and the product more vertical room in the center, and spread the remaining blocks down the canvas instead of cramming them. Do not simply add empty bands, borders, blurred strips or solid color bars above and below the original square. Do not crop or cut off any element. Keep generous negative space and a clear visual hierarchy.';
const PY_COLOR =
  'CRITICAL - colors must not change: the background keeps exactly the same color as in the first attached image, and every text, graphic element and highlight keeps exactly the color it already has there. Never turn a colored background into white or into a lighter tone. Never swap, invert or reassign colors between the background, the texts and the graphic elements. If the original background is a flat solid color, the vertical version must use that same flat solid color edge to edge.';
const PY_CIERRE =
  'Do not add, remove or rewrite any text, price, badge, seal, icon or visual block. Do not change the design, the palette, the typography, the person or the product.';
const PY_FIDELIDAD =
  "The attached image is the user's real product. Reproduce it with total fidelity: same shape, packaging, cap, label, label text, colors and proportions. Never redesign, replace or reinterpret it.";
const PY_SEGUNDA =
  'The SECOND attached image is the real product: keep the product and its label identical to it, with the same shape, cap, label text, colors and proportions. Do not redesign or reinterpret it.';
const PY_RECREAR =
  'Recreate this exact advertisement (the FIRST attached image) without changing anything in its design. Keep absolutely everything the same: the same texts word for word with exactly the same spelling and accents, the same typography, the same colors, the same photographic style and lighting, the same person (same face, hair, clothes, pose and expression), the same background and the same product';

const ESPERADO_CUADRADO = [
  'A premium square ad. Warm light.',
  'EXACT VISIBLE TEXT (render exactly, no spelling changes):\n' +
    '- headline (top): 2 stacked lines: line 1: "Hidratación"; line 2: "profunda" — bold white\n' +
    '- text (bottom): "Compra hoy" — small',
  'BRAND IDENTITY:\n- color_palette: #1E3A8A navy, #F5F5F5 white\n- text_typography: Poppins Bold',
  'MANDATORY ELEMENTS:\n- the product bottle\n- a water splash',
  'STRICT EXCLUSIONS:\n- No watermark\n- Do not add: price tags',
  PY_FIDELIDAD,
].join('\n\n');

const ESPERADO_VERTICAL = [
  PY_RECREAR +
    '. Specifically preserve: the same colors (#1E3A8A navy, #F5F5F5 white), the same typography (Poppins Bold), the same visual style (clean studio), the same visual blocks: the product bottle; a water splash.',
  PY_COLOR,
  PY_CAMBIO,
  PY_ZONA,
  PY_SEGUNDA,
  'Exact visible texts (each appears exactly once, correctly spelled, nothing else added):\n- headline: 2 stacked lines: line 1: "Hidratación"; line 2: "profunda"\n- text: "Compra hoy"',
  'All visible text in Spanish.',
  PY_CIERRE,
].join('\n\n');

/** Una constante de un .py armada con literales en parentesis: NOMBRE = ( "a" "b" ). */
function constantePy(fuente, nombre) {
  const m = fuente.match(new RegExp(`^${nombre} = \\(\\r?\\n([\\s\\S]*?)\\r?\\n\\)`, 'm'));
  if (!m) throw new Error(`no encuentro ${nombre} en el .py`);
  return [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]).join('');
}
/** Los literales seguidos que empiezan con `inicio` (un append(...) o un p1 = (...)). */
function literalesPy(fuente, inicio) {
  const i = fuente.indexOf(`"${inicio}`);
  if (i === -1) throw new Error(`no encuentro "${inicio}..." en el .py`);
  const resto = fuente.slice(i);
  const fin = resto.search(/\)\s*$/m);
  return [...resto.slice(0, fin).matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]).join('');
}

// ------------------------------------------------------------------ 1 a 8: sin red

seccion('1-2. Textos y prompts iguales a los del Python (sin logo)');
await bloque('textoExacto y prompts', async () => {
  await caso('textoExacto, una linea', () => assert.equal(IA.textoExacto('  Hola mundo  '), '"Hola mundo"'));
  await caso('textoExacto, una linea con salto al final', () => assert.equal(IA.textoExacto('Hola\n'), '"Hola"'));
  await caso('textoExacto, varias lineas', () => assert.equal(IA.textoExacto('Uno\n\n  Dos \nTres'), '3 stacked lines: line 1: "Uno"; line 2: "  Dos "; line 3: "Tres"'));
  await caso('textoExacto, null como Python', () => assert.equal(IA.textoExacto(null), '"None"'));
  await caso('cuadrado = Python', () => assert.equal(IA.construirPrompt(AD), ESPERADO_CUADRADO));
  await caso('vertical = Python', () => assert.equal(IA.construirPromptVertical(AD, { conProducto: true }), ESPERADO_VERTICAL));
  await caso('cuadrado sin textos = Python', () => assert.equal(IA.construirPrompt(AD_SIN_TEXTO), ['Only a product.', 'The image must contain NO text at all.', PY_FIDELIDAD].join('\n\n')));
  await caso('vertical sin textos = Python', () =>
    assert.equal(IA.construirPromptVertical(AD_SIN_TEXTO), [PY_RECREAR + '.', PY_COLOR, PY_CAMBIO, PY_ZONA, PY_SEGUNDA, 'The image must contain NO text at all.', PY_CIERRE].join('\n\n'))
  );
  // Python: t.get("reference_function", "text") da "None" si la clave esta en null, y "" si falta text_style.
  await caso('cuadrado con null y sin estilo = Python', () =>
    assert.equal(IA.construirPrompt(AD_RAROS), ['Odd.', 'EXACT VISIBLE TEXT (render exactly, no spelling changes):\n- None (top): "Hola" — ', PY_FIDELIDAD].join('\n\n'))
  );
  await caso('vertical con null = Python', () =>
    assert.equal(IA.construirPromptVertical(AD_RAROS), [PY_RECREAR + '.', PY_COLOR, PY_CAMBIO, PY_ZONA, PY_SEGUNDA, 'Exact visible texts (each appears exactly once, correctly spelled, nothing else added):\n- None: "Hola"', PY_CIERRE].join('\n\n'))
  );
  await caso('vertical sin producto = Python', () => assert.ok(!IA.construirPromptVertical(AD, { conProducto: false }).includes(PY_SEGUNDA)));
  // Las constantes del modulo son las de los .py (leidas del archivo, no copiadas).
  const vertical = fs.readFileSync(path.join(SKILL, 'extender_vertical.py'), 'utf8');
  const lote = fs.readFileSync(path.join(SKILL, 'generar_lote.py'), 'utf8');
  await caso('ZONA_SEGURA del .py', () => assert.equal(IA.ZONA_SEGURA, constantePy(vertical, 'ZONA_SEGURA')));
  await caso('CAMBIO_DIMENSION del .py', () => assert.equal(IA.CAMBIO_DIMENSION, constantePy(vertical, 'CAMBIO_DIMENSION')));
  await caso('FIDELIDAD_COLOR del .py', () => assert.equal(IA.FIDELIDAD_COLOR, constantePy(vertical, 'FIDELIDAD_COLOR')));
  await caso('CIERRE del .py', () => assert.equal(IA.CIERRE, constantePy(vertical, 'CIERRE')));
  await caso('frase de fidelidad del .py', () => assert.equal(IA.FIDELIDAD_PRODUCTO, literalesPy(lote, "The attached image is the user")));
  await caso('a mano = .py', () => {
    assert.equal(PY_ZONA, IA.ZONA_SEGURA);
    assert.equal(PY_RECREAR, literalesPy(vertical, 'Recreate this exact advertisement'));
    assert.equal(PY_SEGUNDA, literalesPy(vertical, 'The SECOND attached image is the real product'));
  });
  await caso('piezas', () => {
    assert.equal(IA.piezaId('V07', '9:16'), 'V07_9x16');
    assert.equal(IA.piezaId('V100', '1:1'), 'V100_1x1');
    assert.ok(IA.RE_PIEZA.test('V100_9x16') && !IA.RE_PIEZA.test('V1_1x1') && !IA.RE_PIEZA.test('V01_4x5'));
    assert.deepEqual(['V100', 'V9', 'V10'].sort((a, b) => IA.numeroDeV(a) - IA.numeroDeV(b)), ['V9', 'V10', 'V100']);
  });
});

seccion('3. El logo: la zona reservada (6 posiciones, 2 formatos) y la nota del vertical');
await bloque('bloqueLogo', async () => {
  const baseC = IA.construirPrompt(AD);
  const baseV = IA.construirPromptVertical(AD);
  for (const [pos, donde] of Object.entries(IA.POSICIONES)) {
    const c = IA.construirPrompt(AD, { logo: { posicion: pos } });
    const v = IA.construirPromptVertical(AD, { logo: pos });
    const bc = IA.bloqueLogo('1:1', pos);
    const bv = IA.bloqueLogo('9:16', pos);
    await caso(`${pos} 1:1: zona y exclusion`, () => {
      assert.ok(bc.startsWith(`RESERVED LOGO AREA: keep a clean, empty area at the ${donde} of the canvas`));
      assert.ok(c.endsWith(`${bc}\n\n${PY_FIDELIDAD}`), 'la zona va justo antes de la frase de fidelidad');
      assert.ok(c.includes('\n- Do not add: price tags\n- Do not draw any logo, brand mark, monogram or watermark anywhere.\n\n'));
      // Sin lo que agrega la app, es el de Python.
      assert.equal(c.replace('\n- Do not draw any logo, brand mark, monogram or watermark anywhere.', '').replace(`${bc}\n\n`, ''), baseC);
    });
    await caso(`${pos} 9:16: zona antes del cierre`, () => {
      assert.ok(v.endsWith(`${bv}\n\n${PY_CIERRE}`));
      assert.ok(bv.includes(`empty area at the ${donde}, immediately`));
      if (pos.startsWith('arriba')) assert.ok(bv.includes('below the top 15% safe band (from about 15% to 23% of the height)') && bv.includes('Place the headline below'));
      else assert.ok(bv.includes('above the bottom 15% safe band (from about 77% to 85% of the height)') && !bv.includes('headline'));
      assert.equal(v.replace(`${bv}\n\n`, ''), baseV);
    });
  }
  await caso('sin posicion valida: arriba al centro', () => assert.equal(IA.bloqueLogo('1:1', 'x'), IA.bloqueLogo('1:1', 'arriba-centro')));
  await caso('nota del vertical antes del cierre (y no en el cuadrado)', () => {
    const conNota = { ...AD, app_nota_vertical: 'Move the product a bit lower.' };
    assert.ok(IA.construirPromptVertical(conNota).endsWith(`All visible text in Spanish.\n\nEXTRA LAYOUT NOTE FOR THE VERTICAL: Move the product a bit lower.\n\n${PY_CIERRE}`));
    assert.equal(IA.construirPrompt(conNota), baseC);
  });
  await caso('edicion', () => {
    const e1 = IA.construirPromptEdicion(AD, { instruccion: 'Change the background to deep navy.', formato: '1:1', textos: false });
    assert.ok(e1.startsWith('Edit this advertising image (the FIRST attached image) following this instruction: "Change the background to deep navy.". Keep everything else exactly as it is'));
    assert.ok(e1.endsWith('All visible text in Spanish.') && !e1.includes('Exact visible texts') && !e1.includes(PY_ZONA));
    const e2 = IA.construirPromptEdicion(AD, { instruccion: 'x', formato: '9:16', textos: true, logo: { posicion: 'abajo-derecha' } });
    const partes = e2.split('\n\n');
    assert.equal(partes.length, 5);
    assert.ok(partes[1].startsWith('Exact visible texts'));
    assert.equal(partes[2], PY_ZONA);
    assert.equal(partes[3], IA.bloqueLogo('9:16', 'abajo-derecha'));
    assert.equal(partes[4], 'All visible text in Spanish.');
  });
  await caso('correccion de la revision (va con «otra version» que pide el usuario; antes, con el reintento automatico)', () => {
    // sin correccion (o vacia), los prompts quedan como siempre
    assert.equal(IA.bloqueCorreccion(''), '');
    assert.equal(IA.bloqueCorreccion('   '), '');
    assert.equal(IA.construirPrompt(AD, { correccion: '' }), IA.construirPrompt(AD));
    assert.equal(IA.construirPromptVertical(AD, { correccion: null }), IA.construirPromptVertical(AD));
    const fix = 'Write the headline exactly as "BAJA EL RITMO", with no accent on the I.';
    const b = IA.bloqueCorreccion(`  ${fix}\n `);
    assert.ok(b.startsWith('FIX FROM THE REVIEW OF A PREVIOUS ATTEMPT:') && b.includes(fix) && b.endsWith('only the texts listed above may appear in the image.)'));
    // cuadrado: antes de la zona del logo y de la fidelidad del producto
    const c = IA.construirPrompt(AD, { logo: 'arriba-derecha', correccion: fix }).split('\n\n');
    const i = c.indexOf(b);
    assert.ok(i > 0 && c[i + 1] === IA.bloqueLogo('1:1', 'arriba-derecha') && c[i + 2] === IA.FIDELIDAD_PRODUCTO);
    // vertical: despues de la nota del vertical, antes de la zona del logo y del cierre
    const v = IA.construirPromptVertical({ ...AD, app_nota_vertical: 'Move the product lower.' }, { logo: 'arriba-derecha', correccion: fix }).split('\n\n');
    const j = v.indexOf(b);
    assert.ok(j > 0 && v[j - 1].startsWith('EXTRA LAYOUT NOTE') && v[j + 1] === IA.bloqueLogo('9:16', 'arriba-derecha') && v[j + 2] === PY_CIERRE);
    // se corta en TOPE_CORRECCION
    assert.ok(IA.bloqueCorreccion('x'.repeat(2000)).includes('x'.repeat(IA.TOPE_CORRECCION)) && !IA.bloqueCorreccion('x'.repeat(2000)).includes('x'.repeat(IA.TOPE_CORRECCION + 1)));
  });
});

seccion('4. geometriaLogo');
await bloque('geometriaLogo', async () => {
  const lienzos = { '1:1': [2048, 2048], '9:16': [1536, 2736] };
  for (const [formato, [W, H]] of Object.entries(lienzos)) {
    for (const [lw, lh] of [[1000, 200], [200, 1000], [500, 500], [37, 11]]) {
      for (const pos of Object.keys(IA.POSICIONES)) {
        await caso(`${formato} ${pos} logo ${lw}x${lh}`, () => {
          const g = IA.geometriaLogo({ W, H, formato, posicion: pos, lw, lh });
          for (const k of ['x', 'y', 'ancho', 'alto']) assert.ok(Number.isInteger(g[k]), `${k} entero`);
          assert.ok(g.x >= 0 && g.y >= 0 && g.x + g.ancho <= W && g.y + g.alto <= H, JSON.stringify(g));
          assert.ok(g.ancho <= Math.round(0.12 * W) && g.alto <= Math.round(0.12 * W), JSON.stringify(g));
          assert.ok(Math.abs(g.ancho / g.alto - lw / lh) < 0.05 * (lw / lh) + 0.05, 'mantiene la proporcion');
          const m = Math.round(0.045 * W);
          if (pos.endsWith('izquierda')) assert.equal(g.x, m);
          else if (pos.endsWith('derecha')) assert.equal(g.x + g.ancho, W - m);
          else assert.equal(g.x, Math.round((W - g.ancho) / 2));
          if (formato === '9:16') assert.ok(g.y >= 0.155 * H - 0.5 && g.y + g.alto <= 0.845 * H + 0.5, `fuera de la franja: ${JSON.stringify(g)}`);
          else if (pos.startsWith('arriba')) assert.equal(g.y, Math.round(0.045 * H));
          else assert.equal(g.y + g.alto, H - Math.round(0.045 * H));
        });
      }
    }
  }
  await caso('medidas malas: error', () => assert.throws(() => IA.geometriaLogo({ W: 0, H: 10, formato: '1:1', posicion: 'arriba-centro', lw: 1, lh: 1 })));
});

seccion('5. ajustarLargo');
await bloque('ajustarLargo', async () => {
  const largo = { ...AD, visual_prompt: Array.from({ length: 1200 }, (_, i) => `Sentence number ${i} describes the scene in detail.`).join(' ') };
  const capas = structuredClone(largo.text_layers);
  const armar = (a) => IA.construirPrompt(a, { logo: 'arriba-izquierda' });
  const crudo = armar(largo);
  const ajustado = IA.ajustarLargo(crudo, largo, armar);
  await caso('el armado pasaba del tope', () => assert.ok(crudo.length > IA.TOPE_PROMPT));
  await caso('queda dentro del tope', () => assert.ok(ajustado.length <= IA.TOPE_PROMPT, String(ajustado.length)));
  await caso('los textos y el final intactos', () => {
    const [, ...resto] = crudo.split('\n\n');
    assert.ok(ajustado.endsWith(resto.join('\n\n')));
    assert.ok(ajustado.includes('line 1: "Hidratación"'));
  });
  await caso('corta en un punto', () => assert.ok(ajustado.split('\n\n')[0].endsWith('.')));
  await caso('no toca text_layers', () => assert.deepEqual(largo.text_layers, capas));
  await caso('corto: igual', () => assert.equal(IA.ajustarLargo(IA.construirPrompt(AD), AD, IA.construirPrompt), IA.construirPrompt(AD)));
  await caso('sin visual_prompt en el prompt (vertical): igual', () => {
    const v = 'x'.repeat(IA.TOPE_PROMPT + 5);
    assert.equal(IA.ajustarLargo(v, AD, () => v), v);
  });
});

seccion('6. La huella');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'probar-imagen-ads-'));
await bloque('huellaPieza', async () => {
  const foto = path.join(tmp, 'producto.png');
  const cuadrado = path.join(tmp, 'cuadrado.png');
  fs.writeFileSync(foto, 'foto-1');
  fs.writeFileSync(cuadrado, 'cuadrado-1');
  const base = { prompt: 'p', aspecto: '9:16', archivos: [cuadrado, foto] };
  const h1 = IA.huellaPieza(base);
  await caso('estable', () => assert.equal(IA.huellaPieza(base, new Map()), h1));
  await caso('es sha1', () => assert.match(h1, /^[0-9a-f]{40}$/));
  await caso('cambia el prompt', () => assert.notEqual(IA.huellaPieza({ ...base, prompt: 'q' }), h1));
  await caso('cambia el aspecto', () => assert.notEqual(IA.huellaPieza({ ...base, aspecto: '1:1' }), h1));
  await caso('cambia el orden', () => assert.notEqual(IA.huellaPieza({ ...base, archivos: [foto, cuadrado] }), h1));
  await caso('cambia la foto', () => {
    fs.writeFileSync(foto, 'foto-2');
    fs.utimesSync(foto, new Date(), new Date(Date.now() + 5000));
    assert.notEqual(IA.huellaPieza(base), h1);
  });
  await caso('falta un archivo: null', () => assert.equal(IA.huellaPieza({ ...base, archivos: [foto, path.join(tmp, 'no-esta.png')] }), null));
  await caso('firmaDeArchivo', () => {
    assert.match(IA.firmaDeArchivo(foto), /^\d+-\d+$/);
    assert.equal(IA.firmaDeArchivo(path.join(tmp, 'no-esta.png')), null);
  });
});

seccion('7-8. El adaptador de Sunburst, el simulado y el motor');
await bloque('adaptador, validarCuerpo, codigoDelError, validarOrden', async () => {
  const sb = ADAPTADORES_IMAGEN['gpt-image-2-5-sunburst'];
  await caso('sin fondo: el cuerpo de siempre (image-to-image)', () =>
    assert.deepEqual(sb({ prompt: 'p', referencias: ['http://x/a.png'], aspectRatio: '9:16', resolucion: '2K' }), {
      model: 'gpt-image-2-5-sunburst-image-to-image',
      input: { prompt: 'p', input_urls: ['http://x/a.png'], aspect_ratio: '9:16', resolution: '2K' },
    })
  );
  await caso('sin fondo: el cuerpo de siempre (text-to-image)', () =>
    assert.deepEqual(sb({ prompt: 'p', referencias: [], aspectRatio: '9:16', resolucion: '2K' }), {
      model: 'gpt-image-2-5-sunburst-text-to-image',
      input: { prompt: 'p', aspect_ratio: '9:16', resolution: '2K' },
    })
  );
  await caso('fondo null o transparente: sin background', () => {
    assert.ok(!('background' in sb({ prompt: 'p', referencias: ['http://x'], aspectRatio: '1:1', resolucion: '2K', fondo: null }).input));
    assert.ok(!('background' in sb({ prompt: 'p', referencias: ['http://x'], aspectRatio: '1:1', resolucion: '2K', fondo: 'transparente' }).input));
  });
  await caso('fondo opaco: background opaque', () => {
    const c = sb({ prompt: 'p', referencias: ['http://x/a.png', 'http://x/b.png'], aspectRatio: '1:1', resolucion: '2K', fondo: 'opaco' });
    assert.deepEqual(c.input, { prompt: 'p', input_urls: ['http://x/a.png', 'http://x/b.png'], aspect_ratio: '1:1', resolution: '2K', background: 'opaque' });
    assert.equal(validarCuerpo(c.model, c.input), null);
  });
  const i2i = 'gpt-image-2-5-sunburst-image-to-image';
  await caso('simulado: acepta lo de siempre', () => {
    assert.equal(validarCuerpo(i2i, { prompt: 'p', input_urls: ['http://x'], aspect_ratio: '9:16', resolution: '2K' }), null);
    assert.equal(validarCuerpo('gpt-image-2-5-sunburst-text-to-image', { prompt: 'p', aspect_ratio: '9:16', resolution: '2K' }), null);
  });
  await caso('simulado: rechaza lo malo', () => {
    assert.equal(typeof validarCuerpo(i2i, { prompt: 'x'.repeat(20001), input_urls: ['http://x'] }), 'string');
    assert.equal(typeof validarCuerpo(i2i, { prompt: 'p', input_urls: [] }), 'string');
    assert.equal(typeof validarCuerpo(i2i, { prompt: 'p', input_urls: Array(17).fill('http://x') }), 'string');
    assert.equal(typeof validarCuerpo(i2i, { prompt: 'p', input_urls: ['http://x'], background: 'blanco' }), 'string');
    assert.equal(typeof validarCuerpo(i2i, { prompt: ' ', input_urls: ['http://x'] }), 'string');
  });
  await caso('codigoDelError', () => {
    assert.equal(codigoDelError(new Error('kie.ai rechazo la clave (401). Revisa KIE_API_KEY en el .env.')), 401);
    assert.equal(codigoDelError(new Error('kie.ai no creo la tarea. code=402 msg=The current credits are insufficient.')), 402);
    assert.equal(codigoDelError(new Error('kie.ai no creo la tarea. code=422 msg=input_urls is required')), 422);
    assert.equal(codigoDelError(new Error('kie.ai devolvio una respuesta no-JSON (HTTP 502): <html>')), 502);
    assert.equal(codigoDelError(new Error('kie.ai devolvio 429 (demasiadas solicitudes). Espera unos segundos y reintenta.')), 429);
    assert.equal(codigoDelError(new Error('kie.ai no devolvio URL al subir p.png: {"code":401,"msg":"You do not have access permissions"}')), 401);
    assert.equal(codigoDelError(new TypeError('fetch failed')), null);
  });
  await caso('validarOrden', () => {
    const p = validarOrden({ id: 'T001', piezas: [{ pieza: 'V01_1x1', orden: 'g', modo: 'generar', version: 1 }, { pieza: 'V02_1x1', orden: 'U0002', modo: 'editar', version: 3, instruccion_en: ' Make it blue. ', textos: true }] }, 'T001');
    assert.equal(p[1].instruccion_en, 'Make it blue.');
    assert.throws(() => validarOrden({ id: 'T002', piezas: [] }, 'T001'));
    assert.throws(() => validarOrden({ id: 'T001', piezas: [{ pieza: 'V1_1x1', orden: 'g', modo: 'generar', version: 1 }] }, 'T001'));
    assert.throws(() => validarOrden({ id: 'T001', piezas: [{ pieza: 'V01_1x1', orden: 'U1', modo: 'editar', version: 2 }] }, 'T001'));
    assert.throws(() => validarOrden({ id: 'T001', piezas: [{ pieza: 'V01_1x1', orden: 'g', modo: 'generar', version: 1 }, { pieza: 'V01_1x1', orden: 'rev', modo: 'generar', version: 2 }] }, 'T001'));
    assert.throws(() => validarOrden({ id: 'T001', piezas: [{ pieza: 'V01_1x1', orden: 'g', modo: 'editar', version: 1, instruccion_en: 'x' }] }, 'T001'));
    // la correccion de la revision (orden rev: la de los lotes de antes del 2026-11-09, que el motor sigue aceptando
    // para terminarlos; hoy va con «otra version» del usuario): solo al generar, recortada
    const r = validarOrden({ id: 'T003', piezas: [{ pieza: 'V01_1x1', orden: 'rev', modo: 'generar', version: 2, motivo: 'revision', correccion_en: '  Fix the headline.  ' }, { pieza: 'V02_1x1', orden: 'U0003', modo: 'editar', version: 2, instruccion_en: 'x', correccion_en: 'no va' }, { pieza: 'V03_1x1', orden: 'rev', modo: 'generar', version: 2, correccion_en: '   ' }] }, 'T003');
    assert.equal(r[0].correccion_en, 'Fix the headline.');
    assert.equal(r[1].correccion_en, undefined);
    assert.equal(r[2].correccion_en, undefined);
  });
  await caso('clasificarFallo entiende los textos del motor', () => {
    assert.equal(clasificarFallo('kie.ai rechazo la clave (401) al pedir la imagen. No se pidio nada mas.'), 'clave');
    assert.equal(clasificarFallo('kie.ai no creo la tarea: saldo insuficiente (code=402) al pedir la imagen.'), 'saldo');
    assert.equal(clasificarFallo('Quedan en kie 1 imagen sin terminar (V01_1x1).'), 'servidor');
    assert.equal(clasificarFallo('1 imagen quedo sin bajar (V01_1x1): kie ya las hizo.'), 'servidor');
    assert.equal(clasificarFallo('No pude pedir la imagen: fetch failed (ECONNREFUSED)'), 'red');
    assert.equal(clasificarFallo('  --  V01_1x1: sin imagen (contenido) — The content violates our content policy'), 'contenido');
  });
});
fs.rmSync(tmp, { recursive: true, force: true });

// ------------------------------------------------------------------ 9 a 15: contra el simulado

/** Proxy local que contesta 403 a todo (probar-velocidad.js): nada del motor sale a internet. */
async function arrancarGuardia() {
  const salidas = [];
  const srv = http.createServer((req, res) => {
    salidas.push(`${req.method} ${req.url}`);
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('probar-imagen-ads: salida a internet bloqueada');
  });
  srv.on('connect', (req, socket) => {
    salidas.push(`CONNECT ${req.url}`);
    socket.on('error', () => {});
    socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
  });
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${srv.address().port}`, salidas, cerrar: () => new Promise((r) => { srv.close(() => r()); srv.closeAllConnections?.(); }) };
}

function entornoDelMotor(url, guardia, extra = {}) {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (/^(KIE_|ELEVENLABS_|ANUNCIOS_)/i.test(k) || /^(https?|all|no)_proxy$/i.test(k) || /^NODE_USE_ENV_PROXY$/i.test(k)) delete env[k];
  }
  return {
    ...env,
    KIE_BASE_URL: url,
    KIE_BASE_ARCHIVOS_URL: url,
    // Clave falsa: config.js carga el .env sin pisar lo que ya esta en el entorno.
    KIE_API_KEY: 'simulada',
    ELEVENLABS_API_KEY: 'simulada',
    KIE_LIMITE_CREACIONES: '6', // el tope de la app para un lote (topeKie)
    KIE_AVISO_ESPERA_IMAGEN_MS: '20000',
    KIE_TOPE_ESPERA_IMAGEN_MS: '60000',
    NODE_USE_ENV_PROXY: '1',
    HTTP_PROXY: guardia.url,
    HTTPS_PROXY: guardia.url,
    NO_PROXY: '127.0.0.1,localhost,::1',
    ...extra,
  };
}

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'ignore' });
}

const escribirJSON = (ruta, v) => {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(`${ruta}.tmp`, JSON.stringify(v, null, 2));
  fs.renameSync(`${ruta}.tmp`, ruta);
};
const leerJSON = (ruta) => JSON.parse(fs.readFileSync(ruta, 'utf8'));

/**
 * El V##.json de ejemplo de cada variacion: el titular lleva el id, asi los verticales (que no llevan el
 * visual_prompt) tampoco salen con el mismo prompt (el simulado marca eso como "posible duplicado").
 */
const adDe = (v) => ({
  ...AD,
  ad_info: { variation_id: v },
  visual_prompt: `${v}: ${AD.visual_prompt}`,
  text_layers: [{ ...AD.text_layers[0], text: `${v} Hidratación\nprofunda` }, AD.text_layers[1]],
});

/** Un lote de prueba: la foto, lote.json y V01..Vn.json. */
function nuevoLote(nombre, { variaciones = 3, logo = 'arriba-centro' } = {}) {
  const carpeta = path.join(DIR_PRUEBA, nombre);
  fs.rmSync(carpeta, { recursive: true, force: true });
  fs.mkdirSync(path.join(carpeta, 'entrada'), { recursive: true });
  fs.mkdirSync(path.join(carpeta, 'app', 'imagen-ads', 'motor'), { recursive: true });
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=0x2266aa:s=96x96', '-frames:v', '1', path.join(carpeta, 'entrada', 'producto.png')]);
  escribirJSON(path.join(carpeta, 'lote.json'), {
    version: 1,
    modelo: IA.MODELO,
    resolucion: '2K',
    fondo: 'opaco',
    producto: 'entrada/producto.png',
    formatos: ['1:1', '9:16'],
    logo: logo ? { posicion: logo } : null,
  });
  for (let i = 1; i <= variaciones; i++) {
    const v = `V${String(i).padStart(2, '0')}`;
    escribirJSON(path.join(carpeta, `${v}.json`), adDe(v));
  }
  return carpeta;
}

const orden = (carpeta, id, piezas) => escribirJSON(path.join(carpeta, 'app', 'imagen-ads', 'motor', `${id}.json`), { id, creado: new Date().toISOString(), piezas });
const resultado = (carpeta, id) => leerJSON(path.join(carpeta, 'app', 'imagen-ads', 'motor', `${id}.resultado.json`));
const pngsDeImg = (carpeta) => (fs.existsSync(path.join(carpeta, 'img')) ? fs.readdirSync(path.join(carpeta, 'img')).filter((n) => n.endsWith('.png')).sort() : []);
const pendientes = (carpeta) => (fs.existsSync(path.join(carpeta, 'img')) ? fs.readdirSync(path.join(carpeta, 'img')).filter((n) => n.endsWith('.kie-pendiente.json')) : []);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Corre el motor como hijo. Devuelve { hijo, fin: Promise<{ codigo, salida }> }. */
function lanzarMotor(carpeta, env, { ociosa = 1, extra = [] } = {}) {
  const hijo = spawn(process.execPath, [MOTOR, path.relative(RAIZ, carpeta), '--ociosa', String(ociosa), ...extra], { cwd: RAIZ, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let salida = '';
  hijo.stdout.on('data', (d) => (salida += d));
  hijo.stderr.on('data', (d) => (salida += d));
  const fin = new Promise((resolve) => hijo.on('close', (codigo, senal) => resolve({ codigo: codigo ?? senal, salida })));
  const reloj = setTimeout(() => hijo.kill(), 240000);
  fin.then(() => clearTimeout(reloj));
  return { hijo, fin };
}
const correrMotor = (carpeta, env, opciones) => lanzarMotor(carpeta, env, opciones).fin;

async function esperarHasta(cond, ms, que) {
  const hasta = Date.now() + ms;
  while (Date.now() < hasta) {
    if (await cond()) return;
    await dormir(40);
  }
  throw new Error(`no paso a tiempo: ${que}`);
}

const conSalida = (r) => `codigo ${r.codigo}; lo ultimo que dijo:\n${r.salida.split(/\r?\n/).slice(-14).join('\n')}`;
const G = (v, version = 1) => ({ pieza: v, orden: 'g', modo: 'generar', version });

if (!SIN_RED) {
  fs.mkdirSync(DIR_PRUEBA, { recursive: true });
  const guardia = await arrancarGuardia();
  const sims = [];
  const simulado = async (opciones = {}) => {
    const s = await iniciar({ escala: 0.02, semilla: 7, ...opciones });
    sims.push(s);
    return s;
  };
  try {
    // ---------------------------------------------------------------- 9
    seccion('9. 3 cuadrados + 3 verticales; se mata el motor despues del primer createTask y se relanza');
    const sim = await simulado();
    const env = entornoDelMotor(sim.url, guardia);
    const lote1 = nuevoLote('basico');
    orden(lote1, 'T001', [G('V01_1x1'), G('V02_1x1'), G('V03_1x1'), G('V01_9x16'), G('V02_9x16'), G('V03_9x16')]);
    const foto = fotografiar(lote1);
    const inicio = Date.now();
    sim.reiniciarStats();
    let pendientesAlMatar = 0;
    await bloque('matar y relanzar', async () => {
      const m = lanzarMotor(lote1, env);
      await caso('crea la primera tarea', () => esperarHasta(() => sim.stats().creaciones.aceptadas >= 1 && pendientes(lote1).length >= 1, 60000, 'el primer createTask'));
      m.hijo.kill();
      await m.fin;
      pendientesAlMatar = pendientes(lote1).length;
      await caso('quedo al menos una tarea anotada para retomar', () => assert.ok(pendientesAlMatar >= 1));
      await caso('ninguna imagen bajada todavia', () => assert.deepEqual(pngsDeImg(lote1), []));
      const r = await correrMotor(lote1, env);
      await caso('relanzado: sale con 0', () => assert.equal(r.codigo, 0, conSalida(r)));
      const s = sim.stats();
      await caso('siguen siendo 6 tareas', () => assert.equal(s.creaciones.aceptadas, 6, JSON.stringify(s.creaciones)));
      await caso('sin duplicados en kie', () => assert.deepEqual(s.posiblesDuplicados, []));
      await caso('ningun cuerpo invalido', () => assert.equal(s.cuerposInvalidos, 0));
      await caso('todas image-to-image', () => assert.deepEqual(s.creaciones.porModelo, { 'gpt-image-2-5-sunburst-image-to-image': 6 }));
      await caso('nada salio a internet', () => assert.deepEqual(guardia.salidas, []));
      await caso('retomo las que estaban en kie', () => assert.ok(/retomo la tarea/.test(r.salida), r.salida.slice(-800)));
      await caso('las 6 en img/', () => assert.deepEqual(pngsDeImg(lote1), ['V01_1x1.png', 'V01_9x16.png', 'V02_1x1.png', 'V02_9x16.png', 'V03_1x1.png', 'V03_9x16.png']));
      await caso('sin pendientes', () => assert.deepEqual(pendientes(lote1), []));
      const res = resultado(lote1, 'T001');
      await caso('resultado terminado, 6 listas', () => {
        assert.equal(res.terminado, true);
        assert.equal(Object.values(res.piezas).filter((p) => p.estado === 'lista').length, 6);
        for (const [p, x] of Object.entries(res.piezas)) {
          assert.equal(x.orden, 'g', p);
          assert.equal(x.creditos, 10, p);
          assert.equal(x.modeloReal, 'gpt-image-2-5-sunburst-image-to-image', p);
          assert.equal(x.intentosApi, 1, `${p}: ${x.intentosApi} intentos`);
          assert.match(x.firma, /^\d+-\d+$/);
        }
      });
      const tareas = sim.tareas();
      await caso('los verticales se recrean desde el cuadrado', () => assert.equal(tareas.filter((t) => t.prompt.startsWith('Recreate this exact advertisement')).length, 3));
      await caso('el prompt queda en prompts/ (con la zona del logo)', () => {
        const p = fs.readFileSync(path.join(lote1, 'prompts', 'V01_1x1.txt'), 'utf8');
        assert.ok(p.includes('EXACT VISIBLE TEXT') && p.includes('RESERVED LOGO AREA'));
        assert.equal(p, IA.construirPrompt(adDe('V01'), { logo: 'arriba-centro' }));
      });
      await caso('img/log-modelos.json con el formato de gasto.js', () => {
        const log = leerJSON(path.join(lote1, 'img', 'log-modelos.json'));
        assert.ok(Date.parse(log.generado) >= inicio);
        assert.equal(typeof log.segundos, 'number');
        assert.equal(log.imagenes.length, 6);
        for (const x of log.imagenes) {
          assert.ok(IA.RE_PIEZA.test(x.id));
          assert.equal(x.archivo, `${x.id}.png`);
          assert.equal(x.respaldo, false);
          assert.equal(x.creditos, 10);
          assert.equal(typeof x.referencias, 'number');
          assert.ok(x.taskId && x.modelo);
        }
      });
      await caso('gasto.js lo lee: 6 imagenes, 60 creditos', () => {
        const c = registrarCorrida(lote1, { paso: 'anuncios', comando: 'node produccion/generar-imagen-ads.js', inicio, foto, que: ['imagenes'] });
        assert.equal(c.imagenes.length, 6);
        assert.equal(c.creditos, 60);
        assert.deepEqual(c.sinRegistro, []);
      });
      const r2 = await correrMotor(lote1, env);
      await caso('otra vez: nada nuevo', () => {
        assert.equal(r2.codigo, 0, conSalida(r2));
        assert.equal(sim.stats().creaciones.aceptadas, 6);
      });
    });

    // ---------------------------------------------------------------- 10
    seccion('10. Un rehacer cortado entre (a) y (b)');
    await bloque('rehacer cortado', async () => {
      const r = { img: path.join(lote1, 'img', 'V01_1x1.png'), prompt: path.join(lote1, 'prompts', 'V01_1x1.txt') };
      const viejaImg = fs.readFileSync(r.img);
      const viejoPrompt = fs.readFileSync(r.prompt, 'utf8');
      const nueva = path.join(DIR_PRUEBA, 'nueva.png');
      ffmpeg(['-f', 'lavfi', '-i', 'color=c=0x22aa66:s=128x128', '-frames:v', '1', nueva]);
      fs.mkdirSync(path.join(lote1, 'nuevas'), { recursive: true });
      fs.copyFileSync(nueva, path.join(lote1, 'nuevas', 'V01_1x1.png'));
      fs.writeFileSync(path.join(lote1, 'nuevas', 'V01_1x1.txt'), 'el prompt nuevo');
      escribirJSON(path.join(lote1, 'nuevas', 'V01_1x1.json'), { orden: 'rev', huella: 'x', creditos: 10, taskId: 'simCortada', modeloReal: 'gpt-image-2-5-sunburst-image-to-image', intentos: 1, referencias: 1, version: 2, motivo: 'revision' });
      orden(lote1, 'T002', [{ pieza: 'V01_1x1', orden: 'rev', modo: 'generar', version: 2, motivo: 'revision' }]);
      sim.reiniciarStats();
      const res = await correrMotor(lote1, env);
      await caso('sale con 0', () => assert.equal(res.codigo, 0, conSalida(res)));
      await caso('no crea ninguna tarea', () => assert.equal(sim.stats().creaciones.aceptadas, 0));
      await caso('la nueva en img/ y la anterior en versiones/', () => {
        assert.ok(fs.readFileSync(r.img).equals(fs.readFileSync(nueva)));
        assert.ok(fs.readFileSync(path.join(lote1, 'versiones', 'V01_1x1.v1.png')).equals(viejaImg));
        assert.equal(fs.readFileSync(path.join(lote1, 'versiones', 'V01_1x1.v1.txt'), 'utf8'), viejoPrompt);
        assert.equal(fs.readFileSync(r.prompt, 'utf8'), 'el prompt nuevo');
      });
      await caso('indice.json', () => {
        const i = leerJSON(path.join(lote1, 'versiones', 'indice.json'));
        assert.equal(i.piezas.V01_1x1.length, 1);
        assert.deepEqual(
          { ...i.piezas.V01_1x1[0], fecha: null },
          { n: 1, archivo: 'versiones/V01_1x1.v1.png', prompt: 'versiones/V01_1x1.v1.txt', reemplazadaPor: 'rev', motivo: 'revision', fecha: null }
        );
      });
      await caso('nuevas/ vacia', () => assert.deepEqual(fs.readdirSync(path.join(lote1, 'nuevas')), []));
      await caso('resultado lista, version 2, con sus creditos', () => {
        const x = resultado(lote1, 'T002').piezas.V01_1x1;
        assert.equal(x.estado, 'lista');
        assert.equal(x.version, 2);
        assert.equal(x.creditos, 10);
        assert.equal(resultado(lote1, 'T002').terminado, true);
      });
      await caso('anotada en el log de esta corrida', () => {
        const log = leerJSON(path.join(lote1, 'img', 'log-modelos.json'));
        assert.deepEqual(log.imagenes.map((x) => [x.id, x.creditos, x.taskId]), [['V01_1x1', 10, 'simCortada']]);
      });
    });

    // ---------------------------------------------------------------- 11
    seccion('11. Regenerar un cuadrado en el mismo proceso: el vertical sube la copia nueva');
    await bloque('copia nueva', async () => {
      // El cuadrado "viejo" distinto de lo que devuelve el simulado (que siempre da la misma imagen).
      const cuadrado = path.join(lote1, 'img', 'V02_1x1.png');
      ffmpeg(['-f', 'lavfi', '-i', 'color=c=0xaa2222:s=1024x1024', '-frames:v', '1', cuadrado]);
      const viejo = fs.readFileSync(cuadrado);
      // Las copias que ya habia (el vertical del caso 9 subio el cuadrado de entonces: el simulado marca cada PNG).
      const dirSubidas = path.join(lote1, 'app', 'imagen-ads', 'subidas');
      const copiasAntes = new Set(fs.existsSync(dirSubidas) ? fs.readdirSync(dirSubidas) : []);
      orden(lote1, 'T003', [{ pieza: 'V02_9x16', orden: 'U0001-v', modo: 'generar', version: 2, motivo: 'cuadrado-nuevo' }]);
      sim.reiniciarStats();
      const m = lanzarMotor(lote1, env, { ociosa: 6 });
      await caso('primera orden lista', () => esperarHasta(() => fs.existsSync(path.join(lote1, 'app', 'imagen-ads', 'motor', 'T003.resultado.json')) && resultado(lote1, 'T003').terminado === true, 60000, 'T003'));
      const subidasAntes = sim.stats().subidas.total;
      orden(lote1, 'T004', [
        { pieza: 'V02_1x1', orden: 'U0002', modo: 'generar', version: 2 },
        { pieza: 'V02_9x16', orden: 'U0002-v', modo: 'generar', version: 3, motivo: 'cuadrado-nuevo' },
      ]);
      const r = await m.fin;
      await caso('sale con 0', () => assert.equal(r.codigo, 0, conSalida(r)));
      const s = sim.stats();
      await caso('3 tareas', () => assert.equal(s.creaciones.aceptadas, 3));
      await caso('subio el cuadrado nuevo (una subida mas)', () => {
        assert.equal(subidasAntes, 2, 'la foto y el cuadrado viejo');
        assert.equal(s.subidas.total, 3, 'la foto se sube una sola vez; el cuadrado nuevo, aparte');
      });
      await caso('dos copias por contenido en subidas/', () => {
        const nuevo = fs.readFileSync(cuadrado);
        assert.ok(!nuevo.equals(viejo), 'el cuadrado cambio');
        const h = (b) => crypto.createHash('sha1').update(b).digest('hex').slice(0, 10);
        const copias = fs.readdirSync(dirSubidas).filter((n) => n.startsWith('V02_1x1-') && !copiasAntes.has(n)).sort();
        assert.deepEqual(copias, [`V02_1x1-${h(viejo)}.png`, `V02_1x1-${h(nuevo)}.png`].sort());
      });
      await caso('versiones de las dos piezas', () => {
        const i = leerJSON(path.join(lote1, 'versiones', 'indice.json'));
        assert.deepEqual(i.piezas.V02_1x1.map((x) => [x.n, x.reemplazadaPor]), [[1, 'U0002']]);
        assert.deepEqual(i.piezas.V02_9x16.map((x) => [x.n, x.reemplazadaPor, x.motivo]), [[1, 'U0001-v', 'cuadrado-nuevo'], [2, 'U0002-v', 'cuadrado-nuevo']]);
        assert.ok(fs.readFileSync(path.join(lote1, 'versiones', 'V02_1x1.v1.png')).equals(viejo));
        assert.equal(resultado(lote1, 'T004').piezas.V02_9x16.version, 3);
      });
      await caso('el log del proceso tiene las 3', () => {
        const log = leerJSON(path.join(lote1, 'img', 'log-modelos.json'));
        assert.deepEqual(log.imagenes.map((x) => x.id), ['V02_9x16', 'V02_1x1', 'V02_9x16']);
      });
      await caso('en img/ solo las finales', () => assert.equal(pngsDeImg(lote1).length, 6));
    });

    // ---------------------------------------------------------------- 11b
    seccion('11b. Regenerar con instruccion = editar la imagen limpia (y el vertical desde el cuadrado nuevo)');
    await bloque('editar', async () => {
      const antes = fs.readFileSync(path.join(lote1, 'img', 'V03_1x1.png'));
      orden(lote1, 'T005', [
        { pieza: 'V03_1x1', orden: 'U0003', modo: 'editar', version: 2, instruccion_en: 'Change the background to deep navy blue; keep everything else.', textos: true },
        { pieza: 'V03_9x16', orden: 'U0003-v', modo: 'generar', version: 2, motivo: 'cuadrado-nuevo' },
      ]);
      sim.reiniciarStats();
      const r = await correrMotor(lote1, env);
      await caso('sale con 0 y pide 2', () => {
        assert.equal(r.codigo, 0, conSalida(r));
        assert.equal(sim.stats().creaciones.aceptadas, 2);
        assert.equal(sim.stats().cuerposInvalidos, 0);
      });
      await caso('el prompt de la edicion', () => {
        const p = fs.readFileSync(path.join(lote1, 'prompts', 'V03_1x1.txt'), 'utf8');
        assert.equal(p, IA.construirPromptEdicion(adDe('V03'), { instruccion: 'Change the background to deep navy blue; keep everything else.', formato: '1:1', textos: true, logo: 'arriba-centro' }));
        assert.ok(sim.tareas().some((t) => t.prompt.startsWith('Edit this advertising image')));
      });
      await caso('la anterior queda como version 1', () => {
        assert.ok(fs.readFileSync(path.join(lote1, 'versiones', 'V03_1x1.v1.png')).equals(antes));
        const res = resultado(lote1, 'T005');
        assert.equal(res.terminado, true);
        assert.equal(res.piezas.V03_1x1.version, 2);
        assert.equal(res.piezas.V03_9x16.version, 2);
      });
      await caso('nada en nuevas/ ni pendientes', () => {
        assert.deepEqual(fs.readdirSync(path.join(lote1, 'nuevas')), []);
        assert.deepEqual(pendientes(lote1), []);
      });
    });

    // ---------------------------------------------------------------- 12
    seccion('12. contenido=100: 3 intentos y sin imagen');
    await bloque('contenido', async () => {
      const simC = await simulado({ fallos: 'contenido=100' });
      const envC = entornoDelMotor(simC.url, guardia);
      const lote = nuevoLote('contenido', { variaciones: 1 });
      orden(lote, 'T001', [G('V01_1x1'), G('V01_9x16')]);
      const r = await correrMotor(lote, envC);
      await caso('sale con 0', () => assert.equal(r.codigo, 0, conSalida(r)));
      await caso('3 intentos en kie', () => assert.equal(simC.stats().creaciones.aceptadas, 3));
      const res = resultado(lote, 'T001');
      await caso('el cuadrado sin imagen por contenido', () => {
        const x = res.piezas.V01_1x1;
        assert.equal(x.estado, 'sin-imagen');
        assert.equal(x.motivo, 'contenido');
        assert.equal(x.mensaje, 'kie no quiso hacer esta imagen por sus reglas de contenido');
        assert.equal(x.intentosApi, 3);
      });
      await caso('el vertical sin cuadrado: sin imagen, sin pedir nada', () => {
        assert.equal(res.piezas.V01_9x16.estado, 'sin-imagen');
        assert.equal(res.piezas.V01_9x16.motivo, 'falta-cuadrado');
        assert.equal(res.piezas.V01_9x16.intentosApi, 0);
      });
      await caso('terminada y sin archivos en img/', () => {
        assert.equal(res.terminado, true);
        assert.deepEqual(pngsDeImg(lote), []);
      });
      const r2 = await correrMotor(lote, envC);
      await caso('al relanzar: 0 y ninguna tarea nueva', () => {
        assert.equal(r2.codigo, 0, conSalida(r2));
        assert.equal(simC.stats().creaciones.aceptadas, 3);
      });
      // Un tercer intento que llega a otra orden (Regenerar del usuario) si se pide: es otra orden.
      orden(lote, 'T002', [{ pieza: 'V01_1x1', orden: 'U0001', modo: 'generar', version: 2 }]);
      const r3 = await correrMotor(lote, envC);
      await caso('otra orden de la misma pieza si se pide (3 intentos mas)', () => {
        assert.equal(r3.codigo, 0, conSalida(r3));
        assert.equal(simC.stats().creaciones.aceptadas, 6);
        assert.equal(resultado(lote, 'T002').piezas.V01_1x1.estado, 'sin-imagen');
      });
    });

    // ---------------------------------------------------------------- 12b
    seccion('12b. contenido=100: se mata el motor con su 3.er intento en kie y se relanza');
    await bloque('tope en la retoma', async () => {
      const simC = await simulado({ fallos: 'contenido=100' });
      const envC = entornoDelMotor(simC.url, guardia);
      const lote = nuevoLote('tope-retoma', { variaciones: 1, logo: null });
      orden(lote, 'T001', [G('V01_1x1')]);
      const m = lanzarMotor(lote, envC);
      await caso('llega al 3.er intento con su tarea en kie', () => esperarHasta(() => simC.stats().creaciones.aceptadas >= 3 && pendientes(lote).length >= 1, 90000, 'el tercer createTask'));
      m.hijo.kill();
      await m.fin;
      const r = await correrMotor(lote, envC);
      const x = resultado(lote, 'T001')?.piezas?.V01_1x1;
      await caso('relanzado: sale con 0 y no pide una 4.a', () => {
        assert.equal(r.codigo, 0, conSalida(r));
        assert.equal(simC.stats().creaciones.aceptadas, 3, conSalida(r));
        assert.ok(!r.salida.includes('intento 4/3'), conSalida(r));
      });
      await caso('retomo la del 3.er intento', () => assert.ok(/retomo la tarea/.test(r.salida), conSalida(r)));
      await caso('sin imagen por contenido, con 3 intentos', () => {
        assert.equal(x?.estado, 'sin-imagen', JSON.stringify(x));
        assert.equal(x.motivo, 'contenido');
        assert.equal(x.intentosApi, 3);
      });
      await caso('sin pendientes', () => assert.deepEqual(pendientes(lote), []));
    });

    // ---------------------------------------------------------------- 13
    seccion('13. Un intento anotado que nunca llego a kie se devuelve');
    await bloque('intento devuelto', async () => {
      const lote = nuevoLote('intento-abierto', { variaciones: 1, logo: null });
      orden(lote, 'T001', [G('V01_1x1')]);
      escribirJSON(path.join(lote, 'app', 'imagen-ads', 'motor', 'T001.resultado.json'), {
        id: 'T001',
        terminado: false,
        piezas: { V01_1x1: { orden: 'g', estado: 'creando', intentosApi: 3, intentoAbierto: true, taskId: null, version: 1 } },
      });
      sim.reiniciarStats();
      const r = await correrMotor(lote, env);
      const x = resultado(lote, 'T001').piezas.V01_1x1;
      await caso('se pidio y salio', () => {
        assert.equal(r.codigo, 0, conSalida(r));
        assert.equal(sim.stats().creaciones.aceptadas, 1);
        assert.equal(x.estado, 'lista');
        assert.equal(x.intentosApi, 3);
      });
      await caso('sin logo: el prompt es el de Python', () => assert.equal(fs.readFileSync(path.join(lote, 'prompts', 'V01_1x1.txt'), 'utf8'), IA.construirPrompt(adDe('V01'))));
    });

    // ---------------------------------------------------------------- 14
    seccion('14. Una tarea que sigue en kie: no se pide otra');
    await bloque('sigue en kie', async () => {
      const simT = await simulado({ fallos: 'trabadas=1' });
      const envT = entornoDelMotor(simT.url, guardia, { KIE_AVISO_ESPERA_IMAGEN_MS: '400', KIE_TOPE_ESPERA_IMAGEN_MS: '1500' });
      const lote = nuevoLote('trabada', { variaciones: 1 });
      orden(lote, 'T001', [G('V01_1x1')]);
      const r = await correrMotor(lote, envT);
      await caso('sale con 1, clase servidor', () => {
        assert.equal(r.codigo, 1, conSalida(r));
        assert.equal(clasificarFallo(r.salida), 'servidor', r.salida.slice(-600));
      });
      await caso('una sola tarea, anotada', () => {
        assert.equal(simT.stats().creaciones.aceptadas, 1);
        assert.equal(pendientes(lote).length, 1);
        assert.equal(resultado(lote, 'T001').terminado, false);
      });
      const r2 = await correrMotor(lote, envT);
      await caso('la siguiente corrida la retoma (ninguna tarea nueva)', () => {
        assert.equal(r2.codigo, 1, conSalida(r2));
        assert.ok(/retomo la tarea/.test(r2.salida));
        assert.equal(simT.stats().creaciones.aceptadas, 1);
        assert.equal(resultado(lote, 'T001').piezas.V01_1x1.intentosApi, 1);
      });
    });

    // ---------------------------------------------------------------- 15
    seccion('15. Saldo, clave, red y orden invalida');
    await bloque('fallos de todo el proceso', async () => {
      const simS = await simulado({ saldo: 0 });
      const lote = nuevoLote('saldo', { variaciones: 2 });
      orden(lote, 'T001', [G('V01_1x1'), G('V02_1x1')]);
      const r = await correrMotor(lote, entornoDelMotor(simS.url, guardia));
      await caso('402: codigo 1 y clase saldo', () => {
        assert.equal(r.codigo, 1, conSalida(r));
        assert.equal(clasificarFallo(r.salida), 'saldo', r.salida.slice(-600));
        assert.equal(simS.stats().creaciones.aceptadas, 0);
      });
      await caso('402: el intento se devuelve y la orden sigue sin terminar', () => {
        const res = resultado(lote, 'T001');
        assert.equal(res.terminado, false);
        for (const x of Object.values(res.piezas)) {
          assert.equal(x.intentosApi, 0);
          assert.ok(!['lista', 'sin-imagen'].includes(x.estado));
        }
      });

      // 401: un kie de mentira que acepta la subida y rechaza la clave al crear.
      const falso = http.createServer((req, res) => {
        let cuerpo = '';
        req.on('data', (d) => (cuerpo += d));
        req.on('end', () => {
          const json = (c, o) => {
            res.writeHead(c, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(o));
          };
          if (req.url.startsWith('/api/file-base64-upload')) return json(200, { code: 200, data: { downloadUrl: `http://127.0.0.1:${falso.address().port}/archivos/x.png` } });
          if (req.url.startsWith('/api/v1/jobs/createTask')) return json(401, { code: 401, msg: 'You do not have access permissions', data: null });
          return json(404, { code: 404, msg: 'no', data: null });
        });
      });
      await new Promise((resolve) => falso.listen(0, '127.0.0.1', resolve));
      try {
        const lote401 = nuevoLote('clave', { variaciones: 1 });
        orden(lote401, 'T001', [G('V01_1x1')]);
        const r401 = await correrMotor(lote401, entornoDelMotor(`http://127.0.0.1:${falso.address().port}`, guardia));
        await caso('401: codigo 1 y clase clave', () => {
          assert.equal(r401.codigo, 1, conSalida(r401));
          assert.equal(clasificarFallo(r401.salida), 'clave', r401.salida.slice(-600));
          assert.equal(resultado(lote401, 'T001').piezas.V01_1x1.intentosApi, 0);
        });
      } finally {
        await new Promise((resolve) => falso.close(() => resolve()));
      }

      // Sin red: un puerto donde no escucha nadie.
      const libre = await new Promise((resolve) => {
        const s = http.createServer();
        s.listen(0, '127.0.0.1', () => {
          const p = s.address().port;
          s.close(() => resolve(p));
        });
      });
      const loteRed = nuevoLote('red', { variaciones: 1 });
      orden(loteRed, 'T001', [G('V01_1x1')]);
      const rRed = await correrMotor(loteRed, entornoDelMotor(`http://127.0.0.1:${libre}`, guardia));
      await caso('sin red: codigo 1 y clase red', () => {
        assert.equal(rRed.codigo, 1, conSalida(rRed));
        assert.equal(clasificarFallo(rRed.salida), 'red', rRed.salida.slice(-600));
      });

      const loteMal = nuevoLote('orden-mala', { variaciones: 1 });
      orden(loteMal, 'T001', [{ pieza: 'V01_4x5', orden: 'g', modo: 'generar', version: 1 }]);
      const rMal = await correrMotor(loteMal, entornoDelMotor(sim.url, guardia));
      await caso('orden invalida: codigo 2', () => assert.equal(rMal.codigo, 2, conSalida(rMal)));
      const sinLote = path.join(DIR_PRUEBA, 'sin-lote');
      fs.mkdirSync(sinLote, { recursive: true });
      const rSin = await correrMotor(sinLote, entornoDelMotor(sim.url, guardia));
      await caso('sin lote.json: codigo 2', () => assert.equal(rSin.codigo, 2, conSalida(rSin)));
      await caso('nada salio a internet', () => assert.deepEqual(guardia.salidas, []));
    });

    // ---------------------------------------------------------------- 16
    seccion('16. Gasto: la app se cierra con el motor andando y la corrida que retoma rehace una pieza (--heredar-log)');
    await bloque('registro heredado', async () => {
      const lote = nuevoLote('heredar', { variaciones: 2, logo: null });
      // A: la app abre la corrida (como ctx.correr) y se cierra de golpe: la corrida queda abierta
      const a = abrirCorrida(lote, 'anuncios');
      orden(lote, 'T001', [G('V01_1x1'), G('V02_1x1')]);
      sim.reiniciarStats();
      const rA = await correrMotor(lote, env);
      await caso('A: 2 imagenes y su log', () => {
        assert.equal(rA.codigo, 0, conSalida(rA));
        assert.equal(leerJSON(path.join(lote, 'img', 'log-modelos.json')).imagenes.length, 2);
      });
      // B: la retoma reusa la foto de A y el motor rehace V01_1x1 (una orden rev, de un lote de antes del 2026-11-09)
      const b = abrirCorrida(lote, 'anuncios');
      await caso('B retoma la corrida abierta', () => assert.equal(b.retomada, true));
      orden(lote, 'T002', [{ pieza: 'V01_1x1', orden: 'rev', modo: 'generar', version: 2, motivo: 'revision' }]);
      const rB = await correrMotor(lote, env, { extra: ['--heredar-log'] });
      const cB = cerrarCorrida(lote, { paso: 'anuncios', comando: 'node produccion/generar-imagen-ads.js', inicio: b.inicio, foto: b.foto, que: ['imagenes'] });
      await caso('B: hereda el registro de A', () => {
        assert.equal(rB.codigo, 0, conSalida(rB));
        assert.ok(/sigo el registro de gasto/.test(rB.salida), conSalida(rB));
        // las dos de A se hacen a la vez (su orden en el log cambia de una corrida a otra); la de B va siempre al final
        const ids = leerJSON(path.join(lote, 'img', 'log-modelos.json')).imagenes.map((x) => x.id);
        assert.equal(ids.length, 3, JSON.stringify(ids));
        assert.deepEqual([...ids.slice(0, 2)].sort(), ['V01_1x1', 'V02_1x1']);
        assert.equal(ids[2], 'V01_1x1');
      });
      await caso('el gasto ve las 3 pagadas: 30 creditos, nada estimado', () => {
        assert.equal(sim.stats().creaciones.aceptadas, 3);
        assert.equal(cB.creditos, 30, JSON.stringify(cB));
        assert.equal(cB.imagenes.length, 3);
        assert.deepEqual(cB.sinRegistro, []);
      });
      // C: una corrida nueva (la de antes ya se cerro): aunque llegue --heredar-log, no hereda lo ya contado
      const d = abrirCorrida(lote, 'anuncios');
      orden(lote, 'T003', [{ pieza: 'V02_1x1', orden: 'rev', modo: 'generar', version: 2, motivo: 'revision' }]);
      const rC = await correrMotor(lote, env, { extra: ['--heredar-log'] });
      const cC = cerrarCorrida(lote, { paso: 'anuncios', comando: 'node produccion/generar-imagen-ads.js', inicio: d.inicio, foto: d.foto, que: ['imagenes'] });
      await caso('una corrida ya cerrada no se hereda: 10 creditos', () => {
        assert.equal(d.retomada, false);
        assert.equal(rC.codigo, 0, conSalida(rC));
        assert.equal(cC.creditos, 10, JSON.stringify(cC));
        assert.deepEqual(cC.imagenes.map((x) => x.id), ['V02_1x1']);
      });
    });
  } finally {
    for (const s of sims) await s.cerrar();
    await guardia.cerrar();
    if (!CONSERVAR) fs.rmSync(DIR_PRUEBA, { recursive: true, force: true });
  }
}

// ------------------------------------------------------------------ fin
console.log('');
if (fallos.length) {
  console.log(`FALLARON ${fallos.length} de ${ok + fallos.length} comprobaciones:\n`);
  for (const f of fallos) console.log(`  x ${f}\n`);
  process.exitCode = 1;
} else {
  console.log(`Todo bien: ${ok} comprobaciones.${SIN_RED ? ' (sin la parte del simulado: --sin-red)' : ''}`);
}

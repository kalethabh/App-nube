import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.AIA_MOTOR = 'claude';
const { validarTitulos, firmaTitulos, seleccionarTitulos, estadoTitulos } = await import('../server/lib/imagen-ads/titulos.js');
const { variarTitulo, completarVariacionesFieles } = await import('../server/lib/imagen-ads/variaciones-fieles.js');
const { verificarV } = await import('../server/lib/imagen-ads/verificar.js');
const { cargarYNormalizar } = await import('../server/lib/imagen-ads/estado.js');
const { guardarJSON, R } = await import('../server/lib/imagen-ads/disco.js');
const propuestas = { esencia: 'La demostración del mismo beneficio', opciones: [{ id: 'T1', titulo: 'Tu rutina más sencilla', porQue: 'Expresa el beneficio', base: 'Deseo central' }, { id: 'T2', titulo: 'Cuida tu rutina', porQue: 'Mismo deseo', base: 'Dolor resaltado' }] };
const base = { ad_info: { variation_id: 'V01' }, global_identity: { color_palette: 'Blue', text_typography: 'Bold' }, visual_prompt: 'A product jar centered on a blue background with a demonstration of its use, soft studio lighting and a bold headline above, keeping the original composition, photographic materials and contrast unchanged across all variations.', text_layers: [{ text: propuestas.opciones[0].titulo, reference_function: 'main headline' }, { text: 'Conoce el producto' }], mandatory_visual_elements: ['product'], final_generation_exclusions: [], reference_structure_analysis: { forbidden_additions: [] }, language_rule: 'Spanish' };
function carpeta(t) { const c = fs.mkdtempSync(path.join(os.tmpdir(), 'kads-titulos-')); t.after(() => fs.rmSync(c, { recursive: true, force: true })); return c; }
test('propuestas incompletas y duplicadas se rechazan', () => {
 assert.equal(validarTitulos(propuestas, 2).ok, true);
 assert.equal(validarTitulos({ ...propuestas, opciones: [propuestas.opciones[0]] }, 2).ok, false);
 assert.equal(validarTitulos({ ...propuestas, opciones: [propuestas.opciones[0], propuestas.opciones[0]] }, 2).ok, false);
});
test('selección exacta, orden del usuario e invalidación al cambiar referencia', (t) => {
 const c = carpeta(t), b = { cantidad: 2, datos: {}, referencias: ['entrada/referencias/R01.png'] };
 fs.mkdirSync(path.join(c, 'entrada/referencias'), { recursive: true }); fs.writeFileSync(path.join(c, b.referencias[0]), 'original');
 guardarJSON(path.join(c, 'app/imagen-ads/titulos.json'), { ...propuestas, estado: 'lista', firma: firmaTitulos(c, b) });
 assert.deepEqual(seleccionarTitulos(c, b, ['T2', 'T1']).titulos.map((x) => x.id), ['T2', 'T1']);
 assert.throws(() => seleccionarTitulos(c, b, ['T1', 'T1']));
 assert.throws(() => seleccionarTitulos(c, b, ['T1', 'desconocido']));
 fs.writeFileSync(path.join(c, b.referencias[0]), 'cambiada');
 assert.equal(estadoTitulos(c, b).estado, 'sin');
 assert.throws(() => seleccionarTitulos(c, b, ['T1', 'T2']));
});
test('la variación conserva visual, identidad y textos secundarios sin mutar la base', () => {
 const ad = variarTitulo(base, propuestas.opciones[0].titulo, propuestas.opciones[1].titulo, 'V02');
 assert.equal(ad.visual_prompt, base.visual_prompt);
 assert.deepEqual(ad.global_identity, base.global_identity);
 assert.deepEqual(ad.text_layers[1], base.text_layers[1]);
 assert.equal(ad.text_layers[0].text, propuestas.opciones[1].titulo);
 assert.equal(base.ad_info.variation_id, 'V01');
 assert.equal(variarTitulo(base, 'No existe', 'Otro', 'V02'), null);
});
test('plantillas validadas: no otra IA, no sobreescritura y listas para el motor', (t) => {
 const c = carpeta(t), b = { cantidad: 5, formatos: ['1:1'], fiel: true, seleccionTitulos: { titulos: Array.from({ length: 5 }, (_, i) => ({ titulo: i ? `Título elegido ${i}` : propuestas.opciones[0].titulo })) } };
 const plan = { variaciones: b.seleccionTitulos.titulos.map((x, i) => ({ id: `V0${i + 1}`, fuente: 'referencia', referencia: 'entrada/referencias/R01.png', titular: x.titulo })) };
 guardarJSON(R.plan(c), plan); guardarJSON(R.v(c, 'V01'), base);
 const segunda = variarTitulo(base, propuestas.opciones[0].titulo, b.seleccionTitulos.titulos[1].titulo, 'V02');
 segunda.visual_prompt += ' A different scene that should not survive.';
 guardarJSON(R.v(c, 'V02'), segunda);
 assert.equal(verificarV(c, 'V01', { brief: b, plan }).errores.length, 0);
 const est = cargarYNormalizar(c, b);
 assert.equal(est.variaciones.V05.prompt, 'listo');
 assert.equal(JSON.parse(fs.readFileSync(R.v(c, 'V02'))).visual_prompt, base.visual_prompt);
 const ad = JSON.parse(fs.readFileSync(R.v(c, 'V05')));
 assert.equal(ad.text_layers[0].text, b.seleccionTitulos.titulos[4].titulo);
 assert.equal(ad.visual_prompt, base.visual_prompt);
 assert.deepEqual(completarVariacionesFieles(c, b), []);
 ad.text_layers[0].text = 'Un título no aprobado'; guardarJSON(R.v(c, 'V05'), ad);
 assert.ok(verificarV(c, 'V05', { brief: b, plan }).errores.some((x) => x.includes('título exacto')));
 completarVariacionesFieles(c, b);
 assert.equal(JSON.parse(fs.readFileSync(R.v(c, 'V05'))).text_layers[0].text, 'Un título no aprobado');
});

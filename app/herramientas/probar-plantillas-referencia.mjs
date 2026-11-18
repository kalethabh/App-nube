// Prueba de las PLANTILLAS de imagen (2026-11-18s): los anuncios validados van al modelo como referencia, en el modo
// rápido «copiar», con el producto, los textos y la paleta del producto. Sin internet y sin cobrar:
//   node app/herramientas/probar-plantillas-referencia.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as ref from '../server/lib/imagen-ads/plantillas-referencia.js';
import { prepararRapido } from '../server/lib/imagen-ads/rapido.js';
import { construirPrompt } from '../../produccion/imagen-ads.js';

const resultados = [];
const check = (nombre, ok, detalle) => {
  resultados.push(Boolean(ok));
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${ok ? '' : `\n      ${JSON.stringify(detalle)?.slice(0, 400)}`}`);
};

// 1. el catálogo
const cat = ref.catalogo();
check('30 plantillas con su imagen y su miniatura', cat.plantillas.length === 30 && cat.plantillas.every((p) => ref.rutaDeArchivo(`${p.id}.jpg`) && ref.rutaDeArchivo(`${p.id}.jpg`, true)), cat.plantillas.length);
check('cada plantilla en una familia conocida', cat.plantillas.every((p) => cat.familias.some((f) => f.id === p.familia)));
check('nombres de archivo raros no se sirven', !ref.rutaDeArchivo('../indice.json') && !ref.rutaDeArchivo('p99.jpg') && !ref.rutaDeArchivo('p01.png'));

// 2. la elección
const indice = JSON.parse(fs.readFileSync(path.join(ref.DIR, 'indice.json'), 'utf8'));
const grupoDe = new Map(indice.plantillas.map((p) => [p.id, p.grupo]));
const familiaDe = new Map(indice.plantillas.map((p) => [p.id, p.familia]));
for (const n of [1, 4, 6, 10, 25]) {
  const e = ref.elegir(n, []);
  const grupos = new Set(e.map((id) => grupoDe.get(id)));
  const familias = new Set(e.map((id) => familiaDe.get(id)));
  check(`sin elegir, ${n}: ${Math.min(n, ref.MAXIMO)} distintas, sin repetir grupo y de ${Math.min(n, 6)} familias`, e.length === Math.min(n, ref.MAXIMO) && grupos.size === e.length && familias.size === Math.min(n, 6), e);
}
check('otro día, otra mezcla', ref.elegir(6, [], { dia: 1 }).join() !== ref.elegir(6, [], { dia: 2 }).join());
check('las elegidas, en su orden y sin repetir', ref.elegir(3, ['p05', 'p01', 'p05', 'x']).join() === 'p05,p01');

// 3. el lote: las referencias y lo que recibe el modelo
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'plantillas-ref-'));
fs.mkdirSync(path.join(TMP, 'entrada'), { recursive: true });
fs.copyFileSync(path.join(ref.DIR, 'mini', 'p01.jpg'), path.join(TMP, 'entrada', 'producto.png'));
const ids = ref.elegir(4, []);
const brief = { slug: '_img-prueba', cantidad: 6, formatos: ['1:1'], modo: 'nuevos', desdePlantillas: true, fiel: true, rapido: true, datos: { nombre: 'Crema Luna', pais: 'Colombia' }, fotoProducto: 1 };
brief.referencias = ref.copiarAlLote(TMP, ids);
fs.mkdirSync(path.join(TMP, 'app'), { recursive: true });
fs.writeFileSync(path.join(TMP, 'app', 'brief.json'), JSON.stringify(brief));
check('las plantillas quedan como referencias R01…R04', brief.referencias.join() === 'entrada/referencias/R01.jpg,entrada/referencias/R02.jpg,entrada/referencias/R03.jpg,entrada/referencias/R04.jpg' && brief.referencias.every((r) => fs.existsSync(path.join(TMP, r))));
const r = prepararRapido(TMP, brief);
check('el modo rápido las arma en modo «copiar»', r.ok && r.modo === 'copiar' && r.referencias === 4, r);
const plan = JSON.parse(fs.readFileSync(path.join(TMP, 'plan.json'), 'utf8'));
check('6 anuncios repartidos entre las 4 plantillas', plan.variaciones.length === 6 && new Set(plan.variaciones.map((v) => v.referencia)).size === 4, plan.variaciones.map((v) => v.referencia));
const v1 = JSON.parse(fs.readFileSync(path.join(TMP, 'V01.json'), 'utf8'));
check('cada anuncio pide la paleta del producto, sin precios ni ofertas', v1.app_rapido === 'copiar' && /color palette to the product/i.test(v1.visual_prompt) && /no prices/i.test(v1.visual_prompt), v1.visual_prompt);
let prompt = '';
try {
  prompt = construirPrompt(v1, { formato: '1:1', referencia: true, producto: true });
} catch (e) {
  prompt = String(e.message);
}
check('al modelo le llega «mantén el diseño y cambia producto y textos»', /REFERENCE AD/.test(prompt) && /Replace the product/.test(prompt) && /Rewrite every other text/.test(prompt), prompt.slice(0, 300));

fs.rmSync(TMP, { recursive: true, force: true });
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${resultados.length} OK`);
process.exit(ok === resultados.length ? 0 : 1);

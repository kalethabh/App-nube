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
check('las plantillas (30 validadas + las de TrendTrack) con su imagen y su miniatura', cat.plantillas.length >= 54 && cat.plantillas.every((p) => ref.rutaDeArchivo(`${p.id}.jpg`) && ref.rutaDeArchivo(`${p.id}.jpg`, true)), cat.plantillas.length);
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

// 3. el lote: las referencias y lo que recibe el modelo. Un producto de prueba (glúteos, caderas y piernas) con su
// investigación y la matriz de Andromeda; se borra al final.
const { PRODUCTOS } = await import('../server/lib/productos.js');
const ID = `prueba-plantillas-${process.pid}`;
const DIR_P = path.join(PRODUCTOS, ID);
fs.mkdirSync(path.join(DIR_P, 'investigacion'), { recursive: true });
fs.writeFileSync(path.join(DIR_P, 'producto.json'), JSON.stringify({ id: ID, nombre: 'Curvas Plus' }));
fs.writeFileSync(path.join(DIR_P, 'ficha.json'), JSON.stringify({ nombre: 'Curvas Plus', beneficios: ['Más volumen en glúteos', 'Caderas más anchas', 'Piernas tonificadas'], dolor: 'Siento la cola plana y que no lleno el jean.', publico: 'Mujeres de 20 a 40 años', pais: 'Colombia' }));
const tabla = (columnas, filas, nota = '') => ({ tipo: 'tabla', columnas, filas, nota });
fs.writeFileSync(path.join(DIR_P, 'investigacion', 'investigacion.json'), JSON.stringify({
  formato: 'documento', pais: 'Colombia',
  secciones: [
    { titulo: 'Los 5 resultados deseados', bloques: [{ tipo: 'numerada', items: ['**Verse con curvas.** Llenar el jean.', '**Natural.** Sin cirugía.'] }] },
    { titulo: 'Tiempos de transformación', bloques: [tabla(['Prioridad', 'Qué notan', 'Cuándo', 'De dónde sale'], [['1', 'El jean le queda mejor', 'Desde la semana 4', 'Reseñas']], 'Usa solo «desde la semana 4».')] },
    { titulo: 'Avatar principal', bloques: [{ tipo: 'caja', estilo: 'avatar', titulo: 'Yuliana, la flaca del grupo', texto: 'Tiene 26 años.' }] },
    { titulo: 'Deseo central, propuestas de valor y copy para la landing', bloques: [{ tipo: 'cita', estilo: 'central', texto: 'Verme con curvas y llenar el jean sin operarme.' }] },
    { titulo: 'Conceptos para Meta (Andromeda)', bloques: [
      tabla(['Persona base', 'Faceta', 'Dolor en sus palabras', 'Escenario visual'], [['Yuliana, 26', 'La que va a la playa', 'Me da pena el vestido de baño', 'Playa de Cartagena'], ['Yuliana, 26', 'La del jean', 'El jean me queda flojo atrás', 'Probador de un centro comercial']]),
      tabla(['#', 'Faceta', 'Problema', 'Contexto', 'Formato', 'Hook'], [['1', 'La que va a la playa', 'Cola plana', 'Antes del viaje de diciembre', 'Antes y después', 'Lista para la playa'], ['2', 'La del jean', 'No llena el jean', 'Sábado de compras', 'Una persona', 'Por fin lleno el jean']]),
    ] },
  ],
  anuncios_imagen: [{ plantilla: 'historia', concepto: 2, faceta: 'La del jean', angulo: 'deseo', contexto: 'Sábado de compras', textos: { titular: 'Por fin el jean me queda perfecto' } }],
}));
const { contextoCreativo } = await import('../server/lib/imagen-ads/angulo-producto.js');
const ctx = contextoCreativo(ID);
check('lee el deseo central, los tiempos y la matriz de Andromeda', /curvas/.test(ctx.deseo) && ctx.tiempos[0]?.cuando === 'Desde la semana 4' && ctx.conceptos.length === 2 && ctx.conceptos[0].escenario === 'Playa de Cartagena' && ctx.conceptos[1].titular === 'Por fin el jean me queda perfecto', ctx);

// productos relacionados: el de prueba es de glúteos, caderas y piernas
const rel = ref.relacionadas(ID);
const temasDe = new Map(JSON.parse(fs.readFileSync(path.join(ref.DIR, 'indice.json'), 'utf8')).plantillas.map((p) => [p.id, p.temas || []]));
check('reconoce de qué trata el producto (glúteos, curvas, piernas)', ['gluteos', 'curvas', 'piernas'].every((t) => rel.temas.includes(t)), rel.temas);
check('las relacionadas son de glúteos, curvas o piernas, la más cercana primero', rel.ids.length >= 10 && rel.ids.every((id) => temasDe.get(id).some((t) => rel.temas.includes(t))) && temasDe.get(rel.ids[0]).includes(rel.temas[0]), rel);
const auto = ref.elegir(4, [], { temas: rel.temas });
check('«Que la app elija» toma primero las de productos relacionados (sin repetir forma)', auto.every((id) => rel.ids.includes(id)) && new Set(auto.map((id) => grupoDe.get(id))).size === 4, auto);
check('«hombres» solo no hace relacionado (un producto para la tos elige como si no hubiera temas)', ref.temasDeTexto('Gotas para la tos y la flema, para hombres y mujeres').includes('respiratorio') && ref.elegir(3, [], { temas: ['respiratorio', 'hombres'] }).join() === ref.elegir(3, []).join());
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'plantillas-ref-'));
fs.mkdirSync(path.join(TMP, 'entrada'), { recursive: true });
fs.copyFileSync(path.join(ref.DIR, 'mini', 'p01.jpg'), path.join(TMP, 'entrada', 'producto.png'));
const ids = ref.elegir(4, []);
const brief = { slug: '_img-prueba', plantillasReferencia: ids, productoId: ID, cantidad: 6, formatos: ['1:1'], modo: 'nuevos', desdePlantillas: true, fiel: true, rapido: true, datos: { nombre: 'Curvas Plus', pais: 'Colombia' }, fotoProducto: 1 };
brief.referencias = ref.copiarAlLote(TMP, ids);
fs.mkdirSync(path.join(TMP, 'app'), { recursive: true });
fs.writeFileSync(path.join(TMP, 'app', 'brief.json'), JSON.stringify(brief));
check('las plantillas quedan como referencias R01…R04', brief.referencias.join() === 'entrada/referencias/R01.jpg,entrada/referencias/R02.jpg,entrada/referencias/R03.jpg,entrada/referencias/R04.jpg' && brief.referencias.every((r) => fs.existsSync(path.join(TMP, r))));
const r = prepararRapido(TMP, brief);
check('el modo rápido las arma', r.ok && r.referencias === 4, r);
const plan = JSON.parse(fs.readFileSync(path.join(TMP, 'plan.json'), 'utf8'));
check('6 anuncios repartidos entre las 4 plantillas', plan.variaciones.length === 6 && new Set(plan.variaciones.map((v) => v.referencia)).size === 4, plan.variaciones.map((v) => v.referencia));
const leerV = (k) => JSON.parse(fs.readFileSync(path.join(TMP, `V0${k}.json`), 'utf8'));
const v1 = leerV(1);
const v2 = leerV(2);
check('cada anuncio va en modo «plantilla» con el ángulo del producto', v1.app_rapido === 'plantilla' && /THIS PRODUCT'S ANGLE: Verme con curvas/.test(v1.visual_prompt.replace(' (what the image must SHOW, in the template\'s form)', '')), v1.visual_prompt);
check('cada imagen, un concepto distinto de Andromeda (faceta, momento y escenario)', /La que va a la playa/.test(v1.visual_prompt) && /Playa de Cartagena/.test(v1.visual_prompt) && /La del jean/.test(v2.visual_prompt) && !/La del jean/.test(v1.visual_prompt), [v1.visual_prompt, v2.visual_prompt]);
const v3 = leerV(3);
check('un concepto que se repite cambia de momento y de titular', /La que va a la playa/.test(v3.visual_prompt) && !/Antes del viaje de diciembre/.test(v3.visual_prompt) && v3.text_layers[0].text !== v1.text_layers[0].text, [v3.visual_prompt, v3.text_layers, v1.text_layers]);
check('el titular sale de la investigación (con la corrección del usuario)', v2.text_layers[0].text === 'Por fin el jean me queda perfecto', v2.text_layers);
const plantillaV1 = ref.fichaDe(brief.plantillasReferencia?.[0] || ids[0]);
check('el titular sigue la estructura de su plantilla y ataca el deseo principal', /HEADLINE STRUCTURE of this template/.test(v1.visual_prompt) && v1.visual_prompt.includes(plantillaV1.ejemplo) && /main desire or benefit \(Verme con curvas/.test(v1.visual_prompt), v1.visual_prompt);
check('el resultado se ve grande (más volumen si el deseo es volumen)', /MORE volume, roundness and lift/.test(v1.visual_prompt));
check('todas las plantillas tienen la fórmula de su titular', JSON.parse(fs.readFileSync(path.join(ref.DIR, 'indice.json'), 'utf8')).plantillas.every((p) => p.titular && p.ejemplo));
check('solo los tiempos de la investigación, con su regla', /Desde la semana 4/.test(v1.visual_prompt) && /never with invented days/.test(v1.visual_prompt));
check('sin precios ni la marca de la plantilla', v1.final_generation_exclusions.some((x) => /prices/.test(x)) && v1.final_generation_exclusions.some((x) => /body area/.test(x)));
let prompt = '';
try {
  prompt = construirPrompt(v1, { referencia: true });
} catch (e) {
  prompt = String(e.message);
}
check('al modelo le llega «la forma de la plantilla, el ángulo del producto»', /TEMPLATE/.test(prompt) && /VISUAL MECHANISM/.test(prompt) && /swollen legs/.test(prompt) && /Day 1 \/ Day 14 \/ Day 30/.test(prompt) && /Andromeda/.test(prompt) && /THIS PRODUCT'S ANGLE/.test(prompt), prompt.slice(0, 400));

// sin investigación: igual cada imagen a otro momento
fs.rmSync(path.join(DIR_P, 'investigacion'), { recursive: true, force: true });
const r2 = prepararRapido(TMP, { ...brief });
const a = leerV(1).visual_prompt;
const b = leerV(2).visual_prompt;
check('sin investigación: el ángulo de la ficha y un momento distinto en cada imagen', r2.ok && /Más volumen en glúteos/.test(a) && /CONCEPT of this image/.test(a) && a.split('CONCEPT')[1] !== b.split('CONCEPT')[1], [a, b]);
fs.rmSync(DIR_P, { recursive: true, force: true });
fs.rmSync(TMP, { recursive: true, force: true });
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${resultados.length} OK`);
process.exit(ok === resultados.length ? 0 : 1);

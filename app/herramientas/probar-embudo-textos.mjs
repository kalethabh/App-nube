import assert from 'node:assert/strict';
import { textoEmbudo } from '../compartido/texto-embudo.js';
import { identidadProducto } from '../server/lib/embudo/direccion.js';
import { extraerTextos, construirPrompt } from '../server/lib/embudo/textos.js';
const documento = { formato:'documento', secciones:[{ titulo:'Copy para landing', bloques:[
  { tipo:'subtitulo', texto:'14.4 Títulos para el hero' }, { tipo:'opcion', titulo:'Tu rutina, más simple', subtitulo:'El cuidado de cada día', etiqueta:'Recomendada' },
  { tipo:'subtitulo', texto:'14.5 Títulos para la sección de dolor' }, { tipo:'opcion', titulo:'¿Tu rutina te toma demasiado?', subtitulo:'Reconoce lo que dificulta tu día' },
  { tipo:'subtitulo', texto:'14.6 Sección de beneficios' }, { tipo:'opcion', titulo:'Lo que suma a tu rutina', subtitulo:'Beneficios del producto real' },
  { tipo:'subtitulo', texto:'14.7 Modo de uso' }, { tipo:'opcion', titulo:'Un paso a la vez', subtitulo:'Una aplicación sencilla' },
  { tipo:'subtitulo', texto:'Notas de investigación' }, { tipo:'opcion', titulo:'NO ES MODO DE USO', subtitulo:'NO DEBE COLARSE' },
]}], guia:{mensajes:[{seccion:'Hero · Producto e ingredientes',titulo:'Otra opción del hero',subtitulo:'Su propia propuesta',maqueta:{ingredientes:['Aloe de la etiqueta']}},{seccion:'Modo de uso',titulo:'Un paso a la vez',subtitulo:'Una aplicación sencilla',maqueta:{pasos:['Aplicar según etiqueta']}}]} };
let t=extraerTextos(documento,{ingredientes:'Aloe de la etiqueta',comoSeUsa:'Una aplicación documentada'});
assert.equal(t.hero.opciones.length,2); assert.equal(t.hero.opciones[0].subtitulo,'El cuidado de cada día'); assert.ok(t.hero.opciones[0].origen.includes('bloques[1]'));
assert.equal(t.uso.opciones.length,1); assert.equal(t.ingredientes.opciones.length,0); assert.ok(t.ingredientes.contenido.includes('Aloe de la etiqueta')); assert.ok(t.uso.contenido.includes('Aplicar según etiqueta'));
assert.equal(t.uso.opciones.some(x=>x.titulo==='NO ES MODO DE USO'),false);
const original=t.hero.opciones[0];
t=extraerTextos({...documento,embudo:{hero:[{titulo:original.titulo,subtitulo:original.subtitulo}],ingredientes:[{titulo:'Lo que contiene',subtitulo:'Sus componentes documentados',elementos:['Aloe']}]} });
assert.equal(t.hero.opciones.length,2); assert.equal(t.hero.opciones[0].id,original.id); assert.equal(t.ingredientes.opciones.length,1);
const prompt=construirPrompt({seccion:'ingredientes',opcion:t.ingredientes.opciones[0],contenido:['Aloe'],producto:'Serum de prueba',ficha:{queEs:'Serum',publico:'Adultos'},estilo:'Botánico',formato:'9:16',correccion:'Agranda el producto'});
assert.ok(prompt.includes('sus componentes documentados')); assert.ok(prompt.includes('Agranda el producto')); assert.ok(prompt.includes('No fixed template')); assert.doesNotMatch(prompt,/AMUA|AMUNA|90 DÍAS|4 SEMANAS/i);
assert.throws(()=>construirPrompt({seccion:'hero',opcion:{titulo:'Sin subtítulo'}}));
console.log('OK extracción literal, pares completos, todas las opciones, deduplicación, separación de secciones, ingredientes no inventados y prompt de corrección');

assert.deepEqual(textoEmbudo({titulo:'Más energía, ¡sí!',subtitulo:'FÓRMULA PARA TU DÍA'}),{titulo:'MÁS ENERGÍA, ¡SÍ!',subtitulo:'fórmula para tu día'});
assert.equal(original.titulo,'Tu rutina, más simple');
const azul=identidadProducto({color:'#2155B0'},{}),salud=identidadProducto({}, {queEs:'Suplemento para el azúcar'}),belleza=identidadProducto({}, {queEs:'Sérum facial'});
assert.notEqual(azul.fondo,'#FFFFFF');assert.notEqual(salud.fondo,belleza.fondo);assert.equal(azul.acento,'#2155B0');
assert.match(prompt,/not an empty white backdrop/);assert.match(prompt,/MEANING BEFORE DECORATION/);assert.match(prompt,/ALL UPPERCASE/);assert.match(prompt,/SUBTITLE entirely lowercase/);assert.match(prompt,/EXACT common base color/);assert.match(prompt,/LO QUE CONTIENE/);assert.doesNotMatch(prompt,/perfectly FLAT SOLID background #FFFFFF/);
console.log('OK caja del copy con acentos, fuentes intactas, paleta cromática por marca/categoría, gráficos semánticos y bordes continuos');

assert.match(identidadProducto(null,null).fondo,/^#[0-9A-F]{6}$/);

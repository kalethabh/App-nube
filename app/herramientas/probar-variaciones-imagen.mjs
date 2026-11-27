// Prueba de «QUÉ TAN DISTINTAS» en Anuncios de imagen (2026-11-26a), SIN GASTAR NADA (modo prueba, kie simulado, el
// Claude falso). Revisa:
//   - las reglas duras: un lote de 10 que repite formatos o ángulos de más FALLA; uno bien armado pasa (y con 5 y 20);
//     nativas y producto protagonista; escena/modelo/cámara sin repetir; Vecinas con la mitad del ángulo ganador;
//   - el precio con el separador de cada país y los sellos copiados exactos;
//   - el nombre de descarga y la lectura de ventas (formato + ángulo, compras, costo por compra) con ≥3 combinaciones nuevas;
//   - de punta a punta: un lote «Vecinas» de 10 con oferta y sellos: el análisis del ganador antes de las imágenes, el
//     plan que cumple, la oferta y los sellos letra por letra, el ganador solo como estilo, la nota, el orden y la
//     regeneración automática (hasta 2) de lo que no pasa la revisión; y un lote «Conceptos nuevos».
//   node app/herramientas/probar-variaciones-imagen.mjs        (PUERTO=<n>, por defecto 4493)
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = path.resolve(APP, '..');
const PUERTO = Number(process.env.PUERTO) || 4493;
const BASE = `http://127.0.0.1:${PUERTO}`;
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
let fallas = 0;
let pasan = 0;
const check = (que, ok, detalle) => {
  if (ok) pasan++;
  else fallas++;
  console.log(`${ok ? '  ok ' : '  MAL'}  ${que}${ok || detalle === undefined ? '' : `\n        ${JSON.stringify(detalle).slice(0, 900)}`}`);
  return Boolean(ok);
};
const t0 = Date.now();

// ---------------------------------------------------------------- 1. las reglas (sin la app)
const { reglasDelPlan, reglasDelAnuncio, errorDeAnalisis, cupos, nombreDeDescarga } = await import('../server/lib/imagen-ads/variedad.js');
const { leerSkill } = await import('../server/lib/imagen-ads/verificar.js');
const { normalizarOferta, formatearPrecio, separadoresMal, paisDe } = await import('../server/lib/imagen-ads/precios.js');
const { limpiarAjustes } = await import('../server/lib/imagen-ads/ajustes-producto.js');
const { leerNombre, anunciosAVentas } = await import('../server/lib/imagen-ads/ventas.js');
const { armarPlanVariado } = await import('../server/claude/pruebas/plan-variado-de-prueba.js');
const skill = leerSkill();
const formatos = [...skill.formatos.values()];
const angulos = [...skill.angulos.values()];
const analisis = { formato_ganador: 'F03', angulo_ganador: 'transformacion' };

console.log('\n  Reglas duras del plan');
const bueno = armarPlanVariado({ n: 10, nivel: 'vecinas', analisis, formatos, angulos });
check('Un plan de 10 «Vecinas» bien armado pasa', reglasDelPlan(bueno, { nivel: 'vecinas', analisis, skill }).errores.length === 0, reglasDelPlan(bueno, { nivel: 'vecinas', analisis, skill }).errores);
const todoIgual = { variaciones: bueno.variaciones.map((x) => ({ ...x, formato_id: 'F17', angulo_id: 'transformacion', mismo_formato_que_ganador: false })) };
const e1 = reglasDelPlan(todoIgual, { nivel: 'vecinas', analisis, skill }).errores;
check('Un lote de 10 con el MISMO formato en todas FALLA (cada imagen, una estructura distinta)', e1.some((e) => /estructura distinta.*V01, V02.*«F17»/.test(e)), e1);
check('…y con un solo ángulo FALLA (al menos 4 ángulos distintos)', e1.some((e) => /1 ángulos distintos; tienen que ser al menos 4/.test(e)), e1);
const tresGanador = { variaciones: bueno.variaciones.map((x, i) => (i < 3 ? { ...x, formato_id: ['F03', 'G13', 'G24'][i], mismo_formato_que_ganador: true, angulo_id: 'transformacion' } : x)) };
const e2 = reglasDelPlan(tresGanador, { nivel: 'vecinas', analisis, skill }).errores;
check('Tres con el formato del ganador (antes/después, aunque sean 3 archivos distintos) FALLA', e2.some((e) => /estructura distinta.*«antes-despues» \(el del ganador/.test(e)), e2);
const formatoTriple = { variaciones: bueno.variaciones.map((x, i) => (i >= 5 && i < 8 ? { ...x, formato_id: 'F31', mismo_formato_que_ganador: false, angulo_id: 'beneficio-principal' } : x)) };
const e3 = reglasDelPlan(formatoTriple, { nivel: 'vecinas', analisis, skill }).errores;
check('Un formato que sale 3 veces FALLA', e3.some((e) => /estructura distinta.*V06, V07, V08.*«F31»/.test(e)), e3);
const sinNativas = { variaciones: bueno.variaciones.map((x) => (skill.formatos.get(x.formato_id)?.nativo ? { ...x, formato_id: 'F02', mismo_formato_que_ganador: false } : x)) };
check('Sin formatos nativos FALLA (≥3 nativas)', reglasDelPlan(sinNativas, { nivel: 'vecinas', analisis, skill }).errores.some((e) => /con formato nativo.*al menos 3/.test(e)));
const sinProta = { variaciones: bueno.variaciones.map((x) => (skill.formatos.get(x.formato_id)?.protagonista ? { ...x, formato_id: 'F06', mismo_formato_que_ganador: false } : x)) };
check('Sin el producto protagonista FALLA (≥3)', reglasDelPlan(sinProta, { nivel: 'vecinas', analisis, skill }).errores.some((e) => /producto protagonista.*al menos 3/.test(e)));
const escenaRepetida = { variaciones: bueno.variaciones.map((x, i) => (i === 4 ? { ...x, escena: bueno.variaciones[1].escena.toUpperCase(), camara: bueno.variaciones[2].camara } : x)) };
const e4 = reglasDelPlan(escenaRepetida, { nivel: 'vecinas', analisis, skill }).errores;
check('Escena o cámara repetidas FALLAN (sin importar mayúsculas)', e4.some((e) => /V05 repite la escena de V02/.test(e)) && e4.some((e) => /V05 repite la cámara de V03/.test(e)), e4);
const sinMitad = { variaciones: bueno.variaciones.map((x, i) => (i > 0 && x.angulo_id === 'transformacion' ? { ...x, angulo_id: 'dolor' } : x)) };
check('«Vecinas» con el ángulo del ganador en menos de la mitad FALLA', reglasDelPlan(sinMitad, { nivel: 'vecinas', analisis, skill }).errores.some((e) => /la mitad usa el ángulo del ganador/.test(e)));
const unaVariable = { variaciones: bueno.variaciones.map((x, i) => (i === 0 ? { ...x, variables_cambiadas: ['contexto'] } : x)) };
check('Una variación que cambia solo 1 variable de Andromeda FALLA', reglasDelPlan(unaVariable, { nivel: 'vecinas', analisis, skill }).errores.some((e) => /V01.*al menos 2 variables/.test(e)));
const conceptos = armarPlanVariado({ n: 10, nivel: 'conceptos', analisis, formatos, angulos });
check('Un plan de 10 «Conceptos nuevos» bien armado pasa', reglasDelPlan(conceptos, { nivel: 'conceptos', analisis, skill }).errores.length === 0, reglasDelPlan(conceptos, { nivel: 'conceptos', analisis, skill }).errores);
check('…y en «Conceptos» un formato repetido FALLA', reglasDelPlan({ variaciones: conceptos.variaciones.map((x, i) => (i === 1 ? { ...x, formato_id: conceptos.variaciones[2].formato_id, mismo_formato_que_ganador: conceptos.variaciones[2].mismo_formato_que_ganador } : x)) }, { nivel: 'conceptos', analisis, skill }).errores.some((e) => /concepto de formato distinto/.test(e)));
check('Los cupos se escalan (5 y 20)', cupos(5).angulos === 2 && cupos(20).angulos === 8 && cupos(20).maxFormato === 1 && cupos(60).maxFormato === 2 && cupos(10).nativas === 3, [cupos(5), cupos(20)]);
for (const n of [5, 20]) check(`Un plan de ${n} bien armado pasa`, reglasDelPlan(armarPlanVariado({ n, nivel: 'vecinas', analisis, formatos, angulos }), { nivel: 'vecinas', analisis, skill }).errores.length === 0);
check('El análisis del ganador exige sus campos y ids reales', errorDeAnalisis({ deseo_central: 'x', nivel_conciencia: 'otro', formato_ganador: 'F99' }, skill).length >= 10);

console.log('\n  Estructuras ganadoras (Mayaverra)');
const { errorDeFicha, ESTILOS } = await import('../server/lib/imagen-ads/variedad.js');
const DIR_EST = path.join(RAIZ, '.claude', 'skills', 'anuncios-imagen-ads', 'estructuras');
const fichas = fs.readdirSync(DIR_EST).filter((n) => /^[a-z]{2}-\d{2}\.json$/.test(n));
check('Las 55 fichas de estructura son todas de Mayaverra y válidas (zonas con %, titular, dolor, segmento, oferta, estilo…)', fichas.length === 55 && fichas.every((n) => n.startsWith('mv-')) && fichas.every((n) => errorDeFicha(JSON.parse(fs.readFileSync(path.join(DIR_EST, n), 'utf8'))).length === 0), fichas.map((n) => [n, errorDeFicha(JSON.parse(fs.readFileSync(path.join(DIR_EST, n), 'utf8')))]));
const est33 = [...skill.formatos.values()].filter((f) => f.estructura);
check('F33-F87 están en el índice, todas de Mayaverra (marca y carpeta), cada una con su ficha y su estilo; de la F41 en adelante ocultas (solo al azar)', est33.map((f) => f.id).join() === Array.from({ length: 55 }, (_, i) => `F${33 + i}`).join() && est33.every((f) => f.marca === 'mayaverra' && f.referencia?.startsWith('mis_archivos/biblioteca/referencias/mayaverra/') && (Number(f.id.slice(1)) <= 40 ? !f.oculta : f.oculta === true) && ESTILOS.includes(f.estilo) && fs.existsSync(path.join(DIR_EST, path.basename(f.estructura)))));
// (2026-11-26d) la mezcla de Mayaverra y el sorteo
const { cuposDeGanchos, estructurasAlAzar, mezclaMayaverra } = await import('../server/lib/imagen-ads/estructuras.js');
const cupos8 = cuposDeGanchos(8);
check('La mezcla de Mayaverra reparte un lote de 8 en sus ganchos (más resultado y mecanismo)', Object.values(cupos8).reduce((t, x) => t + x, 0) === 8 && cupos8.resultado >= 2 && cupos8.mecanismo >= 1 && Object.keys(mezclaMayaverra().ganchos).length === 6, cupos8);
{
  const sorteo = estructurasAlAzar(8, { semilla: 'prueba-mezcla' });
  const gDe = new Map(est33.map((f) => [f.id, JSON.parse(fs.readFileSync(path.join(DIR_EST, path.basename(f.estructura)), 'utf8')).titular.gancho]));
  const cuenta = sorteo.reduce((m, id) => ({ ...m, [gDe.get(id)]: (m[gDe.get(id)] || 0) + 1 }), {});
  check('«Al azar» sortea solo de Mayaverra, con su misma mezcla de ganchos', sorteo.length === 8 && sorteo.every((id) => gDe.has(id)) && Object.entries(cupos8).every(([g, c]) => (cuenta[g] || 0) === c), { sorteo, cuenta, cupos8 });
}
// (2026-11-26e) el cuerpo de ESTE producto, los sellos sin instrucciones y las fichas revisadas
{
  const { selloLimpio, limpiarAjustes } = await import('../server/lib/imagen-ads/ajustes-producto.js');
  check('Un sello escrito como instrucción se limpia («Agregar logo y sello de registro INVIMA RSA-1» → «REGISTRO INVIMA RSA-1»); nunca logo', selloLimpio('Agregar logo y sello de registro INVIMA RSA-1') === 'REGISTRO INVIMA RSA-1' && selloLimpio('Poner el logo') === '' && selloLimpio('Pago contra entrega') === 'Pago contra entrega' && limpiarAjustes({ sellos: 'Agregar logo y sello de registro INVIMA RSA-1\nPoner el logo' }).sellos.join('|') === 'REGISTRO INVIMA RSA-1');
  check('La zona del cuerpo del producto se guarda limpia (glúteos, cola → glúteos; pies no es una zona)', JSON.stringify(limpiarAjustes({ cuerpo: { zonas: ['Glúteos', 'cola', 'piernas', 'pies'] } }).cuerpo) === JSON.stringify({ zonas: ['glúteos', 'piernas'] }));
  const { erroresCuerpoPlan, erroresCuerpoAnuncio, tieneCuerpo } = await import('../server/lib/imagen-ads/cuerpo.js');
  const ficha = (id) => JSON.parse(fs.readFileSync(path.join(DIR_EST, `${id}.json`), 'utf8'));
  check('Las fichas revisadas: mv-31 es antes/después en la misma foto; las que no muestran cuerpo no tienen zona; todas traen «traduccion»', /MISMA foto/.test(ficha('mv-31').dolor_visual.como) && !tieneCuerpo(ficha('mv-04')) && !tieneCuerpo(ficha('mv-13')) && tieneCuerpo(ficha('mv-31')) && fs.readdirSync(DIR_EST).filter((n) => /^mv-\d+\.json$/.test(n)).every((n) => String(ficha(n.slice(0, -5)).traduccion || '').length > 40));
  const briefC = { venta: { cuerpo: { zonas: ['glúteos', 'piernas'] } } };
  const conCuerpo = (extra = {}) => ({ variaciones: [{ id: 'V01', formato_id: 'F61', zona_del_cuerpo: 'piernas' }, { id: 'V02', formato_id: 'F43', zona_del_cuerpo: 'ninguna' }], ...extra });
  const cuerpoOk = { zonas: ['glúteos', 'piernas'], antes: 'glúteo plano', despues: 'glúteo redondo y levantado' };
  check('Un plan con una estructura con cuerpo y sin «cuerpo» FALLA', erroresCuerpoPlan(conCuerpo(), briefC).some((e) => /cuerpo: falta/.test(e)));
  check('…con «cuerpo» y la zona del producto pasa', erroresCuerpoPlan(conCuerpo({ cuerpo: cuerpoOk }), briefC).length === 0, erroresCuerpoPlan(conCuerpo({ cuerpo: cuerpoOk }), briefC));
  const otraZona = { cuerpo: cuerpoOk, variaciones: [{ id: 'V01', formato_id: 'F61', zona_del_cuerpo: 'pies' }] };
  check('Una variación con cuerpo en una zona que no es del producto (pies, de la referencia) FALLA', erroresCuerpoPlan(otraZona, briefC).some((e) => /no es una zona de este producto/.test(e)));
  const x = { id: 'V01', formato_id: 'F61', zona_del_cuerpo: 'piernas' };
  const malo = erroresCuerpoAnuncio({ visual_prompt: 'Home photo of two feet on a wooden floor, one swollen.' }, x, { cuerpo: cuerpoOk }, briefC);
  check('Un visual_prompt sin la zona del producto, sin el resultado y sin jean/leggins FALLA (las 3)', malo.length === 3, malo);
  const bueno = erroresCuerpoAnuncio({ visual_prompt: 'Home mirror photo from behind: left half flat glutes, right half lifted, rounder glutes after; toned legs in high-waisted leggings.' }, x, { cuerpo: cuerpoOk }, briefC);
  check('…y con glúteos/piernas, el resultado y leggins pasa', bueno.length === 0, bueno);
}
// (2026-11-26f) títulos como Mayaverra: gancho + propuesta de valor con tiempo, promesa directa
{
  const { erroresTitularesPlan, erroresPropuestaAnuncio, TIEMPO } = await import('../server/lib/imagen-ads/titulares.js');
  const { limpiarAjustes } = await import('../server/lib/imagen-ads/ajustes-producto.js');
  check('El tiempo de transformación del producto se guarda limpio', limpiarAjustes({ tiempo: '  Tratamiento de 3 meses ·  se nota desde la semana 4 ' }).tiempo === 'Tratamiento de 3 meses · se nota desde la semana 4');
  check('Se reconoce el tiempo («en solo 4 semanas», «semana 4», «tu tratamiento de 3 meses») y no un titular sin tiempo', ['Más firmes en solo 4 semanas', 'CURVAS NATURALES. SEMANA 4.', 'Tu tratamiento de 3 meses'].every((t) => TIEMPO.test(t)) && !TIEMPO.test('Glúteos más bonitos'));
  // (la fórmula del usuario: PROPUESTA DE VALOR = deseo principal + tiempo de transformación + deseo central)
  const plan = (conTiempo, tiempo = 'Tratamiento de 3 meses', deseos = true) => ({ tiempo, ...(deseos ? { deseo_principal: 'Glúteos más redondos y firmes', deseo_central: 'Volver a lucir sus jeans con seguridad' } : {}), variaciones: Array.from({ length: 4 }, (_, i) => ({ id: `V0${i + 1}`, titular: 'LEVANTA TUS GLÚTEOS', propuesta_valor: i < conTiempo ? 'Glúteos más redondos y firmes en solo 4 semanas, para volver a lucir tus jeans con seguridad' : 'Glúteos más redondos y firmes, para volver a lucir tus jeans' })) });
  check('Una variación cuya propuesta de valor no dice el tiempo FALLA', erroresTitularesPlan(plan(3), {}).some((e) => /V04\.propuesta_valor/.test(e)), erroresTitularesPlan(plan(3), {}));
  check('…sin «tiempo» del producto FALLA', erroresTitularesPlan(plan(4, ''), {}).some((e) => /plan.json → tiempo/.test(e)));
  check('…sin el deseo principal y el deseo central FALLA', erroresTitularesPlan(plan(4, 'Tratamiento de 3 meses', false), {}).filter((e) => /deseo_(principal|central)/.test(e)).length === 2);
  check('…con deseo principal + tiempo + deseo central en todas pasa (las fotos caseras y cartas, exentas)', erroresTitularesPlan(plan(4), {}).length === 0 && erroresTitularesPlan(plan(3), {}, { exenta: (x) => x.id === 'V04' }).length === 0);
  const capas = (extra) => ({ text_layers: [{ block_id: 'text_titular', reference_function: 'main headline', text: 'LEVANTA TUS GLÚTEOS' }, ...extra] });
  check('Una imagen sin capa de propuesta de valor FALLA', erroresPropuestaAnuncio(capas([]), {}).some((e) => /falta la PROPUESTA DE VALOR/.test(e)));
  check('…con su propuesta (deseo principal + tiempo + deseo central) pasa', erroresPropuestaAnuncio(capas([{ block_id: 'text_propuesta', reference_function: 'value proposition', text: 'Glúteos más redondos y firmes en solo 4 semanas, para volver a lucir tus jeans con seguridad' }]), {}).length === 0);
  check('…una propuesta sin el tiempo FALLA', erroresPropuestaAnuncio(capas([{ reference_function: 'value proposition', text: 'Glúteos más redondos y firmes para volver a lucir tus jeans con seguridad' }]), {}).some((e) => /no dice el TIEMPO/.test(e)));
  check('…una foto casera o una carta de texto no la necesitan', erroresPropuestaAnuncio(capas([]), { sinPropuesta: true }).length === 0);
  check('«Garantizado» sin garantía en el formulario FALLA (con garantía real, pasa)', erroresPropuestaAnuncio(capas([{ reference_function: 'value proposition', text: 'Resultados garantizados en solo 4 semanas para volver a lucir tus jeans con seguridad' }]), {}).some((e) => /garantizado/.test(e)) && erroresPropuestaAnuncio(capas([{ reference_function: 'value proposition', text: 'Resultados garantizados en solo 4 semanas para volver a lucir tus jeans con seguridad' }]), { venta: { sellos: ['Garantía de 30 días'] } }).length === 0);
}
// (2026-11-26g) antes/después y progreso: cada momento, otro día (pose, ropa, peinado, escenario, luz)
{
  const { erroresMomentos, textoCuerpo, textoMomentos } = await import('../server/lib/imagen-ads/cuerpo.js');
  const x = { id: 'V01', formato_id: 'F61', zona_del_cuerpo: 'glúteos' };
  const igual = erroresMomentos({ visual_prompt: 'Before and after of the same woman from behind in leggings: flat glutes before, lifted rounder glutes after.' }, x);
  check('Un antes/después sin cambiar pose, ropa, peinado, escenario ni luz FALLA', igual.some((e) => /falta que cambie/.test(e)), igual);
  const mismo = erroresMomentos({ visual_prompt: 'Before (week 1) and after (month 3), same outfit: she stands, poses, grey t-shirt, black top, jeans, leggings, hair bun, hair loose, bedroom, living room, morning light, evening light.' }, x);
  check('…con «same outfit» FALLA', mismo.some((e) => /same outfit/.test(e)), mismo);
  const bien = erroresMomentos({ visual_prompt: 'BEFORE (week 1): she stands facing the mirror with arms down, wearing a grey t-shirt and light jeans, hair in a messy bun, in her bedroom with cold morning light. AFTER (month 3): she poses turned in profile with a hand on her hip, wearing a black crop top and dark leggings, hair loose in waves, in a sunny living room with warm golden afternoon light.' }, x);
  check('…con cada momento distinto (pose, ropa, peinado, escenario y luz) pasa', bien.length === 0, bien);
  check('Una imagen sin personas ni progreso no pide nada', erroresMomentos({ visual_prompt: 'Three bottles on a marble pedestal with soft studio light.' }, { id: 'V02', formato_id: 'F43' }).length === 0);
  check('La tarea ya no pide «la misma luz» y sí pide cada momento otro día', !/misma luz|mismo encuadre y la misma/.test(textoCuerpo({})) && /OTRO DÍA/.test(textoMomentos()) && /PEINADO/.test(textoMomentos()));
}
const manualMv = fs.readFileSync(path.join(DIR_EST, 'mayaverra-manual.md'), 'utf8');
check('El manual de Mayaverra existe: lo fijo, los titulares (gancho + propuesta de valor + tiempo), cómo vende y lo que no se copia', /NUNCA cambia/.test(manualMv) && /gancho \+ propuesta de valor \+ tiempo/i.test(manualMv) && /en solo 3 semanas/i.test(manualMv) && /Cómo venden/.test(manualMv) && /NO se copia/.test(manualMv) && !/Plazos exactos de resultado como promesa/.test(manualMv));
const dosIguales = { variaciones: bueno.variaciones.map((x, i) => (i === 3 ? { ...x, formato_id: bueno.variaciones[2].formato_id, estilo: bueno.variaciones[2].estilo, mismo_formato_que_ganador: bueno.variaciones[2].mismo_formato_que_ganador } : x)) };
check('Un lote con dos imágenes de la misma estructura FALLA', reglasDelPlan(dosIguales, { nivel: 'vecinas', analisis, skill }).errores.some((e) => /estructura distinta/.test(e)));
const estiloSeguido = { variaciones: bueno.variaciones.map((x, i) => (i === 5 ? { ...x, estilo: bueno.variaciones[4].estilo } : x)) };
check('El mismo estilo dos veces seguidas FALLA', reglasDelPlan(estiloSeguido, { nivel: 'vecinas', analisis, skill }).errores.some((e) => /V05 y V06 van seguidas con el estilo/.test(e)), reglasDelPlan(estiloSeguido, { nivel: 'vecinas', analisis, skill }).errores);
const zonaSeguida = { variaciones: bueno.variaciones.map((x, i) => (i === 1 ? { ...x, zona_del_cuerpo: bueno.variaciones[0].zona_del_cuerpo, segmento: bueno.variaciones[0].segmento } : x)) };
const ez = reglasDelPlan(zonaSeguida, { nivel: 'vecinas', analisis, skill }).errores;
check('La misma zona del cuerpo o el mismo segmento dos veces seguidas FALLA', ez.some((e) => /zona del cuerpo/.test(e)) && ez.some((e) => /el segmento/.test(e)), ez);
const { construirPrompt: cp0 } = await import('../../produccion/imagen-ads.js');
const pe = cp0({ visual_prompt: 'Square ad for Aguaje Complex.', text_layers: [{ text: 'TRATAMIENTO COMPLETO X3 $139.900', reference_function: 'offer' }] }, { referencia: 'estructura' });
check('El prompt de estructura copia solo la estructura (nunca marca, texto, frasco ni personas de la referencia)', /STRUCTURE REFERENCE from another brand/.test(pe) && /Never copy its brand name, logo, product, bottle, label, wording/.test(pe) && /SECOND attached image is the real product/.test(pe) && !/keep its exact layout/.test(pe), pe.slice(0, 500));

console.log('\n  Precio por país y sellos exactos');
check('Colombia: 139900 → $139.900 (punto)', normalizarOferta('Tratamiento completo x3 $139900', 'CO') === 'Tratamiento completo x3 $139.900' && formatearPrecio(139900, 'CO') === '$139.900');
check('Colombia: 139,900 → 139.900', normalizarOferta('Hoy $139,900', 'Colombia') === 'Hoy $139.900');
check('México: 89900 → 89,900 (coma)', normalizarOferta('Solo $89900', 'MX') === 'Solo $89,900' && formatearPrecio(1299.5, 'MX') === '$1,299.50');
check('Perú, Chile, España y Estados Unidos', formatearPrecio(129, 'PE') === 'S/ 129' && formatearPrecio(29990, 'CL') === '$29.990' && formatearPrecio(1500, 'ES') === '€1.500' && formatearPrecio(2500, 'US') === '$2,500');
check('Lo que no es dinero queda igual (x3, 2x1, 60 cápsulas, un año)', normalizarOferta('2x1 en 60 cápsulas desde 2026', 'CO') === '2x1 en 60 cápsulas desde 2026');
check('El separador equivocado se detecta (para la revisión)', separadoresMal('Antes $159,900 hoy $139.900', 'CO').join() === '159,900' && separadoresMal('$139.900', 'MX').join() === '139.900');
check('El país se reconoce por nombre o código', paisDe('colombia') === 'CO' && paisDe('México') === 'MX' && paisDe('pe') === 'PE' && paisDe('Narnia') === null);
const aj = limpiarAjustes({ oferta: 'Tratamiento completo x3 139900', sellos: 'REGISTRO SANITARIO INVIMA RSA-0000000-2026\nPago contra entrega\nPago contra entrega', pais: 'Colombia', prohibido: 'cura, milagroso' });
check('Los ajustes guardan la oferta con el separador, los sellos tal cual (sin repetir) y lo prohibido', aj.oferta === 'Tratamiento completo x3 139.900' && aj.sellos.join('|') === 'REGISTRO SANITARIO INVIMA RSA-0000000-2026|Pago contra entrega' && aj.pais === 'CO' && aj.prohibido.join() === 'cura,milagroso', aj);
const venta = { oferta: 'Tratamiento completo x3 $139.900', sellos: ['REGISTRO SANITARIO INVIMA RSA-0000000-2026', 'Pago contra entrega'], prohibido: ['cura', 'milagroso'] };
const ad = (textos) => ({ text_layers: textos.map((text, i) => ({ block_id: i ? `b${i}` : 'headline', reference_function: i ? 'text' : 'main headline', text })) });
check('Con la oferta y los sellos exactos pasa', reglasDelAnuncio(ad(['Más curvas en 30 días', 'Tratamiento completo x3 $139.900', 'REGISTRO SANITARIO INVIMA RSA-0000000-2026', 'Pago contra entrega']), { venta, estricto: true }).length === 0);
const malos = reglasDelAnuncio(ad(['¿Quieres más curvas?', 'Tratamiento completo x3 $139,900', 'REGISTRO SANITARIO INVIMA', 'Pago contra entrega', 'La cura milagrosa']), { venta, estricto: true });
check('Un sello cortado, la oferta con coma, una pregunta y una palabra prohibida FALLAN', malos.some((e) => /falta la oferta/.test(e)) && malos.some((e) => /sello.*RSA-0000000-2026/.test(e)) && malos.some((e) => /pregunta/.test(e)) && malos.some((e) => /«cura»/.test(e)), malos);
check('Un titular de más de 8 palabras FALLA', reglasDelAnuncio(ad(['Por fin tienes las curvas que siempre quisiste tener tú']), { estricto: true }).some((e) => /máximo 8/.test(e)));

console.log('\n  Nombres de descarga y aprendizaje con ventas');
const nom = nombreDeDescarga({ producto: 'Producto', v: 'V03', formatoId: 'F17', anguloId: 'transformacion', skill });
check('El nombre de descarga: producto_V03-F17-ugc-selfie-transformacion.png', nom === 'producto_V03-F17-ugc-selfie-transformacion.png', nom);
check('…y el vertical lleva -9x16', nombreDeDescarga({ producto: 'Curvas Plus', v: 'V10', formatoId: 'F03', anguloId: 'beneficio-sin-sacrificio', formato: '9:16', skill }) === 'curvas-plus_V10-F03-antes-despues-beneficio-sin-sacrificio-9x16.png');
check('Se lee el nombre de un anuncio en Meta (con y sin .png)', JSON.stringify(leerNombre('curvas-plus_V03-F17-ugc-selfie-transformacion.png')) === JSON.stringify({ producto: 'curvas-plus', v: 'V03', formato_id: 'F17', angulo_id: 'transformacion' }) && leerNombre('curvas-plus_V10-F03-antes-despues-beneficio-sin-sacrificio-9x16')?.angulo_id === 'beneficio-sin-sacrificio' && leerNombre('Testimonio Yuliana UGC') === null);
const ventas = anunciosAVentas([
  { nombre: 'curvas-plus_V01-F17-ugc-selfie-transformacion.png', compras: 12, gasto: 120 },
  { nombre: 'curvas-plus_V07-F17-ugc-selfie-transformacion-9x16', compras: 8, gasto: 60 },
  { nombre: 'curvas-plus_V02-F03-antes-despues-dolor.png', compras: 3, gasto: 90 },
  { nombre: 'curvas-plus_V03-F25-meme-curiosidad.png', compras: 0, gasto: 40 },
  { nombre: 'Gancho callejero nuevo', compras: 5, gasto: 10 },
]);
const cp1 = ventas['curvas-plus'] || [];
check('Las ventas se juntan por formato + ángulo, la que más vendió primero, con su costo por compra', cp1.length === 3 && cp1[0].formato_id === 'F17' && cp1[0].compras === 20 && cp1[0].cpa === 9 && cp1[0].anuncios === 2 && cp1[2].cpa === null, cp1);
const conHist = reglasDelPlan(bueno, { nivel: 'vecinas', analisis, skill, historial: bueno.variaciones.slice(0, 9).map((x) => ({ formato_id: x.formato_id, angulo_id: x.angulo_id, compras: 1 })) }).errores;
check('Con historial, un plan que repite casi todo lo ya probado FALLA (≥3 combinaciones nuevas)', conHist.some((e) => /al menos 3 combinaciones/.test(e)), conHist);
const hist = [{ formato_id: 'F17', angulo_id: 'transformacion', compras: 20, cpa: 9 }];
const planHist = armarPlanVariado({ n: 10, nivel: 'vecinas', analisis, formatos, angulos, historial: hist });
check('Un plan que prioriza lo que vendió y prueba combinaciones nuevas pasa', reglasDelPlan(planHist, { nivel: 'vecinas', analisis, skill, historial: hist }).errores.length === 0, reglasDelPlan(planHist, { nivel: 'vecinas', analisis, skill, historial: hist }).errores);
check('Uno que no usa nada de lo que vendió FALLA', reglasDelPlan({ variaciones: planHist.variaciones.map((x) => (x.angulo_id === 'transformacion' ? { ...x, angulo_id: 'transformacion' } : x)) }, { nivel: 'vecinas', analisis, skill, historial: [{ formato_id: 'G12', angulo_id: 'regalo', compras: 5 }] }).errores.some((e) => /el formato o el ángulo que más vendió/.test(e)));

// ---------------------------------------------------------------- 2. de punta a punta (la app de prueba)
console.log('\n  De punta a punta (modo prueba, sin cobrar)');
async function pedir(ruta, o = {}) {
  const cuerpo = o.json !== undefined ? JSON.stringify(o.json) : o.cuerpo;
  const headers = { Accept: 'application/json', ...(o.json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(o.headers || {}) };
  const r = await fetch(BASE + ruta, { method: o.metodo || (cuerpo !== undefined ? 'POST' : 'GET'), headers, body: cuerpo, signal: AbortSignal.timeout(60000) });
  const tipo = r.headers.get('content-type') || '';
  return { st: r.status, datos: tipo.includes('json') ? await r.json().catch(() => null) : await r.text() };
}
async function esperar(minutos, leer, listo) {
  const hasta = Date.now() + minutos * 60000;
  let ultimo = null;
  while (Date.now() < hasta) {
    try {
      ultimo = await leer();
      if (listo(ultimo)) return ultimo;
    } catch (e) {
      ultimo = { error: e.message };
    }
    await dormir(1500);
  }
  return { ...ultimo, _seAcaboElTiempo: true };
}
const TMP = fs.mkdtempSync(path.join(RAIZ, 'temp', '_probar-variaciones-'));
const ffmpeg = (args) => cp.execFileSync('ffmpeg', ['-v', 'error', '-y', ...args]);
const FOTO = path.join(TMP, 'producto.png');
ffmpeg(['-f', 'lavfi', '-i', 'color=c=0xcc3355:s=640x640', '-frames:v', '1', FOTO]);
const GANADOR = path.join(TMP, 'ganador.png');
ffmpeg(['-f', 'lavfi', '-i', 'color=c=0x33aa77:s=1080x1080', '-frames:v', '1', GANADOR]);
const ENV = path.join(RAIZ, '.env');
const envPropio = !fs.existsSync(ENV);
if (envPropio) fs.writeFileSync(ENV, '# Lo escribió probar-variaciones-imagen.mjs: claves falsas.\nKIE_API_KEY=simulada\nELEVENLABS_API_KEY=simulada\n');
const env = { ...process.env };
for (const k of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|OPENAI_|CODEX_|FALSO_)/i.test(k)) delete env[k];
Object.assign(env, { PUERTO: String(PUERTO), ANUNCIOS_MODO_PRUEBA: '1', ANUNCIOS_PRUEBA_LIMPIO: '1', ANUNCIOS_SIN_GUARDADO: '1', ANUNCIOS_CLAUDE_BIN: path.join(APP, 'server', 'claude', 'pruebas', 'claude-falso.js'), AIA_MOTOR: 'claude', FALSO_IMAGEN_ADS: 'repetido' });
const log = fs.createWriteStream(path.join(TMP, 'app.log'));
const app = cp.spawn(process.execPath, ['server/index.js'], { cwd: APP, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
app.stdout.pipe(log);
app.stderr.pipe(log);
const creados = { producto: null, lotes: [] };

async function deUnLote(id, porImagen, { nivel, cantidad, venta }) {
  const r = await pedir('/api/imagen-ads', { json: { productoId: id, fotoProducto: 1, datos: { nombre: 'Curvas Plus', pais: 'Colombia', idioma: 'es' }, cantidad, formatos: ['1:1'], logo: null, modo: 'variantes', variacion: nivel, referenciasPropias: [1], ...(venta ? { venta } : {}) } });
  const lote = r.datos?.lote;
  if (lote) creados.lotes.push(lote);
  return { r, lote };
}

async function principal() {
  let arriba = false;
  for (let i = 0; i < 120 && !arriba; i++) {
    try {
      arriba = (await pedir('/api/estilos')).st === 200;
    } catch {
      await dormir(500);
    }
  }
  if (!check('La app de prueba arranca', arriba)) return;
  let r = await pedir('/api/productos', { json: { nombre: 'Curvas Plus', tipo: 'fisico', descripcion: 'Gotas para glúteos y curvas. Diez gotas al día.' } });
  const id = r.datos?.id;
  creados.producto = id;
  if (!check('Se crea el producto', r.st === 201 && id, r)) return;
  await pedir(`/api/productos/${id}/fotos/1`, { metodo: 'PUT', cuerpo: fs.readFileSync(FOTO), headers: { 'Content-Type': 'image/png' } });
  const op = (await pedir('/api/imagen-ads/opciones')).datos;
  const porImagen = op?.costo?.dolaresPorImagen || 0;

  // ---- «Vecinas» de 10 con la oferta y los sellos del formulario
  const venta = { oferta: 'Tratamiento completo x3 $139900', sellos: ['REGISTRO SANITARIO INVIMA RSA-0000000-2026', 'Pago contra entrega'], pais: 'CO', prohibido: ['cura', 'milagroso'] };
  const { r: r1, lote } = await deUnLote(id, porImagen, { nivel: 'vecinas', cantidad: 10, venta });
  const b = r1.datos?.brief;
  check('El lote «Vecinas» va con la estrategia de la IA (no el camino rápido) y sin copiar el diseño', r1.st === 201 && b?.variacion === 'vecinas' && b.rapido === false && b.fiel === false && !b.replicar, b);
  check('La oferta va al lote con el punto de Colombia y los sellos tal cual', b?.venta?.oferta === 'Tratamiento completo x3 $139.900' && b.venta.sellos.length === 2 && b.venta.pais === 'CO', b?.venta);
  const guardados = (await pedir(`/api/imagen-ads/ajustes/${id}`)).datos?.ajustes;
  check('Lo de venta queda guardado con el producto (para no repetirlo)', guardados?.oferta === 'Tratamiento completo x3 $139.900' && guardados.sellos[1] === 'Pago contra entrega' && guardados.prohibido.join() === 'cura,milagroso', guardados);
  await pedir(`/api/imagen-ads/${lote}/referencias/1`, { metodo: 'PUT', cuerpo: fs.readFileSync(GANADOR), headers: { 'Content-Type': 'image/png' } });
  r = await pedir(`/api/imagen-ads/${lote}/generar`, { json: { costoMaximoConfirmado: 0 } });
  check('Sin aceptar el costo no arranca', porImagen === 0 || r.st !== 200, r);
  r = await pedir(`/api/imagen-ads/${lote}/generar`, { json: { costoMaximoConfirmado: Math.round(porImagen * 10 * 100) / 100 } });
  check('Con el costo confirmado (10 imágenes, sin regeneraciones automáticas) arranca', r.st === 200, r);
  const vista = await esperar(8, async () => (await pedir(`/api/imagen-ads/${lote}`)).datos, (d) => ['listo', 'error'].includes(d?.conductor?.estado));
  if (!check('El lote termina', vista?.conductor?.estado === 'listo', { estado: vista?.conductor, tiempo: vista?._seAcaboElTiempo })) return;
  const carpeta = path.join(RAIZ, 'temp', lote);
  const an = JSON.parse(fs.readFileSync(path.join(carpeta, 'analisis.json'), 'utf8'));
  check('Antes de las variaciones, la IA analizó el ganador (analisis.json válido)', errorDeAnalisis(an, skill).length === 0, an);
  check('La pantalla muestra el análisis del ganador (esencia, invariables, hook)', vista.variacion === 'vecinas' && vista.ganador?.esencia && vista.ganador.invariables.length >= 3 && vista.ganador.hook?.porQue, vista.ganador);
  const planes = fs.readFileSync(path.join(carpeta, 'app', 'registro', 'falso-planes.log'), 'utf8').trim().split('\n');
  check('El primer plan repetía el formato: la app lo frenó y la IA lo rehízo', planes.length >= 2 && new Set(planes[0].split(' ').slice(2)).size === 1, planes);
  const plan = JSON.parse(fs.readFileSync(path.join(carpeta, 'plan.json'), 'utf8'));
  const rp = reglasDelPlan(plan, { nivel: 'vecinas', analisis: an, skill });
  check('El plan final cumple las reglas duras', rp.errores.length === 0, rp.errores);
  const vs = plan.variaciones.map((x) => ({ x, ad: JSON.parse(fs.readFileSync(path.join(carpeta, `${x.id}.json`), 'utf8')) }));
  const noNativas = vs.filter(({ x }) => !skill.formatos.get(x.formato_id)?.nativo);
  check('La oferta y los sellos van letra por letra en cada anuncio (los nativos pueden ir sin ellos)', noNativas.length > 0 && noNativas.every(({ ad }) => ad.text_layers.some((t) => t.text === 'Tratamiento completo x3 $139.900') && ad.text_layers.some((t) => t.text === 'REGISTRO SANITARIO INVIMA RSA-0000000-2026')), noNativas.map(({ ad }) => ad.text_layers.map((t) => t.text)));
  const gen = await import('../../produccion/imagen-ads.js');
  const estilo = gen.construirPrompt(vs.find(({ x }) => !x.mismo_formato_que_ganador).ad, { referencia: 'estilo' });
  check('Al modelo de imagen, el ganador va SOLO como estilo («do not copy its layout»)', /use the reference only for style, product and offer; do not copy its layout/.test(estilo) && !/keep its exact layout/.test(estilo), estilo.slice(0, 400));
  // (2026-11-27d) el diseño limpio: márgenes y letra grande siempre; la dirección limpia salvo cuando se copia una referencia
  const adLimpio = vs[0].ad;
  const copiado = gen.construirPrompt(adLimpio, { referencia: true });
  const variante = gen.construirPrompt(adLimpio, { referencia: 'variante' });
  const propio = gen.construirPrompt(adLimpio, {});
  check('(2026-11-27d) Diseño limpio: la dirección limpia (letra gruesa, barra de color, fondo claro, INVIMA grande) va en las nuevas y en las de solo estilo', [propio, estilo].every((t) => /DESIGN DIRECTION \(clean, simple, trustworthy\)/.test(t) && /white rounded badge/.test(t) && /never dark, never purple/.test(t)));
  check('…pero no cuando se copia una referencia o es una variante (manda su diseño), y la legibilidad va en todas', ![copiado, variante].some((t) => /DESIGN DIRECTION/.test(t)) && [propio, estilo, copiado, variante].every((t) => /LEGIBILITY: keep every text/.test(t)));
  check('…el vertical y el cambio de tamaño también cuidan los márgenes', /LEGIBILITY/.test(gen.construirPromptVertical(adLimpio, {})) && /LEGIBILITY/.test(gen.construirPromptCambioTamano(adLimpio, { de: '1:1', a: '4:5' })));
  const { R } = await import('../server/lib/imagen-ads/disco.js');
  const enviados = vs.map(({ x }) => ({ x, txt: fs.existsSync(R.prompt(carpeta, `${x.id}_1x1`)) ? fs.readFileSync(R.prompt(carpeta, `${x.id}_1x1`), 'utf8') : '' }));
  check('Lo que se mandó al generador: estructura en las de estructura ganadora, solo estilo en las demás, composición en las del formato del ganador', enviados.every(({ x, txt }) => (skill.formatos.get(x.formato_id)?.referencia ? /STRUCTURE REFERENCE from another brand/.test(txt) : x.mismo_formato_que_ganador ? /REFERENCE AD/.test(txt) && !/do not copy its layout/.test(txt) : /do not copy its layout/.test(txt))), enviados.map(({ x, txt }) => [x.id, x.mismo_formato_que_ganador, txt.slice(0, 120)]));
  const pedidos = fs.readdirSync(path.join(carpeta, 'app', 'imagen-ads', 'motor')).filter((n) => /^T\d+\.json$/.test(n)).flatMap((n) => JSON.parse(fs.readFileSync(path.join(carpeta, 'app', 'imagen-ads', 'motor', n), 'utf8')).piezas || []);
  const rehechas = pedidos.filter((p) => p.orden !== 'g');
  check('Nada se rehace solo: lo que no pasó queda marcado para rehacer (con tu sí)', rehechas.length === 0 && vista.variaciones.find((x) => x.v === 'V02')?.piezas['1:1']?.estado === 'te-necesita', { rehechas, v02: vista.variaciones.find((x) => x.v === 'V02')?.piezas['1:1']?.estado });
  const notas = vista.variaciones.map((x) => x.nota);
  check('Cada tarjeta trae formato, ángulo, «por qué debería vender» y su nota (1-10)', vista.variaciones.every((x) => x.formato && x.angulo && x.porQueVende && Number.isInteger(x.nota)), vista.variaciones.slice(0, 2));
  check('El lote viene ordenado de mayor a menor nota', notas.every((n, i) => i === 0 || notas[i - 1] >= n), notas);
  const v3 = vista.variaciones.find((x) => x.v === 'V03');
  const x3 = plan.variaciones.find((x) => x.id === 'V03');
  check('El nombre de descarga lleva producto, variación, formato y ángulo', v3?.piezas['1:1']?.descarga === nombreDeDescarga({ producto: 'Curvas Plus', v: 'V03', formatoId: x3.formato_id, anguloId: x3.angulo_id, skill }) && /^curvas-plus_V03-[FG]\d{2}-/.test(v3.piezas['1:1'].descarga), v3?.piezas['1:1']?.descarga);

  // ---- «Conceptos nuevos» de 5
  const { r: r2, lote: lote2 } = await deUnLote(id, porImagen, { nivel: 'conceptos', cantidad: 5 });
  check('Sin oferta en el formulario, el lote usa la guardada del producto', r2.datos?.brief?.venta?.oferta === 'Tratamiento completo x3 $139.900', r2.datos?.brief?.venta);
  await pedir(`/api/imagen-ads/${lote2}/referencias/1`, { metodo: 'PUT', cuerpo: fs.readFileSync(GANADOR), headers: { 'Content-Type': 'image/png' } });
  await pedir(`/api/imagen-ads/${lote2}/generar`, { json: { costoMaximoConfirmado: Math.round(porImagen * 5 * 100) / 100 } });
  const vista2 = await esperar(8, async () => (await pedir(`/api/imagen-ads/${lote2}`)).datos, (d) => ['listo', 'error'].includes(d?.conductor?.estado));
  const plan2 = vista2?.conductor?.estado === 'listo' ? JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', lote2, 'plan.json'), 'utf8')) : null;
  const fams = (plan2?.variaciones || []).map((x) => skill.formatos.get(x.formato_id)?.familia);
  check('«Conceptos nuevos»: termina y cada una con un concepto de formato distinto', plan2 && new Set(fams).size === 5, { estado: vista2?.conductor, fams });

  // ---- ESTRUCTURAS GANADORAS fijas (la prueba del usuario: mv-01, mv-03, mv-04 y mv-06)
  const refsMv = ['mv-01', 'mv-03', 'mv-04', 'mv-06'].map((m) => path.join(RAIZ, 'mis_archivos', 'biblioteca', 'referencias', 'mayaverra', `${m}.jpg`));
  const hayRefs = refsMv.every((r) => fs.existsSync(r));
  r = await pedir('/api/imagen-ads', { json: { productoId: id, fotoProducto: 1, datos: { nombre: 'Curvas Plus', pais: 'Colombia', idioma: 'es' }, cantidad: 4, formatos: ['1:1'], logo: null, modo: 'nuevos', estructuras: ['F33', 'F35', 'F36', 'F38'], usarInvestigacion: false } });
  const lote4 = r.datos?.lote;
  if (lote4) creados.lotes.push(lote4);
  check('Se crea un lote con 4 estructuras fijas (con la estrategia de la IA)', r.st === 201 && r.datos.brief.estructuras?.length === 4 && r.datos.brief.rapido === false, r.datos);
  const r5 = await pedir('/api/imagen-ads', { json: { productoId: id, fotoProducto: 1, datos: { nombre: 'Curvas Plus', pais: 'Colombia', idioma: 'es' }, cantidad: 3, formatos: ['1:1'], logo: null, modo: 'nuevos', estructuras: ['F33', 'F35', 'F36', 'F38'] } });
  check('Con 4 estructuras y otra cantidad, no se crea', r5.st === 400, r5);
  // (2026-11-26c) «Al azar»: la app sortea entre las de Mayaverra (también las ocultas), sin repetir ni el mismo estilo seguido
  const rAz = await pedir('/api/imagen-ads', { json: { productoId: id, fotoProducto: 1, datos: { nombre: 'Curvas Plus', pais: 'Colombia', idioma: 'es' }, cantidad: 8, formatos: ['1:1'], logo: null, modo: 'nuevos', estructuras: 'azar', usarInvestigacion: false } });
  if (rAz.datos?.lote) creados.lotes.push(rAz.datos.lote);
  const azar = rAz.datos?.brief?.estructuras || [];
  const { listaEstructuras: lE } = await import('../server/lib/imagen-ads/estructuras.js');
  const estiloDe = new Map(lE().map((x) => [x.id, x.estilo]));
  const rAz2 = await pedir('/api/imagen-ads', { json: { productoId: id, fotoProducto: 1, datos: { nombre: 'Curvas Plus', pais: 'Colombia', idioma: 'es' }, cantidad: 8, formatos: ['1:1'], logo: null, modo: 'nuevos', estructuras: 'azar', usarInvestigacion: false } });
  if (rAz2.datos?.lote) creados.lotes.push(rAz2.datos.lote);
  check('«Al azar»: 8 estructuras distintas, sin el mismo estilo seguido, y otro lote sortea otras', rAz.st === 201 && azar.length === 8 && new Set(azar).size === 8 && azar.every((f, i) => /^F\d{2}$/.test(f) && (i === 0 || estiloDe.get(f) !== estiloDe.get(azar[i - 1]))) && (rAz2.datos?.brief?.estructuras || []).join() !== azar.join(), { azar, otro: rAz2.datos?.brief?.estructuras });
  await pedir(`/api/imagen-ads/${lote4}/generar`, { json: { costoMaximoConfirmado: Math.round(porImagen * 4 * 100) / 100 } });
  const vista4 = await esperar(8, async () => (await pedir(`/api/imagen-ads/${lote4}`)).datos, (d) => ['listo', 'error'].includes(d?.conductor?.estado));
  const c4 = path.join(RAIZ, 'temp', lote4 || 'x');
  if (check('El lote de estructuras termina', vista4?.conductor?.estado === 'listo', vista4?.conductor)) {
    const plan4 = JSON.parse(fs.readFileSync(path.join(c4, 'plan.json'), 'utf8'));
    const estilos4 = plan4.variaciones.map((x) => x.estilo);
    check('El plan usa las 4 estructuras, una por imagen, sin el mismo estilo seguido', plan4.variaciones.map((x) => x.formato_id).sort().join() === 'F33,F35,F36,F38' && estilos4.every((e, i) => i === 0 || e !== estilos4[i - 1]), plan4.variaciones.map((x) => [x.formato_id, x.estilo]));
    const enviados4 = plan4.variaciones.map((x) => fs.readFileSync(R.prompt(c4, `${x.id}_1x1`), 'utf8'));
    {
      const { sesionEstrategia } = await import('../server/lib/imagen-ads/sesiones.js');
      const b4 = JSON.parse(fs.readFileSync(path.join(c4, 'app', 'brief.json'), 'utf8'));
      const sE4 = sesionEstrategia({ carpeta: c4, lote: lote4, brief: b4 });
      check('(2026-11-26f) …y los títulos como Mayaverra: gancho + propuesta de valor + tiempo, promesa agresiva', /Títulos como Mayaverra/.test(sE4.prompt) && /PROPUESTA DE VALOR/.test(sE4.prompt) && /AGRESIVA/.test(sE4.prompt) && !/sin promesas médicas ni garantías de resultados/.test(sE4.prompt));
      check('(2026-11-27d) La estrategia pide el diseño limpio y UN fondo claro para todo el lote', /## Diseño limpio/.test(sE4.prompt) && /UN solo color claro y limpio para TODO el lote/.test(sE4.prompt));
      check('(2026-11-26d) La estrategia de un lote con estructuras lleva cómo trabaja Mayaverra (lo fijo, su mezcla, sus titulares, cómo vende, lo que nunca)', /Cómo trabaja Mayaverra/.test(sE4.prompt) && /LO FIJO/.test(sE4.prompt) && /SUS TITULARES/.test(sE4.prompt) && /CÓMO VENDEN/.test(sE4.prompt) && sE4.material.aPedido.some((r) => r.endsWith('mayaverra-manual.md')));
      check('…y el lote tiene el mapa de imágenes de sus estructuras para el generador', fs.existsSync(path.join(c4, 'entrada', 'estructuras', 'mapa.json')));
      // como Mayaverra: la oferta escrita IGUAL en todo el lote
      const { verificarV } = await import('../server/lib/imagen-ads/verificar.js');
      const conOferta = ['V01', 'V02', 'V03', 'V04'].filter((v) => (JSON.parse(fs.readFileSync(path.join(c4, `${v}.json`), 'utf8')).text_layers || []).some((t) => /offer|oferta/i.test(`${t.reference_function} ${t.block_id || ''}`)));
      if (conOferta.length >= 2) {
        const ultima = conOferta[conOferta.length - 1];
        const archivo = path.join(c4, `${ultima}.json`);
        const antes = fs.readFileSync(archivo, 'utf8');
        const d = JSON.parse(antes);
        d.text_layers = d.text_layers.map((t) => (/offer|oferta/i.test(`${t.reference_function} ${t.block_id || ''}`) ? { ...t, text: 'OTRA OFERTA DISTINTA 50 %' } : t));
        fs.writeFileSync(archivo, JSON.stringify(d, null, 2));
        const r = verificarV(c4, ultima, { brief: b4 });
        fs.writeFileSync(archivo, antes);
        check('Una imagen con la oferta escrita distinto al resto del lote FALLA (el kit fijo de Mayaverra)', r.errores.some((e) => /oferta tiene que ir escrita IGUAL|falta la oferta del formulario letra por letra/.test(e)), r.errores);
      } else check('(el lote de prueba trae la oferta en al menos 2 imágenes)', false, conOferta);
      // (2026-11-26e) una foto casera (nativa) va con titular corto y la franja de sellos
      {
        const planF = path.join(c4, 'plan.json');
        const vF = path.join(c4, 'V01.json');
        const [planAntes, vAntes] = [fs.readFileSync(planF, 'utf8'), fs.readFileSync(vF, 'utf8')];
        const pl = JSON.parse(planAntes);
        pl.variaciones[0] = { ...pl.variaciones[0], formato_id: 'F53', zona_del_cuerpo: 'glúteos' };
        fs.writeFileSync(planF, JSON.stringify(pl, null, 2));
        const d = JSON.parse(vAntes);
        d.text_layers = (d.text_layers || []).filter((t) => /offer|oferta|seal|sello/i.test(`${t.reference_function} ${t.block_id || ''}`));
        fs.writeFileSync(vF, JSON.stringify(d, null, 2));
        const r = verificarV(c4, 'V01', { brief: b4 });
        fs.writeFileSync(planF, planAntes);
        fs.writeFileSync(vF, vAntes);
        check('Una foto casera (nativa) sin titular FALLA: lleva titular corto y la franja de sellos', r.errores.some((e) => /foto casera lleva un titular corto/.test(e)), r.errores);
        check('…y con cuerpo, sin glúteos/resultado/jean en el visual_prompt también FALLA', r.errores.some((e) => /visual_prompt: tiene que (mostrar|verse)/.test(e)) || /glute/.test(d.visual_prompt || ''), r.errores);
      }
    }
    check('A cada imagen le llegó su estructura como guía (solo estructura) y el frasco como segunda imagen', enviados4.every((t) => /STRUCTURE REFERENCE from another brand/.test(t)));
    if (hayRefs) {
      check('Se arman los 4 montajes lado a lado en comparacion/', ['V01', 'V02', 'V03', 'V04'].every((v) => fs.existsSync(path.join(c4, 'comparacion', `${v}.jpg`))), fs.existsSync(path.join(c4, 'comparacion')) ? fs.readdirSync(path.join(c4, 'comparacion')) : null);
      const inf = fs.existsSync(path.join(c4, 'comparacion', 'informe.md')) ? fs.readFileSync(path.join(c4, 'comparacion', 'informe.md'), 'utf8') : '';
      check('El informe trae los 7 puntajes de cada una: pasan las de 8 o más y V02/V03 quedan para rehacer (Texto limpio)', /\| V01 \|.*PASA/.test(inf) && /\| V02 \|.*REHACER \(Texto limpio\)/.test(inf) && /\| V03 \|.*REHACER/.test(inf) && /Prompt corregido propuesto/.test(inf), inf.slice(0, 900));
      const vc = (await pedir(`/api/imagen-ads/${lote4}`)).datos?.comparacion;
      const m1 = vc?.piezas?.find((x) => x.v === 'V01');
      const img1 = m1?.montaje ? await fetch(BASE + m1.montaje) : null;
      check('La pantalla del lote recibe la comparación: montaje, 7 puntajes, PASA / PARA REHACER con su corrección', vc?.piezas?.length === 4 && vc.criterios.length === 7 && m1?.pasa === true && img1?.status === 200 && vc.piezas.find((x) => x.v === 'V02')?.pasa === false && vc.piezas.find((x) => x.v === 'V02')?.correccion && vc.piezas.find((x) => x.v === 'V02')?.puedeRehacer, vc);
      const le = (await pedir('/api/imagen-ads/estructuras')).datos?.estructuras || [];
      const imgE = await fetch(`${BASE}/api/imagen-ads/estructuras/F35/imagen`);
      check('La lista de estructuras (55 de Mayaverra: 8 a la vista y 47 solo al azar) y la imagen de cada una', le.length === 55 && le.filter((x) => x.oculta).length === 47 && le.every((x) => x.marca === 'mayaverra') && le.every((x) => x.hay) && imgE.status === 200 && /image\/jpeg/.test(imgE.headers.get('content-type') || ''), le.map((x) => `${x.id}:${x.hay}`));
      const v02 = vista4.variaciones.find((x) => x.v === 'V02')?.piezas['1:1'];
      check('V02 queda marcada (te necesita) con el criterio que falló, sin rehacerse sola', v02?.estado === 'te-necesita' && v02.problemas.some((t) => /Texto limpio \(5\)/.test(t)), v02);
      const ctx = cp.spawnSync(process.execPath, [path.join(RAIZ, 'produccion', 'rehacer-toma.js'), `temp/${lote4}`, '--pieza', 'V02_1x1', '--contexto'], { cwd: RAIZ, env: { ...env, PUERTO: String(PUERTO) }, encoding: 'utf8' });
      check('npm run rehacer --contexto muestra los puntajes, la corrección y el costo', ctx.status === 0 && /texto_limpio 5/.test(ctx.stdout) && /Corrección propuesta/.test(ctx.stdout) && /cuesta/.test(ctx.stdout), ctx.stdout + ctx.stderr);
      const nuevoJson = path.join(TMP, 'nuevo.json');
      fs.writeFileSync(nuevoJson, JSON.stringify({ visual_prompt: 'Prompt corregido de prueba.' }));
      const antes = fs.readFileSync(path.join(c4, 'V02.json'), 'utf8');
      const plan1 = cp.spawnSync(process.execPath, [path.join(RAIZ, 'produccion', 'rehacer-toma.js'), `temp/${lote4}`, '--pieza', 'V02_1x1', '--aplicar', nuevoJson, '--solo-plan'], { cwd: RAIZ, env: { ...env, PUERTO: String(PUERTO) }, encoding: 'utf8' });
      check('--solo-plan muestra el prompt nuevo y el costo sin tocar nada', plan1.status === 0 && /Prompt corregido de prueba/.test(plan1.stdout) && /No se pidió nada/.test(plan1.stdout) && fs.readFileSync(path.join(c4, 'V02.json'), 'utf8') === antes, plan1.stdout + plan1.stderr);
      const si = cp.spawnSync(process.execPath, [path.join(RAIZ, 'produccion', 'rehacer-toma.js'), `temp/${lote4}`, '--pieza', 'V02_1x1', '--aplicar', nuevoJson, '--si'], { cwd: RAIZ, env: { ...env, PUERTO: String(PUERTO) }, encoding: 'utf8' });
      const v4b = await esperar(4, async () => (await pedir(`/api/imagen-ads/${lote4}`)).datos, (d) => d?.conductor?.estado === 'listo' && (d.variaciones.find((x) => x.v === 'V02')?.piezas['1:1']?.version || 0) >= 2);
      check('Con --si aplica el prompt aprobado y la app la rehace (versión 2)', si.status === 0 && JSON.parse(fs.readFileSync(path.join(c4, 'V02.json'), 'utf8')).visual_prompt === 'Prompt corregido de prueba.' && (v4b?.variaciones?.find((x) => x.v === 'V02')?.piezas['1:1']?.version || 0) >= 2, si.stdout + si.stderr);
    } else check('(las referencias de Mayaverra no están en mis_archivos/biblioteca/referencias/mayaverra: sin montajes)', true);
  }

  // ---- «Fieles» sigue siendo el camino de replicar (con el análisis antes)
  const { r: r3, lote: lote3 } = await deUnLote(id, porImagen, { nivel: 'fieles', cantidad: 2 });
  check('«Fieles» es el camino de «Replicar validado» (rápido, copia el diseño)', r3.datos?.brief?.replicar === true && r3.datos.brief.rapido === true && r3.datos.brief.fiel === true, r3.datos?.brief);
  await pedir(`/api/imagen-ads/${lote3}/referencias/1`, { metodo: 'PUT', cuerpo: fs.readFileSync(GANADOR), headers: { 'Content-Type': 'image/png' } });
  await pedir(`/api/imagen-ads/${lote3}/generar`, { json: { costoMaximoConfirmado: Math.round(porImagen * 2 * 100) / 100 } });
  const vista3 = await esperar(6, async () => (await pedir(`/api/imagen-ads/${lote3}`)).datos, (d) => ['listo', 'error'].includes(d?.conductor?.estado));
  check('«Fieles» termina con su análisis y su mapa', vista3?.conductor?.estado === 'listo' && fs.existsSync(path.join(RAIZ, 'temp', lote3, 'analisis.json')) && fs.existsSync(path.join(RAIZ, 'temp', lote3, 'entrada', 'mapa-R01.json')), vista3?.conductor);
}

try {
  await principal();
} catch (e) {
  check('La prueba no se cae', false, String(e?.stack || e));
} finally {
  try {
    process.kill(-app.pid, 'SIGTERM');
    await dormir(1500);
    process.kill(-app.pid, 'SIGKILL');
  } catch {
    /* ya cerró */
  }
  for (const l of creados.lotes) if (l) fs.rmSync(path.join(RAIZ, 'temp', l), { recursive: true, force: true });
  if (creados.producto) fs.rmSync(path.join(RAIZ, 'temp', '_productos', creados.producto), { recursive: true, force: true });
  fs.rmSync(path.join(RAIZ, 'temp', `_modo-prueba-${PUERTO}`), { recursive: true, force: true });
  if (envPropio) fs.rmSync(ENV, { force: true });
  if (fallas) console.log(`\n  Registro de la app: ${path.join(TMP, 'app.log')}`);
  else fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n  ${pasan} bien, ${fallas} mal · ${Math.round((Date.now() - t0) / 1000)} s\n`);
  process.exit(fallas ? 1 : 0);
}

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
check('Un lote de 10 con el MISMO formato en todas FALLA (máximo 2 por formato)', e1.some((e) => /F17.*sale 10 veces.*máximo 2/.test(e)), e1);
check('…y con un solo ángulo FALLA (al menos 4 ángulos distintos)', e1.some((e) => /1 ángulos distintos; tienen que ser al menos 4/.test(e)), e1);
const tresGanador = { variaciones: bueno.variaciones.map((x, i) => (i < 3 ? { ...x, formato_id: ['F03', 'G13', 'G24'][i], mismo_formato_que_ganador: true, angulo_id: 'transformacion' } : x)) };
const e2 = reglasDelPlan(tresGanador, { nivel: 'vecinas', analisis, skill }).errores;
check('Tres con el formato del ganador (antes/después, aunque sean 3 archivos distintos) FALLA', e2.some((e) => /antes-despues.*el del ganador.*máximo 2/.test(e)), e2);
const formatoTriple = { variaciones: bueno.variaciones.map((x, i) => (i >= 5 && i < 8 ? { ...x, formato_id: 'F31', mismo_formato_que_ganador: false, angulo_id: 'beneficio-principal' } : x)) };
const e3 = reglasDelPlan(formatoTriple, { nivel: 'vecinas', analisis, skill }).errores;
check('Un formato que sale 3 veces FALLA', e3.some((e) => /«F31» sale 3 veces/.test(e)), e3);
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
check('Los cupos se escalan (5 y 20)', cupos(5).angulos === 2 && cupos(20).angulos === 8 && cupos(20).maxFormato === 4 && cupos(10).nativas === 3, [cupos(5), cupos(20)]);
for (const n of [5, 20]) check(`Un plan de ${n} bien armado pasa`, reglasDelPlan(armarPlanVariado({ n, nivel: 'vecinas', analisis, formatos, angulos }), { nivel: 'vecinas', analisis, skill }).errores.length === 0);
check('El análisis del ganador exige sus campos y ids reales', errorDeAnalisis({ deseo_central: 'x', nivel_conciencia: 'otro', formato_ganador: 'F99' }, skill).length >= 10);

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
  check('Sin aceptar el costo máximo (que incluye las 2 regeneraciones) no arranca', porImagen === 0 || r.st !== 200, r);
  r = await pedir(`/api/imagen-ads/${lote}/generar`, { json: { costoMaximoConfirmado: Math.round(porImagen * 10 * 3 * 100) / 100 } });
  check('Con el costo máximo confirmado (10 imágenes + 2 regeneraciones cada una) arranca', r.st === 200, r);
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
  const { R } = await import('../server/lib/imagen-ads/disco.js');
  const enviados = vs.map(({ x }) => ({ x, txt: fs.existsSync(R.prompt(carpeta, `${x.id}_1x1`)) ? fs.readFileSync(R.prompt(carpeta, `${x.id}_1x1`), 'utf8') : '' }));
  check('Lo que se mandó al generador: solo estilo en las de otro formato y composición en las del formato del ganador', enviados.every(({ x, txt }) => (x.mismo_formato_que_ganador ? /REFERENCE AD/.test(txt) && !/do not copy its layout/.test(txt) : /do not copy its layout/.test(txt))), enviados.map(({ x, txt }) => [x.id, x.mismo_formato_que_ganador, txt.slice(0, 120)]));
  const pedidos = fs.readdirSync(path.join(carpeta, 'app', 'imagen-ads', 'motor')).filter((n) => /^T\d+\.json$/.test(n)).flatMap((n) => JSON.parse(fs.readFileSync(path.join(carpeta, 'app', 'imagen-ads', 'motor', n), 'utf8')).piezas || []);
  const rehechas = pedidos.filter((p) => /^rev\d$/.test(p.orden));
  check('Lo que no pasó la revisión se rehízo solo, hasta 2 veces (V02 y V03: rev1 y rev2)', rehechas.filter((p) => p.pieza === 'V02_1x1').length === 2 && rehechas.filter((p) => p.pieza === 'V03_1x1').length === 2 && rehechas.every((p) => p.correccion_en), rehechas);
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
  await pedir(`/api/imagen-ads/${lote2}/generar`, { json: { costoMaximoConfirmado: Math.round(porImagen * 5 * 3 * 100) / 100 } });
  const vista2 = await esperar(8, async () => (await pedir(`/api/imagen-ads/${lote2}`)).datos, (d) => ['listo', 'error'].includes(d?.conductor?.estado));
  const plan2 = vista2?.conductor?.estado === 'listo' ? JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', lote2, 'plan.json'), 'utf8')) : null;
  const fams = (plan2?.variaciones || []).map((x) => skill.formatos.get(x.formato_id)?.familia);
  check('«Conceptos nuevos»: termina y cada una con un concepto de formato distinto', plan2 && new Set(fams).size === 5, { estado: vista2?.conductor, fams });

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

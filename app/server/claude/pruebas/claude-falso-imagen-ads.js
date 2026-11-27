// Un "claude" falso para las 4 tareas de los ANUNCIOS DE IMAGEN (imagen-ads-estrategia, -prompts, -revision, -ajuste):
// imita la salida stream-json de Claude Code y escribe archivos que pasan lo que revisa la app (lib/imagen-ads/
// verificar.js), armados con indice.json, angulos.json y el brief del lote (textos «Texto de prueba N»). Nunca llama a nadie.
//   FALSO_IMAGEN_ADS=ok (por defecto) | mal (la primera vez deja un archivo incompleto; lo arregla cuando la app le pide
//                    corregir) | bloqueo (la estrategia escribe bloqueo.json y responde BLOQUEADO) | limite | muere
//   FALSO_IMAGEN_ADS_FALLAN=V01_1x1,V02_9x16   la revision marca mal esas piezas (siempre)
//   FALSO_PAUSA=ms   entre eventos (para ver la frase de avance o probar Detener)
//   FALSO_REGISTRO=<archivo>   anota cada sesion (inicio y fin), para contar cuantas hubo a la vez
// (Lo lanza claude-falso.js, que reparte cada tarea a su falso: ANUNCIOS_CLAUDE_BIN apunta siempre a claude-falso.js.)
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { armarPlanVariado } from './plan-variado-de-prueba.js';
import { leerPropias } from '../../lib/imagen-ads/propias-disco.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const SKILL = path.join(RAIZ, '.claude', 'skills', 'anuncios-imagen-ads');
const args = process.argv.slice(2);
const val = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : null;
};
if (args[0] === '--version') {
  console.log('2.1.288 (Claude Code)');
  process.exit(0);
}
if (args[0] === 'auth' && args[1] === 'status') {
  console.log(JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', subscriptionType: 'max', email: 'alumno@ejemplo.com' }));
  process.exit(0);
}

const sesion = val('--resume') || val('--session-id') || '00000000-0000-0000-0000-000000000000';
const pausa = Number(process.env.FALSO_PAUSA) || 3;
const modo = process.env.FALSO_IMAGEN_ADS || 'ok';
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const emitir = (o) => process.stdout.write(JSON.stringify({ session_id: sesion, ...o }) + '\n');
let id = 0;
const usar = async (name, input) => {
  const tid = `toolu_${++id}`;
  emitir({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: tid, name, input }] } });
  await dormir(pausa);
  emitir({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: tid, content: 'ok' }] } });
};
const anotar = (s) => {
  if (process.env.FALSO_REGISTRO) fs.appendFileSync(process.env.FALSO_REGISTRO, `${new Date().toISOString()} ${process.pid} ${s}\n`);
};
const leer = (abs) => {
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch {
    return null;
  }
};
async function escribir(rel, datos) {
  const abs = path.join(RAIZ, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, typeof datos === 'string' ? datos : JSON.stringify(datos, null, 2) + '\n', 'utf8');
  await usar('Write', { file_path: abs, content: '…' });
}
const idsDe = (texto) => [...new Set((String(texto).match(/V\d{2,3}/g) || []))];

// ---------------------------------------------------------------- lo que se escribe

function catalogo() {
  // (2026-11-26d) más las estructuras del usuario (P##), como leerSkill de la app
  return { angulos: leer(path.join(SKILL, 'angulos.json'))?.angulos || [], formatos: [...(leer(path.join(SKILL, 'formatos', 'indice.json'))?.formatos || []), ...leerPropias().map((x) => ({ ...x, marca: 'propia' }))] };
}

/** (2026-11-26e) La zona del producto con su resultado y la ropa, como pide la verificación. */
const EN = { 'glúteos': 'glutes', piernas: 'legs', caderas: 'hips', cintura: 'waist', abdomen: 'belly', brazos: 'arms', cara: 'face', piel: 'skin', cabello: 'hair', busto: 'bust' };
const cuerpoDe = (entrada) => (entrada?.zona_del_cuerpo && EN[entrada.zona_del_cuerpo] ? ` The woman shows the RESULT on her ${EN[entrada.zona_del_cuerpo]}: lifted, rounder and toned after, wearing high-waisted jeans. BEFORE (week 1): she stands facing the mirror with arms down, wearing a grey t-shirt and light jeans, hair in a messy bun, in her bedroom with cold morning light. AFTER (month 3): she poses turned in profile with a hand on her hip, wearing a black crop top and dark leggings, hair loose in waves, in a sunny living room with warm golden afternoon light.` : '');

/** Un V##.json valido para la app, con los bloques de su formato (asi no hay avisos). */
function anuncio(v, entrada, brief, numero) {
  const formato = entrada?.formato_id ? catalogo().formatos.find((f) => f.id === entrada.formato_id) : null;
  const f = formato?.archivo ? leer(path.join(SKILL, formato.archivo)) : null;
  const bloques = (f?.detected_visual_blocks || [{ block_id: 'block_01', block_type: 'product' }]).map((b) => ({
    block_id: b.block_id,
    block_type: String(b.block_type || 'product').replace(/\s*\(OPTIONAL\)/g, ''),
    position: b.position || 'center',
    visual_function: b.visual_function || 'Shows the product',
    adaptation_rule: 'Adapted to the product of this test.',
    present_in_reference: true,
  }));
  const variado = brief?.modo === 'variantes' && ['vecinas', 'conceptos'].includes(brief?.variacion);
  let beneficios = 0;
  const base = (f?.text_layers || [{ block_id: 'text_block_01', reference_function: 'main headline' }]).filter((t) => !variado || !/benefit|beneficio|bullet|check/i.test(`${t.block_id || ''} ${t.reference_function || ''}`) || ++beneficios <= 4);
  const capas = base.map((t, i) => ({
    block_id: t.block_id,
    reference_function: String(t.reference_function || 'main headline').replace(/\s*\(OPTIONAL\)/g, ''),
    reference_position: t.reference_position || 'top center',
    text_style: 'Bold sans-serif, high contrast',
    // el titular elegido por el usuario (si lo hay) va completo en la primera capa, como pide la verificación
    text: i === 0 && brief?.seleccionTitulos?.titulos?.length && entrada?.titular ? entrada.titular : `Texto de prueba ${numero}.${i + 1}`,
  }));
  // («Vecinas»/«Conceptos»: la oferta y los sellos del formulario, letra por letra, salvo en los formatos nativos)
  // (2026-11-26d) con estructuras ganadoras, como Mayaverra: la misma oferta, igual en todas las del lote
  const conEstructuras = Array.isArray(brief?.estructuras) && brief.estructuras.length > 0;
  // (2026-11-26f) títulos como Mayaverra: la propuesta de valor con tiempo debajo del gancho (no en nativas ni cartas)
  if ((variado || conEstructuras) && !formato?.nativo && formato?.estilo !== 'carta-de-texto') capas.splice(1, 0, { block_id: 'text_propuesta', reference_function: 'value proposition', reference_position: 'below headline', text_style: 'Bold', text: entrada?.propuesta_valor || 'Glúteos más redondos y firmes en solo 4 semanas, para volver a lucir tus jeans con seguridad' });
  // (2026-11-26e) las nativas: sin la oferta, pero con titular corto y la franja de sellos
  if (variado || conEstructuras) {
    const oferta = formato?.nativo ? '' : brief?.venta?.oferta || (conEstructuras ? 'TRATAMIENTO COMPLETO X3 $139.900' : '');
    if (oferta) capas.push({ block_id: 'text_oferta', reference_function: 'offer', reference_position: 'bottom strip', text_style: 'Bold', text: oferta });
    for (const [k, sello] of (brief?.venta?.sellos || []).entries()) capas.push({ block_id: `text_sello_${k + 1}`, reference_function: 'trust seal', reference_position: 'bottom corner', text_style: 'Small caps', text: sello });
  }
  return {
    prompt_type: 'ad_creative_generation',
    ad_info: { variation_id: v, structure_source: entrada?.fuente === 'referencia' ? 'uploaded reference' : `library format ${entrada?.formato_id || 'F01'}`, reference_style: 'premium product ad', angle_used: entrada?.angulo || 'Beneficio', ad_format: 'Product Hero Ad', platform_goal: 'High-CTR Facebook/Instagram/TikTok image ad' },
    technical_specs: { dimensions: '1080x1080 px', aspect_ratio: '1:1 Square', output_goal: 'High-conversion premium e-commerce image ad' },
    global_identity: { color_palette: 'Deep navy #1E3A8A with warm cream #F5E9D7 accents', visual_style: 'Clean premium studio', visual_atmosphere: 'Calm and confident', graphic_language: 'Soft shadows, rounded shapes', text_typography: 'Poppins Bold for headlines, Poppins Regular for the rest' },
    creative_objective: 'Test ad for the app (fake Claude).',
    art_direction: { design_quality: 'Premium', visual_hierarchy: 'Headline, product, details', composition_style: 'Centered', spacing_and_structure: 'Generous margins', lighting_and_depth: 'Soft studio light', conversion_feel: 'Persuasive' },
    reference_structure_analysis: { layout_summary: 'Headline on top, product in the center.', detected_visual_blocks: bloques, forbidden_additions: ['Price badges', 'Rating stars'] },
    visual_prompt: `Square premium product advertisement for a test product (${brief?.datos?.nombre || 'test product'}). The attached product photo is the only source of truth for the product: keep its exact shape, label, colors and proportions, never redesign it. Headline at the top center in bold sans-serif, the product large in the center on a deep navy seamless backdrop with soft studio light and a gentle shadow. Variation ${v}.${process.env.HUMO_POLITICA === '1' && v === 'V02' ? ' SIM-PROHIBIDO' : ''} Top zone (20% of the canvas): the headline in heavy condensed sans, all caps, white #FFFFFF with a thin navy #1E3A8A outline, centered. Center zone (55%): the product photographed straight on at eye level with a 50 mm lens, soft key light from the upper left, a warm rim light, realistic glass reflections and a crisp readable label. Bottom zone (25%): a cream #F5E9D7 strip with the offer and the trust seals in small caps, generous margins.${cuerpoDe(entrada)}`,
    text_layers: capas,
    mandatory_visual_elements: ['The product, exactly as in the attached photo'],
    final_generation_exclusions: ['Do not add any visual module that is not described in this prompt.', 'Do not add any text that is not listed in the EXACT VISIBLE TEXT section.'],
    meta_policy_check: 'All visible text has been sanitized for Facebook/Instagram Ads compliance.',
    language_rule: `All visible text inside the generated image must be written in ${brief?.datos?.idioma === 'en' ? 'English' : brief?.datos?.idioma === 'pt' ? 'Portuguese' : 'Spanish'}.`,
  };
}

function elPlan(lote, brief) {
  const { angulos, formatos } = catalogo();
  const n = Number(brief.cantidad) || 1;
  const todas = brief.referencias || [];
  const refs = brief.fiel && todas.length ? Array.from({ length: n }, (_, i) => todas[i % todas.length]) : todas.slice(0, n);
  const elegidos = brief.seleccionTitulos?.titulos || [];
  const variaciones = [];
  for (let i = 0; i < n; i++) {
    const v = `V${String(i + 1).padStart(2, '0')}`;
    const a = angulos[i % angulos.length] || { id: 'dolor', nombre: 'Dolor / problema' };
    const base = { id: v, angulo_id: a.id, angulo: a.nombre, concepto: `Concepto de prueba ${i + 1}`, titular: elegidos[i]?.titulo || `Titular de prueba ${i + 1}`, escena: `Escena de prueba ${i + 1}`, camara: 'Plano medio frontal' };
    if (i < refs.length) variaciones.push({ ...base, fuente: 'referencia', referencia: refs[i], analisis_referencia: { formato: 'referencia', estructura: 'titular arriba', por_que_funciona: 'claro' } });
    else {
      const f = formatos[i % formatos.length] || { id: 'F01', nombre: 'Producto protagonista' };
      variaciones.push({ ...base, fuente: 'biblioteca', formato_id: f.id, formato: f.nombre });
    }
  }
  return { producto: brief.datos?.nombre || 'producto', lote, cantidad: n, proporciones: brief.formatos || ['1:1'], variaciones };
}

async function estrategia(texto, intento) {
  const lote = texto.match(/Carpeta del lote: temp\/(\S+)/)[1];
  const C = `temp/${lote}`;
  const brief = leer(path.join(RAIZ, C, 'app', 'brief.json'));
  await usar('Read', { file_path: path.join(SKILL, 'SKILL.md') });
  await usar('Read', { file_path: path.join(SKILL, 'angulos.json') });
  await usar('Read', { file_path: path.join(SKILL, 'formatos', 'indice.json') });
  const foto = fs.readdirSync(path.join(RAIZ, C, 'entrada')).find((n) => /^producto\./.test(n));
  if (foto) await usar('Read', { file_path: path.join(RAIZ, C, 'entrada', foto) });
  if (modo === 'bloqueo') {
    await escribir(`${C}/app/imagen-ads/bloqueo.json`, { motivo: 'No sé qué vende tu producto y la skill no lo puede inventar.', faltan: ['Qué es el producto'] });
    return 'BLOQUEADO';
  }
  const ids = idsDe((texto.match(/el PASO 5 de ([^.\n]+)\./) || [])[1] || 'V01');
  await escribir(`${C}/producto.json`, {
    slug: lote,
    nombre: brief.datos?.nombre || 'Producto',
    analisis: 'Análisis de prueba.',
    tipo_producto: 'otro',
    descripcion_visual_en: 'A small orange jar with a dark lid and a cream label.',
    foto_producto: `${C}/entrada/${foto || 'producto.png'}`,
    datos: { angulo_preferido: brief.datos?.angulo || '', publico: brief.datos?.publico || '', precio: brief.datos?.precio || '', moneda: brief.datos?.moneda || '', cta: brief.datos?.cta || '', pais: brief.datos?.pais || '', idioma: brief.datos?.idioma || 'es', adicional: '' },
    identidad_visual: { color_palette: 'Navy and cream', visual_style: 'Premium studio', visual_atmosphere: 'Calm', graphic_language: 'Soft shapes', text_typography: 'Poppins', art_direction: 'Centered product' },
    beneficios: ['Beneficio 1', 'Beneficio 2', 'Beneficio 3', 'Beneficio 4'],
    caracteristicas: ['Característica 1', 'Característica 2', 'Característica 3', 'Característica 4'],
  });
  const est = {
    resumen: 'Una marca de prueba, sobria y confiable (la escribió el Claude falso).',
    paleta: [
      { hex: '#1E3A8A', nombre: 'Azul noche' },
      { hex: '#F5E9D7', nombre: 'Crema' },
      { hex: '#E8743B', nombre: 'Naranja' },
    ],
    tipografia: 'Poppins Bold para títulos y Poppins Regular para el resto',
    estilo: 'Estudio limpio con el producto al centro',
    beneficios: ['Beneficio 1', 'Beneficio 2', 'Beneficio 3', 'Beneficio 4'],
    caracteristicas: ['Característica 1', 'Característica 2', 'Característica 3', 'Característica 4'],
  };
  if (modo === 'mal' && intento === 1) delete est.paleta;
  await escribir(`${C}/estrategia.json`, est);
  const plan = elPlan(lote, brief);
  // (2026-11-20) el agente de variaciones: su análisis del ganador y el nivel, el cambio y la hipótesis de cada una
  if (/## Agente de variaciones creativas/.test(texto)) {
    const reparto = (texto.match(/reparte las \d+ variaciones así: (\d+) de nivel A [^,]*, (\d+) de nivel B .*? y (\d+) de nivel C/) || []).slice(1).map(Number);
    const desdeInvestigacion = /DESDE LA INVESTIGACIÓN/.test(texto);
    const niveles = [...Array(reparto[0] || 0).fill('A'), ...Array(reparto[1] || 0).fill('B'), ...Array(reparto[2] || 0).fill('C')];
    const refs = (brief.referencias || []).map((_, i) => `R${String(i + 1).padStart(2, '0')}`);
    if (desdeInvestigacion)
      await escribir(`${C}/analisis-ganador.json`, {
        referencias: [],
        angulo_central: { deseo: 'Verse bien sin esfuerzo (de la investigación)', problema: 'No tiene tiempo', beneficio: 'Resultado visible', beneficios_secundarios: ['Fácil de usar'], promesa: 'Lucir mejor', emocion: 'Confianza', conciencia: 'Consciente del problema', mecanismo: 'Ritual diario' },
        invariables: ['El deseo central', 'El producto real'],
        modificables: ['El titular', 'El contexto'],
        experimentales: ['La objeción de precio'],
        facetas: ['La que trabaja y no tiene tiempo', 'La que se prepara para una ocasión'],
        objeciones: ['¿Funciona de verdad?'],
        resumen: 'El ritual diario para verse bien (análisis de prueba desde la investigación).',
      });
    else await escribir(`${C}/analisis-ganador.json`, {
      resumen: 'El deseo de verse bien sin esfuerzo (análisis de prueba).',
      facetas: ['La que trabaja y no tiene tiempo', 'La que se prepara para una ocasión', 'La que desconfía de comprar por internet'],
      referencias: refs.map((ref) => ({ ref, angulo: { deseo: 'Verse bien sin esfuerzo', problema: 'No tiene tiempo', beneficio: 'Resultado visible', beneficios_secundarios: ['Fácil de usar'], promesa: 'Lucir mejor', emocion: 'Confianza', conciencia: 'Consciente del problema', mecanismo: 'Antes y después' }, estructura: 'Titular arriba, la persona y el producto al centro, la oferta abajo.', primeros_segundos: 'Se ve el resultado y el producto.', invariables: ['El deseo de verse bien', 'El producto al centro'], modificables: ['El titular', 'El encuadre'], experimentales: ['El contexto'] })),
    });
    plan.variaciones = plan.variaciones.map((x, i) => ({ ...x, nivel: niveles[i] || 'A', variables: niveles[i] === 'A' ? ['ejecucion'] : ['faceta', 'contexto'], faceta: 'La que trabaja y no tiene tiempo', contexto: 'En su rutina', formato_creativo: 'Imagen estilo UGC', cambio: `Cambio de prueba ${i + 1}`, hipotesis: `Hipótesis de prueba ${i + 1}` }));
  }
  // (2026-11-26a) «Vecinas» / «Conceptos nuevos»: un plan que cumple las reglas duras (FALSO_IMAGEN_ADS=repetido: la
  // primera vez repite el mismo formato en todas, para ver que la app lo frena y pide rehacerlo)
  if (/## Qué tan distintas/.test(texto)) {
    const analisis = leer(path.join(RAIZ, C, 'analisis.json'));
    const { formatos, angulos } = catalogo();
    const nivel = brief.variacion === 'conceptos' ? 'conceptos' : 'vecinas';
    plan.variaciones = armarPlanVariado({ n: plan.cantidad, nivel, analisis, formatos, angulos, historial: brief.historial || [] }).variaciones;
    if (modo === 'repetido' && intento === 1) plan.variaciones = plan.variaciones.map((x) => ({ ...x, formato_id: plan.variaciones[0].formato_id, angulo_id: plan.variaciones[0].angulo_id }));
    fs.mkdirSync(path.join(RAIZ, C, 'app', 'registro'), { recursive: true });
    fs.appendFileSync(path.join(RAIZ, C, 'app', 'registro', 'falso-planes.log'), `intento ${intento}: ${plan.variaciones.map((x) => `${x.formato_id}/${x.angulo_id}`).join(' ')}\n`);
  }
  // (2026-11-26b) estructuras fijas: una por variación, ordenadas para que el estilo no se repita seguido
  if (Array.isArray(brief.estructuras) && brief.estructuras.length) {
    const { formatos, angulos } = catalogo();
    const pend = brief.estructuras.map((id) => formatos.find((f) => f.id === id)).filter(Boolean);
    const orden = [];
    while (pend.length) {
      // (el estilo que más queda primero, sin repetir el de recién: así nunca quedan dos iguales al final)
      const cuenta = (e) => pend.filter((f) => f.estilo === e).length;
      const libres = pend.map((f, i) => [f, i]).filter(([f]) => f.estilo !== orden[orden.length - 1]?.estilo).sort((a, b) => cuenta(b[0].estilo) - cuenta(a[0].estilo));
      const k = libres.length ? libres[0][1] : 0;
      orden.push(pend.splice(k, 1)[0]);
    }
    const zonas = ['glúteos', 'caderas', 'cintura', 'piernas'];
    const segmentos = ['mujeres 25-45', 'mamás después del embarazo', 'mujeres de gym', 'mujeres 40+'];
    plan.variaciones = plan.variaciones.map((x, i) => {
      const f = orden[i % orden.length];
      const a = angulos.find((y) => y.id === f.angulos_compatibles[0]) || angulos[0];
      return { ...x, fuente: 'biblioteca', formato_id: f.id, formato: f.nombre, angulo_id: a.id, angulo: a.nombre, estilo: f.estilo, zona_del_cuerpo: zonas[i % 4], segmento: segmentos[i % 4] };
    });
  }
  // (2026-11-26e) el cuerpo de ESTE producto: sus zonas (las del formulario o glúteos y piernas), alternadas
  const zonasProducto = brief?.venta?.cuerpo?.zonas?.length ? brief.venta.cuerpo.zonas : ['glúteos', 'piernas'];
  plan.cuerpo = { zonas: zonasProducto, antes: 'Glúteo plano y caído; el jean sobra atrás.', despues: 'Glúteo redondo y levantado que llena el jean; piernas torneadas.' };
  plan.tiempo = brief?.venta?.tiempo || 'Tratamiento de 3 meses · se nota desde la semana 4';
  plan.variaciones = (plan.variaciones || []).map((x, i) => ({ ...x, zona_del_cuerpo: zonasProducto[i % zonasProducto.length], propuesta_valor: x.propuesta_valor || `Glúteos más redondos y firmes en solo ${i + 3} semanas, para volver a lucir tus jeans con seguridad` }));
  plan.deseo_principal = 'Glúteos más redondos, firmes y levantados';
  plan.deseo_central = 'Volver a lucir sus jeans con seguridad';
  await escribir(`${C}/plan.json`, plan);
  for (const v of ids) await escribir(`${C}/${v}.json`, anuncio(v, plan.variaciones.find((x) => x.id === v), brief, Number(v.slice(1))));
  return 'LISTO';
}

async function prompts(texto, intento) {
  const lote = texto.match(/Carpeta del lote: temp\/(\S+)/)[1];
  const C = `temp/${lote}`;
  const brief = leer(path.join(RAIZ, C, 'app', 'brief.json'));
  const plan = leer(path.join(RAIZ, C, 'plan.json'));
  await usar('Read', { file_path: path.join(SKILL, 'SKILL.md') });
  const ids = idsDe((texto.match(/Haz solo el PASO 5 de: ([^.\n]+)\./) || [])[1] || '');
  for (const v of ids) {
    const ad = anuncio(v, plan?.variaciones?.find((x) => x.id === v), brief, Number(v.slice(1)));
    if (modo === 'mal' && intento === 1 && v === ids[0]) ad.visual_prompt = 'corto';
    await escribir(`${C}/${v}.json`, ad);
  }
  return 'LISTO';
}

/** (2026-11-26i) «Más imágenes»: las entradas del plan de las V nuevas (con las estructuras sorteadas, si las hay). */
async function mas(texto) {
  const lote = texto.match(/Carpeta del lote: temp\/(\S+)/)[1];
  const C = `temp/${lote}`;
  const salida = (texto.match(/escribe SOLO `(temp\/\S+\/app\/imagen-ads\/mas\/M\d{2}\.json)`/) || [])[1];
  const ids = idsDe((texto.match(/DISTINTOS de los que ya tiene[^:]*: ([^.\n]+)\./) || [])[1] || '');
  const plan = leer(path.join(RAIZ, C, 'plan.json'));
  await usar('Read', { file_path: path.join(RAIZ, C, 'plan.json') });
  const { angulos, formatos } = catalogo();
  const usados = new Set((plan?.variaciones || []).map((x) => x.formato_id));
  const sorteadas = [...texto.matchAll(/^- ([FP]\d{2,3}) · /gm)].map((m) => m[1]);
  let lista = sorteadas.length ? sorteadas.map((id) => formatos.find((f) => f.id === id)).filter(Boolean) : formatos.filter((f) => !usados.has(f.id) && !f.estructura).slice(0, ids.length);
  // el estilo rota (contando la última del lote)
  const ultimo = plan?.variaciones?.[plan.variaciones.length - 1]?.estilo || null;
  const orden = [];
  while (lista.length) {
    const antes = orden.length ? orden[orden.length - 1].estilo : ultimo;
    const cuenta = (e) => lista.filter((f) => f.estilo === e).length;
    const libres = lista.filter((f) => !f.estilo || f.estilo !== antes).sort((a, b) => cuenta(b.estilo) - cuenta(a.estilo));
    const f = libres[0] || lista[0];
    orden.push(f);
    lista = lista.filter((y) => y !== f);
  }
  const zonas = plan?.cuerpo?.zonas?.length ? plan.cuerpo.zonas : ['glúteos', 'piernas'];
  const variaciones = ids.map((v, i) => {
    const f = orden[i] || formatos[i];
    const a = angulos.find((y) => y.id === f?.angulos_compatibles?.[0]) || angulos[i % angulos.length];
    return { id: v, fuente: 'biblioteca', formato_id: f.id, formato: f.nombre, angulo_id: a.id, angulo: a.nombre, concepto: `Concepto nuevo de prueba ${v}`, titular: `Titular nuevo de prueba ${v}`, escena: `Escena nueva de prueba ${v}`, camara: 'Plano medio frontal', ...(f.estilo ? { estilo: f.estilo } : {}), zona_del_cuerpo: zonas[i % zonas.length], segmento: 'mujeres 25-45', propuesta_valor: `Glúteos más redondos y firmes en solo ${i + 4} semanas, para volver a lucir tus jeans con seguridad` };
  });
  await escribir(salida, { variaciones });
  return 'LISTO';
}

async function revision(texto) {
  const lote = texto.match(/Carpeta del lote: temp\/(\S+)/)[1];
  const archivo = texto.match(/Escribe `(temp\/\S+\/revision\/R\d{3}\.json)`/)[1];
  const fallan = new Set(String(process.env.FALSO_IMAGEN_ADS_FALLAN || '').split(',').map((s) => s.trim()).filter(Boolean));
  const revisadas = [];
  for (const l of texto.split('\n')) {
    const m = l.match(/^- (V\d{2,3}_(?:1x1|9x16)) \(/);
    if (!m) continue;
    for (const r of l.match(/temp\/\S+?\.(?:png|jpg)/g) || []) await usar('Read', { file_path: path.join(RAIZ, r) });
    const mal = fallan.has(m[1]);
    revisadas.push({
      pieza: m[1],
      ok: !mal,
      ...(/agrega también `"nota"`/.test(texto) ? { nota: mal ? 4 : 10 - (Number(m[1].slice(1, 3)) % 4) } : {}),
      problemas: mal ? ['(Claude falso) el titular tiene una letra cambiada'] : [],
      ...(mal ? { correccion_en: '(fake Claude) Write the headline exactly as written in the text list.' } : {}),
    });
  }
  await escribir(archivo, { revisadas });
  return lote ? 'LISTO' : 'LISTO';
}

async function ajuste(texto) {
  const lote = texto.match(/Carpeta del lote: temp\/(\S+)/)[1];
  const C = `temp/${lote}`;
  const archivo = texto.match(/Escribe `(temp\/\S+\/ajustes\/A\d{3}\.json)`/)[1];
  const pedidos = [];
  for (const l of texto.split('\n')) {
    const m = l.match(/^- (U\d{4}) · (V\d{2,3})_(?:1x1|9x16) \([^)]*\): «(.*)»/);
    if (!m) continue;
    const [, u, v, instr] = m;
    const vista = l.match(/vista (temp\/\S+\.jpg)/);
    if (vista) await usar('Read', { file_path: path.join(RAIZ, vista[1]) });
    await usar('Read', { file_path: path.join(RAIZ, C, `${v}.json`) });
    if (/precio/i.test(instr)) {
      pedidos.push({ id: u, aplicado: false, motivo: 'Ese formato no tiene lugar para el precio.' });
      continue;
    }
    const cambiaTextos = /texto|titular|dice/i.test(instr);
    if (cambiaTextos) {
      const ad = leer(path.join(RAIZ, C, `${v}.json`));
      if (ad?.text_layers?.[0]) {
        ad.text_layers[0].text = `${ad.text_layers[0].text} (cambiado)`;
        await escribir(`${C}/${v}.json`, ad);
      }
    }
    // (2026-11-26h) con imágenes adjuntas: las mira y dice cómo usarlas (llegan como 3.ª, 4.ª…)
    const adjuntas = [...l.matchAll(/(temp\/\S+\/entrada\/adjuntos\/A\d{4}\.(?:png|jpg))/g)].map((x) => x[1]);
    for (const a of adjuntas) await usar('Read', { file_path: path.join(RAIZ, a) });
    const conAdjuntas = adjuntas.length ? ` Use the THIRD attached image as the reference the user attached.` : '';
    pedidos.push({ id: u, aplicado: true, cambia_textos: cambiaTextos, instruccion_en: `Apply this change and keep everything else: ${instr.slice(0, 200)}${conAdjuntas}`, resumen: `Hice lo que pediste: ${instr.slice(0, 80)}` });
  }
  await escribir(archivo, { pedidos });
  return 'LISTO';
}

// ---------------------------------------------------------------- la sesion

let intento = 0;
let textoTarea = '';
async function alMensaje(texto) {
  intento++;
  if (!textoTarea) textoTarea = texto;
  const tarea = (textoTarea.match(/^TAREA: (\S+)/m) || [])[1] || '';
  emitir({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: String(val('--tools') || '').split(',').filter(Boolean), model: 'claude-falso', permissionMode: val('--permission-mode'), apiKeySource: 'none', claude_code_version: '2.1.288', mcp_servers: [] });
  anotar(`inicio ${tarea} ${sesion} intento ${intento}`);
  await dormir(pausa);
  if (modo === 'limite') {
    emitir({ type: 'rate_limit_event', rate_limit_info: { status: 'rejected', resetsAt: Math.floor(Date.now() / 1000) + 3600, rateLimitType: 'five_hour' } });
    anotar(`fin ${tarea} ${sesion} limite`);
    return emitir({ type: 'result', subtype: 'success', is_error: true, result: "You've hit your session limit · resets 3pm", num_turns: 1 });
  }
  if (modo === 'muere') {
    anotar(`fin ${tarea} ${sesion} muere`);
    process.stderr.write('algo se rompio adentro\n');
    process.exit(1);
  }
  let r = 'LISTO';
  try {
    if (tarea === 'imagen-ads-estrategia') r = await estrategia(textoTarea, intento);
    else if (tarea === 'imagen-ads-prompts') r = await prompts(textoTarea, intento);
    else if (tarea === 'imagen-ads-revision') r = await revision(textoTarea);
    else if (tarea === 'imagen-ads-mas') r = await mas(textoTarea);
    else if (tarea === 'imagen-ads-ajuste') r = await ajuste(textoTarea);
  } catch (e) {
    anotar(`fin ${tarea} ${sesion} error ${e.message}`);
    return emitir({ type: 'result', subtype: 'error_during_execution', is_error: true, result: `Claude falso: ${e.message}`, num_turns: 1 });
  }
  anotar(`fin ${tarea} ${sesion} ${r}`);
  emitir({ type: 'result', subtype: 'success', is_error: false, result: r, num_turns: 4, total_cost_usd: 0.1, duration_ms: 100, usage: { input_tokens: 10, output_tokens: 10 }, permission_denials: [] });
}

const rl = readline.createInterface({ input: process.stdin });
let cola = Promise.resolve();
rl.on('line', (linea) => {
  let ev;
  try {
    ev = JSON.parse(linea);
  } catch {
    return;
  }
  if (ev.type !== 'user') return;
  const c = ev.message?.content;
  const texto = typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x?.text || '').join('\n') : '';
  cola = cola.then(() => alMensaje(texto));
});
rl.on('close', () => cola.then(() => process.exit(0)));

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
  return { angulos: leer(path.join(SKILL, 'angulos.json'))?.angulos || [], formatos: leer(path.join(SKILL, 'formatos', 'indice.json'))?.formatos || [] };
}

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
  const capas = (f?.text_layers || [{ block_id: 'text_block_01', reference_function: 'main headline' }]).map((t, i) => ({
    block_id: t.block_id,
    reference_function: String(t.reference_function || 'main headline').replace(/\s*\(OPTIONAL\)/g, ''),
    reference_position: t.reference_position || 'top center',
    text_style: 'Bold sans-serif, high contrast',
    // el titular elegido por el usuario (si lo hay) va completo en la primera capa, como pide la verificación
    text: i === 0 && brief?.seleccionTitulos?.titulos?.length && entrada?.titular ? entrada.titular : `Texto de prueba ${numero}.${i + 1}`,
  }));
  return {
    prompt_type: 'ad_creative_generation',
    ad_info: { variation_id: v, structure_source: entrada?.fuente === 'referencia' ? 'uploaded reference' : `library format ${entrada?.formato_id || 'F01'}`, reference_style: 'premium product ad', angle_used: entrada?.angulo || 'Beneficio', ad_format: 'Product Hero Ad', platform_goal: 'High-CTR Facebook/Instagram/TikTok image ad' },
    technical_specs: { dimensions: '1080x1080 px', aspect_ratio: '1:1 Square', output_goal: 'High-conversion premium e-commerce image ad' },
    global_identity: { color_palette: 'Deep navy #1E3A8A with warm cream #F5E9D7 accents', visual_style: 'Clean premium studio', visual_atmosphere: 'Calm and confident', graphic_language: 'Soft shadows, rounded shapes', text_typography: 'Poppins Bold for headlines, Poppins Regular for the rest' },
    creative_objective: 'Test ad for the app (fake Claude).',
    art_direction: { design_quality: 'Premium', visual_hierarchy: 'Headline, product, details', composition_style: 'Centered', spacing_and_structure: 'Generous margins', lighting_and_depth: 'Soft studio light', conversion_feel: 'Persuasive' },
    reference_structure_analysis: { layout_summary: 'Headline on top, product in the center.', detected_visual_blocks: bloques, forbidden_additions: ['Price badges', 'Rating stars'] },
    visual_prompt: `Square premium product advertisement for a test product (${brief?.datos?.nombre || 'test product'}). The attached product photo is the only source of truth for the product: keep its exact shape, label, colors and proportions, never redesign it. Headline at the top center in bold sans-serif, the product large in the center on a deep navy seamless backdrop with soft studio light and a gentle shadow. Variation ${v}.`,
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
    pedidos.push({ id: u, aplicado: true, cambia_textos: cambiaTextos, instruccion_en: `Apply this change and keep everything else: ${instr.slice(0, 200)}`, resumen: `Hice lo que pediste: ${instr.slice(0, 80)}` });
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

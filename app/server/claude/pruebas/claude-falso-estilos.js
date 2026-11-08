// Un "claude" falso para probar la FASE DE GUION de los 12 estilos (y la continuidad) sin gastar nada.
// Es la misma idea que app/server/claude/pruebas/claude-falso.js (solo claymation), ampliada: toma como base el
// manifiesto de una carpeta de muestra de cada estilo, y en los cantados escribe letras.json o la peticion de la
// historia. Anota cada mensaje que recibe (FALSO_PROMPTS=carpeta) y los argumentos (FALSO_ARGS=archivo).
//   FALSO_MODO=ok | mal (la primera vez deja algo mal; con la correccion lo arregla)
// (Lo lanza claude-falso.js, que reparte cada tarea a su falso: ANUNCIOS_CLAUDE_BIN apunta siempre a claude-falso.js.)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..'); // la raiz del proyecto
const args = process.argv.slice(2);
const val = (flag) => {
  const i = args.indexOf(flag);
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
if (process.env.FALSO_ARGS) fs.appendFileSync(process.env.FALSO_ARGS, JSON.stringify({ sesion, args, cwd: process.cwd() }) + '\n');

const emitir = (o) => process.stdout.write(JSON.stringify({ session_id: sesion, ...o }) + '\n');
let id = 0;
const usar = async (name, input) => {
  const tid = `toolu_${++id}`;
  emitir({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: tid, name, input }] } });
  emitir({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: tid, content: 'ok' }] } });
};
const leer = (rel) => JSON.parse(fs.readFileSync(path.join(RAIZ, rel), 'utf8'));
const escribir = (rel, datos) => {
  const abs = path.join(RAIZ, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, typeof datos === 'string' ? datos : JSON.stringify(datos, null, 2) + '\n', 'utf8');
};

const MUESTRA = {
  'anuncios-claymation': 'befen-regulador-apetito',
  'anuncios-crochet': 'befen-regulador-apetito', // la muestra de crochet es de un formato viejo: va la de claymation con estilo crochet
  'anuncios-zack-d-films': 'goli-immune-gummies',
  'anuncios-estilo-pixar': 'anuncios-con-ia-pixar',
  'anuncios-skeleton-ads': 'zenme-triptofano',
  'anuncios-estilo-lego': 'lymphatic-drainage-lego-2',
  'anuncios-talking-object-pixar': 'superhuman-drenaje-linfatico',
  'anuncios-ugc': 'befem-ugc-bloques',
  'anuncios-podcast': 'cayenne-pepper-podcast',
  'anuncios-entrevista': 'befem-entrevista-a',
};

function briefDe(texto) {
  const m = texto.match(/## BRIEF\s+```json\s+([\s\S]*?)```/);
  try {
    return m ? JSON.parse(m[1]) : {};
  } catch {
    return {};
  }
}

function manifiestoDe(muestra, slug, brief) {
  const m = leer(`temp/${muestra}/manifiesto.json`);
  delete m.continuidad;
  if (brief.estilo && brief.estilo !== m.estilo) m.estilo = brief.estilo;
  const foto = fs.readdirSync(path.join(RAIZ, 'temp', slug)).find((n) => /^producto\.(jpg|jpeg|png|webp)$/i.test(n));
  // las referencias con archivo de la muestra (lugares, capturas) se copian; la del producto apunta a la foto real
  for (const r of m.referencias || []) {
    if (r.tipo === 'producto') continue;
    if (r.archivo && fs.existsSync(path.join(RAIZ, 'temp', muestra, r.archivo))) fs.copyFileSync(path.join(RAIZ, 'temp', muestra, r.archivo), path.join(RAIZ, 'temp', slug, r.archivo));
  }
  let ref = (m.referencias || []).find((r) => r.tipo === 'producto');
  if (foto) {
    if (!ref) {
      ref = { id: 'producto', tipo: 'producto', archivo: foto, nota: 'la foto real del producto' };
      (m.referencias ||= []).push(ref);
    }
    ref.archivo = foto;
  } else if (ref) {
    m.referencias = m.referencias.filter((r) => r.tipo !== 'producto');
    for (const t of [...(m.tomas || []), ...(m.broll || []), ...(m.ganchos_alternativos || [])]) {
      t.referencias = (t.referencias || []).filter((x) => x !== ref.id);
      if (Array.isArray(t.ingredientes)) t.ingredientes = t.ingredientes.filter((x) => x !== 'producto');
    }
  }
  const a = brief.ajustes_del_estilo || {};
  if (m.estilo === 'podcast' && m.podcast?.broll) m.podcast.broll.modo = /esquina/i.test(a.modo || '') ? 'esquina' : 'pantalla-dividida';
  return m;
}

async function guion(texto, modo, intento) {
  const slug = texto.match(/Carpeta del anuncio: temp\/(\S+)/)?.[1];
  const skill = texto.match(/\.claude\/skills\/([a-z-]+)\/SKILL\.md/)?.[1];
  const brief = briefDe(texto);
  await usar('Read', { file_path: path.join(RAIZ, '.claude', 'skills', skill, 'SKILL.md') });
  const mal = modo === 'mal' && intento === 1;

  if (skill === 'anuncios-musicales') {
    const p = leer('temp/kovacol-drenaje-linfatico/cancion/peticion.json');
    const a = brief.ajustes_del_estilo || {};
    const visual = /clay/i.test(a.visual) ? 'claymation' : /zack/i.test(a.visual) ? 'zack-d-films' : 'crochet';
    const vocal = /femen/i.test(a.canta || '') ? 'f' : /mascul/i.test(a.canta || '') ? 'm' : null;
    const sacar = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
    const letras = {
      titulo: 'Zeta: no son tus piernas',
      idioma: 'es',
      mercado: 'LatAm',
      angulo: 'Lo que hinchaba tus piernas no era tu culpa',
      etapa: 'Consciente del problema',
      visual,
      vocalGender: vocal,
      opciones: [
        { n: 1, titulo: p.titulo, concepto: 'Una canción tierna que le quita la culpa a quien se mira al espejo.', letra: mal ? sacar(p.letra) : p.letra, estiloSuno: p.estilo, ideaVisual: 'Una mujer tejida se mira en un espejo de lana; sus piernas se desinflan como globos de hilo.' },
        { n: 2, titulo: 'Suelta lo que pesa', concepto: 'Más alegre, con un coro para cantar.', letra: p.letra.replace('No son tus piernas', 'Suelta lo que pesa'), estiloSuno: 'latin pop, bright female vocals, 100 BPM, playful', ideaVisual: 'Un desfile de mini prendas tejidas que se aflojan al ritmo del coro.' },
      ],
      decisiones: ['Elegí el ángulo de quitar la culpa porque la ficha habla de piernas hinchadas al final del día.'],
    };
    escribir(`temp/${slug}/app/letras.json`, letras);
    await usar('Write', { file_path: path.join(RAIZ, 'temp', slug, 'app', 'letras.json') });
    return 'LISTO';
  }

  if (skill === 'anuncios-historias-musicales') {
    const p = leer('temp/goli-immune-historia-musical/cancion/peticion.json');
    const pet = { letra: p.letra, estilos: p.estilos, titulo: p.titulo, duracion: null, vocalGender: /mascul/i.test(brief.ajustes_del_estilo?.canta || '') ? 'm' : 'f', modelo: 'V5_5', idioma: 'spa' };
    escribir(`temp/${slug}/cancion/peticion.json`, pet);
    await usar('Write', { file_path: path.join(RAIZ, 'temp', slug, 'cancion', 'peticion.json') });
    const ACTOS = ['Acto 1 · Dolor', 'Acto 2 · Quiebre', 'Acto 3 · Solución', 'Acto 4 · Transformación', 'Acto 5 · Cierre'];
    let acto = -1;
    const partes = [];
    for (const l of p.letra.split(/\r?\n/)) {
      if (/^\s*\[.*\]\s*$/.test(l)) {
        acto++;
        continue;
      }
      if (!l.trim()) continue;
      partes.push({ n: partes.length + 1, momento: ACTOS[Math.max(0, acto)], dice: l.trim(), se_ve: 'Una escena 3D cálida de la historia' });
    }
    if (mal) partes.pop();
    escribir(`temp/${slug}/app/guion.json`, { titulo: 'Zeta: ese lunes', idioma: 'es', mercado: 'LatAm', duracionEstimada: 300, de_que_va: 'Una mamá que se enfermaba cada mes cuenta cómo salió.', personajes: [{ nombre: 'Laura', como_es: 'quien cuenta: mamá de 38' }], partes, decisiones: ['Elegí un cierre cantado.'] });
    await usar('Write', { file_path: path.join(RAIZ, 'temp', slug, 'app', 'guion.json') });
    return 'LISTO';
  }

  let muestra = MUESTRA[skill];
  const a = brief.ajustes_del_estilo || {};
  if (skill === 'anuncios-entrevista' && /^\s*b|completa/i.test(a.variante || '')) muestra = 'befem-entrevista-b';
  const man = manifiestoDe(muestra, slug, brief);
  if (skill === 'anuncios-entrevista' && man.entrevista) man.entrevista.lado_mic = /derech/i.test(a.lado || '') ? 'derecha' : 'izquierda';
  escribir(`temp/${slug}/manifiesto.json`, man);
  await usar('Write', { file_path: path.join(RAIZ, 'temp', slug, 'manifiesto.json'), content: '{…}' });
  const conTransiciones = /escribe `temp\/[^`]+\/transiciones\.json`/.test(texto);
  if (conTransiciones) {
    const ruta = path.join(RAIZ, 'temp', muestra, 'transiciones.json');
    const t = fs.existsSync(ruta) ? JSON.parse(fs.readFileSync(ruta, 'utf8')) : { efectos: { woosh: 'efectos/woosh.mp3', 'deep-woosh': 'efectos/deep-woosh.mp3' }, puntos: [{ toma: 2, animacion: 'deslizar-derecha', efecto: 'woosh', porque: 'problema' }] };
    delete t._nota;
    t.puntos = t.puntos.filter((x) => man.tomas.some((y) => y.n === x.toma));
    escribir(`temp/${slug}/transiciones.json`, t);
    await usar('Write', { file_path: path.join(RAIZ, 'temp', slug, 'transiciones.json') });
  }
  await usar('PowerShell', { command: `node produccion/validar-manifiesto.js temp/${slug}/manifiesto.json` });

  let g;
  const base = { titulo: `Zeta (${man.estilo})`, idioma: 'es', mercado: 'LatAm', duracionEstimada: 40, de_que_va: 'Prueba de la fase de guion.', decisiones: ['Elegí el ángulo principal de la skill.'] };
  if (man.estilo === 'podcast') {
    g = { ...base, personajes: [{ id: 'A', nombre: 'Carla', como_es: 'anfitriona de 30' }, { id: 'B', nombre: 'Tomás', como_es: 'anfitrión de 35' }], partes: man.guion.map((l) => ({ n: l.orden, quien: l.habla === 'A' ? 'Carla' : 'Tomás', dice: l.texto, se_ve: 'Los dos en el estudio' })) };
  } else if (man.estilo === 'entrevista') {
    g = { ...base, variante: man.entrevista?.variante, personajes: [{ nombre: 'Rosa', como_es: 'mujer de 35, mamá que corre' }], partes: man.tomas.map((t) => ({ n: t.n, momento: t.fase, dice: t.linea, dialogo: (t.dialogo || []).map((d) => ({ quien: d.habla === 'entrevistador' ? 'Entrevistador' : 'Rosa', dice: d.texto })), se_ve: 'Rosa en la calle' })) };
  } else {
    g = { ...base, partes: man.tomas.filter((t) => String(t.linea || '').trim()).map((t, i) => ({ n: t.n, momento: i === 0 ? 'gancho' : 'historia', dice: t.linea, se_ve: 'Una escena', ...(man.estilo === 'talking-object-pixar' ? { quien: `Personaje ${t.n}` } : {}) })) };
    if (man.estilo === 'ugc') g.extras = { ganchos: (man.ganchos_alternativos || []).map((x) => ({ id: x.id, idea: `arranque ${x.id}`, dice: x.linea })) };
    if (man.estilo === 'ugc') g.personajes = [{ nombre: 'Vale', como_es: 'mujer de 30 en su oficina' }];
  }
  if (mal) delete g.partes[0].dice;
  escribir(`temp/${slug}/app/guion.json`, g);
  await usar('Write', { file_path: path.join(RAIZ, 'temp', slug, 'app', 'guion.json') });
  return 'LISTO';
}

async function cambios(texto) {
  const slug = texto.match(/Carpeta del anuncio: temp\/(\S+)/)?.[1];
  const pedido = texto.match(/«([\s\S]*?)»/)?.[1] || '';
  const dir = path.join(RAIZ, 'temp', slug);
  if (texto.includes('skills/anuncios-musicales/')) {
    const l = leer(`temp/${slug}/app/letras.json`);
    l.opciones[1].titulo = `${l.opciones[1].titulo} (cambiada)`;
    l.cambios_hechos = [`Opción 2: ${pedido.slice(0, 60)}`];
    escribir(`temp/${slug}/app/letras.json`, l);
    await usar('Write', { file_path: path.join(dir, 'app', 'letras.json') });
    return 'LISTO';
  }
  if (fs.existsSync(path.join(dir, 'manifiesto.json'))) {
    const man = leer(`temp/${slug}/manifiesto.json`);
    man.tomas[0].prompt_video = `${man.tomas[0].prompt_video}\nKeep the camera still.`;
    escribir(`temp/${slug}/manifiesto.json`, man);
    await usar('Edit', { file_path: path.join(dir, 'manifiesto.json') });
  }
  const g = leer(`temp/${slug}/app/guion.json`);
  g.cambios_hechos = [`Hice lo que pediste: ${pedido.slice(0, 80)}`];
  escribir(`temp/${slug}/app/guion.json`, g);
  await usar('Write', { file_path: path.join(dir, 'app', 'guion.json') });
  return 'LISTO';
}

const tareaDe = (t) => (/TAREA: guion/.test(t) ? 'guion' : /TAREA: cambios/.test(t) ? 'cambios' : 'otra');
let tarea = null;
let textoTarea = '';
let intento = 0;
let n = 0;
async function alMensaje(texto) {
  intento++;
  if (process.env.FALSO_PROMPTS) {
    fs.mkdirSync(process.env.FALSO_PROMPTS, { recursive: true });
    fs.writeFileSync(path.join(process.env.FALSO_PROMPTS, `${sesion}-${val('--resume') ? 'resume' : 'nueva'}-${++n}.txt`), texto, 'utf8');
  }
  if (!tarea) {
    tarea = tareaDe(texto);
    textoTarea = texto;
  }
  emitir({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: String(val('--tools') || '').split(',').filter(Boolean), model: 'claude-falso', permissionMode: val('--permission-mode'), apiKeySource: 'none', claude_code_version: '2.1.288', mcp_servers: [] });
  let r = 'LISTO';
  if (tarea === 'guion') r = await guion(textoTarea, process.env.FALSO_MODO || 'ok', intento);
  else if (tarea === 'cambios') r = await cambios(textoTarea);
  emitir({ type: 'result', subtype: 'success', is_error: false, result: r, num_turns: 4, total_cost_usd: 0, duration_ms: 50, usage: { input_tokens: 10, output_tokens: 10 }, permission_denials: [] });
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
  cola = cola.then(() => alMensaje(texto).catch((e) => {
    process.stderr.write(String(e?.stack || e));
    emitir({ type: 'result', subtype: 'error_during_execution', is_error: true, result: String(e?.message || e), num_turns: 1 });
  }));
});
rl.on('close', () => cola.then(() => process.exit(0)));

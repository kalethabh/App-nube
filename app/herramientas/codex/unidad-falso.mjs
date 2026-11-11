// Prueba de unidad SIN RED del Codex falso (app/server/claude/pruebas/codex-falso.js, §6.1 del diseño). Lo lanza como lo
// lanzaría la app (un exec con un mensaje armado a mano por esta prueba, y los resume), en sus modos, y comprueba la
// salida JSONL, lo que deja en el disco y lo que anota en FALSO_ARGS. No usa ninguna función de la app: las banderas y
// los mensajes los arma a mano, con las tareas de app/server/claude/tarea-*.md. No llama a nadie de verdad: las
// respuestas salen de los Claude falsos de app/server/claude/pruebas/.
//
//   node app/herramientas/codex/unidad-falso.mjs        sale con 0 si todo pasó y con 1 si algo falló
//
// Lo que crea: temp/_codex-unidad-falso-<id>/ (un producto y lotes de imagen), temp/zz-codex-unidad-falso-<id>/ (un
// anuncio de voz en off: el reparto de los Claude falsos necesita un slug que empiece con letra) y, fuera del proyecto,
// una carpeta temporal con los CODEX_HOME, la carpeta de trabajo y los registros. Al final borra solo eso.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(AQUI, '..', '..');
const RAIZ = path.resolve(APP, '..');
const TEMP = path.join(RAIZ, 'temp');
const FALSO = path.join(APP, 'server', 'claude', 'pruebas', 'codex-falso.js');
const CLAUDE_DIR = path.join(APP, 'server', 'claude');
const SIN_MAYUSCULAS = process.platform === 'win32' || process.platform === 'darwin';

const resultados = [];
function check(nombre, ok, detalle) {
  resultados.push({ nombre, ok: Boolean(ok) });
  const d = !ok && detalle !== undefined ? `\n        → ${String(typeof detalle === 'string' ? detalle : JSON.stringify(detalle)).slice(0, 1500)}` : '';
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${d}`);
  return Boolean(ok);
}
const seccion = (t) => console.log(`\n== ${t}`);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const leerJSON = (f, d = null) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return d;
  }
};
const esJSON = (t) => {
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
};
const sinAnsi = (t) => String(t).replace(/\u001b\[[0-9;]*m/g, '');
const barras = (p) => String(p).replace(/\\/g, '/');
const comparable = (p) => (SIN_MAYUSCULAS ? p.toLowerCase() : p);
function rel(p) {
  let s = barras(p).normalize('NFC');
  const r = barras(RAIZ).normalize('NFC');
  if (comparable(s).startsWith(comparable(`${r}/`))) s = s.slice(r.length + 1);
  return s.replace(/^\.\//, '');
}
const abs = (r) => (path.isAbsolute(r) ? r : path.join(RAIZ, ...r.split('/')));
const estado = (f) => {
  try {
    const st = fs.statSync(f);
    return `${st.size}-${st.mtimeMs}`;
  } catch {
    return 'no existe';
  }
};

// ---------------------------------------------------------------- las carpetas de la prueba

const HABIA_TEMP = fs.existsSync(TEMP); // en un checkout nuevo (el CI) no hay temp/: si queda vacía, se borra
const ID = crypto.randomBytes(4).toString('hex');
const DIR_TEMP = path.join(TEMP, `_codex-unidad-falso-${ID}`);
const SLUG = `zz-codex-unidad-falso-${ID}`;
const DIR_ANUNCIO = path.join(TEMP, SLUG);
const AFUERA = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-unidad-falso-'));
const TRABAJO = path.join(AFUERA, 'codex-trabajo');
const ESQUEMA = path.join(AFUERA, 'codex-respuesta.json');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

let nHome = 0;
function homeNuevo() {
  const h = path.join(AFUERA, `home-${++nHome}`);
  fs.mkdirSync(h, { recursive: true });
  return h;
}
let nReg = 0;
const registroNuevo = () => path.join(AFUERA, `registro-${++nReg}.jsonl`);
const notas = (f) =>
  (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return {};
      }
    });

const escribir = (f, d) => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, typeof d === 'string' || Buffer.isBuffer(d) ? d : `${JSON.stringify(d, null, 2)}\n`);
};

let nProducto = 0;
/** Un producto nuevo (la ficha de cada prueba sale de cero). Devuelve su carpeta desde la raíz. */
function productoNuevo({ pagina = true } = {}) {
  const d = path.join(DIR_TEMP, `producto-${++nProducto}`);
  escribir(path.join(d, 'producto.json'), { nombre: 'Té de prueba', tipo: 'fisico', url: '', descripcion: 'Un té para dormir', fotos: ['fotos/1.png'] });
  escribir(path.join(d, 'fotos', '1.png'), PNG);
  if (pagina) escribir(path.join(d, 'pagina.txt'), 'Té de prueba. Ayuda a dormir. 30 bolsitas.\n');
  return rel(d);
}

let nLote = 0;
function loteNuevo() {
  const d = path.join(DIR_TEMP, `lote-${++nLote}`);
  escribir(path.join(d, 'app', 'brief.json'), { cantidad: 2, formatos: ['1:1'], datos: { nombre: 'Té de prueba', idioma: 'es' }, referencias: [] });
  escribir(path.join(d, 'entrada', 'producto.png'), PNG);
  return rel(d);
}

function anuncioDeVoz() {
  const d = DIR_ANUNCIO;
  escribir(path.join(d, 'app', 'brief.json'), { familia: 'voz-en-off', estilo: 'claymation' });
  escribir(path.join(d, 'manifiesto.json'), {
    estilo: 'claymation',
    referencias: [{ id: 'mujer', tipo: 'personaje', prompt: 'A clay woman.' }],
    tomas: [
      { n: 1, tipo: 'A', duracion: 3, linea: 'Una frase.', prompt_imagen_inicial: 'A clay kitchen.', prompt_video: 'She breathes.' },
      { n: 2, tipo: 'A', duracion: 3, linea: 'Otra frase.', prompt_imagen_inicial: 'A clay clock.', prompt_video: 'The clock ticks.' },
    ],
  });
  for (const f of ['img/mujer.png', 'img/toma-1-inicial.png', 'img/toma-2-inicial.png', 'producto.png']) escribir(path.join(d, ...f.split('/')), PNG);
  for (const n of [1, 2]) escribir(path.join(d, 'app', 'revision', `contexto-toma-${n}.txt`), `Contexto de la toma ${n}.\n`);
  return `temp/${SLUG}`;
}

// ---------------------------------------------------------------- lo que manda la app (armado a mano, §2.4 y §2.5)

const DISABLE = [
  'shell_tool', 'unified_exec', 'browser_use', 'computer_use', 'in_app_browser', 'apps', 'plugins', 'image_generation',
  'code_mode_host', 'sleep_tool', 'multi_agent', 'goals', 'view_image', 'tool_suggest', 'skill_search', 'hooks',
  'daemon_auto_start', 'shell_snapshot', 'workspace_dependencies', 'remote_plugin', 'plugin_discovery_prefetch',
  'skill_mcp_dependency_install', 'secret_auth_storage', 'fast_mode', 'ultrafast_mode',
];
const MODO_APP = fs.readFileSync(path.join(CLAUDE_DIR, 'modo-app.md'), 'utf8');
const MODO_CODEX = fs.existsSync(path.join(CLAUDE_DIR, 'modo-app-codex.md'))
  ? fs.readFileSync(path.join(CLAUDE_DIR, 'modo-app-codex.md'), 'utf8')
  : '# CÓMO TRABAJAS AQUÍ (esto manda sobre las palabras de herramientas del MODO APP)\n\nNo tienes herramientas.\n';
const INSTRUCCIONES = `${MODO_APP}\n\n${MODO_CODEX}`;

function banderas({ sin = [], sinC = [], instrucciones = INSTRUCCIONES } = {}) {
  const b = ['--json', '--strict-config', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules'];
  for (const d of DISABLE) if (!sin.includes(d)) b.push('--disable', d);
  const c = [
    'web_search="disabled"', 'skills.include_instructions=false', 'model_reasoning_effort="medium"', 'check_for_update_on_startup=false',
    'project_doc_max_bytes=0', 'forced_login_method="chatgpt"', 'cli_auth_credentials_store="file"', 'model_auto_compact_token_limit=1000000000',
    `developer_instructions=${JSON.stringify(instrucciones)}`,
  ];
  for (const x of c) if (!sinC.includes(x.split('=')[0])) b.push('-c', x);
  return b;
}
const conImagenes = (imgs) => imgs.flatMap((i) => ['-i', abs(i)]);
const argsExec = (imgs = [], o = {}) => ['exec', ...banderas(o), '-s', 'read-only', '-C', TRABAJO, '--output-schema', ESQUEMA, ...conImagenes(imgs)];
const argsResume = (hilo, imgs = [], o = {}) => ['exec', 'resume', ...banderas(o), '-c', 'sandbox_mode="read-only"', '--output-schema', ESQUEMA, ...conImagenes(imgs), hilo, '-'];
const CUENTA = ['-c', 'forced_login_method=chatgpt', '-c', 'cli_auth_credentials_store=file', '--disable', 'daemon_auto_start', '--disable', 'secret_auth_storage'];

const kb = (t) => `${Math.max(1, Math.round(Buffer.byteLength(t) / 1024))} KB`;
function mensaje({ prefijo = '', material = [], imagenes = [], disponibles = [], tarea, escribe = [], comandos = [], notas: extra = [] }) {
  const p = [];
  if (prefijo) p.push(prefijo, '');
  if (material.length) {
    p.push('## MATERIAL', '');
    for (const r of material) {
      const c = fs.readFileSync(abs(r), 'utf8');
      p.push(`===== ARCHIVO: ${r} (${kb(c)}) =====`, c.replace(/\n$/, ''), `===== FIN: ${r} =====`, '');
    }
  }
  if (imagenes.length) p.push('## IMÁGENES ADJUNTAS (en este orden)', ...imagenes.map((r, i) => `Image #${i + 1} = ${r}`), '');
  if (disponibles.length) p.push('## DISPONIBLES SI LOS PIDES EN `leer`', ...disponibles.map((r) => `- ${r}`), '');
  p.push(...extra);
  p.push('## TAREA', '', tarea, '', '## LO QUE PUEDES ESCRIBIR', ...escribe.map((x) => `- ${x}`), '', '## COMANDOS QUE LA APP CORRE POR TI', ...(comandos.length ? comandos.map((c) => `- ${c}`) : ['Ninguno.']), '');
  return p.join('\n');
}

/** Una tarea de app/server/claude/ con sus marcas (sin el comentario de arriba). */
function tareaDe(nombre, marcas) {
  const t = fs.readFileSync(path.join(CLAUDE_DIR, `${nombre}.md`), 'utf8').replace(/^<!--[\s\S]*?-->\s*/, '');
  return t.replace(/\{\{(\w+)\}\}/g, (_, k) => marcas[k] ?? '').trim();
}

function mensajeFicha(prod, o = {}) {
  const tarea = tareaDe('tarea-ficha', {
    carpeta: prod,
    datos: JSON.stringify({ nombre: 'Té de prueba', tipo: 'fisico', pagina: '', lo_que_conto: 'Un té para dormir', tiene_guion_propio: false }, null, 2),
    fotos: `- ${prod}/fotos/1.png (la principal)`,
    pagina: fs.existsSync(abs(`${prod}/pagina.txt`)) ? `está en \`${prod}/pagina.txt\` (bajado por la app de https://ejemplo.com).` : 'no dio el link de una página.',
  });
  return mensaje({
    material: o.material ?? [`${prod}/producto.json`, ...(fs.existsSync(abs(`${prod}/pagina.txt`)) ? [`${prod}/pagina.txt`] : [])],
    imagenes: o.imagenes ?? [`${prod}/fotos/1.png`],
    tarea,
    escribe: [`cualquier archivo \`.json\`, \`.md\` o \`.txt\` dentro de \`${prod}/\`, menos \`producto.json\``],
    comandos: o.comandos || [],
    prefijo: o.prefijo || '',
    notas: o.notas || [],
  });
}

function mensajeVoz(carpeta) {
  const C = abs(carpeta);
  const en = (...p) => path.join(C, ...p);
  const skill = path.join(RAIZ, '.claude', 'skills', 'anuncios-claymation', 'SKILL.md');
  const tarea = [
    'TAREA: revisar las imágenes de un anuncio de plastilina antes de entregarlo.',
    `Carpeta del anuncio: ${C}`,
    '',
    'Te ejecuta la app "Anuncios con IA", sin chat: nadie te va a contestar. Solo lees archivos y escribes UN archivo.',
    '',
    `1. Lee ${en('manifiesto.json')}: qué tiene que mostrar cada toma.`,
    `2. Mira con Read la foto real del producto: ${en('producto.png')} Las hojas de los personajes y objetos están en ${en('img')} (una imagen por referencia, con su id como nombre).`,
    '3. Mira con Read, una por una, las imágenes de las tomas:',
    `- toma 1 (tipo A): ${en('img', 'toma-1-inicial.png')}`,
    `- toma 2 (tipo A): ${en('img', 'toma-2-inicial.png')}`,
    `5. Para cada toma a rehacer, lee ${en('app', 'revision', 'contexto-toma-N.txt')} y sigue las reglas del estilo de ${skill} si necesitas consultarlas.`,
    `6. Escribe ${en('app', 'revision.json')}, una lista (JSON válido):`,
    '   Si todo está bien, escribe [] (una lista vacía).',
    'Tu respuesta final: solo LISTO.',
  ].join('\n');
  return mensaje({
    material: [`${carpeta}/manifiesto.json`, `${carpeta}/app/revision/contexto-toma-1.txt`, `${carpeta}/app/revision/contexto-toma-2.txt`],
    imagenes: [`${carpeta}/producto.png`, `${carpeta}/img/mujer.png`, `${carpeta}/img/toma-1-inicial.png`, `${carpeta}/img/toma-2-inicial.png`],
    disponibles: ['.claude/skills/anuncios-claymation/SKILL.md'],
    tarea,
    escribe: [`${carpeta}/app/revision.json`],
  });
}
const imagenesVoz = (c) => [`${c}/producto.png`, `${c}/img/mujer.png`, `${c}/img/toma-1-inicial.png`, `${c}/img/toma-2-inicial.png`];

const SKILL_IMG = '.claude/skills/anuncios-imagen-ads';
const FORMATOS = fs.readdirSync(abs(`${SKILL_IMG}/formatos`)).filter((n) => n.endsWith('.json')).map((n) => `${SKILL_IMG}/formatos/${n}`);
function mensajeEstrategia(lote) {
  const l = lote.replace(/^temp\//, '');
  const tarea = tareaDe('tarea-imagen-ads-estrategia', {
    lote: l,
    datos: JSON.stringify({ nombre: 'Té de prueba', idioma: 'es' }, null, 2),
    cantidad: '2',
    proporciones: '1:1',
    angulo: 'que lo elija la IA',
    foto: `${lote}/entrada/producto.png`,
    referencias: '- No hay referencias: todas las variaciones salen de la biblioteca.',
    ids: 'V01 y V02',
    ultimo: 'V02',
  });
  return mensaje({
    material: [`${SKILL_IMG}/SKILL.md`, `${SKILL_IMG}/angulos.json`, `${SKILL_IMG}/formatos/indice.json`],
    imagenes: [`${lote}/entrada/producto.png`],
    disponibles: FORMATOS.filter((f) => !f.endsWith('/indice.json')),
    tarea,
    escribe: ['producto.json', 'estrategia.json', 'plan.json', 'V01.json', 'V02.json', 'app/imagen-ads/bloqueo.json'].map((f) => `${lote}/${f}`),
  });
}
function mensajeAjuste(lote) {
  const l = lote.replace(/^temp\//, '');
  const tarea = tareaDe('tarea-imagen-ads-ajuste', {
    lote: l,
    pedidos: `- U0001 · V01_1x1 (Producto protagonista): «Cambia el texto del titular» · (esta imagen todavía no existe) · anuncio ${lote}/V01.json`,
    tanda: 'A001',
  });
  return mensaje({
    material: [`${SKILL_IMG}/SKILL.md`, `${lote}/V01.json`],
    imagenes: [`${lote}/entrada/producto.png`],
    tarea,
    escribe: [`${lote}/V01.json`, `${lote}/ajustes/A001.json`],
  });
}

// ---------------------------------------------------------------- lanzar el falso como la app

function entorno(home, reg, extra = {}) {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/^(OPENAI_|AZURE_OPENAI_|CODEX_|ANTHROPIC_|CLAUDE_|KIE_|ELEVENLABS_|APIMART_|SUNO_|FALSO_|HUMO_)|^(CLAUDECODE|ANUNCIOS_MODO_PRUEBA)$/i.test(k)) delete env[k];
  return { ...env, CODEX_HOME: home, NO_COLOR: '1', FALSO_ARGS: reg, FALSO_CODEX_PAUSA: '1', ...extra };
}

function correr(args, { home, reg, env = {}, entrada = null, cerrar = true, tope = 90000, alEvento = null, alArrancar = null } = {}) {
  return new Promise((resolve) => {
    const hijo = spawn(process.execPath, [FALSO, ...args], { cwd: TRABAJO, env: entorno(home, reg, env), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    alArrancar?.(hijo);
    let out = '';
    let err = '';
    let buf = '';
    const eventos = [];
    let fin = false;
    const terminar = (codigo, cortado = false) => {
      if (fin) return;
      fin = true;
      clearTimeout(reloj);
      resolve({ codigo, cortado, stdout: out, stderr: err, eventos, hijo });
    };
    hijo.stdout.on('data', (d) => {
      out += d;
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const l = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!l) continue;
        try {
          const ev = JSON.parse(l);
          eventos.push(ev);
          alEvento?.(ev, hijo);
        } catch {
          /* no es JSON */
        }
      }
    });
    hijo.stderr.on('data', (d) => (err += d));
    hijo.stdin.on('error', () => {});
    hijo.on('exit', (c) => setTimeout(() => terminar(c), 20));
    const reloj = setTimeout(() => {
      hijo.kill();
      terminar(null, true);
    }, tope);
    if (entrada !== null) {
      if (cerrar) hijo.stdin.end(entrada);
      else hijo.stdin.write(entrada);
    } else if (cerrar) hijo.stdin.end();
  });
}

const respuestaDe = (r) => {
  const m = [...r.eventos].reverse().find((e) => e.type === 'item.completed' && e.item?.type === 'agent_message');
  if (!m) return null;
  try {
    return JSON.parse(m.item.text);
  } catch {
    return { _texto: m.item.text };
  }
};
const hiloDe = (r) => r.eventos.find((e) => e.type === 'thread.started')?.thread_id || null;
const tipos = (r) => r.eventos.map((e) => (e.type === 'item.completed' || e.type === 'item.started' ? `${e.type}:${e.item?.type}` : e.type));

/** Lo que haría la app con la respuesta: guarda lo permitido; las ediciones de un archivo, todas o ninguna. */
function aplicar(resp, permitidas) {
  const guardados = [];
  const rechazados = [];
  // (la ficha nunca pisa producto.json; un lote de imagen sí escribe el suyo)
  const puede = (r) => !r.includes('..') && /\.(json|md|txt)$/i.test(r) && permitidas.some((p) => (p.endsWith('/') ? comparable(r).startsWith(comparable(p)) : comparable(r) === comparable(p))) && !/(^|\/)(modelos|conductor)\.json$|\/(img|video)\/|\/producto-\d+\/producto\.json$/.test(r);
  for (const a of resp?.archivos || []) {
    const r = rel(a.ruta);
    if (!puede(r)) {
      rechazados.push(r);
      continue;
    }
    escribir(abs(r), a.contenido);
    guardados.push(r);
  }
  const porArchivo = new Map();
  for (const e of resp?.ediciones || []) {
    const r = rel(e.ruta);
    if (!porArchivo.has(r)) porArchivo.set(r, []);
    porArchivo.get(r).push(e);
  }
  for (const [r, eds] of porArchivo) {
    if (!puede(r) || !fs.existsSync(abs(r))) {
      rechazados.push(r);
      continue;
    }
    let t = fs.readFileSync(abs(r), 'utf8');
    let bien = true;
    for (const e of eds) {
      const i = t.indexOf(e.buscar);
      if (!e.buscar || i === -1 || t.indexOf(e.buscar, i + 1) !== -1) {
        bien = false;
        break;
      }
      t = t.slice(0, i) + e.reemplazar + t.slice(i + e.buscar.length);
    }
    if (!bien) {
      rechazados.push(r);
      continue;
    }
    fs.writeFileSync(abs(r), t);
    guardados.push(r);
  }
  return { guardados, rechazados };
}
const resultado = (g, extra = '') => `RESULTADO DE TU MENSAJE ANTERIOR\n\n${g.guardados.length ? `Guardé: ${g.guardados.join(', ')}.` : 'No guardé ningún archivo.'}\n${extra}\n\nSigue con tu tarea y responde con el mismo formato.\n`;
const correccion = (errores) => `La app revisó lo que escribiste y todavía no está bien:\n\n${errores.map((e) => `- ${e}`).join('\n')}\n\nCorrígelo con \`ediciones\` sobre los archivos que ya escribiste (solo lo que hay que arreglar), sin tocar lo que ya está bien. Cuando esté todo, responde con \`estado\` "LISTO".\n`;
const ESQUEMA_DE = {
  type: 'object',
  additionalProperties: false,
  required: ['estado', 'respuesta', 'archivos', 'ediciones', 'leer', 'comandos'],
  properties: {
    estado: { type: 'string', enum: ['LISTO', 'BLOQUEADO', 'SEGUIR'] },
    respuesta: { type: 'string' },
    archivos: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['ruta', 'contenido'], properties: { ruta: { type: 'string' }, contenido: { type: 'string' } } } },
    ediciones: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['ruta', 'buscar', 'reemplazar'], properties: { ruta: { type: 'string' }, buscar: { type: 'string' }, reemplazar: { type: 'string' } } } },
    leer: { type: 'array', items: { type: 'string' } },
    comandos: { type: 'array', items: { type: 'string' } },
  },
};
const esquemaBien = (r) => r && !r._texto && ['estado', 'respuesta', 'archivos', 'ediciones', 'leer', 'comandos'].every((k) => k in r) && Object.keys(r).length === 6;

// ---------------------------------------------------------------- las pruebas

async function pruebas() {
  fs.mkdirSync(TRABAJO, { recursive: true });
  const real = path.join(CLAUDE_DIR, 'esquemas', 'codex-respuesta.json');
  if (fs.existsSync(real)) fs.copyFileSync(real, ESQUEMA);
  else escribir(ESQUEMA, ESQUEMA_DE);

  seccion('1. --version, login status, login, logout y delete');
  {
    const home = homeNuevo();
    const reg = registroNuevo();
    const v = await correr(['--version'], { home, reg });
    check('--version dice codex-cli 0.167.0', v.codigo === 0 && v.stdout.trim() === 'codex-cli 0.167.0', v);
    const s0 = await correr([...CUENTA, 'login', 'status'], { home, reg });
    check('login status sin sesión: sale con 1 y «Not logged in» por stderr (stdout vacío)', s0.codigo === 1 && /Not logged in/.test(s0.stderr) && !s0.stdout.trim(), s0);
    const s1 = await correr(['login', 'status', ...CUENTA], { home, reg, env: { FALSO_CODEX_SESION: 'ok' } });
    check('login status con FALSO_CODEX_SESION=ok: sale con 0 y «Logged in using ChatGPT»', s1.codigo === 0 && /Logged in using ChatGPT/.test(s1.stderr), s1);
    const s2 = await correr(['login', 'status', ...CUENTA], { home, reg, env: { FALSO_CODEX_SESION: 'api' } });
    check('login status con una clave de API: sale con 0 y otro «Logged in using …»', s2.codigo === 0 && /Logged in using an API key/.test(s2.stderr), s2);
    const s3 = await correr(['login', 'status', '--strict-config', ...CUENTA], { home, reg });
    check('login status con --strict-config falla como el real', s3.codigo === 1 && /strict-config is not supported/.test(s3.stderr), s3);
    const n = notas(reg).filter((x) => x.tipo === 'codex-login-status');
    check('login status anota sus banderas (sin faltantes cuando van los -c y --disable de cuenta)', n.length === 4 && n[0].ok && !n[0].faltan.length, n);
    const s4 = await correr(['login', 'status'], { home, reg });
    const n4 = notas(reg).filter((x) => x.tipo === 'codex-login-status').pop();
    check('login status sin los -c de cuenta: lo anota como faltante', s4.codigo === 1 && n4?.faltan?.includes('-c forced_login_method') && n4.faltan.includes('--disable secret_auth_storage'), n4);

    const l1 = await correr(['login', ...CUENTA], { home, reg, env: { FALSO_CODEX_LOGIN_MS: '150' } });
    check('login: imprime la URL de auth.openai.com y sale con 0', l1.codigo === 0 && /If your browser did not open, navigate to this URL to authenticate:/.test(l1.stdout) && /https:\/\/auth\.openai\.com\/oauth\/authorize\?falso=1/.test(l1.stdout), l1);
    const s5 = await correr(['login', 'status', ...CUENTA], { home, reg });
    check('después de login, login status ve la sesión (la marca en CODEX_HOME)', s5.codigo === 0 && /Logged in using ChatGPT/.test(s5.stderr) && fs.existsSync(path.join(home, 'falso-sesion.json')), s5);
    const lo = await correr(['logout', ...CUENTA], { home, reg });
    const s6 = await correr(['login', 'status', ...CUENTA], { home, reg });
    check('logout borra la marca: login status vuelve a «Not logged in»', lo.codigo === 0 && s6.codigo === 1, { lo, s6 });
    const l2 = await correr(['login', '--device-auth', ...CUENTA], { home, reg, env: { FALSO_CODEX_LOGIN_MS: '100', NO_COLOR: '' } });
    const t2 = sinAnsi(l2.stdout);
    check('login --device-auth: el enlace de /codex/device y un código con el formato que busca la app', l2.codigo === 0 && /https:\/\/auth\.openai\.com\/codex\/device/.test(t2) && /\b[A-Z0-9]{4}-[A-Z0-9]{4,5}\b/.test(t2), t2);
    const l3 = await correr(['login', ...CUENTA], { home, reg, env: { FALSO_CODEX_LOGIN: 'puerto' } });
    check('login con el puerto 1455 ocupado: «address in use» y sale con 1', l3.codigo === 1 && /address in use/.test(l3.stderr), l3);
    const l4 = await correr(['login', '--device-auth', ...CUENTA], { home, reg, env: { FALSO_CODEX_LOGIN: 'sin-codigo' } });
    check('login --device-auth sin código habilitado: «device code login is not enabled»', l4.codigo === 1 && /device code login is not enabled/.test(l4.stderr), l4);
    const l5 = await correr(['login', ...CUENTA], { home, reg, env: { FALSO_CODEX_LOGIN: 'cuelga' }, tope: 1200 });
    check('login con FALSO_CODEX_LOGIN=cuelga no termina solo', l5.cortado === true, l5);
  }

  seccion('2. app-server');
  {
    const home = homeNuevo();
    const reg = registroNuevo();
    const args = ['app-server', '--strict-config', ...DISABLE.flatMap((d) => ['--disable', d]), '-c', 'forced_login_method="chatgpt"', '-c', 'cli_auth_credentials_store="file"', '-c', 'check_for_update_on_startup=false'];
    const pedidos = `${[
      { id: 1, method: 'initialize', params: { clientInfo: { name: 'anuncios-con-ia', version: '1' } } },
      { method: 'initialized' },
      { id: 2, method: 'account/read', params: {} },
      { id: 3, method: 'account/rateLimits/read', params: {} },
    ].map((x) => JSON.stringify(x)).join('\n')}\n`;
    const r1 = await correr(args, { home, reg, entrada: pedidos, env: { FALSO_CODEX_SESION: 'ok' } });
    const por = (r, id) => r.eventos.find((e) => e.id === id);
    check('initialize contesta', Boolean(por(r1, 1)?.result), r1.stdout);
    check('account/read da el correo y el plan', por(r1, 2)?.result?.account?.type === 'chatgpt' && por(r1, 2).result.account.planType === 'plus', por(r1, 2));
    const lim = por(r1, 3)?.result;
    check('account/rateLimits/read: ordinaryUsageAllowed, primary.resetsAt y rateLimitReachedType null', lim?.ordinaryUsageAllowed === true && Number.isFinite(lim.rateLimits?.primary?.resetsAt) && lim.rateLimits.rateLimitReachedType === null, lim);
    const r2 = await correr(args, { home, reg, entrada: pedidos, env: { FALSO_CODEX_SESION: 'ok', FALSO_CODEX_LIMITE: 'si' } });
    const lim2 = por(r2, 3)?.result;
    check('con FALSO_CODEX_LIMITE=si: el límite alcanzado (100 %, rate_limit_reached, sin uso ordinario)', lim2?.rateLimits?.primary?.usedPercent === 100 && lim2.rateLimits.rateLimitReachedType === 'rate_limit_reached' && lim2.ordinaryUsageAllowed === false, lim2);
    const r3 = await correr(args, { home, reg, entrada: pedidos });
    check('sin sesión: rateLimits da el error -32600', por(r3, 3)?.error?.code === -32600, por(r3, 3));
    const n = notas(reg).filter((x) => x.tipo === 'codex-app-server');
    check('app-server anota sus banderas: con --strict-config, las 25 --disable y los -c de cuenta, sin faltantes', n.length === 3 && n.every((x) => x.ok && !x.faltan.length), n[0]);
    await correr(['app-server', ...CUENTA], { home, reg, entrada: pedidos });
    const n2 = notas(reg).filter((x) => x.tipo === 'codex-app-server').pop();
    check('app-server sin --strict-config: lo anota como faltante', n2?.faltan?.includes('--strict-config') && !n2.ok, n2);
  }

  seccion('3. exec: una ficha que sale bien');
  const prod = productoNuevo();
  let hiloFicha = null;
  {
    const home = homeNuevo();
    const reg = registroNuevo();
    const r = await correr(argsExec([`${prod}/fotos/1.png`]), { home, reg, entrada: mensajeFicha(prod) });
    const t = tipos(r);
    const esperado = ['thread.started', 'item.completed:error', 'turn.started', 'error', 'item.completed:agent_message', 'turn.completed'];
    check('el JSONL tiene la forma del real (thread.started, Code Mode, turn.started, Reconnecting, agent_message, turn.completed)', r.codigo === 0 && JSON.stringify(t) === JSON.stringify(esperado), { t, err: r.stderr });
    const u = r.eventos.find((e) => e.type === 'turn.completed')?.usage;
    check('turn.completed trae usage (input, cached y output)', u?.input_tokens > 0 && u.cached_input_tokens >= 0 && u.output_tokens > 0, u);
    const resp = respuestaDe(r);
    check('la respuesta es el JSON del esquema (estado, respuesta, archivos, ediciones, leer, comandos)', esquemaBien(resp), resp);
    const ficha = resp?.archivos?.find((a) => rel(a.ruta) === `${prod}/ficha.json`);
    check('trae ficha.json entero (nuevo: en archivos), con JSON válido', resp?.estado === 'LISTO' && ficha && esJSON(ficha.contenido) && JSON.parse(ficha.contenido).nombre === 'Té de prueba', resp);
    check('el disco quedó como estaba: ficha.json no existe (la escribe la app)', !fs.existsSync(abs(`${prod}/ficha.json`)));
    const n = notas(reg).find((x) => x.tipo === 'codex-exec');
    check('anota el exec: sin problemas', n?.ok === true && !n.problemas.length, n?.problemas);
    check('banderas: ninguna falta ni sobra', n && !n.faltan.length && !n.malos.length && !n.deMas.length, n && { faltan: n.faltan, malos: n.malos, deMas: n.deMas });
    check('la entrada se cerró, sin claves en el entorno ni en el mensaje', n?.stdinCerrado === true && !n.envProhibidas.length && n.conSecreto === false && n.codexHome?.definido && !n.codexHome.delUsuario, n);
    check('las reglas: el MODO APP y «CÓMO TRABAJAS AQUÍ» en developer_instructions, no en el mensaje (conReglas)', n?.conReglas === true, n?.reglas);
    check('el material contra la lista a mano: es la ficha y no falta nada', n?.material === 'ficha' && n.materialEsperado === 3 && !n.materialFaltante.length && !n.materialDeMas.length, n && { e: n.materialEsperado, f: n.materialFaltante, d: n.materialDeMas });
    check('la imagen: 1 -i, existe, es imagen y coincide con IMÁGENES ADJUNTAS', n?.imagenes?.total === 1 && n.imagenes.listadas === 1 && !n.imagenes.faltan.length && !n.imagenes.noSonImagen.length && !n.imagenes.distintas.length, n?.imagenes);
    hiloFicha = hiloDe(r);
    check('la conversación queda en CODEX_HOME/sessions/<hilo>.json', hiloFicha && fs.existsSync(path.join(home, 'sessions', `${hiloFicha}.json`)), hiloFicha);
    const nr = notas(reg).find((x) => x.tipo === 'codex-respuesta');
    check('anota la respuesta (estado y archivos)', nr?.estado === 'LISTO' && nr.archivos.length === 1, nr);

    // la retoma con otra tarea en el mismo hilo, y un mensaje que no es nada
    const prod2 = productoNuevo();
    const rt = await correr(argsResume(hiloFicha, [`${prod2}/fotos/1.png`]), { home, reg, entrada: mensajeFicha(prod2, { prefijo: '(Tarea nueva en esta misma conversación. Lo que valía antes para escribir y para los comandos ya no vale: vale solo lo de abajo.)' }) });
    const nt = notas(reg).filter((x) => x.tipo === 'codex-resume').pop();
    const rr = respuestaDe(rt);
    check('retoma con otra tarea: deRetoma bien y la respuesta es de la tarea nueva', rt.codigo === 0 && nt?.deRetoma?.ok === true && nt.ok && rr?.archivos?.some((a) => rel(a.ruta) === `${prod2}/ficha.json`), { nt, rr });
    const ro = await correr(argsResume(hiloFicha), { home, reg, entrada: 'Haz otra cosa ahora.\n' });
    const no = notas(reg).filter((x) => x.tipo === 'codex-resume').pop();
    check('una tarea nueva sin sus partes: deRetoma mal y un problema anotado', ro.codigo === 0 && no?.deRetoma?.ok === false && no.ok === false, no);
    const rs = await correr(['exec', 'resume', ...banderas(), '-s', 'read-only', '--output-schema', ESQUEMA, hiloFicha, '-'], { home, reg, entrada: 'x' });
    check('resume con -s falla como el real (unexpected argument)', rs.codigo === 2 && /unexpected argument '-s'/.test(rs.stderr), rs.stderr);
    const d1 = await correr(['delete', hiloFicha, ...CUENTA], { home, reg });
    const d2 = await correr(['delete', hiloFicha, ...CUENTA], { home, reg });
    check('delete borra el hilo; el segundo delete no lo encuentra', d1.codigo === 0 && !fs.existsSync(path.join(home, 'sessions', `${hiloFicha}.json`)) && d2.codigo === 1, { d1: d1.stderr, d2: d2.stderr });
    const rp = await correr(argsResume(hiloFicha), { home, reg, entrada: correccion(['algo']) });
    check('resume de un hilo borrado: «no rollout found», sale con 1 y sin JSONL', rp.codigo === 1 && /no rollout found for thread id/.test(rp.stderr) && !rp.eventos.length, rp.stderr);
  }

  seccion('4. exec: lo que tiene que ver mal');
  {
    const home = homeNuevo();
    const reg = registroNuevo();
    const p = productoNuevo();
    const malo = mensajeFicha(p, { material: [`${p}/producto.json`], imagenes: [`${p}/fotos/1.png`, `${p}/fotos/no-existe.png`], notas: ['# MODO APP — Anuncios con IA', '', 'KIE_API_KEY=simulada-prueba-de-humo', ''] });
    const r = await correr(argsExec([`${p}/fotos/1.png`, `${p}/fotos/no-existe.png`], { sin: ['fast_mode'] }), { home, reg, entrada: malo, env: { OPENAI_API_KEY: 'sk-falsa-de-la-prueba' } });
    const n = notas(reg).find((x) => x.tipo === 'codex-exec');
    check('falta una --disable: queda en faltan', n?.faltan?.includes('--disable fast_mode'), n?.faltan);
    check('OPENAI_API_KEY en el entorno: queda en envProhibidas', n?.envProhibidas?.includes('OPENAI_API_KEY'), n?.envProhibidas);
    check('el mensaje repite el MODO APP: conReglas false', n?.conReglas === false && n.reglas.enMensaje.modoApp === true, n?.reglas);
    check('la clave falsa del .env en el mensaje: conSecreto', n?.conSecreto === true);
    check('falta pagina.txt en MATERIAL: queda en materialFaltante', n?.materialFaltante?.some((x) => x.endsWith(`${p}/pagina.txt`)), n?.materialFaltante);
    check('un -i que no existe: queda en imagenes.faltan', n?.imagenes?.faltan?.length === 1, n?.imagenes);
    check('con todo eso, ok es false y hay problemas escritos', n?.ok === false && n.problemas.length >= 6, n?.problemas);
    check('igual contesta (la app decide)', r.codigo === 0 && esquemaBien(respuestaDe(r)));
    const sinDi = await correr(argsExec([`${p}/fotos/1.png`], { sinC: ['developer_instructions'] }), { home, reg, entrada: mensajeFicha(p) });
    const n2 = notas(reg).filter((x) => x.tipo === 'codex-exec').pop();
    check('sin developer_instructions: falta -c developer_instructions y conReglas false', sinDi.codigo === 0 && n2?.faltan?.includes('-c developer_instructions') && n2.conReglas === false, n2?.faltan);
    const conPrompt = await correr([...argsExec([`${p}/fotos/1.png`]), 'el prompt como argumento'], { home, reg, entrada: mensajeFicha(p) });
    const n3 = notas(reg).filter((x) => x.tipo === 'codex-exec').pop();
    check('un prompt como argumento de exec: lo anota (el mensaje va por stdin)', conPrompt.codigo === 0 && n3?.deMas?.some((x) => /argumentos sueltos/.test(x)), n3?.deMas);
  }

  seccion('5. la entrada que no se cierra');
  {
    const home = homeNuevo();
    const reg = registroNuevo();
    const p = productoNuevo();
    let hijo = null;
    const r0 = correr(argsExec([`${p}/fotos/1.png`]), { home, reg, entrada: mensajeFicha(p), cerrar: false, env: { FALSO_CODEX_ESPERA_ENTRADA_MS: '700' }, alArrancar: (h) => (hijo = h) });
    await dormir(1600);
    const antes = notas(reg).find((x) => x.tipo === 'codex-exec');
    check('a los 0,7 s sin el final: anota stdinCerrado false', antes?.stdinCerrado === false && antes.ok === false, antes);
    const todavia = await Promise.race([r0, dormir(50).then(() => 'sigue')]);
    check('mientras la entrada no se cierra, no contesta: se queda esperando (como el real)', todavia === 'sigue');
    hijo.stdin.end();
    const r = await r0;
    check('el aviso «Reading additional input from stdin...» va por stderr', /Reading additional input from stdin\.\.\./.test(r.stderr), r.stderr);
    const fin = notas(reg).filter((x) => x.tipo === 'codex-exec').pop();
    check('cuando por fin se cierra, contesta, y el registro del exec dice stdinCerrado false', r.codigo === 0 && esquemaBien(respuestaDe(r)) && fin?.stdinCerrado === false && fin.ok === false, fin);
    const r2 = await correr(argsExec([`${p}/fotos/1.png`]), { home, reg, entrada: mensajeFicha(p), env: { FALSO_CODEX_ESPERA_ENTRADA_MS: '700' } });
    check('con la entrada cerrada, contesta enseguida y sin el aviso', r2.codigo === 0 && !/Reading additional input/.test(r2.stderr));
  }

  seccion('6. mal y mal-siempre: un archivo incompleto y la corrección por resume');
  for (const modo of ['mal', 'mal-siempre']) {
    const home = homeNuevo();
    const reg = registroNuevo();
    const p = productoNuevo();
    const env = { FALSO_CODEX_MODO: modo };
    const r1 = await correr(argsExec([`${p}/fotos/1.png`]), { home, reg, entrada: mensajeFicha(p), env });
    const resp1 = respuestaDe(r1);
    const f1 = resp1?.archivos?.find((a) => rel(a.ruta) === `${p}/ficha.json`);
    check(`${modo}: la primera ficha.json llega incompleta (no es JSON)`, f1 && !esJSON(f1.contenido), resp1);
    const g1 = aplicar(resp1, [`${p}/`]);
    const r2 = await correr(argsResume(hiloDe(r1)), { home, reg, entrada: correccion([`${p}/ficha.json no es JSON válido.`]), env });
    const resp2 = respuestaDe(r2);
    aplicar(resp2, [`${p}/`]);
    const ahora = fs.readFileSync(abs(`${p}/ficha.json`), 'utf8');
    const n2 = notas(reg).find((x) => x.tipo === 'codex-resume');
    check(`${modo}: el resume va con las banderas de resume (-c sandbox_mode, <hilo> -), sin problemas`, n2?.ok === true && n2.clase === 'correccion', n2?.problemas);
    if (modo === 'mal') check('mal: con la corrección la arregla con ediciones (buscar una sola vez) y queda JSON válido', g1.guardados.length === 1 && resp2?.ediciones?.length > 0 && esJSON(ahora) && resp2.estado === 'LISTO', resp2);
    else check('mal-siempre: no la arregla nunca', !esJSON(ahora) && !(resp2?.archivos?.length || resp2?.ediciones?.length), resp2);
  }
  {
    // mal con un comando: el resultado del comando no la arregla; la corrección de la app, sí
    const home = homeNuevo();
    const reg = registroNuevo();
    const p = productoNuevo();
    const env = { FALSO_CODEX_MODO: 'mal' };
    const cmd = `node produccion/validar-manifiesto.js ${p}/manifiesto.json`;
    const r1 = await correr(argsExec([`${p}/fotos/1.png`]), { home, reg, entrada: mensajeFicha(p, { comandos: [cmd] }), env });
    const g1 = aplicar(respuestaDe(r1), [`${p}/`]);
    const r2 = await correr(argsResume(hiloDe(r1)), { home, reg, entrada: resultado(g1, `### ${cmd} (terminó con código 1)\n\`\`\`\nERROR: algo\n\`\`\``), env });
    const resp2 = respuestaDe(r2);
    check('mal con comando: con el resultado del comando no la arregla (LISTO, sin archivos): la app tiene que verificar y corregir', resp2?.estado === 'LISTO' && !resp2.archivos.length && !resp2.ediciones.length && !esJSON(fs.readFileSync(abs(`${p}/ficha.json`), 'utf8')), resp2);
    const r3 = await correr(argsResume(hiloDe(r1)), { home, reg, entrada: correccion([`${p}/ficha.json no es JSON válido.`]), env });
    aplicar(respuestaDe(r3), [`${p}/`]);
    check('mal con comando: con la corrección, sí', esJSON(fs.readFileSync(abs(`${p}/ficha.json`), 'utf8')), respuestaDe(r3));
  }

  seccion('7. comandos: el primer mensaje pide uno y la app le devuelve lo que imprimió');
  {
    const home = homeNuevo();
    const reg = registroNuevo();
    const p = productoNuevo();
    const cmd = `node produccion/validar-manifiesto.js ${p}/manifiesto.json`;
    const r1 = await correr(argsExec([`${p}/fotos/1.png`]), { home, reg, entrada: mensajeFicha(p, { comandos: [cmd] }) });
    const resp1 = respuestaDe(r1);
    check('pide el comando, escrito exacto, con SEGUIR (y entrega sus archivos)', resp1?.estado === 'SEGUIR' && resp1.comandos?.[0] === cmd && resp1.archivos.length === 1, resp1);
    const g = aplicar(resp1, [`${p}/`]);
    const r2 = await correr(argsResume(hiloDe(r1)), { home, reg, entrada: resultado(g, `### ${cmd} (terminó con código 0)\n\`\`\`\nTodo en orden.\n\`\`\``) });
    const resp2 = respuestaDe(r2);
    const n2 = notas(reg).find((x) => x.tipo === 'codex-resume');
    check('con la salida del comando: LISTO, sin volver a mandar lo que ya está guardado', resp2?.estado === 'LISTO' && !resp2.archivos.length && !resp2.ediciones.length, resp2);
    check('anota que el comando volvió', n2?.comando?.devuelto === true && n2.ok, n2?.comando);
    const p2 = productoNuevo();
    const cmd2 = `node produccion/validar-manifiesto.js ${p2}/manifiesto.json`;
    const s1 = await correr(argsExec([`${p2}/fotos/1.png`]), { home, reg, entrada: mensajeFicha(p2, { comandos: [cmd2] }) });
    aplicar(respuestaDe(s1), [`${p2}/`]);
    await correr(argsResume(hiloDe(s1)), { home, reg, entrada: resultado({ guardados: [`${p2}/ficha.json`] }) });
    const n3 = notas(reg).filter((x) => x.tipo === 'codex-resume').pop();
    check('si la app no devuelve la salida del comando, lo anota como problema', n3?.comando?.devuelto === false && n3.ok === false, n3?.comando);
  }

  seccion('8. FALSO_CODEX_LEER y una revisión de voz en off (rutas absolutas, hojas, contextos)');
  const anuncio = anuncioDeVoz();
  {
    const home = homeNuevo();
    const reg = registroNuevo();
    const r1 = await correr(argsExec(imagenesVoz(anuncio)), { home, reg, entrada: mensajeVoz(anuncio), env: { FALSO_CODEX_LEER: '1' } });
    const resp1 = respuestaDe(r1);
    const n1 = notas(reg).find((x) => x.tipo === 'codex-exec');
    check('el material de la revisión de voz en off (6 cosas, con las hojas y los contextos) llegó entero', n1?.material === 'revision-imagenes-voz' && n1.materialEsperado >= 8 && !n1.materialFaltante.length, n1 && { e: n1.materialEsperado, f: n1.materialFaltante });
    check('con FALSO_CODEX_LEER=1: pide una skill de DISPONIBLES y ../.env, con SEGUIR y sin archivos', resp1?.estado === 'SEGUIR' && resp1.leer?.[0] === '.claude/skills/anuncios-claymation/SKILL.md' && resp1.leer[1] === '../.env' && !resp1.archivos.length, resp1);
    const skill = '.claude/skills/anuncios-claymation/SKILL.md';
    const bien = `RESULTADO DE TU MENSAJE ANTERIOR\n\nNo guardé ningún archivo.\nTe mando lo que pediste: está en MATERIAL NUEVO y en IMÁGENES ADJUNTAS.\nNo te mando: \`../.env\` (está fuera de lo que tu tarea puede leer).\n\n## MATERIAL NUEVO\n\n===== ARCHIVO: ${skill} (1 KB) =====\n(la skill)\n===== FIN: ${skill} =====\n\nSigue con tu tarea y responde con el mismo formato.\n`;
    const r2 = await correr(argsResume(hiloDe(r1)), { home, reg, entrada: bien, env: { FALSO_CODEX_LEER: "1" } });
    const resp2 = respuestaDe(r2);
    const n2 = notas(reg).find((x) => x.tipo === 'codex-resume');
    check('la app mandó la skill y se negó a ../.env: leer bien', n2?.leer?.llegoPedido === true && n2.leer.llegoEnv === false && n2.leer.negadoConMotivo === true && n2.ok, n2?.leer);
    const rv = resp2?.archivos?.find((a) => /app[\\/]revision\.json$/.test(a.ruta));
    check('después entrega revision.json, con la ruta como la nombra la tarea (absoluta) y la lista vacía', resp2?.estado === 'LISTO' && rv && path.isAbsolute(rv.ruta) && JSON.parse(rv.contenido).length === 0, resp2);
    check('el disco del anuncio quedó como estaba (revision.json no existe)', !fs.existsSync(path.join(DIR_ANUNCIO, 'app', 'revision.json')));
    // la app que se equivoca: manda el .env
    const r3 = await correr(argsExec(imagenesVoz(anuncio)), { home, reg, entrada: mensajeVoz(anuncio), env: { FALSO_CODEX_LEER: '1' } });
    await correr(argsResume(hiloDe(r3)), { home, reg, entrada: 'RESULTADO DE TU MENSAJE ANTERIOR\n\n## MATERIAL NUEVO\n\n===== ARCHIVO: ../.env (1 KB) =====\nKIE_API_KEY=simulada-prueba-de-humo\n===== FIN: ../.env =====\n', env: { FALSO_CODEX_LEER: '1' } });
    const n3 = notas(reg).filter((x) => x.tipo === 'codex-resume').pop();
    check('si la app manda el .env: lo anota (leer y conSecreto)', n3?.leer?.llegoEnv === true && n3.leer.llegoPedido === false && n3.conSecreto === true && n3.ok === false, n3);
  }

  seccion('9. por-partes y cortada: de a un archivo (una estrategia de imagen: 5 archivos)');
  for (const modo of ['por-partes', 'cortada']) {
    const home = homeNuevo();
    const reg = registroNuevo();
    const lote = loteNuevo();
    const permitidas = [`${lote}/`];
    const env = { FALSO_CODEX_MODO: modo };
    let r = await correr(argsExec([`${lote}/entrada/producto.png`]), { home, reg, entrada: mensajeEstrategia(lote), env });
    const hilo = hiloDe(r);
    const n1 = notas(reg).find((x) => x.tipo === 'codex-exec');
    if (modo === 'por-partes') check('el material de la estrategia (SKILL, ángulos, índice, la foto y los 57 formatos) llegó entero', n1?.material === 'imagen-ads-estrategia' && n1.materialEsperado >= 60 && !n1.materialFaltante.length, n1 && { e: n1.materialEsperado, f: n1.materialFaltante.slice(0, 5) });
    if (modo === 'cortada') {
      const ag = r.eventos.find((e) => e.item?.type === 'agent_message');
      const tf = r.eventos.find((e) => e.type === 'turn.failed');
      check('cortada: el agent_message llega cortado (no es JSON) y el turno falla con response_incomplete', r.codigo === 1 && ag && !esJSON(ag.item.text) && tf?.error?.codex_error_info === 'response_incomplete', tipos(r));
      r = await correr(argsResume(hilo), { home, reg, entrada: 'Tu respuesta anterior llegó cortada (era demasiado larga) y no la pude guardar. Mándala de nuevo en partes: un archivo por mensaje, con `estado` "SEGUIR", hasta el último, que va con "LISTO".\n', env });
    }
    const entregas = [];
    for (let i = 0; i < 10; i++) {
      const resp = respuestaDe(r);
      if (!resp || resp._texto) break;
      entregas.push({ estado: resp.estado, n: resp.archivos.length + new Set(resp.ediciones.map((e) => e.ruta)).size, leer: resp.leer.length, comandos: resp.comandos.length });
      const g = aplicar(resp, permitidas);
      if (resp.estado !== 'SEGUIR') break;
      r = await correr(argsResume(hilo), { home, reg, entrada: resultado(g, 'Sigue con el próximo archivo.'), env });
    }
    const ultimo = entregas[entregas.length - 1];
    check(`${modo}: 5 entregas de un archivo, SEGUIR hasta la última, que va con LISTO (sin leer ni comandos)`, entregas.length === 5 && entregas.every((x) => x.n === 1 && !x.leer && !x.comandos) && entregas.slice(0, -1).every((x) => x.estado === 'SEGUIR') && ultimo?.estado === 'LISTO', entregas);
    const leer = (f) => {
      try {
        return fs.readFileSync(abs(`${lote}/${f}`), 'utf8');
      } catch {
        return '';
      }
    };
    const todos = ['producto.json', 'estrategia.json', 'plan.json', 'V01.json', 'V02.json'].filter((f) => !esJSON(leer(f)));
    check(`${modo}: los 5 archivos quedaron guardados (por la app) y son JSON válido`, !todos.length, todos);
  }

  seccion('10. ediciones-mal: una edición con un buscar repetido, que la app rechaza entera');
  {
    const home = homeNuevo();
    const reg = registroNuevo();
    const lote = loteNuevo();
    // la estrategia primero (sale bien), guardada como lo haria la app
    const e = await correr(argsExec([`${lote}/entrada/producto.png`]), { home, reg, entrada: mensajeEstrategia(lote) });
    aplicar(respuestaDe(e), [`${lote}/`]);
    const antes = fs.readFileSync(abs(`${lote}/V01.json`), 'utf8');
    const r1 = await correr(argsExec([`${lote}/entrada/producto.png`]), { home, reg, entrada: mensajeAjuste(lote), env: { FALSO_CODEX_MODO: 'ediciones-mal' } });
    const resp1 = respuestaDe(r1);
    const deV01 = (resp1?.ediciones || []).filter((x) => rel(x.ruta) === `${lote}/V01.json`);
    const ultima = deV01[deV01.length - 1];
    const veces = ultima ? antes.split(ultima.buscar).length - 1 : 0;
    const n1 = notas(reg).filter((x) => x.tipo === 'codex-exec').pop();
    check('el material del ajuste (SKILL, V01.json y la foto) llegó entero', n1?.material === 'imagen-ads-ajuste' && !n1.materialFaltante.length, n1?.materialFaltante);
    check('V01.json existía: va en ediciones, y la última busca un texto que aparece 2 o más veces; estado SEGUIR', deV01.length >= 2 && veces >= 2 && resp1.estado === 'SEGUIR' && resp1.archivos.some((a) => /A001\.json$/.test(a.ruta)), { deV01: deV01.length, veces, estado: resp1?.estado });
    const g1 = aplicar(resp1, [`${lote}/V01.json`, `${lote}/ajustes/A001.json`]);
    check('la app (de esta prueba) no aplica ninguna de V01.json: queda igual', g1.rechazados.includes(`${lote}/V01.json`) && fs.readFileSync(abs(`${lote}/V01.json`), 'utf8') === antes, g1);
    const r2 = await correr(argsResume(hiloDe(r1)), { home, reg, entrada: resultado(g1, `No apliqué ninguna edición de \`${lote}/V01.json\`: la edición ${deV01.length} busca un texto que aparece ${veces} veces.`), env: { FALSO_CODEX_MODO: 'ediciones-mal' } });
    const resp2 = respuestaDe(r2);
    const g2 = aplicar(resp2, [`${lote}/V01.json`, `${lote}/ajustes/A001.json`]);
    const v01 = fs.readFileSync(abs(`${lote}/V01.json`), 'utf8');
    check('con el aviso, manda las ediciones buenas: V01.json cambió el titular y sigue siendo JSON', g2.guardados.includes(`${lote}/V01.json`) && v01 !== antes && esJSON(v01) && /\(cambiado\)/.test(v01) && resp2.estado === 'LISTO', resp2);
    const n2 = notas(reg).find((x) => x.tipo === 'codex-resume');
    check('anota que V01.json quedó intacto y que la app avisó', n2?.edicionesMal?.intacto === true && n2.edicionesMal.avisado === true && n2.ok, n2?.edicionesMal);
  }

  seccion('11. fuera: rutas que la app no tiene que guardar');
  {
    const home = homeNuevo();
    const reg = registroNuevo();
    const p = productoNuevo();
    const vigilar = ['../.env', 'app/config.json', 'temp/otro/x.json', `${p}/app/conductor.json`, `${p}/x.js`, `${p}/modelos.json`, `${p}/img/log-modelos.json`, `${p}/video/x.json`];
    const antes = vigilar.map((r) => estado(abs(r)));
    const prodAntes = fs.readFileSync(abs(`${p}/producto.json`), 'utf8');
    const r1 = await correr(argsExec([`${p}/fotos/1.png`]), { home, reg, entrada: mensajeFicha(p), env: { FALSO_CODEX_MODO: 'fuera' } });
    const resp1 = respuestaDe(r1);
    const rutas = (resp1?.archivos || []).map((a) => rel(a.ruta));
    check('devuelve ../.env, app/config.json, temp/otro, conductor.json, un .js, modelos.json, img/ y video/ (y producto.json en la ficha)', [...vigilar, `${p}/producto.json`].every((x) => rutas.includes(x)), rutas);
    check('el falso no escribió ninguno (el disco quedó igual: solo se mira el tamaño y la fecha)', vigilar.every((r, i) => estado(abs(r)) === antes[i]) && fs.readFileSync(abs(`${p}/producto.json`), 'utf8') === prodAntes);
    const g = aplicar(resp1, [`${p}/`]);
    const r2 = await correr(argsResume(hiloDe(r1)), { home, reg, entrada: resultado(g, `No guardé estos, porque tu tarea no puede escribirlos: ${g.rechazados.map((x) => `\`${x}\``).join(', ')}.`), env: { FALSO_CODEX_MODO: 'fuera' } });
    const n2 = notas(reg).find((x) => x.tipo === 'codex-resume');
    check('en el mensaje siguiente comprueba que la app no guardó ninguno', r2.codigo === 0 && Array.isArray(n2?.fuera?.guardados) && !n2.fuera.guardados.length, n2?.fuera);
  }

  seccion('12. resume-perdido, contexto y limite-a-mitad');
  {
    const home = homeNuevo();
    const reg = registroNuevo();
    const p = productoNuevo();
    const env = { FALSO_CODEX_MODO: 'resume-perdido' };
    const r1 = await correr(argsExec([`${p}/fotos/1.png`]), { home, reg, entrada: mensajeFicha(p), env });
    const resp1 = respuestaDe(r1);
    check('resume-perdido: el primer mensaje pide otro (SEGUIR)', resp1?.estado === 'SEGUIR', resp1);
    aplicar(resp1, [`${p}/`]);
    const r2 = await correr(argsResume(hiloDe(r1)), { home, reg, entrada: resultado({ guardados: [] }), env });
    check('resume-perdido: el resume falla con «no rollout found», sale con 1 y sin JSONL', r2.codigo === 1 && /no rollout found/.test(r2.stderr) && !r2.eventos.length, r2.stderr);
    const r3 = await correr(argsExec([`${p}/fotos/1.png`]), { home, reg, entrada: mensajeFicha(p, { prefijo: '(Esta tarea ya empezó en otra conversación, que se cerró. Lo que escribiste hasta ahora está en MATERIAL con su contenido de ahora: sigue desde ahí y no rehagas lo que ya está bien.)' }), env });
    const r4 = await correr(argsResume(hiloDe(r3)), { home, reg, entrada: resultado({ guardados: [] }), env });
    check('arrancando de nuevo, el resume del hilo nuevo sí sale bien', r3.codigo === 0 && r4.codigo === 0 && respuestaDe(r4)?.estado === 'LISTO', { r3: tipos(r3), r4: tipos(r4), err: r4.stderr });
  }
  {
    const home = homeNuevo();
    const reg = registroNuevo();
    const p = productoNuevo();
    const env = { FALSO_CODEX_MODO: 'contexto' };
    const r1 = await correr(argsExec([`${p}/fotos/1.png`]), { home, reg, entrada: mensajeFicha(p), env });
    aplicar(respuestaDe(r1), [`${p}/`]);
    const r2 = await correr(argsResume(hiloDe(r1)), { home, reg, entrada: resultado({ guardados: [] }), env });
    const tf = r2.eventos.find((e) => e.type === 'turn.failed');
    check("contexto: el segundo mensaje falla con «Codex ran out of room in the model's context window»", r2.codigo === 1 && /ran out of room in the model's context window/.test(tf?.error?.message) && tf.error.codex_error_info === 'context_window_exceeded', tf);
    const r3 = await correr(argsExec([`${p}/fotos/1.png`]), { home, reg, entrada: mensajeFicha(p, { prefijo: '(Esta tarea ya empezó en otra conversación, que se cerró. Lo que escribiste hasta ahora está en MATERIAL con su contenido de ahora: sigue desde ahí y no rehagas lo que ya está bien.)' }), env });
    const r4 = await correr(argsResume(hiloDe(r3)), { home, reg, entrada: resultado({ guardados: [] }), env });
    check('contexto: arrancando de nuevo sale bien (falla una sola vez)', r3.codigo === 0 && r4.codigo === 0, { r3: r3.stderr, r4: tipos(r4) });
  }
  {
    const home = homeNuevo();
    const reg = registroNuevo();
    const p = productoNuevo();
    const env = { FALSO_CODEX_MODO: 'limite-a-mitad', FALSO_CODEX_SESION: 'ok' };
    const lim = async () => {
      const a = await correr(['app-server', '--strict-config', ...DISABLE.flatMap((d) => ['--disable', d]), '-c', 'forced_login_method="chatgpt"', '-c', 'cli_auth_credentials_store="file"', '-c', 'check_for_update_on_startup=false'], { home, reg, env, entrada: `${JSON.stringify({ id: 1, method: 'account/rateLimits/read' })}\n` });
      return a.eventos.find((x) => x.id === 1)?.result;
    };
    const l0 = await lim();
    const r1 = await correr(argsExec([`${p}/fotos/1.png`]), { home, reg, entrada: mensajeFicha(p), env });
    const l1 = await lim();
    check('limite-a-mitad: antes, uso ordinario; el primer mensaje sale bien y pide otro; después, ordinaryUsageAllowed false', l0?.ordinaryUsageAllowed === true && r1.codigo === 0 && respuestaDe(r1)?.estado === 'SEGUIR' && l1?.ordinaryUsageAllowed === false, { l0, l1 });
    const r2 = await correr(argsResume(hiloDe(r1)), { home, reg, entrada: resultado({ guardados: [] }), env });
    const n2 = notas(reg).filter((x) => x.tipo === 'codex-resume').pop();
    check('si la app manda el segundo igual: lo anota como problema y el turno falla por límite', r2.codigo === 1 && n2?.ok === false && n2.problemas.some((x) => /uso ordinario/.test(x)), n2?.problemas);
    const l2 = await lim();
    const sinModo = await correr(['app-server', '--strict-config', ...DISABLE.flatMap((d) => ['--disable', d]), '-c', 'forced_login_method="chatgpt"', '-c', 'cli_auth_credentials_store="file"', '-c', 'check_for_update_on_startup=false'], { home, reg, env: { FALSO_CODEX_SESION: 'ok' }, entrada: `${JSON.stringify({ id: 1, method: 'account/rateLimits/read' })}\n` });
    check('cuando el modo ya no está, rateLimits vuelve a dar uso ordinario', l2?.ordinaryUsageAllowed === false && sinModo.eventos.find((x) => x.id === 1)?.result?.ordinaryUsageAllowed === true);
  }

  seccion('13. los errores: limite, plan-sin-codex, sin-sesion, refresh, alta-demanda, cuelga, muere, sin-json, herramientas');
  {
    const home = homeNuevo();
    const reg = registroNuevo();
    const p = productoNuevo();
    const fallo = async (modo, extra = {}) => {
      const r = await correr(argsExec([`${p}/fotos/1.png`]), { home, reg, entrada: mensajeFicha(p), env: { FALSO_CODEX_MODO: modo, ...extra } });
      return { r, tf: r.eventos.find((e) => e.type === 'turn.failed') };
    };
    const a = await fallo('limite', { FALSO_CODEX_SESION: 'ok' });
    check('limite: turn.failed con «You’ve hit your usage limit» (apóstrofo curvo) y «Try again at 8:14 PM.»', a.r.codigo === 1 && /You’ve hit your usage limit/.test(a.tf?.error?.message) && /Try again at 8:14 PM\./.test(a.tf.error.message), a.tf);
    const ap = await correr(['app-server', '--strict-config', ...DISABLE.flatMap((d) => ['--disable', d]), '-c', 'forced_login_method="chatgpt"', '-c', 'cli_auth_credentials_store="file"', '-c', 'check_for_update_on_startup=false'], { home, reg, env: { FALSO_CODEX_MODO: 'limite', FALSO_CODEX_SESION: 'ok' }, entrada: `${JSON.stringify({ id: 9, method: 'account/rateLimits/read' })}\n` });
    const rl = ap.eventos.find((x) => x.id === 9)?.result;
    const hora = rl ? new Date(rl.rateLimits.primary.resetsAt * 1000) : null;
    check('limite: después rateLimits está alcanzado, con el reinicio a las 20:14', rl?.rateLimits?.rateLimitReachedType === 'rate_limit_reached' && rl.ordinaryUsageAllowed === false && hora?.getHours() === 20 && hora.getMinutes() === 14, rl);
    const b = await fallo('plan-sin-codex');
    check('plan-sin-codex: «Quota exceeded. Check your plan and billing details.»', b.r.codigo === 1 && b.tf?.error?.message === 'Quota exceeded. Check your plan and billing details.' && b.tf.error.codex_error_info === 'quota_exceeded', b.tf);
    const b2 = await fallo('plan-sin-codex-plus');
    check('plan-sin-codex-plus: «To use Codex with your ChatGPT plan, upgrade to Plus»', b2.r.codigo === 1 && /To use Codex with your ChatGPT plan, upgrade to Plus/.test(b2.tf?.error?.message), b2.tf);
    fs.writeFileSync(path.join(home, 'falso-sesion.json'), '{}');
    const c = await fallo('sin-sesion');
    const reconectando = c.r.eventos.filter((e) => e.type === 'error' && /Reconnecting\.\.\. \d\/5 \(unexpected status 401 Unauthorized/.test(e.message)).length;
    check('sin-sesion: 10 «Reconnecting… 401», el paso a HTTPS y turn.failed 401; borra la marca de la sesión', c.r.codigo === 1 && reconectando === 10 && c.r.eventos.some((e) => /Falling back from WebSockets/.test(e.item?.message || '')) && /401 Unauthorized/.test(c.tf?.error?.message) && !fs.existsSync(path.join(home, 'falso-sesion.json')), tipos(c.r));
    const d1 = await fallo('refresh');
    const d2 = await fallo('refresh');
    check('refresh: el primer envío falla con «refresh token was already used»; el siguiente sale bien', d1.r.codigo === 1 && /refresh token was already used/.test(d1.tf?.error?.message) && d2.r.codigo === 0, { d1: d1.tf, d2: tipos(d2.r) });
    const e1 = await fallo('alta-demanda');
    const e2 = await fallo('alta-demanda');
    check('alta-demanda: «We\'re currently experiencing high demand» y después bien', e1.r.codigo === 1 && /currently experiencing high demand/.test(e1.tf?.error?.message) && e2.r.codigo === 0, e1.tf);
    const f = await correr(argsExec([`${p}/fotos/1.png`]), { home, reg, entrada: mensajeFicha(p), env: { FALSO_CODEX_MODO: 'cuelga' }, tope: 1500 });
    check('cuelga: thread.started y el aviso de Code Mode, pero nunca turn.started', f.cortado && tipos(f).includes('thread.started') && !tipos(f).includes('turn.started'), tipos(f));
    const g = await fallo('muere');
    check('muere: sale con 1 sin respuesta', g.r.codigo === 1 && !respuestaDe(g.r), tipos(g.r));
    const h1 = await correr(argsExec([`${p}/fotos/1.png`]), { home, reg, entrada: mensajeFicha(p), env: { FALSO_CODEX_MODO: 'sin-json' } });
    const txt = h1.eventos.find((e) => e.item?.type === 'agent_message')?.item?.text || '';
    check('sin-json: el agent_message no es JSON (y termina en «}», así no parece cortado)', h1.codigo === 0 && !esJSON(txt) && txt.trim().endsWith('}'), txt);
    const h2 = await correr(argsResume(hiloDe(h1)), { home, reg, entrada: 'Tu respuesta no fue el JSON pedido. Vuelve a mandarla con el formato: estado, respuesta, archivos, ediciones, leer, comandos.\n', env: { FALSO_CODEX_MODO: 'sin-json' } });
    check('sin-json: con el aviso, contesta con el JSON y la ficha', esquemaBien(respuestaDe(h2)) && respuestaDe(h2).archivos.length === 1, respuestaDe(h2));
    let vistos = 0;
    const p3 = productoNuevo();
    const i1 = await correr(argsExec([`${p3}/fotos/1.png`]), {
      home,
      reg,
      entrada: mensajeFicha(p3),
      env: { FALSO_CODEX_MODO: 'herramientas' },
      alEvento: (ev, hijo) => {
        if (ev.type === 'item.started' && ev.item?.type === 'collab_tool_call' && ++vistos === 4) hijo.kill(); // lo que hace la app
      },
    });
    check('herramientas: 4 item.started de tipo collab_tool_call antes de cualquier respuesta (la app lo corta)', vistos === 4 && !respuestaDe(i1), tipos(i1));
    const i2 = await correr(argsResume(hiloDe(i1)), { home, reg, entrada: 'No tienes herramientas ni subagentes: todo lo que necesitas está en este mensaje. Responde solo con el JSON pedido.\n', env: { FALSO_CODEX_MODO: 'herramientas' } });
    const ri2 = respuestaDe(i2);
    check('herramientas: después del aviso contesta con la ficha (una sola vez)', i2.codigo === 0 && ri2?.archivos?.length === 1 && !tipos(i2).includes('item.started:collab_tool_call'), tipos(i2));
  }

  seccion('14. muchas imágenes: el reparto en 2 mensajes');
  {
    const home = homeNuevo();
    const reg = registroNuevo();
    const p = productoNuevo();
    const foto = `${p}/fotos/1.png`;
    const llenas = Array.from({ length: 48 }, () => foto);
    const m49 = mensajeFicha(p, { imagenes: [...llenas, foto] });
    const a = await correr(argsExec([...llenas, foto]), { home, reg, entrada: m49, env: { FALSO_CODEX_MODO: 'muchas' } });
    const tf = a.eventos.find((e) => e.type === 'turn.failed');
    check('muchas: 49 imágenes en un mensaje → turn.failed input_too_large', a.codigo === 1 && tf?.error?.codex_error_info === 'input_too_large', tf);
    // el texto de lib/ia/material.js (lineaFaltanImagenes): con una sola, en singular
    const m48 = mensajeFicha(p, { imagenes: llenas, notas: ['Falta 1 imagen: llega en el próximo mensaje. Ahora responde solo con `estado` "SEGUIR", sin archivos.', ''] });
    const b1 = await correr(argsExec(llenas), { home, reg, entrada: m48, env: { FALSO_CODEX_MODO: 'muchas' } });
    const rb1 = respuestaDe(b1);
    check('con «Faltan N imágenes»: SEGUIR sin archivos', b1.codigo === 0 && rb1?.estado === 'SEGUIR' && !rb1.archivos.length && !rb1.ediciones.length, rb1);
    const b2 = await correr(argsResume(hiloDe(b1), [foto]), { home, reg, entrada: `## IMÁGENES ADJUNTAS (en este orden)\nImage #1 = ${foto}\n\nYa tienes todas las imágenes: haz la tarea.\n`, env: { FALSO_CODEX_MODO: 'muchas' } });
    const rb2 = respuestaDe(b2);
    const n2 = notas(reg).find((x) => x.tipo === 'codex-resume');
    check('con «Ya tienes todas las imágenes»: hace la tarea, y el material se mira con las de los dos mensajes', b2.codigo === 0 && rb2?.archivos?.length === 1 && n2?.material === 'ficha' && Array.isArray(n2.materialFaltante) && !n2.materialFaltante.length, { rb2, n2 });
  }

  seccion('15. la lista a mano: cada tarea de hoy tiene su entrada');
  {
    const lista = leerJSON(path.join(APP, 'server', 'claude', 'pruebas', 'material-esperado.json'));
    const ids = new Set((lista?.tareas || []).map((t) => t.id));
    const debe = ['ficha', 'guion', 'cambios', 'revision-imagenes-voz', 'revision-imagenes-cantados', 'continuidad-imagenes', 'continuidad-pares', 'continuidad-cadena', 'revisar-clips', 'rechazo', 'revisar-persona', 'revisar-imagenes-hablado', 'letra', 'tomas-musical', 'tomas-historia', 'imagen-ads-estrategia', 'imagen-ads-prompts', 'imagen-ads-revision', 'imagen-ads-ajuste', 'rehacer'];
    check('material-esperado.json tiene las 20 entradas (las 24 sesiones de §3.2)', debe.every((x) => ids.has(x)), debe.filter((x) => !ids.has(x)));
    const reconocen = (t) => (lista.tareas.find((e) => new RegExp(e.reconocer, 'm').test(t)) || {}).id;
    const casos = {
      'TAREA: ficha del producto': 'ficha',
      'TAREA: guion\nCarpeta del anuncio: temp/x': 'guion',
      'TAREA: cambios al guion': 'cambios',
      'TAREA: revisar las imágenes de un musical en crochet antes de entregarlo (parte 1 de 2: solo estas tomas).': 'revision-imagenes-cantados',
      'TAREA: revisar las imágenes de una historia musical en animación 3D cálida estilo Pixar antes de entregarlo.': 'revision-imagenes-cantados',
      'TAREA: revisar las imágenes de un anuncio de plastilina antes de entregarlo.': 'revision-imagenes-voz',
      'TAREA: continuidad-imagenes': 'continuidad-imagenes',
      'TAREA: continuidad-pares': 'continuidad-pares',
      'TAREA: continuidad-cadena': 'continuidad-cadena',
      'TAREA: revisar-clips': 'revisar-clips',
      'TAREA: rechazo': 'rechazo',
      'TAREA: revisar-persona': 'revisar-persona',
      'TAREA: revisar-imagenes': 'revisar-imagenes-hablado',
      'TAREA: cambiar la frase de la letra que Suno no quiso cantar': 'letra',
      'TAREA: tomas del musical': 'tomas-musical',
      'TAREA: tomas de la historia musical': 'tomas-historia',
      '(El intento anterior no terminó.) Sigue con la tarea de antes y termínala.\n\nTAREA: imagen-ads-prompts': 'imagen-ads-prompts',
      'TAREA: imagen-ads-revision': 'imagen-ads-revision',
      'TAREA: rehacer una pieza de un anuncio, pedida desde el editor.': 'rehacer',
    };
    const mal = Object.entries(casos).filter(([t, id]) => reconocen(t) !== id).map(([t, id]) => `${t.split('\n').pop()} → ${reconocen(t)} (debía ser ${id})`);
    check('cada TAREA de hoy (también con el aviso de reintento delante) la reconoce su entrada', !mal.length, mal);
    // las tareas .md de app/server/claude: cada TAREA: tiene quien la reconozca
    const sinEntrada = fs
      .readdirSync(CLAUDE_DIR)
      .filter((n) => /^tarea-.*\.md$/.test(n))
      .map((n) => [n, (fs.readFileSync(path.join(CLAUDE_DIR, n), 'utf8').match(/^TAREA: .+$/m) || [])[0]])
      .filter(([, t]) => t && !reconocen(t))
      .map(([n]) => n);
    check('cada tarea-*.md de app/server/claude tiene su entrada', !sinEntrada.length, sinEntrada);
  }
}

try {
  await pruebas();
} catch (e) {
  check('la prueba terminó sin errores propios', false, e?.stack || String(e));
} finally {
  fs.rmSync(DIR_TEMP, { recursive: true, force: true });
  fs.rmSync(DIR_ANUNCIO, { recursive: true, force: true });
  fs.rmSync(AFUERA, { recursive: true, force: true });
  if (!HABIA_TEMP) {
    try {
      fs.rmdirSync(TEMP); // solo si quedó vacía
    } catch {
      /* tiene algo */
    }
  }
}
const fallas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallas.length} de ${resultados.length} bien${fallas.length ? `; fallaron ${fallas.length}` : ''}.`);
process.exit(fallas.length ? 1 : 0);

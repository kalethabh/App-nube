// Un "claude" falso para probar la app SIN gastar el plan de nadie: imita la salida stream-json de Claude Code
// (system/init, mensajes con herramientas, parciales, result, rate_limit_event) y escribe los archivos de cada tarea.
//
//   ANUNCIOS_CLAUDE_BIN=app/server/claude/pruebas/claude-falso.js   la app lo lanza en vez del claude de verdad
//
// Que hace, segun FALSO_MODO (o FALSO_CONFIG = un .json { "ficha": "ok", "guion": "mal", "cambios": "ok" } que se lee
// en cada sesion, para cambiarlo sin reiniciar la app):
//   ok            escribe lo que pide la tarea y termina bien
//   mal           la primera vez deja guion.json/ficha.json incompleto; cuando la app le pide corregir, lo arregla
//   mal-siempre   nunca lo arregla
//   limite        "You've hit your session limit" (con rate_limit_event rechazado)
//   sin-sesion    "Not logged in · Please run /login"
//   bloqueo       escribe app/bloqueo.json y responde BLOQUEADO
//   cuelga        despues del init no dice nada mas
//   muere         se cierra con codigo 1 despues del init
//   en-uso        con --session-id dice "already in use" (la app tiene que pasar a --resume)
//   sin-conversacion  con --resume dice "No conversation found" (la app tiene que pasar a --session-id)
//   cambios-roto  en cambios rompe el manifiesto y termina con error (la app tiene que devolver el guion de antes)
// FALSO_PAUSA=ms entre eventos. FALSO_ARGS=archivo: anota ahi los argumentos y las variables ANTHROPIC_*/CLAUDE_*
// que le llegaron (solo los nombres), para revisar que la app los mande bien.
//
// La tarea "guion" toma como base el manifiesto de temp/befen-regulador-apetito (solo para probar el circuito: un
// anuncio de verdad lo escribe Claude desde cero). Nunca llama a nadie.
//
// EL REPARTO. Este es el unico que se apunta con ANUNCIOS_CLAUDE_BIN: con el primer mensaje mira la TAREA y la
// familia del anuncio (su app/brief.json) y, si hay un falso propio para esa tarea, se lo pasa tal cual (mismos
// argumentos, el mismo stdin y su stdout) con FALSO_DESPACHADO=1, asi ese falso puede devolverle lo que no conoce:
//   guion, cambios (los 12 estilos y la continuidad)        claude-falso-estilos.js   (FALSO_MODO=ok|mal; los demas
//                                                           modos de arriba los hace este)
//   continuidad-imagenes / -pares / -cadena                 claude-falso-continuidad.js (FALSO_CONT=imagenes:rehacer,…)
//   rehacer (el editor)                                     claude-falso-rehacer.js
//   musical e historia musical (tomas, revision, letra)     claude-falso-cantados.js  (FALSO_REVISION=uno)
//   podcast y entrevista (revisar-imagenes, -clips, rechazo) claude-falso-hablado.js  (FALSO_HABLADO=ok|mal|limite)
//   UGC (revisar-persona, revisar-clips, rechazo)           claude-falso-ugc.js       (FALSO_UGC_CONFIG=<.json>)
//   voz en off y continuidad (revisar las imagenes), objeto parlante (rechazo, revisar-clips)
//                                                           claude-falso-compartidas.js (FALSO_REVISION=uno)
//   anuncios de imagen (imagen-ads-estrategia, -prompts, -revision, -ajuste)
//                                                           claude-falso-imagen-ads.js (FALSO_IMAGEN_ADS=ok|mal|bloqueo|limite)
// La ficha y lo que no tiene falso propio lo hace este.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const args = process.argv.slice(2);
const val = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};

if (process.env.FALSO_ARGS) {
  const env = Object.keys(process.env).filter((k) => /^(ANTHROPIC_|CLAUDE_|CLAUDECODE$|KIE_|ELEVENLABS_)/i.test(k));
  fs.appendFileSync(process.env.FALSO_ARGS, JSON.stringify({ args, cwd: process.cwd(), env }) + '\n');
}

if (args[0] === '--version') {
  console.log('2.1.288 (Claude Code)');
  process.exit(0);
}
if (args[0] === 'auth' && args[1] === 'status') {
  const a = process.env.FALSO_AUTH || 'ok';
  console.log(JSON.stringify(a === 'ok' ? { loggedIn: true, authMethod: 'claude.ai', subscriptionType: 'max', email: 'alumno@ejemplo.com' } : a === 'api' ? { loggedIn: true, authMethod: 'api_key' } : { loggedIn: false, authMethod: 'none' }, null, 2));
  process.exit(a === 'ok' || a === 'api' ? 0 : 1);
}

const sesion = val('--resume') || val('--session-id') || '00000000-0000-0000-0000-000000000000';
const pausa = Number(process.env.FALSO_PAUSA) || 5;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const emitir = (o) => process.stdout.write(JSON.stringify({ session_id: sesion, ...o }) + '\n');
let id = 0;
const usar = async (name, input) => {
  const tid = `toolu_${++id}`;
  emitir({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: tid, name, input }] } });
  await dormir(pausa);
  emitir({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: tid, content: 'ok' }] } });
  await dormir(pausa);
};
// la misma herramienta, primero como parciales (asi la app puede decir que hace antes de que termine)
const usarConParciales = async (name, input) => {
  const json = JSON.stringify(input);
  emitir({ type: 'stream_event', event: { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: `toolu_p${id}`, name, input: {} } } });
  for (let i = 0; i < json.length; i += 40) emitir({ type: 'stream_event', event: { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: json.slice(i, i + 40) } } });
  emitir({ type: 'stream_event', event: { type: 'content_block_stop', index: 1 } });
  await usar(name, input);
};
const resultado = (extra = {}) => emitir({ type: 'result', subtype: 'success', is_error: false, result: 'LISTO', num_turns: 4, total_cost_usd: 0.31, duration_ms: 1234, usage: { input_tokens: 1200, output_tokens: 800, cache_read_input_tokens: 30000 }, permission_denials: [], ...extra });

function modo(tarea) {
  let m = process.env.FALSO_MODO || 'ok';
  if (process.env.FALSO_CONFIG) {
    try {
      const c = JSON.parse(fs.readFileSync(process.env.FALSO_CONFIG, 'utf8'));
      m = c[tarea] || c.todo || m;
    } catch {
      /* sin archivo: el de siempre */
    }
  }
  return m;
}

const escribir = (rel, datos) => {
  const abs = path.join(RAIZ, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, typeof datos === 'string' ? datos : JSON.stringify(datos, null, 2) + '\n', 'utf8');
};

// ---------------------------------------------------------------- las tareas

async function ficha(texto, m, intento) {
  const carpeta = texto.match(/Carpeta del producto: (\S+)/)?.[1];
  await usar('Read', { file_path: path.join(RAIZ, carpeta, 'producto.json') });
  if (fs.existsSync(path.join(RAIZ, carpeta, 'pagina.txt'))) await usar('Read', { file_path: path.join(RAIZ, carpeta, 'pagina.txt') });
  for (const f of fs.existsSync(path.join(RAIZ, carpeta, 'fotos')) ? fs.readdirSync(path.join(RAIZ, carpeta, 'fotos')) : []) await usar('Read', { file_path: path.join(RAIZ, carpeta, 'fotos', f) });
  const p = JSON.parse(fs.readFileSync(path.join(RAIZ, carpeta, 'producto.json'), 'utf8'));
  const ficha = {
    nombre: p.nombre || 'Producto de muestra',
    queEs: 'Un producto de muestra para probar la app',
    tipo: p.tipo || 'fisico',
    beneficios: ['Beneficio uno', 'Beneficio dos'],
    publico: 'Mujeres de 30 a 45',
    dolor: 'El antojo de la noche',
    oferta: '',
    comoCompra: 'Pago contra entrega',
    idioma: 'es',
    mercado: 'LatAm',
    deducido: ['publico', 'dolor', 'mercado'],
    falta: [{ campo: 'oferta', pregunta: '¿Cuánto cuesta y tienes alguna oferta?' }, { campo: 'prueba', pregunta: '¿Tienes reseñas reales?' }, { campo: 'comoSeUsa', pregunta: '¿Cómo se toma?' }, { campo: 'garantia', pregunta: '¿Tiene garantía?' }],
  };
  if ((m === 'mal' && intento === 1) || m === 'mal-siempre') delete ficha.queEs;
  await usarConParciales('Write', { file_path: path.join(RAIZ, carpeta, 'ficha.json'), content: JSON.stringify(ficha) });
  escribir(path.join(carpeta, 'ficha.json'), ficha);
}

function manifiestoDePrueba(slug) {
  const m = JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', 'befen-regulador-apetito', 'manifiesto.json'), 'utf8'));
  const foto = fs.readdirSync(path.join(RAIZ, 'temp', slug)).find((n) => /^producto\.(jpg|jpeg|png|webp)$/i.test(n));
  const ref = m.referencias.find((r) => r.tipo === 'producto');
  if (foto) ref.archivo = foto;
  else {
    m.referencias = m.referencias.filter((r) => r.tipo !== 'producto');
    for (const t of [...m.tomas, ...m.broll]) t.referencias = (t.referencias || []).filter((x) => x !== ref.id);
  }
  return m;
}

async function guion(texto, m, intento) {
  const slug = texto.match(/Carpeta del anuncio: temp\/(\S+)/)?.[1];
  await usar('Read', { file_path: path.join(RAIZ, '.claude', 'skills', 'anuncios-claymation', 'SKILL.md') });
  const foto = fs.readdirSync(path.join(RAIZ, 'temp', slug)).find((n) => /^producto\./.test(n));
  if (foto) await usar('Read', { file_path: path.join(RAIZ, 'temp', slug, foto) });
  if (m === 'bloqueo') {
    escribir(`temp/${slug}/app/bloqueo.json`, { motivo: 'No sé en qué país vendes y la skill no lo puede inventar.', faltan: ['El país donde vendes'] });
    await usar('Write', { file_path: path.join(RAIZ, 'temp', slug, 'app', 'bloqueo.json') });
    return 'BLOQUEADO';
  }
  const man = manifiestoDePrueba(slug);
  await usarConParciales('Write', { file_path: path.join(RAIZ, 'temp', slug, 'manifiesto.json'), content: JSON.stringify(man).slice(0, 2000) });
  escribir(`temp/${slug}/manifiesto.json`, man);
  const trans = JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', 'befen-regulador-apetito', 'transiciones.json'), 'utf8'));
  delete trans._nota;
  escribir(`temp/${slug}/transiciones.json`, trans);
  await usar('Write', { file_path: path.join(RAIZ, 'temp', slug, 'transiciones.json') });
  await usar('PowerShell', { command: `node produccion/validar-manifiesto.js temp/${slug}/manifiesto.json` });
  const g = {
    titulo: 'Campana del hambre (prueba)',
    idioma: 'es',
    mercado: 'LatAm',
    duracionEstimada: 40,
    de_que_va: 'Una campana adentro del estómago que no deja de sonar.',
    partes: man.tomas.map((t, i) => ({ n: t.n, momento: i === 0 ? 'gancho' : 'historia', dice: i === 2 ? `${t.linea} ` : t.linea, se_ve: 'Una escena de plastilina' })),
    decisiones: ['Elegí el ángulo principal de la skill.'],
  };
  if ((m === 'mal' && intento === 1) || m === 'mal-siempre') delete g.partes[0].dice;
  escribir(`temp/${slug}/app/guion.json`, g);
  await usar('Write', { file_path: path.join(RAIZ, 'temp', slug, 'app', 'guion.json') });
  return 'LISTO';
}

async function cambios(texto, m) {
  const slug = texto.match(/Carpeta del anuncio: temp\/(\S+)/)?.[1];
  const pedido = texto.match(/«([\s\S]*?)»/)?.[1] || '';
  await usar('Read', { file_path: path.join(RAIZ, 'temp', slug, 'manifiesto.json') });
  if (m === 'cambios-roto') {
    escribir(`temp/${slug}/manifiesto.json`, '{ "esto": "quedo a medias"');
    return 'ROTO';
  }
  const man = JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', slug, 'manifiesto.json'), 'utf8'));
  man.tomas[0].prompt_video = `${man.tomas[0].prompt_video}\nKeep the camera still.`;
  escribir(`temp/${slug}/manifiesto.json`, man);
  await usar('Edit', { file_path: path.join(RAIZ, 'temp', slug, 'manifiesto.json') });
  const g = JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', slug, 'app', 'guion.json'), 'utf8'));
  g.cambios_hechos = [`Hice lo que pediste: ${pedido.slice(0, 80)}`];
  escribir(`temp/${slug}/app/guion.json`, g);
  await usar('Write', { file_path: path.join(RAIZ, 'temp', slug, 'app', 'guion.json') });
  return 'LISTO';
}

// ---------------------------------------------------------------- la sesion

const tareaDe = (t) => (/TAREA: ficha/.test(t) ? 'ficha' : /TAREA: guion/.test(t) ? 'guion' : /TAREA: cambios/.test(t) ? 'cambios' : /TAREA: revision/.test(t) ? 'revision' : 'otra');
let tareaActual = null;
let textoTarea = ''; // el primer mensaje: el de la tarea (los siguientes son correcciones)
let intento = 0;
let iniciado = false;

async function alMensaje(texto) {
  intento++;
  if (!tareaActual) {
    tareaActual = tareaDe(texto);
    textoTarea = texto;
  }
  const m = modo(tareaActual);
  if (m === 'en-uso' && val('--session-id')) {
    process.stderr.write(`Error: Session ID ${sesion} is already in use.\n`);
    process.exit(1);
  }
  if (m === 'sin-conversacion' && val('--resume')) {
    process.stderr.write(`No conversation found with session ID: ${sesion}\n`);
    process.exit(1);
  }
  if (!iniciado) {
    iniciado = true;
    emitir({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: String(val('--tools') || '').split(',').filter(Boolean), model: 'claude-falso', permissionMode: val('--permission-mode'), apiKeySource: process.env.FALSO_CLAVE || 'none', claude_code_version: '2.1.288', mcp_servers: [] });
  } else emitir({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: [], model: 'claude-falso' });
  await dormir(pausa);
  if (m === 'cuelga') return;
  if (m === 'muere') {
    process.stderr.write('algo se rompio adentro\n');
    process.exit(1);
  }
  if (m === 'limite') {
    emitir({ type: 'rate_limit_event', rate_limit_info: { status: 'rejected', resetsAt: Math.floor(Date.now() / 1000) + 3600, rateLimitType: 'five_hour' } });
    emitir({ type: 'assistant', error: 'rate_limit', message: { role: 'assistant', content: [{ type: 'text', text: "You've hit your session limit · resets 3pm" }] } });
    return emitir({ type: 'result', subtype: 'success', is_error: true, result: "You've hit your session limit · resets 3pm", num_turns: 1, total_cost_usd: 0 });
  }
  if (m === 'sin-sesion') {
    emitir({ type: 'assistant', error: 'authentication_failed', message: { role: 'assistant', content: [{ type: 'text', text: 'Not logged in · Please run /login' }] } });
    return emitir({ type: 'result', subtype: 'success', is_error: true, result: 'Not logged in · Please run /login', num_turns: 0 });
  }
  let r = 'LISTO';
  // «regenerar una línea» (el ícono ✨ de «Editar a mano»): escribe otra versión de esa parte
  const linea = /TAREA: regenerar una l[ií]nea/.test(textoTarea) ? /Escribe (temp\/\S+\.json) con este JSON/.exec(textoTarea) : null;
  if (linea) {
    const n = (/Reescribe SOLO lo que se dice en la parte (\d+)/.exec(textoTarea) || [])[1] || '?';
    fs.writeFileSync(path.join(RAIZ, linea[1]), JSON.stringify({ dice: `Otra versión de prueba de la parte ${n}, escrita por la IA.` }));
    return resultado({ result: 'LISTO' });
  }
  if (tareaActual === 'ficha') await ficha(textoTarea, m, intento);
  else if (tareaActual === 'guion') r = await guion(textoTarea, m, intento);
  else if (tareaActual === 'cambios') r = await cambios(textoTarea, m);
  if (r === 'ROTO') return emitir({ type: 'result', subtype: 'error_during_execution', is_error: true, result: '', num_turns: 2 });
  resultado({ result: r });
}

// ---------------------------------------------------------------- el reparto

const AQUI = path.dirname(fileURLToPath(import.meta.url));
// estilo -> familia (por si el brief no la trae, o la carpeta no es de la app)
const FAMILIA_DE_ESTILO = {
  claymation: 'voz-en-off', crochet: 'voz-en-off', 'zack-d-films': 'voz-en-off', 'estilo-pixar': 'voz-en-off', skeleton: 'voz-en-off', 'estilo-lego': 'voz-en-off',
  'talking-object-pixar': 'objeto-parlante', ugc: 'ugc', podcast: 'hablado', entrevista: 'hablado', musical: 'musical', musicales: 'musical', 'historias-musicales': 'historia-musical',
};
// los modos de este archivo que no hace el falso de los estilos (limite, sin-sesion, bloqueo, cuelga…)
const MODOS_DE_ESTILOS = new Set(['ok', 'mal']);

/** La familia del anuncio del que habla la tarea (la primera carpeta temp/<slug> que nombra). */
function familiaDelTexto(texto) {
  for (const r of String(texto).matchAll(/temp[\\/]([a-z0-9][a-z0-9._-]*)/gi)) {
    const dir = path.join(RAIZ, 'temp', r[1]);
    if (!fs.existsSync(dir)) continue;
    const leer = (rel) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8'));
      } catch {
        return null;
      }
    };
    const b = leer(path.join('app', 'brief.json'));
    if (b?.familia) return b.familia;
    if (b?.estilo) return b.continuidad && FAMILIA_DE_ESTILO[b.estilo] === 'voz-en-off' ? 'continuidad' : FAMILIA_DE_ESTILO[b.estilo] || null;
    const m = leer('manifiesto.json');
    if (m?.estilo) return FAMILIA_DE_ESTILO[m.estilo] || null;
  }
  return null;
}

/** El falso propio de esta tarea, o null si la hace este. */
function especialista(texto) {
  if (process.env.FALSO_DESPACHADO) return null;
  const tarea = (String(texto).match(/^TAREA: ([^\n]+)/m) || [])[1] || '';
  if (!tarea || /^ficha\b/.test(tarea) || /^regenerar una l[ií]nea/.test(tarea)) return null;
  if (/^imagen-ads-/.test(tarea)) return 'claude-falso-imagen-ads.js';
  if (/^(guion|cambios)\b/.test(tarea)) return MODOS_DE_ESTILOS.has(modo(tarea.split(/\s/)[0])) ? 'claude-falso-estilos.js' : null;
  if (/^continuidad-/.test(tarea)) return 'claude-falso-continuidad.js';
  if (/^rehacer\b/.test(tarea)) return 'claude-falso-rehacer.js';
  const fam = familiaDelTexto(texto);
  if (fam === 'musical' || fam === 'historia-musical') return 'claude-falso-cantados.js';
  if (fam === 'hablado') return 'claude-falso-hablado.js';
  if (fam === 'ugc') return 'claude-falso-ugc.js';
  if (fam === 'voz-en-off' || fam === 'continuidad' || fam === 'objeto-parlante') return 'claude-falso-compartidas.js';
  return null;
}

let hijo = null; // el falso propio al que se le paso la sesion
let vistoPrimero = false;

const rl = readline.createInterface({ input: process.stdin });
let cola = Promise.resolve();
rl.on('line', (linea) => {
  if (hijo) return hijo.stdin.write(linea + '\n');
  let ev;
  try {
    ev = JSON.parse(linea);
  } catch {
    return;
  }
  if (ev.type !== 'user') return;
  const c = ev.message?.content;
  const texto = typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x?.text || '').join('\n') : '';
  if (!vistoPrimero) {
    vistoPrimero = true;
    const otro = especialista(texto);
    if (otro) {
      hijo = spawn(process.execPath, [path.join(AQUI, otro), ...args], { cwd: process.cwd(), env: { ...process.env, FALSO_DESPACHADO: '1' }, stdio: ['pipe', 'inherit', 'inherit'] });
      hijo.stdin.on('error', () => {});
      hijo.on('exit', (codigo) => process.exit(codigo ?? 0));
      hijo.stdin.write(linea + '\n');
      return;
    }
  }
  cola = cola.then(() => alMensaje(texto));
});
rl.on('close', () => {
  if (hijo) hijo.stdin.end();
  else cola.then(() => process.exit(0));
});

// Claude Code FALSO para probar la familia UGC sin gastar el plan de nadie (solo pruebas, en el scratchpad).
// Habla stream-json como claude-falso.js de la app y resuelve las tareas de familias/ugc.js:
//   TAREA: revisar-persona   escribe app/revision-persona.json
//   TAREA: revisar-clips     escribe app/revision-bloques.json
//   TAREA: rechazo           edita el manifiesto (la frase del primer tramo de la pieza) y escribe app/rechazo.json
// Lo que decide sale de FALSO_UGC_CONFIG (un .json que se lee en cada sesion):
//   { "persona": "ok" | "rehacer",
//     "clips": { "toma-4": 1, "gancho-1b": 1 },      cuantas veces se marca cada pieza (las primeras N que la mira)
//     "lugares": { "oficina": 4.5 },                   propone ese segundo (una vez)
//     "rechazo": "ok" | "igual" (deja el prompt igual: la app tiene que pedir corregir) | "limite",
//     "limite": ["revisar-clips"] }                    esas tareas contestan "You've hit your session limit" (una vez)
// Cuenta lo que ya hizo en FALSO_UGC_ESTADO (un .json). FALSO_ARGS: anota los argumentos de cada sesion.
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
if (process.env.FALSO_ARGS) fs.appendFileSync(process.env.FALSO_ARGS, JSON.stringify({ args }) + '\n');

const sesion = val('--resume') || val('--session-id') || '00000000-0000-0000-0000-000000000000';
const emitir = (o) => process.stdout.write(JSON.stringify({ session_id: sesion, ...o }) + '\n');
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let id = 0;
async function usar(name, input) {
  const tid = `toolu_${++id}`;
  emitir({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: tid, name, input }] } });
  await dormir(5);
  emitir({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: tid, content: 'ok' }] } });
}
const leer = (ruta, d = null) => {
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf8'));
  } catch {
    return d;
  }
};
const escribir = (ruta, v) => {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, typeof v === 'string' ? v : JSON.stringify(v, null, 2) + '\n', 'utf8');
};
const config = () => leer(process.env.FALSO_UGC_CONFIG, {}) || {};
const rutaEstado = process.env.FALSO_UGC_ESTADO;
const estado = () => leer(rutaEstado, {}) || {};
const guardarEstado = (e) => rutaEstado && escribir(rutaEstado, e);

function carpetaDe(texto) {
  const m = texto.match(/Carpeta del anuncio: (.+)/); // (la ruta puede llevar espacios y tildes)
  if (!m) return null;
  const c = m[1].trim();
  return path.isAbsolute(c) ? c : path.join(RAIZ, c);
}

async function revisarPersona(texto) {
  const C = carpetaDe(texto);
  await usar('Read', { file_path: path.join(C, 'manifiesto.json') });
  await usar('Read', { file_path: path.join(C, 'img', 'personaje.png') });
  const e = estado();
  const rehacer = config().persona === 'rehacer' && !e.personaHecha;
  e.personaHecha = true;
  guardarEstado(e);
  escribir(path.join(C, 'app', 'revision-persona.json'), { rehacer: rehacer ? [{ id: 'personaje', motivo: 'La persona tiene algo en la mano y la imagen tiene que tener las manos vacías.' }] : [] });
  await usar('Write', { file_path: path.join(C, 'app', 'revision-persona.json') });
}

// Las tareas compartidas nombran cada clip por su numero: los ganchos van como 101, 102...
function piezaPorNumero(m, n) {
  if (n > 100) {
    const g = (m.ganchos_alternativos || [])[n - 101];
    return g ? { clave: `gancho-${g.id}`, p: g } : null;
  }
  const t = m.tomas.find((x) => x.n === n);
  return t ? { clave: `toma-${n}`, p: t } : null;
}

async function revisarClips(texto) {
  const C = carpetaDe(texto);
  const m = leer(path.join(C, 'manifiesto.json'));
  const entradas = texto.split(/\n(?=- Toma \d+ \()/).filter((e) => /^- Toma \d+ \(/.test(e));
  const cfg = config();
  const e = estado();
  e.vistas ||= {};
  const clips = [];
  const bien = [];
  for (const entera of entradas) {
    const ent = entera.split(/\n\s*\n/)[0]; // solo la entrada (lo que sigue es el resto de la tarea)
    const n = Number(ent.match(/^- Toma (\d+)/)[1]);
    const x = piezaPorNumero(m, n);
    const tira = ent.match(/Tira del clip[^:]*: (.+?\.jpg)/)?.[1];
    if (tira) await usar('Read', { file_path: tira });
    e.vistas[x.clave] = (e.vistas[x.clave] || 0) + 1;
    const sucia = /NO DIJO SU FRASE LIMPIA/.test(ent);
    const mala = e.vistas[x.clave] <= (cfg.clips?.[x.clave] || 0);
    if (sucia || mala) {
      const extra = sucia ? 'Dice cada línea una sola vez, sin repetir palabras, y en el último tramo se queda en silencio sosteniendo el gesto.' : 'No aparece ninguna otra persona en ningún momento.';
      clips.push({
        toma: n,
        rehacer: 'clip',
        motivo: sucia ? 'No dijo su frase tal cual.' : `En ${x.clave} aparece una persona de más (vista ${e.vistas[x.clave]}).`,
        prompt_video: [x.p.prompt_video, extra].join(String.fromCharCode(10)),
      });
    } else bien.push(n);
  }
  const lugares = [];
  for (const [lid, seg] of Object.entries(cfg.lugares || {})) {
    if ((e.lugares || {})[lid] || !texto.includes(`img${path.sep}${lid}.png`)) continue;
    (e.lugares ||= {})[lid] = true;
    lugares.push({ id: lid, segundo: seg, motivo: 'El fotograma cayó en un primer plano y no se ve la oficina.' });
  }
  guardarEstado(e);
  escribir(path.join(C, 'app', 'revision-clips.json'), { clips, bien, ...(lugares.length ? { lugares } : {}) });
  await usar('Write', { file_path: path.join(C, 'app', 'revision-clips.json') });
}

async function rechazo(texto, intento) {
  const C = carpetaDe(texto);
  await usar('Read', { file_path: path.join(C, 'manifiesto.json') });
  const cfg = config();
  const entradas = texto.split(/\n(?=- Toma \d+)/).filter((x) => /^- Toma \d+/.test(x));
  const clips = [];
  for (const ent of entradas) {
    const n = Number(ent.match(/^- Toma (\d+)/)[1]);
    const tramo = ent.match(/Sus tramos: \[[^\]]*\] «([^»]+)»/)?.[1] || '';
    const frase = ent.match(/Su frase \(`linea`\): «([^»]+)»/)?.[1] || tramo;
    // una palabra que este una sola vez en la frase (la app pide que el pedazo sea unico)
    const palabras = tramo.split(/\s+/).filter((w) => /^\p{L}{4,}$/u.test(w) && frase.split(w).length === 2);
    const antes = palabras[palabras.length - 1] || tramo.split(/\s+/)[0];
    if (cfg.rechazo === 'igual' && intento === 1) clips.push({ toma: n, cambios: [{ antes: 'palabra-que-no-esta', nueva: 'otra' }], motivo: 'prueba' });
    else clips.push({ toma: n, cambios: [{ antes, nueva: `${antes} hoy` }], motivo: 'La frase sonaba a promesa: la dije más suave.' });
  }
  const e = estado();
  e.rechazos = (e.rechazos || 0) + 1;
  guardarEstado(e);
  escribir(path.join(C, 'app', 'rechazo.json'), { clips });
  await usar('Write', { file_path: path.join(C, 'app', 'rechazo.json') });
}

// ---------------------------------------------------------------- la sesion

const tareaDe = (t) => (/TAREA: revisar-persona/.test(t) ? 'revisar-persona' : /TAREA: revisar-clips/.test(t) ? 'revisar-clips' : /TAREA: rechazo/.test(t) ? 'rechazo' : 'otra');
let tarea = null;
let textoTarea = '';
let intento = 0;

async function alMensaje(texto) {
  intento++;
  if (!tarea || /^\(El intento anterior/.test(texto) || /TAREA: /.test(texto)) {
    if (/TAREA: /.test(texto)) {
      tarea = tareaDe(texto);
      textoTarea = texto;
      intento = 1;
    }
  }
  emitir({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: String(val('--tools') || '').split(',').filter(Boolean), model: 'claude-falso-ugc', permissionMode: val('--permission-mode'), apiKeySource: 'none', claude_code_version: '2.1.288', mcp_servers: [] });
  await dormir(5);
  const cfg = config();
  const e = estado();
  if ((cfg.limite || []).includes(tarea) && !(e.limiteDado || {})[tarea]) {
    (e.limiteDado ||= {})[tarea] = true;
    guardarEstado(e);
    emitir({ type: 'rate_limit_event', rate_limit_info: { status: 'rejected', resetsAt: Math.floor(Date.now() / 1000) + 2, rateLimitType: 'five_hour' } });
    emitir({ type: 'assistant', error: 'rate_limit', message: { role: 'assistant', content: [{ type: 'text', text: "You've hit your session limit · resets 3pm" }] } });
    return emitir({ type: 'result', subtype: 'success', is_error: true, result: "You've hit your session limit · resets 3pm", num_turns: 1, total_cost_usd: 0 });
  }
  if (tarea === 'revisar-persona') await revisarPersona(textoTarea);
  else if (tarea === 'revisar-clips') await revisarClips(textoTarea);
  else if (tarea === 'rechazo') await rechazo(textoTarea, intento);
  emitir({ type: 'result', subtype: 'success', is_error: false, result: 'LISTO', num_turns: 3, total_cost_usd: 0.1, duration_ms: 50, usage: { input_tokens: 10, output_tokens: 10 }, permission_denials: [] });
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

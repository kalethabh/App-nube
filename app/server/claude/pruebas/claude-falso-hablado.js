// Un "claude" falso para las tareas de produccion de la familia hablado (revisar-imagenes, revisar-clips, rechazo):
// imita la salida stream-json de Claude Code y escribe lo que pide cada tarea. Nunca llama a nadie.
//   FALSO_HABLADO=ok (por defecto) | mal (la primera vez escribe un archivo incompleto) | limite
//   En revisar-clips, sin FALSO_BROLL marca mal el primer B-roll de la ronda 1 (la camara se mueve). Con FALSO_BROLL:
//     FALSO_BROLL=uno      el primer B-roll de la lista que no se rehizo todavia (una vez)
//     FALSO_BROLL=2,3      esos B-roll cada vez que los ve (para probar el tope y "quedo con un defecto")
//     FALSO_BROLL=uno,3    las dos cosas · FALSO_BROLL=ninguno: todos bien
//     FALSO_BROLL_IMAGEN=1,3  esos, si se marcan, van con "rehacer": "toma" (tambien su imagen, con prompt_imagen)
//     (uno que ya no se rehace mas y sigue mal va en "mal_broll", sin prompts)
// (Lo lanza claude-falso.js, que reparte cada tarea a su falso: ANUNCIOS_CLAUDE_BIN apunta siempre a claude-falso.js.)
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

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
const emitir = (o) => process.stdout.write(JSON.stringify({ session_id: sesion, ...o }) + '\n');
let id = 0;
const usar = (name, input) => {
  const tid = `toolu_${++id}`;
  emitir({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: tid, name, input }] } });
  emitir({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: tid, content: 'ok' }] } });
};
const modo = process.env.FALSO_HABLADO || 'ok';
const anotar = (s) => {
  if (process.env.FALSO_REGISTRO) fs.appendFileSync(process.env.FALSO_REGISTRO, `${new Date().toISOString()} ${s}\n`);
};
let intento = 0;
let textoTarea = '';

function escribir(ruta, datos) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, JSON.stringify(datos, null, 2) + '\n', 'utf8');
  usar('Write', { file_path: ruta, content: '...' });
}

function revisarImagenes(t) {
  const C = t.match(/Carpeta del anuncio: (.+)/)[1].trim();
  const archivo = t.match(/Escribe (.+revisar-imagenes\.json)/)[1].trim();
  const m = JSON.parse(fs.readFileSync(path.join(C, 'manifiesto.json'), 'utf8'));
  const ids = [];
  for (const l of t.split('\n')) {
    const r = l.match(/^\s+- ([\w-]+): (.+\.png)$/);
    if (r) {
      ids.push(r[1]);
      usar('Read', { file_path: r[2] });
    }
  }
  const b = (m.broll || [])[0];
  const rehacer = [];
  if (b && (!ids.length || ids.includes(`broll-${b.n}`))) rehacer.push({ id: `broll-${b.n}`, motivo: 'El frasco salió con otra etiqueta.', prompt_nuevo: `${b.prompt_imagen} Etiqueta idéntica a la foto, de frente.` });
  // solo lo que esta en la lista de la tarea (en la entrevista A no hay mano con el microfono)
  if (m.estilo === 'entrevista' && (!ids.length || ids.includes('mano-mic'))) rehacer.push({ id: 'mano-mic', motivo: 'La mano entra por el otro lado.', voltear: true });
  else if (m.estilo === 'entrevista' && ids.includes('persona')) rehacer.push({ id: 'persona', motivo: 'Mira a cámara.' });
  if (m.estilo === 'podcast') rehacer.push({ id: 'host-a', motivo: 'Mira a cámara.' });
  if (modo === 'mal' && intento === 1) rehacer[0] = { id: 'broll-99', motivo: 'x' };
  escribir(archivo, { ok: [], rehacer });
}

// La tarea compartida revisar-clips: {"clips": [{toma, rehacer, motivo, prompt_video}], "bien": []}
function revisarClipsCompartida(t) {
  const C = t.match(/Carpeta del anuncio: (.+)/)[1].trim();
  const archivo = t.match(/Escribe (.+?revisar-clips-(\d+)\.json)/);
  const ronda = Number(archivo[2]);
  const m = JSON.parse(fs.readFileSync(path.join(C, 'manifiesto.json'), 'utf8'));
  const bloques = t.split('## Los clips')[1].split('## Qué hacer')[0].split(/\n(?=- )/);
  const clips = [];
  const bienBroll = [];
  const malBroll = [];
  let broll = false;
  for (const b of bloques) {
    const tira = b.match(/Tira del clip \(5 cuadros\): (.+?\.jpg)/);
    if (tira) usar('Read', { file_path: tira[1] });
    const tm = b.match(/^- Toma (\d+)/);
    const br = b.match(/^- B-roll (\d+)/);
    if (tm && /NO DIJO SU FRASE LIMPIA/.test(b)) {
      const x = m.tomas.find((y) => y.n === Number(tm[1]));
      const no = m.estilo === 'podcast' ? ' Says it only once, word for word.' : ' Nadie repite palabras ni agrega palabras que no están en el diálogo.';
      const p = { toma: x.n, rehacer: 'clip', motivo: 'No dijo su frase limpia.', prompt_video: `${x.prompt_video}${no}` };
      if (x.clase === 'reacciones') p.reacciones = x.reacciones.map((r) => ({ n: r.n, descripcion: `${r.descripcion}, con los labios cerrados` }));
      clips.push(p);
    }
    if (br && process.env.FALSO_BROLL) {
      const n = Number(br[1]);
      const x = m.broll.find((y) => y.n === n);
      const pedido = brollMal(x, b);
      if (pedido && /ya no se rehace más/.test(b)) malBroll.push({ toma: n, motivo: pedido.motivo });
      else if (pedido) clips.push(pedido);
      else bienBroll.push(n);
    } else if (br && !broll && ronda === 1) {
      broll = true;
      const x = m.broll.find((y) => y.n === Number(br[1]));
      clips.push({ toma: x.n, broll: true, rehacer: 'clip', motivo: 'La cámara se mueve.', prompt_video: `${x.prompt_video} Cámara completamente quieta.` });
    } else if (br) bienBroll.push(Number(br[1]));
  }
  escribir(archivo[1], { clips: modo === 'mal' && intento === 1 ? [] : clips, bien: [], bien_broll: bienBroll, ...(malBroll.length ? { mal_broll: malBroll } : {}) });
}

// FALSO_BROLL: el pedido de un B-roll que se ve mal ("- B-roll N" de la lista), o null si esta bien
let unoMarcado = false;
function brollMal(x, bloque) {
  const modoBroll = String(process.env.FALSO_BROLL || '').split(',').map((s) => s.trim());
  const siempre = new Set(modoBroll.filter((s) => /^\d+$/.test(s)).map(Number));
  const conImagen = new Set(String(process.env.FALSO_BROLL_IMAGEN || '').split(',').filter((s) => /^\d+$/.test(s.trim())).map(Number));
  if (!x) return null;
  const porUno = modoBroll.includes('uno') && !unoMarcado && !/Ya se rehizo/.test(bloque);
  if (!siempre.has(x.n) && !porUno) return null;
  if (porUno && !siempre.has(x.n)) unoMarcado = true;
  const vez = (bloque.match(/Ya se rehizo (\d+|una) ve/) || [])[1];
  const marca = vez ? ` (try ${vez === 'una' ? 2 : Number(vez) + 1})` : '';
  const img = conImagen.has(x.n);
  return {
    toma: x.n,
    broll: true,
    rehacer: img ? 'toma' : 'clip',
    motivo: 'Prueba: a mitad del clip la etiqueta del producto se borra y aparece otra cara.',
    prompt_video: `${x.prompt_video} The product stays rigid and unchanged the whole shot: same label, same shape; no new faces appear.${marca}`,
    ...(img ? { prompt_imagen: `${x.prompt_imagen} The product label is sharp and exactly as in the reference photo.${marca}` } : {}),
  };
}

// La tarea compartida rechazo: {"clips": [{toma, cambios: [{antes, nueva}], motivo}]}
function rechazoCompartido(t) {
  const archivo = t.match(/\n(.+?rechazo-\d+\.json) \(JSON válido\)/)[1].trim();
  const bloques = t.split('## Las escenas rechazadas')[1].split('## Reglas del cambio')[0].split(/\n(?=- Toma )/);
  const clips = [];
  for (const b of bloques) {
    const tm = b.match(/- Toma (\d+)/);
    if (!tm) continue;
    const frase = b.match(/Frase 1: «(.+)»/)[1];
    const ya = (b.match(/Ya se probaron[^:]*: (.*)/) || [null, ''])[1].split('·').filter((s) => s.trim()).length;
    const largas = frase.split(/\s+/).filter((w) => /^[\p{L}]{4,}$/u.test(w) && w !== w.toUpperCase());
    const w = largas[ya % Math.max(1, largas.length)] || frase.split(/\s+/)[0];
    clips.push({ toma: Number(tm[1]), cambios: [{ antes: w, nueva: w.toUpperCase() }], motivo: 'Cambié una palabra que el modelo no aceptaba.' });
  }
  escribir(archivo, { clips });
}

function revisarClips(t) {
  const C = t.match(/Carpeta del anuncio: (.+)/)[1].trim();
  const archivo = t.match(/Escribe (.+revisar-clips-\d+\.json)/)[1].trim();
  const m = JSON.parse(fs.readFileSync(path.join(C, 'manifiesto.json'), 'utf8'));
  const rehacer = [];
  let broll = false;
  for (const l of t.split('\n')) {
    const r = l.match(/^\s+- ((toma|broll)-(\d+)) \(.*?\): (.+?\.jpg)/);
    if (!r) continue;
    usar('Read', { file_path: r[4] });
    const n = Number(r[3]);
    if (r[2] === 'toma' && /NO ESTÁ LIMPIO/.test(l)) {
      const tm = m.tomas.find((x) => x.n === n);
      const no = m.estilo === 'podcast' ? ' Says it only once, word for word.' : ' Nadie repite palabras ni agrega palabras que no están en el diálogo.';
      const p = { id: r[1], motivo: 'No salió limpio: repitió una palabra.', prompt_video: `${tm.prompt_video}${no}`, imagen_bien: true };
      if (tm.clase === 'reacciones') p.reacciones = tm.reacciones.map((x) => ({ n: x.n, descripcion: `${x.descripcion}, con los labios cerrados` }));
      rehacer.push(p);
    }
    if (r[2] === 'broll' && !broll && /ronda 1/.test(t)) {
      broll = true;
      const b = m.broll.find((x) => x.n === n);
      rehacer.push({ id: r[1], motivo: 'La cámara se mueve.', prompt_video: `${b.prompt_video} Cámara completamente quieta.` });
    }
  }
  escribir(archivo, { ok: [], rehacer: modo === 'mal' && intento === 1 ? [] : rehacer });
}

function rechazo(t) {
  const C = t.match(/Carpeta del anuncio: (.+)/)[1].trim();
  const archivo = t.match(/Escribe (.+rechazo-[\w-]+\.json):/)[1].trim();
  const rm = path.join(C, 'manifiesto.json');
  const m = JSON.parse(fs.readFileSync(rm, 'utf8'));
  usar('Read', { file_path: rm });
  const toma = t.match(/el clip de la toma (\d+)/);
  const broll = t.match(/el B-roll (\d+)\./);
  if (toma) {
    const tm = m.tomas.find((x) => x.n === Number(toma[1]));
    tm.prompt_video = `${tm.prompt_video} Dicho con calma, sin promesas.`;
  } else if (broll) {
    const b = m.broll.find((x) => x.n === Number(broll[1]));
    b.prompt_video = `${b.prompt_video} Plano tranquilo.`;
  }
  fs.writeFileSync(rm, JSON.stringify(m, null, 2) + '\n', 'utf8');
  usar('Edit', { file_path: rm });
  usar('PowerShell', { command: `node produccion/validar-manifiesto.js temp/${path.basename(C)}/manifiesto.json` });
  escribir(archivo, { antes: 'la frase de antes', despues: 'la frase nueva', motivo: 'Hablaba de una enfermedad.' });
}

async function alMensaje(texto) {
  intento++;
  if (!textoTarea) textoTarea = texto;
  emitir({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: String(val('--tools') || '').split(',').filter(Boolean), model: 'claude-falso', permissionMode: val('--permission-mode'), apiKeySource: 'none', claude_code_version: '2.1.288', mcp_servers: [] });
  anotar(`${val('--resume') ? 'resume' : 'nueva'} ${sesion} intento ${intento}: ${textoTarea.split('\n')[0]}`);
  if (modo === 'limite') {
    emitir({ type: 'rate_limit_event', rate_limit_info: { status: 'rejected', resetsAt: Math.floor(Date.now() / 1000) + 3600, rateLimitType: 'five_hour' } });
    return emitir({ type: 'result', subtype: 'success', is_error: true, result: "You've hit your session limit · resets 3pm", num_turns: 1 });
  }
  const t = textoTarea;
  if (/^TAREA: revisar-imagenes/m.test(t)) revisarImagenes(t);
  else if (/^TAREA: revisar-clips/m.test(t) && /## Los clips/.test(t)) revisarClipsCompartida(t);
  else if (/^TAREA: revisar-clips/m.test(t)) revisarClips(t);
  else if (/^TAREA: rechazo/m.test(t) && /## Las escenas rechazadas/.test(t)) rechazoCompartido(t);
  else if (/^TAREA: rechazo/m.test(t)) rechazo(t);
  emitir({ type: 'result', subtype: 'success', is_error: false, result: 'LISTO', num_turns: 3, total_cost_usd: 0.1, duration_ms: 100, usage: { input_tokens: 10, output_tokens: 10 }, permission_denials: [] });
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

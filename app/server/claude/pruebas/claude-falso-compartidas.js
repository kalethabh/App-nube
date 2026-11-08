// Un "claude" falso para las tareas de produccion que no tienen falso propio: la revision de las imagenes de voz en
// off (y la de continuidad cuando el anuncio va con cortes) y las dos tareas compartidas del objeto parlante
// (tarea-rechazo.md y tarea-revisar-clips.md). Imita el stream-json de Claude Code y escribe lo que pide cada
// tarea. Nunca llama a nadie.
// (Lo lanza claude-falso.js, que reparte cada tarea a su falso: ANUNCIOS_CLAUDE_BIN apunta siempre a claude-falso.js.)
//
//   FALSO_REVISION=uno   la revision de imagenes pide rehacer una toma (si no, todo bien: [])
//   FALSO_CLIPS=ok       revisar-clips solo rehace los clips que no dijeron su frase limpia (siempre, como pide la app)
//   FALSO_BROLL=uno      revisar-clips marca mal el primer B-roll de la lista que no se rehizo todavia (una vez)
//   FALSO_BROLL=9,4      revisar-clips marca mal esos B-roll cada vez que los ve (para probar el tope)
//   FALSO_BROLL=uno,9    las dos cosas a la vez
//   FALSO_BROLL_IMAGEN=1,9  esos B-roll, si se marcan, van con "rehacer": "toma" (tambien su imagen, con prompt_imagen)
//   (sin FALSO_BROLL, todos los B-roll estan bien y van en "bien_broll"; uno que ya no se rehace mas y sigue mal va en
//   "mal_broll", sin prompts)
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const args = process.argv.slice(2);
const val = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : null;
};
const sesion = val('--resume') || val('--session-id') || '00000000-0000-0000-0000-000000000000';
const emitir = (o) => process.stdout.write(JSON.stringify({ session_id: sesion, ...o }) + '\n');
let id = 0;
const usar = (name, input) => {
  const tid = `toolu_${++id}`;
  emitir({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: tid, name, input }] } });
  emitir({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: tid, content: 'ok' }] } });
};
const escribir = (ruta, datos) => {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, JSON.stringify(datos, null, 2) + '\n', 'utf8');
  usar('Write', { file_path: ruta, content: '...' });
};
const carpetaDe = (t) => (t.match(/Carpeta del anuncio: (.+)/) || [])[1]?.trim() || null;
const manifiestoDe = (carpeta) => JSON.parse(fs.readFileSync(path.join(carpeta, 'manifiesto.json'), 'utf8'));
const archivoDe = (t) => (t.match(/escribes UN archivo: (.+?\.json)\./) || [])[1]?.trim() || null;

/** Una frase al final del prompt, antes de su "Negative prompt:" si lo tiene. */
function sumar(prompt, frase) {
  const texto = String(prompt || '');
  const i = texto.search(/\n*\s*Negative prompt:/i);
  return i === -1 ? `${texto} ${frase}` : `${texto.slice(0, i).trimEnd()} ${frase}${texto.slice(i)}`;
}

// ---------------------------------------------------------------- voz en off: revisar las imagenes (revision.json)

function revisionImagenes(t) {
  const carpeta = carpetaDe(t);
  const salida = (t.match(/Escribe (\S+revision\.json), una lista/) || [])[1];
  const m = manifiestoDe(carpeta);
  for (const r of [...t.matchAll(/^- toma \d+ \(tipo [ABC]\): (\S+\.png)/gm)].slice(0, 4)) usar('Read', { file_path: r[1] });
  const lista = [];
  if (process.env.FALSO_REVISION === 'uno') {
    const x = (m.tomas || []).find((y) => y.tipo === 'A' && y.n > 1) || (m.tomas || []).find((y) => ['A', 'C'].includes(y.tipo));
    if (x) {
      lista.push({
        toma: x.n,
        motivo: 'Prueba: la etiqueta del producto salió con letras inventadas.',
        promptsNuevos: {
          prompt_imagen_inicial: sumar(x.prompt_imagen_inicial, 'The product label shows only the brand name, clean and readable.'),
          ...(x.tipo === 'B' ? { prompt_imagen_final: sumar(x.prompt_imagen_final, 'The product label stays clean and readable.') } : {}),
          prompt_video: sumar(x.prompt_video, 'Gentle, steady motion.'),
        },
      });
    }
  }
  escribir(salida, lista);
}

// ---------------------------------------------------------------- compartida: rechazo (rechazo.json)

function rechazo(t) {
  const archivo = archivoDe(t);
  const seccion = (t.split('## Las escenas rechazadas')[1] || '').split('## Reglas del cambio')[0];
  const clips = [];
  for (const b of seccion.split(/\n(?=- Toma \d+)/)) {
    const tm = b.match(/^\s*- Toma (\d+)/);
    if (!tm) continue;
    const frase = (b.match(/Su frase[^«]*«(.+?)»/) || b.match(/«(.+?)»/) || [])[1];
    if (!frase) continue;
    const probadas = ((b.match(/(?:Ya se probaron|probad[ao]s?)[^:]*: (.*)/i) || [])[1] || '').split('·').filter((s) => s.trim()).length;
    const largas = frase.split(/\s+/).map((w) => w.replace(/[.,;:!?¿¡«»"]/g, '')).filter((w) => /^\p{L}{4,}$/u.test(w) && w !== w.toUpperCase());
    const w = largas[probadas % Math.max(1, largas.length)] || frase.split(/\s+/)[0];
    clips.push({ toma: Number(tm[1]), cambios: [{ antes: w, nueva: w.toUpperCase() }], motivo: 'Cambié una palabra que el modelo de video no aceptaba.' });
  }
  escribir(archivo, { clips });
}

// ---------------------------------------------------------------- compartida: revisar-clips (revision-clips.json)

function revisarClips(t) {
  const carpeta = carpetaDe(t);
  const archivo = archivoDe(t);
  const m = manifiestoDe(carpeta);
  const seccion = (t.split('## Los clips')[1] || '').split(/\n## /)[0];
  const clips = [];
  const bien = [];
  const bienBroll = [];
  const malBroll = [];
  const modoBroll = String(process.env.FALSO_BROLL || '').split(',').map((s) => s.trim());
  const siempreMal = new Set(modoBroll.filter((s) => /^\d+$/.test(s)).map(Number));
  const conImagenN = new Set(String(process.env.FALSO_BROLL_IMAGEN || '').split(',').filter((s) => /^\d+$/.test(s.trim())).map(Number));
  let unoMarcado = false;
  for (const b of seccion.split(/\n(?=- (?:Toma|B-roll) \d+)/)) {
    const br = b.match(/^\s*- B-roll (\d+)/);
    if (br) {
      const tira = b.match(/Tira del clip[^:]*: (\S+\.jpg)/);
      if (tira) usar('Read', { file_path: tira[1] });
      const n = Number(br[1]);
      const x = (m.broll || []).find((y) => y.n === n);
      const porUno = modoBroll.includes('uno') && !unoMarcado && !/Ya se rehizo/.test(b);
      const mal = x && (siempreMal.has(n) || porUno);
      if (!mal) {
        bienBroll.push(n);
        continue;
      }
      if (porUno && !siempreMal.has(n)) unoMarcado = true;
      if (/ya no se rehace más/.test(b)) {
        malBroll.push({ toma: n, motivo: 'Prueba: la etiqueta del producto sigue borrándose a mitad del clip.' });
        continue;
      }
      const conImagen = conImagenN.has(n);
      const vez = (b.match(/Ya se rehizo (\d+|una) ve/) || [])[1];
      const marca = vez ? ` (try ${vez === 'una' ? 2 : Number(vez) + 1})` : '';
      clips.push({
        toma: n,
        broll: true,
        rehacer: conImagen ? 'toma' : 'clip',
        motivo: 'Prueba: a mitad del clip a la etiqueta del producto se le borran las letras y aparece otra cara.',
        prompt_video: `${x.prompt_video}\nThe product stays rigid and unchanged the whole shot: same label, same shape; no new faces appear.${marca}`,
        ...(conImagen ? { prompt_imagen: sumar(x.prompt_imagen, `The product label is sharp and exactly as in the reference photo.${marca}`) } : {}),
      });
      continue;
    }
    const tm = b.match(/^\s*- Toma (\d+)/);
    if (!tm) continue;
    const tira = b.match(/Tira del clip[^:]*: (\S+\.jpg)/);
    if (tira) usar('Read', { file_path: tira[1] });
    const n = Number(tm[1]);
    const x = (m.tomas || []).find((y) => y.n === n);
    if (x && /NO DIJO SU FRASE LIMPIA/.test(b)) clips.push({ toma: n, rehacer: 'clip', motivo: 'No dijo su frase limpia: se rehace el clip.', prompt_video: `${x.prompt_video}\nThe character says the line only once, word for word, and then stays quiet.` });
    else bien.push(n);
  }
  escribir(archivo, { clips, bien, bien_broll: bienBroll, ...(malBroll.length ? { mal_broll: malBroll } : {}) });
}

// ---------------------------------------------------------------- la sesion

let textoTarea = '';
async function alMensaje(texto) {
  const primero = !textoTarea;
  if (primero) textoTarea = texto;
  emitir({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: String(val('--tools') || '').split(',').filter(Boolean), model: 'claude-falso', permissionMode: val('--permission-mode'), apiKeySource: 'none', claude_code_version: '2.1.288', mcp_servers: [] });
  const t = textoTarea;
  try {
    if (primero || /corrig/i.test(texto)) {
      if (/^TAREA: revisar las im/m.test(t)) revisionImagenes(t);
      else if (/^TAREA: rechazo/m.test(t)) rechazo(t);
      else if (/^TAREA: revisar-clips/m.test(t)) revisarClips(t);
    }
  } catch (e) {
    process.stderr.write(String(e?.stack || e));
    return emitir({ type: 'result', subtype: 'error_during_execution', is_error: true, result: String(e?.message || e), num_turns: 1 });
  }
  emitir({ type: 'result', subtype: 'success', is_error: false, result: 'LISTO', num_turns: 3, total_cost_usd: 0, duration_ms: 50, usage: { input_tokens: 10, output_tokens: 10 }, permission_denials: [] });
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

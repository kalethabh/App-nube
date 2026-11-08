// Un "claude" falso para las tareas de produccion de los cantados (tomas del musical, tomas de la historia, revision
// de imagenes, letra rechazada). Imita el stream-json de Claude Code como app/server/claude/pruebas/claude-falso.js.
// Escribe el manifiesto a partir de cancion/lineas.txt y app/tiempos-por-linea.txt (lo que deja la app), con los
// prompts de un manifiesto real como plantilla. Nunca llama a nadie.
//   FALSO_REVISION=uno   la revision pide rehacer la primera toma de su lote (si no, [])
// (Lo lanza claude-falso.js, que reparte cada tarea a su falso: ANUNCIOS_CLAUDE_BIN apunta siempre a claude-falso.js.)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..'); // la raiz del proyecto
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
if (process.env.FALSO_ARGS) fs.appendFileSync(process.env.FALSO_ARGS, JSON.stringify({ args }) + '\n');

const sesion = val('--resume') || val('--session-id') || '00000000-0000-0000-0000-000000000000';
const emitir = (o) => process.stdout.write(JSON.stringify({ session_id: sesion, ...o }) + '\n');
let id = 0;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const usar = async (name, input) => {
  const tid = `toolu_${++id}`;
  emitir({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: tid, name, input }] } });
  await dormir(5);
  emitir({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: tid, content: 'ok' }] } });
};
const leer = (rel) => JSON.parse(fs.readFileSync(path.join(RAIZ, rel), 'utf8'));
const escribir = (rel, d) => {
  const abs = path.join(RAIZ, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, typeof d === 'string' ? d : JSON.stringify(d, null, 2) + '\n', 'utf8');
};
const r1 = (x) => Math.round(x * 10) / 10;

/** Las ventanas de la tabla de --lineas, en orden. */
function ventanas(slug) {
  const t = fs.readFileSync(path.join(RAIZ, 'temp', slug, 'app', 'tiempos-por-linea.txt'), 'utf8');
  return [...t.matchAll(/^\s+(\d+)\s+([\d.]+)s\s+([\d.]+)s\s+([\d.]+)s\s+(\d+)\s/gm)].map((m) => Number(m[4]));
}

async function tomas(texto, historia) {
  const slug = texto.match(/Carpeta del anuncio: temp\/(\S+)/)[1];
  const estilo = historia ? 'historias-musicales' : texto.match(/`"estilo": "([a-z-]+)"`/)[1];
  const tpl = leer(historia ? 'temp/goli-immune-historia-musical/manifiesto.json' : 'temp/kovacol-drenaje-linfatico/manifiesto.json');
  await usar('Read', { file_path: path.join(RAIZ, '.claude', 'skills', historia ? 'anuncios-historias-musicales' : `anuncios-${estilo}`, 'SKILL.md') });
  await usar('Read', { file_path: path.join(RAIZ, 'temp', slug, 'app', 'tiempos-por-linea.txt') });
  const lineas = fs.readFileSync(path.join(RAIZ, 'temp', slug, 'cancion', 'lineas.txt'), 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const v = ventanas(slug);
  const foto = fs.readdirSync(path.join(RAIZ, 'temp', slug)).find((n) => /^producto\./.test(n));
  const ids = new Set(tpl.referencias.map((r) => r.id));
  const tomas = lineas.map((linea, i) => {
    const base = tpl.tomas[i % tpl.tomas.length];
    const tipo = base.tipo === 'B' && historia ? 'B' : base.tipo === 'C' ? 'C' : 'A';
    return {
      n: i + 1,
      tipo,
      duracion: r1(Math.min(9.9, Math.max(1, v[i] || 3))),
      linea,
      prompt_imagen_inicial: base.prompt_imagen_inicial,
      prompt_imagen_final: tipo === 'B' ? base.prompt_imagen_final : null,
      prompt_video: base.prompt_video,
      referencias: (base.referencias || []).filter((x) => ids.has(x)),
    };
  });
  const broll = [];
  if (!historia) {
    for (const t of tomas) {
      if (broll.length >= 3 || /^\[/.test(t.linea)) continue;
      const w = v[t.n - 1];
      if (w > 3.6 && w < 6.4) {
        const b = tpl.broll[broll.length % tpl.broll.length];
        broll.push({ n: t.n, despues_de_toma: t.n, sincroniza_con: t.linea, duracion: 4, prompt_imagen: b.prompt_imagen, prompt_video: b.prompt_video, referencias: [] });
      }
    }
  }
  const referencias = tpl.referencias.map((r) => (r.tipo === 'producto' ? { ...r, archivo: foto } : r)).filter((r) => r.tipo !== 'producto' || foto);
  const m = {
    estilo,
    modo_audio: 'musica',
    mercado: tpl.mercado,
    idioma: tpl.idioma,
    aspect_ratio: '9:16',
    ...(historia ? { clips_mudos: true } : {}),
    referencias,
    tomas,
    broll,
    overlays: [],
  };
  escribir(`temp/${slug}/manifiesto.json`, m);
  await usar('Write', { file_path: path.join(RAIZ, 'temp', slug, 'manifiesto.json') });
  if (historia) {
    escribir(`temp/${slug}/datos-editor.md`, '# Datos para el editor\n\n| Texto | Toma | Momento |\n|---|---|---|\n| 2x1 + envío gratis | 1 | desde el inicio |\n| Semana 3 | 30 | al entrar la toma |\n');
    await usar('Write', { file_path: path.join(RAIZ, 'temp', slug, 'datos-editor.md') });
  }
  await usar('PowerShell', { command: `node produccion/validar-manifiesto.js temp/${slug}/manifiesto.json` });
  await usar('PowerShell', { command: `node produccion/tiempos-cancion.js temp/${slug}` });
  return 'LISTO';
}

async function revision(texto) {
  const salida = texto.match(/Escribe (temp\/\S+\/app\/revision\/lote-\d+\.json)/)[1];
  const tomasLote = [...texto.matchAll(/^- toma (\d+) \(tipo ([ABC])\)/gm)].map((m) => ({ n: Number(m[1]), tipo: m[2] }));
  const slug = salida.split('/')[1];
  const m = leer(`temp/${slug}/manifiesto.json`);
  for (const t of tomasLote.slice(0, 3)) await usar('Read', { file_path: path.join(RAIZ, 'temp', slug, 'img', `toma-${t.n}-inicial.png`) });
  let lista = [];
  if (process.env.FALSO_REVISION === 'uno' && tomasLote.length) {
    const t = m.tomas.find((x) => x.n === tomasLote[1]?.n) || m.tomas.find((x) => x.n === tomasLote[0].n);
    lista = [
      {
        toma: t.n,
        motivo: 'Prueba: la mano salió con dedos de más.',
        promptsNuevos: { prompt_imagen_inicial: `${t.prompt_imagen_inicial} Hands relaxed and out of frame.`, ...(t.tipo === 'B' ? { prompt_imagen_final: `${t.prompt_imagen_final} Hands out of frame.` } : {}), prompt_video: `${t.prompt_video} Gentle motion.` },
      },
    ];
  }
  escribir(salida, lista);
  await usar('Write', { file_path: path.join(RAIZ, salida) });
  return 'LISTO';
}

async function letra(texto) {
  const slug = texto.match(/Carpeta del anuncio: temp\/(\S+)/)[1];
  const rel = `temp/${slug}/cancion/peticion.json`;
  const p = leer(rel);
  const lineas = p.letra.split('\n');
  const i = lineas.findIndex((l) => l.trim() && !/^\s*\[/.test(l));
  const antes = lineas[i];
  const despues = `${antes.replace(/[.,]?$/, '')} hoy mismo.`;
  lineas[i] = despues;
  const nueva = lineas.join('\n');
  if (Array.isArray(p.bloques)) p.bloques = p.bloques.map((b) => (b.includes(antes) ? b.replace(antes, despues) : b));
  escribir(rel, { ...p, letra: nueva });
  escribir(`temp/${slug}/app/letra-cambios.json`, [{ antes, despues }]);
  await usar('Edit', { file_path: path.join(RAIZ, rel) });
  return 'LISTO';
}

let tarea = null;
let textoTarea = '';
async function alMensaje(texto) {
  const primero = !tarea;
  if (primero) {
    textoTarea = texto;
    tarea = /TAREA: tomas del musical/.test(texto) ? 'musical' : /TAREA: tomas de la historia musical/.test(texto) ? 'historia' : /TAREA: revisar las im/.test(texto) ? 'revision' : /TAREA: cambiar la frase/.test(texto) ? 'letra' : 'otra';
    emitir({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: String(val('--tools') || '').split(',').filter(Boolean), model: 'claude-falso', permissionMode: val('--permission-mode'), apiKeySource: 'none', claude_code_version: '2.1.288', mcp_servers: [] });
  } else emitir({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: [], model: 'claude-falso' });
  await dormir(5);
  let r = 'LISTO';
  if (primero) {
    if (tarea === 'musical') r = await tomas(textoTarea, false);
    else if (tarea === 'historia') r = await tomas(textoTarea, true);
    else if (tarea === 'revision') r = await revision(textoTarea);
    else if (tarea === 'letra') r = await letra(textoTarea);
  } else if (process.env.FALSO_LOG) fs.appendFileSync(process.env.FALSO_LOG, `correccion: ${texto.slice(0, 2000)}\n`);
  emitir({ type: 'result', subtype: 'success', is_error: false, result: r, num_turns: 3, total_cost_usd: 0, duration_ms: 100, usage: {}, permission_denials: [] });
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

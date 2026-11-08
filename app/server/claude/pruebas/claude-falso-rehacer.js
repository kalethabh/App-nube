// Claude falso para PROBAR "Rehacer con IA" sin gastar el plan de nadie (solo para esta prueba).
// La tarea "rehacer" (TAREA: rehacer) la contesta aca: lee el manifiesto y escribe prompts apenas distintos en el
// archivo que pide la tarea. Cualquier otra cosa (version, auth status, otras tareas) la pasa al claude falso de
// la app (app/server/claude/pruebas/claude-falso.js), tal cual.
//   ANUNCIOS_CLAUDE_BIN=<esta ruta>
// (Lo lanza claude-falso.js, que reparte cada tarea a su falso: ANUNCIOS_CLAUDE_BIN apunta siempre a claude-falso.js.)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';
import { spawn } from 'node:child_process';

const FALSO = path.join(path.dirname(fileURLToPath(import.meta.url)), 'claude-falso.js'); // lo de siempre (FALSO_DESPACHADO=1: sin repartir)
const args = process.argv.slice(2);
const val = (f) => (args.indexOf(f) >= 0 ? args[args.indexOf(f) + 1] : null);
const delegar = (primeras = []) => {
  const h = spawn(process.execPath, [FALSO, ...args], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (const l of primeras) h.stdin.write(l + '\n');
  process.stdin.pipe(h.stdin);
  h.on('close', (c) => process.exit(c ?? 0));
};
if (args[0] === '--version' || args[0] === 'auth') delegar();
else {
  const sesion = val('--resume') || val('--session-id') || '00000000-0000-0000-0000-000000000000';
  const emitir = (o) => process.stdout.write(JSON.stringify({ session_id: sesion, ...o }) + '\n');
  const rl = readline.createInterface({ input: process.stdin });
  let primera = true;
  rl.on('line', (linea) => {
    if (!primera) return;
    primera = false;
    let texto = '';
    try {
      const ev = JSON.parse(linea);
      const c = ev.message?.content;
      texto = typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x?.text || '').join('\n') : '';
    } catch {
      /* nada */
    }
    if (!/TAREA: rehacer/.test(texto)) {
      rl.close();
      return delegar([linea]);
    }
    const carpeta = (texto.match(/Carpeta del anuncio: (.+)/) || [])[1]?.trim();
    const salida = (texto.match(/5\. Escribe (.+?) \(JSON/) || [])[1]?.trim();
    const ejemplo = JSON.parse((texto.match(/\n\s+(\{.*\})\n/) || [])[1] || '{}');
    const m = JSON.parse(fs.readFileSync(path.join(carpeta, 'manifiesto.json'), 'utf8'));
    const nb = texto.match(/rehacer el B-roll (\d+)/);
    const nt = texto.match(/rehacer (?:la toma|el bloque) (\d+)/);
    const pieza = nb ? m.broll.find((b) => b.n === Number(nb[1])) : m.tomas.find((t) => t.n === Number(nt[1]));
    const pedido = (texto.match(/con sus palabras: «(.+?)»/) || [])[1] || '';
    const nuevos = {};
    for (const k of Object.keys(ejemplo)) {
      if (k === 'motivo') nuevos.motivo = `Prueba del claude falso: ${pedido}`;
      else nuevos[k] = k === 'prompt_video' ? `${pieza[k]}\nThe camera moves closer, as requested: ${pedido}.` : `${pieza[k]} Closer framing, the product a bit larger.`;
    }
    emitir({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: String(val('--tools') || '').split(','), model: 'claude-falso', permissionMode: val('--permission-mode'), apiKeySource: 'none', claude_code_version: '2.1.288', mcp_servers: [] });
    emitir({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name: 'Read', input: { file_path: path.join(carpeta, 'manifiesto.json') } }] } });
    emitir({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'ok' }] } });
    fs.mkdirSync(path.dirname(salida), { recursive: true });
    fs.writeFileSync(salida, JSON.stringify(nuevos, null, 2), 'utf8');
    emitir({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_2', name: 'Write', input: { file_path: salida, content: '...' } }] } });
    emitir({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_2', content: 'ok' }] } });
    emitir({ type: 'result', subtype: 'success', is_error: false, result: 'LISTO', num_turns: 3, total_cost_usd: 0, duration_ms: 50, usage: { input_tokens: 10, output_tokens: 10 }, permission_denials: [] });
    setTimeout(() => process.exit(0), 50);
  });
}

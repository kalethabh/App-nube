// Un "claude" falso para las tres tareas de la familia continuidad (continuidad-imagenes, continuidad-pares,
// continuidad-cadena). Lo demas (--version, auth status, ficha, guion, cambios) lo hace el falso de la app:
// app/server/claude/pruebas/claude-falso.js, al que se le pasa todo tal cual.
//
//   ANUNCIOS_CLAUDE_BIN=<este archivo>   ANUNCIOS_REVISION_REAL=1
//   FALSO_CONT=imagenes:rehacer,pares:mal,cadena:rehacer     (por tarea: ok | rehacer | mal | nada | limite)
//
//   ok        imagenes y cadena: [] ; pares: los prompts bien escritos
//   rehacer   imagenes: pide rehacer una toma; cadena: pide rehacer el primer paso y el cierre
//   mal       la primera vez deja el archivo con un error (pares: sin la linea de cierre); al corregir, lo arregla
//   nada      no escribe nada (la app tiene que darse cuenta)
//   limite    "You've hit your session limit"
// Nunca llama a nadie.
// (Lo lanza claude-falso.js, que reparte cada tarea a su falso: ANUNCIOS_CLAUDE_BIN apunta siempre a claude-falso.js.)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';
import { spawn } from 'node:child_process';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..'); // la raiz del proyecto
const ORIGINAL = path.join(path.dirname(fileURLToPath(import.meta.url)), 'claude-falso.js'); // lo de siempre (FALSO_DESPACHADO=1: sin repartir)
const args = process.argv.slice(2);
const val = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};

// --version y auth status: el de la app
if (args[0] === '--version' || args[0] === 'auth') {
  const h = spawn(process.execPath, [ORIGINAL, ...args], { stdio: 'inherit' });
  h.on('exit', (c) => process.exit(c ?? 0));
} else {
  principal();
}

function principal() {
  const sesion = val('--resume') || val('--session-id') || '00000000-0000-0000-0000-000000000000';
  const emitir = (o) => process.stdout.write(JSON.stringify({ session_id: sesion, ...o }) + '\n');
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  let id = 0;
  const usar = async (name, input) => {
    const tid = `toolu_${++id}`;
    emitir({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: tid, name, input }] } });
    await dormir(5);
    emitir({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: tid, content: 'ok' }] } });
  };
  const resultado = (r = 'LISTO') => emitir({ type: 'result', subtype: 'success', is_error: false, result: r, num_turns: 6, total_cost_usd: 0, duration_ms: 50, usage: {}, permission_denials: [] });
  const modos = Object.fromEntries(
    String(process.env.FALSO_CONT || '')
      .split(',')
      .filter(Boolean)
      .map((x) => x.split(':'))
  );
  const escribir = (abs, datos) => {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(datos, null, 2) + '\n', 'utf8');
  };

  let tarea = null;
  let primero = null;
  let delegado = null;
  let intento = 0;
  // cuantas veces se lanzo esta tarea en este anuncio (para "mal": la primera sesion falla, la correccion arregla)
  async function alMensaje(texto) {
    intento++;
    if (!tarea) {
      tarea = (texto.match(/TAREA: (continuidad-\w+)/) || [])[1] || null;
      primero = texto;
      if (!tarea) return delegar(texto);
    }
    const que = tarea.replace('continuidad-', '');
    const modo = modos[que] || 'ok';
    const carpeta = (primero.match(/Carpeta del anuncio: (.+)/) || [])[1].trim();
    emitir({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: String(val('--tools') || '').split(','), model: 'claude-falso-continuidad', permissionMode: val('--permission-mode'), apiKeySource: 'none' });
    if (modo === 'limite') {
      emitir({ type: 'rate_limit_event', rate_limit_info: { status: 'rejected', resetsAt: Math.floor(Date.now() / 1000) + 3600, rateLimitType: 'five_hour' } });
      return emitir({ type: 'result', subtype: 'success', is_error: true, result: "You've hit your session limit · resets 3pm", num_turns: 1 });
    }
    const man = JSON.parse(fs.readFileSync(path.join(carpeta, 'manifiesto.json'), 'utf8'));
    await usar('Read', { file_path: path.join(carpeta, 'manifiesto.json') });
    // "mira" las imagenes que nombra la tarea
    for (const ruta of [...primero.matchAll(/([A-Z]:[\\/][^\s"]+\.(?:png|jpg))/g)].map((x) => x[1]).slice(0, 6)) await usar('Read', { file_path: ruta });
    if (modo === 'nada') return resultado();

    if (que === 'imagenes') {
      const t = man.tomas.find((x) => x.tipo === 'A' && x.n > 2);
      const lista = modo === 'rehacer' ? [{ toma: t.n, motivo: 'La etiqueta del frasco salió con letras inventadas.', promptsNuevos: { prompt_imagen_inicial: `${t.prompt_imagen_inicial} The jar label shows only the brand name, clean and readable.`, prompt_video: t.prompt_video } }] : [];
      escribir(path.join(carpeta, 'app', 'revision.json'), lista);
      await usar('Write', { file_path: path.join(carpeta, 'app', 'revision.json') });
    } else if (que === 'pares') {
      const fam = await import(`file:///${RAIZ}/app/server/lib/familias/continuidad.js`);
      await usar('Read', { file_path: path.join(carpeta, 'app', 'continuidad', 'pares.txt') });
      const lista = (primero.match(/Estos pasos, todos y en este orden: (.+)\./) || [])[1] || '';
      const pedidos = [...lista.matchAll(/(\d+)->(\d+) \((\d+)s\)/g)].map((x) => ({ de: Number(x[1]), a: Number(x[2]), duracion: Number(x[3]) }));
      const datos = fam.pasosSimulados(man, pedidos);
      for (const p of datos.pasos) {
        const t = man.tomas.find((x) => x.n === p.de);
        // escrito "mirando": la primera frase describe la imagen de salida con la linea de la toma
        p.prompt_video = p.prompt_video.replace('It starts exactly on the START frame.', `It starts exactly on the START frame: the scene of "${String(t.linea).slice(0, 60)}".`);
        p.forma = ['recorrer', 'entorno', 'rodear'][p.de % 3];
      }
      if (modo === 'mal' && intento === 1) datos.pasos[0].prompt_video = datos.pasos[0].prompt_video.replace('One continuous shot, no cuts or wipes. ', '');
      escribir(path.join(carpeta, 'app', 'continuidad', 'pasos.json'), datos);
      await usar('Write', { file_path: path.join(carpeta, 'app', 'continuidad', 'pasos.json') });
    } else if (que === 'cadena') {
      const lista = [];
      if (modo === 'rehacer' || (modo === 'mal' && intento > 1)) {
        const p = man.continuidad.pasos[0];
        const lineas = p.prompt_video.split('\n');
        lineas.splice(2, 0, 'She walks at a calm, steady pace, and the camera follows at her shoulder height.');
        lista.push({ clip: `paso-${p.de}`, motivo: 'El video no llegaba a la imagen siguiente: se cortaba antes.', forma: p.forma || 'recorrer', prompt_video: lineas.join('\n') });
        const ultima = man.tomas[man.tomas.length - 1];
        lista.push({ clip: `toma-${ultima.n}`, motivo: 'La cara del personaje cambiaba en el camino.', prompt_video: `${ultima.prompt_video}\nHer face, hair and clothes stay exactly the same the whole time.` });
      }
      if (modo === 'mal' && intento === 1) lista.push({ clip: 'paso-999', motivo: 'no existe', prompt_video: 'x'.repeat(50) });
      escribir(path.join(carpeta, 'app', 'continuidad', 'cadena.json'), lista);
      await usar('Write', { file_path: path.join(carpeta, 'app', 'continuidad', 'cadena.json') });
    }
    resultado();
  }

  // Una tarea que no es de continuidad: la hace el falso de la app (se le reenvia todo).
  function delegar(texto) {
    if (!delegado) {
      delegado = spawn(process.execPath, [ORIGINAL, ...args], { stdio: ['pipe', 'inherit', 'inherit'] });
      delegado.on('exit', (c) => process.exit(c ?? 0));
    }
    delegado.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: texto } }) + '\n');
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
    if (delegado) return delegado.stdin.write(linea + '\n');
    cola = cola.then(() => alMensaje(texto));
  });
  rl.on('close', () =>
    cola.then(() => {
      if (delegado) delegado.stdin.end();
      else process.exit(0);
    })
  );
}

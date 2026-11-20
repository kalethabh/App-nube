// Prueba de unidad SIN RED de lib/codex.js (el motor ChatGPT, §2 de DISENO-motor-codex.md) contra el Codex falso
// (app/server/claude/pruebas/codex-falso.js), en todos sus modos (§6.1), cada uno con lo que §6.2 dice que tiene que
// pasar. No llama a nadie de verdad ni gasta nada: el falso imita al binario y las respuestas salen de este mismo
// archivo, que hace de "Claude falso" para su puente (FALSO_CODEX_CLAUDE) con 6 tareas sinteticas chicas:
//   unidad-a  escribe 3 JSON nuevos (app/a.json, a2.json y a3.json)
//   unidad-b  cambia un archivo que ya existe con ediciones (app/b.json, con CRLF); su verificar falla la primera vez
//   unidad-c  escribe manifiesto.json y lo valida con `node produccion/validar-manifiesto.js …` (no gasta nada)
//   unidad-d  otra tarea sobre el hilo de unidad-a (la retoma)
//   unidad-k  «cambios» a manifiesto.json (el control de tomas tocadas)
//   unidad-m  50 imagenes (van en 2 mensajes)
//
//   node app/herramientas/codex/unidad-codex.mjs        sale con 0 si todo paso y con 1 si algo fallo
//
// Todo lo crea en temp/_codex-unidad-motor/ (el CODEX_HOME de la prueba es temp/_codex-unidad-motor/home) y lo borra al
// final. Nunca abre un .env ni app/config.json: de esos solo mira si existen, su tamaño y su fecha (modo `fuera`).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const ESTE = fileURLToPath(import.meta.url);
const AQUI = path.dirname(ESTE);
const APP = path.resolve(AQUI, '..', '..');
const RAIZ = path.resolve(APP, '..');
const D = 'temp/_codex-unidad-motor';
const DIR = path.join(RAIZ, 'temp', '_codex-unidad-motor');
const HOME = path.join(DIR, 'home');
const REG = path.join(DIR, 'registro');
const MENSAJES_CLAUDE = path.join(REG, 'claude-mensajes.jsonl');
const abs = (rel) => path.join(RAIZ, ...rel.split('/'));
const json = (v) => `${JSON.stringify(v, null, 2)}\n`;

// ---------------------------------------------------------------- lo que escriben las tareas (lo comparten las dos mitades)

const DATOS = { valor: 'té de prueba ñandú', n: 3 };
// (con un texto de dos párrafos, como el «Negative prompt:» de los manifiestos: lo usa el modo saltos-json del falso)
const contenidoA = (archivo, datos) =>
  json({ tarea: 'unidad-a', archivo, valor: datos.valor, lineas: Array.from({ length: 8 }, (_, i) => `línea ${i + 1} de ${archivo}: ${datos.valor}`), prompt: `imagen de prueba de ${archivo}\n\nNegative prompt: nada raro`, cierre: true });
const B_ORIGINAL = [
  '{',
  '  "tomas": [',
  '    { "n": 1, "prompt_video": "igual 1", "revisado": false },',
  '    { "n": 2, "prompt_video": "viejo 2", "revisado": false },',
  '    { "n": 3, "prompt_video": "igual 3", "revisado": false }',
  '  ],',
  '  "nota": "lo que no se toca queda igual",',
  '  "fin": true',
  '}',
  '',
].join('\r\n');
const B_CAMBIO = ['"prompt_video": "viejo 2"', '"prompt_video": "nuevo 2"'];
const B_CORRECCION = ['"prompt_video": "nuevo 2", "revisado": false', '"prompt_video": "nuevo 2", "revisado": true'];
const B_FINAL = B_ORIGINAL.replace(B_CAMBIO[0], B_CAMBIO[1]).replace(B_CORRECCION[0], B_CORRECCION[1]);
const MANIFIESTO_C = json({ estilo: 'prueba', tomas: [{ n: 1, linea: 'Hola', prompt_video: 'uno' }, { n: 2, linea: 'Chau', prompt_video: 'dos' }] });
const K_CAMBIO = ['"linea": "Hola"', '"linea": "Hola, mundo"'];
// unos 300 KB con tildes, eñes y comillas: la respuesta cruza varios cortes de 64 KB del tubo
// (casi todo de 2 y 3 bytes: cada corte cae dentro de una letra la mitad de las veces)
const U_CONTENIDO = json({ tarea: 'unidad-u', lineas: Array.from({ length: 3000 }, (_, i) => `«Acción ${i}»: ¿qué alegría, ñandú? — ${'ñáéíóú«»'.repeat(6)}`) });

// ---------------------------------------------------------------- el Claude falso (lo lanza el puente del Codex falso)

function claudeFalso() {
  const emitir = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);
  const dentro = (rel) => {
    const a = path.resolve(abs(rel));
    if (!a.toLowerCase().startsWith(`${DIR.toLowerCase()}${path.sep}`)) throw new Error(`fuera de la carpeta de la prueba: ${rel}`);
    return a;
  };
  const escribir = (rel, texto, escritos) => {
    const a = dentro(rel);
    let actual = null;
    try {
      actual = fs.readFileSync(a, 'utf8');
    } catch {
      /* nuevo */
    }
    if (actual === texto) return;
    fs.mkdirSync(path.dirname(a), { recursive: true });
    fs.writeFileSync(a, texto);
    escritos.push(a);
  };
  const reemplazar = (rel, [de, a], escritos) => {
    let t;
    try {
      t = fs.readFileSync(dentro(rel), 'utf8');
    } catch {
      return;
    }
    if (t.includes(de)) escribir(rel, t.replace(de, a), escritos);
  };
  let tarea = null;
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', (l) => {
    let m;
    try {
      m = JSON.parse(l);
    } catch {
      return;
    }
    if (m?.type !== 'user') return;
    const texto = typeof m.message?.content === 'string' ? m.message.content : '';
    const nueva = /^TAREA: (unidad-[a-z]+)/m.exec(texto)?.[1];
    if (nueva) tarea = nueva;
    try {
      fs.mkdirSync(REG, { recursive: true });
      fs.appendFileSync(MENSAJES_CLAUDE, `${JSON.stringify({ tarea, texto: texto.slice(0, 6000) })}\n`);
    } catch {
      /* sin registro */
    }
    const escritos = [];
    const correccion = texto.includes('La app revisó lo que escribiste');
    try {
      if (tarea === 'unidad-a' && nueva) {
        const datos = JSON.parse(fs.readFileSync(dentro(`${D}/datos.json`), 'utf8'));
        for (const x of ['a', 'a2', 'a3']) escribir(`${D}/app/${x}.json`, contenidoA(x, datos), escritos);
      } else if (tarea === 'unidad-b') {
        if (nueva) reemplazar(`${D}/app/b.json`, B_CAMBIO, escritos);
        if (correccion) reemplazar(`${D}/app/b.json`, B_CORRECCION, escritos);
      } else if (tarea === 'unidad-o') {
        // como unidad-b, sobre un archivo que la tarea puede editar pero no leer (o.json)
        if (nueva) reemplazar(`${D}/app/o.json`, B_CAMBIO, escritos);
        if (correccion) reemplazar(`${D}/app/o.json`, B_CORRECCION, escritos);
      } else if (tarea === 'unidad-c' && nueva) escribir(`${D}/manifiesto.json`, MANIFIESTO_C, escritos);
      else if (tarea === 'unidad-d' && nueva) escribir(`${D}/app/d.json`, json({ tarea: 'unidad-d', ok: true }), escritos);
      else if (tarea === 'unidad-k' && nueva) reemplazar(`${D}/manifiesto.json`, K_CAMBIO, escritos);
      // unidad-n: el primer LISTO no cambia nada; hace el cambio cuando la app le dice «No cambiaste ningún archivo…»
      else if (tarea === 'unidad-n' && correccion && texto.includes('No cambiaste ningún archivo')) reemplazar(`${D}/manifiesto.json`, K_CAMBIO, escritos);
      else if (tarea === 'unidad-m' && nueva) escribir(`${D}/app/m.json`, json({ tarea: 'unidad-m', fotos: 50 }), escritos);
      else if (tarea === 'unidad-u' && nueva) escribir(`${D}/app/u.json`, U_CONTENIDO, escritos);
    } catch (e) {
      emitir({ type: 'result', subtype: 'error_during_execution', is_error: true, result: String(e.message) });
      return;
    }
    for (const f of escritos) emitir({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: crypto.randomUUID(), name: 'Write', input: { file_path: f } }] } });
    emitir({ type: 'result', subtype: 'success', is_error: false, result: 'LISTO', num_turns: 1 });
  });
  rl.on('close', () => process.exit(0));
}

// ---------------------------------------------------------------- la prueba

async function prueba() {
  const resultados = [];
  const check = (nombre, ok, detalle) => {
    resultados.push({ nombre, ok: Boolean(ok) });
    const d = !ok && detalle !== undefined ? `\n        -> ${String(typeof detalle === 'string' ? detalle : JSON.stringify(detalle)).slice(0, 1500)}` : '';
    console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${d}`);
    return Boolean(ok);
  };
  const seccion = (t) => console.log(`\n== ${t}`);
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const leerNotas = (f) =>
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
  const escribir = (rel, d) => {
    fs.mkdirSync(path.dirname(abs(rel)), { recursive: true });
    fs.writeFileSync(abs(rel), d);
  };
  const leer = (rel) => {
    try {
      return fs.readFileSync(abs(rel), 'utf8');
    } catch {
      return null;
    }
  };
  const borrar = (rel) => fs.rmSync(abs(rel), { force: true });
  /** Solo si existe, su tamaño y su fecha: nunca se abre (sirve para .env y app/config.json). */
  const huella = (a) => {
    try {
      const st = fs.statSync(a);
      return `${st.size}:${st.mtimeMs}`;
    } catch {
      return 'no existe';
    }
  };

  // ---- carpetas y entorno (antes de cargar la app: lee AIA_* y ANUNCIOS_* en cada llamada)
  const HABIA_TEMP = fs.existsSync(path.join(RAIZ, 'temp'));
  if (fs.existsSync(DIR)) fs.rmSync(DIR, { recursive: true, force: true }); // (de una corrida anterior de esta prueba)
  fs.mkdirSync(REG, { recursive: true });
  const HUELLA_CODEX_USUARIO = huella(path.join(os.homedir(), '.codex'));
  for (const k of ['HUMO_REGISTRO', 'FALSO_CODEX_MODO', 'FALSO_CODEX_CONFIG', 'FALSO_CODEX_LEER', 'FALSO_CODEX_LIMITE', 'FALSO_CODEX_TOKENS', 'FALSO_CODEX_DEMORA', 'FALSO_CODEX_LOGIN', 'FALSO_CODEX_PLAN', 'FALSO_CODEX_PLAN_VIEJO', 'FALSO_CODEX_CREDITOS', 'CODEX_HOME', 'AIA_MOTOR']) delete process.env[k];
  Object.assign(process.env, {
    ANUNCIOS_MODO_PRUEBA: '1',
    ANUNCIOS_CODEX_BIN: path.join(APP, 'server', 'claude', 'pruebas', 'codex-falso.js'),
    AIA_CODEX_HOME: HOME,
    FALSO_CODEX_CLAUDE: path.relative(RAIZ, ESTE).replace(/\\/g, '/'),
    FALSO_CODEX_SESION: 'ok',
    FALSO_CODEX_PAUSA: '20',
    FALSO_CODEX_LOGIN_MS: '300',
    AIA_CODEX_LIMPIEZA_MS: String(24 * 3600000), // la limpieza automatica no corre durante la prueba (se prueba aparte)
  });
  // claves de mentira en el entorno de la app: a Codex no le tiene que llegar ninguna
  const CLAVES = ['KIE_API_KEY', 'ELEVENLABS_API_KEY', 'OPENAI_API_KEY', 'CODEX_API_KEY', 'ANTHROPIC_API_KEY', 'AWS_SECRET_ACCESS_KEY', 'RUST_LOG'];
  for (const k of CLAVES) process.env[k] = 'falsa-unidad-codex';

  const codex = await import('../../server/lib/codex.js');
  const { prohibidasComunes, enTerminales } = await import('../../server/lib/claude.js');
  const { traducir } = await import('../../server/lib/ia/reglas.js');
  const { CONFIG_TOML } = await import('../../server/lib/codex-rutas.js');
  const fila = await import('../../server/lib/ia/fila.js');
  const M = codex.MENSAJES;

  // ---- los archivos de las tareas
  escribir(`${D}/datos.json`, json(DATOS));
  escribir(`${D}/app/b.json`, B_ORIGINAL);
  escribir(`${D}/extra.md`, '# Extra\n\nAlgo que la tarea ofrece a pedido.\n');
  // uno grande a pedido (unos 11k tokens): pedirlo hace crecer la conversacion y arrancar de nuevo la achica
  escribir(`${D}/grande.md`, `# Grande\n\n${'Una línea larga de material a pedido para la prueba del tope.\n'.repeat(640)}`);
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const FOTOS = Array.from({ length: 50 }, (_, i) => `${D}/fotos/f${String(i + 1).padStart(2, '0')}.png`);
  for (const f of FOTOS) escribir(f, PNG);
  // los mios, para el modo fuera (estos si se comparan byte por byte)
  const MODELOS = '{ "de": "la prueba: la IA no lo puede pisar" }\n';
  escribir(`${D}/modelos.json`, MODELOS);
  escribir(`${D}/img/log-modelos.json`, MODELOS);

  // ---- las tareas
  const leerJSON = (rel) => {
    try {
      return JSON.parse(leer(rel));
    } catch {
      return null;
    }
  };
  const TAREAS = {
    a: () => {
      const contador = { n: 0 };
      return {
        contador,
        tipo: 'revision',
        prompt: `TAREA: unidad-a\nCarpeta del anuncio: ${D}\n\nLee \`${D}/datos.json\` y escribe tres archivos nuevos: \`${D}/app/a.json\`, \`${D}/app/a2.json\` y \`${D}/app/a3.json\`, cada uno con el JSON que dice la prueba. Responde LISTO.`,
        permitidas: [`Read(./${D}/**)`, `Write(./${D}/**)`],
        prohibidas: [...prohibidasComunes({ terminal: false }), `Edit(./${D}/app/conductor.json)`],
        material: { textos: [`${D}/datos.json`] },
        maxTurnos: 80,
        timeoutMs: 120000,
        verificar: async () => {
          contador.n++;
          const errores = [];
          for (const x of ['a', 'a2', 'a3']) {
            const t = leer(`${D}/app/${x}.json`);
            if (t === null) errores.push(`Falta ${x}.json.`);
            else if (t !== contenidoA(x, DATOS)) errores.push(`${x}.json no es el que pide la tarea (o no es JSON válido).`);
          }
          return { ok: !errores.length, errores };
        },
      };
    },
    b: () => {
      const contador = { n: 0 };
      return {
        contador,
        tipo: 'revision',
        prompt: `TAREA: unidad-b\nCarpeta del anuncio: ${D}\n\nCambia en \`${D}/app/b.json\` el \`prompt_video\` de la toma 2 a "nuevo 2", con Edit. No toques nada más. Responde LISTO.`,
        permitidas: [`Read(./${D}/**)`, `Edit(./${D}/app/b.json)`],
        prohibidas: prohibidasComunes({ terminal: false }),
        verificar: async () => {
          contador.n++;
          const t = leer(`${D}/app/b.json`);
          if (t === B_FINAL) return { ok: true };
          const errores = [];
          if (!t?.includes(B_CAMBIO[1])) errores.push('La toma 2 tiene que quedar con "prompt_video": "nuevo 2".');
          if (!t?.includes(B_CORRECCION[1])) errores.push('La toma 2 tiene que quedar con "revisado": true.');
          if (!errores.length) errores.push('Cambiaste algo que no se pidió.');
          return { ok: false, errores };
        },
      };
    },
    u: () => {
      const contador = { n: 0 };
      return {
        contador,
        tipo: 'revision',
        prompt: `TAREA: unidad-u\nCarpeta del anuncio: ${D}\n\nEscribe \`${D}/app/u.json\` con el texto largo que dice la prueba. Responde LISTO.`,
        permitidas: [`Read(./${D}/**)`, `Write(./${D}/app/u.json)`],
        prohibidas: prohibidasComunes({ terminal: false }),
        verificar: async () => {
          contador.n++;
          return leer(`${D}/app/u.json`) === U_CONTENIDO ? { ok: true } : { ok: false, errores: ['u.json no es el que pide la tarea.'] };
        },
      };
    },
    o: () => {
      const contador = { n: 0 };
      return {
        contador,
        tipo: 'revision',
        prompt: `TAREA: unidad-o\nCarpeta del anuncio: ${D}\n\nCambia en \`${D}/app/o.json\` el \`prompt_video\` de la toma 2 a "nuevo 2", con Edit. No toques nada más. Responde LISTO.`,
        permitidas: [`Read(./${D}/**)`, `Edit(./${D}/app/o.json)`],
        // (se puede editar pero no leer: el aviso de una edición que no se aplicó va sin el archivo)
        prohibidas: [...prohibidasComunes({ terminal: false }), `Read(./${D}/app/o.json)`],
        verificar: async () => {
          contador.n++;
          return leer(`${D}/app/o.json`) === B_FINAL ? { ok: true } : { ok: false, errores: ['La toma 2 tiene que quedar con "prompt_video": "nuevo 2" y "revisado": true.'] };
        },
      };
    },
    c: () => {
      const contador = { n: 0 };
      const cmd = `node produccion/validar-manifiesto.js ${D}/manifiesto.json`;
      return {
        contador,
        tipo: 'guion',
        prompt: `TAREA: unidad-c\nCarpeta del anuncio: ${D}\n\nEscribe \`${D}/manifiesto.json\` con dos tomas y valídalo con este comando:\n\n${cmd}\n\nResponde LISTO.`,
        permitidas: [`Read(./${D}/**)`, `Write(./${D}/manifiesto.json)`, ...enTerminales(cmd)],
        prohibidas: prohibidasComunes(),
        verificar: async () => {
          contador.n++;
          const m = leerJSON(`${D}/manifiesto.json`);
          return Array.isArray(m?.tomas) ? { ok: true } : { ok: false, errores: ['manifiesto.json no está o no tiene tomas.'] };
        },
      };
    },
    d: () => {
      const contador = { n: 0 };
      return {
        contador,
        tipo: 'revision',
        prompt: `TAREA: unidad-d\nCarpeta del anuncio: ${D}\n\nCon \`${D}/datos.json\`, escribe \`${D}/app/d.json\`. Responde LISTO.`,
        permitidas: [`Read(./${D}/**)`, `Write(./${D}/app/d.json)`],
        prohibidas: prohibidasComunes({ terminal: false }),
        verificar: async () => {
          contador.n++;
          return leerJSON(`${D}/app/d.json`)?.ok === true ? { ok: true } : { ok: false, errores: ['Falta d.json.'] };
        },
      };
    },
    k: () => {
      const contador = { n: 0 };
      return {
        contador,
        tipo: 'cambios',
        prompt: `TAREA: unidad-k\nCarpeta del anuncio: ${D}\n\nEl usuario leyó el guion en la app y pide esto, con sus palabras:\n\n«cambia la toma 1»\n\nCambia solo eso en \`${D}/manifiesto.json\`, con Edit. Responde LISTO.`,
        permitidas: [`Read(./${D}/**)`, `Edit(./${D}/manifiesto.json)`],
        prohibidas: prohibidasComunes({ terminal: false }),
        cambios: { pedido: 'cambia la toma 1', guionDelUsuario: true },
        verificar: async () => {
          contador.n++;
          const m = leerJSON(`${D}/manifiesto.json`);
          return m?.tomas?.[0]?.linea === 'Hola, mundo' && m?.tomas?.[1]?.linea === 'Chau' ? { ok: true } : { ok: false, errores: ['La toma 1 no quedó como se pidió.'] };
        },
      };
    },
    n: () => {
      const contador = { n: 0 };
      return {
        contador,
        tipo: 'cambios',
        prompt: `TAREA: unidad-n\nCarpeta del anuncio: ${D}\n\nEl usuario leyó el guion en la app y pide esto, con sus palabras:\n\n«cambia la toma 1»\n\nCambia solo eso en \`${D}/manifiesto.json\`, con Edit. Responde LISTO.`,
        permitidas: [`Read(./${D}/**)`, `Edit(./${D}/manifiesto.json)`],
        prohibidas: prohibidasComunes({ terminal: false }),
        cambios: { pedido: 'cambia la toma 1', guionDelUsuario: false },
        verificar: async () => {
          contador.n++;
          return Array.isArray(leerJSON(`${D}/manifiesto.json`)?.tomas) ? { ok: true } : { ok: false, errores: ['manifiesto.json no tiene tomas.'] };
        },
      };
    },
    m: () => {
      const contador = { n: 0 };
      return {
        contador,
        tipo: 'revision',
        prompt: `TAREA: unidad-m\nCarpeta del anuncio: ${D}\n\nMira las 50 fotos de \`${D}/fotos\` y escribe \`${D}/app/m.json\`. Responde LISTO.`,
        permitidas: [`Read(./${D}/**)`, `Write(./${D}/app/m.json)`],
        prohibidas: prohibidasComunes({ terminal: false }),
        material: { imagenes: FOTOS },
        verificar: async () => {
          contador.n++;
          return leerJSON(`${D}/app/m.json`)?.fotos === 50 ? { ok: true } : { ok: false, errores: ['Falta m.json.'] };
        },
      };
    },
  };
  const limpiarA = () => ['a', 'a2', 'a3'].forEach((x) => borrar(`${D}/app/${x}.json`));

  // ---- correr un escenario
  const todas = []; // las notas del falso de todos los escenarios
  const conEntorno = async (env, fn) => {
    const previos = {};
    for (const [k, v] of Object.entries(env)) {
      previos[k] = process.env[k];
      if (v === null || v === undefined) delete process.env[k];
      else process.env[k] = String(v);
    }
    try {
      return await fn();
    } finally {
      for (const [k, v] of Object.entries(previos)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  };
  const correr = async (nombre, { tarea = 'a', modo = 'ok', uuid = crypto.randomUUID(), env = {}, o = {} } = {}) => {
    const falsoArgs = path.join(REG, `${nombre}-falso.jsonl`);
    const registro = path.join(REG, `${nombre}-claude.jsonl`);
    const { contador, ...t } = TAREAS[tarea]();
    const frases = [];
    const t0 = Date.now();
    const r = await conEntorno({ FALSO_CODEX_MODO: modo, FALSO_ARGS: falsoArgs, ...env }, () => codex.lanzarSesion({ ...t, uuid, registro, alProgreso: (f) => frases.push(f), ...o }));
    const notas = leerNotas(falsoArgs);
    for (const n of notas) todas.push({ ...n, escenario: nombre });
    return { r, frases, notas, reg: leerNotas(path.join(REG, `${nombre}-codex.jsonl`)), uuid, ms: Date.now() - t0, verificaciones: contador.n };
  };
  const mensajes = (notas) => notas.filter((n) => n.tipo === 'codex-exec' || n.tipo === 'codex-resume');
  const deClase = (notas, clase, tipo = null) => mensajes(notas).filter((n) => n.clase === clase && (!tipo || n.tipo === tipo));
  const resumen = (x) => ({ ok: x.r.ok, error: x.r.error, detalle: String(x.r.detalle || '').slice(0, 400), mensajes: mensajes(x.notas).map((n) => `${n.tipo}:${n.clase}`), reg: x.reg.filter((l) => l.type === 'app' && !l.args && !l.material).map((l) => Object.keys(l).filter((k) => k !== 'type' && k !== 'momento').join(',')) });

  // ================================================================ 1. los textos y el esquema
  seccion('Los textos de §2.7 y el esquema de §2.8');
  const DC = path.join(APP, 'server', 'claude');
  const modoCodex = fs.readFileSync(path.join(DC, 'modo-app-codex.md'), 'utf8');
  check('modo-app-codex.md empieza con «# CÓMO TRABAJAS AQUÍ» y tiene los 8 puntos', /^# CÓMO TRABAJAS AQUÍ \(esto manda/.test(modoCodex) && /^8\. Si en esta conversación llega una TAREA nueva/m.test(modoCodex));
  check('tarea-resultado-codex.md, tarea-correccion-codex.md y tarea-cortada-codex.md existen', ['tarea-resultado-codex.md', 'tarea-correccion-codex.md', 'tarea-cortada-codex.md'].every((n) => fs.existsSync(path.join(DC, n))));
  const esq = JSON.parse(fs.readFileSync(path.join(DC, 'esquemas', 'codex-respuesta.json'), 'utf8'));
  check('El esquema pide los 6 campos, sin campos de más, y el enum de estado', esq.additionalProperties === false && ['estado', 'respuesta', 'archivos', 'ediciones', 'leer', 'comandos'].every((k) => esq.required.includes(k)) && esq.properties.estado.enum.join() === 'LISTO,BLOQUEADO,SEGUIR' && esq.properties.ediciones.items.additionalProperties === false);
  check('MENSAJES tiene los 12 textos de §2.21, el del plan sin Codex en un paso de la producción y los 2 del espacio de trabajo', Object.keys(M).length === 15 && M.espacioSinCreditos.includes('créditos') && M.limite.startsWith('Se acabó por ahora el uso de tu plan de ChatGPT.') && M.cancelado === 'Se canceló.' && M.planSinCodex.includes('"Reintentar"') && M.planSinCodexPaso.startsWith('Tu plan de ChatGPT no incluye Codex') && !/Reintentar/.test(M.planSinCodexPaso), Object.keys(M));
  check('Vuelve a exportar VERSION_CODEX, resolverCodex y olvidarCodex', codex.VERSION_CODEX === '0.167.0' && typeof codex.resolverCodex === 'function' && typeof codex.olvidarCodex === 'function');
  check('Ningún texto de pantalla dice «beta», «experimental» ni «motor»', !Object.values(M).some((t) => /\bbeta\b|experimental|\bmotor\b/i.test(t)));

  // ================================================================ 2. la cuenta
  seccion('La cuenta: estadoCodex');
  codex.olvidarEstadoCodex();
  let est = await conEntorno({ FALSO_ARGS: path.join(REG, 'estado-falso.jsonl') }, () => codex.estadoCodex());
  check('Con sesión: instalado, 0.167.0, sesion ok y el correo y el plan', est.instalado === true && est.version === '0.167.0' && est.sesion === 'ok' && est.cuenta?.email === 'alumno@ejemplo.com' && est.cuenta?.plan === 'plus' && !est.avisoPlan && !est.actualizar, est);
  check('Trae los límites (para la pantalla)', est.limites && est.limites.ordinario === true, est.limites);
  check('Escribió su config.toml en el CODEX_HOME de la prueba', fs.readFileSync(path.join(HOME, 'config.toml'), 'utf8') === CONFIG_TOML);
  const trabajo = path.join(DIR, 'codex-trabajo');
  check('La carpeta de trabajo existe y está vacía', fs.existsSync(trabajo) && fs.readdirSync(trabajo).length === 0);
  codex.olvidarEstadoCodex();
  est = await conEntorno({ FALSO_CODEX_PLAN: 'free' }, () => codex.estadoCodex());
  check('Con el plan Free: avisoPlan', est.sesion === 'ok' && est.avisoPlan === true && est.cuenta?.plan === 'free', est);
  codex.olvidarEstadoCodex();
  est = await conEntorno({ FALSO_CODEX_SESION: 'api' }, () => codex.estadoCodex());
  check('Con una clave de API: otraCuenta (y nada de la línea de login status)', est.sesion === 'sin-sesion' && est.otraCuenta === true && !JSON.stringify(est).includes('sk-falso'), est);
  codex.olvidarEstadoCodex();
  est = await conEntorno({ FALSO_CODEX_SESION: 'no' }, () => codex.estadoCodex());
  check('Sin sesión: sin-sesion', est.sesion === 'sin-sesion' && !est.otraCuenta && est.instalado === true, est);
  codex.olvidarEstadoCodex();
  est = await conEntorno({ ANUNCIOS_CODEX_BIN: path.join(DIR, 'no-existe', 'codex.exe') }, () => codex.estadoCodex());
  check('Sin el programa: instalado false y «Falta Codex en tu PC.»', est.instalado === false && est.motivo === 'Falta Codex en tu PC.', est);
  codex.olvidarEstadoCodex();
  {
    const x = await conEntorno({ ANUNCIOS_CODEX_BIN: path.join(DIR, 'no-existe', 'codex.exe') }, () => codex.lanzarSesion({ ...TAREAS.a(), uuid: crypto.randomUUID() }));
    check('lanzarSesion sin el programa: sinClaude y el texto de §2.21', x.ok === false && x.sinClaude === true && x.error === M.sinCodex && x.turnos === 0, x);
  }
  codex.olvidarEstadoCodex();
  {
    const x = await conEntorno({ FALSO_CODEX_SESION: 'no', FALSO_ARGS: path.join(REG, 'sin-cuenta-falso.jsonl') }, () => codex.lanzarSesion({ ...TAREAS.a(), uuid: crypto.randomUUID() }));
    check('lanzarSesion sin sesión: sinSesion, sin mandar ningún mensaje', x.ok === false && x.sinSesion === true && x.error === M.sinSesion && mensajes(leerNotas(path.join(REG, 'sin-cuenta-falso.jsonl'))).length === 0, x);
  }
  codex.olvidarEstadoCodex();
  {
    const x = await conEntorno({ FALSO_CODEX_SESION: 'api' }, () => codex.lanzarSesion({ ...TAREAS.a(), uuid: crypto.randomUUID() }));
    check('lanzarSesion con una clave de API: sinSesion con el texto de otraCuenta', x.ok === false && x.sinSesion === true && x.error === M.otraCuenta, x);
  }
  codex.olvidarEstadoCodex();

  // ================================================================ 3. las tareas, bien
  seccion('Una tarea que escribe JSON nuevos (unidad-a, modo ok)');
  limpiarA();
  const ok = await correr('ok', { tarea: 'a' });
  check('Termina ok, con LISTO', ok.r.ok === true && ok.r.resultado === 'LISTO' && ok.r.sesion === ok.uuid && ok.r.modo === 'nueva', resumen(ok));
  check('Escribió los 3 archivos tal como los devolvió Codex', ['a', 'a2', 'a3'].every((x) => leer(`${D}/app/${x}.json`) === contenidoA(x, DATOS)));
  check('Un solo mensaje (exec), sin resume', mensajes(ok.notas).length === 1 && ok.notas.some((n) => n.tipo === 'codex-exec' && n.clase === 'tarea'), mensajes(ok.notas).map((n) => n.tipo));
  check('El contrato de §2.19: turnos, costo 0, uso sumado, init de Codex, frases, duracionMs', ok.r.turnos === 1 && ok.r.costo === 0 && ok.r.uso.input_tokens > 0 && ok.r.uso.output_tokens > 0 && ok.r.init?.motor === 'codex' && ok.r.init?.permisos === 'app' && ok.r.duracionMs > 0 && Array.isArray(ok.r.denegados), ok.r);
  check('Frases: «ChatGPT empezó a trabajar» y una por archivo guardado', ok.frases[0] === 'ChatGPT empezó a trabajar' && ok.frases.includes('Guardando'), ok.frases);
  check('Esfuerzo high en una revisión (pruebas reales: con el medio no fueron estables)', mensajes(ok.notas)[0]?.esfuerzo === 'high');
  check('El plazo de un mensaje: 20 min en una revisión, 45 en el guion y en lo que pide esfuerzo alto', codex.plazoDeMensaje({ tipo: 'revision' }) === 20 * 60000 && codex.plazoDeMensaje({ tipo: 'ficha' }) === 20 * 60000 && codex.plazoDeMensaje({ tipo: 'guion' }) === 45 * 60000 && codex.plazoDeMensaje({ tipo: 'tomas' }) === 45 * 60000 && codex.plazoDeMensaje({ tipo: 'revision', esfuerzo: 'alto' }) === 45 * 60000);
  check('El mensaje trae MATERIAL, TAREA, LO QUE PUEDES ESCRIBIR y COMANDOS', Object.entries(mensajes(ok.notas)[0]?.partes || {}).filter(([k]) => ['material', 'tarea', 'escribir', 'comandos'].includes(k)).every(([, v]) => v));
  const regOk = ok.reg;
  const argsOk = regOk.find((l) => l.args)?.args || [];
  check('Registro en <nombre>-codex.jsonl: motor, banderas sin el MODO APP, material, cada línea de Codex y el fin', fs.existsSync(path.join(REG, 'ok-codex.jsonl')) && regOk.some((l) => l.motor === 'codex' && l.version === '0.167.0') && argsOk.some((a) => /^developer_instructions=<modo-app\.md \+ modo-app-codex\.md, \d+ caracteres>$/.test(a)) && regOk.some((l) => Array.isArray(l.material) && l.material.some((x) => x.ruta === `${D}/datos.json`)) && regOk.some((l) => l.type === 'thread.started') && regOk.some((l) => l.type === 'turn.completed') && regOk.some((l) => l.fin?.ok === true), regOk.map((l) => l.type + (l.fin ? ':fin' : '')));
  check('El registro nunca trae la clave de mentira', !fs.readFileSync(path.join(REG, 'ok-codex.jsonl'), 'utf8').includes('falsa-unidad-codex'));
  const hilos = JSON.parse(fs.readFileSync(path.join(HOME, 'anuncios-hilos.json'), 'utf8'));
  const hiloOk = hilos[ok.uuid];
  check('anuncios-hilos.json une el uuid con el hilo, con tokens, enviados (sha1) y escritos', hiloOk?.thread === mensajes(ok.notas)[0]?.hilo && hiloOk.tokens > 0 && /^[0-9a-f]{40}$/.test(hiloOk.enviados?.[`${D}/datos.json`] || '') && ['a', 'a2', 'a3'].every((x) => hiloOk.escritos.includes(`${D}/app/${x}.json`)), hiloOk);

  seccion('Por el selector (motor-ia) con ChatGPT elegido');
  const ia = await import('../../server/lib/motor-ia.js');
  await conEntorno({ AIA_MOTOR: 'codex', FALSO_ARGS: path.join(REG, 'selector-falso.jsonl') }, async () => {
    const e = await ia.estadoIA();
    check('estadoIA: ChatGPT, Codex instalado y con sesión, sin uso ni login abierto (no pregunta por Claude)', e.elegido === 'codex' && e.nombre === 'ChatGPT' && e.motores.codex?.instalado === true && e.motores.codex.sesion === 'ok' && e.motores.codex.enUso === false && !('claude' in e.motores) && e.login === null, e);
    limpiarA();
    const { contador, ...t } = TAREAS.a();
    const x = await ia.lanzarSesion({ ...t, uuid: crypto.randomUUID(), registro: path.join(REG, 'selector-claude.jsonl') });
    check('motor-ia.lanzarSesion va a codex.js y le agrega motor: codex', x.ok === true && x.motor === 'codex' && contador.n === 1 && mensajes(leerNotas(path.join(REG, 'selector-falso.jsonl'))).length === 1, x);
  });

  seccion('Otra tarea sobre el mismo hilo (la retoma)');
  borrar(`${D}/app/d.json`);
  const ret = await correr('retoma', { tarea: 'd', uuid: ok.uuid });
  const nRet = deClase(ret.notas, 'retoma', 'codex-resume');
  check('Va por exec resume, con «(Tarea nueva…», TAREA, LO QUE PUEDES ESCRIBIR y COMANDOS', ret.r.ok === true && ret.r.modo === 'resume' && nRet.length === 1 && nRet[0].deRetoma?.ok === true && nRet[0].hilo === hiloOk.thread, resumen(ret));
  check('Lo que Codex ya tenía y no cambió va como «(sin cambios desde la última vez: …)»', ret.reg.some((l) => l.clase === 'retoma' && l.sinCambios?.includes(`${D}/datos.json`)));
  check('Escribió d.json (lo que permite la tarea de ahora)', leerJSON(`${D}/app/d.json`)?.ok === true);

  seccion('Una tarea con un comando permitido (unidad-c)');
  borrar(`${D}/manifiesto.json`);
  const cmd = await correr('comando', { tarea: 'c' });
  const nCmd = cmd.notas.find((n) => n.comando);
  check('Termina ok', cmd.r.ok === true, resumen(cmd));
  check('El comando se pidió en `comandos` y la app devolvió lo que imprimió («### <comando> (terminó con código N)»)', nCmd?.comando?.devuelto === true && nCmd.tipo === 'codex-resume', nCmd);
  check('El registro anota el comando y su código', cmd.reg.some((l) => l.comando === `node produccion/validar-manifiesto.js ${D}/manifiesto.json` && Number.isInteger(l.codigo)), cmd.reg.filter((l) => l.comando));
  check('Frase del comando: «Revisando que el guion esté completo»', cmd.frases.includes('Revisando que el guion esté completo'), cmd.frases);
  check('Esfuerzo high en un guion', mensajes(cmd.notas)[0]?.esfuerzo === 'high');

  seccion('Cambiar un archivo con ediciones, con un verificar que falla la primera vez (unidad-b)');
  escribir(`${D}/app/b.json`, B_ORIGINAL);
  const edi = await correr('ediciones', { tarea: 'b' });
  check('Termina ok después de una corrección', edi.r.ok === true && edi.verificaciones === 2, resumen(edi));
  check('La corrección fue por exec resume, en el mismo hilo', deClase(edi.notas, 'correccion', 'codex-resume').length === 1);
  check('b.json quedó con los dos cambios y todo lo demás byte por byte (CRLF incluido)', leer(`${D}/app/b.json`) === B_FINAL);
  check('Llegaron como ediciones, no como el archivo entero', edi.notas.filter((n) => n.tipo === 'codex-respuesta').some((n) => n.ediciones?.includes(`${D}/app/b.json`)) && !edi.notas.some((n) => n.tipo === 'codex-respuesta' && n.archivos?.length), edi.notas.filter((n) => n.tipo === 'codex-respuesta').map((n) => ({ a: n.archivos, e: n.ediciones })));
  check('Frase «Corrigiendo lo que faltaba» y el registro con la corrección y lo editado', edi.frases.includes('Corrigiendo lo que faltaba') && edi.reg.some((l) => Array.isArray(l.correccion)) && edi.reg.some((l) => l.edito?.some((x) => x.ruta === `${D}/app/b.json`)));
  const msjClaude = () => leerNotas(MENSAJES_CLAUDE);
  check('El texto de la corrección es el de tarea-correccion-codex.md, con el error', msjClaude().some((m) => m.tarea === 'unidad-b' && m.texto.startsWith('La app revisó lo que escribiste y todavía no está bien:') && m.texto.includes('- La toma 2 tiene que quedar con "revisado": true.') && m.texto.includes('Corrígelo con `ediciones`')));

  seccion('«cambios»: el control de las tomas tocadas (unidad-k)');
  const cam = await correr('cambios', { tarea: 'k' });
  check('Termina ok', cam.r.ok === true, resumen(cam));
  check('Le mandó una sola vez «Cambiaste la toma 1. El usuario pidió: «cambia la toma 1»…» con lo de antes', deClase(cam.notas, 'tomasTocadas').length === 1 && msjClaude().some((m) => m.tarea === 'unidad-k' && m.texto.startsWith('Cambiaste la toma 1. El usuario pidió: «cambia la toma 1».') && m.texto.includes('El guion es del usuario') && m.texto.includes('===== ANTES: toma 1 =====')));
  check('No gastó una corrección y esfuerzo high', deClase(cam.notas, 'correccion').length === 0 && mensajes(cam.notas)[0]?.esfuerzo === 'high');
  // un LISTO que no cambió nada: una vez, «No cambiaste ningún archivo…» (sin gastar una corrección), y después el
  // control de las tomas tocadas del cambio que sí hizo
  escribir(`${D}/manifiesto.json`, MANIFIESTO_C);
  const sinCam = await correr('cambios-sin-cambiar', { tarea: 'n' });
  check('«cambios» con un LISTO sin cambiar nada: le dice una vez «No cambiaste ningún archivo y el usuario pidió…» y termina con el cambio hecho', sinCam.r.ok === true && sinCam.reg.filter((l) => l.sinCambios === true).length === 1 && msjClaude().some((m) => m.tarea === 'unidad-n' && m.texto.includes('No cambiaste ningún archivo y el usuario pidió: «cambia la toma 1»')) && leerJSON(`${D}/manifiesto.json`)?.tomas?.[0]?.linea === 'Hola, mundo' && deClase(sinCam.notas, 'tomasTocadas').length === 1, resumen(sinCam));
  // una tarea nueva sobre un hilo que ya no entra en el tope: conversación nueva SIN «(Esta tarea ya empezó…»
  const rutaHilos = path.join(HOME, 'anuncios-hilos.json');
  const uuidLleno = crypto.randomUUID();
  const hilosAntes = JSON.parse(fs.readFileSync(rutaHilos, 'utf8'));
  hilosAntes[uuidLleno] = { thread: crypto.randomUUID(), tipo: 'guion', creado: new Date().toISOString(), usado: new Date().toISOString(), tokens: 10000000, base: 9000, mensajes: 4, enviados: {}, escritos: [`${D}/app/a.json`] };
  fs.writeFileSync(rutaHilos, json(hilosAntes));
  escribir(`${D}/manifiesto.json`, MANIFIESTO_C);
  const lleno = await correr('hilo-lleno', { tarea: 'k', uuid: uuidLleno });
  check('Una tarea nueva sobre un hilo lleno va en una conversación nueva como primera vez (sin «Esta tarea ya empezó…» ni lo escrito antes)', lleno.r.ok === true && lleno.reg.some((l) => l.deNuevo === 'tope-de-contexto') && deClase(lleno.notas, 'deNuevo').length === 0 && deClase(lleno.notas, 'tarea', 'codex-exec').length === 1 && !lleno.reg.some((l) => l.clase === 'deNuevo'), resumen(lleno));
  const hilosDespues = JSON.parse(fs.readFileSync(rutaHilos, 'utf8'));
  delete hilosDespues[uuidLleno]; // (su hilo de mentira no se borra con la limpieza de más abajo)
  fs.writeFileSync(rutaHilos, json(hilosDespues));

  seccion('Una respuesta de 300 KB con tildes (unidad-u)');
  const utf = await correr('utf8-largo', { tarea: 'u' });
  const textoU = leer(`${D}/app/u.json`) || '';
  check('El archivo guardado es igual byte por byte, sin «�» (una letra partida entre dos trozos del tubo espera al siguiente)', utf.r.ok === true && utf.verificaciones === 1 && textoU === U_CONTENIDO && !textoU.includes('�'), { r: resumen(utf), bytes: Buffer.byteLength(textoU), rotas: (textoU.match(/�/g) || []).length });
  borrar(`${D}/app/u.json`);

  seccion('Más de 48 imágenes: 2 mensajes (modo muchas, unidad-m)');
  const mu = await correr('muchas', { tarea: 'm', modo: 'muchas' });
  const nMu = mensajes(mu.notas);
  check('Termina ok', mu.r.ok === true, resumen(mu));
  check('El primero lleva 48 con -i y «Faltan 2 imágenes»; el segundo, las 2 que faltan y «Ya tienes todas»', nMu.length === 2 && nMu[0].imagenes?.total === 48 && nMu[1].clase === 'imagenes' && nMu[1].imagenes?.total === 2 && nMu.every((n) => n.imagenes.listadas === n.imagenes.total && !n.imagenes.distintas.length), nMu.map((n) => ({ c: n.clase, i: n.imagenes })));
  check('La segunda tanda no cuenta como vuelta (un solo turno de trabajo, dos mensajes)', mu.r.turnos === 2);

  // ================================================================ 4. los modos del falso
  seccion('Modos que terminan bien');
  limpiarA();
  const mal = await correr('mal', { modo: 'mal' });
  check('mal: un archivo cortado, la corrección por resume lo arregla', mal.r.ok === true && mal.verificaciones === 2 && deClase(mal.notas, 'correccion', 'codex-resume').length === 1, resumen(mal));
  // el usage de Codex es el acumulado del hilo: el uso de la sesion es el ultimo acumulado, no la suma de los acumulados
  const tcMal = mal.reg.filter((l) => l.type === 'turn.completed' && l.usage);
  const ultMal = tcMal.at(-1)?.usage || {};
  const hMal = JSON.parse(fs.readFileSync(path.join(HOME, 'anuncios-hilos.json'), 'utf8'))[mal.uuid];
  check('mal: con 2 mensajes, r.uso es el último usage acumulado y anuncios-hilos.json guarda `acumulado`', tcMal.length >= 2 && mal.r.uso?.input_tokens === ultMal.input_tokens && mal.r.uso?.output_tokens === ultMal.output_tokens && hMal?.acumulado?.input_tokens === ultMal.input_tokens, { uso: mal.r.uso, ultimo: ultMal, turnos: tcMal.length, acumulado: hMal?.acumulado });
  limpiarA();
  const sj = await correr('sin-json', { modo: 'sin-json' });
  check('sin-json: «Tu respuesta no fue el JSON pedido…» y después bien', sj.r.ok === true && deClase(sj.notas, 'json', 'codex-resume').length === 1, resumen(sj));
  limpiarA();
  const pp = await correr('por-partes', { modo: 'por-partes' });
  check('por-partes: de a un archivo con SEGUIR; verificar una sola vez y sin correcciones', pp.r.ok === true && pp.verificaciones === 1 && deClase(pp.notas, 'correccion').length === 0 && deClase(pp.notas, 'resultado', 'codex-resume').length === 2, resumen(pp));
  check('por-partes: el texto «Sigue con el próximo archivo.» después del resultado', msjClaude().some((m) => m.texto.startsWith('RESULTADO DE TU MENSAJE ANTERIOR') && m.texto.includes('Guardé: ') && m.texto.trim().endsWith('Sigue con el próximo archivo.')));
  limpiarA();
  const co = await correr('cortada', { modo: 'cortada' });
  check('cortada: manda tarea-cortada-codex.md y Codex entrega de a uno; sin gastar correcciones', co.r.ok === true && deClase(co.notas, 'cortada', 'codex-resume').length === 1 && deClase(co.notas, 'correccion').length === 0 && co.verificaciones === 1, resumen(co));
  limpiarA();
  const ctxo = await correr('contexto', { modo: 'contexto' });
  check('contexto: «ran out of room» arranca de nuevo una vez (exec con «(Esta tarea ya empezó…»)', ctxo.r.ok === true && ctxo.reg.some((l) => l.deNuevo === 'contexto') && deClase(ctxo.notas, 'deNuevo', 'codex-exec').length === 1 && deClase(ctxo.notas, 'correccion').length === 0, resumen(ctxo));
  const hCtx = JSON.parse(fs.readFileSync(path.join(HOME, 'anuncios-hilos.json'), 'utf8'))[ctxo.uuid];
  check('contexto: el hilo nuevo queda guardado y el viejo en `anteriores` (para borrarlo)', hiloValido(hCtx) && hCtx.anteriores?.length === 1 && hCtx.anteriores[0] !== hCtx.thread, hCtx);
  limpiarA();
  const rp = await correr('resume-perdido', { modo: 'resume-perdido' });
  check('resume-perdido: «no rollout found» arranca de nuevo una vez', rp.r.ok === true && rp.reg.some((l) => l.deNuevo === 'hilo-perdido') && deClase(rp.notas, 'deNuevo', 'codex-exec').length === 1, resumen(rp));
  limpiarA();
  const rf = await correr('refresh', { modo: 'refresh' });
  check('refresh: «refresh token was already used» se reintenta una vez con un proceso nuevo', rf.r.ok === true && mensajes(rf.notas).filter((n) => n.tipo === 'codex-exec').length === 2 && rf.reg.some((l) => l.reintento === 'sesion-renovada'), resumen(rf));
  limpiarA();
  const ad = await correr('alta-demanda', { modo: 'alta-demanda', env: { AIA_CODEX_ESPERA_PASAJERO_MS: 150 } });
  check('alta-demanda: se repite (a los 30 s; aquí 150 ms) y sale bien', ad.r.ok === true && mensajes(ad.notas).filter((n) => n.tipo === 'codex-exec').length === 2 && ad.reg.some((l) => l.pasajero === 1), resumen(ad));
  limpiarA();
  const he = await correr('herramientas', { modo: 'herramientas' });
  check('herramientas: corta a las 4 y le recuerda que no tiene herramientas; después bien', he.r.ok === true && deClase(he.notas, 'herramientas', 'codex-resume').length === 1 && he.reg.some((l) => l.herramientas === 4) && !he.notas.some((n) => n.herramientasSinCortar), resumen(he));
  limpiarA();
  const hx = await correr('herramientas-exec', { modo: 'herramientas-exec' });
  check('herramientas-exec: los intentos de exec que solo salen en stderr también cortan a las 4', hx.r.ok === true && hx.reg.filter((l) => l.intento === 'herramienta').length === 4 && hx.reg.some((l) => l.herramientas === 4), resumen(hx));
  limpiarA();
  const sjs = await correr('saltos-json', { modo: 'saltos-json', o: { tipo: 'ficha' } });
  const nSjs = sjs.reg.find((l) => Array.isArray(l.json));
  check('saltos-json: el .json con saltos de línea de verdad dentro de un texto se guarda arreglado (\\n), sin otro mensaje ni corrección', sjs.r.ok === true && ['a', 'a2', 'a3'].every((x) => leer(`${D}/app/${x}.json`) === contenidoA(x, DATOS)) && mensajes(sjs.notas).length === 1 && sjs.verificaciones === 1 && nSjs?.json?.[0]?.arreglados === 2 && !nSjs.json[0].mal, { r: resumen(sjs), json: nSjs?.json });
  check('saltos-json: esfuerzo medium en una tarea que no es revisión (la ficha)', mensajes(sjs.notas)[0]?.esfuerzo === 'medium');
  {
    const { arreglarJSON } = await import('../../server/lib/ia/reglas.js');
    const bien = '{\n  "a": "uno\\n\\nNegative prompt: dos",\n  "b": "c \\"d\\" \\\\n"\n}\n';
    const malo = bien.replace('uno\\n\\nNegative', 'uno\n\nNegative').replace('"c ', '"c\t');
    const a1 = arreglarJSON(malo);
    const a2 = arreglarJSON(bien);
    const a3 = arreglarJSON('{"a": "x\ny",}');
    check('arreglarJSON: pasa a \\n solo lo que está dentro de un texto, deja igual un JSON que ya se lee y avisa lo que igual no se lee', a1.ok && a1.arreglados === 3 && JSON.parse(a1.texto).a === 'uno\n\nNegative prompt: dos' && JSON.parse(a1.texto).b === 'c\t"d" \\n' && a2.ok && a2.arreglados === 0 && a2.texto === bien && !a3.ok && a3.arreglados === 0 && a3.texto === '{"a": "x\ny",}' && /JSON/.test(a3.error), { a1, a3 });
    // una comilla suelta (27" sin escapar) desfasa el recorrido: el arreglo escaparía los saltos de la estructura.
    // Si igual no se lee, se devuelve tal como llegó, y la corrección lógica de Codex sobre eso lo deja bien
    const roto = '{\n  "tomas": [\n    {\n      "prompt": "pantalla de 27" curva"\n    }\n  ],\n  "voz": "x"\n}\n';
    const a4 = arreglarJSON(roto);
    const corregido = a4.texto.replace('27" curva', '27\\" curva');
    let seLee = false;
    try {
      seLee = JSON.parse(corregido).tomas[0].prompt === 'pantalla de 27" curva';
    } catch {}
    check('arreglarJSON: con una comilla suelta no toca nada (texto tal como llegó, 0 arreglados) y la corrección lógica lo deja bien', !a4.ok && a4.arreglados === 0 && a4.texto === roto && seLee, { a4 });
  }
  escribir(`${D}/app/b.json`, B_ORIGINAL);
  const em = await correr('ediciones-mal', { tarea: 'b', modo: 'ediciones-mal' });
  const nEm = em.notas.find((n) => n.edicionesMal);
  check('ediciones-mal: no aplica ninguna edición de ese archivo y se lo dice; después bien', em.r.ok === true && nEm?.edicionesMal?.intacto === true && nEm.edicionesMal.avisado === true && leer(`${D}/app/b.json`) === B_FINAL, { r: resumen(em), nEm });
  check('ediciones-mal: el aviso trae el archivo de ahora y «Copia `buscar` exacto…»', msjClaude().some((m) => m.tarea === 'unidad-b' && m.texto.includes(`No apliqué ninguna edición de \`${D}/app/b.json\`: la edición 2 busca un texto que aparece`) && m.texto.includes('Copia `buscar` exacto del archivo de ahora') && m.texto.includes(`===== ARCHIVO: ${D}/app/b.json`)));
  // un archivo que la tarea puede editar pero no leer: el aviso va sin el archivo de ahora (no viaja por ningún camino)
  escribir(`${D}/app/o.json`, B_ORIGINAL);
  const emo = await correr('ediciones-mal-no-leible', { tarea: 'o', modo: 'ediciones-mal' });
  const avisosO = msjClaude().filter((m) => m.tarea === 'unidad-o' && m.texto.includes(`No apliqué ninguna edición de \`${D}/app/o.json\``));
  check('ediciones-mal sobre un archivo que no se puede leer: lo avisa con el motivo y sin mandarle el archivo', emo.r.ok === true && avisosO.length > 0 && avisosO.every((m) => m.texto.includes('no te lo puedo mandar') && !m.texto.includes('===== ARCHIVO:') && !m.texto.includes('Copia `buscar` exacto')) && leer(`${D}/app/o.json`) === B_FINAL, { r: resumen(emo), avisos: avisosO.map((m) => m.texto.slice(0, 400)) });
  borrar(`${D}/app/o.json`);
  limpiarA();
  const lee = await correr('leer', { env: { FALSO_CODEX_LEER: '1' }, o: { material: { textos: [`${D}/datos.json`], aPedido: [`${D}/extra.md`] } } });
  const nLee = lee.notas.find((n) => n.leer?.pedidos);
  check('leer: manda lo que pidió (de DISPONIBLES) y se niega a ../.env, con su motivo', lee.r.ok === true && nLee?.leer?.llegoPedido === true && nLee.leer.llegoEnv === false && nLee.leer.negadoConMotivo === true && lee.r.denegados.some((d) => d.tipo === 'leer' && d.ruta === '../.env'), { r: resumen(lee), leer: nLee?.leer });
  limpiarA();
  // la conversacion crece por lo que pidio leer (grande.md, unos 11k tokens): arrancar de nuevo la achica
  const tope = await correr('tope', { modo: 'por-partes', env: { FALSO_CODEX_LEER: '1', AIA_CODEX_TOPE_CONTEXTO: 16000 }, o: { material: { textos: [`${D}/datos.json`], aPedido: [`${D}/grande.md`] } } });
  check('El tope de contexto se mira después de cada respuesta y arranca de nuevo dentro del bucle', tope.r.ok === true && tope.reg.some((l) => l.deNuevo === 'tope-de-contexto') && deClase(tope.notas, 'deNuevo', 'codex-exec').length === 1 && tope.verificaciones === 1, resumen(tope));
  limpiarA();
  // el primer mensaje solo ya pasa el tope: arrancar de nuevo no achicaría nada, se sigue en la misma conversación
  const topeChico = await correr('tope-chico', { modo: 'por-partes', env: { AIA_CODEX_TOPE_CONTEXTO: 9000 } });
  check('Con el primer mensaje solo por encima del tope no arranca de nuevo (sería igual de grande)', topeChico.r.ok === true && !topeChico.reg.some((l) => l.deNuevo) && mensajes(topeChico.notas).filter((n) => n.tipo === 'codex-exec').length === 1 && topeChico.verificaciones === 1, resumen(topeChico));
  limpiarA();
  const av = await correr('aviso', { env: { FALSO_CODEX_DEMORA: 1500, AIA_CODEX_AVISO_MS: 300 } });
  check('A los 5 min sin respuesta (aquí 0,3 s), una vez: «Sigue escribiendo: lo largo tarda unos minutos más»', av.r.ok === true && av.frases.filter((f) => f === 'Sigue escribiendo: lo largo tarda unos minutos más').length === 1, av.frases);

  seccion('Lo que la app nunca guarda (modo fuera)');
  limpiarA();
  const tA = TAREAS.a();
  const reglasA = traducir(tA.permitidas, tA.prohibidas, { codexHome: HOME });
  const FUERA = ['../.env', 'app/config.json', 'temp/otro/x.json', `${D}/app/conductor.json`, `${D}/x.js`, `${D}/modelos.json`, `${D}/img/log-modelos.json`, `${D}/video/x.json`];
  const sePuede = FUERA.filter((r) => reglasA.puedeEscribir(r).ok);
  if (check('Antes de probarlo: las reglas no dejan escribir ninguna de las 8 rutas del modo fuera', !sePuede.length, sePuede)) {
    const absFuera = (r) => path.resolve(RAIZ, ...r.split('/'));
    const antes = Object.fromEntries(FUERA.map((r) => [r, huella(absFuera(r))]));
    const fu = await correr('fuera', { modo: 'fuera' });
    const despues = Object.fromEntries(FUERA.map((r) => [r, huella(absFuera(r))]));
    check('fuera: termina ok con lo de la tarea', fu.r.ok === true && ['a', 'a2', 'a3'].every((x) => leer(`${D}/app/${x}.json`) === contenidoA(x, DATOS)), resumen(fu));
    check('fuera: no escribió nada de lo de afuera (mismo tamaño y fecha; .env y config.json sin abrirlos)', FUERA.every((r) => antes[r] === despues[r]), { antes, despues });
    check('fuera: lo mío quedó igual byte por byte (modelos.json, img/log-modelos.json)', leer(`${D}/modelos.json`) === MODELOS && leer(`${D}/img/log-modelos.json`) === MODELOS);
    check('fuera: las 8 quedaron en denegados con su motivo', FUERA.every((r) => fu.r.denegados.some((d) => d.tipo === 'escribir' && (d.ruta === r || d.ruta.endsWith(r.replace(/^\.\.\//, '')) || r.endsWith(d.ruta)))), fu.r.denegados);
    for (const r of FUERA) if (antes[r] === 'no existe' && fs.existsSync(absFuera(r)) && !r.startsWith('..') && r !== 'app/config.json') fs.rmSync(absFuera(r), { force: true }); // (si la app se equivocara)
  }

  seccion('Modos que terminan con error');
  limpiarA();
  const ms = await correr('mal-siempre', { modo: 'mal-siempre' });
  check('mal-siempre: después de las 2 correcciones (una más que Claude), «…no está completo»', ms.r.ok === false && ms.r.error === M.incompleto && deClase(ms.notas, 'correccion', 'codex-resume').length === 2 && ms.r.detalle, resumen(ms));
  const li = await correr('limite', { modo: 'limite' });
  const horaLi = li.r.reinicio ? new Date(li.r.reinicio) : null;
  check('limite: limite y la hora de reinicio de rateLimits (20:14)', li.r.ok === false && li.r.limite === true && horaLi?.getHours() === 20 && horaLi.getMinutes() === 14 && li.r.error === 'Se acabó por ahora el uso de tu plan de ChatGPT. Toca "Reintentar" cuando se renueve (se renueva a las 20:14): lo ya hecho no se repite.', li.r);
  const ps = await correr('plan-sin-codex', { modo: 'plan-sin-codex' });
  check('plan-sin-codex en un paso de la producción: planSinCodex con su texto, sin nombrar un botón (no es un límite)', ps.r.ok === false && ps.r.planSinCodex === true && !ps.r.limite && ps.r.error === M.planSinCodexPaso && !/Reintentar/.test(ps.r.error), ps.r);
  const pp2 = await correr('plan-sin-codex-plus', { modo: 'plan-sin-codex-plus', o: { tipo: 'guion' } });
  check('plan-sin-codex (la otra variante, «upgrade to Plus») en el guion: el texto de §2.21, con «Reintentar»', pp2.r.ok === false && pp2.r.planSinCodex === true && pp2.r.error === M.planSinCodex, pp2.r);
  limpiarA();
  const lm = await correr('limite-a-mitad', { modo: 'limite-a-mitad' });
  check('limite-a-mitad: no manda el segundo mensaje y pausa con la hora', lm.r.ok === false && lm.r.limite === true && Boolean(lm.r.reinicio) && mensajes(lm.notas).length === 1 && !lm.notas.some((n) => (n.problemas || []).some((p) => /uso ordinario/.test(p))), resumen(lm));
  check('limite-a-mitad: lo que ya llegó quedó guardado', ['a', 'a2', 'a3'].some((x) => leer(`${D}/app/${x}.json`) === contenidoA(x, DATOS)));
  // (2026-11-20s) pagó Business: el token guardado todavía dice «free» sin uso hasta pedir uno nuevo
  const renovado = path.join(HOME, 'falso-codex', 'token-renovado.json');
  fs.rmSync(renovado, { force: true });
  limpiarA();
  codex.olvidarEstadoCodex();
  const pv = await correr('plan-viejo', { env: { FALSO_CODEX_PLAN_VIEJO: 'free', FALSO_CODEX_PLAN: 'business', FALSO_CODEX_CREDITOS: 'espacio' } });
  check('plan recién pagado (token viejo «free» sin uso): pide un token nuevo y trabaja con el Business', pv.r.ok === true && fs.existsSync(renovado), resumen(pv));
  fs.rmSync(renovado, { force: true });
  codex.olvidarEstadoCodex();
  est = await conEntorno({ FALSO_CODEX_PLAN_VIEJO: 'free', FALSO_CODEX_PLAN: 'business', FALSO_CODEX_CREDITOS: 'espacio' }, () => codex.estadoCodex());
  check('…y Ajustes ve el plan nuevo y el espacio de trabajo (sin el aviso de plan gratis)', est.cuenta?.plan === 'business' && est.cuenta.espacio === 'Mi Empresa' && !est.avisoPlan, est.cuenta);
  fs.rmSync(renovado, { force: true });
  limpiarA();
  const be = await correr('business-creditos', { env: { FALSO_CODEX_PLAN: 'business', FALSO_CODEX_CREDITOS: 'espacio' } });
  check('Business por uso (sin uso «ordinario», con créditos del espacio): trabaja, no dice «sin uso»', be.r.ok === true && !be.r.limite, resumen(be));
  const pl = await correr('plus-sin-uso', { modo: 'limite-a-mitad', env: { FALSO_CODEX_PLAN: 'plus' } });
  check('Un plan PERSONAL sin uso ordinario sigue frenando (no gasta créditos comprados)', pl.r.ok === false && pl.r.limite === true, resumen(pl));
  codex.olvidarEstadoCodex();
  codex.olvidarEstadoCodex();
  fs.writeFileSync(path.join(HOME, 'falso-sesion.json'), '{"falso":true}');
  const ss = await correr('sin-sesion', { modo: 'sin-sesion', env: { FALSO_CODEX_SESION: null } });
  check('sin-sesion: la secuencia 401 termina en sinSesion (después de mirar la cuenta otra vez)', ss.r.ok === false && ss.r.sinSesion === true && ss.r.error === M.sinSesion, ss.r);
  est = await conEntorno({ FALSO_CODEX_SESION: null }, () => codex.estadoCodex());
  check('sin-sesion: olvidó la cuenta (la pantalla ya ve «sin sesión»)', est.sesion === 'sin-sesion', est);
  codex.olvidarEstadoCodex();
  const cu = await correr('cuelga', { modo: 'cuelga', env: { AIA_CODEX_PLAZO_ARRANQUE_MS: 1500 } });
  check('cuelga: sin turn.started, lo intenta una vez más solo y después colgado con su texto (plazo corto de prueba)', cu.r.ok === false && cu.r.colgado === true && cu.r.error === M.colgado && cu.ms < 15000 && cu.reg.filter((l) => l.reintento === 'colgado').length === 1 && cu.frases.includes('ChatGPT no respondía: lo intento otra vez'), { r: cu.r, ms: cu.ms, frases: cu.frases });
  const mu2 = await correr('muere', { modo: 'muere' });
  check('muere: «ChatGPT se cerró sin terminar…»', mu2.r.ok === false && mu2.r.error === 'ChatGPT se cerró sin terminar. Toca "Reintentar".', mu2.r);
  const pm = await correr('plazo-mensaje', { env: { FALSO_CODEX_DEMORA: 3000, AIA_CODEX_PLAZO_MENSAJE_MS: 800 } });
  check('Un mensaje que pasa su plazo (20 o 45 min; aquí 0,8 s): lo manda una vez más solo y después tiempo', pm.r.ok === false && pm.r.tiempo === true && pm.r.error === M.tiempo && mensajes(pm.notas).length === 2 && pm.reg.filter((l) => l.reintento === 'tiempo-de-mensaje').length === 1, { r: pm.r, mensajes: mensajes(pm.notas).length });
  limpiarA();
  // el cuelgue mudo de las pruebas reales (P5, objeto-clips): el primer mensaje pasa su plazo y el repetido sale bien
  const pu = await correr('plazo-una-vez', { env: { FALSO_CODEX_DEMORA_UNA_VEZ: 8000, AIA_CODEX_PLAZO_MENSAJE_MS: 3000 } });
  check('Un cuelgue que no se repite: lo manda otra vez solo, sin gastar una vuelta, y termina bien', pu.r.ok === true && mensajes(pu.notas).filter((n) => n.tipo === 'codex-exec').length === 2 && pu.reg.filter((l) => l.reintento === 'tiempo-de-mensaje').length === 1 && pu.frases.includes('ChatGPT no respondía: lo intento otra vez') && ['a', 'a2', 'a3'].every((x) => leer(`${D}/app/${x}.json`) === contenidoA(x, DATOS)), resumen(pu));

  seccion('Cancelar, uuid ocupado y la fila');
  {
    const ac = new AbortController();
    const uuid = crypto.randomUUID();
    setTimeout(() => ac.abort(), 1200);
    const x = await correr('cancelar', { modo: 'cuelga', uuid, env: { AIA_CODEX_PLAZO_ARRANQUE_MS: 60000 }, o: { senal: ac.signal } });
    check('Detener: cancelado, «Se canceló.», y la sesión sale de la fila', x.r.ok === false && x.r.cancelado === true && x.r.error === 'Se canceló.' && !fila.sesionActiva(uuid) && !codex.codexEnUso(), x.r);
  }
  await conEntorno({ FALSO_CODEX_MODO: 'cuelga', AIA_CODEX_PLAZO_ARRANQUE_MS: 60000, FALSO_ARGS: path.join(REG, 'fila-falso.jsonl') }, async () => {
    const acs = [new AbortController(), new AbortController(), new AbortController()];
    const uuids = acs.map(() => crypto.randomUUID());
    const frases3 = [];
    const p = acs.map((ac, i) => codex.lanzarSesion({ ...TAREAS.a(), uuid: uuids[i], senal: ac.signal, alProgreso: i === 2 ? (f) => frases3.push(f) : undefined }));
    await dormir(1500);
    const dup = await codex.lanzarSesion({ ...TAREAS.a(), uuid: uuids[0] });
    check('El mismo uuid otra vez: ocupada, «ChatGPT ya está trabajando en esto.»', dup.ok === false && dup.ocupada === true && dup.error === 'ChatGPT ya está trabajando en esto.', dup);
    check('La tercera espera su turno: «Esperando turno: ChatGPT está terminando otra tarea»', frases3.includes('Esperando turno: ChatGPT está terminando otra tarea') && fila.sesionesEnCurso().trabajando === 2 && fila.sesionesEnCurso().esperando === 1, { frases3, f: fila.sesionesEnCurso() });
    check('codexEnUso() mientras trabajan', codex.codexEnUso() === true);
    for (const ac of acs) ac.abort();
    const rs = await Promise.all(p);
    check('Las tres se cancelan', rs.every((x) => x.cancelado === true), rs.map((x) => x.error));
    check('Después: la fila vacía y codexEnUso() false', fila.sesionesEnCurso().trabajando === 0 && fila.sesionesEnCurso().esperando === 0 && !codex.codexEnUso(), fila.sesionesEnCurso());
  });

  // ================================================================ 5. lo que controla el falso en cada mensaje
  seccion('En cada exec y resume (lo que anotó el falso)');
  const IGNORAR = [
    /material-esperado\.json no tiene esta tarea/, // las tareas sinteticas de esta prueba no estan en la lista escrita a mano
    /la carpeta de trabajo de Codex está dentro del proyecto/, // el CODEX_HOME de esta prueba esta en temp/ (la app lo pone fuera)
  ];
  const limpios = (n) => (n.problemas || []).filter((p) => !IGNORAR.some((rx) => rx.test(p)));
  const msgs = mensajes(todas);
  check(`Se revisaron ${msgs.length} mensajes`, msgs.length >= 40, msgs.length);
  check('Las banderas de §2.4 completas en todos (25 --disable, 9 -c, --strict-config, sandbox…)', msgs.every((n) => !n.faltan?.length && !n.malos?.length && !n.deMas?.length), msgs.filter((n) => n.faltan?.length || n.malos?.length || n.deMas?.length).map((n) => ({ e: n.escenario, f: n.faltan, m: n.malos, d: n.deMas })));
  check('La entrada siempre se cerró (hijo.stdin.end)', msgs.every((n) => n.stdinCerrado === true));
  check('El entorno sin claves (OPENAI_, CODEX_API_KEY, KIE_, ELEVENLABS_…) y con el CODEX_HOME de la app', todas.filter((n) => n.envProhibidas).every((n) => !n.envProhibidas.length && n.codexHome?.definido && !n.codexHome.delUsuario), todas.filter((n) => n.envProhibidas?.length).map((n) => n.envProhibidas));
  // (el resume que el falso corta con «no rollout found» se anota antes de leer el mensaje: no trae estos campos)
  const leidos = msgs.filter((n) => n.reglas);
  check(`El MODO APP y «CÓMO TRABAJAS AQUÍ» van en developer_instructions y no en el mensaje (${leidos.length} leídos)`, leidos.length >= msgs.length - 2 && leidos.every((n) => n.conReglas === true), msgs.filter((n) => n.conReglas !== true).map((n) => ({ e: n.escenario, t: n.tipo, c: n.clase, r: n.reglas })));
  check('Ningún mensaje llevó una clave', leidos.every((n) => n.conSecreto === false), leidos.filter((n) => n.conSecreto !== false).map((n) => ({ e: n.escenario, t: n.tipo, c: n.clase })));
  check('Cada -i existe, es una imagen y coincide con IMÁGENES ADJUNTAS', msgs.every((n) => !n.imagenes?.faltan?.length && !n.imagenes?.noSonImagen?.length && n.imagenes?.listadas === n.imagenes?.total));
  check('Ningún otro problema en exec, resume, app-server, login status ni en las respuestas', todas.every((n) => !limpios(n).length), todas.filter((n) => limpios(n).length).map((n) => ({ e: n.escenario, t: n.tipo, p: limpios(n) })));
  check('El falso no tuvo errores propios', !todas.some((n) => n.tipo === 'error'), todas.filter((n) => n.tipo === 'error'));

  // ================================================================ 6. iniciar y cerrar sesion
  seccion('Iniciar y cerrar sesión (§2.18)');
  await conEntorno({ FALSO_CODEX_SESION: null, FALSO_ARGS: path.join(REG, 'login-falso.jsonl') }, async () => {
    fs.rmSync(path.join(HOME, 'falso-sesion.json'), { force: true });
    codex.olvidarEstadoCodex();
    check('Antes: sin sesión', (await codex.estadoCodex()).sesion === 'sin-sesion');
    let a = await codex.abrirLoginCodex();
    check('Con el navegador: enCurso y la URL de auth.openai.com', a.ok === true && a.login?.enCurso === true && a.login.modo === 'navegador' && a.login.url === 'https://auth.openai.com/oauth/authorize?falso=1', a);
    check('codexEnUso() mientras hay un inicio de sesión abierto', codex.codexEnUso() === true);
    for (let i = 0; i < 60 && codex.estadoLoginCodex()?.enCurso; i++) await dormir(100);
    let l = codex.estadoLoginCodex();
    est = await codex.estadoCodex();
    check('Al terminar (salida 0): olvidó el estado y la cuenta ya está ok', l?.enCurso === false && !l.error && est.sesion === 'ok' && est.cuenta?.email === 'alumno@ejemplo.com', { l, est });
    a = await codex.abrirLoginCodex({ conCodigo: true });
    check('Con código: el enlace auth.openai.com/codex/device y el código', a.ok === true && a.login?.modo === 'codigo' && a.login.enlace === 'https://auth.openai.com/codex/device' && a.login.codigo === 'ABCD-12345', a);
    for (let i = 0; i < 60 && codex.estadoLoginCodex()?.enCurso; i++) await dormir(100);
    await conEntorno({ FALSO_CODEX_LOGIN: 'puerto' }, async () => {
      await codex.abrirLoginCodex();
      for (let i = 0; i < 60 && codex.estadoLoginCodex()?.enCurso; i++) await dormir(100);
    });
    check('El puerto 1455 ocupado: error «puerto»', codex.estadoLoginCodex()?.error === 'puerto', codex.estadoLoginCodex());
    await conEntorno({ FALSO_CODEX_LOGIN: 'sin-codigo' }, async () => {
      await codex.abrirLoginCodex({ conCodigo: true });
      for (let i = 0; i < 60 && codex.estadoLoginCodex()?.enCurso; i++) await dormir(100);
    });
    check('Sin login con código en esa cuenta: error «sin-codigo»', codex.estadoLoginCodex()?.error === 'sin-codigo', codex.estadoLoginCodex());
    await conEntorno({ FALSO_CODEX_LOGIN: 'cuelga' }, async () => {
      a = await codex.abrirLoginCodex();
      check('Uno que queda abierto: enCurso', a.login?.enCurso === true);
      const b = await codex.abrirLoginCodex({ conCodigo: true });
      check('Uno nuevo corta el anterior', b.login?.modo === 'codigo' && b.login.enCurso === true);
      check('Cancelar: lo corta y queda sin login', codex.cancelarLoginCodex() === true && codex.estadoLoginCodex() === null && !codex.codexEnUso());
    });
    await conEntorno({ FALSO_CODEX_LOGIN: 'cuelga', AIA_CODEX_PLAZO_LOGIN_MS: 500 }, async () => {
      await codex.abrirLoginCodex();
      for (let i = 0; i < 60 && codex.estadoLoginCodex()?.enCurso; i++) await dormir(100);
    });
    check('El tope de 15 min (aquí 0,5 s): error «tiempo»', codex.estadoLoginCodex()?.error === 'tiempo' && !codex.codexEnUso(), codex.estadoLoginCodex());
    const s = await codex.cerrarSesionCodex();
    est = await codex.estadoCodex();
    check('Cerrar sesión: logout y la cuenta queda sin sesión', s.ok === true && est.sesion === 'sin-sesion', { s, est });
    const notas = leerNotas(path.join(REG, 'login-falso.jsonl'));
    const deCuenta = notas.filter((n) => ['codex-login', 'codex-login-status', 'codex-logout'].includes(n.tipo));
    check('login, login status y logout con sus -c y --disable, sin --strict-config y sin claves', deCuenta.length >= 8 && deCuenta.every((n) => n.ok === true), deCuenta.filter((n) => !n.ok));
  });
  codex.olvidarEstadoCodex();

  // ================================================================ 7. los hilos viejos
  seccion('Borrar los hilos viejos (§2.12)');
  await conEntorno({ FALSO_ARGS: path.join(REG, 'limpiar-falso.jsonl') }, async () => {
    const ruta = path.join(HOME, 'anuncios-hilos.json');
    const datos = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    const viejo = datos[ms.uuid];
    const sesionVieja = path.join(HOME, 'sessions', `${viejo?.thread}.json`);
    const anteriorCtx = datos[ctxo.uuid]?.anteriores?.[0];
    datos[ms.uuid] = { ...viejo, usado: new Date(Date.now() - 40 * 86400000).toISOString() };
    fs.writeFileSync(ruta, json(datos));
    const existiaSesion = fs.existsSync(sesionVieja);
    const r = await codex.limpiarHilosViejos();
    const despues = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    const borrados = leerNotas(path.join(REG, 'limpiar-falso.jsonl')).filter((n) => n.tipo === 'codex-delete');
    check('Borra con `codex delete --force` el de más de 30 días y los que quedaron atrás al arrancar de nuevo', r.ok === true && r.borrados >= 2 && !despues[ms.uuid] && !despues[ctxo.uuid]?.anteriores && borrados.some((n) => n.hilo === viejo.thread) && borrados.some((n) => n.hilo === anteriorCtx), { r, borrados: borrados.map((n) => n.hilo) });
    check('La conversación del hilo viejo ya no está y los demás quedan', existiaSesion && !fs.existsSync(sesionVieja) && Boolean(despues[ok.uuid]), { existiaSesion });
    check('delete va con sus -c y --disable, sin claves', borrados.length > 0 && borrados.every((n) => n.ok === true), borrados.filter((n) => !n.ok));
    const r2 = await conEntorno({ AIA_CODEX_SESIONES_TOPE_MB: 0.001, AIA_CODEX_SESIONES_BAJAR_MB: 0 }, () => codex.limpiarHilosViejos());
    const quedan = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    check('Con las conversaciones por encima del tope (3 GB; aquí 1 KB) borra las más viejas hasta bajar', r2.ok === true && r2.borrados > 0 && Object.keys(quedan).length === 0, { r2, quedan: Object.keys(quedan).length });
  });

  // ================================================================ 8. el freno de la sesion del usuario
  seccion('El freno: con la sesión del usuario como CODEX_HOME no corre login, logout ni delete');
  await conEntorno({ CODEX_HOME: HOME, FALSO_ARGS: path.join(REG, 'freno-falso.jsonl') }, async () => {
    // (esHomeDelUsuario cuenta como del usuario lo que diga CODEX_HOME: asi se prueba sin tocar ~/.codex)
    const a = await codex.abrirLoginCodex();
    const s = await codex.cerrarSesionCodex();
    const l = await codex.limpiarHilosViejos();
    const notas = leerNotas(path.join(REG, 'freno-falso.jsonl'));
    check('abrirLoginCodex, cerrarSesionCodex y limpiarHilosViejos no hacen nada', a.ok === false && a.freno === true && s.ok === false && s.freno === true && l.motivo === 'home-del-usuario' && notas.length === 0, { a, s, l, notas: notas.length });
  });

  // ================================================================ final
  seccion('Al final');
  check('~/.codex no cambió (solo se miró su fecha)', huella(path.join(os.homedir(), '.codex')) === HUELLA_CODEX_USUARIO);
  check('No quedó ninguna sesión en la fila', fila.sesionesEnCurso().trabajando === 0 && fila.activas.size === 0);

  // ---- limpiar lo de esta prueba (solo lo suyo)
  for (let i = 0; i < 10 && fs.existsSync(DIR); i++) {
    try {
      fs.rmSync(DIR, { recursive: true, force: true });
    } catch {
      await dormir(500); // un proceso que todavia se esta cerrando
    }
  }
  check('Borró temp/_codex-unidad-motor/', !fs.existsSync(DIR));
  const TEMP = path.join(RAIZ, 'temp');
  if (!HABIA_TEMP && fs.existsSync(TEMP) && !fs.readdirSync(TEMP).length) fs.rmdirSync(TEMP);

  const bien = resultados.filter((r) => r.ok).length;
  console.log(`\n${bien} de ${resultados.length} bien.`);
  console.log(`RESULTADO ${JSON.stringify({ bien, mal: resultados.length - bien })}`);
  process.exit(bien === resultados.length ? 0 : 1);
}

const hiloValido = (h) => Boolean(h && /^[0-9a-f-]{36}$/i.test(String(h.thread || '')));

if (process.argv.includes('--input-format')) claudeFalso();
else
  prueba().catch((e) => {
    console.error(e?.stack || e);
    process.exit(1);
  });

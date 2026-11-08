// Prueba de humo de Anuncios con IA para Windows y Mac (la usa GitHub Actions: .github/workflows/prueba-mac-windows.yml).
//
// Uso (desde la raíz de la app, con remotion/node_modules y app/node_modules instalados y la interfaz armada; es lo
// que deja el lanzador):
//   node app/herramientas/prueba-humo.mjs              corre todo; sale con 0 si todo pasó y con 1 si algo falló
// Variables: PUERTO=<n>          el puerto de la app de prueba (por defecto 4497)
//            HUMO_INFORME=<dir>  dónde dejar informe.json, app.log y lo que recibió el Claude falso (por defecto,
//                                la carpeta temporal del sistema: anuncios-con-ia-prueba-humo/)
//            HUMO_SIN_ANUNCIO=1  solo las revisiones rápidas, sin producir el anuncio
//            HUMO_FORZAR=1       correr aunque temp/ ya tenga anuncios (ver abajo)
//
// Qué hace, SIN GASTAR NADA: arranca la app de esta carpeta en MODO PRUEBA (ANUNCIOS_MODO_PRUEBA=1: kie.ai, ElevenLabs
// y Suno simulados en 127.0.0.1 y la guardia de red que corta cualquier salida del motor) con un Claude Code FALSO
// (este mismo archivo, por ANUNCIOS_CLAUDE_BIN), y comprueba:
//   · los lanzadores (el .bat con CRLF, el .command con LF y bash -n), node --check del servidor y del motor;
//   · los programas que usa la app: Node.js, ffmpeg y ffprobe con VP9 (libvpx-vp9), Python con rembg, onnxruntime,
//     Pillow y NumPy (con la misma revisión que hace el motor: recortar-host.py --verificar);
//   · que la interfaz carga (GET / y sus archivos) y que las rutas /api principales responden sin error;
//   · que Ajustes → Tu PC ve ffmpeg, Python y Node.js;
//   · UN anuncio claymation de punta a punta, como lo hace la interfaz: crea el producto (con su foto), arma la ficha,
//     crea el anuncio, espera el guion, lo aprueba y produce hasta el MP4 (imágenes, videos, voz, música, montaje y el
//     render de Remotion), y revisa el MP4 con ffprobe;
//   · que la guardia no tuvo que cortar ninguna salida a internet.
// El anuncio se crea en temp/ y output/ de ESTA carpeta: por eso no corre si temp/ ya tiene anuncios de alguien
// (la carpeta de trabajo de verdad), salvo con HUMO_FORZAR=1. En GitHub la carpeta es nueva y se tira al terminar.
//
// El mismo archivo es el Claude falso: cuando la app lo lanza como `claude` (con -p, auth o --version), escribe el guion
// claymation él solo (sin depender de anuncios de muestra en temp/) y pasa todo lo demás (ficha, revisiones) al Claude
// falso de la app: app/server/claude/pruebas/claude-falso.js.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const APP = path.resolve(path.dirname(SELF), '..');
const RAIZ = path.resolve(APP, '..');
const WIN = process.platform === 'win32';
const ARGS = process.argv.slice(2);
const COMO_CLAUDE = ARGS.includes('-p') || ARGS[0] === 'auth' || ARGS[0] === '--version';
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
const leerJSON = (f, d = null) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
  } catch {
    return d;
  }
};

// =====================================================================================================================
// 1) El Claude falso
// =====================================================================================================================

/** Un manifiesto claymation corto (3 tomas, 1 B-roll) con el formato de los de la app: lo procesa el motor de verdad. */
function manifiestoClaymation(foto) {
  const estilo =
    'Handmade stop-motion claymation, sculpted plasticine with visible fingerprints and soft clay texture, warm practical light, shallow depth of field.';
  const mujer =
    'CHARACTER: a claymation woman in her thirties with a rounded handmade clay body, soft oval face, small dot eyes, short dark clay hair and a mustard clay sweater';
  const video = (seg, movimiento) =>
    `Stop-motion claymation animation, image-to-video from the shot above, ${seg}s.\nCamera: slight push-in\nMotion: ${movimiento}\nEnsure handmade stop-motion clay animation throughout the video. Non CGI. Non cinematic. Animation must start at the first frame.`;
  const lineas = [
    'Si cada tarde te quedas sin energía, no es tu culpa.',
    'Tu cuerpo te está pidiendo una pausa que nadie le da.',
    'Con el Producto Humo, esa pausa llega en un frasco.',
  ];
  const m = {
    estilo: 'claymation',
    modo_audio: 'voz_en_off',
    mercado: 'LatAm',
    idioma: 'es',
    aspect_ratio: '9:16',
    referencias: [{ id: 'mujer', tipo: 'personaje', prompt: `${mujer}. Full body, neutral pose, plain clay backdrop. ${estilo}` }],
    tomas: [
      {
        n: 1, tipo: 'A', duracion: 3.4, linea: lineas[0],
        prompt_imagen_inicial: `Vertical 9:16. ${mujer} sits tired at a small clay kitchen table in the afternoon, shoulders low. ${estilo}`,
        prompt_imagen_final: null, prompt_video: video(3.4, 'she lets out a slow breath and rests her chin on her hand'), referencias: ['mujer'],
      },
      {
        n: 2, tipo: 'A', duracion: 3.4, linea: lineas[1],
        prompt_imagen_inicial: `Vertical 9:16. ${mujer} looks at a tiny clay clock on the wall that shows five o'clock. ${estilo}`,
        prompt_imagen_final: null, prompt_video: video(3.4, 'the clock hands tick once and she blinks slowly'), referencias: ['mujer'],
      },
      {
        n: 3, tipo: 'A', duracion: 3.6, linea: lineas[2],
        prompt_imagen_inicial: `Vertical 9:16. ${mujer} smiles holding the product jar, sculpted in clay keeping its real shape and label. ${estilo}`,
        prompt_imagen_final: null, prompt_video: video(3.6, 'she lifts the jar a little toward the camera and smiles'), referencias: ['mujer', 'producto'],
      },
    ],
    broll: [
      {
        n: 1, despues_de_toma: 2, sincroniza_con: 'una pausa', duracion: 2,
        prompt_imagen: `Vertical 9:16. Extreme macro shot of a clay cup of tea steaming on a clay saucer. ${estilo}`,
        prompt_video: video(2, 'a soft clay steam curl rises from the cup'), referencias: [],
      },
    ],
    voz_en_off: lineas.join(' '),
    overlays: [{ texto: 'ENVÍO GRATIS', toma: 3, momento: 'inicio' }],
  };
  if (foto) {
    m.referencias.push({ id: 'producto', tipo: 'producto', archivo: foto, nota: 'envase esculpido en plastilina, conservando forma, proporciones y etiqueta reales' });
  } else {
    m.tomas[2].referencias = ['mujer'];
  }
  return m;
}

async function claudeFalso() {
  const DELEGADO = path.join(APP, 'server', 'claude', 'pruebas', 'claude-falso.js');
  const REG = process.env.HUMO_REGISTRO;
  const anotar = (o) => {
    try {
      if (REG) fs.appendFileSync(REG, `${JSON.stringify({ t: new Date().toISOString(), ...o })}\n`);
    } catch {
      /* sin registro */
    }
  };
  const pasar = () => {
    // lo que no es el guion claymation: el Claude falso de la app, con los mismos argumentos y la misma entrada
    const hijo = cp.spawn(process.execPath, [DELEGADO, ...ARGS], { stdio: ['pipe', 'inherit', 'inherit'], env: process.env });
    hijo.on('exit', (c) => process.exit(c ?? 0));
    hijo.stdin.on('error', () => {});
    return hijo;
  };
  if (!ARGS.includes('-p')) {
    anotar({ tipo: ARGS.slice(0, 2).join(' ') });
    pasar().stdin.end();
    return;
  }

  const val = (k) => {
    const i = ARGS.indexOf(k);
    return i >= 0 ? ARGS[i + 1] : null;
  };
  const sesion = val('--resume') || val('--session-id') || '00000000-0000-0000-0000-000000000000';
  const emitir = (o) => process.stdout.write(`${JSON.stringify({ session_id: sesion, ...o })}\n`);
  let n = 0;
  const usar = (name, input) => {
    const id = `toolu_humo_${++n}`;
    emitir({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] } });
    emitir({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] } });
  };
  const escribir = (rel, datos) => {
    const abs = path.join(RAIZ, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, `${JSON.stringify(datos, null, 2)}\n`, 'utf8');
    usar('Write', { file_path: abs, content: '{…}' });
  };

  async function guion(texto) {
    const slug = texto.match(/Carpeta del anuncio: temp\/(\S+)/)?.[1];
    if (!slug || !fs.existsSync(path.join(RAIZ, 'temp', slug))) throw new Error(`no encuentro la carpeta del anuncio (${slug})`);
    usar('Read', { file_path: path.join(RAIZ, '.claude', 'skills', 'anuncios-claymation', 'SKILL.md') });
    const foto = fs.readdirSync(path.join(RAIZ, 'temp', slug)).find((x) => /^producto\.(jpg|jpeg|png|webp)$/i.test(x)) || null;
    const man = manifiestoClaymation(foto);
    escribir(`temp/${slug}/manifiesto.json`, man);
    escribir(`temp/${slug}/transiciones.json`, {
      efectos: { woosh: 'efectos/woosh.mp3', 'deep-woosh': 'efectos/deep-woosh.mp3' },
      puntos: [{ toma: 3, animacion: 'zoom', efecto: 'deep-woosh', porque: 'entrada de la solución' }],
    });
    usar(WIN ? 'PowerShell' : 'Bash', { command: `node produccion/validar-manifiesto.js temp/${slug}/manifiesto.json` });
    escribir(`temp/${slug}/app/guion.json`, {
      titulo: 'La pausa de la tarde (prueba de humo)',
      idioma: 'es',
      mercado: 'LatAm',
      duracionEstimada: 12,
      de_que_va: 'Una mujer sin energía por la tarde encuentra su pausa.',
      partes: man.tomas.map((t, i) => ({ n: t.n, momento: i === 0 ? 'gancho' : i === 2 ? 'producto' : 'historia', dice: t.linea, se_ve: 'Una escena de plastilina' })),
      decisiones: ['Guion corto de la prueba de humo (Claude falso).'],
    });
  }

  let delegado = null;
  let primero = true;
  let tarea = null;
  let textoTarea = '';
  let cola = Promise.resolve();
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', (linea) => {
    if (delegado) return delegado.stdin.write(`${linea}\n`);
    let ev;
    try {
      ev = JSON.parse(linea);
    } catch {
      return;
    }
    if (ev.type !== 'user') return;
    const c = ev.message?.content;
    const texto = typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x?.text || '').join('\n') : '';
    if (primero) {
      primero = false;
      tarea = (texto.match(/^TAREA: ([^\n]+)/m) || [])[1]?.trim() || null;
      const propia = /^guion\b/.test(tarea || '') && /\.claude\/skills\/anuncios-claymation\//.test(texto);
      anotar({ tipo: 'tarea', tarea, propia, args: ARGS.filter((a) => a.length < 200).slice(0, 30), entorno: Object.keys(process.env).filter((k) => /^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_API)/i.test(k)) });
      if (!propia) {
        delegado = pasar();
        delegado.stdin.write(`${linea}\n`);
        return;
      }
      textoTarea = texto;
    }
    cola = cola.then(async () => {
      emitir({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: String(val('--tools') || '').split(',').filter(Boolean), model: 'claude-falso-humo', permissionMode: val('--permission-mode'), apiKeySource: 'none', mcp_servers: [] });
      await dormir(20);
      try {
        await guion(textoTarea);
        emitir({ type: 'result', subtype: 'success', is_error: false, result: 'LISTO', num_turns: 3, total_cost_usd: 0, usage: { input_tokens: 10, output_tokens: 10 }, permission_denials: [] });
      } catch (e) {
        anotar({ tipo: 'error', error: String(e.stack || e) });
        emitir({ type: 'result', subtype: 'error_during_execution', is_error: true, result: `Claude falso: ${e.message}`, num_turns: 1 });
      }
    });
  });
  rl.on('close', () => {
    if (delegado) delegado.stdin.end();
    else cola.then(() => process.exit(0));
  });
}

// =====================================================================================================================
// 2) La prueba
// =====================================================================================================================
const TABLA_CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
/** Un PNG de un frasco simple (para la foto del producto), sin dependencias. */
function pngFrasco(ancho = 640, alto = 640) {
  const trozo = (tipo, datos) => {
    const t = Buffer.from(tipo, 'ascii');
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(datos.length);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc32(Buffer.concat([t, datos])));
    return Buffer.concat([largo, t, datos, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const crudo = Buffer.alloc((1 + ancho * 3) * alto);
  for (let y = 0; y < alto; y++) {
    const o = y * (1 + ancho * 3);
    for (let x = 0; x < ancho; x++) {
      const dentro = Math.abs(x - ancho / 2) < ancho * 0.18 && y > alto * 0.25 && y < alto * 0.85;
      const tapa = Math.abs(x - ancho / 2) < ancho * 0.14 && y > alto * 0.17 && y <= alto * 0.25;
      const etiqueta = dentro && y > alto * 0.45 && y < alto * 0.65;
      const [r, g, b] = etiqueta ? [250, 240, 220] : tapa ? [40, 40, 48] : dentro ? [230, 120, 60] : [246, 244, 240];
      crudo[o + 1 + x * 3] = r;
      crudo[o + 2 + x * 3] = g;
      crudo[o + 3 + x * 3] = b;
    }
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), trozo('IHDR', ihdr), trozo('IDAT', zlib.deflateSync(crudo)), trozo('IEND', Buffer.alloc(0))]);
}

function listar(dir, filtro, fuera = []) {
  let entradas = [];
  try {
    entradas = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return fuera;
  }
  for (const e of entradas) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!/^(node_modules|dist|pruebas-datos)$/.test(e.name)) listar(f, filtro, fuera);
    } else if (filtro(f)) fuera.push(f);
  }
  return fuera;
}

const correr = (cmd, args, o = {}) => cp.spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true, timeout: 120000, ...o });

/** El Python que usa el motor (el mismo orden que produccion/recortar-host.js). */
function buscarPython() {
  const candidatos = WIN ? [['python'], ['py', '-3'], ['python3']] : [['python3'], ['python']];
  for (const [cmd, ...pre] of candidatos) {
    const r = correr(cmd, [...pre, '-E', '-c', 'import sys; print("%d.%d.%d" % sys.version_info[:3])']);
    const v = (r.stdout || '').trim();
    if (r.status === 0 && /^3\.\d+\.\d+$/.test(v)) return { cmd, pre, version: v };
  }
  return null;
}

async function prueba() {
  const t0 = Date.now();
  const PUERTO = Number(process.env.PUERTO) || 4497;
  const BASE = `http://127.0.0.1:${PUERTO}`;
  const INFORME = path.resolve(process.env.HUMO_INFORME || path.join(os.tmpdir(), 'anuncios-con-ia-prueba-humo'));
  fs.mkdirSync(INFORME, { recursive: true });
  const REGISTRO = path.join(INFORME, 'claude-falso.jsonl');
  fs.writeFileSync(REGISTRO, '');
  const resultados = [];
  const avisos = [];
  const check = (nombre, ok, detalle) => {
    resultados.push({ nombre, ok: !!ok, ...(ok ? {} : { detalle }) });
    const d = !ok && detalle !== undefined ? `\n        → ${String(typeof detalle === 'string' ? detalle : JSON.stringify(detalle)).slice(0, 1200)}` : '';
    console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${d}`);
    return !!ok;
  };
  const aviso = (t) => {
    avisos.push(t);
    console.log(`AVISO ${t}`);
  };
  const seccion = (t) => console.log(`\n== ${t}`);
  let appProc = null;
  let anuncio = null;

  console.log(`Prueba de humo de Anuncios con IA · ${process.platform} ${os.release()} ${process.arch} · Node ${process.version}`);
  console.log(`Carpeta: ${RAIZ}`);

  // ------------------------------------------------------------ que no sea la carpeta de trabajo de verdad
  const ajenos = (() => {
    try {
      return fs.readdirSync(path.join(RAIZ, 'temp'), { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('producto-humo') && fs.existsSync(path.join(RAIZ, 'temp', d.name, 'manifiesto.json')))
        .map((d) => d.name);
    } catch {
      return [];
    }
  })();
  if (ajenos.length && process.env.HUMO_FORZAR !== '1' && process.env.HUMO_SIN_ANUNCIO !== '1') {
    console.error(`\nEsta carpeta ya tiene anuncios en temp/ (${ajenos.slice(0, 3).join(', ')}…): la prueba crearía uno más ahí.`);
    console.error('Córrela en una copia de la carpeta (o con HUMO_SIN_ANUNCIO=1 solo para las revisiones rápidas).');
    process.exit(1);
  }

  // ================================================================================================= A. archivos
  seccion('Lanzadores y código');
  const BAT = path.join(RAIZ, 'Abrir Anuncios con IA.bat');
  const CMD = path.join(RAIZ, 'Abrir Anuncios con IA.command');
  if (check('Existe "Abrir Anuncios con IA.bat"', fs.existsSync(BAT), BAT)) {
    const t = fs.readFileSync(BAT, 'latin1');
    check('Lanzador de Windows: finales de línea CRLF', !/(^|[^\r])\n/.test(t), 'cmd.exe necesita CRLF (revisa .gitattributes)');
    check('Lanzador de Windows: arranca la app (node server\\index.js)', /node server\\index\.js/.test(t));
  }
  if (check('Existe "Abrir Anuncios con IA.command"', fs.existsSync(CMD), CMD)) {
    const b = fs.readFileSync(CMD);
    check('Lanzador de Mac: empieza con #!/bin/bash y no tiene CRLF', b.toString('utf8').startsWith('#!/bin/bash\n') && !b.includes(13), 'debe tener finales de línea LF (revisa .gitattributes)');
    check('Lanzador de Mac: arranca la app (node server/index.js)', /node server\/index\.js/.test(b.toString('utf8')));
    const bash = correr('bash', ['--version']);
    if (bash.status === 0) {
      for (const f of [CMD, path.join(APP, 'inicio', 'programas-mac.sh')]) {
        const r = correr('bash', ['-n', f]);
        check(`bash -n ${path.relative(RAIZ, f)}`, r.status === 0, r.stderr);
      }
    } else aviso('No hay bash en esta computadora: no se revisa la sintaxis del lanzador de Mac.');
  }
  const ps1 = path.join(APP, 'inicio', 'programas-windows.ps1');
  if (check('Existe app/inicio/programas-windows.ps1', fs.existsSync(ps1))) {
    const b = fs.readFileSync(ps1);
    check('programas-windows.ps1 es UTF-8 con BOM (PowerShell 5 lee mal los acentos sin él)', b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf);
  }
  const js = [...listar(path.join(APP, 'server'), (f) => /\.(m?js|cjs)$/.test(f)), ...listar(path.join(RAIZ, 'produccion'), (f) => /\.(m?js|cjs)$/.test(f)), ...listar(path.join(APP, 'inicio'), (f) => /\.(m?js)$/.test(f))];
  const malosJs = [];
  for (const f of js) {
    const r = correr(process.execPath, ['--check', f]);
    if (r.status !== 0) malosJs.push(`${path.relative(RAIZ, f)}: ${(r.stderr || '').trim().split('\n').slice(0, 4).join(' ')}`);
  }
  check(`node --check de ${js.length} archivos del servidor y del motor`, js.length > 40 && !malosJs.length, malosJs);
  const skills = (() => {
    try {
      return fs.readdirSync(path.join(RAIZ, '.claude', 'skills')).filter((x) => fs.existsSync(path.join(RAIZ, '.claude', 'skills', x, 'SKILL.md')));
    } catch {
      return [];
    }
  })();
  check(`Las skills de los estilos están (.claude/skills: ${skills.length})`, skills.length >= 13 && skills.includes('anuncios-claymation'), skills);

  // ================================================================================================= B. programas
  seccion('Programas');
  const [ma, mi] = process.versions.node.split('.').map(Number);
  check(`Node.js 20.19 o más nuevo (${process.version})`, ma > 20 || (ma === 20 && mi >= 19));
  if (ma < 24) aviso(`Node.js ${process.version}: el modo prueba necesita Node.js 24 (NODE_USE_ENV_PROXY); la parte del anuncio va a fallar.`);
  const ff = correr('ffmpeg', ['-hide_banner', '-encoders']);
  check('ffmpeg está en el PATH', ff.status === 0, ff.error?.message || ff.stderr);
  check('ffmpeg trae VP9 (libvpx-vp9, para el podcast en esquina)', /libvpx-vp9/.test(ff.stdout || ''), (ff.stdout || '').split('\n').filter((l) => /vp|av1/i.test(l)).slice(0, 6));
  const fp = correr('ffprobe', ['-hide_banner', '-version']);
  check('ffprobe está en el PATH', fp.status === 0, fp.error?.message || fp.stderr);
  const py = buscarPython();
  let versionPy = py?.version || null;
  if (check(`Python 3 (${py ? `${[py.cmd, ...py.pre].join(' ')} ${py.version}` : 'no se encontró'})`, !!py)) {
    const [pa, pb] = py.version.split('.').map(Number);
    check(`Python de 3.10 a 3.13 (${py.version})`, pa === 3 && pb >= 10 && pb <= 13);
    const banderas = pb >= 11 ? ['-E', '-P'] : ['-E'];
    const ver = correr(py.cmd, [...py.pre, ...banderas, path.join(RAIZ, 'produccion', 'recortar-host.py'), '--verificar'], { timeout: 180000 });
    let j = null;
    try {
      j = JSON.parse(String(ver.stdout).trim().split('\n').pop());
    } catch {
      /* no dijo JSON */
    }
    check('Python tiene rembg, onnxruntime, Pillow y NumPy (recortar-host.py --verificar)', ver.status === 0 && j && Array.isArray(j.faltan) && !j.faltan.length, j || `${ver.stdout}\n${ver.stderr}`.trim().slice(-600));
    const imp = correr(py.cmd, [...py.pre, '-E', '-c', 'import rembg, onnxruntime, PIL, numpy; print(onnxruntime.__version__)'], { timeout: 180000 });
    check(`Python importa rembg y onnxruntime (${(imp.stdout || '').trim() || '—'})`, imp.status === 0, (imp.stderr || '').trim().split('\n').slice(-3).join(' '));
  }

  {
    // ============================================================================================= C. la app
    seccion(`La app en modo prueba (${BASE})`);
    const listo = fs.existsSync(path.join(APP, 'dist', 'index.html')) && fs.existsSync(path.join(APP, 'node_modules', 'express', 'package.json')) && fs.existsSync(path.join(RAIZ, 'remotion', 'node_modules', 'remotion', 'package.json'));
    check('La app está instalada (remotion/node_modules, app/node_modules y la interfaz armada en app/dist)', listo, 'corre primero: node app/inicio/preparar-app.mjs');
    // en modo prueba la guardia corta también la descarga del navegador de Remotion: lo tiene que haber dejado el lanzador
    const navegador = (() => {
      try {
        return fs.readdirSync(path.join(RAIZ, 'remotion', 'node_modules', '.remotion', 'chrome-headless-shell'), { withFileTypes: true }).some((d) => d.isDirectory());
      } catch {
        return false;
      }
    })();
    check('Está el navegador que arma los videos (remotion/node_modules/.remotion, lo baja el lanzador)', navegador, 'corre primero: node app/inicio/preparar-app.mjs');
    // sin .env el motor no arranca ningún comando (lo exige aunque sea en modo prueba): uno con claves falsas
    const ENV = path.join(RAIZ, '.env');
    if (!fs.existsSync(ENV)) {
      fs.writeFileSync(ENV, '# Lo escribió la prueba de humo: claves falsas (el modo prueba no las usa).\nKIE_API_KEY=simulada-prueba-de-humo\nELEVENLABS_API_KEY=simulada-prueba-de-humo\n');
      console.log('   (.env de prueba con claves falsas)');
    }
    const env = { ...process.env };
    for (const k of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|APIMART_|SUNO_)/i.test(k)) delete env[k];
    Object.assign(env, {
      PUERTO: String(PUERTO),
      ANUNCIOS_MODO_PRUEBA: '1',
      ANUNCIOS_PRUEBA_LIMPIO: '1',
      ANUNCIOS_CLAUDE_BIN: SELF,
      HUMO_REGISTRO: REGISTRO,
    });
    const logApp = fs.createWriteStream(path.join(INFORME, 'app.log'));
    appProc = cp.spawn(process.execPath, ['server/index.js'], { cwd: APP, env, stdio: ['ignore', 'pipe', 'pipe'], detached: !WIN, windowsHide: true });
    appProc.stdout.pipe(logApp);
    appProc.stderr.pipe(logApp);
    let salio = null;
    appProc.on('exit', (c, s) => (salio = { codigo: c, senal: s }));

    const pedir = async (ruta, o = {}) => {
      const cuerpo = o.json !== undefined ? JSON.stringify(o.json) : o.cuerpo;
      const headers = { Accept: 'application/json', ...(o.json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(o.headers || {}) };
      const r = await fetch(BASE + ruta, { method: o.metodo || (cuerpo !== undefined ? 'POST' : 'GET'), headers, body: cuerpo, redirect: 'manual', signal: AbortSignal.timeout(o.ms || 60000) });
      const tipo = r.headers.get('content-type') || '';
      const datos = tipo.includes('json') ? await r.json().catch(() => null) : await r.text();
      return { st: r.status, tipo, datos };
    };

    let arriba = false;
    for (let i = 0; i < 180 && !salio; i++) {
      try {
        if ((await pedir('/', { ms: 3000 })).st === 200) {
          arriba = true;
          break;
        }
      } catch {
        /* todavía no */
      }
      await dormir(500);
    }
    check('La app arranca', arriba, salio ? `la app se cerró (${JSON.stringify(salio)}): mira app.log` : 'no respondió en 90 s');

    if (arriba) {
      // ---------------------------------------------------------- interfaz y rutas
      let r = await pedir('/');
      const html = String(r.datos || '');
      check('La interfaz (/) se sirve', r.st === 200 && /<title>anuncios-IA by Kalethabh<\/title>/.test(html), html.slice(0, 200));
      const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
      for (const a of assets.slice(0, 4)) {
        const x = await pedir(a);
        check(`Archivo de la interfaz ${a}`, x.st === 200 && String(x.datos).length > 100, x.st);
      }
      check('La interfaz trae su código (assets/*.js)', assets.some((a) => a.endsWith('.js')), assets);
      r = await pedir('/#/ajustes');
      check('Una pantalla interna (#/ajustes) da la interfaz', r.st === 200 && /<title>anuncios-IA by Kalethabh<\/title>/.test(String(r.datos)));
      const rutas = {};
      for (const ruta of ['/api/estado', '/api/ajustes', '/api/estilos', '/api/anuncios', '/api/productos', '/api/claves', '/api/tablero', '/api/produccion/fila', '/api/claude/estado', '/api/voces/por-estilo']) {
        try {
          r = await pedir(ruta);
        } catch (e) {
          r = { st: 0, datos: e.message };
        }
        rutas[ruta] = r.datos;
        check(`GET ${ruta} responde (${r.st})`, r.st >= 200 && r.st < 300 && r.datos && typeof r.datos === 'object', { st: r.st, datos: r.datos });
      }
      r = await pedir('/api/no-existe');
      check('Una ruta /api que no existe da 404 en JSON', r.st === 404 && typeof r.datos?.error === 'string', r);
      const est = rutas['/api/estado'] || {};
      check('Modo prueba activo (no se gasta nada)', est.modoPrueba?.activo === true && !est.modoPrueba?.error, est.modoPrueba);
      check('Claude Code (el falso) aparece instalado', est.claudeCode?.instalado === true, est.claudeCode);
      check('Las 13 opciones de estilo están en /api/estilos', Array.isArray(rutas['/api/estilos']?.estilos) && rutas['/api/estilos'].estilos.length >= 12, rutas['/api/estilos']?.estilos?.map((e) => e.clave));
      const sinMuestra = (rutas['/api/estilos']?.estilos || []).filter((e) => !e.muestra).map((e) => e.clave);
      if (sinMuestra.length) aviso(`Estilos sin video de muestra: ${sinMuestra.join(', ')} (con --sin-muestras es lo esperado).`);

      // ---------------------------------------------------------- Tu PC
      const revs = rutas['/api/ajustes']?.equipo?.revisiones || [];
      const rev = (re) => revs.filter((x) => re.test(x.id));
      const verRev = (nombre, re) => {
        const v = rev(re);
        return check(`Tu PC ve ${nombre}`, v.length > 0 && v.every((x) => x.ok === true), v.length ? v : `no hay una revisión de ${nombre} en /api/ajustes (hay: ${revs.map((x) => x.id).join(', ')})`);
      };
      verRev('ffmpeg', /ffmpeg/i);
      if (rev(/vp9|vpx/i).length) verRev('VP9 en ffmpeg', /vp9|vpx/i);
      verRev('Python con sus paquetes', /python|rembg/i);
      verRev('Node.js', /^node/i);
      if (rev(/^navegador$/).length) verRev('el navegador que arma los videos', /^navegador$/);
      const obligatorios = revs.filter((x) => x.obligatorio === true);
      if (obligatorios.length) check(`Tu PC: todo lo obligatorio está listo (${obligatorios.map((x) => x.id).join(', ')})`, obligatorios.every((x) => x.ok === true), obligatorios.filter((x) => x.ok !== true));

      // ---------------------------------------------------------- un anuncio claymation de punta a punta
      if (process.env.HUMO_SIN_ANUNCIO !== '1') {
        seccion('Un anuncio claymation de punta a punta (simulado)');
        anuncio = await producirAnuncio({ pedir, check, aviso, salio: () => salio, t0 });
      }

      // ---------------------------------------------------------- red
      seccion('Red');
      try {
        const e = (await pedir('/api/estado')).datos;
        check('La guardia no tuvo que cortar ninguna salida a internet del motor', e?.modoPrueba?.salidasBloqueadas === 0, e?.modoPrueba);
      } catch (e) {
        check('La guardia no tuvo que cortar ninguna salida a internet del motor', false, e.message);
      }
      const notas = fs.readFileSync(REGISTRO, 'utf8').split('\n').filter(Boolean).map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return {};
        }
      });
      const errores = notas.filter((x) => x.tipo === 'error');
      check('El Claude falso no tuvo errores', !errores.length, errores);
      if (process.env.HUMO_SIN_ANUNCIO !== '1') {
        const tareas = notas.filter((x) => x.tipo === 'tarea').map((x) => x.tarea);
        check(`Claude (falso) recibió la ficha, el guion y las revisiones (${tareas.length} sesiones)`, tareas.some((x) => /^ficha/.test(x)) && tareas.some((x) => /^guion/.test(x)), tareas);
        const conClave = notas.filter((x) => x.tipo === 'tarea' && (x.entorno || []).length);
        check('Claude se lanza sin claves (ni de Anthropic ni del motor): con la cuenta del usuario', !conClave.length, conClave.map((x) => x.entorno));
      }
    }

    // ------------------------------------------------------------ cerrar la app
    if (!salio) {
      try {
        if (WIN) correr('taskkill', ['/pid', String(appProc.pid), '/T', '/F']);
        else {
          process.kill(-appProc.pid, 'SIGTERM');
          await dormir(2000);
          try {
            process.kill(-appProc.pid, 'SIGKILL');
          } catch {
            /* ya cerró */
          }
        }
      } catch {
        /* ya cerró */
      }
    }
    await dormir(1500);
    logApp.end();
  }

  const fallas = resultados.filter((x) => !x.ok);
  const informe = {
    fecha: new Date().toISOString(),
    plataforma: `${process.platform} ${os.release()} ${process.arch}`,
    node: process.version,
    python: versionPy,
    carpeta: RAIZ,
    segundos: Math.round((Date.now() - t0) / 1000),
    total: resultados.length,
    fallas: fallas.map((x) => x.nombre),
    avisos,
    anuncio,
    resultados,
  };
  fs.writeFileSync(path.join(INFORME, 'informe.json'), `${JSON.stringify(informe, null, 2)}\n`);
  console.log(`\n${resultados.length - fallas.length}/${resultados.length} OK en ${informe.segundos} s${fallas.length ? ` · FALLAS: ${fallas.map((x) => x.nombre).join(' | ')}` : ''}`);
  console.log(`Informe: ${path.join(INFORME, 'informe.json')}`);
  process.exit(fallas.length ? 1 : 0);
}

/** El recorrido de la interfaz: producto → ficha → anuncio → guion → producir → MP4. Devuelve un resumen. */
async function producirAnuncio({ pedir, check, aviso, salio, t0 }) {
  const resumen = { producto: null, slug: null, pasos: [], videos: [] };
  const esperar = async (que, minutos, leer, terminado) => {
    const limite = Date.now() + minutos * 60000;
    let ultimo = null;
    while (Date.now() < limite && !salio()) {
      try {
        ultimo = await leer();
        if (terminado(ultimo)) return ultimo;
      } catch (e) {
        ultimo = { error: e.message };
      }
      await dormir(1500);
    }
    return { ...ultimo, _seAcaboElTiempo: `${que}: ${minutos} min` };
  };

  // ------------------------------------------------------------ el producto con su foto y su ficha
  let r = await pedir('/api/productos', { json: { nombre: 'Producto Humo', tipo: 'fisico', descripcion: 'Un frasco de gomitas para tener energía por la tarde. Se toman dos al día. Envío gratis y pago al recibir.' } });
  const id = r.datos?.id;
  resumen.producto = id;
  if (!check('Se crea el producto (POST /api/productos)', r.st === 201 && id, r)) return resumen;
  r = await pedir(`/api/productos/${id}/fotos/1`, { metodo: 'PUT', cuerpo: pngFrasco(), headers: { 'Content-Type': 'image/png' } });
  check('Se sube la foto del producto', r.st === 200, r);
  r = await pedir(`/api/productos/${id}/analizar`, { json: {} });
  check('Se pide la ficha del producto (Claude falso)', r.st >= 200 && r.st < 300, r);
  const ficha = await esperar('la ficha', 5, async () => (await pedir(`/api/productos/${id}`)).datos, (d) => ['lista', 'error'].includes(d?.tarea?.estado));
  if (!check('La ficha queda lista', ficha?.tarea?.estado === 'lista' && ficha?.ficha, ficha?.tarea || ficha)) return resumen;

  // ------------------------------------------------------------ el anuncio y su guion
  r = await pedir('/api/anuncios', { json: { productoId: id, estilo: 'claymation', voz: { id: 'sim-narrador', nombre: 'Narrador de prueba' }, continuidad: false, respuestas: {} } });
  const slug = r.datos?.slug;
  resumen.slug = slug;
  if (!check('Se crea el anuncio claymation (POST /api/anuncios)', r.st === 201 && slug, r)) return resumen;
  const guion = await esperar('el guion', 5, async () => (await pedir(`/api/anuncios/${slug}/guion`)).datos, (d) => ['listo', 'error', 'bloqueado'].includes(d?.estado));
  if (!check('El guion queda listo', guion?.estado === 'listo' && guion?.guion?.partes?.length === 3, { estado: guion?.estado, error: guion?.error, progreso: guion?.progreso?.slice?.(-5), tiempo: guion?._seAcaboElTiempo })) return resumen;

  // ------------------------------------------------------------ aprobar y producir
  r = await pedir(`/api/anuncios/${slug}/producir`, { json: {} });
  if (!check('Se aprueba el guion y arranca la producción', r.st >= 200 && r.st < 300, r)) return resumen;
  const vistos = new Map();
  const c = await esperar('la producción', 35, async () => {
    const d = (await pedir(`/api/anuncios/${slug}/conductor`)).datos;
    for (const p of d?.pasos || []) {
      const k = `${p.estado}`;
      if (vistos.get(p.id) !== k) {
        vistos.set(p.id, k);
        if (p.estado !== 'pendiente') console.log(`   · ${Math.round((Date.now() - t0) / 1000)} s  ${p.id}: ${p.estado}${p.nota ? ` (${String(p.nota).slice(0, 120)})` : ''}`);
      }
    }
    return d;
  }, (d) => ['listo', 'error', 'pausado'].includes(d?.estado));
  resumen.pasos = (c?.pasos || []).map((p) => `${p.id}=${p.estado}`);
  if (!check('La producción termina («listo») sin errores', c?.estado === 'listo', { estado: c?.estado, paso: c?.paso, error: c?.error, mensaje: c?.mensaje, pasos: resumen.pasos, tiempo: c?._seAcaboElTiempo })) return resumen;

  // ------------------------------------------------------------ los MP4
  const salida = path.join(RAIZ, 'output');
  const nuevos = listar(salida, (f) => /\.mp4$/i.test(f) && fs.statSync(f).mtimeMs >= t0 - 1000);
  for (const f of nuevos) {
    const p = correr('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height:format=duration', '-of', 'json', f]);
    const j = (() => {
      try {
        return JSON.parse(p.stdout);
      } catch {
        return {};
      }
    })();
    const v = (j.streams || []).find((s) => s.codec_type === 'video');
    const a = (j.streams || []).find((s) => s.codec_type === 'audio');
    resumen.videos.push({ archivo: path.relative(RAIZ, f), bytes: fs.statSync(f).size, segundos: Number(j.format?.duration) || 0, video: v ? `${v.codec_name} ${v.width}x${v.height}` : null, audio: a?.codec_name || null });
  }
  check(`Salió el MP4 en output/ (${nuevos.length})`, nuevos.length > 0, salida);
  for (const v of resumen.videos) {
    check(`${v.archivo}: video ${v.video}, audio ${v.audio}, ${v.segundos.toFixed(1)} s`, v.video && v.audio && v.segundos > 5 && v.bytes > 20000, v);
  }
  const archivo = resumen.videos[0] && path.basename(resumen.videos[0].archivo);
  if (archivo) {
    const x = await fetch(`http://127.0.0.1:${Number(process.env.PUERTO) || 4497}/archivos/salida/${encodeURIComponent(archivo)}`, { headers: { Range: 'bytes=0-99' } });
    check('La app sirve el MP4 (/archivos/salida/…)', x.status === 200 || x.status === 206, x.status);
  }
  r = await pedir('/api/anuncios');
  const enLista = (r.datos?.anuncios || []).find((a) => a.slug === slug);
  check('El anuncio aparece en Mis anuncios', !!enLista, (r.datos?.anuncios || []).map((a) => a.slug));
  if (!fs.existsSync(path.join(RAIZ, 'remotion', 'node_modules', '.remotion'))) aviso('No quedó remotion/node_modules/.remotion (el navegador del armado de videos).');
  return resumen;
}

// ---------------------------------------------------------------- arranque según el papel
if (COMO_CLAUDE) await claudeFalso();
else await prueba();

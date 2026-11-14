// IMAGENES CON LA SUSCRIPCION DE CHATGPT (Codex, la herramienta image_gen): sin costo por imagen.
//
//   generarConChatGPT({ prompt, referencias, aspecto, rutaDestino, codex, plazoMs, alAvisar })
//     -> { ruta, segundos, modeloReal, creditos: 0, taskId: null }
//
// `codex` = { cmd, pre, home, trabajo } (lo pasa la app en AIA_CHATGPT_IMAGENES, ver codexDesdeEntorno). Corre UN
// `codex exec` por imagen con el perfil de imagenes: el de la app (todo apagado) pero con code_mode_host e
// image_generation encendidos, que es lo que necesita image_gen. Las referencias van en el MISMO orden que en kie
// (los prompts dicen «la primera imagen adjunta», «la segunda»…), por -i y por referenced_image_paths.
//
// La imagen la guarda Codex en <home>/generated_images/<hilo>/*.png. Si el formato no es el pedido (por ejemplo
// 2:3 en vez de 9:16), se recorta al centro con ffmpeg; despues se copia a rutaDestino de una vez (temporal +
// renombre) y se borra la de Codex.
//
// Los errores traen una marca para quien llama:
//   sinSesion   ChatGPT no tiene la sesion iniciada (Ajustes › Conexiones)
//   limite      se acabo el uso de la ventana de ChatGPT (no es un intento: se vuelve a pedir despues)
//   contenido   ChatGPT no quiso hacerla por sus reglas
//   esFalloDeModelo  cualquier otro fallo de la generacion (cuenta como intento)
import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const MODELO_CHATGPT = 'gpt-image (ChatGPT)';
const PLAZO_MS = 6 * 60 * 1000;

const APAGADAS = [
  'shell_tool', 'unified_exec', 'browser_use', 'computer_use', 'in_app_browser', 'apps', 'plugins',
  'sleep_tool', 'multi_agent', 'goals', 'view_image', 'tool_suggest', 'skill_search', 'hooks',
  'daemon_auto_start', 'shell_snapshot', 'workspace_dependencies', 'remote_plugin', 'plugin_discovery_prefetch',
  'skill_mcp_dependency_install', 'secret_auth_storage', 'fast_mode', 'ultrafast_mode',
];

const PROPORCION = { '1:1': 1, '4:5': 4 / 5, '9:16': 9 / 16, '16:9': 16 / 9, '3:4': 3 / 4, '2:3': 2 / 3 };
const NOMBRE_FORMATO = { '1:1': 'square 1:1', '4:5': 'portrait 4:5', '9:16': 'vertical 9:16 (tall, full-screen story)', '16:9': 'landscape 16:9' };

/** Lo que manda la app en el entorno (JSON) o null. */
export function codexDesdeEntorno(env = process.env) {
  try {
    const c = JSON.parse(String(env.AIA_CHATGPT_IMAGENES || ''));
    if (c && typeof c.cmd === 'string' && c.cmd && typeof c.home === 'string' && c.home) {
      return { cmd: c.cmd, pre: Array.isArray(c.pre) ? c.pre.map(String) : [], home: c.home, trabajo: c.trabajo || c.home };
    }
  } catch {
    /* sin datos */
  }
  return null;
}

function argsImagen({ trabajo, referencias }) {
  return [
    'exec', '--json', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules',
    '-s', 'read-only', '-C', trabajo,
    ...APAGADAS.flatMap((f) => ['--disable', f]),
    '-c', 'web_search="disabled"',
    '-c', 'model_reasoning_effort="low"',
    '-c', 'check_for_update_on_startup=false',
    '-c', 'project_doc_max_bytes=0',
    '-c', 'skills.include_instructions=false',
    '-c', 'forced_login_method="chatgpt"',
    '-c', 'cli_auth_credentials_store="file"',
    '-c', 'model_auto_compact_token_limit=1000000000',
    ...referencias.flatMap((r) => ['-i', r]),
  ];
}

/** El mensaje: una sola llamada a image_gen con el prompt de la app palabra por palabra. */
export function mensajeImagen({ prompt, referencias, aspecto }) {
  const formato = NOMBRE_FORMATO[aspecto] || aspecto;
  const refs = referencias.length
    ? `Use referenced_image_paths: ${JSON.stringify(referencias)} in exactly this order (the first path is the FIRST attached image, the second is the SECOND, and so on).`
    : 'There are no reference images.';
  return [
    'Call the image_gen.imagegen tool exactly ONCE, right now, without asking anything and without using any other tool.',
    refs,
    `transparent_background: false. The output image MUST be ${formato}.`,
    'Use EXACTLY the prompt between <<<PROMPT and PROMPT>>> as the tool prompt, word for word (do not translate, shorten or add anything):',
    '<<<PROMPT',
    String(prompt || '').trim(),
    'PROMPT>>>',
    'When the tool finishes, reply with only the absolute path of the saved image file. If it fails, reply with "ERROR: " and the exact error.',
  ].join('\n');
}

const RE_LIMITE = /usage limit|rate[ _-]?limit|too many requests|\b429\b|try again (in|at|later)|hit your .*limit|quota/i;
const RE_SESION = /not logged in|please (log ?in|sign ?in)|login required|unauthori[sz]ed|\b401\b|refresh token|token (expired|is expired|has expired)|auth(entication)? (failed|error)/i;
const RE_CONTENIDO = /safety|moderation|content polic|policy violation|not allowed|can't (help|create|generate)|cannot (help|create|generate)|unable to (create|generate)|rejected/i;

function errorCon(mensaje, marcas) {
  return Object.assign(new Error(mensaje), marcas);
}

/** Clasifica el texto de un fallo de Codex. */
export function errorDeTexto(texto) {
  const t = String(texto || '').trim().slice(0, 600) || 'ChatGPT no devolvió ninguna imagen';
  if (RE_SESION.test(t)) return errorCon(`ChatGPT no tiene la sesión iniciada: ${t}`, { sinSesion: true });
  if (RE_LIMITE.test(t)) return errorCon(`Se acabó el uso de ChatGPT por ahora: ${t}`, { limite: true });
  if (RE_CONTENIDO.test(t)) return errorCon(`ChatGPT no quiso hacer esta imagen: ${t}`, { contenido: true, esFalloDeModelo: true });
  return errorCon(`ChatGPT no pudo hacer la imagen: ${t}`, { esFalloDeModelo: true });
}

const esPng = (r) => /\.(png|jpe?g|webp)$/i.test(r);

function imagenesDelHilo(home, hilo) {
  if (!hilo) return [];
  const dir = path.join(home, 'generated_images', hilo);
  try {
    return fs
      .readdirSync(dir)
      .filter(esPng)
      .map((n) => path.join(dir, n))
      .map((r) => ({ r, t: fs.statSync(r).mtimeMs }))
      .sort((a, b) => b.t - a.t)
      .map((x) => x.r);
  } catch {
    return [];
  }
}

function medir(ruta) {
  // PNG: ancho y alto en el IHDR. JPG/WEBP: ffprobe.
  try {
    const fd = fs.openSync(ruta, 'r');
    const b = Buffer.alloc(24);
    fs.readSync(fd, b, 0, 24, 0);
    fs.closeSync(fd);
    if (b.readUInt32BE(0) === 0x89504e47) return { ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20) };
  } catch {
    /* sigue */
  }
  return null;
}

function correrFfmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { windowsHide: true }, (err, _o, stderr) => {
      if (err) reject(new Error(`ffmpeg: ${String(stderr || err.message).trim().slice(0, 300)}`));
      else resolve();
    });
  });
}

/** Copia la imagen a destino con el formato pedido (recorte al centro si hace falta), de una vez. */
async function dejarEnDestino(origen, rutaDestino, aspecto) {
  fs.mkdirSync(path.dirname(rutaDestino), { recursive: true });
  const tmp = `${rutaDestino}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp.png`;
  const objetivo = PROPORCION[aspecto];
  const m = medir(origen);
  const desvio = objetivo && m ? Math.abs(m.ancho / m.alto - objetivo) / objetivo : 0;
  try {
    if (objetivo && (!m || desvio > 0.015 || !/\.png$/i.test(origen))) {
      const crop = `crop='min(iw,ih*${objetivo})':'min(ih,iw/${objetivo})'`;
      await correrFfmpeg(['-i', origen, '-vf', `${crop},scale=trunc(iw/2)*2:trunc(ih/2)*2`, '-frames:v', '1', tmp]);
    } else {
      fs.copyFileSync(origen, tmp);
    }
    fs.renameSync(tmp, rutaDestino);
  } finally {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      /* nada */
    }
  }
}

/**
 * Una imagen con ChatGPT. Nunca deja un archivo a medias en rutaDestino.
 * alAvisar(segundos) cada minuto mientras espera.
 */
export async function generarConChatGPT({ prompt, referencias = [], aspecto = '1:1', rutaDestino, codex, plazoMs = PLAZO_MS, alAvisar = null, senal = null }) {
  if (!codex) throw errorCon('Falta conectar ChatGPT para hacer imágenes. Ve a Ajustes › Conexiones › ChatGPT · Imágenes.', { sinSesion: true });
  const refs = referencias.map((r) => path.resolve(String(r)));
  for (const r of refs) if (!fs.existsSync(r)) throw errorCon(`Falta la imagen de referencia: ${r}`, { esFalloDeModelo: true });
  fs.mkdirSync(codex.trabajo, { recursive: true });
  const t0 = Date.now();

  const { codigo, eventos, stderr } = await new Promise((resolve) => {
    let hijo;
    try {
      hijo = spawn(codex.cmd, [...codex.pre, ...argsImagen({ trabajo: codex.trabajo, referencias: refs })], {
        cwd: codex.trabajo,
        env: entornoImagen(codex.home),
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch (e) {
      return resolve({ codigo: null, eventos: [], stderr: e.message });
    }
    const eventos = [];
    let buf = '';
    let err = '';
    hijo.stdout.setEncoding('utf8');
    hijo.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const l = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!l) continue;
        try {
          eventos.push(JSON.parse(l));
        } catch {
          /* linea suelta */
        }
      }
    });
    hijo.stderr.setEncoding('utf8');
    hijo.stderr.on('data', (d) => {
      err = (err + d).slice(-4000);
    });
    const aviso = alAvisar ? setInterval(() => alAvisar(Math.round((Date.now() - t0) / 1000)), 60000) : null;
    const plazo = setTimeout(() => {
      err += '\nSe pasó del tiempo de espera (timeout).';
      try {
        hijo.kill('SIGTERM');
      } catch {
        /* ya salio */
      }
    }, plazoMs);
    const alCortar = () => {
      try {
        hijo.kill('SIGTERM');
      } catch {
        /* ya salio */
      }
    };
    senal?.addEventListener?.('abort', alCortar, { once: true });
    hijo.on('error', (e) => {
      err += `\n${e.message}`;
    });
    hijo.on('close', (c) => {
      clearTimeout(plazo);
      if (aviso) clearInterval(aviso);
      senal?.removeEventListener?.('abort', alCortar);
      resolve({ codigo: c, eventos, stderr: err });
    });
    hijo.stdin.end(mensajeImagen({ prompt, referencias: refs, aspecto }));
  });

  const hilo = eventos.find((e) => e.type === 'thread.started')?.thread_id || null;
  const mensajes = eventos.filter((e) => e.type === 'item.completed' && e.item?.type === 'agent_message').map((e) => String(e.item.text || '').trim());
  const fallos = eventos
    .filter((e) => e.type === 'error' || e.type === 'turn.failed' || (e.type === 'item.completed' && e.item?.type === 'error'))
    .map((e) => e.message || e.error?.message || e.item?.message || JSON.stringify(e).slice(0, 300));

  // La imagen: la ruta que contesto (si existe y es de su carpeta) o la mas nueva del hilo.
  const dirImagenes = path.join(codex.home, 'generated_images');
  let ruta = null;
  for (const m of mensajes.slice().reverse()) {
    const r = m.split('\n').map((x) => x.trim().replace(/^`+|`+$/g, '')).find((x) => esPng(x) && path.isAbsolute(x));
    if (r && path.resolve(r).startsWith(path.resolve(dirImagenes)) && fs.existsSync(r)) {
      ruta = r;
      break;
    }
  }
  if (!ruta) ruta = imagenesDelHilo(codex.home, hilo)[0] || null;

  if (!ruta) {
    if (senal?.aborted) throw errorCon('Se detuvo antes de terminar la imagen.', { cancelado: true });
    const texto = [...fallos, ...mensajes.filter((m) => /^ERROR/i.test(m) || m), stderr.split('\n').filter((l) => l.trim() && !/^Reading prompt/i.test(l)).slice(-4).join(' ')]
      .filter(Boolean)
      .join(' | ');
    throw errorDeTexto(texto || `Codex salió con código ${codigo}`);
  }

  await dejarEnDestino(ruta, rutaDestino, aspecto);
  try {
    fs.rmSync(path.dirname(ruta), { recursive: true, force: true }); // la carpeta del hilo (solo imagenes de este pedido)
  } catch {
    /* queda; no molesta */
  }
  return { ruta: rutaDestino, segundos: Math.round((Date.now() - t0) / 1000), modeloReal: MODELO_CHATGPT, creditos: 0, taskId: hilo };
}

/** El entorno de Codex: sin claves de otras cuentas, con el CODEX_HOME de la app. */
function entornoImagen(home) {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (/^(OPENAI_|CODEX_|AZURE_OPENAI_|ANTHROPIC_|CLAUDE_|KIE_|ELEVENLABS_|APIMART_|SUNO_|AIA_CHATGPT_)/i.test(k)) delete env[k];
  }
  env.CODEX_HOME = home;
  env.NO_COLOR = '1';
  return env;
}

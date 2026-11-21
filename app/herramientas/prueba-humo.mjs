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
//            HUMO_SIN_IMAGEN_ADS=1  sin el lote de anuncios de imagen
//            HUMO_MOTOR=claude|codex  con que IA (falsa) se prueba (por defecto claude). Con codex la app lanza el Codex
//                                falso (app/server/claude/pruebas/codex-falso.js), con su CODEX_HOME en HUMO_INFORME, y
//                                ese falso le pide las respuestas a este mismo archivo (FALSO_CODEX_CLAUDE)
//            HUMO_SIN_CASOS=1    con codex, sin los casos dificiles de la segunda app (ver abajo)
//            HUMO_PUERTO_2=<n>   el puerto de esa segunda app (por defecto PUERTO + 1)
//            HUMO_SIN_REGENERAR=1  sin lo de «todo al primer intento» (regenerar, tu video, exportar, objeto parlante)
//            HUMO_SIN_MODO_B=1   sin el anuncio de objeto parlante (tu video «en el anuncio»)
//
// Qué hace, SIN GASTAR NADA: arranca la app de esta carpeta en MODO PRUEBA (ANUNCIOS_MODO_PRUEBA=1: kie.ai, ElevenLabs
// y Suno simulados en 127.0.0.1 y la guardia de red que corta cualquier salida del motor) con un Claude Code FALSO
// (este mismo archivo, por ANUNCIOS_CLAUDE_BIN), y comprueba:
//   · los lanzadores (el .bat con CRLF, el .command con LF y bash -n), node --check del servidor y del motor;
//   · los programas que usa la app: Node.js, ffmpeg y ffprobe con VP9 (libvpx-vp9), Python con rembg, onnxruntime,
//     Pillow y NumPy (con la misma revisión que hace el motor: recortar-host.py --verificar);
//   · que la interfaz carga (GET / y sus archivos) y que las rutas /api principales responden sin error;
//   · que Ajustes → Tu PC ve ffmpeg, Python y Node.js;
//   · Ajustes → Modelos: GET /api/ajustes trae los modelos para elegir (con su costo en dólares, sin ids de kie), el
//     PUT /api/ajustes/modelos guarda lo válido (200), rechaza lo que no existe (400) y lo que viene de otra página
//     (403); /api/estado muestra lo elegido. Se deja como estaba (en el config.json del modo prueba);
//   · UN anuncio claymation de punta a punta, como lo hace la interfaz: crea el producto (con su foto), arma la ficha,
//     crea el anuncio, espera el guion, lo aprueba y produce hasta el MP4 (imágenes, videos, voz, música, montaje y el
//     render de Remotion), y revisa el MP4 con ffprobe;
//   · el costo estimado (excepción a "sin precios" del 2026-11-09): con el guion listo, GET /api/anuncios/<slug>/costo
//     da un solo número > 0 (sin margen: la app ya no rehace nada sola), «Con otro modelo» con sus categorías, el mismo
//     número que produccion/estimar-costo.js, sale de la caché, se rechaza desde otra página, y «Usar este» (PUT
//     /api/ajustes/modelos) cambia la elección y el número; ya aprobado no da número, el anuncio sigue con sus modelos
//     aunque Ajustes cambie, la revisión no pagó nada y lo cobrado es el estimado; el precio por imagen de
//     /api/imagen-ads/opciones y costoDelLote del formulario; y los textos de la tarjeta en la interfaz armada;
//   · al mismo tiempo que el claymation, UN lote de anuncios de imagen (3 variaciones 1:1 + 9:16 con logo): generar,
//     revision simulada (sin reintento: lo que ve queda «con detalles»), logo, prompt, regenerar, zip e informe (80
//     creditos "habria costado"); que el video no espera en la fila por el lote y que nunca hay 2 sesiones de Claude
//     de lotes (probarImagenAds);
//   · TODO AL PRIMER INTENTO (DISENO-primer-intento §5; salvo HUMO_SIN_REGENERAR), con el claymation ya entregado: la
//     revisión solo deja un aviso (nada se rehízo solo; el aviso está en GET /produccion, en la entrega y en su
//     informe); GET /rehacer con el costo de cada pieza (el del motor) y lo que no se ofrece; subir tu video (armado
//     con ffmpeg: un testsrc .mov y uno de colores) en modo «en la edición», normalizado a H.264 720x1280 30 fps; la
//     velocidad y el deslizar en una exportación (los colores dicen qué segundo de tu video se ve); «Regenerar» tal
//     cual y «Corregir esto» en UN lote, «¿Qué salió mal?» (con la IA elegida) que espera en la fila y arranca solo,
//     «Quitar» de la fila; solo se regenera lo pedido, lo de antes queda en historial/, el aviso se va y no vuelve, lo
//     cobrado es lo que decía cada botón y se avisa que la versión editada quedó vieja; descargar el video, un clip y
//     una imagen (200 con su tipo). Y un anuncio de OBJETO PARLANTE (salvo HUMO_SIN_MODO_B) para tu video «en el
//     anuncio» (modo B): sin sonido no se puede, con sonido reemplaza la escena y se vuelve a armar desde la revisión de
//     los clips sin pedirle nada a kie; «Volver al clip original» lo deshace;
//   · que la guardia no tuvo que cortar ninguna salida a internet.
// Con las dos IA (DISENO-motor-codex §6.2), ademas:
//   · /api/ia/estado (o /api/claude/estado, el alias de respaldo) y /api/estado.motor dicen la IA elegida, instalada
//     y con sesion, y Tu PC trae `motor` en verde;
//   · la IA se lanza sin claves (ni de Anthropic, ni de OpenAI ni CODEX_API_KEY, ni del motor);
//   · el codigo: app/inicio/codex/ (package.json, el lock de 0.167.0 con las 4 plataformas de Mac y Windows y su
//     integrity, .npmrc con include=optional y release-0.167.0.json); ningun lanzador corre install.ps1 ni
//     install.sh; ningun texto de la pantalla enlaza a developers.openai.com/codex/cli;
//   · preparar-motor.mjs con un config.json que tiene bienvenidaVista: true y no tiene motor (un alumno que se
//     actualiza) guarda motor: 'claude'; sin la bienvenida no guarda nada (en un config de prueba propio);
//   · con Claude: las reglas que recibe el guion le prohiben modelos.json, img/ y video/ del anuncio, y las de la
//     ficha, producto.json;
//   · con Codex: cada mensaje con sus banderas, la entrada cerrada, sus imagenes y sin claves, y con todo su material.
// Y con Codex (salvo HUMO_SIN_ANUNCIO o HUMO_SIN_CASOS), una SEGUNDA app de prueba en PUERTO + 1, sin IA fijada
// (AIA_MOTOR no va: la IA se elige con PUT /api/ia/elegir, como en la pantalla), con un modo del Codex falso por
// tarea (FALSO_CODEX_CONFIG): `fuera` no escribe nada de lo prohibido (.env y app/config.json iguales byte por byte;
// ni modelos.json, img/, video/, app/conductor.json ni producto.json), `mal` se corrige por exec resume, el
// validar-manifiesto va por `comandos`, `por-partes`, `cortada`, `contexto` y `mal+ediciones-mal` terminan bien sin
// correcciones de mas, `sin-sesion` y `plan-sin-codex` dejan su tarjeta, `limite-a-mitad` pausa sin mandar el segundo
// mensaje (y pausa la fila de ChatGPT, no la de Claude), y un lote de imagen con `plan-sin-codex` queda en error sin
// reintentar solo; con `limite` espera y, al elegir Claude, sigue con Claude (la pausa queda en la IA que trabajo).
// Los casos con `fuera` corren solo si el .env lo escribio esta prueba (una carpeta descartable: el CI o una copia).
// El anuncio se crea en temp/ y output/ de ESTA carpeta: por eso no corre si temp/ ya tiene anuncios de alguien
// (la carpeta de trabajo de verdad), salvo con HUMO_FORZAR=1. En GitHub la carpeta es nueva y se tira al terminar.
//
// El mismo archivo es el Claude falso: cuando la app lo lanza como `claude` (con -p, auth o --version), escribe el guion
// claymation y el de objeto parlante él solo (sin depender de anuncios de muestra en temp/) y pasa todo lo demás (ficha,
// revisiones, «¿Qué salió mal?») al Claude falso de la app: app/server/claude/pruebas/claude-falso.js.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import readline from 'node:readline';
import cp from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const APP = path.resolve(path.dirname(SELF), '..');
const RAIZ = path.resolve(APP, '..');
const WIN = process.platform === 'win32';
const ARGS = process.argv.slice(2);
const COMO_CLAUDE = ARGS.includes('-p') || ARGS[0] === 'auth' || ARGS[0] === '--version';
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
/** Un número para los textos de la prueba, con coma decimal (1,57). */
const coma = (x, d = 2) => (x !== null && x !== undefined && Number.isFinite(Number(x)) ? String(Math.round(Number(x) * 10 ** d) / 10 ** d).replace('.', ',') : '?');
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

/**
 * Un manifiesto de OBJETO PARLANTE corto (2 escenas habladas, sin B-roll): la voz va dentro de cada clip, así que tu
 * video reemplaza la escena «en el anuncio» (modo B) y la app vuelve a medir la voz. Lo procesa el motor de verdad.
 */
function manifiestoObjetoParlante(foto) {
  const estilo =
    'Disney-Pixar style 3D animation, warm cinematic lighting with golden hour glow, soft volumetric light rays, shallow depth of field, subsurface scattering, vibrant warm color palette, slightly exaggerated character proportions, octane render, 8k, ultra-detailed.';
  const negativo =
    'Negative prompt: human body wearing the object as a costume, humanoid body replacing the object shape, packaging silhouette distorted, label redrawn or invented, photorealistic live-action, flat 2D cartoon, anime, text, captions, subtitles, watermark.';
  const taza =
    'CHARACTER: a tired white ceramic coffee mug with a small chip on its rim, big round sleepy eyes on its side, heavy drooping eyebrows and an expressive mouth capable of natural speech and lip-sync, two small ceramic arms, Pixar-style 3D render, subsurface scattering on the glossy ceramic, soft rounded shapes, animated eyebrows for emotion';
  const frasco =
    'CHARACTER: the product jar exactly as in the reference photo, keeping its exact silhouette, proportions and label design unchanged. A face occupies only the label: two big round friendly eyes, calm arched eyebrows and an expressive mouth capable of natural speech and lip-sync. No arms, no legs. Pixar-style 3D render, soft rounded shapes, animated eyebrows for emotion';
  const lineas = ['Soy el café de las cinco. Te despierto un rato y después te dejo peor.', 'Yo soy Producto Humo: dos gomitas y la tarde vuelve a ser tuya.'];
  const video = (seg, quien, voz, linea, movimiento, animo) =>
    `Duración: ${seg}s. Pixar-style 3D animation, image-to-video from the shot above.\nThe ${quien} speaks with natural lip-sync, using ${voz}: "${linea}"\nHabla en español latino neutro.\nCamera: very slow dolly-in\nMotion: ${movimiento}\nLighting: warm golden-hour glow, soft rim light on character\nMood: ${animo}`;
  const m = {
    estilo: 'talking-object-pixar',
    modo_audio: 'dialogo_nativo',
    mercado: 'LatAm',
    idioma: 'es',
    aspect_ratio: '9:16',
    referencias: [{ id: 'taza', tipo: 'personaje', prompt: `Vertical 9:16 clean character sheet, the mug centred and facing camera, filling the frame. ${taza}. Plain soft warm neutral background, no props. ${estilo} ${negativo}` }],
    tomas: [
      {
        n: 1, tipo: 'A', duracion: 6, linea: lineas[0],
        prompt_imagen_inicial: `Vertical 9:16 medium close-up on a kitchen counter in the late afternoon. ${taza}. The mug stands next to an empty coffee pot, looking guilty and a little smug. ${estilo} ${negativo}`,
        prompt_imagen_final: null,
        prompt_video: video(6, 'tired white coffee mug', 'adult male voice, sleepy and honest', lineas[0], 'the mug shrugs once with its small ceramic arm and lets it drop', 'confesión sin culpa'),
        referencias: ['taza'],
      },
      {
        n: 2, tipo: 'A', duracion: 6, linea: lineas[1],
        prompt_imagen_inicial: `Vertical 9:16 medium shot on the same kitchen counter, warm light from the window. ${frasco}. The jar stands in the light with a calm confident expression. ${estilo} ${negativo}`,
        prompt_imagen_final: null,
        prompt_video: video(6, 'product jar', 'adult female voice, warm and confident', lineas[1], 'the jar leans slightly toward the camera and smiles', 'el giro: calma y confianza'),
        referencias: foto ? ['producto'] : ['taza'],
      },
    ],
    broll: [],
    overlays: [],
  };
  if (foto) {
    m.referencias.push({
      id: 'producto', tipo: 'producto', archivo: foto, generar_desde_archivo: true,
      nota: 'conservar forma, proporciones y etiqueta exactas del envase; solo se le agrega una cara sobre la etiqueta',
      prompt: `Vertical 9:16 clean character sheet, the jar centred, upright and facing camera, filling the frame. ${frasco}. Plain soft warm neutral background, no props. ${estilo} ${negativo}`,
    });
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
    // el estilo del anuncio (su brief): claymation o objeto parlante
    const objeto = leerJSON(path.join(RAIZ, 'temp', slug, 'app', 'brief.json'))?.estilo === 'talking-object-pixar';
    usar('Read', { file_path: path.join(RAIZ, '.claude', 'skills', objeto ? 'anuncios-talking-object-pixar' : 'anuncios-claymation', 'SKILL.md') });
    const foto = fs.readdirSync(path.join(RAIZ, 'temp', slug)).find((x) => /^producto\.(jpg|jpeg|png|webp)$/i.test(x)) || null;
    const man = objeto ? manifiestoObjetoParlante(foto) : manifiestoClaymation(foto);
    // «Tus videos e imágenes» (2026-11-19): lo que subió el usuario, como lo usaría la IA: la imagen es la de la toma 1
    // y el video, la escena del primer B-roll (sin generar ni pagar)
    const material = leerJSON(path.join(RAIZ, 'temp', slug, 'material', 'material.json')) || [];
    const img = material.find((x) => x.tipo === 'imagen');
    const vid = material.find((x) => x.tipo === 'video');
    if (img && man.tomas?.[0]) man.tomas[0].imagen_propia = `temp/${slug}/material/${img.archivo}`;
    if (vid && Array.isArray(man.broll)) man.broll.push({ n: man.broll.length + 1, despues_de_toma: 3, sincroniza_con: 'el final', duracion: 2, prompt_imagen: 'Vertical 9:16. The user video: a plain colored scene.', prompt_video: 'the user video as it is', referencias: [], desde_biblioteca: `temp/${slug}/material/${vid.archivo}` });
    escribir(`temp/${slug}/manifiesto.json`, man);
    escribir(`temp/${slug}/transiciones.json`, {
      efectos: { woosh: 'efectos/woosh.mp3', 'deep-woosh': 'efectos/deep-woosh.mp3' },
      puntos: [{ toma: objeto ? 2 : 3, animacion: 'zoom', efecto: 'deep-woosh', porque: 'entrada de la solución' }],
    });
    usar(WIN ? 'PowerShell' : 'Bash', { command: `node produccion/validar-manifiesto.js temp/${slug}/manifiesto.json` });
    escribir(
      `temp/${slug}/app/guion.json`,
      objeto
        ? {
            titulo: 'El café de las cinco (prueba de humo)',
            idioma: 'es',
            mercado: 'LatAm',
            duracionEstimada: 12,
            de_que_va: 'Una taza de café confiesa que te deja peor; el frasco de gomitas te devuelve la tarde.',
            partes: man.tomas.map((t, i) => ({ n: t.n, momento: i === 0 ? 'gancho' : 'producto', quien: i === 0 ? 'La taza de café' : 'Tu producto', dice: t.linea, se_ve: 'Un objeto animado que habla' })),
            decisiones: ['Guion corto de objeto parlante de la prueba de humo (Claude falso).'],
          }
        : {
            titulo: 'La pausa de la tarde (prueba de humo)',
            idioma: 'es',
            mercado: 'LatAm',
            duracionEstimada: 12,
            de_que_va: 'Una mujer sin energía por la tarde encuentra su pausa.',
            partes: man.tomas.map((t, i) => ({ n: t.n, momento: i === 0 ? 'gancho' : i === 2 ? 'producto' : 'historia', dice: t.linea, se_ve: 'Una escena de plastilina' })),
            // (las imágenes de apoyo con su escena detallada, 2026-11-19k)
            broll: (man.broll || []).map((b) => ({ n: b.n, se_ve: 'Una taza de té de plastilina humea sobre su plato en la mesa de la cocina, con la luz dorada de la tarde; el vapor sube en espiral y deja una sensación de calma.', camara: 'primerísimo plano, la cámara se acerca despacio' })),
            decisiones: ['Guion corto de la prueba de humo (Claude falso).'],
          }
    );
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
      const propia = /^guion\b/.test(tarea || '') && /\.claude\/skills\/anuncios-(claymation|talking-object-pixar)\//.test(texto);
      anotar({
        tipo: 'tarea',
        tarea,
        propia,
        // por el puente del Codex falso (lleva el CODEX_HOME de la app) o lanzado por claude.js
        via: process.env.CODEX_HOME ? 'codex' : 'claude',
        args: ARGS.filter((a) => a.length < 200).slice(0, 30),
        // las reglas que prohiben (--disallowedTools): con Claude son las que lo frenan de verdad
        prohibidas: String(val('--disallowedTools') || '').split(',').map((x) => x.trim()).filter(Boolean),
        entorno: Object.keys(process.env).filter((k) => /^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_API|OPENAI_|CODEX_API_KEY|CODEX_ACCESS_TOKEN)/i.test(k)),
      });
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

/** pedir(ruta, { json, cuerpo, metodo, headers, ms }) a la app de `base` -> { st, tipo, datos }. */
function pedirA(base) {
  return async (ruta, o = {}) => {
    const cuerpo = o.json !== undefined ? JSON.stringify(o.json) : o.cuerpo;
    const headers = { Accept: 'application/json', ...(o.json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(o.headers || {}) };
    const r = await fetch(base + ruta, { method: o.metodo || (cuerpo !== undefined ? 'POST' : 'GET'), headers, body: cuerpo, redirect: 'manual', signal: AbortSignal.timeout(o.ms || 60000) });
    const tipo = r.headers.get('content-type') || '';
    const datos = tipo.includes('json') ? await r.json().catch(() => null) : await r.text();
    return { st: r.status, tipo, datos };
  };
}

/**
 * Arranca la app (server/index.js) con `env` en `puerto` y espera a que responda (90 s). Lo que dice va a `log`.
 * -> { pedir, arriba, salio() (null o { codigo, senal }), cerrar() }
 */
async function arrancarApp({ env, puerto, log }) {
  const logApp = fs.createWriteStream(log);
  const proc = cp.spawn(process.execPath, ['server/index.js'], { cwd: APP, env: { ...env, PUERTO: String(puerto) }, stdio: ['ignore', 'pipe', 'pipe'], detached: !WIN, windowsHide: true });
  proc.stdout.pipe(logApp);
  proc.stderr.pipe(logApp);
  let salio = null;
  proc.on('exit', (c, s) => (salio = { codigo: c, senal: s }));
  const pedir = pedirA(`http://127.0.0.1:${puerto}`);
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
  const cerrar = async () => {
    if (!salio) {
      try {
        if (WIN) correr('taskkill', ['/pid', String(proc.pid), '/T', '/F']);
        else {
          process.kill(-proc.pid, 'SIGTERM');
          await dormir(2000);
          try {
            process.kill(-proc.pid, 'SIGKILL');
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
  };
  return { pedir, arriba, salio: () => salio, cerrar };
}

/** Lee `leer()` cada 1,5 s hasta que `terminado(x)` o pasen `minutos` (o la app se cierre). */
async function esperarHasta(que, minutos, leer, terminado, salio = () => null) {
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
}

/** Las líneas de un .jsonl (las que no son JSON, como {}). */
const leerNotas = (f) => {
  try {
    return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return {};
      }
    });
  } catch {
    return [];
  }
};
/** El sha256 de un archivo de ESTA prueba (o null si no está). */
const sha256De = (f) => {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  } catch {
    return null;
  }
};
/** Si existe, su tamaño y su fecha: sin abrirlo. */
const statDe = (f) => {
  try {
    const st = fs.statSync(f);
    return { existe: true, size: st.size, mtimeMs: st.mtimeMs };
  } catch {
    return { existe: false };
  }
};

async function prueba() {
  const t0 = Date.now();
  const PUERTO = Number(process.env.PUERTO) || 4497;
  const BASE = `http://127.0.0.1:${PUERTO}`;
  const INFORME = path.resolve(process.env.HUMO_INFORME || path.join(os.tmpdir(), 'anuncios-con-ia-prueba-humo'));
  fs.mkdirSync(INFORME, { recursive: true });
  const REGISTRO = path.join(INFORME, 'claude-falso.jsonl');
  const HUMO_MOTOR = process.env.HUMO_MOTOR === 'codex' ? 'codex' : 'claude';
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
  let anuncio = null;
  let envDeLaPrueba = null; // el .env de claves falsas, si lo escribio esta corrida

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
    check('Lanzador de Windows: arranca la app (node inicio\\arrancar.mjs)', /node inicio\\arrancar\.mjs/.test(t));
  }
  if (check('Existe "Abrir Anuncios con IA.command"', fs.existsSync(CMD), CMD)) {
    const b = fs.readFileSync(CMD);
    check('Lanzador de Mac: empieza con #!/bin/bash y no tiene CRLF', b.toString('utf8').startsWith('#!/bin/bash\n') && !b.includes(13), 'debe tener finales de línea LF (revisa .gitattributes)');
    check('Lanzador de Mac: arranca la app (node inicio/arrancar.mjs)', /node inicio\/arrancar\.mjs/.test(b.toString('utf8')));
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
  check(`Las skills de los estilos están (.claude/skills: ${skills.length})`, skills.length >= 13 && skills.includes('anuncios-claymation') && skills.includes('anuncios-imagen-ads'), skills);
  revisarCodigoDeLasIA({ check, aviso, BAT, CMD });

  seccion('La IA de un alumno que se actualiza (preparar-motor.mjs)');
  probarPrepararMotor({ check, aviso, puerto: PUERTO });

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
      envDeLaPrueba = ENV; // (lo borra al terminar: asi otra corrida en la misma copia vuelve a ser descartable)
      console.log('   (.env de prueba con claves falsas)');
    }
    const env = { ...process.env };
    for (const k of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|APIMART_|SUNO_|OPENAI_|CODEX_)/i.test(k)) delete env[k];
    // con ChatGPT, claves falsas de OpenAI en la app: Codex no las tiene que recibir (entornoCodex las saca)
    if (HUMO_MOTOR === 'codex') Object.assign(env, { OPENAI_API_KEY: 'sk-falsa-prueba-de-humo', CODEX_API_KEY: 'falsa-prueba-de-humo' });
    Object.assign(env, {
      PUERTO: String(PUERTO),
      ANUNCIOS_MODO_PRUEBA: '1',
      ANUNCIOS_PRUEBA_LIMPIO: '1',
      ANUNCIOS_CLAUDE_BIN: SELF,
      HUMO_REGISTRO: REGISTRO,
      // (2026-11-21f) la revisión que corrige las imágenes antes de los videos: con HUMO_CORRECCION=1 se prueba esa;
      // por defecto, el camino de «solo avisa» (todo al primer intento), que es el que revisa el resto de la prueba
      ...(process.env.HUMO_CORRECCION === '1' ? {} : { ANUNCIOS_SIN_CORRECCION_IMAGENES: '1' }),
      // la IA elegida (sin AIA_MOTOR, una carpeta nueva no tiene ninguna y la app pediria elegirla)
      AIA_MOTOR: HUMO_MOTOR,
      ...(HUMO_MOTOR === 'codex'
        ? {
            ANUNCIOS_CODEX_BIN: path.join(APP, 'server', 'claude', 'pruebas', 'codex-falso.js'),
            FALSO_CODEX_CLAUDE: SELF, // el guion claymation lo escribe este archivo; lo demas, claude-falso.js
            FALSO_CODEX_SESION: 'ok',
            AIA_CODEX_HOME: path.join(INFORME, 'codex-home'), // fuera de la carpeta de la app, como en la de verdad
          }
        : {}),
      // de a un anuncio de video: asi se prueba que el lote de imagenes no le ocupa su lugar
      ...(process.env.HUMO_SIN_IMAGEN_ADS === '1' ? {} : { ANUNCIOS_A_LA_VEZ: '1' }),
    });
    const app = await arrancarApp({ env, puerto: PUERTO, log: path.join(INFORME, 'app.log') });
    const { pedir, arriba } = app;
    check('La app arranca', arriba, app.salio() ? `la app se cerró (${JSON.stringify(app.salio())}): mira app.log` : 'no respondió en 90 s');

    if (arriba) {
      // ---------------------------------------------------------- interfaz y rutas
      let r = await pedir('/');
      const html = String(r.datos || '');
      check('La interfaz (/) se sirve', r.st === 200 && /<title>Kads Studio by Kalethabh<\/title>/.test(html), html.slice(0, 200));
      const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
      for (const a of assets.slice(0, 4)) {
        const x = await pedir(a);
        check(`Archivo de la interfaz ${a}`, x.st === 200 && String(x.datos).length > 100, x.st);
      }
      check('La interfaz trae su código (assets/*.js)', assets.some((a) => a.endsWith('.js')), assets);
      // el costo estimado en la pantalla (la humo no abre un navegador: se busca en el código armado, que se carga por
      // partes; en modo prueba la tarjeta dice «Lo que costaría», sin el modo prueba «Costo estimado»)
      const codigo = listar(path.join(APP, 'dist', 'assets'), (f) => f.endsWith('.js')).map((f) => textoDe(f)).join('\n');
      const faltanTextos = ['Costo estimado', 'Lo que costaría', 'Con otro modelo', 'Usar este', 'Queda elegido en Ajustes › Modelos'].filter((t) => !codigo.includes(t));
      check('La interfaz trae el costo estimado («Costo estimado», «Lo que costaría», «Con otro modelo», «Usar este» y su aviso)', !faltanTextos.length, { faltan: faltanTextos });
      // todo al primer intento (DISENO-primer-intento §4): lo que decide el usuario, y nada que prometa que la app rehace sola
      const faltanPrimer = ['Corregir esto', '¿Qué salió mal?', 'Regenerar', 'Reemplazar con tu video', 'Volver al clip original', 'Descargar video', 'Lo que notó la revisión', 'La revisión notó', 'Velocidad'].filter((t) => !codigo.includes(t));
      const sobran = ['por si la app rehace', 'la rehace una vez sola', 'se rehacen solos', 'la app rehace sola', 'Se rehicieron hasta'].filter((t) => codigo.includes(t));
      check('La interfaz trae «Corregir esto», «¿Qué salió mal?», Regenerar, tu video, la velocidad, «Descargar video» y «Lo que notó la revisión», y ya no dice que la app rehace sola', !faltanPrimer.length && !sobran.length, { faltan: faltanPrimer, sobran });
      r = await pedir('/#/ajustes');
      check('Una pantalla interna (#/ajustes) da la interfaz', r.st === 200 && /<title>Kads Studio by Kalethabh<\/title>/.test(String(r.datos)));
      const rutas = {};
      for (const ruta of ['/api/estado', '/api/ajustes', '/api/estilos', '/api/anuncios', '/api/productos', '/api/claves', '/api/tablero', '/api/produccion/fila', '/api/ia/estado', '/api/claude/estado', '/api/voces/por-estilo', '/api/imagen-ads', '/api/imagen-ads/opciones', '/api/dashboard']) {
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
      check(
        `La IA elegida aparece instalada (/api/estado: ${HUMO_MOTOR === 'codex' ? 'Codex' : 'Claude Code'}, el falso)`,
        est.motor?.elegido === HUMO_MOTOR && est.motor?.instalado === true && (HUMO_MOTOR === 'codex' || est.claudeCode?.instalado === true),
        { claudeCode: est.claudeCode, motor: est.motor }
      );
      // /api/ia/estado (la pantalla) y /api/claude/estado, el alias de respaldo que se conserva tal cual
      const ia = rutas['/api/ia/estado'] || {};
      check(
        `/api/ia/estado: ${HUMO_MOTOR === 'codex' ? 'ChatGPT' : 'Claude'} es la IA elegida, instalada y con sesión`,
        ia.elegido === HUMO_MOTOR && ia.nombre === (HUMO_MOTOR === 'codex' ? 'ChatGPT' : 'Claude') && ia.motores?.[HUMO_MOTOR]?.instalado === true && ia.motores?.[HUMO_MOTOR]?.sesion === 'ok' && Number.isFinite(ia.trabajando?.maximo),
        { elegido: ia.elegido, nombre: ia.nombre, motores: ia.motores }
      );
      check('/api/claude/estado (alias de respaldo) sigue respondiendo con la fila compartida', rutas['/api/claude/estado'] && typeof rutas['/api/claude/estado'].trabajando === 'object', rutas['/api/claude/estado']);
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
      verRev(`la IA elegida («motor»: ${HUMO_MOTOR === 'codex' ? 'Codex' : 'Claude Code'})`, /^motor$/);
      check('Tu PC: «motor» es la IA elegida y es obligatorio', rev(/^motor$/).some((x) => x.motor === HUMO_MOTOR && x.obligatorio === true), rev(/^motor$/));
      const obligatorios = revs.filter((x) => x.obligatorio === true);
      if (obligatorios.length) check(`Tu PC: todo lo obligatorio está listo (${obligatorios.map((x) => x.id).join(', ')})`, obligatorios.every((x) => x.ok === true), obligatorios.filter((x) => x.ok !== true));

      // ---------------------------------------------------------- Ajustes › Modelos
      await probarModelos({ pedir, check, ajustes: rutas['/api/ajustes'] });

      // ---------------------------------------------------------- el audio del editor (2026-11-17j), sin anuncio
      try {
        const capas = await import(pathToFileURL(path.join(RAIZ, 'remotion', 'src', 'edicion', 'capas.mjs')).href);
        const plan = { duracion: 6, audio: { voz: 'audio/voz.mp3' }, bloques: [], subtitulos: [{ texto: 'hola Amúa a mua', inicio: 0, fin: 3, palabras: [{ texto: 'hola', inicio: 0.2, fin: 0.6 }, { texto: 'Amúa?', inicio: 0.7, fin: 1.2 }, { texto: 'a', inicio: 1.5, fin: 1.6 }, { texto: 'mua', inicio: 1.6, fin: 2 }] }] };
        const halladas = capas.buscarDichas(capas.palabrasDeLaVoz(plan, {}), ['AMUA']);
        check('Editor › Audio: buscar «AMUA» encuentra «Amúa?» y «a mua» (sin la IA)', halladas.length === 2, halladas);
        const ed = capas.completarEdicion({ voz: { volumen: 1, tramos: [{ id: 'a', desde: 0, hasta: 3, volumen: 1 }, { id: 'b', desde: 3, volumen: 0 }] }, censuras: halladas.map((h, i) => ({ id: `c${i}`, ...h, modo: 'silencio' })) });
        const nivel = capas.datosNivelVoz(plan, ed);
        check('Editor › Audio: la voz calla en las censuras y en la parte silenciada, y suena en lo demás', capas.nivelVoz(0.4, nivel) === 1 && capas.nivelVoz(1, nivel) === 0 && capas.nivelVoz(4, nivel) === 0, nivel);
        const viejo = capas.completarEdicion({ voz: { volumen: 0.5 }, musica: { fuente: 'original' } });
        check('Editor › Audio: los cambios guardados de antes siguen sirviendo', viejo.voz.tramos === null && Array.isArray(viejo.audios) && viejo.fundido.salida === 0 && capas.capasDeEdicion(plan, viejo, {}).fundido === null);
      } catch (e) {
        check('Editor › Audio: capas.mjs', false, e.message);
      }

      // ---------------------------------------------------------- un anuncio claymation de punta a punta
      if (process.env.HUMO_SIN_ANUNCIO !== '1') {
        const conLote = process.env.HUMO_SIN_IMAGEN_ADS !== '1';
        seccion(conLote ? 'Un anuncio claymation de punta a punta y, a la vez, un lote de anuncios de imagen (simulados)' : 'Un anuncio claymation de punta a punta (simulado)');
        // los dos a la vez: el video no espera en la fila por el lote, y nunca hay 2 sesiones de Claude de lotes
        const vigia = conLote ? vigilarVideoYLote({ pedir }) : null;
        const [a] = await Promise.all([producirAnuncio({ pedir, check, aviso, salio: app.salio, t0 }), conLote ? probarImagenAds({ pedir, check, aviso, salio: app.salio, t0 }) : null]);
        anuncio = a;
        if (vigia) {
          const m = await vigia.parar();
          if (!m.juntos) aviso('El video y el lote no llegaron a estar en marcha al mismo tiempo en ningún muestreo.');
          check('El video nunca esperó en la fila por el lote', !m.videoEnFilaConLote.length, m.videoEnFilaConLote.slice(0, 5));
          check(`Nunca hubo 2 sesiones de Claude de lotes a la vez (${m.muestras} muestreos, ${m.juntos} con video y lote juntos; como mucho ${m.maxLotes})`, m.muestras > 0 && m.medidas === m.muestras && m.maxLotes <= 1 && m.maxTotal <= 2, m);
        }

        // ---------------------------------------------------------- todo al primer intento (DISENO-primer-intento §5)
        if (anuncio?.listo && process.env.HUMO_SIN_REGENERAR !== '1' && !app.salio()) {
          seccion('Todo al primer intento: el aviso, regenerar con la fila, tu video en la edición, exportar y descargar (el claymation)');
          const pi = await probarPrimerIntento({ pedir, check, aviso, salio: app.salio, t0, slug: anuncio.slug, registro: REGISTRO, INFORME, motor: HUMO_MOTOR });
          if (pi?.videos && anuncio.producto && process.env.HUMO_SIN_MODO_B !== '1' && !app.salio()) {
            seccion('Tu video «en el anuncio» (modo B): un anuncio de objeto parlante');
            anuncio.objetoParlante = await probarModoB({ pedir, check, aviso, salio: app.salio, t0, productoId: anuncio.producto, videos: pi.videos });
          }
        }
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
        // (con ChatGPT: lo que recibe Codex, que se lo pasa al Claude falso del puente, y lo que anota el Codex falso)
        const conClave = notas.filter((x) => (x.tipo === 'tarea' && (x.entorno || []).length) || ((x.tipo === 'codex-exec' || x.tipo === 'codex-resume') && (x.envProhibidas || []).length));
        check('La IA se lanza sin claves (ni de Anthropic, de OpenAI, CODEX_API_KEY ni del motor): con la cuenta del usuario', !conClave.length, conClave.map((x) => x.entorno || x.envProhibidas));
        if (HUMO_MOTOR === 'claude' && anuncio?.slug && anuncio?.producto) {
          // con Claude, lo que lo frena son las reglas que recibe: el guion no escribe lo que decide que se cobra y que
          // produce el motor, y la ficha no pisa producto.json (DISENO §2.10, punto 4)
          const reglasDe = (re) => notas.filter((x) => x.tipo === 'tarea' && x.via === 'claude' && re.test(x.tarea || '')).flatMap((x) => x.prohibidas || []);
          const delGuion = reglasDe(/^guion/);
          const faltanGuion = ['modelos.json', 'img/**', 'video/**'].map((f) => `Edit(./temp/${anuncio.slug}/${f})`).filter((r) => !delGuion.includes(r));
          check('Con Claude, el guion no puede escribir modelos.json, img/ ni video/ del anuncio (sus reglas)', delGuion.length > 0 && !faltanGuion.length, { faltan: faltanGuion, tiene: delGuion.filter((r) => r.includes(anuncio.slug)) });
          const deLaFicha = reglasDe(/^ficha/);
          check('Con Claude, la ficha no puede pisar producto.json (sus reglas)', deLaFicha.some((r) => /^Edit\(\.?\/?temp\/_productos\//.test(r) && r.endsWith(`/${anuncio.producto}/producto.json)`)), deLaFicha.filter((r) => r.includes('_productos')));
        }
        if (HUMO_MOTOR === 'codex') {
          // lo que anoto el Codex falso de cada mensaje (exec y resume): banderas, entrada cerrada, imagenes, sin claves
          const msj = notas.filter((x) => x.tipo === 'codex-exec' || x.tipo === 'codex-resume');
          const conProblemas = msj.filter((x) => !x.ok);
          check(`Codex (falso): cada mensaje con sus banderas, la entrada cerrada, sus imágenes y sin claves (${msj.length})`, msj.length > 0 && !conProblemas.length, conProblemas.map((x) => ({ tipo: x.tipo, tarea: x.tarea, problemas: x.problemas })));
          const sinMaterial = msj.filter((x) => (x.materialFaltante || []).length);
          check('Codex (falso): cada tarea tuvo todo su material', !sinMaterial.length, sinMaterial.map((x) => ({ tarea: x.tarea, falta: x.materialFaltante })));
        }
      }
    }

    // ------------------------------------------------------------ cerrar la app
    await app.cerrar();

    // ------------------------------------------------------------ ChatGPT: los casos dificiles, en otra app de prueba
    if (HUMO_MOTOR === 'codex' && arriba && process.env.HUMO_SIN_ANUNCIO !== '1' && process.env.HUMO_SIN_CASOS !== '1') {
      let puerto2 = Number(process.env.HUMO_PUERTO_2) || PUERTO + 1;
      while ([4455, 4321, PUERTO].includes(puerto2)) puerto2++;
      await casosCodex({ check, aviso, seccion, envBase: env, puerto: puerto2, INFORME, t0, envDeLaPrueba });
    }
  }
  // el .env de claves falsas que escribio esta corrida (solo ese)
  if (envDeLaPrueba) fs.rmSync(envDeLaPrueba, { force: true });

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
/**
 * Ajustes › Modelos (GET /api/ajustes y PUT /api/ajustes/modelos). Elige otra opción, comprueba que se guarda y que
 * /api/estado la muestra, prueba lo inválido y lo de otra página, y deja todo como estaba.
 */
async function probarModelos({ pedir, check, ajustes }) {
  const m = ajustes?.modelos;
  const cats = Array.isArray(m?.categorias) ? m.categorias : [];
  const ids = ['vozEnOff', 'objetoParlante', 'ugc', 'podcastEntrevista', 'brollHablado', 'imagen'];
  if (!check('GET /api/ajustes trae los modelos para elegir (6 categorías)', ids.every((id) => cats.some((c) => c.id === id)) && m?.eleccion && typeof m.eleccion === 'object', m)) return;
  const opciones = cats.flatMap((c) => c.opciones || []);
  check(
    'Cada modelo trae su nombre y su costo en dólares (sin ids de kie)',
    opciones.length > 0 && opciones.every((o) => typeof o.nombre === 'string' && /^≈ US\$\d+,\d{2}( a \d+,\d{2})? por /.test(o.costoTexto || '') && !/[/]|omni-flash|kling-|grok-imagine|pixverse-|sunburst/.test(JSON.stringify({ ...o, id: '' }))),
    opciones.map((o) => [o.nombre, o.costoTexto, o.siFallaTexto])
  );
  check('Cada categoría tiene una sola opción recomendada', cats.every((c) => (c.opciones || []).filter((o) => o.recomendado).length === 1), cats.map((c) => [c.id, (c.opciones || []).filter((o) => o.recomendado).map((o) => o.id)]));
  const antes = { ...m.eleccion };
  const voz = cats.find((c) => c.id === 'vozEnOff');
  const otra = (voz?.opciones || []).find((o) => o.id !== antes.vozEnOff);
  if (otra) {
    const r = await pedir('/api/ajustes/modelos', { metodo: 'PUT', json: { vozEnOff: otra.id } });
    check(`PUT /api/ajustes/modelos guarda una opción válida (200: ${otra.nombre})`, r.st === 200 && r.datos?.ok === true && r.datos?.modelos?.eleccion?.vozEnOff === otra.id, r);
    const leido = (await pedir('/api/ajustes')).datos?.modelos?.eleccion;
    check('Lo guardado vuelve en GET /api/ajustes', leido?.vozEnOff === otra.id && leido?.imagen === antes.imagen, leido);
    const est = (await pedir('/api/estado')).datos?.modelos;
    check('/api/estado muestra el modelo elegido en Conexiones', est?.video === otra.nombre && est?.musica === 'Suno', est);
  }
  let r = await pedir('/api/ajustes/modelos', { metodo: 'PUT', json: { vozEnOff: 'no-existe' } });
  check('PUT /api/ajustes/modelos rechaza un modelo que no existe (400)', r.st === 400 && typeof r.datos?.error === 'string', r);
  r = await pedir('/api/ajustes/modelos', { metodo: 'PUT', json: { ugc: 'grok15' } });
  check('PUT /api/ajustes/modelos rechaza un modelo de otra categoría (400)', r.st === 400 && typeof r.datos?.error === 'string', r);
  r = await pedir('/api/ajustes/modelos', { metodo: 'PUT', json: { noExiste: 'omni' } });
  check('PUT /api/ajustes/modelos rechaza una categoría que no existe (400)', r.st === 400 && typeof r.datos?.error === 'string', r);
  r = await pedir('/api/ajustes/modelos', { metodo: 'PUT', json: { imagen: 'nb21' }, headers: { Origin: 'http://otro-sitio.example' } });
  check('PUT /api/ajustes/modelos desde otra página se rechaza (403)', r.st === 403, r);
  // como estaba
  r = await pedir('/api/ajustes/modelos', { metodo: 'PUT', json: antes });
  check('Los modelos quedan como estaban', r.st === 200 && ids.every((id) => r.datos?.modelos?.eleccion?.[id] === antes[id]), r.datos?.modelos?.eleccion);
}

/**
 * El costo estimado del anuncio con el guion listo, antes de aprobarlo (GET /api/anuncios/:slug/costo, excepción a
 * "sin precios" del 2026-11-09): un número > 0 con su rango, «Con otro modelo» con sus categorías, lo mismo que dice
 * el motor por la línea de comandos, la caché, «Usar este» (PUT /api/ajustes/modelos) que cambia la elección y el
 * número, y que de otra página se rechaza. Deja Ajustes como estaba. -> { min, max, margen, eleccion, otraVoz } o null.
 */
async function probarCostoAntesDeAprobar({ pedir, check, slug }) {
  const eleccion = (await pedir('/api/ajustes')).datos?.modelos?.eleccion || {};
  let r = await pedir(`/api/anuncios/${slug}/costo`);
  const d = r.datos;
  if (!check(`GET /costo antes de aprobar: hay número (guion de voz en off, modo prueba, sin margen: la app ya no rehace nada sola)`, r.st === 200 && d?.disponible === true && d.fase === 'guion' && d.familia === 'voz-en-off' && d.modoPrueba === true && d.margen === 0, r)) return null;
  const { min, max } = d.creditos || {};
  check(
    `El costo estimado es un solo número: más de 0, mínimo = máximo y en dólares a US$ 0,005 el crédito (${min} créditos, US$ ${coma(d.dolares?.min)})`,
    min > 0 && min === max && d.dolares?.min === Math.round(min * 0.5) / 100 && d.dolares?.max === d.dolares.min,
    { creditos: d.creditos, dolares: d.dolares }
  );
  const cats = Array.isArray(d.categorias) ? d.categorias : [];
  check(
    `«Con otro modelo»: Voz en off e Imágenes, cada una con una sola opción elegida (la de Ajustes) y una recomendada (${cats.map((c) => `${c.id}=${c.elegida}`).join(', ')})`,
    d.puedeCambiar === true &&
      cats.map((c) => c.id).join('|') === 'vozEnOff|imagen' &&
      cats.every((c) => c.elegida === eleccion[c.id] && c.opciones.filter((o) => o.elegida).length === 1 && c.opciones.find((o) => o.elegida)?.id === c.elegida && c.opciones.filter((o) => o.recomendado).length === 1 && c.opciones.every((o) => o.creditos?.min > 0 && o.creditos.min <= o.creditos.max && typeof o.nombre === 'string')),
    { eleccion, categorias: cats }
  );
  check(
    'Cada opción elegida cuesta lo mismo que el total (cambia una categoría a la vez)',
    cats.every((c) => JSON.stringify(c.opciones.find((o) => o.elegida)?.creditos) === JSON.stringify(d.creditos)),
    cats.map((c) => [c.id, c.opciones.find((o) => o.elegida)?.creditos, d.creditos])
  );
  check('La letra chica: con qué modelos y que la voz va por ElevenLabs', typeof d.conModelos === 'string' && d.conModelos.length > 3 && /ElevenLabs/.test(d.elevenlabs || ''), { conModelos: d.conModelos, elevenlabs: d.elevenlabs });
  // lo mismo que el motor por la línea de comandos (sin claves: el estimado no pide nada a nadie)
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/(_API_KEY|_TOKEN|_SECRET)$/i.test(k)) delete env[k];
  const cli = correr(process.execPath, [path.join(RAIZ, 'produccion', 'estimar-costo.js'), `temp/${slug}`, '--json', '--comparar', '--eleccion', JSON.stringify(eleccion)], { cwd: RAIZ, env, timeout: 60000 });
  const delMotor = (() => {
    try {
      return JSON.parse(String(cli.stdout || '').trim().split(/\r?\n/).pop());
    } catch {
      return null;
    }
  })();
  check(
    `El número es el del motor (produccion/estimar-costo.js --comparar: ${delMotor?.creditos?.min} a ${delMotor?.creditos?.max})`,
    delMotor?.ok === true && JSON.stringify(delMotor.creditos) === JSON.stringify(d.creditos) && (delMotor.comparar || []).length >= cats.length,
    { motor: delMotor?.creditos, servidor: d.creditos, codigo: cli.status, error: String(cli.stderr || '').slice(-400) }
  );
  const t = Date.now();
  r = await pedir(`/api/anuncios/${slug}/costo`);
  check(`Pedido otra vez, sale igual (de la caché, ${Date.now() - t} ms)`, r.st === 200 && JSON.stringify(r.datos) === JSON.stringify(d), r.datos?.creditos);
  r = await pedir(`/api/anuncios/${slug}/costo`, { headers: { Origin: 'http://otro-sitio.example' } });
  check('GET /costo desde otra página se rechaza (403)', r.st === 403, r);
  r = await pedir(`/api/anuncios/${slug}/costo`, { headers: { 'Sec-Fetch-Site': 'cross-site' } });
  check('GET /costo pedido por otro sitio (sec-fetch-site) se rechaza (403)', r.st === 403, r);
  // «Usar este»: lo mismo que hace la tarjeta (PUT /api/ajustes/modelos con la opción) y el costo cambia
  const voz = cats.find((c) => c.id === 'vozEnOff');
  const otra = voz?.opciones.find((o) => o.id === 'grok15' && !o.elegida) || voz?.opciones.find((o) => !o.elegida);
  if (otra) {
    r = await pedir('/api/ajustes/modelos', { metodo: 'PUT', json: { vozEnOff: otra.id } });
    check(`«Usar este» ${otra.nombre}: queda en Ajustes › Modelos`, r.st === 200 && r.datos?.modelos?.eleccion?.vozEnOff === otra.id, r);
    r = await pedir(`/api/anuncios/${slug}/costo`);
    const v = r.datos?.categorias?.find((c) => c.id === 'vozEnOff');
    check(
      `Después de «Usar este», el costo es el de ${otra.nombre} (${r.datos?.creditos?.min} a ${r.datos?.creditos?.max} créditos) y queda «Elegido»`,
      r.st === 200 && r.datos?.disponible === true && JSON.stringify(r.datos.creditos) === JSON.stringify(otra.creditos) && v?.elegida === otra.id && v.opciones.find((o) => o.elegida)?.id === otra.id,
      { creditos: r.datos?.creditos, opcion: otra.creditos, elegida: v?.elegida }
    );
    // como estaba ANTES de aprobar: así el anuncio se produce con lo de siempre y las cuentas de abajo no cambian
    r = await pedir('/api/ajustes/modelos', { metodo: 'PUT', json: { vozEnOff: eleccion.vozEnOff } });
    check('La voz en off vuelve a la de antes', r.st === 200 && r.datos?.modelos?.eleccion?.vozEnOff === eleccion.vozEnOff, r);
    r = await pedir(`/api/anuncios/${slug}/costo`);
    check('Y el costo vuelve al de antes', r.st === 200 && JSON.stringify(r.datos?.creditos) === JSON.stringify(d.creditos), { ahora: r.datos?.creditos, antes: d.creditos });
  }
  return { min, max, margen: d.margen, eleccion, otraVoz: otra?.id || null };
}

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
  // «Tus videos e imágenes» (2026-11-19): una imagen y un video del usuario para el anuncio
  const subirMaterial = async (bytes, tipo, nombre) => (await pedir('/api/material', { metodo: 'POST', cuerpo: bytes, headers: { 'Content-Type': tipo, 'X-Nombre': nombre } })).datos;
  const matImagen = await subirMaterial(pngFrasco(), 'image/png', 'antes.png');
  const videoMat = path.join(os.tmpdir(), `humo-material-${process.pid}.mp4`);
  cp.spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=green:s=360x640:d=4', '-pix_fmt', 'yuv420p', videoMat]);
  const matVideo = fs.existsSync(videoMat) ? await subirMaterial(fs.readFileSync(videoMat), 'video/mp4', 'escena.mp4') : null;
  check('Tus videos e imágenes: se suben una imagen y un video', matImagen?.tipo === 'imagen' && matVideo?.tipo === 'video', { matImagen, matVideo });
  r = await pedir('/api/anuncios', { json: { productoId: id, estilo: 'claymation', voz: { id: 'sim-narrador', nombre: 'Narrador de prueba' }, continuidad: false, respuestas: {}, material: [matImagen, matVideo].filter(Boolean).map((x, i) => ({ id: x.id, nota: i ? 'como escena' : 'en la primera toma' })) } });
  const slug = r.datos?.slug;
  resumen.slug = slug;
  if (!check('Se crea el anuncio claymation (POST /api/anuncios)', r.st === 201 && slug, r)) return resumen;
  const elegidos = (await pedir('/api/ajustes')).datos?.modelos?.eleccion || {};
  const modelosDelAnuncio = leerJSON(path.join(RAIZ, 'temp', slug, 'modelos.json'));
  check(
    'El anuncio se lleva los modelos de Ajustes (temp/<slug>/modelos.json)',
    Object.keys(elegidos).length > 0 && Object.entries(elegidos).every(([k, v]) => modelosDelAnuncio?.[k] === v) && typeof modelosDelAnuncio?.guardado === 'string',
    { elegidos, modelosDelAnuncio }
  );
  const guion = await esperar('el guion', 5, async () => (await pedir(`/api/anuncios/${slug}/guion`)).datos, (d) => ['listo', 'error', 'bloqueado'].includes(d?.estado));
  if (!check('El guion queda listo', guion?.estado === 'listo' && guion?.guion?.partes?.length === 3, { estado: guion?.estado, error: guion?.error, progreso: guion?.progreso?.slice?.(-5), tiempo: guion?._seAcaboElTiempo })) return resumen;
  {
    const b1 = (guion?.guion?.broll || []).find((b) => b.n === 1);
    check('El guion trae cada imagen de apoyo con su escena detallada, su cámara y dónde entra', b1 && /taza de té/.test(b1.se_ve || '') && /plano/.test(b1.camara || '') && b1.despues === 2, guion?.guion?.broll);
  }

  // ------------------------------------------------------------ «Editar a mano»: lo que se ve, solo (2026-11-18z)
  r = await pedir(`/api/anuncios/${slug}/guion/se-ve`, { json: { n: 1, dice: 'Mira cómo brilla mi frasco nuevo' } });
  check('Editar a mano: «lo que se ve» se escribe solo para lo que escribiste', r.st === 200 && /Escena de prueba/.test(r.datos?.se_ve || '') && /brilla/.test(r.datos?.se_ve || ''), r);
  r = await pedir(`/api/anuncios/${slug}/guion/se-ve`, { json: { despuesDe: 3, dice: 'Y al final, todos felices' } });
  check('Editar a mano: también para una parte nueva', r.st === 200 && /Escena de prueba/.test(r.datos?.se_ve || ''), r);
  r = await pedir(`/api/anuncios/${slug}/guion/regenerar-linea`, { json: { nueva: true, despuesDe: 3 } });
  check('Editar a mano: ✨ en una parte nueva la escribe la IA', r.st === 200 && /parte nueva de prueba/.test(r.datos?.dice || ''), r);
  r = await pedir(`/api/anuncios/${slug}/guion/regenerar-linea`, { json: { nueva: true, despuesDe: 99 } });
  check('Editar a mano: parte nueva después de una que no existe (404)', r.st === 404, r);
  r = await pedir(`/api/anuncios/${slug}/guion/se-ve`, { json: { n: 1, dice: '   ' } });
  check('Editar a mano: sin texto, «lo que se ve» no se pide (400)', r.st === 400, r);
  // (2026-11-19s) las imágenes de apoyo: ✨ otra escena (no guarda) y, si no cambiaron, no se le pide nada a la IA
  r = await pedir(`/api/anuncios/${slug}/guion/broll-escena`, { json: { n: 1, idea: 'con la abuela' } });
  check('Imagen de apoyo: ✨ otra escena, con su cámara y lo que pediste (sin guardar)', r.st === 200 && /Escena de apoyo de prueba 1: con la abuela/.test(r.datos?.se_ve || '') && /plano/.test(r.datos?.camara || '') && /taza de té/.test((await pedir(`/api/anuncios/${slug}/guion`)).datos?.guion?.broll?.[0]?.se_ve || ''), r);
  r = await pedir(`/api/anuncios/${slug}/guion/broll-escena`, { json: { n: 99 } });
  check('Imagen de apoyo que no existe: 404', r.st === 404, r);
  r = await pedir(`/api/anuncios/${slug}/guion/lineas`, { metodo: 'PUT', json: { lineas: [], broll: [{ n: 1, se_ve: (guion?.guion?.broll || [])[0]?.se_ve }, { n: 99, se_ve: 'otra' }] } });
  check('Imagen de apoyo sin cambios (o una que no existe): no se le pide nada a la IA', r.st === 200 && r.datos?.directo && r.datos?.cambiadas === 0 && (await pedir(`/api/anuncios/${slug}/guion`)).datos?.estado === 'listo', r);
  r = await pedir(`/api/anuncios/${slug}/guion/lineas`, { metodo: 'PUT', json: { lineas: Array.from({ length: 11 }, () => ({ nueva: true, despuesDe: 1, dice: 'Otra parte' })) } });
  check('Editar a mano: más de 10 partes nuevas a la vez se rechaza sin tocar el guion', r.st === 400 && (await pedir(`/api/anuncios/${slug}/guion`)).datos?.guion?.partes?.length === 3, r);

  // ------------------------------------------------------------ el costo estimado antes de aprobar
  const estimado = await probarCostoAntesDeAprobar({ pedir, check, slug });

  // ------------------------------------------------------------ aprobar y producir
  r = await pedir(`/api/anuncios/${slug}/producir`, { json: {} });
  if (!check('Se aprueba el guion y arranca la producción', r.st >= 200 && r.st < 300, r)) return resumen;
  r = await pedir(`/api/anuncios/${slug}/costo`);
  check('Ya aprobado, GET /costo no da número (disponible false, «en-produccion»)', r.st === 200 && r.datos?.disponible === false && r.datos?.motivo === 'en-produccion', r);
  // Aprobado, el anuncio se queda con los modelos con que se aprobó: cambiar Ajustes ahora (o «Usar este» en otro
  // anuncio) no lo toca (lib/modelos.js, copiarModelosAlAnuncio). Se cambia la voz en off mientras se produce y se
  // deja como estaba al final, pase lo que pase.
  const aprobados = leerJSON(path.join(RAIZ, 'temp', slug, 'modelos.json'));
  const otraVoz = estimado?.otraVoz;
  let cambiada = false;
  if (otraVoz) {
    r = await pedir('/api/ajustes/modelos', { metodo: 'PUT', json: { vozEnOff: otraVoz } });
    cambiada = check(`Con el anuncio ya aprobado, se cambia la voz en off en Ajustes (${otraVoz})`, r.st === 200 && r.datos?.modelos?.eleccion?.vozEnOff === otraVoz, r);
  }
  const vistos = new Map();
  let c;
  try {
    c = await esperar('la producción', 35, async () => {
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
  } finally {
    if (otraVoz && estimado?.eleccion?.vozEnOff) {
      r = await pedir('/api/ajustes/modelos', { metodo: 'PUT', json: { vozEnOff: estimado.eleccion.vozEnOff } });
      check('La voz en off de Ajustes queda como estaba', r.st === 200 && r.datos?.modelos?.eleccion?.vozEnOff === estimado.eleccion.vozEnOff, r);
    }
  }
  if (cambiada) {
    const despues = leerJSON(path.join(RAIZ, 'temp', slug, 'modelos.json'));
    check(
      `El anuncio aprobado siguió con sus modelos aunque cambió Ajustes (modelos.json: ${despues?.vozEnOff} y ${despues?.imagen})`,
      aprobados?.vozEnOff === estimado.eleccion.vozEnOff && despues?.vozEnOff === aprobados.vozEnOff && despues?.imagen === aprobados.imagen && despues?.guardado === aprobados.guardado,
      { alAprobar: aprobados, alTerminar: despues, ajustes: estimado.eleccion }
    );
  }
  resumen.pasos = (c?.pasos || []).map((p) => `${p.id}=${p.estado}`);
  if (!check('La producción termina («listo») sin errores', c?.estado === 'listo', { estado: c?.estado, paso: c?.paso, error: c?.error, mensaje: c?.mensaje, pasos: resumen.pasos, tiempo: c?._seAcaboElTiempo })) return resumen;
  {
    // «Tus videos e imágenes»: el anuncio los usó (la imagen como la de la toma 1, el video como el primer B-roll) y
    // salió listo igual
    const dirA = path.join(RAIZ, 'temp', slug);
    const leerJSONSeguro = (f) => {
      try {
        return JSON.parse(fs.readFileSync(f, 'utf8'));
      } catch {
        return null;
      }
    };
    const man = leerJSONSeguro(path.join(dirA, 'manifiesto.json'));
    const lista = leerJSONSeguro(path.join(dirA, 'material', 'material.json')) || [];
    check('Tus videos e imágenes: quedaron en el anuncio y la IA los usó en el manifiesto', lista.length === 2 && /material\/M01\.png$/.test(man?.tomas?.[0]?.imagen_propia || '') && /material\/M02\.mp4$/.test(man?.broll?.[1]?.desde_biblioteca || ''), { lista, toma1: man?.tomas?.[0]?.imagen_propia, broll2: man?.broll?.[1]?.desde_biblioteca });
    check('Tus videos e imágenes: la toma 1 tiene tu imagen (vertical) y no se generó', fs.existsSync(path.join(dirA, 'img', 'toma-1-inicial.png')) && !/toma-1-inicial/.test(fs.existsSync(path.join(dirA, 'app', 'gasto')) ? fs.readdirSync(path.join(dirA, 'app', 'gasto')).map((f) => fs.readFileSync(path.join(dirA, 'app', 'gasto', f), 'utf8')).join(' ') : ''), {});
  }
  resumen.listo = true;

  // ------------------------------------------------------------ lo cobrado contra el estimado
  // Todo al primer intento (2026-11-09): la revisión simulada marca una toma pero solo deja un aviso, así que los
  // pasos de revisión no pagan nada y lo cobrado es el estimado (sin margen).
  if (estimado?.min > 0) {
    const informe = leerJSON(path.join(RAIZ, 'temp', slug, 'app', 'informe.json'));
    const dirGasto = path.join(RAIZ, 'temp', slug, 'app', 'gasto');
    const corridas = (() => {
      try {
        return fs.readdirSync(dirGasto).filter((n) => /^\d+-.+\.json$/.test(n)).map((n) => leerJSON(path.join(dirGasto, n))).filter(Boolean);
      } catch {
        return [];
      }
    })();
    const rehecho = corridas
      .filter((x) => /^revision-/.test(String(x.paso || '')))
      .reduce((s, x) => s + (Number(x.creditos) || 0) + (x.sinRegistro || []).reduce((t, y) => t + (Number(y?.creditosEstimados) || 0), 0), 0);
    const cobrado = Number(informe?.costo?.creditos);
    check('La revisión no pagó nada (los pasos de revisión cobraron 0 créditos: solo avisan)', Number.isFinite(cobrado) && rehecho === 0, { rehecho, pasos: corridas.map((x) => [x.paso, x.creditos]) });
    check(
      `Lo cobrado es el costo estimado (${cobrado} créditos; estimado ${estimado.min})`,
      Number.isFinite(cobrado) && Math.abs(cobrado - estimado.min) <= 0.01,
      { cobrado, rehecho, estimado: { min: estimado.min, max: estimado.max, margen: estimado.margen }, pasos: corridas.map((x) => [x.paso, x.creditos]) }
    );
    resumen.cobrado = cobrado;
  }

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

// =====================================================================================================================
// 3) Los anuncios de imagen (ESPECIFICACION-imagen-ads.md §14.4.3)
// =====================================================================================================================

/** Un PNG RGBA (un logo con fondo transparente), sin dependencias. */
function pngLogo(ancho = 240, alto = 140) {
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
  ihdr[9] = 6;
  const crudo = Buffer.alloc((1 + ancho * 4) * alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const o = y * (1 + ancho * 4) + 1 + x * 4;
      const dentro = x > 40 && x < ancho - 40 && y > 30 && y < alto - 30;
      crudo[o] = 30;
      crudo[o + 1] = 60;
      crudo[o + 2] = 170;
      crudo[o + 3] = dentro ? 255 : 0;
    }
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), trozo('IHDR', ihdr), trozo('IDAT', zlib.deflateSync(crudo)), trozo('IEND', Buffer.alloc(0))]);
}

/** Lee un zip (su directorio central) y devuelve sus entradas con el CRC comprobado. */
function entradasDelZip(zip) {
  const fin = zip.length - 22;
  if (fin < 0 || zip.readUInt32LE(fin) !== 0x06054b50) return null;
  const n = zip.readUInt16LE(fin + 10);
  let p = zip.readUInt32LE(fin + 16);
  const salida = [];
  for (let i = 0; i < n; i++) {
    const largo = zip.readUInt16LE(p + 28);
    const nombre = zip.subarray(p + 46, p + 46 + largo).toString('utf8');
    const crc = zip.readUInt32LE(p + 16);
    const tam = zip.readUInt32LE(p + 20);
    const desde = zip.readUInt32LE(p + 42);
    const ln = zip.readUInt16LE(desde + 26);
    salida.push({ nombre, ok: zlib.crc32(zip.subarray(desde + 30 + ln, desde + 30 + ln + tam)) === crc });
    p += 46 + largo;
  }
  return salida;
}

/**
 * Mientras corren el video y el lote: cada segundo mira la fila (el video nunca espera por un lote) y cuantas sesiones de
 * Claude hay (nunca 2 de lotes). parar() devuelve lo que vio. Las sesiones de lotes se cuentan en claude.js (las que de
 * verdad estan trabajando, y el maximo que hubo a la vez), no en el semaforo de los lotes: si algo abriera una sesion
 * de lote sin pasar por el semaforo, esto lo ve.
 */
function vigilarVideoYLote({ pedir }) {
  const m = { muestras: 0, juntos: 0, maxLotes: 0, maxTotal: 0, medidas: 0, videoEnFilaConLote: [] };
  let seguir = true;
  let rutaIA = '/api/ia/estado'; // la fila de las dos IA; si no esta, el alias de respaldo
  const vuelta = (async () => {
    while (seguir) {
      try {
        const f = (await pedir('/api/produccion/fila', { ms: 10000 })).datos;
        const l = (await pedir('/api/imagen-ads', { ms: 10000 })).datos;
        let ia = await pedir(rutaIA, { ms: 10000 });
        if (ia.st === 404 && rutaIA !== '/api/claude/estado') {
          rutaIA = '/api/claude/estado';
          ia = await pedir(rutaIA, { ms: 10000 });
        }
        const c = ia.datos;
        m.muestras++;
        const enMarcha = (f?.enMarcha || []).map((x) => x.slug);
        const lotes = enMarcha.filter((s) => s.startsWith('_img-'));
        const videos = enMarcha.filter((s) => !s.startsWith('_img-'));
        if (lotes.length && videos.length) m.juntos++;
        const enFila = (f?.enFila || []).map((x) => x.slug).filter((s) => !s.startsWith('_img-'));
        if (enFila.length && lotes.length) m.videoEnFilaConLote.push({ enFila, lotes, en: new Date().toISOString() });
        const t = c?.trabajando || {};
        if (Number.isFinite(t.deLotes) && Number.isFinite(t.maximoDeLotes)) m.medidas++;
        m.maxLotes = Math.max(m.maxLotes, Number(t.deLotes) || 0, Number(t.maximoDeLotes) || 0, Number(l?.sesionesDeLotes?.ahora) || 0);
        m.maxTotal = Math.max(m.maxTotal, Number(t.trabajando) || 0);
      } catch {
        /* la proxima */
      }
      await dormir(1000);
    }
  })();
  return {
    async parar() {
      seguir = false;
      await vuelta;
      return m;
    },
  };
}

/** Un lote de 3 variaciones 1:1 + 9:16 con logo, de punta a punta, como lo hace la interfaz. Devuelve un resumen. */
async function probarImagenAds({ pedir, check, aviso, salio, t0 }) {
  const resumen = { lote: null, estado: null };
  const BASE = `http://127.0.0.1:${Number(process.env.PUERTO) || 4497}`;
  const log = (t) => console.log(`   [lote] ${Math.round((Date.now() - t0) / 1000)} s  ${t}`);
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
  let r = await pedir('/api/imagen-ads/opciones');
  check('Anuncios de imagen: GET /opciones trae los 24 ángulos, las 6 posiciones del logo y el tope de 100', r.st === 200 && r.datos?.angulos?.length === 24 && r.datos?.posiciones?.length === 6 && r.datos?.maximo === 100, r.datos);
  // el costo estimado del formulario (excepción a "sin precios" del 2026-11-09): el precio de cada imagen lo manda el
  // servidor y la pantalla lo multiplica (costoDelLote, en un módulo sin dependencias para poder probarlo aquí)
  const precio = r.datos?.costo;
  check(
    'Anuncios de imagen: GET /opciones trae el precio de cada imagen para el costo estimado (GPT Image 2.5, 10 créditos, US$ 0,05)',
    precio?.creditosPorImagen === 10 && precio.dolaresPorImagen === 0.05 && precio.dolaresPorCredito === 0.005 && precio.modelo === 'GPT Image 2.5',
    precio
  );
  // (todo al primer intento: el lote ya no rehace nada solo, así que no hay margen; la pantalla no lo suma aunque venga)
  if (precio && precio.margen !== 0) aviso(`GET /api/imagen-ads/opciones todavía manda margen ${coma(precio.margen)} (la pantalla ya no lo suma: es un dato que sobra).`);
  try {
    const { costoDelLote } = await import(pathToFileURL(path.join(APP, 'src', 'datos', 'costo-lote.js')).href);
    const seis = costoDelLote(precio, 3 * 2);
    const veinte = costoDelLote(precio, 20);
    check(`Anuncios de imagen: el formulario estima un solo número, sin margen: 3 anuncios en 1:1 y 9:16 (6 imágenes) US$ 0,30 y 20 imágenes US$ 1,00 (${JSON.stringify(seis)}, ${JSON.stringify(veinte)})`, seis?.min === 0.3 && seis?.max === 0.3 && veinte?.min === 1 && veinte?.max === 1, { seis, veinte });
  } catch (e) {
    check('Anuncios de imagen: el formulario estima 3 anuncios en 1:1 y 9:16 (6 imágenes) en US$ 0,30', false, e.message);
  }
  r = await pedir('/api/productos', { json: { nombre: 'Producto Imagen Humo', tipo: 'fisico' } });
  const id = r.datos?.id;
  if (!check('Anuncios de imagen: se crea el producto', r.st === 201 && id, r)) return resumen;
  r = await pedir(`/api/productos/${id}/fotos/1`, { metodo: 'PUT', cuerpo: pngFrasco(), headers: { 'Content-Type': 'image/png' } });
  check('Anuncios de imagen: se sube la foto del producto', r.st === 200, r);
  r = await pedir('/api/imagen-ads/productos');
  // (con su fecha: dos productos con el mismo nombre se distinguen por ella en la portada y en el formulario)
  check('Anuncios de imagen: el producto aparece con su foto y su fecha', (r.datos?.productos || []).some((p) => p.id === id && p.fotos?.length === 1 && p.fotoSugerida === 1 && !Number.isNaN(Date.parse(p.creado))), r.datos);
  const cuerpo = { productoId: id, fotoProducto: 1, datos: { nombre: 'Crema Humo', publico: 'Mujeres de 25 a 45', precio: '79.90', moneda: 'S/', cta: 'Envío gratis', pais: 'Perú', idioma: 'es', adicional: '', angulo: null }, cantidad: 3, formatos: ['1:1', '9:16'], logo: { posicion: 'arriba-centro' } };
  r = await pedir('/api/imagen-ads', { json: { ...cuerpo, cantidad: 0 } });
  check('Anuncios de imagen: una cantidad fuera de 1 a 100 se rechaza (400)', r.st === 400, r);
  r = await pedir('/api/imagen-ads', { json: cuerpo, headers: { Origin: 'http://otro-sitio.example' } });
  check('Anuncios de imagen: crear un lote desde otra página se rechaza (403)', r.st === 403, r);
  r = await pedir('/api/imagen-ads', { json: cuerpo });
  const lote = r.datos?.lote;
  resumen.lote = lote;
  if (!check('Anuncios de imagen: se crea el lote (borrador)', r.st === 201 && /^_img-crema-humo-\d{8}-\d{4}/.test(lote || ''), r)) return resumen;
  r = await pedir(`/api/imagen-ads/${lote}/logo`, { metodo: 'PUT', cuerpo: pngLogo(), headers: { 'Content-Type': 'image/png' } });
  check('Anuncios de imagen: se sube el logo (PNG sin fondo, recortado a lo que se ve)', r.st === 200 && r.datos?.transparente === true && r.datos?.ancho === 159 && r.datos?.alto === 79, r);
  r = await pedir(`/api/imagen-ads/${lote}/generar`, { json: { costoMaximoConfirmado: 100 } });
  if (!check('Anuncios de imagen: POST /generar arranca todo (sin pausa de aprobación)', r.st === 200 && r.datos?.conductor, r)) return resumen;
  r = await pedir(`/api/imagen-ads/${lote}/generar`, { json: { costoMaximoConfirmado: 100 } });
  check('Anuncios de imagen: generar dos veces da 409', r.st === 409, r);
  const vistos = new Map();
  const leerLote = async () => {
    const d = (await pedir(`/api/imagen-ads/${lote}`)).datos;
    for (const p of d?.conductor?.pasos || []) {
      if (vistos.get(p.id) !== p.estado) {
        vistos.set(p.id, p.estado);
        if (p.estado !== 'pendiente') log(`${p.id}: ${p.estado}${p.error?.mensaje ? ` (${p.error.mensaje})` : ''}`);
      }
    }
    return d;
  };
  let v = await esperar('el lote', 20, leerLote, (d) => ['listo', 'error', 'pausado'].includes(d?.conductor?.estado));
  resumen.estado = v?.conductor?.estado;
  if (!check('Anuncios de imagen: el lote termina («listo»)', v?.conductor?.estado === 'listo', { estado: v?.conductor?.estado, error: v?.conductor?.error, pasos: (v?.conductor?.pasos || []).map((p) => `${p.id}=${p.estado}`), frase: v?.avance?.frase, tiempo: v?._seAcaboElTiempo })) return resumen;
  const carpeta = path.join(RAIZ, 'temp', lote);
  const pngs = (sub) => {
    try {
      return fs.readdirSync(path.join(carpeta, sub)).filter((n) => /\.png$/.test(n));
    } catch {
      return [];
    }
  };
  check(`Anuncios de imagen: 6 PNG en img/ (solo las finales) y 6 en final/ (con el logo) (${pngs('img').length} y ${pngs('final').length})`, pngs('img').length === 6 && pngs('final').length === 6, { img: pngs('img'), final: pngs('final') });
  const estadoDe = (vv, n, f) => vv?.variaciones?.[n]?.piezas?.[f]?.estado;
  // todo al primer intento: sin reintento automático, lo que ve la revisión queda «con detalles» (te-necesita) con su
  // nota, y el vertical sale igual de su cuadrado (revision-simulada.js: V02_1x1, V03_1x1 y V02_9x16)
  const estados = (v?.variaciones || []).map((x, i) => `${estadoDe(v, i, '1:1')}/${estadoDe(v, i, '9:16')}`).join(' ');
  check(
    `Anuncios de imagen: nada se rehace solo; la revisión deja con su nota V02 y V03 en el cuadrado y V02 en el vertical (${estados})`,
    estados === 'listo/listo te-necesita/te-necesita te-necesita/listo' && [[1, '1:1'], [2, '1:1'], [1, '9:16']].every(([n, f]) => (v.variaciones[n].piezas[f].problemas || []).length > 0) && !JSON.stringify(v).includes('"arreglado"'),
    (v?.variaciones || []).map((x) => [x.v, ...['1:1', '9:16'].map((f) => [x.piezas?.[f]?.estado, x.piezas?.[f]?.problemas])])
  );
  check('Anuncios de imagen: la vista no trae prompts ni precios fuera del informe', !/EXACT VISIBLE TEXT|visual_prompt|cr[eé]ditos/i.test(JSON.stringify({ ...v, informe: null })));
  r = await pedir(`/api/imagen-ads/${lote}/prompt/V01_1x1`);
  check('Anuncios de imagen: «Copiar prompt» trae el texto exacto que recibió kie', r.st === 200 && /EXACT VISIBLE TEXT/.test(r.datos?.texto || ''), { st: r.st, inicio: String(r.datos?.texto || r.datos?.error || '').slice(0, 120) });
  const pieza = v.variaciones[0].piezas['1:1'];
  let x = await fetch(BASE + pieza.url);
  check('Anuncios de imagen: la imagen con logo se sirve (/archivos/imagen-ads/…/final/)', x.status === 200 && /image\/png/.test(x.headers.get('content-type') || '') && /\/final\//.test(pieza.url), { st: x.status, url: pieza.url });
  x = await fetch(BASE + pieza.miniatura, { redirect: 'manual' });
  check('Anuncios de imagen: la miniatura la arma el servidor', x.status === 200 || x.status === 302, { st: x.status, url: pieza.miniatura });
  x = await fetch(`${BASE}/archivos/imagen-ads/${lote}/app/brief.json`);
  check('Anuncios de imagen: por /archivos solo salen las imágenes de la lista (un JSON da 404)', x.status === 404, x.status);
  const etag = (await fetch(`${BASE}/api/imagen-ads/${lote}`)).headers.get('etag') || '';
  x = await fetch(`${BASE}/api/imagen-ads/${lote}`, { headers: { 'If-None-Match': etag } });
  check('Anuncios de imagen: la vista responde 304 si no cambió nada (ETag)', x.status === 304, { st: x.status, etag });
  // regenerar sin instruccion
  r = await pedir(`/api/imagen-ads/${lote}/regenerar`, { json: { pieza: 'V01_1x1', costoMaximoConfirmado: 100 } });
  check('Anuncios de imagen: «Regenerar» sin instrucción (202)', r.st === 202 && /^U\d{4}$/.test(r.datos?.pedido?.id || ''), r);
  const otro = await pedir(`/api/imagen-ads/${lote}/regenerar`, { json: { pieza: 'V01_9x16', costoMaximoConfirmado: 100 } });
  check('Anuncios de imagen: otro cambio sobre el mismo anuncio mientras tanto da 409', otro.st === 409, otro);
  v = await esperar('la regeneración', 15, leerLote, (d) => (d?.conductor?.estado === 'listo' ? (d?.pedidos || []).every((p) => ['listo', 'no-aplicado'].includes(p.estado)) && Boolean(d?.informe) : ['error', 'pausado'].includes(d?.conductor?.estado)));
  const p1 = v?.variaciones?.[0]?.piezas?.['1:1'];
  const p2 = v?.variaciones?.[0]?.piezas?.['9:16'];
  check('Anuncios de imagen: el cuadrado pasa a la versión 2 (la 1 queda en versiones/) y su vertical también', p1?.version === 2 && p2?.version === 2 && fs.existsSync(path.join(carpeta, 'versiones', 'V01_1x1.v1.png')) && (p1?.versiones || []).some((y) => y.n === 1), { p1: p1 && { version: p1.version, versiones: p1.versiones }, p2: p2?.version, estado: v?.conductor?.estado, pedidos: v?.pedidos, tiempo: v?._seAcaboElTiempo });
  // el zip
  x = await fetch(`${BASE}/api/imagen-ads/${lote}/descargar?logo=1`);
  const zip = Buffer.from(await x.arrayBuffer());
  const entradas = entradasDelZip(zip);
  check('Anuncios de imagen: el zip empieza con PK y trae las 6 imágenes (con sus CRC)', x.status === 200 && zip.subarray(0, 2).toString() === 'PK' && entradas?.length === 6 && entradas.every((e) => e.ok && /\/V0[123]-(cuadrado|vertical)\.png$/.test(e.nombre)), { st: x.status, entradas });
  // el informe con el costo (solo al final)
  const costo = v?.informe?.costo;
  check(`Anuncios de imagen: el informe dice 80 créditos «habría costado» (6 imágenes + 2 de la regeneración, sin reintentos) (${costo?.creditos})`, costo?.creditos === 80 && v?.informe?.modoPrueba === true && costo?.estimado === false, v?.informe);
  r = await pedir('/api/imagen-ads');
  check('Anuncios de imagen: el lote aparece en «Tus lotes»', (r.datos?.lotes || []).some((l) => l.lote === lote && l.estado === 'listo' && l.listas === 6 && l.total === 6), r.datos?.lotes);
  // la portada de la sección muestra cada lote como un mosaico de sus primeros cuadrados (con el logo) y la foto del producto
  const enLista = (r.datos?.lotes || []).find((l) => l.lote === lote);
  check(
    'Anuncios de imagen: «Tus lotes» trae el mosaico (los 3 cuadrados con logo, en orden) y la foto del producto',
    Array.isArray(enLista?.mosaico) && enLista.mosaico.length === 3 && enLista.mosaico.every((u, i) => u.startsWith(`/archivos/miniatura/imagen-ads/${lote}/final/V0${i + 1}_1x1.png?`)) && /\/entrada\/producto\.(png|jpe?g|webp)\?/.test(enLista?.foto || ''),
    { mosaico: enLista?.mosaico, foto: enLista?.foto }
  );
  return resumen;
}

// =====================================================================================================================
// 5) Todo al primer intento: el usuario decide (DISENO-primer-intento §5)
// =====================================================================================================================

/** ffmpeg sin consola: { ok, error }. */
function ffmpegHacer(args) {
  const r = correr('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { timeout: 180000 });
  return { ok: r.status === 0, error: r.status === 0 ? null : String(r.stderr || r.error?.message || 'ffmpeg no pudo').trim().slice(-400) };
}

/** Lo que dice ffprobe de un video: { video: { codec, pix, ancho, alto, fps }, audio: { codec, hz } | null, duracion }. */
function sondearVideo(f) {
  const p = correr('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,pix_fmt,width,height,r_frame_rate,sample_rate:format=duration', '-of', 'json', f]);
  let j;
  try {
    j = JSON.parse(p.stdout);
  } catch {
    return null;
  }
  const v = (j.streams || []).find((s) => s.codec_type === 'video');
  const a = (j.streams || []).find((s) => s.codec_type === 'audio');
  const [num, den] = String(v?.r_frame_rate || '0/1').split('/').map(Number);
  return {
    video: v ? { codec: v.codec_name, pix: v.pix_fmt, ancho: v.width, alto: v.height, fps: den ? Math.round((num / den) * 100) / 100 : 0 } : null,
    audio: a ? { codec: a.codec_name, hz: Number(a.sample_rate) || 0 } : null,
    duracion: Number(j.format?.duration) || 0,
  };
}

/** Un cuadro de un video en el segundo `t`, chiquito (18x32) y en RGB crudo: para comparar sin dependencias. */
function cuadroDe(f, t, ancho = 18, alto = 32) {
  const r = cp.spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-ss', Math.max(0, t).toFixed(3), '-i', f, '-frames:v', '1', '-vf', `scale=${ancho}:${alto}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { windowsHide: true, timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
  return r.status === 0 && r.stdout?.length === ancho * alto * 3 ? r.stdout : null;
}

/** Cuánto se parecen dos cuadros: la diferencia media por canal (0 = iguales, 255 = opuestos). */
const diferenciaDe = (a, b) => (a && b && a.length === b.length ? Math.round((a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0) / a.length) * 10) / 10 : Infinity);

/** El color que domina un cuadro del video de colores: 'rojo' | 'verde' | 'azul' | 'otro (r,g,b)'. */
function colorDe(c) {
  if (!c) return null;
  const m = [0, 0, 0];
  for (let i = 0; i < c.length; i += 3) for (let k = 0; k < 3; k++) m[k] += c[i + k];
  const [r, g, b] = m.map((x) => x / (c.length / 3));
  if (r > 150 && g < 90 && b < 90) return 'rojo';
  if (g > 150 && r < 90 && b < 90) return 'verde';
  if (b > 150 && r < 90 && g < 90) return 'azul';
  return `otro (${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

/**
 * Los videos «tuyos» de la prueba, armados con ffmpeg (lavfi), en `dir`:
 *   testsrc   3 s, .mov con mpeg4 + PCM (como el de otro programa): la app lo tiene que pasar a H.264 + AAC
 *   colores   3 s sin sonido: 1 s rojo, 1 s verde y 1 s azul (el color dice qué segundo de tu video se ve)
 *   mudo      3 s sin sonido (en objeto parlante no se puede: la voz va dentro del clip)
 *   conVoz    6 s con sonido (lo que dura la escena de objeto parlante), .webm VP9 + Opus como el de un navegador
 *             (si este ffmpeg no lo arma, un .mp4)
 *   texto     un .txt (no es un video)
 */
function videosDePrueba(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const v = {
    testsrc: path.join(dir, 'prueba-testsrc.mov'),
    colores: path.join(dir, 'prueba-colores.mp4'),
    mudo: path.join(dir, 'prueba-sin-sonido.mp4'),
    conVoz: path.join(dir, 'prueba-con-voz.webm'),
    conVozTipo: 'video/webm',
    texto: path.join(dir, 'no-es-video.txt'),
  };
  const pasos = [
    ['-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=25:duration=3', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100:duration=3', '-c:v', 'mpeg4', '-q:v', '4', '-c:a', 'pcm_s16le', '-shortest', v.testsrc],
    ['-f', 'lavfi', '-i', 'color=c=red:s=320x240:r=25:d=1', '-f', 'lavfi', '-i', 'color=c=lime:s=320x240:r=25:d=1', '-f', 'lavfi', '-i', 'color=c=blue:s=320x240:r=25:d=1', '-filter_complex', '[0:v][1:v][2:v]concat=n=3:v=1:a=0[v]', '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', v.colores],
    ['-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=25:duration=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', v.mudo],
  ];
  for (const a of pasos) {
    const r = ffmpegHacer(a);
    if (!r.ok) return { ok: false, error: r.error };
  }
  const voz = ['-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=25:duration=6', '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=48000:duration=6'];
  let r = ffmpegHacer([...voz, '-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '400k', '-c:a', 'libopus', '-shortest', v.conVoz]);
  if (!r.ok) {
    Object.assign(v, { conVoz: path.join(dir, 'prueba-con-voz.mp4'), conVozTipo: 'video/mp4' });
    r = ffmpegHacer([...voz, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', v.conVoz]);
    if (!r.ok) return { ok: false, error: r.error };
  }
  fs.writeFileSync(v.texto, 'esto no es un video\n');
  return { ok: true, ...v };
}

/** GET de un archivo de la app (lo que hace «Descargar»): { st, tipo, bytes }. */
async function descargarDe(base, url) {
  try {
    const r = await fetch(base + url, { signal: AbortSignal.timeout(120000) });
    const buf = Buffer.from(await r.arrayBuffer());
    return { st: r.status, tipo: r.headers.get('content-type') || '', bytes: buf.length, url };
  } catch (e) {
    return { st: 0, error: e.message, url };
  }
}

/** El último JSON que imprimió un comando (o null). */
const ultimoJSON = (texto) => {
  try {
    return JSON.parse(String(texto || '').trim().split(/\r?\n/).pop());
  } catch {
    return null;
  }
};

/** Lo de un anuncio que no se lee por la API (los archivos de la prueba, en temp/<slug>/). */
function enElAnuncio(slug) {
  const C = path.join(RAIZ, 'temp', slug);
  const archivos = (sub, re) => {
    try {
      return fs.readdirSync(path.join(C, sub)).filter((n) => re.test(n));
    } catch {
      return [];
    }
  };
  return {
    C,
    conductor: () => leerJSON(path.join(C, 'app', 'conductor.json')) || {},
    // las piezas que la app rehízo por calidad (conductor.rehechos): desde 2026-11-09, ninguna
    rehechosDeCalidad: (c) => Object.keys(c?.rehechos || {}).filter((k) => /^(toma|broll|paso|clip|imagen|gancho)-/.test(k)),
    // img/*.png y video/*.mp4 con su fecha (para saber qué se volvió a generar)
    huellas: () => Object.fromEntries([...archivos('img', /\.png$/i).map((n) => `img/${n}`), ...archivos('video', /\.mp4$/i).map((n) => `video/${n}`)].map((r) => [r, statDe(path.join(C, r)).mtimeMs])),
    // lo que hay en historial/, sin la fecha del nombre ('toma-3--2026-11-09T...mp4' -> 'toma-3.mp4')
    historial: () => archivos('historial', /\.(png|jpe?g|webp|mp4)$/i).map((n) => n.replace(/--[^.]*(\.\w+)$/, '$1')).sort(),
    hechos: () => leerJSON(path.join(C, 'app', 'rehacer', 'hechos.json'))?.lotes || [],
    trabajo: () => leerJSON(path.join(C, 'app', 'rehacer', 'trabajo.json')),
    // lo cobrado hasta ahora (app/gasto/) desde `desde` (ms): { creditos, corridas }
    gastoDesde: (desde = 0) => {
      const corridas = archivos(path.join('app', 'gasto'), /^\d+-.+\.json$/)
        .map((n) => ({ n, st: statDe(path.join(C, 'app', 'gasto', n)), x: leerJSON(path.join(C, 'app', 'gasto', n)) }))
        .filter((g) => g.x && g.st.mtimeMs >= desde);
      const creditos = corridas.reduce((s, g) => s + (Number(g.x.creditos) || 0) + (g.x.sinRegistro || []).reduce((t, y) => t + (Number(y?.creditosEstimados) || 0), 0), 0);
      return { creditos: Math.round(creditos * 100) / 100, corridas: corridas.map((g) => [g.x.paso, g.x.creditos]) };
    },
  };
}

/**
 * Espera a que lo pedido a regenerar (o tu video) termine: la fila vacía y el último lote «listo» con `lotes` lotes en
 * hechos.json (o un error, o que la producción se trabe). Va contando el lote y el paso en la consola.
 */
async function esperarLotes({ pedir, slug, lotes, minutos = 15, salio, log }) {
  const a = enElAnuncio(slug);
  let ultimo = '';
  return esperarHasta(
    'regenerar',
    minutos,
    async () => {
      const d = (await pedir(`/api/anuncios/${slug}/rehacer?esperar=0`)).datos;
      const t = d?.trabajo;
      const txt = `${t ? `lote ${t.id}: ${t.fase}${t.paso?.id ? ` (${t.paso.id})` : ''}` : 'sin lote'} · en la fila ${d?.cola?.length ?? '?'}`;
      if (txt !== ultimo) log((ultimo = txt));
      return { ...d, hechos: a.hechos() };
    },
    (d) => Boolean(d?.trabajo?.trabado) || (d?.cola?.length === 0 && ((d.hechos.length >= lotes && d.trabajo?.fase === 'listo') || ['error', 'cancelado'].includes(d?.trabajo?.fase))),
    salio
  );
}

/**
 * Con el claymation ya entregado: los avisos, el costo de cada pieza, tu video en la edición con velocidad y deslizar
 * en una exportación, regenerar (tal cual, «Corregir esto», «¿Qué salió mal?») con la fila, y descargar.
 */
async function probarPrimerIntento({ pedir, check, aviso, salio, t0, slug, registro, INFORME, motor }) {
  const BASE = `http://127.0.0.1:${Number(process.env.PUERTO) || 4497}`;
  const a = enElAnuncio(slug);
  const { C } = a;
  const log = (t) => console.log(`   [primer intento] ${Math.round((Date.now() - t0) / 1000)} s  ${t}`);
  const sinPrompts = (x) => !/prompt_|Negative prompt|Vertical 9:16/i.test(JSON.stringify(x ?? null));
  const tomaDe = (m, n) => (m?.tomas || []).find((x) => x.n === n) || {};
  const IA = motor === 'codex' ? 'ChatGPT' : 'Claude';

  // ------------------------------------------------------------ 1. la revisión solo avisa
  const c0 = a.conductor();
  const revImg = (c0.pasos || []).find((p) => p.id === 'revision-imagenes');
  check(`La revisión de las imágenes solo avisa: «${revImg?.nota}»`, revImg?.estado === 'hecho' && /^La revisión dejó (un aviso|\d+ avisos): míra/.test(revImg?.nota || ''), revImg);
  check('Nada se rehízo solo por calidad (conductor.rehechos sin piezas e historial/ vacío)', !a.rehechosDeCalidad(c0).length && !a.historial().length, { rehechos: c0.rehechos, historial: a.historial() });
  // (la instrucción que sugirió la revisión, para comparar después de «Corregir esto»: solo la lee el servidor)
  const sug = leerJSON(path.join(C, 'app', 'avisos.json'))?.piezas?.['img:toma-2-inicial']?.find((x) => x.sugerencia)?.sugerencia || null;
  let r = await pedir(`/api/anuncios/${slug}/produccion`);
  const av = r.datos?.avisos || {};
  const a2 = av['img:toma-2-inicial'] || [];
  check(
    'GET /produccion trae el aviso en su pieza (Escena 2, imagen de inicio): de la revisión de la IA, con instrucción lista para «Corregir esto»',
    r.st === 200 && Object.keys(av).join() === 'img:toma-2-inicial' && a2.length === 1 && a2[0].fuente === 'revision-ia' && a2[0].paso === 'revision-imagenes' && a2[0].sugerencia === true && a2[0].texto?.length > 3,
    av
  );
  check(
    'GET /produccion: el aviso no trae la instrucción (los prompts quedan en el servidor) y no hay ningún «antes» (nada se rehízo)',
    sinPrompts(av) && !Object.keys(r.datos?.arreglos || {}).length && Boolean(sug?.prompt_imagen_inicial && sug?.prompt_video),
    { arreglos: r.datos?.arreglos, sugerencia: sug ? Object.keys(sug) : null }
  );
  r = await pedir(`/api/entrega/${slug}`);
  const ae = r.datos?.avisos || [];
  const problemas = r.datos?.informe?.problemas || [];
  const pAvisos = problemas.find((p) => p.id === 'revision-avisos');
  check(
    `La entrega trae «Lo que notó la revisión»: ${ae.map((x) => `${x.pieza} (segundo ${coma(x.momento, 1)})`).join(', ')}`,
    r.st === 200 && ae.length === 1 && ae[0].clave === 'img:toma-2-inicial' && ae[0].pieza === 'Escena 2 · imagen de inicio' && ae[0].sugerencia === true && Number.isFinite(ae[0].momento) && sinPrompts(ae),
    ae
  );
  check(
    'El informe de la entrega lo cuenta en «Lo que notó la revisión» y no dice que algo se rehízo',
    pAvisos?.titulo === 'Lo que notó la revisión' && pAvisos.tipo === 'revisar' && pAvisos.piezas?.[0]?.clave === 'img:toma-2-inicial' && !problemas.some((p) => /^rehechas/.test(p.id)),
    problemas.map((p) => [p.id, p.tipo, p.titulo])
  );

  // ------------------------------------------------------------ 2. lo que se puede regenerar y cuánto cuesta cada pieza
  let reh = (await pedir(`/api/anuncios/${slug}/rehacer?esperar=5000`)).datos;
  for (let i = 0; i < 10 && reh?.disponible && (reh.piezas || []).some((p) => !p.motivoNo && !p.costo); i++) {
    await dormir(1500);
    reh = (await pedir(`/api/anuncios/${slug}/rehacer?esperar=5000`)).datos;
  }
  const pz = reh?.porPieza || {};
  // (con tu material: la escena 1 es tu imagen, su clip se regenera pero la imagen no; la imagen de apoyo 2 es tu video
  // y no se regenera)
  const conMaterial = Boolean(pz['broll-2']);
  const REGENERABLES = ['toma-1', 'toma-2', 'toma-3', 'broll-1'];
  check(
    'GET /rehacer: se pueden regenerar las escenas 1 a 3 y la imagen de apoyo 1 (si es tu video, no); la hoja del personaje y la foto del producto no, con su porqué',
    reh?.disponible === true && Array.isArray(reh.piezas) && REGENERABLES.every((id) => pz[id] && !pz[id].motivoNo) && pz['toma-1'].nombre === 'Escena 1' && pz['broll-1'].nombre === 'Imagen de apoyo 1' && Boolean(pz['hoja-mujer']?.motivoNo) && /foto de tu producto/.test(pz['hoja-producto']?.motivoNo || '') && (!conMaterial || (/Es tu video/.test(pz['broll-2'].motivoNo || '') && pz['broll-2'].costo === null && pz['toma-1'].imagen === false)),
    reh && { disponible: reh.disponible, motivo: reh.motivo, piezas: (reh.piezas || []).map((p) => [p.pieza, p.nombre, p.motivoNo || 'sí']) }
  );
  check(
    `GET /rehacer: cada pieza con su costo (solo el clip y con su imagen: ${REGENERABLES.map((id) => `${id} US$ ${coma(pz[id]?.costo?.clip?.dolares)} / ${coma(pz[id]?.costo?.conImagen?.dolares)}`).join(', ')}), el aviso de la Escena 2 y nada de prompts`,
    REGENERABLES.every((id) => pz[id]?.costo?.clip?.dolares > 0 && ((conMaterial && id === 'toma-1') || pz[id].costo.conImagen?.dolares > pz[id].costo.clip.dolares)) && pz['toma-2'].aviso?.sugerencia === true && pz['toma-2'].aviso.clave === 'img:toma-2-inicial' && !pz['toma-1'].aviso && sinPrompts(reh),
    REGENERABLES.map((id) => [id, pz[id]?.costo, pz[id]?.aviso])
  );
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/(_API_KEY|_TOKEN|_SECRET)$/i.test(k)) delete env[k];
  const cli = ultimoJSON(correr(process.execPath, [path.join(RAIZ, 'produccion', 'estimar-costo.js'), `temp/${slug}`, '--json', '--piezas'], { cwd: RAIZ, env, timeout: 60000 }).stdout);
  check(
    'El costo de cada botón es el del motor (produccion/estimar-costo.js --piezas)',
    cli?.ok === true && REGENERABLES.every((id) => JSON.stringify(cli.piezas?.[id]?.clip) === JSON.stringify(pz[id]?.costo?.clip) && JSON.stringify(cli.piezas?.[id]?.conImagen) === JSON.stringify(pz[id]?.costo?.conImagen)),
    { motor: cli?.piezas, servidor: Object.fromEntries(REGENERABLES.map((id) => [id, pz[id]?.costo])) }
  );

  // ------------------------------------------------------------ 3. tu video en la edición (modo A), velocidad y deslizar
  const v = videosDePrueba(path.join(INFORME, 'videos-de-prueba'));
  if (!check('ffmpeg arma los videos «tuyos» de la prueba (testsrc .mov, colores, sin sonido y con voz)', v.ok, v.error)) return;
  const subir = (pieza, archivo, tipo, headers = {}) => pedir(`/api/anuncios/${slug}/reemplazo?pieza=${encodeURIComponent(pieza)}&nombre=${encodeURIComponent(path.basename(archivo))}`, { cuerpo: fs.readFileSync(archivo), headers: { 'Content-Type': tipo, ...headers }, ms: 300000 });
  r = await subir('toma-2', v.texto, 'text/plain');
  check('Subir algo que no es un video da 400', r.st === 400 && typeof r.datos?.error === 'string', r);
  r = await subir('toma-99', v.testsrc, 'video/quicktime');
  check('Subir tu video a una escena que no está en el anuncio da 400', r.st === 400 && typeof r.datos?.error === 'string', r);
  r = await subir('toma-2', v.testsrc, 'video/quicktime', { Origin: 'http://otro-sitio.example' });
  check('Subir tu video desde otra página da 403', r.st === 403, r);
  r = await subir('toma-2', v.testsrc, 'video/quicktime');
  const sub2 = r.datos || {};
  check(
    `Tu video (testsrc .mov) en la Escena 2: «en la edición», no toca el anuncio (${sub2.largo} s, con sonido)`,
    r.st === 200 && sub2.modo === 'edicion' && /^subidos\/[a-z0-9]{6,40}\.mp4$/i.test(sub2.archivo || '') && Math.abs(sub2.largo - 3) < 0.2 && sub2.conAudio === true && sub2.pieza === 'toma-2',
    r
  );
  const s2 = sub2.archivo ? sondearVideo(path.join(C, 'video', sub2.archivo)) : null;
  check(
    `Tu video quedó listo para el anuncio: ${s2?.video?.codec} ${s2?.video?.pix} ${s2?.video?.ancho}x${s2?.video?.alto} a ${s2?.video?.fps} fps, audio ${s2?.audio?.codec} ${s2?.audio?.hz} Hz`,
    s2?.video?.codec === 'h264' && s2.video.pix === 'yuv420p' && s2.video.ancho === 720 && s2.video.alto === 1280 && s2.video.fps === 30 && s2.audio?.codec === 'aac' && s2.audio.hz === 48000,
    s2
  );
  const d2 = sub2.url ? await descargarDe(BASE, sub2.url) : { st: 0 };
  check('Tu video se sirve para la vista previa (200, video/mp4)', d2.st === 200 && /video\/mp4/.test(d2.tipo) && d2.bytes > 1000, d2);
  r = await subir('toma-1', v.colores, 'video/mp4');
  const sub1 = r.datos || {};
  check('Otro video tuyo (de colores, sin sonido) en la Escena 1: «en la edición», sin sonido', r.st === 200 && sub1.modo === 'edicion' && sub1.conAudio === false && Math.abs(sub1.largo - 3) < 0.2, r);
  r = await pedir(`/api/anuncios/${slug}/reemplazo`);
  const q1 = r.datos?.piezas?.['toma-1'];
  check(
    'GET /reemplazo: tus dos videos, y en voz en off cada clip se puede acelerar, deslizar y reemplazar «en la edición»',
    r.st === 200 && [sub1.id, sub2.id].every((id) => (r.datos?.subidos || []).some((s) => s.id === id)) && q1?.velocidad === true && q1.deslizar === true && q1.reemplazar === 'edicion' && !Object.keys(r.datos?.enAnuncio || {}).length,
    r.datos
  );
  const estado = {
    reemplazos: {
      'toma-1': { id: sub1.id, archivo: sub1.archivo, largo: sub1.largo, nombre: sub1.nombre, mudo: true },
      'toma-2': { id: sub2.id, archivo: sub2.archivo, largo: sub2.largo, nombre: sub2.nombre, mudo: true },
    },
    clips: { 'toma-1': { velocidad: 1.5, desliza: 1.1 }, 'toma-2': { velocidad: 0.75, desliza: 0.5 } },
  };
  r = await pedir(`/api/anuncios/${slug}/edicion`, { metodo: 'PUT', json: { estado, t: Date.now(), contexto: { titulo: 'Prueba de humo' } } });
  check('Se guardan los cambios del editor (tus videos, la velocidad y el deslizar)', r.st === 200 && r.datos?.ok === true, r);
  // la misma cuenta que la vista previa y la exportación (capas.mjs)
  let capas = null;
  try {
    capas = await import(pathToFileURL(path.join(RAIZ, 'remotion', 'src', 'edicion', 'capas.mjs')).href);
  } catch (e) {
    check('Se carga remotion/src/edicion/capas.mjs', false, e.message);
    return { videos: v };
  }
  const plan = leerJSON(path.join(C, 'plan-montaje.json'));
  const ed = capas.completarEdicion(estado);
  const tomas = capas.tomasDeEdicion(plan, ed);
  const brolls = capas.brollsDeEdicion(plan, ed);
  const t1 = tomas.find((x) => x.pieza === 'toma-1');
  const t2 = tomas.find((x) => x.pieza === 'toma-2');
  const enPlan = (capas.planAjustado(plan, ed)?.bloques || []).map((b) => b?.toma).filter(Boolean);
  const b1 = enPlan.find((x) => x.archivo === sub1.archivo);
  check(
    'capas.mjs (vista previa y exportación): la Escena 1 es tu video a 1,5× desde su segundo 1,1 (sin sonido) y la 2 el tuyo a 0,75× desde el 0,5',
    t1?.reemplazado && t1.velocidad === 1.5 && Math.abs(t1.entradaVista - 1.1) < 1e-6 && t2?.reemplazado && t2.velocidad === 0.75 && Math.abs(t2.entradaVista - 0.5) < 1e-6 && b1?.velocidad === 1.5 && Math.abs(b1.recorteInicio - 1.1) < 1e-6 && b1.mudo === true,
    { t1, t2, b1 }
  );
  // un segundo de la escena que no tape una imagen de apoyo
  const libre = (x, ...candidatos) => candidatos.map((d) => x.inicio + d).find((t) => t < x.fin - 0.1 && !brolls.some((b) => t >= b.desde - 0.1 && t <= b.fin + 0.1)) ?? null;
  r = await pedir(`/api/anuncios/${slug}/exportar`, { json: { calidad: '720', version: 'limpia', estado, contexto: { titulo: 'Prueba de humo' } } });
  if (check('Se pide la exportación con tus videos (versión limpia, 720)', r.st === 200 && r.datos?.trabajo, r) && t1 && t2) {
    const ex = await esperarHasta('la exportación', 10, async () => (await pedir(`/api/anuncios/${slug}/exportar`)).datos, (d) => ['listo', 'error', 'cancelado'].includes(d?.trabajo?.estado), salio);
    const res = ex?.trabajo?.resultado;
    log(`exportación: ${ex?.trabajo?.estado} ${res?.archivo || ''}`);
    if (check(`La exportación termina («listo»): ${res?.archivo}`, ex?.trabajo?.estado === 'listo' && res?.url, { trabajo: ex?.trabajo, tiempo: ex?._seAcaboElTiempo })) {
      const dl = await descargarDe(BASE, res.url);
      check('Descargar la versión editada: 200, video/mp4', dl.st === 200 && /video\/mp4/.test(dl.tipo) && dl.bytes > 20000, dl);
      const mp4 = path.join(RAIZ, 'output', res.archivo);
      // la Escena 1: rojo, verde y azul de a 1 s, a 1,5× desde el segundo 1,1 => verde y después azul
      const ta = libre(t1, 0.35, 0.3, 0.4);
      const tb = libre(t1, 0.85, 0.8, 0.9);
      const enTuVideo = (t) => coma(t1.entradaVista + (t - t1.inicio) * t1.velocidad);
      const ca = ta === null ? null : colorDe(cuadroDe(mp4, ta));
      const cb = tb === null ? null : colorDe(cuadroDe(mp4, tb));
      check(
        `Velocidad y deslizar en la exportación: en el segundo ${coma(ta)} se ve verde (el ${ta === null ? '?' : enTuVideo(ta)} de tu video) y en el ${coma(tb)}, azul (el ${tb === null ? '?' : enTuVideo(tb)})`,
        ca === 'verde' && cb === 'azul',
        { ca, cb, escena1: { inicio: t1.inicio, fin: t1.fin, entradaVista: t1.entradaVista, velocidad: t1.velocidad } }
      );
      // la Escena 2: tu testsrc, no el clip de la app
      const tc = libre(t2, 0.4, 0.25, 0.6, 0.8);
      const exp = tc === null ? null : cuadroDe(mp4, tc);
      const deTuVideo = tc === null ? null : cuadroDe(path.join(C, 'video', sub2.archivo), t2.entradaVista + (tc - t2.inicio) * t2.velocidad);
      const dTuyo = diferenciaDe(exp, deTuVideo);
      const dApp = diferenciaDe(exp, cuadroDe(path.join(C, 'video', 'toma-2.mp4'), 1));
      check(`En la Escena 2 se ve tu video (diferencia ${coma(dTuyo, 1)} con tu video y ${coma(dApp, 1)} con el clip de la app)`, dTuyo < 30 && dApp > dTuyo + 15, { tc, dTuyo, dApp, escena2: { inicio: t2.inicio, fin: t2.fin } });
    }
  }

  // ------------------------------------------------------------ 4. regenerar: tal cual y «Corregir esto» en un lote
  const mp4Entregado = () => listar(path.join(RAIZ, 'output'), (f) => path.basename(f).startsWith(`${slug}_`) && !/_editado-/.test(f) && /\.mp4$/i.test(f))[0] || null;
  const antes = { huellas: a.huellas(), man: leerJSON(path.join(C, 'manifiesto.json')), creditos: Number(leerJSON(path.join(C, 'app', 'informe.json'))?.costo?.creditos), mp4: statDe(mp4Entregado()).mtimeMs, notas: leerNotas(registro).length };
  const rehacer = (json, headers) => pedir(`/api/anuncios/${slug}/rehacer`, { json, headers });
  r = await rehacer({ pieza: 'hoja-mujer' });
  check('Regenerar la hoja del personaje no se ofrece: 400 con su porqué (de ella salen todas las escenas)', r.st === 400 && r.datos?.motivoNo === true && r.datos.error?.length > 10, r);
  r = await rehacer({ pieza: 'toma-1', pedido: 'ab' });
  check('«¿Qué salió mal?» con 2 letras da 400', r.st === 400, r);
  r = await rehacer({ pieza: 'toma-1', usarSugerencia: true });
  check('«Corregir esto» en una escena sin aviso da 400', r.st === 400, r);
  r = await rehacer({ pieza: 'toma-99' });
  check('Regenerar una escena que no existe da 400', r.st === 400, r);
  r = await rehacer({ pieza: 'toma-1' }, { Origin: 'http://otro-sitio.example' });
  check('Regenerar desde otra página da 403', r.st === 403, r);
  const p1 = await rehacer({ pieza: 'toma-1', pedido: '' });
  const p2 = await rehacer({ pieza: 'toma-2', usarSugerencia: true });
  check(
    '«Regenerar» la Escena 1 (tal cual, solo el clip) y «Corregir esto» en la Escena 2 (con su imagen): entran los dos (200)',
    p1.st === 200 && p1.datos?.pedido?.modo === 'tal-cual' && p1.datos.pedido.conImagen === false && p2.st === 200 && p2.datos?.pedido?.modo === 'sugerencia' && p2.datos.pedido.conImagen === true,
    { p1: p1.datos || p1, p2: p2.datos || p2 }
  );
  let g = await esperarHasta('el lote en la producción', 6, async () => (await pedir(`/api/anuncios/${slug}/rehacer?esperar=0`)).datos, (d) => d?.trabajo?.fase === 'produccion' || ['listo', 'error', 'cancelado'].includes(d?.trabajo?.fase), salio);
  check(
    `Los dos van en UN lote, que arma el anuncio una sola vez (${(g?.trabajo?.piezas || []).map((x) => `${x.pieza} ${x.modo}: ${x.estado}`).join(', ')})`,
    g?.trabajo?.fase === 'produccion' && g.trabajo.piezas?.length === 2 && g.trabajo.piezas.every((x) => x.estado === 'aplicada'),
    g?.trabajo || g
  );
  // mientras el anuncio se arma: «¿Qué salió mal?» en la Escena 3 y Regenerar la imagen de apoyo 1 esperan en la fila
  const PEDIDO = 'La mujer se ve muy lejos: acerca la cámara a su cara';
  const p3 = await rehacer({ pieza: 'toma-3', pedido: PEDIDO });
  check('«¿Qué salió mal?» en la Escena 3 mientras el anuncio se arma: entra a la fila (nunca «espera a que termine»)', p3.st === 200 && p3.datos?.pedido?.modo === 'pedido' && p3.datos.cola?.length === 1 && p3.datos.esperaA === 'regenerando', p3.datos || p3);
  const p4 = await rehacer({ pieza: 'broll-1', pedido: '' });
  check('Y la imagen de apoyo 1 también: dos en la fila', p4.st === 200 && p4.datos?.cola?.length === 2, p4.datos || p4);
  r = await pedir(`/api/anuncios/${slug}/rehacer/cancelar`, { json: { id: 'no-existe' } });
  check('«Quitar» un pedido que no está en la fila da 409', r.st === 409, r);
  r = await pedir(`/api/anuncios/${slug}/rehacer/cancelar`, { json: {} });
  check('Cortar el lote cuando ya se está generando da 409 (se frena con Detener)', r.st === 409, r);
  r = await pedir(`/api/anuncios/${slug}/rehacer/cancelar`, { json: { id: p4.datos?.pedido?.id } });
  check('«Quitar» la imagen de apoyo 1 de la fila: queda solo la Escena 3', r.st === 200 && r.datos?.cola?.length === 1 && r.datos.cola[0].pieza === 'toma-3', r.datos || r);
  g = await esperarLotes({ pedir, slug, lotes: 2, minutos: 15, salio, log });
  const h = a.hechos();
  const deLote = (x) => (x?.piezas || []).map((y) => `${y.pieza}/${y.modo}`).sort().join(' ');
  check(
    `Dos lotes: Escena 1 tal cual + Escena 2 «Corregir esto», y después la Escena 3 «¿Qué salió mal?», que arrancó sola (${h.map(deLote).join(' | ')})`,
    h.length === 2 && deLote(h[0]) === 'toma-1/tal-cual toma-2/sugerencia' && deLote(h[1]) === 'toma-3/pedido',
    { hechos: h, trabajo: g?.trabajo, tiempo: g?._seAcaboElTiempo }
  );
  const t = g?.trabajo;
  check('El último lote termina «listo» y avisa que tu versión editada todavía tiene lo anterior (exportarla de nuevo)', t?.fase === 'listo' && t.exportarDeNuevo === true && /descárgala de nuevo/.test(t.notaExportar || ''), t);
  r = await pedir(`/api/anuncios/${slug}/exportar`);
  check('GET /exportar: tu versión editada quedó vieja («desactualizada», por la Escena 3)', r.st === 200 && (r.datos?.desactualizada?.piezas || []).includes('Escena 3') && /descárgalo de nuevo/.test(r.datos.desactualizada.mensaje || ''), r.datos?.desactualizada);
  check('Tus cambios del editor siguen ahí (tus dos videos en la edición)', Object.keys(leerJSON(path.join(C, 'app', 'edicion.json'))?.estado?.reemplazos || {}).sort().join() === 'toma-1,toma-2');

  // lo que cambió: solo lo pedido (la Escena 1 y la 3 sin su imagen; la Escena 2 con la suya; la imagen de apoyo, nada)
  const despues = a.huellas();
  const cambiaron = Object.keys(despues).filter((k) => despues[k] !== antes.huellas[k]).sort();
  check(`Solo se generó lo pedido: ${cambiaron.join(', ')}`, cambiaron.join() === 'img/toma-2-inicial.png,video/toma-1.mp4,video/toma-2.mp4,video/toma-3.mp4', { cambiaron });
  check(`Lo de antes quedó en historial/ (el «Antes» del proceso): ${a.historial().join(', ')}`, a.historial().join() === 'toma-1.mp4,toma-2-inicial.png,toma-2.mp4,toma-3.mp4', a.historial());
  r = await pedir(`/api/anuncios/${slug}/produccion`);
  const arr = r.datos?.arreglos || {};
  const conAntes = ['vid:toma-1', 'img:toma-2-inicial', 'vid:toma-2', 'vid:toma-3'];
  const antesUrls = conAntes.map((k) => arr[k]?.[0]?.antes).filter(Boolean);
  const bajados = await Promise.all(antesUrls.map((u) => descargarDe(BASE, u)));
  check(
    'GET /produccion: cada pieza regenerada con su «Antes» (se sirve) y ningún aviso (el de la Escena 2 se fue y no volvió)',
    conAntes.every((k) => arr[k]?.length === 1) && bajados.length === 4 && bajados.every((x) => x.st === 200) && !Object.keys(r.datos?.avisos || {}).length,
    { arreglos: Object.keys(arr), avisos: r.datos?.avisos, bajados }
  );
  const man = leerJSON(path.join(C, 'manifiesto.json'));
  check('«Corregir esto» usó lo que sugirió la revisión (los prompts de la Escena 2 son los de su aviso)', Boolean(sug) && tomaDe(man, 2).prompt_imagen_inicial === sug.prompt_imagen_inicial && tomaDe(man, 2).prompt_video === sug.prompt_video);
  check('«Regenerar» tal cual dejó la Escena 1 con sus mismos prompts', tomaDe(man, 1).prompt_video === tomaDe(antes.man, 1).prompt_video && tomaDe(man, 1).prompt_imagen_inicial === tomaDe(antes.man, 1).prompt_imagen_inicial);
  check(
    `«¿Qué salió mal?»: ${IA} reescribió solo el clip de la Escena 3 con lo que contó el usuario (su imagen quedó)`,
    tomaDe(man, 3).prompt_video !== tomaDe(antes.man, 3).prompt_video && String(tomaDe(man, 3).prompt_video).includes(PEDIDO) && tomaDe(man, 3).prompt_imagen_inicial === tomaDe(antes.man, 3).prompt_imagen_inicial,
    { antes: tomaDe(antes.man, 3).prompt_video, ahora: tomaDe(man, 3).prompt_video }
  );
  const nuevas = leerNotas(registro).slice(antes.notas).filter((x) => x.tipo === 'tarea');
  check(
    `Solo «¿Qué salió mal?» abrió una sesión de ${IA} (tal cual y «Corregir esto», no)`,
    nuevas.length > 0 && nuevas.every((x) => /^rehacer\b/.test(x.tarea || '') && x.via === motor),
    nuevas.map((x) => [x.tarea, x.via])
  );
  const c1 = a.conductor();
  check('El conductor anotó los dos lotes y no rehízo nada solo', (c1.rehacer || []).length >= 2 && !a.rehechosDeCalidad(c1).length && c1.estado === 'listo', { rehacer: c1.rehacer, rehechos: c1.rehechos, estado: c1.estado });
  check('El video del anuncio se volvió a armar con lo nuevo (output/)', statDe(mp4Entregado()).mtimeMs > antes.mp4, { antes: antes.mp4, ahora: statDe(mp4Entregado()) });
  const despuesCreditos = Number(leerJSON(path.join(C, 'app', 'informe.json'))?.costo?.creditos);
  const botones = Math.round((pz['toma-1']?.costo?.clip?.creditos + pz['toma-2']?.costo?.conImagen?.creditos + pz['toma-3']?.costo?.clip?.creditos) * 100) / 100;
  const pagado = Math.round((despuesCreditos - antes.creditos) * 100) / 100;
  check(`Lo que costó regenerar es lo que decía cada botón (${pagado} créditos; los botones: ${botones})`, Number.isFinite(pagado) && Math.abs(pagado - botones) <= 0.01, { antes: antes.creditos, despues: despuesCreditos, botones });

  // ------------------------------------------------------------ 5. descargar
  r = await pedir(`/api/anuncios/${slug}`);
  const principal = (r.datos?.versiones || []).find((x) => x.principal && x.clase === 'video');
  const dv = principal ? await descargarDe(BASE, `${principal.url}${principal.url.includes('?') ? '&' : '?'}v=${encodeURIComponent(principal.fecha || '1')}`) : { st: 0 };
  check('«Descargar video» (el anuncio terminado, con ?v=): 200, video/mp4', dv.st === 200 && /video\/mp4/.test(dv.tipo) && dv.bytes > 20000, dv);
  const dc = await descargarDe(BASE, `/archivos/anuncio/${encodeURIComponent(slug)}/video/toma-1.mp4?v=${Date.now()}`);
  check('«Descargar» un clip (la Escena 1 nueva): 200, video/mp4', dc.st === 200 && /video\/mp4/.test(dc.tipo) && dc.bytes > 1000, dc);
  const di = await descargarDe(BASE, `/archivos/anuncio/${encodeURIComponent(slug)}/img/toma-2-inicial.png?v=${Date.now()}`);
  check('«Descargar» una imagen (la de la Escena 2 nueva): 200, image/png', di.st === 200 && /image\/png/.test(di.tipo) && di.bytes > 1000, di);
  if (!principal) aviso('GET /api/anuncios/<slug> no trajo la versión principal del video.');
  return { videos: v };
}

/**
 * Tu video «en el anuncio» (modo B): un anuncio de objeto parlante (la voz va dentro de cada clip). Sin sonido no se
 * puede; con sonido reemplaza la escena de verdad (lo de antes a historial/), se vuelve a armar desde la revisión de los
 * clips sin pedirle nada a kie y «Volver al clip original» lo deshace.
 */
async function probarModoB({ pedir, check, aviso, salio, t0, productoId, videos }) {
  const log = (t) => console.log(`   [objeto parlante] ${Math.round((Date.now() - t0) / 1000)} s  ${t}`);
  let r = await pedir('/api/anuncios', { json: { productoId, estilo: 'talking-object-pixar', continuidad: false, respuestas: {} } });
  const slug = r.datos?.slug;
  if (!check('Se crea un anuncio de objeto parlante (la voz va dentro de cada clip)', r.st === 201 && slug, r)) return null;
  const guion = await esperarHasta('el guion', 5, async () => (await pedir(`/api/anuncios/${slug}/guion`)).datos, (d) => ['listo', 'error', 'bloqueado'].includes(d?.estado), salio);
  if (!check('Su guion queda listo (2 escenas habladas)', guion?.estado === 'listo' && guion?.guion?.partes?.length === 2, { estado: guion?.estado, error: guion?.error, tiempo: guion?._seAcaboElTiempo })) return slug;
  r = await pedir(`/api/anuncios/${slug}/costo`);
  check(`Su costo estimado es un solo número, sin margen (${r.datos?.creditos?.min} créditos)`, r.st === 200 && r.datos?.disponible === true && r.datos.familia === 'objeto-parlante' && r.datos.margen === 0 && r.datos.creditos?.min > 0 && r.datos.creditos.min === r.datos.creditos.max, r.datos && { disponible: r.datos.disponible, motivo: r.datos.motivo, familia: r.datos.familia, margen: r.datos.margen, creditos: r.datos.creditos });
  r = await pedir(`/api/anuncios/${slug}/producir`, { json: {} });
  if (!check('Se aprueba y arranca la producción', r.st >= 200 && r.st < 300, r)) return slug;
  const vistos = new Map();
  const c = await esperarHasta(
    'la producción de objeto parlante',
    20,
    async () => {
      const d = (await pedir(`/api/anuncios/${slug}/conductor`)).datos;
      for (const p of d?.pasos || []) {
        if (vistos.get(p.id) !== p.estado) {
          vistos.set(p.id, p.estado);
          if (p.estado !== 'pendiente') log(`${p.id}: ${p.estado}${p.nota ? ` (${String(p.nota).slice(0, 120)})` : ''}`);
        }
      }
      return d;
    },
    (d) => ['listo', 'error', 'pausado'].includes(d?.estado),
    salio
  );
  if (!check('La producción de objeto parlante termina («listo»)', c?.estado === 'listo', { estado: c?.estado, paso: c?.paso, error: c?.error, pasos: (c?.pasos || []).map((p) => `${p.id}=${p.estado}`), tiempo: c?._seAcaboElTiempo })) return slug;
  const a = enElAnuncio(slug);
  const { C } = a;
  check('Nada se rehízo solo (historial/ vacío y sin rehechos de calidad)', !a.historial().length && !a.rehechosDeCalidad(a.conductor()).length, { historial: a.historial(), rehechos: a.conductor().rehechos });
  const clip = path.join(C, 'video', 'toma-2.mp4');
  const delApp = cuadroDe(clip, 1);
  r = await pedir(`/api/anuncios/${slug}/reemplazo`);
  const q = r.datos?.piezas?.['toma-2'];
  check('GET /reemplazo: en objeto parlante tu video va «en el anuncio» y el clip no se acelera ni se desliza (con su porqué)', r.st === 200 && q?.reemplazar === 'anuncio' && q.velocidad === false && q.deslizar === false && /voz/.test(q.motivo || ''), r.datos);
  const subir = (archivo, tipo) => pedir(`/api/anuncios/${slug}/reemplazo?pieza=toma-2&nombre=${encodeURIComponent(path.basename(archivo))}`, { cuerpo: fs.readFileSync(archivo), headers: { 'Content-Type': tipo }, ms: 300000 });
  r = await subir(videos.mudo, 'video/mp4');
  check('Un video sin sonido no se puede poner (400: la voz va dentro del clip)', r.st === 400 && /sonido/.test(r.datos?.error || ''), r);
  const desde = Date.now();
  r = await subir(videos.conVoz, videos.conVozTipo);
  const sub = r.datos || {};
  check(`Tu video con sonido (${path.extname(videos.conVoz)}) en la Escena 2: «en el anuncio», entra a la fila`, r.st === 200 && sub.modo === 'anuncio' && sub.pedido?.id && sub.conAudio === true && Math.abs(sub.largo - 6) < 0.3, r);
  let g = await esperarLotes({ pedir, slug, lotes: 1, minutos: 10, salio, log });
  check(
    'Se vuelve a armar desde la revisión de los clips (mide la voz otra vez) y termina «listo»',
    g?.trabajo?.fase === 'listo' && a.trabajo()?.desde === 'revision-clips' && a.hechos()[0]?.piezas?.[0]?.modo === 'subido',
    { trabajo: g?.trabajo, desde: a.trabajo()?.desde, hechos: a.hechos(), tiempo: g?._seAcaboElTiempo }
  );
  const ahora = cuadroDe(clip, 1);
  const tuyo = sub.archivo ? cuadroDe(path.join(C, 'video', sub.archivo), 1) : null;
  check(`La Escena 2 del anuncio es tu video (diferencia ${coma(diferenciaDe(ahora, tuyo), 1)} con el tuyo y ${coma(diferenciaDe(ahora, delApp), 1)} con el de la app)`, diferenciaDe(ahora, tuyo) < 12 && diferenciaDe(ahora, delApp) > 20);
  const subidas = leerJSON(path.join(C, 'app', 'subidos.json'))?.piezas || {};
  const original = subidas['toma-2']?.original;
  check(
    'subidos.json la anota, con el clip de antes en historial/ (para volver)',
    subidas['toma-2']?.id === sub.id && Boolean(original) && [path.join(C, 'historial', path.basename(String(original))), path.join(C, String(original))].some((f) => fs.existsSync(f)),
    { subidas, historial: a.historial() }
  );
  const gasto = a.gastoDesde(desde);
  check(`Poner tu video no le pidió nada a kie (lo cobrado desde que lo subiste: ${gasto.creditos} créditos)`, gasto.creditos === 0, gasto);
  r = await pedir(`/api/anuncios/${slug}/rehacer?esperar=0`);
  const r2 = await pedir(`/api/anuncios/${slug}/reemplazo`);
  check('GET /rehacer y GET /reemplazo dicen que la Escena 2 es tu video', r.datos?.porPieza?.['toma-2']?.subida?.id === sub.id && r2.datos?.enAnuncio?.['toma-2']?.id === sub.id, { rehacer: r.datos?.porPieza?.['toma-2'], reemplazo: r2.datos?.enAnuncio });
  r = await pedir(`/api/anuncios/${slug}/produccion`);
  check('La revisión no le dejó avisos a tu video', !Object.keys(r.datos?.avisos || {}).some((k) => /^(vid|img):toma-2(\b|-)/.test(k)), r.datos?.avisos);
  // «Volver al clip original»
  r = await pedir(`/api/anuncios/${slug}/reemplazo/original`, { json: { pieza: 'toma-2' } });
  check('«Volver al clip original» entra a la fila (200)', r.st === 200 && r.datos?.pedido?.id, r);
  g = await esperarLotes({ pedir, slug, lotes: 2, minutos: 10, salio, log });
  const vuelto = cuadroDe(clip, 1);
  check(
    `Volvió el clip de la app (diferencia ${coma(diferenciaDe(vuelto, delApp), 1)} con el de antes) y subidos.json quedó vacío`,
    g?.trabajo?.fase === 'listo' && diferenciaDe(vuelto, delApp) < 8 && !Object.keys(leerJSON(path.join(C, 'app', 'subidos.json'))?.piezas || {}).length,
    { trabajo: g?.trabajo, tiempo: g?._seAcaboElTiempo }
  );
  r = await pedir(`/api/anuncios/${slug}/reemplazo/original`, { json: { pieza: 'toma-2' } });
  check('«Volver al clip original» cuando ya está el de la app da 400', r.st === 400, r);
  if (!a.hechos().every((x) => (x.piezas || []).every((y) => ['subido', 'original'].includes(y.modo)))) aviso('Los lotes del objeto parlante traen algo que no es tu video ni el original.');
  return slug;
}

// =====================================================================================================================
// 4) Las dos IA (DISENO-motor-codex §6.2)
// =====================================================================================================================

const textoDe = (f) => {
  try {
    return fs.readFileSync(f, 'utf8');
  } catch {
    return '';
  }
};

/**
 * Lo que tiene que estar en el codigo: Codex 0.167.0 con su propio lock (las 4 plataformas de Mac y Windows con su
 * integrity), su .npmrc con include=optional y el respaldo de la release; ningun lanzador corre el instalador de
 * Claude (install.ps1 / install.sh) directo; ningun texto de la pantalla manda a instalar Codex a mano.
 */
function revisarCodigoDeLasIA({ check, BAT, CMD }) {
  const dir = path.join(APP, 'inicio', 'codex');
  const pkg = leerJSON(path.join(dir, 'package.json'));
  check('app/inicio/codex/package.json pide @openai/codex 0.167.0 exacto', pkg?.dependencies?.['@openai/codex'] === '0.167.0', pkg);
  const paquetes = leerJSON(path.join(dir, 'package-lock.json'))?.packages || {};
  const raiz = paquetes['node_modules/@openai/codex'];
  const malas = ['darwin-arm64', 'darwin-x64', 'win32-x64', 'win32-arm64'].filter((pl) => {
    const x = paquetes[`node_modules/@openai/codex-${pl}`];
    return !(x?.version === `0.167.0-${pl}` && /^sha512-/.test(x.integrity || '') && /^https:\/\/registry\.npmjs\.org\//.test(x.resolved || ''));
  });
  check('El lock de Codex fija 0.167.0 con las 4 plataformas de Mac y Windows, cada una con su integrity', raiz?.version === '0.167.0' && /^sha512-/.test(raiz?.integrity || '') && !malas.length, { raiz: raiz && { version: raiz.version, integrity: Boolean(raiz.integrity) }, malas });
  const npmrc = textoDe(path.join(dir, '.npmrc'));
  check('app/inicio/codex/.npmrc trae include=optional (un npm con omit=optional instala igual)', /^\s*include\s*=\s*optional\s*$/m.test(npmrc), npmrc || 'no está');
  const rel = leerJSON(path.join(dir, 'release-0.167.0.json'));
  const sinSha = ['win32-x64', 'darwin-arm64', 'darwin-x64'].filter((k) => !(/^[0-9a-f]{64}$/.test(rel?.paquetes?.[k]?.sha256 || '') && String(rel?.paquetes?.[k]?.url || '').startsWith('https://github.com/openai/codex/releases/download/rust-v0.167.0/')));
  check('release-0.167.0.json: el respaldo de cada plataforma con su sha256', rel?.version === '0.167.0' && !sinSha.length, { version: rel?.version, sinSha });
  const lanzadores = [BAT, CMD, path.join(APP, 'inicio', 'programas-windows.ps1'), path.join(APP, 'inicio', 'programas-mac.sh')].map((f) => [path.relative(RAIZ, f), textoDe(f)]);
  const conInstalador = lanzadores.filter(([, t]) => /install\.(ps1|sh)\b/i.test(t)).map(([n]) => n);
  check('Ningún lanzador corre install.ps1 ni install.sh directo (el programa de la IA lo instala la app)', lanzadores.every(([, t]) => t.length > 0) && !conInstalador.length, conInstalador);
  check('Los dos lanzadores corren app/inicio/preparar-motor.mjs', lanzadores.slice(0, 2).every(([, t]) => /preparar-motor\.mjs/.test(t)));
  const ENLACE = 'developers.openai.com/codex/cli';
  const pantalla = [
    ...listar(path.join(APP, 'src'), (f) => /\.(m?jsx?|css|html)$/.test(f)),
    ...listar(path.join(APP, 'dist'), (f) => /\.(js|css|html)$/.test(f)),
    ...listar(path.join(APP, 'server'), (f) => /\.(m?js|md|json)$/.test(f)),
    path.join(APP, 'index.html'),
  ];
  const conEnlace = pantalla.filter((f) => textoDe(f).includes(ENLACE)).map((f) => path.relative(RAIZ, f));
  check(`Ningún texto de la pantalla enlaza a ${ENLACE} (${pantalla.length} archivos)`, pantalla.length > 50 && !conEnlace.length, conEnlace);
}

/**
 * preparar-motor.mjs (lo corren los lanzadores antes que el servidor) con un config de prueba propio: el de una app de
 * prueba que no esta abierta (temp/_modo-prueba-<n>/config.json; PUERTO=<n> lo elige, rutas.js:34). Sin AIA_MOTOR,
 * con el Claude falso (ANUNCIOS_CLAUDE_BIN) y en modo prueba: no instala ni baja nada.
 */
function probarPrepararMotor({ check, puerto }) {
  let n = puerto + 2;
  while ([4455, 4321].includes(n) || fs.existsSync(path.join(RAIZ, 'temp', `_modo-prueba-${n}`))) n++;
  const dir = path.join(RAIZ, 'temp', `_modo-prueba-${n}`);
  const config = path.join(dir, 'config.json');
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|APIMART_|SUNO_|OPENAI_|CODEX_|AIA_MOTOR$|ANUNCIOS_CODEX_BIN$|HUMO_)/i.test(k)) delete env[k];
  Object.assign(env, { PUERTO: String(n), ANUNCIOS_MODO_PRUEBA: '1', ANUNCIOS_CLAUDE_BIN: SELF, AIA_CODEX_HOME: path.join(dir, 'codex-home') });
  const preparar = () => {
    const r = correr(process.execPath, [path.join(APP, 'inicio', 'preparar-motor.mjs')], { cwd: RAIZ, env, timeout: 120000 });
    return { codigo: r.status, dice: `${r.stdout || ''}${r.stderr || ''}`.trim() };
  };
  // la IA que ve la app con ese config (la bienvenida muestra las dos tarjetas si es null)
  const iaDeLaApp = () => {
    const url = new URL('../server/lib/motor-ia.js', import.meta.url).href;
    const r = correr(process.execPath, ['--input-type=module', '-e', 'const m = await import(process.argv[1]); console.log(JSON.stringify({ elegido: m.motorElegido(), nombre: m.nombreIA() }));', url], { cwd: RAIZ, env, timeout: 60000 });
    try {
      return JSON.parse(String(r.stdout).trim().split('\n').pop());
    } catch {
      return { error: `${r.stdout}${r.stderr}`.trim().slice(-300) };
    }
  };
  fs.mkdirSync(dir, { recursive: true });
  try {
    // 1. un alumno que se actualiza: ya vio la bienvenida (antes solo existia Claude) y no tiene `motor`
    fs.writeFileSync(config, `${JSON.stringify({ bienvenidaVista: true, preferencias: { prueba: 'humo' } }, null, 2)}\n`);
    let r = preparar();
    const c = leerJSON(config);
    check('preparar-motor.mjs: un alumno que se actualiza (bienvenidaVista, sin motor) queda con motor: "claude"', r.codigo === 0 && c?.motor === 'claude' && c?.bienvenidaVista === true && c?.preferencias?.prueba === 'humo', { salida: r.codigo, config: c, dice: r.dice.slice(-400) });
    check('preparar-motor.mjs: y su Claude Code está listo, sin «Aviso:»', /Claude Code: listo\./.test(r.dice) && !/Aviso:/.test(r.dice), r.dice.slice(-400));
    // 2. un alumno nuevo: sin la bienvenida no se guarda nada (la elige en la app)
    const nuevo = `${JSON.stringify({ preferencias: { prueba: 'humo' } }, null, 2)}\n`;
    fs.writeFileSync(config, nuevo);
    r = preparar();
    check('preparar-motor.mjs: sin la bienvenida no guarda nada (el config queda igual)', r.codigo === 0 && textoDe(config) === nuevo, { salida: r.codigo, config: leerJSON(config) });
    check('preparar-motor.mjs: sin IA elegida no instala nada y dice «Tu IA (Claude o ChatGPT) la eliges en la app.», sin «Aviso:»', r.dice.includes('Tu IA (Claude o ChatGPT) la eliges en la app.') && !/Aviso:|Instalando/.test(r.dice), r.dice.slice(-400));
    const ia = iaDeLaApp();
    check('Sin IA elegida, la app no deduce ninguna: «tu IA» (la bienvenida muestra las dos)', ia.elegido === null && ia.nombre === 'tu IA', ia);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Los textos exactos de codex.js (DISENO §2.21) que llegan a la pantalla
const TEXTO_CODEX = {
  sinSesion: 'Falta iniciar sesión con tu cuenta de ChatGPT. Toca "Iniciar sesión" y después "Reintentar".',
  planSinCodex: 'Tu plan de ChatGPT no incluye Codex o ya no le queda uso. Revisa tu plan en chatgpt.com y después toca "Reintentar": lo ya hecho no se repite.',
  // (en un paso de la producción el botón es «Continuar»: el texto sigue distinto después de esto)
  planSinCodexInicio: 'Tu plan de ChatGPT no incluye Codex o ya no le queda uso.',
};

/**
 * Los casos dificiles de ChatGPT, en una segunda app de prueba SIN AIA_MOTOR: la IA se elige con PUT /api/ia/elegir,
 * como en la pantalla (asi se puede cambiar en medio de un limite). El Codex falso lee FALSO_CODEX_CONFIG en cada
 * llamada: antes de cada caso se escribe el modo de la tarea que se prueba (id de material-esperado.json). Los casos
 * van de a uno: lo que anoto el falso desde que empezo cada uno es de ese caso.
 */
async function casosCodex({ check, aviso, seccion, envBase, puerto, INFORME, t0, envDeLaPrueba }) {
  seccion(`ChatGPT: los casos difíciles, en otra app de prueba sin IA fijada (http://127.0.0.1:${puerto}, Codex falso por modos)`);
  const REG = path.join(INFORME, 'codex-casos.jsonl');
  const MODOS = path.join(INFORME, 'codex-casos-modos.json');
  const LOG = path.join(INFORME, 'app-casos.log');
  fs.writeFileSync(REG, '');
  const modos = (m = {}) => fs.writeFileSync(MODOS, `${JSON.stringify({ todo: 'ok', ...m })}\n`);
  modos();
  const env = { ...envBase, HUMO_REGISTRO: REG, FALSO_CODEX_CONFIG: MODOS, AIA_CODEX_HOME: path.join(INFORME, 'codex-home-casos') };
  for (const k of ['AIA_MOTOR', 'ANUNCIOS_A_LA_VEZ', 'OPENAI_API_KEY', 'CODEX_API_KEY']) delete env[k];
  const app = await arrancarApp({ env, puerto, log: LOG });
  if (!check('La segunda app de prueba (sin AIA_MOTOR) arranca', app.arriba, app.salio() ? `se cerró (${JSON.stringify(app.salio())}): mira app-casos.log` : 'no respondió en 90 s')) return app.cerrar();
  const { pedir } = app;
  const log = (t) => console.log(`   [casos] ${Math.round((Date.now() - t0) / 1000)} s  ${t}`);
  const notas = () => leerNotas(REG);
  const mensajes = (ns) => ns.filter((x) => x.tipo === 'codex-exec' || x.tipo === 'codex-resume');
  const correcciones = (ns) => mensajes(ns).filter((x) => x.clase === 'correccion').length;
  const clases = (ns) => mensajes(ns).map((x) => `${x.tipo === 'codex-exec' ? 'exec' : 'resume'}:${x.clase}`);
  const sinProblemas = (que, ns) => {
    const p = [...mensajes(ns).filter((x) => !x.ok).map((x) => ({ tipo: x.tipo, clase: x.clase, problemas: x.problemas })), ...ns.filter((x) => x.tipo === 'error').map((x) => ({ error: String(x.error).slice(0, 400) }))];
    return check(`${que}: el Codex falso no vio nada mal (${mensajes(ns).length} mensajes)`, mensajes(ns).length > 0 && !p.length, p);
  };
  const elegir = async (motor, headers) => {
    // (una sesion que termina tarda un instante en salir de la fila: 409 mientras tanto)
    let r;
    for (let i = 0; i < 20; i++) {
      r = await pedir('/api/ia/elegir', { metodo: 'PUT', json: { motor }, headers });
      if (r.st !== 409 || headers) break;
      await dormir(1500);
    }
    return r;
  };
  // la pausa de cada IA: filas.pausas (las dos); si no esta, solo la de la elegida (filas.claude.pausaHasta)
  const pausas = async () => {
    const f = (await pedir('/api/produccion/fila')).datos?.filas || {};
    const elegido = (await pedir('/api/ia/estado')).datos?.elegido ?? null;
    if (f.pausas) return { elegido, claude: f.pausas.claude?.hasta || null, codex: f.pausas.codex?.hasta || null };
    return { elegido, [elegido || 'claude']: f.claude?.pausaHasta || null };
  };
  const DESCRIPCION = 'Un frasco de gomitas para tener energía por la tarde. Se toman dos al día. Envío gratis y pago al recibir.';
  const nuevoProducto = async (nombre) => {
    const r = await pedir('/api/productos', { json: { nombre, tipo: 'fisico', descripcion: DESCRIPCION } });
    const id = r.datos?.id;
    if (r.st !== 201 || !id) return null;
    await pedir(`/api/productos/${id}/fotos/1`, { metodo: 'PUT', cuerpo: pngFrasco(), headers: { 'Content-Type': 'image/png' } });
    return id;
  };
  const ficha = async (id, modo) => {
    modos({ ficha: modo });
    const desde = notas().length;
    const r = await pedir(`/api/productos/${id}/analizar`, { json: {} });
    const d = await esperarHasta('la ficha', 5, async () => (await pedir(`/api/productos/${id}`)).datos, (x) => ['lista', 'error'].includes(x?.tarea?.estado), app.salio);
    modos();
    const ns = notas().slice(desde);
    log(`ficha (${modo}): ${d?.tarea?.estado}${d?.tarea?.error?.tipo ? ` (${d.tarea.error.tipo})` : ''} · ${clases(ns).join(' ')}`);
    return { st: r.st, d, tarea: d?.tarea, notas: ns };
  };
  const guion = async (productoId, modo) => {
    modos({ guion: modo });
    const desde = notas().length;
    const r = await pedir('/api/anuncios', { json: { productoId, estilo: 'claymation', voz: { id: 'sim-narrador', nombre: 'Narrador de prueba' }, continuidad: false, respuestas: {} } });
    const slug = r.datos?.slug;
    const g = slug ? await esperarHasta('el guion', 6, async () => (await pedir(`/api/anuncios/${slug}/guion`)).datos, (x) => ['listo', 'error', 'bloqueado'].includes(x?.estado), app.salio) : r.datos;
    modos();
    const ns = notas().slice(desde);
    log(`guion (${modo}): ${g?.estado}${g?.error?.tipo ? ` (${g.error.tipo})` : ''} · ${clases(ns).join(' ')}`);
    return { slug, g, notas: ns, resumen: { estado: g?.estado, error: g?.error, limite: g?.limite, tiempo: g?._seAcaboElTiempo, mensajes: clases(ns) } };
  };
  // lo que ninguna IA puede escribir: .env y app/config.json (byte por byte; los de esta prueba), ../.env (sin abrirlo)
  const ENV = path.join(RAIZ, '.env');
  const CONFIG_APP = path.join(APP, 'config.json');
  const OTRO = path.join(RAIZ, 'temp', 'otro', 'x.json');
  const protegido = () => ({ env: sha256De(ENV), config: fs.existsSync(CONFIG_APP) ? sha256De(CONFIG_APP) : 'no está', envDeArriba: statDe(path.join(RAIZ, '..', '.env')), otro: statDe(OTRO) });
  const DEL_MOTOR = ['img/log-modelos.json', 'video/x.json', 'app/conductor.json', 'x.js'];
  const escritosEn = (carpeta, lista) => lista.filter((f) => fs.existsSync(path.join(carpeta, f)));

  try {
    // ------------------------------------------------------------ elegir la IA, como en la pantalla
    let r = await pedir('/api/ia/estado');
    if (!fs.existsSync(CONFIG_APP)) check('Sin AIA_MOTOR ni config: /api/ia/estado no tiene IA elegida («tu IA»)', r.st === 200 && r.datos?.elegido === null && r.datos?.nombre === 'tu IA', r.datos && { elegido: r.datos.elegido, nombre: r.datos.nombre });
    if (r.datos?.elegido === null) {
      // un alumno nuevo que toca «Ahora no» sin elegir: la bienvenida no queda vista (si no, al volver a abrir la app
      // migrarMotor lo tomaria por un alumno de antes y le pondria Claude)
      const b = await pedir('/api/ajustes/bienvenida', { metodo: 'PUT', json: { vista: true } });
      const aj = await pedir('/api/ajustes');
      const ia = await pedir('/api/ia/estado');
      check('Sin IA elegida, cerrar la bienvenida no la deja vista (sigue con las dos opciones y sin IA)', b.st === 200 && b.datos?.bienvenidaVista === false && aj.datos?.bienvenidaVista === false && ia.datos?.elegido === null, { put: b, ajustes: aj.datos && { bienvenidaVista: aj.datos.bienvenidaVista }, elegido: ia.datos?.elegido });
    }
    r = await elegir('codex', { Origin: 'http://otro-sitio.example' });
    check('PUT /api/ia/elegir desde otra página se rechaza (403)', r.st === 403, r);
    r = await elegir('otra');
    check('PUT /api/ia/elegir con una IA que no existe da 400', r.st === 400 && typeof r.datos?.error === 'string', r);
    r = await elegir('codex');
    check('PUT /api/ia/elegir { motor: "codex" } elige ChatGPT', r.st === 200 && r.datos?.elegido === 'codex', r);
    r = await pedir('/api/ia/estado');
    if (!check('/api/ia/estado: ChatGPT elegido, instalado y con sesión', r.datos?.elegido === 'codex' && r.datos?.motores?.codex?.instalado === true && r.datos?.motores?.codex?.sesion === 'ok', r.datos && { elegido: r.datos.elegido, motores: r.datos.motores })) return;

    // ------------------------------------------------------------ la ficha: `fuera` (no pisa producto.json)
    const P = await nuevoProducto('Producto Casos Humo');
    if (!check('Casos: se crea el producto con su foto', P)) return;
    const carpetaP = path.join(RAIZ, 'temp', '_productos', P);
    const conFuera = Boolean(envDeLaPrueba);
    if (!conFuera) aviso('Sin los casos «fuera»: el .env de esta carpeta no lo escribió la prueba (corren solo en una carpeta descartable).');
    {
      const antes = conFuera ? protegido() : null;
      const shaProducto = sha256De(path.join(carpetaP, 'producto.json'));
      const f = await ficha(P, conFuera ? 'fuera' : 'ok');
      if (!check(`${conFuera ? 'fuera (ficha)' : 'Casos'}: la ficha queda lista`, f.tarea?.estado === 'lista', f.tarea)) return;
      if (conFuera) {
        const pidio = f.notas.filter((x) => x.tipo === 'codex-respuesta').flatMap((x) => x.archivos || []);
        // (en la carpeta de un producto la regla fija es solo producto.json, DISENO §2.10 punto 4; un .js nunca se guarda)
        const escritos = escritosEn(carpetaP, ['x.js']);
        check(
          'fuera (ficha): el Codex falso mandó producto.json, ../.env, app/config.json, x.js… y la app no pisó producto.json ni guardó los demás',
          pidio.some((x) => /\/producto\.json$/.test(x)) && pidio.some((x) => /^\.\.\/\.env$/.test(x)) && sha256De(path.join(carpetaP, 'producto.json')) === shaProducto && !escritos.length,
          { pidio, escritos, productoIgual: sha256De(path.join(carpetaP, 'producto.json')) === shaProducto }
        );
        const despues = protegido();
        check('fuera (ficha): .env y app/config.json iguales byte por byte, ../.env y temp/otro/ sin tocar', JSON.stringify(antes) === JSON.stringify(despues), { antes, despues });
        sinProblemas('fuera (ficha)', f.notas);
      }
    }

    // ------------------------------------------------------------ el guion
    // mal: la correccion va por exec resume; el validar-manifiesto, por `comandos`
    let g = await guion(P, 'mal');
    check('mal (guion): el guion queda listo', g.g?.estado === 'listo', g.resumen);
    check('mal (guion): la corrección se hizo por exec resume', mensajes(g.notas).some((x) => x.tipo === 'codex-resume' && x.clase === 'correccion'), g.resumen.mensajes);
    const conComando = mensajes(g.notas).find((x) => x.comando);
    check(
      'El validar-manifiesto se corrió por `comandos` y la app le devolvió lo que imprimió',
      /^node produccion\/validar-manifiesto\.js temp\/\S+\/manifiesto\.json$/.test(conComando?.comando?.pedido || '') && conComando?.comando?.devuelto === true,
      conComando?.comando || g.resumen.mensajes
    );
    sinProblemas('mal (guion)', g.notas);

    if (conFuera) {
      const antes = protegido();
      g = await guion(P, 'fuera');
      check('fuera (guion): el guion queda listo', g.g?.estado === 'listo', g.resumen);
      if (g.slug) {
        const carpeta = path.join(RAIZ, 'temp', g.slug);
        const modelos = textoDe(path.join(carpeta, 'modelos.json'));
        const escritos = escritosEn(carpeta, DEL_MOTOR);
        check('fuera (guion): modelos.json sigue siendo el de la app; img/log-modelos.json, video/, app/conductor.json, x.js y temp/otro/ no se escribieron', modelos.includes('"guardado"') && !modelos.includes('"falso"') && !escritos.length && !fs.existsSync(OTRO), { modelosDeLaApp: modelos.includes('"guardado"'), conFalso: modelos.includes('"falso"'), escritos });
        check('fuera (guion): .env y app/config.json iguales byte por byte, ../.env sin tocar', JSON.stringify(antes) === JSON.stringify(protegido()), { antes, despues: protegido() });
        const nf = g.notas.find((x) => x.fuera);
        check('fuera (guion): el Codex falso lo revisó en el mensaje siguiente: nada guardado', nf?.fuera?.pedidos?.length >= 8 && !nf.fuera.guardados.length, nf?.fuera || g.resumen.mensajes);
        sinProblemas('fuera (guion)', g.notas);
      }
    }

    // de a un archivo, cortada, sin lugar en la conversacion y una edicion mala: terminan sin correcciones de mas
    g = await guion(P, 'por-partes');
    const partes = g.notas.filter((x) => x.tipo === 'codex-respuesta' && (x.archivos || []).length + (x.ediciones || []).length === 1).length;
    check(`por-partes (guion): listo, de a un archivo (${partes}) y sin correcciones`, g.g?.estado === 'listo' && partes >= 3 && correcciones(g.notas) === 0, { ...g.resumen, partes });
    sinProblemas('por-partes (guion)', g.notas);
    g = await guion(P, 'cortada');
    check('cortada (guion): listo sin correcciones (la app le pidió que mande de a un archivo)', g.g?.estado === 'listo' && mensajes(g.notas).some((x) => x.clase === 'cortada') && correcciones(g.notas) === 0, g.resumen);
    sinProblemas('cortada (guion)', g.notas);
    g = await guion(P, 'contexto');
    check('contexto (guion): listo sin correcciones (arrancó de nuevo una vez)', g.g?.estado === 'listo' && mensajes(g.notas).some((x) => x.clase === 'deNuevo') && correcciones(g.notas) === 0, g.resumen);
    sinProblemas('contexto (guion)', g.notas);
    g = await guion(P, 'mal+ediciones-mal');
    const em = g.notas.find((x) => x.edicionesMal)?.edicionesMal;
    check('ediciones-mal (guion, con mal): listo con 1 sola corrección; la edición mala no se aplicó y se le avisó', g.g?.estado === 'listo' && correcciones(g.notas) === 1 && em?.intacto === true && em?.avisado === true, { ...g.resumen, edicionesMal: em });
    sinProblemas('ediciones-mal (guion)', g.notas);

    // ------------------------------------------------------------ sin sesion y plan sin Codex: la tarjeta
    let f = await ficha(await nuevoProducto('Producto Sin Sesion Humo'), 'sin-sesion');
    check('sin-sesion (ficha): queda la tarjeta de sin sesión, con su texto', f.tarea?.estado === 'error' && f.tarea?.error?.tipo === 'sin-sesion' && f.tarea?.error?.mensaje === TEXTO_CODEX.sinSesion, f.tarea);
    f = await ficha(await nuevoProducto('Producto Plan Humo'), 'plan-sin-codex');
    check('plan-sin-codex (ficha): queda la tarjeta de plan sin Codex, con su texto', f.tarea?.estado === 'error' && f.tarea?.error?.tipo === 'plan-sin-codex' && f.tarea?.error?.mensaje === TEXTO_CODEX.planSinCodex, f.tarea);

    // ------------------------------------------------------------ el limite a mitad de una tarea
    g = await guion(P, 'limite-a-mitad');
    const ms = mensajes(g.notas);
    check('limite-a-mitad (guion): para con el límite sin mandar el segundo mensaje', g.g?.estado === 'error' && g.g?.limite === true && ms.length === 1 && ms[0].tipo === 'codex-exec', g.resumen);
    let p = await pausas();
    check('El límite pausa la fila de ChatGPT y no la de Claude', p.elegido === 'codex' && Boolean(p.codex) && !p.claude, p);
    r = await elegir('claude');
    p = await pausas();
    check('Se elige Claude (200): su fila no está en pausa por el límite de ChatGPT', r.st === 200 && p.elegido === 'claude' && !p.claude, { elegir: r, pausas: p });
    r = await elegir('codex');
    p = await pausas();
    check('De vuelta a ChatGPT (200), sin pausa: cambiar de IA limpia la de la anterior', r.st === 200 && p.elegido === 'codex' && !p.codex, { elegir: r, pausas: p });

    // ------------------------------------------------------------ un lote de imagen: plan sin Codex y el limite
    modos({ 'imagen-ads-estrategia': 'plan-sin-codex' });
    r = await pedir('/api/imagen-ads', { json: { productoId: P, fotoProducto: 1, datos: { nombre: 'Crema Casos', publico: 'Mujeres de 25 a 45', precio: '79.90', moneda: 'S/', cta: 'Envío gratis', pais: 'Perú', idioma: 'es', adicional: '', angulo: null }, cantidad: 1, formatos: ['1:1'], logo: null } });
    const lote = r.datos?.lote;
    if (!check('Casos: se crea un lote de imagen (1 variación 1:1)', r.st === 201 && lote, r)) return;
    const leerLote = async () => (await pedir(`/api/imagen-ads/${lote}`)).datos;
    const estrategia = (v) => (v?.conductor?.pasos || []).find((x) => x.id === 'estrategia');
    const resumenLote = (v) => ({ estado: v?.conductor?.estado, motivo: v?.conductor?.motivo, estrategia: estrategia(v), motor: v?.motor, tiempo: v?._seAcaboElTiempo });
    r = await pedir(`/api/imagen-ads/${lote}/generar`, { json: { costoMaximoConfirmado: 100 } });
    let v = await esperarHasta('el lote', 5, leerLote, (d) => ['listo', 'error', 'pausado'].includes(d?.conductor?.estado) || (d?.conductor?.estado === 'esperando' && d.conductor.motivo === 'limite-claude'), app.salio);
    log(`lote (plan-sin-codex): ${v?.conductor?.estado}`);
    check('plan-sin-codex (lote): la estrategia queda en error con el texto de plan sin Codex', v?.conductor?.estado === 'error' && estrategia(v)?.error?.motivo === 'plan-sin-codex' && String(estrategia(v)?.error?.mensaje || '').startsWith(TEXTO_CODEX.planSinCodexInicio), resumenLote(v));
    const antesDeEsperar = mensajes(notas()).length;
    await dormir(8000);
    v = await leerLote();
    check('plan-sin-codex (lote): el conductor no reintenta solo (8 s después sigue en error y sin mensajes nuevos a ChatGPT)', v?.conductor?.estado === 'error' && mensajes(notas()).length === antesDeEsperar, { ...resumenLote(v), mensajesNuevos: mensajes(notas()).length - antesDeEsperar });

    modos({ 'imagen-ads-estrategia': 'limite' });
    r = await pedir(`/api/imagen-ads/${lote}/continuar`, { json: {} });
    await dormir(1000);
    v = await esperarHasta('el límite del lote', 5, leerLote, (d) => (d?.conductor?.estado === 'esperando' && d.conductor.motivo === 'limite-claude') || ['listo', 'pausado'].includes(d?.conductor?.estado) || (d?.conductor?.estado === 'error' && estrategia(d)?.error?.motivo !== 'plan-sin-codex'), app.salio);
    log(`lote (limite): ${v?.conductor?.estado} ${v?.conductor?.motivo || ''}`);
    check('limite (lote): espera a que se renueve el plan, con la pausa anotada en la IA que trabajó (ChatGPT)', r.st === 200 && v?.conductor?.estado === 'esperando' && v?.conductor?.motivo === 'limite-claude' && estrategia(v)?.error?.motor === 'codex', resumenLote(v));
    p = await pausas();
    check('limite (lote): la fila de ChatGPT queda en pausa y la de Claude no', Boolean(p.codex) && !p.claude, p);
    // en medio del limite se elige Claude: el lote sigue enseguida, con Claude
    const desdeElegir = notas().length;
    r = await elegir('claude');
    check('PUT /api/ia/elegir { motor: "claude" } en medio del límite (200)', r.st === 200 && r.datos?.cambio === true, r);
    v = await esperarHasta('el lote con Claude', 8, leerLote, (d) => ['listo', 'error', 'pausado'].includes(d?.conductor?.estado), app.salio);
    log(`lote (con Claude): ${v?.conductor?.estado}`);
    const despues = notas().slice(desdeElegir);
    const deClaude = despues.filter((x) => x.tipo === 'tarea' && x.via === 'claude').map((x) => x.tarea);
    check('El lote siguió con Claude y terminó: la estrategia la hizo Claude y a ChatGPT no le llegó nada más', v?.conductor?.estado === 'listo' && v?.motor === 'claude' && deClaude.length > 0 && !mensajes(despues).length, { ...resumenLote(v), deClaude, aChatGPT: clases(despues) });
    p = await pausas();
    check('Con Claude elegida, su fila no quedó en pausa', p.elegido === 'claude' && !p.claude, p);
  } finally {
    await app.cerrar();
  }
  check('La pausa quedó anotada en la IA que trabajó («ChatGPT llegó al límite de uso» en el registro de la segunda app)', /ChatGPT llegó al límite de uso/.test(textoDe(LOG)), textoDe(LOG).split('\n').filter((l) => /límite|limite/.test(l)).slice(-5));
}

// ---------------------------------------------------------------- arranque según el papel
if (COMO_CLAUDE) await claudeFalso();
else await prueba();

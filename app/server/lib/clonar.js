// Clonar un video (la skill anuncios-clonacion, dentro de la app). En el formulario de cualquier estilo (menos los
// cantados) se puede subir el video de un anuncio que funciona, o pegar su link. La app, antes de escribir el guion:
//   1. deja el video en temp/<slug>/referencia/original.<ext> (lo copia, o lo baja del link con yt-dlp, gratis);
//   2. lo analiza (analizar-referencia.mjs de la skill): tomas, un fotograma de cada una, la hoja y lo que se dice
//      con sus tiempos (la transcripción es de ElevenLabs, centavos). No cobra nada en kie.ai.
// Después Claude escribe el ADN y el guion clonado (Pasos 3 y 5 de la skill) y, con eso como guion ganador, el
// manifiesto del estilo elegido. La producción es la del estilo, sin cambios.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { RAIZ, TEMP } from './rutas.js';
import { rutaDeReferencia } from '../rutas/referencias.js';

const SCRIPT_ANALISIS = path.join(RAIZ, '.claude', 'skills', 'anuncios-clonacion', 'scripts', 'analizar-referencia.mjs');
const SCRIPT_BAJAR = path.join(RAIZ, 'produccion', 'bajar-referencias.js');
const esLink = (s) => /^https?:\/\/\S+$/i.test(String(s || '').trim());

/** Lo que pidió el usuario en el formulario: { link } | { subido, nombre } | null. */
export function referenciaPedida(brief) {
  const v = String(brief?.respuestas?.clonar || '').trim();
  if (!v) return null;
  if (esLink(v)) return { link: v };
  const m = v.match(/^subido:([a-z0-9]{6,30})(?:\|(.*))?$/);
  return m ? { subido: m[1], nombre: m[2] || 'video' } : null;
}

const adaptarGancho = (brief) => !/^\s*no\b/i.test(String(brief?.respuestas?.clonar_gancho || ''));

/**
 * El entorno de los scripts: el de siempre o, en modo prueba, el de los simuladores (la transcripcion va al ElevenLabs
 * simulado y nada sale a internet, como el motor).
 */
async function entorno() {
  try {
    const m = await import('./modo-prueba.js');
    if (m.modoPrueba()) return await m.entornoMotor();
  } catch (e) {
    console.warn(`[clonar] sin el entorno de modo prueba: ${e?.message || e}`);
    return null;
  }
  return process.env;
}

async function correr(args, { cwd = RAIZ, timeoutMs = 20 * 60000 } = {}) {
  const env = await entorno();
  if (!env) return { codigo: -1, texto: 'modo prueba sin simuladores' };
  return new Promise((ok) => {
    const p = spawn(process.execPath, args, { cwd, windowsHide: true, env });
    let texto = '';
    const t = setTimeout(() => p.kill(), timeoutMs);
    p.stdout.on('data', (d) => (texto += d));
    p.stderr.on('data', (d) => (texto += d));
    p.on('close', (codigo) => {
      clearTimeout(t);
      ok({ codigo, texto: texto.slice(-4000) });
    });
    p.on('error', (e) => {
      clearTimeout(t);
      ok({ codigo: -1, texto: String(e.message || e) });
    });
  });
}

/**
 * Deja el video y su análisis en temp/<slug>/referencia/. Si ya estaba, no repite nada. Devuelve
 * { ok, aviso? } — un fallo no frena el guion: Claude lo escribe sin clonar y lo cuenta en "decisiones".
 */
export async function prepararReferencia(slug, brief, avanzar = () => {}) {
  const pedida = referenciaPedida(brief);
  if (!pedida) return { ok: true, sin: true };
  const dir = path.join(TEMP, slug, 'referencia');
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(path.join(dir, 'adn-base.json'))) return { ok: true };

  let original = fs.readdirSync(dir).find((f) => /^original\.(mp4|mov|webm|m4v)$/i.test(f));
  if (!original && pedida.subido) {
    const desde = rutaDeReferencia(pedida.subido);
    if (!desde) return { ok: false, aviso: 'No encontré el video que subiste para clonar: vuelve a subirlo.' };
    original = `original${path.extname(desde).toLowerCase()}`;
    fs.copyFileSync(desde, path.join(dir, original));
  }
  if (!original && pedida.link) {
    avanzar('Bajando el video de referencia');
    const r = await correr([SCRIPT_BAJAR, path.join('temp', slug, 'referencia', 'videos'), pedida.link]);
    const bajado = path.join(dir, 'videos', 'ref-01.mp4');
    if (r.codigo !== 0 || !fs.existsSync(bajado)) {
      return { ok: false, aviso: 'No pude bajar el video de ese link. Descárgalo y súbelo como archivo.' };
    }
    original = 'original.mp4';
    fs.copyFileSync(bajado, path.join(dir, original));
  }
  if (!original) return { ok: false, aviso: 'No encontré el video para clonar.' };

  avanzar('Analizando el video de referencia');
  const r = await correr([SCRIPT_ANALISIS, path.join('temp', slug, 'referencia', original), path.join('temp', slug, 'referencia')]);
  if (r.codigo !== 0 || !fs.existsSync(path.join(dir, 'adn-base.json'))) {
    return { ok: false, aviso: 'No pude analizar el video de referencia.' };
  }
  return { ok: true };
}

/** Lo que va en la tarea del guion cuando el anuncio se clona de un video. */
export function textoClonar(slug, brief, prep, { guionPropio = false, agregar = false, desdeAgregar = null } = {}) {
  const pedida = referenciaPedida(brief);
  if (!pedida) return '';
  const c = `temp/${slug}/referencia`;
  // «Agregar» que el pedido paso a otro estilo: el video ya esta entendido y el plan escrito; este estilo lo produce
  if (desdeAgregar && prep?.ok) {
    const p = desdeAgregar.plan || {};
    const lista = (xs) => (Array.isArray(xs) && xs.length ? xs.map((x) => `  - ${x}`).join('\n') : '  - (nada en especial)');
    return [
      '## El video y el pedido del usuario (Agregar) — lo primero',
      '',
      `El usuario subió un video y pidió: «${String(desdeAgregar.pedido || 'el mismo video para su producto').replace(/»/g, '"')}». Otra sesión ya miró el video y escribió el plan: **este anuncio es de este estilo**, hecho con el ADN de ese video.`,
      `- **Ya está escrito** en \`${c}/\`: \`adn.md\` (el ADN: estructura toma por toma, personas, ritmo, gancho y ángulo), \`guion-clonado.md\` (el guion del video para este producto${p.duracion ? `, ya condensado a ${p.duracion}` : ''}), \`adn-base.json\`, \`hoja-tomas.jpg\` y \`tomas/\`. Léelos con Read antes de escribir; **no los reescribas** ni sigas la skill de clonación.`,
      `- **El guion clonado es el guion ganador** (Paso 0 de la skill de este estilo; en los cantados, el material de la letra): conserva su estructura, su gancho, su ángulo, sus objeciones y sus frases clave. Si hay que acortarlo, se condensa parte por parte (cada momento más corto), **nunca se corta el final** (la oferta y el llamado a la acción van siempre).`,
      `- **El plan**: ${p.resumen || ''}`,
      `  Se conserva:\n${lista(p.conserva)}`,
      `  Cambia:\n${lista(p.cambia)}`,
      p.duracion ? `- **La duración** es la del plan: ${p.duracion} (aproximada).` : '- **La duración** es la del video original.',
      '- **El look es el de este estilo** (su skill manda en todo lo técnico); del video se toman los planos, las acciones y el ritmo. De la referencia nunca se copian marcas, logos, precios, caras ni la música.',
      '- **El modelo de cada escena**: en el manifiesto, cada toma y cada B-roll lleva `"modelo_video"` y `"modelo_porque"`, con la tabla de `.claude/skills/anuncios-agregar/SKILL.md` (Paso 6, «El modelo de cada escena»). En los cantados, cuando se escriban las tomas.',
      '- En "decisiones", la primera línea: "Tu pedido: <estilo> · <duración> · se conserva <lo principal>".',
    ].join('\n');
  }
  // «Agregar» (skill anuncios-agregar): el video del usuario es el anuncio; la skill dice todo lo demas
  if (agregar && prep?.ok) {
    return [
      '## Tu video (lo primero)',
      '',
      `El anuncio sale de este video. **Lo que dejó la app** en \`${c}/\`: \`adn-base.json\` (las tomas con sus tiempos y lo que se dice), \`hoja-tomas.jpg\` y \`tomas/\` (un fotograma por toma). La app ya hizo el análisis (Pasos 1 y 2 de la skill de clonación): sigue la skill \`anuncios-agregar\` desde su Paso 2.`,
      `- Mira la hoja y **cada fotograma** con Read: las personas (edad, cuerpo, ropa), el lugar, la cámara y el antes y después se ven ahí. Corrige los cortes que estén mal.`,
      `- Escribe \`${c}/adn.md\` (el ADN visual completo, Paso 3 de la skill) y \`${c}/guion-clonado.md\` antes del manifiesto.`,
      `- ${/^\s*no/i.test(String(brief?.respuestas?.clonar_gancho || '')) ? 'El gancho y el ángulo **se conservan** del original (cambia solo lo que es del producto).' : 'El gancho y el ángulo **se adaptan** a este producto, con la misma mecánica del original.'}`,
      '- En "decisiones", la primera línea: "Rehecho de: <nombre o link del video> · <N> tomas · <duración> s · formato <UGC o voz en off>".',
    ].join('\n');
  }
  if (agregar) {
    return `## Tu video\n\nNo se pudo preparar el video del usuario (${String(prep?.aviso || 'sin motivo').replace(/\.$/, '')}). Sin el video, «Agregar» no tiene guion: escribe \`temp/${slug}/app/bloqueo.json\` con ese motivo y responde BLOQUEADO.`;
  }
  if (!prep?.ok) {
    return `## Clonar un video\n\nEl usuario pidió clonar un video, pero ${String(prep?.aviso || 'no se pudo preparar').replace(/\.$/, '').toLowerCase()}. Escribe el anuncio como siempre y anótalo en "decisiones".`;
  }
  // Con el guion del usuario, el video es solo la guía visual: no se analiza para escribir otro guion.
  if (guionPropio) {
    return [
      '## Video de referencia: solo para lo visual',
      '',
      'El usuario trajo **su propio guion** (`guion_del_usuario`) y además subió un video de referencia. El texto del anuncio es su guion, palabra por palabra (Paso 0 de la skill del estilo). El video sirve **solo** para cómo se ve: los planos, las acciones y el ritmo de sus tomas.',
      '',
      `- **No sigas la skill de clonación**: no escribas \`${c}/adn.md\` ni \`${c}/guion-clonado.md\`, no leas ni compares lo que se dice en el video (\`transcripcion.json\`) y no adaptes ni reescribas el gancho: el gancho es la primera línea de su guion.`,
      `- Mira \`${c}/hoja-tomas.jpg\` y los fotogramas de \`${c}/tomas/\` con Read, y usa sus planos y acciones como guía visual para las tomas de su guion, con el look del estilo. Las tomas salen de su guion (una o más por línea), no del video.`,
      '- De la referencia nunca se copian marcas, logos, precios, caras ni la música.',
      '- En "decisiones", la primera línea: "Tu guion tal cual · lo visual, guiado por <nombre o link del video>".',
    ].join('\n');
  }
  return [
    '## Clonar un video (lo primero)',
    '',
    `Este anuncio se clona de un video de referencia. Lee \`.claude/skills/anuncios-clonacion/SKILL.md\` y sigue sus Pasos 3 y 5 (el 1 y el 2 ya los hizo la app; el 4 ya está contestado) y después la skill del estilo, con el guion clonado como guion ganador (su Paso 0).`,
    '',
    `- **Lo que dejó la app** en \`${c}/\`: \`adn-base.json\` (las tomas con sus tiempos y lo que se dice), \`hoja-tomas.jpg\` y \`tomas/\` (un fotograma por toma). Mira la hoja y cada fotograma con Read y corrige los cortes que estén mal.`,
    `- **Paso 4, contestado:** el modo es "Clonar para mi producto"; ${adaptarGancho(brief) ? 'el gancho y el ángulo **se adaptan** a este producto' : 'el gancho y el ángulo **se conservan** del original (cambia solo lo que es del producto)'}; el estilo es el de esta tarea.`,
    `- Escribe \`${c}/adn.md\` (Paso 3) y \`${c}/guion-clonado.md\` (Paso 5).`,
    '- Con el guion clonado: mismo número de tomas y la misma duración por toma (±15 %), cada toma con su plano y su acción del original pero con el look del estilo. Si el estilo arma bloques (UGC), agrúpalas respetando los cortes.',
    '- De la referencia nunca se copian marcas, logos, precios, caras ni la música, ni promesas que este producto no cumple.',
    '- En "decisiones", la primera línea: "Clonado de: <nombre o link del video> · <N> tomas · <duración> s".',
  ].join('\n');
}

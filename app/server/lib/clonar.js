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

function correr(args, { cwd = RAIZ, timeoutMs = 20 * 60000 } = {}) {
  return new Promise((ok) => {
    const p = spawn(process.execPath, args, { cwd, windowsHide: true, env: process.env });
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
export function textoClonar(slug, brief, prep) {
  const pedida = referenciaPedida(brief);
  if (!pedida) return '';
  const c = `temp/${slug}/referencia`;
  if (!prep?.ok) {
    return `## Clonar un video\n\nEl usuario pidió clonar un video, pero ${String(prep?.aviso || 'no se pudo preparar').replace(/\.$/, '').toLowerCase()}. Escribe el anuncio como siempre y anótalo en "decisiones".`;
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

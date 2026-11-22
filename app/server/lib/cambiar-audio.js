// «CAMBIAR SOLO EL AUDIO» (2026-11-21i). Pedido: «que me deje editar cosas específicas y no todo el video: por ejemplo
// solo el audio. Si está con voz narrada simple y el video de referencia es cantado, que sea cantado y que solo cambie
// eso». Un anuncio con narrador (voz en off) YA TERMINADO pasa a CANTADO con sus mismos clips e imágenes:
//
//   1. una copia del anuncio (temp/<slug nuevo>/): los medios con enlace duro (no ocupan otra vez ni se pagan otra
//      vez), los JSON copiados (se cambian sin tocar el original). Sin la voz, la música ni el montaje de antes.
//   2. la familia `cambiar-audio` (familias/cambiar-audio.js) la produce: la letra son las MISMAS frases del guion,
//      Suno la canta (2 versiones, eliges de oído), se recorta la intro y el final largos, se miden las frases sobre
//      la canción y el montaje se vuelve a armar solo (manda el audio: cada escena dura lo que su frase cantada).
//
// El original no se toca. Cuesta solo la canción (Suno) y medir sus palabras (Scribe).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { TEMP, PUERTO_DE_PRUEBA } from './rutas.js';
import { leerJSON, existe } from './archivos.js';
import { ErrorApp, escribirJSON, leerFicha, leerProducto } from './productos.js';
import { esAnuncioNuevo, slugNuevo } from './anuncios-nuevos.js';
import { CREDITOS_SUNO } from '../../../produccion/config.js';
import { DOLARES_POR_CREDITO } from './rutas.js';

export const FAMILIA = 'cambiar-audio';

// lo que NO pasa a la copia: lo que sale del audio viejo (se vuelve a armar) y lo que es de la app del original
const SIN_COPIAR = new Set(['audio', 'musica', 'qa', 'cancion', 'historial', 'versiones', 'plan-montaje.json', 'plan-montaje.txt', 'subtitulos.json']);
const DE_LA_APP = new Set(['guion.json']); // de app/ solo esto (el brief y la sesión se escriben nuevos)
const TEXTO = /\.(json|txt|md|srt)$/i;

/** ¿Se puede pasar este anuncio a cantado? null si sí, o el porqué en palabras simples. */
export function motivoParaNoCantar(slug) {
  if (!esAnuncioNuevo(slug)) return 'No encuentro ese anuncio.';
  const c = leerJSON(path.join(TEMP, slug, 'app', 'conductor.json'));
  const m = leerJSON(path.join(TEMP, slug, 'manifiesto.json'));
  if (!m) return 'Este anuncio todavía no tiene escenas.';
  if (m.modo_audio === 'musica') return 'Este anuncio ya es cantado.';
  if (m.modo_audio !== 'voz_en_off' || (c?.familia && c.familia !== 'voz-en-off')) return 'Solo los anuncios con narrador (voz en off) se pueden pasar a cantado: en los demás hablan personas en cámara.';
  if (!c || c.estado !== 'listo') return 'Espera a que el video termine: la canción se arma sobre sus escenas ya hechas.';
  if (existe(path.join(TEMP, slug, 'app', 'en-la-nube.json')) && !existe(path.join(TEMP, slug, 'video'))) return 'Este anuncio está guardado en la nube: tráelo de vuelta primero (en su entrega).';
  return null;
}

/** Lo que cuesta (la canción de Suno, 2 versiones): para mostrarlo antes del sí. */
export function costoDeCantar() {
  const creditos = CREDITOS_SUNO;
  return { creditos, dolares: Number((creditos * DOLARES_POR_CREDITO).toFixed(2)) };
}

/** Copia la carpeta del anuncio: los medios con enlace duro (o copia), los textos copiados. */
function copiarCarpeta(de, a, { raiz = true } = {}) {
  fs.mkdirSync(a, { recursive: true });
  for (const e of fs.readdirSync(de, { withFileTypes: true })) {
    if (raiz && SIN_COPIAR.has(e.name)) continue;
    const o = path.join(de, e.name);
    const d = path.join(a, e.name);
    if (raiz && e.name === 'app') {
      fs.mkdirSync(d, { recursive: true });
      for (const n of DE_LA_APP) if (existe(path.join(o, n))) fs.copyFileSync(path.join(o, n), path.join(d, n));
      continue;
    }
    if (e.isDirectory()) {
      copiarCarpeta(o, d, { raiz: false });
      continue;
    }
    if (!e.isFile()) continue;
    // un JSON se cambia en su lugar (writeFileSync): enlazado, cambiaría también el del original
    if (TEXTO.test(e.name)) fs.copyFileSync(o, d);
    else {
      try {
        fs.linkSync(o, d);
      } catch {
        fs.copyFileSync(o, d);
      }
    }
  }
}

/**
 * POST /api/anuncios/:slug/cantar { como?, voz? } -> { slug, conductor }: la copia cantada, ya produciéndose (primero
 * la canción; después espera que elijas la versión). `como`: cómo quieres que suene, con tus palabras ("reguetón
 * alegre", "como el video de referencia"); `voz`: 'f' | 'm' | null (que decida Suno).
 */
export async function cantarAnuncio(origen, { como = '', voz = null } = {}) {
  const no = motivoParaNoCantar(origen);
  if (no) throw new ErrorApp(no === 'No encuentro ese anuncio.' ? 404 : 409, no);
  const b = leerJSON(path.join(TEMP, origen, 'app', 'brief.json')) || {};
  const ficha = leerFicha(b.productoId) || {};
  const p = leerProducto(b.productoId) || {};
  const slug = slugNuevo(`${ficha.nombre || p.nombre || String(b.productoId || 'anuncio').replace(/-[a-z0-9]{4}$/, '')} cantado`, b.estilo || 'anuncio');
  const dir = path.join(TEMP, slug);
  try {
    copiarCarpeta(path.join(TEMP, origen), dir);
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw new ErrorApp(500, `No pude copiar el anuncio: ${e.message}`);
  }
  const brief = {
    ...b,
    slug,
    familia: FAMILIA,
    cambioDeAudio: { tipo: 'cantado', como: String(como || '').trim().slice(0, 600), voz: voz === 'f' || voz === 'm' ? voz : null, de: origen },
    editadoDe: origen,
    creado: new Date().toISOString(),
    ...(PUERTO_DE_PRUEBA ? { puerto: PUERTO_DE_PRUEBA } : {}),
  };
  delete brief.pedidoEdicion;
  escribirJSON(path.join(dir, 'app', 'brief.json'), brief);
  escribirJSON(path.join(dir, 'app', 'sesion.json'), { uuid: crypto.randomUUID(), estado: 'aprobado', tipo: 'guion', aprobado: new Date().toISOString(), cambios: [], progreso: [] });
  const conductor = await import('./conductor.js');
  await conductor.esperarFamilias();
  try {
    return { slug, productoId: b.productoId, conductor: conductor.iniciarProduccion(slug) };
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw new ErrorApp(e?.status || 500, e?.message || 'No pude empezar la versión cantada.');
  }
}

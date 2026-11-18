// LAS PORTADAS QUE FALTAN EN ESTILOS (2026-11-18z). Pedido: «utiliza ChatGPT que genera las imágenes para generar las
// imágenes de portada que hacen falta». Agregar y los especiales (Cambiar el producto, Clonar un video, Más ganchos y
// Sketch de comedia) no traen anuncio de muestra: la app les hace una portada con ChatGPT Imágenes (tu suscripción, sin
// costo por imagen; produccion/chatgpt-imagen.js) y la deja en app/muestras/<clave>/imagen.png, donde se sirve como
// cualquier muestra (lib/muestras.js). Una vez hecha no se vuelve a hacer; las actualizaciones no la borran.
//
//   faltantes()              -> ['agregar', 'cambiar', …]   las que todavía no tienen imagen
//   generarFaltantes()       -> { hechas: [...], fallo? }    una por una (se llama sola al abrir la app)
//   estado()                 -> { faltantes, generando, ultimoFallo }
//
// En modo prueba no hace nada (nunca gasta el uso de tu ChatGPT en una prueba). Si ChatGPT no tiene sesión o se acabó
// el uso, lo anota y lo vuelve a intentar al otro día.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { APP } from './rutas.js';
import { modoPrueba } from './modo-prueba.js';
import { codexParaImagenes } from './motor-imagenes.js';

export let MUESTRAS_DIR = path.join(APP, 'muestras');
let ESTADO = path.join(APP, '.cache', 'portadas-estilos.json');
let prueba = null; // { generar, codex } solo en las pruebas

/** Solo las pruebas: otra carpeta y un ChatGPT falso. */
export function _paraPruebas({ dir, generar, codex = { cmd: 'falso', home: '/tmp' } }) {
  MUESTRAS_DIR = dir;
  ESTADO = path.join(dir, '.estado-portadas.json');
  prueba = { generar, codex };
}
const DIA = 24 * 3600 * 1000;
const COMUN =
  'Vertical 9:16 cover image for a style card in a video-ad app. Premium, cinematic, high detail, soft dramatic light, dark background with subtle lime-green (#9df626) accents. ' +
  'ABSOLUTELY NO text, letters, numbers, words, logos or watermarks anywhere in the image (also not on screens, signs or labels).';

// la idea de cada portada (lo que hace ese estilo, para que se entienda de un vistazo)
export const PORTADAS = {
  agregar: 'A hand holding a smartphone that plays a short vertical video; from the phone, a glowing stream turns the same scene into a warm 3D animated version with a supplement bottle on a kitchen table. Concept: upload a video and remake it for your product.',
  cambiar: 'A vertical split scene of the same young Latin woman filming a selfie video in her bathroom: on the left she holds a plain generic bottle, on the right the exact same frame with a sleek premium supplement bottle; a thin glowing lime line divides both halves. Concept: same video, your product.',
  clonacion: 'Two vertical smartphone screens side by side showing the same composition (a woman talking to camera in a bright kitchen), with glowing lime outlines that trace the identical structure in both: framing, product position and gestures. Concept: clone the structure of a winning ad.',
  ganchos: 'Five vertical smartphone screens fanned out like playing cards, each with a different opening shot of the same ad: a surprised face close-up, a product close-up, a before-and-after body shot, a woman pointing at the camera, a street interview microphone. Concept: the same ad with different hooks.',
  sketch: 'A cinematic film still of a Latin American telenovela scene in a cozy living room: two women gossip dramatically on a sofa while a third one secretly passes a small product bottle to a friend, like a secret; warm dramatic lighting, shallow depth of field.',
};
// los especiales no son estilos de lib/estilos.js: sus claves (las mismas de la pantalla Estilos)
export const ESPECIALES = ['cambiar', 'clonacion', 'ganchos', 'sketch'];
const IMAGENES = ['imagen.jpg', 'imagen.jpeg', 'imagen.png', 'imagen.webp'];

let generando = false;

const leerEstado = () => {
  try {
    return JSON.parse(fs.readFileSync(ESTADO, 'utf8'));
  } catch {
    return {};
  }
};
const guardarEstado = (e) => {
  try {
    fs.mkdirSync(path.dirname(ESTADO), { recursive: true });
    fs.writeFileSync(ESTADO, JSON.stringify(e, null, 2));
  } catch {
    /* solo es para no reintentar en seguida */
  }
};

export const tieneImagen = (clave) => IMAGENES.some((n) => fs.existsSync(path.join(MUESTRAS_DIR, clave, n)));
export const faltantes = () => Object.keys(PORTADAS).filter((c) => !tieneImagen(c));
export const estado = () => ({ faltantes: faltantes(), generando, ultimoFallo: leerEstado().fallo || null });

/** Hace las portadas que faltan, una por una, con ChatGPT Imágenes. */
export async function generarFaltantes({ forzar = false } = {}) {
  if (generando) return { hechas: [], yaEstaba: true };
  if (modoPrueba() && !prueba) return { hechas: [], fallo: 'modo prueba' };
  const lista = faltantes();
  if (!lista.length) return { hechas: [] };
  const e = leerEstado();
  if (!forzar && e.fallo && Date.now() - Date.parse(e.fallo.fecha || 0) < DIA) return { hechas: [], fallo: e.fallo.motivo };
  const codex = prueba ? prueba.codex : codexParaImagenes();
  if (!codex) {
    guardarEstado({ ...e, fallo: { motivo: 'sin-chatgpt', fecha: new Date().toISOString() } });
    return { hechas: [], fallo: 'sin-chatgpt' };
  }
  generando = true;
  const hechas = [];
  try {
    const generarConChatGPT = prueba ? prueba.generar : (await import('../../../produccion/chatgpt-imagen.js')).generarConChatGPT;
    for (const clave of lista) {
      const tmp = path.join(os.tmpdir(), `kads-portada-${clave}-${process.pid}.png`);
      try {
        await generarConChatGPT({ prompt: `${COMUN}\n\n${PORTADAS[clave]}`, aspecto: '9:16', rutaDestino: tmp, codex });
        const dir = path.join(MUESTRAS_DIR, clave);
        fs.mkdirSync(dir, { recursive: true });
        fs.copyFileSync(tmp, path.join(dir, 'imagen.png'));
        hechas.push(clave);
        console.log(`[portadas] hecha la portada de «${clave}» con ChatGPT`);
      } catch (x) {
        const motivo = x?.sinSesion ? 'sin-sesion' : x?.limite ? 'limite' : x?.contenido ? 'contenido' : 'error';
        console.warn(`[portadas] no pude hacer la de «${clave}» (${motivo}): ${String(x?.message || x).slice(0, 160)}`);
        // sin sesión o sin uso: no se insiste con las demás hasta mañana
        if (motivo === 'sin-sesion' || motivo === 'limite') {
          guardarEstado({ ...leerEstado(), fallo: { motivo, fecha: new Date().toISOString() } });
          return { hechas, fallo: motivo };
        }
      } finally {
        fs.rmSync(tmp, { force: true });
      }
    }
    guardarEstado({ ...leerEstado(), fallo: null, ultima: new Date().toISOString() });
    return { hechas };
  } finally {
    generando = false;
  }
}

/** Al abrir la app: un rato después (para no competir con el arranque), las que falten. */
export function programarPortadas(ms = 90000) {
  if (modoPrueba() || !faltantes().length) return;
  const t = setTimeout(() => generarFaltantes().catch((x) => console.warn('[portadas]', x?.message || x)), ms);
  t.unref?.();
}

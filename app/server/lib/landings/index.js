// LANDINGS (2026-11-20q): clonar una landing por su URL, optimizarla para que cargue rápido y, si quieres, adaptarla a
// tu producto con IA. Cada landing vive en temp/_landings/<id>/:
//   landing.json   { id, url, modo, motor, productoId, titulo, creado, estado, progreso, error, informe, puntajes }
//   index.html + assets/     la copia optimizada (lo que se ve y se descarga)
//   original.html            la página como vino (después de su JavaScript)
//   textos.json / nuevos-textos.json / nuevas-imagenes.json   (modo «adaptar»: lo que leyó y escribió la IA)
//
// Modos:
//   'tal-cual'  la copia exacta y optimizada (clonar.js): textos, imágenes, colores, estructura, carruseles… Sin IA.
//   'adaptar'   la misma copia y, encima, la IA elegida (Claude Code o Codex) reescribe los TEXTOS para tu producto
//               (con su ficha y su investigación) y marca qué imágenes cambiar; esas imágenes las hace ChatGPT (tu
//               suscripción) con la foto de tu producto como referencia. La estructura, los colores y el diseño quedan.
//
// Velocidad: Lighthouse (lo mismo que mide PageSpeed, en celular) a la original y a la copia (medir.js).
//
//   listar() · leer(id) · crear({ url, modo, motor, productoId }) · borrar(id) · medirDeNuevo(id) · carpetaDe(id)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parse } from 'node-html-parser';
import { TEMP, RAIZ } from '../rutas.js';
import { leerJSON } from '../archivos.js';
import { escribirJSON, ErrorApp, leerFicha, listarProductos, rutaFoto } from '../productos.js';
import { modoPrueba } from '../procesos.js';
import { clonarLanding } from './clonar.js';
import { puntaje } from './medir.js';

const DIR = path.join(TEMP, '_landings');
const RE_ID = /^[a-z0-9-]{3,80}$/;
const enCurso = new Set();

export const carpetaDe = (id) => {
  if (!RE_ID.test(String(id || ''))) throw new ErrorApp(404, 'No encuentro esa landing.');
  return path.join(DIR, id);
};
const archivoDe = (id) => path.join(carpetaDe(id), 'landing.json');
export const leer = (id) => {
  const l = leerJSON(archivoDe(id));
  if (!l) throw new ErrorApp(404, 'No encuentro esa landing.');
  return { ...l, trabajando: enCurso.has(id) };
};
const guardar = (id, cambios) => {
  const l = { ...(leerJSON(archivoDe(id)) || {}), ...cambios, actualizado: new Date().toISOString() };
  escribirJSON(archivoDe(id), l);
  return l;
};
const avanzar = (id, texto) => {
  const l = leerJSON(archivoDe(id)) || {};
  guardar(id, { progreso: [...(l.progreso || []), texto].slice(-14) });
};

export function listar() {
  if (!fs.existsSync(DIR)) return { landings: [] };
  const landings = fs
    .readdirSync(DIR)
    .filter((d) => RE_ID.test(d))
    .map((d) => leerJSON(path.join(DIR, d, 'landing.json')))
    .filter(Boolean)
    .map((l) => ({ ...l, trabajando: enCurso.has(l.id) }))
    .sort((a, b) => String(b.creado).localeCompare(String(a.creado)));
  return { landings };
}

export function borrar(id) {
  if (enCurso.has(id)) throw new ErrorApp(409, 'Esa landing se está armando: espera a que termine.');
  fs.rmSync(carpetaDe(id), { recursive: true, force: true });
  return listar();
}

// ---------------------------------------------------------------- crear

export function crear({ url, modo = 'tal-cual', motor = 'claude', productoId = null } = {}) {
  let u;
  try {
    u = new URL(String(url || '').trim());
    if (!/^https?:$/.test(u.protocol)) throw new Error();
  } catch {
    throw new ErrorApp(400, 'Pega la dirección completa de la landing (https://…).');
  }
  if (!['tal-cual', 'adaptar'].includes(modo)) throw new ErrorApp(400, 'Elige «Tal cual» o «Para mi producto».');
  if (!['claude', 'codex'].includes(motor)) throw new ErrorApp(400, 'Elige Claude Code o Codex.');
  if (modo === 'adaptar' && !listarProductos().some((p) => p.id === productoId)) throw new ErrorApp(400, 'Elige el producto para el que la adaptas.');
  const base = (u.pathname.split('/').filter(Boolean).pop() || u.hostname).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'landing';
  const id = `${base}-${crypto.randomBytes(3).toString('hex')}`;
  fs.mkdirSync(carpetaDe(id), { recursive: true });
  guardar(id, { id, url: u.href, modo, motor, productoId: modo === 'adaptar' ? productoId : null, titulo: u.hostname, creado: new Date().toISOString(), estado: 'trabajando', progreso: [], error: null, informe: null, puntajes: null });
  trabajar(id);
  return leer(id);
}

async function ffmpegDisponible() {
  try {
    const { comprobarFfmpeg } = await import('../imagen-ads/local.js');
    return (await comprobarFfmpeg())?.bin || null;
  } catch {
    return null;
  }
}

async function trabajar(id) {
  enCurso.add(id);
  const carpeta = carpetaDe(id);
  try {
    const l = leer(id);
    const informe = await clonarLanding({ url: l.url, carpeta, ffmpeg: await ffmpegDisponible(), alAvanzar: (t) => avanzar(id, t) });
    guardar(id, { titulo: informe.titulo, informe });
    if (l.modo === 'adaptar') await adaptar(id);
    guardar(id, { estado: 'midiendo' });
    await medir(id);
    guardar(id, { estado: 'lista' });
    avanzar(id, 'Lista.');
  } catch (e) {
    console.error('[landings]', id, e);
    guardar(id, { estado: 'error', error: e?.publico || e?.message || 'No se pudo clonar.' });
  } finally {
    enCurso.delete(id);
  }
}

// ---------------------------------------------------------------- medir

const urlLocal = (id) => `http://127.0.0.1:${process.env.PUERTO || 4455}/landing/${id}/index.html`;

async function medir(id) {
  const l = leer(id);
  avanzar(id, 'Midiendo la velocidad (Lighthouse en celular): la original y la copia…');
  const [original, copia] = [await puntaje(l.url), await puntaje(urlLocal(id))];
  guardar(id, { puntajes: { original, copia, fecha: new Date().toISOString() } });
}

export async function medirDeNuevo(id) {
  if (enCurso.has(id)) throw new ErrorApp(409, 'Esa landing se está armando.');
  enCurso.add(id);
  (async () => {
    try {
      guardar(id, { estado: 'midiendo' });
      await medir(id);
    } finally {
      guardar(id, { estado: 'lista' });
      enCurso.delete(id);
    }
  })();
  return leer(id);
}

// ---------------------------------------------------------------- adaptar a tu producto (IA)

const BLOQUES = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'TEXTAREA']);
/** Los textos visibles de la página, en orden (los mismos índices sirven para cambiarlos). */
function textosDe(raiz) {
  const out = [];
  const recorrer = (n) => {
    for (const h of n.childNodes) {
      if (h.nodeType === 3) {
        const t = h.rawText.replace(/\s+/g, ' ').trim();
        if (t.length >= 2 && /[\p{L}\p{N}]/u.test(t)) out.push({ nodo: h, texto: t });
      } else if (h.nodeType === 1 && !BLOQUES.has(h.tagName)) recorrer(h);
    }
  };
  recorrer(raiz.querySelector('body') || raiz);
  return out;
}

async function adaptar(id) {
  const carpeta = carpetaDe(id);
  const l = leer(id);
  const html = fs.readFileSync(path.join(carpeta, 'index.html'), 'utf8');
  const raiz = parse(html, { comment: false, blockTextElements: { script: true, noscript: true, style: true, pre: true, textarea: true } });
  const textos = textosDe(raiz);
  const imgs = raiz.querySelectorAll('img').filter((i) => i.getAttribute('src'));
  escribirJSON(path.join(carpeta, 'textos.json'), textos.map((t, k) => ({ id: k, texto: t.texto })));
  const ficha = leerFicha(l.productoId) || {};
  const prod = listarProductos().find((p) => p.id === l.productoId);
  let investigacion = '';
  try {
    investigacion = (await import('../investigacion.js')).aMarkdown(l.productoId) || '';
  } catch {
    /* sin investigación */
  }
  const rel = (f) => path.relative(RAIZ, path.join(carpeta, f)).replace(/\\/g, '/');
  avanzar(id, `${l.motor === 'codex' ? 'Codex' : 'Claude Code'} está reescribiendo los textos para ${prod?.nombre || 'tu producto'}…`);
  const { lanzarSesion, prohibidasComunes } = await import('../motor-ia.js');
  const lista = textos.map((t, k) => `${k}\t${t.texto.slice(0, 400)}`).join('\n');
  const listaImgs = imgs.map((i, k) => `${k}\t${i.getAttribute('alt') || ''}\t${i.getAttribute('width') || '?'}x${i.getAttribute('height') || '?'}`).join('\n');
  const prompt = `TAREA: landing adaptada. Te ejecuta la app Kads Studio, sin chat ni terminal: solo escribes dos archivos con Write.

El usuario clonó una landing de referencia y quiere la MISMA landing (misma estructura, mismo diseño, mismo orden y mismo tono de venta) para SU producto. Tú reescribes los TEXTOS; el diseño no se toca.

Su producto: ${prod?.nombre || l.productoId}
Ficha: ${JSON.stringify(ficha).slice(0, 6000)}
${investigacion ? `Su investigación de mercado (úsala para el ángulo, los dolores y las palabras del cliente):\n${investigacion.slice(0, 12000)}\n` : ''}
Los textos de la landing, uno por línea (índice<TAB>texto):
${lista}

Las imágenes de la landing (índice<TAB>alt<TAB>tamaño):
${listaImgs}

1. Escribe ${rel('nuevos-textos.json')} con { "<índice>": "<texto nuevo>" } solo para los textos que deben cambiar (el nombre del producto o la marca, beneficios, ingredientes, preguntas frecuentes, reseñas, garantías…). Conserva el largo aproximado de cada texto (el diseño depende de eso), el idioma y el estilo. Precios y ofertas: déjalos como están salvo que la ficha diga otros. NUNCA inventes datos médicos, cifras, estudios ni testimonios que no estén en la ficha o la investigación: si un texto de la original afirma algo que no puedes respaldar para este producto, reescríbelo de forma general y verdadera.
2. Escribe ${rel('nuevas-imagenes.json')} con [{ "id": <índice de la imagen>, "prompt": "<la imagen nueva en inglés, misma composición que la original pero con el producto del usuario>", "aspecto": "1:1" | "4:5" | "9:16" | "16:9" }] para las imágenes donde se ve el producto o la marca de la original (máximo 8, las más importantes primero). Las de personas, fondos o íconos sin marca no se cambian.
Tu respuesta final: solo LISTO.`;
  const r = await lanzarSesion({
    tipo: 'guion',
    motor: l.motor,
    uuid: crypto.randomUUID(),
    prompt,
    herramientas: ['Write'],
    permitidas: [`Write(./${rel('nuevos-textos.json')})`, `Write(./${rel('nuevas-imagenes.json')})`, `Edit(./${rel('nuevos-textos.json')})`, `Edit(./${rel('nuevas-imagenes.json')})`],
    prohibidas: prohibidasComunes({ terminal: false }),
    registro: path.join(carpeta, 'registro-ia.log'),
    timeoutMs: 15 * 60000,
    maxTurnos: 10,
    verificar: async () => (leerJSON(path.join(carpeta, 'nuevos-textos.json')) ? { ok: true } : { ok: false, errores: [`Escribe ${rel('nuevos-textos.json')}.`] }),
  });
  const nuevos = leerJSON(path.join(carpeta, 'nuevos-textos.json'));
  if (!nuevos) throw Object.assign(new Error('ia'), { publico: r?.sinMotor ? 'Esa IA no está lista: conéctala en Ajustes › Conexiones.' : r?.limite ? 'Se acabó el uso de tu plan de IA por ahora. Vuelve a intentar cuando se renueve.' : 'La IA no devolvió los textos. Vuelve a intentar.' });
  let cambiados = 0;
  for (const [k, v] of Object.entries(nuevos)) {
    const t = textos[Number(k)];
    if (!t || typeof v !== 'string' || !v.trim()) continue;
    // conservar los espacios de los bordes del texto original (el diseño los usa)
    const crudo = t.nodo.rawText;
    const ini = crudo.match(/^\s*/)[0];
    const fin = crudo.match(/\s*$/)[0];
    t.nodo.rawText = `${ini}${v.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}${fin}`;
    cambiados++;
  }
  avanzar(id, `Cambió ${cambiados} textos.`);
  // las imágenes nuevas (ChatGPT, con la foto del producto)
  const pedidas = (leerJSON(path.join(carpeta, 'nuevas-imagenes.json')) || []).filter((x) => Number.isInteger(Number(x?.id)) && imgs[Number(x.id)] && String(x.prompt || '').trim()).slice(0, 8);
  let hechas = 0;
  const foto = rutaFoto(l.productoId, 1);
  if (pedidas.length) {
    avanzar(id, `ChatGPT está haciendo ${pedidas.length} imágenes con tu producto…`);
    const { motorDeImagenes, codexParaImagenes } = await import('../motor-imagenes.js');
    for (const p of pedidas) {
      const destino = path.join(carpeta, 'assets', `ia-${p.id}-${crypto.randomBytes(3).toString('hex')}.png`);
      try {
        if (modoPrueba()) {
          if (!foto) continue;
          fs.copyFileSync(foto, destino);
        } else {
          const codex = motorDeImagenes() === 'chatgpt' ? codexParaImagenes() : null;
          if (!codex) {
            avanzar(id, 'Las imágenes se hacen con tu ChatGPT: conéctalo en Ajustes › Conexiones (quedaron las de la original).');
            break;
          }
          const { generarConChatGPT } = await import('../../../../produccion/chatgpt-imagen.js');
          await generarConChatGPT({ prompt: String(p.prompt).slice(0, 3000), referencias: foto ? [foto] : [], aspecto: ['1:1', '4:5', '9:16', '16:9'].includes(p.aspecto) ? p.aspecto : '1:1', rutaDestino: destino, codex });
        }
        const img = imgs[Number(p.id)];
        img.setAttribute('src', `assets/${path.basename(destino)}`);
        img.removeAttribute('srcset');
        img.removeAttribute('sizes');
        hechas++;
      } catch (e) {
        avanzar(id, `Una imagen no salió (${String(e?.message || e).slice(0, 100)}).`);
      }
    }
  }
  fs.writeFileSync(path.join(carpeta, 'index.html'), `<!doctype html>\n${raiz.querySelector('html')?.outerHTML || raiz.toString()}`);
  guardar(id, { adaptada: { textos: cambiados, imagenes: hechas, pedidas: pedidas.length } });
}

export const _paraPruebas = { textosDe, DIR };

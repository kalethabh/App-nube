// EL EDITOR DE IMÁGENES (2026-11-26c). Pedido: «poder editar las imágenes tipo Canva o con IA hacer cambios sin dañar la
// imagen como sale». Tres cosas, cada una deja una VERSIÓN NUEVA de la pieza (la anterior queda en versiones/, como al
// regenerar, y se puede volver):
//   guardarComposicion   el navegador arma la imagen con tus capas (textos, formas, tus piezas) y la sube: sin IA
//   editarZona           marcas un rectángulo y escribes el cambio: la IA rehace SOLO ese recorte y la app lo pega con
//                        el borde suavizado HACIA ADENTRO: fuera del rectángulo, la imagen queda idéntica, píxel por píxel
//   integrarPieza        pegas una pieza exacta (sello, logo, precio) y la IA adapta la zona alrededor (sombra, luz,
//                        bordes); al final la app vuelve a poner encima los píxeles exactos de la pieza
// La IA es la de las imágenes de tus lotes (motor-imagenes.js): tu ChatGPT (sin costo por imagen) o kie (se cobra: la
// pantalla muestra el costo y pide el sí). En modo prueba, la «IA» tiñe el recorte con ffmpeg (no se gasta nada).
//
//   costoDeEditar()                                  { conChatGPT, dolares, modelo }
//   guardarComposicion(lote, pieza, buffer)          -> { version }
//   iniciarEdicion(lote, pieza, { tipo, … })         -> { trabajo }  (async: zona o integrar)
//   estadoTrabajo(id)                                -> { estado, mensaje, version }
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ErrorApp } from '../productos.js';
import { modoPrueba } from '../procesos.js';
import { leerJSON, existe } from '../archivos.js';
import { R, carpetaDe, guardarJSON, firma, RE_PIEZA, vDe, formatoDe } from './disco.js';
import { leerEstado, guardar as guardarEstado } from './estado.js';
import { motorDeImagenes, codexParaImagenes } from '../motor-imagenes.js';
import { rutaPieza } from './piezas.js';

const MODELO_KIE = 'nano-banana-2';
const CREDITOS_KIE = 8; // nano-banana-2 a 1K (produccion/config.js)
const MAXIMO_INSTRUCCION = 600;

export function costoDeEditar() {
  if (!modoPrueba() && motorDeImagenes() === 'chatgpt') return { conChatGPT: true, dolares: 0, modelo: 'ChatGPT (tu suscripción)' };
  return { conChatGPT: false, dolares: Math.round(CREDITOS_KIE * 0.005 * 100) / 100, modelo: `kie.ai ${MODELO_KIE}` };
}

// ---------------------------------------------------------------- utilidades

function medidas(abs) {
  const s = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', abs]).toString().trim();
  const [w, h] = s.split(',').map(Number);
  if (!(w > 0 && h > 0)) throw new ErrorApp(400, 'No pude leer la imagen.');
  return { w, h };
}

function laPieza(lote, pieza) {
  const carpeta = carpetaDe(lote);
  if (!RE_PIEZA.test(String(pieza || '')) || !existe(R.img(carpeta, pieza))) throw new ErrorApp(404, 'No encuentro esa imagen en el lote.');
  const est = leerEstado(carpeta);
  const p = est?.piezas?.[pieza];
  if (!p || p.fase !== 'final') throw new ErrorApp(409, 'Esta imagen se está creando o revisando: espera a que termine para editarla.');
  return { carpeta, est, p };
}

/** Deja `nuevaAbs` como la imagen de la pieza; la de antes pasa a versiones/ (como al regenerar). -> la versión nueva */
function guardarVersion(lote, pieza, nuevaAbs, motivo) {
  const { carpeta, est, p } = laPieza(lote, pieza);
  const img = R.img(carpeta, pieza);
  const indice = leerJSON(R.indiceVersiones(carpeta));
  const i = indice && typeof indice === 'object' && indice.piezas ? indice : { piezas: {} };
  const lista = Array.isArray(i.piezas[pieza]) ? i.piezas[pieza] : [];
  const usados = new Set(lista.map((x) => Number(x?.n)));
  let n = Math.max(1, Number(p.version) || 1);
  while (usados.has(n) || existe(R.versionPng(carpeta, pieza, n))) n++;
  fs.mkdirSync(path.dirname(R.versionPng(carpeta, pieza, n)), { recursive: true });
  fs.copyFileSync(img, R.versionPng(carpeta, pieza, n));
  i.piezas[pieza] = [...lista, { n, archivo: `versiones/${pieza}.v${n}.png`, prompt: null, reemplazadaPor: `editor-${Date.now()}`, motivo, fecha: new Date().toISOString() }];
  guardarJSON(R.indiceVersiones(carpeta), i);
  const tmp = `${img}.${process.pid}.tmp.png`;
  fs.copyFileSync(nuevaAbs, tmp);
  fs.renameSync(tmp, img);
  p.version = (Number(p.version) || 1) + 1;
  p.firma = firma(img);
  if (p.revision) p.revision = { ...p.revision, editada: motivo };
  guardarEstado(carpeta, est);
  // (con logo: la versión final se vuelve a armar)
  const brief = leerJSON(R.brief(carpeta));
  if (brief?.logo?.posicion) import('./local.js').then((l) => l.componerLogo(carpeta, lote, pieza, brief, {})).catch(() => {});
  return p.version;
}

const dirTrabajo = (carpeta, id) => path.join(carpeta, 'app', 'imagen-ads', 'editor', id);

// ---------------------------------------------------------------- 1. guardar lo que armaste (sin IA)

export function guardarComposicion(lote, pieza, datos) {
  const { carpeta } = laPieza(lote, pieza);
  if (!Buffer.isBuffer(datos) || datos.length < 1000) throw new ErrorApp(400, 'La imagen llegó vacía.');
  const id = crypto.randomBytes(6).toString('hex');
  const dir = dirTrabajo(carpeta, id);
  fs.mkdirSync(dir, { recursive: true });
  const crudo = path.join(dir, 'composicion.png');
  fs.writeFileSync(crudo, datos);
  try {
    const a = medidas(R.img(carpeta, pieza));
    const b = medidas(crudo);
    if (a.w !== b.w || a.h !== b.h) throw new ErrorApp(400, `La imagen tiene que medir ${a.w}×${a.h} (llegó de ${b.w}×${b.h}).`);
    const limpia = path.join(dir, 'final.png');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', crudo, '-pix_fmt', 'rgb24', limpia]);
    return { version: guardarVersion(lote, pieza, limpia, 'editor') };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- 2 y 3. con IA, en segundo plano

const trabajos = new Map(); // id -> { estado, mensaje, version, lote, pieza }
export const estadoTrabajo = (id) => trabajos.get(String(id)) || null;

/** El recorte cuadrado (con margen) alrededor de un rectángulo, dentro de la imagen. */
export function recorteAlrededor(rect, img, margen = 0.35) {
  const lado = Math.round(Math.min(Math.min(img.w, img.h), Math.max(256, Math.max(rect.w, rect.h) * (1 + margen))));
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const x = Math.round(Math.min(Math.max(0, cx - lado / 2), img.w - lado));
  const y = Math.round(Math.min(Math.max(0, cy - lado / 2), img.h - lado));
  // (el rectángulo, recortado a lo que cabe en el recorte)
  const rx = Math.max(rect.x, x);
  const ry = Math.max(rect.y, y);
  const rw = Math.min(rect.x + rect.w, x + lado) - rx;
  const rh = Math.min(rect.y + rect.h, y + lado) - ry;
  return { x, y, lado, rect: { x: rx - x, y: ry - y, w: rw, h: rh } };
}

function rectValido(r, img) {
  const x = Math.round(Number(r?.x));
  const y = Math.round(Number(r?.y));
  const w = Math.round(Number(r?.w));
  const h = Math.round(Number(r?.h));
  if (![x, y, w, h].every(Number.isFinite) || w < 16 || h < 16 || x < 0 || y < 0 || x + w > img.w || y + h > img.h) throw new ErrorApp(400, 'Marca una zona dentro de la imagen (de al menos 16 px).');
  return { x, y, w, h };
}

/** La IA sobre un recorte cuadrado: ChatGPT, kie o (modo prueba) un tinte con ffmpeg. */
async function iaSobreRecorte({ recorte, referencias = [], prompt, salida }) {
  if (modoPrueba()) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', recorte, '-vf', 'colorchannelmixer=rr=0.7:gg=0.85:bb=1.2', salida]);
    return;
  }
  if (motorDeImagenes() === 'chatgpt') {
    const codex = codexParaImagenes();
    if (!codex) throw new ErrorApp(409, 'Conecta ChatGPT para imágenes en Ajustes › Conexiones.');
    const { generarConChatGPT } = await import('../../../../produccion/chatgpt-imagen.js');
    // (2026-11-27b) con la mayor calidad posible
    const { CALIDAD } = await import('../../../../produccion/imagen-ads.js');
    await generarConChatGPT({ prompt: `${prompt}\n\n${CALIDAD}`, referencias: [recorte, ...referencias], aspecto: '1:1', rutaDestino: salida, codex });
    return;
  }
  const { generarImagen, subirArchivo } = await import('../../../../produccion/kie-client.js');
  const urls = [];
  for (const r of [recorte, ...referencias]) urls.push(await subirArchivo(r, { uploadPath: 'imagen-ads-editor' }));
  await generarImagen({ modelo: MODELO_KIE, prompt, imagenesReferencia: urls, aspectRatio: '1:1', resolucion: '1K', rutaDestino: salida });
}

/**
 * Pega `editado` (el recorte que hizo la IA) sobre `base`, solo dentro de `rect` (relativo al recorte), con el borde
 * suavizado hacia adentro: fuera del rectángulo quedan los píxeles de `base` exactos.
 */
export function pegarZona({ base, editado, recorte, salida }) {
  const { x, y, lado, rect } = recorte;
  const f = Math.max(4, Math.round(Math.min(rect.w, rect.h) * 0.08));
  const alfa = `255*clip(min(min(X-${rect.x},${rect.x + rect.w}-X),min(Y-${rect.y},${rect.y + rect.h}-Y))/${f},0,1)`;
  execFileSync('ffmpeg', [
    '-v', 'error', '-y', '-i', base, '-i', editado,
    '-filter_complex', `[1:v]scale=${lado}:${lado}:flags=lanczos,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${alfa}'[e];[0:v]format=rgba[o];[o][e]overlay=${x}:${y}:format=rgb,format=rgb24[s]`,
    '-map', '[s]', '-frames:v', '1', salida,
  ]);
}

/** Pega una imagen con transparencia exacta (sin escalar) en (x, y). */
function pegarExacto({ base, encima, x, y, salida }) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', base, '-i', encima, '-filter_complex', `[0:v]format=rgba[o];[1:v]format=rgba[p];[o][p]overlay=${x}:${y}:format=rgb,format=rgb24[s]`, '-map', '[s]', '-frames:v', '1', salida]);
}

const PROMPT_ZONA = (instruccion) =>
  `Edit this image (a close crop of an advertising image). Apply ONLY this change: ${instruccion}\n` +
  'Keep everything else in the crop exactly as it is: the framing, the scale, the colors, the lighting, the textures, the people, the product and every text that the change does not mention. ' +
  'Do not zoom, do not move the camera, do not add borders or new elements. Any text you write must be spelled exactly as asked, clean and legible. Output the same square crop.';
const PROMPT_INTEGRAR = (nota) =>
  'This is a close crop of an advertising image where an element (a seal, a logo, a price tag or a text, shown alone in the SECOND attached image) was just pasted on top. ' +
  'Make it look like a natural part of the image: add a soft realistic contact shadow, match the lighting, the color temperature and the grain, and blend its edges with the background. ' +
  'NEVER redraw, move, resize, recolor or change the element itself or any of its letters, and do not change anything else in the crop.' +
  (nota ? ` Also: ${nota}` : '');

/** Arranca una edición con IA. tipo 'zona' { rect, instruccion } | 'integrar' { rect, capa (PNG con transparencia) o piezaId, nota } */
export function iniciarEdicion(lote, pieza, cuerpo = {}, capa = null) {
  const { carpeta } = laPieza(lote, pieza);
  if ([...trabajos.values()].some((t) => t.lote === lote && t.pieza === pieza && t.estado === 'trabajando')) throw new ErrorApp(409, 'Esta imagen ya tiene un cambio en camino.');
  const img = medidas(R.img(carpeta, pieza));
  const rect = rectValido(cuerpo.rect, img);
  const tipo = cuerpo.tipo === 'integrar' ? 'integrar' : 'zona';
  const instruccion = String(cuerpo.instruccion || '').replace(/\s+/g, ' ').trim().slice(0, MAXIMO_INSTRUCCION);
  if (tipo === 'zona' && instruccion.length < 3) throw new ErrorApp(400, 'Escribe qué quieres cambiar en esa zona.');
  const c = costoDeEditar();
  if (!c.conChatGPT && !(Number(cuerpo.costoMaximoConfirmado) >= c.dolares)) throw new ErrorApp(402, `Este cambio cuesta ${c.dolares} US$ con ${c.modelo}: confírmalo para seguir.`);
  const id = crypto.randomBytes(8).toString('hex');
  const dir = dirTrabajo(carpeta, id);
  fs.mkdirSync(dir, { recursive: true });
  // la capa a integrar: la que mandó el navegador (ya con su tamaño y giro) o una de «Mis piezas» (escalada al rect)
  let capaAbs = null;
  if (tipo === 'integrar') {
    capaAbs = path.join(dir, 'capa.png');
    if (Buffer.isBuffer(capa) && capa.length > 100) fs.writeFileSync(path.join(dir, 'capa-cruda'), capa);
    else if (rutaPieza(cuerpo.piezaId)) fs.copyFileSync(rutaPieza(cuerpo.piezaId), path.join(dir, 'capa-cruda'));
    else throw new ErrorApp(400, 'Falta la pieza a integrar.');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(dir, 'capa-cruda'), '-vf', `scale=${rect.w}:${rect.h}:flags=lanczos,format=rgba`, capaAbs]);
  }
  const t = { id, estado: 'trabajando', mensaje: tipo === 'zona' ? 'La IA está cambiando esa zona' : 'La IA está integrando tu pieza', version: null, lote, pieza };
  trabajos.set(id, t);
  (async () => {
    try {
      const base = R.img(carpeta, pieza);
      let sobre = base;
      if (tipo === 'integrar') {
        sobre = path.join(dir, 'pegada.png');
        pegarExacto({ base, encima: capaAbs, x: rect.x, y: rect.y, salida: sobre });
      }
      // integrar: la zona es la pieza con un margen (para la sombra y los bordes)
      const zona = tipo === 'integrar' ? ampliar(rect, img, 0.3) : rect;
      const rec = recorteAlrededor(zona, img, tipo === 'integrar' ? 0.15 : 0.35);
      const recorte = path.join(dir, 'recorte.png');
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', sobre, '-vf', `crop=${rec.lado}:${rec.lado}:${rec.x}:${rec.y}`, recorte]);
      const editado = path.join(dir, 'editado.png');
      await iaSobreRecorte({ recorte, referencias: tipo === 'integrar' ? [capaAbs] : [], prompt: tipo === 'zona' ? PROMPT_ZONA(instruccion) : PROMPT_INTEGRAR(instruccion), salida: editado });
      const pegada = path.join(dir, 'resultado.png');
      pegarZona({ base: sobre, editado, recorte: rec, salida: pegada });
      let final = pegada;
      if (tipo === 'integrar') {
        // la pieza, exacta otra vez encima: sus letras nunca cambian
        final = path.join(dir, 'final.png');
        pegarExacto({ base: pegada, encima: capaAbs, x: rect.x, y: rect.y, salida: final });
      }
      t.version = guardarVersion(lote, pieza, final, tipo === 'zona' ? 'editor-zona' : 'editor-integrar');
      t.estado = 'listo';
      t.mensaje = tipo === 'zona' ? 'Listo: cambió solo esa zona' : 'Listo: tu pieza quedó integrada';
    } catch (e) {
      t.estado = 'error';
      t.mensaje = e?.status ? e.message : `No se pudo: ${String(e?.message || e).slice(0, 200)}`;
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
      setTimeout(() => trabajos.delete(id), 30 * 60000).unref?.();
    }
  })();
  return { trabajo: id };
}

function ampliar(r, img, m) {
  const dx = Math.round(r.w * m);
  const dy = Math.round(r.h * m);
  const x = Math.max(0, r.x - dx);
  const y = Math.max(0, r.y - dy);
  return { x, y, w: Math.min(img.w, r.x + r.w + dx) - x, h: Math.min(img.h, r.y + r.h + dy) - y };
}

export const _paraPruebas = { pegarZona, recorteAlrededor, medidas, vDe, formatoDe };

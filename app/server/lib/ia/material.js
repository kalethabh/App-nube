// El material de una IA sin herramientas (Codex): lo que la app le pega en el mensaje, las imagenes que le adjunta y
// lo que le ofrece "a pedido". Sale de tres lados, en este orden y sin repetidos (§2.6 del diseño):
//   1. o.material, la lista explicita de cada sesion (manda): { textos, imagenes, aPedido, skillsAPedido, noSeLeen }
//   2. las rutas que nombra el texto de la tarea (rutasEnTexto), como red por si el llamador no puso algo
//   3. lo que la IA pide en `leer` (resolverLecturas)
// Todo pasa por reglas.puedeLeer: la IA nunca recibe nada que Claude no podria leer en esa misma tarea.
//
//   rutasEnTexto(texto, { raiz, carpetaTarea, skills }) -> ['temp/x/manifiesto.json', …]   (solo las que existen)
//   armarMaterial(o, reglas, { enviados, escritos, deNuevo }) -> { textos, imagenes, carpetas, aPedido, … }
//   resolverLecturas(pedidos, reglas) · bloquesDeMensaje(material) · repartirImagenes(imagenes)
//   convertirImagenSiHaceFalta(abs, cacheDir) · hojasDelManifiesto(carpeta, m) · contextosDe(dir, patron)
//   tomasTocadas(antes, ahora) · textoTomasTocadas(k, { pedido }) · estimarTokens(texto, nImagenes)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { RAIZ } from '../rutas.js';
import { renombrarSeguro } from '../archivos.js';
import { buscarPrograma } from '../programas.js';
import { nfc, clave, claveDeRuta, codexHomeDeLaApp, sinRaiz, SIN_MAYUSCULAS } from './reglas.js';

export const TOPE_MENSAJE = 900000; // caracteres de un mensaje (el tope duro de Codex es 1.048.576)
export const TOPE_ARCHIVO = 400000; // caracteres de un archivo de texto (la skill mas grande tiene 150 KB)
export const TOPE_IMAGENES = 48; // imagenes por mensaje (48 de 1.568 px dieron bien en P0: 151k tokens, 16 s)
export const TOPE_CARPETA = 200; // nombres de una carpeta listada
export const TOPE_LECTURAS = 100; // rutas por pedido de `leer`
export const PESO_PARA_CONVERTIR = 10 * 1024 * 1024; // mas que esto (o un .gif) se pasa a JPEG
export const LADO_CONVERTIDA = 2048;
export const TOKENS_POR_IMAGEN = 1300;
// Medido con Codex de verdad (P0, punto 5): una imagen de 1568×1568 ocupa unos 2.900 tokens de entrada (40 imagenes,
// 128.022 tokens). Las 1.300 de arriba eran de imagenes mas chicas (prueba 4). Para decidir si una conversacion todavia
// entra (codex.js), se cuenta esta, que no se queda corta con los recortes de imagen ads ni con las fotos grandes.
export const TOKENS_POR_IMAGEN_GRANDE = 2900;
export const ERROR_NO_ENTRA = 'Lo que hay que leer para esta tarea no entra de una vez.';

const aPosix = (s) => String(s ?? '').replace(/\\/g, '/');
const escRe = (s) => s.replace(/[.+^${}()|[\]\\*?]/g, '\\$&');
const lista = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]);
const natural = (a, b) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
const esDeSkill = (rel) => claveDeRuta(rel).startsWith('.claude/skills/');

function statSeguro(p) {
  try {
    return fs.statSync(p);
  } catch {
    return null;
  }
}
const esArchivo = (p) => Boolean(statSeguro(p)?.isFile());

/** sha1 de los bytes (o del texto en UTF-8), en hexadecimal. */
export const sha1De = (x) => crypto.createHash('sha1').update(Buffer.isBuffer(x) ? x : Buffer.from(String(x ?? ''), 'utf8')).digest('hex');

/** Donde quedan las imagenes convertidas: <CODEX_HOME>/../codex-cache (§2.2). */
export const carpetaDeConvertidas = () => path.join(path.dirname(codexHomeDeLaApp()), 'codex-cache');

/** Una ruta absoluta pasada a relativa a la raiz (con /); si cae fuera, la absoluta con /. */
function relDe(abs, raiz) {
  const r = path.relative(raiz, abs);
  return !r || r.startsWith('..') || path.isAbsolute(r) ? aPosix(abs) : aPosix(r);
}

/** 28 KB (los encabezados de ARCHIVO y la lista DISPONIBLES). */
const pesoKB = (b) => `${Math.max(1, Math.round((Number(b) || 0) / 1024)).toLocaleString('es')} KB`;
/** 0,6 MB o 12 KB (las listas de una CARPETA). */
const pesoCorto = (b) => (b >= 100 * 1024 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : pesoKB(b));

// ---------------------------------------------------------------- las rutas que nombra un texto

// Donde se corta una ruta: espacio, comilla, backtick, coma, punto y coma, cierre de parentesis, « » o salto (§2.6).
const CORTE = `\\s"'\`,;)«»“”‘’`;
const EXT_RUTA = '(?:json|md|txt|csv|srt|vtt|tsv|png|jpe?g|webp|gif)';

/** Lo que queda de una coincidencia: con / (una sola), sin / al principio ni al final, sin . ni : finales. */
function limpiar(s) {
  let r = aPosix(s).replace(/\/{2,}/g, '/').replace(/^\/+/, '');
  for (let antes = ''; antes !== r; ) {
    antes = r;
    r = r.replace(/[.:]+$/, '').replace(/\/+$/, '');
  }
  return r.replace(/^(\.\/)+/, '');
}
const tapar = (t, i, n) => t.slice(0, i) + ' '.repeat(n) + t.slice(i + n);

/** Una carpeta dada por la tarea (absoluta dentro de la raiz o relativa), como relativa; null si no sirve. */
function carpetaRelativa(valor, raiz) {
  const v = nfc(aPosix(String(valor ?? '').trim().replace(/^[`"'«]+|[`"'»]+$/g, ''))).replace(/\/+$/, '');
  if (!v) return null;
  const raizP = nfc(aPosix(path.resolve(raiz))).replace(/(.)\/+$/, '$1');
  if (/^[A-Za-z]:\//.test(v) || v.startsWith('/')) {
    if (clave(v) === clave(raizP)) return '';
    return clave(v).startsWith(`${clave(raizP)}/`) ? sinRaiz(v, raizP) : null;
  }
  return limpiar(v);
}

/**
 * Las rutas que nombra un texto y que existen, relativas a la raiz y en el orden en que aparecen (§2.6):
 *   - absolutas que empiezan con la raiz, con / o con \ (aunque la raiz tenga espacios o eñes), como las de voz en off;
 *   - relativas que empiezan con temp/, ./temp/, .claude/skills/ o recursos/;
 *   - sueltas: un nombre con extension de texto o de imagen (`plan.json`, `formatos/indice.json`), buscado en la
 *     carpeta de la tarea (su linea «Carpeta del lote/anuncio/producto:», o carpetaTarea) y despues en la carpeta de
 *     cada skill que nombra el texto (o skills).
 * Cada una sigue hasta el primer corte y pierde los . y : finales. Las que tienen <id> o N no existen y no salen.
 */
export function rutasEnTexto(texto, { raiz = RAIZ, carpetaTarea = null, skills = [] } = {}) {
  const base = path.resolve(raiz);
  const t = nfc(String(texto ?? ''));
  const flags = SIN_MAYUSCULAS ? 'giu' : 'gu';
  const hallados = [];
  const existe = (rel) => Boolean(rel) && !rel.split('/').includes('..') && Boolean(statSeguro(path.join(base, ...rel.split('/'))));
  let mascara = t;

  // 1) absolutas
  const raizP = nfc(aPosix(base)).replace(/(.)\/+$/, '$1');
  // (los separadores de la raiz pueden venir dobles: una ruta de Windows escrita dentro de un JSON lleva \\)
  const reAbs = new RegExp(`${raizP.split('/').map(escRe).join('[\\\\/]+')}((?:[\\\\/][^${CORTE}]*)?)`, flags);
  const reCorte = new RegExp(`[${CORTE}.:]`, 'u');
  for (const m of t.matchAll(reAbs)) {
    const sig = t[m.index + m[0].length];
    if (!m[1] && sig !== undefined && !reCorte.test(sig)) continue; // la raiz seguida de otra cosa: es otra carpeta
    mascara = tapar(mascara, m.index, m[0].length);
    hallados.push({ pos: m.index, rel: limpiar(m[1]) });
  }

  // 2) relativas (siempre con la barra: «los recursos del anuncio» no es una ruta)
  const reRel = new RegExp(`(?<![\\p{L}\\p{N}_.\\-/\\\\])(?:\\.[\\\\/])?((?:temp|\\.claude[\\\\/]skills|recursos)[\\\\/][^${CORTE}]*)`, flags);
  for (const m of mascara.matchAll(reRel)) {
    mascara = tapar(mascara, m.index, m[0].length);
    hallados.push({ pos: m.index, rel: limpiar(m[1]) });
  }

  // 3) sueltas, contra la carpeta de la tarea y contra cada skill nombrada
  const bases = [];
  const sumarBase = (b) => {
    if (b && !bases.some((x) => clave(x) === clave(b))) bases.push(b); // nunca la raiz misma
  };
  if (carpetaTarea) sumarBase(carpetaRelativa(carpetaTarea, base));
  for (const m of t.matchAll(/^[ \t>*-]*Carpeta del (?:lote|anuncio|producto):[ \t]*(.+?)[ \t]*$/gimu)) sumarBase(carpetaRelativa(m[1], base));
  const nombres = [];
  for (const m of t.matchAll(/\.claude[\\/]skills[\\/]([\p{L}\p{N}_-]+)/giu)) nombres.push(m[1]);
  for (const s of lista(skills)) {
    const x = aPosix(s).replace(/\/+$/, '');
    nombres.push(/skills\/([^/]+)/i.exec(x)?.[1] || x.split('/').pop());
  }
  for (const n of nombres) if (n) sumarBase(`.claude/skills/${n}`);
  const reSuelta = new RegExp(`(?<![\\p{L}\\p{N}_.\\-/\\\\<>#{}$%@~])([\\p{L}\\p{N}_][\\p{L}\\p{N}_.\\-/]*\\.${EXT_RUTA})(?![\\p{L}\\p{N}_/\\\\-]|\\.[\\p{L}\\p{N}])`, flags);
  for (const m of mascara.matchAll(reSuelta)) {
    const nombre = limpiar(m[1]);
    if (!nombre || nombre.split('/').some((s) => !s || s === '.' || s === '..')) continue;
    const donde = bases.find((b) => existe(`${b}/${nombre}`));
    if (donde) hallados.push({ pos: m.index, rel: `${donde}/${nombre}` });
  }

  const vistos = new Set();
  const salida = [];
  for (const h of hallados.sort((a, b) => a.pos - b.pos)) {
    if (!existe(h.rel)) continue;
    const k = claveDeRuta(h.rel);
    if (vistos.has(k)) continue;
    vistos.add(k);
    salida.push(h.rel);
  }
  return salida;
}

// ---------------------------------------------------------------- armar el material

function nuevoMaterial(raiz) {
  return { raiz, textos: [], imagenes: [], carpetas: [], aPedido: [], nombradasSinPermiso: [], denegados: [], sinCambios: [], faltan: [], error: null, detalle: null, caracteres: 0 };
}

// Lo que no se nombra ni en una lista de carpeta: .env* y .git siempre; lo demas solo como archivo (la carpeta de
// un producto «Credentials …» se nombra como cualquier otra, igual que en reglas.js).
const OCULTO = /^(\.env|\.git$)/i;
const OCULTO_ARCHIVO = /^(auth\.json$|config\.toml$|credentials|\.npmrc$|\.netrc$)/i;

/** Una carpeta como lista de un solo nivel, hasta TOPE_CARPETA nombres. */
function listarCarpeta(abs, rel) {
  let ents = [];
  try {
    ents = fs.readdirSync(abs, { withFileTypes: true });
  } catch {
    /* vacia */
  }
  ents = ents.filter((e) => !OCULTO.test(e.name) && (e.isDirectory() || !OCULTO_ARCHIVO.test(e.name))).sort((a, b) => natural(a.name, b.name));
  const entradas = ents.slice(0, TOPE_CARPETA).map((e) => {
    const p = path.join(abs, e.name);
    const st = statSeguro(p);
    const carpeta = Boolean(st?.isDirectory());
    return { nombre: e.name, carpeta, bytes: carpeta ? null : (st?.size ?? 0) };
  });
  return { rel, abs, total: ents.length, entradas };
}

function textoDeCarpeta(c) {
  const lineas = c.entradas.map((e) => (e.carpeta ? `- ${e.nombre}/ (carpeta)` : `- ${e.nombre} (${pesoCorto(e.bytes)})`));
  if (c.total > c.entradas.length) lineas.push(`- … y ${c.total - c.entradas.length} más`);
  return `===== CARPETA: ${c.rel} (${c.total} ${c.total === 1 ? 'archivo' : 'archivos'}) =====\n${lineas.join('\n')}${lineas.length ? '\n' : ''}===== FIN: ${c.rel} =====`;
}

/**
 * Toma una ruta para el material. origen: 'material' (o.material: lo que no pasa va a denegados), 'tarea' (lo que
 * nombra el texto: lo que no pasa va a nombradasSinPermiso), 'escritos' (lo que ya escribio la IA) o 'leer' (lo que
 * pidio: lo que no pasa, o no existe, va a denegados). como: null (por el tipo), 'aPedido' o 'imagen'.
 */
function tomar(ctx, ruta, origen, como = null) {
  const { reglas, res } = ctx;
  const r = reglas.puedeLeer(ruta);
  const rel = r.rel || aPosix(String(ruta ?? ''));
  const k = claveDeRuta(rel);
  if (ctx.vistos.has(k)) return;
  ctx.vistos.add(k);
  if (origen === 'tarea' && ctx.noSeLeen.some((n) => k === n || k.startsWith(`${n}/`))) return;
  const negar = (motivo) => {
    if (origen === 'tarea' || origen === 'escritos') res.nombradasSinPermiso.push(rel);
    else res.denegados.push({ tipo: 'leer', ruta: rel, motivo });
  };
  if (!r.ok) return negar(r.motivo);
  if (!r.existe) {
    if (origen === 'leer') negar('ese archivo no existe');
    else if (origen === 'material') res.faltan.push(rel);
    return;
  }
  if (como === 'aPedido' || (origen === 'tarea' && ctx.skillsAPedido && esDeSkill(rel))) {
    res.aPedido.push(rel);
    return;
  }
  if (r.tipo === 'carpeta') {
    res.carpetas.push(listarCarpeta(r.abs, rel));
    return;
  }
  if (r.tipo === 'imagen') {
    res.imagenes.push({ rel, abs: r.abs, original: r.abs, bytes: r.bytes, convertida: false });
    return;
  }
  let buf;
  try {
    buf = fs.readFileSync(r.abs);
  } catch {
    return negar('no se pudo abrir');
  }
  const contenido = buf.toString('utf8').replace(/^﻿/, '');
  if (contenido.length > TOPE_ARCHIVO) return negar(`es demasiado grande para mandártelo (${contenido.length.toLocaleString('es')} caracteres; el tope es ${TOPE_ARCHIVO.toLocaleString('es')})`);
  const sha1 = sha1De(buf);
  if (origen !== 'leer' && (ctx.enviados[rel] === sha1 || ctx.enviados[k] === sha1)) {
    res.sinCambios.push(rel);
    return;
  }
  res.textos.push({ rel, abs: r.abs, bytes: buf.length, contenido, sha1 });
}

/** Cuantos caracteres ocupa el material en el mensaje (mas la tarea y un margen para lo demas). */
function caracteresDe(res, prompt = '', extra = 0) {
  let n = String(prompt ?? '').length + extra;
  for (const x of res.textos) n += x.contenido.length + 2 * x.rel.length + 64;
  for (const c of res.carpetas) n += c.rel.length * 2 + 64 + c.entradas.reduce((s, e) => s + e.nombre.length + 16, 0);
  n += (res.imagenes.length + res.aPedido.length + res.sinCambios.length) * 120;
  return n;
}

function detalleDeTamanos(res, prompt) {
  const grandes = [...res.textos].sort((a, b) => b.contenido.length - a.contenido.length).slice(0, 5);
  return `Son ${res.caracteres.toLocaleString('es')} caracteres y el tope es ${TOPE_MENSAJE.toLocaleString('es')}. La tarea: ${String(prompt ?? '').length.toLocaleString('es')}. El material: ${res.textos.length} archivos (${res.textos.reduce((s, x) => s + x.contenido.length, 0).toLocaleString('es')} caracteres); los más grandes: ${grandes.map((x) => `${x.rel} (${pesoKB(x.bytes)})`).join(', ') || 'ninguno'}. Imágenes: ${res.imagenes.length}.`;
}

/** Pasa a JPEG las que hace falta (en el lugar: abs pasa a ser la copia; original queda). */
async function convertirTodas(imagenes, cacheDir) {
  for (const im of imagenes) {
    const c = await convertirImagenSiHaceFalta(im.original || im.abs, cacheDir);
    im.abs = c.abs;
    im.convertida = c.convertida;
    if (c.error) im.aviso = c.error;
  }
}

/**
 * El material del primer mensaje (o el de arrancar de nuevo, con deNuevo):
 *   o          { prompt, material: { textos, imagenes, aPedido, skillsAPedido, noSeLeen, carpeta?, skills? } }
 *   reglas     reglas.traducir(o.permitidas, o.prohibidas)
 *   opciones   enviados { rel: sha1 } (lo que la IA ya recibio y no cambio va como una linea), escritos [rel] (con
 *              deNuevo: lo que el hilo viejo escribio y todavia existe), deNuevo, cacheDir, convertir, extra
 * -> { textos:[{rel, abs, bytes, contenido, sha1}], imagenes:[{rel, abs, original, convertida}], carpetas,
 *      aPedido:[rel], nombradasSinPermiso:[rel], denegados:[{tipo:'leer', ruta, motivo}], sinCambios:[rel], faltan,
 *      caracteres, error?, detalle? }
 * Si no entra en TOPE_MENSAJE, primero las skills pasan a «a pedido»; si igual no entra, error y detalle.
 */
export async function armarMaterial(o = {}, reglas, { enviados = {}, escritos = [], deNuevo = false, cacheDir = carpetaDeConvertidas(), convertir = true, extra = 20000 } = {}) {
  const raiz = reglas?.raiz || RAIZ;
  const m = o?.material || {};
  const res = nuevoMaterial(raiz);
  const ctx = {
    reglas,
    res,
    vistos: new Set(),
    noSeLeen: lista(m.noSeLeen).map((x) => claveDeRuta(carpetaRelativa(x, raiz) ?? x).replace(/\/\*\*$/, '')),
    enviados: deNuevo ? {} : enviados || {},
    skillsAPedido: Boolean(m.skillsAPedido),
  };
  for (const r of lista(m.textos)) tomar(ctx, r, 'material');
  for (const r of lista(m.aPedido)) tomar(ctx, r, 'material', 'aPedido');
  for (const r of rutasEnTexto(o?.prompt, { raiz, carpetaTarea: m.carpeta || null, skills: m.skills || [] })) tomar(ctx, r, 'tarea');
  for (const r of lista(m.imagenes)) tomar(ctx, r, 'material', 'imagen'); // despues de las que nombra el texto
  if (deNuevo) for (const r of lista(escritos)) tomar(ctx, r, 'escritos');

  res.caracteres = caracteresDe(res, o?.prompt, extra);
  if (res.caracteres > TOPE_MENSAJE) {
    const skills = res.textos.filter((x) => esDeSkill(x.rel));
    if (skills.length) {
      res.textos = res.textos.filter((x) => !esDeSkill(x.rel));
      res.aPedido.unshift(...skills.map((x) => x.rel));
      res.pasaronAPedido = skills.map((x) => x.rel);
      res.caracteres = caracteresDe(res, o?.prompt, extra);
    }
  }
  if (res.caracteres > TOPE_MENSAJE) {
    res.error = ERROR_NO_ENTRA;
    res.detalle = detalleDeTamanos(res, o?.prompt);
  }
  if (convertir) await convertirTodas(res.imagenes, cacheDir);
  return res;
}

/**
 * Lo que la IA pidio en `leer`, con el mismo filtro (§2.6). Lo que no se puede, no existe, es un video o no entra en
 * este mensaje va a denegados con su motivo. -> la misma forma que armarMaterial.
 */
export async function resolverLecturas(pedidos, reglas, { cacheDir = carpetaDeConvertidas(), convertir = true, espacio = TOPE_MENSAJE - 20000 } = {}) {
  const raiz = reglas?.raiz || RAIZ;
  const res = nuevoMaterial(raiz);
  const ctx = { reglas, res, vistos: new Set(), noSeLeen: [], enviados: {}, skillsAPedido: false };
  lista(pedidos).forEach((p, i) => {
    if (typeof p !== 'string' || !p.trim()) res.denegados.push({ tipo: 'leer', ruta: String(p ?? ''), motivo: 'eso no es una ruta' });
    else if (i >= TOPE_LECTURAS) res.denegados.push({ tipo: 'leer', ruta: p, motivo: `pide hasta ${TOPE_LECTURAS} archivos por mensaje` });
    else tomar(ctx, p, 'leer');
  });
  let usado = 0;
  const entran = [];
  for (const x of res.textos) {
    const c = x.contenido.length + 2 * x.rel.length + 64;
    if (usado + c > espacio) res.denegados.push({ tipo: 'leer', ruta: x.rel, motivo: 'no entra en este mensaje junto con lo demás: pídelo solo en el próximo' });
    else {
      usado += c;
      entran.push(x);
    }
  }
  res.textos = entran;
  res.caracteres = caracteresDe(res);
  if (convertir) await convertirTodas(res.imagenes, cacheDir);
  return res;
}

// ---------------------------------------------------------------- el texto del mensaje

/**
 * Las partes 1 a 3 del mensaje (§2.5): MATERIAL (cada archivo entre ===== ARCHIVO / ===== FIN, las carpetas como
 * lista y una linea por lo que no cambio), IMÁGENES ADJUNTAS (una linea por -i) y DISPONIBLES (lo que se pide en
 * `leer`). Las partes vacias no van. opciones: imagenes (las de ESTE mensaje), desde (el numero de la primera),
 * titulo ('MATERIAL' o 'MATERIAL NUEVO'), disponibles (false para no listarlas).
 */
export function bloquesDeMensaje(material, { imagenes = material?.imagenes || [], desde = 1, titulo = 'MATERIAL', disponibles = true } = {}) {
  const partes = [];
  const bloques = [];
  for (const x of material?.textos || []) {
    bloques.push(`===== ARCHIVO: ${x.rel} (${pesoKB(x.bytes)}) =====\n${x.contenido}${x.contenido.endsWith('\n') ? '' : '\n'}===== FIN: ${x.rel} =====`);
  }
  for (const c of material?.carpetas || []) bloques.push(textoDeCarpeta(c));
  for (const rel of material?.sinCambios || []) bloques.push(`(sin cambios desde la última vez: ${rel})`);
  if (bloques.length) partes.push(`## ${titulo}\n\n${bloques.join('\n\n')}`);
  if (imagenes.length) partes.push(`## IMÁGENES ADJUNTAS (en este orden)\n${imagenes.map((im, i) => `Image #${desde + i} = ${im.rel}`).join('\n')}`);
  if (disponibles && material?.aPedido?.length) {
    const raiz = material.raiz || RAIZ;
    const linea = (rel) => {
      const st = statSeguro(path.join(raiz, ...rel.split('/')));
      return `- ${rel}${st ? (st.isDirectory() ? ' (carpeta)' : ` (${pesoKB(st.size)})`) : ''}`;
    };
    partes.push(`## DISPONIBLES SI LOS PIDES EN \`leer\`\n${material.aPedido.map(linea).join('\n')}`);
  }
  return partes.join('\n\n');
}

/** Las imagenes en tandas de `tope` (la primera va con el texto; §2.6). */
export function repartirImagenes(imagenes, tope = TOPE_IMAGENES) {
  const t = Math.max(1, Math.floor(Number(tope) || TOPE_IMAGENES));
  const out = [];
  for (let i = 0; i < (imagenes || []).length; i += t) out.push(imagenes.slice(i, i + t));
  return out;
}

/** La linea del primer mensaje cuando faltan imagenes (§2.6). */
export const lineaFaltanImagenes = (n) =>
  n === 1
    ? 'Falta 1 imagen: llega en el próximo mensaje. Ahora responde solo con `estado` "SEGUIR", sin archivos.'
    : `Faltan ${n} imágenes: llegan en el próximo mensaje. Ahora responde solo con \`estado\` "SEGUIR", sin archivos.`;
export const LINEA_YA_TODAS = 'Ya tienes todas las imágenes: haz la tarea.';

/** caracteres / 3,5 + 1.300 por imagen (§2.9; `porImagen` cambia eso). texto puede ser el texto o su largo. */
export function estimarTokens(texto, nImagenes = 0, { porImagen = TOKENS_POR_IMAGEN } = {}) {
  const c = typeof texto === 'number' ? texto : String(texto ?? '').length;
  return Math.ceil(c / 3.5) + porImagen * (Number(nImagenes) || 0);
}

// ---------------------------------------------------------------- imagenes

const ES_RECORTE = /_r\d+\.(png|jpe?g|webp)$/i; // los recortes de imagen ads: sirven para leer las letras, nunca se tocan
const ESCALA = `scale='if(gt(iw,ih),min(${LADO_CONVERTIDA},iw),-2)':'if(gt(iw,ih),-2,min(${LADO_CONVERTIDA},ih))'`;

function binarioFfmpeg() {
  const p = buscarPrograma('ffmpeg');
  return p && !/\.(cmd|bat)$/i.test(p.ruta) ? p.ruta : 'ffmpeg';
}
function ffmpeg(args) {
  return new Promise((resolve) => {
    execFile(binarioFfmpeg(), ['-hide_banner', '-loglevel', 'error', '-y', ...args], { windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 }, (err, _out, stderr) =>
      resolve(err ? { ok: false, error: String(stderr || err.message || 'ffmpeg falló').trim().slice(-300) } : { ok: true })
    );
  });
}

/**
 * Una imagen de mas de 10 MB, o un .gif, pasa a JPEG de 2048 px de lado largo (ffmpeg -q:v 2) en
 * <cacheDir>/<sha1>/<nombre original>.jpg: la IA ve un nombre con sentido, nunca <sha1>.jpg. Los recortes _r1…_r4
 * nunca. -> { abs (la que va con -i), convertida, error? }; si no se pudo, la original.
 */
export async function convertirImagenSiHaceFalta(abs, cacheDir = carpetaDeConvertidas()) {
  const st = statSeguro(abs);
  if (!st?.isFile()) return { abs, convertida: false, error: 'no existe' };
  const nombre = path.basename(abs);
  const ext = path.extname(nombre).toLowerCase();
  if (ES_RECORTE.test(nombre)) return { abs, convertida: false };
  if (ext !== '.gif' && st.size <= PESO_PARA_CONVERTIR) return { abs, convertida: false };
  let sha1;
  try {
    sha1 = sha1De(fs.readFileSync(abs));
  } catch {
    return { abs, convertida: false, error: 'no se pudo abrir' };
  }
  const destino = path.join(cacheDir, sha1, `${path.basename(nombre, path.extname(nombre))}.jpg`);
  if (esArchivo(destino)) return { abs: destino, convertida: true };
  try {
    fs.mkdirSync(path.dirname(destino), { recursive: true });
  } catch {
    return { abs, convertida: false, error: 'no se pudo crear la carpeta de las convertidas' };
  }
  const tmp = `${destino}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp.jpg`;
  const r = await ffmpeg(['-i', abs, '-frames:v', '1', '-vf', ESCALA, '-q:v', '2', tmp]);
  if (!r.ok || !esArchivo(tmp)) {
    fs.rmSync(tmp, { force: true });
    return { abs, convertida: false, error: r.error || 'no se pudo convertir' };
  }
  try {
    renombrarSeguro(tmp, destino);
  } catch {
    return { abs, convertida: false, error: 'no se pudo guardar la convertida' };
  }
  return { abs: destino, convertida: true };
}

// ---------------------------------------------------------------- las dos ayudas de §3.1

/** img/<id>.png|jpg|jpeg|webp de cada m.referencias[] que existe, relativas a la raiz (las hojas de personajes). */
export function hojasDelManifiesto(carpeta, m, { raiz = RAIZ } = {}) {
  const dir = path.isAbsolute(String(carpeta)) ? String(carpeta) : path.join(raiz, String(carpeta));
  const refs = m?.referencias;
  const ids = Array.isArray(refs) ? refs.map((r) => (typeof r === 'string' ? r : r?.id)) : refs && typeof refs === 'object' ? Object.keys(refs) : [];
  const out = [];
  for (const id of ids) {
    if (typeof id !== 'string' || !id.trim() || /[\\/]|\.\./.test(id)) continue;
    for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
      const f = path.join(dir, 'img', `${id}${ext}`);
      if (esArchivo(f)) {
        const rel = relDe(f, raiz);
        if (!out.includes(rel)) out.push(rel);
        break;
      }
    }
  }
  return out;
}

/** Los archivos de una carpeta que calzan con el patron ('contexto-toma-*.txt', 'contexto-*.txt' o una RegExp), en orden natural. */
export function contextosDe(dir, patron = 'contexto-*.txt', { raiz = RAIZ } = {}) {
  const d = path.isAbsolute(String(dir)) ? String(dir) : path.join(raiz, String(dir));
  const re = patron instanceof RegExp ? patron : new RegExp(`^${String(patron).split('*').map(escRe).join('.*')}$`, 'i');
  let nombres = [];
  try {
    nombres = fs.readdirSync(d);
  } catch {
    return [];
  }
  return nombres
    .filter((n) => re.test(n) && esArchivo(path.join(d, n)))
    .sort(natural)
    .map((n) => relDe(path.join(d, n), raiz));
}

// ---------------------------------------------------------------- el control de tomas tocadas (§3.3)

function ordenar(v) {
  if (Array.isArray(v)) return v.map(ordenar);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordenar(v[k])]));
  return v;
}
const igual = (a, b) => JSON.stringify(ordenar(a ?? null)) === JSON.stringify(ordenar(b ?? null));
const clavesDe = (...os) => [...new Set(os.flatMap((o) => (o && typeof o === 'object' && !Array.isArray(o) ? Object.keys(o) : [])))];
const comoNumero = (n) => (/^\d+$/.test(String(n)) ? Number(n) : n);

function comoDato(x) {
  if (Buffer.isBuffer(x)) x = x.toString('utf8');
  if (typeof x !== 'string') return x ?? null;
  try {
    return JSON.parse(x.replace(/^﻿/, ''));
  } catch {
    return x;
  }
}
function porN(l) {
  const mapa = new Map();
  (Array.isArray(l) ? l : []).forEach((x, i) => mapa.set(String(x?.n ?? i + 1), x));
  return mapa;
}
function unionOrdenada(a, b) {
  return [...new Set([...a.keys(), ...b.keys()])].sort((x, y) => natural(x, y));
}

/** Las lineas que cambiaron entre dos textos (diff por LCS): [{ n (linea en el de antes), antes, ahora }]. */
function lineasCambiadas(a, b) {
  const A = String(a ?? '').split(/\r?\n/);
  const B = String(b ?? '').split(/\r?\n/);
  if (A.length * B.length > 4e6) {
    // muy largo para el diff: linea por linea, en su lugar
    const out = [];
    for (let i = 0; i < Math.max(A.length, B.length); i++) if (A[i] !== B[i]) out.push({ n: i + 1, antes: A[i] ?? null, ahora: B[i] ?? null });
    return out;
  }
  const L = Array.from({ length: A.length + 1 }, () => new Uint32Array(B.length + 1));
  for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let quitadas = [];
  let agregadas = [];
  const volcar = () => {
    const k = Math.max(quitadas.length, agregadas.length);
    for (let x = 0; x < k; x++) {
      const q = quitadas[x];
      const g = agregadas[x];
      out.push({ n: q ? q.i + 1 : g.i + 1, antes: q ? q.texto : null, ahora: g ? g.texto : null });
    }
    quitadas = [];
    agregadas = [];
  };
  let i = 0;
  let j = 0;
  while (i < A.length || j < B.length) {
    if (i < A.length && j < B.length && A[i] === B[j]) {
      volcar();
      i++;
      j++;
    } else if (j < B.length && (i === A.length || L[i][j + 1] >= L[i + 1][j])) {
      agregadas.push({ i, texto: B[j] });
      j++;
    } else {
      quitadas.push({ i, texto: A[i] });
      i++;
    }
  }
  volcar();
  return out;
}

const IGNORAR_EN_LETRAS = ['cambios_hechos', 'decisiones', 'elegida', 'elegidaEn'];

/**
 * Que cambio entre la foto de antes y lo que dejo la IA (§3.3):
 *   manifiestos: tomas[] por n (la toma entera: linea, prompts, referencias…), broll[] por n y los demas campos
 *                (voz_en_off, overlays, referencias…) en otros;
 *   letras.json: la letra de cada opcion, linea por linea, y sus otros campos; cancion/peticion.json: su letra.
 * antes/ahora: el objeto o el texto del archivo. -> { tomas:[n], broll:[n], otros:[campo], lineas:[{donde, n, antes,
 * ahora}], antes: { tomas:{n: toma}, broll:{n: broll}, otros:{campo: valor}, lineas:[…] }, hayCambios }
 */
export function tomasTocadas(antes, ahora) {
  const A = comoDato(antes);
  const B = comoDato(ahora);
  const k = { tomas: [], broll: [], otros: [], lineas: [], antes: { tomas: {}, broll: {}, otros: {}, lineas: [] }, hayCambios: false };
  const otro = (campo, valor) => {
    k.otros.push(campo);
    k.antes.otros[campo] = valor ?? null;
  };
  const lineas = (donde, a, b) => {
    for (const c of lineasCambiadas(a, b)) {
      k.lineas.push({ donde, ...c });
      k.antes.lineas.push({ donde, ...c });
    }
  };
  const porLista = (la, lb, salida, antesDe) => {
    const mA = porN(la);
    const mB = porN(lb);
    for (const n of unionOrdenada(mA, mB)) {
      if (igual(mA.get(n), mB.get(n))) continue;
      salida.push(comoNumero(n));
      antesDe[n] = mA.get(n) ?? null;
    }
  };
  const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : null);
  if (Array.isArray(obj(A)?.tomas) || Array.isArray(obj(B)?.tomas)) {
    porLista(A?.tomas, B?.tomas, k.tomas, k.antes.tomas);
    porLista(A?.broll, B?.broll, k.broll, k.antes.broll);
    for (const c of clavesDe(A, B)) if (c !== 'tomas' && c !== 'broll' && !igual(A?.[c], B?.[c])) otro(c, A?.[c]);
  } else if (Array.isArray(obj(A)?.opciones) || Array.isArray(obj(B)?.opciones)) {
    const mA = porN(A?.opciones);
    const mB = porN(B?.opciones);
    for (const n of unionOrdenada(mA, mB)) {
      const a = mA.get(n);
      const b = mB.get(n);
      const donde = `opción ${n}`;
      lineas(donde, a?.letra, b?.letra);
      for (const c of clavesDe(a, b)) if (c !== 'letra' && c !== 'n' && !igual(a?.[c], b?.[c])) otro(`${donde}: ${c}`, a?.[c]);
    }
    for (const c of clavesDe(A, B)) if (c !== 'opciones' && !IGNORAR_EN_LETRAS.includes(c) && !igual(A?.[c], B?.[c])) otro(c, A?.[c]);
  } else if (typeof obj(A)?.letra === 'string' || typeof obj(B)?.letra === 'string') {
    lineas('letra', A?.letra, B?.letra);
    for (const c of clavesDe(A, B)) if (c !== 'letra' && !IGNORAR_EN_LETRAS.includes(c) && !igual(A?.[c], B?.[c])) otro(c, A?.[c]);
  } else {
    lineas('texto', typeof A === 'string' ? A : JSON.stringify(A ?? ''), typeof B === 'string' ? B : JSON.stringify(B ?? ''));
  }
  k.hayCambios = k.tomas.length + k.broll.length + k.otros.length + k.lineas.length > 0;
  return k;
}

const enLista = (xs) => (xs.length <= 1 ? String(xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
const bloqueAntes = (titulo, valor) =>
  `===== ANTES: ${titulo} =====\n${valor === null || valor === undefined ? '(no estaba: lo agregaste tú)' : typeof valor === 'string' ? valor : JSON.stringify(valor, null, 2)}\n===== FIN: ${titulo} =====`;

/**
 * El mensaje de §3.3 para la IA, con lo de antes de cada cosa que cambio; null si no cambio nada.
 * opciones: pedido (lo que pidio el usuario), delUsuario (el guion lo escribio el usuario).
 */
export function textoTomasTocadas(k, { pedido = '', delUsuario = false } = {}) {
  if (!k?.hayCambios) return null;
  const que = [];
  if (k.tomas.length) que.push(k.tomas.length === 1 ? `la toma ${k.tomas[0]}` : `las tomas ${enLista(k.tomas)}`);
  if (k.broll.length) que.push(k.broll.length === 1 ? `el B-roll ${k.broll[0]}` : `los B-roll ${enLista(k.broll)}`);
  const porDonde = new Map();
  for (const l of k.lineas) porDonde.set(l.donde, [...(porDonde.get(l.donde) || []), l.n]);
  for (const [donde, ns] of porDonde) {
    const unicas = [...new Set(ns)];
    const de = donde === 'letra' || donde === 'texto' ? 'de la letra' : `de la letra de la ${donde}`;
    que.push(`${unicas.length === 1 ? `la línea ${unicas[0]}` : `las líneas ${enLista(unicas)}`} ${de}`);
  }
  if (k.otros.length) que.push(enLista(k.otros.map((c) => `\`${c}\``)));
  const [primero, ...resto] = que;
  let t = `Cambiaste ${primero}${resto.length ? ` (y ${enLista(resto)})` : ''}. El usuario pidió: «${String(pedido)}». Si alguna de esas no la pidió, déjala exactamente como estaba (te la copio abajo) con \`ediciones\`. Si todas eran parte del pedido, responde LISTO.`;
  if (delUsuario) t += '\nEl guion es del usuario: fuera de lo que pidió, no cambia ni una palabra de `linea`.';
  const bloques = [
    ...k.tomas.map((n) => bloqueAntes(`toma ${n}`, k.antes.tomas[n])),
    ...k.broll.map((n) => bloqueAntes(`B-roll ${n}`, k.antes.broll[n])),
    ...k.lineas.map((l) => bloqueAntes(`${l.donde === 'texto' ? 'letra' : l.donde}, línea ${l.n}`, l.antes)),
    ...k.otros.map((c) => bloqueAntes(c, k.antes.otros[c])),
  ];
  return `${t}\n\n${bloques.join('\n\n')}`;
}

// EL CLONADOR DE LANDINGS (2026-11-20q). Copia una landing TAL CUAL a partir de su URL y la deja lo más liviana posible:
// lo hace el código, sin IA (así ninguna IA se niega a copiar y no se cuela nada inventado).
//
//   1. La carga con su JavaScript (navegador.js: el HTML ya armado, con los carruseles y las imágenes perezosas).
//   2. Copia TODO lo que se ve: el HTML, cada hoja de estilos (en su orden, con sus @import, fuentes e imágenes de
//      fondo), cada imagen (src, srcset, data-src, <picture>, fondos en style=), los videos y sus portadas, los íconos.
//   3. Lo optimiza:
//      · imágenes en WebP y en 3 tamaños (480, 800 y 1200 px de ancho) con srcset (las de Shopify las pide así a su
//        CDN; las demás las convierte con ffmpeg si puede), con su ancho y alto (sin saltos al cargar), perezosas
//        (loading=lazy) salvo las primeras, y la principal con prioridad alta y precargada;
//      · fuera el JavaScript de la tienda, las apps, la analítica y los píxeles (lo que más pesa y frena); quedan los
//        datos estructurados (JSON-LD) y un JavaScript mínimo propio para los carruseles (flechas y puntos);
//      · los carruseles (Swiper, Slick, Flickity, Splide) quedan como filas que se deslizan con el dedo, sin las
//        copias que crea el carrusel para dar la vuelta;
//      · el CSS de todas las hojas en uno solo, sin las reglas que no usa la página, minificado y dentro del HTML;
//      · las fuentes con font-display:swap (el texto se ve enseguida);
//      · los enlaces y formularios relativos quedan apuntando a la tienda original (el botón de compra sigue andando).
//   4. Deja la landing en su carpeta: index.html + assets/ (y original.html, la página como vino).
//
//   clonarLanding({ url, carpeta, alAvanzar })  -> { titulo, pesos, imagenes, carruseles, avisos }
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { parse } from 'node-html-parser';
import { htmlArmado, AGENTE, rutaDelNavegador } from './navegador.js';

const ANCHOS = [240, 480, 800, 1200];
const ESPERA_MS = 30000;
const MAX_VIDEO = 25 * 1024 * 1024;
const PARALELO = 6;

// ---------------------------------------------------------------- utilidades

const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
const absoluta = (u, base) => {
  try {
    const x = String(u || '').trim();
    if (!x || /^(data|blob|javascript|mailto|tel):/i.test(x) || x.startsWith('#')) return null;
    return new URL(x.startsWith('//') ? `https:${x}` : x, base).href;
  } catch {
    return null;
  }
};
const esShopify = (u) => /\/cdn\/shop\/|cdn\.shopify\.com/i.test(u);

async function bajar(url, { accept = '*/*', tope = 40 * 1024 * 1024 } = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': AGENTE, Accept: accept }, redirect: 'follow', signal: AbortSignal.timeout(ESPERA_MS) });
  if (!r.ok) throw new Error(`${r.status} en ${url}`);
  const largo = Number(r.headers.get('content-length') || 0);
  if (largo > tope) throw Object.assign(new Error('demasiado grande'), { grande: true });
  return { bytes: Buffer.from(await r.arrayBuffer()), tipo: r.headers.get('content-type') || '' };
}

/** Corre de a `n` tareas a la vez. */
async function enParalelo(lista, n, fn) {
  const out = new Array(lista.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, lista.length) }, async () => {
      while (i < lista.length) {
        const k = i++;
        out[k] = await fn(lista[k], k);
      }
    }),
  );
  return out;
}

/** Ancho y alto de una imagen PNG, JPEG, GIF o WebP leyendo su cabecera. */
export function medidas(b) {
  try {
    if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (b.slice(0, 3).toString('latin1') === 'GIF') return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
    if (b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP') {
      const t = b.slice(12, 16).toString('latin1');
      if (t === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
      if (t === 'VP8L') {
        const v = b.readUInt32LE(21);
        return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 };
      }
      if (t === 'VP8X') return { w: (b.readUIntLE(24, 3) & 0xffffff) + 1, h: (b.readUIntLE(27, 3) & 0xffffff) + 1 };
    }
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i < b.length) {
        if (b[i] !== 0xff) return null;
        const m = b[i + 1];
        const largo = b.readUInt16BE(i + 2);
        if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
        i += 2 + largo;
      }
    }
  } catch {
    /* sin medidas */
  }
  return null;
}

function aWebp(ffmpeg, entrada, salida, ancho) {
  return new Promise((ok) => {
    const p = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', entrada, '-vf', `scale='min(${ancho},iw)':-2`, '-c:v', 'libwebp', '-quality', '78', '-frames:v', '1', salida], { windowsHide: true });
    p.on('close', (c) => ok(c === 0 && fs.existsSync(salida)));
    p.on('error', () => ok(false));
  });
}

// ---------------------------------------------------------------- el CSS: juntar, reescribir sus url() y podar

/** Separa un CSS en sus reglas de primer nivel (respeta llaves, textos y comentarios). */
function reglas(css) {
  const out = [];
  let i = 0;
  let inicio = 0;
  let prof = 0;
  let cabeza = -1;
  while (i < css.length) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') {
      const f = css.indexOf('*/', i + 2);
      i = f < 0 ? css.length : f + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== c) j += css[j] === '\\' ? 2 : 1;
      i = j + 1;
      continue;
    }
    if (c === '{') {
      if (prof === 0) cabeza = i;
      prof++;
    } else if (c === '}') {
      prof--;
      if (prof === 0) {
        out.push({ sel: css.slice(inicio, cabeza).trim(), cuerpo: css.slice(cabeza + 1, i), texto: css.slice(inicio, i + 1) });
        inicio = i + 1;
      }
      if (prof < 0) prof = 0;
    } else if (c === ';' && prof === 0) {
      const t = css.slice(inicio, i + 1).trim();
      if (t) out.push({ sel: null, texto: t });
      inicio = i + 1;
    }
    i++;
  }
  return out;
}

/** Quita del CSS las reglas cuyos selectores no aparecen en la página (clases e ids que no existen). */
/** Todos los selectores de estilo del CSS (para probarlos en el navegador). */
export function selectoresDe(css) {
  const out = new Set();
  const recorrer = (t) => {
    for (const r of reglas(t)) {
      if (!r.sel) continue;
      if (r.sel.startsWith('@')) {
        if (/^@(media|supports|layer|container|document)\b/i.test(r.sel)) recorrer(r.cuerpo);
        continue;
      }
      for (const x of r.sel.split(/,(?![^(]*\))/).map((y) => y.trim()).filter(Boolean)) out.add(x);
    }
  };
  recorrer(css);
  return [...out];
}

export function podarCss(css, usados) {
  const sirve = (sel) => {
    if (usados.selectores) return usados.selectores.has(sel);
    // lo que no se puede saber desde el HTML (estados, pseudoelementos) se ignora; con que sus clases e ids existan, vale
    const limpio = sel.replace(/:{1,2}[\w-]+(\((?:[^()]|\([^()]*\))*\))?/g, '').replace(/\[[^\]]*\]/g, '');
    const clases = limpio.match(/\.(-?[_a-zA-Z][\w-]*|\\[^\s])+/g) || [];
    const ids = limpio.match(/#-?[_a-zA-Z][\w-]*/g) || [];
    return clases.every((c) => usados.clases.has(c.slice(1).replace(/\\/g, ''))) && ids.every((x) => usados.ids.has(x.slice(1)));
  };
  const procesar = (texto) =>
    reglas(texto)
      .map((r) => {
        if (!r.sel) return r.texto;
        if (r.sel.startsWith('@')) {
          if (/^@(media|supports|layer|container|document)\b/i.test(r.sel)) {
            const dentro = procesar(r.cuerpo);
            return dentro.trim() ? `${r.sel}{${dentro}}` : '';
          }
          if (/^@font-face/i.test(r.sel)) return /font-display/i.test(r.cuerpo) ? r.texto : `${r.sel}{${r.cuerpo};font-display:swap}`;
          return r.texto; // @keyframes, @page, @property…
        }
        const sels = r.sel.split(/,(?![^(]*\))/).map((x) => x.trim()).filter(Boolean).filter(sirve);
        return sels.length ? `${sels.join(',')}{${r.cuerpo}}` : '';
      })
      .join('');
  return procesar(css);
}

// ---------------------------------------------------------------- medir la copia en el navegador

/**
 * Abre la copia en el navegador (con todo su CSS) a lo ancho de un celular y de un computador, y mide: el ancho con el
 * que se ve cada imagen (para su `sizes`) y qué selectores de CSS se usan de verdad (para podar exacto).
 * -> { anchos: { [i]: { movil, escritorio } }, selectores: Set } | null (sin navegador)
 */
async function medirEnNavegador(carpeta, html, selectores) {
  if (!rutaDelNavegador()) return null;
  const script = `<script>addEventListener('load',()=>{const sels=${JSON.stringify(selectores).replace(/</g, '\\u003c')};const est=/:(hover|focus|focus-visible|focus-within|active|visited|target|checked|disabled|enabled|placeholder-shown|invalid|valid|autofill|-webkit-[\\w-]+|-moz-[\\w-]+)(\\([^)]*\\))?/g;const usados=[];for(const s of sels){let x=s.replace(/::?(before|after|placeholder|selection|marker|backdrop|first-line|first-letter|file-selector-button|-webkit-[\\w-]+|-moz-[\\w-]+)(\\([^)]*\\))?/g,'').replace(est,'');if(!x.trim()||/^[>+~]|[>+~]\\s*$/.test(x.trim()))x='*';try{if(document.querySelector(x))usados.push(s)}catch(e){usados.push(s)}}const anchos={};document.querySelectorAll('img[data-kc]').forEach(i=>{anchos[i.dataset.kc]=Math.round(i.getBoundingClientRect().width)});const p=document.createElement('pre');p.id='kc-medidas';p.textContent=JSON.stringify({usados,anchos});document.body.appendChild(p)})</script>`;
  const archivo = path.join(carpeta, '_medir.html');
  fs.writeFileSync(archivo, html.replace(/<\/body>/i, `${script}</body>`));
  const leer = async (ancho, alto) => {
    const dom = await htmlArmado(`file://${archivo}`, { ancho, alto, espera: 6000, extra: ['--allow-file-access-from-files'] });
    const m = /<pre id="kc-medidas">([\s\S]*?)<\/pre>/.exec(dom || '');
    if (!m) return null;
    return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
  };
  const [movil, escritorio] = [await leer(412, 915), await leer(1366, 900)];
  fs.rmSync(archivo, { force: true });
  if (!movil && !escritorio) return null;
  const anchos = {};
  for (const k of new Set([...Object.keys(movil?.anchos || {}), ...Object.keys(escritorio?.anchos || {})])) anchos[k] = { movil: movil?.anchos?.[k] ?? null, escritorio: escritorio?.anchos?.[k] ?? null };
  return { anchos, selectores: new Set([...(movil?.usados || []), ...(escritorio?.usados || [])]) };
}

/** Un GIF animado como video (mucho más liviano): { mp4, poster } relativos, o null. */
function gifAVideo(ffmpeg, entrada, salidaSinExt) {
  return new Promise((ok) => {
    const mp4 = `${salidaSinExt}.mp4`;
    const p = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', entrada, '-movflags', '+faststart', '-pix_fmt', 'yuv420p', '-vf', "scale='trunc(min(800,iw)/2)*2':-2", '-c:v', 'libx264', '-crf', '28', '-an', mp4], { windowsHide: true });
    p.on('close', (c) => ok(c === 0 && fs.existsSync(mp4) ? mp4 : null));
    p.on('error', () => ok(null));
  });
}

// ---------------------------------------------------------------- clonar

export async function clonarLanding({ url, carpeta, alAvanzar = () => {}, ffmpeg = null }) {
  const assets = path.join(carpeta, 'assets');
  fs.mkdirSync(assets, { recursive: true });
  const avisos = [];
  alAvanzar('Cargando la página como la ve un celular…');
  let html = await htmlArmado(url);
  if (!html) {
    avisos.push('No encontré el navegador de la app: copié la página sin correr su JavaScript (algunos carruseles o imágenes pueden faltar).');
    html = (await bajar(url, { accept: 'text/html' })).bytes.toString('utf8');
  }
  fs.writeFileSync(path.join(carpeta, 'original.html'), html);
  const raiz = parse(html, { comment: false, blockTextElements: { script: true, noscript: true, style: true, pre: true, textarea: true } });
  const origen = new URL(url).origin;
  const titulo = raiz.querySelector('title')?.text?.trim() || new URL(url).pathname;

  // ------------------------------------------------ fuera lo que no se ve y pesa
  alAvanzar('Quitando el JavaScript de la tienda, las apps y los píxeles…');
  let scripts = 0;
  for (const s of raiz.querySelectorAll('script')) {
    if (/ld\+json/i.test(s.getAttribute('type') || '')) continue;
    scripts++;
    s.remove();
  }
  for (const n of raiz.querySelectorAll('noscript')) n.remove();
  for (const l of raiz.querySelectorAll('link')) {
    const rel = (l.getAttribute('rel') || '').toLowerCase();
    if (/preload|prefetch|preconnect|dns-prefetch|modulepreload|manifest/.test(rel)) l.remove();
  }
  for (const f of raiz.querySelectorAll('iframe')) {
    const src = f.getAttribute('src') || '';
    const oculto = /display:\s*none|visibility:\s*hidden/i.test(f.getAttribute('style') || '') || f.getAttribute('aria-hidden') === 'true' || /web-pixel|about:blank/i.test(src + (f.getAttribute('name') || '') + (f.getAttribute('id') || ''));
    if (oculto || !src) f.remove();
    else f.setAttribute('loading', 'lazy');
  }
  // el aviso de cookies/privacidad de Shopify y los contenedores de píxeles
  for (const sel of ['#shopify-pc__banner', '#shopify-pc__prefs', '#web-pixels-manager-sandbox-container', '#shopify-privacy-banner']) for (const n of raiz.querySelectorAll(sel)) n.remove();

  // ------------------------------------------------ los recursos: una sola descarga por URL
  const hechos = new Map(); // url -> Promise<{ rel, w, h, variantes? }>
  const guardar = (nombre, bytes) => {
    fs.writeFileSync(path.join(assets, nombre), bytes);
    return `assets/${nombre}`;
  };
  const pesos = { imagenes: 0, fuentes: 0, videos: 0, css: 0, html: 0 };

  /** Una imagen en WebP y en sus tamaños: { src, srcset, w, h } (o null si no se pudo). */
  const imagen = (u) => {
    if (hechos.has(u)) return hechos.get(u);
    const p = (async () => {
      try {
        const nombre = hash(u);
        if (ffmpeg && /\.gif(\?|$)/i.test(u)) {
          // un GIF animado: como video (un GIF de 3 MB queda en unos 200 KB)
          const { bytes } = await bajar(u, { accept: 'image/gif,*/*;q=0.5' });
          const crudo = path.join(assets, `${nombre}.gif`);
          fs.writeFileSync(crudo, bytes);
          const mp4 = bytes.length > 60000 ? await gifAVideo(ffmpeg, crudo, path.join(assets, nombre)) : null;
          if (mp4 && fs.statSync(mp4).size < bytes.length) {
            fs.rmSync(crudo, { force: true });
            const m = medidas(bytes);
            pesos.imagenes += fs.statSync(mp4).size;
            return { src: `assets/${path.basename(mp4)}`, video: true, w: m?.w || null, h: m?.h || null };
          }
          pesos.imagenes += bytes.length;
          const m = medidas(bytes);
          return { src: `assets/${nombre}.gif`, srcset: null, w: m?.w || null, h: m?.h || null };
        }
        if (esShopify(u) && !/\.svg(\?|$)/i.test(u)) {
          const limpio = new URL(u);
          for (const k of ['width', 'height', 'crop']) limpio.searchParams.delete(k);
          const variantes = [];
          for (const a of ANCHOS) {
            const v = new URL(limpio.href);
            v.searchParams.set('width', String(a));
            const { bytes, tipo } = await bajar(v.href, { accept: 'image/avif;q=0,image/webp,image/*,*/*;q=0.8' });
            const m = medidas(bytes);
            // si la original es más chica que este ancho, Shopify devuelve la misma: no se repite
            if (variantes.length && m && m.w <= variantes.at(-1).w) break;
            const ext = /webp/.test(tipo) ? 'webp' : /png/.test(tipo) ? 'png' : /gif/.test(tipo) ? 'gif' : 'jpg';
            const rel = guardar(`${nombre}-${a}.${ext}`, bytes);
            pesos.imagenes += bytes.length;
            variantes.push({ rel, w: m?.w || a, h: m?.h || null });
          }
          if (!variantes.length) return null;
          const medio = variantes.find((v) => v.w >= 800) || variantes.at(-1);
          const mayor = variantes.at(-1);
          return { src: medio.rel, srcset: variantes.length > 1 ? variantes.map((v) => `${v.rel} ${v.w}w`).join(', ') : null, w: mayor.w, h: mayor.h };
        }
        const { bytes, tipo } = await bajar(u, { accept: 'image/webp,image/*,*/*;q=0.8' });
        const svg = /svg/.test(tipo) || /\.svg(\?|$)/i.test(u);
        const ext = svg ? 'svg' : /webp/.test(tipo) ? 'webp' : /png/.test(tipo) ? 'png' : /gif/.test(tipo) ? 'gif' : /avif/.test(tipo) ? 'avif' : 'jpg';
        const crudo = path.join(assets, `${nombre}.${ext}`);
        fs.writeFileSync(crudo, bytes);
        let rel = `assets/${nombre}.${ext}`;
        let final = bytes;
        if (!svg && ext !== 'gif' && ext !== 'webp' && ffmpeg && bytes.length > 30000) {
          const salida = path.join(assets, `${nombre}.webp`);
          if ((await aWebp(ffmpeg, crudo, salida, 1200)) && fs.statSync(salida).size < bytes.length) {
            fs.rmSync(crudo, { force: true });
            rel = `assets/${nombre}.webp`;
            final = fs.readFileSync(salida);
          } else fs.rmSync(salida, { force: true });
        }
        pesos.imagenes += final.length;
        const m = svg ? null : medidas(final);
        return { src: rel, srcset: null, w: m?.w || null, h: m?.h || null };
      } catch (e) {
        avisos.push(`No pude copiar una imagen (${String(e.message).slice(0, 120)}).`);
        return null;
      }
    })();
    hechos.set(u, p);
    return p;
  };
  /** Un archivo cualquiera (fuente, video, ícono): su ruta local, o null (queda la URL original). */
  const archivo = (u, tipo = 'otro') => {
    const clave = `a:${u}`;
    if (hechos.has(clave)) return hechos.get(clave);
    const p = (async () => {
      try {
        const ext = (path.extname(new URL(u).pathname).slice(1) || 'bin').toLowerCase().slice(0, 6);
        const { bytes } = await bajar(u, { tope: tipo === 'video' ? MAX_VIDEO : 40 * 1024 * 1024 });
        if (tipo === 'video') pesos.videos += bytes.length;
        else pesos.fuentes += bytes.length;
        return guardar(`${hash(u)}.${ext}`, bytes);
      } catch (e) {
        if (!e.grande) avisos.push(`No pude copiar un archivo (${String(e.message).slice(0, 120)}).`);
        return null;
      }
    })();
    hechos.set(clave, p);
    return p;
  };

  // ------------------------------------------------ el CSS (en su orden), con sus url() locales
  alAvanzar('Copiando los estilos, las fuentes y los fondos…');
  const hojas = [];
  const traerCss = async (u, prof = 0) => {
    try {
      const texto = (await bajar(u, { accept: 'text/css,*/*;q=0.1' })).bytes.toString('utf8');
      return await resolverCss(texto, u, prof);
    } catch (e) {
      avisos.push(`No pude copiar una hoja de estilos (${String(e.message).slice(0, 120)}).`);
      return '';
    }
  };
  const resolverCss = async (css, base, prof = 0) => {
    // los @import, adentro
    const imports = [...css.matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+)['"]?\s*\)?[^;]*;/gi)];
    for (const m of imports) {
      const u = absoluta(m[1], base);
      css = css.replace(m[0], u && prof < 3 ? await traerCss(u, prof + 1) : '');
    }
    const urls = [...new Set([...css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)].map((m) => m[2]))];
    const locales = await enParalelo(urls, PARALELO, async (x) => {
      const u = absoluta(x, base);
      if (!u) return null;
      if (/\.(woff2?|ttf|otf|eot)(\?|#|$)/i.test(u)) return archivo(u, 'fuente');
      const r = await imagen(u);
      return r?.src || null;
    });
    urls.forEach((x, k) => {
      if (!locales[k]) return;
      css = css.split(`url(${x})`).join(`url(${locales[k]})`).split(`url("${x}")`).join(`url("${locales[k]}")`).split(`url('${x}')`).join(`url('${locales[k]}')`);
    });
    return css;
  };
  const nodosCss = raiz.querySelectorAll('link, style').filter((n) => n.tagName === 'STYLE' || /stylesheet/i.test(n.getAttribute('rel') || ''));
  for (const n of nodosCss) {
    if (n.tagName === 'STYLE') hojas.push({ media: n.getAttribute('media'), css: resolverCss(n.innerHTML, url) });
    else {
      const u = absoluta(n.getAttribute('href'), url);
      if (u) hojas.push({ media: n.getAttribute('media'), css: traerCss(u) });
    }
    n.remove();
  }
  let css = '';
  for (const h of hojas) {
    const t = await h.css;
    css += h.media && !/^(all|screen)$/i.test(h.media) ? `@media ${h.media}{${t}}` : t;
  }

  // ------------------------------------------------ las imágenes del HTML
  alAvanzar('Copiando las imágenes en WebP y en sus tamaños…');
  const elegirDeSrcset = (srcset) => {
    const c = String(srcset || '')
      .split(/,\s+(?=\S)/)
      .map((x) => x.trim().split(/\s+/))
      .filter((x) => x[0]);
    if (!c.length) return null;
    const ancho = (x) => Number(String(x[1] || '').replace(/w$/, '')) || 0;
    return c.sort((a, b) => ancho(b) - ancho(a))[0][0];
  };
  const imgs = raiz.querySelectorAll('img');
  let orden = 0;
  let lcp = null;
  await enParalelo(imgs, PARALELO, async (img) => {
    const cand = img.getAttribute('data-src') || elegirDeSrcset(img.getAttribute('data-srcset')) || elegirDeSrcset(img.getAttribute('srcset')) || img.getAttribute('src');
    const u = absoluta(cand, url);
    if (!u) return;
    const r = await imagen(u);
    if (!r) {
      img.setAttribute('src', u);
      return;
    }
    if (r.video) {
      const atributos = Object.entries(img.attributes).filter(([k]) => !/^(src|srcset|sizes|loading|decoding|fetchpriority|data-src|data-srcset|alt)$/i.test(k)).map(([k, v]) => ` ${k}="${String(v).replace(/"/g, '&quot;')}"`).join('');
      img.replaceWith(parse(`<video src="${r.src}" autoplay muted loop playsinline preload="metadata"${r.w && r.h ? ` width="${r.w}" height="${r.h}"` : ''}${atributos} aria-label="${(img.getAttribute('alt') || '').replace(/"/g, '&quot;')}"></video>`));
      return;
    }
    img.setAttribute('src', r.src);
    if (r.srcset) {
      img.setAttribute('srcset', r.srcset);
      if (!img.getAttribute('sizes') || /auto/i.test(img.getAttribute('sizes'))) img.setAttribute('sizes', '(min-width: 990px) 50vw, 100vw');
    } else img.removeAttribute('srcset');
    for (const a of ['data-src', 'data-srcset', 'data-sizes', 'data-widths']) img.removeAttribute(a);
    if (r.w && r.h && !img.getAttribute('width')) {
      img.setAttribute('width', String(r.w));
      img.setAttribute('height', String(r.h));
    }
    img.classList?.remove('lazyload');
  });
  // las primeras se cargan enseguida; la primera grande, con prioridad; el resto, perezosas
  for (const img of imgs) {
    if (!img.getAttribute('src')) continue;
    const w = Number(img.getAttribute('width') || 0);
    orden++;
    if (orden <= 3) {
      img.setAttribute('loading', 'eager');
      if (!lcp && w >= 300) {
        lcp = img;
        img.setAttribute('fetchpriority', 'high');
      }
    } else {
      img.setAttribute('loading', 'lazy');
      img.removeAttribute('fetchpriority');
    }
    img.setAttribute('decoding', 'async');
  }
  for (const s of raiz.querySelectorAll('source')) {
    const ss = s.getAttribute('srcset') || s.getAttribute('data-srcset');
    if (!ss || s.parentNode?.tagName === 'VIDEO' || s.parentNode?.tagName === 'AUDIO') continue;
    const u = absoluta(elegirDeSrcset(ss), url);
    const r = u ? await imagen(u) : null;
    if (r) {
      s.setAttribute('srcset', r.srcset || r.src);
      s.removeAttribute('data-srcset');
      s.removeAttribute('type');
    }
  }
  // fondos en style=
  for (const n of raiz.querySelectorAll('[style]')) {
    let st = n.getAttribute('style');
    for (const m of [...st.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)]) {
      const u = absoluta(m[2].replace(/&quot;/g, ''), url);
      const r = u ? await imagen(u) : null;
      if (r) st = st.replace(m[0], `url(${r.src})`);
    }
    n.setAttribute('style', st);
  }
  // los videos y sus portadas
  alAvanzar('Copiando los videos…');
  for (const v of raiz.querySelectorAll('video')) {
    const poster = absoluta(v.getAttribute('poster'), url);
    if (poster) {
      const r = await imagen(poster);
      if (r) v.setAttribute('poster', r.src);
    }
    for (const n of [v, ...v.querySelectorAll('source')]) {
      const propio = n.getAttribute('src') || n.getAttribute('data-src');
      if (/^assets\//.test(propio || '')) continue; // (un GIF que ya pasó a video)
      const u = absoluta(propio, url);
      if (!u) continue;
      const local = await archivo(u, 'video');
      n.setAttribute('src', local || u);
      n.removeAttribute('data-src');
    }
    if (!v.hasAttribute('autoplay')) v.setAttribute('preload', 'none');
  }
  // los íconos de la pestaña
  for (const l of raiz.querySelectorAll('link')) {
    if (!/icon/i.test(l.getAttribute('rel') || '')) continue;
    const u = absoluta(l.getAttribute('href'), url);
    const r = u ? await imagen(u) : null;
    if (r) l.setAttribute('href', r.src);
  }

  // ------------------------------------------------ los carruseles: filas que se deslizan, sin las copias
  let carruseles = 0;
  for (const n of raiz.querySelectorAll('.swiper-slide-duplicate, .slick-cloned, .splide__slide--clone, .is-cloned')) n.remove();
  for (const w of raiz.querySelectorAll('.swiper-wrapper, .slick-track, .flickity-slider, .splide__list, .glide__slides, .owl-stage')) {
    carruseles++;
    const st = (w.getAttribute('style') || '').replace(/(transform|transition-duration|transition|width)\s*:[^;]*;?/gi, '');
    w.setAttribute('style', st);
    w.classList.add('kc-carrusel');
  }
  // lo que el carrusel escondía hasta arrancar («--pending», «is-loading»): ya está armado
  for (const n of raiz.querySelectorAll('[class]')) {
    const cl = (n.getAttribute('class') || '').split(/\s+/);
    const fuera = cl.filter((c) => /--pending$|^is-loading$|^swiper-lock$/.test(c));
    if (fuera.length) n.setAttribute('class', cl.filter((c) => !fuera.includes(c)).join(' '));
  }

  // ------------------------------------------------ enlaces y formularios a la tienda original
  for (const a of raiz.querySelectorAll('a[href]')) {
    const h = a.getAttribute('href');
    if (h && !h.startsWith('#')) a.setAttribute('href', absoluta(h, url) || h);
  }
  for (const f of raiz.querySelectorAll('form')) f.setAttribute('action', absoluta(f.getAttribute('action') || url, url) || origen);

  // ------------------------------------------------ medir la copia (anchos de las imágenes y CSS que se usa de verdad)
  alAvanzar('Midiendo cómo se ve en celular y en computador…');
  const vivas = raiz.querySelectorAll('img').filter((i) => i.getAttribute('src'));
  vivas.forEach((i, k) => i.setAttribute('data-kc', String(k)));
  const conCss = `<!doctype html>\n${(raiz.querySelector('html')?.outerHTML || raiz.toString()).replace(/<\/head>/i, `<style>${css}</style></head>`)}`;
  const medido = await medirEnNavegador(carpeta, conCss, selectoresDe(css));
  if (medido) {
    vivas.forEach((img, k) => {
      const a = medido.anchos[k];
      img.removeAttribute('data-kc');
      if (!a) return;
      // no se ve en ninguno de los dos: perezosa (no se baja hasta que haga falta)
      if (!a.movil && !a.escritorio) {
        img.setAttribute('loading', 'lazy');
        img.removeAttribute('fetchpriority');
        return;
      }
      if (img.getAttribute('srcset')) img.setAttribute('sizes', `(max-width: 749px) ${Math.max(1, a.movil || a.escritorio)}px, ${Math.max(1, a.escritorio || a.movil)}px`);
    });
  } else {
    vivas.forEach((i) => i.removeAttribute('data-kc'));
    avisos.push('No pude medir la copia en el navegador: el CSS se podó por nombres de clase (menos exacto).');
  }

  // ------------------------------------------------ el CSS final: podado, minificado y dentro del HTML
  alAvanzar('Dejando solo el CSS que usa la página…');
  const usados = { clases: new Set(['kc-carrusel']), ids: new Set(), selectores: medido?.selectores || null };
  for (const n of raiz.querySelectorAll('[class]')) for (const c of (n.getAttribute('class') || '').split(/\s+/)) if (c) usados.clases.add(c);
  for (const n of raiz.querySelectorAll('[id]')) usados.ids.add(n.getAttribute('id'));
  const antes = Buffer.byteLength(css);
  let podado = podarCss(css, usados);
  try {
    const { transform } = await import('esbuild');
    podado = (await transform(podado, { loader: 'css', minify: true, logLevel: 'silent' })).code;
  } catch {
    avisos.push('No pude minificar el CSS (quedó sin comprimir, pero sin las reglas que no se usan).');
  }
  const propio = `.kc-carrusel{display:flex!important;flex-wrap:nowrap!important;overflow-x:auto!important;scroll-snap-type:x mandatory;scroll-behavior:smooth;scrollbar-width:none;-webkit-overflow-scrolling:touch;transform:none!important}.kc-carrusel::-webkit-scrollbar{display:none}.kc-carrusel>*{flex-shrink:0;scroll-snap-align:start}`;
  pesos.css = Buffer.byteLength(podado);
  const cabeza = raiz.querySelector('head');
  if (!cabeza.querySelector('meta[name="viewport"]')) cabeza.insertAdjacentHTML('afterbegin', '<meta name="viewport" content="width=device-width,initial-scale=1">');
  if (!cabeza.querySelector('meta[charset]')) cabeza.insertAdjacentHTML('afterbegin', '<meta charset="utf-8">');
  if (lcp) {
    const ss = lcp.getAttribute('srcset');
    cabeza.insertAdjacentHTML('beforeend', `<link rel="preload" as="image" href="${lcp.getAttribute('src')}"${ss ? ` imagesrcset="${ss}" imagesizes="${lcp.getAttribute('sizes') || '100vw'}"` : ''} fetchpriority="high">`);
  }
  cabeza.insertAdjacentHTML('beforeend', `<style>${podado}${propio}</style>`);
  // el JavaScript mínimo de los carruseles: flechas y puntos mueven la fila (≈1 KB, al final)
  const js = `<script>(()=>{const fila=e=>{const c=e.closest('.swiper,.slick-slider,.flickity-enabled,.splide,.glide,.owl-carousel,[class*=carousel],[class*=slider]');return c&&c.querySelector('.kc-carrusel')};const paso=f=>{const s=f.children[0];return s?s.getBoundingClientRect().width+parseFloat(getComputedStyle(f).columnGap||0):f.clientWidth};document.addEventListener('click',e=>{const b=e.target.closest('[class*=next],[class*=prev],[class*=bullet],[class*=dot]');if(!b)return;const f=fila(b);if(!f)return;e.preventDefault();const cl=b.className+'';if(/next/.test(cl))f.scrollBy({left:paso(f)});else if(/prev/.test(cl))f.scrollBy({left:-paso(f)});else{const k=[...b.parentNode.children].indexOf(b);f.scrollTo({left:k*paso(f)})}});})();</script>`;
  raiz.querySelector('body')?.insertAdjacentHTML('beforeend', js);

  let salida = `<!doctype html>\n${raiz.querySelector('html')?.outerHTML || raiz.toString()}`;
  salida = salida.replace(/<!--[\s\S]*?-->/g, '');
  fs.writeFileSync(path.join(carpeta, 'index.html'), salida);
  pesos.html = Buffer.byteLength(salida);
  return { titulo, pesos, cssAntes: antes, imagenes: [...hechos.keys()].filter((k) => !k.startsWith('a:')).length, carruseles, scripts, avisos: [...new Set(avisos)].slice(0, 20) };
}

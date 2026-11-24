// Los TRABAJOS en tus tiendas de Shopify (2026-11-20r).
//
// 1. «Pídele a la IA» (tipo 'tema'): eliges la tienda y el tema, escribes lo que quieres («cambia el botón de comprar a
//    verde y que diga Pídelo ya», «agrega una sección de preguntas frecuentes al producto»…) y la IA que elijas (Claude
//    Code o Codex) EDITA EL CÓDIGO del tema (Liquid, CSS, JS, JSON) en una copia local. La app lo sube como un TEMA NUEVO
//    SIN PUBLICAR (tu tienda no cambia hasta que tú lo publicas), con su vista previa. Si la tienda tiene acceso
//    completo, la IA también puede proponer cambios por la API de administración (páginas, productos, colecciones…):
//    quedan esperando tu «Aplicar».
// 2. «Subir una landing» (tipo 'landing'): una landing de Crear › Landings pasa a tu tienda como plantilla de página
//    (templates/page.kads-<id>.liquid + sus imágenes en assets/, en el tema publicado, sin tocar nada más) y como
//    portada alternativa (index.kads-<id>) para la VISTA PREVIA (/?view=kads-<id>) antes de nada (2026-11-24). Con
//    «Publicar» y acceso completo, crea la página y la deja publicada en /pages/<dirección>.
//
// Todo vive en temp/_shopify/trabajos/<id>/ (trabajo.json, tema/, subir/, resumen.json, registro-ia.log).
//
//   listarTrabajos() · leerTrabajo(id) · borrarTrabajo(id)
//   crearTrabajo({ tiendaId, temaId, pedido, motor }) · publicarTrabajo(id) · descartarTema(id)
//   aplicarAdmin(id, indice) · subirLanding({ landingId, tiendaId, titulo, direccion, producto })
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { TEMP, RAIZ } from '../rutas.js';
import { leerJSON } from '../archivos.js';
import { escribirJSON, ErrorApp } from '../productos.js';
import { tiendaConClave, listarTiendas } from './tiendas.js';
import * as api from './api.js';

const DIR = path.join(TEMP, '_shopify', 'trabajos');
const RE_ID = /^[a-z0-9-]{3,80}$/;
const enCurso = new Set();
const MOTORES = ['claude', 'codex'];

const carpetaDe = (id) => {
  if (!RE_ID.test(String(id || ''))) throw new ErrorApp(404, 'No encuentro ese trabajo.');
  return path.join(DIR, id);
};
const archivoDe = (id) => path.join(carpetaDe(id), 'trabajo.json');
export function leerTrabajo(id) {
  const t = leerJSON(archivoDe(id));
  if (!t) throw new ErrorApp(404, 'No encuentro ese trabajo.');
  return { ...t, trabajando: enCurso.has(id) };
}
const guardar = (id, cambios) => {
  const t = { ...(leerJSON(archivoDe(id)) || {}), ...cambios, actualizado: new Date().toISOString() };
  escribirJSON(archivoDe(id), t);
  return t;
};
const avanzar = (id, texto) => {
  const t = leerJSON(archivoDe(id)) || {};
  guardar(id, { progreso: [...(t.progreso || []), texto].slice(-14) });
};

export function listarTrabajos() {
  if (!fs.existsSync(DIR)) return { trabajos: [] };
  const trabajos = fs
    .readdirSync(DIR)
    .filter((d) => RE_ID.test(d))
    .map((d) => leerJSON(path.join(DIR, d, 'trabajo.json')))
    .filter(Boolean)
    .map((t) => ({ ...t, trabajando: enCurso.has(t.id) }))
    .sort((a, b) => String(b.creado).localeCompare(String(a.creado)));
  return { trabajos };
}

export function borrarTrabajo(id) {
  if (enCurso.has(id)) throw new ErrorApp(409, 'Ese trabajo sigue en curso: espera a que termine.');
  fs.rmSync(carpetaDe(id), { recursive: true, force: true });
  return listarTrabajos();
}

function nuevoId(base) {
  const limpio = String(base || 'trabajo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'trabajo';
  return `${limpio}-${crypto.randomBytes(3).toString('hex')}`;
}

/** Corre de fondo y deja el error a la vista. */
function deFondo(id, fn) {
  enCurso.add(id);
  (async () => {
    try {
      await fn();
    } catch (e) {
      console.error('[shopify]', id, e?.message || e);
      guardar(id, { estado: 'error', error: e?.publico || e?.message || 'Algo falló con Shopify.' });
    } finally {
      enCurso.delete(id);
    }
  })();
}

// ---------------------------------------------------------------- los archivos del tema

function archivosDe(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) archivosDe(p, base, out);
    else out.push(path.relative(base, p).replace(/\\/g, '/'));
  }
  return out;
}
const huellas = (dir) => Object.fromEntries(archivosDe(dir).map((f) => [f, crypto.createHash('sha1').update(fs.readFileSync(path.join(dir, f))).digest('hex')]));
const ES_TEXTO = /\.(liquid|json|css|scss|js|svg|txt|md)$/i;

/** Para la IA sin herramientas (Codex): los archivos que más tienen que ver con el pedido van pegados; el resto, a pedido. */
function elegirParaCodex(dir, pedido) {
  const palabras = [...new Set(String(pedido).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter((p) => p.length > 3))];
  const todos = archivosDe(dir).filter((f) => ES_TEXTO.test(f));
  const puntos = todos.map((f) => {
    let p = /^(layout\/theme\.liquid|templates\/(index|product)\.json|config\/settings_schema\.json)$/.test(f) ? 3 : 0;
    const texto = fs.statSync(path.join(dir, f)).size < 400000 ? fs.readFileSync(path.join(dir, f), 'utf8').toLowerCase() : '';
    for (const w of palabras) {
      if (f.toLowerCase().includes(w)) p += 5;
      if (texto.includes(w)) p += 1;
    }
    return [f, p];
  });
  const elegidos = [];
  let peso = 0;
  for (const [f, p] of puntos.sort((a, b) => b[1] - a[1])) {
    if (p <= 0 || elegidos.length >= 14) break;
    const s = fs.statSync(path.join(dir, f)).size;
    if (peso + s > 350000) continue;
    elegidos.push(f);
    peso += s;
  }
  return { elegidos, resto: todos.filter((f) => !elegidos.includes(f)) };
}

// ---------------------------------------------------------------- 1. pídele a la IA

export async function crearTrabajo({ tiendaId, temaId, pedido, motor = 'claude' } = {}) {
  const tienda = tiendaConClave(tiendaId);
  const p = String(pedido || '').trim();
  if (p.length < 4) throw new ErrorApp(400, 'Escribe qué quieres que cambie en la tienda.');
  if (!MOTORES.includes(motor)) throw new ErrorApp(400, 'Elige Claude Code o Codex.');
  const id = nuevoId(`${tienda.nombre}-${p.slice(0, 24)}`);
  fs.mkdirSync(carpetaDe(id), { recursive: true });
  guardar(id, { id, tipo: 'tema', tiendaId: tienda.id, tiendaNombre: tienda.nombre, dominio: tienda.dominio, temaId: temaId ? String(temaId) : null, temaNombre: null, pedido: p.slice(0, 4000), motor, creado: new Date().toISOString(), estado: 'trabajando', progreso: [], error: null, resumen: null, archivos: [], nuevoTema: null, admin: [] });
  deFondo(id, () => trabajarTema(id));
  return leerTrabajo(id);
}

async function trabajarTema(id) {
  const t = leerTrabajo(id);
  const tienda = tiendaConClave(t.tiendaId);
  const carpeta = carpetaDe(id);
  const dirTema = path.join(carpeta, 'tema');
  avanzar(id, 'Preparando Shopify CLI…');
  await api.asegurarCli();
  avanzar(id, 'Viendo los temas de la tienda…');
  const lista = await api.temas(tienda);
  const tema = (t.temaId && lista.find((x) => x.id === t.temaId)) || lista.find((x) => x.rol === 'live' || x.rol === 'main') || lista[0];
  if (!tema) throw new Error('La tienda no tiene temas.');
  guardar(id, { temaId: tema.id, temaNombre: tema.nombre });
  avanzar(id, `Bajando el código del tema «${tema.nombre}»…`);
  await api.bajarTema(tienda, tema.id, dirTema);
  const antes = huellas(dirTema);
  const rel = (f) => path.relative(RAIZ, path.join(carpeta, f)).replace(/\\/g, '/');
  // lo que la IA sabe de la tienda (con acceso completo: sus productos y páginas)
  let datosTienda = '';
  if (tienda.tipo === 'completo') {
    try {
      const d = await api.admin(tienda, '{ shop { name currencyCode primaryDomain { url } } products(first: 40, sortKey: UPDATED_AT, reverse: true) { nodes { title handle status } } pages(first: 30) { nodes { title handle templateSuffix } } }');
      datosTienda = `La tienda: ${d.shop.name} (${d.shop.primaryDomain?.url}, moneda ${d.shop.currencyCode}).\nProductos (título | dirección | estado):\n${d.products.nodes.map((x) => `${x.title} | ${x.handle} | ${x.status}`).join('\n')}\nPáginas (título | dirección | plantilla):\n${d.pages.nodes.map((x) => `${x.title} | ${x.handle} | ${x.templateSuffix || '-'}`).join('\n')}`;
    } catch (e) {
      datosTienda = `(No pude leer los datos de la tienda: ${e.message})`;
    }
  }
  const archivos = archivosDe(dirTema);
  const listaArchivos = archivos.map((f) => `${f}\t${fs.statSync(path.join(dirTema, f)).size}`).join('\n');
  const prompt = `TAREA: tienda shopify. Te ejecuta la app Kads Studio, sin chat ni terminal: trabajas sobre archivos con tus herramientas.

El usuario te pide, sobre su tienda de Shopify «${tienda.nombre}» (${tienda.dominio}), tema «${tema.nombre}»:
«${t.pedido}»

El CÓDIGO COMPLETO del tema está en ${rel('tema')}/ (Online Store 2.0: layout/, sections/, snippets/, templates/ *.json, assets/, config/, locales/). Archivos (ruta<TAB>bytes):
${listaArchivos}
${datosTienda ? `\n${datosTienda}\n` : ''}
1. Haz el cambio editando los archivos de ${rel('tema')}/ (Edit o Write). Liquid y JSON tienen que quedar VÁLIDOS (un JSON roto o un {% if %} sin cerrar rompe la tienda). Cambia lo mínimo necesario y respeta el estilo del tema. Si agregas una sección, que tenga su {% schema %} y que se pueda editar desde el editor de temas. Los textos visibles van en el idioma de la tienda. No borres archivos ni toques config/settings_data.json salvo que el pedido lo necesite.
2. Escribe ${rel('resumen.json')} con { "resumen": "<qué hiciste, en 1 a 3 frases sencillas para alguien que no programa>", "admin": [ ] }.${
    tienda.tipo === 'completo'
      ? ` Si el pedido necesita algo que NO es del tema (crear o cambiar una página, un producto, una colección, un menú, un descuento…), pon en "admin" cada operación de la API GraphQL de administración de Shopify (versión ${api.VERSION_API}): { "titulo": "<qué hace, en sencillo>", "query": "<la mutación GraphQL>", "variables": { … } }. La app NO las corre sola: el usuario las ve y las aprueba una por una.`
      : ' Esta tienda está conectada solo para temas: deja "admin" vacío y, si el pedido necesita otra cosa, dilo en el resumen.'
  }
Tu respuesta final: solo LISTO.`;
  const { lanzarSesion, prohibidasComunes } = await import('../motor-ia.js');
  avanzar(id, `${t.motor === 'codex' ? 'Codex' : 'Claude Code'} está editando el código del tema…`);
  const paraCodex = t.motor === 'codex' ? elegirParaCodex(dirTema, t.pedido) : null;
  const r = await lanzarSesion({
    tipo: 'guion',
    motor: t.motor,
    uuid: crypto.randomUUID(),
    prompt,
    herramientas: ['Read', 'Glob', 'Grep', 'Write', 'Edit'],
    permitidas: [`Read(./${rel('tema')}/**)`, `Edit(./${rel('tema')}/**)`, `Write(./${rel('tema')}/**)`, `Write(./${rel('resumen.json')})`, `Edit(./${rel('resumen.json')})`, 'Glob', 'Grep'],
    prohibidas: prohibidasComunes({ terminal: false }),
    material: paraCodex ? { textos: paraCodex.elegidos.map((f) => `${rel('tema')}/${f}`), aPedido: paraCodex.resto.map((f) => `${rel('tema')}/${f}`) } : undefined,
    registro: path.join(carpeta, 'registro-ia.log'),
    timeoutMs: 30 * 60000,
    maxTurnos: 60,
    verificar: async () => {
      const malos = [];
      for (const [f, h] of Object.entries(huellas(dirTema))) {
        if (antes[f] === h || !/\.json$/i.test(f)) continue;
        try {
          JSON.parse(fs.readFileSync(path.join(dirTema, f), 'utf8').replace(/^\s*\/\*[\s\S]*?\*\//, ''));
        } catch {
          malos.push(`${rel('tema')}/${f} no es un JSON válido: arréglalo.`);
        }
      }
      if (!leerJSON(path.join(carpeta, 'resumen.json'))) malos.push(`Escribe ${rel('resumen.json')}.`);
      return malos.length ? { ok: false, errores: malos } : { ok: true };
    },
  });
  const resumen = leerJSON(path.join(carpeta, 'resumen.json'));
  if (!resumen) throw Object.assign(new Error('ia'), { publico: r?.sinMotor || r?.sinClaude ? 'Esa IA no está lista: conéctala en Ajustes › Conexiones.' : r?.limite ? 'Se acabó el uso de tu plan de IA por ahora. Vuelve a intentar cuando se renueve.' : 'La IA no terminó el cambio. Vuelve a intentar.' });
  const despues = huellas(dirTema);
  const cambiados = Object.keys(despues).filter((f) => antes[f] !== despues[f]);
  const borrados = Object.keys(antes).filter((f) => !(f in despues));
  const admin = (Array.isArray(resumen.admin) ? resumen.admin : []).filter((a) => a && typeof a.query === 'string' && a.query.trim()).slice(0, 10).map((a) => ({ titulo: String(a.titulo || 'Cambio en la tienda').slice(0, 200), query: a.query.slice(0, 20000), variables: a.variables && typeof a.variables === 'object' ? a.variables : {}, estado: 'pendiente', resultado: null }));
  guardar(id, { resumen: String(resumen.resumen || '').slice(0, 2000), archivos: [...cambiados, ...borrados.map((f) => `${f} (borrado)`)], admin: tienda.tipo === 'completo' ? admin : [] });
  if (cambiados.length || borrados.length) {
    const nombre = `Kads · ${t.pedido.replace(/\s+/g, ' ').slice(0, 24)} · ${new Date().toISOString().slice(5, 16).replace('T', ' ')}`;
    avanzar(id, `Subiendo el tema con ${cambiados.length + borrados.length} archivo(s) cambiado(s) como tema nuevo SIN publicar…`);
    const nuevo = await api.subirTema(tienda, dirTema, { nombre });
    guardar(id, { nuevoTema: nuevo });
    avanzar(id, 'Listo: revisa la vista previa y, si te gusta, publícalo.');
  } else avanzar(id, admin.length ? 'Listo: no cambió el tema; revisa los cambios que propone en la tienda.' : 'Listo: no hizo falta cambiar el tema.');
  guardar(id, { estado: 'lista' });
}

export async function publicarTrabajo(id) {
  const t = leerTrabajo(id);
  if (t.tipo === 'landing') return publicarLanding(id);
  if (!t.nuevoTema?.id) throw new ErrorApp(400, 'Ese trabajo no tiene un tema para publicar.');
  await api.publicarTema(tiendaConClave(t.tiendaId), t.nuevoTema.id);
  guardar(id, { estado: 'publicado', publicado: new Date().toISOString() });
  return leerTrabajo(id);
}

export async function descartarTema(id) {
  const t = leerTrabajo(id);
  if (!t.nuevoTema?.id) throw new ErrorApp(400, 'Ese trabajo no tiene un tema.');
  if (t.estado === 'publicado') throw new ErrorApp(400, 'Ese tema ya está publicado: no lo borro.');
  await api.borrarTema(tiendaConClave(t.tiendaId), t.nuevoTema.id);
  guardar(id, { nuevoTema: null, estado: 'descartado' });
  return leerTrabajo(id);
}

export async function aplicarAdmin(id, indice) {
  const t = leerTrabajo(id);
  const a = t.admin?.[Number(indice)];
  if (!a) throw new ErrorApp(404, 'No encuentro ese cambio.');
  if (a.estado === 'hecho') return t;
  const admin = [...t.admin];
  try {
    const data = await api.admin(tiendaConClave(t.tiendaId), a.query, a.variables);
    const errores = JSON.stringify(data || {}).match(/"userErrors":\[(\{[^\]]+)\]/);
    admin[indice] = { ...a, estado: errores ? 'error' : 'hecho', resultado: JSON.stringify(data).slice(0, 1500) };
  } catch (e) {
    admin[indice] = { ...a, estado: 'error', resultado: e.message };
  }
  guardar(id, { admin });
  return leerTrabajo(id);
}

// ---------------------------------------------------------------- 2. subir una landing

const escLiquid = (s) => s.replace(/\{\{/g, "{{ '{{' }}").replace(/\{%/g, "{{ '{%' }}");

export async function subirLanding({ landingId, tiendaId, titulo, direccion, producto } = {}) {
  const { leer, carpetaDe: carpetaLanding } = await import('../landings/index.js');
  const l = leer(landingId);
  if (l.estado !== 'lista') throw new ErrorApp(400, 'Esa landing todavía no está lista.');
  const tienda = tiendaConClave(tiendaId);
  const sufijo = `kads-${String(landingId).replace(/[^a-z0-9]/g, '').slice(-14)}`;
  const id = nuevoId(`${tienda.nombre}-landing`);
  const handle = String(direccion || titulo || l.titulo || 'landing').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || sufijo;
  fs.mkdirSync(carpetaDe(id), { recursive: true });
  guardar(id, { id, tipo: 'landing', landingId, tiendaId: tienda.id, tiendaNombre: tienda.nombre, dominio: tienda.dominio, pedido: `Subir la landing «${l.titulo}»`, titulo: String(titulo || l.titulo).slice(0, 120), handle, producto: producto || null, plantilla: `page.${sufijo}`, creado: new Date().toISOString(), estado: 'trabajando', progreso: [], error: null, pagina: null });
  deFondo(id, async () => {
    const dirL = carpetaLanding(landingId);
    const subir = path.join(carpetaDe(id), 'subir');
    fs.rmSync(subir, { recursive: true, force: true });
    fs.mkdirSync(path.join(subir, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(subir, 'templates'), { recursive: true });
    avanzar(id, 'Preparando Shopify CLI…');
    await api.asegurarCli();
    const lista = await api.temas(tienda);
    const vivo = lista.find((x) => x.rol === 'live' || x.rol === 'main');
    if (!vivo) throw new Error('No encontré el tema publicado de la tienda.');
    let html = fs.readFileSync(path.join(dirL, 'index.html'), 'utf8');
    // los enlaces a la tienda de donde salió: a tu tienda (y al producto que elegiste)
    const origen = new URL(l.url).origin;
    html = html.split(`${origen}/`).join('/');
    if (producto && tienda.tipo === 'completo') {
      try {
        const d = await api.admin(tienda, 'query($h:String!){ productByHandle(handle:$h){ handle variants(first:1){ nodes{ id } } } }', { h: String(producto) });
        const p = d?.productByHandle;
        if (p) {
          html = html.replace(/(["'])\/products\/[^"'?#]+/g, `$1/products/${p.handle}`);
          const variante = (p.variants.nodes[0]?.id || '').split('/').pop();
          if (variante) html = html.replace(/(<input[^>]+name=["']id["'][^>]+value=["'])\d+/g, `$1${variante}`).replace(/(<input[^>]+value=["'])\d+(["'][^>]+name=["']id["'])/g, `$1${variante}$2`);
        } else avanzar(id, `No encontré el producto «${producto}» en la tienda: los botones quedan como en la original.`);
      } catch (e) {
        avanzar(id, `No pude leer el producto (${e.message}).`);
      }
    }
    html = escLiquid(html);
    // los videos: a Archivos de Shopify (con acceso completo) o, si no, el GIF original
    const assets = fs.existsSync(path.join(dirL, 'assets')) ? fs.readdirSync(path.join(dirL, 'assets')) : [];
    for (const f of assets.filter((x) => /\.(mp4|webm)$/i.test(x))) {
      let url = null;
      if (tienda.tipo === 'completo') {
        avanzar(id, 'Subiendo un video a Archivos de Shopify…');
        try {
          url = await api.subirArchivo(tienda, path.join(dirL, 'assets', f));
        } catch (e) {
          avanzar(id, `Un video no subió (${e.message}).`);
        }
      }
      if (url) html = html.split(`assets/${f}`).join(url);
      else
        html = html.replace(/<video\b[^>]*><\/video>/g, (v) => {
          if (!v.includes(`src="assets/${f}"`)) return v;
          const gif = (/data-kc-origen="([^"]+)"/.exec(v) || [])[1];
          const w = (/ width="(\d+)"/.exec(v) || [])[1];
          const h = (/ height="(\d+)"/.exec(v) || [])[1];
          return gif ? `<img src="${gif}" alt=""${w ? ` width="${w}"` : ''}${h ? ` height="${h}"` : ''} loading="lazy">` : v;
        });
    }
    let n = 0;
    for (const f of assets.filter((x) => !/\.(mp4|webm)$/i.test(x))) {
      if (!html.includes(`assets/${f}`)) continue;
      fs.copyFileSync(path.join(dirL, 'assets', f), path.join(subir, 'assets', `${sufijo}-${f}`));
      n++;
    }
    html = html.replace(/assets\/([A-Za-z0-9._-]+)/g, (m, f) => (assets.includes(f) && fs.existsSync(path.join(subir, 'assets', `${sufijo}-${f}`)) ? `{{ '${sufijo}-${f}' | asset_url }}` : m));
    // si pesa mucho, el CSS va aparte (el tope de una plantilla) como asset .css.liquid
    if (Buffer.byteLength(html) > 200000) {
      const estilos = [];
      html = html.replace(/<style>([\s\S]*?)<\/style>/g, (m, css) => {
        estilos.push(css);
        return '';
      });
      fs.writeFileSync(path.join(subir, 'assets', `${sufijo}.css.liquid`), estilos.join('\n'));
      html = html.replace('</head>', `{{ '${sufijo}.css' | asset_url | stylesheet_tag }}</head>`);
    }
    const plantilla = `{% layout none %}\n${html.replace(/^<!doctype html>\s*/i, '<!doctype html>\n')}`;
    fs.writeFileSync(path.join(subir, 'templates', `page.${sufijo}.liquid`), plantilla);
    // (2026-11-24) VISTA PREVIA PRIMERO: la misma plantilla como portada alternativa (index.<sufijo>). Con ?view=<sufijo>
    // la tienda la muestra en su dominio, con sus fuentes y sus enlaces, sin que exista todavía la página ni la vea nadie
    // que no tenga el enlace. La página se crea recién con «Publicar» (publicarLanding).
    fs.writeFileSync(path.join(subir, 'templates', `index.${sufijo}.liquid`), plantilla);
    const solo = archivosDe(subir);
    avanzar(id, `Escribiendo el código en tu tema «${vivo.nombre}» con Shopify CLI: la plantilla y ${n} imágenes (solo archivos nuevos: no cambia nada de lo que ya tienes)…`);
    await api.subirTema(tienda, subir, { temaId: vivo.id, solo, alEnVivo: true });
    const base = (tienda.tienda || `https://${tienda.dominio}`).replace(/\/$/, '');
    guardar(id, { estado: 'vista-previa', vistaPrevia: `${base}/?view=${sufijo}`, temaId: vivo.id, temaNombre: vivo.nombre, archivos: solo });
    avanzar(id, 'Lista la vista previa en tu tienda. Mírala y, si te gusta, toca «Publicar la página».');
  });
  return leerTrabajo(id);
}

/**
 * «Publicar la página» de una landing que ya está en el tema (con su vista previa): con acceso completo crea la página
 * publicada con esa plantilla; con «solo temas» queda la indicación para crearla en Shopify eligiendo la plantilla.
 */
export async function publicarLanding(id) {
  const t = leerTrabajo(id);
  if (t.tipo !== 'landing') throw new ErrorApp(400, 'Ese trabajo no es una landing.');
  if (t.estado === 'lista' || t.estado === 'publicado') return t;
  if (t.estado !== 'vista-previa') throw new ErrorApp(409, 'La landing todavía no está en tu tema.');
  const tienda = tiendaConClave(t.tiendaId);
  const sufijo = String(t.plantilla || '').replace(/^page\./, '');
  let pagina = null;
  if (tienda.tipo === 'completo') {
    const d = await api.admin(tienda, 'mutation($p:PageCreateInput!){ pageCreate(page:$p){ page{ id handle } userErrors{ field message } } }', { p: { title: t.titulo, handle: t.handle, templateSuffix: sufijo, isPublished: true } });
    const e = d?.pageCreate?.userErrors?.[0];
    if (e) throw new ErrorApp(502, `Shopify no creó la página: ${e.message}`);
    pagina = `${(tienda.tienda || `https://${tienda.dominio}`).replace(/\/$/, '')}/pages/${d.pageCreate.page.handle}`;
  }
  guardar(id, { estado: 'lista', pagina, publicado: new Date().toISOString() });
  avanzar(id, pagina ? `Publicada en ${pagina}` : `En Shopify: Tienda online › Páginas › Agregar página, y en «Plantilla» elige «${sufijo}».`);
  return leerTrabajo(id);
}

/** Para la coordinadora: las tiendas, en una línea cada una. */
export const tiendasEnTexto = () => listarTiendas().map((t) => `${t.id} | ${t.nombre} | ${t.dominio} | ${t.tipo === 'completo' ? 'acceso completo' : 'solo temas'}`).join('\n');

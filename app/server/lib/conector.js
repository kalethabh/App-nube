// EL CONECTOR PARA CLAUDE (2026-11-20e). Con la app desplegada en un servidor (DESPLEGAR.md), le agregas a Claude
// (claude.ai o la app de Claude del celular, en Configuración › Conectores › Agregar conector personalizado) la
// dirección https://<tu dominio>/mcp/<clave> y desde el chat de Claude le pides a tu app: ver tus productos, leer y
// ANALIZAR la investigación de mercado (las dos partes: el mercado y la competencia), lanzar una investigación, crear
// anuncios de video (el guion), ver su costo y producirlos, y anuncios de imagen con el agente de variaciones.
// Lo de siempre NO cambia: la app, la oficina y la coordinadora siguen igual; esto es una puerta más.
//
// Es un servidor MCP («Model Context Protocol», el idioma de los conectores de Claude) por HTTP: JSON-RPC 2.0 con POST
// (initialize, tools/list, tools/call, ping). Sin OAuth: la clave larga y secreta va en la dirección (como un enlace
// privado); se cambia o se apaga en Ajustes › Conector para Claude. Caddy deja pasar /mcp/ sin la contraseña del sitio
// (deploy/instalar.sh): la clave hace de contraseña.
//
// NUNCA gasta sin el sí: producir_anuncio y generar_imagenes piden `costo_confirmado` (el costo que Claude le mostró
// al usuario) y se niegan si es menor que el costo de ahora.
//
//   config() / guardarConfig({ activo }) / nuevaClave()      temp/_conector/conector.json
//   claveValida(clave)
//   atender(cuerpo) -> respuesta JSON-RPC (o null para una notificación)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { RAIZ, TEMP } from './rutas.js';
import { leerJSON } from './archivos.js';
import { escribirJSON, listarProductos } from './productos.js';
import { DOMINIO } from './servidor.js';

const DIR = path.join(TEMP, '_conector');
const CONFIG = path.join(DIR, 'conector.json');
const PROTOCOLOS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const MAX_IMAGENES = 10;

// ---------------------------------------------------------------- la clave

export function config() {
  let c = leerJSON(CONFIG);
  if (!c?.clave) {
    c = { activo: false, clave: crypto.randomBytes(24).toString('base64url'), creado: new Date().toISOString() };
    fs.mkdirSync(DIR, { recursive: true });
    escribirJSON(CONFIG, c);
  }
  return c;
}
const base = () => (DOMINIO ? `https://${DOMINIO}` : `http://127.0.0.1:${process.env.PUERTO || 4455}`);
/** Lo que ve Ajustes: si está prendido, la dirección para pegar en Claude y si la app está en un servidor. */
export function vista() {
  const c = config();
  return { activo: Boolean(c.activo), url: `${base()}/mcp/${c.clave}`, enServidor: Boolean(DOMINIO), ultimoUso: c.ultimoUso || null };
}
export function guardarConfig({ activo } = {}) {
  const c = config();
  escribirJSON(CONFIG, { ...c, activo: Boolean(activo) });
  return vista();
}
export function nuevaClave() {
  const c = config();
  escribirJSON(CONFIG, { ...c, clave: crypto.randomBytes(24).toString('base64url'), creado: new Date().toISOString() });
  return vista();
}
export function claveValida(clave) {
  const c = config();
  if (!c.activo) return false;
  const a = Buffer.from(String(clave || ''));
  const b = Buffer.from(c.clave);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
let ultimoAnotado = 0;
function anotarUso() {
  if (Date.now() - ultimoAnotado < 60000) return;
  ultimoAnotado = Date.now();
  try {
    escribirJSON(CONFIG, { ...config(), ultimoUso: new Date().toISOString() });
  } catch {
    /* no frena nada */
  }
}

// ---------------------------------------------------------------- utilidades

const enlace = (hash) => `${base()}/#${hash}`;
const dinero = (n) => `US$${(Math.round(Number(n) * 100) / 100).toFixed(2)}`;
const texto = (v, max = 600) => String(v ?? '').replace(/\r/g, '').trim().slice(0, max);
const t = (x) => (typeof x === 'string' ? x.trim() : x === null || x === undefined ? '' : String(x));

/** Los bloques de la competencia (o de una sección) en texto legible para Claude. */
function bloquesATexto(bloques = []) {
  const out = [];
  for (const b of Array.isArray(bloques) ? bloques : []) {
    if (!b || typeof b !== 'object') continue;
    if (b.tipo === 'tabla') {
      const cols = Array.isArray(b.columnas) ? b.columnas : [];
      if (cols.length) out.push(`| ${cols.map(t).join(' | ')} |`, `| ${cols.map(() => '---').join(' | ')} |`);
      for (const f of b.filas || []) if (Array.isArray(f)) out.push(`| ${f.map((c) => t(typeof c === 'object' ? JSON.stringify(c) : c)).join(' | ')} |`);
      if (b.nota) out.push(`_${t(b.nota)}_`);
      continue;
    }
    if (b.tipo === 'hooks') {
      for (const h of b.items || []) out.push(`- ${t(h?.original || h?.texto)}${t(h?.mejorado) ? ` → mejorado: ${t(h.mejorado)}` : ''}${h?.saturacion ? ` (saturación ${h.saturacion})` : ''}`);
      continue;
    }
    const titulo = t(b.titulo);
    if (titulo) out.push(`**${titulo}**`);
    if (t(b.texto)) out.push(t(b.texto));
    for (const x of Array.isArray(b.items) ? b.items : []) out.push(`- ${typeof x === 'object' ? Object.values(x).map(t).filter(Boolean).join(' — ') : t(x)}`);
    if (Array.isArray(b.filas) && b.tipo !== 'tabla') for (const f of b.filas) if (Array.isArray(f)) out.push(`- ${f.map(t).join(': ')}`);
    if (t(b.pie)) out.push(`_${t(b.pie)}_`);
  }
  return out.join('\n');
}

async function productoConNombre(id) {
  const p = listarProductos().find((x) => x.id === id);
  if (!p) throw new Error(`No encuentro el producto «${id}». Usa listar_productos para ver los ids.`);
  return p;
}

// ---------------------------------------------------------------- las herramientas

const HERRAMIENTAS = [
  {
    name: 'listar_productos',
    description: 'Los productos del usuario en Kads Studio: id, nombre, si tienen ficha (para anuncios de video), foto (para anuncios de imagen) e investigación de mercado (y de la competencia). Úsala primero para tener los ids.',
    inputSchema: { type: 'object', properties: {} },
    correr: async () => {
      const { productosConFoto } = await import('./imagen-ads/lotes.js');
      const inv = await import('./investigacion.js');
      const comp = await import('./competencia.js');
      const fotos = new Map(productosConFoto().map((p) => [p.id, p]));
      const filas = listarProductos().slice(0, 60).map((p) => {
        const e = inv.estado(p.id);
        const c = comp.estado(p.id);
        return `- ${p.id} · ${p.nombre} · ficha: ${p.fichaLista ? 'sí' : 'no'} · foto: ${fotos.has(p.id) ? 'sí' : 'no'} · investigación de mercado: ${e?.tarea?.estado === 'investigando' ? 'en curso' : e?.investigacion ? 'lista' : 'no'} · competencia: ${c?.tarea?.estado === 'investigando' ? 'en curso' : c?.competencia ? 'lista' : 'no'}`;
      });
      return filas.length ? `Productos (${filas.length}):\n${filas.join('\n')}` : 'Todavía no hay productos. Se crean en la app (Productos o Investigación de mercado, con una foto).';
    },
  },
  {
    name: 'leer_investigacion',
    description: 'Trae la investigación de un producto para ANALIZARLA: la primera parte (el mercado: deseo central, dolores, lenguaje del cliente, avatar, ángulos, conceptos para Meta) y la segunda (la competencia en TrendTrack: ganadores, hooks, saturación de ángulos, avatares, validación por país). Léela entera antes de recomendar; no inventes datos que no estén.',
    inputSchema: { type: 'object', properties: { productoId: { type: 'string' }, parte: { type: 'string', enum: ['ambas', 'mercado', 'competencia'], description: 'Por defecto, ambas.' } }, required: ['productoId'] },
    correr: async ({ productoId, parte = 'ambas' }) => {
      const p = await productoConNombre(productoId);
      const salida = [];
      if (parte !== 'competencia') {
        const { aMarkdown } = await import('./investigacion.js');
        const md = aMarkdown(p.id);
        salida.push(md ? `# PRIMERA PARTE · INVESTIGACIÓN DE MERCADO\n${md}` : '# PRIMERA PARTE · INVESTIGACIÓN DE MERCADO\n(Este producto todavía no la tiene: se lanza con la herramienta investigar.)');
      }
      if (parte !== 'mercado') {
        const comp = (await import('./competencia.js')).estado(p.id);
        const c = comp?.competencia;
        if (!c) salida.push('# SEGUNDA PARTE · COMPETENCIA (TrendTrack)\n(Todavía no está.)');
        else {
          const etapas = (c.etapas || []).map((e, i) => `## Etapa ${i + 1}: ${t(e.titulo)}\n${t(e.contexto) ? `${t(e.contexto)}\n` : ''}${bloquesATexto(e.bloques)}${(e.riesgos || []).length ? `\nRiesgos:\n${e.riesgos.map((x) => `- ${t(x)}`).join('\n')}` : ''}`);
          salida.push(`# SEGUNDA PARTE · COMPETENCIA (TrendTrack): ${t(c.marca)}${c.producto ? ` · ${t(c.producto)}` : ''}\n${t(c.explicacion)}\n${(c.advertencias || []).length ? `Antes de leer los datos:\n${c.advertencias.map((x) => `- ${t(x)}`).join('\n')}\n` : ''}\n${etapas.join('\n\n')}`);
        }
      }
      return `${salida.join('\n\n')}\n\nEn la app: ${enlace(`/investigacion/${p.id}`)}`.slice(0, 120000);
    },
  },
  {
    name: 'investigar',
    description: 'Lanza la investigación de un producto: las DOS partes a la vez (el mercado y la competencia en TrendTrack). Tarda de 30 a 90 minutos; no cobra imágenes (usa la cuenta de Claude del servidor). Luego léela con leer_investigacion.',
    inputSchema: { type: 'object', properties: { productoId: { type: 'string' }, pais: { type: 'string', description: 'Ej. Colombia' }, competencia: { type: 'string', description: 'Opcional: link de TrendTrack o dominio de la tienda de la competencia.' } }, required: ['productoId'] },
    correr: async ({ productoId, pais = null, competencia = '' }) => {
      const p = await productoConNombre(productoId);
      const { investigarTodo } = await import('./oficina-chat.js');
      const r = await investigarTodo(p.id, { pais: texto(pais, 60) || null, competencia: texto(competencia, 400) });
      return `Listo: arrancó la investigación de ${p.nombre} (mercado${r.competencia?.error ? `; la de la competencia no pudo arrancar: ${r.competencia.error}` : ' y competencia, a la vez'}). Tarda de 30 a 90 minutos. Se ve en ${enlace(`/investigacion/${p.id}`)}`;
    },
  },
  {
    name: 'listar_estilos',
    description: 'Los estilos de anuncio de video (clave y nombre) y lo que hay que preguntarle al usuario antes de crear cada uno.',
    inputSchema: { type: 'object', properties: {} },
    correr: async () => {
      const { ESTILOS, AJUSTES_OBLIGATORIOS } = await import('./anuncios-nuevos.js');
      return Object.entries(ESTILOS)
        .filter(([k]) => k !== 'agregar')
        .map(([k, d]) => {
          const falta = AJUSTES_OBLIGATORIOS(k);
          return `- ${k} · ${d.nombre}${falta.length ? ` · preguntar antes: ${falta.map((f) => `${f.campo} (${f.texto})`).join('; ')}` : ''}`;
        })
        .join('\n');
    },
  },
  {
    name: 'crear_anuncio_video',
    description: 'Encarga anuncios de video: el equipo escribe el GUION (gratis). Después, con ver_anuncio, se ve el guion y su costo; producirlo cobra y necesita el sí del usuario (producir_anuncio). Pregunta antes lo obligatorio del estilo (listar_estilos).',
    inputSchema: {
      type: 'object',
      properties: {
        productoId: { type: 'string' },
        estilo: { type: 'string', description: 'La clave de listar_estilos' },
        cantidad: { type: 'integer', minimum: 1, maximum: 5 },
        duracion: { type: 'string', description: 'Ej. 45 segundos (opcional)' },
        idea: { type: 'string', description: 'El ángulo o lo que pidió el usuario' },
        respuestas: { type: 'object', description: 'Lo obligatorio del estilo: { campo: valor }' },
      },
      required: ['productoId', 'estilo'],
    },
    correr: async (a) => {
      const p = await productoConNombre(a.productoId);
      const { crearAnuncio, ESTILOS } = await import('./anuncios-nuevos.js');
      if (!ESTILOS[a.estilo] || a.estilo === 'agregar') throw new Error('No conozco ese estilo: usa listar_estilos.');
      const n = Math.max(1, Math.min(5, Number(a.cantidad) || 1));
      const hechos = [];
      for (let i = 0; i < n; i++) {
        const extra = n > 1 ? ` (versión ${i + 1} de ${n}: un ángulo y un gancho DISTINTOS a las otras)` : '';
        const r = crearAnuncio({ productoId: p.id, estilo: a.estilo, duracion: a.duracion ? texto(a.duracion, 60) : null, respuestas: a.respuestas && typeof a.respuestas === 'object' && !Array.isArray(a.respuestas) ? a.respuestas : {}, pedido: `${texto(a.idea, 400)}${extra}`.trim() });
        hechos.push(r.slug);
      }
      return `Encargado: ${n} guion${n > 1 ? 'es' : ''} de ${ESTILOS[a.estilo].nombre} para ${p.nombre}. Tardan unos minutos. Slugs: ${hechos.join(', ')}. Revisa con ver_anuncio (ahí sale el guion y el costo de producirlo).`;
    },
  },
  {
    name: 'ver_anuncio',
    description: 'El estado de un anuncio de video: si el guion está listo (con el guion), el COSTO de producirlo, cómo va la producción y el enlace al video terminado.',
    inputSchema: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] },
    correr: async ({ slug }) => {
      const an = await import('./anuncios-nuevos.js');
      const x = an.anuncioNuevo(String(slug || ''));
      if (!x) throw new Error('No encuentro ese anuncio.');
      const { leerConductor } = await import('./conductor.js');
      const c = leerConductor(x.slug);
      const lineas = [`${x.tituloGuion || x.titulo || x.slug} · estilo ${x.estilo} · producto ${x.productoId}`];
      if (c) {
        const paso = (c.pasos || []).find((p) => p.id === c.paso);
        const error = (c.pasos || []).find((p) => p.error)?.error?.mensaje;
        lineas.push(c.estado === 'listo' ? `TERMINADO. Míralo en ${enlace(`/anuncio/${x.slug}`)}` : `Producción: ${c.estado}${paso ? ` (paso: ${paso.nombre || paso.id})` : ''}${error ? ` · se frenó: ${error}` : ''}. ${enlace(`/anuncio/${x.slug}/produccion`)}`);
        return lineas.join('\n');
      }
      const g = an.estadoGuion(x.slug);
      if (g?.estado === 'escribiendo') lineas.push('El guion se está escribiendo. Vuelve a mirar en un par de minutos.');
      else if (g?.estado === 'error') lineas.push(`El guion no terminó: ${g.error?.mensaje || 'sin detalle'}. Se reintenta en ${enlace(`/nuevo?producto=${x.productoId}&paso=2&anuncios=${x.slug}`)}`);
      else {
        lineas.push(`GUION LISTO:\n${JSON.stringify(g?.guion ?? null).slice(0, 12000)}`);
        if (g?.puedeAprobar) {
          const { costoDelAnuncio } = await import('./costo-estimado.js');
          const costo = await costoDelAnuncio(x.slug, { esperarMs: 60000 });
          lineas.push(costo?.disponible ? `COSTO de producirlo: ${dinero(costo.dolares)}${costo.conModelos ? ` (con ${costo.conModelos})` : ''}. Para producir: muéstrale el costo al usuario y, SOLO si dice que sí, llama a producir_anuncio con costo_confirmado = ${costo.dolares} (en dólares).` : 'El costo todavía se está calculando: vuelve a mirar en un momento.');
        }
        lineas.push(`Para revisarlo o pedir cambios en la app: ${enlace(`/nuevo?producto=${x.productoId}&paso=2&anuncios=${x.slug}`)}`);
      }
      return lineas.join('\n');
    },
  },
  {
    name: 'producir_anuncio',
    description: 'Aprueba el guion y PRODUCE el anuncio de video (ESTO COBRA). Solo después de mostrarle al usuario el costo (ver_anuncio) y de que diga que sí. costo_confirmado = el costo en dólares que aceptó.',
    inputSchema: { type: 'object', properties: { slug: { type: 'string' }, costo_confirmado: { type: 'number' } }, required: ['slug', 'costo_confirmado'] },
    correr: async ({ slug, costo_confirmado }) => {
      const an = await import('./anuncios-nuevos.js');
      const x = an.anuncioNuevo(String(slug || ''));
      if (!x) throw new Error('No encuentro ese anuncio.');
      const { costoDelAnuncio } = await import('./costo-estimado.js');
      const costo = await costoDelAnuncio(x.slug, { esperarMs: 60000 });
      if (!costo?.disponible) throw new Error('No tengo el costo de este anuncio ahora (todavía calculando o el guion no está listo). Mira ver_anuncio.');
      if (!(Number(costo_confirmado) >= Number(costo.dolares) - 0.001)) throw new Error(`El costo es ${dinero(costo.dolares)} y el confirmado es ${dinero(costo_confirmado || 0)}: muéstrale el costo de ahora al usuario y confirma otra vez.`);
      const { producir } = await import('./oficina-chat.js');
      await producir({ slug: x.slug });
      return `Produciendo «${x.tituloGuion || x.slug}» (${dinero(costo.dolares)}). Sigue el avance con ver_anuncio o en ${enlace(`/anuncio/${x.slug}/produccion`)}`;
    },
  },
  {
    name: 'crear_imagenes',
    description: 'Prepara anuncios de imagen con el agente de variaciones (no cobra todavía): con una imagen de referencia (un anuncio que funciona, por URL pública o en base64) hace variaciones; sin referencia, salen de la investigación de mercado del producto. Devuelve el COSTO; para generarlas, muéstraselo al usuario y con su sí llama a generar_imagenes.',
    inputSchema: {
      type: 'object',
      properties: {
        productoId: { type: 'string' },
        cantidad: { type: 'integer', minimum: 1, maximum: MAX_IMAGENES },
        formato: { type: 'string', enum: ['1:1', '9:16', 'ambos'] },
        referencia_url: { type: 'string', description: 'URL https de la imagen de referencia (opcional)' },
        referencia_base64: { type: 'string', description: 'La imagen de referencia en base64 (opcional)' },
        pais: { type: 'string' },
        publico: { type: 'string' },
        idea: { type: 'string' },
      },
      required: ['productoId'],
    },
    correr: async (a) => {
      await productoConNombre(a.productoId);
      let refBytes = null;
      if (a.referencia_base64) refBytes = Buffer.from(String(a.referencia_base64).replace(/^data:[^,]+,/, ''), 'base64');
      else if (a.referencia_url) {
        if (!/^https:\/\//i.test(a.referencia_url)) throw new Error('La referencia tiene que ser una URL https.');
        const r = await fetch(a.referencia_url, { signal: AbortSignal.timeout(30000) });
        if (!r.ok) throw new Error(`No pude bajar la referencia (${r.status}).`);
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length > 15 * 1024 * 1024) throw new Error('La referencia pesa más de 15 MB.');
        refBytes = buf;
      }
      const { loteDeImagenes } = await import('./oficina-chat.js');
      const r = await loteDeImagenes({ productoId: a.productoId, cantidad: a.cantidad, formato: a.formato, pais: a.pais, publico: a.publico, idea: a.idea }, null, { refBytes });
      if (r.costo === null) throw new Error('No pude calcular el costo de las imágenes. Intenta otra vez en un rato.');
      return `Preparado el lote ${r.lote}: ${r.cantidad} imágenes de ${r.producto.nombre}${r.conRef ? ' (variaciones de la referencia)' : ' (desde la investigación de mercado)'}. COSTO: ${dinero(r.costo)}. Muéstraselo al usuario y, SOLO si dice que sí, llama a generar_imagenes con lote = ${r.lote} y costo_confirmado = ${r.costo} (en dólares).`;
    },
  },
  {
    name: 'generar_imagenes',
    description: 'GENERA un lote preparado con crear_imagenes (ESTO COBRA). Solo con el sí del usuario al costo; costo_confirmado = el que aceptó.',
    inputSchema: { type: 'object', properties: { lote: { type: 'string' }, costo_confirmado: { type: 'number' } }, required: ['lote', 'costo_confirmado'] },
    correr: async ({ lote, costo_confirmado }) => {
      const lotes = await import('./imagen-ads/lotes.js');
      if (!lotes.esLoteDeEstaApp(String(lote || ''))) throw new Error('No encuentro ese lote.');
      const { producir } = await import('./oficina-chat.js');
      await producir({ tipo: 'imagenes', lote, costo: Number(costo_confirmado) || 0 });
      return `Generando el lote ${lote}. Sigue el avance con ver_imagenes o en ${enlace(`/imagenes/${lote}`)}`;
    },
  },
  {
    name: 'ver_imagenes',
    description: 'Cómo va un lote de anuncios de imagen y, cuando terminan, los enlaces a cada imagen.',
    inputSchema: { type: 'object', properties: { lote: { type: 'string' } }, required: ['lote'] },
    correr: async ({ lote }) => {
      const lotes = await import('./imagen-ads/lotes.js');
      if (!lotes.esLoteDeEstaApp(String(lote || ''))) throw new Error('No encuentro ese lote.');
      const { carpetaDe } = await import('./imagen-ads/disco.js');
      const { vistaDelLote } = await import('./imagen-ads/estado.js');
      const { leerConductor } = await import('./conductor.js');
      const carpeta = carpetaDe(lote);
      const c = leerConductor(lote);
      const v = vistaDelLote({ lote, carpeta, brief: lotes.leerBrief(carpeta), conductor: c });
      const piezas = (v.variaciones || []).flatMap((x) => Object.entries(x.piezas || {}).filter(([, p]) => p?.url).map(([f, p]) => `- ${x.id}${x.nivel ? ` (nivel ${x.nivel})` : ''} ${f}: ${base()}${p.url}${x.hipotesis ? ` · prueba: ${x.hipotesis}` : ''}`));
      return `Lote ${lote}: ${!c ? 'preparado, sin generar (falta el sí del usuario: generar_imagenes)' : c.estado === 'listo' ? 'TERMINADO' : c.estado}.\n${piezas.join('\n') || '(todavía sin imágenes)'}\nEn la app: ${enlace(`/imagenes/${lote}`)}`;
    },
  },
  {
    name: 'estado_oficina',
    description: 'Cómo va todo en la oficina: lo que está en marcha en cada departamento, lo que espera una decisión del usuario y lo que se frenó.',
    inputSchema: { type: 'object', properties: {} },
    correr: async () => {
      const { produccion } = await import('./oficina-produccion.js');
      const p = await produccion();
      const lineas = [];
      for (const d of p.departamentos || []) {
        const activos = (d.trabajos || []).filter((x) => x.estado !== 'listo');
        if (!activos.length) continue;
        lineas.push(`## ${d.nombre}`);
        for (const x of activos.slice(0, 10)) lineas.push(`- ${x.titulo}: ${x.estado}${x.error?.mensaje ? ` (${x.error.mensaje})` : ''} · ${base()}/${x.href || ''}`);
      }
      return lineas.length ? lineas.join('\n') : 'Todo tranquilo: no hay nada en marcha ni esperando.';
    },
  },
];
const POR_NOMBRE = new Map(HERRAMIENTAS.map((h) => [h.name, h]));

// ---------------------------------------------------------------- JSON-RPC

const VERSION = (() => {
  try {
    return fs.readFileSync(path.join(RAIZ, 'VERSION'), 'utf8').trim();
  } catch {
    return '0';
  }
})();
const INSTRUCCIONES = 'Kads Studio es la app de anuncios con IA del usuario. Habla con él en español, natural y breve. Antes de algo que COBRA (producir_anuncio, generar_imagenes) muéstrale siempre el costo y espera su sí. Para analizar una investigación, léela entera con leer_investigacion y no inventes datos.';

const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const mal = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

async function uno(m) {
  if (!m || typeof m !== 'object' || m.jsonrpc !== '2.0' || typeof m.method !== 'string') return mal(m?.id, -32600, 'Pedido inválido');
  const esNotificacion = m.id === undefined || m.id === null;
  if (esNotificacion) return null; // notifications/initialized, cancelled…
  anotarUso();
  switch (m.method) {
    case 'initialize': {
      const pedido = m.params?.protocolVersion;
      return ok(m.id, { protocolVersion: PROTOCOLOS.includes(pedido) ? pedido : PROTOCOLOS[0], capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'Kads Studio', version: VERSION }, instructions: INSTRUCCIONES });
    }
    case 'ping':
      return ok(m.id, {});
    case 'tools/list':
      return ok(m.id, { tools: HERRAMIENTAS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case 'tools/call': {
      const h = POR_NOMBRE.get(m.params?.name);
      if (!h) return mal(m.id, -32602, `No existe la herramienta ${m.params?.name}`);
      try {
        const salida = await h.correr(m.params?.arguments || {});
        return ok(m.id, { content: [{ type: 'text', text: String(salida) }] });
      } catch (e) {
        return ok(m.id, { content: [{ type: 'text', text: `No se pudo: ${e?.message || e}` }], isError: true });
      }
    }
    case 'resources/list':
      return ok(m.id, { resources: [] });
    case 'prompts/list':
      return ok(m.id, { prompts: [] });
    default:
      return mal(m.id, -32601, `Método no soportado: ${m.method}`);
  }
}

/** Atiende un cuerpo JSON-RPC (uno o una lista). Devuelve la respuesta, o null si eran solo notificaciones. */
export async function atender(cuerpo) {
  if (Array.isArray(cuerpo)) {
    const r = (await Promise.all(cuerpo.map(uno))).filter(Boolean);
    return r.length ? r : null;
  }
  return uno(cuerpo);
}

export const _paraPruebas = { HERRAMIENTAS, bloquesATexto };

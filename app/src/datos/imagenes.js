// "Anuncios de imagen": lo que piden el formulario, "Tus lotes", el menú y la pantalla de un lote
// (server/rutas/imagen-ads.js). Un lote es una carpeta temp/_img-<producto>-<fecha>/ con N variaciones, cada una
// en cuadrado (1:1) y, si se pidió, en vertical (9:16).
//
//   const { datos } = useLotes({ cadaMs: 10000 });          // { lotes: [...] } (el menú lo pide cada 10 s)
//   const { datos: vista } = useLote(lote, { cadaMs });       // la vista del lote (ESPECIFICACION §9.2)
//   copiarDesde(apiImagenes.prompt(lote, pieza).then((r) => r.texto));   // copia sin mostrar
//
// La simulación (?simular=1) vive aparte, en ./imagenes-simulacion.js: así el menú, que importa este archivo, no
// carga el lote de ejemplo.
import { pedirNuevo, useDatos } from './api.js';

const enc = encodeURIComponent;
const BASE = '/api/imagen-ads';

// ---------------------------------------------------------------- la API

export const apiImagenes = {
  /** { angulos: [{ id, nombre, queAtaca }], posiciones: [{ id, nombre }], maximo, maxReferencias, idiomaPorDefecto } */
  opciones: () => pedirNuevo(`${BASE}/opciones`),
  /** { productos: [{ id, nombre, fotos: [{ n, url, deLaPagina }], fotoSugerida, ultimoLote: { datos } | null, creado }] } */
  productos: () => pedirNuevo(`${BASE}/productos`),
  /** { lotes: [{ lote, titulo, productoId, cantidad, formatos, estado, motivo, listas, total, portada, mosaico: [url], foto, creado, terminado }] } */
  lotes: () => pedirNuevo(BASE),
  /** { productoId, fotoProducto, datos, cantidad, formatos, logo: { posicion } | null } -> { lote, brief } (borrador) */
  crear: (datos) => pedirNuevo(BASE, { metodo: 'POST', cuerpo: datos }),
  /** n de 1 a 10 (solo en borrador) -> { n, url } */
  subirReferencia: (lote, n, archivo) => pedirNuevo(`${BASE}/${enc(lote)}/referencias/${n}`, { metodo: 'PUT', binario: archivo }),
  quitarReferencia: (lote, n) => pedirNuevo(`${BASE}/${enc(lote)}/referencias/${n}`, { metodo: 'DELETE' }),
  /** La investigación de mercado del lote (un File o Blob: texto, .docx o .pdf; solo en borrador) -> { tipo, caracteres } */
  subirInvestigacion: (lote, archivo) => pedirNuevo(`${BASE}/${enc(lote)}/investigacion`, { metodo: 'PUT', binario: archivo }),
  quitarInvestigacion: (lote) => pedirNuevo(`${BASE}/${enc(lote)}/investigacion`, { metodo: 'DELETE' }),
  /** Tu biblioteca de referencias: { referencias: [{ id, url, miniatura, fecha }] } */
  biblioteca: () => pedirNuevo(`${BASE}/biblioteca`),
  // los creativos de tendencia (TrendTrack): solo lectura, se eligen como cualquier referencia
  tendencias: () => pedirNuevo(`${BASE}/tendencias`),
  quitarDeBiblioteca: (id) => pedirNuevo(`${BASE}/biblioteca/${enc(id)}`, { metodo: 'DELETE' }),
  /** -> { url, ancho, alto, transparente }. En un lote ya generado cambia el archivo y rehace las imágenes con logo. */
  subirLogo: (lote, archivo) => pedirNuevo(`${BASE}/${enc(lote)}/logo`, { metodo: 'PUT', binario: archivo }),
  quitarLogo: (lote) => pedirNuevo(`${BASE}/${enc(lote)}/logo`, { metodo: 'DELETE' }),
  /** Arranca el lote con el costo que el usuario acaba de confirmar. 409 si ya empezó. */
  proponerTitulos: (lote) => pedirNuevo(`${BASE}/${enc(lote)}/titulos`, { metodo: 'POST' }),
  titulos: (lote) => pedirNuevo(`${BASE}/${enc(lote)}/titulos`),
  generar: (lote, costoMaximoConfirmado, titulos) => pedirNuevo(`${BASE}/${enc(lote)}/generar`, { metodo: 'POST', cuerpo: { costoMaximoConfirmado, titulos } }),
  /** La vista del lote: conductor, avance, estrategia, variaciones con sus piezas, pedidos e informe. */
  lote: (lote) => pedirNuevo(`${BASE}/${enc(lote)}`),
  /** { texto }: el texto exacto que recibió el modelo. NUNCA se muestra: solo se copia (copiarDesde). */
  prompt: (lote, pieza, { version, como } = {}) => {
    const q = new URLSearchParams();
    if (version) q.set('version', String(version));
    if (como) q.set('como', como);
    const s = q.toString();
    return pedirNuevo(`${BASE}/${enc(lote)}/prompt/${enc(pieza)}${s ? `?${s}` : ''}`);
  },
  /** { pieza, instruccion? } o { v, tipo: 'prompt' } -> 202 { pedido: { id, estado } }. 409 si ya tiene un cambio en camino. */
  regenerar: (lote, cuerpo) => pedirNuevo(`${BASE}/${enc(lote)}/regenerar`, { metodo: 'POST', cuerpo }),
  continuar: (lote) => pedirNuevo(`${BASE}/${enc(lote)}/continuar`, { metodo: 'POST' }),
  detener: (lote) => pedirNuevo(`${BASE}/${enc(lote)}/detener`, { metodo: 'POST' }),
  /** Solo un borrador (nada pagado). */
  borrar: (lote) => pedirNuevo(`${BASE}/${enc(lote)}`, { metodo: 'DELETE' }),
  /** El zip con todo: con o sin logo, y con los prompts si se piden. */
  urlDescarga: (lote, { logo = true, prompts = false } = {}) => `${BASE}/${enc(lote)}/descargar?logo=${logo ? 1 : 0}&prompts=${prompts ? 1 : 0}`,
};

export const claveLote = (lote) => `imagen-ads:lote:${lote}`;
export const CLAVE_LOTES = 'imagen-ads:lotes';
export const CLAVE_PRODUCTOS = 'imagen-ads:productos';

export const useOpcionesImagen = () => useDatos('imagen-ads:opciones', apiImagenes.opciones);
export const useProductosImagen = () => useDatos(CLAVE_PRODUCTOS, apiImagenes.productos);
export const useLotes = (opciones) => useDatos(CLAVE_LOTES, apiImagenes.lotes, opciones);
/** lote null = no pedir nada (p. ej. en la simulación). */
export const useLote = (lote, opciones) => useDatos(lote ? claveLote(lote) : null, () => apiImagenes.lote(lote), opciones);

// ---------------------------------------------------------------- lo que vale para todo el lote

/** Las 6 posiciones del logo (si el servidor no manda las suyas). Por defecto, arriba al centro. */
export const POSICIONES_LOGO = [
  { id: 'arriba-izquierda', nombre: 'Arriba a la izquierda' },
  { id: 'arriba-centro', nombre: 'Arriba al centro' },
  { id: 'arriba-derecha', nombre: 'Arriba a la derecha' },
  { id: 'abajo-izquierda', nombre: 'Abajo a la izquierda' },
  { id: 'abajo-centro', nombre: 'Abajo al centro' },
  { id: 'abajo-derecha', nombre: 'Abajo a la derecha' },
];
export const POSICION_POR_DEFECTO = 'arriba-centro';

/**
 * Dónde va el logo en cada formato, en porcentajes del lienzo (la misma geometría que pega el servidor, §5.1):
 * ancho 12 %, margen lateral 4,5 %; arriba a 4,5 % en el cuadrado y a 15,5 % en el vertical (dentro de la zona
 * segura de Instagram y TikTok). Solo para la vista previa del formulario.
 */
export function lugarDelLogo(posicion, formato) {
  const [fila, col] = String(posicion || POSICION_POR_DEFECTO).split('-');
  const ancho = 12;
  const alto = formato === '9:16' ? 12 * (9 / 16) : 12;
  const x = col === 'izquierda' ? 4.5 : col === 'derecha' ? 100 - 4.5 - ancho : (100 - ancho) / 2;
  const y = formato === '9:16' ? (fila === 'abajo' ? 84.5 - alto : 15.5) : fila === 'abajo' ? 100 - 4.5 - alto : 4.5;
  return { x, y, ancho, alto };
}

/** Los pedidos de "Regenerar" que ya terminaron (lo demás sigue en camino). */
const PEDIDO_TERMINADO = new Set(['listo', 'no-aplicado']);
export const pedidoEnCamino = (p) => Boolean(p) && !PEDIDO_TERMINADO.has(p.estado);

/** ¿El lote se está moviendo? (en la fila, creándose o con un cambio en camino): mientras tanto se mira cada 2 s. */
export function loteActivo(vista) {
  const e = vista?.conductor?.estado;
  return e === 'esperando' || e === 'corriendo' || (vista?.pedidos || []).some(pedidoEnCamino);
}

/** Terminado de verdad: el conductor está listo y no queda ningún cambio en camino. */
export const loteTerminado = (vista) => vista?.conductor?.estado === 'listo' && !(vista?.pedidos || []).some(pedidoEnCamino);

/**
 * La IA que hizo el lote ('claude' | 'codex'): la de la sesión de estrategia, como la guarda el servidor. null si no
 * viene (un lote de antes, cuando solo existía Claude).
 */
export function motorDelLote(vista) {
  const v = vista || {};
  const m = v.motor || v.estrategia?.motor || v.informe?.motor || v.conductor?.motor || v.conductor?.sesiones?.estrategia?.motor || v.sesiones?.estrategia?.motor;
  return m === 'claude' || m === 'codex' ? m : null;
}

/** El menú: 'necesita' si un lote se frenó (saldo, un error), 'creando' si alguno se está haciendo, si no null. */
export function indicadorDeLotes(lotes) {
  if (!Array.isArray(lotes) || !lotes.length) return null;
  if (lotes.some((l) => l.estado === 'error' || (l.estado === 'pausado' && l.motivo !== 'detenido'))) return 'necesita';
  if (lotes.some((l) => l.estado === 'corriendo' || l.estado === 'esperando')) return 'creando';
  return null;
}

// ---------------------------------------------------------------- las piezas

/**
 * El estado de cada imagen (§9.2) como se ve: la insignia (estado de <Insignia> o tono) y su texto.
 * `conImagen`: en estos estados la imagen ya se ve (aunque se esté revisando o rehaciendo).
 */
export const ESTADOS_PIEZA = {
  'en-cola': { texto: 'En espera', estado: 'en-cola' },
  generando: { texto: 'Creándose', estado: 'generando' },
  revisando: { texto: 'Revisando', estado: 'generando' },
  regenerando: { texto: 'Regenerando…', estado: 'generando' },
  ajustando: { texto: 'Ajustando…', estado: 'generando' },
  listo: { texto: 'Lista', estado: 'listo' },
  // (solo en lotes de antes: desde 2026-11-09 la revisión no rehace nada sola)
  arreglado: { texto: 'Se arregló sola', estado: 'arreglado' },
  // la revisión notó algo: queda con su nota, «Corregir esto» y Regenerar (tú decides)
  'te-necesita': { texto: 'Con aviso', estado: 'aviso' },
  'sin-revisar': { texto: 'Sin revisar', tono: 'neutro' },
  'sin-imagen': { texto: 'Sin imagen', estado: 'error' },
};

/** Las que ya no se mueven solas. */
export const PIEZA_FINAL = new Set(['listo', 'arreglado', 'te-necesita', 'sin-revisar', 'sin-imagen']);
/** Las que se están haciendo ahora mismo (cian). */
export const PIEZA_EN_MARCHA = new Set(['generando', 'revisando', 'regenerando', 'ajustando']);

/** "V03_1x1" -> { v: "V03", formato: "1:1", nombre: "V03 · cuadrado" } */
export function partesDePieza(pieza) {
  const m = /^(V\d{2,3})_(1x1|9x16)$/.exec(String(pieza || ''));
  if (!m) return { v: String(pieza || ''), formato: null, nombre: String(pieza || '') };
  const formato = m[2] === '1x1' ? '1:1' : '9:16';
  return { v: m[1], formato, nombre: `${m[1]} · ${formato === '1:1' ? 'cuadrado' : 'vertical'}` };
}

/** "V100" va después de "V99": las variaciones se ordenan por número, nunca como texto. */
export const numeroDeV = (v) => Number(String(v || '').replace(/\D/g, '')) || 0;
export const porNumero = (a, b) => numeroDeV(a.v) - numeroDeV(b.v);

/**
 * Una versión achicada de una imagen de /archivos/ que respeta su "?v=…" (miniatura() de api.js pondría un segundo
 * "?"). Las piezas ya traen su `miniatura` armada por el servidor: esto es para lo que no la trae (la portada).
 */
export function miniaturaLote(url, ancho = 480) {
  if (!url || typeof url !== 'string') return null;
  if (!url.startsWith('/archivos/') || url.startsWith('/archivos/miniatura/')) return url;
  const i = url.indexOf('?');
  const q = new URLSearchParams(i === -1 ? '' : url.slice(i + 1));
  q.set('ancho', String(ancho));
  return `${(i === -1 ? url : url.slice(0, i)).replace('/archivos/', '/archivos/miniatura/')}?${q}`;
}

/**
 * Para distinguir dos productos que se llaman igual (en la portada y en el formulario dicen lo mismo):
 *   items: [{ clave, nombre, fecha }]   (fecha: cuándo se creó el producto, en ms)
 *   -> Map(clave -> "5 nov" | "5 nov, 02:11" | "n.º 2")   solo los que tienen otro con el mismo nombre
 * El día alcanza si los demás son de otro día; si son del mismo día, va con la hora; si coinciden también en el minuto
 * (o alguno no tiene fecha), todos los de ese nombre se numeran del más viejo al más nuevo.
 */
export function distinguirRepetidos(items) {
  const salida = new Map();
  const normal = (s) => String(s || '').trim().toLocaleLowerCase('es');
  const porNombre = new Map();
  for (const x of items || []) {
    const k = normal(x.nombre);
    if (!porNombre.has(k)) porNombre.set(k, []);
    porNombre.get(k).push(x);
  }
  const conFecha = (x) => Number.isFinite(x.fecha) && x.fecha > 0;
  const dia = (x) => new Date(x.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
  const minuto = (x) => `${dia(x)}, ${new Date(x.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
  const cuantos = (grupo, f) => {
    const m = new Map();
    for (const x of grupo) m.set(f(x), (m.get(f(x)) || 0) + 1);
    return m;
  };
  for (const grupo of porNombre.values()) {
    if (grupo.length < 2) continue;
    if (!grupo.every(conFecha) || [...cuantos(grupo, minuto).values()].some((n) => n > 1)) {
      [...grupo]
        .sort((a, b) => (a.fecha || 0) - (b.fecha || 0) || String(a.clave).localeCompare(String(b.clave)))
        .forEach((x, i) => salida.set(x.clave, `n.º ${i + 1}`));
      continue;
    }
    const porDia = cuantos(grupo, dia);
    for (const x of grupo) salida.set(x.clave, porDia.get(dia(x)) > 1 ? minuto(x) : dia(x));
  }
  return salida;
}

/** Cuántas imágenes salen: "Salen 20 imágenes: 10 cuadradas y 10 verticales." (el precio va aparte: costoDelLote) */
export function textoDeCantidad(n, conVertical) {
  const k = Math.max(0, Math.round(Number(n) || 0));
  if (!k) return 'Elige cuántos anuncios quieres.';
  if (!conVertical) return k === 1 ? 'Sale 1 imagen cuadrada.' : `Salen ${k} imágenes cuadradas.`;
  return k === 1 ? 'Salen 2 imágenes: 1 cuadrada y 1 vertical.' : `Salen ${k * 2} imágenes: ${k} cuadradas y ${k} verticales.`;
}

/**
 * El costo estimado de un lote antes de generarlo (excepción a "sin precios" del 2026-11-09), en dólares: { min, max }
 * o null (datos/costo-lote.js, sin dependencias: así lo prueba la humo).
 */
export { costoDelLote } from './costo-lote.js';

// ---------------------------------------------------------------- avance y etapas

const ETAPAS_LOTE = {
  estrategia: { nombre: 'Estrategia', icono: 'Sparkles' },
  prompts: { nombre: 'Anuncios', icono: 'PenLine' },
  cuadrados: { nombre: 'Cuadrados', icono: 'Images' },
  revision: { nombre: 'Revisión', icono: 'ScanEye' },
  verticales: { nombre: 'Verticales', icono: 'Images' },
  logo: { nombre: 'Logo', icono: 'ShieldCheck' },
  listo: { nombre: 'Listo', icono: 'ClipboardCheck' },
};

/** 0 a 100: un 15 % por los anuncios escritos y un 85 % por las imágenes listas (§11.2). */
export function avanceDelLote(vista) {
  if (loteTerminado(vista)) return 100;
  const a = vista?.avance || {};
  const n = Number(vista?.brief?.cantidad) || 0;
  const total = Number(a.total) || 0;
  const escritas = n ? Math.min(1, (Number(a.escritas) || 0) / n) : 0;
  const listas = total ? Math.min(1, (Number(a.listas) || 0) / total) : 0;
  return Math.round(15 * escritas + 85 * listas);
}

function contarPiezas(vista, filtro) {
  let n = 0;
  for (const v of vista?.variaciones || []) for (const [f, p] of Object.entries(v.piezas || {})) if (p && filtro(p, f)) n++;
  return n;
}

/**
 * La línea de etapas para <Etapas> (pantallas/produccion/Mando.jsx): { etapas, estados, detalles }. Sale de
 * avance.etapas del servidor; lo que se está haciendo ahora se mira en las piezas (una etapa con 0 hechas puede
 * estar en marcha).
 */
export function etapasDelLote(vista) {
  const brief = vista?.brief || {};
  const conVertical = (brief.formatos || []).includes('9:16');
  const delServidor = Array.isArray(vista?.avance?.etapas) ? vista.avance.etapas : [];
  const ids = delServidor.length
    ? delServidor.map((e) => e.id).filter((id) => ETAPAS_LOTE[id] && id !== 'listo')
    : ['estrategia', 'prompts', 'cuadrados', 'revision', ...(conVertical ? ['verticales'] : []), ...(brief.logo ? ['logo'] : [])];
  const porId = new Map(delServidor.map((e) => [e.id, e]));
  const c = vista?.conductor;
  const terminado = loteTerminado(vista);
  const enMarcha = {
    cuadrados: contarPiezas(vista, (p, f) => f === '1:1' && (p.estado === 'generando' || p.estado === 'regenerando')) > 0,
    revision: contarPiezas(vista, (p) => p.estado === 'revisando') > 0,
    verticales: contarPiezas(vista, (p, f) => f === '9:16' && (p.estado === 'generando' || p.estado === 'regenerando')) > 0,
  };
  const anda = c?.estado === 'corriendo' || c?.estado === 'pausado' || c?.estado === 'error';
  const estados = {};
  const detalles = {};
  for (const id of ids) {
    const e = porId.get(id) || {};
    const total = Number(e.total) || 0;
    const hechas = Number(e.hechas) || 0;
    let est = 'pendiente';
    if (terminado) est = 'hecha';
    else if (id === 'estrategia') {
      const s = String(e.estado || '');
      est = /^(hech|list)/.test(s) ? 'hecha' : /error|fallid/.test(s) ? 'error' : /curso|corr|marcha/.test(s) ? 'en-marcha' : 'pendiente';
      if (est === 'pendiente' && anda && ['preparar', 'saldo', 'estrategia'].includes(c?.paso)) est = 'en-marcha';
    } else if (total > 0 && hechas >= total) est = 'hecha';
    else if (hechas > 0 || enMarcha[id]) est = 'en-marcha';
    else if (id === 'prompts' && estados.estrategia === 'hecha' && anda) est = 'en-marcha';
    estados[id] = est;
    if (id === 'estrategia') detalles[id] = est === 'hecha' ? 'Lista' : est === 'en-marcha' ? 'Armándose' : est === 'error' ? 'Se trabó' : 'Primero';
    else if (total > 0) detalles[id] = `${Math.min(hechas, total)} de ${total}`;
  }
  // frenado por un error: la etapa que estaba en marcha se marca (rojo, con su triángulo)
  if (c?.estado === 'error' && !terminado) {
    const actual = [...ids].reverse().find((id) => estados[id] === 'en-marcha') || ids.find((id) => estados[id] === 'pendiente');
    if (actual) {
      estados[actual] = 'error';
      detalles[actual] = 'Se trabó';
    }
  }
  estados.listo = terminado ? 'hecha' : 'pendiente';
  detalles.listo = terminado ? 'Todo listo' : 'Al final';
  const etapas = [...ids, 'listo'].map((id) => ({ id, ...ETAPAS_LOTE[id] }));
  return { etapas, estados, detalles };
}

/** "16:30" de un ISO (o null). */
export function horaDe(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Por qué está frenado el lote (o null):
 *   limite-claude  se acabó por ahora el plan de tu IA (Claude o ChatGPT): sigue solo a una hora (`hasta`)
 *   conexion / reintento   se fue internet o kie falló: sigue solo
 *   saldo          el saldo de kie no alcanza (nunca con cifras): recargar y "Continuar"
 *   detenido       lo detuviste: "Continuar"
 *   pausa          en pausa por otra razón: "Continuar"
 *   clave · claude · ffmpeg · bloqueo · error      un error con su mensaje: "Continuar" lo reintenta
 */
export function altoDelLote(c) {
  if (!c || !c.estado) return null;
  const paso = Array.isArray(c.pasos) ? c.pasos.find((p) => p.id === c.paso) : null;
  const err = paso?.error || c.error || null;
  const motivo = c.motivo || err?.motivo || null;
  const mensaje = err?.mensaje || null;
  if (c.estado === 'esperando') {
    // (motor: la IA cuyo plan llegó al límite, si el servidor la manda)
    if (motivo === 'limite-claude') return { tipo: 'limite-claude', mensaje, hasta: err?.reintentoEn || null, motor: err?.motor || c.motor || null };
    if (mensaje) return { tipo: err?.motivo === 'conexion' ? 'conexion' : 'reintento', mensaje, hasta: err?.reintentoEn || null };
    return null;
  }
  if (c.estado === 'pausado') {
    if (motivo === 'detenido') return { tipo: 'detenido', mensaje };
    if (motivo === 'saldo' || paso?.id === 'saldo') return { tipo: 'saldo', mensaje };
    return { tipo: 'pausa', mensaje };
  }
  if (c.estado === 'error') {
    const tipo = ['saldo', 'clave', 'claude', 'ffmpeg', 'bloqueo'].includes(motivo) ? motivo : 'error';
    return { tipo, mensaje, detalle: err?.detalle || null };
  }
  return null;
}

// ---------------------------------------------------------------- copiar sin mostrar

/**
 * Copia al portapapeles un texto que llega de una promesa (el prompt del servidor) sin perder el gesto del clic:
 *   1. navigator.clipboard.write con un ClipboardItem que espera la promesa
 *   2. si falla, writeText cuando llega el texto
 *   3. si falla, execCommand('copy') con un textarea oculto que se borra enseguida
 * El texto nunca se muestra en pantalla. Llámala directo en el onClick (sin await antes). Si la promesa falla, tira
 * ese error (p. ej. "Todavía no se creó esta imagen").
 */
export async function copiarDesde(promesaTexto) {
  const texto = Promise.resolve(promesaTexto).then((t) => String(t ?? ''));
  texto.catch(() => {}); // (el error se tira abajo, una sola vez)
  try {
    if (typeof window.ClipboardItem === 'function' && navigator.clipboard?.write) {
      const blob = texto.then((t) => new Blob([t], { type: 'text/plain' }));
      await navigator.clipboard.write([new window.ClipboardItem({ 'text/plain': blob })]);
      return true;
    }
  } catch {
    /* sigue con el respaldo */
  }
  const t = await texto;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch {
    /* sigue con el último respaldo */
  }
  const area = document.createElement('textarea');
  area.value = t;
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  Object.assign(area.style, { position: 'fixed', top: '0', left: '-9999px', opacity: '0', pointerEvents: 'none' });
  document.body.appendChild(area);
  let ok = false;
  try {
    area.select();
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  if (!ok) throw new Error('Tu navegador no me dejó copiar. Vuelve a intentarlo.');
  return true;
}

// ---------------------------------------------------------------- el logo

/**
 * ¿El logo tiene transparencia? true · false · null (no se pudo saber). Un JPG nunca la tiene. Se mira en el
 * navegador, antes de subirlo, para avisar enseguida; después manda lo que diga el servidor (logo.transparente).
 */
export async function tieneTransparencia(archivo) {
  if (!archivo) return null;
  if (/jpe?g/i.test(archivo.type || '') || /\.jpe?g$/i.test(archivo.name || '')) return false;
  try {
    const bmp = await createImageBitmap(archivo);
    const esc = Math.min(1, 96 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * esc));
    const h = Math.max(1, Math.round(bmp.height * esc));
    const lienzo = document.createElement('canvas');
    lienzo.width = w;
    lienzo.height = h;
    const ctx = lienzo.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const d = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 240) return true;
    return false;
  } catch {
    return null;
  }
}

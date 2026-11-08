// Cliente de la API local (server/rutas/*.js) y un hook para usarla desde las pantallas.
//
//   const { datos, cargando, error, recargar } = useAnuncios();
//   const { datos: anuncio } = useAnuncio(slug);
//
// Las respuestas se comparten entre pantallas (el menú y el tablero piden lo mismo una sola vez).
import { useCallback, useEffect, useRef, useState } from 'react';

export class ErrorApi extends Error {
  constructor(mensaje, estado) {
    super(mensaje);
    this.estado = estado;
  }
}

async function pedir(url, { metodo = 'GET', cuerpo } = {}) {
  let r;
  try {
    r = await fetch(url, {
      method: metodo,
      headers: { Accept: 'application/json', ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi('No pude conectar con la app. ¿Sigue abierta la ventana del servidor?', 0);
  }
  let datos = null;
  try {
    datos = await r.json();
  } catch {
    datos = null;
  }
  if (!r.ok) throw new ErrorApi(datos?.error || 'Algo salió mal. Vuelve a intentarlo.', r.status);
  return datos;
}

export const api = {
  /** { anuncios: [...], totales: { todos, listos, enProduccion } } */
  anuncios: () => pedir('/api/anuncios'),
  /**
   * Detalle: tomas, broll, pasos, hojas, audio, versiones, plan (para el editor) y base (para Remotion).
   * Si el anuncio no está en la lista (un enlace viejo o mal copiado), se avisa sin pedirlo: así el
   * navegador no anota un error 404 en la consola.
   */
  anuncio: async (slug) => {
    const lista = await obtener('anuncios', api.anuncios, false).catch(() => null);
    if (lista?.anuncios && !lista.anuncios.some((a) => a.slug === slug)) {
      throw new ErrorApi('No encuentro este anuncio. Puede que el enlace esté incompleto o que la carpeta se haya movido.', 404);
    }
    return pedir(`/api/anuncios/${encodeURIComponent(slug)}`);
  },
  /** { estilos: [...13], familias: [...] } */
  estilos: () => pedir('/api/estilos'),
  /** { claves: { archivoEnv, kie, elevenlabs }, claudeCode: { instalado, version }, modelos, modoPrueba: { activo, listo, error } } */
  estado: () => pedir('/api/estado'),
};

// ---------------------------------------------------------------- miniaturas

/**
 * Versión liviana (JPEG achicado) de una imagen o de un cuadro de un video servido por /archivos/.
 * Las imágenes del motor pesan 1-6 MB: en rejillas y listas usa SIEMPRE esto; el original, solo
 * para verla en grande.
 *   miniatura(a.miniatura)                       -> 480 px de ancho
 *   miniatura(toma.clip, 320, { segundo: 1.2 })  -> un cuadro del clip
 */
export function miniatura(url, ancho = 480, { segundo } = {}) {
  if (!url || !url.startsWith('/archivos/') || url.startsWith('/archivos/miniatura/')) return url;
  const q = new URLSearchParams({ ancho: String(ancho) });
  if (segundo !== undefined) q.set('t', String(segundo));
  return `${url.replace('/archivos/', '/archivos/miniatura/')}?${q}`;
}

// ---------------------------------------------------------------- cache compartida

const cache = new Map(); // clave -> { datos, t, promesa }
const EDAD_MAXIMA = 5000;

function obtener(clave, cargar, forzar) {
  const c = cache.get(clave);
  if (c?.promesa) return c.promesa;
  if (!forzar && c && 'datos' in c && Date.now() - c.t < EDAD_MAXIMA) return Promise.resolve(c.datos);
  const promesa = cargar().then(
    (datos) => {
      cache.set(clave, { datos, t: Date.now() });
      return datos;
    },
    (e) => {
      if (c && 'datos' in c) cache.set(clave, { datos: c.datos, t: c.t });
      else cache.delete(clave);
      throw e;
    }
  );
  cache.set(clave, { ...(c || {}), promesa });
  return promesa;
}

/** Olvida lo guardado para que la próxima lectura vaya al servidor (p. ej. después de guardar algo). */
export function invalidar(prefijo) {
  for (const k of cache.keys()) if (k.startsWith(prefijo)) cache.delete(k);
}

/** Lo que se muestra al montar: lo guardado (aunque sea de otra visita), y si está al día (leído hace menos de 5 s). */
function estadoInicial(clave) {
  const c = clave ? cache.get(clave) : null;
  const hay = Boolean(c && 'datos' in c);
  return { datos: hay ? c.datos : null, cargando: Boolean(clave) && !hay, error: null, clave, fresco: hay && Date.now() - c.t < EDAD_MAXIMA };
}

/**
 * Hook genérico. `clave` identifica la respuesta (null = no pedir nada todavía).
 * `cadaMs` vuelve a pedir cada tanto (p. ej. 4000 en la pantalla de producción).
 * Además de { datos, cargando, error, recargar }:
 *   leido  ya hay una respuesta (o un error) para esta `clave`: sirve para esperar una lectura antes de pedir otra
 *   alDia  lo que hay se leyó en esta visita: lo guardado de otra visita puede nombrar archivos que ya no existen
 *          (una toma que se está rehaciendo), así que sus miniaturas esperan a esto
 */
export function useDatos(clave, cargar, { cadaMs } = {}) {
  const [estado, setEstado] = useState(() => estadoInicial(clave));
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;

  const pedirAhora = useCallback(
    (forzar) => {
      if (!clave) return Promise.resolve(null);
      // (la respuesta de una clave que ya cambió no pisa a la nueva)
      return obtener(clave, () => cargarRef.current(), forzar).then(
        (datos) => setEstado((s) => (s.clave === clave ? { datos, cargando: false, error: null, clave, fresco: true } : s)),
        (error) => setEstado((s) => (s.clave === clave ? { ...s, cargando: false, error } : s))
      );
    },
    [clave]
  );

  useEffect(() => {
    if (!clave) return undefined;
    // con la misma clave (cambió solo `cadaMs`) lo ya leído en esta visita sigue al día
    setEstado((s) => {
      const nuevo = estadoInicial(clave);
      return s.clave === clave ? { ...nuevo, fresco: s.fresco || nuevo.fresco } : nuevo;
    });
    pedirAhora(false);
    if (!cadaMs) return undefined;
    const id = setInterval(() => pedirAhora(true), cadaMs);
    return () => clearInterval(id);
  }, [clave, cadaMs, pedirAhora]);

  const recargar = useCallback(() => pedirAhora(true), [pedirAhora]);
  const { clave: deClave, fresco, ...resto } = estado;
  const suya = Boolean(clave) && deClave === clave;
  return { ...resto, recargar, leido: suya && !resto.cargando, alDia: suya && fresco };
}

export const useAnuncios = (opciones) => useDatos('anuncios', api.anuncios, opciones);
export const useAnuncio = (slug, opciones) => useDatos(slug ? `anuncio:${slug}` : null, () => api.anuncio(slug), opciones);
export const useEstilos = () => useDatos('estilos', api.estilos);
export const useEstado = (opciones) => useDatos('estado', api.estado, opciones);

// ================================================================ nuevo anuncio (producto, guion, producir)
// Lo que usa #/nuevo. Va aparte de `api` para que cada pieza de la app sume lo suyo sin pisarse.
//
//   const id = (await apiNuevo.crearProducto({ tipo: 'fisico', url })).id;
//   await apiNuevo.subirFoto(id, 1, archivo);          // cuerpo binario, sin JSON
//   const { slug } = await apiNuevo.crearAnuncio({ productoId: id, estilo: 'claymation', … });
//   const { datos } = useGuion(slug, { cadaMs: 2000 });
//
// Los errores llegan como ErrorApi con `.datos` (la respuesta entera del servidor), para que la
// pantalla distinga "sin sesión de Claude", "límite de uso" o "no alcanza el saldo".

const enc = encodeURIComponent;

/** Como pedir(), más: cuerpo binario (una foto) y `error` que puede venir como texto o como objeto. */
async function pedirNuevo(url, { metodo = 'GET', cuerpo, binario } = {}) {
  let r;
  try {
    r = await fetch(url, {
      method: metodo,
      headers: {
        Accept: 'application/json',
        ...(binario ? { 'Content-Type': binario.type || 'application/octet-stream' } : cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: binario || (cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined),
    });
  } catch {
    throw new ErrorApi('No pude conectar con la app. ¿Sigue abierta la ventana del servidor?', 0);
  }
  let datos = null;
  try {
    datos = await r.json();
  } catch {
    datos = null;
  }
  if (!r.ok) {
    const e = datos?.error;
    const mensaje = (typeof e === 'string' && e) || e?.mensaje || datos?.mensaje || (r.status === 413 ? 'Esa foto pesa demasiado. Prueba con una más liviana.' : 'Algo salió mal. Vuelve a intentarlo.');
    const err = new ErrorApi(mensaje, r.status);
    err.datos = datos;
    throw err;
  }
  return datos;
}

/** Estado de Claude Code. Si el servidor todavía no tiene /api/claude/estado, sale de /api/estado (sin saber la sesión). */
async function estadoClaude() {
  try {
    return await pedirNuevo('/api/claude/estado');
  } catch (e) {
    if (e.estado !== 404) throw e;
    const s = await api.estado();
    return { instalado: Boolean(s?.claudeCode?.instalado), version: s?.claudeCode?.version || null, sesion: 'desconocido' };
  }
}

export const apiNuevo = {
  // ---- Claude Code, saldo y voces
  /** { instalado, version, sesion: "ok" | "sin-sesion" | "desconocido", cuenta? } */
  claude: estadoClaude,
  /** Abre "claude auth login" en una ventana de la PC. */
  iniciarSesionClaude: () => pedirNuevo('/api/claude/login', { metodo: 'POST' }),
  /** { kie: { creditos, alcanza? } }. Con slug, el servidor puede decir si alcanza para ESE anuncio. Nunca se muestran los números. */
  saldo: (slug) => pedirNuevo(`/api/saldo${slug ? `?slug=${enc(slug)}` : ''}`),
  /** [{ id, nombre, muestra, etiquetas }] (o { voces, vozPorEstilo }). */
  voces: (estilo) => pedirNuevo(`/api/voces${estilo ? `?estilo=${enc(estilo)}` : ''}`),

  // ---- el producto (temp/_productos/<id>/)
  /** { nombre?, tipo, url?, descripcion?, guionPropio? } -> { id } */
  crearProducto: (datos) => pedirNuevo('/api/productos', { metodo: 'POST', cuerpo: datos }),
  /** n empieza en 1 (la 1 es la foto principal). `archivo` es un File o un Blob. */
  subirFoto: (id, n, archivo) => pedirNuevo(`/api/productos/${enc(id)}/fotos/${n}`, { metodo: 'PUT', binario: archivo }),
  /** Lanza la sesión "ficha" de Claude -> { tarea } */
  analizarProducto: (id) => pedirNuevo(`/api/productos/${enc(id)}/analizar`, { metodo: 'POST' }),
  /** producto + ficha + estado de la tarea */
  producto: (id) => pedirNuevo(`/api/productos/${enc(id)}`),
  /** { correcciones: { campo: valor }, respuestas: { campo: valor } } */
  guardarFicha: (id, cambios) => pedirNuevo(`/api/productos/${enc(id)}/ficha`, { metodo: 'PUT', cuerpo: cambios }),

  // ---- el anuncio nuevo (temp/<slug>/app/)
  /** { productoId, estilo, duracion, voz: { id, nombre }, continuidad, respuestas } -> { slug } */
  crearAnuncio: (datos) => pedirNuevo('/api/anuncios', { metodo: 'POST', cuerpo: datos }),
  /** { estado: "escribiendo" | "listo" | "error", guion?, progreso: [frases], error? } */
  guion: (slug) => pedirNuevo(`/api/anuncios/${enc(slug)}/guion`),
  /** Pide un cambio con las palabras del usuario (la misma sesión de Claude, con --resume). */
  pedirCambios: (slug, pedido) => pedirNuevo(`/api/anuncios/${enc(slug)}/guion/cambios`, { metodo: 'POST', cuerpo: { pedido } }),
  /** Vuelve a escribir un guion que falló, en el mismo anuncio. Si el servidor no lo tiene, responde 404. */
  reintentarGuion: (slug) => pedirNuevo(`/api/anuncios/${enc(slug)}/guion/reintentar`, { metodo: 'POST' }),
  /** Saca del tablero un anuncio que todavía no se produce (su carpeta va a temp/_descartados/, no se borra) */
  descartarAnuncio: (slug) => pedirNuevo(`/api/anuncios/${enc(slug)}`, { metodo: 'DELETE' }),
  /**
   * Aprueba el guion y arranca el conductor. En el musical va la letra elegida: { letra: n } (n = 1, 2 o 3), que el
   * servidor también guarda con elegirLetra.
   */
  producir: (slug, datos) => pedirNuevo(`/api/anuncios/${enc(slug)}/producir`, { metodo: 'POST', ...(datos ? { cuerpo: datos } : {}) }),
  /** Musical: el usuario elige una de las 2 o 3 letras (queda en app/letras.json como "elegida"; se puede cambiar hasta producir). */
  elegirLetra: (slug, n) => pedirNuevo(`/api/anuncios/${enc(slug)}/guion/letra`, { metodo: 'POST', cuerpo: { n } }),

  // ---- la canción de los cantados (la única pausa de su producción: rutas/cancion.js)
  /** { estado, titulo, estilos, elegida, puedeOtra, opciones: [{ n, url, duracion, grupo, detalle }] } */
  cancion: (slug) => pedirNuevo(`/api/anuncios/${enc(slug)}/cancion`),
  /** Elige la versión n y la producción sigue sola. */
  elegirCancion: (slug, n) => pedirNuevo(`/api/anuncios/${enc(slug)}/cancion`, { metodo: 'POST', cuerpo: { n } }),
  /** "Ninguna me convence": otra tanda con la misma letra. */
  otraCancion: (slug) => pedirNuevo(`/api/anuncios/${enc(slug)}/cancion`, { metodo: 'POST', cuerpo: { otra: true } }),
};

/** La foto n de un producto (para volver a verla al reabrir la pantalla). */
export const urlFotoProducto = (id, n) => `/api/productos/${enc(id)}/fotos/${n}`;

export const useClaudeEstado = (opciones) => useDatos('claude-estado', apiNuevo.claude, opciones);
/** estilo null = no pedir nada (un estilo sin narrador). */
export const useVoces = (estilo) => useDatos(estilo === null ? null : `voces:${estilo || ''}`, () => apiNuevo.voces(estilo));
/** slug null = no pedir nada todavía; sin slug ('' o undefined) = el saldo en general. */
export const useSaldoKie = (slug, opciones) => useDatos(slug === null ? null : `saldo:${slug || ''}`, () => apiNuevo.saldo(slug), opciones);
export const useProducto = (id, opciones) => useDatos(id ? `producto:${id}` : null, () => apiNuevo.producto(id), opciones);
export const useGuion = (slug, opciones) => useDatos(slug ? `guion:${slug}` : null, () => apiNuevo.guion(slug), opciones);
/** La canción de un cantado mientras se elige (slug null = no pedir nada). */
export const useCancion = (slug, opciones) => useDatos(slug ? `cancion:${slug}` : null, () => apiNuevo.cancion(slug), opciones);

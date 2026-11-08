// Los cambios del editor: qué tocó el usuario, con deshacer/rehacer.
//
// Se guardan en dos lados (y nunca se toca nada del anuncio entregado):
//   - en la carpeta del anuncio, temp/<slug>/app/edicion.json (PUT /api/anuncios/:slug/edicion): de ahí los
//     lee la exportación y ahí siguen aunque se abra el editor en otro navegador;
//   - en este navegador (localStorage, una clave por anuncio), por si la app no contesta un momento.
//   Al abrir el editor gana el más nuevo de los dos.
// - La canción propia (un archivo que el usuario arrastra) no cabe en localStorage: va en IndexedDB y además
//   se sube al anuncio (temp/<slug>/app/edicion/musica-<id>.<ext>), que es de donde la toma la exportación.
// - Cada cambio entra al historial. Los que llegan seguidos del mismo control (arrastrar un volumen)
//   se agrupan en un solo paso, para que "Deshacer" no tenga que ir de a un píxel.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { INICIAL, completarEdicion } from '@composicion/edicion/capas.mjs';
import { servidor } from './servidor.js';

export { INICIAL };

const VERSION = 1;
const clave = (slug) => `anuncios-ia:editor:${slug}`;

function leerGuardado(slug) {
  try {
    const crudo = window.localStorage.getItem(clave(slug));
    if (!crudo) return { estado: INICIAL, t: 0 };
    const datos = JSON.parse(crudo);
    if (datos?.v !== VERSION) return { estado: INICIAL, t: 0 };
    return { estado: completarEdicion(datos.estado), t: Number(datos.t) || 0 };
  } catch {
    return { estado: INICIAL, t: 0 };
  }
}

function escribirGuardado(slug, estado, t) {
  try {
    window.localStorage.setItem(clave(slug), JSON.stringify({ v: VERSION, estado, t }));
    return true;
  } catch {
    return false;
  }
}

/** true si el estado tiene algún cambio respecto del anuncio entregado. */
export function tieneCambios(e) {
  return JSON.stringify(e) !== JSON.stringify(INICIAL);
}

// ---------------------------------------------------------------- historial

const AGRUPAR_MS = 900;

function reducir(h, accion) {
  switch (accion.tipo) {
    case 'cambiar': {
      const presente = typeof accion.cambio === 'function' ? accion.cambio(h.presente) : { ...h.presente, ...accion.cambio };
      if (!presente || presente === h.presente) return h;
      if (JSON.stringify(presente) === JSON.stringify(h.presente)) return h;
      const ahora = Date.now();
      const agrupa = accion.grupo && h.grupo === accion.grupo && ahora - h.t < AGRUPAR_MS && h.pasado.length;
      return {
        pasado: agrupa ? h.pasado : [...h.pasado, { estado: h.presente, etiqueta: accion.etiqueta || 'Cambio' }].slice(-100),
        presente,
        futuro: [],
        grupo: accion.grupo || null,
        t: ahora,
        cambiado: ahora,
        origen: 'usuario',
      };
    }
    case 'deshacer': {
      if (!h.pasado.length) return h;
      const anterior = h.pasado[h.pasado.length - 1];
      return {
        pasado: h.pasado.slice(0, -1),
        presente: anterior.estado,
        futuro: [{ estado: h.presente, etiqueta: anterior.etiqueta }, ...h.futuro],
        grupo: null,
        t: 0,
        cambiado: Date.now(),
        origen: 'usuario',
      };
    }
    case 'rehacer': {
      if (!h.futuro.length) return h;
      const [siguiente, ...resto] = h.futuro;
      return {
        pasado: [...h.pasado, { estado: h.presente, etiqueta: siguiente.etiqueta }],
        presente: siguiente.estado,
        futuro: resto,
        grupo: null,
        t: 0,
        cambiado: Date.now(),
        origen: 'usuario',
      };
    }
    case 'reemplazar': // sin historial (p. ej. la canción propia ya no está en este equipo)
      return { ...h, presente: typeof accion.cambio === 'function' ? accion.cambio(h.presente) : accion.cambio, cambiado: Date.now(), origen: 'usuario' };
    case 'delServidor': // lo guardado en el anuncio es más nuevo que lo de este navegador: se toma tal cual
      return { pasado: [], presente: accion.estado, futuro: [], grupo: null, t: 0, cambiado: accion.t, origen: 'servidor' };
    default:
      return h;
  }
}

/**
 * const { ed, cambiar, deshacer, rehacer, ... } = useEdicion(slug, { contexto })
 *   cambiar(fn | parcial, { etiqueta: 'Estilo Pop', grupo: 'volumen-voz' })
 *   contexto   { titulo, overlays, color }: va con cada guardado, así la exportación sabe lo mismo que la vista previa
 *   guardado   'listo' (en el anuncio) | 'guardando' | 'navegador' (solo en este navegador) | 'sin-espacio'
 */
export function useEdicion(slug, { contexto = null } = {}) {
  const [h, despachar] = useReducer(reducir, slug, (s) => {
    const g = leerGuardado(s);
    return { pasado: [], presente: g.estado, futuro: [], grupo: null, t: 0, cambiado: g.t, origen: 'inicio' };
  });
  const [guardado, setGuardado] = useState('listo');
  const [canciones, setCanciones] = useState(null); // las canciones propias guardadas en el anuncio: [{ id, url }] (null = todavía no se sabe)
  const contextoRef = useRef(contexto);
  contextoRef.current = contexto;

  // Al abrir: lo guardado en el anuncio, si es más nuevo que lo de este navegador; y si lo de este navegador es
  // más nuevo (la app no contestó la última vez), se manda al anuncio.
  useEffect(() => {
    let vivo = true;
    servidor
      .leerEdicion(slug)
      .then((r) => {
        if (!vivo) return;
        setCanciones(Array.isArray(r?.canciones) ? r.canciones : []);
        const local = leerGuardado(slug);
        const tServidor = Number(r?.t) || 0;
        if (r?.estado && tServidor > local.t) despachar({ tipo: 'delServidor', estado: completarEdicion(r.estado), t: tServidor });
        else if (local.t > tServidor) servidor.guardarEdicion(slug, { estado: local.estado, t: local.t, contexto: contextoRef.current }).catch(() => setGuardado('navegador'));
      })
      .catch(() => {
        // sin servidor: queda lo de este navegador
        if (vivo) setCanciones([]);
      });
    return () => {
      vivo = false;
    };
  }, [slug]);

  // Cada cambio: al navegador enseguida y al anuncio un momento después (si se siguen tocando cosas, uno solo).
  useEffect(() => {
    if (h.origen === 'inicio') return undefined;
    if (h.origen === 'servidor') {
      // lo que vino del anuncio no hace falta volver a mandarlo: solo se copia en este navegador
      escribirGuardado(slug, h.presente, h.cambiado);
      return undefined;
    }
    setGuardado('guardando');
    const t = h.cambiado;
    const local = escribirGuardado(slug, h.presente, t);
    let vivo = true;
    const id = setTimeout(() => {
      servidor
        .guardarEdicion(slug, { estado: h.presente, t, contexto: contextoRef.current })
        .then(() => vivo && setGuardado('listo'))
        .catch(() => vivo && setGuardado(local ? 'navegador' : 'sin-espacio'));
    }, 600);
    return () => {
      vivo = false;
      clearTimeout(id);
    };
  }, [slug, h.presente, h.cambiado]); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiar = useCallback((cambio, { etiqueta, grupo } = {}) => despachar({ tipo: 'cambiar', cambio, etiqueta, grupo }), []);
  const reemplazar = useCallback((cambio) => despachar({ tipo: 'reemplazar', cambio }), []);
  const deshacer = useCallback(() => despachar({ tipo: 'deshacer' }), []);
  const rehacer = useCallback(() => despachar({ tipo: 'rehacer' }), []);

  return {
    ed: h.presente,
    cambiar,
    reemplazar,
    deshacer,
    rehacer,
    puedeDeshacer: h.pasado.length > 0,
    puedeRehacer: h.futuro.length > 0,
    etiquetaDeshacer: h.pasado.length ? h.pasado[h.pasado.length - 1].etiqueta : null,
    etiquetaRehacer: h.futuro.length ? h.futuro[0].etiqueta : null,
    guardado,
    canciones,
  };
}

// ---------------------------------------------------------------- canción propia (IndexedDB y el anuncio)

const BD = 'anuncios-ia-editor';
const TABLA = 'musica';

function abrirBD() {
  return new Promise((ok, mal) => {
    try {
      const r = window.indexedDB.open(BD, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(TABLA);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    } catch (e) {
      mal(e);
    }
  });
}

async function conTabla(modo, hacer) {
  const bd = await abrirBD();
  try {
    return await new Promise((ok, mal) => {
      const tx = bd.transaction(TABLA, modo);
      const r = hacer(tx.objectStore(TABLA));
      tx.oncomplete = () => ok(r?.result);
      tx.onerror = () => mal(tx.error);
      tx.onabort = () => mal(tx.error);
    });
  } finally {
    bd.close();
  }
}

/**
 * Guarda la canción propia del anuncio: en este navegador (una por anuncio: la última que se eligió) y en la
 * carpeta del anuncio (de ahí la toma la exportación). -> { navegador: bool, anuncio: bool }
 */
export async function guardarCancionPropia(slug, { id, nombre, tipo, archivo }) {
  const [navegador, anuncio] = await Promise.all([
    conTabla('readwrite', (t) => t.put({ id, nombre, tipo, archivo }, slug)).then(
      () => true,
      () => false
    ),
    servidor.subirCancion(slug, { id, nombre, archivo }).then(
      () => true,
      () => false
    ),
  ]);
  return { navegador, anuncio };
}

export async function leerCancionPropia(slug) {
  try {
    return (await conTabla('readonly', (t) => t.get(slug))) || null;
  } catch {
    return null;
  }
}

// id de la canción -> la dirección para escucharla (un archivo de este navegador o la copia del anuncio)
const urls = new Map();
export function registrarUrlMusica(id, archivo) {
  if (!urls.has(id)) urls.set(id, typeof archivo === 'string' ? archivo : URL.createObjectURL(archivo));
  return urls.get(id);
}
export const urlMusica = (id) => (id ? urls.get(id) || null : null);

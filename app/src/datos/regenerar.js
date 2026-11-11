// Regenerar una pieza de un anuncio y poner tu propio video: lo mismo para el proceso y el editor
// (server/rutas/editor.js y server/rutas/reemplazo.js). Desde 2026-11-09 la app genera todo al primer intento: la
// revisión solo deja avisos y el usuario decide qué se vuelve a hacer.
//
//   GET  /api/anuncios/:slug/rehacer                 -> { disponible, motivo, piezas: [...], porPieza, enMarcha, trabajo, cola, esperaA }
//   POST /api/anuncios/:slug/rehacer                 { pieza, pedido?, conImagen?, usarSugerencia? } -> { pedido, trabajo, cola, esperaA }
//   POST /api/anuncios/:slug/rehacer/cancelar        { id? } -> { trabajo, cola }
//   POST /api/anuncios/:slug/reemplazo?pieza=&nombre= (el video) -> { id, archivo, url, largo, conAudio, nombre, pieza, modo }
//   POST /api/anuncios/:slug/reemplazo/original      { pieza } -> { pedido, trabajo, cola, esperaA }
//
//   const reh = useRegenerar(slug, { alTerminar })   { disponible, motivo, piezas, porPieza, trabajo, cola, esperaA,
//                                                      enMarcha, cargado, pedir(datos), cancelar(id?), refrescar() }
//   piezaDelProceso('img:toma-3-inicial')            -> { pieza: 'toma-3', conImagen: true }
//   noSeRegenera('img:mujer')                        -> 'hoja' | 'icono' | null
//   pedidoDeLaPieza(reh, 'toma-3')                   -> { donde: 'lote' | 'fila', ... } | null
//   avisoDelLote(trabajo)                            -> { tipo, titulo, texto } para el aviso de cómo terminó un lote
//   cancelarDelLote(trabajo)                         -> { cortadas, varias, pregunta, aviso } para «Cancelar» (confirma
//                                                      si corta más de una pieza y avisa qué quedó como estaba)
import { useCallback, useEffect, useRef, useState } from 'react';
import { dinero } from './formato.js';

export class ErrorRegenerar extends Error {
  constructor(mensaje, estado, datos = null) {
    super(mensaje);
    this.estado = estado;
    this.datos = datos;
  }
}

async function pedir(url, { metodo = 'GET', cuerpo, archivo } = {}) {
  let r;
  try {
    r = await fetch(url, {
      method: metodo,
      headers: archivo
        ? { Accept: 'application/json', 'Content-Type': archivo.type || 'video/mp4' }
        : { Accept: 'application/json', ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: archivo || (cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined),
    });
  } catch {
    throw new ErrorRegenerar('No pude conectar con la app. ¿Sigue abierta la ventana del servidor?', 0);
  }
  let datos = null;
  try {
    datos = await r.json();
  } catch {
    datos = null;
  }
  if (!r.ok) {
    const mensaje = (typeof datos?.error === 'string' && datos.error) || (r.status === 413 ? 'Ese video es muy pesado (más de 300 MB). Expórtalo más liviano y vuelve a subirlo.' : 'Algo salió mal. Vuelve a intentarlo.');
    throw new ErrorRegenerar(mensaje, r.status, datos);
  }
  return datos;
}

const base = (slug) => `/api/anuncios/${encodeURIComponent(slug)}`;

/** Lo más pesado que acepta la app al subir tu video (el servidor dice lo mismo). */
export const MAX_VIDEO = 300 * 1024 * 1024;

export const apiRegenerar = {
  estado: (slug, { esperar } = {}) => pedir(`${base(slug)}/rehacer${esperar !== undefined ? `?esperar=${esperar}` : ''}`),
  /** { pieza: 'toma-3', pedido: '' (tal cual) | '¿qué salió mal?', conImagen, usarSugerencia } */
  pedir: (slug, datos) => pedir(`${base(slug)}/rehacer`, { metodo: 'POST', cuerpo: datos }),
  /** Con id: saca ese pedido de la fila. Sin id: corta el lote mientras se prepara. */
  cancelar: (slug, id) => pedir(`${base(slug)}/rehacer/cancelar`, { metodo: 'POST', cuerpo: id ? { id } : {} }),
  /** Tu video en lugar del clip de una pieza ('toma-3', 'broll-2', 'paso-4'). Tarda unos segundos (se prepara). */
  subirVideo: (slug, pieza, archivo) => pedir(`${base(slug)}/reemplazo?${new URLSearchParams({ pieza, nombre: archivo?.name || 'video' })}`, { metodo: 'POST', archivo }),
  /** Vuelve el clip original de una pieza reemplazada EN EL ANUNCIO (en la edición basta con quitar el reemplazo). */
  volverAlOriginal: (slug, pieza) => pedir(`${base(slug)}/reemplazo/original`, { metodo: 'POST', cuerpo: { pieza } }),
  reemplazos: (slug) => pedir(`${base(slug)}/reemplazo`),
};

/** ¿Es un video? (para separar un video de una canción al arrastrar un archivo) */
export const esVideo = (f) => Boolean(f) && (/^video\//.test(f.type || '') || /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(f.name || ''));

export const regenerarEnMarcha = (t) => Boolean(t) && ['prompts', 'aplicar', 'produccion'].includes(t.fase);

/** Las piezas de la pantalla del proceso -> lo que se manda al servidor. null si esa pieza no se pide así. */
export function piezaDelProceso(id) {
  const s = String(id || '');
  let m = s.match(/^vid:toma-(\d+)$/);
  if (m) return { pieza: `toma-${m[1]}`, conImagen: false };
  m = s.match(/^img:toma-(\d+)-(inicial|final)$/);
  if (m) return { pieza: `toma-${m[1]}`, conImagen: true };
  m = s.match(/^vid:broll-(\d+)$/);
  if (m) return { pieza: `broll-${m[1]}`, conImagen: false };
  m = s.match(/^img:broll-(\d+)$/);
  if (m) return { pieza: `broll-${m[1]}`, conImagen: true };
  m = s.match(/^vid:paso-(\d+)$/);
  if (m) return { pieza: `paso-${m[1]}`, conImagen: false };
  m = s.match(/^vid:gancho-(.+)$/);
  if (m) return { pieza: `gancho-${m[1]}`, conImagen: false };
  m = s.match(/^img:(?!icono-)(.+)$/);
  if (m) return { pieza: `hoja-${m[1]}`, conImagen: false, hoja: true };
  return null;
}

/**
 * Las piezas del proceso (y claves de los avisos) que no se regeneran desde la app: 'hoja' (la hoja de referencia o la
 * foto de tu producto: de ella salen los clips) e 'icono'. null: esa sí.
 */
export function noSeRegenera(id) {
  const s = String(id || '');
  if (/^img:icono-/.test(s)) return 'icono';
  return piezaDelProceso(s)?.hoja ? 'hoja' : null;
}

/** Por qué un icono no se regenera y qué hacer (el de una hoja lo dice el servidor: porPieza['hoja-…'].motivoNo). */
export const MOTIVO_ICONO = 'Los iconos no se regeneran desde aquí: salen un momento en pantalla, junto a su frase. Míralo en el video: si no se nota, déjalo así.';

/**
 * Las piezas del proceso que toca un pedido ({ pieza, conImagen }): el clip y, con su imagen, sus imágenes (y con
 * continuidad, los pasos de al lado que arrastra: `costo.pasos` de esa pieza).
 */
export function idsDelPedido(x, porPieza = {}) {
  const p = String(x?.pieza || '');
  let m = p.match(/^toma-(\d+)$/);
  if (m) {
    const ids = [`vid:toma-${m[1]}`];
    if (x.conImagen) ids.push(`img:toma-${m[1]}-inicial`, `img:toma-${m[1]}-final`, ...((porPieza[p]?.costo?.pasos || []).map((k) => `vid:${k}`)));
    return ids;
  }
  m = p.match(/^broll-(\d+)$/);
  if (m) return x.conImagen ? [`vid:broll-${m[1]}`, `img:broll-${m[1]}`] : [`vid:broll-${m[1]}`];
  m = p.match(/^(paso|gancho)-(.+)$/);
  if (m) return [`vid:${p}`];
  return [];
}

/**
 * Dónde está lo pedido de una pieza: { donde: 'lote', estado, frase, item } (se está preparando o generando) o
 * { donde: 'fila', item } (espera su turno) o null.
 */
export function pedidoDeLaPieza(reh, pieza) {
  if (!reh || !pieza) return null;
  const t = reh.trabajo;
  if (regenerarEnMarcha(t)) {
    const item = (t.piezas || []).find((x) => x.pieza === pieza && !['error', 'cancelado'].includes(x.estado));
    if (item) return { donde: 'lote', estado: item.estado, fase: t.fase, frase: t.fase === 'produccion' ? t.paso?.nombre || t.frase : t.frase, item };
  }
  const enFila = (reh.cola || []).find((x) => x.pieza === pieza);
  return enFila ? { donde: 'fila', item: enFila } : null;
}

/**
 * Lo que cuesta regenerar una pieza (excepción a «sin precios»: va en el botón, con los precios del motor), o null.
 * `info` = porPieza[pieza]; con su imagen, lo de la imagen (y con continuidad, los pasos de al lado).
 */
export function costoDeRegenerar(info, conImagen = false) {
  const c = info?.costo;
  const x = conImagen && c?.conImagen ? c.conImagen : c?.clip || null;
  const usd = Number(x?.dolares);
  return Number.isFinite(usd) && usd > 0 ? `≈ ${dinero(usd)}` : null;
}

/** «Escena 3 ya está nueva» · «Imagen de apoyo 2 ya está nueva» · «Paso 4 ya está nuevo» */
export function yaEstaNueva(nombre) {
  const n = String(nombre || 'La pieza');
  const varias = /,| y /.test(n);
  if (varias) return `${n} ya están nuevas`;
  return `${n} ya está ${/^(paso|clip|bloque|gancho)\b/i.test(n) ? 'nuevo' : 'nueva'}`;
}

const listaNatural = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
const conPunto = (s) => {
  const t = String(s || '').trim();
  return !t || /[.!?…]$/.test(t) ? t : `${t}.`;
};

/**
 * El aviso de cómo terminó un lote, con lo que pasó de verdad con cada pieza: { tipo, titulo, texto, exportarDeNuevo }
 * o null si no hay nada que decir (cancelado, o no se sabe cómo terminó). Solo las piezas que se aplicaron salen como
 * «ya está nueva»; las que no se pudieron van aparte, con su porqué. `textoListo`: lo que se dice cuando salió bien.
 */
export function avisoDelLote(t, { textoListo = 'El anuncio se volvió a armar con lo nuevo.' } = {}) {
  if (!t) return null;
  const piezas = Array.isArray(t.piezas) ? t.piezas : [];
  const hechas = piezas.filter((x) => x.estado === 'aplicada');
  const fallidas = piezas.filter((x) => x.estado === 'error');
  const juntos = (xs) => listaNatural([...new Set(xs.map((x) => x.nombre).filter(Boolean))]);
  const porQue = (x) => conPunto(x?.error?.mensaje) || 'Quedó como estaba.';
  if (t.fase === 'listo') {
    const extra = fallidas.length ? ` ${fallidas.length === 1 ? `${fallidas[0].nombre} no se pudo regenerar` : `${juntos(fallidas)} no se pudieron regenerar`}: ${porQue(fallidas[fallidas.length - 1])}` : '';
    const base = t.exportarDeNuevo && t.notaExportar ? t.notaExportar : t.nota || textoListo;
    return { tipo: fallidas.length ? 'aviso' : 'ok', titulo: yaEstaNueva(hechas.length ? juntos(hechas) : t.nombre), texto: `${conPunto(base)}${extra}`, exportarDeNuevo: Boolean(t.exportarDeNuevo) };
  }
  if (t.fase === 'error') {
    return {
      tipo: 'error',
      titulo: `No se pudo regenerar ${juntos(fallidas) || t.nombre || 'la pieza'}`,
      texto: conPunto(t.error?.mensaje) || (fallidas.length ? porQue(fallidas[fallidas.length - 1]) : '') || 'Vuelve a pedirlo: lo de antes quedó como estaba.',
      exportarDeNuevo: false,
    };
  }
  return null;
}

/**
 * Lo que corta «Cancelar» en un lote que se prepara (las piezas que todavía no quedaron listas: todas juntas) y el aviso
 * de después: { cortadas, varias, pregunta, aviso }. Las que ya quedaron listas siguen (se arman igual).
 */
export function cancelarDelLote(t) {
  const piezas = Array.isArray(t?.piezas) ? t.piezas : [];
  const cortadas = piezas.filter((x) => ['esperando', 'prompts', 'aplicar'].includes(x.estado));
  const siguen = piezas.filter((x) => x.estado === 'aplicada');
  const nombres = (xs) => listaNatural([...new Set(xs.map((x) => x.nombre).filter(Boolean))]);
  const que = nombres(cortadas) || t?.nombre || 'La pieza';
  const varias = cortadas.length > 1;
  const sigue = siguen.length ? ` ${nombres(siguen)} ${siguen.length > 1 ? 'ya estaban listas y siguen' : 'ya estaba lista y sigue'}.` : '';
  return {
    cortadas,
    varias,
    pregunta: `Se cancela todo lo que se está preparando: ${que}. ${varias ? 'Quedan' : 'Queda'} como ${varias ? 'estaban' : 'estaba'}.${sigue}`,
    aviso: { tipo: 'info', titulo: 'Lo cancelé', texto: `${que} ${varias ? 'quedan como estaban' : 'queda como estaba'}.${sigue}` },
  };
}

/** Pide `cargar` al abrir y, mientras `seguir(datos)` sea verdad, cada `cadaMs`. */
function useSondeo(cargar, seguir, cadaMs, { alCambiar, activo = true } = {}) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;
  const alCambiarRef = useRef(alCambiar);
  alCambiarRef.current = alCambiar;
  const ultimo = useRef(null);

  const refrescar = useCallback(async () => {
    try {
      const r = await cargarRef.current();
      setError(null);
      alCambiarRef.current?.(ultimo.current, r);
      ultimo.current = r;
      setDatos(r);
      return r;
    } catch (e) {
      setError(e);
      return null;
    }
  }, []);

  useEffect(() => {
    if (activo) refrescar();
  }, [refrescar, activo]);

  const sigue = activo && datos ? seguir(datos) : false;
  useEffect(() => {
    if (!sigue) return undefined;
    const id = setInterval(refrescar, cadaMs);
    return () => clearInterval(id);
  }, [sigue, cadaMs, refrescar]);

  // lo que se pone a mano (la respuesta de un POST) cuenta como lo último visto: así se nota cuando termina
  const poner = useCallback((f) => {
    setDatos((d) => {
      const n = typeof f === 'function' ? f(d) : f;
      ultimo.current = n;
      return n;
    });
  }, []);

  return { datos, error, refrescar, setDatos: poner };
}

/**
 * Lo que se puede regenerar de un anuncio, lo que se está haciendo y la fila. Se mira cada 3 s mientras haya algo en
 * marcha o en la fila. `alTerminar(trabajo)`: cuando un lote deja de estar en marcha (listo, error o cancelado). Si
 * enseguida arrancó otro (lo que esperaba en la fila), cómo terminó el de antes lo dice el nuevo (`anterior`); si no se
 * sabe (pasaron dos lotes entre una mirada y otra), llega con fase 'terminado': la pantalla se pone al día sin aviso.
 * slug null = no pedir nada.
 */
export function useRegenerar(slug, { alTerminar } = {}) {
  const { datos, refrescar, setDatos } = useSondeo(
    () => apiRegenerar.estado(slug),
    (d) => regenerarEnMarcha(d.trabajo) || (d.cola || []).length > 0,
    3000,
    {
      activo: Boolean(slug),
      alCambiar: (antes, ahora) => {
        const t0 = antes?.trabajo;
        const t1 = ahora?.trabajo;
        if (!regenerarEnMarcha(t0) || (regenerarEnMarcha(t1) && t1?.id === t0.id)) return;
        // (un lote que falló y arrancó otro enseguida NO es «ya está nueva»)
        const fin = t1?.id === t0.id ? t1 : t1?.anterior?.id === t0.id ? { ...t0, ...t1.anterior } : null;
        alTerminar?.(fin || { ...t0, fase: 'terminado' });
      },
    }
  );
  const pedirRegenerar = useCallback(
    async (cuerpo) => {
      const r = await apiRegenerar.pedir(slug, cuerpo);
      setDatos((d) => ({ ...(d || {}), trabajo: r.trabajo ?? d?.trabajo ?? null, cola: r.cola ?? d?.cola ?? [], esperaA: r.esperaA ?? null }));
      refrescar();
      return r;
    },
    [slug, setDatos, refrescar]
  );
  const cancelar = useCallback(
    async (id) => {
      const r = await apiRegenerar.cancelar(slug, id);
      setDatos((d) => ({ ...(d || {}), trabajo: r.trabajo ?? d?.trabajo ?? null, cola: r.cola ?? d?.cola ?? [] }));
      refrescar();
      return r;
    },
    [slug, setDatos, refrescar]
  );
  /** Lo que devolvió otro pedido que entra a la fila (subir tu video, volver al original). */
  const anotar = useCallback(
    (r) => {
      if (r && (r.trabajo !== undefined || r.cola)) setDatos((d) => ({ ...(d || {}), trabajo: r.trabajo ?? d?.trabajo ?? null, cola: r.cola ?? d?.cola ?? [], esperaA: r.esperaA ?? null }));
      refrescar();
    },
    [setDatos, refrescar]
  );
  // el costo de cada pieza lo calcula el motor (tarda ~1 s la primera vez): si vino sin costo, se pide de nuevo
  const sinCosto = Boolean(datos?.disponible) && (datos?.piezas || []).some((x) => !x.motivoNo && !x.costo);
  const vecesCosto = useRef(0);
  useEffect(() => {
    if (!sinCosto || vecesCosto.current >= 4) return undefined;
    const id = setTimeout(() => {
      vecesCosto.current += 1;
      refrescar();
    }, 2500);
    return () => clearTimeout(id);
  }, [sinCosto, datos, refrescar]);

  const lista = Array.isArray(datos?.piezas) ? datos.piezas : [];
  const porPieza = datos?.porPieza || Object.fromEntries(lista.map((x) => [x.pieza, x]));
  return {
    disponible: Boolean(datos?.disponible),
    motivo: datos?.motivo || null,
    piezas: lista,
    porPieza,
    enMarcha: Boolean(datos?.enMarcha),
    trabajo: datos?.trabajo || null,
    cola: Array.isArray(datos?.cola) ? datos.cola : [],
    esperaA: datos?.esperaA || null,
    cargado: Boolean(datos),
    pedir: pedirRegenerar,
    cancelar,
    anotar,
    refrescar,
  };
}

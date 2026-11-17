// Las otras dos fuentes del feed de Inspiración (2026-11-17n), con la misma forma de anuncio que TrendTrack:
//   useFuenteMeta    la Biblioteca de anuncios oficial de Meta (gratis; solo lo que se mostró en Europa)
//   useFuenteChrome  lo que guardaste con el botón «Guardar en Kads» de Chrome
//   useMediosMeta    el video o la imagen de cada anuncio de Meta, pedido solo cuando la tarjeta se ve (de a 2)
import { useCallback, useEffect, useRef, useState } from 'react';
import { inspiracion } from './datos.js';

const sinRepetir = (lista) => {
  const vistos = new Set();
  return lista.filter((a) => !vistos.has(a.id) && vistos.add(a.id));
};

/**
 * La búsqueda en la Biblioteca de anuncios. Busca sola cuando cambian los filtros (si hay una palabra o una marca);
 * «Cargar más» pide la página siguiente con el cursor de Meta. Lo ya buscado sale de la caché de 12 h.
 */
export function useFuenteMeta({ activa, filtros, marca }) {
  const [paginas, setPaginas] = useState([]); // [r]
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState(null);
  const efectivos = {
    paises: filtros.paisesMeta,
    idioma: filtros.idioma,
    texto: marca && !/^\d{3,25}$/.test(String(marca.pagina || '')) ? marca.nombre : marca ? '' : filtros.textoMeta || '',
    paginas: marca && /^\d{3,25}$/.test(String(marca.pagina || '')) ? [marca.pagina] : [],
    formato: filtros.formato,
    soloValidados: filtros.soloValidados !== false,
  };
  const firma = JSON.stringify(efectivos);
  const firmaActual = useRef(firma);
  firmaActual.current = firma;
  const puedeBuscar = Boolean(efectivos.texto || efectivos.paginas.length);

  const cargar = useCallback(async (despues = null, { forzar = false } = {}) => {
    const deFirma = firmaActual.current;
    setBuscando(true);
    setError(null);
    try {
      const r = await inspiracion.buscarMeta(JSON.parse(deFirma), { despues, forzar });
      if (firmaActual.current !== deFirma) return;
      setPaginas((ps) => (despues ? [...ps, r] : [r]));
    } catch (e) {
      if (firmaActual.current === deFirma) setError(e.message);
    } finally {
      setBuscando(false);
    }
  }, []);

  useEffect(() => {
    setPaginas([]);
    setError(null);
    if (!activa || !puedeBuscar) return undefined;
    // un respiro mientras se escribe: Meta corta si se le pide demasiado seguido
    const t = setTimeout(() => cargar(null), 500);
    return () => clearTimeout(t);
  }, [firma, activa]); // eslint-disable-line react-hooks/exhaustive-deps

  const ultima = paginas[paginas.length - 1] || null;
  const quitados = paginas.reduce((acc, p) => ({ tuyos: acc.tuyos + (p.quitados?.tuyos || 0), sinValidar: acc.sinValidar + (p.quitados?.sinValidar || 0) }), { tuyos: 0, sinValidar: 0 });
  return {
    anuncios: sinRepetir(paginas.flatMap((p) => p.anuncios || [])),
    paginas,
    ultima,
    hayMas: Boolean(ultima?.siguiente),
    cargarMas: () => ultima?.siguiente && cargar(ultima.siguiente),
    actualizar: () => cargar(null, { forzar: true }),
    buscando,
    error,
    puedeBuscar,
    quitados,
  };
}

/** Lo guardado con el botón de Chrome (se vuelve a mirar cada 15 s mientras está a la vista: llega lo nuevo solo). */
export function useFuenteChrome({ activa }) {
  const [r, setR] = useState(null);
  const [error, setError] = useState(null);
  const recargar = useCallback(async () => {
    try {
      setR(await inspiracion.chrome());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    if (!activa) return undefined;
    recargar();
    const t = setInterval(() => document.visibilityState === 'visible' && recargar(), 15000);
    return () => clearInterval(t);
  }, [activa, recargar]);
  return { anuncios: r?.anuncios || [], quitados: r?.quitados || { tuyos: 0, sinValidar: 0 }, cargando: activa && !r && !error, error, recargar };
}

/**
 * El video o la imagen de los anuncios de Meta: la tarjeta lo pide al verse (pedir(a)) y aquí se hace de a 2 a la vez.
 * medios[id] = { tipo, media, miniatura } | { error } ; conMedio(a) devuelve el anuncio ya con su medio.
 */
export function useMediosMeta() {
  const [medios, setMedios] = useState({});
  const fila = useRef([]);
  const pedidos = useRef(new Set());
  const activos = useRef(0);

  const siguiente = useCallback(() => {
    while (activos.current < 2 && fila.current.length) {
      const a = fila.current.shift();
      activos.current++;
      inspiracion
        .medioMeta(a.metaId)
        .then((m) => setMedios((x) => ({ ...x, [a.id]: m?.media ? m : { error: m?.error || 'Sin medio' } })))
        .catch((e) => setMedios((x) => ({ ...x, [a.id]: { error: e.message } })))
        .finally(() => {
          activos.current--;
          siguiente();
        });
    }
  }, []);

  const pedir = useCallback(
    (a) => {
      if (!a?.metaId || pedidos.current.has(a.id)) return;
      pedidos.current.add(a.id);
      fila.current.push(a);
      siguiente();
    },
    [siguiente]
  );

  const conMedio = useCallback(
    (a) => {
      if (!a?.medioPendiente) return a;
      const m = medios[a.id];
      if (!m) return a;
      if (m.error) return { ...a, medioPendiente: false, sinMedio: true };
      return { ...a, tipo: m.tipo, media: m.media, miniatura: m.miniatura, medioPendiente: false };
    },
    [medios]
  );
  return { medios, pedir, conMedio };
}

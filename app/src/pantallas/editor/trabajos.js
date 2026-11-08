// Los dos trabajos del editor que corren en la app y no en el navegador: exportar y rehacer con IA.
// Siguen aunque se cierre el editor (o la app: al volver a abrirla siguen solos). Aquí solo se miran.
//
//   const exp = useExportacion(slug)   { trabajo, siguiente, hechos, exportar(datos), cancelar() }
//   const reh = useRehacer(slug)       { disponible, motivo, piezas, trabajo, pedir(datos), cancelar() }
import { useCallback, useEffect, useRef, useState } from 'react';
import { servidor } from './servidor.js';

export const exportacionEnMarcha = (t) => Boolean(t) && (t.estado === 'esperando' || t.estado === 'exportando');
export const rehacerEnMarcha = (t) => Boolean(t) && ['prompts', 'aplicar', 'produccion'].includes(t.fase);

/** Pide `cargar` al abrir y, mientras `seguir(datos)` sea verdad, cada `cadaMs`. */
function useSondeo(cargar, seguir, cadaMs, { alCambiar } = {}) {
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
    refrescar();
  }, [refrescar]);

  const activo = datos ? seguir(datos) : false;
  useEffect(() => {
    if (!activo) return undefined;
    const id = setInterval(refrescar, cadaMs);
    return () => clearInterval(id);
  }, [activo, cadaMs, refrescar]);

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

export function useExportacion(slug, { alTerminar } = {}) {
  const { datos, refrescar, setDatos } = useSondeo(
    () => servidor.exportacion(slug),
    (d) => exportacionEnMarcha(d.trabajo),
    1000,
    {
      alCambiar: (antes, ahora) => {
        if (exportacionEnMarcha(antes?.trabajo) && !exportacionEnMarcha(ahora?.trabajo)) alTerminar?.(ahora.trabajo);
      },
    }
  );
  const exportar = useCallback(
    async (pedido) => {
      const r = await servidor.exportar(slug, pedido);
      setDatos((d) => ({ ...(d || {}), trabajo: r.trabajo, siguiente: r.siguiente ?? d?.siguiente }));
      return r.trabajo;
    },
    [slug, setDatos]
  );
  const cancelar = useCallback(async () => {
    const r = await servidor.cancelarExportacion(slug);
    setDatos((d) => ({ ...(d || {}), trabajo: r.trabajo }));
    refrescar();
  }, [slug, setDatos, refrescar]);
  return { trabajo: datos?.trabajo || null, siguiente: datos?.siguiente || 1, hechos: datos?.hechos || [], cargado: Boolean(datos), exportar, cancelar, refrescar };
}

export function useRehacer(slug, { alTerminar } = {}) {
  const { datos, refrescar, setDatos } = useSondeo(
    () => servidor.rehacer(slug),
    (d) => rehacerEnMarcha(d.trabajo),
    3000,
    {
      alCambiar: (antes, ahora) => {
        if (rehacerEnMarcha(antes?.trabajo) && !rehacerEnMarcha(ahora?.trabajo)) alTerminar?.(ahora.trabajo);
      },
    }
  );
  const pedir = useCallback(
    async (pedido) => {
      const r = await servidor.pedirRehacer(slug, pedido);
      setDatos((d) => ({ ...(d || {}), trabajo: r.trabajo }));
      return r.trabajo;
    },
    [slug, setDatos]
  );
  const cancelar = useCallback(async () => {
    const r = await servidor.cancelarRehacer(slug);
    setDatos((d) => ({ ...(d || {}), trabajo: r.trabajo }));
    refrescar();
  }, [slug, setDatos, refrescar]);
  return {
    disponible: Boolean(datos?.disponible),
    motivo: datos?.motivo || null,
    piezas: datos?.piezas || {},
    enMarcha: Boolean(datos?.enMarcha),
    trabajo: datos?.trabajo || null,
    cargado: Boolean(datos),
    pedir,
    cancelar,
    refrescar,
  };
}

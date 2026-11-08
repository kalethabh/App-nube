import { createContext, useContext, useLayoutEffect } from 'react';

export const ContextoBarra = createContext(() => {});

/**
 * Una pantalla cambia las migas de la barra superior (por defecto salen de la tabla de rutas de App.jsx).
 *   useBarraSuperior({ migas: [{ texto: 'Mis anuncios', href: '#/tablero' }, { texto: anuncio.titulo }] });
 * La última miga es la pantalla actual (sin href).
 */
export function useBarraSuperior({ migas } = {}) {
  const fijar = useContext(ContextoBarra);
  const clave = JSON.stringify(migas || null);
  useLayoutEffect(() => {
    fijar(migas || null);
    return () => fijar(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, fijar]);
}

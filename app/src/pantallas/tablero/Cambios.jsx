// "Cambiar el producto" en Progreso: los videos que se están analizando, produciendo o que esperan tu revisión,
// con el paso en que van, su avance y cuánto llevan. Sale de /api/cambiar (lib/cambiar.js).
import { useEffect, useState } from 'react';
import { ArrowRight, CircleAlert, LoaderCircle, Repeat } from 'lucide-react';
import { Seccion } from '../../componentes/index.js';
import { useDatos } from '../../datos/api.js';
import { rutas } from '../../datos/rutas.js';

const PASO = {
  preparar: 'Preparando el borrador de subtítulos',
  subtitulos: 'Borrando los subtítulos del original',
  escenas: 'Tu producto en las escenas',
  voz: 'La voz en español',
  musica: 'Separando la música',
  armar: 'Armando el video final',
};
const ETAPA = { analizando: 'Analizando el video', proponiendo: 'Claude arma la propuesta', revisar: 'Te espera para revisar', error: 'Se detuvo' };
const tiempo = (ms) => {
  const m = Math.max(0, Math.round(ms / 60000));
  return m < 1 ? 'menos de 1 min' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

export function Cambios() {
  const { datos } = useDatos('cambios', () => fetch('/api/cambiar', { headers: { Accept: 'application/json' } }).then((r) => (r.ok ? r.json() : { trabajos: [] })), { cadaMs: 5000 });
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);
  const lista = (datos?.trabajos || []).filter((t) => t.etapa && t.etapa !== 'listo');
  if (!lista.length) return null;
  return (
    <Seccion titulo="Cambiar el producto" icono={Repeat} contador={lista.length}>
      <div className="tb-cambios">
        {lista.map((t) => {
          const produciendo = t.etapa === 'produciendo';
          const pct = produciendo && typeof t.paso?.pct === 'number' ? t.paso.pct : null;
          const titulo = produciendo ? PASO[t.paso?.id] || 'Produciendo' : ETAPA[t.etapa] || t.etapa;
          const detalle = t.etapa === 'error' ? t.error : produciendo ? t.paso?.detalle || t.ultimo : t.ultimo;
          const desde = Date.parse(t.inicioProduccion || t.creado);
          return (
            <a key={t.slug} className={`tb-cambio${t.etapa === 'error' ? ' tb-cambio--error' : ''}`} href={`#${rutas.cambiar(t.slug)}`}>
              <span className="tb-cambio__img">{t.miniatura ? <img src={t.miniatura} alt="" loading="lazy" /> : <Repeat size={18} aria-hidden="true" />}</span>
              <span className="tb-cambio__cuerpo">
                <strong>{t.producto}</strong>
                <span className="tb-cambio__paso">
                  {t.etapa === 'error' ? <CircleAlert size={13} aria-hidden="true" /> : produciendo || t.etapa === 'analizando' || t.etapa === 'proponiendo' ? <LoaderCircle size={13} className="girando" aria-hidden="true" /> : null}
                  {titulo}
                </span>
                {pct !== null ? (
                  <span className="tb-cambio__barra" aria-hidden="true">
                    <span style={{ width: `${Math.round(pct * 100)}%` }} />
                  </span>
                ) : null}
                <span className="tb-cambio__detalle">
                  {detalle ? `${detalle}` : ''}
                  {produciendo && desde ? `${detalle ? ' · ' : ''}lleva ${tiempo(ahora - desde)}` : ''}
                </span>
              </span>
              <ArrowRight size={16} className="tb-cambio__flecha" aria-hidden="true" />
            </a>
          );
        })}
      </div>
    </Seccion>
  );
}

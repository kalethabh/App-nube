// Los últimos 14 días en barras (una sola serie a la vez: gasto, anuncios o imágenes), con su detalle al pasar el
// mouse o al tocar una barra. Sin librerías: barras de HTML con alturas en %, una cuadrícula tenue y una tabla oculta
// para lectores de pantalla.
import { useState } from 'react';
import { Esqueleto } from '../../componentes/index.js';
import { dinero, numero } from '../../datos/formato.js';

const SERIES = [
  { id: 'dolares', texto: 'Gasto', formato: (n) => dinero(n), corto: (n) => `$${Number.isInteger(n) ? n : n.toLocaleString('es-ES', { maximumFractionDigits: 1 })}` },
  { id: 'anuncios', texto: 'Anuncios', formato: (n) => `${numero(n)} ${n === 1 ? 'anuncio' : 'anuncios'}`, corto: (n) => numero(n) },
  { id: 'imagenes', texto: 'Imágenes', formato: (n) => `${numero(n)} ${n === 1 ? 'imagen' : 'imágenes'}`, corto: (n) => numero(n) },
];

/** Un tope "redondo" para el eje (1, 2, 5, 10, 20, 50…), para que las líneas caigan en números limpios. */
function topeRedondo(max) {
  if (max <= 0) return 1;
  const base = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * base >= max) return m * base;
  return 10 * base;
}

const fechaCorta = (f) => new Date(`${f}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const diaSemana = (f) => new Date(`${f}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short' });

export function Grafico({ dias }) {
  const [serie, setSerie] = useState('dolares');
  const [activo, setActivo] = useState(null);
  const s = SERIES.find((x) => x.id === serie);
  const valores = (dias || []).map((d) => d[serie] || 0);
  const total = valores.reduce((a, b) => a + b, 0);
  const tope = topeRedondo(Math.max(0, ...valores));
  const lineas = [tope, tope / 2, 0];
  const ultimo = dias?.length ? dias.length - 1 : -1;
  const elegido = activo ?? null;

  return (
    <section className="ini-tarjeta ini-grafico" aria-label="Últimos 14 días">
      <header className="ini-tarjeta__cabecera">
        <div>
          <h2 className="ini-tarjeta__titulo">Últimos 14 días</h2>
          <p className="ini-grafico__total t-num">{dias ? s.formato(serie === 'dolares' ? Math.round(total * 100) / 100 : total) : '—'}</p>
        </div>
        <div className="ini-segmentos" role="tablist" aria-label="Qué mostrar">
          {SERIES.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={serie === x.id}
              className={`ini-segmentos__boton${serie === x.id ? ' ini-segmentos__boton--activo' : ''}`}
              onClick={() => {
                setSerie(x.id);
                setActivo(null);
              }}
            >
              {x.texto}
            </button>
          ))}
        </div>
      </header>

      {!dias ? (
        <Esqueleto ancho="100%" alto={190} />
      ) : (
        <div className="ini-barras" onMouseLeave={() => setActivo(null)}>
          <div className="ini-barras__eje" aria-hidden="true">
            {lineas.map((v) => (
              <span key={v} className="ini-barras__linea">
                <span className="ini-barras__valor-eje t-num">{s.corto(v)}</span>
              </span>
            ))}
          </div>
          <div className="ini-barras__columnas" aria-hidden="true">
            {dias.map((d, i) => {
              const v = d[serie] || 0;
              return (
                <button
                  key={d.fecha}
                  type="button"
                  tabIndex={-1}
                  className={`ini-barras__columna${elegido === i ? ' ini-barras__columna--activa' : ''}${i === ultimo ? ' ini-barras__columna--hoy' : ''}`}
                  onMouseEnter={() => setActivo(i)}
                  onFocus={() => setActivo(i)}
                  onClick={() => setActivo(i)}
                >
                  <span className="ini-barras__barra" style={{ height: v ? `max(3px, ${(v / tope) * 100}%)` : 0 }} />
                  <span className="ini-barras__dia">{i === ultimo ? 'Hoy' : i % 2 === ultimo % 2 ? new Date(`${d.fecha}T12:00:00`).getDate() : ''}</span>
                </button>
              );
            })}
          </div>
          {elegido != null ? (
            <div className="ini-barras__globo" style={{ left: `calc(var(--eje) + ${(elegido + 0.5) / dias.length} * (100% - var(--eje)))` }} role="status">
              <span className="ini-barras__globo-fecha">
                {elegido === ultimo ? 'Hoy' : `${diaSemana(dias[elegido].fecha)} ${fechaCorta(dias[elegido].fecha)}`}
              </span>
              <span className="ini-barras__globo-valor t-num">{s.formato(dias[elegido][serie] || 0)}</span>
            </div>
          ) : null}
          <table className="visualmente-oculto">
            <caption>{s.texto} por día, últimos 14 días</caption>
            <tbody>
              {dias.map((d) => (
                <tr key={d.fecha}>
                  <th scope="row">{fechaCorta(d.fecha)}</th>
                  <td>{s.formato(d[serie] || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

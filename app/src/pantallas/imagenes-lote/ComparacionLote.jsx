// (2026-11-26b) COMPARACIÓN CON LA ESTRUCTURA GANADORA: por cada imagen que sale de una estructura (F33-F40), la
// referencia y la nuestra lado a lado, los 7 puntajes (0-10) y si PASA (8 o más en todos) o queda PARA REHACER con el
// criterio que falló y el prompt corregido. «Rehacer» abre el modal de siempre con esa corrección: nada se rehace solo.
import { Columns2, RotateCcw } from 'lucide-react';
import { Boton } from '../../componentes/index.js';

export function ComparacionLote({ vista, onRehacer }) {
  const c = vista?.comparacion;
  if (!c?.piezas?.length) return null;
  const piezaDe = (x) => vista.variaciones?.find((y) => y.v === x.v)?.piezas?.['1:1'] || null;
  return (
    <section className="cmp" aria-label="Comparación con la referencia">
      <h3 className="agl__titulo">
        <Columns2 size={15} aria-hidden="true" /> Comparación con la referencia
      </h3>
      <p className="cmp__ayuda">A la izquierda la estructura ganadora, a la derecha la tuya. Pasa con {c.minima} o más en los {c.criterios.length} puntos; la que no, se rehace solo si tú lo pides.</p>
      <ul className="cmp__lista">
        {c.piezas.map((x) => {
          const p = piezaDe(x);
          return (
            <li key={x.v} className={`cmp__item${x.pasa === false ? ' cmp__item--rehacer' : x.pasa ? ' cmp__item--pasa' : ''}`}>
              <div className="cmp__cabecera">
                <strong>
                  {x.v} · {x.formato}
                </strong>
                <span className="t-mini t-3">{x.nombre}</span>
                <span className={`cmp__estado cmp__estado--${x.pasa === null ? 'espera' : x.pasa ? 'pasa' : 'rehacer'}`}>{x.pasa === null ? 'Sin revisar' : x.pasa ? 'Pasa' : 'Para rehacer'}</span>
              </div>
              {x.montaje ? (
                <img className="cmp__montaje" src={x.montaje} alt={`${x.v}: la referencia y la tuya, lado a lado`} loading="lazy" />
              ) : (
                <div className="cmp__par">
                  <img src={x.referencia} alt="La estructura de referencia" loading="lazy" />
                  {p?.miniatura ? <img src={p.miniatura} alt={`Tu imagen ${x.v}`} loading="lazy" /> : <span className="cmp__falta t-mini">Todavía sin imagen</span>}
                </div>
              )}
              {x.puntajes ? (
                <dl className="cmp__puntajes">
                  {c.criterios.map((k) => (
                    <div key={k.id} className={x.puntajes[k.id] >= c.minima ? '' : 'cmp__bajo'}>
                      <dt>{k.nombre}</dt>
                      <dd>{x.puntajes[k.id]}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {x.pasa === false ? (
                <div className="cmp__rehacer">
                  <p className="t-chico">
                    <b>Falló:</b> {x.fallan.join(', ')}
                  </p>
                  {x.correccion ? (
                    <p className="cmp__prompt t-mini">
                      <b>Prompt corregido:</b> {x.correccion}
                    </p>
                  ) : null}
                  {x.puedeRehacer && p ? (
                    <Boton variante="secundario" tamano="chico" icono={RotateCcw} onClick={() => onRehacer({ ...p, problemas: [...(x.correccion ? [x.correccion] : []), ...(x.problemas || [])], corregirAlAbrir: true })}>
                      Rehacer con esta corrección
                    </Boton>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

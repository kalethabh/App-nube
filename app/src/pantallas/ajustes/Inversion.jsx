// Ajustes · Inversión: cuánto llevas invertido en cada producto (la suma del gasto real de sus anuncios) y, al
// tocarlo, cada anuncio con lo suyo. Los gastos se suman: lo que se rehace se agrega.
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Esqueleto, Seccion, Tarjeta } from '../../componentes/index.js';
import { useDatos } from '../../datos/api.js';
import { enlace } from '../../datos/rutas.js';

const usd = (n) => `US$${(Number(n) || 0).toFixed(2)}`;

async function leerInversion() {
  const r = await fetch('/api/inversion', { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('No pude leer lo invertido.');
  return r.json();
}

export function Inversion() {
  const { datos, cargando } = useDatos('inversion', leerInversion);
  const [abierto, setAbierto] = useState(null);
  return (
    <Seccion id="inversion" className="ajustes__seccion" titulo="Inversión por producto">
      <Tarjeta>
        {cargando && !datos ? (
          <Esqueleto alto={80} />
        ) : !datos?.productos?.length ? (
          <p className="ajustes__nota">Todavía no hay gasto registrado. Aparece aquí apenas se produzca tu primer anuncio.</p>
        ) : (
          <div className="inversion">
            <p className="ajustes__nota">
              En total llevas <strong>{usd(datos.total)}</strong> en imágenes, videos y música. Toca un producto para ver cada anuncio.
            </p>
            <ul className="inversion__lista">
              {datos.productos.map((p) => {
                const ab = abierto === p.id;
                const Flecha = ab ? ChevronDown : ChevronRight;
                return (
                  <li key={p.id} className="inversion__producto">
                    <button type="button" className="inversion__fila" onClick={() => setAbierto(ab ? null : p.id)} aria-expanded={ab}>
                      <Flecha size={16} strokeWidth={2} aria-hidden="true" />
                      {p.foto ? <img src={p.foto} alt="" className="inversion__foto" /> : null}
                      <span className="inversion__nombre">{p.nombre}</span>
                      <span className="inversion__cuantos">{p.anuncios.length} anuncio{p.anuncios.length === 1 ? '' : 's'}</span>
                      <strong className="inversion__monto">{usd(p.dolares)}</strong>
                    </button>
                    {ab ? (
                      <ul className="inversion__anuncios">
                        {p.anuncios.map((a) => (
                          <li key={a.slug}>
                            <a href={enlace.anuncio(a.slug)}>{a.titulo}</a>
                            <span className="inversion__estilo">{a.estilo}</span>
                            <span className="inversion__monto">{usd(a.dolares)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Tarjeta>
    </Seccion>
  );
}

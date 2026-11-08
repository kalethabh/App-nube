// "Más ganchos": a un anuncio de narrador ya terminado le saca de 2 a 5 versiones que solo cambian el inicio
// (server/lib/ganchos.js). Cada una aparece en Mis anuncios y se produce sola; solo se paga el gancho nuevo.
import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Boton, Chip } from '../../componentes/index.js';
import { enlace } from '../../datos/rutas.js';

async function pedir(slug, metodo = 'GET', cuerpo) {
  const r = await fetch(`/api/anuncios/${encodeURIComponent(slug)}/ganchos`, {
    method: metodo,
    headers: { Accept: 'application/json', ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.error || 'No pude hacerlo.');
  return d;
}

export function MasGanchos({ slug }) {
  const [e, setE] = useState(null);
  const [cuantos, setCuantos] = useState(3);
  const [error, setError] = useState(null);
  useEffect(() => {
    let vivo = true;
    let t;
    const leer = () =>
      pedir(slug)
        .then((d) => {
          if (!vivo) return;
          setE(d);
          if (d.estado === 'escribiendo') t = setTimeout(leer, 4000);
        })
        .catch(() => {});
    leer();
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [slug, e?.estado === 'escribiendo']);
  if (!e?.sePuede && !e?.versiones?.length) return null;
  const escribiendo = e.estado === 'escribiendo';
  const empezar = async () => {
    setError(null);
    try {
      setE(await pedir(slug, 'POST', { cuantos }));
    } catch (x) {
      setError(x.message);
    }
  };
  return (
    <div className="ent-ganchos">
      <p className="ent-ganchos__titulo">
        <Sparkles size={14} strokeWidth={2.2} aria-hidden="true" /> Más ganchos
      </p>
      <p className="ent-ganchos__texto">El mismo anuncio con otros inicios, para probar cuál engancha más. Solo se hace el gancho nuevo: lo demás se reutiliza.</p>
      {e.sePuede ? (
        <div className="fila fila--envolver" style={{ '--hueco': '6px', alignItems: 'center' }}>
          {[2, 3, 4, 5].map((n) => (
            <Chip key={n} tamano="chico" activo={cuantos === n} onClick={escribiendo ? undefined : () => setCuantos(n)}>
              {n}
            </Chip>
          ))}
          <Boton variante="primario" tamano="chico" onClick={empezar} cargando={escribiendo} disabled={escribiendo}>
            {escribiendo ? 'Claude está escribiendo los ganchos' : `Hacer ${cuantos} ganchos`}
          </Boton>
        </div>
      ) : null}
      {e.estado === 'error' || error ? <p className="ent-ganchos__error">{error || e.error}</p> : null}
      {e.versiones?.length ? (
        <ul className="ent-ganchos__lista">
          {e.versiones.map((v) => (
            <li key={v}>
              <a href={enlace.anuncio(v)}>Gancho {v.match(/-gancho-(\d+)$/)?.[1] || ''}</a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

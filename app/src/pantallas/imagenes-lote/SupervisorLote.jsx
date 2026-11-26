// (2026-11-26c) LO QUE VIO EL SUPERVISOR: al terminar el lote compara lo pedido con lo que salió y, si algo falló,
// anota reglas para que no se repita (mis_archivos/biblioteca/aprendizajes/imagen-ads.md). Las reglas entran solas en
// los lotes siguientes; se editan o borran en Aprendizajes.
import { ShieldCheck } from 'lucide-react';

export function SupervisorLote({ vista }) {
  const s = vista?.supervisor;
  if (!s) return null;
  return (
    <section className="agl sup" aria-label="Lo que vio el supervisor">
      <h3 className="agl__titulo">
        <ShieldCheck size={15} aria-hidden="true" /> Lo que vio el supervisor
      </h3>
      <p className="sup__resumen">{s.resumen}</p>
      {s.reglas.length ? (
        <>
          <p className="t-chico t-3">Para que no vuelva a pasar, anotó (tus próximos lotes ya las usan):</p>
          <ul className="sup__reglas">
            {s.reglas.map((r, i) => (
              <li key={i}>
                <span className={`sup__marca${r.nueva ? '' : ' sup__marca--repite'}`}>{r.nueva ? 'Nueva' : `Se repitió ×${r.veces}`}</span> {r.regla}
                {r.porQue ? <small> · {r.porQue}</small> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

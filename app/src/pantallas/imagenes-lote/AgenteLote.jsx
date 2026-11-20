// Lo que entrega el AGENTE DE VARIACIONES (2026-11-20, el prompt maestro del usuario): el análisis del anuncio ganador
// (su ángulo, lo que no se toca, lo que se puede cambiar y lo que se puede probar) y, por cada variación, su nivel
// (A cercana · B concepto vecino · C expandida), qué cambió y qué hipótesis prueba. Va arriba de la galería del lote.
import { Sparkles } from 'lucide-react';

const NIVEL = { A: 'Cercana', B: 'Concepto vecino', C: 'Expandida' };

export function AgenteLote({ vista }) {
  if (vista?.agente !== 'variaciones') return null;
  const a = vista.analisis;
  const conNivel = (vista.variaciones || []).filter((x) => x.nivel);
  return (
    <section className="agl" aria-label="Lo que hizo el agente de variaciones">
      <h3 className="agl__titulo">
        <Sparkles size={15} aria-hidden="true" /> Agente de variaciones
      </h3>
      {a ? (
        <div className="agl__analisis">
          {a.resumen ? <p className="agl__resumen">{a.resumen}</p> : null}
          {a.referencias.map((r) => (
            <div key={r.ref} className="agl__ref">
              <p>
                <b>{r.ref}</b> · Deseo: {r.deseo}
                {r.problema ? ` · Problema: ${r.problema}` : ''}
                {r.mecanismo ? ` · Mecanismo: ${r.mecanismo}` : ''}
              </p>
              <div className="agl__cols">
                <div>
                  <span>No se toca</span>
                  <ul>{r.invariables.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </div>
                <div>
                  <span>Se puede cambiar</span>
                  <ul>{r.modificables.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </div>
                <div>
                  <span>Para probar</span>
                  <ul>{r.experimentales.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </div>
              </div>
            </div>
          ))}
          {a.facetas.length ? <p className="agl__facetas">Facetas del comprador: {a.facetas.join(' · ')}</p> : null}
        </div>
      ) : (
        <p className="agl__espera">El agente está analizando tu anuncio ganador…</p>
      )}
      {conNivel.length ? (
        <ul className="agl__lista">
          {conNivel.map((x) => (
            <li key={x.v}>
              <span className={`agl__nivel agl__nivel--${x.nivel}`}>
                {x.v} · {x.nivel} · {NIVEL[x.nivel] || ''}
              </span>
              <span>
                <b>Cambió:</b> {x.cambio}
              </span>
              <span>
                <b>Prueba:</b> {x.hipotesis}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

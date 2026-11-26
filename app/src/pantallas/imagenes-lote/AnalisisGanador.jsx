// (2026-11-26a) QUÉ HACE VENDER A TU GANADOR: el análisis que escribe la IA antes de cualquier variación (analisis.json
// del lote) en los lotes de «Variantes» con el selector «Qué tan distintas». Va arriba de la galería, en español sencillo:
// la esencia que vende, el deseo, el dolor, el hook visual y qué no se toca, qué se puede cambiar y qué se puede probar.
import { Trophy } from 'lucide-react';

const NIVEL = { fieles: 'Fieles', vecinas: 'Vecinas', conceptos: 'Conceptos nuevos' };
const CONCIENCIA = {
  inconsciente: 'No sabe que tiene el problema',
  'consciente-del-problema': 'Sabe del problema, no de la solución',
  'consciente-de-la-solucion': 'Busca una solución',
  'consciente-del-producto': 'Conoce productos como este',
  'muy-consciente': 'Ya casi compra',
};

export function AnalisisGanador({ vista }) {
  if (!vista?.variacion) return null;
  const a = vista.ganador;
  return (
    <section className="agl agl--ganador" aria-label="Qué hace vender a tu anuncio ganador">
      <h3 className="agl__titulo">
        <Trophy size={15} aria-hidden="true" /> Qué hace vender a tu ganador · {NIVEL[vista.variacion] || ''}
      </h3>
      {a ? (
        <div className="agl__analisis">
          {a.esencia ? <p className="agl__resumen">{a.esencia}</p> : null}
          <dl className="agl__datos">
            {[
              ['Deseo', a.deseo],
              ['Dolor', a.dolor],
              ['Promesa', a.promesa],
              ['Emoción', a.emocion],
              ['Conciencia', CONCIENCIA[a.conciencia] || a.conciencia],
              ['Cómo convence', a.mecanismo],
              ['Lo que se ve primero', a.hook?.que ? `${a.hook.que}${a.hook.porQue ? ` (${a.hook.porQue})` : ''}` : ''],
              ['Formato y ángulo', [a.formato, a.angulo].filter(Boolean).join(' · ')],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
          <div className="agl__cols">
            <div>
              <span>No se toca</span>
              <ul>{a.invariables.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
            <div>
              <span>Se puede cambiar</span>
              <ul>{a.modificables.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
            <div>
              <span>Para probar</span>
              <ul>{a.experimentales.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          </div>
        </div>
      ) : (
        <p className="agl__espera">Tu IA está analizando por qué vende tu anuncio ganador…</p>
      )}
    </section>
  );
}

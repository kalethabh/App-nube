// El costo aproximado de un anuncio y tu saldo de kie con su color (GET /api/anuncios/:slug/costo):
//   verde   te alcanza de sobra · naranja   alcanza justo · rojo   no alcanza
//   <CostoAnuncio slug={slug} />                 antes de aprobar el guion: lo que va a costar
//   <CostoAnuncio slug={slug} enProduccion />    en la producción: lo gastado y lo que falta
import { Wallet } from 'lucide-react';
import { useDatos } from '../datos/api.js';
import './CostoAnuncio.css';

const usd = (n) => `US$${(Number(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const miles = (n) => (Number(n) || 0).toLocaleString('es-ES');
const TEXTO = {
  sobra: 'Tu saldo alcanza de sobra',
  justo: 'Tu saldo alcanza justo: recarga pronto',
  corto: 'Tu saldo no alcanza: recarga en kie.ai antes de producir',
};

export function useCostoAnuncio(slug, { cadaMs, firma = '' } = {}) {
  return useDatos(slug ? `costo:${slug}${firma ? `:${firma}` : ''}` : null, () => fetch(`/api/anuncios/${encodeURIComponent(slug)}/costo`, { headers: { Accept: 'application/json' } }).then((r) => (r.ok ? r.json() : null)), { cadaMs });
}

/** El saldo con su color, solo (para el registro o una línea). */
export function SaldoSemaforo({ saldo, semaforo }) {
  if (!saldo) return null;
  return (
    <span className={`costo-saldo costo-saldo--${semaforo || 'nada'}`}>
      <span className="costo-saldo__punto" aria-hidden="true" />
      Tu saldo de kie: <strong>{usd(saldo.dolares)}</strong>
      {semaforo ? <span className="costo-saldo__texto"> · {TEXTO[semaforo]}</span> : null}
    </span>
  );
}

export function CostoAnuncio({ slug, enProduccion = false, className = '', firma = '' }) {
  const { datos: c, cargando } = useCostoAnuncio(slug, { cadaMs: enProduccion ? 20000 : undefined, firma });
  if (!c) {
    return cargando ? (
      <div className={`costo ${className}`}>
        <span className="costo__titulo">
          <Wallet size={15} aria-hidden="true" /> Calculando el costo…
        </span>
      </div>
    ) : null;
  }
  const presupuesto = !enProduccion && c.disponible && c.dolares && c.creditos
    ? { dolares: c.dolares.max ?? c.dolares.min, creditos: c.creditos.max ?? c.creditos.min }
    : c.falta;
  return (
    <div className={`costo costo--${c.semaforo || 'nada'} ${className}`}>
      <span className="costo__titulo">
        <Wallet size={15} aria-hidden="true" /> {enProduccion ? 'Gastos de este anuncio' : 'Costo aproximado'}
      </span>
      {enProduccion ? (
        <div className="costo__filas">
          <span>
            Gastado hasta ahora <strong>{usd(c.gastado?.dolares)}</strong> <em>({miles(c.gastado?.creditos)} créditos)</em>
          </span>
          {c.falta?.creditos > 0 ? (
            <span>
              Falta ~<strong>{usd(c.falta.dolares)}</strong> <em>({miles(c.falta.creditos)} créditos)</em>
            </span>
          ) : null}
          {c.total ? (
            <span>
              Total aprox. <strong>{usd(c.total.dolares)}</strong>
            </span>
          ) : null}
        </div>
      ) : presupuesto ? (
        <div className="costo__grande">
          ~{usd(presupuesto.dolares)} <em>· {miles(presupuesto.creditos)} créditos de kie.ai</em>
        </div>
      ) : (
        <div className="costo__filas">No pude calcular el costo ahora.</div>
      )}
      <SaldoSemaforo saldo={c.saldo} semaforo={c.semaforo} />
      {!enProduccion ? <span className="costo__nota">Imágenes, videos y música. La voz sale de tu plan de ElevenLabs.</span> : null}
    </div>
  );
}

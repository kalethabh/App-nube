// S.E.P › Objetivos y avance (2026-11-24): las metas por producto (pedidos/día y CPA máximo), el corte del día
// en 10 segundos, los KPIs contra la meta (con proyección de cierre y racha), la guía horaria y la bitácora de
// decisiones. Servidor: GET /api/sep/plan, POST /api/sep/objetivos | /avance | /bitacora (lib/sep-plan.js).
// Todo local, en mis_archivos/sep/plan.json.
import { useEffect, useState } from 'react';
import { Flame, NotebookPen, Plus, Save, Target, Trash2 } from 'lucide-react';
import { Boton, EstadoVacio, Esqueleto } from '../../componentes/index.js';
import { pedirNuevo, useDatos, refrescar } from '../../datos/api.js';
import { fechaRelativa } from '../../datos/formato.js';

const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const entero = (n) => new Intl.NumberFormat('es').format(Math.round(n || 0));
const dia = (f) => new Date(`${f}T12:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'short' });

/** Las barras de pedidos por día (14 días) contra la línea de la meta. */
function BarrasPedidos({ historial, meta }) {
  const max = Math.max(1, meta || 0, ...historial.map((h) => h.pedidos));
  const W = 640;
  const H = 150;
  const pad = { l: 30, r: 8, t: 8, b: 22 };
  const n = historial.length || 1;
  const paso = (W - pad.l - pad.r) / n;
  const ancho = Math.max(4, Math.min(26, paso - 4));
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  return (
    <figure className="sep-graf">
      <figcaption className="sep-graf__titulo">Pedidos por día (14 días){meta ? <span className="sep-leyenda">— — meta {entero(meta)}</span> : null}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Pedidos por día contra la meta">
        {[0, Math.round(max / 2), max].map((m) => (
          <g key={m}>
            <line className="sep-graf__grilla" x1={pad.l} x2={W - pad.r} y1={y(m)} y2={y(m)} />
            <text className="sep-graf__eje" x={pad.l - 6} y={y(m) + 4} textAnchor="end">{entero(m)}</text>
          </g>
        ))}
        {historial.map((h, i) => {
          const x = pad.l + i * paso + (paso - ancho) / 2;
          const alto = Math.max(h.pedidos ? 2 : 0, H - pad.b - y(h.pedidos));
          const cumple = meta && h.pedidos >= meta;
          return (
            <g key={h.fecha}>
              <rect className={cumple ? 'sep-plan__barra sep-plan__barra--ok' : 'sep-plan__barra'} x={x} y={H - pad.b - alto} width={ancho} height={alto} rx={Math.min(4, ancho / 2)}>
                <title>{`${dia(h.fecha)}: ${entero(h.pedidos)} pedidos${h.gasto ? ` · gasto ${pesos.format(h.gasto)}` : ''}`}</title>
              </rect>
              {i % 2 === 0 ? <text className="sep-graf__eje" x={x + ancho / 2} y={H - 7} textAnchor="middle">{dia(h.fecha)}</text> : null}
            </g>
          );
        })}
        {meta ? <line className="sep-plan__meta-linea" x1={pad.l} x2={W - pad.r} y1={y(Math.min(meta, max))} y2={y(Math.min(meta, max))} /> : null}
      </svg>
    </figure>
  );
}

export default function SepPlan() {
  const { datos, cargando, error } = useDatos('sep:plan', () => pedirNuevo('/api/sep/plan'));
  const [objetivos, setObjetivos] = useState(null); // la copia que se edita
  const [corte, setCorte] = useState({}); // { producto: '12', __gasto: '350000' }
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState('');
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    if (datos && objetivos === null) setObjetivos(datos.objetivos.map((o) => ({ ...o })));
  }, [datos, objetivos]);

  if (error) return <p className="sep-error" role="alert">{error.message}</p>;
  if (!datos) return <Esqueleto alto={420} />;
  const k = datos.kpis;
  const metaHay = k.metaTotal > 0;
  const pct = metaHay ? Math.min(100, Math.round((k.pedidosHoy / k.metaTotal) * 100)) : 0;
  const cpaBien = k.cpaHoy !== null && k.cpaMaxTotal ? k.cpaHoy <= k.cpaMaxTotal : null;

  const avisar = (t) => {
    setAviso(t);
    setTimeout(() => setAviso(''), 3500);
  };
  const recargar = () => refrescar('sep:plan');

  const guardarObjetivos = async () => {
    setGuardando('objetivos');
    try {
      await pedirNuevo('/api/sep/objetivos', { metodo: 'POST', cuerpo: { objetivos } });
      setObjetivos(null);
      recargar();
      avisar('Objetivos guardados.');
    } catch (e) {
      avisar(e.message);
    } finally {
      setGuardando('');
    }
  };

  const guardarCorte = async () => {
    const pedidos = {};
    for (const o of datos.objetivos) if (corte[o.producto] !== undefined && corte[o.producto] !== '') pedidos[o.producto] = Number(corte[o.producto]);
    setGuardando('corte');
    try {
      await pedirNuevo('/api/sep/avance', { metodo: 'POST', cuerpo: { pedidos, ...(corte.__gasto !== undefined && corte.__gasto !== '' ? { gasto: Number(corte.__gasto) } : {}) } });
      setCorte({});
      recargar();
      avisar('Corte del día guardado.');
    } catch (e) {
      avisar(e.message);
    } finally {
      setGuardando('');
    }
  };

  const anotarBitacora = async () => {
    if (!nota.trim()) return;
    setGuardando('bitacora');
    try {
      await pedirNuevo('/api/sep/bitacora', { metodo: 'POST', cuerpo: { texto: nota } });
      setNota('');
      recargar();
    } catch (e) {
      avisar(e.message);
    } finally {
      setGuardando('');
    }
  };

  return (
    <div className="pila" style={{ '--hueco': 'var(--e-5)' }}>
      {aviso ? <p className="sep-plan__aviso" role="status">{aviso}</p> : null}

      {/* los KPIs del día */}
      <section className="sep-kpis sep-kpis--cuatro" aria-label="El día de hoy">
        <div className="sep-kpi">
          <span className="sep-kpi__etiqueta">Pedidos hoy</span>
          <strong className="sep-kpi__valor">{entero(k.pedidosHoy)}{metaHay ? <small className="sep-kpi__de"> / {entero(k.metaTotal)}</small> : null}</strong>
          {metaHay ? (
            <>
              <span className="sep-plan__barra-progreso"><i style={{ width: `${pct}%` }} className={pct >= 100 ? 'ok' : ''} /></span>
              <span className={`sep-kpi__nota ${pct >= 100 ? 'sep-ok' : ''}`}>{pct} % de tu meta</span>
            </>
          ) : <span className="sep-kpi__nota">define tu meta abajo</span>}
        </div>
        <div className="sep-kpi">
          <span className="sep-kpi__etiqueta">CPA del día</span>
          <strong className="sep-kpi__valor">{k.cpaHoy === null ? '—' : pesos.format(k.cpaHoy)}</strong>
          <span className={`sep-kpi__nota ${cpaBien === null ? '' : cpaBien ? 'sep-ok' : 'sep-bajo'}`}>
            {k.cpaHoy === null ? 'anota pedidos y gasto' : k.cpaMaxTotal ? (cpaBien ? `dentro de tu tope (${pesos.format(k.cpaMaxTotal)})` : `sobre tu tope (${pesos.format(k.cpaMaxTotal)})`) : 'sin tope definido'}
          </span>
        </div>
        <div className="sep-kpi">
          <span className="sep-kpi__etiqueta">Proyección de cierre</span>
          <strong className="sep-kpi__valor">{k.proyeccion === null ? '—' : `~${entero(k.proyeccion)}`}</strong>
          <span className={`sep-kpi__nota ${k.proyeccion !== null && metaHay ? (k.proyeccion >= k.metaTotal ? 'sep-ok' : 'sep-bajo') : ''}`}>
            {k.proyeccion === null ? 'con el ritmo del día' : metaHay ? (k.proyeccion >= k.metaTotal ? 'cierras sobre la meta' : 'cierras bajo la meta') : 'pedidos al cierre'}
          </span>
        </div>
        <div className="sep-kpi">
          <span className="sep-kpi__etiqueta">Racha</span>
          <strong className="sep-kpi__valor"><Flame size={22} aria-hidden="true" className={k.racha ? 'sep-plan__fuego' : ''} /> {k.racha}</strong>
          <span className="sep-kpi__nota">{k.racha === 1 ? 'día cumpliendo la meta' : 'días seguidos cumpliendo'}</span>
        </div>
      </section>

      <div className="sep-plan__columnas">
        {/* el corte del día */}
        <section className="sep-plan__tarjeta" aria-label="Registra el corte del día">
          <h2><Save size={16} aria-hidden="true" /> El corte del día</h2>
          <p className="sep-plan__ayuda">Anota en 10 segundos cuántos pedidos llevas (los reales, de Lucid o iComfly) y el gasto de Meta. Puedes actualizarlo las veces que quieras: queda el último.{datos.hoy.actualizado ? ` Último corte ${fechaRelativa(datos.hoy.actualizado)}.` : ''}</p>
          {!datos.objetivos.length ? <p className="sep-plan__ayuda">Primero define tus objetivos (a la derecha).</p> : (
            <div className="sep-plan__corte">
              {datos.objetivos.map((o) => (
                <label key={o.id} className="sep-campo">
                  <span>{o.producto}</span>
                  <input type="number" min="0" step="1" inputMode="numeric" placeholder={String(datos.hoy.pedidos[o.producto] ?? 0)} value={corte[o.producto] ?? ''} onChange={(e) => setCorte((c) => ({ ...c, [o.producto]: e.target.value }))} />
                </label>
              ))}
              <label className="sep-campo">
                <span>Gasto de hoy (Meta)</span>
                <input type="number" min="0" step="1000" inputMode="numeric" placeholder={datos.hoy.gasto ? String(datos.hoy.gasto) : '$'} value={corte.__gasto ?? ''} onChange={(e) => setCorte((c) => ({ ...c, __gasto: e.target.value }))} />
              </label>
              <Boton variante="primario" tamano="chico" icono={Save} cargando={guardando === 'corte'} onClick={guardarCorte}>Guardar el corte</Boton>
            </div>
          )}
          {datos.guia.length ? (
            <div className="sep-plan__guia">
              <h3>Para cerrar en {entero(k.metaTotal)}, deberías llevar…</h3>
              <ul>
                {datos.guia.map((g) => {
                  const pasada = (() => {
                    const h = new Date().getHours();
                    const num = Number(g.hora.replace(/ .*/, '')) + (g.hora.endsWith('PM') && !g.hora.startsWith('12') ? 12 : 0) + (g.hora === '12 AM' ? 24 : 0);
                    return h >= num;
                  })();
                  return <li key={g.hora} className={pasada ? (k.pedidosHoy >= g.pedidos ? 'ok' : 'mal') : ''}><b>{g.hora}</b> {entero(g.pedidos)}</li>;
                })}
              </ul>
            </div>
          ) : null}
        </section>

        {/* los objetivos */}
        <section className="sep-plan__tarjeta" aria-label="Mis objetivos">
          <h2><Target size={16} aria-hidden="true" /> Mis objetivos</h2>
          <p className="sep-plan__ayuda">Por producto: la meta de pedidos al día y el CPA máximo que toleras (en pesos). El copiloto y los KPIs usan esto.</p>
          {(objetivos || []).map((o, i) => (
            <div key={o.id || i} className="sep-plan__objetivo">
              <input className="sep-plan__inp sep-plan__inp--nombre" placeholder="Producto (ej. Aguaje)" value={o.producto} onChange={(e) => setObjetivos((xs) => xs.map((x, j) => (j === i ? { ...x, producto: e.target.value } : x)))} />
              <input className="sep-plan__inp" type="number" min="1" inputMode="numeric" placeholder="pedidos/día" title="Meta de pedidos al día" value={o.meta || ''} onChange={(e) => setObjetivos((xs) => xs.map((x, j) => (j === i ? { ...x, meta: e.target.value } : x)))} />
              <input className="sep-plan__inp" type="number" min="0" step="500" inputMode="numeric" placeholder="CPA máx $" title="CPA máximo en pesos" value={o.cpaMax || ''} onChange={(e) => setObjetivos((xs) => xs.map((x, j) => (j === i ? { ...x, cpaMax: e.target.value } : x)))} />
              <input className="sep-plan__inp sep-plan__inp--nota" placeholder="nota (estabilizar, escalar…)" value={o.nota || ''} onChange={(e) => setObjetivos((xs) => xs.map((x, j) => (j === i ? { ...x, nota: e.target.value } : x)))} />
              <button type="button" className="sep-plan__borrar" title="Quitar este objetivo" onClick={() => setObjetivos((xs) => xs.filter((_, j) => j !== i))}><Trash2 size={15} aria-hidden="true" /></button>
            </div>
          ))}
          <div className="sep-plan__objetivo-botones">
            <Boton variante="secundario" tamano="chico" icono={Plus} onClick={() => setObjetivos((xs) => [...(xs || []), { producto: '', meta: '', cpaMax: '', nota: '' }])}>Agregar objetivo</Boton>
            <Boton variante="primario" tamano="chico" icono={Save} cargando={guardando === 'objetivos'} onClick={guardarObjetivos}>Guardar objetivos</Boton>
          </div>
        </section>
      </div>

      {datos.historial.some((h) => h.pedidos) ? <BarrasPedidos historial={datos.historial} meta={k.metaTotal} /> : null}

      {/* la bitácora */}
      <section className="sep-plan__tarjeta" aria-label="Bitácora de decisiones">
        <h2><NotebookPen size={16} aria-hidden="true" /> Bitácora de decisiones</h2>
        <p className="sep-plan__ayuda">Anota lo que hiciste («apagué el conjunto X», «dupliqué Y a 150K»): el copiloto la lee y no te recomienda dos veces lo mismo.</p>
        <div className="sep-plan__bitacora-form">
          <input className="sep-plan__inp sep-plan__inp--nota" placeholder="Qué decidiste hoy…" value={nota} onChange={(e) => setNota(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && anotarBitacora()} />
          <Boton variante="secundario" tamano="chico" icono={Plus} cargando={guardando === 'bitacora'} onClick={anotarBitacora}>Anotar</Boton>
        </div>
        {!datos.bitacora.length ? <EstadoVacio variante="compacto" icono={NotebookPen} titulo="Sin decisiones anotadas" descripcion="Lo que anotes acá queda con fecha y se lo paso al copiloto." /> : (
          <ul className="sep-plan__bitacora">
            {datos.bitacora.map((b) => (
              <li key={b.id}>
                <span className="sep-plan__bitacora-fecha">{dia(b.fecha.slice(0, 10))}</span>
                <span>{b.texto}</span>
                <button type="button" className="sep-plan__borrar" title="Borrar" onClick={async () => { await pedirNuevo(`/api/sep/bitacora/${b.id}`, { metodo: 'DELETE' }).catch(() => {}); recargar(); }}><Trash2 size={14} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

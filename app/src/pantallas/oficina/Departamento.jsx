// La supervisión de las cadenas de producción (2026-11-20):
//   <PanelDepartamento>  su flujo (cada estación con su agente y lo que hace), los trabajos activos, los que esperan o
//                        fallaron y los terminados. Tocas un trabajo y la oficina resalta su recorrido.
//   <PanelLinea>         una línea entre dos estaciones: qué pasa por ahí ahora y lo último que pasó.
//   <EstacionDeAgente>   en el panel de un agente: su estación, de quién recibe, a quién entrega y su trabajo actual.
// Todo sale de /api/oficina → produccion (lib/oficina-produccion.js): lo que registra la app, sin inventar nada.
import { ArrowRight, CornerDownLeft, X } from 'lucide-react';
import { fechaRelativa } from '../../datos/formato.js';
import { svgIcono } from './Oficina3D.jsx';

const ESTADO = { hecho: 'Hecho', trabajando: 'Trabajando', revisando: 'Revisando', corrigiendo: 'Corrigiendo', error: 'Se frenó', pendiente: 'Pendiente', esperando: 'Espera tu decisión' };
const TRABAJO = { activo: 'En marcha', 'te-necesita': 'Te necesita', error: 'Se frenó', pausado: 'Pausado', listo: 'Terminado' };

function Icono({ n }) {
  return <span className="of-ico" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svgIcono(n, 14) }} />;
}

export function PanelDepartamento({ dep, agentes, resaltar, onResaltar, onAgente, onCerrar }) {
  if (!dep) return null;
  const porId = Object.fromEntries(agentes.map((a) => [a.id, a]));
  const activos = dep.trabajos.filter((t) => t.estado === 'activo' || t.estado === 'te-necesita');
  const problemas = dep.trabajos.filter((t) => t.estado === 'error' || t.estado === 'pausado');
  const listos = dep.trabajos.filter((t) => t.estado === 'listo');
  const sel = dep.trabajos.find((t) => t.id === resaltar) || null;
  const Trabajos = ({ titulo, lista, vacio }) => (
    <section className="of-panel__seccion">
      <h3 className="of-panel__titulo">
        {titulo} <span className="t-num">{lista.length}</span>
      </h3>
      {lista.length ? (
        <ul className="of-trabajos">
          {lista.map((t) => (
            <li key={t.id}>
              <button type="button" className={`of-trabajo of-trabajo--${t.estado}${resaltar === t.id ? ' of-trabajo--elegido' : ''}`} onClick={() => onResaltar(resaltar === t.id ? null : t.id)} aria-pressed={resaltar === t.id}>
                <strong>{t.titulo}</strong>
                <span>
                  {TRABAJO[t.estado]} · {dep.estaciones.find((e) => e.id === t.actual)?.nombre || ''}
                  {t.detalle ? ` · ${t.detalle}` : ''}
                </span>
                {t.error ? <span className="of-rojo">{t.error.mensaje}</span> : null}
                {t.cuando ? <small>{fechaRelativa(t.cuando)}</small> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="of-panel__vacio">{vacio}</p>
      )}
    </section>
  );
  return (
    <aside className="of-panel" style={{ '--color': dep.color }}>
      <header className="of-panel__cabeza">
        <div className="of-panel__quien">
          <span className="of-cabeza__sobre">Departamento</span>
          <strong>{dep.nombre}</strong>
          <span>{dep.pronto ? 'En construcción: todavía sin herramientas en la app' : `${dep.estaciones.length} agentes en cadena`}</span>
        </div>
        <button type="button" className="of-panel__cerrar" onClick={onCerrar} aria-label="Cerrar">
          <X size={16} />
        </button>
      </header>
      <section className="of-panel__seccion">
        <h3 className="of-panel__titulo">{sel ? `El recorrido de «${sel.titulo}»` : 'Su cadena de producción'}</h3>
        <ol className="of-flujo">
          {dep.estaciones.map((e, k) => {
            const a = porId[e.agente];
            const est = sel ? sel.estaciones[e.id] : a?.enEstacion === 'pronto' ? null : ['trabajando', 'revisando', 'corrigiendo', 'error', 'esperando'].includes(a?.enEstacion) ? a.enEstacion : null;
            const vuelve = sel?.correcciones?.[e.id];
            return (
              <li key={e.id} className={`of-flujo__paso${est ? ` of-flujo__paso--${est}` : ''}${sel?.actual === e.id ? ' of-flujo__paso--actual' : ''}`}>
                <button type="button" onClick={() => a && onAgente(a.id)}>
                  <Icono n={e.icono} />
                  <span className="of-flujo__textos">
                    <strong>{e.nombre}</strong>
                    <span>
                      {a ? a.nombre : ''}
                      {est ? ` · ${ESTADO[est] || est}` : ''}
                    </span>
                  </span>
                  {vuelve ? (
                    <span className="of-flujo__vuelve" title="Lo que la revisión devolvió a esta estación">
                      <CornerDownLeft size={12} aria-hidden="true" /> {vuelve}
                    </span>
                  ) : null}
                </button>
                {k < dep.estaciones.length - 1 ? <ArrowRight className="of-flujo__flecha" size={12} aria-hidden="true" /> : null}
              </li>
            );
          })}
        </ol>
        {sel ? (
          <a className="of-boton of-boton--chico" href={sel.href}>
            Abrir «{sel.titulo}»
          </a>
        ) : null}
      </section>
      {dep.pronto ? (
        <p className="of-panel__vacio">
          Este departamento todavía no tiene herramientas en la app: sus agentes esperan quietos. Cuando esté listo, su cadena va a funcionar igual que las demás.{' '}
          {dep.href ? <a href={dep.href}>Ver la sección</a> : null}
        </p>
      ) : (
        <>
          <Trabajos titulo="En marcha" lista={activos} vacio="Nada en marcha ahora." />
          {problemas.length ? <Trabajos titulo="Se frenaron o esperan" lista={problemas} /> : null}
          <Trabajos titulo="Terminados" lista={listos} vacio="Todavía nada en los últimos días." />
        </>
      )}
    </aside>
  );
}

export function PanelLinea({ linea, dep, agentes, eventos, onCerrar }) {
  if (!linea || !dep) return null;
  const de = dep.estaciones.find((e) => e.id === linea.de);
  const a = dep.estaciones.find((e) => e.id === linea.a);
  const n = (est) => agentes.find((x) => x.id === est?.agente)?.nombre || '';
  // los trabajos que están justo en ese paso (lo de la estación de origen ya está hecho y la de destino trabaja)
  const pasando = dep.trabajos.filter((t) => t.estaciones?.[linea.de] === 'hecho' && ['trabajando', 'revisando', 'corrigiendo'].includes(t.estaciones?.[linea.a]));
  const ultimos = eventos.filter((e) => (e.de === linea.de && e.a === linea.a) || (e.de === linea.a && e.a === linea.de)).slice(0, 5);
  return (
    <aside className="of-panel" style={{ '--color': dep.color }}>
      <header className="of-panel__cabeza">
        <div className="of-panel__quien">
          <span className="of-cabeza__sobre">Línea de producción · {dep.nombre}</span>
          <strong>
            {de?.nombre} → {a?.nombre}
          </strong>
          <span>
            {n(de)} le entrega a {n(a)}
          </span>
        </div>
        <button type="button" className="of-panel__cerrar" onClick={onCerrar} aria-label="Cerrar">
          <X size={16} />
        </button>
      </header>
      <section className="of-panel__seccion">
        <h3 className="of-panel__titulo">Pasando por aquí ahora</h3>
        {pasando.length ? (
          <ul className="of-trabajos">
            {pasando.map((t) => (
              <li key={t.id}>
                <a className="of-trabajo" href={t.href}>
                  <strong>{t.titulo}</strong>
                  <span>{a?.nombre}: {ESTADO[t.estaciones[linea.a]]}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="of-panel__vacio">Nada en este paso ahora: la línea está en reposo.</p>
        )}
      </section>
      <section className="of-panel__seccion">
        <h3 className="of-panel__titulo">Lo último que pasó (desde que abriste la oficina)</h3>
        {ultimos.length ? (
          <ul className="of-eventos">
            {ultimos.map((e, i) => (
              <li key={i} className={`of-evento of-evento--${e.tipo}`}>
                {e.detalle} <small>{fechaRelativa(new Date(e.t).toISOString())}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="of-panel__vacio">Todavía nada.</p>
        )}
      </section>
      <p className="of-leyenda">
        <i className="of-leyenda__verde" /> pasa al siguiente · <i className="of-leyenda__naranja" /> la revisión lo devuelve · <i className="of-leyenda__roja" /> se frenó
      </p>
    </aside>
  );
}

export function EstacionDeAgente({ a, produccion, agentes }) {
  const dep = (produccion?.departamentos || []).find((d) => d.estaciones.some((e) => e.id === a.estacion));
  if (!dep) return null;
  const k = dep.estaciones.findIndex((e) => e.id === a.estacion);
  const e = dep.estaciones[k];
  const nombre = (x) => (x ? agentes.find((y) => y.id === x.agente)?.nombre || '' : '');
  const antes = dep.estaciones[k - 1];
  const despues = dep.estaciones[k + 1];
  const actual = dep.trabajos.find((t) => t.estado !== 'listo' && ['trabajando', 'revisando', 'corrigiendo', 'error'].includes(t.estaciones?.[e.id]));
  const correcciones = dep.trabajos.reduce((s, t) => s + (t.correcciones?.[e.id] || 0), 0);
  return (
    <section className="of-panel__seccion">
      <h3 className="of-panel__titulo">
        <Icono n={e.icono} /> {e.nombre} · {dep.nombre}
      </h3>
      <p className="of-panel__vacio">{e.hace || a.hace}</p>
      <div className="of-cadena">
        <span>{antes ? `Recibe de ${nombre(antes)} (${antes.nombre})` : 'Recibe de la coordinadora'}</span>
        <span>{despues ? `Entrega a ${nombre(despues)} (${despues.nombre})` : 'Entrega el resultado final'}</span>
      </div>
      {dep.pronto ? <p className="of-panel__vacio">Departamento en construcción: espera quieto hasta que tenga sus herramientas.</p> : null}
      {actual ? (
        <a className="of-trabajo" href={actual.href}>
          <strong>{actual.titulo}</strong>
          <span>{ESTADO[actual.estaciones[e.id]]}{actual.error?.estacion === e.id ? ` · ${actual.error.mensaje}` : ''}</span>
          {actual.cuando ? <small>{fechaRelativa(actual.cuando)}</small> : null}
        </a>
      ) : null}
      {correcciones ? <p className="of-panel__vacio">La revisión le devolvió {correcciones} {correcciones === 1 ? 'cosa' : 'cosas'} para corregir en los trabajos de estos días.</p> : null}
    </section>
  );
}

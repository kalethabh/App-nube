// «Tu equipo trabajando ahora» en Progreso (2026-11-20i, «cuando los agentes estén trabajando que también me salga en
// progreso»): lo que tienen entre manos los agentes de la oficina, de TODOS los departamentos (anuncios de imagen,
// investigación de mercado y competencia, los guiones que se están escribiendo…), con su cadena de pasos: cuáles están
// hechos, en cuál va, quién lo tiene y si algo se frenó. Los videos que ya se están produciendo salen arriba, en
// «En producción» (aquí no se repiten). Sale de /api/oficina → produccion (lib/oficina-produccion.js): lo real.
import { ArrowRight, Building2 } from 'lucide-react';
import { Seccion } from '../../componentes/index.js';
import { pedirNuevo, useDatos } from '../../datos/api.js';
import { enlace } from '../../datos/rutas.js';
import { fechaRelativa } from '../../datos/formato.js';

const EN_MARCHA = new Set(['activo', 'te-necesita', 'pausado', 'error']);
const ESTADO = { activo: 'Trabajando', 'te-necesita': 'Te necesita', pausado: 'En pausa', error: 'Se frenó' };
const PASO = { trabajando: 'trabajando', revisando: 'revisando', corrigiendo: 'corrigiendo', error: 'se frenó', esperando: 'espera tu decisión' };

export function EquipoTrabajando() {
  const { datos } = useDatos('oficina', () => pedirNuevo('/api/oficina'), { cadaMs: 6000 });
  const deps = datos?.produccion?.departamentos || [];
  const agentes = new Map((datos?.agentes || []).map((a) => [a.id, a]));
  const lista = deps.flatMap((d) =>
    (d.trabajos || [])
      // los videos ya en producción salen en «En producción» y los guiones por aprobar en «Te necesitan»: aquí, solo
      // el guion mientras se escribe (o si se frenó)
      .filter((t) => EN_MARCHA.has(t.estado) && !(d.id === 'video' && (/\/produccion$/.test(t.href || '') || t.estado === 'te-necesita')))
      .map((t) => ({ ...t, dep: d })),
  );
  if (!lista.length) return null;
  return (
    <Seccion titulo="Tu equipo trabajando ahora" descripcion="Lo que tienen tus agentes de la oficina en este momento, paso por paso." acciones={<a className="tb-eq__oficina" href={enlace.oficina()}><Building2 size={14} aria-hidden="true" /> Ver la oficina</a>}>
      <ul className="tb-eq">
        {lista.map((t) => {
          const est = t.dep.estaciones.find((e) => e.id === t.actual) || null;
          const quien = est ? agentes.get(est.agente) : null;
          const hechas = t.dep.estaciones.filter((e) => t.estaciones?.[e.id] === 'hecho').length;
          const estPaso = est ? t.estaciones?.[est.id] : null;
          return (
            <li key={`${t.dep.id}-${t.id}`}>
              <a className={`tb-eq__item tb-eq__item--${t.estado}`} href={t.href} style={{ '--color': t.dep.color || '#ffc774' }}>
                <span className="tb-eq__cabeza">
                  <span className="tb-eq__dep">{t.dep.nombre}</span>
                  <span className={`tb-eq__estado tb-eq__estado--${t.estado}`}>{ESTADO[t.estado]}</span>
                </span>
                <strong className="tb-eq__titulo">{t.titulo}</strong>
                <span className="tb-eq__ahora">
                  {quien ? <span aria-hidden="true">{quien.avatar}</span> : null}
                  {quien ? `${quien.nombre} · ` : ''}
                  {est ? est.nombre : ''}
                  {estPaso && PASO[estPaso] ? ` · ${PASO[estPaso]}` : ''}
                  {t.detalle ? ` · ${t.detalle}` : ''}
                </span>
                <span className="tb-eq__cadena" aria-label={`${hechas} de ${t.dep.estaciones.length} pasos hechos`}>
                  {t.dep.estaciones.map((e) => {
                    const s = t.estaciones?.[e.id] || 'pendiente';
                    return <i key={e.id} className={`tb-eq__paso tb-eq__paso--${s}${e.id === t.actual ? ' tb-eq__paso--actual' : ''}`} title={`${e.nombre}: ${PASO[s] || (s === 'hecho' ? 'hecho' : 'pendiente')}`} />;
                  })}
                  <small>
                    {hechas}/{t.dep.estaciones.length}
                  </small>
                </span>
                {t.error?.mensaje ? <span className="tb-eq__error">{t.error.mensaje}</span> : null}
                <span className="tb-eq__pie">
                  {t.cuando ? fechaRelativa(t.cuando) : ''}
                  <ArrowRight size={14} aria-hidden="true" />
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </Seccion>
  );
}

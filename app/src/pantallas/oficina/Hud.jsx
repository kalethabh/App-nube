// Los paneles que flotan sobre la oficina 3D (2026-11-20, «diseño profesional, que la visual ocupe más espacio»):
//   <Recorrido>  el recorrido guiado que enseña a usar la oficina (la cámara va a cada sala y explica qué hace)
//   <Minimapa>   el plano desde arriba con las salas y los agentes en vivo; tocas una sala y la cámara va allá
//   <Actividad>  lo que pasa en la oficina: lo que te necesita, lo que se está haciendo, lo terminado y las charlas
//   <Vistas>     general, desde arriba, modo cine y de día o de noche
import { useMemo } from 'react';
import { ArrowLeft, ArrowRight, Clapperboard, Compass, Map as MapaIcono, Moon, Orbit, Sun, X } from 'lucide-react';
import { fechaRelativa } from '../../datos/formato.js';
import { LUGAR } from './Oficina3D.jsx';

// ---------------------------------------------------------------- el recorrido guiado

export function pasosDelRecorrido(agentes, nombreOficina) {
  const n = (id) => agentes.find((a) => a.id === id)?.nombre || '';
  return [
    { titulo: `Bienvenido a ${nombreOficina}`, texto: 'Tu empresa digital: seis departamentos de agentes de IA alrededor del logo K. Cada agente hace una parte REAL del trabajo y se la entrega al siguiente. Lo que ves aquí está pasando de verdad en la app.', vista: 'general' },
    { titulo: `${n('coordinacion')}, la coordinación`, texto: `Recibe tus pedidos, los manda al departamento que corresponde y te avisa lo que espera tu decisión. Háblale con «Hablar con ${n('coordinacion')}». Nada se cobra sin tu sí.`, agente: 'coordinacion' },
    { titulo: 'Anuncios de video', texto: 'Seis agentes en cadena: guion → plan → imágenes → producción → edición → revisión. El revisor devuelve lo que hay que rehacer. Toca el departamento para ver su flujo y sus trabajos.', zona: 'video' },
    { titulo: 'Anuncios de imagen', texto: 'Investigación → estrategia → prompts → generación → control de calidad → entrega. Si la revisión no aprueba una imagen, vuelve a los prompts para ajustarla.', zona: 'imagen' },
    { titulo: 'Investigación de mercado', texto: 'Recopila tu mercado, investiga la competencia en TrendTrack, arma el avatar, saca las oportunidades y entrega el informe.', zona: 'investigacion' },
    { titulo: 'Las líneas de producción', texto: 'Gris: en reposo. Verde: una parte pasa al siguiente agente (verás una luz viajar). Naranja: la revisión devuelve algo para corregir. Rojo: algo se frenó. Solo se mueven cuando de verdad pasa algo.', zona: 'video' },
    { titulo: 'Los íconos de cada agente', texto: 'Cada agente tiene su ícono: lo que hace, o lo que le pasa (✓ revisando, ↩ corrigiendo, ⚠ error, 🕒 esperando). Su anillo en el piso se enciende con el color de su estado. Tócalo y ves su estación, de quién recibe y a quién entrega.', vista: 'general' },
    { titulo: 'En construcción', texto: 'Landing pages, embudos de WhatsApp y análisis ya tienen su equipo sentado, pero todavía no tienen herramientas en la app: esperan quietos hasta que estén listos.', zona: 'landing' },
    { titulo: 'Diseña tu oficina', texto: 'Con «Diseñar» cambias los departamentos de lugar, sus nombres y colores, y creas tus propias oficinas en la fila de adelante.', vista: 'general' },
    { titulo: 'Tu equipo aprende', texto: 'Cuando termines un anuncio, dale 👍 o 👎 y cuenta qué te gustó: se vuelve una regla que tu equipo usa la próxima vez.', vista: 'general' },
    { titulo: 'Muévete por la oficina', texto: 'Arrastra para girar, rueda para acercarte. Abajo tienes el minimapa (toca un departamento y vas allá), la vista desde arriba, el modo cine y día o noche.', vista: 'cine' },
  ];
}

export function Recorrido({ pasos, paso, onPaso, onCerrar }) {
  const p = pasos[paso];
  if (!p) return null;
  const ultimo = paso === pasos.length - 1;
  return (
    <div className="of-recorrido of-vidrio" role="dialog" aria-label="Recorrido por la oficina">
      <div className="of-recorrido__cabeza">
        <span className="of-recorrido__paso">
          <Compass size={13} aria-hidden="true" /> Recorrido · {paso + 1} de {pasos.length}
        </span>
        <button type="button" className="of-icono" onClick={onCerrar} aria-label="Cerrar el recorrido">
          <X size={15} />
        </button>
      </div>
      <h3 className="of-recorrido__titulo">{p.titulo}</h3>
      <p className="of-recorrido__texto">{p.texto}</p>
      <div className="of-recorrido__pie">
        <div className="of-recorrido__puntos" aria-hidden="true">
          {pasos.map((_, i) => (
            <span key={i} className={i === paso ? 'activo' : i < paso ? 'visto' : ''} />
          ))}
        </div>
        <div className="of-recorrido__botones">
          {paso > 0 ? (
            <button type="button" className="of-boton" onClick={() => onPaso(paso - 1)}>
              <ArrowLeft size={14} aria-hidden="true" /> Anterior
            </button>
          ) : null}
          <button type="button" className="of-boton of-boton--primario" onClick={() => (ultimo ? onCerrar() : onPaso(paso + 1))}>
            {ultimo ? '¡Listo!' : 'Siguiente'} {ultimo ? null : <ArrowRight size={14} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- el minimapa

export function Minimapa({ zonas, agentes, posiciones, onZona }) {
  const filaNueva = zonas.some((z) => z.lugar >= 8);
  const zMax = filaNueva ? 27.5 : 17.5;
  const alto = zMax + 17.5;
  const color = Object.fromEntries(agentes.map((a) => [a.id, a]));
  return (
    <div className="of-minimapa of-vidrio">
      <span className="of-minimapa__titulo">
        <MapaIcono size={12} aria-hidden="true" /> Planta
      </span>
      <svg viewBox={`-23.5 -17.5 47 ${alto}`} role="group" aria-label="El plano de la oficina: toca un departamento para ir allá">
        <rect x="-23.5" y="-17.5" width="47" height={alto} rx="1.2" className="of-minimapa__piso" />
        <circle cx="0" cy="0" r="3.4" className="of-minimapa__logo" />
        {zonas.map((z) => {
          const g = LUGAR[z.lugar];
          if (!g) return null;
          return (
            <g key={z.id} className="of-minimapa__sala" onClick={() => onZona(z.id)} role="button" tabIndex={0} aria-label={`Ir a ${z.nombre}`} onKeyDown={(e) => (e.key === 'Enter' ? onZona(z.id) : null)}>
              <rect x={g.x - g.w / 2 + 0.3} y={g.z - g.d / 2 + 0.3} width={g.w - 0.6} height={g.d - 0.6} rx="0.8" style={{ '--color': z.color }} className={z.pronto ? 'pronto' : ''} />
              <text x={g.x} y={g.z + 0.7} textAnchor="middle">{String(z.nombre).slice(0, 18)}</text>
            </g>
          );
        })}
        {Object.entries(posiciones || {}).map(([id, [x, z]]) => (
          <circle key={id} cx={x} cy={z} r="0.6" className={`of-minimapa__agente of-minimapa__agente--${color[id]?.estado || 'libre'}`} style={{ '--color': color[id]?.color || '#94a3b8' }}>
            <title>{color[id]?.nombre}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------- la actividad

export function Actividad({ agentes, eventos = [], departamentos = [], abierta, onAbrir, onAgente }) {
  const items = useMemo(() => {
    const l = [];
    for (const a of agentes) {
      for (const t of a.necesita || []) if (a.id !== 'coordinacion') l.push({ tipo: 'necesita', a, texto: t.detalle && /se frenó|espera/.test(t.titulo) ? `${t.titulo}: ${t.detalle}` : t.titulo, href: t.href, cuando: t.cuando });
      for (const t of (a.ahora || []).slice(0, 2)) l.push({ tipo: 'ahora', a, texto: t.titulo, href: t.href, cuando: t.cuando });
      for (const t of (a.hechos || []).slice(0, 3)) l.push({ tipo: 'hecho', a, texto: t.titulo, href: t.href, cuando: t.cuando });
    }
    l.sort((x, y) => (y.tipo === 'necesita') - (x.tipo === 'necesita') || String(y.cuando || '').localeCompare(String(x.cuando || '')));
    return l;
  }, [agentes]);
  // las transferencias reales que vio la oficina (verde: pasa, naranja: la revisión devuelve, rojo: se frenó)
  const nombreEst = Object.fromEntries(departamentos.flatMap((d) => d.estaciones.map((e) => [e.id, e.nombre])));
  const vivo = [...eventos.map((e) => ({ ...e, tipo: `evento-${e.tipo}` })), ...items].slice(0, abierta ? 30 : 4);
  return (
    <section className={`of-actividad of-vidrio${abierta ? ' of-actividad--abierta' : ''}`} aria-label="Lo que pasa en la oficina">
      <button type="button" className="of-actividad__cabeza" onClick={onAbrir} aria-expanded={abierta}>
        <span className="of-vivo" aria-hidden="true" /> En vivo
        <small>{abierta ? 'Ver menos' : 'Ver todo'}</small>
      </button>
      {vivo.length ? (
        <ul className="of-actividad__lista">
          {vivo.map((x, i) =>
            x.tipo.startsWith('evento-') ? (
              <li key={`e${x.t}${i}`} className={`of-actividad__item of-actividad__item--${x.tipo}`}>
                <span className="of-actividad__icono" aria-hidden="true">{x.tipo === 'evento-pasa' ? '→' : x.tipo === 'evento-devuelve' ? '↩' : x.tipo === 'evento-listo' ? '🎉' : '!'}</span>
                <span>
                  {x.detalle} <small>· {nombreEst[x.de] || 'Coordinación'} → {nombreEst[x.a] || ''}</small>
                </span>
              </li>
            ) : (
              <li key={i} className={`of-actividad__item of-actividad__item--${x.tipo}`} style={{ '--color': x.a.color }}>
                <button type="button" className="of-actividad__quien" onClick={() => onAgente(x.a.id)} aria-label={`Ver a ${x.a.nombre}`}>
                  {x.a.avatar}
                </button>
                <a href={x.href || undefined}>
                  <b>{x.a.nombre}</b> {x.tipo === 'necesita' ? 'te necesita: ' : x.tipo === 'hecho' ? '' : 'trabaja en '}
                  {x.texto}
                  {x.cuando ? <small> · {fechaRelativa(x.cuando)}</small> : null}
                </a>
              </li>
            )
          )}
        </ul>
      ) : (
        <p className="of-actividad__vacio">Todo tranquilo. Pídele algo a tu coordinadora y verás a tu equipo moverse.</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- las vistas

export function Vistas({ vista, onVista, modo, onModo }) {
  const b = (id, Icono, texto) => (
    <button type="button" className={`of-vista${vista === id ? ' of-vista--activa' : ''}`} onClick={() => onVista(id)} aria-pressed={vista === id} title={texto}>
      <Icono size={15} aria-hidden="true" /> <span>{texto}</span>
    </button>
  );
  return (
    <div className="of-vistas of-vidrio" role="group" aria-label="Vistas de la oficina">
      {b('general', Orbit, 'General')}
      {b('arriba', MapaIcono, 'Arriba')}
      {b('cine', Clapperboard, 'Cine')}
      <button type="button" className="of-vista" onClick={() => onModo(modo === 'dia' ? 'noche' : 'dia')} title={modo === 'dia' ? 'Pasar a la noche' : 'Pasar al día'}>
        {modo === 'dia' ? <Moon size={15} aria-hidden="true" /> : <Sun size={15} aria-hidden="true" />} <span>{modo === 'dia' ? 'Noche' : 'Día'}</span>
      </button>
    </div>
  );
}

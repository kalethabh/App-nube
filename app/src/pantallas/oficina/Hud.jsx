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
    { titulo: `Bienvenido a ${nombreOficina}`, texto: 'Aquí trabaja tu equipo de agentes de IA. Cada uno hace una parte REAL de tus anuncios: lo que ves aquí está pasando de verdad en la app.', vista: 'general' },
    { titulo: `${n('coordinacion')}, tu coordinadora`, texto: `Reparte el trabajo y te avisa lo que espera tu decisión. Toca «Hablar con ${n('coordinacion')}» y pídele anuncios, investigaciones o pregúntale cómo va todo. Nada se cobra sin tu sí.`, agente: 'coordinacion' },
    { titulo: `${n('guion')} escribe los guiones`, texto: 'Usa tu investigación y lo que aprendió de tus correcciones. Cuando un guion espera tu aprobación, se pone en rojo y te saluda.', agente: 'guion' },
    { titulo: `${n('arte')}, dirección de arte`, texto: 'Crea las personas, las escenas y los anuncios de imagen. Sus pantallas grandes muestran la última imagen que se generó.', agente: 'arte' },
    { titulo: `${n('video')} produce los videos`, texto: 'Genera los clips, las voces y la música. En la pantalla de su estudio ves el último clip que salió.', agente: 'video' },
    { titulo: `${n('edicion')} arma el montaje`, texto: 'Junta todo, pone los subtítulos y exporta. En su oficina de vidrio ves lo último que entregó.', agente: 'edicion' },
    { titulo: `${n('calidad')} revisa la calidad`, texto: 'Mira cada imagen y cada clip antes de entregar, y deja avisos si algo hay que rehacer.', agente: 'calidad' },
    { titulo: `${n('investigacion')} investiga`, texto: 'Estudia tu mercado y tu competencia en TrendTrack. Lo que encuentra alimenta los guiones.', agente: 'investigacion' },
    { titulo: 'Los colores te dicen todo', texto: 'Verde: está trabajando. Rojo: te necesita (tócalo y vas directo a lo que espera). Naranja: una IA que usa está caída. Gris: está libre, camina, toma café y conversa con los demás.', vista: 'general' },
    { titulo: 'Diseña tu oficina', texto: 'Con «Diseñar oficina» mueves las salas, les cambias el nombre y el color, y creas las tuyas. Las de «Próximamente» están en construcción.', zona: 'landings' },
    { titulo: 'Tu equipo aprende', texto: 'Cuando termines un anuncio, dale 👍 o 👎 y cuenta qué te gustó. Se vuelve una regla que tu equipo usa la próxima vez: lo ves en «Lo que aprendió» de cada agente.', vista: 'general' },
    { titulo: 'Muévete por la oficina', texto: 'Arrastra para girar y usa la rueda para acercarte. Abajo tienes el minimapa (toca una sala y vas allá), la vista desde arriba, el modo cine y día o noche.', vista: 'cine' },
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
  const filaNueva = zonas.some((z) => z.lugar >= 9);
  const zMax = filaNueva ? 25.4 : 15.2;
  const alto = zMax + 15;
  const color = Object.fromEntries(agentes.map((a) => [a.id, a]));
  return (
    <div className="of-minimapa of-vidrio">
      <span className="of-minimapa__titulo">
        <MapaIcono size={12} aria-hidden="true" /> Planta
      </span>
      <svg viewBox={`-19 -15 38 ${alto}`} role="group" aria-label="El plano de la oficina: toca una sala para ir allá">
        <rect x="-19" y="-15" width="38" height={alto} rx="1.2" className="of-minimapa__piso" />
        <rect x="-3.7" y="-3" width="7.4" height="4.8" rx="1" className="of-minimapa__logo" />
        {zonas.map((z) => {
          const g = LUGAR[z.lugar];
          if (!g) return null;
          return (
            <g key={z.id} className="of-minimapa__sala" onClick={() => onZona(z.id)} role="button" tabIndex={0} aria-label={`Ir a ${z.nombre}`} onKeyDown={(e) => (e.key === 'Enter' ? onZona(z.id) : null)}>
              <rect x={g.x - g.w / 2 + 0.3} y={g.z - g.d / 2 + 0.3} width={g.w - 0.6} height={g.d - 0.6} rx="0.8" style={{ '--color': z.color }} className={z.pronto ? 'pronto' : ''} />
              <text x={g.x} y={g.z + 0.6} textAnchor="middle">{String(z.nombre).slice(0, 13)}</text>
            </g>
          );
        })}
        {Object.entries(posiciones || {}).map(([id, [x, z]]) => (
          <circle key={id} cx={x} cy={z} r="0.75" className={`of-minimapa__agente of-minimapa__agente--${color[id]?.estado || 'libre'}`} style={{ '--color': color[id]?.color || '#94a3b8' }}>
            <title>{color[id]?.nombre}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------- la actividad

export function Actividad({ agentes, charlas, abierta, onAbrir, onAgente }) {
  const items = useMemo(() => {
    const l = [];
    for (const a of agentes) {
      for (const t of a.necesita || []) if (a.id !== 'coordinacion') l.push({ tipo: 'necesita', a, texto: t.titulo, href: t.href, cuando: t.cuando });
      for (const t of (a.ahora || []).slice(0, 2)) l.push({ tipo: 'ahora', a, texto: t.titulo, href: t.href, cuando: t.cuando });
      for (const t of (a.hechos || []).slice(0, 3)) l.push({ tipo: 'hecho', a, texto: t.titulo, href: t.href, cuando: t.cuando });
    }
    l.sort((x, y) => (y.tipo === 'necesita') - (x.tipo === 'necesita') || String(y.cuando || '').localeCompare(String(x.cuando || '')));
    return l;
  }, [agentes]);
  const vivo = [...charlas.map((c) => ({ tipo: 'charla', ...c })), ...items].slice(0, abierta ? 30 : 4);
  return (
    <section className={`of-actividad of-vidrio${abierta ? ' of-actividad--abierta' : ''}`} aria-label="Lo que pasa en la oficina">
      <button type="button" className="of-actividad__cabeza" onClick={onAbrir} aria-expanded={abierta}>
        <span className="of-vivo" aria-hidden="true" /> En vivo
        <small>{abierta ? 'Ver menos' : 'Ver todo'}</small>
      </button>
      {vivo.length ? (
        <ul className="of-actividad__lista">
          {vivo.map((x, i) =>
            x.tipo === 'charla' ? (
              <li key={`c${x.t}`} className="of-actividad__item of-actividad__item--charla">
                <span className="of-actividad__icono">💬</span>
                <span>
                  <b>{x.nombres.join(' y ')}</b> conversan: «{x.texto}»
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

// Los tres paneles del medio del inicio: el saldo de las APIs, la salud de las plataformas y los modelos más usados.
import { BarraDeProgreso, Esqueleto, PuntoEstado } from '../../componentes/index.js';
import { enlace } from '../../datos/rutas.js';
import { dolares, vozLibre } from '../../datos/saldo.js';
import { fechaRelativa, numero } from '../../datos/formato.js';

const TONO = { operativo: 'ok', lento: 'aviso', degradado: 'aviso', caido: 'error', desconocido: 'neutro' };
const TEXTO = { operativo: 'Operativo', lento: 'Lento', degradado: 'Con fallas', caido: 'Sin respuesta', desconocido: 'Sin revisar' };
const GENERAL = { operativo: 'Todo operativo', lento: 'Algo va lento', degradado: 'Un servicio tiene fallas', caido: 'Un servicio no responde', desconocido: 'Revisando…' };

function Tarjeta({ titulo, enlaceTexto, href, children, className = '' }) {
  return (
    <section className={`ini-tarjeta ${className}`} aria-label={titulo}>
      <header className="ini-tarjeta__cabecera">
        <h2 className="ini-tarjeta__titulo">{titulo}</h2>
        {href ? (
          <a className="ini-tarjeta__enlace" href={href}>
            {enlaceTexto}
          </a>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function Saldo({ s, cargando }) {
  const voz = s?.elevenlabs;
  const usado = voz?.limite ? Math.min(100, ((voz.usados || 0) / voz.limite) * 100) : null;
  return (
    <Tarjeta titulo="Saldo" enlaceTexto="Ver costos" href={enlace.saldo()}>
      {cargando ? (
        <Esqueleto forma="texto" lineas={3} />
      ) : (
        <div className="ini-saldo">
          <div className="ini-saldo__fila">
            <span className="ini-saldo__nombre">kie.ai</span>
            <span className="ini-saldo__valor t-num">{dolares(s?.kie) || '—'}</span>
            <span className="ini-saldo__detalle">{s?.kie?.creditos != null ? `${numero(Math.round(s.kie.creditos))} créditos` : 'sin clave o sin respuesta'}</span>
          </div>
          <div className="ini-saldo__fila">
            <span className="ini-saldo__nombre">ElevenLabs</span>
            <span className="ini-saldo__valor t-num">{vozLibre(voz) || '—'}</span>
            <span className="ini-saldo__detalle">{voz?.plan ? `plan ${voz.plan}` : 'caracteres de voz'}</span>
            {usado != null ? <BarraDeProgreso valor={100 - usado} tono={usado > 85 ? 'error' : usado > 65 ? 'aviso' : 'ok'} grosor="fina" /> : null}
          </div>
        </div>
      )}
    </Tarjeta>
  );
}

export function Plataformas({ s }) {
  const servicios = s ? s.grupos.flatMap((g) => g.servicios) : null;
  return (
    <Tarjeta titulo="Plataformas">
      {!servicios ? (
        <Esqueleto forma="texto" lineas={4} />
      ) : (
        <>
          <p className={`ini-salud__general ini-salud__general--${TONO[s.general] || 'neutro'}`}>
            <PuntoEstado tono={TONO[s.general] || 'neutro'} />
            {GENERAL[s.general] || 'Revisando…'}
          </p>
          <ul className="ini-salud">
            {servicios.map((x) => (
              <li key={x.id} className="ini-salud__fila" title={x.estado !== 'operativo' && x.detalle ? x.detalle : undefined}>
                <PuntoEstado tono={TONO[x.estado] || 'neutro'} />
                <span className="ini-salud__nombre">{x.nombre}</span>
                <span className={`ini-salud__estado ini-salud__estado--${TONO[x.estado] || 'neutro'}`}>{TEXTO[x.estado] || x.estado}</span>
              </li>
            ))}
          </ul>
          <p className="ini-tarjeta__nota">Revisado {fechaRelativa(s.revisado)}</p>
        </>
      )}
    </Tarjeta>
  );
}

export function Modelos({ modelos }) {
  const max = Math.max(1, ...(modelos || []).map((m) => m.piezas || 0));
  return (
    <Tarjeta titulo="Modelos de la semana">
      {!modelos ? (
        <Esqueleto forma="texto" lineas={4} />
      ) : modelos.length ? (
        <>
          <ul className="ini-modelos">
            {modelos.map((m) => (
              <li key={m.nombre} className="ini-modelos__fila">
                <span className="ini-modelos__nombre">
                  {m.estado === 'degradado' ? <PuntoEstado tono="aviso" etiqueta="Con fallas hoy" /> : null}
                  {m.nombre}
                </span>
                <span className="ini-modelos__pista" aria-hidden="true">
                  <span className="ini-modelos__barra" style={{ width: `${Math.max(2, ((m.piezas || 0) / max) * 100)}%` }} />
                </span>
                <span className="ini-modelos__valor t-num">{numero(m.piezas || 0)}</span>
              </li>
            ))}
          </ul>
          <p className="ini-tarjeta__nota">Piezas generadas en los últimos 7 días</p>
        </>
      ) : (
        <p className="ini-vacio ini-vacio--texto">Esta semana todavía no se generó nada.</p>
      )}
    </Tarjeta>
  );
}

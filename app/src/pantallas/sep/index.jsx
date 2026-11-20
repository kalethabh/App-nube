// #/sep — S.E.P (2026-11-20k): tus anuncios de Meta que más venden, en tarjetas, con sus métricas y lo que el sistema
// S.E.P sugiere para cada uno: ESCALAR (subir presupuesto y duplicar), hacer VARIACIONES (con el agente de imágenes),
// SOSTENER, PAUSAR o seguir PROBANDO. Arriba, las cifras del rango y dos gráficas (compras por día; ingresos y gasto
// por día). Servidor: GET /api/sep/cuentas, /api/sep/informe, /api/sep/imagen/:id (lib/sep.js). Solo lee tu cuenta.
//
// Gráficas (guía dataviz): una sola escala por gráfica (nunca doble eje: las compras van aparte de los dólares),
// marcas finas con extremos redondeados, leyenda con dos series, tooltip al pasar, y la tabla como alternativa.
// Colores validados (validate_palette.js): ingresos/compras #65a30d, gasto #2563eb (claro) / #3b82f6 (oscuro).
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Hourglass, ImagePlus, LayoutGrid, Minus, PauseCircle, RefreshCw, Rocket, Settings, Shuffle, Table2, TrendingUp } from 'lucide-react';
import { Boton, CabeceraPagina, Esqueleto, EstadoVacio } from '../../componentes/index.js';
import { pedirNuevo, useDatos } from '../../datos/api.js';
import { enlace } from '../../datos/rutas.js';
import { fechaRelativa } from '../../datos/formato.js';
import './sep.css';

const DECISION = {
  escalar: { texto: 'Escalar', icono: TrendingUp, tono: 'bien', ayuda: 'Vende bien y sin fatiga' },
  variar: { texto: 'Hacer variaciones', icono: Shuffle, tono: 'aviso', ayuda: 'Rinde, pero se está cansando' },
  sostener: { texto: 'Sostener', icono: Minus, tono: 'neutro', ayuda: 'Cerca de tu objetivo' },
  probando: { texto: 'Probando', icono: Hourglass, tono: 'neutro', ayuda: 'Todavía pocos datos' },
  pausar: { texto: 'Pausar', icono: PauseCircle, tono: 'mal', ayuda: 'Gasta sin vender' },
};
const ORDEN = ['escalar', 'variar', 'sostener', 'probando', 'pausar'];
const RANGOS = [['7d', '7 días'], ['14d', '14 días'], ['30d', '30 días'], ['90d', '90 días']];
const PREF = 'sep:preferencias';
const leerPref = () => {
  try {
    return JSON.parse(localStorage.getItem(PREF) || '{}');
  } catch {
    return {};
  }
};
const guardarPref = (p) => {
  try {
    localStorage.setItem(PREF, JSON.stringify(p));
  } catch {
    /* sin almacenamiento */
  }
};

const fmt = (moneda) => {
  const m = new Intl.NumberFormat('es-CO', { style: 'currency', currency: moneda || 'USD', maximumFractionDigits: 2 });
  const corto = new Intl.NumberFormat('es-CO', { style: 'currency', currency: moneda || 'USD', notation: 'compact', maximumFractionDigits: 1 });
  return { dinero: (n) => (n === null || n === undefined ? '—' : m.format(n)), corto: (n) => corto.format(n || 0) };
};
const entero = (n) => new Intl.NumberFormat('es').format(Math.round(n || 0));
const dia = (f) => new Date(`${f}T12:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'short' });

// ---------------------------------------------------------------- gráficas (SVG a mano)

function useTooltip() {
  const [t, setT] = useState(null);
  return [t, setT];
}

/** Compras por día: barras finas, una serie. */
function Barras({ serie, campo, titulo, formato }) {
  const [tip, setTip] = useTooltip();
  const W = 640;
  const H = 200;
  const pad = { l: 34, r: 8, t: 10, b: 26 };
  const max = Math.max(1, ...serie.map((d) => d[campo]));
  const n = serie.length || 1;
  const paso = (W - pad.l - pad.r) / n;
  const ancho = Math.max(2, Math.min(18, paso - 2));
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const marcas = [0, Math.round(max / 2), max];
  const cadaEtiqueta = Math.ceil(n / 6);
  return (
    <figure className="sep-graf">
      <figcaption className="sep-graf__titulo">{titulo}</figcaption>
      <div className="sep-graf__caja" onMouseLeave={() => setTip(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={titulo}>
          {marcas.map((m) => (
            <g key={m}>
              <line className="sep-graf__grilla" x1={pad.l} x2={W - pad.r} y1={y(m)} y2={y(m)} />
              <text className="sep-graf__eje" x={pad.l - 6} y={y(m) + 4} textAnchor="end">{formato(m)}</text>
            </g>
          ))}
          {serie.map((d, i) => {
            const x = pad.l + i * paso + (paso - ancho) / 2;
            const alto = Math.max(d[campo] ? 2 : 0, H - pad.b - y(d[campo]));
            return (
              <g key={d.fecha}>
                <rect className="sep-graf__hit" x={pad.l + i * paso} y={pad.t} width={paso} height={H - pad.t - pad.b} onMouseEnter={() => setTip({ x: ((pad.l + i * paso + paso / 2) / W) * 100, d })} />
                <path className={`sep-graf__barra${tip?.d === d ? ' sep-graf__barra--sobre' : ''}`} d={barraRedonda(x, H - pad.b - alto, ancho, alto, Math.min(4, ancho / 2))} />
                {i % cadaEtiqueta === 0 ? <text className="sep-graf__eje" x={x + ancho / 2} y={H - 8} textAnchor="middle">{dia(d.fecha)}</text> : null}
              </g>
            );
          })}
        </svg>
        {tip ? (
          <div className="sep-graf__tip" style={{ left: `${tip.x}%` }}>
            <strong>{dia(tip.d.fecha)}</strong>
            <span>{formato(tip.d[campo])} {campo === 'compras' ? (tip.d[campo] === 1 ? 'compra' : 'compras') : ''}</span>
          </div>
        ) : null}
      </div>
    </figure>
  );
}
/** Una barra con las esquinas de arriba redondeadas y la base recta (apoyada en el eje). */
function barraRedonda(x, y, w, h, r) {
  if (h <= 0) return '';
  const rr = Math.min(r, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/** Ingresos y gasto por día: dos líneas en la MISMA escala (dinero), leyenda y cruz al pasar. */
function Lineas({ serie, f }) {
  const [tip, setTip] = useTooltip();
  const W = 640;
  const H = 200;
  const pad = { l: 46, r: 10, t: 10, b: 26 };
  const max = Math.max(1, ...serie.flatMap((d) => [d.ingresos, d.gasto]));
  const n = serie.length;
  const x = (i) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const linea = (k) => serie.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join('');
  const cadaEtiqueta = Math.ceil(n / 6);
  return (
    <figure className="sep-graf">
      <figcaption className="sep-graf__titulo">
        Ingresos y gasto por día
        <span className="sep-leyenda">
          <i className="sep-leyenda__ingresos" /> Ingresos <i className="sep-leyenda__gasto" /> Gasto
        </span>
      </figcaption>
      <div
        className="sep-graf__caja"
        onMouseLeave={() => setTip(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.max(0, Math.min(n - 1, Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (n - 1))));
          if (serie[i]) setTip({ i, d: serie[i] });
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ingresos y gasto por día">
          {[0, max / 2, max].map((m) => (
            <g key={m}>
              <line className="sep-graf__grilla" x1={pad.l} x2={W - pad.r} y1={y(m)} y2={y(m)} />
              <text className="sep-graf__eje" x={pad.l - 6} y={y(m) + 4} textAnchor="end">{f.corto(m)}</text>
            </g>
          ))}
          {serie.map((d, i) => (i % cadaEtiqueta === 0 ? <text key={d.fecha} className="sep-graf__eje" x={x(i)} y={H - 8} textAnchor="middle">{dia(d.fecha)}</text> : null))}
          <path className="sep-graf__linea sep-graf__linea--gasto" d={linea('gasto')} />
          <path className="sep-graf__linea sep-graf__linea--ingresos" d={linea('ingresos')} />
          {tip ? (
            <g>
              <line className="sep-graf__cruz" x1={x(tip.i)} x2={x(tip.i)} y1={pad.t} y2={H - pad.b} />
              <circle className="sep-graf__punto sep-graf__punto--gasto" cx={x(tip.i)} cy={y(tip.d.gasto)} r="4.5" />
              <circle className="sep-graf__punto sep-graf__punto--ingresos" cx={x(tip.i)} cy={y(tip.d.ingresos)} r="4.5" />
            </g>
          ) : null}
        </svg>
        {tip ? (
          <div className="sep-graf__tip" style={{ left: `${(x(tip.i) / W) * 100}%` }}>
            <strong>{dia(tip.d.fecha)}</strong>
            <span><i className="sep-leyenda__ingresos" /> {f.dinero(tip.d.ingresos)}</span>
            <span><i className="sep-leyenda__gasto" /> {f.dinero(tip.d.gasto)}</span>
            <span>ROAS {tip.d.gasto ? (tip.d.ingresos / tip.d.gasto).toFixed(2) : '—'}</span>
          </div>
        ) : null}
      </div>
    </figure>
  );
}

/** La mini gráfica de compras por día en cada tarjeta. */
function Chispa({ serie }) {
  const max = Math.max(1, ...serie.map((d) => d.compras));
  const n = serie.length || 1;
  const W = 120;
  const H = 30;
  const paso = W / n;
  const w = Math.max(1.5, paso - 1.5);
  return (
    <svg className="sep-chispa" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" preserveAspectRatio="none">
      {serie.map((d, i) => {
        const h = d.compras ? Math.max(2, (d.compras / max) * (H - 2)) : 1;
        return <rect key={d.fecha} x={i * paso} y={H - h} width={w} height={h} rx={Math.min(1.5, w / 2)} className={d.compras ? 'sep-chispa__barra' : 'sep-chispa__cero'} />;
      })}
    </svg>
  );
}

// ---------------------------------------------------------------- la tarjeta de un anuncio

function Tarjeta({ a, f, objetivo }) {
  const d = DECISION[a.decision.tipo];
  const Icono = d.icono;
  const [abierta, setAbierta] = useState(a.decision.tipo === 'escalar' || a.decision.tipo === 'variar');
  const roasBien = a.roas >= objetivo;
  return (
    <article className={`sep-card sep-card--${d.tono}`}>
      <div className="sep-card__media">
        {a.miniatura ? <img src={a.miniatura} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="sep-card__sin">Sin imagen</span>}
        <span className={`sep-badge sep-badge--${d.tono}`}>
          <Icono size={13} aria-hidden="true" /> {d.texto}
        </span>
        {a.estado && a.estado !== 'ACTIVE' ? <span className="sep-card__estado">{a.estado === 'PAUSED' ? 'Pausado' : a.estado.toLowerCase()}</span> : null}
      </div>
      <div className="sep-card__cuerpo">
        <h3 className="sep-card__nombre" title={a.nombre}>{a.nombre}</h3>
        <p className="sep-card__campana" title={`${a.campana} · ${a.conjunto}`}>{a.campana}</p>
        <dl className="sep-card__grandes">
          <div>
            <dt>Compras</dt>
            <dd>{entero(a.compras)}</dd>
          </div>
          <div>
            <dt>ROAS</dt>
            <dd className={roasBien ? 'sep-ok' : 'sep-bajo'}>{a.roas.toFixed(2)}</dd>
          </div>
          <div>
            <dt>CPA</dt>
            <dd>{f.dinero(a.cpa)}</dd>
          </div>
        </dl>
        <div className="sep-card__chispa">
          <Chispa serie={a.serie || []} />
          <small>compras por día</small>
        </div>
        <dl className="sep-card__chicas">
          <div><dt>Gasto</dt><dd>{f.dinero(a.gasto)}</dd></div>
          <div><dt>Ingresos</dt><dd>{f.dinero(a.ingresos)}</dd></div>
          <div><dt>CTR</dt><dd>{a.ctr.toFixed(2)} %</dd></div>
          <div><dt>CPM</dt><dd>{f.dinero(a.cpm)}</dd></div>
          <div><dt>Frecuencia</dt><dd className={a.frecuencia >= 2.5 ? 'sep-bajo' : ''}>{a.frecuencia.toFixed(2)}</dd></div>
          <div><dt>Impresiones</dt><dd>{new Intl.NumberFormat('es', { notation: 'compact' }).format(a.impresiones)}</dd></div>
        </dl>
        <button type="button" className="sep-card__plan" onClick={() => setAbierta((x) => !x)} aria-expanded={abierta}>
          {abierta ? 'Ocultar' : 'Ver'} por qué y qué hacer
        </button>
        {abierta ? (
          <div className="sep-card__sistema">
            <ul className="sep-card__razones">{a.decision.razones.map((r, i) => <li key={i}>{r}</li>)}</ul>
            <p className="sep-card__que">Qué hacer</p>
            <ol className="sep-card__acciones">{a.decision.acciones.map((r, i) => <li key={i}>{r}</li>)}</ol>
          </div>
        ) : null}
        <div className="sep-card__botones">
          {a.miniatura && ['escalar', 'variar', 'sostener'].includes(a.decision.tipo) ? (
            <Boton variante={a.decision.tipo === 'variar' ? 'primario' : 'secundario'} tamano="chico" icono={ImagePlus} href={enlace.crearImagenes({ referencia: `/api/sep/imagen/${a.id}` })}>
              Hacer variaciones
            </Boton>
          ) : null}
          <a className="sep-card__meta" href={`https://adsmanager.facebook.com/adsmanager/manage/ads?selected_ad_ids=${a.id}`} target="_blank" rel="noopener noreferrer">
            Abrir en Meta <ArrowUpRight size={13} aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------- la pantalla

export default function Sep() {
  const pref = useMemo(leerPref, []);
  const [rango, setRango] = useState(pref.rango || '30d');
  const [roas, setRoas] = useState(pref.roas || '2');
  const [cpa, setCpa] = useState(pref.cpa || '');
  const [cuenta, setCuenta] = useState(pref.cuenta || '');
  const [filtro, setFiltro] = useState('todos');
  const [tabla, setTabla] = useState(false);
  const [forzar, setForzar] = useState(0);
  const { datos: lasCuentas, error: errorCuentas } = useDatos('sep:cuentas', () => pedirNuevo('/api/sep/cuentas'));
  const cuentas = lasCuentas?.cuentas || [];
  useEffect(() => {
    if (cuentas.length && !cuentas.some((c) => c.id === cuenta)) setCuenta((cuentas.find((c) => c.activa) || cuentas[0]).id);
  }, [cuentas, cuenta]);
  useEffect(() => guardarPref({ rango, roas, cpa, cuenta }), [rango, roas, cpa, cuenta]);
  const consulta = cuenta ? `/api/sep/informe?${new URLSearchParams({ cuenta, rango, roas: String(Number(roas) || 2), cpa: String(Number(cpa) || ''), ...(forzar ? { forzar: '1' } : {}) })}` : null;
  const { datos, cargando, error } = useDatos(consulta ? `sep:${consulta}` : 'sep:nada', () => (consulta ? pedirNuevo(consulta) : Promise.resolve(null)));
  // «Traer de Meta» pide datos frescos una vez; después vuelve a la consulta normal (que ya los encuentra guardados)
  useEffect(() => {
    if (forzar && datos && !cargando) setForzar(0);
  }, [forzar, datos, cargando]);
  const f = fmt(datos?.moneda);
  const objetivo = Number(roas) || 2;
  const lista = (datos?.anuncios || []).filter((a) => filtro === 'todos' || a.decision.tipo === filtro);

  const cabecera = <CabeceraPagina sobretitulo="Escalar · Variar · Pausar" titulo="S.E.P" descripcion="Tus anuncios de Meta que más venden, con sus métricas, y lo que conviene hacer con cada uno: escalarlo, hacerle variaciones, sostenerlo o pausarlo. Solo lee tu cuenta: nunca cambia nada." />;

  if (lasCuentas?.sinToken) {
    return (
      <div className="pagina sep pila" style={{ '--hueco': 'var(--e-6)' }}>
        {cabecera}
        <EstadoVacio icono={Rocket} titulo="Conecta tu cuenta publicitaria de Meta" descripcion="Pega un token de Meta con el permiso ads_read en Ajustes › Conexiones (Meta, tu cuenta publicitaria). Es gratis y solo lee: S.E.P nunca cambia nada en tus anuncios." acciones={<Boton variante="primario" icono={Settings} href="#/ajustes?seccion=conexiones">Ir a Conexiones</Boton>} />
      </div>
    );
  }
  const errorVisible = errorCuentas || error;
  return (
    <div className="pagina sep pila" style={{ '--hueco': 'var(--e-5)' }}>
      {cabecera}
      <div className="sep-controles">
        {cuentas.length > 1 ? (
          <label className="sep-campo">
            <span>Cuenta</span>
            <select value={cuenta} onChange={(e) => setCuenta(e.target.value)}>
              {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
        ) : null}
        <div className="sep-segmento" role="group" aria-label="Rango de fechas">
          {RANGOS.map(([k, t]) => (
            <button key={k} type="button" className={rango === k ? 'activo' : ''} aria-pressed={rango === k} onClick={() => setRango(k)}>{t}</button>
          ))}
        </div>
        <label className="sep-campo sep-campo--chico">
          <span>ROAS objetivo</span>
          <input type="number" min="0.1" step="0.1" value={roas} onChange={(e) => setRoas(e.target.value)} />
        </label>
        <label className="sep-campo sep-campo--chico">
          <span>CPA máximo</span>
          <input type="number" min="0" step="0.5" placeholder="opcional" value={cpa} onChange={(e) => setCpa(e.target.value)} />
        </label>
        <Boton variante="secundario" tamano="chico" icono={RefreshCw} cargando={cargando && Boolean(datos)} onClick={() => setForzar((x) => x + 1)}>
          Traer de Meta
        </Boton>
        {datos?.fecha ? <span className="sep-fecha">{datos.simulado ? 'Datos de prueba · ' : ''}actualizado {fechaRelativa(datos.fecha)}</span> : null}
      </div>

      {errorVisible ? <p className="sep-error" role="alert">{errorVisible.message}</p> : null}
      {!datos && (cargando || !lasCuentas) && !errorVisible ? <Esqueleto alto={420} /> : null}

      {datos ? (
        <>
          <section className="sep-kpis" aria-label="Resumen del rango">
            {[
              ['Gasto', f.dinero(datos.totales.gasto), null],
              ['Compras', entero(datos.totales.compras), null],
              ['Ingresos', f.dinero(datos.totales.ingresos), null],
              ['ROAS', datos.totales.roas.toFixed(2), datos.totales.roas >= objetivo ? `sobre tu objetivo (${objetivo})` : `bajo tu objetivo (${objetivo})`],
              ['CPA', f.dinero(datos.totales.cpa), Number(cpa) ? (datos.totales.cpa <= Number(cpa) ? `dentro de tu máximo` : 'sobre tu máximo') : null],
            ].map(([k, v, nota]) => (
              <div key={k} className="sep-kpi">
                <span className="sep-kpi__etiqueta">{k}</span>
                <strong className="sep-kpi__valor">{v}</strong>
                {nota ? <span className={`sep-kpi__nota ${/sobre tu objetivo|dentro/.test(nota) ? 'sep-ok' : 'sep-bajo'}`}>{nota}</span> : null}
              </div>
            ))}
          </section>

          {datos.serie.length ? (
            <section className="sep-graficas">
              <Barras serie={datos.serie} campo="compras" titulo="Compras por día" formato={(v) => entero(v)} />
              <Lineas serie={datos.serie} f={f} />
            </section>
          ) : null}

          <section className="sep-sistema" aria-label="El sistema S.E.P">
            <div className="sep-sistema__cabeza">
              <h2>Qué sugiere S.E.P</h2>
              <div className="sep-segmento" role="group" aria-label="Cómo verlos">
                <button type="button" className={!tabla ? 'activo' : ''} aria-pressed={!tabla} onClick={() => setTabla(false)}><LayoutGrid size={14} aria-hidden="true" /> Tarjetas</button>
                <button type="button" className={tabla ? 'activo' : ''} aria-pressed={tabla} onClick={() => setTabla(true)}><Table2 size={14} aria-hidden="true" /> Tabla</button>
              </div>
            </div>
            <div className="sep-filtros" role="group" aria-label="Filtrar por sugerencia">
              <button type="button" className={filtro === 'todos' ? 'activo' : ''} onClick={() => setFiltro('todos')}>Todos <b>{datos.anuncios.length}</b></button>
              {ORDEN.filter((k) => datos.cuantos[k]).map((k) => {
                const d = DECISION[k];
                const Icono = d.icono;
                return (
                  <button key={k} type="button" className={`sep-filtro--${d.tono}${filtro === k ? ' activo' : ''}`} onClick={() => setFiltro(k)} title={d.ayuda}>
                    <Icono size={14} aria-hidden="true" /> {d.texto} <b>{datos.cuantos[k]}</b>
                  </button>
                );
              })}
            </div>
          </section>

          {!lista.length ? (
            <EstadoVacio variante="compacto" icono={Rocket} titulo="Nada por aquí" descripcion={datos.anuncios.length ? 'Ningún anuncio con esa sugerencia en este rango.' : 'No hay anuncios con gasto en este rango.'} />
          ) : tabla ? (
            <div className="sep-tabla__caja">
              <table className="sep-tabla">
                <thead>
                  <tr><th>Anuncio</th><th>Sugerencia</th><th>Compras</th><th>ROAS</th><th>CPA</th><th>Gasto</th><th>Ingresos</th><th>CTR</th><th>Frec.</th></tr>
                </thead>
                <tbody>
                  {lista.map((a) => (
                    <tr key={a.id}>
                      <td><strong>{a.nombre}</strong><small>{a.campana}</small></td>
                      <td><span className={`sep-badge sep-badge--${DECISION[a.decision.tipo].tono}`}>{DECISION[a.decision.tipo].texto}</span></td>
                      <td>{entero(a.compras)}</td>
                      <td className={a.roas >= objetivo ? 'sep-ok' : 'sep-bajo'}>{a.roas.toFixed(2)}</td>
                      <td>{f.dinero(a.cpa)}</td>
                      <td>{f.dinero(a.gasto)}</td>
                      <td>{f.dinero(a.ingresos)}</td>
                      <td>{a.ctr.toFixed(2)} %</td>
                      <td>{a.frecuencia.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="sep-grid">
              {lista.map((a) => <Tarjeta key={a.id} a={a} f={f} objetivo={objetivo} />)}
            </div>
          )}
          <p className="sep-nota">Cómo decide S.E.P: <b>Escalar</b> si el ROAS supera tu objetivo en 20 % o más, con 5 compras o más, frecuencia bajo 2,5 y ventas en los últimos 3 días. <b>Hacer variaciones</b> si rinde pero la frecuencia pasa de 2,5 o el CTR cayó más de 25 %. <b>Pausar</b> si gastó sin vender o el ROAS está bajo el 60 % de tu objetivo. <b>Probando</b> si tiene menos de 3 compras y poco gasto. El resto, <b>Sostener</b>. Las compras son las de tu píxel o tu API de conversiones (sin contarlas dos veces).</p>
        </>
      ) : null}
    </div>
  );
}

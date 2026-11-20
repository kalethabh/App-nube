// La investigación competitiva con TrendTrack (lib/competencia.js), debajo del PDF y a todo el ancho: sus 6 etapas
// hechas de una vez (investigación maestra, ganadores, base de hooks, saturación de ángulos, avatares y validación en
// el país). Cada etapa se dibuja con sus bloques: tarjetas de cifras, barras, la escala de sofisticación, tarjetas de
// anuncio con su evidencia y su link, la base de hooks con filtros, los avatares por color y las tablas.
// Tipografía DejaVu Sans, la del PDF; los colores dicen algo: verde = libre o creciendo, ámbar = medio, rojo =
// saturado o riesgo, azul = dato.
//
//   <Competencia id={productoId} pais={paisDeLaInvestigacion} T={ComponenteDeTexto} />
import { Fragment, useEffect, useMemo, useState } from 'react';
import { CircleAlert, ExternalLink, LoaderCircle, Radar, RotateCcw } from 'lucide-react';
import { Boton, CampoTexto, Interruptor, useAvisos } from '../../componentes/index.js';
import { apiInvestigacion, useCompetencia } from '../../datos/investigacion.js';
import { Indice } from './Indice.jsx';
import { fechaRelativa } from '../../datos/formato.js';
import './documento.css';
import './competencia.css';

const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
const lista = (x) => (Array.isArray(x) ? x.filter((v) => typeof v === 'string' && v.trim()) : []);
const hay = (x) => (typeof x === 'string' ? x.trim().length > 0 : x !== null && x !== undefined && x !== 0);
const TONOS = ['verde', 'ambar', 'rojo', 'azul'];
const tonoDe = (t) => (TONOS.includes(t) ? t : 'neutro');

// palabras que la app pinta sola en las tablas y etiquetas
const PINTADAS = [
  [/^(ya existe|consolidado|alta|saturado|no viable|desacelerando)$/i, 'rojo'],
  [/^(parecido|sostenido|media|medio|viable con condiciones|estable)$/i, 'ambar'],
  [/^(no existe|prueba|baja|fresco|libre|viable|creciendo|emergente)$/i, 'verde'],
  [/^(sin verificar|no se puede saber)$/i, 'neutro'],
];
const tonoDePalabra = (t) => (PINTADAS.find(([re]) => re.test(String(t || '').trim())) || [])[1] || null;

function Chip({ children, tono = 'neutro' }) {
  return <span className={`tt-chip tt-chip--${tono}`}>{children}</span>;
}

/** Texto con **negrita** y con «Dato:» / «Inferencia:» al comienzo como etiqueta de color. */
function Rico({ children, T }) {
  let texto = typeof children === 'string' ? children : children === null || children === undefined ? '' : String(children);
  let etiqueta = null;
  const m = /^\s*(Dato|Inferencia)\s*[:.]\s*/i.exec(texto);
  if (m) {
    etiqueta = /^d/i.test(m[1]) ? <Chip tono="azul">Dato</Chip> : <Chip tono="ambar">Inferencia</Chip>;
    texto = texto.slice(m[0].length);
  }
  const partes = texto.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {etiqueta}
      {etiqueta ? ' ' : null}
      {partes.map((p, i) => (p ? i % 2 ? <strong key={i}><T>{p}</T></strong> : <Fragment key={i}><T>{p}</T></Fragment> : null))}
    </>
  );
}

function Barras({ b, T }) {
  const items = (b.items || []).filter((x) => hay(x?.etiqueta));
  const tope = Math.max(1, ...items.map((x) => num(x.valor)));
  return (
    <div className="tt-tarjeta">
      {b.titulo ? <h4 className="tt-tarjeta__titulo"><T>{b.titulo}</T></h4> : null}
      <ul className="tt-barras">
        {items.map((x, i) => (
          <li key={i} className={`tt-barra tt-barra--${tonoDe(x.tono || tonoDePalabra(x.nota))}`}>
            <span className="tt-barra__etiqueta"><T>{x.etiqueta}</T></span>
            <span className="tt-barra__pista" aria-hidden="true">
              <span className="tt-barra__relleno" style={{ width: `${Math.max(2, (num(x.valor) / tope) * 100)}%` }} />
            </span>
            <span className="tt-barra__valor">{num(x.valor).toLocaleString('es')}{b.unidad ? <small> {b.unidad}</small> : null}</span>
            {x.nota ? <span className="tt-barra__nota"><Chip tono={tonoDe(x.tono || tonoDePalabra(x.nota))}>{x.nota}</Chip></span> : <span />}
          </li>
        ))}
      </ul>
    </div>
  );
}

const SCHWARTZ = ['Primero en el mercado', 'Promesa más grande', 'Mecanismo', 'Mecanismo mejorado', 'Identificación'];
function Escala({ b, T }) {
  return (
    <div className="tt-tarjeta">
      {b.titulo ? <h4 className="tt-tarjeta__titulo"><T>{b.titulo}</T></h4> : null}
      {(b.items || []).map((x, i) => (
        <div key={i} className="tt-escala">
          <span className="tt-escala__nombre"><T>{x?.nombre}</T></span>
          <div className="tt-escala__celdas">
            {SCHWARTZ.map((s, k) => (
              <span key={k} className={`tt-escala__celda${Math.round(num(x?.nivel)) === k + 1 ? ' tt-escala__celda--activa' : ''}`}>
                <b>{k + 1}</b>
                {s}
              </span>
            ))}
          </div>
          {x?.nota ? <p className="tt-escala__nota"><Rico T={T}>{x.nota}</Rico></p> : null}
        </div>
      ))}
    </div>
  );
}

function Anuncios({ b, T }) {
  return (
    <div className="tt-anuncios">
      {(b.items || []).map((a, i) => {
        const c = a?.cifras || {};
        const cifras = [
          ['Días al aire', c.dias],
          ['Anuncios', c.anuncios],
          ['Alcance', c.alcance],
          ['Impresiones', c.impresiones],
        ].filter(([, v]) => hay(v));
        return (
          <article key={i} className="tt-anuncio">
            <header className="tt-anuncio__cabeza">
              <strong><T>{a?.nombre || a?.marca || 'Anuncio'}</T></strong>
              <span className="tt-anuncio__chips">
                {a?.marca && a?.nombre ? <Chip>{a.marca}</Chip> : null}
                {a?.formato ? <Chip tono="azul">{a.formato}</Chip> : null}
              </span>
            </header>
            {cifras.length ? (
              <div className="tt-anuncio__cifras">
                {cifras.map(([k, v]) => (
                  <span key={k}>
                    <b>{typeof v === 'number' ? v.toLocaleString('es') : v}</b>
                    {k}
                  </span>
                ))}
              </div>
            ) : null}
            {hay(c.desde) || hay(c.hasta) ? <p className="tt-anuncio__fechas">{[c.desde, c.hasta].filter(hay).join(' → ')}</p> : null}
            {hay(a?.gancho) ? (
              <blockquote className="tt-gancho">
                <span className="tt-gancho__original"><T>{a.gancho}</T></span>
                {hay(a.traduccion) ? <span className="tt-gancho__es"><T>{a.traduccion}</T></span> : null}
              </blockquote>
            ) : null}
            {hay(a?.angulo) || hay(a?.avatar) ? (
              <p className="tt-anuncio__linea">
                {hay(a.angulo) ? <><b>Ángulo:</b> <T>{a.angulo}</T></> : null}
                {hay(a.angulo) && hay(a.avatar) ? ' · ' : null}
                {hay(a.avatar) ? <><b>Avatar:</b> <T>{a.avatar}</T></> : null}
              </p>
            ) : null}
            {lista(a?.pasos).length ? (
              <ol className="tt-pasos">
                {lista(a.pasos).map((p, k) => <li key={k}><T>{p}</T></li>)}
              </ol>
            ) : null}
            {hay(a?.por_que) ? <p className="tt-anuncio__porque"><b>Por qué escala:</b> <Rico T={T}>{a.por_que}</Rico></p> : null}
            {lista(a?.ganchos).length ? (
              <div className="tt-anuncio__ganchos">
                <b>Ganchos probados sobre el mismo cuerpo</b>
                <ul>{lista(a.ganchos).map((g, k) => <li key={k}><T>{g}</T></li>)}</ul>
              </div>
            ) : null}
            <footer className="tt-anuncio__pie">
              {/^https?:\/\//.test(a?.url || '') ? (
                <a href={a.url} target="_blank" rel="noreferrer noopener"><ExternalLink size={12} strokeWidth={2} aria-hidden="true" /> Ver {a.formato === 'imagen' ? 'imagen' : 'video'}</a>
              ) : null}
              {/^https?:\/\//.test(a?.landing || '') ? (
                <a href={a.landing} target="_blank" rel="noreferrer noopener"><ExternalLink size={12} strokeWidth={2} aria-hidden="true" /> Landing</a>
              ) : hay(a?.landing) ? <span>{a.landing}</span> : null}
              {hay(a?.id) ? <code>{a.id}</code> : null}
            </footer>
          </article>
        );
      })}
    </div>
  );
}

const SATURACION = { alta: ['Saturación alta', 'rojo'], media: ['Saturación media', 'ambar'], baja: ['Saturación baja', 'verde'] };
function Hooks({ b, T }) {
  const items = (b.items || []).filter((h) => hay(h?.texto));
  const [fuente, setFuente] = useState('todas');
  const [categoria, setCategoria] = useState('todas');
  const [sat, setSat] = useState('todas');
  const categorias = useMemo(() => [...new Set(items.map((h) => String(h.categoria || '').trim().toLowerCase()).filter(Boolean))], [items]);
  const visibles = items.filter((h) => (fuente === 'todas' || (h.fuente || 'marca') === fuente) && (categoria === 'todas' || String(h.categoria || '').trim().toLowerCase() === categoria) && (sat === 'todas' || h.saturacion === sat));
  const Filtro = ({ valor, actual, poner, children, tono }) => (
    <button type="button" className={`tt-filtro${actual === valor ? ' tt-filtro--activo' : ''}${tono ? ` tt-filtro--${tono}` : ''}`} onClick={() => poner(valor)} aria-pressed={actual === valor}>
      {children}
    </button>
  );
  return (
    <div className="tt-hooks">
      <div className="tt-filtros" role="group" aria-label="Filtros de la base de hooks">
        <span className="tt-filtros__grupo">
          <Filtro valor="todas" actual={fuente} poner={setFuente}>Todos ({items.length})</Filtro>
          <Filtro valor="marca" actual={fuente} poner={setFuente}>La marca</Filtro>
          <Filtro valor="competidor" actual={fuente} poner={setFuente}>Competidores</Filtro>
        </span>
        <span className="tt-filtros__grupo">
          <Filtro valor="todas" actual={sat} poner={setSat}>Cualquier saturación</Filtro>
          <Filtro valor="baja" actual={sat} poner={setSat} tono="verde">Baja</Filtro>
          <Filtro valor="media" actual={sat} poner={setSat} tono="ambar">Media</Filtro>
          <Filtro valor="alta" actual={sat} poner={setSat} tono="rojo">Alta</Filtro>
        </span>
        <span className="tt-filtros__grupo">
          <Filtro valor="todas" actual={categoria} poner={setCategoria}>Todas las categorías</Filtro>
          {categorias.map((c) => <Filtro key={c} valor={c} actual={categoria} poner={setCategoria}>{c}</Filtro>)}
        </span>
      </div>
      <p className="tt-hooks__cuenta">{visibles.length} de {items.length} hooks</p>
      <div className="tt-hooks__lista">
        {visibles.map((h, i) => {
          const s = SATURACION[h.saturacion];
          return (
            <article key={i} className="tt-hook">
              <div className="tt-hook__chips">
                {h.categoria ? <Chip tono="azul">{h.categoria}</Chip> : null}
                {s ? <Chip tono={s[1]}>{s[0]}</Chip> : null}
                <Chip>{h.fuente === 'competidor' ? h.marca || 'Competidor' : h.marca || 'La marca'}</Chip>
              </div>
              <blockquote className="tt-gancho">
                <span className="tt-gancho__original"><T>{h.texto}</T></span>
                {hay(h.traduccion) ? <span className="tt-gancho__es"><T>{h.traduccion}</T></span> : null}
              </blockquote>
              {hay(h.mejorado) ? <p className="tt-hook__mejorado"><b>Versión mejorada</b><T>{h.mejorado}</T></p> : null}
              <dl className="tt-hook__datos">
                {[['Conciencia', h.conciencia], ['Gatillo', h.gatillo], ['Avatar', h.avatar], ['Por qué funciona', h.por_que], ['Evidencia', h.evidencia]].filter(([, v]) => hay(v)).map(([k, v]) => (
                  <div key={k}><dt>{k}</dt><dd><T>{v}</T></dd></div>
                ))}
              </dl>
              {/^https?:\/\//.test(h.url || '') || hay(h.id) ? (
                <footer className="tt-anuncio__pie">
                  {/^https?:\/\//.test(h.url || '') ? <a href={h.url} target="_blank" rel="noreferrer noopener"><ExternalLink size={12} strokeWidth={2} aria-hidden="true" /> Ver anuncio</a> : null}
                  {hay(h.id) ? <code>{h.id}</code> : null}
                </footer>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

const MOMENTO = { creciendo: 'verde', emergente: 'verde', estable: 'ambar', desacelerando: 'rojo' };
function Avatares({ b, T }) {
  return (
    <div className="tt-avatares">
      {(b.items || []).map((a, i) => {
        const tono = a?.saturacion === 'alta' ? 'rojo' : a?.saturacion === 'baja' ? 'verde' : MOMENTO[a?.momento] || 'ambar';
        return (
          <article key={i} className={`tt-avatar tt-avatar--${tono}`}>
            <header>
              <span className="tt-avatar__n">{i + 1}</span>
              <strong><T>{a?.nombre}</T></strong>
              <span className="tt-anuncio__chips">
                {a?.momento ? <Chip tono={MOMENTO[a.momento] || 'neutro'}>{a.momento}</Chip> : null}
                {SATURACION[a?.saturacion] ? <Chip tono={SATURACION[a.saturacion][1]}>{SATURACION[a.saturacion][0]}</Chip> : null}
              </span>
            </header>
            {hay(a?.frase) ? <p className="tt-avatar__frase">«<T>{a.frase}</T>»</p> : null}
            <dl className="tt-hook__datos">
              {[['Perfil', a?.perfil], ['Le habla', a?.angulo], ['Volumen', a?.volumen], ['Evidencia', a?.evidencia]].filter(([, v]) => hay(v)).map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd><T>{v}</T></dd></div>
              ))}
            </dl>
            {lista(a?.ganchos).length ? <ul className="tt-avatar__ganchos">{lista(a.ganchos).map((g, k) => <li key={k}><T>{g}</T></li>)}</ul> : null}
          </article>
        );
      })}
    </div>
  );
}

function Bloque({ b, T }) {
  const R = ({ children }) => <Rico T={T}>{children}</Rico>;
  switch (b?.tipo) {
    case 'subtitulo':
      return <h3 className="tt-h3"><T>{b.texto}</T></h3>;
    case 'parrafo':
      return <p className="tt-p"><R>{b.texto}</R></p>;
    case 'vinetas':
      return <ul className="tt-lista">{lista(b.items).map((x, i) => <li key={i}><R>{x}</R></li>)}</ul>;
    case 'metricas':
      return (
        <div className="tt-metricas">
          {(b.items || []).filter((x) => hay(x?.etiqueta)).map((x, i) => (
            <div key={i} className={`tt-metrica tt-metrica--${tonoDe(x.tono)}`}>
              <span className="tt-metrica__etiqueta">{x.etiqueta}</span>
              <span className="tt-metrica__valor"><T>{String(x.valor ?? '')}</T></span>
              {x.nota ? <span className="tt-metrica__nota"><T>{x.nota}</T></span> : null}
            </div>
          ))}
        </div>
      );
    case 'barras':
      return <Barras b={b} T={T} />;
    case 'escala':
      return <Escala b={b} T={T} />;
    case 'tabla': {
      const cols = Array.isArray(b.columnas) ? b.columnas : [];
      return (
        <div className="tt-tabla__caja">
          <table className="tt-tabla">
            <thead><tr>{cols.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
            <tbody>
              {(b.filas || []).map((f, i) => (
                <tr key={i}>
                  {(Array.isArray(f) ? f : []).map((c, k) => {
                    const tono = tonoDePalabra(c);
                    const enlace = /^https?:\/\/\S+$/.test(String(c || '').trim());
                    return <td key={k}>{tono ? <Chip tono={tono}>{c}</Chip> : enlace ? <a href={c} target="_blank" rel="noreferrer noopener">{String(c).replace(/^https?:\/\//, '').slice(0, 42)}</a> : <R>{c}</R>}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {b.nota ? <p className="tt-nota"><R>{b.nota}</R></p> : null}
        </div>
      );
    }
    case 'anuncios':
      return <Anuncios b={b} T={T} />;
    case 'hooks':
      return <Hooks b={b} T={T} />;
    case 'avatares':
      return <Avatares b={b} T={T} />;
    case 'caja': {
      const estilo = ['oportunidad', 'riesgo', 'limite', 'clave', 'veredicto', 'hipotesis'].includes(b.estilo) ? b.estilo : 'limite';
      const veredicto = estilo === 'veredicto' ? (/^no viable/i.test(b.titulo || '') ? 'rojo' : /condiciones/i.test(b.titulo || '') ? 'ambar' : 'verde') : null;
      return (
        <div className={`tt-caja tt-caja--${estilo}${veredicto ? ` tt-caja--${veredicto}` : ''}`}>
          {b.titulo ? <p className="tt-caja__titulo"><T>{b.titulo}</T></p> : null}
          {b.texto ? <p className="tt-p"><R>{b.texto}</R></p> : null}
          {lista(b.items).length ? <ul className="tt-lista">{lista(b.items).map((x, i) => <li key={i}><R>{x}</R></li>)}</ul> : null}
        </div>
      );
    }
    case 'plan':
      return (
        <div className="tt-tarjeta">
          {b.titulo ? <h4 className="tt-tarjeta__titulo"><T>{b.titulo}</T></h4> : null}
          <ol className="tt-plan">
            {(b.items || []).map((x, i) => (
              <li key={i}>
                <b>{x?.cuando}</b>
                <span><R>{x?.que}</R></span>
              </li>
            ))}
          </ol>
        </div>
      );
    default:
      return null;
  }
}

const SinResaltar = ({ children }) => children;

/** El formulario para lanzar (o repetir) la investigación. */
function Lanzar({ id, pais, previa, alLanzar, hay: yaHay }) {
  const { aviso } = useAvisos();
  const [enlace, setEnlace] = useState(previa?.enlace || '');
  const [producto, setProducto] = useState(previa?.producto || '');
  const [donde, setDonde] = useState(previa?.pais || pais || 'Colombia');
  const [bt, setBt] = useState(Boolean(previa?.brandtracker));
  const [ocupado, setOcupado] = useState(false);
  const lanzar = async (retomar = false) => {
    setOcupado(true);
    try {
      await apiInvestigacion.competir(id, { enlace: enlace.trim(), producto: producto.trim(), pais: donde.trim(), brandtracker: bt, retomar });
      await alLanzar?.();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude empezar la investigación', texto: e?.message || 'Vuelve a intentarlo.' });
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div className="tt-lanzar">
      <div className="tt-lanzar__campos">
        <CampoTexto etiqueta="Marca a investigar" placeholder="Pega el link de TrendTrack de la tienda (o su dominio)" maxLength={400} value={enlace} onChange={(e) => setEnlace(e.target.value)} disabled={ocupado} />
        <CampoTexto etiqueta="Producto puntual" opcional placeholder="Si es uno solo de esa marca" maxLength={200} value={producto} onChange={(e) => setProducto(e.target.value)} disabled={ocupado} />
        <CampoTexto etiqueta="País para validar" placeholder="Colombia" maxLength={60} value={donde} onChange={(e) => setDonde(e.target.value)} disabled={ocupado} />
      </div>
      <Interruptor activado={bt} onCambio={setBt} deshabilitado={ocupado} etiqueta="Agregar la marca a mi brandtracker si no está" descripcion="Sin eso no hay transcripciones de los guiones de video. Gasta créditos de TrendTrack." />
      <p className="tt-lanzar__costo">
        <CircleAlert size={14} strokeWidth={2} aria-hidden="true" />
        Hace las 6 etapas de una vez con tu TrendTrack (el conector de tu cuenta de Claude). Una investigación completa gasta entre 450 y 650 créditos de TrendTrack y tarda de 30 a 90 minutos.
      </p>
      <div className="tt-lanzar__botones">
        <Boton variante="primario" icono={Radar} onClick={() => lanzar(false)} cargando={ocupado} disabled={enlace.trim().length < 3}>
          {yaHay ? 'Investigar de nuevo' : 'Investigar la competencia'}
        </Boton>
        {previa?.estado === 'error' && previa?.enlace ? (
          <Boton variante="secundario" icono={RotateCcw} onClick={() => lanzar(true)} disabled={ocupado}>
            Seguir desde donde quedó
          </Boton>
        ) : null}
      </div>
    </div>
  );
}

export function Competencia({ id, pais = 'Colombia', T = SinResaltar }) {
  const [cadaMs, setCadaMs] = useState(undefined);
  const { datos, recargar } = useCompetencia(id, { cadaMs });
  const estado = datos?.tarea?.estado || null;
  useEffect(() => setCadaMs(estado === 'investigando' ? 5000 : undefined), [estado]);
  const [etapa, setEtapa] = useState(0);
  const [otra, setOtra] = useState(false);
  if (!datos) return null;
  const { tarea, competencia: c } = datos;
  const etapas = c?.etapas || [];
  const e = etapas[Math.min(etapa, Math.max(0, etapas.length - 1))];
  const cr = c?.creditos || {};
  const gastados = Number.isFinite(Number(cr.antes)) && Number.isFinite(Number(cr.despues)) && Number(cr.antes) >= Number(cr.despues) ? Number(cr.antes) - Number(cr.despues) : null;

  return (
    <section className="tt" data-seccion="Competencia (TrendTrack)">
      <header className="tt-cabeza">
        <div>
          <span className="tt-cabeza__sobre">INVESTIGACIÓN COMPETITIVA · TRENDTRACK</span>
          <h2 className="tt-cabeza__titulo">{c ? <>{c.marca}{c.producto ? <span> · {c.producto}</span> : null}</> : 'Tu competencia, con datos de TrendTrack'}</h2>
          <p className="tt-cabeza__desc">
            {c
              ? `${c.tienda ? `${c.tienda} · ` : ''}Validada en ${c.pais}${tarea.fin ? ` · ${fechaRelativa(tarea.fin)}` : ''}${gastados !== null ? ` · ${gastados.toLocaleString('es')} créditos` : ''}`
              : 'Investigación maestra, ganadores, base de hooks, saturación de ángulos, avatares y validación en tu país: las 6 etapas de una vez.'}
          </p>
        </div>
        {c && tarea.estado !== 'investigando' ? (
          <Boton variante="secundario" tamano="chico" icono={RotateCcw} onClick={() => setOtra((x) => !x)}>
            {otra ? 'Cerrar' : 'Investigar otra marca'}
          </Boton>
        ) : null}
      </header>

      {tarea.estado === 'investigando' ? (
        <div className="tt-espera" aria-live="polite">
          <LoaderCircle size={22} className="girando" aria-hidden="true" />
          <div>
            <strong>Investigando «{tarea.enlace}» en TrendTrack</strong>
            <p>Hace las 6 etapas seguidas; tarda de 30 a 90 minutos. Puedes irte de esta pantalla: sigue sola.</p>
            <ul>{(tarea.progreso || []).slice(-4).map((p, i, l) => <li key={`${i}-${p}`} className={i === l.length - 1 ? 'tt-espera__ahora' : ''}>{p}</li>)}</ul>
          </div>
        </div>
      ) : null}

      {tarea.estado === 'error' ? (
        <p className="tt-aviso" role="alert">
          <CircleAlert size={14} strokeWidth={2} aria-hidden="true" />
          {tarea.error?.mensaje || 'La investigación no terminó.'}
          {c?.incompleta ? ` Abajo está lo que alcanzó a hacer (${etapas.length} de 6 etapas).` : ''}
        </p>
      ) : null}

      {tarea.estado !== 'investigando' && (!c || otra || tarea.estado === 'error') ? <Lanzar id={id} pais={pais} previa={tarea} hay={Boolean(c)} alLanzar={async () => { setOtra(false); await recargar?.(); }} /> : null}

      {c && etapas.length ? (
        <>
          {hay(c.explicacion) ? <p className="tt-explicacion"><T>{c.explicacion}</T></p> : null}
          {lista(c.advertencias).length ? (
            <div className="tt-caja tt-caja--limite">
              <p className="tt-caja__titulo">Antes de leer los datos</p>
              <ul className="tt-lista">{lista(c.advertencias).map((x, i) => <li key={i}><Rico T={T}>{x}</Rico></li>)}</ul>
            </div>
          ) : null}
          <Indice titulos={etapas.map((x) => x.titulo || 'Etapa')} actual={Math.min(etapa, etapas.length - 1)} onElegir={setEtapa} etiqueta="Etapas de la investigación de la competencia" />
          {e ? (
            <div className="tt-cuerpo" key={etapa}>
              {hay(e.contexto) ? <p className="tt-contexto"><Rico T={T}>{e.contexto}</Rico></p> : null}
              {(e.bloques || []).map((b, i) => <Bloque key={i} b={b} T={T} />)}
              {lista(e.riesgos).length ? (
                <div className="tt-caja tt-caja--riesgo">
                  <p className="tt-caja__titulo">Riesgos</p>
                  <ul className="tt-lista">{lista(e.riesgos).map((x, i) => <li key={i}><Rico T={T}>{x}</Rico></li>)}</ul>
                </div>
              ) : null}
              {lista(e.limitaciones).length ? (
                <div className="tt-caja tt-caja--limite">
                  <p className="tt-caja__titulo">Limitaciones de los datos</p>
                  <ul className="tt-lista">{lista(e.limitaciones).map((x, i) => <li key={i}><Rico T={T}>{x}</Rico></li>)}</ul>
                </div>
              ) : null}
              <div className="tt-pasar">
                {etapa > 0 ? <Boton variante="fantasma" tamano="chico" onClick={() => setEtapa(etapa - 1)}>← {etapas[etapa - 1].titulo}</Boton> : <span />}
                {etapa < etapas.length - 1 ? <Boton variante="secundario" tamano="chico" onClick={() => setEtapa(etapa + 1)}>{etapas[etapa + 1].titulo} →</Boton> : null}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

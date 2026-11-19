// La PRIMERA PARTE de la investigación (la de mercado, la skill investigacion-mercado), dibujada con el MISMO estilo
// que la segunda (la de la competencia, Competencia.jsx): cabecera, una pestaña por sección y los bloques como
// tarjetas, tablas, cajas y citas de la app (2026-11-19o, pedido: «reemplazar el PDF por el mismo estilo que en la
// segunda parte»). Los datos son los mismos de siempre (investigacion.json en bloques). «Descargar PDF» sigue sacando el
// PDF de antes (Documento.jsx, que va oculto y solo se imprime).
//
//   <MercadoApp inv={investigacion} foto={urlDeLaFoto} T={ComponenteDeTexto} />
import { Fragment, useState } from 'react';
import { Boton } from '../../componentes/index.js';
import { Maqueta } from './Documento.jsx';
import './competencia.css';

const lista = (x) => (Array.isArray(x) ? x.filter((v) => typeof v === 'string' && v.trim()) : []);
const hay = (x) => (typeof x === 'string' ? x.trim().length > 0 : x !== null && x !== undefined);
const SinResaltar = ({ children }) => children;

/** Texto con **negrita**; cada tramo pasa por T (lo resaltado). */
function Rico({ children, T }) {
  const texto = typeof children === 'string' ? children : children === null || children === undefined ? '' : String(children);
  return texto.split(/\*\*(.+?)\*\*/g).map((p, i) => (p ? i % 2 ? <strong key={i}><T>{p}</T></strong> : <Fragment key={i}><T>{p}</T></Fragment> : null));
}

// las cajas del documento, con los colores de las de la competencia
const CAJA = { recomendacion: 'oportunidad', alerta: 'riesgo', cuidado: 'riesgo', 'te-pasa': 'riesgo', pendiente: 'limite', nota: 'limite', avatar: 'clave', encapsulada: 'clave' };
const CITA = { dolor: 'rojo', deseo: 'verde', central: 'ambar' };

function Bloque({ b, T, guia }) {
  const R = ({ children }) => <Rico T={T}>{children}</Rico>;
  switch (b?.tipo) {
    case 'parrafo':
      return <p className="tt-p"><R>{b.texto}</R></p>;
    case 'subtitulo':
      return <h3 className="tt-h3"><R>{b.texto}</R></h3>;
    case 'nota':
      return <p className="tt-nota"><R>{b.texto}</R></p>;
    case 'vinetas':
      return <ul className="tt-lista">{lista(b.items).map((x, i) => <li key={i}><R>{x}</R></li>)}</ul>;
    case 'numerada':
      return <ol className="tt-lista">{lista(b.items).map((x, i) => <li key={i}><R>{x}</R></li>)}</ol>;
    case 'tabla': {
      const cols = Array.isArray(b.columnas) ? b.columnas : [];
      return (
        <div className="tt-tabla__caja">
          <table className="tt-tabla">
            <thead><tr>{cols.map((c, i) => <th key={i}><R>{c}</R></th>)}</tr></thead>
            <tbody>
              {(b.filas || []).map((f, i) => (
                <tr key={i}>{(Array.isArray(f) ? f : []).map((c, k) => <td key={k}><R>{c}</R></td>)}</tr>
              ))}
            </tbody>
          </table>
          {b.nota ? <p className="tt-nota"><R>{b.nota}</R></p> : null}
        </div>
      );
    }
    case 'ficha':
      return (
        <div className="tt-tabla__caja">
          <table className="tt-tabla tt-tabla--ficha">
            <tbody>
              {(b.filas || []).map((f, i) => (
                <tr key={i}>
                  <th><R>{f?.[0]}</R></th>
                  <td><R>{f?.[1]}</R></td>
                </tr>
              ))}
            </tbody>
          </table>
          {b.nota ? <p className="tt-nota"><R>{b.nota}</R></p> : null}
        </div>
      );
    case 'caja': {
      const estilo = CAJA[b.estilo] || 'limite';
      return (
        <div className={`tt-caja tt-caja--${estilo}`}>
          {b.titulo ? <p className="tt-caja__titulo"><R>{b.titulo}</R></p> : null}
          {b.texto ? <p className="tt-p"><R>{b.texto}</R></p> : null}
          {lista(b.items).length ? <ul className="tt-lista">{lista(b.items).map((x, i) => <li key={i}><R>{x}</R></li>)}</ul> : null}
          {b.pie ? <p className="tt-nota"><R>{b.pie}</R></p> : null}
        </div>
      );
    }
    case 'cita':
      return (
        <blockquote className={`tt-gancho mc-cita mc-cita--${CITA[b.estilo] || 'ambar'}`}>
          <span className="tt-gancho__original">«<R>{String(b.texto || '').replace(/^["«“]+|["»”]+$/g, '')}</R>»</span>
        </blockquote>
      );
    case 'propuesta':
      return (
        <div className="tt-tarjeta">
          <h4 className="tt-tarjeta__titulo"><R>{b.titulo}</R></h4>
          <dl className="tt-hook__datos">
            <dt>Dolor</dt>
            <dd><R>{b.dolor}</R></dd>
            <dt>Propuesta</dt>
            <dd><R>{b.propuesta}</R></dd>
            <dt>Tiempo</dt>
            <dd><R>{b.tiempo}</R></dd>
          </dl>
        </div>
      );
    case 'opcion':
      return (
        <div className={`tt-caja tt-caja--${b.estilo === 'dolor' ? 'riesgo' : 'clave'}`}>
          {b.etiqueta ? <p className="tt-caja__titulo"><R>{b.etiqueta}</R></p> : null}
          <p className="mc-opcion"><R>{b.titulo}</R></p>
          {b.subtitulo ? <p className="tt-nota"><R>{b.subtitulo}</R></p> : null}
        </div>
      );
    case 'franja':
      return (
        <div className="tt-caja tt-caja--clave">
          <p className="tt-p"><strong><R>{b.etiqueta}</R></strong> <R>{b.texto}</R></p>
          {b.nota ? <p className="tt-nota"><R>{b.nota}</R></p> : null}
        </div>
      );
    case 'guia-visual':
      return guia;
    default:
      return null;
  }
}

/** La guía visual de 4 mensajes: cada uno con su maqueta 9:16, sus elementos y su objetivo. */
function Guia({ inv, foto, color }) {
  const mensajes = (inv.guia?.mensajes || []).slice(0, 4);
  if (!mensajes.length) return null;
  return (
    <div className="mc-guia">
      <h3 className="tt-h3">Guía visual · 4 mensajes para WhatsApp y landing</h3>
      {mensajes.map((m, i) => (
        <article key={i} className="tt-tarjeta mc-mensaje">
          <div className="mc-mensaje__maqueta" style={{ '--marca': color, '--tinta': '#2b1f1b', '--gris': '#6b5f5a' }}>
            <Maqueta m={m} n={i + 1} foto={foto} />
          </div>
          <div className="mc-mensaje__texto">
            <span className="tt-cabeza__sobre">MENSAJE {i + 1}</span>
            <h4 className="tt-tarjeta__titulo">{m.seccion}</h4>
            <p className="tt-nota">
              Beneficio: {m.franja?.beneficio} · Tiempo: {m.franja?.tiempo} · Deseo: {m.franja?.deseo}
            </p>
            <ol className="tt-lista">
              {(m.elementos || []).map((e, k) => (
                <li key={k}>
                  <b>{e?.titulo}</b> {e?.texto}
                </li>
              ))}
            </ol>
            {m.objetivo ? (
              <div className="tt-caja tt-caja--oportunidad">
                <p className="tt-caja__titulo">Objetivo</p>
                <p className="tt-p">{m.objetivo}</p>
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

export function MercadoApp({ inv, foto = null, T = SinResaltar }) {
  const secciones = Array.isArray(inv?.secciones) ? inv.secciones : [];
  const pestañas = [...secciones.map((s) => s?.titulo || 'Sección'), ...(inv?.fuentes?.length ? ['Fuentes'] : [])];
  const [actual, setActual] = useState(0);
  const i = Math.min(actual, Math.max(0, pestañas.length - 1));
  const sec = secciones[i] || null;
  const color = /^#[0-9a-f]{6}$/i.test(inv?.color || '') ? inv.color : '#A8431F';
  const p = inv?.portada || {};
  const datos = [
    p.avatar ? ['Avatar principal', p.avatar] : null,
    p.quien_compra ? ['Quién compra', p.quien_compra] : null,
    p.canal ? ['Canal', p.canal] : null,
  ].filter(Boolean);
  return (
    <section className="tt mc" data-seccion="Investigación de mercado">
      <header className="tt-cabeza">
        <div>
          <span className="tt-cabeza__sobre">INVESTIGACIÓN DE MERCADO{inv?.pais ? ` · ${String(inv.pais).toUpperCase()}` : ''}</span>
          <h2 className="tt-cabeza__titulo">
            {p.titulo || inv?.producto}
            {p.subtitulo ? <span> · {p.subtitulo}</span> : null}
          </h2>
          <p className="tt-cabeza__desc">{[inv?.producto, inv?.pais, inv?.fecha].filter(hay).join(' · ')}</p>
        </div>
      </header>
      {datos.length ? (
        <div className="tt-metricas">
          {datos.map(([k, v]) => (
            <div key={k} className="tt-metrica tt-metrica--neutro">
              <span className="tt-metrica__etiqueta">{k}</span>
              <span className="tt-metrica__nota"><T>{v}</T></span>
            </div>
          ))}
        </div>
      ) : null}
      <nav className="tt-etapas" aria-label="Secciones de la investigación de mercado">
        {pestañas.map((t, k) => (
          <button key={k} type="button" className={`tt-etapa${k === i ? ' tt-etapa--activa' : ''}`} onClick={() => setActual(k)} aria-current={k === i ? 'step' : undefined}>
            <b>{k + 1}</b>
            {t}
          </button>
        ))}
      </nav>
      <div className="tt-cuerpo" key={i}>
        {sec ? (
          (sec.bloques || []).map((b, k) => <Bloque key={k} b={b} T={T} guia={<Guia inv={inv} foto={foto} color={color} />} />)
        ) : (
          <>
            <ul className="tt-lista mc-fuentes">
              {(inv?.fuentes || []).map((f, k) => (
                <li key={k}>
                  <strong>{f.titulo}</strong>{' '}
                  {/^https?:\/\//.test(f.url || '') ? (
                    <a href={f.url} target="_blank" rel="noreferrer noopener">{f.url}</a>
                  ) : (
                    <span>{f.url}</span>
                  )}
                </li>
              ))}
            </ul>
            {inv?.nota_fuentes ? <p className="tt-nota">{inv.nota_fuentes}</p> : null}
          </>
        )}
        <div className="tt-pasar">
          {i > 0 ? <Boton variante="fantasma" tamano="chico" onClick={() => setActual(i - 1)}>← {pestañas[i - 1]}</Boton> : <span />}
          {i < pestañas.length - 1 ? <Boton variante="secundario" tamano="chico" onClick={() => setActual(i + 1)}>{pestañas[i + 1]} →</Boton> : null}
        </div>
      </div>
    </section>
  );
}

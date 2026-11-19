// El PDF de la «Investigación de mercado profunda», dibujado en la app tal como sale de la skill: portada oscura,
// hojas blancas con su franja de encabezado (producto · país · fecha) y su pie (uso interno · página), tablas con
// encabezado de color y filas alternas, cajas (recomendación, alertas, deseo, dolor…), las propuestas de valor, las
// opciones de título y la guía visual de 4 mensajes en hojas horizontales. Tipografía DejaVu Sans, la del PDF.
//
//   <Documento inv={investigacion} foto={urlDeLaFoto} T={ComponenteDeTexto} />
// T envuelve cada texto (ahí se marca lo que el usuario resaltó). «Descargar PDF» es imprimir esta misma página:
// las reglas de impresión (documento.css) dejan solo el documento, en A4, con los mismos encabezados y pies.
import { Fragment } from 'react';
import './documento.css';

/** Texto con **negrita**; cada tramo pasa por T (lo resaltado). */
function Rico({ children, T }) {
  const texto = typeof children === 'string' ? children : children === null || children === undefined ? '' : String(children);
  const partes = texto.split(/\*\*(.+?)\*\*/g);
  return partes.map((p, i) => (p ? i % 2 ? <strong key={i}><T>{p}</T></strong> : <Fragment key={i}><T>{p}</T></Fragment> : null));
}

const lista = (x) => (Array.isArray(x) ? x.filter((v) => typeof v === 'string' && v.trim()) : []);

function Bloque({ b, T, guia }) {
  const R = ({ children }) => <Rico T={T}>{children}</Rico>;
  switch (b?.tipo) {
    case 'parrafo':
      return <p className="doc-p"><R>{b.texto}</R></p>;
    case 'subtitulo':
      return <h3 className="doc-h3"><R>{b.texto}</R></h3>;
    case 'nota':
      return <p className="doc-nota"><R>{b.texto}</R></p>;
    case 'vinetas':
      return <ul className="doc-lista">{lista(b.items).map((x, i) => <li key={i}><R>{x}</R></li>)}</ul>;
    case 'numerada':
      return <ol className="doc-lista doc-lista--n">{lista(b.items).map((x, i) => <li key={i}><R>{x}</R></li>)}</ol>;
    case 'tabla': {
      const cols = Array.isArray(b.columnas) ? b.columnas : [];
      return (
        <div className="doc-junto">
          <div className="doc-tabla-caja">
          <table className={`doc-tabla doc-tabla--${['evita', 'azul'].includes(b.estilo) ? b.estilo : 'normal'}`}>
            <thead>
              <tr>{cols.map((c, i) => <th key={i}><R>{c}</R></th>)}</tr>
            </thead>
            <tbody>
              {(b.filas || []).map((f, i) => (
                <tr key={i}>{(Array.isArray(f) ? f : []).map((c, k) => <td key={k}><R>{c}</R></td>)}</tr>
              ))}
            </tbody>
          </table>
          </div>
          {b.nota ? <p className="doc-nota"><R>{b.nota}</R></p> : null}
        </div>
      );
    }
    case 'ficha':
      return (
        <div className="doc-junto">
          <table className="doc-tabla doc-tabla--ficha">
            <tbody>
              {(b.filas || []).map((f, i) => (
                <tr key={i}>
                  <th><R>{f?.[0]}</R></th>
                  <td><R>{f?.[1]}</R></td>
                </tr>
              ))}
            </tbody>
          </table>
          {b.nota ? <p className="doc-nota"><R>{b.nota}</R></p> : null}
        </div>
      );
    case 'caja': {
      const estilo = ['recomendacion', 'alerta', 'avatar', 'pendiente', 'cuidado', 'nota', 'encapsulada', 'te-pasa'].includes(b.estilo) ? b.estilo : 'nota';
      const items = lista(b.items);
      return (
        <div className={`doc-caja doc-caja--${estilo}`}>
          {b.titulo ? <p className="doc-caja__titulo"><R>{b.titulo}</R></p> : null}
          {b.texto ? <p className="doc-caja__texto"><R>{b.texto}</R></p> : null}
          {items.length ? (
            <ul className={estilo === 'te-pasa' ? 'doc-checks' : 'doc-lista'}>
              {items.map((x, i) => <li key={i}><R>{x}</R></li>)}
            </ul>
          ) : null}
          {b.pie ? <p className="doc-caja__pie"><R>{b.pie}</R></p> : null}
        </div>
      );
    }
    case 'cita':
      return (
        <blockquote className={`doc-cita doc-cita--${['dolor', 'deseo', 'central'].includes(b.estilo) ? b.estilo : 'central'}`}>
          "<R>{String(b.texto || '').replace(/^["«“]+|["»”]+$/g, '')}</R>"
        </blockquote>
      );
    case 'propuesta':
      return (
        <table className="doc-propuesta">
          <thead>
            <tr><th colSpan={2}><R>{b.titulo}</R></th></tr>
          </thead>
          <tbody>
            <tr><th>Dolor</th><td><R>{b.dolor}</R></td></tr>
            <tr><th>Propuesta</th><td><R>{b.propuesta}</R></td></tr>
            <tr><th>Tiempo</th><td><R>{b.tiempo}</R></td></tr>
          </tbody>
        </table>
      );
    case 'opcion':
      return (
        <div className={`doc-opcion doc-opcion--${b.estilo === 'dolor' ? 'dolor' : 'marca'}`}>
          {b.etiqueta ? <span className="doc-opcion__etiqueta"><R>{b.etiqueta}</R></span> : null}
          <strong className="doc-opcion__titulo"><R>{b.titulo}</R></strong>
          {b.subtitulo ? <span className="doc-opcion__sub"><R>{b.subtitulo}</R></span> : null}
        </div>
      );
    case 'franja':
      return (
        <div className="doc-franja">
          <p><strong><R>{b.etiqueta}</R></strong> <R>{b.texto}</R></p>
          {b.nota ? <p className="doc-franja__nota"><R>{b.nota}</R></p> : null}
        </div>
      );
    case 'guia-visual':
      return guia;
    default:
      return null;
  }
}

// ---------------------------------------------------------------- la guía visual (hojas horizontales)

function Sellos({ sellos }) {
  return (
    <div className="doc-maq__sellos">
      {lista(sellos).slice(0, 4).map((s, i) => <span key={i} className="doc-maq__sello">{s}</span>)}
    </div>
  );
}

function Producto({ foto, grande, texto = 'Foto real del producto' }) {
  return <div className={`doc-maq__producto${grande ? ' doc-maq__producto--grande' : ''}`}>{foto ? <img src={foto} alt="" /> : <span>{texto}</span>}</div>;
}

/** La maqueta 9:16 de un mensaje (lo que va dentro del celular). */
export function Maqueta({ m, n, foto, marcas = false }) {
  const q = m.maqueta || {};
  const f = m.franja || {};
  const Marca = ({ k }) => (marcas ? <span className="doc-maq__marca">{k}</span> : null);
  return (
    <div className="doc-maq">
      <div className="doc-maq__titulo">{m.titulo}<Marca k={1} /></div>
      <div className="doc-maq__franja">{[f.beneficio, f.tiempo, f.deseo].filter(Boolean).join('  ·  ')}</div>
      {m.subtitulo ? <div className="doc-maq__sub">{m.subtitulo}<Marca k={2} /></div> : null}
      {n === 1 ? (
        <>
          <div className="doc-maq__dos">
            <div className="doc-maq__foto">Foto: {q.foto}<Marca k={3} /></div>
            <div className="doc-maq__col">
              <span className="doc-maq__estrellas">★★★★★</span>
              <span className="doc-maq__validacion">{q.validacion}</span>
              <Producto foto={foto} texto="Foto real del producto" />
              <Marca k={4} />
            </div>
          </div>
          <div className="doc-maq__ingredientes">
            {lista(q.ingredientes).slice(0, 7).map((x, i) => <span key={i}><i />{x}</span>)}
            <Marca k={5} />
          </div>
          <Sellos sellos={q.sellos} />
          {q.oferta ? <div className="doc-maq__oferta">{q.oferta}</div> : null}
        </>
      ) : n === 2 ? (
        <>
          <div className="doc-maq__foto doc-maq__foto--ancha">Foto: {q.foto}<Marca k={3} /></div>
          <div className="doc-maq__titulo2">{q.titulo2}<Marca k={4} /></div>
          <div className="doc-maq__desc">{q.descripcion}</div>
          <Producto foto={foto} grande />
          <Sellos sellos={q.sellos} />
        </>
      ) : n === 3 ? (
        <>
          <div className="doc-maq__beneficios">
            {(q.beneficios || []).slice(0, 5).map((x, i) => (
              <div key={i} className="doc-maq__beneficio">
                <i />
                <span><b>{i + 1}&nbsp; {x?.titulo}</b><small>{x?.frase}</small></span>
              </div>
            ))}
            <Marca k={3} />
          </div>
          <Producto foto={foto} grande />
          <Sellos sellos={q.sellos} />
        </>
      ) : (
        <>
          <div className="doc-maq__desc">{q.descripcion}<Marca k={3} /></div>
          <div className="doc-maq__pasos">
            {lista(q.pasos).slice(0, 3).map((x, i) => <span key={i}><b>{i + 1}</b>{x}</span>)}
          </div>
          <Producto foto={foto} grande />
          <Sellos sellos={q.sellos} />
        </>
      )}
    </div>
  );
}

function Guia({ inv, foto, desde }) {
  const mensajes = (inv.guia?.mensajes || []).slice(0, 4);
  if (!mensajes.length) return null;
  return (
    <>
      <section className="doc-hoja doc-hoja--guia">
        <div className="doc-guia__dentro">
        <span className="doc-guia__kicker">GUÍA VISUAL DE ESTRUCTURA DE VENTAS</span>
        <h2 className="doc-guia__titulo">{inv.producto} · 4 mensajes para WhatsApp y landing</h2>
        <div className="doc-guia__fila">
          {mensajes.map((m, i) => (
            <Fragment key={i}>
              <div className="doc-guia__mini">
                <p className="doc-guia__nombre"><b>Mensaje {i + 1}</b> {m.seccion}</p>
                <Maqueta m={m} n={i + 1} foto={foto} />
                <p className="doc-guia__pie">{m.titulo}</p>
              </div>
              {i < mensajes.length - 1 ? <span className="doc-guia__flecha" aria-hidden="true" /> : null}
            </Fragment>
          ))}
        </div>
        <span className="doc-guia__pagina">Página {desde}</span>
        </div>
      </section>
      {mensajes.map((m, i) => (
        <section key={i} className="doc-hoja doc-hoja--guia">
          <div className="doc-guia__dentro doc-guia__dentro--mensaje">
          <div className="doc-mensaje__izq">
            <span className="doc-mensaje__medida">1080X1920 9:16</span>
            <Maqueta m={m} n={i + 1} foto={foto} marcas />
          </div>
          <div className="doc-mensaje__der">
            <span className="doc-guia__kicker">MENSAJE {i + 1} - {String(m.seccion || '').toUpperCase()}</span>
            <h2 className="doc-guia__titulo">{m.seccion}</h2>
            <p className="doc-mensaje__franja">Beneficio: {m.franja?.beneficio}&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;Tiempo: {m.franja?.tiempo}&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;Deseo: {m.franja?.deseo}</p>
            <ol className="doc-mensaje__elementos">
              {(m.elementos || []).map((e, k) => (
                <li key={k}>
                  <span className="doc-mensaje__n">{k + 1}</span>
                  <span><b>{e?.titulo}</b>{e?.texto}</span>
                </li>
              ))}
            </ol>
            <div className="doc-mensaje__objetivo">
              <b>OBJETIVO</b>
              {m.objetivo}
            </div>
          </div>
          <span className="doc-guia__pagina">Página {desde + i + 1}</span>
          </div>
        </section>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- el documento

const SinResaltar = ({ children }) => children;

export function Documento({ inv, foto = null, T = SinResaltar }) {
  const cabecera = `${inv.producto} · Investigación de mercado · ${inv.pais}`;
  const color = /^#[0-9a-f]{6}$/i.test(inv.color || '') ? inv.color : '#A8431F';
  const Hoja = ({ n, children, seccion }) => (
    <section className="doc-hoja" data-seccion={seccion}>
      <header className="doc-hoja__cabeza">
        <span>{cabecera}</span>
        <span>{inv.fecha}</span>
      </header>
      <div className="doc-hoja__cuerpo">{children}</div>
      <footer className="doc-hoja__pie">
        <span>Uso interno · No es asesoría médica ni legal</span>
        <span>Página {n}</span>
      </footer>
    </section>
  );
  const secciones = inv.secciones || [];
  const p = inv.portada || {};
  // (en pantalla cada sección es una hoja; al imprimir, el navegador reparte las páginas y numera solo). La guía va
  // después de la sección que la trae (la 14) y ocupa 5 hojas: las secciones que siguen (Andromeda) corren su número.
  const iGuia = secciones.findIndex((sec) => (sec.bloques || []).some((b) => b?.tipo === 'guia-visual'));
  const hojasGuia = iGuia >= 0 && inv.guia?.mensajes?.length ? 5 : 0;
  const hojaGuia = iGuia >= 0 ? iGuia + 3 : secciones.length + 2;
  const hojaDe = (i) => i + 2 + (iGuia >= 0 && i > iGuia ? hojasGuia : 0);
  return (
    <div className="doc" style={{ '--marca': color }}>
      <style>{`@media print { @page { @top-left { content: "${cabecera.replace(/["\\]/g, '')}"; background: ${color}; } @top-center { background: ${color}; } @top-right { content: "${String(inv.fecha || '').replace(/["\\]/g, '')}"; background: ${color}; } } }`}</style>
      <section className="doc-hoja doc-portada" data-seccion="Portada">
        <span className="doc-portada__sobre">INVESTIGACIÓN DE MERCADO PROFUNDA</span>
        <h1 className="doc-portada__titulo">{p.titulo || inv.producto}</h1>
        {p.subtitulo ? <p className="doc-portada__sub">{p.subtitulo}</p> : null}
        <p className="doc-portada__pais">{inv.pais}</p>
        <span className="doc-portada__linea" aria-hidden="true" />
        <dl className="doc-portada__datos">
          <dt>AVATAR PRINCIPAL</dt>
          <dd><T>{p.avatar}</T></dd>
          {p.quien_compra ? (
            <>
              <dt>QUIÉN COMPRA</dt>
              <dd><T>{p.quien_compra}</T></dd>
            </>
          ) : null}
          {p.canal ? (
            <>
              <dt>CANAL</dt>
              <dd>{p.canal}</dd>
            </>
          ) : null}
          <dt>FECHA</dt>
          <dd>{inv.fecha}</dd>
        </dl>
      </section>

      {secciones.map((sec, i) => {
        const bloques = sec.bloques || [];
        const conGuia = bloques.some((b) => b?.tipo === 'guia-visual');
        return (
          <Fragment key={i}>
            <Hoja n={hojaDe(i)} seccion={sec.titulo}>
              <h2 className="doc-h2">{i + 1}. {sec.titulo}</h2>
              {bloques.filter((b) => b?.tipo !== 'guia-visual').map((b, k) => <Bloque key={k} b={b} T={T} />)}
            </Hoja>
            {conGuia ? <Guia inv={inv} foto={foto} desde={hojaGuia} /> : null}
          </Fragment>
        );
      })}

      <Hoja n={secciones.length + 2 + hojasGuia} seccion="Fuentes">
        <h2 className="doc-h2">{secciones.length + 1}. Fuentes consultadas</h2>
        <ul className="doc-fuentes">
          {(inv.fuentes || []).map((f, i) => (
            <li key={i}>
              <strong>{f.titulo}</strong>
              {/^https?:\/\//.test(f.url || '') ? (
                <a href={f.url} target="_blank" rel="noreferrer noopener">{f.url}</a>
              ) : (
                <span>{f.url}</span>
              )}
            </li>
          ))}
        </ul>
        {inv.nota_fuentes ? <p className="doc-nota">{inv.nota_fuentes}</p> : null}
      </Hoja>
    </div>
  );
}

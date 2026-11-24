// #/landings — LANDINGS (2026-11-20q): pegas la URL de una landing y la app la CLONA tal cual (textos, imágenes,
// colores, estructura, carruseles…) y la deja lo más rápida posible (meta: 80+ de velocidad en celular, como PageSpeed).
// O la adapta a tu producto: la IA que elijas (Claude Code o Codex) reescribe los textos y ChatGPT hace las imágenes con
// tu producto. Cada landing se ve (en un celular de muestra), se mide y se descarga en zip.
// (2026-11-24) ANALIZAR: tu IA lee la landing y explica cómo vende (ángulo, gancho, oferta, secciones en orden, prueba
// social, objeciones, lo fuerte, lo flojo e ideas). Y «Subir a Shopify» escribe el código en tu tema con Shopify CLI y
// primero te da la VISTA PREVIA en tu tienda: la página se crea recién con «Publicar la página» (menú Shopify).
// Servidor: /api/landings (lib/landings/).
import { useState } from 'react';
import { CircleAlert, Copy, Download, ExternalLink, Eye, Gauge, LayoutTemplate, LoaderCircle, RefreshCw, ScanSearch, ShoppingBag, Smartphone, Trash2 } from 'lucide-react';
import { AreaTexto, Boton, CabeceraPagina, CampoTexto, EstadoVacio, Interruptor, Selector, useAvisos } from '../../componentes/index.js';
import { enlace } from '../../datos/rutas.js';
import { bandera } from '../../datos/paises.js';
import { pedirNuevo, useDatos } from '../../datos/api.js';
import { fechaRelativa } from '../../datos/formato.js';
import './landings.css';

const kb = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

function Medidor({ titulo, p, meta = 80 }) {
  if (!p) return null;
  if (p.error) return <div className="ld-medidor ld-medidor--error"><span>{titulo}</span><small>{p.error}</small></div>;
  const tono = p.puntaje >= 90 ? 'bien' : p.puntaje >= 50 ? 'medio' : 'mal';
  return (
    <div className={`ld-medidor ld-medidor--${tono}`}>
      <span className="ld-medidor__titulo">{titulo}</span>
      <svg viewBox="0 0 36 36" className="ld-medidor__aro" aria-hidden="true">
        <circle cx="18" cy="18" r="15.5" className="ld-medidor__fondo" />
        <circle cx="18" cy="18" r="15.5" className="ld-medidor__valor" strokeDasharray={`${(p.puntaje / 100) * 97.4} 97.4`} />
      </svg>
      <strong className="ld-medidor__numero">{p.puntaje}</strong>
      <small>
        LCP {p.lcp} · bloqueo {p.tbt} · {p.peso ? kb(p.peso * 1024) : ''}
        {p.simulado ? ' · simulado' : ''}
      </small>
      {titulo === 'La copia' ? <small className={p.puntaje >= meta ? 'ld-ok' : 'ld-bajo'}>{p.puntaje >= meta ? `Cumple la meta (${meta}+)` : `Bajo la meta de ${meta}`}</small> : null}
    </div>
  );
}

const FILAS_ANALISIS = [
  ['producto', 'Qué vende'],
  ['publico', 'A quién le habla'],
  ['angulo', 'Ángulo'],
  ['gancho', 'Gancho'],
  ['oferta', 'Oferta'],
  ['prueba_social', 'Prueba social'],
  ['garantia', 'Garantía'],
  ['urgencia', 'Urgencia'],
  ['cta', 'Llamadas a comprar'],
];

/** (2026-11-24) El análisis de la IA: cómo vende esta landing. */
function Analisis({ a }) {
  return (
    <details className="ld-analisis" open>
      <summary>
        <ScanSearch size={15} aria-hidden="true" /> Análisis de la landing
      </summary>
      <p className="ld-analisis__resumen">{a.resumen}</p>
      <dl className="ld-analisis__datos">
        {FILAS_ANALISIS.filter(([k]) => a[k]).map(([k, t]) => (
          <div key={k}>
            <dt>{t}</dt>
            <dd>{a[k]}</dd>
          </div>
        ))}
      </dl>
      {a.secciones?.length ? (
        <>
          <h4>Sus secciones, en orden</h4>
          <ol className="ld-analisis__secciones">
            {a.secciones.map((x) => (
              <li key={x.n}>
                <span className="ld-analisis__tipo">{x.tipo || 'sección'}</span> <strong>{x.titulo}</strong>
                {x.objetivo ? <small> — {x.objetivo}</small> : null}
              </li>
            ))}
          </ol>
        </>
      ) : null}
      <div className="ld-analisis__listas">
        {[['objeciones', 'Objeciones que resuelve'], ['fortalezas', 'Lo que mejor hace'], ['debilidades', 'Lo que le falta'], ['ideas', 'Ideas para tu producto']].map(([k, t]) =>
          a[k]?.length ? (
            <div key={k}>
              <h4>{t}</h4>
              <ul>{a[k].map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          ) : null
        )}
      </div>
    </details>
  );
}

function SubirAShopify({ l, tiendas, alCerrar }) {
  const { aviso } = useAvisos();
  // (2026-11-24) a una o a varias tiendas a la vez (cada una con su vista previa)
  const [tiendaIds, setTiendaIds] = useState(tiendas[0]?.id ? [tiendas[0].id] : []);
  const tiendaId = tiendaIds[0] || '';
  const [titulo, setTitulo] = useState(l.titulo || '');
  const [producto, setProducto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const tienda = tiendas.find((t) => t.id === tiendaId);
  const algunaCompleta = tiendas.some((t) => tiendaIds.includes(t.id) && t.tipo === 'completo');
  if (!tiendas.length) {
    return (
      <div className="ld-shopify">
        <p className="ld-ayuda">Primero conecta tu tienda en el menú <a href={enlace.shopify()}>Shopify</a> (puedes conectar varias).</p>
      </div>
    );
  }
  const subir = async () => {
    setOcupado(true);
    try {
      for (const t of tiendaIds) await pedirNuevo('/api/shopify/landing', { metodo: 'POST', cuerpo: { landingId: l.id, tiendaId: t, titulo, direccion: titulo, producto: producto.trim() || null } });
      aviso({ tipo: 'exito', titulo: 'Escribiéndola en tu tema', texto: 'En Landings › Cambios en tiendas verás su vista previa y el botón «Publicar la página».' });
      alCerrar();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude subirla', texto: e.message });
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div className="ld-shopify">
      <div className="ld-shopify__campos">
        <div className="ld-tiendas" role="group" aria-label="A qué tiendas">
          <span className="ld-grupo__etiqueta">Tiendas</span>
          {tiendas.map((t) => (
            <label key={t.id} className="ld-tienda">
              <input type="checkbox" checked={tiendaIds.includes(t.id)} onChange={() => setTiendaIds(tiendaIds.includes(t.id) ? tiendaIds.filter((x) => x !== t.id) : [...tiendaIds, t.id])} /> {bandera(t.pais)} {t.nombre} <small>{t.cuenta}</small>
            </label>
          ))}
        </div>
        <CampoTexto etiqueta="Título de la página" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} />
        {algunaCompleta ? <CampoTexto etiqueta="Producto de tu tienda (su dirección)" opcional placeholder="mi-producto" value={producto} onChange={(e) => setProducto(e.target.value)} ayuda="Los botones de comprar irán a ese producto." /> : null}
      </div>
      <p className="ld-ayuda">
        {tienda?.tipo === 'completo'
          ? 'Se escribe en el código de tu tema con Shopify CLI (solo archivos nuevos: no cambia nada de lo que ya tienes). Primero te queda la VISTA PREVIA en tu tienda; la página se crea y se publica recién cuando tocas «Publicar la página» en Landings › Cambios en tiendas.'
          : 'Se escribe en el código de tu tema con Shopify CLI (solo archivos nuevos) y te queda la VISTA PREVIA en tu tienda. Con «solo temas», la página la creas tú en Shopify eligiendo esa plantilla.'}
      </p>
      <div className="ld-botones">
        <Boton variante="primario" tamano="chico" icono={ShoppingBag} cargando={ocupado} disabled={!tiendaIds.length || !titulo.trim()} onClick={subir}>{tiendaIds.length > 1 ? `Subir a ${tiendaIds.length} tiendas con vista previa` : 'Subir con vista previa'}</Boton>
        <Boton variante="fantasma" tamano="chico" onClick={alCerrar}>Cancelar</Boton>
      </div>
    </div>
  );
}

function Landing({ l, abierta, onAbrir, onCambio, tiendas }) {
  const { aviso } = useAvisos();
  const [subiendo, setSubiendo] = useState(false);
  const vista = `/landing/${l.id}/index.html`;
  const ocupado = l.trabajando || l.estado === 'trabajando' || l.estado === 'midiendo' || l.estado === 'analizando';
  const accion = async (fn, ok) => {
    try {
      await fn();
      if (ok) aviso({ tipo: 'exito', titulo: ok });
      await onCambio();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No se pudo', texto: e.message });
    }
  };
  const p = l.informe?.pesos;
  return (
    <article className={`ld-item${abierta ? ' ld-item--abierta' : ''}`}>
      <header className="ld-item__cabeza">
        <div className="ld-item__textos">
          <strong>{l.titulo}</strong>
          <a href={l.url} target="_blank" rel="noopener noreferrer" className="ld-item__url">
            {l.url} <ExternalLink size={12} aria-hidden="true" />
          </a>
          <span className="ld-item__meta">
            {l.modo === 'adaptar' ? (l.prompt ? `Con tu pedido: «${l.prompt.length > 70 ? `${l.prompt.slice(0, 70)}…` : l.prompt}»` : `Adaptada a tu producto · textos con ${l.motor === 'codex' ? 'Codex' : 'Claude Code'}, imágenes con ChatGPT`) : 'Clon tal cual'} · {fechaRelativa(l.creado)}
          </span>
        </div>
        <span className={`ld-estado ld-estado--${l.estado}`}>
          {ocupado ? <LoaderCircle size={13} className="girando" aria-hidden="true" /> : null}
          {{ trabajando: 'Clonando…', midiendo: 'Midiendo…', analizando: 'Analizando…', lista: 'Lista', error: 'No salió' }[l.estado] || l.estado}
        </span>
      </header>
      {ocupado ? (
        <ul className="ld-progreso">{(l.progreso || []).slice(-4).map((x, i, a) => <li key={i} className={i === a.length - 1 ? 'ld-progreso__ahora' : ''}>{x}</li>)}</ul>
      ) : null}
      {l.estado === 'error' ? (
        <p className="ld-error"><CircleAlert size={14} aria-hidden="true" /> {l.error}</p>
      ) : null}
      {l.puntajes || p ? (
        <div className="ld-datos">
          <Medidor titulo="La original" p={l.puntajes?.original} />
          <Medidor titulo="La copia" p={l.puntajes?.copia} />
          {p ? (
            <dl className="ld-pesos">
              <div><dt>HTML</dt><dd>{kb(p.html)}</dd></div>
              <div><dt>CSS</dt><dd>{kb(p.css)} <small>de {kb(l.informe.cssAntes || 0)}</small></dd></div>
              <div><dt>Imágenes</dt><dd>{l.informe.imagenes} en WebP</dd></div>
              <div><dt>JavaScript</dt><dd>{l.informe.scripts} scripts fuera</dd></div>
              <div><dt>Carruseles</dt><dd>{l.informe.carruseles}</dd></div>
              {l.adaptada ? <div><dt>Adaptada</dt><dd>{l.adaptada.textos} textos · {l.adaptada.imagenes}/{l.adaptada.pedidas} imágenes</dd></div> : null}
            </dl>
          ) : null}
        </div>
      ) : null}
      {l.analisis ? <Analisis a={l.analisis} /> : null}
      {!l.analisis && l.analisisError && !ocupado ? <p className="ld-ayuda"><CircleAlert size={13} aria-hidden="true" /> {l.analisisError}</p> : null}
      {l.informe?.avisos?.length ? (
        <details className="ld-avisos">
          <summary>{l.informe.avisos.length} avisos</summary>
          <ul>{l.informe.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </details>
      ) : null}
      {l.estado === 'lista' || (p && !ocupado) ? (
        <div className="ld-botones">
          <Boton variante="primario" tamano="chico" icono={Smartphone} onClick={onAbrir}>{abierta ? 'Cerrar la vista' : 'Ver en celular'}</Boton>
          <Boton variante="secundario" tamano="chico" icono={ExternalLink} href={vista} target="_blank">Abrir</Boton>
          <Boton variante="secundario" tamano="chico" icono={Download} href={`/api/landings/${l.id}/descargar`}>Descargar (.zip)</Boton>
          <Boton variante="secundario" tamano="chico" icono={ShoppingBag} onClick={() => setSubiendo(!subiendo)}>Subir a Shopify</Boton>
          <Boton variante="secundario" tamano="chico" icono={ScanSearch} onClick={() => accion(() => pedirNuevo(`/api/landings/${l.id}/analizar`, { metodo: 'POST', cuerpo: {} }), 'Analizándola')}>{l.analisis ? 'Analizar otra vez' : 'Analizar'}</Boton>
          <Boton variante="fantasma" tamano="chico" icono={Gauge} onClick={() => accion(() => pedirNuevo(`/api/landings/${l.id}/medir`, { metodo: 'POST' }))}>Medir otra vez</Boton>
          <Boton variante="fantasma" tamano="chico" icono={Trash2} onClick={() => accion(() => pedirNuevo(`/api/landings/${l.id}`, { metodo: 'DELETE' }), 'Borrada')}>Borrar</Boton>
        </div>
      ) : null}
      {subiendo ? <SubirAShopify l={l} tiendas={tiendas} alCerrar={() => setSubiendo(false)} /> : null}
      {abierta ? (
        <div className="ld-celular">
          <iframe title={`Vista de ${l.titulo}`} src={vista} loading="lazy" />
        </div>
      ) : null}
    </article>
  );
}

export default function Landings() {
  const { aviso } = useAvisos();
  const [url, setUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [analizar, setAnalizar] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [abierta, setAbierta] = useState(null);
  const { datos, recargar } = useDatos('landings', () => pedirNuevo('/api/landings'), { cadaMs: 3000 });
  const { datos: prods } = useDatos('productos:lista-landings', () => pedirNuevo('/api/productos'));
  const productos = prods?.productos || [];
  const { datos: dt } = useDatos('shopify:tiendas', () => pedirNuevo('/api/shopify/tiendas'));
  const tiendas = dt?.tiendas || [];
  const landings = datos?.landings || [];
  const clonar = async () => {
    setOcupado(true);
    try {
      await pedirNuevo('/api/landings', { metodo: 'POST', cuerpo: { url: url.trim(), prompt: prompt.trim(), analizar } });
      setUrl('');
      setPrompt('');
      await recargar?.();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude empezar', texto: e.message });
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div className="pagina ld pila" style={{ '--hueco': 'var(--e-5)' }}>
      <CabeceraPagina sobretitulo="Crear" titulo="Landings" descripcion="Pega la dirección de una landing y, si quieres, escribe qué cambiarle. La app la clona funcionando igual que la original y te muestra qué tan rápido carga." />
      <section className="ld-nueva">
        <CampoTexto etiqueta="Dirección de la landing" placeholder="https://tutienda.com/products/…" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={2000} />
        <AreaTexto
          etiqueta="Qué quieres (opcional)"
          placeholder={'Vacío: la clona tal cual, funcionando igual que la original.\nO escribe lo que quieres, por ejemplo: «adáptala a mi producto Colágeno Plus», «cambia el precio a 89.900 y el tono a más cercano», «pásala a inglés».'}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          maxLength={4000}
        />
        {productos.length ? (
          <div className="ld-chips">
            <span className="ld-grupo__etiqueta">Para tu producto</span>
            {productos.slice(0, 12).map((p) => (
              <button key={p.id} type="button" className="ld-chip" onClick={() => setPrompt((t) => `${t.trim() ? `${t.trim()}\n` : ''}Adáptala a mi producto ${p.nombre}.`)}>
                {p.nombre}
              </button>
            ))}
          </div>
        ) : null}
        <div className="ld-opciones">
          <div className="ld-grupo">
            <span className="ld-grupo__etiqueta">Analizarla</span>
            <Interruptor activado={analizar} onCambio={setAnalizar} etiqueta={analizar ? 'Sí, que la IA explique cómo vende' : 'No'} />
          </div>
          <Boton variante="primario" icono={Copy} onClick={clonar} cargando={ocupado} disabled={!/^https?:\/\/\S+\.\S+/.test(url.trim())}>
            Clonar
          </Boton>
        </div>
        <p className="ld-ayuda">
          {prompt.trim()
            ? 'La copia exacta la hace el código; después la IA aplica lo que escribiste (si nombras uno de tus productos, usa su ficha y su investigación, y hace con ChatGPT las imágenes donde se ve el producto, con tu foto). Nada se inventa.'
            : 'La copia exacta la hace el código (sin IA): textos, imágenes, colores y estructura, y todo funciona como en la original (desplegables, pestañas, selectores, variantes). Quita la analítica, los píxeles y los popups de las apps, y deja las imágenes en WebP.'}
        </p>
      </section>
      {/* (2026-11-24) las tiendas a donde se suben: a la vista (se conectan en el menú Shopify) */}
      <section className="ld-mis-tiendas">
        <span className="ld-grupo__etiqueta">Tus tiendas de Shopify</span>
        {tiendas.length ? tiendas.map((t) => <span key={t.id} className="ld-tienda">{bandera(t.pais)} {t.nombre} <small>{t.cuenta}</small></span>) : <span className="ld-ayuda">Todavía no conectas ninguna. Conéctalas para subir tus landings con vista previa.</span>}
        <Boton variante="secundario" tamano="chico" icono={ShoppingBag} href={enlace.shopify()}>{tiendas.length ? 'Conectar otra tienda' : 'Conectar mis tiendas'}</Boton>
        {tiendas.length ? <Boton variante="secundario" tamano="chico" icono={Eye} href={enlace.trabajosTiendas()}>Cambios en tiendas</Boton> : null}
      </section>
      {!landings.length ? (
        <EstadoVacio icono={LayoutTemplate} titulo="Todavía no clonaste ninguna" descripcion="Pega arriba la dirección de una landing que te guste o de tu tienda." />
      ) : (
        <div className="ld-lista">
          {landings.map((l) => (
            <Landing key={l.id} l={l} abierta={abierta === l.id} onAbrir={() => setAbierta(abierta === l.id ? null : l.id)} onCambio={recargar} tiendas={tiendas} />
          ))}
        </div>
      )}
      <p className="ld-ayuda">
        <RefreshCw size={12} aria-hidden="true" /> La velocidad se mide con Lighthouse (lo mismo que PageSpeed) en celular. La primera medición tarda unos minutos más porque baja Lighthouse una sola vez.
      </p>
    </div>
  );
}

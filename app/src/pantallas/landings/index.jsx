// #/landings — LANDINGS (2026-11-20q): pegas la URL de una landing y la app la CLONA tal cual (textos, imágenes,
// colores, estructura, carruseles…) y la deja lo más rápida posible (meta: 80+ de velocidad en celular, como PageSpeed).
// O la adapta a tu producto: la IA que elijas (Claude Code o Codex) reescribe los textos y ChatGPT hace las imágenes con
// tu producto. Cada landing se ve (en un celular de muestra), se mide y se descarga en zip.
// Servidor: /api/landings (lib/landings/).
import { useEffect, useState } from 'react';
import { CircleAlert, Copy, Download, ExternalLink, Gauge, LayoutTemplate, LoaderCircle, RefreshCw, ShoppingBag, Smartphone, Trash2 } from 'lucide-react';
import { Boton, CabeceraPagina, CampoTexto, EstadoVacio, Selector, useAvisos } from '../../componentes/index.js';
import { enlace } from '../../datos/rutas.js';
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

function SubirAShopify({ l, tiendas, alCerrar }) {
  const { aviso } = useAvisos();
  const [tiendaId, setTiendaId] = useState(tiendas[0]?.id || '');
  const [titulo, setTitulo] = useState(l.titulo || '');
  const [producto, setProducto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const tienda = tiendas.find((t) => t.id === tiendaId);
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
      await pedirNuevo('/api/shopify/landing', { metodo: 'POST', cuerpo: { landingId: l.id, tiendaId, titulo, direccion: titulo, producto: producto.trim() || null } });
      aviso({ tipo: 'exito', titulo: 'Subiéndola a Shopify', texto: 'Mira cómo va en el menú Shopify.' });
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
        <Selector etiqueta="Tienda" value={tiendaId} onChange={(e) => setTiendaId(e.target.value)} opciones={tiendas.map((t) => ({ valor: t.id, etiqueta: `${t.nombre} (${t.dominio})` }))} />
        <CampoTexto etiqueta="Título de la página" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} />
        {tienda?.tipo === 'completo' ? <CampoTexto etiqueta="Producto de tu tienda (su dirección)" opcional placeholder="mi-producto" value={producto} onChange={(e) => setProducto(e.target.value)} ayuda="Los botones de comprar irán a ese producto." /> : null}
      </div>
      <p className="ld-ayuda">
        {tienda?.tipo === 'completo'
          ? 'Se sube como plantilla en tu tema publicado (solo archivos nuevos: no cambia nada de lo que ya tienes) y se crea la página publicada.'
          : 'Se sube como plantilla en tu tema publicado (solo archivos nuevos). Con «solo temas» la página la creas tú en Shopify eligiendo esa plantilla.'}
      </p>
      <div className="ld-botones">
        <Boton variante="primario" tamano="chico" icono={ShoppingBag} cargando={ocupado} disabled={!tiendaId || !titulo.trim()} onClick={subir}>Subir</Boton>
        <Boton variante="fantasma" tamano="chico" onClick={alCerrar}>Cancelar</Boton>
      </div>
    </div>
  );
}

function Landing({ l, abierta, onAbrir, onCambio, tiendas }) {
  const { aviso } = useAvisos();
  const [subiendo, setSubiendo] = useState(false);
  const vista = `/landing/${l.id}/index.html`;
  const ocupado = l.trabajando || l.estado === 'trabajando' || l.estado === 'midiendo';
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
            {l.modo === 'adaptar' ? `Adaptada a tu producto · textos con ${l.motor === 'codex' ? 'Codex' : 'Claude Code'}, imágenes con ChatGPT` : 'Clon tal cual'} · {fechaRelativa(l.creado)}
          </span>
        </div>
        <span className={`ld-estado ld-estado--${l.estado}`}>
          {ocupado ? <LoaderCircle size={13} className="girando" aria-hidden="true" /> : null}
          {{ trabajando: 'Clonando…', midiendo: 'Midiendo…', lista: 'Lista', error: 'No salió' }[l.estado] || l.estado}
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
  const [modo, setModo] = useState('tal-cual');
  const [motor, setMotor] = useState('claude');
  const [productoId, setProductoId] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [abierta, setAbierta] = useState(null);
  const { datos, recargar } = useDatos('landings', () => pedirNuevo('/api/landings'), { cadaMs: 3000 });
  const { datos: prods } = useDatos('productos:lista-landings', () => pedirNuevo('/api/productos'));
  const productos = prods?.productos || [];
  const { datos: dt } = useDatos('shopify:tiendas', () => pedirNuevo('/api/shopify/tiendas'));
  const tiendas = dt?.tiendas || [];
  useEffect(() => {
    if (!productoId && productos.length) setProductoId(productos[0].id);
  }, [productos, productoId]);
  const landings = datos?.landings || [];
  const clonar = async () => {
    setOcupado(true);
    try {
      await pedirNuevo('/api/landings', { metodo: 'POST', cuerpo: { url: url.trim(), modo, motor, productoId: modo === 'adaptar' ? productoId : null } });
      setUrl('');
      await recargar?.();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude empezar', texto: e.message });
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div className="pagina ld pila" style={{ '--hueco': 'var(--e-5)' }}>
      <CabeceraPagina sobretitulo="Crear" titulo="Landings" descripcion="Pega la dirección de una landing y la app la clona: tal cual (textos, imágenes, colores, estructura y carruseles) o adaptada a tu producto. Siempre la deja liviana para que cargue rápido en celular, y te muestra cuánto mejoró." />
      <section className="ld-nueva">
        <CampoTexto etiqueta="Dirección de la landing" placeholder="https://tutienda.com/products/…" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={2000} />
        <div className="ld-opciones">
          <div className="ld-grupo">
            <span className="ld-grupo__etiqueta">Cómo</span>
            <div className="ld-segmento" role="group" aria-label="Cómo clonarla">
              <button type="button" className={modo === 'tal-cual' ? 'activo' : ''} aria-pressed={modo === 'tal-cual'} onClick={() => setModo('tal-cual')}>Tal cual</button>
              <button type="button" className={modo === 'adaptar' ? 'activo' : ''} aria-pressed={modo === 'adaptar'} onClick={() => setModo('adaptar')}>Para mi producto</button>
            </div>
          </div>
          {modo === 'adaptar' ? (
            <>
              <label className="ld-grupo">
                <span className="ld-grupo__etiqueta">Producto</span>
                <select value={productoId} onChange={(e) => setProductoId(e.target.value)}>
                  {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </label>
              <div className="ld-grupo">
                <span className="ld-grupo__etiqueta">Textos y HTML con</span>
                <div className="ld-segmento" role="group" aria-label="Qué IA escribe los textos">
                  <button type="button" className={motor === 'claude' ? 'activo' : ''} aria-pressed={motor === 'claude'} onClick={() => setMotor('claude')}>Claude Code</button>
                  <button type="button" className={motor === 'codex' ? 'activo' : ''} aria-pressed={motor === 'codex'} onClick={() => setMotor('codex')}>Codex</button>
                </div>
              </div>
            </>
          ) : null}
          <Boton variante="primario" icono={Copy} onClick={clonar} cargando={ocupado} disabled={!/^https?:\/\/\S+\.\S+/.test(url.trim()) || (modo === 'adaptar' && !productoId)}>
            Clonar
          </Boton>
        </div>
        <p className="ld-ayuda">
          {modo === 'tal-cual'
            ? 'La copia exacta la hace el código (sin IA): no se pierde nada y no se inventa nada. Después la optimiza: imágenes en WebP y en su tamaño, sin el JavaScript de la tienda ni las apps, solo el CSS que usa, y los botones siguen llevando a la tienda original.'
            : `Misma estructura y diseño. ${motor === 'codex' ? 'Codex' : 'Claude Code'} reescribe los textos para tu producto (con su ficha y su investigación, sin inventar) y ChatGPT hace las imágenes donde se ve el producto, con tu foto. Las imágenes con ChatGPT no cuestan por imagen.`}
        </p>
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

// #/landings — LANDINGS (2026-11-20q): pegas la URL de una landing y la app la CLONA tal cual (textos, imágenes,
// colores, estructura, carruseles…) y la deja lo más rápida posible (meta: 80+ de velocidad en celular, como PageSpeed).
// O la adapta a tu producto: la IA que elijas (Claude Code o Codex) reescribe los textos y ChatGPT hace las imágenes con
// tu producto. Cada landing se ve (en un celular de muestra), se mide y se descarga en zip.
// (2026-11-24) ANALIZAR: tu IA lee la landing y explica cómo vende (ángulo, gancho, oferta, secciones en orden, prueba
// social, objeciones, lo fuerte, lo flojo e ideas). Y «Subir a Shopify» escribe el código en tu tema con Shopify CLI y
// primero te da la VISTA PREVIA en tu tienda: la página se crea recién con «Publicar la página» (menú Shopify).
// Servidor: /api/landings (lib/landings/).
import { useEffect, useState } from 'react';
import { CircleAlert, Copy, Download, ExternalLink, Eye, Gauge, LayoutTemplate, LoaderCircle, RefreshCw, ScanSearch, ShoppingBag, Smartphone, Trash2 } from 'lucide-react';
import { AreaTexto, Boton, CabeceraPagina, CampoTexto, EstadoVacio, Interruptor, Selector, useAvisos } from '../../componentes/index.js';
import { enlace, ir } from '../../datos/rutas.js';
import { bandera } from '../../datos/paises.js';
import { resenasPegadas } from '../../datos/resenas-pegadas.js';
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
          <div className="ld-analisis__secciones-visuales">
            {a.secciones.map((x,i) => <article className="ld-seccion-analizada" key={x.n || i}>
              <div className="ld-seccion-analizada__imagen">{x.captura?.url ? <a href={x.captura.url} target="_blank" rel="noopener noreferrer" aria-label={`Ampliar captura de ${x.titulo}`}><img src={x.captura.url} alt={`Captura real: ${x.captura.titulo || x.titulo}`} loading="lazy"/><span>Ampliar captura{x.captura.parcial?' · parcial':''}</span></a> : <div className="ld-seccion-analizada__sin-captura"><LayoutTemplate size={30}/><span>Sin captura vinculada</span><small>Actualiza el análisis para incluir la vista real de la sección.</small></div>}</div>
              <div className="ld-seccion-analizada__texto"><div className="ld-seccion-analizada__orden">{String(i+1).padStart(2,'0')} <span className="ld-analisis__tipo">{x.tipo || 'sección'}</span></div><h3>{x.titulo || `Sección ${i+1}`}</h3>
                {x.objetivo?<div><h4>Qué busca comunicar</h4><p>{x.objetivo}</p></div>:null}
                {x.analisis?<div><h4>Análisis de la sección</h4><p>{x.analisis}</p></div>:null}
                {x.porQueFunciona?<div><h4>Por qué podría funcionar</h4><p>{x.porQueFunciona}</p></div>:null}
                {x.mejora?<div className="ld-seccion-analizada__mejora"><h4>Qué mejoraría</h4><p>{x.mejora}</p></div>:null}
                {x.captura?<small className="ld-ayuda">{x.captura.fuente || 'Captura de la copia al momento del análisis'}{x.captura.parcial?' · se muestra el inicio de la sección':''}</small>:null}
              </div>
            </article>)}
          </div>
          {a.capturasError?<p className="ld-ayuda">{a.capturasError}</p>:null}
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

/** (2026-11-25f) Cómo la armó el equipo: cada agente, qué decidió y por qué. */
function Equipo({ agentes }) {
  if (!agentes?.length) return null;
  const marca = { esperando: '·', trabajando: '…', listo: '✓' };
  return (
    <details className="ld-equipo" open>
      <summary>Cómo la armó el equipo</summary>
      <ol>
        {agentes.map((a) => (
          <li key={a.id} className={`ld-equipo__agente ld-equipo__agente--${a.estado}`}>
            <strong>{marca[a.estado] || ''} {a.nombre} · {a.rol}</strong>
            {a.resumen ? <p>{a.resumen}</p> : <p className="ld-ayuda">{a.estado === 'trabajando' ? 'Trabajando…' : 'Esperando su turno.'}</p>}
            {a.pendientes?.length ? (
              <ul className="ld-equipo__pendientes">
                {a.pendientes.map((x, i) => <li key={i}>{x}</li>)}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  );
}

/** (2026-11-27j) El auditor de la clase «Cada página es una landing» (Joaquín Buelvas): 6 pilares y por dónde empezar. */
function Auditor({ a }) {
  if (!a?.pilares?.length) return null;
  return (
    <details className="ld-equipo ld-auditor">
      <summary>{`Auditor de la clase: ${a.porcentaje} %${a.empezarPor ? ` · Empieza por: ${a.empezarPor}` : ' · Funciona como una landing'}`}</summary>
      <ol>
        {a.pilares.map((p) => (
          <li key={p.nombre} className="ld-equipo__agente">
            <strong>{`${p.cumple === p.total ? '✓' : '·'} ${p.nombre} (${p.cumple} de ${p.total})`}</strong>
            {p.puntos.filter((x) => !x.ok && x.falta).length ? (
              <ul className="ld-equipo__pendientes">{p.puntos.filter((x) => !x.ok && x.falta).map((x) => <li key={x.texto}>{x.falta}</li>)}</ul>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
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
          {l.url ? (
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="ld-item__url">
              {l.url} <ExternalLink size={12} aria-hidden="true" />
            </a>
          ) : null}
          <span className="ld-item__meta">
            {l.modo === 'crear' ? `Creada desde la plantilla con el equipo${l.prompt ? ` · «${l.prompt.length > 60 ? `${l.prompt.slice(0, 60)}…` : l.prompt}»` : ''}` : l.modo === 'adaptar' ? (l.prompt ? `Con tu pedido: «${l.prompt.length > 70 ? `${l.prompt.slice(0, 70)}…` : l.prompt}»` : `Adaptada a tu producto · textos con ${l.motor === 'codex' ? 'Codex' : 'Claude Code'}, imágenes con ChatGPT`) : 'Clon tal cual'} · {fechaRelativa(l.creado)}
          </span>
        </div>
        <span className={`ld-estado ld-estado--${l.estado}`}>
          {ocupado ? <LoaderCircle size={13} className="girando" aria-hidden="true" /> : null}
          {{ trabajando: l.modo === 'crear' ? 'Creando…' : 'Clonando…', midiendo: 'Midiendo…', analizando: 'Analizando…', lista: 'Lista', error: 'No salió' }[l.estado] || l.estado}
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
          {l.url ? <Medidor titulo="La original" p={l.puntajes?.original} /> : null}
          <Medidor titulo={l.url ? 'La copia' : 'Tu landing'} p={l.puntajes?.copia} />
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
      <Equipo agentes={l.agentes} />
      <Auditor a={l.auditoria} />
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

export default function Landings({ consulta }) {
  const proyecto=consulta?.get('proyecto');
  const { aviso } = useAvisos();
  const [url, setUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [forma, setForma] = useState('clonar'); // (2026-11-25f) clonar una landing o crearla con el equipo
  const [productoId, setProductoId] = useState('');
  const [precios, setPrecios] = useState({ uno: '', dos: '', tres: '', antes: '' });
  const [registro, setRegistro] = useState('');
  const [resenas, setResenas] = useState([]); // (2026-11-27d) solo reseñas reales de sus clientas
  const [plantilla, setPlantilla] = useState('amuna'); // (2026-11-27f) la estructura de la landing de AMUNA o la de CEN
  const [subiendo, setSubiendo] = useState(null);
  const [pegadas, setPegadas] = useState('');
  const [capturas, setCapturas] = useState([]); // (2026-11-27g) capturas reales de clientas: [{ id, vista }]
  const subirCapturas = async (archivos) => {
    setSubiendo('capturas');
    try {
      for (const a of [...(archivos || [])].slice(0, 9 - capturas.length)) {
        const r = await pedirNuevo('/api/landings/fotos', { metodo: 'POST', binario: a });
        setCapturas((l) => [...l, { id: r.id, vista: URL.createObjectURL(a) }].slice(0, 9));
      }
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude subir la captura', texto: e.message });
    } finally {
      setSubiendo(null);
    }
  };
  const cambiarResena = (k, cambios) => setResenas((l) => l.map((x, i) => (i === k ? { ...x, ...cambios } : x)));
  const subirFoto = async (k, archivo) => {
    if (!archivo) return;
    setSubiendo(k);
    try {
      const r = await pedirNuevo('/api/landings/fotos', { metodo: 'POST', binario: archivo });
      cambiarResena(k, { foto: r.id, vista: URL.createObjectURL(archivo) });
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude subir la foto', texto: e.message });
    } finally {
      setSubiendo(null);
    }
  };
  const [analizar, setAnalizar] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [abierta, setAbierta] = useState(null);
  useEffect(()=>setAbierta(null),[proyecto]);
  const { datos, recargar } = useDatos('landings', () => pedirNuevo('/api/landings'), { cadaMs: 3000 });
  const { datos: prods } = useDatos('productos:lista-landings', () => pedirNuevo('/api/productos'));
  const productos = prods?.productos || [];
  const { datos: dt } = useDatos('shopify:tiendas', () => pedirNuevo('/api/shopify/tiendas'));
  const tiendas = dt?.tiendas || [];
  const landings = (datos?.landings || []).filter(l=>l.id===proyecto);
  const crearConEquipo = async () => {
    setOcupado(true);
    try {
      const creada = await pedirNuevo('/api/landings/crear', { metodo: 'POST', cuerpo: { productoId, plantilla, capturas: capturas.map((c) => c.id), prompt: prompt.trim(), precios, registro: registro.trim(), resenas: resenas.filter((r) => r.nombre.trim() && r.texto.trim()).map(({ vista, ...r }) => r) } });
      setPrompt('');
      await recargar?.();
      ir(`/landings?proyecto=${encodeURIComponent(creada.id)}`);
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude empezar', texto: e.message });
    } finally {
      setOcupado(false);
    }
  };
  const clonar = async () => {
    setOcupado(true);
    try {
      const creada=await pedirNuevo('/api/landings', { metodo: 'POST', cuerpo: { url: url.trim(), prompt: prompt.trim(), analizar } });
      setUrl('');
      setPrompt('');
      await recargar?.();
      ir(`/landings?proyecto=${encodeURIComponent(creada.id)}`);
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude empezar', texto: e.message });
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div className="pagina ld pila" style={{ '--hueco': 'var(--e-5)' }}>
      <CabeceraPagina sobretitulo={proyecto ? "ANÁLISIS / LANDING" : "Crear"} titulo={proyecto ? landings[0]?.titulo || "Tu landing" : "Landings"} descripcion={proyecto ? "Revisa cada sección con su captura, entiende su mensaje y consulta las mejoras sugeridas. La vista completa está disponible debajo del análisis." : "Pega la dirección de una landing y, si quieres, escribe qué cambiarle. La app la clona funcionando igual que la original y te muestra qué tan rápido carga."} />
      {!proyecto ? <section className="ld-nueva">
        <div className="ld-segmento" role="group" aria-label="Clonar o crear">
          <button type="button" className={forma === 'clonar' ? 'activo' : ''} aria-pressed={forma === 'clonar'} onClick={() => setForma('clonar')}>Clonar una landing</button>
          <button type="button" className={forma === 'crear' ? 'activo' : ''} aria-pressed={forma === 'crear'} onClick={() => setForma('crear')}>Crear con el equipo</button>
        </div>
        {forma === 'crear' ? (
          <>
            <label className="ld-grupo">
              <span className="ld-grupo__etiqueta">Tu producto</span>
              <select value={productoId} onChange={(e) => setProductoId(e.target.value)}>
                <option value="">Elige el producto…</option>
                {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </label>
            <div className="ld-grupo">
              <span className="ld-grupo__etiqueta">Plantilla</span>
              <div className="ld-segmento" role="group" aria-label="Plantilla">
                <button type="button" className={plantilla === 'amuna' ? 'activo' : ''} aria-pressed={plantilla === 'amuna'} onClick={() => setPlantilla('amuna')}>AMUNA: combos y ritual</button>
                <button type="button" className={plantilla === 'cen' ? 'activo' : ''} aria-pressed={plantilla === 'cen'} onClick={() => setPlantilla('cen')}>CEN</button>
              </div>
              <small className="ld-ayuda">{plantilla === 'amuna' ? 'La estructura de tu landing de AMUNA tal cual: galería, combos, ruta, pasos, comparación, cuidado y preguntas. ChatGPT hace sus 31 imágenes con la medida de cada una. Con tus reseñas reales salen también el testimonio, «Ellas cuentan» (las que tengan foto) y las reseñas con su nota.' : 'La plantilla anterior (CEN): galería, combos, creativos, cómo funciona, cuidado y preguntas.'}</small>
            </div>
            <div className="ld-precios">
              <span className="ld-grupo__etiqueta">Tus precios en pesos (los combos de la página)</span>
              <div className="ld-precios__campos">
                {[['uno', '1 unidad'], ['dos', '2 unidades'], ['tres', '3 unidades'], ['antes', 'Precio normal (tachado)']].map(([k, t]) => (
                  <label key={k}>
                    <small>{t}</small>
                    <input inputMode="numeric" placeholder={{ uno: '89900', dos: '152900', tres: '199900', antes: '89900' }[k]} value={precios[k]} onChange={(e) => setPrecios((x) => ({ ...x, [k]: e.target.value.replace(/[^\d.]/g, '') }))} />
                  </label>
                ))}
              </div>
              <small className="ld-ayuda">Los de 1, 2 y 3 unidades son obligatorios. El precio normal es opcional: con él se calculan el tachado y el «Ahorras».</small>
            </div>
            <CampoTexto etiqueta="Registro sanitario (opcional)" placeholder="Ej.: RSA-0012345-2024. Sin número, la landing no muestra el sello del registro." value={registro} onChange={(e) => setRegistro(e.target.value)} maxLength={60} />
            <div className="ld-resenas">
              <span className="ld-grupo__etiqueta">Reseñas reales de tus clientas (opcional)</span>
              {resenas.map((r, k) => (
                <div className="ld-resenas__fila" key={k}>
                  <input placeholder="Nombre (ej.: Luz Marina R.)" value={r.nombre} maxLength={60} onChange={(e) => setResenas((l) => l.map((x, i) => (i === k ? { ...x, nombre: e.target.value } : x)))} />
                  <input placeholder="Ciudad" value={r.ciudad} maxLength={40} onChange={(e) => setResenas((l) => l.map((x, i) => (i === k ? { ...x, ciudad: e.target.value } : x)))} />
                  <textarea placeholder="Lo que escribió tu clienta, tal cual" value={r.texto} maxLength={700} rows={2} onChange={(e) => setResenas((l) => l.map((x, i) => (i === k ? { ...x, texto: e.target.value } : x)))} />
                  <Boton variante="fantasma" tamano="chico" onClick={() => setResenas((l) => l.filter((_, i) => i !== k))}>Quitar</Boton>
                  <div className="ld-resenas__extra">
                    <select aria-label="Estrellas" value={r.estrellas || 5} onChange={(e) => cambiarResena(k, { estrellas: Number(e.target.value) })}>
                      {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
                    </select>
                    <label className="ld-resenas__foto">
                      {r.vista ? <img src={r.vista} alt="" /> : null}
                      <span>{subiendo === k ? 'Subiendo…' : r.foto ? 'Cambiar foto' : 'Subir su foto (opcional)'}</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => subirFoto(k, e.target.files?.[0])} />
                    </label>
                  </div>
                </div>
              ))}
              {resenas.length < 12 ? (
                <Boton variante="secundario" tamano="chico" onClick={() => setResenas((l) => [...l, { nombre: '', ciudad: '', texto: '', estrellas: 5 }])}>
                  Agregar una reseña real
                </Boton>
              ) : null}
              <details className="ld-pegar">
                <summary>Pegar varias reseñas</summary>
                <textarea rows={4} value={pegadas} onChange={(e) => setPegadas(e.target.value)} placeholder={'Una por línea: Nombre | Ciudad | Estrellas | Texto\nLuz Marina R. | Medellín | 5 | Desde la segunda semana duermo mejor.'} aria-label="Reseñas para pegar" />
                <Boton variante="secundario" tamano="chico" disabled={!resenasPegadas(pegadas).length} onClick={() => { const nuevas = resenasPegadas(pegadas); setResenas((l) => [...l, ...nuevas].slice(0, 12)); setPegadas(''); }}>
                  {`Agregar ${resenasPegadas(pegadas).length || ''} reseñas`}
                </Boton>
              </details>
              {plantilla === 'amuna' ? <small className="ld-ayuda"><strong>{`Para que quede igual a AMUNA: 11 reseñas (5 con foto) y 9 capturas. Llevas ${resenas.filter((r) => r.nombre.trim() && r.texto.trim()).length} reseñas (${resenas.filter((r) => r.foto).length} con foto) y ${capturas.length} capturas.`}</strong></small> : null}
              <small className="ld-ayuda">Salen tal cual en la página. Sin reseñas reales, la landing no lleva reseñas ni opiniones de médicos: inventarlas engaña al comprador y la SIC o Meta lo castigan.</small>
            </div>
            {plantilla === 'amuna' ? (
              <div className="ld-resenas">
                <span className="ld-grupo__etiqueta">Capturas reales de tus clientas (opcional, hasta 9)</span>
                <div className="ld-capturas">
                  {capturas.map((c, k) => (
                    <button type="button" key={c.id} className="ld-capturas__una" title="Quitar" onClick={() => setCapturas((l) => l.filter((_, i) => i !== k))}>
                      <img src={c.vista} alt={`Captura ${k + 1}`} />
                    </button>
                  ))}
                  {capturas.length < 9 ? (
                    <label className="ld-resenas__foto">
                      <span>{subiendo === 'capturas' ? 'Subiendo…' : 'Subir capturas'}</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => subirCapturas(e.target.files)} />
                    </label>
                  ) : null}
                </div>
                <small className="ld-ayuda">Chats, mensajes o historias que te mandaron tus clientas: salen tal cual en «Experiencias con…», como en AMUNA. Sin capturas, esa parte lleva fotos caseras de tu producto en el día a día (nunca se inventan chats).</small>
              </div>
            ) : null}
            <AreaTexto
              etiqueta="Qué quieres (opcional)"
              placeholder={'Por ejemplo: «enfócala en mujeres de 45 a 60 con sofocos», «tono cercano», «combo 2x1 a 99.900».'}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              maxLength={4000}
            />
            <div className="ld-opciones">
              <Boton variante="primario" icono={LayoutTemplate} onClick={crearConEquipo} cargando={ocupado} disabled={!productoId || !precios.uno || !precios.dos || !precios.tres}>
                Crear con el equipo
              </Boton>
            </div>
            <p className="ld-ayuda">
              La landing nace de la plantilla (galería, oferta por combos con pago contra entrega, creativos, reseñas y preguntas) y la arma el equipo con la investigación de mercado de tu producto: Emilio decide la estrategia, Simón entiende qué hace cada sección, título e imagen, Antonia le da la identidad de tu producto (los colores de su empaque; la letra es siempre Inter y el fondo de la página es el mismo de las imágenes), Valeria escribe los textos, Mateo diseña las imágenes (ChatGPT: los creativos con la foto de tu producto y fotos de estilo de vida con mujeres como tu cliente ideal, sin efectos de IA) y Renata revisa que nada esté inventado y después mira la página terminada, sección por sección, contra la base. Usa tu plan de IA: unos 7 trabajos de IA y una imagen por cada foto de la página.
            </p>
          </>
        ) : <>
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
        </>}
      </section>
      : null}
      {/* (2026-11-24) las tiendas a donde se suben: a la vista (se conectan en el menú Shopify) */}
      <section className="ld-mis-tiendas">
        <span className="ld-grupo__etiqueta">Tus tiendas de Shopify</span>
        {tiendas.length ? tiendas.map((t) => <span key={t.id} className="ld-tienda">{bandera(t.pais)} {t.nombre} <small>{t.cuenta}</small></span>) : <span className="ld-ayuda">Todavía no conectas ninguna. Conéctalas para subir tus landings con vista previa.</span>}
        <Boton variante="secundario" tamano="chico" icono={ShoppingBag} href={enlace.shopify()}>{tiendas.length ? 'Conectar otra tienda' : 'Conectar mis tiendas'}</Boton>
        {tiendas.length ? <Boton variante="secundario" tamano="chico" icono={Eye} href={enlace.trabajosTiendas()}>Cambios en tiendas</Boton> : null}
      </section>
      {proyecto && !landings.length ? (
        <EstadoVacio icono={LayoutTemplate} titulo={datos ? "No encuentro esa landing" : "Cargando landing…"} descripcion={datos ? "Vuelve a tus carpetas para elegir otra." : "Preparando la vista del proyecto."} />
      ) : proyecto ? (
        <div className="ld-lista">
          {landings.map((l) => (
            <Landing key={l.id} l={l} abierta={abierta === l.id} onAbrir={() => setAbierta(abierta === l.id ? null : l.id)} onCambio={recargar} tiendas={tiendas} />
          ))}
        </div>
      ) : null}
      <p className="ld-ayuda">
        <RefreshCw size={12} aria-hidden="true" /> La velocidad se mide con Lighthouse (lo mismo que PageSpeed) en celular. La primera medición tarda unos minutos más porque baja Lighthouse una sola vez.
      </p>
    </div>
  );
}

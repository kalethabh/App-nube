// #/shopify — TUS TIENDAS DE SHOPIFY (2026-11-20r): conectas una o varias, eliges en cuál trabajar y le pides a la IA
// (Claude Code o Codex) cambios en el CÓDIGO del tema. La app lo sube como tema nuevo SIN PUBLICAR, con vista previa, y
// tú lo publicas. Con acceso completo, la IA también propone cambios en páginas, productos… que apruebas uno por uno.
// Las landings se suben desde Crear › Landings. Servidor: /api/shopify (lib/shopify/).
import { useEffect, useState } from 'react';
import { CircleAlert, CircleCheck, ExternalLink, Eye, KeyRound, LoaderCircle, Plus, Rocket, Send, ShoppingBag, Store, Trash2, Wand2 } from 'lucide-react';
import { AreaTexto, Boton, CabeceraPagina, CampoTexto, EstadoVacio, Selector, useAvisos } from '../../componentes/index.js';
import { pedirNuevo, useDatos } from '../../datos/api.js';
import { fechaRelativa } from '../../datos/formato.js';
import './shopify.css';

const ESTADOS = { trabajando: 'Trabajando…', 'vista-previa': 'Vista previa lista', lista: 'Lista para revisar', publicado: 'Publicado', descartado: 'Descartado', error: 'No salió' };

function Conectar({ alConectar, abierto, setAbierto }) {
  const { aviso } = useAvisos();
  const [forma, setForma] = useState('dev');
  const [dominio, setDominio] = useState('');
  const [token, setToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [secreto, setSecreto] = useState('');
  const [nombre, setNombre] = useState('');
  const [ocupado, setOcupado] = useState(false);
  if (!abierto) return <Boton variante="secundario" icono={Plus} onClick={() => setAbierto(true)}>Conectar una tienda</Boton>;
  const listo = dominio.trim() && (forma === 'dev' ? clientId.trim() && secreto.trim() : token.trim());
  const conectar = async () => {
    setOcupado(true);
    try {
      const cuerpo = forma === 'dev' ? { dominio, clientId, clientSecret: secreto, nombre } : { dominio, token, nombre };
      const t = await pedirNuevo('/api/shopify/tiendas', { metodo: 'POST', cuerpo });
      aviso({ tipo: 'exito', titulo: `${t.nombre} conectada`, texto: t.tipo === 'completo' ? 'Con acceso completo.' : 'Solo para temas.' });
      setDominio('');
      setToken('');
      setClientId('');
      setSecreto('');
      setNombre('');
      setAbierto(false);
      alConectar(t.id);
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No se conectó', texto: e.message });
    } finally {
      setOcupado(false);
    }
  };
  return (
    <section className="sh-conectar">
      <h3><KeyRound size={16} aria-hidden="true" /> Conectar una tienda</h3>
      <div className="sh-segmento" role="group" aria-label="Cómo conectarla">
        <button type="button" className={forma === 'dev' ? 'activo' : ''} aria-pressed={forma === 'dev'} onClick={() => setForma('dev')}>Client ID y secreto (recomendado)</button>
        <button type="button" className={forma === 'token' ? 'activo' : ''} aria-pressed={forma === 'token'} onClick={() => setForma('token')}>Token o Theme Access</button>
      </div>
      {forma === 'dev' ? (
        <ol className="sh-pasos">
          <li>Entra a <a href="https://dev.shopify.com/dashboard" target="_blank" rel="noopener noreferrer">dev.shopify.com</a> con la MISMA cuenta de tu tienda › <b>Crear app</b> (ponle «Kads Studio»).</li>
          <li>En <b>Versiones</b>, en «Alcances de acceso» pon: <code>read_themes, write_themes, read_content, write_content, read_online_store_pages, write_online_store_pages, read_products, write_products, read_files, write_files</code> (y los que quieras que la IA pueda usar) › <b>Publicar</b>.</li>
          <li><b>Instalar app</b> › elige tu tienda › Instalar.</li>
          <li>En <b>Configuración</b> copia el <b>Client ID</b> y el <b>secreto</b> y pégalos aquí. La app pide el token y lo renueva sola cada día.</li>
        </ol>
      ) : (
        <ol className="sh-pasos">
          <li><b>App creada antes de 2026</b> (Configuración › Apps › Desarrollar apps): su token de la API de administración (<code>shpat_</code>), con acceso completo.</li>
          <li><b>Solo temas</b>: instala la app «Theme Access» de Shopify, crea una contraseña y pégala (<code>shptka_</code>).</li>
        </ol>
      )}
      <div className="sh-conectar__campos">
        <CampoTexto etiqueta="Dirección de la tienda" placeholder="tutienda.myshopify.com" value={dominio} onChange={(e) => setDominio(e.target.value)} autoComplete="off" />
        {forma === 'dev' ? (
          <>
            <CampoTexto etiqueta="Client ID" placeholder="a1b2c3…" value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" />
            <CampoTexto etiqueta="Secreto (Client secret)" type="password" placeholder="••••••" value={secreto} onChange={(e) => setSecreto(e.target.value)} autoComplete="new-password" />
          </>
        ) : (
          <CampoTexto etiqueta="Token (shpat_…) o contraseña (shptka_…)" type="password" placeholder="shpat_…" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="new-password" />
        )}
        <CampoTexto etiqueta="Nombre" opcional placeholder="Mi tienda Colombia" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} />
      </div>
      <p className="sh-ayuda">Las claves se guardan solo en tu computador (no se suben a GitHub ni van en los paquetes) y nunca se muestran.</p>
      <div className="sh-fila">
        <Boton variante="primario" icono={Store} cargando={ocupado} disabled={!listo} onClick={conectar}>Probar y conectar</Boton>
        <Boton variante="fantasma" onClick={() => setAbierto(false)}>Cancelar</Boton>
      </div>
    </section>
  );
}

function Trabajo({ t, recargar }) {
  const { aviso } = useAvisos();
  const [ocupado, setOcupado] = useState('');
  const accion = async (que, ruta, metodo = 'POST', ok) => {
    setOcupado(que);
    try {
      await pedirNuevo(ruta, { metodo });
      if (ok) aviso({ tipo: 'exito', titulo: ok });
      await recargar();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No se pudo', texto: e.message });
    } finally {
      setOcupado('');
    }
  };
  const ocupadoT = t.trabajando || t.estado === 'trabajando';
  return (
    <article className="sh-trabajo">
      <header className="sh-trabajo__cabeza">
        <div>
          <strong>{t.tipo === 'landing' ? `Landing: ${t.titulo}` : t.pedido}</strong>
          <span className="sh-meta">
            {t.tiendaNombre}
            {t.temaNombre ? ` · tema «${t.temaNombre}»` : ''}
            {t.tipo === 'tema' ? ` · ${t.motor === 'codex' ? 'Codex' : 'Claude Code'}` : ''} · {fechaRelativa(t.creado)}
          </span>
        </div>
        <span className={`sh-estado sh-estado--${t.estado}`}>
          {ocupadoT ? <LoaderCircle size={13} className="girando" aria-hidden="true" /> : null}
          {ESTADOS[t.estado] || t.estado}
        </span>
      </header>
      {ocupadoT ? <ul className="sh-progreso">{(t.progreso || []).slice(-3).map((x, i, a) => <li key={i} className={i === a.length - 1 ? 'ahora' : ''}>{x}</li>)}</ul> : null}
      {t.estado === 'error' ? <p className="sh-error"><CircleAlert size={14} aria-hidden="true" /> {t.error}</p> : null}
      {t.resumen ? <p className="sh-resumen">{t.resumen}</p> : null}
      {t.archivos?.length ? (
        <details className="sh-archivos">
          <summary>{t.archivos.length} archivo(s) del tema cambiado(s)</summary>
          <ul>{t.archivos.map((f) => <li key={f}><code>{f}</code></li>)}</ul>
        </details>
      ) : null}
      {t.tipo === 'landing' && t.estado === 'vista-previa' ? (
        <div className="sh-fila">
          <p className="sh-ayuda">El código ya está en tu tema «{t.temaNombre}» (solo archivos nuevos). Mírala en tu tienda; la página todavía no existe y nadie la ve sin este enlace.</p>
          {t.vistaPrevia ? <Boton variante="secundario" tamano="chico" icono={Eye} href={t.vistaPrevia} target="_blank">Ver la vista previa en tu tienda</Boton> : null}
          <Boton variante="primario" tamano="chico" cargando={ocupado === 'publicar-landing'} onClick={() => accion('publicar-landing', `/api/shopify/trabajos/${t.id}/publicar`, 'POST', 'Página publicada')}>Publicar la página</Boton>
        </div>
      ) : null}
      {t.tipo === 'landing' && t.estado === 'lista' ? (
        t.pagina ? (
          <p className="sh-ok"><CircleCheck size={14} aria-hidden="true" /> Publicada en <a href={t.pagina} target="_blank" rel="noopener noreferrer">{t.pagina}</a></p>
        ) : (
          <p className="sh-ayuda">Subida como plantilla. En Shopify: Tienda online › Páginas › Agregar página, y en «Plantilla» elige <b>{t.plantilla?.replace(/^page\./, '')}</b>.</p>
        )
      ) : null}
      {t.admin?.length ? (
        <div className="sh-admin">
          <span className="sh-admin__titulo">Cambios en la tienda que propone (no se hacen sin tu «Aplicar»):</span>
          {t.admin.map((a, i) => (
            <div key={i} className={`sh-admin__fila sh-admin__fila--${a.estado}`}>
              <span>{a.titulo}</span>
              {a.estado === 'pendiente' ? (
                <Boton variante="secundario" tamano="chico" cargando={ocupado === `a${i}`} onClick={() => accion(`a${i}`, `/api/shopify/trabajos/${t.id}/admin/${i}`, 'POST', 'Aplicado')}>Aplicar</Boton>
              ) : (
                <small title={a.resultado || ''}>{a.estado === 'hecho' ? 'Hecho' : `No salió: ${(a.resultado || '').slice(0, 120)}`}</small>
              )}
            </div>
          ))}
        </div>
      ) : null}
      <div className="sh-fila">
        {t.nuevoTema?.vista ? <Boton variante="primario" tamano="chico" icono={Eye} href={t.nuevoTema.vista} target="_blank">Ver la vista previa</Boton> : null}
        {t.nuevoTema?.editor ? <Boton variante="secundario" tamano="chico" icono={ExternalLink} href={t.nuevoTema.editor} target="_blank">Abrir en el editor de Shopify</Boton> : null}
        {t.nuevoTema?.id && t.estado === 'lista' ? (
          <Boton variante="secundario" tamano="chico" icono={Rocket} cargando={ocupado === 'pub'} onClick={() => window.confirm('¿Publicar este tema? Pasa a ser el que ven tus clientes (el anterior queda guardado en tu biblioteca de temas).') && accion('pub', `/api/shopify/trabajos/${t.id}/publicar`, 'POST', 'Publicado')}>
            Publicar
          </Boton>
        ) : null}
        {t.nuevoTema?.id && t.estado === 'lista' ? <Boton variante="fantasma" tamano="chico" cargando={ocupado === 'des'} onClick={() => accion('des', `/api/shopify/trabajos/${t.id}/descartar`, 'POST', 'Tema borrado de la tienda')}>Descartar el tema</Boton> : null}
        {!ocupadoT ? <Boton variante="fantasma" tamano="chico" icono={Trash2} onClick={() => accion('bor', `/api/shopify/trabajos/${t.id}`, 'DELETE')}>Quitar de la lista</Boton> : null}
      </div>
    </article>
  );
}

export default function Shopify() {
  const { aviso } = useAvisos();
  const { datos: dt, recargar: recargarTiendas } = useDatos('shopify:tiendas', () => pedirNuevo('/api/shopify/tiendas'));
  const { datos: dj, recargar } = useDatos('shopify:trabajos', () => pedirNuevo('/api/shopify/trabajos'), { cadaMs: 3000 });
  const tiendas = dt?.tiendas || [];
  const [tiendaId, setTiendaId] = useState('');
  const [conectando, setConectando] = useState(false);
  const [temas, setTemas] = useState(null);
  const [temaId, setTemaId] = useState('');
  const [pedido, setPedido] = useState('');
  const [motor, setMotor] = useState('claude');
  const [enviando, setEnviando] = useState(false);
  const tienda = tiendas.find((t) => t.id === tiendaId);
  useEffect(() => {
    if (!tiendaId && tiendas.length) setTiendaId(tiendas[0].id);
  }, [tiendas, tiendaId]);
  useEffect(() => {
    if (!tiendaId) return undefined;
    let vivo = true;
    setTemas(null);
    setTemaId('');
    pedirNuevo(`/api/shopify/tiendas/${tiendaId}/temas`)
      .then((r) => vivo && setTemas(r.temas))
      .catch((e) => vivo && setTemas({ error: e.message }));
    return () => {
      vivo = false;
    };
  }, [tiendaId]);
  const quitar = async (id) => {
    if (!window.confirm('¿Desconectar esta tienda de la app? (En Shopify no cambia nada.)')) return;
    try {
      await pedirNuevo(`/api/shopify/tiendas/${id}`, { metodo: 'DELETE' });
      if (id === tiendaId) setTiendaId('');
      await recargarTiendas();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No se pudo', texto: e.message });
    }
  };
  const enviar = async () => {
    setEnviando(true);
    try {
      await pedirNuevo('/api/shopify/trabajos', { metodo: 'POST', cuerpo: { tiendaId, temaId: temaId || null, pedido, motor } });
      setPedido('');
      await recargar();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude empezar', texto: e.message });
    } finally {
      setEnviando(false);
    }
  };
  const trabajos = (dj?.trabajos || []).filter((t) => !tiendaId || t.tiendaId === tiendaId);
  const listaTemas = Array.isArray(temas) ? temas : [];
  return (
    <div className="pagina sh pila" style={{ '--hueco': 'var(--e-5)' }}>
      <CabeceraPagina sobretitulo="Tu contenido" titulo="Shopify" descripcion="Conecta tus tiendas (las que quieras) y pídele a la IA cambios en el código de cualquiera: la app los deja en un tema nuevo sin publicar para que los revises antes. También puedes pedírselo a la coordinadora en el chat." />
      <section className="sh-tiendas">
        {tiendas.map((t) => (
          <div key={t.id} className={`sh-tienda${t.id === tiendaId ? ' sh-tienda--activa' : ''}`}>
            <button type="button" className="sh-tienda__elegir" onClick={() => setTiendaId(t.id)} aria-pressed={t.id === tiendaId}>
              <ShoppingBag size={18} aria-hidden="true" />
              <span>
                <strong>{t.nombre}</strong>
                <small>{t.dominio}</small>
              </span>
              <span className={`sh-acceso sh-acceso--${t.tipo}`}>{t.tipo === 'completo' ? 'Acceso completo' : 'Solo temas'}</span>
            </button>
            <button type="button" className="sh-tienda__quitar" onClick={() => quitar(t.id)} aria-label={`Desconectar ${t.nombre}`} title="Desconectar">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <Conectar abierto={conectando || !tiendas.length} setAbierto={setConectando} alConectar={async (id) => { await recargarTiendas(); setTiendaId(id); }} />
      </section>
      {tienda ? (
        <section className="sh-pedido">
          <h3><Wand2 size={16} aria-hidden="true" /> Pídele a la IA en «{tienda.nombre}»</h3>
          <div className="sh-pedido__opciones">
            <Selector
              etiqueta="Tema"
              value={temaId}
              onChange={(e) => setTemaId(e.target.value)}
              disabled={!listaTemas.length}
              opciones={[{ valor: '', etiqueta: temas === null ? 'Cargando los temas…' : temas?.error ? 'No pude ver los temas' : 'El publicado (en vivo)' }, ...listaTemas.map((x) => ({ valor: x.id, etiqueta: `${x.nombre}${x.rol === 'live' || x.rol === 'main' ? ' (publicado)' : ''}` }))]}
            />
            <div className="sh-grupo">
              <span className="sh-grupo__etiqueta">Lo hace</span>
              <div className="sh-segmento" role="group" aria-label="Qué IA lo hace">
                <button type="button" className={motor === 'claude' ? 'activo' : ''} aria-pressed={motor === 'claude'} onClick={() => setMotor('claude')}>Claude Code</button>
                <button type="button" className={motor === 'codex' ? 'activo' : ''} aria-pressed={motor === 'codex'} onClick={() => setMotor('codex')}>Codex</button>
              </div>
            </div>
          </div>
          {temas?.error ? <p className="sh-error"><CircleAlert size={14} aria-hidden="true" /> {temas.error}</p> : null}
          <AreaTexto etiqueta="¿Qué quieres cambiar?" filas={3} placeholder="Ej.: el botón de comprar en verde y que diga «Pídelo ya»; agrega preguntas frecuentes al producto; quita el banner de arriba en celular…" value={pedido} onChange={(e) => setPedido(e.target.value)} maxLength={4000} />
          <div className="sh-fila">
            <Boton variante="primario" icono={Send} cargando={enviando} disabled={pedido.trim().length < 4} onClick={enviar}>Pedírselo</Boton>
            <span className="sh-ayuda">Trabaja en una copia: tu tienda no cambia hasta que publiques el tema nuevo.</span>
          </div>
        </section>
      ) : null}
      {tiendas.length ? (
        trabajos.length ? (
          <div className="sh-lista">{trabajos.map((t) => <Trabajo key={t.id} t={t} recargar={recargar} />)}</div>
        ) : (
          <EstadoVacio icono={Wand2} titulo="Todavía no le pediste nada en esta tienda" descripcion="Escribe arriba lo que quieres cambiar. Para subir una landing, ve a Crear › Landings › «Subir a Shopify»." />
        )
      ) : null}
    </div>
  );
}

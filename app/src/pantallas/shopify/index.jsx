// #/shopify — TUS TIENDAS DE SHOPIFY (2026-11-20r): conectas una o varias, eliges en cuál trabajar y le pides a la IA
// (Claude Code o Codex) cambios en el CÓDIGO del tema. La app lo sube como tema nuevo SIN PUBLICAR, con vista previa, y
// tú lo publicas. Con acceso completo, la IA también propone cambios en páginas, productos… que apruebas uno por uno.
// (2026-11-24) Varias CUENTAS de Shopify y tiendas por PAÍS: eliges la cuenta y el país y ves solo esas tiendas; le pides
// lo mismo a varias tiendas a la vez (con Claude Code o con ChatGPT/Codex), y COPIAS de una tienda a otras (el tema, partes
// del tema o un producto): todo queda primero para revisar (tema sin publicar o producto en borrador) y publicas en cada una.
// Las landings se suben desde Crear › Landings. Servidor: /api/shopify (lib/shopify/).
import { useEffect, useState } from 'react';
import { CircleAlert, CircleCheck, Copy, ExternalLink, Eye, KeyRound, LoaderCircle, Pencil, Plus, Rocket, Send, ShoppingBag, Store, Trash2, Wand2 } from 'lucide-react';
import { AreaTexto, Boton, CabeceraPagina, CampoTexto, EstadoVacio, Selector, useAvisos } from '../../componentes/index.js';
import { pedirNuevo, useDatos } from '../../datos/api.js';
import { fechaRelativa } from '../../datos/formato.js';
import { PAISES, bandera } from '../../datos/paises.js';
import './shopify.css';

const OPCIONES_PAIS = [{ valor: '', etiqueta: 'Sin país' }, ...Object.entries(PAISES).map(([k, v]) => ({ valor: k, etiqueta: `${bandera(k)} ${v}` }))];

const ESTADOS = { trabajando: 'Trabajando…', 'vista-previa': 'Vista previa lista', lista: 'Lista para revisar', publicado: 'Publicado', descartado: 'Descartado', error: 'No salió' };

function Conectar({ alConectar, abierto, setAbierto, cuentas = [] }) {
  const { aviso } = useAvisos();
  const [forma, setForma] = useState('dev');
  const [dominio, setDominio] = useState('');
  const [token, setToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [secreto, setSecreto] = useState('');
  const [nombre, setNombre] = useState('');
  const [cuenta, setCuenta] = useState('');
  const [pais, setPais] = useState('');
  const [ocupado, setOcupado] = useState(false);
  if (!abierto) return <Boton variante="secundario" icono={Plus} onClick={() => setAbierto(true)}>Conectar una tienda</Boton>;
  const listo = dominio.trim() && (forma === 'dev' ? clientId.trim() && secreto.trim() : token.trim());
  const conectar = async () => {
    setOcupado(true);
    try {
      const extra = { nombre, cuenta: cuenta.trim() || undefined, pais: pais || undefined };
      const cuerpo = forma === 'dev' ? { dominio, clientId, clientSecret: secreto, ...extra } : { dominio, token, ...extra };
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
        <CampoTexto etiqueta="Cuenta de Shopify" opcional placeholder={cuentas[0] || 'Mi cuenta'} list="sh-cuentas" value={cuenta} onChange={(e) => setCuenta(e.target.value)} maxLength={60} ayuda="Si tienes varias cuentas (organizaciones), ponle el nombre de la cuenta de esta tienda." />
        <datalist id="sh-cuentas">{cuentas.map((c) => <option key={c} value={c} />)}</datalist>
        <Selector etiqueta="País" opcional value={pais} onChange={(e) => setPais(e.target.value)} opciones={[{ valor: '', etiqueta: 'Que lo lea de la tienda' }, ...OPCIONES_PAIS.slice(1)]} />
      </div>
      <p className="sh-ayuda">Las claves se guardan solo en tu computador (no se suben a GitHub ni van en los paquetes) y nunca se muestran.</p>
      <div className="sh-fila">
        <Boton variante="primario" icono={Store} cargando={ocupado} disabled={!listo} onClick={conectar}>Probar y conectar</Boton>
        <Boton variante="fantasma" onClick={() => setAbierto(false)}>Cancelar</Boton>
      </div>
    </section>
  );
}

/** (2026-11-24) Cambiar el nombre, la cuenta o el país de una tienda. */
function EditarTienda({ t, cuentas, alCerrar }) {
  const { aviso } = useAvisos();
  const [nombre, setNombre] = useState(t.nombre);
  const [cuenta, setCuenta] = useState(t.cuenta || '');
  const [pais, setPais] = useState(t.pais || '');
  const [ocupado, setOcupado] = useState(false);
  const guardar = async () => {
    setOcupado(true);
    try {
      await pedirNuevo(`/api/shopify/tiendas/${t.id}`, { metodo: 'PUT', cuerpo: { nombre, cuenta, pais } });
      alCerrar(true);
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No se guardó', texto: e.message });
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div className="sh-editar">
      <CampoTexto etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} />
      <CampoTexto etiqueta="Cuenta de Shopify" list="sh-cuentas-editar" value={cuenta} onChange={(e) => setCuenta(e.target.value)} maxLength={60} />
      <datalist id="sh-cuentas-editar">{cuentas.map((c) => <option key={c} value={c} />)}</datalist>
      <Selector etiqueta="País" value={pais} onChange={(e) => setPais(e.target.value)} opciones={OPCIONES_PAIS} />
      <div className="sh-fila">
        <Boton variante="primario" tamano="chico" cargando={ocupado} onClick={guardar}>Guardar</Boton>
        <Boton variante="fantasma" tamano="chico" onClick={() => alCerrar(false)}>Cancelar</Boton>
      </div>
    </div>
  );
}

/** (2026-11-24) Copiar de la tienda elegida a otras: el tema, partes del tema o un producto. */
function Copiar({ origen, tiendas, temaId, recargar }) {
  const { aviso } = useAvisos();
  const [que, setQue] = useState('partes');
  const [destinos, setDestinos] = useState([]);
  const [partes, setPartes] = useState(null);
  const [elegidas, setElegidas] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [producto, setProducto] = useState('');
  const [ocupado, setOcupado] = useState('');
  const otras = tiendas.filter((x) => x.id !== origen.id);
  useEffect(() => {
    setPartes(null);
    setElegidas([]);
    setDestinos([]);
  }, [origen.id]);
  const verPartes = async () => {
    setOcupado('partes');
    try {
      const r = await pedirNuevo(`/api/shopify/tiendas/${origen.id}/partes${temaId ? `?tema=${encodeURIComponent(temaId)}` : ''}`);
      setPartes(r.archivos || []);
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude ver las partes del tema', texto: e.message });
    } finally {
      setOcupado('');
    }
  };
  const copiar = async () => {
    setOcupado('copiar');
    try {
      await pedirNuevo('/api/shopify/copias', { metodo: 'POST', cuerpo: { origenId: origen.id, destinos, que, temaId: temaId || null, archivos: elegidas, producto: producto.trim() } });
      aviso({ tipo: 'exito', titulo: 'Copiando', texto: que === 'producto' ? 'Quedará en borrador en cada tienda: lo revisas y lo publicas.' : 'En cada tienda quedará un tema nuevo sin publicar con su vista previa.' });
      setElegidas([]);
      await recargar();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude copiar', texto: e.message });
    } finally {
      setOcupado('');
    }
  };
  const alternar = (lista, set, v) => set(lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);
  const visibles = (partes || []).filter((f) => !filtro.trim() || f.toLowerCase().includes(filtro.trim().toLowerCase())).filter((f) => /^(sections|templates|blocks|snippets)\//.test(f) || filtro.trim());
  const listo = destinos.length && (que === 'tema' || (que === 'partes' && elegidas.length) || (que === 'producto' && /^[a-z0-9][a-z0-9-]*$/.test(producto.trim())));
  if (!otras.length) return null;
  return (
    <section className="sh-pedido sh-copiar">
      <h3><Copy size={16} aria-hidden="true" /> Copiar de «{origen.nombre}» a otras tiendas</h3>
      <div className="sh-segmento" role="group" aria-label="Qué copiar">
        {[['partes', 'Partes del tema'], ['tema', 'Tema completo'], ['producto', 'Un producto']].map(([k, t]) => (
          <button key={k} type="button" className={que === k ? 'activo' : ''} aria-pressed={que === k} onClick={() => setQue(k)}>{t}</button>
        ))}
      </div>
      {que === 'partes' ? (
        partes === null ? (
          <div className="sh-fila">
            <Boton variante="secundario" tamano="chico" cargando={ocupado === 'partes'} onClick={verPartes}>Ver las secciones y plantillas</Boton>
            <span className="sh-ayuda">Baja el tema {temaId ? 'elegido' : 'publicado'} para que elijas qué copiar (tarda un poco la primera vez).</span>
          </div>
        ) : (
          <div className="sh-partes">
            <CampoTexto placeholder="Buscar (ej.: oferta, product, header…)" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Buscar partes del tema" />
            <ul>
              {visibles.slice(0, 200).map((f) => (
                <li key={f}>
                  <label><input type="checkbox" checked={elegidas.includes(f)} onChange={() => alternar(elegidas, setElegidas, f)} /> <code>{f}</code></label>
                </li>
              ))}
            </ul>
            <span className="sh-ayuda">{elegidas.length} elegida(s). Lo que necesitan para funcionar (sus secciones, snippets e imágenes) va solo; lo que la otra tienda ya tiene no se pisa.</span>
          </div>
        )
      ) : que === 'producto' ? (
        <CampoTexto etiqueta="Dirección del producto" placeholder="gotas-para-dormir" value={producto} onChange={(e) => setProducto(e.target.value)} ayuda="La parte final de su enlace (/products/…). Las dos tiendas necesitan acceso completo. Queda en BORRADOR para que revises precios y moneda." />
      ) : (
        <p className="sh-ayuda">El tema {temaId ? 'elegido' : 'publicado'} completo, como tema nuevo sin publicar en cada tienda. Las imágenes que subiste en el editor de temas de esta tienda no pasan: revísalas en la vista previa.</p>
      )}
      <div className="sh-destinos">
        <span className="sh-grupo__etiqueta">A dónde</span>
        <div className="sh-fila">
          {otras.map((x) => (
            <label key={x.id} className={`sh-destino${destinos.includes(x.id) ? ' sh-destino--si' : ''}`}>
              <input type="checkbox" checked={destinos.includes(x.id)} onChange={() => alternar(destinos, setDestinos, x.id)} /> {bandera(x.pais)} {x.nombre}
              <small>{x.cuenta}</small>
            </label>
          ))}
          <Boton variante="fantasma" tamano="chico" onClick={() => setDestinos(destinos.length === otras.length ? [] : otras.map((x) => x.id))}>{destinos.length === otras.length ? 'Ninguna' : 'Todas'}</Boton>
        </div>
      </div>
      <div className="sh-fila">
        <Boton variante="primario" icono={Copy} cargando={ocupado === 'copiar'} disabled={!listo} onClick={copiar}>Copiar{destinos.length > 1 ? ` a ${destinos.length} tiendas` : ''}</Boton>
        <span className="sh-ayuda">Nada se publica solo: en cada tienda lo revisas y lo publicas.</span>
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
      {t.tipo === 'copia' && t.destinos?.length ? (
        <div className="sh-copia">
          {t.archivos?.length ? (
            <details className="sh-archivos">
              <summary>{t.archivos.length} archivo(s) copiados (con lo que necesitan)</summary>
              <ul>{t.archivos.map((f) => <li key={f}><code>{f}</code></li>)}</ul>
            </details>
          ) : null}
          {t.destinos.map((d) => (
            <div key={d.tiendaId} className={`sh-copia__destino sh-copia__destino--${d.estado}`}>
              <span className="sh-copia__nombre">{bandera(d.pais)} <strong>{d.nombre}</strong> <small>{{ pendiente: 'En espera', trabajando: 'Copiando…', lista: 'Para revisar', publicado: 'Publicado', descartado: 'Descartado', error: 'No salió' }[d.estado] || d.estado}</small></span>
              {d.error ? <small className="sh-error">{d.error}</small> : null}
              {d.aviso ? <small className="sh-aviso"><CircleAlert size={12} aria-hidden="true" /> {d.aviso}</small> : null}
              {d.sinPisar?.length ? <small className="sh-ayuda">Usa sus propias versiones de: {d.sinPisar.join(', ')}</small> : null}
              <span className="sh-fila">
                {d.nuevoTema?.vista ? <Boton variante="secundario" tamano="chico" icono={Eye} href={d.nuevoTema.vista} target="_blank">Vista previa</Boton> : null}
                {d.nuevoTema?.editor ? <Boton variante="fantasma" tamano="chico" icono={ExternalLink} href={d.nuevoTema.editor} target="_blank">Editor</Boton> : null}
                {d.productoNuevo?.admin ? <Boton variante="secundario" tamano="chico" icono={ExternalLink} href={d.productoNuevo.admin} target="_blank">Verlo en Shopify</Boton> : null}
                {d.estado === 'lista' ? (
                  <>
                    <Boton variante="primario" tamano="chico" icono={Rocket} cargando={ocupado === `p-${d.tiendaId}`} onClick={() => window.confirm(d.productoNuevo ? `¿Publicar el producto en «${d.nombre}»? Queda activo y a la venta.` : `¿Publicar este tema en «${d.nombre}»? Pasa a ser el que ven tus clientes (el anterior queda guardado).`) && accion(`p-${d.tiendaId}`, `/api/shopify/trabajos/${t.id}/destinos/${d.tiendaId}/publicar`, 'POST', 'Publicado')}>Publicar</Boton>
                    <Boton variante="fantasma" tamano="chico" cargando={ocupado === `d-${d.tiendaId}`} onClick={() => accion(`d-${d.tiendaId}`, `/api/shopify/trabajos/${t.id}/destinos/${d.tiendaId}/descartar`, 'POST', 'Descartado')}>Descartar</Boton>
                  </>
                ) : null}
              </span>
            </div>
          ))}
        </div>
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
  const [cuentaVer, setCuentaVer] = useState('');
  const [paisVer, setPaisVer] = useState('');
  const [editando, setEditando] = useState(null);
  const [tambien, setTambien] = useState([]); // el mismo pedido también en estas tiendas
  const cuentas = [...new Set(tiendas.map((t) => t.cuenta || 'Mi cuenta'))];
  const deLaCuenta = tiendas.filter((t) => !cuentaVer || (t.cuenta || 'Mi cuenta') === cuentaVer);
  const paises = [...new Set(deLaCuenta.map((t) => t.pais || ''))];
  const visibles = deLaCuenta.filter((t) => !paisVer || (t.pais || '') === paisVer);
  const tienda = tiendas.find((t) => t.id === tiendaId);
  useEffect(() => {
    if ((!tiendaId || !visibles.some((t) => t.id === tiendaId)) && visibles.length) setTiendaId(visibles[0].id);
  }, [tiendas, tiendaId, cuentaVer, paisVer]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setTambien([]), [tiendaId]);
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
      await pedirNuevo('/api/shopify/trabajos', { metodo: 'POST', cuerpo: tambien.length ? { tiendaIds: [tiendaId, ...tambien], pedido, motor } : { tiendaId, temaId: temaId || null, pedido, motor } });
      setPedido('');
      await recargar();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude empezar', texto: e.message });
    } finally {
      setEnviando(false);
    }
  };
  const trabajos = (dj?.trabajos || []).filter((t) => !tiendaId || t.tiendaId === tiendaId || (t.destinos || []).some((d) => d.tiendaId === tiendaId));
  const listaTemas = Array.isArray(temas) ? temas : [];
  return (
    <div className="pagina sh pila" style={{ '--hueco': 'var(--e-5)' }}>
      <CabeceraPagina sobretitulo="Tu contenido" titulo="Shopify" descripcion="Conecta tus tiendas de una o varias cuentas, elige la tienda por país y pídele a la IA (Claude Code o ChatGPT) cambios en una o en varias a la vez. Copia el tema, partes del tema o un producto de una tienda a las demás. Todo queda primero para revisar: nada se publica solo." />
      {tiendas.length > 1 ? (
        <section className="sh-filtros">
          {cuentas.length > 1 ? <Selector etiqueta="Cuenta" value={cuentaVer} onChange={(e) => { setCuentaVer(e.target.value); setPaisVer(''); }} opciones={[{ valor: '', etiqueta: `Todas (${cuentas.length})` }, ...cuentas.map((c) => ({ valor: c, etiqueta: c }))]} /> : null}
          {paises.length > 1 ? (
            <div className="sh-grupo">
              <span className="sh-grupo__etiqueta">País</span>
              <div className="sh-segmento" role="group" aria-label="País">
                <button type="button" className={!paisVer ? 'activo' : ''} aria-pressed={!paisVer} onClick={() => setPaisVer('')}>Todos</button>
                {paises.map((p) => <button key={p || 'x'} type="button" className={paisVer === p ? 'activo' : ''} aria-pressed={paisVer === p} onClick={() => setPaisVer(p)}>{bandera(p)} {PAISES[p] || (p ? p : 'Sin país')}</button>)}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
      <section className="sh-tiendas">
        {visibles.map((t) => (
          <div key={t.id} className={`sh-tienda${t.id === tiendaId ? ' sh-tienda--activa' : ''}`}>
            <button type="button" className="sh-tienda__elegir" onClick={() => setTiendaId(t.id)} aria-pressed={t.id === tiendaId}>
              <span className="sh-tienda__bandera" aria-hidden="true">{t.pais ? bandera(t.pais) : <ShoppingBag size={18} />}</span>
              <span className="sh-tienda__textos">
                <strong>{t.nombre}</strong>
                <small>{t.dominio} · {t.cuenta || 'Mi cuenta'}{t.pais ? ` · ${PAISES[t.pais] || t.pais}` : ''}{t.moneda ? ` · ${t.moneda}` : ''}</small>
              </span>
              <span className={`sh-acceso sh-acceso--${t.tipo}`}>{t.tipo === 'completo' ? 'Acceso completo' : 'Solo temas'}</span>
            </button>
            <button type="button" className="sh-tienda__quitar sh-tienda__editar" onClick={() => setEditando(editando === t.id ? null : t.id)} aria-label={`Cambiar cuenta o país de ${t.nombre}`} title="Cuenta y país">
              <Pencil size={14} />
            </button>
            <button type="button" className="sh-tienda__quitar" onClick={() => quitar(t.id)} aria-label={`Desconectar ${t.nombre}`} title="Desconectar">
              <Trash2 size={14} />
            </button>
            {editando === t.id ? <EditarTienda t={t} cuentas={cuentas} alCerrar={async (ok) => { setEditando(null); if (ok) await recargarTiendas(); }} /> : null}
          </div>
        ))}
        <Conectar cuentas={cuentas} abierto={conectando || !tiendas.length} setAbierto={setConectando} alConectar={async (id) => { await recargarTiendas(); setTiendaId(id); }} />
      </section>
      {tienda ? (
        <section className="sh-pedido">
          <h3><Wand2 size={16} aria-hidden="true" /> Pídele a la IA en {bandera(tienda.pais)} «{tienda.nombre}»</h3>
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
                <button type="button" className={motor === 'codex' ? 'activo' : ''} aria-pressed={motor === 'codex'} onClick={() => setMotor('codex')}>ChatGPT (Codex)</button>
              </div>
            </div>
          </div>
          {temas?.error ? <p className="sh-error"><CircleAlert size={14} aria-hidden="true" /> {temas.error}</p> : null}
          <AreaTexto etiqueta="¿Qué quieres cambiar?" filas={3} placeholder="Ej.: el botón de comprar en verde y que diga «Pídelo ya»; agrega preguntas frecuentes al producto; quita el banner de arriba en celular…" value={pedido} onChange={(e) => setPedido(e.target.value)} maxLength={4000} />
          {tiendas.length > 1 ? (
            <div className="sh-destinos">
              <span className="sh-grupo__etiqueta">También en</span>
              <div className="sh-fila">
                {tiendas.filter((x) => x.id !== tiendaId).map((x) => (
                  <label key={x.id} className={`sh-destino${tambien.includes(x.id) ? ' sh-destino--si' : ''}`}>
                    <input type="checkbox" checked={tambien.includes(x.id)} onChange={() => setTambien(tambien.includes(x.id) ? tambien.filter((y) => y !== x.id) : [...tambien, x.id])} /> {bandera(x.pais)} {x.nombre}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <div className="sh-fila">
            <Boton variante="primario" icono={Send} cargando={enviando} disabled={pedido.trim().length < 4} onClick={enviar}>{tambien.length ? `Pedírselo en ${tambien.length + 1} tiendas` : 'Pedírselo'}</Boton>
            <span className="sh-ayuda">Trabaja en una copia: tu tienda no cambia hasta que publiques el tema nuevo.</span>
          </div>
        </section>
      ) : null}
      {tienda && tiendas.length > 1 ? <Copiar origen={tienda} tiendas={tiendas} temaId={temaId} recargar={recargar} /> : null}
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

// Shopify es el centro de conexiones. Los negocios son carpetas persistentes; cada tienda conserva su sesión y país.
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy, ExternalLink, Folder, FolderOpen, KeyRound, Pencil, Plus, ShoppingBag, Store, Trash2 } from 'lucide-react';
import { AreaTexto, Boton, CabeceraPagina, CampoTexto, EstadoVacio, Selector, useAvisos } from '../../componentes/index.js';
import { pedirNuevo, useDatos } from '../../datos/api.js';
import { enlace, rutas, ir } from '../../datos/rutas.js';
import { PAISES, bandera } from '../../datos/paises.js';
import './shopify.css';

const OPCIONES_PAIS = [{ valor: '', etiqueta: 'Sin país' }, ...Object.entries(PAISES).map(([k, v]) => ({ valor: k, etiqueta: `${bandera(k)} ${v}` }))];

const ESTADOS = { trabajando: 'Trabajando…', 'vista-previa': 'Vista previa lista', lista: 'Lista para revisar', publicado: 'Publicado', descartado: 'Descartado', error: 'No salió' };

function Conectar({ alConectar, abierto, setAbierto, cuentas = [], carpetaId }) {
  const { aviso } = useAvisos();
  const [forma, setForma] = useState('cuenta'); // (2026-11-24) por defecto: con mi cuenta de Shopify (sin claves)
  const [conexion, setConexion] = useState(null); // { url, codigo } mientras esperas aprobar en Shopify
  const [dominio, setDominio] = useState('');
  const [token, setToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [secreto, setSecreto] = useState('');
  const [nombre, setNombre] = useState('');
  const [cuenta, setCuenta] = useState('');
  const [pais, setPais] = useState('');
  const [ocupado, setOcupado] = useState(false);
  if (!abierto) return <Boton variante="secundario" icono={Plus} onClick={() => setAbierto(true)}>Conectar una tienda</Boton>;
  const listo = dominio.trim() && (forma === 'cuenta' || (forma === 'dev' ? clientId.trim() && secreto.trim() : token.trim()));
  // con mi cuenta: la app pide a Shopify el enlace para entrar, lo abre y espera a que apruebes
  const conCuenta = async () => {
    setOcupado(true);
    try {
      const { id } = await pedirNuevo('/api/shopify/conexiones', { metodo: 'POST', cuerpo: { dominio, nombre, carpetaId, cuenta: cuenta.trim() || undefined, pais: pais || undefined } });
      let abierta = false;
      for (let i = 0; i < 400; i++) {
        const c = await pedirNuevo(`/api/shopify/conexiones/${id}`);
        if (c.url && !abierta) {
          // (2026-11-24) no se abre solo: lo copias y lo pegas en el perfil de Chrome donde tienes la sesión de ESA tienda
          abierta = true;
          setConexion({ url: c.url, codigo: c.codigo, copiado: false });
          try {
            await navigator.clipboard.writeText(c.url);
            setConexion({ url: c.url, codigo: c.codigo, copiado: true });
          } catch {
            /* el botón «Copiar enlace» lo copia */
          }
        }
        if (c.estado === 'lista') {
          aviso({ tipo: 'exito', titulo: `${c.tienda.nombre} conectada`, texto: 'Con tu cuenta de Shopify (temas).' });
          setConexion(null);
          setDominio('');
          setNombre('');
          setAbierto(false);
          alConectar(c.tienda.id);
          return;
        }
        if (c.estado === 'error') throw new Error(c.error);
        await new Promise((ok) => setTimeout(ok, 1500));
      }
      throw new Error('No llegó la aprobación de Shopify. Vuelve a intentar.');
    } catch (e) {
      setConexion(null);
      aviso({ tipo: 'error', titulo: 'No se conectó', texto: e.message });
    } finally {
      setOcupado(false);
    }
  };
  const conectar = async () => {
    setOcupado(true);
    try {
      const extra = { nombre, carpetaId, cuenta: cuenta.trim() || undefined, pais: pais || undefined };
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
        <button type="button" className={forma === 'cuenta' ? 'activo' : ''} aria-pressed={forma === 'cuenta'} onClick={() => setForma('cuenta')}>Con mi cuenta de Shopify</button>
        <button type="button" className={forma === 'dev' ? 'activo' : ''} aria-pressed={forma === 'dev'} onClick={() => setForma('dev')}>Acceso completo (Client ID)</button>
        <button type="button" className={forma === 'token' ? 'activo' : ''} aria-pressed={forma === 'token'} onClick={() => setForma('token')}>Token o Theme Access</button>
      </div>
      {forma === 'cuenta' ? (
        <p className="sh-ayuda">Pon la dirección de la tienda y toca el botón: te da un enlace que pegas en el perfil de Chrome donde tienes esa tienda abierta, entras y apruebas. Sin claves, y cada tienda con su propia sesión (pueden ser de cuentas distintas). Sirve para los temas (cambios con IA, landings, copiar temas y secciones). Para crear páginas o copiar productos, usa «Acceso completo».</p>
      ) : forma === 'dev' ? (
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
        {forma === 'cuenta' ? null : forma === 'dev' ? (
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
      {conexion ? (
        <div className="sh-enlace">
          <p className="sh-ok">
            {conexion.copiado ? 'Enlace copiado.' : 'Copia este enlace.'} Pégalo en el <b>perfil de Chrome donde tienes la sesión de esta tienda</b>, entra y aprueba{conexion.codigo ? <> el código <b>{conexion.codigo}</b></> : null}. Te espero aquí…
          </p>
          <div className="sh-fila">
            <code className="sh-enlace__url">{conexion.url}</code>
            <Boton variante="secundario" tamano="chico" icono={Copy} onClick={async () => { try { await navigator.clipboard.writeText(conexion.url); setConexion({ ...conexion, copiado: true }); } catch { window.prompt('Copia el enlace:', conexion.url); } }}>{conexion.copiado ? 'Copiar otra vez' : 'Copiar enlace'}</Boton>
          </div>
        </div>
      ) : null}
      <p className="sh-ayuda">Las claves se guardan solo en tu computador (no se suben a GitHub ni van en los paquetes) y nunca se muestran.</p>
      <div className="sh-fila">
        <Boton variante="primario" icono={Store} cargando={ocupado} disabled={!listo} onClick={forma === 'cuenta' ? conCuenta : conectar}>{forma === 'cuenta' ? 'Conectar con mi cuenta de Shopify' : 'Probar y conectar'}</Boton>
        <Boton variante="fantasma" disabled={ocupado} onClick={() => setAbierto(false)}>Cancelar</Boton>
      </div>
    </section>
  );
}

/** (2026-11-24) Cambiar el nombre, la cuenta o el país de una tienda. */
function EditarTienda({ t, cuentas, carpetas, alCerrar }) {
  const { aviso } = useAvisos();
  const [nombre, setNombre] = useState(t.nombre);
  const [cuenta, setCuenta] = useState(t.cuenta || '');
  const [pais, setPais] = useState(t.pais || '');
  const [carpetaId, setCarpetaId] = useState(t.carpetaId);
  const [ocupado, setOcupado] = useState(false);
  const guardar = async () => {
    setOcupado(true);
    try {
      await pedirNuevo(`/api/shopify/tiendas/${t.id}`, { metodo: 'PUT', cuerpo: { nombre, cuenta, pais, carpetaId } });
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
      <Selector etiqueta="Carpeta del negocio" value={carpetaId} onChange={(e) => setCarpetaId(e.target.value)} opciones={carpetas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))} />
      <Selector etiqueta="País" value={pais} onChange={(e) => setPais(e.target.value)} opciones={OPCIONES_PAIS} />
      <div className="sh-fila">
        <Boton variante="primario" tamano="chico" cargando={ocupado} onClick={guardar}>Guardar</Boton>
        <Boton variante="fantasma" tamano="chico" onClick={() => alCerrar(false)}>Cancelar</Boton>
      </div>
    </div>
  );
}


export default function Shopify({ params = {} }) {
  const { aviso } = useAvisos();
  const { datos: dt, recargar: recargarTiendas, error: errorTiendas } = useDatos('shopify:tiendas', () => pedirNuevo('/api/shopify/tiendas'));
  const { datos: dc, recargar: recargarCarpetas, error: errorCarpetas } = useDatos('shopify:carpetas', () => pedirNuevo('/api/shopify/carpetas'));
  const tiendas = dt?.tiendas || [];
  const carpetas = dc?.carpetas || [];
  const carpeta = carpetas.find((c) => c.id === params.carpetaId);
  const cuentas = [...new Set(tiendas.map((t) => t.cuenta || 'Mi cuenta'))];
  const [formulario, setFormulario] = useState(false);
  const [nombre, setNombre] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [editando, setEditando] = useState(null);
  const [paisVer, setPaisVer] = useState('');
  useEffect(() => { setFormulario(false); setConectando(false); setEditando(null); setPaisVer(''); }, [params.carpetaId]);
  const deCarpeta = tiendas.filter((t) => t.carpetaId === carpeta?.id);
  const paises = [...new Set(deCarpeta.map((t) => t.pais || ''))];
  const visibles = deCarpeta.filter((t) => !paisVer || (t.pais || 'sin-pais') === paisVer);
  const recargar = () => Promise.all([recargarTiendas(), recargarCarpetas()]);
  const cambiarCarpeta = (id) => { setFormulario(false); setConectando(false); setEditando(null); setPaisVer(''); ir(id ? rutas.shopifyCarpeta(id) : rutas.shopify()); };
  const guardar = async (e) => {
    e.preventDefault();
    setOcupado(true);
    try {
      const c = await pedirNuevo(carpeta ? `/api/shopify/carpetas/${carpeta.id}` : '/api/shopify/carpetas', { metodo: carpeta ? 'PUT' : 'POST', cuerpo: { nombre } });
      await recargar();
      cambiarCarpeta(c.id);
      aviso({ tipo: 'exito', titulo: carpeta ? 'Carpeta actualizada' : 'Carpeta creada' });
    } catch (e) { aviso({ tipo: 'error', titulo: 'No se guardó la carpeta', texto: e.message }); }
    finally { setOcupado(false); }
  };
  const quitarCarpeta = async () => {
    if (!window.confirm(`¿Eliminar la carpeta vacía «${carpeta.nombre}»?`)) return;
    try { await pedirNuevo(`/api/shopify/carpetas/${carpeta.id}`, { metodo: 'DELETE' }); await recargar(); cambiarCarpeta(null); }
    catch (e) { aviso({ tipo: 'error', titulo: 'No se eliminó', texto: e.message }); }
  };
  const desconectar = async (t) => {
    if (!window.confirm(`¿Desconectar «${t.nombre}» de Kads? La tienda en Shopify no cambia.`)) return;
    try { await pedirNuevo(`/api/shopify/tiendas/${t.id}`, { metodo: 'DELETE' }); await recargar(); }
    catch (e) { aviso({ tipo: 'error', titulo: 'No se desconectó', texto: e.message }); }
  };
  if (errorTiendas || errorCarpetas) return <div className="pagina sh"><EstadoVacio icono={Store} titulo="No pude cargar tus tiendas" descripcion={(errorTiendas || errorCarpetas).message} acciones={<Boton onClick={recargar}>Volver a intentar</Boton>} /></div>;
  if (!dt || !dc) return <div className="pagina sh" role="status">Cargando tus conexiones…</div>;
  if (params.carpetaId && !carpeta) return <div className="pagina sh"><EstadoVacio icono={Folder} titulo="No encuentro esta carpeta" descripcion="Puede que se haya eliminado. Tus otras conexiones siguen en Shopify." acciones={<Boton href={enlace.shopify()}>Ver mis carpetas</Boton>} /></div>;
  return (
    <div className="pagina sh sh-integraciones pila" style={{ '--hueco': 'var(--e-5)' }}>
      <CabeceraPagina sobretitulo="CONEXIONES / SHOPIFY" titulo={carpeta ? carpeta.nombre : 'Tus negocios. Tus tiendas.'} descripcion={carpeta ? 'Cada país, su tienda. Conecta y organiza aquí las tiendas de este negocio.' : 'Un lugar para cada negocio. Agrupa sus tiendas por país y mantén todas tus conexiones a mano.'} />
      <div className="sh-carpeta-barra">
        {carpeta ? <Boton variante="fantasma" icono={ArrowLeft} onClick={() => cambiarCarpeta(null)}>Todas las carpetas</Boton> : <span className="sh-conteo">{carpetas.length} {carpetas.length === 1 ? 'carpeta' : 'carpetas'} · {tiendas.length} {tiendas.length === 1 ? 'tienda conectada' : 'tiendas conectadas'}</span>}
        <div className="sh-fila">
          <Boton variante={carpeta ? 'secundario' : 'primario'} icono={carpeta ? Pencil : Plus} onClick={() => { setNombre(carpeta?.nombre || ''); setFormulario(true); }}>{carpeta ? 'Renombrar carpeta' : 'Nueva carpeta'}</Boton>
          {carpeta && !deCarpeta.length ? <Boton variante="fantasma" icono={Trash2} onClick={quitarCarpeta}>Eliminar carpeta</Boton> : null}
        </div>
      </div>
      {formulario ? (
        <form className="sh-carpeta-form" onSubmit={guardar}>
          <CampoTexto etiqueta="Nombre de la carpeta" placeholder="Ej.: District Shop" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} autoFocus required />
          <div className="sh-fila"><Boton type="submit" variante="primario" cargando={ocupado} disabled={!nombre.trim()}>Guardar carpeta</Boton><Boton variante="fantasma" disabled={ocupado} onClick={() => setFormulario(false)}>Cancelar</Boton></div>
        </form>
      ) : null}
      {!carpeta ? (
        <>
          <section className="sh-negocios" aria-label="Carpetas de negocios">
            {carpetas.map((c) => {
              const ts = tiendas.filter((t) => t.carpetaId === c.id);
              const ps = [...new Set(ts.map((t) => t.pais).filter(Boolean))];
              return <button type="button" className="sh-negocio" key={c.id} onClick={() => cambiarCarpeta(c.id)}>
                <span className="sh-negocio__cabeza"><FolderOpen size={36} strokeWidth={1.4} aria-hidden="true" /><span>{ts.length} {ts.length === 1 ? 'tienda' : 'tiendas'}</span></span>
                <strong>{c.nombre}</strong>
                <span className="sh-negocio__paises">{ps.length ? ps.slice(0, 5).map((p) => <span key={p}>{bandera(p)} {PAISES[p] || p}</span>) : 'Lista para conectar tus tiendas'}{ps.length > 5 ? <span>+{ps.length - 5} países</span> : null}</span>
                <span className="sh-negocio__abrir">Abrir carpeta</span>
              </button>;
            })}
          </section>
          {!carpetas.length && !formulario ? <EstadoVacio icono={FolderOpen} titulo="Tu primer negocio empieza aquí" descripcion="Crea una carpeta, por ejemplo District Shop. Dentro podrás conectar Colombia, Ecuador, Guatemala, Costa Rica, Perú y los países que necesites." acciones={<Boton variante="primario" icono={Plus} onClick={() => setFormulario(true)}>Crear mi primera carpeta</Boton>} /> : null}
        </>
      ) : (
        <>
          <div className="sh-carpeta-resumen"><span className="sh-carpeta-resumen__icono"><FolderOpen size={30} aria-hidden="true" /></span><div><strong>{deCarpeta.length} {deCarpeta.length === 1 ? 'tienda conectada' : 'tiendas conectadas'}</strong><p>Un negocio, todos sus mercados.</p></div><span className="sh-carpeta-resumen__marca"><ShoppingBag size={18} aria-hidden="true" /> Shopify</span></div>
          {paises.length > 1 ? <Selector etiqueta="Filtrar por país" value={paisVer} onChange={(e) => setPaisVer(e.target.value)} opciones={[{ valor: '', etiqueta: 'Todos los países' }, ...paises.map((p) => ({ valor: p || 'sin-pais', etiqueta: `${bandera(p)} ${PAISES[p] || p || 'Sin país'}` }))]} /> : null}
          <section className="sh-conexiones" aria-label={`Tiendas de ${carpeta.nombre}`}>
            {visibles.map((t) => <article className="sh-conexion" key={t.id}>
              <div className="sh-conexion__info"><span className="sh-conexion__pais" aria-hidden="true">{bandera(t.pais)}</span><div><span className="sh-conexion__mercado">{PAISES[t.pais] || t.pais || 'Sin país'}</span><h2>{t.nombre}</h2><p>{t.dominio}</p></div><span className="sh-conexion__estado"><Check size={13} aria-hidden="true" /> Conectada</span></div>
              <div className="sh-conexion__meta"><span>{t.cuenta || 'Mi cuenta'}</span><span>{t.tipo === 'completo' ? 'Acceso completo' : 'Acceso a temas'}</span></div>
              <div className="sh-conexion__acciones"><Boton tamano="chico" variante="secundario" icono={Pencil} onClick={() => setEditando(editando === t.id ? null : t.id)}>Editar conexión</Boton><Boton tamano="chico" variante="fantasma" href={`https://admin.shopify.com/store/${t.dominio.split('.')[0]}`} target="_blank" rel="noopener noreferrer" icono={ExternalLink}>Administrar</Boton><Boton tamano="chico" variante="fantasma" soloIcono icono={Trash2} etiqueta={`Desconectar ${t.nombre}`} onClick={() => desconectar(t)} /></div>
              {editando === t.id ? <EditarTienda key={t.id} t={t} cuentas={cuentas} carpetas={carpetas} alCerrar={async (ok) => { setEditando(null); if (ok) await recargar(); }} /> : null}
            </article>)}
          </section>
          {!deCarpeta.length ? <div className="sh-carpeta-vacia"><Store size={30} aria-hidden="true" /><div><h2>Conecta la primera tienda</h2><p>Elige su país y usa la cuenta de Shopify que corresponda. Puedes conectar tiendas de cuentas diferentes.</p></div></div> : null}
          <Conectar key={carpeta.id} cuentas={cuentas} carpetaId={carpeta.id} abierto={conectando} setAbierto={setConectando} alConectar={async () => { setPaisVer(''); await recargar(); }} />
        </>
      )}
    </div>
  );
}

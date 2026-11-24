import { useEffect, useState } from 'react';
import { ArrowLeft, Check, CircleAlert, Download, ImagePlus, Layers3, LoaderCircle, Palette, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { AreaTexto, Boton, CabeceraPagina, EstadoVacio, Modal, Selector, useAvisos } from '../../componentes/index.js';
import { pedirNuevo, useDatos } from '../../datos/api.js';
import { dinero } from '../../datos/formato.js';
import { useBiblioteca } from '../biblioteca/datos.js';
import { enlace, ir, rutas } from '../../datos/rutas.js';
import './embudo.css';
const NOMBRES = { avatar: 'Avatar nuevo · Biblioteca', hero: 'Hero', dolor: 'Punto de dolor', beneficios: 'Beneficios', ingredientes: 'Ingredientes', uso: 'Modo de uso' };
const API = '/api/embudos';

function Seccion({ s, bloqueada, formato, alGuardar, alPresupuestar, alTitulos, titulos }) {
  const [correccion, setCorreccion] = useState(s.correccion);
  const [titulo, setTitulo] = useState('');
  const [subtitulo, setSubtitulo] = useState('');
  const enCurso = ['en-cola','generando'].includes(s.progreso?.estado);
  const preparando = titulos?.seccion===s.id && titulos.estado==='generando';
  useEffect(() => setCorreccion(s.correccion), [s.correccion]);
  const elegida = s.opciones.find((o) => o.id === s.elegida);
  const completa = Boolean(elegida?.titulo && elegida?.subtitulo);
  const [ancho, alto] = formato.split(':');
  return (
    <article className="em-seccion" id={`seccion-${s.id}`}>
      <header className="em-seccion__cabecera"><div><span>SECCIÓN DEL EMBUDO</span><h2>{s.nombre}</h2></div>{enCurso ? <span className="em-estado" role="status"><LoaderCircle size={16} className="girando" />{s.progreso.estado==='generando' ? 'Generando imagen…' : 'En cola…'}</span> : s.progreso?.estado==='error' || s.progreso?.estado==='interrumpido' ? <span className="em-estado em-estado--aviso">Pendiente de retomar</span> : s.imagen ? <span className={`em-estado${s.imagen.desactualizada ? ' em-estado--aviso' : ''}`}>{s.imagen.desactualizada ? 'Texto o diseño actualizado' : <><Check size={14} /> Imagen generada</>}</span> : <span className="em-estado em-estado--pendiente">Por generar</span>}</header>
      <div className="em-seccion__cuerpo">
        <div className="em-seccion__copy">
          <p className="em-objetivo">{s.objetivo}</p>
          {s.opciones.length ? (
            <fieldset className="em-opciones" disabled={bloqueada}>
              <legend>{s.opciones.length > 1 ? `Elige título y subtítulo · ${s.opciones.length} opciones` : 'Título y subtítulo de tu investigación'}</legend>
              <div className="em-opciones__lista">{s.opciones.map((o, i) => (
                <label key={o.id} className={`em-opcion${s.elegida === o.id ? ' em-opcion--elegida' : ''}`}>
                  <input type="radio" name={`copy-${s.id}`} value={o.id} checked={s.elegida === o.id} onChange={() => alGuardar({ seleccion: { [s.id]: o.id } })} />
                  <span><small>{o.etiqueta || `Opción ${i + 1}`}</small><strong>{o.titulo}</strong>{o.subtitulo ? <span>{o.subtitulo}</span> : <span className="em-falta">Falta el subtítulo en la investigación.</span>}</span>
                </label>
              ))}</div>
            </fieldset>
          ) : <div className="em-sin-textos"><CircleAlert size={18} /><div><strong>Esta sección no tiene textos guardados.</strong><p>Completa su título y propuesta de valor en la investigación del producto y actualiza los textos del embudo.</p></div></div>}
          <div className="em-titulos-acciones"><Boton icono={RefreshCw} disabled={bloqueada} onClick={() => alTitulos(s.id)}>{preparando ? 'Preparando títulos…' : 'Regenerar títulos'}</Boton><p className="em-ayuda">Nuevas propuestas desde tu investigación. Tu elección se conserva.</p></div>
          {preparando ? <p className="em-textos-progreso" role="status"><LoaderCircle size={16} className="girando" /> Preparando títulos y subtítulos…</p> : null}
          {titulos?.seccion===s.id && titulos.estado==='error' ? <p role="alert" className="em-falta">{titulos.error}</p> : null}
          <details className="em-manual"><summary>Escribir mi propio título y subtítulo</summary><AreaTexto etiqueta={`Título manual · ${s.nombre}`} value={titulo} onChange={x=>setTitulo(x.target.value)} maxLength={180} filas={2} disabled={bloqueada} /><AreaTexto etiqueta={`Subtítulo manual · ${s.nombre}`} value={subtitulo} onChange={x=>setSubtitulo(x.target.value)} maxLength={500} filas={3} disabled={bloqueada} /><Boton icono={Plus} disabled={bloqueada || !titulo.trim() || !subtitulo.trim()} onClick={()=>alGuardar({manuales:{[s.id]:{titulo,subtitulo}}})}>Guardar y usar mi mensaje</Boton></details>
          <Selector etiqueta={`Recurso visual · ${s.nombre}`} value={s.visual} disabled={bloqueada} onChange={x=>alGuardar({visuales:{[s.id]:x.target.value}})} opciones={[...(s.id==='hero'?[{valor:'persona',etiqueta:'Avatar del Hero'}]:[]),{valor:'enfoque',etiqueta:'Interpretar visualmente el mensaje'},{valor:'anatomia',etiqueta:'Ilustración anatómica educativa'},{valor:'producto',etiqueta:'Producto y componentes'},{valor:'contexto',etiqueta:'Objetos o situación del problema'},{valor:'demostracion',etiqueta:'Demostración · producto y manos'}]} />
          {elegida ? <details className="em-origen"><summary>Origen y contenido de la sección</summary><p>{elegida.origen}</p><ul>{[...new Set([...(s.contenido || []), ...(elegida.contenido || [])])].map((t, i) => <li key={i}>{t}</li>)}</ul></details> : null}
          <div className="em-seccion__acciones"><Boton variante="primario" icono={ImagePlus} disabled={bloqueada || !completa} onClick={() => alPresupuestar({ secciones: [s.id] })}>{s.imagen ? 'Generar de nuevo' : 'Generar imagen'}</Boton>{s.imagen ? <Boton icono={Download} href={`${s.imagen.url}?descargar=1`} download={`${s.id}.png`}>Descargar</Boton> : null}</div>

        </div>
        <div className="em-seccion__visual">
          <div className={`em-preview${enCurso ? ' em-preview--generando' : ''}`} aria-busy={enCurso} style={{ aspectRatio: `${ancho}/${alto}` }}>
            {s.imagen ? <a href={s.imagen.url} target="_blank" rel="noopener noreferrer" aria-label={`Ampliar ${s.nombre}`}><img src={s.imagen.url} alt={`Imagen de ${s.nombre}`} loading="lazy" /></a> : <div className="em-preview__vacia"><Layers3 size={34} strokeWidth={1.3} /><strong>{s.nombre}</strong><p>Tu imagen aparecerá aquí</p><span>Diseño adaptado al producto</span></div>}
            {enCurso ? <div className="em-generando" role="status"><LoaderCircle size={34} className="girando" /><strong>{s.progreso.estado==='generando' ? `Generando ${s.nombre}…` : `${s.nombre} en cola`}</strong><span>{s.progreso.estado==='generando' ? 'Creando el diseño de esta sección' : 'Empezará cuando haya un espacio disponible'}</span></div> : null}
          </div>
          <div className="em-correccion">
            <AreaTexto etiqueta={`Correcciones · ${s.nombre}`} placeholder="Ej.: agranda el producto, cambia el fondo y mejora la legibilidad del subtítulo…" value={correccion} onChange={(e) => setCorreccion(e.target.value)} maxLength={1200} filas={3} disabled={bloqueada || !s.imagen} />
            <p>{s.imagen ? 'Se aplica a esta imagen. Para cambiar el mensaje, selecciona una propuesta o escribe la tuya.' : 'Genera primero esta imagen para poder pedir correcciones.'}</p>
            <div className="em-seccion__acciones"><Boton variante="secundario" icono={Sparkles} disabled={bloqueada || !s.imagen || !correccion.trim() || !completa} onClick={() => alPresupuestar({ secciones: [s.id], corregir: true }, { correcciones: { [s.id]: correccion } })}>Aplicar corrección</Boton>{correccion !== s.correccion ? <Boton variante="fantasma" disabled={bloqueada} onClick={() => alGuardar({ correcciones: { [s.id]: correccion } })}>Guardar indicación</Boton> : null}</div>
          </div>
          {s.imagen?.desactualizada ? <p className="em-falta">La imagen anterior se conserva. Genera o corrige para aplicar tu nueva selección.</p> : null}
        </div>
      </div>
    </article>
  );
}

function EditorEmbudo({ id }) {
  const { aviso } = useAvisos();
  const { datos: e, error, recargar } = useDatos(`embudo:${id}`, () => pedirNuevo(`${API}/${id}`), { cadaMs: 1800 });
  const [ocupado, setOcupado] = useState(false);
  const [presupuesto, setPresupuesto] = useState(null);
  const [estilo, setEstilo] = useState('');
  const [verUnion,setVerUnion]=useState(false);
  const [avatarDescripcion, setAvatarDescripcion] = useState('');
  const { datos: bib, recargar: recargarBiblioteca } = useBiblioteca();
  useEffect(() => { setAvatarDescripcion(e?.avatar?.descripcion || ''); }, [e?.avatar?.descripcion]);
  useEffect(() => { if(e?.avatarGuardado?.id) recargarBiblioteca(); }, [e?.avatarGuardado?.id]);
  useEffect(() => { if (e) setEstilo(e.estilo); }, [e?.estilo]);
  const guardar = async (cambios) => {
    const r = await pedirNuevo(`${API}/${id}`, { metodo: 'PUT', cuerpo: { version: e.version, ...cambios } });
    await recargar(); return r;
  };
  const editar = async (cambios) => {
    setOcupado(true);
    try { await guardar(cambios); }
    catch (x) { aviso({ tipo: 'error', titulo: 'No se guardó', texto: x.message }); }
    finally { setOcupado(false); }
  };
  const cotizar = async (accion, cambios = {}) => {
    setOcupado(true);
    try {
      const extras = { ...cambios, ...(estilo !== e.estilo ? { estilo } : {}), ...(e.avatar?.modo==='nuevo' && avatarDescripcion !== (e.avatar.descripcion || '') ? { avatar: { modo:'nuevo', descripcion:avatarDescripcion } } : {}) };
      const actual = Object.keys(extras).length ? await guardar(extras) : e;
      setPresupuesto(await pedirNuevo(`${API}/${id}/presupuesto`, { metodo: 'POST', cuerpo: { version: actual.version, ...accion } }));
    } catch (x) { aviso({ tipo: 'error', titulo: 'No pude preparar la generación', texto: x.message }); }
    finally { setOcupado(false); }
  };
  const proponer = async (seccion) => {
    setOcupado(true);
    try { await pedirNuevo(`${API}/${id}/titulos`,{metodo:'POST',cuerpo:{version:e.version,seccion}}); await recargar(); }
    catch(x) { aviso({tipo:'error',titulo:'No pude preparar los títulos',texto:x.message}); }
    finally {setOcupado(false);}
  };
  const generar = async () => {
    setOcupado(true);
    try { await pedirNuevo(`${API}/${id}/generar`, { metodo: 'POST', cuerpo: { token: presupuesto.token, version: presupuesto.version } }); setPresupuesto(null); await recargar(); }
    catch (x) { setPresupuesto(null); aviso({ tipo: 'error', titulo: 'No empezó la generación', texto: x.message }); }
    finally { setOcupado(false); }
  };
  if (error) return <div className="pagina"><EstadoVacio titulo="No pude abrir el embudo" descripcion={error.message} acciones={<Boton href={enlace.embudoWhatsapp()}>Volver a mis embudos</Boton>} /></div>;
  if (!e) return <div className="pagina" role="status">Cargando el embudo…</div>;
  const trabajando = e.trabajo?.estado === 'generando';
  const bloqueada = ocupado || trabajando || e.titulos?.estado==='generando' || Boolean(presupuesto);
  const faltan = e.secciones.filter((s) => !s.opciones.some((o) => o.id === s.elegida && o.titulo && o.subtitulo)).length;
  return (
    <div className="pagina em pila" style={{ '--hueco': 'var(--e-5)' }}>
      <CabeceraPagina sobretitulo="CREAR / EMBUDO" titulo={e.nombre} descripcion="Cinco secciones, una identidad para tu producto. Elige el mensaje y luego genera las imágenes." />
      <div className="em-barra"><Boton variante="fantasma" icono={ArrowLeft} href={enlace.embudoWhatsapp()}>Mis embudos</Boton><Boton variante="secundario" href={enlace.investigacion(e.productoId)}>Ver investigación</Boton></div>
      {e.fuenteCambio ? <div className="em-aviso"><CircleAlert size={20} /><div><strong>Cambió la investigación, la ficha o la foto del producto.</strong><p>Actualiza los textos y revisa tus elecciones antes de generar.</p></div><Boton icono={RefreshCw} disabled={bloqueada} onClick={() => editar({ actualizarTextos: true })}>Actualizar textos</Boton></div> : null}
      {e.avatarPendiente ? <div className="em-aviso"><CircleAlert size={20} /><p>El retrato está generado, pero falta guardarlo en Biblioteca. Puedes volver a guardarlo sin generar ni pagar otra imagen.</p><Boton disabled={bloqueada} onClick={async()=>{try{await pedirNuevo(`${API}/${id}/guardar-avatar`,{metodo:'POST'});await recargar();}catch(x){aviso({tipo:'error',titulo:'No se guardó el avatar',texto:x.message});}}}>Guardar avatar en Biblioteca</Boton></div> : null}
      <section className="em-config">
        <div className="em-config__titulo"><Palette size={22} /><div><h2>Identidad visual del producto</h2><p>Fondo liso compartido y composición limpia para unir las imágenes sin separaciones.</p></div></div>
        <div className="em-config__campos"><div className="em-formatos"><strong>Hero · 9:16</strong><span>Las otras 4 secciones · 4:5</span><label>Fondo común<input aria-label="Fondo común" type="color" defaultValue={e.fondo} key={e.fondo} disabled={bloqueada} onBlur={x=>{if(x.target.value.toUpperCase()!==e.fondo)editar({fondo:x.target.value});}} /></label></div><AreaTexto etiqueta="Dirección visual" opcional value={estilo} onChange={(x) => setEstilo(x.target.value)} placeholder="Ej.: estilo botánico elegante, tonos del empaque, fotografías naturales y tipografía limpia." filas={2} maxLength={1200} disabled={bloqueada} /></div>
        <div className="em-avatar-config">
          <div><Selector etiqueta="Avatar del Hero" disabled={bloqueada} value={e.avatar?.modo==='biblioteca' ? `biblioteca:${e.avatar.estilo}/${e.avatar.id}/${e.avatar.rol}` : e.avatar?.modo || 'sin'} onChange={(x) => { const v=x.target.value; if(v.startsWith('biblioteca:')) { const [estilo,id,rol]=v.slice(11).split('/'); editar({avatar:{modo:'biblioteca',estilo,id,rol}}); } else editar({avatar:{modo:v,descripcion:avatarDescripcion}}); }} opciones={[{valor:'nuevo',etiqueta:e.avatar?.modo==='nuevo' && e.avatarGuardado ? 'Reutilizar el avatar de este embudo' : 'Crear avatar nuevo · guardar en Biblioteca'},{valor:'sin',etiqueta:'Sin personas · solo producto'},...(bib?.avatares || []).flatMap(a=>a.personas.map(p=>({valor:`biblioteca:${a.estilo}/${a.id}/${p.rol}`,etiqueta:`${a.nombre} · ${p.nombre}`})))]} />
          {e.avatar?.modo==='nuevo' ? <><AreaTexto etiqueta="Cómo quieres el avatar" opcional value={avatarDescripcion} onChange={x=>setAvatarDescripcion(x.target.value)} filas={2} maxLength={600} disabled={bloqueada} placeholder="Ej.: una persona adulta latina de 35 años, cabello oscuro, estilo natural y cercano." /><p className="em-ayuda">Solo se usa en el Hero cuando eliges ese recurso visual. Las demás secciones representan su mensaje con producto, anatomía, objetos o demostraciones. El retrato se guarda para reutilizarlo. Su generación aparece en el presupuesto. Cambiar la descripción prepara un avatar nuevo.</p></> : null}</div>
          {e.avatarGuardado ? <div className="em-avatar-guardado"><img src={e.avatarGuardado.url} alt="Avatar reutilizable del embudo" /><div><strong>Avatar guardado en Biblioteca</strong><p>{e.avatarGuardado.nombre}</p><Boton tamano="chico" href={enlace.biblioteca({estilo:e.avatarGuardado.estilo})}>Abrir Biblioteca</Boton>{e.avatar?.modo==='nuevo' ? <Boton tamano="chico" variante="fantasma" disabled={bloqueada} onClick={()=>editar({avatar:{modo:'nuevo',descripcion:avatarDescripcion,renovar:true}})}>Crear otro avatar</Boton> : null}</div></div> : null}
        </div>
        <div className="em-barra"><span className="em-ayuda">Los textos elegidos se guardan automáticamente. Las indicaciones visuales se guardan al generar.</span><Boton icono={RefreshCw} disabled={bloqueada} onClick={() => editar({ actualizarTextos: true })}>Actualizar textos desde investigación</Boton></div>
      </section>
      <nav className="em-indice" aria-label="Secciones del embudo">{e.secciones.map((s) => <a key={s.id} href={`#seccion-${s.id}`} onClick={(x) => { x.preventDefault(); document.getElementById(`seccion-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{s.imagen ? <Check size={14} /> : <Layers3 size={14} />}{s.nombre}</a>)}</nav>
      <div className="em-barra"><div><strong>{e.secciones.filter((s) => s.imagen).length} de 5 imágenes generadas</strong><p className="em-ayuda">{faltan ? `Falta elegir o completar el mensaje de ${faltan} ${faltan === 1 ? 'sección' : 'secciones'}. Puedes generar las demás por separado.` : 'Los cinco mensajes están listos para generar.'}</p></div><Boton variante="primario" icono={ImagePlus} disabled={bloqueada || faltan > 0 || e.fuenteCambio} onClick={() => cotizar({ secciones: e.secciones.map((s) => s.id) })}>Generar las 5 secciones</Boton></div>
      {e.trabajo ? <div className={`em-trabajo${['error', 'parcial', 'interrumpido'].includes(e.trabajo.estado) ? ' em-trabajo--aviso' : ''}`} role="status">{trabajando ? <LoaderCircle size={20} className="girando" /> : <Layers3 size={20} />}<div><strong>{trabajando ? `Generando tus secciones en paralelo…` : e.trabajo.estado === 'lista' ? 'Generación terminada' : 'Hay secciones pendientes'}</strong><p>{e.trabajo.hechas} de {e.trabajo.cantidad} en esta operación · importe máximo aprobado: {dinero(e.trabajo.importeAprobado)}</p>{e.trabajo.error ? <p>{e.trabajo.error}</p> : null}</div>{!trabajando && ['error', 'parcial', 'interrumpido'].includes(e.trabajo.estado) ? <Boton disabled={bloqueada} onClick={() => cotizar({ retomar: e.trabajo.id })}>Retomar pendientes</Boton> : null}</div> : null}
      <div className="em-barra"><div><strong>Una sola continuidad visual</strong><p className="em-ayuda">Fondos lisos y el mismo ancho. Revisa las cinco piezas una debajo de otra.</p></div><Boton icono={Layers3} onClick={()=>setVerUnion(!verUnion)}>{verUnion ? 'Ocultar vista unida' : 'Ver embudo unido'}</Boton></div>
      {verUnion ? <section className="em-union" aria-label="Vista continua del embudo"><div style={{background:e.fondo}}>{e.secciones.map(s=>s.imagen ? <img key={s.id} src={s.imagen.url} alt={`${s.nombre} en la landing`} style={{aspectRatio:s.formato.replace(':','/')}} /> : <div key={s.id} className="em-union__pendiente" style={{aspectRatio:s.formato.replace(':','/')}}>{s.nombre} · pendiente</div>)}</div><p className="em-ayuda">Las imágenes se descargan por separado y se colocan al mismo ancho, sin márgenes entre ellas.{e.secciones.some(s=>s.imagen?.desactualizada) ? ' Hay imágenes anteriores que debes regenerar para aplicar el diseño actual.' : ''}</p></section> : null}
      {e.secciones.map((s) => <Seccion key={s.id} s={s} formato={s.formato} titulos={e.titulos} bloqueada={bloqueada || e.fuenteCambio} alGuardar={editar} alPresupuestar={cotizar} alTitulos={proponer} />)}
      <Modal abierto={Boolean(presupuesto)} onCerrar={() => !ocupado && setPresupuesto(null)} titulo={presupuesto?.corregir ? 'Confirmar corrección' : 'Confirmar generación'} descripcion="Revisa el alcance y el costo antes de continuar." pie={<><Boton variante="fantasma" disabled={ocupado} onClick={() => setPresupuesto(null)}>Cancelar</Boton><Boton variante="primario" cargando={ocupado} onClick={generar}>Confirmar y generar</Boton></>}>
        {presupuesto ? <div className="em-presupuesto"><strong>{dinero(presupuesto.importe)}</strong><p>{presupuesto.cantidad} {presupuesto.cantidad === 1 ? 'imagen' : 'imágenes'} · {presupuesto.modelo}</p>{presupuesto.secciones.includes('avatar') ? <p>Incluye el retrato nuevo que se guardará automáticamente en tu Biblioteca.</p> : null}<ul>{presupuesto.secciones.map((s) => <li key={s}>{NOMBRES[s]}</li>)}</ul><p>{presupuesto.motor === 'chatgpt' ? 'Con tu suscripción de ChatGPT. Sin respaldo automático de pago.' : 'Importe máximo de esta operación en kie.ai. No incluye nuevas correcciones.'}</p></div> : null}
      </Modal>
    </div>
  );
}

export default function Embudo({ params = {} }) {
  const { aviso } = useAvisos();
  const { datos, error } = useDatos('embudos:lista', () => pedirNuevo(API), { cadaMs: 5000 });
  const [productoId, setProductoId] = useState('');
  const [ocupado, setOcupado] = useState(false);
  if (params.id) return <EditorEmbudo key={params.id} id={params.id} />;
  const crear = async () => {
    setOcupado(true);
    try { const e = await pedirNuevo(API, { metodo: 'POST', cuerpo: { productoId } }); ir(rutas.embudo(e.id)); }
    catch (x) { aviso({ tipo: 'error', titulo: 'No pude crear el embudo', texto: x.message }); }
    finally { setOcupado(false); }
  };
  return <div className="pagina em pila" style={{ '--hueco': 'var(--e-5)' }}>
    <CabeceraPagina sobretitulo="CREAR / EMBUDO" titulo="De la idea a la decisión." descripcion="Hero, punto de dolor, beneficios, ingredientes y modo de uso. Cada sección con el mensaje de tu investigación y un diseño propio para tu producto." />
    <section className="em-crear"><div><Layers3 size={32} /><h2>Crea el embudo de tu producto</h2><p>Primero elige los textos. Después genera y corrige cada imagen.</p></div><div className="em-crear__form"><Selector etiqueta="Producto" value={productoId} onChange={(x) => setProductoId(x.target.value)} opciones={[{ valor: '', etiqueta: 'Elige un producto investigado' }, ...(datos?.productos || []).filter((p) => p.estado === 'lista').map((p) => ({ valor: p.id, etiqueta: p.nombre }))]} /><Boton variante="primario" icono={Plus} disabled={!productoId} cargando={ocupado} onClick={crear}>Crear embudo</Boton></div></section>
    {error ? <p role="alert">{error.message}</p> : !datos ? <p role="status">Cargando tus productos…</p> : null}
    {datos && !datos.productos.some((p) => p.estado === 'lista') ? <EstadoVacio icono={Layers3} titulo="Empieza con la investigación del producto" descripcion="Necesitas su foto y su investigación de mercado para traer los títulos y propuestas de valor de cada sección." acciones={<Boton href={enlace.investigacion()}>Ir a investigación de mercado</Boton>} /> : null}
    {datos?.embudos.length ? <section className="em-lista" aria-label="Tus embudos">{datos.embudos.map((e) => <a className="em-tarjeta" key={e.id} href={enlace.embudo(e.id)}><Layers3 size={28} /><h2>{e.nombre}</h2><p>{e.generadas} de 5 imágenes generadas</p><span>Abrir embudo</span></a>)}</section> : null}
  </div>;
}

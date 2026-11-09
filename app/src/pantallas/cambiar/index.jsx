// CAMBIAR EL PRODUCTO (#/cambiar y #/cambiar/<slug>): un video que ya existe queda igual, pero sin sus subtítulos,
// con tu producto en las escenas donde salía el de otra marca, la voz traducida con la misma voz y subtítulos nuevos.
// El servidor es lib/cambiar.js; el motor, produccion/cambiar-producto.js.
import { useEffect, useState } from 'react';
import { CircleAlert, Download, Film, LoaderCircle, Mic, Play, Plus, RefreshCw, Repeat, Sparkles, X } from 'lucide-react';
import { AreaTexto, Boton, CabeceraPagina, EstadoVacio, Interruptor, Seccion, SubirVideo, useAvisos } from '../../componentes/index.js';
import { useDatos, invalidar, miniatura } from '../../datos/api.js';
import { enlace, ir, rutas } from '../../datos/rutas.js';
import './cambiar.css';

async function pedir(url, { metodo = 'GET', cuerpo } = {}) {
  const r = await fetch(url, { method: metodo, headers: { Accept: 'application/json', ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.error || 'Algo salió mal. Vuelve a intentarlo.');
  return d;
}
const seg = (n) => `${(Number(n) || 0).toFixed(1).replace('.', ',')} s`;
const ETAPAS = {
  analizando: 'Analizando el video',
  proponiendo: 'Claude está armando la propuesta',
  revisar: 'Listo para revisar',
  produciendo: 'Produciendo',
  listo: 'Terminado',
  error: 'Se detuvo',
};

// ---------------------------------------------------------------- empezar uno nuevo
function Nuevo({ alCrear }) {
  const { datos } = useDatos('productos', () => pedir('/api/productos'));
  const productos = (datos?.productos || []).filter((p) => p.foto);
  const [video, setVideo] = useState(null);
  const [producto, setProducto] = useState(null);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState(null);
  const crear = async () => {
    setCreando(true);
    setError(null);
    try {
      const v = String(video || '').replace(/\|.*$/, '');
      const { slug } = await pedir('/api/cambiar', { metodo: 'POST', cuerpo: { video: v, productoId: producto } });
      alCrear(slug);
    } catch (e) {
      setError(e.message);
      setCreando(false);
    }
  };
  return (
    <div className="cb-nuevo">
      <div className="cb-paso">
        <span className="cb-paso__n">1</span>
        <div className="cb-paso__cuerpo">
          <h3>El video</h3>
          <SubirVideo valor={video} onCambio={setVideo} deshabilitado={creando} />
        </div>
      </div>
      <div className="cb-paso">
        <span className="cb-paso__n">2</span>
        <div className="cb-paso__cuerpo">
          <h3>Tu producto</h3>
          {productos.length ? (
            <div className="cb-productos">
              {productos.map((p) => (
                <button key={p.id} type="button" className={`cb-producto${producto === p.id ? ' cb-producto--activo' : ''}`} onClick={() => setProducto(p.id)} disabled={creando}>
                  <img src={p.foto} alt="" loading="lazy" />
                  <span>{p.nombre}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="cb-nota">
              Todavía no tienes productos con foto. Créalo en <a href={enlace.nuevo()}>Nuevo anuncio</a> y vuelve.
            </p>
          )}
        </div>
      </div>
      {error ? (
        <p className="cb-error" role="alert">
          <CircleAlert size={14} aria-hidden="true" /> {error}
        </p>
      ) : null}
      <div>
        <Boton variante="primario" icono={Sparkles} disabled={!video || !producto} cargando={creando} onClick={crear}>
          Analizar el video
        </Boton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- la lista
function Lista() {
  const { datos } = useDatos('cambios', () => pedir('/api/cambiar'), { cadaMs: 8000 });
  const lista = datos?.trabajos || [];
  if (!lista.length) return null;
  return (
    <Seccion titulo="Tus videos cambiados" contador={lista.length}>
      <div className="cb-lista">
        {lista.map((t) => (
          <a key={t.slug} className="cb-item" href={`#${rutas.cambiar(t.slug)}`}>
            <span className="cb-item__img">{t.miniatura ? <img src={miniatura(t.miniatura, 240)} alt="" loading="lazy" /> : <Film size={22} aria-hidden="true" />}</span>
            <span className="cb-item__texto">
              <strong>{t.producto}</strong>
              <span className={`cb-etapa cb-etapa--${t.etapa}`}>{ETAPAS[t.etapa] || t.etapa}</span>
            </span>
          </a>
        ))}
      </div>
    </Seccion>
  );
}

// ---------------------------------------------------------------- un trabajo
function Escena({ toma, marcada, onMarcar, escena, onEscena, bloqueado }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div className={`cb-toma${marcada ? ' cb-toma--marcada' : ''}`}>
      <button type="button" className="cb-toma__img" onClick={() => !bloqueado && onMarcar(!marcada)} disabled={bloqueado} aria-pressed={marcada} title={marcada ? 'Esta escena se cambia' : 'Tocar para cambiar esta escena'}>
        {toma.imagen ? <img src={toma.imagen} alt={`Toma ${toma.n}`} loading="lazy" /> : null}
        <span className="cb-toma__tiempo">
          {toma.n} · {seg(toma.desde)}–{seg(toma.hasta)}
        </span>
        {marcada ? (
          <span className="cb-toma__marca">
            <Repeat size={13} strokeWidth={2.4} aria-hidden="true" /> Tu producto
          </span>
        ) : null}
      </button>
      {toma.dice ? <p className="cb-toma__dice">«{toma.dice}»</p> : null}
      {marcada ? (
        <button type="button" className="cb-toma__mas" onClick={() => setAbierta(!abierta)}>
          {abierta ? 'Ocultar instrucciones' : 'Ver instrucciones'}
        </button>
      ) : null}
      {marcada && abierta ? (
        <div className="pila" style={{ '--hueco': '6px' }}>
          <AreaTexto etiqueta="Imagen" filas={3} placeholder="Vacío: tu producto en el mismo lugar y tamaño" value={escena?.prompt_imagen || ''} disabled={bloqueado} onChange={(e) => onEscena({ prompt_imagen: e.target.value })} />
          <AreaTexto etiqueta="Movimiento" filas={2} placeholder="Vacío: el mismo movimiento del original" value={escena?.prompt_video || ''} disabled={bloqueado} onChange={(e) => onEscena({ prompt_video: e.target.value })} />
        </div>
      ) : null}
    </div>
  );
}

function Detalle({ slug }) {
  const { aviso } = useAvisos();
  const { datos: t, error, recargar } = useDatos(`cambio:${slug}`, () => pedir(`/api/cambiar/${encodeURIComponent(slug)}`), { cadaMs: 4000 });
  const [cambio, setCambio] = useState(null);
  const [sucio, setSucio] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    if (t?.cambio && !sucio) setCambio(t.cambio);
  }, [t, sucio]);

  if (error) return <EstadoVacio icono={CircleAlert} tono="peligro" titulo="No encuentro este video" descripcion={error.message} acciones={<Boton href={enlace.cambiar()}>Volver</Boton>} />;
  if (!t) return <p className="cb-nota">Cargando…</p>;

  const trabajando = ['analizando', 'proponiendo', 'produciendo'].includes(t.etapa);
  const bloqueado = trabajando || ocupado;
  const editar = (cambios) => {
    setCambio((c) => ({ ...c, ...cambios }));
    setSucio(true);
  };
  const escenaDe = (n) => cambio?.escenas?.find((e) => Number(e.toma) === n);
  const marcar = (toma, si) =>
    editar({
      escenas: si
        ? [...(cambio?.escenas || []), { toma: toma.n, desde: toma.desde, hasta: toma.hasta, prompt_imagen: '', prompt_video: '' }].sort((a, b) => a.desde - b.desde)
        : (cambio?.escenas || []).filter((e) => Number(e.toma) !== toma.n),
    });
  const editarEscena = (n, cambios) => editar({ escenas: cambio.escenas.map((e) => (Number(e.toma) === n ? { ...e, ...cambios } : e)) });
  const editarVoz = (i, cambios) => editar({ voz: cambio.voz.map((v, j) => (j === i ? { ...v, ...cambios } : v)) });
  const quitarFrase = (i) => editar({ voz: cambio.voz.filter((_, j) => j !== i) });
  const agregarFrase = () => {
    const desde = Math.min(Number(cambio?.voz?.at(-1)?.hasta) || 0, Math.max(0, (t.duracion || 3) - 0.5));
    editar({ voz: [...(cambio?.voz || []), { desde, hasta: Math.min(desde + 3, t.duracion || desde + 3), texto: '' }] });
  };

  const guardar = async () => {
    await pedir(`/api/cambiar/${encodeURIComponent(slug)}/cambio`, { metodo: 'PUT', cuerpo: { cambio } });
    setSucio(false);
  };
  const accion = async (que) => {
    setOcupado(true);
    try {
      if (que === 'producir' && sucio) await guardar();
      await pedir(`/api/cambiar/${encodeURIComponent(slug)}/${que}`, { metodo: 'POST' });
      if (que === 'proponer') setSucio(false);
      invalidar('cambios');
      await recargar();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No se pudo', texto: e.message });
    } finally {
      setOcupado(false);
    }
  };

  const escenas = cambio?.escenas?.length || 0;
  const frases = cambio?.voz?.length || 0;

  return (
    <div className="cb-detalle">
      <div className="cb-cabeza">
        {t.original ? <video className="cb-cabeza__video" src={t.original} controls playsInline preload="metadata" /> : null}
        <div className="pila" style={{ '--hueco': '10px' }}>
          <span className={`cb-etapa cb-etapa--${t.etapa}`}>
            {trabajando ? <LoaderCircle size={13} className="girando" aria-hidden="true" /> : null}
            {ETAPAS[t.etapa] || t.etapa}
          </span>
          <h2 className="cb-cabeza__titulo">{t.producto}</h2>
          {t.producto_foto ? <img className="cb-cabeza__producto" src={t.producto_foto} alt="Tu producto" /> : null}
          {trabajando && t.progreso?.length ? <p className="cb-progreso">{t.progreso[t.progreso.length - 1]}</p> : null}
          {t.etapa === 'error' ? (
            <>
              <p className="cb-error" role="alert">
                <CircleAlert size={14} aria-hidden="true" /> {t.error}
              </p>
              <div>
                <Boton icono={RefreshCw} onClick={() => accion('reintentar')} cargando={ocupado}>
                  Reintentar
                </Boton>
              </div>
            </>
          ) : null}
          {t.aviso && t.etapa === 'revisar' ? <p className="cb-nota">{t.aviso}</p> : null}
        </div>
      </div>

      {t.salidas?.length ? (
        <Seccion titulo="Tu video" icono={Play}>
          <div className="cb-salidas">
            {t.salidas.map((s) => (
              <div key={s.tipo} className="cb-salida">
                <video src={s.url} controls playsInline preload="metadata" />
                <div className="fila" style={{ '--hueco': '8px', justifyContent: 'space-between' }}>
                  <span>{s.nombre}</span>
                  <Boton tamano="chico" icono={Download} href={s.url} download={s.archivo}>
                    Descargar
                  </Boton>
                </div>
              </div>
            ))}
          </div>
        </Seccion>
      ) : null}

      {t.tomas?.length && cambio ? (
        <>
          <Seccion titulo="Escenas" descripcion="Toca las escenas donde sale el otro producto: esas se rehacen con el tuyo. Las demás quedan tal cual." contador={escenas}>
            <div className="cb-tomas">
              {t.tomas.map((toma) => (
                <Escena key={toma.n} toma={toma} marcada={!!escenaDe(toma.n)} onMarcar={(si) => marcar(toma, si)} escena={escenaDe(toma.n)} onEscena={(c) => editarEscena(toma.n, c)} bloqueado={bloqueado} />
              ))}
            </div>
          </Seccion>

          <Seccion titulo="La voz en español" icono={Mic} descripcion="Con la misma voz del video. Corrige lo que quieras." contador={frases}>
            <div className="cb-voz">
              {(cambio.voz || []).map((v, i) => (
                <div key={i} className="cb-frase">
                  <label className="cb-frase__tiempo">
                    <input type="number" min="0" step="0.1" value={v.desde} disabled={bloqueado} aria-label={`Desde (segundos), frase ${i + 1}`} onChange={(e) => editarVoz(i, { desde: Number(e.target.value) })} />
                    <input type="number" min="0" step="0.1" value={v.hasta} disabled={bloqueado} aria-label={`Hasta (segundos), frase ${i + 1}`} onChange={(e) => editarVoz(i, { hasta: Number(e.target.value) })} />
                  </label>
                  <AreaTexto aria-label={`Frase ${i + 1}`} filas={2} value={v.texto} disabled={bloqueado} placeholder="Lo que se dice en español" onChange={(e) => editarVoz(i, { texto: e.target.value })} />
                  <Boton variante="fantasma" tamano="chico" soloIcono icono={X} etiqueta="Quitar la frase" onClick={() => quitarFrase(i)} disabled={bloqueado} />
                </div>
              ))}
              <div>
                <Boton tamano="chico" icono={Plus} onClick={agregarFrase} disabled={bloqueado}>
                  Agregar una frase
                </Boton>
              </div>
            </div>
          </Seccion>

          <Seccion titulo="Opciones">
            <div className="pila" style={{ '--hueco': '12px' }}>
              <Interruptor activado={cambio.borrar_subtitulos !== false} onCambio={(v) => editar({ borrar_subtitulos: v })} deshabilitado={bloqueado} etiqueta="Borrar los subtítulos del original" descripcion="Se hace en tu Mac, gratis." />
              <Interruptor activado={cambio.subtitulos !== false} onCambio={(v) => editar({ subtitulos: v ? 'es' : false })} deshabilitado={bloqueado} etiqueta="Subtítulos nuevos en español" />
            </div>
          </Seccion>

          <div className="cb-acciones">
            <Boton variante="primario" tamano="grande" icono={Sparkles} disabled={bloqueado || !(cambio.voz || []).some((v) => v.texto.trim())} cargando={t.etapa === 'produciendo'} onClick={() => accion('producir')}>
              {t.salidas?.length ? 'Volver a producir' : 'Producir el video'}
            </Boton>
            {sucio ? (
              <Boton onClick={() => guardar().then(() => aviso({ tipo: 'ok', titulo: 'Guardado' }))} disabled={bloqueado}>
                Guardar cambios
              </Boton>
            ) : null}
            <Boton variante="fantasma" icono={RefreshCw} onClick={() => accion('proponer')} disabled={bloqueado}>
              Que Claude proponga de nuevo
            </Boton>
            <span className="cb-nota">
              {escenas} {escenas === 1 ? 'escena' : 'escenas'} con tu producto · {frases} frases de voz
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function Cambiar({ params }) {
  const slug = params?.slug;
  return (
    <div className="pila" style={{ '--hueco': 'var(--e-8)' }}>
      <CabeceraPagina
        sobretitulo="Crear"
        titulo="Cambiar el producto"
        descripcion="Sube un video: queda igual, pero con tu producto, la voz en español con la misma voz y subtítulos nuevos."
        acciones={slug ? <Boton href={enlace.cambiar()}>Otro video</Boton> : null}
      />
      {slug ? (
        <Detalle slug={slug} />
      ) : (
        <>
          <Nuevo alCrear={(s) => { invalidar('cambios'); ir(rutas.cambiar(s)); }} />
          <Lista />
        </>
      )}
    </div>
  );
}

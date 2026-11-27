// CHAT DE IMÁGENES (2026-11-27a): conversas con tu IA y crea las imágenes de tu producto, con todo lo que la app sabe
// de cómo las quieres (tus preferencias, lo que aprendió el supervisor, el manual de Mayaverra, tu oferta y sellos, tu
// investigación, lo que te funciona). Genera directo (con kie, una sola confirmación del costo por chat). Cada chat es un
// lote del producto: sus imágenes quedan en Anuncios de imagen → la carpeta del producto.
// Servidor: /api/chat-imagenes (lib/imagen-ads/chat.js).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Download, FolderOpen, ImagePlus, MessageSquarePlus, Paperclip, Pencil, Send, Sparkles, Trash2, X } from 'lucide-react';
import { Boton, CabeceraPagina, Chip, EstadoVacio, Modal, useAvisos } from '../../componentes/index.js';
import { pedirNuevo, useDatos, refrescar } from '../../datos/api.js';
import { apiImagenes, copiarDesde, useProductosImagen } from '../../datos/imagenes.js';
import { LoteFunciona } from '../../datos/funcionan.js';
import { enlace, ir, rutas } from '../../datos/rutas.js';
import { dinero, fechaRelativa } from '../../datos/formato.js';
import { TarjetaPieza } from '../imagenes-lote/Variacion.jsx';
import { Visor } from '../imagenes-lote/Visor.jsx';
import '../imagenes-lote/lote.css';
import './chat.css';

const BASE = '/api/chat-imagenes';
const TAMANOS = [
  ['1:1', 'Cuadrado 1:1'],
  ['9:16', 'Vertical 9:16'],
  ['4:5', 'Retrato 4:5'],
];
const SUGERENCIAS = ['4 anuncios como Mayaverra', 'Antes y después de 3 meses', 'Una como la que mejor me funciona', 'Cambia el fondo de la última'];

export default function ChatImagenes({ params }) {
  const id = params?.id || null;
  const { datos: lista } = useDatos('chat-imagenes:lista', () => pedirNuevo(BASE), { cadaMs: 15000 });
  const chats = lista?.chats || [];
  const [nuevo, setNuevo] = useState(false);
  // sin chat abierto: el más reciente (si hay)
  useEffect(() => {
    if (!id && chats.length) ir(rutas.chatImagenes(chats[0].id), { reemplazar: true });
  }, [id, chats.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pagina chat-img">
      <CabeceraPagina
        sobretitulo="Crear"
        titulo="Chat de imágenes"
        descripcion="Pídelas con tus palabras: conoce tu producto, tu oferta y cómo te gustan. Quedan en su carpeta."
        acciones={
          <Boton variante="primario" icono={MessageSquarePlus} onClick={() => setNuevo(true)}>
            Nuevo chat
          </Boton>
        }
      />
      <div className="chat-img__cuerpo">
        <nav className="chat-img__lista" aria-label="Tus chats">
          {chats.length ? (
            chats.map((c) => (
              <a key={c.id} href={enlace.chatImagenes(c.id)} className={`chat-img__item${c.id === id ? ' chat-img__item--activo' : ''}`} aria-current={c.id === id ? 'page' : undefined}>
                <span className="chat-img__item-titulo t-recortar">{c.titulo}</span>
                <span className="chat-img__item-datos t-mini t-recortar">
                  {c.producto} · {c.imagenes} {c.imagenes === 1 ? 'imagen' : 'imágenes'} · {fechaRelativa(c.actualizado)}
                </span>
              </a>
            ))
          ) : (
            <p className="t-chico t-3 chat-img__vacia">Todavía no tienes chats. Toca «Nuevo chat».</p>
          )}
        </nav>
        {id ? <Conversacion key={id} id={id} /> : <EstadoVacio icono={Sparkles} titulo="Empieza un chat" descripcion="Elige el producto y pídele las imágenes que quieras." acciones={<Boton variante="primario" icono={MessageSquarePlus} onClick={() => setNuevo(true)}>Nuevo chat</Boton>} />}
      </div>
      <ModalNuevo abierto={nuevo} onCerrar={() => setNuevo(false)} />
    </div>
  );
}

function ModalNuevo({ abierto, onCerrar }) {
  const { datos } = useProductosImagen();
  const productos = (datos?.productos || []).filter((p) => (p.fotos || []).length);
  const [creando, setCreando] = useState(null);
  const [error, setError] = useState('');
  const crear = async (productoId) => {
    setCreando(productoId);
    setError('');
    try {
      const c = await pedirNuevo(BASE, { metodo: 'POST', cuerpo: { productoId } });
      refrescar('chat-imagenes:lista');
      onCerrar();
      ir(rutas.chatImagenes(c.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setCreando(null);
    }
  };
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} icono={MessageSquarePlus} titulo="Nuevo chat de imágenes" descripcion="¿De qué producto? Sus imágenes quedan en su carpeta.">
      <div className="chat-img__productos">
        {productos.length ? (
          productos.map((p) => (
            <button key={p.id} type="button" className="chat-img__producto" disabled={Boolean(creando)} onClick={() => crear(p.id)}>
              {p.fotos?.[0]?.url ? <img src={p.fotos[0].url} alt="" /> : null}
              <span>{creando === p.id ? 'Creando…' : p.nombre}</span>
            </button>
          ))
        ) : (
          <p className="t-chico">Primero crea un producto con su foto (en Productos).</p>
        )}
      </div>
      {error ? <p className="chat-img__error" role="alert">{error}</p> : null}
    </Modal>
  );
}

function Conversacion({ id }) {
  const clave = `chat-imagenes:${id}`;
  const { datos, error } = useDatos(clave, () => pedirNuevo(`${BASE}/${id}`), { cadaMs: 2500 });
  const { aviso } = useAvisos();
  const [texto, setTexto] = useState('');
  // (2026-11-27b) chat libre: sin tamaño ni cantidad salvo que los elijas
  const [formato, setFormato] = useState(null);
  const [cantidad, setCantidad] = useState(null);
  const [ver, setVer] = useState(null); // { lista: [url], i } la imagen adjunta en grande
  const [editando, setEditando] = useState(null); // { id, texto } tu mensaje que estás corrigiendo
  // (2026-11-27c) las imágenes que elegiste para cambiarlas juntas
  const [elegidas, setElegidas] = useState([]);
  const alternar = (v) => setElegidas((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v].slice(0, 12)));
  const [adjuntos, setAdjuntos] = useState([]); // [{ archivo, url }]
  const [enviando, setEnviando] = useState(false);
  const [falla, setFalla] = useState('');
  const [visor, setVisor] = useState(null);
  const [confirmar, setConfirmar] = useState(null); // el texto que espera la autorización del costo
  const [borrar, setBorrar] = useState(false);
  const fondo = useRef(null);
  const caja = useRef(null);
  const subir = useRef(null);
  const mensajes = datos?.mensajes || [];
  const pensando = Boolean(datos?.pensando);
  const imagenes = useMemo(() => {
    const m = new Map();
    for (const x of mensajes) for (const v of x.imagenes || []) m.set(v.v, v);
    return [...m.values()].sort((a, b) => a.v.localeCompare(b.v, 'en', { numeric: true }));
  }, [mensajes]);

  useEffect(() => {
    fondo.current?.scrollTo({ top: fondo.current.scrollHeight, behavior: 'smooth' });
  }, [mensajes.length, pensando]);

  const adjuntar = async (archivos) => {
    for (const f of [...(archivos || [])].filter((x) => /^image\//.test(x.type)).slice(0, 6 - adjuntos.length)) {
      try {
        const r = await pedirNuevo(`${BASE}/${id}/adjuntos`, { metodo: 'POST', binario: f });
        setAdjuntos((l) => [...l, r].slice(0, 6));
      } catch (e) {
        setFalla(e.message);
      }
    }
  };
  useEffect(() => {
    const alPegar = (e) => {
      const fs = [...(e.clipboardData?.files || [])];
      if (fs.length) {
        e.preventDefault();
        adjuntar(fs);
      }
    };
    window.addEventListener('paste', alPegar);
    return () => window.removeEventListener('paste', alPegar);
  });

  // (de la caja; o, con `adj`, tu mensaje corregido con sus mismas imágenes: «editar y volver a enviar»)
  useEffect(() => {
    if (!ver || ver.lista.length < 2) return undefined;
    const tecla = (e) => {
      if (e.key === 'ArrowLeft') setVer((x) => (x && x.i > 0 ? { ...x, i: x.i - 1 } : x));
      if (e.key === 'ArrowRight') setVer((x) => (x && x.i < x.lista.length - 1 ? { ...x, i: x.i + 1 } : x));
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [ver]);

  const enviar = async (t = texto, { adj = null, sel = null } = {}) => {
    const m = String(t || '').trim();
    const lista = adj || adjuntos.map((a) => a.archivo);
    const seleccion = sel || elegidas;
    if ((!m && !lista.length) || enviando || pensando) return;
    setEnviando(true);
    setFalla('');
    try {
      await pedirNuevo(`${BASE}/${id}/mensajes`, { metodo: 'POST', cuerpo: { texto: m, adjuntos: lista, formato, cantidad, seleccion } });
      if (adj) setEditando(null);
      else {
        setTexto('');
        setAdjuntos([]);
        setElegidas([]);
      }
      refrescar(clave);
      refrescar('chat-imagenes:lista');
    } catch (e) {
      if (e?.estado === 428) setConfirmar(m);
      else setFalla(e.message);
    } finally {
      setEnviando(false);
    }
  };
  const autorizar = async () => {
    const t = confirmar;
    setConfirmar(null);
    try {
      await pedirNuevo(`${BASE}/${id}/autorizar`, { metodo: 'POST', cuerpo: { dolaresPorImagen: datos?.costo?.dolaresPorImagen } });
      await refrescar(clave);
      if (t !== null) enviar(t);
    } catch (e) {
      setFalla(e.message);
    }
  };
  const copiar = (p, { version, como } = {}) => {
    copiarDesde(apiImagenes.prompt(datos.lote, p.pieza, { version, como }).then((r) => r?.texto ?? '')).then(
      () => aviso({ tipo: 'ok', titulo: 'Copiado' }),
      (e) => aviso({ tipo: 'error', titulo: 'No pude copiarlo', texto: e?.message })
    );
  };
  // «Regenerar» en el chat: se lo pides con tus palabras
  const pedirCambio = (p) => {
    const v = p.pieza.split('_')[0];
    setTexto(`Cambia en ${v}: `);
    requestAnimationFrame(() => caja.current?.focus());
  };

  if (error && !datos) return <EstadoVacio icono={X} titulo="No encuentro este chat" descripcion={error.message} />;
  const costo = datos?.costo;

  return (
    <LoteFunciona.Provider value={datos?.lote || null}>
      <section className="chat-img__conversacion" aria-label="Conversación">
        <header className="chat-img__barra">
          <div className="chat-img__barra-titulo">
            <strong className="t-recortar">{datos?.titulo || 'Chat'}</strong>
            <span className="t-mini t-3">
              {datos?.producto}
              {costo ? ` · ${costo.conChatGPT ? 'con tu ChatGPT, sin costo por imagen' : costo.dolaresPorImagen ? `~${dinero(costo.dolaresPorImagen)} por imagen` : ''}` : ''}
            </span>
          </div>
          <div className="fila" style={{ '--hueco': '6px' }}>
            {datos?.lote ? (
              <Boton variante="fantasma" tamano="chico" icono={FolderOpen} href={enlace.loteImagenes(datos.lote)}>
                Ver en la carpeta
              </Boton>
            ) : null}
            <Boton variante="fantasma" tamano="chico" soloIcono icono={Trash2} etiqueta="Borrar este chat" onClick={() => setBorrar(true)} />
          </div>
        </header>
        <div className="chat-img__mensajes" ref={fondo}>
          {!mensajes.length ? (
            <div className="chat-img__hola">
              <Sparkles size={26} aria-hidden="true" />
              <p>
                <b>Pídeme las imágenes que quieras para {datos?.producto || 'tu producto'}.</b> Ya conozco tu producto, tu oferta y tus sellos, tu investigación, cómo trabaja Mayaverra, lo que te funciona y lo que aprendió el supervisor. Las creo directo y quedan en la carpeta del producto. También puedes adjuntar una imagen de referencia.
              </p>
            </div>
          ) : (
            mensajes.map((m) => (
              <div key={m.id} className={`chat-img__msj chat-img__msj--${m.de === 'tu' ? 'tu' : 'ia'}`}>
                {editando?.id === m.id ? (
                  <div className="chat-img__editar">
                    <textarea rows={3} value={editando.texto} onChange={(e) => setEditando({ ...editando, texto: e.target.value })} aria-label="Corrige tu mensaje" autoFocus />
                    <div className="fila" style={{ '--hueco': '6px' }}>
                      <Boton variante="fantasma" tamano="chico" onClick={() => setEditando(null)}>
                        Cancelar
                      </Boton>
                      <Boton variante="secundario" tamano="chico" icono={Send} cargando={enviando} disabled={pensando || !editando.texto.trim()} onClick={() => enviar(editando.texto, { adj: (m.adjuntos || []).map((a) => a.archivo), sel: m.seleccion || [] })}>
                        Volver a enviar
                      </Boton>
                    </div>
                  </div>
                ) : m.texto ? (
                  <p>{m.texto}</p>
                ) : null}
                {(m.seleccion || []).length ? <span className="chat-img__para t-mini">Para {m.seleccion.join(', ')}</span> : null}
                {(m.adjuntos || []).length ? (
                  <div className="chat-img__adjuntos">
                    {m.adjuntos.map((a, i) => (
                      <button key={a.archivo} type="button" className="chat-img__ver" onClick={() => setVer({ lista: m.adjuntos.map((x) => x.url), i })} aria-label="Ver la imagen adjunta en grande">
                        <img src={a.url} alt="Imagen adjunta" />
                      </button>
                    ))}
                  </div>
                ) : null}
                {(m.imagenes || []).length ? (
                  <div className="chat-img__imagenes">
                    {m.imagenes.map((x) => (
                      <div key={x.v} className={`chat-img__imagen${elegidas.includes(x.v) ? ' chat-img__imagen--elegida' : ''}`}>
                        <button type="button" className="chat-img__elegir" aria-pressed={elegidas.includes(x.v)} aria-label={`Elegir ${x.v} para cambiarla`} title={elegidas.includes(x.v) ? 'Quitar de la elección' : 'Elegir para cambiarla (puedes elegir varias)'} onClick={() => alternar(x.v)}>
                          {elegidas.includes(x.v) ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : null}
                        </button>
                        <span className="chat-img__v t-num">{x.v}</span>
                        <TarjetaPieza p={x.piezas['1:1']} formato="1:1" onAbrir={() => setVisor({ v: x.v, formato: '1:1' })} onRegenerar={pedirCambio} onCopiar={copiar} />
                      </div>
                    ))}
                  </div>
                ) : null}
                <small className="chat-img__pie">
                  {fechaRelativa(m.fecha)}
                  {(m.imagenes || []).length > 1 ? (
                    <button type="button" className="chat-img__editar-btn" onClick={() => setElegidas((l) => [...new Set([...l, ...m.imagenes.map((x) => x.v)])].slice(0, 12))}>
                      <Check size={11} aria-hidden="true" /> Elegir estas {m.imagenes.length}
                    </button>
                  ) : null}
                  {m.de === 'tu' && editando?.id !== m.id ? (
                    <button type="button" className="chat-img__editar-btn" onClick={() => setEditando({ id: m.id, texto: m.texto || '' })} disabled={pensando}>
                      <Pencil size={11} aria-hidden="true" /> Editar y volver a enviar
                    </button>
                  ) : null}
                </small>
              </div>
            ))
          )}
          {pensando ? (
            <div className="chat-img__msj chat-img__msj--ia chat-img__pensando">
              <p>
                Pensando<span className="puntos"><i>.</i><i>.</i><i>.</i></span>
              </p>
            </div>
          ) : null}
        </div>
        {falla ? (
          <p className="chat-img__error" role="alert">
            {falla}
          </p>
        ) : null}
        <div className="chat-img__sugerencias" role="group" aria-label="Ideas">
          {SUGERENCIAS.map((s) => (
            <Chip key={s} tamano="chico" onClick={() => enviar(s)} disabled={enviando || pensando}>
              {s}
            </Chip>
          ))}
        </div>
        <div
          className="chat-img__caja"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            adjuntar(e.dataTransfer?.files);
          }}
        >
          {elegidas.length ? (
            <div className="chat-img__elegidas" role="group" aria-label="Las imágenes que vas a cambiar">
              <span className="t-chico">
                <strong>Vas a cambiar:</strong>
              </span>
              {elegidas.map((v) => (
                <Chip key={v} tamano="chico" activo onClick={() => alternar(v)} title={`Quitar ${v}`}>
                  {v} ✕
                </Chip>
              ))}
              <button type="button" className="chat-img__editar-btn" onClick={() => setElegidas([])}>
                Quitar todas
              </button>
            </div>
          ) : null}
          {adjuntos.length ? (
            <div className="chat-img__adjuntos chat-img__adjuntos--caja">
              {adjuntos.map((a) => (
                <span key={a.archivo} className="chat-img__adjunto">
                  <button type="button" className="chat-img__ver" onClick={() => setVer({ lista: adjuntos.map((x) => x.url), i: adjuntos.indexOf(a) })} aria-label="Ver en grande">
                    <img src={a.url} alt="" />
                  </button>
                  <button type="button" aria-label="Quitar" onClick={() => setAdjuntos((l) => l.filter((x) => x.archivo !== a.archivo))}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <textarea
            ref={caja}
            rows={2}
            placeholder={elegidas.length ? `¿Qué les cambio a ${elegidas.join(', ')}? Ej.: borra el texto de abajo, pon el fondo blanco, pásalas a vertical…` : 'Ej.: hazme 3 anuncios de antes y después de glúteos, en vertical, con promesa de 4 semanas…'}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
          />
          <div className="chat-img__opciones">
            <div className="fila fila--envolver" style={{ '--hueco': '6px' }}>
              <Boton variante="fantasma" tamano="chico" icono={Paperclip} onClick={() => subir.current?.click()}>
                Adjuntar
              </Boton>
              <input ref={subir} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => adjuntar(e.target.files)} />
              <span className="t-mini t-3">{formato ? 'Tamaño:' : 'Tamaño: libre'}</span>
              {TAMANOS.map(([f, t]) => (
                <Chip key={f} tamano="chico" activo={formato === f} onClick={() => setFormato((x) => (x === f ? null : f))} title={formato === f ? 'Tócalo otra vez para dejarlo libre' : `Que salgan en ${t.toLowerCase()}`}>
                  {t}
                </Chip>
              ))}
              <label className="chat-img__cantidad t-chico">
                <ImagePlus size={13} aria-hidden="true" />
                <select value={cantidad ?? ''} onChange={(e) => setCantidad(e.target.value ? Number(e.target.value) : null)} aria-label="Cuántas imágenes">
                  <option value="">Las que diga</option>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'imagen' : 'imágenes'}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Boton variante="primario" icono={Send} cargando={enviando} disabled={pensando || (!texto.trim() && !adjuntos.length)} onClick={() => enviar()}>
              Enviar
            </Boton>
          </div>
        </div>
      </section>
      <Visor
        vista={{ brief: {}, variaciones: imagenes }}
        variaciones={imagenes}
        abierto={visor}
        onCerrar={() => setVisor(null)}
        onIr={(paso) => setVisor((s) => {
          const i = imagenes.findIndex((x) => x.v === s?.v);
          const sig = imagenes[Math.min(imagenes.length - 1, Math.max(0, i + paso))];
          return sig ? { ...s, v: sig.v } : s;
        })}
        onFormato={() => {}}
        onRegenerar={(p) => {
          setVisor(null);
          pedirCambio(p);
        }}
        onCopiar={copiar}
      />
      <Modal abierto={Boolean(ver)} onCerrar={() => setVer(null)} tamano="grande" titulo="Imagen adjunta" className="chat-img__modal-ver">
        {ver ? (
          <div className="chat-img__grande">
            <img src={ver.lista[ver.i]} alt="Imagen adjunta en grande" />
            <div className="fila" style={{ '--hueco': '6px', justifyContent: 'center' }}>
              {ver.lista.length > 1 ? <Boton variante="fantasma" tamano="chico" soloIcono icono={ChevronLeft} etiqueta="Anterior" disabled={ver.i <= 0} onClick={() => setVer({ ...ver, i: ver.i - 1 })} /> : null}
              <Boton variante="secundario" tamano="chico" icono={Download} href={ver.lista[ver.i]} download>
                Descargar
              </Boton>
              {ver.lista.length > 1 ? <Boton variante="fantasma" tamano="chico" soloIcono icono={ChevronRight} etiqueta="Siguiente" disabled={ver.i >= ver.lista.length - 1} onClick={() => setVer({ ...ver, i: ver.i + 1 })} /> : null}
            </div>
          </div>
        ) : null}
      </Modal>
      <Modal
        abierto={confirmar !== null}
        onCerrar={() => setConfirmar(null)}
        titulo="El chat crea las imágenes directo"
        descripcion={`Cada imagen cuesta ~${costo?.dolaresPorImagen ? dinero(costo.dolaresPorImagen) : '…'} (kie). Desde ahora este chat las crea sin preguntar, y cada respuesta te dice cuánto costó.`}
        pie={
          <>
            <Boton variante="fantasma" onClick={() => setConfirmar(null)}>
              Cancelar
            </Boton>
            <Boton variante="primario" onClick={autorizar} disabled={!costo?.dolaresPorImagen}>
              Sí, crear directo
            </Boton>
          </>
        }
      />
      <Modal
        abierto={borrar}
        onCerrar={() => setBorrar(false)}
        icono={Trash2}
        tono="error"
        tamano="chico"
        titulo="¿Borrar este chat?"
        descripcion="Se borra la conversación. Las imágenes siguen en la carpeta del producto."
        pie={
          <>
            <Boton variante="fantasma" onClick={() => setBorrar(false)}>
              Cancelar
            </Boton>
            <Boton
              variante="peligro"
              icono={Trash2}
              onClick={async () => {
                setBorrar(false);
                try {
                  await pedirNuevo(`${BASE}/${id}`, { metodo: 'DELETE' });
                  refrescar('chat-imagenes:lista');
                  ir(rutas.chatImagenes(), { reemplazar: true });
                } catch (e) {
                  setFalla(e.message);
                }
              }}
            >
              Sí, borrarlo
            </Boton>
          </>
        }
      />
    </LoteFunciona.Provider>
  );
}

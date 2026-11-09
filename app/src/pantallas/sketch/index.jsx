// SKETCH DE COMEDIA (#/sketch y #/sketch/<slug>): telenovela que no parece anuncio (skill anuncios-sketch).
//   1. Tu producto, indicaciones, país y acento, oferta, video de referencia y quién escribe el guion
//   2. Claude escribe la propuesta; la lees con su costo y apruebas o pides cambios
//   3. Se hacen las fotos de cada toma (cobra) → las revisas y rehaces la que no te guste
//   4. Los clips con diálogo, el montaje y la revisión (cobra) → dos videos: con y sin música
// Servidor: server/lib/sketch.js.
import { useEffect, useState } from 'react';
import { Check, CircleAlert, CircleStop, Download, Film, ImagePlus, Laugh, LoaderCircle, MessageSquareText, RefreshCw, Sparkles, Wallet } from 'lucide-react';
import { AreaTexto, Boton, CabeceraPagina, CampoTexto, EstadoVacio, Modal, Seccion, Selector, SubirVideo, useAvisos } from '../../componentes/index.js';
import { invalidar, useDatos } from '../../datos/api.js';
import { enlace, ir, rutas } from '../../datos/rutas.js';
import { useSaldo } from '../../datos/saldo.js';
import { Markdown } from '../aprendizajes/Markdown.jsx';
import { OtroProducto } from '../cambiar/index.jsx';
import '../cambiar/cambiar.css';
import './sketch.css';

async function pedir(url, cuerpo, metodo) {
  const r = await fetch(url, cuerpo !== undefined || metodo ? { method: metodo || 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(cuerpo || {}) } : { headers: { Accept: 'application/json' } });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.error || 'Algo salió mal. Vuelve a intentarlo.');
  return d;
}
const usd = (n) => `US$${(Number(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const tiempo = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60 ? `${s % 60} s` : ''}`.trim();
};
const PAISES = [
  'Español de Colombia (paisa)',
  'Español de Colombia (rolo, Bogotá)',
  'Español de Colombia (costeño)',
  'Español de México',
  'Español de Perú',
  'Español de Argentina',
  'Español de Chile',
  'Español de España',
  'Inglés de EE. UU.',
  'Portugués de Brasil',
];
const ETAPA = { escribiendo: 'Escribiendo el guion', revisar: 'Lee la propuesta', produciendo: 'Produciendo', 'revisar-fotos': 'Revisa las fotos', listo: 'Terminado', error: 'Se detuvo' };
const PASOS = [
  { id: 'preparar', texto: 'Preparar lo que necesita (solo la primera vez)' },
  { id: 'refs', texto: 'Los personajes y el lugar' },
  { id: 'frames', texto: 'La foto de cada toma' },
  { id: 'video', texto: 'Los clips con diálogo (de 5 a 15 min)' },
  { id: 'montaje', texto: 'El montaje' },
  { id: 'revision', texto: 'La revisión final' },
];

function useAhora() {
  const [t, setT] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

// ---------------------------------------------------------------- 1. el brief
function Nuevo() {
  const { datos, recargar } = useDatos('productos', () => pedir('/api/productos'));
  const productos = (datos?.productos || []).filter((p) => p.foto);
  const [producto, setProducto] = useState(null);
  const [otro, setOtro] = useState(false);
  const [indicaciones, setIndicaciones] = useState('');
  const [pais, setPais] = useState(PAISES[0]);
  const [oferta, setOferta] = useState('');
  const [video, setVideo] = useState(null);
  const [propio, setPropio] = useState(false);
  const [guion, setGuion] = useState('');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState(null);
  const crear = async () => {
    setCreando(true);
    setError(null);
    try {
      const { slug } = await pedir('/api/sketch', { productoId: producto, indicaciones, pais, oferta, video: String(video || '').replace(/\|.*$/, ''), guionPropio: propio ? guion : '' });
      invalidar('sketches');
      ir(rutas.sketch(slug));
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
          <h3>Tu producto</h3>
          {otro || !productos.length ? (
            <OtroProducto
              alCrear={async (id) => {
                await recargar();
                setProducto(id);
                setOtro(false);
              }}
              alCerrar={() => setOtro(false)}
            />
          ) : null}
          {productos.length ? (
            <div className="cb-productos">
              {productos.map((p) => (
                <button key={p.id} type="button" className={`cb-producto${producto === p.id ? ' cb-producto--activo' : ''}`} onClick={() => setProducto(p.id)} disabled={creando}>
                  <img src={p.foto} alt="" loading="lazy" />
                  <span>{p.nombre}</span>
                </button>
              ))}
              {!otro ? (
                <button type="button" className="cb-producto cb-producto--mas" onClick={() => setOtro(true)} disabled={creando}>
                  <span className="cb-producto__mas">
                    <ImagePlus size={24} aria-hidden="true" />
                  </span>
                  <span>Subir otra foto</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className="cb-paso">
        <span className="cb-paso__n">2</span>
        <div className="cb-paso__cuerpo">
          <h3>Indicaciones</h3>
          <AreaTexto filas={4} value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)} disabled={creando} placeholder="El problema visible que resuelve (lo que otros notan), para quién es, qué no decir… Si lo dejas vacío, la IA lo deduce." />
          <div className="sk-dos">
            <Selector etiqueta="País, idioma y acento" value={pais} onChange={(e) => setPais(e.target.value)} opciones={PAISES.map((p) => ({ valor: p, etiqueta: p }))} disabled={creando} />
            <CampoTexto etiqueta="Oferta" opcional value={oferta} onChange={(e) => setOferta(e.target.value)} maxLength={300} disabled={creando} placeholder="Contraentrega, envío gratis, 2×1…" />
          </div>
        </div>
      </div>
      <div className="cb-paso">
        <span className="cb-paso__n">3</span>
        <div className="cb-paso__cuerpo">
          <h3>
            Video de referencia <span className="sk-opcional">opcional</span>
          </h3>
          <SubirVideo valor={video} onCambio={setVideo} deshabilitado={creando} />
        </div>
      </div>
      <div className="cb-paso">
        <span className="cb-paso__n">4</span>
        <div className="cb-paso__cuerpo">
          <h3>¿Quién escribe el guion?</h3>
          <div className="sk-segmentos" role="radiogroup">
            {[
              [false, 'La IA'],
              [true, 'Lo escribo yo'],
            ].map(([v, t]) => (
              <button key={t} type="button" role="radio" aria-checked={propio === v} className={`sk-segmento${propio === v ? ' sk-segmento--sel' : ''}`} onClick={() => setPropio(v)} disabled={creando}>
                {t}
              </button>
            ))}
          </div>
          {propio ? <AreaTexto filas={6} value={guion} onChange={(e) => setGuion(e.target.value)} disabled={creando} placeholder="Escribe o pega tu guion: la IA respeta tus palabras y le pone cámara y actuación." /> : null}
        </div>
      </div>
      {error ? (
        <p className="cb-error" role="alert">
          <CircleAlert size={14} aria-hidden="true" /> {error}
        </p>
      ) : null}
      <div className="fila" style={{ '--hueco': '12px', alignItems: 'center' }}>
        <Boton variante="primario" tamano="grande" icono={Sparkles} disabled={!producto || (propio && !guion.trim())} cargando={creando} onClick={crear}>
          Escribir el guion
        </Boton>
        <span className="cb-nota">Escribirlo no cuesta nada. Antes de generar, ves el costo y apruebas.</span>
      </div>
    </div>
  );
}

function Lista() {
  const { datos } = useDatos('sketches', () => pedir('/api/sketch'), { cadaMs: 8000 });
  const lista = datos?.sketches || [];
  if (!lista.length) return null;
  return (
    <Seccion titulo="Tus sketches" contador={lista.length}>
      <div className="cb-lista">
        {lista.map((t) => (
          <a key={t.slug} className="cb-item" href={`#${rutas.sketch(t.slug)}`}>
            <span className="cb-item__img">
              <Laugh size={22} aria-hidden="true" />
            </span>
            <span className="cb-item__texto">
              <strong>{t.titulo || t.producto}</strong>
              <span className={`cb-etapa cb-etapa--${t.etapa === 'revisar-fotos' ? 'revisar' : t.etapa}`}>{ETAPA[t.etapa] || t.etapa}</span>
            </span>
          </a>
        ))}
      </div>
    </Seccion>
  );
}

// ---------------------------------------------------------------- el detalle
function Avance({ s }) {
  const ahora = useAhora();
  if (s.etapa === 'escribiendo') {
    return (
      <div className="cb-avance">
        <div className="cb-avance__cabeza">
          <strong>Claude está escribiendo el guion</strong>
          <span>Lleva {tiempo(ahora - (Date.parse(s.actualizado) || Date.parse(s.creado) || ahora))} · suele tardar de 5 a 15 min · puedes cerrar esta página</span>
        </div>
        {s.progreso?.length ? <p className="cb-avance__detalle">{s.progreso[s.progreso.length - 1]}</p> : null}
      </div>
    );
  }
  const actual = s.paso;
  const hechos = new Set(s.hechos || []);
  const visibles = PASOS.filter((p) => p.id !== 'preparar' || actual?.id === 'preparar' || hechos.has('preparar'));
  return (
    <div className="cb-avance">
      <div className="cb-avance__cabeza">
        <strong>Produciendo tu sketch</strong>
        <span>Puedes cerrar esta página: sigue solo</span>
      </div>
      <ol className="cb-pasos">
        {visibles.map((p, i) => {
          const esActual = p.id === actual?.id;
          const hecho = !esActual && hechos.has(p.id);
          const lleva = esActual ? ahora - (Date.parse(actual.desde) || ahora) : 0;
          const pct = esActual && typeof actual.pct === 'number' ? actual.pct : null;
          return (
            <li key={p.id} className={`cb-paso-av${esActual ? ' cb-paso-av--actual' : ''}${hecho ? ' cb-paso-av--hecho' : ''}`}>
              <span className="cb-paso-av__marca" aria-hidden="true">
                {hecho ? <Check size={13} strokeWidth={3} /> : esActual ? <LoaderCircle size={14} className="girando" /> : i + 1}
              </span>
              <div className="cb-paso-av__cuerpo">
                <span className="cb-paso-av__texto">{p.texto}</span>
                {esActual ? (
                  <>
                    {pct !== null ? (
                      <span className="cb-barra" aria-hidden="true">
                        <span style={{ width: `${Math.round(pct * 100)}%` }} />
                      </span>
                    ) : null}
                    <span className="cb-paso-av__detalle">
                      {actual.detalle ? `${actual.detalle} · ` : ''}
                      lleva {tiempo(lleva)}
                      {pct && pct > 0.05 && pct < 1 ? ` · faltan ~${tiempo((lleva / pct) * (1 - pct))}` : ''}
                    </span>
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Costo({ s }) {
  const { datos: saldo } = useSaldo();
  const c = s.costo;
  if (!c) return <p className="cb-nota">No pude calcular el costo ahora (falta Python): se calcula al producir.</p>;
  const kie = saldo?.kie;
  const sem = kie?.creditos == null ? null : kie.creditos < c.creditos ? 'corto' : kie.creditos - c.creditos >= Math.max(c.creditos * 0.5, 200) ? 'sobra' : 'justo';
  return (
    <div className={`costo costo--${sem || 'nada'}`}>
      <span className="costo__titulo">
        <Wallet size={15} aria-hidden="true" /> Costo aproximado del sketch
      </span>
      <div className="costo__grande">
        ~{usd(c.dolares)} <em>· {c.creditos} créditos de kie.ai</em>
      </div>
      <span className="costo__nota">
        Fotos {c.imagenes} créditos · clips {c.video} créditos · más un {c.margen} por si hay que repetir algo. La música y el montaje son gratis.
      </span>
      {kie?.dolares != null ? (
        <span className={`costo-saldo costo-saldo--${sem || 'nada'}`}>
          <span className="costo-saldo__punto" aria-hidden="true" />
          Tu saldo de kie: <strong>{usd(kie.dolares)}</strong>
          {sem ? <span> · {sem === 'sobra' ? 'Alcanza de sobra' : sem === 'justo' ? 'Alcanza justo: recarga pronto' : 'No alcanza: recarga en kie.ai'}</span> : null}
        </span>
      ) : null}
    </div>
  );
}

function Detalle({ slug }) {
  const { aviso } = useAvisos();
  const { datos: s, error, recargar } = useDatos(`sketch:${slug}`, () => pedir(`/api/sketch/${encodeURIComponent(slug)}`), { cadaMs: 4000 });
  const [cambios, setCambios] = useState('');
  const [verCambios, setVerCambios] = useState(false);
  const [confirmar, setConfirmar] = useState(null); // 'fotos' | 'producir' | 'rehacer'
  const [marcadas, setMarcadas] = useState([]);
  const [ocupado, setOcupado] = useState(false);
  if (error) return <EstadoVacio icono={CircleAlert} tono="peligro" titulo="No encuentro este sketch" descripcion={error.message} acciones={<Boton href={enlace.sketch()}>Volver</Boton>} />;
  if (!s) return <p className="cb-nota">Cargando…</p>;

  const accion = async (que, cuerpo) => {
    setOcupado(true);
    try {
      await pedir(`/api/sketch/${encodeURIComponent(slug)}/${que}`, cuerpo || {});
      await recargar();
      if (que === 'cambios') {
        setCambios('');
        setVerCambios(false);
      }
      if (que === 'rehacer-fotos') setMarcadas([]);
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No se pudo', texto: e.message });
    } finally {
      setOcupado(false);
    }
  };
  const trabajando = ['escribiendo', 'produciendo'].includes(s.etapa);
  const clipsListos = (s.tomas || []).filter((t) => !t.tarjeta && !t.imagenFija).every((t) => t.clip);
  const c = s.costo;
  const fotosPorToma = c ? Math.max(1, Math.round(c.imagenes / Math.max(1, (s.personajes?.length || 0) + 1 + (s.tomas?.filter((t) => !t.tarjeta).length || 1)))) : 10;
  const costoFotos = c ? Math.round(c.imagenes * 1.15) : null;
  const costoClips = c ? Math.round(c.video * 1.15) : null;
  const COSTOS = {
    fotos: { titulo: '¿Hacer las fotos de cada toma?', creditos: costoFotos, texto: 'Primero los personajes y el lugar, después la foto de cada toma. Las revisas antes de hacer los clips.' },
    producir: { titulo: '¿Hacer los clips y el video?', creditos: costoClips, texto: 'Cada toma se anima con su diálogo (de 5 a 15 minutos), se monta con la música y se revisa. Salen dos videos: con y sin música.' },
    rehacer: { titulo: `¿Rehacer ${marcadas.length === 1 ? 'esa foto' : `esas ${marcadas.length} fotos`}?`, creditos: fotosPorToma * marcadas.length, texto: 'La de antes queda guardada.' },
  };

  return (
    <div className="cb-detalle">
      <div className="cb-cabeza">
        {s.producto_foto ? <img className="cb-cabeza__producto" src={s.producto_foto} alt="Tu producto" /> : null}
        <div className="pila" style={{ '--hueco': '10px', flex: 1, minWidth: 0 }}>
          <span className={`cb-etapa cb-etapa--${s.etapa === 'revisar-fotos' ? 'revisar' : s.etapa}`}>
            {trabajando ? <LoaderCircle size={13} className="girando" aria-hidden="true" /> : null}
            {ETAPA[s.etapa] || s.etapa}
          </span>
          <h2 className="cb-cabeza__titulo">{s.titulo || s.producto}</h2>
          {trabajando ? <Avance s={s} /> : null}
          {s.etapa === 'produciendo' ? (
            <div>
              <Boton variante="fantasma" tamano="chico" icono={CircleStop} onClick={() => window.confirm('¿Detener? Lo que ya está hecho queda guardado y no se vuelve a pagar.') && accion('detener')}>
                Detener
              </Boton>
            </div>
          ) : null}
          {s.etapa === 'error' ? (
            <div className="pila" style={{ '--hueco': '8px' }}>
              <p className="cb-error" role="alert">
                <CircleAlert size={14} aria-hidden="true" /> {s.causa?.porque || s.error}
              </p>
              {s.causa?.dijo ? <p className="cb-nota">kie.ai respondió: «{s.causa.dijo}»</p> : null}
              {s.causa?.tomas?.length ? (
                <div className="sk-malas">
                  {s.causa.tomas.map((m) => (
                    <div key={m.id} className="sk-mala">
                      <span>
                        <strong>{m.id}</strong> · guion: «{m.guion}» · se oyó: «{m.oido || '(nada)'}»
                      </span>
                      <Boton tamano="chico" icono={RefreshCw} disabled={ocupado} onClick={() => window.confirm(`¿Rehacer el clip de ${m.id}? Cuesta un clip (~US$0,30–0,60). Después el video se arma solo.`) && accion('rehacer-clips', { ids: [m.id] })}>
                        Rehacer este clip
                      </Boton>
                    </div>
                  ))}
                </div>
              ) : null}
              {s.causa?.hacer?.length ? (
                <ul className="sk-hacer">
                  {s.causa.hacer.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              ) : null}
              <div>
                <Boton icono={RefreshCw} onClick={() => accion('reintentar')} cargando={ocupado}>
                  Reintentar
                </Boton>
              </div>
            </div>
          ) : null}
          {s.aviso && !trabajando && s.etapa !== 'error' ? <p className="cb-nota">{s.aviso}</p> : null}
        </div>
      </div>

      {s.salidas?.length ? (
        <Seccion titulo="Tu sketch" icono={Film}>
          <div className="cb-salidas">
            {s.salidas.map((x) => (
              <div key={x.tipo} className="cb-salida">
                <video src={x.url} controls playsInline preload="metadata" />
                <div className="fila" style={{ '--hueco': '8px', justifyContent: 'space-between' }}>
                  <span>{x.nombre}</span>
                  <Boton tamano="chico" icono={Download} href={x.url} download={x.archivo}>
                    Descargar
                  </Boton>
                </div>
              </div>
            ))}
          </div>
          {s.gastado ? <p className="cb-nota">Costó {usd(s.gastado.dolares)} ({s.gastado.creditos} créditos de kie.ai).</p> : null}
        </Seccion>
      ) : null}

      {s.etapa === 'revisar-fotos' || (s.tomas?.some((t) => t.foto) && s.etapa !== 'revisar') ? (
        <Seccion titulo="Las fotos de cada toma" descripcion={s.etapa === 'revisar-fotos' ? 'Míralas antes de hacer los clips: marca las que quieras rehacer.' : null} contador={s.tomas.filter((t) => t.foto).length}>
          <div className="cb-tomas">
            {s.tomas
              .filter((t) => !t.tarjeta)
              .map((t) => {
                const sel = marcadas.includes(t.id);
                return (
                  <div key={t.id} className={`cb-toma${sel ? ' cb-toma--marcada' : ''}`}>
                    <button type="button" className="cb-toma__img" disabled={s.etapa !== 'revisar-fotos' || !t.foto} onClick={() => setMarcadas((m) => (sel ? m.filter((x) => x !== t.id) : [...m, t.id]))} aria-pressed={sel}>
                      {t.clip ? <video src={t.clip} muted loop playsInline preload="metadata" onMouseEnter={(e) => e.currentTarget.play()} onMouseLeave={(e) => e.currentTarget.pause()} /> : t.foto ? <img src={t.foto} alt={t.id} loading="lazy" /> : null}
                      <span className="cb-toma__tiempo">{t.id}</span>
                      {sel ? <span className="cb-toma__marca">Rehacer</span> : null}
                    </button>
                    {t.linea ? <p className="cb-toma__dice">«{t.linea}»</p> : null}
                  </div>
                );
              })}
          </div>
        </Seccion>
      ) : null}

      {s.guion && ['revisar', 'revisar-fotos', 'produciendo', 'listo', 'error'].includes(s.etapa) ? (
        <Seccion titulo="La propuesta" icono={MessageSquareText}>
          <div className="sk-guion">
            <Markdown texto={s.guion} />
          </div>
        </Seccion>
      ) : null}

      {s.etapa === 'revisar' ? (
        <div className="cb-acciones sk-acciones">
          <Costo s={s} />
          <div className="fila" style={{ '--hueco': '10px', flexWrap: 'wrap' }}>
            <Boton variante="primario" tamano="grande" icono={Sparkles} disabled={ocupado} onClick={() => setConfirmar('fotos')}>
              Me gusta: hacer las fotos
            </Boton>
            <Boton icono={MessageSquareText} onClick={() => setVerCambios(!verCambios)} disabled={ocupado}>
              Pedir cambios
            </Boton>
          </div>
          {verCambios ? (
            <div className="pila" style={{ '--hueco': '8px' }}>
              <AreaTexto filas={3} value={cambios} onChange={(e) => setCambios(e.target.value)} placeholder="Qué cambiar: una línea, un personaje, el lugar, el remate…" />
              <div>
                <Boton variante="primario" tamano="chico" disabled={!cambios.trim()} cargando={ocupado} onClick={() => accion('cambios', { pedido: cambios })}>
                  Pedir el cambio
                </Boton>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {s.etapa === 'revisar-fotos' ? (
        <div className="cb-acciones sk-acciones">
          <div className="fila" style={{ '--hueco': '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Boton variante="primario" tamano="grande" icono={Film} disabled={ocupado || marcadas.length > 0} onClick={() => (clipsListos ? accion('producir') : setConfirmar('producir'))}>
              {clipsListos ? 'Armar el video (los clips ya están: no cobra)' : 'Se ven bien: hacer los clips y el video'}
            </Boton>
            {marcadas.length ? (
              <Boton icono={RefreshCw} disabled={ocupado} onClick={() => setConfirmar('rehacer')}>
                Rehacer {marcadas.length === 1 ? 'la marcada' : `las ${marcadas.length} marcadas`}
              </Boton>
            ) : null}
            {c && !clipsListos ? <span className="cb-nota">Los clips cuestan ~{usd(costoClips * 0.005)} ({costoClips} créditos).</span> : null}
          </div>
        </div>
      ) : null}

      {s.revision && s.etapa === 'listo' ? (
        <details className="sk-revision">
          <summary>Lo que encontró la revisión</summary>
          <Markdown texto={s.revision} />
        </details>
      ) : null}

      <Modal
        abierto={Boolean(confirmar)}
        onCerrar={() => setConfirmar(null)}
        icono={Sparkles}
        titulo={confirmar ? COSTOS[confirmar].titulo : ''}
        descripcion={confirmar ? COSTOS[confirmar].texto : ''}
        pie={
          <>
            <Boton variante="fantasma" onClick={() => setConfirmar(null)}>
              Cancelar
            </Boton>
            <Boton
              variante="primario"
              icono={Sparkles}
              onClick={() => {
                const que = confirmar;
                setConfirmar(null);
                if (que === 'fotos') accion('fotos');
                else if (que === 'producir') accion('producir');
                else accion('rehacer-fotos', { ids: marcadas });
              }}
            >
              Sí, hacerlo{confirmar && COSTOS[confirmar].creditos != null ? ` (~${usd(COSTOS[confirmar].creditos * 0.005)})` : ''}
            </Boton>
          </>
        }
      >
        {confirmar && COSTOS[confirmar].creditos != null ? <p className="t-chico">Cuesta ~{COSTOS[confirmar].creditos} créditos de kie.ai. Lo que ya está hecho no se vuelve a pagar.</p> : null}
      </Modal>
    </div>
  );
}

export default function Sketch({ params }) {
  const slug = params?.slug;
  return (
    <div className="pila" style={{ '--hueco': 'var(--e-8)' }}>
      <CabeceraPagina
        sobretitulo="Crear"
        titulo="Sketch de comedia"
        descripcion="Una telenovela de 1 minuto que no parece anuncio: se burlan del problema, alguien le pasa tu producto como un secreto y remata con el link."
        acciones={slug ? <Boton href={enlace.sketch()}>Otro sketch</Boton> : null}
      />
      {slug ? (
        <Detalle slug={slug} />
      ) : (
        <>
          <Nuevo />
          <Lista />
        </>
      )}
    </div>
  );
}

// Panel izquierdo, como el de CapCut: los clips del anuncio, la música, los estilos de subtítulos y
// los textos en pantalla.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Archive, Captions, Check, Film, ImagePlus, Music, Pause, Play, Plus, Type, Upload, X } from 'lucide-react';
import { Boton, EstadoVacio, Insignia, Interruptor, MiniaturaVideo, Tooltip, VistaPrevia, useAvisos } from '../../componentes/index.js';
import { useDatos } from '../../datos/api.js';
import { codigoDeTiempo, duracion as formatoDuracion } from '../../datos/formato.js';
import { RejillaEstilos } from './Galeria.jsx';

const HERRAMIENTAS = [
  { id: 'medios', etiqueta: 'Medios', icono: Film },
  { id: 'musica', etiqueta: 'Música', icono: Music },
  { id: 'subtitulos', etiqueta: 'Subtítulos', icono: Captions },
  { id: 'textos', etiqueta: 'Textos', icono: Type },
];

function Grupo({ titulo, contador, extra, children }) {
  return (
    <section className="ed-grupo">
      <header className="ed-grupo__cabecera">
        <h3 className="ed-grupo__titulo">
          {titulo}
          {contador !== undefined ? <span className="ed-grupo__contador t-num">{contador}</span> : null}
        </h3>
        {extra}
      </header>
      {children}
    </section>
  );
}

export function ZonaSoltar({ onArchivo, onClick, titulo = 'Arrastra tu canción', detalle = 'MP3, WAV o M4A · o haz clic para elegirla', compacta = false }) {
  const [encima, setEncima] = useState(false);
  return (
    <button
      type="button"
      className={`ed-soltar${encima ? ' es-encima' : ''}${compacta ? ' ed-soltar--compacta' : ''}`}
      onClick={onClick}
      onDragOver={(e) => {
        e.preventDefault();
        setEncima(true);
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setEncima(false);
        onArchivo?.(e.dataTransfer.files?.[0]);
      }}
    >
      <span className="ed-soltar__icono" aria-hidden="true">
        <Upload size={18} strokeWidth={2} />
      </span>
      <span className="ed-soltar__titulo">{titulo}</span>
      <span className="ed-soltar__detalle">{detalle}</span>
    </button>
  );
}

// ---------------------------------------------------------------- un solo reproductor para escuchar la biblioteca

let escucha = null;
function useEscucha() {
  const [sonando, setSonando] = useState(null);
  useEffect(
    () => () => {
      escucha?.pause();
    },
    []
  );
  const alternar = (url, alEmpezar) => {
    if (!escucha) escucha = new Audio();
    if (sonando === url) {
      escucha.pause();
      setSonando(null);
      return;
    }
    escucha.src = url;
    escucha.volume = 0.7;
    escucha.currentTime = 0;
    escucha.onended = () => setSonando(null);
    escucha.play().then(
      () => {
        alEmpezar?.();
        setSonando(url);
      },
      () => setSonando(null)
    );
  };
  const parar = () => {
    escucha?.pause();
    setSonando(null);
  };
  return { sonando, alternar, parar };
}

// ---------------------------------------------------------------- pestañas

function Medios({ a, plan, pistas, onIr, seleccion, reh }) {
  const { aviso } = useAvisos();
  // lo que notó la revisión en un clip (si no es tu video: ese aviso es del clip de la app, que ahí no se ve)
  const avisoDe = (c) => (c.pieza && !c.reemplazado ? reh?.porPieza?.[c.pieza]?.aviso || null : null);
  const vistos = new Set();
  const clips = [];
  for (const v of pistas.video) {
    if (!v.clip || vistos.has(v.archivo)) continue;
    vistos.add(v.archivo);
    clips.push({ ...v, pista: 'video' });
  }
  for (const b of pistas.broll) {
    if (b.tipo !== 'broll' || vistos.has(b.archivo)) continue;
    vistos.add(b.archivo);
    clips.push({ ...b, pista: 'broll' });
  }
  const fuera = new Set(plan.brollFuera || []);
  const sinUsar = (a.broll || []).filter((b) => fuera.has(b.n) && (b.clip || b.imagen));

  return (
    <div className="ed-medios">
      <Grupo titulo="Clips del anuncio" contador={clips.length}>
        <div className="ed-medios__rejilla">
          {clips.map((c) => (
            <MiniaturaVideo
              key={`${c.pista}-${c.id}`}
              imagen={c.foto}
              video={c.clip}
              duracion={c.largo || c.fin - c.inicio}
              titulo={c.nombre}
              subtitulo={codigoDeTiempo(c.inicio).replace(/\.\d+$/, '')}
              anchoImagen={240}
              seleccionada={seleccion?.pista === c.pista && seleccion?.id === c.id}
              onClick={() => onIr(c.pista, c)}
              insignia={avisoDe(c) ? <Insignia estado="aviso" variante="vidrio" tamano="chico" /> : undefined}
              title={avisoDe(c) ? `La revisión notó: ${avisoDe(c).texto}` : undefined}
            />
          ))}
        </div>
      </Grupo>

      {sinUsar.length ? (
        <Grupo titulo="Sin usar" contador={sinUsar.length}>
          <p className="ed-medios__nota">
            <Archive size={13} strokeWidth={2} aria-hidden="true" />
            Se generaron y no entraron en el montaje: quedan en la carpeta del anuncio.
          </p>
          <div className="ed-medios__rejilla">
            {sinUsar.map((b) => (
              <MiniaturaVideo
                key={b.n}
                imagen={b.imagen}
                video={b.clip}
                duracion={b.duracionClip}
                titulo={`Imagen de apoyo ${b.n}`}
                subtitulo={b.sincronizaCon ? `«${b.sincronizaCon}»` : 'Sin usar'}
                anchoImagen={240}
                atenuada
              />
            ))}
          </div>
        </Grupo>
      ) : null}

    </div>
  );
}

function PestanaMusica({ slug, pistas, ed, acciones, playerRef }) {
  const { datos } = useDatos(`editor-musicas:${slug}`, () => fetch(`/api/editor/musicas?excepto=${encodeURIComponent(slug)}`).then((r) => (r.ok ? r.json() : { musicas: [] })));
  const { sonando, alternar, parar } = useEscucha();
  const musica = pistas.musica;
  const esCancion = pistas.voz?.modo === 'cancion';
  const lista = datos?.musicas || [];

  if (esCancion) {
    return (
      <EstadoVacio
        variante="compacto"
        icono={Music}
        titulo="La canción es el anuncio"
        descripcion="En los musicales no hay música aparte y la canción no se cambia. Su volumen sí: está en Cambios rápidos."
      />
    );
  }

  return (
    <div className="ed-pestana-musica">
      <Grupo titulo="En el anuncio">
        {musica ? (
          <div className="ed-musica ed-musica--tarjeta">
            <span className="ed-musica__disco ed-musica__disco--grande" aria-hidden="true">
              <Music size={18} strokeWidth={2} />
            </span>
            <span className="ed-musica__textos">
              <span className="ed-musica__nombre t-recortar">{musica.falta ? 'Falta tu canción' : musica.nombre}</span>
              <span className="ed-musica__origen">
                {musica.fuente === 'propia' ? 'Tu canción' : musica.fuente === 'biblioteca' ? `De «${musica.origen}»` : 'La eligió la IA'}
                {musica.duracion ? ` · ${formatoDuracion(musica.duracion)}` : ''}
              </span>
            </span>
            {musica.fuente !== 'original' && !musica.falta ? (
              <Boton variante="fantasma" tamano="chico" onClick={acciones.musicaOriginal}>
                Volver a la original
              </Boton>
            ) : null}
          </div>
        ) : (
          <p className="ed-medios__nota">Ahora no suena música. Arrastra una tuya o elige una de abajo.</p>
        )}
      </Grupo>

      <Grupo titulo="Tu música">
        <ZonaSoltar onArchivo={acciones.usarArchivo} onClick={acciones.pedirMusica} />
      </Grupo>

      <Grupo titulo="De tus otros anuncios" contador={lista.length}>
        <p className="ed-medios__nota">La música de tus otros anuncios, lista para usar en este.</p>
        <ul className="ed-biblioteca">
          {lista.map((m) => {
            const enUso = ed.musica.fuente === 'biblioteca' && ed.musica.url === m.url;
            const suena = sonando === m.url;
            return (
              <li key={m.slug} className={`ed-biblioteca__fila${enUso ? ' es-uso' : ''}`}>
                <Tooltip texto={suena ? 'Parar' : 'Escuchar'}>
                  <button
                    type="button"
                    className={`ed-biblioteca__escuchar${suena ? ' es-sonando' : ''}`}
                    aria-label={suena ? `Parar ${m.titulo}` : `Escuchar la música de ${m.titulo}`}
                    onClick={() => alternar(m.url, () => playerRef.current?.pause())}
                  >
                    {suena ? <Pause size={14} strokeWidth={2.4} /> : <Play size={14} strokeWidth={2.4} />}
                    {suena ? (
                      <span className="ed-biblioteca__barras" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                    ) : null}
                  </button>
                </Tooltip>
                <span className="ed-biblioteca__textos">
                  <span className="ed-biblioteca__titulo t-recortar">{m.titulo}</span>
                  <span className="ed-biblioteca__meta">
                    {m.estilo || 'Música de fondo'}
                    {m.duracion ? ` · ${formatoDuracion(m.duracion)}` : ''}
                  </span>
                </span>
                {enUso ? (
                  <span className="ed-biblioteca__uso">
                    <Check size={12} strokeWidth={3} aria-hidden="true" /> En uso
                  </span>
                ) : (
                  <Boton
                    variante="secundario"
                    tamano="chico"
                    onClick={() => {
                      parar();
                      acciones.usarBiblioteca(m);
                    }}
                  >
                    Usar
                  </Boton>
                )}
              </li>
            );
          })}
        </ul>
      </Grupo>
    </div>
  );
}

function PestanaTextos({ pistas, ed, cambiar, onIr, acciones }) {
  const textos = pistas.textos;
  const elegirImagen = useRef(null);
  const agregar = (
    <>
      <Boton variante="secundario" tamano="chico" icono={Plus} bloque onClick={acciones.agregarTexto}>
        Agregar texto en el cursor
      </Boton>
      <Boton variante="secundario" tamano="chico" icono={ImagePlus} bloque onClick={() => elegirImagen.current?.click()}>
        Agregar imagen en el cursor
      </Boton>
      <input
        ref={elegirImagen}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) acciones.agregarImagen(f);
        }}
      />
      <p className="ed-medios__nota">Arrastra los textos y las imágenes en el video para moverlos.</p>
    </>
  );
  if (!textos.length) {
    return (
      <div className="ed-pestana-textos">
        {agregar}
        <EstadoVacio variante="compacto" icono={Type} titulo="Sin textos ni imágenes" descripcion="Agrega un texto (su color, fondo, tamaño y letra) o una imagen, y muévelos con el mouse en el video." />
      </div>
    );
  }
  const sugeridos = textos.some((x) => x.tipo === 'sugerido');
  const fijos = textos.some((x) => x.fijo);
  return (
    <div className="ed-pestana-textos">
      {agregar}
      {sugeridos ? (
        <p className="ed-medios__nota">La IA sugirió algunos al escribir el guion. En el video entregado no van: actívalos si los quieres.</p>
      ) : fijos ? (
        <p className="ed-medios__nota">Los iconos los pone el estilo de este anuncio, en el momento justo.</p>
      ) : null}
      <ul className="ed-textos">
        {textos.map((x) => (
          <li key={x.id} className={`ed-textos__fila${x.visible || x.fijo ? ' es-visible' : ''}`}>
            <button type="button" className="ed-textos__ir" onClick={() => onIr('textos', x)}>
              {x.imagen ? <img src={x.imagen} alt="" className="ed-textos__icono" /> : <span className="ed-textos__t" aria-hidden="true"><Type size={13} strokeWidth={2.4} /></span>}
              <span className="ed-textos__textos">
                <span className="ed-textos__texto">{x.texto}</span>
                <span className="ed-textos__tiempo t-mono">{codigoDeTiempo(x.inicio).replace(/\.\d+$/, '')}</span>
              </span>
            </button>
            {x.tipo === 'sugerido' ? (
              <Interruptor
                tamano="chico"
                activado={x.visible}
                etiqueta={<span className="visualmente-oculto">Mostrar «{x.texto}» en el video</span>}
                onCambio={(v) => cambiar((s) => ({ ...s, textos: v ? [...s.textos, x.id] : s.textos.filter((y) => y !== x.id) }), { etiqueta: v ? 'Mostrar texto' : 'Ocultar texto' })}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- el panel

// Ventanas de menos de 1366 de ancho: el panel es una columna de iconos y su contenido se abre encima
// del video (así la vista previa no se achica).
const CONSULTA_RIEL = '(max-width: 1365px)';
function useRiel() {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(CONSULTA_RIEL);
      mq.addEventListener('change', avisar);
      return () => mq.removeEventListener('change', avisar);
    },
    () => window.matchMedia(CONSULTA_RIEL).matches,
    () => false
  );
}

export function PanelMedios({ a, plan, pistas, ed, cambiar, acciones, pestana, onPestana, abierto = false, onAbrir, playerRef, seleccion, onIr, galeria }) {
  const cuerpo = useRef(null);
  const panel = useRef(null);
  const riel = useRiel();
  const flotante = riel && abierto;
  useEffect(() => {
    cuerpo.current?.scrollTo?.({ top: 0 });
  }, [pestana]);

  // abierto encima del video: se cierra al tocar afuera o con Escape
  useEffect(() => {
    if (!flotante) return undefined;
    const afuera = (e) => {
      if (panel.current && !panel.current.contains(e.target)) onAbrir?.(false);
    };
    const tecla = (e) => {
      if (e.key === 'Escape') onAbrir?.(false);
    };
    document.addEventListener('pointerdown', afuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', afuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [flotante, onAbrir]);

  const tocar = (id) => {
    if (!riel) return onPestana(id);
    if (pestana === id && abierto) return onAbrir?.(false);
    onPestana(id);
    onAbrir?.(true);
  };
  const actual = HERRAMIENTAS.find((h) => h.id === pestana);

  return (
    <aside ref={panel} className={`ed-panel ed-panel--medios${riel ? ' es-riel' : ''}${flotante ? ' es-abierto' : ''}`} aria-label="Medios">
      <div className="ed-herramientas" role="tablist" aria-label="Herramientas">
        {HERRAMIENTAS.map(({ id, etiqueta, icono: Icono }) => {
          const activa = pestana === id && (!riel || abierto);
          const boton = (
            <button key={id} type="button" role="tab" aria-selected={activa} aria-label={etiqueta} className={`ed-herramienta${activa ? ' es-activa' : ''}`} onClick={() => tocar(id)}>
              <Icono size={18} strokeWidth={2} aria-hidden="true" />
              <span>{etiqueta}</span>
            </button>
          );
          return riel ? (
            <Tooltip key={id} texto={etiqueta} lado="derecha">
              {boton}
            </Tooltip>
          ) : (
            boton
          );
        })}
      </div>
      <div className="ed-panel__cuerpo" ref={cuerpo} role="tabpanel" aria-label={actual?.etiqueta}>
        {riel ? (
          <div className="ed-panel__flotante-cabecera">
            <span>{actual?.etiqueta}</span>
            <button type="button" className="ed-panel__cerrar" onClick={() => onAbrir?.(false)} aria-label="Cerrar el panel">
              <X size={16} strokeWidth={2.2} />
            </button>
          </div>
        ) : null}
        {pestana === 'medios' ? <Medios a={a} plan={plan} pistas={pistas} onIr={onIr} seleccion={seleccion} reh={acciones?.reh} /> : null}
        {pestana === 'musica' ? <PestanaMusica slug={a.slug} pistas={pistas} ed={ed} acciones={acciones} playerRef={playerRef} /> : null}
        {pestana === 'subtitulos' ? (
          pistas.subtitulos.length && galeria?.muestra ? (
            <div className="ed-pestana-subtitulos">
              <p className="ed-medios__nota">Toca un estilo y míralo en el video. El sistema entrega siempre Caja.</p>
              <RejillaEstilos compacta actual={ed.subtitulos.estilo} onElegir={acciones.elegirEstilo} {...galeria} />
            </div>
          ) : (
            <EstadoVacio variante="compacto" icono={Captions} titulo="Sin subtítulos" descripcion="Este anuncio no trae subtítulos para cambiar." />
          )
        ) : null}
        {pestana === 'textos' ? <PestanaTextos pistas={pistas} ed={ed} cambiar={cambiar} onIr={onIr} acciones={acciones} /> : null}
      </div>
    </aside>
  );
}

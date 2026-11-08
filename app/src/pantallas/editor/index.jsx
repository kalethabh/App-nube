// EDITOR (#/anuncio/:slug/editor), con apariencia de CapCut y sin una línea de código a la vista.
//
// La vista previa es LA MISMA composición que se exporta: "AnuncioEditado" (remotion/src/edicion/), que
// dibuja remotion/src/Anuncio.jsx y le suma encima las capas del editor (subtítulos con estilo, música, voz
// con volumen, textos), dentro de @remotion/player. Para que staticFile('video/toma-1.mp4') del plan apunte
// a los archivos del anuncio, antes de dibujar el Player se fija
// window.remotion_staticBase = anuncio.base ("/archivos/anuncio/<slug>").
//
// Los cambios se guardan en la carpeta del anuncio y en este navegador (estado.js). Exportar arma un MP4
// nuevo en esta PC (gratis) y "Rehacer con IA" vuelve a generar un clip (lo único que cuesta); los dos los
// corre la app y siguen aunque se cierre el editor (trabajos.js). Sin precios en el editor.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Player } from '@remotion/player';
import { prefetch, staticFile } from 'remotion';
import {
  ArrowLeft,
  Check,
  Download,
  Keyboard,
  LoaderCircle,
  Maximize,
  Music,
  Pause,
  Play,
  Redo2,
  RefreshCw,
  ScanLine,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
  TriangleAlert,
  Undo2,
  Volume2,
  VolumeX,
  Clapperboard,
} from 'lucide-react';
import { Boton, Chip, EstadoVacio, Esqueleto, Logo, Tooltip, useAvisos } from '../../componentes/index.js';
import { useAnuncio } from '../../datos/api.js';
import { enlace } from '../../datos/rutas.js';
import { codigoDeTiempo, duracion as formatoDuracion } from '../../datos/formato.js';
import { AnuncioEditado } from '@composicion/edicion/AnuncioEditado.jsx';
import { LineaDeTiempo } from './LineaDeTiempo.jsx';
import { PanelCambios } from './PanelCambios.jsx';
import { PanelMedios } from './PanelMedios.jsx';
import { GaleriaSubtitulos } from './Galeria.jsx';
import { ModalExportar } from './ModalExportar.jsx';
import { ModalRehacer } from './ModalRehacer.jsx';
import { EditorSubtitulo } from './EditorSubtitulo.jsx';
import { Globo } from './piezas.jsx';
import { picosDe } from './ondas.js';
import { INICIAL, guardarCancionPropia, leerCancionPropia, registrarUrlMusica, tieneCambios, urlMusica, useEdicion } from './estado.js';
import { ALTO, ANCHO, FPS, construirPistas, contextoDeVista, mediosDelPlan, modoVoz, muestraDeGaleria, subtitulosEditados } from './modelo.js';
import { exportacionEnMarcha, rehacerEnMarcha, useExportacion, useRehacer } from './trabajos.js';
import { operar, agregarTexto as textoNuevo, ajustarTexto as cambiarTexto, ajustarTramo as cambiarTramo } from './cortes.js';
import { ESTILO_POR_ID } from './subtitulos/estilos.jsx';
import { marcarClaves, palabrasDeMarca } from './subtitulos/claves.js';
import { cargarFuentesSubtitulos } from './subtitulos/fuentes.js';
import './editor.css';
import './linea-tiempo.css';

// ---------------------------------------------------------------- piezas de la pantalla

function Transporte({ playerRef, listo, duracion, extra, precarga }) {
  const { aviso } = useAvisos();
  const [reproduciendo, setReproduciendo] = useState(false);
  const [mudo, setMudo] = useState(false);
  const reloj = useRef(null);
  const porElUsuario = useRef(false);
  const total = Math.max(1, Math.round(duracion * FPS));

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return undefined;
    const alCuadro = (e) => {
      if (reloj.current) reloj.current.textContent = codigoDeTiempo(e.detail.frame / FPS);
    };
    const alPlay = () => setReproduciendo(true);
    const alPausa = () => setReproduciendo(false);
    const alMudo = (e) => {
      const silencio = Boolean(e.detail?.isMuted);
      setMudo(silencio);
      // el navegador no dejó sonar la vista previa y el reproductor se silenció solo
      if (silencio && !porElUsuario.current) {
        aviso({ tipo: 'aviso', titulo: 'La vista previa quedó sin sonido', texto: 'El navegador no dejó reproducir con sonido. Toca el altavoz de abajo para activarlo.', duracion: 7000 });
      }
      porElUsuario.current = false;
    };
    p.addEventListener('frameupdate', alCuadro);
    p.addEventListener('seeked', alCuadro);
    p.addEventListener('play', alPlay);
    p.addEventListener('pause', alPausa);
    p.addEventListener('ended', alPausa);
    p.addEventListener('mutechange', alMudo);
    setReproduciendo(p.isPlaying());
    return () => {
      p.removeEventListener('frameupdate', alCuadro);
      p.removeEventListener('seeked', alCuadro);
      p.removeEventListener('play', alPlay);
      p.removeEventListener('pause', alPausa);
      p.removeEventListener('ended', alPausa);
      p.removeEventListener('mutechange', alMudo);
    };
  }, [playerRef, listo, aviso]);

  const p = () => playerRef.current;
  const ir = (cuadro) => {
    p()?.pause();
    p()?.seekTo(Math.max(0, Math.min(total - 1, cuadro)));
  };

  return (
    <div className="ed-transporte">
      <div className="ed-transporte__reloj t-mono">
        <span ref={reloj} className="ed-transporte__actual">
          00:00.00
        </span>
        <span className="ed-transporte__total">{codigoDeTiempo(duracion)}</span>
        {precarga?.total && precarga.hechos < precarga.total ? (
          <span className="ed-transporte__precarga" role="status">
            <LoaderCircle size={11} strokeWidth={2.6} className="girando" aria-hidden="true" />
            Preparando clips {precarga.hechos}/{precarga.total}
          </span>
        ) : null}
      </div>
      <div className="ed-transporte__centro">
        <Tooltip texto={<>Al inicio <kbd>Inicio</kbd></>}>
          <Boton variante="fantasma" tamano="chico" soloIcono icono={SkipBack} etiqueta="Ir al inicio" onClick={() => ir(0)} />
        </Tooltip>
        <Tooltip texto={<>Un cuadro atrás <kbd>←</kbd></>} className="ed-solo-ancho">
          <Boton variante="fantasma" tamano="chico" soloIcono icono={StepBack} etiqueta="Un cuadro atrás" onClick={() => ir((p()?.getCurrentFrame() || 0) - 1)} />
        </Tooltip>
        <Tooltip texto={<>{reproduciendo ? 'Pausar' : 'Reproducir'} <kbd>Espacio</kbd></>}>
          <button type="button" className={`ed-play${reproduciendo ? ' es-reproduciendo' : ''}`} aria-label={reproduciendo ? 'Pausar' : 'Reproducir'} onClick={(e) => p()?.toggle(e)}>
            {reproduciendo ? <Pause size={18} strokeWidth={2.4} fill="currentColor" /> : <Play size={18} strokeWidth={2.4} fill="currentColor" />}
          </button>
        </Tooltip>
        <Tooltip texto={<>Un cuadro adelante <kbd>→</kbd></>} className="ed-solo-ancho">
          <Boton variante="fantasma" tamano="chico" soloIcono icono={StepForward} etiqueta="Un cuadro adelante" onClick={() => ir((p()?.getCurrentFrame() || 0) + 1)} />
        </Tooltip>
        <Tooltip texto={<>Al final <kbd>Fin</kbd></>}>
          <Boton variante="fantasma" tamano="chico" soloIcono icono={SkipForward} etiqueta="Ir al final" onClick={() => ir(total - 1)} />
        </Tooltip>
      </div>
      <div className="ed-transporte__der">
        {extra}
        <Tooltip texto={mudo ? 'Activar el sonido' : 'Silenciar la vista previa'}>
          <Boton variante="fantasma" tamano="chico" soloIcono icono={mudo ? VolumeX : Volume2} etiqueta={mudo ? 'Activar el sonido' : 'Silenciar'} onClick={() => {
              porElUsuario.current = true;
              if (mudo) p()?.unmute();
              else p()?.mute();
            }}
          />
        </Tooltip>
        <Tooltip texto="Pantalla completa">
          <Boton variante="fantasma" tamano="chico" soloIcono icono={Maximize} etiqueta="Pantalla completa" onClick={() => p()?.requestFullscreen()} />
        </Tooltip>
      </div>
    </div>
  );
}

/** Barra de avance sobre el borde de abajo del video: sigue al Player y se arrastra para saltar. */
function BarraTiempo({ playerRef, listo, duracion }) {
  const pista = useRef(null);
  const relleno = useRef(null);
  const arrastrando = useRef(false);
  const total = Math.max(1, Math.round(duracion * FPS));

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return undefined;
    const mover = (e) => {
      if (relleno.current) relleno.current.style.transform = `scaleX(${Math.min(1, e.detail.frame / Math.max(1, total - 1))})`;
    };
    p.addEventListener('frameupdate', mover);
    p.addEventListener('seeked', mover);
    return () => {
      p.removeEventListener('frameupdate', mover);
      p.removeEventListener('seeked', mover);
    };
  }, [playerRef, listo, total]);

  const saltar = (e) => {
    const r = pista.current.getBoundingClientRect();
    const k = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    playerRef.current?.seekTo(Math.round(k * (total - 1)));
  };
  return (
    <div
      ref={pista}
      className="ed-avance"
      role="slider"
      tabIndex={-1}
      aria-label="Avance del video"
      aria-valuemin={0}
      aria-valuemax={Math.round(duracion)}
      onPointerDown={(e) => {
        e.stopPropagation();
        playerRef.current?.pause();
        arrastrando.current = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        saltar(e);
      }}
      onPointerMove={(e) => arrastrando.current && saltar(e)}
      onPointerUp={() => {
        arrastrando.current = false;
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="ed-avance__pista">
        <span ref={relleno} className="ed-avance__relleno" />
      </span>
    </div>
  );
}

function ZonaMeta() {
  return (
    <div className="ed-meta" aria-hidden="true">
      <div className="ed-meta__arriba">
        <span>Nombre de la cuenta</span>
      </div>
      <div className="ed-meta__lado">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="ed-meta__abajo">
        <span>Texto del anuncio y botón</span>
      </div>
    </div>
  );
}

function Guardado({ estado, hayCambios }) {
  if (!hayCambios && estado !== 'guardando') return <span className="ed-guardado">Sin cambios</span>;
  if (estado === 'guardando')
    return (
      <span className="ed-guardado">
        <LoaderCircle size={12} strokeWidth={2.4} className="girando" aria-hidden="true" /> Guardando…
      </span>
    );
  if (estado === 'sin-espacio')
    return (
      <span className="ed-guardado ed-guardado--aviso">
        <TriangleAlert size={12} strokeWidth={2.4} aria-hidden="true" /> No se pudo guardar: la app no contesta
      </span>
    );
  if (estado === 'navegador')
    return (
      <span className="ed-guardado ed-guardado--aviso">
        <TriangleAlert size={12} strokeWidth={2.4} aria-hidden="true" /> Guardado solo en este navegador
      </span>
    );
  return (
    <span className="ed-guardado ed-guardado--ok">
      <Check size={12} strokeWidth={3} aria-hidden="true" /> Guardado
    </span>
  );
}

function Atajos({ ancla, onCerrar }) {
  const filas = [
    ['Reproducir o pausar', <kbd key="a">Espacio</kbd>],
    ['Un cuadro atrás o adelante', [<kbd key="a">←</kbd>, <kbd key="b">→</kbd>]],
    ['Un segundo atrás o adelante', [<kbd key="a">Mayús</kbd>, ' + ', <kbd key="b">←</kbd>, <kbd key="c">→</kbd>]],
    ['Ir al inicio o al final', [<kbd key="a">Inicio</kbd>, <kbd key="b">Fin</kbd>]],
    ['Deshacer', [<kbd key="a">Ctrl</kbd>, ' + ', <kbd key="b">Z</kbd>]],
    ['Rehacer', [<kbd key="a">Ctrl</kbd>, ' + ', <kbd key="b">Y</kbd>]],
    ['Dividir en el cursor', [<kbd key="a">Ctrl</kbd>, ' + ', <kbd key="b">B</kbd>]],
    ['Borrar lo elegido', <kbd key="a">Supr</kbd>],
    ['Mover un clip o recortarlo', 'Arrastrar la pieza o sus bordes'],
    ['Acercar o alejar la línea de tiempo', [<kbd key="a">+</kbd>, <kbd key="b">−</kbd>]],
    ['Corregir un subtítulo', 'Doble clic'],
  ];
  return (
    <Globo abierto={Boolean(ancla)} ancla={ancla} onCerrar={onCerrar} lado="abajo" ancho={330} etiqueta="Atajos de teclado" className="ed-atajos-globo">
      <p className="ed-atajos-globo__titulo">Atajos de teclado</p>
      <dl className="ed-teclas">
        {filas.map(([que, como]) => (
          <div key={que} className="ed-teclas__fila">
            <dt>{que}</dt>
            <dd>{como}</dd>
          </div>
        ))}
      </dl>
    </Globo>
  );
}

function resumenDeCambios(ed, pistas) {
  const l = [];
  const s = ed.subtitulos;
  if (!s.visible) l.push('Sin subtítulos');
  else {
    if (s.estilo !== 'caja') l.push(`Subtítulos estilo ${ESTILO_POR_ID[s.estilo]?.nombre || s.estilo}`);
    if (s.color) l.push('Otro color de subtítulos');
    if (Math.abs(s.tamano - 1) > 0.005) l.push(`Subtítulos al ${Math.round(s.tamano * 100)} %`);
    if (s.altura !== null && s.altura !== undefined) l.push('Subtítulos a otra altura');
  }
  const corr = Object.keys(ed.correcciones).length;
  if (corr) l.push(corr === 1 ? '1 subtítulo corregido' : `${corr} subtítulos corregidos`);
  if (ed.ocultos.length) l.push(ed.ocultos.length === 1 ? '1 subtítulo oculto' : `${ed.ocultos.length} subtítulos ocultos`);
  if (ed.tomas) l.push('Tomas cortadas o movidas');
  if (ed.brolls) l.push('B-roll cortados o movidos');
  if (ed.quitados.length) l.push(ed.quitados.length === 1 ? '1 B-roll quitado' : `${ed.quitados.length} B-roll quitados`);
  if (ed.textos.length) l.push(ed.textos.length === 1 ? '1 texto en pantalla' : `${ed.textos.length} textos en pantalla`);
  const nuevos = (ed.textosNuevos || []).length;
  if (nuevos) l.push(nuevos === 1 ? '1 texto nuevo' : `${nuevos} textos nuevos`);
  if (Object.keys(ed.ajustesTextos || {}).length) l.push('Textos con otro aspecto o en otro momento');
  if (ed.musica.tramos && ed.musica.fuente !== 'ninguna') l.push('Música recortada o movida');
  const m = ed.musica;
  if (m.fuente === 'propia') l.push(`Tu música: ${m.nombre}`);
  else if (m.fuente === 'biblioteca') l.push(`Música de «${m.origen}»`);
  else if (m.fuente === 'ninguna' && pistas.voz?.modo !== 'cancion') l.push('Sin música');
  if (m.fuente !== 'ninguna' && pistas.musica) {
    if (m.silenciada) l.push('Música silenciada');
    else if (Math.abs(m.volumen - 1) > 0.005) l.push(`Música al ${Math.round(m.volumen * 100)} %`);
  }
  if (ed.voz.silenciada) l.push('Voz silenciada');
  else if (Math.abs(ed.voz.volumen - 1) > 0.005) l.push(`Voz al ${Math.round(ed.voz.volumen * 100)} %`);
  return l;
}

// ---------------------------------------------------------------- estados de carga

function BarraSimple({ slug, titulo }) {
  return (
    <header className="ed-barra">
      <div className="ed-barra__izq">
        <Boton variante="fantasma" tamano="chico" soloIcono icono={ArrowLeft} etiqueta="Volver" href={slug ? enlace.anuncio(slug) : enlace.tablero()} />
        <a href={enlace.tablero()} className="ed-barra__logo" aria-label="Mis anuncios">
          <Logo tamano={26} />
        </a>
        <div className="ed-barra__titulo">{titulo ? <h1>{titulo}</h1> : <Esqueleto forma="texto" ancho={180} alto={12} />}</div>
      </div>
    </header>
  );
}

function EditorCargando({ slug }) {
  return (
    <div className="ed" aria-busy="true">
      <BarraSimple slug={slug} />
      <aside className="ed-panel ed-panel--medios">
        <div className="ed-esqueleto-panel">
          <Esqueleto alto={44} />
          <div className="ed-medios__rejilla">
            <Esqueleto forma="miniatura" />
            <Esqueleto forma="miniatura" />
            <Esqueleto forma="miniatura" />
            <Esqueleto forma="miniatura" />
          </div>
        </div>
      </aside>
      <main className="ed-escenario">
        <div className="ed-escenario__lienzo-zona">
          <Esqueleto forma="miniatura" className="ed-lienzo ed-lienzo--esqueleto" />
        </div>
      </main>
      <aside className="ed-panel ed-panel--cambios">
        <div className="ed-esqueleto-panel">
          <Esqueleto forma="texto" ancho={140} alto={14} />
          <div className="ed-atajos">
            {Array.from({ length: 6 }, (_, i) => (
              <Esqueleto key={i} alto={58} />
            ))}
          </div>
          <Esqueleto alto={160} />
        </div>
      </aside>
      <section className="lt lt--esqueleto">
        <div className="lt__barra" />
        <div className="ed-esqueleto-lt">
          {[28, 32, 40, 52, 38, 40].map((h, i) => (
            <Esqueleto key={i} alto={h} />
          ))}
        </div>
      </section>
    </div>
  );
}

function EditorAviso({ slug, titulo, children }) {
  return (
    <div className="ed ed--aviso">
      <BarraSimple slug={slug} titulo={titulo || 'Editor'} />
      <main className="ed-aviso">{children}</main>
    </div>
  );
}

// ---------------------------------------------------------------- la pantalla

export default function Editor({ params, consulta }) {
  const { slug } = params;
  const { datos: a, cargando, error, recargar } = useAnuncio(slug);

  useEffect(() => {
    cargarFuentesSubtitulos();
  }, []);

  if (error) {
    return (
      <EditorAviso slug={null}>
        <EstadoVacio
          icono={TriangleAlert}
          tono="error"
          titulo="No pude abrir este anuncio"
          descripcion={error.message}
          acciones={
            <>
              <Boton variante="primario" icono={RefreshCw} onClick={recargar}>
                Volver a intentar
              </Boton>
              <Boton variante="secundario" href={enlace.tablero()}>
                Ir a Mis anuncios
              </Boton>
            </>
          }
        />
      </EditorAviso>
    );
  }
  if (cargando || !a) return <EditorCargando slug={slug} />;
  if (!a.plan || !(a.plan.duracion > 0)) {
    return (
      <EditorAviso slug={slug} titulo={a.titulo}>
        <EstadoVacio
          icono={Clapperboard}
          tono="cian"
          titulo="Este anuncio todavía no tiene montaje"
          descripcion="El editor se abre cuando el anuncio ya está armado. Mientras tanto puedes ver cómo va la producción."
          acciones={
            <>
              <Boton variante="primario" href={enlace.produccion(slug)}>
                Ver la producción
              </Boton>
              <Boton variante="secundario" href={enlace.anuncio(slug)}>
                Volver al anuncio
              </Boton>
            </>
          }
        />
      </EditorAviso>
    );
  }
  return <EditorListo key={slug} a={a} recargar={recargar} pedidoExportar={consulta?.get('exportar') || null} />;
}

/** Mientras se rehace una pieza: qué está pasando, arriba del video. */
function Rehaciendo({ t, slug, onCancelar }) {
  if (!t) return null;
  const trabado = t.trabado && !t.trabado.espera;
  const frase =
    t.fase === 'produccion'
      ? trabado
        ? t.trabado.mensaje
        : t.trabado?.espera
          ? t.trabado.mensaje
          : t.paso?.detalle || t.paso?.nombre || t.frase
      : t.frase;
  return (
    <div className={`ed-rehaciendo${trabado ? ' es-trabado' : ''}`} role="status">
      {trabado ? <TriangleAlert size={15} strokeWidth={2.4} aria-hidden="true" /> : <LoaderCircle size={15} strokeWidth={2.6} className="girando" aria-hidden="true" />}
      <span className="ed-rehaciendo__textos">
        <span className="ed-rehaciendo__titulo">{trabado ? `Se frenó al rehacer ${t.nombre}` : `Rehaciendo ${t.nombre}`}</span>
        {frase ? <span className="ed-rehaciendo__detalle">{frase}</span> : null}
      </span>
      {t.fase === 'prompts' ? (
        <Boton variante="fantasma" tamano="chico" onClick={onCancelar}>
          Cancelar
        </Boton>
      ) : t.fase === 'produccion' ? (
        <Boton variante={trabado ? 'primario' : 'fantasma'} tamano="chico" href={enlace.produccion(slug)}>
          {trabado ? 'Resolverlo' : 'Ver el avance'}
        </Boton>
      ) : null}
    </div>
  );
}

function EditorListo({ a, recargar, pedidoExportar = null }) {
  const { aviso } = useAvisos();
  const plan = a.plan;
  const colorAnuncio = plan.estiloSubtitulos?.colorResaltado || a.colorSubtitulos || '#E8442A';
  // lo que la exportación necesita saber de la pantalla (va con cada guardado y con cada exportación)
  const contextoGuardado = useMemo(() => ({ titulo: a.titulo || '', overlays: a.overlays || [], color: colorAnuncio }), [a.titulo, a.overlays, colorAnuncio]);
  const { ed, cambiar, reemplazar, deshacer, rehacer, puedeDeshacer, puedeRehacer, etiquetaDeshacer, etiquetaRehacer, guardado, canciones } = useEdicion(a.slug, { contexto: contextoGuardado });

  const playerRef = useRef(null);
  const archivoRef = useRef(null);
  const [playerListo, setPlayerListo] = useState(0);
  const [seleccion, setSeleccion] = useState(null);
  const [editando, setEditando] = useState(null); // { id, ancla }
  const [borrador, setBorrador] = useState(null); // { id, texto }
  const [galeria, setGaleria] = useState(false);
  // "#/anuncio/<slug>/editor?exportar=1" (desde la entrega: "sácala en el editor") abre Exportar de entrada; con
  // ?exportar=sin-subtitulos (o sin-musica, limpia) viene elegida esa versión. La consulta se quita de la dirección
  // para que recargar no la vuelva a abrir.
  const [exportar, setExportar] = useState(Boolean(pedidoExportar));
  const [versionPedida] = useState(pedidoExportar && pedidoExportar !== '1' ? pedidoExportar : null);
  useEffect(() => {
    if (pedidoExportar) window.history.replaceState(null, '', enlace.editor(a.slug));
  }, [pedidoExportar, a.slug]);
  const exportarAbierto = useRef(false);
  exportarAbierto.current = exportar;
  const [rehacerCon, setRehacerCon] = useState(undefined); // undefined = cerrado

  // ---------------------------------------------------------------- exportar y rehacer (los corre la app)
  const exp = useExportacion(a.slug, {
    alTerminar: (t) => {
      if (exportarAbierto.current || !t) return;
      if (t.estado === 'listo') aviso({ tipo: 'ok', titulo: 'Tu versión está lista', texto: t.resultado?.archivo || 'Salió como un archivo nuevo.', duracion: 9000, accion: { etiqueta: 'Verla', alHacer: () => setExportar(true) } });
      else if (t.estado === 'error') aviso({ tipo: 'error', titulo: 'No se pudo exportar', texto: t.error?.mensaje || 'Vuelve a intentarlo: exportar no cuesta.', duracion: 9000 });
    },
  });
  const reh = useRehacer(a.slug, {
    alTerminar: (t) => {
      if (!t) return;
      if (t.fase === 'listo') {
        recargar();
        const nueva = /^(toma|escena)/i.test(t.nombre || '') ? 'nueva' : 'nuevo';
        aviso({ tipo: 'ok', titulo: `${t.nombre || 'La pieza'} ya está ${nueva}`, texto: t.nota || 'El anuncio se volvió a armar con el clip nuevo.', duracion: 9000 });
      } else if (t.fase === 'error') aviso({ tipo: 'error', titulo: `No se pudo rehacer ${t.nombre}`, texto: t.error?.mensaje || 'Vuelve a pedirlo.', duracion: 10000 });
    },
  });
  const rehaciendo = rehacerEnMarcha(reh.trabajo);
  const exportandoAhora = exportacionEnMarcha(exp.trabajo);
  const [pestana, setPestana] = useState('medios');
  // en ventanas de menos de 1366 de ancho el panel izquierdo es una columna de iconos y se abre encima
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [zonaMeta, setZonaMeta] = useState(false);
  const [enfoque, setEnfoque] = useState(null);
  const [soltando, setSoltando] = useState(false);
  const [atajos, setAtajos] = useState(null);
  const [versionMusica, setVersionMusica] = useState(0);
  const [precarga, setPrecarga] = useState({ hechos: 0, total: 0 });
  const [altoLinea, setAltoLinea] = useState(() => {
    try {
      return Number(window.localStorage.getItem('anuncios-ia:editor:alto-linea')) || null;
    } catch {
      return null;
    }
  });

  // Los archivos del anuncio (staticFile en Anuncio.jsx) se buscan aquí. Va antes de dibujar el Player.
  window.remotion_staticBase = a.base;

  useEffect(() => {
    document.title = `${a.titulo} · Editor · anuncios-IA`;
    setPlayerListo((n) => n + 1);
  }, [a.titulo]);

  // ---------------------------------------------------------------- precarga de clips y audios (de a 3)
  useEffect(() => {
    window.remotion_staticBase = a.base;
    const archivos = mediosDelPlan(plan);
    let vivo = true;
    let i = 0;
    const liberar = [];
    setPrecarga({ hechos: 0, total: archivos.length });
    const trabajar = async () => {
      while (vivo && i < archivos.length) {
        const rel = archivos[i++];
        try {
          const p = prefetch(staticFile(rel), { method: 'blob-url' });
          liberar.push(p.free);
          await p.waitUntilDone();
        } catch {
          /* si un archivo no baja, el Player lo pide solo cuando le toque */
        }
        if (vivo) setPrecarga((s) => ({ ...s, hechos: s.hechos + 1 }));
      }
    };
    trabajar();
    trabajar();
    trabajar();
    return () => {
      vivo = false;
      liberar.forEach((f) => f());
    };
  }, [a.base, plan]);

  // ---------------------------------------------------------------- canción propia (de este navegador o del anuncio)
  useEffect(() => {
    if (ed.musica.fuente !== 'propia' || urlMusica(ed.musica.id) || canciones === null) return undefined; // (null: todavía no llegó lo del anuncio)
    let vivo = true;
    leerCancionPropia(a.slug).then((r) => {
      if (!vivo) return;
      if (r && r.id === ed.musica.id && r.archivo) {
        registrarUrlMusica(r.id, r.archivo);
        setVersionMusica((v) => v + 1);
        return;
      }
      // la copia que quedó guardada en la carpeta del anuncio (otro navegador, o se borró la de este)
      const enAnuncio = canciones.find((c) => c.id === ed.musica.id);
      if (enAnuncio) {
        registrarUrlMusica(enAnuncio.id, enAnuncio.url);
        setVersionMusica((v) => v + 1);
        return;
      }
      reemplazar((s) => ({ ...s, musica: { ...INICIAL.musica, volumen: s.musica.volumen } }));
      aviso({ tipo: 'aviso', titulo: 'No encontré tu canción', texto: 'Volví a la música del anuncio. Arrástrala otra vez si la quieres.' });
    });
    return () => {
      vivo = false;
    };
  }, [a.slug, ed.musica.fuente, ed.musica.id, reemplazar, aviso, canciones]);

  // ---------------------------------------------------------------- lo que se calcula del plan + los cambios
  const mv = modoVoz(plan);
  const subs = useMemo(() => subtitulosEditados(plan, ed, borrador), [plan, ed.correcciones, ed.ocultos, borrador]); // eslint-disable-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pistas = useMemo(() => construirPistas(a, plan, ed, subs, colorAnuncio), [a, plan, ed.quitados, ed.textos, ed.musica, ed.tomas, ed.brolls, ed.ajustesTextos, ed.textosNuevos, subs, versionMusica, colorAnuncio]);
  // mientras se arrastra una pieza: el resultado, solo para la línea de tiempo (al soltar se guarda)
  const [previa, setPrevia] = useState(null);
  const pistasLinea = useMemo(() => (previa ? construirPistas(a, plan, previa, subs, colorAnuncio) : pistas), [previa, pistas, a, plan, subs, colorAnuncio]);
  // La composición recibe los cambios tal cual (con la palabra que se está corrigiendo) y calcula sus capas con
  // la misma cuenta que el render (remotion/src/edicion/capas.mjs).
  const edVista = useMemo(() => (borrador ? { ...ed, correcciones: { ...ed.correcciones, [borrador.id]: borrador.texto } } : ed), [ed, borrador]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const contextoVista = useMemo(() => contextoDeVista(a, plan, ed, colorAnuncio), [a, plan, ed.musica, colorAnuncio, versionMusica]);
  const inputProps = useMemo(() => ({ plan, edicion: edVista, contexto: contextoVista }), [plan, edVista, contextoVista]);

  const marcas = useMemo(() => marcarClaves(subs, palabrasDeMarca(a.titulo)), [subs, a.titulo]);
  const muestra = useMemo(() => muestraDeGaleria(subs, pistas), [subs, pistas]);
  const datosGaleria = useMemo(
    () => ({
      muestra,
      colorAnuncio,
      colorElegido: ed.subtitulos.color,
      tamano: (plan.estiloSubtitulos?.tamano ?? 0.0722) * ed.subtitulos.tamano,
      alturaBase: plan.estiloSubtitulos?.desdeAbajo ?? 0.26,
      marcas,
      recomendado: mv === 'en-clips' ? 'limpio' : null,
    }),
    [muestra, colorAnuncio, ed.subtitulos.color, ed.subtitulos.tamano, plan.estiloSubtitulos, marcas, mv]
  );
  const hayCambios = tieneCambios(ed);
  const cambios = useMemo(() => resumenDeCambios(ed, pistas), [ed, pistas]);

  // ---------------------------------------------------------------- acciones
  const usarArchivo = useCallback(
    async (archivo) => {
      if (!archivo) return;
      if (mv === 'cancion') {
        aviso({ tipo: 'info', titulo: 'La canción es el anuncio', texto: 'En los musicales no se cambia la canción.' });
        return;
      }
      const esAudio = /^audio\//.test(archivo.type) || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(archivo.name);
      if (!esAudio) {
        aviso({ tipo: 'error', titulo: 'Ese archivo no es una canción', texto: 'Usa un MP3, WAV o M4A.' });
        return;
      }
      if (archivo.size > 80 * 1024 * 1024) {
        aviso({ tipo: 'error', titulo: 'La canción pesa demasiado', texto: 'Usa una de menos de 80 MB.' });
        return;
      }
      const id = `m${Date.now().toString(36)}`;
      const url = registrarUrlMusica(id, archivo);
      let dur = null;
      try {
        dur = (await picosDe(url))?.duracion ?? null;
      } catch {
        aviso({ tipo: 'error', titulo: 'No pude leer esa canción', texto: 'Puede que el archivo esté dañado. Prueba con otro MP3.' });
        return;
      }
      cambiar((s) => ({ ...s, musica: { ...INICIAL.musica, fuente: 'propia', id, nombre: archivo.name, duracion: dur, volumen: s.musica.volumen } }), { etiqueta: `Música: ${archivo.name}` });
      setSeleccion({ pista: 'musica', id: 'm0' });
      const corta = dur && dur < plan.duracion;
      aviso({ tipo: 'ok', titulo: 'Tu música ya suena', texto: `«${archivo.name}» está en la vista previa.${corta ? ' Es más corta que el anuncio: se repite sola.' : ''}` });
      guardarCancionPropia(a.slug, { id, nombre: archivo.name, tipo: archivo.type, archivo }).then(({ anuncio, navegador }) => {
        // la que vale para exportar es la copia del anuncio
        if (!anuncio) aviso({ tipo: 'aviso', titulo: 'Suena, pero no quedó guardada en el anuncio', texto: navegador ? 'Se escucha en la vista previa, pero para exportarla vuelve a elegirla cuando la app conteste.' : 'Si recargas, vuelve la música del anuncio.' });
      });
    },
    [a.slug, aviso, cambiar, mv, plan.duracion]
  );
  const usarArchivoRef = useRef(usarArchivo);
  usarArchivoRef.current = usarArchivo;

  const pedirMusica = useCallback(() => {
    if (mv === 'cancion') return;
    archivoRef.current?.click();
  }, [mv]);

  const abrirEdicion = useCallback(
    (id, el) => {
      const p = playerRef.current;
      const b = subs.find((x) => x.id === id);
      if (!b || !el) return;
      p?.pause();
      p?.seekTo(Math.round(((b.inicio + b.fin) / 2) * FPS));
      setSeleccion({ pista: 'subtitulos', id });
      setBorrador(null);
      setEditando({ id, ancla: el.getBoundingClientRect() });
    },
    [subs]
  );

  const corregirActual = useCallback(() => {
    const p = playerRef.current;
    const t = (p?.getCurrentFrame() || 0) / FPS;
    const visibles = subs.filter((b) => !b.oculto);
    const b = visibles.find((x) => t >= x.inicio && t < x.fin) || visibles.find((x) => x.inicio >= t) || visibles[visibles.length - 1];
    if (!b) return;
    const el = document.querySelector(`.lt-carril--subtitulos [data-id="${b.id}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'center' });
    requestAnimationFrame(() => abrirEdicion(b.id, el));
  }, [subs, abrirEdicion]);

  // Rehacer con IA: solo en los anuncios que produce la app, con el anuncio terminado y de a una pieza.
  const sePuedeRehacer = useCallback((item) => Boolean(reh.disponible && item?.pieza && reh.piezas[item.pieza]), [reh.disponible, reh.piezas]);
  const abrirRehacer = useCallback(
    (item) => {
      if (!reh.disponible) return;
      if (rehaciendo) {
        aviso({ tipo: 'info', titulo: `Ya se está rehaciendo ${reh.trabajo?.nombre || 'una parte'}`, texto: 'Cuando termine puedes pedir otra.' });
        return;
      }
      if (reh.enMarcha) {
        aviso({ tipo: 'info', titulo: 'El anuncio se está produciendo', texto: 'Cuando termine puedes rehacer una parte.' });
        return;
      }
      playerRef.current?.pause();
      if (item) return setRehacerCon(item);
      const sel = seleccion && (seleccion.pista === 'video' || seleccion.pista === 'broll') ? [...pistas.video, ...pistas.broll].find((x) => x.id === seleccion.id) : null;
      if (sel) return setRehacerCon(sel);
      const t = (playerRef.current?.getCurrentFrame() || 0) / FPS;
      // la pieza que se ve ahora: el B-roll si está encima, si no la toma
      const enBroll = pistas.broll.find((b) => !b.quitado && t >= b.inicio && t < b.fin && sePuedeRehacer(b));
      setRehacerCon(enBroll || pistas.video.find((v) => t >= v.inicio && t < v.fin && sePuedeRehacer(v)) || pistas.video.find(sePuedeRehacer) || null);
    },
    [seleccion, pistas, reh.disponible, reh.enMarcha, reh.trabajo, rehaciendo, sePuedeRehacer, aviso]
  );
  const pedirRehacer = useCallback(
    async (datos) => {
      const t = await reh.pedir(datos);
      aviso({ tipo: 'info', titulo: `Rehaciendo ${t?.nombre || 'la pieza'}`, texto: 'Puedes seguir editando: te aviso cuando esté.', duracion: 6000 });
      return t;
    },
    [reh, aviso]
  );

  const elegirEstilo = useCallback(
    (id) => {
      cambiar((s) => ({ ...s, subtitulos: { ...s.subtitulos, estilo: id, visible: true } }), { etiqueta: `Estilo ${ESTILO_POR_ID[id]?.nombre || id}` });
      const p = playerRef.current;
      if (p && !p.isPlaying()) {
        // si está pausado donde no hay subtítulo, salta al más cercano para que se vea el cambio
        const t = p.getCurrentFrame() / FPS;
        if (!subs.some((b) => !b.oculto && t >= b.inicio && t < b.fin)) {
          const b = subs.find((x) => !x.oculto && x.inicio >= t) || subs.find((x) => !x.oculto);
          if (b) p.seekTo(Math.round((b.palabras?.[0]?.fin ?? b.inicio + 0.1) * FPS));
        }
      }
    },
    [cambiar, subs]
  );

  // Desde la galería: además de aplicar el estilo, la vista previa salta al tramo con más palabras
  // (el mismo de las muestras) y lo pasa dos veces, unos 3 segundos, para verlo moverse en el video.
  const tramo = useRef(null);
  const pararTramo = useCallback(() => {
    clearTimeout(tramo.current);
    tramo.current = null;
  }, []);
  const elegirEnGaleria = useCallback(
    (id) => {
      elegirEstilo(id);
      const p = playerRef.current;
      if (!p || !muestra) return;
      pararTramo();
      const desde = muestra.desde;
      const largo = Math.min(3.2, Math.max(1.6, muestra.hasta - muestra.desde));
      let vueltas = 0;
      const pasar = () => {
        p.seekTo(Math.round(desde * FPS));
        p.play();
        tramo.current = setTimeout(() => {
          vueltas += 1;
          if (vueltas < 2) return pasar();
          p.pause();
          p.seekTo(Math.round((desde + Math.min(1.1, largo / 2)) * FPS));
          tramo.current = null;
        }, largo * 1000);
      };
      pasar();
    },
    [elegirEstilo, muestra, pararTramo]
  );
  useEffect(() => {
    if (!galeria) pararTramo();
    return pararTramo;
  }, [galeria, pararTramo]);

  // ---------------------------------------------------------------- cortar, mover y borrar (cortes.js)
  const extraOp = useMemo(() => ({ musica: pistas.musica, overlays: a.overlays || [] }), [pistas.musica, a.overlays]);
  const nombreDe = useCallback(
    (pista, id) => {
      if (pista === 'video' || pista === 'broll') return [...pistas.video, ...pistas.broll].find((x) => x.id === id)?.nombre || 'el clip';
      if (pista === 'textos') {
        const x = pistas.textos.find((y) => y.id === id);
        return x ? `el texto «${String(x.texto).slice(0, 28)}»` : 'el texto';
      }
      if (pista === 'musica') return 'la música';
      return 'eso';
    },
    [pistas]
  );
  // Después de un corte: si un clip quedó sin imagen suficiente para su lugar, se ve quieto al final (nunca
  // negro). Se avisa una vez, con qué hacer.
  const avisarQuietos = useCallback(
    (antes, despues) => {
      const p0 = construirPistas(a, plan, antes, subs, colorAnuncio);
      const p1 = construirPistas(a, plan, despues, subs, colorAnuncio);
      const previo = new Map([...p0.video, ...p0.broll].map((x) => [x.id, x.quieto || 0]));
      const nuevo = [...p1.video, ...p1.broll.filter((b) => !b.quitado)].find((x) => (x.quieto || 0) > (previo.get(x.id) || 0) + 0.05);
      if (nuevo) {
        aviso({
          tipo: 'aviso',
          titulo: `${nuevo.nombre} queda quieta ${String(nuevo.quieto).replace('.', ',')} s al final`,
          texto: 'Su clip no alcanza a llenar ese lugar. Acórtala o alarga la toma de al lado.',
          duracion: 8000,
        });
      }
    },
    [a, plan, subs, colorAnuncio, aviso]
  );
  const aplicar = useCallback(
    (op, etiqueta) => {
      const r = operar(plan, ed, { ...extraOp, ...op });
      if (r.error) {
        aviso({ tipo: 'info', titulo: 'Así no se puede', texto: r.error });
        return null;
      }
      if (JSON.stringify(r.ed) === JSON.stringify(ed)) return r;
      cambiar(() => r.ed, { etiqueta });
      avisarQuietos(ed, r.ed);
      return r;
    },
    [plan, ed, extraOp, cambiar, aviso, avisarQuietos]
  );
  const arrastrar = useCallback(
    (op, final) => {
      if (!op) return setPrevia(null);
      const r = operar(plan, ed, { ...extraOp, ...op });
      if (!final) {
        if (!r.error) setPrevia(r.ed);
        return undefined;
      }
      setPrevia(null);
      if (r.error) {
        aviso({ tipo: 'info', titulo: 'Así no se puede', texto: r.error });
        return undefined;
      }
      if (JSON.stringify(r.ed) === JSON.stringify(ed)) return undefined;
      const nombre = nombreDe(op.pista, op.id);
      cambiar(() => r.ed, { etiqueta: op.tipo === 'mover' ? (op.pista === 'video' ? `Cambiar de lugar ${nombre}` : `Mover ${nombre}`) : `Recortar ${nombre}` });
      avisarQuietos(ed, r.ed);
      return undefined;
    },
    [plan, ed, extraOp, cambiar, aviso, avisarQuietos, nombreDe]
  );
  const dividir = useCallback(() => {
    const p = playerRef.current;
    p?.pause();
    const t = (p?.getCurrentFrame() || 0) / FPS;
    const dentro = (x) => t > x.inicio && t < x.fin;
    let objetivo = null;
    if (seleccion?.pista === 'video' || seleccion?.pista === 'broll') {
      const x = (seleccion.pista === 'video' ? pistas.video : pistas.broll).find((y) => y.id === seleccion.id);
      if (x && dentro(x)) objetivo = { pista: seleccion.pista, id: x.id };
    } else if (seleccion?.pista === 'musica') {
      const x = pistas.tramosMusica.find((y) => y.id === seleccion.id);
      if (x && t > x.desde && t < x.hasta) objetivo = { pista: 'musica', id: x.id };
    }
    // con otra cosa elegida, no se divide la toma de abajo sin avisar: se dice por qué no
    if (!objetivo && seleccion) {
      const textos = {
        video: pistas.cortes.tomas ? 'Pon el cursor sobre la toma elegida para dividirla.' : pistas.cortes.motivo,
        voz: 'La voz no se corta: todo el anuncio la sigue.',
        textos: 'Los textos no se dividen: arrastra sus bordes para acortarlos.',
        broll: pistas.cortes.brolls ? 'Pon el cursor sobre el B-roll elegido para dividirlo.' : pistas.cortes.motivo,
        musica: 'Pon el cursor sobre la parte de la música elegida para dividirla.',
      };
      aviso({ tipo: 'info', titulo: 'No se puede dividir ahí', texto: textos[seleccion.pista] || 'Eso no se divide. Elige un clip, un B-roll o la música.' });
      return;
    }
    if (!objetivo && pistas.cortes.tomas) {
      const v = pistas.video.find(dentro);
      if (v) objetivo = { pista: 'video', id: v.id };
    }
    if (!objetivo) {
      aviso({ tipo: 'info', titulo: 'Elige qué dividir', texto: pistas.cortes.tomas ? 'Pon el cursor sobre el clip que quieres dividir.' : 'Elige un B-roll o la música y pon el cursor encima. Las tomas de este anuncio no se cortan.' });
      return;
    }
    if (aplicar({ tipo: 'dividir', ...objetivo, t }, `Dividir ${nombreDe(objetivo.pista, objetivo.id)}`)) setSeleccion(objetivo);
  }, [seleccion, pistas, aplicar, aviso, nombreDe]);
  const borrable = useMemo(() => {
    if (!seleccion) return false;
    const { pista, id } = seleccion;
    if (pista === 'video') return Boolean(pistas.cortes.tomas && pistas.video.length > 1);
    if (pista === 'broll') return Boolean(pistas.broll.find((x) => x.id === id && (pistas.cortes.brolls || (x.removible && !x.quitado))));
    if (pista === 'textos') return Boolean(pistas.textos.find((x) => x.id === id && !x.fijo && x.visible));
    if (pista === 'musica') return Boolean(pistas.musica);
    return false;
  }, [seleccion, pistas]);
  const borrarElegido = useCallback(() => {
    if (!seleccion || !borrable) return;
    const { pista, id } = seleccion;
    const nombre = nombreDe(pista, id);
    if (pista === 'broll' && !pistas.cortes.brolls) {
      // en este estilo el B-roll solo se oculta
      cambiar((s) => ({ ...s, quitados: [...new Set([...s.quitados, id])] }), { etiqueta: `Quitar ${nombre}` });
    } else {
      const r = aplicar({ tipo: 'borrar', pista, id }, `Borrar ${nombre}`);
      if (!r) return;
      if (r.sinMusica) {
        setSeleccion(null);
        aviso({ tipo: 'info', titulo: 'Quitaste la música', texto: 'Si fue sin querer, toca Deshacer.', accion: { etiqueta: 'Deshacer', alHacer: deshacer } });
        return;
      }
    }
    setSeleccion(null);
    aviso({ tipo: 'info', titulo: `Borraste ${nombre}`, texto: 'Si fue sin querer, toca Deshacer.', accion: { etiqueta: 'Deshacer', alHacer: deshacer } });
  }, [seleccion, borrable, nombreDe, pistas, cambiar, aplicar, aviso, deshacer]);
  const [textoNuevoId, setTextoNuevoId] = useState(null);
  const agregarTexto = useCallback(() => {
    const p = playerRef.current;
    p?.pause();
    const t = (p?.getCurrentFrame() || 0) / FPS;
    const r = textoNuevo(plan, ed, { t, color: colorAnuncio });
    cambiar(() => r.ed, { etiqueta: 'Agregar texto' });
    const x = r.ed.textosNuevos[r.ed.textosNuevos.length - 1];
    setSeleccion({ pista: 'textos', id: r.nuevo });
    setTextoNuevoId(r.nuevo);
    // un poco después del comienzo, cuando el texto ya terminó de entrar
    p?.seekTo(Math.round(Math.min(x.fin - 0.1, x.inicio + 0.6) * FPS));
  }, [plan, ed, colorAnuncio, cambiar]);
  const teclasRef = useRef({});
  teclasRef.current = { dividir, borrar: borrarElegido };

  const acciones = useMemo(
    () => ({
      dividir,
      borrar: borrarElegido,
      puedeBorrar: borrable,
      agregarTexto,
      textoNuevoId,
      ajustarTexto: (id, cambios, opciones = {}) => cambiar((s) => cambiarTexto(s, id, cambios).ed, { etiqueta: opciones.etiqueta || 'Cambiar texto', grupo: opciones.grupo }),
      restablecerTexto: (id) =>
        cambiar(
          (s) => {
            const ajustes = { ...s.ajustesTextos };
            delete ajustes[id];
            return { ...s, ajustesTextos: ajustes };
          },
          { etiqueta: 'Texto como venía' }
        ),
      ajustarTramo: (id, cambios, opciones = {}) => cambiar((s) => cambiarTramo(plan, s, { id, cambios, musica: pistas.musica }).ed, { etiqueta: opciones.etiqueta || 'Cambiar la música', grupo: opciones.grupo }),
      abrirGaleria: () => setGaleria(true),
      elegirEstilo,
      pedirMusica,
      usarArchivo: (f) => usarArchivoRef.current(f),
      corregirActual,
      abrirRehacer,
      // solo se muestra donde de verdad se puede
      rehacerDisponible: reh.disponible,
      sePuedeRehacer,
      enfocar: (seccion) => setEnfoque({ seccion, t: Date.now() }),
      alternarSubtitulos: () => cambiar((s) => ({ ...s, subtitulos: { ...s.subtitulos, visible: !s.subtitulos.visible } }), { etiqueta: 'Mostrar u ocultar subtítulos' }),
      alternarVoz: () => cambiar((s) => ({ ...s, voz: { ...s.voz, silenciada: !s.voz.silenciada } }), { etiqueta: 'Silenciar o activar la voz' }),
      alternarMusica: () => cambiar((s) => ({ ...s, musica: { ...s.musica, silenciada: !s.musica.silenciada } }), { etiqueta: 'Silenciar o activar la música' }),
      alternarBrolls: () => {
        const removibles = pistas.broll.filter((b) => b.removible).map((b) => b.id);
        const alguno = pistas.broll.some((b) => b.removible && !b.quitado);
        cambiar((s) => ({ ...s, quitados: alguno ? [...new Set([...s.quitados, ...removibles])] : s.quitados.filter((x) => !removibles.includes(x)) }), { etiqueta: alguno ? 'Quitar los B-roll' : 'Volver a poner los B-roll' });
      },
      alternarTextos: () => {
        const ids = pistas.textos.filter((x) => x.tipo === 'sugerido').map((x) => x.id);
        const alguno = pistas.textos.some((x) => x.tipo === 'sugerido' && x.visible);
        cambiar((s) => ({ ...s, textos: alguno ? [] : ids }), { etiqueta: alguno ? 'Ocultar los textos' : 'Mostrar los textos' });
      },
      abrirMusica: () => {
        setPestana('musica');
        setPanelAbierto(true);
      },
      usarBiblioteca: (m) => {
        cambiar((s) => ({ ...s, musica: { ...INICIAL.musica, fuente: 'biblioteca', url: m.url, nombre: `Música de ${m.titulo}`, origen: m.titulo, duracion: m.duracion, volumen: s.musica.volumen } }), { etiqueta: `Música de ${m.titulo}` });
        aviso({ tipo: 'ok', titulo: 'Música cambiada', texto: `Ahora suena la de «${m.titulo}».` });
      },
      musicaOriginal: () => cambiar((s) => ({ ...s, musica: { ...INICIAL.musica, volumen: s.musica.volumen } }), { etiqueta: 'Música original' }),
      quitarMusica: () => {
        cambiar((s) => ({ ...s, musica: { ...s.musica, fuente: 'ninguna', silenciada: false } }), { etiqueta: 'Quitar la música' });
        aviso({ tipo: 'info', titulo: 'Quitaste la música', texto: 'Si fue sin querer, toca Deshacer.', accion: { etiqueta: 'Deshacer', alHacer: deshacer } });
      },
      volverAlOriginal: () => {
        cambiar(() => INICIAL, { etiqueta: 'Volver al original' });
        setSeleccion(null);
        aviso({ tipo: 'ok', titulo: 'Volviste al anuncio entregado', texto: 'Si fue sin querer, toca Deshacer.', accion: { etiqueta: 'Deshacer', alHacer: deshacer } });
      },
    }),
    [elegirEstilo, pedirMusica, corregirActual, abrirRehacer, reh.disponible, sePuedeRehacer, cambiar, pistas, aviso, deshacer, dividir, borrarElegido, borrable, agregarTexto, textoNuevoId, plan]
  );

  const irA = useCallback((pista, item) => {
    const p = playerRef.current;
    p?.pause();
    p?.seekTo(Math.round((item.inicio + 0.05) * FPS));
    setSeleccion({ pista, id: item.id });
  }, []);

  // ---------------------------------------------------------------- teclado
  useEffect(() => {
    const escribiendo = (el) =>
      Boolean(el) && (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && !['range', 'checkbox', 'radio', 'button'].includes(el.type)));
    const hayModal = () => Boolean(document.querySelector('.modal-velo'));
    const alTeclado = (e) => {
      if (hayModal()) return;
      const p = playerRef.current;
      if (!p) return;
      const enCampo = escribiendo(e.target);
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && !enCampo && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) rehacer();
        else deshacer();
        return;
      }
      if (mod && !enCampo && k === 'y') {
        e.preventDefault();
        rehacer();
        return;
      }
      if (mod && !enCampo && k === 'b') {
        e.preventDefault();
        teclasRef.current.dividir();
        return;
      }
      if (enCampo || mod || e.altKey) return;
      const total = Math.max(1, Math.round(plan.duracion * FPS));
      const deslizador = e.target?.type === 'range';
      switch (e.key) {
        case ' ':
          e.preventDefault();
          p.toggle(e);
          break;
        case 'ArrowLeft':
        case 'ArrowRight':
          if (deslizador) return;
          e.preventDefault();
          p.pause();
          p.seekTo(Math.max(0, Math.min(total - 1, p.getCurrentFrame() + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? FPS : 1))));
          break;
        case 'Home':
          e.preventDefault();
          p.seekTo(0);
          break;
        case 'End':
          e.preventDefault();
          p.pause();
          p.seekTo(total - 1);
          break;
        case '+':
        case '=':
          window.dispatchEvent(new CustomEvent('editor:zoom', { detail: 1 }));
          break;
        case '-':
        case '_':
          window.dispatchEvent(new CustomEvent('editor:zoom', { detail: -1 }));
          break;
        case 'Escape':
          setSeleccion(null);
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          teclasRef.current.borrar();
          break;
        default:
      }
    };
    const alSoltar = (e) => {
      if (e.key === ' ' && !escribiendo(e.target) && !hayModal()) e.preventDefault();
    };
    window.addEventListener('keydown', alTeclado);
    window.addEventListener('keyup', alSoltar);
    return () => {
      window.removeEventListener('keydown', alTeclado);
      window.removeEventListener('keyup', alSoltar);
    };
  }, [deshacer, rehacer, plan.duracion]);

  // ---------------------------------------------------------------- arrastrar una canción a cualquier parte
  useEffect(() => {
    let cuenta = 0;
    const conArchivos = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    const entrar = (e) => {
      if (!conArchivos(e)) return;
      e.preventDefault();
      cuenta += 1;
      setSoltando(true);
    };
    const sobre = (e) => {
      if (conArchivos(e)) e.preventDefault();
    };
    const salir = (e) => {
      if (!conArchivos(e)) return;
      cuenta = Math.max(0, cuenta - 1);
      if (!cuenta) setSoltando(false);
    };
    const limpiar = () => {
      cuenta = 0;
      setSoltando(false);
    };
    const soltar = (e) => {
      if (!conArchivos(e)) return;
      e.preventDefault();
      usarArchivoRef.current(e.dataTransfer.files?.[0]);
    };
    window.addEventListener('dragenter', entrar);
    window.addEventListener('dragover', sobre);
    window.addEventListener('dragleave', salir);
    window.addEventListener('drop', limpiar, true);
    window.addEventListener('drop', soltar);
    return () => {
      window.removeEventListener('dragenter', entrar);
      window.removeEventListener('dragover', sobre);
      window.removeEventListener('dragleave', salir);
      window.removeEventListener('drop', limpiar, true);
      window.removeEventListener('drop', soltar);
    };
  }, []);

  // arrastrar el borde de arriba de la línea de tiempo para darle más o menos alto (como en CapCut)
  const empezarAsa = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const asa = e.currentTarget;
    asa.setPointerCapture?.(e.pointerId);
    asa.classList.add('es-arrastrando');
    let ultimo = altoLinea;
    const mover = (ev) => {
      ultimo = Math.round(Math.max(210, Math.min(window.innerHeight * 0.6, window.innerHeight - ev.clientY)));
      setAltoLinea(ultimo);
    };
    const soltar = () => {
      asa.classList.remove('es-arrastrando');
      asa.removeEventListener('pointermove', mover);
      asa.removeEventListener('pointerup', soltar);
      asa.removeEventListener('pointercancel', soltar);
      try {
        if (ultimo) window.localStorage.setItem('anuncios-ia:editor:alto-linea', String(ultimo));
      } catch {
        /* sin almacenamiento */
      }
    };
    asa.addEventListener('pointermove', mover);
    asa.addEventListener('pointerup', soltar);
    asa.addEventListener('pointercancel', soltar);
  };

  const bloqueEditando = editando ? subs.find((b) => b.id === editando.id) : null;
  const subtitulosVisibles = ed.subtitulos.visible && subs.length > 0;

  return (
    <div className={`ed${galeria ? ' ed--galeria' : ''}`} style={altoLinea ? { '--alto-lt': `${altoLinea}px` } : undefined}>
      {/* ---------------------------------------------------------------- barra de arriba */}
      <header className="ed-barra">
        <div className="ed-barra__izq">
          <Tooltip texto="Volver al anuncio" lado="abajo">
            <Boton variante="fantasma" tamano="chico" soloIcono icono={ArrowLeft} etiqueta="Volver al anuncio" href={enlace.anuncio(a.slug)} />
          </Tooltip>
          <a href={enlace.tablero()} className="ed-barra__logo" aria-label="Mis anuncios">
            <Logo tamano={26} />
          </a>
          <div className="ed-barra__titulo">
            <h1 className="t-recortar">{a.titulo}</h1>
            <span className="ed-barra__meta">
              <span>{a.estiloNombre || 'Anuncio'}</span>
              <span aria-hidden="true">·</span>
              <span className="t-num">{formatoDuracion(plan.duracion)}</span>
              <span aria-hidden="true">·</span>
              <Guardado estado={guardado} hayCambios={hayCambios} />
            </span>
          </div>
        </div>

        <div className="ed-barra__der">
          <div className="ed-barra__historial">
            <Tooltip texto={puedeDeshacer ? <>Deshacer: {etiquetaDeshacer} <kbd>Ctrl Z</kbd></> : 'Nada para deshacer'} lado="abajo">
              <Boton variante="fantasma" tamano="chico" soloIcono icono={Undo2} etiqueta="Deshacer" onClick={deshacer} disabled={!puedeDeshacer} />
            </Tooltip>
            <Tooltip texto={puedeRehacer ? <>Rehacer: {etiquetaRehacer} <kbd>Ctrl Y</kbd></> : 'Nada para rehacer'} lado="abajo">
              <Boton variante="fantasma" tamano="chico" soloIcono icono={Redo2} etiqueta="Rehacer" onClick={rehacer} disabled={!puedeRehacer} />
            </Tooltip>
          </div>
          <Tooltip texto={atajos ? null : 'Atajos de teclado'} lado="abajo">
            <Boton
              variante="fantasma"
              tamano="chico"
              soloIcono
              icono={Keyboard}
              etiqueta="Atajos de teclado"
              className="ed-solo-ancho"
              aria-expanded={Boolean(atajos)}
              onClick={(e) => setAtajos(atajos ? null : e.currentTarget.getBoundingClientRect())}
            />
          </Tooltip>
          {/* Exportar arma un MP4 nuevo en esta PC (gratis), con la misma composición de la vista previa. */}
          <Tooltip texto={rehaciendo ? 'Espera a que termine de rehacerse la pieza' : exportandoAhora ? 'Ver cómo va la exportación' : 'Un MP4 nuevo con tus cambios. No cuesta nada.'} lado="abajo">
            <Boton variante="primario" icono={exportandoAhora ? LoaderCircle : Download} className={exportandoAhora ? 'ed-exportando-boton' : undefined} onClick={() => setExportar(true)} disabled={rehaciendo && !exportandoAhora}>
              {exportandoAhora ? (exp.trabajo.estado === 'esperando' ? 'En espera' : `Exportando ${Math.round(exp.trabajo.avance?.valor || 0)} %`) : 'Exportar'}
            </Boton>
          </Tooltip>
        </div>
      </header>

      {/* ---------------------------------------------------------------- izquierda: medios */}
      <PanelMedios
        a={a}
        plan={plan}
        pistas={pistas}
        ed={ed}
        cambiar={cambiar}
        acciones={acciones}
        pestana={pestana}
        onPestana={setPestana}
        abierto={panelAbierto}
        onAbrir={setPanelAbierto}
        playerRef={playerRef}
        seleccion={seleccion}
        onIr={irA}
        galeria={datosGaleria}
      />

      {/* ---------------------------------------------------------------- centro: la vista previa */}
      <main className="ed-escenario" aria-label="Vista previa">
        {rehaciendo ? <Rehaciendo t={reh.trabajo} slug={a.slug} onCancelar={() => reh.cancelar().catch((e) => aviso({ tipo: 'error', titulo: 'No pude cancelar', texto: e.message }))} /> : null}
        <div className="ed-escenario__lienzo-zona">
          <div className="ed-lienzo">
            <Player
              ref={playerRef}
              component={AnuncioEditado}
              inputProps={inputProps}
              durationInFrames={Math.max(1, Math.round(plan.duracion * FPS))}
              fps={FPS}
              compositionWidth={ANCHO}
              compositionHeight={ALTO}
              style={{ width: '100%', height: '100%' }}
              clickToPlay
              doubleClickToFullscreen
              spaceKeyToPlayOrPause={false}
              numberOfSharedAudioTags={12}
              errorFallback={() => (
                <div className="ed-lienzo__error">
                  <TriangleAlert size={22} strokeWidth={2} aria-hidden="true" />
                  <span>La vista previa tuvo un problema. Vuelve a cargar la pantalla: tus cambios están guardados.</span>
                </div>
              )}
            />
            {zonaMeta ? <ZonaMeta /> : null}
            <BarraTiempo playerRef={playerRef} listo={playerListo} duracion={plan.duracion} />
          </div>
        </div>
        <Transporte
          playerRef={playerRef}
          listo={playerListo}
          duracion={plan.duracion}
          precarga={precarga}
          extra={
            <Tooltip texto="Muestra dónde pone Meta el nombre, el texto y el botón">
              <Chip tamano="chico" icono={ScanLine} activo={zonaMeta} onClick={() => setZonaMeta((v) => !v)}>
                Zona de Meta
              </Chip>
            </Tooltip>
          }
        />
      </main>

      {/* ---------------------------------------------------------------- derecha: cambios rápidos */}
      <PanelCambios
        plan={plan}
        pistas={pistas}
        subs={subs}
        ed={ed}
        cambiar={cambiar}
        seleccion={seleccion}
        onSeleccionar={setSeleccion}
        acciones={acciones}
        colorAnuncio={colorAnuncio}
        enfoque={enfoque}
        hayCambios={hayCambios}
      />

      {/* ---------------------------------------------------------------- abajo: la línea de tiempo */}
      <div
        className="ed-asa"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Arrastra para cambiar el alto de la línea de tiempo"
        title="Arrastra para cambiar el alto de la línea de tiempo"
        onPointerDown={empezarAsa}
        onDoubleClick={() => {
          setAltoLinea(null);
          try {
            window.localStorage.removeItem('anuncios-ia:editor:alto-linea');
          } catch {
            /* sin almacenamiento */
          }
        }}
      />
      <LineaDeTiempo
        plan={plan}
        pistas={pistasLinea}
        onArrastrar={arrastrar}
        playerRef={playerRef}
        playerListo={playerListo}
        seleccion={seleccion}
        onSeleccionar={setSeleccion}
        onEditarSubtitulo={abrirEdicion}
        editando={editando?.id ?? null}
        ed={ed}
        acciones={acciones}
      />

      {/* ---------------------------------------------------------------- lo que flota */}
      <GaleriaSubtitulos abierta={galeria} onCerrar={() => setGaleria(false)} actual={ed.subtitulos.estilo} onElegir={elegirEnGaleria} {...datosGaleria} />

      {bloqueEditando ? (
        <EditorSubtitulo
          bloque={bloqueEditando}
          ancla={editando.ancla}
          onBorrador={(texto) => setBorrador({ id: editando.id, texto })}
          onCancelar={() => {
            setBorrador(null);
            setEditando(null);
          }}
          onOcultar={() => {
            const id = editando.id;
            cambiar((s) => ({ ...s, ocultos: [...new Set([...s.ocultos, id])] }), { etiqueta: `Ocultar subtítulo ${id + 1}` });
            setBorrador(null);
            setEditando(null);
          }}
          onGuardar={(texto) => {
            const id = editando.id;
            const original = plan.subtitulos[id]?.texto;
            cambiar(
              (s) => {
                const c = { ...s.correcciones };
                if (!texto || texto === original) delete c[id];
                else c[id] = texto;
                return { ...s, correcciones: c, ocultos: texto ? s.ocultos : [...new Set([...s.ocultos, id])] };
              },
              { etiqueta: `Corregir subtítulo ${id + 1}` }
            );
            setBorrador(null);
            setEditando(null);
            if (texto && texto !== original) aviso({ tipo: 'ok', titulo: 'Subtítulo corregido', texto: `Ahora dice «${texto}».`, duracion: 3000 });
          }}
        />
      ) : null}

      <Atajos ancla={atajos} onCerrar={() => setAtajos(null)} />

      <ModalExportar
        abierto={exportar}
        onCerrar={() => setExportar(false)}
        a={a}
        duracion={plan.duracion}
        subs={subs}
        cambios={cambios}
        subtitulosVisibles={subtitulosVisibles}
        hayMusica={Boolean(pistas.musica) && !ed.musica.silenciada}
        versionInicial={versionPedida}
        exp={exp}
        alExportar={(opciones) => exp.exportar({ ...opciones, estado: ed, contexto: contextoGuardado })}
      />
      {reh.disponible ? (
        <ModalRehacer abierto={rehacerCon !== undefined} onCerrar={() => setRehacerCon(undefined)} objetivo={rehacerCon || null} pistas={pistas} reh={reh} alPedir={pedirRehacer} />
      ) : null}

      <input
        ref={archivoRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
        className="visualmente-oculto"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          usarArchivo(f);
        }}
      />

      {soltando ? (
        <div className="ed-soltando" aria-hidden="true">
          <div className="ed-soltando__caja">
            <span className="ed-soltando__icono">
              <Music size={28} strokeWidth={1.8} />
            </span>
            <span className="ed-soltando__titulo">{mv === 'cancion' ? 'En los musicales la canción no se cambia' : 'Suelta tu canción para usarla de música'}</span>
            <span className="ed-soltando__detalle">{mv === 'cancion' ? 'La canción es el anuncio.' : 'MP3, WAV o M4A · se escucha al instante en la vista previa'}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

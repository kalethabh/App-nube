// "Exportar": una versión nueva del anuncio con tus cambios, en 720p o 1080p, y el .srt.
//
// La entrega trae solo la versión completa: las demás se sacan de aquí con un clic (VERSIONES): sin subtítulos,
// sin música o limpia (sin las dos, para CapCut). La versión elegida se aplica solo a ese video: los cambios
// guardados del editor no se tocan (el servidor recibe `version` aparte de tus cambios).
//
// La arma la app en esta PC (produccion/exportar-edicion.js, gratis) con LA MISMA composición que la vista
// previa, y antes de dársela por buena pasa su revisión final. Sale como un archivo nuevo en tu carpeta de
// videos (output/<anuncio>_editado-N.mp4): lo que ya te entregamos no se toca. El avance que se ve es el real.
// Se arma por tramos de 4 s y solo se rehace lo que cambió (produccion/exportar-tramos.js): la nota del avance dice
// cuántos tramos se rehacen o si solo cambió el sonido.
// Se puede cerrar esta ventana mientras exporta: el editor avisa cuando termina.
import { useEffect, useMemo, useState } from 'react';
import { CaptionsOff, Check, CircleCheck, Download, Eraser, FileText, FileVideo, Film, LoaderCircle, MonitorPlay, Play, RefreshCw, ShieldCheck, Sparkles, TriangleAlert, VolumeX, Zap } from 'lucide-react';
import { BarraDeProgreso, Boton, Interruptor, Modal } from '../../componentes/index.js';
import { duracionEnPalabras, numero } from '../../datos/formato.js';
import { miniatura } from '../../datos/api.js';
import { descargarTexto, hacerSrt } from './srt.js';
import { exportacionEnMarcha } from './trabajos.js';

const ETAPAS = [
  { id: 'preparar', etapas: ['preparar', 'armar'], titulo: 'Preparando tus cambios', detalle: 'Junto el montaje con lo que tocaste en el editor.' },
  { id: 'render', etapas: ['render'], titulo: 'Armando el video', detalle: 'Por tramos de 4 segundos, con el mismo montaje de la vista previa: solo se rehace lo que cambiaste.' },
  { id: 'revisar', etapas: ['revisar', 'repetir'], titulo: 'Revisión final', detalle: 'Que no haya cuadros negros ni imágenes congeladas de más de un segundo, y que dure y se vea como debe.' },
  { id: 'guardar', etapas: ['guardar'], titulo: 'Guardando', detalle: 'Sale como un archivo nuevo, junto a tus otras versiones.' },
];

/**
 * Las versiones que se sacan de un clic. `sub` y `musica`: lo que lleva cada una. Solo se ofrecen las que
 * cambian algo: sin subtítulos en el anuncio no está "Sin subtítulos", y sin música (o en un musical) no está
 * "Sin música" ni "Limpia".
 */
const VERSIONES = [
  { id: 'completa', titulo: 'Completa', icono: Film, sub: true, musica: true },
  { id: 'sin-subtitulos', titulo: 'Sin subtítulos', icono: CaptionsOff, sub: false, musica: true },
  { id: 'sin-musica', titulo: 'Sin música', icono: VolumeX, sub: true, musica: false },
  { id: 'limpia', titulo: 'Limpia', icono: Eraser, sub: false, musica: false },
];

/** Lo que lleva cada versión, en minúsculas (según lo que tiene el anuncio): "sin subtítulos y con música". */
function queLleva(v, haySubtitulos, hayMusica) {
  if (v.id === 'limpia') return 'sin subtítulos ni música';
  const partes = [];
  if (haySubtitulos) partes.push(v.sub ? 'con subtítulos' : 'sin subtítulos');
  if (hayMusica) partes.push(v.musica ? 'con música' : 'sin música');
  return partes.join(' y ') || 'tal como está';
}

/** Lo mismo, para la tarjeta de cada versión. */
function detalleVersion(v, haySubtitulos, hayMusica) {
  const texto = queLleva(v, haySubtitulos, hayMusica) + (v.id === 'limpia' ? ', para CapCut' : '');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Las versiones que tienen sentido para este anuncio. */
function versionesPosibles(haySubtitulos, hayMusica) {
  return VERSIONES.filter((v) => (haySubtitulos || v.sub) && (hayMusica || v.musica));
}

/** Lo que lleva un video ya exportado (o exportándose), en palabras. */
function resumenTrabajo(t) {
  if (t?.version === 'limpia') return 'sin subtítulos ni música';
  const partes = [t?.subtitulos === 'sin' ? 'sin subtítulos' : 'con subtítulos'];
  if (t?.sinMusica) partes.push('sin música');
  return partes.join(' · ');
}

/** Lo que tarda, más o menos (medido: un anuncio de 56 s sale en ~1:45 a 720p en esta PC). */
const estimado = (duracion, calidad) => 25 + duracion * (calidad === '1080' ? 3.2 : 1.6);

function minutos(seg) {
  if (seg < 50) return `≈ ${Math.max(10, Math.round(seg / 10) * 10)} s`;
  const m = Math.round((seg / 60) * 2) / 2;
  return `≈ ${String(m).replace('.', ',')} min`;
}
const mb = (bytes) => `${String(Math.round((bytes / 1024 / 1024) * 10) / 10).replace('.', ',')} MB`;

export function ModalExportar({ abierto, onCerrar, a, duracion, subs, cambios, subtitulosVisibles, hayMusica = false, versionInicial = null, exp, alExportar }) {
  const haySubtitulos = subs.length > 0;
  const posibles = versionesPosibles(haySubtitulos, hayMusica);
  // la que se elige al abrir: la que se pidió (desde la entrega) o la completa (sin subtítulos si los ocultaste)
  const inicial = () => {
    if (versionInicial && posibles.some((v) => v.id === versionInicial)) return versionInicial;
    return haySubtitulos && !subtitulosVisibles && posibles.some((v) => v.id === 'sin-subtitulos') ? 'sin-subtitulos' : 'completa';
  };
  const [calidad, setCalidad] = useState('1080');
  const [version, setVersion] = useState(inicial);
  const [conSrt, setConSrt] = useState(true);
  const [pidiendo, setPidiendo] = useState(false);
  const [errorPedido, setErrorPedido] = useState(null);
  const [vista, setVista] = useState('elegir'); // elegir | trabajo
  const [inicio, setInicio] = useState(null); // cuando arrancó, para calcular lo que falta
  const t = exp.trabajo;
  const elegida = posibles.find((v) => v.id === version) || posibles[0];

  useEffect(() => {
    if (!abierto) return;
    setErrorPedido(null);
    setVersion(inicial());
    // si hay una exportación en marcha (o recién terminada), se abre mostrándola
    setVista(exportacionEnMarcha(t) ? 'trabajo' : 'elegir');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, subtitulosVisibles, versionInicial]);

  useEffect(() => {
    if (exportacionEnMarcha(t) && !inicio) setInicio(Date.now());
    if (!exportacionEnMarcha(t)) setInicio(null);
  }, [t, inicio]);

  const n = vista === 'trabajo' && t ? t.n : exp.siguiente;
  const nombre = `${a.slug}_editado-${n}.mp4`;
  const nombreSrt = `${a.slug}_editado-${n}.srt`;
  const srtLocal = useMemo(() => (haySubtitulos ? hacerSrt(subs) : ''), [subs, haySubtitulos]);

  const exportar = async () => {
    setPidiendo(true);
    setErrorPedido(null);
    try {
      await alExportar({ calidad, version: elegida.id, subtitulos: haySubtitulos && elegida.sub ? 'con' : 'sin', srt: haySubtitulos && conSrt });
      setVista('trabajo');
      setInicio(Date.now());
    } catch (e) {
      setErrorPedido(e.message);
    } finally {
      setPidiendo(false);
    }
  };

  const fase = vista === 'elegir' || !t ? 'elegir' : exportacionEnMarcha(t) ? 'exportando' : t.estado === 'listo' ? 'listo' : 'error';
  const avance = t?.avance?.valor ?? 0;
  const etapaActual = t?.estado === 'esperando' ? -1 : ETAPAS.findIndex((e) => e.etapas.includes(t?.avance?.etapa || 'preparar'));
  const transcurrido = inicio ? (Date.now() - inicio) / 1000 : 0;
  const faltan = avance > 4 && transcurrido > 3 ? (transcurrido / avance) * (100 - avance) : estimado(duracion, t?.calidad || calidad) * (1 - avance / 100);
  const r = t?.resultado;

  let pie;
  if (fase === 'elegir') {
    pie = (
      <>
        <Boton variante="fantasma" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton variante="primario" icono={Download} onClick={exportar} cargando={pidiendo} data-autofocus>
          Armar en {calidad}p
        </Boton>
      </>
    );
  } else if (fase === 'exportando') {
    pie = (
      <>
        <Boton variante="fantasma" onClick={() => exp.cancelar()}>
          Cancelar
        </Boton>
        <Boton variante="secundario" onClick={onCerrar} data-autofocus>
          Seguir editando
        </Boton>
      </>
    );
  } else if (fase === 'listo') {
    pie = (
      <>
        {r?.srt ? (
          <Boton variante="secundario" icono={FileText} href={r.srt.url} download={r.srt.archivo}>
            Descargar .srt
          </Boton>
        ) : t?.srt && haySubtitulos ? (
          <Boton variante="secundario" icono={FileText} onClick={() => descargarTexto(nombreSrt, srtLocal)}>
            Descargar .srt
          </Boton>
        ) : null}
        {r ? (
          <Boton variante="secundario" icono={Play} href={r.url} target="_blank" rel="noreferrer">
            Verlo
          </Boton>
        ) : null}
        {r ? (
          <Boton variante="primario" icono={Download} href={r.url} download={r.archivo} data-autofocus>
            Descargar
          </Boton>
        ) : (
          <Boton variante="primario" onClick={onCerrar} data-autofocus>
            Listo
          </Boton>
        )}
      </>
    );
  } else {
    pie = (
      <>
        <Boton variante="fantasma" onClick={onCerrar}>
          Cerrar
        </Boton>
        <Boton variante="primario" icono={RefreshCw} onClick={() => setVista('elegir')} data-autofocus>
          Volver a intentar
        </Boton>
      </>
    );
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      icono={fase === 'listo' ? CircleCheck : fase === 'error' ? TriangleAlert : Download}
      tono={fase === 'listo' ? 'ok' : fase === 'error' ? 'error' : 'acento'}
      titulo={fase === 'listo' ? 'Tu video está listo' : fase === 'exportando' ? 'Armando tu video' : fase === 'error' ? 'No se pudo armar tu video' : 'Descargar tu video'}
      descripcion={
        fase === 'listo'
          ? 'Salió como un archivo nuevo. Lo que ya te entregamos sigue igual.'
          : fase === 'exportando'
            ? 'Puedes cerrar esta ventana y seguir editando: te aviso cuando termine.'
            : fase === 'error'
              ? 'No se gastó nada: exportar no cuesta. Puedes volver a intentarlo.'
              : 'Se arma con tus cambios en esta PC y después lo descargas. No cuesta nada, y lo que ya te entregamos no se toca.'
      }
      pie={pie}
      className="ed-exportar"
    >
      {fase === 'elegir' ? (
        <div className="ed-exportar__cuerpo">
          {posibles.length > 1 ? (
            <div className="ed-exportar__grupo">
              <span className="ed-exportar__etiqueta">Versión</span>
              <div className="ed-opciones ed-opciones--versiones" role="radiogroup" aria-label="Versión">
                {posibles.map((v) => (
                  <button key={v.id} type="button" role="radio" aria-checked={elegida.id === v.id} className={`ed-opcion ed-opcion--version${elegida.id === v.id ? ' es-sel' : ''}`} onClick={() => setVersion(v.id)}>
                    <span className="ed-opcion__cabeza">
                      <v.icono size={15} strokeWidth={2} aria-hidden="true" />
                      <span className="ed-opcion__titulo">{v.titulo}</span>
                    </span>
                    <span className="ed-opcion__detalle">{detalleVersion(v, haySubtitulos, hayMusica)}</span>
                    <span className="ed-opcion__marca" aria-hidden="true">
                      <Check size={12} strokeWidth={3.2} />
                    </span>
                  </button>
                ))}
              </div>
              {haySubtitulos ? (
                <Interruptor activado={conSrt} onCambio={setConSrt} etiqueta="Incluir el archivo de subtítulos (.srt)" descripcion="Para subirlos aparte a Meta, TikTok o YouTube. Lleva tus correcciones." />
              ) : null}
            </div>
          ) : haySubtitulos ? (
            <div className="ed-exportar__grupo">
              <Interruptor activado={conSrt} onCambio={setConSrt} etiqueta="Incluir el archivo de subtítulos (.srt)" descripcion="Para subirlos aparte a Meta, TikTok o YouTube. Lleva tus correcciones." />
            </div>
          ) : null}

          <div className="ed-exportar__grupo">
            <span className="ed-exportar__etiqueta">Calidad</span>
            <div className="ed-opciones" role="radiogroup" aria-label="Calidad">
              {[
                { id: '720', titulo: '720p', lema: 'Rápido', detalle: 'Pesa menos. Ideal para probar.', icono: Zap },
                { id: '1080', titulo: '1080p', lema: 'Máxima nitidez', detalle: 'La que conviene para publicar.', icono: MonitorPlay },
              ].map((o) => (
                <button key={o.id} type="button" role="radio" aria-checked={calidad === o.id} className={`ed-opcion${calidad === o.id ? ' es-sel' : ''}`} onClick={() => setCalidad(o.id)}>
                  <span className="ed-opcion__cabeza">
                    <o.icono size={16} strokeWidth={2} aria-hidden="true" />
                    <span className="ed-opcion__titulo">{o.titulo}</span>
                    <span className="ed-opcion__tiempo t-num">{minutos(estimado(duracion, o.id))}</span>
                  </span>
                  <span className="ed-opcion__lema">{o.lema}</span>
                  <span className="ed-opcion__detalle">{o.detalle}</span>
                  <span className="ed-opcion__marca" aria-hidden="true">
                    <Check size={12} strokeWidth={3.2} />
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="ed-exportar__grupo">
            <span className="ed-exportar__etiqueta">Lo que lleva tu versión</span>
            {cambios.length ? (
              <ul className="ed-cambios">
                {cambios.map((c) => (
                  <li key={c} className="ed-cambios__item">
                    <Sparkles size={12} strokeWidth={2.4} aria-hidden="true" />
                    {c}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ed-nota">
                {elegida.id === 'completa' ? 'Todavía no cambiaste nada: saldría igual a la versión entregada.' : `Sin cambios tuyos: es la versión entregada, ${queLleva(elegida, haySubtitulos, hayMusica)}.`}
              </p>
            )}
          </div>

          <div className="ed-archivo">
            <FileVideo size={18} strokeWidth={2} aria-hidden="true" />
            <div className="ed-archivo__textos">
              <span className="ed-archivo__nombre t-mono t-recortar">{nombre}</span>
              <span className="ed-archivo__detalle">En tu carpeta de videos, junto a las otras versiones · {duracionEnPalabras(duracion)}</span>
            </div>
          </div>

          {errorPedido ? (
            <p className="ed-nota ed-nota--error" role="alert">
              <TriangleAlert size={14} strokeWidth={2.2} aria-hidden="true" />
              {errorPedido}
            </p>
          ) : null}
        </div>
      ) : null}

      {fase === 'exportando' ? (
        <div className="ed-exportando">
          <div className="ed-exportando__cabeza">
            <span className="ed-exportando__poster">
              {a.miniatura ? <img src={miniatura(a.miniatura, 240)} alt="" /> : null}
              <span className="ed-exportando__brillo" aria-hidden="true" />
            </span>
            <div className="ed-exportando__textos">
              <span className="ed-exportando__etapa">{t.frase}</span>
              {/* (nota: lo que hace la exportación por tramos, p. ej. «Rehaciendo 2 de 10 tramos (lo demás ya estaba)») */}
              <span className="ed-exportando__detalle">{t.estado !== 'esperando' && t.avance?.nota ? t.avance.nota : etapaActual >= 0 ? ETAPAS[etapaActual].detalle : 'Empieza apenas termine el otro: de a uno, para no trabar la PC.'}</span>
              <BarraDeProgreso
                valor={avance}
                tono="cian"
                animada
                indeterminada={t.estado === 'esperando'}
                grosor="gruesa"
                detalle={t.avance?.etapa === 'render' && t.avance?.total ? `Cuadro ${numero(t.avance.cuadro || 0)} de ${numero(t.avance.total)} · ` : null}
                mostrarValor={t.estado !== 'esperando'}
                etiqueta={`${t.calidad}p · ${t.estado === 'esperando' ? 'en espera' : `faltan ${minutos(Math.max(5, faltan)).replace('≈ ', '')}`}`}
              />
            </div>
          </div>
          <ol className="ed-etapas">
            {ETAPAS.map((e, i) => {
              const estado = etapaActual > i ? 'listo' : etapaActual === i ? 'ahora' : 'despues';
              return (
                <li key={e.id} className={`ed-etapa es-${estado}`}>
                  <span className="ed-etapa__punto" aria-hidden="true">
                    {estado === 'listo' ? <Check size={12} strokeWidth={3} /> : estado === 'ahora' ? <LoaderCircle size={12} strokeWidth={2.6} className="girando" /> : null}
                  </span>
                  {e.titulo}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {fase === 'listo' ? (
        <div className="ed-listo">
          <div className="ed-archivo">
            <FileVideo size={18} strokeWidth={2} aria-hidden="true" />
            <div className="ed-archivo__textos">
              <span className="ed-archivo__nombre t-mono t-recortar">{r?.archivo || nombre}</span>
              <span className="ed-archivo__detalle">
                {t.calidad}p · {resumenTrabajo(t)}
                {r?.bytes ? ` · ${mb(r.bytes)}` : ''}
              </span>
            </div>
          </div>
          {r?.srt ? (
            <div className="ed-archivo">
              <FileText size={18} strokeWidth={2} aria-hidden="true" />
              <div className="ed-archivo__textos">
                <span className="ed-archivo__nombre t-mono t-recortar">{r.srt.archivo}</span>
                <span className="ed-archivo__detalle">{subs.filter((b) => !b.oculto).length} subtítulos con tus correcciones</span>
              </div>
            </div>
          ) : null}
          {t.control?.limpio ? (
            <p className="ed-nota ed-nota--ok">
              <ShieldCheck size={14} strokeWidth={2.2} aria-hidden="true" />
              Pasó la revisión final: sin cuadros negros ni imágenes congeladas de más de un segundo, con su largo y su tamaño.
            </p>
          ) : t.control ? (
            <div className="ed-revision" role="status">
              <p className="ed-nota ed-nota--aviso">
                <TriangleAlert size={14} strokeWidth={2.2} aria-hidden="true" />
                {t.control.codigo === 2 ? 'El video salió, pero no pude revisarlo entero.' : 'El video salió, y la revisión encontró esto:'}
              </p>
              {t.control.defectos?.length || t.control.avisos?.length ? (
                <ul className="ed-cambios">
                  {[...(t.control.defectos || []), ...(t.control.avisos || [])].map((d) => (
                    <li key={d} className="ed-cambios__item">
                      {d}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {fase === 'error' ? (
        <div className="ed-listo">
          <p className="ed-nota ed-nota--error" role="alert">
            <TriangleAlert size={14} strokeWidth={2.2} aria-hidden="true" />
            {t?.estado === 'cancelado' ? 'Cancelaste la exportación.' : t?.error?.mensaje || 'No pude exportar el video.'}
          </p>
        </div>
      ) : null}
    </Modal>
  );
}

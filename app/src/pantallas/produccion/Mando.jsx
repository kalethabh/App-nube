// La cabecera de la producción: el monitor con lo último que llegó, el avance en palabras, la barra,
// el tiempo que falta, las piezas y la línea de etapas. Sin precios: el costo va solo en la entrega.
// Con conductor, la línea de etapas sale de sus pasos (v.etapas / v.detalles, ver ./vivo.js) y si el
// anuncio está frenado (v.alto) la insignia dice por qué.
import { useContext, useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  Clapperboard,
  Link2,
  PenLine,
  Shuffle,
  Clock,
  Film,
  Images,
  Layers,
  Mic,
  Music,
  ScanEye,
  Scissors,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import { BarraDeProgreso, Boton, Insignia, VistaPrevia } from '../../componentes/index.js';
import { arregladasSolas, duracion as fmtDuracion, fechaRelativa } from '../../datos/formato.js';
import { miniatura } from '../../datos/api.js';
import { partesArregladas, quien } from './modelo.js';
import { MarcaModoPrueba } from './ModoPrueba.jsx';
import { MiniaturasAlDia } from './Pieza.jsx';

const ICONOS = { Mic, Music, UserRound, Images, Film, ScanEye, Scissors, Clapperboard, ShieldCheck, ClipboardCheck, Sparkles, Link2, PenLine, Shuffle };

/** "≈ 6 min" · "menos de 1 min" (nunca "~": parece un signo menos) */
function enMinutos(seg) {
  if (!Number.isFinite(seg)) return '—';
  if (seg < 50) return 'menos de 1 min';
  return `≈ ${Math.max(1, Math.round(seg / 60))} min`;
}

/** 'Toma 6 · Inicio' · 'B-roll 3 · Clip' · 'Hoja de mujer' (para el pie del monitor) */
function nombreCorto(p) {
  if (p.broll) return `B-roll ${p.broll}`;
  if (p.tipo === 'paso') return `Paso a la toma ${p.hacia}`;
  if (p.toma) return p.clase === 'clip' ? `Toma ${p.toma}` : `Toma ${p.toma} · ${p.etiqueta.toLowerCase()}`;
  return quien(p);
}

// ---------------------------------------------------------------- monitor

/** Lo último que llegó, grande. Cada pieza nueva entra con un fundido encima de la anterior. */
function Monitor({ capas, etiqueta, sub, enVivo }) {
  return (
    <div className="prod-monitor">
      <div className="prod-monitor__pantalla">
        {capas.length ? (
          capas.map((c, i) => (
            <div key={c.clave} className={`prod-monitor__capa${i === capas.length - 1 ? ' prod-monitor__capa--arriba' : ''}`}>
              {c.video && c.alPasar ? (
                // estado real: la primera toma quieta y el video (sin sonido) recién al pasar el mouse
                <video
                  src={c.video}
                  poster={c.poster || undefined}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  disablePictureInPicture
                  onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                  onMouseLeave={(e) => {
                    e.currentTarget.pause();
                    e.currentTarget.currentTime = 0;
                  }}
                />
              ) : c.video ? (
                <video src={c.video} poster={c.poster || undefined} muted loop autoPlay playsInline preload="auto" disablePictureInPicture />
              ) : (
                <img src={c.imagen} alt="" decoding="async" />
              )}
            </div>
          ))
        ) : (
          <div className="prod-monitor__vacio">
            <Clapperboard size={26} strokeWidth={1.6} aria-hidden="true" />
            <span>Aquí aparece cada pieza apenas llega</span>
          </div>
        )}
        <span className="prod-monitor__sombra" aria-hidden="true" />
        {enVivo ? (
          <span className="prod-monitor__vivo">
            <i className="punto punto--generando punto--latido" /> En vivo
          </span>
        ) : null}
      </div>
      <div className="prod-monitor__pie">
        <span className="prod-monitor__etiqueta t-recortar">{etiqueta}</span>
        {sub ? <span className="prod-monitor__sub t-recortar">{sub}</span> : null}
      </div>
    </div>
  );
}

/** Mantiene las dos últimas capas del monitor para que la nueva entre con fundido. */
function useCapas(capa) {
  const [capas, setCapas] = useState(capa ? [capa] : []);
  useEffect(() => {
    if (!capa) return;
    setCapas((cs) => (cs[cs.length - 1]?.clave === capa.clave ? cs : [...cs.slice(-1), capa]));
  }, [capa?.clave]); // eslint-disable-line react-hooks/exhaustive-deps
  return capas;
}

// ---------------------------------------------------------------- etapas

export function Etapas({ etapas, estados, detalles }) {
  // la "actual" es la última que arrancó y no terminó (si hay varias en marcha a la vez)
  const enMarcha = etapas.filter((e) => estados[e.id] === 'en-marcha' || estados[e.id] === 'error');
  const actual = enMarcha[enMarcha.length - 1]?.id;
  return (
    <ol className={`prod-etapas${etapas.length > 7 ? ' prod-etapas--muchas' : ''}`} aria-label="Etapas de la producción">
      {etapas.map((e, i) => {
        const est = estados[e.id] || 'pendiente';
        const Icono = ICONOS[e.icono] || Film;
        const siguiente = etapas[i + 1];
        const sig = siguiente ? estados[siguiente.id] || 'pendiente' : null;
        const tramo = !siguiente ? null : sig === 'hecha' ? 'ok' : sig === 'en-marcha' ? 'cian' : 'vacio';
        return (
          <li
            key={e.id}
            className={`prod-etapa prod-etapa--${est}${actual === e.id ? ' prod-etapa--actual' : ''}`}
            aria-current={actual === e.id ? 'step' : undefined}
          >
            <span className="prod-etapa__nodo" aria-hidden="true">
              {est === 'hecha' ? (
                <Check size={15} strokeWidth={2.8} />
              ) : est === 'error' ? (
                <TriangleAlert size={15} strokeWidth={2.3} />
              ) : (
                <Icono size={15} strokeWidth={2.1} />
              )}
            </span>
            <span className="prod-etapa__textos">
              <span className="prod-etapa__nombre">{e.nombre}</span>
              <span className="prod-etapa__detalle t-num" title={detalles[e.id] || undefined}>
                {detalles[e.id] || (est === 'hecha' ? 'Lista' : est === 'en-marcha' ? 'En marcha' : est === 'error' ? 'Se trabó' : 'Después')}
              </span>
            </span>
            {tramo ? <span className={`prod-etapa__tramo prod-etapa__tramo--${tramo}`} aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------- la insignia de arriba

/** Terminado · Produciendo · En la fila · o por qué está frenado (algo falló, falta saldo, sin conexión). */
function InsigniaEstado({ v }) {
  if (v.terminado) return <Insignia estado="listo" texto="Terminado" />;
  if (v.alto?.tipo === 'error') return <Insignia estado="error" />;
  if (v.alto?.tipo === 'saldo') return <Insignia estado="te-necesita" texto="Recarga tu saldo" />;
  if (v.alto?.tipo === 'pausa') return <Insignia estado="te-necesita" texto="En pausa" />;
  if (v.alto?.tipo === 'conexion') return <Insignia estado="en-cola" texto="Esperando la conexión" />;
  if (v.alto?.tipo === 'reintento') return <Insignia estado="en-cola" texto="Reintentando" />;
  if (v.esperandoTu) return <Insignia estado="te-necesita" />;
  if (v.enFila || (v.etapas && !v.paso)) return <Insignia estado="en-cola" texto="En la fila" />;
  return <Insignia estado="generando" texto="Produciendo" />;
}

// ---------------------------------------------------------------- la cabecera completa

export function Mando({ a, modelo, v, etapas, simulando, frase, detalle, avance, enlaceEntrega, compacto = false }) {
  const ultimaPieza = v.ultimo ? modelo.porId.get(v.ultimo.id) : null;
  // (su imagen, recién con el detalle de ahora: el de otra visita puede nombrar una toma que se está rehaciendo)
  const alDia = useContext(MiniaturasAlDia);
  const arregladas = partesArregladas(modelo, v.estados);
  // al terminar (de verdad o en la simulación) el monitor pasa a mostrar el anuncio completo
  const terminadoReal = a.estado === 'listo' && (!simulando || v.terminado) && Boolean(a.video);
  const capa = terminadoReal
    ? { clave: 'final', video: a.video, poster: a.miniatura ? miniatura(a.miniatura, 480) : null, alPasar: !simulando }
    : ultimaPieza && alDia
      ? ultimaPieza.clase === 'clip'
        ? { clave: ultimaPieza.id, video: ultimaPieza.video, poster: miniatura(ultimaPieza.fuente || ultimaPieza.video, 480, ultimaPieza.fuente ? undefined : { segundo: 0.5 }) }
        : { clave: ultimaPieza.id, imagen: miniatura(ultimaPieza.imagen, 480) }
      : null;
  const capas = useCapas(capa);

  const totalPiezas = modelo.piezas.length;
  const hechas = v.conteo.imagenes + v.conteo.clips;
  const enCamino = v.conteo.generandoImg + v.conteo.generandoClip;

  // lo que la revisión de la IA mandó rehacer (conductor.rehechos): "Sin problemas" no sería cierto. Las tomas por su
  // número y los B-roll aparte (la pieza de un B-roll trae el número de la toma sobre la que va)
  const rehechasIA = new Set(modelo.piezas.filter((p) => p.rehecha && !p.broll && p.toma !== null && p.toma !== undefined).map((p) => p.toma)).size;
  const brollIA = new Set(modelo.piezas.filter((p) => p.rehecha && p.broll).map((p) => p.broll)).size;
  const rehechoIA = [rehechasIA ? `${rehechasIA} ${rehechasIA === 1 ? 'toma rehecha' : 'tomas rehechas'}` : null, brollIA ? `${brollIA} B-roll ${brollIA === 1 ? 'rehecho' : 'rehechos'}` : null].filter(Boolean).join(' · ');
  const detalles = v.detalles || {
    voz: modelo.cantado ? 'Elegida' : modelo.hablado ? `${modelo.hojas.filter((h) => h.tipo === 'hoja').length} ${modelo.hojas.length === 1 ? 'hoja' : 'hojas'}` : a.duracion ? fmtDuracion(a.duracion) : null,
    imagenes: `${v.conteo.imagenes} de ${modelo.imagenes.length}`,
    videos: `${v.conteo.clips} de ${modelo.clips.length}`,
    revision: modelo.hablado ? (v.etapa.revision === 'hecha' ? 'Aprobada' : v.etapa.revision === 'en-marcha' ? 'Te toca' : 'Clip por clip') : v.etapa.revision === 'hecha' ? rehechoIA || 'Sin problemas' : 'Automática',
    montaje: v.etapa.montaje === 'hecha' ? 'Listo' : 'Subtítulos y música',
    render: v.etapa.render === 'hecha' ? 'Completa' : v.etapa.render === 'en-marcha' ? 'Renderizando' : 'En tu PC',
    control: v.etapa.control === 'hecha' ? 'Sin problemas' : 'Negros y cortes',
  };

  const tono = v.esperandoTu ? 'error' : v.terminado ? 'ok' : 'cian';
  const insignia = <InsigniaEstado v={v} />;
  // en la revisión de clips: una sola franja (lo importante es el reproductor)
  if (compacto) {
    return (
      <section
        className={`prod-mando prod-mando--compacto${v.esperandoTu ? ' prod-mando--espera' : ''}${v.terminado ? ' prod-mando--listo' : ''}`}
        aria-label="Avance de la producción"
      >
        <div className="prod-mando__resumen">
          <div className="prod-mando__arriba">
            {insignia}
            {simulando ? <VistaPrevia texto="Simulación" /> : null}
            {v.modoPrueba ? <MarcaModoPrueba /> : null}
          </div>
          <h2 className="prod-mando__frase prod-mando__frase--chica">{frase}</h2>
          <BarraDeProgreso valor={avance * 100} tono={tono === 'error' ? 'aviso' : tono} grosor="fina" animada={!v.terminado && !v.esperandoTu} />
        </div>
        <Etapas etapas={etapas} estados={v.etapa} detalles={detalles} />
      </section>
    );
  }

  return (
    <section className={`prod-mando${v.esperandoTu ? ' prod-mando--espera' : ''}${v.terminado ? ' prod-mando--listo' : ''}`} aria-label="Avance de la producción">
      <Monitor
        capas={capas}
        enVivo={(simulando || Boolean(v.etapas)) && !v.terminado && !v.alto}
        etiqueta={terminadoReal ? 'Tu anuncio' : ultimaPieza ? `Llegó: ${nombreCorto(ultimaPieza)}` : 'Esperando la primera pieza'}
        sub={terminadoReal ? `Versión completa · ${fmtDuracion(a.duracion)}` : ultimaPieza ? (ultimaPieza.clase === 'clip' ? 'Clip' : 'Imagen') + (ultimaPieza.modelo ? ` · ${ultimaPieza.modelo}` : '') : null}
      />

      <div className="prod-mando__centro">
        <div className="prod-mando__arriba">
          {insignia}
          {!v.terminado && !v.esperandoTu && v.necesita ? (
            <Insignia estado="te-necesita" texto={v.conteo.necesitan > 1 ? `${v.conteo.necesitan} te necesitan` : '1 pieza te necesita'} />
          ) : null}
          {simulando ? <VistaPrevia texto="Simulación" explicacion="Las piezas son las reales de este anuncio; el orden y los tiempos imitan cómo llegarían desde kie, acelerados." /> : null}
          {v.modoPrueba ? <MarcaModoPrueba /> : null}
          {v.terminado && enlaceEntrega && (simulando || v.etapas) ? (
            <Boton variante="primario" tamano="chico" href={enlaceEntrega} iconoDerecha={ArrowRight} className="prod-mando__cta">
              Ver tu anuncio
            </Boton>
          ) : null}
        </div>
        <h2 className="prod-mando__frase" aria-live="polite">
          {frase}
        </h2>
        <p className="prod-mando__detalle">{detalle}</p>
        <BarraDeProgreso valor={avance * 100} tono={tono === 'error' ? 'aviso' : tono} grosor="gruesa" animada={!v.terminado && !v.esperandoTu} mostrarValor etiqueta="Avance" />

        <div className="prod-datos">
          <div className="prod-dato">
            <span className="prod-dato__etiqueta">
              <Clock size={13} strokeWidth={2.2} aria-hidden="true" /> {v.terminado ? 'Tiempo' : 'Falta'}
            </span>
            <span className="prod-dato__valor t-num">{v.terminado ? (simulando ? enMinutos(v.total) : 'Listo') : v.esperandoTu || v.alto ? 'En pausa' : enMinutos(v.falta)}</span>
            <span className="prod-dato__sub">
              {v.terminado
                ? simulando
                  ? 'desde el "Sí" hasta el final'
                  : `terminó ${fechaRelativa(a.versiones?.find((x) => x.principal)?.fecha || a.fecha)}`
                : v.alto?.tipo === 'conexion'
                  ? 'sigue sola al volver internet'
                  : v.alto?.tipo === 'reintento'
                    ? 'sigue sola en un momento'
                    : v.alto
                    ? 'sigue apenas toques “Continuar”'
                    : v.esperandoTu
                      ? 'sigue apenas decidas'
                      : v.enFila
                        ? 'desde que le toque su turno'
                        : simulando
                        ? `de ${enMinutos(v.total).replace('≈ ', 'unos ')} en total`
                        : 'estimado con lo que falta'}
            </span>
          </div>
          <div className="prod-dato">
            <span className="prod-dato__etiqueta">
              <Layers size={13} strokeWidth={2.2} aria-hidden="true" /> Piezas
            </span>
            <span className="prod-dato__valor t-num">
              {hechas}
              <span className="prod-dato__de"> / {totalPiezas}</span>
            </span>
            <span className="prod-dato__sub">
              {[
                enCamino ? `${enCamino} en camino` : null,
                arregladas.n ? arregladasSolas(arregladas.n, arregladas.soloTomas) : null,
                v.conteo.necesitan ? `${v.conteo.necesitan} te necesita` : null,
              ]
                .filter(Boolean)
                .join(' · ') || (hechas === 0 ? 'todavía no llega ninguna' : hechas === totalPiezas ? 'todas llegaron bien' : `faltan ${totalPiezas - hechas}`)}
            </span>
          </div>
        </div>
      </div>

      <Etapas etapas={etapas} estados={v.etapa} detalles={detalles} />
    </section>
  );
}

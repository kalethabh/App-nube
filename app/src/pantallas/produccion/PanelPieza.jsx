// El panel lateral de una pieza: la imagen o el clip en grande, su estado y, si algo salió mal,
// "Está bien así" / "Rehacer este" (sin precios: el costo va solo en la entrega).
// Con las flechas del teclado pasas a la pieza de al lado.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Clock, Hand, LoaderCircle, RefreshCw, ScanEye, ThumbsUp, Wrench, X } from 'lucide-react';
import { Boton, Insignia, Modal, Pestanas } from '../../componentes/index.js';
import { miniatura } from '../../datos/api.js';
import { duracion as fmtDuracion, fechaCompleta } from '../../datos/formato.js';
import { fraseArreglo, quien } from './modelo.js';
import { TEXTO_DEFECTO } from './simulacion.js';

const TERMINADA = new Set(['listo', 'arreglado', 'te-necesita']);

function explicacion(p, estado, nota, modelo, revisada, simulando) {
  if (estado === 'listo' && !revisada)
    return p.clase === 'clip' ? 'Llegó bien. Cuando estén todos, se revisa que no traiga voces que no van.' : 'Llegó bien. Cuando estén todas, la IA la mira contra sus hojas: el personaje, tu producto y las letras.';
  if (estado === 'listo') return p.clase === 'clip' ? 'Llegó bien y pasó la revisión: duración, cuadros negros, congelados y voces coladas.' : 'Llegó bien y pasó la revisión: se parece a su hoja y no tiene letras inventadas.';
  if (estado === 'te-necesita')
    return simulando
      ? 'Llegó con un problema que la app no pudo arreglar sola. Solo esta toma espera: lo demás sigue.'
      : 'Salió con el modelo de respaldo. Si algo quedó mal, está contado en el informe de la entrega.';
  if (estado === 'arreglado') return `Hubo un problema y la app lo resolvió sola: ${fraseArreglo(p.motivo, p.clase)}.`;
  if (estado === 'generando') {
    if (nota === 'rehaciendo') return p.rehecha ? 'La IA la revisó y pidió rehacerla: se está haciendo de nuevo. Lo demás no espera.' : 'Se está rehaciendo con el mismo guion. Lo demás no espera.';
    if (nota === 'repitiendo') return 'La primera salió con un defecto y se está repitiendo sola. No tienes que hacer nada.';
    return p.clase === 'clip' ? 'kie está haciendo este clip ahora. Suele tardar entre 1 y 1,5 minutos.' : 'kie está haciendo esta imagen ahora. Suele tardar entre 1 y 2 minutos.';
  }
  if (nota === 'frenada') return 'Espera tu decisión sobre la imagen de la que sale. Solo esta toma espera.';
  const previa = p.depende.map((id) => modelo.porId.get(id)).filter(Boolean)[0];
  if (previa && previa.tipo !== 'hoja') return `Sale apenas esté lista ${previa.tipo === 'final' ? 'su imagen final' : previa.tipo === 'inicial' ? 'su imagen de inicio' : 'su imagen'}.`;
  if (previa) return 'Sale apenas estén listas las hojas de referencia.';
  return 'Está en la fila. Sale en cuanto haya un lugar libre.';
}

// enVivo: el anuncio tiene conductor (la app lo produce sola): rehacer a mano llega con el editor, no aquí.
// revisada: la revisión de la IA ya pasó (si no, una pieza lista "todavía se va a revisar").
export function PanelPieza({ pieza: p, estado, nota, modelo, orden, onCerrar, onIr, onDecidir, simulando, problema = TEXTO_DEFECTO, enVivo = false, revisada = true }) {
  const [verAntes, setVerAntes] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;
  const irRef = useRef(onIr);
  irRef.current = onIr;
  const panel = useRef(null);

  useEffect(() => setVerAntes(false), [p?.id]);
  useEffect(() => {
    const alTeclado = (e) => {
      if (document.querySelector('.modal-velo')) return; // con el modal abierto, manda el modal
      if (e.key === 'Escape') cerrarRef.current?.();
      if (/^(input|textarea|select)$/i.test(e.target?.tagName || '')) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        irRef.current?.(1);
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        irRef.current?.(-1);
      }
    };
    document.addEventListener('keydown', alTeclado);
    return () => document.removeEventListener('keydown', alTeclado);
  }, []);
  useEffect(() => {
    panel.current?.querySelector('.prod-panel__cuerpo')?.scrollTo?.({ top: 0 });
  }, [p?.id]);

  if (!p) return null;
  const terminada = TERMINADA.has(estado);
  const antes = p.arreglos?.[p.arreglos.length - 1];
  const mostrarAntes = verAntes && antes && terminada;
  const pos = orden.indexOf(p.id);
  // decidir a mano solo en la simulación del diseño: con conductor, la app rehace sola (con su tope) y lo cuenta
  const esDefecto = estado === 'te-necesita' && simulando;
  const media = mostrarAntes ? antes.antes : p.clase === 'clip' ? p.video : p.imagen;
  const poster = p.clase === 'clip' ? miniatura(p.video, 480, { segundo: 0.3 }) : miniatura(p.imagen, 480);

  return createPortal(
    <aside ref={panel} className="prod-panel" role="dialog" aria-modal="false" aria-label={p.titulo}>
      <header className="prod-panel__cabecera">
        <div className="prod-panel__titulos">
          <span className="prod-panel__sobre">{p.clase === 'clip' ? 'Clip' : p.tipo === 'hoja' ? 'Hoja de referencia' : 'Imagen'}</span>
          <h2 className="prod-panel__titulo">{quien(p)}</h2>
        </div>
        <div className="fila" style={{ '--hueco': '4px' }}>
          <Boton variante="fantasma" tamano="chico" soloIcono icono={ChevronLeft} etiqueta="Pieza anterior" disabled={pos <= 0} onClick={() => onIr(-1)} />
          <span className="prod-panel__pos t-num">
            {pos + 1} / {orden.length}
          </span>
          <Boton variante="fantasma" tamano="chico" soloIcono icono={ChevronRight} etiqueta="Pieza siguiente" disabled={pos >= orden.length - 1} onClick={() => onIr(1)} />
          <Boton variante="fantasma" tamano="chico" soloIcono icono={X} etiqueta="Cerrar" onClick={onCerrar} />
        </div>
      </header>

      <div className="prod-panel__cuerpo">
        <div className={`prod-panel__media prod-panel__media--${estado}`} style={p.relacion ? { aspectRatio: p.relacion } : undefined}>
          {terminada && media ? (
            p.clase === 'clip' ? (
              <video key={media} src={media} poster={mostrarAntes ? undefined : poster} controls autoPlay muted loop playsInline preload="auto" />
            ) : (
              <img key={media} src={media} alt={p.titulo} decoding="async" style={{ backgroundImage: `url("${miniatura(media, 480)}")` }} />
            )
          ) : (
            <div className="prod-panel__espera">
              {estado === 'generando' && p.fuente ? <img className="prod-panel__fuente" src={miniatura(p.fuente, 480)} alt="" /> : null}
              <span className="prod-panel__espera-icono">
                {estado === 'generando' ? <LoaderCircle size={22} className="girando" /> : nota === 'frenada' ? <Hand size={22} /> : <Clock size={22} />}
              </span>
              <span className="prod-panel__espera-texto">{estado === 'generando' ? (p.clase === 'clip' ? 'Generando el clip…' : 'Generando la imagen…') : 'Todavía no llega'}</span>
              {estado === 'generando' ? <span className="prod-panel__barrido" aria-hidden="true" /> : null}
            </div>
          )}
          {mostrarAntes ? <span className="prod-panel__marca-antes">Antes</span> : null}
        </div>

        {antes && terminada ? (
          <div className="prod-panel__antes">
            <Pestanas
              variante="segmentado"
              tamano="chico"
              etiqueta="Ver la versión"
              items={[
                { id: 'ahora', etiqueta: 'Ahora' },
                { id: 'antes', etiqueta: 'Antes del arreglo' },
              ]}
              activa={verAntes ? 'antes' : 'ahora'}
              onCambio={(id) => setVerAntes(id === 'antes')}
            />
            <span className="t-mini">
              {p.arreglos.length > 1
                ? `Se rehízo ${p.arreglos.length} veces`
                : `Se rehízo el ${antes.soloDia ? new Date(antes.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : fechaCompleta(antes.fecha)}`}
            </span>
          </div>
        ) : null}

        <div className="prod-panel__estado">
          <Insignia estado={estado} texto={estado === 'listo' ? 'Lista' : undefined} />
          <p>{explicacion(p, estado, nota, modelo, revisada, simulando)}</p>
        </div>

        {esDefecto ? (
          <div className="prod-panel__defecto" role="alert">
            <strong>
              <Hand size={15} strokeWidth={2.2} aria-hidden="true" /> {p.motivo === 'respaldo' ? 'Este clip salió con el modelo de respaldo' : `Problema: ${problema}`}
            </strong>
            <p>
              {p.motivo === 'respaldo'
                ? 'En los anuncios hablados el modelo de respaldo no genera el diálogo. Conviene rehacerlo con el modelo principal.'
                : 'Ya se repitió una vez sola y sigue igual. Míralo y decide: si te gusta así, sigue; si no, se rehace con el mismo guion.'}
            </p>
            <div className="prod-panel__decidir">
              <Boton variante="secundario" icono={ThumbsUp} onClick={() => onDecidir(p.id, 'bien')}>
                Está bien así
              </Boton>
              <Boton variante="primario" icono={RefreshCw} onClick={() => setConfirmar(true)}>
                Rehacer este
              </Boton>
            </div>
          </div>
        ) : null}

        {p.linea ? (
          <div className="prod-panel__bloque">
            <span className="t-etiqueta">{p.broll ? 'Cuándo aparece' : modelo.hablado ? 'Lo que se dice' : modelo.cantado ? 'Lo que se canta' : 'Lo que dice el narrador'}</span>
            <p className="prod-panel__linea">{p.broll ? p.linea : `«${p.linea}»`}</p>
          </div>
        ) : null}

        {(p.clase === 'clip' && p.duracion) || p.modelo || p.intentos > 1 ? (
          <dl className="prod-panel__datos">
            {p.clase === 'clip' && p.duracion ? (
              <div>
                <dt>Duración</dt>
                <dd className="t-mono">{fmtDuracion(p.duracion)}</dd>
              </div>
            ) : null}
            {p.modelo ? (
              <div>
                <dt>Modelo de IA</dt>
                <dd>
                  {p.modelo}
                  {p.respaldo ? <span className="t-3"> (respaldo)</span> : null}
                </dd>
              </div>
            ) : null}
            {p.intentos > 1 ? (
              <div>
                <dt>Intentos</dt>
                <dd className="t-num">{p.intentos}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {p.revision && terminada ? (
          <div className="prod-panel__bloque">
            <span className="t-etiqueta">
              <ScanEye size={12} strokeWidth={2.4} aria-hidden="true" /> Lo que miró la IA
            </span>
            <img className="prod-panel__tira" src={miniatura(p.revision.tira, 960)} alt={`${p.revision.cuadros} cuadros del clip`} loading="lazy" />
            <span className="t-mini">
              {p.revision.cuadros} cuadros del clip
              {p.revision.segundos?.length ? `, en los segundos ${p.revision.segundos.map((s) => s.toLocaleString('es-ES', { maximumFractionDigits: 1 })).join(' · ')}` : ''}.
            </span>
          </div>
        ) : null}

        {terminada && !esDefecto && !enVivo && simulando ? (
          <div className="prod-panel__pie">
            <Boton variante="fantasma" tamano="chico" icono={Wrench} onClick={() => setConfirmar(true)}>
              ¿No te convence? Rehacer
            </Boton>
          </div>
        ) : null}
      </div>

      <Modal
        abierto={confirmar}
        onCerrar={() => setConfirmar(false)}
        icono={RefreshCw}
        titulo={`¿Rehacer ${quien(p).toLowerCase().replace(/^toma/, 'la toma').replace(/^b-roll/, 'el b-roll')}?`}
        descripcion={`Se vuelve a generar con el mismo guion y tarda ${p.clase === 'clip' ? 'un minuto y medio' : 'uno o dos minutos'}. Lo demás no espera.`}
        tamano="chico"
        pie={
          <>
            <Boton variante="fantasma" onClick={() => setConfirmar(false)}>
              Cancelar
            </Boton>
            <Boton
              variante="primario"
              icono={RefreshCw}
              onClick={() => {
                setConfirmar(false);
                onDecidir(p.id, 'rehacer');
              }}
            >
              Sí, rehacer
            </Boton>
          </>
        }
      />
    </aside>,
    document.body
  );
}

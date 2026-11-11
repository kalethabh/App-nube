// El panel lateral de una pieza: la imagen o el clip en grande, Descargar, su estado, lo que notó la revisión
// («La revisión notó: …») y, en los anuncios de la app, «Corregir esto», Regenerar (con su costo) y «¿Qué salió mal?»
// (./Regenerar.jsx). Desde 2026-11-09 la app no rehace nada sola por calidad: tú decides. Si la pieza ya se
// regeneró, «Antes» muestra la versión anterior (historial/).
// Con las flechas del teclado pasas a la pieza de al lado.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Clock, Download, Hand, LoaderCircle, RefreshCw, ScanEye, ThumbsUp, Wrench, X } from 'lucide-react';
import { Boton, Insignia, Modal, Pestanas, Tooltip } from '../../componentes/index.js';
import { miniatura } from '../../datos/api.js';
import { duracion as fmtDuracion, fechaCompleta } from '../../datos/formato.js';
import { MOTIVO_ICONO, noSeRegenera, piezaDelProceso } from '../../datos/regenerar.js';
import { esMasculina, fraseArreglo, quien } from './modelo.js';
import { TEXTO_DEFECTO } from './simulacion.js';
import { EditarImagen } from './EditarImagen.jsx';
import { RegenerarPieza } from './Regenerar.jsx';

const TERMINADA = new Set(['listo', 'arreglado', 'te-necesita']);
const QUE_LO_NOTO = { 'revision-ia': 'Lo que vio la IA', transcripcion: 'Lo que se oyó', control: 'El control final' };

function explicacion(p, estado, nota, modelo, revisada, simulando) {
  const conAviso = Boolean(p.avisos?.length);
  const m = esMasculina(p); // (el paso, el gancho: en masculino)
  if (nota === 'regenerando') return m ? 'Lo estás regenerando: cuando el anuncio se vuelva a armar, el nuevo aparece solo aquí.' : 'La estás regenerando: cuando el anuncio se vuelva a armar, la nueva aparece sola aquí.';
  if (nota === 'en-fila') return m ? 'Lo pediste de nuevo: espera su turno en la fila. Mientras tanto se ve el de ahora.' : 'La pediste de nuevo: espera su turno en la fila. Mientras tanto se ve la de ahora.';
  if (nota === 'sin-dialogo') return 'Salió con un modelo que no hace hablar al personaje: la app la hace otra vez sola en la revisión.';
  // una hoja (o la foto de tu producto) es la base de las escenas: no se compara con «su hoja»
  if (estado === 'listo' && p.tipo === 'hoja' && !conAviso) return p.clave === 'producto' ? 'Es la foto de tu producto: se usa tal cual.' : `De ella salen ${modelo.hablado ? 'los clips' : 'las escenas'} donde aparece.`;
  if (estado === 'listo' && !revisada)
    return p.clase === 'clip' ? 'Llegó bien. Cuando estén todos, se revisa que no traiga voces que no van.' : 'Llegó bien. Cuando estén todas, la IA la mira contra sus hojas: el personaje, tu producto y las letras.';
  if (estado === 'listo' && p.motivo === 'pedido') {
    if (p.modoPedido === 'subido') return conAviso ? 'Pusiste tu video y la revisión notó algo: míralo abajo.' : 'Pusiste tu video: es el que va en el anuncio. El clip de antes está en «Antes».';
    if (p.modoPedido === 'original') return 'Volviste al clip original. El video que habías puesto está en «Antes».';
    if (p.modoPedido === 'lugar') return 'Ahora sale de otro momento de su escena: lo cambiaste con «Corregir esto». La de antes está en «Antes».';
    return conAviso ? `${m ? 'Lo' : 'La'} regeneraste y la revisión volvió a notar algo: míralo abajo.` : `${m ? 'Lo regeneraste: este es el nuevo. El anterior' : 'La regeneraste: esta es la nueva. La anterior'} está en «Antes».`;
  }
  if (estado === 'listo' && conAviso) return p.clase === 'clip' ? 'Llegó y la revisión le dejó un aviso.' : 'Llegó y la revisión le dejó un aviso.';
  if (estado === 'listo') return p.clase === 'clip' ? 'Llegó bien y pasó la revisión: duración, cuadros negros, congelados y voces coladas.' : 'Llegó bien y pasó la revisión: se parece a su hoja y no tiene letras inventadas.';
  if (estado === 'te-necesita')
    return simulando
      ? 'Llegó con un problema que la app no pudo arreglar sola. Solo esta escena espera: lo demás sigue.'
      : p.motivo === 'sin-dialogo'
        ? 'Salió con un modelo que no hace hablar al personaje. Regenérala para que hable.'
        : 'Salió con el modelo de respaldo. Si no te convence, regenérala.';
  if (estado === 'arreglado') return `Hubo un problema y la app lo resolvió sola: ${fraseArreglo(p.motivo, p.clase)}.`;
  if (estado === 'generando') {
    if (nota === 'rehaciendo') return 'Se está haciendo otra vez (la anterior no salió bien). Lo demás no espera.';
    if (nota === 'repitiendo') return 'La primera salió con un defecto y se está repitiendo sola. No tienes que hacer nada.';
    return p.clase === 'clip' ? 'kie está haciendo este clip ahora. Suele tardar entre 1 y 1,5 minutos.' : 'kie está haciendo esta imagen ahora. Suele tardar entre 1 y 2 minutos.';
  }
  if (nota === 'frenada') return 'Espera tu decisión sobre la imagen de la que sale. Solo esta escena espera.';
  const previa = p.depende.map((id) => modelo.porId.get(id)).filter(Boolean)[0];
  if (previa && previa.tipo !== 'hoja') return `Sale apenas esté lista ${previa.tipo === 'final' ? 'su imagen final' : previa.tipo === 'inicial' ? 'su imagen de inicio' : 'su imagen'}.`;
  if (previa) return 'Sale apenas estén listas las hojas de referencia.';
  return 'Está en la fila. Sale en cuanto haya un lugar libre.';
}

/** El nombre del archivo al descargar: «<anuncio>-escena-3.mp4», «<anuncio>-escena-3-imagen-de-inicio.png» (la de antes: «…-antes.mp4»). */
function nombreDescarga(slug, p, url, { antes = false } = {}) {
  const ext = (String(url || '').split('?')[0].match(/\.([a-z0-9]+)$/i)?.[1] || (p.clase === 'clip' ? 'mp4' : 'png')).toLowerCase();
  const que = quien(p)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug ? `${slug}-` : ''}${que || p.clave}${antes ? '-antes' : ''}.${ext}`;
}

/**
 * Lo que notó la revisión en esta pieza (la app no lo rehízo: tú decides). `cierre`: qué puedes hacer (en una hoja o
 * un icono, que no se regeneran, no se promete regenerar: se explica por qué y qué hacer).
 */
function AvisoDeLaPieza({ p, cierre }) {
  if (!p.avisos?.length) return null;
  const vistos = new Set();
  const lista = p.avisos.filter((x) => !vistos.has(x.texto) && vistos.add(x.texto));
  return (
    <div className="prod-panel__aviso" role="note">
      <strong>
        <ScanEye size={15} strokeWidth={2.2} aria-hidden="true" /> La revisión notó:
      </strong>
      <ul>
        {lista.map((x, i) => (
          <li key={`${x.clave}-${i}`}>
            {lista.length > 1 || x.fuente === 'transcripcion' ? <span className="prod-panel__aviso-de">{QUE_LO_NOTO[x.fuente] || 'La revisión'}</span> : null}
            {x.texto}
          </li>
        ))}
      </ul>
      <p>{cierre}</p>
    </div>
  );
}

/**
 * Lo que puedes hacer con lo que notó la revisión. Una hoja (de ella salen los clips) o un icono no se regeneran desde
 * aquí: se dice por qué y qué hacer, sin botones que no hacen nada. `motivoNo`: lo que dice el servidor de esa hoja.
 */
function cierreDelAviso(p, motivoNo) {
  const no = noSeRegenera(p.id);
  if (no === 'icono') return `No se rehízo nada solo. ${MOTIVO_ICONO}`;
  if (no === 'hoja') {
    if (motivoNo) return `No se rehízo nada solo. ${motivoNo}`;
    return p.clave === 'producto'
      ? 'No se rehízo nada solo. Es la foto de tu producto: se usa tal cual y no se regenera.'
      : 'No se rehízo nada solo. Es la base de todos los clips donde aparece: regenerarla obligaría a hacer el anuncio entero de nuevo, por eso no se hace desde aquí. Si lo que notó la revisión se ve en el video, regenera esos clips uno por uno o reemplázalos con tu propio video en el editor; si no se nota, déjala así.';
  }
  return esMasculina(p) ? 'No se rehízo nada solo. Si te convence así, déjalo; si no, regenéralo abajo.' : 'No se rehízo nada solo. Si te convence así, déjala; si no, regenérala abajo.';
}

// enVivo: el anuncio tiene conductor (lo produce la app): con `reh` se puede regenerar la pieza desde aquí.
// revisada: la revisión de la IA ya pasó (si no, una pieza lista "todavía se va a revisar").
export function PanelPieza({ pieza: p, estado, nota, modelo, orden, onCerrar, onIr, onDecidir, simulando, problema = TEXTO_DEFECTO, enVivo = false, revisada = true, slug, reh = null, onPedido }) {
  const [verAntes, setVerAntes] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [versionEditada, setVersionEditada] = useState(0);
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;
  const irRef = useRef(onIr);
  irRef.current = onIr;
  const panel = useRef(null);

  useEffect(() => setVerAntes(false), [p?.id, p?.fecha]);
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
  // decidir a mano solo en la simulación del diseño
  const esDefecto = estado === 'te-necesita' && simulando;
  const imagenActual = p.imagen && versionEditada ? `${p.imagen}${p.imagen.includes('?') ? '&' : '?'}e=${versionEditada}` : p.imagen;
  const actual = p.clase === 'clip' ? p.video : imagenActual;
  const media = mostrarAntes ? antes.antes : actual;
  // (en «Antes», Descargar baja la de antes: para usarla otra vez, en el editor con «Reemplazar con tu video»)
  const aBajar = mostrarAntes ? antes.antes : actual;
  const poster = p.clase === 'clip' ? miniatura(p.video, 480, { segundo: 0.3 }) : miniatura(p.imagen, 480);
  const conAviso = terminada && Boolean(p.avisos?.length);
  const regenerada = p.motivo === 'pedido';

  return createPortal(
    <aside ref={panel} className="prod-panel" role="dialog" aria-modal="false" aria-label={p.titulo}>
      <header className="prod-panel__cabecera">
        <div className="prod-panel__titulos">
          <span className="prod-panel__sobre">{p.clase === 'clip' ? 'Clip' : p.tipo === 'hoja' ? 'Hoja de referencia' : 'Imagen'}</span>
          <h2 className="prod-panel__titulo">{quien(p)}</h2>
        </div>
        <div className="fila" style={{ '--hueco': '4px' }}>
          {terminada && aBajar ? (
            <Tooltip texto={mostrarAntes ? (p.clase === 'clip' ? 'Descargar el clip de antes' : 'Descargar la imagen de antes') : p.clase === 'clip' ? 'Descargar el clip' : 'Descargar la imagen'} lado="abajo">
              <Boton
                variante="fantasma"
                tamano="chico"
                soloIcono
                icono={Download}
                etiqueta={mostrarAntes ? (p.clase === 'clip' ? 'Descargar el clip de antes' : 'Descargar la imagen de antes') : p.clase === 'clip' ? 'Descargar el clip' : 'Descargar la imagen'}
                href={aBajar}
                download={nombreDescarga(slug || modelo.slug, p, aBajar, { antes: mostrarAntes })}
              />
            </Tooltip>
          ) : null}
          <Boton variante="fantasma" tamano="chico" soloIcono icono={ChevronLeft} etiqueta="Pieza anterior" disabled={pos <= 0} onClick={() => onIr(-1)} />
          <span className="prod-panel__pos t-num">
            {pos + 1} / {orden.length}
          </span>
          <Boton variante="fantasma" tamano="chico" soloIcono icono={ChevronRight} etiqueta="Pieza siguiente" disabled={pos >= orden.length - 1} onClick={() => onIr(1)} />
          <Boton variante="fantasma" tamano="chico" soloIcono icono={X} etiqueta="Cerrar" onClick={onCerrar} />
        </div>
      </header>

      <div className="prod-panel__cuerpo">
        <div className={`prod-panel__media prod-panel__media--${estado}${conAviso ? ' prod-panel__media--con-aviso' : ''}`} style={p.relacion ? { aspectRatio: p.relacion } : undefined}>
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
                { id: 'antes', etiqueta: 'Antes' },
              ]}
              activa={verAntes ? 'antes' : 'ahora'}
              onCambio={(id) => setVerAntes(id === 'antes')}
            />
            <span className="t-mini">
              {p.arreglos.length > 1
                ? `${regenerada ? (esMasculina(p) ? 'Lo cambiaste' : 'La cambiaste') : 'Se hizo de nuevo'} ${p.arreglos.length} veces`
                : regenerada && p.fecha
                  ? `${p.modoPedido === 'subido' ? 'Pusiste tu video' : p.modoPedido === 'original' ? 'Volviste al clip original' : p.modoPedido === 'lugar' ? 'La cambiaste' : esMasculina(p) ? 'Lo regeneraste' : 'La regeneraste'} el ${fechaCompleta(p.fecha)}`
                  : `Se hizo de nuevo el ${antes.soloDia ? new Date(antes.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : fechaCompleta(antes.fecha)}`}
            </span>
            {/* (no hay un «volver a esta»: la de antes se descarga y, si es un clip, se pone en el editor como tu video) */}
            {mostrarAntes ? (
              <p className="t-mini t-3 prod-panel__antes-nota">
                {p.clase === 'clip' && p.tipo !== 'gancho'
                  ? `${esMasculina(p) ? 'Este es el de antes' : 'Esta es la de antes'}: queda en la carpeta del anuncio. Si te gustaba más, ${esMasculina(p) ? 'descárgalo arriba y ponlo' : 'descárgala arriba y ponla'} en el editor con «Reemplazar con tu video» (gratis).`
                  : `${esMasculina(p) ? 'Este es el de antes: queda en la carpeta del anuncio y lo' : 'Esta es la de antes: queda en la carpeta del anuncio y la'} puedes descargar arriba.`}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="prod-panel__estado">
          {/* (regenerándose: cian con el círculo que gira; en la fila: gris con el reloj; nunca el verde de «lista») */}
          <Insignia
            estado={nota === 'regenerando' ? 'generando' : nota === 'en-fila' ? 'en-cola' : conAviso && estado === 'listo' ? 'aviso' : estado}
            texto={nota === 'regenerando' ? 'Regenerándose' : nota === 'en-fila' ? 'En la fila' : estado === 'listo' && !conAviso ? 'Lista' : undefined}
          />
          <p>{explicacion(p, estado, nota, modelo, revisada, simulando)}</p>
        </div>

        {p.clase === 'imagen' && terminada && p.imagen && !simulando && !mostrarAntes ? <EditarImagen url={p.imagen} onEditada={() => setVersionEditada(Date.now())} /> : null}

        {terminada ? <AvisoDeLaPieza p={p} cierre={cierreDelAviso(p, reh?.porPieza?.[piezaDelProceso(p.id)?.pieza]?.motivoNo)} /> : null}

        {esDefecto ? (
          <div className="prod-panel__defecto" role="alert">
            <strong>
              <Hand size={15} strokeWidth={2.2} aria-hidden="true" /> {p.motivo === 'respaldo' ? 'Este clip salió con el modelo de respaldo' : `Problema: ${problema}`}
            </strong>
            <p>
              {p.motivo === 'respaldo'
                ? 'En los anuncios hablados el modelo de respaldo no genera el diálogo. Conviene rehacerlo con el modelo principal.'
                : 'Míralo y decide: si te gusta así, sigue; si no, se rehace con el mismo guion.'}
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

        {!simulando && enVivo && reh && terminada ? <RegenerarPieza p={p} reh={reh} onPedido={onPedido} /> : null}

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
        titulo={`¿Rehacer ${quien(p).replace(/ \(.*\)$/, '').toLowerCase().replace(/^escena/, 'la escena').replace(/^imagen de apoyo/, 'la imagen de apoyo')}?`}
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

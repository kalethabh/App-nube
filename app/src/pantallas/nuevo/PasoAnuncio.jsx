// Paso 2 "Tu anuncio": estilo -> ajustes (duración, voz real de ElevenLabs, continuidad y las preguntas de ese
// estilo) -> el guion real -> producir. La duración viene en "Que decida la IA" (lo recomendado: el anuncio dura lo
// que necesite para mostrar todo); con "Yo digo cuánto" se escribe un tiempo, que es aproximado. La app siempre
// produce el anuncio completo (sin opciones A/B/C) y aquí no se muestra ningún precio: el costo real aparece recién
// en el informe de la Entrega.
//
// Se eligen los 12 estilos (uno o varios a la vez: un anuncio por estilo) y la continuidad en los 6 con narrador.
// Las preguntas de cada estilo salen de catalogo.js (preguntasDe): "Que decida la IA" donde la skill lo deja
// decidir sola, y obligatorias donde la skill prohíbe inventarlo (el fondo de Zack D Films, a quién paran en la
// entrevista…).
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, Check, CircleHelp, Hourglass, Lock, Package, Pause, PenLine, Play, RotateCcw, Sparkles, X } from 'lucide-react';
import { Boton, CampoTexto, Chip, EsqueletoMiniaturas, EstadoVacio, Interruptor, MiniaturaVideo, Seccion, Selector, Tarjeta, Tooltip } from '../../componentes/index.js';
import { useEstilos, useVoces } from '../../datos/api.js';
import { enlace } from '../../datos/rutas.js';
import { CONTINUIDAD_DISPONIBLE, CON_CONTINUIDAD, DETALLES, ICONO_FAMILIA, disponible, partirEscrito, preguntasDe } from '../estilos/catalogo.js';
import { conDuracion, duracionCorta, duracionDeAjuste, leerDuracion } from '../../datos/duracion.js';
import { leerVoces } from './datos.js';
import { useMuestraDeAudio } from './reproductor.js';
import { Guiones } from './Guiones.jsx';
import { SelloEstilo } from './SelloEstilo.jsx';

// ---------------------------------------------------------------- galería de estilos

function GaleriaEstilos({ estilos, elegidos, alternar, fijos }) {
  const [familia, setFamilia] = useState('todas');
  const familias = [
    { id: 'todas', nombre: 'Todos' },
    { id: 'voz-en-off', nombre: 'Voz en off' },
    { id: 'hablado', nombre: 'Hablados' },
    { id: 'cantado', nombre: 'Cantados' },
  ];
  // los que ya se pueden producir van primero
  const lista = estilos
    .filter((e) => e.familia !== 'efecto' && (familia === 'todas' || e.familia === familia))
    .sort((a, b) => Number(disponible(b.clave)) - Number(disponible(a.clave)));
  const cuenta = (id) => estilos.filter((e) => e.familia !== 'efecto' && (id === 'todas' || e.familia === id)).length;

  return (
    <Seccion
      titulo="Elige el estilo"
      icono={Sparkles}
      contador={elegidos.length ? `${elegidos.length} elegido${elegidos.length === 1 ? '' : 's'}` : undefined}
      descripcion="Puedes elegir uno o varios: cada uno sale como su propio anuncio. Pasa el mouse para ver cómo se ve cada estilo."
      acciones={
        <div className="fila" style={{ '--hueco': '6px' }}>
          {familias.map((f) => (
            <Chip key={f.id} tamano="chico" activo={familia === f.id} onClick={() => setFamilia(f.id)} contador={cuenta(f.id)}>
              {f.nombre}
            </Chip>
          ))}
        </div>
      }
    >
      <div className="nv-galeria escalonado">
        {lista.map((e) => {
          const usable = disponible(e.clave);
          const sel = elegidos.includes(e.clave);
          const fijo = fijos.includes(e.clave);
          return (
            <div key={e.clave} className={`nv-estilo${sel ? ' nv-estilo--sel' : ''}${usable ? '' : ' nv-estilo--pronto'}`}>
              <MiniaturaVideo
                imagen={e.muestra?.imagen}
                video={e.muestra?.video}
                estilo={e.familiaNombre}
                atenuada={!usable}
                insignia={
                  sel ? (
                    <span className="nv-estilo__check" aria-hidden="true">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  ) : null
                }
                etiqueta={
                  // la muestra es un anuncio de otro producto: va marcada (DISENO, regla 9)
                  <span className="nv-estilo__etiquetas">
                    {usable ? null : (
                      <span className="nv-pronto">
                        <Hourglass size={11} strokeWidth={2.4} aria-hidden="true" /> Muy pronto
                      </span>
                    )}
                    <span className="nv-ejemplo">Ejemplo del estilo</span>
                  </span>
                }
                titulo={e.nombre}
                subtitulo={e.lema}
                seleccionada={sel}
                onClick={usable && !fijo ? () => alternar(e.clave) : undefined}
                aria-pressed={usable ? sel : undefined}
                aria-disabled={usable ? undefined : true}
                aria-label={`${e.nombre}: ${e.lema}. ${usable ? (fijo ? 'Ya tiene su guion' : sel ? 'Elegido' : 'Tocar para elegir') : 'Muy pronto'}`}
              />
            </div>
          );
        })}
      </div>
    </Seccion>
  );
}

// ---------------------------------------------------------------- ajustes de cada anuncio

/**
 * La duración: "Que decida la IA" (lo recomendado) o "Yo digo cuánto", con un campo libre ("35 s", "1 minuto",
 * "2 minutos") que se entiende igual que en el servidor y es aproximado. valor: null = la decide la IA; un texto = lo
 * que escribió. El aviso de que no se entiende sale al salir del campo, no mientras escribe.
 */
function Duracion({ estilo, valor, onCambio, bloqueado }) {
  const [visto, setVisto] = useState(false);
  const d = duracionDeAjuste(valor);
  const yoDigo = d.decide === 'usuario';
  const cantado = DETALLES[estilo.clave]?.voz === 'canto';
  const escrito = yoDigo && String(valor ?? '').trim() !== '';
  let ayuda;
  if (d.segundos) ayuda = `Aprox. ${duracionCorta(d.segundos)}. ${cantado ? 'La canción puede salir un poco más larga o más corta.' : 'Puede salir un poco más largo o más corto.'}`;
  else ayuda = 'Es aproximado. Escríbelo así: 35 s, 1 minuto o 2 minutos.';
  return (
    <div className="nv-duracion">
      <div className="nv-segmentos" role="radiogroup" aria-label="Duración">
        <button type="button" role="radio" aria-checked={!yoDigo} className="nv-segmento" onClick={() => onCambio(null)} disabled={bloqueado && yoDigo}>
          <Sparkles size={14} strokeWidth={2.2} aria-hidden="true" />
          Que decida la IA <span className="nv-segmento__nota">(recomendado)</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={yoDigo}
          className="nv-segmento"
          onClick={() => {
            if (yoDigo) return;
            setVisto(false);
            onCambio('');
          }}
          disabled={bloqueado && !yoDigo}
        >
          <PenLine size={14} strokeWidth={2.2} aria-hidden="true" />
          Yo digo cuánto
        </button>
      </div>
      {yoDigo ? (
        <CampoTexto
          className="nv-duracion__campo nv-aparece"
          aria-label="Cuánto quieres que dure, más o menos"
          placeholder="Ej.: 35 s, 1 minuto, 2 minutos"
          value={valor ?? ''}
          disabled={bloqueado}
          maxLength={40}
          onChange={(e) => onCambio(e.target.value)}
          onBlur={() => setVisto(true)}
          error={!bloqueado && escrito && visto && d.motivo ? d.motivo : null}
          ayuda={ayuda}
        />
      ) : (
        <p className="nv-preg-estilo__ayuda nv-duracion__ayuda">
          {cantado ? 'La historia dura lo que necesite para contarse entera.' : 'El anuncio dura lo que necesite para mostrar todo: el gancho, el problema, la solución, la prueba y el cierre.'}
        </p>
      )}
    </div>
  );
}

function BotonEscuchar({ id, url, desde, segundos = 12, etiqueta = 'Escuchar', disabled = false }) {
  const { sonando, alternar } = useMuestraDeAudio();
  const suena = !disabled && sonando === id;
  return (
    <button
      type="button"
      className={`nv-escuchar${suena ? ' nv-escuchar--suena' : ''}`}
      onClick={() => url && alternar(id, url, { desde, segundos })}
      aria-pressed={suena}
      disabled={disabled}
    >
      {suena ? <Pause size={14} strokeWidth={2.4} fill="currentColor" aria-hidden="true" /> : <Play size={14} strokeWidth={2.4} fill="currentColor" aria-hidden="true" />}
      <span>{suena ? 'Pausar' : etiqueta}</span>
      {suena ? (
        <span className="nv-ondas" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      ) : null}
    </button>
  );
}

/** Qué se oye en los estilos sin narrador (la voz sale del video o de la canción). */
const VOZ_SIN_NARRADOR = {
  ugc: 'Sale con el video: la persona habla con su propia voz.',
  'talking-object-pixar': 'Sale con el video: cada personaje habla con su propia voz y la boca sincronizada.',
  podcast: 'Sale con el video: los dos anfitriones conversan con su propia voz.',
  entrevista: 'Sale con el video: el entrevistador y la persona hablan con su propia voz.',
  musical: 'La canción se hace con tu letra. Antes de las imágenes eliges la versión que más te guste, de oído.',
  'historias-musicales': 'La historia se canta entera. Antes de las imágenes eliges la versión de la canción que más te guste, de oído.',
};

/**
 * La voz del narrador: las voces de la cuenta de ElevenLabs del usuario (GET /api/voces), con la última
 * que usó en este estilo ya marcada y un botón para escuchar la muestra. En los hablados y cantados la
 * voz sale del video o de la canción, así que solo se explica.
 */
function Voz({ estilo, ajuste, onCambio, bloqueado }) {
  const d = DETALLES[estilo.clave];
  const narrador = d?.voz === 'narrador';
  const { datos, cargando, error, recargar } = useVoces(narrador ? estilo.clave : null);
  const { voces, porDefecto } = useMemo(() => leerVoces(datos, estilo.clave), [datos, estilo.clave]);

  // la última voz de este estilo viene marcada; una voz que ya no está en la cuenta se suelta
  useEffect(() => {
    if (!narrador || bloqueado || !datos) return;
    const sigue = voces.find((v) => v.id === ajuste.voz);
    if (sigue) {
      if (sigue.nombre !== ajuste.vozNombre) onCambio({ vozNombre: sigue.nombre });
      return;
    }
    const v = voces.find((x) => x.id === porDefecto);
    onCambio({ voz: v?.id || '', vozNombre: v?.nombre || '' });
  }, [datos]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!narrador) {
    const cantado = d?.voz === 'canto';
    return (
      <div className="nv-ajuste">
        <span className="nv-ajuste__etiqueta">{cantado ? 'La canción' : 'La voz'}</span>
        <div className="nv-voz nv-voz--texto">
          <p>{VOZ_SIN_NARRADOR[estilo.clave] || 'Sale con el video, con su propia voz.'}</p>
        </div>
      </div>
    );
  }

  const elegida = voces.find((v) => v.id === ajuste.voz);
  return (
    <div className="nv-ajuste">
      <span className="nv-ajuste__etiqueta">
        Voz del narrador
        <Tooltip texto="Las voces de tu cuenta de ElevenLabs. La app recuerda la última que usaste en cada estilo.">
          <CircleHelp size={13} strokeWidth={2} className="nv-ayuda" aria-label="Qué es esto" />
        </Tooltip>
      </span>
      {error ? (
        <div className="nv-voz nv-voz--falla" role="alert">
          <p>No pude traer tus voces de ElevenLabs. {error.message}</p>
          <div className="fila fila--envolver" style={{ '--hueco': '6px' }}>
            <Boton variante="secundario" tamano="chico" icono={RotateCcw} onClick={recargar}>
              Reintentar
            </Boton>
            <Boton variante="fantasma" tamano="chico" href={enlace.ajustes()}>
              Revisar en Ajustes
            </Boton>
          </div>
        </div>
      ) : (
        <div className="nv-voz">
          <Selector
            aria-label="Voz del narrador"
            value={ajuste.voz || ''}
            disabled={bloqueado || (cargando && !voces.length)}
            onChange={(e) => {
              const v = voces.find((x) => x.id === e.target.value);
              onCambio({ voz: v?.id || '', vozNombre: v?.nombre || '' });
            }}
            opciones={[
              { valor: '', etiqueta: cargando && !voces.length ? 'Cargando tus voces…' : voces.length ? 'Elige una voz' : 'Tu cuenta no tiene voces' },
              ...voces.map((v) => ({ valor: v.id, etiqueta: v.detalle ? `${v.nombre} · ${v.detalle}` : v.nombre })),
            ]}
          />
          <Tooltip texto={elegida ? (elegida.muestra ? null : 'Esta voz no tiene muestra para escuchar') : 'Elige una voz para escucharla'}>
            <BotonEscuchar id={`voz-${estilo.clave}-${ajuste.voz || 'ninguna'}`} url={elegida?.muestra} disabled={!elegida?.muestra} />
          </Tooltip>
        </div>
      )}
    </div>
  );
}

/** Una pregunta del estilo: chips, un cuadro para escribir, o los dos ("Lo describo yo"). */
/** Un video para clonar: se sube (POST /api/referencias) o se pega su link. Valor: "subido:<id>|<nombre>" o el link. */
function CampoVideo({ valor, onCambio, bloqueado }) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState(null);
  const texto = typeof valor === 'string' ? valor : '';
  const subido = texto.match(/^subido:[a-z0-9]+\|(.*)$/);
  const subir = async (archivo) => {
    if (!archivo) return;
    setSubiendo(true);
    setError(null);
    try {
      const r = await fetch('/api/referencias', { method: 'POST', headers: { 'Content-Type': archivo.type || 'video/mp4', 'X-Nombre': encodeURIComponent(archivo.name).slice(0, 80), Accept: 'application/json' }, body: archivo });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.id) throw new Error(d?.error || 'No pude subir ese video.');
      onCambio(`subido:${d.id}|${archivo.name.slice(0, 80)}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubiendo(false);
    }
  };
  if (subido) {
    return (
      <div className="fila" style={{ '--hueco': '8px', alignItems: 'center' }}>
        <Chip tamano="chico" activo>
          {subido[1] || 'Video subido'}
        </Chip>
        <Boton variante="fantasma" tamano="chico" icono={X} onClick={() => onCambio(null)} disabled={bloqueado}>
          Quitar
        </Boton>
      </div>
    );
  }
  return (
    <div className="pila" style={{ '--hueco': '6px' }}>
      <label className={`nv-video-subir${bloqueado || subiendo ? ' nv-video-subir--off' : ''}`}>
        <input type="file" accept="video/*" hidden disabled={bloqueado || subiendo} onChange={(e) => subir(e.target.files?.[0])} />
        {subiendo ? 'Subiendo el video…' : 'Subir el video'}
      </label>
      <CampoTexto aria-label="O pega el link del video" placeholder="O pega el link: facebook.com/ads/library/?id=…, TikTok, Instagram, YouTube" value={texto} disabled={bloqueado || subiendo} maxLength={600} onChange={(e) => onCambio(e.target.value.trim() ? e.target.value : null)} error={error} />
    </div>
  );
}

function Pregunta({ p, valor, onCambio, bloqueado }) {
  if (p.tipo === 'video') {
    return (
      <div className="nv-preg-estilo__item nv-preg-estilo__item--ancho">
        <div className="nv-preg-estilo__cabecera">
          <span className="nv-preg-estilo__texto">
            {p.texto}
          </span>
        </div>
        {p.ayuda ? <p className="nv-preg-estilo__ayuda">{p.ayuda}</p> : null}
        <CampoVideo valor={valor} onCambio={onCambio} bloqueado={bloqueado} />
      </div>
    );
  }
  const conIA = p.ia !== false;
  const decideIA = conIA && (valor === null || valor === undefined);
  const texto = typeof valor === 'string' ? valor : '';
  const { opcion, escrito } = partirEscrito(p, texto);
  const elegir = (o) => {
    if (bloqueado) return;
    if (p.escrita) onCambio(o);
    else if (p.escribir && o === p.escribir) onCambio(escrito ? `${o}: ${escrito}` : o);
    else onCambio(o);
  };
  const vacia = !texto.trim();
  return (
    <div className={`nv-preg-estilo__item${p.escrita ? ' nv-preg-estilo__item--ancho' : ''}${p.obligatoria && vacia ? ' nv-preg-estilo__item--falta' : ''}`}>
      <div className="nv-preg-estilo__cabecera">
        <span className="nv-preg-estilo__texto">
          {p.texto}
          {p.obligatoria ? <span className="nv-preg-estilo__marca">Obligatorio</span> : !conIA && !p.porDefecto ? <span className="nv-preg-estilo__marca nv-preg-estilo__marca--suave">Opcional</span> : null}
        </span>
        {conIA ? (
          <label className="nv-decide">
            <input
              type="checkbox"
              checked={decideIA}
              disabled={bloqueado}
              onChange={(e) => onCambio(e.target.checked ? null : p.escrita ? '' : p.opciones[0])}
            />
            <span className="nv-decide__caja" aria-hidden="true">
              <Check size={11} strokeWidth={3.2} />
            </span>
            Que decida la IA <span className="nv-decide__reco">(recomendado)</span>
          </label>
        ) : null}
      </div>
      {p.ayuda || (decideIA && p.ayudaIA) ? <p className="nv-preg-estilo__ayuda">{p.ayuda || p.ayudaIA}</p> : null}
      {!decideIA ? (
        <div className="pila nv-aparece" style={{ '--hueco': '8px' }}>
          {p.escrita ? (
            <CampoTexto aria-label={p.texto} placeholder={p.placeholder} value={texto} disabled={bloqueado} maxLength={300} onChange={(e) => onCambio(e.target.value)} />
          ) : null}
          {p.opciones?.length && p.vistas ? (
            <div className="nv-subestilos">
              {p.opciones.map((o) => (
                <MiniaturaVideo
                  key={o}
                  className="nv-subestilos__item"
                  imagen={p.vistas[o]?.imagen}
                  video={p.vistas[o]?.video}
                  titulo={o}
                  seleccionada={opcion === o}
                  onClick={bloqueado ? undefined : () => elegir(o)}
                  anchoImagen={240}
                />
              ))}
            </div>
          ) : p.opciones?.length ? (
            <div className="fila fila--envolver" style={{ '--hueco': '6px' }}>
              {p.opciones.map((o) => (
                <Chip key={o} tamano="chico" activo={p.escrita ? texto.trim() === o : opcion === o} onClick={bloqueado ? undefined : () => elegir(o)}>
                  {o}
                </Chip>
              ))}
            </div>
          ) : null}
          {p.escribir && opcion === p.escribir ? (
            <CampoTexto
              aria-label={`${p.texto}: ${p.escribir}`}
              placeholder={p.placeholder}
              value={escrito}
              disabled={bloqueado}
              maxLength={300}
              onChange={(e) => onCambio(e.target.value.trim() ? `${p.escribir}: ${e.target.value}` : p.escribir)}
            />
          ) : null}
        </div>
      ) : null}
      {p.nota && valor === p.nota.si ? <p className="nv-preg-estilo__nota">{p.nota.texto}</p> : null}
    </div>
  );
}

function PreguntasEstilo({ clave, valores, onCambio, bloqueado }) {
  const preguntas = preguntasDe(clave);
  if (!preguntas.length) return null;
  return (
    <div className="nv-preg-estilo">
      {preguntas
        .filter((p) => !p.soloSi || (typeof valores[p.soloSi] === 'string' && valores[p.soloSi].trim()))
        .map((p) => (
          <Pregunta key={p.id} p={p} valor={valores[p.id] ?? null} onCambio={(v) => onCambio({ [p.id]: v })} bloqueado={bloqueado} />
        ))}
    </div>
  );
}

function AjustesEstilo({ estilo, ajuste, onCambio, onQuitar, bloqueado, puedeQuitar }) {
  const d = DETALLES[estilo.clave] || {};
  const IconoFamilia = ICONO_FAMILIA[estilo.familia] || Sparkles;
  const conContinuidad = CON_CONTINUIDAD.includes(estilo.clave);
  const conLargo = conDuracion(estilo.clave);

  return (
    <Tarjeta className="nv-ajustes nv-aparece">
      <div className="nv-ajustes__cabecera">
        <SelloEstilo clave={estilo.clave} familia={estilo.familia} tamano="grande" />
        <div className="nv-ajustes__titulos">
          <span className="nv-ajustes__familia">
            <IconoFamilia size={13} strokeWidth={2.2} aria-hidden="true" /> {estilo.familiaNombre} · {d.quienHabla}
          </span>
          <h3 className="nv-ajustes__titulo">
            {estilo.nombre}
            {conContinuidad && ajuste.continuidad ? <span className="nv-ajustes__con">con continuidad</span> : null}
          </h3>
        </div>
        {puedeQuitar && !bloqueado ? <Boton variante="fantasma" tamano="chico" soloIcono icono={X} etiqueta={`Quitar ${estilo.nombre}`} onClick={onQuitar} /> : null}
      </div>

      {bloqueado ? (
        <p className="nv-ajustes__bloqueo">
          <Lock size={13} strokeWidth={2.2} aria-hidden="true" /> El guion ya se escribe con estos ajustes. Si quieres otra duración o algo distinto, pídelo con tus palabras en «Pedir cambios».
        </p>
      ) : null}

      <div className={`nv-ajustes__fila${conLargo ? '' : ' nv-ajustes__fila--sola'}`}>
        {conLargo ? (
          <div className="nv-ajuste">
            <span className="nv-ajuste__etiqueta">
              Duración
              <Tooltip
                texto={
                  d.voz === 'canto'
                    ? 'Lo recomendado: la IA le da a la historia el tiempo que necesita. Si dices un tiempo, es aproximado: el largo final lo pone la canción.'
                    : 'Lo recomendado: la IA le da al anuncio el tiempo que necesita. Si dices un tiempo, es aproximado.'
                }
              >
                <CircleHelp size={13} strokeWidth={2} className="nv-ayuda" aria-label="Qué es esto" />
              </Tooltip>
            </span>
            <Duracion estilo={estilo} valor={ajuste.duracion ?? null} onCambio={(duracion) => onCambio({ duracion })} bloqueado={bloqueado} />
          </div>
        ) : null}
        <Voz estilo={estilo} ajuste={ajuste} onCambio={onCambio} bloqueado={bloqueado} />
      </div>

      {conContinuidad ? (
        <div className={`nv-continuidad${CONTINUIDAD_DISPONIBLE ? '' : ' nv-continuidad--pronto'}`}>
          <Interruptor
            activado={CONTINUIDAD_DISPONIBLE && Boolean(ajuste.continuidad)}
            deshabilitado={!CONTINUIDAD_DISPONIBLE || bloqueado}
            onCambio={(continuidad) => onCambio({ continuidad })}
            etiqueta={
              <>
                ¿Deseas continuidad?
                {CONTINUIDAD_DISPONIBLE ? null : (
                  <span className="nv-pronto nv-pronto--linea">
                    <Hourglass size={11} strokeWidth={2.4} aria-hidden="true" /> Muy pronto
                  </span>
                )}
              </>
            }
            descripcion="Cada escena se transforma en la siguiente, sin un solo corte. Lleva menos clips, pero más largos, y no lleva imágenes de apoyo ni transiciones."
          />
        </div>
      ) : null}

      <PreguntasEstilo clave={estilo.clave} valores={ajuste.preguntas || {}} onCambio={(p) => onCambio({ preguntas: { ...ajuste.preguntas, ...p } })} bloqueado={bloqueado} />
    </Tarjeta>
  );
}

// ---------------------------------------------------------------- píldora que sigue al usuario hasta el guion

function PildoraTanda({ elegidos, estilos, visible, onIr, hayGuiones }) {
  return (
    <div className={`nv-pildora${visible ? ' nv-pildora--visible' : ''}`} aria-hidden={!visible}>
      <span className="nv-pildora__sellos">
        {elegidos.slice(0, 4).map((c) => {
          const e = estilos.find((x) => x.clave === c);
          return e ? <SelloEstilo key={c} clave={c} familia={e.familia} tamano="chico" /> : null;
        })}
      </span>
      <span className="nv-pildora__texto">
        <strong className="t-num">{elegidos.length}</strong> {elegidos.length === 1 ? 'anuncio' : 'anuncios'}
      </span>
      <Boton variante="secundario" tamano="chico" iconoDerecha={ArrowDown} onClick={onIr} tabIndex={visible ? 0 : -1}>
        {hayGuiones ? 'Ir al guion' : 'Ir a escribir el guion'}
      </Boton>
    </div>
  );
}

// ---------------------------------------------------------------- el paso completo

export function PasoAnuncio({ producto, elegidos, ajustes, alternarEstilo, cambiarAjuste, anuncios, creando, onEscribir, claude, onVolver, onProductoDelAnuncio, enfoque = null }) {
  // lo que dice el brief de un anuncio ya creado (duración, voz, continuidad y respuestas) se ve en su tarjeta de ajustes
  const alLeerBrief = (clave, b) => {
    const c = {};
    // la duración: { decide: 'ia' } o { decide: 'usuario', texto } (o el número de un anuncio de antes)
    const largo = leerDuracion(b?.duracion, clave);
    if (largo) c.duracion = largo.decide === 'usuario' ? largo.texto : null;
    if (b?.voz?.id) Object.assign(c, { voz: b.voz.id, vozNombre: b.voz.nombre || '' });
    if (typeof b?.continuidad === 'boolean') c.continuidad = b.continuidad;
    if (b?.respuestas && typeof b.respuestas === 'object') c.preguntas = { ...b.respuestas };
    if (Object.keys(c).length) cambiarAjuste(clave, c);
    if (b?.productoId) onProductoDelAnuncio?.(b.productoId);
  };
  const { datos, cargando, error, recargar } = useEstilos();
  const estilos = useMemo(() => datos?.estilos || [], [datos]);
  const elegidosEstilos = elegidos.map((c) => estilos.find((e) => e.clave === c)).filter(Boolean);
  const fijos = Object.keys(anuncios);

  const [destinoALaVista, setDestinoALaVista] = useState(false);
  // la píldora se esconde cuando ya se ven los guiones
  useEffect(() => {
    const el = document.getElementById('nv-guiones');
    setDestinoALaVista(false);
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => setDestinoALaVista(e.isIntersecting), { rootMargin: '0px 0px -10% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [elegidosEstilos.length, fijos.length]);

  const irAlDestino = () => document.getElementById('nv-guiones')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (error) {
    return (
      <EstadoVacio
        tono="error"
        titulo="No pude cargar los estilos"
        descripcion={error.message}
        acciones={
          <Boton variante="primario" onClick={recargar}>
            Reintentar
          </Boton>
        }
      />
    );
  }

  return (
    <div className="nv-paso2">
      <div className="nv-volver">
        <Boton variante="fantasma" tamano="chico" icono={ArrowLeft} onClick={onVolver}>
          Volver a tu producto
        </Boton>
        {producto ? (
          <span className="nv-volver__producto">
            {producto.foto?.url ? (
              <img src={producto.foto.url} alt="" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
            ) : (
              <span className="nv-volver__sin-foto" aria-hidden="true">
                <Package size={14} strokeWidth={2} />
              </span>
            )}
            <span>
              <strong>{producto.nombre}</strong>
              {producto.sub ? ` · ${producto.sub}` : ''}
            </span>
          </span>
        ) : null}
      </div>

      {cargando && !estilos.length ? <EsqueletoMiniaturas cantidad={6} min={160} /> : <GaleriaEstilos estilos={estilos} elegidos={elegidos} alternar={alternarEstilo} fijos={fijos} />}

      {elegidosEstilos.length ? (
        <Seccion
          titulo={elegidosEstilos.length === 1 ? 'Ajusta tu anuncio' : 'Ajusta cada anuncio'}
          icono={Sparkles}
          contador={elegidosEstilos.length > 1 ? elegidosEstilos.length : undefined}
          descripcion="La duración, la voz y lo propio de cada estilo. Lo que no toques, lo decide la IA."
        >
          <div className="pila escalonado" style={{ '--hueco': '14px' }}>
            {elegidosEstilos.map((e) => (
              <AjustesEstilo
                key={e.clave}
                estilo={e}
                ajuste={ajustes[e.clave] || {}}
                onCambio={(c) => cambiarAjuste(e.clave, c)}
                onQuitar={() => alternarEstilo(e.clave)}
                bloqueado={Boolean(anuncios[e.clave])}
                puedeQuitar={elegidosEstilos.length > 1}
              />
            ))}
          </div>
        </Seccion>
      ) : estilos.length ? (
        <EstadoVacio variante="compacto" icono={Sparkles} titulo="Elige un estilo" descripcion="Marca uno o varios en la galería de arriba para escribir su guion." />
      ) : null}

      {elegidosEstilos.length ? (
        <Guiones
          id="nv-guiones"
          estilos={elegidosEstilos}
          ajustes={ajustes}
          anuncios={anuncios}
          creando={creando}
          sinProducto={!producto}
          claude={claude}
          onEscribir={onEscribir}
          onVolverAlProducto={onVolver}
          onBrief={alLeerBrief}
          enfoque={enfoque}
        />
      ) : null}

      <PildoraTanda elegidos={elegidos} estilos={estilos} hayGuiones={fijos.length > 0} visible={elegidosEstilos.length > 0 && !destinoALaVista} onIr={irAlDestino} />
    </div>
  );
}

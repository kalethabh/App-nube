// "En producción": una ficha por anuncio que se está produciendo de verdad, con su avance en palabras,
// sus piezas llegando y el tiempo que falta. Sin dinero: el costo solo se ve en el informe de la entrega.
//
// Salen de useEnProduccion() (src/datos/produccion.js), lo mismo que cuentan el menú y la barra:
//   - los de la app: su conductor.json dice en qué paso van (y si es modo prueba)
//   - los que se producen desde la terminal: sin conductor, se cuentan por sus archivos
// Las carpetas viejas que quedaron sin terminar van aparte, en "Quedaron a medio camino".
// Sin nada andando, un estado vacío con el botón para hacer uno nuevo.
import { ArrowRight, CirclePause, Clock, LoaderCircle, WifiOff } from 'lucide-react';
import { BarraDeProgreso, Boton, Insignia, MiniaturaVideo, Seccion, Tarjeta } from '../../componentes/index.js';
import { miniatura, useAnuncio } from '../../datos/api.js';
import { enlace } from '../../datos/rutas.js';
import { fechaRelativa } from '../../datos/formato.js';
import { TEXTO_ALTO, faltaDeConductor, fraccionDePiezas, pasoActual, sinEscenasAun, textoDeFila, textoDePaso } from '../../datos/produccion.js';
import { BandaModoPrueba, MarcaModoPrueba } from '../produccion/ModoPrueba.jsx';

// ---------------------------------------------------------------- en palabras

const CORTO = { guion: 'Preparando', voz: 'Grabando la voz', imagenes: 'Generando las imágenes', videos: 'Generando los videos', revision: 'Revisando las imágenes', montaje: 'Montando el video' };

/** { titulo, detalle } de lo que está haciendo ahora un anuncio. */
function enQueVa(a) {
  const c = a.conductor;
  const pz = a.piezas;
  const piezas = pz ? `${pz.imagenes.hechas} de ${pz.imagenes.total} imágenes · ${pz.clips.hechos} de ${pz.clips.total} videos` : null;
  if (!c) {
    // todavía no llegó su conductor: no se inventa en qué va
    if (a.sinLeer) return { titulo: 'Cargando…', detalle: piezas || '' };
    // los de la terminal (o uno recién aprobado que todavía no escribió su conductor)
    if (a.estado !== 'en-produccion') return { titulo: 'Arrancando', detalle: 'La producción empieza en un momento.' };
    return { titulo: CORTO[a.etapa] || 'En producción', detalle: piezas || 'Se está produciendo desde la terminal.' };
  }
  if (a.alto?.tipo === 'conexion') return { titulo: TEXTO_ALTO.conexion.titulo, detalle: TEXTO_ALTO.conexion.texto };
  if (a.alto?.tipo === 'reintento') return { titulo: TEXTO_ALTO.reintento.titulo, detalle: a.alto.mensaje || TEXTO_ALTO.reintento.texto };
  const p = pasoActual(c);
  if (c.estado === 'esperando' || !p) return { titulo: 'En la fila', detalle: textoDeFila(c) || 'Arranca en un momento.' };
  const t = textoDePaso(p);
  if (p.id === 'imagenes-y-videos') return { titulo: t.haciendo, detalle: piezas || t.detalle };
  return { titulo: t.haciendo, detalle: t.detalle };
}

/** "faltan unos 12 min" · "menos de 1 min" */
function faltaEnPalabras(a) {
  if (a.sinLeer) return null;
  const pz = a.piezas;
  const faltan = pz ? { imagenes: Math.max(0, pz.imagenes.total - pz.imagenes.hechas), clips: Math.max(0, pz.clips.total - pz.clips.hechos) } : null;
  const s = a.conductor
    ? faltaDeConductor(a.conductor, faltan)
    : faltan
      ? Math.ceil(faltan.imagenes / 10) * 90 + Math.ceil(faltan.clips / 10) * 80 + 300
      : null;
  if (!Number.isFinite(s) || s === null) return null;
  if (s < 50) return 'menos de 1 min';
  return `faltan unos ${Math.max(1, Math.round(s / 60))} min`;
}

// ---------------------------------------------------------------- ficha

/** Las tomas de a una: la imagen aparece cuando existe su archivo; la que se está haciendo, en cian. */
function TiraDePiezas({ slug, enImagenes }) {
  // el detalle se vuelve a mirar cada tanto: así la tira se llena a medida que llegan las imágenes
  const { datos, alDia } = useAnuncio(slug, { cadaMs: 10000 });
  const tomas = (datos?.tomas || []).slice(0, 14);
  const n = tomas.length || 14;
  const primeraQueFalta = tomas.findIndex((t) => (enImagenes ? !t.imagenInicial : !t.clip));
  return (
    <div className="tb-tira" style={{ '--n': n }} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => {
        const t = tomas[i];
        // (las fotos, recién con el detalle leído en esta visita: el de otra puede nombrar una toma que se está rehaciendo)
        const imagen = (alDia && t?.imagenInicial) || null;
        const lista = Boolean(t && (enImagenes ? t.imagenInicial : t.clip));
        const generando = !lista && primeraQueFalta !== -1 && i >= primeraQueFalta && i < primeraQueFalta + 2;
        const clase = lista ? 'tb-tira__pieza--lista' : generando ? 'tb-tira__pieza--generando' : 'tb-tira__pieza--espera';
        return (
          <span key={i} className={`tb-tira__pieza ${clase}${imagen ? ' tb-tira__pieza--imagen' : ''}`}>
            {imagen ? <img src={miniatura(imagen, 160)} alt="" loading="lazy" decoding="async" draggable="false" /> : null}
            {lista && !enImagenes ? <span className="tb-tira__punto" /> : null}
          </span>
        );
      })}
    </div>
  );
}

function FichaProduccion({ a }) {
  const avance = Math.max(0, Math.min(1, a.conductor ? a.avance : a.avance ?? fraccionDePiezas(a)));
  const sinPorcentaje = Boolean(a.sinLeer);
  const { titulo, detalle } = enQueVa(a);
  const falta = faltaEnPalabras(a);
  const sinConexion = a.alto?.tipo === 'conexion';
  const reintentando = a.alto?.tipo === 'reintento';
  const paso = a.conductor ? pasoActual(a.conductor) : null;
  const montando = paso ? ['montaje', 'render', 'control-final', 'informe'].includes(paso.id) : a.etapa === 'montaje';
  const enImagenes = paso ? paso.id !== 'imagenes-y-videos' || (a.piezas && a.piezas.imagenes.hechas < a.piezas.imagenes.total) : a.etapa !== 'videos';
  const deLaTerminal = !a.conductor && a.estado === 'en-produccion';

  return (
    <Tarjeta variante="elevada" relleno="compacto" className="tb-ficha">
      <MiniaturaVideo
        className="tb-ficha__miniatura"
        imagen={a.miniatura}
        insignia={sinConexion || reintentando ? <Insignia estado="en-cola" variante="vidrio" texto={sinConexion ? 'Sin conexión' : 'Reintentando'} /> : <Insignia estado="generando" variante="vidrio" texto={sinPorcentaje ? 'En producción' : `${Math.round(avance * 100)} %`} />}
        atenuada
        href={enlace.produccion(a.slug)}
        anchoImagen={320}
        aria-label={a.titulo}
      >
        <BarraDeProgreso valor={avance * 100} tono="cian" grosor="fina" animada={!sinConexion} />
      </MiniaturaVideo>

      <div className="tb-ficha__cuerpo">
        <div className="tb-ficha__cabecera">
          <div className="tb-ficha__nombres">
            <h3 className="tb-ficha__titulo t-dos-lineas">{a.titulo || a.slug}</h3>
            <p className="tb-ficha__estilo t-recortar">
              {[a.estiloNombre, deLaTerminal ? 'desde la terminal' : null].filter(Boolean).join(' · ')}
              {a.conductor?.modoPrueba ? <MarcaModoPrueba className="tb-ficha__prueba" /> : null}
            </p>
          </div>
          {falta && !sinConexion ? (
            <span className="tb-ficha__tiempo t-num">
              <Clock size={14} strokeWidth={2.2} aria-hidden="true" />
              {falta}
            </span>
          ) : null}
        </div>

        <div className="tb-ficha__avance" aria-live="polite">
          <p className="tb-ficha__palabras">
            {sinConexion ? <WifiOff size={15} strokeWidth={2.2} aria-hidden="true" /> : montando ? <LoaderCircle size={15} strokeWidth={2.4} className="girando" aria-hidden="true" /> : null}
            <span className="t-num">{titulo}</span>
          </p>
          <p className="tb-ficha__detalle">{detalle}</p>
        </div>

        <BarraDeProgreso valor={avance * 100} tono={sinConexion ? 'aviso' : 'cian'} animada={!sinConexion} etiqueta="Avance" />

        {/* un cantado antes de sus escenas no tiene tomas todavía (ni detalle que pedir): sin tira */}
        {sinEscenasAun(a, a.conductor) ? null : <TiraDePiezas slug={a.slug} enImagenes={enImagenes} />}

        <div className="tb-ficha__pie">
          <Boton variante="fantasma" tamano="chico" iconoDerecha={ArrowRight} href={enlace.produccion(a.slug)}>
            Ver producción
          </Boton>
        </div>
      </div>
    </Tarjeta>
  );
}

// ---------------------------------------------------------------- a medio camino (carpetas reales viejas)

function enQueQuedo(a) {
  const { imagenes, clips } = a.piezas;
  if (clips.total && clips.hechos >= clips.total) return `Tiene sus ${imagenes.hechas} imágenes y ${clips.hechos} videos: falta el montaje`;
  if (imagenes.hechas) return `Imágenes ${imagenes.hechas} de ${imagenes.total}${clips.hechos ? ` · videos ${clips.hechos} de ${clips.total}` : ' · sin videos todavía'}`;
  return 'Solo tiene el guion y los prompts';
}

function MedioCamino({ lista, actividad }) {
  return (
    <div className="tb-medio" id="a-medio-camino">
      <p className="tb-medio__titulo">
        <CirclePause size={15} strokeWidth={2.2} aria-hidden="true" />
        Quedaron a medio camino
        <span className="tb-medio__contador t-num">{lista.length}</span>
      </p>
      <div className="tb-medio__lista">
        {lista.map((a) => (
          <a key={a.slug} className="tb-pausado" href={enlace.produccion(a.slug)}>
            <span className="tb-pausado__foto">
              {a.miniatura ? <img src={miniatura(a.miniatura, 160)} alt="" loading="lazy" decoding="async" draggable="false" /> : null}
            </span>
            <span className="tb-pausado__textos">
              <span className="tb-pausado__titulo t-recortar">{a.titulo}</span>
              <span className="tb-pausado__detalle">
                {a.estiloNombre} · {a.piezas ? enQueQuedo(a) : 'Sin terminar'}
              </span>
              <span className="tb-pausado__fecha">Último cambio: {fechaRelativa(actividad?.[a.slug]?.ultima || a.fecha)}</span>
            </span>
            <span className="tb-pausado__ir" aria-hidden="true">
              <ArrowRight size={16} strokeWidth={2} />
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- la sección

/** p = useEnProduccion() (src/datos/produccion.js): lo mismo que leen el menú y la barra de arriba. */
export function EnProduccion({ p }) {
  const { activos, pausados, actividad } = p;
  // Solo aparece cuando de verdad algo se está produciendo o quedó frenado a medio camino (Diego, 2026-10-25).
  if (!activos.length && !pausados.length) return null;

  return (
    <Seccion
      titulo="En producción"
      contador={p.cantidad}
      icono={LoaderCircle}
      tono="cian"
      descripcion={activos.length ? 'No tienes que hacer nada: cada anuncio avanza solo y aparece en Listos al terminar.' : null}
    >
      {p.modoPrueba ? <BandaModoPrueba className="tb-prueba">Los anuncios marcados así salen de simuladores en tu PC: no se le pide nada a kie, a ElevenLabs ni a Suno.</BandaModoPrueba> : null}
      {activos.length ? (
        <div className="tb-fichas">
          {activos.map((a) => (
            <FichaProduccion key={a.slug} a={a} />
          ))}
        </div>
      ) : null}
      {pausados.length ? <MedioCamino lista={pausados} actividad={actividad} /> : null}
    </Seccion>
  );
}

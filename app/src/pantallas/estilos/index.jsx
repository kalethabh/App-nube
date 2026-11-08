// ESTILOS (#/estilos): los 12 estilos y el efecto continuidad en grande, cada uno con un anuncio real hecho con el sistema.
// Arriba, el escaparate del estilo elegido (su video sonando sin audio, qué es, para qué sirve y su tono);
// abajo, todos por familia. "Usar este estilo" abre Nuevo anuncio con ese estilo marcado.
// Sin precios: el costo real de un anuncio solo se ve en el informe de la Entrega.
// El video de muestra de cada estilo sale de GET /api/estilos (server/lib/muestras.js). #/estilos?estilo=<clave> abre
// con ese estilo en grande.
// La app produce de punta a punta los estilos de DISPONIBLES (catalogo.js: los 12) y la continuidad en los 6 con
// narrador; uno que no estuviera ahí se vería igual, pero con "Muy pronto" en lugar de "Usar este estilo".
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Clapperboard, Clock, Hourglass, Mic, Palette, Sparkles, Target, Volume2, VolumeX } from 'lucide-react';
import { Boton, CabeceraPagina, Esqueleto, EsqueletoMiniaturas, EstadoVacio, MiniaturaVideo, Seccion } from '../../componentes/index.js';
import { miniatura, useAnuncio, useEstilos } from '../../datos/api.js';
import { duracion as formatoDuracion } from '../../datos/formato.js';
import { enlace } from '../../datos/rutas.js';
import { CONTINUIDAD_DISPONIBLE, CON_CONTINUIDAD, DETALLES, ICONO_FAMILIA, disponible } from './catalogo.js';
import './estilos.css';

/** La marca "Muy pronto" de los estilos que la app todavía no produce sola. */
function MuyPronto({ chico = false }) {
  return (
    <span className={`es-pronto${chico ? ' es-pronto--chico' : ''}`}>
      <Hourglass size={chico ? 11 : 12} strokeWidth={2.4} aria-hidden="true" /> Muy pronto
    </span>
  );
}

const ELIGELO = {
  'voz-en-off': 'Elígelo si tu producto se explica: un mecanismo, un antes y un después, un dato curioso.',
  hablado: 'Elígelo si necesitas confianza: alguien que lo cuenta con su voz.',
  cantado: 'Elígelo si quieres que se pegue.',
  efecto: 'Se suma a cualquiera de los 6 estilos con narrador.',
};

// ---------------------------------------------------------------- la tira de tomas del anuncio de muestra

function TiraDeTomas({ slug }) {
  const { datos, cargando } = useAnuncio(slug);
  if (cargando && !datos) {
    return (
      <div className="es-tira" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <Esqueleto key={i} className="es-tira__cuadro" />
        ))}
      </div>
    );
  }
  const tomas = (datos?.tomas || []).filter((t) => t.imagenInicial || t.clip);
  if (!tomas.length) return null;
  const n = Math.min(6, tomas.length);
  const elegidas = Array.from({ length: n }, (_, i) => tomas[Math.round((i * (tomas.length - 1)) / Math.max(1, n - 1))]);
  return (
    <div className="es-tira">
      {elegidas.map((t, i) => (
        <figure key={`${t.n}-${i}`} className="es-tira__cuadro" style={{ '--i': i }}>
          <img src={t.imagenInicial ? miniatura(t.imagenInicial, 200) : miniatura(t.clip, 200, { segundo: 1 })} alt="" loading="lazy" />
          <figcaption className="t-mono">{String(t.n).padStart(2, '0')}</figcaption>
        </figure>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- el escaparate

function Escaparate({ estilo, onAnterior, onSiguiente }) {
  const d = DETALLES[estilo.clave] || {};
  const Icono = ICONO_FAMILIA[estilo.familia] || Sparkles;
  const video = useRef(null);
  const [conSonido, setConSonido] = useState(false);
  const [avance, setAvance] = useState(0);
  const muestra = estilo.muestra;
  const usable = estilo.familia === 'efecto' ? CONTINUIDAD_DISPONIBLE : disponible(estilo.clave);

  useEffect(() => {
    setConSonido(false);
    setAvance(0);
  }, [estilo.clave]);

  const alternarSonido = () => {
    const v = video.current;
    if (!v) return;
    v.muted = !v.muted;
    setConSonido(!v.muted);
    if (v.paused) v.play().catch(() => {});
  };

  return (
    <section className="es-escaparate" aria-label={`Estilo ${estilo.nombre}`}>
      <div className="es-escaparate__fondo" aria-hidden="true">
        {muestra?.imagen ? <img key={estilo.clave} src={miniatura(muestra.imagen, 480)} alt="" /> : null}
      </div>

      <div className="es-escaparate__video">
        {muestra?.video ? (
          <video
            key={estilo.clave}
            ref={video}
            src={muestra.video}
            poster={muestra.imagen ? miniatura(muestra.imagen, 720) : undefined}
            muted
            autoPlay
            loop
            playsInline
            preload="metadata"
            disablePictureInPicture
            onTimeUpdate={(e) => setAvance(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
          />
        ) : (
          <div className="es-escaparate__sin-video">
            <Clapperboard size={28} strokeWidth={1.6} aria-hidden="true" />
          </div>
        )}
        <div className="es-escaparate__sombra" aria-hidden="true" />
        {muestra?.duracion ? <span className="es-escaparate__duracion t-mono">{formatoDuracion(muestra.duracion)}</span> : null}
        {muestra?.video ? (
          <button type="button" className="es-sonido" onClick={alternarSonido} aria-pressed={conSonido} aria-label={conSonido ? 'Quitar el sonido' : 'Escuchar con sonido'}>
            {conSonido ? <Volume2 size={17} strokeWidth={2} /> : <VolumeX size={17} strokeWidth={2} />}
          </button>
        ) : null}
        <span className="es-escaparate__avance" style={{ transform: `scaleX(${avance})` }} aria-hidden="true" />
      </div>

      <div className="es-escaparate__info">
        <div className="es-escaparate__nav">
          <span className="es-familia">
            <Icono size={14} strokeWidth={2.2} aria-hidden="true" /> {estilo.familiaNombre}
          </span>
          <div className="fila" style={{ '--hueco': '6px' }}>
            <Boton variante="secundario" tamano="chico" soloIcono icono={ChevronLeft} etiqueta="Estilo anterior" onClick={onAnterior} />
            <Boton variante="secundario" tamano="chico" soloIcono icono={ChevronRight} etiqueta="Estilo siguiente" onClick={onSiguiente} />
          </div>
        </div>

        <div key={estilo.clave} className="es-escaparate__textos">
          <h2 className="es-escaparate__titulo">
            {estilo.nombre}
            {usable ? null : <MuyPronto />}
          </h2>
          <p className="es-escaparate__lema">{estilo.lema}</p>
          <p className="es-escaparate__descripcion">{estilo.descripcion}</p>

          <dl className="es-datos">
            <div className="es-dato">
              <dt>
                <Mic size={14} strokeWidth={2} aria-hidden="true" /> Quién habla
              </dt>
              <dd>{d.quienHabla}</dd>
            </div>
            <div className="es-dato">
              <dt>
                <Target size={14} strokeWidth={2} aria-hidden="true" /> Ideal para
              </dt>
              <dd>{d.idealPara}</dd>
            </div>
            <div className="es-dato">
              <dt>
                <Clock size={14} strokeWidth={2} aria-hidden="true" /> Después del «Sí»
              </dt>
              <dd>{d.paradas}</dd>
            </div>
            <div className="es-dato">
              <dt>
                <Palette size={14} strokeWidth={2} aria-hidden="true" /> Tono
              </dt>
              <dd>{d.tono}</dd>
            </div>
          </dl>

          <div className="es-escaparate__acciones">
            {usable ? (
              <Boton
                variante="primario"
                tamano="grande"
                iconoDerecha={ArrowRight}
                href={estilo.familia === 'efecto' ? enlace.nuevo({ estilo: 'estilo-pixar', continuidad: '1' }) : enlace.nuevo({ estilo: estilo.clave })}
              >
                {estilo.familia === 'efecto' ? 'Usar con Estilo Pixar' : 'Usar este estilo'}
              </Boton>
            ) : (
              <Boton variante="secundario" tamano="grande" icono={Hourglass} disabled>
                Muy pronto
              </Boton>
            )}
            {muestra?.slug ? (
              <Boton variante="secundario" tamano="grande" icono={Clapperboard} href={enlace.anuncio(muestra.slug)}>
                Ver el anuncio completo
              </Boton>
            ) : null}
          </div>
          {usable ? null : (
            <p className="es-escaparate__pronto">
              {estilo.familia === 'efecto' ? 'Este efecto' : 'Este estilo'} llega en una próxima versión de la app: ya puedes ver cómo se ve.
            </p>
          )}

          {muestra?.slug ? (
            <div className="es-escaparate__muestra">
              <span className="t-etiqueta">Así se ve, toma por toma</span>
              <TiraDeTomas slug={muestra.slug} />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- la pantalla

export default function Estilos({ consulta }) {
  const { datos, cargando, error, recargar } = useEstilos();
  const estilos = datos?.estilos || [];
  const pedido = consulta?.get?.('estilo') || null;
  const [elegido, setElegido] = useState(pedido);
  useEffect(() => {
    if (pedido) setElegido(pedido);
  }, [pedido]);
  const escaparate = useRef(null);
  const actual = estilos.find((e) => e.clave === elegido) || estilos[0];

  const mover = (paso) => {
    if (!estilos.length) return;
    const i = estilos.findIndex((e) => e.clave === actual?.clave);
    setElegido(estilos[(i + paso + estilos.length) % estilos.length].clave);
  };

  const elegir = (clave) => {
    setElegido(clave);
    const el = escaparate.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="pagina es">
      <CabeceraPagina
        sobretitulo="Estilos"
        titulo="13 estilos, un efecto y 3 especiales"
        descripcion="Trece maneras de contar tu producto, más la continuidad, que encadena las escenas sin cortes, y tres especiales: clonar un video, sacar más ganchos y el sketch de comedia. Toca un estilo para verlo en grande y úsalo con tu producto."
      />

      {error ? (
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
      ) : null}

      {cargando && !estilos.length ? (
        <>
          <Esqueleto alto={560} style={{ borderRadius: 'var(--r-2xl)' }} />
          <EsqueletoMiniaturas cantidad={6} min={170} />
        </>
      ) : null}

      {actual ? (
        <div ref={escaparate} className="es-ancla">
          <Escaparate estilo={actual} onAnterior={() => mover(-1)} onSiguiente={() => mover(1)} />
        </div>
      ) : null}

      {estilos.length ? (
        <>
          <Familia id="voz-en-off" estilos={estilos} familias={datos.familias} actual={actual} onElegir={elegir} />
          <div className="es-dos-familias">
            <Familia id="hablado" estilos={estilos} familias={datos.familias} actual={actual} onElegir={elegir} />
            <Familia id="cantado" estilos={estilos} familias={datos.familias} actual={actual} onElegir={elegir} />
          </div>
          <Efecto estilo={estilos.find((e) => e.familia === 'efecto')} estilos={estilos} actual={actual} onElegir={elegir} />
          <Especiales />
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- una familia (rejilla de tarjetas)

function TarjetaEstilo({ estilo, actual, onElegir }) {
  const viendo = actual?.clave === estilo.clave;
  return (
    <div className="es-tarjeta">
      <MiniaturaVideo
        imagen={estilo.muestra?.imagen}
        video={estilo.muestra?.video}
        duracion={estilo.muestra?.duracion}
        insignia={viendo ? <span className="es-en-pantalla">Viendo</span> : null}
        etiqueta={disponible(estilo.clave) ? null : <MuyPronto chico />}
        titulo={estilo.nombre}
        subtitulo={estilo.lema}
        seleccionada={viendo}
        onClick={() => onElegir(estilo.clave)}
        aria-label={`Ver ${estilo.nombre} en grande`}
      />
    </div>
  );
}

function Familia({ id, estilos, familias, actual, onElegir }) {
  const lista = estilos.filter((e) => e.familia === id);
  if (!lista.length) return null;
  const familia = familias.find((x) => x.id === id);
  const Icono = ICONO_FAMILIA[id] || Sparkles;
  return (
    <Seccion titulo={familia?.nombre || id} icono={Icono} contador={lista.length} descripcion={ELIGELO[id]} className="es-familia-seccion" style={{ '--columnas': lista.length }}>
      <div className="es-rejilla">
        {lista.map((e) => (
          <TarjetaEstilo key={e.clave} estilo={e} actual={actual} onElegir={onElegir} />
        ))}
      </div>
    </Seccion>
  );
}

// ---------------------------------------------------------------- el efecto (continuidad): tarjeta ancha

function Efecto({ estilo, estilos, actual, onElegir }) {
  if (!estilo) return null;
  const conNarrador = estilos.filter((e) => e.familia === 'voz-en-off' && CON_CONTINUIDAD.includes(e.clave));
  return (
    <Seccion titulo="Efecto" icono={ICONO_FAMILIA.efecto} contador={1} descripcion={ELIGELO.efecto}>
      <div className={`es-efecto${actual?.clave === estilo.clave ? ' es-efecto--viendo' : ''}`}>
        <div className="es-efecto__miniatura">
          <MiniaturaVideo
            imagen={estilo.muestra?.imagen}
            video={estilo.muestra?.video}
            duracion={estilo.muestra?.duracion}
            seleccionada={actual?.clave === estilo.clave}
            onClick={() => onElegir(estilo.clave)}
            aria-label={`Ver ${estilo.nombre} en grande`}
          />
        </div>
        <div className="es-efecto__textos">
          <h3 className="es-efecto__titulo">
            {estilo.nombre}
            {CONTINUIDAD_DISPONIBLE ? null : <MuyPronto />}
          </h3>
          <p className="es-efecto__lema">{estilo.lema}</p>
          <p className="es-efecto__descripcion">{estilo.descripcion} Lleva menos clips, pero más largos: la IA hace el paso de una escena a la otra.</p>
          <div className="es-efecto__con">
            <span className="t-etiqueta">Se suma a</span>
            <div className="fila fila--envolver" style={{ '--hueco': '6px' }}>
              {conNarrador.map((e) =>
                CONTINUIDAD_DISPONIBLE ? (
                  <a key={e.clave} className="es-efecto__estilo" href={enlace.nuevo({ estilo: e.clave, continuidad: '1' })}>
                    <img src={miniatura(e.muestra?.imagen, 96)} alt="" />
                    {e.nombre}
                  </a>
                ) : (
                  <span key={e.clave} className="es-efecto__estilo es-efecto__estilo--quieto">
                    <img src={miniatura(e.muestra?.imagen, 96)} alt="" />
                    {e.nombre}
                  </span>
                )
              )}
            </div>
          </div>
          <div className="es-escaparate__acciones">
            {CONTINUIDAD_DISPONIBLE ? (
              <Boton variante="primario" iconoDerecha={ArrowRight} href={enlace.nuevo({ estilo: 'estilo-pixar', continuidad: '1' })}>
                Usar con Estilo Pixar
              </Boton>
            ) : (
              <Boton variante="secundario" icono={Hourglass} disabled>
                Muy pronto
              </Boton>
            )}
            <Boton variante="secundario" onClick={() => onElegir(estilo.clave)}>
              Verlo en grande
            </Boton>
          </div>
        </div>
      </div>
    </Seccion>
  );
}

// ---------------------------------------------------------------- los especiales (no son un estilo: se usan con uno)

const ESPECIALES = [
  {
    id: 'clonacion',
    nombre: 'Clonar un video',
    lema: 'La estructura de un anuncio que ya vende',
    texto: 'Sube el video de un anuncio que funciona (o pega su link de la Biblioteca de anuncios de Meta, TikTok, Instagram o YouTube) en «Clonar un video», dentro de los ajustes de cualquier estilo. Se copian sus tomas, sus tiempos y lo que hace cada frase, con tu producto.',
    href: () => enlace.nuevo(),
    accion: 'Nuevo anuncio',
  },
  {
    id: 'replicador-ganchos',
    nombre: 'Más ganchos',
    lema: 'El mismo anuncio con otros inicios',
    texto: 'Abre un anuncio con narrador ya terminado y toca «Más ganchos»: salen de 2 a 5 versiones que solo cambian los primeros segundos. Solo se hace el gancho nuevo; lo demás se reutiliza.',
    href: () => enlace.tablero(),
    accion: 'Ir a mis anuncios',
  },
  {
    id: 'sketch',
    nombre: 'Sketch de comedia',
    lema: 'Telenovela que no parece anuncio',
    texto: 'Se burlan del problema del protagonista y un mensajero le pasa el producto como un secreto. Por ahora se hace desde Claude Code en esta carpeta: pídele «un anuncio sketch» de tu producto.',
    href: null,
    accion: null,
  },
];

function Especiales() {
  return (
    <Seccion titulo="Especiales" icono={Sparkles} contador={ESPECIALES.length} descripcion="No son un estilo: se usan con uno, o con un anuncio que ya hiciste." className="es-familia-seccion" style={{ '--columnas': ESPECIALES.length }}>
      <div className="es-especiales">
        {ESPECIALES.map((e) => (
          <div key={e.id} className="es-especial">
            <MiniaturaVideo imagen={`/especiales/${e.id}.webp`} titulo={e.nombre} subtitulo={e.lema} relacion="16 / 9" reproducirAlPasar={false} />
            <p className="es-especial__texto">{e.texto}</p>
            {e.href ? (
              <Boton variante="secundario" tamano="chico" iconoDerecha={ArrowRight} href={e.href()}>
                {e.accion}
              </Boton>
            ) : null}
          </div>
        ))}
      </div>
    </Seccion>
  );
}

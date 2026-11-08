// Arriba del tablero: saludo, las cifras del momento, el gran "Nuevo anuncio" y un collage con las muestras de
// los estilos (GET /api/estilos; el del frente se reproduce solo, sin sonido).
import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Boton, CabeceraPagina, Esqueleto } from '../../componentes/index.js';
import { miniatura } from '../../datos/api.js';
import { enlace } from '../../datos/rutas.js';
import { useMuestras } from '../../datos/muestras.js';
import { numero } from '../../datos/formato.js';
import { fechaDeHoy, hechosDelMes, saludo } from './datos.js';

// Las muestras de estos estilos, en este orden. El del medio (el tercero) va adelante y se reproduce. Si a alguno le
// falta la muestra, se completa con las de otros estilos y despues con tus anuncios listos de estilos distintos, para
// que el abanico quede siempre parejo. Una muestra que es un anuncio (trae slug) abre ese anuncio; la que trae el
// paquete de la app abre su estilo.
const COLLAGE = ['claymation', 'crochet', 'estilo-pixar', 'zack-d-films', 'estilo-lego'];

function elegirCollage(muestras, anuncios) {
  const elegidos = [];
  const sumar = (a, href) => {
    if (elegidos.length >= COLLAGE.length || !a.miniatura) return;
    if (elegidos.some((e) => (a.slug && e.slug === a.slug) || e.estiloNombre === a.estiloNombre)) return;
    elegidos.push({ ...a, href, llave: a.slug || `muestra-${a.clave}` });
  };
  for (const m of muestras) sumar(m, m.slug ? enlace.anuncio(m.slug) : enlace.estilos({ estilo: m.clave }));
  for (const a of anuncios.filter((x) => x.estado === 'listo')) sumar(a, enlace.anuncio(a.slug));
  // siempre impar (5 o 3), para que el del frente quede en el centro
  return elegidos.length >= 5 ? elegidos.slice(0, 5) : elegidos.length >= 3 ? elegidos.slice(0, 3) : [];
}

function useMovimientoReducido() {
  const [reducido, setReducido] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const cambio = () => setReducido(mq.matches);
    mq.addEventListener('change', cambio);
    return () => mq.removeEventListener('change', cambio);
  }, []);
  return reducido;
}

function Cifra({ etiqueta, valor, detalle, marca, tono }) {
  return (
    <div className={`tb-cifra${tono ? ` tb-cifra--${tono}` : ''}`}>
      <span className="tb-cifra__etiqueta">
        {etiqueta}
        {marca}
      </span>
      <span className="tb-cifra__valor t-num">{valor}</span>
      {detalle ? <span className="tb-cifra__detalle">{detalle}</span> : null}
    </div>
  );
}

function Collage({ anuncios }) {
  const reducido = useMovimientoReducido();
  const videoRef = useRef(null);
  const { muestras } = useMuestras(COLLAGE);
  const elegidos = elegirCollage(muestras, anuncios);
  const corrimiento = elegidos.length === 3 ? 1 : 0; // con 3, ocupan los lugares del medio (1, 2 y 3)
  const frente = 2 - corrimiento; // el del medio va adelante y se reproduce

  useEffect(() => {
    const v = videoRef.current;
    if (!v || reducido) return;
    const p = v.play();
    if (p?.catch) p.catch(() => {});
  }, [reducido, elegidos.length]);

  if (elegidos.length < 3) return null;
  return (
    <div className="tb-collage">
      {elegidos.map((a, i) => (
        <a
          key={a.llave}
          href={a.href}
          className={`tb-collage__pieza tb-collage__pieza--${i + corrimiento}${i === frente ? ' tb-collage__pieza--frente' : ''}`}
          aria-label={`Ver ${a.titulo}`}
          tabIndex={i === frente ? 0 : -1}
        >
          <img src={miniatura(a.miniatura, 320)} alt="" loading="eager" decoding="async" draggable="false" />
          {i === frente && a.video && !reducido ? (
            <video ref={videoRef} src={a.video} muted loop playsInline autoPlay preload="auto" disablePictureInPicture />
          ) : null}
          <span className="tb-collage__chip">{a.estiloNombre}</span>
        </a>
      ))}
    </div>
  );
}

export function Portada({ anuncios: todos, cargando, enProduccion, aMedioCamino, teNecesitan }) {
  // los de modo prueba (simuladores) no cuentan: no son para publicar
  const anuncios = todos.filter((a) => !a.modoPrueba);
  const listos = anuncios.filter((a) => a.estado === 'listo').length;
  const delMes = hechosDelMes(anuncios);

  return (
    <section className="tb-portada" aria-label="Resumen">
      <div className="tb-portada__texto">
        <CabeceraPagina
          sobretitulo={`${saludo()} · ${fechaDeHoy()}`}
          titulo="Mis anuncios"
          descripcion={
            cargando ? 'Buscando tus anuncios…' : `${numero(listos)} ${listos === 1 ? 'anuncio listo' : 'anuncios listos'} para publicar.${teNecesitan ? ' Lo que te necesita va primero.' : ''}`
          }
        />
        <div className="tb-portada__accion">
          <Boton variante="primario" tamano="grande" icono={Plus} href={enlace.nuevo()}>
            Nuevo anuncio
          </Boton>
          <p className="tb-portada__ayuda">
            Cuéntale tu producto una vez
            <br />y elige uno o varios estilos.
          </p>
        </div>
      </div>

      {!cargando ? <Collage anuncios={anuncios} /> : null}

      <div className="tb-cifras">
        {cargando ? (
          Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="tb-cifra">
              <Esqueleto forma="texto" ancho={70} alto={10} />
              <Esqueleto ancho={64} alto={30} />
            </div>
          ))
        ) : (
          <>
            <Cifra etiqueta="Listos" valor={numero(listos)} detalle={`de ${numero(anuncios.length)} anuncios`} tono="ok" />
            {/* las cifras de lo que pasa ahora solo se ven cuando de verdad hay algo */}
            {enProduccion || aMedioCamino ? (
              <Cifra
                etiqueta="En producción"
                valor={numero(enProduccion)}
                detalle={aMedioCamino ? `+ ${aMedioCamino} a medio camino` : 'ahora mismo'}
                tono="cian"
              />
            ) : null}
            {teNecesitan ? <Cifra etiqueta="Te necesitan" valor={numero(teNecesitan)} detalle="para seguir" tono="error" /> : null}
            <Cifra
              etiqueta={`Hechos en ${delMes.mes}`}
              valor={numero(delMes.anuncios)}
              detalle={delMes.anuncios ? `en ${delMes.estilos} ${delMes.estilos === 1 ? 'estilo' : 'estilos'}` : 'todavía ninguno este mes'}
              tono="acento"
            />
          </>
        )}
      </div>
    </section>
  );
}

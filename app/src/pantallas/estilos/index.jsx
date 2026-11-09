// ESTILOS (#/estilos): los 13 estilos, la continuidad y los especiales, en una cuadrícula limpia. Cada tarjeta
// reproduce su anuncio de muestra al pasar el mouse; al tocarla se abre el detalle (video grande, para qué sirve y
// «Usar este estilo»). Filtros por familia. #/estilos?estilo=<clave> abre ese estilo.
// Los especiales (Clonar, Más ganchos, Sketch) no tienen muestra propia: usan un anuncio que ya hiciste, de tu GitHub.
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clapperboard, Copy, Laugh, Layers, Mic, Music, Repeat2, Sparkles, Target, Users } from 'lucide-react';
import { Boton, CabeceraPagina, Chip, EsqueletoMiniaturas, MiniaturaVideo, Modal } from '../../componentes/index.js';
import { miniatura, useDatos, useEstilos } from '../../datos/api.js';
import { enlace, partirRuta, useHash, ir, rutas } from '../../datos/rutas.js';
import { CON_CONTINUIDAD, DETALLES, SUBESTILOS, disponible, iconoDe } from './catalogo.js';
import './estilos2.css';

const FILTROS = [
  { id: 'todos', nombre: 'Todos', icono: Sparkles },
  { id: 'voz-en-off', nombre: 'Con narrador', icono: Mic },
  { id: 'hablado', nombre: 'Alguien habla', icono: Users },
  { id: 'cantado', nombre: 'Cantados', icono: Music },
  { id: 'especiales', nombre: 'Especiales', icono: Layers },
];

const ESPECIALES = [
  { clave: 'cambiar', nombre: 'Cambiar el producto', lema: 'Un video que ya existe, con tu producto', icono: Repeat2, buscar: () => false, como: 'Subes el video: queda igual, pero con tu producto, la voz en español con la misma voz y subtítulos nuevos.', href: () => enlace.cambiar() },
  { clave: 'clonacion', nombre: 'Clonar un video', lema: 'La estructura de un anuncio que ya vende', icono: Copy, buscar: (a) => a.estilo === 'entrevista' && a.referencias?.length, comparar: true, como: 'En los ajustes de cualquier estilo: «Clonar un video».', href: () => enlace.nuevo() },
  { clave: 'ganchos', nombre: 'Más ganchos', lema: 'El mismo anuncio con otros inicios', icono: Repeat2, buscar: (a) => a.estilo === 'zack-d-films', como: 'En la entrega de un anuncio con narrador: «Más ganchos».', href: () => enlace.anuncios() },
  { clave: 'sketch', nombre: 'Sketch de comedia', lema: 'Telenovela que no parece anuncio', icono: Laugh, buscar: (a) => a.estilo === 'sketch', como: 'Una telenovela de 1 minuto con diálogo: se burlan del problema y alguien le pasa tu producto como un secreto.', href: () => enlace.sketch() },
];

async function leerGithub() {
  const r = await fetch('/api/anuncios-github', { headers: { Accept: 'application/json' } });
  if (!r.ok) return { productos: [] };
  return r.json();
}

/** El detalle de un estilo, en una ventana: el video grande, tres datos y el botón. */
function Detalle({ e, onCerrar }) {
  if (!e) return null;
  const d = DETALLES[e.clave] || {};
  const Icono = e.icono || iconoDe(e.clave, e.familia);
  const subs = (SUBESTILOS[e.clave] || []).slice(0, 8);
  return (
    <Modal abierto={Boolean(e)} onCerrar={onCerrar} titulo={e.nombre} descripcion={e.lema} icono={Icono} tamano="grande">
      <div className="es2-detalle">
        {e.comparar && e.referencia ? (
          <div className="es2-comparar">
            <figure>
              <video src={e.referencia} autoPlay muted loop playsInline controls />
              <figcaption>El original</figcaption>
            </figure>
            <figure>
              <video src={e.video} poster={e.imagen ? miniatura(e.imagen, 480) : undefined} autoPlay muted loop playsInline controls />
              <figcaption>Tu clon</figcaption>
            </figure>
          </div>
        ) : (
        <div className="es2-detalle__video">
          {e.video ? (
            <video key={e.video} src={e.video} poster={e.imagen ? miniatura(e.imagen, 480) : undefined} autoPlay muted loop playsInline controls />
          ) : e.imagen ? (
            <img src={miniatura(e.imagen, 480)} alt="" />
          ) : null}
        </div>
        )}
        <div className="es2-detalle__texto">
          {e.descripcion ? <p className="es2-detalle__descripcion">{e.descripcion}</p> : null}
          <dl className="es2-datos">
            {(e.como ? [['Dónde se usa', e.como, Target]] : [
              ['Quién habla', d.quienHabla, Mic],
              ['Ideal para', d.idealPara, Target],
              ['Tono', d.tono, Sparkles],
            ])
              .filter(([, v]) => v)
              .map(([k, v, I]) => (
                <div key={k} className="es2-dato">
                  <dt>
                    <I size={14} strokeWidth={2.2} aria-hidden="true" /> {k}
                  </dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
          {subs.length ? (
            <div className="es2-subs">
              <span className="es2-subs__titulo">Subestilos</span>
              <div className="es2-subs__lista">
                {subs.map((s) => (
                  <span key={s.id} className="es2-sub">
                    <img src={`/subestilos/${e.clave}/${s.id}/vista.jpg`} alt="" loading="lazy" />
                    {s.nombre}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {CON_CONTINUIDAD.includes(e.clave) ? <p className="es2-nota">Se puede hacer con continuidad: sin un solo corte.</p> : null}
          {e.href !== null ? (
            <Boton variante="primario" tamano="grande" iconoDerecha={ArrowRight} href={e.href ? e.href() : enlace.nuevo({ estilo: e.clave })}>
              {e.href ? 'Ir' : 'Usar este estilo'}
            </Boton>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

export default function Estilos() {
  const { datos, cargando } = useEstilos();
  const { datos: gh } = useDatos('anuncios-github', leerGithub, { cadaMs: 300000 });
  const hash = useHash();
  const elegido = useMemo(() => partirRuta(hash).consulta.get('estilo'), [hash]);
  const [filtro, setFiltro] = useState('todos');
  const [abierto, setAbierto] = useState(null);

  const deGithub = useMemo(() => (gh?.productos || []).flatMap((p) => p.anuncios), [gh]);
  const videoDe = (a) => (a ? { video: a.versiones?.[0]?.url || null, imagen: a.portada || null, referencia: a.referencias?.[0]?.url || null } : {});

  const tarjetas = useMemo(() => {
    const estilos = (datos?.estilos || []).map((e) => {
      // si el estilo no trae video de muestra, uno tuyo de ese estilo, de GitHub
      const propio = !e.muestra?.video ? videoDe(deGithub.find((a) => a.estilo === e.clave)) : {};
      return {
        clave: e.clave,
        nombre: e.nombre,
        lema: e.lema,
        descripcion: e.descripcion,
        familia: e.clave === 'continuidad' ? 'especiales' : e.familia,
        familiaNombre: e.familiaNombre,
        video: e.muestra?.video || propio.video || null,
        imagen: e.muestra?.imagen || propio.imagen || null,
        listo: e.clave === 'continuidad' || disponible(e.clave),
        href: e.clave === 'continuidad' ? () => enlace.nuevo({ estilo: 'estilo-pixar', continuidad: '1' }) : undefined,
      };
    });
    const especiales = ESPECIALES.map((x) => ({ ...x, familia: 'especiales', familiaNombre: 'Especial', listo: true, ...videoDe(deGithub.find(x.buscar)) }));
    return [...estilos, ...especiales];
  }, [datos, deGithub]);

  useEffect(() => {
    if (!elegido || !tarjetas.length) return;
    const t = tarjetas.find((x) => x.clave === elegido);
    if (t) setAbierto(t);
  }, [elegido, tarjetas]);

  const visibles = tarjetas.filter((t) => filtro === 'todos' || t.familia === filtro);
  const cerrar = () => {
    setAbierto(null);
    if (elegido) ir(rutas.estilos(), { reemplazar: true });
  };

  return (
    <div className="pagina es2">
      <CabeceraPagina titulo="Estilos" descripcion="Elige cómo se cuenta tu producto. Pasa el mouse para verlo en movimiento." />
      <div className="es2-filtros" role="group" aria-label="Filtrar estilos">
        {FILTROS.map((f) => (
          <Chip key={f.id} activo={filtro === f.id} onClick={() => setFiltro(f.id)} icono={f.icono} contador={f.id === 'todos' ? tarjetas.length : tarjetas.filter((t) => t.familia === f.id).length}>
            {f.nombre}
          </Chip>
        ))}
      </div>
      {cargando && !datos ? (
        <EsqueletoMiniaturas cantidad={10} min={200} />
      ) : (
        <div className="es2-rejilla" key={filtro}>
          {visibles.map((t, i) => {
            const Icono = t.icono || iconoDe(t.clave, t.familia);
            return (
              <MiniaturaVideo
                key={t.clave}
                className="es2-tarjeta"
                style={{ animationDelay: `${Math.min(i, 14) * 30}ms` }}
                imagen={t.imagen ? miniatura(t.imagen, 480) : null}
                video={t.video}
                titulo={t.nombre}
                subtitulo={t.lema}
                insignia={
                  <span className="es2-insignia">
                    <Icono size={13} strokeWidth={2.2} aria-hidden="true" />
                  </span>
                }
                aria-label={`Ver ${t.nombre}`}
                onClick={() => setAbierto(t)}
              />
            );
          })}
          {!visibles.length ? (
            <p className="es2-vacio">
              <Clapperboard size={16} aria-hidden="true" /> No hay estilos en este grupo.
            </p>
          ) : null}
        </div>
      )}
      <Detalle e={abierto} onCerrar={cerrar} />
    </div>
  );
}

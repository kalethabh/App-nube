// «Ahora»: lo que te necesita primero (en rojo) y después lo que se está produciendo, con su avance. Los mismos datos
// que el menú lateral y el tablero (useEnProduccion), así nunca dicen números distintos.
import { CircleCheck } from 'lucide-react';
import { BarraDeProgreso, Esqueleto, PuntoEstado } from '../../componentes/index.js';
import { miniatura } from '../../datos/api.js';
import { enlace } from '../../datos/rutas.js';

const QUE = { saldo: 'Recarga tu saldo', error: 'Se trabó', pausa: 'En pausa' };
const MAX = 5;

function Fila({ href, titulo, imagen, que, tono, avance }) {
  return (
    <li>
      <a className="ini-ahora__fila" href={href}>
        <span className="ini-ahora__mini">{imagen ? <img src={miniatura(imagen, 120)} alt="" loading="lazy" /> : null}</span>
        <span className="ini-ahora__textos">
          <span className="ini-ahora__titulo">{titulo}</span>
          <span className="ini-ahora__que">
            <PuntoEstado tono={tono} latido={tono === 'cian'} />
            {que}
          </span>
          {avance != null ? <BarraDeProgreso valor={avance} tono="cian" grosor="fina" /> : null}
        </span>
      </a>
    </li>
  );
}

export function Ahora({ p }) {
  const filas = p.cargando
    ? null
    : [
        ...p.necesitan.map((n) => ({ llave: n.anuncio.slug, href: enlace.produccion(n.anuncio.slug), titulo: n.anuncio.titulo, imagen: n.anuncio.miniatura, que: QUE[n.alto.tipo] || 'Te necesita', tono: 'error' })),
        ...p.guiones.map((a) => ({
          llave: a.slug,
          href: enlace.nuevo({ paso: '2', anuncios: a.slug, ...(a.productoId ? { producto: a.productoId } : {}) }),
          titulo: a.titulo,
          imagen: a.miniatura,
          que: a.estado === 'error' ? 'El guion no salió' : 'Tu guion está listo',
          tono: a.estado === 'error' ? 'error' : 'aviso',
        })),
        ...p.activos.map((a) => ({
          llave: a.slug,
          href: enlace.produccion(a.slug),
          titulo: a.titulo,
          imagen: a.miniatura,
          que: a.etapaNombre || 'En producción',
          tono: 'cian',
          avance: typeof a.avance === 'number' ? a.avance : null,
        })),
      ];

  return (
    <section className="ini-tarjeta ini-ahora" aria-label="Ahora">
      <header className="ini-tarjeta__cabecera">
        <h2 className="ini-tarjeta__titulo">Ahora</h2>
        {filas?.length ? (
          <a className="ini-tarjeta__enlace" href={enlace.tablero()}>
            Ver progreso
          </a>
        ) : null}
      </header>
      {!filas ? (
        <Esqueleto forma="texto" lineas={3} />
      ) : filas.length ? (
        <ul className="ini-ahora__lista">
          {filas.slice(0, MAX).map(({ llave, ...f }) => (
            <Fila key={llave} {...f} />
          ))}
          {filas.length > MAX ? <li className="ini-ahora__mas">y {filas.length - MAX} más</li> : null}
        </ul>
      ) : (
        <div className="ini-vacio">
          <CircleCheck size={22} aria-hidden="true" />
          <span>Nada pendiente. Todo lo que empezaste ya está listo.</span>
        </div>
      )}
    </section>
  );
}

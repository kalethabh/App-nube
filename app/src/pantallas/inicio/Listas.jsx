// Abajo del inicio: «Por producto» (lo hecho y lo invertido en cada uno) y «Lo último» (lo que terminó hace poco).
import { Clapperboard, Images, Package } from 'lucide-react';
import { Esqueleto } from '../../componentes/index.js';
import { miniatura } from '../../datos/api.js';
import { enlace } from '../../datos/rutas.js';
import { dinero, fechaRelativa, numero, plural } from '../../datos/formato.js';

const MAX_PRODUCTOS = 6;

/** Junta, por producto, sus anuncios, lotes de imágenes, investigación y lo invertido. */
function porProducto({ anuncios, lotes, investigaciones, inversion }) {
  const m = new Map();
  const de = (id, nombre, foto) => {
    if (!id) return null;
    if (!m.has(id)) m.set(id, { id, nombre: nombre || id, foto: foto || null, anuncios: 0, lotes: 0, investigacion: null, dolares: 0 });
    const p = m.get(id);
    if (!p.foto && foto) p.foto = foto;
    if (nombre && p.nombre === id) p.nombre = nombre;
    return p;
  };
  for (const p of inversion?.productos || []) Object.assign(de(p.id, p.nombre, p.foto), { dolares: p.dolares || 0 });
  for (const a of anuncios) {
    const p = de(a.productoId);
    if (p) p.anuncios++;
  }
  for (const l of lotes) {
    const p = de(l.productoId, null, l.foto);
    if (p) p.lotes++;
  }
  for (const i of investigaciones || []) {
    const p = m.get(i.id) || (i.estado !== 'sin' ? de(i.id, i.nombre, i.foto) : null);
    if (p) {
      p.investigacion = i.estado;
      if (i.foto) p.foto = p.foto || i.foto;
      if (i.nombre) p.nombre = i.nombre;
    }
  }
  return [...m.values()].filter((p) => p.anuncios || p.lotes || p.dolares || (p.investigacion && p.investigacion !== 'sin')).sort((a, b) => b.dolares - a.dolares || b.anuncios + b.lotes - (a.anuncios + a.lotes));
}

const INVESTIGACION = { lista: 'Lista', investigando: 'En curso', error: 'Con error' };

export function PorProducto({ cargando, ...fuentes }) {
  const lista = cargando ? null : porProducto(fuentes);
  const max = Math.max(0.01, ...(lista || []).map((p) => p.dolares));
  return (
    <section className="ini-tarjeta ini-productos" aria-label="Por producto">
      <header className="ini-tarjeta__cabecera">
        <h2 className="ini-tarjeta__titulo">Por producto</h2>
        <a className="ini-tarjeta__enlace" href={enlace.saldo()}>
          Inversión
        </a>
      </header>
      {!lista ? (
        <Esqueleto forma="texto" lineas={4} />
      ) : !lista.length ? (
        <p className="ini-vacio ini-vacio--texto">Cuando hagas anuncios de un producto, aquí verás lo hecho y lo invertido.</p>
      ) : (
        <div className="ini-tabla" role="table" aria-label="Productos">
          <div className="ini-tabla__fila ini-tabla__fila--cabeza" role="row">
            <span role="columnheader">Producto</span>
            <span role="columnheader">Videos</span>
            <span role="columnheader">Lotes</span>
            <span role="columnheader">Investigación</span>
            <span role="columnheader" className="ini-tabla__derecha">
              Invertido
            </span>
          </div>
          {lista.slice(0, MAX_PRODUCTOS).map((p) => (
            <div key={p.id} className="ini-tabla__fila" role="row">
              <span role="cell" className="ini-tabla__producto">
                <span className="ini-tabla__foto">{p.foto ? <img src={miniatura(p.foto, 80)} alt="" loading="lazy" /> : <Package size={14} aria-hidden="true" />}</span>
                <span className="ini-tabla__nombre">{p.nombre}</span>
              </span>
              <span role="cell" className="t-num" data-etiqueta="Videos">
                {numero(p.anuncios)}
              </span>
              <span role="cell" className="t-num" data-etiqueta="Lotes">
                {numero(p.lotes)}
              </span>
              <span role="cell" className="ini-tabla__investigacion">
                {p.investigacion && INVESTIGACION[p.investigacion] ? (
                  <a className={`ini-etiqueta ini-etiqueta--${p.investigacion}`} href={enlace.investigacion(p.id)}>
                    {INVESTIGACION[p.investigacion]}
                  </a>
                ) : (
                  <a className="ini-etiqueta" href={enlace.investigacion(p.id)}>
                    Investigar
                  </a>
                )}
              </span>
              <span role="cell" className="ini-tabla__derecha ini-tabla__inversion" data-etiqueta="Invertido">
                <span className="ini-tabla__pista" aria-hidden="true">
                  <span style={{ width: `${(p.dolares / max) * 100}%` }} />
                </span>
                <span className="t-num">{dinero(p.dolares)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function Recientes({ recientes, anuncios, lotes }) {
  const fotoDe = (r) => (r.tipo === 'lote' ? lotes.find((l) => l.lote === r.slug)?.portada : anuncios.find((a) => a.slug === r.slug)?.miniatura) || null;
  return (
    <section className="ini-tarjeta ini-recientes" aria-label="Lo último">
      <header className="ini-tarjeta__cabecera">
        <h2 className="ini-tarjeta__titulo">Lo último</h2>
        <a className="ini-tarjeta__enlace" href={enlace.anuncios()}>
          Ver todo
        </a>
      </header>
      {!recientes ? (
        <Esqueleto forma="texto" lineas={5} />
      ) : !recientes.length ? (
        <p className="ini-vacio ini-vacio--texto">Aquí aparecerá lo que vayas terminando.</p>
      ) : (
        <ul className="ini-recientes__lista">
          {recientes.slice(0, 6).map((r) => {
            const foto = fotoDe(r);
            const Icono = r.tipo === 'lote' ? Images : Clapperboard;
            return (
              <li key={r.slug}>
                <a className="ini-recientes__fila" href={r.tipo === 'lote' ? enlace.loteImagenes(r.slug) : enlace.anuncio(r.slug)}>
                  <span className={`ini-recientes__mini${r.tipo === 'lote' ? ' ini-recientes__mini--cuadrada' : ''}`}>
                    {foto ? <img src={miniatura(foto, 120)} alt="" loading="lazy" /> : <Icono size={16} aria-hidden="true" />}
                  </span>
                  <span className="ini-recientes__textos">
                    <span className="ini-recientes__titulo">{r.titulo}</span>
                    <span className="ini-recientes__meta">
                      <Icono size={12} aria-hidden="true" />
                      {r.tipo === 'lote' ? plural(r.cantidad, 'imagen', 'imágenes') : 'Video'} · {fechaRelativa(r.fecha)}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// "Listos": la cuadrícula de los anuncios terminados (reales, de temp/ y output/). Al pasar el mouse se
// reproduce el video; al hacer clic se abre la entrega. Filtros por estilo, buscador y orden.
import { useMemo, useState } from 'react';
import { CircleCheck, Search, SearchX, X } from 'lucide-react';
import { Boton, Chip, EstadoVacio, MiniaturaVideo, Seccion, Selector } from '../../componentes/index.js';
import { enlace } from '../../datos/rutas.js';
import { imagenesDistintas } from '../../datos/variantes.js';
import { normalizar } from './datos.js';
import { MarcaModoPrueba } from '../produccion/ModoPrueba.jsx';

const ORDENES = [
  { valor: 'recientes', etiqueta: 'Más recientes' },
  { valor: 'destacados', etiqueta: 'Destacados primero' },
  { valor: 'largos', etiqueta: 'Más largos' },
  { valor: 'cortos', etiqueta: 'Más cortos' },
];

function ordenar(lista, orden) {
  const copia = [...lista];
  const fecha = (a) => Date.parse(a.fecha) || 0;
  if (orden === 'destacados') copia.sort((a, b) => Number(b.destacado) - Number(a.destacado) || fecha(b) - fecha(a));
  else if (orden === 'largos') copia.sort((a, b) => (b.duracion || 0) - (a.duracion || 0));
  else if (orden === 'cortos') copia.sort((a, b) => (a.duracion || 0) - (b.duracion || 0));
  else copia.sort((a, b) => fecha(b) - fecha(a));
  return copia;
}

/** "1 versión" o "3 versiones" (la app entrega solo la completa; las que se exportan del editor también cuentan). */
function cuantasVersiones(a) {
  const n = (a.versiones || []).filter((v) => v.clase === 'video').length;
  return n === 1 ? '1 versión' : `${n} versiones`;
}

export function Listos({ anuncios }) {
  const [estilo, setEstilo] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState('recientes');

  // Los de modo prueba (salen de los simuladores) van aparte: no son para publicar ni se cuentan.
  const listos = useMemo(() => anuncios.filter((a) => a.estado === 'listo' && !a.modoPrueba), [anuncios]);
  const dePrueba = useMemo(() => anuncios.filter((a) => a.estado === 'listo' && a.modoPrueba), [anuncios]);

  // Un filtro por estilo que tenga anuncios, más "Continuidad" (se suma a un estilo con narrador).
  const filtros = useMemo(() => {
    const cuenta = new Map();
    for (const a of listos) {
      const k = a.estilo || 'otro';
      const f = cuenta.get(k) || { id: k, nombre: a.estiloNombre || 'Otro', cantidad: 0 };
      f.cantidad++;
      cuenta.set(k, f);
    }
    const lista = [...cuenta.values()].sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, 'es'));
    const conContinuidad = listos.filter((a) => a.continuidad).length;
    if (conContinuidad) lista.push({ id: 'continuidad', nombre: 'Con continuidad', cantidad: conContinuidad });
    return lista;
  }, [listos]);

  const q = normalizar(busqueda.trim());
  const visibles = useMemo(() => {
    const base = estilo === 'prueba' ? dePrueba : listos;
    const filtrados = base.filter((a) => {
      if (estilo === 'prueba') return !q || [a.titulo, a.estiloNombre, a.slug].some((t) => normalizar(t).includes(q));
      if (estilo === 'continuidad' ? !a.continuidad : estilo !== 'todos' && a.estilo !== estilo) return false;
      if (!q) return true;
      return [a.titulo, a.estiloNombre, a.slug, a.familiaNombre].some((t) => normalizar(t).includes(q));
    });
    return ordenar(filtrados, orden);
  }, [listos, dePrueba, estilo, q, orden]);

  const otraImagen = useMemo(() => imagenesDistintas(visibles), [visibles]);

  const limpiar = () => {
    setBusqueda('');
    setEstilo('todos');
  };

  return (
    <Seccion
      className="tb-listos"
      titulo="Listos"
      contador={listos.length}
      icono={CircleCheck}
      tono="ok"
      descripcion="Pasa el mouse para verlos moverse. Haz clic para abrir la entrega."
      acciones={
        <div className="tb-herramientas">
          <label className="tb-buscador">
            <Search size={16} strokeWidth={2} aria-hidden="true" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por producto o estilo"
              aria-label="Buscar anuncios"
            />
            {busqueda ? (
              <button type="button" className="tb-buscador__borrar" onClick={() => setBusqueda('')} aria-label="Borrar la búsqueda">
                <X size={14} strokeWidth={2.2} />
              </button>
            ) : null}
          </label>
          <Selector
            className="tb-orden"
            aria-label="Ordenar"
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
            opciones={ORDENES}
          />
        </div>
      }
    >
      <div className="tb-filtros" role="group" aria-label="Filtrar por estilo">
        <Chip activo={estilo === 'todos'} onClick={() => setEstilo('todos')} contador={listos.length}>
          Todos
        </Chip>
        {filtros.map((f) => (
          <Chip key={f.id} activo={estilo === f.id} onClick={() => setEstilo(estilo === f.id ? 'todos' : f.id)} contador={f.cantidad}>
            {f.nombre}
          </Chip>
        ))}
        {dePrueba.length ? (
          <Chip activo={estilo === 'prueba'} onClick={() => setEstilo(estilo === 'prueba' ? 'todos' : 'prueba')} contador={dePrueba.length}>
            De prueba
          </Chip>
        ) : null}
      </div>

      {visibles.length ? (
        <div className="rejilla-videos tb-rejilla" style={{ '--min': '196px' }} key={`${estilo}-${orden}`}>
          {visibles.map((a, i) => (
            <MiniaturaVideo
              key={a.slug}
              className="tb-listo"
              style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
              imagen={otraImagen.get(a.slug) || a.miniatura}
              video={a.video}
              duracion={a.duracion}
              estilo={a.continuidad ? `${a.estiloNombre} · Continuidad` : a.estiloNombre}
              etiqueta={cuantasVersiones(a)}
              insignia={a.modoPrueba ? <MarcaModoPrueba /> : null}
              aria-label={`Abrir ${a.titulo}`}
              href={enlace.anuncio(a.slug)}
            />
          ))}
        </div>
      ) : (
        <EstadoVacio
          variante="compacto"
          icono={SearchX}
          titulo="No encuentro anuncios con eso"
          descripcion={q ? `Nada coincide con "${busqueda.trim()}"${estilo !== 'todos' ? ' en este estilo' : ''}.` : 'Todavía no hay anuncios listos de este estilo.'}
          acciones={
            <Boton variante="secundario" onClick={limpiar}>
              Ver todos
            </Boton>
          }
        />
      )}
    </Seccion>
  );
}

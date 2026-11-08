// ANUNCIOS (#/anuncios): todos tus anuncios, en cualquier etapa, como en IA-VID-AUTOMATIC: pestañas (Todos,
// Terminados, En producción, Con clips, Solo guion), buscador y orden. Cada uno abre su entrega (o su producción).
import { useMemo, useState } from 'react';
import { Clapperboard, Plus, Search, SearchX, X } from 'lucide-react';
import { Boton, CabeceraPagina, Chip, EsqueletoMiniaturas, EstadoVacio, MiniaturaVideo, Selector } from '../../componentes/index.js';
import { useAnuncios } from '../../datos/api.js';
import { enlace } from '../../datos/rutas.js';
import { normalizar } from '../tablero/datos.js';
import { MarcaModoPrueba } from '../produccion/ModoPrueba.jsx';
import '../tablero/tablero.css';
import './anuncios.css';

const PESTANAS = [
  { id: 'todos', nombre: 'Todos', ver: () => true },
  { id: 'listos', nombre: 'Terminados', ver: (a) => a.estado === 'listo' },
  { id: 'produccion', nombre: 'En producción', ver: (a) => a.estado !== 'listo' && a.etapa !== 'guion' },
  { id: 'clips', nombre: 'Con clips', ver: (a) => (a.conteos?.clips || 0) > 0 },
  { id: 'guion', nombre: 'Solo guion', ver: (a) => a.etapa === 'guion' && a.estado !== 'listo' },
];

const ORDENES = [
  { valor: 'recientes', etiqueta: 'Más recientes' },
  { valor: 'nombre', etiqueta: 'Por nombre' },
  { valor: 'largos', etiqueta: 'Más largos' },
];

const ETAPA = { guion: 'Guion', imagenes: 'Imágenes', videos: 'Videos', montaje: 'Montaje', listo: 'Terminado' };

function ordenar(lista, orden) {
  const copia = [...lista];
  const fecha = (a) => Date.parse(a.fecha || a.creado) || 0;
  if (orden === 'nombre') copia.sort((a, b) => String(a.titulo).localeCompare(String(b.titulo), 'es'));
  else if (orden === 'largos') copia.sort((a, b) => (b.duracion || 0) - (a.duracion || 0));
  else copia.sort((a, b) => fecha(b) - fecha(a));
  return copia;
}

export default function Anuncios() {
  const { datos, cargando } = useAnuncios({ cadaMs: 10000 });
  const [pestana, setPestana] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState('recientes');
  const todos = datos?.anuncios || [];
  const q = normalizar(busqueda.trim());
  const visibles = useMemo(() => {
    const ver = PESTANAS.find((p) => p.id === pestana)?.ver || (() => true);
    return ordenar(
      todos.filter((a) => ver(a) && (!q || [a.titulo, a.estiloNombre, a.slug, a.familiaNombre].some((t) => normalizar(t).includes(q)))),
      orden
    );
  }, [todos, pestana, q, orden]);

  return (
    <div className="pagina an">
      <CabeceraPagina
        titulo="Tus anuncios"
        descripcion={cargando && !datos ? 'Cargando…' : `${todos.length} ${todos.length === 1 ? 'anuncio' : 'anuncios'}, en cualquier etapa.`}
        acciones={
          <div className="tb-herramientas">
            <label className="tb-buscador">
              <Search size={16} strokeWidth={2} aria-hidden="true" />
              <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar…" aria-label="Buscar anuncios" />
              {busqueda ? (
                <button type="button" className="tb-buscador__borrar" onClick={() => setBusqueda('')} aria-label="Borrar la búsqueda">
                  <X size={14} strokeWidth={2.2} />
                </button>
              ) : null}
            </label>
            <Selector className="tb-orden" aria-label="Ordenar" value={orden} onChange={(e) => setOrden(e.target.value)} opciones={ORDENES} />
          </div>
        }
      />
      <div className="tb-filtros" role="group" aria-label="Filtrar">
        {PESTANAS.map((p) => (
          <Chip key={p.id} activo={pestana === p.id} onClick={() => setPestana(p.id)} contador={todos.filter(p.ver).length}>
            {p.nombre}
          </Chip>
        ))}
      </div>

      {cargando && !datos ? (
        <EsqueletoMiniaturas cantidad={8} />
      ) : !todos.length ? (
        <EstadoVacio
          icono={Clapperboard}
          titulo="Todavía no hay anuncios"
          descripcion="Empieza uno: aparecerá aquí con sus imágenes, clips y videos."
          acciones={
            <Boton variante="primario" icono={Plus} href={enlace.nuevo()}>
              Crear un anuncio
            </Boton>
          }
        />
      ) : visibles.length ? (
        <div className="rejilla-videos tb-rejilla" style={{ '--min': '196px' }} key={`${pestana}-${orden}`}>
          {visibles.map((a, i) => (
            <MiniaturaVideo
              key={a.slug}
              className="tb-listo"
              style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
              imagen={a.miniatura}
              video={a.estado === 'listo' ? a.video : null}
              duracion={a.duracion}
              estilo={a.continuidad ? `${a.estiloNombre} · Continuidad` : a.estiloNombre}
              etiqueta={a.estado === 'listo' ? 'Terminado' : ETAPA[a.etapa] || 'En producción'}
              titulo={a.titulo}
              insignia={a.modoPrueba ? <MarcaModoPrueba /> : null}
              aria-label={`Abrir ${a.titulo}`}
              href={a.estado === 'listo' || a.etapa === 'guion' ? enlace.anuncio(a.slug) : enlace.produccion(a.slug)}
            />
          ))}
        </div>
      ) : (
        <EstadoVacio
          variante="compacto"
          icono={SearchX}
          titulo="No encuentro anuncios con eso"
          descripcion={q ? `Nada coincide con "${busqueda.trim()}".` : 'No hay anuncios en esta pestaña.'}
          acciones={
            <Boton
              variante="secundario"
              onClick={() => {
                setBusqueda('');
                setPestana('todos');
              }}
            >
              Ver todos
            </Boton>
          }
        />
      )}
    </div>
  );
}

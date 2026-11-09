// ANUNCIOS (#/anuncios): todos tus anuncios, en cualquier etapa, como en IA-VID-AUTOMATIC: pestañas (Todos,
// Terminados, En producción, Con clips, Solo guion), buscador y orden. Cada uno abre su entrega (o su producción).
import { useEffect, useMemo, useState } from 'react';
import { Clapperboard, Cloud, Copy, Download, Package, Plus, Search, SearchX, X } from 'lucide-react';
import { Boton, CabeceraPagina, Chip, EsqueletoMiniaturas, EstadoVacio, MiniaturaVideo, Modal, Selector } from '../../componentes/index.js';
import { useAnuncios, useDatos, miniatura } from '../../datos/api.js';
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

// ---------------------------------------------------------------- los guardados en GitHub, por producto

async function leerGithub() {
  const r = await fetch('/api/anuncios-github', { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('No pude leer tus anuncios de GitHub.');
  return r.json();
}

/** Un anuncio de GitHub abierto: su video, sus versiones para descargar y, si es un clon, el anuncio de referencia. */
function VerAnuncio({ a, onCerrar }) {
  const [v, setV] = useState(0);
  useEffect(() => setV(0), [a?.id]);
  if (!a) return null;
  const opciones = [...a.versiones.map((x) => ({ ...x, clase: 'version' })), ...(a.referencias || []).map((r) => ({ ...r, tipo: r.id, clase: 'referencia' }))];
  const actual = opciones[v] || opciones[0];
  const esReferencia = actual.clase === 'referencia';
  return (
    <Modal abierto={Boolean(a)} onCerrar={onCerrar} titulo={a.titulo} descripcion={[a.estiloNombre, a.productoNombre].filter(Boolean).join(' · ')} icono={Clapperboard} tamano="normal">
      <div className="an-ver">
        <video key={actual.url} className="an-ver__video" src={actual.url} poster={esReferencia ? undefined : miniatura(a.portada, 480)} controls autoPlay playsInline />
        {esReferencia ? <p className="an-ver__nota">El anuncio original que se clonó, armado con sus tomas y su audio. La primera vez tarda unos segundos en aparecer.</p> : null}
        <div className="an-ver__versiones">
          {opciones.map((x, i) => (
            <Chip key={`${x.clase}-${x.tipo}`} activo={i === v} onClick={() => setV(i)} icono={x.clase === 'referencia' ? Copy : undefined}>
              {x.nombre}
            </Chip>
          ))}
        </div>
        {!esReferencia ? (
          <Boton variante="secundario" icono={Download} href={actual.url} download={actual.ruta.split('/').pop()}>
            Descargar esta versión
          </Boton>
        ) : null}
      </div>
    </Modal>
  );
}

function PorProducto({ productos, q }) {
  const [abierto, setAbierto] = useState(null);
  const filtrados = productos
    .map((p) => ({ ...p, anuncios: p.anuncios.filter((a) => !q || [a.titulo, a.id, a.estiloNombre, p.nombre].some((t) => normalizar(t).includes(q))) }))
    .filter((p) => p.anuncios.length);
  if (!filtrados.length) return null;
  return (
    <>
      {filtrados.map((p, i) => (
        <section key={p.producto} className="an-producto" style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}>
          <h2 className="an-producto__titulo">
            <span className="an-producto__icono" aria-hidden="true">
              <Package size={16} strokeWidth={2} />
            </span>
            {p.nombre}
            <span className="an-producto__cuenta t-num">{p.anuncios.length}</span>
          </h2>
          <div className="rejilla-videos tb-rejilla" style={{ '--min': '180px' }}>
            {p.anuncios.map((a, k) => (
              <MiniaturaVideo
                key={a.id}
                className="tb-listo"
                style={{ animationDelay: `${Math.min(k, 12) * 35}ms` }}
                imagen={miniatura(a.portada, 480)}
                video={a.versiones[0]?.url}
                estilo={a.estiloNombre}
                etiqueta={a.referencias?.length ? 'Clonado · con su referencia' : a.versiones.length === 1 ? '1 versión' : `${a.versiones.length} versiones`}
                titulo={a.titulo}
                aria-label={`Ver ${a.titulo}`}
                onClick={() => setAbierto({ ...a, productoNombre: p.nombre })}
              />
            ))}
          </div>
        </section>
      ))}
      <VerAnuncio a={abierto} onCerrar={() => setAbierto(null)} />
    </>
  );
}

export default function Anuncios() {
  const { datos, cargando } = useAnuncios({ cadaMs: 10000 });
  const [pestana, setPestana] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState('recientes');
  const todos = datos?.anuncios || [];
  const { datos: gh, recargar: recargarGh } = useDatos('anuncios-github', leerGithub, { cadaMs: 120000 });
  const [trayendo, setTrayendo] = useState(false);
  const traer = async () => {
    setTrayendo(true);
    try {
      await fetch('/api/anuncios-github/traer', { method: 'POST', headers: { Accept: 'application/json' } });
      await recargarGh?.();
    } finally {
      setTrayendo(false);
    }
  };
  const estadoGh = gh?.estado?.estado;
  const productosGh = gh?.productos || [];
  const totalGh = productosGh.reduce((n, p) => n + p.anuncios.length, 0);
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
        descripcion={cargando && !datos ? 'Cargando…' : `${todos.length} en esta app · ${totalGh} guardados en GitHub, por producto.`}
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

      <div className="an-gh">
        <Cloud size={15} strokeWidth={2} aria-hidden="true" />
        <span>
          {trayendo || estadoGh === 'sin-empezar'
            ? 'Trayendo tus anuncios de GitHub… la primera vez tarda un poco.'
            : gh?.estado?.error
              ? gh.estado.error
              : totalGh
                ? `${totalGh} anuncios de tu GitHub (repositorio anuncios-ia-videos)${gh?.estado?.ultima ? ` · al día ${new Date(gh.estado.ultima).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''}`
                : 'Todavía no hay anuncios en tu GitHub.'}
        </span>
        <Boton variante="fantasma" tamano="chico" onClick={traer} cargando={trayendo}>
          Traer de GitHub
        </Boton>
      </div>

      {totalGh && pestana !== 'produccion' && pestana !== 'guion' && pestana !== 'clips' ? (
        <div className="an-bloque">
          <h2 className="an-bloque__titulo">
            <Cloud size={18} strokeWidth={2} aria-hidden="true" /> Guardados en GitHub
          </h2>
          <PorProducto productos={productosGh} q={q} />
        </div>
      ) : null}

      {todos.length || !totalGh ? (
        <h2 className="an-bloque__titulo">
          <Clapperboard size={18} strokeWidth={2} aria-hidden="true" /> En esta app
        </h2>
      ) : null}
      {cargando && !datos ? (
        <EsqueletoMiniaturas cantidad={8} />
      ) : !todos.length ? (
        totalGh ? null : (
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
        )
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

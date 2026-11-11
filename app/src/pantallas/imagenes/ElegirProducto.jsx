// "Tu producto": uno de los que ya guardaste en la app (con su foto) o la foto de uno nuevo.
//   - Al elegir uno guardado aparecen sus fotos para marcar cuál es la del producto (la que la IA usa tal cual).
//   - "Sube la foto de tu producto": queda guardado como producto nuevo al tocar Generar (sin analizar).
//   - Dos productos con el mismo nombre llevan su fecha ("Crema Luna · 5 nov"; distinguirRepetidos, como en la portada).
import { useMemo, useState } from 'react';
import { Check, ChevronDown, CircleAlert, Package } from 'lucide-react';
import { Esqueleto } from '../../componentes/index.js';
import { miniatura } from '../../datos/api.js';
import { distinguirRepetidos } from '../../datos/imagenes.js';
import { ZonaImagenes } from './ZonaImagenes.jsx';

const VISIBLES = 8;

function FotoChica({ url, ancho = 96 }) {
  const [fallo, setFallo] = useState(false);
  if (!url || fallo) return <Package size={16} strokeWidth={1.8} aria-hidden="true" />;
  return <img src={miniatura(url, ancho)} alt="" draggable="false" loading="lazy" onError={() => setFallo(true)} />;
}

export function ElegirProducto({ productos, cargando, elegido, foto, onElegir, onFoto, fotoNueva, onFotoNueva, bloqueada, error }) {
  const [todos, setTodos] = useState(false);
  const lista = productos || [];
  const p = lista.find((x) => x.id === elegido) || null;
  const sufijos = useMemo(() => distinguirRepetidos((productos || []).map((x) => ({ clave: x.id, nombre: x.nombre, fecha: Date.parse(x.creado) || null }))), [productos]);
  // el elegido siempre se ve, aunque esté más abajo de los primeros
  const primeros = lista.slice(0, VISIBLES);
  const visibles = todos || !p || primeros.includes(p) ? (todos ? lista : primeros) : [...primeros.slice(0, VISIBLES - 1), p];
  const ocultos = lista.length - visibles.length;

  return (
    <div className="img-producto" id="campo-producto">
      {cargando ? (
        <div className="fila fila--envolver" style={{ '--hueco': '8px' }}>
          <Esqueleto ancho={150} alto={40} />
          <Esqueleto ancho={130} alto={40} />
          <Esqueleto ancho={140} alto={40} />
        </div>
      ) : lista.length ? (
        <>
          <span className="img-producto__etiqueta">Tus productos</span>
          <div className="img-producto__chips" role="radiogroup" aria-label="Tus productos">
            {visibles.map((x) => {
              const sel = x.id === elegido && !fotoNueva.length;
              return (
                <button
                  key={x.id}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  className={`img-producto__chip${sel ? ' img-producto__chip--sel' : ''}`}
                  onClick={() => onElegir(sel ? null : x)}
                  disabled={bloqueada}
                >
                  <span className="img-producto__chip-foto">
                    <FotoChica url={x.fotos?.find((f) => f.n === x.fotoSugerida)?.url || x.fotos?.[0]?.url} ancho={96} />
                  </span>
                  <span className="img-producto__chip-nombre t-recortar">{x.nombre || 'Sin nombre'}</span>
                  {sufijos.get(x.id) ? <span className="img-producto__chip-sufijo t-num">· {sufijos.get(x.id)}</span> : null}
                  {sel ? <Check size={14} strokeWidth={2.6} className="img-producto__chip-marca" aria-hidden="true" /> : null}
                </button>
              );
            })}
            {ocultos > 0 ? (
              <button type="button" className="img-producto__mas" onClick={() => setTodos(true)}>
                <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" /> Ver {ocultos} más
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {p && !fotoNueva.length && (p.fotos || []).length ? (
        <div className="img-producto__fotos">
          <span className="img-producto__etiqueta">¿Cuál es la foto de tu producto?</span>
          <div className="img-producto__fotos-lista" role="radiogroup" aria-label="La foto del producto">
            {p.fotos.map((f) => {
              const sel = Number(foto) === Number(f.n);
              return (
                <button
                  key={f.n}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  aria-label={`Foto ${f.n}${f.deLaPagina ? ', de tu página' : ''}`}
                  className={`img-producto__foto${sel ? ' img-producto__foto--sel' : ''}`}
                  onClick={() => onFoto(f.n)}
                  disabled={bloqueada}
                >
                  <FotoChica url={f.url} ancho={240} />
                  {f.deLaPagina ? <span className="img-producto__pagina">De tu página</span> : null}
                  {sel ? (
                    <span className="img-producto__foto-marca" aria-hidden="true">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="img-ayuda">La IA la usa tal cual en cada anuncio: elige la que muestra el envase de frente, con la etiqueta legible.</p>
        </div>
      ) : null}

      {lista.length && !cargando ? <span className="img-producto__o">{p && !fotoNueva.length ? 'o usa la foto de otro producto' : 'o sube uno nuevo'}</span> : null}
      <ZonaImagenes
        archivos={fotoNueva}
        onCambiar={onFotoNueva}
        max={1}
        heic
        fondoClaro
        bloqueada={bloqueada}
        titulo="Sube la foto de tu producto"
        ayuda={fotoNueva.length ? 'Queda guardado como producto nuevo al tocar Generar.' : 'El frente del envase con la etiqueta legible. Sin precios, botones ni marcas de agua.'}
      />
      {error ? (
        <span className="img-error" role="alert">
          <CircleAlert size={13} strokeWidth={2.2} aria-hidden="true" />
          {error}
        </span>
      ) : null}
    </div>
  );
}

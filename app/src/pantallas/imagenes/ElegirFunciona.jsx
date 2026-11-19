// «Variantes» en Anuncios de imagen: eliges de «Lo que me funciona» (imágenes y videos tuyos marcados con el trofeo)
// los creativos de los que salen las variantes. Filtros: tipo (imágenes / videos) y producto (este / todos).
// (2026-11-19h) También se SUBEN aquí (imágenes o videos tuyos que ya venden: quedan en la biblioteca), y cada elegido
// lleva su CONCEPTO (por qué funciona): la variante lo conserva y cambia la ejecución y el título.
import { useMemo, useRef, useState } from 'react';
import { Check, Clapperboard, Image as IconoImagen, Trophy } from 'lucide-react';
import { Chip, EstadoVacio } from '../../componentes/index.js';
import { useFuncionan } from '../../datos/funcionan.js';
import { ConceptoFunciona, SubirFunciona } from './SubirFunciona.jsx';

const TIPOS = [
  { id: 'todos', texto: 'Todos' },
  { id: 'imagen', texto: 'Imágenes', icono: IconoImagen },
  { id: 'video', texto: 'Videos', icono: Clapperboard },
];

/** `elegidos`: ids en orden; `onCambiar(ids, items)`; `productoId`: el producto del lote (para el filtro «Este producto»). */
export function ElegirFunciona({ elegidos, onCambiar, max = 10, productoId = null, bloqueado = false }) {
  const { datos, cargando, recargar } = useFuncionan();
  const zona = useRef(null); // (Cmd+V y soltar archivos sobre «Lo que te funciona»)
  // lo recién subido se ve enseguida (hasta que la lista del servidor lo traiga)
  const [recien, setRecien] = useState([]);
  const [tipo, setTipo] = useState('todos');
  const [soloEste, setSoloEste] = useState(true);
  const delServidor = datos?.items || [];
  const items = [...recien.filter((x) => !delServidor.some((y) => y.id === x.id)), ...delServidor];
  const deEste = productoId ? items.filter((x) => x.productoId === productoId) : [];
  const filtrarPorProducto = Boolean(productoId && soloEste && deEste.length);
  const vistos = useMemo(
    () => items.filter((x) => (tipo === 'todos' || x.tipo === tipo) && (!filtrarPorProducto || x.productoId === productoId)),
    [items, tipo, filtrarPorProducto, productoId]
  );
  const cuenta = (t) => items.filter((x) => (t === 'todos' || x.tipo === t) && (!filtrarPorProducto || x.productoId === productoId)).length;

  // lo que acabas de subir queda elegido (hasta el máximo)
  const alSubir = (nuevos) => {
    setRecien((r) => [...nuevos, ...r]);
    recargar?.();
    const ids = [...elegidos, ...nuevos.map((x) => x.id)].filter((v, i, l) => l.indexOf(v) === i).slice(0, max);
    const todos = [...items, ...nuevos];
    onCambiar(ids, ids.map((i) => todos.find((y) => y.id === i)).filter(Boolean));
  };
  // el concepto cambió: los elegidos van al día (el lote lo lleva)
  const alGuardarConcepto = (x) => {
    setRecien((r) => r.map((y) => (y.id === x.id ? x : y)));
    recargar?.();
    onCambiar(elegidos, elegidos.map((i) => (i === x.id ? x : items.find((y) => y.id === i))).filter(Boolean));
  };

  const alternar = (x) => {
    const ya = elegidos.includes(x.id);
    if (!ya && elegidos.length >= max) return;
    const ids = ya ? elegidos.filter((i) => i !== x.id) : [...elegidos, x.id];
    onCambiar(ids, ids.map((i) => items.find((y) => y.id === i)).filter(Boolean));
  };

  if (!cargando && !items.length) {
    return (
      <div ref={zona}>
      <EstadoVacio
        icono={Trophy}
        titulo="Sube lo que ya te funciona"
        descripcion="Súbelas, pégalas (Cmd+V / Ctrl+V con el mouse aquí) o arrástralas: las imágenes o los videos de tus anuncios que ya venden. Quedan en tu biblioteca y de ellos salen las variantes, con el mismo concepto creativo. También puedes marcar con el trofeo («Me funciona») las imágenes de tus lotes y tus videos."
        variante="compacto"
        acciones={<SubirFunciona productoId={productoId} onSubidos={alSubir} bloqueado={bloqueado} variante="primario" zona={zona} />}
      />
      </div>
    );
  }

  return (
    <div className="img-funciona" ref={zona}>
      <div className="img-funciona__filtros" role="group" aria-label="Filtrar lo que me funciona">
        {TIPOS.map((t) => (
          <Chip key={t.id} activo={tipo === t.id} onClick={() => setTipo(t.id)} icono={t.icono} contador={cuenta(t.id)} disabled={bloqueado}>
            {t.texto}
          </Chip>
        ))}
        <SubirFunciona productoId={productoId} onSubidos={alSubir} bloqueado={bloqueado} zona={zona} />
        {productoId && deEste.length ? (
          <span className="img-funciona__producto">
            <Chip activo={soloEste} onClick={() => setSoloEste(true)} disabled={bloqueado}>
              Este producto
            </Chip>
            <Chip activo={!soloEste} onClick={() => setSoloEste(false)} disabled={bloqueado}>
              Todos los productos
            </Chip>
          </span>
        ) : null}
      </div>
      <p className="img-ayuda" role="status">
        {'Sube, pega (Cmd+V con el mouse aquí) o arrastra tus anuncios ganadores. '}
        {elegidos.length ? `${elegidos.length} elegido${elegidos.length === 1 ? '' : 's'} (hasta ${max}).` : `Elige de 1 a ${max}.`} Las variantes conservan su diseño, tipografía, posición de los textos y enfoque; cambia el título.
        {productoId && !deEste.length && items.length ? ' Este producto todavía no tiene creativos marcados: los de otro producto toman los colores del tuyo.' : ''}
      </p>
      <ul className="img-funciona__grilla">
        {vistos.map((x) => {
          const sel = elegidos.includes(x.id);
          const lleno = !sel && elegidos.length >= max;
          return (
            <li key={x.id}>
              <button
                type="button"
                className={`img-funciona__item${sel ? ' img-funciona__item--sel' : ''}`}
                aria-pressed={sel}
                disabled={bloqueado || lleno}
                onClick={() => alternar(x)}
                title={x.titulo || x.producto}
              >
                <span className="img-funciona__foto" style={{ aspectRatio: x.formato === '1:1' ? '1 / 1' : '9 / 16' }}>
                  <img src={x.url} alt="" loading="lazy" decoding="async" />
                  <span className="img-funciona__tipo">{x.tipo === 'video' ? <Clapperboard size={12} strokeWidth={2.2} /> : <IconoImagen size={12} strokeWidth={2.2} />}{x.tipo === 'video' ? 'Video' : x.formato}</span>
                  {sel ? (
                    <span className="img-funciona__check" aria-hidden="true">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  ) : null}
                </span>
                <span className="img-funciona__nombre">{x.producto || 'Sin producto'}</span>
                {x.titulo ? <span className="img-funciona__titulo">{x.titulo}</span> : null}
                {productoId && x.productoId && x.productoId !== productoId ? <span className="img-funciona__otro">Otro producto: toma tus colores</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {!vistos.length && items.length ? <p className="img-ayuda">Nada con este filtro.</p> : null}
      {elegidos.length ? (
        <div className="img-funciona__conceptos">
          <p className="img-ayuda">
            <strong>El concepto de cada uno</strong> (opcional, pero mejora las variantes): por qué vende. La variante conserva ese concepto y cambia la ejecución y el título.
          </p>
          {elegidos
            .map((i) => items.find((y) => y.id === i))
            .filter(Boolean)
            .map((x) => (
              <div key={x.id} className="img-funciona__concepto">
                <img src={x.url} alt="" />
                <ConceptoFunciona key={`${x.id}-${x.concepto || ''}`} item={x} onGuardado={alGuardarConcepto} bloqueado={bloqueado} />
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
}

/** Los creativos elegidos como archivos, para subirlos como referencias del lote. */
export async function comoArchivos(items) {
  const archivos = [];
  for (const x of items) {
    const r = await fetch(x.url);
    if (!r.ok) throw new Error(`No pude leer «${x.titulo || x.producto || 'un creativo'}». Vuelve a intentarlo.`);
    const b = await r.blob();
    const ext = b.type === 'image/png' ? 'png' : 'jpg';
    archivos.push(new File([b], `funciona-${x.id}.${ext}`, { type: b.type || 'image/jpeg' }));
  }
  return archivos;
}

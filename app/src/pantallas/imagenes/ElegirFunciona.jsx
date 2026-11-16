// «Variantes» en Anuncios de imagen: eliges de «Lo que me funciona» (imágenes y videos tuyos marcados con el trofeo)
// los creativos de los que salen las variantes. Filtros: tipo (imágenes / videos) y producto (este / todos).
import { useMemo, useState } from 'react';
import { Check, Clapperboard, Image as IconoImagen, Trophy } from 'lucide-react';
import { Chip, EstadoVacio } from '../../componentes/index.js';
import { useFuncionan } from '../../datos/funcionan.js';

const TIPOS = [
  { id: 'todos', texto: 'Todos' },
  { id: 'imagen', texto: 'Imágenes', icono: IconoImagen },
  { id: 'video', texto: 'Videos', icono: Clapperboard },
];

/** `elegidos`: ids en orden; `onCambiar(ids, items)`; `productoId`: el producto del lote (para el filtro «Este producto»). */
export function ElegirFunciona({ elegidos, onCambiar, max = 10, productoId = null, bloqueado = false }) {
  const { datos, cargando } = useFuncionan();
  const [tipo, setTipo] = useState('todos');
  const [soloEste, setSoloEste] = useState(true);
  const items = datos?.items || [];
  const deEste = productoId ? items.filter((x) => x.productoId === productoId) : [];
  const filtrarPorProducto = Boolean(productoId && soloEste && deEste.length);
  const vistos = useMemo(
    () => items.filter((x) => (tipo === 'todos' || x.tipo === tipo) && (!filtrarPorProducto || x.productoId === productoId)),
    [items, tipo, filtrarPorProducto, productoId]
  );
  const cuenta = (t) => items.filter((x) => (t === 'todos' || x.tipo === t) && (!filtrarPorProducto || x.productoId === productoId)).length;

  const alternar = (x) => {
    const ya = elegidos.includes(x.id);
    if (!ya && elegidos.length >= max) return;
    const ids = ya ? elegidos.filter((i) => i !== x.id) : [...elegidos, x.id];
    onCambiar(ids, ids.map((i) => items.find((y) => y.id === i)).filter(Boolean));
  };

  if (!cargando && !items.length) {
    return (
      <EstadoVacio
        icono={Trophy}
        titulo="Todavía no marcaste nada que te funcione"
        descripcion="En cada imagen de tus lotes y en la entrega de cada video hay un trofeo: «Me funciona». Marca los creativos que te están vendiendo y aquí eliges de cuáles sacar variantes."
        variante="compacto"
      />
    );
  }

  return (
    <div className="img-funciona">
      <div className="img-funciona__filtros" role="group" aria-label="Filtrar lo que me funciona">
        {TIPOS.map((t) => (
          <Chip key={t.id} activo={tipo === t.id} onClick={() => setTipo(t.id)} icono={t.icono} contador={cuenta(t.id)} disabled={bloqueado}>
            {t.texto}
          </Chip>
        ))}
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

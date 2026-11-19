// Biblioteca → «Lo que me funciona» (2026-11-19h): tus anuncios ganadores (los que subiste y los que marcaste con el
// trofeo en tus lotes y tus videos), con el concepto de cada uno (por qué vende). De aquí salen las Variantes de
// Anuncios de imagen. Se suben, se les escribe el concepto, se les cambia el producto y se quitan.
import { useRef, useState } from 'react';
import { Clapperboard, Copy, Image as IconoImagen, Trash2, Trophy } from 'lucide-react';
import { Boton, EstadoVacio, Selector, Tarjeta, useAvisos } from '../../componentes/index.js';
import { editarFunciona, quitarFunciona, useFuncionan } from '../../datos/funcionan.js';
import { useProductosImagen } from '../../datos/imagenes.js';
import { enlace } from '../../datos/rutas.js';
import { ConceptoFunciona, SubirFunciona } from '../imagenes/SubirFunciona.jsx';

export function LoQueFunciona() {
  const { datos, cargando, recargar } = useFuncionan();
  const zona = useRef(null);
  const productos = useProductosImagen().datos?.productos || [];
  const [producto, setProducto] = useState('');
  const { aviso } = useAvisos();
  const items = (datos?.items || []).filter((x) => !producto || x.productoId === producto);
  const quitar = async (x) => {
    if (!window.confirm(`¿Quitar «${x.titulo || x.producto || 'este anuncio'}» de lo que te funciona?`)) return;
    try {
      await quitarFunciona(x.id);
      recargar?.();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude quitarlo', texto: e.message });
    }
  };
  const cambiarProducto = async (x, productoId) => {
    try {
      await editarFunciona(x.id, { productoId: productoId || null });
      recargar?.();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude cambiar el producto', texto: e.message });
    }
  };
  const opcionesProducto = [{ valor: '', etiqueta: 'Sin producto' }, ...productos.map((p) => ({ valor: p.id, etiqueta: p.nombre }))];

  return (
    <div className="bib-funciona" ref={zona}>
      <div className="bib-funciona__barra">
        <p className="t-chico t-3">Tus anuncios que ya venden. De aquí salen las <strong>Variantes</strong> de Anuncios de imagen: mismo concepto creativo, otra ejecución y otro título.</p>
        <div className="fila" style={{ '--hueco': '8px' }}>
          <Selector value={producto} onChange={(e) => setProducto(e.target.value)} opciones={[{ valor: '', etiqueta: 'Todos los productos' }, ...productos.map((p) => ({ valor: p.id, etiqueta: p.nombre }))]} aria-label="Filtrar por producto" />
          <SubirFunciona productoId={producto || null} variante="primario" texto="Subir anuncios" onSubidos={() => recargar?.()} zona={zona} pegarSiempre />
        </div>
      </div>
      {cargando && !datos ? null : !items.length ? (
        <EstadoVacio
          icono={Trophy}
          titulo={producto ? 'Nada de este producto todavía' : 'Todavía no hay nada aquí'}
          descripcion="Sube, pega (Cmd+V / Ctrl+V) o arrastra aquí las imágenes o los videos de tus anuncios que ya venden (o márcalos con el trofeo «Me funciona» en tus lotes y tus videos)."
          acciones={null}
        />
      ) : (
        <ul className="bib-funciona__rejilla">
          {items.map((x) => (
            <li key={x.id}>
              <Tarjeta relleno="chico" className="bib-funciona__item">
                <div className="bib-funciona__medio" style={{ aspectRatio: x.formato === '1:1' ? '1 / 1' : '9 / 16' }}>
                  {x.urlVideo ? <video src={x.urlVideo} poster={x.url} controls preload="none" playsInline /> : <img src={x.url} alt="" loading="lazy" decoding="async" />}
                  <span className="bib-funciona__tipo">
                    {x.tipo === 'video' ? <Clapperboard size={12} strokeWidth={2.2} /> : <IconoImagen size={12} strokeWidth={2.2} />}
                    {x.tipo === 'video' ? 'Video' : x.formato}
                    {x.subido ? ' · subido' : ''}
                  </span>
                </div>
                {x.titulo ? <strong className="bib-funciona__titulo">{x.titulo}</strong> : null}
                <Selector
                  value={x.productoId || ''}
                  onChange={(e) => cambiarProducto(x, e.target.value)}
                  opciones={x.productoId && !productos.some((p) => p.id === x.productoId) ? [...opcionesProducto, { valor: x.productoId, etiqueta: x.producto || 'Tu producto' }] : opcionesProducto}
                  aria-label="Producto de este anuncio"
                />
                <ConceptoFunciona key={`${x.id}-${x.concepto || ''}`} item={x} filas={3} onGuardado={() => recargar?.()} />
                <div className="fila" style={{ '--hueco': '6px', justifyContent: 'space-between' }}>
                  <Boton variante="secundario" tamano="chico" icono={Copy} href={enlace.crearImagenes(x.productoId ? { modo: 'variantes', producto: x.productoId } : { modo: 'variantes' })}>
                    Hacer variantes
                  </Boton>
                  <Boton variante="fantasma" tamano="chico" soloIcono icono={Trash2} etiqueta="Quitar" onClick={() => quitar(x)} />
                </div>
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

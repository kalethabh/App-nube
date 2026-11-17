// "Tus productos" de la portada (#/imagenes): una fila de chips arriba de "Tus lotes", como los filtros de «Mis
// anuncios». «Todos» y un chip por producto con lotes (su foto, su nombre y cuántos lotes tiene; un punto cian si uno se
// está creando, o rojo si uno te necesita). Tocar uno deja solo sus lotes y otra vez, todos. Es compacta: en la
// computadora muestra los primeros 8 y «Ver N más»; en el celular, todos en una fila que se desliza de costado. Dos productos con el mismo nombre
// se distinguen por la foto y por su fecha ("Crema Luna · 5 nov", con la hora si también es el mismo día, o "n.º 2" si
// coinciden en el minuto: distinguirRepetidos de datos/imagenes.js, igual que en el formulario).
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronDown, Package } from 'lucide-react';
import { PuntoEstado } from '../../componentes/index.js';
import { miniatura } from '../../datos/api.js';
import { distinguirRepetidos } from '../../datos/imagenes.js';
import { fechaRelativa, plural } from '../../datos/formato.js';
import { loteEnMarcha, loteTeNecesita } from './TusLotes.jsx';

const VISIBLES = 8;
const CELULAR = '(max-width: 720px)';
/** En el celular la fila se desliza de costado: van todos, sin «Ver N más». */
function useCelular() {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(CELULAR);
      mq.addEventListener('change', avisar);
      return () => mq.removeEventListener('change', avisar);
    },
    () => window.matchMedia(CELULAR).matches,
    () => false
  );
}
const fechaDe = (l) => Date.parse(l.actualizado || l.terminado || l.creado) || 0;
const normal = (s) => String(s || '').trim().toLocaleLowerCase('es');

/**
 * Los lotes agrupados por producto, del que se trabajó más reciente al más viejo:
 * [{ clave, productoId, nombre, sufijo, foto, lotes, anuncios, ultimo, creando, necesita, sinEmpezar, existe }]
 *   sufijo: solo si otro producto se llama igual ("5 nov", "5 nov, 02:11" o "n.º 2")
 * `productos`: los de GET /api/imagen-ads/productos (su nombre, su foto y cuándo se creó); si un producto ya no está, se
 * usan los de su último lote y la fecha de su primer lote (y «Crear más» no lo lleva elegido).
 */
export function agruparPorProducto(lotes, productos) {
  const porId = new Map((productos || []).map((p) => [p.id, p]));
  const grupos = new Map();
  for (const l of lotes || []) {
    const clave = l.productoId || `sin-producto:${normal(l.titulo)}`;
    if (!grupos.has(clave)) grupos.set(clave, { clave, productoId: l.productoId || null, lotes: [] });
    grupos.get(clave).lotes.push(l);
  }
  const lista = [...grupos.values()].map((g) => {
    const ordenados = [...g.lotes].sort((a, b) => fechaDe(b) - fechaDe(a));
    const ultimoLote = ordenados[0];
    const p = g.productoId ? porId.get(g.productoId) : null;
    const fotoProducto = p ? (p.fotos || []).find((f) => f.n === p.fotoSugerida)?.url || p.fotos?.[0]?.url : null;
    const primerLote = Math.min(...g.lotes.map((l) => Date.parse(l.creado) || Infinity));
    return {
      ...g,
      lotes: ordenados,
      nombre: p?.nombre || ultimoLote?.titulo || 'Tu producto',
      foto: fotoProducto ? miniatura(fotoProducto, 96) : ordenados.find((l) => l.foto)?.foto || ordenados.find((l) => l.portada)?.portada || null,
      anuncios: g.lotes.filter((l) => l.estado !== 'borrador').reduce((s, l) => s + (Number(l.cantidad) || 0), 0),
      ultimo: fechaDe(ultimoLote),
      fecha: Date.parse(p?.creado) || (Number.isFinite(primerLote) ? primerLote : null),
      creando: g.lotes.some(loteEnMarcha),
      necesita: g.lotes.some(loteTeNecesita),
      sinEmpezar: g.lotes.every((l) => l.estado === 'borrador'),
      existe: Boolean(p),
    };
  });
  const sufijos = distinguirRepetidos(lista);
  return lista.map((g) => ({ ...g, sufijo: sufijos.get(g.clave) || null })).sort((a, b) => b.ultimo - a.ultimo);
}

/** El nombre para decir cuál está elegido: «Crema Luna» o, si otro se llama igual, «Crema Luna · 5 nov». */
export const nombreDelGrupo = (g) => (g.sufijo ? `${g.nombre} · ${g.sufijo}` : g.nombre);

/** Lo que dice "Tus lotes" con un producto elegido: "3 lotes · 20 anuncios · el último, hace 14 min" */
export function resumenDelGrupo(g) {
  const cuantos = g.sinEmpezar ? `${plural(g.lotes.length, 'lote', 'lotes')} sin empezar` : `${plural(g.lotes.length, 'lote', 'lotes')} · ${plural(g.anuncios, 'anuncio', 'anuncios')}`;
  return g.ultimo && g.lotes.length > 1 ? `${cuantos} · el último, ${fechaRelativa(new Date(g.ultimo).toISOString())}` : cuantos;
}

function Foto({ url }) {
  const [fallo, setFallo] = useState(false);
  return url && !fallo ? <img src={url} alt="" draggable="false" loading="lazy" onError={() => setFallo(true)} /> : <Package size={16} strokeWidth={1.8} aria-hidden="true" />;
}

/** El punto sobre la foto: cian si un lote se está creando, rojo si uno te necesita (con su texto para el lector). */
function Punto({ g }) {
  if (!g.creando && !g.necesita) return null;
  return (
    <span className="img-filtro__punto">
      <PuntoEstado estado={g.creando ? 'generando' : 'te-necesita'} />
    </span>
  );
}

export function TusProductos({ grupos, elegido, onElegir, total }) {
  const [verTodos, setTodos] = useState(false);
  const celular = useCelular();
  const todos = verTodos || celular;
  // el elegido siempre se ve, aunque esté más abajo de los primeros
  const primeros = grupos.slice(0, VISIBLES);
  const elegidoAbajo = elegido && !primeros.some((g) => g.clave === elegido) ? grupos.find((g) => g.clave === elegido) : null;
  const visibles = todos ? grupos : elegidoAbajo ? [...primeros.slice(0, VISIBLES - 1), elegidoAbajo] : primeros;
  const ocultos = grupos.length - visibles.length;

  // en el celular (la fila se desliza), el elegido queda a la vista dentro de la fila (sin mover la pantalla)
  const fila = useRef(null);
  useEffect(() => {
    const f = fila.current;
    const chip = f?.querySelector('.img-filtro__chip--sel');
    if (!f || !chip || f.scrollWidth <= f.clientWidth) return;
    const izq = chip.offsetLeft; // (la fila es position: relative: es la medida dentro de ella)
    if (izq < f.scrollLeft || izq + chip.offsetWidth > f.scrollLeft + f.clientWidth) f.scrollLeft = Math.max(0, izq - 16);
  }, [elegido]);

  return (
    <div className="img-filtro" role="group" aria-label="Ver los lotes de un producto" ref={fila}>
      <button type="button" className={`img-filtro__chip img-filtro__chip--todos${elegido ? '' : ' img-filtro__chip--sel'}`} aria-pressed={!elegido} onClick={() => onElegir(null)}>
        Todos
        <span className="chip__contador t-num">{total}</span>
      </button>
      {visibles.map((g) => {
        const sel = g.clave === elegido;
        const estado = g.creando ? ', uno se está creando' : g.necesita ? ', uno te necesita' : '';
        return (
          <button
            key={g.clave}
            type="button"
            className={`img-filtro__chip${sel ? ' img-filtro__chip--sel' : ''}`}
            aria-pressed={sel}
            aria-label={`${nombreDelGrupo(g)}: ${plural(g.lotes.length, 'lote', 'lotes')}${estado}`}
            onClick={() => onElegir(sel ? null : g.clave)}
          >
            <span className="img-filtro__foto">
              <Foto url={g.foto} />
              <Punto g={g} />
            </span>
            <span className="img-filtro__nombre t-recortar">{g.nombre}</span>
            {g.sufijo ? <span className="img-filtro__sufijo t-num">· {g.sufijo}</span> : null}
            <span className="chip__contador t-num">{g.lotes.length}</span>
          </button>
        );
      })}
      {ocultos > 0 ? (
        <button type="button" className="img-filtro__mas" onClick={() => setTodos(true)}>
          <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" /> Ver {ocultos === 1 ? 'otro' : `${ocultos} más`}
        </button>
      ) : null}
    </div>
  );
}

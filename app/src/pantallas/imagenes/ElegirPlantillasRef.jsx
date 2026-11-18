// «Plantillas» del formulario de anuncios de imagen (2026-11-18s): los anuncios validados de la categoría. Cada una va
// al modelo de imagen como referencia, con la foto de tu producto: el modelo mantiene su estructura, composición y
// tipografía, y cambia el producto, los textos y los colores. Sin ninguna elegida, «Que la app elija»: una mezcla de
// ideas distintas (una por imagen).
import { useState } from 'react';
import { Check, Flame, Sparkles } from 'lucide-react';
import { Chip } from '../../componentes/index.js';
import { pedirNuevo, useDatos } from '../../datos/api.js';

const MAXIMO = 10;

function Muestra({ url, nombre }) {
  const [cargada, setCargada] = useState(false);
  return (
    <span className={`img-plantilla__muestra${cargada ? ' img-plantilla__muestra--cargada' : ''}`}>
      <img src={url} alt={`Plantilla: ${nombre}`} loading="lazy" decoding="async" draggable="false" onLoad={() => setCargada(true)} />
    </span>
  );
}

/**
 * catalogo: { familias, temas, plantillas: [{ id, nombre, familia, temas, miniatura }] } · elegidas: [ids] · onCambiar(ids)
 * productoId: con él, las de productos relacionados (GET /api/imagen-ads/plantillas-relacionadas/:producto) van primero
 * y con su marca, y hay un filtro «Para tu producto».
 */
export function ElegirPlantillasRef({ catalogo, elegidas, onCambiar, bloqueado, productoId = null }) {
  // (con tantas plantillas, un filtro: «Para tu producto», «Todas» o una familia; null = el de por defecto)
  const [filtro, setFiltro] = useState(null);
  const { datos: rel } = useDatos(productoId ? `plantillas-relacionadas:${productoId}` : null, () => pedirNuevo(`/api/imagen-ads/plantillas-relacionadas/${encodeURIComponent(productoId)}`));
  if (!catalogo?.plantillas?.length) return null;
  const relacionadas = new Set(rel?.ids || []);
  const orden = new Map((rel?.ids || []).map((id, i) => [id, i]));
  const hayRelacionadas = relacionadas.size > 0;
  const activo = filtro ?? (hayRelacionadas ? 'producto' : 'todas');
  const familia = activo === 'todas' || activo === 'producto' ? null : activo;
  const temasTexto = (rel?.temas || []).map((t) => catalogo.temas?.[t]).filter(Boolean).slice(0, 3).join(', ').toLowerCase();
  const visibles = (lista) => (activo === 'producto' ? lista.filter((p) => relacionadas.has(p.id)) : lista).slice().sort((a, b) => (orden.get(a.id) ?? 999) - (orden.get(b.id) ?? 999));
  const auto = !elegidas.length;
  const lleno = elegidas.length >= MAXIMO;
  const alternar = (id) => onCambiar(elegidas.includes(id) ? elegidas.filter((x) => x !== id) : lleno ? elegidas : [...elegidas, id]);
  return (
    <div className="img-plantillas">
      <div className="img-plantillas__auto">
        <Chip activo={auto} icono={Sparkles} onClick={() => onCambiar([])} disabled={bloqueado}>
          Que la app elija
        </Chip>
        <span className="t-chico t-3">
          {auto ? 'Una mezcla con ideas distintas, una por imagen.' : `${elegidas.length} ${elegidas.length === 1 ? 'plantilla elegida' : 'plantillas elegidas'}${lleno ? ' (máximo 10)' : ''}: se reparten entre tus anuncios.`}
        </span>
      </div>
      <div className="img-plantillas__filtros" role="group" aria-label="Tipo de plantilla">
        {hayRelacionadas ? (
          <Chip tamano="chico" icono={Sparkles} activo={activo === 'producto'} contador={relacionadas.size} onClick={() => setFiltro('producto')}>
            Para tu producto
          </Chip>
        ) : null}
        <Chip tamano="chico" activo={activo === 'todas'} onClick={() => setFiltro('todas')}>
          Todas
        </Chip>
        {catalogo.familias.map((f) => {
          const n = catalogo.plantillas.filter((p) => p.familia === f.id).length;
          return n ? (
            <Chip key={f.id} tamano="chico" activo={familia === f.id} contador={n} onClick={() => setFiltro(familia === f.id ? 'todas' : f.id)}>
              {f.nombre}
            </Chip>
          ) : null;
        })}
      </div>
      {activo === 'producto' && temasTexto ? <p className="t-chico t-3">De productos como el tuyo ({temasTexto}). «Que la app elija» también las toma primero.</p> : null}
      {catalogo.familias.filter((f) => !familia || f.id === familia).map((f) => {
        const de = visibles(catalogo.plantillas.filter((p) => p.familia === f.id));
        if (!de.length) return null;
        return (
          <section key={f.id} className="img-plantillas__familia" aria-label={f.nombre}>
            <h3 className="img-plantillas__titulo">{f.nombre}</h3>
            <div className="img-plantillas__rejilla">
              {de.map((p) => {
                const activa = elegidas.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`img-plantilla${activa ? ' img-plantilla--activa' : ''}`}
                    aria-pressed={activa}
                    onClick={() => alternar(p.id)}
                    disabled={bloqueado || (lleno && !activa)}
                  >
                    <Muestra url={p.miniatura} nombre={p.nombre} />
                    {activa ? (
                      <span className="img-plantilla__marca" aria-hidden="true">
                        <Check size={14} strokeWidth={3} />
                      </span>
                    ) : null}
                    <span className="img-plantilla__nombre">{p.nombre}</span>
                    {relacionadas.has(p.id) && activo !== 'producto' ? <span className="img-plantilla__costo img-plantilla__costo--relacionada">Para tu producto</span> : null}
                    {p.dias ? (
                      <span className="img-plantilla__costo" title="Días que lleva activo este anuncio en Meta (TrendTrack)">
                        <Flame size={12} strokeWidth={2.2} aria-hidden="true" />
                        {p.dias} días activo
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

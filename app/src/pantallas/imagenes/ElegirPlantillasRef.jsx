// «Plantillas» del formulario de anuncios de imagen (2026-11-18s): los anuncios validados de la categoría. Cada una va
// al modelo de imagen como referencia, con la foto de tu producto: el modelo mantiene su estructura, composición y
// tipografía, y cambia el producto, los textos y los colores. Sin ninguna elegida, «Que la app elija»: una mezcla de
// ideas distintas (una por imagen).
import { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { Chip } from '../../componentes/index.js';

const MAXIMO = 10;

function Muestra({ url, nombre }) {
  const [cargada, setCargada] = useState(false);
  return (
    <span className={`img-plantilla__muestra${cargada ? ' img-plantilla__muestra--cargada' : ''}`}>
      <img src={url} alt={`Plantilla: ${nombre}`} loading="lazy" decoding="async" draggable="false" onLoad={() => setCargada(true)} />
    </span>
  );
}

/** catalogo: { familias, plantillas: [{ id, nombre, familia, miniatura }] } · elegidas: [ids] · onCambiar(ids) */
export function ElegirPlantillasRef({ catalogo, elegidas, onCambiar, bloqueado }) {
  if (!catalogo?.plantillas?.length) return null;
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
      {catalogo.familias.map((f) => {
        const de = catalogo.plantillas.filter((p) => p.familia === f.id);
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

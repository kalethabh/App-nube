// «Formato» del formulario de anuncios de imagen: el catálogo de plantillas con su muestra (armada por el servidor con la
// foto de tu producto y tu kit de marca), por familia, para elegir varias. Sin ninguna elegida, «Que la app elija»: una
// mezcla entre las familias. Cada tarjeta dice si sale gratis y al instante (la arma la app con la foto del producto) o
// si usa una escena del modelo de imagen (sin texto: cuesta una imagen).
import { useState } from 'react';
import { Camera, Check, Sparkles, Zap } from 'lucide-react';
import { Chip } from '../../componentes/index.js';
import { apiImagenes } from '../../datos/imagenes.js';

function Muestra({ url, nombre }) {
  const [cargada, setCargada] = useState(false);
  const [fallo, setFallo] = useState(false);
  return (
    <span className={`img-plantilla__muestra${cargada ? ' img-plantilla__muestra--cargada' : ''}`}>
      {!fallo ? <img src={url} alt={`Muestra: ${nombre}`} loading="lazy" decoding="async" draggable="false" onLoad={() => setCargada(true)} onError={() => setFallo(true)} /> : null}
    </span>
  );
}

/**
 * catalogo: { familias, plantillas, ordenAuto } (de /opciones) · elegidas: [ids] · onCambiar(ids)
 * producto: { id, foto } | null · kit · bloqueado
 */
export function ElegirPlantillas({ catalogo, elegidas, onCambiar, producto, kit, bloqueado }) {
  if (!catalogo?.plantillas?.length) return null;
  const auto = !elegidas.length;
  const alternar = (id) => onCambiar(elegidas.includes(id) ? elegidas.filter((x) => x !== id) : [...elegidas, id]);
  return (
    <div className="img-plantillas">
      <div className="img-plantillas__auto">
        <Chip activo={auto} icono={Sparkles} onClick={() => onCambiar([])} disabled={bloqueado}>
          Que la app elija
        </Chip>
        <span className="t-chico t-3">{auto ? 'Una mezcla de todas las familias, con una idea por imagen.' : `${elegidas.length} ${elegidas.length === 1 ? 'formato elegido' : 'formatos elegidos'}: se reparten en orden entre tus anuncios.`}</span>
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
                    title={p.descripcion}
                    onClick={() => alternar(p.id)}
                    disabled={bloqueado}
                  >
                    <Muestra url={apiImagenes.urlMuestra(p.id, { producto: producto?.id, foto: producto?.foto, kit })} nombre={p.nombre} />
                    {activa ? (
                      <span className="img-plantilla__marca" aria-hidden="true">
                        <Check size={14} strokeWidth={3} />
                      </span>
                    ) : null}
                    <span className="img-plantilla__nombre">{p.nombre}</span>
                    <span className={`img-plantilla__costo${p.escena ? ' img-plantilla__costo--escena' : ''}`}>
                      {p.escena ? <Camera size={12} strokeWidth={2.2} aria-hidden="true" /> : <Zap size={12} strokeWidth={2.2} aria-hidden="true" />}
                      {p.escena ? 'Con escena: 1 imagen' : 'Gratis, al instante'}
                    </span>
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

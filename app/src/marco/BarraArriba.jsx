import { useCuenta,tienePermiso } from '../datos/cuenta.js';
import { ChevronRight, Eye, Plus } from 'lucide-react';
import { Boton } from '../componentes/Boton.jsx';
import { PuntoEstado } from '../componentes/Insignia.jsx';
import { Tooltip } from '../componentes/Tooltip.jsx';
import { useEnProduccion } from '../datos/produccion.js';
import { enlace } from '../datos/rutas.js';
import { BotonActualizar } from './BotonActualizar.jsx';
import { BotonTema } from './BotonTema.jsx';
import { SaludPlataformas } from './SaludPlataformas.jsx';

/**
 * Barra de arriba: migas a la izquierda; a la derecha lo que está en producción y "Nuevo anuncio".
 * La píldora cuenta lo mismo que el menú y la cifra del tablero (src/datos/produccion.js): las carpetas
 * viejas sin terminar no son "en producción". Si no hay nada andando, no se muestra.
 */
export function BarraArriba({ migas = [], ocultarNuevo = false }) {
  const cuenta=useCuenta();
  const p = useEnProduccion({habilitado:tienePermiso(cuenta,'videos','anuncios','tablero')});
  ocultarNuevo=ocultarNuevo || !tienePermiso(cuenta,'videos');
  // lo que te necesita (saldo, un error o un guion para aprobar) se ve desde cualquier pantalla
  const teNecesitan = p.necesitan.length + (p.guiones || []).length;
  const pildoraNecesita = teNecesitan ? (
    <a href={enlace.tablero()} className="barra__produccion barra__produccion--necesita">
      <PuntoEstado tono="error" />
      <span className="t-num">{teNecesitan}</span> te {teNecesitan === 1 ? 'necesita' : 'necesitan'}
    </a>
  ) : null;

  const pildora = p.cantidad ? (
    <a href={enlace.tablero()} className="barra__produccion">
      <PuntoEstado estado="generando" />
      <span className="t-num">{p.cantidad}</span> en producción
      {p.esEjemplo ? <Eye size={13} strokeWidth={2.2} className="barra__produccion-ejemplo" aria-label="(ejemplo)" /> : null}
    </a>
  ) : null;

  return (
    <header className="barra">
      <nav className="migas" aria-label="Estás en">
        {migas.map((m, i) => {
          const ultima = i === migas.length - 1;
          return (
            <span key={`${m.texto}-${i}`} className="migas__paso">
              {i > 0 ? <ChevronRight size={14} strokeWidth={2} className="migas__separador" aria-hidden="true" /> : null}
              {m.href && !ultima ? (
                <a href={m.href} className="migas__enlace">
                  {m.texto}
                </a>
              ) : (
                <span className={ultima ? 'migas__actual' : undefined} aria-current={ultima ? 'page' : undefined}>
                  {m.texto}
                </span>
              )}
            </span>
          );
        })}
      </nav>

      <div className="barra__acciones">
        {pildoraNecesita}
        {pildora && p.esEjemplo ? (
          <Tooltip texto="Vista previa del diseño: estos dos anuncios de ejemplo avanzan solos para mostrar cómo se verá." lado="abajo">
            {pildora}
          </Tooltip>
        ) : (
          pildora
        )}
        <SaludPlataformas />
        <BotonTema />
        {tienePermiso(cuenta)?<BotonActualizar />:null}
        {/* «Nuevo anuncio» vive una sola vez: en el menú (el botón lima de arriba) */}
      </div>
    </header>
  );
}

import { Sparkles } from 'lucide-react';
import './EstadoVacio.css';

/**
 * Lo que se ve cuando todavía no hay nada (nunca una pantalla en blanco).
 *   <EstadoVacio icono={Clapperboard} titulo="Todavía no tienes anuncios"
 *                descripcion="Cuéntale a la IA tu producto y en unos minutos tienes tu primer video."
 *                acciones={<Boton variante="primario" icono={Plus} href="#/nuevo">Nuevo anuncio</Boton>} />
 * variante: normal | compacto | sin-borde · tono del icono: acento | cian | ok | aviso | error
 */
export function EstadoVacio({ icono: Icono = Sparkles, tono = 'acento', titulo, descripcion, acciones, variante = 'normal', children, className = '' }) {
  return (
    <div className={`vacio vacio--${variante} ${className}`}>
      <div className={`vacio__arte vacio__arte--${tono}`} aria-hidden="true">
        <span className="vacio__aro vacio__aro--1" />
        <span className="vacio__aro vacio__aro--2" />
        <span className="vacio__icono">
          <Icono size={variante === 'compacto' ? 20 : 24} strokeWidth={1.9} />
        </span>
      </div>
      {titulo ? <h3 className="vacio__titulo">{titulo}</h3> : null}
      {descripcion ? <p className="vacio__texto">{descripcion}</p> : null}
      {children}
      {acciones ? <div className="vacio__acciones">{acciones}</div> : null}
    </div>
  );
}

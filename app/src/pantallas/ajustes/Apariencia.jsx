// Ajustes → Apariencia: modo claro, oscuro o automático (el de la Mac). Se guarda en este navegador.
import { Monitor, Moon, Sun } from 'lucide-react';
import { Seccion } from '../../componentes/index.js';
import { elegirTema, useTema } from '../../datos/tema.js';

const OPCIONES = [
  { id: 'claro', texto: 'Claro', detalle: 'Fondo blanco, ideal con mucha luz', icono: Sun },
  { id: 'oscuro', texto: 'Oscuro', detalle: 'Fondo negro, el de siempre', icono: Moon },
  { id: 'auto', texto: 'Automático', detalle: 'Igual que tu computador (cambia solo)', icono: Monitor },
];

export function Apariencia() {
  const { elegido } = useTema();
  return (
    <Seccion id="apariencia" className="ajustes__seccion" titulo="Apariencia" descripcion="Cómo se ve la app. El editor de video siempre va oscuro, para ver bien los colores del video.">
      <div className="apariencia" role="radiogroup" aria-label="Tema de la app">
        {OPCIONES.map((o) => {
          const Icono = o.icono;
          const sel = elegido === o.id;
          return (
            <button key={o.id} type="button" role="radio" aria-checked={sel} className={`apariencia__op apariencia__op--${o.id}${sel ? ' apariencia__op--sel' : ''}`} onClick={() => elegirTema(o.id)}>
              <span className="apariencia__muestra" aria-hidden="true">
                <span className="apariencia__barra" />
                <span className="apariencia__linea" />
                <span className="apariencia__linea apariencia__linea--corta" />
                <span className="apariencia__boton" />
              </span>
              <span className="apariencia__texto">
                <Icono size={15} strokeWidth={2} aria-hidden="true" /> <strong>{o.texto}</strong>
              </span>
              <span className="apariencia__detalle">{o.detalle}</span>
            </button>
          );
        })}
      </div>
    </Seccion>
  );
}

// El botón de la barra de arriba para cambiar entre modo claro y oscuro (un toque). En Ajustes → Apariencia está
// también «Automático» (el del computador).
import { Moon, Sun } from 'lucide-react';
import { Boton, Tooltip } from '../componentes/index.js';
import { elegirTema, useTema } from '../datos/tema.js';

export function BotonTema() {
  const { actual } = useTema();
  const aClaro = actual === 'oscuro';
  return (
    <Tooltip texto={aClaro ? 'Modo claro' : 'Modo oscuro'} lado="abajo">
      <Boton variante="secundario" tamano="chico" soloIcono icono={aClaro ? Sun : Moon} etiqueta={aClaro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} onClick={() => elegirTema(aClaro ? 'claro' : 'oscuro')} />
    </Tooltip>
  );
}

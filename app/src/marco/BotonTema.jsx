// El botón de la barra de arriba para cambiar entre el modo claro y el de noche (un toque): de claro vuelve al «Juego».
// En Ajustes → Apariencia están también el oscuro de antes y «Automático» (el del computador).
import { Moon, Sun } from 'lucide-react';
import { Boton, Tooltip } from '../componentes/index.js';
import { elegirTema, useTema } from '../datos/tema.js';

export function BotonTema() {
  const { actual } = useTema();
  const aClaro = actual !== 'claro';
  return (
    <Tooltip texto={aClaro ? 'Modo claro' : 'Modo oscuro'} lado="abajo">
      <Boton variante="secundario" tamano="chico" soloIcono icono={aClaro ? Sun : Moon} etiqueta={aClaro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} onClick={() => elegirTema(aClaro ? 'claro' : 'juego')} />
    </Tooltip>
  );
}

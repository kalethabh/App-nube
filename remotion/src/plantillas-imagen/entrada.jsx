// La entrada del armado de las plantillas de imagen (aparte del video: así el armado es chico y rápido). Tres
// composiciones de un solo cuadro, una por tamaño; el trabajador las lee una vez y las reutiliza en cada imagen.
import { Composition, registerRoot } from 'remotion';
import { Plantilla } from './Plantilla.jsx';

export const TAMANOS = {
  'Plantilla-1x1': [1080, 1080],
  'Plantilla-4x5': [1080, 1350],
  'Plantilla-9x16': [1080, 1920],
};

const porDefecto = { plantilla: 'producto-flechas', formato: '1:1', textos: {}, kit: {}, producto: null, escena: null, logo: null };

function Raiz() {
  return (
    <>
      {Object.entries(TAMANOS).map(([id, [w, h]]) => (
        <Composition key={id} id={id} component={Plantilla} width={w} height={h} fps={30} durationInFrames={1} defaultProps={porDefecto} />
      ))}
    </>
  );
}

registerRoot(Raiz);

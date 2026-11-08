// El "sello" de un estilo: su icono en un cuadrito con el color de la marca.
// En un anuncio nuevo cada estilo se reconoce por su nombre y su sello, nunca por la cara o el
// producto de otro anuncio.
//   <SelloEstilo clave="crochet" familia="voz-en-off" />            (40 px)
//   <SelloEstilo clave="ugc" tamano="chico" />                       (28 px)
//   <SelloEstilo clave="podcast" tamano="grande" />                  (52 px)
import { iconoDe } from '../estilos/catalogo.js';

const PX = { chico: 14, normal: 19, grande: 24 };

export function SelloEstilo({ clave, familia, tamano = 'normal', className = '', ...resto }) {
  const Icono = iconoDe(clave, familia);
  return (
    <span className={`nv-sello nv-sello--${tamano} ${className}`} aria-hidden="true" {...resto}>
      <Icono size={PX[tamano] || PX.normal} strokeWidth={1.9} />
    </span>
  );
}

// Una imagen de anuncio armada por la app (la composición «Plantilla-1x1», «Plantilla-4x5» o «Plantilla-9x16»):
// carga las fuentes del repositorio (sin internet) y dibuja la plantilla pedida con sus textos, el kit de marca, la foto
// del producto y la escena (si la plantilla la usa). La renderiza app/server/lib/plantillas/trabajador.mjs con
// renderStill, a PNG.
//
// props: { plantilla, formato: '1:1'|'4:5'|'9:16', textos, kit, producto: { url, recortado }, escena: { url } | null,
//          logo: { url } | null }
import { useEffect, useState } from 'react';
import { AbsoluteFill, continueRender, delayRender, staticFile } from 'remotion';
import { AntesDespues, LineaTiempo, MapaCuerpo, Pizarra } from './dolor.jsx';
import { BarraDatos, ListaIconos, Mecanismo, ProductoFlechas } from './beneficio.jsx';
import { Burbujas, Comentario, FotoTiktok, FotoTitular, NotaTexto, ResenaTuit } from './nativo.jsx';
import { BuenaMala, CasiAgotado, StickerOferta } from './oferta.jsx';
import { Logo } from './base.jsx';

export const PLANTILLAS = {
  'antes-despues': AntesDespues,
  'linea-tiempo': LineaTiempo,
  pizarra: Pizarra,
  'mapa-cuerpo': MapaCuerpo,
  'producto-flechas': ProductoFlechas,
  'lista-iconos': ListaIconos,
  'barra-datos': BarraDatos,
  mecanismo: Mecanismo,
  'nota-texto': NotaTexto,
  burbujas: Burbujas,
  'foto-tiktok': FotoTiktok,
  'resena-tuit': ResenaTuit,
  'foto-titular': FotoTitular,
  comentario: Comentario,
  'sticker-oferta': StickerOferta,
  'casi-agotado': CasiAgotado,
  'buena-mala': BuenaMala,
};

const FUENTES = [
  ['Anton', 'Anton-Regular.ttf', {}],
  ['Bebas Neue', 'BebasNeue-Regular.ttf', {}],
  ['Archivo Black', 'ArchivoBlack-Regular.ttf', {}],
  ['Caveat', 'Caveat.ttf', { weight: '400 700' }],
  ['Permanent Marker', 'PermanentMarker-Regular.ttf', {}],
  ['Inter', 'Inter.ttf', { weight: '100 900' }],
];

// Las fuentes se cargan una vez por página (todas: son pocas y locales).
let cargadas = null;
function cargarFuentes() {
  if (!cargadas) {
    cargadas = Promise.all(
      FUENTES.map(([familia, archivo, desc]) =>
        new FontFace(familia, `url(${staticFile(`fuentes/${archivo}`)})`, desc).load().then((f) => {
          document.fonts.add(f);
        })
      )
    );
  }
  return cargadas;
}

export function Plantilla(props) {
  const [listo, setListo] = useState(false);
  const [espera] = useState(() => delayRender('Cargando las fuentes'));
  useEffect(() => {
    cargarFuentes()
      .then(() => setListo(true))
      .catch((e) => {
        console.error('No pude cargar las fuentes', e);
        setListo(true);
      });
  }, []);
  useEffect(() => {
    if (listo) continueRender(espera);
  }, [listo, espera]);
  if (!listo) return null;
  const Comp = PLANTILLAS[props.plantilla] || ProductoFlechas;
  const t = props.textos || {};
  return (
    <AbsoluteFill style={{ background: '#fff', WebkitFontSmoothing: 'antialiased' }}>
      <Comp t={t} kit={props.kit || {}} producto={props.producto} escena={props.escena} formato={props.formato} />
      {props.logo?.url ? (
        <div style={{ position: 'absolute', left: 34, top: props.formato === '9:16' ? '11.5%' : 26 }}>
          <Logo logo={props.logo} alto={64} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
}

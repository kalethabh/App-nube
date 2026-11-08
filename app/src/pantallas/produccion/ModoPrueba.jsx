// La banda "Modo prueba: no se gasta nada": cuando la app arrancó con ANUNCIOS_MODO_PRUEBA=1, el
// conductor corre contra los simuladores locales (kie, ElevenLabs y Suno) y lo dice en conductor.modoPrueba.
//
//   <BandaGlobalModoPrueba />   arriba de todas las pantallas mientras la app está en modo prueba (/api/estado)
//   <BandaModoPrueba />         la de un anuncio hecho en modo prueba (producción, tablero y entrega). Si la
//                               global ya se ve, no se repite.
import { FlaskConical, TriangleAlert } from 'lucide-react';
import { useEstado } from '../../datos/api.js';
import './modo-prueba.css';

/** { activo, listo, error } del modo prueba de la app (de /api/estado; se comparte con el menú). */
export function useModoPruebaDeLaApp() {
  const { datos } = useEstado();
  return datos?.modoPrueba || { activo: false };
}

export function BandaGlobalModoPrueba() {
  const mp = useModoPruebaDeLaApp();
  if (!mp.activo) return null;
  if (mp.error) {
    return (
      <div className="modo-prueba modo-prueba--global modo-prueba--error" role="alert">
        <TriangleAlert size={15} strokeWidth={2.2} aria-hidden="true" />
        <span>
          <strong>Modo prueba: los simuladores no arrancaron.</strong> No se corre nada para no gastar. Cierra la app y vuelve a abrirla.
        </span>
      </div>
    );
  }
  return (
    <div className="modo-prueba modo-prueba--global" role="note">
      <FlaskConical size={15} strokeWidth={2.2} aria-hidden="true" />
      <span>
        <strong>Modo prueba: no se gasta nada.</strong> Las imágenes, los videos, la voz y la música salen de simuladores en tu PC.
      </span>
    </div>
  );
}

export function BandaModoPrueba({ children, className = '' }) {
  const mp = useModoPruebaDeLaApp();
  if (mp.activo) return null; // ya está la de arriba
  return (
    <div className={`modo-prueba ${className}`} role="note">
      <FlaskConical size={15} strokeWidth={2.2} aria-hidden="true" />
      <span>
        <strong>Modo prueba: no se gasta nada.</strong>{' '}
        {children || 'Las imágenes, los videos, la voz y la música salen de simuladores en tu PC: no se le pide nada a kie, a ElevenLabs ni a Suno.'}
      </span>
    </div>
  );
}

/** La versión chica, para una ficha o un encabezado. */
export function MarcaModoPrueba({ className = '' }) {
  return (
    <span className={`modo-prueba-marca ${className}`} title="Modo prueba: no se gasta nada">
      <FlaskConical size={12} strokeWidth={2.4} aria-hidden="true" />
      Modo prueba
    </span>
  );
}

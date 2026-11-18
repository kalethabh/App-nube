// GENERADOR DE LANDINGS (#/landings): próximamente (2026-11-18x). Solo anuncia lo que viene.
import { LayoutTemplate } from 'lucide-react';
import { Boton, EstadoVacio } from '../../componentes/index.js';
import { enlace } from '../../datos/rutas.js';

export default function Landings() {
  return (
    <div className="pagina pagina--angosta">
      <EstadoVacio
        icono={LayoutTemplate}
        titulo="Generador de Landings · Próximamente"
        descripcion="Páginas de venta para tus productos, armadas con tu investigación de mercado, tus anuncios y tus fotos. Muy pronto."
        acciones={
          <Boton variante="secundario" href={enlace.inicio()}>
            Volver al inicio
          </Boton>
        }
      />
    </div>
  );
}

// Lo que viene (2026-11-18y): Embudo WhatsApp, Generador de Landings y S.E.P. Cada uno es una pantalla de «Próximamente»
// (en el menú, con la marca «Pronto»). Cuando uno esté listo, su pantalla de verdad reemplaza a la de aquí.
import { LayoutTemplate, MessageCircle, Rocket } from 'lucide-react';
import { Boton, EstadoVacio } from '../../componentes/index.js';
import { enlace } from '../../datos/rutas.js';

function Proximamente({ icono, titulo, descripcion }) {
  return (
    <div className="pagina pagina--angosta">
      <EstadoVacio
        icono={icono}
        titulo={`${titulo} · Próximamente`}
        descripcion={descripcion}
        acciones={
          <Boton variante="secundario" href={enlace.inicio()}>
            Volver al inicio
          </Boton>
        }
      />
    </div>
  );
}

export const EmbudoWhatsapp = () => <Proximamente icono={MessageCircle} titulo="Embudo WhatsApp" descripcion="Tus anuncios llevando clientes a WhatsApp, con los mensajes y el seguimiento listos para vender. Muy pronto." />;
export const Landings = () => <Proximamente icono={LayoutTemplate} titulo="Generador de Landings" descripcion="Páginas de venta para tus productos, armadas con tu investigación de mercado, tus anuncios y tus fotos. Muy pronto." />;
export const Sep = () => <Proximamente icono={Rocket} titulo="S.E.P" descripcion="Muy pronto." />;

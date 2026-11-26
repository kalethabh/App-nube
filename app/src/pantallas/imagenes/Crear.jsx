// #/imagenes/nuevo — «Crear anuncios de imagen»: a todo el ancho, el formulario a la izquierda y el panel «Tu lote» a
// la derecha (fijo al bajar; en pantallas angostas, abajo). Al tocar «Generar» va a la pantalla del lote. Arriba,
// «← Anuncios de imagen» para volver (igual que en la pantalla de un lote: en el celular las migas no muestran la sección).
//   #/imagenes/nuevo?producto=<id>   ("Hacer otro lote", «Crear más») el formulario con ese producto elegido
//   #/imagenes/nuevo?referencia=/api/inspiracion/imagenes/<id>.jpg   («Replicar» en Inspiración) con esa imagen de referencia
//   #/imagenes/nuevo?simular=1       la vista previa del diseño, con productos de ejemplo (no se guarda nada)
import { ArrowLeft } from 'lucide-react';
import { Boton, CabeceraPagina, VistaPrevia, useBarraSuperior } from '../../componentes/index.js';
import { FormularioAgente } from './FormularioAgente.jsx';
import { enlace, ir, rutas } from '../../datos/rutas.js';
import '../oficina/oficina.css';
import './imagenes.css';

export default function PantallaCrearImagenes({ consulta }) {
  const simulando = consulta?.get('simular') === '1';
  const volver = enlace.imagenes(simulando ? { simular: '1' } : undefined);
  useBarraSuperior({ migas: [{ texto: 'Anuncios de imagen', href: volver }, { texto: 'Crear anuncios de imagen' }] });
  return (
    <div className="pagina img img-crear-pagina">
      <div className="img-crear__arriba">
        <Boton variante="fantasma" tamano="chico" icono={ArrowLeft} href={volver} className="img-volver">
          Anuncios de imagen
        </Boton>
        <CabeceraPagina
          titulo="Crear anuncios de imagen"
          descripcion="Elige cómo, tu producto y cuántos. La IA hace el resto, revisa cada imagen y te muestra el costo antes de empezar."
          extra={
            simulando ? (
              <VistaPrevia
                texto="Simulación"
                className="img-simulacion"
                explicacion="Vista previa del diseño: los productos son de ejemplo y no se guarda nada. Sin ?simular=1 ves los tuyos."
              />
            ) : null
          }
        />
      </div>
      {/* (2026-11-20) solo el agente: con referencia o desde la investigación (sin plantillas) */}
      <div className="img-agente">
        <FormularioAgente productoPedido={consulta?.get('producto') || null} referenciaPedida={consulta?.get('referencia') || null} modoInicial={consulta?.get('modo') === 'investigacion' ? 'investigacion' : null} onListo={(lote) => ir(rutas.loteImagenes(lote))} />
      </div>
    </div>
  );
}

// «Editar este anuncio» (2026-11-21h): mientras se hace o ya terminado, pides el cambio con tus palabras («que ya no
// sea cantado, que sea narrado», «cambia el gancho», «que la persona sea un hombre») y la app arma una VERSIÓN NUEVA:
// tu IA parte del guion (o la letra) de este y cambia solo eso, con las mismas personas y lugares (sin pagarlas otra
// vez). Si el cambio es de formato, cambia el estilo (o lo eliges tú). Este no se toca: si se estaba haciendo, se
// detiene para no gastar en lo que vas a cambiar (lo hecho queda guardado). Después ves el guion y lo apruebas.
// Servidor: POST /api/anuncios/:slug/editar (lib/anuncios-nuevos.js editarAnuncio).
import { useState } from 'react';
import { PencilLine } from 'lucide-react';
import { AreaTexto, Boton, Interruptor, Modal, Selector, useAvisos } from '../../componentes/index.js';
import { pedirNuevo, refrescar, useEstilos } from '../../datos/api.js';
import { ir, rutas } from '../../datos/rutas.js';

const CANTADOS = ['musical', 'historias-musicales'];

export function EditarAnuncio({ slug, productoId = null, estilo = null, enMarcha = false, variante = 'secundario', bloque = false }) {
  const [abierto, setAbierto] = useState(false);
  const [pedido, setPedido] = useState('');
  const [elegido, setElegido] = useState('auto');
  const [detener, setDetener] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const { aviso } = useAvisos();
  const { datos } = useEstilos();
  const estilos = (Array.isArray(datos) ? datos : datos?.estilos || []).filter((e) => e.clave && e.clave !== 'agregar' && e.instalado !== false);
  const nombreDe = (k) => estilos.find((e) => e.clave === k)?.nombre || k;
  const cantado = CANTADOS.includes(estilo);
  const editar = async () => {
    setOcupado(true);
    try {
      const r = await pedirNuevo(`/api/anuncios/${encodeURIComponent(slug)}/editar`, { metodo: 'POST', cuerpo: { pedido, estilo: elegido, detener } });
      refrescar('anuncios');
      aviso({
        tipo: 'ok',
        titulo: 'Tu IA está haciendo la versión nueva',
        texto: `${r.cambioDeEstilo ? `Va en «${r.estiloNombre}». ` : ''}${r.detenido ? 'Este quedó detenido (lo hecho está guardado). ' : ''}Revisa el guion y apruébalo antes de producir.`,
      });
      setAbierto(false);
      ir(rutas.nuevo({ ...(r.productoId || productoId ? { producto: r.productoId || productoId } : {}), paso: '2', anuncios: r.slug }));
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude editarlo', texto: e.message });
    } finally {
      setOcupado(false);
    }
  };
  return (
    <>
      <Boton variante={variante} icono={PencilLine} onClick={() => setAbierto(true)} bloque={bloque}>
        Editar este anuncio
      </Boton>
      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Editar este anuncio"
        descripcion="Dime qué quieres cambiar, con tus palabras. Se hace una versión nueva con ese cambio y lo demás igual (mismas personas y escenas, sin pagarlas otra vez). Este no se borra."
        icono={PencilLine}
      >
        <div className="ent-editar">
          <AreaTexto
            etiqueta="¿Qué quieres cambiar?"
            filas={4}
            maxLength={3000}
            value={pedido}
            onChange={(e) => setPedido(e.target.value)}
            placeholder={cantado ? 'Por ejemplo: que ya no sea cantado, que sea narrado con voz en off' : 'Por ejemplo: cambia el gancho por una pregunta, que la persona sea un hombre de 40 años, más corto'}
            autoFocus
          />
          <Selector
            etiqueta="Estilo de la versión nueva"
            value={elegido}
            onChange={(e) => setElegido(e.target.value)}
            opciones={[
              { valor: 'auto', etiqueta: `El mismo (${nombreDe(estilo) || 'este'}), o el que pida tu cambio` },
              ...estilos.filter((e) => e.clave !== estilo).map((e) => ({ valor: e.clave, etiqueta: e.nombre })),
            ]}
            ayuda={cantado ? 'Si pides que ya no sea cantado, va narrado con voz en off en el mismo look.' : undefined}
          />
          {enMarcha ? (
            <Interruptor activado={detener} onCambio={setDetener} etiqueta="Detener el que se está haciendo" descripcion="Para no gastar en lo que vas a cambiar. Lo hecho queda guardado y lo puedes continuar después." />
          ) : null}
          <p className="t-chico t-3">Antes de producir ves el guion nuevo y su costo, como siempre.</p>
          <Boton variante="primario" icono={PencilLine} onClick={editar} cargando={ocupado} disabled={pedido.trim().length < 3}>
            Hacer la versión nueva
          </Boton>
        </div>
      </Modal>
    </>
  );
}

// «Me funciona»: marca un creativo propio (una imagen de un lote o un video terminado) como ganador, para elegirlo
// después en «Anuncios de imagen → Variantes». Un toque lo marca y otro lo quita.
import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { Boton } from './Boton.jsx';
import { Tooltip } from './Tooltip.jsx';
import { useAvisos } from './Avisos.jsx';
import { claveImagen, claveVideo, marcarFunciona, quitarFunciona, useFuncionan } from '../datos/funcionan.js';

/** `tipo` 'imagen' (con `lote` y `pieza`) o 'video' (con `slug`). `conTexto` muestra la palabra además del ícono. */
export function BotonFunciona({ tipo, lote, pieza, slug, conTexto = false, tamano = 'chico', deshabilitado = false }) {
  const { datos, recargar } = useFuncionan();
  const { aviso } = useAvisos();
  const [ocupado, setOcupado] = useState(false);
  const clave = tipo === 'video' ? claveVideo(slug) : claveImagen(lote, pieza);
  const marcado = Boolean(datos?.claves?.includes(clave));
  const texto = marcado ? 'Me funciona' : 'Marcar: me funciona';

  const tocar = async () => {
    setOcupado(true);
    try {
      if (marcado) await quitarFunciona(clave);
      else {
        await marcarFunciona(tipo === 'video' ? { tipo, slug } : { tipo, lote, pieza });
        aviso({ tipo: 'ok', titulo: 'Guardado en «Lo que me funciona»', texto: 'Haz variantes ganadoras en Anuncios de imagen → Variantes.', duracion: 5000 });
      }
      await recargar();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude marcarlo', texto: e?.message || 'Vuelve a intentar.' });
    } finally {
      setOcupado(false);
    }
  };

  const boton = (
    <Boton
      variante={marcado ? 'primario' : conTexto ? 'secundario' : 'fantasma'}
      tamano={tamano}
      soloIcono={!conTexto}
      icono={Trophy}
      etiqueta={marcado ? 'Quitar de «Lo que me funciona»' : 'Marcar como «Me funciona»'}
      onClick={tocar}
      cargando={ocupado}
      disabled={deshabilitado || ocupado}
      aria-pressed={marcado}
      className={marcado ? 'boton-funciona boton-funciona--si' : 'boton-funciona'}
    >
      {conTexto ? 'Me funciona' : null}
    </Boton>
  );
  return conTexto ? boton : <Tooltip texto={texto}>{boton}</Tooltip>;
}

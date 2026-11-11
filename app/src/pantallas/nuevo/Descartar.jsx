// "Descartar este anuncio": para un anuncio que todavía no se produce (su guion espera tu aprobación o no salió).
// Pide confirmación y lo saca del tablero con DELETE /api/anuncios/:slug. No se borra nada: la carpeta pasa a
// temp/_descartados/. Mientras tu IA escribe el guion o el anuncio ya se produce, el servidor no lo deja.
//
//   <BotonDescartar slug={a.slug} titulo={a.titulo} alDescartar={() => …} />   (soloIcono: el tacho, con su nombre al pasar)
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Boton, Modal, useAvisos } from '../../componentes/index.js';
import { apiNuevo, invalidar } from '../../datos/api.js';

export function BotonDescartar({ slug, titulo, alDescartar, variante = 'fantasma', tamano = 'chico', texto = 'Descartar', soloIcono = false }) {
  const { aviso } = useAvisos();
  const [abierto, setAbierto] = useState(false);
  const [descartando, setDescartando] = useState(false);

  const descartar = async () => {
    setDescartando(true);
    try {
      await apiNuevo.descartarAnuncio(slug);
      invalidar('anuncios');
      setAbierto(false);
      aviso({ tipo: 'ok', titulo: 'Anuncio descartado', texto: `${titulo || 'El anuncio'} ya no aparece en Mis anuncios. Tu producto sigue guardado.` });
      alDescartar?.();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude descartarlo', texto: e.message });
    } finally {
      setDescartando(false);
    }
  };

  return (
    <>
      {soloIcono ? (
        <Boton variante={variante} tamano={tamano} soloIcono icono={Trash2} etiqueta={texto} title={texto} onClick={() => setAbierto(true)} />
      ) : (
        <Boton variante={variante} tamano={tamano} icono={Trash2} onClick={() => setAbierto(true)}>
          {texto}
        </Boton>
      )}
      <Modal
        abierto={abierto}
        onCerrar={() => (descartando ? null : setAbierto(false))}
        tamano="chico"
        tono="error"
        icono={Trash2}
        titulo="¿Descartar este anuncio?"
        descripcion={`${titulo ? `«${titulo}» ` : 'Este anuncio '}sale de Mis anuncios con su guion. Tu producto y su ficha siguen guardados: puedes empezar otro cuando quieras.`}
        pie={
          <>
            <Boton variante="fantasma" onClick={() => setAbierto(false)} disabled={descartando}>
              Cancelar
            </Boton>
            <Boton variante="peligro" icono={Trash2} onClick={descartar} cargando={descartando}>
              Sí, descartar
            </Boton>
          </>
        }
      />
    </>
  );
}

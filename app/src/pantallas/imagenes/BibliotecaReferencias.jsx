// Tu biblioteca de referencias (Anuncios de imagen): los anuncios que ya subiste como referencia, guardados para usarlos
// otra vez con cualquier producto. Cada referencia que subes a un lote queda aquí sola (lib/imagen-ads/biblioteca-referencias.js).
//
//   <BibliotecaReferencias abierta={x} onCerrar={…} lugar={cuantasCaben} onElegir={(archivos) => …} />
// onElegir recibe los File de las elegidas (se suben al lote como cualquier referencia).
import { useEffect, useState } from 'react';
import { Check, Images, Trash2 } from 'lucide-react';
import { Boton, EstadoVacio, Modal, useAvisos } from '../../componentes/index.js';
import { apiImagenes } from '../../datos/imagenes.js';

export function BibliotecaReferencias({ abierta, onCerrar, lugar = 10, onElegir }) {
  const { aviso } = useAvisos();
  const [lista, setLista] = useState(null);
  const [elegidas, setElegidas] = useState([]);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!abierta) return undefined;
    let vigente = true;
    setElegidas([]);
    setLista(null);
    apiImagenes
      .biblioteca()
      .then((r) => vigente && setLista(r?.referencias || []))
      .catch(() => vigente && setLista([]));
    return () => {
      vigente = false;
    };
  }, [abierta]);

  if (!abierta) return null;

  const alternar = (id) =>
    setElegidas((e) => {
      if (e.includes(id)) return e.filter((x) => x !== id);
      if (e.length >= lugar) {
        aviso({ tipo: 'aviso', titulo: lugar > 0 ? `Caben ${lugar} más` : 'Ya no caben más', texto: 'Quita una referencia del lote para agregar otra.' });
        return e;
      }
      return [...e, id];
    });

  const quitar = async (id) => {
    try {
      await apiImagenes.quitarDeBiblioteca(id);
      setLista((l) => (l || []).filter((x) => x.id !== id));
      setElegidas((e) => e.filter((x) => x !== id));
    } catch (err) {
      aviso({ tipo: 'error', titulo: 'No pude quitarla', texto: err?.message || 'Vuelve a intentarlo.' });
    }
  };

  const usar = async () => {
    setOcupado(true);
    try {
      const archivos = [];
      for (const id of elegidas) {
        const r = (lista || []).find((x) => x.id === id);
        if (!r) continue;
        const resp = await fetch(r.url);
        if (!resp.ok) throw new Error('No pude abrir una de las referencias.');
        const blob = await resp.blob();
        const ext = blob.type === 'image/png' ? 'png' : 'jpg';
        archivos.push(new File([blob], `referencia-${id.slice(0, 6)}.${ext}`, { type: blob.type || (ext === 'png' ? 'image/png' : 'image/jpeg') }));
      }
      onElegir?.(archivos);
      onCerrar?.();
    } catch (err) {
      aviso({ tipo: 'error', titulo: 'No pude usar esas referencias', texto: err?.message || 'Vuelve a intentarlo.' });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      tamano="grande"
      icono={Images}
      titulo="Tu biblioteca de referencias"
      descripcion="Los anuncios que ya usaste como referencia. Elige los que quieras adaptar a este producto."
      className="img-bib"
      pie={
        <>
          <Boton variante="fantasma" onClick={onCerrar} disabled={ocupado}>
            Cancelar
          </Boton>
          <Boton variante="primario" icono={Check} onClick={usar} cargando={ocupado} disabled={!elegidas.length}>
            {elegidas.length ? `Usar ${elegidas.length === 1 ? 'esta referencia' : `estas ${elegidas.length}`}` : 'Elige alguna'}
          </Boton>
        </>
      }
    >
      {lista === null ? (
        <p className="t-chico t-3">Cargando tu biblioteca…</p>
      ) : !lista.length ? (
        <EstadoVacio icono={Images} titulo="Tu biblioteca está vacía" descripcion="Cada anuncio que subas como referencia queda guardado aquí para usarlo con otros productos." />
      ) : (
        <ul className="img-bib__lista" aria-label="Tus referencias guardadas">
          {lista.map((r) => {
            const activa = elegidas.includes(r.id);
            return (
              <li key={r.id} className={`img-bib__item${activa ? ' img-bib__item--activa' : ''}`}>
                <button type="button" className="img-bib__elegir" onClick={() => alternar(r.id)} aria-pressed={activa} aria-label={activa ? 'Quitar de la selección' : 'Elegir esta referencia'}>
                  <img src={r.miniatura} alt="" loading="lazy" draggable="false" />
                  {activa ? (
                    <span className="img-bib__marca" aria-hidden="true">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  ) : null}
                </button>
                <button type="button" className="img-bib__borrar" onClick={() => quitar(r.id)} aria-label="Quitar de tu biblioteca" title="Quitar de tu biblioteca">
                  <Trash2 size={13} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

// Tu biblioteca de referencias (Anuncios de imagen), en dos pestañas:
//   Tendencias  creativos de marcas de salud que están funcionando (TrendTrack), por categoría (aguaje, drenaje…)
//   Tuyas       los anuncios que ya subiste como referencia (cada referencia que subes a un lote queda aquí sola)
// (lib/imagen-ads/biblioteca-referencias.js)
//
//   <BibliotecaReferencias abierta={x} onCerrar={…} lugar={cuantasCaben} onElegir={(archivos) => …} />
// onElegir recibe los File de las elegidas (se suben al lote como cualquier referencia).
import { useEffect, useState } from 'react';
import { Check, Images, Trash2 } from 'lucide-react';
import { Boton, Chip, EstadoVacio, Modal, Pestanas, useAvisos } from '../../componentes/index.js';
import { apiImagenes } from '../../datos/imagenes.js';

export function BibliotecaReferencias({ abierta, onCerrar, lugar = 10, onElegir }) {
  const { aviso } = useAvisos();
  const [lista, setLista] = useState(null);
  const [tendencias, setTendencias] = useState(null); // { categorias, referencias, fecha }
  const [pestana, setPestana] = useState('tendencias');
  const [categoria, setCategoria] = useState('todas');
  const [elegidas, setElegidas] = useState([]);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!abierta) return undefined;
    let vigente = true;
    setElegidas([]);
    setLista(null);
    setTendencias(null);
    apiImagenes
      .biblioteca()
      .then((r) => vigente && setLista(r?.referencias || []))
      .catch(() => vigente && setLista([]));
    apiImagenes
      .tendencias()
      .then((r) => vigente && setTendencias(r || { categorias: [], referencias: [] }))
      .catch(() => vigente && setTendencias({ categorias: [], referencias: [] }));
    return () => {
      vigente = false;
    };
  }, [abierta]);
  const todas = [...(lista || []), ...(tendencias?.referencias || [])];

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
        const r = todas.find((x) => x.id === id);
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
      titulo="Referencias"
      descripcion="Elige anuncios que están funcionando (Tendencias) o los que ya usaste (Tuyas) para variarlos con tu producto."
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
      <Pestanas
        variante="segmentado"
        etiqueta="Qué referencias ver"
        items={[
          { id: 'tendencias', etiqueta: `Tendencias${tendencias?.referencias?.length ? ` (${tendencias.referencias.length})` : ''}` },
          { id: 'tuyas', etiqueta: `Tuyas${lista?.length ? ` (${lista.length})` : ''}` },
        ]}
        activa={pestana}
        onCambio={setPestana}
        className="img-bib__pestanas"
      />
      {pestana === 'tendencias' ? (
        tendencias === null ? (
          <p className="t-chico t-3">Cargando las tendencias…</p>
        ) : !tendencias.referencias.length ? (
          <EstadoVacio icono={Images} titulo="Todavía no hay tendencias" descripcion="Aquí aparecen los creativos de marcas de salud que están funcionando en TrendTrack." />
        ) : (
          <>
            <div className="img-bib__categorias" role="group" aria-label="Categorías">
              <Chip activo={categoria === 'todas'} onClick={() => setCategoria('todas')}>
                Todas
              </Chip>
              {tendencias.categorias.map((c) => (
                <Chip key={c.id} activo={categoria === c.id} onClick={() => setCategoria(c.id)}>
                  {c.nombre} ({c.cuantas})
                </Chip>
              ))}
            </div>
            <p className="t-chico t-3">
              Anuncios de marcas de salud que están funcionando en Meta{tendencias.fecha ? ` (TrendTrack, ${tendencias.fecha})` : ''}. Al usarlos, la IA hace tu versión: nunca copia la marca, el producto ni los textos.
            </p>
            <ul className="img-bib__lista" aria-label="Referencias de tendencia">
              {tendencias.referencias
                .filter((r) => categoria === 'todas' || r.categoria === categoria)
                .map((r) => {
                  const activa = elegidas.includes(r.id);
                  return (
                    <li key={r.id} className={`img-bib__item${activa ? ' img-bib__item--activa' : ''}`}>
                      <button type="button" className="img-bib__elegir" onClick={() => alternar(r.id)} aria-pressed={activa} aria-label={`${activa ? 'Quitar' : 'Elegir'}: ${r.marca}`}>
                        <img src={r.miniatura} alt="" loading="lazy" draggable="false" />
                        {activa ? (
                          <span className="img-bib__marca" aria-hidden="true">
                            <Check size={14} strokeWidth={3} />
                          </span>
                        ) : null}
                      </button>
                      <span className="img-bib__pie" title={r.marca}>
                        {r.marca} · {r.alcance >= 1000 ? `${Math.round(r.alcance / 1000)} mil` : r.alcance} de alcance
                      </span>
                    </li>
                  );
                })}
            </ul>
          </>
        )
      ) : lista === null ? (
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

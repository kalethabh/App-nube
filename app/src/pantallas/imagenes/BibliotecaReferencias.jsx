// Tu biblioteca de referencias (Anuncios de imagen), en dos pestañas:
//   Ganadoras   solo anuncios ganadores (validados), por categoría (aguaje, drenaje…): los de TrendTrack (más de 100.000
//               personas alcanzadas o activos hace 30 días o más) y los que agregas tú, subiendo o pegando lo copiado
//               (Ctrl/Cmd+V). Cualquiera se borra.
//   Tuyas       los anuncios que ya subiste como referencia (cada referencia que subes a un lote queda aquí sola)
// (lib/imagen-ads/biblioteca-referencias.js)
//
//   <BibliotecaReferencias abierta={x} onCerrar={…} lugar={cuantasCaben} onElegir={(archivos) => …} />
// onElegir recibe los File de las elegidas (se suben al lote como cualquier referencia).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ClipboardPaste, Images, Trash2, Upload } from 'lucide-react';
import { Boton, CampoTexto, Chip, EstadoVacio, Modal, Pestanas, Selector, useAvisos } from '../../componentes/index.js';
import { apiImagenes } from '../../datos/imagenes.js';

export function BibliotecaReferencias({ abierta, onCerrar, lugar = 10, onElegir }) {
  const { aviso } = useAvisos();
  const [lista, setLista] = useState(null);
  const [tendencias, setTendencias] = useState(null); // { categorias, referencias, fecha }
  const [pestana, setPestana] = useState('tendencias');
  const [categoria, setCategoria] = useState('todas');
  const [elegidas, setElegidas] = useState([]);
  const [ocupado, setOcupado] = useState(false);
  // agregar ganadoras: a qué categoría (id, o 'nueva' con su nombre) y de qué marca
  const [destino, setDestino] = useState('');
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [marca, setMarca] = useState('');
  const [subiendo, setSubiendo] = useState(0);
  const [porBorrar, setPorBorrar] = useState(null);
  const entrada = useRef(null);

  const cargarTendencias = useCallback(
    () =>
      apiImagenes
        .tendencias()
        .then((r) => setTendencias(r || { categorias: [], referencias: [] }))
        .catch(() => setTendencias((t) => t || { categorias: [], referencias: [] })),
    [],
  );

  useEffect(() => {
    if (!abierta) return undefined;
    let vigente = true;
    setElegidas([]);
    setLista(null);
    setTendencias(null);
    setPorBorrar(null);
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
  const categorias = tendencias?.categorias || [];
  // la categoría a la que van las que agregas: la elegida, o la del filtro, o la primera
  const categoriaDestino = destino || (categoria !== 'todas' ? categoria : categorias[0]?.id || 'nueva');

  const agregar = useCallback(
    async (archivos) => {
      const imagenes = [...(archivos || [])].filter((f) => f && /^image\//.test(f.type || ''));
      if (!imagenes.length) return;
      const cat = categoriaDestino === 'nueva' ? nuevaCategoria.trim() : categoriaDestino;
      if (!cat) {
        aviso({ tipo: 'aviso', titulo: 'Falta la categoría', texto: 'Escribe el nombre de la categoría nueva (por ejemplo «Aguaje») y vuelve a subirla.' });
        return;
      }
      setSubiendo((n) => n + imagenes.length);
      let bien = 0;
      for (const f of imagenes) {
        try {
          await apiImagenes.agregarGanadora(f, cat, marca.trim());
          bien += 1;
        } catch (err) {
          aviso({ tipo: 'error', titulo: 'No pude agregar una ganadora', texto: err?.message || 'Vuelve a intentarlo.' });
        } finally {
          setSubiendo((n) => n - 1);
        }
      }
      if (bien) {
        await cargarTendencias();
        if (categoriaDestino === 'nueva') {
          setDestino('');
          setNuevaCategoria('');
        }
        aviso({ tipo: 'ok', titulo: bien === 1 ? 'Ganadora agregada' : `${bien} ganadoras agregadas`, texto: 'Ya puedes elegirla como referencia.' });
      }
    },
    [aviso, cargarTendencias, categoriaDestino, marca, nuevaCategoria],
  );

  // pegar lo copiado (una imagen copiada de Facebook, TrendTrack o una captura) en la pestaña Ganadoras
  useEffect(() => {
    if (!abierta || pestana !== 'tendencias') return undefined;
    const alPegar = (e) => {
      const archivos = [...(e.clipboardData?.items || [])].filter((it) => it.kind === 'file' && /^image\//.test(it.type)).map((it) => it.getAsFile()).filter(Boolean);
      if (!archivos.length) return;
      e.preventDefault();
      // que no llegue también a la zona de referencias del formulario que está detrás del modal
      e.stopPropagation();
      agregar(archivos.map((f, i) => (f.name && f.name !== 'image.png' ? f : new File([f], `pegada-${Date.now()}-${i}.${f.type === 'image/png' ? 'png' : 'jpg'}`, { type: f.type }))));
    };
    document.addEventListener('paste', alPegar, true);
    return () => document.removeEventListener('paste', alPegar, true);
  }, [abierta, pestana, agregar]);

  const borrarGanadora = async (id) => {
    if (porBorrar !== id) {
      setPorBorrar(id);
      return;
    }
    setPorBorrar(null);
    try {
      await apiImagenes.borrarGanadora(id);
      setElegidas((e) => e.filter((x) => x !== id));
      await cargarTendencias();
    } catch (err) {
      aviso({ tipo: 'error', titulo: 'No pude borrarla', texto: err?.message || 'Vuelve a intentarlo.' });
    }
  };

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
      descripcion="Elige anuncios ganadores (validados) o los que ya usaste (Tuyas) para variarlos con tu producto."
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
          { id: 'tendencias', etiqueta: `Ganadoras${tendencias?.referencias?.length ? ` (${tendencias.referencias.length})` : ''}` },
          { id: 'tuyas', etiqueta: `Tuyas${lista?.length ? ` (${lista.length})` : ''}` },
        ]}
        activa={pestana}
        onCambio={setPestana}
        className="img-bib__pestanas"
      />
      {pestana === 'tendencias' ? (
        tendencias === null ? (
          <p className="t-chico t-3">Cargando las ganadoras…</p>
        ) : (
          <>
            <div className="img-bib__agregar">
              <Selector
                etiqueta="Agregar a"
                value={categoriaDestino}
                onChange={(e) => setDestino(e.target.value)}
                opciones={[...categorias.map((c) => ({ valor: c.id, etiqueta: c.nombre })), { valor: 'nueva', etiqueta: '+ Categoría nueva…' }]}
              />
              {categoriaDestino === 'nueva' ? <CampoTexto etiqueta="Nombre" placeholder="Ej.: Aguaje" value={nuevaCategoria} onChange={(e) => setNuevaCategoria(e.target.value)} maxLength={60} /> : null}
              <CampoTexto etiqueta="Marca" opcional placeholder="Ej.: Amua" value={marca} onChange={(e) => setMarca(e.target.value)} maxLength={60} />
              <Boton variante="secundario" icono={Upload} onClick={() => entrada.current?.click()} cargando={subiendo > 0}>
                Subir ganadoras
              </Boton>
              <input
                ref={entrada}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                hidden
                onChange={(e) => {
                  agregar(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
            <p className="t-chico t-3 img-bib__pegar">
              <ClipboardPaste size={13} strokeWidth={2} aria-hidden="true" /> También puedes pegar una imagen copiada con Ctrl+V (⌘V en Mac). Solo agrega anuncios que ya funcionaron.
            </p>
            {!tendencias.referencias.length ? (
              <EstadoVacio icono={Images} titulo="Todavía no hay ganadoras" descripcion="Sube o pega anuncios que ya te funcionaron (o que llevan tiempo activos) para usarlos como referencia." />
            ) : (
            <>
            <div className="img-bib__categorias" role="group" aria-label="Categorías">
              <Chip activo={categoria === 'todas'} onClick={() => setCategoria('todas')}>
                Todas
              </Chip>
              {tendencias.categorias.filter((c) => c.cuantas > 0).map((c) => (
                <Chip key={c.id} activo={categoria === c.id} onClick={() => setCategoria(c.id)}>
                  {c.nombre} ({c.cuantas})
                </Chip>
              ))}
            </div>
            <p className="t-chico t-3">
              Solo ganadoras: más de 100.000 personas alcanzadas o activas hace 30 días o más en Meta{tendencias.fecha ? ` (TrendTrack, ${tendencias.fecha})` : ''}, y las que agregas tú. Al usarlas, la IA hace tu versión: nunca copia la marca, el producto ni los textos.
            </p>
            <ul className="img-bib__lista" aria-label="Referencias de tendencia">
              {tendencias.referencias
                .filter((r) => categoria === 'todas' || r.categoria === categoria)
                .map((r) => {
                  const activa = elegidas.includes(r.id);
                  return (
                    <li key={r.id} className={`img-bib__item${activa ? ' img-bib__item--activa' : ''}`}>
                      <button type="button" className="img-bib__elegir" onClick={() => alternar(r.id)} aria-pressed={activa} aria-label={`${activa ? 'Quitar' : 'Elegir'}: ${r.marca || 'tuya'}`}>
                        <img src={r.miniatura} alt="" loading="lazy" draggable="false" />
                        {activa ? (
                          <span className="img-bib__marca" aria-hidden="true">
                            <Check size={14} strokeWidth={3} />
                          </span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        className={`img-bib__borrar${porBorrar === r.id ? ' img-bib__borrar--confirmar' : ''}`}
                        onClick={() => borrarGanadora(r.id)}
                        onBlur={() => setPorBorrar((x) => (x === r.id ? null : x))}
                        aria-label={porBorrar === r.id ? 'Toca otra vez para borrarla' : 'Borrar esta ganadora'}
                        title={porBorrar === r.id ? 'Toca otra vez para borrarla' : 'Borrar esta ganadora'}
                      >
                        {porBorrar === r.id ? '¿Borrar?' : <Trash2 size={13} strokeWidth={2.2} aria-hidden="true" />}
                      </button>
                      <span className="img-bib__pie" title={r.marca || 'Tuya'}>
                        {r.propia ? (r.marca ? `${r.marca} · tuya` : 'Tuya') : `${r.marca} · ${r.alcance >= 100000 ? `${Math.round(r.alcance / 1000)} mil de alcance` : `${r.dias} días activa`}`}
                      </span>
                    </li>
                  );
                })}
            </ul>
            </>
            )}
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

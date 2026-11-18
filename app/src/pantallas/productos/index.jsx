// PRODUCTOS (#/productos, 2026-11-18u): todo lo generado, organizado por producto, y unir los que son el mismo.
//   1. «Parecen el mismo producto»: los que tienen el mismo nombre (aunque cambie el orden o las mayúsculas), para
//      unirlos en uno con un toque (GET /api/organizar-productos).
//   2. Cada producto con sus videos, lotes de imágenes, investigación e inversión; al abrirlo, lo generado.
//   3. «Unir»: elige dos o más productos y con cuál te quedas (POST /api/organizar-productos/unir). Nada se borra.
import { useMemo, useState } from 'react';
import { Check, ChevronDown, Clapperboard, Combine, Images, Package, Telescope } from 'lucide-react';
import { Boton, CabeceraPagina, Esqueleto, EstadoVacio, Modal, useAvisos } from '../../componentes/index.js';
import { invalidar, miniatura, pedirNuevo, useAnuncios, useDatos } from '../../datos/api.js';
import { useLotes } from '../../datos/imagenes.js';
import { useInvestigaciones } from '../../datos/investigacion.js';
import { enlace } from '../../datos/rutas.js';
import { dinero, fechaRelativa, plural } from '../../datos/formato.js';
import './productos.css';

const useProductos = () => useDatos('productos:lista', () => pedirNuevo('/api/productos'));
const useRepetidos = () => useDatos('productos:repetidos', () => pedirNuevo('/api/organizar-productos'));
const useInversion = () => useDatos('inversion', () => pedirNuevo('/api/inversion'));

const INVESTIGACION = { lista: 'Investigación lista', investigando: 'Investigando', error: 'Investigación con error' };

function Foto({ url, chica }) {
  return <span className={`pr-foto${chica ? ' pr-foto--chica' : ''}`}>{url ? <img src={miniatura(url, 120)} alt="" loading="lazy" /> : <Package size={chica ? 14 : 18} aria-hidden="true" />}</span>;
}

/** Elige con cuál quedarse y los une. */
function ModalUnir({ abierto, productos, sugerido, onCerrar, onUnido }) {
  const [principal, setPrincipal] = useState(sugerido);
  const [uniendo, setUniendo] = useState(false);
  const { aviso } = useAvisos();
  const elegido = productos.some((p) => p.id === principal) ? principal : productos[0]?.id;
  const unir = async () => {
    setUniendo(true);
    try {
      const r = await pedirNuevo('/api/organizar-productos/unir', { metodo: 'POST', cuerpo: { principal: elegido, otros: productos.map((p) => p.id).filter((id) => id !== elegido) } });
      for (const k of ['productos:', 'anuncios', 'imagen-ads', 'investigacion', 'inversion', 'dashboard']) invalidar(k);
      aviso({ tipo: 'ok', titulo: 'Productos unidos', texto: `Ahora es uno solo${r.archivos ? `, con ${plural(r.archivos, 'generación', 'generaciones')} juntas` : ''}.` });
      onUnido();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude unirlos', texto: e.message });
    } finally {
      setUniendo(false);
    }
  };
  return (
    <Modal
      abierto={abierto}
      onCerrar={uniendo ? () => {} : onCerrar}
      titulo="Unir en un solo producto"
      descripcion="Todo lo generado pasa al que elijas. Los demás se guardan aparte, sin borrarse."
      icono={Combine}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={uniendo}>
            Cancelar
          </Boton>
          <Boton variante="primario" icono={Combine} onClick={unir} cargando={uniendo} disabled={uniendo || productos.length < 2}>
            Unir {productos.length}
          </Boton>
        </>
      }
    >
      <div className="pr-elegir" role="radiogroup" aria-label="Con cuál te quedas">
        {productos.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={elegido === p.id} className={`pr-elegir__op${elegido === p.id ? ' pr-elegir__op--activa' : ''}`} onClick={() => setPrincipal(p.id)}>
            <Foto url={p.foto} />
            <span className="pr-elegir__textos">
              <span className="pr-elegir__nombre">{p.nombre}</span>
              <span className="pr-elegir__meta">
                {plural(p.total ?? p.usos ?? 0, 'generación', 'generaciones')} · creado {fechaRelativa(p.creado)}
                {p.investigacion === 'lista' ? ' · con investigación' : ''}
              </span>
            </span>
            {elegido === p.id ? <Check size={16} className="pr-elegir__marca" aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
    </Modal>
  );
}

function Generado({ p }) {
  if (!p.videos.length && !p.lotes.length) return <p className="pr-vacio">Todavía no hay nada generado.</p>;
  return (
    <div className="pr-generado">
      {p.videos.length ? (
        <div>
          <h3 className="pr-generado__titulo">
            <Clapperboard size={13} aria-hidden="true" /> Videos
          </h3>
          <div className="pr-rejilla pr-rejilla--videos">
            {p.videos.map((a) => (
              <a key={a.slug} href={enlace.anuncio(a.slug)} className="pr-pieza" title={a.titulo}>
                {a.miniatura ? <img src={miniatura(a.miniatura, 240)} alt="" loading="lazy" /> : null}
                <span className="pr-pieza__texto">{a.estiloNombre || a.titulo}</span>
              </a>
            ))}
          </div>
        </div>
      ) : null}
      {p.lotes.length ? (
        <div>
          <h3 className="pr-generado__titulo">
            <Images size={13} aria-hidden="true" /> Anuncios de imagen
          </h3>
          <div className="pr-rejilla pr-rejilla--lotes">
            {p.lotes.map((l) => (
              <a key={l.lote} href={enlace.loteImagenes(l.lote)} className="pr-pieza pr-pieza--cuadrada" title={l.titulo}>
                {l.portada ? <img src={miniatura(l.portada, 240)} alt="" loading="lazy" /> : null}
                <span className="pr-pieza__texto">{l.listas ? plural(l.listas, 'imagen', 'imágenes') : 'Sin imágenes'}</span>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Productos() {
  const productos = useProductos();
  const repetidos = useRepetidos();
  const anuncios = useAnuncios();
  const lotes = useLotes();
  const investigaciones = useInvestigaciones();
  const inversion = useInversion();
  const [abierto, setAbierto] = useState(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [elegidos, setElegidos] = useState([]);
  const [unir, setUnir] = useState(null); // { productos, sugerido }

  const lista = useMemo(() => {
    const inv = new Map((investigaciones.datos?.productos || []).map((i) => [i.id, i.estado]));
    const dolares = new Map((inversion.datos?.productos || []).map((p) => [p.id, p.dolares]));
    const videos = (anuncios.datos?.anuncios || []).filter((a) => !a.modoPrueba);
    return (productos.datos?.productos || []).map((p) => {
      const v = videos.filter((a) => a.productoId === p.id);
      const l = (lotes.datos?.lotes || []).filter((x) => x.productoId === p.id);
      return { ...p, videos: v, lotes: l, total: v.length + l.length, investigacion: inv.get(p.id) || null, dolares: dolares.get(p.id) || 0 };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }) || b.total - a.total); // (los del mismo nombre, juntos)
  }, [productos.datos, anuncios.datos, lotes.datos, investigaciones.datos, inversion.datos]);
  const porId = new Map(lista.map((p) => [p.id, p]));
  const grupos = (repetidos.datos?.repetidos || []).map((g) => g.map((x) => ({ ...x, ...(porId.get(x.id) || {}) })));
  const recargar = () => {
    productos.recargar();
    repetidos.recargar();
    anuncios.recargar?.();
    lotes.recargar?.();
    inversion.recargar();
  };

  if (productos.cargando && !productos.datos) {
    return (
      <div className="pagina pr">
        <Esqueleto ancho={200} alto={28} />
        <Esqueleto ancho="100%" alto={260} />
      </div>
    );
  }
  if (!lista.length) {
    return (
      <div className="pagina pagina--angosta">
        <EstadoVacio icono={Package} titulo="Todavía no tienes productos" descripcion="Se crean solos cuando haces tu primer anuncio." />
      </div>
    );
  }

  const alternar = (id) => setElegidos((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));

  return (
    <div className="pagina pr">
      <CabeceraPagina
        titulo="Productos"
        descripcion="Todo lo que generaste, por producto."
        acciones={
          eligiendo ? (
            <div className="pr-acciones">
              <Boton variante="secundario" onClick={() => (setEligiendo(false), setElegidos([]))}>
                Cancelar
              </Boton>
              <Boton variante="primario" icono={Combine} disabled={elegidos.length < 2} onClick={() => setUnir({ productos: elegidos.map((id) => porId.get(id)).filter(Boolean), sugerido: elegidos[0] })}>
                Unir {elegidos.length >= 2 ? elegidos.length : ''}
              </Boton>
            </div>
          ) : (
            <Boton variante="secundario" icono={Combine} onClick={() => setEligiendo(true)}>
              Unir productos
            </Boton>
          )
        }
      />

      {grupos.length && !eligiendo ? (
        <section className="pr-repetidos" aria-label="Parecen el mismo producto">
          {grupos.map((g) => (
            <div key={g.map((x) => x.id).join()} className="pr-repetido">
              <div className="pr-repetido__fotos" aria-hidden="true">
                {g.slice(0, 4).map((x) => (
                  <Foto key={x.id} url={x.foto} chica />
                ))}
              </div>
              <div className="pr-repetido__texto">
                <strong>{g.length} productos «{g.find((x) => x.sugerido)?.nombre || g[0].nombre}»</strong>
                <span>Parecen el mismo: únelos y todo queda junto.</span>
              </div>
              <Boton variante="primario" tamano="chico" icono={Combine} onClick={() => setUnir({ productos: g, sugerido: g.find((x) => x.sugerido)?.id })}>
                Unir
              </Boton>
            </div>
          ))}
        </section>
      ) : null}

      {eligiendo ? <p className="pr-nota">Toca los productos que son el mismo (dos o más).</p> : null}

      <div className="pr-lista">
        {lista.map((p) => {
          const abiertoEste = abierto === p.id && !eligiendo;
          const marcado = elegidos.includes(p.id);
          return (
            <section key={p.id} className={`pr-producto${marcado ? ' pr-producto--marcado' : ''}`}>
              <button
                type="button"
                className="pr-producto__cabeza"
                aria-expanded={eligiendo ? undefined : abiertoEste}
                aria-pressed={eligiendo ? marcado : undefined}
                onClick={() => (eligiendo ? alternar(p.id) : setAbierto(abiertoEste ? null : p.id))}
              >
                {eligiendo ? <span className={`pr-check${marcado ? ' pr-check--si' : ''}`}>{marcado ? <Check size={13} strokeWidth={3} /> : null}</span> : null}
                <Foto url={p.foto} />
                <span className="pr-producto__textos">
                  <span className="pr-producto__nombre">{p.nombre}</span>
                  <span className="pr-producto__meta">
                    <span>{plural(p.videos.length, 'video', 'videos')}</span>
                    <span>{plural(p.lotes.length, 'lote', 'lotes')}</span>
                    {p.investigacion && INVESTIGACION[p.investigacion] ? <span className={`pr-etiqueta pr-etiqueta--${p.investigacion}`}>{INVESTIGACION[p.investigacion]}</span> : null}
                  </span>
                </span>
                <span className="pr-producto__dinero t-num">{p.dolares ? dinero(p.dolares) : ''}</span>
                {eligiendo ? null : <ChevronDown size={16} className={`pr-producto__flecha${abiertoEste ? ' pr-producto__flecha--abierta' : ''}`} aria-hidden="true" />}
              </button>
              {abiertoEste ? (
                <div className="pr-producto__cuerpo">
                  <div className="pr-producto__atajos">
                    <Boton variante="secundario" tamano="chico" icono={Clapperboard} href={enlace.nuevo({ producto: p.id })}>
                      Nuevo video
                    </Boton>
                    <Boton variante="secundario" tamano="chico" icono={Images} href={enlace.crearImagenes({ producto: p.id })}>
                      Anuncios de imagen
                    </Boton>
                    <Boton variante="secundario" tamano="chico" icono={Telescope} href={enlace.investigacion(p.id)}>
                      Investigación
                    </Boton>
                  </div>
                  <Generado p={p} />
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      {unir ? (
        <ModalUnir
          abierto
          productos={unir.productos}
          sugerido={unir.sugerido}
          onCerrar={() => setUnir(null)}
          onUnido={() => {
            setUnir(null);
            setEligiendo(false);
            setElegidos([]);
            recargar();
          }}
        />
      ) : null}
    </div>
  );
}

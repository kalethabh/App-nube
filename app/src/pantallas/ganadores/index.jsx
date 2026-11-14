// MEJORES ANUNCIOS (#/ganadores): anuncios de Meta que están funcionando ahora, buscados en TrendTrack con el
// conector de la cuenta de Claude del usuario (server/lib/ganadores.js). Desde cada uno:
//   - «Adaptar a mi producto» (video): se baja y abre Nuevo anuncio con ese video como referencia para clonar.
//   - «Guardar»: queda en la pestaña Guardados (mis_archivos/ganadores/guardados.json).
//   - Ver el copy, la transcripción y la landing.
// Cada búsqueda gasta créditos de TrendTrack (1,5 por anuncio): la misma búsqueda se guarda 12 horas y sale gratis.
import { useMemo, useState } from 'react';
import { Bookmark, BookmarkCheck, Copy, ExternalLink, Film, History, Image as IconoImagen, RefreshCw, Search, Sparkles, Trophy, Wand2 } from 'lucide-react';
import { Boton, CabeceraPagina, CampoTexto, Chip, EsqueletoMiniaturas, EstadoVacio, Interruptor, Pestanas, Selector, useAvisos } from '../../componentes/index.js';
import { invalidar } from '../../datos/api.js';
import { ir, rutas } from '../../datos/rutas.js';
import { PAIS, agruparPorMarca, ganadores, miles, resumenFiltros, useGanadores } from './datos.js';
import './ganadores.css';

const PAISES_PRINCIPALES = ['CO', 'EC', 'GT', 'MX', 'PE', 'CL', 'AR', 'US'];
const FILTROS_INICIALES = { paises: ['CO'], idioma: 'es', texto: '', buscarEn: 'ad_copy', nichos: [], formato: '', diasMin: 14, orden: 'escalando', unoPorMarca: true, cantidad: 12 };
const DIAS = [0, 7, 14, 30, 60, 90];
const CANTIDADES = [6, 12, 20];

function leerFiltros() {
  try {
    const f = JSON.parse(localStorage.getItem('ganadores-filtros') || 'null');
    return f && typeof f === 'object' ? { ...FILTROS_INICIALES, ...f } : FILTROS_INICIALES;
  } catch {
    return FILTROS_INICIALES;
  }
}
function recordarFiltros(f) {
  try {
    localStorage.setItem('ganadores-filtros', JSON.stringify(f));
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

const fechaCorta = (iso) => (iso ? new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const alternar = (lista, v) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

export default function Ganadores() {
  const { datos, cargando, recargar } = useGanadores();
  const { aviso } = useAvisos();
  const [pestana, setPestana] = useState('buscar');
  const [filtros, setFiltrosCrudo] = useState(leerFiltros);
  const [resultado, setResultado] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState(null);

  const opciones = datos?.opciones;
  const guardados = datos?.guardados || [];
  const idsGuardados = useMemo(() => new Set(guardados.map((a) => a.id)), [guardados]);
  const creditos = resultado?.creditos || datos?.creditos || null;
  const porAnuncio = opciones?.creditosPorAnuncio || 1.5;
  const setFiltros = (cambio) =>
    setFiltrosCrudo((f) => {
      const nuevo = { ...f, ...cambio };
      recordarFiltros(nuevo);
      return nuevo;
    });

  const buscar = async ({ forzar = false } = {}) => {
    if (!filtros.paises.length) return setError('Elige al menos un país.');
    setBuscando(true);
    setError(null);
    try {
      const r = await ganadores.buscar(filtros, { forzar });
      setResultado(r);
      invalidar('ganadores');
      recargar();
      if (!r.anuncios.length) aviso({ tipo: 'info', titulo: 'Sin resultados', texto: 'Prueba con menos filtros o con otra palabra.' });
    } catch (e) {
      setError(e.message);
    } finally {
      setBuscando(false);
    }
  };

  const abrirReciente = async (clave) => {
    setError(null);
    try {
      const r = await ganadores.busqueda(clave);
      setResultado(r);
      setFiltros(r.filtros);
      setPestana('buscar');
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude abrir esa búsqueda', texto: e.message });
    }
  };

  const alternarGuardado = async (a) => {
    try {
      if (idsGuardados.has(a.id)) await ganadores.quitar(a.id);
      else await ganadores.guardar(a);
      invalidar('ganadores');
      recargar();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No se pudo guardar', texto: e.message });
    }
  };

  const costoMax = Math.ceil(filtros.cantidad * porAnuncio);
  const vista = pestana === 'guardados' ? guardados : resultado?.anuncios || [];

  return (
    <div className="pagina gan">
      <CabeceraPagina
        titulo="Mejores anuncios"
        descripcion="Anuncios de Meta que están funcionando ahora, sacados de TrendTrack con los filtros que elijas. Adapta uno a tu producto o guárdalo de referencia."
        extra={
          creditos?.restantes != null ? (
            <div className="gan__creditos">
              <Chip tamano="chico" tono="cian" icono={Sparkles}>
                TrendTrack: {miles(creditos.restantes)} créditos
              </Chip>
            </div>
          ) : null
        }
      />

      <Pestanas
        items={[
          { id: 'buscar', etiqueta: 'Buscar', icono: Search, contador: resultado?.anuncios?.length || undefined },
          { id: 'guardados', etiqueta: 'Guardados', icono: Bookmark, contador: guardados.length },
        ]}
        activa={pestana}
        onCambio={setPestana}
      />

      {pestana === 'buscar' ? (
        <>
          <Filtros filtros={filtros} setFiltros={setFiltros} opciones={opciones} />
          <div className="gan__accion">
            <Boton variante="primario" icono={Search} onClick={() => buscar()} cargando={buscando} disabled={cargando && !datos}>
              {buscando ? 'Buscando en TrendTrack…' : 'Buscar'}
            </Boton>
            <p className="gan__nota">
              Gasta hasta {costoMax} créditos de TrendTrack ({porAnuncio.toLocaleString('es-CO')} por anuncio)
              {creditos?.restantes != null ? `; te quedan ${miles(creditos.restantes)}` : ''}. Si ya buscaste lo mismo en las últimas 12 horas, sale gratis.
            </p>
          </div>
          {error ? <p className="gan__error">{error}</p> : null}
          {datos?.recientes?.length ? (
            <div className="gan__recientes">
              <span className="gan__recientes-titulo">
                <History size={14} aria-hidden="true" /> Búsquedas recientes
              </span>
              {datos.recientes.map((r) => (
                <Chip key={r.clave} tamano="chico" activo={resultado?.clave === r.clave} onClick={() => abrirReciente(r.clave)} title={fechaCorta(r.fecha)}>
                  {resumenFiltros(r.filtros, opciones?.nichos)} · {r.cantidad}
                </Chip>
              ))}
            </div>
          ) : null}
          {resultado ? (
            <div className="gan__cabecera-resultados">
              <span>
                {resultado.anuncios.length} anuncios · {resumenFiltros(resultado.filtros, opciones?.nichos)} · {resultado.desdeCache ? `guardada el ${fechaCorta(resultado.fecha)} (gratis)` : 'recién buscada'}
                {resultado.simulado ? ' · simulados (modo prueba)' : ''}
              </span>
              {resultado.desdeCache ? (
                <Boton variante="fantasma" tamano="chico" icono={RefreshCw} onClick={() => buscar({ forzar: true })} cargando={buscando}>
                  Actualizar ({costoMax} créditos)
                </Boton>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {buscando && !resultado ? (
        <EsqueletoMiniaturas cantidad={6} min={240} />
      ) : vista.length ? (
        <Rejilla anuncios={vista} agrupar={pestana === 'buscar' && (resultado?.filtros?.unoPorMarca ?? true)} idsGuardados={idsGuardados} onGuardar={alternarGuardado} />
      ) : pestana === 'guardados' ? (
        <EstadoVacio icono={Bookmark} titulo="Todavía no guardas ninguno" descripcion="Toca «Guardar» en un anuncio para tenerlo a mano como referencia." />
      ) : !resultado && !buscando ? (
        <EstadoVacio
          icono={Trophy}
          titulo="Busca lo que está funcionando"
          descripcion="Elige el país, el nicho o una palabra de tu producto y toca «Buscar». Los que llevan más días activos o más duplicados son los que sus dueños están escalando."
        />
      ) : null}
    </div>
  );
}

function Filtros({ filtros, setFiltros, opciones }) {
  const otros = (opciones?.paises || []).filter((p) => !PAISES_PRINCIPALES.includes(p));
  return (
    <section className="gan-filtros" aria-label="Filtros">
      <div className="gan-filtros__fila">
        <span className="gan-filtros__etiqueta">Países</span>
        <div className="gan-filtros__chips">
          {PAISES_PRINCIPALES.map((p) => (
            <Chip key={p} tamano="chico" activo={filtros.paises.includes(p)} onClick={() => setFiltros({ paises: alternar(filtros.paises, p) })}>
              {PAIS[p] || p}
            </Chip>
          ))}
          {filtros.paises
            .filter((p) => !PAISES_PRINCIPALES.includes(p))
            .map((p) => (
              <Chip key={p} tamano="chico" activo onClick={() => setFiltros({ paises: alternar(filtros.paises, p) })}>
                {PAIS[p] || p}
              </Chip>
            ))}
          {otros.length ? (
            <select className="gan-filtros__otro" value="" onChange={(e) => e.target.value && setFiltros({ paises: [...new Set([...filtros.paises, e.target.value])] })} aria-label="Otro país">
              <option value="">Otro país…</option>
              {otros.map((p) => (
                <option key={p} value={p}>
                  {PAIS[p] || p}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      <div className="gan-filtros__rejilla">
        <CampoTexto etiqueta="Palabra o producto" opcional placeholder="drenaje linfático, contra entrega…" value={filtros.texto} onChange={(e) => setFiltros({ texto: e.target.value })} icono={Search} maxLength={120} />
        <Selector
          etiqueta="Buscar en"
          value={filtros.buscarEn}
          onChange={(e) => setFiltros({ buscarEn: e.target.value })}
          opciones={[
            { valor: 'ad_copy', etiqueta: 'El texto del anuncio' },
            { valor: 'brand', etiqueta: 'El nombre de la marca' },
            { valor: 'domain', etiqueta: 'La página (dominio)' },
          ]}
        />
        <Selector etiqueta="Ordenar por" value={filtros.orden} onChange={(e) => setFiltros({ orden: e.target.value })} opciones={(opciones?.ordenes || []).map((o) => ({ valor: o.id, etiqueta: o.texto }))} />
        <Selector etiqueta="Activo hace al menos" value={String(filtros.diasMin)} onChange={(e) => setFiltros({ diasMin: Number(e.target.value) })} opciones={DIAS.map((d) => ({ valor: String(d), etiqueta: d ? `${d} días` : 'Sin mínimo' }))} />
        <Selector etiqueta="Cuántos traer" value={String(filtros.cantidad)} onChange={(e) => setFiltros({ cantidad: Number(e.target.value) })} opciones={CANTIDADES.map((n) => ({ valor: String(n), etiqueta: `${n} anuncios` }))} />
      </div>

      <div className="gan-filtros__fila">
        <span className="gan-filtros__etiqueta">Formato</span>
        <div className="gan-filtros__chips">
          {[
            { v: '', t: 'Todos' },
            { v: 'video', t: 'Video', i: Film },
            { v: 'image', t: 'Imagen', i: IconoImagen },
          ].map((o) => (
            <Chip key={o.v || 'todos'} tamano="chico" icono={o.i} activo={filtros.formato === o.v} onClick={() => setFiltros({ formato: o.v })}>
              {o.t}
            </Chip>
          ))}
        </div>
      </div>

      {opciones?.nichos?.length ? (
        <div className="gan-filtros__fila">
          <span className="gan-filtros__etiqueta">Nicho</span>
          <div className="gan-filtros__chips">
            {opciones.nichos.map((n) => (
              <Chip key={n.id} tamano="chico" activo={filtros.nichos.includes(n.id)} onClick={() => setFiltros({ nichos: alternar(filtros.nichos, n.id) })}>
                {n.nombre}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      <Interruptor
        tamano="chico"
        activado={filtros.unoPorMarca}
        onCambio={(v) => setFiltros({ unoPorMarca: v })}
        etiqueta="Uno por marca"
        descripcion="Las versiones del mismo anunciante se juntan en una sola tarjeta."
      />
    </section>
  );
}

function Rejilla({ anuncios, agrupar, idsGuardados, onGuardar }) {
  const [abiertos, setAbiertos] = useState(() => new Set());
  const grupos = useMemo(() => (agrupar ? agruparPorMarca(anuncios) : anuncios.map((a) => ({ clave: a.id, lista: [a] }))), [anuncios, agrupar]);
  return (
    <div className="gan-rejilla">
      {grupos.flatMap((g) => {
        const visibles = abiertos.has(g.clave) ? g.lista : g.lista.slice(0, 1);
        return visibles.map((a, i) => (
          <TarjetaAnuncio
            key={a.id}
            a={a}
            guardado={idsGuardados.has(a.id)}
            onGuardar={() => onGuardar(a)}
            variantes={i === 0 && g.lista.length > 1 ? { cuantas: g.lista.length - 1, abiertas: abiertos.has(g.clave), alternar: () => setAbiertos((s) => {
              const n = new Set(s);
              if (n.has(g.clave)) n.delete(g.clave);
              else n.add(g.clave);
              return n;
            }) } : null}
          />
        ));
      })}
    </div>
  );
}

function TarjetaAnuncio({ a, guardado, onGuardar, variantes }) {
  const { aviso } = useAvisos();
  const [adaptando, setAdaptando] = useState(false);
  const [verTodo, setVerTodo] = useState(false);

  const adaptar = async () => {
    setAdaptando(true);
    try {
      const r = await ganadores.adaptar(a);
      aviso({ tipo: 'ok', titulo: 'Video listo como referencia', texto: 'Elige tu producto y el estilo: la IA clona la estructura de este anuncio.' });
      ir(rutas.nuevo({ inicio: '1', referencia: r.valor }));
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude preparar el video', texto: e.message });
    } finally {
      setAdaptando(false);
    }
  };
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText([a.copy, a.transcripcion ? `\nTranscripción:\n${a.transcripcion}` : ''].filter(Boolean).join('\n'));
      aviso({ tipo: 'ok', titulo: 'Copiado', texto: 'El texto del anuncio quedó en el portapapeles.' });
    } catch {
      aviso({ tipo: 'error', titulo: 'No se pudo copiar' });
    }
  };

  return (
    <article className="gan-tarjeta">
      <div className="gan-tarjeta__medio">
        {a.tipo === 'video' && a.media ? (
          <video src={a.media} poster={a.miniatura || undefined} controls muted playsInline preload="none" referrerPolicy="no-referrer" />
        ) : a.media || a.miniatura ? (
          <img src={a.media || a.miniatura} alt={`Anuncio de ${a.anunciante.nombre}`} loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <div className="gan-tarjeta__sin-medio">{a.tipo === 'imagen' ? <IconoImagen size={28} /> : <Film size={28} />}</div>
        )}
      </div>
      <div className="gan-tarjeta__cuerpo">
        <div className="gan-tarjeta__marca">
          {a.anunciante.logo ? <img src={a.anunciante.logo} alt="" loading="lazy" referrerPolicy="no-referrer" /> : null}
          <span className="gan-tarjeta__nombre" title={a.anunciante.nombre}>
            {a.anunciante.nombre}
          </span>
        </div>
        <div className="gan-tarjeta__datos">
          {a.dias != null ? <Chip tamano="chico" tono="cian">{a.dias} días activo</Chip> : null}
          {a.duplicados ? <Chip tamano="chico">{miles(a.duplicados)} duplicados</Chip> : null}
          {a.anunciante.activos ? <Chip tamano="chico">{miles(a.anunciante.activos)} anuncios de la marca</Chip> : null}
          {variantes ? (
            <Chip tamano="chico" tono="acento" activo={variantes.abiertas} onClick={variantes.alternar}>
              {variantes.abiertas ? 'Ocultar variantes' : `+${variantes.cuantas} variantes`}
            </Chip>
          ) : null}
        </div>
        {a.copy ? <p className={`gan-tarjeta__copy${verTodo ? ' gan-tarjeta__copy--todo' : ''}`}>{a.copy}</p> : null}
        {a.transcripcion && verTodo ? (
          <div className="gan-tarjeta__transcripcion">
            <strong>Lo que dice</strong>
            <p>{a.transcripcion}</p>
          </div>
        ) : null}
        {(a.copy && a.copy.length > 180) || a.transcripcion ? (
          <button type="button" className="gan-tarjeta__mas" onClick={() => setVerTodo((v) => !v)}>
            {verTodo ? 'Ver menos' : a.transcripcion ? 'Ver todo y lo que dice' : 'Ver todo'}
          </button>
        ) : null}
        {a.landing ? (
          <a className="gan-tarjeta__landing" href={a.landing} target="_blank" rel="noreferrer noopener">
            <ExternalLink size={13} aria-hidden="true" /> {a.dominio || 'Ver la página'}
          </a>
        ) : null}
        <div className="gan-tarjeta__acciones">
          {a.tipo === 'video' && a.media ? (
            <Boton variante="primario" tamano="chico" icono={Wand2} onClick={adaptar} cargando={adaptando}>
              Adaptar a mi producto
            </Boton>
          ) : a.media ? (
            <Boton variante="secundario" tamano="chico" icono={ExternalLink} href={a.media} target="_blank" rel="noreferrer noopener">
              Abrir imagen
            </Boton>
          ) : null}
          <Boton variante={guardado ? 'secundario' : 'fantasma'} tamano="chico" icono={guardado ? BookmarkCheck : Bookmark} onClick={onGuardar}>
            {guardado ? 'Guardado' : 'Guardar'}
          </Boton>
          {a.copy || a.transcripcion ? <Boton variante="fantasma" tamano="chico" soloIcono icono={Copy} etiqueta="Copiar el texto" onClick={copiar} /> : null}
        </div>
      </div>
    </article>
  );
}

// INSPIRACIÓN (#/inspiracion; #/ganadores lleva aquí también): anuncios de Meta que están funcionando, como en Starpop.
// Tres FUENTES (2026-11-17n), con las mismas tarjetas, filtros, formato y sonido, guardados y Replicar:
//   «Meta (oficial)»  la Biblioteca de anuncios con la API de Meta (gratis; SOLO lo que se mostró en Europa)
//   «Desde Chrome»    lo que guardaste con el botón «Guardar en Kads» de la extensión (también Latinoamérica)
//   «TrendTrack»      lo de siempre (con créditos) A la izquierda las marcas que sigues; arriba Todo / Video / Imagen, Guardados, desde cuándo y el orden;
// los chips de FORMATO y SONIDO (con cuántos hay de cada uno entre los cargados) y la rejilla de tarjetas.
//
// Créditos de TrendTrack: cada página de 20 anuncios gasta ~30 (1,5 por anuncio) y se guarda 12 horas. Antes de buscar
// se ve el costo; lo ya buscado se abre solo y gratis; «Cargar más» trae la página siguiente solo cuando se toca.
// El formato y el sonido salen del texto (gratis) y de tu IA mirando la miniatura (la cuota de tu plan, una sola vez
// por anuncio): server/lib/inspiracion.js.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, ChevronDown, Globe, KeyRound, Lightbulb, Puzzle, RefreshCw, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { Boton, CabeceraPagina, CampoTexto, Chip, EsqueletoMiniaturas, EstadoVacio, Interruptor, Pestanas, Selector, useAvisos } from '../../componentes/index.js';
import { invalidar, useEstilos } from '../../datos/api.js';
import { ir, rutas } from '../../datos/rutas.js';
import { Detalles } from './Detalles.jsx';
import { Marcas } from './Marcas.jsx';
import { Tarjeta } from './Tarjeta.jsx';
import { BotonChrome } from './BotonChrome.jsx';
import { useFuenteChrome, useFuenteMeta, useMediosMeta } from './fuentes.js';
import { FUENTES, PAIS, PAIS_UE, contar, filtrosConMarca, ganadores, inspiracion, miles, pedidoParaAgregar, useGanadores, useInspiracion } from './datos.js';
import './inspiracion.css';

const PAISES_PRINCIPALES = ['CO', 'EC', 'GT', 'MX', 'PE', 'CL', 'AR', 'US'];
const FILTROS_INICIALES = { paises: ['CO'], idioma: 'es', texto: '', buscarEn: 'ad_copy', nichos: [], formato: '', diasMin: 30, orden: 'alcance', rango: 0, unoPorMarca: false, cantidad: 20, soloValidados: true, paisesMeta: ['ES'], textoMeta: '' };
const PAISES_UE_PRINCIPALES = ['ES', 'PT', 'FR', 'IT', 'DE', 'GB'];
const RANGOS = [
  { valor: '0', etiqueta: 'Todo el tiempo' },
  { valor: '7', etiqueta: 'Salieron en los últimos 7 días' },
  { valor: '30', etiqueta: 'Últimos 30 días' },
  { valor: '90', etiqueta: 'Últimos 90 días' },
];
const DIAS = [0, 7, 14, 30, 60, 90];
const GRUPOS = [
  { id: '', texto: 'Todos' },
  { id: 'animacion', texto: 'Animación' },
  { id: 'realista', texto: 'Realista' },
];

const leer = (clave, porDefecto) => {
  try {
    const v = JSON.parse(localStorage.getItem(clave) || 'null');
    return v ?? porDefecto;
  } catch {
    return porDefecto;
  }
};
const recordar = (clave, v) => {
  try {
    localStorage.setItem(clave, JSON.stringify(v));
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
};
const alternar = (lista, v) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);
const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

export default function Inspiracion() {
  const { aviso } = useAvisos();
  const g = useGanadores();
  const ins = useInspiracion();
  const { datos: estilosDatos } = useEstilos();
  const opciones = g.datos?.opciones;
  const formatos = ins.datos?.formatos || [];
  const sonidos = ins.datos?.sonidos || [];
  const marcas = ins.datos?.marcas || [];
  const guardados = g.datos?.guardados || [];
  const idsGuardados = useMemo(() => new Set(guardados.map((a) => a.id)), [guardados]);
  const idsMarcas = useMemo(() => new Set(marcas.map((m) => m.id)), [marcas]);
  const metaInfo = ins.datos?.meta || null;

  // ---------------------------------------------------------------- de dónde salen los anuncios
  const [fuente, setFuenteCrudo] = useState(() => (FUENTES.some((f) => f.id === leer('inspiracion-fuente', 'meta')) ? leer('inspiracion-fuente', 'meta') : 'meta'));
  const setFuente = (f) => {
    setFuenteCrudo(f);
    recordar('inspiracion-fuente', f);
    setVista('feed');
  };
  const [chromeAbierto, setChromeAbierto] = useState(false);
  const angosta = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)').matches;

  // ---------------------------------------------------------------- lo que va a TrendTrack
  const [filtros, setFiltrosCrudo] = useState(() => ({ ...FILTROS_INICIALES, ...leer('inspiracion-filtros', {}) }));
  const setFiltros = (cambio) =>
    setFiltrosCrudo((f) => {
      const n = { ...f, ...cambio };
      recordar('inspiracion-filtros', n);
      return n;
    });
  const [marca, setMarca] = useState(null);
  const efectivos = useMemo(() => filtrosConMarca(filtros, marca), [filtros, marca]);
  const firma = JSON.stringify(efectivos);
  const [paginas, setPaginas] = useState([]); // [{ pagina, r }]
  const [costo, setCosto] = useState(null); // { enCache, creditos }
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState(null);
  const firmaActual = useRef(firma);
  firmaActual.current = firma;

  const cargar = useCallback(
    async (pagina, { forzar = false } = {}) => {
      const deFirma = firmaActual.current;
      setBuscando(true);
      setError(null);
      try {
        const r = await ganadores.buscar({ ...JSON.parse(deFirma), pagina }, { forzar });
        if (firmaActual.current !== deFirma) return; // cambiaron los filtros mientras tanto
        setPaginas((ps) => [...ps.filter((p) => p.pagina !== pagina && p.pagina < pagina), { pagina, r }]);
        if (!r.desdeCache) {
          invalidar('ganadores');
          invalidar('inspiracion');
          g.recargar();
          ins.recargar();
        }
      } catch (e) {
        if (firmaActual.current === deFirma) setError(e.message);
      } finally {
        setBuscando(false);
      }
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // con otros filtros: de cero; si eso ya se buscó (caché de 12 h), se abre solo y gratis
  useEffect(() => {
    setPaginas([]);
    setCosto(null);
    setError(null);
    if (fuente !== 'trendtrack') return undefined;
    let vivo = true;
    inspiracion
      .costo(efectivos)
      .then((c) => {
        if (!vivo) return;
        setCosto(c);
        if (c.enCache) cargar(1);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [firma, fuente]); // eslint-disable-line react-hooks/exhaustive-deps

  const cargados = useMemo(() => {
    const vistos = new Set();
    return paginas.flatMap((p) => p.r.anuncios).filter((a) => !vistos.has(a.id) && vistos.add(a.id));
  }, [paginas]);
  const ultima = paginas[paginas.length - 1]?.r || null;
  const total = ultima?.total ?? null;
  const hayMas = ultima && (ultima.recibidos ?? ultima.anuncios.length) >= (ultima.filtros?.cantidad || efectivos.cantidad) && (total == null || cargados.length < total);
  const creditosBusqueda = costo?.creditos ?? Math.ceil(efectivos.cantidad * (opciones?.creditosPorAnuncio || 1.5));
  const creditos = ultima?.creditos || g.datos?.creditos || null;

  // ---------------------------------------------------------------- formato y sonido
  const [iaAuto, setIaAuto] = useState(() => leer('inspiracion-ia', true) !== false);
  const [clasif, setClasif] = useState({});
  const [estadoIA, setEstadoIA] = useState(null);
  const [vista, setVista] = useState('feed'); // 'feed' | 'guardados'
  const meta = useFuenteMeta({ activa: fuente === 'meta', filtros, marca });
  const chrome = useFuenteChrome({ activa: fuente === 'chrome' });
  const medios = useMediosMeta();
  const deChrome = marca ? chrome.anuncios.filter((a) => (marca.pagina && a.anunciante.pagina === marca.pagina) || a.anunciante.nombre === marca.nombre) : chrome.anuncios;
  const delFeed = fuente === 'meta' ? meta.anuncios : fuente === 'chrome' ? deChrome : cargados;
  const base = (vista === 'guardados' ? guardados : delFeed).map(medios.conMedio);
  // (con la miniatura que llega de Meta, la IA ya puede mirar ese anuncio)
  const idsBase = base.map((a) => `${a.id}${a.miniatura ? '+' : ''}`).join(',');
  useEffect(() => {
    if (!base.length) return undefined;
    let vivo = true;
    let timer = null;
    const pedir = (iniciar) =>
      inspiracion
        .clasificar(base, iniciar)
        .then((r) => {
          if (!vivo) return;
          setClasif((c) => ({ ...c, ...r.clasif }));
          setEstadoIA(r.estado);
          if (r.estado?.corriendo) timer = setTimeout(() => pedir(false), 3000);
        })
        .catch(() => {});
    pedir(iaAuto);
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, [idsBase, iaAuto]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- lo que se ve (filtros de la pantalla, gratis)
  const [medio, setMedio] = useState('todo');
  const [grupo, setGrupo] = useState('');
  const [formatoSel, setFormatoSel] = useState('');
  const [sonidoSel, setSonidoSel] = useState('');
  const porMedio = base.filter((a) => medio === 'todo' || (medio === 'video' ? a.tipo === 'video' : a.tipo === 'imagen'));
  const enGrupo = (a) => !grupo || formatos.find((f) => f.id === clasif[a.id]?.formato)?.grupo === grupo;
  const cuentaFormatos = contar(porMedio.filter((a) => !sonidoSel || (sonidoSel === '_sin' ? !clasif[a.id]?.sonido : clasif[a.id]?.sonido === sonidoSel)), clasif, 'formato');
  const cuentaGrupos = { animacion: 0, realista: 0 };
  for (const f of formatos) cuentaGrupos[f.grupo] += cuentaFormatos[f.id] || 0;
  const pasaFormato = (a) => enGrupo(a) && (!formatoSel || (formatoSel === '_sin' ? !clasif[a.id]?.formato : clasif[a.id]?.formato === formatoSel));
  const cuentaSonidos = contar(porMedio.filter(pasaFormato), clasif, 'sonido');
  const visibles = porMedio.filter((a) => pasaFormato(a) && (!sonidoSel || (sonidoSel === '_sin' ? !clasif[a.id]?.sonido : clasif[a.id]?.sonido === sonidoSel)));
  const cuentaMedio = { todo: base.length, video: base.filter((a) => a.tipo === 'video').length, imagen: base.filter((a) => a.tipo === 'imagen').length };
  const formatosVisibles = formatos.filter((f) => !grupo || f.grupo === grupo);

  // ---------------------------------------------------------------- acciones
  const [detalle, setDetalle] = useState(null);
  const [replicando, setReplicando] = useState(null);

  const alternarGuardado = async (a) => {
    try {
      if (idsGuardados.has(a.id)) await ganadores.quitar(a.id);
      // (de Meta se guarda sin la dirección del video, que vence: se vuelve a sacar al mirarlo)
      else await ganadores.guardar(a.fuente === 'meta' ? { ...a, media: null, miniatura: null, medioPendiente: true } : a);
      invalidar('ganadores');
      g.recargar();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No se pudo guardar', texto: e.message });
    }
  };
  const copiar = async (a) => {
    try {
      await navigator.clipboard.writeText([a.titulo, a.copy, a.transcripcion ? `\nLo que dice:\n${a.transcripcion}` : ''].filter(Boolean).join('\n'));
      aviso({ tipo: 'ok', titulo: 'Copiado', texto: 'El texto del anuncio quedó en el portapapeles.' });
    } catch {
      aviso({ tipo: 'error', titulo: 'No se pudo copiar' });
    }
  };
  const replicar = async (a) => {
    setReplicando(a.id);
    try {
      if (a.tipo === 'video' && a.media) {
        const r = await ganadores.adaptar(a);
        const pedido = pedidoParaAgregar(clasif[a.id]?.formato, formatos, estilosDatos?.estilos || []);
        aviso({ tipo: 'ok', titulo: 'Video listo', texto: 'Se abre «Agregar» con este video: elige tu producto y di lo que quieres.' });
        ir(rutas.nuevo({ inicio: '1', estilo: 'agregar', referencia: r.valor, ...(pedido ? { pedido } : {}) }));
      } else {
        const r = await inspiracion.replicarImagen(a);
        aviso({ tipo: 'ok', titulo: 'Imagen lista', texto: 'Se abre Anuncios de imagen con esta imagen como referencia.' });
        ir(rutas.crearImagenes({ referencia: r.url }));
      }
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude prepararlo', texto: e.message });
    } finally {
      setReplicando(null);
    }
  };
  const marcaDe = (a) => ({ nombre: a.anunciante.nombre, pagina: a.anunciante.pagina, logo: a.anunciante.logo, activos: a.anunciante.activos, dominio: a.dominio });
  const idMarca = (a) => (a.anunciante.pagina ? `p${a.anunciante.pagina}` : null);
  const verMarca = (a) => {
    const seguida = marcas.find((m) => m.id === idMarca(a));
    setMarca(seguida || { id: idMarca(a) || `n-${a.anunciante.nombre}`, ...marcaDe(a), dominio: null });
    setVista('feed');
    setDetalle(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const alternarSeguir = async (a) => {
    try {
      const id = idMarca(a);
      if (id && idsMarcas.has(id)) await inspiracion.dejar(id);
      else await inspiracion.seguir(marcaDe(a));
      invalidar('inspiracion');
      ins.recargar();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No se pudo', texto: e.message });
    }
  };
  const elegirMarca = (m) => {
    setMarca(m);
    setVista('feed');
  };
  const borrarDeChrome = async (a) => {
    try {
      await inspiracion.borrarChrome(a.id);
      aviso({ tipo: 'ok', titulo: 'Borrado', texto: 'Ya no está en «Desde Chrome».' });
      chrome.recargar();
      invalidar('inspiracion');
      ins.recargar();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No se pudo borrar', texto: e.message });
    }
  };

  const [masFiltros, setMasFiltros] = useState(false);
  const iaTexto = estadoIA?.corriendo
    ? `Tu IA está mirando ${estadoIA.enFila ? `${estadoIA.enFila + 1}+ ` : ''}anuncios para reconocer su formato…`
    : estadoIA?.error
      ? `Tu IA no pudo reconocer formatos: ${estadoIA.error}`
      : null;
  const sinMirar = base.filter((a) => !clasif[a.id]?.mirado && (a.miniatura || a.tipo === 'imagen')).length;

  return (
    <div className="pagina insp">
      <CabeceraPagina
        titulo="Inspiración"
        descripcion="Creativos ya validados de otras tiendas en Meta (activos hace 30 días o más): de la Biblioteca de anuncios oficial, de tu Chrome o de TrendTrack. Filtra por formato y sonido, sigue marcas y replica el que te guste para tu producto."
        extra={
          <div className="insp__creditos">
            {fuente === 'trendtrack' && creditos?.restantes != null ? (
              <Chip tamano="chico" tono="cian" icono={Sparkles}>
                TrendTrack: te quedan {miles(creditos.restantes)} créditos
              </Chip>
            ) : null}
            <Boton variante="secundario" tamano="chico" icono={Puzzle} onClick={() => setChromeAbierto(true)}>
              Botón de Chrome
            </Boton>
          </div>
        }
      />

      <div className="insp__cuerpo">
        <Marcas
          misMarcas={ins.datos?.misMarcas || []}
          marcas={marcas}
          activa={marca}
          onElegir={elegirMarca}
          onCambio={() => {
            invalidar('inspiracion');
            ins.recargar();
          }}
        />

        <div className="insp__principal">
          {/* ------------------------------------------------ de dónde salen */}
          <div className="insp-fuentes">
            <span className="insp-chips__etiqueta">Fuente</span>
            <Pestanas
              variante="segmentado"
              tamano={angosta ? 'chico' : 'normal'}
              etiqueta="De dónde salen los anuncios"
              items={FUENTES.map((f) => ({ ...f, etiqueta: angosta ? f.corta : f.etiqueta, contador: f.id === 'chrome' ? (fuente === 'chrome' ? chrome.anuncios.length : ins.datos?.chrome?.cantidad) : undefined }))}
              activa={fuente}
              onCambio={setFuente}
            />
          </div>
          {fuente === 'meta' ? (
            <p className="insp-nota-fuente">
              <Globe size={14} aria-hidden="true" />
              <span>
                La API oficial de Meta solo entrega anuncios que se mostraron en <strong>Europa</strong> (Unión Europea y Reino Unido). Los que corren solo en Latinoamérica no salen aquí:
                guárdalos con el{' '}
                <button type="button" className="insp-enlace" onClick={() => setChromeAbierto(true)}>
                  botón de Chrome
                </button>{' '}
                y los ves en «Desde Chrome».
              </span>
            </p>
          ) : null}
          {fuente === 'meta' && metaInfo && !metaInfo.conToken ? null : fuente === 'meta' ? (
            <form
              className="insp-meta-buscar"
              onSubmit={(e) => {
                e.preventDefault();
                setFiltros({ textoMeta: String(new FormData(e.currentTarget).get('q') || '').trim().slice(0, 100) });
                setMarca(null);
              }}
            >
              <CampoTexto name="q" aria-label="Buscar en la Biblioteca de anuncios de Meta" placeholder="Busca una palabra: colágeno, drenaje, contra entrega…" defaultValue={filtros.textoMeta} key={filtros.textoMeta} icono={Search} maxLength={100} />
              <Boton type="submit" variante="primario" icono={Search} cargando={meta.buscando}>
                Buscar en Meta
              </Boton>
            </form>
          ) : null}
          {/* ------------------------------------------------ arriba: medio, guardados, desde cuándo y orden */}
          <div className="insp-barra">
            <Pestanas
              variante="segmentado"
              tamano="chico"
              etiqueta="Tipo de anuncio"
              items={[
                { id: 'todo', etiqueta: 'Todo', contador: cuentaMedio.todo },
                { id: 'video', etiqueta: 'Video', contador: cuentaMedio.video },
                { id: 'imagen', etiqueta: 'Imagen', contador: cuentaMedio.imagen },
              ]}
              activa={medio}
              onCambio={setMedio}
            />
            <Chip icono={Bookmark} activo={vista === 'guardados'} contador={guardados.length} onClick={() => setVista((v) => (v === 'guardados' ? 'feed' : 'guardados'))}>
              Guardados
            </Chip>
            <div className="insp-barra__selectores">
              {fuente === 'trendtrack' ? (
                <>
                  <Selector aria-label="Desde cuándo" value={String(filtros.rango)} onChange={(e) => setFiltros({ rango: Number(e.target.value) })} opciones={RANGOS} />
                  <Selector
                    aria-label="Ordenar por"
                    value={filtros.orden}
                    onChange={(e) => setFiltros({ orden: e.target.value })}
                    opciones={(opciones?.ordenes || []).map((o) => ({ valor: o.id, etiqueta: `Orden: ${o.texto}` }))}
                  />
                </>
              ) : null}
              <Boton variante={masFiltros ? 'secundario' : 'fantasma'} tamano="chico" icono={SlidersHorizontal} iconoDerecha={ChevronDown} onClick={() => setMasFiltros((v) => !v)} aria-expanded={masFiltros}>
                Más filtros
              </Boton>
            </div>
          </div>

          {masFiltros ? <MasFiltros fuente={fuente} filtros={filtros} setFiltros={setFiltros} opciones={opciones} iaAuto={iaAuto} setIaAuto={(v) => { setIaAuto(v); recordar('inspiracion-ia', v); }} /> : null}

          {marca && vista === 'feed' ? (
            <div className="insp-marca-activa">
              Anuncios de <strong>{marca.nombre}</strong> ({fuente === 'meta' ? 'en Europa' : fuente === 'chrome' ? 'los que guardaste' : 'en todos los países'})
              <Boton variante="fantasma" tamano="chico" soloIcono icono={X} etiqueta="Ver todas las marcas" onClick={() => setMarca(null)} />
            </div>
          ) : null}

          {/* ------------------------------------------------ FORMATO y SONIDO */}
          {base.length ? (
            <section className="insp-chips" aria-label="Formato y sonido">
              <div className="insp-chips__fila">
                <span className="insp-chips__etiqueta">Formato</span>
                <div className="insp-chips__lista">
                  {GRUPOS.map((x) => (
                    <Chip key={x.id || 'todos'} tamano="chico" activo={grupo === x.id} contador={x.id ? cuentaGrupos[x.id] : undefined} onClick={() => { setGrupo(x.id); setFormatoSel(''); }}>
                      {x.texto}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="insp-chips__fila">
                <span className="insp-chips__etiqueta" />
                <div className="insp-chips__lista">
                  <Chip tamano="chico" activo={!formatoSel} onClick={() => setFormatoSel('')}>
                    Todos
                  </Chip>
                  {formatosVisibles.map((f) => (
                    <Chip key={f.id} tamano="chico" activo={formatoSel === f.id} contador={cuentaFormatos[f.id] || 0} onClick={() => setFormatoSel(formatoSel === f.id ? '' : f.id)} className={!cuentaFormatos[f.id] ? 'insp-chip--cero' : ''}>
                      {f.nombre}
                    </Chip>
                  ))}
                  {!grupo ? (
                    <Chip tamano="chico" activo={formatoSel === '_sin'} contador={cuentaFormatos._sin} onClick={() => setFormatoSel(formatoSel === '_sin' ? '' : '_sin')}>
                      Sin dato
                    </Chip>
                  ) : null}
                </div>
              </div>
              <div className="insp-chips__fila">
                <span className="insp-chips__etiqueta">Sonido</span>
                <div className="insp-chips__lista">
                  <Chip tamano="chico" activo={!sonidoSel} onClick={() => setSonidoSel('')}>
                    Todos
                  </Chip>
                  {sonidos.map((s) => (
                    <Chip key={s.id} tamano="chico" activo={sonidoSel === s.id} contador={cuentaSonidos[s.id] || 0} onClick={() => setSonidoSel(sonidoSel === s.id ? '' : s.id)} className={!cuentaSonidos[s.id] ? 'insp-chip--cero' : ''}>
                      {s.nombre}
                    </Chip>
                  ))}
                  <Chip tamano="chico" activo={sonidoSel === '_sin'} contador={cuentaSonidos._sin} onClick={() => setSonidoSel(sonidoSel === '_sin' ? '' : '_sin')}>
                    Sin dato
                  </Chip>
                </div>
              </div>
              <p className="insp-chips__nota">
                Los números son de {vista === 'guardados' ? `tus ${base.length} guardados` : `los ${base.length} cargados`}, no de todo {fuente === 'trendtrack' ? 'TrendTrack' : fuente === 'meta' ? 'Meta' : 'lo guardado'}.
                {iaTexto ? <span className="insp-chips__ia"> {iaTexto}</span> : null}
                {!estadoIA?.corriendo && !iaAuto && sinMirar ? (
                  <button type="button" className="insp-enlace" onClick={() => { setIaAuto(true); recordar('inspiracion-ia', true); }}>
                    Reconocer el formato de {sinMirar} con mi IA
                  </button>
                ) : null}
              </p>
            </section>
          ) : null}

          {/* ------------------------------------------------ resumen y buscar */}
          {vista === 'feed' && fuente === 'meta' ? (
            <ResumenMeta meta={meta} conToken={metaInfo?.conToken !== false} />
          ) : vista === 'feed' && fuente === 'chrome' ? (
            <div className="insp-resumen">
              <span>
                <strong>{miles(chrome.anuncios.length)}</strong> guardados desde Chrome
                {chrome.quitados.tuyos ? ` · no muestro ${chrome.quitados.tuyos} de tus marcas` : ''}
                {' · '}lo que guardas aparece aquí solo, con su video o su imagen.
              </span>
            </div>
          ) : vista === 'feed' ? (
            <div className="insp-resumen">
              {paginas.length ? (
                <span>
                  <strong>{miles(cargados.length)}</strong> anuncios cargados
                  {total != null ? ` de ~${miles(total)} en TrendTrack` : ''}
                  {(() => {
                    // lo que no se muestra: tus marcas y, con «Solo validados», lo que todavía no probó nada
                    const q = paginas.reduce((acc, p) => ({ tuyos: acc.tuyos + (p.r.quitados?.tuyos || 0), sinValidar: acc.sinValidar + (p.r.quitados?.sinValidar || 0) }), { tuyos: 0, sinValidar: 0 });
                    const partes = [q.tuyos ? `${q.tuyos} de tus marcas` : '', q.sinValidar ? `${q.sinValidar} sin validar` : ''].filter(Boolean);
                    return partes.length ? ` · no muestro ${partes.join(' ni ')}` : '';
                  })()}
                  {ultima?.simulado ? ' · simulados (modo prueba)' : paginas[0].r.desdeCache ? ` · guardada el ${fechaHora(paginas[0].r.fecha)} (gratis)` : ' · recién buscada'}
                </span>
              ) : (
                <span>
                  {costo ? (costo.enCache ? 'Abriendo lo que ya buscaste (gratis)…' : `Buscar esto en TrendTrack gasta ~${miles(creditosBusqueda)} créditos (1,5 por anuncio).`) : ' '}
                  {creditos?.restantes != null && !costo?.enCache ? ` Te quedan ${miles(creditos.restantes)}.` : ''}
                </span>
              )}
              {!paginas.length && costo && !costo.enCache ? (
                <Boton variante="primario" icono={Search} onClick={() => cargar(1)} cargando={buscando}>
                  {buscando ? 'Buscando en TrendTrack…' : `Buscar · ~${miles(creditosBusqueda)} créditos`}
                </Boton>
              ) : paginas.length && paginas[0].r.desdeCache && !ultima?.simulado ? (
                <Boton variante="fantasma" tamano="chico" icono={RefreshCw} onClick={() => { setPaginas([]); cargar(1, { forzar: true }); }} cargando={buscando}>
                  Actualizar (~{miles(creditosBusqueda)} créditos)
                </Boton>
              ) : null}
            </div>
          ) : null}
          {fuente === 'trendtrack' && error ? <p className="insp__error">{error}</p> : null}
          {fuente === 'meta' && meta.error && vista === 'feed' ? <p className="insp__error">{meta.error}</p> : null}
          {fuente === 'chrome' && chrome.error && vista === 'feed' ? <p className="insp__error">{chrome.error}</p> : null}

          {/* ------------------------------------------------ la rejilla */}
          {vista === 'feed' && ((fuente === 'trendtrack' && buscando && !paginas.length) || (fuente === 'meta' && meta.buscando && !meta.paginas.length) || (fuente === 'chrome' && chrome.cargando)) ? (
            <EsqueletoMiniaturas cantidad={8} min={240} />
          ) : visibles.length ? (
            <div className="insp-rejilla">
              {visibles.map((a) => (
                <Tarjeta
                  key={a.id}
                  a={a}
                  c={clasif[a.id]}
                  formatos={formatos}
                  sonidos={sonidos}
                  guardado={idsGuardados.has(a.id)}
                  onGuardar={() => alternarGuardado(a)}
                  onReplicar={() => replicar(a)}
                  replicando={replicando === a.id}
                  onCopiar={() => copiar(a)}
                  onDetalles={() => setDetalle(a)}
                  onMarca={() => verMarca(a)}
                  onPedirMedio={a.medioPendiente ? () => medios.pedir(a) : undefined}
                  onBorrar={a.fuente === 'chrome' && vista === 'feed' ? () => borrarDeChrome(a) : undefined}
                />
              ))}
            </div>
          ) : base.length ? (
            <EstadoVacio icono={SlidersHorizontal} titulo="Ninguno con esos filtros" descripcion="Prueba con otro formato o sonido: estos filtros solo miran lo que ya está cargado." />
          ) : vista === 'guardados' ? (
            <EstadoVacio icono={Bookmark} titulo="Todavía no guardas ninguno" descripcion="Toca el marcador de un anuncio para tenerlo a mano." />
          ) : fuente === 'meta' && metaInfo && !metaInfo.conToken ? (
            <EstadoVacio
              icono={KeyRound}
              titulo="Conecta la Biblioteca de anuncios de Meta"
              descripcion="Pega tu token de Meta en Ajustes › Conexiones (ahí están los pasos para sacarlo). Es gratis; Meta te pide verificar tu identidad una sola vez."
              acciones={
                <Boton variante="primario" icono={KeyRound} onClick={() => ir(rutas.ajustes())}>
                  Ir a Conexiones
                </Boton>
              }
            />
          ) : fuente === 'meta' ? (
            meta.buscando || meta.error ? null : (
              <EstadoVacio
                icono={Globe}
                titulo={meta.puedeBuscar ? 'Meta no devolvió anuncios con eso' : 'Busca en la Biblioteca de anuncios de Meta'}
                descripcion={
                  meta.puedeBuscar
                    ? 'Prueba con otra palabra, otros países de Europa o apaga «Solo creativos validados» en Más filtros. Recuerda: aquí solo salen anuncios que se mostraron en Europa.'
                    : 'Escribe una palabra arriba o elige una marca de la izquierda. Es gratis: no gasta créditos.'
                }
              />
            )
          ) : fuente === 'chrome' ? (
            chrome.cargando ? null : (
              <EstadoVacio
                icono={Puzzle}
                titulo="Todavía no guardas anuncios desde Chrome"
                descripcion="Instala el botón «Guardar en Kads» y tócalo en los anuncios que te gusten de la Biblioteca de anuncios de Meta: aparecen aquí con su video."
                acciones={
                  <Boton variante="primario" icono={Puzzle} onClick={() => setChromeAbierto(true)}>
                    Instalar el botón de Chrome
                  </Boton>
                }
              />
            )
          ) : !buscando && costo && !costo.enCache ? (
            <EstadoVacio
              icono={Lightbulb}
              titulo={marca ? `Mira los anuncios de ${marca.nombre}` : 'Busca lo que está funcionando'}
              descripcion="Elige el orden, desde cuándo y, en «Más filtros», el país, el nicho o una palabra. Después toca «Buscar»: verás el costo antes de gastar."
            />
          ) : null}

          {vista === 'feed' && fuente === 'meta' && meta.hayMas && visibles.length ? (
            <div className="insp-mas">
              <Boton variante="secundario" onClick={meta.cargarMas} cargando={meta.buscando}>
                Cargar más de Meta
              </Boton>
              <span>Gratis. Si Meta pide esperar, vuelve a tocarlo en unos minutos.</span>
            </div>
          ) : null}
          {vista === 'feed' && fuente === 'trendtrack' && hayMas && visibles.length ? (
            <div className="insp-mas">
              <Boton variante="secundario" onClick={() => cargar((paginas[paginas.length - 1]?.pagina || 1) + 1)} cargando={buscando}>
                Cargar {efectivos.cantidad} más · ~{miles(creditosBusqueda)} créditos
              </Boton>
              <span>Solo se gasta cuando lo tocas. Si ya la habías cargado, sale gratis.</span>
            </div>
          ) : null}
        </div>
      </div>

      <BotonChrome abierto={chromeAbierto} onCerrar={() => setChromeAbierto(false)} />

      <Detalles
        a={detalle ? medios.conMedio(detalle) : null}
        onPedirMedio={detalle?.medioPendiente ? () => medios.pedir(detalle) : undefined}
        c={detalle ? clasif[detalle.id] : null}
        formatos={formatos}
        sonidos={sonidos}
        abierto={Boolean(detalle)}
        onCerrar={() => setDetalle(null)}
        guardado={detalle ? idsGuardados.has(detalle.id) : false}
        onGuardar={() => alternarGuardado(detalle)}
        onReplicar={() => replicar(medios.conMedio(detalle))}
        replicando={detalle ? replicando === detalle.id : false}
        onCopiar={() => copiar(detalle)}
        siguiendo={detalle ? idsMarcas.has(idMarca(detalle)) : false}
        onSeguir={() => alternarSeguir(detalle)}
        onVerMarca={() => verMarca(detalle)}
      />
    </div>
  );
}

/** El resumen de «Meta (oficial)»: cuántos hay y lo que no se muestra. */
function ResumenMeta({ meta, conToken }) {
  if (!conToken) return null;
  const n = meta.anuncios.length;
  const q = meta.quitados;
  const partes = [q.tuyos ? `${q.tuyos} de tus marcas` : '', q.sinValidar ? `${q.sinValidar} sin validar` : ''].filter(Boolean);
  return (
    <div className="insp-resumen">
      <span>
        {meta.paginas.length ? (
          <>
            <strong>{miles(n)}</strong> anuncios de la Biblioteca de Meta
            {partes.length ? ` · no muestro ${partes.join(' ni ')}` : ''}
            {meta.ultima?.simulado ? ' · simulados (modo prueba)' : meta.paginas[0]?.desdeCache ? ` · guardada el ${fechaHora(meta.paginas[0].fecha)}` : ' · recién buscada'}
          </>
        ) : meta.buscando ? (
          'Buscando en la Biblioteca de anuncios de Meta…'
        ) : (
          ' '
        )}
      </span>
      {meta.paginas.length && meta.paginas[0]?.desdeCache && !meta.ultima?.simulado ? (
        <Boton variante="fantasma" tamano="chico" icono={RefreshCw} onClick={meta.actualizar} cargando={meta.buscando}>
          Actualizar (gratis)
        </Boton>
      ) : null}
    </div>
  );
}

function MasFiltros({ fuente, filtros, setFiltros, opciones, iaAuto, setIaAuto }) {
  const otros = (opciones?.paises || []).filter((p) => !PAISES_PRINCIPALES.includes(p));
  const interruptorIA = (
    <Interruptor
      tamano="chico"
      activado={iaAuto}
      onCambio={setIaAuto}
      etiqueta="Reconocer el formato con mi IA"
      descripcion="Tu IA mira la miniatura de cada anuncio una sola vez (usa tu plan de Claude o ChatGPT, no créditos)."
    />
  );
  if (fuente === 'chrome') {
    return (
      <section className="insp-filtros" aria-label="Más filtros">
        <div className="insp-filtros__interruptores">{interruptorIA}</div>
      </section>
    );
  }
  if (fuente === 'meta') {
    const paisesMeta = filtros.paisesMeta?.length ? filtros.paisesMeta : ['ES'];
    const otrosUE = Object.keys(PAIS_UE).filter((p) => !PAISES_UE_PRINCIPALES.includes(p));
    return (
      <section className="insp-filtros" aria-label="Más filtros">
        <div className="insp-chips__fila">
          <span className="insp-chips__etiqueta">Países</span>
          <div className="insp-chips__lista">
            {[...PAISES_UE_PRINCIPALES, ...paisesMeta.filter((p) => !PAISES_UE_PRINCIPALES.includes(p))].map((p) => (
              <Chip
                key={p}
                tamano="chico"
                activo={paisesMeta.includes(p)}
                onClick={() => {
                  const n = alternar(paisesMeta, p);
                  setFiltros({ paisesMeta: n.length ? n : [p] });
                }}
              >
                {PAIS_UE[p] || p}
              </Chip>
            ))}
            <select className="insp-filtros__otro" value="" onChange={(e) => e.target.value && setFiltros({ paisesMeta: [...new Set([...paisesMeta, e.target.value])].slice(0, 10) })} aria-label="Otro país de Europa">
              <option value="">Otro país de Europa…</option>
              {otrosUE.map((p) => (
                <option key={p} value={p}>
                  {PAIS_UE[p]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="insp-filtros__nota">Meta solo deja ver por su API los anuncios que se mostraron en la Unión Europea y Reino Unido.</p>
        <div className="insp-filtros__rejilla">
          <Selector
            etiqueta="Traer de Meta"
            value={filtros.formato}
            onChange={(e) => setFiltros({ formato: e.target.value })}
            opciones={[
              { valor: '', etiqueta: 'Videos e imágenes' },
              { valor: 'video', etiqueta: 'Solo videos' },
              { valor: 'image', etiqueta: 'Solo imágenes' },
            ]}
          />
          <Selector
            etiqueta="Idioma del anuncio"
            value={filtros.idioma}
            onChange={(e) => setFiltros({ idioma: e.target.value })}
            opciones={[
              { valor: 'es', etiqueta: 'Español' },
              { valor: 'en', etiqueta: 'Inglés' },
              { valor: 'pt', etiqueta: 'Portugués' },
            ]}
          />
        </div>
        <div className="insp-filtros__interruptores">
          <Interruptor
            tamano="chico"
            activado={filtros.soloValidados !== false}
            onCambio={(v) => setFiltros({ soloValidados: v })}
            etiqueta="Solo creativos validados"
            descripcion="Activos hace 30 días o más (o con más de 100.000 personas alcanzadas en Europa). Tus marcas nunca salen."
          />
          {interruptorIA}
        </div>
      </section>
    );
  }
  return (
    <section className="insp-filtros" aria-label="Más filtros">
      <div className="insp-chips__fila">
        <span className="insp-chips__etiqueta">Países</span>
        <div className="insp-chips__lista">
          <Chip tamano="chico" activo={!filtros.paises.length} onClick={() => setFiltros({ paises: [] })}>
            Todos
          </Chip>
          {[...PAISES_PRINCIPALES, ...filtros.paises.filter((p) => !PAISES_PRINCIPALES.includes(p))].map((p) => (
            <Chip key={p} tamano="chico" activo={filtros.paises.includes(p)} onClick={() => setFiltros({ paises: alternar(filtros.paises, p) })}>
              {PAIS[p] || p}
            </Chip>
          ))}
          {otros.length ? (
            <select className="insp-filtros__otro" value="" onChange={(e) => e.target.value && setFiltros({ paises: [...new Set([...filtros.paises, e.target.value])] })} aria-label="Otro país">
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
      {opciones?.nichos?.length ? (
        <div className="insp-chips__fila">
          <span className="insp-chips__etiqueta">Nicho</span>
          <div className="insp-chips__lista">
            {opciones.nichos.map((n) => (
              <Chip key={n.id} tamano="chico" activo={filtros.nichos.includes(n.id)} onClick={() => setFiltros({ nichos: alternar(filtros.nichos, n.id) })}>
                {n.nombre}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
      <div className="insp-filtros__rejilla">
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
        <Selector
          etiqueta="Activo hace al menos"
          value={String(filtros.soloValidados ? Math.max(30, filtros.diasMin) : filtros.diasMin)}
          onChange={(e) => setFiltros({ diasMin: Number(e.target.value) })}
          opciones={DIAS.map((d) => ({ valor: String(d), etiqueta: d ? `${d} días` : 'Sin mínimo', deshabilitada: filtros.soloValidados && d < 30 }))}
        />
        <Selector
          etiqueta="Traer de TrendTrack"
          value={filtros.formato}
          onChange={(e) => setFiltros({ formato: e.target.value })}
          opciones={[
            { valor: '', etiqueta: 'Videos e imágenes' },
            { valor: 'video', etiqueta: 'Solo videos' },
            { valor: 'image', etiqueta: 'Solo imágenes' },
          ]}
        />
      </div>
      <div className="insp-filtros__interruptores">
        <Interruptor
          tamano="chico"
          activado={filtros.soloValidados !== false}
          onCambio={(v) => setFiltros({ soloValidados: v, ...(v ? { diasMin: Math.max(30, filtros.diasMin) } : {}) })}
          etiqueta="Solo creativos validados"
          descripcion="Activos hace 30 días o más (o con más de 100.000 personas alcanzadas): los que ya probaron que venden. Tus marcas nunca salen."
        />
        <Interruptor tamano="chico" activado={filtros.unoPorMarca} onCambio={(v) => setFiltros({ unoPorMarca: v })} etiqueta="Uno por marca" descripcion="Un solo anuncio de cada marca en cada página (más variedad)." />
        <Interruptor
          tamano="chico"
          activado={iaAuto}
          onCambio={setIaAuto}
          etiqueta="Reconocer el formato con mi IA"
          descripcion="Tu IA mira la miniatura de cada anuncio una sola vez (usa tu plan de Claude o ChatGPT, no créditos de TrendTrack)."
        />
      </div>
    </section>
  );
}

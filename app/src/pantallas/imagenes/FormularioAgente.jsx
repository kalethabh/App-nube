// CREAR ANUNCIOS DE IMAGEN CON EL AGENTE (2026-11-20, «que todo lo haga el agente, ya no quiero plantillas»). Dos
// modos, los dos con el AGENTE DE VARIACIONES (la guía del usuario: .claude/skills/anuncios-imagen-ads/
// agente-variaciones.md), que analiza, arma la matriz de facetas, escribe los prompts con diseño limpio, genera una
// imagen por variación, la revisa (1/3/5 s y 10 puntos) y corrige:
//   referencia     subes o pegas tu anuncio ganador (o lo eliges de «Lo que me funciona») y hace las variaciones
//                  A cercanas, B conceptos vecinos y C expandidas, conservando lo que lo hace vender
//   investigacion  sin referencia: el ángulo sale de la investigación de mercado del producto (si no la tiene, la
//                  puedes lanzar desde aquí)
// Muestra el costo antes y arranca solo con tu sí. Lo usan «Crear anuncios de imagen» (#/imagenes/nuevo) y «Encargar»
// de la oficina. Servidor: POST /api/imagen-ads (agente: 'variaciones'), referencias, generar.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Briefcase, FileSearch, ImagePlus, Sparkles, Upload, X } from 'lucide-react';
import { AreaTexto, Boton, CampoTexto, Selector, useAvisos } from '../../componentes/index.js';
import { invalidar, pedirNuevo, useDatos } from '../../datos/api.js';
import { apiImagenes, CLAVE_LOTES } from '../../datos/imagenes.js';
import { enlace } from '../../datos/rutas.js';

const CANTIDADES = [3, 5, 8, 10];
// (2026-11-26a) «Qué tan distintas» (reemplaza «Replicar validado (exacto)» / «Variaciones del agente»)
const VARIACIONES = [
  { id: 'fieles', etiqueta: 'Fieles', texto: 'Tu anuncio tal cual: mismo diseño, letras, colores, oferta y ángulo. Solo cambian la modelo, el escenario, la pose y el titular. Para escalar algo que ya vende.' },
  { id: 'vecinas', etiqueta: 'Vecinas', texto: 'El mismo deseo que vende tu ganador, contado de otras formas: la mitad con su mismo ángulo y el resto con otros 3 o más, con formatos, escenas, modelos y cámaras distintos. Para probar sin que Meta las vea iguales.' },
  { id: 'conceptos', etiqueta: 'Conceptos nuevos', texto: 'Cada imagen es un concepto de formato distinto (captura, antes y después, producto protagonista, meme…) con la esencia de tu ganador. Para buscar el próximo ganador.' },
];
const dinero = (n) => `US$${(Math.round(n * 100) / 100).toFixed(2)}`;

/** El ganador elegido: de «Lo que me funciona» o un archivo subido/pegado. */
function Ganadores({ elegidos, setElegidos, productoId }) {
  const { datos } = useDatos('funcionan:imagen', () => pedirNuevo('/api/funcionan?tipo=imagen'));
  const subir = useRef(null);
  const items = useMemo(() => {
    const l = datos?.items || [];
    return [...l.filter((x) => x.productoId === productoId), ...l.filter((x) => x.productoId !== productoId)].slice(0, 24);
  }, [datos, productoId]);
  const agregar = (archivos) => {
    const nuevos = [...archivos].filter((f) => /^image\//.test(f.type)).slice(0, 5).map((f) => ({ id: `subido-${f.name}-${f.size}`, archivo: f, url: URL.createObjectURL(f), titulo: f.name }));
    setElegidos((l) => [...l, ...nuevos].slice(0, 5));
  };
  useEffect(() => {
    const alPegar = (e) => {
      const fs = [...(e.clipboardData?.files || [])];
      if (fs.length) agregar(fs);
    };
    window.addEventListener('paste', alPegar);
    return () => window.removeEventListener('paste', alPegar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const tiene = (x) => elegidos.some((y) => y.id === x.id);
  return (
    <div
      className="enc-ganadores"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        agregar(e.dataTransfer?.files || []);
      }}
    >
      {elegidos.length ? (
        <ul className="enc-elegidos">
          {elegidos.map((x) => (
            <li key={x.id}>
              <img src={x.url} alt="" />
              <button type="button" onClick={() => setElegidos((l) => l.filter((y) => y.id !== x.id))} aria-label="Quitar">
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="enc-subir">
        <button type="button" className="of-boton" onClick={() => subir.current?.click()}>
          <Upload size={14} aria-hidden="true" /> Subir tu anuncio de referencia
        </button>
        <span className="t-chico t-3">arrástralo aquí, pégalo (Cmd/Ctrl + V) o elige uno de «Lo que me funciona»:</span>
        <input ref={subir} type="file" accept="image/*" multiple hidden onChange={(e) => agregar(e.target.files || [])} />
      </div>
      {items.length ? (
        <ul className="enc-funciona">
          {items.map((x) => (
            <li key={x.id}>
              <button type="button" className={tiene(x) ? 'activo' : ''} aria-pressed={tiene(x)} onClick={() => setElegidos((l) => (tiene(x) ? l.filter((y) => y.id !== x.id) : [...l, { id: x.id, url: x.url, titulo: x.titulo, concepto: x.concepto || '', productoId: x.productoId }].slice(0, 5)))} title={x.titulo || x.concepto || ''}>
                <img src={x.url} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function FormularioAgente({ onListo, productoPedido = null, referenciaPedida = null, modoInicial = null }) {
  const { aviso } = useAvisos();
  const { datos, recargar } = useDatos('imagen-ads:productos', apiImagenes.productos);
  const { datos: opciones } = useDatos('imagen-ads:opciones', apiImagenes.opciones);
  const productos = (datos?.productos || []).filter((p) => p.fotos?.length);
  const [modo, setModo] = useState(modoInicial === 'investigacion' ? 'investigacion' : 'referencia');
  const [productoId, setProductoId] = useState(productoPedido || '');
  const [elegidos, setElegidos] = useState(() => (referenciaPedida ? [{ id: referenciaPedida, url: referenciaPedida, titulo: 'Referencia' }] : []));
  const [cantidad, setCantidad] = useState(5);
  // (2026-11-26a) QUÉ TAN DISTINTAS: fieles (antes «Replicar validado»), vecinas (por defecto) o conceptos nuevos
  const [variacion, setVariacion] = useState('vecinas');
  const replicar = variacion === 'fieles';
  // (2026-11-26a) lo de venta (opcional, se guarda con el producto): sellos exactos, el país del precio, prohibido decir
  const [sellos, setSellos] = useState('');
  const [paisPrecio, setPaisPrecio] = useState('');
  const [prohibido, setProhibido] = useState('');
  const [paises, setPaises] = useState([]);
  // (2026-11-21) MODO NUEVO DESDE 0: las 6 zonas y los 8 formatos (sin referencia)
  const [desde0, setDesde0] = useState(true);
  const [vertical, setVertical] = useState(false);
  const [pais, setPais] = useState('');
  const [publico, setPublico] = useState('');
  const [oferta, setOferta] = useState('');
  const [fase, setFase] = useState('');
  const [investigando, setInvestigando] = useState(false);
  const p = productos.find((x) => x.id === productoId) || null;
  useEffect(() => {
    if ((!productoId || !productos.some((x) => x.id === productoId)) && productos.length) setProductoId(productos[0].id);
  }, [productos, productoId]);
  useEffect(() => {
    const d = p?.ultimoLote?.datos || {};
    setPais(d.pais || p?.investigacion?.pais || 'Colombia');
    setPublico(d.publico || '');
    // lo de venta guardado con el producto
    if (!p?.id) return;
    let vivo = true;
    apiImagenes
      .ajustes(p.id)
      .then((r) => {
        if (!vivo) return;
        setPaises(Array.isArray(r?.paises) ? r.paises : []);
        const a = r?.ajustes || {};
        setOferta(a.oferta || '');
        setSellos((a.sellos || []).join('\n'));
        setPaisPrecio(a.pais || '');
        setProhibido((a.prohibido || []).join(', '));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const conInvestigacion = Boolean(p?.investigacion);
  const formatos = vertical ? ['1:1', '9:16'] : ['1:1'];
  const precio = opciones?.costo || null;
  const imagenes = cantidad * formatos.length;
  const costo = precio?.conChatGPT ? 0 : precio?.dolaresPorImagen ? Math.round(precio.dolaresPorImagen * imagenes * 100) / 100 : null;
  // («Vecinas» y «Conceptos»: la revisión rehace sola hasta 2 veces cada imagen que no aprueba; el máximo las cuenta)
  const rehace = modo === 'referencia' && !replicar;
  const costoMax = costo && rehace ? Math.round(precio.dolaresPorImagen * (imagenes + cantidad * 2) * 100) / 100 : costo;
  const falta = !p ? 'Elige tu producto.' : modo === 'referencia' && !elegidos.length ? 'Sube o elige tu anuncio de referencia.' : modo === 'investigacion' && !conInvestigacion ? 'Este producto todavía no tiene investigación de mercado.' : !pais.trim() ? 'Escribe el país.' : null;
  const listo = !falta && costo !== null && !fase;

  const investigar = async () => {
    setInvestigando(true);
    try {
      await pedirNuevo(`/api/investigacion/${encodeURIComponent(p.id)}`, { metodo: 'POST', cuerpo: { pais: pais.trim() || 'Colombia' } });
      aviso({ tipo: 'exito', titulo: 'Investigando tu mercado', texto: 'Tarda unos minutos. Cuando termine, vuelve aquí y crea tus anuncios desde ella.' });
      setTimeout(() => recargar?.(), 4000);
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude empezar la investigación', texto: e?.message || 'Vuelve a intentarlo.' });
    } finally {
      setInvestigando(false);
    }
  };

  const crear = async () => {
    try {
      setFase('Preparando');
      const archivos = [];
      if (modo === 'referencia') {
        for (const x of elegidos) {
          if (x.archivo) archivos.push(x.archivo);
          else {
            const r = await fetch(x.url);
            if (!r.ok) throw new Error('No pude leer uno de tus anuncios. Vuelve a intentarlo.');
            const b = await r.blob();
            archivos.push(new File([b], `referencia-${archivos.length + 1}.${b.type === 'image/png' ? 'png' : 'jpg'}`, { type: b.type || 'image/jpeg' }));
          }
        }
      }
      setFase('Creando el lote');
      const r = await apiImagenes.crear({
        productoId: p.id,
        fotoProducto: p.fotoSugerida || p.fotos[0].n,
        datos: { nombre: p.nombre, publico: publico.trim(), pais: pais.trim(), idioma: 'es', adicional: oferta.trim() ? `Oferta y condiciones (verificadas por el usuario): ${oferta.trim()}` : '' },
        cantidad,
        formatos,
        logo: null,
        modo: modo === 'referencia' ? 'variantes' : 'nuevos',
        ...(modo === 'referencia' ? { variacion, ...(replicar ? { replicar: true, rapido: true } : { rapido: false }) } : desde0 ? { desde0: true, rapido: false } : { agente: 'variaciones', rapido: false }),
        // lo de venta (se guarda con el producto)
        venta: { oferta: oferta.trim(), sellos: sellos.split(/\r?\n/).map((x) => x.trim()).filter(Boolean), pais: paisPrecio || null, prohibido: prohibido.split(/[,\n]/).map((x) => x.trim()).filter(Boolean) },
        fiel: modo === 'referencia',
        usarInvestigacion: true,
        ...(modo === 'referencia'
          ? {
              referenciasPropias: elegidos.map((x, i) => (x.productoId === p.id ? i + 1 : null)).filter(Boolean),
              conceptosReferencias: elegidos.map((x) => x.concepto || ''),
              refs: elegidos.map((x) => x.id),
            }
          : {}),
      });
      for (let i = 0; i < archivos.length; i++) {
        setFase(archivos.length > 1 ? `Subiendo la referencia ${i + 1} de ${archivos.length}` : 'Subiendo la referencia');
        await apiImagenes.subirReferencia(r.lote, i + 1, archivos[i]);
      }
      setFase('Pasándoselo al agente');
      await apiImagenes.generar(r.lote, costoMax, []);
      invalidar(CLAVE_LOTES);
      invalidar('oficina');
      aviso({ tipo: 'exito', titulo: modo === 'referencia' && replicar ? 'Replicando tu anuncio validado' : modo === 'referencia' ? 'Creando tus variaciones' : desde0 ? 'Creando tus anuncios desde 0' : 'El agente está trabajando', texto: modo === 'referencia' && replicar ? `${cantidad} réplicas exactas: cambian la modelo, el escenario, la pose y el titular.` : modo === 'referencia' ? `Primero tu IA analiza por qué vende tu ganador; después, ${cantidad} variaciones ${variacion === 'vecinas' ? 'vecinas' : 'con conceptos nuevos'}.` : `${cantidad} anuncios desde tu investigación.` });
      onListo?.(r.lote);
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude crearlos', texto: e?.message || 'Vuelve a intentarlo.' });
    } finally {
      setFase('');
    }
  };

  return (
    <div className="enc">
      <div className="enc-modos" role="radiogroup" aria-label="Cómo los hace el agente">
        <button type="button" role="radio" aria-checked={modo === 'referencia'} className={modo === 'referencia' ? 'activo' : ''} onClick={() => setModo('referencia')}>
          <ImagePlus size={18} aria-hidden="true" />
          <span>
            <strong>Con referencia</strong>
            <small>Subes un anuncio que te funciona y hace variaciones conservando lo que lo hace vender.</small>
          </span>
        </button>
        <button type="button" role="radio" aria-checked={modo === 'investigacion'} className={modo === 'investigacion' ? 'activo' : ''} onClick={() => setModo('investigacion')}>
          <FileSearch size={18} aria-hidden="true" />
          <span>
            <strong>Desde la investigación</strong>
            <small>Sin referencia: el ángulo, las facetas y los textos salen de la investigación de mercado de tu producto.</small>
          </span>
        </button>
      </div>
      <p className="enc-intro">
        <Sparkles size={15} aria-hidden="true" />
        <span>
          {modo === 'referencia'
            ? <>Primero tu IA <b>analiza por qué vende tu ganador</b> (el deseo, el dolor, el hook, lo que no se toca y lo que se puede probar) y te lo muestra. Después crea las variaciones con el nivel que elijas, las revisa una por una con nota del 1 al 10 y rehace sola las que fallan.</>
            : <>El <b>agente</b> lo hace todo: analiza tu investigación (el ángulo, lo que no se toca y lo que se puede probar), arma la matriz de facetas y crea anuncios cercanos, conceptos vecinos y expandidos, con diseño limpio, una imagen por anuncio y control de calidad. Cada uno sale con qué cambió y qué hipótesis prueba.</>}
        </span>
      </p>
      <section className="enc-paso">
        <h4>1. El producto</h4>
        {productos.length ? (
          <ul className="enc-productos">
            {productos.map((x) => (
              <li key={x.id}>
                <button type="button" className={x.id === productoId ? 'activo' : ''} aria-pressed={x.id === productoId} onClick={() => setProductoId(x.id)}>
                  <img src={x.fotos[0].url} alt="" />
                  <span>
                    {x.nombre}
                    {modo === 'investigacion' ? <small className={x.investigacion ? 'enc-ok' : 'enc-falta'}>{x.investigacion ? ' · con investigación' : ' · sin investigación'}</small> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="t-chico t-3">
            Primero crea tu producto en <a href={enlace.nuevo({})}>Nuevo anuncio</a> (paso 1).
          </p>
        )}
      </section>
      {modo === 'referencia' ? (
        <section className="enc-paso">
          <h4>2. Tu anuncio de referencia</h4>
          <Ganadores elegidos={elegidos} setElegidos={setElegidos} productoId={productoId} />
          <h4 className="enc-sub">Qué tan distintas</h4>
          <div className="enc-chips enc-replicar" role="radiogroup" aria-label="Qué tan distintas">
            {VARIACIONES.map((x) => (
              <button key={x.id} type="button" role="radio" aria-checked={variacion === x.id} className={variacion === x.id ? 'activo' : ''} onClick={() => setVariacion(x.id)}>
                {x.etiqueta}
              </button>
            ))}
          </div>
          <p className="t-chico t-3">{VARIACIONES.find((x) => x.id === variacion)?.texto}</p>
        </section>
      ) : (
        <section className="enc-paso">
          <h4>2. La investigación de mercado</h4>
          <div className="enc-chips enc-replicar" role="radiogroup" aria-label="Cómo crearlos">
            <button type="button" role="radio" aria-checked={desde0} className={desde0 ? 'activo' : ''} onClick={() => setDesde0(true)}>
              Desde 0 (6 zonas)
            </button>
            <button type="button" role="radio" aria-checked={!desde0} className={!desde0 ? 'activo' : ''} onClick={() => setDesde0(false)}>
              Variaciones del agente
            </button>
          </div>
          <p className="t-chico t-3">
            {desde0
              ? 'Cada anuncio con sus 6 zonas: gancho arriba, el visual principal, 2 o 3 beneficios con check, tu frasco con su sello, la oferta con «Pagas al recibir» y un solo botón. En formatos distintos (hero, antes y después, nosotros vs. ellos, testimonio, bodegón de ingredientes, recomendado, temporada y una pregunta y respuesta), sin repetir modelo ni escenario. Pon el precio del tratamiento en «Oferta».'
              : 'El agente arma la matriz de facetas desde tu investigación y prueba conceptos cercanos, vecinos y expandidos.'}
          </p>
          {!p ? null : conInvestigacion ? (
            <p className="enc-nota enc-nota--ok">
              <FileSearch size={14} aria-hidden="true" /> {p.nombre} tiene su investigación{p.investigacion?.pais ? ` (${p.investigacion.pais})` : ''}: el agente saca de ahí el deseo, las facetas, las objeciones y las palabras del cliente. <a href={enlace.investigacion(p.id)}>Verla</a>
            </p>
          ) : (
            <div className="enc-nota enc-nota--falta">
              <span>{p.nombre} todavía no tiene investigación de mercado. Hazla primero (tarda unos minutos y usa tu cuenta de Claude) o sube una referencia.</span>
              <Boton variante="secundario" tamano="chico" icono={FileSearch} onClick={investigar} cargando={investigando}>
                Hacer la investigación
              </Boton>
            </div>
          )}
        </section>
      )}
      <section className="enc-paso">
        <h4>3. Cuántos y en qué formato</h4>
        <div className="enc-chips">
          {CANTIDADES.map((n) => (
            <button key={n} type="button" className={n === cantidad ? 'activo' : ''} aria-pressed={n === cantidad} onClick={() => setCantidad(n)}>
              {n}
            </button>
          ))}
          <span className="enc-sep" />
          <button type="button" className={!vertical ? 'activo' : ''} aria-pressed={!vertical} onClick={() => setVertical(false)}>
            Cuadrado 1:1
          </button>
          <button type="button" className={vertical ? 'activo' : ''} aria-pressed={vertical} onClick={() => setVertical(true)}>
            1:1 + vertical 9:16
          </button>
        </div>
      </section>
      <section className="enc-paso enc-paso--datos">
        <CampoTexto etiqueta="País" maxLength={60} value={pais} onChange={(e) => setPais(e.target.value)} />
        <CampoTexto etiqueta="Público" opcional maxLength={300} value={publico} onChange={(e) => setPublico(e.target.value)} placeholder="Ej.: mujeres de 25 a 45" />
        <CampoTexto etiqueta="Oferta (va tal cual en el anuncio)" opcional maxLength={160} value={oferta} onChange={(e) => setOferta(e.target.value)} placeholder="Tratamiento completo x3 $139.900" />
        <Selector
          etiqueta="País del precio"
          opcional
          value={paisPrecio}
          onChange={(e) => setPaisPrecio(e.target.value)}
          opciones={[{ valor: '', etiqueta: 'El del campo País' }, ...paises.map((x) => ({ valor: x.codigo, etiqueta: x.nombre }))]}
        />
        <AreaTexto etiqueta="Sellos de confianza" opcional filas={2} maxLength={800} value={sellos} onChange={(e) => setSellos(e.target.value)} placeholder={'REGISTRO SANITARIO INVIMA …\nPago contra entrega'} ayuda="Uno por línea, exactos. No se inventa ningún otro." />
        <CampoTexto etiqueta="Prohibido decir" opcional maxLength={600} value={prohibido} onChange={(e) => setProhibido(e.target.value)} placeholder="cura, milagroso, garantizado" ayuda="Separado por comas." />
      </section>
      <div className="enc-pie">
        <span className="enc-costo">{falta ? <span className="enc-falta">{falta}</span> : costo === null ? 'Calculando el costo…' : costo === 0 ? `${imagenes} imágenes con tu ChatGPT: sin costo por imagen` : costoMax > costo ? `${imagenes} imágenes · ${dinero(costo)}, máximo ${dinero(costoMax)} si la revisión rehace alguna (${dinero(precio.dolaresPorImagen)} cada una)` : `${imagenes} imágenes · ${dinero(costo)} (${dinero(precio.dolaresPorImagen)} cada una)`}</span>
        <Boton variante="primario" icono={Briefcase} onClick={crear} cargando={Boolean(fase)} disabled={!listo}>
          {fase || (modo === 'referencia' && replicar ? (costo ? `Replicar · ${dinero(costo)}` : 'Replicar') : modo === 'referencia' ? (costo ? `Crear variaciones · hasta ${dinero(costoMax)}` : 'Crear variaciones') : desde0 ? (costo ? `Crear desde 0 · ${dinero(costo)}` : 'Crear desde 0') : costo ? `Crear con el agente · ${dinero(costo)}` : 'Crear con el agente')}
        </Boton>
      </div>
    </div>
  );
}

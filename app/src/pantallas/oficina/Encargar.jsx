// ENCARGAR TRABAJO DESDE LA OFICINA (2026-11-20, «que todo lo pueda hacer, literal como una oficina»): tocas un
// departamento, «Encargar», y en un solo cuadro le pasas el trabajo a su equipo. Lo encargado se ve enseguida
// avanzando por su cadena de producción.
//
//   imagen          «Variaciones de un anuncio ganador» con el AGENTE DE VARIACIONES (el prompt maestro del usuario:
//                   .claude/skills/anuncios-imagen-ads/agente-variaciones.md): el ganador (de «Lo que me funciona» o
//                   subido/pegado), el producto, cuántas y el formato. Muestra el costo antes y arranca solo con tu sí.
//   investigacion   el producto y el país (la de mercado y la de la competencia, de una).
//   video           se lo pides a la coordinadora (chat) o lo armas en «Nuevo anuncio».
// Servidor: los mismos de siempre (POST /api/imagen-ads, referencias, generar; POST /api/investigacion/:id).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Briefcase, ImagePlus, MessageCircle, Sparkles, Upload, X } from 'lucide-react';
import { Boton, CampoTexto, Modal, useAvisos } from '../../componentes/index.js';
import { invalidar, pedirNuevo, useDatos } from '../../datos/api.js';
import { apiImagenes } from '../../datos/imagenes.js';
import { enlace } from '../../datos/rutas.js';

const CANTIDADES = [3, 5, 8, 10];
const dinero = (n) => `US$${(Math.round(n * 100) / 100).toFixed(2)}`;

/** El ganador elegido: de «Lo que me funciona» o un archivo subido/pegado. */
function Ganadores({ elegidos, setElegidos, productoId }) {
  const { datos } = useDatos('funcionan:imagen', () => pedirNuevo('/api/funcionan?tipo=imagen'));
  const subir = useRef(null);
  const items = useMemo(() => {
    const l = datos?.items || [];
    return [...l.filter((x) => x.productoId === productoId), ...l.filter((x) => x.productoId !== productoId)].slice(0, 18);
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
    <div className="enc-ganadores">
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
          <Upload size={14} aria-hidden="true" /> Subir el anuncio ganador
        </button>
        <span className="t-chico t-3">o pégalo (Cmd/Ctrl + V), o elige uno de «Lo que me funciona»:</span>
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

function EncargoImagen({ onListo }) {
  const { aviso } = useAvisos();
  const { datos } = useDatos('imagen-ads:productos', apiImagenes.productos);
  const { datos: opciones } = useDatos('imagen-ads:opciones', apiImagenes.opciones);
  const productos = (datos?.productos || []).filter((p) => p.fotos?.length);
  const [productoId, setProductoId] = useState('');
  const [elegidos, setElegidos] = useState([]);
  const [cantidad, setCantidad] = useState(5);
  const [vertical, setVertical] = useState(false);
  const [pais, setPais] = useState('');
  const [publico, setPublico] = useState('');
  const [oferta, setOferta] = useState('');
  const [fase, setFase] = useState('');
  const p = productos.find((x) => x.id === productoId) || null;
  useEffect(() => {
    if (!productoId && productos.length) setProductoId(productos[0].id);
  }, [productos, productoId]);
  useEffect(() => {
    const d = p?.ultimoLote?.datos || {};
    setPais(d.pais || 'Colombia');
    setPublico(d.publico || '');
  }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const formatos = vertical ? ['1:1', '9:16'] : ['1:1'];
  const precio = opciones?.costo || null;
  const imagenes = cantidad * formatos.length;
  const costo = precio?.conChatGPT ? 0 : precio?.dolaresPorImagen ? Math.round(precio.dolaresPorImagen * imagenes * 100) / 100 : null;
  const listo = p && elegidos.length && pais.trim() && costo !== null && !fase;

  const encargar = async () => {
    try {
      setFase('Preparando el encargo');
      const archivos = [];
      for (const x of elegidos) {
        if (x.archivo) archivos.push(x.archivo);
        else {
          const r = await fetch(x.url);
          if (!r.ok) throw new Error('No pude leer uno de tus anuncios. Vuelve a intentarlo.');
          const b = await r.blob();
          archivos.push(new File([b], `ganador-${archivos.length + 1}.${b.type === 'image/png' ? 'png' : 'jpg'}`, { type: b.type || 'image/jpeg' }));
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
        modo: 'variantes',
        agente: 'variaciones',
        fiel: true,
        rapido: false,
        referenciasPropias: elegidos.map((x, i) => (x.productoId === p.id ? i + 1 : null)).filter(Boolean),
        conceptosReferencias: elegidos.map((x) => x.concepto || ''),
      });
      for (let i = 0; i < archivos.length; i++) {
        setFase(`Subiendo el ganador ${archivos.length > 1 ? `${i + 1} de ${archivos.length}` : ''}`.trim());
        await apiImagenes.subirReferencia(r.lote, i + 1, archivos[i]);
      }
      setFase('Pasándoselo al equipo');
      await apiImagenes.generar(r.lote, costo, []);
      invalidar('oficina');
      aviso({ tipo: 'exito', titulo: 'Encargado al equipo de imagen', texto: `${cantidad} variaciones de tu ganador. Míralas avanzar por la cadena.` });
      onListo(r.lote);
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude encargarlo', texto: e?.message || 'Vuelve a intentarlo.' });
    } finally {
      setFase('');
    }
  };

  return (
    <div className="enc">
      <p className="enc-intro">
        <Sparkles size={15} aria-hidden="true" />
        <span>
          El <b>agente de variaciones</b> analiza tu anuncio ganador (su ángulo, lo que no se toca y lo que se puede probar), arma la matriz de facetas y crea variaciones cercanas, conceptos vecinos y expandidos, con diseño limpio y control de calidad. Cada una sale con qué cambió y qué hipótesis prueba.
        </span>
      </p>
      <section className="enc-paso">
        <h4>1. Tu anuncio ganador</h4>
        <Ganadores elegidos={elegidos} setElegidos={setElegidos} productoId={productoId} />
      </section>
      <section className="enc-paso">
        <h4>2. El producto</h4>
        {productos.length ? (
          <ul className="enc-productos">
            {productos.map((x) => (
              <li key={x.id}>
                <button type="button" className={x.id === productoId ? 'activo' : ''} aria-pressed={x.id === productoId} onClick={() => setProductoId(x.id)}>
                  <img src={x.fotos[0].url} alt="" />
                  <span>{x.nombre}</span>
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
      <section className="enc-paso">
        <h4>3. Cuántas y en qué formato</h4>
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
        <CampoTexto etiqueta="Oferta, precio o envío (si va en el anuncio)" opcional maxLength={300} value={oferta} onChange={(e) => setOferta(e.target.value)} placeholder="Solo lo que es verdad: no se inventa nada" />
      </section>
      <div className="enc-pie">
        <span className="enc-costo">{costo === null ? 'Calculando el costo…' : costo === 0 ? `${imagenes} imágenes con tu ChatGPT: sin costo por imagen` : `${imagenes} imágenes · ${dinero(costo)} (${dinero(precio.dolaresPorImagen)} cada una)`}</span>
        <Boton variante="primario" icono={Briefcase} onClick={encargar} cargando={Boolean(fase)} disabled={!listo}>
          {fase || (costo ? `Encargar · ${dinero(costo)}` : 'Encargar')}
        </Boton>
      </div>
    </div>
  );
}

function EncargoInvestigacion({ onListo }) {
  const { aviso } = useAvisos();
  const { datos } = useDatos('investigacion:lista', () => pedirNuevo('/api/investigacion'));
  const productos = datos?.productos || [];
  const [id, setId] = useState('');
  const [pais, setPais] = useState('Colombia');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    if (!id && productos.length) setId(productos[0].id);
  }, [productos, id]);
  const encargar = async () => {
    setOcupado(true);
    try {
      await pedirNuevo(`/api/investigacion/${encodeURIComponent(id)}`, { metodo: 'POST', cuerpo: { pais: pais.trim() } });
      invalidar('oficina');
      aviso({ tipo: 'exito', titulo: 'Encargado al equipo de investigación', texto: 'Mercado y competencia, de una.' });
      onListo();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude encargarlo', texto: e?.message || 'Vuelve a intentarlo.' });
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div className="enc">
      <p className="enc-intro">Investigan tu mercado (internet, Reddit, reseñas) y tu competencia en TrendTrack, arman el avatar y los conceptos para Meta y te entregan el informe.</p>
      <ul className="enc-productos">
        {productos.map((x) => (
          <li key={x.id}>
            <button type="button" className={x.id === id ? 'activo' : ''} aria-pressed={x.id === id} onClick={() => setId(x.id)}>
              {x.foto ? <img src={x.foto} alt="" /> : null}
              <span>
                {x.nombre}
                {x.estado === 'lista' ? ' · ya tiene' : x.estado === 'investigando' ? ' · en curso' : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <CampoTexto etiqueta="País" maxLength={60} value={pais} onChange={(e) => setPais(e.target.value)} />
      <div className="enc-pie">
        <span className="enc-costo">Usa tu cuenta de Claude: sin costo por imagen.</span>
        <Boton variante="primario" icono={Briefcase} onClick={encargar} cargando={ocupado} disabled={!id || !pais.trim()}>
          Encargar
        </Boton>
      </div>
    </div>
  );
}

export function Encargar({ dep, onCerrar, onListo, onPedirAValentina }) {
  if (!dep) return null;
  const titulo = dep.id === 'imagen' ? 'Encargar variaciones de un anuncio ganador' : dep.id === 'investigacion' ? 'Encargar una investigación' : `Encargar a ${dep.nombre}`;
  return (
    <Modal abierto onCerrar={onCerrar} titulo={titulo} descripcion={`Se lo pasas al equipo de ${dep.nombre}: lo verás avanzar por su cadena en la oficina.`} icono={ImagePlus} tamano="grande">
      {dep.id === 'imagen' ? (
        <EncargoImagen onListo={onListo} />
      ) : dep.id === 'investigacion' ? (
        <EncargoInvestigacion onListo={onListo} />
      ) : (
        <div className="enc">
          <p className="enc-intro">Un anuncio de video necesita elegir el estilo y sus ajustes. Pídeselo a tu coordinadora con tus palabras, o ármalo paso a paso.</p>
          <div className="enc-pie">
            <Boton variante="secundario" href={enlace.nuevo({})}>
              Abrir «Nuevo anuncio»
            </Boton>
            <Boton variante="primario" icono={MessageCircle} onClick={onPedirAValentina}>
              Pedírselo a la coordinadora
            </Boton>
          </div>
        </div>
      )}
    </Modal>
  );
}

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
import { Boton, CampoTexto, useAvisos } from '../../componentes/index.js';
import { invalidar, pedirNuevo, useDatos } from '../../datos/api.js';
import { apiImagenes, CLAVE_LOTES } from '../../datos/imagenes.js';
import { enlace } from '../../datos/rutas.js';

const CANTIDADES = [3, 5, 8, 10];
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
  // (2026-11-21) MODO REPLICAR VALIDADO: tu anuncio EXACTO; cambian solo la modelo, el escenario, la pose y el titular
  const [replicar, setReplicar] = useState(true);
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
  }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const conInvestigacion = Boolean(p?.investigacion);
  const formatos = vertical ? ['1:1', '9:16'] : ['1:1'];
  const precio = opciones?.costo || null;
  const imagenes = cantidad * formatos.length;
  const costo = precio?.conChatGPT ? 0 : precio?.dolaresPorImagen ? Math.round(precio.dolaresPorImagen * imagenes * 100) / 100 : null;
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
        ...(modo === 'referencia' && replicar ? { replicar: true, rapido: true } : { agente: 'variaciones', rapido: false }),
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
      await apiImagenes.generar(r.lote, costo, []);
      invalidar(CLAVE_LOTES);
      invalidar('oficina');
      aviso({ tipo: 'exito', titulo: modo === 'referencia' && replicar ? 'Replicando tu anuncio validado' : 'El agente está trabajando', texto: modo === 'referencia' && replicar ? `${cantidad} réplicas exactas: cambian la modelo, el escenario, la pose y el titular.` : `${cantidad} anuncios ${modo === 'referencia' ? 'a partir de tu referencia' : 'desde tu investigación'}.` });
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
          El <b>agente</b> lo hace todo: analiza {modo === 'referencia' ? 'tu anuncio' : 'tu investigación'} (el ángulo, lo que no se toca y lo que se puede probar), arma la matriz de facetas y crea anuncios cercanos, conceptos vecinos y expandidos, con diseño limpio, una imagen por anuncio y control de calidad. Cada uno sale con qué cambió y qué hipótesis prueba.
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
          <div className="enc-chips enc-replicar" role="radiogroup" aria-label="Cómo usar tu referencia">
            <button type="button" role="radio" aria-checked={replicar} className={replicar ? 'activo' : ''} onClick={() => setReplicar(true)}>
              Replicar validado (exacto)
            </button>
            <button type="button" role="radio" aria-checked={!replicar} className={!replicar ? 'activo' : ''} onClick={() => setReplicar(false)}>
              Variaciones del agente
            </button>
          </div>
          <p className="t-chico t-3">
            {replicar
              ? 'Tu anuncio tal cual: mismas zonas, jerarquía, letras, colores, oferta, CTA y ángulo. Solo cambian la modelo (otra mujer en cada imagen: edad, contextura y tono de piel), el escenario, la pose y la redacción del titular (misma promesa, otras palabras). Nada se repite en el lote.'
              : 'El agente prueba variaciones cercanas, conceptos vecinos y expandidos, cada una con qué cambió y qué hipótesis prueba.'}
          </p>
        </section>
      ) : (
        <section className="enc-paso">
          <h4>2. La investigación de mercado</h4>
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
        <CampoTexto etiqueta="Oferta, precio o envío (si va en el anuncio)" opcional maxLength={300} value={oferta} onChange={(e) => setOferta(e.target.value)} placeholder="Solo lo que es verdad: no se inventa nada" />
      </section>
      <div className="enc-pie">
        <span className="enc-costo">{falta ? <span className="enc-falta">{falta}</span> : costo === null ? 'Calculando el costo…' : costo === 0 ? `${imagenes} imágenes con tu ChatGPT: sin costo por imagen` : `${imagenes} imágenes · ${dinero(costo)} (${dinero(precio.dolaresPorImagen)} cada una)`}</span>
        <Boton variante="primario" icono={Briefcase} onClick={crear} cargando={Boolean(fase)} disabled={!listo}>
          {fase || (modo === 'referencia' && replicar ? (costo ? `Replicar · ${dinero(costo)}` : 'Replicar') : costo ? `Crear con el agente · ${dinero(costo)}` : 'Crear con el agente')}
        </Boton>
      </div>
    </div>
  );
}

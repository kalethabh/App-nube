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
import { Briefcase, ChevronDown, FileSearch, ImagePlus, LayoutGrid, Upload, X } from 'lucide-react';
import { AreaTexto, Boton, CampoTexto, Selector, useAvisos } from '../../componentes/index.js';

// (2026-11-26c) «que se vea más limpia, como las demás secciones»: pestañas arriba, el producto en una lista, una línea de
// explicación por elección y lo opcional de venta plegado.
const MODOS = [
  { id: 'referencia', icono: ImagePlus, etiqueta: 'Con referencia', texto: 'Subes un anuncio que te funciona y hace variaciones que conservan lo que lo hace vender. Antes te muestra por qué vende.' },
  { id: 'investigacion', icono: FileSearch, etiqueta: 'Desde la investigación', texto: 'Sin referencia: el ángulo, los textos y las objeciones salen de la investigación de mercado de tu producto.' },
  { id: 'estructuras', icono: LayoutGrid, etiqueta: 'Estructuras ganadoras', texto: 'Cada imagen con el diseño de un anuncio ganador distinto, con tu producto y tus textos. Al final, cada una lado a lado con su referencia.' },
];
import { invalidar, pedirNuevo, useDatos } from '../../datos/api.js';
import { apiImagenes, CLAVE_LOTES } from '../../datos/imagenes.js';
import { MisEstructuras } from './MisEstructuras.jsx';
import { enlace } from '../../datos/rutas.js';

const CANTIDADES = [3, 5, 8, 10];
// (2026-11-26e) las zonas del cuerpo que mejora el producto: la imagen muestra SU resultado (no la zona de la referencia)
const ZONAS = ['glúteos', 'piernas', 'caderas', 'cintura', 'abdomen', 'brazos', 'cara', 'piel', 'cabello', 'busto'];
// (2026-11-26b) ESTRUCTURAS GANADORAS: las 4 de la primera prueba vienen marcadas (mv-01, mv-03, mv-04 y mv-06)
const ESTRUCTURAS_INICIALES = ['F33', 'F35', 'F36', 'F38'];
const ESTILO = { 'foto-real': 'Foto real', '3d-pixar': '3D', 'ilustracion-plana': 'Ilustración', 'bodegon-premium': 'Bodegón', 'carta-de-texto': 'Carta de texto' };
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
  const alternar = (x) => setElegidos((l) => (tiene(x) ? l.filter((y) => y.id !== x.id) : [...l, { id: x.id, url: x.url, titulo: x.titulo, concepto: x.concepto || '', productoId: x.productoId }].slice(0, 5)));
  return (
    <div className="enc-ganadores">
      <div
        className={`enc-soltar${elegidos.length ? ' enc-soltar--con' : ''}`}
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
            {elegidos.length < 5 ? (
              <li>
                <button type="button" className="enc-mas-uno" onClick={() => subir.current?.click()} aria-label="Agregar otro anuncio de referencia">
                  <Upload size={16} aria-hidden="true" />
                </button>
              </li>
            ) : null}
          </ul>
        ) : (
          <button type="button" className="enc-soltar__boton" onClick={() => subir.current?.click()}>
            <Upload size={20} aria-hidden="true" />
            <strong>Sube tu anuncio de referencia</strong>
            <small>o arrástralo aquí, o pégalo con Cmd/Ctrl + V</small>
          </button>
        )}
        <input ref={subir} type="file" accept="image/*" multiple hidden onChange={(e) => agregar(e.target.files || [])} />
      </div>
      {items.length ? (
        <details className="enc-plegable">
          <summary>
            <ChevronDown size={14} aria-hidden="true" /> O elige uno de «Lo que me funciona» ({items.length})
          </summary>
          <ul className="enc-funciona">
            {items.map((x) => (
              <li key={x.id}>
                <button type="button" className={tiene(x) ? 'activo' : ''} aria-pressed={tiene(x)} onClick={() => alternar(x)} title={x.titulo || x.concepto || ''}>
                  <img src={x.url} alt="" loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

export function FormularioAgente({ onListo, productoPedido = null, referenciaPedida = null, modoInicial = null }) {
  const { aviso } = useAvisos();
  const { datos, recargar } = useDatos('imagen-ads:productos', apiImagenes.productos);
  const { datos: opciones } = useDatos('imagen-ads:opciones', apiImagenes.opciones);
  const productos = (datos?.productos || []).filter((p) => p.fotos?.length);
  const [modo, setModo] = useState(modoInicial === 'investigacion' ? 'investigacion' : modoInicial === 'estructuras' ? 'estructuras' : 'referencia');
  const { datos: est, recargar: recargarEst } = useDatos('imagen-ads:estructuras', () => pedirNuevo('/api/imagen-ads/estructuras'));
  const estructuras = est?.estructuras || [];
  // (2026-11-26d) las tuyas (P##) primero; de Mayaverra, solo las 8 a la vista (las demás entran al sorteo)
  const propias = estructuras.filter((x) => x.propia);
  const galeria = [...propias, ...estructuras.filter((x) => !x.oculta && !x.propia)];
  const [elegidasEst, setElegidasEst] = useState(ESTRUCTURAS_INICIALES);
  // (2026-11-26c) por defecto la app sortea entre todas las estructuras ganadoras (también las que no se muestran)
  const [alAzar, setAlAzar] = useState(true);
  const conEstructuras = modo === 'estructuras';
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
  const [zonas, setZonas] = useState([]);
  const [resultado, setResultado] = useState('');
  const [tiempo, setTiempo] = useState('');
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
        setZonas(Array.isArray(a.cuerpo?.zonas) ? a.cuerpo.zonas : []);
        setResultado(a.cuerpo?.resultado || '');
        setTiempo(a.tiempo || '');
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const conInvestigacion = Boolean(p?.investigacion);
  const formatos = vertical ? ['1:1', '9:16'] : ['1:1'];
  const precio = opciones?.costo || null;
  const cuantas = conEstructuras && !alAzar ? elegidasEst.length : cantidad;
  const imagenes = cuantas * formatos.length;
  const costo = precio?.conChatGPT ? 0 : precio?.dolaresPorImagen ? Math.round(precio.dolaresPorImagen * imagenes * 100) / 100 : null;
  const falta = !p ? 'Elige tu producto.' : conEstructuras && !alAzar && !elegidasEst.length ? 'Elige al menos una estructura.' : modo === 'referencia' && !elegidos.length ? 'Sube o elige tu anuncio de referencia.' : modo === 'investigacion' && !conInvestigacion ? 'Este producto todavía no tiene investigación de mercado.' : !pais.trim() ? 'Escribe el país.' : null;
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
        cantidad: cuantas,
        formatos,
        logo: null,
        modo: modo === 'referencia' ? 'variantes' : 'nuevos',
        // (2026-11-26b) una imagen por estructura ganadora elegida (la app rota estilo, zona y segmento)
        ...(conEstructuras ? { estructuras: alAzar ? 'azar' : elegidasEst } : {}),
        ...(modo === 'referencia' ? { variacion, ...(replicar ? { replicar: true, rapido: true } : { rapido: false }) } : conEstructuras ? { rapido: false } : desde0 ? { desde0: true, rapido: false } : { agente: 'variaciones', rapido: false }),
        // lo de venta (se guarda con el producto)
        venta: { oferta: oferta.trim(), sellos: sellos.split(/\r?\n/).map((x) => x.trim()).filter(Boolean), pais: paisPrecio || null, prohibido: prohibido.split(/[,\n]/).map((x) => x.trim()).filter(Boolean), cuerpo: zonas.length ? { zonas, resultado: resultado.trim() } : null, tiempo: tiempo.trim() },
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
      if (conEstructuras) aviso({ tipo: 'exito', titulo: 'Creando con estructuras ganadoras', texto: `${cuantas} anuncios, cada uno con una estructura distinta. Al final ves cada uno lado a lado con su referencia y sus puntajes.` });
      else aviso({ tipo: 'exito', titulo: modo === 'referencia' && replicar ? 'Replicando tu anuncio validado' : modo === 'referencia' ? 'Creando tus variaciones' : desde0 ? 'Creando tus anuncios desde 0' : 'El agente está trabajando', texto: modo === 'referencia' && replicar ? `${cantidad} réplicas exactas: cambian la modelo, el escenario, la pose y el titular.` : modo === 'referencia' ? `Primero tu IA analiza por qué vende tu ganador; después, ${cantidad} variaciones ${variacion === 'vecinas' ? 'vecinas' : 'con conceptos nuevos'}.` : `${cantidad} anuncios desde tu investigación.` });
      onListo?.(r.lote);
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude crearlos', texto: e?.message || 'Vuelve a intentarlo.' });
    } finally {
      setFase('');
    }
  };

  const segmento = (opciones, valor, poner, etiqueta) => (
    <div className="enc-segmento" role="radiogroup" aria-label={etiqueta}>
      {opciones.map(([v, t]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={valor === v} className={valor === v ? 'activo' : ''} onClick={() => poner(v)}>
          {t}
        </button>
      ))}
    </div>
  );
  const fotoDe = (x) => x?.fotos?.find((f) => f.n === x.fotoSugerida)?.url || x?.fotos?.[0]?.url || null;

  return (
    <div className="enc enc--limpio">
      <div className="enc-modos" role="radiogroup" aria-label="Cómo los hace el agente">
        {MODOS.map((m) => {
          const Icono = m.icono;
          const activo = modo === m.id;
          return (
            <button key={m.id} type="button" role="radio" aria-checked={activo} className={activo ? 'activo' : ''} onClick={() => setModo(m.id)}>
              <Icono size={16} aria-hidden="true" />
              <span>{m.etiqueta}</span>
            </button>
          );
        })}
      </div>
      <p className="enc-explica">{MODOS.find((m) => m.id === modo)?.texto}</p>

      <div className="enc-grupo">
        <span className="enc-etiqueta">Tu producto</span>
        {productos.length ? (
          <div className="enc-producto">
            {fotoDe(p) ? <img src={fotoDe(p)} alt="" /> : null}
            <select value={productoId} onChange={(e) => setProductoId(e.target.value)} aria-label="Tu producto">
              {productos.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                  {modo === 'investigacion' ? (x.investigacion ? ' · con investigación' : ' · sin investigación') : ''}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="enc-ayuda">
            Primero crea tu producto en <a href={enlace.nuevo({})}>Nuevo anuncio</a> (paso 1).
          </p>
        )}
      </div>

      {p ? (
        <div className="enc-grupo">
          <span className="enc-etiqueta">
            Zona del cuerpo que mejora <small className="enc-opcional">opcional</small>
          </span>
          <div className="enc-chips-multi" role="group" aria-label="Zona del cuerpo que mejora">
            {ZONAS.map((z) => {
              const activa = zonas.includes(z);
              return (
                <button key={z} type="button" className={activa ? 'activo' : ''} aria-pressed={activa} onClick={() => setZonas((l) => (activa ? l.filter((y) => y !== z) : [...l, z].slice(-3)))}>
                  {z}
                </button>
              );
            })}
          </div>
          <p className="enc-ayuda">{zonas.length ? `Las personas de las imágenes muestran el resultado en ${zonas.join(' y ')}, con jean o leggins.` : 'Si no eliges, la IA la deduce de tu producto y la recuerda para la próxima vez.'}</p>
        </div>
      ) : null}

      {conEstructuras ? (
        <div className="enc-grupo">
          <span className="enc-etiqueta">Las estructuras</span>
          {segmento([[true, 'Al azar (recomendado)'], [false, 'Elegir yo']], alAzar, setAlAzar, 'Qué estructuras')}
          {alAzar ? (
            <p className="enc-ayuda">Cada anuncio sale de un diseño ganador distinto, sorteado entre los {estructuras.filter((x) => x.marca === 'mayaverra').length || 'decenas de'} anuncios de Mayaverra{propias.length ? ' y los tuyos' : ''}, con su misma mezcla (resultado, mecanismo, emoción, oferta, urgencia, segmento). Nunca se repite el estilo dos veces seguidas.</p>
          ) : (
            <ul className="enc-estructuras">
              {galeria.map((x) => {
                const activa = elegidasEst.includes(x.id);
                return (
                  <li key={x.id}>
                    <button type="button" className={activa ? 'activo' : ''} aria-pressed={activa} onClick={() => setElegidasEst((l) => (activa ? l.filter((y) => y !== x.id) : [...l, x.id]))} title={x.nombre}>
                      <img src={`/api/imagen-ads/estructuras/${x.id}/imagen`} alt="" loading="lazy" />
                      <span>
                        <b>{x.id}</b> {x.nombre}
                        <small>{[ESTILO[x.estilo] || x.estilo, x.segmento].filter(Boolean).join(' · ')}</small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <MisEstructuras propias={propias} onCambio={() => recargarEst?.()} />
          <p className="enc-ayuda">Se copia cómo trabaja Mayaverra (estructura, titulares, cómo vende), nunca su marca, su texto ni sus cifras.</p>
        </div>
      ) : modo === 'referencia' ? (
        <>
          <div className="enc-grupo">
            <span className="enc-etiqueta">Tu anuncio de referencia</span>
            <Ganadores elegidos={elegidos} setElegidos={setElegidos} productoId={productoId} />
          </div>
          <div className="enc-grupo">
            <span className="enc-etiqueta">Qué tan distintas</span>
            {segmento(VARIACIONES.map((x) => [x.id, x.etiqueta]), variacion, setVariacion, 'Qué tan distintas')}
            <p className="enc-ayuda">{VARIACIONES.find((x) => x.id === variacion)?.texto}</p>
          </div>
        </>
      ) : (
        <div className="enc-grupo">
          <span className="enc-etiqueta">Cómo crearlos</span>
          {segmento([[true, 'Desde 0 (6 zonas)'], [false, 'Variaciones del agente']], desde0, setDesde0, 'Cómo crearlos')}
          <p className="enc-ayuda">
            {desde0
              ? 'Cada anuncio con sus 6 zonas (gancho, visual, beneficios, tu frasco, la oferta y un botón), en formatos distintos y sin repetir modelo ni escenario. Pon el precio en «Oferta».'
              : 'El agente arma la matriz de facetas desde tu investigación y prueba conceptos cercanos, vecinos y expandidos.'}
          </p>
          {!p ? null : conInvestigacion ? (
            <p className="enc-nota enc-nota--ok">
              <FileSearch size={14} aria-hidden="true" /> {p.nombre} tiene su investigación{p.investigacion?.pais ? ` (${p.investigacion.pais})` : ''}. <a href={enlace.investigacion(p.id)}>Verla</a>
            </p>
          ) : (
            <div className="enc-nota enc-nota--falta">
              <span>{p.nombre} todavía no tiene investigación de mercado. Hazla primero (tarda unos minutos).</span>
              <Boton variante="secundario" tamano="chico" icono={FileSearch} onClick={investigar} cargando={investigando}>
                Hacer la investigación
              </Boton>
            </div>
          )}
        </div>
      )}

      <div className="enc-dos">
        {conEstructuras && !alAzar ? null : (
          <div className="enc-grupo">
            <span className="enc-etiqueta">Cuántos anuncios</span>
            {segmento(CANTIDADES.map((n) => [n, String(n)]), cantidad, setCantidad, 'Cuántos anuncios')}
          </div>
        )}
        <div className="enc-grupo">
          <span className="enc-etiqueta">Formato</span>
          {segmento([[false, 'Cuadrado 1:1'], [true, '1:1 + vertical 9:16']], vertical, setVertical, 'Formato')}
        </div>
      </div>

      <div className="enc-paso--datos">
        <CampoTexto etiqueta="País" maxLength={60} value={pais} onChange={(e) => setPais(e.target.value)} />
        <CampoTexto etiqueta="Público" opcional maxLength={300} value={publico} onChange={(e) => setPublico(e.target.value)} placeholder="Ej.: mujeres de 25 a 45" />
        <CampoTexto etiqueta="Oferta (va tal cual)" opcional maxLength={160} value={oferta} onChange={(e) => setOferta(e.target.value)} placeholder="Tratamiento completo x3 $139.900" />
      </div>
      <details className="enc-plegable enc-plegable--venta">
        <summary>
          <ChevronDown size={14} aria-hidden="true" /> Tiempo, resultado, sellos, precio por país y palabras prohibidas
          {[sellos, paisPrecio, prohibido, resultado, tiempo].some((x) => String(x || '').trim()) ? <span className="enc-cuenta">{[sellos, paisPrecio, prohibido, resultado, tiempo].filter((x) => String(x || '').trim()).length}</span> : null}
        </summary>
        <div className="enc-paso--datos">
          <Selector
            etiqueta="País del precio"
            opcional
            value={paisPrecio}
            onChange={(e) => setPaisPrecio(e.target.value)}
            opciones={[{ valor: '', etiqueta: 'El del campo País' }, ...paises.map((x) => ({ valor: x.codigo, etiqueta: x.nombre }))]}
          />
          <AreaTexto etiqueta="Sellos de confianza" opcional filas={2} maxLength={800} value={sellos} onChange={(e) => setSellos(e.target.value)} placeholder={'REGISTRO INVIMA RSA-…\nPagas al recibir'} ayuda="Solo el texto que va en la imagen, uno por línea (si escribes «agregar…», la app deja solo el texto). No se inventa ningún otro." />
          <CampoTexto etiqueta="Tiempo de transformación" opcional maxLength={140} value={tiempo} onChange={(e) => setTiempo(e.target.value)} placeholder="Tratamiento de 3 meses · se nota desde la semana 4" ayuda="Los títulos lo prometen como Mayaverra («en solo 4 semanas»). Si lo dejas vacío, la IA lo deduce de tu oferta." />
          <CampoTexto etiqueta="Cómo se ve el resultado" opcional maxLength={240} value={resultado} onChange={(e) => setResultado(e.target.value)} placeholder="Glúteo redondo y levantado que llena el jean" ayuda="En la zona del cuerpo que elegiste." />
          <CampoTexto etiqueta="Prohibido decir" opcional maxLength={600} value={prohibido} onChange={(e) => setProhibido(e.target.value)} placeholder="cura, milagroso, garantizado" ayuda="Separado por comas." />
        </div>
      </details>
      <div className="enc-pie">
        <span className="enc-costo">{falta ? <span className="enc-falta">{falta}</span> : costo === null ? 'Calculando el costo…' : costo === 0 ? `${imagenes} imágenes con tu ChatGPT: sin costo por imagen`  : `${imagenes} imágenes · ${dinero(costo)} (${dinero(precio.dolaresPorImagen)} cada una)`}</span>
        <Boton variante="primario" icono={Briefcase} onClick={crear} cargando={Boolean(fase)} disabled={!listo}>
          {fase || (conEstructuras ? (costo ? `Crear con estructuras · ${dinero(costo)}` : 'Crear con estructuras') : modo === 'referencia' && replicar ? (costo ? `Replicar · ${dinero(costo)}` : 'Replicar') : modo === 'referencia' ? (costo ? `Crear variaciones · ${dinero(costo)}` : 'Crear variaciones') : desde0 ? (costo ? `Crear desde 0 · ${dinero(costo)}` : 'Crear desde 0') : costo ? `Crear con el agente · ${dinero(costo)}` : 'Crear con el agente')}
        </Boton>
      </div>
    </div>
  );
}

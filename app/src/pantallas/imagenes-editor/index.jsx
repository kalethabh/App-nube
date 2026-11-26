// #/imagenes/<lote>/editar/<pieza> — EL EDITOR DE IMÁGENES (2026-11-26c). Pedido: «editar las imágenes tipo Canva o con
// IA hacer cambios sin dañar la imagen», «subirle sellos, logos, precios», «yo pego y la IA adapte».
//   Capas encima de la imagen: textos, formas (precios, cintas) y «Mis piezas» (tus sellos, logos, precios), que se
//   mueven, cambian de tamaño y giran. «Guardar» arma la imagen en el navegador y la sube como versión nueva (sin IA).
//   «Integrar con IA»: la capa elegida se pega exacta y la IA adapta solo la zona de alrededor (sombra, luz, bordes);
//   sus letras nunca cambian.
//   «Cambiar una zona con IA»: marcas un rectángulo y escribes el cambio; la IA rehace solo ese recorte y fuera de él
//   la imagen queda idéntica.
// Servidor: lib/imagen-ads/editor.js y piezas.js. Cada cambio es una versión nueva (la anterior queda en el historial).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Copy, Crop, ImagePlus, Layers, Redo2, Save, Shapes, Sparkles, Trash2, Type, Undo2, Upload, Wand2 } from 'lucide-react';
import { AreaTexto, Boton, useAvisos, useBarraSuperior } from '../../componentes/index.js';
import { invalidar, pedirNuevo } from '../../datos/api.js';
import { enlace, ir, rutas } from '../../datos/rutas.js';
import './editor.css';

const FUENTES = ['Inter Variable', 'Bricolage Grotesque Variable', 'Impact', 'Arial Black', 'Georgia', 'Trebuchet MS'];
const COLORES = ['#FFFFFF', '#111111', '#FFD21F', '#E11D48', '#16A34A', '#1E3A8A', '#F97316', '#EC4899'];
const nuevoId = () => Math.random().toString(36).slice(2, 9);
const dinero = (n) => `US$${(Math.round(n * 100) / 100).toFixed(2)}`;
const enc = encodeURIComponent;

/** Dibuja una capa en un contexto 2D (con su centro en el origen ya trasladado y girado). */
function dibujarCapa(ctx, c, imagenes) {
  const { w, h } = c;
  if (c.tipo === 'forma') {
    ctx.fillStyle = c.color;
    ctx.beginPath();
    if (c.forma === 'circulo') ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    else ctx.roundRect(-w / 2, -h / 2, w, h, c.forma === 'pildora' ? Math.min(w, h) / 2 : Math.min(w, h) * 0.08);
    ctx.fill();
  } else if (c.tipo === 'pieza') {
    const im = imagenes.get(c.src);
    if (im) ctx.drawImage(im, -w / 2, -h / 2, w, h);
  }
  if (c.tipo === 'texto' || (c.tipo === 'forma' && c.texto)) {
    const tam = c.tam;
    ctx.font = `${c.negrita ? 800 : 500} ${tam}px "${c.fuente}"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // las líneas: las que escribiste, partidas al ancho de la caja
    const lineas = [];
    for (const parrafo of String(c.texto || '').split('\n')) {
      let actual = '';
      for (const palabra of parrafo.split(' ')) {
        const prueba = actual ? `${actual} ${palabra}` : palabra;
        if (ctx.measureText(prueba).width > w * 0.94 && actual) {
          lineas.push(actual);
          actual = palabra;
        } else actual = prueba;
      }
      lineas.push(actual);
    }
    const alto = tam * 1.12;
    if (c.tipo === 'texto' && c.fondo) {
      ctx.fillStyle = c.fondo;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) / 2);
      ctx.fill();
    }
    lineas.forEach((l, i) => {
      const y = (i - (lineas.length - 1) / 2) * alto;
      if (c.contorno) {
        ctx.lineWidth = Math.max(2, tam * 0.12);
        ctx.strokeStyle = c.contorno;
        ctx.lineJoin = 'round';
        ctx.strokeText(l, 0, y);
      }
      ctx.fillStyle = c.colorTexto || c.color;
      ctx.fillText(l, 0, y);
    });
  }
}

/** La caja que ocupa una capa girada (en px de la imagen). */
function cajaGirada(c) {
  const r = (c.rot * Math.PI) / 180;
  const cw = Math.abs(c.w * Math.cos(r)) + Math.abs(c.h * Math.sin(r));
  const ch = Math.abs(c.w * Math.sin(r)) + Math.abs(c.h * Math.cos(r));
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2;
  return { x: Math.floor(cx - cw / 2), y: Math.floor(cy - ch / 2), w: Math.ceil(cw), h: Math.ceil(ch) };
}

function cargarImagen(src) {
  return new Promise((ok, mal) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => mal(new Error('No pude cargar una imagen.'));
    im.src = src;
  });
}

export default function PantallaEditorImagen({ params }) {
  const lote = params?.lote;
  const pieza = params?.pieza;
  const { aviso } = useAvisos();
  useBarraSuperior({ migas: [{ texto: 'Anuncios de imagen', href: enlace.imagenes() }, { texto: 'Tu lote', href: `#${rutas.loteImagenes(lote)}` }, { texto: `Editar ${pieza || ''}` }] });
  const [vista, setVista] = useState(null);
  const [base, setBase] = useState(null); // { src, w, h, im }
  const [capas, setCapas] = useState([]);
  const [historia, setHistoria] = useState({ atras: [], adelante: [] });
  const [elegida, setElegida] = useState(null);
  const [piezas, setPiezas] = useState([]);
  const [modoZona, setModoZona] = useState(false);
  const [zona, setZona] = useState(null);
  const [instruccion, setInstruccion] = useState('');
  const [costo, setCosto] = useState(null);
  const [ocupado, setOcupado] = useState('');
  const [anchoVista, setAnchoVista] = useState(600);
  const marco = useRef(null);
  const imagenes = useRef(new Map());
  const arrastre = useRef(null);

  const p = useMemo(() => {
    for (const v of vista?.variaciones || []) for (const x of Object.values(v.piezas || {})) if (x?.pieza === pieza) return x;
    return null;
  }, [vista, pieza]);
  const productoId = vista?.producto?.id || null;

  const recargar = useCallback(async () => {
    const v = await pedirNuevo(`/api/imagen-ads/${enc(lote)}`);
    setVista(v);
    return v;
  }, [lote]);
  useEffect(() => {
    recargar().catch((e) => aviso({ tipo: 'error', titulo: 'No pude abrir el lote', texto: e?.message }));
    pedirNuevo('/api/imagen-ads/editor/costo').then(setCosto).catch(() => {});
  }, [recargar]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    pedirNuevo(`/api/imagen-ads/piezas${productoId ? `?producto=${enc(productoId)}` : ''}`).then((r) => setPiezas(r?.piezas || [])).catch(() => {});
  }, [productoId]);
  // la imagen limpia (sin logo): sobre esa se edita; el logo se vuelve a pegar solo
  useEffect(() => {
    const src = p?.urlSinLogo || p?.url;
    if (!src) return;
    cargarImagen(src).then((im) => setBase({ src, w: im.naturalWidth, h: im.naturalHeight, im })).catch(() => {});
  }, [p?.urlSinLogo, p?.url]);
  useEffect(() => {
    const medir = () => setAnchoVista(marco.current?.clientWidth || 600);
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [base]);
  const escala = base ? anchoVista / base.w : 1;

  // ---- las capas (con deshacer)
  const cambiarCapas = (nuevo, { guardar = true } = {}) => {
    if (guardar) setHistoria((h) => ({ atras: [...h.atras.slice(-40), capas], adelante: [] }));
    setCapas(nuevo);
  };
  const deshacer = () =>
    setHistoria((h) => {
      if (!h.atras.length) return h;
      const prev = h.atras[h.atras.length - 1];
      setCapas(prev);
      return { atras: h.atras.slice(0, -1), adelante: [capas, ...h.adelante] };
    });
  const rehacer = () =>
    setHistoria((h) => {
      if (!h.adelante.length) return h;
      setCapas(h.adelante[0]);
      return { atras: [...h.atras, capas], adelante: h.adelante.slice(1) };
    });
  const capa = capas.find((c) => c.id === elegida) || null;
  const editar = (cambios) => cambiarCapas(capas.map((c) => (c.id === elegida ? { ...c, ...cambios } : c)));
  const agregar = (c) => {
    const lado = base ? Math.min(base.w, base.h) : 1000;
    const nueva = { id: nuevoId(), rot: 0, x: Math.round(lado * 0.3), y: Math.round(lado * 0.4), w: Math.round(lado * 0.4), h: Math.round(lado * 0.12), ...c };
    cambiarCapas([...capas, nueva]);
    setElegida(nueva.id);
    setModoZona(false);
  };
  const agregarTexto = () => agregar({ tipo: 'texto', texto: 'TU TEXTO', fuente: FUENTES[0], tam: Math.round((base?.w || 1000) * 0.06), color: '#FFFFFF', contorno: '#111111', negrita: true, fondo: '' });
  const agregarForma = () => agregar({ tipo: 'forma', forma: 'pildora', color: '#FFD21F', texto: '$139.900', colorTexto: '#111111', fuente: FUENTES[0], tam: Math.round((base?.w || 1000) * 0.05), negrita: true });
  const agregarPieza = async (x) => {
    const im = imagenes.current.get(x.url) || (await cargarImagen(x.url));
    imagenes.current.set(x.url, im);
    const ancho = Math.round((base?.w || 1000) * 0.28);
    agregar({ tipo: 'pieza', src: x.url, nombre: x.nombre, w: ancho, h: Math.round((ancho * im.naturalHeight) / im.naturalWidth) });
  };
  const subirPieza = async (archivo, ambito) => {
    try {
      const r = await pedirNuevo(`/api/imagen-ads/piezas/${enc(ambito)}?nombre=${enc(archivo.name)}`, { metodo: 'PUT', binario: archivo });
      setPiezas((l) => [r.pieza, ...l]);
      aviso({ tipo: 'exito', titulo: 'Pieza guardada', texto: 'Tócala para ponerla en la imagen.' });
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude subirla', texto: e?.message });
    }
  };
  const borrarPieza = async (x) => {
    await pedirNuevo(`/api/imagen-ads/piezas?id=${enc(x.id)}`, { metodo: 'DELETE' }).catch(() => {});
    setPiezas((l) => l.filter((y) => y.id !== x.id));
  };

  // ---- mover, cambiar de tamaño, girar (en px de la imagen)
  const empezar = (e, c, accion) => {
    e.stopPropagation();
    e.preventDefault();
    setElegida(c.id);
    arrastre.current = { accion, id: c.id, x0: e.clientX, y0: e.clientY, c0: { ...c }, antes: capas };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const mover = (e) => {
    const a = arrastre.current;
    if (!a) return;
    const dx = (e.clientX - a.x0) / escala;
    const dy = (e.clientY - a.y0) / escala;
    if (a.accion === 'zona') {
      const x = Math.min(a.zx, a.zx + dx);
      const y = Math.min(a.zy, a.zy + dy);
      setZona({ x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)), w: Math.round(Math.min(Math.abs(dx), base.w - x)), h: Math.round(Math.min(Math.abs(dy), base.h - y)) });
      return;
    }
    setCapas((l) =>
      l.map((c) => {
        if (c.id !== a.id) return c;
        if (a.accion === 'mover') return { ...c, x: Math.round(a.c0.x + dx), y: Math.round(a.c0.y + dy) };
        if (a.accion === 'tamano') {
          const w = Math.max(20, Math.round(a.c0.w + dx));
          const h = c.tipo === 'pieza' ? Math.round((w * a.c0.h) / a.c0.w) : Math.max(20, Math.round(a.c0.h + dy));
          return { ...c, w, h, ...(c.tam && c.tipo !== 'pieza' ? { tam: Math.max(8, Math.round((a.c0.tam * h) / a.c0.h)) } : {}) };
        }
        const r = marco.current.getBoundingClientRect();
        const cx = r.left + (a.c0.x + a.c0.w / 2) * escala;
        const cy = r.top + (a.c0.y + a.c0.h / 2) * escala;
        const ang = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90;
        return { ...c, rot: Math.round(Math.abs(ang % 90) < 3 ? Math.round(ang / 90) * 90 : ang) };
      })
    );
  };
  const soltar = () => {
    const a = arrastre.current;
    arrastre.current = null;
    if (a && a.accion !== 'zona') setHistoria((h) => ({ atras: [...h.atras.slice(-40), a.antes], adelante: [] }));
  };
  const empezarZona = (e) => {
    if (!modoZona || !base) {
      setElegida(null);
      return;
    }
    const r = marco.current.getBoundingClientRect();
    arrastre.current = { accion: 'zona', x0: e.clientX, y0: e.clientY, zx: (e.clientX - r.left) / escala, zy: (e.clientY - r.top) / escala };
    setZona(null);
  };

  // ---- armar la imagen en el navegador
  const componer = async (lista) => {
    const cv = document.createElement('canvas');
    cv.width = base.w;
    cv.height = base.h;
    const ctx = cv.getContext('2d');
    ctx.drawImage(base.im, 0, 0);
    await document.fonts?.ready;
    for (const c of lista) {
      ctx.save();
      ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
      ctx.rotate((c.rot * Math.PI) / 180);
      dibujarCapa(ctx, c, imagenes.current);
      ctx.restore();
    }
    return new Promise((ok) => cv.toBlob(ok, 'image/png'));
  };
  /** Solo una capa, en su caja (PNG con transparencia), para «Integrar con IA». */
  const capaSola = async (c) => {
    const k = cajaGirada(c);
    const cv = document.createElement('canvas');
    cv.width = k.w;
    cv.height = k.h;
    const ctx = cv.getContext('2d');
    await document.fonts?.ready;
    ctx.translate(c.x + c.w / 2 - k.x, c.y + c.h / 2 - k.y);
    ctx.rotate((c.rot * Math.PI) / 180);
    dibujarCapa(ctx, c, imagenes.current);
    const blob = await new Promise((ok) => cv.toBlob(ok, 'image/png'));
    return { blob, caja: k };
  };
  const despues = async (mensaje) => {
    const v = await recargar();
    const x = (v?.variaciones || []).flatMap((y) => Object.values(y.piezas || {})).find((y) => y?.pieza === pieza);
    if (x?.urlSinLogo) {
      const im = await cargarImagen(x.urlSinLogo);
      setBase({ src: x.urlSinLogo, w: im.naturalWidth, h: im.naturalHeight, im });
    }
    invalidar(`imagen-ads:${lote}`);
    aviso({ tipo: 'exito', titulo: mensaje, texto: 'Es una versión nueva: la anterior queda en el historial de la imagen.' });
  };

  const guardar = async () => {
    if (!capas.length) return;
    setOcupado('Guardando');
    try {
      const blob = await componer(capas);
      await pedirNuevo(`/api/imagen-ads/${enc(lote)}/editor/${enc(pieza)}`, { metodo: 'PUT', binario: new File([blob], 'editada.png', { type: 'image/png' }) });
      setCapas([]);
      setHistoria({ atras: [], adelante: [] });
      setElegida(null);
      await despues('Imagen guardada');
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude guardarla', texto: e?.message });
    } finally {
      setOcupado('');
    }
  };

  const confirmarCosto = () => (costo?.conChatGPT ? 0 : window.confirm(`Este cambio cuesta ${dinero(costo?.dolares || 0)} con ${costo?.modelo || 'kie.ai'}. ¿Lo hago?`) ? costo?.dolares || 0 : null);
  const esperar = async (id) => {
    for (;;) {
      await new Promise((r) => setTimeout(r, 2000));
      const t = await pedirNuevo(`/api/imagen-ads/editor/trabajos/${enc(id)}`);
      if (t?.estado === 'trabajando') {
        setOcupado(t.mensaje);
        continue;
      }
      if (t?.estado === 'error') throw new Error(t.mensaje);
      return t;
    }
  };
  const conIA = async (datos, blob = null) => {
    const ok = confirmarCosto();
    if (ok === null) return false;
    const r = await pedirNuevo(`/api/imagen-ads/${enc(lote)}/editor/${enc(pieza)}/ia?datos=${enc(JSON.stringify({ ...datos, costoMaximoConfirmado: ok }))}`, { metodo: 'POST', binario: blob ? new File([blob], 'capa.png', { type: 'image/png' }) : new File([new Uint8Array([0])], 'vacio.bin', { type: 'application/octet-stream' }) });
    const t = await esperar(r.trabajo);
    return t;
  };
  const cambiarZona = async () => {
    if (!zona || zona.w < 16 || zona.h < 16 || instruccion.trim().length < 3) return;
    setOcupado('La IA está cambiando esa zona');
    try {
      const t = await conIA({ tipo: 'zona', rect: zona, instruccion: instruccion.trim() });
      if (!t) return;
      setZona(null);
      setInstruccion('');
      setModoZona(false);
      await despues(t.mensaje || 'Listo: cambió solo esa zona');
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No se pudo cambiar la zona', texto: e?.message });
    } finally {
      setOcupado('');
    }
  };
  const integrar = async () => {
    if (!capa) return;
    setOcupado('La IA está integrando tu pieza');
    try {
      // las demás capas siguen sin guardar: solo esta se integra
      const { blob, caja } = await capaSola(capa);
      const rect = { x: Math.max(0, caja.x), y: Math.max(0, caja.y), w: Math.min(base.w - Math.max(0, caja.x), caja.w), h: Math.min(base.h - Math.max(0, caja.y), caja.h) };
      const t = await conIA({ tipo: 'integrar', rect, instruccion: '' }, blob);
      if (!t) return;
      cambiarCapas(capas.filter((c) => c.id !== capa.id));
      setElegida(null);
      await despues(t.mensaje || 'Tu pieza quedó integrada');
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No se pudo integrar', texto: e?.message });
    } finally {
      setOcupado('');
    }
  };

  if (!vista) return <div className="pagina ed"><p className="t-3">Abriendo la imagen…</p></div>;
  if (!p || !base) return <div className="pagina ed"><p className="t-3">{p ? 'Cargando la imagen…' : 'No encuentro esa imagen en el lote.'}</p></div>;
  const s = (n) => `${n * escala}px`;
  return (
    <div className="pagina ed">
      <div className="ed__arriba">
        <Boton variante="fantasma" tamano="chico" icono={ArrowLeft} onClick={() => ir(rutas.loteImagenes(lote))}>
          Volver al lote
        </Boton>
        <h1 className="ed__titulo">Editar {pieza}</h1>
        <div className="ed__acciones">
          <Boton variante="fantasma" tamano="chico" soloIcono icono={Undo2} etiqueta="Deshacer" onClick={deshacer} disabled={!historia.atras.length || Boolean(ocupado)} />
          <Boton variante="fantasma" tamano="chico" soloIcono icono={Redo2} etiqueta="Rehacer" onClick={rehacer} disabled={!historia.adelante.length || Boolean(ocupado)} />
          <Boton variante="primario" icono={Save} onClick={guardar} cargando={ocupado === 'Guardando'} disabled={!capas.length || Boolean(ocupado)}>
            Guardar como versión nueva
          </Boton>
        </div>
      </div>
      {ocupado && ocupado !== 'Guardando' ? <p className="ed__trabajando">{ocupado}… (con ChatGPT puede tardar uno o dos minutos)</p> : null}
      <div className="ed__cuerpo">
        <div className="ed__lienzo-caja">
          <div
            ref={marco}
            className={`ed__lienzo${modoZona ? ' ed__lienzo--zona' : ''}`}
            style={{ aspectRatio: `${base.w} / ${base.h}` }}
            onPointerDown={empezarZona}
            onPointerMove={mover}
            onPointerUp={soltar}
          >
            <img src={base.src} alt="" draggable="false" />
            {capas.map((c) => (
              <div
                key={c.id}
                className={`ed__capa ed__capa--${c.tipo}${c.id === elegida ? ' ed__capa--elegida' : ''}`}
                style={{ left: s(c.x), top: s(c.y), width: s(c.w), height: s(c.h), transform: `rotate(${c.rot}deg)` }}
                onPointerDown={(e) => !modoZona && empezar(e, c, 'mover')}
              >
                <CapaVista c={c} escala={escala} />
                {c.id === elegida && !modoZona ? (
                  <>
                    <span className="ed__asa ed__asa--tamano" onPointerDown={(e) => empezar(e, c, 'tamano')} />
                    <span className="ed__asa ed__asa--girar" onPointerDown={(e) => empezar(e, c, 'girar')} />
                  </>
                ) : null}
              </div>
            ))}
            {zona ? <div className="ed__zona" style={{ left: s(zona.x), top: s(zona.y), width: s(zona.w), height: s(zona.h) }} /> : null}
          </div>
          <p className="t-mini t-3">{base.w}×{base.h} px · Arrastra para mover; el punto de abajo cambia el tamaño y el de arriba gira.</p>
        </div>
        <aside className="ed__panel">
          <section>
            <h3>
              <Layers size={14} /> Agregar
            </h3>
            <div className="ed__botones">
              <Boton variante="secundario" tamano="chico" icono={Type} onClick={agregarTexto} disabled={Boolean(ocupado)}>
                Texto
              </Boton>
              <Boton variante="secundario" tamano="chico" icono={Shapes} onClick={agregarForma} disabled={Boolean(ocupado)}>
                Precio o cinta
              </Boton>
              <Boton variante={modoZona ? 'primario' : 'secundario'} tamano="chico" icono={Crop} onClick={() => { setModoZona((m) => !m); setElegida(null); }} disabled={Boolean(ocupado)}>
                Cambiar una zona con IA
              </Boton>
            </div>
          </section>
          {modoZona ? (
            <section className="ed__zona-panel">
              <h3>
                <Wand2 size={14} /> Cambiar una zona con IA
              </h3>
              <p className="t-mini t-3">Marca en la imagen el rectángulo que quieres cambiar. La IA rehace solo esa parte: fuera de ella la imagen queda idéntica.</p>
              <AreaTexto etiqueta="Qué cambio quieres ahí" filas={3} maxLength={600} value={instruccion} onChange={(e) => setInstruccion(e.target.value)} placeholder="Que el titular diga «GLÚTEOS MÁS FIRMES» en amarillo" />
              <Boton variante="primario" icono={Sparkles} onClick={cambiarZona} disabled={!zona || zona.w < 16 || instruccion.trim().length < 3 || Boolean(ocupado)} cargando={ocupado.startsWith('La IA está cambiando')}>
                {costo?.conChatGPT ? 'Cambiar (con tu ChatGPT, sin costo)' : `Cambiar · ${dinero(costo?.dolares || 0)}`}
              </Boton>
            </section>
          ) : null}
          {capa ? (
            <section>
              <h3>Capa elegida</h3>
              {capa.tipo !== 'pieza' ? (
                <>
                  <AreaTexto etiqueta="Texto" filas={2} maxLength={200} value={capa.texto || ''} onChange={(e) => editar({ texto: e.target.value })} />
                  <label className="ed__campo">
                    Letra
                    <select value={capa.fuente} onChange={(e) => editar({ fuente: e.target.value })}>
                      {FUENTES.map((f) => (
                        <option key={f} value={f}>
                          {f.replace(' Variable', '')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ed__campo">
                    Tamaño
                    <input type="range" min="12" max={Math.round(base.w * 0.2)} value={capa.tam} onChange={(e) => editar({ tam: Number(e.target.value) })} />
                  </label>
                  <label className="ed__check">
                    <input type="checkbox" checked={Boolean(capa.negrita)} onChange={(e) => editar({ negrita: e.target.checked })} /> Negrita
                  </label>
                  <Colores etiqueta={capa.tipo === 'forma' ? 'Color de la forma' : 'Color del texto'} valor={capa.tipo === 'forma' ? capa.color : capa.color} onCambio={(c) => editar({ color: c })} />
                  {capa.tipo === 'forma' ? (
                    <>
                      <Colores etiqueta="Color del texto" valor={capa.colorTexto} onCambio={(c) => editar({ colorTexto: c })} />
                      <label className="ed__campo">
                        Forma
                        <select value={capa.forma} onChange={(e) => editar({ forma: e.target.value })}>
                          <option value="pildora">Píldora</option>
                          <option value="rect">Rectángulo</option>
                          <option value="circulo">Círculo</option>
                        </select>
                      </label>
                    </>
                  ) : (
                    <>
                      <Colores etiqueta="Contorno" valor={capa.contorno} onCambio={(c) => editar({ contorno: c })} conNinguno />
                      <Colores etiqueta="Fondo" valor={capa.fondo} onCambio={(c) => editar({ fondo: c })} conNinguno />
                    </>
                  )}
                </>
              ) : (
                <p className="t-chico">{capa.nombre}: se pega idéntica a tu archivo.</p>
              )}
              <div className="ed__botones">
                <Boton variante="primario" tamano="chico" icono={Sparkles} onClick={integrar} disabled={Boolean(ocupado)} cargando={ocupado.startsWith('La IA está integrando')}>
                  Integrar con IA
                </Boton>
                <Boton variante="fantasma" tamano="chico" icono={Copy} onClick={() => agregar({ ...capa, id: nuevoId(), x: capa.x + 30, y: capa.y + 30 })} disabled={Boolean(ocupado)}>
                  Duplicar
                </Boton>
                <Boton variante="fantasma" tamano="chico" icono={Trash2} onClick={() => { cambiarCapas(capas.filter((c) => c.id !== capa.id)); setElegida(null); }} disabled={Boolean(ocupado)}>
                  Quitar
                </Boton>
              </div>
              <p className="t-mini t-3">«Integrar con IA» la pega exacta y la IA solo adapta lo de alrededor (sombra, luz, bordes): sus letras no cambian.</p>
            </section>
          ) : null}
          <section>
            <h3>
              <ImagePlus size={14} /> Mis piezas (sellos, logos, precios)
            </h3>
            <ul className="ed__piezas">
              {piezas.map((x) => (
                <li key={x.id}>
                  <button type="button" onClick={() => agregarPieza(x)} title={`Poner «${x.nombre}»`} disabled={Boolean(ocupado)}>
                    <img src={x.url} alt="" />
                  </button>
                  <span className="t-mini">{x.nombre}</span>
                  <button type="button" className="ed__piezas-quitar" onClick={() => borrarPieza(x)} aria-label={`Borrar ${x.nombre}`}>
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="ed__botones">
              {productoId ? <SubirPieza texto="Subir de este producto" onArchivo={(f) => subirPieza(f, productoId)} /> : null}
              <SubirPieza texto="Subir para todos" onArchivo={(f) => subirPieza(f, 'general')} />
            </div>
            <p className="t-mini t-3">Mejor PNG con fondo transparente. Quedan guardadas para tus próximas imágenes.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function CapaVista({ c, escala }) {
  if (c.tipo === 'pieza') return <img src={c.src} alt="" draggable="false" />;
  const estilo = {
    fontFamily: `"${c.fuente}"`,
    fontSize: `${c.tam * escala}px`,
    fontWeight: c.negrita ? 800 : 500,
    color: c.tipo === 'forma' ? c.colorTexto : c.color,
    WebkitTextStroke: c.tipo === 'texto' && c.contorno ? `${Math.max(1, c.tam * 0.06 * escala)}px ${c.contorno}` : undefined,
    paintOrder: 'stroke fill',
    background: c.tipo === 'forma' ? c.color : c.fondo || 'transparent',
    borderRadius: c.tipo === 'forma' ? (c.forma === 'circulo' ? '50%' : c.forma === 'pildora' ? '999px' : '8%') : c.fondo ? '999px' : 0,
  };
  return (
    <span className="ed__texto" style={estilo}>
      {c.texto}
    </span>
  );
}

function Colores({ etiqueta, valor, onCambio, conNinguno = false }) {
  return (
    <div className="ed__colores">
      <span className="t-mini">{etiqueta}</span>
      <div>
        {conNinguno ? <button type="button" className={`ed__color ed__color--ninguno${!valor ? ' activo' : ''}`} onClick={() => onCambio('')} aria-label="Ninguno" /> : null}
        {COLORES.map((c) => (
          <button key={c} type="button" className={`ed__color${valor === c ? ' activo' : ''}`} style={{ background: c }} onClick={() => onCambio(c)} aria-label={c} />
        ))}
        <input type="color" value={valor || '#ffffff'} onChange={(e) => onCambio(e.target.value.toUpperCase())} aria-label="Otro color" />
      </div>
    </div>
  );
}

function SubirPieza({ texto, onArchivo }) {
  const ref = useRef(null);
  return (
    <>
      <Boton variante="secundario" tamano="chico" icono={Upload} onClick={() => ref.current?.click()}>
        {texto}
      </Boton>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onArchivo(f);
          e.target.value = '';
        }}
      />
    </>
  );
}

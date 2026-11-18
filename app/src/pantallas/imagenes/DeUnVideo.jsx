// «De un video, imágenes» (2026-11-19, pedido: «no es tomar fotogramas, sino analizar el ángulo y hacer las imágenes,
// títulos, etc.»): eliges un video (lo subes, uno de tus anuncios o uno de Inspiración); la app mira sus tomas y escucha
// lo que dice, y tu IA saca su ángulo (gancho, dolor, deseo, promesa, a quién le habla) y propone anuncios PARA TU
// PRODUCTO, cada uno un concepto distinto con su titular. Puedes editar o quitar cada uno. Las imágenes salen de las
// plantillas ganadoras con el modelo de imagen, como cualquier lote con plantillas.
import { useEffect, useRef, useState } from 'react';
import { Film, LoaderCircle, RefreshCw, Sparkles, X } from 'lucide-react';
import { AreaTexto, Boton, CampoTexto, Chip, Selector, SubirVideo } from '../../componentes/index.js';
import { apiImagenes } from '../../datos/imagenes.js';
import { pedirNuevo } from '../../datos/api.js';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const NOMBRE_ANGULO = { dolor: 'Dolor', deseo: 'Deseo', beneficio: 'Beneficio', objecion: 'Objeción', mecanismo: 'Mecanismo', prueba: 'Prueba social' };
const DEL_VIDEO = [
  ['angulo', 'Ángulo'],
  ['gancho', 'Gancho'],
  ['dolor', 'Dolor'],
  ['deseo', 'Deseo'],
  ['publico', 'A quién le habla'],
  ['por_que_funciona', 'Por qué funciona'],
];

/**
 * videoPedido: 'subido:<id>|<nombre>' (de Inspiración) · productoId · bloqueado
 * onCambiar({ id, conceptos }) cada vez que cambian los anuncios propuestos (null si todavía no hay)
 */
export function DeUnVideo({ videoPedido = null, productoId, bloqueado, onCambiar }) {
  const [subido, setSubido] = useState(videoPedido);
  const [anuncios, setAnuncios] = useState([]);
  const [trabajo, setTrabajo] = useState(null); // la respuesta de GET /video/:id
  const [conceptos, setConceptos] = useState([]);
  const [cantidad, setCantidad] = useState(6);
  const [ocupado, setOcupado] = useState(null); // 'video' | 'angulo'
  const [error, setError] = useState(null);
  const vivo = useRef(true);
  useEffect(() => () => (vivo.current = false), []);

  // tus anuncios con video (para elegir uno)
  useEffect(() => {
    pedirNuevo('/api/anuncios')
      .then((r) => vivo.current && setAnuncios((r?.anuncios || []).filter((a) => a.video).slice(0, 60)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const listos = conceptos.filter((c) => c.titular.trim());
    onCambiar(trabajo?.angulo?.estado === 'listo' && listos.length ? { id: trabajo.id, conceptos: listos } : null);
  }, [trabajo?.id, trabajo?.angulo?.estado, conceptos]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Sigue el trabajo hasta que se cumpla `hasta` (o falle). */
  const seguir = async (id, hasta) => {
    for (let i = 0; i < 900 && vivo.current; i++) {
      const e = await apiImagenes.video(id);
      if (!vivo.current) return null;
      setTrabajo(e);
      if (e.estado === 'error') throw new Error(e.error || 'No pude ver ese video.');
      const r = hasta(e);
      if (r) return e;
      await esperar(i < 10 ? 600 : 1500);
    }
    return null;
  };

  const analizarAngulo = async (id, n = cantidad) => {
    if (!productoId) return;
    setOcupado('angulo');
    setError(null);
    setConceptos([]);
    try {
      await apiImagenes.videoAngulo(id, { productoId, cantidad: n });
      const e = await seguir(id, (x) => x.angulo && x.angulo.estado !== 'analizando');
      if (e?.angulo?.estado === 'error') throw new Error(e.angulo.error || 'Tu IA no pudo analizar el video.');
      if (e?.angulo?.estado === 'listo') setConceptos(e.angulo.conceptos || []);
    } catch (x) {
      if (vivo.current) setError(x.message);
    } finally {
      if (vivo.current) setOcupado(null);
    }
  };

  const empezar = async (cuerpo) => {
    setOcupado('video');
    setError(null);
    setTrabajo(null);
    setConceptos([]);
    try {
      const { id } = await apiImagenes.videoCrear(cuerpo);
      const e = await seguir(id, (x) => x.estado === 'listo');
      if (e && productoId) await analizarAngulo(id);
    } catch (x) {
      if (vivo.current) setError(x.message);
    } finally {
      if (vivo.current) setOcupado((o) => (o === 'video' ? null : o));
    }
  };

  // un video nuevo (subido o de Inspiración): se analiza solo
  useEffect(() => {
    if (subido && /^subido:/.test(subido)) empezar({ subido });
  }, [subido]); // eslint-disable-line react-hooks/exhaustive-deps

  // elegiste el producto después del video: ahora sí, el ángulo para él
  useEffect(() => {
    if (productoId && trabajo?.estado === 'listo' && !trabajo.angulo && !ocupado) analizarAngulo(trabajo.id);
  }, [productoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const analisis = trabajo?.angulo?.estado === 'listo' ? trabajo.angulo.video : null;
  const avance = ocupado === 'video' ? trabajo?.avance || 'Mirando tu video' : ocupado === 'angulo' ? trabajo?.angulo?.avance || 'Tu IA está analizando el ángulo del video' : null;

  return (
    <div className="img-video">
      <SubirVideo valor={subido} onCambio={setSubido} deshabilitado={bloqueado || Boolean(ocupado)} conLink={false} />
      {anuncios.length ? (
        <Selector
          etiqueta="O uno de tus anuncios"
          value=""
          onChange={(e) => e.target.value && empezar({ anuncio: e.target.value })}
          disabled={bloqueado || Boolean(ocupado)}
          opciones={[{ valor: '', etiqueta: 'Elige uno de tus anuncios…' }, ...anuncios.map((a) => ({ valor: a.slug, etiqueta: a.titulo || a.slug }))]}
        />
      ) : null}
      {avance ? (
        <p className="img-nota" role="status">
          <LoaderCircle size={14} strokeWidth={2} className="girando" aria-hidden="true" />
          <span>{avance}…</span>
        </p>
      ) : null}
      {trabajo?.estado === 'listo' && !productoId && !ocupado ? (
        <p className="img-nota" role="status">
          <Film size={14} strokeWidth={2} aria-hidden="true" />
          <span>Elige tu producto arriba: tu IA analiza el video para hacer los anuncios de tu producto.</span>
        </p>
      ) : null}
      {error ? (
        <p className="img-nota img-nota--aviso" role="alert">
          <Film size={14} strokeWidth={2} aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}

      {analisis ? (
        <>
          <div className="img-video__analisis">
            <h4 className="img-video__titulo">
              <Sparkles size={14} strokeWidth={2.2} aria-hidden="true" /> Lo que encontró tu IA en el video
            </h4>
            <dl>
              {DEL_VIDEO.filter(([k]) => analisis[k]).map(([k, nombre]) => (
                <div key={k} className="img-video__dato">
                  <dt>{nombre}</dt>
                  <dd>{analisis[k]}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="img-video__acciones">
            <span className="t-chico t-3">Cuántos anuncios</span>
            {[4, 6, 8, 10].map((k) => (
              <Chip key={k} activo={cantidad === k} onClick={() => setCantidad(k)} disabled={bloqueado || Boolean(ocupado)}>
                {k}
              </Chip>
            ))}
            <Boton variante="secundario" tamano="chico" icono={RefreshCw} onClick={() => analizarAngulo(trabajo.id, cantidad)} disabled={bloqueado || Boolean(ocupado)}>
              {cantidad !== (trabajo.angulo.conceptos || []).length ? `Proponer ${cantidad}` : 'Otras ideas'}
            </Boton>
          </div>
          <ol className="img-video__conceptos">
            {conceptos.map((c, i) => (
              <li key={i} className="img-video__concepto">
                <div className="img-video__concepto-cabeza">
                  <span className="img-video__chip">{NOMBRE_ANGULO[c.angulo] || c.angulo}</span>
                  <span className="t-mini t-3">{[c.faceta, c.momento].filter(Boolean).join(' · ')}</span>
                  <button type="button" className="img-video__quitar" onClick={() => setConceptos((l) => l.filter((_, k) => k !== i))} disabled={bloqueado || conceptos.length <= 1} aria-label={`Quitar el anuncio ${i + 1}`}>
                    <X size={13} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                </div>
                <CampoTexto aria-label={`Titular del anuncio ${i + 1}`} value={c.titular} maxLength={90} onChange={(e) => setConceptos((l) => l.map((x, k) => (k === i ? { ...x, titular: e.target.value } : x)))} disabled={bloqueado} />
                <AreaTexto
                  etiqueta="Lo que se ve"
                  aria-label={`Lo que se ve en el anuncio ${i + 1}`}
                  filas={3}
                  maxLength={600}
                  value={c.escena || ''}
                  placeholder="Describe la escena: quién aparece, dónde, qué se ve del resultado, la luz y los colores."
                  onChange={(e) => setConceptos((l) => l.map((x, k) => (k === i ? { ...x, escena: e.target.value } : x)))}
                  disabled={bloqueado}
                  className="img-video__escena"
                />
              </li>
            ))}
          </ol>
          <p className="img-ayuda">Cada uno sale con una plantilla ganadora distinta, tu producto, tus colores, este titular y esta escena (puedes cambiar los dos).</p>
        </>
      ) : null}
    </div>
  );
}

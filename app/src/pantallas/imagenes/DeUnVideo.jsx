// «De un video, imágenes» (2026-11-17p): eliges un video (lo subes, uno de tus anuncios o uno de Inspiración) y la app
// saca, en la computadora y gratis, el cuadro más nítido de cada toma, le quita los subtítulos y propone varias imágenes
// con ángulos distintos (dolor, antes y después, mecanismo, prueba social…). Con «Elegir con mi IA» (opcional: usa tu
// plan de Claude o ChatGPT) tu IA mira los cuadros y elige los textos. Cada imagen sale con las plantillas, sin costo.
import { useEffect, useRef, useState } from 'react';
import { Clapperboard, Film, LoaderCircle, Sparkles, Trash2 } from 'lucide-react';
import { Boton, Chip, Selector, SubirVideo } from '../../componentes/index.js';
import { apiImagenes } from '../../datos/imagenes.js';
import { pedirNuevo } from '../../datos/api.js';

export const ANGULOS = [
  { id: 'dolor', nombre: 'Dolor', plantilla: 'foto-tiktok' },
  { id: 'antes-despues', nombre: 'Antes y después', plantilla: 'antes-despues' },
  { id: 'mecanismo', nombre: 'Mecanismo', plantilla: 'foto-titular' },
  { id: 'prueba-social', nombre: 'Prueba social', plantilla: 'foto-tiktok' },
  { id: 'estatus', nombre: 'Estatus', plantilla: 'foto-titular' },
  { id: 'objecion', nombre: 'Objeción', plantilla: 'foto-tiktok' },
  { id: 'ingrediente', nombre: 'Ingrediente', plantilla: 'foto-titular' },
  { id: 'producto', nombre: 'Producto', plantilla: 'foto-titular' },
];
const NOMBRE_PLANTILLA = { 'foto-tiktok': 'Foto con subtítulos de TikTok', 'foto-titular': 'Foto con titular', 'antes-despues': 'Antes y después' };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * videoPedido: 'subido:<id>|<nombre>' (de Inspiración) · productoId · bloqueado
 * onCambiar({ id, seleccion }) cada vez que cambia lo elegido (null si todavía no hay)
 */
export function DeUnVideo({ videoPedido = null, productoId, bloqueado, onCambiar }) {
  const [subido, setSubido] = useState(videoPedido);
  const [anuncios, setAnuncios] = useState([]);
  const [trabajo, setTrabajo] = useState(null); // la respuesta de GET /video/:id
  const [seleccion, setSeleccion] = useState([]);
  const [cantidad, setCantidad] = useState(6);
  const [ocupado, setOcupado] = useState(null); // 'analizando' | 'eligiendo' | 'ia'
  const [error, setError] = useState(null);
  const [nota, setNota] = useState(null);
  const vivo = useRef(true);
  useEffect(() => () => (vivo.current = false), []);

  // tus anuncios con video (para elegir uno)
  useEffect(() => {
    pedirNuevo('/api/anuncios')
      .then((r) => vivo.current && setAnuncios((r?.anuncios || []).filter((a) => a.video).slice(0, 60)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    onCambiar(trabajo?.estado === 'listo' && seleccion.length ? { id: trabajo.id, seleccion } : null);
  }, [trabajo?.id, trabajo?.estado, seleccion]); // eslint-disable-line react-hooks/exhaustive-deps

  const elegir = async (id, { conIA = false, n = cantidad } = {}) => {
    setOcupado(conIA ? 'ia' : 'eligiendo');
    setError(null);
    try {
      const r = await apiImagenes.videoElegir(id, { cantidad: n, conIA, productoId });
      if (!vivo.current) return;
      setSeleccion(r.seleccion || []);
      setNota(conIA ? (r.conIA ? `Tu IA eligió ${r.seleccion.length} en ${(r.ms / 1000).toFixed(0)} s.` : `Tu IA no pudo elegir${r.motivo ? ` (${r.motivo})` : ''}: quedó la elección de la app.`) : null);
    } catch (e) {
      setError(e.message);
    } finally {
      if (vivo.current) setOcupado(null);
    }
  };

  const analizar = async (cuerpo) => {
    setOcupado('analizando');
    setError(null);
    setTrabajo(null);
    setSeleccion([]);
    setNota(null);
    try {
      const { id } = await apiImagenes.videoCrear(cuerpo);
      for (let i = 0; i < 600 && vivo.current; i++) {
        const e = await apiImagenes.video(id);
        setTrabajo(e);
        if (e.estado === 'listo') {
          await elegir(id);
          return;
        }
        if (e.estado === 'error') throw new Error(e.error || 'No pude analizar ese video.');
        await esperar(i < 10 ? 500 : 1000);
      }
    } catch (e) {
      if (vivo.current) setError(e.message);
    } finally {
      if (vivo.current) setOcupado((o) => (o === 'analizando' ? null : o));
    }
  };

  // un video nuevo (subido o de Inspiración): se analiza solo
  useEffect(() => {
    if (subido && /^subido:/.test(subido)) analizar({ subido });
  }, [subido]); // eslint-disable-line react-hooks/exhaustive-deps

  const cuadro = (n) => trabajo?.cuadros?.find((c) => c.n === n);
  const cambiarAngulo = (i, angulo) => {
    const a = ANGULOS.find((x) => x.id === angulo);
    setSeleccion((s) =>
      s.map((x, k) => {
        if (k !== i) return x;
        // un antes y después necesita dos cuadros: se suma el último del video
        const cuadros = a.plantilla === 'antes-despues' ? (x.cuadros.length >= 2 ? x.cuadros : [x.cuadros[0], trabajo.cuadros[trabajo.cuadros.length - 1].n]) : [x.cuadros[0]];
        return { ...x, angulo, plantilla: a.plantilla, cuadros, textos: {} };
      })
    );
  };

  return (
    <div className="img-video">
      <SubirVideo valor={subido} onCambio={setSubido} deshabilitado={bloqueado || ocupado === 'analizando'} conLink={false} />
      {anuncios.length ? (
        <Selector
          etiqueta="O uno de tus anuncios"
          value=""
          onChange={(e) => e.target.value && analizar({ anuncio: e.target.value })}
          disabled={bloqueado || ocupado === 'analizando'}
          opciones={[{ valor: '', etiqueta: 'Elige uno de tus anuncios…' }, ...anuncios.map((a) => ({ valor: a.slug, etiqueta: a.titulo || a.slug }))]}
        />
      ) : null}
      {ocupado === 'analizando' ? (
        <p className="img-nota" role="status">
          <LoaderCircle size={14} strokeWidth={2} className="girando" aria-hidden="true" />
          <span>{trabajo?.avance || 'Preparando tu video'}… (en tu computadora, gratis)</span>
        </p>
      ) : null}
      {error ? (
        <p className="img-nota img-nota--aviso" role="alert">
          <Film size={14} strokeWidth={2} aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
      {trabajo?.estado === 'listo' ? (
        <>
          <p className="img-nota img-nota--ok" role="status">
            <Clapperboard size={14} strokeWidth={2} aria-hidden="true" />
            <span>
              {trabajo.tomas} {trabajo.tomas === 1 ? 'toma' : 'tomas'} en {Math.round(trabajo.duracion || 0)} s de video, analizadas en {((trabajo.ms || 0) / 1000).toFixed(1)} s: de cada una, el cuadro más nítido y sin subtítulos.
              {nota ? ` ${nota}` : ''}
            </span>
          </p>
          <div className="img-video__acciones">
            <span className="t-chico t-3">Cuántas</span>
            {[4, 6, 8, 10].map((k) => (
              <Chip key={k} activo={cantidad === k} onClick={() => { setCantidad(k); elegir(trabajo.id, { n: k }); }} disabled={bloqueado || Boolean(ocupado)}>
                {k}
              </Chip>
            ))}
            <Boton variante="secundario" tamano="chico" icono={Sparkles} cargando={ocupado === 'ia'} onClick={() => elegir(trabajo.id, { conIA: true })} disabled={bloqueado || Boolean(ocupado)}>
              Elegir con mi IA
            </Boton>
          </div>
          <p className="img-ayuda">«Elegir con mi IA» es opcional: mira los cuadros y escribe los textos con tu plan de Claude o ChatGPT (sin costo por imagen). Sin ella, la app elige los más nítidos repartidos en el video.</p>
          <div className="img-video__rejilla">
            {seleccion.map((x, i) => (
              <div key={`${i}-${x.cuadros.join('-')}`} className="img-video__item">
                <div className={`img-video__fotos${x.cuadros.length > 1 ? ' img-video__fotos--dos' : ''}`}>
                  {x.cuadros.map((n) => (cuadro(n) ? <img key={n} src={cuadro(n).url} alt={`Toma ${n}`} loading="lazy" draggable="false" /> : null))}
                </div>
                <Selector etiqueta={`Imagen ${i + 1}`} value={x.angulo} onChange={(e) => cambiarAngulo(i, e.target.value)} disabled={bloqueado} opciones={ANGULOS.map((a) => ({ valor: a.id, etiqueta: a.nombre }))} />
                <span className="t-mini t-3">
                  {NOMBRE_PLANTILLA[x.plantilla] || x.plantilla} · toma {x.cuadros.join(' y ')}
                </span>
                <Boton variante="fantasma" tamano="chico" icono={Trash2} onClick={() => setSeleccion((s) => s.filter((_, k) => k !== i))} disabled={bloqueado || seleccion.length <= 1}>
                  Quitar
                </Boton>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

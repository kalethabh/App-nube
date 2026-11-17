// EDITAR CON IA (debajo de la vista previa): lo que quieres cambiar, con tus palabras, en un solo campo.
//   «todo lo que diga AMUA se censura» · «donde diga AMUA coloca VITALABH» · «donde diga AMUA pon algo que lo siga y lo
//   tape» · «recorta las escenas donde sale el frasco viejo» · «ENVÍO GRATIS arriba en todo el video».
// La IA dice qué hacer y el servidor calcula cuándo (rutas/editar-ia.js); todo entra como un solo paso del historial
// (acciones.aplicarIA en index.jsx). Si el pedido es sobre un texto de la pantalla y todavía no se leyeron, los lee
// (gratis, en esta PC) y vuelve a pedirlo solo.
import { useEffect, useRef, useState } from 'react';
import { Sparkles, VolumeX, X } from 'lucide-react';
import { Boton, useAvisos } from '../../componentes/index.js';
import { pedirNuevo } from '../../datos/api.js';
import { useTextosVideo } from './seguimiento.js';
import { buscarDichas, palabrasDeLaVoz } from './modelo.js';
import { pedidoDeVoz } from './pedido-voz.js';

const EJEMPLOS = ['Lo que diga AMUA mutearlo', 'Todo lo que diga AMUA se censura', 'Donde diga AMUA coloca VITALABH', 'Donde diga AMUA difumínalo para que no se lea', 'Recorta las escenas donde sale el frasco'];

export function EditarConIA({ acciones, ed, cambiar, plan }) {
  const { aviso } = useAvisos();
  const tv = useTextosVideo(acciones.slug);
  const [pedido, setPedido] = useState('');
  const [ocupado, setOcupado] = useState(null); // 'ia' | 'leer' | 'aplicar'
  const [nota, setNota] = useState(null);
  const pendiente = useRef(null); // el pedido que espera a que se lean los textos del video

  const pedir = async (texto) => {
    setOcupado('ia');
    setNota(null);
    try {
      const r = await pedirNuevo(`/api/anuncios/${encodeURIComponent(acciones.slug)}/editar/ia`, { metodo: 'POST', cuerpo: { pedido: texto, estado: ed } });
      if (r.necesitaLeer && tv.estado !== 'listo' && !pendiente.current) {
        // los textos de la pantalla todavía no se leyeron: se leen y se vuelve a pedir solo
        pendiente.current = texto;
        setOcupado('leer');
        setNota({ texto: 'Leyendo los textos del video para encontrar lo que pediste (gratis, unos 30 s por minuto)…' });
        await tv.leer();
        return;
      }
      pendiente.current = null;
      setOcupado('aplicar');
      const hecho = await acciones.aplicarIA(r, tv.pistas, ed);
      const partes = [];
      if (hecho.censuras) partes.push(`${hecho.censuras} ${hecho.censuras === 1 ? 'palabra censurada' : 'palabras censuradas'}`);
      if (hecho.textos) partes.push(`${hecho.textos} ${hecho.textos === 1 ? 'texto' : 'textos'}`);
      if (hecho.tapados) partes.push(`${hecho.tapados} ${hecho.tapados === 1 ? 'texto difuminado' : 'textos difuminados'}`);
      if (hecho.quitadas) partes.push(`${hecho.quitadas} ${hecho.quitadas === 1 ? 'escena quitada' : 'escenas quitadas'}`);
      const extra = [r.mensaje, ...(r.avisos || [])].filter(Boolean).join(' ');
      if (!partes.length) {
        setNota({ error: true, texto: extra || 'No encontré qué cambiar. Escribe la palabra o el texto entre comillas.' });
        return;
      }
      setNota({ texto: `Listo: ${partes.join(', ')}. ${extra} Deshacer (Ctrl+Z) lo quita.`.trim() });
      setPedido('');
    } catch (e) {
      pendiente.current = null;
      setNota({ error: true, texto: e.message });
    } finally {
      setOcupado((x) => (x === 'leer' ? x : null));
    }
  };

  // terminada la lectura de los textos del video, el pedido que esperaba sigue solo
  useEffect(() => {
    if (ocupado !== 'leer' || !pendiente.current) return;
    if (tv.estado === 'listo') {
      const texto = pendiente.current;
      pedir(texto);
    } else if (tv.estado === 'error') {
      pendiente.current = null;
      setOcupado(null);
      setNota({ error: true, texto: tv.error || 'No pude leer los textos del video.' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tv.estado, ocupado]);

  const enviar = async () => {
    const texto = pedido.trim();
    if (!texto || ocupado) return;
    // callar o ponerle pitido a lo que se dice: aquí mismo, gratis, sin la IA
    const voz = plan ? pedidoDeVoz(texto) : null;
    if (voz) {
      const palabras = palabrasDeLaVoz(plan, ed);
      if (!palabras.length) {
        setNota({ error: true, texto: plan.videoPropio ? 'Este video todavía no tiene las palabras de la voz. Ve a la pestaña Audio y toca «Transcribir la voz».' : 'Este anuncio no trae las palabras de la voz con sus tiempos.' });
        return;
      }
      const halladas = buscarDichas(palabras, voz.palabras);
      if (!halladas.length) {
        setNota({ error: true, texto: `No encontré ${voz.palabras.map((x) => `«${x}»`).join(', ')} en la voz. Escríbela como suena o búscala en la pestaña Audio.` });
        return;
      }
      setOcupado('aplicar');
      try {
        await acciones.censurar(halladas, voz.modo, `${voz.modo === 'pitido' ? 'Pitido' : 'Silenciar'} ${voz.palabras.map((x) => `«${x}»`).join(', ')}`);
        setNota({ texto: `Listo: ${halladas.length === 1 ? 'la palabra queda' : `las ${halladas.length} veces quedan`} ${voz.modo === 'pitido' ? 'con pitido' : 'en silencio'} (gratis, sin la IA). Las ves en la pista Censuras; Deshacer (Ctrl+Z) lo quita.` });
        setPedido('');
      } finally {
        setOcupado(null);
      }
      return;
    }
    pedir(texto);
  };

  const censuras = ed.censuras || [];
  const quitarCensuras = () => {
    cambiar((s) => ({ ...s, censuras: [] }), { etiqueta: 'Quitar las censuras' });
    aviso({ tipo: 'info', titulo: 'La voz vuelve a sonar entera', texto: 'Deshacer las vuelve a poner.' });
  };

  return (
    <section className="ed-ia" aria-label="Editar con IA">
      <form
        className="ed-ia__fila"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <Sparkles size={15} strokeWidth={2.2} className="ed-ia__icono" aria-hidden="true" />
        <input
          className="ed-ia__entrada"
          value={pedido}
          onChange={(e) => setPedido(e.target.value)}
          placeholder={`Edita con tus palabras. Ej.: ${EJEMPLOS[0]}`}
          aria-label="Qué quieres cambiar del video"
          maxLength={1000}
          disabled={Boolean(ocupado)}
          list="ed-ia-ejemplos"
        />
        <datalist id="ed-ia-ejemplos">
          {EJEMPLOS.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
        <Boton type="submit" variante="primario" tamano="chico" cargando={Boolean(ocupado)} disabled={!pedido.trim()}>
          {ocupado === 'leer' ? 'Leyendo…' : ocupado === 'aplicar' ? 'Aplicando…' : 'Hacerlo'}
        </Boton>
      </form>
      {nota || censuras.length ? (
        <div className="ed-ia__pie">
          {nota ? <p className={`ed-ia__nota${nota.error ? ' ed-nota--error' : ''}`}>{nota.texto}</p> : <span />}
          {censuras.length ? (
            <button type="button" className="ed-ia__censuras" onClick={quitarCensuras} title="Quitar todas las censuras de la voz">
              <VolumeX size={12} strokeWidth={2.2} aria-hidden="true" />
              {censuras.length} {censuras.length === 1 ? 'censura' : 'censuras'}
              <X size={12} strokeWidth={2.4} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

// «Editar un video tuyo» (2026-11-14): cualquier video (uno tuyo, uno que bajaste, el que dejó «Cambiar el producto»)
// entra al editor como un anuncio más. Lo prepara rutas/video-propio.js (gratis; los subtítulos, si se piden,
// transcriben el audio con ElevenLabs: centavos) y al terminar se abre el editor.
//
//   <BotonEditarVideo />                                   sube un video de la PC
//   <BotonEditarVideo archivo="<slug>_cambiado.mp4" />     uno que ya está en output/ (sin subirlo)
import { useEffect, useRef, useState } from 'react';
import { CircleAlert, Film, Scissors, Upload } from 'lucide-react';
import { BarraDeProgreso, Boton, Interruptor, Modal } from '../../componentes/index.js';
import { invalidar, pedirNuevo } from '../../datos/api.js';
import { ir, rutas } from '../../datos/rutas.js';
import './EditarVideoPropio.css';

const ES_VIDEO = /\.(mp4|m4v|mov|webm|mkv|avi|3gp|mpe?g)$/i;

/** Sube el video con su avance (fetch no lo da). -> { slug } */
function subir(archivo, subtitulos, alAvanzar) {
  return new Promise((resolver, rechazar) => {
    const x = new XMLHttpRequest();
    x.open('POST', `/api/videos-propios?${new URLSearchParams({ nombre: archivo.name.slice(0, 160), subtitulos: subtitulos ? '1' : '0' })}`);
    x.setRequestHeader('Content-Type', archivo.type || 'video/mp4');
    x.setRequestHeader('Accept', 'application/json');
    x.upload.onprogress = (e) => e.lengthComputable && alAvanzar(Math.round((e.loaded / e.total) * 100));
    x.onerror = () => rechazar(new Error('No pude conectar con la app. ¿Sigue abierta la ventana del lanzador?'));
    x.onload = () => {
      let d = null;
      try {
        d = JSON.parse(x.responseText);
      } catch {
        d = null;
      }
      if (x.status >= 200 && x.status < 300 && d?.slug) resolver(d);
      else rechazar(new Error(d?.error || 'No pude subir ese video. Vuelve a intentarlo.'));
    };
    x.send(archivo);
  });
}

export function ModalEditarVideo({ abierto, onCerrar, archivo: deSalida = null }) {
  const [archivo, setArchivo] = useState(null);
  const [subtitulos, setSubtitulos] = useState(true);
  const [fase, setFase] = useState(null); // null | 'subiendo' | 'preparando' | 'error'
  const [valor, setValor] = useState(0);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState(null);
  const [encima, setEncima] = useState(false);
  const [slug, setSlug] = useState(null);
  const entrada = useRef(null);

  useEffect(() => {
    if (!abierto) {
      setArchivo(null);
      setFase(null);
      setValor(0);
      setError(null);
      setSlug(null);
    }
  }, [abierto]);

  // mientras se prepara: el avance, y al terminar, al editor
  useEffect(() => {
    if (!slug || fase !== 'preparando') return undefined;
    let vivo = true;
    const mirar = async () => {
      try {
        const e = await pedirNuevo(`/api/videos-propios/${encodeURIComponent(slug)}`);
        if (!vivo) return;
        if (e.etapa === 'listo') {
          invalidar('anuncios');
          onCerrar?.();
          ir(rutas.editor(slug));
          return;
        }
        if (e.etapa === 'error') {
          setFase('error');
          setError(e.error || 'No pude preparar tu video.');
          return;
        }
        setValor(Number(e.valor) || 0);
        setTexto(e.texto || 'Preparando tu video');
      } catch {
        /* se vuelve a mirar */
      }
      if (vivo) setTimeout(mirar, 1200);
    };
    mirar();
    return () => {
      vivo = false;
    };
  }, [slug, fase, onCerrar]);

  const elegir = (f) => {
    if (!f) return;
    if (!/^video\//.test(f.type || '') && !ES_VIDEO.test(f.name)) return setError('Eso no es un video. Usa un MP4, MOV o WEBM.');
    setError(null);
    setArchivo(f);
  };

  const empezar = async () => {
    setError(null);
    try {
      let r;
      if (deSalida) {
        setFase('preparando');
        r = await pedirNuevo('/api/videos-propios/desde-salida', { metodo: 'POST', cuerpo: { archivo: deSalida, subtitulos } });
      } else {
        setFase('subiendo');
        setValor(0);
        r = await subir(archivo, subtitulos, setValor);
        setFase('preparando');
      }
      setValor(0);
      setTexto('Preparando tu video');
      setSlug(r.slug);
    } catch (e) {
      setFase('error');
      setError(e.message);
    }
  };

  const trabajando = fase === 'subiendo' || fase === 'preparando';
  const listoParaEmpezar = Boolean(deSalida || archivo) && !trabajando;
  return (
    <Modal
      abierto={abierto}
      onCerrar={trabajando ? undefined : onCerrar}
      cerrarAfuera={!trabajando}
      icono={Scissors}
      titulo={deSalida ? 'Abrir en el editor' : 'Editar un video tuyo'}
      descripcion="Se abre en el editor dividido en escenas, con su audio aparte: puedes cortar, mover, acelerar o reemplazar escenas, y ponerle textos, tu logo, subtítulos y música. Es gratis."
      pie={
        trabajando ? null : (
          <>
            <Boton variante="fantasma" onClick={onCerrar}>
              Cancelar
            </Boton>
            <Boton variante="primario" icono={Scissors} onClick={empezar} disabled={!listoParaEmpezar}>
              {fase === 'error' ? 'Intentar de nuevo' : 'Abrir en el editor'}
            </Boton>
          </>
        )
      }
    >
      <div className="pila" style={{ '--hueco': '16px' }}>
        {deSalida ? (
          <div className="cb-subido">
            <Film size={18} strokeWidth={2} aria-hidden="true" />
            <span>{deSalida}</span>
          </div>
        ) : trabajando ? null : (
          <button
            type="button"
            className={`evp-zona${encima ? ' evp-zona--encima' : ''}`}
            onClick={() => entrada.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setEncima(true);
            }}
            onDragLeave={() => setEncima(false)}
            onDrop={(e) => {
              e.preventDefault();
              setEncima(false);
              elegir(e.dataTransfer.files?.[0]);
            }}
          >
            {archivo ? <Film size={22} strokeWidth={2} aria-hidden="true" /> : <Upload size={22} strokeWidth={2} aria-hidden="true" />}
            <strong>{archivo ? archivo.name : 'Arrastra tu video aquí o haz clic para elegirlo'}</strong>
            <span>{archivo ? `${Math.max(1, Math.round(archivo.size / 1048576))} MB · clic para cambiarlo` : 'MP4, MOV o WEBM, hasta 1 GB y 10 minutos. Si no es vertical, va entero sobre su fondo difuminado.'}</span>
            <input ref={entrada} type="file" accept="video/*,.mp4,.mov,.m4v,.webm" hidden onChange={(e) => elegir(e.target.files?.[0])} />
          </button>
        )}
        {trabajando ? null : (
          <Interruptor
            activado={subtitulos}
            onCambio={setSubtitulos}
            etiqueta="Subtítulos de lo que se dice"
            descripcion="Se escriben solos con ElevenLabs (unos centavos). Después los corriges o los quitas en el editor."
          />
        )}
        {trabajando ? (
          <BarraDeProgreso
            valor={valor}
            animada
            etiqueta={fase === 'subiendo' ? 'Subiendo tu video' : texto || 'Preparando tu video'}
            mostrarValor
          />
        ) : null}
        {error ? (
          <p className="evp-error" role="alert">
            <CircleAlert size={14} aria-hidden="true" /> {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

export function BotonEditarVideo({ archivo = null, variante = 'secundario', tamano, children }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Boton variante={variante} tamano={tamano} icono={Scissors} onClick={() => setAbierto(true)}>
        {children || (archivo ? 'Abrir en el editor' : 'Editar un video tuyo')}
      </Boton>
      <ModalEditarVideo abierto={abierto} onCerrar={() => setAbierto(false)} archivo={archivo} />
    </>
  );
}

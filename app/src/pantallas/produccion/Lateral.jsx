// La columna de la derecha: lo que te necesita, la voz y la música, y el registro en frases simples.
import { useEffect, useRef, useState } from 'react';
import { AudioLines, CirclePause, EighthNotes, Hand, ImageIcon, ListChecks, Music, Pause, Play, RefreshCw, ScrollText, TriangleAlert, Wallet, WifiOff } from 'lucide-react';
import { Boton, PuntoEstado, Tarjeta, TarjetaCabecera, VistaPrevia } from '../../componentes/index.js';
import { fechaRelativa } from '../../datos/formato.js';
import { claveRegistro, haceSim } from './simulacion.js';

// ---------------------------------------------------------------- te necesita

const ICONOS_NECESITA = { revision: ListChecks, cancion: EighthNotes, imagen: ImageIcon, error: TriangleAlert, saldo: Wallet, pausa: CirclePause, conexion: WifiOff, reintento: RefreshCw };

/**
 * Las tarjetas de lo que frena al anuncio. Cada una: { id, icono, titulo, texto, accion, alHacer,
 * iconoBoton, cargando?, secundaria?: { texto, href?, alHacer?, icono? }, tono?: 'aviso' (solo espera),
 * sobre? (el texto chico de arriba) }.
 */
export function TeNecesita({ tarjetas }) {
  if (!tarjetas.length) return null;
  return (
    <div className="prod-necesita pila" style={{ '--hueco': '12px' }}>
      {tarjetas.map((t) => {
        const Icono = ICONOS_NECESITA[t.icono] || Hand;
        const suave = t.tono === 'aviso';
        return (
          <div key={t.id} className={`prod-necesita__tarjeta${suave ? ' prod-necesita__tarjeta--aviso' : ''}`} role={suave ? 'status' : 'alert'}>
            <span className="prod-necesita__icono" aria-hidden="true">
              <Icono size={18} strokeWidth={2.2} />
            </span>
            <div className="prod-necesita__textos">
              <span className="prod-necesita__sobre">
                {suave ? <PuntoEstado tono="aviso" /> : <PuntoEstado estado={t.icono === 'error' ? 'error' : 'te-necesita'} />} {t.sobre || (t.icono === 'error' ? 'Algo falló' : 'Te necesita')}
              </span>
              <strong className="prod-necesita__titulo">{t.titulo}</strong>
              <p className="prod-necesita__texto">{t.texto}</p>
            </div>
            <div className="prod-necesita__acciones">
              {t.nota ? <span className="t-mini">{t.nota}</span> : null}
              {t.secundaria ? (
                <Boton variante="fantasma" href={t.secundaria.href} onClick={t.secundaria.alHacer} icono={t.secundaria.icono}>
                  {t.secundaria.texto}
                </Boton>
              ) : null}
              <Boton variante={suave ? 'secundario' : 'primario'} onClick={t.alHacer} iconoDerecha={t.iconoBoton} cargando={t.cargando}>
                {t.accion}
              </Boton>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- voz y música

function FilaAudio({ icono: Icono, nombre, detalle, src, lista, tono, espera = 'Se está haciendo…' }) {
  const ref = useRef(null);
  const [sonando, setSonando] = useState(false);
  const [avance, setAvance] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const alAvanzar = () => setAvance(el.duration ? el.currentTime / el.duration : 0);
    const alParar = () => setSonando(false);
    el.addEventListener('timeupdate', alAvanzar);
    el.addEventListener('pause', alParar);
    el.addEventListener('ended', alParar);
    return () => {
      el.removeEventListener('timeupdate', alAvanzar);
      el.removeEventListener('pause', alParar);
      el.removeEventListener('ended', alParar);
    };
  }, [src, lista]);
  const alternar = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      document.querySelectorAll('.prod-audio audio').forEach((x) => x !== el && x.pause());
      el.play().then(() => setSonando(true), () => setSonando(false));
    } else el.pause();
  };
  return (
    <div className={`prod-audio__fila${lista ? '' : ' prod-audio__fila--espera'}`} style={{ '--c-pista': tono }}>
      <span className="prod-audio__icono" aria-hidden="true">
        <Icono size={15} strokeWidth={2.2} />
      </span>
      <div className="prod-audio__textos">
        <span className="prod-audio__nombre">{nombre}</span>
        <span className="prod-audio__detalle">{lista ? detalle : espera}</span>
        <span className="prod-audio__onda" aria-hidden="true">
          {Array.from({ length: 34 }, (_, i) => (
            <i key={i} style={{ '--h': `${28 + Math.abs(Math.sin(i * 1.7 + nombre.length)) * 72}%`, '--on': i / 34 < avance ? 1 : 0 }} />
          ))}
        </span>
      </div>
      {lista && src ? (
        <>
          <Boton variante="secundario" tamano="chico" soloIcono icono={sonando ? Pause : Play} etiqueta={sonando ? `Pausar ${nombre}` : `Escuchar ${nombre}`} onClick={alternar} />
          <audio ref={ref} src={src} preload="none" />
        </>
      ) : (
        <PuntoEstado estado={lista ? 'listo' : espera === 'Se está haciendo…' ? 'generando' : 'en-cola'} />
      )}
    </div>
  );
}

/**
 * La voz y la música. Con `enVivo` (hay conductor) también se ven antes de existir: "Se está haciendo…"
 * mientras su paso corre; si todavía no le toca, cuándo llega ("Va primero", "Después de los videos").
 */
export function Audio({ a, vozLista, musicaLista, cantado, hablado, enVivo = null }) {
  const filas = [];
  const voz = a.audio?.voz;
  const musica = a.audio?.musica;
  if (cantado && a.audio?.cancion) filas.push({ icono: Music, nombre: a.audio.cancionTitulo ? `«${a.audio.cancionTitulo}»` : 'Tu canción', detalle: 'La canción que elegiste', src: a.audio.cancion, lista: true, tono: 'var(--pista-musica)' });
  if (!hablado && !cantado && (voz || enVivo))
    filas.push({
      icono: AudioLines,
      nombre: 'Voz en off',
      detalle: 'ElevenLabs · lista',
      src: voz,
      lista: Boolean(voz) && vozLista,
      tono: 'var(--pista-voz)',
      espera: enVivo?.vozHaciendo ? 'Se está haciendo…' : 'Va primero',
    });
  if (!cantado && (musica || (enVivo && !hablado)))
    filas.push({
      icono: Music,
      nombre: 'Música de fondo',
      detalle: 'Lista',
      src: musica,
      lista: Boolean(musica) && musicaLista,
      tono: 'var(--pista-musica)',
      espera: enVivo?.musicaHaciendo ? 'Se está haciendo…' : 'Después de los videos',
    });
  if (!filas.length) return null;
  return (
    <Tarjeta relleno="compacto" className="prod-audio">
      <TarjetaCabecera
        icono={AudioLines}
        tono="ok"
        titulo={hablado ? 'Música' : 'Voz y música'}
        subtitulo={enVivo ? 'La voz va primero: de ella salen los tiempos de cada toma.' : 'Van primero: no dependen de las imágenes.'}
      />
      <div className="pila" style={{ '--hueco': '10px' }}>
        {filas.map((f) => (
          <FilaAudio key={f.nombre} {...f} />
        ))}
      </div>
    </Tarjeta>
  );
}

// ---------------------------------------------------------------- registro

export function Registro({ entradas, simulando, tAhora, onAbrir, ejemplo, enVivo = false }) {
  return (
    <Tarjeta relleno="ninguno" className="prod-registro">
      <div className="prod-registro__cabecera">
        <TarjetaCabecera
          icono={ScrollText}
          tono="neutro"
          titulo="Registro"
          subtitulo={simulando || enVivo ? 'Lo que va pasando, en palabras simples.' : 'Lo que pasó con este anuncio, según sus archivos.'}
          acciones={ejemplo ? <VistaPrevia texto="Ejemplo" /> : null}
        />
      </div>
      {entradas.length ? (
        <ol className="prod-registro__lista" aria-live="polite">
          {entradas.map((e) => {
            const clave = claveRegistro(e);
            const cuando = simulando ? haceSim(tAhora - e.en) : fechaRelativa(e.fecha);
            const contenido = (
              <>
                <PuntoEstado estado={e.estado} />
                <span className="prod-registro__texto">{e.texto}</span>
                <span className="prod-registro__cuando t-num">{cuando}</span>
              </>
            );
            return (
              <li key={clave} className={`prod-registro__item prod-registro__item--${e.estado}${e.destacado ? ' prod-registro__item--destacado' : ''}`}>
                {e.pieza && onAbrir ? (
                  <button type="button" className="prod-registro__boton" onClick={() => onAbrir(e.pieza)}>
                    {contenido}
                  </button>
                ) : (
                  <div className="prod-registro__boton prod-registro__boton--quieto">{contenido}</div>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="prod-registro__vacio t-chico">Todavía no pasó nada. Las primeras líneas llegan en segundos.</p>
      )}
    </Tarjeta>
  );
}

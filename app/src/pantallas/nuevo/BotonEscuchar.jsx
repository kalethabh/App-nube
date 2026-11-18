// El botón «Escuchar» de una muestra de audio (la voz de ElevenLabs, la música): lo usan el paso «Tu anuncio» y la
// tarjeta de la voz en la pantalla del guion.
import { Pause, Play } from 'lucide-react';
import { useMuestraDeAudio } from './reproductor.js';

export function BotonEscuchar({ id, url, desde, segundos = 12, etiqueta = 'Escuchar', disabled = false }) {
  const { sonando, alternar } = useMuestraDeAudio();
  const suena = !disabled && sonando === id;
  return (
    <button
      type="button"
      className={`nv-escuchar${suena ? ' nv-escuchar--suena' : ''}`}
      onClick={() => url && alternar(id, url, { desde, segundos })}
      aria-pressed={suena}
      disabled={disabled}
    >
      {suena ? <Pause size={14} strokeWidth={2.4} fill="currentColor" aria-hidden="true" /> : <Play size={14} strokeWidth={2.4} fill="currentColor" aria-hidden="true" />}
      <span>{suena ? 'Pausar' : etiqueta}</span>
      {suena ? (
        <span className="nv-ondas" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      ) : null}
    </button>
  );
}


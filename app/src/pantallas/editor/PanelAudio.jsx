// Pestaña AUDIO del panel izquierdo (2026-11-17j), lo básico de CapCut para el sonido, gratis y sin la IA:
//   - lo que dice la voz, palabra por palabra (las palabras con sus tiempos del montaje y tus correcciones): tocas una
//     y la silencias o le pones un pitido solo a esa;
//   - buscar una palabra («AMUA»: sin tildes ni mayúsculas, y parecida: «Amúa», «a mua», «amuas») y silenciarla o
//     ponerle pitido en todas las veces que se dice, de un toque (capas.buscarDichas, el mismo de Editar con IA);
//   - los fundidos de la voz, silenciar un tramo desde el cursor y tus audios (efectos de sonido).
// Todo entra al historial (deshacer y rehacer) por las acciones de index.jsx.
import { useMemo, useState } from 'react';
import { AudioLines, AudioWaveform, EarOff, Megaphone, Mic, Search, Undo2, VolumeX, X } from 'lucide-react';
import { Boton, EstadoVacio, Tooltip } from '../../componentes/index.js';
import { codigoDeTiempo } from '../../datos/formato.js';
import { buscarDichas, censurasDe, palabrasDeLaVoz, FUNDIDO_MAX } from './modelo.js';
import { Deslizador } from './piezas.jsx';
import { ZonaSoltar } from './PanelMedios.jsx';

const coma = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
const reloj = (t) => codigoDeTiempo(t).replace(/(\.\d)\d+$/, '$1');
const MARGEN = 0.04; // lo mismo que buscarDichas: que no se escuche ni el comienzo ni el final de la palabra

/** Una palabra de la transcripción: se toca para elegirla; la censurada se ve tachada (silencio) o en rojo (pitido). */
function Palabra({ w, censura, elegida, onElegir }) {
  return (
    <button
      type="button"
      className={`ed-audio__palabra${censura ? ` es-${censura.modo}` : ''}${elegida ? ' es-elegida' : ''}`}
      onClick={() => onElegir(w)}
      title={`${reloj(w.inicio)}${censura ? (censura.modo === 'pitido' ? ' · con pitido' : ' · silenciada') : ''}`}
    >
      {w.texto}
    </button>
  );
}

export function PanelAudio({ plan, pistas, ed, acciones }) {
  const [buscar, setBuscar] = useState('');
  const [elegida, setElegida] = useState(null); // { texto, inicio, fin }
  const censuras = ed.censuras || [];
  const palabras = useMemo(() => palabrasDeLaVoz(plan, ed), [plan, ed]);
  const halladas = useMemo(() => (buscar.trim() ? buscarDichas(palabras, [buscar.trim()]) : []), [palabras, buscar]);
  const bloques = pistas.subtitulos || [];
  const hayPalabras = bloques.some((b) => (b.palabras || []).length);
  const esCancion = pistas.voz?.modo === 'cancion';
  const tramos = pistas.voz?.tramos || [];
  const primera = tramos[0];
  const ultima = tramos[tramos.length - 1];
  const yaCensuradas = halladas.filter((h) => censurasDe(censuras, h.desde, h.hasta).length).length;

  const elegir = (w) => {
    setElegida(w);
    acciones.saltarA(w.inicio);
  };
  const censurarElegida = (modo) => {
    if (!elegida) return;
    acciones.censurar([{ desde: Math.max(0, elegida.inicio - MARGEN), hasta: elegida.fin + MARGEN, palabra: elegida.texto }], modo, modo === 'pitido' ? `Pitido en «${elegida.texto}»` : `Silenciar «${elegida.texto}»`);
  };
  const enTodas = (modo) => {
    if (!halladas.length) return;
    acciones.censurar(halladas, modo, `${modo === 'pitido' ? 'Pitido' : 'Silenciar'} «${buscar.trim()}» (${halladas.length})`);
  };
  const censuraElegida = elegida ? censurasDe(censuras, elegida.inicio, elegida.fin)[0] || null : null;

  return (
    <div className="ed-audio">
      {/* ---------------------------------------------------------------- buscar */}
      <section className="ed-grupo">
        <header className="ed-grupo__cabecera">
          <h3 className="ed-grupo__titulo">Silenciar una palabra</h3>
          {censuras.length ? (
            <Tooltip texto="La voz vuelve a sonar entera (se puede deshacer)">
              <button type="button" className="ed-ia__censuras" onClick={acciones.quitarTodasLasCensuras}>
                <EarOff size={12} strokeWidth={2.2} aria-hidden="true" />
                {censuras.length} {censuras.length === 1 ? 'censura' : 'censuras'}
                <X size={12} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </Tooltip>
          ) : null}
        </header>
        <label className="ed-audio__buscar">
          <Search size={14} strokeWidth={2.2} aria-hidden="true" />
          <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Escribe la palabra. Ej.: AMUA" aria-label="Buscar una palabra que dice la voz" disabled={!hayPalabras} maxLength={80} />
          {buscar ? (
            <button type="button" className="ed-audio__limpiar" onClick={() => setBuscar('')} aria-label="Borrar la búsqueda">
              <X size={13} strokeWidth={2.4} />
            </button>
          ) : null}
        </label>
        {buscar.trim() && hayPalabras ? (
          halladas.length ? (
            <>
              <p className="ed-nota">
                La voz dice «{buscar.trim()}» {halladas.length === 1 ? 'una vez' : `${halladas.length} veces`}
                {yaCensuradas ? ` (${yaCensuradas} ya ${yaCensuradas === 1 ? 'censurada' : 'censuradas'})` : ''}. Es gratis.
              </p>
              <div className="ed-audio__botones">
                <Boton variante="primario" tamano="chico" icono={VolumeX} onClick={() => enTodas('silencio')}>
                  Silenciar todas
                </Boton>
                <Boton variante="secundario" tamano="chico" icono={Megaphone} onClick={() => enTodas('pitido')}>
                  Pitido en todas
                </Boton>
              </div>
              <ul className="ed-audio__halladas">
                {halladas.map((h) => {
                  const c = censurasDe(censuras, h.desde, h.hasta)[0];
                  return (
                    <li key={h.desde}>
                      <button type="button" className="ed-audio__hallada" onClick={() => acciones.saltarA(h.desde)}>
                        <span className="t-mono">{reloj(h.desde)}</span>
                        <span className="ed-audio__hallada-texto">{palabras.filter((w) => w.inicio >= h.desde - 1.2 && w.fin <= h.hasta + 1.2).map((w) => w.texto).join(' ')}</span>
                        {c ? <span className={`ed-audio__marca es-${c.modo}`}>{c.modo === 'pitido' ? 'Pitido' : 'Silencio'}</span> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="ed-nota">No encontré «{buscar.trim()}» en la voz. Prueba como suena («a mua») o tócala abajo.</p>
          )
        ) : null}
      </section>

      {/* ---------------------------------------------------------------- lo que dice la voz */}
      <section className="ed-grupo">
        <header className="ed-grupo__cabecera">
          <h3 className="ed-grupo__titulo">Lo que dice la voz</h3>
        </header>
        {hayPalabras ? (
          <>
            {elegida ? (
              <div className="ed-audio__elegida">
                <span className="ed-audio__elegida-texto">
                  «{elegida.texto}» <span className="t-mono t-3">{reloj(elegida.inicio)}</span>
                </span>
                <span className="ed-audio__elegida-acciones">
                  <Boton variante={censuraElegida?.modo === 'silencio' ? 'primario' : 'secundario'} tamano="chico" icono={VolumeX} onClick={() => censurarElegida('silencio')}>
                    Silenciar
                  </Boton>
                  <Boton variante={censuraElegida?.modo === 'pitido' ? 'primario' : 'secundario'} tamano="chico" icono={Megaphone} onClick={() => censurarElegida('pitido')}>
                    Pitido
                  </Boton>
                  {censuraElegida ? (
                    <Boton variante="fantasma" tamano="chico" icono={Undo2} onClick={() => acciones.quitarCensurasEn(elegida.inicio, elegida.fin, `«${elegida.texto}» vuelve a sonar`)}>
                      Que suene
                    </Boton>
                  ) : null}
                </span>
              </div>
            ) : (
              <p className="ed-nota">Toca una palabra para silenciarla o ponerle un pitido solo a esa.</p>
            )}
            <div className="ed-audio__texto">
              {bloques.map((b) => (
                <p key={b.id} className="ed-audio__bloque">
                  {(b.palabras || []).map((w, i) => (
                    <Palabra key={`${b.id}-${i}`} w={w} censura={censurasDe(censuras, w.inicio, w.fin)[0] || null} elegida={elegida && elegida.inicio === w.inicio && elegida.texto === w.texto} onElegir={elegir} />
                  ))}
                </p>
              ))}
            </div>
          </>
        ) : plan.videoPropio ? (
          <div className="ed-audio__vacio">
            <EstadoVacio variante="compacto" icono={Mic} titulo="Todavía no están las palabras" descripcion="Subiste el video sin «Subtítulos». Para buscar y censurar lo que se dice, primero hay que escucharlo." />
            <Tooltip texto="Lo escucha ElevenLabs: cuesta unos centavos (un minuto de video, menos de 1 centavo de dólar). Se hace una sola vez.">
              <Boton variante="primario" tamano="chico" icono={AudioLines} cargando={acciones.transcribiendo} onClick={acciones.transcribir}>
                Transcribir la voz (unos centavos)
              </Boton>
            </Tooltip>
          </div>
        ) : (
          <EstadoVacio variante="compacto" icono={Mic} titulo="Sin las palabras de la voz" descripcion="Este anuncio no trae las palabras con sus tiempos. Igual puedes silenciar un tramo a mano." />
        )}
      </section>

      {/* ---------------------------------------------------------------- la voz */}
      {!esCancion && tramos.length ? (
        <section className="ed-grupo">
          <header className="ed-grupo__cabecera">
            <h3 className="ed-grupo__titulo">La voz</h3>
          </header>
          <Tooltip texto="Calla 1,5 s de la voz desde donde está el cursor">
            <Boton variante="secundario" tamano="chico" icono={VolumeX} onClick={acciones.silenciarTramo}>
              Silenciar un tramo
            </Boton>
          </Tooltip>
          <p className="ed-nota">Calla la voz desde el cursor y aparece en la pista Censuras: arrastra sus bordes para elegir justo lo que calla. Para bajarle el volumen a una parte, elige la voz en la línea de tiempo y divídela (Ctrl B).</p>
          <Deslizador icono={AudioLines} etiqueta="Fundido de entrada" valor={primera.fadeIn} min={0} max={Math.min(FUNDIDO_MAX, (primera.hasta - primera.desde) / 2)} paso={0.1} porDefecto={0} formato={(v) => (v ? `${coma(v)} s` : 'Sin fundido')} onCambio={(v) => acciones.fundidoVoz('entrada', v)} />
          <Deslizador icono={AudioLines} etiqueta="Fundido de salida" valor={ultima.fadeOut} min={0} max={Math.min(FUNDIDO_MAX, (ultima.hasta - ultima.desde) / 2)} paso={0.1} porDefecto={0} formato={(v) => (v ? `${coma(v)} s` : 'Sin fundido')} onCambio={(v) => acciones.fundidoVoz('salida', v)} />
        </section>
      ) : null}

      {/* ---------------------------------------------------------------- tus audios */}
      <section className="ed-grupo">
        <header className="ed-grupo__cabecera">
          <h3 className="ed-grupo__titulo">
            Tus audios
            {pistas.audios?.length ? <span className="ed-grupo__contador t-num">{pistas.audios.length}</span> : null}
          </h3>
        </header>
        <ZonaSoltar compacta titulo="Agrega un efecto de sonido" detalle="MP3, WAV o M4A · entra donde está el cursor" onClick={acciones.pedirAudio} onArchivo={(f) => acciones.usarAudio(f)} />
        {pistas.audios?.length ? (
          <ul className="ed-audio__lista">
            {pistas.audios.map((x) => (
              <li key={x.id}>
                <button type="button" className="ed-audio__hallada" onClick={() => acciones.irAAudio?.(x)}>
                  <AudioWaveform size={13} strokeWidth={2.2} aria-hidden="true" />
                  <span className="ed-audio__hallada-texto">{x.nombre}</span>
                  <span className="t-mono t-3">{reloj(x.desde)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

// REVISIÓN OBLIGATORIA de los estilos hablados (UGC, objeto parlante, podcast, entrevista): antes del
// primer render escuchas cada clip con su frase del guion y lo que se oyó, y decides "Está bien" o
// "Rehacer este". Con todos revisados, "Aprobar y montar".
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, CheckCheck, ChevronLeft, ChevronRight, Clock, Ear, Pause, Play, RefreshCw, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { BarraDeProgreso, Boton, Insignia, Modal, Tooltip, VistaPrevia, useAvisos } from '../../componentes/index.js';
import { miniatura } from '../../datos/api.js';
import { duracion as fmtDuracion } from '../../datos/formato.js';
import { clipsParaRevisar, compararTextos } from './modelo.js';

const TERMINADA = new Set(['listo', 'arreglado', 'te-necesita']);
const quienHabla = (h) => (h === 'A' ? 'Anfitrión A' : h === 'B' ? 'Anfitrión B' : h || null);

// ---------------------------------------------------------------- reproductor de un clip

function Reproductor({ clip, poster, onTermino }) {
  const ref = useRef(null);
  const [sonando, setSonando] = useState(false);
  const [mudo, setMudo] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(clip?.duracion || 0);

  useEffect(() => {
    const v = ref.current;
    if (!v || !clip?.video) return;
    setT(0);
    v.currentTime = 0;
    v.muted = mudo;
    v.play().then(
      () => setSonando(true),
      () => {
        // el navegador no deja arrancar con sonido sin un clic: arranca mudo
        v.muted = true;
        setMudo(true);
        v.play().then(() => setSonando(true), () => setSonando(false));
      }
    );
  }, [clip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const alternar = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().then(() => setSonando(true), () => {});
    else {
      v.pause();
      setSonando(false);
    }
  }, []);

  useEffect(() => {
    const alTeclado = (e) => {
      if (e.code === 'Space' && !/^(input|textarea|button)$/i.test(e.target?.tagName || '')) {
        e.preventDefault();
        alternar();
      }
    };
    document.addEventListener('keydown', alTeclado);
    return () => document.removeEventListener('keydown', alTeclado);
  }, [alternar]);

  const buscar = (e) => {
    const v = ref.current;
    const r = e.currentTarget.getBoundingClientRect();
    if (!v || !dur) return;
    v.currentTime = Math.max(0, Math.min(dur, ((e.clientX - r.left) / r.width) * dur));
  };

  if (!clip?.video) {
    return (
      <div className="prod-rev__reproductor prod-rev__reproductor--espera">
        <Clock size={26} strokeWidth={1.8} aria-hidden="true" />
        <span>Este clip todavía no llega</span>
      </div>
    );
  }

  return (
    <div className="prod-rev__reproductor">
      <video
        ref={ref}
        key={clip.id}
        src={clip.video}
        poster={poster}
        playsInline
        preload="auto"
        disablePictureInPicture
        onClick={alternar}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onPlay={() => setSonando(true)}
        onPause={() => setSonando(false)}
        onEnded={() => {
          setSonando(false);
          onTermino?.();
        }}
      />
      {!sonando ? (
        <button type="button" className="prod-rev__play-grande" onClick={alternar} aria-label="Reproducir el clip">
          <Play size={26} strokeWidth={2} fill="currentColor" />
        </button>
      ) : null}
      <div className="prod-rev__controles">
        <Boton variante="fantasma" tamano="chico" soloIcono icono={sonando ? Pause : Play} etiqueta={sonando ? 'Pausar' : 'Reproducir'} onClick={alternar} />
        <div className="prod-rev__linea" onClick={buscar} role="presentation">
          <span className="prod-rev__linea-relleno" style={{ transform: `scaleX(${dur ? t / dur : 0})` }} />
        </div>
        <span className="prod-rev__tiempo t-mono">
          {fmtDuracion(t)} / {fmtDuracion(dur)}
        </span>
        <Boton
          variante="fantasma"
          tamano="chico"
          soloIcono
          icono={mudo ? VolumeX : Volume2}
          etiqueta={mudo ? 'Activar sonido' : 'Silenciar'}
          onClick={() => {
            const v = ref.current;
            if (v) v.muted = !mudo;
            setMudo(!mudo);
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- lo que se oyó

function LoQueSeOyo({ linea, oido }) {
  const real = Boolean(oido?.texto);
  const { palabras, parecido } = useMemo(() => compararTextos(linea, real ? oido.texto : linea), [linea, oido, real]);
  const valor = real && oido.calidad !== null && oido.calidad !== undefined ? oido.calidad : parecido;
  const pct = Math.round(valor * 100);
  const tono = pct >= 97 ? 'ok' : pct >= 88 ? 'aviso' : 'error';
  return (
    <div className="prod-rev__oido">
      <div className="prod-rev__oido-cabecera">
        <span className="t-etiqueta">
          <Ear size={12} strokeWidth={2.4} aria-hidden="true" /> Lo que se oyó
        </span>
        <Insignia tono={tono} tamano="chico" icono={pct >= 97 ? Check : undefined}>
          {pct >= 97 ? 'Coincide con el guion' : `Coincide un ${pct} %`}
        </Insignia>
        {!real ? <VistaPrevia texto="Ejemplo" explicacion="Este anuncio no guardó la transcripción de sus clips: se muestra la frase del guion como ejemplo." /> : null}
      </div>
      <p className="prod-rev__oido-texto">
        {palabras.map((p, i) => (
          <span key={i} className={p.igual ? undefined : 'prod-rev__distinta'} title={p.igual ? undefined : 'Esta palabra no está igual en el guion'}>
            {p.w}{' '}
          </span>
        ))}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- la vista completa

export function Revision({ a, modelo, estados, simulando, aprobada, onAprobar, onVolver }) {
  const { aviso } = useAvisos();
  const lista = useMemo(() => clipsParaRevisar(modelo), [modelo]);
  const [indice, setIndice] = useState(0);
  const [decisiones, setDecisiones] = useState({});
  const [confirmar, setConfirmar] = useState(false);
  const llego = (c) => TERMINADA.has(estados.get(c.clip.id)?.estado || (simulando ? 'en-cola' : c.clip.estado));
  const actual = lista[indice];
  const decididos = lista.filter((c) => decisiones[c.clip.id]).length;
  const rehacer = lista.filter((c) => decisiones[c.clip.id] === 'rehacer');
  const todosLlegaron = lista.every(llego);
  const listo = todosLlegaron && decididos === lista.length;

  const ir = useCallback((paso) => setIndice((i) => Math.max(0, Math.min(lista.length - 1, i + paso))), [lista.length]);
  const decidir = useCallback(
    (decision) => {
      if (!actual || !llego(actual)) return;
      setDecisiones((d) => ({ ...d, [actual.clip.id]: decision }));
      // pasa solo al siguiente sin revisar
      const siguiente = lista.findIndex((c, i) => i > indice && !decisiones[c.clip.id]);
      if (siguiente !== -1) setTimeout(() => setIndice(siguiente), 260);
    },
    [actual, indice, lista, decisiones] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    const alTeclado = (e) => {
      if (document.querySelector('.modal-velo') || /^(input|textarea)$/i.test(e.target?.tagName || '')) return;
      if (e.key === 'ArrowRight') ir(1);
      if (e.key === 'ArrowLeft') ir(-1);
      if (e.key.toLowerCase() === 'b') decidir('bien');
      if (e.key.toLowerCase() === 'r' && actual && llego(actual)) setConfirmar(true);
    };
    document.addEventListener('keydown', alTeclado);
    return () => document.removeEventListener('keydown', alTeclado);
  }, [ir, decidir, actual]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!lista.length) return null;

  if (aprobada) {
    return (
      <div className="prod-rev prod-rev--aprobada">
        <div className="prod-rev__hecho">
          <span className="prod-rev__hecho-icono" aria-hidden="true">
            <CheckCheck size={26} strokeWidth={2.2} />
          </span>
          <h2 className="t-h3">Aprobaste los {lista.length} clips</h2>
          <p className="t-cuerpo">El montaje ya empezó: transiciones, subtítulos y música. En unos minutos aparece la versión completa.</p>
          <Boton variante="primario" iconoDerecha={ArrowRight} onClick={onVolver}>
            Ver la producción
          </Boton>
        </div>
      </div>
    );
  }

  const c = actual.clip;
  const g = actual.grupo;
  const decision = decisiones[c.id];
  const llegoActual = llego(actual);
  const poster = c.fuente ? miniatura(c.fuente, 640) : miniatura(c.video, 640, { segundo: 0.3 });

  return (
    <div className="prod-rev">
      {!simulando ? (
        <VistaPrevia variante="banda">
          Este anuncio ya se montó. Así se revisa cada clip antes del primer render; lo que marques aquí no cambia nada.
        </VistaPrevia>
      ) : null}

      <div className="prod-rev__principal">
        <Reproductor clip={llegoActual ? c : null} poster={poster} />

        <div className="prod-rev__info">
          <div className="prod-rev__sobre">
            <span className="t-etiqueta">
              Clip {indice + 1} de {lista.length}
            </span>
            {g.fase ? <span className="prod-toma__fase">{g.fase}</span> : null}
            {g.habla ? <span className="prod-toma__fase">{quienHabla(g.habla)}</span> : null}
            {decision ? <Insignia estado={decision === 'bien' ? 'listo' : 'arreglado'} texto={decision === 'bien' ? 'Está bien' : 'Se va a rehacer'} tamano="chico" /> : null}
          </div>

          <div className="prod-rev__guion">
            <span className="t-etiqueta">Lo que dice el guion</span>
            <p className="prod-rev__frase">«{g.linea}»</p>
          </div>

          {llegoActual ? <LoQueSeOyo linea={g.linea} oido={g.oido} /> : null}

          <dl className="prod-rev__datos">
            <div>
              <dt>Duración</dt>
              <dd className="t-mono">{fmtDuracion(c.duracion || g.duracion)}</dd>
            </div>
            <div>
              <dt>Si lo rehaces</dt>
              <dd>Tarda un minuto y medio</dd>
            </div>
          </dl>

          <div className="prod-rev__decidir">
            <Boton variante="primario" tamano="grande" icono={Check} disabled={!llegoActual} onClick={() => decidir('bien')}>
              Está bien
            </Boton>
            <Boton variante="secundario" tamano="grande" icono={RefreshCw} disabled={!llegoActual} onClick={() => setConfirmar(true)}>
              Rehacer este
            </Boton>
          </div>
          <p className="prod-rev__atajos t-mini">
            Atajos: <kbd>B</kbd> está bien · <kbd>R</kbd> rehacer · <kbd>←</kbd> <kbd>→</kbd> otro clip · <kbd>Espacio</kbd> reproducir
          </p>
        </div>
      </div>

      <div className="prod-rev__tira" role="listbox" aria-label="Clips para revisar">
        <Boton variante="fantasma" tamano="chico" soloIcono icono={ChevronLeft} etiqueta="Clip anterior" disabled={indice === 0} onClick={() => ir(-1)} />
        <div className="prod-rev__clips">
          {lista.map((x, i) => {
            const d = decisiones[x.clip.id];
            const ok = llego(x);
            return (
              <button
                key={x.clip.id}
                type="button"
                role="option"
                aria-selected={i === indice}
                className={`prod-rev__clip${i === indice ? ' prod-rev__clip--actual' : ''}${d ? ` prod-rev__clip--${d}` : ''}${ok ? '' : ' prod-rev__clip--espera'}`}
                onClick={() => setIndice(i)}
                aria-label={`Clip ${i + 1}${d === 'bien' ? ': está bien' : d === 'rehacer' ? ': se va a rehacer' : ok ? '' : ': todavía no llega'}`}
              >
                <span className="prod-rev__clip-marco">
                  {ok ? <img src={x.clip.fuente ? miniatura(x.clip.fuente, 160) : miniatura(x.clip.video, 160, { segundo: 0.6 })} alt="" loading="lazy" /> : null}
                  <span className="prod-rev__clip-n t-mono">{i + 1}</span>
                  {d ? (
                    <span className="prod-rev__clip-marca" aria-hidden="true">
                      {d === 'bien' ? <Check size={12} strokeWidth={3} /> : <RotateCcw size={11} strokeWidth={2.8} />}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
        <Boton variante="fantasma" tamano="chico" soloIcono icono={ChevronRight} etiqueta="Clip siguiente" disabled={indice === lista.length - 1} onClick={() => ir(1)} />

        <div className="prod-rev__cierre">
          <BarraDeProgreso valor={(decididos / lista.length) * 100} tono="ok" etiqueta="Revisados" detalle={`${decididos} de ${lista.length}`} />
          <div className="fila" style={{ '--hueco': '8px' }}>
            {decididos < lista.length && todosLlegaron ? (
              <Boton
                variante="fantasma"
                tamano="chico"
                onClick={() => setDecisiones((d) => Object.fromEntries(lista.map((x) => [x.clip.id, d[x.clip.id] || 'bien'])))}
              >
                Los que faltan están bien
              </Boton>
            ) : null}
            <Tooltip texto={listo ? null : todosLlegaron ? 'Revisa todos los clips primero.' : 'Espera a que lleguen todos los clips.'}>
              <Boton
                variante="primario"
                iconoDerecha={ArrowRight}
                disabled={!listo}
                onClick={() => {
                  if (rehacer.length) aviso({ tipo: 'info', titulo: `Se rehacen ${rehacer.length === 1 ? '1 clip' : `${rehacer.length} clips`}`, texto: 'El montaje arranca apenas lleguen. Vista previa del diseño: todavía no se pide nada a kie.' });
                  onAprobar?.();
                }}
              >
                Aprobar y montar
              </Boton>
            </Tooltip>
          </div>
        </div>
      </div>

      <Modal
        abierto={confirmar}
        onCerrar={() => setConfirmar(false)}
        icono={RefreshCw}
        tamano="chico"
        titulo={`¿Rehacer el clip ${indice + 1}?`}
        descripcion="Se vuelve a generar con la misma frase y tarda un minuto y medio. Los demás clips no esperan."
        pie={
          <>
            <Boton variante="fantasma" onClick={() => setConfirmar(false)}>
              Cancelar
            </Boton>
            <Boton
              variante="primario"
              icono={RefreshCw}
              onClick={() => {
                setConfirmar(false);
                decidir('rehacer');
              }}
            >
              Sí, rehacer
            </Boton>
          </>
        }
      />
    </div>
  );
}

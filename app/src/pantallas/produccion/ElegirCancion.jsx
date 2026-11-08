// "Elige la versión de tu canción" (estilos cantados: musical e historia musical). Es la ÚNICA pausa de su
// producción: las versiones reales que hizo Suno con la letra aprobada, para escucharlas y quedarse con una. Recién
// con la elegida se escriben las escenas, sobre sus tiempos; después todo sigue solo.
//
//   <ElegirCancion …/>                         el modal (lo usa también la simulación de la pantalla, ?decision=cancion)
//   esperaLaCancion(conductor)                 true si la producción está esperando esta elección
//   useCancionEnVivo(slug, conductor, { aviso, alCambiar })
//                                              { espera, tarjeta, modal, abrir }: la tarjeta para "Te necesita" y el
//                                              modal ya conectados a GET/POST /api/anuncios/:slug/cancion
//   <CancionEnVivo slug conductor alCambiar/>  lo mismo como bloque suelto (para cuando todavía no hay escenas que
//                                              mostrar: en los cantados el manifiesto se escribe después de elegir)
//
// Sin precios: pedir otras versiones no muestra ningún costo (va en el informe de la entrega, como todo).
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, EighthNotes, Pause, Play, RefreshCw } from 'lucide-react';
import { Boton, EstadoVacio, Modal, VistaPrevia, useAvisos } from '../../componentes/index.js';
import { invalidar } from '../../datos/api.js';
import { duracion as fmtDuracion } from '../../datos/formato.js';
import './produccion.css';

function Version({ v, i, elegida, onElegir, sonando, onSonar, enVivo }) {
  const ref = useRef(null);
  const [avance, setAvance] = useState(0);
  const [dur, setDur] = useState(v.duracion || null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (sonando) el.play().catch(() => onSonar(null));
    else el.pause();
    return undefined;
  }, [sonando, onSonar]);
  const nombre = v.nombre || `Versión ${i + 1}`;
  return (
    <div className={`prod-cancion${elegida ? ' prod-cancion--elegida' : ''}`}>
      <audio
        ref={ref}
        src={v.url}
        preload="metadata"
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onTimeUpdate={(e) => setAvance(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
        onEnded={() => onSonar(null)}
      />
      <button type="button" className="prod-cancion__play" onClick={() => onSonar(sonando ? null : i)} aria-label={sonando ? `Pausar la ${nombre.toLowerCase()}` : `Escuchar la ${nombre.toLowerCase()}`}>
        {sonando ? <Pause size={18} strokeWidth={2.4} /> : <Play size={18} strokeWidth={2.4} />}
      </button>
      <div className="prod-cancion__textos">
        <span className="prod-cancion__nombre">
          {nombre}
          {elegida ? (
            <span className="prod-cancion__elegida">
              <Check size={12} strokeWidth={3} aria-hidden="true" /> Elegida
            </span>
          ) : null}
        </span>
        {v.detalle ? <span className="prod-cancion__detalle">{v.detalle}</span> : null}
        <span className="prod-cancion__onda" aria-hidden="true">
          {Array.from({ length: 48 }, (_, k) => (
            <i key={k} style={{ '--h': `${22 + Math.abs(Math.sin(k * 0.9 + i * 2.1) * Math.cos(k * 0.23)) * 78}%`, '--on': k / 48 < avance ? 1 : 0 }} />
          ))}
        </span>
      </div>
      <span className="prod-cancion__dur t-mono">{dur ? fmtDuracion(dur) : '—'}</span>
      <Boton variante={elegida ? 'primario' : 'secundario'} tamano="chico" icono={elegida ? Check : undefined} onClick={() => onElegir(i)}>
        {elegida ? (enVivo ? 'Elegida' : 'Esta') : 'Quedarme con esta'}
      </Boton>
    </div>
  );
}

/**
 * El modal. Sin `enVivo` es la vista del diseño (la simulación): elegir llama a onElegir(i) y no cambia nada en disco.
 * Con `enVivo`, elegir marca la versión y "Seguir con la versión N" la confirma (onSeguir(i)): desde ahí no se vuelve
 * atrás, porque las escenas se escriben sobre esa canción.
 */
export function ElegirCancion({
  abierto,
  onCerrar,
  titulo,
  versiones,
  elegida,
  onElegir,
  enVivo = false,
  descripcion,
  onSeguir,
  onOtra,
  puedeOtra = false,
  enviando = false,
}) {
  const [sonando, setSonando] = useState(null);
  useEffect(() => {
    if (!abierto) setSonando(null);
  }, [abierto]);
  const n = versiones.length;
  const texto =
    descripcion ||
    `Hice ${n === 2 ? 'dos' : n} versiones de «${titulo}» con la misma letra. Escúchalas y quédate con la que más te guste: ${enVivo ? 'las escenas se escriben sobre la que elijas.' : 'las imágenes empiezan apenas elijas.'}`;
  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      icono={EighthNotes}
      titulo="Elige la versión de tu canción"
      descripcion={texto}
      tamano="grande"
      pie={
        enVivo ? (
          <>
            {puedeOtra ? (
              <Boton variante="fantasma" icono={RefreshCw} onClick={onOtra} disabled={enviando}>
                Ninguna me convence: hacer otras
              </Boton>
            ) : null}
            <Boton variante="fantasma" onClick={onCerrar} disabled={enviando}>
              Decidir después
            </Boton>
            <Boton variante="primario" iconoDerecha={ArrowRight} onClick={() => onSeguir?.(elegida)} disabled={elegida === null || elegida === undefined} cargando={enviando}>
              {elegida === null || elegida === undefined ? 'Elige una versión' : `Seguir con la versión ${elegida + 1}`}
            </Boton>
          </>
        ) : (
          <>
            <VistaPrevia texto="Vista previa del diseño" />
            <Boton variante="fantasma" onClick={onCerrar}>
              Decidir después
            </Boton>
          </>
        )
      }
    >
      <div className="pila" style={{ '--hueco': '10px' }}>
        {versiones.map((v, i) => (
          <Version key={v.url} v={v} i={i} elegida={elegida === i} onElegir={onElegir} sonando={sonando === i} onSonar={setSonando} enVivo={enVivo} />
        ))}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- en vivo

/** ¿La producción está esperando que el usuario elija la canción? (conductor "pausado" en el paso "elegir-cancion") */
export const esperaLaCancion = (c) => Boolean(c && c.estado === 'pausado' && c.paso === 'elegir-cancion');

const urlCancion = (slug) => `/api/anuncios/${encodeURIComponent(slug)}/cancion`;

function textoDe(datos) {
  const n = datos?.opciones?.length || 0;
  const cuantas = n === 2 ? 'dos' : n === 4 ? 'cuatro' : String(n);
  const titulo = datos?.titulo || 'tu canción';
  // la letra va en bloques: lo que se escucha es el comienzo; el resto se agrega solo a la que elijas
  const b = Number(datos?.bloques) || 1;
  const minutos = datos?.duracionTotal ? Math.max(1, Math.round(datos.duracionTotal / 60)) : null;
  const comienzo =
    b > 1
      ? ` Lo que escuchas es el comienzo (la parte 1 de ${b}): el resto de la letra se agrega solo a la que elijas${minutos ? `, y la canción entera va a durar unos ${minutos} min` : ''}.`
      : '';
  if ((datos?.estilos || 1) > 1) {
    return {
      tarjeta: `Hice ${cuantas} versiones de «${titulo}», con dos estilos distintos. Escúchalas y quédate con una: es lo único que espera.${comienzo}`,
      modal: `Hice ${cuantas} versiones de «${titulo}» con la misma letra: la mitad con cada estilo. Escúchalas y quédate con la que más te guste: tu historia se arma sobre la que elijas.${comienzo}`,
    };
  }
  return {
    tarjeta: `Hice ${cuantas} versiones de «${titulo}». Escúchalas y quédate con una: es lo único que espera.${comienzo}`,
    modal: `Hice ${cuantas} versiones de «${titulo}» con la misma letra. Escúchalas y quédate con la que más te guste: las escenas se escriben sobre la que elijas.${comienzo}`,
  };
}

/**
 * La elección de la canción, conectada al servidor. Devuelve:
 *   espera   true mientras la producción espera la elección
 *   tarjeta  la tarjeta para "Te necesita" ({ id, icono, titulo, texto, accion, iconoBoton, alHacer }) o null
 *   modal    el <ElegirCancion> en vivo (o null)
 *   abrir()  abre el modal
 * `alCambiar` se llama después de elegir o de pedir otras versiones (para volver a leer el conductor).
 */
export function useCancionEnVivo(slug, conductor, { aviso, alCambiar } = {}) {
  const espera = Boolean(slug) && esperaLaCancion(conductor);
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState(null);
  const [elegida, setElegida] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const firma = espera ? `${conductor?.actualizado || ''}` : '';

  useEffect(() => {
    if (!espera) {
      setDatos(null);
      setAbierto(false);
      setElegida(null);
      return undefined;
    }
    let vivo = true;
    fetch(urlCancion(slug), { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (vivo) setDatos(d);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [espera, slug, firma]);

  const enviar = useCallback(
    async (cuerpo, avisoOk) => {
      setEnviando(true);
      try {
        let r;
        try {
          r = await fetch(urlCancion(slug), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(cuerpo) });
        } catch {
          throw new Error('No pude conectar con la app. ¿Sigue abierta la ventana del servidor?');
        }
        const d = await r.json().catch(() => null);
        if (!r.ok) throw new Error(d?.error || 'No pude guardar tu elección.');
        setAbierto(false);
        invalidar(`conductor:${slug}`);
        invalidar('conductores:');
        aviso?.(avisoOk);
        alCambiar?.();
      } catch (e) {
        aviso?.({ tipo: 'error', titulo: 'No pude seguir', texto: e.message });
      } finally {
        setEnviando(false);
      }
    },
    [slug, aviso, alCambiar]
  );

  const abrir = useCallback(() => setAbierto(true), []);
  const opciones = Array.isArray(datos?.opciones) ? datos.opciones : [];
  if (!espera || !opciones.length) return { espera, tarjeta: null, modal: null, abrir };

  const textos = textoDe(datos);
  const tarjeta = {
    id: 'cancion',
    icono: 'cancion',
    titulo: 'Elige la versión de tu canción',
    texto: textos.tarjeta,
    accion: 'Escuchar y elegir',
    iconoBoton: ArrowRight,
    alHacer: abrir,
  };
  const modal = (
    <ElegirCancion
      abierto={abierto}
      onCerrar={() => setAbierto(false)}
      titulo={datos.titulo}
      descripcion={textos.modal}
      versiones={opciones.map((o) => ({ url: o.url, detalle: o.detalle, duracion: o.duracion, nombre: `Versión ${o.n}` }))}
      elegida={elegida}
      onElegir={setElegida}
      enVivo
      enviando={enviando}
      puedeOtra={Boolean(datos.puedeOtra)}
      onSeguir={(i) =>
        enviar({ n: opciones[i].n }, { tipo: 'ok', titulo: `Elegiste la versión ${opciones[i].n}`, texto: 'Ahora se escriben las escenas sobre esa canción. Desde aquí sigue sola.' })
      }
      onOtra={() => enviar({ otra: true }, { tipo: 'info', titulo: 'Hago otras versiones', texto: 'Con la misma letra. Las de antes no se pierden: vas a poder elegir entre todas.' })}
    />
  );
  return { espera, tarjeta, modal, abrir };
}

/** La elección como bloque suelto: para la pantalla de un cantado que todavía no tiene escenas (sin manifiesto). */
export function CancionEnVivo({ slug, conductor, alCambiar }) {
  const { aviso } = useAvisos();
  const c = useCancionEnVivo(slug, conductor, { aviso, alCambiar });
  if (!c.tarjeta) return null;
  return (
    <>
      <EstadoVacio
        icono={EighthNotes}
        tono="acento"
        titulo={c.tarjeta.titulo}
        descripcion={c.tarjeta.texto}
        acciones={
          <Boton variante="primario" iconoDerecha={ArrowRight} onClick={c.abrir}>
            {c.tarjeta.accion}
          </Boton>
        }
      />
      {c.modal}
    </>
  );
}

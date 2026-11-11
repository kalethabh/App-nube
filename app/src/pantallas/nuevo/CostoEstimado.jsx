// El COSTO ESTIMADO antes de producir (excepción a "sin precios", decisión de Diego del 2026-11-09): cuánto va a costar
// en kie.ai un anuncio antes de su «Sí», y cuánto costaría con cada modelo que se puede elegir. Los números los arma el
// servidor (GET /api/anuncios/:slug/costo, con el motor: server/rutas/costo.js); la pantalla solo los muestra.
//
//   <CostoDelAnuncio slug activo firma alCambiarModelo/>   el bloque de la tarjeta «Me gusta, producir» (Producir.jsx):
//                                                          la línea del costo, su letra chica y «Con otro modelo»
//   <LineaCosto rango etiqueta>…</LineaCosto>              la línea con el ícono Coins (también la usa el formulario de
//                                                          los anuncios de imagen)
//   <ConOtroModelo categorias sobre guardando onUsar plegable/>
//                                                          una lista por categoría: nombre, precio y «Usar este» o
//                                                          «Elegido» (también en la pausa de la canción, ElegirCancion.jsx).
//                                                          `plegable`: cerrada, con «desde US$ X» (el lateral de 320 px)
//   useUsarModelo({ alCambiar })                           «Usar este»: guarda en Ajustes › Modelos (PUT
//                                                          /api/ajustes/modelos, lo mismo que Ajustes), avisa, olvida los
//                                                          costos guardados y llama a alCambiar (volver a pedirlos)
//   rangoDinero({ min, max })                              «≈ US$ 3,10 a 3,45» (un solo número si son iguales)
//
// Mientras carga, un esqueleto. Si no hay costo (todavía no se puede calcular o falló), no se muestra nada: la tarjeta
// queda como siempre y nunca frena «Me gusta, producir».
import { useCallback, useEffect, useId, useState } from 'react';
import { Check, ChevronDown, Coins } from 'lucide-react';
import { Boton, Esqueleto, useAvisos } from '../../componentes/index.js';
import { invalidar, useCostoEstimado } from '../../datos/api.js';
import { dinero, duracionEnPalabras } from '../../datos/formato.js';
import { apiAjustes } from '../ajustes/datos.js';
import './costo-estimado.css';

/**
 * { min: 3.1, max: 3.45 } -> "≈ US$ 3,10 a 3,45" · { min: 0.12, max: 0.12 } (o 0.12) -> "≈ US$ 0,12".
 * Con { aprox: false }, sin el «≈» (las filas de «Con otro modelo»). null si no hay número.
 */
export function rangoDinero(d, { aprox = true } = {}) {
  const x = typeof d === 'number' ? { min: d, max: d } : d;
  const min = Number(x?.min);
  if (x?.min === null || x?.min === undefined || !Number.isFinite(min)) return null;
  const max = Number.isFinite(Number(x.max)) && x.max !== null ? Math.max(min, Number(x.max)) : min;
  const a = dinero(min);
  const b = dinero(max);
  const texto = a === b ? a : `${a} a ${b.replace(/^US\$\s*/, '')}`;
  return aprox ? `≈ ${texto}` : texto;
}

/** La línea del costo: el ícono Coins, «Costo estimado: ≈ US$ 3,10 a 3,45» y, debajo, lo que se pase como children. */
export function LineaCosto({ rango, etiqueta = 'Costo estimado', children, className = '' }) {
  return (
    <div className={`costo-linea ${className}`}>
      <Coins size={15} strokeWidth={2} aria-hidden="true" />
      <div className="costo-linea__textos">
        <p className="costo-linea__total">
          {etiqueta}: <strong className="t-num">{rango}</strong>
        </p>
        {children}
      </div>
    </div>
  );
}

/**
 * «Con otro modelo»: cada categoría que usa el anuncio (los nombres de Ajustes › Modelos) y una fila por opción, con
 * su precio estimado y «Elegido» o «Usar este». `sobre`: lo que se compara, si no es el total («el video»).
 * `guardando`: "categoria:opcion" que se está guardando (todas las filas quedan quietas hasta que responde).
 * `plegable`: la lista empieza cerrada y el botón dice desde cuánto sale con otro modelo (si alguno es más barato).
 */
export function ConOtroModelo({ categorias, sobre = null, guardando = null, onUsar, titulo = 'Con otro modelo', plegable = false }) {
  const [abierta, setAbierta] = useState(false);
  const idLista = useId();
  const lista = (Array.isArray(categorias) ? categorias : []).filter((c) => Array.isArray(c?.opciones) && c.opciones.length > 1);
  if (!lista.length) return null;

  const filas = lista.map((c) => (
    <div key={c.id} className="costo-modelos__categoria" role="group" aria-label={c.nombre}>
      <p className="costo-modelos__nombre">{c.nombre}</p>
      <ul className="costo-modelos__lista">
        {c.opciones.map((o) => {
          const clave = `${c.id}:${o.id}`;
          return (
            <li key={o.id} className={`costo-modelo${o.elegida ? ' costo-modelo--elegida' : ''}`}>
              <div className="costo-modelo__textos">
                <span className="costo-modelo__nombre">{o.nombre}</span>
                <span className="costo-modelo__precio">
                  <span className="t-num">{rangoDinero(o.dolares, { aprox: false }) || '—'}</span>
                  {o.recomendado ? <> <span className="costo-modelo__recomendado">· recomendado</span></> : null}
                </span>
              </div>
              {o.elegida ? (
                <span className="costo-modelo__elegido">
                  <Check size={13} strokeWidth={2.6} aria-hidden="true" />
                  Elegido
                </span>
              ) : (
                <Boton
                  variante="secundario"
                  tamano="chico"
                  className="costo-modelo__usar"
                  cargando={guardando === clave}
                  disabled={Boolean(guardando) || !onUsar}
                  onClick={() => onUsar?.(c, o)}
                  aria-label={`Usar ${o.nombre} (${c.nombre})`}
                >
                  Usar este
                </Boton>
              )}
              {o.nota ? <p className="costo-modelo__nota">{o.nota}</p> : null}
            </li>
          );
        })}
      </ul>
    </div>
  ));

  if (plegable) {
    // lo más barato que se puede elegir (si cuesta menos que lo elegido): «desde US$ 4,22»
    const elegidos = lista.map((c) => Number(c.opciones.find((o) => o.elegida)?.dolares?.min)).filter(Number.isFinite);
    const otros = lista.flatMap((c) => c.opciones.filter((o) => !o.elegida).map((o) => Number(o.dolares?.min))).filter(Number.isFinite);
    const masBarato = otros.length ? Math.min(...otros) : null;
    const desde = masBarato !== null && (!elegidos.length || masBarato < Math.min(...elegidos)) ? `desde ${dinero(masBarato)}` : null;
    return (
      <section className={`costo-modelos costo-modelos--plegable${abierta ? ' costo-modelos--abierta' : ''}`} aria-label={titulo}>
        <button type="button" className="costo-modelos__boton" aria-expanded={abierta} aria-controls={idLista} onClick={() => setAbierta((x) => !x)}>
          <span className="costo-modelos__boton-texto">
            <span className="costo-modelos__boton-titulo">{titulo}</span>
            {desde ? <span className="costo-modelos__desde t-num">{desde}</span> : null}
          </span>
          <ChevronDown size={16} strokeWidth={2} aria-hidden="true" className="costo-modelos__flecha" />
        </button>
        {abierta ? (
          <div id={idLista} className="costo-modelos__cuerpo">
            {sobre ? <p className="costo-modelos__sobre">Lo que costaría {sobre}.</p> : null}
            {filas}
          </div>
        ) : null}
      </section>
    );
  }
  return (
    <section className="costo-modelos" aria-label={titulo}>
      <p className="costo-modelos__titulo">
        <span className="t-etiqueta">{titulo}</span>
        {sobre ? <span className="costo-modelos__sobre">{sobre}</span> : null}
      </p>
      {filas}
    </section>
  );
}

/**
 * «Usar este»: guarda la opción en Ajustes › Modelos (global: la usan este anuncio, que la toma al aprobarlo, y los
 * próximos; uno que ya aprobaste sigue con los que tenía), avisa y llama a `alCambiar` (que vuelve a pedir el costo).
 * guardarModelos ya olvida todos los costos guardados. { usar(categoria, opcion), guardando: "categoria:opcion" | null }
 */
export function useUsarModelo({ alCambiar } = {}) {
  const { aviso } = useAvisos();
  const [guardando, setGuardando] = useState(null);
  const usar = useCallback(
    async (categoria, opcion) => {
      setGuardando(`${categoria.id}:${opcion.id}`);
      try {
        await apiAjustes.guardarModelos({ [categoria.id]: opcion.id });
      } catch (e) {
        aviso({ tipo: 'error', titulo: 'No pude cambiar el modelo', texto: e.message });
        setGuardando(null);
        return;
      }
      aviso({ tipo: 'ok', titulo: `Elegiste ${opcion.nombre}`, texto: 'Queda elegido en Ajustes › Modelos: lo usan este anuncio y los próximos.' });
      try {
        await alCambiar?.();
      } catch {
        /* el costo nuevo llega en la próxima lectura */
      } finally {
        setGuardando(null);
      }
    },
    [aviso, alCambiar]
  );
  return { usar, guardando };
}

function EsqueletoCosto() {
  return (
    <div className="costo-estimado costo-estimado--cargando" aria-busy="true" aria-label="Calculando el costo estimado">
      <Esqueleto forma="texto" ancho="74%" />
      <Esqueleto forma="texto" lineas={2} />
    </div>
  );
}

/**
 * El costo estimado de un anuncio en la tarjeta «Me gusta, producir». Solo pide el costo con `activo` (el guion o la
 * letra listos para aprobar). `firma`: lo que cambia el número sin que cambie el anuncio (la letra elegida).
 * `alCambiarModelo`: después de «Usar este» (p. ej. volver a mirar si el saldo alcanza).
 */
export function CostoDelAnuncio({ slug, activo = true, firma = '', alCambiarModelo, soloModelos = false }) {
  const [esperando, setEsperando] = useState(false);
  const c = useCostoEstimado(activo ? slug : null, { firma: String(firma ?? ''), cadaMs: esperando ? 2000 : undefined });
  const d = c.datos;
  useEffect(() => setEsperando(d?.motivo === 'calculando'), [d]);
  // al dejar de estar listo (un cambio del guion), el costo guardado ya no vale: la próxima vez se pide de nuevo
  useEffect(() => {
    if (!activo && slug) invalidar(`costo:${slug}:`);
  }, [activo, slug]);
  const recargar = c.recargar;
  const alCambiar = useCallback(async () => {
    await recargar();
    alCambiarModelo?.();
  }, [recargar, alCambiarModelo]);
  const { usar, guardando } = useUsarModelo({ alCambiar });

  if (!activo || !slug) return null;
  if (!d) return c.cargando ? <EsqueletoCosto /> : null;
  if (!d.disponible || !d.dolares) return d.motivo === 'calculando' ? <EsqueletoCosto /> : null;

  const cantado = d.comparaSobre === 'video';
  if (soloModelos) return d.puedeCambiar ? <ConOtroModelo categorias={d.categorias} sobre={cantado ? 'el video' : null} guardando={guardando} onUsar={usar} plegable /> : null;
  // la letra chica en un solo párrafo (el lateral es angosto): con qué modelos, lo que va por el plan de ElevenLabs y
  // las notas del motor (las imágenes de apoyo que seguramente no entran, los ganchos…). Un solo número: la app hace
  // todo al primer intento (2026-11-09) y lo que regeneres después se cobra aparte.
  const chica = [
    d.conModelos ? `En kie.ai, con ${d.conModelos}.` : 'En kie.ai.',
    'Si después regeneras alguna pieza, se cobra aparte.',
    d.elevenlabs || null,
    ...(Array.isArray(d.notas) ? d.notas : []),
  ]
    .filter(Boolean)
    .join(' ');
  const s = Math.round(Number(d.segundos) || 0);
  const segundos = s > 0 ? (s < 120 ? `${s} s` : duracionEnPalabras(Math.round(s / 10) * 10)) : null;
  return (
    <div className={`costo-estimado${guardando ? ' costo-estimado--cambiando' : ''}`} aria-busy={guardando ? true : undefined}>
      <LineaCosto rango={rangoDinero(d.dolares)} etiqueta={d.modoPrueba ? 'Lo que costaría' : 'Costo estimado'}>
        {cantado && (d.cancion?.creditos > 0 || d.video) ? (
          <ul className="costo-linea__partes">
            {d.cancion?.creditos > 0 ? (
              <li>
                La canción: <span className="t-num">{rangoDinero(d.cancion.dolares)}</span>
              </li>
            ) : null}
            {d.video ? (
              <li>
                El video: <span className="t-num">{rangoDinero(d.video.dolares)}</span>
                {d.fase === 'letra' && segundos ? ` si la canción dura unos ${segundos}. Lo ves exacto al elegir la canción.` : ''}
              </li>
            ) : null}
          </ul>
        ) : null}
        <p className="costo-linea__chica">{chica}</p>
      </LineaCosto>
      {d.puedeCambiar ? <ConOtroModelo categorias={d.categorias} sobre={cantado ? 'el video' : null} guardando={guardando} onUsar={usar} plegable /> : null}
    </div>
  );
}

// La composición "AnuncioEditado": el anuncio con los cambios del editor.
//
// Es LA MISMA en los dos lados, y por eso lo que se ve en el editor es lo que sale en el MP4:
//   - la vista previa del editor (app/src/pantallas/editor, dentro de @remotion/player);
//   - el video exportado (produccion/exportar-edicion.js, registrada en Root.jsx).
//
// Por dentro dibuja remotion/src/Anuncio.jsx (que no se toca) con el plan ya ajustado (tomas cortadas,
// movidas o borradas, B-roll movidos, recortados o quitados, volumen de los clips) y sin sus subtítulos ni su
// música (sinSubtitulos, sinMusica). Encima, en capas propias y sincronizadas con el mismo cuadro:
//   - la voz en off (o la canción de los musicales), con su volumen;
//   - la música (la del anuncio, una del usuario o la de otro anuncio), con volumen, inicio y repetición, y
//     si el usuario la recortó o la movió, en sus tramos con sus fundidos;
//   - los textos en pantalla (los sugeridos que activó y los que agregó), con su color, fondo, tamaño, lugar
//     y tipo de letra;
//   - los subtítulos con el estilo elegido (Caja es copia fiel del render de siempre).
//
// props: { plan, edicion, contexto }
//   plan       plan-montaje.json del anuncio, tal cual
//   edicion    los cambios del editor (temp/<slug>/app/edicion.json, "estado")
//   contexto   { titulo, overlays, color, musica } (ver capasDeEdicion en capas.mjs). La música trae su
//              url ya resuelta: en la vista previa una dirección de la app (o el archivo que arrastró el
//              usuario); en el render, una ruta dentro de la carpeta pública (se pide con staticFile).
import { useEffect, useMemo, useState } from 'react';
import { AbsoluteFill, Audio, Img, Loop, Sequence, continueRender, delayRender, getRemotionEnvironment, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Anuncio } from '../Anuncio.jsx';
import { capasDeEdicion } from './capas.mjs';
import { Subtitulos } from './subtitulos/estilos.jsx';
import { FUENTES, cargarFuentesSubtitulos } from './subtitulos/fuentes.js';

const dbALineal = (db) => Math.pow(10, db / 20);
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };

/** Una ruta del anuncio va por staticFile; una dirección completa (o un archivo del navegador), tal cual. */
const fuente = (src) => (/^(https?:|blob:|data:|\/)/i.test(String(src)) ? src : staticFile(src));

/** Misma curva de volumen que la música de Anuncio.jsx, por el multiplicador del usuario. */
function Musica({ musica }) {
  if (Array.isArray(musica.tramos)) {
    return (
      <>
        {musica.tramos.map((t) => (
          <TramoMusica key={t.id} musica={musica} tramo={t} />
        ))}
      </>
    );
  }
  return <MusicaEntera musica={musica} />;
}

/**
 * Un tramo de la música recortada o movida: suena de `desde` a `hasta` del anuncio, arrancando en el segundo
 * `entrada` de la canción, con sus fundidos de entrada y salida. El nivel (y la subida del final) es el mismo
 * de siempre, contado sobre el tiempo del anuncio.
 */
function TramoMusica({ musica, tramo }) {
  const { fps } = useVideoConfig();
  const desde = Math.round(tramo.desde * fps);
  const largo = Math.max(1, Math.round(tramo.hasta * fps) - desde);
  return (
    <Sequence from={desde} durationInFrames={largo} layout="none" name="Música">
      <SonidoDeTramo musica={musica} tramo={tramo} desde={desde} largo={largo} />
    </Sequence>
  );
}

function SonidoDeTramo({ musica: m, tramo, desde, largo }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const db = m.db ?? -26;
  const base = dbALineal(db);
  const alzada = dbALineal(db + (m.subeEnPayoffDb ?? 0));
  const payoff = Math.round((m.payoffDesdeSeg ?? 0) * fps);
  const rampa = Math.max(1, Math.round(1.5 * fps));
  const nivel = payoff ? interpolate(frame + desde, [payoff - rampa, payoff], [base, alzada], CLAMP) : base;
  const fi = Math.round((tramo.fadeIn ?? 0) * fps);
  const fo = Math.round((tramo.fadeOut ?? 0) * fps);
  const entra = fi > 0 ? Math.min(1, Math.max(0, frame / fi)) : 1;
  const sale = fo > 0 ? Math.min(1, Math.max(0, (largo - frame) / fo)) : 1;
  const volumen = Math.max(0, Math.min(1, nivel * Math.min(entra, sale) * (m.multiplicador ?? 1)));

  const entrada = Math.max(0, tramo.entrada || 0);
  const recorte = entrada > 0 ? Math.round(entrada * fps) : undefined;
  const audio = <Audio src={fuente(m.src)} volume={() => volumen} trimBefore={recorte} />;
  if (m.repetir && m.duracionPista > 0) {
    // Suena desde `entrada` hasta el final de la canción y después da la vuelta desde donde arranca la
    // canción (m.inicio), igual que la canción entera sin cortes (MusicaEntera). Así, dividir no cambia lo que se oye.
    const resto = Math.max(1, Math.round((m.duracionPista - entrada) * fps));
    if (resto < largo) {
      const base = m.duracionPista - (m.inicio || 0) >= 0.5 ? m.inicio || 0 : 0;
      const vuelta = Math.max(fps, Math.round((m.duracionPista - base) * fps));
      return (
        <>
          <Sequence durationInFrames={resto} layout="none" name="Música (primera vuelta)">
            {audio}
          </Sequence>
          <Sequence from={resto} layout="none" name="Música (repetida)">
            <Loop durationInFrames={vuelta}>
              <Audio src={fuente(m.src)} volume={() => volumen} trimBefore={base > 0 ? Math.round(base * fps) : undefined} />
            </Loop>
          </Sequence>
        </>
      );
    }
  }
  return audio;
}

function MusicaEntera({ musica }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const m = musica;
  const db = m.db ?? -26;
  const base = dbALineal(db);
  const alzada = dbALineal(db + (m.subeEnPayoffDb ?? 0));
  const fadeIn = Math.max(1, Math.round((m.fadeInSeg ?? 1.2) * fps));
  const fadeOut = Math.max(1, Math.round((m.fadeOutSeg ?? 1.5) * fps));
  const payoff = Math.round((m.payoffDesdeSeg ?? 0) * fps);
  const rampa = Math.max(1, Math.round(1.5 * fps));
  const nivel = payoff ? interpolate(frame, [payoff - rampa, payoff], [base, alzada], CLAMP) : base;
  const sobre = interpolate(frame, [0, fadeIn, Math.max(fadeIn + 1, durationInFrames - fadeOut), durationInFrames], [0, 1, 1, 0], CLAMP);
  const volumen = Math.max(0, Math.min(1, nivel * sobre * (m.multiplicador ?? 1)));

  const recorte = m.inicio > 0 ? Math.round(m.inicio * fps) : undefined;
  const audio = <Audio src={fuente(m.src)} volume={() => volumen} trimBefore={recorte} />;
  if (m.repetir && m.duracionPista > 0) {
    const largo = Math.max(fps, Math.round((m.duracionPista - (m.inicio || 0)) * fps));
    if (largo < durationInFrames) return <Loop durationInFrames={largo}>{audio}</Loop>;
  }
  return audio;
}

/**
 * Un texto en pantalla (los sugeridos del anuncio y los que agrega el usuario): entra con un pop y se va con un
 * fundido. Su aspecto ya viene resuelto (textosEnPantalla en capas.mjs): color de letra, fondo (o sin fondo),
 * tamaño, lugar y tipo de letra. Sin cambios se ve exactamente como siempre.
 */
function TextoEnPantalla({ id, texto, inicio, fin, estilo }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  if (t < inicio || t >= fin) return null;
  const e = estilo || {};
  const dt = t - inicio;
  const k = dt <= 0 ? 0 : 1 - Math.exp(-dt * 10) * Math.cos(dt * 20);
  const salida = interpolate(t, [fin - 0.18, fin], [1, 0], CLAMP);
  const largo = String(texto).length;
  const fs = Math.round(width * (largo > 22 ? 0.044 : 0.058) * (e.tamano ?? 1));
  const sinFondo = !e.fondo;
  const y = e.y ?? 0.17;
  // Nunca se sale del cuadro.
  //   - Hacia los lados (0,2 a 0,8): la caja se corre dentro del espacio que le sobra a lo ancho (con un margen
  //     de 4 % a cada lado): al centro queda centrada como siempre y en las puntas, pegada al margen.
  //   - De la mitad para abajo se va apoyando en su borde de abajo: en la Altura máxima, su borde de abajo queda ahí.
  const lado = Math.max(0, Math.min(1, ((e.x ?? 0.5) - 0.2) / 0.6));
  const sube = y > 0.5 ? Math.min(1, (y - 0.5) / 0.35) * 100 : 0;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: height * y, pointerEvents: 'none' }}>
      <div style={{ display: 'flex', width: '100%', padding: `0 ${width * 0.04}px`, boxSizing: 'border-box' }}>
        <div style={{ flexGrow: lado }} />
        <div
          data-capa={id}
          style={{
            flex: '0 1 auto',
            maxWidth: width * 0.84,
            overflowWrap: 'break-word',
            padding: `${fs * 0.42}px ${fs * 0.7}px`,
            borderRadius: fs * 0.32,
            background: sinFondo ? 'transparent' : e.fondo,
            color: e.color || '#fff',
            fontFamily: FUENTES[e.fuente] || FUENTES.titulo,
            fontWeight: 800,
            fontSize: fs,
            lineHeight: 1.1,
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: '-0.01em',
            // sin caja, la letra lleva contorno y sombra para leerse sobre cualquier imagen
            ...(sinFondo
              ? { WebkitTextStroke: `${Math.max(1, Math.round(fs * 0.07))}px rgba(0,0,0,0.85)`, paintOrder: 'stroke fill', textShadow: `0 ${Math.round(fs * 0.08)}px ${Math.round(fs * 0.3)}px rgba(0,0,0,0.6)` }
              : { boxShadow: `0 ${fs * 0.2}px 0 rgba(0,0,0,0.35), 0 ${fs * 0.4}px ${fs}px rgba(0,0,0,0.35)` }),
            transform: `${sube ? `translateY(-${sube.toFixed(2)}%) ` : ''}scale(${0.6 + 0.4 * k}) rotate(${e.giro ?? -2}deg)`,
            opacity: salida,
          }}
        >
          {texto}
        </div>
        <div style={{ flexGrow: 1 - lado }} />
      </div>
    </AbsoluteFill>
  );
}

/**
 * Una imagen que puso el usuario en el editor: centrada en (x, y), con su ancho (el alto sale de la imagen). Entra
 * con un pop y se va con un fundido, como los textos.
 */
function ImagenEnPantalla({ id, archivo, inicio, fin, estilo }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  if (t < inicio || t >= fin) return null;
  const e = estilo || {};
  const dt = t - inicio;
  const k = dt <= 0 ? 0 : 1 - Math.exp(-dt * 10) * Math.cos(dt * 20);
  const salida = interpolate(t, [fin - 0.18, fin], [1, 0], CLAMP);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <Img
        data-capa={id}
        src={fuente(archivo)}
        style={{
          position: 'absolute',
          left: width * (e.x ?? 0.5),
          top: height * (e.y ?? 0.42),
          width: width * (e.ancho ?? 0.5),
          height: 'auto',
          transform: `translate(-50%, -50%) scale(${0.6 + 0.4 * k})`,
          opacity: salida,
        }}
      />
    </AbsoluteFill>
  );
}

function CapaSubtitulos({ ajustes }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <Subtitulos t={frame / fps} ancho={width} alto={height} {...ajustes} conMarca />
    </AbsoluteFill>
  );
}

/** Las capas ya calculadas (capasDeEdicion): el anuncio de siempre y lo del editor encima. */
export function CapasEditadas({ plan, voz, musica, subtitulos, textos, color }) {
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <Anuncio plan={plan} sinSubtitulos sinMusica />
      {(textos || []).map((x) =>
        x.archivo ? (
          <ImagenEnPantalla key={x.id} id={x.id} archivo={x.archivo} inicio={x.inicio} fin={x.fin} estilo={x.imagenEstilo} />
        ) : (
          <TextoEnPantalla key={x.id} id={x.id} texto={x.texto} inicio={x.inicio} fin={x.fin} estilo={x.estilo} />
        )
      )}
      {subtitulos ? <CapaSubtitulos ajustes={subtitulos} /> : null}
      {voz?.archivo ? <Audio src={staticFile(voz.archivo)} volume={() => Math.max(0, Math.min(1, voz.volumen))} /> : null}
      {musica?.src ? <Musica musica={musica} /> : null}
    </AbsoluteFill>
  );
}

/**
 * Al renderizar, ningún cuadro sale antes de que estén las fuentes (si no, los primeros cuadros saldrían con
 * la de respaldo). En la vista previa no se espera: la letra cambia sola apenas llega.
 */
function useFuentes() {
  const [espera] = useState(() => (getRemotionEnvironment().isRendering ? delayRender('Cargando las fuentes de los subtítulos') : null));
  useEffect(() => {
    // (continueRender dos veces con la misma espera no hace nada: da igual si el efecto corre de nuevo)
    cargarFuentesSubtitulos().finally(() => {
      if (espera !== null) continueRender(espera);
    });
  }, [espera]);
}

export function AnuncioEditado({ plan, edicion, contexto }) {
  useFuentes();
  const capas = useMemo(() => capasDeEdicion(plan, edicion, contexto || {}), [plan, edicion, contexto]);
  return <CapasEditadas {...capas} />;
}

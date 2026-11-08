import { Video } from "@remotion/media";
import { AbsoluteFill, Easing, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// Un texto animado encima del video: entra con un pequeño rebote y sale con un fundido.
export type Texto = {
  texto: string;
  desde: number; // segundo en que aparece
  dur: number; // segundos en pantalla
  y: number; // posición vertical (px, en un lienzo de 1080x1920)
  tam?: number; // tamaño de letra (px)
  color?: string;
  fondo?: string; // color de la cápsula detrás del texto ("" = sin cápsula)
};

export type Props = {
  video: string; // archivo dentro de public/ (el FINAL_*.mp4 del montaje)
  duracionSeg: number;
  textos: Texto[];
};

export const propsPorDefecto: Props = {
  video: "anuncio.mp4",
  duracionSeg: 62,
  textos: [],
};

const TextoAnimado: React.FC<{ t: Texto }> = ({ t }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durFrames = Math.round(t.dur * fps);
  const entrada = spring({ frame, fps, config: { damping: 14, stiffness: 160 } });
  const salida = interpolate(frame, [durFrames - 8, durFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.quad),
  });
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div
        style={{
          position: "absolute",
          top: t.y,
          maxWidth: 940,
          padding: t.fondo === "" ? 0 : "14px 30px",
          borderRadius: 22,
          background: t.fondo ?? "rgba(0,0,0,0.45)",
          color: t.color ?? "#ffffff",
          fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
          fontWeight: 800,
          fontSize: t.tam ?? 72,
          lineHeight: 1.15,
          textAlign: "center",
          textShadow: "0 3px 10px rgba(0,0,0,0.55)",
          opacity: Math.min(entrada, salida),
          scale: String(interpolate(entrada, [0, 1], [0.85, 1])),
          translate: `0px ${interpolate(entrada, [0, 1], [24, 0])}px`,
        }}
      >
        {t.texto}
      </div>
    </AbsoluteFill>
  );
};

export const AnuncioConGraficos: React.FC<Props> = ({ video, textos }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Video src={staticFile(video)} />
      {textos.map((t, i) => (
        <Sequence key={i} from={Math.round(t.desde * fps)} durationInFrames={Math.round(t.dur * fps)} layout="none">
          <TextoAnimado t={t} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

import { Composition } from "remotion";
import { AnuncioConGraficos, propsPorDefecto } from "./AnuncioConGraficos";

// Un anuncio 9:16 a 30 fps. La duración sale de props.json (duracionSeg), así sirve para cualquier anuncio.
export const RemotionRoot = () => {
  return (
    <Composition
      id="AnuncioConGraficos"
      component={AnuncioConGraficos}
      fps={30}
      width={1080}
      height={1920}
      durationInFrames={Math.round(propsPorDefecto.duracionSeg * 30)}
      defaultProps={propsPorDefecto}
      calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, Math.round(props.duracionSeg * 30)) })}
    />
  );
};

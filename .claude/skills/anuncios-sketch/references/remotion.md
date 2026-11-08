# Motion graphics con Remotion (opcional)

El formato sketch **no necesita** Remotion: `montaje.py` hace con ffmpeg todo lo que piden las referencias (cortes, textos del cierre, tarjeta con máquina de escribir, flash, sonidos, música). Usa Remotion solo si el usuario pide gráficos animados de verdad: textos que entran con rebote a lo largo del video, stickers, flechas, barras de progreso, un logo animado o subtítulos estilizados.

La skill trae su propia plantilla en `remotion/`, lista para usar y sin depender de ningún otro proyecto.

## Requisitos
Node.js 20.19+ (o 22.13+, o 24+) y npm. La primera vez, `npm install` descarga Remotion (~200 MB) y el primer render baja un Chrome headless.

## Paso a paso
1. Copia `<skill>/remotion/` a `<proyecto>/motion/`.
2. En `<proyecto>/motion/` corre `npm install` (una sola vez por proyecto).
3. Copia el video final a `motion/public/anuncio.mp4`. Para la versión con música, copia `FINAL_con_musica.mp4`; para la otra, `FINAL_sin_musica.mp4`. Se renderiza una vez por versión.
4. Edita `motion/props.json`:
   - `duracionSeg`: la duración del final (`ffprobe -v error -show_entries format=duration -of csv=p=0 FINAL_con_musica.mp4`).
   - `textos`: cada uno con `texto`, `desde` (segundo en que aparece), `dur`, `y` (px en 1080×1920), `tam`, `color` y `fondo` (la cápsula detrás; `""` para no usarla).
   - Ubica los momentos con `montaje/qa.json` (`inicio_en_video` de cada toma).
5. Render: `npx remotion render AnuncioConGraficos out/anuncio.mp4 --props=props.json`. Para revisar un tramo rápido, agrega `--frames=1650-1800`.
6. Vuelve a normalizar el audio, para que quede igual que las entregas:
   ```
   ffmpeg -i out/anuncio.mp4 -af "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,alimiter=limit=0.8:level=false" -c:v copy -c:a aac -b:a 192k FINAL_con_musica_graficos.mp4
   ```
7. Revisa el resultado con fotogramas (`ffmpeg -ss <seg> -i ... -frames:v 1 x.png`) y entrégalo junto a las versiones normales.

Si los textos del cierre van animados con Remotion, quítalos de la toma de packshot en `proyecto.json` (`textos`/`banda`) y vuelve a correr `montaje.py`. Si no, quedan duplicados.

## Reglas de Remotion que hay que respetar
- **Todo se anima con el número de fotograma:** `useCurrentFrame()` + `interpolate()` o `spring()`. Las animaciones y transiciones de CSS (y las clases `animate-*`) **no se ven** en el render.
- **Los tiempos se escriben en fotogramas:** `segundos * fps`, con `fps` de `useVideoConfig()`.
- **Archivos en `public/`,** referenciados con `staticFile("archivo")`. Para video y audio usa `<Video>` y `<Audio>` de `@remotion/media`, que aceptan `volume`, `trimBefore`, `loop`…
- **Cada elemento con su tiempo:** `<Sequence from={…} durationInFrames={…}>`. Dentro de una Sequence, `useCurrentFrame()` empieza en 0.
- **Escala y movimiento:** usa las propiedades CSS `scale`, `translate` y `rotate` en vez de un `transform` en texto.
- **La duración la decide `props.json`:** la plantilla calcula `durationInFrames` con `calculateMetadata`.
- **Sonidos:** se agregan con `<Audio src={staticFile("sfx/x.wav")} />` dentro de una `<Sequence>`.
- **Studio:** para ver y ajustar en vivo, `npx remotion studio` abre una vista previa en el navegador.
- **Zonas seguras de Reels/TikTok** (lienzo de 1080×1920): deja libres unos 250 px arriba, 420 px abajo y 150 px a la derecha (íconos de la app).

## Ampliar la plantilla
`src/AnuncioConGraficos.tsx` tiene un componente `TextoAnimado` (entra con un rebote y sale con un fundido). Para otros gráficos, crea componentes parecidos y agrégalos a `props.json` con su `desde` y `dur`:
- **Logo:** `<Img src={staticFile("logo.png")} />` con `spring` de escala.
- **Flecha que señala el producto:** un SVG con `translate` animado.
- **Barra de progreso:** un `div` cuyo ancho es `interpolate(frame, [0, total], [0, 1080])`.

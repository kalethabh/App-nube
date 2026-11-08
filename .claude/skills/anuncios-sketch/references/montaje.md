# Montaje, sonido y efectos

`montaje.py` hace el montaje completo con ffmpeg y deja las dos versiones listas. Esta guía explica sus decisiones y cómo ajustarlas desde `proyecto.json`.

## Recorte de cada toma
- El corte se ancla a la **primera y la última palabra del guion**: el script transcribe con Whisper (marcas por palabra) y deja 0,1 s antes y unos 0,2 s después. Así se elimina el aire y cualquier repetición o palabra improvisada fuera de la línea.
- Si `medium` no entiende la línea (susurros, alucinaciones en bucle), reintenta con `large-v3` sin VAD. Si tampoco coincide (similitud < 0,8), **no exporta**. Entonces:
  1. Escucha o mira el clip, o transcríbelo con large-v3.
  2. Si la línea está bien dicha, fija `"corte": {"inicio": 1.62, "dur": 3.26}` en la toma.
  3. Si está mal dicha, regenera el clip: `produccion.py <carpeta> rehacer video sXX`.
- `"extra": 1.9` deja segundos después de la línea, para un gag o un giro (por ejemplo, el hair-flip).
- **Tomas mudas** (reacciones, la foto): `"corte"` fijo, de 1,2 a 2 s.
- Los cortes validados quedan en `montaje/cortes_validados.json`, así el montaje es estable entre corridas. Si cambias `linea`, `extra` o el idioma, esa toma se recalcula sola; `--recortar-de-nuevo` recalcula todas.
- `montaje/qa.json` trae, por toma, su `inicio_en_video`: úsalo para ubicar "el segundo 20" que menciona el usuario.

## Parpadeos (cortes internos)
Omni a veces mete un cambio de cámara dentro del clip. Si el recorte incluye un pedacito del plano anterior, se ve un parpadeo. `montaje.py` detecta esos cortes (ffmpeg `scene > 0.3`):
- Si el corte cae antes de la línea, el recorte empieza después de él.
- Si cae en medio de la línea, la toma se bloquea: hay que regenerarla.
- Con un `"corte"` fijo en una toma con diálogo, toda la ventana cuenta como diálogo: un corte interno dentro de ella bloquea la toma. Mueve la ventana o regenera el clip.

## Audio de las tomas
- Las tomas con diálogo usan el audio del clip (voz y ambiente).
- En las tomas mudas y el packshot, usa `"audio": "ambiente"` (el packshot lo hace solo). El audio del modelo no es confiable: inventa voces o trae diálogos de fondo. El script busca un clip cuya VAD no detecte voz y usa su ambiente. Puedes fijarlo con `"ambiente": "s10"`.

## Efectos (`"efectos"` en la toma)
| Tipo | Qué hace | Ejemplo |
|---|---|---|
| `flash` | Destello blanco de cámara (2 cuadros fuertes + 2 suaves) | `{"tipo": "flash", "t": 0.17}` |
| `obturador` | Obturador sintetizado: dos golpes mecánicos, espejo y cortina | `{"tipo": "obturador", "t": 0.17}` |
| `archivo` | Cualquier sonido (risa, splash, whoosh, ding…) desde un archivo | `{"tipo": "archivo", "ruta": "sfx/risa.wav", "t": 0.5, "vol_db": -6}` |
Regla: si el modelo no genera bien un sonido o un efecto que la historia necesita (un flash, un timbre, una caída), **se silencia y se hace en edición, sincronizado con la imagen**. El flash y el obturador vienen incluidos en `montaje.py`. Para cualquier otro sonido (risa, splash, whoosh, ding…), consigue o pídele al usuario un archivo WAV o MP3, guárdalo en `<proyecto>/sfx/` y agrégalo con `archivo`.

## Cierre (packshot y textos)
- `"imagen_fija": true` arma el plano desde el fotograma, sin video: push-in lento (`"zoom": 0.07`), banda oscura translúcida (`"banda"`) y textos (`"textos"`: texto, tamaño, y, fuente negrita/normal). Los tamaños están pensados para 1080 de ancho.
- Textos típicos: el gancho como pregunta ("¿Hinchada todo el día?") + la oferta y el CTA ("Pagas al recibir · Link abajo"). Sin subtítulos en el resto del video: así son las referencias. El texto admite cualquier carácter (%, comillas, dos puntos). Los textos largos se parten solos en líneas, pero la banda no crece: mantén cada texto del cierre en una línea (≈ 22 caracteres a tamaño 80) o sube `banda.alto`.
- Los otros cierres del formato (`formato.md` §8) también se pueden hacer:
  - **Nota dentro del mundo** (V2): un fotograma con la nota (pídelo en el `encuadre`, con el texto exacto entre comillas) + `"imagen_fija": true`. O deja el texto fuera de la imagen y ponlo con `textos`.
  - **Tarjeta negra con máquina de escribir** (V3): una toma sin clip con `"tarjeta": {"texto": "No eres feo… solo te ves muy viejo", "dur": 4, "maquina": true, "tam": 64}`. La voz en off necesita un audio: grábalo o pídeselo al usuario y agrégalo con `efectos` → `archivo`.
  - **Mirada a cámara + logo** (V4): una toma con `"a_camara": true`, la línea del CTA dicha a cámara y el logo o el nombre con `textos` (o animado con Remotion si es una imagen de logo: `remotion.md`).

## Música (versión con música)
- Por defecto se usa `assets/musica/musica_sketch.mp3`, la música oficial del formato. Si el usuario manda otra, cópiala a la carpeta del proyecto y ponla en `"musica": {"archivo": "musica/otra.mp3"}`. Avísale si es una canción comercial conocida (riesgo de copyright en anuncios pagados).
- Arranca en `"inicio"` (por defecto 4 s con la música oficial, que tiene silencio al principio; 0 s con una música del usuario). Si la canción es más corta que el anuncio, se repite en bucle. Se nivela con dynaudnorm (sin saltos de volumen) y queda `"bajo_dialogo_lu"` (por defecto 15 LU) por debajo del diálogo. Encima lleva ducking (sidechain) cuando alguien habla, fade-in de 0,4 s y fade-out de 1,5 s.
- **Siempre se entregan dos versiones:** `FINAL_con_musica.mp4` y `FINAL_sin_musica.mp4`. Ambas a −14 LUFS con limitador (pico ≈ −1,5 dBFS), 1080×1920, 30 fps.

## Unión de las tomas (sincronía)
Las partes se unen con el filtro `concat` (decodificando). **Nunca** con `-f concat -c copy` sobre partes AAC: cada parte arrastra ~21 ms de retardo inicial del AAC y la voz se va atrasando respecto de los labios (0,34 s al final de un anuncio de 62 s). `revision.py` mide la sincronía de cada toma.

## Motion graphics (opcional)
ffmpeg alcanza para este formato. Si el usuario pide gráficos animados (textos con rebote, logo animado, flechas, barras de progreso, subtítulos estilizados), usa la plantilla de Remotion que trae la skill: ver `remotion.md`.

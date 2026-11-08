# Producción paso a paso (Kie, por defecto)

Todo vive en una carpeta de proyecto (por ejemplo `produccion/<marca>_<idea>/`):
```
proyecto.json        guion + personajes + locaciones + producto + tomas + modelos + música (la fuente de verdad)
manifest.json        lo generado (URL, archivo, créditos, modelo); versiones viejas como <clave>_vN
GUION.md             la propuesta aprobada (para leer); mapa de ejes incluido
refs/ frames/ clips/ montaje/ revision/
FINAL_con_musica.mp4  FINAL_sin_musica.mp4  INFORME.md
```
Los scripts están en `<skill>/scripts/` y se corren con `python <skill>/scripts/X.py <carpeta> ...`, desde cualquier carpeta.
Requisitos: Python 3.10+, ffmpeg y ffprobe en el PATH, `pip install faster-whisper pillow numpy` y la clave de Kie en `.env`. La primera corrida de Whisper descarga los modelos `medium` y `large-v3` (unos 3 GB).

## Cómo correr las etapas largas
`refs`, `frames` y `video` esperan a que Kie termine (los clips tardan entre 5 y 15 minutos). `montaje.py` y `revision.py` transcriben con Whisper en CPU (de 5 a 15 minutos).
- **Córrelas en segundo plano** (Bash con `run_in_background`, guardando la salida en un log, por ejemplo `> _video.log 2>&1`) o con el timeout máximo. Espera la notificación de fin; no consultes el log en un bucle.
- **No vuelvas a lanzar una etapa mientras la anterior siga viva.**
- Si el proceso se corta, las tareas ya creadas en Kie quedan en el manifest como **pendientes**. `produccion.py <carpeta> pendientes` (o la misma etapa) las retoma **sin volver a pagarlas**. Una tarea que Kie marca como fallida no se cobra y se borra del manifest para reintentarla.
- Antes de gastar, puedes ver los payloads con `--simular` (no gasta créditos ni toca el manifest).

## 0. Preparar (antes de la propuesta)
1. Crea la carpeta del proyecto apenas tengas el brief, y copia ahí la foto del producto (PNG con fondo limpio, de buena resolución).
2. **Clave de Kie:** el usuario la pega él mismo en `<carpeta o carpeta padre>/.env` como `KIE_API_KEY=...`. Créale el archivo con la línea vacía y dile dónde está. **Nunca** le pidas la clave por el chat, nunca la leas ni la imprimas. Si hay git, agrega `.env` a `.gitignore`.
3. Saldo: `python <skill>/scripts/kie.py credito` (corrido desde la carpeta del proyecto).
4. Escribe `proyecto.json`, partiendo de `assets/ejemplo/proyecto.json` (el aprobado) o de `assets/plantilla_proyecto.json`.
5. `produccion.py <carpeta> estimar` → costo para la propuesta. Si el saldo no alcanza, avísale en la propuesta.

## 1. Referencias: personajes y locación
```
python produccion.py <carpeta> refs
python hoja.py <carpeta> refs      → mira revision/hoja_refs.png con Read
```
Revisa que cada hoja tenga la misma cara y la misma ropa en las 3 vistas, que se vea lo que cuenta la historia (la hinchazón, la calva) y que las edades sean las del guion. Para regenerar una: `produccion.py <carpeta> rehacer refs char_caro` (o `loc_principal`), que archiva la versión actual y genera la nueva.

## 2. Fotogramas (uno por toma)
```
python produccion.py <carpeta> frames
python hoja.py <carpeta> frames    → revision/hoja_frames.png
```
**Puerta de calidad (no animes sin pasarla):**
- La **mirada** de cada toma coincide con `mira` y con el mapa de ejes. Si las miniaturas no alcanzan, recorta las caras.
- Los lados son coherentes con el plano anterior.
- El **producto** se reconoce (forma, tapa, etiqueta) donde aparece. Ningún objeto parecido lo reemplaza (en una prueba salió un biberón).
- La continuidad de vestuario y peinado se mantiene.
- Nadie mira al lente sin motivo.

Regenera las que fallen, reforzando el `encuadre`: `produccion.py <carpeta> rehacer frames s05 s14` (10 créditos por imagen con GPT Image 2).

## 3. Clips con diálogo
```
python produccion.py <carpeta> video
python hoja.py <carpeta> clips     → revision/hoja_clips_N.png   (o "caras" para ver las miradas más grandes)
```
- Corre en paralelo. Omni tarda entre 2 y 6 minutos por clip. La toma de packshot (`imagen_fija`) no se anima.
- Si un clip falla por filtro ("minors", "real brands"), corrige el prompt según `prompts.md` §5 y repite solo esa toma.
- **Revisa en las hojas** que la mirada se mantenga durante la línea, que no haya un tercero hablando y que el producto siga siendo el producto.
- `montaje.py` revisa el diálogo y los cortes internos.

## 4. Montaje
```
python montaje.py <carpeta>
```
Si alguna toma sale "REVISAR", sigue `montaje.md`: fija el corte si la línea está bien dicha, o regenera el clip si está mal.

## 5. Revisión final (QA)
```
python revision.py <carpeta>       → montaje/revision.md
python hoja.py <carpeta> final     → un fotograma por toma montada
```
Si falla, corrige y repite el montaje. Mira tú mismo la hoja final y el flash. Ver `qa.md`.

## 6. Entrega
- Envía `FINAL_con_musica.mp4` y `FINAL_sin_musica.mp4` (SendUserFile si existe; si no, da las rutas).
- Escribe `INFORME.md`: entregables, qué se corrigió durante la producción, créditos (`produccion.py <carpeta> costo`) y aprendizajes.
- En el mensaje: duración, qué revisaste y cualquier cosa que no pudiste verificar.

## 7. Ajustes que pide el usuario después
| Pedido | Qué hacer |
|---|---|
| "En el segundo X se ve …" | Busca la toma en `montaje/qa.json` (`inicio_en_video` de cada una). Si el segundo cae justo en un corte, revisa las dos tomas. Saca fotogramas de ese instante (`ffmpeg -ss X -i FINAL_sin_musica.mp4 -frames:v 1 x.png`) y diagnostica. Si hay varias versiones (idiomas), pregunta cuál |
| Cambiar una línea | Edita `linea` (y la `entrega`) → `rehacer video sXX` (el fotograma sirve) → montaje → revisión |
| Cambiar la imagen de una toma | Edita `encuadre` → `rehacer frames sXX` → revisa → `rehacer video sXX` |
| Cambiar una mirada (mira a cámara) | Refuerza `encuadre` y `miradas` (lado, borde del otro, "never looks into the lens") → `rehacer frames sXX` si el fotograma ya mira mal, si no solo `rehacer video sXX` |
| Cambiar un personaje | Edita su `descripcion` → `rehacer refs char_<id>` → `rehacer frames` y `rehacer video` de las tomas donde aparece |
| Cambiar la música | `musica.archivo` (o `inicio`, `bajo_dialogo_lu`) → solo `montaje.py` |
| Cambiar el cierre o los textos | `textos`/`banda`/`tarjeta` → `montaje.py` |
| Un sonido que falta o suena mal | `audio: ambiente` + `efectos` → `montaje.py` |
| Otra duración u orden | Cambia el orden de `tomas` o quita tomas → `montaje.py` |
| Otro idioma o país | Ver §8 |
| Otro modelo | Cambia `modelos` → `rehacer` de lo que se quiera regenerar con el modelo nuevo |
Rehaz solo lo necesario: todo lo que no cambia se reutiliza desde el manifest.
Si el proyecto se hizo en Google Flow, rehaz en Flow y usa `registrar` (`google-flow.md`): `rehacer` genera en Kie.
Si una creación quedó "en duda" por un corte de red, `produccion.py` lo avisa. Revisa en los logs de kie.ai si la tarea existe antes de usar `rehacer`.

## 8. Versión en otro idioma o país (p. ej. México → Brasil)
1. **Carpeta nueva** (`<proyecto>_pt`), para no pisar los finales de la primera versión. Copia `proyecto.json` y la foto del producto.
2. En `proyecto.json` cambia:
   - `idioma_dialogo` ("Brazilian Portuguese", "English", "Spanish") e `idioma_whisper` ("pt", "en", "es").
   - El acento en la `voz` de cada personaje.
   - `palabras_permitidas`.
   - Cada `linea`: tradúcela y adáptala; no la traduzcas literal. Los chistes, la jerga y la oferta van como se dicen allá ("pagamento na entrega").
   - Los `textos` del cierre.
3. Si el casting y la locación sirven para el nuevo país, reutiliza las imágenes: copia del manifest original las entradas `char_*`, `loc_*`, `product` y `frame_*`, pero **no** las `clip_*` (los clips se regeneran porque cambia el diálogo). Si el país pide otro casting o lugar, regenera desde `refs`.
4. `video` → `montaje.py` → `revision.py`, como siempre. Costo: solo los clips (≈ 1.500 créditos con Omni).

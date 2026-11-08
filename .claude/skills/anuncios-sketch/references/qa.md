# Control de calidad

Tres puertas. Ninguna se salta: cada una evita gastar créditos en algo que después habrá que tirar.

## Puerta 1: guion (antes de generar nada)
- [ ] **Gancho** en 0–2 s. En la variante A, la primera línea ya expone el problema con un chiste o un insulto. En la B, la protagonista aparece luciendo el resultado y en la toma 2–4 ya empieza el chisme.
- [ ] Al menos 3 chistes antes de que aparezca (o se nombre) el producto.
- [ ] El producto entra entre el 60 % y el 80 % del video.
- [ ] La explicación del producto cabe en una frase (qué es + mecanismo de calle + oferta) y baja la voz en la oferta.
- [ ] **La objeción del cliente se dice en voz alta.** En la A la dice la víctima ("¿Tú? ¿Con esa cintura?"). En la B la dicen las chismosas ("eso es cirugía").
- [ ] **Termina con un chiste ANTES del CTA.** En la A lo dice alguien que no es el mensajero, o el mensajero con un gesto. En la B puede ser la protagonista con el secreto ("que sigan pensando que me operé").
- [ ] Usa "ayuda a" y no promesas absolutas de salud ("cura", "elimina", "baja X kilos").
- [ ] Una línea por toma, de 4 a 12 palabras (excepto la línea del producto: de 15 a 20).
- [ ] En pantalla, cada toma dura de 2 a 4 s (la del producto, de 6 a 9 s). La generación es más larga y el montaje recorta. El total va de 45 a 70 s.
- [ ] Hay mapa de ejes: cada toma dice quién está a qué lado y a quién mira. Las tomas a cámara (foto, CTA) llevan `"a_camara": true`.
- [ ] Hay entrega dirigida en cada línea (`actuacion.md`).
- [ ] La jerga y el acento son del país, y `idioma_dialogo`/`idioma_whisper` coinciden con el idioma del anuncio.

## Puerta 2: imágenes (antes de animar)
- [ ] Las hojas de personaje son consistentes y las edades, adultas y creíbles.
- [ ] La mirada de cada fotograma coincide con el mapa (`hoja.py frames`).
- [ ] El producto real se reconoce donde aparece (forma, tapa, etiqueta) y no hay objetos parecidos que lo reemplacen.
- [ ] Los fondos son coherentes con el lado de la cámara.
- [ ] El packshot tiene la etiqueta nítida y legible.

## Puerta 3: video final
`revision.py` cubre lo automático. Tú revisas lo visual.
- [ ] **Diálogo:** cada toma dice lo del guion, en el idioma del anuncio. El inglés (o cualquier otro idioma) solo si tiene razón de ser ("baby shower").
- [ ] **Voces fantasma:** las tomas mudas no tienen voces (VAD). Ojo: Whisper alucina sobre silencio ("Gracias por ver el video", "you", "Subtítulos por…"); si la VAD no detecta voz, es una alucinación y no un problema.
- [ ] **Nadie más habla** en las tomas con diálogo. Si se oye a otro personaje, regenera el clip.
- [ ] **Sin parpadeos:** los cambios de plano del final = cortes entre tomas (+ flashes).
- [ ] **Miradas** durante cada línea (hoja de clips).
- [ ] **Producto:** en las tomas de producto se ve el producto real, no un objeto parecido.
- [ ] **Efectos** sincronizados (el flash con el obturador).
- [ ] **Volumen:** −14 LUFS ±1 en las dos versiones, pico ≤ −1 dBFS, y la música nunca tapa la voz.
- [ ] 1080×1920, 30 fps, entre 45 y 70 s.

- [ ] **Sincronía:** la voz empieza junto con la imagen en cada toma (±60 ms; `revision.py` lo mide).

Para mirar el video entero sin reproductor: `hoja.py <carpeta> final` (un fotograma por toma montada) y `hoja.py <carpeta> clips` (cada clip en 4 instantes).

## Diagnóstico rápido
| Síntoma | Causa probable | Arreglo |
|---|---|---|
| Parpadeo de otro encuadre al inicio de una toma | Corte interno del clip | `montaje.py` lo evita; si persiste, rehaz el clip |
| El personaje mira a cámara | Prompt sin dirección de mirada, o "producto a cámara" | Refuerza `encuadre` + `miradas`; usa OTS |
| Otro personaje dice algo | Falta el bloque de quién no habla | Ya va en el prompt; rehaz el clip |
| Palabra rara o repetida | Improvisación del modelo | El corte por anclas la recorta; si está dentro de la línea, rehaz |
| Diálogo en inglés de fondo en una toma muda | Audio inventado por el modelo | `"audio": "ambiente"` |
| La etiqueta del packshot deformada | El packshot pasó por el modelo de video | `"imagen_fija": true` |
| Bloqueo "minors" / "real brands" | Filtros de Omni | `prompts.md` §5 |
| La voz se adelanta o atrasa respecto de los labios | Unión de partes AAC con concat demuxer (ya corregido en `montaje.py`) | Usa siempre `montaje.py`; no unas partes a mano con `-f concat -c copy` |

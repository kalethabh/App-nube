# Prompts: imagen y video

Los scripts arman los prompts solos desde `proyecto.json` (`comun.py`: `prompt_ref_personaje`, `prompt_fotograma`, `prompt_video`). Esta guía explica qué va en cada campo y por qué, para escribir bien las tomas. `produccion.py <carpeta> prompts video s05` imprime el prompt final de una toma.

Prompts en **inglés**; las líneas de diálogo en el idioma del anuncio, entre comillas.

## 1. Hojas de personaje (`personajes.<id>.descripcion`)
Una descripción fija por personaje, siempre con las mismas palabras: nombre en mayúsculas, origen, edad, piel, pelo, cara y cuerpo (sobre todo lo que cuenta la historia: la panza hinchada, la calva, las arrugas), vestuario completo con colores y accesorios.
- **Código de color:** la víctima en neutros claros (celeste, crema); el verdugo en un color saturado (verde esmeralda, rojo, coral); el mensajero en blanco o crema, impecable.
- Edades adultas explícitas. Si la historia toca embarazo, bebés o niños, no describas niños en escena y aclara las edades: los filtros de video tienen falsos positivos de "menores".
- `nombre`: el nombre con que el personaje aparece en los encuadres ("Caro", "Tia", "Don Rodrigo"). El prompt lo usa en mayúsculas en el bloque de quién habla y en el orden de las referencias, así que **escribe los encuadres con ese mismo nombre** (no con el id del personaje).
- `aspecto`: frase corta para reconocer al personaje dentro del cuadro ("the woman in the powder-blue satin dress with a dark low ponytail", "the man with the cream guayabera and the long black ponytail"). La usa el bloque de quién habla.
- `voz`: siempre la misma por personaje (edad, timbre, energía, acento: "Colombian paisa accent", "Mexican accent from Mexico City", "Brazilian Portuguese, carioca accent").
- `genero`: "f" o "m" (para She/He en el prompt de video). Si hay hombres, escribe sus encuadres y miradas con "he/his" y las variables de fondo en neutro ("behind them").

## 2. Locación (`locaciones.<id>`) y estilo (`estilo`)
- Locación aspiracional pero reconocible, **a la hora dorada**, con 4–6 elementos que se repiten (arco de globos, mesa de regalos, bombillos, montañas). Hay una imagen maestra por locación.
- `estilo` (va al final de cada fotograma): "Cinematic film still, shot on 35mm film with an 85mm lens, Kodak Portra 400 look, golden hour warm backlight, shallow depth of field, creamy bokeh, natural realistic skin texture with pores, premium Latin telenovela aesthetic, photorealistic, no text, no captions, no watermark".
- `variables`: textos reutilizables que se insertan con `{NOMBRE}` en cualquier campo (por ejemplo `{FONDO_VICTIMA_A}`, `{PRODUCTO}`).

## 3. Fotograma inicial de cada toma (`encuadre`)
Orden recomendado del texto:
1. **Plano** (two-shot de perfil, OTS, MCU, CU, plano de tres, frontal para foto) y **lados** (quién está a la IZQUIERDA y quién a la DERECHA).
2. **Dirección de la cara y de los ojos** de cada personaje en cuadro, y dónde está el otro si queda fuera ("looking at Tia just off-frame right").
3. **Lo que se ve en el borde** (hombro, pelo o ropa del otro, desenfocado).
4. **Expresión y gesto** del instante inicial (la línea todavía no empezó).
5. **El producto**, si aparece: descríbelo como es físicamente (ver `{PRODUCTO}`), dónde está (en la mano, a la altura del pecho, quieto) y "front facing the camera". **Nunca** "un frasco" genérico: en un baby shower, "a bottle" se convirtió en un biberón.
6. **Fondo** según el lado (variables de fondo).

El script agrega solo: las descripciones de los personajes, el orden de las referencias, la locación, "characters look at each other, never into the camera lens" (salvo `a_camara: true`, que va en la foto grupal y en el CTA a cámara) y el estilo.

**`dur`** es la duración que se **genera** (se redondea hacia arriba: con Omni Flash 1.2, al segundo entero, de 3 a 15 s, y cobra por segundo). Lo que se ve en el video lo decide el montaje, que recorta a la línea. Regla: 4 s para líneas de hasta 6 palabras y reacciones; 6 s para líneas de 7 a 12 palabras o con gesto; 8 s para la línea del producto.

**Varias locaciones:** define cada una en `locaciones` (`"terraza"`, `"bano"`) y pon `"locacion": "bano"` en las tomas que ocurren ahí. Si no se indica, la toma usa `"principal"`.

## 4. Clip de video (`accion`, `miradas`, `habla`, `linea`, `entrega`)
El script arma este bloque. Es la versión que funcionó en la prueba aprobada:
```
[aviso de edades] [género], vertical 9:16. [encuadre].
ONE single continuous shot from start to end: no cuts, no scene changes, no change of camera angle.
[cámara]. Action: [accion]. Eyelines: [miradas].
SPEAKER: TIA (the older woman with the short copper-auburn bob and the emerald green blouse) is the ONLY person who talks in this clip.
She starts talking within the first half second and says in Spanish, [entrega], with a [voz]: "[línea exacta]"
She says exactly those words and nothing else, with perfect lip sync, and then stays quiet.
CARO (the woman in the powder-blue satin dress...) does NOT talk: mouth closed for the whole clip, only silent facial reactions and small gestures.
Audio: natural dialogue and soft ambience of the location only. No background music, no subtitles, no on-screen text.
```
Por qué cada pieza:
- **Quién habla, identificado por su ropa y su posición**, y **quién NO habla**: sin esto, el modelo reparte la línea o le pone voz al otro personaje.
- **"Starts within the first half second"**: evita clips con 2 s de aire antes de la línea.
- **"Exactly those words and nothing else"**: el modelo improvisa repeticiones o agrega palabras ("Mira aquí y diga adiós").
- **"One single continuous shot"**: Omni a veces mete cortes de cámara dentro del clip (causan parpadeos en el montaje).
- **Tomas mudas:** "Nobody talks in this clip... no off-screen voices". Aun así, el montaje reemplaza su audio por ambiente verificado (`"audio": "ambiente"`): un clip "sin voces" traía un diálogo de telenovela en inglés de fondo.
- **Entrega**: usa el vocabulario de `actuacion.md` (sección 3): "says softly and tenderly, condescending smile", "incredulous, drags the word out slowly", "lowers voice, confidential, almost whispering".

## 5. Filtros de los modelos de video (evitar bloqueos)
| Bloqueo | Qué lo dispara | Cómo se evita |
|---|---|---|
| "Menores" (Omni) | "baby", "pregnant", manos sobre la panza, coronas de flores (rostros que parecen jóvenes) | `video.aviso_edades` ("All people in this scene are adults aged 30 to 82…"), edades explícitas (34 en vez de 30), sin contacto con la panza en el primer fotograma. El diálogo sí puede decir "embarazada" |
| "Marcas reales" (Omni) | "label facing the camera", "logo", nombres de marca en el prompt de video | En el video, describe el frasco por su forma ("its front facing the camera"). Usa `video.reemplazos` para cambiar palabras ("label" → "front") |
| Figuras públicas | Parecido con famosos | Personajes inventados, descripciones genéricas |
Las tareas bloqueadas no se cobran. Corrige el prompt o el fotograma; no repitas a ciegas.

`video.reemplazos` cambia palabras en todo el prompt de video **menos en la línea de diálogo** (la línea se dice tal cual).

**¿Se dice la marca en el diálogo?** Las referencias a veces la dicen ("Es mi jean Alzza", "Es No Age, una crema que…") y otras no ("este shampoo", "estas gotitas"). Recomendación: la línea del producto describe qué es y qué hace sin nombrar la marca, y la marca se ve en el frasco y en el texto del cierre. Si el usuario quiere que se diga y Omni bloquea la toma por "real brands", reescribe la línea sin la marca y avísale.

## 6. Producto
- Siempre la **foto real** del producto como referencia (`producto.imagen`), en cada fotograma donde aparece.
- `producto.descripcion`: forma, material, color, tapa o gotero, tamaño relativo a la mano y la etiqueta (texto principal). GPT Image 2 reproduce bien la etiqueta.
- **El packshot final nunca pasa por el modelo de video** (deforma el texto): se usa el fotograma fijo con un push-in en el montaje (`"imagen_fija": true`).

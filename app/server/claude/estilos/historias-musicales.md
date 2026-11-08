<!-- Lo propio de la HISTORIA MUSICAL en la tarea "guion" (se agrega a tarea-guion.md; skill anuncios-historias-musicales). Sin {{marcas}}: va tal cual. La produccion la hace app/server/lib/familias/historia-musical.js (con los pasos de musical.js): genera las 4 versiones de la cancion, el usuario elige de oido y recien ahi se miden las lineas y se escriben personajes, tomas y manifiesto. -->
## Lo propio de la Historia musical

- **Solo los Pasos 1 a 3.** El briefing ya viene contestado (arriba dice con qué) y lo demás lo hace la app: genera la canción con los dos estilos, el usuario elige la versión de oído y después la app mide cada línea y escribe los personajes, las tomas y el manifiesto con esta misma skill. No escribas `cancion/lineas.txt`, ni el manifiesto, ni `datos-editor.md`, y no corras ningún comando.
- **Cada línea de la letra es una toma**, de 6 a 14 palabras (Regla 5): con más de 14 el clip pasa de 10 segundos; con menos de 6 la ventana queda corta. Cuéntalas antes de terminar.
- **La letra es el guion tal cual** con las cinco etiquetas por acto (Paso 3.1), una línea vacía antes de cada etiqueta y ninguna dentro de un acto. Con sus tildes y su ñ de verdad.
- **Los dos prompts de estilo** siguen las reglas 1 y 2: voz cantada y expresiva (`fully sung expressive … lead vocal with melodic rises and falls`), el arco de menos a más en una frase, `mid tempo`, y nunca `spoken word`, `narration`, `rap`, `fast` ni negativos como `no drums`.
- **Si la letra pasa de 3.500 caracteres**, va en `bloques` cortados al final de un acto (Paso 3.3): la app los agrega sola con extend sobre la versión que elija el usuario.
- **Palabras que Suno no canta.** Suno frena letras con promesas de curar demasiado directas, enfermedades nombradas de forma cruda, groserías o nombres de famosos y de marcas ajenas (también en el CTA: "no dejes que te vendan Ozempic" nombra una marca). Cuéntalo con palabras de todos los días.
- **En `app/guion.json` agrega también `"estilos_cancion"`**: los dos estilos de `peticion.json`, en el mismo orden, contados en español sencillo para el usuario (por ejemplo `["Balada pop con piano que crece hasta un coro con batería", "Pop latino acústico, guitarra y piano, más cálido"]`). Los ve al elegir la versión de la canción.
- **En `decisiones`** van quién cuenta la historia, el villano y el mensajero si los propusiste tú, el tipo de cierre y el género si lo elegiste tú.

### Si después te piden cambios

- Si cambia una línea, cambia igual en la letra de `peticion.json`, en su bloque (si hay `bloques`) y en su parte de `app/guion.json`: siguen siendo una parte por línea, en orden.
- Si pide otro sonido o la otra voz, cambia los dos `estilos` (y `vocalGender`) y su versión en español en `estilos_cancion`. La letra no se toca para cambiar el sonido.

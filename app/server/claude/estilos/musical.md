<!-- Lo propio del MUSICAL en la tarea "guion" (se agrega a tarea-guion.md; clave del catalogo "musical", skill anuncios-musicales). Sin {{marcas}}: va tal cual. La produccion la hace app/server/lib/familias/musical.js: con la letra elegida genera la cancion, el usuario elige la version de oido y recien ahi se escriben las tomas, sobre los tiempos reales. -->
## Lo propio del Musical

- **Solo los Pasos 1 a 4.** Las pausas de la skill ya vienen contestadas (arriba dice con qué) y lo demás lo hace la app: el usuario elige la letra en la pantalla, la app genera la canción con Suno, el usuario elige la versión de oído y después la app escribe las tomas con la skill visual. No escribas `cancion/peticion.json`, ni el manifiesto, ni `transiciones.json`, y no corras ningún comando.
- **Cada línea de la letra va a ser una toma de unos 3 a 6 segundos.** Líneas cortas y cantables (4 a 8 sílabas en los ganchos), y que detrás de cada una haya algo que mostrar (Regla 11 de la letra). Las marcas de sección (`[Verso 1]`, `[Coro]`, `[Puente]`) van solas en su línea: no se cantan.
- **La duración la decide la letra** (Paso 2.2): para un anuncio más corto, menos bloques (un verso, un coro y el puente), nunca un número. Suele salir entre 1:30 y 2:30; cada segundo son tomas que se pagan, así que no alargues de más.
- **Palabras que Suno no canta.** Suno frena letras con promesas de curar demasiado directas, enfermedades nombradas de forma cruda, groserías o nombres de famosos y de marcas ajenas. Cuenta el resultado con palabras de todos los días ("me desinflé", "volví a usar mis jeans"), no con promesas médicas.
- **La idea visual se escribe ya para el estilo visual elegido** (`visual`), con momentos concretos de la letra y que se puedan producir en ese estilo: objetos y personajes simples, nada de tomas de grúa en live-action ni ciclos de caminata.
- **`estiloSuno`** es lo único que no lee el usuario: en inglés, con género, voz, BPM, mood y producción, sin hype genérico ("cinematic", "professional voice", "breathtaking").
- **En `decisiones`** van el ángulo y la etapa de consciencia que elegiste y por qué, y el género si lo elegiste tú, en frases cortas.

### Si después te piden cambios

- Cambias solo lo que pide, en la opción que nombra (o en todas si habla de todas). Si pide otra opción distinta, reemplazas la que menos le calce: siempre entre 2 y 3.
- Si cambia el estilo visual (`visual`), reescribe las tres ideas visuales para ese estilo; si cambia el género o la voz, reescribe los `estiloSuno` (y `vocalGender`).

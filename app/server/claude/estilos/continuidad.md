<!-- Lo propio del efecto CONTINUIDAD en la tarea "guion" (se agrega a tarea-guion.md, despues de lo propio del estilo, cuando brief.continuidad es true; solo en los 6 estilos de voz en off). Sin {{marcas}}: va tal cual. La produccion la hace app/server/lib/familias/continuidad.js con la skill anuncios-continuidad. -->
## Este anuncio va con el efecto continuidad (sin cortes)

El usuario eligió que el anuncio vaya sin cortes: cada video va a ir de la imagen de una toma a la imagen de la siguiente, y la IA del video hace el paso entre las dos escenas, de principio a fin. De eso se encarga la app después, con la skill `.claude/skills/anuncios-continuidad/SKILL.md`, cuando las imágenes ya estén hechas: ahora no la sigas ni escribas el bloque `continuidad` del manifiesto.

En el guion cambia solo esto:

- **El anuncio es el del estilo, completo y como siempre:** su guion, sus prompts de imagen y de video y su manifiesto, sin cambiar nada por la continuidad.
- **No escribas `transiciones.json`**, aunque el estilo o esta misma tarea lo pidan, y no decidas puntos de transición: con continuidad no hay transiciones ni efectos de editor; el paso de una escena a la otra lo hace cada video.
- **El B-roll**, si el estilo lo lleva, escríbelo igual en el manifiesto (así lo valida el estilo): la app lo guarda aparte y no lo produce. En `app/guion.json` no lo cuentes.
- **Cada toma tiene su propia frase del narrador** (`tomas[].linea`, ninguna vacía), en el orden en que se dice: la cadena va de frase en frase y la imagen siguiente llega cuando empieza su frase. Al menos 2 tomas.
- **En `app/guion.json`**, no expliques la continuidad en `decisiones`: el usuario ya la eligió.

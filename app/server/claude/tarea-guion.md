<!-- La tarea "guion" de los 12 estilos. Las {{marcas}} las llena app/server/lib/anuncios-nuevos.js (promptGuion):
     {{intro}}, {{pasos}}, {{archivo}} y {{formato}} cambian segun la fase (el anuncio hasta el manifiesto, o la letra en
     los cantados); {{ajustes}} dice que preguntas de la skill ya contesto el formulario de ese estilo; {{duracion}} dice
     si la duracion la decide la IA o el usuario dijo un tiempo (aproximado; vacio en el musical); {{delEstilo}} trae
     server/claude/estilos/<clave>.md (y estilos/continuidad.md si lleva el efecto), si existen. -->
TAREA: guion
Carpeta del anuncio: temp/{{slug}}
Estilo: {{estiloNombre}}. Lee y sigue `.claude/skills/{{skill}}/SKILL.md` (léelo entero antes de escribir nada).

{{intro}}

## BRIEF

```json
{{brief}}
```

- `producto` es la ficha que el usuario revisó y corrigió. Los campos que aparecen en `deducido` los dedujo la IA: úsalos con prudencia. Un campo vacío es un dato que no hay: no lo inventes; si la skill lo usa (precio, oferta, reseñas, cifras), el copy va sin él y lo anotas en "decisiones".
{{guionDelUsuario}}
- `ajustes_del_estilo`: lo que eligió el usuario en el formulario del estilo. Donde diga "que decida la IA", decides con el criterio de la skill (su opción por defecto o su regla de recomendación) y lo anotas en "decisiones".
{{ajustes}}
{{duracion}}
{{detalleProducto}}

## La foto del producto

{{foto}}

## Qué hacer, en orden

{{pasos}}

**El cierre de un video de prueba social** (vale para todos los estilos): si el anuncio se apoya en alguien con autoridad o en una experiencia real —un médico, una nutricionista, un experto, un testimonio, una mamá que lo usó, un podcast o una entrevista— el llamado a la acción NO es de venta («compra ya», «aprovecha la oferta», «pide el tuyo hoy»). Es una **recomendación** que convence, dicha como la diría esa persona a alguien que aprecia: por qué lo recomienda, para quién sirve y qué haría ella en su lugar («yo se lo recomiendo a mis pacientes que…», «si te pasa lo mismo, pruébalo; a mí me cambió…», «el enlace está aquí abajo, míralo con calma»). Si la skill trae un cierre de venta para ese formato, cámbialo por uno de recomendación y anótalo en "decisiones".

**Calidad al detalle en los prompts** (vale para todos los estilos; la app revisa las imágenes antes de hacer los videos y rehace las que no cumplan, así que hazlas bien desde el principio):
- **El producto, exacto.** Mira la foto del producto con Read y escribe UNA descripción fija del envase: forma y proporciones, material, color de cada parte, la tapa, y el TEXTO de la etiqueta transcrito letra por letra tal como se lee (el nombre de la marca, el del producto y lo que se lea grande). Cópiala palabra por palabra en cada prompt (de imagen y de video) donde se ve el producto, y adjunta siempre su foto como referencia. Nunca inventes textos, sellos ni logos que la etiqueta no tiene.
- **La misma persona y el mismo lugar en todas las escenas.** Cada persona y cada lugar que vuelve tiene una descripción fija (cara, edad, piel, pelo, cuerpo, ropa de ese momento; el set, los muebles, la luz y la hora): cópiala palabra por palabra en cada escena donde aparece. Si la historia cambia de ropa, de lugar o de hora, dilo claro en esa escena y mantenlo en las siguientes.
- **Cada imagen, un solo instante bien descrito**: el encuadre, la acción, las manos (cómo agarran el producto), la mirada y la expresión, la luz (de dónde viene, dura o suave, de qué color) y el acabado (realismo, lente, profundidad de campo), sin contradicciones con las escenas de al lado.
- **El audio**: el tono de cada línea va en su prompt de voz (energía, emoción, ritmo); con varias personas, la voz de cada una se describe igual en todo el anuncio.

Si falta un dato que la skill prohíbe inventar y sin él no hay anuncio: escribe `temp/{{slug}}/app/bloqueo.json` (regla 11 del modo app) y responde BLOQUEADO.

{{delEstilo}}

## Formato de {{archivo}}

{{formato}}

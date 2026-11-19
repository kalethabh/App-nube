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

Si falta un dato que la skill prohíbe inventar y sin él no hay anuncio: escribe `temp/{{slug}}/app/bloqueo.json` (regla 11 del modo app) y responde BLOQUEADO.

{{delEstilo}}

## Formato de {{archivo}}

{{formato}}

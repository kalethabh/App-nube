<!-- Lo propio del estilo podcast en la tarea "guion" (se agrega a la tarea, despues de lo que ya trae anuncios-nuevos.js: el brief contestado y el formato de guion.json). La produccion la hace app/server/lib/familias/hablado.js. -->
## Lo propio de este estilo: podcast

- Haz todo lo de la skill hasta su manifiesto, con todos sus chequeos: los dos hosts generados (A, y B con la imagen de A como referencia), bloques de generación de 10 s como máximo con su duración medida y redondeada hacia arriba a 4, 6, 8 o 10, un clip de reacciones sin palabras por host, cada cutaway con su frase `tras` (nunca al comienzo de un turno) y el B-roll de la solución a antes del CTA, compuesto para su modo. Lo que la skill manda hacer después (el costo y sus paradas, las imágenes, los clips, la revisión de cada clip, el recorte del host, el montaje y el informe) lo hace la app sola: no lo anuncies ni lo esperes.
- El modo del B-roll es pantalla dividida salvo que el usuario haya elegido la esquina. Si eligió la esquina, va así: la PC recorta al host después (tarda, pero no cuesta nada). No lo cambies por pantalla dividida.
- El dato de prueba tiene que ser real: si la ficha no trae ninguno, el guion va sin una cifra inventada y lo anotas en "decisiones".
- Si la marca se puede leer de dos maneras, la indicación de voz de esa línea dice cómo se pronuncia, sin cambiar la línea.
- Sin música y sin transiciones: no escribas `transiciones.json`.
- En `app/guion.json`, con el formato de arriba: `se_ve` dice quién está en cuadro y, si en esa línea entra un B-roll o la reacción del otro host, qué se ve. En "decisiones": cómo son los dos hosts y quién va a cada lado, el modo del B-roll, cómo entra el producto en la conversación y lo que dejaste fuera por falta de datos.

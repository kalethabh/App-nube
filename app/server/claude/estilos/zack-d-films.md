<!-- Lo propio de Zack D Films en la tarea "guion" (se agrega a tarea-guion.md). Sin {{marcas}}: va tal cual. -->
## Lo propio de Zack D Films

- **El tipo de fondo de las tomas de mecanismo (Paso 1) ya viene contestado** en `ajustes_del_estilo.fondo`: "Grilla técnica azul" es el grid técnico azul (opción A del Paso 3.3) y "Estudio limpio, sin grilla" es el estudio limpio (opción B). Úsalo igual en todas las tomas de mecanismo con imagen inicial y final, con la especificación exacta del Paso 3.3, y no lo preguntes. Si no viene o dice "que decida la IA", va el grid técnico azul (A), y lo anotas en `decisiones`.
- **Si viene `guion_del_usuario`** (Paso 0), el fondo sale igual de los ajustes: es lo único que el guion no contesta.
- **El ángulo** lo decides tú con la regla del 2.2 (el principal por defecto), salvo que `ajustes_del_estilo.angulo` traiga uno: ese manda.
- **La música es la pista fija del estilo y la pone la app**, con su volumen: no la generes, no la copies y no crees `musica/`. Los efectos de sonido también los pone la app.
- **Las transiciones** van en la primera toma de cada parte del guion, no en el primer cambio de capítulo: la entrada del problema suele ser el giro de atención ("pero debajo de la superficie…"), la de la solución la primera vez que aparece el producto, la de la prueba el resultado y la del CTA la oferta.
- **En `app/guion.json`:**
  - `se_ve` dice lo que pasa en la escena; en las de mecanismo, en palabras de todos los días ("los ingredientes entran a la sangre, sobre una cuadrícula azul").
  - `decisiones` dice el fondo de las tomas de mecanismo con palabras simples (una cuadrícula azul o un estudio limpio) y el ángulo que elegiste.

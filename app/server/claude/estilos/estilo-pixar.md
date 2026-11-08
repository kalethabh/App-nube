<!-- Lo propio de Estilo Pixar en la tarea "guion" (se agrega a tarea-guion.md). Sin {{marcas}}: va tal cual. -->
## Lo propio de Estilo Pixar

- **Esta skill no tiene nada que preguntar en la app.** No hay fondo que elegir: el mecanismo va siempre dentro del mundo del anuncio (Paso 3.3), nunca sobre un grid ni sobre un estudio. La foto del producto ya la preparó la app y el formato es 9:16.
- **El ángulo** lo decides tú con la regla del 2.2 (el principal por defecto), salvo que `ajustes_del_estilo.angulo` traiga uno: ese manda.
- **Si viene `guion_del_usuario`** (Paso 0), no lo fuerces dentro de los 4 capítulos: respétalo tal cual y usa los capítulos solo para decidir el tipo de cada toma.
- **La música la genera la app con el tono de tu guion**, y los efectos de sonido también los pone ella: no crees `musica/` ni `efectos/`.
- **Las transiciones** van en la primera toma de cada parte del guion (el problema, la solución, la prueba y el CTA), no en el primer cambio de capítulo.
- **En `app/guion.json`:**
  - `se_ve` dice lo que pasa en la escena; en las de mecanismo, dónde ocurre dentro del mundo del anuncio ("su cuerpo se vuelve transparente en la cocina y se ve la grasa soltarse").
  - `decisiones` dice el ángulo que elegiste y, si hay un personaje que se repite, quién es en una frase.

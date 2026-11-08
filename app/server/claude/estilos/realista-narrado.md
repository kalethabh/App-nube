<!-- Lo propio de Realista con narrador en la tarea "guion" (se agrega a tarea-guion.md). Sin {{marcas}}: va tal cual. -->
## Lo propio de Realista con narrador

- **Esta skill sigue el proceso de Estilo Pixar** (`.claude/skills/anuncios-estilo-pixar/SKILL.md`): léelo entero también, como dice la skill, y aplica solo lo que cambia en la de Realista (el ADN visual, quién narra, `estilo: "realista-narrado"` y las referencias del antes y el después). La foto del producto ya la preparó la app y el formato es 9:16.
- **Quién narra** sale de `ajustes_del_estilo.narra`; con "que decida la IA", un hijo o una hija adultos que cuentan lo de su papá o su mamá.
- **El ángulo** lo decides tú con la regla de Pixar (el principal por defecto), salvo que `ajustes_del_estilo.angulo` traiga uno: ese manda.
- **Si viene `guion_del_usuario`** (Paso 0), respétalo tal cual y usa los capítulos solo para decidir el tipo de cada toma.
- **La música la genera la app con el tono de tu guion**, y los efectos de sonido también los pone ella: no crees `musica/` ni `efectos/`.
- **Las transiciones** van en la primera toma de cada parte del guion (el problema, la solución, la prueba y el CTA).
- **En `app/guion.json`:**
  - `se_ve` dice lo que pasa en la escena; en las de mecanismo, qué se ve dentro del cuerpo ("el cuerpo translúcido muestra el residuo ámbar que se suelta").
  - `decisiones` dice quién narra, el ángulo, el subestilo (si usaste uno) y, en una frase, quién es la persona del antes y el después.

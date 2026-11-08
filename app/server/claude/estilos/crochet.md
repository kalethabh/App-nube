<!-- Lo propio de Crochet en la tarea "guion" (se agrega a tarea-guion.md). Sin {{marcas}}: va tal cual. -->
## Lo propio de Crochet

- **La única pausa de la skill (Paso 2: ángulo y personaje) ya viene contestada.** No la hagas ni muestres el mensaje del checkpoint: las dos respuestas salen de `ajustes_del_estilo`.
  - **El ángulo (`angulo`):** si el usuario eligió uno o escribió el suyo, ese manda. Si dice "que decida la IA" o no viene, eliges tú el que mejor calce del catálogo del Paso 3.1, sin ofrecer alternativas.
  - **El personaje (`personaje`):** si el usuario describió el suyo, es la opción B del Paso 5 (su descripción, contada en lana y tejido). Si pidió que no haya personaje fijo, es la C. Si dice "que decida la IA", acepta la sugerencia o no viene, es la A, con el personaje que tú sugerirías para este producto. Si el ángulo que quedó necesita dos personajes fijos, van dos (opción D), aunque no los hayan pedido.
- **Si viene `guion_del_usuario`** (Paso 0), el ángulo ya está dentro del guion: de los ajustes solo sale el personaje.
- **Las transiciones:** si las 1 a 3 primeras tomas son un gancho de varios golpes, la entrada del problema es la toma donde se nombra el problema, no la segunda del gancho.
- **La música y los efectos de sonido los pone la app** (la música, con el tono de tu guion): no crees `musica/` ni `efectos/`.
- **En `app/guion.json`:**
  - `se_ve` cuenta cada escena como lo que es, un mundo en miniatura tejido en lana ("una mujer de lana se mira en el espejo de su baño tejido").
  - `decisiones` dice el ángulo que quedó y por qué, y el personaje en una frase (quién es y cómo se ve); si van dos, los dos.
